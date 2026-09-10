import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalKbConfig } from '../local-kb-stack.mjs'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import { IDENTITY_FLAGS, providerCommands } from './provider-commands.mjs'
import { LAUNCHER_CONTRACTS } from './provider-launcher-contract.mjs'

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
  const endpoint = (offset) =>
    'http://127.0.0.1:' + (portBase + offset) + '/health'
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
    endpoints: {
      klicker: 'http://127.0.0.1:' + portBase + '/graphql',
      postgres: 'postgresql://127.0.0.1:' + (portBase + 1) + '/postgres',
      hatchet: endpoint(2),
      redis: 'redis://127.0.0.1:' + (portBase + 3) + '/0',
      blob: endpoint(4),
      ingestion: endpoint(5),
      dispatcher: endpoint(6),
      callback: endpoint(7),
      scraping: endpoint(8),
      crawl4ai: endpoint(9),
      milvus: endpoint(10),
      objectBacking: endpoint(11),
      retrieval: endpoint(12),
      docProcessing: endpoint(13),
    },
  }
}

function resolveFixture(name) {
  const config = resolveIsolatedConfig(makeInput(name))
  return { config, commands: providerCommands(config) }
}

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
  assert.deepEqual(retrievalStop.slice(retrievalStop.indexOf('--bind')), [
    '--bind',
    '127.0.0.1',
    '--port',
    retrievalPort,
  ])
  // The retrieval launcher serves the tool registry the consumer writes into
  // .local-kb/doc-query-tools, not a state-directory child.
  const retrievalConfigIndex = retrievalStop.indexOf('--config-dir')
  assert.deepEqual(
    retrievalStop.slice(retrievalConfigIndex, retrievalConfigIndex + 2),
    ['--config-dir', '/synthetic/checkouts/a/runtime/.local-kb/doc-query-tools']
  )
  const scrapingSetup = commands.providers.scraping.lifecycle.setup.args
  assert.deepEqual(scrapingSetup.slice(scrapingSetup.indexOf('--api-port')), [
    '--api-port',
    new URL(config.endpoints.scraping.url).port,
    '--crawl4ai-port',
    new URL(config.endpoints.crawl4ai.url).port,
  ])
  const stateDir = '/synthetic/checkouts/a/runtime/.local-kb/state'
  assert.ok(
    commands.providers.scraping.lifecycle.start.args.includes(
      stateDir + '/scraping'
    )
  )
})

test('blocks ingestion deployment on unmodeled provider-owned inputs', () => {
  const { config, commands } = resolveFixture('b')
  const lifecycle = commands.providers.ingestion.lifecycle
  for (const verb of ['setup', 'start']) {
    assert.equal(lifecycle[verb].blocked, true)
    assert.equal(lifecycle[verb].reason, 'unbound-deployment-inputs')
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

test('records unbound ingestion inputs beyond the launcher identity', () => {
  const { commands } = resolveFixture('a')
  const ingestion = commands.providers.ingestion.lifecycle
  const setupInputs = LAUNCHER_CONTRACTS.ingestion.verbs.setup.required
    .filter((flag) => !IDENTITY_FLAGS.has(flag))
    .map((flag) => flag.slice(2))
  assert.ok(setupInputs.length > 0)
  for (const verb of ['setup', 'start']) {
    // Start cannot run before setup established the same bindings.
    assert.deepEqual(ingestion[verb].requires, setupInputs)
  }
})

test('records the retrieval bindings its launcher validates', () => {
  const { commands } = resolveFixture('a')
  const lifecycle = commands.providers.retrieval.lifecycle
  for (const verb of ['setup', 'start', 'status']) {
    assert.equal(lifecycle[verb].blocked, true)
    assert.equal(lifecycle[verb].reason, 'unbound-deployment-inputs')
    assert.deepEqual(lifecycle[verb].requires, [
      ...LAUNCHER_CONTRACTS.retrieval.environment,
    ])
  }
  assert.equal(lifecycle.stop.blocked, undefined)
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
  const config = resolveIsolatedConfig(input)
  assert.throws(
    () => providerCommands(config),
    /launcher instance limit of 48 characters/
  )
})
