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

test('Playwright flags target the synthetic beta-enabled user', () => {
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
    const lecturer = {
      id: '76047345-3801-4628-ae7b-adbebcfe8821',
      actorType: 'user',
      catalyst: true,
      betaEnabled: true,
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
      flags.destroy()
    }

    for (const environment of ['staging', 'production']) {
      const flags = await createClient(environment)
      assert.equal(flags.isEnabled('ai-beta', lecturer), false)
      flags.destroy()
    }

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
