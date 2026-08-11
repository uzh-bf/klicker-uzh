# PLAN - Catalyst Feature Stacks

## Identity

- Date: 2026-08-11
- Ceremony: full path
- Public repository: `uzh-bf/klicker-uzh`
- Public target: `v3`
- Canonical public branch: `codex/mastra-chat-openrouter-smoke`
- First public pull request: [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126)
- Plan path: `project/2026-08-11-pr-5126-catalyst-feature-stacks-plan.md`
- Private repository: `uzh-bf/klicker-uzh-catalyst`
- Private target: `main`
- Earlier coordination plan: `project/2026-07-23-catalyst-repo-split-plan.md` on `codex/catalyst-repo-split`; superseded history only
- Existing chat plan: `project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- Status: approved execution contract; planning-stage Sol review completed with concerns and verified findings integrated; no publication or destructive action authorized

## Goal

Deliver one KlickerUZH application from public product services and private
Catalyst algorithm services. Preserve source history, replace mixed prototype
branches with independently reviewable feature stacks, keep the public product
fully runnable through default implementations, and cut over each private
service only after contract and end-to-end proof.

## Non-goals

- No second product, team boundary, database, or deployment environment.
- No private ownership of public UI, authentication, Prisma migrations,
  canonical participant state, credits, or product policy.
- No recreation of code already available in a source branch or repository.
- No placeholder implementations for grading/feedback or content generation.
- No automatic contract negotiation, engine retry, or fallback.
- No merge, force-push, PR closure, branch deletion, publication, deployment,
  secret change, or cluster action under this planning approval.

## Research

- Evidence: fetched public `origin/v3` and GitHub's `refs/heads/v3` both resolve
  to `0d7b4e4612`; the canonical public branch is `854e6ba200`, 16 commits
  ahead of that base. Its upstream feature branch is the stale prototype, so
  status reports 87 ahead/49 behind that upstream. The worktree now contains
  only the deliberate uncommitted grill and plan-document changes.
- Evidence: public PR #5126 still points to the old `7717572aba` prototype;
  the canonical replacement is local and unpublished.
- Evidence: private [PR #2](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/2)
  and [PR #3](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/3) are draft,
  green, and mergeable. PR #3 is stacked on PR #2.
- Evidence: GitHub stacked PRs are available in both repositories. Use
  `gh stack`; do not emulate stacks with ad-hoc chained branches.
- Evidence: learning analytics is already a source stack: public
  [#5199](https://github.com/uzh-bf/klicker-uzh/pull/5199) →
  [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073) →
  [#5230](https://github.com/uzh-bf/klicker-uzh/pull/5230) →
  [#5231](https://github.com/uzh-bf/klicker-uzh/pull/5231) →
  [#5198](https://github.com/uzh-bf/klicker-uzh/pull/5198) →
  [#5265](https://github.com/uzh-bf/klicker-uzh/pull/5265), with public
  feature-flag PRs [#5322](https://github.com/uzh-bf/klicker-uzh/pull/5322)
  and [#5323](https://github.com/uzh-bf/klicker-uzh/pull/5323).
- Evidence: adaptive learning is already a five-layer source stack:
  [#5289](https://github.com/uzh-bf/klicker-uzh/pull/5289) through
  [#5293](https://github.com/uzh-bf/klicker-uzh/pull/5293). Its bottom layer is
  the psychometric kernel; persistence, APIs, UI, and release evidence sit
  above it. PR #5293 contains public Playwright/configuration evidence only;
  private simulation evidence comes from the #5289 kernel source.
- Evidence: public KB management and ingestion POC [#5182](https://github.com/uzh-bf/klicker-uzh/pull/5182)
  is already merged into the KB integration line. Private graph generation is
  implemented in `gitlab.uzh.ch/uzh-bf/tc/kg-content-generation`; shared data
  ingestion remains in `ai-infrastructure/services/data-ingestion`.
- Limitation: source branches are active and the planning reviewer observed a
  different transient `v3` value than the fetched Git and GitHub ref readback.
  Gate 0 therefore stops execution until repository refs, PR heads/bases,
  merge bases, worktree status, checks, and substantive sizes are fetched and
  recorded again. Size signals below are planning diagnostics only.
- Limitation: the configured local-search and planner child route attempted the
  unavailable `gpt-5.6-luna` model. Repository mapping was completed locally;
  the required planning-stage challenge uses the existing read-only Sol
  frontier reviewer.

## Decisions And ADRs

- [ADR 0005](../docs/adr/0005-versioned-chat-engine-boundary.md): public
  `chat-api` is the platform boundary and engines are stateless.
- [ADR 0006](../docs/adr/0006-roll-chat-engine-contract-generations.md):
  ordinal contract generations roll engine-first without negotiation.
- [ADR 0007](../docs/adr/0007-use-a-stateless-catalyst-adaptive-engine.md):
  public adaptive state calls a private psychometric engine.
- [ADR 0008](../docs/adr/0008-split-learning-analytics-compute-from-product-surfaces.md):
  analytics product surfaces remain public while private compute writes only
  derived analytics tables.
- Supersession: the earlier `project/2026-07-23-catalyst-repo-split-plan.md`
  is marked completed history and no longer authorizes execution. Its semantic
  versioning and fully public adaptive-learning rulings were explicitly
  superseded by the 2026-08-11 grill and ADRs 0006–0008.
- Decision: `v3-ai` lands in `v3`; MCP servers, embedded assistants, and public
  KB/control surfaces become the baseline and are not recreated here.
- Decision: source repositories own images and service defaults. Environment
  GitOps composes one application deployment and owns environment values and
  Infisical references.

## Repository And Worktree Contract

- Public chat stack worktree: `trees/codex-mastra-chat-openrouter-smoke` in the
  current public checkout; reuse it for the existing branch until that layer is
  published and linked.
- Every new feature stack gets one repo-local `trees/<stack-name>/` worktree.
  One topology owner mutates a stack. Independent stacks may proceed in
  parallel only when their files, branches, database, and verification
  resources do not conflict.
- Private PR #2 and PR #3 keep their existing branches and bases. Link or adopt
  them into GitHub's stack only after live local/remote topology agrees.
- Preserve source PRs and archive refs until replacement stacks validate and
  land. Rewriting or deleting a source is never an extraction technique.

## Gate 0 - Refresh Before Topology Mutation

- Fetch every participating remote and record target, source, and archive SHAs.
- Record each source PR/MR head, base, draft state, mergeability, checks,
  substantive human/generated delta, and merge base.
- Stop on a dirty worktree outside the named plan/ADR files, local/remote stack
  divergence, source changes touching mapped paths, or an unexplained SHA
  mismatch between Git and the forge API.
- Recompute every size ruling and source ledger from those immutable heads.
  Gate 0 completion is the evidence used for stack adoption and Gate 1; this
  draft's snapshot is not sufficient.

## Milestone Order

| Order | Milestone | Entry gate | Exit gate |
| --- | --- | --- | --- |
| 1 | Shared Catalyst foundation | private PR #2 current and green | PR #2 reviewed and explicitly authorized to land |
| 2 | Chat and tutoring | public contract decisions accepted; private archives exist | public default and private engine pass the same `v1` contract; default path passes browser proof |
| 3 | Learning analytics | source stack frozen in a ledger | private runtime and public surfaces pass data, privacy, and cutover proof |
| 4 | Adaptive learning | psychometric source ledger complete | private engine and public host pass simulation, contract, database, and browser gates |
| 5 | Knowledge-graph consolidation | `v3-ai` and public KB baseline settled | graph generator imported with history and public integration verified |
| Later | Grading/feedback and content generation | concrete product requirement or source exists | separately grilled and planned feature stack |

Milestones 2–4 are the active portfolio. Their repository-local stacks are
independent; cross-repository gates coordinate them without forming one Git
stack.

## Stack 1 - Public Chat Host And Default Engine

Provider: GitHub. Base: `v3`. Mode: progressive after Gate 1; pause at the
contract foundation because it changes a public internal protocol.

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| CH-P1 | Existing PR #5126: public `v1` contract, default engine, and authenticated chat-generation tracer | `v3`; integrate landed `v3-ai` before dependent work | inert; old Next route remains | high | current source +5,626/-8 across 37 files; over threshold but retained as one already-reviewed end-to-end tracer to avoid recreating work; report generated/test delta separately | contract/default/chat-api checks, Node 24 build, current-head review |
| CH-P2 | Conversation, feedback, disclaimer, attachment, and policy endpoints with transactional credit contention proof | CH-P1 | inert; frontend still uses old route | high | estimate 800–1,500 human lines/12–20 files; one API/data-integrity lifecycle package | GraphQL/Prisma integration, concurrent debit, auth/CORS/CSRF tests |
| CH-P3 | Runtime URL configuration and direct frontend client behind an explicit off-by-default migration flag; retain the old Next routes | CH-P2 | feature-flagged, default off | high | estimate 500–1,000/12–22; one inert browser-client migration package | app checks plus routed EN/DE desktop/mobile proof of both flag states |
| CH-P4 | Public service images, CI smoke, chart defaults, and default-engine rollout/rollback proof; keep the frontend migration flag off | CH-P3 | inert until environment selection | high | estimate 250–500/8–15; deployment risk isolated from behavior | image builds, contract smoke, LiteLLM/OpenRouter conditional smoke, flagged default-engine E2E |
| CH-P5 | Activate the direct path after environment proof, then remove the migration flag and old Next generation routes after every environment is cut over | CH-P4 and recorded environment cutover | complete | high | estimate 150–400/8–15; one post-cutover cleanup package, landed only after old-route traffic is zero | routed browser regression, old-route absence, rollback record, full app build |

Follow-up: Catalyst selection is an environment GitOps change after the private
engine passes the same contract and browser flow. It is not another public
engine implementation.

## Shared Private Foundation

Provider: GitHub. Base: `main`.

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| CF-C1 | Existing PR #2: repository CI and module-root verification | `main` | inert | low | +391/-7 across 4 files; coherent operational foundation | existing CI plus current-head readback |

## Stack 2 - Private Tutoring Runtime

Provider: GitHub. Base: CF-C1. Existing PR #3 is adopted rather than rebuilt.

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| TU-C1 | Existing PR #3: stateless Mastra runtime aligned to public `v1`, including W3C headers, terminal semantics, capability manifest, and MCP token rules | CF-C1 and completed chat contract publication gate | inert until configured | high | +6,319/-26 across 26 files; over threshold but retained because it is an existing reviewed runtime tracer; contract alignment amends this layer | Node 24 checks, private tests, immutable public-SHA conformance runner, security review |
| TU-C2 | Tutor policy, research questions, and deterministic TutorBench/evaluation import from public PR #5129 | TU-C1 | inert | medium | estimate 800–1,600/10–20; one private tutoring-policy/evaluation package | credential-free deterministic suites and source ledger; at Gate 3 the owner records either a live external MathTutorBench run or an explicit dated deferral with reason; it does not block source migration |
| TU-C3 | Private image, health/readiness, service defaults, and environment handoff | TU-C2 | disabled until GitOps selection | high | estimate 150–350/5–10; operational package isolated for rollback | image build, non-root runtime, health/readiness, `v1` conformance against built process |

## Stacks 3A And 3B - Private Learning Analytics

The six approved source milestones are preserved across two sequential stacks
so neither exceeds the six-layer ceiling. Source commit order is retained even
when mixed public files are excluded.

### Stack 3A - Foundations, Runtime, And Finalization

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| LA-C1 | History-preserving import of analytics foundations from PR #5199 into `apps/learning-analytics` with provenance manifest | landed CF-C1 on `main` | inert | medium | source import exceeds 400 lines/25 files; mechanical provenance exception, with no adaptation mixed into the layer | filtered history/blame, path ledger, uv lock/install, baseline tests |
| LA-C2 | Production SQLAlchemy runtime and native Hatchet worker/DAG from PR #5073 | LA-C1 | inert | high | source exceeds threshold; one runtime lifecycle package because adapter, worker, cancellation, and tests must execute together; generated notebooks excluded from review count | uv checks, DB adapter tests, cancellation/concurrency tests, built worker process |
| LA-C3 | Consent reconciliation and compute finalization from PR #5230, limited to analytics-owned derived rows and a structured completion result for the public host | LA-C2 | inert | high | estimate 600–1,200/10–20; one privacy/data-integrity state transition package | PostgreSQL integration, historical consent, race/finalization tests, explicit proof that private SQL never updates `Course`, intermediate review |

### Stack 3B - Current Schema, Privacy, And Delivery

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| LA-C4 | Current-`v3` SQL/runtime reconciliation from PR #5231 | landed Stack 3A | inert | medium | estimate 200–600/8–15 plus regenerated references; generated delta separate | SQL contract and current-schema tests |
| LA-C5 | Computation-side eligibility, derived-row privacy, and de-identification from the private paths of PR #5198; public consent and `Course` state remain inputs only | LA-C4 | inert | high | estimate 1,000–2,500/20–40; over threshold: split participant eligibility from lecturer-output de-identification if exact extraction crosses 25 human-authored files | privacy/effective-N/eligibility integration, bounded output review, forbidden-domain-table-write test |
| LA-C6 | Pinned public Prisma fetch, drift CI, least-privilege derived-table writes, image, health, and service defaults | LA-C5 | disabled until public companion is ready | high | estimate 350–700/8–15; one delivery contract; split image plumbing only if it can be independently green | pinned-ref reproduction, drift failure, DB grants, image and process smoke |

## Stack 3P - Public Learning-Analytics Companion

Public GrowthBook PRs #5322–#5323 remain their own public feature-flag stack.
They are a prerequisite, not analytics source to import.

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| LA-P1 | Reconcile public Prisma/migrations, GraphQL read/control surfaces, recompute dispatch and completion contract, retained Hatchet task types, and all `Course` validity/finalization writes from mixed analytics sources | `v3` plus required public prerequisites | feature-flagged | high | estimate 800–1,600/15–25; coherent public data/control boundary | migrations, GraphQL codegen/checks, idempotent completion/database integration, permission tests, proof that only the public host updates `Course` |
| LA-P2 | Retain privacy choice, lecturer controls, de-identified UI, and user documentation from PR #5198/#5265 | LA-P1 and GrowthBook stack | feature-flagged | high | estimate 800–1,600/20–30; split documentation from product behavior only if both clear packaging floor and remain independently useful | UI/API checks, effective-N fixtures, routed EN/DE lecturer/student browser evidence |
| LA-P3 | Cut over recompute dispatch and remove `apps/analytics`, analytics image workflows, `prisma:sync`, `util/sync-schema.sh`, and stale references | private LA-C6 deployed and verified | complete | high | removal-heavy; estimate 150–400 human lines/10–20 files plus large deletions | full public build/check, absence audit, production-like dual-run/cold-worker cutover proof |

The private service reads required domain tables, writes only analytics-owned
derived tables, and returns an idempotent structured completion result. The
public host owns `Course.areAnalyticsValid`, `chatAnalyticsValidAt`,
`analyticsFinalizedAt`, consent choices, dispatch, and finalization. Public
Prisma remains the migration authority; the private service never applies
migrations or updates public domain tables.

## Stacks 4C And 4P - Adaptive Learning

### Stack 4C - Private Adaptive Engine

Target layout:

- `packages/adaptive-learning`: history-preserved pure psychometric kernel
- `apps/adaptive-learning-engine`: stateless HTTP service wrapper
- image/service identity: `adaptive-learning-engine`
- public contract source: `packages/adaptive-engine-contract`
- public host adapter: `packages/graphql/src/services/adaptiveEngine.ts`
- deployment configuration: `ADAPTIVE_ENGINE_URL`,
  `ADAPTIVE_ENGINE_TOKEN`, and `ADAPTIVE_ENGINE_CONTRACT_VERSION`

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| AD-C1 | Import `packages/adaptive-learning` and its simulations from PR #5289 with history into the same private package path | landed CF-C1 on `main` | inert | high | source exceeds 400 lines/25 files; one mathematical kernel because policies, estimators, fixtures, and release gates form one reviewed invariant set | 264 existing deterministic tests, reference fixtures, performance gates, path/commit provenance ledger |
| AD-C2 | Implement `apps/adaptive-learning-engine` as the stateless adapter for the public adaptive `v1` contract | completed adaptive contract publication gate and AD-C1 | inert | high | estimate 300–650/6–12; one HTTP/conformance seam | immutable public-SHA conformance, malformed input, deterministic retry/idempotency, no-DB proof |
| AD-C3 | Add the `adaptive-learning-engine` image, readiness, service defaults, and simulation release evidence sourced from AD-C1/#5289 | AD-C2 | disabled until public host ready | medium | estimate 150–350/5–10 | image build, process smoke, simulation thresholds, resource bounds |

### Stack 4P - Public Adaptive Host

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| AD-P1 | Canonical `packages/adaptive-engine-contract` `v1` schemas, fixtures, and black-box conformance runner | `v3` | inert | high | estimate 300–600/5–10; one protocol foundation | schema/fixture tests, `/v1/manifest`, `/v1/estimate`, `/v1/select`, and compatibility failure cases |
| AD-P2 | Persistence, migrations, and fixtures adapted from PR #5290 without the private kernel dependency | AD-P1 | inert | high | source exceeds 400 lines/25 files; one data foundation because migrations and repair audits must land atomically; generated Prisma delta separate | migration preflight/backfill/rollback evidence, Prisma checks |
| AD-P3 | Public host API from PR #5291: auth, attempts, grading, snapshots, engine client, persistence, and runtime operations | AD-P2 and private AD-C2 contract proof | feature-flagged | high | expected >2,000/>25; split authoring/calibration administration from participant attempt runtime if exact ledger confirms both clear the packaging floor | database concurrency/idempotency, auth, grading, engine-failure tests |
| AD-P4 | Lecturer/student UI from PR #5292 | AD-P3 | feature-flagged | medium | expected >1,000/>25; split lecturer authoring from participant runtime UI if both are independently functional | app checks and routed EN/DE desktop/mobile journeys |
| AD-P5 | Public Playwright/configuration/accessibility evidence from PR #5293 plus host environment configuration and cutover proof | AD-P4 and private AD-C3 | disabled then complete | high | estimate 250–600/8–15; no private simulation source is attributed to #5293 | API/browser E2E, private AD-C3 simulation provenance readback, rollout/rollback proof |

PR #5113 remains untouched until the union of AD-C and AD-P has an exact
source-to-target coverage ledger.

## Stack 5 - Knowledge-Graph Consolidation

This stack starts after the active portfolio and after `v3-ai` establishes the
public KB baseline.

| Layer | Work package | Depends on | Activation | Risk | Size signal and ruling | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| KG-C1 | Import `kg-content-generation` into `apps/knowledge-graph-generation` with history and provenance | landed CF-C1 on `main` | inert | medium | source import likely exceeds threshold; mechanical provenance exception | history/blame, source tag/SHA ledger, existing GitLab suite parity |
| KG-C2 | Adapt the generator to the public KB operations contract while retaining external data ingestion | KG-C1 and landed public KB contract | inert | high | estimate 500–1,200/8–18; one cross-service lifecycle | contract/integration, idempotency, callback, privacy and egress-boundary tests |
| KG-C3 | Image, service defaults, deployment handoff, and source-repository retirement evidence | KG-C2 | disabled until GitOps cutover | high | estimate 150–350/5–10 | image/process smoke, graph generation E2E, rollback and source readback |

Public KB management UI/backend, MCP, generic pgvector/FalkorDB storage, and
graph read/visualization remain public. The external data-ingestion service is
not imported.

## Roadmap Stacks

`apps/grading-feedback` and `apps/content-generation` retain only their module
roots. When a concrete requirement or source exists, each receives a new grill,
ADR if warranted, public contract/host stack, private engine stack,
conformance/evaluation layer, and delivery gate. No empty branches or PRs are
created now.

## Cross-Repository Contract Gate

- Public contract packages are canonical and unpublished.
- A public contract layer must be committed, pushed, and read back from GitHub
  before a private adaptation can claim conformance. The readback records the
  repository, immutable commit SHA, package path, generated schema digest, and
  conformance command in the private service's provenance file.
- Private CI checks out that immutable public commit and runs its exact
  black-box suite against the built service. A local path, moving branch, copied
  schema, or unpushed commit cannot satisfy this gate.
- Contract generations are `v1`, `v2`, `v3`. An engine may serve current and
  next during rollout; a host selects exactly one configured generation.
- Each generation has its own routes. Chat uses `GET /v1/manifest` and
  `POST /v1/chat`; adaptive uses `GET /v1/manifest`, `POST /v1/estimate`, and
  `POST /v1/select`. A later generation uses the corresponding `/v2/*` routes.
- The route and strict body/terminal `contractVersion` literal must agree.
  There is no version-negotiation header. Service bearer authentication and
  W3C trace headers are orthogonal to contract selection.
- A generation-specific manifest reports that exact generation and only its
  host-enforced capabilities. Host readiness probes only the configured
  generation; another supported generation never satisfies readiness or
  triggers downgrade.
- Host/engine incompatibility fails readiness for generation or decision work
  while non-dependent product endpoints remain available.
- Service credentials and provider/MCP secrets remain in headers or deployment
  configuration and are never stored in request bodies or databases.

## Source Coverage And Retirement Ledger

| Source | Required target proof | Planned disposition |
| --- | --- | --- |
| Public chat PR #5126 old head | canonical CH-P1 remote SHA, whole-branch diff, secret scan, CI, GitHub readback | replace in place only after explicit force-with-lease approval |
| Public tutor PR #5129 | TU-C2 path/commit/evaluation coverage and private archive ref | close and delete source branch only after separate authorization |
| Analytics PRs #5199/#5073/#5230/#5231/#5198 | union of LA-C1–C6 and LA-P1–P3 accounts for every code/test/doc/generated path | retire or rewrite each source PR according to its public/private ledger; no bulk closure |
| Public analytics docs PR #5265 | retained public docs/UI/seed changes applied on current public base | keep public and retarget/rebase only with explicit branch-rewrite approval |
| GrowthBook PRs #5322/#5323 | land through their owning public stack | keep public; no Catalyst import |
| Adaptive PR #5289 | AD-C1 history and test parity | close/delete only after private readback |
| Adaptive PRs #5290–#5292 | AD-P1–P4 public coverage plus AD-C private evidence where mixed | rewrite/retarget as the clean public stack only with explicit approval |
| Adaptive release PR #5293 | AD-P5 public docs/Playwright/configuration/accessibility coverage; private simulation evidence comes from #5289/AD-C1 | keep entirely public and retarget only with explicit approval |
| Old adaptive PR #5113 | union of new adaptive stacks covers every unique behavior | close/delete after explicit coverage and authorization |
| `kg-content-generation` repository | KG-C1–C3 history, behavior, CI, deployment, and remote readback | archive/retire later under a dedicated GitLab authorization gate |

Deleting branches does not erase public Git history. Private archive refs remain
recovery evidence. No plan step attempts to revoke an existing license grant.

## Feature-Wide Test Portfolio

| Risk or behavior | Existing evidence | Test obligation | Primary seam | Distinct failure | Owner |
| --- | --- | --- | --- | --- | --- |
| Public/private contract compatibility | chat contract schemas and private runtime tests | extend existing | black-box HTTP conformance | service starts but cannot accept or finish a real request | CH-P1/TU-C1, AD-P1/AD-C2 |
| Exact contract rollover | none beyond `v1` literal checks | add new | engine readiness and selected-generation client | deployment silently negotiates or downgrades | each contract foundation |
| Credits and terminal streams | current Slice 2 unit tests | add narrow DB integration | chat-api stream/database boundary | abort/finish double-charges or loses completed usage | CH-P2 |
| MCP least privilege | existing public and Catalyst header tests differ | replace/consolidate | chat-api → engine → MCP service | token crosses wrong server/tool/run boundary | CH-P1/TU-C1 |
| Analytics numerical parity | source analytics suites and dry-run tooling | preserve/extend | private compute against fixed DB fixtures | extracted worker changes scores or aggregates | LA-C1–C4 |
| Analytics consent/privacy | source consent and eligibility tests | extend existing | private compute plus public control/database integration | opted-out or small-cohort data reaches output | LA-C3/C5 and LA-P1/P2 |
| Analytics schema drift/privileges | public schema-copy script only | add new | pinned-ref fetch and PostgreSQL role | private runtime drifts or writes domain tables | LA-C6 |
| Adaptive psychometric parity | 264 deterministic tests and simulations | preserve | private kernel | split changes selection, estimates, or stopping | AD-C1 |
| Adaptive host/engine consistency | current direct in-process public stack | add new | public HTTP/database integration | engine result persists against stale attempt or wrong snapshot | AD-P3/AD-C2 |
| User-facing cutovers | existing public browser journeys | extend existing | real routed browser | retained flow breaks after service boundary | CH-P3, LA-P2/P3, AD-P4/P5 |
| Image and deployment correctness | source workflows only | add smoke | built service in production-like routing | manifest is green but full request path is broken | delivery layers |
| Source preservation | private archive refs and Git refs | add ledger checks, no test code | Git object/path comparison | code or authorship disappears before source retirement | every migration stack |

## Review And Verification Routing

- Every layer must be independently functional, reviewable, green, and safe to
  land. Drafts remain draft until Gate 3.
- Contract, database, privacy, auth, and cross-service layers require one
  risk-selected intermediate Terra review after commit and focused verification.
- Each complete feature stack receives fresh checks, a bounded security review,
  the mandatory maintainability review, and one Sol integrated final review on
  the exact final range.
- Frontend layers require fresh routed browser evidence for every changed route
  and material state, with revision, viewport, locale, warnings, and limits.
- Run repository-native checks inside the public devcontainer. Run host Git and
  forge commands on the host. Private repos use their pinned Node/uv workflows.
- At Gate 3 report human-authored and generated delta separately for every
  layer, CI per layer, review focus, residual limitations, and bottom-up order.

## Planning-Stage Review

- Reviewer: existing read-only Codex Sol frontier reviewer, after the configured
  planner route failed because the collaboration backend selected unavailable
  `gpt-5.6-luna`.
- Verdict: `DONE_WITH_CONCERNS`.
- Accepted: keep `Course` validity/finalization writes in the public analytics
  host; make frontend migration and service delivery independently inert before
  post-cutover route removal; add Gate 0 ref/SHA/size refresh; add immutable
  public-contract publication/readback gates; supersede the old plan; specify
  route/body/manifest/readiness version mapping; record TutorBench run or
  deferral; record the exact `v3-ai` merge/overlap ledger; name adaptive target
  paths; correct PR #5293 provenance.
- Verified correction: after the reviewer reported a different transient `v3`
  SHA, a fresh `git fetch`, local remote-ref read, and GitHub ref API read all
  returned `0d7b4e4612`. The plan retains the reviewer's safer mandatory Gate 0
  instead of treating either planning snapshot as execution authority.
- Result: all reported seams are addressed in this revision without changing
  the approved product boundaries. No second planning-stage invocation is
  required unless Gate 1 changes topology or ownership.

## External And Approval Gates

- Gate A: `v3-ai` lands into `v3`; record the exact #5092 merge SHA and remote
  readback, build a changed-path/consumer overlap ledger against CH-P1, then
  explicitly choose rebase or merge and rerun full checks/review. The plan does
  not authorize either integration method.
- Gate B: user explicitly authorizes replacing remote PR #5126 after local
  canonical-head review and a force-with-lease target check.
- Gate C: user explicitly authorizes each stack's Gate 3 transition from draft
  to ready for review.
- Gate D: humans land stacks bottom-up in the GitHub/GitLab UI. Agents do not
  merge during the stacked-PR pilot.
- Gate E: environment owner approves GitOps, Infisical, image, service account,
  database grants, and rollout/rollback changes before application.
- Gate F: user explicitly authorizes each PR closure and branch deletion after
  its ledger and remote readback pass.

## Progress

- [x] Private repository scaffold and module roots created.
- [x] Private operational wiring implemented in draft PR #2.
- [x] Private stateless tutoring runtime implemented in draft PR #3.
- [x] Public chat contract/default engine and chat-generation tracer implemented
  and reviewed locally on the canonical branch.
- [x] Product, contract, feature-stack, analytics, adaptive, KB, deployment, and
  retirement decisions grilled and recorded.
- [x] Planning-stage Sol review completed; verified findings integrated.
- [x] Grill documentation committed separately from this plan.
- [x] This plan committed before the next implementation layer.
- [ ] Public and private stack topology created/adopted after Gate 1 approval.
- [ ] Active stacks executed and verified.
- [ ] Source PRs retired only through their explicit gates.

## Next Action

Run Gate 0 against live public, private, and source repositories. Record current
SHAs, PR topology, checks, substantive sizes, and dirty-state findings; stop
before any remote or destructive action.
