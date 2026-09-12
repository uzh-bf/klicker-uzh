import assert from 'node:assert/strict'
import { execFile, execFileSync, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { renderBackingCompose } from './local-kb/backing-compose.mjs'
import { ingestionImageRevision } from './local-kb/ingestion-compose.mjs'
import { resolveIsolatedConfig } from './local-kb/isolated-config.mjs'
import {
  inspectIsolatedProviderSources,
  inspectLocalKbStack,
  resolveLocalKbConfig,
} from './local-kb-stack.mjs'

const env = {
  DATA_INGESTION_REPO: '/synthetic/ingestion',
  WEB_SCRAPING_REPO: '/synthetic/scraping',
  DOC_QUERY_REPO: '/synthetic/retrieval',
  DOC_PROCESSING_REPO: '/synthetic/doc-processing',
}

test('Blob health requires the expected unauthenticated service response', async () => {
  let status = 403
  const server = createServer((_request, response) => {
    response.writeHead(status).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const { services } = renderBackingCompose(
      resolveIsolatedConfig(isolatedConfigInput())
    )
    const script = services.blob.healthcheck.test
      .at(-1)
      .replace(':10000/', `:${server.address().port}/`)
    const execute = () =>
      promisify(execFile)(process.execPath, ['-e', script], { timeout: 5000 })
    await execute()
    status = 500
    await assert.rejects(execute(), { code: 1 })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

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

function runConfigPlan(input, command = 'plan', extra = []) {
  const directory = mkdtempSync(join(tmpdir(), 'local-kb-stack-test-'))
  const path = join(directory, 'config.json')
  writeFileSync(path, JSON.stringify(input))
  try {
    return spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./local-kb-stack.mjs', import.meta.url)),
        command,
        '--config',
        path,
        ...extra,
      ],
      { env: {}, encoding: 'utf8' }
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('setup refuses unpinned providers before checkout or runtime mutation', () => {
  const result = runConfigPlan(isolatedConfigInput(), 'setup', [
    '--candidate',
    'a'.repeat(40),
  ])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /source.*pinned|source.*image/i)
})

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
  assert.equal(
    plan.providerCommands.providers.ingestion.lifecycle.setup.blocked,
    true
  )
  assert.equal(
    plan.providerCommands.providers.docProcessing.lifecycle.start.cwd,
    plan.providers.docProcessing.sourcePath
  )
  assert.deepEqual(plan.backingCompose.services.hatchet.command, ['start'])
  assert.equal(
    plan.backingCompose.volumes.postgres.name,
    plan.mutableState.postgres.volumeName
  )
  assert.deepEqual(
    plan.blockers.map(({ id }) => id),
    ['rendered-local-deployment', 'provider-preparation']
  )
  assert.equal(plan.limitations[0].id, 'supplied-provider-observations')
  assert.equal(plan.ingestionCompose, null)
  const pinnedInput = isolatedConfigInput()
  pinnedInput.providerRoots.ingestion.revision = ingestionImageRevision
  pinnedInput.providerObservations.ingestion.revision = ingestionImageRevision
  const pinnedResult = runConfigPlan(pinnedInput)
  assert.equal(pinnedResult.status, 2)
  const pinnedPlan = JSON.parse(pinnedResult.stdout)
  assert.equal(pinnedPlan.executable, false)
  assert.equal(
    pinnedPlan.ingestionCompose.services['ingestion-api'].command[0],
    'uvicorn'
  )
  assert.deepEqual(
    pinnedPlan.ingestionCompose.services['ingestion-setup'].profiles,
    ['local-kb-setup']
  )

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

test('config status does not trust supplied clean-source observations', () => {
  const result = runConfigPlan(isolatedConfigInput(), 'status')
  assert.equal(result.status, 1)
  const status = JSON.parse(result.stdout)
  assert.equal(status.ready, false)
  assert.equal(status.runtimeObserved, false)
  assert.ok(status.providers.every(({ qualified }) => qualified === false))
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

test('source observation rejects dirty, mismatched and missing provider checkouts', () => {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'kb-source-test-')))
  const git = (args) =>
    execFileSync('git', ['-C', path, ...args], {
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
      ),
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  try {
    git(['init'])
    git([
      '-c',
      'user.name=Synthetic',
      '-c',
      'user.email=synthetic@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--allow-empty',
      '-m',
      'test fixture',
    ])
    const revision = git(['rev-parse', 'HEAD'])
    const config = { roots: [{ name: 'ingestion', path, revision }] }
    assert.equal(inspectIsolatedProviderSources(config)[0].qualified, true)
    writeFileSync(join(path, '.git/info/exclude'), 'ignored.pyc\n')
    writeFileSync(join(path, 'ignored.pyc'), 'synthetic bytecode')
    assert.equal(inspectIsolatedProviderSources(config)[0].qualified, false)
    rmSync(join(path, 'ignored.pyc'))
    config.roots[0].revision = '0'.repeat(40)
    assert.equal(
      inspectIsolatedProviderSources(config)[0].revisionMatches,
      false
    )
    config.roots[0].revision = revision
    writeFileSync(join(path, 'uncommitted.txt'), 'synthetic')
    const dirty = inspectIsolatedProviderSources(config)[0]
    assert.equal(dirty.clean, false)
    assert.equal(dirty.qualified, false)
    config.roots[0].path = join(path, 'absent')
    assert.equal(
      inspectIsolatedProviderSources(config)[0].sourceAvailable,
      false
    )
  } finally {
    rmSync(path, { recursive: true, force: true })
  }
})
