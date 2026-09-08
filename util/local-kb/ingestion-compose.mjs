import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

// These images were published from this exact provider revision. Source mounts
// must match their installed dependencies; a different revision needs new pins.
export const ingestionImageRevision = '69fa7f9200fc17bdb30b9cd792ea4d0e0a907012'
const imageRoot = 'cr.gitlab.uzh.ch/ai-infrastructure/services/data-ingestion'
const apiImage = `${imageRoot}/ingestion-api@sha256:b08d8407bee77a403eb344dcf2e7ebde3d6256844294256ff9ca88b4f148e762`
const workerImage = `${imageRoot}/ingestion-worker@sha256:d89004b91d6f97aed23aa143c44d08f91583b01b3039961ba11e80c5416368cf`

// A Compose fragment for the provider, not a standalone deployment. The
// managed checkout supplies Postgres, Hatchet and an isolated default network.
// Setup must create the private local-only environment and registry first.
export function renderIngestionCompose(config) {
  validateIsolatedConfig(config)
  const provider = config.providers.ingestion
  if (provider.revision !== ingestionImageRevision) {
    throw new Error(
      'Ingestion source does not match the pinned runtime images.'
    )
  }
  const generated = join(config.project.runtimeCheckoutPath, '.local-kb')
  // Compose interpolates dollar signs even in JSON string values.
  if ([generated, provider.sourcePath].some((path) => /[$\r\n]/.test(path))) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const bind = (source, target) => ({
    type: 'bind',
    source,
    target,
    read_only: true,
    bind: { create_host_path: false },
  })
  const service = (worker, command) => ({
    image: worker ? workerImage : apiImage,
    working_dir: '/app',
    user: '10001:10001',
    init: true,
    restart: 'no',
    cpus: 1,
    mem_limit: worker ? '1g' : '512m',
    pids_limit: 256,
    read_only: true,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    networks: ['default'],
    environment: {
      PYTHON_DOTENV_DISABLED: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      INGESTION_STATE_ENSURE_SCHEMA: 'false',
      INGESTION_PRODUCER_REGISTRY_DIR: '/etc/ingestion/producer-registry',
      ...(worker
        ? { INGESTION_CONFIG_DIR: '/etc/ingestion/project-configs' }
        : {}),
    },
    env_file: [{ path: join(generated, 'ingestion.env'), required: true }],
    volumes: [
      bind(
        join(provider.sourcePath, 'modules/ingestion-shared/src'),
        '/app/modules/ingestion-shared/src'
      ),
      bind(
        join(
          provider.sourcePath,
          worker ? 'modules/ingestion/src' : 'modules/ingestion-api/src'
        ),
        worker ? '/app/modules/ingestion/src' : '/app/modules/ingestion-api/src'
      ),
      bind(
        join(generated, 'producer-registry'),
        '/etc/ingestion/producer-registry'
      ),
      ...(worker
        ? [
            bind(
              join(generated, 'project-configs'),
              '/etc/ingestion/project-configs'
            ),
          ]
        : []),
    ],
    tmpfs: ['/tmp:rw,nosuid,nodev,size=268435456,mode=1777'],
    command,
  })
  const workers = [
    'cpu_worker',
    'db_worker',
    'durable_control_worker',
    'llm_worker',
    'embedding_worker',
    'catalog_apply_worker',
    'resource_dispatcher',
    'resource_fetch_worker',
  ]
  return {
    services: {
      'ingestion-setup': {
        ...service(false, ['python', '-m', 'ingestion_api.migrations']),
        profiles: ['local-kb-setup'],
      },
      'ingestion-api': service(false, [
        'uvicorn',
        'ingestion_api.app:create_app',
        '--factory',
        '--host',
        '0.0.0.0',
        '--port',
        '8000',
      ]),
      'ingestion-callback': service(false, [
        'python',
        '-m',
        'ingestion_api.producer_webhook_main',
      ]),
      ...Object.fromEntries(
        workers.map((name) => [
          `ingestion-${name.replaceAll('_', '-')}`,
          service(true, ['python', '-m', `ingestion.workers.${name}`]),
        ])
      ),
    },
  }
}
