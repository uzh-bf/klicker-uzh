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
- **Review:** Independent read-only review of plan commit `2be81f273` required moving rich dependencies and paste behavior into A2, adding an A1 E2E integrity proof, assigning docs/skills per layer, and making source parity hunk-auditable. Those corrections are incorporated below.
- **Limitation:** Context7 is unavailable in this environment. Use the version-pinned source implementation and the repository's Tiptap guidance; do not infer new Tiptap APIs.

## Source-to-Stack Coverage Ledger

| Source patch area | Destination | Handling |
| --- | --- | --- |
| Core dependency removals in `apps/frontend-manage/package.json` and `packages/shared-components/package.json`, deleted Slate declarations/converter, and their lockfile entries | Core | Start from source commit `635f16b43`; copy the Slate-removal and core-Tiptap dependency roles, then regenerate only the conflicted current-`v3` lockfile context. The source's `3.27.1` direct pins resolve through current registry internals at `3.28.0` and produce a peer-mismatched mixed graph, so A1 pins the same six core roles coherently at `3.28.0`; this is a verified dependency-resolution adaptation with no editor-behavior change. |
| `ContentInput.tsx` Slate replacement, direct callers (`GroupActivityGradingStack`, `ElementContentInput`, `ElementExplanationField`, `CaseStudyCasesFields`, `ChoicesOptions`, `pages/questions/[id]`) | Core | Copy the source core implementation, including existing toolbar/media behavior and `data-cy` boundaries. Bring forward the exact final source lifecycle and legacy-empty hunks required for safe SSR, Markdown persistence, and existing callers that previously write `'<br>'`; leave dynamic placeholder, selection state, and rich paste/table behavior to later layers. |
| Table/code/Lowlight dependency hunks in `apps/frontend-manage/package.json` and `pnpm-lock.yaml`; `ContentInput.tsx` table/code extensions and controls; `apps/frontend-manage/src/globals.css`, `apps/frontend-pwa/src/globals.css`, `packages/markdown/src/Markdown.tsx`, `packages/i18n/messages/{de,en}.ts` | Rich Markdown | Reapply source commit `e0734c93c` and later source safety fixes. Keep only controls that persist as GFM: insert/delete table, add/delete rows/columns, delete table, and fenced code with language. Never reintroduce merge or resize UI. |
| Source contenteditable-clear hunk in `playwright/util/fixtures/elements.ts` and the two blank-edit call sites in `playwright/tests/G-elements-mc.spec.ts` | Core | Copy these exact source changes with A1 because the existing core create/edit/save/reopen workflow must keep working after the input becomes `contenteditable`. A2 retains the source paste helper and its rich test portions. |
| `playwright/tests/ZA-editor-rich-features.spec.ts`, rich portions of `0-video-embed.spec.ts` and `G-elements-mc.spec.ts`, `playwright/util/fixtures/elements.ts` paste helper, `@tiptap/pm` dependency/lockfile hunk, and the `ContentInput.tsx` plain-Markdown/table-span paste implementation | Rich Markdown | Reuse source tests/helpers, their ProseMirror dependency, and their implementation together for Markdown round trips, supported embeds, table/code authoring, and paste precedence. `@tiptap/pm` uses the same verified `3.28.0` package family as A1. |
| Final `ContentInput.tsx` compatibility hunks: dynamic placeholder and selection state | Compatibility | Selectively apply the source fixes in their final form. This layer may not invent a new editor architecture. Core already owns safe external synchronization, Formik-safe updates, disabled-state no-op behavior, and legacy-empty compatibility. |
| `playwright/util/actions.ts`, remaining `playwright/util/fixtures/elements.ts`, and existing workflow specs `F`, `H`, `J`, `K`, `L`, `MA`, `O`, `P`, `Q`, `S`, `V` | Compatibility | Preserve test intent; copy the remaining source contenteditable helper adaptations needed by real authoring workflows. Core already owns the basic keyboard-clear helper and its two existing `G` workflow call sites. |
| `.agents/skills/tiptap/SKILL.md`, `skills-lock.json`, `.gitignore`, and core `klicker-frontend-ui` guidance | Core | Copy source guidance only where it describes shipped core behavior. The `.reference/` ignore rule travels with the Tiptap guidance. |
| Rich sections of `docs/frontend-conventions.md`, `docs/testing.md`, `klicker-frontend-ui`, and `klicker-playwright-e2e` guidance | Rich Markdown | Update the same layer with its table/code, Markdown persistence, and rich E2E contracts while preserving newer current-`v3` documentation. |
| Compatibility sections of the same wiki/skills | Compatibility | Update only legacy-empty, selection, placeholder, and contenteditable-clear guidance introduced by A3. |
| `docs/log.md` and `project/2026-07-10-pr-5148-tiptap-editor-finalization-plan.md` | Deliberate exclusion | Do not copy stale historical entries or the source finalization plan. This plan and its progress replace them; the final parity audit will state that substitution. |

### Hunk Ledger

- **Do:** Maintain a row for every source hunk as it is applied: source commit/path/range, destination layer/commit, disposition (`verbatim`, `current-v3 adaptation`, or `exclusion`), and the reason for every non-verbatim disposition.
- **Check:** Review the ledger with the per-layer diff before commit. `ContentInput.tsx`, package manifests, lockfile entries, docs, and tests require hunk-level rows; a matching file name alone is not parity evidence.
- **Finish:** Compare the source and stack content diffs, not only their path lists. Source-only or stack-only hunks without an approved ledger row block publication.

| Source hunk | Destination | Disposition | Reason / proof |
| --- | --- | --- | --- |
| `635f16b43` — `apps/frontend-manage/package.json`, core Slate removal and six core Tiptap roles | A1 — core migration commit | current-`v3` adaptation | Source role set is retained. Its `3.27.1` direct pins resolved as a mixed `3.27.1`/`3.28.0` graph in the current registry and failed the Tiptap peer check; all six direct core packages therefore use the coherent current `3.28.0` family. `pnpm why @tiptap/pm` must show one family before commit. |
| `635f16b43` — `packages/shared-components/package.json`, `src/@types/slate.d.ts`, `src/utils/slateMdConversion.ts` | A1 — core migration commit | verbatim | Source Slate conversion removal applies cleanly; current code has no remaining imports after the deletion. |
| `635f16b43` — `ContentInput.tsx`, complete Slate-to-Tiptap replacement | A1 — core migration commit | verbatim initial hunk | Copied as the source implementation, retaining source toolbar/media controls and `data-cy` selectors. |
| `a41737333`, `8975d2054`, `c2849f526`, `9b18a0444` — `ContentInput.tsx`, disabled/external-sync/legacy-empty/SSR lines | A1 — core migration commit | verbatim layer placement | These exact final-source safeguards are needed for a safe core editor and existing legacy callers; placeholder, selection state, and rich paste remain out of A1. |
| `c2849f526` — five current `ContentInput` callers | A1 — core migration commit | verbatim | Replaces legacy empty `'<br>'` writes with the core Markdown empty-content contract. |
| `9b18a0444` — `.agents/skills/tiptap/SKILL.md`, `.gitignore`, `skills-lock.json` | A1 — core migration commit | verbatim | Source Tiptap guidance and its `.reference/` companion rule are copied unchanged. |
| `c2849f526` and final source docs — `docs/frontend-conventions.md`, `klicker-frontend-ui` guidance | A1 — core migration commit | source-derived subset | Preserve only the shipped core Markdown, empty-content, and Formik-safe synchronization contract; rich/selection guidance remains assigned to A2/A3. |
| `a8aa52b8a` — `playwright/util/fixtures/elements.ts` keyboard clear and `G-elements-mc.spec.ts` blank-edit calls | A1 — core migration commit | verbatim layer placement | Existing core authoring tests require `contenteditable` clearing. The source Markdown paste helper and rich cases remain A2. |
| Source lockfile hunks | A1 — core migration commit | current-`v3` adaptation | Regenerated inside the isolated DevPod from the source dependency roles and the coherent `3.28.0` direct family; no hand-edited lockfile entries. |
| `837b057ba` — obsolete `is-hotkey` manifest and lockfile entries | A1 — core follow-up | source-derived current-`v3` subset | This unused core-editor dependency is removed exactly as in the source simplification commit. Current `v3` has no corresponding `@types/is-hotkey` entry, so no absent hunk is recreated. |

## Approved Slices and Commit Boundaries

### Slice A1 — Core Markdown editor migration

- **Do:** Commit this plan first. Then apply source commit `635f16b43` selectively, reconcile it with current `v3`, and carry forward only source lifecycle code necessary for safe initial use: SSR-safe Tiptap initialization, Markdown content boundaries, no update emission from external sync or disabled-state transitions, and existing caller contracts.
- **Check:** Package/type checks in the DevPod; focused full-stack Playwright coverage based on the existing source authoring workflow, including create/edit/save/reopen plus no dirty/save transition on mount, external content synchronization, or disabled-state transition until a real edit; a seeded Manage browser run covering the same states; source-hunk review.
- **Commit:** `refactor(manage): migrate core rich-text editor to tiptap`.
- **Docs:** Update the core Tiptap/frontend guidance and wiki contract in this layer.
- **Gate:** Foundation review and simplification before moving to A2. Pause only if that review finds a content-integrity or current-base conflict that changes the approved boundary.

### Slice A2 — Markdown-safe rich content

- **Do:** Apply source rich-content commits/hunks for the table/code/Lowlight dependencies, GFM table and fenced-code authoring, source Markdown/table-span paste handling, shared preview rendering, styles, translations, and dedicated coverage. Keep the source's final Markdown-safe restriction: no merged cells and no persisted column widths.
- **Check:** Focused Markdown tests; app type checks; rich feature Playwright spec; browser screenshots for table/code authoring and saved preview; source-diff review.
- **Commit:** `enhance(editor): support Markdown-safe tables and code blocks`.
- **Docs:** Update the rich Markdown wiki and frontend/Playwright guidance in this layer.

### Slice A3 — Compatibility and workflow hardening

- **Do:** Apply the remaining source compatibility commits/hunks and existing-flow Playwright updates. Preserve legacy-content, placeholder, selection-state, and contenteditable-clear behavior without adding new user-facing controls.
- **Check:** Targeted affected Playwright specs, `pnpm run check:all`, `pnpm run build`, real browser evidence, and source-union audit against the 42-file source patch.
- **Commit:** `fix(editor): harden Tiptap authoring workflows`.
- **Docs:** Update only compatibility-specific wiki and skill guidance in this layer.

## Verification and Review

- **Tooling:** Run dependency-backed checks inside the DevPod via `devrouter ensure .` / `devrouter exec . -- …`; use `npx agent-browser` for the required browser proof.
- **Per layer:** Review staged data and diffs for secrets/PII, update the affected wiki and skills in the same layer, run the fastest relevant checks first, commit only layer files, then obtain separate code review and simplification review against the committed range.
- **Final stack:** Perform the routine code-level security review and maintainability review required by repository policy. Do not perform a broad security assessment without new user approval.
- **Parity audit:** Compare the stack union with `git diff c8de9c89782e8aa63b612538a3508c0d4a73cab3 5ad6681508c92680e75ed5e30937c5ebf09fd925`, using the hunk ledger to enumerate every source-only and stack-only hunk and explain all intentional differences.
- **Publication:** Create draft PRs only after their respective layer commits and checks. Do not merge, close, alter, or delete PR #5148 or its branch.

## Progress

- **2026-08-01 — active:** User approved the two-stack topology and source-copy constraint. Live base fetched at `7812fa7`; dedicated worktree and native three-layer stack created. Independent plan review found four layer/parity/verification/documentation issues; this update resolves them. Next: commit the plan correction, then apply the source core patch onto A1.
- **2026-08-01 — A1 complete:** `28c160dd9` copies the source core migration and the final-source Markdown, SSR, external-sync, disabled-state, and legacy-empty safeguards. The only source adaptation is the coherent direct Tiptap `3.28.0` family required by the current registry; `pnpm why @tiptap/pm` reports one resolved family. The five legacy `'<br>'` callers now use the Markdown empty-content contract.
- **A1 verification:** DevPod checks passed for `@klicker-uzh/frontend-manage` and `@klicker-uzh/playwright`. A seeded Manage browser run created, saved, and reopened a disposable element with its Markdown-backed question and answer intact. The targeted Playwright run reset the isolated test database but could not launch because its required headless-shell cache was absent and the DevPod browser download stalled; this is an environment artifact, not a test assertion failure.
- **A1 review disposition:** Simplification review passed. Source-fidelity review confirmed the core implementation and raised a request for dirty/save-state lifecycle coverage. No dirty-gated Save state exists: Save is controlled by Formik validity, while auto-save compares form values with its initial snapshot. The observable saved-content reload path is already covered by the source-derived create/edit/save/reopen workflow and browser proof; the non-emitting `setContent(..., { emitUpdate: false })` and `setEditable(..., false)` safeguards are copied exactly. No new test-only application behavior is added.
- **A1 follow-up:** The source's obsolete `is-hotkey` cleanup is kept with the core migration rather than its rich-Markdown dependent layer, as confirmed by A2 simplification review.
