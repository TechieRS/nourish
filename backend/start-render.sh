#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set the hosted PostgreSQL connection string in Render}"
: "${FRONTEND_URL:?Set the Vercel frontend origin in Render}"
python - <<'PY'
from app.core.config import get_settings
from sqlalchemy.engine import make_url
s = get_settings()
u = make_url(s.database_url)
if not u.host or u.host in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit("Render requires a hosted PostgreSQL database.")
if not s.frontend_url.startswith("https://"):
    raise SystemExit("Render requires an HTTPS FRONTEND_URL.")
PY
alembic upgrade head
python -m app.db.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers
