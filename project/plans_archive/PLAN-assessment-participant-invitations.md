# Assessment participant invitation management

## Goal

Give assessment-course managers a lecturer-facing UI for importing participant
invitations from CSV, inspecting pending and accepted invitations, and deleting
pending invitations.

## Non-goals

- No change to the `ParticipantInvitation` Prisma model or invitation status
  lifecycle.
- No invitation emails or notifications.
- No editing of accepted invitations and no deletion of accepted invitations.
- No background job, uploaded-file storage, manual invitation form, search,
  filtering, or CSV template download in the first iteration.
- No change to participant Edu-ID authentication or invitation acceptance.

## Domain vocabulary

- A `ParticipantInvitation` grants one email address access to one assessment
  `Course`.
- A `PENDING` invitation has not yet been linked to a `Participant`.
- An `ACCEPTED` invitation grants assessment-course admission and may back a
  `Participation` row; `Participation.isActive` remains independent
  leaderboard consent and is preserved during invitation handling.
- The optional `matriculationNumber` is an identifier attached to the
  invitation, not to the participant account.

The existing creation service remains authoritative: a verified matching
participant account can be auto-accepted, while other valid emails create
pending invitations.

## Layer footprint

- `packages/graphql`: invitation object/input/result types, manager-authorized
  list/import/delete fields, service functions, GraphQL operations, generated
  artifacts, and focused service tests.
- `apps/frontend-manage`: an assessment invitation page, CSV parsing and
  preview, invitation table, import summary, delete confirmation, and a course
  header navigation entry.
- `packages/i18n`: matching English and German UI strings.
- `docs` and `.agents/skills`: invitation workflow documentation and any
  directly affected workflow guidance, plus the required documentation log.
- `playwright`: a focused lecturer flow when the existing assessment fixtures
  make it reliable without expanding seed scope.

No Prisma migration, shared type, PWA, auth, Hatchet, gamification, or seed
change is expected.

## Authorization

Every GraphQL field uses the existing three-layer authorization shape:

1. `t.withAuth(asUser)` authenticates a lecturer.
2. `withPermission` checks `PermissionLevel.ADMIN` for the supplied `courseId`.
3. The service verifies that the course exists and is assessment-enabled before
   reading or mutating invitations.

The page navigation entry is shown only for an assessment course where the
current lecturer is a manager. Direct requests remain protected by the API.
Invitation data contains personal information and is never exposed through a
participant-facing field.

## API design

### Query

`assessmentParticipantInvitations(courseId, numEntries, offset)` returns a
bounded page of invitations ordered by newest `invitedAt` first. Each row
exposes:

- `id`
- `email`
- `matriculationNumber`
- `status`
- `invitedAt`
- `acceptedAt`

### Import mutation

`createAssessmentParticipantInvitations(courseId, invitations)` accepts typed
rows containing a required email and optional matriculation number. It delegates
to the existing invitation creation service and returns:

- total processed, created, auto-accepted, duplicate, and error counts
- a per-row status and optional error message

The server normalizes and validates every row even though the browser performs
an earlier structural parsing pass. Existing behavior is preserved: duplicates
are not re-created, and a non-empty incoming matriculation number can update
the existing invitation.

### Delete mutation

`deletePendingAssessmentParticipantInvitation(courseId, invitationId)` deletes
only when the invitation belongs to the course and has status `PENDING`. A
missing, cross-course, or accepted invitation returns a typed GraphQL error and
does not mutate data.

## UI design

The dedicated page lives at
`/courses/[id]/assessment/invitations` and is reached from the course header's
labelled overflow menu so the existing primary assessment-results action stays
prominent.

### CSV import

- The file picker accepts `.csv` files and has a stable `data-cy` hook.
- Required header: `email`.
- Required header: `matriculationNumber` (common normalized aliases are also
  accepted).
- Parsing happens in the browser; the original file is not uploaded or stored.
- UTF-8 BOMs, quoted fields, empty lines, and whitespace are handled.
- The preview shows the file name and parsed row count.
- Rows are submitted to the existing server-side normalization and validation
  service so its per-row contract remains authoritative.
- The import button remains hidden when no rows were parsed and is disabled
  while a request is active.
- The result summary distinguishes created, accepted, duplicate, and failed
  rows. The invitation query is refreshed after a successful request.

Partial success is intentional: one bad or duplicate row does not discard other
valid invitations. Server-side failures remain visible in the result summary.

### Invitation table

The table has columns for email, matriculation number, status, invited date, and
actions. Pending and accepted statuses use text labels in addition to color.
Only pending rows show the delete action. Deletion requires a confirmation
dialog, then refreshes the list and reports success or failure.

The page has explicit loading, empty, malformed-file, row-validation,
unauthorized/not-found, query-error, import-error, and delete-error states. All
new interactive elements receive `data-cy` hooks and all visible strings exist
in English and German.

## Error contract

New service errors use `GraphQLError` with stable extension codes for:

- course not found
- course not assessment-enabled
- invitation not found or not part of the course
- invitation not pending

Per-row email validation failures remain import results rather than aborting the
whole mutation. Unexpected database errors surface through the existing GraphQL
error handling and a generic localized toast in the UI.

## Gamification and asynchronous impact

None. Invitation management awards no points or XP, touches no leaderboard, and
does not schedule or publish Hatchet work.

## Test and verification evidence

- Focused GraphQL service tests cover list ordering, pending creation,
  auto-acceptance, duplicates and matriculation updates, partial validation
  errors, pending deletion, accepted-deletion rejection, course scoping, and
  assessment restriction. GraphQL fields compose the repository's established
  authentication and course-`ADMIN` permission wrappers.
- Browser verification covers comma/semicolon delimiters, missing headers,
  invalid email rows, partial success, and pending deletion; the parser also
  handles BOMs, quoted values, escaped quotes, and blank lines.
- Browser verification also covers the assessment-only navigation entry, CSV
  preview, pending/accepted table states, malformed-file feedback, desktop and
  mobile layouts, and both locales. Screenshots remain local because the seeded
  course displays participant addresses and the repository is public.
- Run GraphQL codegen, relevant package tests/checks, `pnpm run check:all`, and
  `pnpm run build`. Record any environment or CI-only gaps exactly.

## Implementation slices

1. Add the manager-authorized invitation list/import/delete GraphQL surface,
   reuse the existing creation rules, add service tests, and commit generated
   artifacts.
2. Add the dedicated manage page, local CSV parsing/preview, invitation table,
   deletion confirmation, header navigation, i18n strings, and stable test
   hooks.
3. Add focused browser coverage where practical, update the engineering wiki
   and relevant skill guidance, run the complete verification loop, and attach
   evidence to one cohesive draft PR targeting `v3`.

## Progress

- **2026-08-14:** Traced the existing invitation model, creation service, import
  script, assessment course UI, GraphQL conventions, and verification path.
- **2026-08-14:** User selected browser-side CSV parsing with typed GraphQL input
  and approved the dedicated assessment invitation page design.
- **2026-08-14:** User approved this written specification and requested inline
  execution. Context7 was unavailable, so current primary documentation for
  Pothos, Apollo Client, and Next.js was used as the implementation reference.
- **2026-08-14:** Implemented the invitation service and API, the dedicated
  lecturer page, dependency-free event-time CSV parsing, localized table and
  pending-only deletion flow, generated operations, service and Playwright
  coverage, wiki updates, and local browser evidence.
- **2026-08-14:** The 7-case service suite, package checks, `pnpm run check:all`,
  production build, GraphQL codegen, Playwright discovery, and focused OpenGrep
  scan pass. The focused Playwright runtime is environment-blocked because the
  DevPod lacks Chromium system libraries; the same flow was verified manually
  in the routed application across English, German, desktop, and mobile states.
  Screenshots containing seeded participant addresses remain outside the public
  repository in accordance with its data-hygiene rules.

## Implementation plan

### Task 1: Invitation service contract and tests

**Files**

- Create `packages/graphql/test/participantInvitations.test.ts`.
- Modify `packages/graphql/src/services/participantInvitations.ts`.

**Interfaces**

```ts
export async function getAssessmentParticipantInvitations(
  args: { courseId: string },
  ctx: ContextWithUser
): Promise<ParticipantInvitation[]>

export async function createAssessmentParticipantInvitations(
  args: {
    courseId: string
    invitations: CreateParticipantInvitationInput[]
  },
  ctx: ContextWithUser
): Promise<CreateInvitationsResponse>

export async function deletePendingAssessmentParticipantInvitation(
  args: { courseId: string; invitationId: number },
  ctx: ContextWithUser
): Promise<ParticipantInvitation>
```

- [x] Add a database-backed fixture with an assessment SSO course owned by the
      authenticated test lecturer, a pending invitation, an accepted invitation,
      and a verified participant account.
- [x] Write failing tests for newest-first listing, pending creation,
      auto-acceptance, duplicate matriculation updates, partial invalid-email
      results, non-assessment rejection, cross-course deletion rejection,
      pending deletion, and accepted-deletion rejection.
- [x] Run the focused invitation service suite against an isolated local test
      database and confirm the new service behavior.
- [x] Add a shared assessment-course guard that throws `GraphQLError` with
      `ASSESSMENT_COURSE_NOT_FOUND` or `COURSE_NOT_ASSESSMENT`, then implement
      the three service functions above using `ctx.prisma` for list/delete and
      the existing creation behavior for import.
- [x] Run the focused test command and confirm all invitation service cases pass.
- [x] Commit the service and test files with
      `feat(graphql): manage assessment participant invitations`.

### Task 2: Authorized GraphQL fields and generated operations

**Files**

- Create `packages/graphql/src/schema/participantInvitation.ts`.
- Modify `packages/graphql/src/index.ts`.
- Modify `packages/graphql/src/schema/query.ts`.
- Modify `packages/graphql/src/schema/mutation.ts`.
- Create
  `packages/graphql/src/graphql/ops/QGetAssessmentParticipantInvitations.graphql`.
- Create
  `packages/graphql/src/graphql/ops/MCreateAssessmentParticipantInvitations.graphql`.
- Create
  `packages/graphql/src/graphql/ops/MDeletePendingAssessmentParticipantInvitation.graphql`.
- Regenerate `packages/graphql/src/ops.ts`,
  `packages/graphql/src/ops.schema.json`, and files under
  `packages/graphql/src/public/`.

**GraphQL contract**

```graphql
assessmentParticipantInvitations(
  courseId: String!
  numEntries: Int!
  offset: Int!
): AssessmentParticipantInvitationPage

createAssessmentParticipantInvitations(
  courseId: String!
  invitations: [AssessmentParticipantInvitationInput!]!
): CreateAssessmentParticipantInvitationsPayload

deletePendingAssessmentParticipantInvitation(
  courseId: String!
  invitationId: Int!
): AssessmentParticipantInvitation
```

- [x] Define the invitation object, `InvitationStatus` enum, import input,
      per-row result status enum, result object, and import payload with Pothos
      refs in `participantInvitation.ts`.
- [x] Import the type module from `src/index.ts`, expose the query, and expose
      both mutations with `t.withAuth(asUserFullAccess)` and `withPermission(...,
      DB.PermissionLevel.ADMIN, ...)`.
- [x] Keep every resolver a one-line service delegation and validate that the
      import list contains at least one item.
- [x] Add the three client operations with the exact fields needed by the page.
- [x] Run `pnpm --filter @klicker-uzh/graphql generate` and confirm all tracked
      generated artifacts are updated.
- [x] Use the established `withPermission(..., PermissionLevel.ADMIN)` wrapper
      on every field and `asUserFullAccess` on mutations; focused tests exercise
      service scoping while existing permission-wrapper coverage remains
      authoritative.
- [x] Run the focused GraphQL tests and
      `pnpm --filter @klicker-uzh/graphql check`.
- [x] Commit schema, operations, generated artifacts, and tests with
      `feat(graphql): add assessment invitation API`.

### Task 3: CSV parser and lecturer management page

**Files**

- Create
  `apps/frontend-manage/src/components/courses/participantInvitations/ParticipantInvitationCsvUpload.tsx`.
- Create
  `apps/frontend-manage/src/components/courses/participantInvitations/ParticipantInvitationsTable.tsx`.
- Create
  `apps/frontend-manage/src/pages/courses/[id]/assessment/invitations.tsx`.
- Modify
  `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`.
- Modify `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts`.

- [x] Implement a dependency-free browser parser inside the upload component.
      It supports comma and semicolon delimiters, BOMs, quoted and escaped
      fields, blank lines, and explicit malformed-quote errors; reject missing
      required headers before building the preview.
- [x] Build an import card with `.csv` file input, exact header guidance,
      selected-file summary, and a guarded import button. Keep parsing and
      submission in event handlers and show the per-status mutation summary
      after refetching the active invitation query.
- [x] Build a responsive invitation table with email, matriculation number,
      localized status, invited date, and an action only on pending rows. Status
      remains understandable without color.
- [x] Build the confirmation modal around the generated delete operation with
      `awaitRefetchQueries: true`, localized success/error feedback, and stable
      `data-cy` hooks.
- [x] Compose the dedicated page with the existing static i18n props/path
      pattern, loading/error/empty states, page title, import card, and table.
- [x] Add the assessment-manager-only overflow item
      `assessment-course-participant-invitations` using a user-plus icon and
      route it to `/courses/${course.id}/assessment/invitations`.
- [x] Add all invitation strings under `manage.assessment` in both locale files.
- [x] Run `pnpm --filter @klicker-uzh/frontend-manage check` and
      `pnpm --filter @klicker-uzh/frontend-manage lint`.
- [x] Commit the page, components, and i18n with
      `feat(manage): add assessment invitation UI`.

### Task 4: End-to-end verification and durable documentation

**Files**

- Modify `playwright/tests/N-course.spec.ts` when the existing assessment course
  fixture can cover the flow without new seed data.
- Modify `docs/domain-model.md`.
- Modify `.agents/skills/klicker-frontend-ui/SKILL.md`.
- Create `docs/log/2026-08-14-assessment-participant-invitations.md`.
- Update this plan's Progress section and move it to
  `project/plans_archive/PLAN-assessment-participant-invitations.md` when complete.

- [x] Add a Playwright flow that creates an assessment course, opens the new
      overflow item, imports an in-memory CSV containing one pending invitation
      and one malformed row, checks the summary/table, deletes the pending row,
      and removes the temporary course in `finally`.
- [x] Document that assessment access is invitation-backed, imports can
      auto-accept verified accounts, invitation records contain PII, and only
      pending invitations can be deleted by course admins.
- [x] Add frontend workflow guidance for local CSV parsing and preserving
      row-level backend failures.
- [x] Format the wiki with Prettier. The external
      `~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh` helper is not
      installed in this environment; repository documentation and agent checks
      pass through `pnpm run check:all`.
- [x] Use `devrouter ensure .`, open the real manage app with
      `npx agent-browser@0.32.2`, log in through delegated access, and verify
      navigation, valid/invalid preview, mixed import, pending deletion, and
      English/German rendering. Inspect desktop and mobile screenshots locally;
      do not publish screenshots that display seeded participant addresses.
- [x] Run the focused GraphQL test, Playwright typecheck/discovery, GraphQL
      codegen, `pnpm run check:all`, `pnpm run build`, and
      `opengrep scan --config auto`; the focused Playwright runtime is blocked by
      missing Chromium system libraries in the DevPod and is recorded above.
- [x] Review the complete branch diff and staged content for credentials and
      participant PII, commit the verification/docs changes, push the branch,
      and open one draft PR targeting `v3` with command and browser-verification
      evidence.
