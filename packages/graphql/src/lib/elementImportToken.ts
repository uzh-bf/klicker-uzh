import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from './importExportErrors.js'
import { getImportExportTokenSecret } from './importExportTokenSecret.js'
import { createStrictSignedCanonicalPayloadCodec } from './strictSignedCanonicalPayload.js'

export const ELEMENT_IMPORT_TOKEN_VERSION = 1
export const ELEMENT_IMPORT_TOKEN_PURPOSE = 'element-import'

export type ElementImportTokenPayload = Readonly<{
  v: typeof ELEMENT_IMPORT_TOKEN_VERSION
  purpose: typeof ELEMENT_IMPORT_TOKEN_PURPOSE
  userId: string
  artifactId: string
  packageHash: string
  expiresAt: number
  jti: string
}>

export type ElementImportTokenIdentity = Omit<
  ElementImportTokenPayload,
  'v' | 'purpose'
>

const TOKEN_SIGNING_DOMAIN = 'klicker-element-import-token'
const MAX_ENCODED_PAYLOAD_LENGTH = 2048
const MAX_ENCODED_SIGNATURE_LENGTH = 128
const MAX_TOKEN_LENGTH =
  MAX_ENCODED_PAYLOAD_LENGTH + MAX_ENCODED_SIGNATURE_LENGTH + 1
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const TOKEN_KEYS = [
  'v',
  'purpose',
  'userId',
  'artifactId',
  'packageHash',
  'expiresAt',
  'jti',
] as const

function invalidToken(cause?: unknown) {
  return new ImportExportDomainError(ImportExportErrorCode.TOKEN_INVALID, cause)
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

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value)
}

function canonicalizePayload(value: unknown): ElementImportTokenPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>
  if (!hasExactKeys(payload, TOKEN_KEYS)) return null
  if (
    payload.v !== ELEMENT_IMPORT_TOKEN_VERSION ||
    payload.purpose !== ELEMENT_IMPORT_TOKEN_PURPOSE ||
    !isCanonicalUuid(payload.userId) ||
    !isCanonicalUuid(payload.artifactId) ||
    typeof payload.packageHash !== 'string' ||
    !SHA256_PATTERN.test(payload.packageHash) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    Number(payload.expiresAt) <= 0 ||
    !isCanonicalUuid(payload.jti)
  ) {
    return null
  }

  return {
    v: ELEMENT_IMPORT_TOKEN_VERSION,
    purpose: ELEMENT_IMPORT_TOKEN_PURPOSE,
    userId: payload.userId,
    artifactId: payload.artifactId,
    packageHash: payload.packageHash,
    expiresAt: payload.expiresAt as number,
    jti: payload.jti,
  }
}

const TOKEN_CODEC = createStrictSignedCanonicalPayloadCodec({
  signingContext: [
    TOKEN_SIGNING_DOMAIN,
    ELEMENT_IMPORT_TOKEN_VERSION,
    ELEMENT_IMPORT_TOKEN_PURPOSE,
  ],
  maxEncodedPayloadLength: MAX_ENCODED_PAYLOAD_LENGTH,
  maxEncodedSignatureLength: MAX_ENCODED_SIGNATURE_LENGTH,
  maxTokenLength: MAX_TOKEN_LENGTH,
  canonicalize: canonicalizePayload,
})

export function createElementImportToken(
  identity: ElementImportTokenIdentity
): string {
  const payload = canonicalizePayload({
    v: ELEMENT_IMPORT_TOKEN_VERSION,
    purpose: ELEMENT_IMPORT_TOKEN_PURPOSE,
    userId: identity.userId,
    artifactId: identity.artifactId,
    packageHash: identity.packageHash,
    expiresAt: identity.expiresAt,
    jti: identity.jti,
  })
  if (!payload) {
    throw new TypeError('Invalid element import token identity.')
  }

  const token = TOKEN_CODEC.sign(payload, getImportExportTokenSecret())
  if (!token) {
    throw new TypeError('Element import token payload is too large.')
  }
  return token
}

export function parseElementImportTokenForOwner({
  token,
  userId,
}: {
  token: string
  userId: string
}): ElementImportTokenPayload {
  // Configuration failures are infrastructure errors, not evidence that a
  // caller supplied an invalid token. Resolve the secret outside the parsing
  // catch so the service boundary can map missing configuration correctly.
  const secret = getImportExportTokenSecret()

  try {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > MAX_TOKEN_LENGTH ||
      !isCanonicalUuid(userId)
    ) {
      throw invalidToken()
    }

    const payload = TOKEN_CODEC.parse(token, secret)
    if (!payload || payload.userId !== userId) {
      throw invalidToken()
    }

    return payload
  } catch (error) {
    if (
      error instanceof ImportExportDomainError &&
      error.code === ImportExportErrorCode.TOKEN_INVALID
    ) {
      throw error
    }
    throw invalidToken(error)
  }
}

export function assertElementImportTokenUnexpired(
  payload: ElementImportTokenPayload,
  now = Date.now()
) {
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new TypeError('Invalid element import token comparison time.')
  }
  if (payload.expiresAt <= now) {
    throw new ImportExportDomainError(ImportExportErrorCode.TOKEN_EXPIRED)
  }
}
