# SHUNYA — AI StudyOS

A calm study workspace for JEE and NEET preparation.

## Phase 5A — Mock Tests
`/tests` supports custom JEE Main, JEE Advanced, and NEET UG tests; `/tests/[id]` provides saved test-taking and calculated results. Test records and attempts remain stored in their existing test-specific keys.

## Phase 5B — Mistake Vault
`/mistakes` lets students manually record a mistake, select exam (JEE, NEET, CA, UPSC), subject, chapter/topic, category, question, answer, mistake explanation, correct approach, and review status. Filter records by exam, subject, category, status, and text; reopen/edit entries; transition between Needs Review, Revised, and Resolved. The dedicated versioned storage key is `shunya-mistake-vault-v1`, separate from existing planner, chapter, focus, test, and attempt data.

Submitted mock-test attempts are inspected for incorrect answered questions; a student may link one to a vault record. Duplicate links to the same attempt/question are blocked. The category is always student-selected—there is no AI classification or inferred thought process. Existing submitted answer records are only read, not modified.

## Honest scope and validation
Categories are manual; practice-test import, attachments, automatic AI analysis, and direct mistake entries created from the test-result page are not implemented. Browser storage is device-local. Typecheck/lint/build/browser tests could not run in the repository editing environment because Node.js is unavailable; run `npm run typecheck`, `npm run lint`, and `npm run build` in local checkout or CI.

## Run locally
```bash
npm install
npm run dev
```
