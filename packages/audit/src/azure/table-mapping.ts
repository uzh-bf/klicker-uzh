import type { TableEntity } from '@azure/data-tables'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import { sha256Hex } from '../canonical/hash.js'
import { parseCanonicalAuditEnvelope } from '../contract/envelope.js'
import {
  type AppendAuditRecord,
  AuditAppendConflictError,
} from '../ports/append-sink.js'

export const AUDIT_TABLE_NAMES = {
  evidence: 'AuditEvidence',
  locator: 'AuditLocator',
  retentionIndex: 'AuditRetentionIndex',
  control: 'AuditControl',
} as const

export const AUDIT_CANONICAL_CHUNK_BYTES = 48 * 1024

export type AuditTableEntity = TableEntity<Record<string, unknown>>

export type MappedAuditTableRecord = {
  evidence: AuditTableEntity[]
  locator: AuditTableEntity
  retentionIndex: AuditTableEntity
  reverseRetentionIndexes: AuditTableEntity[]
}

function int32(value: number) {
  return { value, type: 'Int32' as const }
}

function eventShard(eventId: string): string {
  const shard = eventId.toLowerCase().match(/[0-9a-f]/)?.[0]
  if (shard === undefined) {
    throw new TypeError('Audit event ID has no hexadecimal shard')
  }
  return shard
}

function utcDay(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Audit recordedAt is invalid')
  }
  return parsed.toISOString().slice(0, 10).replaceAll('-', '')
}

function splitCanonicalBytes(canonicalEnvelope: string): Uint8Array[] {
  const bytes = Buffer.from(canonicalEnvelope, 'utf8')
  const chunks: Uint8Array[] = []
  for (
    let offset = 0;
    offset < bytes.length;
    offset += AUDIT_CANONICAL_CHUNK_BYTES
  ) {
    chunks.push(bytes.subarray(offset, offset + AUDIT_CANONICAL_CHUNK_BYTES))
  }
  if (chunks.length === 0) {
    throw new TypeError('Audit canonical envelope is empty')
  }
  if (chunks.length > 999_999) {
    throw new RangeError('Audit canonical envelope has too many chunks')
  }
  return chunks
}

function optionalProperties(
  input: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
}

function retentionMediaState(
  envelope: AppendAuditRecord['envelope']
): Record<string, unknown> | null {
  const payload = envelope.payload
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null
  }
  if (envelope.eventType === 'ASSESSMENT_BASELINE_PART_RECORDED') {
    const content = payload.content
    if (
      typeof content !== 'object' ||
      content === null ||
      Array.isArray(content) ||
      content.kind !== 'MEDIA_REFERENCE'
    ) {
      return null
    }
    const media = content.media
    return typeof media === 'object' && media !== null && !Array.isArray(media)
      ? media
      : null
  }
  if (
    envelope.eventType !== 'ASSESSMENT_MEDIA_CAPTURED' &&
    envelope.eventType !== 'ASSESSMENT_MEDIA_REPLACED'
  ) {
    return null
  }
  const media = payload.after
  return typeof media === 'object' && media !== null && !Array.isArray(media)
    ? media
    : null
}

export function auditEvidencePartitionKey(record: AppendAuditRecord): string {
  const { envelope } = record
  return [
    'v1',
    envelope.scope.liveQuizId,
    envelope.scope.lifecycleEpoch,
    utcDay(envelope.recordedAt),
    eventShard(envelope.eventId),
  ].join('|')
}

export function auditLocatorPartitionKey(eventId: string): string {
  return `v1|${eventShard(eventId)}`
}

export function auditRetentionPartitionKey(record: AppendAuditRecord): string {
  const { envelope } = record
  return [
    'v1',
    envelope.scope.liveQuizId,
    envelope.scope.lifecycleEpoch,
    eventShard(envelope.eventId),
  ].join('|')
}

export function mapAuditRecordToTableEntities(
  record: AppendAuditRecord
): MappedAuditTableRecord {
  parseCanonicalAuditEnvelope(record.canonicalEnvelope)
  if (canonicalizeJson(record.envelope) !== record.canonicalEnvelope) {
    throw new AuditAppendConflictError(record.envelope.eventId)
  }

  const { envelope, canonicalEnvelope } = record
  const chunks = splitCanonicalBytes(canonicalEnvelope)
  const evidencePartitionKey = auditEvidencePartitionKey(record)
  const locatorPartitionKey = auditLocatorPartitionKey(envelope.eventId)
  const retentionPartitionKey = auditRetentionPartitionKey(record)
  const canonicalHash = sha256Hex(canonicalEnvelope)
  const optionalScope = optionalProperties({
    courseId: envelope.scope.courseId,
    participantId: envelope.scope.participantId,
  })
  const reverseRetentionIndexes: AuditTableEntity[] = []
  const media = retentionMediaState(envelope)
  if (media !== null) {
    const contentHash = media.contentHash
    const blobName = media.blobName
    if (
      typeof contentHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(contentHash) ||
      typeof blobName !== 'string' ||
      blobName !== `sha256/${contentHash}`
    ) {
      throw new AuditAppendConflictError(envelope.eventId)
    }
    reverseRetentionIndexes.push({
      partitionKey: `media|${contentHash[0]}|${contentHash}`,
      rowKey: [
        envelope.scope.liveQuizId,
        String(envelope.scope.lifecycleEpoch).padStart(10, '0'),
        envelope.eventId,
      ].join('|'),
      recordKind: 'MEDIA_REFERENCE',
      resourceKind: 'MEDIA',
      contentHash,
      blobName,
      referenceEventId: envelope.eventId,
      referenceEventHash: envelope.eventHash,
      liveQuizId: envelope.scope.liveQuizId,
      lifecycleEpoch: int32(envelope.scope.lifecycleEpoch),
      recordedAt: new Date(envelope.recordedAt),
    })
  }

  const root: AuditTableEntity = {
    partitionKey: evidencePartitionKey,
    rowKey: `e|${envelope.eventId}`,
    recordKind: 'EVENT_ROOT',
    eventId: envelope.eventId,
    eventHash: envelope.eventHash,
    payloadHash: envelope.payloadHash,
    canonicalHash,
    idempotencyKey: envelope.idempotencyKey,
    eventType: envelope.eventType,
    evidenceClass: envelope.evidenceClass,
    criticality: envelope.criticality,
    recordedVia: envelope.recordedVia,
    schemaVersion: int32(envelope.schemaVersion),
    payloadSchemaVersion: int32(envelope.payloadSchemaVersion),
    liveQuizId: envelope.scope.liveQuizId,
    lifecycleEpoch: int32(envelope.scope.lifecycleEpoch),
    correlationId: envelope.correlationId,
    receivedAt: new Date(envelope.receivedAt),
    recordedAt: new Date(envelope.recordedAt),
    canonicalByteLength: int32(Buffer.byteLength(canonicalEnvelope, 'utf8')),
    chunkCount: int32(chunks.length),
    chunkBytes: int32(AUDIT_CANONICAL_CHUNK_BYTES),
    ...optionalScope,
  }

  const chunkEntities = chunks.map<AuditTableEntity>((content, index) => ({
    partitionKey: evidencePartitionKey,
    rowKey: `c|${envelope.eventId}|${String(index).padStart(6, '0')}`,
    recordKind: 'EVENT_CHUNK',
    eventId: envelope.eventId,
    eventHash: envelope.eventHash,
    canonicalHash,
    chunkIndex: int32(index),
    chunkCount: int32(chunks.length),
    content,
  }))

  return {
    evidence: [...chunkEntities, root],
    locator: {
      partitionKey: locatorPartitionKey,
      rowKey: envelope.eventId,
      recordKind: 'EVENT_LOCATOR',
      eventId: envelope.eventId,
      eventHash: envelope.eventHash,
      canonicalHash,
      evidencePartitionKey,
      evidenceRootRowKey: root.rowKey,
      chunkCount: int32(chunks.length),
      liveQuizId: envelope.scope.liveQuizId,
      lifecycleEpoch: int32(envelope.scope.lifecycleEpoch),
      recordedAt: new Date(envelope.recordedAt),
      ...optionalScope,
    },
    retentionIndex: {
      partitionKey: retentionPartitionKey,
      rowKey: `event|${envelope.eventId}`,
      recordKind: 'EVIDENCE_RESOURCE',
      resourceKind: 'EVENT',
      eventId: envelope.eventId,
      eventHash: envelope.eventHash,
      canonicalHash,
      evidencePartitionKey,
      evidenceRootRowKey: root.rowKey,
      locatorPartitionKey,
      locatorRowKey: envelope.eventId,
      liveQuizId: envelope.scope.liveQuizId,
      lifecycleEpoch: int32(envelope.scope.lifecycleEpoch),
      recordedAt: new Date(envelope.recordedAt),
      ...optionalScope,
    },
    reverseRetentionIndexes,
  }
}
