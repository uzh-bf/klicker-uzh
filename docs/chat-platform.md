---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-08-02'
tags:
  - frontend
  - chat
  - ai
---

# Chat Platform (`apps/chat`)

> **Migration in flight (2026-07):** the chat backend is slated to move to a Mastra-based `apps/chat-api` service (PR #5126, draft; tutor architecture in PR #5129). This page describes the current AI-SDK reality and stays authoritative until those PRs merge — but check their status before investing heavily in the route-handler/AI-SDK layer. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**This app is an island — do not apply the pages-router conventions here.** It is the only Next.js **app-router** app (port 3004), talks to the backend's Prisma models directly through its own API route handlers (no GraphQL ops), uses **zustand** for client state (nowhere else in the repo), and renders chat via **assistant-ui** (`@assistant-ui/react`) over the Vercel AI SDK (`@ai-sdk/*`). The current runtime keeps the app's `useChatResponse` transport adapter after the U5 `useAISDKRuntime` spike gate was not verifiable without a live model key. Domain models live in `packages/prisma` `chat.prisma` (chatbots, threads, messages, credits as `Decimal(18,6)`).

The app runs Next.js 16 / React 19 and uses Turbopack for development, test, and production builds (`apps/chat/package.json:scripts`). Control, manage, and PWA production builds retain Webpack for service-worker compatibility. The chat production image copies the Next standalone server from `.next/standalone` and starts `apps/chat/server.js` (`apps/chat/Dockerfile`). Verify that path with a production build and container smoke test; a successful source build alone does not prove the runtime copy layout.

## Structure

- `src/app/api/chatbots/[chatbotId]/…` — route handlers (chat streaming, attachments, threads).
- `src/lib/server/` — server-only helpers: auth/model configuration, image handling, telemetry, and sanitized assistant-message persistence.
- `src/stores/` — zustand: `chatStore`, `composerStore`, `settingsStore`.
- `src/components/thread.tsx`, `src/components/message-parts.tsx`, and `src/hooks/` — assistant-ui composition and transport.
- Local model proxy: the `litellm` compose service (port 4000).

## Auth guard pattern (route handlers)

Three steps: `getParticipantId` → `getChatbotOr404` → `requireParticipation`. The composed helper `withChatbotAuth(req, chatbotId)` (`src/lib/server/apiGuards.ts`) covers the standard `{ courseId: true }` case — use it for new routes; fall back to the individual guards only for a custom chatbot `select`. Participant identity comes from the same participant JWT cookies as the PWA ([Auth Model](./auth-model.md)); local chat dev therefore needs the backend's `APP_SECRET` and `DATABASE_URL` visible to the chat app, or cookies won't verify and Prisma can't load chatbots.

## Model registry and credits

`chatModelRegistry.ts` loads `CHAT_MODEL_REGISTRY_JSON` (deployment override in `deploy/env-uzh-*/values.yaml`). Registry gotchas that have caused production incidents:

The deployed Klicker Auto option is a LiteLLM `complexity-router` endpoint. Its
current PRD tier map is SIMPLE → GPT-5.6 Luna medium, MEDIUM/COMPLEX → Luna
xhigh, and REASONING → GPT-5.6 Sol low (`deploy/env-uzh-prd/values.yaml` and
the Klicker section of the AI deployment's `litellm/config.yaml`). The local
devcontainer mirrors that contract in `util/litellm/config.yaml` using the
generic `UPSTREAM_OPENAI_BASE_URL`/`UPSTREAM_OPENAI_API_KEY` boundary; it does
not copy production Azure URLs or secret names. The local chat registry maps
the user-facing `auto` model id to the `complexity-router` LiteLLM deployment
and exposes `gpt-5.6-luna` for a direct comparison. The seeded Benibot fixture
allows those two options while retaining `gpt-4.1-mini` as the fallback.

The local LiteLLM service uses the deployed semantic-router-compatible image
`ghcr.io/berriai/litellm-database:v1.88.1`, has a healthcheck, and is included
in `.devcontainer/devcontainer.json:runServices`. A model call still requires
the operator's local `UPSTREAM_OPENAI_API_KEY`; without it, verify service
health, model exposure, picker state, and request error handling, but do not
claim an end-to-end answer stream.

- Omitted `supportsImageAttachments` defaults to **false** — every image-capable model must set it explicitly in deployment values or the attach button disappears.
- Zero-credit course chatbots need a usable fallback model (`CHAT_FALLBACK_MODEL_ID`, default `gpt-4.1-mini`) AND explicit chatbot `allowedModelIds` must include it. Audit/fix with `packages/prisma-data/src/scripts/2026-06-15_ensure_chatbot_fallback_model.ts`.
- OpenAI Responses backends: keep `CHAT_OPENAI_STORE_RESPONSES=true` in shared/staged deployments — with `store: false`, LiteLLM/Azure can return "item not found" when a model references prior response items across tool-call steps. Local OpenRouter-style setups can leave it false.

Credit fields are Prisma `Decimal` — never truthy-check them ([Data & Migrations](./data-and-migrations.md)).
`src/stores/settingsStore.ts:loadCredits` clears `creditsLoaded` for every refresh and accepts
only the latest request generation, so a failed refresh or a late response from another
chatbot cannot expose stale credit/model state as current.

## Theming and design tokens

Chat carries the UZH brand through the shadcn semantic tokens in `src/app/globals.css` (`--primary` = `#0028a5` etc.), not through per-component colours. Two rules:

- **The light token block must be `:root:root`, not `:root`.** A dependency stylesheet (assistant-ui) defines the same shadcn tokens at plain `:root`, and its chunk loads _after_ `globals.css`, so an equal-specificity block silently loses the cascade and the brand colour never applies. Raising it to (0,2,0) outranks the dependency's (0,1,0).
- There is no dark mode: a latent `:root.dark` block plus its `@custom-variant dark` was removed (D1) because nothing in the app ever applied a `.dark` class, and the forced-on preview was half-broken anyway (sidebar/composer/footer stayed light; `--primary` fell back to shadcn's default gray instead of UZH blue). Wiring dark mode properly would be a separate feature with its own plan.
- Use the semantic tokens (`bg-muted`, `border-border`, `text-foreground`) rather than raw `gray-*`/`slate-*` utilities, or the surface stops following the theme. Note that `text-muted-foreground` on `bg-muted` computes to ≈4.4:1 — below the WCAG AA floor for body text; use `text-foreground` for text that sits on a muted surface.
- `@uzh-bf/design-system`'s `SidebarTrigger` and `SidebarRail` render a hardcoded English
  `sr-only` "Toggle Sidebar" label. Pass an explicit localized `aria-label`; it wins the
  accessible-name computation.
- The design system's `Select` renders a Radix `SelectTrigger` — a real `<button role="combobox">`, so a plain `<label htmlFor>` does name it. Without that, the combobox's accessible name is whatever value is currently selected, which leaves several selects on a panel indistinguishable. Pass `id` to `Select` (it forwards to the trigger) and point the visible label at it.
- Tooltips (`src/components/ui/tooltip.tsx`) are the neutral popover style — `bg-popover text-popover-foreground border shadow-md` — not inverted brand blue. Anything rendered _inside_ a tooltip must use foreground/muted-foreground tones; `text-primary-foreground/70`-style spans were readable on the old blue surface and invisible on the white one. The arrow's `border-b border-r` assumes `side="top"`, which is the only side the app uses.
- Hover states on saturated color surfaces must **darken**, not alpha-lighten: `hover:bg-destructive/90` drops white-on-red text below AA (~3.5:1), so the declined-screen button uses `hover:brightness-90` instead. Blue (`bg-primary`) tolerates `/90`; red does not.

## Runtime and student-visible states

The chat branch uses `@assistant-ui/react` 0.14's stable `GroupedParts` primitive. Local
composition lives in `src/components/message-parts.tsx:AssistantMessageParts`: adjacent
reasoning parts share one disclosure, adjacent tool calls share one group when there is more
than one, and a single tool call keeps its direct result disclosure. Reasoning auto-opens only
while active until the participant manually chooses an open state; that manual choice then wins.
The runtime's feedback adapter delegates votes to `src/stores/chatStore.ts:rateMessage`, while
the adapter maps the persisted `ChatMessage.rating` back into `metadata.submittedFeedback` so
votes survive store refreshes and reloads. AI SDK 7 powers the server route (`ai`,
`@ai-sdk/openai`, and `@ai-sdk/mcp`); `src/hooks/useChatResponse.ts` remains the client transport
because the spike-gated `useAISDKRuntime` replacement could not be live-verified without an LLM
key.

Initial thread and message loading uses skeleton rows and message-shaped placeholders, and an
empty running assistant message shows a localized thinking indicator. Send/stream failures,
disclaimer action failures, and thread-list failures are localized with retry affordances where
the action can be retried. Asynchronous disclaimer failures render in a live `role="alert"`
region. Stream/send errors inside a message render as a styled callout, not inline markdown:
`useChatResponse` pushes a `{ type: 'data', name: 'chat-error', data: { errorLabel, message } }`
content part (assistant-ui's official `DataMessagePart` shape) and `message-parts.tsx` renders it
as `ChatErrorPart` (`data-cy="chat-message-error"`). The convention is client-side only — data
parts never persist and `serializeMessageContent` excludes them from the model-visible history,
so an error label can never leak into a follow-up prompt. A `hasStreamError` guard keeps the
partial text from being re-pushed alongside the error part. Truncated responses append the
localized `chat.response.truncated` notice, and a failed image-attachment read surfaces the
typed `AttachmentAdapterError` from `imageAttachmentAdapter.ts` as a localized composer error
rather than a stringified `ProgressEvent`. A cached thread list intentionally remains visible if only its background refresh fails.
The welcome view contains localized starter suggestions, and message action bars remain mounted
for touch users rather than relying on hover. An unavailable image edit uses `aria-disabled`
instead of native `disabled`, so its explanatory Radix tooltip remains focusable. Each thread
row shows the thread's last chat mode as an icon plus localized label under the title
(`thread.lastChatMode` via `formatModeLabel`), and Markdown blockquotes in answers render as
amber info callouts (the `blockquote` override in `markdown-text.tsx`, which only assistant
messages render through — user text never gets the callout styling). A reply to an
image-bearing user turn carries a static "Image analyzed" / "Bild analysiert" chip
(`ImageAnalyzedChip` in `thread.tsx`, gated by the pure `parentMessageHasImageAttachment`
helper over the chatStore's loaded message list — the store, not the runtime message, because
the assistant-ui conversion moves `imageAttachments` into `metadata.custom`).

Assistant message persistence passes completed AI SDK steps through
`src/lib/server/persistedAssistantContent.ts:mapAssistantStepContent`. Successful text,
reasoning, tool arguments, and tool results remain intact. Both thrown `tool-error` parts and
MCP `tool-result` envelopes with `output.isError === true` persist only the generic
`Tool execution failed` result plus `isError: true`; never copy provider error messages or MCP
error bodies into `ChatMessage.content`. The live SSE path applies the same boundary through
`src/lib/toolOutput.ts:normalizeLiveToolOutput` before a result reaches `ToolFallback`.

The mobile layout exports `viewportFit: 'cover'`, reserves the bottom safe area for the
composer, wraps Markdown tables in horizontal scrolling, and makes the mode pills horizontally
scrollable. Embedded mode shows the loading state and compact credit/model information through
the shared settings components. Direct thread URL activation resynchronizes the thread's stored
chat mode once per activation, without overriding a mode manually chosen afterward.

## Sources and citations

An answer's sources are **derived from the message's own tool-call parts**, not carried in a
dedicated API field or database column ([ADR 0004](./adr/0004-chat-citations-from-tool-call-parts.md)).
`src/lib/sources/normalizeSources.ts` is the single seam: everything downstream — the source
cards, the inline `[n]` chips, the friendly activity chip, and the server-side prompt contract —
keys off the same `isDocQueryToolName` predicate, so a tool the predicate misses silently loses
all four at once.

That predicate must tolerate MCP namespacing. `toSafeToolName` (`src/services/mcpClients.ts`)
prefixes the server name and appends **8 hex characters of a sha256** when the namespaced name
exceeds 64 characters or collides with another server's, so the same logical tool can arrive as
`doc_query`, `KB_doc_query`, or `KB_doc_query_1a2b3c4d`. A chatbot with two RAG servers is the
realistic trigger. The suffix length lives in `lib/config/toolNames.ts` and is imported by both
the side that builds the name and the regex that matches it, so bumping it cannot silently break
recognition — `mcpClients.ts` is `'use server'` and therefore cannot export the constant itself.

One known edge, not currently handled: `withHashSuffix` truncates the whole `server_tool` string
to 55 characters **from the end** before appending the hash. A server name longer than about 45
characters pushes `doc_query` out of the kept prefix entirely, and the predicate then matches
nothing — sources, citations, the activity chip and the prompt contract all switch off silently
for that server. No such server name exists today; fix by truncating the server name rather than
the combined string if one ever appears.

`normalizeSourcesFromParts` is deliberately forgiving and never throws: it unwraps the raw MCP
`CallToolResult` envelope (`{ content: [{ type: 'text', text: '<json>' }] }`), a JSON string, or
an already-parsed object; it treats the pipeline's literal `"N/A"` as absent; it dedupes by
file/page/url and numbers what survives **1..N in first-appearance order across every doc_query
call in one message**, capped at `MAX_SOURCES`. Two rules follow from that numbering and are easy
to break independently:

- `resolveCitationSource` resolves `[n]` only for `1 <= n <= N`. Anything outside that range stays
  literal text in the answer — which is the intended failure mode, not a bug.
- A source returned again by a later search keeps its original number; no second index is ever
  minted. `src/lib/server/citationInstructions.ts` therefore tells the model to **reuse** a repeat
  source's number rather than keep counting, or a multi-search answer emits `[4]` when only three
  unique sources exist. That contract is appended to the system prompt only when a doc_query-style
  tool is actually available for the request.
- **Model compliance with the citation contract is unverified.** Prompt assembly is unit-tested;
  whether a given model honours it needs a live model key, which the devcontainer does not carry.

On the render side, `remarkCitationMarkers` rewrites `[n]` in markdown **text** nodes into
`#cite-n` links, skipping anything inside a link label (including nested emphasis), and
`markdown-text.tsx` intercepts those in its `a` override to render `CitationChip`. Normalization
runs once per message in `AssistantMessage` (`useMessageSources`) and reaches both the cards and
the chips through `MessageSourcesContext` — do not re-parse the tool JSON in a leaf component.

A chip must wrap **with** the word it cites, never start a line on its own — and the
punctuation after it must not wrap alone either. Two mechanisms enforce that and both are
needed: `splitCitationMarkers` strips spaces/tabs directly before a marker (newlines survive —
a soft break is content), and `CitationChip` emits a U+2060 WORD JOINER on **both** sides of
the chip (`CITATION_CHIP_JOINER`, exported from `citation-chip.tsx`), because an atomic inline
like the chip's button is a legal break point under UAX #14 even with no whitespace around it.
LB11 makes the joiner glue only what is immediately adjacent — it cannot reach past a space
(LB18 still allows the break after a space), so a symmetric joiner welds `word[1].` into one
unit and adjacent chip runs like `[1][2]` into another, while normal inter-word wrapping stays
untouched. The string-level contract is pinned by `test/citation-chip.test.ts`; removing either
mechanism reintroduces orphaned chips or lone trailing periods at narrow widths.

The line under a source's name is per-type, chosen by `getSourceSecondaryLine` in
`src/lib/sources/sourceDisplay.ts` and shared by the card and the citation hover preview:
documents lead with the page (`p. 12` / `S. 12`, plus the publisher's own label when distinct)
and fall back to a cleaned display URL when they carry no page; web links always lead with the
display URL (host kept visible, scheme/`www.`/trailing slash stripped, middle-truncated); videos
lead with a `12:34`-style position; images keep their type label. **doc_query has no timestamp
field** — its source shape is `source_url`/`source_type`/`file_name`/`page_number`/
`labeled_page_number` — so a video position can only come from a clock- or `1m30s`-valued
`labeled_page_number` or from a `t`/`start`/`time_continue`/`#t=` parameter on the source URL
(`getSourceTimestamp`). A bare numeric `labeled_page_number` remains a publisher page label,
never seconds; bare seconds are accepted only from URL time parameters, where their meaning is
unambiguous. Other labels such as `Kapitel IV` also remain page text. A dedicated timestamp
field is phase-2 work in the doc-query service. Each card's index badge mirrors the inline chip —
a bare digit in a small `bg-primary/10` rounded square (`sources-section.tsx`), not a
zero-padded `01` — so the number on the card and the `[n]` in the answer read as the same
token. Card titles clamp at two lines with the
full name in the `title` attribute — and note that `line-clamp-2` needs `display: -webkit-box`,
so adding `block` alongside it silently disables the clamp. Document cards lay out with
`repeat(auto-fit, minmax(min(230px, 100%), 1fr))`: `auto-fit` (not `auto-fill`) collapses empty
tracks so fewer cards stretch across the whole row and only wrap when they genuinely no longer
fit, and the `min(230px, 100%)` floor keeps a track from forcing horizontal overflow in
containers narrower than 230px (embedded mode).

The activity chip's four states come from the pure `getDocQueryChipState` in `tool-fallback.tsx`.
"No results" is claimed only for a payload that actually **parsed**: a cancelled call leaves the
literal `'Loading...'` / `'Executing...'` placeholder from `src/hooks/useChatResponse.ts` behind as
its result, and labelling that as an empty search would be a lie.

Expanding the chip no longer dumps raw JSON for a successful doc_query: `getDocQueryPanelContent`
(same file, pure, tested in `test/tool-fallback-doc-query.test.ts`) yields a friendly panel — the
model's search query (parsed defensively from the possibly-streaming args JSON by
`parseDocQueryArgsQuery`) plus a "results appear as sources below" hint keyed on the parsed-`done`
state. The raw tool-name/args/result path is preserved wherever the friendly panel would lie or be
empty: non-doc_query tools, running/failed calls, unparseable results, and the doneEmpty +
unreadable-args combination (which would otherwise render a blank panel).

## Localization

Chat has no locale switcher: the locale comes from the `NEXT_LOCALE` cookie and falls back to `en`. It is resolved **directly in the chat-local `getRequestConfig`** (`src/types/i18n.ts`). Relying on `setRequestLocale`/`requestLocale` alone produces a split brain — `<html lang>` follows the cookie while server-side `getTranslations()` stays on the default locale. Messages come from the static `messagesByLocale` map exported there, which the root layout reuses: Turbopack cannot build a dynamic-import context for a bare package subpath (`import('@klicker-uzh/i18n/messages/' + locale)`), so the dynamic form silently resolves nothing in this app. Strings live in `packages/i18n/messages/{en,de}.ts`; `apps/chat/src/types/app.d.ts` enforces en/de key parity through a `DeepIntersection`, so a missing key fails `pnpm --filter @klicker-uzh/chat check` rather than at runtime. German addressed to students is informal (`Du`/`Dein`/`Dir`), instructors are "Dozierende", and Swiss `ss` is used instead of `ß`.

Model answers are held to the same orthography server-side: the chat route wraps every system
prompt in `withLanguageStyleContract` (`src/lib/server/languageInstructions.ts`) — unconditionally,
unlike the citation contract, because a lecturer's stored prompt replaces `DEFAULT_PROMPT`
entirely and a rule written only in the default text silently disappears the moment a custom
prompt is saved. The contract asks for Swiss High German ("ss" not "ß", real umlauts, never
ae/oe/ue). As with the citation contract, only prompt assembly is unit-tested; model compliance
needs a live key the devcontainer does not carry.

Two recurring traps in this app's strings:

- **Per-chatbot vocabulary is free-form**, so chat modes (`systemPrompts` keys) and reasoning efforts are `string`, not unions. Only the well-known values get a translation; anything else falls back to its raw name. `src/lib/config/modes.ts` holds the own-property known-mode predicate and `formatModeLabel` (used by the thread-list mode subtitle; unknown modes fall back to their capitalized raw name), while the older call sites still translate inline alongside their icon lookups; `src/lib/config/reasoning.ts` exports `formatReasoningEffort` outright, since its three call sites want nothing but the label and had already drifted apart once. The mode switcher's native tooltip uses the same localized label, never the English-only registry description. Either way, go through those modules so the selector and the caption under an answer cannot end up with different words for the same value.
- **ICU plurals must be selected on the displayed number.** `formatCredits(1.2)` renders `1` but `Intl.PluralRules.select(1.2)` is `other`, so passing the raw float prints "1 credits". Feed `count` the rounded value the user actually sees.

## Message feedback and Langfuse

Participants rate assistant answers through `ChatMessage.rating` (`ChatMessageRating` enum, nullable — null means no vote). `POST …/threads/[threadId]/messages/[messageId]/feedback` scopes its lookup by participant _and_ chatbot and reports someone else's message as 404, not 403, so the endpoint cannot be used to probe which message ids exist.

A failed rating request (`chatStore.rateMessage`) reverts the optimistic vote **silently** — no toast, no inline error. This is deliberate: `@uzh-bf/design-system` exports a `toast`/`Toaster` primitive used by `frontend-pwa`/`frontend-manage`, but `apps/chat` neither mounts a `<Toaster/>` nor imports `toast` anywhere, so wiring one in just for this rare, low-stakes failure was judged out of scope for a P3 polish pass. Revisit if a `<Toaster/>` provider gets added for another reason. Rapid votes are serialized per thread/message, not globally: `src/stores/ratingRequestCoordinator.ts` applies each choice optimistically, starts each request after the previous same-message request settles, and lets only the latest failed request roll the visible value back to the last confirmed database rating.

PostgreSQL is the only rating store. Do not mirror votes to Langfuse while the trace exporter is nonfunctional: scores would be orphaned, and exact retry/order semantics would require a durable outbox rather than request-route network calls. Add analytical mirroring only after the OpenTelemetry integration below is operational and the delivery lifecycle is designed.

> **Known gap:** `apps/chat` pins `@opentelemetry/sdk-trace-node@1.26.0` while `@langfuse/otel` needs 2.x, so span export throws and **no trace currently reaches Langfuse**. Rating-score mirroring is disabled until the OTel major bump lands.

## Client-state gotchas

- **Zustand async actions must set fallback state in `catch`**, not just log — otherwise the UI hangs in loading state on network errors.
- **Edited-message image hydration** needs the persisted source message id (`attachmentSourceMessageId`) distinct from the fresh local message id (`src/hooks/useThreadManagement.ts`, `src/stores/chatStore.ts`).
- **`ComposerPrimitive.AttachmentDropzone` must wrap both normal and edit composer roots** — it owns the drag/drop capture that prevents native browser file navigation (`src/components/thread.tsx`).
- **Login redirects**: `src/app/noLogin/page.tsx` must pass an **absolute** chat URL as the PWA login `redirect_to`; a relative path makes the PWA redirect to its own domain and 404.
- **Do not put user-facing English in the store.** `chatStore` maps the API's generic enrolment 403 to `null` so the notice component can render its localized default; substituting a readable English sentence in the store makes the translated fallback unreachable.
- **Thread-row edit/delete need the row active first on touch** (`thread-list.tsx`): the buttons are `hidden` and only reveal via `group-hover`/`group-focus-within`, which touch has neither of, so a touch user must tap the row (making it active, which also sets `inline-flex`) before the edit/delete buttons appear. Accepted friction, not a bug — leave as is.
- **Thread deletion is a two-step confirm on the same button** (`thread-list.tsx`): first click turns the trash icon into a destructive-styled "Delete?" pill (aria-label switches to the confirm wording), second click deletes. The confirm state reverts on a 4s timeout, Escape, pointer leaving the row, focus leaving the row, or starting a rename — the state machine is the pure `transitionDeleteConfirm` in `thread-list-state.ts` so vitest can pin it without a DOM. `data-cy="chat-thread-delete-button"` stays on the button in both states.
- **Message edits must go through the edit composer's own send** — `messageRuntime.composer.send({ startRun: true })` in `thread.tsx:EditComposer`. The public `threadRuntime.append()` normalizes a `null` parentId to "last message in the current path" (vendor `toAppendMessage`), so submitting an edit through it turns a root-message edit into a brand-new turn instead of a sibling branch and the branch pager (`branch-picker.tsx`) never shows. `startRun: true` is required because the vendor's own change gate compares only composer text/attachments and cannot see the kept-original-attachment state this app tracks outside the composer; the app-side `canSubmit` is the real change gate.

## Testing

Pure-logic vitest lives in `apps/chat/test/` (safe without services); `apps/chat/vitest.config.ts` mirrors the `@/*` alias from the app tsconfig — keep them in sync. The runner is `environment: 'node'` with no jsdom/testing-library, so component behavior is tested by extracting the decision logic into pure modules next to the component (`message-parts-state.ts`, `thread-list-state.ts`) — follow that pattern rather than adding a DOM environment. The whole suite shares **one fork** (`singleFork: true`), so a `vi.stubGlobal` is process-global: the config sets `unstubGlobals: true`, but that only restores before each _test_ — the next file's module **import** still sees whatever the previous file's last test left stubbed (a leaked `window`/`URL` once broke zustand-persist feature detection and `new URL` in unrelated files, order-dependently). Any file stubbing environment-shaped globals (`window`, `URL`, `document`) must also clean up itself with `afterEach(() => vi.unstubAllGlobals())`. `message-parts.test.ts` owns disclosure-state rules, while `persisted-assistant-content.test.ts` owns the provider-error redaction boundary. E2E coverage is Playwright-only (`playwright/tests/Y-chat.spec.ts` — no Cypress counterpart).

The `Chatbot Source Citations` block in that spec exercises the citation pipeline against real persisted tool-call parts: card ordering and count, dedupe across two doc_query calls, a valid `[n]` rendering as a button while an out-of-range marker stays literal, click-scroll without navigation, all four activity-chip labels with their icon gating, the composer hint's standalone/embedded gate, and the message timestamp. Seed tool results in the raw MCP envelope shape (`result: { content: [{ type: 'text', text: '<json>' }], isError }`) — that is what production sends, and `convertApiMessageToMessage` hoists `isError` to the part. Put more than one tool-call part on a single message only when you mean to: `message-parts.tsx` wraps two or more adjacent ones in a collapsed group that a test must expand first.

The chat package uses Turbopack for development, test, and production builds
(`apps/chat/package.json:scripts`). For a production-readiness gate, run the package check,
the package Vitest suite, and the package production build in the worktree's devcontainer.
The live reasoning/tool/credit matrix additionally needs a configured model key; without one,
those checks remain an explicit environment-gated follow-up rather than an unverified claim.

> **Do not run `pnpm --filter @klicker-uzh/chat check` while the devcontainer dev stack is up.** `check` is `next typegen && tsc --noEmit`, and typegen rewrites the same `.next/` the running dev server owns: from the next `✓ Compiled` line onward every chat route returns a bare Next 404 with nothing in `/tmp/dev.log`, including routes that just served 200. It is not a code bug — restart with `devrouter ensure .` from the host. Typecheck before the browser pass, not during it.
