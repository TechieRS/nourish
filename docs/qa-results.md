> Latest deployment audit: [29 October 2026](deployment-audit-2026-10-29.md). The historical results below predate the new audit and expanded suite.

# Actual verification results

Executed locally on 28 October 2026 (Asia/Kolkata). No public hosting URL was available.

| Check | Actual result |
| --- | --- |
| Alembic upgrade on fresh PostgreSQL 16 database | Passed |
| Assignment seed executed twice | Passed; four clients and five appointments |
| Backend integration suite | **14 passed**, 0 failures; final run 0.34 seconds |
| Frontend Vitest suite | **24 passed**, 0 failures across 3 files; final run 1.97 seconds |
| TypeScript + Vite production build | Passed; PWA assets and split bundles generated |
| Playwright against compiled production app on port 5174 | **6 passed**, 0 failures; 17.8 seconds |
| API cache safety | Production worker registered; no /api responses in Cache Storage |
| Automated WCAG A/AA checks | No axe violations across 5 screens at 390 and 1440px |
| Responsive overflow check | All 5 screens passed at 320, 375, 390, 430, 768, 1024 and 1440px |
| Manual screenshot review | Desktop and mobile home inspected; original immediate-resize capture artifact replaced |
| Public deployment | **Not performed**; Supabase/Render/Vercel resources and credentials not supplied |
| GitHub Actions | Workflow prepared; not executed on GitHub |

## Backend coverage

Successful persisted booking; duplicate HTTP 409; two simultaneous requests producing exactly one 201 and one 409; successful reschedule with same ID, old slot release and confirmation reset; failed reschedule preserving original appointment; soft cancellation and released availability; terminal status rules; persisted/idempotent attendance confirmation; NULL phone; exact sample normalization and seed idempotence; invalid/past/off-grid/Sunday/horizon requests; unknown IDs; today/search/status filters; database grid CHECK constraint bypass protection; audit creation.

Final command (isolated local test database):

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://nourish@127.0.0.1:55439/nourish_test .venv/bin/python -m pytest -q
```

## Frontend coverage

Form name/phone validation; international/local phone formats; missing phone; all three status badges; appointment details and reschedule destination; cancellation dialog keep/cancel behavior; attendance mutation; terminal-record controls; disabled dates and month navigation; backend-only slot list and selection; empty availability; dashboard date/status/name/phone/cancelled filtering.

```bash
cd frontend
npm test
npm run build
```

## Production browser coverage

1. Open home, select a new fictional client and book through the UI.
2. Verify the practitioner dashboard sees that exact record.
3. Mark Done and verify the client view and browser refresh preserve the status.
4. Book a separate eligible record, reschedule through the UI, verify old slot availability and reject a direct duplicate request with HTTP 409.
5. Confirm attendance, test Keep appointment, then confirm cancellation and verify slot release.
6. Check every required viewport and screen for horizontal overflow.
7. Validate and create a new client from the booking form, preserving NULL phone.
8. Create an appointment from the nutritionist flow and verify it in the selected client interface.
9. Check mobile/desktop WCAG tags using axe.
10. Verify production manifest/icons, active service worker and absence of cached API responses.

```bash
cd frontend
E2E_BASE_URL=http://127.0.0.1:5174 EXPECT_PWA=true \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npm run test:e2e
```

After verification, generated browser fixtures (including the identified early accidental-submission record) were removed. The development database again contains exactly four clients and five sample appointments.

The production preview used Vite’s API proxy to the same local FastAPI/PostgreSQL service. This verifies the compiled application locally, not external CORS/network/hosting setup. The dev-server workflow was also exercised during debugging.

## Actual failures and corrections

Early failing checks were corrected, not hidden: calendar array typing, a test file path mistake, a Date-versus-string SQL test comparison, missing component-test cleanup, an accidental booking submission on step change, ambiguous browser selectors and a calendar-test loading race. Accessibility found small sage text below 4.5:1 and a visible-initials/accessible-name mismatch; text uses a darker token and the accessible name now contains the visible initials. See [assignment development log](assignment.md) and the genuine conversation export.

## Warnings and verification limits

- FastAPI/Starlette emits a deprecation warning for its current httpx TestClient integration. All requests/tests pass; future dependency maintenance should migrate when appropriate.
- React Router 6 emits future-flag notices in component tests. They are upgrade notices, not failed assertions.
- Playwright emits an environment NO_COLOR/FORCE_COLOR warning, without affecting results.
- Original single-bundle size warning was resolved by splitting UI, React and data dependencies; final build has no bundle warning.
- No full screen-reader audit, physical-device/Safari test, externally hosted PWA install test or public deployment was performed.
