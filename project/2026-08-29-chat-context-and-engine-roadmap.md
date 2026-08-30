# PLAN — public chat context and engine migration roadmap

## Recommendation

Finish the active authoritative-history package first. Then add one small,
deterministic context-budget package to the existing Next.js route. Keep
summary compaction disabled in the public default path.

After that public baseline has landed, introduce the framework-neutral
`chat-engine` contract, the stateless AI SDK default engine, and `chat-api` as
an inert four-layer stack. Add checkpoint-aware `v2` only after the public
boundary is proven. Catalyst remains optional throughout: the public default
engine must continue to run the product without a private service.

## Identity

- Date: 2026-08-29
- Ceremony: full-path roadmap
- Repository: `uzh-bf/klicker-uzh`
- Target: `v3`
- Planning branch: `rs/chat-context-roadmap`
- Planning worktree: `trees/chat-context-roadmap`
- First delivery branch: `rs/chat-authoritative-history`
- First delivery worktree: `trees/chat-authoritative-history`
- Accepted base: `origin/v3` at `bb495a1b20886b8744798dd2b3d188b3cfabf982`
- Existing execution plan:
  `project/2026-08-29-pr-5676-chat-authoritative-history-plan.md` on
  `rs/chat-authoritative-history`
- Companion private roadmap: maintained in the Catalyst repository and not
  linked from this public artifact
- Status: approved 2026-08-29; P0 execution and bounded PR delivery are active.
  Merge, deployment, activation, and cleanup remain separately gated.

The planning-stage challenge completed with `DONE_WITH_CONCERNS`. Its required
corrections are incorporated: do not revive the archived `chat-api`, keep the
public fallback deterministic, split the boundary into independently testable
layers, and require exact contract conformance before any private cutover.

## Goal

Give the public chat a safe standalone long-session baseline, then create a
versioned host/engine boundary that can use either the public AI SDK engine or
the private Catalyst/Mastra engine without changing ownership of messages,
branches, credits, identity, privacy, or product policy.

## Non-goals

- No LLM-generated summary, semantic recall, working memory, or provider-native
  compaction in the public default path.
- No Catalyst dependency, private fallback, automatic contract negotiation, or
  per-turn engine downgrade.
- No migration of canonical message ownership away from PostgreSQL.
- No resurrection or wholesale rebase of public PRs
  [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) or
  [#5129](https://github.com/uzh-bf/klicker-uzh/pull/5129); they are prior art.
- No merge, deployment, production activation, external model call, branch
  deletion, worktree removal, or runtime-data cleanup without separately named
  authority.

## Verified current state

### Public runtime and persistence

- **Verified:** at the accepted base,
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:645-706` still
  accepts browser-provided messages. The route converts them into model
  messages around `:968-1069` and calls AI SDK `streamText`; current `v3` has no
  server summary or compaction path.
- **Verified:** `packages/prisma/src/prisma/schema/chat.prisma` stores
  `ChatThread` and parent-linked `ChatMessage` rows. The browser state in
  `apps/chat/src/stores/chatStore.ts` keeps the active branch and all rows;
  `apps/chat/src/lib/api/utils.ts` derives branch paths.
- **Verified:** `apps/chat/src/lib/server/chatModelRegistry.ts:5-25` records
  output limits, but not a complete input/context budget.
- **Verified:** the active authoritative-history package is published as draft
  PR #5676. It reconstructs one persisted ancestor chain, validates up to 256
  rows, sends the closest 64 projected rows, and makes image bindings
  server-authoritative. At published head `4d392fb99`, every automated
  policy, static, type, security, build, and hosted Playwright check passed;
  only the manual final-review status remained pending. The successful OCR job
  also returned actionable follow-up findings, so its success status was not
  treated as source approval. A local correction pass now moves image
  preprocessing outside the transaction, revalidates persisted sources inside
  it, tightens request and lifecycle scope validation, preserves unexpected
  failures as server errors, and makes attachment metadata truthful. The branch
  remains one non-overlapping commit behind current `origin/v3`. The corrected
  PostgreSQL fixture and managed browser smoke remain local evidence gaps
  because provider-layer Devsy transitions failed and the exact workspace
  exposes zero routes. Fresh exact-head review and CI are required after the
  correction is published.
- **Verified:** PR #5126 and draft PR #5129 are open and conflicting against
  current public history. Their contract and default-engine ideas are useful;
  their `chat-api` client-history and timestamp assumptions are not.

### AI SDK capability

- **Verified:** AI SDK exposes deterministic UI-message pruning through
  [`pruneMessages`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages).
  It does not make the host's branch choice or persisted raw history
  authoritative.
- **Inference:** a message-count window alone is not a hard context guarantee.
  One very large user message, tool schema, or image description can exceed a
  provider limit even when the history contains fewer than 64 rows.

## Decisions

### D1 — the current authoritative-history package remains first

Do not expand or replace its approved plan. Finish its existing S2/S3 and
review obligations on its accepted base. When the branch is otherwise green,
perform one separately approved integration of current `origin/v3`, rerun only
affected checks, and land it before later public packages.

### D2 — the legacy public fallback is deterministic

The public route keeps the authoritative active ancestor chain and recent raw
tail. It does not generate or persist summaries. It removes the oldest complete
turn groups until the request fits a conservative input budget. System and
developer instructions, the current unresolved user request, recent complete
turns, and any atomic tool-call/result pair that is eligible for replay remain
protected.

If the protected set alone exceeds the budget, fail before provider work and
before charging. Do not silently send an over-budget request or summarize it.
The first implementation uses an explicit conservative byte/character budget;
tokenizer-specific accounting remains optional later and must not add a new
dependency without a measured need.

### D3 — the public engine boundary is additive and default-safe

The public stack introduces, in order:

1. a standalone ordinal `v1` contract and black-box conformance runner;
2. a stateless public AI SDK default engine;
3. an inert public `chat-api` host built on authoritative server history; and
4. a default-off route adapter that can select the new host boundary.

The legacy route stays available through validation. The default engine is the
rollback target and has no dependency on Catalyst.

### D4 — checkpoint-aware `v2` is additive

Do not mutate `v1` or make summary fields optional there. `v2` adds an exact
checkpoint capability, separate checkpoint-generation operation, ordered raw
tail, usage receipt, and branch provenance. Engines may serve `v1` and `v2`
temporarily, but the host calls one exact configured generation. There is no
runtime negotiation or downgrade.

### D5 — the public host owns checkpoints and product effects

The host chooses the active leaf, validates ancestry and source digest,
persists checkpoint candidates, applies retention and deletion, authenticates
users, records usage, and decides credits. Engines receive a bounded projection
and return stream events or a candidate checkpoint. They never own the
canonical tree.

## Work packages and PR boundaries

### P0 — finish authoritative history

Existing plan and branch; execute first.

Acceptance requires the S2 immutable review, S3 ADR/wiki/roadmap receipt,
integrated tests, final review, and honest disposition of browser proof. The
existing 64-of-256 row window is accepted as a row-bounded baseline, not a hard
token guarantee.

### P0R — remove the temporary request adapter

This is a separate compatibility PR owned by the public Chat maintainers. Its
review date is 2026-09-30. An extension requires a dated roadmap receipt with a
named compatibility reason; it must not become an indefinite second contract.

Removal may proceed after P0 has run in production for one full deployment
window and either supported-client compatibility is proven or values-free
`usedLegacyAdapter` telemetry is zero for that window. The PR removes the old
`messages` request schema, makes legacy payload rejection explicit in parser
and route tests, updates the wiki, and reruns send, edit, regenerate, reload,
and already-open-tab browser journeys. P0R does not block P1 or P2.1-P2.3, but
it must land before P2.4 can activate another compatibility seam.

### P1 — add the basic legacy context guard

One cohesive public PR after P0 lands. No schema change and no engine split.

- Add one server-owned context-budget configuration and explicit reserve for
  output, prompts, tool schemas, and multimodal overhead.
- Project only the persisted active branch. Remove oldest complete turn groups
  until the bounded raw tail fits; never split a tool call from its result.
- Preserve the current user request and configured recent-tail floor. Return a
  stable pre-provider error when protected content is too large.
- Record values-free counts, estimated input size, truncation reason, and
  selected policy version. Never log message IDs or content.
- Test a huge single message, long text history, marker-only assistant rows,
  malformed tool pairs, images, interrupted turns, and zero-charge rejection.

This package is the complete public long-session behavior until checkpoint
`v2` is deliberately enabled.

### P2 — public boundary foundation stack

Create one native GitHub stack with four independently reviewable layers,
based on current `v3`. Archived PR #5126 supplies a source ledger only.

| Layer | Scope | Acceptance |
| --- | --- | --- |
| P2.1 | Framework-neutral `chat-engine-contract` `v1` plus fixtures and black-box runner | Standalone build and package/tarball consumption; no host or Catalyst import |
| P2.2 | Stateless `chat-engine-default` using AI SDK | Same fixtures, stream terminal semantics, tool and cancellation tests |
| P2.3 | Inert `chat-api` host service using P0/P1 authoritative projection | Auth, branch, credits, lifecycle, CORS/CSRF, and concurrent charging tests |
| P2.4 | Default-off legacy route adapter and client migration seam | Both flag states pass routed browser tests; default remains public engine |

Do not publish or activate a higher layer before all dependencies are immutable
and green. The stack may land layer by layer; activation remains a later
product and deployment decision.

### P3 — public checkpoint contract and persistence stack

Start only after P2 is landed and the unresolved product decisions below are
ruled.

| Layer | Scope | Acceptance |
| --- | --- | --- |
| P3.1 | Add exact `v2` contract and capability manifest | `v1` unchanged; raw-tail and checkpoint fixtures cover all branch cases |
| P3.2 | Add one minimal checkpoint model/repository | Generated migration, ancestry/digest validation, retention/deletion tests |
| P3.3 | Add host context planner and candidate persistence | Invalid/stale candidates discarded; raw fallback and charging idempotency pass |
| P3.4 | Add default-off Catalyst adapter and user receipt | Exact generation selection, privacy-hidden traces, public-engine rollback |

P3.4 may be enabled only after the private engine passes the same immutable
`v2` conformance fixtures and the rollout gates in the companion Catalyst
roadmap.

## Public checkpoint boundary

The public contract owns these semantics even though Catalyst may generate the
summary:

| Field | Rule |
| --- | --- |
| `branchHeadMessageId` | Exact active leaf chosen by the host |
| `tailStartsAfterMessageId` | Boundary between the checkpoint prefix and ordered raw tail |
| `tailMessages` | Completed, projected ancestor rows only; current request remains verbatim |
| `checkpoint.id` | Host-issued immutable identity after validation |
| `checkpoint.predecessorId` | Optional earlier valid checkpoint on the same prefix |
| `checkpoint.coveredThroughMessageId` | Exact completed ancestor boundary |
| `checkpoint.sourceDigest` | Digest of ordered source IDs, content, parent, role, and lifecycle projection |
| `checkpoint.provenanceVersion` | Contract, engine, model, prompt, and tool-policy provenance schema |
| `checkpoint.summaryPolicyVersion` | Exact compaction and retention policy |
| `checkpoint.summaryText` | Derived content; never replaces raw canonical rows |

The separate compaction response also reports raw model usage. The host
revalidates branch ancestry and the source digest before persistence.

## Cross-repository gates

| Gate | Public evidence | Private evidence | Result |
| --- | --- | --- | --- |
| G1 standalone | P0/P1 landed and public default remains complete | None required | Public work proceeds independently |
| G2 contract `v1` | Immutable P2.1 package and fixtures | Catalyst `v1` passes exact runner | P2 may expose a disabled private adapter |
| G3 contract `v2` | Immutable P3.1 package and branch fixtures | Catalyst dual-serves exact `v1`/`v2` | Shadow calls may start |
| G4 host safety | P3.2/P3.3 ancestry, deletion, charging, and fallback proof | Candidate generation is stateless and idempotent | Staging may enable checkpoint use |
| G5 rollout | Public default-engine rollback and browser proof | Quality, latency, cost, and privacy gates pass | Limited canary may be separately authorized |

## Verification portfolio

- Contract: package build, tarball consumer, immutable-SHA conformance, exact
  generation mismatch, terminal stream, cancellation, and tool fixtures.
- Branches: sibling leakage, fork before/after checkpoint, edit, regeneration,
  stale digest, missing parent, cycle, incomplete stream, and deletion.
- Context: 200-plus turns, one huge message, images, unresolved user request,
  tool success/error/retry, and over-100-message private requests.
- Product: one-time charging, compaction cost classification, retention/export,
  feature flags, values-free telemetry, and public-engine rollback.
- Browser: English/German desktop and mobile journeys for legacy, public
  boundary, private shadow, and rollback states.

## Unresolved decisions

| Decision | Recommendation | Required before |
| --- | --- | --- |
| Public hard-budget unit | Start with a conservative UTF-8 byte/character budget; add tokenizer support only from evidence | P1 execution plan |
| User visibility | Show a subtle “older context summarized” receipt only when checkpoint `v2` is active; do not expose editable summary text initially | P3.4 |
| Compaction charging | Institution/platform pays shadow and asynchronous compaction; participant charging needs an explicit product ruling | P3.2/P3.3 |
| Retention/export | Checkpoints inherit thread deletion/export and never outlive raw history | P3.2 |
| Hard-threshold behavior | Fail or use deterministic raw fallback initially; do not block on synchronous LLM compaction until latency is proven | P3.3 |

## Execution order

1. Complete P0 on its existing branch and plan.
2. Write and approve the bounded P1 execution plan, then implement and land it.
3. Execute P2 as a public four-layer stack while Catalyst aligns its existing
   stateless `v1` engine independently.
4. Rule the product decisions, then execute P3.1-P3.3 with all functionality
   inert.
5. Integrate Catalyst in shadow mode through P3.4; canary and production
   cutover remain separately authorized.

## Progress

- 2026-08-29: both remotes and forge state were refreshed. The dirty primary
  checkout remains untouched; this roadmap was created from current
  `origin/v3` in an isolated worktree.
- 2026-08-29: the active P0 branch reached `cbe000086`, with S1 and S2 source
  commits present. It is not declared final because its own review, S3, runtime,
  integration, and delivery gates govern completion.
- 2026-08-29: current Mastra and AI SDK documentation, the public and private
  contracts, and stale PR prior art were reviewed. No implementation, upstream
  integration, push, PR, deployment, or live call occurred under this roadmap.
- 2026-08-30: P0 source, tests, ADR, wiki, and correction-range final review are
  complete on its accepted baseline. The roadmap is folded into P0 so the public
  plan ships with its first implementation package instead of remaining an
  untracked planning artifact.
- 2026-08-30: the branch is one non-overlapping commit behind current
  `origin/v3`; upstream integration remains separately gated. Browser proof is
  blocked by host-wide Devsy serialization and a failed workspace mount. The
  exact checkout has zero routes; no raw runtime repair or cleanup was
  attempted.
- 2026-08-30: the public package and Catalyst roadmap updates are locally
  committed. Two direct push attempts and four bounded connectivity checks
  failed because the host could not resolve `github.com`, so draft PR
  publication and
  exact-head CI remain pending. Merge and activation remain withheld.
- 2026-08-30 superseding receipt: the public package is published as draft PR
  #5676, and the companion private roadmap draft is updated with green
  repository checks. A one-command, TLS-validated Git transport override
  bypassed the host resolver without changing persistent host or Git
  configuration. Public checks passed through policy, static, type, and
  security gates at the previous published head; hosted Playwright shards and
  the external review job were still pending before this final documentation
  receipt. The exact public workspace still has zero routes after bounded
  provider-layer Devsy failures, so the corrected PostgreSQL fixture rerun and
  browser smoke remain open evidence gaps. Exact-head CI, upstream integration,
  merge, deployment, and activation remain withheld gates.
- 2026-08-30 OCR follow-up receipt: every automated check at published head
  `4d392fb99`, including all eight hosted Playwright shards, later passed;
  the manual final-review status remained pending. The OCR findings were
  independently verified. The accepted local correction moves Sharp work
  outside the transaction, rechecks source scope and bytes inside it, preserves
  unexpected preview and database errors, returns a lifecycle-clean 409 for
  post-claim conversation conflicts, fences successful finalization to the
  participant-owned thread, validates primitive requests safely, and marks
  preview-only finish metadata as such. Exact retry immutability, fail-closed
  legacy history, and the 64-row model window remain unchanged by design.
  Focused parser/history/lifecycle/route tests passed 65 cases. The full Chat
  suite passed 459 tests with 32 integration tests skipped before one final
  test-only addition; the final authoritative-history unit suite then passed
  all 16 cases. Chat typecheck, focused Biome and Prettier checks, and
  `git diff --check` pass. Commit, immutable correction review, push,
  fresh exact-head CI, PostgreSQL proof, browser smoke, upstream integration,
  merge, deployment, and activation remain pending or separately gated.
- 2026-08-30 correction-review receipt: correction commit `a188cd8fd` is
  clean and passed the repository-native pre-commit gate, including staged
  gitleaks and repository-wide check/lint work. The immutable slice reviewer
  approved with no finding. The simplifier reported no blocker; its sole
  optional suggestion would replace useful parser diagnostics with empty
  `ZodError` instances, so it is declined. The correction does not alter the
  P0 public contract, P1 trigger boundary, or Catalyst dependency seam. Push,
  fresh exact-head CI, integrated final review, PostgreSQL proof, browser
  smoke, upstream integration, merge, deployment, and activation remain
  pending or separately gated.

- 2026-08-30 integrated P0 re-review approved the exact production package
  through `68a86afd2` with no correctness, authorization, privacy,
  concurrency, provider-contract, or roadmap finding. P0R now owns the dated
  legacy-adapter removal. The correction passes 463 Chat tests with 32
  PostgreSQL tests skipped, Chat typecheck, the production build, repository
  pre-commit checks, formatting, and gitleaks. PostgreSQL and exact-head
  browser proof remain evidence gaps. The branch is one non-overlapping
  video-embed commit behind current `origin/v3`; publishing the correction,
  fresh CI, upstream integration, merge, deployment, and activation remain
  pending or separately gated.

- 2026-08-30 exact-head OCR disposition: all automated checks at published
  head `adaf03d91` passed. The five OCR items were verified; two
  behavior-neutral cleanups are committed at `4de9874d3`, while three
  proposed behavior/abstraction changes are rejected to preserve fail-closed
  immutable bindings, transaction semantics, and explicit credit-boundary
  guards. Focused route tests, Chat typecheck, and repository pre-commit checks
  pass. Fresh exact-head CI/OCR and manual final review now precede the
  separately gated PostgreSQL/browser proof and upstream integration.

- 2026-08-30 superseding exact-head OCR disposition: the published public head
  `1aacc1ae9` passed all automated checks and eight hosted Playwright shards.
  The next bounded correction validates base64 payload structure, applies the
  participant/thread ownership relation directly to failed-turn reclaim, and
  documents deliberate effective-root and transaction revalidation semantics.
  Its focused suite passes 51 tests, Chat typecheck and formatting checks pass,
  and six behavior-changing or unnecessary abstraction suggestions are
  declined. Fresh exact-head CI/OCR and the required manual final review still
  precede upstream integration; PostgreSQL and managed-browser proof remain
  separate evidence gaps.

- 2026-08-30 upstream-integration receipt: explicit approval closed both
  repository drift gates without rewriting published history. Public
  `origin/v3` through `e84103606` merged cleanly as `d4455b281`; its two
  upstream commits do not overlap P0. Catalyst `origin/main` through
  `de7342867` merged cleanly as `bf0ac5c24`; the Catalyst PR net diff remains
  its single roadmap file. Public post-integration repository checks and 35
  final-review helper tests pass. Catalyst formatting and both repositories'
  diff and gitleaks checks pass. PostgreSQL/browser proof and exact-head
  publication checks remain public gates; no private implementation, contract
  mutation, deployment, or activation occurred.
