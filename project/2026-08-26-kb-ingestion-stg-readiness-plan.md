# KB basic-ingestion STG readiness and activation

Parent roadmap:
[2026-07-24-kb-production-v1-roadmap-plan.md](2026-07-24-kb-production-v1-roadmap-plan.md),
package W8. The knowledge-graph release train remains parked in
[2026-08-10-kb-graph-production-roadmap.md](2026-08-10-kb-graph-production-roadmap.md).

Status: approved for source execution through reviewed draft PR/MR readiness.
Merge, secret access/write, deployment, cluster access, live canary, cleanup,
and production remain withheld.

## Plan identity

- Date: 2026-08-26.
- Execution owner: this main session as the package execution orchestrator.
- Delivery layer for this execution: reviewed, exact-head, green draft PRs/MRs
  with a recorded dependency order. Live STG delivery remains
  `delivery_pending`.
- Klicker planning worktree:
  `trees/rs/kb-roadmap-reconcile` on `rs/kb-ingestion-stg-readiness`.
- Reconciled source refs:
  - KlickerUZH `origin/v3-ai` at
    `a1c63c644fdcdc52ff3dcddbbd3f58fcf363261d`;
  - data-ingestion `origin/main` at
    `66e22bff67276e46a5d82b3545edfa6df7844500`;
  - deployment `origin/main` at
    `0e7e78488b839e09759fb80cdd56fca7a32bcb30`;
  - df-cloud `origin/stg` at
    `9f1586a10827b7909ef828ef3c35a557ec12a05b`.
- Proposed source branches:
  - Klicker readiness: `rs/kb-ingestion-stg-readiness` into `v3-ai`;
  - Klicker activation: `rs/kb-ingestion-stg-activation`, stacked on the
    readiness branch;
  - df-cloud: `rs/kb-ingestion-secret-projection` into `stg`;
  - deployment: `rs/kb-ingestion-producer-activation` into `main`.
- data-ingestion stays unchanged unless fresh contract verification finds a
  source defect. Any such defect changes package topology and pauses execution.

## Coordination ledger

- The AI Infra Portfolio coordinator has registered W8 as its own
  source-readiness workstream under this task and plan.
- Doc Query STG signer delivery merged into df-cloud `stg@9f1586a1`. Its
  `functions.ts` hunk adds four STG-only scope-signing settings to Chat. W8's
  backend-GraphQL and general-worker ingestion aliases are separate consumers
  and hunk-independent. Base the W8 branch on this merged ref and preserve the
  Doc Query tests and mappings unchanged.
- No portfolio task currently owns
  `ingestion/stg-generic/producer-registry/klicker.yaml` or its disabled-state
  validators. Notify the portfolio coordinator immediately before editing them
  so reservations can be refreshed.
- Doc Query remains authoritative for shared-reader, corpus-transfer, signer,
  tenant, and retrieval-cutover work. Ground-truth work treats W8's later active
  serving proof as an upstream dependency and does not own ingestion activation.
- The `v3-ai` synchronization task owns its own branch and worktree. Refresh and
  rebase W8 after any material target advance; never edit the synchronization
  task's checkout.
- The 2026-08-26 synchronization advanced `v3-ai` from `40452c32d` to
  `d110469d` by merging `v3@bad33cae`, then to `a1c63c644` with an unrelated
  STG GraphQL memory-limit correction. The W8 worktree is rebased. Changes in
  watched files are unrelated course-duplication concurrency, STG rollout
  annotations, and GraphQL resources; the ingestion configuration, workflow
  registration, and gate gaps in this plan remain unchanged.

## Goal and non-goals

Prepare the smallest mergeable source package that can safely enable basic
knowledge-base resource ingestion in STG. The package must configure exact
cluster-local endpoints, project the three existing credential identities only
to their intended Klicker workloads, enable only the Klicker ingestion
producer, and retain a separate last-mile Klicker activation layer. Readiness
also needs a worker-side operational gate because the existing backend gate
does not stop worker startup validation or workflow registration.

This package does not deliver knowledge-graph generation, chatbot retrieval,
FalkorDB or GraphML, a graph-worker image, production traffic, or real lecturer
content. It does not create a new ingestion service, secret store, product
primitive, public endpoint, or per-KB provider registry.

## Approved contract carried into planning

- Basic KB management and resource ingestion are the release priority. Graph
  generation stays parked and continues in its GitLab source when reprioritized.
- The trusted Klicker backend is authorized at the ingestion project boundary.
  `kb_id` filters that project; Klicker derives it from owner-authorized
  persisted state and never accepts an arbitrary browser-supplied scope.
- The lecturer surface remains gated by `ai-beta` plus
  `User.aiFeaturesEnabled`. `KB_INGESTION_DISABLED` is the independent runtime
  kill switch.
- Source readiness, merge, desired-state reconciliation, secret readiness,
  runtime health, synthetic canary, and production are separate evidence
  layers.

## Current evidence and gap

### KlickerUZH

- The merged KB model, API, desktop UI, AI-beta entitlement, resource upload,
  ingestion ledger, callbacks, and deletion lifecycle are already on `v3-ai`.
- STG tracks `v3-ai` directly with automatic reconciliation. Merging a Klicker
  configuration change can therefore change STG desired state.
- The STG values currently omit the ingestion API and source-gateway URLs.
  Chart defaults render empty strings.
- `KB_INGESTION_DISABLED` is not explicitly true in STG values. The readiness
  layer must close it before any provider activation can be considered safe.
- The general worker validates partial ingestion configuration during startup
  and registers ingestion cron/effect workflows independently of the backend
  gate. Either cross-repository configuration order can therefore break the
  worker without a separate worker gate.
- Graph activation remains independent. STG must explicitly render it closed
  in both backend and worker behavior throughout W8.

### data-ingestion

- `main@66e22bff67276e46a5d82b3545edfa6df7844500` already implements the
  approved producer/project boundary.
  API authorization checks producer and allowed project; `kb_id` is a filter.
- No provider source change is expected for W8.

### deployment

- The STG producer registry already defines the Klicker producer, exact project
  set, URL and blob source kinds, backend-only source gateway, signed callback,
  50 MiB external maximum, and PDF/plain-text MIME policy.
- The producer is deliberately disabled. Both structural validation and CI
  require that disabled state today.
- The resource API service identity is
  `http://ingestion-resource-api.stg-ingestion.svc.cluster.local:8000`.
- The allowed source-gateway origin is
  `http://klicker-backend.stg-klicker.svc.cluster.local:3000`.
- STG tracks deployment `main` with automatic reconciliation. Merging the
  producer change is therefore a deployment action, not just source delivery.

### df-cloud

- Existing ExternalSecrets create the ingestion-side producer credential,
  Klicker source-gateway client credential, and Klicker webhook credential.
- The paired Klicker secret-store keys already have declared identities, but
  current source does not project them into the target workload Secrets.
- Existing shared secret-name arrays cross workload boundaries. Appending KB
  secrets there would leak source-gateway and webhook credentials to the
  assessment backend, or the producer credential to response processors.
  W8 must use workload-specific derivatives instead.

## Product, architecture, and data rulings

- **Product primitive:** no new primitive. W8 activates the existing KB,
  resource, ingestion operation, and serving-version lifecycle.
- **ADR gate:** no new ADR. The plan applies existing project-level producer
  trust and workload least-privilege boundaries. Re-arm the ADR gate if work
  introduces public ingestion ingress, end-user credentials, a provider-side
  per-KB registry, a new custody owner, or a different activation default.
- **Personal data:** source verification uses only configuration identities and
  synthetic fixtures. The later live canary may use only synthetic lecturer and
  resource content.
- **Least surprise:** readiness merges must leave dispatch disabled. The final
  activation is an isolated, reviewable two-gate policy change. Graph remains
  disabled.

## Source topology and dependency order

The package uses two Klicker layers and two standalone GitLab MRs. It is not a
single cross-provider stack.

1. **Klicker readiness PR** — safe foundation into `v3-ai`.
   - Carry this plan and the two W8/graph roadmap reconciliations.
   - Add `KB_INGESTION_WORKER_DISABLED` as a dedicated operational gate. When
     true, the general worker must tolerate absent or partial ingestion config,
     register no ingestion dispatch, deletion, or polling workflows, suppress
     ingestion retry effects in shared maintenance, and continue all unrelated
     workflows. Shared maintenance remains registered only when graph recovery
     still needs it; both gates closed omit it entirely.
   - Set the exact non-secret ingestion API and source-gateway URLs in STG.
   - Set `backendGraphql.kbIngestionDisabled: true` explicitly.
   - Set the new worker gate true and `KB_GRAPH_DISABLED=true` explicitly for
     both backend and worker behavior.
   - Update the affected engineering wiki and add the narrowest useful Helm
     render and worker-selection assertions.
   - This layer must be safe to merge and reconcile by itself.
2. **df-cloud secret-projection MR** — least-privilege preparation into `stg`.
   - Map `INGESTION_GATEWAY_KEY` to `KB_SOURCE_GATEWAY_KEY` only for the GraphQL
     backend ExternalSecret.
   - Map `KB_INGESTION_WEBHOOK_SECRET` to `KB_WEBHOOK_SECRET` only for the
     GraphQL backend ExternalSecret.
   - Map `INGESTION_API_KEY` to `KB_INGESTION_API_KEY` only for the general
     Hatchet worker ExternalSecret.
   - Prove the assessment backend and response processors do not receive them.
3. **deployment producer-activation MR** — provider policy change into `main`.
   - Change only the Klicker producer to enabled.
   - Update both fail-closed validators to require that exact state while
     preserving every project, source, origin, callback, MIME, size, and
     secret-reference policy.
   - Keep the MR draft until readiness is deployed and values-free secret and
     runtime checks pass.
4. **Klicker activation PR** — last-mile layer stacked on readiness.
   - Change only the backend and worker ingestion gates from true to false,
     plus the required plan progress update.
   - Keep `KB_GRAPH_DISABLED=true` unchanged.
   - Keep the PR draft. Its merge is a STG activation action because `v3-ai`
     auto-reconciles.

The required live order is Klicker readiness merge and reconciliation with both
ingestion gates closed, secret projection merge and reconciliation, values-free
Secret and worker readiness proof, producer activation merge and
reconciliation, then the Klicker activation merge during the separately
authorized canary window. No source-ready verdict performs that sequence.

## Plan artifacts and commits

This file is the cross-repository execution ledger and ships with the first
Klicker implementation PR. Each other implementation branch receives its own
short repo-local plan as its first commit, derived from this approved topology,
and references this ledger. No plan travels in a plan-only PR or MR.

Proposed commits and PR/MR titles use the smallest accurate conventional type:

- `docs(project): add KB ingestion STG readiness plan`;
- `fix(hatchet): gate KB ingestion worker workflows`;
- `fix(deploy): close and configure KB ingestion in staging`;
- `fix(secrets): scope KB ingestion credentials to workloads`;
- `fix(ingestion): enable the Klicker staging producer`;
- `feat(kb): activate staging ingestion`.

The existing roadmap edits remain task-owned and join the Klicker readiness
branch. They are not published separately.

## Delegation map

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Plan, topology, and cross-repository integration | main | current exact refs | one reviewed dependency graph and no hidden delivery action |
| Klicker worker rollout guard | main | approved plan | disabled/partial/enabled modes and unrelated workflows preserved |
| Klicker values, docs, and render proof | executor or main | worker guard | exact endpoints, explicit closed gates, focused checks |
| df-cloud workload-specific secret projection | main | approved plan | positive mappings and negative non-leakage tests |
| deployment producer policy | main | approved plan | only Klicker enabled; every other policy byte-equivalent |
| Klicker activation layer | main | readiness layer | isolated kill-switch flip, draft and blocked from merge |
| Integrated source final review | final reviewer | all exact heads verified | no correctness, security, data, or ordering blocker |

Secret projection and activation stay with the main session because they cross
credential and automatic-deployment boundaries. Delegation is optional for the
bounded Klicker readiness edit only when dispatch costs less than the work.

## Feature-wide test portfolio

| Risk or behavior | Test obligation | Primary seam | Distinct failure |
| --- | --- | --- | --- |
| STG renders an empty or wrong endpoint | extend source checks | Helm render with STG values | backend or worker calls no service or the wrong namespace |
| Partial configuration crashes the general worker | add focused tests | worker startup validation and selection | cross-repository delivery order takes unrelated workflows down |
| Disabled ingestion still reaches the provider | add focused tests | workflow selection and shared maintenance | readiness schedules dispatch, polling, deletion, or retry effects |
| Enabled worker accepts partial configuration | extend focused tests | worker startup validation | activation starts an unusable ingestion runtime |
| Readiness accidentally dispatches | add exact assertion | rendered GraphQL and worker ConfigMaps | merge activates provider calls before dependencies are ready |
| Graph work activates with basic ingestion | add exact assertion | rendered backend/worker graph gate | W8 starts a parked graph lifecycle |
| A KB credential reaches another workload | add focused test | df-cloud ExternalSecret generation | assessment or response processor gains unrelated authority |
| One required credential mapping is absent | add focused test | GraphQL/general-worker target Secrets | runtime starts without the credential contract it consumes |
| Producer activation weakens policy | extend both validators | registry source and rendered policy | project, source, callback, MIME, size, or origin broadens |
| Another producer changes | add invariant | rendered registry comparison | W8 changes unrelated tenant state |
| Activation is inseparable from readiness | topology check | native Klicker stack diff | safe preparation cannot land without opening dispatch |
| Exact heads drift before delivery | repeat source readback | forge head and target refs | review evidence applies to different content |
| Live operation violates two-axis serving | later manual canary | synthetic URL/upload replacement | failure removes the previous active version |
| Cleanup leaves synthetic state | later manual canary | delete/tombstone lifecycle | synthetic content remains active or retrievable |

No frontend behavior changes in the source-readiness package, so source CI does
not require new browser screenshots. The separately authorized live canary must
capture the existing Manage journey on desktop in English and German. Mobile
evidence is explicitly out of scope for the Manage app.

## Slices

### S0 — Commit the approved plan and establish worktrees

- Recheck all four remote refs and dirty-state ledgers.
- Reconfirm the merged Doc Query hunk remains unchanged and refresh the
  deployment path reservation with the portfolio coordinator.
- Commit this plan separately on the Klicker readiness branch.
- Create or reuse repo-local worktrees for the three source packages.
- Add the short repo-local plan to each GitLab implementation branch before its
  code/config change.
- Check: primary checkouts remain untouched; every branch has one implementing
  plan; no branch or remote is overwritten.

### S1 — Add the worker rollout guard

- Add the dedicated worker-side ingestion gate at the general-worker startup
  and workflow-selection seam.
- Keep unrelated workflows registered when ingestion is disabled. Keep enabled
  mode fail-closed on partial ingestion configuration.
- Make graph workflow selection respect the existing graph gate. Keep shared
  resource maintenance when either capability needs it, and independently gate
  ingestion retries and graph re-enqueue inside that task.
- Add focused tests for disabled, enabled, and partial configuration and exact
  workflow selection; update environment declarations and worker documentation.
- Run the Hatchet and worker-focused tests, both package checks, and root
  `check:all` in the managed development environment.
- Run the simplifier and the cross-system slice reviewer on the exact committed
  range; verify and disposition every finding.

### S2 — Make Klicker STG readiness safe

- Implement exact non-secret endpoints and the explicit closed ingestion kill
  switches in STG values. Render the graph gate explicitly closed.
- Add or extend the narrow Helm render proof and update the relevant wiki page.
- Run chart lint, exact STG render assertions, repository-native focused static
  checks, diff scope review, and staged secret/personal-data review.
- Commit the roadmap reconciliation separately from the values/config change
  when that improves reviewability.
- Run the substantive-slice simplifier and the cross-system slice reviewer on
  the exact committed range; verify and disposition every finding.

### S3 — Project credentials only to intended workloads

- Build narrow derivatives of the existing shared secret-name lists.
- Add focused positive tests for all three aliases and negative tests for the
  assessment backend and response processors.
- Run df-cloud repository-native tests and a preview-only pipeline. Do not
  apply Pulumi or read secret values.
- Run the simplifier and security/data-boundary slice reviewer on the exact
  committed range.

### S4 — Prepare the producer activation

- Flip only the Klicker producer's enabled state and update the two validators.
- Render the complete STG ingestion manifests and run structural, producer
  registry, and relevant monitoring validators.
- Compare rendered policy fields and unrelated producers against the base.
- Run the simplifier and cross-system/data-integrity slice reviewer on the
  exact committed range.

### S5 — Prepare the isolated Klicker activation layer

- Create the native upper stack layer and flip only the backend and worker
  ingestion gates. Keep the graph gate true.
- Update this plan's progress without duplicating readiness changes.
- Verify the layer diff, Helm render, stack metadata, and merge base.
- Keep it draft and explicitly blocked from merge.

### S6 — Integrate, review, publish drafts, and read back exact heads

- Run the package's fresh focused checks on every exact branch head.
- Run one integrated final reviewer across all source diffs and the delivery
  order. Apply verified corrections and repeat affected checks once.
- Push normal branch updates without force, create or update draft PRs/MRs,
  write whole-branch descriptions, and read back exact heads and CI.
- Finish when readiness sources are merge-safe, activation drafts are
  source-green but explicitly merge-blocked, and no open review finding blocks
  the later delivery decision.

### D1 — Deliver readiness and prove runtime prerequisites

This is outside the source execution authority. It requires explicit approval
for each merge and for values-free secret, GitOps, and runtime inspection. It
must prove exact deployed revisions, successful ExternalSecret conditions,
healthy workloads, and the still-closed Klicker kill switch before any producer
or activation merge. Both backend and worker ingestion gates must remain
closed.

### D2 — Run the synthetic STG canary and close the window

This is outside the source execution authority. It requires explicit approval
for cluster access, live mutation, and cleanup. Use one public synthetic URL and
one synthetic text/PDF upload; prove correlated operation and serving versions,
controlled replacement failure, retry, deletion, callback handling, and zero
remaining synthetic active resources. Roll back by closing the backend gate
first, drain or reconcile all active work while the worker and credentials
remain available, then close the worker gate. Disable the producer only after
there is no queued or active Klicker work.

## Execution contract

One approval of this plan authorizes the execution orchestrator to:

- create/reuse the named worktrees and branches;
- make the scoped source, documentation, plan, and test changes;
- run repository-native local checks and configured independent reviews;
- create local conventional commits;
- push normal updates to the four named feature branches;
- create/update draft PRs/MRs, run preview-only CI, and perform forge readback.

It does not authorize merge, un-drafting, approval, force-push, secret access or
write, Pulumi apply, Argo sync, cluster connectivity, deployment, live canary,
cleanup, production, or any graph-related action.

## Pause conditions

Pause and return to the user if:

- a required secret key identity or workload owner differs from this plan;
- provider behavior differs from the project-level contract on the pinned ref;
- an independently safe readiness layer cannot contain automatic STG effects;
- implementation requires public ingress, a new credential owner, a schema or
  migration, or any data-ingestion source change;
- a required source check or reviewer is terminally unavailable;
- a branch has overlapping user-owned changes that cannot be preserved;
- fresh df-cloud changes make the planned consumer-specific aliases overlap a
  currently owned hunk;
- progress reaches merge, secret, deployment, cluster, live, or cleanup
  authority.

## Terminal condition

The source package is complete when all four implementation branches are
published as draft PRs/MRs at exact reviewed heads, their required CI and local
checks pass, the two Klicker layers form a valid stack, the GitLab MRs have no
source-level merge conflict, and all feedback is dispositioned. The readiness
layers must be safe to merge. The producer and Klicker activation drafts remain
intentionally merge-blocked by live prerequisites and must not be described as
independently safe to merge. Report STG as `delivery_pending`, not deployed or
live-proven.

## Planning-stage review

The required planner returned `DONE_WITH_CONCERNS`. The material concern is
accepted: the backend-only gate cannot safely sequence partial worker
configuration, so S1 adds a dedicated worker gate and S2 renders both ingestion
gates closed. The recommendation to keep graph explicitly disabled is accepted.
The activation terminal is corrected to distinguish source-green drafts from
merge-safe readiness layers. The proposed producer-first rollback is rejected:
closing authentication and callbacks before active work drains can strand
operations, so D2 closes the backend gate, drains with the worker available,
then closes the worker gate and finally the producer. The planner's roadmap
ownership concern is resolved by the existing task ledger: both modified
roadmaps are task-owned in this worktree and ship with the readiness PR.

## Progress

- 2026-08-26: Reconciled current refs and existing roadmap edits. Confirmed
  data-ingestion needs no planned source change, deployment already owns the
  disabled producer policy, df-cloud owns existing ExternalSecret identities,
  and Klicker STG still needs exact endpoints plus an explicit closed kill
  switch.
- 2026-08-26: Drafted this cross-repository source-readiness plan. Planner
  returned `DONE_WITH_CONCERNS`; the verified worker-gate, graph-closure, and
  activation-safety findings are incorporated above. At that checkpoint,
  senior human approval remained pending and no implementation or external
  delivery action had started.
- 2026-08-26: Coordinated with the AI Infra Portfolio, AI Doc Query,
  ground-truth, and `v3-ai` synchronization tasks. Rebased onto
  `v3-ai@d110469d1510bbe683f384824baa6f86502d75e1` and verified the incoming
  watched-path changes do not close or alter the W8 worker/configuration gaps.
  Refreshed df-cloud after the Doc Query signer-delivery merge and verified its
  Chat-only hunk is independent from W8's backend/worker aliases. Deployment
  and data-ingestion refs remain unchanged.
- 2026-08-26: Source execution approved through local implementation, commits,
  normal pushes, draft PR/MR publication, reviews, preview CI, and exact-head
  readback. The portfolio coordinator cleared the shared df-cloud path on
  `stg@9f1586a1` under the consumer-specific alias contract. S0 is active.
- 2026-08-26: Established the three source worktrees and committed their plan
  ledgers. Rebased the Klicker readiness branch onto
  `v3-ai@a1c63c644fdcdc52ff3dcddbbd3f58fcf363261d` after the latest target
  advance; the incoming change only raises the STG GraphQL memory limit. No
  deployment producer or validator source has been edited.
- 2026-08-26: Implemented the df-cloud STG-only workload aliases at
  `2622292c`. The Azure-helper build, focused three-case credential test,
  existing five-case Doc Query test, TypeScript check, and scoped formatting
  check passed with the pinned Node 20 and pnpm 9 toolchain. The simplifier
  found no issue. The security/data-boundary reviewer confirmed the projection
  contract and found one missing MR CI invocation; `c93c1fa6` adds that exact
  test to `unit-tests-app-config`, and the focused test passed again.
- 2026-08-26: Started S1 in the managed Klicker runtime using the supported
  `KB_GRAPH_BLOB_HOST_PORT=10005` override because ports 10003 and 10004 were
  already allocated. The seven focused worker-selection tests and both the
  general-worker and Hatchet package TypeScript checks pass. The Hatchet
  package's 102 tests also pass, including a new fail-fast assertion for the
  required source-gateway URL. Root `check:all` reached the W8 checks but ended
  on an unrelated analytics environment failure: uv selected Python 3.14,
  pandas 2.2.2 had no wheel, and the container has no C compiler. S1 remains
  active pending its exact commit and reviewers.
- 2026-08-26: Verified and corrected the S1 review findings. An absent legacy
  ingestion configuration now auto-disables its workflows, while an explicitly
  open gate requires all three settings. Shared maintenance remains available
  for graph crash-window recovery but performs no ingestion retry queries or
  provider calls while ingestion is disabled; both capability gates closed omit
  the task. The environment example and worker wiki now describe the safe
  default. The general-worker suite passes 10 tests, the Hatchet suite passes
  104 tests, both package TypeScript checks pass, and scoped Biome/Prettier
  checks pass with only the two pre-existing advisory diagnostics. The complete
  W8 diff has no changes under `apps/analytics`, `uv.lock`, or `pyproject.toml`,
  which isolates the earlier root-check failure to the base container's Python
  3.14/pandas 2.2.2 toolchain mismatch. S1 remains active pending a correction
  commit and exact-range re-review.
- 2026-08-26: Implemented S2's closed STG readiness values with the exact
  ingestion API and source-gateway service identities, explicit backend and
  worker ingestion gates, and explicit backend and worker graph gates. The
  focused render assertion verifies every expected ConfigMap value, rejects
  worker-only keys on both response processors, and rejects ingestion secret
  keys from all rendered ConfigMaps. The main check workflow installs pinned
  Helm 3.21.4 before running it. Host Helm rendering and chart lint pass; scoped
  container Biome and Prettier checks pass. The incoming STG GraphQL resource
  contract remains 50m/50Mi requests, a 1Gi memory limit, and no CPU limit.
  The managed devcontainer does not include Helm, so the Helm-only assertions
  ran with the configured host binary while Node/package checks stayed in the
  container. S2 remains active pending its commit and exact-range reviews.
- 2026-08-26: The S1 correction re-review confirmed the capability gates,
  fail-closed startup behavior, graph recovery, test coverage, and analytics
  isolation. Its one documentation finding is corrected by specifying that
  only the three required connection settings auto-arm a legacy environment;
  the optional project setting does not. The simplifier suggested wrapping both
  complete retry sections in one condition. That change is not adopted because
  it would reindent roughly 250 stable lines for no behavior or maintenance
  gain; the two explicit guarded queries keep the patch local, and the focused
  test proves that only independent cleanup and graph recovery remain active.
  S1 is complete at the reviewed source layer.
- 2026-08-26: The exact S2 range `c91e8e3fb..32b7b0902` passed both
  simplification and cross-system review with no findings. The reviewers
  confirmed the exact STG endpoints, closed worker and backend gates,
  response-processor isolation, ConfigMap secret exclusion, deterministic Helm
  setup, preservation of the upstream GraphQL memory resources, and matching
  documentation. S2 is complete at the reviewed source layer.
- 2026-08-26: Created upper stack branch `rs/kb-ingestion-stg-activation` from
  readiness head `bd8e320f9`. The layer opens only the worker and backend basic
  ingestion gates and updates their exact render expectations. Both graph gates
  remain closed. This source layer stays draft and merge-blocked until the
  readiness, secret-projection, and producer prerequisites are delivered and
  proven; no live action occurred.
- 2026-08-26: The activation Helm proof passed. The chart represents an open
  ingestion gate by omitting `KB_INGESTION_DISABLED` and
  `KB_INGESTION_WORKER_DISABLED`, so the upper-layer check requires those keys
  to be absent rather than rendered as `"false"`. It still requires both graph
  gates as `"true"`, exact endpoints, response-processor isolation, and no
  secret keys in ConfigMaps. Chart lint, scoped Biome, Prettier, and diff checks
  passed.
- 2026-08-26: The exact current S5 range `920c28b31..ab85641c6` passed
  simplification and deployment/data-integrity review with no findings. The
  reviewers confirmed the two ingestion-only value changes, omitted open
  kill-switch keys, explicit closed graph gates, unchanged endpoints and
  isolation, direct stack ancestry, and draft/merge-blocked delivery boundary.
  A range-diff against the pre-restack slice is one-to-one, with no lost or
  broadened content. This supersedes the earlier pre-restack receipts ending at
  `59caba946` and `49159597b`. S5 is complete at the reviewed source layer.
