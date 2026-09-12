# Assessment edu-ID identity for formal assessment participants

## Goal

Capture the approved SWITCH edu-ID given name, surname, and matriculation
number for assessment-course participants only. Make those values available in
assessment grade exports and the student's private percentile credential, while
showing only the full name on the public verification page.

## Non-goals

- Do not add assessment identity fields to the global `Participant` account.
- Do not display the values in the Manage UI table.
- Do not persist the approved affiliation attributes as part of assessment
  participation identity; existing affiliation-account handling remains their
  owner until a separate consumer needs them.
- Do not backfill historical participation rows from inferred or roster data.
- Do not push, open, merge, deploy, or change external edu-ID client
  configuration in this task.

## Execution contract

- **Authority:** Edit the task worktree, add migrations and code, run local
  checks, create local implementation artifacts, and create local commits for
  the implementation slices.
- **Withheld:** Push, create or update PRs, merge, deploy, run live migrations,
  and change secrets or external edu-ID configuration.
- **Terminal:** Leave the task worktree with the agreed implementation and
  fresh local verification, or stop at the first unavailable database/runtime
  gate with the exact command and handoff needed.
- **Pause:** Stop if the implementation requires a product decision not covered
  by the agreed design, a non-expandable migration, or access to a protected
  environment.

## Grill findings and resolved decisions

- Assessment identity is course-scoped on `Participation`, nullable for
  ordinary-course participation, and sourced from verified edu-ID claims.
- Invitation-roster matriculation remains a separate input. Exports retain
  both values so matching code can detect missing or conflicting data instead
  of silently overwriting one source.
- Missing edu-ID attributes do not block login. They remain null and appear as
  missing values in authorized assessment exports; credential issuance remains
  available with the values that were released.
- Assessment exports include identity fields as CSV data while the Manage table
  keeps them CSV-only. The standalone operator export includes the
  course-scoped identity and retains invitation data separately.
- Private credential downloads may include email, full name, and matriculation
  number. Public verification exposes only full name in its identity
  projection, never email or matriculation number.
- Existing credential snapshot versions remain parseable and immutable. New
  identity-bearing credentials use a forward snapshot version.
- Edu-ID approval is already granted for required email, unique ID, surname, and
  given name, plus desired matriculation number and linked-affiliation claims.
  This feature consumes only the fields named in the goal.

## Primitive impact

| Product primitive | Disposition | Contract delta | Consumers | Evidence |
| --- | --- | --- | --- | --- |
| Assessment participation | Extend | Owns nullable course-scoped edu-ID identity and its refresh on verified participant login | Assessment access, grade exports, private credential issuance | `Participation`, `Course.isAssessmentEnabled`, `apps/auth:createOrLinkParticipant` |
| Assessment credential | Extend | Private snapshot gains identity fields; public bearer projection is name-only | Student download, QR verification page | `VerifiableCredential`, `assessmentReports.ts`, `verification.ts` |
| Assessment result export | Extend | CSV-only identity columns are added without changing Manage table visibility | Manage result downloads, standalone operator export | `StudentAssessmentResultsItem`, `packages/export/src/participants.ts` |

## Research

- **SWITCH edu-ID claim contract:** Approved by the user. The repository
  already requests linked-affiliation claims in
  `apps/auth/src/pages/api/auth/[...nextauth].ts`; add the approved name and
  matriculation claims without expanding persistence to unrelated affiliation
  fields.
- **Existing credential compatibility:** Current V1 parsing and immutable
  snapshot hashing are in `packages/graphql/src/services/assessmentReports.ts`.
  Preserve V1 parsing and add V2 parsing plus a public projection.
- **Migration deployment:** Nullable additive fields are required because the
  assessment database may be separate; follow the repository migration ritual
  and report any environment-specific migration gap.

## Test portfolio

| Risk or behavior | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- |
| Non-assessment participation stays empty | add new | Prisma-backed auth/service test | Ordinary login writes assessment identity | foundation/auth |
| Approved claims populate assessment participation | extend existing | Auth participant persistence test | Edu-ID values are parsed but never stored, or stale values leak | auth |
| Roster and edu-ID values remain distinguishable | add new | Export transform/service test | Grade matching receives one silently overwritten matriculation number | exports |
| Manage data is CSV-only | add new | DataTable/GraphQL contract plus browser check if runtime is available | Sensitive identity appears in the Manage table | exports |
| V1 remains parseable and V2 hashes/reissues correctly | extend existing | `assessmentReports.test.ts` | Existing snapshots fail or mutable identity changes the hash contract | credentials |
| Public verification never returns direct identifiers | add new | GraphQL verification service/schema test | Bearer token exposes email or matriculation number | credentials |

## Planned slices

1. **Foundation — course-scoped identity fields.** Add nullable fields to
   `Participation`, keep invitation matriculation unchanged, add normalization
   helpers/types, generate the additive migration, and sync the Analytics
   schema. **Route:** main, because schema/data-integrity work is on the critical
   path. **Acceptance:** Prisma schema/client checks and migration diff show only
   nullable additive changes.
2. **Edu-ID assessment persistence.** Request and type the approved given name,
   surname, and matriculation claims. After invitation auto-acceptance, refresh
   only assessment-course participations for that participant. **Route:** main,
   because this crosses an authentication and personal-data boundary.
   **Acceptance:** auth/service tests prove assessment-only writes, null/missing
   handling, and refresh behavior.
3. **Assessment exports.** Extend result types/services and GraphQL operations;
   add CSV-only columns to Manage result downloads; add course-scoped identity
   columns to the standalone participant export while keeping invitation data
   separate. **Route:** main, because GraphQL codegen and export privacy are
   coupled. **Acceptance:** generated artifacts are current, targeted GraphQL
   and export tests pass, and no new Manage-visible columns are introduced.
4. **Private and public credentials.** Add V2 snapshot validation/building,
   preserve V1 parsing, expose the complete private subject to the student
   download, project only full name from public verification, and update the
   localized credential/verification rendering. **Route:** main, because the
   immutable credential and bearer-token boundary need one owner. **Acceptance:**
   assessment-report tests, GraphQL verification tests, and browser evidence if
   a local runtime is available.

## Delivery topology

The repository's GitHub stacked-PR capability is enabled. The intended review
order is foundation → auth → exports → credentials, with each layer depending
only on the layer below it. No stack branches, pushes, or PRs are created under
this task's withheld delivery authority.

## Progress

- **Current status:** Implementation complete in the task worktree; no push, PR,
  merge, deployment, live migration, or external edu-ID change was performed.
- **Completed:** Nullable assessment-only persistence and migration, approved
  edu-ID claim handling, participant and assessment-result exports, CSV-only
  Manage columns, V2 private credential snapshots, name-only public projection,
  localized private/public rendering, generated GraphQL artifacts, and focused
  regression tests.
- **Verification evidence:** GraphQL check passed; focused credential and
  verification tests passed (38 tests); auth check passed with existing
  next-intl and Node deprecation warnings; export check and tests passed (22
  tests); PWA and Manage checks passed with the same existing warnings; the
  local verification route rendered successfully in agent-browser.
- **Remaining:** Create the local implementation commit, then run the required
  read-only simplifier/slice review and final package review on that immutable
  range. Push and delivery remain withheld by this plan.
- **Latest evidence:** Task branch `rs/assessment-eduid-identity` is at
  `origin/v3` with zero ahead/behind divergence as of 2026-08-20.
- **Slice review:** pending the local implementation commit; the required
  read-only slice review is scoped to that immutable range.
