# SHUNYA — AI StudyOS

A calm JEE & NEET preparation workspace. Phase 11 introduces personal progress reports at `/reports`.

## Phase 11 — Progress Reports & Export
- Exam selector supports JEE Main, JEE Advanced and NEET UG; report ranges are 7/30/90 days or user-selected dates.
- Date-bounded data includes unique positive focused timer sessions, unique submitted mock attempts and question-level chapter accuracy, completed revision events, actual flashcard review ratings, and existing mistake records.
- Charts show daily focus consistency, mock score percentages, subject focus, chapter accuracy, daily revision activity and flashcard review activity. Empty states say when records are missing.
- Weekly section lists chapters meeting real-data strong/attention thresholds, pending revisions and three practical goals. No sample results are created.
- CSV exports: row-level study history, mock test results, revision history and chapter progress. PDF uses browser print dialog; select “Save as PDF”.

Existing localStorage stores remain unchanged; this phase reads repositories without introducing or migrating data. Chapter-zone change history is not available in the existing data model, and exported Chapter Progress is performance as of now (using selected-period attempts), not a dated zone-history file. Data remains browser/device local.

## Validation
Run `npm run typecheck`, `npm run lint`, `npm run build`, and verify CSV downloads and Print/Save as PDF locally. The repository editing environment does not have a Node.js runtime, so build/tests and actual PDF/CSV browser downloads were not executed here.
