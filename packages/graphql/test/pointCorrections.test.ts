import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementType,
  PermissionLevel,
  PointCorrectionType,
  PrismaClient,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { DisplayMode, ElementInstanceOptions } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import {} from 'src/ops.js'
import { ContextWithUser } from '../src/lib/context.js'
import { correctAssessmentPointsInstance } from '../src/services/courses.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Unit tests covering the creation of derived permissions for elements', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const {
      userOneCtx: ctx1,
      userTwoCtx: ctx2,
      userThreeCtx: ctx3,
      userFourCtx: ctx4,
    } = await testInitialization(prisma, hatchet, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
  })

  afterEach(async () => await testCleanup(prisma))

  async function seedLiveQuizWithResponses() {
    const SCQuestion = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Single Choice Question',
        content: 'What is the capital of Switzerland?',
        explanation: 'The capital of Switzerland is Bern.',
        options: {
          choices: [
            { ix: 0, value: 'Zurich', correct: false },
            { ix: 1, value: 'Bern', correct: true },
            { ix: 2, value: 'Geneva', correct: false },
            { ix: 3, value: 'Lucerne', correct: true },
          ],
          displayMode: DisplayMode.LIST,
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        basePoints: false,
        pointsMultiplier: 1,
        ownerId: userOneCtx.user.sub,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SCQuestion.id, userId: userOneCtx.user.sub },
      prisma
    )

    const MCQuestion = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'MC',
        name: 'Multiple Choice Question',
        content: 'What are the capitals of Switzerland?',
        explanation: 'The capital of Switzerland is Bern.',
        options: {
          choices: [
            { ix: 0, value: 'Zurich', correct: false },
            { ix: 1, value: 'Bern', correct: true },
            { ix: 2, value: 'Geneva', correct: false },
            { ix: 3, value: 'Lucerne', correct: true },
          ],
          displayMode: DisplayMode.LIST,
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        basePoints: true,
        pointsMultiplier: 2,
        ownerId: userOneCtx.user.sub,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: MCQuestion.id, userId: userOneCtx.user.sub },
      prisma
    )

    // create an assessment course
    const assessmentCourse = await prisma.course.create({
      data: {
        name: 'Assessment Course',
        displayName: 'Assessment Course',
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        authType: 'SSO',
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
        groupDeadlineDate: new Date(),
        owner: { connect: { id: userOneCtx.user.sub } },
      },
    })
    await recomputeDerivedPermissions(
      { courseId: assessmentCourse.id, userId: userOneCtx.user.sub },
      prisma
    )

    // create a live quiz with both questions
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        ownerId: userOneCtx.user.sub,
        pointsMultiplier: 1,
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        pinCode: 'D5G4HU',
        courseId: assessmentCourse.id,
        defaultPoints: 20,
        defaultCorrectPoints: 50,
        maxBonusPoints: 30,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: SCQuestion.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {
                      pointsMultiplier: 1,
                      basePoints: false,
                    } as ElementInstanceOptions,
                    elementData: processElementData(SCQuestion),
                    results: getInitialInstanceResults(
                      processElementData(SCQuestion)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(SCQuestion)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: MCQuestion.id,
                    elementType: ElementType.MC,
                    order: 1,
                    options: {
                      pointsMultiplier: 2,
                      basePoints: true,
                    } as ElementInstanceOptions,
                    elementData: processElementData(MCQuestion),
                    results: getInitialInstanceResults(
                      processElementData(MCQuestion)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(MCQuestion)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        blocks: { include: { elements: { orderBy: { order: 'asc' } } } },
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userOneCtx.user.sub },
      prisma
    )
    const instanceId1 = liveQuiz.blocks[0]!.elements[0]!.id
    const instanceId2 = liveQuiz.blocks[0]!.elements[1]!.id

    // share the course with users two, three, and four
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwoCtx.user.sub,
          courseId: assessmentCourse.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThreeCtx.user.sub,
          courseId: assessmentCourse.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFourCtx.user.sub,
          courseId: assessmentCourse.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ courseId: assessmentCourse.id }, prisma)

    // create participant 1 with a correct answer to both questions
    const participant1 = await prisma.participant.create({
      data: {
        id: '36a3b9cf-00eb-46f3-a701-b222b68d0386',
        username: 'participant1',
        password: 'participant1',
        participations: { create: [{ courseId: assessmentCourse.id }] },
      },
    })
    const p1Response1 = await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(),
        response: {
          choices: [
            { ix: 0, selected: false },
            { ix: 1, selected: true },
            { ix: 2, selected: false },
            { ix: 3, selected: false },
          ],
        },
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0, // no base points for this question
        correctnessPoints: 50,
        bonusPoints: 30,
        timeSpent: -1,
        elementBlockExecution: 0,
        instance: { connect: { id: instanceId1 } },
        participant: { connect: { id: participant1.id } },
      },
    })
    const p1Response2 = await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(),
        response: {
          choices: [
            { ix: 0, selected: false },
            { ix: 1, selected: true },
            { ix: 2, selected: false },
            { ix: 3, selected: false },
          ],
        },
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 20,
        correctnessPoints: 100,
        bonusPoints: 60,
        timeSpent: -1,
        elementBlockExecution: 0,
        instance: { connect: { id: instanceId2 } },
        participant: { connect: { id: participant1.id } },
      },
    })

    // create participant 2 with a partially correct answer to the first question and no answer to the second one
    const participant2 = await prisma.participant.create({
      data: {
        id: 'fbdc8107-0f7e-4b9b-9dc5-9268c99dc784',
        username: 'participant2',
        password: 'participant2',
        participations: { create: [{ courseId: assessmentCourse.id }] },
      },
    })
    const p2Response1 = await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(),
        response: {
          choices: [
            { ix: 0, selected: false },
            { ix: 1, selected: true },
            { ix: 2, selected: true },
            { ix: 3, selected: false },
          ],
        },
        correctness: ResponseCorrectness.PARTIAL, // correctness assumed to be 25%
        basePoints: 0, // no base points for this question
        correctnessPoints: 25,
        bonusPoints: 15,
        timeSpent: -1,
        elementBlockExecution: 0,
        instance: { connect: { id: instanceId1 } },
        participant: { connect: { id: participant2.id } },
      },
    })

    // create participant 3 with a course participation but no answers
    const participant3 = await prisma.participant.create({
      data: {
        id: '56409db9-4bba-425d-81f6-98864ca3daed',
        username: 'participant3',
        password: 'participant3',
        participations: { create: [{ courseId: assessmentCourse.id }] },
      },
    })

    return {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    }
  }

  // ! Instance Point Updates
  // #region
  it("[Instance Point Updates] Verify that the option of updating a single participant's points can only be chosen in combination with a participant ID", async () => {
    const { instanceId1 } = await seedLiveQuizWithResponses()

    const res = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
      },
      userOneCtx
    )
    expect(res).toBeNull()
  })

  it('[Instance Point Updates] Verify that not selecting any modification results in an early return', async () => {
    const { instanceId1, participant1 } = await seedLiveQuizWithResponses()

    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).toBeNull()

    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res3).toBeNull()

    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: null,
        awardCorrectnessPoints: null,
        awardBonusPoints: null,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res4).toBeNull()

    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: null,
        awardCorrectnessPoints: null,
        awardBonusPoints: null,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res5).toBeNull()

    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: null,
        awardCorrectnessPoints: null,
        awardBonusPoints: null,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res6).toBeNull()
  })

  it('[Instance Point Updates] Verify that awarding base points to a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // award base points to participant 1 for instance 1 (-> no change expected)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')

    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)

    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)

    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // award base points to participant 1 for instance 2 (-> no change expected)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // award base points to participant 2 for instance 1 (-> no change expected)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(true)
    expect(res3!.correctnessPoints).toBeNull()
    expect(res3!.bonusPoints).toBeNull()
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect(res3!.instance).not.toBeNull()
    expect(res3!.instance!.id).toBe(instanceId1)
    expect(res3!.instance!.elementData).not.toBeNull()
    expect(res3!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // award base points to participant 2 for instance 2 (-> creation of new response expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBe(true)
    expect(res4!.correctnessPoints).toBeNull()
    expect(res4!.bonusPoints).toBeNull()
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect(res4!.instance).not.toBeNull()
    expect(res4!.instance!.id).toBe(instanceId2)
    expect(res4!.instance!.elementData).not.toBeNull()
    expect(res4!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(20)
    expect(newResponse4!.correctnessPoints).toBe(0)
    expect(newResponse4!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award base points to participant 3 for instance 1 (-> creation of new response expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBe(true)
    expect(res5!.correctnessPoints).toBeNull()
    expect(res5!.bonusPoints).toBeNull()
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0) // question with base points deactivated
    expect(newResponse5!.correctnessPoints).toBe(0)
    expect(newResponse5!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // award base points to participant 3 for instance 2 (-> creation of new response expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBe(true)
    expect(res6!.correctnessPoints).toBeNull()
    expect(res6!.bonusPoints).toBeNull()
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(20)
    expect(newResponse6!.correctnessPoints).toBe(0)
    expect(newResponse6!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding correctness points to a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // award correctness points for participant 1 for instance 1 (-> no change expected)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')

    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)

    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)

    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 1 for instance 2 (-> no change expected)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 2 for instance 1 (-> increase to max expected with delta being credited)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBeNull()
    expect(res3!.correctnessPoints).toBe(true)
    expect(res3!.bonusPoints).toBeNull()
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')

    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)

    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)

    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // updated to max
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // delta of +25 awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 2 for instance 2 (-> creation of new response with max points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBeNull()
    expect(res4!.correctnessPoints).toBe(true)
    expect(res4!.bonusPoints).toBeNull()
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect(res4!.instance).not.toBeNull()
    expect(res4!.instance!.id).toBe(instanceId2)
    expect(res4!.instance!.elementData).not.toBeNull()
    expect(res4!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0)
    expect(newResponse4!.correctnessPoints).toBe(100) // max points
    expect(newResponse4!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // full 100 awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBeNull()
    expect(res5!.correctnessPoints).toBe(true)
    expect(res5!.bonusPoints).toBeNull()
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0) // question with base points deactivated
    expect(newResponse5!.correctnessPoints).toBe(50)
    expect(newResponse5!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 3 for instance 2 (-> creation of new response with max points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBeNull()
    expect(res6!.correctnessPoints).toBe(true)
    expect(res6!.bonusPoints).toBeNull()
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0) // awarding base points was not selected
    expect(newResponse6!.correctnessPoints).toBe(100) // max points
    expect(newResponse6!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding bonus points to a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // award bonus points for participant 1 for instance 1 (-> no change expected)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 1 for instance 2 (-> no change expected)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 2 for instance 1 (-> increase to max expected with delta being credited)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBeNull()
    expect(res3!.correctnessPoints).toBeNull()
    expect(res3!.bonusPoints).toBe(true)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25) // correctness points are not updated
    expect(updatedResponse3!.bonusPoints).toBe(30) // updated to max

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // delta of +15 awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 2 for instance 2 (-> creation of new response with max points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBeNull()
    expect(res4!.correctnessPoints).toBeNull()
    expect(res4!.bonusPoints).toBe(true)
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0) // awarding base points was not selected
    expect(newResponse4!.correctnessPoints).toBe(0)
    expect(newResponse4!.bonusPoints).toBe(60) // max points

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // full 60 awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBeNull()
    expect(res5!.correctnessPoints).toBeNull()
    expect(res5!.bonusPoints).toBe(true)
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0) // question with base points deactivated
    expect(newResponse5!.correctnessPoints).toBe(0)
    expect(newResponse5!.bonusPoints).toBe(30) // full bonus points are awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 3 for instance 2 (-> creation of new response with max points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBeNull()
    expect(res6!.correctnessPoints).toBeNull()
    expect(res6!.bonusPoints).toBe(true)
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0) // awarding base points was not selected
    expect(newResponse6!.correctnessPoints).toBe(0)
    expect(newResponse6!.bonusPoints).toBe(60) // max points

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // full 60 awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding all point types to a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // award all point types for participant 1 for instance 1 (-> increase to max expected with delta being credited)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // question with base points deactivated
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // award all point types for participant 1 for instance 2 (-> increase to max expected with delta being credited)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // award all point types for participant 2 for instance 1 (-> increase to max expected with delta being credited)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(true)
    expect(res3!.correctnessPoints).toBe(true)
    expect(res3!.bonusPoints).toBe(true)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // question with base points deactivated
    expect(updatedResponse3!.correctnessPoints).toBe(50) // correctness points are not updated
    expect(updatedResponse3!.bonusPoints).toBe(30) // updated to max

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // delta of +25 awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // delta of +15 awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // award all point types for participant 2 for instance 2 (-> creation of new response with max points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )

    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBe(true)
    expect(res4!.correctnessPoints).toBe(true)
    expect(res4!.bonusPoints).toBe(true)
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(20) // max points
    expect(newResponse4!.correctnessPoints).toBe(100) // max points
    expect(newResponse4!.bonusPoints).toBe(60) // max points

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // full 20 awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // full 100 awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // full 60 awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award all point types for participant 3 for instance 1 (-> creation of new response with max points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBe(true)
    expect(res5!.correctnessPoints).toBe(true)
    expect(res5!.bonusPoints).toBe(true)
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0) // question with base points deactivated
    expect(newResponse5!.correctnessPoints).toBe(50) // full correctness points are awarded
    expect(newResponse5!.bonusPoints).toBe(30) // full bonus points are awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // award all point types for participant 3 for instance 2 (-> creation of new response with max points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )

    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBe(true)
    expect(res6!.correctnessPoints).toBe(true)
    expect(res6!.bonusPoints).toBe(true)
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(20) // max points
    expect(newResponse6!.correctnessPoints).toBe(100) // max points
    expect(newResponse6!.bonusPoints).toBe(60) // max points

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // full 20 awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // full 100 awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // full 60 awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting base points from a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // deduct base points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()

    // verify response and applied correction
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // question with base points deactivated
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 1 for instance 2 (-> decrease to 0 expected with delta being deducted)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // decreased to 0
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // delta of -20 deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 2 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(false)
    expect(res3!.correctnessPoints).toBeNull()
    expect(res3!.bonusPoints).toBeNull()
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (no base points for this question)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 2 for instance 2 (-> creation of new response with 0 points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBe(false)
    expect(res4!.correctnessPoints).toBeNull()
    expect(res4!.bonusPoints).toBeNull()
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0) // decreased to 0
    expect(newResponse4!.correctnessPoints).toBe(0) // not set
    expect(newResponse4!.bonusPoints).toBe(0) // not set

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // nothing can be deducted if no base points were awarded before
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBe(false)
    expect(res5!.correctnessPoints).toBeNull()
    expect(res5!.bonusPoints).toBeNull()
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0) // question with base points deactivated
    expect(newResponse5!.correctnessPoints).toBe(0) // not set
    expect(newResponse5!.bonusPoints).toBe(0) // not set

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 3 for instance 2 (-> creation of new response with 0 points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBe(false)
    expect(res6!.correctnessPoints).toBeNull()
    expect(res6!.bonusPoints).toBeNull()
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0) // decreased to 0
    expect(newResponse6!.correctnessPoints).toBe(0) // not set
    expect(newResponse6!.bonusPoints).toBe(0) // not set

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0) // nothing can be deducted if no base points were awarded before
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting correctness points from a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // deduct correctness points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // question with base points deactivated
    expect(updatedResponse1!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // delta of -50 deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 1 for instance 2 (-> decrease to 0 expected with delta being deducted)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // delta of -100 deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 2 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBeNull()
    expect(res3!.correctnessPoints).toBe(false)
    expect(res3!.bonusPoints).toBeNull()
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (no base points for this question)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // delta of -25 deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 2 for instance 2 (-> creation of new response with 0 points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBeNull()
    expect(res4!.correctnessPoints).toBe(false)
    expect(res4!.bonusPoints).toBeNull()
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0) // decreased to 0
    expect(newResponse4!.correctnessPoints).toBe(0) // decreased to 0
    expect(newResponse4!.bonusPoints).toBe(0) // not set

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBeNull()
    expect(res5!.correctnessPoints).toBe(false)
    expect(res5!.bonusPoints).toBeNull()
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0)
    expect(newResponse5!.correctnessPoints).toBe(0) // decreased to 0
    expect(newResponse5!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 3 for instance 2 (-> creation of new response with 0 points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBeNull()
    expect(res6!.correctnessPoints).toBe(false)
    expect(res6!.bonusPoints).toBeNull()
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0)
    expect(newResponse6!.correctnessPoints).toBe(0) // set to 0
    expect(newResponse6!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting bonus points from a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // deduct bonus points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // question with base points deactivated
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // delta of -30 deducted

    // deduct bonus points for participant 1 for instance 2 (-> decrease to 0 expected with delta being deducted)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // delta of -60 deducted

    // deduct bonus points for participant 2 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBeNull()
    expect(res3!.correctnessPoints).toBeNull()
    expect(res3!.bonusPoints).toBe(false)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect(res3!.instance).not.toBeNull()
    expect(res3!.instance!.id).toBe(instanceId1)
    expect(res3!.instance!.elementData).not.toBeNull()
    expect(res3!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (no base points for this question)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // delta of -15 deducted

    // deduct bonus points for participant 2 for instance 2 (-> creation of new response with 0 points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBeNull()
    expect(res4!.correctnessPoints).toBeNull()
    expect(res4!.bonusPoints).toBe(false)
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0)
    expect(newResponse4!.correctnessPoints).toBe(0)
    expect(newResponse4!.bonusPoints).toBe(0) // set to 0

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded before

    // deduct bonus points for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBeNull()
    expect(res5!.correctnessPoints).toBeNull()
    expect(res5!.bonusPoints).toBe(false)
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0)
    expect(newResponse5!.correctnessPoints).toBe(0)
    expect(newResponse5!.bonusPoints).toBe(0) // set to 0

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded before

    // deduct bonus points for participant 3 for instance 2 (-> creation of new response with 0 points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBeNull()
    expect(res6!.correctnessPoints).toBeNull()
    expect(res6!.bonusPoints).toBe(false)
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0)
    expect(newResponse6!.correctnessPoints).toBe(0)
    expect(newResponse6!.bonusPoints).toBe(0) // set to 0

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded before
  })

  it('[Instance Point Updates] Verify that deducting all point types from a single participant works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // deduct all point types for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // decreased to 0
    expect(updatedResponse1!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse1!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // delta of -50 deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // delta of -30 deducted

    // deduct all point types for participant 1 for instance 2 (-> decrease to 0 expected with delta being deducted)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant1.id)
    expect((res2 as any)!.participant!.username).toBe(participant1.username)
    expect(res2).toHaveProperty('instance')
    expect(res2!.instance).not.toBeNull()
    expect(res2!.instance!.id).toBe(instanceId2)
    expect(res2!.instance!.elementData).not.toBeNull()
    expect(res2!.instance!.elementData.name).toBe(MCQuestion.name)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // decreased to 0
    expect(updatedResponse2!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse2!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // delta of -20 deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // delta of -100 deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // delta of -60 deducted

    // deduct all point types for participant 2 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(false)
    expect(res3!.correctnessPoints).toBe(false)
    expect(res3!.bonusPoints).toBe(false)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).toHaveProperty('instance')
    expect(res3!.instance).not.toBeNull()
    expect(res3!.instance!.id).toBe(instanceId1)
    expect(res3!.instance!.elementData).not.toBeNull()
    expect(res3!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (no base points for this question)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // decreased to 0
    expect(updatedResponse3!.bonusPoints).toBe(0) // decreased to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // delta of -25 deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // delta of -15 deducted

    // deduct all point types for participant 2 for instance 2 (-> creation of new response with 0 points expected)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.SINGLE)
    expect(res4!.basePoints).toBe(false)
    expect(res4!.correctnessPoints).toBe(false)
    expect(res4!.bonusPoints).toBe(false)
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).toHaveProperty('participant')
    expect((res4 as any)!.participant).not.toBeNull()
    expect((res4 as any)!.participant!.id).toBe(participant2.id)
    expect((res4 as any)!.participant!.username).toBe(participant2.username)
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse4).not.toBeNull()
    expect(newResponse4!.response).toBeNull()
    expect(newResponse4!.correctionOnly).toBe(true)
    expect(newResponse4!.basePoints).toBe(0)
    expect(newResponse4!.correctnessPoints).toBe(0)
    expect(newResponse4!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: newResponse4!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // nothing can be deducted if no base points were awarded before
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded before

    // deduct all point types for participant 3 for instance 1 (-> creation of new response with 0 points expected)
    const res5 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res5).not.toBeNull()
    expect(res5!.type).toBe(PointCorrectionType.SINGLE)
    expect(res5!.basePoints).toBe(false)
    expect(res5!.correctnessPoints).toBe(false)
    expect(res5!.bonusPoints).toBe(false)
    expect(res5!.reason).toBe('Test Reason')
    expect(res5!.studentReason).toBe('Student Test Reason')
    expect(res5!.correctedBy).not.toBeNull()
    expect(res5!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res5).toHaveProperty('participant')
    expect((res5 as any)!.participant).not.toBeNull()
    expect((res5 as any)!.participant!.id).toBe(participant3.id)
    expect((res5 as any)!.participant!.username).toBe(participant3.username)
    expect(res5).toHaveProperty('instance')
    expect(res5!.instance).not.toBeNull()
    expect(res5!.instance!.id).toBe(instanceId1)
    expect(res5!.instance!.elementData).not.toBeNull()
    expect(res5!.instance!.elementData.name).toBe(SCQuestion.name)

    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse5).not.toBeNull()
    expect(newResponse5!.response).toBeNull()
    expect(newResponse5!.correctionOnly).toBe(true)
    expect(newResponse5!.basePoints).toBe(0)
    expect(newResponse5!.correctnessPoints).toBe(0)
    expect(newResponse5!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res5!.id,
        responseId: newResponse5!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0) // nothing can be deducted if no base points were awarded before
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded

    // deduct all point types for participant 3 for instance 2 (-> creation of new response with 0 points expected)
    const res6 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: false,
        awardCorrectnessPoints: false,
        awardBonusPoints: false,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res6).not.toBeNull()
    expect(res6!.type).toBe(PointCorrectionType.SINGLE)
    expect(res6!.basePoints).toBe(false)
    expect(res6!.correctnessPoints).toBe(false)
    expect(res6!.bonusPoints).toBe(false)
    expect(res6!.reason).toBe('Test Reason')
    expect(res6!.studentReason).toBe('Student Test Reason')
    expect(res6!.correctedBy).not.toBeNull()
    expect(res6!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res6).toHaveProperty('participant')
    expect((res6 as any)!.participant).not.toBeNull()
    expect((res6 as any)!.participant!.id).toBe(participant3.id)
    expect((res6 as any)!.participant!.username).toBe(participant3.username)
    expect(res6).toHaveProperty('instance')
    expect(res6!.instance).not.toBeNull()
    expect(res6!.instance!.id).toBe(instanceId2)
    expect(res6!.instance!.elementData).not.toBeNull()
    expect(res6!.instance!.elementData.name).toBe(MCQuestion.name)

    const newResponse6 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse6).not.toBeNull()
    expect(newResponse6!.response).toBeNull()
    expect(newResponse6!.correctionOnly).toBe(true)
    expect(newResponse6!.basePoints).toBe(0)
    expect(newResponse6!.correctnessPoints).toBe(0)
    expect(newResponse6!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res6!.id,
        responseId: newResponse6!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0) // nothing can be deducted if no base points were awarded before
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0) // nothing can be deducted if no correctness points were awarded before
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0) // nothing can be deducted if no bonus points were awarded
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding base points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding correctness points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding bonus points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding all point types to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting base points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting correctness points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting bonus points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting all point types from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding base points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding correctness points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding bonus points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that awarding all point types to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting base points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting correctness points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting bonus points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Instance Point Updates] Verify that deducting all point types from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })
  // #endregion

  // ! Live Quiz Point Updates
  // #region
  it("[Live Quiz Point Updates] Verify that the option of updating a single participant's points can only be chosen in combination with a participant ID", async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that not selecting any modification results in an early return', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding base points to a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding correctness points to a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding bonus points to a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding all point types to a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting base points from a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting correctness points from a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting bonus points from a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting all point types from a single participant works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO: test all three participants
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding base points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding correctness points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding bonus points to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding all point types to all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting base points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting correctness points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting bonus points from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting all point types from all participating participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding base points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding correctness points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding bonus points to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that awarding all point types to all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting base points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting correctness points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting bonus points from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that deducting all point types from all course participants works correctly', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })

  // TODO: verify
  it('[Live Quiz Point Updates] Verify that only assessment course admins can trigger point corrections', async () => {
    const {
      assessmentCourse,
      liveQuiz,
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses()

    // TODO
  })
  // #endregion
})
