# W1 — Replica ownership and chart safety

## Plan identity

- Plan: `project/2026-08-22-pr-5491-scaling-replica-ownership-plan.md` (this file)
- Branch: `rs/scaling-replica-ownership`
- Target: `v3`; [PR #5491](https://github.com/uzh-bf/klicker-uzh/pull/5491)
- Integrated base: `origin/v3` at `f0659e1301254320b2f67a0a4be752ebf6a41c0f`
- History:
  - [Execution roadmap](../../klicker-scaling-investigation/project/2026-08-22-klicker-scaling-execution-roadmap.md)
  - [Investigation findings](../../klicker-scaling-investigation/project/2026-08-22-klicker-scaling-investigation-findings.md)
  - [Investigation plan](../../klicker-scaling-investigation/project/2026-08-22-klicker-scaling-investigation-plan.md)
- Status: the original package was reviewed, and the user approved upstream
  integration plus audit remediation on 2026-08-29. The correction review is
  complete, W1 is propagated into W2, and final stack review is pending.

## Goal

Klicker chart rendering must give every Deployment exactly one replica owner. A
static Deployment gets `spec.replicas` from Git values. An autoscaled Deployment
omits that field and has exactly one rendered scaler target. The chart must also
emit the valid `autoscaling/v2` HPA resource-target shape.

W1 will:

- make LTI explicitly static in the base chart values and both environment
  overlays, preserving STG `replicaCount: 1` and PRD `replicaCount: 2`;
- repair the three existing HPA template paths for PWA, Manage, and GraphQL;
- add a small Helm-render assertion command that catches ownerless, dual-owned,
  duplicate-target, and legacy-HPA output;
- document the replica-owner rule, the static LTI decision, and the distinction
  between Argo health and sync status in `docs/ci-and-deployment.md`;
- retain current OLAT/LTI and Argo drift as values-free evidence, without
  repairing unrelated live or legacy Hatchet state.

## Non-goals

- No application-code, LTI protocol, OLAT integration, API, database, or user
  workflow change.
- No KEDA/ScaledObject rollout, new autoscaler, Argo Application change, Argo
  ignore-rule change, Pulumi change, or df-cloud change.
- No repair of the legacy Hatchet application or its Secrets, Deployments,
  StatefulSet, or generated hook Jobs.
- No Secret data, response bodies, diff bodies, credentials, or raw task data.
- No push, MR/PR creation, merge, release, deploy, Argo sync, live load, or
  cluster mutation.

## Execution contract

- **Execution owner:** the current peer task, GPT-5.6 Luna at max effort, owns
  integration, verification, review dispatch, `Progress`, and local commits
  after approval.
- **One-time approval:** approved by the user on 2026-08-22 before any source,
  test, documentation, or package-script implementation begins.
- **Granted after approval:** the named local edits, the repository-native
  checks, the bounded values-free Argo resource-status refresh through the
  existing STG/PRD tunnels, the required review passes, and local commits on
  this branch.
- **Withheld:** every external delivery or cluster action listed under
  Non-goals. The existing tunnels may be used only for values-free read-only
  status queries; connectivity will not be established by this package.
- **Boundary owner:** `rs-roadmap-orchestrator`. This package can later return a
  `BOUNDARY_CANDIDATE` at the reviewed/pr-ready boundary; it does not reconcile
  the parent roadmap in this first turn.
- **Current terminal:** a locally verified and reviewed W1 branch at the `pr_ready` evidence layer; external delivery and cluster actions remain withheld.
- **Future package terminal:** a locally verified, reviewed W1 branch at the
  `pr_ready` evidence layer, with delivery actions still withheld.
- **Pause conditions:** the bounded refresh cannot use the existing tunnels; it
  reveals an unresolved owner or denominator change; the approved change would
  add a new policy or cross-repository dependency; or a required provider or
  review capability reaches a terminal unavailable state.

## Freshness, worktree, and authority evidence

- `git fetch origin v3` could not write `.git/FETCH_HEAD` because of the local
  Git metadata permission boundary. Forge readback through `gh api` returned
  `f58986faa8cfa4ff78d20a1ebeb1666473343d38`, matching local `refs/remotes/origin/v3`.
  The tracking metadata is therefore treated as verified for this base commit,
  not as freshly fetched metadata.
- The primary checkout is on `docs/chatbot-hitl-config-roadmap`, is behind
  `origin/v3` by 13 commits and ahead by one, and has unrelated tracked and
  untracked work. It was not mutated.
- The existing investigation worktree is clean at the same base commit with
  only its three untracked investigation artifacts. It remains untouched.
- The implementation worktree is
  `trees/rs-scaling-replica-ownership`,
  on `rs/scaling-replica-ownership`, with the approved W1 commit range.
  `trees/` is ignored by the repository.

## Research

| Question | Evidence and answer | Limitation / applicability |
|---|---|---|
| Which source paths decide replica ownership? | `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` conditionally emits `spec.replicas`; `templates/hpa-app.yaml` is the only current HPA source; in the `origin/v3` baseline, STG and PRD LTI values omitted their autoscaling override. | The chart has no LTI HPA or KEDA target. W1 does not invent one. |
| What did the pre-change chart render? | `helm lint` passed. Base, STG, and PRD baseline renders each contained 15 Deployments; LTI was the sole ownerless Deployment because autoscaling defaulted true while no scaler targeted it. A synthetic PWA render exposed the legacy HPA target fields. | Baseline output is source/render evidence, not proof of what Argo has deployed. |
| What is live and what remains drift? | The bounded values-free refresh below records app/resource statuses and LTI/OLAT replica status for both environments. | Resource status does not expose diff bodies or Secret data, and it can change after the timestamp. |
| What is the smallest assertion seam? | A Node `.mjs` package script using the existing `yaml` dependency and child-process Helm renders. It can assert parsed Deployment/HPA ownership without a new dependency or cluster access. | No local Kubernetes schema validator is installed. The script checks the relevant `autoscaling/v2` shape; an already-installed non-mutating validator is optional. |
| Does CI run the Helm gate? | W1 provisions Helm with `azure/setup-helm@v4` in the shared codebase workflow and invokes `check:klicker-replica-ownership`. The integration preserves the current workflow's read-only permissions and engineering-wiki check. | This is source and CI-workflow evidence; exact-head CI remains pending until the branch is pushed. |

### Pre-change baseline and resulting source/render state

- Static workloads render `spec.replicas` when their `autoscaling.enabled` value
  is false. In the `origin/v3` baseline, the base LTI value enabled autoscaling
  and both environment overlays inherited that setting while setting only
  their replica counts. No LTI scaler template exists. W1 now makes LTI static
  in all three values layers.
- In the `origin/v3` baseline, the HPA template declared `apiVersion: autoscaling/v2`
  but emitted the old `resource.targetAverageUtilization` fields. W1 now emits
  the valid nested `resource.target` shape with `type: Utilization` and
  `averageUtilization`.
- The chart directory is named `klicker-uzh-v3`, while its chart and rendered
  resource names retain the existing `v2` naming. W1 preserves that established
  naming.

### Bounded live status refresh

The refresh ran at `2026-08-22T15:58:07Z` through the existing `aks-stg-apps`
and `aks-prd-apps` contexts. It used only type/name/status custom columns and
resource-status fields; it did not read Secret data or diff bodies.

- Main `app-klicker` is `Healthy`/`OutOfSync` in both environments. The live
  revision is the base commit above.
- In STG, all 15 main-app Deployment resources are OutOfSync while the other
  chart resource categories observed in the refresh are Synced. The current
  LTI Deployment has live `spec.replicas: 0` and no ready/available replicas;
  the source overlay says `replicaCount: 1` but the current chart omits the
  field because inherited autoscaling is enabled. OLAT is currently
  `spec.replicas: 1` with one ready and one available replica. The earlier
  investigation snapshot recorded a different OLAT count; this timestamped
  refresh supersedes that historical observation for W1 planning.
- In PRD, only `backend-assessment` and `frontend-assessment` main-app
  Deployments are OutOfSync. LTI is currently `2/2` and OLAT is `1/1`, while
  the source chart still has no LTI scaler owner and will be made explicitly
  static with `replicaCount: 2`.
- The `stg-klicker` and `prd-klicker` namespaces contain no HPA, ScaledObject,
  or ScaledJob resources in the scoped refresh. Other cluster namespaces do
  contain autoscalers; those are outside W1.
- Legacy `app-klicker-uzh-hatchet` is `Degraded`/`OutOfSync` in both
  environments. The remaining drift categories are two Secret resources, six
  Deployments, the RabbitMQ StatefulSet, and generated hook Jobs. This is a
  separate owner and follow-up; W1 records it without claiming a repair.

The live observations explain the OLAT/LTI mismatch but do not authorize a
repair. Source/render ownership, Argo desired state, deployed revision, and
live runtime state remain separate proof layers.

## Unclarities, assumptions, and decisions

- **Assumption:** LTI is intentionally static for this package because no LTI
  scaler exists in the chart or the scoped namespaces. Its static owner is the
  rendered `replicaCount`; LTI declares no unused autoscaling stanza.
- **Decision:** The assertion command is a focused package gate and a CI check.
  The shared workflow provisions Helm before invoking it.
- **Decision:** The assertion keys owners by namespace plus Deployment name. A
  Helm render uses an explicit namespace or a deterministic rendered-default
  fallback so the check cannot merge same-named targets across environments.
- **Decision:** The docs describe the future exact-target Argo replica-ignore
  boundary as an existing ownership requirement, but W1 adds no Argo ignore
  rule. Static LTI receives no replica ignore.
- **Decision:** No product primitive is affected, so no product-design or
  grilling pass is required.

## Primitive impact

| Primitive / contract | Disposition | Consumers and evidence | Open ruling |
|---|---|---|---|
| User-facing product primitive or public API | None affected | The change is Helm values, templates, a render assertion, and operational documentation. | None. |
| Internal Deployment replica ownership contract | Reuse and make explicit | Existing chart conditional and reviewed roadmap already define static versus scaler ownership; W1 closes the LTI gap and validates it. | Future autoscaler cohorts must name their exact scaler and Argo owner before adoption. |

## ADR gate

No new ADR is required. W1 makes a reversible, repository-local correction to an
already reviewed deployment ownership rule and does not change an application
contract, Argo sync policy, or cross-repository ownership. The existing
deployment documentation is the durable operational explanation.

The ADR gate reopens if implementation adds an Argo ignore rule, changes
manual-versus-automatic sync behavior, introduces an LTI autoscaler, changes
the ownership model across df-cloud, or creates a new hard-to-reverse public or
data contract.

## Skill routing

- `$rs-sliced-development-workflow`: full path because the package changes
  infrastructure-as-code ownership, chart output, and deployment safety.
- `$rs-model-routing`: all native child dispatches must pass the roadmap's
  explicit `opencode-go/ox-alpha-free` provider at max effort. If a required
  role cannot honor that override, stop and report the capability boundary;
  never silently substitute another provider.
- `klicker-wiki-maintenance`: required for the deployment wiki timestamp and
  source-of-truth documentation. The affected durable page is
  `docs/ci-and-deployment.md`.
  The repository search found no existing skill that covers replica ownership,
  so W1 does not create or edit a speculative skill.
- No browser, DevPod, devrouter, frontend, or live-runtime workflow is needed.

## Planning-stage specialist

The required read-only planning review is persisted at
[`project/_local/reviews/2026-08-22-scaling-replica-ownership-planning.md`](./_local/reviews/2026-08-22-scaling-replica-ownership-planning.md).

- Child: `01a02a05-471c-70d1-b1e9-4e62419ef067`
- Provider/model: `opencode-go/ox-alpha-free`, max effort
- Terminal: `DONE_WITH_CONCERNS`
- Accepted corrections:
  - set LTI autoscaling false in base values as well as both overlays;
  - validate base, STG, and PRD renders;
  - enable all three HPA resources in one synthetic render and validate every
    CPU and memory metric;
  - add the Delegation Map and explicit main-route skip reasons;
  - keep the focused chart command outside current `check:all`/CI and explain
    that boundary;
  - timestamp the wiki page, record source locators, and keep volatile live
    inventory out of durable operational claims;
  - document future exact-target Argo ignore requirements without changing
    Argo state, and stop before editing if the bounded refresh loses its
    authority or reveals an unresolved ownership denominator.

## Progress

- Status: W1 audit remediation and its correction review are complete locally;
  final stack review remains.
- Completed: freshness fallback and base verification; primary/worktree audit;
  requested implementation worktree creation; roadmap, findings, parent plan,
  AGENTS.md, deployment wiki, relevant chart templates, and workflow inspection;
  Helm lint and base/STG/PRD baseline renders; bounded STG/PRD resource-status
  refresh; planning-stage review; the approved bounded preflight confirmation at
  `2026-08-22T15:58:07Z`.
- Remaining: the integrated final stack review. Push and every cluster action
  remain withheld.
- Verified base: `f58986faa8cfa4ff78d20a1ebeb1666473343d38`; implementation worktree
  has the approved plan, S1, S2, and S3 commits plus this verification metadata.
- Planning review: `project/_local/reviews/2026-08-22-scaling-replica-ownership-planning.md`.
- S1 simplifier: `project/_local/reviews/2026-08-22-scaling-replica-ownership-s1-simplifier.md` — `DONE`, no findings.
- S1 slice review: `project/_local/reviews/2026-08-22-scaling-replica-ownership-s1-slice-review.md` — `DONE`, no findings.
- S2 simplifier: `project/_local/reviews/2026-08-22-scaling-replica-ownership-s2-simplifier.md` — `DONE`, no findings.
- S2 slice review: `project/_local/reviews/2026-08-22-scaling-replica-ownership-s2-slice-review.md` — `DONE`, no findings.
- Audit remediation: guarded phantom autoscaling on non-HPA workloads by keying
  static replicas on `replicaCount`; aligned Manage and Backend HPA
  `minReplicas` with their PDB floor; provisioned Helm in CI; removed unsupported
  autoscaling stanzas from all three values layers; extended the gate across
  nested values; and changed the three Node.js HPAs to CPU-only metrics.
- Integrated checks: the package command, direct ownership assertions, Helm
  lint, base/STG/PRD renders, the synthetic all-three-HPA render, Biome,
  Prettier, `git diff --check`, and targeted Opengrep pass. The repository-wide
  OKF validator still reports 13 pre-existing errors in older ADR and solution
  files; the new log is valid and absent from the error list. The package check
  emits only the repository's existing Node 24 versus local Node 26 warning.
- Historical integrated final review: the original re-review over
  `origin/v3..f9acce107d1eb0da2f375ba114dc8901f9d6c3a8` returned `DONE`. Material
  2026-08-29 corrections require a fresh review before the local branch returns
  to `pr_ready`.
- 2026-08-29 verification: the ownership gate passed all default and synthetic
  renders, the base/STG/PRD Helm lints passed, Biome and focused Prettier checks
  passed, and `git diff --check` passed. Package tooling emitted the known local
  Node 26 versus repository Node 24 engine warning.
- 2026-08-29 slice review: generic-continuity simplification returned `DONE`
  with no changes. Generic-continuity chart-risk review found that a zero CPU
  target could render an enabled HPA with `metrics: null`; the accepted
  correction makes each enabled HPA CPU target mandatory and adds one negative
  render fixture per HPA-capable workload.
- 2026-08-29 stack propagation: W2 contains exact W1 head `518869dc2` through
  merge commit `b152b4608`. After that approved one-time integration pass,
  `origin/v3` advanced by two commits; a branch-neutral merge calculation
  reports no conflict, so no second upstream integration was performed.
- Delivery: required `pr_ready`; currently `delivery_pending` until fresh review
  completes. No push, merge, deploy, Argo sync, or cluster mutation was
  performed.
- Active children: none; the planning and final review children are complete.
- Blocker: none.
- Next: include W1 in the fresh final stack review, then report local readiness
  separately from stale remote PR and exact-head CI state.

## Test portfolio

| Risk / behavior | Existing evidence | Test obligation | Primary seam | Distinct realistic failure | Owning slice |
|---|---|---|---|---|---|
| Every default base/STG/PRD Deployment has one owner | Baseline Helm renders show 15 Deployments per render and ownerless LTI | `add new` | Parsed Helm output from the focused Node command | A future default or overlay silently re-enables autoscaling and emits an ownerless LTI Deployment | S1 |
| Static and scaler ownership cannot overlap or duplicate | Existing templates use conditional replicas, but no invariant check exists | `add new` | In-memory owner-map fixtures in the same Node command | A Deployment keeps `spec.replicas` while an HPA targets it, or two scaler resources target the same Deployment | S1 |
| All current HPAs satisfy the `autoscaling/v2` Resource target contract | Synthetic PWA output currently contains two legacy fields | `add new` | One synthetic Helm render with PWA, Manage, and GraphQL autoscaling enabled | One of the three HPA paths retains `targetAverageUtilization` or omits the nested v2 target | S2 |
| Documentation stays aligned with the ownership rule | Existing page documents values and Argo but not replica ownership | `add new` documentation, no executable test | Wiki validation, Prettier, and source-path review | The code fix lands without the operational source-of-truth rule or with a misleading live-state claim | S3 |

## Delegation Map

| Workstream | Slices | Execution owner | Starts after | Done when |
|---|---|---|---|---|
| Static ownership and focused assertions | S1 | `main` | Plan approval and bounded preflight | Base/STG/PRD render invariants pass, LTI is static, negative fixtures fail correctly, and S1 reviews are complete |
| HPA schema and scaler ownership | S2 | `main` | S1 verified and committed | All three synthetic HPAs pass the v2 target checks and S2 reviews are complete |
| Operational documentation | S3 | `main` | S2 verified and committed | Wiki page with source locators, validation, and formatting pass |

The slices remain on the main session because the ownership seam, chart render
integration, and deployment-risk decisions are tightly coupled; splitting them
among writers would duplicate integration and review work. S3 is a small
docs-only follow-up. No separate task is proposed.

## Plan slices

### Preflight — bounded live status confirmation (no commit)

- **Route:** `main`.
- **Acceptance:** Repeat only the existing values-free Argo application/resource
  status and LTI/OLAT/scaler inventory. Record the timestamp, source/render
  owner state, live replica status, and any changed denominator in `Progress`.
- **Execution-tier skip reason:** This is an authority-sensitive cross-system
  read owned by the orchestrator; no child receives cluster access.
- **Do:** Use the already available STG/PRD contexts. Query names, sync/health,
  resource kind/name/namespace/status, and replica counters only. Do not read
  Secrets, diff bodies, logs, or response bodies. If the contexts are not
  already usable or ownership evidence changes materially, stop before S1.
- **Files:** Plan `Progress` and ignored review notes only.
- **End-to-end path:** Existing tunnels → values-free Kubernetes/Argo status →
  plan evidence. No state change.
- **Check:** Values-free command output and timestamp; no `apply`, `sync`, or
  mutation command appears in the execution record.
- **Commit:** None.

### S1 — Make LTI static and enforce default ownership

- **Route:** `main`.
- **Acceptance:** Base, STG, and PRD renders each contain 15 Deployments with
  exactly one owner per namespace/name; LTI has `spec.replicas` and no scaler;
  LTI replica counts are base 2, STG 1, and PRD 2. Negative fixtures prove
  zero-owner, static-plus-scaler, and duplicate-target failures.
- **Execution-tier skip reason:** The main session owns the critical chart,
  values, and assertion seam; a delegated writer would not reduce integration
  risk or review cost.
- **Do:**
  - Keep LTI statically owned by its `replicaCount` and remove unsupported
    autoscaling stanzas from non-HPA workloads in the base and environment
    values, preserving existing counts and overlays.
  - Add `util/check-klicker-replica-ownership.mjs` using the existing `yaml`
    package and Helm child processes. Render base, STG, and PRD with explicit
    namespaces; parse Deployments and supported scaler targets; key ownership
    by namespace and Deployment name; and fail closed on zero, dual, or duplicate
    owners.
  - Add `check:klicker-replica-ownership` to the root `package.json` and run it
    in CI after provisioning Helm.
- **Files:** The three values files, the new `util` assertion, and `package.json`.
- **End-to-end path:** Values → Helm render → parsed owner map → nonzero command
  on an invalid owner state.
- **Test portfolio:** Default owner invariant and single-owner invariant rows.
- **Check:** `helm lint deploy/charts/klicker-uzh-v3`; base/STG/PRD
  `helm template`; `pnpm run check:klicker-replica-ownership`; focused format
  check; inspect the exact diff.
- **Reviews:** Dedicated simplifier and ownership-focused slice reviewer after
  the committed S1 range. Both must use the mandated ox-alpha provider.
- **Commit:** `fix(deploy): make LTI replica ownership explicit`.

### S2 — Emit valid autoscaling/v2 HPA targets

- **Route:** `main`.
- **Acceptance:** A synthetic render enabling PWA, Manage, and GraphQL produces
  exactly three HPAs. Each HPA has exactly one CPU metric using
  `resource.target.type: Utilization` and
  `resource.target.averageUtilization`; zero CPU targets fail rendering; no
  target retains `targetAverageUtilization`; each target Deployment omits
  `spec.replicas` and has exactly one HPA owner.
- **Execution-tier skip reason:** This changes the chart's infrastructure
  contract and the shared assertion seam; the main session must integrate the
  schema correction and its negative evidence as one range.
- **Do:** Update `deploy/charts/klicker-uzh-v3/templates/hpa-app.yaml` for all
  three HPA blocks. Extend the same assertion command with one synthetic render
  that enables all three resources and validates each generated CPU metric, the
  target owner map, and absence of the legacy field. Add negative renders for
  invalid CPU targets.
- **Files:** `deploy/charts/klicker-uzh-v3/templates/hpa-app.yaml` and
  `util/check-klicker-replica-ownership.mjs`.
- **End-to-end path:** Autoscaling values → HPA template → autoscaling/v2 YAML →
  parsed schema and owner assertions.
- **Test portfolio:** HPA schema and single-owner invariant rows.
- **Check:** `helm lint`; base/STG/PRD renders; synthetic all-three-HPA render;
  `pnpm run check:klicker-replica-ownership`; optional already-installed,
  non-mutating Kubernetes schema validation; no validator installation.
- **Reviews:** Dedicated simplifier and ownership/schema-focused slice reviewer
  after the committed S2 range. Both must use the mandated ox-alpha provider.
- **Commit:** `fix(deploy): correct autoscaling v2 target schema`.

### S3 — Document ownership and drift boundaries

- **Route:** `main`.
- **Acceptance:** The deployment wiki has the source-of-truth rule, static LTI
  decision, explicit no-ignore boundary for static LTI, future exact-target
  Argo-ignore guidance, and the `Healthy` versus `Synced` warning. Volatile
  STG/PRD inventory remains in the plan/review evidence.
- **Execution-tier skip reason:** Docs-only and mechanical; specialist dispatch
  would add no independent implementation value.
- **Do:** Bump the frontmatter timestamp in
  `docs/ci-and-deployment.md`; add the durable owner rule and static LTI
  rationale; state that Argo replica ignores, when used for active autoscalers,
  must be exact-target and are not changed by W1.
  Do not add a new skill or `docs/index.md` entry because no matching skill or
  index file exists on this base and no page is added, renamed, or removed.
- **Files:** `docs/ci-and-deployment.md`.
- **End-to-end path:** Verified source rule → deployment wiki → wiki validator
  and formatted Markdown.
- **Test portfolio:** Documentation row; no executable test.
- **Check:** `bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs`;
  repository formatting check; Markdown link and diff review.
- **Commit:** `docs(deploy): document replica ownership`.

## Integrated verification and review gates

After S3 and before any delivery action:

1. Run `helm lint deploy/charts/klicker-uzh-v3`.
2. Render base, STG, and PRD overlays with explicit namespaces and inspect all
   15 Deployments plus all three synthetic HPA targets.
3. Run `pnpm run check:klicker-replica-ownership` and the relevant repository
   formatting checks, including wiki validation.
4. Run `git diff --check`, inspect `git diff --name-status` and the complete
   staged diff, and check for secrets, credentials, IDs, emails, raw exports,
   and unrelated data before each commit.
5. Confirm the worktree contains only the approved plan, source, assertion,
   package-script, and documentation files. No cluster command has changed
   state.
6. Run one integrated final reviewer over the complete committed range after
   fresh verification. Applicable lenses are correctness, plan compliance,
   maintainability for the executable assertion, security for infrastructure
   configuration, and architecture only if the final diff introduces a new
   trust boundary. Record non-applicable lenses as skipped.

The focused chart command is also enforced by CI, which provisions Helm before
running it. No UI or browser evidence is required.

## Manual and delivery evidence

- Manual evidence: values-free Argo/resource status refresh, base/STG/PRD Helm
  renders, synthetic all-three-HPA render, focused assertion output, wiki
  validation, formatting, exact diff, and data-hygiene inspection.
- No screenshots are required because no frontend surface changes.
- [PR #5491](https://github.com/uzh-bf/klicker-uzh/pull/5491) exists. Updating its
  branch and description was authorized by the activated KEDA scaling plan on
  2026-08-29. Merge, deployment, Argo sync, and cluster changes remain outside
  this package.

## Plan file

- Plan commit: `709ee1e07 docs(project): add replica ownership implementation plan`.
- Keep subsequent `Progress` updates with the slice they describe; do not create
  a plan-only follow-up commit.
- Commit `4c1d25e41` is an explicit exception: a concurrent takeover recorded
  exact-head review status before the active stack owner reconciled the remote
  branch. It is preserved to avoid rewriting the public dependent stack. This
  coordinated update carries the accepted architecture and roadmap, corrects
  the evidence wording, and records the exception without rewriting W2.
- Do not create a plan-only MR/PR. The plan travels with the W1 implementation.
