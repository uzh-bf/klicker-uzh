import { randomUUID } from 'node:crypto'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  emitAuditEvents,
  PrismaAuditSealRepository,
  runInAuditTransaction,
} from '../src/index.js'

beforeAll(async () => {
  await requireDisposableDatabase(prisma)
})
afterAll(async () => {
  await prisma.$disconnect()
})

it('only transitions matching delivered evidence, survives replay, and rejects altered outbox bytes', async () => {
  const liveQuizId = randomUUID()
  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: '2026-09-28T10:00:00.000Z',
    recordedAt: '2026-09-28T10:00:00.000Z',
    actor: { kind: 'USER', userId: randomUUID() },
    authorization: {
      decision: 'ALLOWED',
      authScope: 'LECTURER',
      requiredPermission: 'LIVE_QUIZ_WRITE',
      resolvedObjectScope: { type: 'LIVE_QUIZ', id: liveQuizId },
    },
    scope: { liveQuizId, lifecycleEpoch: 1 },
    correlationId: randomUUID(),
  })
  const draft = {
    eventType: 'ASSESSMENT_STARTED' as const,
    producerOperationId: randomUUID(),
    outcome: 'SUCCEEDED' as const,
    payload: { fromState: 'PUBLISHED' as const, toState: 'RUNNING' as const },
  }
  const record = createCanonicalAuditEvent(context, draft)
  const evidence = {
    envelope: record.envelope,
    canonicalEnvelope: record.canonicalEnvelope,
    status: 'VERIFIED' as const,
    sealStatus: 'UNSEALED' as const,
  }
  const repository = new PrismaAuditSealRepository(prisma)
  const sealedAt = new Date('2026-09-28T10:05:00.000Z')
  try {
    await runInAuditTransaction(prisma, (_, tx) =>
      emitAuditEvents(tx, context, [draft])
    )
    expect(await repository.listQuizIds()).toContain(liveQuizId)
    expect(await repository.markSealed([evidence], sealedAt)).toBe(0)
    await prisma.assessmentAuditOutboxEvent.update({
      where: { eventId: record.envelope.eventId },
      data: {
        deliveryState: 'DELIVERED_UNSEALED',
        deliveredAt: new Date('2026-09-28T10:06:00.000Z'),
      },
    })
    expect(await repository.markSealed([evidence], sealedAt)).toBe(0)
    await prisma.assessmentAuditOutboxEvent.update({
      where: { eventId: record.envelope.eventId },
      data: { deliveredAt: new Date('2026-09-28T10:01:00.000Z') },
    })
    const counts = await Promise.all([
      repository.markSealed([evidence], sealedAt),
      repository.markSealed([evidence], sealedAt),
    ])
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1)
    expect(
      await prisma.assessmentAuditOutboxEvent.findUnique({
        where: { eventId: record.envelope.eventId },
      })
    ).toMatchObject({ deliveryState: 'SEALED', sealedAt })
    expect(await repository.markSealed([evidence], sealedAt)).toBe(0)
    await expect(
      repository.markSealed(
        [{ ...evidence, canonicalEnvelope: `${evidence.canonicalEnvelope} ` }],
        sealedAt
      )
    ).rejects.toThrow('Outbox differs')
  } finally {
    await prisma.assessmentAuditOutboxEvent.deleteMany({
      where: { liveQuizId },
    })
  }
})
