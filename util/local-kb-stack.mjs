import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBackingCompose } from './local-kb/backing-compose.mjs'
import { renderProviderCompose } from './local-kb/compose.mjs'
import {
  docProcessingImageRevision,
  renderDocProcessingCompose,
} from './local-kb/doc-processing-compose.mjs'
import {
  ingestionImageRevision,
  renderIngestionCompose,
} from './local-kb/ingestion-compose.mjs'
import { resolveIsolatedConfig } from './local-kb/isolated-config.mjs'
import {
  claimPreparation,
  completePreparation,
  initializeManagedApplication,
  initializeProviderStorage,
  inspectPreparedInfrastructure,
  installManagedConfiguration,
  prepareLocalConfiguration,
  resumePreparedInfrastructure,
  startPreparedInfrastructure,
  stopPreparedInfrastructure,
} from './local-kb/preparation.mjs'
import { providerCommands } from './local-kb/provider-commands.mjs'
import {
  renderRetrievalCompose,
  retrievalImageRevision,
} from './local-kb/retrieval-compose.mjs'
import { renderRetrievalStoreCompose } from './local-kb/retrieval-store-compose.mjs'
import {
  renderScrapingCompose,
  scrapingImageRevision,
} from './local-kb/scraping-compose.mjs'

const providers = [
  ['ingestion', 'DATA_INGESTION_REPO', 'scripts/start_ingestion_workers.sh'],
  ['scraping', 'WEB_SCRAPING_REPO', 'pyproject.toml'],
  ['retrieval', 'DOC_QUERY_REPO', 'pyproject.toml'],
  ['docProcessing', 'DOC_PROCESSING_REPO', 'pyproject.toml'],
]

const endpoints = [
  ['ingestion', 'LOCAL_KB_INGESTION_PORT', 18081, '/ready'],
  // The current provider dispatcher has no configurable health port.
  ['dispatcher', null, 8001, '/health'],
  ['callback', 'LOCAL_KB_CALLBACK_PORT', 19094, '/metrics'],
  ['scraping', 'LOCAL_KB_SCRAPING_PORT', 18083, '/ready'],
  ['crawl4ai', 'LOCAL_KB_CRAWL4AI_PORT', 11235, '/health'],
  ['milvus', 'LOCAL_KB_MILVUS_HEALTH_PORT', 9093, '/healthz'],
  ['retrieval', 'LOCAL_KB_RETRIEVAL_PORT', 18117, '/health'],
  ['docProcessing', 'LOCAL_KB_DOC_PROCESSING_PORT', 18084, '/health'],
]

export function resolveLocalKbConfig(env) {
  const roots = providers.map(([name, key, entrypoint]) => {
    const path = env[key]
    if (!path || !isAbsolute(path)) {
      throw new Error(
        `${key} must identify an explicit absolute provider path.`
      )
    }
    return { name, path, entrypoint }
  })
  const health = endpoints.map(([name, key, fallback, path]) => {
    const raw = key ? (env[key] ?? String(fallback)) : String(fallback)
    if (!/^[0-9]+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
      throw new Error(`${key} must be a TCP port from 1 to 65535.`)
    }
    return { name, url: `http://127.0.0.1:${Number(raw)}${path}` }
  })
  if (
    new Set(health.map(({ url }) => new URL(url).port)).size !== health.length
  ) {
    throw new Error('Local KB health services must use distinct ports.')
  }
  return { roots, health }
}

function inspectProvider({ name, path, entrypoint }) {
  try {
    const root = realpathSync(path)
    if (!statSync(join(root, entrypoint)).isFile()) throw new Error()
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim()
    return { name, sourceAvailable: true, head }
  } catch {
    return { name, sourceAvailable: false }
  }
}

export function inspectIsolatedProviderSources(config) {
  return config.roots.map(({ name, path, revision }) => {
    try {
      if (realpathSync(path) !== path) throw new Error()
      const git = (args) =>
        execFileSync(
          'git',
          ['-c', 'core.fsmonitor=false', '-C', path, ...args],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 5000,
            env: { PATH: process.env.PATH, GIT_OPTIONAL_LOCKS: '0' },
          }
        ).trim()
      const root = git(['rev-parse', '--show-toplevel'])
      const head = git(['rev-parse', 'HEAD'])
      const clean =
        git([
          'status',
          '--porcelain',
          '--untracked-files=all',
          '--ignored=matching',
          '--ignore-submodules=none',
        ]).length === 0
      return {
        name,
        sourceAvailable: true,
        revisionMatches: head === revision,
        pathMatches: root === path,
        clean,
        qualified: head === revision && root === path && clean,
      }
    } catch {
      return { name, sourceAvailable: false, qualified: false }
    }
  })
}

function requireProviderSources(config) {
  if (
    !inspectIsolatedProviderSources(config).every(({ qualified }) => qualified)
  ) {
    throw new Error(
      'Local lifecycle requires clean provider sources at the pinned revisions.'
    )
  }
}

async function probe({ name, url }) {
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    await response.body?.cancel()
    return { name, reachable: response.status === 200, status: response.status }
  } catch {
    return { name, reachable: false }
  }
}

export async function inspectLocalKbStack(
  config,
  { inspect = inspectProvider, request = probe } = {}
) {
  return {
    providers: config.roots.map(inspect),
    endpoints: await Promise.all(config.health.map(request)),
    ready: false,
    limitations: [
      'HTTP reachability does not establish process ownership or queue safety.',
      'Retrieval identity and prepared-provider contracts are not yet qualified.',
    ],
  }
}

const configPlanBlockers = [
  {
    id: 'rendered-local-deployment',
    status: 'required',
    description:
      'The validation model must be rendered into concrete local deployment services before execution.',
  },
  {
    id: 'provider-preparation',
    status: 'required',
    description:
      'Provider storage preparation and ownership evidence must be completed before execution.',
  },
]

const configPlanLimitations = [
  {
    id: 'supplied-provider-observations',
    status: 'unverified',
    description:
      'providerObservations are supplied input observations; config plan does not freshly verify provider source state.',
  },
  {
    id: 'read-only-validation',
    status: 'read-only',
    description:
      'Config plan runs no provider commands, probes, filesystem writes, setup, or lifecycle operations.',
  },
]

function readConfigPlanInput(path) {
  try {
    if (!isAbsolute(path)) throw new Error()
    return resolveIsolatedConfig(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    throw new Error('Invalid isolated local-KB configuration input.')
  }
}

function configPlan(config) {
  const imagesMatch =
    config.providers.ingestion.revision === ingestionImageRevision &&
    config.providers.scraping.revision === scrapingImageRevision &&
    config.providers.docProcessing.revision === docProcessingImageRevision &&
    config.providers.retrieval.revision === retrievalImageRevision
  return {
    ...config,
    providerCommands: providerCommands(config),
    providerCompose: imagesMatch ? renderProviderCompose(config) : null,
    backingCompose: renderBackingCompose(config),
    docProcessingCompose:
      config.providers.docProcessing.revision === docProcessingImageRevision
        ? renderDocProcessingCompose(config)
        : null,
    scrapingCompose:
      config.providers.scraping.revision === scrapingImageRevision
        ? renderScrapingCompose(config)
        : null,
    retrievalStoreCompose: renderRetrievalStoreCompose(config),
    retrievalCompose:
      config.providers.retrieval.revision === retrievalImageRevision
        ? renderRetrievalCompose(config)
        : null,
    ingestionCompose:
      config.providers.ingestion.revision === ingestionImageRevision
        ? renderIngestionCompose(config)
        : null,
    executable: false,
    blockers: configPlanBlockers,
    limitations: configPlanLimitations,
  }
}

function parseArguments(args) {
  if (
    args.length === 5 &&
    ['setup', 'start', 'resume', 'stop', 'status'].includes(args[0]) &&
    args[1] === '--config' &&
    args[3] === '--candidate' &&
    /^[a-f0-9]{40}$/.test(args[4])
  ) {
    return { command: args[0], configPath: args[2], candidateRevision: args[4] }
  }
  if (args.length === 1 && ['status', 'plan'].includes(args[0])) {
    return { command: args[0] }
  }
  if (
    args.length === 3 &&
    ['plan', 'status'].includes(args[0]) &&
    args[1] === '--config'
  ) {
    return { command: args[0], configPath: args[2] }
  }
  throw new Error(
    'Usage: node util/local-kb-stack.mjs <status|plan> [--config <absolute JSON input path>], or <setup|start|resume|stop|status> --config <path> --candidate <commit>'
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { command, configPath, candidateRevision } = parseArguments(
      process.argv.slice(2)
    )
    if (configPath !== undefined) {
      const config = readConfigPlanInput(configPath)
      if (command === 'setup') {
        // Resolve pins and fresh source state before the exclusive claim or
        // any generated files, Docker operation, or managed lifecycle call.
        renderProviderCompose(config)
        requireProviderSources(config)
        await claimPreparation(config, candidateRevision)
        await prepareLocalConfiguration(config, candidateRevision)
        await installManagedConfiguration(config, candidateRevision)
        requireProviderSources(config)
        await initializeProviderStorage(config, candidateRevision)
        requireProviderSources(config)
        await initializeManagedApplication(config, candidateRevision)
        await completePreparation(config, candidateRevision)
        console.log(
          JSON.stringify({
            prepared: true,
            applicationStarted: false,
            aiQualified: false,
          })
        )
      } else if (command === 'start' || command === 'resume') {
        requireProviderSources(config)
        console.log(
          JSON.stringify(
            await (command === 'resume'
              ? resumePreparedInfrastructure
              : startPreparedInfrastructure)(config, candidateRevision)
          )
        )
      } else if (command === 'stop') {
        console.log(
          JSON.stringify(
            await stopPreparedInfrastructure(config, candidateRevision)
          )
        )
      } else if (command === 'status' && candidateRevision) {
        console.log(
          JSON.stringify(
            await inspectPreparedInfrastructure(config, candidateRevision)
          )
        )
        process.exitCode = 2
      } else if (command === 'plan') {
        console.log(JSON.stringify(configPlan(config), null, 2))
        process.exitCode = 2
      } else {
        const providers = inspectIsolatedProviderSources(config)
        console.log(
          JSON.stringify(
            { providers, ready: false, runtimeObserved: false },
            null,
            2
          )
        )
        process.exitCode = providers.every(({ qualified }) => qualified) ? 2 : 1
      }
    } else {
      const config = resolveLocalKbConfig(process.env)
      if (command === 'plan') {
        // Environment paths alone cannot bind launcher instances, revisions
        // or state directories; only the isolated configuration can.
        const commands = { unsupported: 'isolated-configuration-required' }
        console.log(
          JSON.stringify(
            {
              ...commands,
              executable: false,
              blockers: [
                'Launcher bindings require the isolated local-KB configuration and must be verified before execution.',
              ],
            },
            null,
            2
          )
        )
        process.exitCode = 2
      } else {
        const result = await inspectLocalKbStack(config)
        console.log(JSON.stringify(result, null, 2))
        process.exitCode =
          result.providers.some((provider) => !provider.sourceAvailable) ||
          result.endpoints.some((endpoint) => !endpoint.reachable)
            ? 1
            : 2
      }
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
