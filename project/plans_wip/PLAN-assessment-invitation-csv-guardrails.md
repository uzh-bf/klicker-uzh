# Assessment invitation CSV guardrails

## Goal

Make the assessment participant invitation import safer and easier to use by
warning lecturers about the Swiss Edu-ID affiliation requirement, providing a
canonical CSV template, and rejecting structurally malformed CSV files before
submission.

## Non-goals

- Do not enforce a domain allowlist. Institutional and departmental domains
  cannot be identified reliably from the address alone.
- Do not change the invitation status lifecycle, participant login flow, or
  Swiss Edu-ID claim handling.
- Do not store uploaded files or add a CSV parsing dependency.
- Do not make one invalid email abort otherwise valid invitation rows.

## Domain vocabulary and behavior

A participant invitation identifies the exact email address that must later
appear among the participant's verified Swiss Edu-ID affiliation emails. The
CSV importer cannot prove that relationship at upload time. It therefore shows
a non-blocking warning with an example such as `@uzh.ch`, while the existing
authentication flow remains authoritative when an invitation is accepted.

Personal or otherwise non-affiliation addresses remain importable and may stay
`PENDING`; lecturers can delete those invitations through the existing flow.

## Layer footprint

- `apps/frontend-manage`: warning copy, template download, and stricter
  structural parsing.
- `packages/graphql`: authoritative per-row email-format validation.
- `packages/i18n`: matching English and German strings.
- `playwright`: template-download and parser behavior coverage.
- `docs` and `.agents/skills`: update the invitation CSV contract and record the
  behavioral change.

No Prisma, auth, participant PWA, Hatchet, gamification, seed, or dependency
change is required.

## UI and CSV contract

The import card shows a warning that the email must match a verified Swiss
Edu-ID affiliation email and that personal addresses may not be accepted at
login. This warning is explanatory and never blocks an import based on a domain
suffix.

A labelled download action creates
`assessment-participant-invitations-template.csv` in the browser with the
canonical header row:

```csv
email,matriculationNumber
```

The template contains no participant data or example row.

The existing parser continues to support UTF-8 BOMs, comma and semicolon
delimiters, quoted fields, escaped quotes, blank lines, and normalized
matriculation-number header aliases. It additionally rejects:

- missing required `email` or matriculation-number headers;
- more than one email column or more than one recognized matriculation-number
  column;
- malformed quoting; and
- non-empty records whose field count differs from the header field count.

Unrelated extra columns remain allowed for compatibility, provided every
record has the same number of fields as the header. Whitespace is trimmed as it
is today.

## Validation and error handling

Validation stays layered:

1. The browser validates the file structure and shows a localized file-level
   error without enabling import when the CSV cannot be mapped safely.
2. The GraphQL service normalizes and validates every email independently.
   Invalid addresses remain per-row errors, so valid rows in the same import
   still succeed.
3. Swiss Edu-ID provides the authoritative affiliation check during participant
   authentication; the importer does not guess affiliation from the domain.

The server email check requires a non-empty local part and a syntactically
usable domain around a single `@`. It does not attempt full mailbox validation
or institutional-domain classification.

## Authorization, gamification, and async impact

Authorization is unchanged: assessment-course managers require course `ADMIN`
permission. The adjustment has no gamification or asynchronous-workflow impact.

## Verification

- GraphQL service tests cover clearly malformed email addresses while retaining
  partial-success behavior.
- Playwright verifies the template filename and exact contents, the affiliation
  warning, canonical and alias headers, BOM/quoted/delimited input, and rejection
  of duplicate headers, malformed quoting, and inconsistent record widths.
- Browser verification covers English and German warning/template labels and
  the successful and malformed file states on desktop and mobile.
- Run GraphQL codegen only if the GraphQL contract changes, followed by the
  focused package tests, Playwright typecheck/discovery, `pnpm run check:all`,
  `pnpm run build`, and focused OpenGrep.

## Design self-review

- No placeholders or undecided behavior remain.
- The warning-only affiliation policy is consistent across the UI, service, and
  authentication boundary.
- The parser changes are limited to safe structural checks and preserve the
  existing partial-import contract.
- The change is one cohesive update to the existing draft PR.

## Progress

- **2026-08-18:** Inspected the current CSV parser, GraphQL invitation service,
  Swiss Edu-ID affiliation matching, tests, documentation, and branch state.
- **2026-08-18:** User approved a non-blocking affiliation warning, canonical
  template download, layered validation, and stricter structural parsing.
