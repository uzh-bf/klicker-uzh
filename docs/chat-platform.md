---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-07-27'
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

## Scoped KB retrieval

The chat route derives the enabled knowledge-base id from the authenticated chatbot in PostgreSQL; it never accepts a client-supplied KB id. `src/services/mcpClients.ts` passes that id with the chatbot and session context only to the configured `KB` MCP server. Without an enabled binding, complete signer configuration, or the exact KB server, KB tools stay unavailable while other MCP servers continue to load.

`src/lib/server/docQueryScopeToken.ts:signDocQueryScopeToken` signs a five-minute ES256 token with `DOC_QUERY_SCOPE_PRIVATE_KEY`, `DOC_QUERY_SCOPE_KID`, `DOC_QUERY_SCOPE_ISSUER`, and `DOC_QUERY_SCOPE_AUDIENCE`. Claims bind `kb_id`, `chatbot_id`, session subject, and a unique `jti`; participant identity is intentionally absent. Scope-token requests carry only the bearer token and content type, never the legacy `Chatbot-ID` header. Existing participant-JWT MCP authentication is unchanged.

The assistant UI registers the retrieval card through `src/components/tools-ui/rag-tool-ui.tsx:RAGToolUI`. Its registration uses `src/services/mcpScope.ts:DOC_QUERY_TOOL_NAME` (`KB_doc_query`), matching the namespaced runtime tool name. The card is localized through `pwa.chatbot.retrieval` and renders only a generic failure state; raw retrieval-service errors must never reach participants.

## Testing

Pure-logic vitest lives in `apps/chat/test/` (safe without services); `apps/chat/vitest.config.ts` mirrors the `@/*` alias from the app tsconfig — keep them in sync. E2E coverage is Playwright-only (`playwright/tests/Y-chat.spec.ts` — no Cypress counterpart).
