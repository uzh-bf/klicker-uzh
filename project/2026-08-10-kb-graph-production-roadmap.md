# KB knowledge graph production roadmap

Status: M1 execution approved and in progress; W1/W2/W3 package evidence is
locally reviewed, while cross-package compatibility and external delivery gates remain.

Date: 2026-08-10

Roadmap owners: KlickerUZH KB product stack and Catalyst KG runtime

Current roadmap branch: `feat/kb-graph-lifecycle`

Parent plans:

- [KB-owned graph stack](2026-07-31-kb-graph-kb-owned-stack-plan.md)
- [KB production v1 roadmap](2026-07-24-kb-production-v1-roadmap-plan.md)
- Temporary provider-side harness plan, used only as a coverage-transfer source:
  `project/2026-08-10-kb-pgvector-graph-e2e-plan.md` in the
  `data-ingestion` repository
- [KB-owned projection decision](../docs/adr/0001-kb-owns-two-derived-projections.md)

Audience: an agent or engineer starting with no session context. Read the
parent plans and ADRs before starting a work item. Each work item becomes its
own full-path `$rs-sliced-development-workflow` plan, branch or existing draft,
verification loop, and MR/PR finish gate.

## Goal

Bring the KB-owned knowledge-graph capability from locally reviewed code to a
reliable, observable, reversible public lecturer beta. Preserve Patrick Louis
Aldover's authored work and visualizations, prove the full
Klicker → data-ingestion → pgvector → graph-worker → FalkorDB/GraphML path, and
make that proof repeatable in CI and deployed environments.

## Out of scope

- General availability beyond the first lecturer beta, including unrestricted
  student visibility.
- Scheduled lecturer graph rebuilds; rebuilds remain explicit because they
  consume AI budget.
- Replacing Patrick's graph implementation or rebuilding its visualizations.
- Replacing Hatchet, pgvector, FalkorDB, Blob storage, or doc-processing.
- Introducing the deferred authenticated graph callback; direct Hatchet status
  polling remains the initial reconciliation seam.
- Multi-region graph serving, automatic graph-worker scale-to-zero, or a second
  semantic-quality tier before the standard tier is production-proven.
- Any merge, push, deployment, secret mutation, cluster connection, or
  production mutation merely because this roadmap is approved.

## How to work on this roadmap

### Rules for every work item

1. Fetch the relevant remote and recheck the recorded base, branch, worktree,
   CI, and dirty state before editing.
2. Use the existing branch or worktree named below when it still exists. Create
   a repo-local `trees/<branch-name>` worktree only when the item explicitly
   calls for one and after confirming `trees/` is ignored.
3. Write and review the item's sliced-development plan before implementation.
   Keep that plan in the item's repository and ship it with the implementation.
4. Run Git on the host. Run Klicker pnpm, Prisma, build, and tests through the
   existing DevRouter container.
5. Preserve unrelated dirty or untracked files. Stage explicit paths only.
6. Treat cluster access, deployment, paid model runs, production mutations,
   merge, and publication as separate approval boundaries.

### Repository verification loops

| Repository | Working context | Normal verification |
| --- | --- | --- |
| KlickerUZH | `/Users/rschlae/Git/klicker/klicker-uzh/trees/kb-graph-stack`; existing `feat/kb-graph-lifecycle`; stack base `kb-poc`; eventual feature branches follow the existing W9 stack | `devrouter ensure .`; focused Vitest; `pnpm run check`; affected lint; production build; disposable Prisma migration; browser verification for lecturer and student viewers |
| data-ingestion | `/Users/rschlae/Git/ai/data-ingestion`; AI infrastructure owns this provider and its pgvector projection; existing `rs/kb-pgvector-graph-e2e` contains a temporary cross-system harness that must not make AI infrastructure the KG owner | Provider-contract and ingestion tests; `uv run poe check`; non-E2E ingestion suite; applicable ingestion E2E; `git diff --check` |
| kg-content-generation | `/Users/rschlae/Git/ai/kg-content-generation`; existing `feat/kb-graph-manifest-contract`; target `main` | graph workflow tests; full repository test/check command established by W1; worker image build; local Hatchet smoke |
| KB graph runtime | `/Users/rschlae/Git/klicker/klicker-uzh-catalyst`; private GitHub repository `uzh-bf/klicker-uzh-catalyst`; fetched `origin/main` was `37657ad2d` on 2026-08-15 and contains merged PR #2, merged PR #3, and later merged work; W1 starts from the latest `main` at execution time | Repository-native checks established by W1; manifest render and policy validation; server-side dry-run only when cluster access is separately authorized |

## Current state

Live refs reconciled on 2026-08-15. Recheck before implementation because
branch and remote state can advance.

| Area | State | Evidence |
| --- | --- | --- |
| Klicker graph ownership and lifecycle | Implemented locally on `feat/kb-graph-lifecycle` at `b348adeea`; KB-owned schema, lifecycle, GraphQL operations, lecturer viewer, and student viewer exist; the branch was 133 commits ahead and 60 behind the current GitHub `v3` ref `3c64c9726` on 2026-08-15 (the local `origin/v3` ref is stale at `2bcaddabe`) | [W9 progress](2026-07-31-kb-graph-kb-owned-stack-plan.md#progress) and live ref comparison |
| Patrick's authorship and visualizations | Preserved. Parked tip `9b5fc7af2` is an ancestor through merge `bc6262f65`; Patrick-authored commits remain in history | W9 progress and `git log --format='%h %an %s'` |
| Klicker migration and live proof | Not complete | Disposable migration application, cross-repository runtime, current screenshots, and live FalkorDB/Blob/Hatchet evidence remain open |
| Graph builder contract | Implemented on `feat/kb-graph-manifest-contract` at `c4a4236d`; seven commits ahead of current graph `origin/main`; GitLab MR !3 is open, mergeable, and has a successful current pipeline, although its body cites stale commit and pipeline evidence | 38 focused graph workflow tests passed on 2026-08-10; live MR and ref readback on 2026-08-15 |
| Graph builder production status | Not ready | `lightrag_research/README.md` classifies the worker as research/non-production; GitLab CI prepares and builds images but has no blocking test job and publishes mutable `latest` on main |
| Temporary cross-system harness | Implemented in data-ingestion on `rs/kb-pgvector-graph-e2e` at `a0fcd4f2`; its safety and assertion work is reusable, but KG-system ownership belongs in Catalyst rather than AI infrastructure | 33 focused tests and `uv run poe check` passed on 2026-08-10; prior capable review passed `a2c72a7..c499c80` with no verified P1/P2 findings |
| Data-ingestion base | Needs semantic reconciliation | Branch was 16 commits ahead and 16 behind current `origin/main` on 2026-08-15; both sides touched workflow timeout/default files and tests; unrelated local changes remain preserved |
| Full local system proof | Not run successfully | No completed upload → ingestion → pgvector → graph build → GraphQL/FalkorDB/GraphML → cleanup run exists; the prior proof containers and port `18081` listener were absent on 2026-08-15 |
| Runtime ownership | Resolved; W1 start base selected | The Klicker team owns the runtime in private repository `uzh-bf/klicker-uzh-catalyst`. PR #2 and PR #3 are merged, and later work is also on `main`. W1 starts from the latest fetched `main`, integrates the complete `kg-content-generation` history after a sensitive-history audit, preserves both repositories' ancestry and Patrick's authorship, and refactors only in later Catalyst commits; see ADR 0008. AI infrastructure supplies services such as doc-processing but does not own this runtime |
| Production review | Not started | Full-path security, maintainability, and exact-final-outcome gates remain required per work item before publication |

## Non-negotiables

- **Do not re-litigate:** Klicker KB owns graph orchestration, published build
  selection, and the two derived projections. The rationale lives in ADR 0001.
- **Do not re-litigate:** Klicker owns KB product state, authorization,
  lifecycle, quota enforcement, and the lecturer/student experience. Catalyst
  owns graph generation, FalkorDB operation, the GraphML archive, KG quality,
  and KG-system E2E. AI infrastructure owns data-ingestion, doc-processing, and
  pgvector; Catalyst and Klicker consume those services through contracts. See
  ADR 0003.
- **Do not re-litigate:** Patrick's branches, authored commits, Cytoscape
  presentation, and parked PR remain source history. Adaptations are separate
  commits; squashing must never erase his authorship.
- **Do not re-litigate:** every graph build writes its own graph name and
  GraphML artifact. Publication moves the Klicker pointer only after a complete
  successful build.
- **Do not re-litigate:** direct Hatchet polling is sufficient for the first
  production release. An authenticated callback is a later capability.
- A graph can continue serving after its KB digest becomes stale. Lecturer
  surfaces show staleness; student surfaces do not expose it.
- Production images are pinned by immutable digest. Mutable tags can exist as
  convenience aliases but are never deployment evidence.
- **Do not re-litigate:** completed GraphML files are the durable graph archive
  and FalkorDB is a reconstructible serving projection. The first beta does not
  require FalkorDB high availability or database backup as the recovery source;
  see ADR 0002.
- Model-quality evaluation never substitutes for deterministic system checks,
  and a non-empty graph never counts as model-quality evidence. Existing
  testing and the production canary are sufficient to open the explicitly
  labeled beta; curated quality evaluation gathers evidence during beta and
  gates widening, general availability, and quality claims. See ADR 0006.
- The first deployment is disabled by default. New graph builds require a
  dedicated kill switch independent of ordinary KB ingestion.
- The lecturer beta is publicly described as beta and self-service. Enabling it
  requires explicit cost disclosure, an approved model credential path, a
  verified external billing association where applicable, and an enforced
  spending cap.
- Sensitive lecturer billing information stays outside the Klicker database.
  For UZH-issued keys, the beta keeps the cost-account association in a
  manually maintained spreadsheet. BYOK lecturers are billed by their own
  provider. Klicker stores non-sensitive quota state and enforces graph-cost
  limits for both paths.
- The public-beta feature flag grants a lecturer permission to enable knowledge
  graphs; each knowledge base remains opted out until the lecturer explicitly
  enables its graph capability.
- AI-provider credentials are a platform-wide capability shared by tutoring,
  content generation, grading feedback, knowledge graphs, and future AI
  features. KG/Catalyst is one consumer, not the definition of the problem.
  Consumer applications retain only opaque credential handles and safe status;
  custody ownership, submission, resolution, rotation, revocation, and runtime
  use are isolated in the generic AI credential-management handoff.
- Klicker enforces a per-lecturer, per-semester monetary quota and a per-build
  maximum. It reserves estimated cost before dispatch and idempotently settles
  actual metered cost reported by Catalyst; see ADR 0005.
- Secrets enter workers and test jobs through the approved secret store or
  protected runtime variables. Tokens, SAS query strings, DSNs, raw source
  content, and credentials never enter roadmap, logs, reports, or commits.
- Production mutations and cluster changes need explicit approval at the time
  of execution. This roadmap grants neither.

## Known traps

- **A data-ingestion rebase appears mechanical.** Cause: `origin/main` and the
  harness branch both changed workflow timeout/default files and tests. Remedy:
  compare intended semantics commit by commit, drop duplicate timeout work,
  resolve against current shared defaults, and run the complete relevant suite.
- **The local stacks authenticate but the E2E still cannot run.** Cause:
  Hatchet API health does not prove an ACTIVE worker has the required workflow,
  and doc-processing has its own lifecycle. Remedy: rely on the harness's
  workflow-specific preflight and exact doc-processing `status: ok` check.
- **Patrick's graph stack is accidentally stopped by ingestion bootstrap.**
  Cause: both stacks traditionally use 7077/8888/10000. Remedy: keep graph on
  its established ports and ingestion on 17077/18888/15433/20000; preserve the
  harness's atomic namespace and token separation checks.
- **A failed automated run leaves fixtures.** Cause: the harness intentionally
  cleans up only after all assertions pass so a failure cannot trigger an
  unsafe delete. Remedy: retain failure IDs for diagnosis and add an
  environment-scoped TTL sweeper that can delete only labeled synthetic
  resources after a grace period.
- **A green graph image build hides broken code.** Cause: the current graph CI
  has no test stage. Remedy: W1 makes tests and checks predecessors of every
  image build.
- **A deterministic smoke is mistaken for real-model evidence.** Cause: a
  CI-only graph stub can prove contracts while bypassing LightRAG/model quality.
  Remedy: label evidence by layer and require the separate W6 real-model eval.
- **Klicker schema changes appear safe because generated code compiles.** Cause:
  the new migrations have not been applied to disposable PostgreSQL. Remedy:
  apply the migration chain from the actual target base, exercise rollback
  compatibility, and retain the database output as evidence.
- **Old screenshots imply the current UI was tested.** Cause: parked screenshots
  cover the chatbot-owned version. Remedy: capture fresh lecturer and student
  states from the KB-owned branch at mobile and desktop widths.
- **The deployment primary checkout looks reusable.** Cause: it is on an
  unrelated branch, far behind `origin/main`, with unrelated untracked files.
  Remedy: leave it untouched; W4 belongs in the Catalyst repository.
- **A stale Catalyst checkout suggests W1 should start from an obsolete stack
  tip.** Cause: local `main` can lag merged PRs and later work. Remedy: fetch
  current `main` at W1 start, verify the merged ancestry, and integrate the
  complete graph-runtime history on top without replacing either ancestry; see
  ADR 0008.
- **Harness output looks machine-readable because the final line is regular.**
  Cause: it is still human text and does not record stage timing or failure
  structure. Remedy: W3 adds a schema-validated JSON report and JUnit export
  while keeping human output.

## Delivery topology

This roadmap is a release train, not one cross-repository branch.

| Milestone | Work packages | Parallelism | Exit gate |
| --- | --- | --- | --- |
| M1 — code readiness | W1 Catalyst graph worker, W2 Klicker stack, W3 AI-ingestion reconciliation and transfer contract | W1, W2, and W3 may proceed in parallel after their own base checks; one writer per repo | W1 and W2 are reviewed, green, and contract-compatible; W3's generic provider changes and transfer ledger are accepted. Catalyst parity and temporary-harness retirement remain W5/M2 work; no deployment yet |
| M2 — staging platform | W4 staging GitOps, W5 deployed synthetic E2E | W5 waits for W1–W4 | Two consecutive clean staging system runs, cleanup verified, alerts and rollback exercised |
| M3 — quality and lecturer beta | W6 real-model quality learning, W7 production rollout | W6 starts after W5 has stable artifacts and continues during beta; W7 does not wait for W6 to open the initial labeled beta | Explicit production authorization, disabled deployment healthy, internal canary accepted, lecturer beta enabled; W6 evidence gates later widening |

### Stack Gate 1 — Catalyst W1 topology

Closed on 2026-08-15. In GitHub, [Catalyst PR #2](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/2)
merged as `8f46d58b8` and
[Catalyst PR #3](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/3)
merged as `98a69f7a1`. Fetched `origin/main` was `37657ad2d`, later merged
work is present, and the native stacks API reports no current stack objects.
W1 therefore starts from the latest fetched Catalyst `main` and is delivered as
an ordinary PR/package. It does not pin the former PR #3 commit or create a
replacement stack. W1 inventories the imported history first; whether its own
changes need an internal split is decided from that inventory and the resulting
review size before implementation is packaged.

Klicker W2 retains the existing five-package GitHub stack shape:

1. platform refresh ingestion event;
2. KB-owned graph model and reader;
3. graph lifecycle, external manifest contract, and retention;
4. lecturer controls and viewer;
5. student chat viewer.

Before publishing or changing that topology, verify native GitHub stack support
and run `$rs-stacked-change` migration planning. If native stack support is not
available, stop and ask for approval to use ordinary PRs; never hand-roll a
stack. Each layer must be independently green, reviewable, and safe to land.

## Feature-wide test portfolio

| Consequential risk | Existing protection | Test obligation | Primary stable seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Klicker and graph worker disagree on payload or result shape | TypeScript and Pydantic tests exist independently | Add new | Versioned JSON Schema plus representative producer payload and consumer result fixture | One repository deploys a contract the other rejects | W1, W2 |
| A graph build reads content different from the pinned digest | Unit tests cover pinned hashes | Extend existing | External manifest extraction and source hash verification | Late source refresh silently changes the graph being published | W1, W2 |
| Klicker migrations fail or make rollback impossible | Prisma schema and migration files exist | Add new | Disposable PostgreSQL migration from target base plus old-app/new-schema compatibility smoke | Production migration fails, or rolling back the app crashes on the new schema | W2 |
| Harness mutates an unready or wrong Hatchet namespace | Harness preflight and namespace tests exist | Extend existing | Harness mode/preflight contract | Upload happens before the correct ingestion and graph workers are eligible | W3 |
| pgvector contains the wrong resource/version or malformed embeddings | Harness pgvector assertions exist | Extend existing | PostgreSQL query over fixture resource metadata and vector dimension | Graph rebuild uses stale or unrelated indexed content | W3, W5 |
| Published graph is unrelated to the fixture | Resource references, digest, counts, and optional marker exist | Extend existing | GraphQL published build plus FalkorDB and GraphML provenance | An old non-empty graph makes the run look green | W3, W5 |
| Failed automation leaks resources or graphs | Success-only cleanup is verified | Add new | Synthetic-run labels and bounded TTL sweeper | Repeated failures consume storage, quota, or graph names | W3, W5 |
| Lecturer or student can read an unauthorized graph | Focused auth tests exist | Extend existing | GraphQL authorization and chat route integration tests | A graph leaks across KB, chatbot, owner, or participant scope | W2 |
| Lecturer controls or Patrick's visualizations regress | Focused component and route tests exist | Extend existing | Real browser against the integrated local stack | Build action, stale state, Cytoscape rendering, or accessible fallback is unusable | W2 |
| Graph worker cannot be operated safely | Hatchet task logs and local spans exist | Add new | Worker health, shutdown, metrics, and deployment smoke | Worker receives jobs before ready, drops an active job, or fails silently | W1, W4 |
| FalkorDB state cannot recover after pod/data loss | GraphML export exists | Add new | Restore one published build from its GraphML artifact and repoint only after verification | A serving outage becomes permanent despite retained artifacts | W4, W5 |
| AI graph is non-empty but educationally wrong | No production-grade quality suite | Add new | Committed DeepEval dataset plus deterministic graph metrics | Unsupported concepts, wrong relations, missing citations, or source leakage pass system E2E | W6 |
| Rollback starts new builds or drops the last good graph | Build pointers and polling tests exist | Add new | Staging kill-switch and rollback drill | Failed release keeps dispatching or removes the last published graph | W5, W7 |
| FalkorDB cleanup deletes durable graph history | Retention intent exists in ADR 0007 | Add new | Maintenance policy over retired graph names and GraphML archive keys | Operational graph retirement incorrectly purges an archive still retained by its KB | W2, W4, W5 |

## Work items

### W1 — Make the graph worker a production adopter

**Problem:** `kg-content-generation` implements the pinned-source and GraphML
contract but still declares the worker research-only. Its pipeline builds an
image without first proving the code or publishing an immutable release input.

**Working context:** source work currently lives in
`/Users/rschlae/Git/ai/kg-content-generation` on
`feat/kb-graph-manifest-contract`. The destination is the planned internal
`/Users/rschlae/Git/klicker/klicker-uzh-catalyst` checkout of private GitHub
repository `uzh-bf/klicker-uzh-catalyst`. PR #2 and PR #3 are merged, and
fetched `origin/main` was `37657ad2d` on 2026-08-15 with later merged work.
Start from the latest `main` at execution time. Import the complete
`kg-content-generation` history after auditing it for secrets and private data,
preserving both commit graphs, then refactor in Catalyst. Preserve the source
repository and branch until the destination validates its complete history and
file coverage; see ADR 0008 and Stack Gate 1.

**Do:**

1. Create and review the W1 sliced-development plan. Fetch current Catalyst
   `main`, verify that the merged PR #2/PR #3 ancestry and later mainline work
   remain reachable, and record the exact start tip. Audit the complete source
   history for secrets and private data before import. Produce a coverage ledger
   for commits, authorship, dates, graph assets, and expected paths; integrate
   the history without squashing or rewriting either ancestry; and prove the
   source tip, selected Catalyst base, and Patrick-authored commits remain
   reachable. Reconcile the imported graph history with current graph `main`
   before refactoring, without changing the Klicker payload contract.
2. Add blocking check and test jobs using the repository's pinned uv
   environment. Every MR and protected-main image build must depend on them.
3. Define the separate KB graph input/result contract from the provider-side
   Pydantic model and emit one versioned JSON Schema. W2 owns the Klicker
   consumer acceptance fixtures and settlement interpretation; W1 owns the
   provider-side metered-cost semantics keyed by the Klicker-generated
   graph-build ID, including one unambiguous monetary unit and enough provider
   usage detail for audit without exposing credentials. This is distinct from
   Catalyst's existing public chat-engine contract-generation gate. Add a
   `contract_version` only if backward compatibility cannot be enforced from
   the existing shape without it.
4. Replace deployment reliance on mutable `latest` with commit and digest
   output. Keep MR image builds no-push and prove the protected-main digest is
   pullable before it becomes deployable.
5. Add an explicit production worker entrypoint contract: startup config
   validation, Hatchet registration readiness, graceful termination, bounded
   in-flight behavior, and secret-safe structured logging carrying build ID,
   KB ID, and Hatchet run ID.
6. Expose the smallest useful health and metrics surface: worker readiness,
   build counts by terminal class, stage duration, active jobs, and last
   successful registration. Avoid a new telemetry stack; use the platform's
   existing Prometheus/OpenTelemetry conventions.
7. Run one local Hatchet workflow through pinned source verification, graph
   creation, FalkorDB export, GraphML upload, and terminal summary. The smoke may
   use synthetic inputs but must run the production worker entrypoint.
8. Update the README classification and operator documentation only when the
   production-adopter checks are true.

**Check:**

- Full graph test/check loop passes from a clean checkout.
- MR pipeline fails if the graph workflow tests are intentionally broken.
- MR build is no-push; protected-main build emits a valid immutable digest.
- Malformed, version-incompatible, or hash-mismatched payloads fail before
  graph mutation.
- History and file-coverage evidence accounts for every expected source commit,
  author, date, graph asset, and path; the pre-import source and Catalyst tips
  remain reachable.
- A representative terminal result binds metered cost to the expected graph
  build ID and rejects missing, malformed, or mismatched cost identity.
- SIGTERM readiness/shutdown smoke retains a clear terminal or retryable job
  state.
- Local workflow produces one non-empty graph and GraphML artifact with the
  expected build ID and no credentials in logs.

**Depends on:** the latest fetched Catalyst `main` at W1 start, with its merged
history preserved. It has no W2, W3, or credential-architecture dependency.

**Priority:** P1.

### W2 — Finish and package the Klicker KB graph stack

**Problem:** the KB-owned model, lifecycle, and Patrick-derived viewers are
present, but the migrations and full integrated UX have not run against a
production-like local stack. The branch also needs a safe reviewer-facing stack
topology before publication.

**Working context:** reuse
`/Users/rschlae/Git/klicker/klicker-uzh/trees/kb-graph-stack` and the existing
`feat/kb-graph-lifecycle` lineage. Base remains the current approved `kb-poc`
stack until its owner changes it. Preserve parked branches and PRs.

**Do:**

1. Create and review the W2 execution plan. Fetch and compare `kb-poc`, the
   parked graph branch, and every existing W9 layer before any rebase or stack
   migration. Create recovery refs before cascading changes.
2. Verify or establish the five-package stack in the delivery-topology section.
   Keep Patrick-authored commits and merge ancestry intact. Generated GraphQL,
   Prisma, and lockfile changes belong with the layer that requires them.
3. Apply both graph migrations to disposable PostgreSQL created from the real
   W9 base. Verify current-app/new-schema and previous-app/new-schema behavior;
   rollback never drops the new graph tables or columns.
4. Add a dedicated graph-build kill switch. Disabled means no new graph
   dispatch from GraphQL or workers while existing published graphs remain
   readable. Keep it separate from `KB_INGESTION_DISABLED`.
5. Add the lecturer beta eligibility flag as a capability gate and a separate
   per-KB graph opt-in. Eligibility alone must not enable graphs on any KB.
6. Validate graph-worker configuration in the general worker and graph-reader
   configuration in GraphQL. Partial configuration must fail startup or Helm
   rendering; completely absent configuration keeps the feature disabled.
7. Keep credential-facing behavior outside this package until the generic AI
   credential architecture and consumer contract are approved. Non-credential
   product state, quota state, disabled configuration, and contract checks may
   proceed; do not add provider credential submission, selection, resolution,
   or status UI by inventing a KG-specific path.
8. Validate the versioned graph payload/result fixtures from W1 in Klicker CI
   and lock the consumer-side acceptance and settlement interpretation to that
   schema.
9. Implement the graph-cost ledger at the dispatch and reconciliation seams.
   Reserve the estimated maximum atomically in integer minor units before
   dispatch, reject requests above the remaining semester quota or per-build
   maximum, and settle the Catalyst-reported actual cost idempotently by graph
   build ID. Duplicate terminal results must not charge twice; invalid,
   mismatched, or over-reservation results fail closed for review; unused
   reservation is released only through the same settlement transition. Show
   estimated maximum cost, remaining quota, and worst-case balance before
   dispatch, then actual usage and cost after settlement.
10. Run the actual local integration with the current graph worker, FalkorDB,
   Blob/Azurite, doc-processing, and Hatchet. Exercise success, stale-digest late
   success, timeout, failure, and retention of one unreferenced graph.
11. Use `agent-browser` on the live branch. Capture lecturer empty/building/
   published/stale/failure states and student available/unavailable states at
   mobile and desktop widths. Confirm Patrick's Cytoscape presentation and the
   accessible DOM fallback.
12. Run union verification against Patrick's parked range and explain every
   deliberate difference. Obtain per-layer review and CI before Gate 3.

**Check:**

- Disposable migration chain applies cleanly from the target base.
- Focused Hatchet, knowledge-graph, GraphQL, chat, and component suites pass.
- Workspace check, affected lint, generated-code checks, chart lint/render, and
  production build pass at every stack layer.
- Kill-switch test proves dispatch is rejected while the last published graph
  remains readable.
- Concurrent reservation tests prove the semester and per-build limits cannot
  be oversubscribed. Duplicate, late, malformed, mismatched-build, and
  over-reservation terminal results prove settlement is idempotent and fails
  closed without double charging or silently releasing quota.
- Pre-dispatch and settled lecturer states show the required estimate, balance,
  billing label, actual usage, and cost without exposing credential or billing
  account data.
- Browser screenshots show all named lecturer and student states and contain no
  real user or course data.
- `git log` still attributes Patrick-authored work to Patrick and the parked tip
  remains reachable.

**Depends on:** W1 contract and metered-cost result semantics for final contract
and settlement checks. Migration, kill-switch, quota-state, local component
checks, and stack preparation may proceed in parallel with W1. Credential-facing
UI and runtime binding remain blocked on the separately approved generic AI
credential architecture and consumer contract.

**Priority:** P1.

### W3 — Restore the AI ingestion boundary and hand off KG E2E

**Problem:** the temporary harness in data-ingestion proved valuable KG safety
and provenance behavior, but data-ingestion is an AI infrastructure provider,
not a Klicker or Catalyst component. The branch must preserve generic ingestion
improvements while transferring graph-system ownership to Catalyst.

**Working context:** reuse `/Users/rschlae/Git/ai/data-ingestion` and
`rs/kb-pgvector-graph-e2e`. Preserve the unrelated untracked Vorkurs files and
Mensa roadmap. Target `main`.

**Do:**

1. Create and review the W3 execution plan. Fetch, record a recovery ref, and
   reconcile with current `origin/main`. Resolve overlapping workflow timeouts
   semantically and drop duplicate work already present upstream.
2. Inventory every branch change as one of: generic AI ingestion improvement,
   Catalyst KG E2E behavior, or unrelated/duplicate upstream work. Record a
   source-to-destination coverage ledger before moving code. For every
   graph-specific behavior, name the observable guarantee, stable assertion
   seam, source path, and intended Catalyst owner; numeric test-count parity is
   not the transfer contract.
3. Keep only independently justified generic ingestion improvements in an AI
   infrastructure MR. Data-ingestion may expose test-safe provider contracts,
   status, and observability needed by consumers, but it does not import
   GraphQL, FalkorDB, GraphML, viewer, or Catalyst lifecycle concepts.
4. Produce the accepted transfer contract for graph-specific harness behavior,
   tests, and evidence. W5 owns the Catalyst port and retirement decision.
   Preserve authorship and history where practical; never keep two active
   copies after Catalyst reaches ledger-defined parity.
5. Define the provider-facing E2E contract Catalyst can use without owning the
   service: source mutation, terminal ingestion identity, active vector/version
   evidence, readiness, and cleanup evidence. Prefer supported API or read-only
   observability over direct production database coupling.
6. Keep ingestion and graph Hatchet namespaces atomic and separate. Catalyst
   may observe the ingestion workflow but never starts, stops, deploys, or
   reconfigures AI infrastructure in deployed environments.
7. Run the full repository verification loop. Diagnose the two prior CI-release
   rehearsal timeouts; either fix a proven branch interaction or record a
   reproducible unrelated baseline with current-main evidence.

**Check:**

- A coverage ledger accounts for every harness and launcher change and names its
  Catalyst destination or AI-infrastructure disposition.
- `uv run poe check`, shell syntax, non-E2E ingestion tests, and applicable E2E
  tests pass on the reconciled branch.
- The AI infrastructure MR contains no Catalyst, FalkorDB, GraphML, or Klicker
  product orchestration.
- The transfer ledger gives W5 a stable assertion seam and acceptance evidence
  for every graph-specific behavior before the temporary data-ingestion copy is
  retired; raw test counts are recorded only as historical evidence.
- Logs and artifacts in both repositories contain no injected test secret,
  signed URL, DSN password, source-gateway key, or fixture source text.

**Depends on:** none for generic base reconciliation, provider improvements,
and the transfer ledger. The temporary source remains until W5 accepts the
ledger-defined Catalyst parity, but that later retirement does not block W3 or
M1 completion.

**Priority:** P1.

### W4 — Deploy the staging graph serving projection through GitOps

**Problem:** no declarative staging owner exists for the graph worker or
FalkorDB. Application code cannot be promoted until runtime ownership,
networking, storage, secrets, resources, and rollback are explicit.

**Working context:** use the Klicker-owned internal KB graph runtime repository
selected in the decision gates. Do not add the runtime to the AI infrastructure
deployment repository. The exact path, existing-versus-new repository choice,
base, branch, and target must be recorded before W4 starts.

**Do:**

1. Apply the closed runtime-repository and durability rulings. Create and
   review the W4 execution plan. State the
   exact namespaces, Kubernetes ownership, secret syncs, storage class,
   recovery target, and blast radius before manifests are written.
2. Add a staging-only FalkorDB package to the internal runtime repository with
   no public ingress, resource requests/limits, health checks,
   disruption/update behavior, and NetworkPolicies allowing only the graph
   worker and authorized Klicker readers. FalkorDB storage may be ephemeral or
   opportunistically persistent, but recovery must not depend on its volume.
3. Add a staging graph-worker package using W1's immutable digest. Wire the
   Klicker-owned runtime to AI infrastructure services such as Hatchet,
   doc-processing, Blob, and the model gateway through explicit service
   contracts and runtime secrets. Use a dedicated service account and least
   privilege.
4. Wire Klicker staging GraphQL and the general worker to FalkorDB and the graph
   Hatchet namespace. Keep the graph-build kill switch enabled.
5. Add Prometheus scraping and alerts for no eligible worker, sustained build
   failure, build timeout, retention failure, FalkorDB unavailability, and
   storage pressure. Alerts must carry environment and service, never source
   URLs or credentials.
6. Add a GraphML-to-FalkorDB recovery job or documented one-shot command that
   validates graph identity and counts before changing the published pointer.
   Archive every completed GraphML artifact while its KB exists, retain it for
   30 days after KB deletion, and then purge it under ADR 0007.
7. Render and validate manifests locally. Deployment and cluster verification
   happen only after a separate explicit approval.

**Check:**

- Kustomize build and repository validators pass from a clean checkout.
- Rendered objects contain pinned image digests, non-root/least-privilege
  settings where images support them, resource bounds, probes, and restrictive
  NetworkPolicies.
- No secret values or external credentials appear in rendered or committed
  manifests.
- With separately authorized cluster access, pods become ready, the graph
  workflow has an ACTIVE eligible worker, FalkorDB accepts only authorized
  connections, and alerts are healthy.
- Recovery drill restores one synthetic GraphML build into a new graph name and
  verifies it before publication.

**Depends on:** W1 image and W2 configuration contract. Deployment remains
separately gated on explicit cluster authorization.

**Credential gate:** manifest authoring, rendering, and a separately authorized
disabled deployment do not wait for the generic credential architecture.
Binding provider-bearing runtime configuration or enabling model-backed work
does.

**Priority:** P1.

### W5 — Establish the deployed staging E2E release gate

**Problem:** local component checks cannot prove deployed DNS, identities,
secrets, network policy, worker registration, storage, application migration,
or cleanup. A single repeatable staging journey must become release evidence.

**Working context:** Catalyst owns this KG-system gate and the temporary-harness
retirement decision. Port the reusable safety, provenance, correlation, timeout,
and cleanup behavior from the accepted W3 transfer ledger. Keep only
provider-contract and internal ingestion tests in AI infrastructure.
Configuration and run history remain outside public repositories.

**Do:**

1. Implement every graph-specific behavior in the accepted W3 transfer ledger
   at a stable Catalyst seam, preserving authorship and history where practical.
   Record behavior-level parity evidence. Retire the temporary data-ingestion
   copy only after that evidence is accepted and no active consumer depends on
   it; do not use equal test counts as proof of parity.
2. Provision the selected dedicated non-human staging identity and synthetic KB
   through supported application/admin paths. Give it only the permissions
   needed to own and mutate that KB.
3. Configure protected runtime inputs for the GraphQL token/token file, KB ID,
   the AI-ingestion consumer credentials and read-only evidence contract, graph
   Hatchet read credentials, FalkorDB assertion credentials, and GraphML
   artifact access. Catalyst treats AI infrastructure as a deployed provider;
   report input names and status, never values.
4. Run read-only preflight first. Enable the graph-build kill switch only for
   the synthetic owner/KB if the product supports scoped rollout; otherwise use
   the environment switch during a controlled window.
5. Run the exact journey: upload deterministic text → confirm → external
   ingestion → active pgvector rows → graph rebuild → published digest and
   source reference → GraphQL viewer read → FalkorDB counts → GraphML counts →
   resource cleanup → zero active vector rows.
6. Run it twice from clean synthetic state. A fix invalidates earlier evidence;
   rerun twice after the final change. No blanket CI retry counts as a second
   run.
7. Exercise failure evidence once by disabling or isolating the CI-only graph
   worker in a controlled staging drill. Prove the job fails before publication,
   writes usable IDs, and the TTL sweeper later removes only the synthetic
   residue.
8. Exercise rollback: disable new builds, roll back the graph worker or app to
   the previous compatible version, and prove the last published graph remains
   readable. Restore forward without deleting graph schema.
9. Make post-deploy and nightly staging jobs emit JSON, JUnit, selected Hatchet
   log links or IDs, and an artifact manifest with every tested image digest.

**Check:**

- Two consecutive successful staging reports exist for the same exact
  component digests, each with verified cleanup.
- Every graph-specific W3 ledger entry has behavior-level Catalyst evidence,
  and the retired source leaves no second active KG-system harness in AI
  infrastructure.
- Resource ID, ingestion attempt, graph build, graph name, GraphML key, and both
  Hatchet runs can be correlated from the report without a secret.
- Controlled dependency failure stops publication and produces a stable failure
  class.
- Rollback drill preserves the last published graph and stops new dispatch.
- Alerts fire in the controlled failure and resolve after recovery.

**Depends on:** W1–W4 and the accepted W3 transfer ledger. Provisioning the
already-selected synthetic identity is an execution prerequisite.

**Credential gate:** Catalyst code/contract parity and separately authorized
read-only preflight may proceed before the generic AI credential design closes.
Provider-bearing configuration and any model-backed or paid staging mutation
wait for the approved generic credential architecture and consumer contract,
plus their normal deployment and spend authorization.

**Priority:** P1.

### W6 — Add a separate real-model graph quality gate

**Problem:** deterministic E2E proves system behavior but only checks graph
presence and provenance. Production needs repeatable evidence that real model
outputs are source-grounded and useful without making non-deterministic paid
tests block ordinary MRs.

**Working context:** Catalyst owns graph-quality evaluation because it owns the
KG output and release claim. Reuse generic DeepEval conventions where useful,
but do not place KG metrics, goldens, or release gates in `data-ingestion`.
AI-infrastructure evaluations remain limited to provider quality. Start the
Catalyst work after W5 produces stable staging artifacts.

**Do:**

1. Run the DeepEval intake before writing application or eval code: judge model,
   dataset source, tracing, and iteration count. Keep reports local at first;
   hosted reporting requires a separate data-boundary approval.
2. Create a committed, non-personal dataset of approximately 30–50 reviewed
   goldens from approved source documents. Reuse an existing dataset if one
   meets the contract; otherwise generate through `deepeval generate` and have
   a domain reviewer validate it before thresholds become release gates.
3. Add deterministic metrics first: required source references, no references
   outside the manifest, expected anchor concepts/relations for stable fixtures,
   connectedness bounds, duplicate rate, and empty/degenerate graph rejection.
4. Add three to five DeepEval metrics in a separate metrics module. Start with
   custom `GEval` criteria for concept correctness, relation correctness, and
   source-grounded claims; add citation coverage or hallucination-sensitive
   measures only when the dataset supplies their required fields.
5. Trace the real graph build at useful stages when approved. Keep the system
   run and judge run identifiers separate so a judge failure cannot look like a
   graph-worker failure.
6. Run `deepeval test run` through the repository's eval task. Store local CI
   artifacts by default; use hosted reporting only after its data boundary is
   approved.
7. Establish thresholds from baseline runs and domain review. Never lower a
   threshold or delete a failing golden merely to obtain green CI.
8. Run the quality gate nightly once stable during beta and before beta widening
   or general availability. Ordinary MRs run deterministic contract tests only.

**Check:**

- Dataset and metrics are inspectable, versioned, contain no student or real
  lecturer data, and can be rerun without an agent.
- At least one deliberately unsupported concept or relation fails the grounding
  criteria.
- Repeated baseline runs report score variance and model/judge versions.
- The release report distinguishes deterministic failures, graph-model quality
  failures, and judge/eval infrastructure failures.
- Approved thresholds pass for the exact model configuration proposed for the
  beta before that beta widens or becomes generally available.

**Depends on:** W5 stable staging artifacts. It does not gate the initial
labeled beta; it gates beta widening, general availability, and quality claims.

**Priority:** P2 during the initial beta; P1 before widening it, general
availability, or claiming graph quality.

### W7 — Roll out production disabled, then open the public lecturer beta

**Problem:** production activation combines schema, application, worker,
FalkorDB, identity, model cost, and user-facing behavior. It needs a reversible
sequence that preserves the last published graph at every step.

**Working context:** after W4 merges, create the production package in the
Klicker-owned internal KB graph runtime repository. Klicker application
configuration travels through its normal v3 deployment flow. Every cluster
action and production mutation requires explicit authorization.

**Do:**

1. Apply the closed canary ruling when creating and reviewing the W7 rollout
   plan and rollback runbook. Pin the exact W1 graph image, W2 Klicker
   revision/chart, W5 gate revision, W4 manifest lineage, and currently tested
   model configuration.
2. Deploy production FalkorDB and graph worker with the graph-build kill switch
   enabled. Verify infrastructure health and worker eligibility without a graph
   mutation.
3. Apply Klicker migrations through the normal migration path. Deploy the
   compatible app and general worker with graph dispatch disabled. Verify
   existing KB ingestion and non-graph chat behavior.
4. Run the W5 read-only production preflight. Do not reuse staging identities,
   KBs, tokens, graph names, or storage paths.
5. Enable graph builds for two allow-listed internal lecturers, one using BYOK
   and one using a UZH-issued key, with one opted-in KB each. Require two clean
   builds per KB, exercise rollback and GraphML restore once, and observe the
   exact deployment for 72 hours under a fixed canary cost cap. After the
   canary passes, expose self-service beta activation through the product. The
   global kill switch remains available for immediate rollback.
6. Trigger the minimum approved real builds through the lecturer product flow.
   Verify status, publication, viewer behavior, costs, retention, logs, and
   alerts. The canary succeeds only after the agreed number of clean builds and
   no orphaned active build, resource, vector, graph, or artifact state.
7. Roll back immediately on authorization leakage, digest/provenance mismatch,
   repeated terminal failure, unbounded cost, retention failure, or inability
   to disable new dispatch. Rollback disables dispatch first and preserves the
   last published graph and new schema.
8. Open the public beta after the internal canary. A lecturer who activates the
   feature becomes eligible to opt individual KBs into graph generation. An
   opted-in KB can build only after the lecturer accepts the cost disclosure,
   supplies the approved credential, and remains under both the semester quota
   and per-build cap. Before dispatch, the UI shows estimated maximum cost,
   remaining quota, and worst-case resulting balance; after settlement it shows
   actual usage and cost. BYOK is labeled provider-billed. A UZH-issued
   credential additionally requires the manual cost-account association and is
   labeled semester-billed. Klicker stores no sensitive billing information.
   Students bound to that opted-in KB can use the viewer after a graph publishes;
   other KBs expose no student graph.
9. Decide separately whether to authorize an ongoing production synthetic
   mutation. Until then, production automation remains read-only and real
   canary builds are explicit human operations.

**Check:**

- Disabled production deployment is healthy and causes no graph mutation.
- Migrations and rollback-compatibility smoke pass.
- Read-only production preflight passes with exact deployed component versions.
- Approved internal builds publish the expected digest and remain readable
  after dispatch is disabled.
- Rollback procedure is executed in a controlled canary drill and leaves no
  active build slot or broken published pointer.
- General availability occurs only after W5 and W6 evidence, all mandatory
  review gates, and explicit user authorization.

**GATED on:** explicit production authorization and an approved generic AI
credential architecture plus consumer contract before any provider-bearing
canary mutation or beta activation. Disabled infrastructure and a separately
authorized read-only production preflight may proceed earlier. Depends on
W1–W5. W6 runs during the beta and gates widening or general availability.

**Priority:** P1 for production release.

## Decision gates

These decisions do not block writing or reviewing the roadmap. They are hard
stops for the named work items. Record each ruling here with its date and mark
it closed; later agents must not reopen closed rulings.

| Decision | Options and effect | Recommendation | Gates |
| --- | --- | --- | --- |
| First production promise — **closed 2026-08-10** | Internal pilot; lecturer beta; or general availability | **Ruling:** public lecturer beta after an internal canary. It is self-service with explicit cost disclosure and a hard spending cap; student access is limited to beta KBs with a successfully published graph | W7 |
| FalkorDB durability — **closed 2026-08-10** | Ephemeral and reconstruct on loss; persistent database plus GraphML recovery; or high availability | **Ruling:** FalkorDB is reconstructible on operational issues. A clean archive of completed GraphML artifacts is the durable recovery source from the first release; see ADR 0002 | W4, W5 |
| System ownership boundary — **closed 2026-08-10** | Keep KG orchestration in AI infrastructure; split it across service repositories; or put the KG system in Catalyst | **Ruling:** Klicker owns KB product state, authorization, quota enforcement, and lecturer/student UX. Catalyst owns graph generation, FalkorDB, GraphML archive, KG quality evaluation, and KG-system E2E. AI infrastructure owns data-ingestion, doc-processing, and pgvector; Catalyst consumes their contracts without importing their code or operational lifecycle. See ADR 0003 | W1, W3–W7 |
| Runtime repository and history — **closed 2026-08-10; Stack Gate 1 closed 2026-08-15** | Import all `kg-content-generation` history; import a filtered production subtree with preserved authors; or take a clean snapshot | **Ruling:** the Klicker team owns private repository `uzh-bf/klicker-uzh-catalyst`. PR #2 and PR #3 are merged and later work is on `main`; W1 starts from the latest fetched `main` and uses an ordinary PR/package. Audit and integrate the entire `kg-content-generation` history before refactoring, preserving both repositories' ancestry plus Patrick's authorship, dates, and visualizations. Decide any internal W1 split only after the history and file-coverage inventory. AI infrastructure supplies selected services such as doc-processing but no AI-infrastructure provider code moves into Catalyst. See ADR 0008 and Stack Gate 1 | W1, W4, W7 |
| Synthetic staging identity — **closed 2026-08-10** | Static human lecturer credentials; dedicated non-human test owner using supported auth; or an application-specific service-account API | **Ruling:** dedicated non-human test owner created through supported auth/admin paths, scoped to one synthetic KB, with short-lived or regularly rotated credentials from the secret store. No E2E-specific auth bypass | W5 |
| Quality-eval timing, data, and reporting — **closed 2026-08-10** | Gate initial beta or learn during beta; existing or generated goldens; local or hosted reporting | **Ruling:** existing testing and the internal canary are sufficient to open the explicitly labeled beta. During beta, Catalyst versions 30–50 reviewed, non-personal goldens from approved or synthetic source documents and emits local DeepEval/CI artifacts. Quality evidence gates beta widening, general availability, and quality claims. Hosted reporting requires separate data-boundary approval. See ADR 0006 | W6, W7 |
| Beta activation — **closed 2026-08-10** | Lecturer flag enables every KB; per-KB opt-in only; or lecturer eligibility plus per-KB opt-in | **Ruling:** the public-beta feature flag grants the lecturer permission to enable knowledge graphs. Each KB remains opted out until that lecturer explicitly enables it. Students can use a graph only for an opted-in KB after publication | W2, W7 |
| Generic AI credential management — **open; delivery boundary closed 2026-08-15** | Per-feature custody; consumer-owned storage; or one reusable credential capability | **Ruling:** provider credentials are a generic concern for every AI capability, not a KG-specific Catalyst feature. KG, tutoring, content generation, grading feedback, and future AI services consume the same safe abstraction. Consumer applications keep only opaque handles and status; exact custody ownership and contracts are delegated to `~/.handoffs/klicker-uzh/2026-08-10-ai-credential-management-security-design-handoff.md`. While that architecture is open, W1, W3, non-credential W2, disabled W4 infrastructure, and separately authorized read-only preflight may proceed. Credential-facing UI, provider-bearing/model-backed or paid runs, canary mutations, and beta activation remain blocked | Generic platform design; credential-facing W2, provider-bearing W5/W7, canary mutation, and public beta |
| Graph-cost quota — **closed 2026-08-10; executable seams assigned 2026-08-15** | Build-count cap; token cap; monetary cap; or combined controls | **Ruling:** W1 defines actual metered-cost result semantics keyed by graph-build ID. W2 atomically reserves a per-build maximum against the lecturer's semester quota before dispatch, denies unaffordable work, settles valid terminal results idempotently, fails closed on invalid or mismatched results, and presents estimates and actuals. W7 validates those seams through the approved credential and billing paths. Quota data is non-sensitive and contains no billing account details. See ADR 0005 | W1, W2, W7 |
| Beta billing association — **closed 2026-08-10** | Klicker database; dedicated billing service; Catalyst registry; or manual external record | **Ruling:** for UZH-issued keys, keep the sensitive lecturer-to-cost-account association in a manually maintained spreadsheet. BYOK lecturers are billed by their own provider and need no internal billing association. Klicker stores no billing details and applies quota controls to both paths; later institutional integration is a separate decision | W7 |
| Production canary scope — **closed 2026-08-10** | Environment-wide switch; owner/KB allow-list; or separate canary deployment | **Ruling:** allow-list two internal lecturers, one BYOK and one UZH-issued, with one opted-in KB each. Require two clean builds per KB, one rollback and GraphML restore drill, 72 hours of observation, and a fixed canary cost cap before opening self-service beta behind the global kill switch | W7 |
| GraphML archive retention — **closed 2026-08-10** | Indefinite; while the KB exists; or fixed duration | **Ruling:** retain every successful GraphML version while its KB exists. After KB deletion, retain it through a 30-day recovery grace period and then purge it. Revisit long-term archival before general availability. See ADR 0007 | W4, W5, W7 |
| Lecturer cost display — **closed 2026-08-10** | Disclosure only; estimate before build; or estimate plus actual usage | **Ruling:** before dispatch show estimated maximum cost, remaining semester quota, and worst-case resulting balance. After settlement show actual usage and cost. Label BYOK as provider-billed and UZH-issued usage as semester-billed | W2, W7 |

## External dependencies to watch

| Dependency | Required outcome | Blocks |
| --- | --- | --- |
| AI-infrastructure ingestion contract | Stable source mutation, terminal ingestion identity, vector/version evidence, readiness, and cleanup contract without Catalyst controlling the provider runtime | W3, W5 |
| Generic AI credential architecture and consumer contract | Approved reusable custody, opaque-handle, safe-status, runtime-resolution, rotation, and revocation contract | Credential-facing W2; provider-bearing/model-backed W5 and W7; paid runs; canary mutation; beta activation. Does not block W1, W3, non-credential W2, disabled W4, or separately authorized read-only preflight |
| Current graph `main` and GitLab runners | Branch compatibility, test-capable runner, registry digest publication | W1 finish |
| Klicker `kb-poc` stack and GitHub stack support | Current base, preserved branch topology, per-layer CI | W2 publication |
| Doc-processing staging service | Exact health contract and successful extraction of synthetic source | W5 |
| Shared Hatchet environments | Dedicated eligible ingestion and graph workflows with read credentials for preflight | W4, W5 |
| Secret-store ownership | Runtime names for the Klicker-owned graph worker, FalkorDB, and E2E principal without exposing values | W4, W5 |
| Model gateway and budget owner | Approved model mapping, quota, and cost envelope | W6, W7 |
| Domain reviewer | Curated graph-quality goldens and threshold approval | W6 |

## E2E automation contract

| Layer | What runs | Cadence | Blocking policy | Durable evidence |
| --- | --- | --- | --- | --- |
| Repository contract | Harness tests; graph input/result schema; Klicker lifecycle, auth, migration, chart, and viewer tests | Every relevant MR/PR | Blocking for the owning package | Test/JUnit output, exact commit, schema version |
| Hermetic system smoke | Real GraphQL, Hatchet, pgvector, FalkorDB, Blob/Azurite, doc-processing interface, and CI-only deterministic graph workflow | Relevant main builds and release candidates | Blocking for release candidate; no paid model | JSON/JUnit report, component digests, run/resource/build IDs, cleanup |
| Deployed staging E2E | Real deployed services and standard-tier model, dedicated synthetic identity and KB | Post-deploy and nightly | Blocks production promotion; two clean runs after the final change | Redacted JSON/JUnit, Hatchet IDs, graph counts, digest, screenshots, alert/rollback drill |
| Model-quality eval | Real graph worker and model over curated goldens | During beta, nightly once stable, and pre-promotion | Does not block the initial labeled beta; blocks beta widening, quality claims, and general availability after thresholds are approved; not ordinary MRs | DeepEval report, dataset revision, model/judge versions, variance, failure samples |
| Production canary and beta | Read-only preflight on deploy; explicitly authorized internal product build; then self-service beta activation | Every graph-affecting deploy; mutation during approved canary and opted-in beta use | Stops beta opening or widening and triggers rollback | Deployed digests, migration result, build/pointer evidence, cost, alerts, rollback state |

### Reliability rules

- One run ID connects every report and supported log while product IDs retain
  their own meaning.
- Every stage has a bounded timeout inside one absolute run deadline.
- Assertions and mutations are never retried as a whole. A documented
  idempotent read may retry transient transport failures with a small bound.
- A scheduled job runs against one explicit environment; absence of that
  environment is a failure or skip with a named reason, never a fallback.
- Component images and application revisions are immutable inputs recorded in
  the report.
- Failure reports retain safe IDs and failure class. They exclude secrets,
  source content, raw GraphML, and signed URLs.
- Cleanup is an assertion. Success requires resource invisibility and zero
  active pgvector rows; TTL cleanup handles failure residues separately.
- Flakes are tracked by stable signature, owner, and expiry. A CI retry is not
  passing evidence, and the same failure twice requires diagnosis.
- System correctness and semantic quality remain separate gates with separate
  failure ownership.

## Deployment and rollback contract

### Staging order

1. Deploy FalkorDB and graph worker with graph dispatch disabled.
2. Verify storage, networking, secrets, worker eligibility, metrics, and alerts.
3. Apply Klicker migrations and deploy compatible app/worker configuration.
4. Run read-only preflight.
5. Run the two clean W5 synthetic journeys and failure/rollback drill.
6. Run W6 quality evaluation for the proposed model mapping.

### Production order

1. Deploy serving infrastructure disabled.
2. Apply additive migrations; deploy app and workers with dispatch disabled.
3. Verify existing non-graph paths and read-only graph preflight.
4. Enable only the approved canary scope.
5. Verify product-triggered builds, viewers, cost, retention, and alerts.
6. Disable dispatch first on any rollback trigger; preserve schema and last
   published graph.
7. Widen lecturer access, then student visibility, only through explicit gates.

### Rollback triggers

- Cross-owner or cross-KB authorization failure.
- Source digest, resource reference, graph name, or artifact provenance
  mismatch.
- Repeated terminal workflow failure or unbounded active build.
- Inability to stop new dispatch with the kill switch.
- FalkorDB data loss without successful GraphML recovery.
- Retention deleting an active/published graph or failing without an alert.
- Model cost exceeds the approved envelope or quality falls below the approved
  threshold.

### Rollback behavior

- Enable the global graph-build kill switch.
- Keep GraphQL and student reads on the last verified published graph when
  safe; disable viewer entry points if reader correctness is in doubt.
- Roll back worker/app images only to versions compatible with the additive
  schema. Do not drop graph migrations during incident rollback.
- Preserve failed build rows and redacted identifiers for diagnosis.
- Restore FalkorDB from the retained GraphML artifact into a new graph name,
  verify it, then repoint through the normal publication invariant.

## Cluster-level changes

The roadmap proposes, but does not authorize, these cluster changes:

- New Catalyst-owned staging and production FalkorDB workloads, storage, services, and
  NetworkPolicies.
- New Catalyst-owned staging and production graph-worker workloads, service accounts, secrets,
  metrics, and alerts.
- Klicker GraphQL/general-worker network access and configuration for graph
  Hatchet and FalkorDB.
- Optional recovery jobs and protected deployed-E2E runners.

Before implementation takes ownership, the W4/W7 plans must name existing
owners, namespaces, secret syncs, resource quotas, lifecycle, and blast radius,
and receive explicit approval. The agent never establishes cluster connectivity
or applies these resources without a separate instruction.

## Review and evidence expectations

At every W-item boundary, provide:

1. The reviewed item plan, repo/worktree/branch/target, and MR/PR link when one
   exists.
2. Exact commit or range, substantive human-authored size excluding generated
   files/lockfiles/project docs, and a generated-delta summary.
3. Fresh verification commands and results, including the negative check named
   by the W-item.
4. Required review reports under the repository's ignored `_local/reviews/`
   directory: risk-selected intermediate review when applicable, full-path
   security review, maintainability review, and exact-final-outcome capable
   review.
5. Test delta (`added / changed / removed`) with each test tied to a distinct
   consequential failure.
6. For UI: local URLs, mobile/desktop screenshots, auth route used, and manual
   browser findings.
7. For deployments: rendered manifests, exact image digests, policy validation,
   approved cluster action, rollout state, alerts, and rollback evidence.
8. An append-only Progress entry below. Never rewrite earlier evidence; append a
   correction that supersedes it.

No W-item is complete because its branch is clean, a component suite is green,
or a handoff exists. Completion requires its Check section and mandatory review
gates. No stack layer is ready for human review until its own CI is green and it
is independently safe to land.

## Progress

- 2026-08-10: Repository review completed across KlickerUZH, data-ingestion,
  kg-content-generation, and deployment. Current blockers are the absent full
  execute proof, graph worker's research-only deployment status, unreconciled
  data-ingestion base, unverified Klicker migrations/browser path, and missing
  graph GitOps ownership.
- 2026-08-10: Fresh local evidence: data-ingestion graph harness tests 33/33;
  `uv run poe check` green; graph workflow tests 38/38; relevant diff checks
  clean. The latest recorded complete data-ingestion run remains 1,283 passed
  and 54 skipped; a later full rerun had two CI-release rehearsal timeouts while
  the seven-case rehearsal subset passed alone.
- 2026-08-10: Draft roadmap written after the user explicitly deferred the
  planning-stage specialist review. This status is not plan approval and grants
  no implementation, merge, push, deployment, paid-run, cluster, or production
  authority. Next step is human and capable-model review of this draft, followed
  by rulings on the decision-gate table.
- 2026-08-10: Grill round 1 set the release boundary to a lecturer beta, assigned
  the separate internal graph runtime to the Klicker team while retaining AI
  infrastructure services such as doc-processing, and selected a dedicated
  non-human staging E2E owner. The exact existing-versus-new runtime repository
  remains open for round 2.
- 2026-08-10: Grill round 2 made the lecturer beta public and self-service with
  cost disclosure, an API-key path, an external semester billing association
  where applicable, and a hard cap. Students can use graphs only for
  beta-enabled KBs after publication. The planned runtime home is the internal
  `klicker-uzh-catalyst` GitHub repository, possibly moving to GitLab later.
  FalkorDB is reconstructible; the GraphML archive is the durable recovery
  source from the first release.
- 2026-08-10: Live repository lookup confirmed
  `uzh-bf/klicker-uzh-catalyst` exists as a private GitHub repository with
  default branch `main`; its local checkout and remote contain no commits. No
  GitLab repository exists under that path. History migration must be decided
  before the first Catalyst commit.
- 2026-08-10: Grill correction closed the system boundary. Data-ingestion,
  doc-processing, and pgvector remain AI infrastructure; all knowledge-graph
  behavior, quality evaluation, and KG-system E2E belong to Catalyst, while
  Klicker owns the product state, authorization, quota enforcement, and user
  experience. Sensitive lecturer billing information stays outside the Klicker
  database; Klicker still owns non-sensitive graph quota state and enforcement.
- 2026-08-10: Grill round 3 selected a complete-history import into Catalyst,
  with refactoring only after authorship-preserving migration. The lecturer
  feature flag grants eligibility and each KB needs an explicit graph opt-in.
  Catalyst owns API-key custody at a high level; its detailed security design
  moved to a separate handoff. Klicker reserves and settles per-lecturer,
  per-semester monetary quota with a per-build maximum. The beta billing
  association for UZH-issued keys remains a manual spreadsheet outside Klicker;
  BYOK lecturers are billed by their own provider.
- 2026-08-10: Grill round 4 accepted the proposed quality dataset, production
  canary, GraphML retention, and lecturer cost display. Existing testing plus
  the canary is sufficient to open the explicitly labeled beta; the curated
  quality program gathers evidence during beta and gates later widening,
  general availability, and quality claims.
- 2026-08-10: The production-roadmap grill is complete. The only intentionally
  unresolved architecture decision is the detailed API-key security design,
  isolated in its indexed handoff. The roadmap remains an unapproved draft
  until its deferred planning-stage review and user approval.
- 2026-08-10: A fresh remote readback corrected the earlier empty-Catalyst
  assumption. Remote `main` has five scaffold commits, and clean stacked drafts
  PR #2 and PR #3 add operational verification and a stateless tutoring runtime.
  W1 must preserve that history and select a current stack base before
  integrating the complete graph-runtime history; ADR 0008 supersedes ADR 0004.
- 2026-08-10: The credential-security work was reframed from KG-specific
  Catalyst custody to generic AI credential management for every AI consumer.
  KG remains one consumer. The generic design handoff supersedes the narrower
  framing and is the only intentionally open architecture decision.
- 2026-08-10: Live delivery readback found no PR for local Klicker branch
  `feat/kb-graph-lifecycle`; parked PR #5206 remains an old draft with a
  GitGuardian failure. Graph-builder MR !3 remains open and mergeable at
  `c4a4236d` without an assigned reviewer, while its local branch is 11 commits
  ahead and 8 behind its remote branch. The data-ingestion harness remains a
  local-only branch at `a0fcd4f2`. Catalyst PR #2 and stacked PR #3 are clean,
  draft, and green. These states must be reconciled before any implementation
  branch is extended or published.
- 2026-08-15: Live repository reconciliation superseded the earlier Catalyst
  delivery snapshot. Fetched Catalyst `origin/main` is `37657ad2d`; PR #2 and
  PR #3 are merged, later merged work is present, and the native stack API
  reports no current stack objects. Stack Gate 1 therefore starts W1 from the
  latest `main` in an ordinary PR/package, with any internal split deferred to
  the W1 history inventory.
- 2026-08-15: The graph-builder branch and remote feature ref agree at
  `c4a4236d`; MR !3 is open and mergeable with a successful current pipeline,
  but its body cites stale commit and pipeline evidence. The data-ingestion
  harness is 16 commits ahead and 16 behind current `origin/main` with unrelated
  local changes preserved. The Klicker roadmap branch remains at `b348adeea`,
  133 commits ahead and 81 behind current `origin/v3`. No PR, MR, branch,
  runtime, or deployment state was mutated during this reconciliation.
- 2026-08-15: The previous proof containers and port `18081` listener are
  absent. `devrouter ls` still fails with `could not determine process identity
  for host route update lock`; no proof environment was recreated or repaired.
- 2026-08-15: The user accepted the planning-review corrections. Catalyst
  parity and temporary-harness retirement now belong to W5/M2; W1, W2, and W7
  own graph-cost result semantics, reservation/settlement, and rollout
  validation respectively; and the generic credential design explicitly blocks
  credential-facing or provider-bearing work while allowing W1, W3,
  non-credential W2, disabled W4, and separately authorized read-only preflight.
  The user then approved M1 execution. This authorizes local implementation
  work and its normal verification gates, but not merge, push, deployment, paid
  runs, cluster access, or production mutation.
- 2026-08-15: M1 base readback refreshed Catalyst `origin/main` to
  `37657ad2d5bfcfcd93a9f7f19c70470695944977`; the new repo-local W1 worktree
  `trees/kb-graph-production-adopter` is based exactly on that tip. The graph
  source fetch completed at `c4a4236d`, while the data-ingestion branch remains
  `a0fcd4f2` at 16 commits ahead and 16 behind current `origin/main`.
  Klicker linked-worktree and primary-checkout fetches are blocked by a shared
  Git metadata `FETCH_HEAD` permission error; current GitHub `v3` was verified
  read-only with `git ls-remote`. No existing dirty files were modified.
- 2026-08-16: Phase-5 boundary reconciliation records Catalyst W1 as reviewed
  at its authorized local delivery boundary. The Catalyst execution plan is
  `docs/project/2026-08-15-kb-graph-production-adopter-plan.md` on
  `rs/kb-graph-production-adopter` at `b1c7edd4e`; its graph checks pass with
  86 tests passing and one skipped, the formatting gate passes, and the exact
  integrated final review is clean. This is `reviewed` local evidence only —
  not `pr_ready`, merged, released, or live-proven delivery. Hosted CI, W2
  consumer compatibility, image build/run and registry-digest pullability,
  live Hatchet/dependency proof, and separately authorized publication, push,
  PR, deployment, and paid smoke remain open.
- 2026-08-16: The M1 sibling evidence is refreshed without changing the
  roadmap's existing W1/W2/W3 parallelism. Klicker W2 has a clean local
  final-review record through its current implementation tip, but disposable
  migration, required lecturer/student browser states, live-stack, and provider
  execution checks remain open. Data-ingestion W3's transfer ledger is at
  `48ba5ff093439b61f5d5165f42ddd8287089c436`; the later W2 record contains its
  exact final-review evidence, while the W3 plan still has stale final-review
  close-out bookkeeping. Catalyst parity and source retirement remain W5/M2
  work. M1 therefore remains in progress and no W4 staging action is implied.
- 2026-08-16: No hosted CI, image-registry publication, live service or
  cluster access, secret access, push, PR/MR mutation, merge, deployment, or
  paid model run was performed during this reconciliation.
- 2026-08-17: W2-C student-view browser evidence captured against the local
  stack; root cause of the earlier hydration hang was a stale
  `allowedDevOrigins: ['**.klicker.localhost']` in the worktree's
  `packages/next-config/index.js` (predates #5248), which blocked the HMR
  WebSocket for the four-label worktree host and left the app-router hydration
  decoder waiting on its debug channel forever. The worktree file now matches
  upstream (`['**.localhost']` in development, uncommitted). Evidence:
  `w2c-kb-graph-student-graph-unavailable-en-desktop.png` showing the
  graceful "temporarily unavailable" graph state (FalkorDB absent — partial
  evidence), plus contract readback proving the published binding resolves
  (build `20000000-...-0004`, isStale false) and fails on
  `KB_FALKORDB_HOST must be a non-empty value` (503), while an unbound
  chatbot throws `KnowledgeGraphNotPublishedError` code EMPTY (409). Dev
  caveat: Turbopack cannot load `@klicker-uzh/knowledge-graph` via
  `createRequire`, so the live dev API degrades all graph errors to 503;
  the 409 branch is proven by direct probe only.
