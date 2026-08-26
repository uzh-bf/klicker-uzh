import { createServer } from 'node:http'

const host = '127.0.0.1'
const rawPort = process.env.GROWTHBOOK_TEST_PORT ?? '4010'
const port = Number(rawPort)
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error(`Invalid GROWTHBOOK_TEST_PORT: ${rawPort}`)
}
const clientKey = 'sdk-test'
// Synthetic lecturer fixture from playwright/util/constants.ts.
const enabledUserId = '76047345-3801-4628-ae7b-adbebcfe8821'
let learningAnalyticsEnabled = true

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`)

  if (
    request.method === 'GET' &&
    url.pathname === `/api/features/${clientKey}`
  ) {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        features: {
          'ai-beta': {
            defaultValue: false,
            rules: [
              {
                condition: { id: enabledUserId },
                force: true,
              },
            ],
          },
          'learning-analytics': {
            defaultValue: false,
            rules: [
              {
                condition: { id: enabledUserId },
                force: learningAnalyticsEnabled,
              },
            ],
          },
        },
      })
    )
    return
  }

  if (
    request.method === 'POST' &&
    url.pathname === '/__test/learning-analytics'
  ) {
    learningAnalyticsEnabled = url.searchParams.get('enabled') === 'true'
    response.writeHead(204)
    response.end()
    return
  }

  response.writeHead(404)
  response.end()
})

server.on('error', (error) => {
  console.error(`[growthbook-test] failed to start server: ${error.message}`)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(
    `[growthbook-test] SDK fixture listening on http://${host}:${port}`
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
