# PLAN - PR 5126 Mastra Chat Simplification

## Identity

- Date: 2026-06-24
- Branch: `codex/mastra-chat-openrouter-smoke`
- Target: `v3`
- PR: #5126, draft, `feat(chat): add Mastra chat-api prototype and OpenRouter smoke`
- Path: `project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- Older context:
  - `project/plans_wip/2026-06-15-mastra-chat-integration-plan.md`
  - `project/plans_wip/PLAN-chat-mastra-next-steps.md`
  - `project/plans_future/2026-06-11-mastra-evaluation-report.md`
- Status: planning. No implementation in this commit.

## Goal

Replace old `apps/chat` API approach completely.

Final target:

- `apps/chat` = frontend-only Next App Router app.
- `apps/chat-api` = only chat backend.
- `apps/chat-api` uses Mastra internally.
- Browser talks directly to `chat-api`.
- Assistant UI runtime and frontend state stay frontend-owned.

## Non-Goals

- No old `streamText` fallback path.
- No Next API proxy as final architecture.
- No Mastra-specific frontend runtime protocol.
- No Mastra storage migration in this PR.
- No full memory/semantic recall/working memory migration in this PR.
- No broad UI redesign.

## Resolved Decisions

### Replace old backend

Decision:

- Delete `apps/chat/src/app/api/**` chat routes.
- Remove `apps/chat` Prisma/JWT/server ownership.
- Move all auth, bootstrap, threads, messages, attachments, disclaimer, credits, and chat streaming to `apps/chat-api`.

Why:

- Two backends create shallow seams and duplicate policy.
- User wants new `chat-api` to be Mastra path, not old approach plus flag.
- Direct API surface makes backend ownership clear.

### Keep assistant-ui runtime

Decision:

- Keep `useExternalStoreRuntime`.
- Keep `ExtendedThreadMessageLike` as frontend internal type.
- Keep Zustand thread store as assistant-ui state source.

Why:

- Current runtime owns branching, edit/reload/cancel, metadata, image attachments, hydration, and URL sync.
- Switching runtime while moving backend mixes risks.

### Wire protocol

Decision:

- Keep AI SDK v6 UI stream parts on wire.
- Mastra stays implementation detail inside `chat-api`.
- `chat-api` emits stream shape current parser already understands.

Required stream parts:

- `text-delta`
- `reasoning-delta`
- tool lifecycle parts
- early thread/message metadata before first generated token when a persisted thread is created
- `finish` metadata

Required finish metadata:

- `threadId`
- `finishReason`
- `chatMode`
- `modelId`
- `reasoningEffort`
- `reasoningContent`
- `creditsUsed`

Required contract test:

- Feed a representative `chat-api` stream into current parser expectations.
- Cover text, reasoning, tool call, truncation, finish metadata, early thread/message metadata, abort/no-finish, and unknown part behavior.
- Run this before deleting old Next API routes.

### Storage

Decision:

- Add internal `ConversationRepository` boundary in `apps/chat-api`.
- First implementation: Prisma over existing `ChatThread`, `ChatMessage`, `ChatAttachment`.
- Mastra storage = documented spike/follow-up, not this PR.

Why:

- Existing schema matches assistant-ui invariants.
- Mastra storage has real features, but migration needs proof.
- Repository boundary lets Mastra storage win later without blocking simplification.

Mastra storage spike gate:

- Caller-set thread/message IDs work.
- `resourceId = participantId` works.
- metadata covers `chatbotId`, `courseId`, mode/model/reasoning/credits, parent links.
- abort persistence and credit math stay correct.
- attachment sidecar stays clean.
- branch/edit/reload semantics survive, or product accepts linear mode.
- thread listing, pagination, metadata filtering, and performance are acceptable for current chat UX.
- backfill path clear.

### Collapse chat-engine

Decision:

- Remove `packages/chat-engine` as separate workspace package.
- Move modules into `apps/chat-api/src/mastra/*`.

Why:

- Only one consumer remains.
- Package seam is shallow after old route removal.
- Locality improves: Hono handler, agent, MCP, observability, persistence all live in one backend.

## Assistant-UI Constraints

These are hard constraints for implementation.

Current frontend facts:

- `RuntimeProvider` uses `useExternalStoreRuntime`.
- Runtime handlers: `onNew`, `onEdit`, `onReload`, `onCancel`.
- `convertMessage` maps custom metadata into assistant-ui `metadata.custom`.
- `useChatResponse` parses AI SDK UI stream parts manually.
- attachments use assistant-ui attachment adapter plus Klicker hydration.
- edited image hydration depends on `attachmentSourceMessageId`.
- `RAGToolUI` expects stable tool naming if re-enabled; fallback tool UI renders any tool name.

Required changes:

- Add `chatApiClient` with base URL config and `credentials: 'include'`.
- Keep DTO mappers in frontend. Do not leak Prisma or Mastra DB shapes.
- Preserve `ExtendedThreadMessageLike`.
- Preserve `onEdit`, `onReload`, `onCancel` behavior.
- Replace first-turn pre-create with draft-thread adoption.

Draft-thread adoption:

1. `New Chat` navigates to `/${chatbotId}` or resets local state. No empty thread API call.
2. `onNew` with no active persisted thread creates local draft thread ID.
3. frontend adds user message locally so `useExternalStoreRuntime` can render immediately.
4. frontend calls `POST /api/chatbots/:chatbotId/chat` on `chat-api` with `threadId: null`.
5. `chat-api` creates persisted thread and user message.
6. stream sends persisted `threadId` before first generated token.
7. frontend swaps draft ID to persisted ID immediately, updates URL to `/${chatbotId}/threads/${threadId}`, preserves messages/allMessages/isRunning.
8. later edit/reload/cancel use persisted thread ID.

Message ID rule:

- frontend-generated user message ID and `assistantMessageId` are canonical request IDs whenever valid.
- `chat-api` persists those IDs instead of minting replacements.
- if backend must replace an ID, stream sends an early ID map before edit/reload/attachment hydration can depend on it.
- no frontend/backend message-ID divergence is allowed because `attachmentSourceMessageId`, branch paths, edits, reloads, and hydration depend on stable IDs.

Race rule:

- While a draft thread is awaiting persisted ID, block a second `onNew` on that draft or queue it after adoption.
- `onEdit` and `onReload` require persisted thread ID.

## Target API Surface

Base URL:

- local: `https://chat-api.klicker.com` or configured dev URL
- prod: configured public chat-api host

Cross-origin requirements:

- frontend fetch uses `credentials: 'include'`
- Hono CORS uses explicit origin allowlist
- `Access-Control-Allow-Credentials: true`
- `Vary: Origin`
- preflight supported
- cookie flow relies on existing `participant_token` cookie domain/SameSite setup
- verify cookie attributes per env:
  - production/staging cross-origin: `SameSite=None`, `Secure`, correct domain
  - local direct HTTPS: same production-like behavior through Traefik
  - local HTTP fallback: document if unsupported for authenticated direct chat-api
- reject unsafe content types for state-changing endpoints.
- require a non-simple CSRF/client header on state-changing endpoints.
- prefer bootstrap-minted CSRF token if existing auth helpers support it; otherwise use strict origin allowlist plus required custom header as minimum.

Endpoints:

- `GET /health`
- `GET /api/chatbots/:chatbotId/bootstrap`
- `GET /api/chatbots/:chatbotId/threads`
- `POST /api/chatbots/:chatbotId/threads` only if explicit empty-thread creation remains needed after UX review
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages`
- `PUT /api/chatbots/:chatbotId/threads/:threadId/title`
- `DELETE /api/chatbots/:chatbotId/threads/:threadId`
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments`
- `GET /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/chat`

Bootstrap response owns:

- chatbot shell: `id`, `name`, `avatar`
- mode options
- model options
- selected/automatic model defaults
- credits
- disclaimer status
- thread list
- auth/participation state via `401`/`403`

## Internal Backend Modules

Target `apps/chat-api/src` shape:

- `index.ts`: Hono app wiring only.
- `http/cors.ts`: credentialed CORS policy.
- `http/errors.ts`: consistent error JSON.
- `auth/participant.ts`: cookie JWT verification.
- `auth/chatbotAuth.ts`: chatbot + course participation guard.
- `conversation/repository.ts`: interface.
- `conversation/prismaConversationRepository.ts`: first implementation.
- `conversation/dto.ts`: backend response DTOs.
- `conversation/bootstrap.ts`: bootstrap use case.
- `conversation/threads.ts`: thread/message/attachment use cases.
- `conversation/stream.ts`: chat stream use case.
- `mastra/agent.ts`: dynamic agent builder.
- `mastra/mcp.ts`: DB-driven MCP toolset.
- `mastra/guardrails.ts`: Mastra processors/guardrails.
- `mastra/observability.ts`: Mastra-native tracing wrapper.
- `services/credits.ts`: credit policy.
- `services/disclaimers.ts`: disclaimer policy.
- `services/images.ts`: preview/description pipeline.

Rule:

- Modules should be deep: own policy, hide framework details, keep handler thin.
- Avoid new package unless second real consumer appears.
- Every conversation repository method scopes by `participantId` and `chatbotId`.
- Missing ownership returns 404/403 without leaking whether another participant's thread/message exists.

## Slices

### Slice 0 - Plan Review Commit

Do:

- Write current plan.
- Review with Claude.
- Integrate accepted plan findings.
- Commit plan only.

Check:

- `git diff --check -- project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- plan file staged alone.

Commit:

- `docs(project): plan Mastra chat simplification`

### Slice 1 - Collapse Engine Into Chat API

Do:

- Move `packages/chat-engine/src/*` into `apps/chat-api/src/mastra/*`.
- Update imports.
- Remove `@klicker-uzh/chat-engine` dependency.
- Remove workspace package if no references remain.
- Keep exact Mastra versions pinned.

Check:

- `pnpm --filter @klicker-uzh/chat-api check`
- `pnpm --filter @klicker-uzh/chat-api build`
- `rg "@klicker-uzh/chat-engine|packages/chat-engine"`
- verify Turbo/package graph no longer references `@klicker-uzh/chat-engine`.
- verify Docker/build config does not reference deleted package paths.

Commit:

- `refactor(chat-api): inline Mastra engine`

### Slice 2 - Deepen Chat API Architecture

Do:

- Split large Hono handler into modules listed above.
- Add `ConversationRepository`.
- Implement `PrismaConversationRepository`.
- Keep endpoint behavior unchanged where possible.
- Keep smoke script working.

Check:

- `pnpm --filter @klicker-uzh/chat-api check`
- `pnpm --filter @klicker-uzh/chat-api build`
- existing OpenRouter smoke locally when secrets available.

Commit:

- `refactor(chat-api): deepen conversation modules`

### Slice 3 - Complete Chat API Surface

Do:

- Add bootstrap endpoint.
- Move threads/messages/title/delete/disclaimer/attachments routes from Next app into Hono.
- Add credentialed CORS.
- Add state-changing endpoint CSRF/client-header guard.
- Keep auth/participation/disclaimer semantics identical.
- Ensure first-turn `POST /chat` can accept `threadId: null`.
- Emit persisted `threadId` before first generated token.
- Preserve frontend-supplied user/assistant message IDs or emit an early ID map.
- Validate client-supplied message IDs for format, uniqueness, and thread ownership.
- Make first-turn create idempotent by client user message ID to avoid duplicate threads on retry after early failure.
- Scope every thread/message/title/delete/attachment query by `participantId` and `chatbotId`; ownership-or-404.
- Add rate/abuse guard appropriate for authenticated participant chat endpoints.
- Preserve abort persistence and credit decrement behavior for first Prisma repository implementation.
- Add stream-protocol compatibility test against current parser expectations.

Check:

- route-level smoke with cookie/auth fixture where feasible.
- CORS preflight from allowed and disallowed origins.
- state-changing request without required CSRF/client header rejected.
- same-course participant cannot read, update, delete, or hydrate another participant's thread/message/attachment.
- invalid, duplicate, or cross-thread client message IDs rejected.
- retry after thread-created-before-client-adoption does not create duplicate thread.
- basic rate/abuse limit path returns controlled error.
- abort before finish persists partial message and charges expected partial credits.
- stream contract test covers early metadata, text, reasoning, tools, finish, and no-finish abort.
- `pnpm --filter @klicker-uzh/chat-api check`
- `pnpm --filter @klicker-uzh/chat-api build`

Commit:

- `feat(chat-api): own chat conversation endpoints`

### Slice 4 - Make Apps Chat Frontend-Only

Do:

- Add `chatApiClient`.
- Move relative `/api` calls to chat-api base URL.
- Add `NEXT_PUBLIC_CHAT_API_URL` or existing equivalent frontend env.
- Add DTO mappers for bootstrap/thread/message/attachments.
- Remove Prisma/JWT/server deps from `apps/chat/package.json`.
- Replace server layout Prisma fetch with client bootstrap/provider state.
- Remove auth middleware or reduce to UI-only redirect behavior if still needed.
- Point frontend to `chat-api` first.
- Delete `apps/chat/src/app/api/**` only after direct `chat-api` calls pass typecheck, stream contract, and local browser validation.

Assistant-ui required work:

- Keep `useExternalStoreRuntime`.
- Implement draft-thread adoption.
- Update `useChatResponse` to handle early persisted `threadId`.
- Keep finish metadata for credits/model/mode/reasoning/truncation.
- Preserve frontend-supplied message IDs through request/response.
- Keep `attachmentSourceMessageId` hydration behavior.
- Keep edit/reload/cancel semantics.
- Block or queue second send while draft thread is adopting persisted ID.

Check:

- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/chat build`
- targeted chat tests.
- first message from empty route creates persisted thread and updates URL before finish.
- abort before finish does not orphan visible thread state.
- edit/reload after first turn still targets persisted IDs.
- image edit hydration still works with `attachmentSourceMessageId`.
- second send during draft adoption is blocked or queued deterministically.

Commit:

- `feat(chat): use chat-api directly`

### Slice 5 - Deployment And CI

Do:

- Add or complete chat-api deployment wiring.
- Add service/ingress/env/CORS values.
- Ensure `turbo.json` includes new env vars.
- Add per-env frontend chat-api base URL.
- Add per-env CORS origin allowlist.
- Confirm DNS/TLS/ingress host plan for `chat-api`.
- Confirm cookie domain/SameSite/Secure behavior per env.
- Update Docker/build graph after package removal.
- Keep GitHub OpenRouter smoke action.
- Avoid password-like placeholder secrets in workflow files.

Check:

- `pnpm -w format:check` for changed files if practical.
- chart/template render check if repo has a standard command.
- smoke action path still references real script.
- `turbo.json`, Dockerfiles, deploy charts, and package graph reference existing packages only.

Commit:

- `feat(chat-api): add deployment wiring`

### Slice 6 - Verification, Review, MR Update

Do:

- Run fastest meaningful checks first, broader checks after.
- Run real OpenRouter smoke with Infisical/OpenRouter when available.
- Run browser validation with `npx agent-browser` against local chat if dev env can run.
- Capture screenshots for UI-facing PR evidence.
- Run strict maintainability review.
- Run security review focused on auth/CORS/cookies/secrets.
- Update PR #5126 with whole-branch description.
- Keep rollback path clear until direct `chat-api` browser validation passes: old Next API route deletion must be last action in Slice 4, not first.

Check:

- `pnpm --filter @klicker-uzh/chat-api check`
- `pnpm --filter @klicker-uzh/chat-api build`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/chat build`
- `pnpm --filter @klicker-uzh/chat-api smoke:openrouter` with secrets
- browser screenshots if local dev env available
- CORS/cookie browser check through `https://chat.klicker.com` -> `https://chat-api.klicker.com`

Commit:

- final fixes only, conventional commit by scope.

## Review Requirements Per Slice

Each implementation slice:

- update Progress before work.
- implement smallest vertical path.
- verify.
- review with independent agent.
- simplify with separate pass.
- integrate accepted findings.
- verify again.
- commit slice only.

Final branch:

- strict code quality review.
- security review.
- PR body via MR/PR description workflow.

## Risks

### CORS and cookies

Risk:

- browser -> chat-api direct requests fail if credentials/CORS/cookie domain mismatched.
- `SameSite=None` plus credentialed direct API requests can create CSRF exposure if state-changing endpoints accept simple cross-site requests.

Handling:

- explicit origin allowlist.
- `credentials: 'include'`.
- local Traefik host mirrors production cookie domain.
- verify cookie attributes instead of assuming them.
- require custom CSRF/client header and reject unsafe content types.
- verify in browser.

### Draft thread adoption

Risk:

- assistant-ui runtime loses active messages when draft ID becomes persisted ID.
- stream abort before finish creates persisted backend thread but frontend never learns ID.

Handling:

- implement ID swap as store action.
- emit persisted ID early, before generated content.
- update URL as soon as persisted ID is known.
- keep active messages/allMessages/isRunning during swap.
- block or queue second send during adoption.

### Stream metadata

Risk:

- `threadId`/credits/model metadata missing or parsed too late.

Handling:

- add typed early metadata and finish metadata parser.
- update thread ID on early metadata.
- test first-turn send from no thread.
- add stream contract test before route deletion.

### Message ID divergence

Risk:

- backend replaces frontend message IDs, breaking branch paths, edit/reload, and image attachment hydration.

Handling:

- frontend-generated user ID and assistant ID are canonical where valid.
- backend persists caller IDs or emits early ID map.
- tests cover edit/reload and attachment hydration after first-turn adoption.

### IDOR on conversation resources

Risk:

- Course participation proves access to chatbot, not ownership of a specific thread/message/attachment.

Handling:

- all conversation repository queries include `participantId` and `chatbotId`.
- thread/message/attachment endpoints return ownership-or-404.
- tests cover same-course participant isolation.

### Abuse and replay

Risk:

- Authenticated participant can replay expensive chat requests or duplicate first-turn creates.

Handling:

- rate/abuse guard on chat endpoints.
- first-turn create idempotent by client user message ID.
- credits still enforced, but not treated as only abuse control.

### Tool naming

Risk:

- Mastra MCP tool names diverge from current `RAGToolUI` assumptions.

Handling:

- define one naming policy in `mastra/mcp.ts`.
- keep fallback tool UI working.
- re-enable specialized UI only after name contract confirmed.

### Storage migration pressure

Risk:

- repository seam becomes empty abstraction if Mastra storage never lands.

Handling:

- keep interface small and private to `apps/chat-api`.
- only methods needed by Hono routes.
- delete seam later if no second implementation emerges.

### Privacy and memory

Risk:

- Mastra memory/recall creates unreviewed student data surface.

Handling:

- no memory storage migration in this PR.
- storage spike requires privacy and data-deletion/export review.

## Progress

- 2026-06-24: Plan drafted from user decisions.
- 2026-06-24: Claude review returned `DONE_WITH_CONCERNS`.
- 2026-06-24: Accepted Claude findings into plan:
  - stream protocol compatibility gate.
  - cookie/CSRF/dev direct-origin section.
  - early persisted `threadId`, not finish-only.
  - message ID stability/reconcile rule.
  - route deletion gate and rollback sequencing.
  - deployment/CI graph details.
- 2026-06-24: Full revised Claude review returned `DONE_WITH_CONCERNS`, no critical findings, commit-ready after security additions.
- 2026-06-24: Accepted final Claude findings into plan:
  - participant ownership scoping / IDOR checks.
  - rate and abuse guard.
  - client message ID validation and idempotent first-turn retry.
  - draft adoption race check.
  - abort persistence and partial credit check.

## Claude Review

First review:

- Status: `DONE_WITH_CONCERNS`.
- Critical:
  - Missing stream-protocol compatibility gate.
  - Cross-origin cookie and CSRF assumptions too weak.
  - Finish-only `threadId` would orphan threads on abort.
- Important:
  - Message ID reconciliation unspecified.
  - PR scope large; delete old routes only after direct path verified.
  - Deployment/CI details under-specified.
- Minor:
  - Dev HTTPS/cookie story needed.
  - `POST /threads` contract conditional.
  - draft race on second send.
  - Mastra storage gate should include list/pagination/perf.

Accepted:

- All above plan-level fixes accepted.

Full revised review:

- Status: `DONE_WITH_CONCERNS`.
- Critical: none new.
- Important:
  - Add participant ownership scoping for all thread/message/attachment routes.
  - Add rate/abuse guard for public authenticated chat endpoints.
- Minor accepted:
  - Define client message ID validation.
  - Add first-turn retry idempotency.
  - Add draft race check.
  - Carry abort persistence/credit check into first Prisma implementation.
- Claude verdict: commit-ready as plan doc after the above security additions.
