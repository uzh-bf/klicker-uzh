# PLAN: Native Code-Execution Tool for Course Chatbots

Status: future / no branch started. Research base: [RESEARCH-codeapi-integration.md](RESEARCH-codeapi-integration.md). All file refs verified against `v3` @ `d6c7772f8` (2026-07-06).

## Goal

Give course chatbots (apps/chat) an `execute_code` tool: the LLM writes Python, it runs in the codeapi sandbox, real output flows back into the conversation. Two teaching payoffs, both evidence-backed (RESEARCH doc §evidence):

1. **Math**: tutor computes instead of guessing (+15pts GSM8K for program-aided over chain-of-thought; Khanmigo built exactly this). Matters most on our cheap routed model tiers.
2. **Python teaching**: tutor runs a student's snippet and shows the REAL traceback/result — no hallucinated output.

Deliberate decision (owner call): **native AI-SDK tool, NOT an MCP server**. Code execution is a fixed product feature; native keeps schema, validation, quotas, and rate limits in first-party code, adds no service to operate, and skips the per-request MCP handshake (MCP clients are created fresh on every chat request — `apps/chat/src/services/mcpClients.ts:144-172,234-272` — a native tool avoids that entirely). MCP stays for pluggable per-course experts (doc-query).

## Non-Goals (v1)

- No file/artifact round-trip (no matplotlib PNG rendering, no uploads into the sandbox) — v2, see Staging.
- No languages beyond Python exposed to the model.
- No student-authored "run my code" affordance in the UI — the model decides tool use (`toolChoice: 'auto'`); students paste code in chat as text.
- No changes to MCP machinery.

## Current state (code)

- Tools are 100% MCP-sourced today: assembled once per request at `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:882` (`getAggregatedMCPTools`), passed to `streamText` at `route.ts:1285`. No native `tool()` exists anywhere in apps/chat.
- AI SDK v6 (`ai@6.0.184`): `tool({ description, inputSchema, execute })` — field is **`inputSchema`** (zod), not the pre-v6 `parameters`. `execute: (input, options) => PromiseLike<OUTPUT>`.
- Loop cap: `stopWhen: stepCountIs(5)` (`route.ts:1287`) — tool call + result + follow-up all consume steps; shared across MCP + native tools.
- Per-chatbot config lives on the `Chatbot` row (fetched `route.ts:792-806`); precedent flags: `modelSelection Boolean @default(false)` (`packages/prisma/src/prisma/schema/chat.prisma:114`), `allowedModelIds String[]` (`:115`).
- Credits: token-cost-based only (`apps/chat/src/services/credits.ts`; `calcCost` `route.ts:1735-1745`), decremented post-stream (`route.ts:1436-1450` onFinish, `:1467-1505` onAbort). Side-cost injection precedent: `imageDescriptionCost` folded into `creditsUsed` at `route.ts:1316`.
- Tool rendering: everything falls through to text-only `ToolFallback` (`apps/chat/src/components/tool-fallback.tsx:74-79`, `<pre>` of JSON). One custom tool-UI exists but is unmounted: `apps/chat/src/components/tools-ui/rag-tool-ui.tsx:17` (`makeAssistantToolUI`, toolName-bound), commented out at `apps/chat/src/app/RuntimeProvider.tsx:267`.
- Auth guard pattern for chat API routes: `withChatbotAuth` (`apps/chat/src/lib/server/apiGuards.ts`; CODEBASE_NOTES.md:21).

## Proposed design

### 1. Tool definition + wiring

New `apps/chat/src/lib/tools/executeCode.ts`:

```ts
export const buildExecuteCodeTool = (ctx: { participantId: string; chatbotId: string; onCost: (c: number) => void }) =>
  tool({
    description: 'Run Python code in a secure sandbox. Use for real computation, verifying arithmetic, and demonstrating code behavior. No internet access, no package installation.',
    inputSchema: z.object({
      code: z.string().max(20_000),
      // v1: language fixed to python server-side; not model-controllable
    }),
    execute: async ({ code }) => {
      const jwt = await mintCodeapiJwt({ sub: ctx.participantId })   // TTL ≤300s, server-side key
      const res = await codeapiExec({ lang: 'python', code, jwt })   // POST /v1/exec, flat response
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

Wiring in route.ts: build after MCP tools (`route.ts:882-883`), merge at `route.ts:1285`:
`tools: { ...mcpTools, ...(chatbot.enableCodeExecution ? { execute_code: buildExecuteCodeTool(ctx) } : {}) }`.
Key collision: MCP names are `${server}_${tool}`-prefixed (`mcpClients.ts:56-85`) — unlikely but NOT impossible for `execute_code` (a server named `execute` with a tool `code` yields exactly that key, `mcpClients.ts:61`). Merge native tools LAST and guard: if the key already exists in `mcpTools`, log + let the native tool win (fixed product feature beats a coincidentally-named MCP tool); rename to `klicker_execute_code` only if a real collision materializes.

Timeout: tool-level `AbortSignal` at ~60s for chat UX (do NOT wait codeapi's full 300s JOB_TIMEOUT in a conversation) — on timeout return a structured `{ timedOut: true }` result so the model can tell the student, not throw.

### 2. Per-chatbot enablement

- `Chatbot.enableCodeExecution Boolean @default(false)` (chat.prisma, next to `modelSelection` `:114`) + migration. Flat boolean, `modelSelection` pattern — deliberately NOT the heavier ChatbotMCPConfig table (that's for configurable integrations; this is a fixed feature toggle).
- Opt-in per course chatbot via DB (same ops path as existing chatbot config; UI toggle in manage can come later).
- If per-chat-mode scoping is ever needed, `allowedReasoningEffortsByModel Json?` (`:116`) shows the JSON-map escalation path — not v1.

### 3. Cost + quota

- Follow `imageDescriptionCost` exactly: accumulate `codeExecutionCost` in the request scope, fold into `creditsUsed` in BOTH `onFinish` (`route.ts:1316`) and `onAbort` (`route.ts:1487`) paths. `CreditsService.decrementCredits` is unit-agnostic — no service change.
- `CODE_EXEC_CREDIT_COST`: flat per-invocation constant via env (start: equivalent of ~1–2k tokens of the default model; tune with usage data).
- Hard backstop: codeapi's own per-user 20 exec/30s limit (keyed on JWT `sub` = participantId). Client honors 429/`Retry-After` by returning a structured "busy, try again" tool result.
- Zero-credit chatbots: tool still works (cost decrements into negative balance handling as today's fallback-model logic — verify interaction with `route.ts:930-947` fallback gate; if credits exhausted, either disable tool for the request or let fallback model use it — decide in implementation, lean: tool follows model availability).

### 4. Rendering

- v1: dedicated tool UI via the existing (unmounted) pattern: `makeAssistantToolUI<{code}, ExecResult>({ toolName: 'execute_code', render })` mounted at `RuntimeProvider.tsx:267` where `<RAGToolUI/>` sits commented out. Render: collapsible code block (input) + stdout/stderr panes + exit status; running state while `status` streaming. Without this, ToolFallback still shows JSON — functional but ugly; ship the UI in v1 since it's small.
- Syntax highlighting for the code block: reuse whatever `packages/markdown` provides once rehypePrism is enabled (see further-features plan) or a minimal inline highlighter in the tool UI.

### 5. System-prompt contract (the pedagogy guard)

Per-chatbot system prompts (DB-driven) for enabled bots get a standard clause:

- USE the tool to: verify a student's numeric/code answer before confirming it; demonstrate actual behavior of code the student asks about; compute anything beyond trivial arithmetic.
- DO NOT: hand the student a complete solution run when they're supposed to practice — run THEIR attempt and guide from the real output; explain errors from the actual traceback.
- Evidence rationale in RESEARCH doc §evidence (accuracy proven; learning requires verify-and-guide, not answer-vending).

### 6. Security

- JWT minted server-side per tool invocation (route handler context), private key via Infisical/ESO env, never in client bundle. Claims per RESEARCH doc §auth (`tenant_id=klicker-<env>`, `sub=participantId`, TTL ≤300s).
- Prompt-injected malicious code is contained by the sandbox (no egress, non-root, ephemeral). Output truncation caps token/DOM blowups. `code` input capped at 20k chars.
- Log executions (participantId, chatbotId, wall_time, exit code — NOT code content by default) for abuse monitoring.

## Staging

| Stage | Adds | Notes |
|---|---|---|
| v1 | text-only exec (stdout/stderr), flat cost, per-chatbot flag, tool UI | this plan |
| v2 | matplotlib/image round-trip: exec `files[]` output → authenticated proxy route (`apps/chat/src/app/api/.../artifact/[...]` minting JWT for `/v1/download?kind=user`) → render `<img>` in tool UI | precedent for base64 image rendering: `message-attachments.tsx:146-151` |
| v3 | file uploads into sandbox (CSV analysis etc.) | blocked on general non-image attachments: `ChatAttachmentType` enum has only `IMAGE` today (`chat.prisma:9-11`) — separate feature |

## Implementation slices (when a branch starts)

1. codeapi client lib + JWT minter (shared with CODE-element plan — build once, e.g. `packages/` or `apps/chat/src/lib/server/codeapi.ts` first, extract when element work starts) + unit tests vs claim fixture. Check: live exec against stg codeapi from a script.
2. Prisma flag + migration + tool definition + route wiring behind flag. Check: flagged bot calls tool end-to-end locally (LOCAL_MODE codeapi), unflagged bot unchanged.
3. Cost fold-in (onFinish + onAbort) + 429 handling + timeout behavior. Check: credits decrement includes exec cost in both paths.
4. Tool UI + mount. Check: playwright e2e (repo has chat e2e infra per `d6c7772f8`) — visible code + output panes.
5. Prompt clause rollout to 1–2 pilot chatbots + manual tutoring-scenario validation (math verify, traceback explain).

Effort: **3–5 dev-days** for v1 (small, additive, no schema surgery beyond one column) + prompt iteration.

## Testing strategy

- Unit: JWT claims shape, exec client (flat response parsing, 429/timeout paths), cost accumulation.
- Integration: route with flag on/off against LOCAL_MODE codeapi.
- E2E: playwright chat flow with mocked model forcing a tool call.
- Manual: pilot chatbot, real course questions (math verification + Python traceback scenarios).

## Open questions

1. Step budget: is `stepCountIs(5)` enough for exec→interpret→follow-up plus MCP RAG calls in one turn? Watch in pilot; bump per-chatbot if needed.
2. Credit price of one execution (flat vs wall-time-scaled) — start flat, revisit with data.
3. Zero-credit/fallback-model interaction (§3) — disable tool or allow on fallback?
4. Show executed code to the student always, or collapse by default? (Pedagogy lean: always visible — transparency is part of the teaching value.)
5. ~~Same `tenant_id` for chat tool and CODE element, or split?~~ **Resolved: one Klicker-wide tenant per RESEARCH doc §identity mapping** — outputs are user-scoped via `sub` anyway; do not reopen per surface.
