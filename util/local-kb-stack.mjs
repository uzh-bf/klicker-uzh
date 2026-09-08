import { execFileSync } from 'node:child_process'
import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { providerCommands } from './local-kb/provider-commands.mjs'

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (
      process.argv.length !== 3 ||
      !['status', 'plan'].includes(process.argv[2])
    ) {
      throw new Error('Usage: node util/local-kb-stack.mjs <status|plan>')
    }
    const config = resolveLocalKbConfig(process.env)
    if (process.argv[2] === 'plan') {
      console.log(
        JSON.stringify(
          {
            ...providerCommands(config),
            executable: false,
            blockers: [
              'Prepared state, process ownership and queue safety must be verified before execution.',
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
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
