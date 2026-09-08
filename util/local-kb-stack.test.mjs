import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspectLocalKbStack, resolveLocalKbConfig } from './local-kb-stack.mjs'

const env = {
  DATA_INGESTION_REPO: '/synthetic/ingestion',
  WEB_SCRAPING_REPO: '/synthetic/scraping',
  DOC_QUERY_REPO: '/synthetic/retrieval',
  DOC_PROCESSING_REPO: '/synthetic/doc-processing',
}

test('plan CLI stays non-executable until runtime qualification', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./local-kb-stack.mjs', import.meta.url)), 'plan'],
    { env, encoding: 'utf8' }
  )
  assert.equal(result.error, undefined)
  assert.equal(result.status, 2)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.executable, false)
  assert.ok(plan.blockers.length > 0)
})

test('requires all explicit provider paths', () => {
  for (const key of Object.keys(env)) {
    assert.throws(() => resolveLocalKbConfig({ ...env, [key]: undefined }))
    assert.throws(() => resolveLocalKbConfig({ ...env, [key]: 'relative' }))
  }
})

test('accepts selected loopback ports without forwarding arbitrary environment', () => {
  const config = resolveLocalKbConfig({
    ...env,
    LOCAL_KB_INGESTION_PORT: '28081',
    UNRELATED_SECRET: 'synthetic-value',
  })
  assert.equal(config.health[0].url, 'http://127.0.0.1:28081/ready')
  assert.equal('UNRELATED_SECRET' in config, false)
})

test('rejects invalid and conflicting ports before any service access', () => {
  for (const value of ['0', '65536', '-1', 'abc', '8001', '18083', '18084']) {
    assert.throws(() =>
      resolveLocalKbConfig({ ...env, LOCAL_KB_INGESTION_PORT: value })
    )
  }
})

test('never promotes reachability into full readiness', async () => {
  const calls = []
  const result = await inspectLocalKbStack(resolveLocalKbConfig(env), {
    inspect: ({ name }) => ({ name, sourceAvailable: true, head: 'synthetic' }),
    request: async ({ name, url }) => {
      calls.push(url)
      return { name, reachable: true, status: 200 }
    },
  })
  assert.deepEqual(
    calls,
    resolveLocalKbConfig(env).health.map(({ url }) => url)
  )
  assert.equal(result.ready, false)
  assert.ok(result.endpoints.every(({ reachable }) => reachable))
})
