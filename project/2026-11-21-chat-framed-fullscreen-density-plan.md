# Framed chat: fullscreen and compact density

## Approval summary

**Why and what changes.** When an LMS frames the chat through an LTI launch, the
chat renders its full desktop layout inside a frame that is often only about 600
pixels tall. The LMS chrome, generous message spacing, a tall composer, a
persistent caveat line and a heavy sidebar footer leave a few lines for the
conversation and two or three rows for the history. This package adds a
fullscreen toggle for the framed chat and a compact density for that same
situation, and it tightens two blocks in every layout: the sources header and
the credits block in the sidebar.

**What stays unchanged.** The standalone chat keeps its spacing, composer,
caveat line and sidebar footer. The `?embed=1` layout keeps its styling. The
PWA drawer and the Manage assistant dock use that layout and grant no
fullscreen permission, so they show no toggle and nothing changes there. The
owner preview is a separate variant and is unaffected. The eLearning launcher
is affected like the LMS: with `embed=0` it frames the full layout, which
becomes compact and gets the toggle; with `embed=1` it gets the toggle only
where its host grants fullscreen. No launch route, authentication, data or API behavior changes.
Touch targets stay at 44 pixels on coarse pointers.

**What could change the decision.**

- The accuracy caveat under the composer is a deliberate line. In the compact
  density it is shown only while the thread is empty, because the user asked for
  that text to be moved or removed. Standalone keeps it on every screen.
- Fullscreen depends on the host frame granting the permission. Upstream
  OpenOlat grants it on both LTI frame templates through `allowfullscreen`,
  which covers the redirects of the LTI launch. A host that used a scoped
  `allow="fullscreen"` instead would not cover them. The deployed LMS was not
  checked. The toggle hides itself when the browser reports fullscreen as
  unavailable, so an unsupported host shows no dead control.
- The collapsed credits block no longer shows the refill date above 20 percent
  until it is expanded. The student guide describes that date as always
  visible and is updated in the same pull request.
- Browsers consume Escape to leave fullscreen, so a dialog open at that moment
  does not receive that key press.

**How we know it is done.** Framed from another local origin at about 1060 by
620 pixels, the chat shows the fullscreen toggle when the frame allows
fullscreen and no toggle when it does not, with the compact density on in both
cases. The frame shows visibly more conversation and history than before, and
sending, editing, sources and credits behave as before. Standalone screenshots show only the sources header and credits
block changing. Type check, lint, the chat unit tests and the affected
`Y-chat` Playwright tests pass.

**What approval authorizes.** On 2026-11-21 the user set the scope in chat,
including the correction that the logo and copyright stay but become much
smaller in the framed layout, and then asked to stop once this plan is final.
Implementation therefore waits for the user's go-ahead on this plan. Approval
would cover local commits, pushing this task branch and a draft pull request to
`v3-ai`. Merging, marking ready and any deployment stay withheld.

## Execution details

### Plan identity

- Plan: `project/2026-11-21-chat-framed-fullscreen-density-plan.md`
- Branch: `enhance/chat-framed-fullscreen-density`, worktree
  `trees/chat-framed-fullscreen-density`
- Target: `v3-ai` (chat changes land there first)
- Approval mode: executable batch. Ceremony tier: full path.
- Authority: local commits, non-force push of the task branch, draft PR.
  Withheld: merge, ready-for-review, deployment, reviewer requests.
- Terminal: draft PR open with screenshots, checks green or reported.
- Boundary owner: self.
- Pause: only if fullscreen or compact density would require changing the
  launch contract, CSP or a public API.

### Decisions

- **Framed detection.** A client hook, `useFramed`, reports whether the chat
  runs inside a frame (`window.self !== window.top`), false during server
  render. The fullscreen toggle reads it directly. `ChatUiContext` exposes
  only the derived `compact`, true for the participant variant when framed and
  not `embedded`. The provider mounts after a client-side fetch, so the LMS
  path has no server-render mismatch and no density flash. Styling follows the
  existing `embedded ? … : …` pattern with `twMerge`; no new CSS variant.
- **Why framed and not viewport height.** Keying on framing leaves every
  standalone screen and its existing tests untouched, and it matches the
  user's wording. A height-based trigger would also compact standalone laptops
  and the default Playwright viewport. Reopen if standalone users on short
  windows ask for the same density.
- **Fullscreen.** An explicit header button, shown only when framed and
  `document.fullscreenEnabled`. It toggles fullscreen on the document element
  so portals and dialogs stay inside it, and tracks state through
  `fullscreenchange`. It is named distinctly from the knowledge-graph panel's
  CSS-only "fullscreen". It appears in the sidebar layout header and in the
  embedded toolbar.
- **Compact density (framed, non-embedded).** Composer input padding and send
  button margin reduced, bottom padding reduced, caveat line only on the empty
  thread, message vertical padding and thread top padding reduced. The
  composer keeps its 16-pixel font, because iOS Safari zooms the page when a
  smaller input gets focus. The compact top padding is merged after the
  history-rail classes; below the `md` breakpoint the rail keeps its 56 pixels
  for its trigger. Message
  action buttons shrink from 32 to 28 pixels on fine pointers and their icons
  from 24 to 16 pixels. Action rows stay mounted and visible, so keyboard
  access and existing test hooks are unaffected; hover-only actions were
  rejected because they hide controls from keyboard users. The thread root
  carries a `data-compact` marker so the shared action-button class constant
  can react without changing its twelve call sites in `thread.tsx` and
  `branch-picker.tsx`. Slice 2 first confirms that the stacked variant
  compiles; if it does not, the call sites take the compact class instead.
- **Sources header (non-embedded variant, every layout).** "Sources · N" and
  "Cited in this answer" share one row; the separate sub-heading goes away.
  The existing heading element stays untouched, because it names the section,
  anchors the reveal scroll and is asserted by a test. The cited label is a
  sibling of it and appears only when cited sources exist. The embedded
  variant already uses a single header.
- **Credits block (every layout).** A toggle row (icon, title, percentage,
  chevron) built like the settings toggle directly above it, with the thin bar
  beneath. The bar stays outside the button so its progress semantics survive.
  The explanation, refill date and exhausted message sit in the expandable
  body. It is open by default below 20 percent, including exhausted, so those
  lines stay visible when they matter; a manual toggle overrides the default.
  The toggle is 44 pixels high on coarse pointers. Existing `data-cy` hooks
  are kept and the component still renders without the chat UI context, which
  the unit test relies on.
- **Sidebar footer when framed.** Logo and copyright stay, as one small row:
  a 16-pixel-high logo link with a 24-pixel hit area next to the full
  copyright text at 10 pixels. The text is not truncated. The thread filter is
  hidden until more than eight threads exist, and stays visible while a filter
  query is active so a filtered list can always be cleared. The filter change
  is optional and is the first item to drop if it complicates the slice.
- **Dropped from the earlier proposal.** Collapsing the sidebar by default and
  a credits chip in the header: the user wants more history visible, which a
  default-closed sidebar works against. Collapsing tool-call groups: they are
  already collapsed by default. One-line thread rows: left for a follow-up if
  the footer change does not free enough rows.

### Test portfolio

| Behavior or risk | Existing protection | Obligation | Seam |
| --- | --- | --- | --- |
| Credits percentage, section and exhausted message stay reachable | `Y-chat` credits tests, `credits-display.test.tsx` | extend existing only if the disclosure changes what they observe | existing `data-cy` hooks |
| Sources section cited and other lists | `Y-chat` sources tests | none | existing hooks |
| Caveat line visible in standalone | `Y-chat` composer-hint tests | none | existing hook |
| Thread filter behavior | `thread-list-filter.test.ts` | none; threshold applies only when framed | pure filter function |
| Fullscreen toggle appears only when framed and permitted | none | none: reversible presentational control, verified in the browser | — |
| Compact density applies only when framed | none | none: verified by framed and standalone screenshots | — |

### Slices

1. **Framed context and fullscreen toggle.** Hook, context fields, toggle in
   both headers, EN/DE strings. Verify: type check; browser check in a
   same-origin frame that the toggle enters and leaves fullscreen and is absent
   standalone. Commit: `enhance(chat): add fullscreen toggle for framed chat`.
2. **Compact density for the framed thread.** Composer, caveat line, message
   and thread spacing, action button size. Verify: framed before and after
   screenshots; standalone unchanged. Commit:
   `enhance(chat): compact thread density when framed`.
3. **Sources header and sidebar.** One-line sources header, credits disclosure,
   small footer and filter threshold when framed. Verify: screenshots in both
   locales and color schemes; credits unit test; affected `Y-chat` tests.
   Commit: `enhance(chat): tighten sources header and sidebar footer`.
4. **Docs.** A short section in `docs/chat-platform.md` on the framed compact
   density and the fullscreen host-permission contract. The student guide
   `apps/docs/docs/student_tutorials/chatbot.mdx` is corrected where it says
   the refill date is always visible. The lecturer page
   `apps/docs/docs/tutorials/chatbot.mdx` gains one sentence in "Embed it in
   your LMS": students can switch the embedded chat to fullscreen when the LMS
   frame allows it. Commit as `docs(chat): …`.

Files expected to change: `apps/chat/src/hooks/useFramed.ts` (new),
`apps/chat/src/components/fullscreen-toggle.tsx` (new),
`chat-ui-context.tsx`, `assistant.tsx`, `embedded-settings.tsx`, `thread.tsx`,
`ui/action-bar-button.ts`, `sources-section.tsx`, `credits-footer.tsx`,
`app-sidebar.tsx`, `thread-list.tsx`, `packages/i18n/messages/{en,de}.ts`,
`docs/chat-platform.md`, the two `apps/docs` pages named in slice 4, and
existing tests only where their observation changes.

### Verification

- In the devcontainer: chat type check, lint, format check, chat unit tests.
- Browser: `agent-browser` against this worktree's routed stack.
  - Host permission: the chat is framed from another routed local origin, which
    the development `frame-ancestors` setting allows. One run uses a frame
    with `allowfullscreen`, where the toggle must enter and leave fullscreen.
    One run uses a frame without it, where the toggle must be absent and the
    compact density still on.
  - Density screenshots may use a same-origin frame.
  - States: framed and standalone, the eLearning `embed=0` and `embed=1`
    launches, thread empty and with an answer that has sources, credits normal
    and below 20 percent, EN and DE, light and dark.
- Host Playwright: the credits, sources and composer-hint tests in `Y-chat`.
- Recovery: if a `Y-chat` test observes structure that the credits disclosure
  changes, adjust the assertion to the behavior it protects. If fullscreen
  cannot be exercised in the headless browser, record that and verify the
  toggle's visibility gating and the API call instead.

### Planning critique

One independent read-only critique ran on the frozen draft on 2026-11-21 and
returned `REVISE` with ten findings; the design itself held. All ten are
dispositioned in this revision. Accepted: cross-origin permission
verification, the two user-doc pages, the top-padding merge order, the
action-button call sites, keeping the sources heading intact, the eLearning
surfaces, the 16-pixel composer font, and the Progress correction. Two findings
were already covered by the refined draft: the progress bar outside the toggle,
and the filter staying visible while a query is active. The report is kept
locally under `project/_local/reviews/`. No substantive decision is open.

## Progress

- Root outcome: more usable space for the framed chat, per the user's requests
  of 2026-11-21. Authorized terminal: draft PR to `v3-ai`.
- Status: plan final after the planning critique. Waiting for the user's
  go-ahead; the user asked on 2026-11-21 to stop once the plan is final.
- Uncommitted draft code for slices 1 and 2 exists in the worktree
  (`useFramed.ts`, `fullscreen-toggle.tsx`, context, headers, thread spacing,
  action-button constant, EN/DE labels). It has not been type-checked or run
  and is not evidence of completion. Known defect to correct: the compact top
  padding also applies between the `sm` and `md` breakpoints while the history
  rail is shown, which would cover the rail trigger.
- Remaining: slices 1 to 4 verified and committed, browser verification,
  draft PR.
- Next action: on approval, type-check the draft, finish slice 3, verify in the
  browser.
