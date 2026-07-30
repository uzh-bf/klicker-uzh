import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  ActivityLevel,
  AnalyticsType,
  CourseAuthType,
  LearningAnalyticsParticipationStatus,
  PerformanceLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  LEARNING_ANALYTICS_DISCLOSURE_VERSION,
  buildLearningAnalyticsChoiceData,
} from '../src/lib/learningAnalytics.js'
import { createParticipantAccount } from '../src/services/accounts.js'
import { joinCourseWithPin } from '../src/services/courses.js'
import {
  getOwnLearningAnalyticsChoice,
  setOwnLearningAnalyticsChoice,
} from '../src/services/participants.js'
describe('Learning analytics participant choice', () => {
  const originalRolloutFlag =
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED
  let prisma: PrismaClient
  let emitter: EventEmitter
  let ownerCtx: ContextWithUser

  beforeAll(async () => {
    prisma = prismaClient
    emitter = new EventEmitter()
    await prisma.$connect()
  })

  afterAll(async () => {
    if (typeof originalRolloutFlag === 'undefined') {
      delete process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED
    } else {
      process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED =
        originalRolloutFlag
    }
    await cleanup()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED = 'true'
    const owner = await prisma.user.create({
      data: {
        email: `la-choice-owner-${Date.now()}@example.com`,
        shortname: `la-owner-${Date.now()}`,
      },
    })
    ownerCtx = {
      prisma,
      emitter,
      user: {
        sub: owner.id,
        role: UserRole.USER,
        scope: UserLoginScope.ACCOUNT_OWNER,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as unknown as ContextWithUser
  })

  afterEach(cleanup)

  async function cleanup() {
    await prisma.course.deleteMany()
    await prisma.participant.deleteMany()
    await prisma.user.deleteMany()
  }

  async function createCourse() {
    return prisma.course.create({
      data: {
        name: `la-choice-course-${Date.now()}`,
        displayName: 'Learning analytics choice course',
        pinCode: Math.floor(Math.random() * 900000 + 100000),
        startDate: new Date(),
        endDate: new Date(Date.now() + 3_600_000),
        groupDeadlineDate: new Date(Date.now() + 3_600_000),
        authType: CourseAuthType.PIN,
        ownerId: ownerCtx.user.sub,
      },
    })
  }

  function participantContext(participantId: string): ContextWithUser {
    return {
      ...ownerCtx,
      user: {
        sub: participantId,
        role: UserRole.PARTICIPANT,
        scope: UserLoginScope.FULL_ACCESS,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    }
  }

  async function createParticipant(label: string) {
    return prisma.participant.create({
      data: {
        username: `la-choice-${label}-${Date.now()}`,
        password: 'unused',
      },
    })
  }

  it('requires a neutral choice for an enabled PIN join and keeps disabled joins undecided', async () => {
    const enabledCourse = await createCourse()
    await prisma.course.update({
      where: { id: enabledCourse.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    const enabledParticipant = await createParticipant('enabled')
    const enabledCtx = participantContext(enabledParticipant.id)

    await expect(
      joinCourseWithPin({ pin: enabledCourse.pinCode! }, enabledCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'LEARNING_ANALYTICS_CHOICE_REQUIRED' },
    })

    await expect(
      joinCourseWithPin(
        {
          pin: enabledCourse.pinCode!,
          learningAnalyticsStatus:
            LearningAnalyticsParticipationStatus.EXCLUDED,
        },
        enabledCtx
      )
    ).resolves.toMatchObject({ id: enabledParticipant.id })

    const enabledParticipation = await prisma.participation.findUniqueOrThrow({
      where: {
        courseId_participantId: {
          courseId: enabledCourse.id,
          participantId: enabledParticipant.id,
        },
      },
      include: { learningAnalyticsChoiceEvents: true },
    })
    expect(enabledParticipation).toMatchObject({
      learningAnalyticsStatus: LearningAnalyticsParticipationStatus.EXCLUDED,
      learningAnalyticsIncludedFrom: null,
      learningAnalyticsDisclosureVersion: LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    })
    expect(enabledParticipation.learningAnalyticsChoiceEvents).toHaveLength(1)

    const disabledCourse = await createCourse()
    const disabledParticipant = await createParticipant('disabled')
    await joinCourseWithPin(
      { pin: disabledCourse.pinCode! },
      participantContext(disabledParticipant.id)
    )

    await expect(
      prisma.participation.findUniqueOrThrow({
        where: {
          courseId_participantId: {
            courseId: disabledCourse.id,
            participantId: disabledParticipant.id,
          },
        },
      })
    ).resolves.toMatchObject({
      learningAnalyticsStatus: LearningAnalyticsParticipationStatus.UNDECIDED,
      learningAnalyticsChoiceAt: null,
    })
  })

  it('requires a neutral choice before creating an account for an enabled course', async () => {
    const course = await createCourse()
    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })

    await expect(
      createParticipantAccount(
        {
          email: 'la-choice-account@example.com',
          username: 'la-choice-account',
          password: 'unused-password',
          isProfilePublic: false,
          courseId: course.id,
        },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LEARNING_ANALYTICS_CHOICE_REQUIRED' },
    })
    await expect(
      prisma.participant.count({
        where: { username: 'la-choice-account' },
      })
    ).resolves.toBe(0)
  })

  it('deletes participant-level analytics on opt-out but leaves aggregates unchanged', async () => {
    const course = await createCourse()
    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    const participant = await createParticipant('transition')
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        ...buildLearningAnalyticsChoiceData(
          LearningAnalyticsParticipationStatus.INCLUDED
        ),
      },
    })
    const ctx = participantContext(participant.id)
    const initialIncludedFrom = participation.learningAnalyticsIncludedFrom!
    const timestamp = new Date('2026-07-01T00:00:00.000Z')
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'LA participant deletion quiz',
        displayName: 'LA participant deletion quiz',
        ownerId: ownerCtx.user.sub,
        courseId: course.id,
      },
    })

    await prisma.participantAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        trialsCount: 1,
        responseCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        meanCorrectCount: 1,
        meanPartialCorrectCount: 0,
        meanWrongCount: 0,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await prisma.participantActivityPerformance.create({
      data: {
        totalScore: 1,
        completion: 1,
        participantId: participant.id,
        practiceQuizId: practiceQuiz.id,
      },
    })
    await prisma.participantCourseAnalytics.create({
      data: {
        activeWeeks: 1,
        activeDaysPerWeek: 1,
        meanElementsPerDay: 1,
        activityLevel: ActivityLevel.HIGH,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await prisma.participantPerformance.create({
      data: {
        firstErrorRate: 0,
        firstPerformance: PerformanceLevel.HIGH,
        lastErrorRate: 0,
        lastPerformance: PerformanceLevel.HIGH,
        totalErrorRate: 0,
        totalPerformance: PerformanceLevel.HIGH,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await prisma.aggregatedAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        responseCount: 1,
        participantCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        totalElementsAvailable: 1,
        courseId: course.id,
      },
    })

    await setOwnLearningAnalyticsChoice(
      {
        courseId: course.id,
        status: LearningAnalyticsParticipationStatus.EXCLUDED,
      },
      ctx
    )

    await expect(
      Promise.all([
        prisma.participantAnalytics.count({
          where: { courseId: course.id, participantId: participant.id },
        }),
        prisma.participantCourseAnalytics.count({
          where: { courseId: course.id, participantId: participant.id },
        }),
        prisma.participantPerformance.count({
          where: { courseId: course.id, participantId: participant.id },
        }),
        prisma.participantActivityPerformance.count({
          where: {
            participantId: participant.id,
            practiceQuizId: practiceQuiz.id,
          },
        }),
      ])
    ).resolves.toEqual([0, 0, 0, 0])
    await expect(
      prisma.aggregatedAnalytics.count({ where: { courseId: course.id } })
    ).resolves.toBe(1)

    const afterExclusion = await prisma.participation.findUniqueOrThrow({
      where: { id: participation.id },
      include: { learningAnalyticsChoiceEvents: true },
    })
    expect(afterExclusion).toMatchObject({
      learningAnalyticsStatus: LearningAnalyticsParticipationStatus.EXCLUDED,
      learningAnalyticsIncludedFrom: null,
    })
    expect(afterExclusion.learningAnalyticsChoiceEvents).toHaveLength(2)

    await prisma.participantAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        trialsCount: 1,
        responseCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        meanCorrectCount: 1,
        meanPartialCorrectCount: 0,
        meanWrongCount: 0,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await setOwnLearningAnalyticsChoice(
      {
        courseId: course.id,
        status: LearningAnalyticsParticipationStatus.EXCLUDED,
      },
      ctx
    )
    await expect(
      prisma.participantAnalytics.count({
        where: { courseId: course.id, participantId: participant.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.learningAnalyticsChoiceEvent.count({
        where: { participationId: participation.id },
      })
    ).resolves.toBe(2)

    await new Promise((resolve) => setTimeout(resolve, 5))
    await setOwnLearningAnalyticsChoice(
      {
        courseId: course.id,
        status: LearningAnalyticsParticipationStatus.INCLUDED,
      },
      ctx
    )
    const afterReinclusion = await prisma.participation.findUniqueOrThrow({
      where: { id: participation.id },
      include: { learningAnalyticsChoiceEvents: true },
    })
    expect(
      afterReinclusion.learningAnalyticsIncludedFrom!.getTime()
    ).toBeGreaterThan(initialIncludedFrom.getTime())
    expect(afterReinclusion.learningAnalyticsChoiceEvents).toHaveLength(3)

    await setOwnLearningAnalyticsChoice(
      {
        courseId: course.id,
        status: LearningAnalyticsParticipationStatus.INCLUDED,
      },
      ctx
    )
    const afterNoop = await prisma.participation.findUniqueOrThrow({
      where: { id: participation.id },
      include: { learningAnalyticsChoiceEvents: true },
    })
    expect(afterNoop.learningAnalyticsIncludedFrom).toEqual(
      afterReinclusion.learningAnalyticsIncludedFrom
    )
    expect(afterNoop.learningAnalyticsChoiceEvents).toHaveLength(3)
  })

  it('hides the choice while the course is disabled and preserves it for re-enablement', async () => {
    const course = await createCourse()
    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    const participant = await createParticipant('course-toggle')
    await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        ...buildLearningAnalyticsChoiceData(
          LearningAnalyticsParticipationStatus.INCLUDED
        ),
      },
    })
    const ctx = participantContext(participant.id)

    await expect(
      getOwnLearningAnalyticsChoice({ courseId: course.id }, ctx)
    ).resolves.toMatchObject({
      status: LearningAnalyticsParticipationStatus.INCLUDED,
      isCurrent: true,
    })

    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: false },
    })
    await expect(
      getOwnLearningAnalyticsChoice({ courseId: course.id }, ctx)
    ).resolves.toBeNull()
    await expect(
      setOwnLearningAnalyticsChoice(
        {
          courseId: course.id,
          status: LearningAnalyticsParticipationStatus.EXCLUDED,
        },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LEARNING_ANALYTICS_NOT_ENABLED_FOR_COURSE',
      },
    })

    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    await expect(
      getOwnLearningAnalyticsChoice({ courseId: course.id }, ctx)
    ).resolves.toMatchObject({
      status: LearningAnalyticsParticipationStatus.INCLUDED,
      isCurrent: true,
    })
  })

  it('requires a fresh choice after a disclosure change and resets inclusion time', async () => {
    const course = await createCourse()
    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    const participant = await createParticipant('disclosure')
    const oldIncludedFrom = new Date('2026-01-01T00:00:00.000Z')
    await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        learningAnalyticsStatus: LearningAnalyticsParticipationStatus.INCLUDED,
        learningAnalyticsIncludedFrom: oldIncludedFrom,
        learningAnalyticsChoiceAt: oldIncludedFrom,
        learningAnalyticsDisclosureVersion: 'superseded-version',
        learningAnalyticsChoiceEvents: {
          create: {
            status: LearningAnalyticsParticipationStatus.INCLUDED,
            includedFrom: oldIncludedFrom,
            disclosureVersion: 'superseded-version',
          },
        },
      },
    })
    const ctx = participantContext(participant.id)
    const timestamp = new Date('2026-07-01T00:00:00.000Z')
    await prisma.participantAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        trialsCount: 1,
        responseCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        meanCorrectCount: 1,
        meanPartialCorrectCount: 0,
        meanWrongCount: 0,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await prisma.aggregatedAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        responseCount: 1,
        participantCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        totalElementsAvailable: 1,
        courseId: course.id,
      },
    })

    await expect(
      getOwnLearningAnalyticsChoice({ courseId: course.id }, ctx)
    ).resolves.toMatchObject({
      status: LearningAnalyticsParticipationStatus.INCLUDED,
      isCurrent: false,
    })
    await setOwnLearningAnalyticsChoice(
      {
        courseId: course.id,
        status: LearningAnalyticsParticipationStatus.INCLUDED,
      },
      ctx
    )

    const renewed = await prisma.participation.findUniqueOrThrow({
      where: {
        courseId_participantId: {
          courseId: course.id,
          participantId: participant.id,
        },
      },
      include: { learningAnalyticsChoiceEvents: true },
    })
    expect(renewed.learningAnalyticsIncludedFrom!.getTime()).toBeGreaterThan(
      oldIncludedFrom.getTime()
    )
    expect(renewed.learningAnalyticsDisclosureVersion).toBe(
      LEARNING_ANALYTICS_DISCLOSURE_VERSION
    )
    expect(renewed.learningAnalyticsChoiceEvents).toHaveLength(2)
    await expect(
      prisma.participantAnalytics.count({
        where: { courseId: course.id, participantId: participant.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.aggregatedAnalytics.count({ where: { courseId: course.id } })
    ).resolves.toBe(1)
  })
})
