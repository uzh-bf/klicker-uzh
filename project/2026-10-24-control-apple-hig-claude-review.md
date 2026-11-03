# Control app: independent Apple HIG review (Claude)

- Date: 2026-10-24
- Reviewer: Claude Fable 5.1 (solo execution mode; self-reviewed, no independent second reviewer)
- Source version: `enhance/control-native-login` at `64063dc65caa6106b6a7e47f2739f1ea4a35483d` (worktree `trees/review-control-stack-6539`, read-only)
- Relationship: independent, parallel to the Codex session's `project/2026-10-24-control-apple-hig-review.md`. Written from my own evidence first; reconciled with the parent's sidecar data afterwards (see "Reconciliation").
- Authority: review and local captures only. No application edits, commits, PR changes, native rebuilds, Simulator or device use.
- Classification note: Control is a Next.js web bundle inside a Capacitor WKWebView shell. Apple-platform findings about the shell (icon, launch screen, Info.plist) are HIG-aligned checks; everything rendered by the web bundle is "Apple-inspired" at best and can only be brought closer to the HIG, never declared HIG-compliant. A HIG review does not predict App Review outcomes.

## Scope and method

Surfaces inspected: home with running-quiz banner and stop sheet, course quiz list and start sheet, unassigned quiz list, session control (block card, projection card, live evaluation), audience feedback strip and details sheet, Q&A tab (empty state only), statistics tab, course-not-found, session-not-found, 404, hosted login redirect, offline and recovery state. Native login screen, native broker page, logout and expired-session landing were inspected in source and in the parent's Simulator captures only.

Evidence sources:

- `OBSERVATION`: 118 matrix captures (`project/_local/reviews/control-hig-claude/01..118-*.png`, `capture-matrix.json`), 7 state captures (`p01..p07`, `state-probes.json`, `focus-sweeps.json`). Hosted mode, seeded lecturer account, Chromium 153 headless via agent-browser 0.37.1 on macOS, own session `control-hig-claude-4012` (closed afterwards). Viewports (CSS px): 390x844 (deep pass), 320x568, 844x390, 667x375, 700x900 and 740x900 (around the 720px breakpoint), 744x1133, 1133x744, 1024x768; locales EN (all) and DE (320x568, 744x1133, 390x844 via the `/de` route prefix).
- `OBSERVATION (parent)`: the parent's Simulator captures `/private/tmp/control-hig-native-{normal,dark,largest-text}.png` and its sidecar JSON under `project/_local/reviews/control-hig/`.
- `APPLE-HIG`: Apple pages cached by the parent on 2026-10-24 under `project/_local/reviews/control-hig/<topic>.md` (URL = `https://developer.apple.com/design/human-interface-guidelines/<topic>`). I quoted from that cache and did not re-fetch. The `navigation-and-search` cache holds only the title, so navigation claims cite `designing-for-ios`/`designing-for-ipados` instead.
- `ACCESSIBILITY`: WCAG 2.2 success criteria for the web layer. Contrast ratios computed from the CSS tokens (sRGB relative luminance).
- `SOURCE-ONLY` / `HYPOTHESIS` / `UNTESTED`: labelled per finding.

Measurement traps that shaped the evidence: headless captures freeze CSS transitions mid-flight, so focus rings and sheet positions were re-measured after the animation settled; the first sweep's "visible ring on every stop" was wrong and is superseded by `state-probes.json`. Severities are single-evaluator and provisional.

## Junior handoff (what to do first)

1. Replace the Capacitor placeholder app icon and launch screen (F04). Without this the app cannot be submitted.
2. Make every tappable control at least 44x44 CSS px on touch screens (F01) and give the two unnamed switches a programmatic name (F02). Both are one-file changes in `components/common/styles.ts` and the two `Switch` call sites.
3. Fix the legacy 404 page (F05) and give the not-found and load-failed states a way back (F11).
4. Then work the Moderate list in order: Dynamic Type bridge (F03), Dark Mode (F06), Reduce Motion (F07), contrast (F08), focus rings (F09), offline feedback (F13).

## Delta versus prior work

Settled decisions I did not reopen (from `docs/adr/0056-control-native-session-contract.md`, `native/control/README.md`, `project/2026-10-23-control-stack-review-fixes.md`): Capacitor bundle instead of a native rewrite; system-browser login via `ASWebAuthenticationSession`; Keychain session storage; audience feedback strip with 10-minute window; removal of embedding links; no blind command retry.

Already fixed, not re-reported: safe-area-aware toaster offset (`globals.css:260`, confirmed in captures); username capitalization in the broker page (confirmed in source only).

Still open from earlier reviews and confirmed again here: hit-target sizes, switch names, tab semantics, motion without a reduced-motion path (parent sidecar `review-state.json` lists the same four).

## Findings

Severity scale: Critical / Major / Moderate / Minor (design-with-apple-hig), with the ux-heuristics 0–4 score in brackets. Category: `FA` functional or accessibility problem, `HIG` HIG recommendation, `POL` optional platform polish, `STORE` App Store submission prerequisite. Viewports are CSS px, hosted mode unless stated.

### Major

**F01 · Touch targets below 44 pt on every screen** · Major [3] · FA · OBSERVATION
- User effect: lecturers standing at a lectern mis-tap back, logout, tabs, question selectors, chart segments and switches.
- Where: all screens, all viewports, EN and DE. Shots 01, 03, 05, 07, 14 and their 320/744 counterparts.
- Measured (w x h): back 36x36, logout 36x36, language combobox 19x24, Start row buttons 56x36, session tabs 115x36, question selectors 36x36, chart segments 103x36, switches 48x26, hidden sheet close 16x16, 404 logout 40x28. Only the banner "End" button and the primary action bar meet 44.
- Apple: accessibility — "Give all controls and interactive elements a hit region that measures at least 44x44 pt" (iOS/iPadOS default; 28x28 pt is the stated minimum for very dense layouts). buttons — hit region of at least 44x44 pt.
- Code: `components/common/styles.ts:11-23` (`iconButtonClass` h-9 w-9, `smallButtonClass` h-9), `components/session/SessionTabs.tsx:38` (`min-h-9`), `components/session/LiveEvaluationCard.tsx:260`, `components/session/LeinwandCard.tsx:160`; design-system `Switch` (48x26).
- Smallest fix: raise `iconButtonClass`/`smallButtonClass`/tab/segment heights to `min-h-11 min-w-11` (44 px) on touch, or extend the hit area with padding/pseudo-element while keeping the visual size; wrap the switch in a 44 px-high label row that forwards the click.
- Check: re-run `probe_matrix.py`; `small` must be empty on every shot except the design-system hidden close (F14).

**F02 · Two switches have no accessible name** · Major [3] · FA · OBSERVATION
- User effect: VoiceOver reads "switch, off" with no purpose for "Show solution on screen" and "Enable audience feedback".
- Where: session control (shot 05, `unnamed` = `leinwand-show-solution`), audience sheet (shot 07, plus `audience-feedback-toggle`); all viewports and locales.
- Apple: accessibility — "Provide alternative descriptions for all images and controls"; toggles — label the toggle so its purpose is clear. WCAG 4.1.2.
- Code: `components/session/LeinwandCard.tsx:178`, `components/session/AudienceFeedback.tsx:399` pass `label=` to the design-system `Switch`, whose `FormLabel` renders a `Label` without `htmlFor`; the QA switches in `QAPanel.tsx:423,452` are named because they pass an explicit `id` and label.
- Smallest fix: pass `id` plus `label`, or `aria-label`, exactly as `QAPanel.tsx` does.
- Check: `agent-browser snapshot -i` shows `switch "Show solution on screen"` and `switch "Enable audience feedback"`.

**F03 · Text does not follow the system text size** · Major [3] · FA · OBSERVATION (parent Simulator) + OBSERVATION (proxy) + SOURCE
- User effect: a lecturer with Larger Accessibility Sizes sees exactly the default size; 11–15 px secondary text (meters, KPI subtitles, hints) stays fixed even when the root size is raised.
- Where: parent capture `control-hig-native-largest-text.png` is pixel-identical to `-normal.png` (home, light). Proxy shots 06 and 10 (root font forced to 24 px): rem-based text reflows without overflow, but `13px`/`15px`/`11px` strings remain.
- Apple: typography — Dynamic Type; "Support larger text sizes… at least 200 percent" (accessibility); layout — "Be prepared for text-size changes". designing-for-ipados — "Adapt seamlessly to… Dark Mode, and Dynamic Type".
- Code: `globals.css:250` pins `html { font-size: 16px }`; 29 `text-[11px|13px|15px]` occurrences (e.g. `AudienceFeedback.tsx:95,287,407`, `BlockStatusCard.tsx:91,100`, `StatsPanel.tsx:53`, `SessionTabs.tsx:45`). No bridge from `UIContentSizeCategory` to the web view.
- Smallest fix: replace px text sizes with rem classes; set the root size from a Capacitor-side content-size-category read (or `-apple-system-body` via `font: -apple-system-body` on `html`) so WKWebView honours Dynamic Type; keep a sane cap.
- Check: Simulator at the largest accessibility size shows larger body text with no clipped action bar; proxy run at root 24 px shows no `13px`/`15px` entries in `fontPx`.
- Evidence gap: hardware Dynamic Type remains `UNTESTED`.

**F04 · Placeholder app icon and launch screen** · Major [4] · STORE · SOURCE (committed assets) + OBSERVATION (parent Simulator)
- User effect: the Home Screen shows Capacitor's blue cross; cold launch shows a white screen with a small blue cross that does not resemble the first screen.
- Apple: app-icons — a distinctive icon is expected for every app; launching — "Design a launch screen that's nearly identical to the first screen of your app", "Avoid including text", "Don't advertise".
- Code: `native/control/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (single 1024 px placeholder), `Splash.imageset/splash-2732x2732*.png` used by `LaunchScreen.storyboard` with `scaleAspectFill`.
- Smallest fix: provide the KlickerUZH icon (Icon Composer or a 1024 px master) and a launch screen that mirrors the home header (white background, top bar colour only, no text).
- Check: Simulator cold launch shows the branded launch frame, then the home screen with the same header geometry; icon visible on the Home Screen.
- Note: App Review Guidelines (distribution policy, not HIG) also reject placeholder content; this is a prerequisite, not a guarantee.

**F05 · 404 page is the legacy layout, German-only, with a misleading link and an unnamed control** · Major [3] · FA + HIG · OBSERVATION
- User effect: an EN user who hits a bad route sees a dark legacy header, German body copy, a link labelled "Fragepool" (question pool, which Control does not have) and raw keys "shared.generic.back is not yet translated"; the logout button has no name and controls are 28 px tall.
- Where: shots 14, 26, 70 (EN), 98, 110 (DE); all sizes. Reachable from any mistyped or stale deep link.
- Apple: writing — use consistent terminology; accessibility — name every control; designing-for-ios — consistent navigation.
- Code: `pages/404.tsx:9-27` (hardcoded strings, `Fragepool`), `components/Layout.tsx`/`layout/Header.tsx`/`MobileMenuBar.tsx` (legacy chrome), `HomeHeader.tsx:76` is named but the legacy header's logout is not.
- Smallest fix: render the 404 inside `PageContainer` with `AppBar`, translated copy, one "Back to home" button via `nativeRoute('/')`; delete the legacy header path if nothing else uses it.
- Check: EN and DE 404 show the Control app bar, translated copy, a named primary button of 44 px; `snapshot` shows no untranslated keys.

### Moderate

**F06 · Dark Mode is ignored** · Moderate [2] · HIG · OBSERVATION (parent Simulator) + OBSERVATION (media emulation)
- Where: parent `control-hig-native-dark.png` identical to normal; `p06-dark-media-session-390x844-en.png` with `prefers-color-scheme: dark` emulated: white background, `#111` ink, `color-scheme: normal`.
- Apple: dark-mode — "people… generally expect all apps… to respect their preference"; "Ensure that your app looks good in both appearance modes". designing-for-ipados quoted under F03.
- Code: `globals.css` ctrl tokens are light-only; no `prefers-color-scheme` rule in Control CSS or the design-system dist; `.dark` variant never set; `_document.tsx:17` theme-color `#0028a5` only.
- Smallest fix: add a `@media (prefers-color-scheme: dark)` block redefining the eight `--color-ctrl-*` tokens and `color-scheme: light dark`; keep uzh-blue/red as accents; verify status bar text flips.
- Check: media emulation `dark` shows dark background and light ink; Simulator in Dark appearance matches.

**F07 · Reduce Motion is not honoured** · Moderate [2] · FA + HIG · OBSERVATION
- Where: `state-probes.json` `media.reducedMotion`: with `prefers-reduced-motion: reduce` emulated, `ctrl-screen-in` (240 ms slide on every screen) and `ctrl-live-dot` (1.6 s infinite pulse) still run; design-system sheet `animate-in` also runs.
- Apple: accessibility — Reduce Motion: "ensure your app responds by reducing automatic and repetitive animations"; motion — "Make motion optional".
- Code: `globals.css:196-212` keyframes; `components/common/LiveDot.tsx`; no `prefers-reduced-motion` rule anywhere.
- Smallest fix: one `@media (prefers-reduced-motion: reduce) { .animate-ctrl-screen-in, .animate-ctrl-live-dot { animation: none } }` plus static live indicator; optionally pass the preference to the design-system animations.
- Check: media emulation `reduced-motion` → `document.getAnimations()` returns no `ctrl-*` entries.
- Evidence gap: device Reduce Motion setting `UNTESTED`.

**F08 · Status and danger colour below text-contrast thresholds** · Moderate [2] · FA · ACCESSIBILITY (computed) + OBSERVATION
- Measured: `#dc6027` on white 3.65:1, on `#fafafa` 3.50:1; white on `#dc6027` 3.65:1 (End/stop buttons, 16 px/600); `#9a9a9a` chevrons and faint text 2.81:1; switch track unchecked `#b5bdc5` 1.90:1, checked `#667ec9` 3.89:1.
- Where used: "Running" and "new" labels (13–14 px semibold), error status text, expired timer, danger buttons; all screens.
- Apple: accessibility — contrast table "up to 17 pt: 4.5:1; 18 pt and larger: 3:1"; color — don't rely on colour alone. WCAG 1.4.3 (4.5:1), 1.4.11 (3:1 for control boundaries).
- Code: `globals.css:38` (`--color-uzh-red`), `:185` (`--color-ctrl-faint`), `components/common/styles.ts:17` (`dangerButtonClass`).
- Smallest fix: use a darker red for text and the danger fill (`#b84d1c` measures 5.10:1 on white and 4.89:1 on `#fafafa`), keep `#dc6027` for large/decorative use; raise `ctrl-faint` to `#767676` (4.54:1 on white) where it carries meaning.
- Check: `contrast.json`-style recalculation ≥4.5:1 for all text under 18 px; design-system switch track remains a known limitation unless overridden.

**F09 · Keyboard focus is barely visible on primary controls** · Moderate [2] · FA · OBSERVATION
- Where: `state-probes.json` `focus.*`: design-system buttons (back, logout, Start, Cancel, main action, End) get a 3 px ring of `ring/50` (grey at 50 % alpha) and `outline: none`; `p02`/`p03` show a faint grey halo on the back button and nothing perceptible on the blue main action. Tabs, question selectors and chart segments fall back to the browser default `outline: auto 1px`. Only the audience summary button has a deliberate 2 px uzh-blue ring with offset.
- Apple: keyboards — Full Keyboard Access on iPad relies on a visible focus indicator; focus-and-selection. WCAG 2.4.7, 2.4.11.
- Code: design-system `Button.tsx` (`focus-visible:ring-ring/50 ring-[3px]`), `SessionTabs.tsx:36` and `LiveEvaluationCard.tsx:258` (no focus classes), `AudienceFeedback.tsx:214` (good pattern).
- Smallest fix: apply the audience-button ring (`focus-visible:ring-2 ring-uzh-blue ring-offset-2`) via `styles.ts` to all Control button classes, tabs and segments.
- Check: Tab sweep screenshots show a 2 px blue ring on each stop; `focus-sweeps.json` boxShadow contains `rgb(0, 40, 165)` for every stop.

**F10 · Tab strips announce tabs but do not behave like tabs** · Moderate [2] · FA · OBSERVATION
- Where: session tabs and Q&A filter: `role=tablist/tab` with `aria-selected`, but no `aria-controls`, no `role=tabpanel`, and ArrowRight/Enter on a focused tab do nothing (`tabs.arrowRight`, `tabs.enterOnFocused`); activation needs a click or Space.
- Apple: segmented-controls / tab-bars semantics; accessibility — make custom controls behave like the standard ones they imitate. WAI-ARIA tabs pattern, WCAG 2.1.1/4.1.2.
- Code: `components/session/SessionTabs.tsx:23-36`, `components/session/QAPanel.tsx:472-479`.
- Smallest fix: either drop the tab roles and use plain toggle buttons with `aria-pressed` (as the chart segments already do), or add arrow-key handling, `aria-controls` and a `tabpanel` wrapper.
- Check: ArrowRight moves selection; `snapshot` lists a tabpanel for the active tab (or no tab roles if the button approach is chosen).

**F11 · Not-found and load-failed states offer no way forward** · Moderate [2] · HIG · OBSERVATION
- Where: course-not-found shows "There was an error loading your courses… try again later" (shots 12, 24, 68, 96, 108) and session-not-found a generic error (13, 25, 69, 97, 109); no retry, no back action, no distinction between "does not exist" and "failed to load". The back button in the app bar is the only exit.
- Apple: feedback — tell people what happened and what they can do; loading — distinguish states; writing — specific, actionable errors.
- Code: `pages/course/[id].tsx:50-53` (`control.course.loadingFailed`), `pages/session/[id].tsx:266` (`errorLoadingLiveQuiz`).
- Smallest fix: branch on the GraphQL error (not found vs network), copy that names the case, and a "Back to courses" / "Retry" button in the notification.
- Check: a bad course id shows the not-found copy with a working button; an offline load shows retry.

**F12 · Short landscape phones leave about 215 px for content** · Moderate [2] · HIG · OBSERVATION
- Where: 667x375 session control (shots 39–41): 57 px sticky header + 81 px fixed action bar + block card leaves roughly 215 px for the evaluation and projection cards; everything below needs scrolling under the fixed bar. 844x390 switches to the two-column layout and is fine.
- Apple: layout — adapt to orientation and compact height; designing-for-ios — respect compact environments.
- Code: `pages/session/[id].tsx:411,433` (two-column from `min-[720px]` width only).
- Smallest fix: switch the two-column layout on `min-width: 640px` and `orientation: landscape`, or collapse the action bar to a single row when `max-height: 420px`.
- Check: 667x375 shows the two-column layout or a 56 px bar; no card is hidden behind the bar at rest.

**F13 · Offline tap on the main action is silently ignored** · Moderate [2] · FA · OBSERVATION
- Where: `p04`/`p07` at 390x844: with the network cut, "Close block 1" stays enabled; tapping it does nothing, no toast, no status; only the audience strip shows "Refresh failed. Showing the last available audience feedback." After reconnecting the block was still active (no mutation happened).
- Apple: feedback — "Let people know when an action can't be completed"; loading/status.
- Code: `pages/session/[id].tsx:200-209` (`runAction` returns early when `!navigator.onLine` or `recovery.current.blocked`), `BlockStatusCard` disables only on `commandsBlocked`.
- Note: the parent's `offline-status.json` saw the button disabled; that is the in-flight `recovering` state, which my capture took after the refresh had settled. Both states exist.
- Smallest fix: when `runAction` bails out, show a toast ("You are offline. The quiz keeps running.") and render the action bar in a visibly disabled state while offline.
- Check: offline tap shows the toast and a disabled bar; online recovery re-enables within one poll.

**F19 · Charts have no accessible description** · Moderate [2] · FA · OBSERVATION + SOURCE
- Where: statistics tab and live evaluation (shots 05, 09): choice bars and histogram are plain divs/SVG with colour-only bars; the block progress and audience meter are described, the charts are not.
- Apple: charting-data — "Make every chart in your app accessible"; charts — provide a textual summary.
- Code: `components/session/LiveEvaluationCard.tsx` (ChoiceBars, histogram), `components/session/StatsPanel.tsx`; compare `BlockProgress.tsx:18` and `AudienceFeedback.tsx:75` which are done right.
- Smallest fix: `role="img"` with an `aria-label` summarising counts per option, and a visually hidden table for the free-text list.
- Check: `snapshot` shows an `img "Question 1: A 12, B 4, C 0"`-style node for each chart.

### Minor

**F14 · Hidden 16 px close "X" in every sheet** · Minor [1] · HIG · OBSERVATION. Design-system `SheetContent` renders an absolute 16x16 close button (`sheet.open.hiddenClose`) top-right, duplicating Cancel/Close and failing F01. Apple: sheets — "Always give people an obvious way to dismiss"; the Cancel button already does this. Fix: pass the design-system close-button opt-out if available, or hide it with `[&>button.absolute]:hidden`. Check: `small` no longer lists "Close".

**F15 · Focus does not return to the trigger after a sheet closes** · Minor [1] · FA · OBSERVATION. `sheet.focusReturn` → `BODY`; initial focus lands on the first switch rather than the sheet title. Apple: modality/sheets expect focus continuity; WCAG 2.4.3. Code: `components/common/ResponsiveSheet.tsx` (Radix `onCloseAutoFocus` not set, trigger not passed). Fix: wire `onCloseAutoFocus` to refocus the trigger ref. Check: Escape returns focus to the summary button.

**F16 · Language selector has no affordance or label** · Minor [1] · HIG · OBSERVATION. 19x24 text "EN" with `all: unset`, no chevron, combobox named only "EN" (shots 01, 15). Apple: menus/pickers — make selectable controls look selectable. Code: `components/layout/HomeHeader.tsx` language `Select`. Fix: 44 px chip with chevron and `aria-label="Language"`. Check: snapshot `combobox "Language"`, size ≥44.

**F17 · Quiz names truncate to one line in banner and app bar** · Minor [1] · HIG · OBSERVATION (parent Simulator: "World Capitals (Lectur…"; hosted shots 15/16/87/88 at 320 px). Apple: typography — "Keep text truncation to a minimum". Code: `RunningQuizBanner.tsx:120`, `AppBar.tsx:35`, `ListRow.tsx:42`. Fix: `line-clamp-2` on banner and list rows; keep app bar single-line with full name as `title`. Check: 320 px home shows two-line names, no overflow.

**F18 · Loading spinner is silent for assistive tech** · Minor [1] · FA · SOURCE + OBSERVATION. `shared-components/src/Loader` renders no `role="status"` or text (`Layout.tsx:35`, `pages/course/[id].tsx:38`). Apple: loading — "show feedback as soon as possible"; WCAG 4.1.3. Fix: wrap in `<div role="status" aria-live="polite">` with sr-only "Loading". Check: snapshot lists `status "Loading"`.

**F20 · Date format hardcoded `DD.MM.YYYY, HH:mm`** · Minor [1] · HIG · SOURCE + OBSERVATION (course list EN shows the Swiss format). Apple: writing/localization — use locale formats. Code: `LiveQuizList.tsx:52`. Fix: `Intl.DateTimeFormat(locale, {dateStyle:'medium', timeStyle:'short'})`. Check: EN list shows "Oct 24, 2026, 14:00"-style output.

**F21 · Native broker page is English-only and unstyled** · Minor [1] · HIG · SOURCE-ONLY. `apps/auth/src/pages/native/complete.tsx` hardcodes English copy and renders bare buttons ("Use another account", "Sign in"). Apple: managing-accounts — keep sign-in consistent with the app; writing. Fix: next-intl strings and the auth app's button styles. Check: DE device locale shows German copy. UNTESTED in browser (real-account flow not exercised).

**F22 · Bundle login screen strings are hardcoded and the expired case is not explained** · Minor [1] · HIG · SOURCE-ONLY. `pages/login.tsx:38-80` embeds EN/DE strings in code and reads only `revocation`/`storage`; `lib/apollo.ts:58` redirects with `expired=true`, which the screen never surfaces. Apple: managing-accounts — explain why someone must sign in again. Fix: i18n keys plus an `expired` notice. Check: bundle mode with `?expired=true` shows "Your session expired" copy. Parent's Simulator login capture (`project/_local/reviews/control-pilot-login-before.png`) shows title + button only.

**F23 · App name differs across surfaces** · Minor [1] · HIG · OBSERVATION + SOURCE. "KlickerUZH Control" (`CFBundleDisplayName`, EN header), "KlickerUZH Steuerung" (DE header, `de.ts:6155`), "KlickerUZH Controller …" (`Layout.tsx:40` document title), "KlickerUZH" (404 header). Apple: writing — consistent terminology. Fix: one `appName` key used everywhere; align `CFBundleDisplayName` per locale via `InfoPlist.strings`. Check: titles identical per locale.

**F24 · Logout is an icon-only immediate action with no account context** · Minor [1] · HIG · OBSERVATION. Home header shows a named icon button (`HomeHeader.tsx:76`); no screen shows who is signed in; logout fires without confirmation (not tested to completion). Apple: managing-accounts — show account state; alerts — confirm only when loss is possible (here none, so no alert needed). Fix: show the lecturer's display name in the home header and keep logout as text "Sign out" in a menu or 44 px button. Check: snapshot shows `button "Sign out"` and the account label.

**F25 · Stale native manifest entries** · Minor [1] · STORE · SOURCE-ONLY (committed `Info.plist` via `git show HEAD:`). `UIRequiredDeviceCapabilities` = `armv7` (obsolete on arm64-only targets); no app-target `PrivacyInfo.xcprivacy` (the plugin uses only `FileManager`; Capacitor's SPM package ships its own manifest, so this is `HYPOTHESIS` until an archive validates). `MARKETING_VERSION 1.0`, build 1. Fix: drop `armv7` (or set `arm64`), add an empty-but-valid privacy manifest to the app target, set the real version. Check: `xcodebuild -exportArchive` validation reports no privacy or capability warnings.

**F26 · Landscape side safe-area insets not applied** · Minor [1] · HIG · HYPOTHESIS. Only `env(safe-area-inset-top/bottom)` are used (`HomeHeader.tsx:22`, `AppBar.tsx:23`, `session/[id].tsx:433`); on a notched iPhone in landscape the back button and content can sit under the sensor housing. Chromium reports 0 for all insets, so untestable here. Fix: `px-[env(safe-area-inset-left)]`/right on `PageContainer` and the action bar. Check: Simulator iPhone landscape capture.

**F27 · Native bundle `<html>` has no `lang`** · Minor [1] · FA · SOURCE (`.next-native/index.html` → `<html>`) and parent sidecar ("native export lang missing"). Hosted pages set `lang` correctly (`capture-matrix.json` lang = en/de). WCAG 3.1.1; VoiceOver pronunciation. Fix: set `lang` on `document.documentElement` from the active locale in `_app.tsx` for bundle mode. Check: exported `index.html` or runtime `documentElement.lang` = locale.

**F28 · Audience summary button nests a live region and replaces its visible text with a long label** · Minor [1] · FA · OBSERVATION. `AudienceFeedback.tsx:218` sets `aria-label={accessibleSummary}` ("Open audience feedback details. No respo…") and contains a `role=status` element; VoiceOver hears the long label, and status updates inside a button are unreliable. Fix: keep the visible text as the name, move the status region outside the button. Check: snapshot name equals the visible label.

**F32 · Switch track contrast (design-system)** · Minor [1] · FA · ACCESSIBILITY (computed). Unchecked `#b5bdc5` 1.9:1 against white, checked `#667ec9` 3.89:1; WCAG 1.4.11 asks 3:1 for the component boundary. Fix: override the `Switch` track colours in Control (the solution switch already uses `bg-uzh-grey-80`, see shot 05 `unnamed` entry). Check: both states ≥3:1.

### Optional platform polish (POL)

- **F29 · No haptic feedback on block start/close/end** · POL · HEURISTIC. Apple: playing-haptics — use sparingly for meaningful events; a `@capacitor/haptics` call on confirm is cheap. Not an HIG requirement.
- **F30 · iPad uses a stretched single column with a 1040 px cap** · POL · OBSERVATION (shots 59–86). Two-column session layout from 720 px is good; course and home lists leave wide empty margins. Apple: designing-for-ipados — take advantage of the large display (e.g. sidebar or split for course → quizzes). Acceptable for an iPhone-first app.
- **F31 · No keyboard shortcuts for the main action on iPad** · POL · HEURISTIC. Apple: keyboards — consider shortcuts for frequent actions. Escape already closes sheets (Radix).
- **F33 · Toasts top-right with 5 s timeout** · POL · OBSERVATION. Reasonable; consider bottom placement above the action bar on phones so the thumb does not cover it. Not a finding.

### Strengths (confirmed)

- One clear primary action per session screen; the action bar meets 44 px and respects the bottom safe area; it becomes a sticky side column at ≥720 px.
- No horizontal overflow in any of the 118 captures, including 320 px and the 700/740 px pair around the breakpoint.
- Sheets follow Apple's modal verbs: Cancel leading, confirm trailing, consequence text before the buttons; Escape and overlay tap both dismiss; grabber on compact widths, centered 520 px dialog on wide widths.
- Audience feedback strip uses `role=meter` with a spoken summary; block progress uses `role=img` with a label; pending-question count has sr-only text; error and stale states are visually and programmatically distinct.
- Polling resumes on `online`/`visibilitychange`; failed commands refresh state instead of retrying blindly; an offline tap cannot mutate quiz state (verified).
- EN/DE parity on every new screen; status bar text legible on the light header (parent Simulator capture).
- Safe-area-aware toaster and sticky header (`pt-[env(safe-area-inset-top)]`).

## Scores (provisional, single evaluator)

HIG weighted rubric (design-with-apple-hig): `earned / verified possible`. Dimensions are scored only where evidence exists; Dynamic Type, Reduce Motion, Dark Mode and VoiceOver were verified by emulation plus the parent's Simulator captures, not on hardware, so Typography, Motion and Accessibility carry that caveat.

| Dimension | Weight | Earned | Basis |
| --- | --- | --- | --- |
| Platform fit | 15 | 8 | Web shell; placeholder icon/launch; no Dark Mode; good modal verbs and safe areas |
| Layout | 15 | 11 | No overflow, good breakpoint behaviour; short-landscape crowding; iPad single column |
| Controls | 10 | 4 | Targets <44 px almost everywhere; hidden close; unlabeled language selector |
| Typography | 10 | 5 | Readable scale; px-pinned sizes and no Dynamic Type bridge |
| Color | 10 | 6 | Coherent tokens; red text/danger fill below 4.5:1; faint grey below 3:1 |
| Accessibility | 20 | 10 | Good meter/progress semantics; unnamed switches, tab semantics, charts, focus rings, loader |
| Motion | 10 | 5 | Subtle, short animations; no Reduce Motion path |
| Resilience | 10 | 7 | Offline-safe commands, stale states; silent offline tap; dead-end not-found states |
| **Total** | **100** | **56 / 100** | No Critical finding; F04 still blocks submission as a store prerequisite |

Gap to a defensible 80: F01, F02, F04, F05 (+12), F03, F06, F07 (+8), F08, F09, F13, F19 (+5).

ux-heuristics diagnostic (10-point): 6/10. Visibility of status 1/2 (offline silent), match with real world 1/2 (404, "Fragepool", date format), user control 2/2, consistency 0/1 (app name, legacy 404), error recovery 1/2 (dead ends), help/documentation 1/1 (not needed for this audience).

refactoring-ui diagnostic (8 rows, `round(satisfied/8 × 10)`): hierarchy ✓, spacing ✓, type scale ✗ (px sizes), colour system ✓, contrast ✗, depth/shadows ✓, affordance ✗ (language selector, hidden close), empty states ✓ → 5/8 → **6/10**.

Accessibility (WCAG 2.2, web layer): fails 1.4.3 (F08), 1.4.11 (F08/F32), 2.4.7 weak (F09), 2.5.8 (F01: the 24 px AA minimum is met by most controls but the 19x24 language trigger and the 16x16 hidden close fail; the 44 px AAA level fails broadly), 4.1.2 (F02), 1.3.1/2.1.1 (F10), 3.1.1 bundle only (F27), 1.4.4 partial (F03), 4.1.3 (F18); 2.3.3 (AAA) not met (F07); passes 1.4.10 reflow at 320 px, 2.1.2 no trap, 2.4.3 except F15.

## Roadmap

- **R0 (store prerequisite, 0.5 day)**: F04 icon + launch screen; F25 manifest cleanup. Check: archive validates; cold launch shows branded frame.
- **R1 (accessibility baseline, 1 day)**: F01 targets, F02 switch names, F05 404 rebuild, F11 not-found actions, F27 bundle lang. Check: `probe_matrix.py` reports `small` empty (except design-system close until F14), `unnamed` empty; EN/DE 404 translated.
- **R2 (system preferences, 1–2 days)**: F03 Dynamic Type bridge + rem sizes, F06 dark tokens, F07 reduced-motion rule. Check: media emulation for dark/reduced-motion; Simulator largest text and Dark appearance captures differ from normal.
- **R3 (contrast and focus, 0.5 day)**: F08 red/faint tokens, F09 unified focus ring, F32 switch track. Check: computed ratios ≥4.5:1 text / ≥3:1 non-text; Tab sweep shows blue rings.
- **R4 (interaction semantics, 1 day)**: F10 tabs, F13 offline toast/disabled bar, F14 hidden close, F15 focus return, F19 chart descriptions, F18 loader status, F28 summary button. Check: `probe_states.py` sections 2–4 pass; snapshot shows chart `img` nodes.
- **R5 (polish, as time allows)**: F12 landscape layout, F16 language chip, F17 line clamp, F20 date format, F21/F22 login copy, F23 app name, F24 account label, F26 side insets, F29–F31.

## Reconciliation with the parent session's evidence

The parent's report file was still a skeleton when I wrote this; I compared against its sidecar JSON only.

- Agree: empty switch names, tab semantics, targets under 44 px, live motion without a reduced-motion path (`review-state.json`); contrast 3.65:1 for `#dc6027` (`contrast.json`); hosted `lang` present and native export `lang` missing; Simulator dark and largest-text renders identical to normal (`native-accessibility-settings.json`, captures).
- Differ: offline main action. Parent saw "Close block 1" disabled (in-flight `recovering`); I saw it enabled with a silently ignored tap after the refresh settled. Both are real states; F13 covers both.
- New here (not in the parent's sidecar): F05 404 page, F11 dead-end states, F09 focus-ring strength, F12 short landscape, F13 silent tap, F15 focus return, F19 charts, F20 date format, F21 broker page, F23 app name, F24 account context, F28 summary button, F30/F31 iPad polish.
- Parent's "tablet sheet off-center" was an animation-capture artifact; my settled measurements confirm 520 px centering (shots 44, 52, 60, 72, 80).

## Withdrawn readings and false positives

- My first focus sweep reported a visible ring on all ten Tab stops. It read a truncated `box-shadow` captured mid-transition; the settled re-measurement in `state-probes.json` replaces it and is what F09 cites.
- The parent's early tablet capture suggested an off-center sheet. It was the entry animation; settled captures at 700–1133 px (shots 44, 52, 60, 72, 80) show the 520 px dialog centered. Not a finding.
- The hidden sheet close button's `y` in `sheet.open` (857 px) was measured during slide-in; its position in the screenshots (top-right of the sheet) and its 16x16 size are what F14 relies on.
- The offline "button disabled" versus "button enabled" difference between the parent and me is timing, not a contradiction (see F13).

## Source coverage and N/A topics

Cited Apple topics (retrieved 2026-10-24, cached by the parent): accessibility, typography, dark-mode, motion, launching, app-icons, buttons, sheets, modality, alerts, action-sheets, toggles, segmented-controls, tab-bars, designing-for-ios, designing-for-ipados, layout, feedback, loading, managing-accounts, writing, charting-data, charts, keyboards, focus-and-selection, status-bars, privacy, playing-haptics, color.

Not applicable or out of scope: macOS, watchOS, tvOS, visionOS; Liquid Glass and materials (web view renders no system materials); widgets, Live Activities, App Clips, Siri, Game Center, in-app purchase, Apple Pay, CarPlay, right-to-left (EN/DE only), search fields, context menus (none exist), undo/redo (no editable content), multitasking/Stage Manager and windows (untested; the web layout is fluid, so expected to adapt), pointing devices beyond keyboard focus, web-views topic (Control is the web view, not embedding one), onboarding (none exists and none is needed for lecturers already using Manage).

## Evidence gaps (explicitly untested)

- Hardware VoiceOver, Switch Control and Full Keyboard Access on iPad.
- Hardware Dynamic Type; only the parent's Simulator capture and my root-font proxy exist.
- WKWebView safe-area insets in landscape on a notched device.
- Populated Q&A, moderation, answer composition, delete confirmations and the end-quiz path from inside a session: the seeded running quiz has Q&A off and an active block, so these are reachable only by changing quiz state, which this review was not allowed to do. Source review of `QAPanel.tsx` shows Cancel/Send ordering and autoFocus on the textarea; moderation confirmations are `SOURCE-ONLY`.
- Native login screen, broker page completion, logout and expired-session landing in bundle mode (real-account authentication excluded).
- Dark Mode and Reduce Motion on device; Simulator captures came from the parent, not from me.
- HIG Doctor or any static scanner was not run; physical iPad windowing not exercised.

## Environment notes

- Inside the sandbox `devrouter status` reported the runtime as drifted and Docker as unreachable; the routed Control and auth origins answered 200 and the API root 404 (GraphQL endpoint only). Treated as a sandbox artifact; `devrouter ensure` was not run.
- agent-browser needs its socket directory outside the sandbox write set; every browser command ran with the sandbox bypass. Own session `control-hig-claude-4012` was closed at the end; the parent's session was not touched.
- German was captured via the `/de` route prefix because switching the locale through the header `Select` in a scripted run timed out.
- `probe_matrix.py` and `probe_states.py` under `project/_local/reviews/control-hig-claude/` are re-runnable against any later build; they only open and cancel dialogs.
