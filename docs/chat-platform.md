---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-07-29'
tags:
  - frontend
  - chat
  - ai
---

# Chat Platform (`apps/chat`)

> **Migration in flight (2026-07):** the chat backend is slated to move to a Mastra-based `apps/chat-api` service (PR #5126, draft; tutor architecture in PR #5129). This page describes the current AI-SDK reality and stays authoritative until those PRs merge — but check their status before investing heavily in the route-handler/AI-SDK layer. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**This app is an island — do not apply the pages-router conventions here.** It is the only Next.js **app-router** app (port 3004), talks to the backend's Prisma models directly through its own API route handlers (no GraphQL ops), uses **zustand** for client state (nowhere else in the repo), and renders chat via **assistant-ui** (`@assistant-ui/react` + `react-ai-sdk`) over the Vercel AI SDK (`@ai-sdk/*`). Domain models live in `packages/prisma` `chat.prisma` (chatbots, threads, messages, credits as `Decimal(18,6)`).

The app runs Next.js 16 / React 19 and uses Turbopack for development, test, and production builds (`apps/chat/package.json:scripts`). Control, manage, and PWA production builds retain Webpack for service-worker compatibility. The chat production image copies the Next standalone server from `.next/standalone` and starts `apps/chat/server.js` (`apps/chat/Dockerfile`). Verify that path with a production build and container smoke test; a successful source build alone does not prove the runtime copy layout.

## Structure

- `src/app/api/chatbots/[chatbotId]/…` — route handlers (chat streaming, attachments, threads).
- `src/lib/server/` — server-only helpers: `apiGuards.ts`, `chatModelRegistry.ts`, `openaiResponsesOptions.ts`, `imagePreview.ts`.
- `src/stores/` — zustand: `chatStore`, `composerStore`, `settingsStore`.
- `src/components/thread.tsx` and `src/hooks/` — assistant-ui composition.
- Local model proxy: the `litellm` compose service (port 4000).

## Auth guard pattern (route handlers)

Three steps: `getParticipantId` → `getChatbotOr404` → `requireParticipation`. The composed helper `withChatbotAuth(req, chatbotId)` (`src/lib/server/apiGuards.ts`) covers the standard `{ courseId: true }` case — use it for new routes; fall back to the individual guards only for a custom chatbot `select`. Participant identity comes from the same participant JWT cookies as the PWA ([Auth Model](./auth-model.md)); local chat dev therefore needs the backend's `APP_SECRET` and `DATABASE_URL` visible to the chat app, or cookies won't verify and Prisma can't load chatbots.

The embedded lecturer assistant is a separate route family under `src/app/api/manage/`. It verifies the lecturer's NextAuth cookie, mints a short-lived internal bearer token for `apps/mcp-lecturer`, and confirms signed draft proposals through the authenticated chat route. This is an internal service exchange, not an OAuth client flow; the complete trust boundary is documented in [Auth Model](./auth-model.md#lecturer-mcp-and-manage-assistant).

The Manage chat route authenticates before admitting work, and applies its per-lecturer rate limit only after it acquires the pod's request slot; a busy rejection therefore does not consume the lecturer's rate budget. It is excluded from the Next middleware matcher so Next does not clone and truncate the body at its default 10 MiB buffer; the route therefore owns the full stream and enforces a 16 MiB serialized-body ceiling. Both declared and chunked oversized requests fail with a generic `413`, a body that exceeds the 30-second read deadline fails with a generic `408`, and malformed or structurally invalid requests retain the generic `400`. The request shape remains capped at 50 messages and also bounds aggregate parts, text, and individual encoded image/data parts before AI SDK conversion or MCP/model work.

After the resource checks, the route uses the AI SDK's message validator before opening the lecturer MCP client. Browser-supplied system messages, unsupported user parts, non-user files, malformed tool states, and invalid image base64 are rejected. Every accepted message is reconstructed from allowlisted fields, dropping browser-owned provider metadata and other extra fields. Previous assistant prose is retained for conversational continuity, but browser-supplied assistant tool, data, reasoning, and file parts are removed before model conversion; only tool results produced inside the current server-owned MCP loop reach the model as tool history. A total 60-second abort deadline covers body parsing, the MCP transport's actual composed fetch signal, model streaming, and the response-lifetime slot, because self-hosted Next does not itself enforce the route's exported `maxDuration`.

Inline base64 images make parsing memory-intensive. Only one Manage request per Chat pod may enter the body/model path at a time; an overlapping authenticated request receives a generic retryable `503` before its body is read. Staging and production therefore request 200 MiB and limit the Chat pod to 400 MiB: a production-standalone probe with ten concurrent 15.5 MiB requests peaked at 235 MiB, below the 280 MiB (70%) risk threshold, with one parsed request and nine pre-read rejections. The Manage composer accepts at most two 5 MiB images so its largest supported request fits the route envelope; participant chat intentionally retains its separate three-image limit.

## Model registry and credits

`chatModelRegistry.ts` loads `CHAT_MODEL_REGISTRY_JSON` (deployment override in `deploy/env-uzh-*/values.yaml`). Registry gotchas that have caused production incidents:

- Omitted `supportsImageAttachments` defaults to **false** — every image-capable model must set it explicitly in deployment values or the attach button disappears.
- Zero-credit course chatbots need a usable fallback model (`CHAT_FALLBACK_MODEL_ID`, default `gpt-4.1-mini`) AND explicit chatbot `allowedModelIds` must include it. Audit/fix with `packages/prisma-data/src/scripts/2026-06-15_ensure_chatbot_fallback_model.ts`.
- OpenAI Responses backends: keep `CHAT_OPENAI_STORE_RESPONSES=true` in shared/staged deployments — with `store: false`, LiteLLM/Azure can return "item not found" when a model references prior response items across tool-call steps. Local OpenRouter-style setups can leave it false.

Credit fields are Prisma `Decimal` — never truthy-check them ([Data & Migrations](./data-and-migrations.md)).

## Client-state gotchas

- **Zustand async actions must set fallback state in `catch`**, not just log — otherwise the UI hangs in loading state on network errors.
- **Edited-message image hydration** needs the persisted source message id (`attachmentSourceMessageId`) distinct from the fresh local message id (`src/hooks/useThreadManagement.ts`, `src/stores/chatStore.ts`).
- **`ComposerPrimitive.AttachmentDropzone` must wrap both normal and edit composer roots** — it owns the drag/drop capture that prevents native browser file navigation (`src/components/thread.tsx`).
- **Login redirects**: `src/app/noLogin/page.tsx` must pass an **absolute** chat URL as the PWA login `redirect_to`; a relative path makes the PWA redirect to its own domain and 404.
- **Embedded Manage modal**: the Manage launcher portals its dialog to `document.body` and makes `#__app` inert and hidden from assistive technology while open. Keep the portal outside `#__app`; otherwise the dialog would hide itself together with the background.

## Testing

Pure-logic vitest lives in `apps/chat/test/` (safe without services); `apps/chat/vitest.config.ts` mirrors the `@/*` alias from the app tsconfig — keep them in sync. E2E coverage is Playwright-only (`playwright/tests/Y-chat.spec.ts` — no Cypress counterpart).
