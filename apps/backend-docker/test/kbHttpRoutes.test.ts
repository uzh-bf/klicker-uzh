import {
  handleKBIngestionWebhook,
  handleKBSourceGateway,
} from '@klicker-uzh/graphql'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import test from 'node:test'
import express from 'express'
import { registerKBHttpRoutes } from '../src/kbHttpRoutes.js'

const RESOURCE_ID = '4b3ff764-e876-4c57-952c-f26d70309714'

async function withRoutes(
  dependencies: Parameters<typeof registerKBHttpRoutes>[1],
  run: (origin: string) => Promise<void>
) {
  const app = express()
  registerKBHttpRoutes(app, dependencies)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function routeDependencies({
  sourceGateway,
  ingestionWebhook,
}: {
  sourceGateway?: typeof handleKBSourceGateway
  ingestionWebhook?: typeof handleKBIngestionWebhook
} = {}): Parameters<typeof registerKBHttpRoutes>[1] {
  return {
    prisma: {} as never,
    sourceGateway,
    ingestionWebhook,
  }
}

test('rejects an invalid source route before calling the gateway', async () => {
  let called = false
  const sourceGateway = (async () => {
    called = true
    throw new Error('unexpected')
  }) as typeof handleKBSourceGateway

  await withRoutes(routeDependencies({ sourceGateway }), async (origin) => {
    const response = await fetch(
      `${origin}/api/ingestion/resources/not-a-uuid/versions/0`
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'Resource not found' })
    assert.equal(called, false)
  })
})

test('streams an eligible source with defensive response headers', async () => {
  let observedAuthorization: string | undefined
  const sourceGateway = (async ({ authorization }) => {
    observedAuthorization = authorization
    return {
      statusCode: 200,
      contentLength: 7,
      contentType: 'text/plain',
      stream: Readable.from('content'),
    }
  }) as typeof handleKBSourceGateway

  await withRoutes(routeDependencies({ sourceGateway }), async (origin) => {
    const response = await fetch(
      `${origin}/api/ingestion/resources/${RESOURCE_ID}/versions/2`,
      { headers: { Authorization: 'Bearer gateway-key' } }
    )

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'content')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('content-length'), '7')
    assert.equal(response.headers.get('content-type'), 'text/plain')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(observedAuthorization, 'Bearer gateway-key')
  })
})

test('returns a generic error when the source gateway throws', async () => {
  const sourceGateway = (async () => {
    throw new Error('sensitive upstream detail')
  }) as typeof handleKBSourceGateway

  await withRoutes(routeDependencies({ sourceGateway }), async (origin) => {
    const response = await fetch(
      `${origin}/api/ingestion/resources/${RESOURCE_ID}/versions/1`
    )

    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), {
      error: 'Internal server error',
    })
  })
})

test('forwards the exact raw webhook body and headers', async () => {
  const rawBody = Buffer.from('{"event":"accepted"}')
  let observedBody: Buffer | undefined
  let observedHeader: string | string[] | undefined
  const ingestionWebhook = (async ({ rawBody, headers }) => {
    observedBody = rawBody
    observedHeader = headers['x-ingestion-event-id']
    return { statusCode: 202, body: { accepted: true } }
  }) as typeof handleKBIngestionWebhook

  await withRoutes(routeDependencies({ ingestionWebhook }), async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/kb-ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ingestion-Event-Id': RESOURCE_ID,
      },
      body: rawBody,
    })

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { accepted: true })
    assert.deepEqual(observedBody, rawBody)
    assert.equal(observedHeader, RESOURCE_ID)
  })
})

test('rejects a webhook without an application/json raw body', async () => {
  let called = false
  const ingestionWebhook = (async () => {
    called = true
    throw new Error('unexpected')
  }) as typeof handleKBIngestionWebhook

  await withRoutes(routeDependencies({ ingestionWebhook }), async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/kb-ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid request' })
    assert.equal(called, false)
  })
})

test('returns a generic error when webhook handling throws', async () => {
  const ingestionWebhook = (async () => {
    throw new Error('sensitive webhook detail')
  }) as typeof handleKBIngestionWebhook

  await withRoutes(routeDependencies({ ingestionWebhook }), async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/kb-ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), {
      error: 'Internal server error',
    })
  })
})
