import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  type PrismaClient,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { v4 as uuid } from 'uuid'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  QUESTION_POOL_ELEMENT_TYPE_UNSUPPORTED_CODE,
  QUESTION_POOL_ELEMENT_VERSION_MISMATCH_CODE,
  requestQuestionPoolLabelPreview,
} from '../src/services/questionPoolLabelPreview.js'
import { initializePrisma } from './helpers.js'

const syntheticResponse = {
  choices: [{ ix: 0, selected: true }],
}

describe('Question pool label preview', () => {
  let prisma: PrismaClient
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  const userIds: string[] = []
  const participantIds: string[] = []

  beforeAll(async () => {
    prisma = (await initializePrisma()).prisma
  })
  afterAll(async () => await prisma.$disconnect())

  beforeEach(async () => {
    const contexts = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const id = uuid()
        const user = await prisma.user.create({
          data: { id, email: id + '@example.invalid', shortname: id },
        })
        userIds.push(user.id)
        return { prisma, user: { sub: user.id } } as ContextWithUser
      })
    )
    ;[userOneCtx, userTwoCtx, userThreeCtx] = contexts as [
      ContextWithUser,
      ContextWithUser,
      ContextWithUser,
    ]
  })

  afterEach(async () => {
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    participantIds.length = 0
    userIds.length = 0
  })

  async function createCourse(ownerId: string, name: string) {
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const course = await prisma.course.create({
      data: {
        name,
        displayName: name,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate,
        groupDeadlineDate: endDate,
        authType: CourseAuthType.PIN,
        ownerId,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    return course
  }

  async function createElement({
    ownerId,
    type = ElementType.SC,
  }: {
    ownerId: string
    type?: ElementType
  }) {
    const element = await prisma.element.create({
      data: {
        name: `Synthetic ${type} item`,
        content: 'Which synthetic statement is true?',
        type,
        ownerId,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          choices: [
            { ix: 0, value: 'Synthetic key', correct: true },
            { ix: 1, value: 'Synthetic distractor', correct: false },
          ],
        },
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    return element
  }

  function elementDataFor(
    element: Awaited<ReturnType<typeof createElement>>,
    overrides: {
      id?: string
      hasSampleSolution?: boolean
    } = {}
  ): ElementData {
    const data = processElementData(element)
    return {
      ...data,
      id: overrides.id ?? data.id,
      options: {
        ...data.options,
        ...(typeof overrides.hasSampleSolution === 'boolean'
          ? { hasSampleSolution: overrides.hasSampleSolution }
          : {}),
      },
    } as ElementData
  }

  async function createPracticeInstance({
    courseId,
    elementData,
    elementId,
    isDeleted = false,
    ownerId,
    stackCourseId = courseId,
  }: {
    courseId: string
    elementData: ElementData
    elementId: number
    isDeleted?: boolean
    ownerId: string
    stackCourseId?: string
  }) {
    const quiz = await prisma.practiceQuiz.create({
      data: {
        name: `Synthetic practice ${uuid()}`,
        displayName: 'Synthetic practice',
        courseId,
        isDeleted,
        ownerId,
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.PRACTICE_QUIZ,
            courseId: stackCourseId,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementId,
                elementType: ElementType.SC,
                options: {} as ElementInstanceOptions,
                elementData,
                results: getInitialInstanceResults(elementData),
                anonymousResults: getInitialInstanceResults(
                  elementData
                ) as ElementInstanceResults,
                ownerId,
              },
            },
          },
        },
      },
      include: { stacks: { include: { elements: true } } },
    })
    return { quiz, instance: quiz.stacks[0]!.elements[0]! }
  }

  async function createMicroLearningInstance({
    courseId,
    elementData,
    elementId,
    isDeleted = false,
    ownerId,
  }: {
    courseId: string
    elementData: ElementData
    elementId: number
    isDeleted?: boolean
    ownerId: string
  }) {
    const microLearning = await prisma.microLearning.create({
      data: {
        name: `Synthetic microlearning ${uuid()}`,
        displayName: 'Synthetic microlearning',
        courseId,
        isDeleted,
        ownerId,
        scheduledStartAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        scheduledEndAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.MICROLEARNING,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.MICROLEARNING,
                elementId,
                elementType: ElementType.SC,
                options: {} as ElementInstanceOptions,
                elementData,
                results: getInitialInstanceResults(elementData),
                anonymousResults: getInitialInstanceResults(
                  elementData
                ) as ElementInstanceResults,
                ownerId,
              },
            },
          },
        },
      },
      include: { stacks: { include: { elements: true } } },
    })
    return {
      microLearning,
      instance: microLearning.stacks[0]!.elements[0]!,
    }
  }

  async function createLiveInstance({
    courseId,
    elementData,
    elementId,
    isDeleted = false,
    ownerId,
  }: {
    courseId: string
    elementData: ElementData
    elementId: number
    isDeleted?: boolean
    ownerId: string
  }) {
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: `Synthetic live quiz ${uuid()}`,
        displayName: 'Synthetic live quiz',
        courseId,
        isDeleted,
        ownerId,
        blocks: {
          create: {
            order: 0,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.LIVE_QUIZ,
                elementId,
                elementType: ElementType.SC,
                options: {} as ElementInstanceOptions,
                elementData,
                results: getInitialInstanceResults(elementData),
                anonymousResults: getInitialInstanceResults(
                  elementData
                ) as ElementInstanceResults,
                ownerId,
              },
            },
          },
        },
      },
      include: {
        blocks: { include: { elements: true } },
      },
    })
    return { liveQuiz, instance: liveQuiz.blocks[0]!.elements[0]! }
  }

  async function createParticipant(courseId: string) {
    const participant = await prisma.participant.create({
      data: {
        username: `synthetic-${uuid()}`,
        password: 'synthetic',
        participations: { create: { courseId } },
      },
      include: { participations: true },
    })
    participantIds.push(participant.id)
    return participant
  }

  async function createQuestionResponse({
    correctness,
    courseId,
    instanceId,
    participationId,
    participantId,
    practiceQuizId,
    microLearningId,
    trialsCount = 1,
  }: {
    correctness: ResponseCorrectness
    courseId: string
    instanceId: number
    participationId: number
    participantId: string
    practiceQuizId?: string
    microLearningId?: string
    trialsCount?: number
  }) {
    await prisma.questionResponse.create({
      data: {
        trialsCount,
        averageTimeSpent: 1,
        firstResponse: syntheticResponse,
        lastResponse: syntheticResponse,
        firstResponseCorrectness: correctness,
        lastResponseCorrectness: correctness,
        courseId,
        participantId,
        participationId,
        elementInstanceId: instanceId,
        practiceQuizId,
        microLearningId,
      },
    })
  }

  async function createLiveResponse({
    correctness,
    courseId,
    instanceId,
    submissionTime,
    elementBlockExecution = 0,
    correctionOnly = false,
  }: {
    correctness: ResponseCorrectness
    courseId: string
    instanceId: number
    submissionTime: Date
    elementBlockExecution?: number
    correctionOnly?: boolean
  }) {
    const participant = await createParticipant(courseId)
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: submissionTime,
        response: correctionOnly ? undefined : syntheticResponse,
        correctness,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution,
        correctionOnly,
        instanceId,
        participantId: participant.id,
      },
    })
    return participant
  }

  it('scopes current scored first attempts to the selected course and activity parents', async () => {
    const course = await createCourse(userOneCtx.user.sub, 'Synthetic course A')
    const otherCourse = await createCourse(
      userOneCtx.user.sub,
      'Synthetic course B'
    )
    const element = await createElement({ ownerId: userOneCtx.user.sub })
    const currentData = elementDataFor(element)
    const outdatedData = elementDataFor(element, {
      id: `${element.id}-v${element.version - 1}`,
    })
    const ungradedData = elementDataFor(element, { hasSampleSolution: false })

    const practice = await createPracticeInstance({
      courseId: course.id,
      elementData: currentData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    const practiceCorrect = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: practice.instance.id,
      participationId: practiceCorrect.participations[0]!.id,
      participantId: practiceCorrect.id,
      practiceQuizId: practice.quiz.id,
    })
    const practiceWrong = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.WRONG,
      courseId: course.id,
      instanceId: practice.instance.id,
      participationId: practiceWrong.participations[0]!.id,
      participantId: practiceWrong.id,
      practiceQuizId: practice.quiz.id,
    })
    const unstarted = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: practice.instance.id,
      participationId: unstarted.participations[0]!.id,
      participantId: unstarted.id,
      practiceQuizId: practice.quiz.id,
      trialsCount: 0,
    })

    const otherCoursePractice = await createPracticeInstance({
      courseId: otherCourse.id,
      elementData: currentData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
      stackCourseId: course.id,
    })
    const otherCourseParticipant = await createParticipant(otherCourse.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: otherCourse.id,
      instanceId: otherCoursePractice.instance.id,
      participationId: otherCourseParticipant.participations[0]!.id,
      participantId: otherCourseParticipant.id,
      practiceQuizId: otherCoursePractice.quiz.id,
    })

    const outdatedPractice = await createPracticeInstance({
      courseId: course.id,
      elementData: outdatedData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    const outdatedParticipant = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: outdatedPractice.instance.id,
      participationId: outdatedParticipant.participations[0]!.id,
      participantId: outdatedParticipant.id,
      practiceQuizId: outdatedPractice.quiz.id,
    })

    const ungradedPractice = await createPracticeInstance({
      courseId: course.id,
      elementData: ungradedData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    const ungradedParticipant = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: ungradedPractice.instance.id,
      participationId: ungradedParticipant.participations[0]!.id,
      participantId: ungradedParticipant.id,
      practiceQuizId: ungradedPractice.quiz.id,
    })

    const microLearning = await createMicroLearningInstance({
      courseId: course.id,
      elementData: currentData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    const microCorrect = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: microLearning.instance.id,
      participationId: microCorrect.participations[0]!.id,
      participantId: microCorrect.id,
      microLearningId: microLearning.microLearning.id,
    })
    const microWrong = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.WRONG,
      courseId: course.id,
      instanceId: microLearning.instance.id,
      participationId: microWrong.participations[0]!.id,
      participantId: microWrong.id,
      microLearningId: microLearning.microLearning.id,
    })

    const deletedMicroLearning = await createMicroLearningInstance({
      courseId: course.id,
      elementData: currentData,
      elementId: element.id,
      isDeleted: true,
      ownerId: userOneCtx.user.sub,
    })
    const deletedMicroParticipant = await createParticipant(course.id)
    await createQuestionResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: deletedMicroLearning.instance.id,
      participationId: deletedMicroParticipant.participations[0]!.id,
      participantId: deletedMicroParticipant.id,
      microLearningId: deletedMicroLearning.microLearning.id,
    })

    const live = await createLiveInstance({
      courseId: course.id,
      elementData: currentData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    const liveFirstWrong = await createParticipant(course.id)
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date('2030-01-01T10:00:00.000Z'),
        response: syntheticResponse,
        correctness: ResponseCorrectness.WRONG,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution: 0,
        instanceId: live.instance.id,
        participantId: liveFirstWrong.id,
      },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date('2030-01-01T10:01:00.000Z'),
        response: syntheticResponse,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution: 1,
        instanceId: live.instance.id,
        participantId: liveFirstWrong.id,
      },
    })
    const liveFirstCorrect = await createParticipant(course.id)
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date('2030-01-01T11:00:00.000Z'),
        response: syntheticResponse,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution: 0,
        instanceId: live.instance.id,
        participantId: liveFirstCorrect.id,
      },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date('2030-01-01T11:01:00.000Z'),
        response: syntheticResponse,
        correctness: ResponseCorrectness.WRONG,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution: 1,
        instanceId: live.instance.id,
        participantId: liveFirstCorrect.id,
      },
    })
    await createLiveResponse({
      correctness: ResponseCorrectness.CORRECT,
      correctionOnly: true,
      courseId: course.id,
      instanceId: live.instance.id,
      submissionTime: new Date('2030-01-01T09:00:00.000Z'),
    })
    await createLiveResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: live.instance.id,
      submissionTime: new Date('2030-01-01T12:00:00.000Z'),
    })

    const otherCourseLive = await createLiveInstance({
      courseId: otherCourse.id,
      elementData: currentData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    await createLiveResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: otherCourse.id,
      instanceId: otherCourseLive.instance.id,
      submissionTime: new Date('2030-01-01T13:00:00.000Z'),
    })

    const deletedLive = await createLiveInstance({
      courseId: course.id,
      elementData: currentData,
      elementId: element.id,
      isDeleted: true,
      ownerId: userOneCtx.user.sub,
    })
    await createLiveResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: deletedLive.instance.id,
      submissionTime: new Date('2030-01-01T14:00:00.000Z'),
    })

    const outdatedLive = await createLiveInstance({
      courseId: course.id,
      elementData: outdatedData,
      elementId: element.id,
      ownerId: userOneCtx.user.sub,
    })
    await createLiveResponse({
      correctness: ResponseCorrectness.CORRECT,
      courseId: course.id,
      instanceId: outdatedLive.instance.id,
      submissionTime: new Date('2030-01-01T15:00:00.000Z'),
    })

    const labelQuestion = vi.fn(async () => null)
    const preview = await requestQuestionPoolLabelPreview(
      {
        courseId: course.id,
        elementId: element.id,
        elementVersion: element.version,
      },
      userOneCtx,
      { labelQuestion }
    )

    expect(preview.observed).toEqual({
      denominator: 7,
      fullCreditCount: 4,
      rate: 4 / 7,
      band: 3,
    })
    expect(preview.ai).toBeNull()
    expect(labelQuestion).toHaveBeenCalledWith({
      courseId: course.id,
      item: expect.objectContaining({
        format: 'SC',
        stem: element.content,
        graded: true,
      }),
    })

    const unavailable = await requestQuestionPoolLabelPreview(
      {
        courseId: course.id,
        elementId: element.id,
        elementVersion: element.version,
      },
      userOneCtx,
      {
        labelQuestion: async () => {
          throw new Error('Synthetic provider unavailable')
        },
      }
    )
    expect(unavailable.observed).toEqual(preview.observed)
    expect(unavailable.ai).toBeNull()
  })

  it('requires course admin and item read access', async () => {
    const course = await createCourse(userOneCtx.user.sub, 'Synthetic course')
    const element = await createElement({ ownerId: userOneCtx.user.sub })
    const labelQuestion = vi.fn(async () => null)

    await prisma.permission.create({
      data: {
        userId: userTwoCtx.user.sub,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    await expect(
      requestQuestionPoolLabelPreview(
        {
          courseId: course.id,
          elementId: element.id,
          elementVersion: element.version,
        },
        userTwoCtx,
        { labelQuestion }
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })

    await prisma.permission.create({
      data: {
        userId: userTwoCtx.user.sub,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    await expect(
      requestQuestionPoolLabelPreview(
        {
          courseId: course.id,
          elementId: element.id,
          elementVersion: element.version,
        },
        userTwoCtx,
        { labelQuestion }
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(labelQuestion).not.toHaveBeenCalled()
    await prisma.permission.updateMany({
      where: { userId: userTwoCtx.user.sub, courseId: course.id },
      data: { permissionLevel: PermissionLevel.ADMIN },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const allowed = await requestQuestionPoolLabelPreview(
      {
        courseId: course.id,
        elementId: element.id,
        elementVersion: element.version,
      },
      userTwoCtx,
      { labelQuestion }
    )
    expect(allowed).toEqual({
      elementVersion: element.version,
      observed: null,
      ai: null,
    })

    await prisma.permission.create({
      data: {
        userId: userThreeCtx.user.sub,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    await expect(
      requestQuestionPoolLabelPreview(
        {
          courseId: course.id,
          elementId: element.id,
          elementVersion: element.version,
        },
        userThreeCtx,
        { labelQuestion }
      )
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
  })

  it('rejects unsupported types and stale element revisions', async () => {
    const course = await createCourse(userOneCtx.user.sub, 'Synthetic course')
    const unsupported = await createElement({
      ownerId: userOneCtx.user.sub,
      type: ElementType.MC,
    })
    const supported = await createElement({ ownerId: userOneCtx.user.sub })

    await expect(
      requestQuestionPoolLabelPreview(
        {
          courseId: course.id,
          elementId: unsupported.id,
          elementVersion: unsupported.version,
        },
        userOneCtx,
        { labelQuestion: async () => null }
      )
    ).rejects.toMatchObject({
      extensions: { code: QUESTION_POOL_ELEMENT_TYPE_UNSUPPORTED_CODE },
    })

    await expect(
      requestQuestionPoolLabelPreview(
        {
          courseId: course.id,
          elementId: supported.id,
          elementVersion: supported.version + 1,
        },
        userOneCtx,
        { labelQuestion: async () => null }
      )
    ).rejects.toMatchObject({
      extensions: { code: QUESTION_POOL_ELEMENT_VERSION_MISMATCH_CODE },
    })
  })

  it('preserves raw labels when no course calibration is available', async () => {
    const course = await createCourse(userOneCtx.user.sub, 'Synthetic course')
    const element = await createElement({ ownerId: userOneCtx.user.sub })

    const preview = await requestQuestionPoolLabelPreview(
      {
        courseId: course.id,
        elementId: element.id,
        elementVersion: element.version,
      },
      userOneCtx,
      {
        labelQuestion: async () => ({
          rawRate: 0.61,
          rawBand: 3,
          calibratedRate: null,
          calibratedBand: null,
          bloom: 'understand',
        }),
      }
    )

    expect(preview.observed).toBeNull()
    expect(preview.ai).toEqual({
      rawRate: 0.61,
      rawBand: 3,
      calibratedRate: null,
      calibratedBand: null,
      bloom: 'understand',
    })
  })
})
