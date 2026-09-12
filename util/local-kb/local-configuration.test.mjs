import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { validateDisposableDatabaseUrl } from '../../packages/prisma/src/disposableDatabase.ts'
import {
  localCredentialNames,
  renderLocalRetrievalConfiguration,
  renderProviderLocalConfiguration,
} from './local-configuration.mjs'

import { providerPorts } from './test-fixtures.mjs'

const renderLocalConfiguration = (credentials) =>
  renderProviderLocalConfiguration(credentials, {
    instance: 'kb-fixture',
    ports: providerPorts(),
  })

const fixture = () =>
  Object.fromEntries(
    localCredentialNames.map((name, index) => [
      name,
      (index + 1).toString(16).padStart(64, '0'),
    ])
  )

test('provider configuration separates backing ownership and agrees on retrieval identity', () => {
  const input = {
    instance: 'kb-fixture',
    ports: {
      klicker: { backend: 31000, model: 31001, blob: 31002 },
      ingestion: {
        api: 31003,
        dispatcher: 31004,
        hatchetHttp: 31005,
        hatchetGrpc: 31006,
        postgres: 31007,
        azurite: 31008,
        milvus: 31009,
        milvusHealth: 31010,
        milvusAttu: 31011,
      },
      docProcessing: {
        api: 31012,
        postgres: 31013,
        hatchetHttp: 31014,
        hatchetGrpc: 31015,
      },
      scraping: { api: 31016, crawl4ai: 31017, postgres: 31018 },
      retrieval: { api: 31019 },
    },
  }
  const result = renderProviderLocalConfiguration(fixture(), input)
  const { environment: env, project, retrievalEnvironment: reader } = result
  const worker = env['ingestion-worker']
  const api = env['ingestion-api']
  assert.equal(worker.INGESTION_STATE_DSN, api.INGESTION_STATE_DSN)
  assert.equal(new URL(worker.INGESTION_STATE_DSN).hostname, 'pgvector-pg')
  assert.notEqual(worker.INGESTION_STATE_DSN, env.hatchet.DATABASE_URL)
  assert.equal(
    worker.INGESTION_SECRET_INGESTION_PRODUCER_KLICKER_API_KEY,
    env.klicker.KB_INGESTION_API_KEY
  )
  assert.equal(worker.WEB_SCRAPING_API_KEY, result.scrapingApiKey)
  assert.equal(
    worker.DOC_PROCESSING_API_KEY,
    result.docProcessing.env.DOC_PROCESSING_API_KEY
  )
  assert.equal(result.docProcessing.env.DOC_PROCESSING_DATABASE_URL, undefined)
  assert.equal(result.docProcessing.env.HATCHET_CLIENT_TOKEN, undefined)
  assert.equal(result.docProcessing.backing.postgres_port, 31013)
  assert.equal(
    worker.WEB_SCRAPING_BASE_URL,
    'http://host.docker.internal:31016'
  )
  assert.equal(
    worker.DOC_PROCESSING_BASE_URL,
    'http://host.docker.internal:31012'
  )
  assert.equal(
    env.klicker.KB_INGESTION_API_URL,
    'http://host.docker.internal:31003'
  )
  assert.equal(worker.OPENAI_BASE_URL, 'http://host.docker.internal:31001/v1')
  assert.equal(
    env.klicker.KLICKER_LOCAL_KB_RETRIEVAL_URL,
    'http://host.docker.internal:31019/mcp'
  )
  assert.equal(
    reader.KLICKER_LOCAL_RETRIEVAL_OPENAI_BASE_URL,
    'http://127.0.0.1:31001/v1'
  )
  assert.equal(
    reader.KLICKER_LOCAL_RETRIEVAL_MILVUS_URI,
    'http://127.0.0.1:31009'
  )
  assert.equal(project.vector_store.milvus.uri, worker.MILVUS_URI)
  assert.equal(
    project.vector_store.collection_name,
    reader.KLICKER_LOCAL_RETRIEVAL_MILVUS_COLLECTION_NAME
  )
  assert.equal(
    worker.INGESTION_ALLOWED_MILVUS_TARGETS,
    `default:${project.vector_store.collection_name}`
  )
  assert.deepEqual(result.producer.source_gateway.allowed_origins, [
    env.klicker.KB_SOURCE_GATEWAY_URL,
  ])
  assert.equal(
    result.producer.callback.url,
    `${env.klicker.KB_SOURCE_GATEWAY_URL}/api/webhooks/kb-ingestion`
  )
  assert.equal(
    worker.AZURE_STORAGE_CONNECTION_STRING.includes(
      env.klicker.BLOB_STORAGE_ACCESS_KEY
    ),
    false
  )
  assert.equal(
    result.databaseInitialization.includes('CREATE DATABASE ingestion '),
    false
  )
  assert.equal(
    result.databaseInitialization.includes(
      'CREATE DATABASE document_processing '
    ),
    false
  )
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const tool = renderLocalRetrievalConfiguration(
    publicKey,
    project.vector_store.collection_name
  )
  assert.equal(
    tool.retrieval.collection,
    reader.KLICKER_LOCAL_RETRIEVAL_MILVUS_COLLECTION_NAME
  )
  assert.equal(tool.token_scope.required, true)
  assert.equal(tool.filters.static.resource_active, true)
  assert.throws(() =>
    renderLocalRetrievalConfiguration(publicKey, 'invalid\ncollection')
  )
})

test('generated application connections satisfy the existing disposable database guard', () => {
  const { environment, databaseInitialization } = renderLocalConfiguration(
    fixture()
  )
  for (const [key, database] of [
    ['DATABASE_URL', 'klicker_test'],
    ['SHADOW_DATABASE_URL', 'klicker_test_shadow'],
  ]) {
    const connection = environment.klicker[key]
    assert.equal(
      validateDisposableDatabaseUrl(connection, database),
      connection
    )
    assert.notEqual(
      new URL(connection).password,
      environment.postgres.POSTGRES_PASSWORD
    )
    assert.equal(
      new URL(connection).password,
      environment.postgres.KLICKER_DATABASE_PASSWORD
    )
  }
  assert.equal(
    databaseInitialization.includes(
      environment.postgres.KLICKER_DATABASE_PASSWORD
    ),
    false
  )
  assert.match(
    databaseInitialization,
    /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/
  )
})

test('retrieval requires signed KB scope and excludes inactive resources', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  const config = renderLocalRetrievalConfiguration(
    publicKey,
    'synthetic_collection'
  )
  assert.equal(config.version, 3)
  assert.equal(config.token_scope.required, true)
  assert.equal(config.token_scope.claim, 'kb_id')
  assert.equal(config.token_scope.filter_field, 'kb_id')
  assert.equal(config.token_scope.header, 'X-Doc-Query-Scope-Token')
  assert.deepEqual(config.filters, {
    static: { resource_active: true },
    runtime_allowed: [],
  })
  assert.equal(
    config.token_scope.verification.keys[0].pem,
    publicKey.export({ type: 'spki', format: 'pem' })
  )
  assert.throws(() => renderLocalRetrievalConfiguration(privateKey))
  assert.throws(() => renderLocalRetrievalConfiguration(undefined))
  assert.throws(() =>
    renderLocalRetrievalConfiguration(
      generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey
    )
  )
})

test('local configuration rejects incomplete or injectable credentials without exposing values', () => {
  const malformed = fixture()
  malformed.database = 'unsafe\nINJECTED=value'
  for (const input of [
    undefined,
    null,
    [],
    {},
    malformed,
    { ...fixture(), extra: 'value' },
  ]) {
    assert.throws(
      () => renderLocalConfiguration(input),
      (error) =>
        error instanceof Error && !error.message.includes(malformed.database)
    )
  }
  const inherited = Object.assign(
    Object.create({ database: fixture().database }),
    fixture()
  )
  delete inherited.database
  inherited.extra = 'value'
  assert.throws(() => renderLocalConfiguration(inherited))
})

test('local document extraction selects a CPU-compatible profile without picture model calls', () => {
  const { environment } = renderLocalConfiguration(fixture())
  assert.equal(environment['ingestion-worker'].DOC_PROCESSING_COMPUTE, 'cpu')
  assert.equal(
    environment['ingestion-worker'].DOC_PROCESSING_PROCESSING_PROFILE,
    'default'
  )
  assert.equal(
    environment['ingestion-worker'].DOC_PROCESSING_PICTURE_DESCRIPTION,
    'off'
  )
})

test('the producer project writes real vectors and durable artifacts to the local stack', () => {
  const { project, producer, environment } = renderLocalConfiguration(fixture())
  assert.deepEqual(producer.producer.allowed_projects, [project.project_name])
  assert.equal(project.vector_store.type, 'milvus')
  assert.equal(
    project.vector_store.milvus.uri,
    environment['ingestion-worker'].MILVUS_URI
  )
  assert.equal(
    `${project.vector_store.milvus.db_name}:${project.vector_store.collection_name}`,
    environment['ingestion-worker'].INGESTION_ALLOWED_MILVUS_TARGETS
  )
  assert.equal(project.embedding.model, 'text-embedding-3-small')
  assert.equal(project.embedding.dimensions, 1536)
  assert.equal(project.artifacts.enabled, true)
  assert.equal(project.artifacts.backend, 'azure_blob')
  assert.equal(project.vector_store.dry_run, undefined)
})
