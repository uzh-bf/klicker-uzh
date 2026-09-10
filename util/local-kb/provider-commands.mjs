import { join } from 'node:path'

// The isolated plan projects each provider's supported local lifecycle as an
// explicit launcher invocation bound to an instance, a source revision and a
// private state path. The projection is not yet the executable lifecycle: the
// consumer-owned Compose assembly in ./preparation.mjs still starts and stops
// the provider containers, and `configPlan` marks its output non-executable.
// Retiring that assembly is the condition for making these bindings
// authoritative. Setup alone initializes schemas and credentials, so start
// commands never migrate and stop commands never remove state.
const PROVIDER_BASE_ORDER = [
  'scraping',
  'docProcessing',
  'ingestion',
  'retrieval',
]

// Flags every launcher derives from the isolated configuration itself.
export const IDENTITY_FLAGS = new Set([
  '--instance',
  '--state-dir',
  '--config-dir',
  '--source-revision',
  '--state-root',
  '--instance-id',
])

// The ingestion launcher starts provider-owned backing services (pgvector,
// Hatchet, Azurite, Milvus) on allocations the isolated configuration does not
// model, and needs the scraping base URL and model gateway it does not carry.
// The plan records the exact missing bindings instead of inventing values.
const INGESTION_DEPLOYMENT_INPUTS = [
  'state-dsn',
  'web-scraping-base-url',
  'openai-base-url',
  'hatchet-http-port',
  'hatchet-grpc-port',
  'pgvector-port',
  'azurite-port',
  'milvus-port',
  'milvus-health-port',
  'milvus-attu-port',
]

// The retrieval launcher validates a vector-store URI and an OpenAI-compatible
// base URL from its own process environment. The isolated configuration models
// the store's health endpoint rather than the store address, so both bindings
// stay recorded instead of derived.
const RETRIEVAL_DEPLOYMENT_INPUTS = ['milvus-uri', 'openai-base-url']

function unboundDeployment(requires) {
  return {
    blocked: true,
    reason: 'unbound-deployment-inputs',
    requires: [...requires],
  }
}

// Provider order follows the declared dependency graph, so the plan cannot
// contradict a modeled dependency. Nodes without a provider are backing
// services, which the backing renderer starts before any provider.
function providerOrder(config) {
  const nodes = config.dependencyGraph.nodes
  const dependencies = Object.fromEntries(
    PROVIDER_BASE_ORDER.map((name) => [name, new Set()])
  )
  for (const node of Object.values(nodes)) {
    const owner = node.provider
    if (!owner || !dependencies[owner]) continue
    for (const name of node.dependsOn) {
      const source = nodes[name]?.provider
      if (source && source !== owner) dependencies[owner].add(source)
    }
  }
  const ordered = []
  const pending = [...PROVIDER_BASE_ORDER]
  while (pending.length > 0) {
    const index = pending.findIndex((name) =>
      [...dependencies[name]].every((dependency) =>
        ordered.includes(dependency)
      )
    )
    if (index === -1) {
      throw new Error('Provider dependency graph contains a cycle.')
    }
    ordered.push(...pending.splice(index, 1))
  }
  return ordered
}

export function providerCommands(config) {
  const identity = config.project?.identity
  if (!identity || !config.providers || !config.dependencyGraph) {
    throw new Error(
      'Launcher bindings require the isolated local-KB configuration.'
    )
  }
  // Every launcher validates its instance identity with a 48-character
  // ceiling; fail the plan before an oversized project identity reaches one.
  if (identity.length > 48) {
    throw new Error(
      'Project identity exceeds the launcher instance limit of 48 characters.'
    )
  }
  const runtimeRoot = config.project.runtimeCheckoutPath + '/.local-kb'
  const stateRoot = join(runtimeRoot, 'state')
  const endpointPort = (name) => new URL(config.endpoints[name].url).port
  const revision = (name) => config.providers[name].revision
  const stateDir = (name) => join(stateRoot, name)
  // The ingestion launcher rejects any config directory other than its own
  // state directory's project-configs child. The retrieval launcher serves the
  // tool registry the consumer writes into .local-kb/doc-query-tools.
  const ingestionConfigDir = join(stateDir('ingestion'), 'project-configs')
  const retrievalConfigDir = join(runtimeRoot, 'doc-query-tools')
  const command = (name, args) => ({
    cwd: config.providers[name].sourcePath,
    executable: 'uv',
    args: [
      'run',
      '--frozen',
      '--no-sync',
      'python',
      'scripts/local_launcher.py',
      ...args,
    ],
    env: { PYTHON_DOTENV_DISABLED: '1' },
  })

  // The ingestion launcher declares --strict on its top-level parser, so it
  // must precede the verb; argparse rejects it after the subcommand.
  const ingestionArgs = (verb) => [
    '--strict',
    verb,
    '--instance',
    identity,
    '--state-dir',
    stateDir('ingestion'),
    '--config-dir',
    ingestionConfigDir,
  ]
  const ingestion = {
    lifecycle: {
      setup: unboundDeployment(INGESTION_DEPLOYMENT_INPUTS),
      start: unboundDeployment(INGESTION_DEPLOYMENT_INPUTS),
      status: command('ingestion', ingestionArgs('status')),
      stop: command('ingestion', ingestionArgs('stop')),
    },
  }

  const scrapingState = stateDir('scraping')
  const scrapingIdentity = [
    '--instance',
    identity,
    '--state-root',
    scrapingState,
  ]
  const scraping = {
    lifecycle: {
      setup: command('scraping', [
        'setup',
        ...scrapingIdentity,
        '--api-port',
        endpointPort('scraping'),
        '--crawl4ai-port',
        endpointPort('crawl4ai'),
      ]),
      start: command('scraping', ['start', ...scrapingIdentity]),
      status: command('scraping', ['status', ...scrapingIdentity]),
      stop: command('scraping', ['stop', ...scrapingIdentity]),
    },
  }

  const docProcessingState = stateDir('docProcessing')
  const docProcessingArgs = (verb) => [
    verb,
    '--state-root',
    docProcessingState,
    '--instance-id',
    identity,
    '--source-revision',
    revision('docProcessing'),
  ]
  const docProcessing = {
    lifecycle: {
      setup: command('docProcessing', [
        ...docProcessingArgs('setup'),
        '--owner-id',
        identity,
      ]),
      start: command('docProcessing', [
        ...docProcessingArgs('start'),
        '--owner-id',
        identity,
        '--mode',
        'worker',
      ]),
      status: command('docProcessing', docProcessingArgs('status')),
      stop: command('docProcessing', [
        ...docProcessingArgs('stop'),
        '--owner-id',
        identity,
      ]),
    },
  }

  const retrievalArgs = (verb) => [
    verb,
    '--instance',
    identity,
    '--source-revision',
    revision('retrieval'),
    '--state-dir',
    stateDir('retrieval'),
    '--config-dir',
    retrievalConfigDir,
    '--bind',
    '127.0.0.1',
    '--port',
    endpointPort('retrieval'),
  ]
  const retrieval = {
    lifecycle: {
      setup: unboundDeployment(RETRIEVAL_DEPLOYMENT_INPUTS),
      start: unboundDeployment(RETRIEVAL_DEPLOYMENT_INPUTS),
      status: unboundDeployment(RETRIEVAL_DEPLOYMENT_INPUTS),
      stop: command('retrieval', retrievalArgs('stop')),
    },
  }

  const lifecycleOrder = providerOrder(config)
  return {
    lifecycleOrder,
    stopOrder: [...lifecycleOrder].reverse(),
    providers: {
      ingestion,
      scraping,
      docProcessing,
      retrieval,
    },
  }
}
