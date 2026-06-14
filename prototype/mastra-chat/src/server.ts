// S0 Hono service: replaces the chat app's streamText call with a Mastra agent,
// converts to the AI SDK v6 UI-message stream, and re-attaches our per-message
// finish metadata (modelId/chatMode/creditsUsed) via messageMetadata.
// We keep persistence in our own store (see db.ts) — Mastra owns no messages.
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createUIMessageStreamResponse } from 'ai'
import { toAISdkStream } from '@mastra/ai-sdk'
import { buildAgent, responsesProviderOptions } from './engine/agent.js'
import type { AgentExtras } from './engine/agent.js'
import { buildMcpToolset, loadKbServerConfig } from './engine/mcp.js'
import { buildInputProcessors, DEFAULT_GUARDRAILS } from './engine/guardrails.js'
import type { GuardrailConfig } from './engine/guardrails.js'
import { buildProfileTool, profileContext } from './engine/profileTools.js'
import { buildSkillTools } from './engine/skillTools.js'
import { costForTokens } from './engine/cost.js'
import { withObservability } from './engine/observability.js'
import { getChatbot } from './db.js'
import { env } from './env.js'

// Minimal structural view of a converted v6 UI part (the reasoning accumulator
// inspects type + delta and patches the finish part's metadata).
type UiPart = { type: string; delta?: string; messageMetadata?: Record<string, unknown> }

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.post('/api/chat', async (c) => {
  const body = await c.req.json<{
    chatbotId: string
    mode?: string
    model?: string
    messages: unknown[]
    mcp?: boolean // S1: attach the doc_query toolset
    guardrails?: GuardrailConfig | false // S1: override the per-mode guardrail policy
    participantId?: string // S3: attach update_profile tool + inject profile context
    skills?: boolean // S2: attach skill_search + skill (progressive disclosure)
    reasoningEffort?: string // A2: request reasoning tokens ('low'|'medium'|'high'|'none')
  }>()
  const mode = body.mode ?? 'tutor'
  const chatbot = await getChatbot(body.chatbotId)
  if (!chatbot) return c.json({ error: 'chatbot not found' }, 404)

  const modelId = body.model ?? env.PRIMARY_MODEL_ID
  const extras: AgentExtras = {}
  let disconnectMcp: (() => Promise<void>) | null = null

  // S1a — retrieval: rebind the DB-driven KB config onto Mastra's MCP client.
  if (body.mcp) {
    const kb = await loadKbServerConfig()
    if (kb) {
      const toolset = await buildMcpToolset(
        { ...kb, url: env.PROTO_MCP_URL }, // real backend down: connect to the stub
        chatbot.id,
        ['doc_query']
      )
      extras.tools = toolset.tools
      disconnectMcp = toolset.disconnect
      console.log('[chat] MCP tools attached:', toolset.toolNames.join(', '))
    }
  }

  // S1b — guardrails: build input processors from the (overridable) policy.
  const guardrailCfg = body.guardrails === false ? null : body.guardrails ?? DEFAULT_GUARDRAILS
  if (guardrailCfg) {
    extras.inputProcessors = buildInputProcessors(guardrailCfg)
  }

  // S3 — student profile: attach the update_profile tool and inject stored facts.
  if (body.participantId) {
    extras.tools = { ...(extras.tools ?? {}), update_profile: buildProfileTool(body.participantId, chatbot.id) }
    extras.instructionsSuffix = await profileContext(body.participantId, chatbot.id)
  }

  // S2 — skills: attach the discovery+activation tools and nudge progressive disclosure.
  if (body.skills) {
    extras.tools = { ...(extras.tools ?? {}), ...buildSkillTools() }
    extras.instructionsSuffix =
      (extras.instructionsSuffix ?? '') +
      '\n\nBefore answering a how-to, study, or coaching request, call skill_search to see if a ' +
      'course skill applies; if one does, call skill to load it and follow its instructions.'
  }

  const agent = withObservability(buildAgent(chatbot, mode, modelId, extras))

  // A2 — Responses API options: the engine owns the provider→options mapping
  // (store:true always; reasoningEffort/reasoningSummary when reasoning is
  // engaged), so we just hand the result to agent.stream. reasoningOn gates the
  // reasoning finish metadata.
  const { options: providerOptions, reasoningOn } = responsesProviderOptions(modelId, body.reasoningEffort)

  const stream = await agent.stream(body.messages as never, {
    abortSignal: c.req.raw.signal,
    providerOptions,
  })

  const uiStream = toAISdkStream(stream, {
    from: 'agent',
    version: 'v6',
    sendReasoning: true,
    // Finish-metadata shim: our UI depends on these on the finish chunk.
    // creditsUsed is computed from the real token usage Mastra's bridge attaches
    // to the finish part (totalUsage), using the same token-cost calcCost formula
    // as the production chat route. (Production also adds an imageDescriptionCost
    // term; the prototype has no image pipeline, so that term is always zero here.)
    // Null when the model price or usage is unavailable — we never silently
    // charge zero. reasoningContent is NOT built here — it is injected race-free by
    // the accumulator below (see there for why a finish-time read would drop it).
    messageMetadata: ({
      part,
    }: {
      part: { type: string; totalUsage?: { inputTokens?: number; outputTokens?: number } }
    }) => {
      if (part.type !== 'finish') return undefined
      const usage = part.totalUsage
      const creditsUsed = usage
        ? costForTokens(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0)
        : null
      // A2: mirror what apps/chat emits — the requested effort. Null when reasoning
      // was not engaged (non-reasoning model, or no/`none` effort).
      return {
        modelId,
        chatMode: mode,
        creditsUsed,
        reasoningEffort: reasoningOn ? body.reasoningEffort : null,
      }
    },
  })

  // A2 — reasoning accumulator: every reasoning-delta is emitted BEFORE the finish
  // chunk (stream ordering), so accumulating here and patching the finish part's
  // metadata is race-free. Reading a shared var populated by Mastra's onStepFinish
  // instead would intermittently drop the summary: under HTTP backpressure the
  // finish chunk can be built before that step callback runs, leaving the metadata
  // empty even though the reasoning streamed to the client.
  let reasoningContent = ''
  const withReasoning = (uiStream as unknown as ReadableStream<UiPart>).pipeThrough(
    new TransformStream<UiPart, UiPart>({
      transform(part, controller) {
        if (part.type === 'reasoning-delta') reasoningContent += part.delta ?? ''
        // Patch reasoningContent onto a COPY of the finish part — never mutate the
        // chunk object toAISdkStream emitted (it owns that reference).
        controller.enqueue(
          part.type === 'finish'
            ? {
                ...part,
                messageMetadata: {
                  ...(part.messageMetadata ?? {}),
                  reasoningContent: reasoningOn ? reasoningContent || null : null,
                },
              }
            : part
        )
      },
    })
  )

  // Cast bridges a known version skew: Mastra vendors its own ai-v6 chunk types
  // whose finish chunk allows finishReason 'unknown', while the app's `ai`
  // package narrows it out. Runtime chunks are identical; only the types differ.
  const response = createUIMessageStreamResponse({
    stream: withReasoning as unknown as Parameters<
      typeof createUIMessageStreamResponse
    >[0]['stream'],
  })

  // Release the per-request MCP client once the response body is fully drained
  // (or the client aborts). Avoids leaking a connection per request.
  if (disconnectMcp && response.body) {
    const cleanup = disconnectMcp
    const monitored = response.body.pipeThrough(
      new TransformStream({
        flush() {
          void cleanup()
        },
      })
    )
    c.req.raw.signal.addEventListener('abort', () => void cleanup(), { once: true })
    return new Response(monitored, {
      status: response.status,
      headers: response.headers,
    })
  }

  return response
})

// Serve the harness
app.get('/*', serveStatic({ root: './public' }))

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[mastra-chat-prototype] listening on http://localhost:${info.port}`)
})
