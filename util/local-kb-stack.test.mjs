import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspectLocalKbStack, resolveLocalKbConfig } from './local-kb-stack.mjs'

const env = {
  DATA_INGESTION_REPO: '/synthetic/ingestion',
  WEB_SCRAPING_REPO: '/synthetic/scraping',
  DOC_QUERY_REPO: '/synthetic/retrieval',
  DOC_PROCESSING_REPO: '/synthetic/doc-processing',
}

function isolatedConfigInput(endpointOverrides = {}) {
  const providerRevisions = {
    ingestion: 'd'.repeat(40),
    scraping: 'b'.repeat(40),
    retrieval: '8'.repeat(40),
    docProcessing: 'c'.repeat(40),
  }
  const providerRoots = Object.fromEntries(
    Object.entries(providerRevisions).map(([name, revision]) => [
      name,
      { path: `/synthetic/providers/${name}`, revision },
    ])
  )
  return {
    primaryCheckoutPath: '/synthetic/checkouts/primary',
    runtimeCheckoutPath: '/synthetic/checkouts/runtime',
    retainedCheckoutPaths: ['/synthetic/checkouts/retained'],
    projectIdentity: 'isolated-local-kb-cli',
    retainedProjectIdentities: ['retained-local-kb-cli'],
    retainedMutableVolumeNames: ['retained-local-kb-cli-postgres-volume'],
    retainedEndpointOrigins: ['https://retained.example.invalid:443'],
    providerRoots,
    providerObservations: Object.fromEntries(
      Object.entries(providerRoots).map(([name, root]) => [
        name,
        { ...root, clean: true },
      ])
    ),
    endpoints: {
      klicker: 'http://127.0.0.1:28000/graphql',
      postgres: 'postgresql://127.0.0.1:28001/postgres',
      hatchet: 'http://127.0.0.1:28002/health',
      redis: 'redis://127.0.0.1:28003/0',
      blob: 'http://127.0.0.1:28004/blob',
      ingestion: 'http://127.0.0.1:28005/ready',
      dispatcher: 'http://127.0.0.1:28006/health',
      callback: 'http://127.0.0.1:28007/metrics',
      scraping: 'http://127.0.0.1:28008/ready',
      crawl4ai: 'http://127.0.0.1:28009/health',
      milvus: 'http://127.0.0.1:28010/healthz',
      objectBacking: 'http://127.0.0.1:28011/health',
      retrieval: 'http://127.0.0.1:28012/health',
      docProcessing: 'http://127.0.0.1:28013/health',
      ...endpointOverrides,
    },
  }
}

function runConfigPlan(input) {
  const directory = mkdtempSync(join(tmpdir(), 'local-kb-stack-test-'))
  const path = join(directory, 'config.json')
  writeFileSync(path, JSON.stringify(input))
  try {
    return spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./local-kb-stack.mjs', import.meta.url)),
        'plan',
        '--config',
        path,
      ],
      { env: {}, encoding: 'utf8' }
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('config plan resolves a full synthetic input and rejects remote endpoints safely', () => {
  const valid = runConfigPlan(isolatedConfigInput())
  assert.equal(valid.error, undefined)
  assert.equal(valid.status, 2)
  const plan = JSON.parse(valid.stdout)
  assert.equal(plan.executable, false)
  assert.equal(plan.model, 'validation-only')
  assert.ok(plan.dependencyGraph.nodes.docQuery)
  assert.ok(plan.mutableState.docQuery)
  assert.equal(plan.sourceMounts.retrieval.readOnly, true)
  assert.ok(plan.providerCommands.start.length > 0)
  assert.deepEqual(
    plan.blockers.map(({ id }) => id),
    ['rendered-local-deployment', 'provider-preparation']
  )
  assert.equal(plan.limitations[0].id, 'supplied-provider-observations')

  const invalid = runConfigPlan(
    isolatedConfigInput({
      klicker:
        'https://remote.example.invalid:443/graphql?token=synthetic-secret',
    })
  )
  assert.equal(invalid.status, 1)
  assert.ok(invalid.stderr.trim().length > 0)
  assert.equal(invalid.stderr.includes('remote.example.invalid'), false)
  assert.equal(invalid.stderr.includes('synthetic-secret'), false)
})

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
