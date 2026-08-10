# Student Chat — UX/Design Audit and Roadmap (2026-08-10)

- Scope: all user-facing surfaces of `apps/chat` (disclaimer/consent, welcome,
  conversation, threads, settings, credits, attachments, errors, embedded,
  mobile, DE/EN).
- Method: code analysis of `apps/chat/src` + hands-on visual investigation of
  the running stack (worktree `trees/rs-chat-ux-audit`, audit base `v3` @
  7dee0d369; current PR target `v3` @ 0d7b4e461 is two deployment-promotion
  commits ahead, with no source change in this audit scope; live model via
  litellm→OpenRouter, agent-browser at 1440×900 and 390×844, EN + DE,
  testuser1/testuser2).
- Frameworks: `ux-heuristics` (Nielsen 10 + Krug, severity 0–4 per issue,
  score from the 10-row Quick Diagnostic) and `refactoring-ui`
  (score = satisfied rows of its 8-row diagnostic ÷ 8 × 10).
- Evidence: 42 screenshots from the audit run in
  `project/_local/2026-08-10-chat-ux-audit/shots/` (gitignored — never commit;
  referenced below by number). They are historical evidence for the audit
  base, not proof of a later source revision.
- Prior work integrated, not duplicated:
  [2026-07-27 follow-up roadmap](./2026-07-27-student-chat-v3-follow-up-roadmap.md)
  (W1–W7) and the ruled design decisions D1–D7 from the 2026-07-26 plan.

## How to work on this (junior handoff)

- One roadmap phase (R0–R3) = one small PR to `v3`, conventional commit,
  before/after screenshots in the PR body. R0 items may ship as separate PRs;
  do not bundle phases.
- Environment: own worktree stack via `devrouter workspace up <branch>`
  (see `CLAUDE.md` → Local Dev Setup); run all pnpm/prisma/test commands
  in-container (`devrouter exec . -- ...`). Chat lives at
  `https://chat.klicker.<workspace>.localhost/<chatbotId>`; the seed creates
  example chatbot configurations (KB/tutor, KB/explainer — ids in the seed
  log) and students `testuser1`–`testuser50` / `abcdabcd`.
- Live model: disclaimer, error-route, copy, and mobile-layout items verify
  without a model key. The F24 branch-picker state is covered by the existing
  mocked-stream Playwright fixture and does not need a model key. Only
  model-behavior claims in F14r and R4 need `UPSTREAM_OPENAI_API_KEY` injected
  at `devrouter ensure` time — ask the maintainer for a dev key; never commit
  it (public repo).
- Verification: `agent-browser` is mandatory for every item (repo
  convention). Viewports used in this audit: 1440×900 and 390×844. Switch
  locale for DE/EN checks with the `NEXT_LOCALE` cookie (`de`/`en`), not DB
  edits.
- Gotcha: never run typegen/`pnpm check` while browsing the running app — it
  de-registers dynamic API routes (404 with the file present). Run typecheck
  before the browser pass, then restart the exact stack from the host with
  `devrouter ensure .` if recovery is needed; do not rely on touching a route
  file in-container.
- Evidence screenshots are local to the audit machine (gitignored
  `project/_local/2026-08-10-chat-ux-audit/shots/`); reproduce any state
  from the finding's surface + viewport instead of hunting for the files.

## Delta vs. prior roadmap — verified fixed or ruled, not re-reported

- Fixed since 2026-07-27 and confirmed live: streaming stability + feedback
  single-ownership (#5351), mode-tailored welcome starters (#5349), credits
  formatting/persistence + abort guard (#5299), stop-generation flow exercised
  (shot 25) — mid-stream truncation itself rests on the prior P2-1
  verification, not re-proven here (the test answer completed before the
  stop landed).
- Live-model round (was W1) partially closed by this audit: streaming,
  reasoning display, credits decrement per turn, image-analyzed chip, and
  retry recovery all verified live (shots 09–33). Still open from W1: the
  citation `[n]` contract (doc_query producer is not connected in any env)
  and the German orthography contract (spot-checked OK; no systematic pass).
- F24 is not an open finding on the current source head: root edits preserve
  the original user message's parent, update both the current path and
  `allMessages`, and the existing Playwright root-edit regression guard expects
  an immediate picker with two branches. Recheck the original screenshot sequence
  (15–18) against the exact current action row before reopening it; any
  assistant-row parent relationship is a separate, scoped hypothesis.
- Ruled decisions not reopened: segmented mode switcher, header identity,
  KlickerLogo footer, client-side sources, `[n]` markers, activity chips,
  composer hint (D1–D7); W6 parks logo/header/switcher identity questions.

## Findings

Severity: 0 none · 1 cosmetic · 2 minor (delay/frustration) · 3 major (task
failure) · 4 catastrophic. All severity-2+ items were confirmed visually
unless marked (code).

### Major (severity 3)

| ID  | Finding | Evidence |
| --- | ------- | -------- |
| F3  | Mobile disclaimer is broken: `flex flex-row` never stacks, so at 390px the intro text renders in a ~110px column beside the video, and the video is clipped outside the dialog. This is the consent gate every student passes on first use. (`disclaimer-modal.tsx:97`) | 38, 39 |
| F21 | Unknown/expired chatbot link → bare default Next 404 (black page, no branding, no guidance, no link out). Students reach this via mistyped or stale course links; the app has no custom `not-found`/`error`/`global-error` routes at all. | 34 |

### Minor (severity 2)

| ID  | Finding | Evidence |
| --- | ------- | -------- |
| F1  | Disclaimer Accept and Decline are visually identical default buttons — no primary/secondary hierarchy on the app's most consequential choice (Decline blocks the chatbot). | 02 |
| F2  | The "what happens after your choice" consequence box renders *below* the action buttons and sits at/under the fold — users decide before seeing consequences. | 03, 03b |
| F23 | The disclaimer dialog shows an X close button that does nothing (no handler wired) — a visible exit that fails, on the same surface as F1/F2. | 04 |
| F4  | Markdown headings render at document scale inside chat bubbles (h1 `text-4xl`, h2 `text-3xl`); LLM answers with `##`/`###` produce display-size type inside a conversation column, inverting hierarchy. (`markdown-text.tsx:94-120`) | 10 |
| F6  | Starter prompts insert bracket placeholders (`[a specific topic]`) with no affordance that the bracket must be replaced; send stays enabled with the raw template. | 06 |
| F12 | Modes (Tutor/Explainer) are never explained in-UI; the tooltip repeats the label verbatim (zero information gain). Recognition-over-recall gap on the app's core concept. | 07, 08 |
| F13 | Credits are visible only in the sidebar footer — invisible on mobile and whenever the sidebar is closed, until they run out. (Ties parked W7.5.) | 36, 37 |
| F14r | Fallback disclosure gaps (residual — caption *does* show "mode — model — effort — credits" and names the GPT-4.1 Mini fallback when exhausted): no inline notice at send time that the model was downgraded; settings still shows the Luna selection; naming is inconsistent (raw id `gpt-5.6-luna` vs. friendly "GPT-4.1 Mini"). | 31–33 |
| F11 | Thread delete has a good two-click confirm with 4s auto-revert, but no undo after the fact — deletion is permanent. (code) | — |
| F25 | Mobile welcome: the second starter suggestion is half-hidden behind the composer (EN and DE), and the scroll-to-bottom button overlaps the disclaimer hint text. | 36, 40 |
| F26 | Mobile sidebar opens as a full overlay with no scrim/dim behind it and duplicates the header icon row — disorienting; unclear how to dismiss. | 37 |
| F27 | Settings copy uses internal jargon: "LiteLLM auto router", "OpenAI reasoning model" — meaningless to students. | 20, 21 |
| F28 | Attachment affordance mismatch: assistant answers invite uploads of "slides or PDFs" while the UI accepts images only — a promise the product can't keep. | 28, 29 |
| F29 | Answer-language instability: an English question answered in German after retry (prompt-contract issue, ties W1 orthography/language work). | 27 |
| F17 | Welcome is generic ("Hello! How can I help you?") — no scope orientation (what this chatbot knows / which course). Trunk-test gap; ties W6 identity decisions. | 05 |

### Cosmetic (severity 1)

| ID  | Finding | Evidence |
| --- | ------- | -------- |
| F15 | "Branch" tooltip wording is developer jargon; students think "versions of the answer". | 16 |
| F8  | noLogin page prints the full redirect URL with UUID in body copy — noise; the button already carries it. | 01 |
| F30 | Error bubbles still offer thumbs rating and a stray "in 6 seconds" relative-time caption on a failed turn. | 26 |
| F31 | "Close" aria-label untranslated in DE (dialog); the only localization gap found — DE coverage is otherwise complete. | 39 |
| F32 | Disclaimer body content is DE-only while chrome localizes to EN — mixed-language consent surface for EN users. | 02 |
| F5  | Welcome starters pop in after mode options load (brief blank gap). (code) | — |
| F7  | Initial app load is a plain "Loading chatbot..." text line, inconsistent with the polished skeletons used elsewhere. (code) | — |
| F10 | Sidebar footer stacks four bands incl. an English-only "DF Teaching Center" copyright shown for every chatbot regardless of owner. | 05 |

### Strengths (hold the line on these)

Streaming with reasoning-step titles collapsing to "Reasoning (Medium)";
tool/activity chips ("Image analyzed"); KaTeX; skeletons for thread + list;
error recovery with working retry; stop keeps partial output; two-click
delete confirm; two-click rename; thumbs persistence (fill + `aria-pressed`);
attachment flow + viewer modal; embedded mode (`?embed=1`) is clean and works
(shot 35); 44px touch targets, sr-only labels, `motion-reduce`, `inert`
crossfades throughout; near-complete DE localization; constrained message
column; disciplined zinc + UZH-blue token system on the Tailwind scale.

## Scores

### refactoring-ui: 9/10

7 of 8 diagnostic rows satisfied (`round(7/8 × 10) = 9`). Grayscale-first
design, generous white space, de-emphasized labels/captions, consistent
spacing scale, constrained text width, contrast, and shadow scale all pass.

Failed row — **blur-test hierarchy**, driven by three findings on two
surfaces: F1 (identical consent buttons), F2 (consequence box below actions),
F4 (document-scale headings inside bubbles).

Gap to 10: fix F1 + F2 + F4. The visual system itself is in excellent shape;
these are placement/scale decisions, not systemic problems.

### ux-heuristics: 6/10

Failed Quick-Diagnostic rows (start 10, subtract per failed row weighted by
worst triggered severity):

| Row | Worst issue | Weight |
| --- | ----------- | ------ |
| "Are error messages helpful?" | F21 bare 404 dead end (sev 3) — in-flow chat errors are exemplary, the app shell has none | −2 |
| "Can users undo or go back?" | F11 no undo after delete, F23 dead X (sev 2) | −1 |
| "Does anything make me stop and think 'huh?'" | Comprehension cluster: F12 modes unexplained, F27 jargon, F6 placeholder, F15 (worst sev 2) | −1 |

Score 10 − 4 = **6**. Band check agrees: no catastrophic issue, but two
severity-3 majors (F3, F21) put it in the 6–8 band at the bottom. The
"system status" row passes overall (streaming/skeletons are a strength) but
carries F14r as an itemized gap; F3 is a responsive-layout defect on the
consent gate rather than a diagnostic-row failure and is the single biggest
severity driver.

Gap to 10 (in order of leverage): fix the two majors F3/F21 (removes all
sev-3 issues → 9–10 band eligibility), add delete undo + wire or remove the X
(clears the undo row), explain modes + de-jargon settings/branch copy +
placeholder affordance (clears the comprehension row), then F14r inline
fallback notice (clears the last status gap).

## Roadmap

Ordered by leverage; each phase is independently shippable as one small PR
with before/after screenshots (per `agent-browser` verification convention).
Estimates assume the worktree stack recipe from this audit.

### R0 — Majors (fix soon, ~1 d)

1. **F3 responsive disclaimer** (~0.5 d): stack intro/media with
   `flex-col md:flex-row` in `disclaimer-modal.tsx`; keep the video inside
   the dialog at mobile widths. Fold in **F2**: move the consequence box
   above the action row so choice follows consequence. Check: 390×844 EN+DE,
   video fully visible, consequences readable before buttons.
2. **F21 branded error routes** (~0.5 d): add `app/not-found.tsx`,
   `app/error.tsx` (+ `global-error.tsx`) with the app's visual language,
   a plain-language explanation ("this chatbot link is invalid or expired"),
   and a pointer to the course/LMS. Check: unknown chatbotId, forced render
   error.
### R1 — Consent & trust surface (~1–1.5 d)

1. **F1** button hierarchy: primary (filled) "Accept and continue",
   secondary/outline "Decline".
2. **F23** wire the X to the decline path with the existing consequence
   messaging, or remove it — no dead controls on the consent gate.
3. **F14r** fallback disclosure: one inline notice above the composer when
   credits are exhausted ("answers now use GPT-4.1 Mini"); grey out the
   unavailable premium models in settings; single friendly-name map shared by
   caption, settings, and notice (kills raw `gpt-5.6-luna`).
4. **F31/F32** i18n sweep on the dialog: translate the Close label; either
   localize the disclaimer body or label it as German-only content for EN
   users.

### R2 — Comprehension & copy (~1–1.5 d)

1. **F12** one-line mode descriptions in the switcher tooltips/subtitle
   ("Tutor — asks guiding questions; Explainer — gives direct explanations").
2. **F27** settings copy in student language ("automatically picks the best
   model"; "model that thinks before answering"); keep technical ids out of
   the primary line.
3. **F15** rename branch tooltips to "Previous/Next version".
4. **F6** placeholder affordance: on starter insert, select/highlight the
   bracket segment so typing replaces it (composer `setSelectionRange`).
5. **F28** attachment honesty: state accepted types at the attach point and
   add an image-only line to the prompt contract so the model stops inviting
   PDFs.
6. **F17** welcome scope line under the greeting (chatbot name + what it can
   help with) — coordinate with parked W6 identity ruling; copy-only is safe
   now.

### R3 — Mobile polish (~1 d)

1. **F25** reserve composer height under the starter list (padding-bottom)
   and de-overlap the scroll-to-bottom button from the footer hint.
2. **F26** sidebar overlay: add a scrim, dismiss on scrim tap, and drop the
   duplicated header icon row inside the overlay.
3. **F13** credits on mobile: small credits chip in the header or composer
   caption when the sidebar is hidden (resolves parked W7.5 for mobile).

### R4 — Conversation quality (prompt contracts, ties W1)

1. **F29** language-stability clause in the chat contract (answer in the
   language of the user's last message, incl. on retry); extend the existing
   orthography contract tests.
2. **F30** suppress rating buttons and relative-time caption on error parts.
3. Finish the open W1 checks when doc_query is connected: citation `[n]`
   grounding + systematic orthography pass.

### R5 — Deferred polish (fold into W7 as fillers)

F5 reserve starter space; F7 skeleton for initial load; F8 drop the raw URL;
F10 footer density + owner-aware copyright; F11 undo toast (needs a
soft-delete product decision first); thread search once lists grow beyond a
screen (no search surface exists today — fine at current volumes).

### Explicitly not in this roadmap

W2 citation phase 2, W3 telemetry repair, W4 hardening, W5 environment
chores — unchanged from the 2026-07-27 roadmap. W6 identity questions stay
parked pending a design ruling; R2.6 touches copy only.

## Environment notes from this audit (not app UX)

- `devrouter ensure` readiness probes fail on this host because macOS curl
  drops `--cacert` (SecureTransport keychain trust) — worked around with a
  curl shim; fix belongs in devrouter, not this repo.
- Reconfirmed: running typegen/`check` while the dev stack is up de-registers
  dynamic API routes (feedback POST 404s with the route file present);
  restart with host-side `devrouter ensure .` from the exact checkout after
  typecheck, as documented in `docs/chat-platform.md`. This is an environment
  gotcha, not an app defect.
