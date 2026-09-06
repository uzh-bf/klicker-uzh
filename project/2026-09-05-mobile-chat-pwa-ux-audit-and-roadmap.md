# Mobile Chat and PWA: source findings and provisional polish roadmap

## Outcome and evidence boundary

The highest-value first pass is clearer answer state, larger frequent controls,
and visible navigation state. These changes can preserve the current visual
identity. Chat already contains substantially more mobile and accessibility
polish than the shared quiz controls.

This is a source review, not a completed live UX audit or WCAG conformance
assessment. The default local PWA route returned HTTP 502 and Chat returned
HTTP 404 on 2026-09-05. No application runtime was started, repaired, or stopped.
No application code, data, or remote branches were changed. This document is
uncommitted. Recommendations do not authorize implementation or publication.

## Scope and method

- Source snapshot: origin/v3 at `0c08e083a60bdac6f5130d15f88159d83f9cdfd8`.
  The primary checkout is v3 at `86fc70c77f756827d55ea9d0afc5cac3344630cf`,
  tracking origin/v3, zero ahead and ten behind. Remote differences were
  inspected. Report worktree: `trees/rs/mobile-chat-pwa-ux-audit` on
  `rs/mobile-chat-pwa-ux-audit`, created from the remote snapshot.
- Surfaces: Chat composer, message actions, history, sources and markdown;
  PWA navigation, live quiz, practice progress, feedback; shared answer and
  image controls. Authentication and onboarding were not walked live.
- Lenses: ux-heuristics for usability, refactoring-ui for visual craft,
  accessibility-compliance for semantic and mobile access checks.
- Source mapping used two independent trusted Luna workers after the configured
  explore routes failed before work (400 insufficient credits and 400 upstream
  error). Main session owns verification and prioritization. This is not an
  independent multi-evaluator live study. Severities are provisional.
- Target verification matrix: EN and DE; 390×844 mobile, 320×740 narrow,
  1440×900 desktop; keyboard, touch, zoom, reduced motion. All rendered cells
  remain unverified. No current screenshots or measured contrast/timings exist.

## Delta against prior work

The August 17 Chat accessibility plan is preserved in
`project/2026-08-17-chat-ux-review-fixes-plan.md`; implementation appears in
`e397a0d1bd` (PR #5425). Current source contains the skip link, main target,
run-state announcements, rating pressed state, consent focus handoff, and a
reduced-motion guard. Later conversation polish appears in `f02aa7b27f`
(PR #5500). Current composer controls use 44px touch sizing and a 16px input;
Chat also has safe-area padding and keyboard viewport configuration.
These are source-confirmed improvements, not freshly confirmed live fixes.

Earlier student-PWA accessibility notes already identified answer semantics,
icon names, landmarks and feedback labeling. These are carried forward where
current source still supports them. Historical manage-only axe baseline counts
are not evidence about the current student PWA.

Preserve settled Chat mode/header identity and sources conventions from
`project/2026-08-10-pr-5355-chat-ux-stacked-roadmap.md`. Do not reopen the future
redesign, pricing, enrollment, consent policy, or answer-language contracts.

## Findings register

Severity: 0 none, 1 cosmetic, 2 minor friction, 3 major access/task barrier,
4 catastrophic. All findings below are **code evidence**. Pixel dimensions
are authored default CSS sizes, not measured rendered boxes. Shared design
system dependencies were unavailable locally; do not infer their internals.

### Answering and navigation

| Finding | Impact and mechanism | Small fix and behavioral check |
| --- | --- | --- |
| Answer state is visual only — provisional severity 3 | `packages/shared-components/src/questions/SCAnswerOptions.tsx:57`, `MCAnswerOptions.tsx:57`, `KPAnswerOptions.tsx:65` use state-dependent colors but pass no selected/pressed semantics. `ChoicesQuestion.tsx:49` does not supply a named answer group. A screen-reader user cannot reliably inspect the selected answer. | Retain the existing cards and expose selection with a consistent native or pressed-button contract; associate each group with its question. Add a non-color selection indicator. Check single-choice exclusivity, multi-choice toggling, and true/false state with keyboard and VoiceOver, including submitted read-only state. |
| Grid answers stay two columns on phones — provisional severity 2 | SC/MC answer options at line 45 and KP at line 41 use unconditional `grid-cols-2`. Long German choices and true/false button pairs have much less reading space at 320–390px. Clipping itself is unverified. | Stack on narrow screens; retain the authored grid at a suitable wider breakpoint. Check long text, image choices and formulas at 320/390px in EN/DE; no page-level horizontal scrolling. |
| Frequent quiz targets are compact and lack explicit icon names — provisional severity 2; naming is an accessibility concern | `LiveQuizProgress.tsx:60` has 32px previous/next buttons without labels; true/false controls in `KPAnswerOptions.tsx:65` are 36px and icon-only. This is a mobile usability improvement, not automatically a WCAG target-size failure. | Aim for 44px hit areas, keep small icons, add localized action names and true/false names associated with the statement. Check rendered accessible names, target boxes and accidental adjacent activation. |
| Bottom navigation does not know which page is active — provisional severity 2 | `apps/frontend-pwa/src/components/common/MobileMenuBar.tsx:46` renders the same style for each item and accepts no active value. Layout only supplies the click handler. Students switching Questions, Feedback and Leaderboard lose a persistent location cue. | Pass active state, add an understated selected treatment and appropriate current/selected semantics. Check each live-quiz view by touch and keyboard. Keep existing navigation structure. |
| PWA lacks an authored skip-to-content target in its shared layout — provisional severity 2 | `apps/frontend-pwa/src/components/Layout.tsx:101` renders the scrolling content as a div; the layout has no skip link. | Make the content a named main landmark with a focusable skip target. Verify one main landmark per page and first-Tab skip behavior; avoid nested main elements. |

### Keyboard recovery

| Finding | Impact and mechanism | Small fix and behavioral check |
| --- | --- | --- |
| PWA home and reload actions are not keyboard controls — provisional severity 3 for the affected actions | `apps/frontend-pwa/src/components/common/Header.tsx:94` attaches navigation directly to an image. `apps/frontend-pwa/src/components/liveQuiz/LiveQuizQuestionColumn.tsx:117` attaches reload to a span. Neither call site supplies keyboard semantics or focusability. | Wrap the logo in a home link and render reload as a native button with the same visual styling. Check Tab reaches both, Enter activates the link, and Enter/Space activate the button. |

### Content and secondary controls

| Finding | Impact and mechanism | Small fix and behavioral check |
| --- | --- | --- |
| Markdown image descriptions are discarded — provisional severity 3 for image-dependent tasks | `packages/markdown/src/ImgWithModal.tsx:37` and `:68` hard-code `alt="Image"`, despite receiving the author's alt text. The expand control at `:48` is icon-only. This shared renderer is used by quiz content; Chat's assistant markdown uses a separate renderer. | Preserve the supplied description in both views and label the expand action. Keep decorative images deliberately empty. Check the accessibility tree for an image-dependent synthetic question and keyboard open/close with focus return. |
| Practice progress replaces position with score on mobile — provisional severity 2 | `apps/frontend-pwa/src/components/common/StepProgressWithScoring.tsx:65` hides the question number when a score exists, leaving e.g. repeated `2p` labels. Its reset control at `:91` hides the label on mobile and is 28px high. | Keep a stable question number alongside the score or an explicit current/total summary. Give reset a persistent accessible name and a larger hit area. Inspect reset semantics before deciding whether confirmation is appropriate. Check revisiting several equally scored questions. |
| Feedback field relies on its placeholder — provisional severity 2 | `apps/frontend-pwa/src/components/liveQuiz/FeedbackArea.tsx:261` supplies no label; text is explicitly `text-sm`. After typing, the prompt disappears. The submission state remains for an extra 700ms after the request. | Add a concise visible label, use 16px input text on mobile, and finish the busy state on actual completion if the delay has no rate-control purpose. Test typed text, error retention and keyboard-open layout. Safari zoom behavior remains a device check. |
| Code-copy control is smaller than the other Chat actions and fails silently — provisional severity 2 | `apps/chat/src/components/markdown-text.tsx:75` uses `size-6` (24px); `:98` handles clipboard success but no rejection. Success only swaps an icon, while the accessible name stays unchanged. | Reuse Chat's 44px touch/compact fine-pointer sizing. Announce success and provide a brief recoverable failure message. Check clipboard denial and success, with keyboard and touch. |
| PWA feedback loading has no local error exit — provisional severity 2 | `apps/frontend-pwa/src/components/liveQuiz/FeedbackArea.tsx:70` does not read the query error; `:228` returns Loader whenever feedback data is missing. A failed initial fetch can keep the panel in loading presentation. | Render a localized retry state for failed loading while preserving any existing data. Simulate the initial request failing, retry it, and require the feedback panel to recover. |

### Chat-specific polish

| Finding | Impact and mechanism | Small fix and behavioral check |
| --- | --- | --- |
| Citation jumps explicitly request animation — provisional severity 2 | `apps/chat/src/components/citation-chip.tsx:42` calls scrollIntoView with smooth behavior even though Chat has a CSS reduced-motion guard. Explicit script behavior needs its own preference handling. | Honor reduced motion for citation navigation, preserving focus transfer to the source card. Check immediate positioning with reduced motion and existing smooth behavior otherwise. |
| Thread actions are small and discovery relies on hover/focus — provisional severity 2 | `apps/chat/src/components/thread-list.tsx:417` and `:440` hide inactive-row actions until hover or focus-within. Rename/save/cancel/delete use 24px targets. Selecting a row can reveal them, so this is a discoverability and touch-target concern, not proven inaccessibility. | Expose a consistent touch-accessible action affordance and use Chat's 44px hit-area pattern. Retain the existing delete confirmation. Verify rename/delete on an inactive row without hover and without accidental conversation switching. |
| Declined-consent page uses a different viewport strategy — provisional severity 2, device reproduction required | `apps/chat/src/components/assistant.tsx:389` uses h-screen for the standalone state. This differs from the normal dynamic-viewport shell. | Align its viewport sizing and allow content growth at large text sizes. Check short screens, expanded browser bars and 200% text zoom. The page heading at line 398 can also become h1 without restyling. |

### Additional targeted checks

- Settings label IDs: `apps/chat/src/components/settings-panel.tsx:17` documents
  duplicate IDs while the design-system select is open. Verify the rendered
  trigger/item DOM before changing the label association; retain a unique
  trigger target. A duplicate-ID comment alone is not a current WCAG failure.
- Feedback vote names: `apps/frontend-pwa/src/components/liveQuiz/PublicFeedback.tsx:153`
  uses icon-only controls without caller-supplied action names. Verify the
  design-system output, then add localized names if absent. The active prop
  already carries state, so inspect its actual ARIA behavior before adding
  another state mechanism.

- Chat edit focus: `apps/chat/src/components/thread.tsx:1372` removes the edit
  container focus ring and `:1378` removes the input outline/ring. Compare it
  with the main composer focus treatment; require a visible edit-field focus
  cue when tabbing back into the editor.
- PWA busy feedback: `QuestionArea.tsx:535` passes submitting only through
  canSubmit. `LiveQuizProgress.tsx:95` has no explicit busy presentation. Check
  a slow successful submission and add a submitting label/status without
  marking the answer accepted until the request succeeds.
- PWA motion: `QuestionArea.tsx:514` renders a confetti animation; its call site
  has no reduced-motion condition, and PWA globals lack Chat's reduced-motion
  guard. Check the dependency's behavior before declaring a violation; respect
  reduced motion without losing the success signal.

## Strengths to preserve

Chat already has responsive touch sizing for primary actions, constrained reading
width, mobile-aware composer text size, safe-area padding, source previews,
scroll-to-bottom control, run announcements, keyboard skip navigation and reduced
motion CSS. Its markdown tables and code blocks already contain their own
horizontal overflow. PWA offers full answer-card click areas, readable base text,
a persistent mobile menu and sticky live-quiz controls. Improve these existing
patterns rather than adding a new navigation system or visual theme.

## Scores and accessibility status

No numeric usability or visual score is assigned. The heuristic and visual
rubrics require rendered evidence for hierarchy, spacing, contrast and flow;
scoring an unavailable application would manufacture precision. No current
WCAG pass/fail verdict is made. Source findings identify likely failures and
verification targets, not conformance certification.

For target sizing distinguish comfortable 44px controls from WCAG 2.2 AA's
24px minimum with exceptions, including spacing:
[W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
Test reflow at a 320 CSS pixel width using the applicable content exceptions:
[W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
Announce meaningful async outcomes without moving focus:
[W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## Provisional roadmap

### First: clearer answers and mobile controls

Approximately 2–3 engineering days if a synthetic stack and existing component
checks are available. Resolve answer semantics, keyboard home/reload actions, icon names, mobile target sizes,
responsive answer grids, image alt propagation and current mobile navigation.
Keep each cohesive change reviewable; shared question controls need a bounded
consumer check in addition to the PWA check. Acceptance is the behavioral check
in each register row, with EN/DE screenshots and keyboard/AT evidence.

### Next: progress, feedback and Chat details

Approximately 1–2 days under the same conditions. Preserve question position in
practice progress, label feedback input, implement loading error recovery, and
align Chat code-copy and thread-action sizing with the rest of its controls.
Honor reduced motion in citation jumps and verify the declined-consent viewport. Add the PWA skip
link. Prefer targeted edits over changing shared design-system internals.

### Live verification before broader polish

Approximately half a day for a first pass once a known-good synthetic runtime
is supplied; remediation time depends on what reproduces. Walk Chat entry,
consent, first message, streaming, stop, retry, history, settings, citations,
attachments and editing. Walk PWA course entry, live answers, practice, feedback,
bookmarks and return navigation. Test empty/loading/error states and EN/DE at
390×844 and 1440×900, plus 320px reflow. Record unreachable states explicitly.

On a real iPhone and Android device check keyboard opening/closing, composer
visibility, viewport jumps, rotation, standalone PWA safe-area clearance, back
navigation and long-answer scrolling. Inspect focus visibility, 200% text zoom,
reduced motion and screen-reader announcements. Do not infer performance or
smoothness from source. Measure before proposing animation or rendering work.

## Implementer notes

Use the repository's devrouter and host-side agent-browser/Playwright guidance.
Start only the required apps with synthetic data; do not inject or copy real
credentials. The static semantic and sizing changes need no model calls; live
Chat verification uses intercepted synthetic streams without upstream model
calls. Chat locale checks use the NEXT_LOCALE cookie; PWA checks use explicit
locale routes. Keep screenshots local and uncommitted.

The embedded-mode stale-selection hypothesis was not promoted to a finding:
the store revalidates mode selection when loading options. A mismatch between
two picker implementations alone does not prove a reachable user problem.

This register records the initial source audit, before a working synthetic
runtime was available. Environment errors were not counted as product findings.
The approved implementation and subsequent browser receipts are recorded in the
[execution plan](2026-09-05-mobile-chat-pwa-polish-plan.md#progress). Physical
device and spoken assistive-technology acceptance remain separate from browser
emulation; no conformance certification or measured performance claim is made.
