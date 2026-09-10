import { join } from 'node:path'

// Provider-owned launchers are the supported local lifecycle contract.
// Klicker assembles explicit launcher invocations with instance, source
// revision and private state bindings; it owns no provider service assembly.
// Setup alone initializes schemas and credentials, so start commands never
// migrate and stop commands never remove state.
const LIFECYCLE_ORDER = ['ingestion', 'scraping', 'docProcessing', 'retrieval']

// The ingestion launcher starts provider-owned backing services (pgvector,
// Hatchet, Azurite, Milvus) on ports the isolated configuration does not
// model. The plan records the exact missing bindings instead of inventing
// port allocations. All other lifecycle commands are fully derivable.
const INGESTION_DEPLOYMENT_INPUTS = [
  'state-dsn',
  'pgvector-port',
  'hatchet-http-port',
  'hatchet-grpc-port',
  'milvus-port',
  'milvus-attu-port',
  'openai-base-url',
]

function unboundDeployment(requiredInputs) {
  return {
    blocked: true,
    reason: 'unbound-deployment-inputs',
    requires: [...requiredInputs],
  }
}

export function providerCommands(config) {
  const identity = config.project?.identity
  if (!identity || !config.providers) {
    throw new Error(
      'Launcher bindings require the isolated local-KB configuration.'
    )
  }
  const stateRoot = config.project.runtimeCheckoutPath + '/.local-kb/state'
  const endpointPort = (name) => new URL(config.endpoints[name].url).port
  const revision = (name) => config.providers[name].revision
  const stateDir = (name) => join(stateRoot, name)
  // The ingestion launcher requires the config directory to be the state
  // directory's project-configs child; the same convention keeps every
  // provider's derived configuration in one owned place.
  const configDir = (name) => join(stateDir(name), 'project-configs')
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

  const ingestionState = stateDir('ingestion')
  const ingestionIdentity = [
    '--strict',
    '--instance',
    identity,
    '--state-dir',
    ingestionState,
    '--config-dir',
    configDir('ingestion'),
  ]
  const ingestion = {
    lifecycle: {
      setup: unboundDeployment(INGESTION_DEPLOYMENT_INPUTS),
      start: unboundDeployment(INGESTION_DEPLOYMENT_INPUTS),
      status: command('ingestion', ['status', ...ingestionIdentity]),
      stop: command('ingestion', ['stop', ...ingestionIdentity]),
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

  const retrievalState = stateDir('retrieval')
  const retrievalArgs = (verb) => [
    verb,
    '--instance',
    identity,
    '--source-revision',
    revision('retrieval'),
    '--state-dir',
    retrievalState,
    '--config-dir',
    configDir('retrieval'),
    '--bind',
    '127.0.0.1',
    '--port',
    endpointPort('retrieval'),
  ]
  const retrieval = {
    lifecycle: {
      setup: command('retrieval', retrievalArgs('setup')),
      start: command('retrieval', retrievalArgs('start')),
      status: command('retrieval', retrievalArgs('status')),
      stop: command('retrieval', retrievalArgs('stop')),
    },
  }

  return {
    lifecycleOrder: [...LIFECYCLE_ORDER],
    stopOrder: [...LIFECYCLE_ORDER].reverse(),
    providers: {
      ingestion,
      scraping,
      docProcessing,
      retrieval,
    },
  }
}
