# PR 4920: evaluation metadata and active-block reveal controls

## Approved follow-up

The user requested usable solution and explanation controls while a block runs,
and resolution of the remaining merge blockers. Active questions initialize both
controls off on their first render regardless of saved closed-block settings or
URL flags. An explicit reveal survives polling and navigation back to the same
running question, but does not carry to another question or newly running block.
Closed-block URL behavior, unpublished-content protection, and the separate
results-confirmation overlay remain unchanged.

Authority: implement, verify, commit and push this package to the existing
[evaluation PR](https://github.com/uzh-bf/klicker-uzh/pull/4920), including one
integration of current `v3` and ordinary/final review handling. Merge, approval,
force-push and deployment remain excluded. Retain the exact activity-info-on-eval
runtime for user testing through the next checkpoint.

Route: the executor owns evaluation UI and existing Playwright expectations;
the main session owns HMAC validation, its regression, upstream integration and
final evidence. The HMAC boundary stays with the main session because it is
security-sensitive. Manage startup feedback is addressed by upstream's profile
guard; verify rather than duplicate it.

Acceptance: active controls are enabled and initially off, actual rendered
solutions and explanations follow manual toggles across polling and navigation,
and closed-block behavior still works. Invalid HMAC requests perform only an
identity lookup and never load evaluation relations or cache results. Valid signed
DRAFT/SCHEDULED requests retain metadata-only responses. Tests use a restored,
synthetic APP_SECRET. Run focused GraphQL and host Playwright/browser checks,
applicable package checks and full build in the managed container, then slice
simplification and security review, integrated final review and current-head CI.
Stop only at a real capability, authority or semantic conflict boundary.

The older scope below records the original pre-start fix. This follow-up
supersedes its no-UI-change restriction. No new schema, dependencies, production
data or authorization model is introduced.

Progress: the worktree was fast-forwarded to the pushed head `6484e56bc6`.
The old runtime lacks devrouter's required waitFor configuration, so the single
authorized v3 integration precedes runtime verification. The sole startup-script
conflict retains the working /AddResponse endpoint and upstream GrowthBook host.
The planner's five findings were accepted: explicit reveal-state lifetime,
updated behavioral Playwright coverage, query-order regression, full warmup
guard verification, and the existing review gates.

Planner: APPROVED after accepting the five findings and preserving upstream's
course-visibility filter. The optional Gemini challenge confirmed the need to
define active-to-closed precedence; use existing closed-state behavior. Its URL
rewriting, pre-lookup HMAC validation and narrower metadata proposals are rejected:
URL flags remain meaningful for closed blocks, signing requires the stored
namespace, and activity/course metadata is the explicitly approved feature.
No new rate-limiting layer is part of this bounded correction.

Verification checkpoint (2026-09-06): the authorized integration is committed
as `21f05ef5c`. Root `check:all` and the full build pass in the exact managed
container. The isolated evaluation GraphQL suite passes all five tests, including
invalid-HMAC lookup order and DRAFT/SCHEDULED signed metadata. Redis connection
warnings remain in that mocked-cache suite; this is not response-processing proof.
Browser screenshots confirm enabled, default-off active controls even with both
URL flags true, actual rendered solution/explanation after manual reveal, and
preserved selections after reload. Closed-block manual reveal also works.
The obsolete active-block disabled assertions now check enabled controls,
manual selections, reload persistence and hiding again. The serial Playwright
workflow remains CI-only because its cleanup would erase the retained manual-test
database. Independent reviews and publication are still pending. Keep the exact
activity-info-on-eval runtime running for user testing.

## Goal

Show the LiveQuiz name, publication status, and course name on a valid signed
evaluation embed before the quiz starts, using the existing unavailable-state
notification.

## Non-goals

- Do not expose ElementInstance content, choices, explanations, feedback, or
  result data before publication.
- Do not change evaluation behavior after publication or ending.
- Do not add UI strings, schema fields, persisted operations, seeds, or
  database changes.

## Design

- Domain: `LiveQuiz` activity metadata is safe to display; `ElementInstance`
  snapshots and evaluation results remain unavailable while the activity has a
  non-published `PublicationStatus`.
- Layers: change only `packages/graphql` service behavior and its focused
  service test. The existing `frontend-manage` query and
  `EvaluationUnavailableNotification` already render the returned metadata.
- Auth: the public embed path still requires the existing HMAC over the
  LiveQuiz namespace and id. Invalid or absent credentials continue to return
  `null`; authenticated no-HMAC reads keep their existing READ permission
  check.
- Payload boundary: for a valid HMAC and a DRAFT or SCHEDULED LiveQuiz, return
  activity/course/status metadata with `results: []`. Do not compute or return
  block or element evaluation data.
- Gamification: no impact. Leaderboards, points, and XP are unchanged.
- Async: no impact. Publication scheduling and Hatchet workers are unchanged.
- UI/i18n: no component or translation changes; the existing unavailable state
  is populated by the newly available metadata.
- Fixtures: use the existing seeded draft LiveQuiz in the GraphQL service test
  and the existing local Calendar Live Quiz 2 for browser verification.

## Slices

1. Change the existing draft-HMAC regression to require safe metadata and an
   empty result list.
2. Confirm the test fails against the current status-filtered query.
3. Load the LiveQuiz before status filtering, validate the HMAC, and suppress
   all evaluation results for signed non-published requests.
4. Run the focused GraphQL test/check and repeat the signed browser flow before
   starting the quiz.

## Progress

- 2026-09-18 takeover verification: the synthetic pr4920-devsy-browser runtime
  still refuses managed stop and ensure without a configuration or recreation
  decision, so verification moved to the retained activity-info-on-eval
  runtime. It came up ready under host devrouter 0.0.77 and serves manage and
  pwa over its existing local CA. The activation fix is committed as
  `39d33ccd48` after code generation, 5/5 evaluation and 22/22 aggregation
  vitest suites, both run against a separately provisioned disposable Postgres
  (throwaway container pr4920-pgtest, CI provisioning and guarded-reset paths),
  so the retained manual fixtures in the container database stay untouched.
  Root `check:all` reports 34/35 tasks and fails only on `graphql:check`, which
  compares the committed SDL and therefore needs the commit above. Current-v3
  integration, browser acceptance, publication and exact-head CI remain
  outstanding. Original manual runtime untouched.

- 2026-09-08 ownership recovery: user explicitly approved a narrow retained
  runtime metadata repair preserving containers and data. Validated all eight
  synthetic containers under default-rs-4cec0 and the primary's exact source
  bind mount; recorded default-rs-5a4a0 had no containers. Backed up the exact
  workspace record outside the repository and changed only composeProject.
  Guarded managed stop then succeeded. Independent Devsy status is Stopped
  with zero exact routes. Both normal ensure and ensure --repair now stop at
  "Managed Compose configuration changed for service 'app'". Latest v3 also
  changes PostgreSQL bootstrap to marked disposable databases. Do not alter
  fingerprints to mask that configuration change. Fresh synthetic runtime/data
  recreation requires explicit approval; source, worktrees and original manual
  runtime remain untouched. No tests, commit or push in this recovery step.

- 2026-09-08 latest-v3 continuation: user explicitly requested current target
  integration. Merged origin/v3 at 1a270f33053e12d56df6e4536133753edcaae636
  into the delivery branch as 5be417545d and independently into the synthetic
  verification branch. Both checkouts now pin devrouter 0.0.59, matching the
  installed host CLI. All local changes were restored without conflicts from
  retained safety stashes 1c58cf439d4ebb75bf348f2336fb207256cbcd8b and
  ad6aa89c54068886bb901d08cf260040d2e53cc6, respectively. Diff checks pass;
  delivery is 50 ahead and zero behind origin/v3. Integration hooks were
  disabled because toolchain checks belong in the container and remain pending.
  Updated managed stop still refuses complete retained service-population proof;
  ensure --repair returns "Lifecycle transition is blocked". No ownership
  bypass, deletion, push, PR merge or manual-runtime operation occurred.
  Runtime reconciliation remains the prerequisite for browser verification.

- 2026-09-08 approved recreation checkpoint: exact deletion of the synthetic
  trees/pr4920-devsy-browser runtime succeeded. Independent Devsy lookup then
  reported not found and the exact-source route count was zero; Git was retained.
  Mirrored the activation correction and inspected the executor's browser test.
  Fresh startup passed MCP ownership validation and generated the new nullable
  startedAt SDL field, copied byte-for-byte to the delivery worktree. No lockfile
  drift appeared. Startup began with host devrouter 0.0.57; the host installation
  changed to 0.0.59 during the run without this task modifying it. Startup ended
  with "Lifecycle worker completion is unknown". Current doctor reports a
  degraded process-start transition and foreign managed containers. Exact stop
  refused with "Managed stop cannot prove the complete retained service
  population". Independent Devsy status reports Running and zero exact routes;
  runtime release is blocked, not verified. No ownership bypass, second deletion,
  manual-runtime change, commit or push occurred. Browser and package checks
  remain unrun. Restore supported devrouter ownership reconciliation before
  resuming checks, same-reviewer correction and publication. Fresh target refs
  place audit-pr4920-merge, tracking origin/v3, 49 ahead and 10 behind v3.

- 2026-09-07 restart correction checkpoint: local source now exposes nullable
  StackEvaluation.startedAt and selects it through the new
  GetLiveQuizEvaluationWithActivation operation. Both active reveal storage
  keys include that timestamp. The original query and shared fragment remain
  unchanged for persisted-query compatibility. The existing service regression
  asserts the activation timestamp. Code generation, package checks, browser
  execution and reviewer correction remain pending; no commit or push occurred.
  Canonical ensure of trees/pr4920-devsy-browser failed at the local MCP fixture
  ownership-validation guard following prior test cleanup. No guard bypass or
  data repair was attempted. Exact managed stop succeeded; independent Devsy
  status is Stopped and the exact-source route count is zero. Original manual
  runtime remains untouched. Renewed exact synthetic-runtime deletion and
  recreation approval is needed before managed verification can continue.

- 2026-09-07 activation-identity extension approved: the user approved the
  narrow read-only evaluation API addition, regression tests, browser proof,
  same-reviewer correction pass and ordinary task-branch push. This supersedes
  the earlier no-new-schema restriction only for the block activation timestamp
  and its newly named client query. No database migration or authorization
  change is introduced. Keep the original persisted operation unchanged.
  The final reviewer withdrew its closure-timestamp payload finding after
  confirming that supported transitions cannot change closure time while
  preserving execution and activation time. No extra closure change is needed.
  Main owns API/UI integration and runtime verification; the executor owns the
  existing O1 restart regression. Fresh refs leave the task 49 ahead and nine
  behind origin/v3; reviewed upstream hunks remain disjoint.

- 2026-09-07 integrated review checkpoint: committed head `96ebf221de` has
  unchanged executable source from the passing browser run. The native final
  reviewer found a confirmed restart bug: active reveal storage keys contain
  activity, block and question, but no activation identity. The evaluation API
  does not expose that identity. A reliable fix needs a narrow API-field addition
  outside the approved no-new-schema constraint; user ruling is required.
  The reviewer also proposed a closure timestamp in delayed payloads. Main is
  checking that claim against the approved execution/start ownership contract;
  no supported same-identity closure rewrite has been established. The same
  reviewer `01a07d9f-a93f-7682-8288-597523157d73` is active on that clarification.
  Its report is project/_local/reviews/2026-09-07-pr4920-integrated-final.md.
  Upstream overlap review found disjoint hunks, not a new integration blocker.
  No push or PR-body update occurred. Existing synthetic runtime remains stopped;
  no runtime was touched in this continuation. Original manual runtime untouched.
  Next: obtain the narrow API ruling, fix restart persistence, rerun affected
  checks and browser regression, then the same reviewer's correction pass and
  authorized publication. Keep the two MCP diagnostics outside delivery.

- 2026-09-07 delivery continuation: the implementation head is
  `20087b66a04320caedb5870339dd95fd11636bdb`. Fresh origin refs place the task
  branch 48 commits ahead and nine behind its upstream and resolved target v3.
  The 22-test aggregation and 39-test browser evidence below covers this source.
  Local MCP stage-label diagnostics are outside this evaluation delivery and
  remain unstaged. Main owns integration and publication; a bounded read-only
  explorer checks upstream overlap, and the integrated final reviewer owns the
  remaining independent package review. No merge or deployment is authorized.

- 2026-09-07 fresh-runtime verification: the user explicitly approved deletion
  and recreation of only trees/pr4920-devsy-browser. Exact owner deletion
  succeeded; Devsy then reported workspace not found and route count zero.
  Git worktree and source changes remained intact. Canonical host Playwright
  launcher recreated the same workspace using devrouter 0.0.57. Fresh MCP
  ownership validation succeeded without guard changes. Startup repaired its
  stale chat cache through the repository's existing bounded repair path.
  All 39 Chromium O1 tests passed in 5.0 minutes, including the formerly failing
  cockpit start/abort/restart, real student submissions, mobile evaluation,
  signed embeds, results, closed solutions, duplication and deletion.
  Verified backend files match committed 20087b66a04320caedb5870339dd95fd11636bdb
  byte-for-byte. No lockfile or public-schema drift appeared. Exact synthetic
  stop completed after the final browser check; Devsy independently reports
  Stopped and exact-source route count is zero. Data preserved. Original manual
  runtime untouched. This supersedes the preceding runtime/browser blocker.
  Integrated review, publication and exact-head CI remain outstanding.

- 2026-09-07 recovery continuation: fetched refs; task is 48 ahead and seven
  behind v3, with PR head still fec32afea and mergeable. Explicit manage-profile
  startup replayed the recorded full profile and failed at MCP ownership
  validation before diagnostic access. Doctor confirms process-start degraded
  state; stop preserves that degraded transition even while all exact services
  and processes are stopped. No supported exec recovery option is exposed.
  Ownership guard and devrouter state were not bypassed or edited. Repeated
  startup cannot resolve the fixture through the managed interface. Exact stop
  completed; provider and route verification performed. A supported devrouter
  diagnostic recovery path is needed before another synthetic fixture repair.
  No source changes, push, merge or deployment in this continuation.

- 2026-09-07 terminal runtime blocker: synthetic stop completed and Devsy
  independently reported Stopped; the owner freed ten routes. Canonical browser
  restart then failed before tests: local MCP seed repair refused ownership
  validation, and managed post-start left degraded process drift. A read-only
  dry-run diagnostic through devrouter exec was rejected with Lifecycle
  transition is blocked. Final synthetic stop completed; Devsy independently
  reports Stopped and the exact-source route inventory is empty. No deletion.
  Browser cleanup and MCP seed ownership need a compatible runtime recovery
  path before another O1 run. Do not bypass the ownership guard. Correction
  `20087b66a04320caedb5870339dd95fd11636bdb` remains local with 22 passing tests;
  no push, final-review completion, merge or deployment. Original manual runtime
  untouched. Two local MCP diagnostic edits remain unstaged and outside delivery.

- 2026-09-07 current checkpoint: closure/end race correction is committed as
  `20087b66a`; 22 aggregation tests, formatting, GraphQL typecheck and staged
  gitleaks pass. No push occurred. Fresh O1 browser verification stopped at
  seven passing tests, one failure and 31 unrun tests. The screenshot shows
  cockpit 404; the manage log reports PageNotFoundError/ENOENT for the dynamic
  cockpit page. This is missing page-module evidence, not a selector failure.
  Managed repair refuses because the runtime is not recorded degraded.
  Exact synthetic-runtime stop requested to clear stale process state without
  deleting data. Next: complete stop, restart exact workspace, rerun O1, release
  synthetic runtime, finish required review and publish. Retained manual runtime
  untouched. Independent slice reviewer found the end race after its correction
  pass; reassess recovery scope before further review loops. Its report and the
  simplifier result are saved under project/_local/reviews. Both children closed.

- 2026-09-07 restored-runtime checkpoint: managed stop reconciled three stale
  synthetic routes, then manage ensure succeeded without recreation using host
  devrouter 0.0.57. The rollback/historical-cache correction is committed at
  `7627f6465ff5b7e1819be3465af59e4a35e5ca5b`. Its 21 aggregation tests, GraphQL
  check, root 35-task check, seven-task lint, syncpack and 23-task full build
  passed. Existing build warnings remain. Correctness review accepted the
  original fixes but identified a concurrent end-of-quiz closure race; the
  minimal follow-up permits ENDED with unchanged block identity and suppresses
  stale running-state publication. All 22 aggregation tests, formatting and
  GraphQL check pass with that follow-up. The independent thirteen-file
  simplifier found no justified reduction. Reports are in project/_local/reviews.
  The approved exact synthetic MCP fixture restoration passed its dry-run and
  ownership guards; no real data or global configuration changed. A fresh
  39-test host Chromium O1 run is active on the corrected source. Runtime release,
  remaining review gates, final publication and exact-head CI remain pending.
  Original manual-testing runtime remains untouched. This entry supersedes the
  stale Docker-unavailable and 20-pass/one-failure checkpoint below.

- 2026-09-07 rollback and historical-cache correction checkpoint: resumed the
  existing Luna correctness reviewer and verified both findings. Two new real
  PostgreSQL/Redis regressions initially fail with the previous 14 tests passing.
  Local source now commits activation/closure before a second parent-locked,
  identity-checked cache phase, avoiding Redis writes for rolled-back identities.
  Rollback, second-phase failure and intervening activation tests pass; GraphQL
  typechecking passes for that correction. Historical cache may be absent only
  when its complete block namespace is absent; target and surviving cache stay
  strict. Main corrected the executor's indexing defect and changed the Lua
  absence check to inspect the whole historical namespace atomically. The worker
  is closed. Final combined source is mirrored into trees/pr4920-devsy-browser.
  The last completed suite had 20 passing tests and one indexing failure before
  those final corrections; this is not a green result. Final format/test/check
  invocation could not start: Docker daemon unavailable at the OrbStack socket.
  No final formatting, final regression proof, correction review, commit, push,
  CI or merge occurred. Existing MCP diagnostics and other dirty files preserved.
  Synthetic workspace had resumed successfully under manage profile without
  recreation; shutdown requested after Docker became unreachable. Runtime release
  remains unverified until owner stop and independent provider/route checks work.
  Original retained manual-testing runtime untouched. Next: restore host Docker,
  finish exact-source formatting and regressions, review failure recovery and
  second-phase races, then applicable independent reviews and publication gates.
  Task branch audit-pr4920-merge remains at a9e1cccbf8, tracking origin/v3,
  46 ahead and 4 behind fetched target; PR remote remains fec32afea6.

- 2026-09-07 verification rerun: all 39 Chromium O1 live-quiz tests pass
  in 4.9 minutes on the exact synthetic Devsy workspace. This supersedes the
  earlier 38-pass result and verifies the corrected deletion helper, required
  leaderboard confirmation and reset, active reveal controls, signed embeds,
  response lifecycle, closed-block solutions and 390px overflow checks.
  The current manage typecheck, focused Prettier and navigation Biome checks
  pass. Main and synthetic UI/test files match byte-for-byte. The host launcher
  selects devrouter 0.0.55 and its isolated host browser toolchain; changing
  the outer Volta Node selection resolved a different incompatible devrouter,
  so the previously verified launcher path was retained. Startup emits existing
  build warnings; the separate manage typecheck passes.
  The user approved Luna max for the independent aggregation correctness review.
  Generic-continuity reviewer `01a07c9b-b3cb-7a12-935c-9c484885294a` remains active
  on the committed seven-file aggregation slice. The configured Combo credit
  failure is not treated as recovered. Synthetic shutdown has been requested
  after the successful suite. Devsy now reports Stopped and the independent
  exact-source route inventory contains zero routes. Data is preserved.
  The verified UI/deletion follow-up is committed as
  `a9e1cccbf822a5049256363aa6c69acf52272f1d`; staged secret scan and diff inspection
  pass. Host hooks were disabled because checks ran in the managed container.
  Its applicable reviews, integrated final review, push
  and current-head CI remain pending. No merge or deployment is authorized.

- 2026-09-07 browser and aggregation follow-up: delayed aggregation is committed
  locally as `c7d9053fc06985a8df5d0ba8b38fde780ae55277`. The independent simplifier
  completed with no justified simplification. Correctness review is still
  pending: the configured provider returned an insufficient-credit error, and
  the proposed Luna review-model substitution awaits the user's ruling.
  Nothing was pushed or merged.
  The fresh synthetic O1 browser run passes 38 of 39 tests, including signed
  embeds, live submissions, evaluation contents, active reveal controls,
  reload persistence, 390px horizontal overflow and closed-block solutions.
  The final deletion test now proves leaderboard confirmation is required
  and reset on reopening. Its later duplicate-quiz deletion fails because an
  immediate visibility check runs before the summary dialog mounts. The helper
  now awaits that dialog and uses its structured confirmation selector instead
  of a prose assertion and XPath fallback. This latest correction needs a rerun.
  A separate intervening run stopped at a stale manage cockpit route; the
  documented managed repair restored it before the 38-pass run.
  Manual delegated login succeeds. Desktop evaluation displays nonempty results
  and exactly two block tabs. A fresh 390px screenshot exposed the fixed-height
  navigation wrapper overlapping the question/chart; it now grows on mobile,
  preserving the desktop height. The corrected screenshot shows the question
  and chart unobscured, with viewport and document both 390px wide. The result
  panels remain scrollable above the footer. Evidence is retained at
  `/private/tmp/pr4920-evaluation-desktop-final.png`,
  `/private/tmp/pr4920-evaluation-mobile-final.png` (before), and
  `/private/tmp/pr4920-evaluation-mobile-fixed.png` (after).
  The latest helper and navigation fixes remain uncommitted and require focused
  checks, the full browser rerun and applicable reviews before publication.
  The focused container check and guarded fixture restoration could not start:
  the automatic permission reviewer timed out on the initial command and its
  single permitted retry. This is a host capability blocker, not a test failure.
  No fourth O1 run started. The manual browser session is closed. Synthetic
  runtime shutdown also failed to start: the automatic permission reviewer
  timed out on both the initial owner command and its one permitted retry.
  Read-only Devsy status reports `rs-pr4920-devsy-browser` as `Running`.
  Route inventory is unverified because the host route-update lock identity
  check failed. Shutdown remains required once host approval capability works;
  no raw Docker or Devsy mutation was substituted. The original manual-testing
  runtime is untouched. Resume with the exact synthetic source path, finish
  checks and browser rerun, then stop and independently verify provider state
  and zero routes. Data and worktrees are preserved.

- 2026-09-07 approved alternate synthetic PIN: the logging-only dry run
  passes with an unused PIN selected from a bounded test range. The guarded
  write transaction commits one course, one chatbot, its canonical disclaimer
  and two MCP configurations. Existing records are untouched and the ownership
  guard passes against the inserted relationships before commit. Managed
  startup passes MCP seed repair and starts `klicker-local-mcp`. The producing
  `ensure --repair --json` exits successfully with managed status `ready`, full
  active profile, healthy services, both managed processes running, no drift
  and no recreation. Response API readiness returns HTTP 200, and both Hatchet
  workers are observed live. This is startup proof, not complete evaluation
  browser acceptance. The repair script stays
  ignored and refuses a second insertion if these parent records exist.
  A fresh isolated agent-browser session opens the routed lecturer URL and
  renders the authentication page without a certificate or route error.
  Screenshot: `/private/tmp/pr4920-restored-runtime.png`. This smoke check
  does not exercise login, evaluation controls, or the full serial O1 suite.
  After the smoke check, managed stop frees ten routes. Independent Devsy
  status confirms `rs-pr4920-devsy-browser` is `Stopped`; exact-checkout route
  count is zero. Repaired data is retained, and the original manual-testing
  runtime remains untouched. No commit, push, merge, or deployment occurred.

- 2026-09-07 expanded synthetic restoration: the user approved restoring the
  exact seeded course, chatbot and two MCP configurations. The canonical
  chatbot disclaimer is also absent and was included as its required seed
  dependency. The logging-only preflight passes. The write transaction fails
  on `Course_pinCode_key` (SQLSTATE `23505`) and rolls back every insert,
  including the disclaimer. No existing record was updated or deleted.
  The seed PIN is already assigned to another course. Do not overwrite that
  course or substitute a different PIN without a user ruling. Browser startup
  remains blocked by the incomplete synthetic fixture. The integrated source
  remains at `50f5278f93`; refreshed `origin/v3` has one additional CI-only
  credential-separation commit (`2b8e6716fc`), not integrated again.
  The exact synthetic checkout was stopped through devrouter; independent
  Devsy status reports `Stopped` for `rs-pr4920-devsy-browser` and route
  inventory reports zero exact routes. Data is retained. The original
  activity-info-on-eval runtime is untouched under its keep-running ruling.

- 2026-09-07 approved MCP relationship restoration: the guarded dry run
  refuses to write because the canonical synthetic chatbot and its course
  are both absent; the synthetic owner exists. No database writes occurred.
  Restoring only two MCP configurations cannot satisfy the missing foreign
  keys. Repair now requires restoring the exact seeded course and chatbot
  as well as their MCP configurations, outside the approved relationship-only
  change. The dry-run script stays ignored in the synthetic checkout at
  `project/_local/mcp-repair.mjs`. Do not run a broad reset or reseed.

- 2026-09-07 MCP diagnosis: safe constant stage labels isolate managed startup
  failure to seed ownership validation. A read-only query of the identified
  synthetic KB server confirms its expected local URL, active state, chatbot
  ID forwarding, default header and legacy authentication/parameters, but
  finds zero linked ChatbotMCPConfig records. The guard requires two, for
  tutor and explainer, so startup rejects this incomplete seed. The reason
  those records are absent remains unverified. No database repair occurred.
  Both diagnostic files pass syntax and formatting checks; edits are local.
  Restore the missing synthetic fixture relationships before retrying startup;
  do not weaken the ownership guard or reset the retained manual-test data.
  Exact synthetic workspace `rs-pr4920-devsy-browser` is verified Stopped
  with zero matching routes after diagnosis. Original runtime is untouched.

- 2026-09-07 target integration: the user requested the latest target branch.
  The live evaluation PR still targets `v3`. Fetched tip `65ae8a3523` was merged
  once into `audit-pr4920-merge` as `50f5278f93`, with no conflicts and all local
  evaluation changes preserved. The synthetic verification branch was
  fast-forwarded to the same commit. Host Git hooks were disabled for this
  integration because the equivalent checks must run in the container.
  Managed startup refuses a scoped profile while the old state is degraded.
  Canonical repair now fails at upstream's authenticated local MCP fixture
  startup, before application readiness. Post-integration frozen installation,
  full build (23 tasks), GraphQL/manage type checks and all 14 real aggregation
  regressions pass. Root check:all cannot run unchanged inside the container:
  upstream's Playwright profile contract requires the host Devrouter binary.
  Split execution passes all 35 container tasks, 24 host runner/profile tests,
  and 62 CI contract tests on the host. Existing focused formatting proof is
  unchanged; git diff --check passes. Browser acceptance and independent
  reviews remain pending. No push or PR mutation occurred.
  Managed stop completed for the exact synthetic checkout; Devsy reports
  `Stopped` and the route inventory contains zero source-path matches.
  Original manual-testing runtime and all data remain untouched.

- 2026-09-07 aggregation implementation checkpoint: source changes remain
  uncommitted on `audit-pr4920-merge` at `fec32afea6`. Task payloads now carry
  execution and activation time. Immediate closure and activation hold the
  parent quiz lock through awaited cache writes. Delayed aggregation selects
  the matching executed block without disconnecting a newer active block or
  changing its closure time. Assessment responses remain cumulative within
  the matching execution. Cache expiry follows a successful persistence
  transaction, rereads the original ownership snapshot, and atomically checks
  cache metadata before applying the existing one-day retention.
  Reactivation clears the old closure cache marker, which response workers
  otherwise use to reject submissions. Whole-quiz expiry is skipped while a
  block is active. Legacy jobs without execution identity fail visibly; the
  approved old-worker queue-drain prerequisite remains mandatory before release.
  No live queue inspection, replay, deployment or comment reply occurred.
  The exact synthetic verification checkout is `trees/pr4920-devsy-browser`,
  workspace `rs-pr4920-devsy-browser`. Its 14 real PostgreSQL/Redis tests pass,
  including stale ownership before and between transactions, partial cache,
  failed persistence, cumulative assessment responses, atomic expiry, and
  reactivation. Each test removes only its own synthetic rows and cache keys.
  Shared-package builds and the GraphQL check passed. The full build passed
  all 23 tasks, and root check:all passed all 35 tasks. A separate Biome
  formatting check passed for the six changed TypeScript files; the 14-test
  service suite passed again against rebuilt packages at 13:45 UTC.
  Full browser verification remains blocked:
  published devrouter 0.0.55 repair still reports preparation left running
  children, although container commands work. Do not treat these service tests
  as browser proof or as a completed independent review. Complete the remaining
  gates before commit and publication; merge remains excluded.
  At this checkpoint, managed stop completed for the exact fresh checkout.
  Devsy reports `rs-pr4920-devsy-browser` as `Stopped`, and the independent
  route inventory contains zero routes for its source path. Data and worktrees
  are preserved. The original activity-info-on-eval runtime remains untouched
  under the user's keep-running instruction.

- 2026-09-07 execution approval: the user accepted proceeding after the
  planner round limit with both documented corrections. Implement the
  aggregation contract in the local review report, including serialized
  closure timestamps and cumulative same-execution assessment responses.
  This is human approval with documented planner dissent, not a passed
  planner verdict. Main owns the coupled database/cache lifecycle changes
  and regression proof; the executor owns only payload/type wiring and its
  existing callers. Deployment and live queues remain outside authority.
- 2026-09-07 aggregation compatibility ruling: the user approved requiring
  existing queued aggregation jobs to finish under the old worker before
  deploying the updated producer and worker. This is a release prerequisite,
  not evidence that queues have drained or authority to inspect or change
  live queues. Source implementation and verification remain authorized;
  deployment remains excluded. Unexpected execution-less payloads must fail
  visibly rather than silently skip assessment aggregation. Preserve the
  existing one-day cache expiry and bind new work to the originating block
  execution. The revised aggregation contract reached the three-round planner
  limit without approval (`review_deadlock`). The remaining corrections are
  locking the closure's cache timestamp write and explicitly preserving
  cumulative assessment responses within a single execution. The complete
  findings and accepted corrections are recorded in
  `project/_local/reviews/2026-09-07-pr4920-aggregation-plan-hardening.md`.
  The later execution approval above resolves the review-limit decision.
  The UI-only approval and existing local patches remain valid. The task
  branch remains `audit-pr4920-merge`, tracking `origin/v3`, now 43 commits
  ahead and 8 behind it after fetching; no further integration was made.
- 2026-09-07 verification checkpoint: the missing leaderboard-deletion
  confirmation and cancellation/reopen regression are implemented locally.
  The exact modal and O1 test changes are mirrored into the fresh verification
  checkout. Its Playwright package TypeScript check and Prettier check pass;
  the O1 spec uses `@ts-nocheck`, so the package check does not prove that
  spec's types. `git diff --check` passes.
  Main added the 390px document-overflow and reveal-control regression to O1;
  its formatting passes, but browser execution remains blocked. The responsive
  executor was closed after failing to produce a patch following its narrowing
  checkpoint. Main implemented the bounded navigation/footer wrapping,
  minimum-width containment, and mobile chart/sidebar stacking in eight
  evaluation components. The exact mirrored source passes Biome formatting
  and the manage TypeScript check. All follow-up edits remain uncommitted and
  unpushed pending browser acceptance and the existing review gates.
  These static checks do not replace the blocked full browser run.
  The PR remains open at `fec32afea60b8b0a9741db58f3967adafd69c132`, mergeable
  but blocked with changes requested. The task branch tracks `origin/v3` and
  stands 43 commits ahead and 7 behind it; no further integration was made.
  Managed stop completed for the fresh verification checkout and the exact
  Devsy workspace `rs-pr4920-devsy-browser` reports `Stopped`. Data and both
  worktrees are preserved. The independent route inventory contains zero
  routes for that exact checkout.
- 2026-09-07 follow-up: user approved completing the browser-discovered
  deletion and responsive-layout defects. Source and remote PR head are
  `fec32afea60b8b0a9741db58f3967adafd69c132`. Current CI tests and final AI
  review pass; GitGuardian fails and GitHub still reports changes requested.
  The fresh synthetic Devsy browser evidence is retained locally at
  `/private/tmp/pr4920-devsy-verification.md`; it proves the core evaluation
  lifecycle but records a failed final deletion and 764px document width at
  a 390px viewport. Earlier statements that browser proof remained wholly
  pending are superseded by that evidence.
  The planner approved the UI-only follow-up: restore the existing leaderboard
  confirmation and extend O1 behavior checks; make evaluation navigation,
  panels and footer usable at 390px while preserving desktop behavior.
  Executors own the separate modal/test and evaluation-component paths;
  main owns integration and container/browser verification. No new dependency,
  schema, authorization or product primitive is introduced. Existing deletion
  confirmation and evaluation presentation semantics are reused.
  Follow-up acceptance requires a green serial O1 run, confirmation reset on
  reopening the dialog, no document overflow at 390px, reachable controls and
  preserved desktop layout. Keep the existing commit and review gates.
  At that checkpoint, aggregation remained unimplemented: execution-less queued assessment jobs
  cannot reliably distinguish an aborted/restarted execution. Dropping those
  jobs would skip their final aggregation and needs an explicit compatibility
  ruling. The later queue-drain ruling above supersedes this decision blocker.
  The exact fresh verification workspace is
  `/Volumes/HOME/Git/klicker/klicker-uzh/trees/pr4920-devsy-browser`.
  Both managed startup and one supported repair failed because preparation
  left running children; container commands still work. No upstream integration,
  push, merge, deployment or comment replies are part of this checkpoint.
- 2026-09-06 follow-up: the exact retained activity-info-on-eval runtime
  recovered through the published devrouter 0.0.55 `ensure --repair` command.
  The producing run reported ready, no drift and no recreation. The manage
  route returned HTTP 200 using the existing local CA. Keep it running for
  manual testing. A separate devrouter worktree at
  `/Volumes/HOME/Git/personal/devrouter/trees/preparation-child-reaping`
  contains an uncommitted bounded child-drain fix: the Linux regression suite
  passes with the patch and fails against published 0.0.55 at the new transient
  child test. Final cleanup, review and publication remain pending because the
  automatic permission reviewer timed out twice on the separate-worktree edit.
  The user subsequently confirmed evaluation works and requested that the
  separate devrouter repair move to its own task. That repair does not block
  this evaluation PR; the retained runtime is recovered using published 0.0.55.
  Evaluation publication is authorized, with final review and exact-head CI
  still required before reporting merge readiness. Do not merge the PR.
- 2026-08-26: Reproduced the missing metadata on Calendar Live Quiz 2 and
  captured the pre-fix screenshot.
- 2026-08-26: Traced the null payload to the HMAC-only PUBLISHED/ENDED Prisma
  filter in `getLiveQuizEvaluation`; confirmed the frontend needs no change.
- 2026-08-26: Added the metadata-only HMAC regression and confirmed it fails
  against the previous status-filtered lookup (`null` instead of metadata).
- 2026-08-26: Updated the service to validate the HMAC and return early with
  `results: []` for non-published signed requests.
- 2026-08-26: Focused GraphQL evaluation suite passes (4/4), GraphQL package
  check and build pass, and the signed browser view shows the Draft activity,
  course, and status metadata while retaining the unavailable notice.
