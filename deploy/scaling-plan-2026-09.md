# Staging and production scaling proposal

Status: **draft; not ready to merge or deploy**. This change proposes deployment
values for review. Resource sizes are provisional engineering estimates and
must be reconciled with representative Goldilocks recommendations before release.
Detailed operational evidence is retained locally and is not part of this public PR.

## Replica plan

| Environment / values key     | Before → proposed | Reason                                                                                                                                      |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Production `chat`            | 1 → 2             | Add serving redundancy; validate multi-pod streaming and persistence in staging first. A failed pod can still interrupt its active streams. |
| Production `frontendControl` | 1 → 2             | Add a second serving process for lecturer controls.                                                                                         |
| Production `olatApi`         | 1 → 2             | Add a second serving process for LMS integration.                                                                                           |
| Staging `chat`               | 1 → 2             | Establish the multi-pod validation topology for the production change.                                                                      |

Existing anti-affinity is preferred, not required. Verify actual placement;
two replicas do not guarantee node or zone redundancy. Other replica counts
remain unchanged pending throughput, queue-delay and availability evidence.

## Production memory-request plan

All values are per container. Raising reservations lets the scheduler account
for more of the expected workload footprint. These proposed sizes need validation
under representative traffic; they are not claimed to be VPA recommendations.
Existing CPU requests and all resource limits remain unchanged. Staging memory
requests also remain unchanged pending environment-specific measurements.

| Values key                                    | Request before → proposed | Purpose                                                                         |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `auth`                                        | 50Mi → 192Mi              | Increase the serving-process reservation.                                       |
| `frontendManage`                              | 50Mi → 256Mi              | Provide a larger reservation for the lecturer frontend.                         |
| `frontendControl`                             | 50Mi → 96Mi               | Reserve memory for both proposed serving replicas.                              |
| `olatApi`                                     | 50Mi → 128Mi              | Reserve memory for both proposed integration replicas.                          |
| `backendGraphql`                              | 200Mi → 384Mi             | Increase reservation for the main API.                                          |
| `hatchet.workers.general`                     | 64Mi → 512Mi              | Give general background tasks a larger baseline; retain the existing 2Gi limit. |
| `hatchet.workers.responseProcessor`           | 64Mi → 192Mi              | Increase the response-processing baseline.                                      |
| `hatchet.workers.responseProcessorAssessment` | 64Mi → 192Mi              | Apply the same processing reservation to assessment workers.                    |
| `responseApi`                                 | 50Mi → 96Mi               | Increase the response-ingestion reservation.                                    |
| `assessment.responseApi`                      | 50Mi → 96Mi               | Apply the same ingestion reservation to assessment.                             |

The rendered change adds **production +3 pods, +150m CPU requests and +4620Mi
memory requests (~4.51Gi)**. Of that memory increase, 650Mi is for assessment
workloads. Staging adds **+1 pod, +50m CPU and +250Mi memory requests**.
These are differences calculated from this public chart, not observations of
cluster capacity, predictions of utilization or monetary estimates.

## Evidence and release gates

1. Obtain representative Goldilocks recommendations for each environment and
   reconcile the proposed values. Inspect recommendation age, conditions,
   bounds and policy caps, alongside peak teaching/assessment traffic, latency,
   throttling, OOM events and queue delay. Do not downsize based on idle samples.
2. Verify staging capacity and authorize its release through the normal GitOps
   process. Check two chat pods, actual placement, login, streaming, tool calls,
   persisted history across pods, DB connections and controlled-restart behavior.
   Use synthetic content and explicitly authorized upstream calls.
3. Confirm production steady-state, rollout-surge and node-failure capacity,
   admission rules, scheduling constraints and autoscaler ownership. Changing
   resource requests rolls existing pods too. Three additional simultaneous
   singleton surges would require another 150m CPU beyond the steady-state
   delta, plus the surge requests of other affected workloads. Account for all
   namespaces and reconcile live-versus-Git drift before release.
4. After approval, coordinate rollout waves in the owning release process and
   monitor Ready/desired counts, Pending pods, OOMs, restarts, latency, error
   rate, chat interruptions, DB connections and queue delay. Exercise lecturer
   controls, OLAT and assessment flows. Halt on regressions or unavailable pods.
5. Roll back only these values through GitOps if needed, preserving current
   image tags and release annotations. A rollback also rolls pods and needs
   scheduling headroom.

Goldilocks supplies container resource recommendations; replica count decisions
also need availability and throughput requirements. Its Burstable view uses VPA
`lowerBound` for requests and `upperBound` for limits; Guaranteed uses `target`
for both. See the official [FAQ](https://github.com/FairwindsOps/goldilocks/blob/master/docs/faq.md).

## Verification

- Both environments pass `helm lint` and `helm template`.
- A structural before/after comparison confirms that only the listed Deployment
  replica and memory-request fields change. Images and release annotations are
  preserved.
- Repository-version Prettier and `git diff --check` pass.
- Independent review confirmed the rendered scope and arithmetic.
- `pnpm run check:all` and `pnpm run build` could not start in the fresh worktree
  without installed dependencies (`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`).
- Application, browser, load and failover checks remain unrun. Review CI
  separately; deployment-only fallback build checks are not application builds.

No deployment or cluster mutation was performed. Keep the PR in draft until the
required evidence and release gates are satisfied.
