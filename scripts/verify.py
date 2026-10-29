#!/usr/bin/env python3
"""Run the complete QA suite with isolated PostgreSQL databases and owned servers."""

import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
PYTHON = (
    str(BACKEND / ".venv/bin/python")
    if (BACKEND / ".venv/bin/python").exists()
    else sys.executable
)


def run(args, cwd=ROOT, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_ready(url, process):
    for _ in range(60):
        if process.poll() is not None:
            raise RuntimeError(f"Server exited early; inspect .local/qa logs ({url}).")
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f"Server did not become ready: {url}")


def database_urls():
    from dotenv import dotenv_values
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    base = os.environ.get("DATABASE_URL") or dotenv_values(BACKEND / ".env").get(
        "DATABASE_URL"
    )
    urls = [os.environ.get("TEST_DATABASE_URL"), os.environ.get("E2E_DATABASE_URL")]
    if not all(urls):
        if not base:
            raise RuntimeError(
                "Configure backend/.env or both TEST_DATABASE_URL and E2E_DATABASE_URL."
            )
        parsed = make_url(base)
        if parsed.host not in {"localhost", "127.0.0.1", "::1"}:
            raise RuntimeError(
                "Automatic database creation is local only. Supply dedicated *_test database URLs."
            )
        if parsed.drivername in {"postgres", "postgresql"}:
            parsed = parsed.set(drivername="postgresql+psycopg")
        admin = create_engine(
            parsed.set(database="postgres"), isolation_level="AUTOCOMMIT"
        )
        with admin.connect() as connection:
            for index, name in enumerate(
                ["nourish_verify_test", "nourish_verify_e2e_test"]
            ):
                if not urls[index]:
                    if not connection.scalar(
                        text("SELECT 1 FROM pg_database WHERE datname=:name"),
                        {"name": name},
                    ):
                        connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
                    urls[index] = parsed.set(database=name).render_as_string(
                        hide_password=False
                    )
        admin.dispose()
    for url in urls:
        if not (make_url(url).database or "").endswith("_test"):
            raise RuntimeError(
                "Both QA database names must end in _test. Their application tables are cleared."
            )
    if make_url(urls[0]) == make_url(urls[1]):
        raise RuntimeError(
            "Backend tests and browser tests require different dedicated databases."
        )
    return urls


def main():
    major = subprocess.check_output(
        ["node", "-p", 'process.versions.node.split(".")[0]'], text=True
    ).strip()
    if major != "22":
        raise RuntimeError(
            'Use Node 22: nvm use, or npm exec --yes --package=node@22 -c "backend/.venv/bin/python scripts/verify.py"'
        )
    test_db, browser_db = database_urls()
    api_port, web_port = port(), port()
    api_url, web_url = f"http://127.0.0.1:{api_port}", f"http://127.0.0.1:{web_port}"
    env = {
        **os.environ,
        "DATABASE_URL": browser_db,
        "TEST_DATABASE_URL": test_db,
        "FRONTEND_URL": web_url,
        "CORS_ORIGINS": "",
        "APP_TIMEZONE": "Asia/Kolkata",
        "VITE_API_BASE_URL": api_url + "/api",
        "E2E_API_URL": api_url + "/api",
        "E2E_BASE_URL": web_url,
        "EXPECT_PWA": "true",
    }
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not env.get("CI") and not env.get("CHROME_PATH") and Path(chrome).exists():
        env["CHROME_PATH"] = chrome
    logs = ROOT / ".local/qa"
    logs.mkdir(parents=True, exist_ok=True)
    run(
        [
            PYTHON,
            "-m",
            "ruff",
            "check",
            "backend/app",
            "backend/tests",
            "scripts/verify.py",
            "scripts/smoke.py",
            "scripts/deploy-render.py",
            "scripts/http_utils.py",
            "--isolated",
            "--select",
            "E4,E7,E9,F",
        ],
        ROOT,
        env,
    )
    run([PYTHON, "-m", "pip_audit", "-r", "requirements.lock.txt"], BACKEND, env)
    run(["npm", "audit", "--audit-level=moderate"], ROOT / "frontend", env)
    run(
        [
            PYTHON,
            "-m",
            "pytest",
            "-q",
            "--cov=app",
            "--cov-report=term-missing",
            f"--cov-report=json:{logs / 'coverage.json'}",
            "--cov-fail-under=95",
        ],
        BACKEND,
        env,
    )
    run(["npm", "test"], ROOT / "frontend", env)
    run(["npm", "run", "build"], ROOT / "frontend", env)
    run([PYTHON, "-m", "alembic", "upgrade", "head"], BACKEND, env)
    from sqlalchemy import create_engine, text

    engine = create_engine(browser_db)
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE appointment_audit_logs, appointments, clients CASCADE")
        )
    engine.dispose()
    run([PYTHON, "-m", "app.db.seed"], BACKEND, env)
    children = []
    try:
        with (
            (logs / "api.log").open("w") as api_log,
            (logs / "frontend.log").open("w") as web_log,
        ):
            api = subprocess.Popen(
                [
                    PYTHON,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(api_port),
                ],
                cwd=BACKEND,
                env=env,
                stdout=api_log,
                stderr=subprocess.STDOUT,
            )
            children.append(api)
            web = subprocess.Popen(
                [
                    "npm",
                    "run",
                    "preview",
                    "--",
                    "--port",
                    str(web_port),
                    "--strictPort",
                ],
                cwd=ROOT / "frontend",
                env=env,
                stdout=web_log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            children.append(web)
            wait_ready(api_url + "/api/health", api)
            wait_ready(web_url, web)
            run(["npm", "run", "test:e2e"], ROOT / "frontend", env)
            run(["npm", "run", "test:smoke"], ROOT / "frontend", env)
            run(
                [
                    PYTHON,
                    "scripts/smoke.py",
                    "--backend-url",
                    api_url,
                    "--frontend-url",
                    web_url,
                ],
                ROOT,
                env,
            )
    finally:
        import signal

        for child in reversed(children):
            if child.poll() is None:
                if child is children[-1] and len(children) == 2:
                    os.killpg(child.pid, signal.SIGTERM)
                else:
                    child.terminate()
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()
    print(
        "Complete QA passed. Database, frontend, API, browser, accessibility and PWA checks succeeded."
    )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"QA failed: {error}", file=sys.stderr)
        sys.exit(1)
