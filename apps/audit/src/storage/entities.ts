import { AuditAction, AuditScope } from '@klicker-uzh/types'
import { createHash } from 'crypto'
import type { AuditEvent } from '../schemas/audit-event.js'

export interface AuditTableEntity {
  partitionKey: string
  rowKey: string
  scope: AuditScope
  subject: string
  action: AuditAction
  eventTimestamp: number
  attributes?: string // JSON serialized
  correlationId?: string
  correlationClaims?: string // JSON serialized
  stage?: string
  schemaVersion: number
  resource?: string
}

/**
 * Generate a deterministic event ID for idempotency
 * Uses critical fields to ensure same event generates same ID
 */
function generateDeterministicEventId(event: AuditEvent): string {
  const data = JSON.stringify({
    scope: event.scope,
    subject: event.subject,
    action: event.action,
    timestamp: event.timestamp,
    resource: event.resource || null,
    // Include subset of attributes for uniqueness (avoid full object for size)
    attributesHash: event.attributes
      ? createHash('sha256')
          .update(JSON.stringify(event.attributes))
          .digest('hex')
          .substring(0, 8)
      : null,
  })

  return createHash('sha256').update(data).digest('hex').substring(0, 16)
}

/**
 * Create an Azure Table entity from an audit event with idempotency enforcement
 */
export function createAuditEntity(event: AuditEvent): AuditTableEntity {
  if (!event.subject) {
    throw new Error('subject is required to create an audit entity')
  }

  // Enforce idempotency: use provided eventId or generate deterministic one
  const eventId = event.eventId || generateDeterministicEventId(event)

  const partitionKey = generatePartitionKey(event.timestamp, eventId)
  const rowKey = eventId

  return {
    partitionKey,
    rowKey,
    scope: event.scope ?? AuditScope.INTERNAL,
    subject: event.subject,
    action: event.action,
    eventTimestamp: event.timestamp,
    attributes: event.attributes ? JSON.stringify(event.attributes) : undefined,
    correlationId: event.correlationId,
    correlationClaims: event.correlationClaims
      ? JSON.stringify(event.correlationClaims)
      : undefined,
    stage: event.stage,
    schemaVersion: event.schemaVersion ?? 1,
    resource: event.resource,
  }
}

/**
 * Generate PartitionKey for optimal distribution and querying
 * Format: <YYYYMMDDHHmm>-<shard>
 *
 * This approach:
 * - Groups events by minute for efficient range queries
 * - Uses shard (derived from eventId) to distribute load within a time bucket
 */
function generatePartitionKey(timestamp: number, eventId?: string): string {
  const date = new Date(timestamp)

  // Create time bucket at minute granularity
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const bucket = `${year}${month}${day}${hour}${minute}`

  // Derive a hexadecimal shard from the eventId to distribute entities evenly
  const shard = eventId
    ? createHash('sha256').update(eventId).digest('hex')[0]!
    : '0'

  return `${bucket}-${shard}`
}
