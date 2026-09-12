# Mastra Framework Evaluation for the KlickerUZH Chat Platform

**Date:** 2026-06-11
**Scope:** Evaluation of [Mastra](https://github.com/mastra-ai/mastra) (v1.41.0, June 2026) as a potential agent framework for `apps/chat`, including migration complexity, win/loss analysis, assistant-ui compatibility, migration path, and newly enabled capabilities.

---

## 1. Executive Summary

Mastra is a TypeScript agent framework (Apache 2.0 core, v1.0 stable since January 2026, built by the ex-Gatsby team at Kepler Software) that provides exactly the platform-layer capabilities our chat app currently lacks: agent skills, durable agent memory, supervisor/sub-agent orchestration, durable workflows with human-in-the-loop, automatic model fallback, and a native evaluation framework. It overlaps with — but does not improve on — what we already do well: streaming, MCP tool calling, and Langfuse tracing.

**Scope decision (2026-06-11):** course-knowledge retrieval is explicitly *out of scope* for Mastra — it stays on the AI-infra `doc_query` MCP server and is consumed as one MCP toolset among others. Mastra's RAG primitives will not be used. The desired capabilities are instead: **skills** (adoptable now — Workspace Skills with DB-backed versioning), **memory** (working memory adoptable now; semantic recall and Observational Memory incompatible with our branching/ownership model), and **sub-agents** (adoptable now with a two-level delegation depth limit). See §6.3.

**Recommended posture:** Adopt Mastra as the *agent engine* behind our existing chat route while keeping our own Prisma persistence, branching model, credits system, and frontend ("Scope A"). Do **not** adopt Mastra's Memory/storage as the system of record ("Scope B") — it conflicts structurally with our branching tree, per-message billing, and mode snapshots for no compensating benefit.

Under Scope A, the migration is **low-to-medium effort, concentrated in two files** (the chat route handler and the MCP client service), with **zero frontend changes**. Every compatibility-critical claim was verified against live documentation in June 2026 (see Section 5).

The single biggest ongoing cost is **API churn**: Mastra shipped 28 minor versions in the 12 weeks after v1.0, with breaking changes appearing in minor releases. Version pinning and a scheduled upgrade cadence are mandatory.

---

## 2. Research Basis

This report consolidates four investigations:

| Investigation | Method | Coverage |
| --- | --- | --- |
| Chat app architecture map | Codebase exploration | Full `apps/chat` stack: route, services, stores, persistence, MCP, observability |
| Migration surface inventory | Codebase exploration | Every Prisma model, API route, service, and frontend module that a migration would touch, classified as replaces / coexists / conflicts |
| Mastra technical profile | Web research (docs, GitHub, blog) | Core primitives, storage, deployment, licensing, maturity |
| Verification pass (June 11) | Live docs + GitHub + npm | 15 compatibility-critical claims confirmed/refuted individually |
| Skills / memory / sub-agents feasibility (June 11) | Live docs + GitHub | Workspace Skills, Memory config granularity, supervisor pattern — each checked against caller-supplied history + branching constraints (§6.3) |

---

## 3. Where We Stand Today

### 3.1 Current chat architecture

| Layer | Implementation |
| --- | --- |
| Agent loop | Vercel AI SDK v6 `streamText`, single agent per chatbot, max 5 tool steps (`stopWhen: stepCountIs(5)`) |
| Tools | Exclusively dynamic MCP tools loaded per-request from `ChatbotMCPServer` / `ChatbotMCPConfig` DB rows (per-mode filtering, encrypted auth, tool namespacing, chatbot-id header injection) |
| Memory | None. Full thread history re-sent to the model on every request; no truncation, summarization, or semantic recall |
| RAG | Externalized to an opaque MCP server (`KB.doc_query`); no vector store, embeddings, or chunking in our repo |
| Conversation state | Custom Prisma schema: branching message tree via `parentId`, per-message `creditsUsed`, `chatMode`, `modelId`, `reasoningEffort`, `reasoningContent`; base64 image attachments with AI-generated descriptions |
| Billing | Custom `ChatUsageCredits` with period-aligned resets and atomic decrement transactions; credit balance drives primary-vs-fallback model selection |
| Providers | Single OpenAI-compatible base URL (Azure / OpenRouter), per-chatbot key/URL override, custom fetch workaround for an AI SDK Responses-API bug |
| Frontend | `@assistant-ui/react` + `useExternalStoreRuntime` + Zustand; hand-written SSE parser handling `text-delta`, `reasoning-delta`, tool events, and a custom `finish` event carrying credits/model metadata |
| Observability | Langfuse via OpenTelemetry + AI SDK telemetry; custom token/cost accounting |
| Evals | None |
| Workflows | None (Hatchet exists in the monorepo but is not wired to chat) |

### 3.2 Structural gaps

The current implementation is modern and clean at the request level, but lacks an agent-platform layer. Four gaps matter most:

1. **Unbounded context growth.** Long tutoring threads grow input cost linearly; there is no memory management of any kind.
2. **External retrieval (by design).** Course knowledge retrieval lives in the AI-infra `doc_query` MCP server. Decision (2026-06-11): this stays — retrieval quality is AI-infra's responsibility, and the MCP seam keeps it swappable. It is an architectural dependency to manage, not a gap for Mastra to fill.
3. **No provider resilience.** Model fallback is driven only by credit balance. A provider 500 or rate-limit fails the student's request outright.
4. **No quality measurement.** Prompt changes ship without any regression signal beyond manual browser testing.

---

## 4. Mastra Today (v1.41.0, June 2026)

### 4.1 Project state

| Aspect | State |
| --- | --- |
| Latest core version | `@mastra/core` 1.41.0 (June 4, 2026) |
| Companion packages (npm, June 11) | `@mastra/ai-sdk` 1.4.4 · `@mastra/mcp` 1.9.1 · `@mastra/pg` 1.12.1 · `@mastra/memory` 1.20.2 |
| Stability declaration | v1.0 January 2026; in practice, breaking changes still land in minor versions (codemods provided: `npx @mastra/codemod@latest v1`) |
| Velocity | 28 minor versions in ~12 weeks post-v1.0; releases every 1–3 days |
| License | Apache 2.0 core; `ee/` directory (Agent Builder production deployment, advanced RBAC, production Studio embedding) requires a commercial license from Kepler Software |
| Funding / team | $13M seed (Oct 2025, Boldstart); ~15–20 core engineers, ~50 contributors |
| Cloud | Mastra Cloud GA (May 2026, observability on ClickHouse); fully optional — all storage and observability self-hostable |

### 4.2 Shipped since v1.0 (selected)

| When | Feature |
| --- | --- |
| Feb 2026 | Observational Memory — background compression of old messages into dense observations (94.87% LongMemEval); no vector DB required |
| Mar 2026 | ObservabilityBus overhaul; persistent agent workspace filesystem |
| May 2026 | Response caching; A2A protocol (cross-framework agent delegation); Temporal integration for durable workflow execution; Agent Builder (low-code, EE for production); Observability Cloud |
| Jun 2026 | Agent Client Protocol (delegate coding tasks to Claude/Codex/Cursor CLIs); Agent Signals (multi-client stream subscription); OAuth ToolProviders; MySQL adapter; `agent.sendMessage()` message-first APIs; gateway embedding routing; `@mastra/react` MessageFactory (1.39.0) |

### 4.3 Trajectory

No single public roadmap page exists. The release pattern points toward deeper orchestration (Temporal, A2A, ACP, multi-client signals), a commercial observability/cloud layer, and an internal coding-agent product ("Mastra Code"). The core primitives relevant to us — agents, tools, workflows, memory, RAG, MCP — are all in the Apache 2.0 core and show no sign of moving behind the EE boundary. The EE pattern so far is: development-time features free, production-hardening features (Agent Builder deployment, Studio embedding, RBAC) paid.

---

## 5. Verified Compatibility Matrix

Every claim below was individually verified against live documentation, GitHub, and npm on June 11, 2026.

| # | Claim | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | Latest version 1.41.0 (Jun 4) | Confirmed | Active weekly feature releases |
| 2 | AI SDK v6 stream output | Confirmed | `toAISdkStream()` + `createUIMessageStream`/`createUIMessageStreamResponse` from the `ai` package is the recommended App Router pattern; route helpers accept `version: 'v6'` (default is v5 — flag is mandatory for us) |
| 3 | Official assistant-ui integration | Confirmed | Integration guides on both assistant-ui.com and mastra.ai; no `@assistant-ui/react-mastra` package exists or is needed — integration is at the route-handler level |
| 4 | Custom stream metadata | Confirmed with caveat | `messageMetadata` option on `createUIMessageStream` attaches metadata to start/finish chunks; `writer.custom()` for arbitrary data parts. Known issue: custom events emitted inside workflow steps get wrapped in `tool-output` parts (GitHub #9874, fix in progress) |
| 5 | Memory + `@mastra/pg` coexistence | Confirmed | `PostgresStore` + `PgVector` run on an existing Postgres DB; tables are `mastra_`-prefixed; `PgVector` supports `schemaName`; `PostgresStore` schema prefix is fixed but collision-safe |
| 6 | DB-driven dynamic agents | Confirmed | `instructions`, `model`, and `tools` can all be async functions of `RuntimeContext` resolved per request — maps directly to our chatbot-as-DB-row model |
| 7 | Model fallback arrays + custom base URLs | Confirmed | Fallback on 5xx/429/timeout after `maxRetries`; dynamic functions can return full fallback arrays; OpenAI-compatible gateways (Azure, OpenRouter) supported via custom base URL |
| 8 | MCPClient with per-request headers | Confirmed | `requestInit` headers per server; `getToolsets()` for per-request multi-tenant configs (our per-chatbot auth case); streamable HTTP with SSE fallback |
| 9 | Reasoning passthrough | Confirmed | Native `reasoning-delta` chunk type; `sendReasoning: true` on `toAISdkStream()`; OpenAI `reasoningEffort` via provider options. Removes an earlier concern |
| 10 | Workflow suspend/resume streaming | Partially confirmed | Stream ends at suspend; `resumeStream` API and `workflows.resumeWorkflow()` exist; arbitrary mid-stream reconnect for agent streams is a known open gap (GitHub #11579) |
| 11 | Stateless agent with caller-supplied history | Confirmed | Explicitly documented mode: with no `memory` configured, the agent sees only the messages passed per call (`CoreMessage[]` / `UIMessageWithMetadata[]` accepted). Our load-history-from-Prisma pattern is first-class |
| 12 | Full per-call execution options | Confirmed | `AgentExecutionOptions` carries per-call `instructions`/`system` override, `toolsets` (dynamic MCP), `modelSettings.maxOutputTokens`, `providerOptions` (e.g. `openai.reasoningEffort`/`store`), `stopWhen`/`maxSteps`, `abortSignal` — everything our route passes today |
| 13 | AI SDK provider instance as model | Confirmed | `model` accepts a `LanguageModelV2` instance directly — `createOpenAI({ baseURL, apiKey })(deploymentId)` works as-is; the model router string format is optional, not required. Per-chatbot key/URL override preserved |
| 14 | Token usage independent of exporters | Confirmed | `onFinish`/`onStepFinish`/`stream.usage` (and `processOutputResult`) expose input/output token counts programmatically regardless of Langfuse exporter config — credit billing unaffected |
| 15 | Observational Memory with caller-supplied history | **Refuted** | OM requires Mastra Memory + Mastra storage (`@mastra/pg`/libsql/mongodb) owning the thread history; its Observer/Reflector agents read and rewrite stored messages. It cannot be bolted onto caller-supplied history — see §9.2 Stage 3 |

**Net result:** nothing in our stack — `ai@6.0.91`, `@assistant-ui/react`, Zustand, Prisma/Postgres — is a hard blocker. The two soft spots are the workflow-step metadata wrapping bug (#9874, only relevant if we emit custom events from inside workflow steps) and stream reconnection after suspend (only relevant for long-running HITL workflows). The one refuted assumption is Observational Memory under Scope A (row 15).

---

## 6. What We Win

### 6.1 Immediate wins (available in Scope A, no schema changes)

| Win | Today | With Mastra | Impact |
| --- | --- | --- | --- |
| **Provider resilience** | Provider 500/rate-limit fails the request | Fallback model array retries the next provider automatically; dynamic functions allow per-chatbot fallback chains | High — directly visible to students during Azure incidents |
| **Skills** | Per-mode system prompts only (`Chatbot.systemPrompts` JSON) | Workspace Skills: versioned `SKILL.md` packages (instructions + references + scripts) stored DB-backed via `VersionedSkillSource` (Postgres support since Feb 2026), progressively disclosed to the agent via `skill`/`skill_read`/`skill_search` meta-tools instead of bloating the system prompt | High — lecturer-authored capability packages per chatbot, versioned and reusable across courses |
| **Working memory** | None | Persistent per-student facts (level, goals, recurring misconceptions) in `mastra_resources`, scope `'resource'` — independent of message history, branch-agnostic, updated via an injected `updateWorkingMemory` tool | High — personalized tutoring across threads and semesters, compatible with Scope A today |
| **Evals** | None | Native scorers: live evaluation on a sampled percentage of production traffic, CI mode, LLM-as-judge, datasets and experiments in Studio | High — prompt changes become measurable; pairs with the existing course-agent prompt design workflow |
| **Studio (dev)** | Manual browser testing via the deployed PWA | Local playground: test agents, inspect tool calls, replay traces, time-travel debug workflow steps | Medium — faster iteration on course agent prompts |
| **Richer streams** | Hand-parsed text/reasoning/tool events | Adds workflow-progress and agent-network data parts; native reasoning-delta chunks | Medium — enables progress UI for multi-step features |
| **MCP both directions** | Client only | Also expose our chatbots *as* MCP servers (e.g., to OLAT, Office add-in, or external tools) | Medium — new integration surface for free |
| **Guardrails / processors** | None (system prompt only) | Built-in, stable input/output processors usable on stateless agents: `PromptInjectionDetector`, `ModerationProcessor`, `PIIDetector` (redaction), `TokenLimiter`, `ToolCallFilter`, `CostGuardProcessor`, `SystemPromptScrubber` — all with per-request dynamic config and `onViolation` hooks | High for a student-facing university chatbot — prompt-injection and moderation defenses we currently lack entirely |
| **Context-window control (without OM)** | None — full history sent every request | `TokenLimiter` input processor trims oldest messages to a token budget per request; works in stateless mode | Medium — caps worst-case request cost on long threads today, independent of any memory migration |

### 6.2 Structural wins (unlock later, incrementally)

| Win | What it enables |
| --- | --- |
| **Sub-agents (supervisor pattern)** | Specialized sub-agents (router → subject tutor → exercise generator → grader), each auto-exposed as an `agent-<key>` tool; `agents` accepts a `requestContext` function, so per-chatbot sub-agent sets can be DB-driven. Adoptable now with a **two-level depth limit** (see §6.3) |
| **Durable workflows** | Multi-step tutoring flows with branching/parallel/loop control, suspend/resume, lecturer-approval gates; optional Temporal backend for production durability |
| **Agent Signals** (Jun 2026) | Injecting system events (background task completions, notifications) into a running or idle conversation without breaking the stream; multi-client thread subscription |
| **A2A / ACP protocols** | Future interop with non-Mastra agents (e.g., other UZH agent services) and coding-agent CLIs as those ecosystems mature |
| **Observational Memory** | **Not compatible with Scope A** (verified): OM's Observer/Reflector agents require Mastra storage to own thread history, and the docs explicitly warn against sending full history alongside it (timestamp-ordering bugs). A managed-messages path exists — see §9.5 for the full impact analysis and the per-chatbot opt-in pilot |
| **Semantic recall** | **Not compatible with Scope A** (verified): indexes only Mastra-stored messages, no external-index mechanism; with `scope: 'resource'` it would also recall from abandoned branches — a correctness problem for our tree model. See §9.5 |

---

### 6.3 Skills, memory, and sub-agents under our constraints (verified June 11, 2026)

Targeted research pass against the project's stated wishlist — skills, memory, sub-agents — with retrieval explicitly delegated to the AI-infra `doc_query` MCP server. Every verdict checked against the Scope-A constraints (caller-supplied history, Prisma-owned branching tree, DB-driven chatbot config).

#### Skills — adoptable now

Mastra has **two unrelated things called "skills"**; only one matters to us:

- *agentskills.io / `mastra-ai/skills` repo* — coding-agent tooling (SKILL.md files for Claude Code/Cursor to write better Mastra code). Not a runtime feature.
- **Workspace Skills** — a first-class runtime primitive (docs: `mastra.ai/docs/workspace/skills`). A `Workspace` carries skill directories (`SKILL.md` + optional `references/`, `scripts/`, `assets/`); agents attached to the workspace automatically receive `skill`, `skill_read`, and `skill_search` meta-tools. Progressive disclosure is handled by `SkillSearchProcessor` (on-demand discovery, BM25/vector/hybrid) instead of eager system-prompt injection.

Decisive for us: since the Feb 19, 2026 changelog, skills have **DB-backed storage with Postgres support** and a `VersionedSkillSource` serving immutable published versions from a content-addressable BlobStore. That maps directly onto our lecturer-configured, DB-driven chatbot model: lecturers author skill packages, publish versions, chatbots reference them — replacing today's single flat `systemPrompts[mode].prompt` string with structured, versioned, searchable capability packages. For simple cases, per-request `instructions: async ({ requestContext }) => …` remains the lighter alternative.

#### Memory — split verdict

| Memory type | Verdict | Mechanics |
| --- | --- | --- |
| **Working memory** | **Adoptable now — but see §9.6 for the preferred DIY variant** | Stores persistent per-student facts in `mastra_resources` keyed by `resourceId` (= our participant ID), scope `'resource'` — fully independent of message history and therefore branch-agnostic. Updated by the agent via an injected `updateWorkingMemory` tool; injected into context by `WorkingMemoryProcessor`. `readOnly: true` variants allow sub-agents to read but not write the profile. A ~1-week DIY equivalent (`ChatParticipantProfile` + custom tool) keeps the profile in our Prisma schema with existing deletion/export machinery and enables a student-facing transparency page — recommended instead (§9.6) |
| **Message-history persistence** | **Must be disabled — and can be** | `Memory` is configurable to not touch message history: omit the `MessageHistory` processor (nothing re-adds it), or set `readOnly: true` + `lastMessages: false`. Mastra then neither reads nor writes `mastra_messages`; our Prisma tree stays the sole source of truth |
| **Semantic recall** | **Not compatible** | Indexes only Mastra-stored messages; no external-indexing hook. Resource scope would recall from abandoned branches |
| **Observational Memory** | **Not compatible** | Requires storage ownership; docs explicitly warn that sending full client-side history causes message-ordering bugs. Dual-write (one Mastra thread per branch leaf) is technically conceivable but officially warned against and maintains two sources of truth — rejected |

Privacy note for working memory: it creates a new category of persistent per-student profile data (FERPA/FADP-relevant). Needs a retention/deletion story wired into our existing participant-deletion flows before production use.

#### Sub-agents — adoptable now, two-level limit

- **Supervisor pattern** is the (only) recommended mechanism — agent networks are **deprecated** and scheduled for removal; `handleNetworkStream` should not be used in new work.
- `agents:` accepts a `(requestContext) => Record<string, Agent>` function — per-chatbot sub-agent rosters resolved from our DB per request, consistent with how we resolve instructions and models.
- **Streaming visibility**: two-level delegation (supervisor → sub-agent) emits `agent-execution-start/end` and nested `agent-execution-event-*` parts the frontend can render. **Three-plus-level chains have an open bug** (mastra#15013, open since Apr 2026): no progressive updates, the UI sees a dead spinner during nested execution. Design constraint: keep delegation depth ≤ 2 until fixed.
- **Context control**: in stateless mode, sub-agents receive the supervisor's conversation by default; `messageFilter` trims what each delegation sees (down to just the delegation prompt). No per-invocation toolset override exists for sub-agents — the pattern is to construct sub-agent instances with the right toolsets inside the `agents` resolver function.
- **Workflow-as-tool HITL**: a suspended workflow tool surfaces `finishReason: 'suspended'` + `suspendPayload`; resume via `resumeStream`/`run.resume`. Requires a configured storage provider for run snapshots (acceptable: `@mastra/pg` tables used for workflow state only, not messages).

#### Net effect on the adoption plan

| Capability | Classification |
| --- | --- |
| Workspace Skills (DB-backed, versioned) | **Current work** — Stage 3a |
| Working memory | **Current work** — Stage 3a (after privacy review); DIY variant on our Prisma schema preferred (§9.6) |
| DIY semantic recall + conversation compression on our store | **Current/future work** — Stage 3a/3c per §9.6; compression gated on thread-length data |
| Sub-agents (two-level, DB-driven rosters) | **Current work, demand-driven** — Stage 3b |
| Workflow HITL, Agent Signals | **Future work** — Stage 3b/4 |
| Semantic recall, Observational Memory | **Not planned** — incompatible with Prisma-owned branching; revisit only with a storage-ownership rethink |
| Mastra RAG | **Explicitly rejected** — retrieval stays on AI-infra `doc_query` MCP |

---

## 7. What We Lose / What It Costs

| Loss / cost | Severity | Mitigation |
| --- | --- | --- |
| **API churn** | High (the main cost) | 28 minors in 12 weeks, breaking changes in minors. Pin exact versions; budget a half-day upgrade sprint every 4–6 weeks; rely on official codemods |
| **Direct provider control** | Medium | An abstraction layer sits between us and the LLM call. Our custom `responsesApiFetch` workaround for the AI SDK Responses-API bug must be re-validated through Mastra's provider layer (it may become unnecessary, or need re-implementation) |
| **Finish-event metadata is DIY** | Low | No native finish metadata; `messageMetadata` on `createUIMessageStream` covers our credits/model/mode payload. Roughly one day of work. Avoid emitting custom events from inside workflow steps until #9874 lands |
| **HITL stream ends at suspend** | Low (today), Medium (future) | Fine for our current single-shot chat. For future HITL workflows, the client must reconnect via `resumeStream` — no push notification on resume yet |
| **Bus factor** | Medium | 15–20 person startup vs. hyperscaler-backed alternatives. Apache 2.0 fork is the escape hatch; our Scope A design keeps the blast radius to two files |
| **EE boundary** | Low now, watch it | Core stays Apache; production Studio/Agent Builder/RBAC are paid. We need none of them for Scope A. Re-assess if the boundary moves |
| **New dependency weight** | Low | `@mastra/core` + `@mastra/ai-sdk` + `@mastra/mcp` (+ `@mastra/pg`, `@mastra/evals` later) in an already large monorepo |

### What we explicitly do NOT lose (under Scope A)

- The **message branching tree** (`parentId`, branch switching, edit-branching) — stays in our Prisma schema and Zustand store untouched.
- **Credits/billing** — `ChatUsageCredits`, atomic decrements, period resets, credit-driven model selection: all ours, all unchanged.
- **Auth and disclaimers** — participant JWT, course-participation gating, disclaimer acceptance: untouched.
- **The lecturer management plane** — all chatbot GraphQL types, resolvers, and the manage UI: untouched.
- **The frontend** — assistant-ui, Zustand stores, attachment adapter, branching UI: untouched (see Section 8).

---

## 8. How It Works with assistant-ui

This is the most important architectural finding: **Mastra ships no production UI and does not want to own the frontend.** Its UI story is "emit AI-SDK-compatible streams; bring your own UI." That is precisely the architecture we already have.

### 8.1 Integration model

There is no `@assistant-ui/react-mastra` runtime adapter, and none is needed. The officially documented pattern (on both assistant-ui.com and mastra.ai) is:

1. The Next.js route handler calls the Mastra agent's stream method.
2. `toAISdkStream()` from `@mastra/ai-sdk` converts Mastra's chunk stream into AI SDK UI-message parts (with `sendReasoning: true` for reasoning deltas).
3. The parts are piped through `createUIMessageStream` / `createUIMessageStreamResponse` from the `ai` package (v6) — optionally attaching our per-message metadata via the `messageMetadata` option.
4. The frontend consumes the response exactly as it consumes our current stream.

In other words: **Mastra replaces what is inside the route handler, not what is in front of it.** Our `RuntimeProvider`, `useExternalStoreRuntime` bridge, Zustand stores, SSE parsing hook, branching UI, and attachment adapter all keep working, because the wire format stays AI SDK v6.

### 8.2 Frontend-relevant deltas

| Concern | Assessment |
| --- | --- |
| AI SDK v6 wire format | Supported; the `version: 'v6'` flag (or the `toAISdkStream` pattern with v6 `ai` imports) is required — defaults target v5 |
| Reasoning rendering | Native `reasoning-delta` parts with `sendReasoning: true` — matches what our UI already parses |
| Tool-call rendering | Tool input/output state parts comparable to today's events |
| Credits/model/mode in finish event | Re-implemented via `messageMetadata` — one-time shim |
| Thread list / branching UI | Entirely ours already (Zustand + our DB); Mastra's thread management is simply not used |
| New possibilities | Workflow-progress (`data-workflow`) and agent-network (`data-network`) parts enable progress UI for future multi-step features; `@mastra/react` MessageFactory (1.39.0) offers type-safe part rendering if we ever want it |
| CopilotKit / AG-UI | A confirmed alternative integration offering generative UI and shared agent state, but it solves problems we have already solved with assistant-ui + Zustand. Not needed |

---

## 9. Migration Path

### 9.1 The scoping decision

Everything hinges on one choice: **does Mastra own conversation state, or only the agent loop?**

| | Scope A — engine only (recommended) | Scope B — full platform |
| --- | --- | --- |
| Conversation state | Ours (Prisma, branching, credits) | Mastra Memory (`mastra_threads` / `mastra_messages`) |
| Effort | Weeks; two files | Months; schema migration + full frontend state rewrite |
| Branching tree | Preserved | No Mastra equivalent — must be rebuilt on top |
| Per-message billing/mode/model fields | Preserved | No Mastra columns — sidecar tables required |
| Data migration | None | Backfill of all existing threads |
| Payoff over the other scope | All target wins (RAG, fallback, workflows, evals) achieved | Only adds Mastra-managed memory — which conflicts with our model |

Scope B fights our most differentiated features (branching, billing) for no compensating gain. **Scope A is the migration.**

### 9.2 Staged plan (Scope A)

**Stage 0 — prototype pilot (no production changes).** Build one representative course agent as a Mastra app in Studio: per-request dynamic instructions from a copied chatbot config, the AI-infra `doc_query` MCP server attached as a toolset, one or two Workspace Skills authored from existing course-prompt material, working memory enabled against a dev `@mastra/pg` store, and a toy two-level sub-agent delegation. This exercises exactly the wishlist (skills, memory, sub-agents) plus the MCP seam against a real retrieval backend, with zero production exposure — and gives the team a real read on Mastra's developer experience and version churn before any chat-route commitment. *Decision gate: DX verdict + prototype behaves correctly against the live `doc_query` server.*

**Stage 1 — engine swap in the chat route.** Replace the direct `streamText` call with a per-request dynamic Mastra agent: instructions resolved from `Chatbot.systemPrompts[mode]`, model resolved from our registry as a fallback array (primary + fallback + provider-error fallback), tools resolved via Mastra `MCPClient.getToolsets()` wrapping our existing per-mode/auth/namespacing config logic. Convert the output with `toAISdkStream` (reasoning enabled) and attach credits/model/mode metadata via `messageMetadata`. All persistence callbacks (user/assistant message upserts, attachment handling, credit decrement, abort handling) remain exactly where they are. *Decision gate: behavior parity verified in the browser (streaming, reasoning display, tool calls, credits display, branching, attachments) plus Langfuse trace continuity.*

**Stage 2 — evals.** Attach Mastra scorers to the agent: live sampling on production traffic, plus a CI dataset of representative course questions. Wire results into the prompt-design workflow so lecturer-facing prompt changes get a regression signal. *Decision gate: first caught regression or one semester of baseline data.*

**Stage 3a — skills + student profile (current work, after Stage 1).** Replace the flat `systemPrompts[mode].prompt` string with DB-backed Workspace Skills: lecturer-authored, versioned skill packages per chatbot, progressively disclosed via `SkillSearchProcessor`. Add the DIY working-memory equivalent per §9.6: `ChatParticipantProfile` in our Prisma schema + an `update_student_profile` tool + context injection — keeping student data under our deletion/export machinery and enabling a student-facing transparency page (Mastra's `mastra_resources` working memory remains the fallback if we prefer zero custom code). Prerequisites: privacy review for the persistent student profile (retention + wiring into participant deletion), and management-UI work so lecturers can author/publish skills. *Gate: privacy sign-off + one course running on skills with measured prompt-quality parity.*

**Stage 3b — sub-agents and orchestration (demand-driven).** Two-level supervisor delegations with DB-driven sub-agent rosters (`agents` as `requestContext` function), `messageFilter` limiting what each sub-agent sees; frontend renders `agent-execution-*` stream parts as delegation progress. Hold delegation depth at two levels until mastra#15013 (nested-delegation streaming) is fixed. Multi-step tutoring workflows with suspend/resume and lecturer-approval gates follow once a concrete course need exists (workflow snapshots use `@mastra/pg` for workflow state only). Agent Signals become relevant when we want background events injected into live conversations.

**Not planned:** semantic recall and Observational Memory (both require Mastra ownership of message history — incompatible with our branching model; dual-write explicitly warned against by the docs). The `TokenLimiter` processor remains the Scope-A-compatible cap on context growth. Mastra RAG: rejected by decision — retrieval stays on the AI-infra `doc_query` MCP server.

### 9.3 Service topology: extract the chat API into a standalone Hono service

The chat API currently lives inside the Next.js UI app. As part of Stage 1, it should move into a dedicated `apps/chat-api` Hono service, with `apps/chat` reduced to pure UI:

- **Why**: Mastra's native server is Hono (standalone is its first-class deployment shape, incl. Studio and future WebSocket/`resumeStream`/Agent Signals features that Next.js route handlers cannot host); the API's workload profile (long SSE streams, sharp, MCP fan-out) differs from UI serving and deserves independent scaling and rollout; a standalone API is the right surface for future multi-client consumers (PWA embedding, Office add-in, OLAT, MCP server exposure). The monorepo already has the pattern (`apps/response-api`).
- **Variant choice**: our own Hono app with **Mastra as a library** (not Mastra's server with custom routes bolted on). The route is dominated by KlickerUZH-specific concerns (participant auth, disclaimer gate, credits, branching persistence) that belong in an app we own; the library seam also minimizes exposure to Mastra's API churn. Shared agent definitions live in a `packages/chat-engine` package consumed by both the API and local Studio.
- **Sequencing**: two mechanical steps — (1) lift-and-shift the existing `streamText` route and services into Hono verbatim (Web-standard `Request`/`Response` ports directly; wire format unchanged, so parity verification is trivial; frontend only changes its API base URL), then (2) perform the Mastra engine swap inside the new service.
- **Costs**: CORS with credentials (cookie is `.klicker.com`-scoped, so `chat-api.klicker.com` receives it), Traefik/ingress/CSP wiring, a new deployable (chart, health check, Infisical + `turbo.json` globalEnv), and splitting the Next.js middleware into UI-side redirects and API-side auth middleware.
- **If Mastra is rejected at Stage 0**: the extraction retains modest value (scaling/deploy isolation) but drops in priority; do not extract for its own sake.

### 9.4 Effort concentration

| Changes | Where |
| --- | --- |
| Medium | Chat route handler internals (`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`) — swap stream producer, keep all persistence/billing callbacks |
| Medium | MCP service (`apps/chat/src/services/mcpClients.ts`) — rebase our DB-driven config logic onto Mastra's `MCPClient`/`getToolsets()` |
| Small | Metadata shim (`messageMetadata`), model-registry-to-fallback-array mapping |
| None | All other API routes, Prisma schema, GraphQL management plane, frontend, auth, disclaimers, credits |

---

### 9.5 Revisiting managed messages: what Scope B would actually cost (verified June 11)

Observational Memory and semantic recall are attractive enough to warrant a precise impact analysis of letting Mastra own message storage. A dedicated research pass into Mastra's storage internals (schema, clone APIs, OM/recall mechanics, migration story, production issue history) yields the following.

#### What turns out to be better than assumed

- **`cloneThread` is an official branching primitive**: clone a thread up to an edit point (by message IDs), continue in the new thread; returns a `messageIdMap`; clones the current OM generation with remapped references; re-creates embeddings for cloned messages.
- **`mastra_messages.metadata` (JSONB)** exists — `creditsUsed` (as string), `chatMode`, `modelId`, `reasoningEffort` can live there; `reasoningContent` maps losslessly into the V2 `reasoning` content part.
- **Data migration is feasible**: message IDs and `createdAt` are caller-settable, bulk insert supported, threads accept custom IDs — our UUIDs and timestamps survive a backfill.
- **Schema isolation is real**: `schemaName: 'mastra'` + `disableInit: true` keeps Mastra tables out of our Prisma schema and puts migration execution under our CI control.
- **Thread APIs suffice for the UI**: paginated `listThreads`/`listMessages`, metadata filters, auto-title generation.

#### What remains structurally bad

| Problem | Detail |
| --- | --- |
| **Branching becomes thread-cloning** | No in-thread tree; `listClones` is single-hop, so our multi-level `parentId` tree would be re-implemented as bookkeeping over cloned threads — with per-branch storage duplication, per-clone re-embedding cost, and only partial OM carry-over. We would rebuild what we have, worse |
| **Recall contamination** | Resource-scoped semantic recall searches *all* threads — including abandoned branches and cloned prefixes. No dedup of semantically identical forked content, no thread-exclusion mechanism. The scope you want for "tutor remembers" is exactly the scope that gets polluted |
| **Destructive edits are unsupported territory** | No `updateMessage` API; edit = `deleteMessages` + re-insert, non-atomic. OM observations of deleted messages persist in thread metadata with no reconciliation; no per-message embedding purge |
| **Persistence reliability history** | Verified production issues: messages saved only in `executeOnFinish` → user message lost on stream abort (#13984); FK violations losing messages (#10848); duplicate rows (#13438, #11091); `useChat`+`chatRoute` persistence gap (#12054, closed unresolved). We currently own abort-time persistence ourselves precisely because billing depends on it |
| **Schema churn on a data-bearing dependency** | 3+ storage changes requiring manual SQL in 5 months (TEXT→JSONB, missing columns post-upgrade, dedup constraints). `CREATE TABLE IF NOT EXISTS` does not evolve existing tables; no versioned migration system — changelog-driven `ALTER TABLE` plus `npx mastra migrate` |
| **Unbilled background LLM cost** | OM observer/reflector calls (default `gemini-2.5-flash`, ~every 6k message tokens, 3–8 calls per long session), recall embeddings on every saved message, title generation — all outside our per-message credit metering. Needs a cost-attribution decision |
| **Privacy surface** | OM compresses conversation content into stored observations; recall resurfaces old student conversations across threads. Same review burden as working memory, larger scope |

#### The three options, honestly priced

| Option | Branching | OM/Recall | Effort | Verdict |
| --- | --- | --- | --- | --- |
| **B-fork** — managed messages, branching preserved via `cloneThread` | Preserved (rebuilt on thread clones) | Yes, but recall polluted by clones | ~3+ months + permanent complexity tax | Rejected — rebuilds our tree with worse semantics |
| **B-linear** — managed messages, linear threads, destructive edit (edit/retry kept, branch-switching dropped) | Lost (switching), kept (edit-as-retry) | Yes, cleanly | ~2–3 months: route persistence rewrite, thread/message APIs onto Mastra storage, analytics onto raw SQL against `mastra` schema, attachment sidecar re-keying, frontend de-tree-ing, backfill (flatten tree: active path per thread), compensating logic for abort-persistence and edit atomicity | Viable **if** OM/recall value is proven and branch-switching is expendable |
| **Per-chatbot opt-in (hybrid)** — new "memory-enabled" chatbots use Mastra storage with linear threads; existing chatbots stay on Prisma tree | Per-chatbot: linear where memory on | Yes, on opted-in chatbots | ~3–5 weeks on top of Stage 1: flag-driven persistence path in the route, linear UI mode, no backfill | **Recommended pilot path** — OM/recall proven on one course before any migration decision |

#### Decision inputs to gather before choosing (production data, not opinion)

1. **Branch usage**: share of threads with more than one leaf (`ChatMessage.parentId` sibling analysis). If branch-switching is a single-digit-percent feature, B-linear/hybrid costs little UX.
2. **Thread length distribution**: share of threads exceeding ~10k–30k tokens. OM solves long-thread cost; if 95% of threads are short, `TokenLimiter` already covers us and OM is a non-problem.
3. **Cost attribution policy** for OM/embedding/title overhead (absorb as platform cost vs meter into credits).
4. **Privacy sign-off** for stored observations + cross-thread recall.

Sequencing is unchanged: **Scope A first regardless** — every Stage 1 artifact (Hono service, dynamic agent, MCP toolsets, metadata shim) carries over unchanged into any of these options; nothing is throwaway. The managed-messages decision is a separate gate, driven by the four inputs above — and §9.6 presents a fourth option that supersedes the hybrid pilot as the recommended path.

### 9.6 Scope A+: building the memory features ourselves on our own store (recommended)

OM and semantic recall are storage-bound in Mastra only because Mastra assumes it owns the messages. We own the messages — so the equivalents can be built on our schema, where the branching tree turns from liability into advantage. Mastra remains the engine (skills, sub-agents, workflows, guardrails, fallback, evals); the memory layer becomes ours.

#### DIY conversation compression (OM equivalent) — ~2–4 weeks, gated on data

- `ChatMessageSummary(anchorMessageId, summaryText, coveredTokens, model, cost, createdAt)`: a summary covers the path from root to its anchor message. Because branches share prefixes, a summary anchored at message M is valid for **every leaf descending from M** — branch-correct by construction, with none of OM's deleted-message or clone-partiality problems.
- Request flow: server finds the deepest summary anchor on the client-supplied branch path; context = summary + messages after the anchor. Missing/stale summary → trim via `TokenLimiter` now, enqueue async summarization for next time.
- Compression runs as a **Hatchet task** (infra we already operate; chat's first Hatchet use case), on a cheap model, with cost recorded on the summary row and **metered through our credits system** — unlike Mastra's unbilled observer/reflector calls.
- Quality risk (OM's LongMemEval score reflects prompt iteration we would redo) is mitigated two ways: Mastra's observer/reflector prompts are Apache 2.0 and can be lifted, and Stage 2 evals score summary fidelity.

#### DIY semantic recall — ~2–3 weeks

- pgvector on our existing Postgres; `ChatMessageEmbedding(messageId, embedding, threadId, participantId, chatbotId)` denormalized for filtered search. Embed-on-write via a batched Hatchet task (embedding cost negligible, metered by us).
- Retrieval: embed the latest user message, vector-search scoped by participant + chatbot, inject top-K excerpts into context before the agent call.
- **Strictly better semantics than Mastra's recall**: because we know the tree, SQL can restrict to active paths, dedupe forked prefixes, and exclude abandoned branches — the §9.5 contamination problem disappears entirely. Known friction: Prisma treats `vector` as `Unsupported`, so queries are raw SQL; HNSW index operations are ours to manage.

#### DIY working memory — ~1 week (revises the §6.3 recommendation)

Mastra's working memory works under Scope A, but the DIY version is trivially small and better-fitted: `ChatParticipantProfile(participantId, chatbotId, profile, updatedAt)` + one `createTool` (`update_student_profile`) + context injection. Student profile data stays in our Prisma schema — existing deletion/export/retention machinery applies directly, and it enables a transparency feature Mastra cannot give us: a "what the bot knows about me" page where students view, edit, and delete their profile. For a university product this control outweighs the convenience of `mastra_resources`.

#### What stays Mastra

Skills (DB-backed versioned Workspace Skills), sub-agents, workflows/HITL, guardrail processors, model fallback arrays, evals, Studio — the engine layer that Scope A buys. No reinvention there.

#### Resulting architecture

Context-assembly pipeline in our Hono service, entirely on our data: load branch path from Prisma → substitute summary for the old prefix → inject profile + recall block → Mastra agent (skills, sub-agents, guardrails, fallback) → persist + bill exactly as today → async Hatchet jobs (embed, summarize).

#### Comparison against the §9.5 options

| | Hybrid pilot | B-linear | **Scope A+ (DIY)** |
| --- | --- | --- | --- |
| Branching | Lost on opted-in chatbots | Lost | **Kept and leveraged** |
| Recall contamination | Present | Present | **Solved via tree-aware SQL** |
| Background LLM/embedding cost | Unmetered | Unmetered | **Metered through credits** |
| Storage-ownership / schema-churn exposure | Partial | Full | **None** |
| Effort | 3–5 wks | 2–3 months | **~5–8 wks total, incremental**: profile (1) → recall (2–3) → compression (2–4) |
| Memory quality | Mastra-proven | Mastra-proven | Ours to tune (lift Apache prompts + Stage 2 evals) |
| Future Mastra memory improvements | Inherited | Inherited | **Not inherited** |

**Verdict: Scope A+ supersedes both managed-messages options.** Honest costs: we own memory-quality tuning permanently and do not inherit Mastra's future memory work. Acceptable — the components are small, run on infrastructure we already operate (Postgres/pgvector, Hatchet), and remain individually gated: profile and recall justify themselves on pedagogy and privacy; compression is built only if the thread-length measurement (§9.5 decision input 2) shows real demand.

---

## 10. New Features and Development It Would Enable

Beyond fixing current gaps, Mastra opens product directions that are impractical to hand-roll on the current stack:

1. **Guided exam-preparation flows.** A durable workflow that walks a student through topic selection, practice questions, evaluation of answers, and targeted review — pausing (suspend) for student input at each step, resumable across sessions.
2. **Specialist agent teams per course.** A routing supervisor that delegates to a subject-matter tutor, an exercise generator, and a grading agent — each with its own instructions and tools, composed without bespoke orchestration code.
3. **Lecturer-in-the-loop content generation.** Workflows that draft quiz questions or feedback summaries and suspend for lecturer approval before anything reaches students.
4. **Cost-bounded long conversations.** Observational Memory compresses months-long tutoring threads, decoupling conversation length from per-request token cost.
5. **Personalized tutoring.** Working memory tracks per-student state (level, goals, recurring misconceptions) across threads and semesters.
6. **Lecturer-authored skill packages.** Course capabilities (exam-prep methodology, course-specific conventions, worked-example walkthroughs) become versioned, publishable Workspace Skills instead of one monolithic prompt string — reusable across chatbots and semesters, searchable by the agent on demand.
7. **Chatbots as a platform surface.** Exposing course agents as MCP servers makes them consumable from the Office add-in, OLAT, or any MCP-capable client without new bespoke APIs.
8. **Measured prompt engineering.** Scorers + datasets turn the course-agent prompt library into a tested artifact with regression detection, rather than a collection of hand-checked strings.
9. **Safety guardrails as configuration.** Prompt-injection detection, LLM-based moderation, PII redaction, and per-request cost guards become declarative per-chatbot processor configuration instead of bespoke engineering — increasingly relevant as chatbots reach exam-preparation and assessment-adjacent contexts.
10. **Response caching (alpha).** Identical resolved prompts can be served from Redis without an LLM call — potentially material for repeated course-FAQ-style questions, once the feature stabilizes.

---

## 11. Recommendation

1. **Adopt Scope A, staged.** Start with the Stage 0 prototype pilot (one course agent in Studio with skills, working memory, sub-agents, and the AI-infra `doc_query` MCP toolset) — zero risk to the chat app, and a real-world trial of Mastra's churn and DX on our team against the exact features we want.
2. **Never adopt Mastra Memory as system of record.** Our branching, billing, and mode model is a differentiator; Mastra's thread model cannot represent it.
3. **Pin versions and schedule upgrades.** Treat Mastra upgrades as planned maintenance (every 4–6 weeks), never automatic.
4. **Keep the MCP seam.** Both the RAG pilot and any future agent services should communicate with the chat app via MCP — it keeps every Mastra component independently replaceable and preserves the fork/exit option that Apache 2.0 gives us.
5. **Re-evaluate the EE boundary annually.** Core primitives are safely Apache today; if production-relevant features start migrating into `ee/`, revisit this assessment.
