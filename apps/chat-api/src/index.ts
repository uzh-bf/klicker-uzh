// @klicker-uzh/chat-api
//
// Standalone Hono service that hosts the extracted Mastra chat engine
// (@klicker-uzh/chat-engine). The Next chat route in apps/chat proxies to this
// service when the CHAT_USE_MASTRA_ENGINE flag is on, forwarding the
// participant_token cookie; this service owns auth, the disclaimer gate, the
// image pipeline, the engine call, streaming, persistence, and credit metering.
//
// Phase 0 ships only the skeleton: a bootable Hono app with a /health endpoint.
// The authenticated, persisted, image-capable chat stream lands in Phase 2.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const PORT = Number(process.env.PORT ?? 3005)

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[chat-api] Ready and listening on http://localhost:${info.port}`)
})

export { app }
