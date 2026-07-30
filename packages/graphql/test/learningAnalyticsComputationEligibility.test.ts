import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  LearningAnalyticsParticipationStatus,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { LEARNING_ANALYTICS_DISCLOSURE_VERSION } from '../src/lib/learningAnalytics.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
  getLearningAnalyticsExport,
} from '../src/services/analytics.js'

describe('Learning analytics computation eligibility', () => {
  const originalRolloutFlag =
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED
  let prisma: PrismaClient
  let ownerCtx: ContextWithUser

  beforeAll(async () => {
    prisma = prismaClient
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
        email: `la-computation-owner-${Date.now()}@example.com`,
        shortname: `la-computation-owner-${Date.now()}`,
      },
    })
    ownerCtx = {
      prisma,
      emitter: new EventEmitter(),
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

  it('excludes ineligible response details and feedback from direct aggregations', async () => {
    const course = await prisma.course.create({
      data: {
        name: `la-computation-course-${Date.now()}`,
        displayName: 'LA computation course',
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T23:59:59.999Z'),
        groupDeadlineDate: new Date('2026-08-01T00:00:00.000Z'),
        authType: CourseAuthType.PIN,
        pinCode: Math.floor(Math.random() * 900_000_000 + 100_000_000),
        isLearningAnalyticsEnabled: true,
        ownerId: ownerCtx.user.sub,
      },
    })
    const element = await prisma.element.create({
      data: {
        name: 'Synthetic SC element',
        content: 'Synthetic content',
        type: ElementType.SC,
        options: {
          choices: [
            { ix: 0, correct: true, value: 'Correct' },
            { ix: 1, correct: false, value: 'Wrong' },
          ],
        },
        ownerId: ownerCtx.user.sub,
      },
    })
    const freeTextElement = await prisma.element.create({
      data: {
        name: 'Synthetic free-text element',
        content: 'Synthetic free-text prompt',
        type: ElementType.FREE_TEXT,
        options: {},
        ownerId: ownerCtx.user.sub,
      },
    })
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Synthetic practice quiz',
        displayName: 'Synthetic practice quiz',
        ownerId: ownerCtx.user.sub,
        courseId: course.id,
        stacks: {
          create: {
            type: ElementStackType.PRACTICE_QUIZ,
            order: 0,
            elements: {
              create: {
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementType: ElementType.SC,
                order: 0,
                options: {},
                elementData: {
                  name: element.name,
                  type: element.type,
                  options: element.options,
                } as ElementData,
                results: {} as ElementInstanceResults,
                anonymousResults: {} as ElementInstanceResults,
                elementId: element.id,
                ownerId: ownerCtx.user.sub,
              },
            },
          },
        },
      },
      include: {
        stacks: { include: { elements: true } },
      },
    })
    const freeTextInstance = await prisma.elementInstance.create({
      data: {
        type: ElementInstanceType.PRACTICE_QUIZ,
        elementType: ElementType.FREE_TEXT,
        order: 1,
        options: {},
        elementData: {
          name: freeTextElement.name,
          type: freeTextElement.type,
          options: freeTextElement.options,
        } as ElementData,
        results: {} as ElementInstanceResults,
        anonymousResults: {} as ElementInstanceResults,
        elementId: freeTextElement.id,
        ownerId: ownerCtx.user.sub,
        elementStackId: practiceQuiz.stacks[0]!.id,
      },
    })
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.OWNER,
        userId: ownerCtx.user.sub,
        practiceQuizId: practiceQuiz.id,
      },
    })
    const instance = practiceQuiz.stacks[0]!.elements[0]!
    const responseAt = new Date('2026-07-30T10:00:00.000Z')

    const participants = await Promise.all(
      [
        ...Array.from({ length: 5 }, (_, index) => ({
          username: `la-direct-eligible-${index}-${course.id}`,
          status: LearningAnalyticsParticipationStatus.INCLUDED,
          includedFrom: new Date('2026-06-30T23:00:00.000Z'),
        })),
        {
          username: `la-direct-late-${course.id}`,
          status: LearningAnalyticsParticipationStatus.INCLUDED,
          includedFrom: new Date('2026-07-30T11:00:00.000Z'),
        },
        {
          username: `la-direct-excluded-${course.id}`,
          status: LearningAnalyticsParticipationStatus.EXCLUDED,
          includedFrom: null,
        },
      ].map((input) =>
        prisma.participant.create({
          data: {
            username: input.username,
            password: 'unused',
            participations: {
              create: {
                courseId: course.id,
                learningAnalyticsStatus: input.status,
                learningAnalyticsIncludedFrom: input.includedFrom,
                learningAnalyticsChoiceAt: responseAt,
                learningAnalyticsDisclosureVersion:
                  LEARNING_ANALYTICS_DISCLOSURE_VERSION,
              },
            },
          },
          include: { participations: true },
        })
      )
    )
    await Promise.all(
      participants.slice(0, 5).map((participant, index) =>
        prisma.participantActivityPerformance.create({
          data: {
            totalScore: 10 + index,
            completion: index === 0 ? 0.6 : 1,
            participantId: participant.id,
            practiceQuizId: practiceQuiz.id,
          },
        })
      )
    )

    await Promise.all(
      participants.flatMap((participant) => [
        prisma.questionResponseDetail.create({
          data: {
            score: 1,
            pointsAwarded: 1,
            xpAwarded: 1,
            timeSpent: 1,
            response: { choices: [{ ix: 0, selected: true }] },
            participantId: participant.id,
            participationId: participant.participations[0]!.id,
            elementInstanceId: instance.id,
            practiceQuizId: practiceQuiz.id,
            createdAt: responseAt,
          },
        }),
        prisma.elementFeedback.create({
          data: {
            upvote: true,
            participantId: participant.id,
            elementInstanceId: instance.id,
            elementId: element.id,
            createdAt: responseAt,
          },
        }),
        prisma.questionResponseDetail.create({
          data: {
            score: 1,
            pointsAwarded: 1,
            xpAwarded: 1,
            timeSpent: 1,
            response: { value: `sensitive-${participant.id}` },
            participantId: participant.id,
            participationId: participant.participations[0]!.id,
            elementInstanceId: freeTextInstance.id,
            practiceQuizId: practiceQuiz.id,
            createdAt: responseAt,
          },
        }),
        prisma.elementFeedback.create({
          data: {
            upvote: true,
            participantId: participant.id,
            elementInstanceId: freeTextInstance.id,
            elementId: freeTextElement.id,
            createdAt: responseAt,
          },
        }),
      ])
    )
    await prisma.instancePerformance.create({
      data: {
        responseCount: 5,
        averageTimeSpent: 1,
        totalErrorRate: 0,
        totalPartialRate: 0,
        totalCorrectRate: 1,
        instanceId: instance.id,
        courseId: course.id,
      },
    })
    await prisma.instancePerformance.create({
      data: {
        responseCount: 99,
        averageTimeSpent: 1,
        totalErrorRate: 0,
        totalPartialRate: 0,
        totalCorrectRate: 1,
        instanceId: freeTextInstance.id,
        courseId: course.id,
      },
    })
    await prisma.activityPerformance.create({
      data: {
        participantCount: 5,
        totalErrorRate: 0,
        totalPartialRate: 0,
        totalCorrectRate: 1,
        practiceQuizId: practiceQuiz.id,
        courseId: course.id,
      },
    })

    const activityAnalytics = await getActivityAnalytics(
      { activityId: practiceQuiz.id },
      ownerCtx
    )
    expect(activityAnalytics).toMatchObject({
      courseParticipants: 6,
      isSuppressed: false,
      activityQuizAnalytics: {
        participantCount: 5,
        numberOfAnswers: 5,
      },
      instanceQuizAnalytics: [
        {
          numberOfAnswers: 5,
          uniqueParticipants: 5,
          feedbackCount: 5,
          feedbackSuppressed: false,
        },
      ],
    })

    const coursePerformance = await getCoursePerformanceAnalytics(
      { courseId: course.id },
      ownerCtx
    )
    expect(coursePerformance).toMatchObject({
      totalParticipants: 6,
      isSuppressed: false,
      participantActivityPerformanceN: 5,
      instanceFeedbacks: [{ feedbackCount: 5, participantCount: 5 }],
    })
    expect(coursePerformance?.participantActivityPerformances).toHaveLength(5)
    expect(
      coursePerformance?.participantActivityPerformances.every(
        (row) =>
          /^Student [1-5]$/.test(row.studentLabel) &&
          row.coverage === 'COMPLETE'
      )
    ).toBe(true)
    expect(JSON.stringify(coursePerformance)).not.toMatch(
      /participantUsername|participantEmail|la-direct-eligible/i
    )

    const exportData = await getLearningAnalyticsExport(
      { courseId: course.id },
      ownerCtx
    )
    expect(exportData).toMatchObject({
      filename: 'learning-analytics.csv',
      effectiveN: 5,
      includesPartial: false,
    })
    expect(exportData?.content).toContain('coverage,complete_only')
    expect(exportData?.content).not.toMatch(
      /participantId|username|email|activityId|totalScore|sensitive/i
    )

    const courseActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ownerCtx
    )
    expect(courseActivity).toMatchObject({
      totalParticipants: 6,
      isSuppressed: false,
    })
  })
})
