# Manage Assistant Integration UX Audit and Roadmap

- **Scope:** Question-pool launcher and footer clearance; embedded first-open,
  welcome, conversation, reset, resize, loading, degraded-tool, and compact
  states; standalone new-tab state; signed-proposal review and confirmation;
  English and German.
- **Method:** Live browser audit on macOS with `agent-browser` 0.32.0 and its
  bundled headless Chromium, using a seeded lecturer account at 1440 × 900 and
  390 × 844. Code anchors use
  `902af183d8018c79cadcefe46d4a7f17f395392a`
  (`rs/manage-assistant-feedback-fixes`, PR #5637). The browser used an owned
  runtime at `ffd1775af` with the exact relevant assistant files from the review
  snapshot overlaid because a new exact-snapshot runtime could not acquire a
  Docker network. One evaluator performed the audit; severities are
  single-rater provisional, and one evaluator typically finds about 35% of
  usability problems.
- **Frameworks:** Nielsen/Krug quick diagnostic for usability, scored by failed
  heuristic rows; Refactoring UI composition checks for independent visual
  craft, scored as passing rows out of eight.
- **Evidence:** Local, uncommitted screenshots live in
  `/private/tmp/klicker-manage-assistant-ux-audit-902af183d`. Findings cite shot
  numbers and exact source anchors. Invalid shot 09 is excluded.
- **Prior work integrated:** PR #5109 readiness and follow-up plans; PR #5624
  session UX plan and exact-head evidence; retained decisions RD1 non-modal
  desktop, RD2 explicit confirmation for writes, RD3 conversational read-only
  fallback, and RD4 durable history stays separate.

## How to Work on This

- The approved
  [PR #5637 execution plan](./2026-08-29-pr-5637-manage-assistant-integration-ux-plan.md)
  supersedes this audit's initial one-phase-per-PR packaging sketch with the
  reviewable A0-A4 stack and sequential documentation-search stack. Put
  before/after screenshots for each affected state and viewport in the PR body;
  do not commit the audit's local screenshot files.
- Bring up the exact worktree with the repository's `devrouter ensure` workflow
  and the combined `chat,manage` selection. The target branch replaced the
  audit-time post-start filter with
  [the target-branch profile resolver](https://github.com/uzh-bf/klicker-uzh/blob/84eebeb483f1a27b10d53f6c598ee3a48ae9f15a/util/profile-resolver.sh)
  and [runtime helper](../util/dev-runtime.sh); R0.4 must extend those current
  seams so the focused selection starts `@klicker-uzh/mcp-lecturer` and proves
  its `/healthz` readiness. Otherwise proposal creation cannot be verified.
- R0.1, R0.3, R1.2, R1.4, R2.1, and most of R2.2 verify without model keys.
  R0.2, R0.4, R1.1's proposal states, R1.3, and documentation answer quality
  need the lecturer MCP and a model upstream. Ask the maintainer for the
  approved Infisical-backed startup path. Never paste or commit keys or `.env`
  files.
- Use `npx agent-browser` for browser proof at 1440 × 900 and 390 × 844, plus
  320px for the compact-sheet follow-up. Use only seeded synthetic lecturer and
  question data.
- Switch locale through the Next locale route prefix (`/en/...` and `/de/...`),
  reload the parent page, and confirm the embedded Chat URL follows the parent
  locale before testing the flow.
- Known gotchas: a depleted Docker network pool can block a new worktree; do
  not delete unrelated networks as a workaround. The current focused profile
  omits lecturer MCP and produces `ECONNREFUSED 127.0.0.1:7081`. Cold Chat
  compilation can take about 45 seconds. A missing tool must be recorded as an
  environment limitation unless the same failure is reproduced in the target
  deployment.
- Reproduce evidence from each finding's surface, viewport, locale, and action.
  The screenshot files are local to the audit machine and are not an
  implementation dependency.

## Executive Summary

The integration is now credible as a desktop working companion. Its labelled bottom-right launcher is easy to find, the page remains usable beside the dock, resizing persists, reset is safe, and proposal previews expose options, correctness, and feedback before confirmation.

The next iteration should focus on reliability and trust rather than adding more capabilities. The assistant currently presents creation capabilities even when its lecturer tools are unavailable, a failed iframe load can remain on an indefinite spinner, and opening the assistant in a new tab silently starts a separate context-free conversation. These three issues make the product appear less dependable than its underlying proposal and confirmation design.

The recommended order is:

1. Add explicit loading recovery and capability availability states.
2. Make the new-tab session boundary honest and predictable.
3. Complete German localization and keep Manage context visible throughout a conversation.
4. Refine compact-screen behavior, launcher clearance, resize affordances, and documentation provenance.

Durable chat history remains a separate product and data-retention decision. This roadmap does not depend on it.

## Scope and Evidence

### Review Questions

- Can lecturers find, open, close, reset, resize, and recover the assistant without losing control of Manage?
- Does the assistant preserve enough page and conversation context for follow-up instructions such as “fix this question” or “make it German”?
- Does question drafting lead to a reviewable signed proposal with options, correctness, and feedback before any write?
- Are unavailable tools, unsupported requests, errors, and loading states explained honestly?
- Does the interface communicate broader KlickerUZH documentation knowledge without overstating retrieval coverage?
- Does the integration remain understandable in English, German, desktop, and compact layouts?

### Evidence Matrix

| State | Viewport / locale | Evidence | Outcome |
| --- | --- | --- | --- |
| First embedded open | 1440 × 900 / EN | `01-desktop-panel-open.png` | Spinner appears immediately; no timeout, retry, or failure state exists. |
| Standalone assistant | 1440 × 900 / EN | `02-desktop-standalone.png` | Opens as a clean assistant without the embedded Manage context or current conversation. |
| Draft request with lecturer tools unavailable | 1440 × 900 / EN | `03-generation-attempt.png`, `06-embedded-draft-result.png`, `07-embedded-draft-top.png` | Assistant falls back to prose after presenting draft creation as available. |
| Closed launcher and question-pool end | 1440 × 900 / EN | `04-desktop-launcher-closed.png` | Launcher is correctly bottom-right; duplicated bottom clearance wastes list space. |
| Embedded welcome and page coexistence | 1440 × 900 / EN | `05-desktop-panel-welcome.png` | Manage remains usable and the initial page context is visible. |
| Reset confirmation | 1440 × 900 / EN | `08-reset-confirmation.png` | Inline two-step confirmation safely clears the conversation without a reload. |
| Closed compact launcher | 390 × 844 / EN | `10-compact-launcher-closed.png` | Launcher remains discoverable and clear of the main content. |
| Open compact dock | 390 × 844 / EN | `11-compact-panel-open.png` | The dock uses 85dvh but leaves active Manage controls exposed above it. |
| German compact dock | 390 × 844 / DE | `12-compact-german.png` | Capability copy is German, while context and starters remain English. |
| Keyboard/pointer resize | 1440 × 900 / EN | `13-desktop-resized-panel.png` | Resize works and persists across close/open. |
| Maximum desktop size | 1440 × 900 / EN | `14-desktop-max-panel.png` | The container grows, but the conversation layout does not use the additional space well. |
| Signed proposal, revision, and confirmation | Desktop / EN and DE | Code, prior CI, and docs only | Live proof was blocked because the reduced local profile omitted the lecturer MCP service. Treat this flow as exercised but not live-verified in this audit. |

Screenshots are local, uncommitted audit artifacts in `/private/tmp/klicker-manage-assistant-ux-audit-902af183d`. `09-embedded-signed-proposal.png` is invalid because the browser session crashed and is excluded from evidence.

## Delta From Prior Work

This review extends rather than duplicates the following work:

- [PR #5109 assistant production-readiness plan](./2026-07-23-pr-5109-assistant-production-readiness-plan.md)
- [Manage assistant follow-up roadmap](./2026-07-27-manage-assistant-followup-roadmap.md)
- [PR #5624 session UX plan](./2026-08-27-pr-5624-manage-assistant-session-ux-plan.md)
- [PR #5109 production-readiness review](./2026-07-07-pr-5109-production-readiness-review.md)
- [PR #5109 verification and extension plan](./2026-07-26-pr-5109-verification-and-extension-plan.md)

### Fixed and Confirmed in the Current Browser Pass

- PR #5637 snapshot `902af183d`: the launcher is labelled and restored to the
  bottom-right corner.
- PR #5624 head `ffd1775af`: desktop use is non-modal; first open shows a
  spinner; pointer and keyboard resizing work and persist; reset uses a
  two-step confirmation; English and German capability copy explains that the
  assistant knows more than the visible examples.

### Still Open or Only Partially Addressed

- PR #5624 head `ffd1775af` and prior exact-head CI cover full signed-proposal
  previews with options, explicit correctness, and feedback, but the current
  browser pass could not reverify the proposal, revision, and confirmation
  journey because the focused runtime omitted lecturer MCP.
- P9 from the 2026-07-27 follow-up roadmap is partial: German covers the
  capability explainer and proposal preview, but not starter prompts, Manage
  context labels, or proposal-card actions and status messages.
- The static documentation navigator is implemented; deterministic docs search
  from the retrieval plan remains open.
- Durable chat history remains intentionally separate under RD4.

### Ruled Decisions Not Reopened

- **RD1 — Desktop composition:** keep the assistant non-modal so Manage remains
  usable beside it.
- **RD2 — Write authority:** keep all writes behind explicit signed-proposal
  confirmation.
- **RD3 — Unsupported work:** keep unsupported or read-only work conversational
  rather than silently mutating Manage.
- **RD4 — Retention boundary:** do not add durable history in this package.

## Findings Register

Severity uses the standard UX scale: 0 is not a problem, 1 is cosmetic, 2 is a minor usability problem, 3 is a major usability problem, and 4 is a usability catastrophe.

### Major Findings

| ID | Severity | Finding | Evidence and code anchor | Heuristic | Recommended correction |
| --- | ---: | --- | --- | --- | --- |
| F1 | 3 | **The session boundary is invisible.** “Open in new tab” looks like an enlargement of the current assistant, but it launches a clean non-embedded URL without the current Manage context or conversation. Reloading also starts a fresh runtime. | `02-desktop-standalone.png` versus `05-desktop-panel-welcome.png`; [ManageAssistantWidget.tsx:93](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L93), [ManageAssistantWidget.tsx:404](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L404), [useEmbeddedManageContext.ts:27](../apps/chat/src/hooks/useEmbeddedManageContext.ts#L27), [chat-platform.md:160](../docs/chat-platform.md#L160) | Consistency; user control; visibility of system status | For the immediate release, relabel the action as starting a new assistant tab and warn when it will start a new conversation. Disable or remove it after the first message if that distinction cannot be made clear. Later, add a secure one-time handoff if preserving the in-session thread is valuable. |
| F2 | 3 | **The welcome state promises actions that may be unavailable.** Draft creation and related starters remain active when the lecturer MCP client cannot load. The user only discovers the limitation after waiting for a prose response. | `03-generation-attempt.png`, `06-embedded-draft-result.png`; [manage-assistant.tsx:44](../apps/chat/src/components/manage-assistant.tsx#L44), [route.ts:154](../apps/chat/src/app/api/manage/chat/route.ts#L154), [route.ts:193](../apps/chat/src/app/api/manage/chat/route.ts#L193) | Visibility of system status; error prevention; match with the real system | Bootstrap a small authenticated capability state. Disable or relabel write starters when proposal tools are unavailable, show a compact degraded-mode notice, and provide retry. Keep documentation and feedback actions available. |
| F5 | 3 | **First-load failure has no recovery path.** A spinner exists, but the parent has no timeout, iframe error state, retry action, or link to open a working fallback. A cold or failed Chat route can therefore spin indefinitely. | `01-desktop-panel-open.png`; [ManageAssistantWidget.tsx:424](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L424) | Visibility of system status; help users recover from errors | Add a bounded loading deadline, an error state with retry, and a diagnostic-safe fallback link. Prewarm only if measurement shows the cold start warrants it. |

### Minor Findings

| ID | Severity | Finding | Evidence and code anchor | Heuristic | Recommended correction |
| --- | ---: | --- | --- | --- | --- |
| F3 | 2 | **German switches back to English in important interaction text.** Context labels, all starter labels and prompts, and proposal-card status, actions, and errors are hardcoded English. | `12-compact-german.png`; [manageSuggestions.ts:9](../apps/chat/src/lib/config/manageSuggestions.ts#L9), [manageContext.ts:98](../apps/chat/src/services/manageContext.ts#L98), [manage-proposal-card.tsx:64](../apps/chat/src/components/manage-proposal-card.tsx#L64) | Consistency; match between system and users' language | Move starters, surface labels, proposal actions, status, and errors into the existing i18n namespaces. Verify complete EN and DE journeys, not only the welcome screen. |
| F4 | 2 | **The launcher reserves too much space even when closed.** Global `pb-24` and question-pool `mb-20/md:mb-24` stack into a large blank strip near the footer, reducing the number of visible questions. | `04-desktop-launcher-closed.png`; [Layout.tsx:85](../apps/frontend-manage/src/components/Layout.tsx#L85), [index.tsx:460](../apps/frontend-manage/src/pages/index.tsx#L460) | Aesthetic and minimalist design; efficient use of space | Remove duplicated global clearance. Reserve only the collision area needed by the visible launcher, preferably at the last local control rather than every Manage page. |
| F6 | 2 | **The compact dock is neither safely full-screen nor meaningfully side-by-side.** It consumes 85dvh, cannot be resized or minimized, yet leaves active Manage controls visible above it. | `11-compact-panel-open.png`, `12-compact-german.png`; [ManageAssistantWidget.tsx:354](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L354), [ManageAssistantWidget.tsx:371](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L371) | Error prevention; user control; responsive composition | Treat compact mode as a full-height sheet with explicit close/minimize, or provide stable snap states. Avoid a narrow band of accidentally active background controls. |
| F7 | 2 | **Manage context disappears after the welcome state.** The initial “Question pool” label lives inside the empty-thread view, so it vanishes after the first message even while the user can navigate behind the dock. References such as “this question” can become ambiguous. | `05-desktop-panel-welcome.png` versus `06-embedded-draft-result.png`; [thread.tsx:594](../apps/chat/src/components/thread.tsx#L594), [ManageAssistantWidget.tsx:393](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L393) | Visibility of system status; recognition rather than recall; error prevention | Keep a small persistent context chip in the dock header. Announce context changes, and let the lecturer return to or pin the referenced Manage object when the context is object-specific. |
| F8 | 2 | **Successful creation lacks a direct next action.** The proposal card and toast show the created draft name or ID but no “Open draft” action, forcing the lecturer to locate it manually in the pool. `(code)` | [manage-proposal-card.tsx:193](../apps/chat/src/components/manage-proposal-card.tsx#L193), [ManageAssistantWidget.tsx:285](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L285) | Visibility of system status; flexibility and efficiency | Return the Manage deep link with the confirmation result and offer “Open draft” in the card and toast. Preserve the current refetch so the list also updates. |
| F9 | 2 | **Resizing scales the container more than the information design.** The 28px resize target is small, and the maximum dock leaves a large blank canvas with narrow centred content and overly wide starter buttons. | `05-desktop-panel-welcome.png`, `14-desktop-max-panel.png`; [ManageAssistantWidget.tsx:371](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L371), [manageAssistantPanelSize.ts:11](../apps/frontend-manage/src/components/assistant/manageAssistantPanelSize.ts#L11), [thread.tsx:330](../apps/chat/src/components/thread.tsx#L330) | Flexibility and efficiency; visual hierarchy | Increase the resize target to at least 44px, add default/fit/maximize presets, and make content width or starter layout respond to wider dock sizes. |
| F10 | 2 | **Documentation knowledge is described more broadly than it is retrieved.** The assistant has a useful curated index, but it is not yet deterministic search over the documentation corpus and exposes no source-scope or freshness cue. `(code)` | [manageAssistantSkills.ts:27](../apps/chat/src/services/manageAssistantSkills.ts#L27), [PLAN-manage-docs-skills-rag.md:22](./plans_wip/PLAN-manage-docs-skills-rag.md#L22) | Match between system and real world; help and documentation; trust | Explain that the assistant uses a curated KlickerUZH docs index and link sources in answers. Implement the planned deterministic docs manifest/search before promising broader retrieval. |

No severity-4 catastrophe was found. No additional severity-1-only cosmetic finding is retained because each observed craft issue either contributes to F3, F4, F6, or F9 or is too small to justify roadmap work.

## Strengths to Preserve

- The labelled bottom-right launcher is discoverable without dominating the page.
- Desktop interaction is genuinely non-modal; Manage stays interactive and exposed to assistive technology.
- Reset has a safe, in-context confirmation and does not require a page reload.
- Resize supports pointer and keyboard input, persists dimensions locally, and clamps them to the viewport.
- Signed proposals separate review from mutation and require explicit confirmation.
- Choice-question previews show every option, explicit correctness, and per-option feedback; free-text previews show sample solutions and limits.
- The context handshake sends a bounded, sanitized Manage context rather than exposing arbitrary parent-page state.

## Independent Scores

### Usability Heuristics: 6/10

The quick diagnostic has ten one-point questions. Eight pass. Two fail with major findings and each receives the maximum two-point deduction:

- Base score: `10`
- System status is not reliably visible: `−2` for F2 and F5
- Several interactions produce a “what just happened?” moment: `−2` for F1, supported by F3, F4, F6, F7, F9, and F10
- Final score: `10 − 2 − 2 = 6/10`

The largest usability gaps, in order, are F5, F2, F1, F7, F3, F4, F6, F8, F10, and F9.

**Band cross-check:** 6/10 falls in the rubric's 6–8 band, which expects several
major obstacles but a usable core. That agrees with three severity-3 findings,
no catastrophe, and a strong set of preserved controls.

**Gap to 10:** F5, F2, F1, F7, F3, F4, F6, F8, F10, then F9.

### Visual Craft: 8/10

The independent visual pass evaluates eight composition checks. Six pass: grayscale hierarchy, general whitespace, secondary-label emphasis, transcript text width, contrast, and restrained elevation. Two fail:

- Hierarchy does not adapt at large dock sizes: F9
- Spacing and responsive composition are inconsistent: F4, F6, and F9
- Final score: `round(6 ÷ 8 × 10) = 8/10`

The visual score is stronger than the usability score because the interface is clean and legible in its default state. The next craft gains come from responsive composition, not decorative polish.

**Band cross-check:** 8/10 matches a visually coherent default state with two
recurring composition failures rather than a broad hierarchy or polish problem.

**Gap to 10:** F9 first, then F4 and F6.

## Phased Roadmap

### Phase R0 — Make Availability and Session Boundaries Trustworthy

**Estimate:** 2–4 days if the focused local profile and existing tests are usable.

| Work item | Findings | Anchored fix sketch | Behavioral check |
| --- | --- | --- | --- |
| R0.1 Loading recovery | F5 | Add parent-owned loading, ready, timed-out/error, and retrying states around [ManageAssistantWidget.tsx:424](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L424). Preserve close and Escape in every state. | Simulate an unavailable Chat route. Verify status announcement, retry, close, and fallback at 1440 × 900 and 390 × 844. |
| R0.2 Capability-aware welcome | F2 | Expose bounded authenticated proposal-tool readiness to [manage-assistant.tsx:44](../apps/chat/src/components/manage-assistant.tsx#L44). Keep documentation/help available when [route.ts:154](../apps/chat/src/app/api/manage/chat/route.ts#L154) cannot load lecturer tools. | Start once with lecturer MCP healthy and once unavailable. Verify draft starters are enabled only when healthy and recovery needs no page reload. |
| R0.3 Honest new-tab behavior | F1 | Change copy and conditional behavior around [ManageAssistantWidget.tsx:93](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L93) before attempting cross-tab transfer. State that the action opens a new conversation without Manage context. | Start a conversation, activate the action, and verify the label or warning explicitly describes the fresh thread and absent page context. |
| R0.4 Focused runtime proof | Evidence gap | Extend [the target-branch profile resolver](https://github.com/uzh-bf/klicker-uzh/blob/84eebeb483f1a27b10d53f6c598ee3a48ae9f15a/util/profile-resolver.sh) and [runtime helper](../util/dev-runtime.sh) so combined `chat,manage` starts `@klicker-uzh/mcp-lecturer` and includes its readiness without changing the full profile or overloading the separate `mcp` fixture profile. | On the exact branch head with seeded data, complete draft → full proposal → German revision → confirmation → refreshed pool. |

### Phase R1 — Complete the Core Lecturer Workflow

**Estimate:** 1–3 days after R0.

| Work item | Findings | Anchored fix sketch | Behavioral check |
| --- | --- | --- | --- |
| R1.1 End-to-end localization | F3 | Move [manageSuggestions.ts:9](../apps/chat/src/lib/config/manageSuggestions.ts#L9), [manageContext.ts:98](../apps/chat/src/services/manageContext.ts#L98), and [manage-proposal-card.tsx:64](../apps/chat/src/components/manage-proposal-card.tsx#L64) into the existing message namespaces. | Run draft, revise, dismiss, error, and confirm journeys under `/en/` and `/de/`; no interaction copy changes language mid-flow. |
| R1.2 Persistent context | F7 | Move the context chip out of the empty-only content near [thread.tsx:594](../apps/chat/src/components/thread.tsx#L594) into persistent dock chrome, and announce context changes from the parent handshake. | Start on the question pool, send a message, navigate behind the dock, and verify context remains visible and changes are announced. |
| R1.3 Open the created draft | F8 | Add a safe Manage deep link to the success state at [manage-proposal-card.tsx:193](../apps/chat/src/components/manage-proposal-card.tsx#L193) and the parent toast flow at [ManageAssistantWidget.tsx:285](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L285). | Confirm a proposal and open the exact created draft from both card and toast without searching. |
| R1.4 Collision-safe launcher spacing | F4 | Replace global clearance at [Layout.tsx:85](../apps/frontend-manage/src/components/Layout.tsx#L85) and duplicate pool margin at [index.tsx:460](../apps/frontend-manage/src/pages/index.tsx#L460) with local collision-safe spacing. | Inspect list ends and primary actions on representative Manage pages with the dock closed and open; no control is covered and no large blank strip remains. |

### Phase R2 — Refine Responsive Composition and Documentation Trust

**Estimate:** 1–2 days after R1.

| Work item | Findings | Anchored fix sketch | Behavioral check |
| --- | --- | --- | --- |
| R2.1 Compact sheet behavior | F6 | Replace the compact 85dvh compromise at [ManageAssistantWidget.tsx:354](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L354) with an intentional full-height sheet or explicit snap states. | Verify 320px, 390px, and tablet widths with long proposals and the software keyboard; background controls cannot be activated accidentally. |
| R2.2 Resize presets and responsive content | F9 | Increase the handle at [ManageAssistantWidget.tsx:371](../apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx#L371), add default/fit/max presets, and adapt the content layout near [thread.tsx:330](../apps/chat/src/components/thread.tsx#L330) to wider sizes. | Verify a 44px target, keyboard operation, all presets, persisted size, and balanced starter/transcript layouts at default and maximum size. |
| R2.3 Documentation provenance | F10 | Update the capability copy and responses to describe the curated source at [manageAssistantSkills.ts:27](../apps/chat/src/services/manageAssistantSkills.ts#L27), with authoritative links and an honest no-exact-source fallback. | Ask representative “how do I?” questions and verify source links plus an honest fallback when the curated index has no exact result. |
| R2.4 Deterministic docs search | F10 | Implement the manifest-first design already scoped at [PLAN-manage-docs-skills-rag.md:22](./plans_wip/PLAN-manage-docs-skills-rag.md#L22) before adding vector retrieval. | Evaluate known-page, ambiguous, and no-result queries; return title, matched context, URL, and media where relevant. |

### Phase R3 — Validate With Lecturers

**Estimate:** Half to one day for five short sessions, excluding recruitment.

Run task-based sessions with three to five lecturers:

1. Draft a question from the question pool and inspect all feedback.
2. Revise it with a referential follow-up such as “make this German.”
3. Confirm it, open the created draft, and return to the assistant.
4. Reset and explain what “open in new tab” will do.
5. Recover from an unavailable assistant or unavailable proposal tool.

Record task completion, wrong turns, recovery, and confidence. Avoid collecting course content or personal data in telemetry or session notes.

## Explicitly Not in This Roadmap

- Durable lecturer chat history, thread lists, database models, or retention policy
- Autonomous publish, edit, archive, or destructive element actions
- Full vector RAG before deterministic docs search demonstrates a real coverage gap
- Production deployment, GitOps changes, or cluster operations
- Integrating `v3`, `v3-ai`, or any other upstream branch into the audit branch

## Verification Gate for Completion

The integration is ready for another production-readiness review when all of the following are true:

- The exact branch head passes focused checks and the relevant browser suite.
- Healthy and degraded capability states are both verified.
- The complete signed-proposal journey is shown live in EN and DE with seeded data.
- Loading failure, retry, reset, close, resize, compact behavior, and new-tab semantics are browser-verified.
- Every severity-3 finding is fixed or explicitly accepted by the product owner.
- The documentation capability copy matches the actual retrieval implementation.

## Environment Notes (Not App UX)

- The exact review snapshot could not acquire a new Docker network because the
  local address pool was exhausted. To avoid deleting unrelated networks, the
  browser pass used the existing owned assistant runtime at `ffd1775af` with
  the exact relevant assistant files overlaid from `902af183d`.
- The reduced `chat,manage` devrouter profile started API, Auth, Chat, and
  Manage but omitted `@klicker-uzh/mcp-lecturer`. Chat logged
  `ECONNREFUSED 127.0.0.1:7081` and continued without lecturer tools. This is a
  local profile and verification gap, not evidence that production proposal
  creation is broken. The deliberately supported toolless fallback remains
  valid evidence.
- The first cold Chat compilation took about 45 seconds. This exposes the need
  for an app-level timeout and retry but does not establish a production cold
  start duration.
- Before calling the complete creation flow live-verified, start lecturer MCP,
  include its readiness in the focused profile, and repeat draft, revision,
  confirmation, and created-draft navigation on the exact head with seeded
  synthetic data.
- The configured native final-reviewer role failed before launch because the
  runtime applied the GLM executor route with an unsupported effort. The final
  audit review therefore used the routing policy's one allowed
  `generic-continuity` fallback: read-only GPT-5.6 Sol at xhigh effort.
