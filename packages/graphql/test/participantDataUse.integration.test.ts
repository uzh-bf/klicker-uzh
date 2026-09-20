import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  LEARNING_ANALYTICS_ADVISORY_LOCK,
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
} from '../src/lib/learningAnalytics.js'
import {
  completeParticipantDataUse,
  initialParticipantDataUseData,
  updateParticipantDataUseChoice,
  validateInitialParticipantDataUse,
} from '../src/services/participantAccountDataUse.js'
import { getParticipantDataUse } from '../src/services/participants.js'

const TEST_PREFIX = `participant-data-use-integration-${Date.now()}`
const fixtureIds = {
  participants: [] as string[],
}

function participantContext(participantId: string): ContextWithUser {
  return {
    prisma,
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function choiceInput(consent: boolean, expectedRevision: number) {
  return {
    consent,
    expectedRevision,
    disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  }
}

async function completeParticipant(
  participantId: string,
  choices: {
    researchConsent?: boolean
    learningAnalyticsConsent?: boolean
  } = {}
) {
  await requireDisposableDatabase(prisma)
  return completeParticipantDataUse(
    {
      expectedRevision: 0,
      disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      researchConsent: choices.researchConsent ?? false,
      learningAnalyticsConsent: choices.learningAnalyticsConsent ?? false,
      acknowledged: true,
    },
    participantContext(participantId)
  )
}

const completedRevision = 1

function defer() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function holdLearningAnalyticsWriterGate() {
  await requireDisposableDatabase(prisma)
  const acquired = defer()
  const release = defer()
  const transaction = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock_shared(
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.classId},
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
        )
      `
      acquired.resolve()
      await release.promise
    },
    { maxWait: 10_000, timeout: 20_000 }
  )

  await acquired.promise
  return {
    release: release.resolve,
    done: transaction,
  }
}

async function expectLearningAnalyticsWriterGateReleased() {
  await requireDisposableDatabase(prisma)
  const result = await prisma.$transaction(async (tx) => {
    return tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        ${LEARNING_ANALYTICS_ADVISORY_LOCK.classId},
        ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
      ) AS acquired
    `
  })
  expect(result[0]?.acquired).toBe(true)
}

async function createParticipant(label: string) {
  await requireDisposableDatabase(prisma)
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'integration-test-password',
    },
  })
  fixtureIds.participants.push(participant.id)
  return participant
}

describe('participant data-use PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
  })

  afterEach(async () => {
    await requireDisposableDatabase(prisma)
    if (fixtureIds.participants.length > 0) {
      await prisma.participant.deleteMany({
        where: { id: { in: fixtureIds.participants } },
      })
      fixtureIds.participants.length = 0
    }
  })

  afterAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$disconnect()
  })

  it('contains optional analytics reads before accessing stored derivatives', async () => {
    const {
      getCourseActivityAnalytics,
      getCourseWeeklyActivity,
      getCoursePerformanceAnalytics,
      getActivityAnalytics,
    } = await import('../src/services/analytics.js')
    const findUnique = vi.fn(() => {
      throw new Error('Unexpected derivative read')
    })
    const ctx = {
      prisma: {
        course: { findUnique },
        practiceQuiz: { findUnique },
        microLearning: { findUnique },
      },
      user: { sub: 'synthetic-lecturer', role: UserRole.USER },
    } as unknown as ContextWithUser
    for (const read of [
      getCourseActivityAnalytics,
      getCourseWeeklyActivity,
      getCoursePerformanceAnalytics,
    ]) {
      await expect(
        read({ courseId: 'synthetic-course' }, ctx)
      ).resolves.toBeNull()
    }
    await expect(
      getActivityAnalytics({ activityId: 'synthetic-activity' }, ctx)
    ).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('serializes a bounded renewal and settings cohort without losing audit revisions', async () => {
    const participants: Awaited<ReturnType<typeof createParticipant>>[] = []
    for (let index = 0; index < 20; index++) {
      participants.push(await createParticipant(`cohort-${index}`))
    }
    for (let offset = 0; offset < participants.length; offset += 5) {
      await Promise.all(
        participants.slice(offset, offset + 5).map(async (participant) => {
          const completed = await completeParticipant(participant.id)
          const updated = await updateParticipantDataUseChoice(
            'analytics',
            choiceInput(true, completed.dataUseRevision),
            participantContext(participant.id)
          )
          expect(updated.dataUseRevision).toBe(2)
          expect(updated.learningAnalyticsConsent).toBe(true)
          const events = await prisma.participantDataUseEvent.findMany({
            where: { participantId: participant.id },
            orderBy: { revision: 'asc' },
          })
          expect(events.map((event) => event.revision)).toEqual([1, 2])
        })
      )
    }
  }, 60_000)

  it('waits for the global LA lock and records only the current choice', async () => {
    const participant = await createParticipant('exclusive-lock')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const before = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      let settled = false
      const mutation = updateParticipantDataUseChoice(
        'analytics',
        choiceInput(true, completedRevision),
        ctx
      ).then((result) => {
        settled = true
        return result
      })

      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(settled).toBe(false)
      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })

      holder.release()
      const result = await mutation
      const after = await prisma.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS "now"
      `
      expect(result?.learningAnalyticsConsent).toBe(true)
      expect(result?.learningAnalyticsChoiceAt).toBeInstanceOf(Date)
      expect(result?.learningAnalyticsDisclosureVersion).toBe(
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
      )
      expect(
        result!.learningAnalyticsChoiceAt!.getTime()
      ).toBeGreaterThanOrEqual(before[0]!.now.getTime())
      expect(result!.learningAnalyticsChoiceAt!.getTime()).toBeLessThanOrEqual(
        after[0]!.now.getTime()
      )
      await holder.done
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  })

  it('maps a real lock timeout, rolls back, and releases the lock for the next mutation', async () => {
    const participant = await createParticipant('timeout')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      const startedAt = Date.now()

      const timedOut = updateParticipantDataUseChoice(
        'analytics',
        choiceInput(true, completedRevision),
        ctx
      )
      await expect(timedOut).rejects.toMatchObject({
        extensions: { code: 'PARTICIPANT_DATA_USE_LOCK_TIMEOUT' },
      })
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4_500)

      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })

      holder.release()
      await holder.done
      await expect(
        updateParticipantDataUseChoice(
          'analytics',
          choiceInput(true, completedRevision),
          ctx
        )
      ).resolves.toMatchObject({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  }, 15_000)

  it('persists the analytics withdrawal request with its recording audit event', async () => {
    const participant = await createParticipant('withdrawal-request')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id, {
      learningAnalyticsConsent: true,
    })

    await updateParticipantDataUseChoice(
      'analytics',
      choiceInput(false, completedRevision),
      ctx
    )

    const withdrawalRevision = completedRevision + 1
    await expect(
      prisma.participantDataUseEvent.findUnique({
        where: {
          participantId_revision: {
            participantId: participant.id,
            revision: withdrawalRevision,
          },
        },
      })
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      acknowledged: true,
    })
    await expect(
      prisma.participantAnalyticsWithdrawal.findUnique({
        where: {
          participantId_withdrawalRevision: {
            participantId: participant.id,
            withdrawalRevision,
          },
        },
      })
    ).resolves.toMatchObject({
      requestedAt: expect.any(Date),
      completedAt: null,
    })
  })

  it('creates an account and initial choices while the learning-analytics lock is held', async () => {
    const holder = await holdLearningAnalyticsWriterGate()
    const creation = prisma
      .$transaction(async (tx) => {
        const dataUse = await initialParticipantDataUseData(
          validateInitialParticipantDataUse({
            disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
            researchConsent: false,
            learningAnalyticsConsent: false,
            acknowledged: true,
          }),
          tx
        )
        return tx.participant.create({
          data: {
            username: `${TEST_PREFIX}-signup-while-locked`,
            password: 'integration-test-password',
            ...dataUse,
          },
        })
      })
      .then((participant) => {
        fixtureIds.participants.push(participant.id)
        return participant
      })
    try {
      const result = await Promise.race([
        creation,
        wait(1_000).then(() => null),
      ])
      expect(result).toMatchObject({
        dataUseRevision: 1,
        researchConsent: false,
        learningAnalyticsConsent: false,
        dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })
      if (!result) throw new Error('Account creation waited for analytics')
      await expect(
        prisma.participantDataUseEvent.count({
          where: { participantId: result.id },
        })
      ).resolves.toBe(1)
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
      await creation.catch(() => undefined)
    }
  }, 10_000)

  it('updates research consent while the learning-analytics lock is held', async () => {
    const participant = await createParticipant('research-while-locked')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    let researchMutation:
      | ReturnType<typeof updateParticipantDataUseChoice>
      | undefined
    try {
      researchMutation = updateParticipantDataUseChoice(
        'research',
        choiceInput(true, completedRevision),
        ctx
      )
      const result = await Promise.race([
        researchMutation,
        wait(1_000).then(() => null),
      ])

      expect(result).not.toBeNull()
      expect(result).toMatchObject({
        researchConsent: true,
        researchConsentChoiceAt: expect.any(Date),
        researchConsentDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })
      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
      })

      holder.release()
      await holder.done
      await researchMutation
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
      await researchMutation?.catch(() => undefined)
    }
  }, 10_000)

  it('repairs incomplete current metadata only through completion', async () => {
    const participant = await createParticipant('incomplete-metadata')
    const ctx = participantContext(participant.id)
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: null,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      },
    })

    await expect(
      updateParticipantDataUseChoice('analytics', choiceInput(true, 0), ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
    await expectLearningAnalyticsWriterGateReleased()

    await expect(
      completeParticipantDataUse(
        {
          expectedRevision: 0,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
          researchConsent: false,
          learningAnalyticsConsent: true,
          acknowledged: true,
        },
        ctx
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: expect.any(Date),
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: 1,
    })
    await expectLearningAnalyticsWriterGateReleased()
  })
})
