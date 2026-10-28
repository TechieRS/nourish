# What We Were Asked

Replace a nutritionist’s WhatsApp/Excel appointment workflow with a public, mobile-first wellness application. Clients must book, view, reschedule, cancel and confirm consultations. The nutritionist must manage the same PostgreSQL records, with Booked, Done and No-show statuses. Normalize the exact supplied sample data and prevent simultaneous double booking. See the unmodified [original brief](original-brief.txt).

# Our Approach

Nourish uses a warm ivory, sage and forest visual system with Chakra UI, original botanical SVG artwork and compact mobile navigation. A guided booking flow separates date, time, details and server-confirmed success. FastAPI owns scheduling rules and transactions; PostgreSQL owns slot exclusivity. TanStack Query refreshes both interfaces after writes, every 15 seconds and on focus. Attendance confirmation and practice-time reminders address no-shows without pretending external messaging is connected.

# Decisions and Assumptions

- Stack: React 18, Vite, TypeScript, Chakra UI 2, React Router 6, React Hook Form/Zod, TanStack Query, Lucide, Framer Motion, date-fns; FastAPI/Pydantic 2, SQLAlchemy 2, Alembic, psycopg and PostgreSQL 16. Chakra 2 is explicitly pinned to its compatible React 18 API.
- Duration: 30 minutes. Practice opens Monday–Saturday 09:00–12:00 and 14:00–17:00; starts are on half hours. Sunday closed; 90-day booking horizon.
- Timezone: Asia/Kolkata by default, configurable through APP_TIMEZONE. Practice-local dates/times are stored; all eligibility comparisons use the configured timezone.
- Identity: UUID client keys, a public demo selector and fictional records. Newly created profiles are supported. localStorage remembers only a selected UUID. Production needs authentication, authorization and privacy controls; these are intentionally outside the assignment.
- Normalization: Riya’s spaced/unspaced numbers both become 9820011111 and share one deterministic UUID. Dates become 2026-10-24, 2026-10-25, 2026-10-23, 2026-10-22 as appropriate. Times become 10:00, 11:30, 16:00, 09:00, 14:00. No country prefix is invented. Meera’s phone is NULL. Statuses and historical Sunday bookings are preserved exactly.
- Seed: deterministic UUIDs plus PostgreSQL INSERT ON CONFLICT DO NOTHING make reruns idempotent and preserve subsequent edits.
- Cancellation: cancelled_at is separate from the required three statuses; cancelled records are hidden from active lists and visible through the dashboard’s dedicated Cancelled filter.
- Conflict prevention: partial unique index on date/start where cancelled_at IS NULL; database checks enforce half-hour grid and duration. All active records reserve the slot. Concurrent writes result in one saved record and HTTP 409 for the loser.
- Rescheduling: row lock, update same ID, reset confirmation, commit once; rollback preserves the old slot if the new one conflicts. No duplicate appointment is created.
- Status transitions: Booked may become Done or No-show; terminal records remain historical. Practitioners can set terminal status on a future booking to demonstrate synchronization. Only future Booked records can confirm, cancel or reschedule.
- No-show prevention: persisted attendance state and timestamp, in-app timing reminders, and doctor visibility. No automated WhatsApp/SMS/email/push or video calling is claimed.

# What We Added

Calendar .ics export, installable PWA shell with NetworkOnly API behavior, optional phone support for new demo clients, audit events, a separate cancelled view, accessibility/viewport automation and real concurrency tests.

# What the AI Got Wrong

These are actual issues encountered in this session, not invented history:

1. The first calendar array expression inferred null[] before concatenating Date[]. TypeScript rejected it. Replaced it with an explicitly typed (Date | null)[] spread array; production type checking then passed.
2. A file-writing command used workspace-relative test paths while its working directory was already backend/. The shell reported missing directories and pytest ran zero tests. Recreated those files from the correct root; no test pass was claimed for that attempt.
3. A test compared a SQLAlchemy Date column against a Python string. PostgreSQL/psycopg correctly rejected date < varchar. Changed the test to datetime.date(2026, 10, 28). The full backend suite then passed.
4. Testing Library did not automatically clean up between tests because Vitest globals were not enabled. Cancellation tests saw elements from previous renders. Added explicit afterEach(cleanup); all 24 component/validation/filter tests passed.
5. The first browser run discovered a real booking defect: React reused the step button while switching it from Continue to a native form submit button. Advancing the step could also submit the existing client’s form. Changed final submission to an explicit type=button handler with form validation. The failing browser tests are retained in the actual conversation export; later verification results are in qa-results.md.
6. A screenshot taken immediately after resizing Chrome showed repeated compositor tiles. DOM inspection found one header and correct mobile navigation. A fresh mobile viewport and settled render produced the correct screenshot; this was a capture artifact, not duplicated application markup.

7. Browser assertions initially matched both a client selector option and the dashboard client name; scoped the assertion to main. A calendar helper also clicked ahead before reschedule loading finished; it now waits for the calendar screen. Both workflow tests then passed.
8. Accessibility checks found the supplied primary sage color had only 4.46:1 contrast on ivory for small text, and the profile avatar’s visible initials were absent from its accessible label. Kept the brand color for graphical use, used the darker sage token for small text and included initials in the label. All ten audited screen/viewport combinations then passed.
9. A later type check caught Playwright-style exact options mistakenly used in Testing Library role queries. Removed the unsupported options; the full type check and component suite passed.

# How to Run It

Exact PostgreSQL, backend and frontend commands are in [README](../README.md). Use separate terminal processes for API and frontend. Backend tests require an explicitly selected database ending in _test and truncate only that test database. Browser tests create fictional review records; use a dedicated demo database.
