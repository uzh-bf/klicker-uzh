// S0 Hono service: replaces the chat app's streamText call with a Mastra agent,
// converts to the AI SDK v6 UI-message stream, and re-attaches our per-message
// finish metadata (modelId/chatMode/creditsUsed) via messageMetadata.
// We keep persistence in our own store (see db.ts) — Mastra owns no messages.
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createUIMessageStreamResponse } from 'ai'
import { toAISdkStream } from '@mastra/ai-sdk'
import { buildAgent } from './engine/agent.js'
import { getChatbot } from './db.js'
import { env } from './env.js'

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.post('/api/chat', async (c) => {
  const body = await c.req.json<{
    chatbotId: string
    mode?: string
    model?: string
    messages: unknown[]
  }>()
  const mode = body.mode ?? 'tutor'
  const chatbot = await getChatbot(body.chatbotId)
  if (!chatbot) return c.json({ error: 'chatbot not found' }, 404)

  const modelId = body.model ?? env.PRIMARY_MODEL_ID
  const agent = buildAgent(chatbot, mode, modelId)

  const stream = await agent.stream(body.messages as never, {
    abortSignal: c.req.raw.signal,
  })

  const uiStream = toAISdkStream(stream, {
    from: 'agent',
    version: 'v6',
    sendReasoning: true,
    // Finish-metadata shim: our UI depends on these on the finish chunk.
    messageMetadata: ({ part }: { part: { type: string } }) =>
      part.type === 'finish'
        ? { modelId, chatMode: mode, creditsUsed: 0 }
        : undefined,
  })

  // Cast bridges a known version skew: Mastra vendors its own ai-v6 chunk types
  // whose finish chunk allows finishReason 'unknown', while the app's `ai`
  // package narrows it out. Runtime chunks are identical; only the types differ.
  return createUIMessageStreamResponse({
    stream: uiStream as unknown as Parameters<
      typeof createUIMessageStreamResponse
    >[0]['stream'],
  })
})

// Serve the harness
app.get('/*', serveStatic({ root: './public' }))

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[mastra-chat-prototype] listening on http://localhost:${info.port}`)
})
