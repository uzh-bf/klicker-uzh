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
- 2026-11-02 E0: the cause is Argo CD's `RespectIgnoreDifferences=true` sync
  option (v3.0.12 on staging). Before applying, Argo merges every existing
  object's live state into its desired manifest, not only objects with an
  ignore rule (`normalizeTargetResources` in `controller/sync.go`). The
  selector is replaced as a whole, so the live selector without the tier
  exclusion wins on every sync. Ruled out: a revision mismatch, Gatekeeper
  mutators (none exist), duplicate renders, and the repo-server cache (a hard
  refresh changed nothing). A per-resource `ServerSideApply` option would not
  help because the merge runs before the apply, so the fix renames the
  baseline PDB to `-frontend-pwa-baseline` while the burst tier is enabled.
  Argo creates the new object as rendered and prunes the old one. Production
  gets the same protection when its burst tier is enabled. Other in-place
  changes to list-valued fields of existing objects can hit the same merge;
  any resource that stays `OutOfSync` after a successful sync points here.
- 2026-11-02 E1: added `deploy/dashboards/klicker-pwa-burst.json` (tier
  replicas, HPA state, CPU and memory per tier, spot node pressure from other
  tenants, restarts and evictions) and the "PWA spot burst tier" section in
  `docs/ci-and-deployment.md`. Every query was checked against staging
  Prometheus. The E0 rename and E1 ship together in #6797 (`v3-ai`) and
  #6798 (`v3`); staging gets them through the next `v3-ai` to
  `v3-adaptive-learning` sync.
- 2026-11-02 D1: the staging HAProxy ingress writes no HTTP access logs, so
  the fallback in D1 does not exist. The PWA has no Next.js proxy
  (middleware) today, so an `X-Served-By` header means adding one that runs on
  every PWA route in both environments. Proposed change for E3: measure P6 by
  running k6 inside `stg-klicker` against each tier's Pods directly, and leave
  the PWA source unchanged. Waiting for the user's decision before E3.
- 2026-11-02 E0 live: staging promoted `2c2655171e` (the #6802 ancestry
  repair after #6801 was squash-merged). Argo reports `Synced` with no
  out-of-sync resources; the old budget is pruned; `-frontend-pwa-baseline`
  excludes the tier and `-frontend-pwa-burst` allows one disruption. Staging
  runs one baseline replica against `minAvailable: 2`, so the baseline Pod
  can never be voluntarily evicted; this predates the burst tier and matters
  for the E4 drain drill.
- 2026-11-02 E2 dropped as a separate wait (user agreed): staging has no real
  load, so its load-independent checks (spot preemption, Argo drift,
  restarts, HPA floor) move into E5. D1 settled: k6 runs inside `stg-klicker`
  and probes one Pod per tier at the same rate; the PWA source stays
  unchanged.
- 2026-11-02 E3, 21:37:57–22:13:00 UTC, `util/load-test/pwa-burst.js`, peak
  30 iterations per second (one `/login` render and two static assets each),
  about 47 requests per second at the plateau:
  - P5 pass: 0 Service failures in all phases (99,069 requests). One baseline
    probe request timed out after 60 seconds at the plateau.
  - P6 pass: probe p95 burst 459 ms, baseline 496 ms.
  - P4 scale-up pass at the limit: CPU crossed the target about 21:39:30; the
    HPA went 2 to 3 at 21:41:34 and 3 to 4 at 21:42:34, about 3 minutes. Each
    step waited for the previous Pod to become Ready, because the HPA leaves
    unready Pods out of its CPU average. The default scale-up policy already
    allows four Pods per 15 seconds, so an HPA `behavior` block would not help.
  - P4 scale-down pass at the limit: load ended 22:13:30, 4 to 1 by 22:23:10.
    A cool-down at 2 iterations per second held 4 replicas, because the
    staging target is only 35m CPU per Pod.
  - P9 pass: no new Pending Pods on `asyncspot`; two Pending Pods in other
    namespaces predate the drill, and an ingestion rollout at 22:03 scheduled
    on its own pool.
  - Liveness and readiness probes (`/login`, 1-second timeout) failed at the
    plateau on the baseline Pod and a burst Pod; none restarted.
  - Confound: staging PWA Pods had a 200m CPU limit and 50Mi/200Mi memory;
    production requests the same 50m CPU with no CPU limit and 320Mi/1Gi
    memory. The two longest-running Pods were throttled in 84% of CFS periods
    between 21:45 and 22:00, so the probe failures and the one-minute cold
    start may be staging-shape effects. The HPA target (70% of 50m) is the
    same in production. The user approved matching the staging shape to
    production (#6806) and repeating E3 on it before E4. A probe change is
    considered only if probes still fail then, and needs its own approval
    because it changes the production render.
- 2026-11-03 E3 rerun on the production resource shape (#6806 and sync
  #6808 merged by the user; staging at `56be8acc75`), 17:10:28–17:45:30 UTC,
  same script and load profile:
  - P5 pass: 0 failures in 99,119 requests, including all probe requests.
  - P6 pass: probe p95 burst 20 ms, baseline 34 ms. Both probed Pods carried
    about 0.23 cores at the plateau.
  - P4 scale-up: the HPA went 1 to 2 at 17:11:29, 2 to 3 at 17:12:29 and 3 to
    4 at 17:14:29, about 3 minutes after crossing the target.
  - P4 scale-down pass at the limit: load ended 17:45:30; 4 to 2 at 17:51:08
    and 2 to 1 at 17:55:09, about 9.5 minutes. The cool-down at 2 iterations
    per second held 4 replicas: at about 55% average CPU against the 70%
    target, the HPA still asks for 4, and one hot Pod kept that average up
    (see the confound below).
  - No Unhealthy probe events and no restarts. Without a CPU limit there is
    no CFS quota, so throttling cannot occur. The baseline Pod's memory
    working set peaked at 201 MiB, which is at the old 200Mi staging limit;
    the first run was therefore also close to an OOM kill.
  - Confound: the ramp went through the PWA Service, which balances per
    connection. k6's reused connections stayed on the two Pods that existed
    at the start (about 0.23 cores each), while the three new burst Pods
    served almost nothing (about 0.009 cores each). One hot burst Pod at
    about 480% of its request kept the HPA average near 133% and the HPA at
    its maximum. This run proves the probe failures and throttling were
    staging-shape effects, but not that new burst Pods share load. The drill
    now routes the ramp through the ingress controller (`PWA_INGRESS_IP`),
    which balances per request as production traffic does. E3 runs a third
    time that way; E4 waits until the burst Pods share load at the plateau.
- 2026-11-03 E3 third run through the ingress controller
  (`PWA_INGRESS_IP`), 17:56:58–18:32:00 UTC, same load profile. This run is
  the E3 result:
  - P5 pass: 0 failures in 99,119 requests.
  - P6 pass: probe p95 burst 21 ms, baseline 27 ms; Service plateau p95
    16 ms.
  - Load sharing: at the plateau all five PWA Pods used 100–126m CPU each,
    so new burst Pods take their share as soon as they are Ready.
  - P4 scale-up pass: the target was crossed at about 17:58; the HPA went 1
    to 2 at 17:58:24, 2 to 3 at 17:59:25 and 3 to 4 at 18:00:25, about 2.5
    minutes.
  - P4 scale-down pass at the limit: load ended 18:32:30; 4 to 3 at 18:37:16,
    3 to 2 at 18:38:17 and 2 to 1 at 18:42:18, about 10 minutes.
  - No Unhealthy probe events and no restarts.
  - Finding for production sizing: at 30 iterations per second the HPA sat
    at its maximum of 4 with about 220% of the 50m request, while latency
    stayed low. The 70% target on a 50m request makes the tier reach its
    maximum at modest absolute load (about 35m CPU per Pod). Production uses
    the same request and target. Whether to raise the burst request, the
    target or `maxReplicas` before production enablement is a separate
    decision; nothing here changes the production render.
- 2026-11-03 E4 preparation (read-only, no cluster writes):
  - P8 second half pass: the staging render at `56be8acc75` with
    `frontendPWA.burst.enabled=false` drops the burst Deployment, HPA and
    PDB and returns the baseline PDB to `-frontend-pwa` without the tier
    exclusion; nothing else changes. `app-klicker` syncs with
    `prune: true`, so Argo removes the three objects.
  - Drain target: the burst Pod's `asyncspot` node runs no other workload
    Pods. The pool also hosts document processing, web scraping, e-learning
    and two LibreChat instances; all their ScaledObjects were inactive. The
    15-minute pool cordon (E4.4) would hold any of their scale-ups Pending.
  - The baseline node had about 1.1 cores free, enough for the single
    baseline Pod to carry the plateau alone in E4.4 (about 0.5–0.6 cores
    expected from E3).
  - Design: one k6 run through the ingress with a 40-minute plateau. Under
    the plateau, in order: E4.1 drain the burst node; E4.3 scale the
    baseline up to 2 and watch Argo revert it (never down, since one replica
    already misses `minAvailable: 2`); E4.4 cordon all `asyncspot` nodes,
    delete the burst Pods and hold at most 15 minutes, then uncordon. E4.2
    follows with `START_RATE=1`, because the run 3 cool-down at 2 iterations
    per second held 4 replicas and terminated no Pod under load.
  - E4.5 waits for the next ordinary staging promotion or the X1
    `RollingUpdate` override; it is not forced.
  - Recovery checklist: uncordon every `asyncspot` node and confirm none is
    `SchedulingDisabled`; Argo `Synced` and `Healthy`; baseline back to 1;
    burst HPA back to 1; k6 Pod and both ConfigMaps deleted.
- 2026-11-03 E4 run (20:08–21:22 UTC, one k6 run through the ingress at
  30 iterations per second with a 40-minute plateau, then a short rerun for
  E4.2):
  - Plateau: 0 of 215,697 Service requests failed across E4.1, E4.3 and
    E4.4; Service p95 17 ms, baseline probe p95 32 ms. The only failures
    were the burst probe against the Pod deleted in E4.4, read separately.
  - E4.1 pass: the burst node already hosted other tenants' Pods, so the
    drill cordoned it and evicted only the burst Pods
    (`kubectl drain --pod-selector=klicker.uzh.ch/tier=burst`). The node had
    two burst Pods; the PDB refused the second eviction until the first
    replacement was Ready, then allowed it (18 seconds in total).
  - E4.3 pass: scaling the baseline to 2 was reverted to 1 by Argo
    self-heal within 6 seconds; the running baseline Pod was kept. The
    burst HPA's replica count was left alone throughout.
  - E4.4 partial: with all five `asyncspot` nodes cordoned, the four burst
    Pods went Pending and the single baseline Pod carried the full load
    without a probe failure or restart. The cluster autoscaler then added a
    sixth `asyncspot` node (the pool was below its maximum), and all four
    burst Pods were Ready on it about 100 seconds after the delete. The
    baseline therefore carried the plateau alone for about 100 seconds, not
    15 minutes. Spot capacity exhaustion stays untested: it needs the pool
    at its maximum, which a node-pool change would require. One cordoned
    node was removed by the autoscaler during the hold; the pool ended
    with five Ready nodes and none `SchedulingDisabled`.
  - All four burst Pods landed on the one new node, so losing it removes
    the whole tier. This supports the X1 soft hostname topology spread.
  - E4.2 partial: the k6 Pod hit its 50-minute `activeDeadlineSeconds`
    before the cool phase. The rerun (1-minute ramp, 4-minute plateau, 18
    minutes at 1 iteration per second) had 0 of 35,759 failures, 0 in the
    cool phase. The HPA removed one Pod under load (4 to 3 at 21:11); at
    1 iteration per second three Pods sat at about 50% of request, so it
    held 3 until the load ended. The k6 Pod deadline is raised to 90
    minutes.
  - Recovery: every `asyncspot` node uncordoned, Argo `Synced` and
    `Healthy`, baseline at 1, k6 Pod and ConfigMaps deleted; the burst HPA
    returns to 1 on its own after the load.
- 2026-11-07 E3 rerun on the burst sizing and spread change (#6818, sync
  #6822; staging at `874ece72c6`): burst requests 150m CPU and carries a
  soft zone and hostname spread. Through the ingress, 21:21:24–21:56:35
  UTC, same load profile:
  - P5 pass: 0 of 90,675 Service requests failed (ramp, plateau and cool).
  - P6 pass: probe p95 burst 16 ms, baseline 55 ms; Service plateau p95
    29 ms.
  - Sizing pass: the HPA went 1 to 2 at about 21:26 and held 2 through the
    plateau at 62–67% of the 70% target. The tier no longer sits at its
    maximum of 4 under this load.
  - Spread pass: the two burst Pods ran on different `asyncspot` nodes in
    different zones.
  - Scale-down: load ended about 21:41:30; 2 to 1 at about 21:48.
  - The burst probe failed 803 of 3,968 requests. Their count matches the
    time after the HPA removed the probed Pod at 21:48 (expected; see the
    README). No Unhealthy probe events under load and no restarts.
  - Recovery: k6 Pod and ConfigMaps deleted; Argo `Synced` and `Healthy`.
- 2026-11-08 E4.5 on the ordinary promotion of sync #6824 (staging
  `874ece72c6` to `cca9595e4b`). One k6 run through the ingress at 15
  iterations per second, 12:55:25–13:24 UTC; Argo synced about 12:58 and
  both PWA Deployments rolled with staging's `Recreate` strategy:
  - Service: 340 of 70,917 requests failed, all at the plateau and all
    between about 12:58:20 and 12:59:10, while the old baseline and burst
    Pods were gone and the new ones were not yet Ready (113 pages, 227
    assets). Ramp and cool phases had 0 failures.
  - P10 inconclusive: the script counts failures but does not record their
    status codes, and the staging ingress keeps no access logs. The window
    matches a `Recreate` gap (no Ready endpoint), not a version-skew 404,
    but that is not proven.
  - Probe failures (87% per tier) are expected: both probed Pods were
    replaced by the rollout.
  - Readiness probes failed only on new Pods during startup; no restarts.
    Recovery: k6 Pod and ConfigMaps deleted; Argo `Synced` and `Healthy`.
  - A conclusive P10 needs the X1 staging `RollingUpdate` override and a
    status-code tag on failed requests in `pwa-burst.js`.
- 2026-11-09 E4.5 rerun with rolling updates (#6825, sync #6830; staging
  `3f8e8be4a5` to `f5c0a04efa`). Staging now rolls all its Deployments with
  `maxUnavailable: 0`. One k6 run through the ingress at 15 iterations per
  second, 11:56:41–12:25 UTC; the PWA rolled about 11:59:
  - Availability pass: 0 page failures; Service plateau p95 23 ms. The
    `Recreate` gap of the previous run is gone.
  - P10 fail: 36 of 67,500 plateau requests returned 404, all assets,
    between 11:59:16 and 11:59:22 UTC. Each iteration requests the assets
    of the page it just loaded, so these are pages from a new Pod whose
    assets landed on an old Pod.
  - The promotion changed only staging values, yet the rebuilt images
    serve different asset paths. Every promotion therefore causes this
    skew window, in production too, where the PWA also rolls.
  - Probe failures (88% per tier) are expected: both probed Pods were
    replaced. Recovery: k6 Pod and ConfigMaps deleted; Argo `Synced` and
    `Healthy`.
- 2026-11-09 Release asset Deployments (#6832, executor repin #6833, sync
  #6834) reached staging at `7e2fd139dc`. Both asset Deployments run, and
  both ingresses route `/_next/static` to them ahead of `/`. One k6 run
  through the ingress at 15 iterations per second, 21:05–21:34 UTC:
  - 0 page failures; Service plateau p95 21 ms.
  - 33 of 67,500 plateau requests returned 404, all assets, all between
    21:06:45 and 21:06:46. That second matches the first ingress update to
    the new route (21:06:44), which Argo applied together with the PWA
    rollout. This promotion created the asset Deployments, so it does not
    show the steady-state behaviour.
  - P10 stays open until the next ordinary promotion, when the asset
    Deployment already exists and only rolls ahead of the PWA.
- 2026-11-10 First ordinary promotion with the asset Deployments in place
  (`9f9f5cea50`). One k6 run through the ingress at 15 iterations per
  second, 15:43–16:12 UTC:
  - 0 page failures; Service plateau failure rate 0.23%, p95 24 ms.
  - 161 plateau requests returned 404, all assets, between 15:45:22 and
    15:46:06. The asset Pod rolled first, the PWA Pods about 50 seconds
    later, so old pages asked the new asset Pod for old assets.
  - Cause: the new asset image held only its own release
    (`releases/index.txt` listed one build ID). The image build ran while
    `stg-release` pointed at a commit merged directly into it, which has
    no images, so the previous-image lookup found nothing and the build
    took the `no-previous-release` path.
  - P10 still fails, but this run did not test the design. Fix: the lookup
    must fall back to the newest earlier `stg-release` commit that has an
    image (or read the image staging actually runs). Rerun at the next
    promotion after that fix.
  - Probe failures (90% and 92% per tier) are expected: both probed Pods
    were replaced. Recovery: k6 Pod and ConfigMaps deleted; Argo `Synced`
    and `Healthy`.
