# V3 release readiness checkpoint

Final disposable lifecycle receipt: `devrouter stop` completed, freeing ten
routes. Fresh Devsy status reports `Stopped`, and the route inventory contains
zero exact workspace routes. Its database and worktree are retained. No command,
browser or reviewer remains running. The original manual runtime remains under
the user's existing verification lease, with its Auth recovery approval pending.

Latest local evidence: canonical full-profile startup with the disposable-only
Git-child wait returned ready, with healthy services, both managed processes
running, no drift and no container recreation. All eight authoring browser tests
passed in 46.7 seconds. All 148 tests in six focused GraphQL database suites
passed in 6.59 seconds. Integrated final review remains pending. The retained
manual runtime remains unchanged. Historical failures below explain the recovery
and must not be mistaken for the latest runtime state.

Package status is `delivery_pending`: the approved goal includes recovering the
retained manual runtime, whose delegated-login Auth route still lacks a passing
receipt. Archiving only its generated `apps/auth/.next` directory recoverably
and restarting it requires the outstanding cache-change approval. The integrated
final reviewer has not been dispatched because this required runtime gate is
unresolved. No additional feature implementation is currently indicated by the
passing focused checks.

Current source is not yet ready to tag. Finish and review the approved beta
discovery and chatbot-authoring gate package, preserve the deployed Chat
disclaimer fix, and verify the final integrated candidate. Tagging, publication
and deployment remain separate approvals. Backup rehearsals and a calendar
freeze are outside this preparation scope.

## Source snapshot

Remote refs were refreshed on September 6. The release worktree remains on
`rs/v3-release-verification` and includes discovery commit `19ea2de078`, tracking
`origin/v3`, three commits ahead and four behind. No upstream integration occurred. The active execution
contract is [the beta discovery and authoring plan](2026-09-05-v3-beta-authoring-gate-plan.md).

The Next.js 16.2.11 and next-auth 4.24.15 patches are already present in this
baseline. Older release-preparation notes saying these patches remain local are
historical, not the current delivery state.

## Database payload

Comparison of current `origin/v3` with the general production tag
`v3.4.0-alpha.73` contains five added migrations and no modified or deleted
historical migration SQL files. Chat-only `alpha.73.3` is not the database
baseline. The earlier four-migration report is stale.

| Migration | Effect and compatibility |
| --- | --- |
| `20260820151622_chatbot_lifecycle_and_ai_capability` | Adds chatbot publication status and owner capability fields. Existing bots are backfilled to PUBLISHED; subsequently created bots default to DRAFT. The SQL is transactional. |
| `20260822075407_chat_account_usage` | Adds owner/month/usage-class accounting with decimal credits and an owner foreign key. The table starts empty; the SQL is transactional. |
| `20260826012006_chat_turn_lifecycle_claim` | Adds lifecycle status and a nullable attempt identifier. Existing rows default to COMPLETED. The file has no explicit transaction wrapper. |
| `20260902100000_course_deletion_request` | Adds a nullable asynchronous course-deletion timestamp. Existing courses remain unmarked. |
| `20260903120000_chatbot_standard_mode_config` | Adds nullable JSONB configuration to Chatbot, without a backfill. Existing null values use the application's legacy-mode normalization. |

The fifth migration arrived with the already-merged
[lecturer authoring and model-policy package](https://github.com/uzh-bf/klicker-uzh/pull/5744).
The Prisma field is optional. Chat's effective-mode resolver explicitly defaults
its configuration argument to null, and its existing tests cover absent and
malformed typed configuration falling back to legacy flags. All 16 effective-mode
tests passed in a fresh run for this checkpoint. No new migration is needed for
the feature-flag cleanup.

This is source evidence, not a new production database read or migration run.
Earlier synthetic tests and historical generation-provenance caveats remain
separate. Apply the complete migration payload before running applications that
select the new fields; a disabled UI flag does not make missing columns safe.

## Release requirements

- Complete local verification and independent review of beta discovery and the
  fail-closed `ai-beta` authoring gate. `beta-signup` governs new enrollment;
  discovery remains visible and existing-member opt-out is preserved.
- Preserve [the deployed disclaimer dark-mode fix](https://github.com/uzh-bf/klicker-uzh/pull/5696).
  The PR is still open. Comparing `origin/v3` against `alpha.73.3` confirms that
  `disclaimer-modal.tsx` lacks its `primary` button prop. Do not duplicate the PR
  or replace the maintenance Chat image before integrating the fix.
- Once the local package passes, obtain the one-time upstream integration and
  publication approvals, verify material overlaps and affected checks, then
  complete exact-head CI and review. New optional feature PRs are not implied
  release requirements.
- Refresh the repository-native release dry-run on the final candidate. The
  earlier proposed version is `v3.4.0-alpha.74`; do not reuse that proposal as
  evidence that a tag or GitHub Release exists.
- After explicit release approval, verify the tag and required image builds.
  A release tag does not apply migrations or authorize production deployment.

## Local verification state

Devrouter 0.0.55 is installed. The exact retained runtime is
`rs-v3-production-release`, Compose project `default-rs-01df8`. Before repair,
all eight original containers were stopped and the workspace had zero routes.
The ignored cache-preservation marker is enabled. Guarded full-profile repair
started the original containers without bootstrap, database reset, recreation or
cache removal. The first readiness deadline expired during cold preparation;
a warm retry returned ready/full, no drift, and healthy service probes.

Fresh verification passed: all 35 serial repository check tasks; lint and the
remaining pre-commit policy checks; 83 chatbot authorization tests; 16 effective
mode tests; and two test-only feature-flag fixture tests. Staged formatting and
host secret/identity checks passed before the local discovery commit. The full
production build subsequently passed all 23 tasks in the isolated lane in
2 minutes 55.956 seconds, using the same feature source and frozen dependencies.

The initial non-destructive browser smoke run passed eight of nine tests. The first-login
fixture intercepted UserProfile but not the preloaded ManageUserProfile query.
The fixture now covers both operations; formatting, its typecheck and all nine
browser smoke tests pass (14.6 seconds). A separate real delegated-login check reached an Auth 404.
The committed API route exists but is absent from the dev pages manifest. One
canonical stop/restart returned ready/full with no recreation, but the direct
container Auth API still returned 404 despite its source file being present.
No cache removal occurred. Enabled-authoring isolation and final browser
acceptance remain pending; synthetic login fixtures do not prove delegated login.

Keep the adopted runtime source separate from the feature package's outstanding
edits. It already matches the merged
[dependency-preparation and cache-preservation fix](https://github.com/uzh-bf/klicker-uzh/pull/5790)
and must not be published as a duplicate implementation.

## Disposable verification lane

The separately approved test lane is
`trees/rs/v3-beta-verification-isolated`, branch
`rs/v3-beta-verification-isolated`, based on the same `2be0a2108f` head.
Its copied feature diff matches the retained release lane. Only its local
verification configuration pins Devrouter 0.0.55 and enforces a frozen bootstrap
installation; these are not changes to the release feature contract.

Its app container is `2ad1af0746c0`, and its Postgres container is
`664bc30d88aa`, under Compose project `default-rs-e05c3`. The new database uses
`default-rs-e05c3_pgdata`, distinct from retained
`default-rs-01df8_pgdata`. Bootstrap and manage-profile readiness passed.
Auth providers returned HTTP 200, and real delegated login succeeded. English
and German desktop/mobile browser checks verified visible beta information and
restricted enrollment. The changed section fits at 390 pixels; the pre-existing
global header overflows. The browser session is closed.

Enabled-authoring verification remains incomplete. Only
this disposable lane maps backend dev startup to its existing NODE_ENV=test
start:test command, which loads the reviewed synthetic GrowthBook fixture.
No provider key or live feature-flag change is used. The independent discovery
simplifier and slice reviewer completed without blocking findings. Integrated
final review remains pending runtime verification.
The retained Auth cache-rebuild request remains unanswered.

The first authoring run failed before reaching application assertions: two
tests encountered Bad Gateway and six serial tests did not run. The host
launcher's initial filtered install removed container-visible dependency links.
A frozen container install restored the links; subsequent readback confirmed
Next.js for Chat/Auth and NYC for the backend are present.

On the next continuation, no host test or lifecycle process remained running.
Devrouter reported a degraded process-start transition. Its prescribed
`ensure . --profile full --repair --json` completed dependency preparation
(nine cached tasks passed), then rejected startup with:
`Preparation for 'klicker-dev' left running children; a synchronous foreground command is required.`
The child-process cause is not yet established. This is a local lifecycle
blocker, not evidence of a production application defect. No additional
database reset, retained cache change, upstream integration or publication
occurred during this attempt.

The read-only child-process diagnostic could not launch: automatic permission
review timed out on both allowed attempts. Sending the evidence to the existing
Devsy Issues task also failed with `thread not found`, despite its presence in
the current task inventory. Delivery is not confirmed.

The non-destructive stop command completed successfully and freed ten routes.
Fresh source-path inventory and route readback confirm zero exact routes.
`devsy workspace status rs-v3-beta-verification-isolated --result-format json`
confirms provider state `Stopped`. The worktree and database were preserved.
The retained manual runtime is outside this stop operation.

## Subsequent preparation diagnosis

Fresh refs still leave the feature branch three commits ahead and four behind
`origin/v3`. Values-free instrumentation in the disposable preparation function
reproduced an orphaned, live Git process in the preparation process group after
Turbo reported success. A separate synchronous preparation probe identified
the command as `/usr/bin/git diff HEAD --no-ext-diff --no-color`. A later process
check found no remaining Git process. The installed helper ignores zombies but
rejects any live process in that group immediately after preparation returns.

The upstream Turborepo SCM implementation uses this command for dirty-worktree
hashing. This supports the observed transient-child explanation; it does not
prove that every preparation failure has the same cause.

Only the disposable lane now has a verification-only, five-second bounded wait
for live Git children in its own preparation process group. It fails if they
remain, leaves the helper's guard intact, and changes no application feature,
dependency, database schema or retained runtime. Canonical startup with that
wait could not launch after two automatic approval-review timeouts. Do not
publish this workaround or claim it works without producing-run evidence.

The focused database-test command also could not launch after both permitted
approval attempts; it did not reset the database. Following this new diagnosis,
both attempts to stop the resumed disposable runtime timed out in automatic
approval before launch. The earlier stopped receipt predates this reproduction
and is no longer current. Disposable runtime shutdown is now unverified and
must be completed first when command execution is restored. No command or
reviewer remains running, and the retained manual runtime was not modified.

## Completed runtime verification

The bounded preparation wait passed both direct canonical repair and the host
launcher's reconciliation. The host did not repeat the filtered dependency
installation. `T-chatbot-authoring.spec.ts` passed all eight tests: flag-off
denial before queries, pending creation controls, draft create/edit/preview/
reload, publication submission, paused preview, rejection/resubmission,
unauthorized draft preparation and incomplete-disclaimer rejection.

After browser completion, the focused GraphQL run used only the isolated
Compose database. Its safety guard initially rejected an incorrect expected
database name without resetting anything. Readback confirmed host `postgres`,
port 5432, database `klicker-prod`, matching the committed local Compose setup
and the already-proven isolated volume. With the corrected guard, Prisma reset
completed and all 148 tests passed across `manageChatbots`, `courseChatbots`,
`chatbotPublication`, `chatAccountUsage`, `betaEnrollment` and
`betaEnrollmentSchema`.

The shared integration helper hard-codes localhost Redis ports and emitted
connection-refused errors in this container. These suites passed their database
and API assertions, but this run is not evidence of Redis integration. No
production database, live flag, retained cache or application source was changed
for these producing runs. The disposable preparation wait is verification-only
and is not part of the release feature diff.
