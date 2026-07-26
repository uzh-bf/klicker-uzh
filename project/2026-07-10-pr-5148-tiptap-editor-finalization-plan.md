# PR #5148 Tiptap Editor Finalization Plan

Goal: finish [PR #5148](https://github.com/uzh-bf/klicker-uzh/pull/5148) with correct Markdown round-trips, stable form state, green Playwright, resolved review findings, current `v3`, browser evidence, accurate PR copy.

## Plan Identity

- Plan: `project/2026-07-10-pr-5148-tiptap-editor-finalization-plan.md`
- Local takeover branch: `codex/pr-5148-finalization`
- PR head branch: `migrate-editor-to-tiptap`
- Target: `v3`
- PR: [#5148](https://github.com/uzh-bf/klicker-uzh/pull/5148)
- Starting PR head: `b40fc33db`
- Starting merge base: `bd6df485b`
- Current `origin/v3` at planning time: `eef745d06`
- Starting divergence: `v3` ahead by 2; PR branch ahead by 12.
- Older repo plan: none found for PR #5148 or Tiptap migration.
- Prior external handoff: reviewed; live Git/PR/CI state overrides it.

## Goal

- Keep stored content Markdown-compatible.
- Keep editor mount, prop sync, and programmatic normalization from marking Formik fields dirty.
- Keep genuine user edits observable exactly once through current `onChange` callback.
- Keep supported toolbar actions keyboard-accessible and disabled when editor disabled.
- Keep GFM tables and common-language code highlighting.
- Remove UI capabilities that cannot survive Markdown save/reload.
- Restore all affected Playwright workflows without skips, weakened assertions, or timeout inflation.
- Finish with all required CI green, review threads answered, screenshots attached, human approval outstanding only.

## Non-Goals

- No storage migration from Markdown to HTML or Tiptap JSON.
- No raw-HTML persistence path.
- No merged-cell support unless a deterministic round-trip proves existing Markdown pipeline preserves it.
- No broad answer-collection redesign.
- No unrelated Playwright cleanup.
- No dependencies beyond the Tiptap/Lowlight migration set; no unrelated major upgrades.
- No history rewrite or force-push without explicit user approval.
- No PR merge without explicit user approval.

## Current Evidence

- PR state: open, non-draft, `MERGEABLE`, `BEHIND`, `REVIEW_REQUIRED`.
- Failing branch CI: [Playwright run 28933101672](https://github.com/uzh-bf/klicker-uzh/actions/runs/28933101672).
- Passing exact merge-base CI: [Playwright run 28927821772](https://github.com/uzh-bf/klicker-uzh/actions/runs/28927821772).
- Branch failures repeat on retry; same pre-existing tests pass merge base. Treat as branch regressions until disproved.
- Failed paths:
  - `V-template.spec.ts`: answer-option controls absent.
  - new `ZA-editor-rich-features.spec.ts`: preview container absent.
  - `K-elements-selection.spec.ts` and `L-elements-case-study.spec.ts`: new accordion helper throws.
  - `T-resources.spec.ts`: answer-option search absent.
  - `MA-elements-operations.spec.ts`: recovered-data prompt appears after no-op editor flows.
- GitGuardian failure points at local-dev credentials introduced into branch history by a `v3` merge; files do not differ in feature diff. Do not print values. Resolve incident as base-history/dev-test false positive unless fresh scan proves feature introduction.
- Unresolved reviews:
  - [Merged cells do not round-trip](https://github.com/uzh-bf/klicker-uzh/pull/5148#discussion_r3538352953).
  - [Lowlight full bundle](https://github.com/uzh-bf/klicker-uzh/pull/5148#discussion_r3542985359).
  - stale duplicate merged-cell thread remains unresolved/outdated; resolve with current thread after fix.
- Latest CodeRabbit summary also flags:
  - possible stale `onChange` closure in `useEditor`.
  - `ToolbarButton` rest props overriding computed `disabled`.
- Existing PR body uses local `file://` links and lacks reviewer-visible screenshots.
- Current `v3` overlap: `AGENTS.md` changed on both sides; `git merge-tree` shows no conflict markers. Re-read merged result anyway.

## Research

### R1. Tiptap lifecycle and form contract

- Question: which editor events represent user content edits versus initial creation or programmatic sync?
- Evidence:
  - Tiptap defines separate `onCreate`, `onUpdate`, `onTransaction`, focus, and blur lifecycle hooks: [official lifecycle example](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/extensions/custom-extensions/create-new/extension.mdx).
  - Local `ContentInput` forwards every `onUpdate` to parent Formik field.
  - Local `EditorField` marks touched on every parent callback.
  - Answer-collection accordion refuses state changes while metadata/options touched.
- Limitation: docs reviewed do not settle whether React `useEditor` refreshes callback props for pinned `3.27.1`.
- Local applicability: Slice 2 must prove callback freshness and event origin using a deterministic repro before choosing ref, `setOptions`, or transaction filtering.

### R2. Markdown capability boundary

- Question: can Tiptap table merged-cell attributes survive `getMarkdown()` and GFM renderer round-trip?
- Evidence:
  - Tiptap Markdown support is extension-defined through parser/renderer hooks and should be covered with parse/serialize integration tests: [Markdown extension guide](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/markdown/guides/integrate-markdown-in-your-extension.mdx).
  - Tiptap table model supports merge/split commands, but reviewed Markdown docs provide no merged-cell serialization contract.
  - Current app saves `editor.getMarkdown()` and renders GFM Markdown.
  - Current rich-feature spec claims merged-cell coverage but never executes merge/split.
- Limitation: official docs do not explicitly say “merged cells unsupported in Markdown.”
- Local applicability: Slice 4 first proves actual round-trip. Default decision: remove merge/split control when structure is lost.

### R3. Syntax-highlighting bundle

- Question: full language bundle or common subset?
- Evidence:
  - Lowlight supports `common` (37 languages), `all` (190+), or explicit registration: [official README](https://github.com/wooorm/lowlight/blob/main/readme.md).
  - `common` includes JavaScript, TypeScript, Python, R, SQL, GraphQL, shell, YAML, JSON, and other expected teaching languages.
- Limitation: no product-owned supported-language list exists.
- Decision: use `common`; avoid custom allow-list until product requirement exists.

### R4. Branch synchronization

- Question: merge current `v3` or rewrite branch?
- Evidence:
  - Branch contains three historical `v3` merges.
  - Current base delta touches `AGENTS.md` plus devcontainer, CI fallback, and seed-script files; no editor files.
  - Force-push would invalidate history/review context and requires explicit approval.
- Decision: normal merge from current `origin/v3`; preserve history. Rebase only explicit fallback if GitGuardian cannot be resolved and maintainer approves force-push.

## Grill Findings / Decisions

- Canonical persisted format: Markdown.
- Tiptap document: editing representation, not new persistence contract.
- No-op contract: mount, external prop sync, disabled-state sync, and Markdown normalization must not call form-level `onChange`.
- User-edit contract: actual content edit must call latest parent callback once with serialized Markdown.
- Table contract: only structures surviving save/reload stay exposed.
- Helper contract: open action must be idempotent. Never retry by blindly toggling accordion.
- Test contract: existing test intent/count preserved. No skip, deletion, assertion weakening, or timeout-only “fix.”
- Browser contract: manage editor, answer-collection modal, saved preview, student renderer verified as user sees them.
- Branch contract: local takeover branch pushes explicitly to existing PR head only after approval and local gates.
- Security contract: review changed Markdown pipeline and sanitizer allow-list explicitly; permit no broader raw HTML path.
- Domain model: no new domain terms or irreversible architecture decision. No `CONTEXT.md` or ADR needed.

## Skill Routing

- Plan/delivery: `rs-sliced-development-workflow`, `caveman` basic.
- Scope: `grill-with-docs`; no domain glossary edits needed.
- Diagnosis: `diagnose` before behavioral fixes.
- UI: `klicker-frontend-ui`, `agent-browser`.
- Tests: `klicker-testing-verification`, `klicker-playwright-e2e`, `playwright-best-practices`.
- Docs: `klicker-wiki-maintenance`.
- React/performance review: `vercel-react-best-practices`.
- UI/a11y review: `web-design-guidelines`.
- Per slice: independent review agent, then separate simplification agent.
- Finish security: `security-review` plus `security-best-practices`; threat model unnecessary unless fix changes trust boundary.
- Final maintainability: `thermo-nuclear-code-quality-review`.
- PR copy: `rs-mr-description-writer` plus `humanizer`.
- Completion proof: `verification-before-completion`.

## Approval and Mutation Gates

1. Plan approval:
   - User reviews this file.
   - After approval: commit plan alone.
   - Commit: `docs(project): add PR 5148 finalization plan`.
2. Remote push:
   - Local branch differs from PR head branch name.
   - Push only with explicit refspec to `origin/migrate-editor-to-tiptap` after local gates.
3. History rewrite:
   - Never force-push without separate explicit approval.
4. GitGuardian:
   - External incident resolution may require maintainer access.
   - No code/history rewrite solely to silence false positive without evidence and approval.
5. PR merge:
   - Never merge without explicit user approval after final evidence.

## Slice 1 — Current Baseline on Latest `v3`

Outcome: fixes start from current target and deterministic failing loops.

- Do:
  - Commit approved plan alone.
  - Fetch refs; record exact PR head and target SHA in `Progress`.
  - Merge current `origin/v3` normally into local takeover branch.
  - Resolve only genuine overlap; inspect full `AGENTS.md` result.
  - Run `pnpm install --frozen-lockfile` only if lock/dependency state requires it.
  - Confirm browser path before UI work:
    - preferred: repo devcontainer/DevPod plus devrouter.
    - fallback: documented host Playwright stack.
    - environment failure routes to `klicker-environment-doctor`.
  - Build three focused feedback loops with traces/screenshots:
    - no-op/auto-save prompt (`MA-elements-operations`).
    - answer-collection accordion (`K-elements-selection`).
    - rich editor save/preview (`ZA-editor-rich-features`).
  - Reproduce before changing behavior. If local environment cannot reproduce, use downloaded CI trace/error context as loop and document limitation.
- Files:
  - merge result only.
  - this plan `Progress`.
- Check:
  - `git diff --check origin/v3...HEAD`.
  - `git status --short`.
  - focused Playwright commands with `--project=chromium` and exact `--grep` titles.
  - app health probes before test attribution.
- Stop condition:
  - no deterministic failure signal and no usable CI trace. Report blocker; do not guess.
- Review:
  - merge-result review for accidental branch scope changes.
  - simplification review: reject unrelated conflict cleanup.
- Commit:
  - merge commit for `origin/v3` plus factual `Progress` update.

## Slice 2 — No-Op Editor Mount Stays No-Op

Outcome: editor lifecycle preserves Formik dirty/touched state while real edits still persist.

- Diagnose:
  - Rank and test 3–5 hypotheses before fix:
    1. initialization/plugin normalization emits update.
    2. external `setContent`/normalization causes update loop or semantic mismatch.
    3. `useEditor` holds stale `onChange` callback.
    4. toolbar/form event changes touched state independently.
  - Change one variable per probe.
  - Tag temporary logs `[DEBUG-pr5148-editor]`; remove before commit.
- Do:
  - Add/strengthen regression at real Playwright seam before fix.
  - Ensure initial Markdown parse and programmatic prop sync emit no parent change.
  - Ensure user edit emits one serialized Markdown value.
  - Keep latest callback without recreating editor unless proven necessary.
  - Keep `EditorField` unchanged unless evidence shows contract belongs there.
  - Preserve `emitUpdate: false` for external sync.
  - Destructure toolbar `disabled` prop so rest spread cannot override computed state.
- Likely files:
  - `apps/frontend-manage/src/components/common/ContentInput.tsx`.
  - `playwright/tests/MA-elements-operations.spec.ts` only if sharper regression needed.
  - `playwright/tests/ZA-editor-rich-features.spec.ts` for Markdown no-op/load-save coverage.
  - `apps/frontend-manage/src/components/activities/creation/EditorField.tsx` only with evidence.
- End-to-end path:
  - open new/edit element -> make no edit -> close/reopen -> no recovery prompt.
  - open answer collection -> untouched metadata -> options accordion opens.
  - edit content -> save/reopen -> Markdown content preserved.
- Check:
  - focused three auto-save tests in `MA-elements-operations.spec.ts`.
  - first failing `K-elements-selection` path.
  - stored Markdown no-op round-trip assertion.
  - TypeScript check for `frontend-manage` and Playwright.
- Review:
  - correctness review: lifecycle, callback freshness, update recursion, Formik contract.
  - simplification review: prefer small boundary fix over flags/state machine.
- Commit:
  - `fix(editor): preserve form state during content sync`.

## Slice 3 — Stable Playwright Interaction and Preview Coverage

Outcome: tests exercise real behavior reliably; branch-only helper and preview failures removed.

- Do:
  - Make `openAnswerCollectionOptions` idempotent:
    - return when already open.
    - inspect stable expanded/visible state.
    - click once when closed.
    - wait for expected option control.
    - no blind toggle loop.
  - Reuse helper in K/L only where current branch changed calls.
  - Treat unchanged V-template failure as expected indirect dirty-state fallout from Slice 2; investigate test code only if behavior fix does not clear it.
  - T-resources has a separate helper with an early-open check but the same blind retry toggle. Change it only if failure remains after Slice 2 and evidence points at retry behavior.
  - Diagnose `ZA-editor-rich-features` preview failure:
    - capture URL, route state, GraphQL response, console, screenshot.
    - use explicit manage base URL or existing navigation helper when relative navigation targets wrong app/state.
    - wait for real save/navigation completion, not arbitrary delay.
  - Make spec description match assertions. Remove false “cell merging” claim unless tested.
  - Keep test count and intent.
- Files:
  - `playwright/util/actions.ts`.
  - `playwright/tests/K-elements-selection.spec.ts`.
  - `playwright/tests/L-elements-case-study.spec.ts`.
  - `playwright/tests/ZA-editor-rich-features.spec.ts`.
  - `apps/frontend-manage/src/pages/questions/[id].tsx` only if product route is wrong, not merely test navigation.
- End-to-end path:
  - edit answer collection -> options opens once -> all existing permission/deletion assertions run.
  - create rich content -> save -> direct manage preview -> table/code visible.
- Check:
  - Prettier on touched Playwright files.
  - Playwright TypeScript check.
  - test discovery/list.
  - focused ZA, K, L specs.
  - T and V failing tests when runtime budget permits; mandatory in CI.
- Review:
  - test-quality review: no timeout inflation, retries hiding app bugs, selector weakening, or lost coverage.
  - simplification review: one helper, minimal call-site churn.
- Commit:
  - `test(playwright): stabilize Tiptap editor workflows`.

## Slice 4 — Markdown-Safe Feature Boundary

Outcome: every exposed table/code feature survives persistence; bundle and toolbar findings closed.

- Do:
  - Prove merged-cell round-trip before product change:
    - create table.
    - merge cells.
    - inspect serialized Markdown.
    - save/reopen and compare structure.
  - If structure is lost, remove merge/split toolbar action and unused i18n keys. Do not add HTML storage workaround.
  - Keep add/delete row/column and delete-table actions only after normal table round-trip passes.
  - Change `createLowlight(all)` to `createLowlight(common)`.
  - Verify JavaScript/TypeScript plus at least one non-JS common language in both editor (lowlight/HLJS) and preview (Prism).
  - Confirm language without dedicated custom CSS token rules still renders legibly; extend generic token styling only when browser evidence requires it.
  - Recheck `aria-label`, `aria-pressed`, native button semantics, disabled behavior, focus order, tooltips.
  - Update affected wiki and skill in same PR:
    - `docs/frontend-conventions.md`: Markdown persistence boundary and supported table behavior.
    - `.agents/skills/klicker-frontend-ui/SKILL.md` or `.agents/skills/klicker-playwright-e2e/SKILL.md`: only procedural gotcha proven by implementation.
    - `docs/log.md`: dated update.
- Files:
  - `apps/frontend-manage/src/components/common/ContentInput.tsx`.
  - `apps/frontend-manage/src/globals.css`.
  - `apps/frontend-pwa/src/globals.css`.
  - `packages/markdown/src/Markdown.tsx`.
  - `packages/i18n/messages/de.ts`.
  - `packages/i18n/messages/en.ts`.
  - `playwright/tests/ZA-editor-rich-features.spec.ts`.
  - affected wiki/skill files.
- End-to-end path:
  - lecturer authors Markdown-safe table/code -> save -> manage preview -> student renderer matches.
- Check:
  - i18n pair check.
  - focused rich-feature Playwright spec.
  - browser desktop plus narrow viewport.
  - English and German toolbar labels if keys change.
  - `pnpm --filter @klicker-uzh/frontend-manage build` or repo-equivalent filtered build.
  - `bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs` plus Prettier on touched docs/skills.
- Review:
  - `vercel-react-best-practices` for editor render/bundle choices.
  - `web-design-guidelines` for keyboard/a11y/toolbar behavior.
  - simplification review: no custom Markdown extension or language allow-list without requirement.
- Commit:
  - `fix(editor): enforce Markdown-safe rich content`.

## Slice 5 — Full Regression and CI Closure

Outcome: local evidence complete; remote PR checks green or exact external blocker isolated.

- Local verification, ordered:
  1. `pnpm run check:all`.
  2. `pnpm run build`.
  3. Playwright formatting/typecheck/list commands from `klicker-playwright-e2e`.
  4. Focused specs: `MA`, `K`, `L`, `T`, `V`, `ZA`.
  5. Real-browser verification with `npx agent-browser`.
- Browser evidence:
  - editor initial Markdown load.
  - untouched close/reopen with no recovery prompt.
  - answer-collection metadata -> options accordion.
  - table add/delete controls.
  - code block highlight.
  - saved manage preview.
  - student/PWA Markdown rendering.
  - disabled editor toolbar.
  - desktop and mobile/narrow viewport.
  - both locales when visible strings change.
- Artifact rule:
  - store screenshots in reviewer-accessible PR attachment/comment flow, not local `file://` paths.
- Push gate:
  - verify clean status and expected commit list.
  - explicit push to `origin/migrate-editor-to-tiptap` only after user-approved execution and local gates.
- Remote verification:
  - watch full PR checks.
  - all 8 Playwright shards must pass.
  - no rerun-only acceptance for deterministic failure.
  - compare any remaining failure with current `v3` run before classification.
- GitGuardian:
  - confirm finding still references base-history/dev-test credential only.
  - maintainer marks incident false positive/accepted test credential.
  - if check cannot be cleared, stop at decision gate: maintainer override versus approved history rewrite.
- Review threads:
  - answer current merged-cell, lowlight, callback, and disabled-state findings with evidence.
  - resolve outdated duplicate only after current thread resolution.
- Commit:
  - behavior/docs already committed per slices.
  - factual plan progress update may use `docs(project): record PR 5148 verification`.

## Slice 6 — Final Review and PR Handoff

Outcome: PR ready for human approval; no hidden process debt.

- Do:
  - Run mandatory security review:
    - `packages/markdown/src/Markdown.tsx`: re-enabled `remarkGfm`/`rehypePrism` pipeline and `code.className` sanitizer allow-list.
    - image URL handling unchanged.
    - no raw HTML expansion.
    - dependency diff and lockfile sanity.
  - Run independent final branch review against `origin/v3...HEAD`.
  - Run separate simplification review.
  - Run `thermo-nuclear-code-quality-review`.
  - Integrate accepted findings one at a time; explicitly defer invalid/YAGNI findings with reason.
  - Re-run affected verification after every accepted change.
  - Update plan `Progress` to `ready_for_review` with exact commands, CI URLs, screenshot links, review results, residual risks.
  - Use `rs-mr-description-writer` for whole-branch PR body:
    - compare full commit history and diff to `v3`.
    - remove local file links.
    - summarize storage contract and removed unsupported behavior.
    - include exact local/CI verification.
    - include screenshots.
    - include manual checks and `Next Steps`.
  - Reassess title against whole branch. Recommended if tables/code remain new user capability: `feat(editor): migrate rich text editor to Tiptap`; otherwise retain accurate `refactor(manage)` title.
  - Confirm every actionable PR comment/review handled.
- Final merge-ready gates:
  - branch current with `v3`.
  - worktree clean.
  - expected diff only.
  - check/type/build green.
  - targeted local Playwright green.
  - full remote Playwright green.
  - GitGuardian cleared or explicitly accepted by authorized maintainer.
  - security review clear/deferred with rationale.
  - strict maintainability review clear/deferred with rationale.
  - independent final review clear/deferred with rationale.
  - reviewer-visible browser evidence attached.
  - human approval present.
  - explicit user merge approval still required.
- Commit:
  - `docs(project): finalize PR 5148 evidence` when plan status/evidence changed after final code commit.

## Per-Slice Agent Contract

- Read this plan first.
- Update `Progress` before and after slice.
- Work one slice only.
- Use exact uncommitted `git diff` or explicit commit range for review.
- Review agent checks requirements/correctness first, quality second.
- Separate simplification agent finds smaller implementation; does not re-argue scope.
- Findings format: caveman basic; severity `Critical`, `Important`, `Minor`; status `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`.
- Main agent verifies every finding against code before integration.
- Verify again after integration.
- Commit before next slice.

## Independent Plan Review

- Reviewer: Droid with `glm-5.2`; read-only repo/diff review.
- Scope: plan completeness, slice independence, regression coverage, approval boundaries, missing merge gates, security/browser/docs coverage, overplanning.
- Result: `DONE_WITH_CONCERNS`; 0 Critical, 5 Important, 5 Minor before reconciliation.
- Accepted changes:
  - treat Markdown pipeline/sanitizer as changed security surface.
  - add `packages/markdown/src/Markdown.tsx` to behavior and security scope.
  - distinguish shared K/L helper, T-local helper, and unchanged V test.
  - verify same non-JS language in editor and preview.
  - check generic token styling and list both globals stylesheets.
  - name exact wiki validator command.
- Rejected findings:
  - “`grill-with-docs` unavailable”: global installed skill exists outside repo-local `.agents/skills`.
  - “`thermo-nuclear-code-quality-review` unavailable”: global installed skill exists and repo instructions require it.
  - “wiki validator unavailable”: repo skill documents global validator path; plan now names exact command.
- Secondary internal review agent: stopped after timeout; no incomplete findings integrated.
- Deferred changes: none.

## Progress

- `2026-07-26 | Playwright contenteditable clear cleanup | IN_PROGRESS | Fresh current-head run 30218144167 passed all code gates and seven Playwright shards. Shard 6 reported five Single Choice failures: the first test still used locator `.clear()` on a Tiptap answer field, so Formik remained valid and the next four serial tests failed because the question was never saved. The artifact recorded 103 other passing tests and the exact first failure at `F-elements-sc.spec.ts:63`. Replaced that answer clear and the remaining answer-feedback clears with the shared keyboard-clear helpers. Audited the active Playwright suite and removed every remaining locator `.clear()` targeting Tiptap question, explanation, answer, or feedback fields, including the equivalent latent KPRIM paths and local `clearAndTypeEditor` helper. Playwright TypeScript, changed-spec discovery (362 tests), Prettier, and diff checks pass. | Finish independent audit/review, commit/push, and require another fresh eight-shard run.`
- `2026-07-26 | Playwright shard 5 closure | DONE_WITH_CONCERNS | Fresh current-head CI run 30213583034 passed all code gates except Playwright shard 5 and the known GitGuardian incident. Artifact review found two Tiptap migration seams: `.fill()` bypassed Markdown paste handling, so video links stayed literal and produced zero preview iframes; locator `.clear()` did not reliably clear a contenteditable feedback field, so the save state stayed dirty and the next serial MC assertion failed. Added the upstream-documented Markdown paste extension with a narrow plain-text-link guard, direct `@tiptap/pm` dependency, real clipboard-event coverage for image/plain-text/rich-HTML/Markdown-link precedence, and shared keyboard clearing via select-all plus Backspace. In-app Browser on the isolated devrouter route confirmed three exact YouTube/Kaltura iframe sources, keyboard clearing to Tiptap's empty paragraph, and Markdown image syntax remaining literal in the editor. Root `check:all`, frozen offline install, manage lint/check, Playwright TypeScript/discovery, Prettier, and diff checks pass. Wiki validation still reports the pre-existing missing `type` frontmatter in `docs/solutions/best-practice/repeat-production-seeds-use-prior-state.md`; this patch updated the relevant wiki and skills without touching that unrelated file. Independent correctness follow-up: PASS. Separate simplification review: PASS. | Commit and push the focused CI fix, then require a fresh eight-shard Playwright pass; GitGuardian and human approval remain external gates.`
- `2026-07-26 | Rich-table paste review closure | IN_PROGRESS | A fresh Greptile review correctly found that rich HTML paste could introduce `rowspan` or `colspan` into the Tiptap document even though GFM serialization cannot preserve merged cells. Added a targeted paste transform that expands merged cells into an explicit rectangular unit-cell grid within each HTML row group while leaving unrelated rich HTML unchanged. Added browser-dispatched clipboard coverage through persistence, Markdown preview, and editor reopen. In-app Browser on the existing devrouter route confirmed the exact grid `[['Header', 'Detail'], ['Group', ''], ['First', 'Second'], ['', 'Third']]` in both editor and live preview, with every span normalized to `1`. Fresh CI run 30216534459 then exposed two test-only Tiptap seams in Playwright shard 5: an autolink made a rich-HTML `strong` locator non-unique, and locator `.clear()` bypassed the contenteditable keyboard path. The tests now select the intended first rich mark and use the shared keyboard-clear helper. Root `check:all`, targeted package checks, Playwright TypeScript/discovery, scoped Opengrep, and independent correctness and simplification reviews pass. No database cleanup is required for this finding because the Slate editor on deployed `v3` could not author tables and this branch has not shipped. The separate legacy break-only audit/backfill decision remains unchanged. | Commit/push the reviewed fixes and require fresh current-head CI; GitGuardian and human approval remain external gates.`
- `2026-07-26 | Post-merge review | DONE | Independent correctness review found no behavioral or conflict-resolution regressions. The separate simplification review found the regenerated lockfile mixed direct Tiptap 3.27.1 packages with 3.27.3 internals. Verified the finding and aligned all direct Tiptap packages to 3.27.3, which the repository's 14-day minimum-release-age policy now permits; the regenerated lock contains one coherent Tiptap version with no override list. The placeholder ref plus documented React refs-rule exception remains the smallest public-API-compatible solution because Tiptap's ProseMirror plugin reads the callback after React render. Frozen lock verification, full check:all, frontend-manage check/lint, and frontend-manage production build pass. | Commit the review fix, obtain a focused read-only recheck, then push explicitly and watch fresh CI.`
- `2026-07-26 | v3 reconciliation | DONE_WITH_CONCERNS | Resumed from the global handoff in the existing clean Codex worktree. Fetched current origin/v3 c8de9c897 and confirmed PR head 9b18a0444, OPEN, DIRTY, and REVIEW_REQUIRED. Merged v3 normally and resolved five conflicts by preserving current v3 framework/tooling/docs, reapplying only the branch's Tiptap dependency removals and editor conventions, and regenerating the lockfile. The React 19 refs rule required one scoped exception because Tiptap invokes the placeholder callback later from its ProseMirror plugin; frontend-manage lint passes with only its existing warnings. Fresh frozen-lock install, check:all, full 21-task production build, Playwright TypeScript, Chromium discovery (825 tests), and staged diff checks pass. The first sandboxed build failed only on blocked Google Fonts DNS; the identical network-enabled build passed. | Commit the merge, run independent correctness and simplification reviews on the exact commit, then push explicitly to the existing PR head and watch fresh CI.`
- `2026-07-10 | Planning | APPROVED | User approved execution with reasonable delegation to Agy. Live PR/refs/checks/review threads refreshed. Context7 research completed. Droid GLM review reconciled. | Commit plan alone, then Slice 1.`
- `2026-07-10 | Slice 1 | DONE_WITH_CONCERNS | Standalone plan committed as a6ebc5568. Merged exact origin/v3 eef745d06 into PR head b40fc33db with merge commit 6c1b6eb6c; AGENTS.md was the only dual-modified path and retained both wiki and workspace/devrouter guidance. Dedicated DevPod pr5148-final installed, built, migrated, seeded, launched, and returned 200 for the manage route. Fresh-container Playwright reached global setup but could not launch because Chromium was absent; browser installation remained in slow extraction, so no local Playwright pass is claimed. Deterministic fallback remains branch run 28933101672 versus passing exact merge-base run 28927821772. Agy/static audit maps MA/K to mount-time editor normalization contaminating Formik/autosave and maps ZA to relative navigation resolving against the PWA base URL. git diff --check passes; status contains only this progress update. Independent merge review: DONE_WITH_CONCERNS for the explicit local-browser limitation. Simplification review: clean scope. | Proceed to bounded Slice 2 lifecycle fix; local Playwright must be restored before Slice 2 verification commit.`
- `2026-07-10 | Slice 2 | DONE | Installed Tiptap 3.27.1 source identifies editor.setEditable as the exact no-document update source; passing false for emitUpdate fixes the lifecycle boundary while genuine onUpdate Markdown emission stays unchanged. External setContent already suppresses updates, and @tiptap/react options.current disproves stale callback capture. ToolbarButton now removes disabled from rest props before combining caller and context state. System Chromium and FFmpeg restored Playwright launch, but the ordered MA grep was not a valid standalone run and the container could not loop back through devrouter; no Playwright CLI pass is claimed. Per the user's explicit direction, Browser plugin verification used the healthy pr5148-final devrouter preview: created and saved rich content, waited through autosave, closed/reopened without edits, observed zero load/discard recovery controls with content intact, then created an answer collection and opened Answer Options with one click after untouched metadata; screenshot captured. Targeted Prettier, frontend-manage tsc, Playwright tsc, and git diff --check pass. Final Agy correctness review: DONE, no findings, safe to commit. Separate simplification review: PASS, current boundary fix preferred unchanged. Browser console also exposed the existing nested TooltipTrigger/button hydration error; carry it into Slice 4 UI quality work. | Commit Slice 2, then stabilize the K/L helper and ZA preview navigation in Slice 3.`
- `2026-07-10 | Slice 3 | DONE | Playwright 1.58.2 guidance confirms relative page.goto resolves against configured baseURL; ZA previously navigated to the PWA because the suite base URL is port 3001. Agy implemented the bounded two-file change: shared K/L helper now returns when open, avoids a second toggle while aria-expanded is true, clicks once when closed, and waits for the stable search control; ZA resolves process.env.URL_MANAGE ?? URL_MANAGE, uses the absolute manage preview URL, and drops the untested cell-merging claim. T-local helper remains untouched because no post-Slice-2 evidence implicates it. Browser/devrouter rendered the saved element at the explicit manage /questions/30 URL and confirmed the preview container after hydration; the answer-options product seam also opened with one click. No focused Playwright runtime pass is claimed. Fresh Prettier and Playwright tsc pass; focused discovery lists 39 K/L/ZA tests. Independent test-quality review: DONE, no findings. Separate simplification review: PASS, no edits. git diff --check passes. | Commit Slice 3, then execute Markdown-fidelity, syntax-highlighting, nested-button, docs, and skill work in Slice 4.`
- `2026-07-10 | Slice 4 | DONE_WITH_CONCERNS | Browser/devrouter proved the previous merge control was unsafe: a live two-column merge produced colspan=2, while recovered serialized state returned nine ordinary cells with colspan=1. Agy implemented the bounded product patch: bare TableKit, Lowlight common, native labelled toolbar buttons, generic manage preview code styling, and paired merge-key removal. Follow-up review fixed command-button aria-pressed semantics, removed dead resize CSS, and expanded ZA to reject merge/resize UI, persist a fourth row and column, and assert JavaScript, TypeScript, and R tokens in the editor and shared StudentElement preview. Browser after the patch rendered a 3x3 table, added a fourth row, exposed no merge or resize controls, contained zero nested buttons, and showed a visible keyboard focus ring at desktop and narrow viewports. Manage /questions/[id] is the same shared StudentElement renderer used by PWA flows. Prettier, frontend-manage tsc, Playwright tsc, scoped i18n parity, OKF wiki validation, and git diff --check pass. Installed Lowlight/Refractor grammars confirm the test token classes. Independent correctness re-check: PASS. Simplification review: PASS. The shared Docker engine became blocked by stale execs from another active worktree before the final filtered build and save/reload retry; no focused Playwright runtime or post-patch persistence pass is claimed here. | Commit Slice 4, then recover the container and run the full Slice 5 gates.`
- `2026-07-10 | Slice 5 | DONE_WITH_CONCERNS | Slice 4 committed as d4b2247aa. Containerized repo typecheck, syncpack, AGENTS, and Prisma-sync gates pass; Playwright Prettier, tsc, and Chromium discovery pass (811 tests). The changed frontend-manage production build passes with NODE_ENV=production. Root check:all cannot run lint-staged inside the container because the mounted worktree .git file points to host-only metadata; its component gates were run separately. Container lint is additionally blocked by missing uv and eslint-plugin-react-hooks in the image. Three focused ZA runtime attempts reached global cleanup/seed but synthetic login redirected to auth under devrouter, 127.0.0.1, and localhost routing before any editor selector; stopped after three environment hypotheses. In-app Browser reconnected to the signed-in manage page after devrouter recovery, but Browser policy blocked the required post-restart reload, so no new save/reopen claim is made. The first explicit push ran the repository pre-push hook and completed the full root production build: 21/21 build tasks passed, including auth, frontend-manage, and frontend-pwa. | Use remote CI as the focused runtime gate; do not classify local harness failures as product failures.`
- `2026-07-10 | Slice 6 | DONE_WITH_CONCERNS | Independent final review found focused external prop updates could be dropped and Markdown-significant indentation could compare equal. Fixed in 8975d2054 by removing the focus guard and trim; container Prettier and manage tsc pass, correctness review PASS_WITH_TEST_GAP, simplification PASS. Security review: raw HTML remains disabled, rehype-sanitize remains before Prism, code classes are restricted to language-*, dependency/lockfile changes are paired, scoped changed-file Opengrep reports 0 findings; the repo-wide auto scan reports 607 pre-existing findings and three analysis timeouts. Thermo review found concrete cross-app style drift; fixed manage preview table selectors and PWA generic pre selector in f4a2736c7. Thermo follow-up PASS; package-level shared CSS export explicitly deferred because it would add a new cross-package build/import contract. The documented .ProseMirror readiness wait remains based on measured layout shifts. Branch through ebdb9e6e2 pushed explicitly to the PR head; fresh remote checks are pending. Live PR remains REVIEW_REQUIRED; GitGuardian still flags the known dev-test credential commit inherited through v3 history. | Push this final evidence update, watch fresh CI, then refresh PR evidence/reviews.`
- `2026-07-10 | CI closure | DONE_WITH_CONCERNS | Fresh run 29110571382 exposed two deterministic test defects. ZA targeted a non-focusable table-cell wrapper and saved empty cells; fixed in f2a6c791d by focusing the cell paragraph and asserting editor text before save. S-group-activity expected a second confirmation after production had cleared editing state; fixed in 9a4c805d8 by asserting the modal remains absent while downstream grading assertions verify the selected submission. Final run 29112473952 passed build-and-compile and all eight Playwright shards. All other code checks passed; GitGuardian remained the sole failing check. PR body and review threads were refreshed; unresolved thread count is zero. | Authorized GitGuardian disposition, screenshots, and human approval remain.`
- `2026-07-10 | Branch review and simplification | DONE_WITH_CONCERNS | Two-axis review against origin/v3 found app-local import and missing data-cy hooks, stale evidence, explicit save/reopen/PWA evidence gaps, and pre-takeover AGENTS scope. Thermo pass removed redundant preventDefault calls from native type=button controls, simplified Markdown comparison syntax, restored the real optional-content boundary after independent review caught an undefined Formik caller, added stable hooks to new code/table controls, and strengthened ZA's add-column selector. Shared CSS extraction remains deferred because it would create a new package stylesheet contract. Pre-takeover AGENTS cleanup remains untouched as user-owned work. In-app Browser blocked the devrouter URL before page load, so no new browser claim is made. Targeted Prettier, frontend-manage tsc, Playwright tsc, test discovery, and diff checks pass locally; remote CI must rerun on the simplification commit. | Push simplification, watch fresh CI, then leave only external blockers.`
- `2026-07-11 | Legacy empty-state cleanup | DONE_WITH_CONCERNS | Removed every ContentInput caller fallback that synthesized '<br>', initialized new choices with '', and centralized break-only legacy normalization at the editor boundary so existing '<br>', '<br/>', and '<br />' rows reopen as truly empty. ZA now verifies both new-form and seeded legacy-row placeholders and restores the seeded row in a finally block. Repo check:all, manage production build, Playwright tsc/discovery, OKF validation, Prettier, diff checks, and scoped Opengrep (0 findings) pass. Independent code review: PASS; database audit: no schema migration and no blind backfill. The fallback never persisted through Tiptap because programmatic sync suppresses updates, but historic Slate rows may exist across scalar and JSON snapshot fields. Required rollout step is a read-only production count using anchored break-only matching. If optional-field counts justify remediation, use an explicit idempotent batched job with single-owner locking, progress observability, and a dry-run mode; required fields and ElementInstance snapshots require targeted handling. In-app Browser/devrouter navigation remained blocked by the browser client before page load, so remote Playwright remains the runtime gate. | Commit and push cleanup, update PR evidence, monitor CI; run production read-only sentinel audit separately before authorizing any data write.`
- `2026-07-11 | Final review and simplification | DONE_WITH_CONCERNS | Parallel standards, spec, and thermo reviews found unrelated AGENTS scope, two dead Slate-era hotkey packages, a remaining Markdown '<br>' default, repeated toolbar title/ARIA props, no-op table toggle semantics, language-specific toolbar abbreviations, and a missing saved-editor reopen assertion. Removed the unrelated AGENTS rewrite and matching log entry; removed is-hotkey packages and exact lock snapshots; changed renderer default to ''; made ToolbarButton own one required localized label; added stable toolbar hooks; disabled insert-table while already in a table; replaced English abbreviations with symbols; and added table/code reopen assertions before the legacy sentinel mutation. Shared preview CSS extraction remains deferred because it needs a deliberate package stylesheet import contract. The answer-options .ProseMirror readiness wait remains because measured async editor layout shifts caused the original flake. Frozen lock verification, repo check:all, focused TypeScript checks, Prettier, Playwright discovery, and diff checks pass locally. Full remote runtime must rerun after push. | Independent follow-up review, commit/push, then monitor current-head CI.`
- `2026-07-12 | Upstream Tiptap review follow-up | DONE_WITH_CONCERNS | Installed the upstream Tiptap skill and cloned current source/docs into ignored .reference/. Source review found that Tiptap 3.27.1 does not rerender React for selection-only transactions by default. ContentInput now uses useEditorState for mark and table context, sets immediatelyRender: false for Next SSR, and tests that selecting a persisted table reveals its controls without an edit. The 3.27.3 upgrade was rejected because the packages are only five days old and the repo requires a fourteen-day minimum release age; 3.27.1 remains pinned. Repo check:all, focused TypeScript, Prettier, Playwright discovery, and the full build pass. Independent review found no issues. In-app Browser reached the devrouter preview, but workspace authentication posts to the base auth host, which belongs to another active worktree, so no authenticated browser claim or screenshot is made. | Commit and push the source-grounded fix, then use hosted Playwright as the runtime gate.`

## Next Steps

1. Review and push the v3 reconciliation; watch fresh current-head CI.
2. Run a read-only production audit for sentinel-only scalar and JSON values. If measured counts justify remediation, design an explicit idempotent batched job with single-owner locking, dry-run output, and progress/failure observability before authorizing any write.
3. Obtain authorized GitGuardian disposition.
4. Attach reviewer-visible desktop/narrow screenshots and record explicit editor reopen/PWA-route evidence.
5. Obtain human approval; merge only after separate explicit user approval.
