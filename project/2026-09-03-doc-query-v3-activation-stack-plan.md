# Doc Query scoped retrieval activation stack

Date: 2026-09-03

Status: approved and executing

## Goal and non-goals

Replace the oversized current-v3 Doc Query activation pull request with three
purpose-based stacked pull requests. The bottom layer delivers only the
application runtime needed for scoped multi-tenant retrieval. The upper layers
retain the reviewed one-time activation and proof tools without making them
part of the runtime review.

This plan supersedes the unmerged source plan on
`fix/doc-query-v3-scope-activation`. It does not carry forward that plan's
maintenance-branch backport; maintenance work is deferred.

No layer may merge under this plan. The plan does not authorize deployment,
secret access, production configuration or data writes, live proof, closing
the source pull request, cleanup, or deletion.

## Execution contract

- **Execution owner:** the current main session is the sole stack topology and
  integration owner.
- **Autonomy:** the user's 2026-09-03 approval covers fresh stack branches,
  in-scope edits, focused checks, local commits, draft publication, exact-head
  CI, and required reviews.
- **Boundary owner:** self.
- **Terminal:** three draft pull requests with verified bases, exact heads,
  per-layer CI and review evidence, plus a complete source-to-stack coverage
  ledger.
- **Pause:** stop for a material contract or topology change, unexplained
  source-to-stack drift, failed security or data-integrity review, non-equivalent
  CI failure, or any withheld external action.
- **Safety reference:** leave pull request #5709 and source head
  `523e085b61f68fffdee4af22f506435058a2f6c7` unchanged until the replacement
  stack validates.

## Decisions

- Use the repository's native GitHub stack support. The provider endpoint and
  installed `gh stack` extension were verified before branch creation.
- Keep three layers in dependency order: runtime, activation operator, sealed
  proof. The proof binds the activation fingerprint, and the activation
  configuration is consumed by the runtime.
- Preserve global validation of every enabled raw KB configuration. Resolve
  the selected binding separately from the effective selected-mode
  configurations so the accepted Tutor-to-Quizzer inheritance contract works.
- Require the effective selected KB binding to match the globally validated
  server and knowledge-base ID. Retain fail-closed malformed, misplaced,
  duplicate, and conflicting configuration behavior.
- Keep the production endpoint and cohort sealed in the proof tool.
  Configurability would weaken the proof boundary.
- Apply only verified local reductions. Do not redesign the activation state
  machine or proof lifecycle while decomposing the branch.

## ADR gate

No new ADR is required. ADR 0021 already owns Tutor-to-Quizzer MCP inheritance.
The runtime layer updates its wording and the matching Chat platform guide so
the scope-token check follows that accepted decision. A new credential
transport, scope-token algorithm, or ownership boundary would reopen the ADR
gate.

## Planning review

- The native Sol planner returned `REVISE` in round 1. Accepted findings:
  dual raw/effective scope validation, three-layer order, explicit large-layer
  rulings, a content-aware coverage ledger, single-writer ownership, per-layer
  checks, and a draft-only terminal.
- The planner's suggestion to remove `acquireLockForProof` was rejected after
  repository inspection proved that production and three tests use the
  injection seam. The revised plan types it accurately instead.
- The same planner approved the revised frozen plan in round 2.
- The required opposing-provider challenge could not authenticate because the
  Claude OAuth token had expired. The pass is fail-open; no opposing-provider
  finding was available.

## Stack topology

### Layer 1: scoped Doc Query runtime

- **Branch:** `fix/doc-query-v3-runtime-scope`
- **Base:** `v3`
- **Work package:** resolve and sign one effective knowledge-base scope and
  forward it separately from the transport bearer.
- **Responsibility:** runtime source, focused tests, Chat platform contract,
  ADR 0021 alignment, Turborepo environment declarations, and this shared plan.
- **Reviewer:** Chat runtime and security reviewers.
- **Attention:** judgment-heavy.
- **Activation:** complete; ordinary chatbots remain unchanged, and scoped
  chatbots fail closed.
- **Risk:** high because it changes an authorization boundary.
- **Size signal:** about 800 source/test/doc additions across eight source,
  test, and documentation files, plus small plan, ADR, and Turborepo changes.
  This remains one package because splitting signer, resolver, route wiring,
  and their contract tests would leave fragments that cannot validate
  independently.

### Layer 2: configuration activation operator

- **Branch:** `chore/doc-query-v3-activation-operator`
- **Base:** layer 1.
- **Work package:** one configuration-only production activation operator with
  durable receipts and exact rollback/readback behavior.
- **Responsibility:** activation domain, Prisma adapter, command runner, and
  focused tests.
- **Reviewer:** data-integrity and operations reviewers.
- **Attention:** judgment-heavy.
- **Activation:** inert unless directly invoked.
- **Risk:** high because later use can mutate production configuration.
- **Size signal:** about 4,121 additions across four files. This remains one
  package because the state machine, persistence adapter, runner, and tests
  jointly define one restart-safe transaction contract; splitting them would
  create non-functional review fragments.

### Layer 3: sealed cutover proof

- **Branch:** `test/doc-query-v3-cutover-proof`
- **Base:** layer 2.
- **Work package:** one sealed positive-retrieval and cross-knowledge-base
  isolation proof harness with values-free receipts.
- **Responsibility:** proof supervisor/worker, shared test support, and focused
  tests.
- **Reviewer:** security and runtime-proof reviewers.
- **Attention:** judgment-heavy.
- **Activation:** inert unless directly invoked.
- **Risk:** high because later use reaches production retrieval.
- **Size signal:** about 2,449 additions across three files. This remains one
  package because process custody, locking, result contracts, and the proof
  matrix form one lifecycle that cannot validate independently when split.

## Delegation Map

| Workstream | Layer | Owner | Dependency | Acceptance |
| --- | --- | --- | --- | --- |
| Scoped runtime | 1 | main | current `v3` | focused Chat tests, typecheck, lint, format, and security review |
| Activation operator | 2 | main | layer 1 | focused Prisma-data tests, script typecheck, format, and data-integrity review |
| Sealed proof | 3 | main | layer 2 | focused proof tests, Chat typecheck/lint/format, and security review |

Execution-tier skip reason: critical-path coupling. One worktree and one topology
owner must preserve the source-to-stack ledger while creating dependent
branches. Reviewers remain read-only gates, not slice owners.

## Source-to-stack coverage ledger

For every entry, record the source blob at `523e085b61`, owning layer,
extraction method, deliberate correction, and resulting layer blob before
publication.

| Source surface | Owner | Extraction | Allowed correction |
| --- | --- | --- | --- |
| Chat route, signer, MCP clients, scope resolver | Layer 1 | exact final-tree paths and reviewed hunks | effective Quizzer scope fix |
| Runtime scope and route tests | Layer 1 | exact final-tree paths | inherited Quizzer regression |
| Chat platform guide | Layer 1 | exact final-tree path | effective-mode wording |
| Activation domain, adapter, runner, tests | Layer 2 | exact final-tree paths | verified dead retry/state checks only |
| Proof script, support, tests | Layer 3 | exact final-tree paths | verified dead marker/helper and type corrections only |
| Old source plan | replaced | omit | this shared stack plan supersedes it |
| `turbo.json`, ADR 0021, shared stack plan | Layer 1 | stack-only | required contract alignment |

An unexplained source-only implementation file or stack-only behavioral file is
a blocker.

## Test portfolio

| Consequential behavior | Existing protection | Obligation | Primary seam | Owning layer |
| --- | --- | --- | --- | --- |
| Scope claims and credential separation | scope-token unit tests | extend existing | signer and MCP client tests | Layer 1 |
| Effective Tutor-to-Quizzer scope | effective-mode and route tests | add regression | scope resolver plus route test | Layer 1 |
| Malformed, duplicate, misplaced, or conflicting scope | scope resolver table tests | retain | scope resolver unit tests | Layer 1 |
| Per-chatbot atomic activation and recovery | activation suite | retain | activation domain and adapter tests | Layer 2 |
| Receipt concurrency and exclusion drift | activation suite | retain | activation runner tests | Layer 2 |
| Positive retrieval and cross-KB isolation | proof matrix suite | retain | sealed proof tests | Layer 3 |
| Output, child-process, locking, and no-retry contracts | proof supervisor suite | retain and type-correct | proof supervisor tests | Layer 3 |

## Execution slices

### Slice 1: runtime layer

- **Do:** extract the runtime paths, correct raw/effective scope resolution,
  add the four `DOC_QUERY_SCOPE_*` names to `turbo.json`, align docs and ADR
  0021, and add the regression.
- **Route:** main.
- **Check:** focused Chat tests, Chat typecheck, focused lint, formatting,
  diff and staged-data inspection.
- **Commit:** plan first, then one cohesive runtime implementation commit and
  reviewed correction commits if needed.

### Slice 2: activation layer

- **Do:** add the four activation files from the frozen source tree and apply
  only verified dead-code reductions.
- **Route:** main.
- **Check:** activation tests, Prisma-data script typecheck, formatting, diff
  and staged-data inspection.
- **Commit:** one cohesive activation commit and reviewed corrections.

### Slice 3: proof layer

- **Do:** add the three proof files from the frozen source tree and apply only
  the verified marker/helper/type reductions.
- **Route:** main.
- **Check:** proof tests, Chat typecheck, focused lint, formatting, diff and
  staged-data inspection.
- **Commit:** one cohesive proof commit and reviewed corrections.

### Slice 4: stack publication and equivalence

- **Do:** complete the content-aware coverage ledger, verify every layer tip,
  publish draft pull requests, and read back topology, bases, heads, CI, and
  review results.
- **Route:** main.
- **Check:** native stack JSON, per-layer file and size reports, exact-head
  checks, final layer reviews, and the authorized stack final review.
- **Commit:** progress and evidence updates in the owning layer.

## Progress

- [x] Source pull request #5709 frozen at
  `523e085b61f68fffdee4af22f506435058a2f6c7`; source worktree was clean and
  its exact-head CI was green.
- [x] Complexity review confirmed that about 87 percent of additions are
  one-time activation/proof tooling rather than runtime.
- [x] Native stack support and the installed `gh stack` extension verified.
- [x] Plan-hardening completed: native planner approved round 2; opposing
  provider unavailable due expired OAuth.
- [x] User approved the three-layer simplification and draft publication.
- [x] Layer 1 runtime extraction and local verification: 29 focused tests,
  Chat typecheck, focused lint, formatting, and diff checks pass. The local
  Node 26 runtime is newer than the repository's pinned Node 24 runtime.
- [x] Layer 1 runtime review: the simplifier's three behavior-preserving
  reductions landed in `08af40bc8`; the security correction review passed.
  Production preflight must still confirm the five-minute token lifetime is
  sufficient for supported turns, and Layer 3 must prove the consumer contract.
- [ ] Layer 2 activation implementation and review.
- [ ] Layer 3 proof implementation and review.
- [ ] Draft publication, exact-head CI/reviews, and coverage-ledger completion.
