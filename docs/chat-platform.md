---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-07-24'
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
- `src/lib/server/` — server-only helpers: `apiGuards.ts`, `chatModelRegistry.ts`, `openaiResponsesOptions.ts`, `imagePreview.ts`.
- `src/stores/` — zustand: `chatStore`, `composerStore`, `settingsStore`.
- `src/components/thread.tsx` and `src/hooks/` — assistant-ui composition.
- Local model proxy: the `litellm` compose service (port 4000).

## Auth guard pattern (route handlers)

Three steps: `getParticipantId` → `getChatbotOr404` → `requireParticipation`. The composed helper `withChatbotAuth(req, chatbotId)` (`src/lib/server/apiGuards.ts`) covers the standard `{ courseId: true }` case — use it for new routes; fall back to the individual guards only for a custom chatbot `select`. Participant identity comes from the same participant JWT cookies as the PWA ([Auth Model](./auth-model.md)); local chat dev therefore needs the backend's `APP_SECRET` and `DATABASE_URL` visible to the chat app, or cookies won't verify and Prisma can't load chatbots.

## Model registry and credits

`chatModelRegistry.ts` loads `CHAT_MODEL_REGISTRY_JSON` (deployment override in `deploy/env-uzh-*/values.yaml`). Registry gotchas that have caused production incidents:

- Omitted `supportsImageAttachments` defaults to **false** — every image-capable model must set it explicitly in deployment values or the attach button disappears.
- Zero-credit course chatbots need a usable fallback model (`CHAT_FALLBACK_MODEL_ID`, default `gpt-4.1-mini`) AND explicit chatbot `allowedModelIds` must include it. Audit/fix with `packages/prisma-data/src/scripts/2026-06-15_ensure_chatbot_fallback_model.ts`.
- OpenAI Responses backends: keep `CHAT_OPENAI_STORE_RESPONSES=true` in shared/staged deployments — with `store: false`, LiteLLM/Azure can return "item not found" when a model references prior response items across tool-call steps. Local OpenRouter-style setups can leave it false.

Credit fields are Prisma `Decimal` — never truthy-check them ([Data & Migrations](./data-and-migrations.md)).

## Theming and design tokens

Chat carries the UZH brand through the shadcn semantic tokens in `src/app/globals.css` (`--primary` = `#0028a5` etc.), not through per-component colours. Two rules:

- **The light token block must be `:root:root`, not `:root`.** A dependency stylesheet (assistant-ui) defines the same shadcn tokens at plain `:root`, and its chunk loads _after_ `globals.css`, so an equal-specificity block silently loses the cascade and the brand colour never applies. Raising it to (0,2,0) outranks the dependency's (0,1,0).
- There is no dark mode: a latent `:root.dark` block plus its `@custom-variant dark` was removed (D1) because nothing in the app ever applied a `.dark` class, and the forced-on preview was half-broken anyway (sidebar/composer/footer stayed light; `--primary` fell back to shadcn's default gray instead of UZH blue). Wiring dark mode properly would be a separate feature with its own plan.
- Use the semantic tokens (`bg-muted`, `border-border`, `text-foreground`) rather than raw `gray-*`/`slate-*` utilities, or the surface stops following the theme. Note that `text-muted-foreground` on `bg-muted` computes to ≈4.4:1 — below the WCAG AA floor for body text; use `text-foreground` for text that sits on a muted surface.
- `@uzh-bf/design-system`'s `SidebarTrigger` and `SidebarRail` render a hardcoded English
  `sr-only` "Toggle Sidebar" label. Pass an explicit localized `aria-label`; it wins the
  accessible-name computation.
- The design system's `Select` renders a Radix `SelectTrigger` — a real `<button role="combobox">`, so a plain `<label htmlFor>` does name it. Without that, the combobox's accessible name is whatever value is currently selected, which leaves several selects on a panel indistinguishable. Pass `id` to `Select` (it forwards to the trigger) and point the visible label at it.

## Runtime and student-visible states

The chat branch uses `@assistant-ui/react` 0.14's stable `GroupedParts` primitive and local
`Reasoning*`/`ToolGroup*` composition in `src/components/thread.tsx`. The runtime's feedback
adapter delegates votes to `src/stores/chatStore.ts:rateMessage`, while the adapter maps the
persisted `ChatMessage.rating` back into `metadata.submittedFeedback` so votes survive store
refreshes and reloads. AI SDK 7 powers the server route (`ai`, `@ai-sdk/openai`, and
`@ai-sdk/mcp`); `src/hooks/useChatResponse.ts` remains the client transport because the
spike-gated `useAISDKRuntime` replacement could not be live-verified without an LLM key.

Initial thread and message loading uses skeleton rows and message-shaped placeholders, and an
empty running assistant message shows a localized thinking indicator. Send/stream failures,
disclaimer action failures, and thread-list failures are localized with retry affordances where
the action can be retried. A cached thread list intentionally remains visible if only its
background refresh fails. The welcome view contains localized starter suggestions, and
message action bars remain mounted for touch users rather than relying on hover.

The mobile layout exports `viewportFit: 'cover'`, reserves the bottom safe area for the
composer, wraps Markdown tables in horizontal scrolling, and makes the mode pills horizontally
scrollable. Embedded mode shows the loading state and compact credit/model information through
the shared settings components. Direct thread URL activation resynchronizes the thread's stored
chat mode once per activation, without overriding a mode manually chosen afterward.

## Localization

Chat has no locale switcher: the locale comes from the `NEXT_LOCALE` cookie and falls back to `en`. It is resolved **directly in the chat-local `getRequestConfig`** (`src/types/i18n.ts`). Relying on `setRequestLocale`/`requestLocale` alone produces a split brain — `<html lang>` follows the cookie while server-side `getTranslations()` stays on the default locale. Strings live in `packages/i18n/messages/{en,de}.ts`; `apps/chat/src/types/app.d.ts` enforces en/de key parity through a `DeepIntersection`, so a missing key fails `pnpm --filter @klicker-uzh/chat check` rather than at runtime. German addressed to students is informal (`Du`/`Dein`/`Dir`), instructors are "Dozierende", and Swiss `ss` is used instead of `ß`.

Two recurring traps in this app's strings:

- **Per-chatbot vocabulary is free-form**, so chat modes (`systemPrompts` keys) and reasoning efforts are `string`, not unions. Only the well-known values get a translation; anything else falls back to its raw name. `src/lib/config/modes.ts` holds the known-mode predicate (its two call sites translate inline, because each also needs the mode's icon); `src/lib/config/reasoning.ts` exports `formatReasoningEffort` outright, since its three call sites want nothing but the label and had already drifted apart once. Either way, go through those modules so the selector and the caption under an answer cannot end up with different words for the same value.
- **ICU plurals must be selected on the displayed number.** `formatCredits(1.2)` renders `1` but `Intl.PluralRules.select(1.2)` is `other`, so passing the raw float prints "1 credits". Feed `count` the rounded value the user actually sees.

## Message feedback and Langfuse

Participants rate assistant answers through `ChatMessage.rating` (`ChatMessageRating` enum, nullable — null means no vote). `POST …/threads/[threadId]/messages/[messageId]/feedback` scopes its lookup by participant _and_ chatbot and reports someone else's message as 404, not 403, so the endpoint cannot be used to probe which message ids exist.

A failed rating request (`chatStore.rateMessage`) reverts the optimistic vote **silently** — no toast, no inline error. This is deliberate: `@uzh-bf/design-system` exports a `toast`/`Toaster` primitive used by `frontend-pwa`/`frontend-manage`, but `apps/chat` neither mounts a `<Toaster/>` nor imports `toast` anywhere, so wiring one in just for this rare, low-stakes failure was judged out of scope for a P3 polish pass. Revisit if a `<Toaster/>` provider gets added for another reason.

Each vote is mirrored to Langfuse as a score. **Langfuse v4 is OpenTelemetry-based**: a trace is addressed by its W3C trace id and the v3 `metadata.langfuseTraceId` convention is silently ignored. To reach a trace from a later, unrelated request, both sides derive the same id from the assistant message id with `createTraceId(messageId)` (`src/lib/server/langfuseTracing.ts`); the streaming route anchors the AI SDK's spans onto it via `startActiveObservation(..., { parentSpanContext })`. Scores go over `POST /api/public/scores` with HTTP Basic auth — no Langfuse client dependency — under a deterministic score id so a re-vote replaces rather than stacks, and a retracted vote issues the matching `DELETE`. Scoring honours the same `CHAT_ENABLE_AI_TELEMETRY` killswitch as the span processor; without it, a deployment with telemetry disabled writes scores against traces that were never emitted.

> **Known gap:** `apps/chat` pins `@opentelemetry/sdk-trace-node@1.26.0` while `@langfuse/otel` needs 2.x, so span export throws and **no trace currently reaches Langfuse**. The scores are written correctly but are orphaned until the OTel major bump lands.

## Client-state gotchas

- **Zustand async actions must set fallback state in `catch`**, not just log — otherwise the UI hangs in loading state on network errors.
- **Edited-message image hydration** needs the persisted source message id (`attachmentSourceMessageId`) distinct from the fresh local message id (`src/hooks/useThreadManagement.ts`, `src/stores/chatStore.ts`).
- **`ComposerPrimitive.AttachmentDropzone` must wrap both normal and edit composer roots** — it owns the drag/drop capture that prevents native browser file navigation (`src/components/thread.tsx`).
- **Login redirects**: `src/app/noLogin/page.tsx` must pass an **absolute** chat URL as the PWA login `redirect_to`; a relative path makes the PWA redirect to its own domain and 404.
- **Do not put user-facing English in the store.** `chatStore` maps the API's generic enrolment 403 to `null` so the notice component can render its localized default; substituting a readable English sentence in the store makes the translated fallback unreachable.
- **Thread-row edit/delete need the row active first on touch** (`thread-list.tsx`): the buttons are `hidden` and only reveal via `group-hover`/`group-focus-within`, which touch has neither of, so a touch user must tap the row (making it active, which also sets `inline-flex`) before the edit/delete buttons appear. Accepted friction, not a bug — leave as is.

## Testing

Pure-logic vitest lives in `apps/chat/test/` (safe without services); `apps/chat/vitest.config.ts` mirrors the `@/*` alias from the app tsconfig — keep them in sync. E2E coverage is Playwright-only (`playwright/tests/Y-chat.spec.ts` — no Cypress counterpart).

The chat package uses Turbopack for development, test, and production builds
(`apps/chat/package.json:scripts`). For a production-readiness gate, run the package check,
the package Vitest suite, and the package production build in the worktree's devcontainer.
The live reasoning/tool/credit matrix additionally needs a configured model key; without one,
those checks remain an explicit environment-gated follow-up rather than an unverified claim.

> **Do not run `pnpm --filter @klicker-uzh/chat check` while the devcontainer dev stack is up.** `check` is `next typegen && tsc --noEmit`, and typegen rewrites the same `.next/` the running dev server owns: from the next `✓ Compiled` line onward every chat route returns a bare Next 404 with nothing in `/tmp/dev.log`, including routes that just served 200. It is not a code bug — restart with `devrouter ensure .` from the host. Typecheck before the browser pass, not during it.
