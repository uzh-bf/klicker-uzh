# Three-day capacity increase and resource sizing

Status: **draft; capacity and release validation required before deployment**.
The temporary replica plan provides additional capacity for a 72-hour
usage window. Replica counts are a capacity precaution, not a demonstrated
throughput guarantee. Resource-request corrections are intended to remain after
the temporary window. Operational measurements are retained locally.

## Temporary production replicas

| Values key                          | Normal → temporary | Restore after window | Reason                                                                                     |
| ----------------------------------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| `frontendPWA`                       | 4 → 6              | 4                    | Increase the student-facing serving pool by 50%.                                           |
| `backendGraphql`                    | 4 → 6              | 4                    | Increase the main API serving pool by 50%.                                                 |
| `responseApi`                       | 4 → 6              | 4                    | Increase response-ingestion processes by 50% for synchronized submissions.                 |
| `hatchet.workers.responseProcessor` | 4 → 6              | 4                    | Increase aggregate response-processing capacity; per-instance serialization still applies. |
| `hatchet.workers.general`           | 2 → 4              | 2                    | Increase background-task capacity accompanying activity use.                               |
| `olatApi`                           | 1 → 2              | 1                    | Add LMS-integration concurrency and redundancy.                                            |
| `chat`                              | 1 → 2              | 1                    | Add chat-serving capacity; upstream limits remain independent.                             |

**All staging replica settings remain unchanged, including chat at one. All
assessment replica settings remain unchanged**, including the assessment
response worker. Production auth, control and manage stay at 3, 1 and 3 replicas.
LTI replica/autoscaling settings are outside this change.

Preferred anti-affinity does not guarantee node or zone separation. Check actual
placement. More pods do not multiply database, Redis, Hatchet or model-provider
capacity; verify those dependencies, connection counts and queue behavior.

## Production memory requests retained after the window

All values are per container. These reservations remain provisional pending
representative environment-specific sizing validation. CPU requests and resource
limits are unchanged.

| Values key                                    | Request before → proposed |
| --------------------------------------------- | ------------------------- |
| `auth`                                        | 50Mi → 192Mi              |
| `frontendManage`                              | 50Mi → 256Mi              |
| `frontendControl`                             | 50Mi → 96Mi               |
| `olatApi`                                     | 50Mi → 128Mi              |
| `backendGraphql`                              | 200Mi → 384Mi             |
| `hatchet.workers.general`                     | 64Mi → 512Mi              |
| `hatchet.workers.responseProcessor`           | 64Mi → 192Mi              |
| `hatchet.workers.responseProcessorAssessment` | 64Mi → 192Mi              |
| `responseApi`                                 | 50Mi → 96Mi               |
| `assessment.responseApi`                      | 50Mi → 96Mi               |

## Staging resources

Use rounded memory requests at or above the staging VPA target where the existing
request is too small. This is a conservative sizing policy, not a literal copy
of Goldilocks' Burstable view. Retain larger existing requests, existing CPU
requests, and existing memory limits except for the normal response worker and
Manage. The response worker needs headroom above its new request; Manage gets
additional memory headroom. Assessment resource corrections
are independent of the excluded assessment replica increases.

| Values key                                    | Request before → proposed | Limit change                    |
| --------------------------------------------- | ------------------------- | ------------------------------- |
| `auth`                                        | 50Mi → 192Mi              | None (200Mi)                    |
| `frontendManage`                              | 50Mi → 192Mi              | 200Mi → 256Mi                   |
| `frontendControl`                             | 50Mi → 128Mi              | None (200Mi)                    |
| `olatApi`                                     | 50Mi → 128Mi              | None (200Mi)                    |
| `backendGraphql`                              | 200Mi → 384Mi             | None (600Mi)                    |
| `chat`                                        | 250Mi → 320Mi             | None (768Mi); still one replica |
| `hatchet.workers.general`                     | 64Mi inherited → 384Mi    | None (2Gi)                      |
| `hatchet.workers.responseProcessor`           | 64Mi inherited → 256Mi    | 256Mi inherited → 512Mi         |
| `hatchet.workers.responseProcessorAssessment` | 64Mi inherited → 192Mi    | None (256Mi)                    |
| `responseApi`                                 | 50Mi → 128Mi              | None (200Mi)                    |
| `assessment.responseApi`                      | 50Mi → 128Mi              | None (200Mi)                    |

Leave both PWA requests, assessment GraphQL and LTI unchanged. Environment-specific
recommendations should not be transferred blindly between staging and production.
No MCP service changes are included in this chart revision.

## Reservation deltas and capacity prerequisite

Compared with the pre-scaling base (`e3fb9873c`), production adds **12 pods, 800m CPU
requests and 7292Mi memory requests (~7.12Gi)**. Of the memory increase, 650Mi
belongs to assessment resource corrections, with no extra assessment pods.
Staging adds **1490Mi memory requests**, with **zero additional pods or CPU
requests**. These are computed manifest deltas, not private cluster observations.

**Provision or verify sufficient eligible application-node capacity before
release.** Do not assume the existing pool can place the extra pods or that its
autoscaler is enabled, within bounds, or fast enough. Have the infrastructure
owner check steady-state placement, rollout surge and a node failure. Account
for all namespaces, taints, architecture, affinity, overhead and other rollouts.
Do not use assessment-reserved nodes to meet normal application capacity needs.
No node-pool changes or direct scaling commands are part of this PR.

Rolling updates need capacity beyond the stated delta. Resource-request changes
also roll existing workloads. Coordinate release waves and stop on persistent
Pending pods; do not try to compensate by lowering justified requests.

## Activation and explicit scale-back

1. Record the actual activation timestamp, owner and **activation +72 hours**
   scale-back timestamp in the private release record. Confirm the window with
   the event owner; merging this PR does not schedule automatic scale-back.
2. Validate the staging resource change at its unchanged replica topology.
   Exercise login, chat and activity flows. Multi-pod production chat needs a
   separately authorized validation; a one-pod staging test cannot prove it.
3. Verify dependency limits and eligible production capacity, then authorize
   the normal GitOps release. Check Ready/desired counts and actual placement
   before the student peak begins. Image tags and release annotations are
   preserved by this change; reconcile unrelated live-versus-Git drift first.
4. Monitor latency, errors, OOMs, restarts, CPU throttling, connection counts,
   response-processing queue delay and chat interruptions throughout the event.
   Investigate dependency bottlenecks before increasing replicas further.
5. At the recorded end, confirm traffic and queues have subsided and restore
   **only the seven replica settings in the table** to their normal values in a
   follow-up GitOps change. Keep both environments' resource corrections.
   Drain workers and allow in-flight requests/streams to finish; monitor the
   scale-down and pause it if demand remains elevated. No automatic rollback
   or scheduled cluster mutation is created by this PR.
6. For an earlier regression, revert the affected settings through GitOps while
   preserving current release versions. Resource rollback also rolls pods and
   needs surge capacity.

Goldilocks sizes containers, not replica counts. Its Burstable view maps VPA
`lowerBound` to requests and `upperBound` to limits; Guaranteed uses `target`
for both. See the official [FAQ](https://github.com/FairwindsOps/goldilocks/blob/master/docs/faq.md).

## Verification

Both values files pass Helm lint and rendering. A structural comparison permits
only the intended replica and resource changes and asserts that all staging and
assessment replica fields are unchanged. CPU requests/limits and image versions
are preserved. Formatting, secret scanning and independent review are checked
before publishing the revision.

Full pnpm checks/build could not start in this fresh worktree without installed
dependencies (`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`). Runtime, load and failover tests
remain unrun; CI is not a substitute for the capacity/release gates above. No
cluster mutation or deployment was performed.
