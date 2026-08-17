# Chat UX review fixes — a11y and state-consistency corrections

## Plan identity

- Plan: `project/2026-08-17-chat-ux-review-fixes-plan.md`
- Branch: `rs/chat-ux-review-fixes` (from `origin/v3` `822695ef8`), target `v3`
- PR: not yet opened
- History: findings source is the 2026-08-17 senior UX review (gitignored
  `project/_local/reviews/2026-08-17-senior-ux-review-student-chat.md`);
  prior context in `project/2026-08-10-pr-5355-chat-ux-stacked-roadmap.md`.

## Goal and non-goals

- Goal: fix the P1/P2 findings (and cheap P3s) from the 2026-08-17 senior UX
  review of `apps/chat`: abort state divergence, consent-gate focus, streamed
  output announcements, history-rail accessible labels, embedded-select
  label, dialog modality, Send↔Stop focus, silent rating failure, citation
  focus, skip link/landmarks, rail tick contrast, reduced-motion guard, and
  assorted markup/i18n polish.
- Non-goals (deferred with reasons):
  - `packages/markdown` fixes (alt text, h1 shift, expand-button label) —
    shared across apps, separate package with its own verification.
  - `@uzh-bf/design-system` internals (untranslated sr-only sheet/close
    strings) — upstream repository.
  - Duplicate mode switcher — owned by the W6/mode-preference rework.
  - Errored-attempt version navigation and the assistant-branch `parentId`
    hypothesis — product ruling + investigation first.
  - F29 answer-language contract — product-facing prompt change, propose
    separately.
  - Pre-existing answerless turns persisted before this branch continue to
    render bare on reload; only turns aborted after this change carry the
    stopped marker (see S5 ruling).

## Ceremony and topology

- Full path. Single PR on one branch (one concern, one app, one reviewer
  audience; no stack).
- Runtime note: this branch is checked out in the existing worktree
  `trees/chat-history-rail` to reuse its proven devcontainer stack
  (`default-rs-0f6d6`, chat at
  `https://chat.klicker.rs-chat-history-rail.localhost`) instead of paying
  for a new stack under host memory pressure. The worktree directory name
  does not match the branch; routes keep the `rs-chat-history-rail`
  namespace.

## Primitive impact

- No product primitives change. The stopped-turn marker presents an already
  existing state (user aborted; server keeps the turn) that today renders
  inconsistently; consent, rating, credits, and thread contracts are
  untouched. The persisted-content shape gains one additive `data` part
  variant (internal API, single consumer). No ADR triggered.

## Planning-stage review

- Planner pass 2026-08-17: `ACCEPT-WITH-CHANGES` (report recovered from the
  planner child transcript; key findings below, all accepted and folded in):
  1. assistant-ui `cancelRun` schedules a `setTimeout(0)` store resync that
     truncates the turn AFTER the hook's catch runs — the reconciled abort
     write must be deferred past that timer and must update `allMessages`,
     not only `messages` (S5 mechanism).
  2. Unit seams can't prove abort-survival (store mocked) — survival is a
     mandatory live-browser gate, unit tests prove only message building.
  3. Test seams retargeted: abort store write →
     `test/chat-response-hydration.test.ts` (real hook harness);
     reload/persistence → `test/persisted-assistant-content.test.ts`
     (correct under the marker ruling); `openai-chat-streaming.test.ts`
     never imports app code and carries no obligation.
  4. Client-only reload mapping cannot cover text-phase aborts and creates
     cross-tab false positives plus phantom branch siblings → ruled to
     persist the marker (S5 ruling below).
  5. Marker-only assistant messages serialize to `''` and would be sent to
     the model — filter empty assistant messages from the request body
     (also fixes the latent `chat-error` case).
  6. Design-system `Modal` hardcodes `onOpenAutoFocus` prevention with no
     passthrough — only Accept-by-ref focus is viable, and the gate state
     must reach the composer via the existing `chat-ui-context` (S3
     rewritten to that single mechanism).
  7. `chat-stopped` needs explicit treatment at the two `hasChatError` call
     sites and a stopped-distinct announcer signal (S2/S5 contracts below);
     rail maps it to the existing `partial` status.
  8. Slice re-cuts: dialog modality + `aria-controls` move to S4 (rail
     surface); CC-13 gets a local `role="status"` in `thread-list.tsx`
     (decouples S2/S6); S6 splits into S6a/S6b.

## Test portfolio

| Risk | Existing evidence | Obligation | Primary seam | Distinct failure |
| --- | --- | --- | --- | --- |
| Rail label projection (flatten+truncate) emits readable text | `test/history-rail.test.ts` asserts preview/userText separation | extend existing | unit: projection fn in `lib/history-rail.ts` | markdown syntax or full-turn text reaches `aria-label`/preview |
| Abort builds the stopped turn (client) | `test/chat-response-hydration.test.ts` already covers error-path store writes | extend existing | hook harness: AbortError branch | hook never writes the turn + `chat-stopped` part |
| Stopped turn survives assistant-ui cancel resync | none possible at unit level (store mocked) | live proof (mandatory) | browser: abort ×3 shapes + 5s idle + reload | turn vanishes after `cancelRun`'s deferred resync |
| Aborted turns persist the marker (server) | `test/persisted-assistant-content.test.ts` | extend existing | `buildAbortedAssistantContent` / abort persistence | zero-content abort persists nothing; marker missing |
| Empty assistant messages excluded from request body | none | add new (in hydration test) | `useChatResponse` body build | marker/error-only turns sent as empty assistant turns |
| Rating failure surfaces an error | `test/chat-store-rating.test.ts` drives real store | extend existing | store/coordinator error path (failure must be store-exposed, not component-local) | failed POST stays silent |
| Focus/announcement/landmark markup | Playwright chat suite in CI; live agent-browser passes per slice | none (browser evidence) | — | — |

## Delegation Map

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Polish & labels | S1 | executor (Opus) | none | check + test:run + browser name read |
| Announcements | S2 | executor (Opus) | none | check + extended rating test + AT-tree read |
| Focus seams | S3 | executor (Opus) | after S2 (thread.tsx serial) | check + keyboard walk |
| Rail | S4 | executor (Opus) | none (serial) | extended `history-rail.test.ts` + browser |
| Abort lifecycle | S5 | **main session** | after S2 (stopped signal) | hydration + persistence tests + live abort ×3 + reload; slice-reviewer |
| Landmarks | S6a | executor (Opus) | after S5 | check + landmark tree per state |
| Motion & semantics | S6b | executor (Opus) | after S6a | check + reduced-motion emulation |

Execution-tier skip reason (S5): critical-path coupling — persistence-shape
change plus runtime-timing seam ruled by main. All slices serial (shared
`thread.tsx`/`history-rail.tsx`). Main session owns seam decisions,
verification, commits, reviews, publication.

## Slices

### S1 — polish: labels, naming, i18n

- Problem: unlabeled embedded `<select>` (P1-5); no new-tab indication
  (CC-15); "Refresh" vs "Try again" naming (P3-e); English-only footer line
  (F10).
- Do: `aria-label={t('chat.settingsPanel.mode')}` on the
  `embedded-settings.tsx` select; localized sr-only "(opens in new tab)" on
  external links in `sources-section.tsx` and `app-sidebar.tsx`; align the
  regenerate control's accessible name with the existing retry wording;
  localize the copyright line via `packages/i18n` (both locales). No rail
  edits (those live in S4).
- Check: `pnpm --filter @klicker-uzh/chat run check` + `run test:run`
  in-container; browser spot-check of select and link accessible names.
- Commit: `fix(chat): label embedded mode select and localize link naming`

### S2 — announcements: run-state live region + rating failure

- Problem: streamed answers never announced (P1-3); failed rating reverts
  silently (CC-17); delete-confirm armed state unreliably announced (CC-13).
- Do: one polite visually-hidden live region in `thread.tsx` announcing
  localized run-state transitions (started / completed / stopped / error);
  expose a thread-level last-run-outcome distinct from `isRunning` (an
  `isRunning`-only signal reads "completed" on aborts because `onCancel`
  clears running before the hook's finally) — S5 consumes the stopped
  transition; surface a localized inline `role="alert"` next to the rating
  buttons on rejected POST, with the failure exposed from
  `chatStore`/`ratingRequestCoordinator` state (not component-local) so
  `test/chat-store-rating.test.ts` can assert it; give `thread-list.tsx`
  its own local sr-only `role="status"` for the delete-confirm armed state.
- Check: check + test:run (extended rating test); browser: AT-tree read of
  the live region across send→complete and a forced rating failure.
- Commit: `fix(chat): announce run-state transitions and rating failures`

### S3 — focus seams: consent gate, Send↔Stop, starters, citations

- Problem: consent dialog never receives focus while the composer
  autofocuses behind it (P1-2); Send↔Stop swap drops focus to body (CC-6);
  starter click leaves focus on card (P3-a); citation chip scrolls without
  moving focus (CC-7).
- Do: focus the Accept button by ref in an effect keyed on the dialog's
  open state (design-system `Modal` hardcodes `onOpenAutoFocus`
  prevention — do not fork it); channel the gate-open state through the
  existing `chat-ui-context` so `thread.tsx:608` suppresses composer
  `autoFocus` while open, and move focus to the composer on accept; on
  `isRunning` flip, move focus to the enabled Send/Stop sibling when focus
  was on the disabled one (`thread.tsx:987-1020`); focus the composer after
  a starter populates it; citation activation moves focus to the target
  source card (`tabIndex={-1}` on non-link cards, `citation-chip.tsx:40-45`,
  `sources-section.tsx:105-131`).
- Check: check + test:run; browser keyboard-only walk: gate-open first Tab
  stays in dialog, Accept → composer focused; stop mid-run via keyboard;
  starter → type; citation → next Tab continues from sources.
- Commit: `fix(chat): manage focus at dialog, composer, and citation seams`

### S4 — rail: labels, tick affordance, dialog semantics

- Problem: rail popover/panel/labels carry full untruncated turns as raw
  markdown (P1-4); inactive ticks ≈1.2:1 contrast and literal
  `ring-blue-700` (CC-9); history dialog `role=dialog` without
  `aria-modal`/containment and Escape dead outside rows (CC-5); dangling
  `aria-controls` and duplicate aside/nav names (CC-12).
- Do: one shared plain-text projection (strip markdown → collapse
  whitespace → truncate) in `lib/history-rail.ts` used by `preview` and
  both label builders (`history-rail.tsx:188-218,332-350`); full text
  remains only in the hover popover; raise the inactive tick to a visible
  neutral (≥3:1 target) and switch rail focus rings to the `--ring` token;
  add `aria-modal` and document-level Escape/outside-pointer dismissal to
  the history dialog (presentation unchanged — bottom sheet and hover
  popover are ruled); fix `aria-controls` to reference only existing ids
  and drop the duplicate nav name.
- Check: extend `test/history-rail.test.ts` (markdown fixtures → clean
  labels); browser: label read, tick computed color, Escape-from-anywhere.
- Commit: `fix(chat): flatten history-rail labels and fix rail semantics`

### S5 — abort lifecycle reconciliation (risk slice, main-owned)

- Ruling (2026-08-17, planner finding 4 option i): **persist the stopped
  marker server-side.** Verified pre-ruling: the messages GET returns
  `msg.content` verbatim (no stripping) and `convertApiMessageToMessage`
  passes unknown part types through its fallback, so an additive
  `{ type: 'data', name: 'chat-stopped', data: {} }` part survives the
  full round trip. The marker carries no user-facing strings — the client
  renders the label via `t()` keyed on the part name (server has no
  reliable locale).
- Do:
  - Server: in the chat route's abort persistence path, append the
    `chat-stopped` part and persist the assistant row even when
    `buildAbortedAssistantContent` is empty (drop the `length > 0` guard
    for aborts only). Add the `data` variant to
    `PersistedAssistantContentPart` and `ApiContentPart`.
  - Client: in the `AbortError` branch of `useChatResponse.ts`, build the
    final assistant message (`orderedContentParts` + `chat-stopped`) and
    write BOTH `messages` and `allMessages`, **deferred past
    `cancelRun`'s `setTimeout(0)` resync** (a synchronous write in the
    catch or in `onCancel` is overwritten — planner finding 1).
  - Renderer: `chat-stopped` renders a neutral localized "response
    stopped" callout with the same retry affordance as errors; stopped
    WITH text keeps timestamp/rating (real partial answer), stopped
    WITHOUT text follows the error treatment at the two `hasChatError`
    call sites (`thread.tsx:176,1451`).
  - Rail: map `chat-stopped` to the existing `partial` status in
    `history-rail.ts:81-94`.
  - Request body: filter assistant messages whose serialized text is empty
    from `useChatResponse` body building (covers stopped- and error-only
    turns).
  - Announce "response stopped" via the S2 live region.
- Risk: streaming lifecycle + persistence seam — `slice-reviewer` required.
  Lenses: state consistency across stream/store/reload; no double-append on
  retry-after-abort; no phantom branch siblings; cross-tab behavior;
  `#5393` terminal-sources interaction (`showSources` keys on
  running+text — verified compatible, re-check in review).
- Check: extended `chat-response-hydration.test.ts` (abort write, empty
  filter) + `persisted-assistant-content.test.ts` (marker persistence);
  live browser: abort with zero content, after a finished tool step, and
  mid-text; each + 5s idle + reload; retry from stopped chrome; two-tab
  sanity check.
- Commit: `fix(chat): reconcile aborted turns across stream, store, and reload`

### S6a — landmarks and skip link

- Problem: no skip link; `<main>` missing in embedded/participation/
  loading/declined/noLogin states; header is a div (CC-8).
- Do: skip link in `app/layout.tsx` targeting the main content; per-state
  `<main>` following `chat-recovery-card.tsx:20-57`; header → `<header>`;
  declined-page re-consent button primary instead of destructive (P3-c).
- Check: check + test:run; browser: skip-link is first Tab, landmark tree
  per state (normal, embedded, declined, noLogin).
- Commit: `fix(chat): add skip link and complete landmark coverage`

### S6b — motion and semantics

- Problem: `tw-animate-css` has no reduced-motion guard (CC-11); transcript
  viewport not keyboard-scrollable and thread list rows are divs (CC-16).
- Do: one `@media (prefers-reduced-motion: reduce)` block in `globals.css`
  neutralizing `animate-in`/`animate-out` durations and `scroll-behavior`;
  focusable transcript viewport (tabIndex + role/label per practice);
  thread list → `<ol>`/`<li>` parity with the rail.
- Check: check + test:run; browser: reduced-motion emulation on
  tooltip/dialog; keyboard-scroll the transcript.
- Commit: `fix(chat): guard motion and fix scroll/list semantics`

## Verification (package level)

- In-container: `pnpm --filter @klicker-uzh/chat run check`, `run test:run`,
  repo `check:all` before PR.
- Live browser (agent-browser, `testuser1`, EN+DE, 1440×900 + 390×844):
  per-slice checks above plus a final whole-journey pass; screenshots for
  the PR of: consent focus, stopped-turn chrome (live + reload), rail
  labels, skip link, rating failure alert.
- Wiki: update `docs/chat-platform.md` (stopped-turn contract, live region,
  label projection) in this PR.

## Progress

- Status: S2 done (executor implementation, main-session integration after
  executor session limit); S1 done.
- Completed: plan commit `d64ab5b61`; S1 `0a2a18ccd` (6 files, +28/−10;
  in-container chat check + test:run 38 files/318 tests green; live browser
  EN+DE name/footer reads). Slice review: not required — mechanical
  markup/i18n edits; simplifier not armed (not substantive). S2 (8 files;
  in-container biome + chat check + test:run 38 files/319 tests green; live
  browser: run-status live region announced start → "Answer complete." on a
  full cycle and "Answer stopped." 200ms after mid-stream cancel; forced
  `**/feedback` network abort surfaced role=alert "Rating could not be
  saved." with aria-pressed rollback, retry cleared it and persisted the
  vote; thread-list delete arm announced the confirmation status and cleared
  after disarm). Simplifier: armed (substantive) — pending dispatch.
- S2 simplifier: KEEP, no accepted findings (report in
  `project/_local/reviews/2026-08-17-chat-ux-fixes-s2-simplifier.md`). S3
  (executor; 5 files, +137/−14): in-container biome + check + test:run 38
  files/319 tests green; live keyboard walk: disclaimer gate focuses Accept
  on open and hands focus to the composer on accept; cancel-while-focused
  lands on the re-enabled Send, natural completion with focus on Stop and
  an empty composer falls back to the composer input; starter click focuses
  the composer with the caret at the end; citation chip focuses the target
  non-link source card via its new `tabIndex={-1}`.
- S3 simplifier: KEEP, no accepted findings; REVIEW_HANDOFF note (data-cy
  selector coupling for focus targets) carried to final review (report in
  `project/_local/reviews/2026-08-17-chat-ux-fixes-s3-simplifier.md`). S4
  (executor + main integration; 3 files): shared `toHistoryRailPlainText`
  projection for preview/labels; dedup ruling accepted — tick label no
  longer echoes the preview and the dead `preview` field was removed; tick
  contrast raised to `bg-muted-foreground/80` (≈3.3:1), `ring-blue-700` →
  `ring-ring` everywhere; history dialog got `aria-modal` + Tab
  containment (main-session addition — aria-modal without containment is
  an ARIA mismatch) + document-level Escape/outside-pointer dismissal;
  `aria-controls` only references the dialog while it exists; duplicate
  nested nav label dropped. In-container biome + check + test:run 38
  files/328 tests green; live: label read clean (no dedup, no markdown),
  tick color = muted-foreground/80 computed, aria-controls null↔id,
  focus-on-open row, Tab wraps both directions, Escape closes and returns
  focus to the trigger tick.
- Remaining: S5, S6a, S6b, reviews, wiki, PR.
- Evidence: latest verified commit = S4 commit (see git log).
- Delivery: required layer = draft PR on `v3`; achieved = local branch.
- Next: simplifier on S4 range; implement S5 (main-owned).
