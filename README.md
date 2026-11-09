# SHUNYA — AI StudyOS

A calm JEE/NEET and broader exam-preparation workspace.

## Phase 6 — Smart Revision
- `/revision` provides due today, upcoming, overdue, and completed schedule views; revision completion notes/duration; reschedule and skip logging; per-chapter history; weekly completed revision activity; and revision counts/rate.
- Schedules persist in a separate `shunya-revision-schedules-v1` localStorage repository. Default intervals are 1, 3, 7, 14, and 30 days; users can enter strictly ascending custom day intervals. Date keys are local calendar dates, avoiding UTC date drift.
- Duplicate active schedules for the same exam, subject, and chapter are rejected. Schedule suggestions use actual unresolved Mistake Vault entries and saved Yellow/Red chapter zones; they do not invent performance data. Suggestions map existing science chapters to JEE/NEET and allow JEE, NEET, CA, or UPSC schedules.
- CA/UPSC users can enter their own subject/chapter text. Chapter zone integration only uses the existing Physics/Chemistry/Mathematics/Biology syllabus.

## Existing data
Planner, chapters, focus sessions, tests, attempts and mistakes retain their separate existing localStorage keys. Revision does not modify them.

## Validation
Run `npm run typecheck`, `npm run lint`, `npm run build` and test browser workflows in a local checkout. This editing environment does not provide Node.js, so these checks could not be executed here. Revision history and schedules are device-local, not account-synced.
