import type { TableEntity, TableEntityResult } from '@azure/data-tables'
import {
  AuditAppendConflictError,
  type AuditTableClientPort,
  AzureTableAppendSink,
  auditTableEntitiesAreIdentical,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  mapAuditRecordToTableEntities,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333'

function auditRecord() {
  return createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T08:00:00.123Z',
      recordedAt: '2026-08-11T08:00:00.456Z',
      actor: { kind: 'USER', userId: USER_ID },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 1 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_STARTED',
      producerOperationId: `${CORRELATION_ID}:0`,
      outcome: 'SUCCEEDED',
      payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
    }
  )
}

class MemoryTableClient implements AuditTableClientPort {
  readonly rows = new Map<string, Record<string, unknown>>()
  createCalls = 0

  key(partitionKey: string, rowKey: string): string {
    return `${partitionKey}\u0000${rowKey}`
  }

  async createEntity<T extends object>(entity: TableEntity<T>) {
    this.createCalls += 1
    const key = this.key(entity.partitionKey, entity.rowKey)
    if (this.rows.has(key)) {
      throw Object.assign(new Error('EntityAlreadyExists'), { statusCode: 409 })
    }
    this.rows.set(key, structuredClone(entity))
    return {}
  }

  async getEntity<T extends object = Record<string, unknown>>(
    partitionKey: string,
    rowKey: string
  ): Promise<TableEntityResult<T>> {
    const row = this.rows.get(this.key(partitionKey, rowKey))
    if (row === undefined) {
      throw Object.assign(new Error('ResourceNotFound'), { statusCode: 404 })
    }
    return {
      ...structuredClone(row),
      partitionKey,
      rowKey,
      etag: 'synthetic-etag',
      timestamp: '2026-08-11T08:00:01.000Z',
    } as TableEntityResult<T>
  }
}

function clients() {
  return {
    evidence: new MemoryTableClient(),
    locator: new MemoryTableClient(),
    retentionIndex: new MemoryTableClient(),
  }
}

describe('Azure Table append-only sink', () => {
  it('ignores provider-managed metadata when comparing an existing entity', () => {
    const entity = mapAuditRecordToTableEntities(auditRecord()).evidence[0]!

    expect(
      auditTableEntitiesAreIdentical(entity, {
        ...structuredClone(entity),
        'odata.metadata': 'http://azurite/$metadata#table/@Element',
        etag: 'provider-etag',
        timestamp: '2026-08-11T08:00:01.000Z',
      })
    ).toBe(true)
  })

  it('creates the complete resource set and accepts an identical replay', async () => {
    const record = auditRecord()
    const tableClients = clients()
    const sink = new AzureTableAppendSink(tableClients)

    await expect(sink.append(record)).resolves.toMatchObject({
      outcome: 'CREATED',
    })
    await expect(sink.append(record)).resolves.toMatchObject({
      outcome: 'IDENTICAL_REPLAY',
    })

    expect(tableClients.evidence.rows.size).toBe(2)
    expect(tableClients.locator.rows.size).toBe(1)
    expect(tableClients.retentionIndex.rows.size).toBe(1)
  })

  it('recovers a partial create by comparing existing rows and creating the rest', async () => {
    const record = auditRecord()
    const tableClients = clients()
    const mapped = mapAuditRecordToTableEntities(record)
    await tableClients.evidence.createEntity(mapped.evidence[0]!)

    const result = await new AzureTableAppendSink(tableClients).append(record)

    expect(result.outcome).toBe('CREATED')
    expect(tableClients.evidence.rows.size).toBe(mapped.evidence.length)
    expect(tableClients.locator.rows.size).toBe(1)
    expect(tableClients.retentionIndex.rows.size).toBe(1)
  })

  it('raises an integrity conflict when an existing entity differs', async () => {
    const record = auditRecord()
    const tableClients = clients()
    const mapped = mapAuditRecordToTableEntities(record)
    const root = mapped.evidence.at(-1)!
    tableClients.evidence.rows.set(
      tableClients.evidence.key(root.partitionKey, root.rowKey),
      { ...structuredClone(root), eventHash: 'f'.repeat(64) }
    )

    await expect(
      new AzureTableAppendSink(tableClients).append(record)
    ).rejects.toBeInstanceOf(AuditAppendConflictError)
  })

  it('propagates non-conflict storage failures for dispatcher retry', async () => {
    const record = auditRecord()
    const tableClients = clients()
    tableClients.evidence.createEntity = async () => {
      throw Object.assign(new Error('ServerBusy'), { statusCode: 503 })
    }

    await expect(
      new AzureTableAppendSink(tableClients).append(record)
    ).rejects.toThrow('ServerBusy')
  })
})
