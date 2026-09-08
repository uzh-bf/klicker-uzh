import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

export const docProcessingImageRevision =
  '7979ac6b95e4e407e439d49ba1bee4e6708bedb0'

export function renderDocProcessingCompose(config) {
  validateIsolatedConfig(config)
  const provider = config.providers.docProcessing
  if (provider.revision !== docProcessingImageRevision) {
    throw new Error(
      'Doc Processing source does not match the pinned runtime image.'
    )
  }
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  if ([directory, provider.sourcePath].some((path) => /[$\r\n]/.test(path))) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const service = (command) => ({
    image:
      'cr.gitlab.uzh.ch/ai-infrastructure/services/doc-processing@sha256:19b1105f496bca8d5d0ba2a66d557156b069df519f285c3ed888dc1b4a8bf5e8',
    platform: 'linux/arm64',
    working_dir: '/app',
    user: 'app',
    init: true,
    restart: 'no',
    cpus: 2,
    mem_limit: '4g',
    pids_limit: 512,
    read_only: true,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    networks: ['default'],
    tmpfs: ['/tmp:rw,nosuid,nodev,size=536870912,mode=1777'],
    command,
    env_file: [{ path: join(directory, 'doc-processing.env'), required: true }],
    environment: {
      PYTHON_DOTENV_DISABLED: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      DOC_PROCESSING_AUTO_INITIALIZE: '0',
      DOC_PROCESSING_DATA_DIR: '/app/data',
      DOC_PROCESSING_EXTRACT_BACKEND: 'local',
      DOC_PROCESSING_EXTRACT_ROOT: '/app/data/extracts',
      DOC_PROCESSING_DEFAULT_PICTURE_DESCRIPTION: 'off',
      HF_HOME: '/app/data/model-cache',
    },
    volumes: [
      'document-processing:/app/data',
      {
        type: 'bind',
        source: join(provider.sourcePath, 'src'),
        target: '/app/src',
        read_only: true,
        bind: { create_host_path: false },
      },
    ],
    depends_on: { postgres: { condition: 'service_healthy' } },
  })
  return {
    services: {
      'doc-processing-setup': {
        ...service(['python', '-m', 'doc_processing.setup']),
        profiles: ['local-kb-setup'],
      },
      'doc-processing': service([
        'uvicorn',
        'doc_processing.main:app',
        '--host',
        '0.0.0.0',
        '--port',
        '8000',
        '--workers',
        '1',
      ]),
      'doc-processing-worker': service(['doc-processing-hatchet-worker']),
      'doc-processing-callback': service(['doc-processing-callback-worker']),
    },
    volumes: {
      'document-processing': {
        name: config.mutableState.documentProcessing.volumeName,
      },
    },
  }
}
