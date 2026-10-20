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
