# KlickerUZH Mastra Chat — Post-Prototype Engineering Plan

**Document status:** Engineering plan for work following the Mastra prototype GO decision on Scope A+ (see `prototype/mastra-chat/RESULTS.md` and `project/plans_future/2026-06-11-mastra-evaluation-report.md` §12).
**Prepared:** 2026-06-14.
**Prototype branch:** `feat/chat-mastra-prototype`.
**Grounding:** Every claim below was checked against the real codebase on this branch; an adversarial review pass corrected several first-draft errors (Mastra telemetry propagation, cookie/CORS handling, Helm secret pattern, ingress controller, dependency pruning). Where the codebase already answers a question, it is stated as fact, not left open.

---

## Tier boundary

This plan splits into two explicit tiers.

**Tier A — Prototype completion.** Self-contained within `prototype/mastra-chat/` and read-only references to `apps/chat`. No stakeholder decisions, no new infrastructure, no schema migrations. Closes the three validation gaps the evaluation left open: observability, reasoning-streaming correctness, and cost attribution. All three are parallelisable.

**Tier B — Production path.** Architectural extraction, a privacy sign-off with external stakeholders, schema-adjacent changes, and Helm additions. B1 (privacy) is a process gate that should start immediately because it is slow; B2 (service extraction) is engineering that can scaffold in parallel but must not ship features touching real participant data until B1 clears.

The two tiers are independent at the start: Tier A improves the prototype, Tier B productionises it. Tier A's cost module (A1) feeds Tier B's cost design, but no Tier B step is blocked on Tier A completing.

---

## Tier A — Prototype completion

### A1 — Wire Langfuse observability + real credit accounting into the prototype

**Goal.** Every Mastra agent call emits a trace to Langfuse with real token counts, and the `creditsUsed` field in the SSE finish chunk reflects real usage instead of the hardcoded `0` at `prototype/mastra-chat/src/server.ts` line 92.

**Critical correction over the naive approach.** `apps/chat` traces by registering a global OTEL `TracerProvider` (`apps/chat/src/instrumentation.ts`: `LangfuseSpanProcessor` + `NodeTracerProvider`) and passing `experimental_telemetry: { isEnabled: true }` to the AI SDK's `streamText`. **This path does not work for Mastra agents.** In the installed `@mastra/core@1.41.0`, the `experimental_telemetry` pass-through to the AI SDK is explicitly commented out (verified in the compiled `chunk-X5IQHHDA.cjs`). Mastra emits spans through its own tracing context, not the AI SDK's global provider hook. Registering a `NodeTracerProvider` alone therefore produces no Mastra spans. The real options are: (a) pass Mastra's native `tracingOptions` to `agent.stream()` (the option exists on `AgentStreamOptions`, `@mastra/core/dist/agent/types.d.ts` line 733), or (b) install `@mastra/observability`, construct a top-level `Mastra` container with an `observability` entrypoint, and register each per-request agent into it via `__registerMastra`. A prerequisite spike decides between (a) and (b) before any code is written.

**The credit gap is independent and simpler.** `@mastra/ai-sdk` already computes `totalUsage` and places it directly on the finish chunk that the `messageMetadata` callback receives (`convertMastraChunkToAISDKv6` sets it at `@mastra/ai-sdk/dist/index.js` line 12055; it reaches `messageMetadata` at line 12792). No `onFinish` closure is needed — the callback can read `totalUsage` off its own `part` argument synchronously, which also removes any async-timing risk.

**Concrete steps.**

| Step | Description | File(s) |
|------|-------------|---------|
| 1 | **Spike (read-only, half day):** determine whether `tracingOptions` on `agent.stream()` emits Langfuse-exportable spans on its own, or whether `@mastra/observability` + a `Mastra` container is required. Record the answer; it sets the shape of steps 2–3. | — |
| 2 | Per the spike: either add `@mastra/observability` (matching the `@mastra/core` version) to `prototype/mastra-chat/package.json` and construct a single `Mastra` container wired with the Langfuse/OTEL exporter, or add `@langfuse/otel` + `@opentelemetry/sdk-trace-node` and feed Mastra's native `tracingOptions`. Pin versions to those already in `apps/chat` where shared. | `prototype/mastra-chat/package.json`, new `src/instrumentation.ts` |
| 3 | Initialise telemetry once at server start (before the first `agent.stream()`), guarded by `if (process.env.LANGFUSE_PUBLIC_KEY)` and idempotent against tsx-watch double-registration. Register per-request agents into the container if the container path was chosen. | `prototype/mastra-chat/src/server.ts`, `src/instrumentation.ts` |
| 4 | Declare `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` as optional fields in `src/env.ts` (documentation; the processor reads `process.env` directly). They already exist in `turbo.json` globalEnv but are absent from the Helm values. | `prototype/mastra-chat/src/env.ts` |
| 5 | Create `src/engine/cost.ts`: a model→price table (at minimum `openai/gpt-4.1`, `openai/gpt-4.1-mini`) and a `calcCost(costBase, inputTokens, outputTokens)` mirroring the formula in `apps/chat/.../chat/route.ts`. | New file |
| 6 | In the `messageMetadata` finish callback (`server.ts` line ~90), cast `part` to expose `totalUsage` and compute `creditsUsed = calcCost(modelCost, part.totalUsage.inputTokens, part.totalUsage.outputTokens)` using the `modelId` already in scope. Replace the hardcoded `0`. No closure, no `onFinish`. | `prototype/mastra-chat/src/server.ts` |
| 7 | Add the three `LANGFUSE_*` vars to the Infisical dev path; note they are also required in `deploy/env-uzh-prd/values.yaml` and `deploy/env-uzh-stg/values.yaml` (turbo globalEnv already lists them). | Infisical, deploy values |
| 8 | **Validate in one request:** with the vars set, POST to the prototype and confirm both (a) a Langfuse trace with a non-zero LLM span and (b) an SSE finish chunk carrying `creditsUsed > 0`. Both required. | — |

**Effort.** S–M — S for the credit shim (a synchronous read of data already present); the telemetry side is S if `tracingOptions` suffices, M if `@mastra/observability` + container wiring is required (the spike decides).

**Risks.**

| Risk | Mitigation |
|------|-----------|
| `tracingOptions` alone produces no exported spans (Mastra's native tracing needs the observability package). | The spike (step 1) resolves this before committing to an approach; the container path is the known-good fallback. |
| `LangfuseSpanProcessor` warns or attempts a network flush when keys are absent in local dev. | The `if (process.env.LANGFUSE_PUBLIC_KEY)` guard prevents construction; test with keys unset to confirm silence. |
| `LANGFUSE_HOST` missing in Helm values defaults to `cloud.langfuse.com`, wrong for a self-hosted instance. | Add `LANGFUSE_HOST` explicitly to prd and stg overrides in step 7. |

**Dependencies.** A reachable Langfuse instance + keys. Infisical access. The `@mastra/observability` package only if the spike requires it.

**Done criterion.** A single request yields both a Langfuse trace with a non-zero LLM span and an SSE finish chunk with `creditsUsed > 0`. Neither alone suffices.

---

### A2 — Reasoning-streaming validation

**Goal.** Confirm that `sendReasoning: true` (wired at `server.ts` line 85) actually produces `reasoning-start` / `reasoning-delta` / `reasoning-end` chunks through the Mastra → AI-SDK-v6 bridge, both in the raw Mastra output and in the converted SSE stream — and surface `reasoningEffort` / `reasoningContent` in finish metadata, matching what `apps/chat` already emits.

**Single most important prerequisite.** Closed: Chat Completions does not surface reasoning summaries on Azure/OpenAI. Responses API + `store:true` is the validated transport for both tool-call steps and reasoning summaries. All models — reasoning and non-reasoning — use `provider.responses(modelId)` (the `@ai-sdk/openai` default) via a single `@ai-sdk/openai` provider pointed at `OPENAI_BASE_URL`, with `store:true` always set in `providerOptions.openai`.

**Concrete steps.**

| Step | Description | File(s) |
|------|-------------|---------|
| 1 | **Transport check (complete).** Result: Chat Completions does not surface reasoning summaries. Azure Responses API adopted as single transport (`provider.responses(modelId)` with `store:true`). No per-capability branching needed. | — |
| 2 | Create `src/check-reasoning.ts`: instantiate an agent with the reasoning model, stream a "think step by step" prompt with `providerOptions: { openai: { reasoningEffort: 'low' } }`, assert ≥1 `reasoning-start` (hard gate; deterministic), and treat ≥1 non-empty `reasoning-delta` as positive proof but soft-warn on empty (bursty Azure behavior — not a pipeline bug). Assert the same after `toAISdkStream({ sendReasoning: true })`. Respect Mastra's single-consumer stream semantics (collect via callback, do not double-read). | New file |
| 3 | Extend the `server.ts` body schema with optional `reasoningEffort`; when present and not `'none'`, pass `providerOptions` to `agent.stream()`. | `prototype/mastra-chat/src/server.ts` |
| 4 | Do NOT use `onStepFinish` for `reasoningContent` accumulation — it races the finish chunk under HTTP backpressure. Use a downstream passthrough `TransformStream` (implemented in `server.ts` as of `72036c005`): accumulate `reasoning-delta` text parts in-order and intercept the `finish` part to patch `messageMetadata.reasoningContent`. | `prototype/mastra-chat/src/server.ts` |
| 5 | Emit `reasoningEffort` (from the request) and `reasoningContent` (accumulated) in the finish metadata alongside `modelId` / `chatMode` / `creditsUsed`. | `prototype/mastra-chat/src/server.ts` |
| 6 | End-to-end: run the server on the reasoning model, POST with `reasoningEffort: 'low'`, confirm the reasoning chunks and the enriched finish metadata appear over HTTP. | — |
| 7 | Confirm the converted SSE field names match what the existing frontend reads (`apps/chat/src/hooks/useChatResponse.ts` reads `text || delta`). Verification only — the frontend reasoning pipeline (`useChatResponse.ts`, `thread.tsx`) is already wired and needs no change for validation. | Verification |

**Effort.** M — 1–2 days if step 1 confirms reasoning tokens flow in Chat Completions mode; +~1 day if a provider switch is needed (touches `agent.ts` and Mastra's schema-compat handling of o-series IDs).

**Risks.**

| Risk | Mitigation |
|------|-----------|
| Provider does not surface reasoning tokens via Chat Completions streaming. | Risk materialized. Resolution: Azure Responses API + `store:true` is the single transport for all models. No per-capability branching required. `@openrouter/ai-sdk-provider` dropped. |
| Mastra schema-compat strips tool defs when an o-series model is detected. | Test the reasoning model with the MCP `doc_query` tool attached; if stripped, validate reasoning without tools and file a Mastra issue. |
| Single-consumer `MastraModelOutput` blocks accumulate-and-pipe. | Accumulate `reasoning-delta` in a downstream passthrough `TransformStream` and patch the finish metadata (step 4); do NOT rely on `onStepFinish` — it races the finish chunk under HTTP backpressure. |

**Dependencies.** A reasoning-capable model on the configured provider (Azure klicker-ai). `@openrouter/ai-sdk-provider` removed entirely — standard `@ai-sdk/openai` pointed at `OPENAI_BASE_URL` handles all models including reasoning. No frontend changes.

**Done criterion.** `check-reasoning.ts` exits 0 asserting reasoning chunks in both the raw and converted streams; the server end-to-end test confirms the same over HTTP with the enriched finish metadata.

---

### A3 — Background cost attribution

**Goal.** Capture embedding costs (`engine/embeddings.ts`) and summarization costs (`engine/summarize.ts`) per turn so prototype accounting reflects total model spend, not only the foreground chat stream.

**Scope note.** For the prototype this means *returning and logging* the values, not persisting them or deducting from a credit bucket. The foreground shim is fixed in A1. The production-grade version (deducting background cost from `ChatUsageCredits`, a cost-breakdown column, async-summarization billing) is explicitly Tier B and noted at the end.

**Concrete steps.**

| Step | Description | File(s) |
|------|-------------|---------|
| 1 | Extend `cost.ts` (from A1) with embedding and summary model entries (e.g. `text-embedding-3-small` input-only price). **Do this before the return-type changes below so callers can compute cost immediately.** | `prototype/mastra-chat/src/engine/cost.ts` |
| 2 | Change `embedText()` to return `{ embedding, promptTokens }` from `usage.prompt_tokens` (embeddings have no completion tokens). Update `ensureEmbedding()` / `rankRecall()` to accumulate a `totalEmbedPromptTokens`. | `prototype/mastra-chat/src/engine/embeddings.ts` |
| 3 | Change `summarizeMessages()` to return `{ text, promptTokens, completionTokens }` from the already-typed `usage` object in `postChat()` (currently discarded). | `prototype/mastra-chat/src/engine/summarize.ts` |
| 4 | Update **the check scripts** `check-recall-ranking.ts` and `check-summary-live.ts` to print per-call embedding/summary cost using the returned token counts and the cost table. (These scripts are the only callers of `rankRecall()` / `summarizeMessages()` today; `server.ts` does **not** call them — wiring recall/summary into the live handler is Tier B work, not assumed here.) | check scripts |
| 5 | Document the deferred production questions: bill embeddings per-turn vs per-write; replace the paid `promptTokensOf()` measurement call with a local tokenizer estimate; add a cost-breakdown column or a `ChatMessageCost` table to `packages/prisma/.../chat.prisma`. | Handoff notes |

**Effort.** S — 3–5 hours; return-type extensions on functions that already receive the data.

**Risks.**

| Risk | Mitigation |
|------|-----------|
| Embeddings endpoint omits `usage`. | Warn-and-zero rather than crash. |
| `promptTokensOf()` itself makes a paid, unmetered call. | Acceptable for offline checks; flag as a replace-with-tokenizer candidate in Tier B. |

**Dependencies.** A1 (cost.ts). Self-contained otherwise.

**Done criterion.** Both check scripts print non-zero per-call embedding/summary cost. No change to `server.ts` is implied by this item.

---

## Tier B — Production path

### B1 — Privacy sign-off: student profile (S3) + semantic recall (S4)

**Goal.** Obtain documented answers to the privacy decisions required before S3 (profile) or S4 (message embeddings) touch real participant data. This is a stakeholder process item; engineering supplies the decision framework, legal/DPO/product resolve it. The prototype tables were populated only with synthetic `testuser*` rows under `PROTO::` threads — no real participant data has been collected.

**The decisions.**

| # | Question | Options | Accountable |
|---|----------|---------|-------------|
| D1 | Legal basis (FADP Art. 6) for processing AI-extracted profile facts + message embeddings? | A: explicit opt-in (separate from chatbot disclaimer); B: legitimate interest + documented LIA; C: institutional consent via enrollment terms covering AI memory | DPO + UZH legal |
| D2 | May the agent store any free-form jsonb fact, or only an allowlist of categories? | A: open schema (current behaviour); B: server-enforced allowlist (e.g. preferredName, learningGoal, preferredAnswerStyle, preferredLanguage, knownCourseTopics); C: allowlist + per-category student confirmation | Product + pedagogy + legal |
| D3 | Retention of `student_profile` / `message_embedding` rows? | A: account lifetime; B: course/semester-scoped purge; C: inactivity TTL | DPO + product |
| D4 | On participant-account deletion, must the `mastra_proto` tables be purged, and how? | A: synchronous delete in the same transaction (raw SQL in `packages/graphql/src/services/accounts.ts`); B: event-driven async purge via Hatchet (bounded window); C: scheduled nightly reconcile against live `Participant` rows | Engineering + DPO |
| D5 | On `Chatbot` deletion, purge the `student_profile` rows keyed by `chatbot_id`? | A: yes, hook the deletion resolver; B: no, retain until account deletion / TTL | Engineering + product |
| D6 | Must students view + delete their stored facts before launch? | A: read + delete (`deleteProfile` and `renderProfileForContext` already exist at the data layer); B: read + edit + delete per key; C: no UI (not FADP-recommended) | Product + engineering |
| D7 | Confirm recall is per-student-per-chatbot-per-branch only, cross-student retrieval out of scope? | A: yes, lock current scope; B: cross-student anonymised retrieval in scope (separate review) | Product + DPO |
| D8 | Which endpoint may embed student text, and is it covered by the existing DPA? | A: Azure OpenAI EU/CH only (matches the disclaimer); B: any OpenAI-compatible endpoint under a separate DPA (disclaimer update) | DPO + legal |

**Process + engineering follow-ons.**

| Step | Description | Timing (relative to plan approval, given today 2026-06-14) |
|------|-------------|------------|
| 1 | Convene product + DPO + legal; present the decisions; target a first-read on D1 (everything depends on it). | within 2 weeks (by 2026-06-28) |
| 2 | Engineering prepares a written decision-record template (question, options, choice, rationale, implementation implication). | with step 1 |
| 3 | On D2: product/pedagogy define the allowlist; engineering adds server-side key validation in `updateProfileFacts` (`engine/profile.ts`). | within 1 week of D2 |
| 4 | On D3: engineering specifies a Hatchet retention sweep (mirror `apps/hatchet-worker-general/`), keyed off `Course.endDate`; spec only until D3 resolves. | within 1 week of D3 |
| 5 | On D4: engineering implements the chosen deletion path in `accounts.ts` (sync raw SQL) or the Hatchet event payload (async). **Coordinated with B2** — the path differs once chat is a separate service (see sequencing). | within 1 week of D4, coordinated with B2 |
| 6 | On D5: add or skip the `Chatbot`-deletion hook. | with step 5 |
| 7 | On D6: product designs the transparency UI in `apps/chat`; the data layer already exists. | within 1 week of D6 |
| 8 | On D8: DPO confirms/restricts the embedding endpoint; if Azure-only, add a config guard rejecting non-Azure `OPENAI_BASE_URL` when embeddings are enabled; update the disclaimer. | within 1 week of D8 |
| 9 | Update the disclaimer (`apps/chat/src/components/disclaimer-modal.tsx`) to disclose persistent per-chatbot profile, stored categories, retention, view/delete, and that own-history messages are indexed for recall. A re-acceptance/addendum is required for users who accepted the old disclaimer. | after all decisions |
| 10 | Gate check before B2 production exposure of S3/S4: documented records for D1, D2, D3, D4, D6 are the minimum set. | gate |

**Effort.** M for the process (2–4 meetings, decision record, sign-off cycles); S–M for the engineering follow-ons once decisions land (largest: D6 UI and the D4 deletion coordination).

**Risks.**

| Risk | Description |
|------|-------------|
| Compliance gap today | `deleteParticipantAccount` (`accounts.ts`) leaves `mastra_proto.student_profile` and `message_embedding` rows alive. If S3/S4 ship before D4 is implemented, every account deletion is an FADP non-compliance event. |
| Open fact taxonomy | Without D2 + the allowlist, the model could store sensitive inferences (anxiety, inferred disability) at a higher protection level. |
| Stale consent | Users who accepted the old disclaimer were not informed of persistent storage; an addendum/re-acceptance is needed. |
| Profiling threshold | AI extraction of learning preferences may cross the FADP "profiling" line, triggering a DPIA — DPO should assess. |

**Dependencies.** UZH DPO, UZH legal, product (external to engineering). B2 for the deletion-path coordination. Hatchet (D3 sweep, D4 async).

**Done criterion.** All eight decisions documented; engineering has shipped the D2 allowlist, the D4 deletion path, and the disclaimer update; the B2 exposure gate references these records.

---

### B2 — Stage 1: extract the chat API into a standalone Hono service

**Goal.** Move the chat inference endpoint out of `apps/chat`'s Next.js App Router into a standalone Hono/Node service (`apps/chat-api`) so the Mastra engine can replace `streamText` without Next.js's serverless constraints. Two phases: Phase 1 lifts-and-shifts the existing `streamText` route unchanged; Phase 2 swaps in the Mastra engine inside the already-extracted service.

**Prerequisite gate.** B1 records for D1/D2/D3/D6 before Phase 2 exposes profile/recall to real data; D4 (deletion) confirmed before Phase 1 reaches production (the extraction changes the deletion path).

**Seam decision (resolve before building — it dissolves most of the CORS complexity).**
There are two ways for the browser to reach `chat-api`:

- **Option 1 — same-origin via ingress path routing (recommended).** Route `chat.klicker.uzh.ch/api/chatbots/(.*)/chat` to the `chat-api` Service at the HAProxy ingress; every other path stays on the Next.js `chat` Service. The browser stays same-origin, so there is **no CORS, no `credentials: 'include'`, no cookie-domain concern, and no `NEXT_PUBLIC_*` rebuild**. The UI fetch URL does not change. Rollback is a runtime ingress route change (instant). Requires path-precedence ordering in the Ingress (the specific `/chat` path must win over the catch-all).
- **Option 2 — cross-origin via `chat-api.klicker.uzh.ch` + `NEXT_PUBLIC_CHAT_API_URL`.** Needs server-side CORS (`credentials: true`) **and** a client-side `credentials: 'include'` on the fetch, works only because `participant_token` is set with `Domain=.klicker.uzh.ch` (confirmed: `COOKIE_DOMAIN=.klicker.uzh.ch` in `deploy/env-uzh-prd/values.yaml`, consumed at `accounts.ts` line ~20 as `domain: process.env.COOKIE_DOMAIN`). Note `NEXT_PUBLIC_CHAT_API_URL` is **baked into the Next.js bundle at build time**, so changing it (including for canary/rollback) requires an `apps/chat` image rebuild + redeploy — it is not a runtime env flip.

The steps below assume **Option 1** as primary and call out Option 2 deltas where they differ.

**Approach.** The production route `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` (~1,685 lines) transplants verbatim into a new `apps/chat-api` Hono app in Phase 1. Server-side services (`credits.ts`, `threads.ts`, `disclaimers.ts`, `mcpClients.ts`, `chatModelRegistry.ts`, `imagePreview.ts`, `openaiResponsesOptions.ts`) have no Next.js imports and move unchanged. All other API routes (threads, credits, disclaimer, chatbot config) stay in `apps/chat` — and they (plus `apps/chat/src/middleware.ts`) continue to use `jose` via `withChatbotAuth`, so `jose` is **not** removable from `apps/chat`.

**Phase 1 — lift-and-shift (streamText, no Mastra engine).**

| Step | Description | File(s) |
|------|-------------|---------|
| 1 | Create the `apps/chat-api/` workspace (`@klicker-uzh/chat-api`). Deps: `hono`, `@hono/node-server`, `@ai-sdk/openai`, `@ai-sdk/mcp`, `@modelcontextprotocol/sdk` (used by `mcpClients.ts` in Phase 1), `ai` **pinned to the exact version `apps/chat` uses** (syncpack enforces parity), `@klicker-uzh/prisma`, `@klicker-uzh/util`, `jose`, `sharp`, `zod`. Add `tsconfig.json` + `Dockerfile` (follow `apps/response-api`, extended for sharp's native build). Register in `pnpm-workspace.yaml` and the turbo pipeline. | new workspace |
| 2 | Copy the server-side service files into `apps/chat-api/src/`; adjust import paths only (no Next.js imports present). | new files |
| 3 | Port `withChatbotAuth` (`apps/chat/src/lib/server/apiGuards.ts`) into Hono auth middleware: parse `Cookie` for `participant_token`, `jose.jwtVerify` with `APP_SECRET`, uuid-validate then `prisma.chatbot.findUnique`, participation check, store `participantId` via `c.set`. | new file |
| 4 | **Option 1:** no CORS middleware needed (same-origin). **Option 2 only:** add `hono/cors` with `origin` from `CORS_ALLOWED_ORIGINS`, `credentials: true`, `allowHeaders` incl. `Cookie`, `Vary: Origin`. | conditional |
| 5 | Add `GET /api/health` (matching the existing k8s probe path — `deployment-chat.yaml` lines ~61/65 use `/api/health`, not `/health`) returning `{ ok: true }`. | `apps/chat-api/src/index.ts` |
| 6 | Transplant the chat handler into `apps/chat-api/src/routes/chat.ts`: swap Next.js request/response for Hono `Context` (`c.req.raw`, `c.req.json()`, `c.req.raw.signal`, `c.req.param('chatbotId')`, `c.get('participantId')`). The `streamText` call and all callbacks (`onChunk`/`onFinish`/`onAbort`/`onStepFinish`) and `toUIMessageStreamResponse` transplant unchanged. Mount `app.post('/api/chatbots/:chatbotId/chat', authMiddleware, chatHandler)`. | new file |
| 7 | Wire `apps/chat-api/src/index.ts`: Hono app, middleware, health + chat routes, `serve({ fetch, port: Number(process.env.PORT ?? 7200) })`. | new file |
| 8 | **Option 1:** no UI change. **Option 2 only:** in `useChatResponse.ts` (~line 163) prefix the fetch with `process.env.NEXT_PUBLIC_CHAT_API_URL ?? ''` **and** set `credentials: 'include'` when that base URL is non-empty (omit on same-origin to preserve current behaviour); add the var to `turbo.json` globalEnv; remember the build-time-bake implication. | conditional |
| 9 | Helm additions in `deploy/charts/klicker-uzh-v3/templates/`: a Deployment (`deployment-chat-api.yaml`, cloned from `deployment-chat.yaml`, component `chat-api`, port 7200, probes on `/api/health`); a Service stanza appended to the **consolidated** `service-app.yaml` (the chart keeps all services as `---`-separated docs in one file — do not add a separate service file); a ConfigMap (`cm-chat-api.yaml`: `OPENAI_BASE_URL`, `CHAT_MODEL_REGISTRY_JSON`, `CHAT_PRIMARY_MODEL_ID`, `CHAT_FALLBACK_MODEL_ID`, `CHAT_OPENAI_STORE_RESPONSES`, `LANGFUSE_*`, and `CORS_ALLOWED_ORIGINS` only for Option 2); ingress changes per the chosen seam (Option 1: add the `/chat` path rule to the existing `chat` host routing; Option 2: a new `ingress-chat-api.yaml` host). The service references its secret via `envFrom.secretRef` by name; the v3 chart defines **no** Secret manifests (all secrets are provisioned out-of-band — do not add `secret-chat-api.yaml`). Add a `chatApi` block to `values.yaml`, `env-uzh-prd/values.yaml`, `env-uzh-stg/values.yaml`. | several templates + values |
| 10 | Provision the out-of-band secret (e.g. `klicker-uzh-v3-secret-chat-api`, matching the existing external `...-secret-chat` naming) with `OPENAI_API_KEY`/`AZURE_API_KEY`, `APP_SECRET`, `DATABASE_URL`, `MCP_KEY`, `LANGFUSE_*`. Document its name + keys for CI/Infisical. | Infisical / cluster secret |
| 11 | CI: build + push `chat-api` image on changes to `apps/chat-api/**` or `packages/prisma/**`, mirroring the chat image workflow. | `.github/workflows/` |
| 12 | **SSE through ingress:** the cluster is **HAProxy** (`className: haproxy` across `env-uzh-prd/values.yaml`; `ingress-chat.yaml` uses `haproxy.org/*` annotations). Set `haproxy.org/timeout-tunnel` on the chat path/host for long-lived SSE. (No nginx annotations — they are inert here.) | ingress template |
| 13 | Shadow on staging (`*.klicker.df-app.ch`): deploy `chat-api`, manually POST with a valid cookie, verify streaming, credit deduction, thread/message persistence, MCP tool calls, abort→partial-save, and a Langfuse trace. | staging |
| 14 | Canary on staging: route the chat path to `chat-api` (Option 1: ingress path rule; Option 2: rebuild+deploy `apps/chat` with the new `NEXT_PUBLIC_CHAT_API_URL`). Validate streaming, credits, reasoning, branching (`parentId`), image attachments, abort recovery — identical to the old route. Hold ≥48h. | staging |
| 15 | Production cutover: apply the same routing in prod and monitor error rate, credit correctness, p99 TTFT, and Langfuse spans for 24h. **Rollback:** Option 1 reverts the ingress route instantly; Option 2 requires re-promoting the prior `apps/chat` image (build-time env). Keep the Next.js route deployable as the fallback target during this window. | production |
| 16 | Hard cleanup after one clean sprint: remove `apps/chat/.../chat/route.ts` and the server-only files that moved. Drop only `@ai-sdk/openai` and (pending confirmation it is unused by the remaining attachments route) `sharp` from `apps/chat/package.json`. **Keep `jose`** (middleware + threads/messages/disclaimer/config routes still verify tokens). | `apps/chat/` |

**Phase 2 — Mastra engine swap (inside the extracted service).**

| Step | Description | File(s) |
|------|-------------|---------|
| 17 | **First**, extract the prototype engine (agent builder, MCP toolset, guardrails, profile, skills, embeddings, summarizer, cost) into a shared `packages/chat-engine/` library. Doing this before the swap means `apps/chat-api` imports the engine rather than growing it then re-extracting. | new package |
| 18 | Replace `streamText` in `apps/chat-api/src/routes/chat.ts` with a per-request Mastra `Agent` via `buildAgent` from `packages/chat-engine`; replace `getAggregatedMCPTools` with `buildMcpToolset`; convert via `toAISdkStream({ from:'agent', version:'v6', sendReasoning:true, messageMetadata })`. Use `provider.responses(modelId)` with `store:true` — this is the only path that surfaces reasoning summaries and supports multi-step tool calls, and matches production `apps/chat` transport. Whether the production `responsesApiFetch` shim is still required after the engine extraction should be re-checked (it is a body-shape workaround, independent of the `store` flag). Wire the resolved model id from Mastra step metadata into the finish shim (fixes the S0 fallback-attribution gap). Keep all persistence/credit callbacks. | `apps/chat-api/src/routes/chat.ts` |
| 19 | Drop `@modelcontextprotocol/sdk` and `@ai-sdk/mcp` from `apps/chat-api/package.json` once `mcpClients.ts` is replaced by the Mastra toolset. | `apps/chat-api/package.json` |
| 20 | Wire the A1 telemetry bootstrap into `apps/chat-api` (native Mastra tracing, per A1's spike outcome); confirm `LANGFUSE_*` in `cm-chat-api.yaml`. | instrumentation |
| 21 | Regression gate: replay all prototype check scripts (`check-profile`, `check-recall-ranking`, `check-summary-live`, `check-evals`, `check-reasoning`, `check-skills-live`, `check-subagents`) against the new service; no behavioural regression. | gate |

**Effort.** L — Phase 1 ~2–3 engineer-weeks (1,685-line route, seam validation, Helm spanning several templates, shadow→canary→cutover QA across credits/streaming/MCP/abort/attachments). Phase 2 ~1–2 weeks (engine extraction, swap, fallback-attribution fix, regression). Total 3–5 weeks.

**Risks.**

| Risk | Mitigation |
|------|-----------|
| SSE buffering through ingress | HAProxy `haproxy.org/timeout-tunnel` on the chat path (confirmed controller — not nginx). |
| sharp on ARM64 | Prod nodes are ARM (`-arm` image tags in `env-uzh-prd/values.yaml`); use sharp's prebuilt ARM64 binary, or move image preprocessing to a Hatchet worker and drop sharp from the API service. |
| PG connection exhaustion | A second Prisma pool against the same Postgres; set `connection_limit` in the service's `DATABASE_URL` or front with PgBouncer, especially if `chat-api` autoscales. |
| Mastra API churn | Pin exact versions (`@mastra/core@1.41.0`, `@mastra/ai-sdk@1.4.4`); scheduled upgrade sprint every 4–6 weeks. |
| `ai` version skew between `chat-api` and `chat` | Pin identical `ai` version; syncpack check enforces it. |
| Langfuse trace continuity across services | Same bootstrap pattern + same `LANGFUSE_*` in `cm-chat-api.yaml`. |

**Resolved (were open questions).** Cookie domain = `.klicker.uzh.ch` (leading-dot, covers subdomains). Ingress controller = HAProxy. These need no further investigation.

**Genuinely open questions.**

| Question | Who |
|----------|-----|
| Seam choice: same-origin ingress path routing (Option 1, recommended) vs cross-origin subdomain (Option 2)? | Eng + ops |
| Move image preprocessing (sharp + description generation) to a Hatchet worker, removing sharp from the API service? | Product + eng |
| Do the remaining Next.js API routes (threads, credits, disclaimer, config) also move to `chat-api` later, or stay? | Product + eng |
| Exact `@mastra/core@1.41.0` API to read the actually-used model id from a step result (S0 fallback fix)? | Eng — inspect `@mastra/core/dist/agent/types.d.ts` |

**Dependencies.** `@klicker-uzh/prisma`, `@klicker-uzh/util`. The `doc_query` MCP server reachable from the `chat-api` pod. Out-of-band secret provisioned. B1 (D4 before Phase 1 prod; D1/D2/D3/D6 before Phase 2 with profile/recall). A1 telemetry pattern.

**Done — Phase 1.** Production cutover completes with no error-rate increase over 24h; credits, threading, persistence, MCP, abort, attachments, and tracing match the old route (verified by comparing Langfuse traces and credit balances before/after).
**Done — Phase 2.** All check scripts pass against the new service; the engine swap regresses nothing; the resolved model id is correctly attributed in the finish chunk.

---

## Sequencing and recommended order

### What unblocks what

| Item | Blocked by | Blocks |
|------|-----------|--------|
| A1 Observability + credits | — | provides `cost.ts` for A3 |
| A2 Reasoning validation | — | — |
| A3 Background cost | A1 (cost.ts) | informs B2 cost design |
| B1 Privacy sign-off | — (start immediately) | B2 Phase 2 prod exposure (D1/D2/D3/D6); B2 Phase 1 prod (D4) |
| B2 Phase 1 lift-and-shift | seam decision | B2 Phase 2 |
| B2 Phase 2 engine swap | B2 Phase 1 stable; B1 D1/D2/D3/D4/D6 | — |

**Hard cross-tier constraint (do not drop):** B1 step 5 (account-deletion purge of `mastra_proto` tables) and B2 must be co-sequenced. If B2 Phase 1 reaches production before D4 is implemented, account deletion reaches neither the old Next.js route (eventually removed) nor a cross-service purge — a dangling-data window. D4 must be implemented before, or in lockstep with, the B2 production cutover.

### Recommended order

- **Immediately (parallel, ~1 week):** A1 and A2. A1 closes the most visible gap (`creditsUsed: 0`, zero tracing) and is a hard prerequisite for any production Mastra route. A2's step 1 surfaces the highest-risk unknown (does reasoning flow through Chat Completions on this provider) before anything depends on it. **Also start B1 now** — it is a slow stakeholder process; the earlier it starts, the earlier its gate clears.
- **~Week 2:** A3 (small, bounded) alongside continuing B1. Resolve the B2 seam decision (Option 1 recommended). The previously-"open" cookie-domain and ingress-controller questions are already answered — no investigation needed.
- **~Weeks 3–4:** scaffold `apps/chat-api` (B2 steps 1–2, mechanical, decision-free) while B1 meetings run. Begin Phase 1 engineering (auth, handler transplant, Helm).
- **~Weeks 4–6:** complete Phase 1 through shadow (step 13).
- **~Weeks 7–8:** canary (≥48h) → production cutover → monitor → cleanup (keeping `jose`).
- **~Weeks 9–11:** Phase 2 engine swap, **only after** Phase 1 is stable in production and B1's D1/D2/D3/D4/D6 are documented. The engine swap is last — the service boundary is proven under the safe `streamText` path first, and the new memory features arrive only once their retention/deletion obligations are signed off.
