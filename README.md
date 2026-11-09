# SHUNYA — AI StudyOS

## Phase 7 — Smart Performance Analysis & Auto Chapter Zone Suggestions

`/performance` analyzes submitted test attempts, saved Mistake Vault records, existing chapter zones, and revision history. It shows exam-filtered subject/chapter accuracy, submitted test score trends, recent chapter accuracy changes, repeated unresolved mistake categories, and revision-before/after comparisons when sufficient question-level data exists.

Zone suggestions require at least 5 answered questions per chapter, except a Red suggestion may be surfaced with at least 3 unresolved Mistake Vault entries while clearly stating that test evidence is insufficient. Green requires at least 80% overall accuracy and at least 70% recent accuracy when available with fewer than 2 unresolved mistakes. Red thresholds are <=45% accuracy, 3+ unresolved mistakes, or recent accuracy below 40%; other evidence suggests Yellow. These are transparent heuristics, not mastery claims. Suggestions only draw from actual submitted tests and actual vault entries. Existing assigned zones are protected from automatic writes; accepting applies only when zone is unassigned. Manual override is available and saved through the existing chapter repository.

Revision comparisons require at least 5 answered chapter questions before and after the first completed revision. Results are labeled observational, not causal. Test/mock data supports JEE Main, JEE Advanced and NEET UG. CA/UPSC currently have no test-taking/question result source in Phase 5A, so performance analytics for those exams are unavailable unless matching question-level results are added.

Existing localStorage data is retained. The only new key is `shunya-zone-suggestion-decisions-v1`; original chapter/test/attempt/mistake/revision keys are not migrated or rewritten except user-confirmed chapter-zone changes.

## Validation

The editing environment has no Node.js runtime. `npm run typecheck`, `npm run lint`, `npm run build`, and browser checks were not run here. Run them in local checkout or CI. The Phase 6 page calls `testRepository.listAttempts()`, which was absent when inspected; Phase 7 adds that repository method as a backward-compatible read of the existing attempt key, also fixing the corresponding Phase 5B/6 call sites.
