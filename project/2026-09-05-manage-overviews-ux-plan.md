# Manage course and activity clarity — execution plan
Plan path: project/2026-09-05-manage-overviews-ux-plan.md (initially prepared in trees/ux-review-question-library; transferred with the review and close-out into trees/manage-overviews-ux after approval).

## Research
Goal: apply the 2026-09-05 Manage UX review as a new native GitHub stack, preserving the merged library experience. The supplied screenshots are inspiration, not current-state acceptance.
Evidence: origin/v3 at fbc5f4fcc2ffa1c8d25695679823134985c5a8d8. Browser review covered library, live-quiz introduction, course overview/details at 1024x768 and 1440x900 in English. One element, three courses, no activities: populated activity row/detail proposals need a task-owned synthetic fixture before code. Source/test mapping is local; external research is not needed for this existing UI change.
Existing review: project/2026-09-05-manage-overviews-ux-review.md in the historical ux-review-question-library worktree.
Primary checkout v3 tracks origin/v3, 0 ahead/8 behind and dirty; historical task branch rs/question-library-status-empty-state has no upstream, 130 ahead/56 behind, with untracked review. Neither is an implementation baseline.
## Execution contract
Owner/boundary owner: this main session/self; full-path progressive execution after one topology approval. Main owns integration, product choices, verification and GitHub topology. Executors own bounded disjoint implementation subsets; no child publication/delegation.
Authority proposed by this plan's approval: create ONE new repo-local worktree trees/manage-overviews-ux from pinned origin/v3, create named native stack branches; local scoped edits, synthetic test fixtures only in its own runtime, repository checks, local commits, required reviews, normal non-destructive branch publication and DRAFT PR creation/update to origin. No old branch replay or pull into primary; no protected-branch mutation, merge, ready-for-review transition, forced update of published history, deletion, deployment, production/secret data, tour work or infrastructure changes. If stack tools require a published non-fast-forward update, ask first. Inter-layer local propagation is allowed after checkpoint; new upstream integration remains separately gated.
Terminal: all three independent layer tips verified, required reviews resolved, draft PR stack published with current per-layer CI readback and full evidence; then one decision to mark ready. If CI genuinely fails in relevant scope, resolve before terminal; report an unrelated base failure without bypass. Runtime stopped and exact route/provider readback recorded unless user requests an explicit keep-running lease.
Pause: topology/design/risk expansion, unavailable required environment or reviewer, external action beyond named authority, unresolved conflict/ownership. Routine slice boundaries do not pause.
## Primitive impact
Course: reuse existing user-owned container and permission, archive, deletion-request, removal, joining and leaderboard rules. Only presentation changes; no data migration.
Activity and publication status: reuse four activity types and current allowed lifecycle actions. Search feedback and layout do not redefine statuses or visibility.
Element instances/blocks/stacks/comments: reuse immutable instance preview and existing comments scope. No edit-to-source propagation, comment scope change or persistence model.
ADR: none; reversible UI presentation, no new domain or architectural decision. Re-arm on lifecycle, permission, persistence or API changes.
## Stack topology
Provider GitHub, target v3, native stacks verified available. One new worktree; historical worktrees retained. All layers complete, not feature-flagged, independently green, tests travel with owning behavior. A single UI story: find a course, find/inspect its activities, create one without excess instructional text.
Bottom rs/manage-course-clarity (v3): course overview navigation and course-detail readability; course-management maintainer; judgment-heavy; medium UI risk; estimate 350-550 human lines/10-14 files, no generated. Above 400 is still one package because empty activity tabs, metadata and row actions complete the same course inspection journey; no backend change.
Middle rs/manage-activity-clarity (course layer): activity overview feedback plus compact accessible inspection; activity-workflow maintainer; judgment-heavy; medium UI risk; estimate 350-550 lines/9-13 files, no generated. Above 400 remains one package because search/recovery and resulting activity inspection share one list-detail acceptance journey; no shared abstraction layer.
Top rs/manage-wizard-guidance (activity layer): concise intro/help across four activity types; instructional-copy/localization reviewer; mechanical except human copy acceptance; low risk; estimate 100-200 lines/6-9 files, no generated.
Follow-up guard: wizard intro refines the recently merged activity-guidance surface; no existing draft owns it. Record this boundary miss in this plan and package, not another standalone PR or memory mutation. Course/activity overview issues were pre-existing outside prior library scope.
## Frozen design
Course layer: every metadata value gets an explicit cell with localized fallback for missing email; preserve labels/value association. Course title is a semantic link with sibling named comments/More actions controls. Archive/delete/remove in menu preserve all existing permission/disabled-reason/confirmation rules; no extra live mutations. Keep dates/badges visible.
Use neutral empty messages in all four course activity tabs; offer an accurately labeled Library navigation action, not a promise to preselect a course. Do not introduce a course-prefill URL/API contract. Preserve relevant QR/LTI/calendar access. Read-only users get truthful empty copy and no implied write permission.
Shorten leaderboard permanent explanation to one sentence; export help by CSV control, inclusion rule accessible in contextual help. Keep course title/join controls, participants, description and course metadata visible; avoid collapsing the entire Course information section in this first pass. At smaller desktops stack activity/leaderboard content when necessary; no phone support target.
Activity layer: 300ms search debounce, Enter remains immediate, clear cancels stale pending search. Distinguish loading, genuine first-use, no search matches, filtered-empty and query failure. Retry retains query/filter/sort; no stale results falsely represented as current. State precedence is query error first; then loading for the current applied variables; then populated current results; otherwise active-search no-match, filtered-empty, and genuine first-use. Combined search+filters exposes both independently scoped recovery actions. Require latest-query-wins: a delayed older response or pending debounce cannot overwrite cleared/current search, results, selection or pagination. Keep selection/batch actions scoped to valid visible results and disable batch actions while current results are unavailable. Named sort direction and semantic keyboard-open/rename controls.
Before changing density, inspect synthetic populated draft/scheduled/ended and read-only activities with long titles, blocks/stacks and comments. Use compact title/status/count summary; omit a new course label from the activity row because this plan does not extend ActivityInfo or the GraphQL query. Keep required lifecycle dates readable. Details title includes activity name; explicit Preview/Comments views reuse existing components and selected-instance/comment-scope semantics, with a clear selection prompt before an instance is chosen. No drawer redesign, automatic mutation or hidden lifecycle actions. If evidence contradicts these bounded choices, pause for design rather than silently omit the improvement.
Wizard layer: one short permanent use-case sentence plus existing name input; existing supporting documentation in keyboard-accessible Help disclosure. Essential validation and required constraints remain visible. Preserve all four wizard types, autosave/recovery/cancel semantics and stable secondary Create Element above sidebar while editing. No new onboarding/tour behavior.
## Test portfolio and acceptance
Course: adapt affected course archive/delete/removal locators to the new menu while preserving their existing permission and confirmation assertions. Extend playwright/tests/N-course.spec.ts at course overview/editing coverage (around 2182/2204); existing archive/delete and READ/EXECUTE/WRITE/ADMIN tests remain protection. Add missing empty-email label/value and keyboard navigation/menu assertions; neutral empty-tab navigation with no permission promise. Use self-contained synthetic fixtures, not test order/global seed assumptions.
Activity: add playwright/tests/P-activity-overview-feedback.spec.ts with fixture creation and finally/afterEach cleanup local to that spec using existing getPrisma and fixture helpers; own only per-test synthetic IDs, never global cleanup. Add one Preview/Comments journey asserting the dialog activity's comment object ID/type remains unchanged after selecting an instance, switching tabs, and reopening for another activity. Add the focused activity-feedback spec using the existing P-question-library-feedback.spec.ts GraphQL fault/debounce pattern and fixture helpers. Cover no-Enter search, rapid clear preventing late overwrite, no-hit recovery, query failure/retry preserving filters/sort and safe selection; one primary browser seam. Extend existing activity-log/details protection only for changed entry/selection behavior; no test for each private helper.
Wizard: extend playwright/tests/W4-activity-wizard-safety.spec.ts only with missing Help keyboard/copy visibility checks; reuse existing four-type EN/DE cancellation/reload checks, don't duplicate them.
Layout: before/after screenshots 1024x768 and 1440x900 in EN and DE, long names, missing metadata, nonempty activities, read-only and manager. Check keyboard focus return/accessible names and no clipped controls. Screenshots evidence, not brittle pixel-perfect tests. No mobile/accessibility-conformance claims.
Run repo-native format/lint/check/build relevant to Manage/i18n and test TS at every layer tip; full hook equivalents in exact container, never bypass hooks. Host pnpm playwright:host against exact devrouter routed stack per repo rules. Reuse unchanged passing evidence. Broader per-layer CI is a separate gate from local focused proof.
## Delegation Map and slices
All paths below are repository-relative. Each slice appears once. Executors work serially; each shared locale file receives only that slice's keys. The main session alone writes plan/progress/evidence and integrates changes.
| Slice | Route/owner | Dependency and handoff | Acceptance |
| --- | --- | --- | --- |
| Course clarity | executor | pinned v3; return exact diff to main before activity slice | Course commands and visual/menu matrix below |
| Activity feedback and inspection | executor | verified course tip; main supplies accepted populated visual observations | Activity commands and latest-query/comment-scope matrix below |
| Wizard guidance | executor | verified activity tip; preserve existing wizard recovery | Wizard commands and four-type EN/DE Help/recovery matrix below |

Course owned paths: apps/frontend-manage/src/pages/courses/index.tsx; apps/frontend-manage/src/pages/courses/[id].tsx; apps/frontend-manage/src/components/courses/{CourseListButton,CourseArchiveButton,CourseDeletionButton,IndividualLeaderboard,LiveQuizList,PracticeQuizList,MicroLearningList,GroupActivityList}.tsx; packages/i18n/messages/{en,de}.ts; playwright/tests/N-course.spec.ts; playwright/tests/W-activity-log.spec.ts (only course-row comment entry locator changes). Preserve non-course button variant behavior in CourseListButton.
Activity owned paths: apps/frontend-manage/src/pages/activities.tsx; apps/frontend-manage/src/components/activities/overview/{ActivityList,ActivityListEntry,ActivityListSearch,ActivityListSorting}.tsx; apps/frontend-manage/src/components/activities/overview/details/{ActivityDetailsModal,ActivityOverviewTable}.tsx; packages/i18n/messages/{en,de}.ts; playwright/tests/P-activity-overview-feedback.spec.ts; playwright/tests/W-activity-log.spec.ts (only changed activity entry selectors).
Wizard owned paths: apps/frontend-manage/src/components/activities/creation/liveQuiz/LiveQuizInformationStep.tsx; practiceQuiz/PracticeQuizInformationStep.tsx, microLearning/MicroLearningInformationStep.tsx and groupActivity/GroupActivityInformationStep.tsx under that same creation directory; packages/i18n/messages/{en,de}.ts; playwright/tests/W4-activity-wizard-safety.spec.ts.
Reuse existing icon-action hover/focus sibling-tooltip pattern; do not wrap Button/Dropdown in the design-system Tooltip trigger. No new shared component abstraction.
Main owns closure receipt, plan, topology/worktree setup, runtime/fixture ownership, populated visual design acceptance, integration and publication. Reason: critical-path coupling/product decisions and external effects.
Each layer is one substantive slice with its own conventional commit(s): enhance(manage): clarify course overview and details; enhance(manage): improve activity search and inspection; enhance(manage): simplify activity wizard guidance. Plan first docs(project) commit in bottom layer. Later progress updates travel with their layer.
Simplifier after each substantive committed slice. Course action changes get slice-reviewer for retaining permission/confirmation protections; activity slice gets slice-reviewer for selection/recovery and comments scope. Wizard slice review not required unless lifecycle contract changed; final integrated review includes correctness, security and maintainability across exact range, architecture skipped unless scope changes. Reports under project/_local/reviews; resolve findings before publication.
Exact commands at EACH layer tip: devrouter exec /Users/rschlae/Git/klicker/klicker-uzh/trees/manage-overviews-ux -- pnpm run check:all; same command with pnpm run build. This includes test TypeScript checks; use additional pnpm --filter @klicker-uzh/playwright check if not part of the resolved check:all run.
Host from new worktree, with canonical routed target selected per repository host runner:
- Course: pnpm playwright:host -- tests/N-course.spec.ts tests/W-activity-log.spec.ts
- Activity: pnpm playwright:host -- tests/P-activity-overview-feedback.spec.ts tests/W-activity-log.spec.ts
- Wizard: pnpm playwright:host -- tests/W4-activity-wizard-safety.spec.ts
Run these suites against only task-owned test data; their existing cleanup is allowed only in the isolated task database. Bootstrap fresh synthetic fixtures for subsequent visual checks after any suite cleanup.
## Runtime and documentation
Additional approval, 2026-09-05: the user approved a scoped local Auth/runtime
repair and continuation of UX verification. It covers the existing exact-app
cache-recovery path and a narrow Auth readiness correction in
`util/dev-runtime.sh`, its regression tests in `util/test-dev-runtime.sh`, and
the matching explanation in `docs/getting-started.md`. Auth must prove its
providers API returns JSON, rather than only proving its homepage exists.
No authentication rules, secrets, dependencies, domains, shared router setup,
database data, or another task's runtime are changed. The parent owns this
small repair because it is coupled to the active runtime; the read-only test
mapping used a trusted executor fallback after the explore provider failed
with HTTP 400 before useful work. Fresh runtime proof and delegated login are
required before resuming the UX acceptance checks.

Use new worktree's manage profile for Manage/auth/API visual inspection and the repository-resolved test profile for owning Playwright suites (pwa, control or other apps required by existing tests must be present). Read current runtime skills/config and verify selected profile before running; do not modify .devrouter.yml, hostname/TLS/env or release-verification runtime. Only task synthetic data; preserve existing release runtime owned by another task. Stop task runtime after proof; deletion always separate.
No new deps, schemas, API changes, generic abstraction or wiki sprawl. Existing frontend convention doc updated only if this stack changes a documented UI convention; otherwise plan plus evidence sufficient. Add focused screenshots under local project evidence, no real person data.
## Progress

### Recovered dependency mounts and live Manage proof, 2026-09-09

Source devrouter aacf9ea completes app-only dependency-volume recovery. The
replacement app is c99907df732a10b8646985501c01e9dc8e347d58b0f73474f828acd4c6353b7c.
All retained sidecar IDs and volumes remain preserved; bootstrap runs without
initialization arguments. Docker normalizes OomKillDisable false to null on
first start; the reviewed proof exception admits only that exact change.
The installer initially skipped empty package volumes because pnpm's optimistic
repeat-install check returns before force handling. Explicit frozen install with
that shortcut disabled installed 3834 packages. Recovery journal and receipt
are completed. Aquinas passed the source correction reviews.

Canonical ensure --repair reports ready, ten routes, healthy dependencies,
running workers and no drift. Delegated local lecturer login, course overview
and Testkurs detail pass browser inspection. Screenshots live under
project/_local/visuals/2026-09-09-recovery. Course detail is usable at 390px;
existing global header clipping remains. At consumer head 6fdd50acfce,
the full release build passes all 23 tasks; typechecks pass all 35 tasks and
lint passes all seven tasks. Host-only launcher and CI checks pass separately.
Hook equivalents run in their owning host/container environments. Canonical
stop reports success, the provider reports Stopped, and exact source routes
are zero. Browser session is closed. The existing draft PR now carries this
head; hosted CI and GitGuardian remain separate readiness gates.

The latest target integration resolves origin/v3 cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed
because the draft PR has merge conflicts. Main owns integration and final proof.
The resolution retains the routed student login URL and upstream navigation
completion, combines Auth providers readiness with Pages manifest readiness,
and moves the manifest regression fixture to Manage's actual probe contract.
Upstream Chat changes remain upstream-owned. The previously passing UI checks
are earlier-head evidence; current integration verification is in progress.
Canonical normal ensure owns the startup; no replacement or data reset is
requested by this continuation.


### Verified runtime release, 2026-09-08 21:31 CEST

Canonical stop succeeded after temporarily selecting the exact recorded source
revision 4be4408f1 in this same checkout. The latest task branch was immediately
restored at 6a131a645. Fresh Devsy status reports Stopped, and exact source-path
routeCount is zero. No data or runtime deletion occurred. This supersedes the
blocked-shutdown state below. Latest-mount startup and full build remain blocked
by configuration reconciliation. Final integrated review passed without findings
on origin/v3..6a131a645; the report is
project/_local/reviews/2026-09-08-course-integrated-final-review.md.
Ordinary publication awaits the required build.

### Current verified outcome, 2026-09-08 21:22 CEST

Guarded recovery completed without repeating replacement or deleting retained
mounted data. The recovered full-profile runtime passed all 79 host Chromium
course and activity-log tests (7.2 minutes). Delegated login, course list,
overflow actions, and course detail were inspected manually at desktop and
390px mobile widths. The existing global header clips on mobile; course
content remains usable. Screenshots are under project/_local/visuals/2026-09-08-course-proof/.

Target integration is committed in 4be4408f1 and 9ced7bca6. The latter includes
v3 3f6917ecc52d606d212db5b156be502cd5c99973. All 35 typecheck tasks and seven
lint tasks pass. Host-only CI contracts pass separately; 34 host launcher and
dependency-mount tests pass. The synthetic recovery suite passes. Host staged
secret scanning and identity checks pass. Git hooks were split into equivalent
host/container checks because the toolchain belongs in the container.

The latest target adds generated dependency mounts. Warm ensure refuses this
configuration drift. Subsequent exec fails with Lifecycle transition is blocked;
managed stop fails with Managed stop requires unchanged recorded resources and
configuration. Exact Devsy status is Running and exact source-path routeCount
is 10. Shutdown is blocked, not retained under a user lease. No raw provider or
Docker bypass was attempted. Latest-configuration runtime proof and full build
remain unverified; ordinary publication remains pending that build and review.
The successful browser run used the recovered mount configuration, not the new
mount configuration. Source devrouter 0.0.60 handled recovery; global devrouter
remains 0.0.59. Do not repeat replacement or delete retained storage under the
current goal. Next runtime action requires supported configuration reconciliation.

### Retained app configuration mismatch resolved, 2026-09-08

Read-only source comparison identifies the omitted removal of
GROWTHBOOK_BETA_SAVED_GROUP_ID. Restoring that key plus the retained values for
DATABASE_URL and SHADOW_DATABASE_URL reproduces the app's exact recorded Compose
hash. PostgreSQL's hash also matches after reversing only the added read-only
initialization bind. The earlier unknown-drift blocker is resolved.

Devrouter recovery source commit 9d2b24f adds configuration reconstruction and
mount pinning primitives plus tests. Twenty focused tests and typechecking pass.
Real synthetic Docker fixture retained-config-fixture-1788872319927 preserved
named and anonymous volume identities, bind source/read-only access, and all
three sentinels in a replacement container. Both fixture containers stopped.
This qualifies storage reuse only, not provider attachment or complete recovery.
Devsy's supported workspace status command reports this exact task Stopped;
its registered source path and provider identity agree. No retained task container
was replaced. The original runtime remains stopped pending adapter integration,
review, new disposable database provisioning and truthful bootstrap recovery.

### Recovery continuation, 2026-09-08

Latest admission blocker: read-only reconstruction of the PostgreSQL Compose hash
matches after removing only the added read-only initialization bind. The app hash
does not match after reversing DATABASE_URL and SHADOW_DATABASE_URL, either from
container environment or recorded HEAD source. Additional app configuration drift
is therefore unproven. Replacement must remain blocked until that exact mismatch
is explained; user approval is not missing. No configuration values were printed
or persisted. Recovery worker Newton returned incomplete and released ownership;
main owns the remaining integration, with no replacement worker required.

Approval for the exact retained app/PostgreSQL replacement and isolated synthetic
qualification persists. No renewed approval is required for those same effects.
The recovery adapter remains incomplete; no live replacement has occurred.
All eight exact Compose project containers were verified exited, and the host
route query returned zero routes for this checkout. The unavailable bare DevPod
CLI and unsupported Devsy status subcommand do not establish provider status.
Global and task devrouter are 0.0.59. Remote target now ends at e3fb9873c9; the
pending merge remains 1a270f3305. The newer target changes dependency mounts and
must be evaluated after the current recovery boundary, without silently widening
its unchanged-storage contract.

Consumer bootstrap shell syntax, ShellCheck, and mocked failure/success tests
pass. Installation/build failures now explicitly prove no completion marker;
source-mirroring schema assertions were removed. These are orchestration tests,
not real database readiness or provider storage-preservation proof.
Devrouter admission plus preview digest regression: 14 tests pass. Draft recovery
typecheck passes after correcting blocker types. Preview now binds environment
values into its digest without emitting them. Concrete provider adapter, CLI,
real synthetic storage qualification, reviews, and runtime/browser proof remain.

### Latest target and retained-runtime reconciliation, 2026-09-08

The user authorized latest target integration and the global devrouter update.
The pending merge now targets origin/v3 1a270f33053e12d56df6e4536133753edcaae636,
without conflicts. The prior index exactly matched its automatic merge tree;
that uncommitted merge was replaced while preserving the unstaged plan edits.
Global and repository devrouter versions are 0.0.59. No merge commit or new
verification pass is claimed.

Both canonical ensure and ensure --repair refuse with
`Managed Compose configuration changed for service 'app'.`
Inspection of the installed lifecycle worker confirms degraded startup routes
through assertRepairBaseline, which requires unchanged retained Compose hashes.
The CLI exposes no retained-configuration replacement operation. Raw provider
recreation would cross the managed lifecycle boundary and was not performed.

Exact owner rs-manage-course-clarity maps to this checkout and Compose project
default-rs-c0d01. All eight project containers are exited. PostgreSQL mounts
named volume default-rs-c0d01_pgdata at /var/lib/postgresql/data. Provider status
is Stopped and exact checkout routeCount is zero. No database, container or
volume was changed. A supported devrouter configuration-reconciliation capability
is required before the approved disposable bootstrap and checks can continue.
### Target integration and disposable database blocker, 2026-09-08

Fetched and integrated origin/v3 `7f81442ad98138f99a88277d59ba06eada2abe9a`
into rs/manage-course-clarity without conflicts. The merge remains uncommitted
pending container checks. Existing task commits and remote publication are unchanged.
Before integration, full-profile startup passed all readiness contracts with
healthy services, both processes running and no drift. Created the guarded local
synthetic activity fixture and read-only login. Delegated owner and READ login
worked; captured populated rows/details and course layouts under
project/_local/visuals. The course screenshots cover EN/DE at 1024 and 1440;
activity baseline confirms unnamed sort, generic clickable titles and generic
details heading. READ activity edit/start protections remain present. This is
pre-integration evidence, not acceptance of the integrated runtime.

The integrated environment changes the local database target to klicker_test.
The retained container uses the old local identity. A values-free check against
the integrated configuration returns PostgreSQL 28P01; catalog booleans confirm
that role klicker_test, database klicker_test and klicker_test_shadow are all
absent. Existing synthetic MCP ownership passes in the old database. Canonical
startup fails before readiness at the authenticated fixture step. Managed exec
then refuses the degraded lifecycle. No database or volume was deleted or
relabelled. Task-only managed shutdown succeeded in /tmp/manage-integration-stop.log.
Exact source-path readback shows zero routes; the validated application container
is exited. Both task browser sessions are closed.
The new upstream retained-volume guidance requires a fresh disposable environment
with explicit approval; do not bypass its guard. Activity and wizard implementation,
remaining acceptance, merge commit, reviews and draft-stack publication remain pending.

### Runtime repair and course verification pass, 2026-09-08

Local commit `11db845b3ece0e092e182bb0c7d74c6e1f2a5b07` contains the atomic
synthetic MCP-parent restoration and temporary-table regression coverage.
The dedicated slice reviewer approved its complete committed range without
findings. The simplifier identified unused test-helper overrides; removal
preserves all scenarios and the temporary-table acceptance passed again.
Reports are under `project/_local/reviews/2026-09-08-local-mcp-parent-repair-*`.
Pre-commit secret scan, 35 check tasks, seven lint tasks and staged formatting
passed using the exact container toolchain and host Git orchestration.

The course suite now passes all 55 Chromium tests in 4.7 minutes:
`/tmp/manage-course-group-creation-sync.log`. The separate activity-log suite
passes all 24 tests in 2.7 minutes: `/tmp/manage-repair-activity-log.log`.
The combined 79 acceptance cases are green across those two producing runs.
The group-sharing failure was resolved by waiting for each synthetic group
row after creation, before navigation/logout. The deletion test waits for
its cancelled modal to disappear and its reopened Delete action to appear.
No permission, deletion or comment-scope assertion was weakened.

Repeated managed startups and the complete suites verify the development-only
Manage/PWA cache setting; retain it as a local development workaround, without
claiming the underlying Turbopack mechanism has been established. Production
settings are unchanged. The local fixture no longer requires manual parent
restoration after test cleanup. One intervening preparation stall required
managed cancellation/stop; the subsequent clean restart passed. There is no
claim that the fixture repair resolves unrelated build-process stalls.

Activity and wizard implementation, the remaining visual acceptance matrix,
integrated final review and draft-stack publication remain outstanding. No
handoff was created or synchronized; no new remote publication occurred.

### Approved atomic local fixture restoration, 2026-09-08

The user approved extending local MCP startup repair to recreate only missing
synthetic parents, verify ownership and preservation, then resume the full
runtime and course suites. This supersedes the managed recovery blocker below.
The parent owns the data-boundary implementation in
`apps/chat/scripts/local-mcp-seed.mjs`; a native executor owns the existing
temporary-table acceptance script. No authentication rule, external service,
dependency, schema or shared router configuration is changed.

The repair accepts only zero bindings, absent fixed course/chatbot IDs, the
exact seeded lecturer and the validated existing local server. It inserts
the course, draft chatbot and two mode bindings in the existing serializable
credential-rotation transaction. Existing or conflicting parents are rejected.
The full managed repair completed with healthy services, both owned processes
running and no drift (`/tmp/manage-parent-repair-startup.log`). The subsequent
host launcher also completed startup; course/activity-log verification runs
in `/tmp/manage-parent-repair-course-suites.log`. Focused preservation tests,
final suite results, checks and review remain pending. No commit or push yet.

Verification update: the temporary-table acceptance script passes, including
legacy and authenticated restoration, repeat stability, partial-parent and
owner/marker conflicts, interruption and insertion rollback. Syntax, Biome and
diff whitespace checks pass. The combined course/activity-log run passed 39
tests and failed at the missing Group 5 selector; 39 tests remained unrun.
Course navigation, deletion cancellation/reopening, and individual permission
checks passed. That group-sharing failure is unresolved and is not attributed
to the startup repair. A separate activity-log run is in progress.

After suite cleanup, startup again restored the missing fixture automatically.
Dependency preparation then stalled with completed Rollup outputs and sleeping
build processes. The existing startup session was cancelled, and managed stop
drained the provider operation and freed ten routes. One clean retry completed
full startup successfully (`/tmp/manage-repaired-restart-retry.log`). No manual
parent restoration was used. Runtime proof is successful; full course-package
acceptance and required committed-range reviews remain incomplete.

### Docker recovery reaches managed fixture blocker, 2026-09-08

Docker is available again (server 29.4.0). Fresh fetch leaves the task equal
to its own upstream, six ahead and seven behind `origin/v3`. No integration
or source changes ran during this recovery attempt.

Completing the interrupted exact-task stop cleared ten routes. A clean
managed full-profile startup resumed the owned container, but failed at
`[local-mcp] Authenticated fixture startup failed; no credentials logged`.
The supported `ensure --repair --profile full` reached the same failure.
The previously approved guarded synthetic-parent restoration could not run:
`devrouter exec` now reports `Lifecycle transition is blocked.` No raw
provider or Docker mutation bypass was used. Full course verification remains
blocked on a supported way to restore the missing startup records while the
managed runtime is degraded. Logs: `/tmp/manage-clean-managed-restart.log`
and `/tmp/manage-mcp-repair-after-docker.log`.

Final exact-task stop succeeded. Fresh Devsy status identifies
`rs-manage-course-clarity` as `Stopped`; source-path workspace readback
reports zero routes. Runtime release is now verified, superseding the prior
unknown shutdown. Data and local edits are preserved. No commit, push,
deletion or handoff occurred. Diff whitespace validation passes.

### Cache experiment and confirmation transition, 2026-09-07

Host execution recovered and the guarded synthetic MCP-parent restoration
succeeded. Two complete course/activity-log attempts passed the former Manage
and PWA route failures, keyboard navigation, missing metadata, empty tabs,
course editing and archiving. Each stopped at the deletion-menu reopen after
cancelling its confirmation: 13 passed, one failed, 65 unrun. Logs:
`/tmp/manage-both-cache-off-suites.log` and
`/tmp/manage-cache-off-menu-correction-suites.log`.

Adding the expected action to the existing menu helper alone did not fix the
failure. A fresh delegated-login agent-browser inspection successfully opened,
cancelled and reopened the synthetic course confirmation; screenshot:
`/tmp/manage-course-menu-reopened.png`. The test now waits for the cancelled
confirmation to disappear before reopening and waits for the Delete action.
The self-contained deletion journey then passed in 18.7 seconds overall:
`/tmp/manage-deletion-close-transition.log`. All deletion assertions remain.
Both development-cache configuration changes remain experimental and local;
the full 79-test acceptance run after the correction remains required.

Docker became unavailable immediately after that focused pass. Both the
synthetic-parent restoration attempt and independent `docker info` report
that `/Users/roland/.orbstack/run/docker.sock` cannot be reached. Exact-task
`devrouter stop .` failed for the same reason. Runtime shutdown is unknown;
no keep-running lease or deletion is inferred. The diagnostic browser closed.
Restore host Docker availability, then rerun the guarded parent restoration,
the two full suites, and exact-source runtime release when verification ends.

Fresh fetch leaves the task equal to its own upstream and six commits ahead,
five behind `origin/v3`. The current target is
`7c73ed231ce89885f634d37fece86c621424f617`; its Manage test-only rewrite and
disposable-database changes need integration assessment after experiment proof.
No additional integration, commit or push occurred. Config syntax and diff
whitespace checks pass. Prettier passed before the final hidden-confirmation
assertion; its final check is pending container availability. Activity and
wizard layers remain unimplemented. No handoff was created or synchronized.
The bounded fixture-source executor was stopped at this pause without a
completed report; no fixture validation or accepted correction is claimed.

### Approved PWA experiment, 2026-09-07

The user approved extending the same development-only cache experiment to
PWA, rerunning the course suites, and retaining it only if verified. That
decision supersedes the pending scope request below. Both Manage and PWA
now have the seven-line development-only configuration locally; production
settings and dependencies are unchanged. Both files pass `node --check`,
and `git diff --check` passes. The PWA experiment has not run and is not a
verified fix. No commit or push occurred.

Fresh fetch succeeds with host access. The task branch tracks
`origin/rs/manage-course-clarity` with zero upstream drift and stands six
commits ahead and five behind `origin/v3`. No further integration ran.

Synthetic startup-parent restoration and its single permitted retry both
timed out in automatic approval review before execution. The full suites
therefore did not start. No renewed user scope approval is needed; host
command execution remains the blocker. The sandboxed task-only stop failed
to determine process identity for the lifecycle lock. The host-access stop
then timed out in automatic approval review before execution. No shutdown
success is claimed. No handoff was created or synchronized.

### Development-cache experiment, 2026-09-07

The synthetic MCP-parent restoration command executed successfully on resume,
superseding the earlier approval-availability blocker. The unchanged full
course/activity-log retry again failed at Manage course navigation: two passed,
one failed, 76 not run (`/tmp/manage-resumed-course-suites.log`).

A temporary, uncommitted Manage configuration disables
`experimental.turbopackFileSystemCacheForDev` only for development. The focused
gamified-course creation test passed (4.4 seconds; one passed overall) through
canonical startup in `/tmp/manage-cache-off-focused.log`. A second canonical
startup passed the same course navigation in the full suite. That run then
failed on the student PWA course page: three passed, one failed, 75 not run
(`/tmp/manage-cache-off-suites.log`). The PWA snapshot shows its 404 page;
values-free manifest inspection shows Manage's dynamic course route registered
and no PWA course routes registered. This supports further bounded diagnosis,
but does not establish the cache mechanism as the root cause or a complete fix.

The user was asked to extend this development-only experiment to PWA; that
scope decision remains pending. No PWA source change was made. Manage config
syntax and `git diff --check` pass. No new commit or push occurred.

The ignored populated-activity fixture now additionally requires
`DRY_RUN=false` and the exact container database/working directory before
writes. Its dry run and one permitted retry both timed out in automatic
approval review before execution. No populated fixture was created and no new
visual proof is claimed. Activity and wizard implementation remain pending.
No handoff was created or synchronized.

Runtime release is blocked: the exact-task stop and its single retry timed
out in automatic approval review before execution. Independent Devsy status
still reports `rs-manage-course-clarity` as `Running`. No keep-running lease
was inferred, no deletion was attempted, and shutdown is not claimed. Resume
the exact-task stop when command approval is available. The task worktree is
`/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/manage-course-clarity`.

### Continued route diagnosis without handoff, 2026-09-07

The user requested continued execution without a handoff. No handoff was
created or synchronized during this continuation. Fresh fetch leaves the task
equal to its own upstream, six commits ahead and four behind `v3`; the newly
fetched changes do not overlap course navigation. No second integration ran.

Resume selected the retained full-profile startup hook and rejected the MCP
parents removed by Playwright global setup. A guarded task-local transaction
restored only the absent synthetic course, draft chatbot and two bindings;
existing course-test data and the MCP server's authentication were preserved.
The first transaction rolled back because a PIN-auth course requires a PIN;
the corrected transaction passed. Canonical full-profile repair then passed.

The local request probe found `/courses/[id]` registered. Both the synthetic
course document and its localized data endpoint returned 200 with the expected
page/data structure. The existing gamified-course creation test subsequently
passed through the canonical host runner in 4.4 seconds, with no product-code
change. Log: `/tmp/manage-course-transition-test.log`. Earlier failed runs
logged a dynamic-course warm-up 404 while still declaring runtime readiness;
this passing run did not. A durable restart fix remains unproven.

The configured advisor completed a bounded prompt-only consultation; its
hypotheses and parent disposition are recorded under
`project/_local/reviews/2026-09-07-route-advisor.md`. No hypothesis is claimed
as a root cause. Full course/activity-log re-verification is next, pending
restoration of the same synthetic startup parents removed by test setup.
Both command approval reviews timed out without execution. No further retry
was attempted. Full-suite re-verification is blocked on command approval
availability. Canonical task shutdown passed after a provider-lock wait. Independent
Devsy status reports Stopped and the exact workspace has zero routes. No
handoff was created or synchronized. The plan update remains uncommitted, and no source changes were made.

### Approved reset and repeated route failure, 2026-09-07

The user explicitly approved resetting and reseeding only the disposable task
database. Reset, schema push, client generation and the standard synthetic seed
all passed. Values-free checks confirmed the expected MCP course, chatbot and
two mode bindings. Canonical full-profile startup passed with no drift using
the installed global Devrouter 0.0.55. This supersedes the pending reset
approval below; the global installation and shared router remain unchanged.

The post-integration course/activity-log retry stopped at gamified course
navigation: two tests passed, one failed, and 76 did not run. The page snapshot
and server log show `PageNotFoundError` with `ENOENT` for the synthetic course;
the runtime pages manifest contains `/courses` but lacks its dynamic detail
route. This is bounded failure evidence, not an established root cause or a
durable repair. Producing log:
`/tmp/manage-postintegration-suites-repaired.log`. The remaining visual matrix
and populated-activity acceptance remain pending.

Hosted checks at `3b258fe5ceb61a76c6eb37bf7e2a485ae12e9dbb` pass all eight
Playwright shards, build, source checks, Gitleaks and automated code review.
GitGuardian still reports two potential secrets; its CLI annotations are
empty and no authenticated dashboard session is available. Those findings
remain unresolved. Hosted success does not replace the failed local run.

Further runtime platform repair is required before dependent activity and
wizard work; no further reset or startup retry is proposed from this evidence.
The exact task runtime is stopped. Independent provider status confirms Stopped
and source-path route ownership reports zero routes. Integrated final review remains unused. This
checkpoint changes no tested source and does not mark the draft PR ready.

### Target integration, 2026-09-07

The user explicitly authorized pulling in the latest target branch. The live
draft PR targets `v3`; its fetched head is
`6af9532fe9b1ffd5a92e0466ada93121a90ba8ce`. The one authorized merge applies
without conflicts and preserves the course implementation and local test fixes.
The integrated source passes 35 check tasks, seven lint tasks, all staged
format checks, and the full 23-task build. The new upstream Devrouter contract
test runs on the host with global 0.0.55; the remaining toolchain checks run in
the exact task container. No hooks are bypassed or dependency versions changed.

Runtime repair reaches the upstream authenticated MCP bootstrap but rejects
the local fixture: its synthetic course, chatbot, and two mode bindings are
absent after the course suites. Standard repository reseeding fails with a
unique course-PIN constraint (`P2002`). A fresh task-database reset and reseed
is proposed; deletion of the test data created since the last clean setup
awaits explicit user approval. The earlier 79 passing browser tests
remain earlier-branch evidence; no post-integration browser pass is claimed.
Activity and wizard implementation remain pending, as does the full visual
matrix and integrated final review.

The integration is published to the existing draft PR at
`34cc6de1fa26eb02b4532869f494c1f200810ffa`; the target head is verified as an
ancestor. Commit and pre-push hooks pass. This progress correction changes no
tested source. Exact-head hosted CI remains a separate pending gate.

### Restart limitation after the passing clean run, 2026-09-07

The test corrections and clean-run evidence are committed at `051798817b`.
All commit hooks pass and no push occurred. A final canonical reconciliation
at that commit reproduced the preparation-child failure: nine cached dependency
builds complete in 84ms while a Git subprocess remains alive. Rollback reports
degraded process drift. Clean bootstrap and all 79 tests passed, but a fresh
setup does not repair the cached-preparation lifecycle race after a commit.
The prior passing test and visual evidence remains valid for its examined
content. Stable restart capability is still required for further runtime work.
Log: `/tmp/manage-clean-postcommit.log`. The exact runtime is being stopped;
the global handoff records final provider and route verification.

### Clean setup and passing course suites, 2026-09-07

The user requested a clean setup. Source-path ownership was verified before
canonical deletion of only the task runtime and its synthetic data. Existing
Next.js output and task runtime markers were moved into the ignored
`project/_local/clean-setup-backup/20260907-123336` directory. The Git worktree,
shared router, global tool installation and other workspaces were preserved.
Installed global Devrouter 0.0.55 then completed fresh full-profile bootstrap.
Repeated host-launcher reconciliation passed without source workarounds.
This supersedes the runtime-blocked checkpoints below.

The self-contained keyboard-navigation and missing-metadata test passed.
Broader tests exposed a hardcoded student localhost URL and two permission
assertions that still expected badges inside the former whole-row button.
The course spec now honors the launcher-provided student login URL, matching
the existing shared fixture. Badge assertions retain the same course-specific
permission levels but locate the badge beside the semantic course link.
No product authorization or routing behavior changed.

The full course and activity-log command passed all 79 Chromium tests in
7.2 minutes. It covers creation, editing, keyboard navigation, empty tabs,
archive/delete, duplication, individual/group permission levels, revocation,
ownership transfer, removal, and comments. Evidence is the producing log
`/tmp/manage-clean-suites-final.log`; earlier failed runs are superseded only
for these corrected behaviors. The test helper's type check and formatting
also passed. No new tests or dependencies were added.

Manual delegated-login verification captured the seeded course at 1024x768
and 1440x900 in EN and DE under `project/_local/visuals/manage-clean/`.
The missing-email value remains aligned and controls remain visible. This
is bounded visual evidence, not the full long-name/read-only matrix or
activity-density acceptance. Activity and wizard implementation, the remaining
visual matrix, publication and integrated final review are still pending.

### Latest runtime diagnosis, 2026-09-07

This entry supersedes the earlier pending commit and startup experiments.
The selector correction and prior checkpoint are committed locally at
`31530a777e7bc4a0da4a63ef2cabf739b3df1404`. No push occurred. The branch
is one commit ahead of its own upstream and three ahead/twelve behind fetched
`origin/v3`; no integration occurred. Primary checkout remains clean.

The full build passed all 23 tasks. Commit checks passed all 35 check tasks,
seven lint tasks, remaining policy checks and staged formatting; gitleaks
reported no leaks. The initial hook failed because container-side lint-staged
could not operate the host Git index. A temporary bridge keeps lint-staged Git
operations on the host and runs the unchanged configured formatters inside the
exact container. Other check:all commands also run there. No hook was skipped.

A clean committed tree still reproduces the preparation-child failure.
Draining build logs synchronously also leaves Turbo's Git subprocess alive.
A temporary `--force` on dependency preparation completes with no live child
and permits canonical startup. That experiment was restored completely;
there is no persistent build-cache or lifecycle workaround in the branch.
The installed global Devrouter remains 0.0.55 and was not changed.

The focused course-navigation test never started: its host launcher attempted
canonical full-profile reconciliation, recovered stale Auth output, then hit
stale Chat output. It ended with `Managed post-start failed. Candidate runtime
was rolled back.` One readiness pass had exhausted its single repair attempt.
Runtime readiness is therefore not repeatable. Earlier course-route 404
acceptance failure remains unresolved; no UI routing workaround was applied.
Logs: `/tmp/manage-clarity-force.log`, `/tmp/manage-clarity-focused.log`,
`/tmp/manage-clarity-commit.log`, and `/tmp/manage-clarity-build.log`.

Browser acceptance, focused suites, correction publication, activity and wizard
layers, and integrated final review remain pending. Next capability required:
stable canonical startup and repeatable host-launcher reconciliation in this
exact task runtime. The runtime platform owner retains broader platform repair.
The task runtime is being stopped for this checkpoint; the global handoff
records the final provider and route readback.

### Device takeover, 2026-09-07

The user authorized continuing route diagnosis and repair. A later full-profile
resume hit a separate preparation guard: all dependency builds pass, but
Turbo leaves `git diff HEAD --no-ext-diff --no-color` briefly running after
its own exit. A bounded process-group probe reproduces this with normal,
no-daemon and run-summary modes. The managed helper correctly rejects the
live preparation child. No helper or global installation was modified.
The next experiment commits the already-verified selector correction and
this checkpoint after normal checks, then resumes from a clean source tree.
This tests the dirty-tree hashing trigger without relaxing lifecycle guards.

Read-only navigation mapping found no changed pathname, query or locale:
the previous row used `router.push('/courses/<id>')`, and the new semantic
link uses the same URL. The dynamic page's static-generation contract is
unchanged. Link prefetch and cold dynamic-route compilation remain hypotheses,
not established causes. The configured exploration provider failed before
work with insufficient credits; trusted Luna continuity completed the mapping.

Restored `rs/manage-course-clarity` in `trees/rs/manage-course-clarity` on
the receiving device. It tracks `origin/rs/manage-course-clarity` at
`577db334cf3da9c2f2130c49b638fb61aab3eb68`, with no upstream drift.
[The course clarity draft PR](https://github.com/uzh-bf/klicker-uzh/pull/5798)
remains open against `v3`. The task is two commits ahead and eleven behind
the fetched target; no target integration occurred.

Hosted checks pass except Playwright shard 6 and automated code review.
The Playwright log proves that the new email display shares the edit input's
test identifier. A local two-line correction gives the display its own
identifier and updates its assertion; `git diff --check` passes. Browser
verification, repository checks, commit and publication of this correction
remain pending. Automated code review failed authentication on all 16 files
and supplies no usable review.

The initial shell selected Devrouter 0.0.51. Canonical Manage startup failed with
`Managed startup requires a helper with --prepare-command support.`
The handoff used 0.0.55, also declared by current `origin/v3`. The user corrected
the installation diagnosis: the global Volta package already contains 0.0.55.
Direct invocation of its `dist/devrouter.js` verifies that version and resumes
Manage startup without installation or configuration changes. The Volta shim
fails to resolve the executable in this worktree. Initial task-only stop
completed, and independent Devsy readback
reports `Stopped` with zero exact-source routes. Runtime data is preserved.
The resumed startup passed with no recreation and zero drift. Auth returned
JSON 200 and Manage returned its expected redirect. Delegated synthetic
lecturer login and course detail/edit inspection passed. With the edit dialog
open, the email input and renamed display each match exactly one element.
Current `check:all` passes (35 check tasks and seven lint tasks). Focused host
Playwright course/activity-log verification is blocked. The package-script
invocation prepends an old local Devrouter binary, so the unchanged host
launcher must be invoked directly with Node and a temporary PATH wrapper to
the installed global 0.0.55 executable. Canonical Manage recovery then passed,
and the full profile reached readiness. The 79-test run passed cleanup and
non-gamified creation, then course navigation returned Next.js
`PageNotFoundError: Cannot find module for page: /courses/<synthetic-id>`.
The parent interrupted the cascading failures. This is a framework route
failure, not a completed acceptance run; its root cause remains unresolved.
Logs are `/tmp/manage-clarity-playwright.log` and
`/tmp/manage-clarity-runtime.log` on this device. Platform repair remains owned
outside this UX task; no cache deletion or source workaround was attempted.
Final task-only stop completed and freed ten routes. The manual browser is
closed. No test run remains active.

The original action-safety reviewer cannot be resumed on this device and its
report did not transfer. Replacement slice review completed with the duplicate
selector finding accepted and fixed locally; action protections are preserved.
Its report and evidence corrections are in
`project/_local/reviews/2026-09-07-course-clarity-slice-review.md`.
Activity and wizard layers remain
unimplemented; final review remains pending.

Latest runtime checkpoint (supersedes pending approval and session references
below): the scoped Auth readiness repair is approved. Its focused shell
regression suite passed. Auth still returns HTML 404 internally at
`http://localhost:3010/api/auth/providers` after the exact-app cache repair.
The temporary Webpack experiment did not run: the log still shows Turbopack,
and a fresh managed startup refused the degraded runtime state. The temporary
`apps/auth/package.json` change was restored; no bundler workaround remains.
Managed shutdown of this exact checkout failed in `devsy workspace stop` with
exit status 1, but subsequent provider readback reports `Stopped` for
`rs-manage-course-clarity`, and source-path readback confirms zero routes.
Runtime release is therefore verified despite the command error.
Canonical startup after that verified shutdown still refuses the degraded
transition. Read-only doctor confirms `transitionPhase=process-start` and
`the last managed transition is degraded`; shared Docker, router, TLS, network,
and Devsy agent checks pass. This blocks runtime-dependent UX acceptance.
Do not bypass the managed lifecycle or modify
another task's runtime. Next authorized action is bounded provider-failure
diagnosis, followed by canonical startup and delegated-login proof before UX
verification. Shared provider repair or deletion requires a new explicit
boundary. No implementation commit, push, new PR, or browser acceptance is
claimed by this checkpoint.

Current checkpoint, 2026-09-05: the plan is committed at
`1448ee98f79634c587a7f766edbca9a00f1c239d`. Fresh fetch confirms
`rs/manage-course-clarity` has no upstream and is one commit ahead, zero behind
`origin/v3`. Eleven source/test files contain the uncommitted course clarity
implementation. The executor completed the course row/menu and locale subset,
including its focused correction; the main session inspected that diff and
closed the executor. Scoped formatting completed. The implementation check run
passed 34 of 35 check tasks and all seven lint tasks; Manage rejected a missing
translation key. A paired-language course-specific fallback fixed that error,
and the focused Manage check then passed. Final diff/format review, browser
acceptance, build, required implementation reviews, and publication remain
pending. Activity and wizard implementation have not started.

Baseline evidence: the manage profile previously started with matching resources
and no drift. Frozen Python 3.12 analytics preparation succeeded without source
or lockfile changes. Root `pnpm run check:all` passed (35 check tasks and seven
lint tasks), including the plan commit hook. Host Git used a temporary pnpm
bridge to the exact task container; no hooks were bypassed. These checks precede
the implementation and do not qualify its changed source.

Runtime issue: synthetic lecturer login and course overview initially worked,
but the existing course detail route returned HTTP 404 before the source edits.
The exact task restart in session 10722 eventually succeeded with profile
`manage`, matching active resources, and no drift. The internal course route
now returns 200 and `/courses/[id]` appears in its dev pages manifest.

The engineering browser daemon restarted, requiring a fresh login. Delegated
access now reaches `/api/auth/error`; Auth's session and providers endpoints
return 404 with `CLIENT_FETCH_ERROR`. A direct container request to
`http://localhost:3010/api/auth/providers` also returns 404, excluding Traefik
as that failure's source. The catch-all Auth source exists, but its dev pages
manifest contains only `/`, `/_app`, `/_document`, and `/_error`. No authenticated
after screenshots or Playwright acceptance are claimed. The inspected
`next typegen` implementation writes type files; no evidence establishes it
as the cause. Auth/runtime repair lies outside this UX plan and needs a scoped
approval. The isolated browser closed successfully. Task-only shutdown remains
active in terminal session 85564, queued behind another provider operation;
stopped state and zero-route readback are not yet verified. Preserve that single
shutdown request rather than starting a competing one. No keep-running lease
or deletion is authorized. The historical notes below do not override this
checkpoint.

Planning only; source untouched. Old stack merged and superseded draft closed; exact fixture repair eight shards passed, post-close AI review unavailable rather than passed; old runtime stopped/zero routes. Locale Sharing-to-Freigabe parked behind separate tour drafts. Historical worktrees retained incl staged roadmap/generated deletions in feedback-recovery. Planner round 1 returned REVISE; accepted all five findings: explicit delegation ownership, state precedence/course-label decision, named spec and comment-scope protection, locale paths/exact commands, and plan path/progress provenance. The same planner returned APPROVED in round 2; all five findings are closed. User approved the topology and named execution authority on 2026-09-05. The new worktree trees/manage-overviews-ux and native bottom branch rs/manage-course-clarity are created at the pinned v3 baseline. Runtime startup and initial plan commit are next; all three implementation layers remain.

## Device-transfer checkpoint, 2026-09-06

The user requests current work committed and published as draft PRs for
continuation on another device, not completion of the remaining layers or a
review waiver. Course implementation exists; activity and wizard layers remain
unimplemented. Current HEAD is the initial plan commit `1448ee98f7`, with no
upstream or PR. Fresh fetch places it one commit ahead and six behind
`origin/v3`; no upstream integration occurred.

Central Devsy recovery has superseded the historical startup/shutdown blockers.
This checkpoint's canonical manage-profile startup has passed internal Auth
providers JSON and Manage redirect readiness. Final route reconciliation and
required current commit checks remain pending. No new visual or Playwright
acceptance is claimed. The initial custody comparison incorrectly reported the
untracked readiness regression test as deleted; its actual contents match
upstream and must be retained with the adopted runtime changes.

## Planning verdict

Execution checkpoint, 2026-09-05: user started the task runtime. Fresh fetch succeeded; `rs/manage-course-clarity` has no upstream and is 0 ahead / 0 behind `origin/v3` at the approved baseline. Source-path resolution identifies workspace `rs-manage-course-clarity`, with three routes for Manage, API and Auth. `devrouter exec` successfully returned `/workspaces/klicker-uzh`.

The first container `pnpm run check:all` failed in `@klicker-uzh/analytics#lint`: pandas 2.2.2 attempted a source build with no C compiler. The only installed managed Python is 3.14.4; the repository Dockerfile and CI declare Python 3.12. The failed lint terminated the unfinished Manage and GraphQL checks. No full baseline pass is claimed. The proposed task-only preparation command is `devrouter exec /Users/rschlae/Git/klicker/klicker-uzh/trees/manage-overviews-ux -- uv sync --project apps/analytics --python 3.12 --frozen`; both its permission request and one retry timed out before process creation. No dependency or source configuration was changed.

The task-only agent-browser session opened the Manage URL, but subsequent inspection was blocked by host permission-review timeout and sandbox npm-cache EPERM. No visual acceptance is claimed. Native executor readiness did pass the host `ocx ready --json` check; no executor was dispatched because the initial plan commit and usable baseline verification remain pending. No source implementation, commits or publication have begun. Resume after host command execution is available; do not repeat the topology or plan review. Runtime release is being attempted separately; the release-verification runtime and historical worktrees remain untouched.

Native planner Pauli (`01a0715f-7eef-7c00-b23f-e3056a113cb7`) returned REVISE in round 1 and APPROVED in round 2. All five findings were accepted and verified against source. The local transcript is project/_local/reviews/2026-09-05-manage-overviews-plan-hardening.md. No rival pass is armed: this plan preserves domain, API, data-integrity and authorization contracts; the scoped action-safety reviews remain required during implementation.

The workflow lesson is to validate library, list/detail and wizard information density together before closing a UX package. Proposed destination is the shared UX review guidance; no global instruction, skill or memory change is authorized or made here.

Retry checkpoint, 2026-09-05: host execution is available again and fresh fetch confirms the task branch remains 0 ahead / 0 behind origin/v3. The task container is no longer running, so Python preparation could not execute. Canonical `devrouter ensure` failed fetching `node:24.16.0-bookworm-slim` because `index.docker.io` DNS resolution timed out. An independent host curl check also failed with `curl: (28) Resolving timed out after 10000 milliseconds`. This is now a registry-connectivity blocker, not a permission-review blocker. No source, dependency, lockfile, commit or PR changes were made. The temporary engineering browser closed successfully. Task-only shutdown is queued behind the provider's existing lock; do not bypass it or touch another task's runtime. Resume the approved stack after registry DNS works, through the same exact-path `devrouter ensure` and Python preparation commands.

Runtime release checkpoint: `devrouter stop` for this exact task path and its one permitted retry both timed out in permission review before execution. Shutdown and zero-route readback are unverified; last observed state was accessible with three routes. Closing the temporary `manage-overviews-ux` agent-browser session was also blocked before execution. No keep-running lease was inferred. User/host action is required to restore tool access or run the exact task-only shutdown. `git diff --check` passes; Git status still contains only the three untracked project artifacts.

Latest release evidence supersedes the earlier pending cleanup notes: managed stop completed with `stopped: true` and three freed routes. Fresh source-path workspace readback reports zero routes. Devsy list resolves this source to `rs-manage-course-clarity`; status by that exact ID reports provider `docker`, state `NotFound`, rather than a stopped existing container. No running container remains for this registration. No deletion was performed. The engineering browser is closed. Registry DNS recovery is the remaining environment prerequisite; all implementation and delivery work remains authorized but pending.

Further retry, 2026-09-05: Docker Hub now returns the expected unauthenticated HTTP 401, and fresh fetch still leaves this branch aligned with origin/v3. Startup waited about 17 minutes for the shared provider queue, then created the container and passed internal Auth/Manage readiness. Reconciliation unexpectedly ran the full profile after manage, then exited with `Managed process 'klicker-dev' is not running (foreign). Candidate runtime was rolled back.` No UI implementation or baseline pass is claimed. Both this checkout and the installed CLI declare Devrouter 0.0.51, so a simple declared-version mismatch is not demonstrated. The next investigation is the managed process ownership failure; do not blindly repeat ensure, bypass ownership checks, or change another runtime. Task-only stop is active in terminal session 97487, queued behind a different provider operation. No source, configuration, commit or PR changes were made.


Recovery continuation outcome, 2026-09-08: the source task incorporates upstream
0.0.60 in b2a43ce and commits the original mount-declaration guard in 0b6d8f6.
The retained app passes that guard and historical hash reconstruction. The fresh
synthetic storage fixture passes after the guard; all fixture and task containers
remain stopped. Updated ensure/repair plus recovery tests passed 136 tests before
the additional guard and replacement-ID tests; those focused additions pass too.
The callback-based apply draft now uses the new container identity and no longer
invents a bootstrap marker. It remains uncommitted and is not wired to a live
replacement command. Main still owns concrete adapter, managed startup, database
provisioning, final review and UX acceptance. No further user approval is needed
for the previously approved exact replacement and fresh disposable database work.


### Guarded recovery execution, 2026-09-08

Final pre-apply review passed devrouter range 0b6d8f6..04e249e. Digest-bound
apply replaced only app and PostgreSQL, preserving mounted storage, but consumer
provisioning failed before SQL execution: its login was hardcoded to klicker,
whereas the exact retained local configuration specifies klicker-prod. PostgreSQL
logged role klicker does not exist. All eight containers are stopped; source-path
routeCount is zero. Journal ccb60d7b15a7b4d06486f233e390e110dad1f51516a362fde8066c60854b403b
is partial and records successful creation of both replacement containers. Do
not repeat replacement or clear this journal manually.

The user approves identifying the bootstrap identity and guarded continuation.
The local provisioner correction keeps the CI default klicker and accepts only
an explicit klicker-prod alternative already admitted by the SQL identity guard.
Synthetic checks pass for default, local override and rejection before Docker;
consumer orchestration tests pass. Local wrapper hash is now
ce43f74960814470b775235a2fe60d56b5dc3409b3996b868c01d8142b80731f.
No SQL guard is relaxed. Devrouter executor Epicurus owns the bounded journal
continuation implementation; main owns consumer correction, integration and
verification. No recovery retry has run.


### Guarded recovery completed, 2026-09-08

The consumer failure was tsx eval rejecting top-level await. Wrapping the
identity check in async main fixed it; actual read-only checks passed for both
marked test databases. Provisioning was already complete, so the continuation
skips it and preserves restricted-identity verification before push and seed.
Mendel reviewed the frozen consumer, finding no runtime blocker; the sole
authority-comment correction was applied. Current wrapper hash is
463ceb4709c4d40edd9e35fd3f351ae30e147bb931642f482d168512fec3911f.

Source devrouter 7ea5a51 recovery-resume completed with status applied and journal
phase completed. Schema setup, seed and bootstrap checks passed; exact replacements
were stopped and canonical configuration proved. Mounted data preserved and no
replacement repeated. Canonical source CLI ensure --repair is now running and
queued on provider lock; host execution session 79826 owns this startup. Preserve
that handle/queue. User goal remains runtime startup, target integration checks,
and Manage course flow verification. No UI acceptance or integration completion
is claimed yet; global CLI remains unchanged.
