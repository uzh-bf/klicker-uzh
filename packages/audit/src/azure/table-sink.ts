import type { TableEntity, TableEntityResult } from '@azure/data-tables'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import {
  type AppendAuditRecord,
  type AppendAuditResult,
  type AppendOnlyAuditSink,
  AuditAppendConflictError,
} from '../ports/append-sink.js'
import {
  type AuditTableEntity,
  mapAuditRecordToTableEntities,
} from './table-mapping.js'

export interface AuditTableClientPort {
  createEntity<T extends object>(entity: TableEntity<T>): Promise<unknown>
  getEntity<T extends object = Record<string, unknown>>(
    partitionKey: string,
    rowKey: string
  ): Promise<TableEntityResult<T>>
}

export type AuditTableClients = {
  evidence: AuditTableClientPort
  locator: AuditTableClientPort
  retentionIndex: AuditTableClientPort
}

type CreateOutcome = 'CREATED' | 'IDENTICAL_REPLAY'

function isStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === statusCode
  )
}

function normalizeTableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    typeof value.type === 'string'
  ) {
    return normalizeTableValue(value.value)
  }
  if (Array.isArray(value)) {
    return value.map(normalizeTableValue)
  }
  if (typeof value === 'object' && value !== null) {
    return normalizeTableEntity(value as Record<string, unknown>)
  }
  return value
}

function normalizeTableEntity(
  entity: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entity)
      .filter(
        ([key]) =>
          key !== 'etag' && key !== 'timestamp' && key !== 'odata.metadata'
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeTableValue(value)])
  )
}

export function auditTableEntitiesAreIdentical(
  expected: AuditTableEntity,
  actual: Readonly<Record<string, unknown>>
): boolean {
  return (
    canonicalizeJson(normalizeTableEntity(expected)) ===
    canonicalizeJson(normalizeTableEntity(actual))
  )
}

async function createOnlyEntity(
  client: AuditTableClientPort,
  entity: AuditTableEntity,
  eventId: string
): Promise<CreateOutcome> {
  try {
    await client.createEntity(entity)
    return 'CREATED'
  } catch (error) {
    if (!isStatusCode(error, 409)) {
      throw error
    }
  }

  const existing = await client.getEntity(entity.partitionKey, entity.rowKey)
  if (!auditTableEntitiesAreIdentical(entity, existing)) {
    throw new AuditAppendConflictError(eventId)
  }
  return 'IDENTICAL_REPLAY'
}

export class AzureTableAppendSink implements AppendOnlyAuditSink {
  private readonly clients: AuditTableClients

  constructor(clients: AuditTableClients) {
    this.clients = clients
  }

  async append(record: AppendAuditRecord): Promise<AppendAuditResult> {
    const mapped = mapAuditRecordToTableEntities(record)
    const outcomes: CreateOutcome[] = []

    for (const entity of mapped.evidence) {
      outcomes.push(
        await createOnlyEntity(
          this.clients.evidence,
          entity,
          record.envelope.eventId
        )
      )
    }
    outcomes.push(
      await createOnlyEntity(
        this.clients.locator,
        mapped.locator,
        record.envelope.eventId
      )
    )
    for (const reverseIndex of mapped.reverseRetentionIndexes) {
      outcomes.push(
        await createOnlyEntity(
          this.clients.retentionIndex,
          reverseIndex,
          record.envelope.eventId
        )
      )
    }
    outcomes.push(
      await createOnlyEntity(
        this.clients.retentionIndex,
        mapped.retentionIndex,
        record.envelope.eventId
      )
    )

    return {
      outcome: outcomes.every((outcome) => outcome === 'IDENTICAL_REPLAY')
        ? 'IDENTICAL_REPLAY'
        : 'CREATED',
      durableReceiptId: [
        'azure-table-v1',
        record.envelope.eventId,
        record.envelope.eventHash,
      ].join(':'),
    }
  }
}
