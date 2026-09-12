import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'
import { renderBackingCompose } from './backing-compose.mjs'
import {
  resolveIsolatedConfig,
  resolveProviderBindings,
  validateIsolatedConfig,
} from './isolated-config.mjs'
import {
  renderManagedConfiguration,
  renderProviderRouting,
} from './managed-configuration.mjs'
import { providerCommands } from './provider-commands.mjs'
import { providerImages, providerPorts } from './test-fixtures.mjs'

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
    ports: providerPorts(portBase),
    images: { ...providerImages },
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
  for (const [name, service] of Object.entries(result.compose.services)) {
    const published = {
      app: [`127.0.0.1:${config.bindings.ports.klicker.backend}:3000`],
      litellm: [`127.0.0.1:${config.bindings.ports.klicker.model}:4000`],
    }
    assert.deepEqual(service.ports, published[name])
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
  for (const [provider, state] of [
    ['docProcessing', 'documentProcessing'],
    ['ingestion', 'ingestionOutbox'],
    ['scraping', 'scraperCache'],
    ['retrieval', 'docQuery'],
  ]) {
    assert.equal(first.mutableState[state].managedBy, 'provider-launcher')
    assert.equal(first.mutableState[state].volumeName, undefined)
    assert.equal(
      first.mutableState[state].path,
      `${first.project.runtimeCheckoutPath}/.local-kb/state/${provider}`
    )
  }
  assert.deepEqual(first.dependencyGraph.nodes.documentProcessing.dependsOn, [
    'docProcessingBacking',
  ])
  assert.deepEqual(first.dependencyGraph.nodes.ingestionApi.dependsOn, [
    'ingestionBacking',
    'ingestionOutbox',
  ])
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
    assert.deepEqual(
      service.ports,
      service === first.services.blob ? ['127.0.0.1:18002:10000'] : undefined
    )
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

test('keeps roots and health compatible with supported provider commands', () => {
  const config = resolveIsolatedConfig(makeInput('a'))
  const commands = providerCommands(config)

  assert.equal(
    // Retrieval start is blocked pending its launcher's validated bindings,
    // so the derivable stop verb carries the source-path binding.
    commands.providers.retrieval.lifecycle.stop.cwd,
    config.providers.retrieval.sourcePath
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

test('derives endpoints from ports and rejects endpoint overrides or persisted drift', () => {
  const input = makeInput('a')
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      retainedEndpointOrigins: [
        `http://127.0.0.1:${input.ports.docProcessing.api}/other`,
      ],
    })
  )
  assert.throws(() =>
    resolveIsolatedConfig({
      ...input,
      endpoints: {
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
  const config = resolveIsolatedConfig(input)
  config.bindings.containerBases.ingestion = 'https://remote.example.invalid'
  assert.throws(() => validateIsolatedConfig(config))
  const imageDrift = resolveIsolatedConfig(input)
  imageDrift.bindings.images.api = 'example.invalid/api:latest'
  assert.throws(() => validateIsolatedConfig(imageDrift))
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

test('provider bindings reuse every selected port across host and container bases', () => {
  const ports = providerPorts()
  const bindings = resolveProviderBindings(ports, 'generation-lifecycle')

  assert.deepEqual(bindings.ports, ports)
  assert.notEqual(bindings.ports, ports)
  assert.notEqual(bindings.ports.klicker, ports.klicker)
  assert.equal(bindings.instance, 'generation-lifecycle')
  assert.deepEqual(
    {
      backend: bindings.hostBases.backend,
      model: bindings.hostBases.model,
      blob: bindings.hostBases.blob,
      ingestion: bindings.hostBases.ingestion,
      dispatcher: bindings.hostBases.dispatcher,
      scraping: bindings.hostBases.scraping,
      docProcessing: bindings.hostBases.docProcessing,
      milvus: bindings.hostBases.milvus,
      retrieval: bindings.hostBases.retrieval,
    },
    {
      backend: `http://127.0.0.1:${ports.klicker.backend}`,
      model: `http://127.0.0.1:${ports.klicker.model}/v1`,
      blob: `http://127.0.0.1:${ports.klicker.blob}/klickerdev`,
      ingestion: `http://127.0.0.1:${ports.ingestion.api}`,
      dispatcher: `http://127.0.0.1:${ports.ingestion.dispatcher}`,
      scraping: `http://127.0.0.1:${ports.scraping.api}`,
      docProcessing: `http://127.0.0.1:${ports.docProcessing.api}`,
      milvus: `http://127.0.0.1:${ports.ingestion.milvus}`,
      retrieval: `http://127.0.0.1:${ports.retrieval.api}/mcp`,
    }
  )
  assert.deepEqual(
    {
      backend: bindings.containerBases.backend,
      model: bindings.containerBases.model,
      blob: bindings.containerBases.blob,
      ingestion: bindings.containerBases.ingestion,
      dispatcher: bindings.containerBases.dispatcher,
      scraping: bindings.containerBases.scraping,
      docProcessing: bindings.containerBases.docProcessing,
      milvus: bindings.containerBases.milvus,
      retrieval: bindings.containerBases.retrieval,
    },
    {
      backend: `http://host.docker.internal:${ports.klicker.backend}`,
      model: `http://host.docker.internal:${ports.klicker.model}/v1`,
      blob: `http://host.docker.internal:${ports.klicker.blob}/klickerdev`,
      ingestion: `http://host.docker.internal:${ports.ingestion.api}`,
      dispatcher: `http://host.docker.internal:${ports.ingestion.dispatcher}`,
      scraping: `http://host.docker.internal:${ports.scraping.api}`,
      docProcessing: `http://host.docker.internal:${ports.docProcessing.api}`,
      milvus: 'http://milvus-standalone:19530',
      retrieval: `http://host.docker.internal:${ports.retrieval.api}/mcp`,
    }
  )
  for (const name of Object.keys(bindings.hostBases).sort()) {
    assert.ok(Object.hasOwn(bindings.containerBases, name))
  }
  assert.equal(bindings.collection, 'local_cli_ingestion_generation_lifecycle')
  assert.equal(
    bindings.collection,
    `local_cli_ingestion_${bindings.instance.replaceAll('-', '_')}`
  )
  assert.equal(bindings.stateSchema, 'ingestion_state_generation_lifecycle')
  assert.equal(
    bindings.stateSchema,
    `ingestion_state_${bindings.instance.replaceAll('-', '_')}`
  )
  assert.match(bindings.collection, /^[a-z][a-z0-9_]*$/)
  assert.match(bindings.stateSchema, /^[a-z][a-z0-9_]*$/)
})

test('resolves provider bindings from the caller-supplied ports without mutating them', () => {
  const first = resolveProviderBindings(providerPorts(19000), 'stack-a-b')
  const second = resolveProviderBindings(providerPorts(21000), 'stack-c')

  assert.deepEqual(first.ports.klicker, providerPorts(19000).klicker)
  assert.deepEqual(second.ports.klicker, providerPorts(21000).klicker)
  assert.notEqual(first.ports.klicker.backend, second.ports.klicker.backend)
  assert.notEqual(first.collection, second.collection)
  assert.equal(first.collection, 'local_cli_ingestion_stack_a_b')
  assert.equal(second.stateSchema, 'ingestion_state_stack_c')
  assert.equal(first.hostBases.backend, `http://127.0.0.1:19000`)
  assert.equal(second.hostBases.retrieval, `http://127.0.0.1:${21019}/mcp`)
})

test('rejects incomplete, out-of-range, and overlapping provider ports', () => {
  assert.throws(() => resolveProviderBindings(undefined, 'stack'))
  assert.throws(() => resolveProviderBindings({}, 'stack'))
  assert.throws(() =>
    resolveProviderBindings({ ...providerPorts(), unknown: {} }, 'stack')
  )

  const missing = providerPorts()
  delete missing.retrieval.api
  assert.throws(() => resolveProviderBindings(missing, 'stack'))

  const extra = providerPorts()
  extra.klicker.extra = 19400
  assert.throws(() => resolveProviderBindings(extra, 'stack'))

  const outOfRange = providerPorts()
  outOfRange.scraping.postgres = 65536
  assert.throws(() => resolveProviderBindings(outOfRange, 'stack'))

  const low = providerPorts()
  low.retrieval.api = 80
  assert.throws(() => resolveProviderBindings(low, 'stack'))

  const fractional = providerPorts()
  fractional.docProcessing.api = 19012.5
  assert.throws(() => resolveProviderBindings(fractional, 'stack'))

  const duplicateWithinGroup = providerPorts()
  duplicateWithinGroup.ingestion.azurite = duplicateWithinGroup.ingestion.api
  assert.throws(() => resolveProviderBindings(duplicateWithinGroup, 'stack'))

  const duplicateAcrossGroups = providerPorts()
  duplicateAcrossGroups.retrieval.api = duplicateAcrossGroups.klicker.backend
  assert.throws(() => resolveProviderBindings(duplicateAcrossGroups, 'stack'))

  const duplicateAcrossTargets = providerPorts()
  duplicateAcrossTargets.docProcessing.hatchetHttp =
    duplicateAcrossTargets.scraping.crawl4ai
  assert.throws(() => resolveProviderBindings(duplicateAcrossTargets, 'stack'))
})

test('rejects any selected port already held by a retained endpoint', () => {
  const ports = providerPorts()
  const retained = [
    'https://retained.example.invalid:19000',
    'postgresql://retained.example.invalid:19006/ingestion',
    'redis://retained.example.invalid:19019',
  ]
  assert.throws(() => resolveProviderBindings(ports, 'stack', retained))

  const safe = [
    'https://retained.example.invalid',
    'https://retained.example.invalid:443',
    'redis://retained.example.invalid:6379',
    'https://retained.example.invalid/health',
  ]
  assert.deepEqual(
    resolveProviderBindings(ports, 'stack', safe).ports.retrieval.api,
    ports.retrieval.api
  )
  assert.deepEqual(resolveProviderBindings(ports, 'stack').ports, ports)
  assert.throws(() => resolveProviderBindings(ports, 'stack', ['not-a-url']))
  assert.throws(() =>
    resolveProviderBindings(ports, 'stack', ['file:///tmp/retained'])
  )
  assert.deepEqual(
    resolveProviderBindings(ports, 'stack', [
      `http://127.0.0.1:6379/record:${ports.klicker.backend}`,
    ]).ports,
    ports
  )
})

test('rejects unsafe instance identifiers for provider bindings', () => {
  const ports = providerPorts()
  for (const instance of [
    '',
    '-leading',
    'Upper',
    'with space',
    'with_underscore',
    'a'.repeat(49),
    'dot.ted',
  ]) {
    assert.throws(() => resolveProviderBindings(ports, instance), /instance/)
  }
  assert.equal(resolveProviderBindings(ports, 'a').instance, 'a')
  assert.equal(
    resolveProviderBindings(ports, '0-9a').collection,
    'local_cli_ingestion_0_9a'
  )
})
