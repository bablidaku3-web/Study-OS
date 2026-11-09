# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 1 — project foundation and dashboard
Next.js App Router, TypeScript, Tailwind foundations and responsive shell.

## Phase 2 — Smart Day Planner
Editable sessions, daily goals, checklist, To-do list, weekly calendar and productivity summary persist in the existing `shunya-planner-v1` browser localStorage key.

## Phase 3 — Chapter Management foundation
Visit `/chapters` for subject-wise chapter lists with manually assigned zones. Chapter data uses a separate `ChapterRepository` and the `shunya-chapters-v1` key.

## Phase 4 — Focus timers (initial scope)
Visit `/focus` for customizable Pomodoro work/break and custom focus countdown timers. Choose a subject, chapter, optional topic, and activity before starting. Timers use wall-clock elapsed time while running, accumulate only active time across pauses, save completed focus blocks and save active runs as interrupted when leaving the page. Pomodoro break time is excluded. Session records are stored through a separate `FocusSessionRepository` under `shunya-focus-sessions-v1`; planner and chapter data are not rewritten.

Stopwatch, standalone countdown, interval/revision/break modes, focus analytics/charts and detailed history filters are not included in this initial Phase 4 increment.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

The repository-editing environment does not provide a Node.js runtime, so these checks could not be run here. Please run them in local checkout or CI.

## Stack
- Next.js App Router, React, TypeScript
- Tailwind CSS foundation and responsive custom styling
- Lucide icons
