import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

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

test('Playwright flags enable only the seeded eligible lecturer through GrowthBook', () => {
  const result = spawnSync(
    process.execPath,
    [
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
      environment: process.env.GROWTHBOOK_ENV,
      refreshIntervalMs: 0,
    })
    assert.equal(await flags.initialize(), true)
    const lecturer = { id: '76047345-3801-4628-ae7b-adbebcfe8821', actorType: 'user', catalyst: true }
    assert.equal(flags.isEnabled('ai-beta', lecturer), true)
    for (const change of [{ id: 'another-synthetic-user' }, { actorType: 'participant' }, { catalyst: false }]) {
      assert.equal(flags.isEnabled('ai-beta', { ...lecturer, ...change }), false)
    }
    assert.equal(flags.isEnabled('beta-signup', lecturer), false)
    flags.destroy()
  `,
    ],
    {
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
    }
  )
  assert.equal(result.status, 0, result.stderr)
})
