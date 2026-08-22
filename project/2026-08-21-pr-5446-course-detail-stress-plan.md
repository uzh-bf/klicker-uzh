# PR #5446 follow-up: course detail route and stress fixture

## Goal

Keep the async course-duplication implementation usable in the manage app by
fixing the missing course-detail route and add an opt-in local fixture with a
large, deterministic activity set for manual stress testing.

## Authority and boundaries

- The user authorized this implementation with “proceed” and previously asked
  to push the branch. Push only `origin/fix/course-duplication-timeout` after
  the checks below; do not merge, deploy, or change production data.
- The existing workspace runtime must remain running for the user's manual
  verification. Runtime-only route registration is out of source scope.
- Do not update the production-readiness report, add logs, or change unrelated
  docs. This plan is the single active execution artifact for the PR.

## Evidence and design

- The running Manage dev server has `src/pages/courses/[id]/index.tsx`, but its
  Turbopack pages manifest omits `/courses/[id]` and requests log
  `PageNotFoundError: Cannot find module for page: /courses/<id>`.
- First test a route relocation from `[id]/index.tsx` to `[id].tsx`; preserve the
  nested assessment routes and adjust only imports made relative to the moved
  file. Keep the change only if both the manifest and runtime prove discovery.
- Add a development-only `seed:course-duplication-stress` script. It requires
  `COURSE_DUPLICATION_STRESS_WRITE=true` before it writes one fixed course owned
  by the seeded lecturer and 200 fixed-ID, empty, DRAFT live quizzes. The
  fixture is intentionally not part of `seed:raw`; rerunning it must leave
  exactly the same course and activity counts.

## Slice list and acceptance

1. **S0 — Baseline and plan (complete).** Merge current `origin/v3` normally
   (without rewriting history) and record the fresh branch state.
2. **S1 — Route discovery.** Record the failing manifest, relocate the page if
   the A/B check confirms the fix, run the Manage package check, and verify the
   detail route plus both assessment child routes are discoverable.
3. **S2 — Stress seed.** Add the script and package command with an
   `ENV=development` guard plus an explicit
   `COURSE_DUPLICATION_STRESS_WRITE=true` write opt-in, upsert the fixed course
   and 200 activities, run one course-level derived-permission recomputation,
   and run the seed twice. Verify one fixture course, exactly 200 expected quiz
   IDs, zero blocks, ownership and course linkage, readable derived permissions,
   and unchanged counts on rerun.
4. **S3 — Integrated verification.** Run repository-native checks in the
   container. Use the authenticated browser path to open `/courses`, the stress
   course detail, all 200 activities, and the duplication modal without
   submitting a job. Keep screenshots and review artifacts under ignored
   `project/_local/`; if delegated authentication remains blocked by the known
   Auth asset 400, report that gap separately and stop before claiming readiness.
5. **S4 — Publish.** Run the required simplifier, risk-selected slice review,
   and final package review. Inspect the staged diff for secrets and personal
   data, commit conventional messages, push normally to the named branch, and
   read back the remote SHA. Leave the runtime running.

## Review and test portfolio

- No duplicate end-to-end test is added: the existing course suite already
  covers navigation and duplication behavior. The seed's two-run database
  assertions are the new fixture-specific acceptance check.
- The route slice receives a simplifier pass after its commit. The seed slice
  receives a simplifier and data-integrity review. A final reviewer checks the
  integrated committed range before publication.

## Progress

- 2026-08-21: Confirmed the 404 is Next route discovery, not a missing course;
  the source exists while the runtime manifest omits the dynamic page.
- 2026-08-21: Rebased the branch by a normal merge of current `origin/v3`.
- 2026-08-21: Relocated the detail page to `courses/[id].tsx`, adjusted its
  relative imports, and proved Manage and both assessment child routes return
  HTTP 200. The focused Manage typecheck and route simplifier passed.
- 2026-08-21: Added the opt-in stress seed with a local-database target guard,
  fixed UUIDv5 activity IDs, and course plus live-quiz OWNER permission checks.
  The container typecheck passed and two consecutive runs produced exactly 200
  empty DRAFT live quizzes.
- 2026-08-21: Diagnosed Hatchet as an environment and worker-runner issue,
  not a Hatchet service outage. The managed workers now compile with Rollup,
  run under nodemon, and both worker types connect and remain alive.
- 2026-08-21: Removed the generated PR documentation, readiness report, and
  screenshots per request; this plan remains the only active project artifact.
- 2026-08-21: The local Auth page's cold Turbopack compile stalled indefinitely;
  the supported Webpack development fallback now serves the same page. After
  clearing the generated Manage cache, the browser delegated-login flow opens
  the stress course, renders all 200 activities, and opens the duplication
  dialog without submitting a job.
- 2026-08-21: The first integrated final review found that direct Hatchet audit
  events could be misread as `{ message }` envelopes. The callback now accepts
  both direct event payloads and the existing nested task envelope; the Hatchet
  package check and a two-shape payload smoke passed.
- 2026-08-21: The async completion boundary now uses the job UUID as the
  duplicated course UUID, detects an already-committed course on retry, keeps
  committed jobs retryable when Redis publication fails, and retries the
  Hatchet task three times. Rebuilt GraphQL and worker bundles were used for
  two local runs: Hatchet received both events and both steps succeeded. The
  rebuilt run completed job `51c4cd2c-c5e8-4ffc-8d0f-336583112676` with the
  same created-course ID and exactly 200 live quizzes with OWNER permissions.
- 2026-08-21: A controlled retry of that completed job found the existing
  course, returned the job to `COMPLETED`, preserved the stable ID, and did not
  create another copy.
- 2026-08-21: The freshness gate found `origin/v3` advanced to `f58986faa`
  (`#5467`); a normal merge into this branch completed without conflicts. The
  merged GraphQL package rebuilt successfully, and the Manage, Hatchet, and
  Prisma-data focused checks passed. The generated build changed only
  newline-only artifacts, which were restored.
- 2026-08-21: The integrated review found an ambiguous Hatchet publication
  acknowledgement, swallowed generic worker errors, and a legacy global HTTP
  timeout. The producer now retries the same job id and keeps its source lock
  when publication remains ambiguous; generic worker errors are rethrown for
  Hatchet retries; and the global HTTP and ingress timeout changes are removed.
- 2026-08-21: A follow-up review found that a crashed worker could leave the
  per-job process lock until its long stale interval. The lock now uses a
  renewable 60-second lease with an execution token, and lock collisions fail
  the task so Hatchet can retry. The GraphQL check, GraphQL build, Manage route
  checks, and worker liveness checks passed after the fix; generated
  newline-only outputs were restored. The repository hook still reports an
  unrelated existing Chat route-type failure.
- 2026-08-21: The final review also required the Hatchet task timeout to exceed
  the ten-minute duplication transaction and a recovery path after both event
  publication attempts fail. The task now allows 15 minutes, and a later
  mutation retry republishes the same pending job id. Focused checks and the
  final review passed; the next step is the normal push to
  `origin/fix/course-duplication-timeout`. No full `check:all` or build claim is
  made for the repository hook.
- 2026-08-21: The final review also required lease-aware retry spacing, pending
  job republishing on lock contention, and an explicit stress-seed write
  opt-in. Hatchet now backs off 60 seconds before the first retry, both
  pending-job paths republish the stable id, and the seed defaults to dry-run
  until `COURSE_DUPLICATION_STRESS_WRITE=true` is provided.
- 2026-08-21: Final committed review passed at `e5bec3ad1`. The retained
  `fix-course-duplication-timeout` DevPod is running with four registered
  routes; Manage, assessment results, and Auth return HTTP 200, and both
  Hatchet workers are running without the prior watch-mode crash signature.
- 2026-08-21: A Sol review found the Auth Webpack switch was based on one cold
  compile observation, not a general incompatibility. Auth now restores
  Turbopack for the default `dev` command and exposes `dev:webpack` as the
  explicit fallback; the Hatchet Rollup plus nodemon runners remain in place.
- 2026-08-21: Updated the DevPod notes, frontend conventions, and worker
  solution pointer to match the runner behavior. Prettier, Auth, and both
  worker package checks passed; the wiki validator still reports unrelated
  pre-existing ADR and solution frontmatter errors.
- 2026-08-21: The first post-push check caught only syncpack ordering in the
  new Auth script; commit `61505327d` moved `dev:webpack` after `dev:test`,
  and the follow-up push build completed all 23 tasks. The latest PR checks
  report syncpack passed; remaining checks are still running, while SonarCloud
  reports 5.7% duplicated new code against its 3% quality-gate limit.

## Follow-up phase: extract the course duplication module

### Research

- The current branch is clean at `ff7321a5bccd2f3fc523d5705ddbe785625e0cba`,
  35 commits ahead of and 0 behind `origin/v3` at `f58986faa8cfa4ff78d20a1ebeb1666473343d38`.
- Duplication occupies `packages/graphql/src/services/courses.ts:2694-4218`
  across Redis/Hatchet orchestration, permission checks, date shifting, and
  transactional activity copying.
- Its external callers are the mutation and query resolvers, the Hatchet
  handler registration, and the date-shifting unit test. Existing duplication
  browser coverage protects the copy, rollback, assessment, group-selection,
  and permission behavior.
- The activity manipulators do not import `courses.ts`, so a new module can
  import `createCourse` one way without a cycle.

### Problem

`courses.ts` owns ordinary course operations and roughly 1,500 lines of
duplication-specific orchestration and copying. That makes the duplication
workflow harder to locate and review without creating a second deployable
service.

### Decision

- Add the internal module
  `packages/graphql/src/services/courseDuplication.ts`.
- Move all duplication constants, types, Redis/Hatchet lifecycle, permission
  checks, date helpers, activity-copy helpers, and `duplicateCourse` into it.
- Keep `createCourse` and its standalone transaction in `courses.ts`; export
  only the narrowed internal creation-argument type needed by the new module.
- Rewire the GraphQL mutation/query resolvers, handler registry, and date test
  to the new module. Keep the public GraphQL contract, generated files, task
  types, context, manipulators, and transaction semantics unchanged.
- Do not split orchestration from copying, add a generic activity adapter, add
  a deployable service, add an ADR, or add a `docs/log` entry.

### Risk

- A partial move could change transaction scope, permission checks, date
  shifting, error classification, lease handling, retry/idempotency behavior,
  or stable job IDs.
- Moving a large block may not reduce Sonar's duplicated-new-code metric;
  that is a separate scope decision and does not justify a generic adapter.

### Test portfolio

| Consequential behavior | Obligation | Primary evidence |
| --- | --- | --- |
| Zurich calendar-day shifting | Extend existing | Focused `courseDuplicationDates.test.ts` after its import moves |
| Resolver and worker wiring | No new test | GraphQL check/build and unchanged generated schema/operations |
| Atomic copy and rollback | No new test | Existing Chromium duplication cases |
| Assessment, groups, and permissions | No new test | Existing focused duplication cases |
| Async retry/idempotency | No new test | Move-only diff inspection and existing completed-job verification |

### Delegation map and slices

- **S0 — plan amendment:** `main`; record this phase in this file, commit
  `docs(project): plan course duplication module extraction`.
- **S1 — module extraction and wiring:** `main` owns the cross-module seam;
  mechanical edits may use one native executor only after S0. Acceptance is a
  focused date test, GraphQL check/build, no generated-schema delta, and an
  acyclic one-way import.
- **S2 — source references and progress:** `main`; update only the exact
  `docs/domain-model.md` and `docs/async-and-workers.md` ownership references,
  with no runtime log. Acceptance is Markdown formatting and path readback.
- **S3 — integrated gate:** `main`; run the existing Chromium duplication
  cases, inspect the full diff, obtain simplifier and risk-selected slice
  review for S1, then an integrated final review before publication.

### Authority, terminal, and pause

- The user authorized planning and execution against PR #5446. Local edits,
  commits, normal push to `origin/fix/course-duplication-timeout`, and remote
  SHA readback are in scope. Merge, deploy, production data changes, runtime
  deletion, and force-push remain withheld.
- Terminal state is the reviewed, verified extraction committed and pushed to
  the named PR branch, with the retained DevPod left running for manual use.
- Pause before publication if the move requires a public contract, context,
  Hatchet task/type, manipulator, sharing, deployment, import-cycle, or
  behavior change; if focused duplication verification cannot run, record the
  delivery gap instead of claiming readiness.

### Progress

- S0 is complete in `ebe41b5ab` after the Sol planning pass. S1 is committed
  in `78d8d92d7`; the new module owns the duplication workflow, callers point
  to it, and `createCourse` remains in `courses.ts`.
- Host fallback verification passed the GraphQL package check, the focused
  date suite (6 tests), and the GraphQL build (exit 0 with existing Rollup
  warnings). The canonical DevPod check remains blocked by the known
  devrouter lifecycle-lock error.
- S1 still requires its simplifier and architecture/data-integrity slice
  reviews. S2 is the exact documentation-reference update in the working
  tree; S3 remains the integrated duplication verification, final review,
  and normal push to the named PR branch.
- The S1 fallback Sol reviews completed with no correctness, authorization,
  transaction, retry, or idempotency findings. They requested only restoration
  of the stable-job-ID comment and removal of unused Day.js plugin setup;
  correction commit `deb1bc736` contains both. The configured Gemini review
  routes were unavailable because their effort configuration was rejected, so
  the trusted Sol fallback was used and recorded.
- The focused GraphQL check and six date tests passed after `deb1bc736`.
  A second host build emitted the bundle but did not terminate cleanly and was
  stopped; the earlier full GraphQL build at `78d8d92d7` exited 0. Generated
  newline-only changes were restored. The canonical Chromium duplication run
  is delivery-pending because `devrouter exec` still cannot acquire the
  workspace lifecycle lock.
- The integrated final review passed for
  `ff7321a5bccd2f3fc523d5705ddbe785625e0cba..fc3ea33aa` with no findings.
  Its report is retained under `project/_local/reviews/`. The remaining action
  is the authorized normal push to `origin/fix/course-duplication-timeout`,
  followed by remote SHA and PR-check readback; merge and deployment remain
  withheld.

## Follow-up phase: completion notification UX and merge gate

### Settled decisions

The grilling session on 2026-08-22 settled the following behavior for the
existing asynchronous **course duplication job**:

- A status response is paired with the exact request ID set that produced it.
  The frontend prunes only missing IDs from that matching request set, so a
  newly added concurrent job cannot be removed using an older response.
- Completion never navigates automatically. Each successful job shows a clear
  success toast with a separate localized action (`Open course` / `Kurs
  öffnen`) that routes to that copied course when the user chooses it.
- A completion discovered after reload uses the same action because navigation
  is explicit and does not depend on the original route.
- Multiple completions produce separate toasts, each mapped to its own copied
  course. No automatic winner is selected.
- Actionable success toasts remain visible for 30 seconds and retain the normal
  close control.
- The Hatchet attempt limit remains 15 minutes. This exceeds the ten-minute
  duplication transaction limit; the 30-minute stale-job threshold is recovery
  policy, not the expected attempt duration.
- The canonical engineering term remains **course duplication job**. Update
  only the existing domain-model, worker, i18n, and Playwright surfaces. No
  ADR, `CONTEXT.md`, feature log, or second documentation root is needed.

### Problem

The current provider compares the latest `jobIds` with a response that may
belong to the previous variable set, and it automatically routes on every
completion. The behavior is unsafe for concurrent jobs and can interrupt
unrelated lecturer work. Current review threads and the Sonar quality gate also
remain open on the pushed PR.

### Execution decision

- Update the Apollo status query handling to retain the request ID set paired
  with each response and use that set for missing-job reconciliation.
- Remove automatic `router.push` from completion handling. Supply the design
  system toast's semantic action with a 30-second duration and route only from
  that explicit action. Keep one toast per completed course.
- Retain the existing 15-minute Hatchet execution timeout and reply to that
  review thread with the transaction and stale-recovery rationale.
- Update the two existing wiki pages, the English and German success/action
  copy, and the focused Playwright expectations to describe and verify the
  explicit toast action.
- Fix or disposition the remaining current review threads, including the
  helper-timeout and import-alias findings, before publication. Do not add a
  generic activity adapter solely to reduce Sonar duplication.

### Test portfolio and acceptance

| Consequential behavior | Acceptance evidence |
| --- | --- |
| Concurrent status polling | Focused provider test or existing browser case proves a second job survives the first response and later reaches its own terminal toast |
| Explicit completion action | Browser verification proves no automatic route change, the success toast exposes an accessible action, and clicking it opens the copied course |
| Reloaded completion | Browser or focused provider test proves a restored job can show the same action |
| Multiple completions | Focused test proves separate success toasts retain distinct course targets |
| 30-second lifetime | Focused assertion or documented design-system option verifies the configured duration |
| Hatchet timeout disposition | Current task configuration plus review reply; no code change unless new evidence contradicts the settled policy |
| Existing duplication behavior | Required Playwright suite, GraphQL check/build, and PR CI |

### Delegation and review

- `main` owns the frontend behavior, documentation, test updates, review-thread
  replies, and integration.
- A simplifier reviews the changed frontend surface after its implementation
  commit. A risk-selected slice reviewer covers concurrency, navigation, and
  data-flow behavior. The integrated final reviewer runs after all changes and
  verification.
- The Sonar 3% duplicated-new-code gate is a separate merge decision. Report
  the measured result and do not introduce speculative abstractions solely for
  the metric.

### Authority and terminal state

- The user agreed to this design. The next gate is approval of the reviewed
  execution plan; no implementation or new push occurs before that approval.
- The existing retained DevPod remains running. Merge, deployment, production
  data changes, and runtime deletion remain withheld.
- The terminal state is the corrected, reviewed, verified, and pushed PR with
  all current review threads dispositioned, required CI green, and the Sonar
  gate resolved or explicitly accepted by the repository owners.

### Planner-reviewed corrections and bounded slices

The planner review on 2026-08-22 requires the following exact acceptance
contract and slice boundaries. This section supersedes the broader wording
above where it is more specific.

- **S5 — plan amendment and baseline:** `main` records this reviewed phase and
  the current PR/check state. Commit boundary:
  `docs(project): plan completion notification UX`.
- **S6 — provider, toast, and copy:** `main` changes
  `CourseDuplicationStatusProvider.tsx` and the English/German `courseList`
  messages. The status implementation captures the request ID set at the
  request/response promise boundary rather than reading current state or
  current hook variables. The success toast passes
  `options: { duration: 30_000, action: { label, onClick } }`; `router.push`
  exists only inside `onClick`. The URL remains unchanged before the click,
  restored jobs receive the same action, and each completed job gets one
  distinct action. The existing global close button remains available.
  Acceptance is a deterministic delayed-response test: response A is delayed,
  job B is added before A resolves, A cannot prune B, and an ID absent from its
  own matching response is pruned. Commit boundary:
  `fix(frontend-manage): make duplication completion actionable`.
- **S7 — verification, minor findings, and wiki:** `main` updates the focused
  Playwright behavior, raises or proves the helper budget beyond its full wait
  path (the current safe bound is 360 seconds), changes the course detail page
  imports to the configured `@components/*` aliases, and updates
  `docs/domain-model.md`, `docs/async-and-workers.md`, plus the localized
  background/action copy. Acceptance includes no automatic navigation,
  accessible action routing, separate actions for multiple completions, the
  reload path, and the 30-second duration. Commit boundary:
  `test(course-duplication): verify actionable completion notifications`.
- **S8 — review, CI, and publication:** `main` runs the simplifier, the
  concurrency/navigation slice reviewer, and the integrated final reviewer;
  replies to and resolves the current review threads only after the fixing
  head and evidence are pushed; and reads back exact-head CI and Sonar. Named
  current thread fingerprints are `dd3f8e7e1dfe9180ccae52d0` (stale response
  pruning), `585458e83154e1b7973b163d` (automatic navigation),
  `b449727941b1e8a3a6d1393a` (Hatchet timeout),
  `5f0e053501c96020586dd18f` (Playwright helper budget), and
  `0bc346c0c11fadb57307e1db` (component import alias). The pluralization
  thread `2358cce32da38a6e20b9161c` is minor and is handled with the same
  i18n update. Commit boundary is review/progress documentation only after
  the implementation checks pass.

### Tightened gates and stop conditions

- The current required Playwright shards and all other required checks must be
  terminal on the new pushed SHA. Prior shard results do not carry forward.
- If Sonar remains above its 3% duplicated-new-code gate, stop and report the
  measured blocker. Do not call the PR merge-ready, waive it, or add a generic
  activity abstraction without a separate owner decision.
- The 15-minute Hatchet task configuration remains unchanged. Its review reply
  cites the ten-minute transaction limit and 30-minute stale recovery policy.
- Merge and deployment remain withheld. The retained DevPod remains running.

### Execution progress

- 2026-08-22: The user approved execution with a goal, local end-to-end
  verification, and retention of the test environment. The exact linked
  workspace is `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5446-readiness`;
  its owner is present and the DevPod is retained. The first lifecycle probe
  found a stale reconciliation process, so the canonical `devrouter ensure`
  command was allowed to finish before implementation continues.
- 2026-08-22: S6 is now in progress. The provider will use a captured request
  ID set for each status promise and keep completion navigation inside the
  localized toast action only.
