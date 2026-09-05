# Fixed element spreadsheets

## Goal

Import fixed Klicker and Kahoot XLSX templates into the importing lecturer's
element library. Export Klicker elements as the same editable workbook. Cover
all nine element types, with explicit worksheet/row diagnostics and an action
to import valid elements. Preserve original public Klicker image URLs across
owners. Skip exact duplicates automatically and identify every skipped row.

## Non-goals

Arbitrary column mapping, Mentimeter result imports, embedded Excel images,
Kahoot images, course backups, blob copying, publishing, and changes to ZIP
duplicate policy. Do not copy tags, status, or permissions between lecturers.

## Contract and architecture

- An Element is authored source content, not an ElementInstance or response.
- Use versioned, fixed worksheet headers and explicit element/collection refs.
  Separate repeating choices, solutions, collection entries, and case-study
  data into related tables. No JSON cells or comma-delimited authored answers.
- Validate complete dependent elements with the existing canonical domain.
  Invalid dependent rows invalidate their element, not unrelated elements.
- Reject formula/error cells as authored values, oversized archives, macros,
  and ambiguous layouts. Never evaluate formulas or follow workbook links.
- Preserve image URLs; no availability request may become an arbitrary server
  fetch. Unavailable links remain visible with a warning. Malformed or
  disallowed auto-loading references invalidate the affected element.
- Equality ignores element name, tags, and status; compares canonical authored
  content, answers, grading, and image references. The existing ZIP fingerprint
  alone is insufficient because it omits unresolved media. Enforce owner-scoped
  equality under a transaction lock, including repeated rows in one workbook.
- Reuse authenticated artifact storage, signed import tokens, durable receipts,
  and transactional element execution. Keep ZIP parsing and mutations intact.
  Duplicate reports must survive a replay without relying on mutable elements.

## Footprint

GraphQL workbook codec/services/schema/new operations and tracked SDL;
frontend-manage upload/download controls; i18n EN/DE. Reuse pinned ExcelJS 4.4.0
already in the repository. No gamification, participant data, or scheduling.
Use existing full-access import/export authorization and assessment exclusion.
Synthetic fixtures only. A receipt representation change, if needed, requires
the repository's schema/migration workflow before integration.

## Slices and evidence

1. Fixed workbook codec and official Kahoot layout; round-trip all nine types,
   malformed rows, references, formulas, bounds, and image URL preservation.
2. Durable service adapter and exact duplicate enforcement; test existing,
   within-file, concurrent, cross-owner, changed-image and replay cases.
3. Review/report UI, template download and Excel export, EN/DE; browser evidence
   for valid, partial, all-duplicate, failed and successful imports.
4. Codegen, targeted typechecks/database tests and independent integrated review;
   retain existing ZIP regression coverage.

## Progress

- 2026-09-05: v3 merged locally as 53a43877f; not pushed. Product scope accepted.
- Read-only explorer mapped the durable execution seam and confirmed ZIP
  fingerprints cannot alone enforce the accepted media identity contract.
- User authorized the isolated `import-export-elements` Devrouter runtime.
  Codec, services, GraphQL operations and EN/DE UI are implemented. Generated
  SDL and GraphQL/frontend typechecks pass.
- A real generated migration adds skippedElementRefs, permits all-duplicate
  completion, protects immutable results and updates the readiness contract.
  Applied and tested only against this task's disposable synthetic database.
- Unit and database tests cover all nine types, dependent errors, formulas,
  URL-sensitive identity, within-file and existing duplicates, concurrent
  imports, cross-owner imports and durable replay. ZIP advisory behavior passes.
- Independent review identified and resolved database readiness drift. Testing
  the real official Kahoot workbook identified its ZIP data descriptors; bounded
  descriptor support is opted into only for workbook parsing.
- Browser verification passes on desktop and 390px mobile, in EN/DE. Partial
  import creates all nine types, excludes the invalid row and reports the
  repeated row; repeat import creates zero and lists all nine duplicates.
  The actual downloaded export (ten selected elements) re-imports with zero
  creations and ten skipped rows. The real Kahoot template imports one SC with
  explicit image/timer notices. Template download, empty/invalid workbooks,
  case-study preview and the ZIP export dialog were exercised.
- Final source lint and GraphQL/frontend typechecks pass. Targeted tests include
  six spreadsheet database scenarios, sixteen codec/flag-validation cases,
  image-reference policy, four descriptor cases, the existing strict ZIP suite,
  durable receipt regressions, operations contract and database schema inspection.
  Independent native reviews covered architecture, persistence, security and UI.
  External Executor/Simplifier roles were not used: this repository has not
  opted into their configured provider. Main implemented the reviewed cleanups.
- Local browser evidence is in ignored `output/spreadsheet-verification/`.
  The runtime required a temporary container-only GIT_WORK_TREE setting because
  the repository is bare; its Compose source edit was reverted after startup.
  The running isolated container retains that setting. Shared Git config and
  unrelated runtimes were not changed. No implementation commit or push made.
