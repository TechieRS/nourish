# Nourish implementation plan

1. Requirements and architecture: preserve the supplied brief, define contracts and assumptions.
2. Design system: warm ivory canvas, forest/sage palette, Chakra components, responsive navigation.
3. Backend: PostgreSQL schema/migration, transactional services, REST endpoints, conflict handling.
4. Client: home, guided booking, history, reschedule, cancel, confirm, calendar export, profile.
5. Nutritionist: database-backed metrics, search/filters, status changes and manual booking.
6. Integration: TanStack Query invalidation/polling, deterministic assignment seed.
7. QA: PostgreSQL integration/concurrency tests, component tests, browser workflows and viewport checks.
8. Deployment preparation: build, PWA, Vercel/Render config, environment documentation.
9. Submission: compliance checklist, accurate results and development history limitations.

## Decisions and assumptions

- Single practitioner; 30-minute fixed slots, Monday–Saturday 09:00–12:00 and 14:00–17:00, every 30 minutes. Sunday closed. Booking horizon 90 days.
- All business dates/times use APP_TIMEZONE (default Asia/Kolkata); API returns practice-local today/current time. Browser timezone never decides today.
- Active non-cancelled appointments reserve their slot regardless of status. A PostgreSQL partial unique index protects (appointment_date, start_time); database checks enforce duration and grid. No overlapping off-grid writes.
- Cancellation is a timestamp, independent of Booked/Done/No-show. Terminal statuses cannot be changed back; only future Booked appointments can confirm/reschedule/cancel. Nutritionist may set a status on any active Booked appointment (supports assignment demo).
- Client IDs are UUIDs. Public selector is a demo identity mechanism, not authentication. No real health records. New clients can be created; missing phone is supported. Entered phones must contain 7–15 digits, optional leading +; no country code is inferred.
- Historical seed is preserved exactly, including old Booked records and a Sunday record. Scheduling rules apply to new operations, not data normalization.
- Application storage is PostgreSQL only. localStorage holds only the selected demo client UUID.
- Deployment requires user-owned Supabase, Render and Vercel resources. Prepare configs now; never label an untested URL as deployed.

## API contract

JSON REST under /api. UUID IDs; ISO dates; 24-hour times; timestamps with offsets. GET /config returns timezone, practice date/time, scheduling rules. GET/POST /clients; GET/POST /appointments; GET /appointments/{id}; POST /appointments/{id}/{reschedule,cancel,confirm}; PATCH /appointments/{id}/status; GET /availability?date=YYYY-MM-DD; GET /dashboard/summary. All appointment responses include client. Mutations commit before response. 409 = occupied slot/state conflict; 422 = validation; 404 = unknown resource; 503 = database unavailable. Availability is never cached by the PWA or HTTP.
