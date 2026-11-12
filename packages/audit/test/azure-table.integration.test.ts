import { randomUUID } from 'node:crypto'
import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables'
import {
  AuditAppendConflictError,
  AzureTableAppendSink,
  AzureTableAuditReader,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  mapAuditRecordToTableEntities,
} from '../src/index.js'

const AZURITE_ACCOUNT_NAME = 'devstoreaccount1'
// Public, fixed credential defined by the Azurite emulator; never valid in Azure.
const AZURITE_ACCOUNT_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='
const AZURITE_TABLE_ENDPOINT =
  process.env.AZURITE_TABLE_ENDPOINT ?? 'http://azurite:10002/devstoreaccount1'
const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333'
const PARTIAL_CORRELATION_ID = '44444444-4444-4444-8444-444444444444'
const SECOND_EPOCH_CORRELATION_ID = '55555555-5555-4555-8555-555555555555'

function assessmentState(description: string | null) {
  return {
    name: 'Assessment',
    displayName: 'Assessment',
    description,
    accessMode: 'PUBLIC' as const,
    publicationStatus: 'DRAFT',
    reviewStatus: 'INCOMPLETE',
    availableFrom: null,
    isLiveQAEnabled: false,
    isConfusionFeedbackEnabled: true,
    isModerationEnabled: true,
    isGamificationEnabled: false,
    isAssessmentEnabled: true,
    areInstancesOutdated: false,
    pointsMultiplier: 1,
    defaultPoints: 10,
    defaultCorrectPoints: 5,
    maximumBonusPoints: 45,
    secondsToZeroBonus: 20,
    activeBlockId: null,
  }
}

function chunkedAuditRecord(
  correlationId = CORRELATION_ID,
  lifecycleEpoch = 1
) {
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
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch },
      correlationId,
    }),
    {
      eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
      producerOperationId: `${correlationId}:large`,
      payload: {
        entityType: 'ASSESSMENT',
        entityId: LIVE_QUIZ_ID,
        before: assessmentState(null),
        after: assessmentState('ü'.repeat(30_000)),
      },
    }
  )
}

function tableName(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll('-', '')}`
}

function clients() {
  const credential = new AzureNamedKeyCredential(
    AZURITE_ACCOUNT_NAME,
    AZURITE_ACCOUNT_KEY
  )
  return {
    evidence: new TableClient(
      AZURITE_TABLE_ENDPOINT,
      tableName('AuditEvidence'),
      credential,
      { allowInsecureConnection: true }
    ),
    locator: new TableClient(
      AZURITE_TABLE_ENDPOINT,
      tableName('AuditLocator'),
      credential,
      { allowInsecureConnection: true }
    ),
    retentionIndex: new TableClient(
      AZURITE_TABLE_ENDPOINT,
      tableName('AuditRetention'),
      credential,
      { allowInsecureConnection: true }
    ),
  }
}

async function createTableWithStartupRetry(client: TableClient): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await client.createTable()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError
}

describe('Azure Table provider conformance through Azurite', () => {
  const tableClients = clients()
  const allClients = Object.values(tableClients)

  beforeAll(async () => {
    await Promise.all(allClients.map(createTableWithStartupRetry))
  })

  afterAll(async () => {
    await Promise.allSettled(allClients.map((client) => client.deleteTable()))
  })

  it('reconstructs exact chunked canonical bytes and accepts an identical replay', async () => {
    const record = chunkedAuditRecord(PARTIAL_CORRELATION_ID)
    const sink = new AzureTableAppendSink(tableClients)
    const reader = new AzureTableAuditReader(tableClients)

    await expect(sink.append(record)).resolves.toMatchObject({
      outcome: 'CREATED',
    })
    await expect(reader.verifyEvent(record.envelope.eventId)).resolves.toEqual({
      envelope: record.envelope,
      canonicalEnvelope: record.canonicalEnvelope,
      status: 'VERIFIED',
      sealStatus: 'UNSEALED',
    })
    await expect(sink.append(record)).resolves.toMatchObject({
      outcome: 'IDENTICAL_REPLAY',
    })
    const secondEpoch = chunkedAuditRecord(SECOND_EPOCH_CORRELATION_ID, 2)
    await expect(sink.append(secondEpoch)).resolves.toMatchObject({
      outcome: 'CREATED',
    })
    await expect(
      reader.exportQuiz({ liveQuizId: LIVE_QUIZ_ID })
    ).resolves.toHaveLength(2)
    await expect(
      reader.exportQuiz({ liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 2 })
    ).resolves.toMatchObject([
      { envelope: { eventId: secondEpoch.envelope.eventId } },
    ])
  })

  it('recovers a partial write and rejects different bytes at an existing key', async () => {
    const record = chunkedAuditRecord()
    const mapped = mapAuditRecordToTableEntities(record)
    await tableClients.evidence.createEntity(mapped.evidence[0]!)

    await expect(
      new AzureTableAppendSink(tableClients).append(record)
    ).resolves.toMatchObject({ outcome: 'CREATED' })

    const conflictClients = clients()
    const conflictTables = Object.values(conflictClients)
    await Promise.all(conflictTables.map((client) => client.createTable()))
    try {
      await conflictClients.evidence.createEntity({
        ...mapped.evidence[0]!,
        eventHash: 'f'.repeat(64),
      })
      await expect(
        new AzureTableAppendSink(conflictClients).append(record)
      ).rejects.toBeInstanceOf(AuditAppendConflictError)
    } finally {
      await Promise.allSettled(
        conflictTables.map((client) => client.deleteTable())
      )
    }
  })
})
