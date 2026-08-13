import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import type {
  AcceptedCorrelatedResponseIdentity,
  CorrelatedResponseEventMessage,
} from './liveQuizResponseIdentity.js'
import { parseCorrelatedResponseInstanceInfo } from './liveQuizResponseMetadata.js'
import { validateStudentResponse } from './liveQuizResponseValidation.js'

const CORRELATED_OUTBOX_ENCRYPTION_CONTEXT =
  'klicker-live-quiz-correlated-outbox-v1'
const CORRELATED_OUTBOX_IV_LENGTH = 12
const CORRELATED_OUTBOX_AUTH_TAG_LENGTH = 16

function getOutboxEncryptionKey(secret: string) {
  return createHash('sha256')
    .update(CORRELATED_OUTBOX_ENCRYPTION_CONTEXT)
    .update('\0')
    .update(secret)
    .digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(record: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(record).sort()
  const expectedKeys = [...expected].sort()
  return (
    actual.length === expectedKeys.length &&
    actual.every((key, index) => key === expectedKeys[index])
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isAcceptedIdentity(
  value: unknown
): value is AcceptedCorrelatedResponseIdentity {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['id', 'kind']) ||
    !isNonEmptyString(value.id)
  ) {
    return false
  }

  return (
    value.kind === 'participant' ||
    value.kind === 'temporary' ||
    value.kind === 'anonymous'
  )
}

const INVALID_RESTRICTIONS = Symbol('invalid restrictions')

function parseRestrictions(value: string | undefined) {
  if (typeof value === 'undefined') return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    return INVALID_RESTRICTIONS
  }
}

function normalizeCorrelatedResponseEventMessage(
  value: unknown
): CorrelatedResponseEventMessage | null {
  return isRecord(value) &&
    hasExactKeys(value, [
      'acceptedIdentity',
      'instanceId',
      'instanceInfo',
      'messageId',
      'response',
      'responseTimestamp',
      'sessionId',
    ]) &&
    isNonEmptyString(value.messageId) &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.instanceId) &&
    typeof value.responseTimestamp === 'number' &&
    Number.isFinite(value.responseTimestamp) &&
    value.responseTimestamp >= 0 &&
    isAcceptedIdentity(value.acceptedIdentity)
    ? (() => {
        const instanceInfo = parseCorrelatedResponseInstanceInfo(
          value.instanceInfo
        )
        if (!instanceInfo) return null

        const restrictions = parseRestrictions(instanceInfo.restrictions)
        if (restrictions === INVALID_RESTRICTIONS) return null

        const validation = validateStudentResponse({
          type: instanceInfo.type,
          response: value.response as LiveQuizResponseInput,
          restrictions,
          instanceInfo,
        })
        if (!validation.valid) return null

        return {
          messageId: value.messageId,
          sessionId: value.sessionId,
          instanceId: value.instanceId,
          response: value.response as LiveQuizResponseInput,
          responseTimestamp: value.responseTimestamp,
          acceptedIdentity: {
            kind: value.acceptedIdentity.kind,
            id: value.acceptedIdentity.id,
          },
          instanceInfo,
        }
      })()
    : null
}

export function encryptCorrelatedResponseEvent({
  message,
  secret,
}: {
  message: CorrelatedResponseEventMessage
  secret: string
}) {
  const normalizedMessage = normalizeCorrelatedResponseEventMessage(message)
  if (!normalizedMessage) {
    throw new Error('Invalid correlated response outbox message')
  }

  const iv = randomBytes(CORRELATED_OUTBOX_IV_LENGTH)
  const cipher = createCipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    iv,
    { authTagLength: CORRELATED_OUTBOX_AUTH_TAG_LENGTH }
  )
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalizedMessage), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptCorrelatedResponseEvent({
  encryptedPayload,
  secret,
}: {
  encryptedPayload: string
  secret: string
}): CorrelatedResponseEventMessage {
  const [version, encodedIv, encodedTag, encodedPayload, ...rest] =
    encryptedPayload.split('.')
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedTag ||
    !encodedPayload ||
    rest.length > 0
  ) {
    throw new Error('Invalid correlated response outbox payload')
  }

  const iv = Buffer.from(encodedIv, 'base64url')
  const tag = Buffer.from(encodedTag, 'base64url')
  if (
    iv.length !== CORRELATED_OUTBOX_IV_LENGTH ||
    tag.length !== CORRELATED_OUTBOX_AUTH_TAG_LENGTH
  ) {
    throw new Error('Invalid correlated response outbox payload')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    iv,
    { authTagLength: CORRELATED_OUTBOX_AUTH_TAG_LENGTH }
  )
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, 'base64url')),
    decipher.final(),
  ])
  const message: unknown = JSON.parse(decrypted.toString('utf8'))
  const normalizedMessage = normalizeCorrelatedResponseEventMessage(message)
  if (!normalizedMessage) {
    throw new Error('Invalid correlated response outbox message')
  }
  return normalizedMessage
}
