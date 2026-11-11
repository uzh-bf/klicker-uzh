import { v5 as uuidV5 } from 'uuid'
import type { EventType } from '../contract/event-registry.js'
import { canonicalizeJson } from './canonicalize.js'
import { sha256Hex } from './hash.js'

export const ASSESSMENT_AUDIT_EVENT_NAMESPACE =
  'ba93fe0a-66f7-5f6e-a12d-986ebc6dac2f'

export type AuditEventIdentityInput = {
  eventType: EventType
  liveQuizId: string
  lifecycleEpoch: number
  producerOperationId: string
}

export function deriveAuditEventId(idempotencyKey: string): string {
  return uuidV5(idempotencyKey, ASSESSMENT_AUDIT_EVENT_NAMESPACE)
}

/**
 * Derives a stable correlation UUID from a descriptive operation name, so a
 * retried system operation (for example a scheduled publication) keeps one
 * correlation identity. The envelope requires a UUID, never free text.
 */
export function deriveAuditCorrelationId(operationName: string): string {
  if (operationName.trim() === '') {
    throw new TypeError('Audit correlation operation name must not be empty')
  }
  return uuidV5(
    canonicalizeJson([
      'klicker-assessment-audit-correlation',
      1,
      operationName,
    ]),
    ASSESSMENT_AUDIT_EVENT_NAMESPACE
  )
}

export function deriveAuditEventIdentity(input: AuditEventIdentityInput): {
  idempotencyKey: string
  eventId: string
} {
  const tuple = [
    'klicker-assessment-audit',
    1,
    input.eventType,
    input.liveQuizId,
    input.lifecycleEpoch,
    input.producerOperationId,
  ]
  const idempotencyKey = sha256Hex(canonicalizeJson(tuple))

  return {
    idempotencyKey,
    eventId: deriveAuditEventId(idempotencyKey),
  }
}
