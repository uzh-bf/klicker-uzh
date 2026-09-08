import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

export const retrievalImageRevision = '80313c4fb842bf7c9a82e0b444d207db5fcf900d'

export function renderRetrievalCompose(config) {
  validateIsolatedConfig(config)
  const provider = config.providers.retrieval
  if (provider.revision !== retrievalImageRevision) {
    throw new Error('Retrieval source does not match the pinned runtime image.')
  }
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  if ([directory, provider.sourcePath].some((path) => /[$\r\n]/.test(path))) {
    throw new Error('Compose paths must not contain interpolation or newlines.')
  }
  const bind = (source, target) => ({
    type: 'bind',
    source,
    target,
    read_only: true,
    bind: { create_host_path: false },
  })
  return {
    services: {
      'doc-query': {
        image:
          'cr.gitlab.uzh.ch/ai-infrastructure/mcp/mcp-doc-query@sha256:f8e26aa50383d16d17dbaa4d5f5f8449eb9fe8b8592efffdd28729c56d630f1a',
        platform: 'linux/arm64',
        // Real retrieval needs the separately supplied embedding capability.
        // Credential-free infrastructure startup must not activate this service.
        profiles: ['local-kb-ai'],
        working_dir: '/app',
        user: '10001:10001',
        init: true,
        restart: 'no',
        cpus: 1,
        mem_limit: '2g',
        pids_limit: 256,
        read_only: true,
        cap_drop: ['ALL'],
        security_opt: ['no-new-privileges:true'],
        networks: ['default'],
        tmpfs: ['/tmp:rw,nosuid,nodev,size=268435456,mode=1777'],
        command: [
          'uvicorn',
          '--app-dir',
          '/app/local-src',
          'mcp_server:create_app',
          '--factory',
          '--host',
          '0.0.0.0',
          '--port',
          '1417',
        ],
        env_file: [{ path: join(directory, 'doc-query.env'), required: true }],
        environment: {
          PYTHON_DOTENV_DISABLED: '1',
          PYTHONDONTWRITEBYTECODE: '1',
          MILVUS_URI: 'http://milvus:19530',
          DOC_QUERY_TOOL_CONFIG_DIR: '/etc/doc-query/tools',
          DOC_QUERY_TOOL_CONFIG_REQUIRED: 'true',
          DOC_QUERY_RESPONSE_MODE: 'documents',
          RETRIEVAL_QUERY_EXPANSION_ENABLED: 'false',
          RETRIEVAL_MAX_RETRIES: '0',
          RERANKER_TYPE: 'none',
          HAYSTACK_CONTENT_TRACING_ENABLED: 'false',
          LANGFUSE_TRACING_ENABLED: 'false',
        },
        volumes: [
          bind(join(provider.sourcePath, 'src'), '/app/local-src'),
          bind(join(directory, 'doc-query-tools'), '/etc/doc-query/tools'),
        ],
        depends_on: { milvus: { condition: 'service_healthy' } },
      },
    },
  }
}
