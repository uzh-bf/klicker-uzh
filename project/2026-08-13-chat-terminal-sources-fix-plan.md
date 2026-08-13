# Chat terminal sources fix

## Problem

Completed `doc_query` results can contain valid sources after an assistant turn
terminates without answer text, but the chat UI still hides the source section.
Mixed aborts can also discard completed tool results when partial text or
reasoning was streamed.

## Evidence

- `apps/chat/src/components/thread.tsx:AssistantMessage` gates
  `SourcesSection` only on non-whitespace answer text.
- `apps/chat/src/components/sources-section.tsx:SourcesSection` already returns
  nothing when normalized sources are empty.
- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:onAbort` currently
  persists completed step content only when no partial text or reasoning exists.
- The history route returns persisted content unchanged and
  `normalizeSourcesFromParts` accepts completed persisted `doc_query` calls.
- The existing live browser contract proves source cards stay hidden between
  tool completion and the first answer text; it lacks the terminal tool-only
  case.

## Decision

- Keep sources hidden only while the assistant message is actively running and
  has no non-whitespace answer text:
  `!(status.type === 'running' && !hasAnswerText)`.
- Once the turn is terminal, including `complete` or `incomplete`, show any
  normalized sources even when the message has no answer text. The source
  component remains responsible for the empty-source case.
- Preserve finished steps in canonical order during abort persistence. Track
  only the current unfinished step's streamed text and reasoning separately,
  then persist finished-step parts followed by those unfinished text/reasoning
  parts. Do not persist unfinished tool calls or duplicate finished output.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected consumers | Evidence |
| --- | --- | --- | --- | --- |
| Assistant turn lifecycle | extend | Terminal incomplete turns expose valid source provenance; active pre-answer turns do not | Thread rendering, reloaded history, source cards | assistant-ui status contract and current `AssistantMessage` gate |
| Source provenance from tool results | reuse | No new source field or ownership; completed tool results remain the source of truth | `SourcesSection`, citation chips, persisted messages | `normalizeSourcesFromParts` and existing source tests |

No new product primitive is needed.

## Package and authority

- Package: one focused follow-up fix for the merged chat source-availability
  contract; full-path implementation because it changes executable UI, abort
  persistence, tests, and documented behavior.
- Branch: `rs/chat-terminal-sources-fix`.
- Worktree: `trees/chat-terminal-sources-fix`.
- Base: `origin/v3` at `3581246d12d0a9a19f15c8f7f9b92b5efc150569`.
- Local commits are authorized. Push, PR creation/update, readiness, merge,
  and deployment are not authorized by this plan.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S0 — isolated worktree and plan | main | merged `v3` base | plan is the first branch commit |
| S1 — terminal source visibility | executor | S0 | status-aware predicate; persisted tool-only browser regression; existing pre-answer hidden test remains green |
| S2 — mixed-abort preservation | executor | S1 | focused helper tests prove ordering, no duplication, retained partial text/reasoning, and sanitized errors |
| S3 — docs and integrated proof | main | S1 and S2 | wiki/skill/log updates, focused checks, full checks as feasible, real browser screenshots |

## Test portfolio

| Risk | Obligation | Primary seam | Distinct failure caught |
| --- | --- | --- | --- |
| Sources appear before answer generation | extend existing | Playwright paused live stream | A source section renders while status is `running` and answer text is empty |
| Terminal tool-only sources remain hidden | add new | Playwright persisted/reloaded thread | A completed source-bearing tool call has no answer text and must still expose source cards |
| Mixed abort loses or duplicates content | add new | Vitest abort-content helper | Finished tool results disappear, streamed text/reasoning duplicate, or ordering changes |
| Tool errors become sources | retain existing | persisted content/source normalizer tests | Sanitized failed results qualify as source data |

## Slices

### S1 — terminal-aware source visibility

- Route: executor with owned paths `apps/chat/src/components/thread.tsx` and
  `playwright/tests/Y-chat.spec.ts`.
- Implement the exact status-aware gate and add a persisted tool-only source
  regression. Keep the paused live-stream assertion that source cards are
  absent before answer text.
- Check: focused Playwright chat test and relevant formatter/type checks.
- Commit: `fix(chat): show sources after terminal tool-only turns`.
- Slice review: not required; presentation-only behavior with existing
  streaming coverage, while the integrated final review covers the changed UI.
- Simplifier: required after the substantive slice.

### S2 — mixed-abort persistence

- Route: executor with owned paths in `route.ts`, a small server helper, and
  focused tests.
- Extract or extend a pure abort-content assembly seam. Preserve finished-step
  parts, append only current unfinished text/reasoning, and derive reasoning
  metadata from the assembled content. Preserve `SAFE_TOOL_ERROR` behavior.
- Check: focused Vitest, then the full chat suite if the focused seam is green.
- Commit: `fix(chat): preserve sources on mixed aborts`.
- Slice review: required because this changes persisted assistant content and
  source data integrity; one read-only slice reviewer covers that boundary.
- Simplifier: required after the substantive slice.

### S3 — documentation and integrated proof

- Route: main; documentation and cross-slice integration are coupled to the
  verified behavior.
- Update `docs/chat-platform.md`, the relevant testing skill source contract,
  and one dated `docs/log/` entry. Do not broaden `docs/testing.md` unless the
  test seam changes its documented procedure.
- Check: focused tests, chat suite, `pnpm run check:all`, `pnpm run build` as
  feasible, and real local devrouter/browser verification with screenshots of
  the pre-answer hidden and terminal tool-only visible states.
- Commit: `docs(chat): document terminal source visibility`.
- Integrated final review: one read-only `final-reviewer` after verification.

## Progress

- Status: plan committed; isolated worktree created.
- Completed: base/ref check, planning-stage challenge, and plan commit
  `ba8b1b197`.
- Active: S1 — terminal-aware source visibility.
- Remaining: S1, S2, S3, simplification/reviews, integrated verification.
- Delivery layer: local committed branch only.
- Blockers: none known; do not publish without explicit authorization.
