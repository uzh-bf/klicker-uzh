# Chat engine foundation compatibility and lifecycle

## Approval summary

Execute W1 — foundation compatibility and lifecycle from the [approved roadmap](./2026-10-29-chat-api-v3-ai-restack-roadmap.md). The user’s 2026-10-29 instruction, “execute the roadmap independently with a goal,” approves its A1 batch and explicitly requests the active persistent goal. Main owns source integration and the public stack. The terminal for this package is a reviewed, independently verified foundation on `v3-ai`, ready for host and Catalyst consumers; the roadmap owns complete source readiness and later publication ordering.

Preserve the existing public contract authority and explicit transition from `v1` to `v2`. Fix rejected-stream cleanup, interrupted-tool replay and cumulative completed-step usage. The next generation preserves separate allowances for three ordinary images and ten current visual document pages, plus distinct model-only tool projections. Engines retain `v1`; the host selects a generation explicitly after conformance. Default-off participant activation remains binding.

This full-path package reuses Astra’s complete-batch plan critique and focused workflow audit. No new product or architecture decision is open. The roadmap’s named authority, spending/data limits, bounded recovery, checkpoint rules and independent review requirements apply. Merge, PR state changes, deletion and live deployment remain excluded.

## Identity and working context

- Repository: `uzh-bf/klicker-uzh`; branch `codex/mastra-chat-openrouter-smoke`; existing [PR 5126](https://github.com/uzh-bf/klicker-uzh/pull/5126); target `v3-ai`.
- One public execution worktree under `trees/chat-api-v3-ai/`. Main is the only topology/ref writer. The planning worktree and old detached snapshot remain preserved.
- Dependencies: user-approved roadmap and its recorded immutable source baseline. W2 — complete host integration and W3 — external engine compatibility consume this package’s stable reviewed contract; W4 — browser qualification integrates them.
- Portfolio: consume the roadmap’s stream shutdown, replay, known usage, explicit generation and projection rows. Existing API/default-engine/contract suites are the primary seams; no new parallel suite or content-pinning tests.

## Slices and commit boundaries

1. **Target-compatible foundation.** Adopt the exact three existing branches with native stack tooling, checkpoint every affected ref and integrate the held `v3-ai` target bottom-up. Preserve target toolchain/dependency policy and every layer’s incremental ownership. Resolve source conflicts against target semantics, without unrelated cleanup. Acceptance: native mapping is intact, target ancestry holds at the foundation and incremental file sets account for the original deltas. Commit integration/conflict resolutions separately from behavior changes.
2. **Bounded generation lifecycle.** Extend existing `apps/chat-api/src/engine/stream.ts`, its `src/app.ts` caller, default-engine `src/index.ts` and their existing tests. Malformed ordering must cancel actual upstream work and finalize once, including when persistence fails. Incomplete tool pairs must not reach model replay or erase saved visible content. Report completed-step cumulative usage before later cancellation; never sum snapshots twice or fabricate unknown usage. Acceptance: the original defects fail the behavioral regression and the corrected HTTP/resource/replay/accounting seams pass. Commit this coherent correction.
3. **Explicit parity contract.** Extend existing `packages/chat-engine-contract/src/`, fixtures/conformance and default-engine admission/conversion/tool loop. Define `v2` image origins/allowances and separate model projections while keeping strict `v1` validation and compatible routes. Apply host-prepared limits without silent truncation, negotiation or downgrade. Record a scoped superseding ADR in existing `docs/adr/` and index, preserving ADR 0004 and the durable ownership decisions of ADR 0005. Reserve the next ADR number through current repository conventions. Acceptance: both generations pass canonical validation/conformance and actual conversion exercises the distinct payloads. Commit the public contract and default consumer together.
4. **Foundation qualification and review.** Run focused suites, checks and builds at this layer using the repository’s owned container profile. Prove built assets where applicable and inspect the complete incremental diff. Commit corrections before independent lifecycle/integrity/contract review; reuse unaffected evidence. A simplifier is justified only by structural complexity. Record exact committed source, commands, findings and unproved boundaries privately. Required delivery: `reviewed` foundation; leave public publication to the roadmap’s qualified composition sequence.

The slices freeze outcomes, stable seams and acceptance; routine signatures and implementation detail remain with main. New files are limited to this named plan, the approved roadmap and scoped superseding ADR; the roadmap’s existing-module exceptions remain available. No new data model or migration is justified.

## Verification and recovery

Use the roadmap’s verification portfolio and repository-native container commands for `chat-engine-contract`, `chat-api` and `chat-engine-default`. The first useful proof is a schema-valid out-of-order stream whose upstream remains open: cancellation, owned-reader release and one finalization must be observable. Exercise real native HTTP for cancellation transport behavior rather than relying on terminal payload fixtures. Dense validation and conversion remain at their existing contract seams.

The roadmap’s checkpoint/rebase-abort, owner/lease checks, investigation allowance and capability-failure branches govern recovery. Correct this owning layer and propagate natively; do not use an upper-layer fix to clear a failing foundation. A required unavailable gate blocks dependent effects while independent approved work continues. Runtime processes stop and source-path state is verified when their active verification work ends.

## Progress

Current authorized terminal: W1’s reviewed foundation within the user-approved four-package source-readiness goal. Achieved: owned repository-local checkout prepared, source heads confirmed, verified recovery refs retained, and vocabulary change committed separately. The first useful behavioral proof is still pending. Native plan binding is unavailable for the current host root/path; Progress and the active goal retain scope.

Active slice: target-compatible foundation. Next: commit the transferred roadmap and this derived plan, checkpoint the adopted chain, integrate `v3-ai`, then run the lifecycle regression in the smallest owned container. Implementation review and per-layer verification remain pending; no package completion is claimed. Prior roadmap plan critiques cover these unchanged outcomes and authority, so deriving this plan creates no new human checkpoint.
