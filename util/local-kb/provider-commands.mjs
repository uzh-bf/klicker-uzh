import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { validateIsolatedConfig } from './isolated-config.mjs'

// Only project identity and bounded readiness fields leave provider observation.
// A healthy endpoint does not prove workflow registration or model execution.
export async function observeProviderLaunchers(
  config,
  run = runProviderCommand,
  environment = {}
) {
  const commands = providerCommands(config)
  const observations = []
  for (const name of commands.lifecycleOrder) {
    try {
      const status = JSON.parse(
        await run(commands.providers[name].lifecycle.status, environment)
      )
      const identity =
        name === 'ingestion'
          ? status.instance?.name
          : name === 'docProcessing'
            ? status.instance_id
            : status.instance
      const revision =
        name === 'ingestion' ? status.source?.revision : status.source_revision
      if (
        identity !== config.project.identity ||
        revision !== config.providers[name].revision
      ) {
        throw new Error()
      }
      let prepared
      let endpointReady = false
      let stopped = false
      if (name === 'ingestion') {
        prepared = ['configuration', 'credentials', 'schema'].every(
          (key) => status.preparation?.[key] === 'prepared'
        )
        if (
          !Array.isArray(status.process?.workloads) ||
          !Array.isArray(status.process?.infrastructure)
        )
          throw new Error()
        endpointReady = status.process.workloads.some(
          (row) =>
            row.service === 'ingestion-api' &&
            row.state === 'running' &&
            row.health === 'healthy'
        )
        stopped = [
          ...status.process.infrastructure,
          ...status.process.workloads,
        ].every((row) => ['exited', 'created', 'dead'].includes(row.state))
      } else if (name === 'docProcessing') {
        if (
          status.ownership !== 'verified' ||
          typeof status.ready !== 'boolean'
        )
          throw new Error()
        prepared = status.setup === 'ready'
        endpointReady = status.ready
        stopped =
          status.api === 'stopped' &&
          Object.values(status.workers ?? {}).every(
            (state) => state === 'stopped'
          )
      } else if (name === 'scraping') {
        if (status.owned !== true || typeof status.readiness?.api !== 'boolean')
          throw new Error()
        prepared = status.setup?.prepared === true
        endpointReady = status.readiness.api
        stopped =
          status.runtime?.api?.running === false &&
          Array.isArray(status.runtime?.services) &&
          status.runtime.services.length === 0
      } else {
        if (
          typeof status.ready !== 'boolean' ||
          typeof status.prepared !== 'boolean'
        )
          throw new Error()
        prepared = status.prepared
        endpointReady = status.ready
        stopped = status.runtime === 'stopped'
      }
      observations.push({
        provider: name,
        prepared,
        endpointReady,
        stopped,
        aiQualified: false,
      })
    } catch {
      throw new Error(
        `Provider ${name} observation is unavailable or mismatched; output withheld.`
      )
    }
  }
  return observations
}

// Capture provider diagnostics: child output may contain private connection
// settings and must never be forwarded by the consumer lifecycle.
export async function runProviderCommand(command, environment = {}) {
  const inherited = Object.fromEntries(
    ['HOME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'USER']
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]])
  )
  try {
    const { stdout } = await promisify(execFile)(
      command.executable,
      command.args,
      {
        cwd: command.cwd,
        env: { ...inherited, ...environment, ...command.env },
        timeout: 20 * 60 * 1000,
        maxBuffer: 1024 * 1024,
      }
    )
    return stdout
  } catch {
    throw new Error(
      'Provider command failed; output withheld and state retained.'
    )
  }
}

// Setup alone initializes schemas and credentials. Retained start and stop
// invoke the provider's prepared lifecycle, never setup or data deletion.
export function providerCommands(config) {
  if (!config.project || !config.bindings) {
    throw new Error(
      'Launcher bindings require the isolated local-KB configuration.'
    )
  }
  validateIsolatedConfig(config)
  const identity = config.project.identity
  const runtimeRoot = join(config.project.runtimeCheckoutPath, '.local-kb')
  const stateDir = (name) => join(runtimeRoot, 'state', name)
  const revision = (name) => config.providers[name].revision
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
  return boundCommands({
    identity,
    runtimeRoot,
    stateDir,
    revision,
    command,
    bindings: config.bindings,
    ingestionConfigDir: join(stateDir('ingestion'), 'project-configs'),
    retrievalConfigDir: join(runtimeRoot, 'doc-query-tools'),
  })
}

function boundCommands({
  identity,
  runtimeRoot,
  stateDir,
  revision,
  command,
  bindings,
  ingestionConfigDir,
  retrievalConfigDir,
}) {
  const { ports, containerBases: container } = bindings
  const verbs = ['setup', 'start', 'status', 'stop']
  const lifecycle = (provider, args) => ({
    lifecycle: Object.fromEntries(
      verbs.map((verb) => [verb, command(provider, args(verb))])
    ),
  })
  const ingestion = lifecycle('ingestion', (verb) => {
    const args = [
      '--strict',
      verb,
      '--instance',
      identity,
      '--state-dir',
      stateDir('ingestion'),
      '--config-dir',
      ingestionConfigDir,
    ]
    if (verb === 'setup' || verb === 'start') {
      args.push('--source-revision', revision('ingestion'))
    }
    if (verb === 'start') args.push('--workers')
    if (verb === 'setup') {
      const portFlags = {
        'hatchet-http-port': 'hatchetHttp',
        'hatchet-grpc-port': 'hatchetGrpc',
        'pgvector-port': 'postgres',
        'azurite-port': 'azurite',
        'milvus-port': 'milvus',
        'milvus-health-port': 'milvusHealth',
        'milvus-attu-port': 'milvusAttu',
        'resource-api-port': 'api',
        'dispatcher-port': 'dispatcher',
      }
      args.push(
        '--state-dsn',
        `postgresql://hatchet:hatchet@127.0.0.1:${ports.ingestion.postgres}/hatchet`,
        '--web-scraping-base-url',
        container.scraping,
        '--openai-base-url',
        container.model,
        '--worker-image',
        bindings.images.worker,
        '--api-image',
        bindings.images.api,
        '--worker-env-file',
        join(runtimeRoot, 'ingestion-worker.env'),
        '--api-env-file',
        join(runtimeRoot, 'ingestion-api.env'),
        '--producer-registry-dir',
        join(runtimeRoot, 'producer-registry'),
        '--project-configs-source',
        join(runtimeRoot, 'project-configs')
      )
      for (const [flag, port] of Object.entries(portFlags)) {
        args.push(`--${flag}`, String(ports.ingestion[port]))
      }
    }
    return args
  })
  const scraping = lifecycle('scraping', (verb) => {
    const args = [
      verb,
      '--instance',
      identity,
      '--state-root',
      stateDir('scraping'),
    ]
    if (verb === 'setup')
      args.push(
        '--api-port',
        String(ports.scraping.api),
        '--crawl4ai-port',
        String(ports.scraping.crawl4ai),
        '--postgres-port',
        String(ports.scraping.postgres),
        '--api-key-file',
        join(runtimeRoot, 'scraping-api-key')
      )
    return args
  })
  const docProcessing = lifecycle('docProcessing', (verb) => {
    const args = [
      verb,
      '--state-root',
      stateDir('docProcessing'),
      '--instance-id',
      identity,
      '--source-revision',
      revision('docProcessing'),
      '--owner-id',
      identity,
    ]
    if (verb === 'setup' || verb === 'start')
      args.push('--config', join(runtimeRoot, 'doc-processing.json'))
    if (verb === 'start') args.push('--mode', 'worker')
    return args
  })
  const retrieval = lifecycle('retrieval', (verb) => {
    const args = [
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
      String(ports.retrieval.api),
    ]
    for (const name of [
      'MILVUS_URI',
      'MILVUS_COLLECTION_NAME',
      'OPENAI_BASE_URL',
      'OPENAI_API_KEY',
    ]) {
      args.push('--env', `${name}=KLICKER_LOCAL_RETRIEVAL_${name}`)
    }
    return args
  })
  return {
    lifecycleOrder: ['scraping', 'docProcessing', 'ingestion', 'retrieval'],
    stopOrder: ['retrieval', 'ingestion', 'docProcessing', 'scraping'],
    providers: { scraping, docProcessing, ingestion, retrieval },
  }
}
