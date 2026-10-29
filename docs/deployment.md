# Vercel frontend and Render backend

The tested deployment pipeline is in `.github/workflows/ci.yml`. QA runs on every push and pull request. Deployment runs after QA on `main` once the repository variable `DEPLOY_ENABLED` is `true`. The production hosting operations still require account access and secrets; local tests do not prove a live deployment.

## Existing deployments checked on 29 October 2026

| URL | Observed role | Observed problem |
| --- | --- | --- |
| https://nourish-dto7.vercel.app | React frontend | Built with the relative `/api` fallback. `/api/health` returns 404 on this frontend host. |
| https://nourish-one-ochre.vercel.app | FastAPI backend hosted on Vercel | `/api/config` works; `/api/health`, clients, appointments and dashboard summary return 503. The allowed CORS header is also missing for the frontend origin. |

The backend root and `/health` only indicate that the Python process is running. Use **`/api/health`** to check database readiness. The backend's 503 proves that the deployed API cannot complete its database operation; its exact database configuration cannot be determined without hosting settings/log access.

GitHub access to `TechieRS/nourish` was verified through the existing macOS Git credential. No Actions secrets or variables were configured at inspection. No Render/Vercel CLI login or deployment token was found in the project's environment or standard CLI configuration locations. The connected integrations for those accounts are not yet available.

## One-time hosting setup

1. Connect the Render and Vercel accounts, or securely provide deployment tokens through their integrations/local login. Keep passwords and tokens out of chat, source files and `VITE_` values.
2. In Render, create a Blueprint from `TechieRS/nourish` using the root `render.yaml`. It defines a free Python service named `nourish-api`, root `backend`, Python 3.13, locked dependencies, `bash start-render.sh` and readiness at `/api/health`. For an existing service, apply these settings to that service rather than creating a duplicate. No paid resource is needed by this configuration.
3. Configure the Render environment below. The user selected an **existing hosted PostgreSQL** database. No cloud database is provisioned by this Blueprint.
4. Keep/reuse the Vercel **frontend** project `nourish-dto7` in the `ravis-projects-ad3c2dff` team. Its root directory must be **`frontend`**, framework Vite, Node 22, install `npm ci`, build `npm run build:vercel`, output `dist`. The similarly named `nourish` project currently serves the backend and is not the frontend target.
5. Add the GitHub Actions settings listed below, then set `DEPLOY_ENABLED=true`. Run the workflow manually on `main`, or push a change to `main`.
6. After the new Render backend and Vercel frontend pass the live smoke checks, the old Vercel backend can be retired separately. It has not been deleted by this work.

The frontend's `vercel.json` disables direct Git deployments so the workflow controls production release after tests. Render auto-deploy is also off for the same reason. Until credentials and `DEPLOY_ENABLED` are configured, pushes run QA without releasing. The first Render Blueprint creation may still perform an initial deployment.

### Render environment

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Secret PostgreSQL connection URI for the existing demo database. For Supabase, use its Session pooler URI, the exact generated username/host/password and `sslmode=require`. URL-encode reserved password characters. |
| `FRONTEND_URL` | `https://nourish-dto7.vercel.app` |
| `CORS_ORIGINS` | Empty, or additional exact HTTPS frontend origins separated by commas. Wildcards and URL paths are rejected. Trailing slashes are normalized. |
| `APP_TIMEZONE` | `Asia/Kolkata` |

The service's startup checks required settings, applies forward Alembic migrations, preserves existing seed records, and starts Uvicorn on Render's `$PORT`. This is suitable for the demo's single service instance. Before running multiple instances, move migrations into a separate release step.

Use a PostgreSQL database dedicated to fictional demo data. The existing cloud connection secret is still required; the project's ignored `backend/.env` points only to local PostgreSQL. Do not enter cloud credentials into frontend variables.

### Vercel environment

Set **Production** `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`. This value is public and baked into JavaScript at build time. Changing it requires a new frontend build. The workflow also supplies it from `BACKEND_URL` to keep the release aligned with the configured Render origin.

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
| Repository variable | `DEPLOY_ENABLED` | `true` after the other settings are ready |

The database secret belongs on Render, not GitHub or Vercel. A new GitHub token is not needed for checkout or CI; Actions uses its built-in repository token.

## Automated release behavior

1. Install locked dependencies on Node 22/Python 3.13 with PostgreSQL 16.
2. Run Python static checks and dependency audits. Known moderate-or-higher npm vulnerabilities block releases. Four low-severity reports remain in the PWA build dependency chain; see the audit report.
3. Test all API operations and scheduling transactions with a dedicated test database; require at least 95% backend line coverage.
4. Run frontend unit checks, TypeScript and the production build.
5. Start isolated API and production preview servers on available ports, connected across origins, then run browser flows, axe checks, seven viewport widths, offline/PWA and read-only smoke checks. Upload evidence to GitHub Actions.
6. Deploy the exact tested SHA to Render and wait for its reported `live` status and matching commit. A failed backend deploy stops the workflow.
7. Use Vercel's pull → build → prebuilt deploy sequence from the repository root, respecting the project's `frontend` root setting.
8. Check deployed API responses, database readiness, CORS preflight, manifest, SPA deep links and loaded browser screens. These live checks do not create records. Their failure fails the job; automatic rollback is not implemented.

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

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render deploys](https://render.com/docs/deploys), [Vercel GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [Vercel monorepos](https://vercel.com/docs/monorepos), [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
