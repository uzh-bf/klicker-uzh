# Assessment Invitation CSV Guardrails Implementation Plan

> **For agentic workers:** Apply the repository's Klicker frontend, GraphQL,
> Playwright, testing, and wiki skills. Execute the tasks inline and keep the
> checklist current; delegated execution is not available for this task.

**Goal:** Add a non-blocking Swiss Edu-ID affiliation warning, a canonical CSV
template download, and layered structural/email validation to the assessment
participant invitation importer.

**Architecture:** Keep the dependency-free parser in the existing import
component and add only structural checks there. Keep semantic email validation
authoritative in the invitation service so API callers and the UI receive the
same per-row result contract. Generate the template in the browser from a fixed
PII-free header string.

**Tech Stack:** Next.js pages router, React 19, TypeScript 6, next-intl,
`@uzh-bf/design-system`, Apollo Client, Zod 3.25, Vitest, Playwright.

## Global Constraints

- Do not enforce a domain allowlist; affiliation is verified by Swiss Edu-ID.
- Preserve partial imports: one invalid email must not abort valid rows.
- Keep the required canonical columns `email` and `matriculationNumber`.
- Preserve comma/semicolon, BOM, quoted-field, escaped-quote, blank-line, and
  matriculation-header-alias support.
- Add no dependency, Prisma migration, auth change, or uploaded-file storage.
- Add every visible string in English and German and every new interaction with
  a stable `data-cy` hook.
- Context7 is unavailable in this environment; use the pinned package versions,
  installed TypeScript declarations, and existing repository patterns.

---

### Task 1: Authoritative email validation

**Files:**

- Modify: `packages/graphql/test/participantInvitations.test.ts`
- Modify: `packages/graphql/src/services/participantInvitations.ts`

**Interfaces:**

- Consumes: `normalizeEmail(email?: string): string | null`
- Produces: unchanged `createParticipantInvitations(...)` response with one
  `error` result per syntactically invalid email.

- [x] **Step 1: Add a failing partial-validation service test**

Add a focused case that sends one valid address plus `missing-domain@`,
`two@@example.org`, and `contains space@example.org`. Assert `created: 1`,
`errors: 3`, and three `Invalid email format` row results while the valid
invitation exists in the database.

```ts
it('rejects malformed emails without aborting valid rows', async () => {
  const course = await createAssessmentCourse()
  const result = await createAssessmentParticipantInvitations(
    {
      courseId: course.id,
      invitations: [
        { email: 'valid.affiliation@uzh.ch' },
        { email: 'missing-domain@' },
        { email: 'two@@example.org' },
        { email: 'contains space@example.org' },
      ],
    },
    lecturerCtx
  )

  expect(result).toMatchObject({ created: 1, errors: 3 })
  expect(result.results.slice(1)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ status: 'error', error: 'Invalid email format' }),
      expect.objectContaining({ status: 'error', error: 'Invalid email format' }),
      expect.objectContaining({ status: 'error', error: 'Invalid email format' }),
    ])
  )
})
```

- [x] **Step 2: Run the focused test and confirm the malformed rows fail**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local participantInvitations.test.ts
```

Expected: the new case fails because `normalizeEmail` currently accepts strings
that merely contain `@`.

- [x] **Step 3: Add minimal Zod email validation in the service**

Use the already pinned GraphQL dependency and keep normalization first:

```ts
import * as z from 'zod'

const invitationEmailSchema = z.string().email()

const normalizedEmail = normalizeEmail(rawEmail)
if (
  !normalizedEmail ||
  !invitationEmailSchema.safeParse(normalizedEmail).success
) {
  results.push({
    email: rawEmail,
    status: 'error',
    error: 'Invalid email format',
  })
  continue
}
```

- [ ] **Step 4: Re-run the focused service suite**

Run the same `test:local` command. Expected: all invitation service cases pass
and valid rows still create invitations when malformed rows are present.

The post-fix local rerun is intentionally left unchecked: the legacy helper
deletes all courses and users in the shared workspace database. The isolated CI
run is the authoritative green verification for this step.

---

### Task 2: Warning, template download, and structural CSV checks

**Files:**

- Modify:
  `apps/frontend-manage/src/components/courses/participantInvitations/ParticipantInvitationCsvUpload.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Produces `assessment-participant-invitations-template.csv` with exact contents
  `email,matriculationNumber\r\n`.
- Preserves `AssessmentParticipantInvitationInput[]` as the mutation input.

- [x] **Step 1: Add the localized UI contract**

Add matching keys under `manage.assessment`:

```ts
invitationAffiliationWarning:
  'Use the exact email address listed as a verified Swiss Edu-ID affiliation (for example, an @uzh.ch address). Personal email addresses may not be matched when the participant signs in.',
invitationDownloadTemplate: 'Download CSV template',
invitationCsvInvalidHeaders:
  'The CSV must contain exactly one email column and one matriculationNumber column.',
invitationCsvInvalidRows:
  'Every CSV row must contain the same number of columns as the header.',
```

Add equivalent German copy explaining the same warning and errors.

- [x] **Step 2: Harden the existing parser state machine**

Track whether a quoted field has closed. Ignore whitespace after a closing quote
but reject any other character before the delimiter or row ending:

```ts
let quotedFieldClosed = false

if (character === '"') {
  if (isQuoted && content[index + 1] === '"') {
    field += '"'
    index++
  } else if (isQuoted) {
    isQuoted = false
    quotedFieldClosed = true
  } else if (field.length === 0 && !quotedFieldClosed) {
    isQuoted = true
  } else {
    throw new Error('Unexpected quote in CSV field')
  }
} else if (quotedFieldClosed && !/\s/.test(character)) {
  if (character !== delimiter && character !== '\n' && character !== '\r') {
    throw new Error('Unexpected character after quoted CSV field')
  }
}
```

Reset `quotedFieldClosed` whenever a field or row is finished.

- [x] **Step 3: Validate semantic header uniqueness and record width**

After parsing, compute the matching column indices and reject ambiguous mappings
or records with a different width:

```ts
const emailIndices = headers.flatMap((header, index) =>
  header === 'email' ? [index] : []
)
const matriculationNumberIndices = headers.flatMap((header, index) =>
  MATRICULATION_NUMBER_HEADERS.has(header) ? [index] : []
)

if (emailIndices.length !== 1 || matriculationNumberIndices.length !== 1) {
  setParseError(t('manage.assessment.invitationCsvInvalidHeaders'))
  return
}

if (recordRows.some((record) => record.length !== sourceHeaders.length)) {
  setParseError(t('manage.assessment.invitationCsvInvalidRows'))
  return
}
```

Use the single indices directly when building invitation rows. Preserve extra
unrelated columns and all existing accepted header aliases.

- [x] **Step 4: Add the browser-generated template action**

Add `faDownload`, a constant filename/content, and a click handler that revokes
its object URL after use:

```ts
const CSV_TEMPLATE_FILENAME =
  'assessment-participant-invitations-template.csv'
const CSV_TEMPLATE_CONTENT = 'email,matriculationNumber\r\n'

function downloadCsvTemplate() {
  const url = URL.createObjectURL(
    new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = CSV_TEMPLATE_FILENAME
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
```

Render a design-system button with
`data={{ cy: 'assessment-invitations-download-template' }}` and render the
warning as a `UserNotification` with
`data={{ cy: 'assessment-invitations-affiliation-warning' }}`.

- [x] **Step 5: Run focused static checks**

```bash
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage lint
```

Expected: both commands pass and both locale files expose the same keys.

---

### Task 3: End-to-end coverage and durable documentation

**Files:**

- Modify: `playwright/tests/N-course.spec.ts`
- Modify: `docs/frontend-conventions.md`
- Modify: `.agents/skills/klicker-frontend-ui/SKILL.md`
- Create: `docs/log/2026-08-18-assessment-invitation-csv-guardrails.md`
- Modify:
  `project/plans_wip/PLAN-assessment-invitation-csv-guardrails.md`

**Interfaces:**

- Consumes the `data-cy` hooks and localized keys from Task 2.
- Produces browser and CI evidence for download and parser behavior.

- [x] **Step 1: Extend the existing invitation Playwright flow**

Import `readFile` from `node:fs/promises`, assert the warning, and verify the
download:

```ts
const downloadPromise = page.waitForEvent('download')
await page.getByTestId('assessment-invitations-download-template').click()
const download = await downloadPromise
expect(download.suggestedFilename()).toBe(
  'assessment-participant-invitations-template.csv'
)
expect(await readFile(await download.path(), 'utf8')).toBe(
  'email,matriculationNumber\r\n'
)
```

Upload duplicate semantic headers and an uneven record to assert the two new
localized errors. Then upload a BOM-prefixed, semicolon-delimited file with a
quoted address and escaped/extra quoted column, and preserve the existing mixed
success import/deletion assertions.

- [x] **Step 2: Verify Playwright compilation and discovery**

```bash
pnpm --filter @klicker-uzh/playwright check
pnpm --filter @klicker-uzh/playwright exec playwright test N-course.spec.ts --list
```

Expected: TypeScript passes and the course suite, including the invitation test,
is listed.

- [x] **Step 3: Update the wiki and skill contract**

Document that the warning is advisory because affiliation is verified only by
Swiss Edu-ID, the template uses canonical headers, structural errors block file
submission, and semantic row errors remain partial import results. Bump
`docs/frontend-conventions.md` to `2026-08-18` and add the required one-batch log
file.

- [x] **Step 4: Mark implementation progress in the approved design**

Append dated progress entries for implementation, verification, browser
evidence, and PR/CI state. Do not duplicate the implementation plan inside the
design file.

- [x] **Step 5: Validate and format documentation**

```bash
bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs
pnpm exec prettier --write docs/ .agents/skills/klicker-frontend-ui/SKILL.md project/plans_wip/PLAN-assessment-invitation-csv-guardrails*.md
```

Expected: wiki validation and formatting pass. If the external validator is not
installed, report that exact environment gap and rely on repository checks.

The external validator is not installed at the documented path in this
environment; Prettier and the repository checks are used instead.

---

### Task 4: Browser, repository, and PR verification

**Files:**

- Update only files already listed if verification exposes a defect.

- [x] **Step 1: Start or prove the real local environment**

```bash
devrouter ensure .
```

Use the routed manage URL returned for this worktree and delegated lecturer
credentials from `AGENTS.md`.

- [x] **Step 2: Verify the visible states with `npx agent-browser@0.32.2`**

Check English and German warning/template copy, exact template download,
successful quoted CSV preview/import, duplicate-header error, uneven-row error,
desktop layout, and mobile layout. Capture redacted screenshots suitable for the
public PR and add them to the existing screenshot folder/PR description.

- [x] **Step 3: Run final mechanical verification**

```bash
pnpm --filter @klicker-uzh/graphql test:local participantInvitations.test.ts
pnpm run check:all
pnpm run build
opengrep scan --config auto \
  packages/graphql/src/services/participantInvitations.ts \
  apps/frontend-manage/src/components/courses/participantInvitations/ParticipantInvitationCsvUpload.tsx \
  playwright/tests/N-course.spec.ts
```

Expected: all commands pass with no feature-code findings.

The unsafe local service rerun remains delegated to isolated CI as recorded in
Task 1. `check:all` and the unrestricted production build pass. OpenGrep's only
result is a pre-existing dynamic-regex finding at
`playwright/tests/N-course.spec.ts:918`, outside this change.

- [x] **Step 4: Review data hygiene and branch scope**

Inspect `git diff`, staged files, CSV literals, and screenshots for real names,
addresses, matriculation numbers, credentials, and unrelated changes. Only
synthetic examples such as `valid.affiliation@uzh.ch` may be committed.

- [ ] **Step 5: Commit, push, update the draft PR, and monitor CI**

Use conventional commits, ensure the PR body describes the complete branch
against `v3`, add the new screenshots/evidence, push, and monitor all Playwright
shards and other required checks to completion without merging the PR.

## Plan self-review

- Every approved spec requirement maps to Tasks 1–4.
- Function names, filenames, template bytes, i18n keys, and test hooks are
  consistent across tasks.
- No domain enforcement, new dependency, schema migration, or auth change has
  entered scope.
- The plan contains no deferred implementation decisions.
