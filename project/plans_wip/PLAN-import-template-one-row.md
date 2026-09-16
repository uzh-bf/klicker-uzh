# Simple one-row Excel import template

## Goal

Replace author-managed references and repeated answer rows with one row per authored element. Keep seven type tabs, one editable example per tab, UZH styling, and conditional Excel/server checks. Export remains JSON-only; JSON import and canonical persistence are unchanged.

## Decisions

- Klicker's SC/MC editor and canonical choice validator have no maximum; Kprim requires exactly four. The user chose ten SC/MC answer slots after reviewing the six-slot template. Clearly describe this as an Excel template limit, not a Klicker-wide limit.
- Version 4 template has no ref column. Generate internal refs from type and worksheet row. Reordering rows cannot change didactic identity or duplicate detection.
- Numbered answer/correct columns sit beside the question. Optional feedback/settings follow. Six alternative free-text or numerical solutions/ranges fit a row; Kprim has four statements. Blank unused slots are allowed, but orphan correctness/feedback and conflicting solution modes fail with the actual column label.
- Use readable headings and Yes/No dropdowns; map to canonical typed fields internally. Blank rows remain blank, and copying/pasting cannot bypass server validation. Field dependencies, required answers, correctness counts, numerical limits/bounds, flashcard backs, and score multipliers remain enforced.
- No new application answer cap, schema/migration, auth changes, scoring behavior, activity instances, participant data, or worker changes. Current lecturer capability, private REVIEW import and exact duplicate suppression remain.

## Implementation and evidence

Generator contract/parser/validation/examples/help and focused tests in GraphQL; matching format documentation. Verify actual XLSX serialization, all seven examples, unused and final slots, malformed/orphan inputs, row reorder identity, dependent validation formulas and limits. Run GraphQL checks and database-independent tests in the existing authorized container only. Download and exercise the generated workbook in the browser/native Excel. Independent final review; no publication unless requested.

## Completed verification — 2026-09-16

- Implemented v4 generator/parser/examples and local row validation for all seven supported types. No authored references or repeated answer rows remain.
- GraphQL generate/schema/typecheck passed. Ten database-independent import/export suites passed: 124 tests. Seven-task GraphQL dependency build passed. Biome checked the ten changed TypeScript files; focused validation regressions passed after the final comment/test additions.
- Native Microsoft Excel opened the workbook without a repair warning. The initial list formula rejected valid values; fixed by selecting quoted named-range names through INDIRECT rather than returning a range through IFERROR. Native retest accepted typed numeric Answer 6 = 8 and Correct 6 = Yes, then saved successfully. Shortened guidance and widened narrow columns after visual inspection. Generated list formulas max 130 characters, custom formulas max 209, below Excel's 255-character limit.
- Recovered only the existing authorized readiness runtime using the already-installed Devrouter 0.0.72 CLI; host default 0.0.51 rejected its newer config. Profile manage, same DevPod/container and retained synthetic data; unrelated environments untouched.
- Downloaded the actual UI template and verified klicker-elements-4, Answer 6, and the corrected dropdown formula. Uploaded the native Excel-saved workbook through the real browser: all seven rows accepted, MC preview retained answers 2/4/5/8 with 8 correct. Commit created four elements and reported three exact duplicates by name and row. No destructive database test suites ran.
- Native helper Dalton updated focused tests/docs; independent reviewer Planck found no actionable issues, including a second pass over the dropdown fix. External executor/simplifier roles were not eligible because this repository has no external-model opt-in.
- Evidence and clean downloaded workbook: ignored output/one-row-template/ (klicker-template.xlsx, import-preview.png, import-result.png).
- Current revision remains uncommitted/unpushed. Prior whole-stack readiness limitations and legacy Playwright migration remain outside this workbook simplification.

## Ten-answer update — 2026-09-16

At the user's request, increased only SC/MC capacity to ten, including feedback and correctness fields. The bounded workbook column budget now derives from the trusted template definitions (38 columns) so the wider template is accepted. Kprim stays at four; numerical/free-text solutions stay at six. Updated instructions and last-slot diagnostics/tests. All 25 focused workbook/media/JSON tests, GraphQL typecheck, Biome and the seven-task package build passed. Browser download verified ten SC/MC slots and four Kprim statements. Clean artifact: output/one-row-template/klicker-template-10-answers.xlsx. Not committed or pushed.
