# Vercel frontend and Render backend

The deployment pipeline is in `.github/workflows/ci.yml`. QA runs on every push and pull request. Production deployment runs after QA on `main` when `DEPLOY_ENABLED=true`. Render and Vercel access and encrypted GitHub deployment secrets have been configured. The user selected automatically provisioned free Render PostgreSQL; no manually supplied database URI is needed.

## Initial deployment findings on 29 October 2026

| URL | Observed role | Observed problem |
| --- | --- | --- |
| https://nourish-dto7.vercel.app | React frontend | Built with the relative `/api` fallback. `/api/health` returns 404 on this frontend host. |
| https://nourish-one-ochre.vercel.app | FastAPI backend hosted on Vercel | `/api/config` works; `/api/health`, clients, appointments and dashboard summary return 503. The allowed CORS header is also missing for the frontend origin. |

The backend root and `/health` only indicate that the Python process is running. Use **`/api/health`** to check database readiness. The backend's 503 proves that the deployed API cannot complete its database operation; its exact database configuration cannot be determined without hosting settings/log access.

Those findings preceded hosting configuration. GitHub access was verified through the existing macOS Git credential. The user then supplied Render and project-scoped Vercel credentials, which were validated and stored privately; GitHub now holds encrypted deployment secrets and the necessary project variables.

## Configured hosting

| Component | Target |
| --- | --- |
| Frontend | https://nourish-dto7.vercel.app |
| Render backend | https://nourish-sfde.onrender.com |
| Render service | `nourish` / `srv-dbhecqdg1s2s739s4ho0`, free Python service in Oregon |
| Database | `nourish-db`, free Render PostgreSQL 16 in Oregon |
| Database expiration | 28 November 2026; upgrade or migrate before expiry if data must be retained |
| Vercel frontend project | `nourish-dto7`, root `frontend`, Node 22, Vite |

The existing Render service was reused. Its settings now build locked dependencies, run `bash start-render.sh`, and use `/api/health` for database-aware readiness. The database was provisioned automatically, has public database access disabled, and connects to the API over Render's internal network. The root `render.yaml` records this service and database relationship using `fromDatabase`.

Vercel's production API URL is `https://nourish-sfde.onrender.com/api`, install command is `npm ci`, build is `npm run build:vercel`, and output is `dist`. The older `nourish-one-ochre.vercel.app` backend has not been deleted.

The frontend's `vercel.json` disables direct Git deployments so the workflow controls production release after tests. Render auto-deploy is also off for the same reason. Once database provisioning finishes, enable `DEPLOY_ENABLED=true` and push/run the workflow to deploy. Check the workflow result and live readiness before claiming a successful release.

To reproduce this setup in another account, provision the Blueprint and supply frontend/project/account settings below. A free Render PostgreSQL instance expires after 30 days and has no managed backups. No paid resource is selected by this configuration. [Render free plan limits](https://render.com/docs/free).

### Render environment

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Render-generated internal PostgreSQL URI, supplied automatically through the Blueprint or the provisioning API. Never copy it to frontend variables. |
| `FRONTEND_URL` | `https://nourish-dto7.vercel.app` |
| `CORS_ORIGINS` | `https://nourish-dto7.vercel.app`, or additional exact HTTPS frontend origins separated by commas. Wildcards and URL paths are rejected. Trailing slashes are normalized. The single-variable Render API rejects an empty value. |
| `APP_TIMEZONE` | `Asia/Kolkata` |

The service's startup checks required settings, applies forward Alembic migrations, preserves existing seed records, and starts Uvicorn on Render's `$PORT`. This is suitable for the demo's single service instance. Before running multiple instances, move migrations into a separate release step.

The Render database is dedicated to fictional demo data. The project's ignored `backend/.env` still points to local PostgreSQL. No local development database was moved or reset. Do not enter cloud credentials into frontend variables.

### Vercel environment

Production `VITE_API_BASE_URL` is configured as `https://nourish-sfde.onrender.com/api`. This value is public and baked into JavaScript at build time. Changing it requires a new frontend build. The workflow also supplies it from `BACKEND_URL` to keep the release aligned with the configured Render origin.

`npm run build:vercel` fails early if the API URL is absent, relative, local, non-HTTPS, or missing `/api`. This prevents the currently observed frontend deployment mistake from recurring.

### GitHub Actions secrets and variables

Repository settings: `https://github.com/TechieRS/nourish/settings/secrets/actions` and `https://github.com/TechieRS/nourish/settings/variables/actions`. These may instead be scoped to the workflow's `production` environment.

| Kind | Name | Required value |
| --- | --- | --- |
| Secret | `RENDER_API_KEY` | Render API key with access to the existing/new API service |
| Secret | `VERCEL_TOKEN` | Vercel token scoped to the team owning the frontend project |
| Variable | `RENDER_SERVICE_ID` | API service ID beginning `srv-` |
| Variable | `BACKEND_URL` | Render HTTPS origin, with no trailing slash and no `/api` |
| Variable | `FRONTEND_URL` | `https://nourish-dto7.vercel.app` |
| Variable | `VERCEL_ORG_ID` | Actual Vercel team ID, not the team's display slug |
| Variable | `VERCEL_PROJECT_ID` | Actual frontend project ID for `nourish-dto7` |
| Repository variable | `DEPLOY_ENABLED` | `true` after database provisioning and the other settings are ready |

The database secret belongs on Render, not GitHub or Vercel. Both deployment tokens are configured as encrypted GitHub repository secrets; public project/service identifiers are repository variables. A new GitHub token is not needed for checkout or CI; Actions uses its built-in repository token.

## Automated release behavior

1. Install locked dependencies on Node 22/Python 3.13 with PostgreSQL 16.
2. Run Python static checks and dependency audits. Known moderate-or-higher npm vulnerabilities block releases. Four low-severity reports remain in the PWA build dependency chain; see the audit report.
3. Test all API operations and scheduling transactions with a dedicated test database; require at least 95% backend line coverage.
4. Run frontend unit checks, TypeScript and the production build.
5. Start isolated API and production preview servers on available ports, connected across origins, then run browser flows, axe checks, seven viewport widths, offline/PWA and read-only smoke checks. Upload evidence to GitHub Actions.
6. Deploy the exact tested SHA to Render and wait for its reported `live` status and matching commit. A failed backend deploy stops the workflow.
7. Use Vercel's pull → build → prebuilt deploy sequence from the repository root, respecting the project's `frontend` root setting.
8. Check deployed API responses, database readiness, CORS preflight, manifest, SPA deep links, loaded browser screens and accessibility, including pending API states. These live checks do not create records. Their failure fails the job; automatic rollback is not implemented.

Production deployments are serialized. Database migration failures stop startup. No database resets or destructive QA suites run against production.

## Run the same QA locally

Install dependencies once:

```bash
cd /Users/ravibhushansharma/Desktop/Assign/nourish
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
cd frontend
npm ci
cd ..
```

Use Node 22 (`nvm use` reads `.nvmrc`), then:

```bash
backend/.venv/bin/python scripts/verify.py
```

If Node 22 is not installed through nvm, run it without changing the computer's global Node installation:

```bash
npm exec --yes --package=node@22 -c 'backend/.venv/bin/python scripts/verify.py'
```

PostgreSQL must be running. With the project's local `backend/.env`, the runner creates/reuses **`nourish_verify_test`** and **`nourish_verify_e2e_test`**, clears only their application tables, and preserves `nourish`. For another environment, explicitly set different `TEST_DATABASE_URL` and `E2E_DATABASE_URL` values with database names ending `_test`. Automatic database creation is restricted to loopback hosts. Never point either variable at a database containing data you need.

The runner owns and stops its temporary servers; it does not kill other listeners. It uses installed Chrome on macOS, or Playwright Chromium in CI. If neither is installed, run `cd frontend && npx playwright install chromium`. Logs and coverage: `.local/qa/`; browser evidence: `frontend/test-results/`.

To check live URLs without creating records:

```bash
backend/.venv/bin/python scripts/smoke.py \
  --backend-url https://YOUR-API.onrender.com \
  --frontend-url https://nourish-dto7.vercel.app

cd frontend
E2E_BASE_URL=https://nourish-dto7.vercel.app npm run test:smoke
```

This remains a public fictional demo without authentication or practitioner authorization. Real patient use requires a separate identity/access-control implementation and operational review.

References: [Render free plan limits](https://render.com/docs/free), [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render deploys](https://render.com/docs/deploys), [Vercel GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [Vercel monorepos](https://vercel.com/docs/monorepos), [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
