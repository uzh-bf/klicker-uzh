# Assistant UI 0.15 upgrade

## Goal

Upgrade the `apps/chat` assistant-ui dependency line from 0.14 to 0.15 while
preserving the existing custom `useExternalStoreRuntime` integration and all
observable chat behavior. This branch is a behavior-preserving dependency/API
migration; it does not add the planned long-session history rail or compaction.

## Plan identity

- Branch: `rs/assistant-ui-015-upgrade`
- Target: `v3` (`b1ea5ecba8aa835d6639ae3717a2aa456f470fc9`)
- Plan: `project/2026-08-12-assistant-ui-015-upgrade-plan.md`
- PR: [#5382](https://github.com/uzh-bf/klicker-uzh/pull/5382)
- Related history: `project/plans_wip/PLAN-chat-assistant-ui-upgrade-v0.11.md`
  and `project/2026-07-23-student-chat-v3-production-readiness-plan.md` record
  the earlier 0.11 and 0.14 upgrades; they are historical context, not active
  plans for this branch.

## Research

- Evidence: npm registry on 2026-08-12 reports the newest versions that satisfy
  the repository's 14-day `minimumReleaseAge` guard as
  `@assistant-ui/react@0.15.1` (published 2026-07-29),
  `@assistant-ui/react-markdown@0.14.8` (published 2026-07-28), and
  `zustand@5.0.14` (published 2026-05-28). The newer 0.15.14/0.14.10 patches
  were published 2026-08-12/2026-08-08 and remain ineligible without an
  explicit repository policy change.
- Evidence: official migration guide
  <https://www.assistant-ui.com/docs/migrations/v0-15> removes legacy runtime
  hooks, makes scope accessors properties, removes `ToolsState.tools` and the
  `mcp-app` group key, and keeps `ThreadPrimitive.Empty`/`If`, primitive
  `components` props, and `MessagePrimitive.Content` deprecated.
- Limitation: remote fetch could not update `.git/FETCH_HEAD` because of a
  local permission error. `git ls-remote origin refs/heads/v3` and the local
  `origin/v3` ref both resolve to the target SHA above.
- Decision: stay on the 0.15 line. Do not upgrade `ai`, `@ai-sdk/openai`,
  `@ai-sdk/mcp`, React, Next.js, or unrelated dependencies.

## Product and architecture impact

- Product primitives: none. The migration changes dependency APIs and keeps
  the same chat thread, message, composer, source, rating, attachment, and
  persistence compositions.
- Architecture: preserve `useExternalStoreRuntime` in
  `apps/chat/src/app/RuntimeProvider.tsx`; do not install the AI SDK adapter or
  change transport ownership.
- ADRs: preserve historical rationale in `docs/adr/0003-chat-framework-upgrade.md`.
  Update current-version statements in `docs/chat-platform.md` and
  `docs/architecture-overview.md` only.

## Test portfolio

| Risk or behavior | Obligation | Stable seam | Distinct failure | Owning slice |
| --- | --- | --- | --- | --- |
| Removed assistant-ui exports and selector/action shapes | extend existing | chat package typecheck | compile failure or wrong v0.15 scope mapping | API migration |
| Peer graph and production bundle resolution | extend existing | chat build | incompatible package or lockfile resolution | dependencies |
| Existing chat rendering and state behavior | none | existing Vitest and Playwright suites plus browser smoke | behavior regression in streaming, editing, attachments, sources, ratings, or persistence | browser proof |
| Current documentation version claims | none | targeted search and Markdown formatting | stale current-version guidance | documentation |

## Slices

### 1. Dependency and API migration

- Route: main session; the cross-file API migration and runtime seam are coupled.
- Do: update `apps/chat/package.json` and `pnpm-lock.yaml` to
  `@assistant-ui/react@0.15.1`, `@assistant-ui/react-markdown@0.14.8`, and
  explicit `zustand@5.0.14`. Migrate removed hooks in
  `thread.tsx`, `message-parts.tsx`, and `useMessageSources.ts` to
  `useAui`/`useAuiState` and direct scope actions, including attachment-hook
  mappings. Replace `ThreadPrimitive.Messages components`,
  `ComposerPrimitive.Attachments.components`, `ThreadPrimitive.Empty`, and
  `MessagePrimitive.If` with the documented render-function/state-selector
  forms. Retain `MessagePrimitive.Content` only if the installed 0.15 types
  confirm it remains the correct content renderer, and document that rationale
  in the plan progress rather than rewriting historical ADRs.
- Check: under Node 24 in the task devcontainer, run
  `pnpm --filter @klicker-uzh/chat check`,
  `pnpm --filter @klicker-uzh/chat test:run`, and
  `pnpm --filter @klicker-uzh/chat build`; run a final removed/deprecated API
  search across `apps/chat`.
- Commit: `build(chat): upgrade assistant-ui to 0.15`.
- Test delta: no new tests expected; existing coverage remains the primary
  stable seam.

### 2. Documentation and browser proof

- Route: main session; real local runtime and browser evidence are required for
  this frontend-facing change.
- Do: update only stale current-version claims in `docs/chat-platform.md` and
  `docs/architecture-overview.md`. Reconcile the named devrouter worktree and
  use `npx agent-browser@0.32.2` against its routed chat URL.
- Check: capture before/current screenshots where a baseline is available and
  verify empty welcome, persisted thread opening and switching, message send
  and streaming, abort, attachments, source/tool rendering, copy state,
  editing/regeneration branching, ratings, and reload persistence. Record
  exact environment gaps when an upstream model key or another dependency
  prevents a journey. Run `pnpm run check:all` and `pnpm run build` after all
  touched files are complete.
- Commit: `docs(chat): update assistant-ui version guidance` if documentation
  is a separate change; otherwise include it in the implementation commit only
  when the branch remains independently reviewable.
- Test delta: no new tests expected.

## Review and finish gates

- Planning-stage review: completed with `DONE_WITH_CONCERNS`; report is
  `project/_local/reviews/2026-08-12-assistant-ui-015-upgrade-planning-stage-v2.md`.
- Slice review: not required unless implementation reveals a changed trust
  boundary, data-integrity boundary, public contract, or cross-system seam.
- Simplifier: run after the substantive implementation slice using the exact
  committed range and changed-hunk manifest.
- Final review: run one combined/integrated final reviewer after fresh checks,
  covering correctness, plan compliance, maintainability for code-bearing
  files, and architecture/security only if the final diff changes those
  surfaces. Keep the branch unpublished unless separately authorized.

## Progress

- 2026-08-12: takeover revalidated `v3`, created the named worktree, confirmed
  registry/docs evidence, and completed the planning-stage review. No
  implementation has started.
- 2026-08-13: Slice 1 implementation complete under Node 24. The normal
  repository release-age guard selected `@assistant-ui/react@0.15.1`,
  `@assistant-ui/react-markdown@0.14.8`, and `zustand@5.0.14`; the source now
  uses `useAui`/`useAuiState`, `AuiIf`, and children render functions for the
  removed hooks and deprecated primitive props. `MessagePrimitive.Content`
  remains because it is still present in the installed 0.15 API and is outside
  the removed-hook migration surface.
- Focused evidence: chat typecheck passed, 231 chat tests passed, ESLint passed
  with the existing image-optimization warnings, formatting passed, and a
  frozen lockfile check passed. The lockfile contains the assistant-ui 0.15
  transitive closure required by the package manager; no release-age override
  is used.
- 2026-08-13: The required simplifier reviewed `d20c41376..252e71931` and
  justified consolidating the duplicate thread/edit composer attachment
  renderers. The behavior-preserving reduction is committed as `283a1c6`.
- 2026-08-13: Browser evidence through `agent-browser@0.32.2` verified
  namespaced login, empty state, disclaimer acceptance, message persistence,
  copy state, and edit/cancel/attachment controls. The recreated runtime's
  upstream model execution was unavailable, so successful streaming, abort,
  source/tool rendering, and ratings remain unproven; see
  `project/_local/reviews/2026-08-13-assistant-ui-015-upgrade-browser.md`.
- 2026-08-13: Fresh Node 24 chat gates passed: typecheck, 31 test files with
  231 tests, lint with five existing warnings and no errors, and production
  build. The initial integrated final review returned `DONE_WITH_CONCERNS`.
-  Its stale wiki sentence was corrected. The final root Node 24 build passed
  all 22 tasks. The final root `check:all` reached the repository checks but
  stopped in analytics lint because the runtime has no C compiler to rebuild
  `pandas`; this environment limitation is recorded with the exact command
  output, while the earlier host pre-commit `check:all` passed after a fresh
  install. That correction review is retained as earlier evidence; the
  current exact-range review is recorded below.
- 2026-08-14: Rebased the implementation onto current `v3` at
  `b1ea5ecba8aa835d6639ae3717a2aa456f470fc9`, which includes the merged
  self-hosted application fonts and the recent chat UX changes. The rebase
  preserved the current mode-aware welcome/thread surface and added the
  assistant-ui 0.15 source-visibility compatibility fix in
  `b41e6c299d4d935216b438d315723fd10290fccb`.
- Current-head evidence at `b41e6c299`: Node 24 chat typecheck passed, the
  chat suite passed with 35 files and 295 tests, the chat production build
  passed, and the no-cache Docker chat installer build passed. The build only
  emitted existing middleware, missing-local-model-env, and Dockerfile-format
  warnings.
- The two required current-head source-card Playwright cases reached database
  cleanup and seeding but could not launch because the devcontainer lacked
  Playwright's pinned Chromium headless-shell executable. Installing that
  artifact was attempted but did not complete in the available runtime;
  canonical CI browser evidence remains required. No test or application code
  was changed for this environment limitation.
- 2026-08-14: The exact-range integrated final review of
  `b1ea5ecba..b41e6c299` found no actionable source, maintainability,
  dependency-security, architecture, or data-flow defect. It requested only
  current-head evidence and this progress update; the review is recorded in
  `project/_local/reviews/2026-08-14-assistant-ui-015-upgrade-integrated-final-rebase.md`.
