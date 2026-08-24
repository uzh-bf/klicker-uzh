# Production readiness — PR #5496

## Verdict

**not-ready**. The audit found one confirmed blocker: the new batch path relies on a client-side draft/scheduled snapshot, while three reused server deletion services can hard-delete a record after it becomes published when it has no responses or instances. A scheduled activity can therefore become participant-visible during the confirmation window and still be permanently deleted. Major recovery, retry, reconciliation, cleanup, and rollback-control gaps remain. Remote CI is green for the current PR head, but it does not cover the publication race or the unavailable production recovery evidence.

## Prior gates

| gate | artifact | status (present / stale / missing / not applicable) |
| --- | --- | --- |
| $code-review | none matching implementation head 5154177aa19425bcd193fd18f828c393e24bc78f | missing |
| $thermo-nuclear-code-quality-review | none matching implementation head | missing |
| $security-review | none matching implementation head | missing |
| combined-final | none matching implementation head | missing |

The PR's current remote checks pass for build, type, lint, format, gitleaks, CodeQL, SonarCloud, and the Playwright shards. Analyze and test-graphql are skipped. CI results do not replace the standing-gate artifacts above.

## Findings

| severity | dimension | finding | evidence | proposed action | verification (confirmed / refuted / unverified) |
| --- | --- | --- | --- | --- | --- |
| blocker | Data safety | The batch path can hard-delete a scheduled activity after it becomes published during confirmation or execution. | The UI checks activity.status against Draft and Scheduled at ActivityBatchOperationsModal.tsx:67-70, then dispatches a mutation from the stale ActivityInfo snapshot at useActivityBatchDeletion.ts:24-50. The practice-quiz service still treats responses.length === 0 as hard-deletable at practiceQuizzes.ts:641-646 and executes prisma.practiceQuiz.delete. microLearning.ts:753-757 and groups.ts:1879-1883 have the same unguarded alternative; scheduled handlers can change status to PUBLISHED before the delete runs. | Add a batch-only server precondition that atomically requires DRAFT or SCHEDULED for practice quizzes, microlearnings, and group activities. Return a non-deleted outcome after a state transition and add a service regression covering publication during the confirmation window. | confirmed |
| major | Failure modes & resilience | Automatic GraphQL retries can turn a committed destructive mutation into a definitive failure. | The hook maps a nullable response to failure with status: deleted ? ('deleted' as const) : ('failed' as const) at useActivityBatchDeletion.ts:71-79. Apollo applies RetryLink with max: 3 at apps/frontend-manage/src/lib/apollo.ts:101-109; a lost response after commit can be retried, return null, and be reported as failed. Archive/restore has the equivalent count-zero classification at useElementActions.ts:61-64. | Exempt these mutations from transport retries, or add idempotency keys and durable operation receipts. Add a focused response-loss test for deletion and archive/restore. | confirmed |
| major | Failure modes & observability | Failed list reconciliation is discarded while the UI can show success and close the modal. | ActivityBatchOperationsModal.tsx:284-288 catches refetchActivities failure and only runs console.error. Control then reaches the success branch at lines 296-301 and closes the modal at lines 316-319. | Track refresh failure explicitly. Replace success or partial-success feedback with a persistent reconciliation warning and reload guidance; test a successful deletion followed by a rejected refetch. | confirmed |
| major | Failure modes & resilience | Batch success can acknowledge incomplete cleanup after deletion commits. | The new fan-out uses const DELETE_CONCURRENCY = 5 at useActivityBatchDeletion.ts:11. The practice-quiz service deletes at practiceQuizzes.ts:645, swallows scheduled-task cancellation errors at lines 658-663, and propagates element permissions later at line 669. Equivalent ordering exists for microlearnings and group activities. | Make deletion and permission propagation atomic where possible. Persist scheduled-task cancellation as a durable cleanup intent or reconciler and report cleanup-pending instead of full success. Fault-test cancellation and post-delete propagation failures. | confirmed |
| major | Deploy & rollback / Docs & operability | Database recovery for accidental permanent batch deletion is not documented or verified. | The changed tutorial promises: Permanently delete all eligible selected activities and their associated participant data and results at apps/docs/docs/tutorials/activity_batch_operations.mdx:36. Repository guidance states at docs/data-and-migrations.md:65: This repo documents no point-in-time restore procedure ... whatever backup the managed Postgres provides is the only fallback. | Verify production backup retention, PITR, RPO, and RTO with the database team; rehearse targeted recovery outside production; document scope, operator, and data-loss expectations before release. | unverified |
| major | Deploy & rollback | A frontend rollback cannot stop a batch already running in an open browser, and no server-enforced emergency gate exists. | useActivityBatchDeletion.ts:61-85 continues through every chunk after ActivityBatchOperationsModal.tsx:272 starts the operation. The feature-flag contract currently has an empty FEATURE_FLAG_DEFAULTS object at packages/feature-flags/src/contracts.ts:5. | Add a server-enforced runtime gate checked before each chunk or deletion and document the emergency-disable procedure. A browser-only build rollback is insufficient. | confirmed |
| minor | Observability | New partial, failed, uncertain, and archive outcomes have no durable semantic event or batch correlation. | The new executor records browser-only statuses and console.error at useActivityBatchDeletion.ts:71-80; archive/restore does the same at useElementActions.ts:61-64. No changed server path records an aggregate actor, operation, or outcome. | Add privacy-safe structured lifecycle events and a shared correlation ID for aggregate requests, with failure/uncertainty monitoring. | confirmed |
| minor | Performance & capacity | Large selections create an unbounded, opaque sequence of destructive requests. | useActivityBatchDeletion.ts:61-67 loops while index < activities.length, in chunks of five, with no maximum or progress callback. The activity list permits page sizes of 10, 20, 50, or all. | Start with a practical selection cap, show completed/total progress, and establish a safe threshold with non-production capacity testing before raising it. | confirmed |
| minor | UX | The initial local auth/runtime failure appeared to block the flow. | After recreating the namespaced workspace with the correct overlay, Manage and Auth returned HTTP 200; delegated login succeeded; browser evidence removed two disposable drafts (34 → 33 → 32) and archived/restored an element to Ready. | No PR change required; retain the browser evidence and runtime repair note. | refuted |

## Not checked

- No production backup inventory, point-in-time restore, rollback, or emergency-disable drill was performed. Production access was not used.
- The publication race, response-loss retry path, refetch failure, Hatchet cancellation failure, post-delete permission-propagation failure, partial/uncertain mutation paths, and error toasts were not fault-injected because the audit was read-only.
- No representative large-batch load test was run. Capacity impact on API latency, Prisma pool usage, Hatchet latency, and concurrent lecturers remains unmeasured.
- Browser coverage exercised English desktop flows and a narrow 390px Library state. The transient success toast was not retained in the final snapshot, German rendering was not exercised in-browser, and the full UX/error-state review was not independently returned by a worker.
- The initial eight-worker dispatch hit the platform agent-thread limit. Six dimension reports returned: deploy/rollback, failure modes/resilience, data safety, observability, config/secrets, and performance/capacity. UX and Docs & operability workers did not return; their missing coverage is recorded here rather than presented as completed.
- Standing-gate artifacts for $code-review, $thermo-nuclear-code-quality-review, $security-review, and combined-final are absent for this implementation head.

## Handoffs

- Code style and specification compliance belong to $code-review.
- Maintainability and architecture proportionality belong to $thermo-nuclear-code-quality-review.
- Code-level vulnerability review belongs to $security-review; the PR's CodeQL and GitGuardian checks passed, but those checks do not replace the standing review.
- Integrated final correctness and plan-compliance review belongs to combined-final / the applicable final-reviewer gate.
- Production backup/PITR verification, emergency disable, and recovery rehearsal belong to the release and database operators before merge or activation.

## Coverage

I audited the exact implementation range f58986faa8cfa4ff78d20a1ebeb1666473343d38..5154177aa19425bcd193fd18f828c393e24bc78f, all 13 changed paths, the four deletion services, GraphQL authorization mappings, scheduled-task cleanup, element batch-operation authorization and transaction behavior, i18n parity, docs, tests, remote CI, and the named local Manage/Auth runtime. The local browser pass verified delegated login, two disposable draft deletions, and element archive/restore. The exact workspace was running with 10 namespaced routes and a namespaced Postgres container with no host port binding. No production state or credentials were accessed.
