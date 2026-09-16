# Import/export format revision

## Goal

Export only ZIP archives containing canonical element JSON for all nine types and separate answer-collection JSON. Import the supported JSON representation and an authoring-only fixed Excel template. Excel supports SC, MC, KPRIM, NUMERICAL, FREE_TEXT, CONTENT and FLASHCARD, each on its own tab with one complete example and type-specific editing rules. Selection/case study remain JSON-only.

## Boundaries and decisions

- Elements and answer collections are authored resources, never activity instances or participant data. Preserve private REVIEW imports, scoring semantics, duplicate skipping/reporting and public image-reference policy.
- Reuse canonical element validation, authorization and durable artifact/receipt execution. Do not add a parallel persistence model, schema, scoring, gamification or worker behavior.
- JSON imports accept exported JSON-only ZIPs and individual JSON files. Multiple extracted element and collection files are selected together and bound to one artifact. This was the stated default after the optional clarification received no answer.
- New workbook version with seven type tabs and a short Instructions tab. Each choice/solution row belongs to a ref on the same tab; the first row holds question settings, following rows repeat the ref and contain additional answers. No cross-tab collection references. Reject unsupported/old workbook versions clearly; these unreleased formats are superseded.
- Rules: required text; valid Boolean/list dropdowns; sample-solution/feedback dependencies; SC/MC correct-answer counts; four Kprim statements; numerical solution mode and ordered bounds; integer point multipliers/accuracy/text length; flashcard back required; no sample-solution/points fields on content/flashcards. Excel checks assist; upload validation remains authoritative.
- Retain UZH palette, Aptos workbook font, per-tab plain-language instructions and field help. No macros or external formula dependencies.

## Layers and authorization

GraphQL workbook/JSON codecs, services/schema/operations and generated SDL; Manage import/export controls and paired EN/DE strings; documentation and focused fixtures/tests. Existing full-access lecturer capability and export ADMIN/OWNER checks remain. No production access or rollout changes. Work in the existing approved six-layer stack, without publishing or changing its topology in this task.

## Verification

Canonical parser and malformed-input tests; workbook serialization and validation-formula assertions; JSON export/import all-nine-type and collection dependency coverage; duplicate regressions; targeted GraphQL and Manage checks/build; existing authorized synthetic runtime/browser with EN/DE and desktop/mobile evidence. Independent final review. Keep production enablement separate from local verification.

## Progress

- 2026-09-16: accepted revised format scope; read existing codecs, UI, contracts and skills. JSON packaging clarification requested. Existing stack skills unavailable locally; no stack topology operation is required for implementation.
- 2026-09-16: implemented JSON-only ZIP exports for all nine types, separate collection files, shared ZIP/loose JSON/Excel import, and version 3 seven-tab Excel authoring template. Added conditional field checks, dropdowns, contextual help and one example per type. Preserved duplicate reporting and public image references.
- Verification: 136 tests passed across 10 explicitly selected database-independent files; GraphQL and Manage typechecks passed; targeted dependency/GraphQL build passed (7 tasks). Existing Rollup subscription typing and circular-dependency warnings remain. Native Excel opened the workbook without repair, rejected an invalid multiplier, and a saved edited workbook parsed as seven elements without issues. Browser verified seven-type import, named duplicate skipping, nine-type JSON export/import, loose JSON with collection dependency, and English desktop/German mobile layouts. Independent final review found no new blocking finding.
- Local synthetic database cleanup occurred during test execution. Reseeded the disposable environment and restored all 12 retained example elements from the previous workbook through the import UI. No production database was involved. Avoid running database-cleanup suites against retained interactive fixtures.
- Publication authorized: JSON export and image-reference changes are owned by the API layer and forward-merged through the existing stack; unified import and Excel changes are owned by the top layer. This verification does not establish full-stack CI, merge readiness against current v3, or production rollout readiness. Evidence: `output/formats-sep16/verification.md` (ignored local artifacts).
