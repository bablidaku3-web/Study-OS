# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Existing phases
- **Phase 1:** Next.js App Router dashboard shell.
- **Phase 2:** Editable planner, goals, checklist, To-do list, weekly calendar; stored separately in `shunya-planner-v1`.
- **Phase 3:** Chapter lists and manually assigned zones; `ChapterRepository` uses `shunya-chapters-v1`.
- **Phase 4A/4B:** Pomodoro, custom focus, stopwatch, countdown, break timers, study intervals, and revision timer.

## Phase 4C — Focus Analytics
- `/focus/analytics` calculates daily, current-week and month-to-date focus from the persisted focus-session repository. Only positive `focusedSeconds` are included, duplicate IDs are discarded, and the standalone break modes (saved with zero focus) are excluded.
- Subject, chapter, topic, and activity distributions; completion and interruption counts/rate; daily, weekly, and monthly bars; most/least observed study categories; productive weekday and week-on-week comparison.
- `/focus/history` provides date, subject, activity, and text filters plus CSV export.
- Analytics reads the existing `shunya-focus-sessions-v1` store. It does not write or migrate planner/chapter data. Missing chapter/topic values are grouped/displayed as unspecified.
- Test-performance comparisons are not available until test-attempt data is implemented. A chapter/topic with zero recorded sessions cannot be inferred as neglected from session records alone.

## Run locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

This repository editing environment does not provide Node.js, so those commands and runtime/browser tests could not be run here. Please run in local checkout or CI before deployment.
