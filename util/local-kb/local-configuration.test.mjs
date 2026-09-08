import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import {
  localCredentialNames,
  renderLocalConfiguration,
  renderLocalRetrievalConfiguration,
} from './local-configuration.mjs'

const fixture = () =>
  Object.fromEntries(
    localCredentialNames.map((name, index) => [
      name,
      (index + 1).toString(16).padStart(64, '0'),
    ])
  )

test('retrieval requires signed KB scope and excludes inactive resources', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  const config = renderLocalRetrievalConfiguration(publicKey)
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

test('local clients and servers share the same purpose-specific credentials', () => {
  const { environment: env, producer } = renderLocalConfiguration(fixture())
  assert.equal(
    env.klicker.KB_INGESTION_API_KEY,
    env.ingestion.INGESTION_SECRET_INGESTION_PRODUCER_KLICKER_API_KEY
  )
  assert.equal(
    env.klicker.KB_SOURCE_GATEWAY_KEY,
    env.ingestion
      .INGESTION_SECRET_KLICKER_SOURCE_GATEWAY_CLIENT_SOURCE_GATEWAY_KEY
  )
  assert.equal(
    env.klicker.KB_WEBHOOK_SECRET,
    env.ingestion.INGESTION_SECRET_INGESTION_WEBHOOK_KLICKER_HMAC_KEY
  )
  assert.equal(
    env.ingestion.DOC_PROCESSING_API_KEY,
    env['doc-processing'].DOC_PROCESSING_API_KEY
  )
  assert.equal(
    env.scraping.WEB_SCRAPING_CRAWL4AI_API_TOKEN,
    env.crawl4ai.CRAWL4AI_API_TOKEN
  )
  assert.equal(
    env.ingestion.WEB_SCRAPING_API_KEY,
    env.scraping.WEB_SCRAPING_API_KEY
  )
  assert.equal(env.ingestion.WEB_SCRAPING_BASE_URL, 'http://scraping:8000')
  assert.equal(
    env.minio.MINIO_ROOT_PASSWORD,
    env.milvus.MINIO_SECRET_ACCESS_KEY
  )
  assert.equal(
    env.ingestion.INGESTION_ALLOWED_MILVUS_TARGETS,
    'default:klicker_course_materials_v1'
  )
  assert.equal(
    producer.callback.url,
    `${env.klicker.KB_SOURCE_GATEWAY_URL}/api/webhooks/kb-ingestion`
  )
  assert.deepEqual(producer.producer.allowed_projects, [
    env.klicker.KB_INGESTION_PROJECT_ID,
  ])
  assert.equal(
    env.blob.AZURITE_ACCOUNTS,
    `${env.klicker.BLOB_STORAGE_ACCOUNT_NAME}:${env.klicker.BLOB_STORAGE_ACCESS_KEY}`
  )
  const storage = Object.fromEntries(
    env.ingestion.AZURE_STORAGE_CONNECTION_STRING.split(';')
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=')
        return [entry.slice(0, separator), entry.slice(separator + 1)]
      })
  )
  assert.equal(storage.AccountName, env.klicker.BLOB_STORAGE_ACCOUNT_NAME)
  assert.equal(storage.AccountKey, env.klicker.BLOB_STORAGE_ACCESS_KEY)
  assert.equal(
    storage.BlobEndpoint,
    env.klicker.BLOB_STORAGE_INTERNAL_ACCOUNT_URL
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
  assert.equal(environment.ingestion.DOC_PROCESSING_COMPUTE, 'cpu')
  assert.equal(
    environment.ingestion.DOC_PROCESSING_PROCESSING_PROFILE,
    'default'
  )
  assert.equal(environment.ingestion.DOC_PROCESSING_PICTURE_DESCRIPTION, 'off')
})

test('the producer project writes real vectors and durable artifacts to the local stack', () => {
  const { project, producer, environment } = renderLocalConfiguration(fixture())
  assert.deepEqual(producer.producer.allowed_projects, [project.project_name])
  assert.equal(project.vector_store.type, 'milvus')
  assert.equal(
    project.vector_store.milvus.uri,
    environment.ingestion.MILVUS_URI
  )
  assert.equal(
    `${project.vector_store.milvus.db_name}:${project.vector_store.collection_name}`,
    environment.ingestion.INGESTION_ALLOWED_MILVUS_TARGETS
  )
  assert.equal(project.embedding.model, 'text-embedding-3-small')
  assert.equal(project.embedding.dimensions, 1536)
  assert.equal(project.artifacts.enabled, true)
  assert.equal(project.artifacts.backend, 'azure_blob')
  assert.equal(project.vector_store.dry_run, undefined)
})
