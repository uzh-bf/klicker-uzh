import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'
import { renderBackingCompose } from './backing-compose.mjs'
import { renderProviderCompose } from './compose.mjs'
import {
  docProcessingImageRevision,
  renderDocProcessingCompose,
} from './doc-processing-compose.mjs'
import {
  ingestionImageRevision,
  renderIngestionCompose,
} from './ingestion-compose.mjs'
import {
  resolveIsolatedConfig,
  validateIsolatedConfig,
} from './isolated-config.mjs'
import {
  renderManagedConfiguration,
  renderProviderRouting,
} from './managed-configuration.mjs'
import { providerCommands } from './provider-commands.mjs'
import {
  renderRetrievalCompose,
  retrievalImageRevision,
} from './retrieval-compose.mjs'
import { renderRetrievalStoreCompose } from './retrieval-store-compose.mjs'
import { scrapingImageRevision } from './scraping-compose.mjs'

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

test('managed application configuration shares only the isolated provider network', () => {
  const read = (path) =>
    readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
  const source = {
    compose: parse(read('.devcontainer/docker-compose.yml')),
    devcontainer: JSON.parse(read('.devcontainer/devcontainer.json')),
    devrouter: parse(read('.devrouter.yml')),
  }
  const original = structuredClone(source)
  const config = resolveIsolatedConfig(makeInput('a'))
  const result = renderManagedConfiguration(config, source)
  assert.deepEqual(source, original)
  assert.deepEqual(
    result.devrouter.managedRuntime.devcontainer.baseServices,
    []
  )
  assert.deepEqual(result.devrouter.managedRuntime.processes, ['klicker-dev'])
  assert.equal(result.devrouter.profiles.full, undefined)
  assert.equal(result.devrouter.profiles.mcp, undefined)
  assert.equal(result.devrouter.profiles.manage.default, true)
  assert.deepEqual(result.devrouter.profiles['local-kb-setup'], {
    apps: [],
    devcontainerServices: [],
    processes: [],
  })
  assert.equal(
    result.compose.services.litellm.environment.UPSTREAM_OPENAI_API_KEY,
    undefined
  )
  assert.deepEqual(result.compose.services.app.depends_on, {})
  for (const name of ['postgres', 'azurite', 'hatchet', 'local-mcp']) {
    assert.equal(result.compose.services[name], undefined)
  }
  for (const service of Object.values(result.compose.services)) {
    assert.equal(service.ports, undefined)
  }
  assert.deepEqual(result.compose.networks.default, {
    external: true,
    name: `${config.project.identity}_default`,
  })
  assert.deepEqual(result.compose.services.app.networks.default.aliases, [
    'klicker',
  ])
  assert.deepEqual(
    renderProviderRouting('isolated-proof').services.blob.networks.devnet
      .aliases,
    ['isolated-proof-azurite']
  )
  assert.equal(
    result.compose.services.app.environment.KLICKER_LOCAL_KB_RUNTIME_ONLY,
    '1'
  )
  assert.equal(
    result.compose.services.app.environment.BLOB_STORAGE_ACCESS_KEY,
    undefined
  )
  assert.equal(result.compose.volumes.pgdata, undefined)
  assert.equal(result.compose.volumes.hatchet_lite_config, undefined)
  assert.equal(result.compose.volumes.azurite_data, undefined)
  assert.deepEqual(
    result.devcontainer.runServices,
    Object.keys(result.compose.services)
  )
  assert.deepEqual(result.devcontainer.forwardPorts, [])
  const workspace = `\${WORKSPACE:?Devrouter must supply the workspace}`
  assert.deepEqual(result.compose.services.app.networks.devnet.aliases, [
    `${workspace}-app`,
  ])
  assert.equal(
    result.compose.services.app.environment.BLOB_STORAGE_ACCOUNT_URL,
    `https://blob.klicker.${workspace}.localhost/klickerdev`
  )
  assert.ok(
    result.compose.services.app.extra_hosts.every((entry) =>
      entry.includes(workspace)
    )
  )
  assert.throws(
    () => renderManagedConfiguration(config, source, 'guessed-name'),
    /Compose resolution/
  )
  for (const identity of [undefined, '', '../retained', `\${WORKSPACE}`]) {
    assert.throws(() => renderProviderRouting(identity), /identity/)
  }
})

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
  for (const name of ['milvus', 'milvusMetadata', 'objectBacking']) {
    assert.equal(first.mutableState[name].owner, 'ingestion')
    assert.equal(first.dependencyGraph.nodes[name].provider, 'ingestion')
    assert.ok(first.providers.ingestion.stateKeys.includes(name))
    assert.ok(!first.providers.retrieval.stateKeys.includes(name))
  }
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

test('combined provider composition resolves every dependency and named volume', () => {
  const input = makeInput('a')
  for (const [name, revision] of Object.entries({
    ingestion: ingestionImageRevision,
    scraping: scrapingImageRevision,
    retrieval: retrievalImageRevision,
    docProcessing: docProcessingImageRevision,
  })) {
    input.providerRoots[name].revision = revision
    input.providerObservations[name].revision = revision
  }
  const rendered = renderProviderCompose(resolveIsolatedConfig(input))
  assert.equal(rendered.name, input.projectIdentity)
  for (const name of [
    'postgres',
    'redis',
    'blob',
    'hatchet',
    'milvus-etcd',
    'minio',
    'milvus',
    'crawl4ai',
    'scraping',
    'ingestion-api',
    'doc-processing',
  ]) {
    assert.ok(rendered.services[name].healthcheck?.test.length > 0)
    assert.equal(rendered.services[name].healthcheck.disable, undefined)
  }
  assert.deepEqual(rendered.services.scraping.depends_on, {
    crawl4ai: { condition: 'service_healthy' },
  })
  assert.deepEqual(rendered.services['ingestion-api'].depends_on, {
    postgres: { condition: 'service_healthy' },
  })
  assert.deepEqual(
    rendered.services['ingestion-resource-fetch-worker'].depends_on,
    {
      postgres: { condition: 'service_healthy' },
      hatchet: { condition: 'service_started' },
    }
  )
  for (const service of Object.values(rendered.services)) {
    for (const name of Object.keys(service.depends_on ?? {})) {
      assert.ok(Object.hasOwn(rendered.services, name))
    }
    for (const mount of service.volumes ?? []) {
      if (typeof mount === 'string')
        assert.ok(Object.hasOwn(rendered.volumes, mount.split(':')[0]))
    }
    assert.equal(service.ports, undefined)
  }
})

test('backing services use isolated volumes and keep Hatchet setup separate', () => {
  const first = renderBackingCompose(resolveIsolatedConfig(makeInput('a')))
  const second = renderBackingCompose(resolveIsolatedConfig(makeInput('b')))
  const names = new Set(Object.values(first.volumes).map(({ name }) => name))
  assert.ok(Object.values(second.volumes).every(({ name }) => !names.has(name)))
  assert.deepEqual(first.services['hatchet-setup'].profiles, ['local-kb-setup'])
  assert.deepEqual(first.services['hatchet-setup'].command, ['setup'])
  assert.deepEqual(first.services.hatchet.command, ['start'])
  assert.equal(first.services['hatchet-setup'].healthcheck, undefined)
  assert.equal(first.services.hatchet.environment.SERVER_HEALTHCHECK, 'true')
  const readiness = new URL(first.services.hatchet.healthcheck.test.at(-1))
  assert.equal(readiness.hostname, '127.0.0.1')
  assert.equal(readiness.pathname, '/ready')
  assert.equal(
    readiness.port,
    first.services.hatchet.environment.SERVER_HEALTHCHECK_PORT
  )
  assert.deepEqual(first.services.hatchet.entrypoint, [
    'bash',
    '/local-kb/hatchet-entrypoint.sh',
  ])
  for (const service of Object.values(first.services)) {
    assert.equal(service.ports, undefined)
    assert.equal(service.network_mode, undefined)
    assert.deepEqual(service.networks, ['default'])
    assert.equal(service.restart, 'no')
    for (const mount of service.volumes) {
      if (typeof mount === 'string') {
        assert.ok(Object.hasOwn(first.volumes, mount.split(':')[0]))
      } else {
        assert.equal(mount.read_only, true)
        assert.equal(mount.bind.create_host_path, false)
        assert.ok(mount.source.startsWith(makeInput('a').runtimeCheckoutPath))
      }
    }
  }
})

test('document processing shares extracts across workers and only explicitly initializes', () => {
  const input = makeInput('a')
  assert.throws(
    () => renderDocProcessingCompose(resolveIsolatedConfig(input)),
    /pinned runtime image/
  )
  input.providerRoots.docProcessing.revision = docProcessingImageRevision
  input.providerObservations.docProcessing.revision = docProcessingImageRevision
  const { services, volumes } = renderDocProcessingCompose(
    resolveIsolatedConfig(input)
  )
  assert.equal(
    volumes['document-processing'].name,
    resolveIsolatedConfig(input).mutableState.documentProcessing.volumeName
  )
  assert.deepEqual(services['doc-processing-setup'].profiles, [
    'local-kb-setup',
  ])
  for (const [name, service] of Object.entries(services)) {
    assert.equal(service.environment.DOC_PROCESSING_AUTO_INITIALIZE, '0')
    assert.equal(
      service.env_file.some(({ path }) => path.endsWith('/hatchet-client.env')),
      name !== 'doc-processing-setup'
    )
    assert.equal(
      service.environment.DOC_PROCESSING_DEFAULT_PICTURE_DESCRIPTION,
      'off'
    )
    assert.ok(service.volumes.includes('document-processing:/app/data'))
    assert.equal(service.ports, undefined)
    assert.equal(
      service.command.includes('doc_processing.setup'),
      name === 'doc-processing-setup'
    )
  }
})

test('real retrieval requires its image revision, explicit AI profile and strict local tools', () => {
  assert.throws(
    () => renderRetrievalCompose(resolveIsolatedConfig(makeInput('a'))),
    /pinned runtime image/
  )
  const input = makeInput('a')
  input.providerRoots.retrieval.revision = retrievalImageRevision
  input.providerObservations.retrieval.revision = retrievalImageRevision
  const service = renderRetrievalCompose(resolveIsolatedConfig(input)).services[
    'doc-query'
  ]
  assert.deepEqual(service.profiles, ['local-kb-ai'])
  assert.equal(service.environment.DOC_QUERY_TOOL_CONFIG_REQUIRED, 'true')
  assert.equal(service.environment.MILVUS_URI, 'http://milvus:19530')
  assert.equal(service.environment.OPENAI_API_KEY, undefined)
  assert.ok(service.command.includes('/app/local-src'))
  assert.ok(
    service.volumes.every(
      (mount) => mount.read_only && !mount.bind.create_host_path
    )
  )
  assert.equal(service.ports, undefined)
})

test('retrieval stores isolate vector data, metadata and object backing', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const rendered = renderRetrievalStoreCompose(config)
  const other = renderRetrievalStoreCompose(
    resolveIsolatedConfig(makeInput('b'))
  )
  const names = new Set(Object.values(rendered.volumes).map(({ name }) => name))
  assert.ok(Object.values(other.volumes).every(({ name }) => !names.has(name)))
  assert.ok(
    config.dependencyGraph.nodes.milvus.dependsOn.includes('milvusMetadata')
  )
  assert.deepEqual(rendered.services.milvus.command, [
    'milvus',
    'run',
    'standalone',
  ])
  assert.equal(rendered.services.milvus.environment.MINIO_ADDRESS, 'minio:9000')
  for (const service of Object.values(rendered.services)) {
    assert.equal(service.ports, undefined)
    assert.deepEqual(service.networks, ['default'])
    assert.equal(service.restart, 'no')
    assert.ok(
      service.volumes.every((mount) =>
        Object.hasOwn(rendered.volumes, mount.split(':')[0])
      )
    )
  }
})

test('renders pinned ingestion commands with explicit setup and no writable provider mounts', () => {
  const input = makeInput('a')
  input.providerRoots.ingestion.revision = ingestionImageRevision
  input.providerObservations.ingestion.revision = ingestionImageRevision
  const config = resolveIsolatedConfig(input)
  const { services } = renderIngestionCompose(config)
  assert.deepEqual(services['ingestion-setup'].profiles, ['local-kb-setup'])
  assert.deepEqual(services['ingestion-setup'].command, [
    'python',
    '-m',
    'ingestion_api.migrations',
  ])
  assert.deepEqual(services['ingestion-resource-fetch-worker'].command, [
    'python',
    '-m',
    'ingestion.workers.resource_fetch_worker',
  ])
  for (const [name, service] of Object.entries(services)) {
    assert.match(service.image, /@sha256:[a-f0-9]{64}$/)
    assert.equal(
      service.env_file.some(({ path }) => path.endsWith('/hatchet-client.env')),
      name !== 'ingestion-setup'
    )
    assert.equal(service.restart, 'no')
    assert.equal(service.cpus, 1)
    assert.ok(['1g', '512m'].includes(service.mem_limit))
    assert.equal(service.pids_limit, 256)
    assert.equal(service.environment.PYTHON_DOTENV_DISABLED, '1')
    assert.equal(service.environment.INGESTION_STATE_ENSURE_SCHEMA, 'false')
    assert.equal(service.command.includes('uv'), false)
    assert.equal(service.ports, undefined)
    assert.equal(service.network_mode, undefined)
    for (const mount of service.volumes) {
      assert.equal(mount.read_only, true)
      assert.equal(mount.bind.create_host_path, false)
      assert.ok(
        mount.source.startsWith(input.runtimeCheckoutPath) ||
          mount.source.startsWith(input.providerRoots.ingestion.path)
      )
    }
    if (name !== 'ingestion-setup') {
      assert.equal(service.command.includes('ingestion_api.migrations'), false)
    }
  }
})

test('ingestion rendering refuses dependency/source mismatch and Compose interpolation', () => {
  assert.throws(
    () => renderIngestionCompose(resolveIsolatedConfig(makeInput('a'))),
    /pinned runtime images/
  )
  const input = makeInput('a')
  input.providerRoots.ingestion.revision = ingestionImageRevision
  input.providerObservations.ingestion.revision = ingestionImageRevision
  input.runtimeCheckoutPath += '-$UNEXPECTED'
  assert.throws(
    () => renderIngestionCompose(resolveIsolatedConfig(input)),
    /interpolation/
  )
})

test('keeps roots and health compatible with supported provider commands', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const commands = providerCommands(config)

  assert.deepEqual(commands.lifecycleOrder, [
    'ingestion',
    'scraping',
    'docProcessing',
    'retrieval',
  ])
  assert.deepEqual(commands.stopOrder, [
    'retrieval',
    'docProcessing',
    'scraping',
    'ingestion',
  ])
  assert.equal(commands.providers.ingestion.lifecycle.setup.blocked, true)
  assert.equal(
    commands.providers.retrieval.lifecycle.start.cwd,
    config.providers.retrieval.sourcePath
  )
  assert.ok(
    commands.providers.retrieval.lifecycle.start.args.includes(
      'scripts/local_launcher.py'
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
  for (const url of [
    'https://doc-processing/health',
    'https://doc-processing:443/health',
    `${input.endpoints.docProcessing}?token=synthetic-test-value`,
    `${input.endpoints.docProcessing}#synthetic-test-value`,
  ]) {
    assert.throws(() =>
      resolveIsolatedConfig({
        ...input,
        retainedEndpointOrigins: ['https://doc-processing'],
        endpoints: { ...input.endpoints, docProcessing: url },
      })
    )
  }
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
  const requirement = config.capabilities.documentProcessing

  assert.equal(requirement.status, 'unqualified')
  assert.equal(requirement.qualified, false)
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
