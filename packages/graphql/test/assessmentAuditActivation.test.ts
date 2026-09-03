import { randomUUID } from 'node:crypto'
import {
  buildAssessmentBaselinePart,
  createTrustedAuditContext,
  type EventType,
  emitAuditEvents,
  runInAuditTransaction,
} from '@klicker-uzh/audit'
import { prisma } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { activeAssessmentMediaReferences } from '../src/services/assessmentAudit.js'
import {
  type AssessmentAuditMediaDependencies,
  persistPreparedAssessmentAuditActivation,
  persistPreparedAssessmentAuditActivationInTransaction,
  prepareAssessmentAuditActivation,
  prepareReopeningAssessmentAuditActivation,
} from '../src/services/assessmentAuditActivation.js'
import {
  assessmentAuditUserOperation,
  emitCoveredAssessmentAuditEvents,
} from '../src/services/assessmentAuditProducers.js'

const unavailableMedia: AssessmentAuditMediaDependencies = {
  allowedHosts: ['test.blob.core.windows.net'],
  source: {
    async open() {
      throw new Error('Test assessment has no media to capture')
    },
  },
  store: {
    async createFromFile() {
      throw new Error('Test assessment has no media to store')
    },
  },
}

describe('assessment audit activation', () => {
  let userId: string
  let liveQuizId: string

  beforeEach(async () => {
    userId = randomUUID()
    liveQuizId = randomUUID()
    const identity = userId.replaceAll('-', '')
    await prisma.user.create({
      data: {
        id: userId,
        email: `audit-${identity}@example.invalid`,
        shortname: `audit-${identity}`,
      },
    })
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        id: liveQuizId,
        name: `Assessment ${identity}`,
        displayName: `Assessment ${identity}`,
        ownerId: userId,
        isAssessmentEnabled: true,
        pinCode: identity.slice(0, 6).toUpperCase(),
      },
    })
    liveQuizId = liveQuiz.id
    await recomputeDerivedPermissions({ liveQuizId }, prisma)
  })

  afterEach(async () => {
    await prisma.assessmentAuditOutboxEvent.deleteMany({
      where: { liveQuizId },
    })
    await prisma.assessmentAuditRolloutInventory.deleteMany({
      where: { liveQuizId },
    })
    await prisma.assessmentAuditScope.deleteMany({ where: { liveQuizId } })
    await prisma.liveQuiz.deleteMany({ where: { id: liveQuizId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function prepare() {
    const capturedAt = new Date(Date.now() - 1_000)
    return prepareAssessmentAuditActivation({
      client: prisma,
      liveQuizId,
      baselineKind: 'CREATION',
      media: unavailableMedia,
      capturedAt,
      now: () => new Date(capturedAt.getTime() + 500),
    })
  }

  it('atomically activates coverage and emits an idempotent baseline', async () => {
    const prepared = await prepare()
    const input = {
      client: prisma,
      prepared,
      actor: { kind: 'USER' as const, userId },
      correlationId: randomUUID(),
    }

    const first = await persistPreparedAssessmentAuditActivation(input)
    const countAfterFirst = await prisma.assessmentAuditOutboxEvent.count({
      where: { liveQuizId },
    })
    const second = await persistPreparedAssessmentAuditActivation(input)

    const scope = await prisma.assessmentAuditScope.findUniqueOrThrow({
      where: {
        liveQuizId_lifecycleEpoch: { liveQuizId, lifecycleEpoch: 1 },
      },
    })
    const eventTypes = new Set<EventType>(
      (
        await prisma.assessmentAuditOutboxEvent.findMany({
          where: { liveQuizId },
          select: { eventType: true },
        })
      ).map((event) => event.eventType as EventType)
    )

    expect(scope).toMatchObject({
      coverageState: 'COVERED',
      baselineId: prepared.baselineId,
      baselineKind: 'CREATION',
    })
    expect(eventTypes).toEqual(
      new Set([
        'ASSESSMENT_BASELINE_ROOT_RECORDED',
        'ASSESSMENT_BASELINE_PART_RECORDED',
        'ASSESSMENT_AUDIT_ACTIVATED',
      ])
    )
    expect(second).toEqual(first)
    expect(
      await prisma.assessmentAuditOutboxEvent.count({
        where: { liveQuizId },
      })
    ).toBe(countAfterFirst)
  })

  it('rolls back coverage when the assessment changes after staging', async () => {
    const prepared = await prepare()
    await prisma.liveQuiz.update({
      where: { id: liveQuizId },
      data: { displayName: 'Changed after staging' },
    })

    await expect(
      persistPreparedAssessmentAuditActivation({
        client: prisma,
        prepared,
        actor: { kind: 'SYSTEM' },
        correlationId: randomUUID(),
      })
    ).rejects.toThrow('changed while its audit baseline was staged')
    expect(
      await prisma.assessmentAuditScope.findMany({
        where: { liveQuizId },
        select: { coverageState: true },
      })
    ).toEqual([{ coverageState: 'FAILED' }])
    expect(
      await prisma.assessmentAuditOutboxEvent.count({
        where: { liveQuizId },
      })
    ).toBe(0)
  })

  it('commits a reopening baseline with the reset state in one transaction', async () => {
    const finishedAt = new Date(Date.now() - 1_000)
    await prisma.liveQuiz.update({
      where: { id: liveQuizId },
      data: {
        status: 'ENDED',
        startedAt: new Date(finishedAt.getTime() - 60_000),
        finishedAt,
      },
    })
    const prepared = await prepareReopeningAssessmentAuditActivation({
      client: prisma,
      liveQuizId,
      media: unavailableMedia,
      capturedAt: new Date(finishedAt.getTime() + 500),
      now: () => new Date(finishedAt.getTime() + 750),
    })

    await runInAuditTransaction(prisma, async (tx, auditTx) => {
      await tx.liveQuiz.update({
        where: { id: liveQuizId },
        data: {
          status: 'DRAFT',
          startedAt: null,
          finishedAt: null,
          activeBlockId: null,
        },
      })
      await persistPreparedAssessmentAuditActivationInTransaction({
        tx,
        auditTx,
        prepared,
        actor: { kind: 'USER', userId },
        correlationId: randomUUID(),
      })
    })

    expect(
      await prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuizId } })
    ).toMatchObject({ status: 'DRAFT', finishedAt: null })
    expect(
      await prisma.assessmentAuditScope.findUniqueOrThrow({
        where: {
          liveQuizId_lifecycleEpoch: { liveQuizId, lifecycleEpoch: 1 },
        },
      })
    ).toMatchObject({
      coverageState: 'COVERED',
      baselineKind: 'REOPENING',
      baselineId: prepared.baselineId,
    })
  })

  it('rolls back the reset if its staged reopening baseline no longer matches', async () => {
    const finishedAt = new Date(Date.now() - 1_000)
    await prisma.liveQuiz.update({
      where: { id: liveQuizId },
      data: { status: 'ENDED', startedAt: finishedAt, finishedAt },
    })
    const prepared = await prepareReopeningAssessmentAuditActivation({
      client: prisma,
      liveQuizId,
      media: unavailableMedia,
    })

    await expect(
      runInAuditTransaction(prisma, async (tx, auditTx) => {
        await tx.liveQuiz.update({
          where: { id: liveQuizId },
          data: {
            status: 'DRAFT',
            displayName: 'Unexpected reset mutation',
            startedAt: null,
            finishedAt: null,
          },
        })
        await persistPreparedAssessmentAuditActivationInTransaction({
          tx,
          auditTx,
          prepared,
          actor: { kind: 'USER', userId },
          correlationId: randomUUID(),
        })
      })
    ).rejects.toThrow('changed while its audit baseline was staged')
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuizId } })
    ).toMatchObject({ status: 'ENDED', finishedAt })
    expect(
      await prisma.assessmentAuditScope.findMany({
        where: { liveQuizId },
        select: { coverageState: true },
      })
    ).toEqual([{ coverageState: 'ACTIVATING' }])
  })

  it('rolls back a covered business mutation when producer evidence is invalid', async () => {
    const baselineId = randomUUID()
    await prisma.assessmentAuditScope.create({
      data: {
        liveQuizId,
        lifecycleEpoch: 1,
        coverageState: 'COVERED',
        baselineId,
        baselineKind: 'CREATION',
        activatedAt: new Date(),
      },
    })
    const operation = assessmentAuditUserOperation({
      userId,
      requiredPermission: 'WRITE',
    })

    await expect(
      runInAuditTransaction(prisma, async (tx, auditTx) => {
        await tx.liveQuiz.update({
          where: { id: liveQuizId },
          data: { displayName: 'Must roll back' },
        })
        await emitCoveredAssessmentAuditEvents({
          tx,
          auditTx,
          liveQuizId,
          operation,
          drafts: [
            {
              eventType: 'ASSESSMENT_CONFIGURATION_CHANGED',
              producerOperationId: `${operation.correlationId}:invalid`,
              payload: {
                entityType: 'ASSESSMENT',
                entityId: liveQuizId,
                before: null,
                after: null,
              } as never,
            },
          ],
        })
      })
    ).rejects.toThrow()
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuizId } })
    ).toMatchObject({
      displayName: expect.not.stringMatching('Must roll back'),
    })
    expect(
      await prisma.assessmentAuditOutboxEvent.count({ where: { liveQuizId } })
    ).toBe(0)
  })

  it('streams each immutable media reference once for active-policy renewal', async () => {
    const baselineId = randomUUID()
    const mediaId = randomUUID()
    const contentHash = 'a'.repeat(64)
    const capturedAt = new Date(Date.now() - 1_000).toISOString()
    const part = buildAssessmentBaselinePart({
      baselineId,
      baselineKind: 'CREATION',
      capturedAt,
      content: {
        kind: 'MEDIA_REFERENCE',
        media: {
          mediaId,
          sourceUrl: `https://test.blob.core.windows.net/${userId}/image.png`,
          contentHash,
          byteLength: 42,
          mimeType: 'image/png',
          blobName: `sha256/${contentHash}`,
          sourceReferenceHash: 'b'.repeat(64),
        },
      },
    })

    await runInAuditTransaction(prisma, async (tx, auditTx) => {
      await tx.assessmentAuditScope.create({
        data: {
          liveQuizId,
          lifecycleEpoch: 1,
          coverageState: 'COVERED',
          baselineId,
          baselineKind: 'CREATION',
          activatedAt: new Date(capturedAt),
        },
      })
      const context = createTrustedAuditContext({
        recordedVia: 'TRANSACTIONAL_OUTBOX',
        receivedAt: capturedAt,
        actor: { kind: 'SYSTEM' },
        authorization: {
          decision: 'NOT_APPLICABLE',
          authScope: 'SYSTEM_ROLLOUT',
        },
        scope: { liveQuizId, lifecycleEpoch: 1 },
        correlationId: randomUUID(),
      })
      await emitAuditEvents(auditTx, context, [
        {
          eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
          producerOperationId: `${baselineId}:media:1`,
          payload: part,
        },
        {
          eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
          producerOperationId: `${baselineId}:media:2`,
          payload: part,
        },
      ])
    })

    const references: Array<{ blobName: string; contentHash: string }> = []
    for await (const reference of activeAssessmentMediaReferences(prisma)) {
      if (reference.contentHash === contentHash) references.push(reference)
    }
    expect(references).toEqual([
      { blobName: `sha256/${contentHash}`, contentHash },
    ])
  })
})
