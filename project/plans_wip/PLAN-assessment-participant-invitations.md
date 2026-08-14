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
  filtering, pagination, or CSV template download in the first iteration.
- No change to participant Edu-ID authentication or invitation acceptance.

## Domain vocabulary

- A `ParticipantInvitation` grants one email address access to one assessment
  `Course`.
- A `PENDING` invitation has not yet been linked to a `Participant`.
- An `ACCEPTED` invitation is linked to a verified participant and backs an
  active `Participation` in the course.
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

`assessmentParticipantInvitations(courseId)` returns invitations ordered by
newest `invitedAt` first. Each row exposes:

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
an earlier validation pass. Existing behavior is preserved: duplicates are not
re-created, and a non-empty incoming matriculation number can update the
existing invitation.

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
- Optional header: `matriculationNumber`.
- Parsing happens in the browser; the original file is not uploaded or stored.
- UTF-8 BOMs, quoted fields, empty lines, and whitespace are handled.
- The preview shows the file name and counts of valid and invalid rows.
- Invalid rows display their row number and reason and are not submitted.
- The import button submits only valid rows and remains disabled when none are
  valid or while a request is active.
- The result summary distinguishes created, accepted, duplicate, updated, and
  failed rows. The invitation query is refreshed after a successful request.

Partial success is intentional: one bad or duplicate row does not discard other
valid invitations. Server-side failures remain visible in the result summary.

### Invitation table

The table has columns for email, matriculation number, status, invited date,
accepted date, and actions. Pending and accepted statuses use text labels in
addition to color. Only pending rows show the delete action. Deletion requires a
confirmation dialog, then refreshes the list and reports success or failure.

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

- Focused GraphQL tests cover list ordering, pending creation, auto-acceptance,
  duplicates and matriculation updates, partial validation errors, pending
  deletion, accepted-deletion rejection, course scoping, assessment restriction,
  and manager authorization.
- CSV parsing tests cover BOMs, quoted values, blank lines, missing headers, and
  invalid email rows if the parser is extracted as pure logic.
- Browser verification covers the assessment-only navigation entry, CSV
  preview, mixed import result, pending/accepted table states, pending deletion,
  malformed-file feedback, empty state, and both locales. Screenshots are
  captured for the draft PR.
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
