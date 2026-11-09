# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 4C — Advanced Focus Analytics

- `/focus/analytics` derives its dashboard, charts and insights from unique records in the existing `shunya-focus-sessions-v1` repository.
- Timer modes from Phase 4A/4B are validated by the storage layer. Zero-focus break sessions remain in completion/interruption counts and history but add no study seconds. Time totals use only positive `focusedSeconds` recorded by timers (active time, excluding pause and break periods).
- Displays today/week/month focus, average per day with recorded focus, completed/interrupted counts and completion rate; subject pie and distribution; chapter/topic/activity distributions; daily/weekly/monthly trends; productive day and week comparison; syllabus chapters without a saved focus record.
- `/focus/history` supports date, subject, activity, and text filters and exports visible records to CSV.
- Missing subject/topic/chapter information is not fabricated. Unspecified values remain explicit.

“Neglected chapter” currently means a chapter in the saved syllabus without a focus record. Mastery or weak performance cannot be inferred from time spent. Poor test-performance comparisons remain unavailable until test attempt data is implemented. “Least studied subject” means lowest focus among the four configured subjects; “least recorded topic” only ranks topics that have recorded focus.

## Earlier phases
- Phase 1: Next.js dashboard foundation.
- Phase 2: Flexible planner persisted separately under `shunya-planner-v1`.
- Phase 3: Chapter management persisted separately under `shunya-chapters-v1`.
- Phase 4A/4B: Focus timers use the separate `shunya-focus-sessions-v1` repository.

## Run and validate

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

This repository editing environment does not provide a Node.js runtime, so the commands and browser/runtime tests could not be executed here. Please run them in local checkout or CI before deployment.
