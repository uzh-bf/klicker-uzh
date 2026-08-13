import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'
import { app } from './app.js'

export { app, createChatApiApp } from './app.js'

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3005)
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[chat-api] listening on http://localhost:${info.port}`)
  })
}
