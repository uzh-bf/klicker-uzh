import {
  odata,
  type TableEntityQueryOptions,
  type TableEntityResult,
} from '@azure/data-tables'
import { sha256Hex } from '../canonical/hash.js'
import {
  type AuditEnvelope,
  parseCanonicalAuditEnvelope,
} from '../contract/envelope.js'
import { auditLocatorPartitionKey } from './table-mapping.js'

export interface AuditTableReaderClientPort {
  getEntity<T extends object = Record<string, unknown>>(
    partitionKey: string,
    rowKey: string
  ): Promise<TableEntityResult<T>>
  listEntities<T extends object = Record<string, unknown>>(options?: {
    queryOptions?: TableEntityQueryOptions
  }): AsyncIterable<TableEntityResult<T>>
}

export type AuditTableReaderClients = {
  evidence: AuditTableReaderClientPort
  locator: AuditTableReaderClientPort
  retentionIndex: AuditTableReaderClientPort
}

export type VerifiedAuditEvidence = {
  envelope: AuditEnvelope
  canonicalEnvelope: string
  status: 'VERIFIED'
  sealStatus: 'UNSEALED'
}

type LocatorEntity = {
  eventId: string
  eventHash: string
  canonicalHash: string
  evidencePartitionKey: string
  evidenceRootRowKey: string
  chunkCount: number
  liveQuizId: string
  lifecycleEpoch: number
}

type RootEntity = {
  eventId: string
  eventHash: string
  canonicalHash: string
  canonicalByteLength: number
  chunkCount: number
}

type ChunkEntity = {
  eventId: string
  eventHash: string
  canonicalHash: string
  chunkIndex: number
  content: Uint8Array
}

type RetentionEntity = {
  eventId: string
  eventHash: string
  canonicalHash: string
  evidencePartitionKey: string
  evidenceRootRowKey: string
  locatorPartitionKey: string
  locatorRowKey: string
  liveQuizId: string
  lifecycleEpoch: number
  participantId?: string
  resourceKind: string
  recordedAt: Date | string
}

const AUDIT_EXPORT_READ_CONCURRENCY = 8

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Audit evidence ${name} is invalid`)
  }
}

function assertInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Audit evidence ${name} is invalid`)
  }
}

function readBinary(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    value.value instanceof Uint8Array
  ) {
    return value.value
  }
  throw new Error('Audit evidence chunk content is invalid')
}

function assertLocator(entity: unknown): asserts entity is LocatorEntity {
  if (typeof entity !== 'object' || entity === null) {
    throw new Error('Audit locator is invalid')
  }
  const row = entity as Record<string, unknown>
  for (const field of [
    'eventId',
    'eventHash',
    'canonicalHash',
    'evidencePartitionKey',
    'evidenceRootRowKey',
    'liveQuizId',
  ]) {
    assertString(row[field], `locator ${field}`)
  }
  assertInteger(row.chunkCount, 'locator chunkCount')
  assertInteger(row.lifecycleEpoch, 'locator lifecycleEpoch')
}

function assertRoot(entity: unknown): asserts entity is RootEntity {
  if (typeof entity !== 'object' || entity === null) {
    throw new Error('Audit event root is invalid')
  }
  const row = entity as Record<string, unknown>
  for (const field of ['eventId', 'eventHash', 'canonicalHash']) {
    assertString(row[field], `root ${field}`)
  }
  assertInteger(row.canonicalByteLength, 'root canonicalByteLength')
  assertInteger(row.chunkCount, 'root chunkCount')
}

function assertRetention(
  entity: unknown,
  eventId: string
): asserts entity is RetentionEntity {
  if (typeof entity !== 'object' || entity === null) {
    throw new Error(`Audit retention index for ${eventId} is invalid`)
  }
  const row = entity as Record<string, unknown>
  for (const field of [
    'eventId',
    'eventHash',
    'canonicalHash',
    'evidencePartitionKey',
    'evidenceRootRowKey',
    'locatorPartitionKey',
    'locatorRowKey',
    'liveQuizId',
    'resourceKind',
  ]) {
    assertString(row[field], `retention ${field}`)
  }
  assertInteger(row.lifecycleEpoch, 'retention lifecycleEpoch')
}

async function mapInParallel<T, R>(
  values: readonly T[],
  concurrency: number,
  callback: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (next < values.length) {
        const index = next
        next += 1
        results[index] = await callback(values[index]!)
      }
    }
  )
  await Promise.all(workers)
  return results
}

export class AzureTableAuditReader {
  private readonly clients: AuditTableReaderClients

  constructor(clients: AuditTableReaderClients) {
    this.clients = clients
  }

  async verifyEvent(eventId: string): Promise<VerifiedAuditEvidence> {
    const locator = await this.clients.locator.getEntity<LocatorEntity>(
      auditLocatorPartitionKey(eventId),
      eventId
    )
    assertLocator(locator)
    if (locator.eventId !== eventId) {
      throw new Error('Audit locator identity mismatch')
    }

    const root = await this.clients.evidence.getEntity<RootEntity>(
      locator.evidencePartitionKey,
      locator.evidenceRootRowKey
    )
    assertRoot(root)
    if (
      root.eventId !== eventId ||
      root.eventHash !== locator.eventHash ||
      root.canonicalHash !== locator.canonicalHash ||
      root.chunkCount !== locator.chunkCount
    ) {
      throw new Error('Audit root does not match its locator')
    }

    const chunks: Uint8Array[] = []
    for (let index = 0; index < root.chunkCount; index += 1) {
      const rowKey = `c|${eventId}|${String(index).padStart(6, '0')}`
      const chunk = await this.clients.evidence.getEntity<ChunkEntity>(
        locator.evidencePartitionKey,
        rowKey
      )
      const content = readBinary(chunk.content)
      if (
        chunk.eventId !== eventId ||
        chunk.eventHash !== root.eventHash ||
        chunk.canonicalHash !== root.canonicalHash ||
        chunk.chunkIndex !== index
      ) {
        throw new Error(`Audit chunk ${index} does not match its root`)
      }
      chunks.push(content)
    }

    const canonicalBytes = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk))
    )
    if (canonicalBytes.byteLength !== root.canonicalByteLength) {
      throw new Error('Audit canonical byte length mismatch')
    }
    const canonicalEnvelope = canonicalBytes.toString('utf8')
    if (sha256Hex(canonicalBytes) !== root.canonicalHash) {
      throw new Error('Audit canonical content hash mismatch')
    }
    const envelope = parseCanonicalAuditEnvelope(canonicalEnvelope)
    if (envelope.eventId !== eventId || envelope.eventHash !== root.eventHash) {
      throw new Error('Audit canonical envelope does not match its root')
    }

    const shard = eventId.toLowerCase().match(/[0-9a-f]/)?.[0]
    if (shard === undefined) {
      throw new Error('Audit event ID has no hexadecimal shard')
    }
    const retentionPartitionKey = [
      'v1',
      locator.liveQuizId,
      String(locator.lifecycleEpoch),
      shard,
    ].join('|')
    const retention = await this.clients.retentionIndex.getEntity<RetentionEntity>(
      retentionPartitionKey,
      'event|' + eventId
    )
    assertRetention(retention, eventId)
    if (
      retention.eventId !== eventId ||
      retention.eventHash !== root.eventHash ||
      retention.canonicalHash !== root.canonicalHash ||
      retention.evidencePartitionKey !== locator.evidencePartitionKey ||
      retention.evidenceRootRowKey !== locator.evidenceRootRowKey ||
      retention.locatorPartitionKey !== auditLocatorPartitionKey(eventId) ||
      retention.locatorRowKey !== eventId ||
      retention.liveQuizId !== locator.liveQuizId ||
      retention.lifecycleEpoch !== locator.lifecycleEpoch ||
      retention.resourceKind !== 'EVENT'
    ) {
      throw new Error('Audit retention index does not match its event')
    }
    if (
      envelope.scope.liveQuizId !== locator.liveQuizId ||
      envelope.scope.lifecycleEpoch !== locator.lifecycleEpoch
    ) {
      throw new Error('Audit scope does not match its locator')
    }
    if (
      retention.participantId !== undefined &&
      envelope.scope.participantId !== undefined &&
      retention.participantId !== envelope.scope.participantId
    ) {
      throw new Error('Audit retention participant scope does not match')
    }

    return {
      envelope,
      canonicalEnvelope,
      status: 'VERIFIED',
      sealStatus: 'UNSEALED',
    }
  }

  async listQuizEventIds(input: {
    liveQuizId: string
    lifecycleEpoch?: number
  }): Promise<string[]> {
    const prefix = `v1|${input.liveQuizId}|`
    const partitionFilter =
      input.lifecycleEpoch === undefined
        ? odata`PartitionKey ge ${prefix} and PartitionKey lt ${`v1|${input.liveQuizId}}`}`
        : odata`PartitionKey ge ${`${prefix}${input.lifecycleEpoch}|`} and PartitionKey lt ${`${prefix}${input.lifecycleEpoch}}`}`
    const eventIds = new Set<string>()
    for await (const entity of this.clients.retentionIndex.listEntities<RetentionEntity>(
      {
        queryOptions: {
          filter: `${partitionFilter} and resourceKind eq 'EVENT'`,
          select: ['PartitionKey', 'RowKey', 'eventId', 'recordedAt'],
        },
      }
    )) {
      assertString(entity.eventId, 'retention eventId')
      eventIds.add(entity.eventId)
    }
    return [...eventIds].sort()
  }

  async exportQuiz(input: {
    liveQuizId: string
    lifecycleEpoch?: number
    participantId?: string
  }): Promise<VerifiedAuditEvidence[]> {
    const eventIds = await this.listQuizEventIds({
      liveQuizId: input.liveQuizId,
      lifecycleEpoch: input.lifecycleEpoch,
    })
    const evidence = await mapInParallel(
      eventIds,
      AUDIT_EXPORT_READ_CONCURRENCY,
      (eventId) => this.verifyEvent(eventId)
    )
    const participantScoped =
      input.participantId === undefined
        ? evidence
        : evidence.filter(
            ({ envelope }) =>
              envelope.scope.participantId === undefined ||
              envelope.scope.participantId === input.participantId
          )
    return participantScoped.sort(
      (left, right) =>
        left.envelope.recordedAt.localeCompare(right.envelope.recordedAt) ||
        left.envelope.eventId.localeCompare(right.envelope.eventId)
    )
  }

  async exportQuizWithFailures(input: {
    liveQuizId: string
    lifecycleEpoch?: number
    participantId?: string
  }): Promise<{
    verified: VerifiedAuditEvidence[]
    failures: {
      eventId: string
      reason:
        | 'RETENTION_INDEX_MISSING'
        | 'LOCATOR_MISSING'
        | 'EVIDENCE_MISSING'
        | 'VERIFICATION_FAILED'
      detail: string
    }[]
  }> {
    const eventIds = await this.listQuizEventIds({
      liveQuizId: input.liveQuizId,
      lifecycleEpoch: input.lifecycleEpoch,
    })
    type ExportResult =
      | { eventId: string; evidence: VerifiedAuditEvidence }
      | {
          eventId: string
          failure: {
            eventId: string
            reason:
              | 'RETENTION_INDEX_MISSING'
              | 'LOCATOR_MISSING'
              | 'EVIDENCE_MISSING'
              | 'VERIFICATION_FAILED'
            detail: string
          }
        }
    const results = await mapInParallel(
      eventIds,
      AUDIT_EXPORT_READ_CONCURRENCY,
      async (eventId): Promise<ExportResult> => {
        try {
          return { eventId, evidence: await this.verifyEvent(eventId) }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          let reason: 'RETENTION_INDEX_MISSING' | 'VERIFICATION_FAILED' =
            'VERIFICATION_FAILED'
          if (/retention index/i.test(message)) {
            reason = 'RETENTION_INDEX_MISSING'
          }
          return { eventId, failure: { eventId, reason, detail: message } }
        }
      }
    )
    const verified = results
      .filter((result): result is Extract<ExportResult, { evidence: unknown }> =>
        'evidence' in result
      )
      .map((result) => result.evidence)
    const failures = results
      .filter((result): result is Extract<ExportResult, { failure: unknown }> =>
        'failure' in result
      )
      .map((result) => result.failure)
    const participantScoped =
      input.participantId === undefined
        ? verified
        : verified.filter(
            ({ envelope }) =>
              envelope.scope.participantId === undefined ||
              envelope.scope.participantId === input.participantId
          )
    return {
      verified: participantScoped.sort(
        (left, right) =>
          left.envelope.recordedAt.localeCompare(right.envelope.recordedAt) ||
          left.envelope.eventId.localeCompare(right.envelope.eventId)
      ),
      failures,
    }
  }
}
