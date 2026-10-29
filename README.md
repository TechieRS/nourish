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

React 18 / Vite / TypeScript / Chakra UI 2 / React Router 7 / React Hook Form / Zod 4 / TanStack Query / Lucide / Framer Motion / date-fns. Python 3.13 / FastAPI / Pydantic 2 / SQLAlchemy 2 / Alembic / psycopg / PostgreSQL 16. Deployment target: Vercel + Render + Supabase PostgreSQL.

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

The frontend belongs on **Vercel** and the API on **Render**, using the existing hosted PostgreSQL database. See [the deployment guide](docs/deployment.md) for the exact account settings, secret names, release workflow and one-command QA runner. [The 29 October audit](docs/deployment-audit-2026-10-29.md) records the checks and fixes.

The existing Vercel frontend at `https://nourish-dto7.vercel.app` loads its shell but was built with a relative `/api` URL that returns 404. `https://nourish-one-ochre.vercel.app` is the API currently hosted on Vercel; its database readiness endpoint returns 503. A working Render deployment has not yet been verified.

GitHub Actions now tests isolated PostgreSQL, frontend logic, the production build, browser flows, accessibility, responsive screens and PWA behavior. Once Render/Vercel credentials and project settings are configured, setting `DEPLOY_ENABLED=true` enables backend-first deployment of tested `main` commits followed by live smoke checks. Direct host Git auto-deploys are disabled in the deployment configuration so the workflow controls release.

Local QA with the existing virtual environment and PostgreSQL running:

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm exec --yes --package=node@22 -c 'backend/.venv/bin/python scripts/verify.py'
```

The runner creates/reuses dedicated local test databases; their application tables are cleared. It preserves the configured `nourish` development database and stops its temporary servers. See the guide for clean setup and explicit test database URLs.

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
- GitHub access and the existing remote are verified. Render/Vercel deployment access, hosted database settings and the final live deployment remain to be configured.
