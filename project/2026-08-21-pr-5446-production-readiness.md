# Production-readiness report — PR #5446

**Date:** 2026-08-21
**Verdict:** **NOT READY**

PR #5446 changes course duplication from a synchronous GraphQL operation to an asynchronous Hatchet job. The reviewed source contains a timeout contract mismatch and a database/Redis completion gap. The retained local runtime has no functioning general worker and no published workspace routes. GitHub has no exact-head CI for the current PR head and still reports the pull request as conflicting. These are release blockers, not advisory cleanup.

## Scope and refs

| Item | Evidence |
| --- | --- |
| Pull request | [#5446](https://github.com/uzh-bf/klicker-uzh/pull/5446), `fix(course): harden course duplication timeouts` |
| Published PR head | `ff3bbbbd0fd542787c5c6b09a5aed88f4e08edbf` (the Playwright follow-up was published during this audit) |
| Current remote `v3` | `df10f524ecf453fe2f43a3b08797a590f962c191` |
| Local reviewed head | `4169331afe6379ae4bb4eaebe2d96c65c1bee72e`, a local merge of the published head and current `v3` |
| GitHub base | `v3` at `365f07873f1023a7597b131caa97e810a0c6b7f2`; GitHub reports `CONFLICTING` / `DIRTY` |
| Local conflict resolution | Generated GraphQL conflicts are resolved; `git diff --check` is clean; the requested `docs/log/2026-08-20-course-duplication-async-status.md` is absent |
| Delivery boundary | The local merge is not pushed, merged, deployed, or connected to production. The remote PR remains unchanged. |

The audit used the isolated checkout at `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5446-readiness`. It used seeded local development services only and did not retrieve secrets, real course data, production state, cluster state, or external monitoring data.

## Runtime retained for user verification

The linked DevPod is intentionally left running at the user’s request.

| Item | Current state |
| --- | --- |
| Workspace | `fix-course-duplication-timeout` |
| Checkout | `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5446-readiness` |
| Target container | `default-fi-3f699-app-1` is running |
| Intended Manage URL | `https://manage.klicker.fix-course-duplication-timeout.localhost` |
| Internal services | Manage and auth respond on ports 3002 and 3010; GraphQL responds on port 3000 with its expected CSRF rejection when called without the header |
| External route | The devrouter registry currently has no hosts for this workspace; the Manage and API URLs return HTTP 404. `devrouter ensure` route readiness timed out because curl reported `SSL certificate problem: out of memory`. |
| General worker | The fresh `/tmp/dev.log` after the retained runtime rebuild ends the general-worker lifecycle with `Failed running 'src/index.ts'. Waiting for file changes before restarting...` and has no later successful-start line |
| Supporting evidence | Backend registers `processCourseDuplication`; local MCP listens on port 1417; response worker also hits the pinned SDK logger crash; LTI reports missing development platform configuration |

This runtime is not a successful end-to-end proof. The container remains available for inspection, but browser login and duplication interaction cannot be completed until the workspace routes and general worker are repaired. An earlier route-reconciliation retry rebuilt, reset, and reseeded the local development container; the later current-state verifier did not restart or stop it, and no final runtime cleanup was performed.

## Release-gate evidence

| Gate | Result | Evidence and boundary |
| --- | --- | --- |
| Mergeability | **Blocked** | `gh pr view 5446` reports `CONFLICTING` / `DIRTY` against the old base ref. Local commit `4169331a` is not on GitHub. |
| Current-head CI | **Blocked** | Current head `ff3bbbbd` has only successful CodeQL and GitGuardian checks. No exact-head Playwright, aggregate status, build, or SonarCloud run exists. |
| Previous full browser run | **Failed** | Historical head `c52bd324` run `32459770993`, shard job `96705368431`, ran 131 tests: 107 passed and 24 failed. Failures include course duplication and sharing flows, with two-minute `page.waitForResponse` timeouts at `playwright/tests/N-course.spec.ts:977`; aggregate `test-playwright-status` also failed. |
| Previous static-quality gate | **Failed** | Historical SonarCloud check `96704821579` reported: `Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.` Current head has no replacement analysis. |
| Local conflict and deletion | **Resolved locally** | The three generated GraphQL files contain both course-deletion and course-duplication entries; no conflict markers remain and `docs/log` is empty. |
| Browser verification | **Blocked** | The target container responds internally, but the external workspace routes return 404 and the required worker is down. |

The later test-only commit may address the historical Playwright failures, but no current-head run proves that. The local merge cannot change GitHub mergeability or required-check state until it is explicitly published.

## Findings

Severity uses **blocker**, **major**, and **minor** for release impact. Confidence is the reviewer’s confidence in the claim, not confidence that the issue is harmless.

### Blockers

#### B1 — Hatchet expires a valid duplication before the supported transaction can finish

- **Severity:** blocker; **confidence:** 100%; **dimensions:** resilience, configuration, performance.
- **Evidence:** `packages/hatchet/src/index.ts:296-300` registers `process-course-duplication` with `retries: 0` and `Priority.LOW`, but no `executionTimeout` or `scheduleTimeout`. The pinned SDK is 1.9.4 (`packages/hatchet/package.json:11`, `pnpm-lock.yaml:5434-5435`); its task contract defaults execution to `60s` and schedule to `5m`, and its worker registration serializes an omitted execution timeout as `60s`. The copy transaction allows ten minutes at `packages/graphql/src/services/courses.ts:49` and applies that value at line 4101. The twelve-minute Node and HAProxy settings are HTTP transport settings, not Hatchet execution settings.
- **Source quote:** `const DUPLICATE_COURSE_TRANSACTION_TIMEOUT = 10 * 60 * 1000` and `retries: 0`.
- **Impact:** A valid large-course copy can exceed Hatchet’s 60-second execution lifetime, while a low-priority job can expire after five minutes in the queue. With zero retries, Redis status, Hatchet state, and database completion can diverge.
- **Required gate:** Register explicit execution and schedule timeouts with cleanup margin; verify the registered definition; run a controlled copy beyond 60 seconds and a delayed-queue exercise; confirm one terminal status and one target course.
- **Verification:** Independently confirmed in the timeout verifier pass; the exact engine behavior after the deadline remains a staging-runtime question, but the registered mismatch is source-deterministic.

#### B2 — Course creation is not durably idempotent with job completion

- **Severity:** blocker; **confidence:** 100%; **dimensions:** data safety, resilience.
- **Evidence:** `packages/graphql/src/services/courses.ts:3132-3149` awaits `duplicateCourse`, whose transaction commits at lines 4002-4102. Only afterward, line 3157 writes the `COMPLETED` receipt to Redis with `createdCourseId`. Redis persistence is a separate `redis.set` at lines 2853-2862. If that write fails, the catch path records `FAILED` at lines 3163-3171, and `finally` deletes the process lock at line 3175. The schema has no durable duplication-job or idempotency field, and the reviewed range adds no failure-injection test.
- **Source quote:** `await updateCourseDuplicationJob(redis, job, { status: 'COMPLETED', createdCourseId: duplicatedCourse.id })` runs after the database transaction.
- **Impact:** A worker crash or Redis failure after commit can report a successful copy as failed. A retry can then create a second course, activities, permissions, and audit entries.
- **Required gate:** Persist a unique job receipt and created-course result in the same database transaction, reconcile replays before copying, and test a completion-status failure after commit followed by a replay. Assert exactly one target course and the same result ID.
- **Verification:** Independently confirmed by the idempotency verifier and corroborated by the resilience and data-safety passes.

#### B3 — The retained runtime has no functioning general worker or browser route

- **Severity:** blocker; **confidence:** 100%; **dimensions:** deployment, operability, runtime verification.
- **Evidence:** The target container is running, but the fresh `/tmp/dev.log` after the retained runtime rebuild ends the general-worker lifecycle with `Failed running 'src/index.ts'. Waiting for file changes before restarting...`; `apps/hatchet-worker-general/src/index.ts:140` awaits `worker.start()` and line 142 is the missing success marker. The devrouter route registry has no `fix-course-duplication-timeout` hosts, and the Manage/API workspace URLs return 404. The internal Manage and auth ports respond, so this is a route/worker readiness failure rather than proof that the app container is absent.
- **Impact:** The async mutation can enqueue a PENDING job with no consumer, and the required delegated-login/browser verification cannot run. The crash’s root cause is not established and must not be inferred from the unqualified watcher message.
- **Required gate:** Diagnose the worker failure without production data, obtain a successful `Worker started successfully and ready to process jobs` line, restore the workspace routes, and run one synthetic end-to-end duplication through PENDING/RUNNING/COMPLETED with exactly one target course.
- **Verification:** Current-state runtime verifier confirmed this is not historical-only. That verifier did not restart or stop the runtime after the earlier authorized rebuild/reset/reseed; the runtime remains running for the user.

#### B4 — Production backend/worker secret parity is an unverifiable release gate

- **Severity:** blocker; **confidence:** 100% that proof is missing; **dimensions:** configuration, data boundary, operability.
- **Evidence:** `deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml:48-54` imports `...-secret-hatchet-worker-general`, while `deployment-app.yaml:371-377` imports the distinct `...-secret-backend-graphql`. The changed durable documentation states: `Workers must see the same DATABASE_URL, APP_SECRET, and Redis settings as the app stack`. Static templates prove the shared non-secret `HATCHET_API_URL` and default-all workflow selection, but they do not prove Redis, database, application-secret, Hatchet host, or token parity in STG/PRD.
- **Impact:** The API can accept a request while the worker reads a different Redis or database, uses a different application boundary, or connects to a different Hatchet installation.
- **Required gate:** An authorized operator must compare effective backend and general-worker key presence plus non-secret endpoint identities or fingerprints for Redis, database, APP_SECRET, Hatchet host, and token sources. Emit only `MATCH`, `MISMATCH`, or `MISSING`; never print values. Confirm the worker selects `processCourseDuplication` and read back deployed image revisions.
- **Verification:** The configuration verifier classified this as an evidence blocker, not a source-confirmed mismatch. No production or secret access was attempted.

#### B5 — The published PR is still conflicting and lacks exact-head required CI

- **Severity:** blocker; **confidence:** 100%; **dimensions:** delivery, verification.
- **Evidence:** GitHub reports head `ff3bbbbd`, base `v3` at `365f0787`, `CONFLICTING` / `DIRTY`, with only CodeQL and GitGuardian checks on the current head. The local conflict resolution is `4169331a` and is not published. Historical full checks on `c52bd324` failed Playwright and SonarCloud.
- **Impact:** Reviewers and required checks do not evaluate the immutable code that would enter the release path. The test-only follow-up cannot be credited without a fresh exact-head run.
- **Required gate:** Publish an approved conflict resolution against current `v3`, recheck mergeability, and require successful exact-head build/check/lint, all eight Playwright shards, `test-playwright-status`, and SonarCloud before any release decision.
- **Verification:** Independently confirmed by a GitHub read-only verifier. No push or merge was performed.

#### B6 — An ambiguous Hatchet enqueue can release the lock while the job still runs

- **Severity:** blocker; **confidence:** 75%; **dimensions:** resilience, data safety, observability.
- **Evidence:** `packages/graphql/src/services/courses.ts:3061-3069` marks the job `FAILED` and releases its source lock when `ctx.hatchet.events.push` throws. The pinned SDK retries the event push internally, so a lost acknowledgement can mean that Hatchet accepted the event even though the API enters the catch block.
- **Impact:** The lecturer can see a start failure and retry while the accepted first event is already copying the course. This creates competing jobs and compounds the post-commit duplication risk.
- **Required gate:** Preserve an unknown/pending dispatch state until Hatchet reconciliation, retain the lock for the ambiguity window, log the original cause, and test the accepted-event-then-lost-ack seam with exactly one resulting course.
- **Verification:** The integrated final review added this blocker at confidence 75%; no fault injection was attempted because the readiness pass was read-only.

### Major findings

#### M1 — Hatchet records business failure as a successful task

- **Severity:** major; **confidence:** 100%; **dimensions:** observability, resilience.
- **Evidence:** `courses.ts:3163-3173` catches every error, records `FAILED`, and returns `false`. `packages/hatchet/src/index.ts:302-307` then resolves `return { success }`; `retries: 0` prevents recovery. A resolved task function is a completed Hatchet run even when the Redis status is FAILED.
- **Impact:** Dashboards and failure alerts can show success while users see failure, and transient infrastructure failures receive no retry.
- **Action:** Keep terminal domain failures terminal, but throw retryable infrastructure failures after idempotency is in place; include job ID in structured logs and configure bounded backoff.

#### M2 — Queued low-priority jobs are failed by a client-triggered 30-minute stale check

- **Severity:** major; **confidence:** 100%; **dimensions:** resilience, performance.
- **Evidence:** `courses.ts:2944` compares job age with `COURSE_DUPLICATION_STALE_AFTER_MS`; lines 2949-2953 set `FAILED`. The task is LOW priority at `hatchet/src/index.ts:299`, and a terminal status causes the worker to skip processing at `courses.ts:3114`.
- **Impact:** Any queue delay beyond 30 minutes deterministically turns a valid pending request into a failure, while actual production queue latency remains unmeasured.
- **Action:** Base queued termination on authoritative Hatchet state and use a renewable worker lease or heartbeat for RUNNING jobs. Measure queue age before setting thresholds.

#### M3 — Completion loses the only job identifier across an accepted-request reload

- **Severity:** major; **confidence:** 100%; **dimensions:** resilience, UX.
- **Evidence:** `CourseDuplicationStatusProvider.tsx:484-489` stores the job ID only after the mutation response. Polling is skipped when `jobIds.length === 0` at lines 317-321, and the API exposes status only for caller-supplied IDs.
- **Impact:** Reloading after server acceptance but before response handling leaves the job untracked. Once the source lock is released, the lecturer can retry without knowing whether the first copy completed.
- **Action:** Provide an authenticated per-user active-job index and recover it on provider mount; test the accepted-request-before-response reload seam.

#### M4 — Status responses omit jobs beyond the first 50 and the UI silently removes them

- **Severity:** major; **confidence:** 100%; **dimensions:** observability, UX, data safety.
- **Evidence:** `courses.ts:3082` deduplicates and truncates the request to 50 IDs. `CourseDuplicationStatusProvider.tsx:368-370` removes every tracked ID absent from the response without toast or telemetry. A Redis read failure rejects the query and reaches `onError`; it does not return an individual missing ID.
- **Impact:** Tracking for jobs beyond the first 50 is deterministically dropped from the response and then removed from the UI without a recovery path.
- **Action:** Batch status requests or add an explicit paginated/validated server contract so more than 50 tracked jobs remain observable; never treat truncation as absence. Retain genuinely missing jobs as unknown/failed until dismissal and emit a correlated job-ID signal without user data. Verify the stable 51-ID boundary.

#### M5 — Polling remains opaque after bounded query retries are exhausted

- **Severity:** major; **confidence:** 100%; **dimensions:** UX, operability.
- **Evidence:** `CourseDuplicationStatusProvider.tsx:324-326` only executes `console.error('Failed to poll course duplication status', error)`. Apollo already applies bounded `RetryLink` retries to non-mutation queries at `apps/frontend-manage/src/lib/apollo.ts:103-123`; authentication errors follow the expired-login redirect at lines 76-85.
- **Impact:** After retries are exhausted, a retryable network/query failure leaves the lecturer with no reliable distinction between running, failed, and safe-to-retry states.
- **Action:** Retain job IDs, show a localized degraded state, and offer a manual retry after the existing bounded query retries are exhausted.

#### M6 — Failed and timed-out jobs disappear after a generic six-second toast

- **Severity:** major; **confidence:** 100%; **dimensions:** UX, recovery.
- **Evidence:** `CourseDuplicationStatusProvider.tsx:382-405` removes the job before showing a six-second generic toast. The selected `job.errorMessage` is not rendered, so `Course duplication did not finish in time.` is reduced to the generic failure message.
- **Impact:** A missed toast leaves no failure history, timeout detail, or safe retry context.
- **Action:** Retain terminal failures until dismissal, localize timeout state, and provide Retry/Return-to-source actions without exposing internals.

#### M7 — Background completion can navigate away from unrelated unsaved work

- **Severity:** major; **confidence:** 100%; **dimensions:** UX, data integrity.
- **Evidence:** `CourseDuplicationStatusProvider.tsx:396` unconditionally runs `router.push(/courses/${job.createdCourseId})`, while `packages/i18n/messages/en.ts:3051` promises `You can continue working while these courses are copied.`
- **Impact:** A background completion can eject a lecturer from another form or course; concurrent completions can issue competing navigations.
- **Action:** Keep completion non-navigating and provide a persistent success action, or only auto-open from a safe initiating route with no unsaved state.

#### M8 — Global twelve-minute HTTP timeouts widen every GraphQL resource window

- **Severity:** major; **confidence:** 100%; **dimensions:** performance, resilience.
- **Evidence:** `apps/backend-docker/src/index.ts:17,195-196` sets `server.requestTimeout` and `server.setTimeout` to twelve minutes. `requestTimeout` governs receiving the complete client request, not keeping an async handler alive. Production ingress also sets `haproxy.org/timeout-server: 12m` at `deploy/env-uzh-prd/values.yaml:564`. The async mutation only enqueues a job and returns.
- **Impact:** Slow clients, hung resolvers, and legacy synchronous requests can retain connections for twelve minutes across the entire API. No capacity measurement was supplied.
- **Action:** Remove the broad request-receipt and ingress extensions; isolate any legacy synchronous compatibility path and bound its concurrency.

#### M9 — Rolling deployment order can expose a new frontend to an old backend or kill active jobs

- **Severity:** major; **confidence:** 100% for the dependency, 75% for rollout trigger; **dimensions:** deployment, rollback.
- **Evidence:** `deploy/env-uzh-prd/values.yaml:456` uses a three-replica rolling update for Manage and `:580` uses a four-replica rolling update for GraphQL. The provider unconditionally calls the new mutation at `CourseDuplicationStatusProvider.tsx:307-309`, while the mutation is added at `packages/graphql/src/schema/mutation.ts:1364`. The worker task has `retries: 0`, and no termination drain/readiness contract was found for active duplication jobs.
- **Impact:** A frontend-first rollout can call a mutation absent from old backends; a worker restart can interrupt a ten-minute copy and leave status unresolved.
- **Action:** Roll out backend/worker first, then frontend; add readiness and drain/termination handling; define rollback behavior for in-flight jobs.

#### M10 — Operator documentation describes the obsolete API and omits the async runbook

- **Severity:** major; **confidence:** 100%; **dimensions:** operability, documentation.
- **Evidence:** `project/2026-07-09-pr4954-course-duplication-pr-documentation.md:70` says `No separate GraphQL mutation was added` and `The frontend calls CreateCourseDocument`, but the implementation uses `startCourseDuplication`. The same document points responders to backend logs although failures use Hatchet execution-context logs. `docs/async-and-workers.md:45` only documents Redis state and polling; it omits the 24-hour TTL, 30-minute stale behavior, retry policy, worker-first rollout, and drain/rollback steps.
- **Impact:** QA and incident responders are directed to a missing API/test asset and an incomplete failure source, and cannot safely operate or roll back the workflow.
- **Action:** Rewrite the durable docs around `startCourseDuplication`, `courseDuplicationStatuses`, the general worker, status transitions, retention, locks, retries, rollout, and rollback. Keeping the requested `docs/log` deletion is fine once these facts are relocated.

#### M11 — Shared general-worker capacity is not bounded or demonstrated

- **Severity:** major; **confidence:** 75%; **dimensions:** performance, deployment.
- **Evidence:** `packages/hatchet/src/index.ts:311-326` puts `processCourseDuplication` in the general task registry with lifecycle jobs. Production values retain two general-worker replicas at `deploy/env-uzh-prd/values.yaml:26`, request `cpu: 50m` and `memory: 64Mi`, set a `memory: 512Mi` limit, and configure no CPU limit at lines 33-37. No duplication concurrency cap or representative maximum-size course measurement is present in the reviewed scope.
- **Impact:** Concurrent copies can compete with scheduled publication and ending workflows for worker and database capacity.
- **Action:** Measure queue wait, duration, RSS, CPU, and database connections under representative copies; set an explicit concurrency cap or isolate the workload.

#### M12 — Terminal Redis records retain the complete job arguments for 24 hours

- **Severity:** major; **confidence:** 100%; **dimensions:** data safety, privacy, operability.
- **Evidence:** `CourseDuplicationJob` stores authorization context and the complete `args` object at `packages/graphql/src/services/courses.ts:2723-2730`. `persistCourseDuplicationJob` serializes the entire job with a 24-hour TTL at lines 2853-2862, and terminal updates spread the full job at lines 2906-2912. The arguments include course description and `notificationEmail` fields in the job-argument definition.
- **Impact:** Completed and failed jobs retain course content, contact data, and authorization-context snapshots after processing no longer needs them.
- **Action:** Replace terminal records with a minimal receipt, document the retention purpose and duration, and verify terminal persistence no longer retains full arguments or authorization snapshots.

### Minor findings

#### m1 — Active-job count is always plural in English and German

- **Severity:** minor; **confidence:** 100%; **dimensions:** accessibility, localization.
- **Evidence:** `packages/i18n/messages/en.ts:3048` and `de.ts:3093` use fixed plural strings while the provider passes `jobs.length` at `CourseDuplicationStatusProvider.tsx:245-247`.
- **Action:** Add ICU `one` and `other` branches.

#### m2 — Loading overlay leaves obscured controls keyboard-accessible

- **Severity:** minor; **confidence:** 100%; **dimensions:** UX, accessibility.
- **Evidence:** `CourseDuplicationModal.tsx:800` renders a visual status overlay without making the underlying form inert, disabled, or hidden from assistive technology.
- **Action:** Render a separate progress state or mark the form inert/aria-busy and move focus to the status.

## Dimension coverage and dispositions

| Dimension | Result | Coverage |
| --- | --- | --- |
| Deploy / rollback | **Blocker** | Rolling-order and worker-drain risks reviewed; production rollout and Argo state not accessed. |
| Failure / resilience | **Blocker** | Timeout mismatch, stale cancellation, zero retries, reload recovery, and post-commit replay reviewed. |
| Data safety | **Blocker** | Redis/database completion gap and ambiguous enqueue race confirmed; terminal Redis data minimization is also required. Access rechecks and ownership filters did not produce a separate finding. |
| Observability | **Major** | False-success task runs, silent disappearance, discarded enqueue causes, and request-driven stale detection reviewed. |
| Configuration / secrets | **Blocker** | Hatchet timeout source defect confirmed; production secret parity remains an explicit values-suppressed gate. |
| User experience | **Major** | Navigation, polling degradation, failure retention, modal accessibility, and localization reviewed; browser interaction blocked by routes. |
| Documentation / operability | **Major** | Stale API/test references and missing lifecycle/runbook facts confirmed. |
| Performance / capacity | **Major** | Queue-age cancellation and global timeout exposure confirmed; real production load is unmeasured. |

## Refuted or not-found findings

- The course-copy transaction itself remains database-transactional and preserves its all-or-nothing behavior within Prisma. The finding is the cross-system receipt gap after commit, not a claim that the transaction is absent.
- Source-course authorization is checked before enqueue and again in the worker. Status queries filter by the authenticated job owner. No separate authorization or status-disclosure defect was found.
- Direct sharing, target-owner access, and shared-element semantics were not contradicted by the reviewed change and were not reported as new blockers.
- No credentials, secret values, production data, or personal data were placed in this report. No production or cluster readback was attempted.
- Generated GraphQL conflict resolution and the requested `docs/log` removal are locally clean. They do not prove remote mergeability or current-head CI.

## Required next gates

1. Publish an approved conflict resolution based on current `v3`; do not treat local commit `4169331a` as remote proof.
2. Obtain successful exact-head CI, including all eight Playwright shards, `test-playwright-status`, build/check/lint, and SonarCloud.
3. Repair and observe the general worker, restore the workspace routes, then run one synthetic end-to-end duplication with a single target course.
4. Align Hatchet execution/schedule timeouts and retry policy with the ten-minute transaction; reconcile ambiguous enqueue acknowledgements; and add the post-commit Redis failure/replay idempotency gate.
5. Minimize terminal Redis records so completed and failed jobs no longer retain full arguments or authorization snapshots.
6. Complete values-suppressed STG/PRD parity checks and document worker-first rollout, drain, rollback, stale-job, and alert behavior.
7. Resolve the major user-facing recovery and navigation issues, then rerun the required browser and accessibility checks.

Until these gates pass on the exact published head, the release decision remains **not-ready**.

## Reviewer waves

Wave one covered deploy/rollback, resilience, data safety, observability, configuration/secrets, documentation/operability, UX/accessibility, and performance/capacity. A verifier wave independently confirmed the timeout blocker, post-commit idempotency blocker, current runtime blocker, current GitHub CI/mergeability blocker, and the missing production secret-parity proof. The findings above are deduplicated across those dimensions; a source-level blocker appears once with corroborating review dimensions called out.
