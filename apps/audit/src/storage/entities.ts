import { createHash } from 'crypto'
import type { AuditEvent } from '../schemas/audit-event.js'

export interface AuditTableEntity {
  partitionKey: string
  rowKey: string
  tenantId: string
  subject: string
  action: string
  timestamp: number
  attributes?: string // JSON serialized
  resourceId?: string
  sessionId?: string
  userId?: string
}

/**
 * Generate a deterministic event ID for idempotency
 * Uses critical fields to ensure same event generates same ID
 */
function generateDeterministicEventId(event: AuditEvent): string {
  const data = JSON.stringify({
    tenantId: event.tenantId,
    subject: event.subject,
    action: event.action,
    timestamp: event.timestamp,
    userId: event.userId || null,
    resourceId: event.resourceId || null,
    sessionId: event.sessionId || null,
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
  // Enforce idempotency: use provided eventId or generate deterministic one
  const eventId = event.eventId || generateDeterministicEventId(event)

  const partitionKey = generatePartitionKey(
    event.tenantId,
    event.timestamp,
    eventId
  )
  const rowKey = eventId

  return {
    partitionKey,
    rowKey,
    tenantId: event.tenantId,
    subject: event.subject,
    action: event.action,
    timestamp: event.timestamp,
    attributes: event.attributes ? JSON.stringify(event.attributes) : undefined,
    resourceId: event.resourceId,
    sessionId: event.sessionId,
    userId: event.userId,
  }
}

/**
 * Generate PartitionKey for optimal distribution and querying
 * Format: <tenantHash>-<YYYYMMDDHHmm>-<shard>
 *
 * This approach:
 * - Groups events by tenant and minute for efficient range queries
 * - Uses tenant hash to distribute across storage partitions
 * - Uses shard (derived from eventId) to further distribute load within a time bucket
 */
function generatePartitionKey(
  tenantId: string,
  timestamp: number,
  eventId?: string
): string {
  const date = new Date(timestamp)

  // Create time bucket at minute granularity
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const bucket = `${year}${month}${day}${hour}${minute}`

  // Simple, fast hash for tenant distribution (avoids expensive crypto operations)
  // Uses character sum with prime multiplication for good distribution
  let hash = 0
  for (let i = 0; i < tenantId.length; i++) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) % 10000
  }
  const tenantHash = (hash % 100).toString().padStart(2, '0')

  // Simple shard: use first character of eventId if provided, otherwise '0'
  // This avoids hashing the eventId entirely
  const shard = eventId ? eventId[0] : '0'

  return `${tenantHash}-${bucket}-${shard}`
}
