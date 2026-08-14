# Chat LaTeX streaming fix

## Goal

- Hide incomplete LaTeX while an assistant text part is streaming.
- Keep prose before an incomplete formula visible and streaming.
- Reveal a completed formula atomically with KaTeX, without assistant-ui smoothing replay or row remounts.
- Preserve the existing completed-message Markdown, source, tool, and reasoning behavior.
- Publish one follow-up draft PR against `v3`; do not merge it.

## Non-goals

- No change to model routing, source persistence, tool behavior, reasoning disclosure, or backend APIs.
- No new dependency or general Markdown parser.
- No change to the existing unpublished `rs/chat-latex-display-fences` worktree.

## Plan identity

- Branch: `rs/chat-latex-streaming-fix`
- Worktree: `trees/chat-latex-streaming-fix`
- Target: `v3`
- Target SHA at planning: `3581246d12d0a9a19f15c8f7f9b92b5efc150569`
- PR: not created yet
- Related history: [source-terminal fix PR](https://github.com/uzh-bf/klicker-uzh/pull/5393); the unpublished `rs/chat-latex-display-fences` branch is preserved as reference only.

## Research

- Question: Where does streamed Markdown become unstable?
  - Evidence: `apps/chat/src/hooks/useChatResponse.ts` updates one assistant message across text deltas. `apps/chat/src/components/markdown-text.tsx` preprocesses before assistant-ui's `useSmooth` and Markdown parse. A completed delimiter changes the transformed prefix and can make smoothing replay or reset.
- Question: Which assistant-ui seam can prevent the replay?
  - Evidence: `MarkdownTextPrimitive` accepts `preprocess` and `smooth`; `useAuiState` can read the current part status. Turning smoothing off once a supported math opener is present makes the complete processed part render immediately when it closes.
- Question: What test seam proves the transient behavior?
  - Evidence: `playwright/util/chat.ts` supports delayed text chunks and pausing after a chosen chunk. `playwright/tests/Y-chat.spec.ts` already proves stable assistant-row identity.
- Limitation: The local package is assistant-ui 0.14.x, so implementation follows the installed public API rather than a future upgrade.

## Planning-stage review

- Reviewer: configured Sol planner, read-only pass completed before plan creation.
- Finding accepted: preprocess-only masking is insufficient unless the running part status and smoothing behavior are handled together.
- Finding accepted: use a dependency-free linear scanner for `$…$`, `$$…$$`, `\\(...\\)`, `\\[...\\]`, `[/inline]…[/inline]`, and `[/math]…[/math]`; ignore escaped dollars, currency-like `$5`, inline code, and fenced code.
- Finding accepted: browser coverage must observe the paused stream before releasing the closing delimiter, not only assert the final KaTeX tree.
- Finding accepted: port the existing standalone display-fence behavior and persisted regression onto current `v3` rather than cherry-picking the stale branch.

## Primitive impact

- No affected product primitive. This is a presentation-timing correction within the existing assistant text renderer; product identity, ownership, data, tools, sources, and reasoning contracts remain unchanged.

## Skills and documentation

- `$rs-sliced-development-workflow`: full-path plan, tracer-bullet implementation, simplification, and final review.
- `$assistant-ui`: use the installed `MarkdownTextPrimitive`, `useAuiState`, `preprocess`, and `smooth` contracts.
- `$klicker-testing-verification` and `$klicker-playwright-e2e`: focused chat tests, paused-stream Playwright coverage, and browser evidence.
- `$klicker-wiki-maintenance`: update `docs/chat-platform.md`, `.agents/skills/klicker-testing-verification/SKILL.md`, and a new `docs/log/` entry in the same PR.
- `$rs-mr-description-writer`: write the whole-branch draft PR description after verification.
- `$rs-product-primitives`: consulted; no durable primitive is affected.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S0 — clean baseline and plan | `main` | none | Exact target SHA, clean worktree, plan committed first |
| S1 — atomic streamed math | `executor` | S0 | Scanner tests and deterministic paused-stream contract pass |
| S2 — rendering documentation | `executor` (same writer) | S1 | Wiki, skill, log, and formatting validation pass |
| S3 — integration and PR finish | `main` | S1–S2 | Full checks, reviews, browser evidence, draft PR; no merge |

S0 and S3 stay in the main session because they own the critical-path seam, integration, final readiness, and publication authority. S1 and S2 are bounded to this worktree and are independently verifiable.

## Test portfolio

| Risk or behavior | Obligation | Primary seam | Distinct failure caught | Slice |
| --- | --- | --- | --- | --- |
| Supported delimiters hide only an unmatched math tail | add new | `apps/chat/test/streaming-math.test.ts` | Raw delimiters or formula fragments leak, or prose/currency/code is hidden | S1 |
| A closed streamed formula flushes as KaTeX without replay | extend existing | paused `Y-chat.spec.ts` stream with `MutationObserver` | Final-only assertions miss raw partial math, `.katex-error`, or visible formula flicker | S1 |
| Assistant message remains mounted while deltas arrive | retain existing | existing row-identity assertion in `Y-chat.spec.ts` | Renderer remounts during formula closure | S1 |
| Multiline display math does not consume following Markdown | retain/port | persisted assistant message in `Y-chat.spec.ts` | Display-fence normalization absorbs prose or links | S1 |
| Sources, tools, and reasoning remain unchanged | no new test | existing chat coverage plus focused checks | Unrelated rendering contracts regress | S3 |

## Slices

### S0 — clean baseline and plan

- Route: `main` (critical-path coupling)
- Do: use `trees/chat-latex-streaming-fix` at the exact current `origin/v3`; commit this plan alone.
- Check: `git status --short --branch`, `git diff --cached`, and the plan commit contains no unrelated files.
- Commit: `docs(project): add chat LaTeX streaming fix plan`

### S1 — atomic streamed math

- Route: `executor` after S0; main session reviews and verifies the returned changes.
- Do: add the pure scanner, wire status-aware masking and smoothing into `markdown-text.tsx`, add scanner tests, and extend/port the Playwright streamed and persisted display-math regressions.
- Check: focused scanner Vitest, relevant Chat checks, and deterministic Playwright assertions including the paused pre-close DOM and stable row identity.
- Commit: `fix(chat): render streamed formulas atomically`
- Slice review: not required — no security, data-integrity, architecture, cross-system, or irreversible boundary.
- Simplifier: required after the immutable S1 commit.

### S2 — rendering documentation

- Route: `executor` in the same worktree after S1; no unrelated documentation edits.
- Do: update the chat wiki, testing skill, and dated wiki log with verified behavior and test procedure.
- Check: targeted Prettier and OKF validation; inspect the exact diff for scope.
- Commit: `docs(chat): document streamed math rendering`

### S3 — integration and PR finish

- Route: `main` (final readiness and publication authority).
- Do: run fresh checks in the required order, run the integrated final reviewer, handle only verified findings, update the plan progress, create a draft PR against `v3`, and rename the plan to include the PR number.
- Check: `pnpm run check:all`, `pnpm run build`, focused and full chat tests, full `Y-chat.spec.ts`, wiki validation, and real browser visual evidence. Re-run the relevant checks after any review correction.
- Delivery: push branch and create/update a draft follow-up PR; do not mark ready or merge.

## Progress

- Status: S2 in progress; S0 and S1 are committed.
- Completed: Sol planning pass; clean target worktree; plan commit `df8ab28a4`; implementation commit `a89784072`; simplifier reduction commit `f96d37dc8`.
- Evidence: scanner suite passes with 17 tests; targeted Biome and Prettier checks pass; container Playwright remains blocked because Chromium is not installed; the full hook is blocked by the pre-existing generated Chat route-validator syntax error at `.next/dev/types/validator.ts:161`.
- Remaining: finish documentation, run integrated checks and browser verification, obtain final review, create a draft PR, and rename this plan with its PR number.
- Review reports: planning pass complete; simplifier report at `project/_local/reviews/2026-08-14-chat-latex-streaming-s1-simplification.md`; integrated final review pending.
- Active children: none.
- Achieved layer: local implementation branch with immutable S1 and simplification review; no PR or hosted proof yet.
- Next action: commit S2 documentation, then run integrated verification and review.

## Expected PR evidence

- Whole-branch stat and four work-package tests in the PR description.
- Focused scanner test output, Chat test/check/build output, Playwright output, wiki validation output, and screenshots from the real local browser.
- Explicit note that the branch is a follow-up regression fix for streamed LaTeX rendering and that it does not merge the existing source-terminal PR.

## Next steps

- Implement S1 only after the plan commit.
- Run simplification and main-session verification before S2/S3.
- Publish a draft PR when the integrated branch and required review are complete.
