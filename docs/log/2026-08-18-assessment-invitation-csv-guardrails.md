## 2026-08-18

- **Update**: [Frontend Conventions](../frontend-conventions.md) records the
  advisory Swiss Edu-ID affiliation warning, canonical invitation CSV template,
  structural browser validation, and partial server-side email-error contract.
- **Implementation**: The importer now downloads a PII-free
  `assessment-participant-invitations-template.csv`, rejects duplicate semantic
  headers, inconsistent row widths, and malformed quoting, and retains BOM,
  comma/semicolon, quoting, escaped-quote, blank-line, alias, and extra-column
  support.
- **Identity boundary**: No institutional-domain allowlist was added. The UI
  warns lecturers to use an exact verified affiliation address, while Swiss
  Edu-ID remains authoritative for affiliation matching.
- **Verification**: The focused malformed-email case reproduced the previous
  permissive behavior before the fix. Frontend Manage, GraphQL, and Playwright
  typechecks pass; the Manage lint command reports only 27 pre-existing hook
  warnings and no errors. The green service rerun is delegated to isolated CI
  because the legacy local helper broadly deletes workspace courses and users.
- **Browser evidence**: The real routed lecturer UI was checked in English and
  German on desktop and mobile. The template downloaded with the exact filename
  and 27-byte CRLF contents; duplicate headers, uneven rows, and malformed
  quoting were rejected; and a BOM/semicolon/quoted two-row file produced one
  pending invitation plus one row-level email error. The synthetic pending
  invitation was then deleted through the confirmation flow.
- **Screenshots**: Added redacted desktop and German mobile evidence under
  `docs/screenshots/assessment-participant-invitations/`.
- **Repository checks**: `pnpm run check:all` and the full production build
  pass. The first sandboxed build attempt was blocked when Turbopack tried to
  bind an ephemeral local helper port; the unrestricted retry passed all 22
  build tasks. Focused OpenGrep completed 210 rules over the three changed
  code/test files; its only result is a pre-existing dynamic-regex finding at
  `playwright/tests/N-course.spec.ts:918`, outside this change.
- **Review follow-up**: Hardened the Playwright invitation fixture so unknown
  participant usernames fail immediately and pending fixtures cannot reference
  participant accounts.
