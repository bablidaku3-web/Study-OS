# SHUNYA — AI StudyOS

## Phase 12 — Notifications & Smart Study Reminders
- `/notifications` has All/Unread/Read notification views, read/delete controls, JEE Main/JEE Advanced/NEET UG exam scope, custom one-time/daily/weekly reminders, notification category preferences, reminder lead-time choices, sound preference and quiet hours.
- Preferences, reminders and notification history are stored in separate versioned localStorage keys. Existing study stores are read for due revisions, due flashcards, planner commitments and revision reports; source-key deduplication prevents repeated notices for the same record/date.
- Browser permission is requested only after clicking Enable browser notices. Notifications are sent only with granted permission and while the page is open. Quiet hours suppress browser alerts; in-app history remains. This app has no service worker/push backend: reminders do NOT run while the browser/page is closed.
- Existing mock-test schema has no scheduled date, so future test reminders cannot be generated. The current planner’s persisted schema may omit stable IDs or parseable dates; planner reminders work only for entries containing usable date/time fields. Daily goal notices are informational 3-hour check-ins since profile goal preferences are not yet stored.

## Validation
Run `npm run typecheck`, `npm run lint`, `npm run build`, and test browser permission, quiet hours, deduplication, recurring reminders, and storage. Node.js is unavailable in the repository editing environment; these checks and browser workflows were not executed here.

## AI API rate-limit deployment
- Both AI endpoints require `OPENAI_API_KEY` and a shared Redis-compatible REST limiter in production. Configure `RATE_LIMIT_REDIS_REST_URL`, `RATE_LIMIT_REDIS_REST_TOKEN`, and `RATE_LIMIT_HMAC_SECRET` as deployment secrets. The HMAC secret must contain at least 32 characters; generate a random value, for example with `openssl rand -hex 32`. Never commit these values.
- The hosting adapter must provide the trusted client address through Next.js `request.ip`. For a self-hosted deployment, configure the trusted reverse proxy to discard client-supplied forwarding headers and set the real client address before passing requests to Next.js. The endpoints fail closed with 503 when production rate-limit settings or a trusted client address are unavailable.
- Local development uses a process-local memory limiter only when none of the rate-limit settings are configured. It is not suitable for production or multiple application instances.
- Default limits are 5 doubt requests per minute and 40 per day; Study Coach allows 8 per minute and 60 per day, per IP and endpoint. Students sharing a public IP also share these quotas.
- JSON bodies are capped at 3,750,000 bytes for Doubt Solver (including up to 2.5 MiB images) and 65,536 bytes for Study Coach. Configure any ingress/proxy body limit at or above these values so the application can return its own validation errors.
