# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 1 — Dashboard foundation
Next.js App Router, TypeScript, Tailwind foundation and responsive dashboard.

## Phase 2 — Smart Day Planner
Editable sessions, daily goals, checklist, To-do list, weekly calendar and productivity summary persist under `shunya-planner-v1`.

## Phase 3 — Chapter Management foundation
Visit `/chapters` for subject-wise chapter lists and manually assigned zones. Uses separate `ChapterRepository` storage at `shunya-chapters-v1`.

## Phase 4 — Focus timers
- `/focus`: Pomodoro and custom focus timers.
- `/focus/tools`: Stopwatch, countdown, short break, long break, custom study intervals and revision timer.
- Focus records persist through `FocusSessionRepository` at `shunya-focus-sessions-v1`.
- Active stopwatch/focus time is timestamp-based. Paused time is excluded. Interval break periods and standalone break timers contribute zero focused seconds. Completion and explicit interruption save records; active page exit attempts to persist an interrupted record without replacing malformed stored history.
- Study modes can be connected to subject, chapter, topic, and activity. Break modes save a zero-focus session.

The repository editing environment does not provide a Node.js runtime, so `npm run typecheck`, `npm run lint`, and `npm run build` have not been executed here. Run these commands in a local checkout or CI.

## Run locally

```bash
npm install
npm run dev
```
