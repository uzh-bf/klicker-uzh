import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  type AuditMonitorCounts,
  PrismaAuditMonitorRepository,
} from '../src/index.js'

function assertLocalDatabase(): void {
  const value = process.env.DATABASE_URL
  if (value === undefined) {
    throw new Error('DATABASE_URL is required for audit integration tests')
  }
  const host = new URL(value).hostname
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  const isDevrouterDatabase =
    host === 'postgres' &&
    process.env.DEVROUTER_WORKSPACE !== undefined &&
    process.env.NODE_ENV !== 'production'
  if (!isLoopback && !isDevrouterDatabase) {
    throw new Error(
      `Refusing audit integration tests against database host ${host}`
    )
  }
}

type EventInput = {
  liveQuizId: string
  lifecycleEpoch: number
  correlationId: string
  eventType: string
  recordedAt: Date
}

async function createOutboxEvent(input: EventInput, index: number) {
  const token = randomUUID().replaceAll('-', '').repeat(2)
  return prisma.assessmentAuditOutboxEvent.create({
    data: {
      eventId: randomUUID(),
      idempotencyKey: token,
      eventHash: token,
      payloadHash: token,
      schemaVersion: 1,
      payloadSchemaVersion: 1,
      eventType: input.eventType,
      emissionPath: 'LANE_2_HATCHET',
      evidenceClass: 'SERVER_OBSERVED',
      criticality: 'CRITICAL',
      recordedVia: 'HATCHET_PROCESSOR',
      liveQuizId: input.liveQuizId,
      lifecycleEpoch: input.lifecycleEpoch,
      correlationId: input.correlationId,
      receivedAt: input.recordedAt,
      recordedAt: input.recordedAt,
      canonicalEnvelope: '{}',
      canonicalByteLength: index + 2,
    },
  })
}

async function createScope(
  liveQuizId: string,
  lifecycleEpoch: number,
  coverageState: 'COVERED' | 'ACTIVATING' | 'FAILED'
) {
  return prisma.assessmentAuditScope.create({
    data: {
      liveQuizId,
      lifecycleEpoch,
      coverageState,
    },
  })
}

beforeAll(() => {
  assertLocalDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('assessment audit monitor PostgreSQL queries', () => {
  it('counts exact covered submission gaps by quiz, epoch, and correlation', async () => {
    const ids = Array.from({ length: 8 }, () => randomUUID())
    const [q1, q2, q3, q4, q5, q6, q7, q8] = ids
    const correlations = Array.from({ length: 6 }, () => randomUUID())

    try {
      // q1 epoch 1 is genuinely missing a terminal. A terminal with the same
      // correlation in epoch 2 must not satisfy it.
      await createScope(q1!, 1, 'COVERED')
      await createScope(q1!, 2, 'COVERED')
      await createOutboxEvent(
        {
          liveQuizId: q1!,
          lifecycleEpoch: 1,
          correlationId: correlations[0]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:00:00.000Z'),
        },
        0
      )
      await createOutboxEvent(
        {
          liveQuizId: q1!,
          lifecycleEpoch: 2,
          correlationId: correlations[0]!,
          eventType: 'SUBMISSION_PERSISTED',
          recordedAt: new Date('2026-08-11T08:01:00.000Z'),
        },
        1
      )

      // q2 has a rejected terminal outcome.
      await createScope(q2!, 1, 'COVERED')
      await createOutboxEvent(
        {
          liveQuizId: q2!,
          lifecycleEpoch: 1,
          correlationId: correlations[1]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:02:00.000Z'),
        },
        2
      )
      await createOutboxEvent(
        {
          liveQuizId: q2!,
          lifecycleEpoch: 1,
          correlationId: correlations[1]!,
          eventType: 'SUBMISSION_REJECTED',
          recordedAt: new Date('2026-08-11T08:03:00.000Z'),
        },
        3
      )

      // q3 has duplicate accepted rows but only one logical submission, and a
      // duplicate terminal outcome.
      await createScope(q3!, 1, 'COVERED')
      await createOutboxEvent(
        {
          liveQuizId: q3!,
          lifecycleEpoch: 1,
          correlationId: correlations[2]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:04:00.000Z'),
        },
        4
      )
      await createOutboxEvent(
        {
          liveQuizId: q3!,
          lifecycleEpoch: 1,
          correlationId: correlations[2]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:04:01.000Z'),
        },
        5
      )
      await createOutboxEvent(
        {
          liveQuizId: q3!,
          lifecycleEpoch: 1,
          correlationId: correlations[2]!,
          eventType: 'SUBMISSION_DUPLICATE',
          recordedAt: new Date('2026-08-11T08:05:00.000Z'),
        },
        6
      )

      // q4 is the second genuine gap and proves the query does not stop at a
      // small in-memory sample.
      await createScope(q4!, 1, 'COVERED')
      await createOutboxEvent(
        {
          liveQuizId: q4!,
          lifecycleEpoch: 1,
          correlationId: correlations[3]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:06:00.000Z'),
        },
        7
      )

      // q5 is not covered; its accepted event must not be monitored.
      await createScope(q5!, 1, 'FAILED')
      await createOutboxEvent(
        {
          liveQuizId: q5!,
          lifecycleEpoch: 1,
          correlationId: correlations[4]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:07:00.000Z'),
        },
        8
      )

      // q6 proves the latest-scope activation failure is counted separately.
      await createScope(q6!, 1, 'ACTIVATING')

      // q8 has been activating beyond the ten-minute grace period and is
      // therefore counted as a stale activation failure. A fresh ACTIVATING
      // scope (q6) is intentionally not counted yet.
      await prisma.assessmentAuditScope.create({
        data: {
          liveQuizId: q8!,
          lifecycleEpoch: 1,
          coverageState: 'ACTIVATING',
          updatedAt: new Date('2026-08-11T07:00:00.000Z'),
        },
      })

      // q7 has a covered epoch followed by an excluded latest epoch. Its
      // accepted event remains associated with the covered epoch and should
      // still be counted if it has no terminal result.
      await createScope(q7!, 1, 'COVERED')
      await createScope(q7!, 2, 'FAILED')
      await createOutboxEvent(
        {
          liveQuizId: q7!,
          lifecycleEpoch: 1,
          correlationId: correlations[5]!,
          eventType: 'SUBMISSION_SERVER_ACCEPTED',
          recordedAt: new Date('2026-08-11T08:08:00.000Z'),
        },
        9
      )

      const repository = new PrismaAuditMonitorRepository(prisma)
      const counts: AuditMonitorCounts = await repository.readCounts()

      expect(counts.requiredMediaCaptureFailureCount).toBe(3)
      expect(counts.coveredSubmissionWithoutTerminalCount).toBe(3)
      expect(counts.oldestCoveredSubmissionWithoutTerminalAt).toEqual(
        new Date('2026-08-11T08:00:00.000Z')
      )
    } finally {
      await prisma.assessmentAuditOutboxEvent.deleteMany({
        where: { liveQuizId: { in: ids } },
      })
      await prisma.assessmentAuditScope.deleteMany({
        where: { liveQuizId: { in: ids } },
      })
    }
  })
})
