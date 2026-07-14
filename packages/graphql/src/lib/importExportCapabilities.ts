import { createHmac, timingSafeEqual } from 'node:crypto'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from './importExportPackageConfig.js'

export const IMPORT_EXPORT_CAPABILITY_VERSION = 1
export const IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS = 15 * 60 * 1000
export const IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS = 5 * 1000
export const IMPORT_EXPORT_PACKAGE_CONTAINER = 'klicker-import-export'

export const ImportExportCapabilityPurpose = {
  IMPORT_UPLOAD: 'IMPORT_UPLOAD',
  LOCAL_ARTIFACT_DOWNLOAD: 'LOCAL_ARTIFACT_DOWNLOAD',
} as const

export type ImportExportCapabilityPurpose =
  (typeof ImportExportCapabilityPurpose)[keyof typeof ImportExportCapabilityPurpose]
export type ImportExportArtifactDirection = 'IMPORT' | 'EXPORT'

export type ImportUploadCapabilityPayload = Readonly<{
  v: typeof IMPORT_EXPORT_CAPABILITY_VERSION
  purpose: typeof ImportExportCapabilityPurpose.IMPORT_UPLOAD
  userId: string
  artifactId: string
  bytes: number
  issuedAt: number
  expiresAt: number
}>

export type LocalArtifactDownloadCapabilityPayload = Readonly<{
  v: typeof IMPORT_EXPORT_CAPABILITY_VERSION
  purpose: typeof ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD
  userId: string
  artifactId: string
  issuedAt: number
  expiresAt: number
}>

export type ImportExportArtifactStorageTarget = Readonly<{
  storageContainer: typeof IMPORT_EXPORT_PACKAGE_CONTAINER
  storageBlob: string
}>

const CAPABILITY_SIGNING_DOMAIN = 'klicker-element-package-capability'
const MAX_ENCODED_PAYLOAD_LENGTH = 2048
const MAX_ENCODED_SIGNATURE_LENGTH = 128
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const IMPORT_UPLOAD_KEYS = [
  'v',
  'purpose',
  'userId',
  'artifactId',
  'bytes',
  'issuedAt',
  'expiresAt',
] as const
const LOCAL_DOWNLOAD_KEYS = [
  'v',
  'purpose',
  'userId',
  'artifactId',
  'issuedAt',
  'expiresAt',
] as const

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value)
}

export function isCanonicalImportExportArtifactId(
  value: unknown
): value is string {
  return isCanonicalUuid(value)
}

function isValidSecret(secret: unknown): secret is string {
  return typeof secret === 'string' && secret.length > 0
}

function isValidTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function areValidCapabilityTimes(issuedAt: unknown, expiresAt: unknown) {
  return (
    isValidTimestamp(issuedAt) &&
    isValidTimestamp(expiresAt) &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS
  )
}

function isValidUploadBytes(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) > 0 &&
    Number(value) <= MAX_IMPORT_EXPORT_PACKAGE_BYTES
  )
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
) {
  const keys = Object.keys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index])
  )
}

function canonicalizeImportUploadPayload(
  value: unknown
): ImportUploadCapabilityPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>
  if (!hasExactKeys(payload, IMPORT_UPLOAD_KEYS)) return null
  if (
    payload.v !== IMPORT_EXPORT_CAPABILITY_VERSION ||
    payload.purpose !== ImportExportCapabilityPurpose.IMPORT_UPLOAD ||
    !isCanonicalUuid(payload.userId) ||
    !isCanonicalUuid(payload.artifactId) ||
    !isValidUploadBytes(payload.bytes) ||
    !areValidCapabilityTimes(payload.issuedAt, payload.expiresAt)
  ) {
    return null
  }

  return {
    v: IMPORT_EXPORT_CAPABILITY_VERSION,
    purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
    userId: payload.userId,
    artifactId: payload.artifactId,
    bytes: payload.bytes,
    issuedAt: payload.issuedAt as number,
    expiresAt: payload.expiresAt as number,
  }
}

function canonicalizeLocalDownloadPayload(
  value: unknown
): LocalArtifactDownloadCapabilityPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>
  if (!hasExactKeys(payload, LOCAL_DOWNLOAD_KEYS)) return null
  if (
    payload.v !== IMPORT_EXPORT_CAPABILITY_VERSION ||
    payload.purpose !== ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD ||
    !isCanonicalUuid(payload.userId) ||
    !isCanonicalUuid(payload.artifactId) ||
    !areValidCapabilityTimes(payload.issuedAt, payload.expiresAt)
  ) {
    return null
  }

  return {
    v: IMPORT_EXPORT_CAPABILITY_VERSION,
    purpose: ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD,
    userId: payload.userId,
    artifactId: payload.artifactId,
    issuedAt: payload.issuedAt as number,
    expiresAt: payload.expiresAt as number,
  }
}

function decodeBase64UrlStrict(value: string, maxLength: number) {
  if (
    value.length === 0 ||
    value.length > maxLength ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return null
  }

  const decoded = Buffer.from(value, 'base64url')
  return decoded.toString('base64url') === value ? decoded : null
}

function computeCapabilitySignature(
  encodedPayload: string,
  purpose: ImportExportCapabilityPurpose,
  secret: string
) {
  return createHmac('sha256', secret)
    .update(`${CAPABILITY_SIGNING_DOMAIN}\0${purpose}\0${encodedPayload}`)
    .digest()
}

function signaturesMatch(encodedSignature: string, expected: Buffer) {
  const provided =
    decodeBase64UrlStrict(encodedSignature, MAX_ENCODED_SIGNATURE_LENGTH) ??
    Buffer.alloc(0)
  const fixedLengthProvided = Buffer.alloc(expected.length)
  provided.copy(
    fixedLengthProvided,
    0,
    0,
    Math.min(provided.length, expected.length)
  )

  // timingSafeEqual requires equal-length inputs. Always compare a fixed-size
  // buffer, then separately require that the provided signature had the exact
  // expected length.
  const equalContent = timingSafeEqual(fixedLengthProvided, expected)
  return provided.length === expected.length && equalContent
}

function signCapability(
  payload:
    | ImportUploadCapabilityPayload
    | LocalArtifactDownloadCapabilityPayload,
  secret: string
) {
  if (!isValidSecret(secret)) {
    throw new TypeError('Invalid import/export capability configuration.')
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )
  const signature = computeCapabilitySignature(
    encodedPayload,
    payload.purpose,
    secret
  ).toString('base64url')

  return `${encodedPayload}.${signature}`
}

function parseAndVerifyCapability<Payload>({
  token,
  purpose,
  secret,
  now,
  canonicalize,
}: {
  token: string
  purpose: ImportExportCapabilityPurpose
  secret: string
  now: number
  canonicalize: (value: unknown) => Payload | null
}) {
  try {
    if (
      typeof token !== 'string' ||
      !isValidSecret(secret) ||
      !isValidTimestamp(now)
    ) {
      return null
    }

    const firstSeparator = token.indexOf('.')
    if (
      firstSeparator <= 0 ||
      firstSeparator !== token.lastIndexOf('.') ||
      firstSeparator === token.length - 1
    ) {
      return null
    }

    const encodedPayload = token.slice(0, firstSeparator)
    const encodedSignature = token.slice(firstSeparator + 1)
    const payloadBuffer = decodeBase64UrlStrict(
      encodedPayload,
      MAX_ENCODED_PAYLOAD_LENGTH
    )
    if (!payloadBuffer) return null

    const expectedSignature = computeCapabilitySignature(
      encodedPayload,
      purpose,
      secret
    )
    if (!signaturesMatch(encodedSignature, expectedSignature)) return null

    const serializedPayload = UTF8_DECODER.decode(payloadBuffer)
    const payload = canonicalize(JSON.parse(serializedPayload) as unknown)
    if (!payload || JSON.stringify(payload) !== serializedPayload) return null

    const times = payload as unknown as { issuedAt: number; expiresAt: number }
    if (
      times.issuedAt > now + IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS ||
      times.expiresAt < now - IMPORT_EXPORT_CAPABILITY_CLOCK_SKEW_MS
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function capabilityTimes({
  issuedAt = Date.now(),
  expiresAt = issuedAt + IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS,
}: {
  issuedAt?: number
  expiresAt?: number
}) {
  if (!areValidCapabilityTimes(issuedAt, expiresAt)) {
    throw new TypeError('Invalid import/export capability validity period.')
  }

  return { issuedAt, expiresAt }
}

export function createImportUploadCapability({
  secret,
  userId,
  artifactId,
  bytes,
  issuedAt,
  expiresAt,
}: {
  secret: string
  userId: string
  artifactId: string
  bytes: number
  issuedAt?: number
  expiresAt?: number
}) {
  const times = capabilityTimes({ issuedAt, expiresAt })
  const payload = canonicalizeImportUploadPayload({
    v: IMPORT_EXPORT_CAPABILITY_VERSION,
    purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
    userId,
    artifactId,
    bytes,
    ...times,
  })
  if (!payload) {
    throw new TypeError('Invalid import upload capability identity.')
  }

  return signCapability(payload, secret)
}

export function verifyImportUploadCapability({
  token,
  secret,
  userId,
  artifactId,
  bytes,
  now = Date.now(),
}: {
  token: string
  secret: string
  userId: string
  artifactId: string
  bytes: number
  now?: number
}) {
  const payload = parseAndVerifyCapability({
    token,
    purpose: ImportExportCapabilityPurpose.IMPORT_UPLOAD,
    secret,
    now,
    canonicalize: canonicalizeImportUploadPayload,
  })

  return payload?.userId === userId &&
    payload.artifactId === artifactId &&
    payload.bytes === bytes
    ? payload
    : null
}

export function createLocalArtifactDownloadCapability({
  secret,
  userId,
  artifactId,
  issuedAt,
  expiresAt,
}: {
  secret: string
  userId: string
  artifactId: string
  issuedAt?: number
  expiresAt?: number
}) {
  const times = capabilityTimes({ issuedAt, expiresAt })
  const payload = canonicalizeLocalDownloadPayload({
    v: IMPORT_EXPORT_CAPABILITY_VERSION,
    purpose: ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD,
    userId,
    artifactId,
    ...times,
  })
  if (!payload) {
    throw new TypeError('Invalid local artifact download capability identity.')
  }

  return signCapability(payload, secret)
}

export function verifyLocalArtifactDownloadCapability({
  token,
  secret,
  userId,
  artifactId,
  now = Date.now(),
}: {
  token: string
  secret: string
  userId: string
  artifactId: string
  now?: number
}) {
  const payload = parseAndVerifyCapability({
    token,
    purpose: ImportExportCapabilityPurpose.LOCAL_ARTIFACT_DOWNLOAD,
    secret,
    now,
    canonicalize: canonicalizeLocalDownloadPayload,
  })

  return payload?.userId === userId && payload.artifactId === artifactId
    ? payload
    : null
}

function artifactStoragePrefix(direction: ImportExportArtifactDirection) {
  if (direction === 'IMPORT') return 'imports'
  if (direction === 'EXPORT') return 'exports'
  return null
}

export function createImportExportArtifactStorageTarget({
  direction,
  ownerId,
  artifactId,
}: {
  direction: ImportExportArtifactDirection
  ownerId: string
  artifactId: string
}): ImportExportArtifactStorageTarget {
  const prefix = artifactStoragePrefix(direction)
  if (!prefix || !isCanonicalUuid(ownerId) || !isCanonicalUuid(artifactId)) {
    throw new TypeError('Invalid import/export artifact target identity.')
  }

  return {
    storageContainer: IMPORT_EXPORT_PACKAGE_CONTAINER,
    storageBlob: `${prefix}/${ownerId}/${artifactId}.zip`,
  }
}

export function isCanonicalImportExportArtifactStorageTarget({
  storageContainer,
  storageBlob,
  direction,
  ownerId,
  artifactId,
}: {
  storageContainer: unknown
  storageBlob: unknown
  direction: unknown
  ownerId: unknown
  artifactId: unknown
}) {
  if (
    storageContainer !== IMPORT_EXPORT_PACKAGE_CONTAINER ||
    typeof storageBlob !== 'string' ||
    typeof direction !== 'string' ||
    !isCanonicalUuid(ownerId) ||
    !isCanonicalUuid(artifactId) ||
    storageBlob.includes('\\') ||
    storageBlob.includes('%') ||
    storageBlob.includes('?') ||
    storageBlob.includes('#') ||
    storageBlob.includes('\0')
  ) {
    return false
  }

  const segments = storageBlob.split('/')
  if (
    segments.length !== 3 ||
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..'
    )
  ) {
    return false
  }

  try {
    const expected = createImportExportArtifactStorageTarget({
      direction: direction as ImportExportArtifactDirection,
      ownerId,
      artifactId,
    })
    return expected.storageBlob === storageBlob
  } catch {
    return false
  }
}
