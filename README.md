# SHUNYA — AI StudyOS

## Phase 8 — AI Doubt Solver
- `/doubts` provides exam/subject/chapter/topic context, five learning modes, typed questions and validated JPEG/PNG/WebP image upload (2.5 MB cap), successful-response history, and actions to add a doubt to the Mistake Vault or create a chapter revision schedule.
- `/api/doubt` calls the OpenAI Chat Completions API from the server only. `OPENAI_API_KEY` is never sent to client code; `OPENAI_MODEL` optionally selects a model (default `gpt-4o-mini`). Without the key, the route returns an explicit setup error; it never substitutes static/sample answers.
- Successful answers are stored separately under `shunya-doubt-history-v1`. Uploaded image bytes are request-only and not retained in history. Mistake and revision conversion writes only to their existing repositories.

## AI setup
Set these server-side environment variables (for example in `.env.local`, which must not be committed):

```env
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-4o-mini
```

Restart the Next.js server after setting the key. Image questions require a configured vision-capable model. Provider errors are surfaced in the page.

## Previous Phases and checks
Existing planner, chapters, focus sessions, tests/attempts, mistakes, revisions and performance data use their independent existing storage. No history is fabricated. Run `npm run typecheck`, `npm run lint`, `npm run build` and test in a browser before deployment. This GitHub editing environment has no Node.js runtime, so those checks were not run here.
