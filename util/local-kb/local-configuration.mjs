import { resolveProviderBindings } from './isolated-config.mjs'

// Pure local configuration generation. The caller supplies freshly generated
// credentials during exclusive setup; never pass this result to plan output.
export const localRetrievalScope = {
  kid: 'local-kb',
  issuer: 'klicker-local',
  audience: 'doc-query-local',
}

export function renderLocalRetrievalConfiguration(publicKey, collection) {
  if (
    publicKey?.type !== 'public' ||
    publicKey.asymmetricKeyType !== 'ec' ||
    publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new Error('Local retrieval requires an ES256 public key.')
  }
  if (typeof collection !== 'string' || !/^[a-z][a-z0-9_]*$/.test(collection)) {
    throw new Error('Local retrieval requires an explicit collection identity.')
  }
  return {
    version: 3,
    tool: {
      name: 'doc_query',
      description: 'Retrieve material from the authorized knowledge bases.',
    },
    retrieval: { collection },
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

// Provider launchers own their backing services and credentials. This result
// contains only the private consumer inputs they accept, never their manifests.
export function renderProviderLocalConfiguration(credentials, input) {
  const bindings = resolveProviderBindings(
    input?.ports,
    input?.instance,
    input?.retainedEndpointOrigins ?? []
  )
  const { containerBases: container, hostBases: host, ports } = bindings
  const generated = renderLocalConfiguration(credentials)
  const { postgres, hatchet, blob, klicker, ingestion } = generated.environment
  const state = {
    INGESTION_STATE_BACKEND: 'postgres',
    INGESTION_STATE_DSN:
      'postgresql://hatchet:hatchet@pgvector-pg:5432/hatchet',
    INGESTION_STATE_SCHEMA: bindings.stateSchema,
    INGESTION_STATE_ENSURE_SCHEMA: 'false',
  }
  const api = {
    ...state,
    INGESTION_SECRET_INGESTION_PRODUCER_KLICKER_API_KEY: credentials.ingestion,
    INGESTION_SECRET_KLICKER_SOURCE_GATEWAY_CLIENT_SOURCE_GATEWAY_KEY:
      credentials.gateway,
    INGESTION_SECRET_INGESTION_WEBHOOK_KLICKER_HMAC_KEY: credentials.webhook,
    INGESTION_METRICS_BEARER_TOKEN: credentials.metrics,
  }
  // The provider's isolated Azurite uses its documented public development
  // account. It is distinct from Klicker's source-upload account and storage.
  const artifactConnection =
    'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;' +
    'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' + // gitleaks:allow -- Azurite's documented public development account key.
    'BlobEndpoint=http://azurite:10000/devstoreaccount1;'
  const environment = {
    postgres,
    hatchet,
    blob,
    klicker: {
      ...klicker,
      KB_INGESTION_API_URL: container.ingestion,
      KB_SOURCE_GATEWAY_URL: container.backend,
    },
    'ingestion-api': api,
    'ingestion-worker': {
      ...ingestion,
      ...api,
      WEB_SCRAPING_BASE_URL: container.scraping,
      DOC_PROCESSING_BASE_URL: container.docProcessing,
      OPENAI_BASE_URL: container.model,
      OPENAI_API_KEY: 'local-kb-no-upstream',
      MILVUS_URI: container.milvus,
      INGESTION_ALLOWED_MILVUS_TARGETS: `default:${bindings.collection}`,
      AZURE_STORAGE_CONNECTION_STRING: artifactConnection,
    },
  }
  return {
    environment,
    retrievalEnvironment: {
      KLICKER_LOCAL_RETRIEVAL_MILVUS_URI: host.milvus,
      KLICKER_LOCAL_RETRIEVAL_MILVUS_COLLECTION_NAME: bindings.collection,
      KLICKER_LOCAL_RETRIEVAL_OPENAI_BASE_URL: host.model,
      KLICKER_LOCAL_RETRIEVAL_OPENAI_API_KEY: 'local-kb-no-upstream',
    },
    scrapingApiKey: credentials.scraping,
    docProcessing: {
      backing: {
        kind: 'isolated',
        postgres_port: ports.docProcessing.postgres,
        dashboard_port: ports.docProcessing.hatchetHttp,
        grpc_port: ports.docProcessing.hatchetGrpc,
      },
      env: {
        UVICORN_HOST: '127.0.0.1',
        UVICORN_PORT: String(ports.docProcessing.api),
        DOC_PROCESSING_API_KEY: credentials.documentProcessing,
      },
    },
    project: {
      ...generated.project,
      vector_store: {
        type: 'milvus',
        collection_name: bindings.collection,
        milvus: { uri: container.milvus, db_name: 'default' },
      },
    },
    databaseInitialization: generated.databaseInitialization,
    producer: {
      ...generated.producer,
      source_gateway: {
        ...generated.producer.source_gateway,
        allowed_origins: [container.backend],
      },
      callback: {
        ...generated.producer.callback,
        url: `${container.backend}/api/webhooks/kb-ingestion`,
      },
    },
  }
}

export const localCredentialNames = [
  'database',
  'klickerDatabase',
  'ingestion',
  'gateway',
  'webhook',
  'metrics',
  'scraping',
  'documentProcessing',
  'blob',
]

function renderLocalConfiguration(credentials) {
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
      KLICKER_DATABASE_PASSWORD: credentials.klickerDatabase,
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
      DATABASE_URL: `postgresql://klicker_test:${credentials.klickerDatabase}@postgres:5432/klicker_test`,
      SHADOW_DATABASE_URL: `postgresql://klicker_test:${credentials.klickerDatabase}@postgres:5432/klicker_test_shadow`,
      REDIS_HOST: 'redis_exec',
      REDIS_PORT: '6379',
      REDIS_CACHE_HOST: 'redis_cache',
      REDIS_CACHE_PORT: '6379',
      REDIS_ASSESSMENT_HOST: 'redis_assessment',
      REDIS_ASSESSMENT_PORT: '6379',
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
    // The official entrypoint runs this only on a fresh volume. The guarded
    // Prisma and seed commands require this non-privileged disposable identity.
    // psql reads the password from its environment; the SQL file contains none.
    databaseInitialization: [
      '\\set ON_ERROR_STOP on',
      ...['hatchet'].map((name) => `CREATE DATABASE ${name} OWNER local_kb;`),
      '\\getenv klicker_database_password KLICKER_DATABASE_PASSWORD',
      "CREATE ROLE klicker_test WITH LOGIN PASSWORD :'klicker_database_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;",
      ...['klicker_test', 'klicker_test_shadow'].flatMap((name) => [
        `CREATE DATABASE ${name} OWNER klicker_test;`,
        `COMMENT ON DATABASE ${name} IS 'klicker-disposable-test-v1';`,
      ]),
      '',
    ].join('\n'),
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
