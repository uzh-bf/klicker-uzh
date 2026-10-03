# Import the Klicker Excel template

This standalone operator script imports **all seven element tabs** in the Klicker
Excel template into an existing lecturer's library. Compatibility is determined
by the worksheet names, column headers, and field rules; no version marker is required.
It lives in the GraphQL package and uses Prisma directly; it does not call a
GraphQL API and does not depend on the import/export PR stack.

## Workbook contract

- Keep the seven element tabs, row 6 headers, and row 8 data start unchanged.
  Any combination of element tabs may contain data. The Instructions sheet is
  optional; its A1 marker may be absent or contain any text.
- At most 500 elements total and 5 MiB per file. SC and MC support ten answer slots;
  gaps are accepted and populated answers keep their order. Every populated answer
  needs a correctness value when sample solutions are enabled. Feedback needs
  a sample solution and feedback for each answer; `-` is accepted as literal text.
- General explanations stay in Explanation. Individual answer feedback stays in
  Feedback 1–10. Flashcard Front maps to content and Back maps to explanation.
- Tags are semicolon-separated, trimmed, and deduplicated. Quote a tag containing
  a semicolon, doubling any internal quotes. Commas remain part of the tag name.
  Existing owner-scoped tags are reused; missing tags are created atomically.
- Text, Markdown, line breaks, and image placeholders remain literal. Nothing
  downloads or uploads images, replaces placeholders, or moves front/back text.
- Unknown headers or tabs, formulas, hyperlinks, embedded
  images, and macro content are rejected. Empty supported tabs are allowed.
  Do not use this importer for untrusted or personally identifying source data.

| Tab             | Supported fields and rules                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Single choice   | Up to ten answers; exactly one correct answer when a sample solution is enabled.                                                                |
| Multiple choice | Up to ten answers; at least one correct answer when a sample solution is enabled.                                                               |
| Kprim           | Exactly four statements; each has its own true/false flag. All four may be false.                                                               |
| Numerical       | Up to six exact answers or ranges; optional unit, decimal places, input hint, and minimum/maximum restrictions. Solution modes cannot be mixed. |
| Free text       | Up to six accepted answers and an optional maximum answer length.                                                                               |
| Content         | Content and optional explanation; no solution or scoring fields.                                                                                |
| Flashcards      | Front and back; no solution or scoring fields.                                                                                                  |

Every type supports tags. Selection and Case Study are not part of the Excel
template and are not imported by this script. Incompatible column layouts still
fail validation even if a workbook contains a familiar version marker.

## Run

Use Node/pnpm and the built Prisma package in the repository's development
container. Install dependencies normally, then build `@klicker-uzh/prisma`.
Place the workbook and run directory outside tracked source. Run from the repo
root; supply database credentials through your approved operator environment,
never in command arguments or checked-in files.

```sh
# Offline validation: no database connection or writes.
pnpm --filter @klicker-uzh/graphql script:element-import \
  --file /private/input.xlsx --validate-only

# Dry run is the default. OWNER_ID is the existing lecturer's UUID.
pnpm --filter @klicker-uzh/graphql script:element-import \
  --file /private/input.xlsx --owner "$OWNER_ID" --state-dir /private/import-run

# Review comparison.csv and before-dump.json, then explicitly enable writes.
DRY_RUN=false pnpm --filter @klicker-uzh/graphql script:element-import \
  --file /private/input.xlsx --owner "$OWNER_ID" --state-dir /private/import-run
```

The write command requires `DATABASE_URL`, an existing USER/ADMIN owner, and the
unchanged saved dry run. It creates private REVIEW elements and their owner
permissions. It creates no activities, instances, shares, results, XP, or media.
Database credentials confer operator authority; this bypasses HTTP authentication.
Only the `public` PostgreSQL schema is supported; `PG*` environment overrides
are rejected so the saved target and the actual connection cannot disagree.

## Duplicates and verification

Exact teaching-content matches in the owner's non-deleted library (including
archived elements), or earlier workbook rows, are skipped. The comparison CSV
identifies each source sheet, row, title, action, and matching element ID/row.
Titles, tags, status, and internal choice IDs do not affect the comparison;
question text, explanations, ordered choices, enabled solutions/feedback, layout,
scoring, and type-specific restrictions/settings do. Accepted text/numerical
solutions are compared as sets. Skipped elements are not renamed or given
additional tags.

The before dump binds the file hash, owner, database target, planned actions, and
hashes of existing library/tag state. No existing teaching content is dumped.
The CSV does contain incoming titles; keep all run artifacts private. Changing
the file, database state, or comparison CSV requires a new dry run directory.

Writes run in one serializable transaction with a per-owner advisory lock and no
automatic retry. The script rereads and checks inserted fields, tags, permissions,
and unchanged existing records before commit. The after dump records inserted IDs,
skips, state hashes, and the verification count; its presence refuses reruns.

If the process crashes, preserve the run directory. Check whether the transaction
committed using its `excel-v6:<run-hash>:<sheet>:<row>` original IDs before removing
the stale `.running` lock or creating a new preview. A database commit can succeed
even if writing the local receipt subsequently fails. Never delete elements or
tags automatically to recover; investigate affected IDs and permissions first.

## Development verification

```sh
pnpm --filter @klicker-uzh/graphql exec vitest run test/elementWorkbookParse.test.ts test/elementWorkbookPlan.test.ts
pnpm --filter @klicker-uzh/graphql check:element-import

# Explicit opt-in; DATABASE_URL must point to a freshly provisioned,
# marked klicker_test database using its non-privileged klicker_test login.
RUN_ELEMENT_WORKBOOK_DB_TESTS=true pnpm --filter @klicker-uzh/graphql exec vitest run test/elementWorkbookDatabase.test.ts
```

Only synthetic fixtures belong in tests. Keep real workbooks, PDFs, comparison
CSVs, and before/after dumps out of this public repository.
