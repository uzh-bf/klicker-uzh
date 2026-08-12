import { randomUUID } from 'node:crypto'
import { parseCanonicalAuditEnvelope } from '@klicker-uzh/audit'
import { prisma } from '@klicker-uzh/prisma'
import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { AssessmentAuditMediaDependencies } from '../src/services/assessmentAuditActivation.js'
import {
  activateNewAssessmentAuditIfSelected,
  beginOrResumeAssessmentAuditRollout,
  discoverAssessmentAuditRolloutCandidates,
  processAssessmentAuditRolloutItem,
} from '../src/services/assessmentAuditRollout.js'

const noMedia: AssessmentAuditMediaDependencies = {
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

describe('assessment audit rollout', () => {
  let userIds: string[]
  let liveQuizIds: string[]

  beforeEach(() => {
    userIds = []
    liveQuizIds = []
  })

  afterEach(async () => {
    await prisma.assessmentAuditOutboxEvent.deleteMany({
      where: { liveQuizId: { in: liveQuizIds } },
    })
    await prisma.assessmentAuditRolloutInventory.deleteMany({
      where: { liveQuizId: { in: liveQuizIds } },
    })
    await prisma.assessmentAuditScope.deleteMany({
      where: { liveQuizId: { in: liveQuizIds } },
    })
    await prisma.liveQuiz.deleteMany({
      where: { id: { in: liveQuizIds } },
    })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function createAssessment(input?: {
    status?: PublicationStatus
    startedAt?: Date
    finishedAt?: Date
  }) {
    const userId = randomUUID()
    const liveQuizId = randomUUID()
    userIds.push(userId)
    liveQuizIds.push(liveQuizId)
    const identity = userId.replaceAll('-', '')
    await prisma.user.create({
      data: {
        id: userId,
        email: `rollout-${identity}@example.invalid`,
        shortname: `rollout-${identity}`,
      },
    })
    await prisma.liveQuiz.create({
      data: {
        id: liveQuizId,
        name: `Assessment ${identity}`,
        displayName: `Assessment ${identity}`,
        ownerId: userId,
        isAssessmentEnabled: true,
        pinCode: identity.slice(0, 6).toUpperCase(),
        status: input?.status,
        startedAt: input?.startedAt,
        finishedAt: input?.finishedAt,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId }, prisma)
    return liveQuizId
  }

  it('accounts for nonterminal baselines and terminal exclusions', async () => {
    const draftId = await createAssessment()
    const terminalAt = new Date(Date.now() - 60_000)
    const endedId = await createAssessment({
      status: PublicationStatus.ENDED,
      startedAt: new Date(terminalAt.getTime() - 60_000),
      finishedAt: terminalAt,
    })
    const missingId = randomUUID()
    const scanId = randomUUID()
    const discovered = await discoverAssessmentAuditRolloutCandidates({
      client: prisma,
      liveQuizIds: [draftId, endedId, missingId],
    })
    const inventory = await beginOrResumeAssessmentAuditRollout({
      client: prisma,
      scanId,
      observedAt: new Date(),
      candidates: discovered.candidates,
    })

    for (const item of inventory) {
      const candidate = discovered.candidates.find(
        (value) => value.liveQuizId === item.liveQuizId
      )
      expect(candidate).toBeDefined()
      await processAssessmentAuditRolloutItem({
        client: prisma,
        candidate: candidate!,
        inventory: item,
        media: noMedia,
      })
    }

    expect(discovered.missingLiveQuizIds).toEqual([missingId])
    expect(
      await prisma.assessmentAuditRolloutInventory.findMany({
        where: { scanId },
        orderBy: { liveQuizId: 'asc' },
        select: {
          liveQuizId: true,
          outcome: true,
          stableReason: true,
          rolloutEventId: true,
        },
      })
    ).toEqual(
      expect.arrayContaining([
        {
          liveQuizId: draftId,
          outcome: 'ROLLOUT_BASELINED',
          stableReason: null,
          rolloutEventId: expect.any(String),
        },
        {
          liveQuizId: endedId,
          outcome: 'EXCLUDED_TERMINAL',
          stableReason: 'PRE_ROLLOUT_TERMINAL_STATE',
          rolloutEventId: expect.any(String),
        },
      ])
    )
    expect(
      await prisma.assessmentAuditScope.findMany({
        where: { liveQuizId: { in: [draftId, endedId] } },
        orderBy: [{ liveQuizId: 'asc' }, { lifecycleEpoch: 'asc' }],
        select: {
          liveQuizId: true,
          lifecycleEpoch: true,
          coverageState: true,
          retentionAnchorAt: true,
        },
      })
    ).toEqual(
      expect.arrayContaining([
        {
          liveQuizId: draftId,
          lifecycleEpoch: 1,
          coverageState: 'COVERED',
          retentionAnchorAt: null,
        },
        {
          liveQuizId: endedId,
          lifecycleEpoch: 0,
          coverageState: 'EXCLUDED_TERMINAL',
          retentionAnchorAt: terminalAt,
        },
      ])
    )
  })

  it('records a stable gap and resumes without duplicate evidence', async () => {
    const liveQuizId = await createAssessment()
    const scanId = randomUUID()
    const observedAt = new Date()
    const initial = await discoverAssessmentAuditRolloutCandidates({
      client: prisma,
      liveQuizIds: [liveQuizId],
    })
    const [item] = await beginOrResumeAssessmentAuditRollout({
      client: prisma,
      scanId,
      observedAt,
      candidates: initial.candidates,
    })
    expect(item).toBeDefined()
    await prisma.liveQuiz.update({
      where: { id: liveQuizId },
      data: { status: PublicationStatus.SCHEDULED },
    })
    const changed = await discoverAssessmentAuditRolloutCandidates({
      client: prisma,
      liveQuizIds: [liveQuizId],
    })
    const candidate = changed.candidates[0]
    expect(candidate).toBeDefined()

    expect(
      await processAssessmentAuditRolloutItem({
        client: prisma,
        candidate: candidate!,
        inventory: item!,
        media: noMedia,
      })
    ).toBe('FAILED')
    const eventCount = await prisma.assessmentAuditOutboxEvent.count({
      where: { liveQuizId },
    })
    const resumed = await beginOrResumeAssessmentAuditRollout({
      client: prisma,
      scanId,
      observedAt: new Date(observedAt.getTime() + 60_000),
      candidates: changed.candidates,
    })
    expect(resumed).toHaveLength(1)
    expect(
      await processAssessmentAuditRolloutItem({
        client: prisma,
        candidate: candidate!,
        inventory: resumed[0]!,
        media: noMedia,
      })
    ).toBe('FAILED')

    const inventory =
      await prisma.assessmentAuditRolloutInventory.findUniqueOrThrow({
        where: { scanId_liveQuizId: { scanId, liveQuizId } },
      })
    const event = await prisma.assessmentAuditOutboxEvent.findUniqueOrThrow({
      where: { eventId: inventory.rolloutEventId! },
    })
    const envelope = parseCanonicalAuditEnvelope(event.canonicalEnvelope)
    expect(inventory).toMatchObject({
      outcome: 'FAILED',
      stableReason: 'ASSESSMENT_CHANGED_DURING_ROLLOUT',
    })
    expect(envelope.payload).toMatchObject({
      outcome: 'FAILED',
      coverageState: 'UNCOVERED',
      reasonCode: 'ASSESSMENT_CHANGED_DURING_ROLLOUT',
    })
    expect(
      await prisma.assessmentAuditOutboxEvent.count({
        where: { liveQuizId },
      })
    ).toBe(eventCount)
  })

  it('uses a creation baseline only for newly created all-mode assessments', async () => {
    const liveQuizId = await createAssessment()
    const previousMode = process.env.ASSESSMENT_AUDIT_ROLLOUT
    process.env.ASSESSMENT_AUDIT_ROLLOUT = 'all'
    try {
      expect(
        await activateNewAssessmentAuditIfSelected({
          client: prisma,
          liveQuizId,
          media: noMedia,
        })
      ).toBe('ACTIVATED')
    } finally {
      if (previousMode === undefined) {
        delete process.env.ASSESSMENT_AUDIT_ROLLOUT
      } else {
        process.env.ASSESSMENT_AUDIT_ROLLOUT = previousMode
      }
    }

    expect(
      await prisma.assessmentAuditScope.findFirstOrThrow({
        where: { liveQuizId },
      })
    ).toMatchObject({
      lifecycleEpoch: 1,
      coverageState: 'COVERED',
      baselineKind: 'CREATION',
    })
    expect(
      await prisma.assessmentAuditRolloutInventory.findFirstOrThrow({
        where: { liveQuizId },
      })
    ).toMatchObject({ outcome: 'ACTIVATED', stableReason: null })
  })
})
