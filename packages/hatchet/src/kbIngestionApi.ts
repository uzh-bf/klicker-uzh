import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import {
  isPublicIPv4Address,
  normalizePublicHttpUrl,
} from '@klicker-uzh/util/public-url'
import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'

const KB_INGESTION_PROJECT_ID = 'klicker-course-materials'
const KB_INGESTION_PRODUCER = 'klicker'
const KB_INGESTION_REQUEST_TIMEOUT_MS = 10_000
const KB_SOURCE_FETCH_TIMEOUT_MS = 30_000
const MAX_KB_SOURCE_BYTES = 25 * 1024 * 1024
const MAX_KB_SOURCE_REDIRECTS = 3
const SUPPORTED_INGESTION_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export type KBIngestionSource = {
  kind: 'blob' | 'url'
  url: string
  mimeType: string
  displayName: string
  contentSha256: string
  sizeBytes: number
}

export type KBOperationStatus =
  | 'accepted'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'superseded'

export type KBOperationStatusResponse = {
  operationId: string
  status: KBOperationStatus
  operation: 'create' | 'update' | 'delete'
  projectId: string
  producer: string
  externalResourceId: string
  resourceVersion: number
  expectedSha256: string | null
  observedSha256: string | null
  serving: {
    activeResourceVersion: number | null
    activeSha256: string | null
  }
  errorCode: string | null
  correlationId: string
  createdAt: string
  updatedAt: string
}

export type AcceptKBResourceInput = {
  resourceId: string
  kbId: string
  resourceVersion: number
  ingestionAttemptId: string
  source: KBIngestionSource
}

export type DeleteKBResourceInput = {
  resourceId: string
  kbId: string
  resourceVersion: number
  deletionAttemptId: string
}

export type KBIngestionApiClient = {
  acceptResource: (input: AcceptKBResourceInput) => Promise<string>
  deleteResource: (input: DeleteKBResourceInput) => Promise<string>
  getOperation: (operationId: string) => Promise<KBOperationStatusResponse>
}

export type KBSourcePreparationDependencies = {
  resolvePublicIPv4?: (hostname: string) => Promise<string>
  requestPinnedUrl?: (url: URL, address: string) => Promise<IncomingMessage>
}

export function getKBIngestionProjectId(
  env: NodeJS.ProcessEnv = process.env
): string {
  return env.KB_INGESTION_PROJECT_ID?.trim() || KB_INGESTION_PROJECT_ID
}

type KBIngestionFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, 'json' | 'ok' | 'status'>>

function requireEnvironmentVariable(
  env: NodeJS.ProcessEnv,
  name: string
): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`${name} must be configured`)
  }
  return value
}

function getOrigin(env: NodeJS.ProcessEnv, name: string): string {
  const rawValue = requireEnvironmentVariable(env, name)
  let value: URL
  try {
    value = new URL(rawValue)
  } catch {
    throw new Error(`${name} must be an HTTP(S) origin`)
  }
  if (
    (value.protocol !== 'http:' && value.protocol !== 'https:') ||
    value.username ||
    value.password ||
    value.pathname !== '/' ||
    value.search ||
    value.hash
  ) {
    throw new Error(`${name} must be an HTTP(S) origin`)
  }
  return value.origin
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...keys].sort()
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  )
}

function isNullableSha256(value: unknown): value is string | null {
  return (
    value === null || (typeof value === 'string' && SHA256_PATTERN.test(value))
  )
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
  )
}

function isAwareDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNullablePositiveSafeInteger(value: unknown): value is number | null {
  return value === null || isPositiveSafeInteger(value)
}

function parseAcceptedOperation(value: unknown): string {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !hasExactKeys(value as Record<string, unknown>, ['operation_id'])
  ) {
    throw new Error('Ingestion API returned an invalid response')
  }
  const operationId = (value as Record<string, unknown>).operation_id
  if (!isBoundedString(operationId, 255)) {
    throw new Error('Ingestion API returned an invalid response')
  }
  return operationId
}

function parseOperationStatus(value: unknown): KBOperationStatusResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Ingestion API returned an invalid response')
  }
  const operation = value as Record<string, unknown>
  if (
    !hasExactKeys(operation, [
      'operation_id',
      'status',
      'operation',
      'project_id',
      'producer',
      'external_resource_id',
      'resource_version',
      'expected_sha256',
      'observed_sha256',
      'serving',
      'error_code',
      'correlation_id',
      'created_at',
      'updated_at',
    ]) ||
    !isBoundedString(operation.operation_id, 255) ||
    typeof operation.status !== 'string' ||
    !['accepted', 'running', 'succeeded', 'failed', 'superseded'].includes(
      operation.status
    ) ||
    typeof operation.operation !== 'string' ||
    !['create', 'update', 'delete'].includes(operation.operation) ||
    !isBoundedString(operation.project_id, 255) ||
    !isBoundedString(operation.producer, 255) ||
    !isBoundedString(operation.external_resource_id, 512) ||
    !isPositiveSafeInteger(operation.resource_version) ||
    !isNullableSha256(operation.expected_sha256) ||
    !isNullableSha256(operation.observed_sha256) ||
    !operation.serving ||
    typeof operation.serving !== 'object' ||
    Array.isArray(operation.serving) ||
    !hasExactKeys(operation.serving as Record<string, unknown>, [
      'active_resource_version',
      'active_sha256',
    ]) ||
    !isNullablePositiveSafeInteger(
      (operation.serving as Record<string, unknown>).active_resource_version
    ) ||
    !isNullableSha256(
      (operation.serving as Record<string, unknown>).active_sha256
    ) ||
    (operation.error_code !== null &&
      !isBoundedString(operation.error_code, 128)) ||
    !isBoundedString(operation.correlation_id, 255) ||
    !isAwareDateTime(operation.created_at) ||
    !isAwareDateTime(operation.updated_at)
  ) {
    throw new Error('Ingestion API returned an invalid response')
  }

  const serving = operation.serving as Record<string, unknown>
  return {
    operationId: operation.operation_id,
    status: operation.status as KBOperationStatus,
    operation: operation.operation as KBOperationStatusResponse['operation'],
    projectId: operation.project_id,
    producer: operation.producer,
    externalResourceId: operation.external_resource_id,
    resourceVersion: operation.resource_version,
    expectedSha256: operation.expected_sha256,
    observedSha256: operation.observed_sha256,
    serving: {
      activeResourceVersion: serving.active_resource_version as number | null,
      activeSha256: serving.active_sha256 as string | null,
    },
    errorCode: operation.error_code as string | null,
    correlationId: operation.correlation_id,
    createdAt: operation.created_at,
    updatedAt: operation.updated_at,
  }
}

export function createKBIngestionApiClient({
  env = process.env,
  fetchRequest = fetch,
}: {
  env?: NodeJS.ProcessEnv
  fetchRequest?: KBIngestionFetch
} = {}): KBIngestionApiClient {
  const apiOrigin = getOrigin(env, 'KB_INGESTION_API_URL')
  const apiKey = requireEnvironmentVariable(env, 'KB_INGESTION_API_KEY')
  const projectId = getKBIngestionProjectId(env)

  async function request(
    path: string,
    init: RequestInit,
    expectedStatus: number
  ) {
    try {
      const response = await fetchRequest(new URL(path, apiOrigin), {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...init.headers,
        },
        signal: AbortSignal.timeout(KB_INGESTION_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok || response.status !== expectedStatus) {
        throw new Error('Ingestion API request failed')
      }
      return await response.json()
    } catch {
      throw new Error('Ingestion API request failed')
    }
  }

  return {
    async acceptResource(input) {
      const value = await request(
        '/v1/resources',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': input.ingestionAttemptId,
          },
          body: JSON.stringify({
            project_id: projectId,
            producer: KB_INGESTION_PRODUCER,
            external_resource_id: input.resourceId,
            resource_version: input.resourceVersion,
            scope: { kb_id: input.kbId },
            source: {
              kind: input.source.kind,
              url: input.source.url,
              mime_type: input.source.mimeType,
              display_name: input.source.displayName,
            },
            content_sha256: input.source.contentSha256,
          }),
        },
        202
      )
      return parseAcceptedOperation(value)
    },

    async deleteResource(input) {
      const value = await request(
        `/v1/resources/${encodeURIComponent(input.resourceId)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': input.deletionAttemptId,
          },
          body: JSON.stringify({
            project_id: projectId,
            producer: KB_INGESTION_PRODUCER,
            resource_version: input.resourceVersion,
            scope: { kb_id: input.kbId },
          }),
        },
        202
      )
      return parseAcceptedOperation(value)
    },

    async getOperation(operationId) {
      const value = await request(
        `/v1/operations/${encodeURIComponent(operationId)}`,
        { method: 'GET' },
        200
      )
      return parseOperationStatus(value)
    },
  }
}

async function sha256Stream(
  stream: AsyncIterable<unknown>,
  maxBytes: number
): Promise<{ contentSha256: string; sizeBytes: number }> {
  const hash = createHash('sha256')
  let sizeBytes = 0
  for await (const value of stream) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as never)
    sizeBytes += chunk.length
    if (sizeBytes > maxBytes) {
      throw new Error('KB ingestion source is too large')
    }
    hash.update(chunk)
  }
  if (sizeBytes === 0) {
    throw new Error('KB ingestion source is empty')
  }
  return { contentSha256: hash.digest('hex'), sizeBytes }
}

async function prepareBlobSource(
  input: Extract<IngestKBResourceInput, { type: 'BLOB' }>,
  env: NodeJS.ProcessEnv
): Promise<KBIngestionSource> {
  const accountName = requireEnvironmentVariable(
    env,
    'BLOB_STORAGE_ACCOUNT_NAME'
  )
  const accessKey = requireEnvironmentVariable(env, 'BLOB_STORAGE_ACCESS_KEY')
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const blobClient = new BlobServiceClient(
    getBlobStorageAccountUrl(
      accountName,
      env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? env.BLOB_STORAGE_ACCOUNT_URL
    ),
    credential
  )
    .getContainerClient(input.containerName)
    .getBlobClient(input.blobName)
  const response = await blobClient.download(0, undefined, {
    abortSignal: AbortSignal.timeout(KB_SOURCE_FETCH_TIMEOUT_MS),
  })
  const mimeType = response.contentType?.trim().toLowerCase()
  if (
    !response.readableStreamBody ||
    response.contentLength !== input.sizeBytes ||
    mimeType !== input.mimeType ||
    !SUPPORTED_INGESTION_MIME_TYPES.has(mimeType)
  ) {
    throw new Error('KB ingestion source is invalid')
  }
  const digest = await sha256Stream(
    response.readableStreamBody as AsyncIterable<unknown>,
    MAX_KB_SOURCE_BYTES
  )
  if (digest.sizeBytes !== input.sizeBytes) {
    throw new Error('KB ingestion source is invalid')
  }

  return buildKBIngestionSource(
    input,
    mimeType,
    digest.contentSha256,
    digest.sizeBytes,
    env
  )
}

export async function resolvePublicIPv4(hostname: string): Promise<string> {
  const addresses = await lookup(hostname, { all: true, family: 4 })
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIPv4Address(address))
  ) {
    throw new Error('KB ingestion source URL is invalid')
  }
  return addresses[0]!.address
}

function requestPinnedUrl(url: URL, address: string): Promise<IncomingMessage> {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    callback(null, address, 4)
  }

  return new Promise((resolve, reject) => {
    const sourceRequest = request(
      url,
      {
        headers: {
          Accept: [...SUPPORTED_INGESTION_MIME_TYPES].join(', '),
          Connection: 'close',
        },
        lookup: pinnedLookup,
        signal: AbortSignal.timeout(KB_SOURCE_FETCH_TIMEOUT_MS),
      },
      resolve
    )
    sourceRequest.on('error', reject)
    sourceRequest.end()
  })
}

async function preparePublicUrlSource(
  input: Extract<IngestKBResourceInput, { type: 'URL' }>,
  dependencies: KBSourcePreparationDependencies
): Promise<KBIngestionSource> {
  let currentUrl = new URL(normalizePublicHttpUrl(input.sourceUrl))
  for (
    let redirectCount = 0;
    redirectCount <= MAX_KB_SOURCE_REDIRECTS;
    redirectCount++
  ) {
    const address = await (dependencies.resolvePublicIPv4 ?? resolvePublicIPv4)(
      currentUrl.hostname
    )
    const response = await (dependencies.requestPinnedUrl ?? requestPinnedUrl)(
      currentUrl,
      address
    )
    if (
      response.statusCode &&
      [301, 302, 303, 307, 308].includes(response.statusCode)
    ) {
      const location = response.headers.location
      response.resume()
      if (!location || redirectCount === MAX_KB_SOURCE_REDIRECTS) {
        throw new Error('KB ingestion source redirect is invalid')
      }
      currentUrl = new URL(
        normalizePublicHttpUrl(new URL(location, currentUrl).toString())
      )
      continue
    }
    if (response.statusCode !== 200) {
      response.resume()
      throw new Error('KB ingestion source could not be fetched')
    }

    const rawMimeType = response.headers['content-type']
    const mimeType = (Array.isArray(rawMimeType) ? rawMimeType[0] : rawMimeType)
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase()
    if (!mimeType || !SUPPORTED_INGESTION_MIME_TYPES.has(mimeType)) {
      response.resume()
      throw new Error('KB ingestion source type is not supported')
    }
    const declaredSize = Number(response.headers['content-length'])
    if (
      response.headers['content-length'] !== undefined &&
      (!Number.isSafeInteger(declaredSize) ||
        declaredSize <= 0 ||
        declaredSize > MAX_KB_SOURCE_BYTES)
    ) {
      response.resume()
      throw new Error('KB ingestion source is too large')
    }

    const digest = await sha256Stream(response, MAX_KB_SOURCE_BYTES)
    return buildKBIngestionSource(
      input,
      mimeType,
      digest.contentSha256,
      digest.sizeBytes
    )
  }
  throw new Error('KB ingestion source redirect is invalid')
}

export async function prepareKBIngestionSource(
  input: IngestKBResourceInput,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: KBSourcePreparationDependencies = {}
): Promise<KBIngestionSource> {
  return input.type === 'BLOB'
    ? prepareBlobSource(input, env)
    : preparePublicUrlSource(input, dependencies)
}

export function buildKBIngestionSource(
  input: IngestKBResourceInput,
  mimeType: string,
  contentSha256: string,
  sizeBytes: number,
  env: NodeJS.ProcessEnv = process.env
): KBIngestionSource {
  if (
    !SUPPORTED_INGESTION_MIME_TYPES.has(mimeType) ||
    !SHA256_PATTERN.test(contentSha256) ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_KB_SOURCE_BYTES
  ) {
    throw new Error('KB ingestion source is invalid')
  }

  const url =
    input.type === 'BLOB'
      ? new URL(
          `/api/ingestion/resources/${input.resourceId}/versions/${input.resourceVersion}`,
          getOrigin(env, 'KB_SOURCE_GATEWAY_URL')
        ).toString()
      : normalizePublicHttpUrl(input.sourceUrl)

  return {
    kind: input.type === 'BLOB' ? 'blob' : 'url',
    url,
    mimeType,
    displayName: input.title,
    contentSha256,
    sizeBytes,
  }
}
