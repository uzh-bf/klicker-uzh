# PLAN: Native Code-Execution Tool for Course Chatbots

Status: future / blocked on the Mastra chat-api dependency. Research base: [RESEARCH-codeapi-integration.md](RESEARCH-codeapi-integration.md). All `v3` file refs verified @ `d6c7772f8` (2026-07-06).

**Updated 2026-07-12 for the Mastra migration** ([PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126): standalone `apps/chat-api` service + `packages/chat-engine`; [PR #5129](https://github.com/uzh-bf/klicker-uzh/pull/5129): tutor layer stacked on it): the chat execution loop moves out of apps/chat into the Mastra-based chat-api service, so this plan now targets that stack. Mastra-branch refs verified against `codex/mastra-chat-openrouter-smoke` (2026-07-12). The pre-Mastra design (direct apps/chat route wiring) is preserved in git history (`832579e56`) in case the tool must ship before the migration merges.

Dependency check 2026-07-23: [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) remains draft, has merge state `DIRTY`, and its current head has a failing GitGuardian check. `apps/chat-api` and `packages/chat-engine` are absent from `v3` @ `c8de9c897`; do not start slices 2–5 from `v3`. The shared codeapi client may be built by whichever implementing branch needs it first, but it must ship with that implementation rather than as a standalone plan/client PR.

## Progress

- 2026-07-23: dependency and `v3` presence rechecked; the Mastra target remains unavailable on `v3`.
- Blocked: merge and secure [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126), then re-verify its tool, credits, streaming, and deployment seams.
- Next: after the dependency lands, create a dated active implementation plan from current `v3` and carry it with the code.

## Goal

Give course chatbots (apps/chat) an `execute_code` tool: the LLM writes Python, it runs in the codeapi sandbox, real output flows back into the conversation. Two teaching payoffs, both evidence-backed (RESEARCH doc §evidence):

1. **Math**: tutor computes instead of guessing (+15pts GSM8K for program-aided over chain-of-thought; Khanmigo built exactly this). Matters most on our cheap routed model tiers.
2. **Python teaching**: tutor runs a student's snippet and shows the REAL traceback/result — no hallucinated output.

Deliberate decision (owner call): **native tool, NOT an MCP server**. Code execution is a fixed product feature; native keeps schema, validation, quotas, and rate limits in first-party code, adds no service to operate, and skips the per-request MCP handshake (MCP clients/toolsets are created fresh on every chat request in both stacks — `apps/chat/src/services/mcpClients.ts:144-172,234-272` today, `apps/chat-api/src/index.ts:288` + `disconnectAll` after stream on the Mastra branch — a native tool avoids that entirely). The decision survives the Mastra migration unchanged; it just becomes a native **Mastra `createTool`** instead of a raw AI-SDK `tool()`. MCP stays for pluggable per-course experts (doc-query).

## Non-Goals (v1)

- No file/artifact round-trip (no matplotlib PNG rendering, no uploads into the sandbox) — v2, see Staging.
- No languages beyond Python exposed to the model.
- No student-authored "run my code" affordance in the UI — the model decides tool use (`toolChoice: 'auto'`); students paste code in chat as text.
- No changes to MCP machinery.

## Current state (code)

Two worlds; this plan targets the second (Mastra).

**v3 today (apps/chat, pre-migration):** tools are 100% MCP-sourced, assembled per request at `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:882`, passed to `streamText` (AI SDK v6, `ai@6.0.184`) at `route.ts:1285` with `stopWhen: stepCountIs(5)`; credits are token-cost-based with the `imageDescriptionCost` side-cost fold-in at `route.ts:1316` (onFinish `:1436-1450`, onAbort `:1467-1505`). Full detail + the matching tool design: git history of this plan (`832579e56`).

**Mastra target ([PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126), base v3; refs against `codex/mastra-chat-openrouter-smoke`):**

- New standalone Hono service `apps/chat-api` owns the chat loop; apps/chat keeps auth/UI and proxies to it. `streamText` is replaced by engine `buildAgent` + `agent.stream` + `@mastra/ai-sdk` `toAISdkStream` (`apps/chat-api/src/index.ts:11,855-865`) — the response is still an AI-SDK-shaped UI message stream, so the frontend story is unchanged in kind.
- Engine `packages/chat-engine` (`@mastra/core@1.41.0`, `@mastra/mcp@1.9.1`) is deliberately DB-free: `buildAgent(chatbot, mode, primaryModelId, extras)` builds a per-request Mastra `Agent`; **`AgentExtras.tools?: ToolsInput` is the designed seam for native tools** (`packages/chat-engine/src/agent.ts:17-21,141`). Nothing uses it yet — MCP toolsets are the only tools passed today.
- MCP tools via Mastra `MCPClient` (`packages/chat-engine/src/mcp.ts`), preserving the `${server}_${tool}` namespacing + allowedTools filtering; the host loads `ChatbotMCPServer` rows and merges toolsets at `apps/chat-api/src/index.ts:288` (`loadMcpTools`), handed into the agent at `:620-631`, disconnected after the stream (`:944-949`).
- Step cap: `maxSteps: 5` (`index.ts:710`) — same budget as today's `stepCountIs(5)`.
- Credits live in chat-api §2.10: `creditsUsed` from `event.totalUsage` with the **`imageDescriptionCost` fold-in pattern preserved** on BOTH normal finish (`:732-776`) and abort (`:787-811`, fold at `:804`); `packages/chat-engine/src/cost.ts` mirrors `calcCost` exactly.
- Model-level retries/fallback are Mastra-native: `model: [{ model: primary }, { model: fallback }]` retries the next entry on 5xx/429/timeout (`agent.ts:120-141`) — replaces the route's fallback-model gate. This covers MODEL errors only, not tool errors.
- Per-chatbot flags unchanged: `modelSelection` / `allowedModelIds` on the `Chatbot` row (`packages/prisma/src/prisma/schema/chat.prisma:114-115`); chat-api reads the row and maps it into the engine's `ChatbotConfig` (`index.ts:610-619`).
- Tool rendering: apps/chat stays the frontend; `tool-fallback.tsx` is retained on the branch and the unmounted `makeAssistantToolUI` pattern (`apps/chat/src/components/tools-ui/rag-tool-ui.tsx:17`, mount point `apps/chat/src/app/RuntimeProvider.tsx:267`) still applies to the AI-SDK-shaped stream.

## Proposed design

### 1. Tool definition + wiring (Mastra)

New `packages/chat-engine/src/tools/executeCode.ts` — engine stays DB-free, so the flag check and identity context are injected by the host:

```ts
import { createTool } from '@mastra/core/tools'

export const buildExecuteCodeTool = (ctx: {
  participantId: string
  chatbotId: string
  onCost: (c: number) => void
}) =>
  createTool({
    id: 'execute_code',
    description:
      'Run Python code in a secure sandbox. Use for real computation, verifying arithmetic, and demonstrating code behavior. No internet access, no package installation.',
    inputSchema: z.object({
      code: z.string().max(20_000),
      // v1: language fixed to python server-side; not model-controllable
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable(),
      wallTimeMs: z.number().nullable(),
      timedOut: z.boolean().optional(),
    }),
    execute: async ({ code }, context) => {
      const jwt = await mintCodeApiJwt(loadCodeApiConfig(), {
        subject: ctx.participantId,
        role: 'PARTICIPANT',
      }) // helper adds the complete CodeAPI claim set and signs with TTL ≤300s
      const res = await codeapiExec({
        lang: 'python',
        code,
        jwt, // POST /v1/exec, flat response
        signal: withTimeoutSignal(context?.abortSignal, 60_000),
      })
      ctx.onCost(CODE_EXEC_CREDIT_COST)
      return {
        stdout: truncate(res.stdout, 8_000),
        stderr: truncate(res.stderr, 4_000),
        exitCode: res.code,
        wallTimeMs: res.wall_time,
      }
    },
  })
```

Wiring in apps/chat-api: build after the MCP toolset load (`index.ts:288`) and merge into the agent-build extras (`:620-631`):
`tools: { ...mcpToolset.tools, ...(chatbot.enableCodeExecution ? { execute_code: buildExecuteCodeTool(ctx) } : {}) }` — the flag gate lives host-side (engine has no Prisma access, by design). Key collision: Mastra MCP tool names are `${server}_${tool}`-namespaced same as before (`chat-engine/src/mcp.ts` mirrors `mcpClients.ts:61`) — unlikely but NOT impossible for `execute_code`. Merge native LAST and guard: if the key already exists, log + let the native tool win (fixed product feature beats a coincidentally-named MCP tool); rename to `klicker_execute_code` only if a real collision materializes.

Timeout: Mastra passes `context.abortSignal` into `execute` (client disconnect/stream abort propagates automatically) — combine it with our own ~60s UX cap (do NOT wait codeapi's full 300s JOB_TIMEOUT in a conversation). On timeout return a structured `{ timedOut: true }` result so the model can tell the student, not throw.

### 2. Per-chatbot enablement

- `Chatbot.enableCodeExecution Boolean @default(false)` (chat.prisma, next to `modelSelection` `:114`) + migration. Flat boolean, `modelSelection` pattern — deliberately NOT the heavier ChatbotMCPConfig table (that's for configurable integrations; this is a fixed feature toggle).
- Opt-in per course chatbot via DB (same ops path as existing chatbot config; UI toggle in manage can come later).
- If per-chat-mode scoping is ever needed, `allowedReasoningEffortsByModel Json?` (`:116`) shows the JSON-map escalation path — not v1.

### 3. Cost + quota

- Follow `imageDescriptionCost` exactly — the pattern survives the migration intact: accumulate `codeExecutionCost` in the request scope of apps/chat-api, fold into `creditsUsed` in BOTH the normal-finish path (`index.ts:732-776`) and the abort path (`:787-811`, existing fold at `:804`). `CreditsService.decrementCredits` (ported to `apps/chat-api/src/services/credits.ts`) is unit-agnostic — no service change.
- `CODE_EXEC_CREDIT_COST`: flat per-invocation constant via env (start: equivalent of ~1–2k tokens of the default model; tune with usage data).
- Hard backstop: codeapi's own per-user 20 exec/30s limit (keyed on JWT `sub` = participantId). Client honors 429/`Retry-After` by returning a structured "busy, try again" tool result.
- Zero-credit chatbots: tool still works (cost decrements into negative balance handling). NOTE the fallback semantics changed under Mastra: model fallback is now a Mastra model list retrying on provider errors (`agent.ts:120-141`), not a credit-gated route decision — verify how credit exhaustion is gated in chat-api and decide whether the tool follows model availability there (lean: yes).

### 4. Rendering

- v1: dedicated tool UI via the existing (unmounted) pattern: `makeAssistantToolUI<{code}, ExecResult>({ toolName: 'execute_code', render })` mounted at `RuntimeProvider.tsx:267` where `<RAGToolUI/>` sits commented out. This is unaffected by the migration: chat-api emits an AI-SDK-shaped UI message stream via `@mastra/ai-sdk` `toAISdkStream`, so assistant-ui tool parts render the same way. Render: collapsible code block (input) + stdout/stderr panes + exit status; running state while `status` streaming. Without this, ToolFallback still shows JSON — functional but ugly; ship the UI in v1 since it's small.
- Syntax highlighting for the code block: reuse whatever `packages/markdown` provides once rehypePrism is enabled (see further-features plan) or a minimal inline highlighter in the tool UI.

### 5. System-prompt contract (the pedagogy guard)

Per-chatbot system prompts (DB-driven) for enabled bots get a standard clause:

- USE the tool to: verify a student's numeric/code answer before confirming it; demonstrate actual behavior of code the student asks about; compute anything beyond trivial arithmetic.
- DO NOT: hand the student a complete solution run when they're supposed to practice — run THEIR attempt and guide from the real output; explain errors from the actual traceback.
- Evidence rationale in RESEARCH doc §evidence (accuracy proven; learning requires verify-and-guide, not answer-vending).

### 6. Security

- JWT minted server-side per tool invocation (route handler context), private key via Infisical/ESO env, never in client bundle. `mintCodeApiJwt` receives the semantic subject/role and derives the complete CodeAPI contract: `iss`, `aud`, `sub`, `jti`, `iat`, `nbf`, `exp` (TTL ≤300s), `tenant_id=klicker-<env>`, `principal_source=klicker_jwt`, and `auth_context_hash`.
- Prompt-injected malicious code is contained by the sandbox (no egress, non-root, ephemeral). Output truncation caps token/DOM blowups. `code` input capped at 20k chars.
- Log executions (participantId, chatbotId, wall_time, exit code — NOT code content by default) for abuse monitoring.

### 7. Why inline await, not Hatchet (owner question, 2026-07-12)

Deliberate: the chat tool does NOT go through Hatchet, in contrast to the CODE element (whose plan IS Hatchet-based). Reasons:

- The tool result must flow back into the SAME streaming agent loop before the model can generate its next tokens — a durable queue would still block this request while adding a hop and cross-process result plumbing.
- Queueing/backpressure already exists server-side: codeapi holds the exec request while the job queues internally (BullMQ + KEDA, `JOB_TIMEOUT` 300s). Hatchet in front would double-queue.
- Exec is stateless/idempotent → a thin client-side retry (capped attempts, honor 429 `Retry-After`) beats durable retries. The student is watching a spinner; a structured `{busy}`/`{timedOut}` result the model can narrate is better UX than minutes of silent queue retries.
- Nothing to make durable: if the student closes the tab, the result has no consumer — the abort SHOULD kill the execution, and Mastra's `abortSignal` propagation into `execute` does exactly that.
- chat-api is a long-running k8s Hono service — no serverless timeout pressure on holding the stream open.
- Mastra does not change this: its retries are model-level (provider errors), and its in-process workflows (`chat-engine/src/tutor/workflow.ts` on [PR #5129](https://github.com/uzh-bf/klicker-uzh/pull/5129)) are per-turn orchestration, not durable queue-backed execution. No native async/deferred server-tool mechanism applies here.

The CODE element is the opposite case — grading outlives the request, must survive worker restarts, and finalizes persistent state → Hatchet durable task there (see element plan).

## Staging

| Stage | Adds | Notes |
|---|---|---|
| v1 | text-only exec (stdout/stderr), flat cost, per-chatbot flag, tool UI | this plan |
| v2 | matplotlib/image round-trip: exec `files[]` output → authenticated proxy route (chat-api minting JWT for `/v1/download?kind=user`) → render `<img>` in tool UI | precedent for base64 image rendering: `message-attachments.tsx:146-151`. Mastra helps here: `createTool`'s `toModelOutput` can hand the model multimodal content parts (image) while the app keeps the raw output for the UI |
| v3 | file uploads into sandbox (CSV analysis etc.) | blocked on general non-image attachments: `ChatAttachmentType` enum has only `IMAGE` today (`chat.prisma:9-11`) — separate feature |

## Implementation slices (when a branch starts)

Sequencing: **build after [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) (Mastra chat-api) merges and its security check is resolved**. The tool seam (`AgentExtras.tools`), credits path, and deploy surface all live there, and implementing twice (route.ts now, chat-api later) is waste. Re-verify all Mastra file refs and pinned APIs after that merge. If urgency flips the order, explicitly approve the pre-Mastra design in git history (`832579e56`) and accept the later port.

1. codeapi client lib + JWT minter as a small shared `packages/` module (consumed by apps/chat-api now and the CODE element's Hatchet grading worker later — build once, do NOT bury it in an app) + unit tests vs claim fixture. Check: live exec against stg codeapi from a script.
2. Prisma flag + migration + `createTool` definition in chat-engine + chat-api wiring behind flag. Check: flagged bot calls tool end-to-end locally (LOCAL_MODE codeapi + local chat-api), unflagged bot unchanged.
3. Cost fold-in (finish + abort paths in chat-api §2.10) + 429 handling + timeout behavior. Check: credits decrement includes exec cost in both paths.
4. Tool UI + mount in apps/chat. Check: playwright e2e (repo has chat e2e infra per `d6c7772f8`) — visible code + output panes.
5. Prompt clause rollout to 1–2 pilot chatbots + manual tutoring-scenario validation (math verify, traceback explain).

Effort: **3–5 dev-days** for v1 (small, additive, no schema surgery beyond one column) + prompt iteration. Unchanged by the migration — the Mastra seam is if anything cleaner (designed extras hook + existing side-cost plumbing).

## Testing strategy

- Unit: JWT claims shape, exec client (flat response parsing, 429/timeout paths), cost accumulation.
- Integration: chat-api with flag on/off against LOCAL_MODE codeapi (the chat-api OpenRouter smoke on [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) is the harness precedent).
- E2E: playwright chat flow with mocked model forcing a tool call.
- Manual: pilot chatbot, real course questions (math verification + Python traceback scenarios).

## Open questions

1. Step budget: is `maxSteps: 5` (chat-api `index.ts:710`; same budget as the old `stepCountIs(5)`) enough for exec→interpret→follow-up plus MCP RAG calls in one turn? Watch in pilot; bump per-chatbot if needed.
2. Credit price of one execution (flat vs wall-time-scaled) — start flat, revisit with data.
3. Zero-credit/fallback-model interaction (§3) — under Mastra, fallback is provider-error-driven, not credit-gated; clarify credit-exhaustion gating in chat-api and whether the tool follows it.
4. Show executed code to the student always, or collapse by default? (Pedagogy lean: always visible — transparency is part of the teaching value.)
5. ~~Same `tenant_id` for chat tool and CODE element, or split?~~ **Resolved: one Klicker-wide tenant per RESEARCH doc §identity mapping** — outputs are user-scoped via `sub` anyway; do not reopen per surface.
