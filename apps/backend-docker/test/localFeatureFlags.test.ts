import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import prepareApp from '../src/app.js'

for (const environment of ['development', 'test', 'production']) {
  test(`local feature payload in ${environment}`, async () => {
    const previous = { ...process.env }
    process.env.NODE_ENV = environment
    process.env.FEATURE_FLAGS_FORCED_ON = 'ai-beta,learning-analytics'
    delete process.env.GROWTHBOOK_ENV
    delete process.env.GROWTHBOOK_API_HOST
    delete process.env.GROWTHBOOK_CLIENT_KEY
    const { app } = prepareApp({ prisma: {} })
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(
        `http://127.0.0.1:${port}/__growthbook__/api/features/sdk-test`
      )
      assert.equal(response.status, environment === 'development' ? 200 : 404)
      if (environment === 'development') {
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.deepEqual(await response.json(), {
          features: {
            'ai-beta': { defaultValue: true },
            'learning-analytics': { defaultValue: true },
          },
        })
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      process.env = previous
    }
  })
}
