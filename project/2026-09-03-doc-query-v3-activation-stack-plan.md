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

| Source path | Layer | Source blob | Result blob | Disposition |
| --- | --- | --- | --- | --- |
| `apps/chat/scripts/prd-doc-query-proof.mjs` | 3 | `507f41ffd238711b9a9162bd281d62d91f561066` | `507f41ffd238711b9a9162bd281d62d91f561066` | exact extraction |
| `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` | 1 | `b1caf739e0c3b6e77fae41f26cedff9bd4440493` | `abb09cf3d60e6b8bebad0d200b256b1fb9819405` | use effective Tutor inheritance for Quizzer scope |
| `apps/chat/src/lib/server/docQueryScopeToken.ts` | 1 | `d8fe5ec67a151ad93e47e0ff0791c63a0f8540f0` | `d8fe5ec67a151ad93e47e0ff0791c63a0f8540f0` | exact extraction |
| `apps/chat/src/services/mcpClients.ts` | 1 | `60afae6eb041b95c68975b57263aa77185c741c5` | `803e86f93877dea3288de266721484150e70eaa0` | remove single-use helper churn and keep the test seam private |
| `apps/chat/src/services/mcpScope.ts` | 1 | `57378417b7e7d8e3f296da5cdc8c2867754754cb` | `2e6e4ca2c404529bf91c7ce24c7bed03d935bcde` | require the authoritative effective configuration list and preserve Tutor inheritance |
| `apps/chat/test/doc-query-proof-test-support.ts` | 3 | `16122099d8549b3491820f42ea2551e9f434f453` | `03b1508bb954f63d00d329542a32a7c1686a7b53` | type signer, lock, and environment seams; remove unused and duplicate helpers |
| `apps/chat/test/doc-query-scope-token.test.ts` | 1 | `1391e39c167f42af829cd81f76d21b856b7a963e` | `1391e39c167f42af829cd81f76d21b856b7a963e` | exact extraction |
| `apps/chat/test/mcp-clients-scope-token.test.ts` | 1 | `8a474c737f6e31181028708c9ab7934af03021b7` | `95c257f90e77184969f3becd4a6c562b8cfa6544` | test the public transport seam and pass the effective configuration list explicitly |
| `apps/chat/test/prd-doc-query-proof.test.ts` | 3 | `4d61e5a6a1608723a34107ce4dd964d3a723e4b4` | `77ca3ce5bb24784450c0035954f7811a7228c90c` | use the shared duplicate-lock helper |
| `apps/chat/test/required-mcp-route.test.ts` | 1 | `d1dfd17d02801e039ef13d3f7127045933282265` | `9cc4eec903630e7f3e66842b34e93815b6081684` | add inherited Quizzer regression coverage |
| `docs/chat-platform.md` | 1 | `416794481a1a35f9ce629a9167dea9d79ce0f592` | `24ad9c31ddea5a654077507bf048ad920a3dc7c0` | clarify the effective-mode contract |
| `packages/prisma-data/src/scripts/doc-query-cohort-activation-prisma.ts` | 2 | `b354e20d6b58a282ea0c6a1e9100bdc35529e2d2` | `b354e20d6b58a282ea0c6a1e9100bdc35529e2d2` | exact extraction |
| `packages/prisma-data/src/scripts/doc-query-cohort-activation-run.ts` | 2 | `ef65d8ae2ecf90998c5a3e83d5c8eda003856acb` | `ef65d8ae2ecf90998c5a3e83d5c8eda003856acb` | exact extraction |
| `packages/prisma-data/src/scripts/doc-query-cohort-activation.test.ts` | 2 | `0255878929f688dda010bb1df0c7df6e932328cd` | `0255878929f688dda010bb1df0c7df6e932328cd` | exact extraction |
| `packages/prisma-data/src/scripts/doc-query-cohort-activation.ts` | 2 | `446bef6afbd790d5678c841032538761ac5e397e` | `446bef6afbd790d5678c841032538761ac5e397e` | exact extraction |
| `project/2026-08-31-doc-query-scope-activation-source-plan.md` | replaced | `6c8086a8b316d79c7850d46077a382ac4398a0f3` | omitted | superseded by this stack plan |

Layer 1 also adds the stack-only contract alignment in ADR 0021 at blob
`350c7aceab90c2ec04d0cdae9a00df197826fed7`, `turbo.json` at blob
`ee796b2b80999604a7d993bb2bf1c5e7d1cf5643`, and this self-referential ledger.

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
- [x] Layer 2 activation extraction and local verification: all 37 focused
  tests, Prisma-data checks, formatting, and diff checks pass. Prisma-data has
  no package-local ESLint configuration.
- [x] Layer 2 activation review passed with no integrity defect. The proposed
  helper extractions were rejected because they add concepts without reducing
  the state machine. The final retry guard and exact expected-state comparison
  remain as fail-closed invariants rather than dead-code cleanup.
- [x] Layer 3 proof extraction and local verification: all 37 focused tests,
  Chat typecheck, focused lint, syntax, formatting, and diff checks pass. The
  unused test helper was removed and the signer and lock seams are now typed;
  the persistent marker remains because its replacement-lock test proves it is
  part of the concurrency contract.
- [x] Layer 3 proof review passed with no security or operations defect. The
  two behavior-preserving test reductions landed in `49de80b23`; the same
  reviewer confirmed the production proof contract is unchanged and all 37
  focused tests still pass.
- [x] The source-to-stack coverage ledger accounts for every frozen source
  file, deliberate correction, omission, and stack-only contract file.
- [x] Draft publication and exact-head CI/reviews completed. Pull requests
  #5736 (`732f7b3ef`), #5737 (`831d01035`), and #5738 (proof source
  `ce1351bfd`) form GitHub stack #5739 with the intended bases. This
  evidence-only plan update follows the proof source; all three are open, draft,
  mergeable, and have no review threads. Pull request #5709 remains unchanged.
  Local layer reviews passed. Hosted Playwright passed completely on #5736;
  #5738 ran every test successfully, but one shard and its aggregate are red
  because GitHub's artifact service timed out after the shard reported 104
  passing tests. Repository formatting is red on #5736 and #5738 only because
  current `v3` contains two unformatted evaluation files outside this stack.
  OpenCodeReview passed on #5736 and timed out with zero findings on #5737 and
  #5738. Required repository final reviews remain intentionally untriggered
  until the stack receives separate ready-for-review approval.
- [x] Post-publication integration (2026-09-03): the isolated baseline repair
  pull request #5740 (restore Vitest discovery for the evaluation target) was
  merged as `9d26b7499`, and the three-layer stack was rebased onto current
  `v3@86e9e0625d` in one approved pass with recovery refs recorded under
  `refs/stack-backup/20260903-pr5709/`.
- [x] Authority update: the user replaced this plan's no-merge boundary with
  explicit merge approvals for pull requests #5736, #5737, and #5738 in stack
  order, plus closure of superseded source pull request #5709. Deployment,
  production data, secrets, and live-proof boundaries remain withheld.
- [x] Identity-guard repair: `v3`'s new commit-identity guard rejected the
  fixture-authored stack commits. All ten commits across the three branches
  were rewritten to the user's author identity with byte-identical trees
  verified against the recorded pre-rewrite tree SHAs, and the rewritten heads
  `b1a4184d7` (#5736), `05dfa197f` (#5737), and `481afe95c` (#5738) were
  force-pushed under exact-head leases. Merged history was not rewritten.
- [x] Layer 2 chatbot knowledge-base consistency correction (2026-09-04):
  middle-branch commit `3ac1ddb45e` adds a normalized one-KB-per-chatbot
  invariant and regression coverage. The correction was integrated into this
  proof branch by merge commit `abbe0a028f`; the two changed activation files
  are the only source delta. The integrated focused activation suite passes all
  38 tests, Prisma-data checks, Biome, and diff checks; the dedicated correction
  review passed. No runtime, database, cluster, secret, or live-proof action
  was performed.
