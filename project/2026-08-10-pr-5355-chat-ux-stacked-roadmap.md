# PR #5355 — Student Chat UX Audit and Stacked Delivery Roadmap

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

## How to work on this (implementation handoff)

- Deliver the core remediation as one five-layer GitHub stack rooted on `v3`.
  One layer is one coherent work package, not one finding or one commit. Keep
  all branches in this worktree; use `gh stack` for topology and cascading
  rebases. Each draft PR must be independently functional, reviewable, green,
  and safe to land.
- Environment: keep the entire GitHub stack in the existing
  `trees/rs-chat-ux-audit` worktree and prove it with `devrouter ensure .`
  (see `CLAUDE.md` → Local Dev Setup); run all pnpm/prisma/test commands
  in-container (`devrouter exec . -- ...`). Chat lives at
  `https://chat.klicker.<workspace>.localhost/<chatbotId>`; the seed creates
  example chatbot configurations (KB/tutor, KB/explainer — ids in the seed
  log) and students `testuser1`–`testuser50` / `abcdabcd`.
- Live model: the five-layer core stack verifies without a model key. F24 is
  already covered by the existing mocked-stream Playwright fixture. The
  separate model-contract follow-up needs `UPSTREAM_OPENAI_API_KEY` injected
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
| F4  | Markdown headings render at document scale inside chat bubbles (`text-4xl`/`text-3xl`); the renderer preserves the document hierarchy by shifting `h1` to an `h2`, but the visual scale still overwhelms the conversation column. (`markdown-text.tsx:94-120`) | 10 |
| F6  | Starter prompts insert bracket placeholders (`[a specific topic]`) with no affordance that the bracket must be replaced; send stays enabled with the raw template. | 06 |
| F12 | Modes (Tutor/Explainer) are never explained in-UI; the tooltip repeats the label verbatim (zero information gain). Recognition-over-recall gap on the app's core concept. | 07, 08 |
| F13 | In the sidebar-enabled mobile layout, credits live inside the closed sidebar and are not visible in the main header or composer. The embedded/no-sidebar layout already has an `EmbeddedCreditsBar`; do not duplicate it. (Ties W7 item 5.) | 36, 37 |
| F14r | Fallback disclosure gap (residual): zero-credit model lists and persisted selection already reconcile to the fallback, and message captions intentionally omit the model. What remains is a missing inline notice at send time that answers now use the fallback while the sidebar is closed. | 31–33 |
| F11 | Thread delete has a good two-click confirm with 4s auto-revert, but no undo after the fact — deletion is permanent. (code) | — |
| F25 | Mobile conversation: the historical audit captured the scroll-to-bottom button overlapping the disclaimer hint. The current 390×844 welcome state shows both starter suggestions fully, and the scroll overlap was not reproduced in the current short thread. Exclude F25 from this stack; reproduce it in a long thread before reopening it. | 36, 40 |
| F27 | Settings copy uses internal jargon: "LiteLLM auto router", "OpenAI reasoning model" — meaningless to students. | 20, 21 |
| F28 | Attachment affordance mismatch: assistant answers invite uploads of "slides or PDFs" while the UI accepts images only — a promise the product can't keep. | 28, 29 |
| F29 | Answer-language instability: an English question answered in German after retry. Swiss orthography is already injected and unit-tested; the missing contract is to answer in the language of the user's last message, including retries. | 27 |
| F17 | Welcome is generic ("Hello! How can I help you?") and does not orient the student to the selected chatbot or mode. This stack may use the existing chatbot name and mode descriptions only; course identity and new course data remain parked under W6. | 05 |

### Cosmetic (severity 1)

| ID  | Finding | Evidence |
| --- | ------- | -------- |
| F15 | "Branch" tooltip wording is developer jargon; students think "versions of the answer". | 16 |
| F8  | noLogin page prints the full redirect URL with UUID in body copy — noise; the button already carries it. | 01 |
| F30 | Error bubbles still offer thumbs rating and a stray "in 6 seconds" relative-time caption on a failed turn. | 26 |
| F31 | The design-system close button exposes an untranslated "Close" label in DE. The approved consent design removes this non-functional close affordance, resolving the label with the control rather than adding app-level translation plumbing. | 39 |
| F32 | Lecturer-defined disclaimer `title` and `introText` have one stored language while the fixed consent chrome is localized. The fixed body is already translated; localized custom content would require a schema/manage/API product decision and is deferred from the UI stack. | 02 |
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

## Stacked delivery roadmap

### Plan identity and decisions

- Current plan:
  `project/2026-08-10-pr-5355-chat-ux-stacked-roadmap.md` (renamed from the
  original audit filename when PR #5355 became the implementation bottom
  layer).
- Existing bottom-layer draft: [PR #5355](https://github.com/uzh-bf/klicker-uzh/pull/5355),
  branch `rs/chat-ux-audit`, target `v3`.
- Provider: GitHub native stacked PRs via `gh stack` (capability verified on
  2026-08-10). One topology owner works in `trees/rs-chat-ux-audit`.
- Ceremony: full path. The stack changes consequential consent behavior and
  several user-facing contracts, so each layer receives its applicable
  verification and review gates before it is opened for review.
- Approved consent decision: remove the non-functional X; Decline remains the
  only explicit refusal action. This resolves F23 and F31 together.
- Approved localization boundary: defer localized lecturer-authored disclaimer
  fields (F32) until a schema/manage/API product decision exists.
- Corrected evidence: remove F26; exclude F25 pending a current long-thread
  reproduction; narrow F14r to the missing inline fallback notice; scope F13
  to the sidebar-enabled mobile layout.
- Historical cleanup: [PR #5197](https://github.com/uzh-bf/klicker-uzh/pull/5197)
  was superseded by the merged student-chat PR series and is not a dependency
  of this stack. Closing it remains a separate maintainer action.
- Planning-stage specialist: GPT-5.6 Sol reviewer, read-only, on the complete
  uncommitted draft at `141c9e43` plus the live worktree. Initial verdict:
  `DONE_WITH_CONCERNS` / revise before Gate 1 approval. Accepted changes:
  account for the plan artifact in layer 01's size; regroup F7 with app-shell
  states; make F17 chatbot-scoped; exclude unreproduced F25; strengthen the
  fallback and starter test obligations; define safe error fault injection;
  mark layer 05 judgment-heavy; add PR-specific plan metadata, PR-description
  finish routing, and autonomous-loop checkpointing.

### Goal and non-goals

- Goal: remove the two remaining severity-3 defects and complete the coherent
  student-chat UX packages without creating immediate same-surface follow-up
  PRs.
- Goal: leave every stack layer independently functional, reviewable, green,
  and safe to land, with real-browser evidence at 1440×900 and 390×844 in EN
  and DE where copy or layout changes.
- Non-goal: localized lecturer-authored disclaimer fields (F32), delete undo
  (F11), unreproduced F25, footer ownership policy (F10), thread search,
  W2–W6, or changes to the ruled D1–D7 identity decisions.
- Non-goal: model-prompt behavior (F28/F29) and blocked citation validation;
  these form a follow-up milestone with different runtime prerequisites.

### Gate 1 stack plan

The layers are sequential capabilities. Their dependency is delivery order,
not hidden incompleteness: each layer must pass the four work-package tests at
its own tip. Estimates are human-authored delta signals, not line-count targets.

```yaml
feature: student-chat-ux-remediation
provider: github
base: v3
mode: progressive

layers:
  - id: 01
    branch: rs/chat-ux-audit
    name: consent-gate
    work_package: responsive, explicit, and failure-safe consent flow
    responsibility: F1, F2, F3, F23, and F31 on one consent surface
    depends_on: v3
    reviewer: student-chat UX and accessibility
    attention: judgment-heavy
    reviewer_focus:
      - consequence-first information order and unambiguous accept/decline semantics
      - complete mobile layout, focus behavior, and absence of a false close affordance
    validation:
      - chat package check and tests
      - existing disclaimer Playwright journey extended for the new contract
      - real browser at 1440x900 and 390x844 in EN and DE
    activation: complete
    risk: medium
    size_signal: ~650 human-authored lines / ~8 files, including the ~430-line plan artifact
    size_ruling: genuinely one work package because the approved plan must travel with the first implementation PR and may not remain a plan-only PR; reviewers can read the audit/plan separately from the ~220-line runtime delta

  - id: 02
    branch: rs/chat-ux-error-states
    name: branded-error-routing
    work_package: distinct branded recovery for missing chatbots and unexpected failures
    responsibility: F21 plus app-shell loading/no-login cleanup F7 and F8
    depends_on: 01
    reviewer: Next.js routing and student-chat UX
    attention: judgment-heavy
    reviewer_focus:
      - missing chatbot links remain 404s while unexpected lookup/render failures reach error.tsx
      - recovery copy gives a useful next action without exposing internals
    validation:
      - chat package check and tests
      - Playwright unknown-chatbot journey plus deterministic unexpected-error proof
      - real browser at desktop and mobile widths in EN and DE
    activation: complete
    risk: medium
    size_signal: ~240 human-authored lines / ~8 files

  - id: 03
    branch: rs/chat-ux-usage-settings
    name: usage-and-model-comprehension
    work_package: understandable modes, models, fallback state, and mobile credit visibility
    responsibility: F12, F13, corrected F14r, and F27
    depends_on: 02
    reviewer: student-chat product UX
    attention: judgment-heavy
    reviewer_focus:
      - explain concepts in student language without exposing model-provider jargon
      - show fallback and credit state once, in the right mobile and embedded contexts
    validation:
      - chat package check and tests
      - settings-store credit/fallback tests and existing zero-credit Playwright journey
      - real browser at desktop, mobile, and embedded layouts in EN and DE
    activation: complete
    risk: medium
    size_signal: ~260 human-authored lines / ~10 files

  - id: 04
    branch: rs/chat-ux-welcome-composer
    name: welcome-and-composer-guidance
    work_package: stable, editable, and chatbot-scoped first-turn guidance
    responsibility: F5, F6, and chatbot-scoped F17
    depends_on: 03
    reviewer: student-chat onboarding UX
    attention: judgment-heavy
    reviewer_focus:
      - starter prompts are immediately available and editable without sending placeholders
      - orientation uses only the existing chatbot name and mode descriptions, without inferring course identity
    validation:
      - chat package check and tests
      - suggestion tests for mapping plus one Playwright starter-editing journey
      - real browser at desktop and mobile widths in EN and DE
    activation: complete
    risk: low
    size_signal: ~180 human-authored lines / ~7 files

  - id: 05
    branch: rs/chat-ux-conversation-polish
    name: conversation-presentation
    work_package: proportional answer hierarchy and student-facing message actions
    responsibility: F4, F15, and corrected F30
    depends_on: 04
    reviewer: chat rendering and interaction UX
    attention: judgment-heavy
    reviewer_focus:
      - headings preserve semantic order without document-scale typography
      - error turns expose no rating or relative-time actions and branch copy avoids jargon
    validation:
      - chat package check and tests
      - focused message-part and action-bar coverage where a stable seam exists
      - real browser with heading-rich, branched, and failed responses in EN and DE
    activation: complete
    risk: low
    size_signal: ~150 human-authored lines / ~6 files

follow_up_stacks:
  - student-chat-model-contracts: F28 image-only assistant contract, F29 last-message-language stability, and the remaining W1 live checks; model key required, citation check waits for doc_query
  - student-chat-data-decisions: F11 soft-delete/undo and F32 localized custom disclaimer content only after explicit product and schema rulings
```

Layer 01 crosses the ~400-line review diagnostic only because it carries this
audit and shared execution plan. Gate 1 accepts that one-package ruling: the
plan cannot travel alone, while the projected runtime delta remains ~220
human-authored lines and is independently identifiable. All other layers stay
below ~400 human-authored lines and ~25 files. If implementation exceeds its
signal, re-run the work-package tests and return to Gate 1 before adding or
splitting a layer.

### Feature-wide test portfolio

| Risk or behavior | Existing protection | Test obligation | Primary seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Consequential consent is readable and explicit | Disclaimer Playwright accept/decline/reopen journeys | Extend existing | `playwright/tests/Y-chat.spec.ts` plus real browser | A mobile user cannot read consequences or can trigger a dead/ambiguous exit | 01 |
| Missing links differ from runtime failures | No dedicated route coverage | Add new | App-router Playwright journey; temporary uncommitted server throw for the unexpected-error browser proof, restored before commit and followed by a clean-tree check | A database/render failure is mislabeled as an expired link or exposes the default Next page | 02 |
| Zero-credit fallback and selection agree | Exhausted-balance display only; current tests do not prove selection reconciliation | Extend existing | `settings-store-credits.test.ts` and `Y-chat.spec.ts` | A persisted unavailable premium model survives exhaustion, the fallback notice is hidden, or the outgoing request uses the wrong model | 03 |
| Starter content is stable and editable | Suggestion unit tests cover mode-to-starter mappings only | Extend existing | `suggestions.test.ts` plus one Playwright click/select/replace/send journey | A starter appears late or sends unresolved bracket placeholders | 04 |
| Failed messages expose no feedback actions | Hydration/message-part and rating tests | Extend existing at the action-rendering seam | Focused chat test plus real browser | A failed assistant turn can still be rated or displays a misleading relative timestamp | 05 |

Pure copy and layout changes use existing behavioral tests plus real-browser
evidence; they do not receive redundant implementation-coupled unit tests.

### Execution and review contract

- Before implementation, synchronize the bottom branch with current
  `origin/v3`, verify local and remote topology agree, then initialize the five
  branches as one native GitHub stack. Use stack-aware force-with-lease only;
  never use a raw force push.
- Keep the roadmap with layer 01. Each upper layer updates `Progress` in this
  same file alongside its implementation and references the already-merged or
  downstack plan.
- Work bottom-up. Keep tests and `docs/chat-platform.md` updates with the
  behavior they protect; never create separate test or documentation layers.
- Run pnpm, Playwright, and app commands inside the exact devcontainer through
  `devrouter exec . -- ...`; run host Git and `gh stack` commands outside it.
- Use `agent-browser` for engineering verification and the in-app Browser for
  the requested visual pass. Log in with a seeded `testuser`; capture changed
  states at relevant viewports and locales for each draft PR.
- Publish every layer as a draft. Opening for review is Gate 3; merging,
  deleting, unstacking, reordering, and deployment require separate explicit
  authorization.
- Use `rs-mr-description-writer` to replace PR #5355's obsolete docs-only
  title/body and to describe every later draft from whole-layer evidence.
- Apply the repository's full-path final review gates to each finished PR
  package before presenting it as ready. CI is checked independently per
  layer; a green top layer never clears a lower failure.

### Progress

- Current (2026-08-11): layer 01 consent-gate implementation and visual
  verification are committed locally on `rs/chat-ux-audit`; the reviewed
  roadmap is carried in this same layer. The branch is rebased onto current
  `origin/v3` (`0d7b4e461`) and published as the bottom of the native stack.
  PR #5355 is still draft and its title/body now need the whole-layer update.
- Verified: GitHub stack capability is enabled; `gh stack view --json` reports
  the five-branch chain rooted at `v3`, with all branch pointers pushed using
  gh-stack's atomic force-with-lease operation. The exact container's full
  `check:all` gate passed with 24/24 tasks after the layer-01 commits; chat
  typecheck and lint passed with 0 errors and 5 pre-existing warnings. The
  focused Playwright journey still reaches the runner but cannot launch
  because the container lacks a usable Chromium headless shell; this remains
  an automated-verification gap for hosted CI.
- Planning-stage review: `DONE_WITH_CONCERNS`; all verified findings listed in
  Plan identity were accepted into this revision. No unresolved planning-stage
  finding remains.
- Integrated review (2026-08-11, exact range `v3..a996a199d`) returned
  `NEEDS CHANGES`: the close-button assertion was scoped outside the dialog,
  and the planned automated/browser matrix was incomplete. The assertion was
  corrected in `bcae6c4b9`; the remaining verification concern is now closed
  by the live browser pass below.
- Verified for layer 01 in the real in-app Browser after an exact devrouter
  restart: `testuser1` reaches the consent modal in EN and DE at 1440x900 and
  390x844. The modal keeps consequence-first ordering, stacks content and
  actions on mobile, exposes no close button, stays open after Escape, and
  closes only after the explicit accept action. German locale selection was
  performed through the participant UI, and acceptance returned to the German
  composer. The screenshots are retained under the gitignored
  `project/_local/browser/` evidence directory.
- Current (2026-08-11): layer 02 branded-error-routing is implemented on
  `rs/chat-ux-error-states` as the next stack slice. The dynamic layout now
  distinguishes an absent chatbot row with `notFound()` from unexpected
  failures; root `app/not-found.tsx` and `app/error.tsx` provide the recovery
  surfaces because a same-segment error boundary cannot catch its layout.
  Loading, no-login, locale, wiki, E2E guidance, and the focused unknown-link
  contract are included in this slice.
- Verified for layer 02 in the real in-app Browser: the missing-chatbot card
  renders in German at 1440x900 and in English at 390x844, keeps the branded
  return action, and omits the unknown UUID from visible copy. A temporary
  throw in the dynamic layout rendered the English mobile error card with
  retry/return actions and no raw server error; the throw was removed before
  commit, and the valid route returned to the authenticated composer.
- Layer-02 automated verification currently passes chat typecheck, lint with
  0 errors and the same 5 pre-existing warnings, and 31 files / 231 tests.
  The focused Playwright journey remains a hosted-CI gate because this
  container lacks a usable Chromium headless shell.
- Environment recovery note: the 404s observed during the browser pass were
  caused by a stale Turbopack `.next` route manifest after dependency
  recovery, not by missing source routes. Clearing only generated
  `apps/chat/.next` and restarting the exact devrouter checkout restored the
  API routes and the consent flow.
- Publication note: the repository pre-push hook could not complete its
  unrelated root build because unchanged `olat-api` source fails Rollup's
  parser; the layer-specific checks and container chat production build passed,
  and the exception was recorded when the stack was pushed.
- Next: update draft PR #5355 with whole-layer evidence, then implement layers
  02–05 bottom-up. The four upper branches currently point at the layer-01 tip
  and carry no PR until their named work packages are implemented.

### Autonomous goal prompt

Use this prompt after Gate 1 approval:

> Deliver the approved `student-chat-ux-remediation` GitHub stack through all
> five draft PR layers. The terminal condition is: every layer in
> `project/2026-08-10-pr-5355-chat-ux-stacked-roadmap.md` is implemented on
> its named branch in the single worktree `trees/rs-chat-ux-audit`, independently
> green and reviewed at its own tip, visually verified in the real app, pushed,
> and represented by an up-to-date draft PR; the stack remains unmerged and not
> ready-for-review. Start from branch `rs/chat-ux-audit`, target `v3`, and resume
> from verified Git and `Progress` state rather than chat history. Scope is
> exactly layers 01–05; the two follow-up stacks and all listed non-goals are
> excluded. Follow `rs-stacked-change`, `gh-stack`,
> `rs-sliced-development-workflow`, `klicker-frontend-ui`,
> `klicker-testing-verification`, `agent-browser`, the in-app Browser workflow,
> `klicker-wiki-maintenance`, `rs-mr-description-writer`, and repository
> review/verification gates. Keep
> `Progress` current and commit each coherent layer with its tests, wiki update,
> and evidence. Local edits, commits, stack-aware synchronization, pushes, and
> draft PR creation/update are authorized by this goal. Do not merge, mark ready,
> deploy, delete/unstack/reorder branches, alter secrets, or start either
> follow-up stack. Pause only for a topology or product-design change, a stack
> divergence or conflict that cannot be resolved confidently, missing authority
> for an external/destructive action, a genuine environment blocker, or the
> terminal condition. Before context or spend limits threaten continuity, use
> `rs-handoff` under `~/.handoffs/klicker-uzh/`; on a hard rate/spend limit,
> checkpoint and stop rather than treating a layer boundary as completion. At
> completion, report the bottom-up PR list, per-layer
> human/generated delta, checks, visual evidence, review outcomes, CI state, and
> remaining Gate 3 decision.

## Environment notes from this audit (not app UX)

- `devrouter ensure` readiness probes fail on this host because macOS curl
  drops `--cacert` (SecureTransport keychain trust) — worked around with a
  curl shim; fix belongs in devrouter, not this repo.
- Reconfirmed: running typegen/`check` while the dev stack is up de-registers
  dynamic API routes (feedback POST 404s with the route file present);
  restart with host-side `devrouter ensure .` from the exact checkout after
  typecheck, as documented in `docs/chat-platform.md`. This is an environment
  gotcha, not an app defect.
