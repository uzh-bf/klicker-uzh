# Chat Conversation Stability Plan

## Goal

Prepare one focused PR that removes the reported chat conversation flicker during
streaming and feedback interactions, preserves rating semantics, and leaves the
already-merged mode-aware starter change intact. The PR must be ready for review
with repository checks, browser evidence, Sol's final review, and green CI.

## Non-goals

- Do not rewrite the mode-aware starter copy or prompt contract from PR #5349.
- Do not patch the STG cluster, ArgoCD, ReplicaSets, image digests, or any
  external deployment system.
- Do not change RAG prompts, model routing, credits, auth, or assistant-ui's
  broader runtime architecture.
- Do not add dependencies or batch stream updates without a measured repro that
  still needs it after the causal render fixes.

## Plan identity

- Plan path: `project/2026-08-10-chat-conversation-stability-plan.md`
- Branch: `rs/chat-stability-fix`
- Target branch: `v3`
- PR: not opened yet
- Base: `origin/v3` at `338763a41393eb1e773bdb43efcfac3ef4e43334`
- Related history: PR #5349 (mode-aware starters), promotion PR #5350
- Worktree: `trees/chat-stability-fix`

## Problem and evidence

- The authenticated STG page still rendered the pre-#5349 starters after the
  promotion PR merged and after a cache-busting navigation.
- GitHub `v3` contains the new `practiceTopic`, `workThroughProblem`,
  `explainConcept`, and `compareConcepts` source and the STG values file carries
  release `8565b047cc9b` in all 15 annotations.
- `docs/ci-and-deployment.md` identifies ArgoCD as external to this repository;
  no repository evidence currently identifies a source or workflow defect.
- Therefore the stale STG bundle is an external release-runtime gate, not a
  second starter implementation. Recheck it after the new image is deployed.
- Sol's prior diagnosis found broad Zustand subscriptions, an inline assistant
  message component map, per-delta store publications, and two optimistic
  feedback owners as the causal render paths to test.

## Planning-stage review

- Reviewer: Sol planner `Hume`, read-only, on the live worktree before this plan
  was created.
- Verdict: `DONE_WITH_CONCERNS`.
- Accepted findings:
  - Keep the STG mismatch outside the implementation diff unless new evidence
    proves repository ownership.
  - Narrow only causal subscriptions and stabilize the message-component map
    and runtime adapters; do not sweep the sidebar without profiler evidence.
  - Make Zustand the sole feedback owner with plain buttons, retaining
    persisted rating metadata, serialization, and rollback.
  - Make stream batching conditional on the post-fix browser measurement.

## Research and feedback loop

- Browser repro: a delayed multi-delta stream and a feedback click must record
  assistant-message DOM identity, animation state, and render/commit counts.
- Baseline: run the repro against this branch before the behavior fix; if the
  browser fixture cannot fail on the baseline, stop and revise the hypothesis.
- Deployment boundary: use GitHub source/promotion evidence and the authenticated
  STG browser only; do not infer Argo health from the merged annotation.
- Review rubric: `/Users/rschlae/.homesick/repos/dotfiles/home/.local/share/agent-skills/rs-sliced-development-workflow/references/review-rubric.md`.

## Approved slices

### Slice 1: Plan and red-capable repro

Files:

- This plan file.
- Existing chat Playwright fixtures/specs only if the baseline repro has a
  correct seam.

Do:

- Establish the delayed streaming and feedback interaction that can go red on
  remounts or repeated commits.
- Keep existing starter tests unchanged; they already cover the merged source
  contract.

Check:

- Baseline reproduces the user's flicker symptom or the exact DOM remount/
  animation restart signal.

Commit:

- `docs(project): plan chat conversation stability fix`

### Slice 2: Isolate conversation rendering and feedback state

Files:

- `apps/chat/src/app/RuntimeProvider.tsx`
- `apps/chat/src/components/assistant.tsx`
- `apps/chat/src/components/thread.tsx`
- `apps/chat/src/hooks/useThreadManagement.ts`
- `apps/chat/src/hooks/useChatResponse.ts` only for store-selector changes
- `apps/chat/test/chat-store-rating.test.ts`
- `docs/chat-platform.md`
- `docs/log/2026-08-10-chat-conversation-stability.md`

Do:

- Replace broad store subscriptions at the runtime and direct parents with
  selectors for the state each surface actually renders.
- Keep the assistant message component type and component map stable across
  runtime updates, while retaining the chatbot avatar through stable context.
- Memoize runtime adapters so feedback and attachment adapter identities do not
  change on every message update.
- Remove assistant-ui feedback optimism from the path and make Zustand own set,
  switch, clear, persistence, serialization, and rollback through plain buttons.

Check:

- Chat tests plus the focused browser repro pass; active vote, vote switching,
  clearing, persistence, and failed-request rollback remain covered.
- Browser screenshots cover the changed conversation and feedback states.

Commit:

- `fix(chat): stabilize streamed conversations and feedback`

### Slice 3: Conditional stream publication batching

Do only if Slice 2's browser evidence still shows multiple message-content
commits per animation frame or visible streaming jitter.

Files:

- `apps/chat/src/hooks/useChatResponse.ts`
- A small scheduler module and focused test if the seam is cleaner than inline
  state.
- `apps/chat/test/chat-response-hydration.test.ts` or the scheduler test.

Do:

- Coalesce text and reasoning deltas to one publication per frame.
- Flush before tool lifecycle, error, abort, and finish transitions so semantic
  state is immediate and no stale scheduled update can overwrite final state.

Check:

- A red/green test proves latest-delta coalescing and terminal flush behavior.
- The original browser stream repro is visibly stable after the change.

Commit:

- `fix(chat): coalesce streamed message updates`

### Slice 4: Finish and release handoff

Do:

- Update the chat wiki and dated log with the render ownership and verification
  boundary.
- Run targeted chat tests, browser evidence, `pnpm run check:all`, and
  `pnpm run build` using the repository's supported environment.
- Review staged content for secrets, PII, generated churn, and unrelated user
  changes.
- Obtain Sol's integrated final review on the exact committed range, resolve and
  verify every finding, then open a ready PR with substantive size and evidence.

Check:

- Required CI is green; no claim of STG starter runtime success is made until a
  fresh deployed browser run shows the new labels and composer-only behavior.

## Progress

- [x] Confirmed merged source and STG promotion annotation.
- [x] Reproduced stale pre-#5349 starter labels in a fresh authenticated STG
  chat after cache-busting navigation.
- [x] Received Sol planning-stage review and accepted the scope boundaries.
- [ ] Commit this plan before implementation.
- [ ] Establish and red-test the local/browser flicker repro.
- [ ] Implement and verify Slice 2.
- [ ] Decide whether Slice 3 is needed from measurement.
- [ ] Run full verification, Sol final review, and open the ready PR.

## Hardest decision and rejected alternatives

- Hardest decision: keep the observed STG starter mismatch as an external
  rollout gate instead of mixing unverified deployment changes into the chat
  render fix.
- Rejected: another starter rewrite, assistant-ui-owned optimism, blanket
  sidebar subscription cleanup, and unconditional stream batching.
- Least confident area: whether stable identities and causal selectors alone
  remove all streaming jitter; the browser repro decides whether Slice 3 runs.
