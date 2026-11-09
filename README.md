# SHUNYA — AI StudyOS

## Phase 12 — Notifications & Smart Study Reminders
- `/notifications` has All/Unread/Read notification views, read/delete controls, JEE Main/JEE Advanced/NEET UG exam scope, custom one-time/daily/weekly reminders, notification category preferences, reminder lead-time choices, sound preference and quiet hours.
- Preferences, reminders and notification history are stored in separate versioned localStorage keys. Existing study stores are read for due revisions, due flashcards, planner commitments and revision reports; source-key deduplication prevents repeated notices for the same record/date.
- Browser permission is requested only after clicking Enable browser notices. Notifications are sent only with granted permission and while the page is open. Quiet hours suppress browser alerts; in-app history remains. This app has no service worker/push backend: reminders do NOT run while the browser/page is closed.
- Existing mock-test schema has no scheduled date, so future test reminders cannot be generated. The current planner’s persisted schema may omit stable IDs or parseable dates; planner reminders work only for entries containing usable date/time fields. Daily goal notices are informational 3-hour check-ins since profile goal preferences are not yet stored.

## Validation
Run `npm run typecheck`, `npm run lint`, `npm run build`, and test browser permission, quiet hours, deduplication, recurring reminders, and storage. Node.js is unavailable in the repository editing environment; these checks and browser workflows were not executed here.
