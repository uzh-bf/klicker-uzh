# Learning analytics opt-out implementation plan

## Identity

- Status: approved plan; implementation in progress
- Plan: `project/2026-07-23-pr-5198-learning-analytics-opt-out-plan.md`
- Branch: `codex/learning-analytics-opt-out-plan`
- Target: `v3`
- Pull request: [#5198](https://github.com/uzh-bf/klicker-uzh/pull/5198)
- Active stack branch: `codex/la-opt-out-lecturer-control`
- Active stack target: `codex/learning-analytics-opt-out-plan`
- Active stack pull request:
  [#5242](https://github.com/uzh-bf/klicker-uzh/pull/5242)
- Change type: `feat`
- ADRs:
  - [ADR 0001](../docs/adr/0001-separate-course-and-participant-learning-analytics-controls.md)
  - [ADR 0002](../docs/adr/0002-deidentified-learning-analytics-output.md)

This plan and its implementation belong on the same draft pull request. Do not
merge the plan without the implementation and finish gates.

## Goal

Add optional, dedicated learning analytics (LA) with independent lecturer and
participant controls. A participant who is not LA-eligible must not contribute
to new LA calculations or appear in lecturer LA output. Normal teaching,
feedback, evaluation, grading, and gamification continue unchanged.

## Non-goals

- Research consent or research exports
- AI-processing consent
- New student-facing LA visualizations
- Moving the analytics engine to Hatchet
- Changing normal course exports, activity evaluation, or grading
- Claiming that de-identified lecturer rows are guaranteed anonymous

## Verified starting point

- `Course` has `areAnalyticsValid` but no LA enabled flag.
- `Participation` has no LA choice or disclosure state.
- `apps/analytics` loads participant responses without LA eligibility checks.
- `packages/graphql/src/services/analytics.ts` reads derived analytics and also
  aggregates some response and feedback data directly.
- Lecturer performance analytics exposes participant ID, username, and email.
- The current lecturer UI creates three client-side LA CSV downloads. The
  participant activity performance download includes identified participant
  data and bypasses a server-enforced export policy.
- Current privacy and terms text describes participant data as anonymized or
  aggregated, which does not match the identified performance table.
- GraphQL remains the live API. The dual GraphQL-to-tRPC migration is still open
  as [PR 5132](https://github.com/uzh-bf/klicker-uzh/pull/5132), so this branch
  must keep eligibility logic reusable outside Pothos resolvers.
- ClickUp is the backlog source of truth. The reviewed LA opt-out task,
  incremental analytics task, and separate research-consent task agree that the
  three controls must remain independent. Private ClickUp identifiers are not
  copied into this public repository.

## Product rules

### Course control

- New and existing courses start with LA disabled.
- A lecturer deliberately enables LA after seeing its benefits, data use, and
  responsibilities.
- A lecturer may disable and re-enable LA later.
- Disabling immediately hides LA, stops computation, and removes dedicated LA
  results. Operational course data stays intact.
- Course-level disabled periods do not exclude operational activity from later
  LA. Re-enabling may recompute permitted data using saved participant choices.
- Course toggles do not erase participant choices or disclosure versions.

### Participant choice

- Students see no LA choice while course LA is disabled.
- Students joining an LA-enabled course receive a neutral choice with neither
  option preselected.
- The explanation covers student and lecturer benefits, data used, lecturer
  visibility, and explicit exclusions.
- Automatic join paths that cannot ask first leave the participation undecided.
- When LA is enabled for an existing course, undecided students see the choice
  on their next entry into that course.
- Existing students may choose "decide later", continue using the course, and
  remain excluded while a course-level reminder stays visible.
- Students can change their choice at any time.
- First or renewed inclusion applies only to activity created from that point.
- Opt-out excludes all past and future activity from subsequent calculations
  and removes participant-level LA output immediately.
- A materially changed disclosure version suspends eligibility until the
  participant makes a new choice. If they choose inclusion, the effective
  inclusion time resets to that acknowledgement and activity from the
  intervening period remains excluded. Editorial changes do not advance the
  disclosure version or require another choice. Normal course access remains
  available.

### Lecturer output

- Dedicated LA outputs never expose participant IDs, usernames, email addresses,
  free text, stable pseudonyms, exact timestamps on student rows, item-level
  sequences, rare attributes, or cross-report links.
- Student rows use report-local labels such as "Student 1".
- Row-level output and every filtered breakdown require an effective sample size
  of at least five.
- Each aggregate or data point shows its effective sample size after eligibility,
  coverage, and metric-specific inclusion rules.
- Lecturers do not see opt-out counts, undecided counts, choice status, or reasons.
- Dashboards include eligible partial coverage by default.
- LA exports default to complete coverage for the selected period and offer an
  explicit option to include partial coverage.
- Existing aggregates are not recalculated solely because one student opts out.
  They are replaced on the next normal calculation.

## Data contract

Use names consistent with the existing `Course`, `Participant`, and
`Participation` domain:

- `Course.isLearningAnalyticsEnabled Boolean @default(false)`
- `LearningAnalyticsParticipationStatus` with `UNDECIDED`, `INCLUDED`, and
  `EXCLUDED`
- `Participation.learningAnalyticsStatus LearningAnalyticsParticipationStatus @default(UNDECIDED)`
- `Participation.learningAnalyticsIncludedFrom DateTime?`
- `Participation.learningAnalyticsChoiceAt DateTime?`
- `Participation.learningAnalyticsDisclosureVersion String?`
- An append-only choice event containing only the participation, choice,
  effective time, and disclosure version

The current fields serve frequent eligibility checks. The event record provides
the minimal audit trail required to explain the active choice without copying
activity or identity data.

The shared eligibility rule is:

1. Course LA is enabled.
2. Participation status is `INCLUDED`.
3. The stored disclosure version is current.
4. The activity timestamp is on or after `learningAnalyticsIncludedFrom`.

A course toggle never changes `learningAnalyticsIncludedFrom`. Participant
opt-out clears current eligibility. Participant opt-in and inclusion after a
material disclosure change set a new inclusion time.

## Authorization

- Course enable/disable: authenticated lecturer with course `ADMIN` permission.
  Disabling deletes derived data and should not be available to ordinary editors.
- Read course LA: existing lecturer `READ` permission plus enabled-course gate.
- Read/change own LA choice: authenticated participant with a `Participation` for
  that course.
- Server-side computation and export: the same central eligibility contract;
  client input can narrow coverage but cannot bypass eligibility or suppression.

## Research

Before implementation:

- Inventory every derived analytics model and every direct response/feedback
  aggregation. Treat a path as in scope if it contributes to dedicated LA.
- Measure derived-row counts per model in staging or production using aggregate
  counts only. Do not retrieve participant identifiers or response content.
- Decide from those counts whether course deletion can fit a bounded synchronous
  transaction. If not, use an idempotent Hatchet cleanup with a visible pending
  state and retry support. Product behavior remains immediate hiding either way.
- Confirm how analytics scripts are scheduled in each environment. The current
  repository contains scripts and images but no documented runtime schedule.
- Confirm the LA export file format with the product owner. Default plan: UTF-8
  CSV with one metadata section and one de-identified row table.
- Send the German privacy notice, German terms, participant disclosure, and
  lecturer explanation to UZH data-protection/legal review. English remains an
  informational translation.

Findings from 2026-07-29:

- Dedicated persistence spans the analytics models in
  `packages/prisma/src/prisma/schema/analytics.prisma`. All eight Python
  pipelines write or derive those results, while four GraphQL analytics queries
  expose them to lecturer dashboards.
- Two GraphQL analytics paths also aggregate operational response details and
  feedback directly. Deleting derived rows alone therefore cannot enforce
  opt-out or course disablement.
- Three lecturer dashboards generate CSV files client-side. The identified
  participant activity performance CSV is the highest-priority export privacy
  gap and must be replaced by the server-side export in Slice 5.
- Current cumulative `QuestionResponse` attempt counters cannot partition
  activity before and after renewed inclusion. Attempt-sensitive LA in Slice 4
  must be rebuilt from eligible `QuestionResponseDetail` rows.
- `ParticipantActivityPerformance` has no direct `courseId`; course cleanup must
  reach it through its practice-quiz or microlearning relation.
- The repository contains manual analytics initializer scripts and image builds,
  but no documented runtime schedule. Deployment scheduling remains an
  environment-level unknown.
- Slice 1 remains limited to the eligibility state, migration, schema mirror,
  and pure scalar eligibility helper. Query gates, cleanup, Python filtering,
  exports, and UI remain in later slices.

## Slice 1: Establish the eligibility state

Problem:
LA has no enforceable course or participant state.

Do:

- Add the course flag, participant status, effective time, disclosure version,
  and minimal choice-event model in the appropriate Prisma schema files.
- Create the migration. Existing courses remain disabled and participations
  remain undecided.
- Run the schema mirror and generated-client ritual.
- Add a pure shared eligibility helper and table-driven tests covering course
  toggles, late inclusion, opt-out, renewed inclusion, and disclosure mismatch.
- Update dev and Playwright fixtures only where a stable LA-enabled course is
  needed. Prefer setup through public mutations over more seed data.

Likely files:

- `packages/prisma/src/prisma/schema/course.prisma`
- `packages/prisma/src/prisma/schema/participant.prisma`
- `packages/prisma/src/prisma/schema/migrations/`
- `apps/analytics/prisma/schema/` through `pnpm run prisma:sync`
- `packages/util/src/learningAnalytics.ts`
- `packages/util/test/learningAnalytics.test.ts`

Check:

- `pnpm run prisma:sync`
- `pnpm --filter @klicker-uzh/prisma generate`
- `pnpm --filter @klicker-uzh/util test`
- `pnpm --filter @klicker-uzh/util check`
- `pnpm --filter @klicker-uzh/prisma check`

Commit:
`feat(analytics): add course and participant eligibility state`

## Slice 2: Add lecturer course control

Problem:
Lecturers cannot deliberately activate or stop LA.

Do:

- Extend course creation and settings operations with the default-off flag.
- Add explicit enable/disable service methods with `ADMIN` permission.
- Gate every LA query before reading derived or operational data.
- On disable, make LA inaccessible first and physically delete all dedicated
  course-level and participant-level analytics. Keep responses, feedback,
  grades, points, XP, and other operational state.
- Make cleanup idempotent. If research shows that synchronous deletion is not
  bounded, add the smallest tracked Hatchet cleanup workflow and retry state.
- Add the Manage creation/settings UI, explanation, confirmation, and disabled
  analytics state in English and German.
- Keep `NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED` false outside synthetic
  development until participant eligibility, computation filtering,
  de-identification, suppression, and legal approval are complete. The backend
  and UI must both fail closed while this release gate is off.

Likely files:

- `packages/graphql/src/services/courses.ts`
- `packages/graphql/src/services/analytics.ts`
- `packages/graphql/src/schema/mutation.ts`
- `packages/graphql/src/schema/query.ts`
- `packages/graphql/src/graphql/ops/`
- `packages/types/` where shared response types change
- `apps/frontend-manage/src/components/courses/`
- `apps/frontend-manage/src/pages/analytics/`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- Hatchet packages only if bounded synchronous deletion is rejected

Check:

- GraphQL tests prove authorization, default-off creation, immediate read denial,
  idempotent deletion, preserved operational data, and saved participant choices.
- Generate and commit GraphQL artifacts.
- Browser verification covers create disabled, create enabled, disable warning,
  disabled analytics, and re-enable in both locales.

Commit:
`feat(analytics): add lecturer course control`

## Slice 3: Add the participant choice lifecycle

Problem:
Students have no neutral course-specific LA choice.

Do:

- Add participant query/mutation fields for current choice and updates.
- Keep the disclosure version in one server-owned constant.
- Extend interactive PIN/account join flows to collect a required neutral choice
  when the course already has LA enabled.
- Leave LTI, invitation, and other automatic participation creation undecided
  until the next course entry.
- Add the non-blocking first-entry prompt, "decide later" reminder, and a
  course-level setting for changing the choice.
- On opt-out, hide and delete all participant-level derived LA records
  immediately without recomputing aggregate records.
- On renewed opt-in, set a new effective inclusion time. Never backfill activity
  excluded by the participant's previous choice.

Likely files:

- `packages/graphql/src/services/accounts.ts`
- `packages/graphql/src/services/courses.ts`
- `packages/graphql/src/services/analytics.ts`
- GraphQL schema and operations
- `apps/auth/src/lib/helpers.ts`
- `apps/frontend-pwa/src/pages/join.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/join.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`
- new PWA LA choice components
- English and German i18n
- Playwright setup/specs

Check:

- GraphQL tests cover every participation creation path and state transition.
- Playwright covers neutral choice, include, exclude, decide later, persistent
  reminder, later opt-out, renewed opt-in, and course off/on.
- Browser evidence includes desktop/mobile and both locales.

Commit:
`feat(analytics): add participant LA choice`

## Slice 4: Enforce eligibility in computation

Problem:
The Python analytics scripts and direct GraphQL aggregations currently use data
without LA eligibility filtering.

Do:

- Add one Python eligibility/coverage module mirrored from the shared contract.
- Apply it before every participant, activity, instance, course, and aggregate
  calculation.
- Filter by the current inclusion time, not by course-enabled intervals.
- Rebuild attempt-sensitive metrics from eligible `QuestionResponseDetail` rows;
  do not filter cumulative `QuestionResponse` counters that combine eligible and
  ineligible attempts.
- Prevent save functions from writing results for disabled courses or ineligible
  participants.
- Update direct GraphQL feedback, response-count, and performance aggregation to
  use the same rules.
- Record effective sample size on derived aggregates where the current model
  cannot provide it reliably.
- Add Python unit tests with the standard library test runner. Do not add a new
  testing dependency for this slice.

Likely files:

- `apps/analytics/src/modules/`
- `apps/analytics/src/scripts/`
- `apps/analytics/package.json`
- `packages/prisma/src/prisma/schema/analytics.prisma` if effective N needs
  persisted fields
- `packages/graphql/src/services/analytics.ts`

Check:

- Python unit tests cover disabled courses, undecided/excluded participants,
  effective times, partial coverage, and course disable/re-enable.
- GraphQL integration tests prove excluded activity cannot enter direct
  aggregations.
- Analytics lint and format checks pass.

Commit:
`feat(analytics): enforce participant eligibility in computation`

## Slice 5: De-identify lecturer LA and add export

Problem:
The lecturer performance table exposes participant identifiers, and no dedicated
LA export enforces coverage or suppression.

Do:

- Remove participant ID, username, and email from LA GraphQL types and operations.
- Generate report-local student labels server-side using fresh randomized order
  per report/export.
- Restrict row-level fields to approved coarse metrics.
- Centralize effective-N calculation and suppression after all filters.
- Show the effective N for each chart point, aggregate, and filtered table.
- Do not expose excluded or undecided counts.
- Add a dedicated LA export using the same query service and suppression policy.
- Default export coverage to complete for the selected period; allow explicit
  partial coverage. Mark included rows as complete or partial without revealing
  exact choice times.
- Exclude free text and any field that enables stable or item-level linking.

Likely files:

- `packages/types/src/index.ts`
- `packages/graphql/src/schema/analytics.ts`
- `packages/graphql/src/services/analytics.ts`
- GraphQL operations and generated artifacts
- an LA-specific export module
- `apps/frontend-manage/src/components/analytics/`
- `apps/frontend-manage/src/pages/analytics/`
- English and German i18n

Check:

- Tests prove report labels change across requests, no identifier field survives,
  N below five suppresses output, and post-filter N is enforced.
- Export tests cover complete/partial filtering, suppression, metadata, encoding,
  and absence of identifiers/free text.
- Browser evidence covers N display, partial coverage, suppressed state, and
  export controls.

Commit:
`feat(analytics): de-identify lecturer output and export`

## Slice 6: Roll out old-data cleanup and legal text

Problem:
Existing courses and derived rows predate the controls, while public and in-app
legal text does not describe the new behavior.

Do:

- Ship the default-off backend read gate before running physical cleanup.
- Implement cleanup under the safe mutation protocol: aggregate-only inventory,
  dry-run default, explicit write switch, before/after row counts, idempotency,
  and no raw participant or response exports.
- Remove all pre-feature dedicated LA rows and verify zero remaining by model.
- Keep operational records untouched and verify representative counts.
- Update the authoritative German privacy policy and terms.
- Update the English translations and in-app disclosure/explanation.
- State that LA participation is separate from research consent.
- State purposes, data categories, benefits, lecturer visibility, explicit
  exclusions, choice changes, derived-data deletion, aggregate refresh behavior,
  partial coverage, variable sample size, retention, and contact/rights paths.
- Prohibit re-identification and combining LA with other data to identify
  students.
- Obtain recorded UZH data-protection/legal approval before enabling LA.
- Update the engineering wiki and `docs/log.md`. Add an LA-impact question to
  `klicker-feature-design`; change other skills only if their procedure changes.

Likely files:

- safe cleanup script in the owning data package
- `apps/docs/docs/datenschutz.mdx`
- `apps/docs/docs/privacy_policy.mdx`
- `apps/docs/docs/nutzungsbedingungen.mdx`
- `apps/docs/docs/terms_of_service.mdx`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- `docs/domain-model.md`
- `docs/data-and-migrations.md`
- `docs/async-and-workers.md` if cleanup uses Hatchet
- `docs/testing.md`
- `docs/log.md`
- `.agents/skills/klicker-feature-design/SKILL.md`

Check:

- Cleanup dry run and write-mode tests use synthetic data only.
- Before/after aggregate counts prove dedicated LA removal and operational-data
  preservation.
- Docs production build passes.
- Wiki validation and formatting pass.
- Legal approval is linked or recorded without committing private correspondence.

Commit:
`docs(analytics): update LA privacy and rollout guidance`

## Finish gate

- Run `pnpm run check:all`.
- Run `pnpm run build`.
- Run targeted GraphQL, analytics, export, and migration tests.
- Run the new Playwright journey locally when the devcontainer is healthy; CI
  remains the full e2e gate.
- Use `npx agent-browser@0.32.2` against the branch-local devrouter routes.
- Capture lecturer and student screenshots at desktop/mobile widths in German
  and English.
- Run an architecture-level privacy/security threat model.
- Run an independent whole-branch review when collaboration policy permits.
- Run the strict maintainability review.
- Resolve or explicitly defer every finding.
- Update this Progress section and the draft PR from whole-branch evidence.
- Do not mark ready or merge without explicit user authority and passing CI.

## Expected PR evidence

- Migration and eligibility transition test output
- Aggregate-only cleanup before/after counts
- GraphQL and Python analytics test summaries
- Export privacy test summary
- Lecturer and student browser screenshots
- German and English legal-document build result
- UZH data-protection/legal approval status
- Security/privacy and maintainability review summaries

## Progress

- 2026-07-23: ClickUp, current code, public/in-app legal text, and relevant
  engineering wiki pages inspected.
- 2026-07-23: Product decisions locked in `CONTEXT.md` and ADRs 0001-0002.
- 2026-07-23: Implementation plan approved by the user.
- 2026-07-23: Approved plan and ADRs published in draft PR #5198.
- 2026-07-29: Greptile review findings accepted. The participation status field
  name is explicit, and renewed inclusion after a material disclosure change
  resets eligibility to the new acknowledgement time.
- 2026-07-29: Rebased onto current `v3`; the only conflict was the additive
  `docs/log.md` entry, and both branches' entries were preserved.
- 2026-07-29: Research inventoried all Python pipelines, derived models, direct
  GraphQL aggregations, lecturer consumers, and existing client-side exports.
- 2026-07-29: Slice 1 implemented. Migration
  `20260729175442_add_learning_analytics_eligibility` adds the default-off course
  flag, default-undecided participation state, inclusion/disclosure timestamps,
  and minimal choice-event history. The Analytics schema mirror is synchronized.
- 2026-07-29: The centralized scalar eligibility helper passed 11 boundary and
  lifecycle cases; all 57 utility tests, utility and Prisma typechecks, both
  package builds, schema-sync check, and migration-status check passed in the
  branch-local devcontainer. The repository-wide `check:all` gate also passed
  with the Analytics virtual environment pinned to Python 3.12.
- 2026-07-29: Independent correctness/privacy and simplification reviews of
  commit `216278d69` reported no findings. Choice mutations in Slice 3 must
  atomically update the current snapshot and append the event history.
- 2026-07-30: Branch-level Standards and Spec reviews found one current-state
  wiki wording issue, missing wiki source citations, and one explicit course
  re-enable lifecycle test. The wording and citations were corrected, and the
  centralized eligibility helper now passes 12 focused cases. The independent
  simplification review found no incidental complexity to remove.
- 2026-07-30: The user renewed execution authority and requested stacked GitHub
  PRs for later slices. PR #5198 remains the stack base for Research and Slice 1;
  each later slice targets the preceding slice branch for an isolated diff.
- 2026-07-30: Slice 2 implementation added the default-off creation control,
  ADMIN-only course toggle, immediate read denial, idempotent dedicated-data
  cleanup, and the English/German lecturer UI and disabled dashboard state.
  GraphQL generation, GraphQL and Manage typechecks, the GraphQL build, and all
  five focused course-control integration cases passed in the branch-local
  devcontainer.
- 2026-07-30: Spec/privacy review found that an independently deployed Slice 2
  could expose pre-enforcement identified analytics. The implementation now
  fails closed behind `NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED`; this
  deployment gate must remain false until the complete stack and legal approval
  are ready. Course toggles are serialized with a transaction-scoped advisory
  lock so disable and re-enable cannot interleave.
- 2026-07-30: Follow-up correctness/privacy review found no remaining code
  blocker after the fail-closed release gate and serialized cleanup changes.
  The cleanup fixture now covers every dedicated model class, both
  participant-activity relation paths, cascade-owned competency rows, and
  representative preserved operational state. Aggregate-only production sizing
  remains a release-gate prerequisite.
- 2026-07-30: Browser verification covered default-off creation, enable,
  confirmation cancellation, accepted disable, immediate overview hiding, and
  direct-URL denial in English and German. The repository-wide check completed
  every TypeScript and formatting gate; only the unchanged Analytics Python
  lint workspace could not install pandas because the container has no C
  compiler for its Python 3.14 source build. The full production build passed
  all 22 scheduled workspace builds.
- Current: Slice 2 verified and ready to publish from
  `codex/la-opt-out-lecturer-control`.
- 2026-07-30: Slice 2 published as draft PR #5242, stacked directly on PR
  #5198's branch. The rendered base/head metadata and draft state were verified;
  CI started with GitGuardian passing and repository checks queued.
- Current: Slice 2 is under review in draft PR #5242.
- 2026-07-30: Slice 3 implementation added the participant-only current-choice
  query and mutation, server-owned disclosure version, neutral interactive
  PIN/account join choice, first-entry prompt with decide-later reminder, and
  later course-level choice changes. Course-off API and PWA states hide the
  choice while preserving its history; opt-out removes participant-level
  dedicated analytics without touching existing aggregates or operational
  data; renewed inclusion starts at a new prospective boundary.
- 2026-07-30: Interactive joins, participant choice changes, and lecturer course
  toggles now share a transaction-scoped course advisory lock. The generic PIN
  page resolves the course before enrollment, and the course-specific join
  adopts the URL PIN and navigates directly to the joined course to avoid stale
  home-cache redirects.
- 2026-07-30: Five focused GraphQL integration cases passed in an isolated
  disposable database: enabled-course PIN and account gating, disabled-course
  undecided creation, opt-out deletion with preserved aggregates, course
  disable/re-enable preservation, no-op choice updates, renewed opt-in, and
  material disclosure renewal. GraphQL generation, GraphQL typecheck, and PWA
  typecheck passed.
- 2026-07-30: Browser verification covered English neutral first entry,
  decide-later reminder, include/exclude changes, immediate course-off hiding,
  saved choice after re-enable, enabled and disabled PIN/account joins, German
  disclosure, and 390x844 mobile action reachability. The verified browser
  sessions reported no application errors; screenshots are stored locally
  under `/private/tmp/la-opt-out-slice3/`.
- 2026-07-30: The repository-wide typecheck, formatting, and JavaScript lint
  gates passed. The Analytics lint also passed with its virtual environment
  pinned to Python 3.12, avoiding the container's unsupported Python 3.14
  pandas source build. All 22 production build tasks succeeded; Turborepo then
  emitted a post-run crash report despite exiting successfully, so the anomaly
  remains recorded as tooling evidence rather than a product failure.
- 2026-07-30: The isolated Slice 3 Standards, Spec, privacy, and simplification
  review found no remaining blocker after preserving self-only choice access,
  fail-closed course-off behavior, participant-scoped deletion, unchanged
  aggregates, and a new prospective boundary on renewed inclusion.
- Current: Slice 3 is implemented and locally verified on
  `codex/la-opt-out-participant-choice`.
- Next: Publish the draft PR stacked on
  `codex/la-opt-out-lecturer-control`, then begin the centralized computation
  eligibility slice.
