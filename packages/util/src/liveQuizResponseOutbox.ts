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

const CORRELATED_OUTBOX_ENCRYPTION_CONTEXT =
  'klicker-live-quiz-correlated-outbox-v1'

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
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.identityKey !== 'string'
  ) {
    return false
  }

  return (
    (value.kind === 'participant' &&
      value.identityKey === `participant:${value.id}`) ||
    ((value.kind === 'temporary' || value.kind === 'anonymous') &&
      value.identityKey === `respondent:${value.id}`)
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
    isRecord(value.instanceInfo) &&
    Object.values(value.instanceInfo).every(
      (entry) => typeof entry === 'string'
    ) &&
    isRecord(value.correlatedClaim) &&
    typeof value.correlatedClaim.key === 'string' &&
    typeof value.correlatedClaim.identityKey === 'string' &&
    isAcceptedIdentity(value.acceptedIdentity) &&
    value.correlatedClaim.identityKey === value.acceptedIdentity.identityKey
  )
}

export function encryptCorrelatedResponseEvent({
  message,
  secret,
}: {
  message: CorrelatedResponseEventMessage
  secret: string
}) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    iv
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

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    Buffer.from(encodedIv, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
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

export function validateStudentResponse({
  type,
  response,
  restrictions,
}: {
  type: string | undefined
  response: unknown
  restrictions?: unknown
}): { valid: boolean; message?: string } {
  if (!isRecord(response)) {
    return {
      valid: false,
      message: `Invalid response object ${JSON.stringify(response)}`,
    }
  }

  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    if (
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      !response.choices.every(
        (choice) =>
          isRecord(choice) &&
          typeof choice.ix === 'number' &&
          (typeof choice.selected === 'boolean' ||
            typeof choice.selected === 'undefined')
      )
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for choices question ${JSON.stringify(response)}`,
      }
    }

    if (
      type === 'SC' &&
      response.choices.filter((choice) => choice.selected).length !== 1
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for single choice question ${JSON.stringify(response)}`,
      }
    }

    if (
      type === 'MC' &&
      response.choices.filter((choice) => choice.selected).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for multiple choice question ${JSON.stringify(response)}`,
      }
    }

    if (type === 'KPRIM' && response.choices.length !== 4) {
      return {
        valid: false,
        message: `Invalid response submitted for KPRIM question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'NUMERICAL') {
    const parsedResponse =
      typeof response.value === 'string' && response.value.trim()
        ? Number(response.value.trim())
        : Number.NaN
    if (
      typeof response.value !== 'string' ||
      !Number.isFinite(parsedResponse)
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for numerical question ${JSON.stringify(response)}`,
      }
    }

    if (
      isRecord(restrictions) &&
      (('min' in restrictions &&
        typeof restrictions.min === 'number' &&
        parsedResponse < restrictions.min) ||
        ('max' in restrictions &&
          typeof restrictions.max === 'number' &&
          parsedResponse > restrictions.max))
    ) {
      return {
        valid: false,
        message: `Numerical response ${parsedResponse} out of bounds for numerical question with restrictions ${JSON.stringify(restrictions)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'FREE_TEXT') {
    if (!response.value || typeof response.value !== 'string') {
      return {
        valid: false,
        message: `Invalid response submitted for free text question ${JSON.stringify(response)}`,
      }
    }

    const trimmedResponse = response.value.trim()
    if (
      isRecord(restrictions) &&
      'maxLength' in restrictions &&
      typeof restrictions.maxLength === 'number' &&
      trimmedResponse.length > restrictions.maxLength
    ) {
      return {
        valid: false,
        message: `Free text response exceeds maximum length of ${restrictions.maxLength} characters for free text question`,
      }
    }

    return { valid: true }
  }

  if (type === 'SELECTION') {
    if (
      !Array.isArray(response.selection) ||
      response.selection.length === 0 ||
      response.selection.filter(
        (entry) =>
          entry !== -1 && typeof entry !== 'undefined' && entry !== null
      ).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'CASE_STUDY') {
    if (
      !isRecord(response.assessment) ||
      Object.keys(response.assessment).length === 0 ||
      !Object.values(response.assessment).every(
        (caseObject) =>
          isRecord(caseObject) &&
          Object.keys(caseObject).length > 0 &&
          Object.values(caseObject).every(
            (itemObject) =>
              isRecord(itemObject) &&
              Object.keys(itemObject).length > 0 &&
              Object.values(itemObject).every(
                (criterionResponse) => typeof criterionResponse === 'number'
              )
          )
      )
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for case study question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  if (type === 'CONTENT') {
    if (response.viewed !== true) {
      return {
        valid: false,
        message: `Invalid response submitted for content question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  return {
    valid: false,
    message: `Provided invalid question type in answer submission: ${type}`,
  }
}
