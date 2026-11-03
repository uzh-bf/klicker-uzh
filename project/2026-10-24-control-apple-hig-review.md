# Control app: Apple Human Interface Guidelines review

Review date: 2026-10-24. Status: complete assessment; implementation not started.

## Scope and method

This is an assessment of the current lecturer Control app against Apple's
applicable iOS and iPadOS Human Interface Guidelines (HIG). It identifies
improvements; implementation and publication are separate decisions.

The surfaces covered are:

1. Native launch, sign-in, session restoration, and account/support entry points.
2. Home, course selection, quiz lists, and navigation to a running quiz.
3. Session controls, live evaluation, projection settings, and end confirmations.
4. Q&A, statistics, audience-feedback summary, and feedback details.
5. Loading, empty, unavailable, and error states; English and German;
   phone/tablet layouts, short landscape windows, larger text, appearance,
   motion preferences, keyboard access, and accessibility semantics.

Source snapshot: branch `enhance/control-native-login`, commit
`64063dc65caa6106b6a7e47f2739f1ea4a35483d`. The branch has no upstream;
the fetched default `origin/v3` is 78 commits ahead and 590 behind this task
branch. This records the snapshot, not a recommendation to integrate branches.
Existing uncommitted package scripts and owner-selected Xcode signing settings
are excluded from the assessment and preserved.

The review uses `design-with-apple-hig` as its primary Apple-platform evidence
and review method, with UX review, UX heuristics, Refactoring UI, and accessibility
as bounded specialist lenses. Execution mode remains standard. The main evaluator owns official HIG
research, live interaction, captures, and synthesis. A separate trusted native
agent inspects the bounded accessibility source; findings are checked against
runtime evidence before inclusion. Severity ratings are provisional judgments,
not an accessibility certification or an App Review decision.

Fresh browser evidence uses agent-browser 0.37.1, Chromium on macOS, the existing
task runtime, and a dedicated local seeded lecturer session. Native appearance
checks use the existing iPhone task Simulator; its preferences are restored.
The earlier physical iPad smoke test was user-confirmed, rather than observed
as part of this detailed review. Safari/VoiceOver and physical iPad windowing
need their own acceptance evidence.

Task classification: **audit**. The product is a cross-platform React/Next.js
interface bundled by Capacitor 8.5.2 in an iOS/iPadOS WKWebView, with Swift native
authentication integration. The declared deployment target is iOS 15.0; the
current toolchain is Xcode 27.0 with iPhoneOS SDK 27.0. Native rendering was
examined in the existing iOS 27 task Simulator. Older supported OS versions,
physical VoiceOver, and iPad windowing were not qualified. Shared Chromium
rendering is corroborating web evidence, not a native HIG-alignment result.

The user explicitly added `design-with-apple-hig` during consolidation. Its pass
adds the platform contract, claim labels, guidance strength, classification, and
per-finding verification below. Broad third-party numerical ratings are not
used as Apple readiness scores.

Screenshots, source excerpts, DOM measurements, and the official-source
inventory are local and ignored under `project/_local/reviews/control-hig/`.
Simulator captures are in `/private/tmp/control-hig-native-*.png`. No screenshots,
device identifiers, private endpoint names, credentials, or account data belong
in this report or in public history.

## Prior decisions

The existing [mobile release plan](2026-10-23-control-mobile-release-plan.md),
[store roadmap](2026-10-23-control-mobile-store-roadmap.md),
[Control improvements](2026-10-23-control-stack-review-fixes.md), and
[native session contract](../docs/adr/0056-control-native-session-contract.md)
remain authoritative. This review does not replace them.

- Retain Capacitor with a bundled UI and the existing lecturer workflows.
- Retain native system-browser authentication and device-only secure storage.
- Retain the agreed audience-feedback location and ten-minute response window.
- Retain removal of embedding-link creation from Control.
- Preserve uncertain-command recovery and the absence of blind mutation retries.

## Platform design contract

This contract describes the intended experience used to evaluate the current
artifact. It does not authorize changes to the product or implementation.

| Dimension | Contract |
| --- | --- |
| Purpose | Let a lecturer operate an existing live quiz safely while attending to the classroom. |
| Hierarchy | Home → course/quiz → related Control, Q&A and Statistics views, with audience feedback in the agreed location. |
| Navigation | Familiar back/cancel behavior, clear selection, and preserved work context where useful. No universal tab-bar or sidebar mandate. |
| Actions | One prominent current quiz action; secondary evaluation/projection settings; deliberate confirmation for ending a quiz. |
| Input | Comfortable touch targets plus complete keyboard/focus semantics, with pointer and assistive-technology acceptance on the Apple host. |
| Density and adaptation | Glanceable values, useful identifiers, readable compact views and an effective regular-width layout. Existing breakpoints are product choices, not Apple rules. |
| Appearance | Legible semantic colors across system appearance and contrast preferences. Materials are subordinate to clarity and performance. |
| Accessibility | Correct names, roles, values, language and focus; real text scaling and accessible chart detail; retain existing framework announcements. |
| Motion | Purposeful, brief feedback; respect Reduced Motion and keep status available without animation or haptics. |
| Privacy | Preserve the native session contract and account isolation. Any new retained navigation data needs an explicit design decision. |
| Localization | Complete EN/DE flows, including authentication, fallback and assistive labels. Adding RTL locales is outside the current product scope. |
| Recovery | Cancellation is safe; offline and unconfirmed states remain honest; command authority is refreshed before another command can run. |

Apple's [native font-scaling documentation](https://developer.apple.com/documentation/uikit/scaling-fonts-automatically)
explains the platform's Dynamic Type behavior. UIKit font APIs do not themselves
prove text scaling in this DOM-based interface: the chosen WebView strategy
still needs a runnable native check. No particular bridge or new dependency is
selected by this audit.

## Findings and recommendations

The current visual direction is sound. Keep the focused lecturer workflow,
brand palette, course cards, prominent primary action, and compact feedback
summary. The main work is accessibility, honest status communication, native
packaging, and interaction consistency. A SwiftUI rewrite is not a prerequisite
for addressing these findings.

The review screened Apple's six HIG section indexes and 70 linked topic pages.
The relevant recommendations were compared with source, live browser behavior,
and selected native Simulator behavior. Platform-specific guidance for other
Apple platforms was excluded. HIG recommendations are design guidance, not a
guarantee of App Store acceptance.

The primary severity scheme is **Critical**, **Major**, **Moderate**, and
**Minor**, following `design-with-apple-hig`. Critical means a demonstrated core
task/access failure or credible data/privacy/safety harm; Major means an important
state or major path is substantially weakened; Moderate means material
readability, input, feedback or consistency friction; Minor means low-impact
polish. No Critical finding was demonstrated. A source-only candidate is marked
`(code)`; it does not imply an observed physical-device or VoiceOver failure.
Confirmed issues, contextual candidates, optional opportunities and rejected
claims are separated in the evidence ledger.

### Major findings

| ID | Finding and recommended direction | Evidence |
| --- | --- | --- |
| F02 | **System text enlargement does not enlarge the app.** On the task iPhone Simulator, changing from the recorded `large` category to `accessibility-extra-extra-extra-large` leaves the already displayed authenticated home visually unchanged. A subsequent app relaunch returned to sign-in; its normal/largest captures also show unchanged text. Thus the relaunch check covers sign-in, not authenticated screens. The Simulator and current export use identical stylesheet bytes. Fixed root sizing and explicit pixel typography support the wider implementation concern. Support a verified text-scaling strategy for the WebView and custom font, scale meaningful icons, and let content reflow. | Native live-setting and cold-launch captures, `native-accessibility-settings.json`, `native-css-identity.json`; `apps/frontend-control/src/globals.css:249`, `apps/frontend-control/src/components/session/StatsPanel.tsx:46`. [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout). |
| F03 | **Several controls have no accessible purpose.** The real accessibility tree exposes unnamed audience-feedback and projection switches. The language selector is an unnamed combobox displaying an abbreviation. Passing `label` to the installed design-system Switch draws adjacent text without associating it with the Radix control. Give every control a stable programmatic label; make the associated label part of a comfortable target. Inspect the existing component API before choosing a call-site or upstream fix. Q&A's explicitly associated switch label already works. | Shots 03, 24, 39; `audience-dialog-dom.json`, `session-phone-dom.json`; `apps/frontend-control/src/components/session/AudienceFeedback.tsx:401`, `apps/frontend-control/src/components/session/LeinwandCard.tsx:174`, `apps/frontend-control/src/components/layout/HomeHeader.tsx:33`. Installed `@uzh-bf/design-system` 4.1.8 `src/Switch.tsx`. [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles). |
| F08 | **The projection panel can claim “synced” while the controller is offline.** In an isolated browser network-loss check, the close-block action correctly becomes disabled and audience feedback correctly reports stale data, but the projection badge remains green and says synced. Its text depends on mutation loading, not on retrieval success or evidence that the projector received a setting. Separate saving, saved-to-server, unavailable, and unconfirmed states. Describe only the acknowledgement the system can actually prove. Preserve the existing refresh-before-command recovery. | Shot 43, `offline-status.json`; `apps/frontend-control/src/components/session/LeinwandCard.tsx:130`, session recovery at `apps/frontend-control/src/pages/session/[id].tsx:172`. [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing). |

### Moderate findings and contextual candidates

The confirmed findings in this group have Moderate severity. Source-based
contextual candidates retain a provisional Moderate priority pending the
specific checks in the ledger. They are not presented as verified device defects.

| ID | Finding and recommended direction | Evidence |
| --- | --- | --- |
| F01 | **Touch areas are too small in several frequent controls.** Back, question selectors, several actions, and session tabs render at 36 CSS pixels high; the built-in sheet close button is 16 by 16. With the app's initial-scale viewport these are below Apple's recommended 44-point hit region. Enlarge the interactive area without necessarily enlarging the glyph, retain spacing between destructive and safe actions, and preserve the existing 48px primary/footer actions. This HIG recommendation is distinct from WCAG's target-size criteria and exceptions. | Shots 02, 08, 15; `session-phone-dom.json`, `end-dialog-controls.json`; `apps/frontend-control/src/components/common/styles.ts:11`, `SessionTabs.tsx:37`, `LiveEvaluationCard.tsx:264`; installed design-system `src/ui/sheet.tsx`. [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices). |
| F04 | **Tabs announce a pattern they do not implement.** Session tabs expose tab roles, but ArrowRight leaves selection and focus unchanged, all tabs remain separate Tab stops, and no tab-to-panel relationship exists. Q&A filter tabs have the same source pattern. Implement a complete tab interaction model, including a single roving Tab stop, arrow-key focus, an appropriate automatic or manual activation model, selected state, and panel association. Keep the current three related session views; an unrelated global bottom navigation bar is unnecessary. | `keyboard-tabs.json`; `apps/frontend-control/src/components/session/SessionTabs.tsx:22`, `QAPanel.tsx:472`. [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards), [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection), [W3C APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). |
| F05 | **Keyboard focus is lost when a sheet closes.** Open feedback with the keyboard, press Escape, and focus ends on the document body instead of the opening summary button. These sheets use controlled state without a connected SheetTrigger, so the library cannot reliably identify the opener. Explicitly restore focus to the initiating control or use the library's trigger mechanism. Preserve focus containment and safe cancellation, which already work. | `dialog-focus-return.json`; `apps/frontend-control/src/components/common/ResponsiveSheet.tsx:22`, `AudienceFeedback.tsx:219`. [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection), [Modality](https://developer.apple.com/design/human-interface-guidelines/modality). |
| F06 | **The bundled document omits its language.** The actual exported root HTML has no `lang`, and the native locale change updates React context without updating the document. Declare the language and keep it synchronized with EN/DE. This finding applies to the native export: the hosted English page already has `lang=en`, and Next's route announcer exists. Do not remove or duplicate the framework announcer based on this finding. | `native-html-and-css.json`; `apps/frontend-control/src/pages/_document.tsx:5`, `_app.tsx:99`. [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion). |
| F07 | **Failures often give the user no useful recovery choice.** `(code)` Native sign-in cancellation falls through to a generic action-failed message; command failures elsewhere use a short-lived generic toast. Network and identity failures are also conflated in the layout guard. Distinguish cancellation, unavailable connectivity, expired authentication, and an unconfirmed command. Keep important failures near the affected action until resolved, with a specific safe next step. For uncertain commands, refresh state before enabling another command; do not encourage immediate blind resubmission or expose internal authentication errors. | `apps/frontend-control/src/pages/login.tsx:69`, `components/Layout.tsx:31`, `components/session/QAPanel.tsx:63`, `LeinwandCard.tsx:111`; existing session recovery is a strength. [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). |
| F09 | **Normal-size destructive labels have insufficient contrast.** White 16px labels on the brand orange-red `#dc6027` measure 3.655:1, below the 4.5:1 normal-text reference. The same color is used for small status/error text on white. Introduce an accessible semantic destructive/error color while retaining the UZH brand color where contrast permits. Check resting, focused, pressed, disabled, dark, and increased-contrast appearances without treating the disabled-control exception as a normal-label exception. | Shots 07–08; `contrast.json`; `apps/frontend-control/src/components/common/styles.ts:17`, `globals.css:38`, `AudienceFeedback.tsx:332`. [Color](https://developer.apple.com/design/human-interface-guidelines/color), [WCAG 2.2 §1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum). |
| F10 | **Dark appearance is ignored.** The native appearance check and browser dark-media check leave cards and content white. The app uses fixed white surfaces and custom color tokens without an appearance strategy. Add semantic surface/text/border colors that follow the system, and verify increased contrast too. Do not add a second app-specific appearance preference merely to recreate the system setting. | Native dark capture, shot 45 and `appearance-motion-reflow.json`; `apps/frontend-control/src/components/common/styles.ts:5`, `globals.css:224`, `_app.tsx:89`. [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Color](https://developer.apple.com/design/human-interface-guidelines/color). |
| F11 | **Reduce Motion does not stop decorative motion.** With the reduced-motion media preference active, the live dot still runs a 1.6-second infinite animation. Route entry and chart transitions also lack a preference override in source. Make the live indicator static, remove unnecessary route movement, and reduce chart/sheet transitions while retaining clear nonanimated status. Do not replace every useful loading indication with silence. | Shot 44; `appearance-motion-reflow.json`; `apps/frontend-control/src/globals.css:196`, `components/common/LiveDot.tsx:8`, `LiveEvaluationCard.tsx:47`. [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). |
| F12 | **Native identity and launch assets are still placeholders.** The actual app icon and launch artwork contain the Capacitor template mark. Replace the icon with a recognizable KlickerUZH Control asset and check its small, dark, and tinted appearances. Make the launch surface visually continuous with the first real screen; avoid introducing a branded loading interstitial or mandatory delay. Layered icon treatment can be a later polish decision, rather than a reason to delay replacing the placeholder. | Visually inspected `native/control/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` and `Splash.imageset/splash-2732x2732.png`; manifest anchors `AppIcon.appiconset/Contents.json:4`, launch storyboard `Base.lproj/LaunchScreen.storyboard:16`. [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons), [Launching](https://developer.apple.com/design/human-interface-guidelines/launching), [Branding](https://developer.apple.com/design/human-interface-guidelines/branding). |
| F13 | **The phone sheet advertises a drag interaction it does not implement.** `(code)` Its decorative grabber has no resize or dismiss interaction, while the component is a Radix dialog rather than a native draggable sheet. Either support the indicated interaction accessibly or remove the misleading affordance. Keep a clear close/cancel button and the working keyboard/backdrop dismissal. A native presentation change is a separate design choice, not required just to remove the false affordance. | Shots 03, 11, 18; `apps/frontend-control/src/components/common/ResponsiveSheet.tsx:31`. [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures). |
| F14 | **Essential identifiers are truncated before they can distinguish items.** In native home evidence, long running-quiz titles collapse to the same visible prefix; ordinary course/quiz rows also force one line. Allow useful wrapping, put distinguishing information early, and expose the complete title in a reachable view. Continue constraining content width; do not solve truncation by shrinking the text. | Native normal capture; `apps/frontend-control/src/components/liveQuizzes/RunningQuizBanner.tsx:126`, `components/common/ListRow.tsx:41`, `components/layout/AppBar.tsx:35`. [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables). |
| F16 | **Authentication restoration is implemented, but detailed work context is not.** `(code)` The selected session tab/question is component state, and a fresh native entry defaults to home. Background/reopen login success does not prove cold-launch restoration of a quiz, tab, or scroll position. Consider restoring the last safe work context after checking identity and current quiz state. Scope any persisted context to the account and clear it on logout. Never persist or replay a pending quiz command. Confirm the behavior on device before choosing how much navigation state to retain. | `apps/frontend-control/src/pages/session/[id].tsx:52`, `_app.tsx:73`, `lib/nativeSession.ts:104`. [Launching](https://developer.apple.com/design/human-interface-guidelines/launching), [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles). |
| F17 | **Loading and page structure provide weak assistive-technology orientation.** `(code)` The shared Loader contains only a spinner, and redesigned layouts have no main landmark. Provide an accessible loading status and appropriate busy state, plus a main content target. Reuse Next's existing route announcements and avoid announcing every polling tick. Verify route focus in a real screen reader before adding focus moves, which can themselves be disruptive. | `session-phone-dom.json`; `packages/shared-components/src/Loader.tsx:12`, `apps/frontend-control/src/components/Layout.tsx:49`. [Loading](https://developer.apple.com/design/human-interface-guidelines/loading), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection). |
| F18 | **Populated chart data needs an explicitly structured accessible alternative.** `(code)` The numeric histogram renders its counts separately from range labels, without a programmatic association. Text answers and choice labels can also be visually truncated. Keep the compact overview, but expose bin/count pairs and full response labels through accessible structure or an on-demand table/detail view. The projector's Table setting is not a substitute for a local accessible data view. Existing textual statistics and audience meter semantics should be preserved. | `apps/frontend-control/src/components/session/LiveEvaluationCard.tsx:84`, `:112`, `:130`. Populated data was not fabricated during this read-only review. [Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data), [Charts](https://developer.apple.com/design/human-interface-guidelines/charts). |
| F19 | **Fallback and authentication surfaces have inconsistent language and product context.** The English hosted 404 shows German copy, refers to the question pool, and exposes untranslated navigation keys. The same fallback component is part of the native screen dispatcher, though the hosted missing-message symptom must not be assumed for the bundle. The native completion page is English-only, and the built-in sheet close name remains English in German screens. Localize these surfaces and use the current Control navigation/error patterns. | Shot 48 and native HTML source; `apps/frontend-control/src/pages/404.tsx:9`, `pages/_app.tsx:80`, `apps/auth/src/pages/native/complete.tsx:27`, `components/common/ResponsiveSheet.tsx:23`. [Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover). |

### Optional product opportunity

**F15 — Account and Help destination: contextual opportunity, not a verified
defect or HIG-mandated screen.** The redesigned header offers language and logout.
A compact place for account identity, relevant help, privacy information and app
version may reduce support friction, but this audit did not demonstrate a failed
lecturer task caused by its absence. Validate the need and reuse existing data
and approved destinations before adding a screen. Identity-provider account
management and deletion remain separate product decisions.

Evidence: shots 01/13/31 and `apps/frontend-control/src/components/layout/HomeHeader.tsx:22`.
Sources: [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts),
[Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help),
[Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy).
These pages inform the opportunity; they do not require this particular layout.

## Evidence classification and per-finding verification

All linked Apple and W3C pages were retrieved on **2026-10-24**. Each finding's
Source links identify the primary page; the table below records the relevant
section and wording strength. The private source inventory retains the individual
URLs. `APPLE-HIG` means design guidance; `APPLE-SDK` means framework behavior;
`ACCESSIBILITY` means a named standard, authoring pattern, or configured test;
`OBSERVATION` means reproduced artifact behavior; `AUDIT` means source/tool
evidence; `HEURISTIC` means a contextual judgment. APG is authoring guidance,
not itself a WCAG conformance certificate.

| ID | Classification and evidence labels | Source scope/strength and Verify |
| --- | --- | --- |
| F01 | Confirmed rendered targets; Moderate. `OBSERVATION`, `APPLE-HIG`. | Buttons, general hit-region recommendation for touch on iOS/iPadOS: **as a general rule**, 44×44pt. Verify actual native hit regions and spacing, not glyph size alone. [WCAG §2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) has a different web criterion and exceptions. |
| F02 | Confirmed Simulator preference/rendering gap with source support; Major. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | Typography, custom fonts and Dynamic Type: support accessible scaling and adaptation. Verify an authenticated native screen and sign-in after live preference change and relaunch, with default/maximum size and reachable actions. Cold-launch authenticated content remains a follow-up. |
| F03 | Confirmed unnamed controls in Chromium's accessibility tree; Major. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | VoiceOver descriptions and Toggles setting identification. Verify meaningful localized names/states with actual VoiceOver and keyboard activation; retain Q&A's working label association. Do not equate the Chromium tree with a spoken-output test. |
| F04 | Confirmed keyboard/tab structure gap; Moderate. `OBSERVATION`, `ACCESSIBILITY`, `APPLE-HIG`. | W3C APG tab roles/keyboard pattern, plus Apple keyboard/focus guidance. Verify a single tab-entry stop, arrow-key focus, appropriate manual/automatic activation, panel relationship, and readable selected state. |
| F05 | Confirmed DOM focus loss after Escape; Moderate. `OBSERVATION`, `ACCESSIBILITY`, `APPLE-HIG`. | [APG modal-dialog focus return](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and Apple focus/modality guidance. Verify focus returns to the opener after Cancel, close, Escape and supported dismiss gestures; qualify VoiceOver focus separately. |
| F06 | Confirmed native export attribute/source gap; Moderate. `OBSERVATION`, `AUDIT`, `ACCESSIBILITY`. | [WCAG §3.1.1](https://www.w3.org/TR/WCAG22/#language-of-page), plus VoiceOver/inclusion guidance. Verify the live bundled document language tracks EN/DE, and verify actual speech pronunciation. Hosted English metadata already works. |
| F07 | Contextual source-based recovery candidate; provisional Moderate. `AUDIT`, `APPLE-HIG`, `HEURISTIC`. | Feedback/writing ask for useful, appropriately placed recovery information. Verify actual cancellation, expired login, network failure and uncertain-command flows; do not infer every failure outcome from the catch branch alone. |
| F08 | Confirmed contradictory offline presentation; Major. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | Feedback's status-in-context guidance. Verify offline state never overstates current certainty; distinguish server persistence from projector acknowledgement. Keep commands blocked until authoritative refresh, which currently works. |
| F09 | Confirmed color-pair/normal-text contrast gap; Moderate. `OBSERVATION`, `ACCESSIBILITY`, `APPLE-HIG`. | WCAG §1.4.3 normal text is 4.5:1, with stated exceptions; the measured enabled labels are 16px. Verify actual computed foreground/background colors and all relevant appearances. |
| F10 | Confirmed preference/appearance observation; Moderate. `OBSERVATION`, `APPLE-HIG`. | Dark Mode best practices expect system-aware appearance; this is not an App Review rejection prediction. Verify light/dark plus Increase Contrast and readable native chrome. |
| F11 | Confirmed browser preference/animation gap, native behavior still to qualify; Moderate. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | Motion and Accessibility: make custom motion optional and respond to Reduce Motion. Verify native settings suppress decorative live/route motion while nonanimated status and useful loading feedback remain. |
| F12 | Confirmed template artwork in native assets; Moderate. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | App icons/branding identify the app; Launching recommends continuity with the first screen. Verify installed small/light/dark/tinted icon appearance and actual launch transition. No copied Apple resource or font license is granted by this recommendation. |
| F13 | Contextual source-backed affordance candidate; provisional Moderate. `AUDIT`, `APPLE-HIG`, `HEURISTIC`. | Sheets recommends a grabber for resizable sheets and supports familiar vertical dismissal. Verify actual iPhone drag/dismiss behavior. If the sheet stays nonresizable, remove the false resize cue rather than adding a feature solely to match a screenshot. |
| F14 | Confirmed visible truncation; Moderate. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | Typography recommends minimizing useful-label truncation, especially at larger text sizes. Verify similar long names remain distinguishable in compact/regular layouts and full names are reachable. |
| F15 | Optional opportunity; unscored. `AUDIT`, `HEURISTIC`, informed by `APPLE-HIG`. | Accounts/help/privacy principles do not mandate an Account and Help screen. Validate a support/account-orientation need and approved destinations before implementing a particular layout. |
| F16 | Contextual source-based continuity candidate; provisional Moderate. `AUDIT`, `APPLE-HIG`, `HEURISTIC`. | Launching recommends useful previous-state restoration; retention detail is a product/privacy choice. Verify actual cold launch, account change, revoked access and logout before retaining context. Never replay commands. |
| F17 | Confirmed source/DOM structure gaps, spoken outcome unverified; Moderate. `AUDIT`, `OBSERVATION`, `APPLE-HIG`, `ACCESSIBILITY`. | Loading/VoiceOver guidance informs accessible status and landmarks. Verify slow initial load, route orientation and busy state using real assistive technology; preserve Next's existing announcer and avoid polling chatter. |
| F18 | Contextual code-detectable chart candidate; provisional Moderate. `AUDIT`, `APPLE-HIG`, `HEURISTIC`. | Charts/Charting data guidance calls for accessible descriptions and understandable values. Verify populated numeric bins/counts and full labels with VoiceOver or a local structured alternative. Current text values must not be described as entirely inaccessible without that test. |
| F19 | Confirmed hosted fallback inconsistency plus source-based native/auth candidates; Moderate. `OBSERVATION`, `AUDIT`, `APPLE-HIG`. | Writing/inclusion guidance favors consistent understandable language. Verify actual EN/DE native fallback, authentication completion and close-button names; do not transfer the hosted missing-message symptom to the bundle. |

Rejected or narrowed claims: the hosted document is not missing its language;
Next's route announcer exists; the apparent clipped tablet/landscape dialog was
an animation capture, not a settled layout defect; custom branding/fonts/icons
do not automatically violate the HIG. Native edge-swipe, physical VoiceOver,
populated Q&A and detailed windowing remain unverified, rather than invented
defects. Optional presentation recommendations are not mandatory App Review rules.

## Strengths to preserve

- The main action is prominent and reachable: phones use a fixed bottom action
  and larger windows use a separate control column. Primary actions are already
  48px high. Relevant success, active, and scheduled states also have text.
- The audience summary is available across session views, distinguishes empty
  feedback from neutral feedback, explains its time window, and has accessible
  meter/status semantics. Its existing stale-data wording is a useful model.
- Responsive sheets adapt from phone bottoms to centered wide-window dialogs.
  Settled geometry is correct. Cancel, Escape, backdrop dismissal, and focus
  containment provide useful foundations; focus return needs F05.
- The app preserves the UZH visual language with restrained cards, consistent
  alignment, bounded content width, and readable primary values. Custom branding
  can coexist with familiar Apple behavior.
- Real native authentication and device-only credential storage work. System
  login, restored authentication, uncertain-command blocking, and successful
  command recovery should survive all visual changes.

## Priority and implementation sequence

These are review recommendations, not an approved implementation batch. Estimate
ranges assume reuse of current components and available physical-device access;
they are conditional engineering estimates, not commitments. Avoid a separate
PR for every finding. The existing stack/publication constraints still apply.

### First: remove accessibility and status hazards

Allow roughly 2–4 engineering days, with text-scaling integration as the largest
uncertainty. Sequence the following as one coherent accessibility/status package
or explicitly approved slices within it:

1. **F02, F01:** prove a native text-scale strategy, then enlarge hit areas and
   let layouts/identifiers grow. **Check:** maximum iOS Larger Text actually
   enlarges body text; all critical actions remain reachable at phone and narrow
   iPad widths; interactive hit regions meet the chosen 44-point target.
2. **F03, F04, F05, F06, F17:** fix labels, tab relationships/keys, focus return,
   native document language, and loading/main semantics through existing seams.
   **Check:** VoiceOver announces purpose/state in EN/DE; keyboard arrows navigate
   tabs with the chosen activation model; Escape returns to the opener; initial
   loading is understandable.
3. **F08, F07:** make connection, persistence, and command certainty explicit.
   **Check:** isolated offline mode never claims projector sync; cancellation
   is quiet; reconnection refreshes authority before commands become available.
4. **F09, F11:** use accessible semantic error colors and honor Reduce Motion.
   **Check:** relevant normal-size labels meet 4.5:1, and the live pulse/route
   motion stops under the system preference while status remains clear.

### Next: make the release feel complete

Allow roughly 1–2 engineering days plus approval of icon direction. **F12 and
F19** form a coherent release-polish package: replace template assets, match the
launch surface, and finish EN/DE fallback/authentication language. **Check:** the
installed icon identifies Control; launch has no placeholder flash; the actual
localized fallback and authentication paths remain understandable.

### Then: improve preference adaptation and continuity

Allow roughly 2–4 engineering days, conditional on decisions about retained
navigation context and local chart detail. Address **F10, F13, F14, F16, F18**:
system appearance, honest sheet affordances, useful titles, safe work-context
restoration, and accessible chart detail. **Check:** light/dark and increased
contrast remain legible; a displayed grabber actually works or is absent;
similar long titles are distinguishable; cold-launch restores only validated
navigation state; chart values can be understood without visual bar geometry.

### Optional refinements after those checks

- Validate **F15**, the Account and Help opportunity, against lecturer/support
  needs and existing policy destinations before adding a screen.
- Consider subtle **iPhone haptics** for server-confirmed start/close/end
  outcomes. Keep all feedback usable without haptics; check hardware support
  and preferences. Do not trigger feedback for an unconfirmed command or every
  poll. [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics).
- Consider discoverable **hardware-keyboard shortcuts** for frequent safe
  navigation. Settle focus/Tab/arrow behavior first, and avoid accidental
  irreversible quiz commands. [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards).
- If lecturers often move between several quizzes, consider an **iPad regular-
  width navigation pane** with persistent selection. The current two-column
  session view already uses space well; a sidebar is an opportunity, not a
  release requirement. [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views).
- Evaluate **materials and native presentation** only where they improve the
  distinction between controls and content. Do not spread translucent effects
  over charts/cards or replace the design solely to imitate a system style.
  [Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
  [Branding](https://developer.apple.com/design/human-interface-guidelines/branding).

## Evidence coverage and remaining qualification

The main success/empty surfaces were captured in EN/DE at 390×844 and 768×1024;
English and German also have 1280×900 desktop captures. The six German desktop
captures were a separate continuation and are explicitly marked as such in the
inventory; horizontal overflow was not separately measured for those six.
The main matrix contains
home, course list, session control, Q&A disabled, statistics, and audience
details. Additional checks cover start/end confirmations, a 320px phone, short
landscape, network loss/recovery, keyboard tabs/focus, and native preferences.

| Boundary | Evidence and limitation | Follow-up acceptance |
| --- | --- | --- |
| Shared screen rendering | Real Chromium captures and DOM measurement; native home/appearance captures supplement them. No horizontal overflow was found in the 30 geometry-probed core cells; the six additional German desktop captures were not independently geometry-probed. | Repeat changed interactions in the actual iOS WebView; Chromium is not an iPadOS conformance result. |
| Start/end sheets | Opened and cancelled; no quiz was started, closed, or ended for this review. | Test confirmed outcomes only in a disposable synthetic journey when implementing related changes. |
| Audience feedback | Empty, open details, setting label, stale status, and responsive layout inspected. No submissions or settings changes were created. | Exercise populated meters and all unavailable/loading cases with owned synthetic data. |
| Q&A | Disabled state captured; source covers enabled filters, composer, and delete behavior. Existing active quiz settings were preserved. | Qualify populated moderation, answer draft preservation, keyboard focus after cancel/send, software-keyboard visibility, and delete cancellation. |
| Charts/statistics | Empty/current statistics captured; chart implementations inspected. | Qualify populated choice/numeric/text values, long labels, large counts, and VoiceOver data relationships. |
| Loading/error | Real session network loss/recovery, actual 404, and loader/error source checked. Fast initial loads were not artificially slowed. | Exercise slow initial load, session expiry, invalid credentials, cancelled system login, and unconfirmed commands without replay. |
| Text and appearance | Simulator `large` changed to `accessibility-extra-extra-extra-large` and restored; dark appearance tested and restored. Live-setting captures cover the displayed home; relaunch comparison covers sign-in. Stylesheet identity matches the current export. Browser media preferences tested. | Repeat F02/F09/F10/F11 on authenticated native screens and the physical iPad with Larger Text, Bold Text, Increase Contrast, Reduce Motion, and VoiceOver. |
| Reflow stress | A temporary 32px root-font override tested layout tolerance; it is not native Dynamic Type support. | Verify actual system scaling after implementation, including two-column collapse when content needs more width. |
| Gestures/windows | Short-landscape dialog geometry fits after animation settles. Native edge-swipe and physical iPad window resizing were not driven. | Qualify back-swipe, sheet dismissal, narrow windows, rotation, external keyboard/trackpad, and software keyboard on device. |
| State/privacy | Existing auth restoration is user-confirmed; detailed cold-launch state retention is a code finding. | Agree retained navigation data and account isolation before implementing F16; verify lock/app-switcher privacy as part of native qualification. |

## HIG applicability map

This records the sections screened and the decisions they inform. It does not
turn every Apple technology into a requested feature.

| HIG area | Application to Control |
| --- | --- |
| [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios), [iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados) | Focused, glanceable teaching controls; predictable recovery; support touch and keyboard; preserve context. F01–F08, F14–F17. |
| [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion) | System text size, meaningful language/labels, contrast and multiple input methods. F01–F06, F09, F11, F17–F19. |
| [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Windows](https://developer.apple.com/design/human-interface-guidelines/windows), [Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking), [Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views) | Existing safe areas and wide layout are strengths. Verify resized/short windows, text growth, keyboard occlusion, and safe resume. F02, F14, F16. |
| [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Labels](https://developer.apple.com/design/human-interface-guidelines/labels), [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls) | Comfortable targets, visible state, meaningful names, and clear task hierarchy. F01, F03, F14. |
| [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls), [Tab views](https://developer.apple.com/design/human-interface-guidelines/tab-views), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Control/Q&A/Statistics are related views of one quiz. Keep that information architecture; fix interaction semantics before adding more navigation. F04. |
| [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Modality](https://developer.apple.com/design/human-interface-guidelines/modality), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets) | Keep short, focused confirmations and safe cancellation. Fix focus return, target size, and the decorative grabber; do not confirm every harmless adjustment. F01, F05, F13. |
| [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Loading](https://developer.apple.com/design/human-interface-guidelines/loading), [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators), [Status bars](https://developer.apple.com/design/human-interface-guidelines/status-bars), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing) | Distinguish loading, freshness, persistence, and completion; keep blocking failures actionable and accessible. F07, F08, F17, F19. |
| [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Accessible semantic colors and system preferences matter more than adding glass effects. F09–F11. |
| [Branding](https://developer.apple.com/design/human-interface-guidelines/branding), [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons), [Images](https://developer.apple.com/design/human-interface-guidelines/images), [Icons](https://developer.apple.com/design/human-interface-guidelines/icons), [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols), [Launching](https://developer.apple.com/design/human-interface-guidelines/launching) | Replace template assets and preserve recognizable meaning, legibility and continuity. SF Symbols are an option; current icons are not inherently prohibited. F12, F16. |
| [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards), [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection), [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures), [Virtual keyboards](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards), [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Complete keyboard focus, predictable tab/filter operation, visible text input and cancel paths. The earlier shortname capitalization fix remains valid. F01, F04, F05, F13. |
| [Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data), [Charts](https://developer.apple.com/design/human-interface-guidelines/charts), [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Preserve glanceable summaries and text/counts; provide structured accessible detail and useful titles. F14, F18. |
| [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts), [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy), [Settings](https://developer.apple.com/design/human-interface-guidelines/settings), [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help), [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Keep the secure existing-account flow and improve actual recovery/localization gaps. Consider identity/privacy/help orientation if validated; F15 remains optional. F07, F15, F19. |
| [Web views](https://developer.apple.com/design/human-interface-guidelines/web-views), [Searching](https://developer.apple.com/design/human-interface-guidelines/searching), [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields), [Menus](https://developer.apple.com/design/human-interface-guidelines/menus), [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Preserve app navigation and back behavior. Search/sidebars are conditional on actual catalogue/workflow scale. They are not automatic requirements for this small focused controller. |
| [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo), [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | Match recovery to the operation. An ended live quiz is not a casually reversible edit. Haptics can supplement confirmed actions but are optional. |
| [Right to left](https://developer.apple.com/design/human-interface-guidelines/right-to-left) | EN/DE are left-to-right. Preserve semantic layout practices, but adding another locale or mirroring scheme is not part of this release assessment. |

Other platform guides, spatial/immersive design, games, audio/video playback,
payments, health, maps, camera, NFC, HomeKit, AR, and similar feature-specific
guides do not match the current product. Push, widgets, Live Activities,
Shortcuts, Pencil features, offline course storage, and new biometric/passkey
flows are optional future capabilities, not prerequisites created by this review.

## Coverage-based assessment

No aggregate HIG score or ship-readiness conclusion is assigned. The requested
task is an audit, not a comparison benchmark, and important native inputs and
states are not verified (`NV`). The earlier draft's general heuristic numbers
are retired in favor of the user-invoked Apple evidence method. They could have
implied more verified coverage than exists. The source sidecar and report
review are cross-checks, not independent blind usability studies.

| Apple review dimension | Verified evidence and limits |
| --- | --- |
| Platform fit and information architecture | Focused home/course/quiz workflow and related session views are clear. Native edge-back, physical iPad windowing and older OS behavior: `NV`. |
| Layout and visual hierarchy | Default-text compact/regular layouts are coherent in the measured cells. Native maximum-text reflow after a fix, software-keyboard occlusion and physical resized windows: `NV`. |
| Controls and interaction | Target dimensions, missing switch names, tab arrows and modal focus return were reproduced in the shared rendering. Full native assistive operation: `NV`. |
| Typography and content | Native text-preference gap, truncation and fallback-language issues have direct evidence. Authenticated cold-launch text behavior and spoken pronunciation: `NV`. |
| Color, imagery and materials | Enabled-label contrast, unchanged dark surfaces and template assets were checked. Increase Contrast, tinted installed icons and material alternatives: `NV`. |
| Accessibility and inclusion | DOM names/roles/language and code paths were checked. Physical VoiceOver, Switch Control, Bold Text and the complete populated-data reading experience: `NV`. |
| Motion and perceived performance | The browser's reduced-motion preference still permits the live pulse. Native Reduce Motion and measured launch/interaction performance: `NV`. |
| Resilience and state completeness | Isolated browser offline command blocking/recovery and stale badge presentation were exercised; native basic functionality was previously user-confirmed. Current populated Q&A, partial-success commands and detailed cold-launch context: `NV`. |

If a score is later requested, use the Apple skill's dimension weights, score
only reverified dimensions, and disclose earned points and the verified
denominator. Do not normalize untested areas into a full-platform score or
double-deduct one root cause. Any demonstrated Critical issue overrides an
arithmetic score.

Accessibility qualification remains incomplete. The enabled normal-text color
pair misses WCAG §1.4.3's 4.5:1 reference. Control names, native language, tab
semantics, focus return, and text adaptation need their specific fixes and real
assistive-technology acceptance. The 44-point HIG recommendation is not the
WCAG AA target-size rule. No blanket WCAG conformance result is asserted.

## How to use this review

An implementer should start from the existing branch, release plan and runtime
recipe in `native/control/README.md` and `AGENTS.md`. Preserve the unrelated
package-script and owner-selected Xcode changes. Use the repository's installed
tools; no new UI framework or global configuration is required by the findings.

The local capture inventory supplies exact surface, locale, viewport, and state
for reproduction. Screenshots are corroboration, not the only reproduction
instructions. Use real synthetic accounts and existing test seams. Do not
commit screenshots, add production fixture branches, obtain production data,
or request new secrets to reproduce design findings. If a later package needs
institutional authentication credentials, obtain them through the maintained
secret-store workflow, outside transcripts and repository files.

Before implementation, agree a coherent package, intended behavior, native
acceptance boundary and any separately gated actions. Then verify changes with
the relevant existing checks and real phone/tablet EN/DE captures. A new draft
PR, stack edit, deployment, signing-account change or store upload is not implied
by the request to identify improvements.

## Delta, environment notes, and review status

Previously fixed and retained: notch-safe toast placement, mobile username
capitalization, audience-feedback placement/empty semantics, embedding-link
removal, guarded quiz commands, and restored authority after polling recovery.
Earlier evidence and source are linked by the existing plans. The current review
also directly confirms responsive empty feedback, source safe-area treatment,
and offline command blocking/recovery. It did not re-drive every earlier fix.

Still open: the three earlier design observations—small targets, long-title
truncation, and larger-text/assistive-technology qualification—are now expanded
as F01, F14 and the relevant accessibility findings. They are not new discoveries
credited a second time. Settled product choices listed above remain ruled.

Environment cautions:

- Apple's normal pages can return a JavaScript-only shell to text clients.
  The linked `.md` versions at the same `/design/human-interface-guidelines/`
  paths provide official content. One guessed navigation-bars topic is absent;
  current toolbar, web-view, gesture and layout guidance covers this concern.
- An initial tablet/landscape screenshot caught the sheet entry animation
  off-center. Reopening and waiting for finite animations confirmed correct
  final geometry. Those transient captures are not layout-defect evidence.
- A locale wait initially used the wrong expected German heading. The actual
  transition succeeded; this was an automation expectation, not a translation bug.
- Simulator preferences were restored and engineering-browser offline mode,
  appearance and temporary root-font overrides were reset. The retained user
  test runtime and private iPad route are not reconfigured for this assessment.
- The optional Jev citation advisory was unavailable because its existing
  restricted profile is not configured. No setup, credential or permission
  changes were attempted. Material claims were checked against Apple's retrieved
  passages directly; this limitation does not substitute for source review.

## Review disposition and completion

A trusted source sidecar's candidates were reconciled with live evidence. A
separate native evaluator reviewed the full report and one correction round.
Accepted corrections narrowed the text-size/relaunch evidence, reconciled the
German desktop capture inventory, and reclassified F15 as optional throughout.
The final correction review found only one remaining wording contradiction in
the HIG map; the main evaluator corrected it to preserve F15's optional status.
That final one-line correction was inspected by the main evaluator rather than
claimed as a third independent pass. No unresolved reviewer finding remains.

Repository Prettier validation, local/source-link checks, per-ID verification
coverage and report data-hygiene inspection passed. This completion applies to
the assessment and its explicit coverage limits. No application behavior, native
assets, signing configuration, stack topology, deployment or store distribution
was changed. The report is an uncommitted local deliverable; publication is not
part of the audit request.
