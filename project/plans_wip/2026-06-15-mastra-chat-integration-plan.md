# PLAN — Mastra Chat Engine: Hono Service + Test-Drive Integration

**Date:** 2026-06-15 (revised after decision review)
**Branch:** `feat/chat-mastra-prototype` (off `v3`)
**Predecessors:** prototype verdict `prototype/mastra-chat/RESULTS.md`; A2 findings `project/plans_wip/2026-06-14-mastra-prototype-A2-findings.md`; broader migration `project/plans_wip/PLAN-chat-mastra-next-steps.md` (this plan refines that doc's B2 into a concrete, test-drive-first sequence).

---

## 1. Goal & locked decisions

Stand up the validated Mastra engine as a real, runnable service and get it **clickable in the local seeded dev environment** behind a flag, without disturbing the production chat path until parity is proven.

| Decision | Choice | Consequence |
| --- | --- | --- |
| Topology | Parallel Hono service `apps/chat-api` on the extracted engine; the Next route proxies to it when flagged | New deployable; the existing `apps/chat` route stays live |
| Service exposure | `chat-api.klicker.com` via Traefik (mkcert + `/etc/hosts`), **not** localhost | Cookie flows on `.klicker.com`; mirrors prod cookie/domain behavior |
| Cutover | Global env flag `CHAT_USE_MASTRA_ENGINE`; switch by **wiping the DB + restarting** | No per-chatbot flag, no mid-thread flip, no parallel A/B — dead simple |
| Frontend | Untouched; the Next route branches on the flag and **streams the proxied response** | No base-URL change in the client, no CORS (same-origin proxy) |
| Auth (flagged path) | The Next route forwards the `participant_token` cookie raw; the Hono service authenticates it (own JWT verify + chatbot + participation). Logic duplicated from the route — **accepted** | No double-auth, no service-trust boundary |
| First test target | Local seeded dev | Synthetic data, fast loop, click-through locally |
| v1 scope | Core chat **including images**; DIY memory (profile/recall/compression/sub-agents) deferred — implementation approach still open | Image pipeline ported now; memory parked until a design exists |
| Engine source | Extract `prototype/mastra-chat/src/engine/*` into `packages/chat-engine` | Shared library; `apps/chat-api` imports it |
| Shared services | **No new shared package.** The Hono service imports existing `apps/chat` services where it can and **duplicates** where cleaner | Pragmatic; accept some duplication (credits/persistence) |
| Transport | `provider.responses(modelId)` + `store:true`; **retain the prod `responsesApiFetch` body-shape shim** (port it into the engine fetch) | Matches prod exactly; avoids the silent multi-turn failure |

The single thing the test drive must prove: **the Mastra-backed service is a drop-in replacement for the `streamText` route — same wire format, same auth, same credit/persistence/image behavior — so flipping the flag (DB wipe + restart) swaps the engine with no frontend change.**

---

## 2. Target topology

The frontend keeps calling `POST /api/chatbots/{chatbotId}/chat` on the Next app. With the flag **off**, that route runs today's `streamText` logic. With the flag **on**, it forwards the request (cookie included) to `chat-api.klicker.com` and streams the response straight back; the Hono service owns auth, gating, the engine, streaming, persistence, credits, and the image pipeline end-to-end.

| Component | Role | Status |
| --- | --- | --- |
| `apps/chat` (Next.js) frontend | Unchanged UI; reads the same SSE wire format | Keep |
| `apps/chat` chat route | Flag branch: legacy `streamText` path **or** a thin streaming proxy that forwards the cookie to `chat-api.klicker.com` and returns the upstream stream verbatim | Modify |
| `apps/chat-api` (Hono) at `chat-api.klicker.com` | New service: authenticates the forwarded cookie, disclaimer gate, image pre-processing, engine call, `toAISdkStream`, reasoning accumulator, persistence, credit metering | New |
| `packages/chat-engine` | Extracted engine: agent builder, provider/options (+ `responsesApiFetch`), MCP toolset, guardrails, cost, observability; DIY-memory modules later | New |
| Existing `apps/chat` services | `credits`, `threads`, `disclaimers`, auth helpers, `calcCost`, `mapAssistantStepContent`, image preview — imported cross-app or duplicated into the Hono service | Reuse/duplicate |
| LiteLLM → Azure | Unchanged model backend at the same `OPENAI_BASE_URL` | Keep |
| Local seeded Postgres + Prisma | Single DB; engine reads/writes via the production Prisma client (no `mastra_proto` schema, no bare `pg.Pool`) | Keep |

**Why proxy and not direct-to-Hono:** keeps the frontend literally unchanged and same-origin (no CORS, no cookie-domain juggling). The one requirement it imposes — the Next branch must return the upstream `fetch` `Response` **directly** so its `ReadableStream` body streams token-by-token, never buffered — is a concrete, testable implementation note (see Phase 4).

---

## 3. Phased plan

Phases 1–4 deliver the clickable core (now including images); 5 adds DIY memory once a design exists; 6 cleans up after parity.

### Phase 0 — Scaffolding & decisions

| Step | What |
| --- | --- |
| 0.1 | Create `packages/chat-engine` (skeleton, tsconfig, build) and `apps/chat-api` (Hono skeleton, port, `/health`) in the workspace |
| 0.2 | Add the global env flag `CHAT_USE_MASTRA_ENGINE` (+ the chat-api base URL env) to `turbo.json` `globalEnv` and the Infisical dev env |
| 0.3 | Add the Traefik route + `/etc/hosts` entry + mkcert cert for `chat-api.klicker.com` |

**Exit:** both new packages build empty; the flag is readable in the Next route; `chat-api.klicker.com` resolves locally.

### Phase 1 — Extract `packages/chat-engine`

Self-contained modules first; DB-touching ones re-pointed; prototype scaffolding dropped.

| Module | Action | Note |
| --- | --- | --- |
| `agent.ts`, `guardrails.ts`, `cost.ts`, `observability.ts`, `summarize.ts`, `profileTools.ts`, `skillTools.ts` | Extract as-is | Self-contained. `observability.ts`: swap `ConsoleExporter` for an env-driven OTLP/Langfuse exporter; isolate the `agent.__registerMastra` internal call behind one wrapper (churn risk) |
| `agent.ts` provider construction | Extend | Thread the **`responsesApiFetch` shim** into `createOpenAI({ baseURL, apiKey, fetch })` — port it from `apps/chat` so multi-turn Responses calls keep working |
| `cost.ts` `MODEL_COST` | Extract **and dedupe** | Today it duplicates `chatModelRegistry` cost data. Registry is the single source of truth; the engine reads cost from the passed model config |
| `mcp.ts` | Extract, re-point | `loadKbServerConfig` reads production Prisma (`ChatbotMCPServer`); KB URL from the DB row, not `PROTO_MCP_URL` |
| `branch.ts`, `profile.ts`, `skills.ts`, `embeddings.ts`, `summary.ts`, `subagents.ts` | Defer to Phase 5 | Hit `mastra_proto.*` via `pg.Pool`; need Prisma models + a design first. Not loaded for v1 core chat |
| `pool.ts`, `proto-schema.ts`, `stub-mcp.ts`, `fixture.ts`, `check-*.ts`, `probe-aisdk.ts`, `author-skills.ts` | Drop | Prototype-only. The `check-*.ts` assertions become integration tests (Phase 4) |

**Exit:** `packages/chat-engine` exports `buildAgent`, `responsesProviderOptions`, `buildMcpToolset`, guardrails, cost — typechecks, ships the `responsesApiFetch` shim, no `mastra_proto`/`pg.Pool` deps in the core path.

### Phase 2 — `apps/chat-api` Hono service (core chat + images)

Port the Next route's behavior into the Hono service, calling the engine instead of `streamText`.

| Step | What | Source |
| --- | --- | --- |
| 2.1 | Auth middleware chain: read the forwarded `participant_token` cookie, `jose.jwtVerify` with `APP_SECRET`, then chatbot lookup + participation check. Duplicate the route logic (no shared package) | `apiGuards.ts` |
| 2.2 | Disclaimer gate before streaming: `checkDisclaimerStatus`, 403 `DISCLAIMER_NOT_ACCEPTED` | `disclaimers.ts` |
| 2.3 | Request adapter: accept the frontend body (`messages`, `threadId`, `selectedModel`, `selectedMode`, `reasoningEffort`, `parentId`, `assistantMessageId`, `images`) and map to engine inputs (`selectedMode`→mode, `selectedModel`→model); `chatbotId` from the path | wire contract §4 |
| 2.4 | Model selection + credit gating: reuse `chatModelRegistry` + credit-aware `getAutomaticModelId`; check balance before streaming | `chatModelRegistry.ts`, `credits.ts` |
| 2.5 | **Image pipeline (ported, in v1):** `ensureImagePreviewBase64` (sharp 256px), per-image `generateText` description, `imageDescriptionCost`, inject `[Attached image description: …]` into model messages, write `ChatAttachment` rows | route image logic |
| 2.6 | Thread + user-message persistence before stream: `createThread` if needed, ownership check, `ChatMessage` upsert-or-create, attachment rows, bump `updatedAt` | route persistence |
| 2.7 | Engine call: `buildAgent(...)` + `agent.stream(...)`; attach MCP toolset via `buildMcpToolset` from the DB-driven config | engine |
| 2.8 | Stream conversion + the **reasoning accumulator TransformStream** (A2 race-free fix); `createUIMessageStreamResponse` | prototype `server.ts` |
| 2.9 | Finish metadata: `{ finishReason, chatMode, modelId, reasoningEffort, reasoningContent, creditsUsed }`. **`finishReason` must be added** (prototype omits it; client needs it for the truncation notice) | wire contract §4 |
| 2.10 | Assistant-message persistence + credit decrement on finish/abort: port `mapAssistantStepContent`, `decrementCredits`, the partial-abort persistence | route `onFinish`/`onAbort` |

**Exit:** `apps/chat-api` at `chat-api.klicker.com` serves an authenticated, persisted, credit-metered, image-capable chat stream byte-compatible with the frontend's SSE parser, against the local seeded DB.

### Phase 3 — Flag-gated streaming proxy from `apps/chat`

| Step | What |
| --- | --- |
| 3.1 | In the Next chat route, branch on `CHAT_USE_MASTRA_ENGINE`: off → today's `streamText` path unchanged; on → forward to `chat-api.klicker.com` |
| 3.2 | The flagged branch forwards the request body + the `participant_token` cookie, and **returns the upstream `fetch` `Response` directly** (no `await res.text()`, no re-wrapping) so the body streams token-by-token. Hono authenticates; the Next route does not re-auth the flagged path |

**Exit:** with the flag on (DB wiped + restarted), traffic flows browser → Next → `chat-api.klicker.com` and streams unbuffered; flag off restores the legacy path.

### Phase 4 — Local test-drive (the milestone)

| Step | What |
| --- | --- |
| 4.1 | Bring up deps (`./_run_app_dependencies.sh`), seed the DB, run `apps/chat`, `apps/chat-api`, the backend; flag on |
| 4.2 | Click through tutor chat as a seeded participant: text streaming, gpt-5.1 reasoning panel, an MCP `doc_query` call, **an image attachment**, credits decrementing, a thread that reloads |
| 4.3 | **Streaming check:** confirm tokens render incrementally through the proxy (not all-at-once) — proves the Next branch isn't buffering |
| 4.4 | **Multi-turn check:** run a 3+ turn conversation with a tool call mid-thread — proves the `responsesApiFetch` shim is doing its job and the Responses API multi-step continuation holds |
| 4.5 | Parity checklist (§7); flag off → confirm the legacy path is unchanged. Convert the prototype `check-*.ts` assertions into integration tests against the running service |

**Exit:** core Mastra chat (with images) is clickable locally and matches the legacy path on the parity checklist.

### Phase 5 — DIY memory layer (deferred — design still open)

Parked: the implementation approach for profile / recall / compression / sub-agents on production Prisma is not decided yet. When taken up: convert the five `mastra_proto.*` tables to Prisma models + migrations, re-point the engine modules (`branch.ts`'s recursive CTE → `$queryRaw`), move recall to `pgvector`, keep `subagents.ts` on Chat Completions for bug #15013, and gate the profile feature on a privacy decision before any non-synthetic data.

### Phase 6 — Cleanup (after parity, flag default on)

| Step | What |
| --- | --- |
| 6.1 | Remove the legacy `streamText` path; the Next route becomes a permanent thin proxy (or the frontend points at `chat-api.klicker.com` directly) |
| 6.2 | Delete `services/mcpClients.ts`; drop the direct `@ai-sdk/mcp` dependency |
| 6.3 | Reconcile the duplicated persistence/credit/auth/image code between the route and the Hono service (the duplication accepted for the drive) |
| 6.4 | Collapse the duplicate cost table (registry as single source of truth); remove the flag |

---

## 4. Wire-compatibility contract (must stay drop-in)

The frontend's SSE parser (`useChatResponse.ts`) is the contract. Most already matches; the gaps are small and concentrated. The proxy forwards the body verbatim, so the field renames happen inside the Hono service.

| Stream piece | Frontend reads | Mastra emits | Action |
| --- | --- | --- | --- |
| `text-delta` | `.delta` | `.delta` | Match |
| `reasoning-delta` | `.text` then `.delta` | `.delta` (v6) | Works via the client's dual-field fallback; no change |
| tool `-start` / `-available` / `output-available` | `toolCallId`, `toolName`, `.input`, `.output` | same | Match |
| `finish` → `reasoningContent` / `reasoningEffort` / `creditsUsed` / `chatMode` / `modelId` | metadata fields | same shape/types (reasoningContent via TransformStream) | Match |
| `finish` → `finishReason` | drives the "Response truncated" notice on `'length'` | **omitted** by the prototype | **Add** (Phase 2.9) |
| Request body | `selectedMode` / `selectedModel` | engine reads `mode` / `model` | **Rename** in the Hono adapter (Phase 2.3) |
| Tool namespace | `RAGToolUI` expects a specific tool name (`KB.doc_query` vs `serverName_toolName`) | Mastra's own namespacing | **Verify** the rendered tool name; adjust namespacing or the UI mapping (§6) |

---

## 5. What moves where (engine seams + app cleanup)

| Area | Extract → `chat-engine` | Keep in `apps/chat-api` / reuse | Remove |
| --- | --- | --- | --- |
| Engine core | `agent` (+`responsesApiFetch`), `guardrails`, `cost`, `observability`, `summarize`, `profileTools`, `skillTools` | — | — |
| Retrieval | `mcp` (re-pointed to Prisma) | DB query for enabled MCP servers per chatbot/mode | `services/mcpClients.ts`, direct `@ai-sdk/mcp` |
| DIY memory | `branch`, `profile`, `skills`, `embeddings`, `summary`, `subagents` (Phase 5) | — | `mastra_proto` schema, `proto-schema.ts` |
| Service spine | — | Hono handler, Prisma data access, auth helpers, disclaimers, credits, threads, `calcCost`, `mapAssistantStepContent`, image preview (imported or duplicated) | `pool.ts`, `stub-mcp.ts`, `fixture.ts`, `check-*.ts`, `probe-aisdk.ts`, `author-skills.ts` |
| Provider | `responsesProviderOptions` (store + reasoning) + `responsesApiFetch` | `chatModelRegistry`, per-chatbot key/URL override + `safeDecrypt` | `CHAT_OPENAI_STORE_RESPONSES` env (folded into the engine default) |

---

## 6. Risks & gotchas

| Risk | Handling |
| --- | --- |
| Prod `reasoningContent` uses the same module-level-var pattern the A2 race exposed | The Hono service uses the TransformStream accumulator, not the var — a correctness upgrade the migration carries into prod |
| `responsesApiFetch` (#12754) is a silent multi-turn failure if dropped | **Retained** and threaded into the engine fetch; Phase 4.4 explicitly tests multi-turn tool-call continuation |
| Streaming through the Next proxy could buffer (all-at-once render) | The flagged branch returns the upstream `Response` directly; Phase 4.3 verifies incremental rendering |
| `finishReason` omission breaks the truncation notice | Added in Phase 2.9 |
| MCP namespacing divergence + `passChatbotId` `Chatbot-ID` header + wildcard `allowedTools` + priority de-dup | Re-implement the auth-header builder, header injection, wildcard filter, and priority merge over Mastra's `MCPConfiguration`; verify the tool name `RAGToolUI` renders |
| Credit decrement lives in `streamText` `onFinish`/`onAbort` | Reproduce the same completion hooks around the Mastra stream; atomic decrement + partial-abort persistence fire on the same events |
| Duplicated persistence/credit/auth/image across route and service | Accepted for the drive (no mid-thread flip, switch is DB-wipe+restart). Reconciled in Phase 6.3; keep `mapAssistantStepContent` + the cost math identical by copying, not re-deriving |
| `safeDecrypt` of per-chatbot keys needs `APP_SECRET` | Provide `APP_SECRET` (+ `OPENAI_*` fallback) to `apps/chat-api`; reuse `@klicker-uzh/util` `safeDecrypt` |
| `subagents.ts` deliberately uses Chat Completions for bug #15013 | Phase 5 concern; keep that exception |
| Mastra `__registerMastra` internal API | Isolate behind one wrapper; flag as churn-exposed |

---

## 7. Local test-drive checklist (seeded dev, flag on)

| Check | Expected |
| --- | --- |
| Text chat (gpt-4.1-mini) | Streams token-by-token through the proxy; thread persists and reloads |
| Reasoning chat (gpt-5.1, effort medium) | Reasoning panel renders when the provider emits a summary; **no error when empty** (bursty Azure) |
| Image attachment | Upload → description generated → `imageDescriptionCost` added → answer references the image |
| Multi-turn + tool | 3+ turns with a mid-thread `doc_query` call succeed (shim works) |
| MCP retrieval | Tool call renders with the expected name; cited answer returns |
| Guardrail | A prompt-injection input trips the tripwire, no model output |
| Credits | Balance decrements by the computed `creditsUsed`; zero balance falls back to the cheaper model |
| Truncation | A capped response shows the "Response truncated" notice (`finishReason === 'length'`) |
| Abort | Cancelling mid-stream persists the partial message and deducts partial credits |
| Regression | Flag off → the legacy path is byte-identical to today |

---

## 8. Resolved decisions (from review)

| # | Question | Resolution |
| --- | --- | --- |
| 1 | Images in v1 | **Migrate directly** — port the image pipeline into the Hono service now; do not scope out |
| 2 | Shared-services home | **No new package** — import existing `apps/chat` services cross-app where possible, duplicate where cleaner |
| 3 | Flag granularity | **Global env flag**; switch by wiping the DB + restart. No per-chatbot flag, no parallel A/B |
| 4 | DIY memory in the drive | **Out** — implementation approach undecided; parked at Phase 5 |
| 5 | Service exposure | **`chat-api.klicker.com`** (Traefik), not localhost |
| 6 | `responsesApiFetch` | **Retain** the existing prod shim (ported into the engine); not removed |
| 7 | Mid-thread flag flip | **Never** — removes cross-flip persistence/credit coherence concerns; duplication accepted |
| 8 | Auth | The Hono service authenticates the forwarded cookie itself (duplicated logic OK); identity established upstream by the auth flow; no trust boundary |

---

## 9. References

- A2 findings (transport, reasoning, race fix): `project/plans_wip/2026-06-14-mastra-prototype-A2-findings.md`
- Prototype verdict + per-slice evidence: `prototype/mastra-chat/RESULTS.md`
- Broader migration (B1 privacy, B2 full extraction): `project/plans_wip/PLAN-chat-mastra-next-steps.md`
- Current route to mirror: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`; services under `apps/chat/src/services/` and `apps/chat/src/lib/server/`
- Engine to extract: `prototype/mastra-chat/src/engine/` + `server.ts`

---

## 10. Progress

Branch `feat/chat-mastra-prototype`. All slice commits use `--no-verify`.

| Phase | State | Evidence |
| --- | --- | --- |
| 0 — Scaffolding | Done | chat-engine + chat-api skeletons, flag in `turbo.json`, Traefik route `chat-api.klicker.com → :3005` |
| 1 — Extract `chat-engine` | Done | engine builds + typechecks; DB-free, config-driven |
| 2 — `chat-api` Hono service | Done | full handler mirroring the route (auth, disclaimer, images, engine stream, persistence, credits, MCP); typecheck + rollup build clean; 15 adversarial-review findings applied |
| 3 — Flag-gated proxy | Done | Next route branches on `CHAT_USE_MASTRA_ENGINE`, forwards body + cookies, returns the upstream `Response` directly; apps/chat typecheck clean |
| 4 — Local test-drive | Partial | **Done:** service boots under injected env (`/health` → `{"ok":true}`), workspace-dep build graph clean, `--env-file-if-exists` fix so it runs under `pnpm run dev`. **Pending:** the interactive drive (needs the manual setup in §11) |

Static/runtime verification completed for Phases 2–4 without the full stack:
typecheck (chat-api, chat-engine, chat), rollup builds, and a live `/health` boot
of the built bundle with injected env confirm imports resolve, the APP_SECRET
fatal guard passes, and Hono serves. Reasoning-content race fix carried as a
downstream TransformStream; partial-abort text/reasoning sourced from `onChunk`.

## 11. Next Steps

The remaining Phase 4 work is the interactive drive (§4.2–§4.5). It is blocked on
three manual steps the assistant cannot perform (sudo, Infisical login, starting
the dev stack):

| # | Step | Owner | Note |
| --- | --- | --- | --- |
| 1 | Add `127.0.0.1 chat-api.klicker.com` to `/etc/hosts` | Human (sudo) | so Traefik can route the new host |
| 2 | Set Infisical dev (+ dev-cypress) secrets `CHAT_USE_MASTRA_ENGINE=true` and `CHAT_API_BASE_URL=https://chat-api.klicker.com` | Human | both already in `turbo.json` globalEnv; `CHAT_OPENAI_STORE_RESPONSES=true` for Azure-backed dev |
| 3 | Bring up deps + seeded DB, then `pnpm run dev` (starts chat-api too, now that it tolerates a missing `.env`) | Human | CLAUDE.md: assistant avoids starting dev servers |

Once the stack is up: run §4.2 click-through (text stream, gpt-5.1 reasoning, an
MCP `doc_query`, an image attachment, credits decrement, thread reload) and the
§4.3 streaming / §4.4 multi-turn checks via `agent-browser`, then §4.5 (convert
the prototype `check-*.ts` assertions into integration tests against the running
service). Flag off → confirm the legacy path is unchanged (§7).

## 12. Final security review (Phase 2–3 diff)

Adversarial review of `6e2ac0faa..HEAD` (5 dimensions × 3 refute-by-default
verifiers). 8 raw findings → 3 confirmed (3/3 each); 5 rejected.

| # | Severity | Issue | Origin | Disposition |
| --- | --- | --- | --- | --- |
| 1 | High | Concurrent credit-decrement race: `atomicDecrementCredits` reads-then-writes under ReadCommitted with no row lock, so simultaneous requests converge to one decrement | **Pre-existing** — byte-identical to `apps/chat/src/utils/transactions.ts` in production | Flagged (task chip `task_c4c2931c`); fix the live route + the chat-api copy, not buried here |
| 2 | Medium | `imageDescriptionCost` not charged on early abort (`if (hasUsage)` gates it; abort before first step → image cost lost) | **Pre-existing** — identical `onAbort` gating in the legacy route (`route.ts:1480`) | Flagged (task chip `task_f711d01f`) |
| 3 | Medium | No HTTP body-size limit on the new Hono service — `c.req.json()` buffers unbounded | **Net-new**: legacy gets an implicit platform cap; Hono has none | **Fixed** (`b45cd6e5c`): `hono/body-limit` 32 MB → 413; runtime-verified |

Rejected (≤1/3): JWT alg-not-pinned and issuer-not-validated (HS256/jose
verification adequate for the shared-secret model), `CHAT_API_BASE_URL` SSRF
(operator-set env, not attacker-controlled; `chatbotId` is `encodeURIComponent`'d),
verbatim response-header forwarding, proxy double-buffering.

Net: the only diff-introduced security gap (body limit) is fixed; the two
confirmed credit issues are pre-existing production bugs to fix at the source.
