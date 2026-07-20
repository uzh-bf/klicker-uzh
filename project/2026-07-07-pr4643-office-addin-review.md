# PR #4643 Review — Office Add-in Rewrite (Vanilla TS)

**Reviewed:** 2026-07-07 · branch `NewPPT` @ `05ce026fb` vs `v3`
**Scope:** `apps/office-addin` (React/Webpack → vanilla TS/Rollup), deployed artifacts in `apps/docs/static/office-addin`, PLAN/CLAUDE docs, lockfile.
**Verdict:** Solid direction (bundle shrinks massively, React removed, validation UX added), but **not production-ready**. Two release blockers would break the add-in for every user, plus a functional regression for multi-embed decks. All findings below include evidence and step-by-step fixes.

## Progress

- [x] Re-check live PR state on 2026-07-20: [PR #4643](https://github.com/uzh-bf/klicker-uzh/pull/4643) remains open and draft at `ee6afaa3b`; branch is 459 commits behind and 26 ahead of `origin/v3`.
- [x] Re-check Office settings semantics against current Microsoft documentation. `Office.context.document.settings` is specific to the content-add-in instance and document, so the new `embeddedUrl` key does not collapse separate embedded add-in instances. Section 2.1 is superseded by this evidence; keep the simpler instance-scoped key and verify it in PowerPoint when available.
- [x] Slice 1: merged current `origin/v3`; resolved only the expected `apps/office-addin/package.json` and `pnpm-lock.yaml` conflicts; frozen pnpm 11.5.0 install completed under Node 24; Office typecheck and production Rollup build passed. The merge initially surfaced Microsoft debug-launcher install scripts; Slice 3 removed that optional dependency tree and its build-policy entries after the security audit, so native-broker sign-in is no longer part of this app's workflow.
- [x] Slice 2: reduced the production build to one bundle, replaced the Tailwind Play CDN with local semantic CSS, corrected `/office-addin/` production URLs, removed non-runtime artifacts, and added exact build-to-docs synchronization. Node 24 typecheck, lint, build, manifest validation, and 13-file deployment parity passed. A local `agent-browser` run with an Office API stub verified the 1024×768 and manifest-sized 600×400 layouts, invalid and valid URL states, embed/fullscreen, Change URL, and zero browser errors; this is UI evidence, not a PowerPoint host test.
- [x] Slice 2 follow-up: independent review found that Rollup watch mode ignored non-TypeScript inputs. HTML, CSS, manifest, and asset files are now explicit watch inputs; the simplification pass also removed unused type packages, redundant local types and state branches, and unlinked sign-in aliases. The explicit `typescript-eslint` dependency remains necessary because the Office plugin currently exposes an undefined bundled parser. Reverification passed before dependency work began.
- [x] Slice 3: updated Office tooling, Office types, TypeScript ESLint, and Rollup within their current majors; moved the app from TypeScript 5.6 to the workspace's TypeScript 6.0.3; removed the obsolete React/TypeScript syncpack exceptions and TS6-deprecated `baseUrl`; and made Office global types explicit. A narrow Rollup exception keeps this app above the 4.59 security floor until the coordinated workspace upgrade. The optional Microsoft debug launcher and live-reload trees were removed after the audit found high/critical transitive advisories; local HTTPS development and manual sideloading remain. Typecheck, lint, build/deploy parity, and the Office manifest acceptance service passed.
- [ ] Slice 4 active: finish code, docs, tests, and source-backed review-thread resolution.
- [ ] Finish: full verification, security/maintainability/cross-model reviews, whole-branch PR refresh, ready transition, and ready-only CI monitoring.

**Scope decisions:** preserve one persisted key per content-add-in instance; no toolbar/ribbon work; no executable packaging; no merge. If PowerPoint sideloading is unavailable, record it as a manual release check instead of claiming host-level proof.

### Dependency audit (2026-07-20)

| Package | Before | Verified version | Decision |
| --- | ---: | ---: | --- |
| `@types/office-js` | 1.0.591 | 1.0.598 | Update Office API types |
| `@rollup/plugin-typescript` | 12.1.4 | 12.1.4 | Keep aligned with the workspace; 12.3.0 requires a coordinated update |
| `office-addin-debugging` | 6.0.7 | removed | Drop the optional native launcher and its vulnerable transitive tree; use manual sideloading |
| `office-addin-manifest` | 2.0.3 | 2.1.5 | Update validator within major |
| `rollup` | 4.34.9 | 4.62.2 | Update past the 4.59 arbitrary-file-write security floor; keep a narrow syncpack exception until the workspace follows |
| `typescript` | 5.6.3 | 6.0.3 | Align with the approved workspace baseline |
| `typescript-eslint` | 8.62.0 | 8.63.0 | Update within major; keep explicit because the Office plugin currently exposes an undefined bundled parser |

The manifest floors for `eslint-plugin-office-addins`, `office-addin-dev-certs`, `office-addin-lint`, and `rollup-plugin-visualizer` now match their already-resolved current-major versions. `rollup-plugin-copy` and `rollup-plugin-serve` were already current. The build and dependency simplification removed unused browser/polyfill, resolver, debug-launcher, live-reload, CLI, formatting, and type packages.

The shared current-major update `@rollup/plugin-typescript` 12.1.4→12.3.0 and workspace-wide Rollup alignment remain deferred to a coordinated build-tool change. Three optional build-only majors are also deferred: `cross-env` 7→10, `rollup-plugin-visualizer` 6→7, and `@rollup/plugin-terser` 0→1. All retained versions are non-deprecated and pass the Node 24 build; the broader or major updates are unrelated to the native rewrite and require separate explicit scope.

After removing the debug launcher and live-reload packages and raising Rollup past its security floor, `pnpm audit` reports two Office Add-in paths: `uuid` (moderate) and `adm-zip` (high), both transitive dependencies of the current `office-addin-manifest` 2.1.5 validator. The validator only processes this repository's reviewed manifest during development and CI; it is not shipped or exposed to untrusted runtime input. Keep it as a release gate, track its upstream dependencies, and reassess when Microsoft publishes a patched validator.

How to read this file: work top to bottom. Each item has **Evidence** (where to look, what you'll see) and **Fix** (exact steps). Check the box when done. Run the verification loop (section 6) after every fix batch.

---

## 1. Release Blockers (add-in broken if shipped)

### 1.1 Production manifest points to a 404

- [x] **Fix `urlProd` replacement so paths include `/office-addin/`**

**Evidence:**

- `apps/office-addin/rollup.config.js` line ~16: `const urlProd = 'https://www.klicker.uzh.ch/'`. The build replaces `https://localhost:3020/` with that string.
- Result, committed at `apps/docs/static/office-addin/manifest.xml`:
  ```
  <SourceLocation DefaultValue="https://www.klicker.uzh.ch/content.html" />
  <IconUrl DefaultValue="https://www.klicker.uzh.ch/assets/icon-32.png" />
  ```
- The docs site (Docusaurus) serves `apps/docs/static/office-addin/*` under `https://www.klicker.uzh.ch/office-addin/*`. Compare the **old** manifest on `v3` (`apps/docs/static/office-addin/manifest-content.xml`):
  ```
  <SourceLocation DefaultValue="https://www.klicker.uzh.ch/office-addin/content.html"/>
  <IconUrl DefaultValue="https://www.klicker.uzh.ch/office-addin/assets/icon-32.png"/>
  ```
- Confirm the 404 yourself: `curl -sI https://www.klicker.uzh.ch/content.html` (404) vs `curl -sI https://www.klicker.uzh.ch/office-addin/content.html` (200, current prod add-in).

**Impact:** anyone installing the new `manifest.xml` gets an empty add-in frame (PowerPoint loads SourceLocation and gets a 404). This is the single most important fix.

**Fix:**

1. In `rollup.config.js`, change `urlProd` to `'https://www.klicker.uzh.ch/office-addin/'`.
2. Rebuild (`pnpm --filter @klicker-uzh/office-addin build`) and re-copy the output (see 3.1 about the deploy step).
3. Verify the regenerated `dist/manifest.xml` matches the old `v3` URLs exactly (diff them).
4. Sideload the built manifest in PowerPoint (web is easiest: Insert → Add-ins → Upload My Add-in) and confirm the pane renders.

### 1.2 Tailwind Play CDN in production

- [x] **Replace `cdn.tailwindcss.com` with a local CSS file**

**Evidence:** `apps/office-addin/src/content/content.html` line ~124: `<script src="https://cdn.tailwindcss.com"></script>`. Also present in the committed `apps/docs/static/office-addin/content.html`.

**Impact:**

- The Play CDN is a runtime JIT compiler, explicitly "not designed for production" (Tailwind docs). It's ~100 KB+ of JS executing on every add-in load — ironic given the PR's goal of a minimal bundle.
- Security/supply-chain: a third-party script with full DOM access runs inside an add-in that has `ReadWriteDocument` permission. If the CDN is compromised or unreachable (strict campus networks, offline lecture halls), the add-in renders unstyled or is exposed.
- `content.ts` toggles Tailwind classes at runtime (`border-red-500`, `opacity-50`, etc. in `setValidationState`/`updateEmbedButton`/`showMessage`) — these only exist because the JIT CDN generates them. A static CSS build must include them (they're in source files, so a normal Tailwind content scan picks them up).

**Fix (junior steps):**

1. Add dev deps to `apps/office-addin`: `tailwindcss`, `postcss`, `autoprefixer` (pin versions; match the majors used elsewhere in the monorepo — check `packages/shared-components/package.json`).
2. Create `src/styles.css` with the three `@tailwind` directives (the old branch had a `src/styles.css` you can start from — see `git show origin/v3:apps/office-addin/src/styles.css`).
3. Create `tailwind.config.cjs` with `content: ['./src/**/*.{html,ts}']`.
4. In the rollup pipeline, either run Tailwind CLI as a build step (`tailwindcss -i src/styles.css -o dist/styles.css --minify` via an npm script that runs before/parallel to rollup) or use `rollup-plugin-postcss`. The plain CLI step is simpler — prefer it.
5. In `content.html`, remove the CDN `<script>` and add `<link rel="stylesheet" href="styles.css" />` (rollup's `officeAddinPlugin` already post-processes the HTML — inject the link there or put it in the template directly).
6. Rebuild, load the pane, and compare against screenshots of the current styling (validation border colors, toast, fullscreen mode). This is the item the PR checklist already lists as open ("Update tailwind for generated .css file instead of playground script").

Note: the *other* external script in `content.html` — `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` — must stay. Microsoft requires add-ins to load Office.js from their CDN (it's updated server-side, so Subresource Integrity hashes can't be applied to it either). Do not bundle or SRI-pin it; removing the Tailwind CDN leaves it as the only external script, which is the expected end state.

### 1.3 Merge conflicts with `v3`

- [x] **Merge `v3` into `NewPPT`**

**Evidence:** `git merge-tree --write-tree --name-only origin/NewPPT origin/v3` → conflicts in `apps/office-addin/package.json` and `pnpm-lock.yaml`. GitHub shows `mergeable: CONFLICTING`.

**Cause:** `v3` moved the package to `3.4.0-alpha.x` (dependency refresh in `db8e028bf`) while the branch still declares `3.3.0-alpha.78`.

**Fix:**

1. `git merge origin/v3` on the branch (or rebase if you prefer, but the branch is long-lived — merge is safer).
2. In `package.json`, take the `v3` version number, keep the branch's script/dependency changes.
3. For `pnpm-lock.yaml`: don't hand-merge. Take `v3`'s lockfile (`git checkout origin/v3 -- pnpm-lock.yaml`), then run `pnpm install` at the repo root to re-add the branch's dependency changes; commit both files together.
4. Run `pnpm run check:all` at root afterwards.

---

## 2. Functional Regression (decide before merge)

### 2.1 Per-slide embeds collapsed into one document-global URL

- [ ] **Decision needed: restore per-slide keying or accept one-embed-per-deck**

**Evidence:**

- Old (`v3`, `apps/office-addin/src/content/components/App.tsx`): settings key `'selectedURL' + slideID` — each embedded add-in instance stored its own URL keyed by the slide it lives on.
- New (`src/content/content.ts` line ~36): single constant `SETTINGS_KEY = 'embeddedUrl'`.
- `Office.context.document.settings` is **shared across all instances of the same add-in in a document**. With the new code, a lecturer who embeds evaluation A on slide 3 and evaluation B on slide 10 gets: whichever was embedded last wins; both slides' panes show the same URL after reopening the file.
- The legacy migration in `loadInitialState()` compounds this: it reads the legacy key for the **currently selected slide** (`getSlideID()` uses `getSelectedDataAsync`, which returns the slide selected in the editor — not necessarily the slide hosting the add-in instance), promotes that one URL to the global key, and deletes the legacy key. A multi-embed legacy deck gets silently collapsed to one URL, with the other slides' settings left orphaned.

**Impact:** real KlickerUZH use case — lecturers embedding several question evaluations across a deck — silently breaks. Nothing in the PR description flags this as intentional.

**Fix options (pick one, document the choice in the PR body):**

- **A (recommended):** keep per-slide keys. On init, resolve the hosting slide the same way V1 did and use `SETTINGS_KEY + slideID`. Keep the retry logic already written for `getSlideID()`. Migration becomes a no-op rename per slide. Caveat to verify while testing: `getSelectedDataAsync(SlideRange)` reflects the *selection*, not the host slide — V1 had the same weakness, so this is no worse, but test the "two embeds, reopen file" scenario explicitly.
- **B:** accept single-embed-per-document, but then (1) state it in the PR body + docs, (2) warn in the UI when a second instance is inserted, (3) don't delete legacy keys during migration (leave them so a rollback to V1 still works).

---

## 3. High Priority (quality / security hygiene)

### 3.1 Build artifacts committed into `apps/docs/static/office-addin`

- [x] **Remove non-runtime artifacts from the deployed folder; document/script the deploy step**

**Evidence** (`git show origin/NewPPT:apps/docs/static/office-addin/` — tree listing):

- `bundle-analysis.html` — 161 KB rollup-visualizer report, publicly served on the docs site. Not harmful, but leaks internals and is pure bloat.
- `tsconfig.tsbuildinfo`, `polyfills.d.ts`, `polyfills.d.ts.map`, `content/content.d.ts`, `content/content.d.ts.map` — TypeScript incremental/declaration outputs. Never needed at runtime; they exist because `tsconfig.json` sets `composite: true` + `declaration: true` + `declarationMap: true`, which is a library config — this app is not consumed as a library.

**Fix:**

1. In `tsconfig.json` drop `composite`, `declaration`, `declarationMap`, `tsBuildInfoFile` (keep `sourceMap` if you want debuggable prod, that's a legitimate choice).
2. In `rollup.config.js`, only emit `bundle-analysis.html` when explicitly analyzing (e.g., gate the `visualizer` plugin behind `process.env.ANALYZE === 'true'`, wired to the `build:analyze` script), and never copy it to docs.
3. Delete the stray files from `apps/docs/static/office-addin/` in this PR.
4. The dist→docs copy step is currently undocumented (no mention of `docs`/`static` in the new README/CLAUDE.md). Add an npm script, e.g. `"deploy:docs": "rm -rf ../docs/static/office-addin && cp -r dist ../docs/static/office-addin"`, and document it in the README — this is also what makes item 1.1 reproducible instead of a hand-copied one-off. (PR checklist already lists the README/docs update as open.)

### 3.2 iframe hardening regressed

- [x] **Restore `referrerPolicy`, drop `allow-popups` unless needed**

**Evidence:** old iframe (`App.tsx` on `v3`): `sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer"`. New (`src/content/content.html`, `#content-iframe`): `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`, no `referrerPolicy`.

**Impact:** low severity because `isValidUrl()` pins the iframe origin to `manage.klicker.uzh.ch`, but: the embedded URL contains the HMAC token in the query string; without `no-referrer`, that URL can leak via the `Referer` header on any outbound request from the embedded page. `allow-popups` widens the surface for no documented reason.

**Fix:** add `referrerpolicy="no-referrer"` to the iframe tag; remove `allow-popups` unless there's a concrete feature needing it (if there is, note it in a comment). One-line change in `content.html`.

### 3.3 Lint CI red

- [x] **Make the `lint` workflow pass**

**Evidence:** check run "lint" = FAILURE on the PR head (workflow "Check linting", run 16693264801). The PR checklist itself has "Fix linting conflicting with prettier" unchecked. The package uses `office-addin-lint` (`.eslintrc.json` extends `plugin:office-addins/recommended`), which ships its own prettier config (`"prettier": "office-addin-prettier-config"` in `package.json`) that fights the repo-wide prettier setup (no-semi, single quotes).

**Fix:**

1. Reproduce locally: `pnpm --filter @klicker-uzh/office-addin lint` and root `pnpm run lint`.
2. Remove the `"prettier": "office-addin-prettier-config"` field from `apps/office-addin/package.json` so the repo root prettier config applies (repo style: no semicolons, single quotes, trailing comma es5), then drop the `office-addin-prettier-config` dev dep.
3. Keep `eslint-plugin-office-addins` for the Office-specific rules, but add `prettier` last in the eslint `extends` chain if rule conflicts remain.
4. Re-run root `pnpm run check:all` until green.

### 3.4 Cypress CI red

- [ ] **Confirm the cypress failure is unrelated, then get it green**

**Evidence:** "cypress-run" FAILURE on the PR head. The add-in isn't covered by cypress, so this is likely staleness of the branch (last CI run 2025-08-02) rather than this PR — but "probably unrelated" isn't evidence.

**Fix:** after rebasing onto `v3` (item 1.3), let CI re-run. If cypress still fails, diff the failing specs against a green `v3` run before touching anything.

---

## 4. Medium Priority

### 4.1 Placeholder/example URLs fail the add-in's own validation

**Evidence:** `content.html` input placeholder: `https://manage.klicker.uzh.ch/quizzes/12345/evaluation?hmac=xyz`. The regex in `isValidUrl()` (`content.ts` bottom) requires a 36-char id and 64-char hmac — `12345`/`xyz` would show a red "invalid" state if typed. The error toast in `handleEmbedClick` shows the same misleading shape (`.../evaluation?hmac=...`).

Real URL shape for reference (generated by `apps/frontend-manage/src/components/liveQuiz/HMACLink.tsx`): `${MANAGE_URL}[/locale]/quizzes/<uuid-36>/evaluation?hmac=<sha256-hex-64>[&params]`. The regex is correct for prod (LiveQuiz id is `@db.Uuid` = 36 chars; HMAC is sha256 hex = 64 chars) — the *examples* are what's wrong.

**Fix:** use a realistic dummy, e.g. `https://manage.klicker.uzh.ch/quizzes/00000000-0000-0000-0000-000000000000/evaluation?hmac=…` or shorten placeholder to `Paste the evaluation link from the Embed dialog`.

### 4.2 Hardcoded prod host blocks staging/QA

**Evidence:** `isValidUrl()` regex pins `https://manage.klicker.uzh.ch`. No way to test the add-in against a stg deployment or local dev URL — validation rejects everything else.

**Fix:** inject allowed hosts at build time via the existing `@rollup/plugin-replace` (e.g. `process.env.ALLOWED_MANAGE_HOSTS`, default prod, dev build adds `127.0.0.1`/stg host). Keep the strict prod default. This also fixes "how do I develop against this locally" for the next person.

### 4.3 `any` and dead weight in `content.ts`

- `initializeOfficeAddin(info: any)` — type it as the `Office.onReady` info object (`{ host: Office.HostType; platform: Office.PlatformType }`). PR checklist "Remove all any" is unchecked; this is the only obvious one in the new file, so it's a 2-minute win.
- Non-PowerPoint host path calls `showMessage(...)` before `initializeApp()` ran, so `messageBox`/`messageText` are still null → the user sees nothing, only a console error. Either initialize the DOM refs first or write the error directly into `document.body`.
- `browserslist: ["last 2 versions", "ie 11"]` + full `core-js/stable` import while `tsconfig` targets `es2022`: the emitted syntax (optional chaining etc. survive at es2022) will crash IE11 regardless, so the ~full core-js payload buys nothing. Either genuinely target older runtimes (lower the `target`, keep core-js) or — recommended — drop the ie11 browserslist entry and import only needed polyfills. Office on Windows uses WebView2/Trident depending on Office version; decide the support floor deliberately and write it in the README.

### 4.4 Repo hygiene

- `apps/office-addin/PLAN.md` (1369 lines) is an AI migration planning doc with historical issue logs. Don't ship it in the app folder — move the durable parts into the PR description / `project/` docs and delete the rest.
- `apps/office-addin/CLAUDE.md` (216 lines): fine to keep per-app agent docs, but verify its claims still match reality after the fixes above (it was written mid-migration).
- Old cleanup leftovers to double-check on the branch: `scripts/clean-cache.js` was deleted but `package.json` still has a `clean:cache` script (now inlined to office-addin-dev-certs — OK, just confirm it works).

---

## 5. What's good (keep)

- React/Formik/Webpack removal: bundle went from multi-chunk vendor+polyfill+content (with a 3901-line CSS file) to two small IIFE bundles — the minified `content.js` is a few KB. Right call for a single-view add-in.
- URL validation with debounced real-time feedback, paste handling, and disabled-button state is a genuine UX upgrade over V1's submit-time-only validation.
- `getSlideID()` retry with exponential backoff and Office API pre-checks is more robust than V1.
- Legacy settings migration is attempted at all (V1→V2 continuity was thought about) — it just needs the per-slide decision from 2.1.
- Single manifest replacing taskpane+content dual setup reduces confusion.

---

## 6. Verification loop (run after each fix batch)

1. `pnpm --filter @klicker-uzh/office-addin build` — clean build, inspect `dist/` (no `.d.ts`, no `tsbuildinfo`, no `bundle-analysis.html` unless ANALYZE).
2. `diff -r apps/office-addin/dist apps/docs/static/office-addin` — deployed copy matches build output exactly.
3. `pnpm run check:all` at root — types, lint, format, syncpack all green.
4. Manual smoke test (PowerPoint on the web is fastest, no install):
   - Sideload `dist/manifest.xml` (for local testing use the dev build so SourceLocation stays on `localhost:3020`, run `pnpm --filter @klicker-uzh/office-addin dev`).
   - Empty state: instructions + image render, button disabled.
   - Paste an invalid URL → red border + message; paste a real evaluation link (create a live quiz on stg/prod, open Embed Evaluation dialog) → green + button enabled.
   - Embed → iframe loads evaluation; close and reopen the file → embed persists.
   - Two embeds on two slides → **each keeps its own URL after reopen** (this is the 2.1 acceptance test).
   - Legacy file: open a deck that used the V1 add-in → migration message, embed still shows.
   - "Change URL" → back to input, setting cleared.
5. Desktop PowerPoint (Windows at minimum) once before release — webview differs from browser.

## 7. Suggested order of execution

| # | Item | Effort |
|---|------|--------|
| 1 | 1.3 rebase onto v3, lockfile | 1–2 h |
| 2 | 1.1 urlProd path fix + rebuild | 30 min |
| 3 | 3.3 lint green | 1–2 h |
| 4 | 1.2 Tailwind build pipeline | 2–4 h |
| 5 | 2.1 per-slide decision + implementation | 2–6 h depending on option |
| 6 | 3.1 artifact cleanup + deploy script | 1 h |
| 7 | 3.2, 4.1, 4.2, 4.3 small fixes | 2 h |
| 8 | 4.4 PLAN.md removal, README/CLAUDE update (PR checklist item) | 1 h |
| 9 | Section 6 full verification, screenshots into PR body | 1–2 h |

After all boxes: undraft, re-run CI, request review. Remaining PR-body checklist items not covered here ("toolbar button instead of hidden in add-ins", ".exe for personal devices") are scope extensions — move them to follow-up issues rather than blocking this PR.
