import { createHash } from 'node:crypto'
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

type StorageEnvironment = Readonly<Record<string, string | undefined>>
export type ChatMediaBackend = 'azure-blob' | 'legacy' | 'local' | 's3'
export type ChatMediaS3Reader = 'course-images' | 'video-frames'

export type ChatMediaS3Storage = Readonly<{
  accessKeyId: string
  bucket: string
  endpoint: string
  forcePathStyle: boolean
  region: string
  secretAccessKey: string
  sessionToken?: string
}>

const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const REGION = /^[a-z0-9-]{1,64}$/
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost'])
const MAX_CACHED_CLIENTS = 8
const clients = new Map<string, S3Client>()

function unavailable(): never {
  throw new Error('S3 media storage unavailable')
}

export function resolveChatMediaBackend(
  env: StorageEnvironment = process.env
): ChatMediaBackend {
  const value = env.CHAT_MEDIA_BACKEND?.trim()
  if (!value) return 'legacy'
  if (value === 'azure-blob' || value === 'local' || value === 's3')
    return value
  unavailable()
}

function endpointOrigin(rawEndpoint: string | undefined) {
  if (!rawEndpoint?.trim()) unavailable()
  let endpoint: URL
  try {
    endpoint = new URL(rawEndpoint.trim())
  } catch {
    unavailable()
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.pathname !== '/' && endpoint.pathname !== '')
  )
    unavailable()
  const loopback = LOOPBACK_HOSTS.has(endpoint.hostname)
  if (
    endpoint.protocol !== 'https:' &&
    !(endpoint.protocol === 'http:' && loopback)
  )
    unavailable()
  return endpoint.origin
}

function credential(value: string | undefined) {
  if (!value?.trim() || /[\r\n]/.test(value)) unavailable()
  return value
}

function pathStyle(value: string | undefined) {
  if (value === undefined || value === '' || value === 'true') return true
  if (value === 'false') return false
  unavailable()
}

export function resolveChatMediaS3Storage(
  env: StorageEnvironment,
  reader: ChatMediaS3Reader
): ChatMediaS3Storage | undefined {
  if (resolveChatMediaBackend(env) !== 's3') return undefined

  const courseImagesBucket = env.CHAT_MEDIA_S3_COURSE_IMAGES_BUCKET?.trim()
  const videoFramesBucket = env.CHAT_MEDIA_S3_VIDEO_FRAMES_BUCKET?.trim()
  if (
    !courseImagesBucket ||
    !videoFramesBucket ||
    !BUCKET.test(courseImagesBucket) ||
    !BUCKET.test(videoFramesBucket) ||
    courseImagesBucket === videoFramesBucket
  )
    unavailable()

  const region = env.CHAT_MEDIA_S3_REGION?.trim()
  if (!region || !REGION.test(region)) unavailable()
  const sessionToken = env.CHAT_MEDIA_S3_SESSION_TOKEN?.trim()

  return Object.freeze({
    accessKeyId: credential(env.CHAT_MEDIA_S3_ACCESS_KEY_ID),
    bucket: reader === 'course-images' ? courseImagesBucket : videoFramesBucket,
    endpoint: endpointOrigin(env.CHAT_MEDIA_S3_ENDPOINT),
    forcePathStyle: pathStyle(env.CHAT_MEDIA_S3_FORCE_PATH_STYLE),
    region,
    secretAccessKey: credential(env.CHAT_MEDIA_S3_SECRET_ACCESS_KEY),
    ...(sessionToken ? { sessionToken } : {}),
  })
}

function s3Client(storage: ChatMediaS3Storage) {
  const key = JSON.stringify([
    storage.endpoint,
    storage.region,
    storage.forcePathStyle,
    storage.accessKeyId,
    createHash('sha256').update(storage.secretAccessKey).digest('hex'),
    createHash('sha256')
      .update(storage.sessionToken ?? '')
      .digest('hex'),
  ])
  const cached = clients.get(key)
  if (cached) {
    clients.delete(key)
    clients.set(key, cached)
    return cached
  }

  const client = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
      ...(storage.sessionToken ? { sessionToken: storage.sessionToken } : {}),
    },
  })
  clients.set(key, client)
  while (clients.size > MAX_CACHED_CLIENTS) {
    const oldest = clients.keys().next().value
    if (!oldest) break
    clients.delete(oldest)
  }
  return client
}

/** Read one bounded, content-addressed object from its exact S3 version. */
export async function readChatMediaS3Object(
  storage: ChatMediaS3Storage,
  key: string,
  limit: number
): Promise<Buffer> {
  if (!key || key.length > 1024 || /[\r\n]/.test(key) || limit <= 0)
    unavailable()

  const client = s3Client(storage)
  const metadata = await client.send(
    new HeadObjectCommand({ Bucket: storage.bucket, Key: key })
  )
  const contentLength = metadata.ContentLength
  const etag = metadata.ETag
  if (
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > limit ||
    !etag
  )
    throw new Error('S3 media artifact exceeds size limit')

  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Range: `bytes=0-${contentLength - 1}`,
      IfMatch: etag,
    })
  )
  if (!response.Body) throw new Error('S3 media artifact download failed')
  const reader = response.Body.transformToWebStream().getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    if (
      response.ContentLength !== undefined &&
      (response.ContentLength !== contentLength ||
        response.ContentLength > limit)
    )
      throw new Error('S3 media artifact exceeds size limit')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit || size > contentLength)
        throw new Error('S3 media artifact exceeds size limit')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  if (size !== contentLength)
    throw new Error('S3 media artifact download failed')
  return Buffer.concat(chunks, size)
}

export function isChatMediaS3NotFound(error: unknown) {
  if (error === null || typeof error !== 'object') return false
  const candidate = error as {
    Code?: unknown
    code?: unknown
    name?: unknown
    $metadata?: { httpStatusCode?: unknown }
  }
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.Code === 'NoSuchKey' ||
    candidate.code === 'NoSuchKey' ||
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound'
  )
}
