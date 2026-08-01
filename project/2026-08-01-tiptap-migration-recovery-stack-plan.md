# Tiptap Migration Recovery Stack Plan

## Identity

- **Goal:** Replace the unmergeable Tiptap migration in [PR #5148](https://github.com/uzh-bf/klicker-uzh/pull/5148) with a clean, source-backed GitHub stack.
- **Target:** `v3` at `7812fa71ce7a11aae1d987627190d95e44ef814f`.
- **Worktree:** `trees/tiptap-migration-recovery/`.
- **Stack:** `rs/tiptap-core-migration` → `rs/tiptap-rich-markdown` → `rs/tiptap-editor-compatibility`.
- **Source:** `migrate-editor-to-tiptap` at `5ad6681508c92680e75ed5e30937c5ebf09fd925`; its PR and branch are frozen as comparison-only input.
- **Related future work:** the approved editor UX roadmap begins only after this stack lands, in a separate three-layer stack (shell, links, commands).

## Boundaries

- **Problem:** The source PR combines a Slate-to-Tiptap migration, rich Markdown features, and late compatibility fixes in one stale, conflict-dirty branch.
- **Decision:** Reapply the source patch in three dependency-ordered work packages from current `v3`; do not cherry-pick the source branch or its merge commits wholesale.
- **Decision:** Prefer exact source commits and hunks. A non-verbatim change requires one of: a current-`v3` conflict, a layer boundary, or a verified defect; record it in the parity audit.
- **Non-goal:** Do not add new editor product features, change stored-content format, migrate content, or begin W1–W3 in this stack.
- **Risk:** `ContentInput` writes author content. Each layer must preserve Markdown persistence, avoid synthetic `onChange` calls during mount/sync/disabled changes, and receive browser and E2E evidence before it can advance.

## Research

- **Evidence:** Source core commit `635f16b43` is the direct Slate-to-Tiptap replacement. Source rich-content commit `e0734c93c` adds tables/code, and `0f99fe79f` adds rich-content Playwright coverage.
- **Evidence:** The final source state removes table cell merging and persisted resizing because Markdown cannot round-trip either; it adds `immediatelyRender: false`, Markdown-typed content boundaries, legacy-empty normalization, clipboard safeguards, and React selection subscriptions.
- **Evidence:** The source patch relative to its PR base changes 42 files. Comparing its stale head directly with current `v3` produces unrelated changes from the branch's old base; that comparison must never be copied.
- **Evidence:** `klicker-frontend-ui`, `klicker-playwright-e2e`, and `klicker-testing-verification` require Markdown round trips, `data-cy`, a real browser, and targeted Playwright validation.
- **Limitation:** Context7 is unavailable in this environment. Use the version-pinned source implementation and the repository's Tiptap guidance; do not infer new Tiptap APIs.

## Source-to-Stack Coverage Ledger

| Source patch area | Destination | Handling |
| --- | --- | --- |
| `apps/frontend-manage/package.json`, `packages/shared-components/package.json`, `pnpm-lock.yaml`, deleted Slate declarations/converter | Core | Start from source commit `635f16b43`; retain the final source's single aligned Tiptap version only if current lockfile reconciliation requires it. |
| `ContentInput.tsx` Slate replacement, direct callers (`GroupActivityGradingStack`, `ElementContentInput`, `ElementExplanationField`, `CaseStudyCasesFields`, `ChoicesOptions`, `pages/questions/[id]`) | Core | Copy the source core implementation, including existing toolbar/media behavior and `data-cy` boundaries. Bring forward only the final source lifecycle hunks required for safe SSR and Markdown persistence. |
| `ContentInput.tsx` table/code extensions and controls; `apps/frontend-manage/src/globals.css`, `apps/frontend-pwa/src/globals.css`, `packages/markdown/src/Markdown.tsx`, `packages/i18n/messages/{de,en}.ts` | Rich Markdown | Reapply source commit `e0734c93c` and later source safety fixes. Keep only controls that persist as GFM: insert/delete table, add/delete rows/columns, delete table, and fenced code with language. Never reintroduce merge or resize UI. |
| `playwright/tests/ZA-editor-rich-features.spec.ts`, rich portions of `0-video-embed.spec.ts` and `G-elements-mc.spec.ts`, and `playwright/util/fixtures/elements.ts` paste helper | Rich Markdown | Reuse source tests/helpers for Markdown round trips, supported embeds, table/code authoring, and paste precedence. |
| Final `ContentInput.tsx` compatibility hunks: external content synchronization, Formik-safe updates, legacy `'<br>'` handling, dynamic placeholder, selection state, Markdown paste/clearing, and pasted table-span expansion | Compatibility | Selectively apply the source fixes in their final form. This layer may not invent a new editor architecture. |
| `playwright/util/actions.ts`, remaining `playwright/util/fixtures/elements.ts`, and existing workflow specs `F`, `H`, `J`, `K`, `L`, `MA`, `O`, `P`, `Q`, `S`, `V` | Compatibility | Preserve test intent; copy the source contenteditable keyboard-clear and helper adaptations needed by real authoring workflows. |
| `.agents/skills/tiptap/SKILL.md`, `skills-lock.json`, `.gitignore`, and affected frontend/Playwright skill guidance | Core then Compatibility | Copy source guidance only where it describes shipped behavior. The `.reference/` ignore rule travels with the Tiptap guidance. |
| `docs/frontend-conventions.md` and `docs/testing.md` | Rich Markdown then Compatibility | Reapply only the still-true Markdown/clipboard/editor contracts, preserving current `v3` documentation added after the source branch diverged. |
| `docs/log.md` and `project/2026-07-10-pr-5148-tiptap-editor-finalization-plan.md` | Deliberate exclusion | Do not copy stale historical entries or the source finalization plan. This plan and its progress replace them; the final parity audit will state that substitution. |

## Approved Slices and Commit Boundaries

### Slice A1 — Core Markdown editor migration

- **Do:** Commit this plan first. Then apply source commit `635f16b43` selectively, reconcile it with current `v3`, and carry forward only source lifecycle code necessary for safe initial use: SSR-safe Tiptap initialization, Markdown content boundaries, no update emission from external sync, and existing caller contracts.
- **Check:** Package/type checks in the DevPod; targeted Playwright helper compilation/listing; a seeded Manage editor browser run covering initial content, editing, disabled state, and save/reopen; source-diff review.
- **Commit:** `refactor(manage): migrate core rich-text editor to tiptap`.
- **Gate:** Foundation review and simplification before moving to A2. Pause only if that review finds a content-integrity or current-base conflict that changes the approved boundary.

### Slice A2 — Markdown-safe rich content

- **Do:** Apply source rich-content commits/hunks for GFM table and fenced-code authoring, shared preview rendering, styles, translations, and dedicated coverage. Keep the source's final Markdown-safe restriction: no merged cells and no persisted column widths.
- **Check:** Focused Markdown tests; app type checks; rich feature Playwright spec; browser screenshots for table/code authoring and saved preview; source-diff review.
- **Commit:** `enhance(editor): support Markdown-safe tables and code blocks`.

### Slice A3 — Compatibility and workflow hardening

- **Do:** Apply the remaining source compatibility commits/hunks and existing-flow Playwright updates. Preserve Formik, paste, legacy-content, placeholder, selection-state, and contenteditable-clear behavior without adding new user-facing controls.
- **Check:** Targeted affected Playwright specs, `pnpm run check:all`, `pnpm run build`, real browser evidence, and source-union audit against the 42-file source patch.
- **Commit:** `fix(editor): harden Tiptap authoring workflows`.

## Verification and Review

- **Tooling:** Run dependency-backed checks inside the DevPod via `devrouter ensure .` / `devrouter exec . -- …`; use `npx agent-browser` for the required browser proof.
- **Per layer:** Review staged data and diffs for secrets/PII, run the fastest relevant checks first, commit only layer files, then obtain separate code review and simplification review against the committed range.
- **Final stack:** Perform the routine code-level security review and maintainability review required by repository policy. Do not perform a broad security assessment without new user approval.
- **Parity audit:** Compare the stack union with `git diff --name-status c8de9c89782e8aa63b612538a3508c0d4a73cab3 5ad6681508c92680e75ed5e30937c5ebf09fd925`; enumerate source-only and stack-only paths, and explain all intentional differences.
- **Publication:** Create draft PRs only after their respective layer commits and checks. Do not merge, close, alter, or delete PR #5148 or its branch.

## Progress

- **2026-08-01 — active:** User approved the two-stack topology and source-copy constraint. Live base fetched at `7812fa7`; dedicated worktree and native three-layer stack created. Next: commit this plan, have it reviewed, then apply the source core commit onto A1.
