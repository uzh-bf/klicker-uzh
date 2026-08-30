# W2 — Hatchet worker capacity and lifecycle contract

## Plan identity

- Plan: `project/2026-08-22-pr-5492-hatchet-worker-runtime-contract-plan.md`
- Branch: `rs/hatchet-worker-runtime-contract`
- Worktree: `trees/rs-hatchet-worker-runtime-contract`
- Target: `v3`; PR #5492 exists and is based on W1 / PR #5491
- Exact parent: `rs/scaling-replica-ownership` at
  `4c1d25e41e5e3024bdfcb13cb763124f50a0aca1`
- Status: audit remediation, focused verification, and correction reviews are
  complete locally; final stack review is pending
- Stack topology: `v3 <- rs/scaling-replica-ownership (W1) <-
  rs/hatchet-worker-runtime-contract (W2)`
- Stack state: the local W1 branch contains the approved `origin/v3`
  integration and chart corrections, and W2 contains that exact W1 head. The
  open PRs [#5491](https://github.com/uzh-bf/klicker-uzh/pull/5491) and
  [#5492](https://github.com/uzh-bf/klicker-uzh/pull/5492) still point to their
  older remote heads. Push, PR updates, merge, deployment, and runtime actions
  remain withheld.

### History

- [Scaling execution roadmap](../../trees/klicker-scaling-investigation/project/2026-08-22-klicker-scaling-execution-roadmap.md)
- [Scaling investigation findings](../../trees/klicker-scaling-investigation/project/2026-08-22-klicker-scaling-investigation-findings.md)
- [Scaling investigation plan](../../trees/klicker-scaling-investigation/project/2026-08-22-klicker-scaling-investigation-plan.md)
- [W1 replica ownership plan](../../trees/rs-scaling-replica-ownership/project/2026-08-22-pr-5491-scaling-replica-ownership-plan.md)
- [Planning-stage review disposition](project/_local/reviews/2026-08-22-hatchet-worker-runtime-contract-planning.md)
- [Final integrated review disposition](project/_local/reviews/2026-08-23-hatchet-worker-runtime-contract-final-review-rebased.md)

## Goal

Establish one explicit, testable capacity and lifecycle contract for the three
KlickerUZH Hatchet worker modes:

- `hatchet-worker-general` for general workflows;
- `hatchet-worker-response-processor` for regular live-quiz responses; and
- `hatchet-worker-response-processor-assessment` for assessment responses.

W2 will:

- pass explicit non-durable and durable slot counts to the pinned Hatchet SDK;
- keep regular-response and assessment capacity, identity, and configuration
  separate even though they share one executable;
- provide a minimal local HTTP health server with distinct liveness and
  intake-readiness endpoints;
- make termination become unready before the SDK stops accepting new work;
- define bounded Kubernetes termination and safe retry behavior without an
  exactly-once claim;
- add focused configuration, health, termination, and workflow-registration
  tests;
- add Helm probes, termination grace periods, and explicit worker-only
  disruption budgets without changing workflow registration, replica counts,
  or replica ownership; and
- document the contract in `docs/async-and-workers.md` for W3's later queue and
  autoscaling work.

## Non-goals

- No KEDA, HPA, queue metric, Prometheus, ServiceMonitor, autoscaling, or
  rightsizing implementation.
- No Spot scheduling, interruption test, or on-demand/Spot capacity policy.
- No task, workflow, retry-count, Redis business-logic, assessment-routing, or
  database change.
- No Hatchet SDK upgrade. The checked-in `@hatchet-dev/typescript-sdk` remains
  `1.9.4`.
- No claim of exactly-once execution, complete drain, or idempotent side
  effects that have not been verified.
- No cluster connection, deployment, Argo sync, live Hatchet task, pod
  deletion, Secret or environment-value inspection, merge, or release.
- No source of truth migration. W2 records its plan only in this worktree's
  existing `project/` artifacts root.

## Execution contract

- **Execution owner:** the current W2 package execution orchestrator owns the
  approved local edits, slice integration, review dispatch, verification,
  `Progress`, and local commits.
- **Current authority:** on 2026-08-29 the user approved one upstream
  integration pass for W1, propagation into W2, the chart corrections named
  by the production-readiness audit, fresh local checks, and final stack
  review. This includes scoped local commits in both existing worktrees.
- **One-time approval:** granted on 2026-08-29 for that exact local gate.
- **Granted work:** manual worktree-local implementation, repository-native
  checks, focused tests, values-free Helm renders, required local reviews,
  local commits, and the named local stack adoption.
- **Withheld:** push, PR updates, merge, release, deploy, Argo sync, cluster
  mutation, live Hatchet tasks, and pod deletion. These remain separate
  approvals.
- **Boundary owner:** `rs-roadmap-orchestrator` owns the W1 dependency, the
  roadmap boundary, and any later delivery decision.
- **Future terminal:** `pr_ready` means the W2 changes are locally committed,
  reviewed, checked, rendered, and documented, with the proposed local stack
  adoption recorded. It is not CI, deployed, live-runtime, or throughput
  proof.
- **Pause conditions:** pause before implementation or local stack adoption if
  the exact W1 parent changes, a required exact-route reviewer is terminally
  unavailable, the pinned SDK behavior differs from the verified source, the
  chart introduces a second replica owner, workflow registration cannot be
  preserved, or a fix would require any withheld external action.

## Freshness, worktree, and authority evidence

- The 2026-08-29 freshness gate fetched `origin/v3` at
  `f0659e1301254320b2f67a0a4be752ebf6a41c0f` before authoritative inspection.
- The primary checkout is on `docs/chatbot-hitl-config-roadmap`, is 127 commits
  behind and one commit ahead of `origin/v3`, and contains unrelated work. It
  has not been mutated.
- W1 integrated that fetched `origin/v3` with a merge commit and closed the HPA,
  phantom-autoscaling, CI-gate, and documentation findings at implementation
  head `518869dc2`. Documentation-only progress commit `4c1d25e41` is the
  current W1 tip.
- W2 propagated the corrected implementation with local merge commit
  `b152b4608`, applied the worker disruption-budget correction at `1a7380260`,
  and propagated the documentation-only W1 tip with merge commit `c40c5ce8c`.
  No rebase, force push, remote branch update, PR write, deployment, or runtime
  action occurred.
- The proposed topology remains `v3 <- rs/scaling-replica-ownership <-
  rs/hatchet-worker-runtime-contract`; the remote PR heads are stale until a
  separate push is authorized and exact-head CI completes.

## Problem and evidence

### Problem

The current worker processes register workflows but do not expose an explicit
per-pod capacity contract, an intake-readiness signal, or a documented
termination boundary. KEDA arithmetic cannot safely use an implicit SDK
default. Kubernetes can also send a terminating worker through a probe state
that does not distinguish a live process from a worker that should receive no
new assignments.

The response processor has two operational modes in one binary. The assessment
mode must not silently share the regular worker's capacity or Hatchet identity.

### Findings

| Finding | Evidence | Consequence for W2 |
|---|---|---|
| General startup is inline | `apps/hatchet-worker-general/src/index.ts:15-57,124-151` parses `HATCHET_WORKFLOWS`, creates a worker, and awaits `worker.start()`; there is no HTTP server. | Extract only the runtime seam; preserve task selection and fatal-process behavior. |
| Response mode is selected by one env flag | `apps/hatchet-worker-response-processor/src/index.ts:88-106` chooses regular or assessment workflow arrays from `ASSESSMENT_MODE`. | Keep the arrays intact and make the mode-specific configuration testable without importing a side-effecting entrypoint. |
| General tasks are centralized | `packages/hatchet/src/index.ts:12-310` prepares the general task map; `packages/hatchet/src/client.ts:8-33` owns the SDK singleton. | Put the generic runtime and config seam in `packages/hatchet/src/`; do not move business handlers. |
| Worker charts lack active probes | `deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml:1-235` has three Deployments and commented `/healthz` stubs, but no port, probes, or grace period. | Add the same explicit probe and grace contract to all three workers. |
| Configuration is already split into three ConfigMaps | `deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml:1-32` has separate general, regular, and assessment ConfigMaps; only assessment sets `ASSESSMENT_MODE`. | Add per-mode worker names, ports, and explicit preserved slot defaults without creating a global capacity fallback. |
| Replica ownership is W1-owned | W1's verified chart contract governs `spec.replicas` versus an autoscaler. | W2 does not add an autoscaler or change replica counts; its audit remediation makes only the three worker PDB floors explicit. |
| Documentation overstates validation | `docs/async-and-workers.md:35-45` says unknown `HATCHET_WORKFLOWS` keys are rejected; source warns and filters them. | Correct the documentation in the same change. |
| The pinned SDK supports explicit slots | `@hatchet-dev/typescript-sdk@1.9.4`, `v1/client/worker/worker.d.ts`, and `v1/client/worker/worker.js` expose `slots` and `durableSlots`. | Pass both values explicitly for every worker mode. |
| The pinned SDK owns signal shutdown | `v1/client/worker/worker-internal.js` installs signal handlers that unregister, await that internal worker's futures, and exit. | Put a readiness gate before SDK worker construction; do not rely on `handleKill: false`, which the pinned callbacks do not consult. |

## Contract decisions

### Capacity

W2 will use the SDK's `slots` option for non-durable work and
`durableSlots` for the internal durable worker. These are per-pod limits, not
queue targets and not throughput guarantees.

| Mode | Worker identity | Non-durable slots | Durable slots | Source configuration |
|---|---|---:|---:|---|
| General | `hatchet-worker-general` | 100 | 1000 | `HATCHET_WORKFLOWS` remains optional and defaults to the current prepared-task selection. |
| Regular response | `hatchet-worker-response-processor` | 100 | 1000 | `ASSESSMENT_MODE` is absent or false; regular response tasks remain unchanged. |
| Assessment response | `hatchet-worker-response-processor-assessment` | 100 | 1000 | `ASSESSMENT_MODE=true`; assessment workflows remain unchanged. |

These explicit values preserve the effective defaults of the pinned Hatchet
TypeScript SDK 1.9.4: 100 non-durable slots and 1000 durable slots per pod.
They are not SLOs, throughput guarantees, or measured capacity claims. W3
must measure queue depth, task duration, retries, and resource consumption
before changing these values or deriving a KEDA target.

The three worker identities and their mode-specific settings must remain
independent in code defaults and in the merged base, STG, and PRD rendered
configuration. The base chart defines shared runtime defaults; environment
overlays override only environment-specific values. The assessment worker
receives its own Hatchet identity. The rollout documentation must call out that queued work routed to
the former shared assessment identity may need the normal Hatchet retry or
replay path during a rolling replacement; W2 does not claim migration of live
assignments.

### Runtime and health

Add one small shared runtime module under `packages/hatchet/src/`, exported
from the package entrypoint. It owns configuration parsing, health-server
state, and the generic worker bootstrap; it does not own task definitions,
Redis handlers, or business logic.

The runtime configuration resolver will accept these environment inputs:

- `HATCHET_WORKER_NAME`;
- `HATCHET_WORKER_SLOTS`;
- `HATCHET_WORKER_DURABLE_SLOTS`;
- `HATCHET_WORKER_HEALTH_PORT`; and
- `HATCHET_WORKER_STARTUP_TIMEOUT_MS`.

It validates positive finite integers, supplies the three mode-specific local
defaults above when an environment value is absent, and fails closed on an
invalid explicit value. Helm ConfigMaps still set every value explicitly so a
rendered pod never depends on an implicit shared default. The initial rendered
startup timeout is `30_000` milliseconds for each mode.

The built-in Node HTTP server listens on `0.0.0.0:8001` for general workers,
`0.0.0.0:8002` for regular-response workers, and `0.0.0.0:8003` for
assessment workers by default, and serves:

- `GET /healthz`: liveness. Return `200` while the process is in `starting`,
  `ready`, or `draining` state. Return `503` after a fatal startup failure or
  stopped state.
- `GET /readyz`: intake readiness. Return `503` during `starting`, `draining`,
  and `stopped`; return `200` only after workflow registration has completed
  and `worker.start()` has been launched without a synchronous failure.
- Any other path or method: return `404` without exposing configuration or
  task data.

The readiness definition is deliberately local and honest. `/readyz` is a
rollout and observability signal, not an independent Hatchet intake control.
The actual intake boundary is the pinned SDK listener-unregister path. The pinned SDK has
no public ready callback, and its `isPaused()` result does not by itself prove
the server-side state transition or simultaneous readiness of its durable and
non-durable internal workers. W2 therefore does not use `isPaused()` as a
readiness gate and does not present `/readyz` as remote Hatchet connectivity,
queue health, or throughput proof. The bounded startup timeout applies to
worker creation and registration; a failed or unexpectedly resolved
`worker.start()` moves the runtime to `faulted` and exits through the existing
process restart path.

The state machine is:

1. `starting`: health server is available, worker registration is in progress,
   liveness is `200`, readiness is `503`.
2. `ready`: registration has completed and the SDK listener start has been
   launched; both probes are `200`.
3. `draining`: a termination signal has synchronously set readiness to `503`;
   liveness remains `200` while the SDK handles its own unregister and drain.
4. `faulted` or `stopped`: both probes are `503`, followed by process exit.

The existing `unhandledRejection` and `uncaughtException` handlers continue to
exit the process. Where the runtime can observe a startup failure first, it
marks `faulted` before exit; a crash that reaches the existing handlers may
close the process before a probe observes the state. If `worker.start()`
resolves while the runtime is still `starting` or `ready`, that is an
unexpected stop and moves the runtime to `faulted`; resolution after the signal
gate has entered `draining` is normal cleanup.

### Termination

The runtime installs its signal gate before it constructs the Hatchet worker.
Node invokes that handler before the pinned SDK's handlers because the SDK
registers its handlers during worker construction. The gate only changes the
local lifecycle state and readiness response; it must not call `process.exit`
or invoke `worker.stop()` a second time.

The pinned SDK then performs its existing boundary:

1. the SDK unregisters its action listener, which stops new assignments;
2. each pinned internal worker waits on the futures it owns;
3. the process exits when the SDK's signal path completes.

The response processor has separate non-durable and durable internal workers.
Their independent signal handlers can make one worker's completion exit the
process while the other still has work in flight. This is an accepted pinned
SDK limitation. `terminationGracePeriodSeconds: 90` is the outer Kubernetes
window, not a promise that every task finishes. A hard kill or early SDK exit
must be treated as safe-retry/replay territory. W2 makes no exactly-once
claim and does not assert that all downstream side effects are idempotent.

### Workflow registration

The runtime factory receives the exact workflow collection selected by each
entrypoint and passes it unchanged to `hatchetClient.worker`. The general
selection logic, including its current warn-and-filter treatment of unknown
`HATCHET_WORKFLOWS` keys, remains intact. The response processor keeps its
regular and assessment workflow arrays intact and changes only the assessment
worker identity and runtime options.

## Delegation map and execution routing

The current session remains the W2 execution orchestrator. It owns the
cross-slice runtime seam, mode wiring, chart integration, documentation,
verification, review disposition, and local delivery record. No implementation
child is dispatched: each slice crosses the shared runtime, workflow
registration, and acceptance seams, so an executor would add handoff and
integration risk without reducing the bounded work. This is an explicit
critical-path-coupling decision, not an implicit omission.

| Work item | Owner and route | Acceptance owner |
|---|---|---|
| Slice 1 shared runtime and tests | Main session; critical-path coupling | Main session plus exact-route slice review |
| Slice 2 entrypoint integration and mode tests | Main session; critical-path coupling with Slice 1 | Main session plus exact-route slice review |
| Slice 3 Helm values, probes, and rendering | Main session; cross-layer ownership and replica guard | Main session plus exact-route slice review |
| Slice 4 documentation and integrated verification | Main session; same-change wiki maintenance and final proof | Main session plus exact-route final review |

All planning, research, and review children use `opencode-go/ox-alpha-free` at
maximum reasoning. If a named native role cannot honor that exact route, use a
route-neutral native child with the same exact model or stop at the terminal
route blocker; never substitute another provider.

## ADR and skill gates

No new ADR is required. W2 implements the roadmap-approved internal worker
capacity, health, and termination contract without changing a public API,
schema, data model, or external ownership boundary. Reopen the ADR gate if
implementation requires a Hatchet SDK upgrade, a public package contract,
replica-owner change, or an irreversible runtime policy.

The active workflow skills are `$rs-sliced-development-workflow` for slice,
review, commit, progress, and finish gates; `$rs-stacked-change` and its
GitHub subskill for the single local W2 layer and approved local adoption;
`$rs-model-routing` for exact child routing and lifecycle; the repository
testing-verification skill for package and chart checks; the wiki-maintenance
skill for `docs/async-and-workers.md` and `docs/ci-and-deployment.md`; and
`$rs-local-runtime-lifecycle` for any DevPod or devrouter use.
No browser or UI skill applies.

## Implementation slices

W2 remains one stack layer and one reviewable work package. The slices below
are local implementation and commit boundaries, not additional stack layers.
Splitting the runtime, worker wiring, and probes into separate stack layers
would make the lifecycle contract incomplete at each boundary.

### Slice 1 — Shared runtime and focused tests

**Do:**

- Add the runtime/configuration module under `packages/hatchet/src/`.
- Export the mode-aware resolver and generic worker bootstrap from
  `packages/hatchet/src/index.ts`.
- Use only Node's built-in `node:http`, timers, and test utilities.
- Add a package `test:run` script and focused Node tests under
  `packages/hatchet/test/`.

**Check:**

- positive and invalid slot values are handled fail-closed;
- all three mode defaults preserve the pinned capacity and use distinct names
  and health ports;
- the health server returns the specified liveness/readiness statuses;
- worker creation receives the unchanged workflow collection and explicit
  `slots`/`durableSlots` options;
- startup failure and unexpected worker-stop transitions are observable; and
- the injected signal test records readiness false before the no-intake/exit
  path.

### Slice 2 — Entrypoint integration and mode tests

**Do:**

- Wire `apps/hatchet-worker-general/src/index.ts` to the runtime while
  preserving Redis setup, task preparation, `HATCHET_WORKFLOWS`, and fatal
  handlers.
- Wire `apps/hatchet-worker-response-processor/src/index.ts` to the runtime
  while preserving the existing regular and assessment task declarations.
- Extract only the pure response mode/configuration selection seam required to
  test `ASSESSMENT_MODE` without starting a worker during module import.
- Add focused response mode tests and the required `test:run` script. Add a
  general workflow-selection test only if the extraction is needed to keep the
  existing selector directly covered.

**Check:**

- regular and assessment configuration use different worker names and health
  ports while retaining the explicit 100/1000 slot defaults;
- regular tests select only the two regular response workflows;
- assessment tests select only the assessment workflow and aggregation task;
- the general workflow selection remains unchanged; and
- both app packages type-check and build with the shared runtime.

### Slice 3 — Helm chart, values, and rendering

**Do:**

- Define the shared per-worker runtime fields in
  `deploy/charts/klicker-uzh-v3/values.yaml`; let the environment overlays
  override only values that differ by environment. The fields are worker name,
  non-durable slots, durable slots, health port, startup timeout, and
  `terminationGracePeriodSeconds`.
- Add the corresponding keys to each ConfigMap in
  `templates/cm-hatchet-workers.yaml`.
- Add the named HTTP container port, `/healthz` liveness probe, `/readyz`
  readiness probe, and per-pod `terminationGracePeriodSeconds` to all three
  Deployments in `templates/deployment-hatchet-workers.yaml`.
- Preserve `envFrom`, image settings, replicas, non-worker PDBs, node placement,
  tolerations, and W1's single replica-owner rule. Define explicit
  environment-specific PDB floors only for the three worker Deployments.

**Check:**

- Helm lint passes;
- base, STG, and PRD renders contain all three worker ports, probes, and grace
  periods;
- regular and assessment rendered ConfigMaps contain distinct names and ports
  plus the explicit 100/1000 slot defaults;
- no worker Deployment gains or loses a replica owner; and
- the existing `util/check-klicker-replica-ownership.mjs` gate remains green.

### Slice 4 — Documentation and integrated verification

**Do:**

- Update `docs/async-and-workers.md` frontmatter and content with the capacity
  table, environment keys, probe semantics, local readiness limitation,
  signal ordering, SDK drain race, safe-retry boundary, and assessment identity
  rollout note.
- Correct the statement about unknown `HATCHET_WORKFLOWS` keys.
- Update the worker deployment facts in `docs/ci-and-deployment.md` so the
  Helm probe and termination-grace contract is discoverable from the deployment
  page without claiming deployed or live evidence.

**Check:**

- the documentation is accurate on a cold read;
- package, worker-app, root, formatting, and Helm checks pass;
- focused configuration, health, and termination tests pass; and
- all acceptance evidence below is captured without credentials, PII, raw
  task data, response bodies, or live-runtime claims.

## Feature-wide test portfolio

| Test obligation | Stable seam | Distinct failure caught | Slice |
|---|---|---|---|
| Explicit per-mode slots and names | Runtime configuration resolver with injected environment | A missing or invalid value silently falls back to a shared SDK default | 1 |
| Regular and assessment separation | Pure response-mode selector and resolved config | The assessment executable registers regular workflows or inherits regular capacity | 2 |
| Liveness versus intake readiness | In-process Node HTTP server over lifecycle state | Kubernetes treats a draining worker as ready, or a live process as dead | 1 |
| Termination ordering | Injected signal source, fake worker intake, and exit recorder | New intake begins after readiness drops, or exit precedes the readiness transition | 1 |
| Workflow registration preservation | Fake SDK worker factory capturing the exact workflow collection | Runtime wiring drops, reorders, or replaces a workflow declaration | 1 and 2 |
| Probes, grace, worker PDBs, and replica ownership | Base/STG/PRD Helm renders plus the ownership checker | One worker lacks probes/grace, receives the wrong disruption floor, or gains a second replica owner | 3 |
| Documentation consistency | Wiki validator, Markdown formatting, and cold-read review | The operational contract or evidence boundary is misstated | 4 |

The portfolio adds only tests for consequential observable contracts. It does
not add a broad integration suite, live Hatchet tasks, cluster probes, or
throughput claims.

## Acceptance evidence

| Contract | Required evidence | Proof boundary |
|---|---|---|
| Repository-native checks | In the devcontainer, run the relevant `@klicker-uzh/hatchet`, general-worker, and response-worker checks and builds, the focused test scripts, root checks applicable to the diff, and formatting. | Source and local test/build evidence only. |
| Distinct regular/assessment config | A focused test asserts separate mode names and health ports, preserved 100/1000 slot defaults, `ASSESSMENT_MODE` behavior, and workflow arrays; rendered STG/PRD ConfigMaps show the same separation. | Local code/test and desired-render evidence; not deployed state. |
| Health contract | A local HTTP test asserts `/healthz` and `/readyz` statuses through `starting`, `ready`, `draining`, and faulted/stopped transitions. | Local process evidence; no external Hatchet health claim. |
| Termination ordering | A local injected-signal or subprocess test proves readiness returns 503 before the fake SDK stop-intake/exit path and that an intake attempt after the signal is rejected. | Contract-model evidence; it does not prove a live pod drain. |
| Helm probes and grace | `helm lint` plus values-free `helm template` for base, STG, and PRD proves general, regular-response, and assessment workers have named ports 8001, 8002, and 8003 respectively, `/healthz` liveness, `/readyz` readiness, and grace period 90. | Desired manifest/render evidence only. |
| Replica ownership | `util/check-klicker-replica-ownership.mjs` remains green for the worker and existing 15-Deployment chart contract. | Existing W1 source/render gate. |
| Worker disruption budgets | The same render gate proves base floors of 1/1/1, staging floors of 0/0/0, production floors of 1/2/2, and the independent assessment-backend floor of 2. | Desired manifest/render evidence only; no node drain is performed. |
| Workflow registration | The runtime factory test captures the unchanged workflow list passed to the SDK worker; app checks/builds pass; mode tests cover regular and assessment selections. | Local registration seam evidence, not a live Hatchet task. |
| Documentation | Wiki validation and Prettier pass; the worker documentation records source locators and the accepted SDK limitation. | Repository documentation evidence. |

The plan must report source, CI, desired-state, deployed-revision,
live-runtime, and cross-service evidence separately. W2's terminal layer is
source plus local test and render evidence. No green local build, merge, image,
Argo health, or live pod status is to be presented as throughput or deployment
proof.

## Research and source-backed constraints

| Question | Evidence | Limitation |
|---|---|---|
| Which SDK fields express slots? | Context7 current Hatchet TypeScript documentation and the pinned 1.9.4 `Worker` declarations/source confirm `slots` and `durableSlots`. | W2 uses the pinned source; a future SDK upgrade needs a fresh compatibility review. |
| When does pinned `Worker.start()` resolve? | Pinned `v1/client/worker/worker.js` documents and implements a promise that resolves when workers stop or are killed. | It cannot be used as a ready callback. |
| How does pinned termination work? | Pinned `v1/client/worker/worker-internal.js` unregisters the listener and waits that internal worker's futures before `process.exit(0)`. | Durable and non-durable internal workers have independent handlers, so complete fleet drain is not proven. |
| Is there a pinned health server? | The pinned package inspection found no health server seam suitable for this worker contract. | Current Hatchet documentation describes newer health behavior; W2 does not depend on it. |
| What existing HTTP pattern is safe? | `apps/response-api/src/index.ts` uses Node's bare HTTP server and `/healthz`. | The worker adds `/readyz` because liveness and intake readiness have different meanings. |
| What owns replica counts? | W1's chart contract and `util/check-klicker-replica-ownership.mjs`. | W2 does not add or change an autoscaler; explicit worker PDB values are availability policy, not replica owners. |

The planning-stage review was run with `opencode-go/ox-alpha-free` at maximum
reasoning. Its `DONE_WITH_CONCERNS` result was verified against the pinned SDK
source. The report is at
`project/_local/reviews/2026-08-22-hatchet-worker-runtime-contract-planning.md`.
The readiness recommendation was changed to remove the unsupported
`isPaused()` gate. The SDK dual-worker drain race, preserved default capacity,
assessment identity change, and exact fault transitions are explicitly
dispositioned in that report and in this plan.

## Review routing during execution

- Keep the current W2 branch as one stack layer. Do not create a second W2
  stack layer or split the worker modes into separate branches.
- Dispatch the required simplifier and risk-selected slice review for the
  audit correction, then an integrated stack review. Route these through the
  current `rs-model-routing` continuity ladder and record any native specialist
  failure and the selected equivalent route.
- Run the final integrated review after all local slices and verification are
  complete, before presenting W2 as `pr_ready`.
- Verify every child report against the worktree before applying advice. A
  timeout or empty wait is non-terminal and is not a reason to replace a
  healthy child.

## Progress

| Date | Layer | Evidence | Status / next action |
|---|---|---|---|
| 2026-08-22 | Freshness and W1 boundary | W1 was initially clean at exact head `3cfdcf27f`; W2 was manually based on that head; primary checkout remained untouched. | Historical baseline. The accepted current W1 head is recorded below. |
| 2026-08-22 | Repository and SDK research | Worker entrypoints, package seams, Helm templates/values, async-worker docs, current Context7 Hatchet docs, and pinned SDK source inspected. | Complete. Use the pinned SDK constraints above. |
| 2026-08-22 | Planning review | Exact-route native planning review returned `DONE_WITH_CONCERNS`; all findings are verified and dispositioned. | Complete. Write only this plan and the ignored review report before approval. |
| 2026-08-22 | Implementation approval | The user approved local W2 implementation through reviewed commits and local adoption of the proposed topology. | Granted. Execute the four local slices on this branch. |
| 2026-08-22 | Slice 1 — shared runtime | `@klicker-uzh/hatchet` focused tests pass (4 tests), `check` passes, and the package build renders successfully in the W2 DevPod. | Implemented in rebased equivalent `f1b991e20` (original local slice commit `d993add15`). Exact-route simplifier and risk review both accepted the slice with advisory P3 dispositions; no code changes required. |
| 2026-08-22 | Slice 2 — entrypoint integration | Both worker entrypoints use the shared runtime; pure mode tests cover regular/assessment mapping and exact workflow collection identity, while package tests cover names and slots. | Implemented in rebased equivalent `76cf232e2` (original local slice commit `800d96fd2`). Exact-route simplifier accepted; risk review accepted P3 dispositions. Per-deployment worker names are explicit in Slice 3. |
| 2026-08-22 | Slice 3 — Helm capacity and probes | Base, STG, and PRD values define distinct worker names and slot contracts; all three worker Deployments render mode-specific ports 8001/8002/8003, `/healthz` liveness, `/readyz` readiness, and 90-second grace; lint and replica ownership pass. | Implemented in rebased equivalent `8ecbeb2dc` (original local slice commit `5ef1998a0`). Exact-route simplifier accepted; risk review accepted after rejecting the invalid slow-start liveness concern and documenting the pinned-SDK drain race. Host-only Helm tooling is recorded for the evidence split. |
| 2026-08-22 | Slice 4 — documentation and integrated verification | Async worker and deployment wiki pages now describe capacity, probes, termination, retry boundaries, and desired-state limits; the documentation records local evidence and the Helm environment split. Focused Node/DevPod tests, app checks/builds, Helm renders, lint, and ownership checks pass. Targeted Prettier passes. | Implemented in rebased equivalents `533501d0c` and `53fe4d6a9` (original local close-out `25997f09b`). The full DevPod `check:all` was stopped after the existing analytics pandas build/compiler failure and silent continuation; the full wiki validator still reports 13 pre-existing core errors, while the changed files format cleanly. |
| 2026-08-22 | Assessment rollout clarification | `docs/async-and-workers.md` now states that queued work on the former shared assessment identity may use the normal Hatchet retry/replay path during rolling replacement and that W2 does not migrate live assignments. | Implemented in rebased equivalent `d792e173b` (original local commit `c63ea2c57`); the scoped documentation hook passed. |
| 2026-08-22 | Local stack adoption | `gh stack init --base v3 rs/scaling-replica-ownership rs/hatchet-worker-runtime-contract` and `gh stack view --json` record `v3 ← rs/scaling-replica-ownership ← rs/hatchet-worker-runtime-contract`; W1 remains exact and untouched. | Adopted locally as approved. W1 is reported `needsRebase` relative to `v3` by stack metadata; no rebase or other stack mutation is authorized or performed. |
| 2026-08-23 | Freshness acceptance and PR publication | `git fetch origin` verified clean W1 at `3aa770f923` and clean W2 at `7d2c957d5`; the remote branch heads already match. The user accepted the content-preserving W2 rebase after W1's syncpack script-order normalization. Existing PRs [#5491](https://github.com/uzh-bf/klicker-uzh/pull/5491) and [#5492](https://github.com/uzh-bf/klicker-uzh/pull/5492) are open with the proposed dependency bases. | Complete. Update both whole-branch PR descriptions; do not merge or deploy. |
| 2026-08-23 | Opus full-stack review correction | Claude Opus reviewed the complete W1+W2 file set and found a shared health-port collision in multi-worker local containers, plus an unverified reduction from pinned SDK capacity. | Corrected locally by assigning mode-specific ports 8001/8002/8003, restoring explicit 100/1000 slot defaults, simplifying overlays to environment-only overrides, and documenting `/readyz` as observability rather than the SDK intake boundary. Re-run focused checks, then reflow W2 after W1 merges. |
| 2026-08-23 | Opus correction verification | The focused Hatchet and response-worker tests passed; all three worker type checks and builds passed; Helm lint and STG/PRD renders show 100/1000 slots and ports 8001/8002/8003; the replica-ownership gate, Prettier, and Biome passed. | Complete at the source and desired-render layers. DevPod re-entry was unavailable because `devrouter` could not access the OrbStack Docker socket; no dependencies were installed and no cluster or deployment state was changed. |
| 2026-08-23 | Fresh integrated verification | The exact W2 DevPod ran the focused tests, package checks, and builds; host Helm lint, base/STG/PRD renders, and the W1 replica-ownership gate passed. The runtime was stopped and verified. | Complete. Evidence is local/source-layer only; full root `check:all` remains limited by the pre-existing analytics pandas/compiler failure. |
| 2026-08-23 | Final integrated review | Exact-route `opencode-go/ox-alpha-free` review at maximum reasoning covered immutable range `3aa770f9230acfc27f67a3090e71c507b56a89ae..7d2c957d5e6bd43f2c24e22c49c91604389a6308`. It verified the current code, content-preserving rebase, local checks, Helm renders, workflow registration, and evidence boundaries. | Complete. No blocking findings. The stale historical review row was corrected; the health-server close-error observation is advisory and requires no change. P3/P4 limitations are accepted and recorded. |
| 2026-08-23 | Final-head re-review and publication | A second exact-route `opencode-go/ox-alpha-free` review covered the final plan-only head `7a7be86b39b877e23f4c328db838f6cc3149e71a`; it verified the rename/progress-only delta and retained the no-blocker verdict. The user-requested PR publication fast-forwarded W2 and updated the existing PR descriptions. | Complete. No force push, W1 mutation, merge, or deployment. |
| 2026-08-23 | Audit remediation | Worker Dockerfiles converted to exec-form CMD ["node", "..."]; fixed REDIS_PORT fallback in redis.ts; parameterized worker PDB minAvailable to 1 for single-replica staging environments. | Complete. Package tests, check, and Helm replica ownership gate pass. |
| 2026-08-29 | Audit remediation correction | W1 integrated current `origin/v3` and closed its promotion conditions. W2 propagated corrected W1 implementation head `518869dc2`, then replaced the incorrectly coupled assessment-backend PDB and implicit worker floors with explicit base, staging, and production worker-only budgets plus render assertions. | Local implementation complete. This row supersedes the 2026-08-23 PDB statement. |
| 2026-08-29 | Correction verification and review | The focused render gate, base/STG/PRD Helm lint, formatting, worker tests, three package checks/builds, and the full repository pre-commit gate passed. The native review roles failed before work because their configured `combo/glm-5.3-flash` route rejected maximum effort; generic-continuity `gpt-5.6-luna` simplification and chart-risk passes both returned `DONE`. | Complete. The host emitted only the known Node 26 versus pinned Node 24 warning. Final integrated stack review remains; remote push and exact-head CI are withheld. |
| 2026-08-29 | Final-review correction | The generic-continuity `gpt-5.6-sol` final review found that CI rendered the worker runtime contract without asserting it. The existing gate now checks all three worker names, 100/1000 slot capacities, ports 8001/8002/8003, `/healthz`, `/readyz`, the 90-second grace period, ConfigMap wiring, disruption budgets, and replica ownership in base, staging, and production. The focused gate, three Helm lint variants, Biome, and diff checks pass. | Correction review at exact implementation head `c8a02b5a2` returned `SOURCE READY` with no regression. Local source readiness is complete; remote push and exact-head CI remain withheld. |

## Next step and terminal condition

Complete focused source, package, formatting, Helm, and render-gate checks;
run the required correction reviews and one integrated W1/W2 stack review;
then report local source readiness separately from the stale remote PR heads.

**External approvals still withheld:** push, PR updates, merge, release,
deployment, Argo sync, cluster mutation, live Hatchet tasks, and pod deletion.
