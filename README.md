# SHUNYA — AI StudyOS

## Phase 9 — AI Study Coach (JEE/NEET only)
- `/study-coach` combines actual submitted JEE Main/JEE Advanced/NEET test results, chapter zones, Mistake Vault, revision schedules/events, focused timer records and saved planner commitments. The exam selector is limited to those three exam targets. Biology appears as the existing aggregate biology subject; botany/zoology-level data is not present in the current syllabus store.
- Rule-based recommendations display their reason and real data evidence. Students may accept, dismiss or mark them complete; decisions are separately persisted under `shunya-study-coach-decisions-v1`. Weekly report uses actual local-week focus, subject distribution, submitted results, revision events and three data-derived practical goals.
- The AI chat posts the current JEE/NEET snapshot to `/api/study-coach`, which uses the existing server-side OpenAI environment (`OPENAI_API_KEY`, optional `OPENAI_MODEL`). No frontend key or fallback/fake AI response. Provider-absent and provider-error states are surfaced with retry.
- Existing CA/UPSC features/routes and all existing data stores are untouched; they are not options in the Phase 9 coach.

## Notes and validation
Planner integration reads existing `shunya-planner-v1` opportunistically and does not alter it. The chapter store retains only current zones, not a historical zone-change log; weekly reports explicitly disclose this limitation. Run `npm run typecheck`, `npm run lint`, `npm run build`, and browser checks locally. This repository editor has no Node.js runtime, so those checks were not run here.
