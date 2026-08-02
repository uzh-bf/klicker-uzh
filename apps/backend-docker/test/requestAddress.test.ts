import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { createRequestAwareExpressApp } from '../src/requestAddress.js'

const app = createRequestAwareExpressApp()
const server = app
  .get('/request-ip', (req, res) => {
    res.json({ ip: req.ip })
  })
  .listen(0, '127.0.0.1')

before(async () => {
  if (!server.listening) {
    await new Promise<void>((resolve) => server.once('listening', resolve))
  }
})

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

async function requestIp(forwardedFor?: string) {
  const { port } = server.address() as AddressInfo
  const response = await fetch(`http://127.0.0.1:${port}/request-ip`, {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : undefined,
  })

  assert.equal(response.status, 200)
  return response.json()
}

test('uses the direct peer when no ingress header is present', async () => {
  assert.deepEqual(await requestIp(), { ip: '127.0.0.1' })
})

test('uses the address added by the single trusted ingress', async () => {
  assert.deepEqual(await requestIp('198.51.100.10, 203.0.113.20'), {
    ip: '203.0.113.20',
  })
})
