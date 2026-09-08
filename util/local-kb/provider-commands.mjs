import { join } from 'node:path'

// Use the provider's individual entrypoints: its convenience fleet launcher
// applies migrations before serving, which belongs to explicit setup only.
export function providerCommands(config) {
  const root = (name) => {
    const provider = config.roots.find((entry) => entry.name === name)
    if (!provider) throw new Error(`Missing ${name} provider.`)
    return provider.path
  }
  const port = (name) => {
    const endpoint = config.health.find((entry) => entry.name === name)
    if (!endpoint) throw new Error(`Missing ${name} endpoint.`)
    return new URL(endpoint.url).port
  }
  const ingestionRoot = root('ingestion')
  const ingestionApi = join(ingestionRoot, 'modules/ingestion-api')
  const ingestion = join(ingestionRoot, 'modules/ingestion')
  const uv = (cwd, args, env = {}) => ({
    cwd,
    executable: 'uv',
    args: ['run', '--frozen', '--no-sync', ...args],
    env: { PYTHON_DOTENV_DISABLED: '1', ...env },
  })
  return {
    // The provider initializes stores during API import. Do not run it as
    // migration-free startup until that preparation contract is reconciled.
    blockedProviders: [
      {
        name: 'docProcessing',
        reason: 'provider-startup-initializes-state',
        requires: ['isolated-prepared-storage', 'local-api-key'],
        command: uv(root('docProcessing'), [
          'uvicorn',
          'doc_processing.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          port('docProcessing'),
          '--workers',
          '1',
        ]),
      },
    ],
    setup: {
      migrations: uv(ingestionRoot, [
        '--project',
        ingestionApi,
        'python',
        '-m',
        'ingestion_api.migrations',
      ]),
    },
    start: [
      {
        name: 'ingestion-api',
        ...uv(
          ingestionRoot,
          [
            '--project',
            ingestionApi,
            'uvicorn',
            'ingestion_api.app:create_app',
            '--factory',
            '--host',
            '127.0.0.1',
            '--port',
            port('ingestion'),
          ],
          { INGESTION_STATE_ENSURE_SCHEMA: 'false' }
        ),
      },
      ...[
        'cpu_worker',
        'db_worker',
        'durable_control_worker',
        'llm_worker',
        'embedding_worker',
        'catalog_apply_worker',
        'resource_dispatcher',
        'resource_fetch_worker',
      ].map((worker) => ({
        name: worker,
        ...uv(
          ingestionRoot,
          [
            '--project',
            ingestion,
            'python',
            '-m',
            `ingestion.workers.${worker}`,
          ],
          { INGESTION_STATE_ENSURE_SCHEMA: 'false' }
        ),
      })),
      {
        name: 'callback',
        ...uv(
          ingestionRoot,
          [
            '--project',
            ingestionApi,
            'python',
            '-m',
            'ingestion_api.producer_webhook_main',
          ],
          { INGESTION_PRODUCER_WEBHOOK_METRICS_PORT: port('callback') }
        ),
      },
      {
        name: 'scraping',
        ...uv(root('scraping'), ['web-scraping-api'], {
          UVICORN_HOST: '127.0.0.1',
          UVICORN_PORT: port('scraping'),
          WEB_SCRAPING_EXECUTION_MODE: 'inline',
          WEB_SCRAPING_CACHE_SWEEP_INTERVAL_SECONDS: '0',
        }),
      },
      {
        name: 'retrieval',
        ...uv(
          root('retrieval'),
          [
            'uvicorn',
            '--app-dir',
            'src',
            'mcp_server:create_app',
            '--factory',
            '--host',
            '127.0.0.1',
            '--port',
            port('retrieval'),
          ],
          {
            DOC_QUERY_RESPONSE_MODE: 'documents',
            RETRIEVAL_QUERY_EXPANSION_ENABLED: 'false',
            RETRIEVAL_MAX_RETRIES: '0',
            RERANKER_TYPE: 'none',
            HAYSTACK_CONTENT_TRACING_ENABLED: 'false',
            LANGFUSE_TRACING_ENABLED: 'false',
          }
        ),
      },
    ],
  }
}
