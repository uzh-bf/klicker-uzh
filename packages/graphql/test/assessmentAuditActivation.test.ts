import { randomUUID } from 'node:crypto'
import { type EventType, runInAuditTransaction } from '@klicker-uzh/audit'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import {
  persistPreparedAssessmentAuditActivation,
  persistPreparedAssessmentAuditActivationInTransaction,
  prepareAssessmentAuditActivation,
  prepareReopeningAssessmentAuditActivation,
} from '../src/services/assessmentAuditActivation.js'
import {
  assessmentAuditUserOperation,
  emitCoveredAssessmentAuditEvents,
} from '../src/services/assessmentAuditProducers.js'

describe('assessment audit activation', () => {
  let userId: string
  let liveQuizId: string

  beforeEach(async () => {
    await requireDisposableDatabase(prisma)
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
    await requireDisposableDatabase(prisma)
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
      capturedAt,
      now: () => new Date(capturedAt.getTime() + 500),
    })
  }

  it('activates without media storage and emits an idempotent baseline', async () => {
    const content = '![Image](https://public.example.invalid/unavailable.png)'
    const element = await prisma.element.create({
      data: {
        ownerId: userId,
        name: 'Image content',
        type: 'CONTENT',
        content,
        options: {},
      },
    })
    await prisma.elementBlock.create({
      data: {
        liveQuizId,
        order: 0,
        elements: {
          create: {
            ownerId: userId,
            elementId: element.id,
            type: 'LIVE_QUIZ',
            elementType: 'CONTENT',
            order: 0,
            options: {},
            results: { total: 0 },
            anonymousResults: { total: 0 },
            elementData: processElementData(element),
          },
        },
      },
    })
    const prepared = await prepare()
    expect(
      prepared.parts.find((part) => part.content.kind === 'ELEMENT_INSTANCE')
        ?.content
    ).toMatchObject({ effectiveContent: { content } })
    expect(JSON.stringify(prepared.parts)).not.toContain('MEDIA_REFERENCE')
    expect(JSON.stringify(prepared.parts)).not.toContain('LIMITATION')
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
})
