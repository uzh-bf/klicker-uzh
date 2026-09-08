// Pure local configuration generation. The caller supplies freshly generated
// credentials during exclusive setup; never pass this result to plan output.
export const localRetrievalScope = {
  kid: 'local-kb',
  issuer: 'klicker-local',
  audience: 'doc-query-local',
}

export function renderLocalRetrievalConfiguration(publicKey) {
  if (
    publicKey?.type !== 'public' ||
    publicKey.asymmetricKeyType !== 'ec' ||
    publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new Error('Local retrieval requires an ES256 public key.')
  }
  return {
    version: 3,
    tool: {
      name: 'doc_query',
      description: 'Retrieve material from the authorized knowledge bases.',
    },
    retrieval: { collection: 'klicker_course_materials_v1' },
    token_scope: {
      source: 'jwt_claim',
      header: 'X-Doc-Query-Scope-Token',
      claim: 'kb_id',
      filter_field: 'kb_id',
      required: true,
      verification: {
        issuer: localRetrievalScope.issuer,
        audience: localRetrievalScope.audience,
        algorithms: ['ES256'],
        keys: [
          {
            kid: localRetrievalScope.kid,
            pem: publicKey.export({ type: 'spki', format: 'pem' }),
          },
        ],
      },
    },
    filters: { static: { resource_active: true }, runtime_allowed: [] },
  }
}

export const localCredentialNames = [
  'database',
  'ingestion',
  'gateway',
  'webhook',
  'metrics',
  'scraping',
  'crawl4ai',
  'documentProcessing',
  'documentCallback',
  'objectStorage',
  'blob',
]

export function renderLocalConfiguration(credentials) {
  if (
    credentials === null ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials) ||
    Object.keys(credentials).length !== localCredentialNames.length ||
    localCredentialNames.some(
      (name) =>
        !Object.hasOwn(credentials, name) ||
        typeof credentials[name] !== 'string' ||
        !/^[a-f0-9]{64}$/.test(credentials[name])
    )
  ) {
    throw new Error(
      'Local setup requires one fresh hex credential per service purpose.'
    )
  }
  const database = (name) =>
    `postgresql://local_kb:${credentials.database}@postgres:5432/${name}`
  const project = 'klicker-course-materials'
  const backend = 'http://klicker:3000'
  const blobKey = Buffer.from(credentials.blob, 'hex').toString('base64')
  const environment = {
    postgres: {
      POSTGRES_USER: 'local_kb',
      POSTGRES_PASSWORD: credentials.database,
      POSTGRES_DB: 'klicker',
    },
    hatchet: {
      DATABASE_URL: `${database('hatchet')}?sslmode=disable`,
      SERVER_AUTH_COOKIE_DOMAIN: 'localhost',
      SERVER_AUTH_COOKIE_INSECURE: 't',
      SERVER_GRPC_BIND_ADDRESS: '0.0.0.0',
      SERVER_GRPC_INSECURE: 't',
      SERVER_GRPC_BROADCAST_ADDRESS: 'hatchet:7077',
      SERVER_GRPC_PORT: '7077',
      SERVER_URL: 'http://hatchet:8888',
      SERVER_AUTH_SET_EMAIL_VERIFIED: 't',
      SERVER_DEFAULT_ENGINE_VERSION: 'V1',
    },
    blob: { AZURITE_ACCOUNTS: `klickerdev:${blobKey}` },
    minio: {
      MINIO_ROOT_USER: 'local-kb',
      MINIO_ROOT_PASSWORD: credentials.objectStorage,
    },
    milvus: {
      MINIO_ACCESS_KEY_ID: 'local-kb',
      MINIO_SECRET_ACCESS_KEY: credentials.objectStorage,
    },
    scraping: {
      WEB_SCRAPING_API_KEY: credentials.scraping,
      WEB_SCRAPING_CRAWL4AI_API_TOKEN: credentials.crawl4ai,
    },
    crawl4ai: { CRAWL4AI_API_TOKEN: credentials.crawl4ai },
    'doc-processing': {
      DOC_PROCESSING_API_KEY: credentials.documentProcessing,
      DOC_PROCESSING_DATABASE_URL: database('document_processing'),
      DOC_PROCESSING_WEBHOOK_SECRET: credentials.documentCallback,
      DOC_PROCESSING_CALLBACK_URL_ALLOWED_HOSTS: 'ingestion-api',
    },
    ingestion: {
      INGESTION_STATE_BACKEND: 'postgres',
      INGESTION_STATE_DSN: database('ingestion'),
      INGESTION_STATE_SCHEMA: 'ingestion_state',
      INGESTION_SECRET_INGESTION_PRODUCER_KLICKER_API_KEY:
        credentials.ingestion,
      INGESTION_SECRET_KLICKER_SOURCE_GATEWAY_CLIENT_SOURCE_GATEWAY_KEY:
        credentials.gateway,
      INGESTION_SECRET_INGESTION_WEBHOOK_KLICKER_HMAC_KEY: credentials.webhook,
      INGESTION_METRICS_BEARER_TOKEN: credentials.metrics,
      WEB_SCRAPING_BASE_URL: 'http://scraping:8000',
      WEB_SCRAPING_API_KEY: credentials.scraping,
      DOC_PROCESSING_BASE_URL: 'http://doc-processing:8000',
      DOC_PROCESSING_API_KEY: credentials.documentProcessing,
      DOC_PROCESSING_COMPUTE: 'cpu',
      DOC_PROCESSING_PROCESSING_PROFILE: 'default',
      DOC_PROCESSING_PICTURE_DESCRIPTION: 'off',
      MILVUS_URI: 'http://milvus:19530',
      INGESTION_ALLOWED_MILVUS_TARGETS: 'default:klicker_course_materials_v1',
      AZURE_STORAGE_CONNECTION_STRING: `DefaultEndpointsProtocol=http;AccountName=klickerdev;AccountKey=${blobKey};BlobEndpoint=http://blob:10000/klickerdev;`,
    },
    klicker: {
      KB_INGESTION_API_URL: 'http://ingestion-api:8000',
      KB_INGESTION_API_KEY: credentials.ingestion,
      KB_INGESTION_PROJECT_ID: project,
      KB_SOURCE_GATEWAY_URL: backend,
      KB_SOURCE_GATEWAY_KEY: credentials.gateway,
      KB_WEBHOOK_SECRET: credentials.webhook,
      BLOB_STORAGE_ACCOUNT_NAME: 'klickerdev',
      BLOB_STORAGE_ACCESS_KEY: blobKey,
      BLOB_STORAGE_INTERNAL_ACCOUNT_URL: 'http://blob:10000/klickerdev',
    },
  }
  return {
    environment,
    project: {
      version: 1,
      project_name: project,
      vector_store: {
        type: 'milvus',
        collection_name: 'klicker_course_materials_v1',
        milvus: { uri: 'http://milvus:19530', db_name: 'default' },
      },
      embedding: { model: 'text-embedding-3-small', dimensions: 1536 },
      artifacts: {
        enabled: true,
        backend: 'azure_blob',
        azure_blob: { container: 'ingestion-artifacts' },
      },
    },
    // Runs only on the fresh Postgres volume. The official entrypoint creates
    // Klicker's database; these separate databases belong to its dependencies.
    databaseInitialization:
      ['hatchet', 'ingestion', 'document_processing']
        .map((name) => `CREATE DATABASE ${name} OWNER local_kb;`)
        .join('\n') + '\n',
    producer: {
      version: 1,
      producer: {
        id: 'klicker',
        enabled: true,
        api_contracts: ['knowledge-source/v1'],
        allowed_projects: [project],
        allowed_source_kinds: ['blob', 'url'],
      },
      auth: {
        type: 'static_key',
        credential_secret_ref: 'ingestion-producer-klicker',
      },
      source_gateway: {
        allowed_origins: [backend],
        credential_secret_ref: 'klicker-source-gateway-client',
      },
      callback: {
        url: `${backend}/api/webhooks/kb-ingestion`,
        signing_secret_ref: 'ingestion-webhook-klicker',
      },
      limits: {
        max_bytes: 52428800,
        allowed_mime_types: ['application/pdf', 'text/plain', 'text/html'],
      },
    },
  }
}
