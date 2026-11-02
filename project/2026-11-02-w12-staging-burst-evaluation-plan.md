# W12 staging burst evaluation and expansion roadmap

Extends W12 (HTTP spot burst tier) in
[the KEDA horizontal scaling plan](2026-08-29-pr-5491-keda-horizontal-scaling-plan.md).
Gate names A2, A4 and A6 refer to that plan's approval gates.

## Approval cards

### Card 1 — Staging evaluation batch (E0–E5)

- **Outcome:** the PWA spot burst tier is either proven on staging against
  P1–P10 or has a named failure with its fix. The result is the evidence for
  the already agreed production enablement.
- **What runs:** a PDB drift fix, a burst dashboard, two days of passive
  observation, a ramped k6 load drill, five disruption drills under load, and
  a five-day soak.
- **Staging effects:** short synthetic load on the PWA; burst Pods deleted,
  evicted or held Pending while the baseline serves; one `asyncspot` node
  drained; a `asyncspot` cordon of at most 15 minutes. Document processing
  shares that pool; the drain respects its disruption budgets.
- **Authority requested:**
  1. The E3 load and the E4 drills on staging, each in an announced window.
  2. E0 fix branches, in order and only when the previous one fails: an Argo
     hard refresh of `app-klicker` on staging, then a chart PR pair that adds
     a per-resource sync option to the baseline PWA PDB.
- **Not requested:** production changes, df-cloud changes, node pool sizes,
  Azure VM operations, and any assessment workload. The real spot eviction
  (E4.6) is a separate card because it needs the platform owner.
- **Terminal:** the E5 verdict recorded in this plan with evidence links.

### Card 2 — Simulated spot eviction (E4.6), optional

- **Effect:** `az vmss simulate-eviction` on the burst Pod's `asyncspot`
  instance. If the pool's eviction policy is Delete, Azure removes the VM.
  Co-located document-processing Pods then end without their disruption
  budgets. This is an Azure write outside the cluster.
- **Recommendation:** run it once, with the platform owner's consent, in a
  window without active document processing. E4.1–E4.5 already cover the
  Kubernetes-side behavior.

### Card 3 — Expansion order (X1–X5)

- **Order:** X1 generic chart support, then GraphQL (after X2 and X3), then
  the response API (after X4). This keeps the parent plan's order.
- **Per-service authority:** each new burst Deployment needs its own df-cloud
  Argo replica exception (A6 pattern) and each production enablement its own
  A4 ruling. Source PRs and staging values PRs are ordinary delivery.

### Card 4 — Decisions needed now

| Decision | Recommendation | Why it matters |
|---|---|---|
| D1 — Error and latency source | k6 client metrics for P5; add an `X-Served-By` response header (Pod name) to the PWA for P6, unless E1 finds HAProxy logs with backend server names in Loki | No ServiceMonitor scrapes the staging HAProxy ingress, and no response header identifies the serving Pod |
| D2 — Dashboard home | Grafana JSON under `deploy/dashboards/`, imported manually until df-cloud provisions dashboards | Keeps the evidence reviewable with the chart |
| D3 — Soak load | Real staging traffic plus a scheduled light k6 run twice a day | Staging traffic alone never leaves the HPA floor |
| D4 — Burst priority class | A lower class than the baseline (`staging-workload` stays; production burst gets a class below `production-workload`) | Burst Pods inherit the baseline class today and could preempt document processing on the shared spot pool |

## Current state (2026-11-02)

- Staging runs the PWA burst tier since 2026-11-02 15:24 through #6294 via
  sync #6789: `frontend-pwa-burst` at 1 replica on `asyncspot`, HPA 1–4 on
  CPU at 70%, own PDB `maxUnavailable: 1`. The Argo `/spec/replicas`
  exception for the burst Deployment is live (A6, df-cloud !644).
- **Open defect:** the live baseline `frontend-pwa` PDB lacks the
  `klicker.uzh.ch/tier DoesNotExist` expression that a local render of the
  synced revision contains. Argo reports the PDB `OutOfSync` after every
  self-heal sync, and its last-applied manifest also lacks the expression. A
  server-side dry run of the rendered manifest keeps it. While this persists,
  the burst Pod matches two budgets and the eviction API refuses to evict it.
- The staging baseline runs one replica against `minAvailable: 2`, which
  already blocks voluntary baseline evictions (predates W12).
- Staging PWA uses the `Recreate` strategy, which the burst Deployment
  inherits; production uses `RollingUpdate`. Every staging promotion takes
  both tiers down together.
- The HPA has no `behavior` block, so Kubernetes defaults apply (5-minute
  scale-down stabilization). The PWA pod spec has no topology spread.
- Production runs static replicas with no HPA for every Klicker service; the
  burst tier is disabled there.
- Monitoring in both clusters: kube-prometheus-stack with kube-state-metrics
  and node exporter, Grafana, Loki with Alloy, and the managed KEDA add-on.
  The HAProxy ingress has no Prometheus scrape target.

## Goal and scope

Prove the PWA burst tier on staging before its production enablement, then
extend the pattern to the services where it saves regular capacity without
risking correctness.

Out of scope: KEDA scale-to-zero (needs W2/W3a), Hatchet worker spot pools
(W5/W7), moving all of staging onto spot (W13, which should follow this
evaluation so regular-versus-spot behavior stays measurable), and any
assessment workload.

## Pass criteria for the PWA burst tier

Deploy windows are excluded from P1 and P3 because staging `Recreate` takes
both tiers down regardless of spot.

| ID | Criterion | Source |
|---|---|---|
| P1 | Burst Deployment available ≥ 99% of the soak, excluding deploy windows and the 5 minutes after each eviction | kube-state-metrics |
| P2 | After a drain or eviction, a replacement burst Pod is Ready within 5 minutes, or within 10 minutes when a new spot node must be provisioned | kube-state-metrics, Loki events |
| P3 | No burst Pod Pending longer than 10 minutes while `asyncspot` has headroom | kube-state-metrics |
| P4 | Under the ramp, the HPA reaches 4 replicas within 3 minutes of crossing the target when spot nodes have room, and returns to 1 within 10 minutes after load ends | HPA metrics |
| P5 | At the plateau and during scale-down, drain and Pod deletion: no k6 request failures beyond in-flight requests on a terminated Pod | k6 |
| P6 | Burst-served p95 latency within 20% of baseline-served p95 at equal load | k6 tagged by `X-Served-By` or HAProxy logs (D1) |
| P7 | Argo stays `Synced` for the burst Deployment while the HPA changes replicas; a manual baseline replica edit is reverted | Argo status |
| P8 | With burst Pods gone under load, the baseline keeps serving; a render with the tier disabled removes the burst Deployment, HPA and PDB, and the Application prunes | E4.4 drill, render diff, Application spec |
| P9 | No new Pending Pods or evictions for other `asyncspot` tenants during the drills | kube-state-metrics |
| P10 | During a rollout under load, no client sees missing assets or chunk 404s | k6 asset requests, HAProxy logs |

## Packages

### E0 — Fix the baseline PDB drift (blocker)

- **Outcome:** the live baseline PDB carries the tier exclusion, Argo reports
  it `Synced`, and each PWA Pod matches exactly one budget.
- **Investigate, in order (read-only):** compare the revision Argo rendered
  with `stg-release`; read the live Application's `ignoreDifferences` and
  sync options (`RespectIgnoreDifferences=true` arrived with !644 at the same
  time as the burst tier); check mutating webhooks on PodDisruptionBudgets;
  then the repo-server manifest cache.
- **Fix branches (Card 1):** a hard refresh; if that fails, a chart PR pair
  adding a per-resource `ServerSideApply=true` sync option to the baseline
  PWA PDB, which reaches staging through the normal sync path.
- **Check:** live selector read-back;
  `kubectl drain --dry-run=server --pod-selector=app.kubernetes.io/component=frontend-pwa`
  on the burst Pod's node reports no budget conflict.

### E1 — Burst observability

- **Outcome:** one Grafana dashboard shows P1–P4, P7 and P9, plus saved Loki
  queries for evictions and burst Pod lifecycle events.
- **Do:** panels for desired versus available replicas per tier, HPA current
  versus desired replicas and CPU, Pending burst Pods, burst Pods per node,
  `asyncspot` node count and headroom, restarts per tier, and other
  `asyncspot` tenants' Pending Pods. Check whether Alloy ships HAProxy access
  logs with backend server names; this settles D1.
- **Commit:** dashboard JSON, the D1 header if chosen, and a short runbook
  section in `docs/ci-and-deployment.md`.

### E2 — Passive observation (2 days)

- **Outcome:** baseline readings before any drill: both tiers serve, the burst
  Pod stays on `asyncspot`, Argo stays `Synced`, and any spot preemption meets
  P2. Read-only.

### E3 — Load drill

- **Outcome:** P4, P5 and P6 under a ramped load.
- **Do:** add `util/load-test/pwa-burst.js`: unauthenticated PWA SSR pages
  and their static assets. Ramp from below the baseline target to roughly
  three times baseline capacity over 10 minutes, hold 10 minutes, then cool
  down 15 minutes so the default scale-down window completes. Judge P5 from
  the plateau on, because the Service splits traffic evenly and the single
  baseline Pod carries half the ramp before scale-up. Cap the rate so other
  staging backends stay within limits.
- **Recovery:** abort on any non-PWA staging alert; record and stop for a
  ruling.

### E4 — Disruption drills

Under the E3 plateau, one at a time.

1. **Drain** the burst Pod's spot node with budgets in force. Proves E0, P2
   and P5.
2. **Scale-down cut:** end the load and watch HPA scale-down. Proves P5 for
   terminating burst Pods.
3. **Self-heal:** HPA changes under Argo self-heal; a manual baseline replica
   edit is reverted. Proves P7.
4. **Burst loss:** delete all burst Pods under load and hold them Pending by
   cordoning `asyncspot` for at most 15 minutes; then uncordon. Proves the
   baseline carries full load (P8 first half) and spot capacity exhaustion.
   Pair with the render diff and the Application prune setting (P8 second
   half). A real `enabled: false` toggle is not part of this batch: it would
   ship through `v3-ai`, a sync PR and promotion, with unrelated content.
5. **Rollout skew:** trigger a PWA rollout under load (for example the next
   ordinary staging promotion) and check P10. Staging `Recreate` cannot prove
   the production `RollingUpdate` path; X1 adds a staging override to
   `RollingUpdate` for this drill if needed.
6. **Simulated spot eviction (Card 2 only):** proves P2 and P5 on the real
   30-second notice path, including the 5-second pre-stop delay.

- **Recovery:** restore the prior state (uncordon, Argo self-heal), record
  evidence, fix in source under W12, and repeat only the failed drill.

### E5 — Soak and verdict (5 days)

- **Outcome:** P1, P3 and P9 across five days with real traffic and the D3
  light load; a written go/no-go for production.

### X1 — Generic burst support in the chart

- **Outcome:** any HTTP component can opt into a burst tier through one
  values block; the PWA renders byte for byte as today except the new
  options below.
- **Do:** lift the PWA burst rendering into shared helpers; add an optional
  `burst.priorityClassName` (D4), a soft hostname topology spread for burst
  Pods, an optional HPA `behavior` block, and per-tier strategy. Extend
  `util/check-klicker-replica-ownership.mjs` fixtures to every burst-capable
  component. Companion pair `v3-ai` then `v3`.

### X2 — Move the live-quiz block auto-close off the in-process scheduler

- **Problem:** `activateLiveQuizBlock` schedules the timed close with
  `node-schedule` in a per-Pod map
  (`packages/graphql/src/services/liveQuizzes.ts`). If that Pod ends, a timed
  block stays open until a lecturer closes it manually. Spot eviction makes
  this much more likely than a rolling deploy. It also affects today's
  multi-replica production.
- **Do:** schedule the close as a durable Hatchet task with an idempotent
  close; the aggregation follow-up already uses Hatchet scheduling.

### X3 — GraphQL subscription resilience, then GraphQL burst pilot

- **Gate:** the PWA uses `GraphQLWsLink` (graphql-ws). Prove that a client
  reconnects after its server Pod ends, within a bounded retry, and refetches
  the running quiz state it missed. HPA scale-down also cuts sockets on the
  removed Pod, so this matters for every scale-down, not just evictions.
- **Do:** fix reconnect and refetch if needed; then staging values pair,
  df-cloud exception, and the E3–E5 drills for GraphQL.

### X4 — Response API drain readiness, then response API burst pilot

- **Gate:** the response API has no readiness probe, no pre-stop hook and no
  SIGTERM handler, so an ending Pod drops in-flight submissions; the PWA
  submits with a plain `fetch` and no retry, and the server creates the
  message id. Add readiness, a pre-stop delay and a graceful close first. Add
  a client retry only with a client-supplied key that the response worker
  deduplicates, otherwise retries duplicate answers.
- **Do:** then staging values pair, df-cloud exception, and the drills.

### Not candidates

| Service | Ruling | Reason |
|---|---|---|
| Assessment backend, frontend, response API and worker | Never | Platform policy keeps assessment off spot |
| Chat, MCP student, MCP lecturer | After W10 | Long-lived streams and stateful MCP transport |
| Manage, auth, LTI, OLAT API, control | Defer | Low request volume; a burst tier saves little regular capacity |
| Hatchet workers | W5/W7 | Queue-driven KEDA pools with their own idempotence gate |

## Production

PWA production enablement follows E5 under A4: a values pair adding the burst
block to `env-uzh-prd`, the df-cloud production replica exception (in !644),
a baseline sized to carry full load without spot, the D4 priority class, a
quiet rollout window, and the E1 dashboard as the watch. Lower the baseline
replicas only after two weeks of production evidence. Production facts stay
out of this file.

## Test portfolio

| Risk | Obligation | Seam |
|---|---|---|
| A burst Deployment without one replica owner, spot placement, Argo exception or lower priority class | extend existing | replica ownership checker fixtures (X1) |
| Baseline and burst PDBs overlap | extend existing | same checker; live drain dry run (E0) |
| Timed block close lost with its Pod | add new | Hatchet task test for the durable close (X2) |
| Subscription not restored after a server Pod ends | add new or extend existing | PWA reconnect test (X3) |
| Response API drops or duplicates a submission on Pod end | add new | graceful-close test; dedup test if a retry is added (X4) |

## Progress

- 2026-11-02: approved by the user (Cards 1, 3 and 4 as recommended; Card 2 waits for platform owner consent). Plan drafted; one independent critique applied (rollback drill
  replaced, X2/X3/X4 gates corrected against source, P4–P6 and P10 made
  measurable, E0 order and authority branches, D4 added). Next: E0.
