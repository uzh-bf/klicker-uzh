import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import type {
  AcceptedCorrelatedResponseIdentity,
  CorrelatedResponseEventMessage,
} from './liveQuizResponseIdentity.js'
import { parseCorrelatedResponseInstanceInfo } from './liveQuizResponseMetadata.js'

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

function isAcceptedIdentity(
  value: unknown
): value is AcceptedCorrelatedResponseIdentity {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false
  }

  return (
    value.kind === 'participant' ||
    value.kind === 'temporary' ||
    value.kind === 'anonymous'
  )
}

function isCorrelatedResponseEventMessage(
  value: unknown
): value is CorrelatedResponseEventMessage {
  return (
    isRecord(value) &&
    typeof value.messageId === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.instanceId === 'string' &&
    isRecord(value.response) &&
    typeof value.responseTimestamp === 'number' &&
    Number.isFinite(value.responseTimestamp) &&
    !('cookie' in value) &&
    parseCorrelatedResponseInstanceInfo(value.instanceInfo) !== null &&
    isAcceptedIdentity(value.acceptedIdentity)
  )
}

export function encryptCorrelatedResponseEvent({
  message,
  secret,
}: {
  message: CorrelatedResponseEventMessage
  secret: string
}) {
  const iv = randomBytes(CORRELATED_OUTBOX_IV_LENGTH)
  const cipher = createCipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    iv,
    { authTagLength: CORRELATED_OUTBOX_AUTH_TAG_LENGTH }
  )
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(message), 'utf8'),
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
  if (!isCorrelatedResponseEventMessage(message)) {
    throw new Error('Invalid correlated response outbox message')
  }
  return message
}
