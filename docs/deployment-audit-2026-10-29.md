# Deployment and QA audit — 29 October 2026

Scope: backend API operations, scheduling/database logic, frontend logic, core user flows, responsive UI, accessibility and Render/Vercel automation. Tests used isolated local PostgreSQL databases. Cloud inspection was read-only.

## Executed verification

| Check | Result |
| --- | --- |
| Backend PostgreSQL tests | 68 passed |
| Backend application line coverage | 98.36% (359/365 statements); route module 100% |
| Frontend unit/component tests | 24 passed |
| TypeScript and Vite production build | Passed |
| Browser workflows, axe, responsive and PWA | 12 passed locally, including the pending-API regression |
| Read-only browser deployment smoke | 1 passed locally |
| Read-only endpoint/CORS/deep-link smoke | Passed locally |
| Clean `npm ci` on Node 22 | Passed |
| Python dependency audit | No known vulnerabilities reported for the locked requirements |
| npm dependency audit | 0 moderate/high/critical; 4 low reports in one transitive PWA build chain |
| Python static checks | Ruff E4/E7/E9/F passed |
| Workflow syntax | actionlint v1.7.12 passed |
| Render Blueprint | Passed Render's official JSON schema |
| Vercel build configuration guard | Six missing/invalid/valid API URL scenarios passed |

The read-only browser smoke suite is also part of the QA runner and release workflow. Coverage is line coverage, not exhaustive state-space or branch verification.

API checks cover readiness, practice config, client listing/creation, phone/name normalization, availability, appointment listing/detail/creation, reschedule, cancellation, confirmation, status and dashboard summary. They include invalid/missing resources, date/horizon/timezone boundaries, Sunday/lunch/out-of-hours rejection, query filters and literal wildcard searches, concurrent booking, database slot constraints, atomic conflict rollback, idempotence, audit logs, sanitized failures and allowed/rejected CORS origins.

Browser checks cover existing/new/first client booking, invalid details, checkout conflicts, practitioner booking/status updates, refresh persistence, rescheduling, confirmations, cancellation dialogs and focus restoration, calendar download, readable outages and retry, PWA assets and service worker, absence of cached API responses, offline shell recovery, and absence of browser errors in the core workflow.

All five screens were checked for horizontal overflow at 320, 375, 390, 430, 768, 1024 and 1440 pixels. Automated axe WCAG A/AA scans cover 390 and 1440 pixels. Desktop and mobile screenshots were inspected for layout, typography, navigation, spacing and status clarity. This does not certify accessibility or replace Safari, physical-device and screen-reader testing.

Screenshots: [mobile home](screenshots/qa-2026-10-29/home-390.png), [desktop home](screenshots/qa-2026-10-29/home-1440.png), [mobile booking](screenshots/qa-2026-10-29/book-390.png), [desktop dashboard](screenshots/qa-2026-10-29/nutritionist-1440.png).

## Fixed during this audit

- Repaired the pre-existing uncommitted attendance-confirmation test syntax, preserving its intended comparison of timestamp instants.
- Removed ineffective hard-coded frontend origins. Configuration now validates and normalizes exact origins, including trailing slashes, and rejects wildcard/path/credential URLs.
- Fixed the first-client booking form in an empty database and indefinite appointment loading when no client exists.
- Aligned frontend name whitespace normalization with the API.
- Stopped showing “Awaiting confirmation” for completed/no-show dashboard records.
- A subsequent live-site run exposed invalid ARIA naming on the transient loading skeleton. Added its status role, a deterministic pending-API accessibility regression test, and read-only accessibility checks after every production deployment.
- Avoided sending unnecessary JSON headers on GET requests and allowed a 60-second request budget for a sleeping demo backend.
- Updated affected Router, Zod/resolver, Vitest/PWA and pytest dependencies, and added the explicit Testing Library DOM dependency required for reproducible installation.
- Added a build-time guard against publishing a Vercel frontend with a missing/relative backend URL.
- Added one-command QA, isolated database provisioning, release gating, Render startup validation, exact-commit Render deployment and read-only production checks.

The four remaining low npm reports arise from `deepmerge@4.3.1` through `@rollup/plugin-node-resolve`, `workbox-build` and `vite-plugin-pwa`. The available latest `deepmerge` release was still 4.3.1 at this check. npm's force suggestion downgrades the PWA plugin and is not an appropriate fix. These are build dependencies; their advisory is [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). CI blocks moderate-or-higher findings.

Non-failing output: the existing FastAPI TestClient emits an httpx deprecation notice; Zod emits two Rollup annotation warnings during the successful production build. No application failure was observed from these notices.

## Existing live deployment findings

`https://nourish-dto7.vercel.app/` returns the React shell, but its built JavaScript uses `/api` on the frontend origin; `/api/health` returns 404.

`https://nourish-one-ochre.vercel.app/` returns the FastAPI welcome JSON. Its `/api/config` returns 200. Database-backed health, clients, appointments and summary return 503. A config request with the frontend Origin also lacks `Access-Control-Allow-Origin`. Root success therefore does not establish a working backend.

GitHub's recent existing workflow runs were failing before this work. Local GitHub credentials provide repository admin/push access. No Actions deployment secrets or variables were found. Hosting access and the existing hosted PostgreSQL connection secret are needed to diagnose the cloud database failure and complete the requested move to Render.

No Render deployment or successful public booking is claimed. The exact connection failure requires hosting logs/settings access. [Deployment setup and required settings](deployment.md).

## Subsequent hosting configuration

After the initial audit, the user supplied working Render and Vercel access and selected automatic free Render PostgreSQL provisioning. The existing `nourish` Render service at `https://nourish-sfde.onrender.com` was found with no environment variables configured. It has been updated to use locked dependencies, the migration/start script and database-aware health checks. A dedicated free `nourish-db` PostgreSQL 16 instance was created in Oregon, with public database access disabled; it expires on 28 November 2026.

The frontend project `nourish-dto7` has been configured for Node 22, root `frontend`, and the Render API URL. GitHub has encrypted deployment tokens and the necessary project variables. This supersedes the initial lack of hosting access above. The [workflow runs](https://github.com/TechieRS/nourish/actions) and live `/api/health` establish the subsequent release result; the initial audit findings remain historical evidence.
