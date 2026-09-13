import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalKbConfig } from '../local-kb-stack.mjs'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  observeProviderLaunchers,
  providerCommands,
} from './provider-commands.mjs'
import { LAUNCHER_CONTRACTS } from './provider-launcher-contract.mjs'
import { providerImages, providerPorts } from './test-fixtures.mjs'

const providerRevisions = {
  ingestion: 'd'.repeat(40),
  scraping: 'b'.repeat(40),
  retrieval: '8'.repeat(40),
  docProcessing: 'c'.repeat(40),
}

function makeInput(name) {
  const projectIdentity = 'isolated-local-kb-' + name
  const portBase = name === 'a' ? 18000 : 28000
  const providerRoots = Object.fromEntries(
    Object.entries(providerRevisions).map(([provider, revision]) => [
      provider,
      { path: '/synthetic/providers/' + name + '/' + provider, revision },
    ])
  )
  const providerObservations = Object.fromEntries(
    Object.entries(providerRoots).map(([provider, root]) => [
      provider,
      { path: root.path, revision: root.revision, clean: true },
    ])
  )
  return {
    primaryCheckoutPath: '/synthetic/checkouts/' + name + '/primary',
    runtimeCheckoutPath: '/synthetic/checkouts/' + name + '/runtime',
    retainedCheckoutPaths: ['/synthetic/checkouts/' + name + '/retained'],
    projectIdentity,
    retainedProjectIdentities: ['retained-local-kb-' + name],
    retainedMutableVolumeNames: ['retained-local-kb-' + name + '-x-volume'],
    retainedEndpointOrigins: ['https://retained.example.invalid:443'],
    providerRoots,
    providerObservations,
    ports: providerPorts(portBase),
    images: { ...providerImages },
  }
}

function resolveFixture(name) {
  const config = resolveIsolatedConfig(makeInput(name))
  return { config, commands: providerCommands(config) }
}

function providerStatus(config, name) {
  const identity = config.project.identity
  const revision = config.providers[name].revision
  if (name === 'ingestion')
    return {
      instance: { name: identity },
      source: { revision },
      preparation: {
        configuration: 'prepared',
        credentials: 'prepared',
        schema: 'prepared',
      },
      process: { infrastructure: [], workloads: [] },
    }
  if (name === 'docProcessing')
    return {
      instance_id: identity,
      source_revision: revision,
      ownership: 'verified',
      setup: 'ready',
      ready: true,
    }
  if (name === 'scraping')
    return {
      instance: identity,
      source_revision: revision,
      owned: true,
      setup: { prepared: true },
      readiness: { api: true },
    }
  return {
    instance: identity,
    source_revision: revision,
    prepared: true,
    ready: true,
  }
}

test('provider observation validates custody without promoting endpoint health to AI proof', async () => {
  const { config } = resolveFixture('a')
  const verbs = []
  const result = await observeProviderLaunchers(config, async (command) => {
    const name = Object.keys(config.providers).find(
      (key) => config.providers[key].sourcePath === command.cwd
    )
    verbs.push(command.args.includes('status'))
    return JSON.stringify({
      ...providerStatus(config, name),
      privateDiagnostic: 'synthetic-private-value',
    })
  })
  assert.ok(verbs.every(Boolean))
  assert.equal(result.length, 4)
  assert.ok(result.every((row) => row.prepared && !row.aiQualified))
  assert.equal(
    result.find((row) => row.provider === 'ingestion').endpointReady,
    false
  )
  assert.equal(
    JSON.stringify(result).includes('synthetic-private-value'),
    false
  )
})

test('provider observation rejects foreign revisions and suppresses provider diagnostics', async () => {
  const { config } = resolveFixture('a')
  for (const output of [
    'not-json',
    JSON.stringify({
      ...providerStatus(config, 'scraping'),
      source_revision: 'f'.repeat(40),
    }),
  ]) {
    await assert.rejects(
      observeProviderLaunchers(config, async () => output),
      /observation is unavailable or mismatched/
    )
  }
  await assert.rejects(
    observeProviderLaunchers(config, async () => {
      throw new Error('synthetic-private-value')
    }),
    (error) => !error.message.includes('synthetic-private-value')
  )
})

test('bound launchers separate setup inputs from retained start and stop', () => {
  const { config } = resolveFixture('a')
  const bindings = config.bindings
  const commands = providerCommands(config)
  for (const [name, provider] of Object.entries(commands.providers)) {
    for (const [verb, entry] of Object.entries(provider.lifecycle)) {
      assert.equal(entry.blocked, undefined)
      const contract = LAUNCHER_CONTRACTS[name]
      const flags = entry.args.filter(
        (arg) =>
          arg.startsWith('--') && !['--frozen', '--no-sync'].includes(arg)
      )
      for (const flag of flags)
        assert.ok(
          [
            ...contract.globalFlags,
            ...contract.verbs[verb].required,
            ...contract.verbs[verb].optional,
          ].includes(flag),
          `${name}/${verb}: ${flag}`
        )
      for (const flag of contract.verbs[verb].required)
        assert.ok(flags.includes(flag))
    }
  }
  const ingestion = commands.providers.ingestion.lifecycle
  assert.ok(ingestion.setup.args.includes('--worker-env-file'))
  assert.ok(
    ingestion.setup.args.includes(
      `http://host.docker.internal:${bindings.ports.scraping.api}`
    )
  )
  assert.ok(ingestion.start.args.includes('--workers'))
  assert.ok(!ingestion.start.args.includes('--state-dsn'))
  assert.ok(!ingestion.stop.args.includes('--workers'))
  assert.ok(
    commands.providers.docProcessing.lifecycle.start.args.includes('--config')
  )
  assert.deepEqual(commands.stopOrder, [...commands.lifecycleOrder].reverse())
  assert.throws(
    () =>
      providerCommands({
        ...config,
        bindings: { ...bindings, images: { api: 'latest', worker: 'latest' } },
      }),
    /immutable/
  )
})

test('binds explicit launcher identity and revision for derivable providers', () => {
  const { config, commands } = resolveFixture('a')
  const identity = config.project.identity
  for (const provider of ['scraping', 'docProcessing', 'retrieval']) {
    const lifecycle = commands.providers[provider].lifecycle
    for (const verb of ['setup', 'start', 'status', 'stop']) {
      const entry = lifecycle[verb]
      if (entry.blocked) continue
      assert.equal(entry.cwd, config.providers[provider].sourcePath)
      assert.equal(entry.executable, 'uv')
      assert.ok(entry.args.includes('--frozen'))
      assert.ok(entry.args.includes('--no-sync'))
      assert.ok(entry.args.includes('scripts/local_launcher.py'))
      assert.equal(entry.env.PYTHON_DOTENV_DISABLED, '1')
    }
  }
  const docStart = commands.providers.docProcessing.lifecycle.start.args
  assert.equal(docStart[5], 'start')
  assert.ok(docStart.includes(identity))
  assert.ok(docStart.includes('--owner-id'))
  assert.ok(docStart.includes(providerRevisions.docProcessing))
  assert.deepEqual(docStart.slice(docStart.indexOf('--mode')), [
    '--mode',
    'worker',
  ])
  const retrievalStop = commands.providers.retrieval.lifecycle.stop.args
  assert.ok(retrievalStop.includes(providerRevisions.retrieval))
  const retrievalPort = new URL(config.endpoints.retrieval.url).port
  assert.deepEqual(
    retrievalStop.slice(
      retrievalStop.indexOf('--bind'),
      retrievalStop.indexOf('--bind') + 4
    ),
    ['--bind', '127.0.0.1', '--port', retrievalPort]
  )
  // The retrieval launcher serves the tool registry the consumer writes into
  // .local-kb/doc-query-tools, not a state-directory child.
  const retrievalConfigIndex = retrievalStop.indexOf('--config-dir')
  assert.deepEqual(
    retrievalStop.slice(retrievalConfigIndex, retrievalConfigIndex + 2),
    ['--config-dir', '/synthetic/checkouts/a/runtime/.local-kb/doc-query-tools']
  )
  const scrapingSetup = commands.providers.scraping.lifecycle.setup.args
  assert.deepEqual(
    scrapingSetup.slice(
      scrapingSetup.indexOf('--api-port'),
      scrapingSetup.indexOf('--api-port') + 4
    ),
    [
      '--api-port',
      new URL(config.endpoints.scraping.url).port,
      '--crawl4ai-port',
      new URL(config.endpoints.crawl4ai.url).port,
    ]
  )
  const stateDir = '/synthetic/checkouts/a/runtime/.local-kb/state'
  assert.ok(
    commands.providers.scraping.lifecycle.start.args.includes(
      stateDir + '/scraping'
    )
  )
})

test('binds ingestion setup and retains the prepared identity across lifecycle verbs', () => {
  const { config, commands } = resolveFixture('b')
  const lifecycle = commands.providers.ingestion.lifecycle
  for (const verb of ['setup', 'start']) {
    assert.equal(lifecycle[verb].blocked, undefined)
    assert.ok(
      lifecycle[verb].args.includes(config.providers.ingestion.revision)
    )
  }
  for (const verb of ['status', 'stop']) {
    const args = lifecycle[verb].args
    // The launcher declares --strict on its top-level parser, which argparse
    // requires before the verb.
    assert.equal(args[5], '--strict')
    assert.equal(args[6], verb)
    assert.ok(args.includes(config.project.identity))
  }
  const stateDir = '/synthetic/checkouts/b/runtime/.local-kb/state/ingestion'
  assert.deepEqual(
    lifecycle.status.args.slice(lifecycle.status.args.indexOf('--state-dir')),
    ['--state-dir', stateDir, '--config-dir', stateDir + '/project-configs']
  )
})

test('orders setup from the dependency graph and reverses stop', () => {
  const { config, commands } = resolveFixture('a')
  const order = commands.lifecycleOrder
  assert.deepEqual(order, [
    'scraping',
    'docProcessing',
    'ingestion',
    'retrieval',
  ])
  assert.deepEqual([...order].reverse(), commands.stopOrder)
  const nodes = config.dependencyGraph.nodes
  for (const [name, node] of Object.entries(nodes)) {
    if (!node.provider) continue
    for (const dependency of node.dependsOn) {
      const source = nodes[dependency]?.provider
      if (!source || source === node.provider) continue
      assert.ok(
        order.indexOf(source) < order.indexOf(node.provider),
        name + ' depends on ' + source + ', which must start first'
      )
    }
  }
  for (const provider of Object.values(commands.providers)) {
    for (const entry of Object.values(provider.lifecycle)) {
      if (entry.blocked) continue
      const argv = ' ' + entry.args.join(' ') + ' '
      assert.equal(/migrations/.test(argv), false)
      assert.equal(/ compose down | volume rm | docker rm /.test(argv), false)
    }
  }
})

test('emits only flags the provider facade declares', () => {
  const { commands } = resolveFixture('a')
  for (const [name, provider] of Object.entries(commands.providers)) {
    const contract = LAUNCHER_CONTRACTS[name]
    for (const [verb, entry] of Object.entries(provider.lifecycle)) {
      if (entry.blocked) continue
      const accepted = contract.verbs[verb]
      // Flags before the facade path belong to the uv invocation.
      const cli = entry.args.slice(
        entry.args.indexOf('scripts/local_launcher.py') + 1
      )
      for (const flag of cli.filter((arg) => arg.startsWith('--'))) {
        assert.ok(
          contract.globalFlags.includes(flag) ||
            accepted.required.includes(flag) ||
            accepted.optional.includes(flag),
          name + ' ' + verb + ' emits undeclared flag ' + flag
        )
      }
      for (const flag of contract.globalFlags)
        assert.ok(
          entry.args.indexOf(flag) < entry.args.indexOf(verb),
          name + ' ' + verb + ' must place ' + flag + ' before the verb'
        )
    }
  }
})

test('emits every provider-required flag for derivable commands', () => {
  const { commands } = resolveFixture('a')
  for (const [name, provider] of Object.entries(commands.providers)) {
    const contract = LAUNCHER_CONTRACTS[name]
    for (const [verb, entry] of Object.entries(provider.lifecycle)) {
      if (entry.blocked) continue
      for (const flag of contract.verbs[verb].required)
        assert.ok(
          entry.args.includes(flag),
          name + ' ' + verb + ' omits required ' + flag
        )
    }
  }
})

test('maps explicit host environment for every retrieval lifecycle verb', () => {
  const { commands } = resolveFixture('a')
  for (const entry of Object.values(commands.providers.retrieval.lifecycle)) {
    for (const name of [
      'MILVUS_URI',
      'MILVUS_COLLECTION_NAME',
      'OPENAI_BASE_URL',
      'OPENAI_API_KEY',
    ]) {
      assert.ok(entry.args.includes(`${name}=KLICKER_LOCAL_RETRIEVAL_${name}`))
    }
  }
})

test('requires the isolated configuration for launcher bindings', () => {
  const simple = resolveLocalKbConfig({
    DATA_INGESTION_REPO: '/synthetic/ingestion',
    WEB_SCRAPING_REPO: '/synthetic/scraping',
    DOC_QUERY_REPO: '/synthetic/retrieval',
    DOC_PROCESSING_REPO: '/synthetic/doc-processing',
  })
  assert.throws(
    () => providerCommands(simple),
    /isolated local-KB configuration/
  )
})

test('rejects identities beyond the launcher instance limit', () => {
  const input = makeInput('a')
  input.projectIdentity = 'a'.repeat(49)
  assert.throws(() => resolveIsolatedConfig(input), /at most 48 characters/)
})
