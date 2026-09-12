# Active-branch chat history rail

- Status: ready for draft PR; merge not authorized
- Branch: `rs/chat-history-rail`
- Worktree: `trees/chat-history-rail`
- Base: `origin/v3` at `fec2d38d0d4de7edd34b740275f6b5a9ed515b06`
- Current head: `cb515f991` (`fix(chat): reveal collapsed tool groups from history rail`)
- Handoff: `~/.handoffs/klicker-uzh/2026-08-14-chat-history-rail-handoff.md`

## Goal

Add a read-only history rail to `apps/chat` that visualizes the currently
selected conversation path. It shows user and assistant turns plus meaningful
reasoning, tool, and status steps; each entry scrolls to and focuses its
transcript anchor; the active entry is highlighted; and the presentation works
on desktop and in a collapsed mobile form.

The rail is a derived view of the existing active path. It does not add
`parentId` fields, persistence, API calls, schema changes, Catalyst behavior,
compaction, or sibling-branch visualization.

## Research and decisions

- `useChatStore` already exposes the selected branch as `activeThread.messages`.
  `switchToBranch` reconstructs that path from `allMessages`; the rail should
  consume only `messages` so switching or regenerating replaces the projection
  automatically.
- `MessagePrimitive.Root` already emits the stable `data-message-id` anchor.
  User and assistant roots will add a rail-specific focus target, while
  grouped reasoning and individual tool-call leaves receive deterministic part
  anchors derived from message id plus part identity.
- `MessagePrimitive.GroupedParts` exposes group indices and stable tool-call
  ids. The existing reasoning/tool grouping remains intact; the rail adds
  wrappers only where a meaningful part target is needed.
- Product boundary: no new durable product primitive is required. This is a
  derived navigation projection over the existing ChatThread, active branch,
  and message identity.

## Work packaging and delegation

This is one full-path package because the projection, transcript anchors, rail
interaction, responsive layout, and browser proof share one UI seam. The main
session owns the critical-path implementation and integration. A bounded
planner pass was attempted but timed out twice; the main session is using the
verified codebase evidence as the read-only fallback. No secrets, PII, or
external side effects are in scope.

## Slices

1. **Projection and tests** — add a pure active-path projection with stable
   message/part keys, previews, and normalized running/partial/error states;
   cover branch replacement, empty/partial content, and duplicate-free output
   in `apps/chat/test`.
2. **Transcript anchors and rail UI** — integrate the projection into
   `thread.tsx` and `message-parts.tsx`; add keyboard-accessible desktop and
   mobile navigation, click-to-scroll/focus, current-entry tracking, and
   loading/aborted behavior without changing message persistence.
3. **Localization and documentation** — add matching EN/DE rail strings and
   update `docs/chat-platform.md` plus the required dated wiki log.
4. **Verification and review** — run focused tests, typecheck/format checks,
   browser verification at desktop and mobile widths in EN and DE, and inspect
   the final diff. Run the required simplifier and final review gates on the
   completed implementation before presenting it as complete.
5. **Long-thread collapse refinement** — replace the unbounded marker feed for
   large histories with bounded decorative ticks, one current-item trigger, and
   an on-demand full-history dialog. Keep the existing anchors and viewport-only
   navigation. Route: main, because the responsive UI and focus contract share
   one component seam. Acceptance: a 100-entry fixture remains visually sparse,
   and first/last navigation works on desktop, mobile, keyboard, and reduced
   motion.

## Test portfolio

- Pure projection tests: user/assistant ordering; grouped reasoning; stable
  tool ids; running, partial, error, empty, and aborted content; no duplicate
  entries; and branch/path replacement.
- Existing chat package tests: `pnpm --filter @klicker-uzh/chat test:run`.
- Browser: seeded local chatbot, accepted disclaimer, at least one completed
  conversation; verify desktop rail visibility, entry navigation and focus,
  active highlight, branch/path replacement, and streaming/partial state; then
  verify the collapsed mobile rail and EN/DE labels at 1440x900 and 390x844.
- Finish checks: package check, formatting check, relevant lint/build checks,
  and a final staged/diff hygiene review if a commit is requested.

## Acceptance

- Every rail entry maps to the correct active-path message or meaningful part.
- Clicking or keyboard-activating an entry lands on and focuses its transcript
  target; the current entry remains visibly and semantically highlighted.
- Switching branches, editing/regenerating, streaming, loading, aborting, and
  partial/error responses do not crash, duplicate, or retain stale rail items.
- Desktop, mobile, keyboard, reduced-motion, and EN/DE behavior are verified in
  the browser.
- No API, schema, persistence, branch-tree, or unrelated-worktree changes.

## Progress

- [x] Reconciled handoff, remote base, branch, and clean isolated worktree.
- [x] Bootstrapped and started the exact devrouter stack with a fresh database.
- [x] Captured the untouched seeded-chat baseline in the browser.
- [x] Implement pure projection and tests.
- [x] Integrate anchors and rail UI.
- [x] Update localization and wiki documentation.
- [x] Run local verification; final branch review is scheduled against the
  immutable committed range before PR handoff.
- [x] Implement and verify the long-thread collapse refinement.
- [x] Address Agy's low-severity scroll-spy performance finding and rerun the
  focused chat verification.
- [x] Address Agy's collapsed-tool-group navigation finding and rerun the exact
  public-head review.

## Verification evidence

- `pnpm --filter @klicker-uzh/chat check` passed after the final code changes.
- Latest `pnpm --filter @klicker-uzh/chat test:run` passed: 38 files and 310
  tests.
- `pnpm run check` passed: 24 workspace check tasks.
- `pnpm --filter @klicker-uzh/chat build` passed with Turbopack.
- Focused Biome and Prettier checks passed; `git diff --check` passed.
- Browser evidence covers the seeded desktop and 390x844 mobile layouts,
  click-to-scroll/focus, current highlighting, local assistant error state,
  reduced-motion navigation, and EN/DE labels. The local environment has no
  upstream model key, so live model-backed streaming, reasoning, and tool
  content remain unverified.
- Follow-up visual pass reduces the desktop rail to a 32px marker gutter with
  40px transcript spacing and changes mobile navigation to a small content-width
  control with a dedicated top gutter, so the rail no longer overlays messages.
- Sol's read-only review identified the active 224px two-line preview card as
  the remaining invasive element. It was reduced to a single-line max-160px
  pill while preserving the 32px rail and 28px mobile hit areas.
- A 100-message local browser fixture verified that the desktop marker list and
  mobile strip reveal the active endpoint. It also exposed outer-root scrolling
  during navigation; navigation now scrolls only the transcript viewport so the
  rail remains fixed at long-thread endpoints. The fixture thread was deleted
  after verification.
- The second Sol review confirmed the remaining density problem: a 100-entry
  list is still a second feed. The accepted direction is bounded decorative
  ticks with one current-item trigger and full text navigation only on demand.
- The 100-entry browser pass now shows 12 desktop ticks and 6 mobile ticks,
  opens a 100-row dialog on demand, focuses the current row, supports keyboard
  movement and Escape-to-trigger, and keeps the small three-entry fallback
  unchanged. The Sol report is persisted at
  `project/_local/reviews/2026-08-14-chat-history-rail-sol-review.md`.
- The follow-up Codex-style pass bounds the desktop collapsed rail to a
  centered 144px cluster. Each landmark is now a compact hover/focus target
  with a title and preview; the current landmark remains the single-line
  trigger for the full-history dialog. A 100-entry browser fixture verified
  the centered desktop layout, active and inactive hover details, landmark
  navigation, and the compact mobile control.
- The final chat package test run passed 38 files and 310 tests, the chat
  typecheck passed, and the chat production build passed with Turbopack. The
  synthetic fixture was deleted and confirmed absent from the database after
  browser verification.
- `pnpm run check:all` was attempted but its analytics lint task could not
  build pinned `pandas` because the DevPod has no C compiler; the isolated
  chat and workspace TypeScript checks passed independently.
- The pre-commit mutable-tree review gate was deferred because no commit was
  authorized at that stage; the final review is scheduled against the exact
  pushed PR range.
- Agy reviewed the exact public PR head `cb515f991` with Gemini 3.7 Flash at
  high effort and returned `APPROVE`. The review accepted the navigation-time
  reveal of collapsed tool groups, while noting that it expands all collapsed
  tool groups in the owning assistant message as low-severity future polish.
  It also noted outside-click dismissal as optional UX and an informational
  redundant screen-reader span; none blocks this PR. A fresh authenticated
  browser pass after the correction was limited by a Turbopack panic in the
  seeded PWA login route; the prior 100-message desktop/mobile screenshots and
  navigation evidence remain valid for the unchanged layout path.
