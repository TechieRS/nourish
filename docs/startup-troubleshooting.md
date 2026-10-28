# macOS startup troubleshooting and actual verification

## Cause of ENOENT

The active workspace was `/Users/ravibhushansharma/Desktop/Assign`, outside the frontend package. `npm prefix` from that directory returned `/Users/ravibhushansharma/Desktop`. Desktop has an existing `node_modules` directory, so npm discovered it while searching ancestors for a package root. Desktop has no `package.json`; consequently npm attempted `/Users/ravibhushansharma/Desktop/package.json` and failed. The actual package is `nourish/frontend/package.json`.

No project/ancestor/user `.npmrc` prefix override or `npm_config_*` environment override was found. The global prefix points to the normal Node v22.19.0 nvm installation. Changing global npm settings or creating a Desktop package would not address the project-directory mistake.

## Changes

- Added executable `start-dev.sh` in the project root; it uses its own absolute location rather than the caller’s working directory.
- Checks dependencies, takes an atomic launcher lock, refuses busy app ports, reads the existing backend settings safely and starts the configured existing PostgreSQL cluster only when needed.
- Uses the existing Python virtual environment, applies forward-only Alembic migrations, starts reload-enabled FastAPI on 127.0.0.1:8000 and installed Vite directly on localhost:5173 with strict port selection. Direct Vite execution also gives the launcher ownership of the actual server PID, without an npm wrapper/ancestor lookup.
- Checks the frontend, backend database health and Vite API proxy before reporting readiness. Logs are kept in ignored `.local/dev/`.
- Cleanup targets only stored child PIDs and the project PostgreSQL instance if this launcher started it. It does not use killall/pkill or kill by port. Pre-existing PostgreSQL connections are left running. No database initialization, seed, reset or deletion occurs.
- Added README instructions. No UI, API architecture, environment file or global npm configuration change was necessary.

## Results from this startup session

- Node v22.19.0; npm 10.9.3.
- Frontend dependency tree: installed and complete (`npm ls --depth=0`).
- Python virtual environment: present; required imports succeed; `pip check` reports no broken requirements.
- Existing PostgreSQL cluster started successfully on **127.0.0.1:55439**; SELECT 1 succeeds.
- Alembic revision **0001** already applied. `upgrade head` completed without pending changes.
- All five assignment samples were found with statuses Booked, Booked, Booked, Done, No-show.
- FastAPI and Vite startup readiness checks passed.
- Frontend `/`, API `/docs`, direct `/api/health`, proxied `/api/health` and CORS preflight all returned HTTP 200.
- **3 Chrome tests passed (17.4 seconds)**: complete booking/dashboard/status/reschedule/conflict/attendance/cancellation/refresh workflow; all five screens at seven required widths; automated WCAG checks on five screens at mobile and desktop widths.
- Original sample payloads were compared before/after browser testing and matched exactly. No existing database data was deleted, reset or overwritten. One new fictional browser-verification client and two appointment records were retained, so current totals are five clients and seven appointments.
- A second launcher correctly exited with a lock error without stopping the running app.
- `bash -n start-dev.sh` succeeds and the executable bit is set.

## Actual launcher corrections during validation

The first macOS Bash run interpreted a Unicode ellipsis immediately following an unbraced variable as part of its variable name. Status messages were changed to ASCII. That edit briefly introduced an unescaped apostrophe in a single-quoted message; it was corrected and syntax validation rerun before the successful launch. These issues affected the launcher, not application code or existing database data.

## Shutdown verification limit

Cleanup is implemented and syntax-checked. Automatic approval review rejected the deliberate Ctrl+C test because interrupting the active launcher would conflict with the explicit request to keep the development servers running. That rejection was respected: no alternative kill command or indirect shutdown was attempted. Servers were left running. Live interruption/cleanup and the pre-existing-database ownership branch were not deliberately exercised during final validation.

## Next start

```bash
cd /Users/ravibhushansharma/Desktop/Assign/nourish
./start-dev.sh
```

Do not start a second launcher while the current one is serving the application. In your own launcher terminal, Ctrl+C requests cleanup. The root backend URL is an API base; use `/docs` or `/api/health` for a human-readable check.

App: http://localhost:5173

Dashboard: http://localhost:5173/nutritionist

API docs: http://127.0.0.1:8000/docs

No deployment or GitHub push was performed.
