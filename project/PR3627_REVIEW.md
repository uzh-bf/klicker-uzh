# Review: PR #3627 — feat: markdown input for free text questions

- **Reviewed:** 2026-07-07 (automated review, Claude)
- **PR:** https://github.com/uzh-bf/klicker-uzh/pull/3627
- **State:** Draft, single commit `5c5f893` ("initial poc", 2023-05-25), base `v3`, **CONFLICTING**
- **Scope:** 3 files, +232/−172

## TL;DR / Verdict

This PR is a three-year-old proof of concept. Every file it touches has since been deleted, moved, or rewritten on `v3` — the branch is **2318 commits behind** (merge-base `b6deca507`, 2023-05-25). It cannot be rebased in any meaningful sense; a rebase would be a full re-implementation.

**Recommendation: close the PR and, if the feature is still wanted for the formative-feedback beta scope (ClickUp 86caaza32), re-implement it fresh on `v3` following the plan at the bottom of this document.** The only ideas worth salvaging are (a) the per-button toolbar configuration concept for `ContentInput` and (b) the product decision of which formatting options students should get (lists, inline TeX, undo/redo — no images).

Do **not** invest time fixing the code on this branch.

## What the PR does

1. `packages/shared-components/src/ContentInput.tsx` — adds a `toolbar` prop (per-button flags: bold, italic, code, quote, ol, ul, image, texInline, texCentered, undo, redo) so callers can render a reduced toolbar; wraps each existing button in a conditional.
2. `packages/shared-components/src/questions/FREETextAnswerOptions.tsx` — replaces the student `<textarea>` with the rich `ContentInput` (Slate editor), so students can submit formatted/markdown answers.
3. `apps/frontend-manage/src/components/evaluation/Wordcloud.tsx` — strips markdown noise from wordcloud values with `value.replace(/[^a-zA-Z \n]/g, '')`.

## Why it is unmergeable (drift evidence)

| PR file | Status on current `v3` |
| --- | --- |
| `packages/shared-components/src/ContentInput.tsx` | **Deleted** — moved to `apps/frontend-manage/src/components/common/ContentInput.tsx` (image uploads/media library, #3818) and completely retyped (proper Slate types, `MediaLibrary`, i18n). It has **no** per-button toolbar config, only `className.toolbar`. |
| `packages/shared-components/src/questions/FREETextAnswerOptions.tsx` | **Rewritten** — now uses the design-system `TextareaField` (#4189), takes `disabled` and `elementIx` props, enforces `maxLength` (default 1500) with a character-count unit. The PR's diff has no textual overlap with it anymore. |
| `apps/frontend-manage/src/components/evaluation/Wordcloud.tsx` | **Deleted** (#4355) — superseded by `packages/shared-components/src/charts/ElementWordcloud.tsx` (#4947), which already does proper user-input filtering (stopword removal for DE/EN via `stopword`, words/sentences split modes, max-word limits). The PR's regex hack is obsolete. |

## Findings by dimension

Line references are to the PR diff (head `5c5f893`), current-code references to `v3`.

### Stability

1. **Response format silently changes shape.** `ContentInput.onChange` emits Slate editor state, not the plain string the old `<textarea>` emitted. `FREETextAnswerOptions` forwards `onChange` unchanged, so every consumer (live-session response submission, practice quiz) would receive a different payload than the backend expects. Nothing in the PR converts Slate → markdown string at the input boundary, and no backend change accompanies it. Submitting would either store `[object Object]`-ish JSON or crash serialization.
2. **Answer aggregation breaks.** The backend deduplicates/aggregates free-text answers by MD5 hash of the lowercased, trimmed value (`packages/graphql/src/services/stacks.ts:1761-1764` on v3). With markdown syntax in the value, `word`, `**word**`, and `- word` hash differently, so counts fragment. The PR does not address this at all.
3. **Client-side length limit lost.** The old `<textarea>` had `maxLength={maxLength ?? 1500}`; `ContentInput` has no length enforcement. The backend only rejects overlong values **if** `options.restrictions.maxLength` is configured (`stacks.ts:1749-1757`), and it rejects silently (`{ results, modified: false }`) — the student would see their answer vanish with no error.
4. **Prop bug:** `value` was changed from optional to required, and `touched={false}` is hardcoded, so the editor never reflects external resets (e.g., clearing after submission).
5. **Toolbar default footgun:** `toolbar = {...TOOLBAR_DEFAULTS}` only applies when the prop is absent. Any partial object (as `FREETextAnswerOptions` passes) silently disables all unspecified buttons — the PR's own call site disables bold/italic, which may or may not be intended. A merge (`{...TOOLBAR_DEFAULTS, ...toolbar}`) was probably meant.

### Security

6. **Sanitization is actually fine on v3 — but rendering paths are not markdown-aware.** `packages/markdown/src/Markdown.tsx:84-106` uses `rehype-sanitize` with `defaultSchema` and `allowDangerousHtml: false`, external links get `noopener noreferrer nofollow`. So *if* student markdown were rendered through `<Markdown/>`, XSS is covered. However:
   - `FTEvaluation` (`packages/shared-components/src/evaluation/FTEvaluation.tsx:25-28`) renders answers as **plain joined text** — React-escaped (no XSS), but students' raw markdown syntax (`**`, `$$`, `![]()`) would display verbatim to everyone. Same for grading views and the wordcloud.
   - If any display path were "upgraded" to `<Markdown/>` to fix that, the sanitize schema **allows `img` with arbitrary `src`** (`Markdown.tsx:97-100`). Student-supplied image URLs rendered on lecturer/participant screens = tracking pixels, IP disclosure to third parties, and inappropriate-image injection into the classroom projection. The PR's own toolbar wisely disables the image button for students, but nothing stops typed `![x](url)` markdown.
7. **DoS-ish surface:** with no input length limit (finding 3) and KaTeX rendering (`rehype-katex`), a hostile student can submit pathological TeX or megabyte-sized answers that get rendered on the lecturer's evaluation screen mid-lecture.

### UX

8. **Wordcloud regex destroys German.** `value.replace(/[^a-zA-Z \n]/g, '')` deletes umlauts (ä/ö/ü), ß, accents, and digits — at a Swiss-German university this mangles a large share of real answers ("Zürich" → "Zrich"). Also leaves a commented-out line (`// value: <Markdown .../>`) in the diff. Superseded anyway by `ElementWordcloud` stopword filtering on v3.
9. **Character counter now lies.** The counter under the input keeps counting the raw value; markdown/Slate markup inflates length versus what students think they typed, and the limit it references is no longer enforced.
10. **Heavy editor on the hot path.** Live sessions run on hundreds of student phones simultaneously. Slate + toolbar + tooltips is a significantly heavier and less mobile-friendly widget than a `<textarea>`; German-only hardcoded tooltips also violate the current next-intl i18n standard (everything on v3 is translated).

### Quality

11. Single "initial poc" commit, 0% test coverage on new code (SonarCloud), no Cypress/Playwright case for formatted input, dead commented code, `data_cy` vs `data-cy` prop rename ripples untested.

### Usefulness

12. The underlying need (richer student answers for formative feedback) is plausibly still real — the PR is linked to ClickUp "Minimal secure formative-feedback beta scope". But **none of the PR's code is reusable** on v3: the wordcloud problem is solved better already, the student input component was replaced, and the editor it extends no longer exists in `shared-components`. What survives is the *product spec*, not the implementation.

## Remaining steps toward production readiness

Concretely: what to do, in order. Each step is self-contained.

### Step 0 — Close this PR

Comment linking to this review, close #3627, keep the branch for archaeology (or delete it; the single commit is trivial to recover from the PR). Confirm with Roland before closing.

### Step 1 — Decide product scope first (do not code yet)

Answer in the ClickUp task, with the team:

- Which element contexts get rich student input? (live quiz, practice quiz, group activity — each has a different display path.)
- Which formatting? Recommendation from this PR still holds: **lists, inline TeX, undo/redo only. No images, no block quotes.**
- Where do formatted answers get *rendered* formatted vs. shown as plain text? (Evaluation view, grading view, wordcloud must stay plain/normalized.)

### Step 2 — Data contract before UI

- Keep the stored response a **markdown string** (not Slate JSON): `respondToQuestion` in `packages/graphql/src/services/stacks.ts` already treats `response.value` as string, and MD5-hash aggregation stays workable.
- Add server-side enforcement: always cap free-text length (e.g. hard cap 1500/3000 chars) *independent* of `options.restrictions.maxLength`, and return a typed error instead of the silent `{ modified: false }` drop (`stacks.ts:1749-1757`).
- Add a **markdown-stripping normalizer** (plain-text projection) used for: MD5 aggregation hashing, wordcloud input, and CSV/export paths. Without this, counts fragment (finding 2).

### Step 3 — Input component on v3

- Do **not** resurrect `shared-components/ContentInput`. Either (a) extract the current `apps/frontend-manage/.../ContentInput.tsx` into `packages/shared-components` behind a feature-flag-able wrapper, or (b) build a minimal `StudentContentInput` with only the agreed buttons. Option (b) is smaller and avoids dragging `MediaLibrary` into the PWA bundle — recommended.
- Re-use this PR's one good idea: a `toolbar` config object, but with merge semantics (`{...DEFAULTS, ...toolbar}`) and defaults matching the student scope.
- Convert Slate → markdown **inside** the component (`convertToMd` from `packages/shared-components/src/utils/slateMdConversion.ts`), so `onChange` keeps emitting a plain string and `FREETextAnswerOptions`' contract does not change. Enforce `maxLength` on the markdown output, counter included.
- All labels/tooltips via next-intl (`packages/i18n`), DE + EN.

### Step 4 — Display paths

- Render student answers through `packages/markdown` `<Markdown/>` **only** in the evaluation/grading views that opt in.
- Before doing so, tighten the sanitize schema for the *student-content* code path: disallow `img` entirely (or proxy/allowlist media-service URLs only) — see finding 6. Simplest: add a `Markdown` prop like `allowImages={false}` that drops `img` from the rehype-sanitize schema.
- Wordcloud and CSV exports consume the plain-text projection from Step 2 — no change to `ElementWordcloud` needed.

### Step 5 — Verification gate (definition of done)

- Unit tests: Slate→md conversion, normalizer (umlauts must survive!), length cap.
- Playwright E2E (see `klicker-playwright-e2e` skill): student submits a formatted answer in a live quiz → lecturer evaluation shows rendered markdown; second student submits `![x](https://evil.example/pixel.png)` and `<script>` → neither renders as image/script; overlong answer → visible error, not silent drop.
- Manual `agent-browser` run on the local Traefik setup with seeded users (`testuser1`, lecturer `lecturer`/delegated) with before/after screenshots on desktop + mobile viewports, attached to the new PR.
- Load sanity: open a live session evaluation with ~50 formatted answers; confirm no jank from KaTeX rendering.

### Effort estimate

Steps 2–5 are roughly one focused week for one developer including tests; Step 1 is the actual blocker and costs a team decision, not code.
