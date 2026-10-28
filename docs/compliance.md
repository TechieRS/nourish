# Assignment acceptance checklist

The boxes below distinguish implemented/local verification from external work still required. See qa-results.md for actual test outcomes.

- [x] Client home screen, personalized greeting and backend-derived upcoming preview.
- [x] Guided client booking with validation and saved booking reference.
- [x] Available slots fetched from the backend; no mocked booking operations.
- [x] Backend/database double-booking protection, including concurrent requests.
- [x] Upcoming and past consultation lists scoped to stable client UUID.
- [x] Atomic rescheduling of eligible bookings, preserving old slot on failure.
- [x] Soft cancellation, confirmation dialog and released availability.
- [x] Nutritionist list, client phone display and public demo notice.
- [x] Persistent Booked / Done / No-show status management.
- [x] Nutritionist manual appointment creation using the same booking rules.
- [x] Today, status, cancelled and name/phone search filters.
- [x] Shared PostgreSQL data with invalidation, 15-second polling and focus refetch.
- [x] Persisted attendance confirmation and confirmed_at timestamp.
- [x] Exact five assignment records, four normalized fictional clients.
- [x] ISO dates, 24-hour times, preserved meaningful phone digits and Meera NULL phone.
- [x] Historical Booked statuses preserved, seed idempotence verified.
- [x] Mobile layouts at 320 / 375 / 390 / 430 / 768px without horizontal overflow.
- [x] Desktop layouts at 1024 / 1440px without horizontal overflow.
- [x] Public no-login demo selector and support for newly created clients.
- [x] Refresh persistence verified through the real API and browser.
- [x] Production TypeScript/Vite build succeeds; PWA manifest/icons/service worker generated.
- [x] README, local setup and deployment instructions.
- [x] Assignment documentation draft and authentic mistake log.
- [x] Genuine visible AI conversation snapshot exported; refresh script included.
- [x] Vercel frontend and Render backend configurations; Supabase connection instructions.
- [ ] GitHub repository remote created/pushed (account/repository not supplied).
- [ ] Supabase/Render/Vercel resources configured with real environment variables.
- [ ] Public deployment and public URL tested.

## Additional verification and limits

Backend tests use real PostgreSQL 16; browser tests use real API operations and installed Chrome, including new-client and practitioner booking. Automated accessibility checks are not equivalent to physical-device and assistive-technology certification. Deployment readiness is not live deployment.

## Phase status

| Phase | Deliverable | State |
| --- | --- | --- |
| 1 | Requirements, assumptions, schema/API plan | Complete |
| 2 | Chakra design system and responsive shell | Complete |
| 3 | FastAPI/PostgreSQL/migrations/conflict protection | Complete |
| 4 | Client flows and calendar export | Complete |
| 5 | Nutritionist dashboard | Complete |
| 6 | Shared queries and exact seed | Complete |
| 7 | Automated local QA | Complete: 14 backend, 24 frontend, 6 production browser tests passed |
| 8 | Build and deployment preparation | Prepared; external deployment pending |
| 9 | Submission documentation/history/checklist | Prepared; transcript is a timestamped snapshot |
