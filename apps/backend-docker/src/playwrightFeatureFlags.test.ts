import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(
  new URL('../scripts/playwright-feature-flags.mjs', import.meta.url)
)

test('Playwright flag preload rejects non-test startup', () => {
  const result = spawnSync(process.execPath, ['--import', fixture, '-e', ''], {
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires NODE_ENV=test/)
})

test('Playwright flags target scoped synthetic actors and test controller', () => {
  const safeFetchPreload = `data:text/javascript,${encodeURIComponent(
    "globalThis.fetch = async () => new Response('safe-original-fetch', { status: 418 })"
  )}`
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' }
  delete env.GROWTHBOOK_MANAGEMENT_API_URL
  delete env.GROWTHBOOK_MANAGEMENT_API_KEY
  delete env.GROWTHBOOK_BETA_SAVED_GROUP_ID

  const result = spawnSync(
    process.execPath,
    [
      '--import',
      safeFetchPreload,
      '--import',
      fixture,
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict'
    import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
    const managementUrl =
      'https://growthbook.test/api/v1/saved-groups/local-beta-enrollment'
    const learningAnalyticsControllerUrl =
      'https://growthbook.test/__test/learning-analytics'
    const lecturer = {
      id: '76047345-3801-4628-ae7b-adbebcfe8821',
      actorType: 'user',
      catalyst: true,
      betaEnabled: true,
    }
    const learningAnalyticsActor = {
      id: lecturer.id,
      actorType: 'user',
      catalyst: false,
      betaEnabled: false,
    }

    async function createClient(environment) {
      const flags = new NodeFeatureFlagClient({
        apiHost: process.env.GROWTHBOOK_API_HOST,
        clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
        environment,
        refreshIntervalMs: 0,
      })
      assert.equal(await flags.initialize(), true)
      return flags
    }

    for (const environment of ['test', 'development']) {
      const flags = await createClient(environment)
      assert.equal(flags.isEnabled('ai-beta', lecturer), true)
      assert.equal(
        flags.isEnabled('learning-analytics', learningAnalyticsActor),
        true,
      )
      assert.equal(
        flags.isEnabled('ai-beta', { ...lecturer, betaEnabled: false }),
        false,
      )

      const missingBetaEnabled = { ...lecturer }
      delete missingBetaEnabled.betaEnabled
      assert.equal(flags.isEnabled('ai-beta', missingBetaEnabled), false)

      for (const restrictedAttributes of [
        { ...lecturer, catalyst: false },
        { ...lecturer, actorType: 'participant' },
        { ...lecturer, actorType: 'anonymous' },
        { ...lecturer, id: 'another-synthetic-user' },
      ]) {
        assert.equal(
          flags.isEnabled('ai-beta', restrictedAttributes),
          false,
        )
      }
      for (const restrictedAttributes of [
        { ...learningAnalyticsActor, actorType: 'participant' },
        { ...learningAnalyticsActor, actorType: 'anonymous' },
        { ...learningAnalyticsActor, id: 'another-synthetic-user' },
      ]) {
        assert.equal(
          flags.isEnabled('learning-analytics', restrictedAttributes),
          false,
        )
      }
      flags.destroy()
    }

    for (const environment of ['staging', 'production']) {
      const flags = await createClient(environment)
      assert.equal(flags.isEnabled('ai-beta', lecturer), false)
      assert.equal(
        flags.isEnabled('learning-analytics', learningAnalyticsActor),
        false,
      )
      flags.destroy()
    }

    assert.equal(process.env.GROWTHBOOK_REFRESH_INTERVAL_MS, '250')

    async function readLearningAnalyticsState() {
      const response = await fetch(learningAnalyticsControllerUrl)
      assert.equal(response.status, 200)
      const state = await response.json()
      assert.equal(typeof state.enabled, 'boolean')
      return state.enabled
    }

    const actualPriorState = await readLearningAnalyticsState()
    for (const invalidRequest of [
      { method: 'HEAD', url: learningAnalyticsControllerUrl, status: 405 },
      { method: 'PUT', url: learningAnalyticsControllerUrl, status: 405 },
      {
        method: 'GET',
        url: learningAnalyticsControllerUrl + '?enabled=false',
        status: 400,
      },
      { method: 'POST', url: learningAnalyticsControllerUrl, status: 400 },
      {
        method: 'POST',
        url: learningAnalyticsControllerUrl + '?enabled=maybe',
        status: 400,
      },
      {
        method: 'POST',
        url: learningAnalyticsControllerUrl + '?enabled=true&extra=false',
        status: 400,
      },
      {
        method: 'POST',
        url: learningAnalyticsControllerUrl + '?enabled=true&enabled=false',
        status: 400,
      },
    ]) {
      const before = await readLearningAnalyticsState()
      const response = await fetch(invalidRequest.url, {
        method: invalidRequest.method,
      })
      assert.equal(response.status, invalidRequest.status)
      await response.text()
      assert.equal(await readLearningAnalyticsState(), before)
    }

    for (const malformedUrl of [
      'https://growthbook.test.evil/__test/learning-analytics?enabled=false',
      'https://growthbook.test/__test/learning-analytics-extra?enabled=false',
    ]) {
      const response = await fetch(malformedUrl, { method: 'POST' })
      assert.equal(response.status, 418)
      assert.equal(await response.text(), 'safe-original-fetch')
      assert.equal(await readLearningAnalyticsState(), actualPriorState)
    }

    for (const enabled of [true, false]) {
      const response = await fetch(
        learningAnalyticsControllerUrl + '?enabled=' + enabled,
        { method: 'POST' },
      )
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { enabled })
      assert.equal(await readLearningAnalyticsState(), enabled)

      const flags = await createClient('test')
      assert.equal(
        flags.isEnabled('learning-analytics', learningAnalyticsActor),
        enabled,
      )
      assert.equal(flags.isEnabled('ai-beta', lecturer), true)
      assert.equal(
        flags.isEnabled('ai-beta', { ...lecturer, betaEnabled: false }),
        false,
      )
      flags.destroy()
    }

    const restoreResponse = await fetch(
      learningAnalyticsControllerUrl + '?enabled=' + actualPriorState,
      { method: 'POST' },
    )
    assert.equal(restoreResponse.status, 200)
    assert.deepEqual(await restoreResponse.json(), {
      enabled: actualPriorState,
    })
    assert.equal(await readLearningAnalyticsState(), actualPriorState)

    assert.equal(process.env.GROWTHBOOK_MANAGEMENT_API_URL, undefined)
    assert.equal(process.env.GROWTHBOOK_MANAGEMENT_API_KEY, undefined)
    assert.equal(process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID, undefined)
    const managementResponse = await fetch(managementUrl)
    assert.equal(managementResponse.status, 418)
    assert.equal(await managementResponse.text(), 'safe-original-fetch')
  `,
    ],
    {
      env,
      encoding: 'utf8',
    }
  )
  assert.equal(result.status, 0, result.stderr)
})

test('Playwright flags preserve the configured analytics fixture', () => {
  const safeFetchPreload = `data:text/javascript,${encodeURIComponent(`
    globalThis.analyticsEnabled = true
    globalThis.fetch = async (input) => {
      if (String(input) !== 'http://127.0.0.1:4010/api/features/sdk-test') {
        throw new Error('Unexpected fixture request')
      }
      return Response.json({ features: {
        'learning-analytics': { defaultValue: globalThis.analyticsEnabled },
        'ai-beta': { defaultValue: true },
      } })
    }
  `)}`
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      safeFetchPreload,
      '--import',
      fixture,
      '--input-type=module',
      '-e',
      `
      import assert from 'node:assert/strict'
      import { NodeFeatureFlagClient } from '@klicker-uzh/feature-flags/node'
      const flags = new NodeFeatureFlagClient({
        apiHost: process.env.GROWTHBOOK_API_HOST,
        clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
        environment: 'test', refreshIntervalMs: 0,
      })
      const actor = { id: 'another-synthetic-user', actorType: 'user' }
      assert.equal(await flags.initialize(), true)
      assert.equal(flags.isEnabled('learning-analytics', actor), true)
      assert.equal(flags.isEnabled('ai-beta', actor), false)
      const lecturer = {
        id: '76047345-3801-4628-ae7b-adbebcfe8821', actorType: 'user',
      }
      await fetch('https://growthbook.test/__test/learning-analytics?enabled=false', {
        method: 'POST',
      })
      await flags.refresh()
      assert.equal(flags.isEnabled('learning-analytics', lecturer), false)
      assert.equal(flags.isEnabled('learning-analytics', actor), true)
      globalThis.analyticsEnabled = false
      await flags.refresh()
      assert.equal(flags.isEnabled('learning-analytics', actor), false)
      flags.destroy()
    `,
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        GROWTHBOOK_API_HOST: 'http://127.0.0.1:4010',
        GROWTHBOOK_CLIENT_KEY: 'sdk-test',
      },
      encoding: 'utf8',
    }
  )
  assert.equal(result.status, 0, result.stderr)
})

for (const preload of [false, true]) {
  test(`Fixture HTTP routes require explicit preload (${preload})`, () => {
    const env = { ...process.env, NODE_ENV: 'test' }
    delete env.GROWTHBOOK_API_HOST
    const result = spawnSync(
      process.execPath,
      [
        ...(preload ? ['--import', fixture] : []),
        '--input-type=module',
        '-e',
        `
        import assert from 'node:assert/strict'
        import { once } from 'node:events'
        import express from 'express'
        const app = express()
        app.get('/ordinary', (_req, res) => res.json({ ordinary: true }))
        const server = app.listen(0, '127.0.0.1')
        await once(server, 'listening')
        const base = 'http://127.0.0.1:' + server.address().port
        const controller = base + '/__growthbook__/__test/learning-analytics'
        const features = base + '/__growthbook__/api/features/sdk-test'
        try {
          assert.deepEqual(await (await fetch(base + '/ordinary')).json(), { ordinary: true })
          if (!${preload}) {
            assert.equal((await fetch(features)).status, 404)
            assert.equal((await fetch(controller)).status, 404)
            assert.equal((await fetch(controller + '?enabled=true', { method: 'POST' })).status, 404)
          } else {
            assert.equal((await fetch(features)).status, 200)
            const initial = await fetch(controller)
            assert.equal(initial.headers.get('cache-control'), 'no-store')
            assert.deepEqual(await initial.json(), { enabled: true })
            const changed = await fetch(controller + '?enabled=false', { method: 'POST' })
            assert.deepEqual(await changed.json(), { enabled: false })
            const payload = await (await fetch(features)).json()
            assert.equal(payload.features['learning-analytics'].rules[0].force, false)
            for (const query of ['', '?enabled=invalid', '?enabled=true&enabled=false', '?enabled=true&other=false']) {
              assert.equal((await fetch(controller + query, { method: 'POST' })).status, 400)
            }
            assert.equal((await fetch(controller + '?enabled=true')).status, 400)
            assert.equal((await fetch(controller, { method: 'DELETE' })).status, 405)
            assert.deepEqual(await (await fetch(controller)).json(), { enabled: false })
            await fetch(controller + '?enabled=true', { method: 'POST' })
            assert.deepEqual(await (await fetch(controller)).json(), { enabled: true })
          }
        } finally {
          server.closeAllConnections()
          await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        }
        `,
      ],
      { env, encoding: 'utf8', timeout: 15000 }
    )
    assert.equal(result.status, 0, result.stderr || result.stdout)
  })
}
