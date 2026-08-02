import { correctAssessmentPointsLiveQuiz } from '@/services/courses.js'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  Participant,
  PointCorrectionType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { ContextWithUser } from '../src/lib/context.js'
import {
  initializePrisma,
  seedLiveQuizWithResponses,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Unit tests covering point corrections for live quizzes', () => {
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
      emitter: newEmitter,
      hatchet: newHatchet,
    } = await initializePrisma()
    prisma = newPrisma
    emitter = newEmitter
    hatchet = newHatchet
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

  // ! Live Quiz Point Updates
  // #region
  it("[Live Quiz Point Updates] Verify that the option of updating a single participant's points can only be chosen in combination with a participant ID", async () => {
    const { liveQuiz } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points for instance 1 without participant ID (-> early return expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        // participantId missing here
      },
      userOneCtx
    )
    expect(res1).toBeNull()
  })

  it("[Live Quiz Point Updates] Verify that the option of updating multiple participant's points can only be chosen in combination with an array of participant IDs (length minimum 1)", async () => {
    const { liveQuiz, participant1, participant2 } =
      await seedLiveQuizWithResponses({
        userOneCtx,
        userTwoCtx,
        userThreeCtx,
        userFourCtx,
      })

    // award base points for instance 1 without participant IDs (-> early return expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: null,
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    // award base points for instance 1 with empty participant IDs array (-> early return expected)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [],
      },
      userOneCtx
    )
    expect(res2).toBeNull()

    // award base points for instance 1 with valid participant IDs array (-> no early return expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id],
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()

    const res4 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that not selecting any modification results in an early return', async () => {
    const { liveQuiz, participant1, participant2 } =
      await seedLiveQuizWithResponses({
        userOneCtx,
        userTwoCtx,
        userThreeCtx,
        userFourCtx,
      })

    // no modification selected for participant 1 (-> early return expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
        // no modification selected
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    // no modification selected for participant 2 (-> early return expected)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
        // no modification selected
      },
      userOneCtx
    )
    expect(res2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that only course admins can modify points', async () => {
    const { liveQuiz, participant2 } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        participantId: participant2.id,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()

    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        participantId: participant2.id,
      },
      userThreeCtx
    )
    expect(res2).toBeNull()

    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        scope: PointCorrectionType.SINGLE,
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        participantId: participant2.id,
      },
      userFourCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(true)
    expect(res3!.correctnessPoints).toBe(true)
    expect(res3!.bonusPoints).toBe(true)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userFourCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant2.id)
    expect((res3 as any)!.participant!.username).toBe(participant2.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)
  })

  it('[Live Quiz Point Updates] Verify that awarding base points to a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points for participant 1 in the live quiz (-> no change expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change due to base points deactivated on element
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

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change due to base points already awarded
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
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

    // award base points for participant 2 in the live quiz (-> no change to first response expected, creation of second response with base points)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change due to base points deactivated on element
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
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

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // base points awarded
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // full base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award base points for participant 3 in the live quiz (-> creation of two new responses with base points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points due to deactivated base points on element
    expect(newResponse1!.correctnessPoints).toBe(0)
    expect(newResponse1!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(20) // base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0)
    expect(newResponse2!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // full base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding correctness points to a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points for participant 1 for the live quiz (-> no change expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change due to correctness points already awarded
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

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change due to correctness points already awarded
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
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

    // award correctness points for participant 2 for the live quiz (-> update of first response expected, creation of second response with correctness points)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // updated correctness points
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // full correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award correctness points for participant 3 for the live quiz (-> creation of two new responses with correctness points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0)
    expect(newResponse1!.correctnessPoints).toBe(50) // correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0)

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // full correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0)
    expect(newResponse2!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0)

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // full correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding bonus points to a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award bonus points for participant 1 in the live quiz (-> no change expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change due to bonus points already awarded

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

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change due to bonus points already awarded

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
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

    // award bonus points for participant 2 in the live quiz (-> update of first response expected, creation of second response with bonus points)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(30) // updated bonus points

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 points awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(60) // full bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // full bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award bonus points for participant 3 in the live quiz (-> creation of two new responses with bonus points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0)
    expect(newResponse1!.correctnessPoints).toBe(0)
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30) // full bonus points awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0)
    expect(newResponse2!.correctnessPoints).toBe(0)
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // full bonus points awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding all point types to a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award all point types for participant 1 in the live quiz (-> no change expected)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change due to base points already awarded
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change due to correctness points already awarded
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change due to bonus points already awarded

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

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change due to base points already awarded
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change due to correctness points already awarded
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change due to bonus points already awarded

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
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

    // award all point types for participant 2 in the live quiz (-> update of first response expected, creation of second response with all point types)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // updated base points
    expect(updatedResponse3!.correctnessPoints).toBe(50) // updated correctness points
    expect(updatedResponse3!.bonusPoints).toBe(30) // updated bonus points

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // base points are not modified adhering to element setting
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 points awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // full base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // full correctness points awarded
    expect(newResponse!.bonusPoints).toBe(60) // full bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // full base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // full correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // full bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award all point types for participant 3 in the live quiz (-> creation of two new responses with all point types expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded adhering to element setting
    expect(newResponse1!.correctnessPoints).toBe(50) // correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // full correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30) // full bonus points awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(20) // base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // full base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // full correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // full bonus points awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting base points from a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct base points for participant 1 in the live quiz (-> no change expected for instance 1, deduction expected for instance 2)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(false)
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change due to base points already awarded
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

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // removal of base points exepcted
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 2 in the live quiz (-> no change for instance 1 expected, creation of empty response for instance 2 expected)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change due to base points already not awarded
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
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

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct base points for participant 3 in the live quiz (-> creation of two empty responses expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting correctness points from a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct correctness points for participant 1 in the live quiz (-> deduction expected for instance 1 and instance 2)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deduction of correctness points expected
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
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deduction of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 2 in the live quiz (-> deduction expected for instance 1, creation of response with 0 correctness points for instance 2)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deduction of correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // 0 correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct correctness points for participant 3 in the live quiz (-> creation of two responses with 0 correctness points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // 0 correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // 0 correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting bonus points from a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct bonus points for participant 1 in the live quiz (-> deduction expected for instance 1 and instance 2)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduction of bonus points expected

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
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // deduct bonus points for participant 2 in the live quiz (-> deduction expected for instance 1, creation of response with 0 bonus points for instance 2)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // 0 bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct bonus points for participant 3 in the live quiz (-> creation of two responses with 0 bonus points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // 0 bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // 0 bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting all point types from a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct all point types for participant 1 in the live quiz (-> deduction expected for instance 1 and instance 2)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deduction of correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduction of bonus points expected

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
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // instance did not result in any base points -> no deduction
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deduction of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // deduct all point types for participant 2 in the live quiz (-> deduction expected for instance 1, creation of response with 0 points for instance 2)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
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
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deduction of correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // instance did not result in any base points -> no deduction
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // deduct all point types for participant 3 in the live quiz (-> creation of two responses with 0 points expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
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
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting and awarding points from a single participant works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points and deduct base and bonus points for participant 1 in the live quiz (-> update expected for instance 1 and instance 2)
    const res1 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        deductBasePoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant1.id,
      },
      userOneCtx
    )

    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant1.id)
    expect((res1 as any)!.participant!.username).toBe(participant1.username)
    expect(res1).not.toHaveProperty('instance')
    expect(res1).toHaveProperty('liveQuiz')
    expect(res1!.liveQuiz).not.toBeNull()
    expect(res1!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change of full correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // instance did not result in any base points -> no deduction
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change of full correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // award correctness points and deduct base and bonus points for participant 2 in the live quiz (-> update expected for instance 1, creation of response with 25 correctness points for instance 2)
    const res2 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        deductBasePoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.SINGLE)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).toHaveProperty('participant')
    expect((res2 as any)!.participant).not.toBeNull()
    expect((res2 as any)!.participant!.id).toBe(participant2.id)
    expect((res2 as any)!.participant!.username).toBe(participant2.username)
    expect(res2).not.toHaveProperty('instance')
    expect(res2).toHaveProperty('liveQuiz')
    expect(res2!.liveQuiz).not.toBeNull()
    expect(res2!.liveQuiz!.id).toBe(liveQuiz.id)

    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // deduction of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(50) // 25 correctness points awarded (from 25 to 50)
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduction of bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 additional correctness points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // instance did not result in any base points -> no deduction
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // 100 correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // award correctness points and deduct base and bonus points for participant 3 in the live quiz (-> creation of two responses expected)
    const res3 = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        deductBasePoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.SINGLE,
        participantId: participant3.id,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.SINGLE)
    expect(res3!.basePoints).toBe(false)
    expect(res3!.correctnessPoints).toBe(true)
    expect(res3!.bonusPoints).toBe(false)
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).toHaveProperty('participant')
    expect((res3 as any)!.participant).not.toBeNull()
    expect((res3 as any)!.participant!.id).toBe(participant3.id)
    expect((res3 as any)!.participant!.username).toBe(participant3.username)
    expect(res3).not.toHaveProperty('instance')
    expect(res3).toHaveProperty('liveQuiz')
    expect(res3!.liveQuiz).not.toBeNull()
    expect(res3!.liveQuiz!.id).toBe(liveQuiz.id)

    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(50) // 50 correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // 50 correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // 100 correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding base points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points for all participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: Participant) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: Participant) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect an update without changes (already has base points for both instances)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no base points are awarded for the first instance
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum for this instance)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // base points awarded
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding correctness points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates without changes (already has full correctness points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change of correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // 25 correctness points awarded (from 25 to 50)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 additional correctness points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(100) // 100 correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding bonus points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award bonus points for the first and third participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant3.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant3.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates without changes (already has bonus points for both instances)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change of bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: no changes to the first response, no creation of a new response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15) // no change of bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).toBeNull()

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).toBeNull()

    // for participant 3: expect creation of responses for both instances with awarded bonus points
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0)
    expect(newResponse1!.correctnessPoints).toBe(0)
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(30) // bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0)
    expect(newResponse2!.correctnessPoints).toBe(0)
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(60) // bonus points awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding all points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award all points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no updates (already has max points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change of correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change of bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(50) // 25 correctness points awarded (from 25 to 50)
    expect(updatedResponse3!.bonusPoints).toBe(30) // 15 bonus points awarded (from 15 to 30)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum for this instance)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 additional correctness points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 additional bonus points awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting base points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct base points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates with deducted base points
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // base points deducted to minimum of 0
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted from 20 to 0
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no base points are awarded for the first instance
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // base points deducted to minimum of 0
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting correctness points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct correctness points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates with deducted correctness points
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted from 100 to 0
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // no correctness points deducted (already at minimum)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting bonus points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct bonus points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates with deducted bonus points
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted from 60 to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // no bonus points deducted (already at minimum)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting all points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct all points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates with deducted all points
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // base points deducted to minimum of 0
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted from 20 to 0
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted from 100 to 0
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted from 60 to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // base points deducted to minimum of 0
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // base points deducted to minimum of 0
    expect(newResponse!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(newResponse!.bonusPoints).toBe(0) // bonus points deducted to minimum of 0

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // no correctness points deducted (already at minimum)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // no bonus points deducted (already at minimum)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding and deducting points to multiple participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant1,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points and deduct correctness points for the first and second participant in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.MULTIPLE,
        participantIds: [participant1.id, participant2.id],
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.MULTIPLE)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).toHaveProperty('participants')
    expect((res as any).participants).toHaveLength(2)
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant1.id
    )
    expect((res as any).participants.map((p: any) => p.id)).toContain(
      participant2.id
    )
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect updates with awarded base points and deducted correctness points
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted from 100 to 0
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to minimum of 0
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // bonus points are awarded
    expect(newResponse!.correctnessPoints).toBe(0) // correctness points are initialized with empty value (since deducted)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // no correctness points deducted (already at minimum)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: no existing responses, no new responses have been created
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding base points to all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points for all participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no updates (already has max base points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // 20 base points awarded
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding correctness points to all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points for all participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no updates (already has max correctness points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change of correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // top up from 25 to 50 correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(100) // 100 correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding bonus points to all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award bonus points for all participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no updates (already has max bonus points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change of bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(30) // top up from 15 to 30 bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(60) // 60 bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // 60 bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding all point types to all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award all point types for all participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no updates (already has max points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change of correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change of bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change of base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change of correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change of bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at maximum)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect update for instance 1 and creation of response for instance 2
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no base points are available for the first instance
    expect(updatedResponse3!.correctnessPoints).toBe(50) // top up from 25 to 50 correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(30) // top up from 15 to 30 bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points awarded (already at maximum)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // 20 base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // 100 correctness points awarded
    expect(newResponse!.bonusPoints).toBe(60) // 60 bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // 60 bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting base points from all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct base points for all participating participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect only modification of the second instance response (first response has no base points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deduct from 20 to 0 base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the first instance response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change of base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points deducted (already at minimum)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // no base points awarded (already at minimum)
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0) // no base points awarded (already at minimum)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting correctness points from all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct correctness points for all participating participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect a modification of both live quiz responses
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deduct from 50 to 0 correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deduct from 100 to 0 correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the first instance response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deduct from 25 to 0 correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0) // no correctness points awarded (already at minimum)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0) // no correctness points awarded (already at minimum)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting bonus points from all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct bonus points for all participating participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect a modification of both live quiz responses
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduct from 30 to 0 bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduct from 60 to 0 bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // for participant 2: expect modification of the first instance response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduct from 15 to 0 bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0)
    expect(newResponse!.correctnessPoints).toBe(0)
    expect(newResponse!.bonusPoints).toBe(0)

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0) // no bonus points awarded (already at minimum)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // response did not exist before -> no deduction
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting all point types from all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct all points for all participating participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect a modification of both live quiz responses
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // deduct from 0 to 0 base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deduct from 50 to 0 correctness points expected
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduct from 30 to 0 bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // 0 base points deducted (already at minimum)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deduct from 20 to 0 base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deduct from 100 to 0 correctness points expected
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduct from 60 to 0 bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // for participant 2: expect modification of the first instance response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // deduct from 0 to 0 base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deduct from 25 to 0 correctness points expected
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduct from 15 to 0 bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // 0 base points deducted (already at minimum)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // deduct from 0 to 0 base points expected
    expect(newResponse!.correctnessPoints).toBe(0) // deduct from 100 to 0 correctness points expected
    expect(newResponse!.bonusPoints).toBe(0) // deduct from 60 to 0 bonus points expected
    expect(newResponse!.response).toBeNull()

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // new response -> no points to deduct
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // new response -> no points to deduct
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // new response -> no points to deduct

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that deducting and awarding points from all participating participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points and deduct base and bonus points for all participating participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        deductBasePoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect a modification of both live quiz responses
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // deduct from 0 to 0 base points expected
    expect(updatedResponse1!.correctnessPoints).toBe(50) // correctness points are already awarded
    expect(updatedResponse1!.bonusPoints).toBe(0) // deduct from 30 to 0 bonus points expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no new correctness points awarded (already at maximum)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // 0 base points deducted (already at minimum)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deduct from 20 to 0 base points expected
    expect(updatedResponse2!.correctnessPoints).toBe(100) // correctness points are already awarded
    expect(updatedResponse2!.bonusPoints).toBe(0) // deduct from 60 to 0 bonus points expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no new correctness points awarded (already at maximum)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted

    // for participant 2: expect modification of the first instance response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // deduct from 0 to 0 base points expected
    expect(updatedResponse3!.correctnessPoints).toBe(50) // correctness points are topped up to 50
    expect(updatedResponse3!.bonusPoints).toBe(0) // deduct from 15 to 0 bonus points expected

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded (from 25 to 50)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // 0 base points deducted (already at minimum)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // response did not previously exist -> no base points
    expect(newResponse!.correctnessPoints).toBe(100) // correctness points are topped up to 100
    expect(newResponse!.bonusPoints).toBe(0) // response did not previously exist -> no bonus points
    expect(newResponse!.response).toBeNull()

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded as new response
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of no responses -> only participating users (at least one response in the live quiz)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).toBeNull()

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).toBeNull()
  })

  it('[Live Quiz Point Updates] Verify that awarding base points to all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award base points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no modifications of the base points (already maximum available awarded)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change expected
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no change expected
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change expected
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no change expected
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the second response only (did not exist before)
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change expected
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no change expected
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // maximum available base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with maximum available base points (0 and 20 for instances 1 and 2)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // maximum available base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0) // 0 base points awarded (disabled on elment)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(20) // maximum available base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding correctness points to all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no modifications of the correctness points (already maximum available awarded)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change expected
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no change expected
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change expected
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no change expected
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of both responses (top up for first response, new response for second instance)
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // topped up from 25 to 50
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded (from 25 to 50)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // maximum available correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded as new response
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with maximum available correctness points (50 and 100 for instances 1 and 2)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(50) // maximum available correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // 50 correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // maximum available correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding bonus points to all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award bonus points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no modifications of the bonus points (already maximum available awarded)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no change expected
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no change expected
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the first response and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(30) // topped up from 15 to 30

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points awarded (from 15 to 30)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // response did not previously exist -> no base points
    expect(newResponse!.correctnessPoints).toBe(0) // response did not previously exist -> no correctness points
    expect(newResponse!.bonusPoints).toBe(60) // maximum available bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // 60 bonus points awarded as new response
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses for both instances with maximum available bonus points (30 and 60 for instances 1 and 2)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // response did not previously exist -> no base points
    expect(newResponse1!.correctnessPoints).toBe(0) // response did not previously exist -> no correctness points
    expect(newResponse1!.bonusPoints).toBe(30) // maximum available bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30) // 30 bonus points awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // response did not previously exist -> no base points
    expect(newResponse2!.correctnessPoints).toBe(0) // response did not previously exist -> no correctness points
    expect(newResponse2!.bonusPoints).toBe(60) // maximum available bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // 60 bonus points awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that awarding all point types to all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award all point types for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBe(true)
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBe(true)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect no modifications of any points (already maximum available awarded)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change expected
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no change expected
    expect(updatedResponse1!.bonusPoints).toBe(30) // no change expected

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no change expected
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no change expected
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no change expected
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20) // no change expected
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no change expected
    expect(updatedResponse2!.bonusPoints).toBe(60) // no change expected

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no change expected
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no change expected
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no change expected
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of both responses (topping up first response, new response for second instance)
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // topped up from 25 to 50
    expect(updatedResponse3!.bonusPoints).toBe(30) // topped up from 15 to 30

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // remains at zero (element setting)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded (from 25 to 50)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points awarded (from 15 to 30)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(20) // maximum available base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // maximum available correctness points awarded
    expect(newResponse!.bonusPoints).toBe(60) // maximum available bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(60) // 60 bonus points awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with maximum available points (0/50/30 and 20/100/60 for instances 1 and 2)
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // maximum available base points awarded
    expect(newResponse1!.correctnessPoints).toBe(50) // maximum available correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(30) // maximum available bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0) // 0 base points awarded (disabled on element)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // 50 correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(30) // 30 bonus points awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(20) // maximum available base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // maximum available correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(60) // maximum available bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // 20 base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // 100 correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // 60 bonus points awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting base points from all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct base points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect modification of the second response (deduction of 20 base points, but not below 0)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // no change expected (already at 0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no change expected (already at 0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deducted from 20 to 0
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted (from 20 to 0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the first response (deduction of 0 base points, but not below 0) and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change expected (already at 0, element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no change expected (already at 0, element setting)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with 0 base points (element setting) for first instance and 20 for second instance
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded (element setting)
    expect(newResponse1!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0) // no base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting correctness points from all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct correctness points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBeNull()
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect modification of both responses (deduction of 50 and 100 correctness points, but not below 0)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deducted from 50 to 0
    expect(updatedResponse1!.bonusPoints).toBe(30)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted (from 50 to 0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deducted from 100 to 0
    expect(updatedResponse2!.bonusPoints).toBe(60)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted (from 100 to 0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // for participant 2: expect modification of the first response (deduction of 25 correctness points, but not below 0) and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deducted from 25 to 0
    expect(updatedResponse3!.bonusPoints).toBe(15)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // remains at zero (element setting)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted (from 25 to 0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with 0 correctness points for both instances
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded (element setting)
    expect(newResponse1!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting bonus points from all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct bonus points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBeNull()
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect modification of both responses (deduction of 30 and 60 bonus points, but not below 0)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50)
    expect(updatedResponse1!.bonusPoints).toBe(0) // deducted from 30 to 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted (from 30 to 0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100)
    expect(updatedResponse2!.bonusPoints).toBe(0) // deducted from 60 to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted (from 60 to 0)

    // for participant 2: expect modification of the first response (deduction of 15 bonus points, but not below 0) and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(25)
    expect(updatedResponse3!.bonusPoints).toBe(0) // deducted from 15 to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // remains at zero (element setting)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted (from 15 to 0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with 0 bonus points for both instances
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded (element setting)
    expect(newResponse1!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0) // no base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deducting all point types from all course participants works correctly', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct all point types for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBe(false)
    expect(res!.correctnessPoints).toBe(false)
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect modification of both responses (deduction of 20 base points, 50 and 100 correctness points and 30 and 60 bonus points, but not below 0)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0) // deducted from 0 to 0
    expect(updatedResponse1!.correctnessPoints).toBe(0) // deducted from 50 to 0
    expect(updatedResponse1!.bonusPoints).toBe(0) // deducted from 30 to 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // 0 base points deducted (from 0 to 0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points deducted (from 50 to 0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted (from 30 to 0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(0) // deducted from 20 to 0
    expect(updatedResponse2!.correctnessPoints).toBe(0) // deducted from 100 to 0
    expect(updatedResponse2!.bonusPoints).toBe(0) // deducted from 60 to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points deducted (from 20 to 0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points deducted (from 100 to 0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted (from 60 to 0)

    // for participant 2: expect modification of the first response (deduction of 0 base points, 25 correctness points and 15 bonus points, but not below 0) and creation of response for the second instance
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // no change expected (already at 0, element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // deducted from 25 to 0
    expect(updatedResponse3!.bonusPoints).toBe(0) // deducted from 15 to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no change expected (already at 0, element setting)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points deducted (from 25 to 0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted (from 15 to 0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with 0 base points (element setting), 0 correctness points and 0 bonus points for both instances
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded (element setting)
    expect(newResponse1!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // new response -> no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0) // no base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that deduction and awarding points for all course participants can be combined', async () => {
    const {
      liveQuiz,
      instanceId1,
      instanceId2,
      participant2,
      participant3,
      p1Response1,
      p1Response2,
      p2Response1,
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // award correctness points and deduct bonus points for all course participants in the live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: liveQuiz.id,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).not.toBeNull()
    expect(res!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res!.basePoints).toBeNull()
    expect(res!.correctnessPoints).toBe(true)
    expect(res!.bonusPoints).toBe(false)
    expect(res!.reason).toBe('Test Reason')
    expect(res!.studentReason).toBe('Student Test Reason')
    expect(res!.correctedBy).not.toBeNull()
    expect(res!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res).not.toHaveProperty('participant')
    expect(res).not.toHaveProperty('instance')
    expect(res).toHaveProperty('liveQuiz')
    expect(res!.liveQuiz).not.toBeNull()
    expect(res!.liveQuiz!.id).toBe(liveQuiz.id)

    // for participant 1: expect modification of both responses (no modification of correctness points, deduction of bonus points)
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.correctionOnly).toBe(false)
    expect(updatedResponse1!.basePoints).toBe(0)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // no modification expected (already at maximum)
    expect(updatedResponse1!.bonusPoints).toBe(0) // deducted from 30 to 0

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no changes
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0) // no changes
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points deducted (from 30 to 0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.correctionOnly).toBe(false)
    expect(updatedResponse2!.basePoints).toBe(20)
    expect(updatedResponse2!.correctnessPoints).toBe(100) // no modification expected (already at maximum)
    expect(updatedResponse2!.bonusPoints).toBe(0) // deducted from 60 to 0

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0) // no changes
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0) // no changes
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points deducted (from 60 to 0)

    // for participant 2: expect modification of the first response and creation of new second response
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.correctionOnly).toBe(false)
    expect(updatedResponse3!.basePoints).toBe(0) // remains at zero (element setting)
    expect(updatedResponse3!.correctnessPoints).toBe(50) // topped up from 25 to 50
    expect(updatedResponse3!.bonusPoints).toBe(0) // deducted from 15 to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points awarded (from 25 to 50)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // remains at zero (element setting)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0) // no deduction
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points deducted (from 15 to 0)

    const newResponse = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse).not.toBeNull()
    expect(newResponse!.response).toBeNull()
    expect(newResponse!.correctionOnly).toBe(true)
    expect(newResponse!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse!.correctnessPoints).toBe(100) // new response -> max available correctness points awarded
    expect(newResponse!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(100) // max available correctness points awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // for participant 3: expect the creation of new responses with 0 base points (element setting), max available correctness points and 0 bonus points for both instances
    const newResponse1 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse1).not.toBeNull()
    expect(newResponse1!.response).toBeNull()
    expect(newResponse1!.correctionOnly).toBe(true)
    expect(newResponse1!.basePoints).toBe(0) // new response -> no base points awarded (element setting)
    expect(newResponse1!.correctnessPoints).toBe(50) // new response -> max available correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(50) // max available correctness points awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.response).toBeNull()
    expect(newResponse2!.correctionOnly).toBe(true)
    expect(newResponse2!.basePoints).toBe(0) // new response -> no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // new response -> max available correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // new response -> no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0) // no base points awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // max available correctness points awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Live Quiz Point Updates] Verify that point corrections cannot be triggered for non-existing live quizzes', async () => {
    // try to trigger point correction for non-existing live quiz
    const res = await correctAssessmentPointsLiveQuiz(
      {
        liveQuizId: 'b09023eb-d83f-4af2-b419-0ae0e37d949c',
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res).toBeNull()
  })
  // #endregion
})
