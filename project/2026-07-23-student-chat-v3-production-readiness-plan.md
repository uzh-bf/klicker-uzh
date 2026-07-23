# Student Chat v3 — Production-Readiness Plan

Follow-up execution plan to bring the v3 chat reskin from "draft PR" to production-ready.
Written for a junior engineer. Work one slice at a time, in order. Every slice ends in its
own commit and its own verification. Do not batch slices.

## Plan identity

- Plan: `project/2026-07-23-student-chat-v3-production-readiness-plan.md` (this file)
- Branch: `claude/student-chat-v3-design-3459db` (continue on this branch)
- Target: `v3`, PR: [#5197](https://github.com/uzh-bf/klicker-uzh/pull/5197) (draft — keep draft)
- History: `project/2026-07-19-student-chat-v3-reskin-plan.md` (reskin, finish-gated, done)
- ADRs in force: `docs/adr/0001-chat-locale-from-cookie.md`, `docs/adr/0002-message-feedback-as-a-rating-field.md`

## Goal

- Problem: reskin landed and is verified, but a production-readiness review (browser matrix
  en/de x mobile/desktop + 4 code lenses) found P1 bugs, mobile/touch gaps, a11y gaps,
  error-state gaps, and theme leaks.
- Goal: close all P1 and P2 findings below, decide-or-defer the P3s, re-verify in browser,
  update PR #5197.
- Non-goals: dark mode as a feature (see D1). New chat features. Backend/API changes beyond
  what slices name. OTel major bump (tracked in PR body as follow-up).

## Evidence base

- Browser matrix: agent-browser (real Chromium), participant `testuser24`, viewports 1440x900
  and 375x812, locales en+de, screenshots in session scratchpad `prodreview/`.
- Code lenses: 4 parallel review agents (design-language, a11y-keyboard, responsive-mobile,
  production-gaps), findings quoted with file:line, confidence >= 75 only.
- Withdrawn finding: the floating "N" circle overlapping the footer on mobile is the
  **Next.js dev-tools indicator** (dev-only, also present on bare 404 pages). Not product UI.
  Do not chase it.
- Seed caveat: the two `(seed)` threads in dev currently have no assistant messages
  (Erklaerer thread is fully empty, `lastChatMode: null` — that is data, not a bug; an
  empty thread showing the greeting is accepted behavior). Use the Playwright
  `seedThread` helper or the API to create proper linked messages when you need an
  assistant turn; a raw SQL/Prisma insert without `parentId` linkage renders as a
  separate branch and hides the user message.

## Decisions (D) — approved by user 2026-07-23

- D1 **Dark mode: remove the latent `.dark` block.** (approved) Nothing ever applies `.dark`; forced-on
  it is half broken (sidebar/composer/footer stay light, `--primary` dark value is shadcn
  gray `oklch(0.92 0.004 286.32)` at `globals.css:131`, not UZH blue). Removing
  `globals.css:124-156` + the `@custom-variant dark` line is zero-behavior-change today.
  Wiring dark properly = separate feature with its own plan. → Slice S6.
- D2 **Mobile mode switcher: horizontally scrollable pill row.** (approved) With 3+ modes or long
  German labels the header overflows 375px (no `min-w-0`, no wrap — evidence in S7).
  Scrollable pill (`overflow-x-auto` + `scrollbar-none`) is the smallest change and keeps
  one component; the native-`<select>` fallback used by `embedded-settings.tsx:15-27` is
  the alternative if scrolling feels bad in testing. → Slice S7.
- D3 **Model descriptions in DE: hide them when no localized text exists.** (approved) Descriptions
  come from the deployment model registry and are English-only ("OpenAI model" shows raw
  in the DE UI). Cheap fix: render description only for `en` until the registry schema
  gets per-locale descriptions (do NOT change the registry schema in this plan). → Slice S10.

## Environment + verification recipe

- Stack: `devrouter ensure .` from the worktree root. Chat at
  `https://chat.klicker.claude-student-chat-v3-design-34.localhost/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`
  (chatbot "Benibot"; enrolled participant `testuser24`).
- Login for browser checks: mint a participant JWT in-container (jose, `sub` =
  participant id, signed with container `APP_SECRET`; write the helper under `apps/chat/`,
  run `devrouter exec . -- bash -lc 'cd /workspaces/klicker-uzh/apps/chat && node mint-jwt.mjs'`,
  **delete the helper after**, never commit it or the token), then
  `npx agent-browser cookies set participant_token <jwt> --url <host>` and
  `npx agent-browser open <url>`. Locale via `cookies set NEXT_LOCALE de --url <host>`.
- Typecheck: `devrouter exec . -- bash -lc 'cd /workspaces/klicker-uzh && pnpm --filter @klicker-uzh/chat check'`.
  **Never run `check` while you are mid-browser-verification**: typegen rewrites `.next/`
  and every chat route 404s until `devrouter ensure .` (documented in docs/chat-platform.md).
- Playwright: specs in `playwright/tests/Y-chat.spec.ts`, helpers in `playwright/util/chat.ts`
  (`seedThread`, `getMessageRating`). Runs on host against the worktree stack (see
  docs + `klicker-playwright-e2e` skill). CI runs the suite regardless.
- Commits from this host worktree need `--no-verify` (no root node_modules for husky);
  the real checks run in-container. Say so in the commit trailer or PR notes.
- Data hygiene before EVERY commit: `git diff --cached` grep for tokens/secrets/PII.
  Repo is public. German student-facing text: informal Du/Dein/Dir (capitalized),
  "Dozierende", Swiss `ss` never `ß`. en/de key parity is compile-enforced.
- Wiki rule: behavior changes must update `docs/chat-platform.md` in the same PR.

## Slices

### S1 — Fix the broken Klicker logo (P1, tiny)

- Problem: sidebar-footer logo is broken in every viewport/locale.
- Evidence: `app-sidebar.tsx:104` uses `next/image` with `/KlickerLogo.png`; the file
  exists in `apps/chat/public/`, raw request 200s when authed, but the optimizer endpoint
  `/_next/image?url=%2FKlickerLogo.png&w=256&q=75` returns **400** → `<Image>` always
  broken. Unauthenticated, `src/middleware.ts` also 307s public assets (matcher does not
  exclude them).
- Do: (1) add `unoptimized` to this `<Image>` (a 120x60 static logo gains nothing from
  the optimizer) or configure `images` properly if you find the 400's root cause in
  next config; (2) exclude static assets (`.png|.svg|.ico|_next/image`) from the
  middleware matcher so unauthenticated pages can load them too.
- Check: logo renders on desktop + mobile, en + de, authed; `curl` without cookie gets
  200 for `/KlickerLogo.png`; no more clipped alt text.
- Commit: `fix(chat): serve sidebar logo unoptimized and exempt static assets from auth middleware`

### S2 — Mode resync on direct thread-URL load (P1)

- Problem: opening a thread by URL (bookmark/share/reload) keeps the previously persisted
  mode; the thread's own mode is ignored. Verified live: Tutor thread (`lastChatMode:
  "tutor"`) direct-loaded with Erklärer pill pressed.
- Evidence: `RuntimeProvider.tsx:143-155` — when persisted `activeThreadId === threadId`
  and the persisted thread has messages, the effect sets `lastSyncedThreadId` and returns
  **before** `switchToThread` (`RuntimeProvider.tsx:170`) ever runs, so the mode-resync
  inside `chatStore.switchToThread` (`chatStore.ts:327`) is skipped. Client-side sidebar
  clicks resync correctly.
- Do: extract the mode-resync from `switchToThread` into a store action (e.g.
  `resyncModeFromThread(threadId)`) and call it in the early-return branch of the
  RuntimeProvider effect (keep the existing guards: only resync when the thread's
  `lastChatMode` is known and differs).
- Check: Playwright test — seed thread with `lastChatMode: 'tutor'`, set persisted mode
  to explainer (visit another thread first), `page.goto()` the tutor thread URL directly,
  expect the tutor pill `aria-pressed=true`. Browser spot-check both directions.
- Commit: `fix(chat): resync chat mode when a thread is opened by direct URL`

### S3 — Touch users can reach message actions + sheet closes on select (P1)

- Problem A: copy/edit/regenerate/rate action bars are hover-gated and **unmounted** for
  every non-last message — on phones (no hover) students cannot rate or copy anything but
  the last message.
- Evidence A: `thread.tsx:846-848` (UserActionBar) and `thread.tsx:1217-1219`
  (AssistantActionBar) pass `hideWhenRunning` + `autohide="not-last"`;
  assistant-ui's float status is driven purely by `mouseenter/mouseleave` (no
  touch/pointer fallback), and hidden bars return `null` (no CSS workaround possible).
- Do A: drop `autohide="not-last"` (always render action bars), or gate it on
  `matchMedia('(hover: hover)')` so coarse-pointer devices always show them. Prefer the
  simple drop first; check visual noise on desktop with a long thread.
- Problem B: mobile sidebar sheet stays open after picking a thread; content loads behind it.
- Evidence B: `thread-list.tsx:44` `onSelect` only routes; `app-sidebar.tsx:37` same for
  new-chat; nobody calls `useSidebar().setOpenMobile(false)` anywhere in the app (the
  design-system Sidebar renders a Sheet on <768px driven by `openMobile`).
- Do B: in `ThreadListItems` and both new-thread paths, `const { setOpenMobile } =
  useSidebar()` and call `setOpenMobile(false)` on select/create.
- Check: 375x812 — tap thread → sheet closes, thread visible; every message's actions
  tappable without hover; rating persists (existing Playwright rating test still green).
- Commit: `fix(chat): make message actions touch-reachable and close mobile sidebar on selection`

### S4 — Composer send/stop accessible names (P1, tiny)

- Problem: the send button and the stop-generation button have no accessible name — the
  two most important controls announce as "button".
- Evidence: `thread.tsx:760-770` (send, icon-only, no aria-label; no
  `chat.composer.send` key exists) and `thread.tsx:775-785` (cancel/stop, same).
- Do: add `aria-label={t('chat.composer.send')}` / `t('chat.composer.stop')`; add the
  en+de keys (informal German: e.g. "Nachricht senden" / "Antwort stoppen").
- Check: `check` passes (key parity); agent-browser snapshot shows the names; VoiceOver
  spot-check if available.
- Commit: `fix(chat): give composer send and stop buttons localized accessible names`

### S5 — Error states a student can see (P1 + P2 batch)

- Problem: several failure paths are console-only or hardcoded English; a student sees
  nothing or wrong-language text.
- Evidence: `hooks/useChatResponse.ts:635-641` network-level send failure → only
  `console.error`, no bubble/toast (unlike the `!response.ok` path). `useChatResponse.ts:449`
  + `:556` hardcoded English error strings ("I'm sorry, something went wrong...",
  "_(Connection interrupted...)_"); `:460` `break` only exits the inner loop so both
  strings can stack. `:218` raw server error text interpolated into the assistant bubble
  unlocalized. `assistant.tsx:126` (+153) disclaimer accept/decline failure → silent
  revert inside a non-dismissible modal (can strand the student on the consent gate).
  `chatStore.ts:313` (+260) thread-list/create failures other than 403 vanish.
- Do: (1) network-failure path adds the same localized error bubble as the HTTP path;
  (2) move the stream-error strings to i18n keys (en+de, informal), fix the `:460`
  loop-exit so only one error lands; (3) wrap raw server error text in a localized
  generic message (keep detail in console); (4) disclaimer failure: show a localized
  inline error in the modal with a retry; (5) thread-list failure: localized empty-state
  error with retry button.
- Check: dev-tools offline mode → send shows localized bubble (en+de); kill backend →
  thread list shows error+retry; disclaimer POST forced to fail (block URL in devtools)
  → modal shows error, retry works after unblock.
- Commit: `fix(chat): surface localized error states for send, stream, disclaimer and thread list`
- Note: this is the largest slice — if it grows past a day, split (5a send/stream,
  5b disclaimer + thread list) into two commits.

### S6 — Theme-token cleanup + remove latent dark block (P2/P3 batch, mechanical)

- Problem: hardcoded colors bypass the token system (they are also why forced dark was
  half-broken); the `.dark` block itself is dead weight (D1).
- Evidence (each quoted by the design lens): `thread.tsx:393` composer `bg-white
  border-gray-200`; `thread.tsx:500` dnd overlay `bg-white/85`; `thread.tsx:365,370`
  attachment error `bg-red-50 text-red-600 hover:bg-red-100`; `thread-list.tsx:199`
  rename input `bg-white`; `thread-list.tsx:217` cancel `hover:text-red-600`;
  `credits-footer.tsx:45-49` Progress missing `background:` override (design-system
  default `bg-gray-200`); `thread.tsx:414` `text-md` (not a Tailwind utility, compiles
  to nothing); `settings-panel.tsx:82` `border-muted` vs default `border-border` divider;
  `assistant.tsx:361-364` loading overlay `bg-white`.
- Do: swap to tokens (`bg-background`, `border-border`, `bg-destructive/10
  text-destructive`, `hover:text-destructive`, `background: 'bg-muted'`, `text-base`,
  `border-border`, `bg-background`). Leave `thread-list.tsx:207` `hover:text-green-600`
  as-is with a `// TODO success token` note (no success token exists — do not invent one).
  Then delete `globals.css:124-156` (`:root.dark` block) + the `@custom-variant dark`
  line at `globals.css:7`, and remove the stale dark-cascade comment.
- Check: visual diff pass on desktop+mobile en (nothing should look different);
  `check` clean; grep `apps/chat/src` for `bg-white|gray-200|red-600|text-md` → only
  justified hits remain.
- Commit: `refactor(chat): route hardcoded colors through semantic tokens and drop the latent dark block`
- Wiki: update the dark-mode note in `docs/chat-platform.md` (theming section) in the
  same commit.

### S7 — Mobile hardening: safe areas, table overflow, header overflow, touch targets (P2)

- Evidence: no `viewport` export / `viewport-fit=cover` / `env(safe-area-inset-*)`
  anywhere; composer wrapper `thread.tsx:280-284` ends `pb-4` at the true viewport
  bottom (iPhone home-indicator overlap). Markdown table `markdown-text.tsx:172-179`
  uses `overflow-y-auto` (wrong axis, and tables need a scroll wrapper `div`) while the
  code-block rule `:214-219` gets it right. Header `assistant.tsx:325` +
  `mode-switcher.tsx:17-22` cannot shrink (`flex-1 justify-center` without `min-w-0`,
  no wrap/scroll) → overflow at 375px with 3+ modes (D2: scrollable pill row).
  Touch targets under 24px: `app-sidebar.tsx:71-74` SidebarTrigger forced `size-4`
  (design-system default is `size-7`), `app-sidebar.tsx:54-59` new-chat `size-4`,
  `assistant.tsx:333-335` + `:347-350` `size-5`, `thread.tsx:628` attachment-remove
  `size-5`.
- Do: (1) add `viewport` export with `viewportFit: 'cover'` in `layout.tsx` + safe-area
  bottom padding on the composer wrapper; (2) wrap markdown tables in
  `<div className="overflow-x-auto">` and drop the wrong class; (3) implement D2
  scrollable pill (add `min-w-0` to the header flex item, `overflow-x-auto
  scrollbar-none` on the pill container); (4) raise the five small targets to >= 24px
  box (icon can stay small; grow the hit area, don't blow up the visuals).
- Check: 375x812 — pill row scrolls when forced (temporarily add a third mode via a
  seeded chatbot or narrow the viewport), table in a seeded message scrolls inside the
  bubble, composer clears the home-indicator area in responsive emulation, targets
  measure >= 24px in devtools.
- Commit: `fix(chat): mobile safe areas, scrollable mode pill, table overflow and touch targets`

### S8 — A11y semantics batch (P2)

- Evidence: `thread-list.tsx:186` `focus-visible:` on a non-focusable `div` (dead CSS —
  keyboard row highlight never renders; the file already uses `group-focus-within/thread:`
  correctly at `:247,257`); no `aria-current` for the active thread (`:128-186`, state is
  color-only `bg-primary/15`); `credits-footer.tsx:42-49` Progress has value semantics
  but no accessible name (visible title at `:33` not associated); `thread.tsx:606-614`
  attachment fallback `text-muted-foreground` on `bg-muted` at `text-[10px]` (~4.4:1,
  AA fail at that size); no heading in the working chat view (`assistant.tsx:337`/`:393`
  chatbot name is a span/div).
- Do: change the dead selector to `focus-within:`; add `aria-current="page"` (or `true`)
  to the active thread's select button; pass `aria-labelledby` (or `aria-label` with the
  credits title) to `Progress`; bump the fallback label to `text-foreground` (or darken
  surface); make the chatbot name an `h1` (visually unchanged via existing classes) —
  if the header layout fights you, defer the heading with a note instead of hacking it.
- Check: axe pass on desktop+mobile (host-run Playwright+axe per
  `klicker-host-run-playwright` memory/wiki), keyboard walk: tab through thread rows and
  see the focus highlight, screen-reader spot-check for aria-current + progress name.
- Commit: `fix(chat): thread-list keyboard focus, aria-current, named progress bar and contrast fixes`

### S9 — Embedded-mode parity (P2)

- Problem: the embedded layout branch lacks the loading indicator and any credit/model
  visibility — embedded students get no feedback while loading and no warning on credit
  exhaustion or fallback-model downgrade.
- Evidence: `assistant.tsx:390` embedded branch has no `Loader2` overlay (sidebar branch
  has one at `:361`); `embedded-settings.tsx` never mounts `CreditsFooter` or the
  fallback-model copy from `SettingsPanel`.
- Do: add the same loading state to the embedded branch; mount a compact credits readout
  (reuse `CreditsFooter`; if it visually overloads the embed, a minimal "X / Y credits"
  line + the fallback-model notice is enough).
- Check: embedded route in browser (find the embed entry — `embedded` prop drives it) at
  375px and 800px: loading indicator on first load, credits visible, de+en.
- Commit: `enhance(chat): loading and credits visibility in embedded mode`

### S10 — Polish batch (P3, do last, timebox)

- Zero-thread empty state: `thread-list.tsx:21` renders nothing for a brand-new
  participant — add a small localized hint ("Starte Deine erste Konversation ...").
- D3: hide registry model descriptions when locale is not `en`
  (`settings-panel.tsx` description paragraphs).
- Rating failure currently reverts silently (`chatStore.ts:830`, deliberate) — add a
  short localized toast if a toast primitive already exists in the app; otherwise leave
  and document in the wiki.
- Thread-row edit/delete on touch need the thread active first (`thread-list.tsx:247,257`)
  — acceptable friction; document as known behavior, no code change unless trivial after S3.
- Perf advisory (unmeasured): whole-store `useChatStore()` subscriptions re-render on
  every SSE token (`thread-list.tsx:28`, `assistant.tsx:51/311`, `app-sidebar.tsx:31`).
  Only act if React DevTools profiling during a streamed answer shows jank: switch those
  call sites to selector-based subscriptions.
- Commit: `enhance(chat): empty-state hint, locale-aware model descriptions and rating toast`
  (adjust to what was actually done).

## Design polish review — visual, motion, assistant-ui (added 2026-07-23)

Second review pass, requested after the production-readiness review: visual design
language on desktop + mobile, fluidity/animation vs state-of-the-art chatbots
(ChatGPT/Claude/Gemini), and whether `@assistant-ui/react` is used to its potential.
Evidence: fresh browser screenshots (session scratchpad `visreview/`) + three parallel
code-grounded review lenses (visual, motion, assistant-ui capability; the
assistant-ui lens verified claims against the installed package types and the
current upstream docs). Confidence >= 75 findings only. Slices S12–S16 below.

Execution order stays: S1–S10 (bugs and gaps) first, then S12–S16 (polish), then the
S17 finish gate once, at the end.

**Verified-good — do NOT "fix" these:**

- Streaming text cursor works: `markdown-text.tsx:3` imports
  `@assistant-ui/react-markdown/styles/dot.css`, whose `aui-pulse` keyframe renders a
  pulsing cursor on the last line via `[data-status="running"]::after`.
- Auto-scroll during streaming is deliberately `behavior:'instant'` per token (avoids
  stacking smooth-scrolls) with a smooth jump only on run start (`thread.tsx:261`
  `scroll-smooth`). Do not switch per-token scrolling to smooth.
- Desktop sidebar open/collapse already animates (200ms, from the design system).
- The "stuck tooltip" in the mobile-sheet screenshot is an artifact of a programmatic
  click; Radix tooltip 1.2.8 explicitly ignores touch pointers. Not a real bug.
- Composer pill styling, mode-switcher semantics, credits block, and assistant message
  typography were rated at or near state-of-the-art — leave their structure alone.
- The attachment adapter and branch picker correctly implement the assistant-ui
  interfaces; per-tool `makeAssistantToolUI` components are deliberately NOT wanted
  (tool names come from per-chatbot MCP servers, unknown at build time).

**Findings (V=visual, M=motion, A=assistant-ui):**

- V1 P1 Brand color is timid — UZH blue appears only on the active pill, progress fill,
  and filled send button; everything else is white/gray shadcn defaults. A screenshot is
  not recognizable as KlickerUZH. → S13/S14.
- M1 P1 All message/welcome entrances are hard cuts. `thread.tsx:320,323` reference
  `aui-thread-welcome-message-motion-1/-2` but NO rule anywhere targets them (checked
  source + compiled CSS); `globals.css` has zero `@keyframes`. `tw-animate-css` is
  already imported (`globals.css:2`) and proven working in `ui/tooltip.tsx:49`. → S12.
- M2 P1 Dead air between send and first token: no assistant placeholder exists until the
  first SSE delta (`useThreadManagement.ts:79-108`, `useChatResponse.ts:318-404`); the
  only feedback is the send→stop icon swap. 1–5s+ of nothing on reasoning modes. → S12.
- V2/A6 P2 Welcome screen is a dead canvas: `ThreadWelcomeSuggestions` fully implemented
  but commented out (`thread.tsx:328`, body `:334-354`; data in
  `lib/config/suggestions.ts`, currently hardcoded English). → S13.
- V3 P2 Desktop header renders ONLY the centered pills when the sidebar is open — name
  block and new-chat button both carry `open && 'md:hidden'`
  (`assistant.tsx:326-331,342-357`). → S14.
- V4 P2 Permanent copyright footer band (`assistant.tsx:368`, shared `Footer`) eats
  bottom viewport space on every screen incl. 375px. → S14 (decision D6).
- V6 P2 Raw metadata caption ("Erklärer — o4-verify — Hoch") renders under EVERY message
  including the student's own (`thread.tsx:825` user, `:1197` assistant); raw model ids
  are meaningless to students. → S14.
- A1 P2 Thumbs feedback is hand-rolled (`thread.tsx:1264-1330` + zustand) while the
  installed 0.12.10 runtime has a first-class `FeedbackAdapter` slot on
  `useExternalStoreRuntime` (`RuntimeProvider.tsx:248-263`) and tracks
  `message.metadata.submittedFeedback` per message. Duplicate state that can drift. → S15.
- A2 P2 `AssistantReasoningPart` (`thread.tsx:198-246`) ignores the part `status` it
  already receives — never auto-expands while reasoning streams, unlike every
  competitor's live "thinking" panel. Status API exists in 0.12.10. → S15.
- A4 P2 Tool failures render identically to successes: `useChatResponse.ts:428-438`
  stuffs "Error: ..." into `result` but never sets the `isError` field the
  `ToolCallMessagePart` type provides; `tool-fallback.tsx:71-86` has no error branch. → S15.
- M3 P2 Reasoning panel, part group, and tool detail expand/collapse are instant
  mount/unmount (`thread.tsx:236-243`, `:1112-1129`, `tool-fallback.tsx:117-129`). → S16.
- M4 P2 Loading = opaque spinner overlay (`assistant.tsx:361-365`) and a blank thread
  list (no skeleton state in `thread-list.tsx`). → S16.
- M5 P2 ScrollToBottom button snaps in/out: `thread.tsx:300` uses `transition-colors`,
  which does not animate the opacity/visibility that `disabled:` actually toggles. → S12.
- V5 P3 Illustrated per-chatbot avatar clashes with the flat lucide icon language
  (decision D5). → S13.
- V7 P3 Welcome title and subtitle are both `text-2xl` (`thread.tsx:320-325`) — no
  hero hierarchy. → S13.
- M6 P3 Send↔stop is an abrupt two-button swap (`thread.tsx:752-786`). → S16.
- M7 P3 Mode pill switches by color fade only — no sliding indicator. → S16.
- A3 P3→follow-up: `@assistant-ui/react-ai-sdk@1.3.26` is a declared dependency but
  never imported; `useChatResponse.ts` hand-parses the exact AI SDK UI-message stream
  the backend emits (`chat/route.ts` `toUIMessageStreamResponse`). Migration is an
  L-effort refactor (custom metadata plumbing) — defer to its own branch (D7).
- A5 note: the whole assistant-message layout sits on `Unstable_PartsGrouped`, which is
  absent from the v0.14 migration guide; 0.14's replacement is `GroupedParts` + a new
  `Reasoning`/`ToolGroup` family. Any future 0.12→0.14 upgrade must budget a rewrite of
  `thread.tsx` grouping — record this in `docs/chat-platform.md`, do not upgrade in this
  branch.

### Additional decisions (defaults; user can veto)

- D4 **Thinking placeholder style**: pulsing-dot placeholder row styled like an
  assistant message (reuse `aui-pulse` from the already-imported dot.css, or 3
  staggered `animate-bounce` dots). No new dependency.
- D5 **Avatar treatment**: keep the illustrated per-chatbot mascot (it is lecturer
  content), but contain it — consistent size, subtle `bg-primary/10` ring — instead of
  redrawing art. Redesigning chatbot avatars is out of scope.
- D6 **Copyright footer**: remove the permanent band from the chat view; move the legal
  line into the sidebar bottom (small muted text under the logo) so it stays visible
  without costing viewport height. Veto if legal requires the banner on every screen.
- D7 **react-ai-sdk migration (A3)**: defer to a dedicated follow-up branch with a
  timeboxed spike; record as PR follow-up. Do NOT attempt inside this branch.
- No framer-motion or other animation dependency: every motion slice below must use
  `tw-animate-css` (already installed) or plain Tailwind/CSS.

### S12 — Motion foundation: entrances, thinking indicator, scroll-button fade (P1)

- Do: (1) M1 — replace the dead `aui-*-motion-*` classnames with real `animate-in
  fade-in slide-in-from-bottom-2 duration-300`-style utilities on the welcome divs
  (`thread.tsx:320,323`) and on `MessagePrimitive.Root` in `UserMessage` (`:806`) and
  `AssistantMessage` (`:1140`); (2) M2 — when the thread is running and no assistant
  message exists yet for the turn, render a placeholder assistant row with the D4
  pulsing-dot treatment; remove it when the first part arrives; (3) M5 — fix the
  ScrollToBottom transition (`transition-[opacity,color,background-color] duration-200`,
  drop `disabled:invisible`).
- Check: browser — send a message (or replay a seeded thread), see user bubble slide in,
  dots appear until first token, scroll button fades; no layout jump when the
  placeholder is replaced. Verify streaming still auto-scrolls correctly.
- Commit: `enhance(chat): message entrance animations, thinking indicator and scroll-button fade`

### S13 — Welcome experience: starter prompts, hierarchy, brand presence

- Do: (1) V2/A6 — re-enable `ThreadWelcomeSuggestions` (uncomment, restyle as 2–4
  tappable cards under the greeting); move the strings from
  `lib/config/suggestions.ts` into i18n keys (en + informal de) — keep the config for
  ids/prompts; (2) V7 — step the greeting (`text-3xl`/`text-4xl` title, `text-lg`
  muted subtitle); (3) V1 (welcome part) — give the empty state a subtle branded
  treatment (e.g. faint `bg-primary/5` radial or accent shape behind the greeting) and
  D5 avatar containment ring where the avatar appears; keep it restrained.
- Check: 1440 + 375, en + de — suggestions tappable (each sends its prompt),
  localized, entrance animation from S12 applies, no overflow at 375px.
- Commit: `enhance(chat): welcome starter prompts, type hierarchy and branded empty state`

### S14 — Chrome decluttering: header, footer, message captions

- Do: (1) V3 — keep the chatbot name (+ small avatar) always visible in the header
  (drop only the redundant toggle from the `md:hidden` block in
  `assistant.tsx:326-331`); (2) V4/D6 — remove the `Footer` band from the chat view
  (`assistant.tsx:368`) and move the legal line into the sidebar bottom as small muted
  text; delete `showFooter` plumbing if now unused; (3) V6 — drop `MessageMetadata`
  from `UserMessage` (`thread.tsx:825`); on assistant messages keep mode + effort but
  drop the raw model id from the always-visible caption (full detail can live in a
  `title` attr / tooltip on the caption).
- Check: browser both viewports/locales — header shows name with sidebar open and
  closed, no footer band, captions only under assistant messages without raw ids;
  Playwright suite still green (captions are asserted in Y-chat tests — update
  selectors if needed).
- Commit: `enhance(chat): persistent header context, sidebar legal note and cleaner message captions`

### S15 — assistant-ui native adoption: feedback adapter, live reasoning, tool errors

- Do: (1) A1 — add `adapters.feedback = { submit: ({ message, type }) =>
  rateMessage(...) }` to the `useExternalStoreRuntime` call (`RuntimeProvider.tsx:248-263`),
  swap `MessageRatingButtons` internals to `ActionBarPrimitive.FeedbackPositive`/
  `FeedbackNegative` reading `message.metadata.submittedFeedback` (keep the optimistic
  rollback semantics of `chatStore.rateMessage`; keep the API route unchanged);
  (2) A2 — in `AssistantReasoningPart`, read `status` and auto-open while
  `status.type === 'running'`, collapse on completion unless manually toggled;
  (3) A4 — set `existingToolCall.isError = true` in the `tool-output-error` branch
  (`useChatResponse.ts:428-438`), stop prefixing `result` with "Error:", and add an
  error branch to `tool-fallback.tsx` (destructive-toned chip + localized "failed"
  label, en + informal de).
- Check: thumbs persist → switch → clear against the DB exactly as before (existing
  Playwright rating test must stay green unmodified or with minimal selector updates);
  reasoning panel auto-opens during a live reasoning stream and collapses after; a
  forced tool error (kill mcp server / block URL) shows the failed chip.
- Commit: `enhance(chat): adopt assistant-ui feedback adapter, live reasoning panel and tool error states`

### S16 — Micro-interaction polish batch (P2/P3, timeboxed ~1 day)

- Do: (1) M3 — CSS grid-rows accordion (`grid transition-[grid-template-rows]
  duration-200` + inner `overflow-hidden`) for the three expand/collapse sites
  (`thread.tsx:236-243`, `:1112-1129`, `tool-fallback.tsx:117-129`); (2) M4 — replace
  the thread-pane spinner overlay (`assistant.tsx:361-365`) with 2–3 `animate-pulse`
  message-shaped skeletons and add 4–5 skeleton rows to `thread-list.tsx` for the
  initial-load window; (3) M6 — single persistent send/stop button shell with a
  150ms icon crossfade; (4) M7 — sliding active indicator in the mode pill
  (`transition-transform` thumb) if it fits the timebox; otherwise defer with a note.
- Check: browser pass — accordions animate, skeletons replace spinners, send↔stop
  morphs during a real stream, pill slides; no console errors; `check` clean.
- Commit: `enhance(chat): accordion transitions, loading skeletons and control morphs`

### S17 — Finish gate

- Re-run the full browser matrix: en+de x 1440/768/375, all states (empty, thread,
  settings, error, streaming), fresh screenshots for the PR.
- Full Playwright chat suite + axe pass; `pnpm --filter @klicker-uzh/chat check`;
  repo-wide `check` in-container.
- Update `docs/chat-platform.md` for every behavior change made above (error states,
  dark removal, embedded parity).
- Update PR #5197 body (rs-mr-description-writer; whole-branch, new slices, new
  screenshots) — keep draft until told otherwise.
- Security re-check only if any slice touched routes/auth (S1 middleware change: yes —
  confirm the matcher exclusion cannot skip auth for real pages, only static assets).
- Update this plan's Progress section as you go; every slice gets its evidence line.

## Progress

- 2026-07-23: Plan created from production-readiness review (browser matrix + 4 code
  lenses, findings all quoted with file:line above). No slices started.
- 2026-07-23: D1–D3 approved by user. Second review pass added (visual design, motion/
  fluidity, assistant-ui capability — fresh screenshots + 3 code-grounded lenses) as
  the "Design polish review" section with slices S12–S16 and decisions D4–D7; finish
  gate renumbered S11→S17. No slices started.
