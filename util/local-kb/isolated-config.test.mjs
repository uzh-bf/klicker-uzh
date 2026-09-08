import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveIsolatedConfig,
  validateIsolatedConfig,
} from './isolated-config.mjs'
import { providerCommands } from './provider-commands.mjs'

const providerRevisions = {
  ingestion: 'd'.repeat(40),
  scraping: 'b'.repeat(40),
  retrieval: '8'.repeat(40),
  docProcessing: 'c'.repeat(40),
}

function makeInput(name) {
  const projectIdentity = `isolated-local-kb-${name}`
  const primaryCheckoutPath = `/synthetic/checkouts/${name}/primary`
  const runtimeCheckoutPath = `/synthetic/checkouts/${name}/runtime`
  const providerBase = `/synthetic/providers/${name}`
  const portBase = name === 'a' ? 18000 : 28000
  const providerRoots = Object.fromEntries(
    Object.entries(providerRevisions).map(([providerName, revision]) => [
      providerName,
      {
        path: `${providerBase}/${providerName}`,
        revision,
      },
    ])
  )
  const providerObservations = Object.fromEntries(
    Object.entries(providerRoots).map(([providerName, root]) => [
      providerName,
      { path: root.path, revision: root.revision, clean: true },
    ])
  )

  return {
    primaryCheckoutPath,
    runtimeCheckoutPath,
    retainedCheckoutPaths: [`/synthetic/checkouts/${name}/retained`],
    projectIdentity,
    retainedProjectIdentities: [`retained-local-kb-${name}`],
    retainedMutableVolumeNames: [`retained-local-kb-${name}-postgres-volume`],
    retainedEndpointOrigins: ['https://retained.example.invalid:443'],
    providerRoots,
    providerObservations,
    endpoints: {
      klicker: `http://127.0.0.1:${portBase}/graphql`,
      postgres: `postgresql://127.0.0.1:${portBase + 1}/postgres`,
      hatchet: `http://127.0.0.1:${portBase + 2}/health`,
      redis: `redis://127.0.0.1:${portBase + 3}/0`,
      blob: `http://127.0.0.1:${portBase + 4}/blob`,
      ingestion: `http://127.0.0.1:${portBase + 5}/ready`,
      dispatcher: `http://127.0.0.1:${portBase + 6}/health`,
      callback: `http://127.0.0.1:${portBase + 7}/metrics`,
      scraping: `http://127.0.0.1:${portBase + 8}/ready`,
      crawl4ai: `http://127.0.0.1:${portBase + 9}/health`,
      milvus: `http://127.0.0.1:${portBase + 10}/healthz`,
      objectBacking: `http://127.0.0.1:${portBase + 11}/health`,
      retrieval: `http://127.0.0.1:${portBase + 12}/health`,
      docProcessing: `http://127.0.0.1:${portBase + 13}/health`,
    },
  }
}

test('resolves two independent stacks with complete provider and state ownership', () => {
  const first = resolveIsolatedConfig(makeInput('a'))
  const second = resolveIsolatedConfig(makeInput('b'))

  assert.deepEqual(Object.keys(first.providers).sort(), [
    'docProcessing',
    'ingestion',
    'retrieval',
    'scraping',
  ])
  assert.equal(first.providers.docProcessing.identity, 'docProcessing')
  assert.equal(first.providers.docProcessing.clean, true)
  assert.equal(first.mutableState.documentProcessing.owner, 'docProcessing')
  assert.equal(first.mutableState.documentProcessing.generated, true)
  assert.equal(first.sourceMounts.docProcessing.readOnly, true)
  assert.ok(first.roots.some(({ name }) => name === 'docProcessing'))
  assert.ok(first.health.some(({ name }) => name === 'docProcessing'))
  assert.equal(first.deployment.rendered, false)
  assert.equal(first.deployment.executable, false)
  assert.equal(
    first.dependencyGraph.nodes.documentProcessing.deployment,
    'unqualified'
  )
  assert.equal(first.capabilities.documentProcessing.status, 'unqualified')
  assert.equal(first.capabilities.documentProcessing.endpoint, null)
  assert.deepEqual(first.capabilities.documentProcessing.requiredEnvironment, [
    'DOC_PROCESSING_BASE_URL',
    'DOC_PROCESSING_API_KEY',
  ])
  assert.notEqual(first.project.identity, second.project.identity)
  assert.notEqual(
    first.project.runtimeCheckoutPath,
    second.project.runtimeCheckoutPath
  )
  assert.notEqual(
    first.mutableState.postgres.volumeName,
    second.mutableState.postgres.volumeName
  )
  assert.notEqual(first.endpoints.retrieval.url, second.endpoints.retrieval.url)
  assert.equal(validateIsolatedConfig(first), true)
  assert.equal(validateIsolatedConfig(second), true)
})

test('keeps roots and health compatible with supported provider commands', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const commands = providerCommands(config)

  assert.ok(commands.setup.migrations.args.includes('ingestion_api.migrations'))
  assert.ok(commands.start.length >= 12)
  assert.ok(
    commands.start.every(
      (command) => command.env.PYTHON_DOTENV_DISABLED === '1'
    )
  )
  assert.equal(
    config.roots.find(({ name }) => name === 'docProcessing').readOnly,
    true
  )
  assert.equal(
    config.health.find(({ name }) => name === 'docProcessing').url,
    config.endpoints.docProcessing.url
  )
})

test('supports repo-local worktrees while keeping runtime and retained trees separate', () => {
  const input = makeInput('a')
  input.primaryCheckoutPath = '/synthetic/repository'
  input.runtimeCheckoutPath = '/synthetic/repository/trees/test'
  input.retainedCheckoutPaths = ['/synthetic/repository/trees/retained']
  assert.equal(validateIsolatedConfig(resolveIsolatedConfig(input)), true)
})

test('rejects altered dependency wiring in a persisted configuration', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  config.dependencyGraph.nodes.ingestionWorkers.dependsOn = []
  assert.throws(() => validateIsolatedConfig(config))
  const appended = resolveIsolatedConfig(makeInput('a'))
  appended.dependencyGraph.nodes.ingestionWorkers.dependsOn.push('unexpected')
  assert.throws(() => validateIsolatedConfig(appended))
  assert.equal(
    validateIsolatedConfig(resolveIsolatedConfig(makeInput('a'))),
    true
  )
})

test('rejects a runtime checkout equal to or inside a retained source', () => {
  const input = makeInput('a')
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      runtimeCheckoutPath: input.primaryCheckoutPath,
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      runtimeCheckoutPath: `${input.retainedCheckoutPaths[0]}/nested-runtime`,
    })
  )
})

test('rejects retained identities and unsafe generated destinations', () => {
  const input = makeInput('a')
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      projectIdentity: input.retainedProjectIdentities[0],
    })
  )

  const resolved = resolveIsolatedConfig(input)
  resolved.mutableState.redis.volumeName = `${input.projectIdentity}-shared-volume`
  assert.throws(() => validateIsolatedConfig(resolved))
  resolved.mutableState.redis.volumeName = `${input.projectIdentity}-redis-volume`
  resolved.mutableState.redis.path = input.primaryCheckoutPath
  assert.throws(() => validateIsolatedConfig(resolved))
})

test('rejects dirty, mismatched, or relocated provider observations', () => {
  const input = makeInput('a')
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      providerObservations: {
        ...input.providerObservations,
        ingestion: { ...input.providerObservations.ingestion, clean: false },
      },
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      providerObservations: {
        ...input.providerObservations,
        docProcessing: {
          ...input.providerObservations.docProcessing,
          revision: 'f'.repeat(40),
        },
      },
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      providerObservations: {
        ...input.providerObservations,
        scraping: {
          ...input.providerObservations.scraping,
          path: '/synthetic/providers/a/other-scraping',
        },
      },
    })
  )
})

test('rejects remote endpoint fallback and unknown settings', () => {
  const input = makeInput('a')
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      retainedEndpointOrigins: [
        input.endpoints.docProcessing.replace('/health', '/other'),
      ],
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      endpoints: {
        ...input.endpoints,
        docProcessing: 'https://doc-processing.example.invalid:443/health',
      },
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      unknownSetting: true,
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      endpoints: {
        ...input.endpoints,
        callback: { url: input.endpoints.callback },
      },
    })
  )
})

test('keeps document processing explicitly unqualified without a remote fallback', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const requirement = config.integrationRequirements.find(
    ({ id }) => id === 'document-processing-local-integration'
  )

  assert.equal(requirement.status, 'missing')
  assert.equal(requirement.provider, 'docProcessing')
  assert.equal(requirement.noRemoteFallback, true)
  assert.deepEqual(requirement.requiredEnvironment, [
    'DOC_PROCESSING_BASE_URL',
    'DOC_PROCESSING_API_KEY',
  ])

  const tampered = structuredClone(config)
  tampered.capabilities.documentProcessing.healthEndpoint =
    'https://doc-processing.example.invalid:443'
  assert.throws(() => validateIsolatedConfig(tampered))
})
