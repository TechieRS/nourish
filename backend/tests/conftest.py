import os
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

url = os.environ.get("TEST_DATABASE_URL", "")
if not url or not (make_url(url).database or "").endswith("_test"):
    raise RuntimeError(
        "Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test. Tests truncate its tables."
    )
os.environ["DATABASE_URL"] = url
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
os.environ["APP_TIMEZONE"] = "Asia/Kolkata"
from app.main import app  # noqa: E402 - configure isolated test environment first
from app.db.session import engine  # noqa: E402
from app.services import scheduling  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrate():
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE appointment_audit_logs, appointments, clients CASCADE")
        )
    monkeypatch.setattr(
        scheduling,
        "now",
        lambda: datetime(2026, 10, 28, 8, 0, tzinfo=ZoneInfo("Asia/Kolkata")),
    )


@pytest.fixture
def api():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def client_id(api):
    response = api.post(
        "/api/clients",
        json={"full_name": "Fictional Client", "phone": "+44 7700 900123"},
    )
    assert response.status_code == 201
    return response.json()["id"]
