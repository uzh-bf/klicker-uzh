# Chatbot response examples implementation plan

## Identity

- Date: 2026-08-21
- Revised: 2026-08-22
- Ceremony: full path
- Status: K1 delivery is accepted at the reviewed boundary; K2 is the next
  dependency-clear slice
- Plan: `project/2026-08-21-chatbot-response-examples-implementation-plan.md`
- Current repository: `uzh-bf/klicker-uzh`
- Current branch: `feat/response-examples-foundation`
- Current worktree:
  `trees/chatbot-response-examples-design`
- Current base: `origin/v3-ai` at
  `198747502a81149c2f61bb3dcd097716bbe32244`
- Intended public target: refreshed `origin/v3-ai`
- Deferred private repository: `uzh-bf/klicker-uzh-catalyst`; no Catalyst
  change belongs to this milestone
- Pull requests: draft PR #5474
  (`feat/response-examples-foundation` -> `v3-ai`)
- Design: [chatbot response-example design](./2026-08-21-chatbot-response-example-design.md)
- Scope boundary: independent package; it is not part of the chatbot HITL
  roadmap, U1/M1, or any roadmap execution task

## Goal

Deliver the independently testable Klicker response-example product: canonical
owner-governed state, lecturer review, normal-chat skill delivery, and
single-variable evaluation against the same approved examples. Prove the whole
path with synthetic local fixtures while production selection stays empty.

The milestone ends with independently green draft layers and one local
end-to-end tracer. Grounded candidate generation, KB/KG integration, Catalyst,
deployment, live data, live model calls, and production activation remain a
separate milestone.

## Non-goals

- No second example set, revision history, approval workflow, expiry policy, or
  run-history UI.
- No Evaluation-repository adapter, DeepEval service, metric suite, weighted
  score, multiple judge models, or runtime quality gate.
- No new datastore, graph lifecycle, ingestion pipeline, provider, or
  lecturer-supplied generation credential.
- No production candidate source, automatic generation trigger, corpus/graph
  binding, real evidence validation, service callback, Catalyst change, or
  public candidate-seeding API.
- No factual-memory skill. Current course facts still come from authorized
  retrieval; examples demonstrate response behavior.
- No new multilingual-chatbot configuration. This milestone uses the exact
  locale resolved by the existing server-side chatbot and course context plus
  the chatbot's active modes; R0 verifies that source before K1 freezes it.
- No changes to the separate chatbot HITL roadmap or its branches, plans,
  tasks, pull requests, or delivery state.

## Execution contract

- Boundary owner: self
- Execution owner: this main session or a separately authorized peer main
  session acting as execution orchestrator
- Autonomy: after approval, execute the reviewed slices through the terminal
  condition without returning at routine slice, commit, review, or `Progress`
  boundaries
- One-time approval: approve this plan, four-layer public stack topology, exact
  draft publication branches, and the reversible local workflow below
- Conditional stack gate: report K1 foundation evidence once because it adds a
  migration and owner authorization. Matching evidence continues under this
  approval; pause only when it differs from the approved lifecycle, R0 remains
  unresolved, or the user directs a change.
- Authority: create or reuse the named repo-local worktrees; rename the current
  local design branch to `feat/response-examples-foundation`; create the exact
  four public stack branches listed below; edit in-scope files; generate
  repository-native artifacts; use synthetic local runtimes; run checks and
  browser verification; dispatch required read-only specialists; update
  `Progress`; and create scoped local commits
- Publication authority requested with approval: push the exact Klicker
  branches `feat/response-examples-foundation`,
  `feat/response-examples-review`, `feat/response-examples-runtime`, and
  `feat/response-examples-evaluation` to `origin`; create their draft pull
  requests against the approved stack bases
- Withheld: ready-for-review transitions, merge or queue, stack reorder or
  removal, force-push outside stack-aware synchronization, branch or worktree
  deletion, changes to PR #5424, deploy or GitOps changes, cluster access,
  secret writes, live course or personal data, live model calls, production
  proof, production candidate generation or activation, and changes in
  Catalyst, data-catalog, data-ingestion, mcp-doc-query,
  kg-content-generation, Evaluation, or chatbot HITL work
- Terminal: the four public layers are committed, published as drafts,
  independently green, reviewed, and covered by the local synthetic tracer.
  The plan records `delivery_pending` for KB/KG and Catalyst integration,
  production activation, deployment, live-provider qualification, and landing.
- Pause: refreshed `origin/v3-ai` lacks the owner, locale, chat, or local-runtime
  seams required by R0; synthetic candidate creation cannot remain confined to
  test/local seed infrastructure; a new datastore, provider, long-lived
  credential, deployment surface, or writable repository becomes necessary; a
  layer exceeds the size/topology guard; the required local runtime or
  specialist is unavailable; or evidence changes the approved scope, security
  boundary, or public behavior

## Settled product findings

- Evidence: the complete product rulings and vocabulary are in the linked
  design and ADRs 0028-0036.
- Decision: one canonical response-example set belongs to one chatbot; entries
  carry exact mode and locale scope.
- Decision: generation produces candidates. Only the chatbot owner can approve,
  edit and approve, or reject them. Approved edits are live immediately.
- Decision: the graph selects coverage and ingested chunks support every
  factual claim through source, chunk, hash, and citation lineage.
- Decision: normal runtime receives a bounded summary and can invoke exact-scope
  search for full examples. A load failure continues without full examples and
  records degraded selection.
- Decision: evaluation uses approved examples as references while excluding
  only response-example content from the otherwise unchanged runtime. The
  platform base model returns advisory `Pass` or `Needs attention` verdicts.
- Decision: Klicker owns canonical product state, authorization, runtime, UI,
  and the latest report. Catalyst owns only stateless private generation.
- Decision: current product state is retained. Source-bearing generation
  scratch is deleted at job termination, and only the latest evaluation report
  remains.

## Primitive impact

| Primitive | Disposition | Contract change | Consumers |
| --- | --- | --- | --- |
| Chatbot | extend | Compose one owner-governed response-example set and latest evaluation report | Manage, chat runtime |
| Response-example set | create | Canonical current-state aggregate, digest, bounded summary | owner API, runtime, evaluation |
| Response example | create | Candidate, Approved, Needs review, or Rejected entry with mode, locale, behavior, and lineage | review UI, search, evaluation |
| Knowledge-base graph publication | reuse later | Supply exact knowledge-base, graph-build, and source-content identities without a parallel lifecycle | deferred generator trigger and eligibility checks |
| Response-example search projection | create as derivative | Exact-scope projection whose production contents remain empty until evidence integration exists | model-invoked chat tool |
| Latest evaluation report | create as projection | One atomic, digest-bound advisory snapshot per chatbot | owner UI |

No existing primitive is retired. The Evaluation repository remains an
operator-facing later consumer, not a product primitive.

## ADR gate

- Decision: ADRs 0028-0036 pass the repository ADR gate and remain the durable
  rationale for run-scoped roles, manifest matching, hybrid delivery, live
  mutability, graph/chunk responsibility, model-invoked search, evidence
  eligibility, lineage retention, and the generation base model.
- Decision: no Catalyst ADR or plan is added in this milestone. The deferred
  integration package references these public decisions after its contract is
  proven against the landed graph lifecycle.
- Trigger: add a component-scoped Catalyst ADR only if implementation changes
  public/private ownership, requires a new long-lived service credential, or
  introduces a new generator runtime boundary.
- Trigger: add a public ADR only if implementation requires a different
  datastore, search provider, model provider, or lifecycle than the accepted
  decisions.

## Skill routing

- `grill-with-docs`: completed the product and architecture decision frontier.
- `rs-product-primitives`: used to keep canonical state, projections, and
  consumers distinct.
- `rs-sliced-development-workflow`: owns this full-path plan, tracer slices,
  test portfolio, reviews, commits, verification, and draft PR finish.
- `rs-stacked-change` with `gh-stack`: owns the approved public topology,
  non-interactive stack mechanics, per-layer checks, and Gates 1-4.
- `rs-model-routing`: owns every child route and the Sol planning fallback.
- `rs-local-runtime-lifecycle`: required when the Klicker DevPod or
  devcontainer starts, verifies, hands off, or stops.
- `rs-mr-description-writer`: required before each draft PR body is finalized.
- `writing-for-agents`: keeps the plan and deferred integration boundary
  concise, explicit, and agent-executable.

## Research

### Authoritative snapshot

| Repository or branch | Revision or state | Finding |
| --- | --- | --- |
| Klicker `origin/v3` | `f58986faa8cfa4ff78d20a1ebeb1666473343d38` | Current design-worktree base; 0 ahead and 0 behind after the 2026-08-22 refresh |
| Klicker `origin/v3-ai` | `198747502a81149c2f61bb3dcd097716bbe32244` | Intended implementation base; chatbot ownership, PostgreSQL, Manage GraphQL/UI, chat runtime, and `KB_doc_query` handling exist without response-example state |
| Klicker PR [#5424](https://github.com/uzh-bf/klicker-uzh/pull/5424) | open to `v3-ai`, `UNSTABLE`, GitGuardian failing | Contains candidate KB/graph ledger, publication, scope-token, and callback seams inside a broad unfinished `v3-ai` change; unsafe as a raw base |
| Catalyst `origin/main` | `18380d188f3d582eb174e27f51ef120a0da6ba23` | `apps/content-generation` is an empty module that asks its first implementation to prove one generation-and-validation flow |
| Evaluation `origin/main` | `b2f94c1233588f167836c3f1e012b3999e5406ef` | Existing expected-answer and tool-policy formats are a later offline fit; no product lifecycle or lecturer metadata |
| data-catalog `origin/main` | `2b6231a3fe49c994d82e003b63e589e8bfe8e8c` | Digest-bound catalog run manifests exist |
| data-ingestion `origin/main` | `4520e90efb72496a6c2dace31350faa2b03e7ed8` | Deterministic source, document, chunk, and content-hash identity exists |
| mcp-doc-query `origin/main` | `bb2aba791520cd14f93635defd6b62b5a5d0799c` | Authorized retrieval-only chunks and citation metadata exist; recent changes add optional freshness fields without removing mapped lineage |
| kg-content-generation `origin/main` | `5ba0056b477543adf650283c3ff59cc7d8a1934d` | Graph and question-generation research exists, but its identities and publication semantics are not the product contract |

### Independent-target checks

- Check: refreshed `origin/v3-ai` retains the authoritative chatbot-owner
  authorization seam, active-mode source, server-side locale selector, chat
  orchestration path, and repository-native local browser/runtime path.
- Check: no production GraphQL mutation, HTTP route, worker entry point, or
  alternate store can create a synthetic candidate or mark unverified evidence
  eligible.
- Check: the four planned layers remain independently green and safe to land
  while the canonical production selection is empty.

### Deferred integration questions

- Check: after PR #5424 is green and its graph lifecycle is present in refreshed
  `origin/v3-ai`, prove that the active serving-set digest equals the published
  graph build's source-content digest for the same knowledge base.
- Check: prove current retrieval returns the exact source ID, chunk ID,
  expected content hash, and citation anchor needed by an evidence-lineage
  entry.
- Check: prove the service-auth path can obtain or renew an operation-scoped,
  short-lived retrieval token without persisting it in Hatchet input, product
  state, logs, or callback payloads.
- Check: prove the callback authenticates the private service, binds operation,
  chatbot, manifest, graph build, and contract generation, and rejects late or
  replayed results idempotently.
- Check: identify the already-approved platform embedding route. Its absence is
  a pause condition; it is not replaced with a new datastore or provider.
- Check: prove the automatic generation trigger uses the same locale selector
  already adopted by the independent milestone.

### Limitations

- No implementation check has run because this revised plan still awaits
  approval. The unmerged graph foundation no longer blocks local implementation.
- Dirty or stale primary checkouts are not implementation workspaces. Every
  writable repository receives a refreshed repo-local worktree.
- Local synthetic evidence cannot prove deployment, live provider
  availability, production scaling, or real-course quality.
- Current source revisions are planning evidence only. R0 refreshes the public
  target, PR metadata, merge base, and changed paths before topology mutation.

## Planning-stage specialist

- Reviewer: native GPT-5.6 Sol fallback, read-only, because the configured
  planner route remained unavailable.
- Scope: the complete independent Klicker milestone, its deferred integration
  boundary, and current repository evidence.
- Report:
  `project/_local/reviews/2026-08-21-chatbot-response-examples-planning-stage.md`
- Latest verdict: `DONE_WITH_CONCERNS`; all concerns below are accepted.
- Accepted: move the graph merge from the implementation start gate to a late
  integration gate and base the independent milestone on refreshed
  `origin/v3-ai`, never the raw PR #5424 head.
- Accepted: use four public layers by combining the stable canonical lifecycle
  with K1, then review, runtime, and evaluation. Defer generation operations,
  manifest reconciliation, real evidence validation, callbacks, automatic
  triggering, and all Catalyst work.
- Accepted: prove the local product with a test-only synthetic seed. Production
  evidence selection stays empty, and no public candidate-seeding path exists.
- Accepted: remove Catalyst and cross-repository acceptance from this terminal.
  A later integration plan begins only after the graph lifecycle supplies a
  contract that can be frozen at an immutable Klicker revision.

## Delivery topology

### R0 and independent target adoption

- Problem: the design worktree still tracks `v3`, while implementation belongs
  on `v3-ai` and must not inherit the raw PR #5424 head.
- Decision: refresh and adopt `origin/v3-ai` directly, preserve the uncommitted
  design artifacts, rename the branch to
  `feat/response-examples-foundation`, and initialize the four-layer stack in
  the same worktree.
- Decision: verify the existing owner, active-mode, locale, chat, and local
  browser/runtime seams before K1. The graph, corpus, lineage, token, callback,
  trigger, embedding-provider, and real-model questions belong to the deferred
  integration milestone and do not block this stack.
- Risk: overlap with PR #5424 or another active `v3-ai` branch may change the
  same Chatbot, GraphQL, Manage, or chat-runtime files. Record the overlap and
  reconcile only against refreshed `origin/v3-ai`; never copy pending models.
- Check: Git ref and GitHub API readback agree; the target is current; the
  authoritative locale and owner selectors are named; the local preview path is
  runnable; and the changed-path overlap ledger covers the exact planned seams.

### Public Klicker stack

Provider: GitHub. Base: refreshed `v3-ai`. Mode: guided after K1 because it adds
a migration and owner authorization, then progressive through draft
publication.

| Layer | Branch | Work package | Depends on | Activation | Risk | Size signal and ruling |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | `feat/response-examples-foundation` | Design, ADRs, plan, canonical current-state persistence, owner API, response-example digest, approval lifecycle, and strict synthetic fixtures | refreshed `v3-ai` | inert because production has no candidate source | high | 1,000-1,400 human lines/20-25 files plus project docs; genuinely one foundation because schema, authorization, lifecycle, and tests must agree at one independently usable API boundary |
| K2 | `feat/response-examples-review` | Owner candidate-review UI with empty, loading, error, approved, rejected, and `Needs review` states | K1 | inert with empty production state; local fixtures exercise the complete workflow | medium | 500-800/10-16; genuinely one lecturer workflow |
| K3 | `feat/response-examples-runtime` | Bounded summary, exact-scope model-invoked search, canonical re-read, and degraded traces | K2 | production selection remains empty without an eligible projection | high | 700-1,100/10-18; genuinely one runtime trust boundary |
| K4 | `feat/response-examples-evaluation` | Shared orchestration, response-example ablation, deterministic local judge adapter, atomic latest report, staleness, and report UI | K3 | owner-triggered only when eligible approved examples exist | high | 900-1,400/15-24; evaluation parity and report state form one reproducibility package |

Every layer must be independently functional, reviewable, green, and safe to
land. Tests stay with their behavior. Generated Prisma and GraphQL output is
reported separately. A layer above 1,400 substantive human lines or 25
human-authored files pauses for a topology amendment rather than splitting
mechanically.

### Synthetic-seed boundary

- Decision: synthetic candidates enter only through repository-native database
  fixtures and explicit local/test seed infrastructure. Production GraphQL,
  HTTP, worker, and application entry points cannot invoke that path.
- Decision: test fixtures may mark their synthetic evidence eligible so the
  local tracer can exercise runtime and evaluation. No production path can set
  evidence eligibility until the deferred integration package validates real
  graph and chunk lineage.
- Decision: without eligible canonical rows and a derivative projection, normal
  chat continues through degraded selection and evaluation has no runnable
  cases. This is the safe landed state.
- Check: production builds exclude the seed entry point; service and route tests
  prove it is unreachable; fresh-database production configuration contains no
  candidates or eligible projection rows.

## Delegation Map

| Workstream | Slices | Owner | Dependency or handoff | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Target and foundation | R0, K1 | main | refreshed `v3-ai` and current owner/locale seams | owner-authorized canonical state with no production candidate source |
| Lecturer workflow | K2 | executor for bounded UI paths; main integrates | K1 | browser-verified review flow from local fixtures |
| Runtime skill | K3 | main | K2 and canonical K1 state | exact-scope selection plus production-empty degradation |
| Evaluation | K4 | main | K3 and canonical K1 state | single-variable ablation and atomic latest report |
| Integrated acceptance | E1 | main | K1-K4 | complete local synthetic tracer plus production-seed exclusion |

Every executable slice appears exactly once. Catalyst and KB/KG integration are
not executable slices in this milestone.

## Feature-wide test portfolio

| Risk or behavior | Existing protection | Obligation | Primary seam | Distinct failure | Owner |
| --- | --- | --- | --- | --- | --- |
| Owner authorization and deletion | chatbot owner checks and cascade patterns | extend existing | GraphQL service with database fixture | course access grants review authority or deletion leaves response-example state | K1 |
| Canonical lifecycle and digest | no response-example state | add new | current-state service transaction | multiple sets, silent overwrite, or digest drift changes runtime/evaluation inputs | K1 |
| Synthetic-seed confinement | local test helpers exist; no candidate path | add new | build/import boundary and route tests | a production caller creates a candidate or marks evidence eligible | K1/E1 |
| Lecturer journey | generic chatbot Manage coverage | add one | focused local browser journey | owner cannot inspect, edit, approve, or reject a seeded candidate | K2/E1 |
| Exact-scope selection | MCP scope filtering only | add new | server-bound tool and canonical re-read | another chatbot, mode, locale, or ineligible row is disclosed | K3 |
| Degraded production state | required MCP route tests | extend existing | chat orchestration and traces | empty or failed example selection aborts chat or substitutes another scope | K3 |
| Evaluation parity and staleness | no response-example evaluation | add new | shared orchestration and report transaction | tools/config differ, example content leaks, or failed work replaces the latest report | K4 |
| Complete local tracer | no current end-to-end path | add one | local DB, Manage, chat orchestration, and deterministic adapters | a green package set cannot complete the approved synthetic lifecycle | E1 |

No test is added for framework behavior, generated artifacts, revision history,
real graph/corpus reconciliation, callback authentication, automatic
generation, Catalyst, Evaluation export, live model quality, or deployment
because those belong to the deferred integration milestone.

## Slices

### R0 - Adopt the independent `v3-ai` target

- Problem: the current design worktree is based on `v3`, while the independent
  implementation must start from current `v3-ai` without inheriting PR #5424.
- Route: main
- Execution-tier skip reason: critical-path coupling to branch adoption and
  current authorization/runtime seams
- Do: refresh refs and forge metadata; preserve the uncommitted design files;
  rebase the worktree onto current `origin/v3-ai`; rename the branch; verify the
  owner, active-mode, locale, chat, and local preview paths; record overlap with
  PR #5424 without importing it.
- Acceptance: the named target and local branch agree; the five independent
  seams are evidenced at immutable revisions; only the approved artifacts are
  present; no mapped-input repository is changed.
- Check: Git and GitHub API readback, changed-path overlap, targeted source
  readback, worktree status, and the fastest relevant baseline checks.
- Commit: no standalone R0 commit; fold verified metadata corrections into the
  design or plan commit.

### K1 - Establish canonical owner-governed state

- Problem: Klicker has no canonical response-example set or owner lifecycle.
- Route: main
- Execution-tier skip reason: authorization, data integrity, and migration
  coupling
- Do: commit the corrected design and ADRs separately; commit this plan
  separately; add one set per chatbot, scoped entries, stable evidence-reference
  fields, approval status, response-example digest, cascade deletion, owner-only
  queries and approve/edit-and-approve/reject mutations, and test/local fixture
  support. Add no production candidate-creation or eligibility mutation.
- Acceptance: one set per chatbot; exact mode/locale fields; owner-only review
  mutations; live approved edits; rejection and `Needs review` states; no
  revision history; deterministic digest; chatbot deletion cascades; a
  production caller cannot create a candidate or mark evidence eligible.
- Check: Prisma generation, migration and schema sync, focused GraphQL database
  tests, fixture-confinement checks, package checks, generated-artifact diff,
  and stack-aware immutable remote readback.
- Commit: `docs(chatbot): record response-example design decisions`;
  `docs(project): add response-example implementation plan`;
  `feat(chatbot): add response-example foundation`.
- Gate: present the migration, authorization, fixture-confinement, and immutable
  readback evidence once. Matching evidence continues under the approved
  execution contract; a mismatch or unresolved R0 obligation pauses.

### K2 - Give the owner one review workflow

- Problem: candidates are not useful until the owner can inspect their
  behavior and evidence and make them live.
- Route: executor for settled UI-owned paths; main integrates authorization and
  product seams
- Acceptance: a locally seeded owner sees candidates, approved, rejected, and
  `Needs review` entries plus evidence references; can Approve, Edit and
  approve, or Reject; a non-owner cannot invoke mutations; a clean production
  state shows no candidates or generation action.
- Do: extend the existing Chatbot detail pattern with focused components,
  GraphQL operations, EN/DE strings, loading, empty, error, and review states.
- Check: Manage type/lint/build checks and one routed Playwright journey in EN
  and DE at desktop and mobile widths. Capture final screenshots for the PR.
- Commit: `feat(manage): add response-example review`.

### K3 - Deliver the response-behavior skill

- Problem: approved examples must guide normal chat without becoming factual
  memory or leaking across scope.
- Route: main
- Execution-tier skip reason: authenticated runtime data flow and architecture
- Acceptance: an eligible synthetic approved example contributes to the bounded
  summary; the model can call one search tool whose chatbot, mode, and locale
  are server-bound; canonical status and eligibility are re-read before return;
  no scope fallback occurs; empty or failed selection continues and records
  degraded selection.
- Do: add the bounded summary and a server-owned search tool over a derivative
  projection; use a deterministic local/test projection for the tracer; keep
  the production projection empty until the deferred evidence adapter exists;
  add selection details to existing tool traces; keep `doc_query` responsible
  for current facts.
- Check: focused selector/tool tests, cross-scope, ineligible-row, empty-state,
  loader-failure, chat, prompt-cache, build, and one synthetic runtime exercise.
- Commit: `feat(chat): add response-example skill`.

### K4 - Evaluate the unchanged chatbot without examples

- Problem: the approved examples must act as expected responses without being
  available to the evaluated run.
- Route: main
- Execution-tier skip reason: orchestration architecture and reproducibility
  boundary
- Acceptance: one internal chat orchestration seam serves normal and evaluation
  runs; evaluation preserves model, mode, scaffolding, retrieval, and registered
  tools; removes the summary and binds example search to an empty projection;
  creates no participant thread or participant credit charge; the deterministic
  local adapter exercises the generation-base-model judge contract; success
  atomically swaps one latest report, and captured-input digest changes mark it
  stale.
- Do: extract the shared server seam, add the owner-only trigger, advisory judge,
  atomic report service, staleness selector, and case-first report UI.
- Check: orchestration parity tests, tool-registration ablation test, failure
  preservation, digest/staleness cases, judge structured-output tests, GraphQL
  and chat checks, Manage build, and report browser states.
- Commit: `feat(chatbot): add response-example evaluation`.

### E1 - Prove the complete synthetic path

- Problem: green layers do not prove the complete lecturer and chatbot behavior.
- Route: main integration owner
- Do: seed one candidate through local/test infrastructure, review it as the
  owner, retrieve it in exact-scope normal chat, run evaluation with example
  content ablated, and display the latest comparison report.
- Acceptance: the owner can edit and approve the candidate; normal exact-scope
  chat can retrieve it; another chatbot, mode, or locale cannot; evaluation
  keeps the search tool registered but returns no example content; the report
  binds to the captured digest; production routes cannot invoke the seed or
  create eligible rows.
- Check: credential-free deterministic fixtures through the real Klicker state,
  Manage, and chat seams; production build/import exclusion; relevant full
  checks at the exact K4 head.
- Commit: fixtures stay with K1-K4. E1 adds no separate test-only layer;
  corrections are committed on their owning branches and propagated
  stack-aware.

## Deferred KB/KG and Catalyst integration milestone

- Trigger: PR #5424 or a separately reviewed equivalent graph lifecycle is
  green and present in refreshed `v3-ai`.
- Scope: exact corpus/graph manifest equality, graph-selected coverage, current
  authorized chunk lineage, `Needs review` transitions from real evidence,
  generation caps and reconciliation, service/callback authentication, replay
  rejection, automatic triggering, production search projection, the
  version-pinned base-model route, Catalyst generation, and integrated proof.
- Boundary: create a new planner-reviewed execution plan and obtain one new
  approval before any Catalyst write, public/private protocol freeze, live model
  call, or production activation.
- Constraint: the integration package consumes the canonical state, review,
  runtime, and evaluation seams from this stack. It must not add another
  response-example store or a production synthetic-seed path.

## Slice and finish reviews

- K1, K3, and K4 cross data-integrity, authorization, architecture, or runtime
  boundaries. Each receives one `slice-reviewer` on its immutable range.
- Every substantive code-bearing slice receives one native `simplifier` in
  parallel with its slice reviewer when both gates apply. K2 receives the
  simplifier if its measured implementation is substantive; its authorization
  behavior remains covered by K1 and browser evidence.
- Documentation-only design and plan commits receive no simplifier or slice
  review after the planning-stage pass unless their contract meaning changes.
- The owning session verifies and dispositions every finding, reruns focused
  checks, and records reports under ignored `project/_local/reviews/` or
  `docs/project/_local/reviews/`.
- Before draft PR creation or update, each layer passes the four work-package
  tests and reports substantive human and generated size separately.
- After all gates and E1, exactly one native Sol `final-reviewer` reviews the
  complete committed Klicker stack with correctness, plan compliance,
  maintainability, security, and architecture lenses.

## Verification and final evidence

- Klicker: filtered Prisma generation and migration checks; GraphQL generation,
  focused tests, check, lint, and build; Chat focused tests, check, lint, and
  build; Manage check, lint, and build; root format, lint, type, sync, and
  secret checks appropriate to each layer.
- Browser: real local Manage and Chat routes, owner and denied-owner states,
  EN/DE, desktop/mobile, synthetic candidate review, `Needs review`, normal
  retrieval, degraded selection, evaluation result, and stale report. Capture
  screenshots with the exact revision and route.
- Runtime: start the repository-native DevPod/devcontainer only after approval,
  establish the preview URL at UI-slice start, stop the exact runtime after its
  final check, and verify it stopped unless the user explicitly grants a lease.
- Forge: draft PR URL, exact remote head, target/base, stack order, per-layer CI,
  size, review focus, and immutable K1 foundation SHA/digest. Drafts remain
  draft until the separate Gate 3 decision.
- Data hygiene: stage explicit paths; inspect every staged diff for credentials,
  real personal data, source content, or raw exports; retain only synthetic
  fixtures.

## Progress

- Status: K1 implementation is committed, reviewed, published as draft PR
  #5474, and accepted through Phase 5; K2 is ready to start
- Completed: repository mapping, product grill, design, ADRs 0028-0036,
  independent-scope correction, current source refresh, stack-capability check,
  two native Sol planning passes, refreshed `v3-ai` adoption, the design
  commit `1cdf33703`, and the implementation-plan commit `01508e172`
- Completed K1 work: response-example schema and migration, Prisma sync,
  owner-scoped GraphQL query and lifecycle mutations, deterministic digest,
  generated artifacts, synthetic test-only fixtures, focused tests, and the
  matching wiki update
- Active slice: none; K1 has reached `BOUNDARY_CANDIDATE`
- Remaining: K2 review workflow; K3, K4, and E1 remain blocked pending their
  listed dependencies being accepted through Phase 5
- Latest public evidence: `feat/response-examples-foundation` is based directly
  on `origin/v3-ai` at
  `198747502a81149c2f61bb3dcd097716bbe32244`; PR #5424 remains separate and
  `UNSTABLE`
- Latest target evidence: local `origin/v3-ai` and the adopted branch agree at
  `198747502a81149c2f61bb3dcd097716bbe32244`; runtime checks use Node 24.16.0
  and pnpm 11.5.0
- Latest implementation evidence: migration
  `20260822090256_response_examples_foundation` applied in the repository
  runtime; direct focused Vitest passed 4/4 tests; GraphQL and Prisma checks
  completed with runtime exit marker `0`; GraphQL codegen succeeded after the
  Prisma client build; Prisma sync updated the mirrored analytics schema.
- Repository check evidence: `pnpm run check`, `pnpm run format:check`, and
  `pnpm run lint` completed in the exact runtime. The full `pnpm run build`
  reached a successful GraphQL build but stopped at the existing chat-package
  module-resolution errors for `@klicker-uzh/util/auth` and
  `@klicker-uzh/util/client-auth`, outside this K1 diff.
- Runtime limitation: the repository `test:local` command cannot start its
  database because the exact runtime does not expose Docker CLI; the direct
  focused Vitest path passed against the already-running synthetic database.
  Graph, corpus, lineage, callback, retrieval-token, trigger, embedding,
  model, and Catalyst obligations are deferred rather than blocking.
- Review evidence: the immutable range passed the dedicated slice review with
  no blocking findings and the simplification pass returned ship-as-is; the one
  accepted advisory hardening is commit `d46658b2f`, followed by green focused
  GraphQL checks and 4/4 database tests.
- CI evidence: draft PR #5474 targets `v3-ai` at head
  `59915d2bee2cb0d154b6f36a88f29098261e816e`; after two branch-specific fixes
  (missing util auth subpath Rollup entries in `d20ef52a7` and a stale
  manage-assistant Playwright locator in `7146335bc6`, both outside the
  response-example diff), the full check suite is green, including
  build-and-compile with all eight Playwright shards, GraphQL, MCP lecturer,
  types, lint, format, knip, syncpack, and gitleaks. The docs-only head first
  hit a transient Prisma `EEXIST` in `check-types`; the failed job retry passed
  without a source change.
- Unresolved required gates: none for K1. The draft stays draft; ready,
  merge, deployment, and live use remain withheld by decision.
- Required delivery layer: one independently green, reviewed draft PR for K1;
  K1 meets that layer and the four-layer milestone delivery remains pending
- Achieved delivery layer: one independently green, reviewed draft PR #5474,
  with the committed design, ADRs, approved plan, K1 foundation, and advisory
  hardening included
- Next action: create `feat/response-examples-review` from the accepted K1
  head, record the privacy check, and start K2. Keep the draft and all
  withheld actions unchanged.

## Next steps after terminal

- Ask once at Gate 3 whether to open the green draft layers for review, revise
  them, or leave them as drafts.
- After the graph lifecycle lands, create the separate KB/KG and Catalyst
  integration plan described above.
- Qualify the version-pinned generation, embedding, and judge routes with
  authorized course-safe staging input before production activation.
- Plan deployment, secrets, scaling, rollout, rollback, and live proof as a
  separate package after integration is accepted.
- Add an Evaluation-repository export adapter only if operators need offline
  analysis; it remains noncanonical and outside lecturer workflow.
