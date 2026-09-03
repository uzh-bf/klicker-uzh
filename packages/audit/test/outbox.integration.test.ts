import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  AUDIT_OUTBOX_LEASE_MILLISECONDS,
  type AuditEventDraft,
  type AuditTransactionClient,
  claimAuditOutboxEvents,
  createTrustedAuditContext,
  emitAuditEvents,
  recordStandaloneAuditEvents,
  runInAuditTransaction,
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

function trustedContext(
  liveQuizId: string,
  userId: string,
  correlationId: string,
  courseId?: string
) {
  return createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: '2026-08-11T08:00:00.123Z',
    recordedAt: '2026-08-11T08:00:00.456Z',
    actor: { kind: 'USER', userId },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'LECTURER',
      requiredPermission: 'LIVE_QUIZ_WRITE',
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: liveQuizId },
    },
    scope: {
      liveQuizId,
      lifecycleEpoch: 1,
      ...(courseId === undefined ? {} : { courseId }),
    },
    correlationId,
  })
}

async function createSyntheticLiveQuiz(): Promise<{
  userId: string
  liveQuizId: string
}> {
  const userId = randomUUID()
  const liveQuizId = randomUUID()
  await prisma.user.create({
    data: {
      id: userId,
      email: `audit-${userId}@example.invalid`,
      shortname: `audit-${userId}`,
      liveQuizzes: {
        create: {
          id: liveQuizId,
          name: 'synthetic-audit-test',
          displayName: 'Synthetic audit test',
          isAssessmentEnabled: true,
          pinCode: randomUUID(),
        },
      },
    },
  })
  return { userId, liveQuizId }
}

async function cleanup(userId: string, liveQuizId: string): Promise<void> {
  await prisma.assessmentAuditOutboxEvent.deleteMany({ where: { liveQuizId } })
  await prisma.user.deleteMany({ where: { id: userId } })
}

async function cleanupAssessmentGraph(input: {
  userId: string
  participantId: string
  courseId: string
  liveQuizId: string
}): Promise<void> {
  await prisma.assessmentAuditOutboxEvent.deleteMany({
    where: { liveQuizId: input.liveQuizId },
  })
  await prisma.liveQuiz.deleteMany({ where: { id: input.liveQuizId } })
  await prisma.course.deleteMany({ where: { id: input.courseId } })
  await prisma.participant.deleteMany({ where: { id: input.participantId } })
  await prisma.user.deleteMany({ where: { id: input.userId } })
}

beforeAll(() => {
  assertLocalDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('transactional assessment audit outbox', () => {
  it('does not accept a full Prisma client as an audit transaction capability', async () => {
    type FullClientIsAuditTransaction =
      typeof prisma extends AuditTransactionClient ? true : false
    expectTypeOf<FullClientIsAuditTransaction>().toEqualTypeOf<false>()

    const liveQuizId = randomUUID()
    const userId = randomUUID()
    await expect(
      emitAuditEvents(
        prisma as never,
        trustedContext(liveQuizId, userId, randomUUID()),
        []
      )
    ).rejects.toThrow('transaction capability is not trusted')
  })

  it('allows standalone server observations but rejects critical evidence', async () => {
    const liveQuizId = randomUUID()
    const userId = randomUUID()
    const correlationId = randomUUID()
    const context = trustedContext(liveQuizId, userId, correlationId)

    try {
      const emitted = await recordStandaloneAuditEvents(prisma, context, [
        {
          eventType: 'ASSESSMENT_ACTION_REJECTED',
          producerOperationId: `${correlationId}:rejected`,
          payload: {
            actionType: 'START_ASSESSMENT',
            reasonCode: 'NOT_AUTHORIZED',
          },
        },
      ])
      expect(emitted).toHaveLength(1)

      await expect(
        recordStandaloneAuditEvents(prisma, context, [
          {
            eventType: 'ASSESSMENT_STARTED',
            producerOperationId: `${correlationId}:critical`,
            payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
          },
        ])
      ).rejects.toThrow('Standalone audit emission is forbidden')
    } finally {
      await prisma.assessmentAuditOutboxEvent.deleteMany({
        where: { liveQuizId },
      })
    }
  })

  it('commits business state and evidence atomically, then survives business deletion', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()

    try {
      const emitted = await runInAuditTransaction(
        prisma,
        async (tx, auditTx) => {
          await tx.liveQuiz.update({
            where: { id: liveQuizId },
            data: { status: 'PUBLISHED' },
          })
          return emitAuditEvents(
            auditTx,
            trustedContext(liveQuizId, userId, correlationId),
            [
              {
                eventType: 'ASSESSMENT_PUBLISHED',
                producerOperationId: `${correlationId}:0`,
                payload: { fromState: 'DRAFT', toState: 'PUBLISHED' },
              },
            ]
          )
        }
      )

      expect(
        await prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuizId } })
      ).toMatchObject({ status: 'PUBLISHED' })
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: { eventId: emitted[0]?.eventId },
        })
      ).toBe(1)

      await prisma.user.delete({ where: { id: userId } })
      expect(
        await prisma.liveQuiz.findUnique({ where: { id: liveQuizId } })
      ).toBeNull()
      expect(
        await prisma.assessmentAuditOutboxEvent.count({
          where: { eventId: emitted[0]?.eventId },
        })
      ).toBe(1)
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('retains scalar evidence after each referenced business entity is deleted', async () => {
    const input = {
      userId: randomUUID(),
      participantId: randomUUID(),
      courseId: randomUUID(),
      liveQuizId: randomUUID(),
    }
    const correlationId = randomUUID()

    try {
      await prisma.user.create({
        data: {
          id: input.userId,
          email: `audit-${input.userId}@example.invalid`,
          shortname: `audit-${input.userId}`,
        },
      })
      await prisma.course.create({
        data: {
          id: input.courseId,
          ownerId: input.userId,
          name: 'synthetic-audit-course',
          displayName: 'Synthetic audit course',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2027-01-31T00:00:00.000Z'),
          groupDeadlineDate: new Date('2026-09-01T00:00:00.000Z'),
          authType: 'SSO',
          isAssessmentEnabled: true,
        },
      })
      await prisma.liveQuiz.create({
        data: {
          id: input.liveQuizId,
          ownerId: input.userId,
          courseId: input.courseId,
          name: 'synthetic-audit-assessment',
          displayName: 'Synthetic audit assessment',
          isAssessmentEnabled: true,
          pinCode: randomUUID(),
        },
      })
      await prisma.participant.create({
        data: {
          id: input.participantId,
          username: `audit-${input.participantId}`,
          password: 'synthetic-test-value',
        },
      })

      const [emitted] = await runInAuditTransaction(prisma, (_tx, auditTx) =>
        emitAuditEvents(
          auditTx,
          trustedContext(
            input.liveQuizId,
            input.userId,
            correlationId,
            input.courseId
          ),
          [
            {
              eventType: 'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
              producerOperationId: `${correlationId}:0`,
              scope: { participantId: input.participantId },
              payload: {
                subjectType: 'PARTICIPANT',
                subjectId: input.participantId,
                change: 'REMOVED',
                reasonCode: 'LECTURER_REMOVAL',
              },
            },
          ]
        )
      )
      if (emitted === undefined) {
        throw new Error('Expected one emitted audit event')
      }
      const expectEvidence = async () => {
        expect(
          await prisma.assessmentAuditOutboxEvent.count({
            where: { eventId: emitted.eventId },
          })
        ).toBe(1)
      }

      await prisma.liveQuiz.delete({ where: { id: input.liveQuizId } })
      await expectEvidence()
      await prisma.course.delete({ where: { id: input.courseId } })
      await expectEvidence()
      await prisma.participant.delete({
        where: { id: input.participantId },
      })
      await expectEvidence()
      await prisma.user.delete({ where: { id: input.userId } })
      await expectEvidence()
    } finally {
      await cleanupAssessmentGraph(input)
    }
  })

  it('rolls back the business mutation when evidence construction fails', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()

    try {
      await expect(
        runInAuditTransaction(prisma, async (tx, auditTx) => {
          await tx.liveQuiz.update({
            where: { id: liveQuizId },
            data: { status: 'PUBLISHED' },
          })
          await emitAuditEvents(
            auditTx,
            trustedContext(liveQuizId, userId, correlationId),
            [
              {
                eventType: 'ASSESSMENT_PUBLISHED',
                producerOperationId: `${correlationId}:0`,
                payload: {
                  fromState: 'DRAFT',
                  toState: 'PUBLISHED',
                  unexpected: true,
                } as never,
              },
            ]
          )
        })
      ).rejects.toThrow()

      expect(
        await prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuizId } })
      ).toMatchObject({ status: 'DRAFT' })
      expect(
        await prisma.assessmentAuditOutboxEvent.count({ where: { liveQuizId } })
      ).toBe(0)
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('accepts an identical retry once and rejects a conflicting retry', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()
    const context = trustedContext(liveQuizId, userId, correlationId)
    const producerOperationId = `${correlationId}:0`

    try {
      const emit = (fromState: 'DRAFT' | 'SCHEDULED') =>
        runInAuditTransaction(prisma, (_tx, auditTx) =>
          emitAuditEvents(auditTx, context, [
            {
              eventType: 'ASSESSMENT_PUBLISHED',
              producerOperationId,
              payload: { fromState, toState: 'PUBLISHED' },
            },
          ])
        )

      const first = await emit('DRAFT')
      expect(await emit('DRAFT')).toEqual(first)
      expect(
        await prisma.assessmentAuditOutboxEvent.count({ where: { liveQuizId } })
      ).toBe(1)
      await expect(emit('SCHEDULED')).rejects.toThrow('idempotency conflict')
      expect(
        await prisma.assessmentAuditOutboxEvent.count({ where: { liveQuizId } })
      ).toBe(1)
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('rejects duplicate identities inside one producer batch', async () => {
    const liveQuizId = randomUUID()
    const userId = randomUUID()
    const correlationId = randomUUID()
    const draft = {
      eventType: 'ASSESSMENT_STARTED' as const,
      producerOperationId: `${correlationId}:0`,
      payload: { fromState: 'PUBLISHED' as const, toState: 'RUNNING' as const },
    }

    await expect(
      runInAuditTransaction(prisma, (_tx, auditTx) =>
        emitAuditEvents(
          auditTx,
          trustedContext(liveQuizId, userId, correlationId),
          [draft, draft]
        )
      )
    ).rejects.toThrow('Duplicate audit identity')
    expect(
      await prisma.assessmentAuditOutboxEvent.count({ where: { liveQuizId } })
    ).toBe(0)
  })

  it('does not reclaim an active lease and reclaims it after expiry', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()

    try {
      await runInAuditTransaction(prisma, (_tx, auditTx) =>
        emitAuditEvents(
          auditTx,
          trustedContext(liveQuizId, userId, correlationId),
          [
            {
              eventType: 'ASSESSMENT_STARTED',
              producerOperationId: `${correlationId}:0`,
              payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
            },
          ]
        )
      )

      const firstClaimAt = new Date(Date.now() + 30_000)
      const first = await claimAuditOutboxEvents(
        prisma,
        'audit-test-worker-1',
        firstClaimAt
      )
      expect(first).toHaveLength(1)
      expect(
        await claimAuditOutboxEvents(
          prisma,
          'audit-test-worker-2',
          new Date(firstClaimAt.getTime() + AUDIT_OUTBOX_LEASE_MILLISECONDS - 1)
        )
      ).toHaveLength(0)

      const reclaimed = await claimAuditOutboxEvents(
        prisma,
        'audit-test-worker-2',
        new Date(firstClaimAt.getTime() + AUDIT_OUTBOX_LEASE_MILLISECONDS + 1)
      )
      expect(reclaimed).toHaveLength(1)
      expect(reclaimed[0]).toMatchObject({
        leaseOwner: 'audit-test-worker-2',
        attemptCount: 2,
      })
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('claims disjoint batches across concurrent workers', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()
    const drafts: AuditEventDraft<'ASSESSMENT_STARTED'>[] = Array.from(
      { length: 101 },
      (_, index) => ({
        eventType: 'ASSESSMENT_STARTED',
        producerOperationId: `${correlationId}:${index}`,
        payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
      })
    )

    try {
      await runInAuditTransaction(prisma, (_tx, auditTx) =>
        emitAuditEvents(
          auditTx,
          trustedContext(liveQuizId, userId, correlationId),
          drafts
        )
      )

      const claimAt = new Date(Date.now() + 30_000)
      const [left, right] = await Promise.all([
        claimAuditOutboxEvents(prisma, 'audit-concurrent-worker-1', claimAt),
        claimAuditOutboxEvents(prisma, 'audit-concurrent-worker-2', claimAt),
      ])
      const leftIds = new Set(left.map((event) => event.eventId))
      const rightIds = new Set(right.map((event) => event.eventId))

      expect(left.length + right.length).toBe(101)
      expect([...leftIds].filter((id) => rightIds.has(id))).toEqual([])
      expect(Math.max(left.length, right.length)).toBeLessThanOrEqual(100)
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('enforces outbox state checks and contains no business foreign keys', async () => {
    const { userId, liveQuizId } = await createSyntheticLiveQuiz()
    const correlationId = randomUUID()

    try {
      await runInAuditTransaction(prisma, (_tx, auditTx) =>
        emitAuditEvents(
          auditTx,
          trustedContext(liveQuizId, userId, correlationId),
          [
            {
              eventType: 'ASSESSMENT_STARTED',
              producerOperationId: `${correlationId}:0`,
              payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
            },
          ]
        )
      )
      const [leased] = await claimAuditOutboxEvents(
        prisma,
        'audit-constraint-worker',
        new Date(Date.now() + 30_000)
      )
      if (leased === undefined) {
        throw new Error('Expected the synthetic event to be leased')
      }

      await expect(
        prisma.assessmentAuditOutboxEvent.update({
          where: { eventId: leased.eventId },
          data: { deliveryState: 'PENDING' },
        })
      ).rejects.toThrow()

      await expect(
        prisma.assessmentAuditOutboxEvent.update({
          where: { eventId: leased.eventId },
          data: {
            deliveryState: 'DELIVERED_UNSEALED',
            leaseOwner: null,
            leaseExpiresAt: null,
            deliveredAt: new Date('2026-08-11T07:59:59.000Z'),
          },
        })
      ).rejects.toThrow()

      const foreignKeys = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) AS count
        FROM information_schema.table_constraints
        WHERE
          constraint_type = 'FOREIGN KEY'
          AND table_name LIKE 'AssessmentAudit%'
      `
      expect(Number(foreignKeys[0]?.count)).toBe(0)
    } finally {
      await cleanup(userId, liveQuizId)
    }
  })

  it('enforces coverage, retention-anchor, and rollout accounting checks', async () => {
    const coveredQuizId = randomUUID()
    const terminalQuizId = randomUUID()
    const missingAnchorQuizId = randomUUID()
    const scanId = randomUUID()

    await expect(
      prisma.assessmentAuditScope.create({
        data: {
          liveQuizId: coveredQuizId,
          lifecycleEpoch: 0,
          coverageState: 'COVERED',
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.assessmentAuditScope.create({
        data: {
          liveQuizId: terminalQuizId,
          lifecycleEpoch: 0,
          coverageState: 'UNCOVERED',
          completedAt: new Date('2026-08-11T08:00:00.000Z'),
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.assessmentAuditScope.create({
        data: {
          liveQuizId: missingAnchorQuizId,
          lifecycleEpoch: 0,
          coverageState: 'EXCLUDED_TERMINAL',
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.assessmentAuditRolloutInventory.create({
        data: {
          scanId,
          liveQuizId: randomUUID(),
          observedAt: new Date('2026-08-11T08:00:00.000Z'),
          observedLifecycleState: 'COMPLETED',
          outcome: 'FAILED',
          rolloutEventId: randomUUID(),
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.assessmentAuditRolloutInventory.create({
        data: {
          scanId,
          liveQuizId: randomUUID(),
          observedAt: new Date('2026-08-11T08:00:00.000Z'),
          observedLifecycleState: 'DRAFT',
          outcome: 'ACTIVATED',
          stableReason: 'SHOULD_NOT_EXIST',
          rolloutEventId: randomUUID(),
        },
      })
    ).rejects.toThrow()
  })
})
