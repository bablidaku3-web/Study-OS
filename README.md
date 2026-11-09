# SHUNYA — AI StudyOS

A calm study workspace for JEE and NEET preparation.

## Phase 5A — Mock Test System
- `/tests` creates and lists custom JEE Main, JEE Advanced and NEET UG tests with subject/chapter/topic, question types, answer choices, per-question positive/negative marks, duration and explanations.
- `/tests/[id]` provides exam-like navigation, autosaved answers, review markers, countdown and auto-submit, manual submit confirmation, and calculated result breakdowns.
- Tests and attempts persist separately under `shunya-tests-v1` and `shunya-test-attempts-v1`; existing planner, chapter and focus keys are unchanged. Submission is idempotent and persisted attempts cannot be resubmitted.
- Results include marks, correct/incorrect/unattempted counts, accuracy, subject/chapter scores and time per question.

## Previous phases
Phase 1 dashboard; Phase 2 planner (`shunya-planner-v1`); Phase 3 chapters (`shunya-chapters-v1`); Phase 4 timers and analytics (`shunya-focus-sessions-v1`).

## Run and validate
```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```
The repository editing environment does not provide Node.js, so these checks and browser timer tests could not be executed here. Please run in local checkout or CI before deployment.
