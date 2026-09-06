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

test('Playwright flags tie ai-beta to saved-group membership', () => {
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
    const savedGroupUrl =
      'https://growthbook.test/api/v1/saved-groups/local-beta-enrollment'
    const lecturer = {
      id: '76047345-3801-4628-ae7b-adbebcfe8821',
      actorType: 'user',
      catalyst: true,
    }

    async function createClient() {
      const flags = new NodeFeatureFlagClient({
        apiHost: process.env.GROWTHBOOK_API_HOST,
        clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
        environment: process.env.GROWTHBOOK_ENV,
        refreshIntervalMs: 0,
      })
      assert.equal(await flags.initialize(), true)
      return flags
    }

    async function writeSavedGroup(values) {
      const response = await fetch(savedGroupUrl, {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${process.env.GROWTHBOOK_MANAGEMENT_API_KEY}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bypassApproval: true, values }),
      })
      assert.equal(response.status, 200)
    }

    const enrolled = await createClient()
    assert.equal(enrolled.isEnabled('ai-beta', lecturer), true)
    assert.equal(enrolled.isEnabled('beta-signup', lecturer), true)
    for (const change of [
      { id: 'another-synthetic-user' },
      { actorType: 'participant' },
      { catalyst: false },
    ]) {
      assert.equal(
        enrolled.isEnabled('ai-beta', { ...lecturer, ...change }),
        false,
      )
      assert.equal(
        enrolled.isEnabled('beta-signup', { ...lecturer, ...change }),
        false,
      )
    }
    enrolled.destroy()

    await writeSavedGroup([])
    const unenrolled = await createClient()
    assert.equal(unenrolled.isEnabled('ai-beta', lecturer), false)
    assert.equal(unenrolled.isEnabled('beta-signup', lecturer), true)
    unenrolled.destroy()

    await writeSavedGroup([lecturer.id])
    const enrolledAgain = await createClient()
    assert.equal(enrolledAgain.isEnabled('ai-beta', lecturer), true)
    enrolledAgain.destroy()

    const unauthorized = await fetch(savedGroupUrl)
    assert.equal(unauthorized.status, 401)

    const invalidMembership = await fetch(savedGroupUrl, {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${process.env.GROWTHBOOK_MANAGEMENT_API_KEY}\`,
      },
      body: JSON.stringify({ values: ['another-synthetic-user'] }),
    })
    assert.equal(invalidMembership.status, 400)
    const unchanged = await createClient()
    assert.equal(unchanged.isEnabled('ai-beta', lecturer), true)
    assert.equal(unchanged.isEnabled('ai-beta', {
      ...lecturer, id: 'another-synthetic-user',
    }), false)
    unchanged.destroy()
  `,
    ],
    {
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
    }
  )
  assert.equal(result.status, 0, result.stderr)
})
