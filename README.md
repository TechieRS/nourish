# nourish.

**Your wellness journey, beautifully organized.**

A mobile-first nutrition consultation app with a connected practitioner dashboard. Nourish replaces WhatsApp/Excel scheduling with shared, persistent appointment records and lightweight attendance confirmation to reduce wasted consultation slots.

This is an intentionally public assignment demo. The selector represents fictional clients, not authenticated users. Use fictional information only.

![Nourish desktop home](docs/screenshots/home-desktop.png)

[Mobile screenshot](docs/screenshots/home-mobile.png) · [Architecture and phase plan](docs/implementation-plan.md) · [Assignment draft](docs/assignment.md) · [QA results](docs/qa-results.md) · [Compliance checklist](docs/compliance.md)

## Features

- Personalized home, upcoming consultation preview and timing-based in-app reminders.
- Guided booking: practice calendar → live available time → validated details → database-confirmed success.
- Existing and newly created demo clients with stable UUIDs; optional, consistently normalized international/local phone numbers.
- Upcoming/past history with distinct Booked, Done and No-show badges.
- Atomic reschedule, soft cancellation, attendance confirmation timestamps and calendar .ics download.
- `/nutritionist`: real summary counts, search by name/phone, Today/status/Cancelled filters, manual booking and status updates.
- PostgreSQL conflict protection, audit log and exact, idempotent assignment seed.
- Responsive Chakra design, keyboard-accessible dialogs, reduced-motion support and safe-area mobile navigation.
- PWA manifest/icons and offline application shell. Booking always requires the network; API responses are never cached.

## Stack and structure

React 18 / Vite / TypeScript / Chakra UI 2 / React Router 6 / React Hook Form / Zod / TanStack Query / Lucide / Framer Motion / date-fns. Python 3.13 / FastAPI / Pydantic 2 / SQLAlchemy 2 / Alembic / psycopg / PostgreSQL 16. Deployment target: Vercel + Render + Supabase PostgreSQL.

```text
nourish/
├── frontend/
│   ├── src/{app,components,features,hooks,layouts,pages,services,theme,types,utils}
│   ├── public/                  # Original SVG and installable PNG icons
│   ├── e2e/                     # Real API workflows, viewport and accessibility checks
│   ├── vite.config.ts
│   └── vercel.json
├── backend/
│   ├── app/{api,core,db,models,schemas,services}
│   ├── alembic/versions/        # Explicit PostgreSQL schema migration
│   ├── tests/                  # PostgreSQL integration and concurrent booking tests
│   ├── requirements.txt        # Supported dependency ranges
│   └── requirements.lock.txt   # Exact tested Python versions
├── docs/                       # Brief, plan, assignment, QA, screenshots and conversation
├── scripts/export-conversation.py
├── compose.yaml                # Optional local PostgreSQL
├── render.yaml
└── .env.example
```

```mermaid
flowchart LR
    C[Client interface] --> Q[TanStack Query / REST client]
    N[Nutritionist dashboard] --> Q
    Q --> F[FastAPI scheduling services]
    F --> S[SQLAlchemy transactions]
    S --> P[(PostgreSQL)]
    A[Alembic migration + deterministic seed] --> P
```

## Start the configured macOS development app

From the project root:

```bash
cd /Users/ravibhushansharma/Desktop/Assign/nourish
./start-dev.sh
```

The executable launcher resolves its own directory, checks existing dependencies and ports, reads `backend/.env` without sourcing it as shell code, starts the existing `.local/postgres` cluster only if the configured local database is unavailable, applies forward-only pending migrations and starts FastAPI plus Vite. It never initializes, seeds, resets or deletes database data. If PostgreSQL was already reachable, the launcher leaves it running on exit. It refuses occupied application ports and concurrent launcher instances rather than killing another process.

Open **http://localhost:5173**, **http://localhost:5173/nutritionist**, or **http://127.0.0.1:8000/docs**. Ctrl+C stops only the servers started by this launcher (including PostgreSQL only if this launcher started it). Logs are in ignored `.local/dev/`. A stale lock after a forced shutdown is reported with recovery instructions; do not remove it while another launcher is running.

For frontend-only development, use `cd frontend && npm run dev` or `npm --prefix /Users/ravibhushansharma/Desktop/Assign/nourish/frontend run dev`. Running npm from Desktop or Assign does not select the frontend package. Desktop contains a separate `node_modules` directory, so npm discovers it as an ancestor package root and then fails because Desktop has no `package.json`. No global npm configuration change is needed.

## Local setup

Requirements: Node.js 22, Python 3.13, PostgreSQL 16 (or Docker Compose). Run commands from this repository’s `nourish/` directory. No Supabase credentials are needed for local development.

Start PostgreSQL using either your native installation or the included container:

```bash
docker compose up -d db
```

The container exposes localhost:5432 with development database/user/password `nourish` / `postgres` / `postgres`. These are local demo settings, not deployment secrets. For a native installation, create a database and set its connection string in `backend/.env`.

Backend terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock.txt
cp .env.example .env
# Edit .env if your PostgreSQL connection differs.
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend terminal:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. Practitioner dashboard: http://127.0.0.1:5173/nutritionist. Interactive API docs: http://127.0.0.1:8000/docs. Vite proxies `/api` to the backend.

The development `.env` created during implementation points to the isolated native database on port **55439**. It is ignored by Git. Copying `.env.example` replaces it with the standard port-5432 settings. To restart that existing local database if needed:

```bash
pg_ctl -D "$PWD/.local/postgres" -l "$PWD/.local/postgres.log" -o '-p 55439 -h 127.0.0.1 -k /tmp' start
```

## Configuration

| Variable | Process | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Backend | PostgreSQL connection string; accepts `postgres://`, `postgresql://`, or `postgresql+psycopg://` |
| `FRONTEND_URL` | Backend | Exact frontend origin, without trailing slash |
| `CORS_ORIGINS` | Backend | Comma-separated additional exact allowed origins |
| `APP_TIMEZONE` | Backend | IANA practice timezone, default `Asia/Kolkata` |
| `VITE_API_BASE_URL` | Frontend build | `/api` locally; `https://YOUR-API.onrender.com/api` when deployed |
| `TEST_DATABASE_URL` | Backend tests | Dedicated database ending in `_test`; its tables are truncated |
| `E2E_BASE_URL` / `E2E_API_URL` | Browser tests | Optional frontend / API URLs |
| `CHROME_PATH` | Browser tests | Optional installed Chrome executable; otherwise use Playwright Chromium |

Keep `.env` files out of source control. Never place database credentials in `VITE_` variables.

## Database and scheduling

`clients`: UUID, full_name, nullable normalized phone, timestamps. `appointments`: UUID, client FK, practice date/start/end, status, independent attendance confirmation/time, cancellation timestamp, created/updated timestamps. `appointment_audit_logs`: UUID, appointment FK, action, old/new JSON and timestamp.

A PostgreSQL partial unique index enforces one non-cancelled appointment per date/start. CHECK constraints enforce 30-minute duration, half-hour start grid, legal status and consistent confirmation timestamp. Because every accepted appointment uses the same 30-minute grid, distinct starts cannot overlap. Reschedule updates the same record under a row lock and commits once; a conflict rolls back the entire update. Cancelled records release the slot without deleting history.

Default availability: Monday–Saturday, 09:00–12:00 and 14:00–17:00, in 30-minute increments, up to 90 days ahead. Past times and Sundays are unavailable. Practice timezone decides “today”; the browser’s timezone does not. Rules live in `backend/app/services/scheduling.py`.

The seed preserves all five provided historical appointments, including old Booked records and the Sunday 25 October record, without applying new-booking restrictions retroactively. It merges Riya by deterministic client UUID, removes phone formatting without inventing country codes, and keeps Meera’s phone NULL. Re-running it preserves existing records and edits. See [normalization decisions](docs/assignment.md).

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database-aware readiness |
| GET | `/api/config` | Practice timezone/date/time and scheduling horizon |
| GET / POST | `/api/clients` | List / create fictional clients |
| GET | `/api/availability?date=YYYY-MM-DD` | Available slots only |
| GET | `/api/appointments` | Optional client_id, today, status, search, include_cancelled filters |
| POST | `/api/appointments` | Save a booking |
| GET | `/api/appointments/{id}` | Retrieve one appointment |
| POST | `/api/appointments/{id}/reschedule` | Atomic change of date/time |
| POST | `/api/appointments/{id}/cancel` | Soft cancellation |
| POST | `/api/appointments/{id}/confirm` | Persist attendance confirmation |
| PATCH | `/api/appointments/{id}/status` | Booked → Done / No-show |
| GET | `/api/dashboard/summary` | Actual today/upcoming/confirmed/no-show counts |

Dates are ISO, times 24-hour, IDs UUID, timestamps timezone-aware. Slot conflicts return 409; validation 422; missing resources 404; unavailable database 503 with a friendly message. FastAPI provides the complete schemas at `/docs` and `/openapi.json`.

## Testing

Backend tests exercise actual PostgreSQL, not SQLite. Create a separate test database. The suite refuses to run unless its name ends in `_test`, then truncates only that selected database’s application tables.

```bash
# Native PostgreSQL example (adjust host, port and user):
createdb -h localhost -U postgres nourish_test
cd backend
source .venv/bin/activate
TEST_DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/nourish_test' python -m pytest -q
```

Frontend checks:

```bash
cd frontend
npm test
npm run build
```

Browser checks require both servers running against a dedicated fictional demo database. They create real test profiles and bookings; successful tests cancel eligible bookings, but terminal/history records remain. Do not target a database containing real information.

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
# macOS alternative using an existing Chrome installation:
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

[QA results](docs/qa-results.md) report only checks actually executed. Automated axe checks supplement manual keyboard/visual inspection; they are not a full WCAG certification.

## Deployment

Deployment is **prepared, not live**. No hosting accounts, database credentials or public URL have been supplied.

1. Create a Supabase project dedicated to this fictional demo. Copy the **Session pooler** PostgreSQL URI from Connect (appropriate for a persistent SQLAlchemy service), use the exact supplied username/host and SSL parameters. Keep it on the backend only. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Push this repository to GitHub. Import `render.yaml` as a Render Blueprint, or create a Python web service with root directory `backend`, build `pip install -r requirements.lock.txt`, and start `alembic upgrade head && python -m app.db.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set DATABASE_URL to the Supabase URI, APP_TIMEZONE, FRONTEND_URL and CORS_ORIGINS. The demo’s single-instance startup runs migration/seed before serving; separate migrations from startup before scaling to multiple instances. See [Render FastAPI deployment](https://render.com/docs/deploy-fastapi).
3. Import the GitHub repository in Vercel, root directory `frontend`, framework Vite, build `npm run build`, output `dist`. Set `VITE_API_BASE_URL=https://YOUR-API.onrender.com/api` and deploy. `vercel.json` supplies SPA deep-link rewrites and service-worker cache headers. See [Vercel Vite guidance](https://vercel.com/docs/frameworks/frontend/vite).
4. Set Render FRONTEND_URL and CORS_ORIGINS to the actual Vercel origin and redeploy the API. Remove unneeded development origins in hosted settings.
5. Test `/api/health`, `/docs`, `/`, `/book`, and `/nutritionist` at the real URLs. Run the browser suite with E2E_BASE_URL/E2E_API_URL set to those URLs. Verify persistence after refresh, a cross-interface update, duplicate conflict and PWA manifest. Only then mark public deployment complete.

## Submission and development history

The original user brief is saved verbatim. `docs/assignment.md` records real implementation mistakes and corrections. `docs/ai-conversation.jsonl` contains exported chronological visible user/assistant/tool records from this actual session; internal model reasoning, system instructions and session metadata are excluded. The export is a snapshot through its timestamp, not a fabricated reconstruction. To refresh it, run:

```bash
python3 scripts/export-conversation.py /absolute/path/to/current-session.jsonl
```

## Known limitations and future work

- Public demo identity and dashboard deliberately have no authentication; no real patient data should be entered. Production needs identity, role access, consent, retention and abuse controls.
- One practitioner, fixed duration and coded opening hours. No holidays, staff management or configurable schedule editor.
- Synchronization uses polling/focus refetch; other tabs may take up to 15 seconds to reflect a change.
- SMS, WhatsApp, email, push delivery and video calls are not integrated. In-app reminders require the app to be open.
- Only selection is remembered locally. Offline shell can open, but no offline booking or cached availability is provided.
- Automated verification uses desktop Chrome, mobile viewport emulation and axe. Physical-device, Safari, VoiceOver and install-prompt testing remain manual.
- Completed/no-show statuses are terminal. A production correction workflow would need explicit audited reopening permissions.
- Production accounts, GitHub remote/push and live deployment remain to be configured. No public deployment is claimed.
