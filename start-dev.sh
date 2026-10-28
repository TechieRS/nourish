#!/bin/bash
# macOS-compatible Bash 3.2+. Resolve every project path independently of $PWD.
set -Eeuo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
BACKEND_DIR="$PROJECT_DIR/backend"
PYTHON="$BACKEND_DIR/.venv/bin/python"
PGDATA="$PROJECT_DIR/.local/postgres"
LOG_DIR="$PROJECT_DIR/.local/dev"
backend_pid=""
frontend_pid=""
started_postgres=0
lock_owned=0
LOCK_DIR="$LOG_DIR/launcher.lock"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-3}"

say() { printf '[Nourish] %s\n' "$*"; }
die() { say "ERROR: $*" >&2; exit 1; }
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  say 'Stopping only processes started by this launcher...'
  # These PIDs belong to direct exec children; no broad pkill/killall or port killing.
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill -TERM "$frontend_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
  fi
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill -TERM "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  if [[ "$started_postgres" == 1 ]]; then
    # Never stop a pre-existing PostgreSQL server. Data is not deleted or reset.
    pg_ctl -D "$PGDATA" -w stop -m fast >> "$LOG_DIR/postgres-control.log" 2>&1 || say 'PostgreSQL could not be stopped; inspect .local/dev/postgres-control.log.'
  fi
  if [[ "$lock_owned" == 1 ]]; then
    rm -f "$LOCK_DIR/pid"
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for executable in node npm curl lsof; do
  command -v "$executable" >/dev/null || die "$executable is missing from PATH. Install it, then retry."
done
[[ -x "$PYTHON" ]] || die 'Missing backend/.venv. Follow the Python setup in README.md.'
[[ -f "$PROJECT_DIR/frontend/package.json" ]] || die "Missing frontend/package.json under $PROJECT_DIR."
[[ -f "$PROJECT_DIR/frontend/node_modules/vite/bin/vite.js" ]] || die 'Frontend dependencies are missing. Run: npm --prefix frontend ci'
"$PYTHON" -c 'import fastapi, uvicorn, pydantic, pydantic_settings, sqlalchemy, alembic, psycopg' 2>/dev/null || die 'Backend dependencies are missing. Run: backend/.venv/bin/pip install -r backend/requirements.lock.txt'
mkdir -p "$LOG_DIR"
# Atomic lock prevents two launchers racing to take ownership of the same database.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  die 'A launcher lock already exists (.local/dev/launcher.lock). If a launcher is still running, use its URLs. If it previously crashed, verify that it is stopped before removing that lock directory.'
fi
lock_owned=1
printf '%s\n' "$$" > "$LOCK_DIR/pid"

for port in 8000 5173; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    die "Port $port is already in use. Stop the existing service in its own terminal, or use it if it is already Nourish. No existing process has been stopped."
  fi
done

DB_INFO="$(cd "$BACKEND_DIR" && "$PYTHON" - <<'PY'
import sys
try:
    from app.core.config import get_settings
    from sqlalchemy.engine import make_url
    url = make_url(get_settings().database_url)
    print(f'{url.host or "localhost"}\t{url.port or 5432}')
except Exception:
    print('Invalid backend environment configuration. Check backend/.env; credentials have not been printed.', file=sys.stderr)
    sys.exit(1)
PY
)" || die 'Could not read backend settings.'
IFS=$'\t' read -r DB_HOST DB_PORT <<< "$DB_INFO"
[[ "$DB_PORT" =~ ^[0-9]+$ ]] || die 'The configured database port is invalid.'

db_connects() {
  (cd "$BACKEND_DIR" && "$PYTHON" - <<'PY'
import sys
from sqlalchemy import text
from app.db.session import engine
try:
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
except Exception:
    sys.exit(1)
PY
  ) 2>/dev/null
}

if db_connects; then
  say "Using the existing PostgreSQL connection on port $DB_PORT (will leave it running on exit)."
else
  case "$DB_HOST" in
    localhost|127.0.0.1|::1) ;;
    *) die 'The configured remote PostgreSQL database cannot be reached. Check backend/.env and your network; no remote configuration was changed.' ;;
  esac
  command -v pg_ctl >/dev/null || die 'pg_ctl is not on PATH. Install PostgreSQL or add its bin directory to PATH.'
  [[ -f "$PGDATA/PG_VERSION" ]] || die 'No existing project PostgreSQL cluster was found at .local/postgres. Start your configured database manually; this script never creates or resets a cluster.'
  if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    die "The project PostgreSQL instance is already running but the configured connection fails. Check backend/.env (configured port $DB_PORT)."
  fi
  if lsof -nP -iTCP:"$DB_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    die "Database port $DB_PORT belongs to another listener, but the configured database connection failed. No process was stopped."
  fi
  say "Starting the existing project PostgreSQL instance on port $DB_PORT..."
  pg_ctl -D "$PGDATA" -l "$LOG_DIR/postgres.log" -o "-p $DB_PORT -h 127.0.0.1 -k /tmp" -w start >> "$LOG_DIR/postgres-control.log" 2>&1 || die 'PostgreSQL failed to start. See .local/dev/postgres.log and postgres-control.log.'
  started_postgres=1
  db_connects || die 'PostgreSQL started, but the configured database connection failed. Check backend/.env; no database has been created or reset.'
fi

say 'Checking and applying forward-only Alembic migrations (no seed, reset or data deletion)...'
(cd "$BACKEND_DIR" && "$PYTHON" -m alembic upgrade head) >> "$LOG_DIR/migrations.log" 2>&1 || die 'Migration failed. Inspect .local/dev/migrations.log before retrying.'

say 'Starting FastAPI and React/Vite...'
(cd "$BACKEND_DIR" && exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) > "$LOG_DIR/backend.log" 2>&1 &
backend_pid=$!
# Start the installed Vite CLI directly so npm cannot discover an ancestor package
# and the launcher owns the server PID rather than an npm subprocess wrapper.
(cd "$PROJECT_DIR/frontend" && exec node node_modules/vite/bin/vite.js --host localhost --port 5173 --strictPort) > "$LOG_DIR/frontend.log" 2>&1 &
frontend_pid=$!

ready=0
for attempt in $(seq 1 40); do
  kill -0 "$backend_pid" 2>/dev/null || die 'FastAPI exited. Inspect .local/dev/backend.log.'
  kill -0 "$frontend_pid" 2>/dev/null || die 'Vite exited. Inspect .local/dev/frontend.log.'
  if curl --noproxy '*' --fail --silent --max-time 2 http://127.0.0.1:8000/api/health >/dev/null &&
     curl --noproxy '*' --fail --silent --max-time 2 http://localhost:5173/ >/dev/null &&
     curl --noproxy '*' --fail --silent --max-time 2 http://localhost:5173/api/health >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || die 'Services did not become ready. Check the logs in .local/dev/.'

say 'Ready - frontend, backend and proxied database health checks passed.'
printf '\n  App:          http://localhost:5173\n  Nutritionist: http://localhost:5173/nutritionist\n  API:          http://127.0.0.1:8000\n  API docs:     http://127.0.0.1:8000/docs\n  Health:       http://127.0.0.1:8000/api/health\n\n'
say "Logs: $LOG_DIR"
say 'Press Ctrl+C to stop the servers started by this launcher. Existing database data is preserved.'
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 2
done
die 'A development server stopped unexpectedly. Inspect .local/dev/backend.log and frontend.log.'
