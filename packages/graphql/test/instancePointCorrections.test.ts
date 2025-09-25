import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PointCorrectionType, PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import {} from 'src/ops.js'
import { ContextWithUser } from '../src/lib/context.js'
import { correctAssessmentPointsInstance } from '../src/services/courses.js'
import {
  initializePrisma,
  seedLiveQuizWithResponses,
  testCleanup,
  testInitialization,
} from './helpers.js'

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

  // ! Instance Point Updates
  // #region
  it("[Instance Point Updates] Verify that the option of updating a single participant's points can only be chosen in combination with a participant ID", async () => {
    const { instanceId1 } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    const { instanceId1, participant1 } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct base points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
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
        deductBasePoints: true,
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
        deductBasePoints: true,
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
        deductBasePoints: true,
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
        deductBasePoints: true,
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
        deductBasePoints: true,
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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct correctness points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
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
        deductCorrectnessPoints: true,
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
        deductCorrectnessPoints: true,
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
        deductCorrectnessPoints: true,
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
        deductCorrectnessPoints: true,
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
        deductCorrectnessPoints: true,
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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct bonus points for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
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
        deductBonusPoints: true,
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
        deductBonusPoints: true,
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
        deductBonusPoints: true,
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
        deductBonusPoints: true,
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
        deductBonusPoints: true,
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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // deduct all point types for participant 1 for instance 1 (-> decrease to 0 expected with delta being deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
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
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
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

  it('[Instance Point Updates] Verify that awarding and deducting points at the same time for a single participant works correctly', async () => {
    const { instanceId1, SCQuestion, participant2, p2Response1 } =
      await seedLiveQuizWithResponses({
        userOneCtx,
        userTwoCtx,
        userThreeCtx,
        userFourCtx,
      })

    // award and deduct points for participant 1 for instance 1 (-> increase and decrease expected with delta being awarded/deducted)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true, // no effect, since no base points for this question
        deductCorrectnessPoints: true, // remove any awarded correctness points -> decrease by 25
        awardBonusPoints: true, // increase by 15
        scope: PointCorrectionType.SINGLE,
        participantId: participant2.id,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.SINGLE)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).toHaveProperty('participant')
    expect((res1 as any)!.participant).not.toBeNull()
    expect((res1 as any)!.participant!.id).toBe(participant2.id)
    expect((res1 as any)!.participant!.username).toBe(participant2.username)
    expect(res1).toHaveProperty('instance')
    expect(res1!.instance).not.toBeNull()
    expect(res1!.instance!.id).toBe(instanceId1)
    expect(res1!.instance!.elementData).not.toBeNull()
    expect(res1!.instance!.elementData.name).toBe(SCQuestion.name)

    const updatedResponse = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse).not.toBeNull()
    expect(updatedResponse!.basePoints).toBe(0) // remains unchanged, since no base points for this question
    expect(updatedResponse!.correctnessPoints).toBe(0) // decreased by 25
    expect(updatedResponse!.bonusPoints).toBe(30) // increased by 15

    const appliedCorrection = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection).not.toBeNull()
    expect(appliedCorrection!.awardedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection!.awardedBonusPoints).toBe(15) // delta of +15 awarded
    expect(appliedCorrection!.deductedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection!.deductedCorrectnessPoints).toBe(25) // delta of -25 deducted
    expect(appliedCorrection!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding base points to all participating participants works correctly', async () => {
    // ? While this function will be technically available through a combination of options, it will never have a relevant effect
    // ? -> this is due to the fact that all participating participants of an instance were awarded base points anyway
    // ? -> only after a erroneous deduction of base points, this option could be used as a fix

    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award base points for all participating participants for instance 1 (participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award base points for all participating participants for instance (participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that an applied correction was created for participant 1 for instance 1 and the response was udpated
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // not modified, since no base points are awarded for this instance
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // verify that an applied correction was created for participant 2 for instance 1 and the response was udpated
    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // not modified, since no base points are awarded for this instance
    expect(updatedResponse2!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection3 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection3).toBe(2)

    // verify that an applied correction was created for participant 1 for instance 2 and the response was udpated
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(20) // not modified from the original amount
    expect(updatedResponse3!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0) // no additional base points were awarded, since participant already had the full amount
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    // manually set the number of base points on the responses of participants 1 and 2 to zero and re-apply the function
    await prisma.liveQuizResponse.updateMany({
      where: { id: { in: [p1Response1.id, p1Response2.id, p2Response1.id] } },
      data: { basePoints: 0 },
    })

    // award base points for all participating participants for instance 1 (affects participants 1 and 2)
    const res3 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res3).not.toBeNull()
    expect(res3!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res3!.basePoints).toBe(true)
    expect(res3!.correctnessPoints).toBeNull()
    expect(res3!.bonusPoints).toBeNull()
    expect(res3!.reason).toBe('Test Reason')
    expect(res3!.studentReason).toBe('Student Test Reason')
    expect(res3!.correctedBy).not.toBeNull()
    expect(res3!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res3).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res3).toHaveProperty('instance')
    expect((res3 as any)!.instance).not.toBeNull()
    expect((res3 as any)!.instance!.id).toBe(instanceId1)
    expect((res3 as any)!.instance!.elementData).not.toBeNull()
    expect((res3 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // verify that an applied correction was created for participant 1 for instance 1 and the response was udpated
    const updatedResponse4 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse4).not.toBeNull()
    expect(updatedResponse4!.basePoints).toBe(0) // remains at zero, since no base points are awarded for this instance
    expect(updatedResponse4!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse4!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)

    // verify that an applied correction was created for participant 2 for instance 1 and the response was udpated
    const updatedResponse5 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse5).not.toBeNull()
    expect(updatedResponse5!.basePoints).toBe(0) // remains at zero, since no base points are awarded for this instance
    expect(updatedResponse5!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse5!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection7 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res3!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection7).not.toBeNull()
    expect(appliedCorrection7!.awardedBasePoints).toBe(0) // no base points were awarded for this question
    expect(appliedCorrection7!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection7!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection7!.deductedBasePoints).toBe(0)
    expect(appliedCorrection7!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection7!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
    const newResponse4 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId1,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse4).toBeNull()

    const appliedCorrection8 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res3!.id },
    })
    expect(appliedCorrection8).toBe(2)

    // award base points for all participating participants for instance 2 (affects participant 1 only)
    const res4 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res4).not.toBeNull()
    expect(res4!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res4!.basePoints).toBe(true)
    expect(res4!.correctnessPoints).toBeNull()
    expect(res4!.bonusPoints).toBeNull()
    expect(res4!.reason).toBe('Test Reason')
    expect(res4!.studentReason).toBe('Student Test Reason')
    expect(res4!.correctedBy).not.toBeNull()
    expect(res4!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res4).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res4).toHaveProperty('instance')
    expect((res4 as any)!.instance).not.toBeNull()
    expect((res4 as any)!.instance!.id).toBe(instanceId2)
    expect((res4 as any)!.instance!.elementData).not.toBeNull()
    expect((res4 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that an applied correction was created for participant 1 for instance 2 and the response was udpated
    const updatedResponse6 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse6).not.toBeNull()
    expect(updatedResponse6!.basePoints).toBe(20) // base points are set back to the original amount
    expect(updatedResponse6!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse6!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection9 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res4!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection9).not.toBeNull()
    expect(appliedCorrection9!.awardedBasePoints).toBe(20) // base points were awarded to fix the erroneous deduction
    expect(appliedCorrection9!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection9!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection9!.deductedBasePoints).toBe(0)
    expect(appliedCorrection9!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection9!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 2 for instance 2
    const newResponse5 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse5).toBeNull()

    const appliedCorrection10 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res4!.id },
    })
    expect(appliedCorrection10).toBe(1) // only one new correction should be created for participant 1
  })

  it('[Instance Point Updates] Verify that awarding correctness points to all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // verify that an applied correction was created for participant 1 for instance 1 and the response was udpated
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged (already full correctness points awarded)
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no additional correctness points were awarded, since participant already had the full amount
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    // verify that an applied correction was created for participant 2 for instance 1 and the response was udpated
    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(50) // increased to 50 (full correctness points awarded now)
    expect(updatedResponse2!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(25) // 25 additional correctness points were awarded
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection3 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection3).toBe(2)

    // award correctness points for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that an applied correction was created for participant 1 for instance 2 and the response was udpated
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(100) // remains unchanged (already full correctness points awarded)
    expect(updatedResponse3!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0) // no additional correctness points were awarded, since participant already had the full amount
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that awarding bonus points to all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award bonus points for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award bonus points for all participating participants for instance (participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged (already full bonus points awarded)

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no additional bonus points were awarded, since participant already had the full amount
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged (already full bonus points awarded)

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no additional bonus points were awarded, since participant already had the full amount
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(30) // changed to maximum available bonus points

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 additional bonus points were awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that awarding all point types to all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award all point types for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award all point types for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 (fully correct) were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points were awarded, since question does not award base points
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no additional correctness points were awarded, since participant already had the full amount
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no additional bonus points were awarded, since participant already had the full amount
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points were awarded, since question does not award base points
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no additional correctness points were awarded, since participant already had the full amount
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no additional bonus points were awarded, since participant already had the full amount
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(50) // increased to 50 (full correctness points awarded now)
    expect(updatedResponse3!.bonusPoints).toBe(30) // changed to maximum available bonus points

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points were awarded, since question does not award base points
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 additional correctness points were awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 additional bonus points were awarded
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that deducting base points from all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct base points for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct base points for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged (already 0 base points)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

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
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points were deducted, since participant already had 0 base points
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

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
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points were deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was not updated (already 0 base points) and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged (already 0 base points)
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points were deducted, since participant already had 0 base points
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that deducting correctness points from all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct correctness points for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct correctness points for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

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
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

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
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points were deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that deducting bonus points from all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct bonus points for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct bonus points for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted

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
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points were deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted

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
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points were deducted

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points were deducted

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that deducting all point types from all participating participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct all point types for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct all point types for all participating participants for instance 2 (affects participant 1 only)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // base points deducted (remains at 0 since already 0)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted (remains at 0 since already 0)
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted

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
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // no base points were deducted, since participant already had 0 base points
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points were deducted

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted

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
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points were deducted
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points were deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points were deducted

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // base points deducted (remains at 0 since already 0)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted (remains at 0 since already 0)
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted (remains at 0 since already 0)

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // no base points were deducted, since participant already had 0 base points
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points were deducted

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants 1 and 2)
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

    const appliedCorrection4 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection4).toBe(2)

    // verify that no applied correction or live quiz response were created for participants 2 and 3 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).toBeNull()

    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).toBeNull()

    const appliedCorrection5 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res2!.id },
    })
    expect(appliedCorrection5).toBe(1)
  })

  it('[Instance Point Updates] Verify that awarding and deducting points at the same time works correctly', async () => {
    const { instanceId1, SCQuestion, participant3, p1Response1, p2Response1 } =
      await seedLiveQuizWithResponses({
        userOneCtx,
        userTwoCtx,
        userThreeCtx,
        userFourCtx,
      })

    // deduct correctness points and award bonus points for all participating participants for instance 1 (affects participants 1 and 2)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.PARTICIPATING,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.PARTICIPATING)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for participating correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // verify that the live quiz responses have been updated correctly
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse1!.bonusPoints).toBe(30) // bonus not modified

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
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted
    expect(updatedResponse2!.bonusPoints).toBe(30) // bonus updated to maximum

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(15) // 15 bonus points were awarded
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that no applied correction or live quiz response were created for participant 3 for instance 1
    // (= the number of applied corrections remains at 2 for participants
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

    const appliedCorrection3 = await prisma.appliedPointCorrection.count({
      where: { pointCorrectionId: res1!.id },
    })
    expect(appliedCorrection3).toBe(2)
  })

  it('[Instance Point Updates] Verify that awarding base points to all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award base points to all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award base points to all participants in the assessment course for instance 2 (affects participant 1, 2, and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points were awarded, since participant already had 0 base points
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points were awarded, since participant already had 20 base points
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was not updated, but a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // no base points were awarded, since participant already had 0 base points
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points awarded, but set to zero, because question does not have base points
    expect(newResponse1!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0) // no base points were awarded, since question does not have base points
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(20) // base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(20) // 20 base points were awarded
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(20) // base points awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse3!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // 20 base points were awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding correctness points to all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award correctness points to all participants in the assessment course for instance 1 (affects participants 1, 2, and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award correctness points to all participants in the assessment course for instance 2 (affects participant 1, 2, and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // correctness points unchanged, because maximum was already awarded
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points were awarded, because maximum was already awarded
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // correctness points unchanged, because maximum was already awarded
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points were awarded, because maximum was already awarded
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(50) // correctness points updated to maximum
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points were awarded
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(50) // correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(50) // 50 correctness points were awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(100) // 100 correctness points were awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // no base points awarded
    expect(newResponse3!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse3!.bonusPoints).toBe(0) // no bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // 100 correctness points were awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding bonus points to all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award bonus points to all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award bonus points to all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged, because maximum was already awarded

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points were awarded, because maximum was already awarded
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged, because maximum was already awarded

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points were awarded, because maximum was already awarded
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(30) // bonus points updated to maximum

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points were awarded to reach maximum available
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // no base points awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(30) // 30 bonus points were awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // no base points awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // no base points awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // no correctness points awarded
    expect(newResponse3!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that awarding all point types to all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award all point types to all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBe(true)
    expect(res1!.correctnessPoints).toBe(true)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award all point types to all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        awardBasePoints: true,
        awardCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBe(true)
    expect(res2!.correctnessPoints).toBe(true)
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were not updated, but corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged, because maximum was already awarded
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged, because maximum was already awarded
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged, because maximum was already awarded

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0) // no base points were awarded, because maximum was already awarded
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0) // no correctness points were awarded, because maximum was already awarded
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // no bonus points were awarded, because maximum was already awarded
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged, because maximum was already awarded
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged, because maximum was already awarded
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged, because maximum was already awarded

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0) // no base points were awarded, because maximum was already awarded
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0) // no correctness points were awarded, because maximum was already awarded
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // no bonus points were awarded, because maximum was already awarded
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // base points updated to maximum
    expect(updatedResponse3!.correctnessPoints).toBe(50) // correctness points to maximum
    expect(updatedResponse3!.bonusPoints).toBe(30) // bonus points updated to maximum

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0) // base points remain unchanged
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(25) // 25 correctness points were awarded to reach maximum available
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points were awarded to reach maximum available
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points awarded according to element settings
    expect(newResponse1!.correctnessPoints).toBe(50) // correctness points awarded
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0) // no base points were awarded according to the element settings
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(50) // 50 correctness points were awarded
    expect(appliedCorrection4!.awardedBonusPoints).toBe(30) // 30 bonus points were awarded
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(20) // base points awarded
    expect(newResponse2!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(20) // 20 base points were awarded
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(100) // 100 correctness points were awarded
    expect(appliedCorrection5!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(20) // base points awarded
    expect(newResponse3!.correctnessPoints).toBe(100) // correctness points awarded
    expect(newResponse3!.bonusPoints).toBe(60) // bonus points awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(20) // 20 base points were awarded
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(100) // 100 correctness points were awarded
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting base points from all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct base points from all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct base points from all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // base points not modified (not awarded before)
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

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
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted to 0
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

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
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points were deducted to reach 0
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // base points not modified (not awarded before)
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points not awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse1!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // base points not awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse2!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // base points not awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse3!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting correctness points from all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct correctness points from all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBeNull()
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct correctness points from all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBeNull()
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse1!.bonusPoints).toBe(30) // remains unchanged

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
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted to reach 0
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse2!.bonusPoints).toBe(60) // remains unchanged

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
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points were deducted to reach 0
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse3!.bonusPoints).toBe(15) // remains unchanged

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted to reach 0
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points not awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse1!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // base points not awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse2!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // base points not awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse3!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0)
  })

  it('[Instance Point Updates] Verify that deducting bonus points from all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct bonus points from all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBeNull()
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct bonus points from all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBeNull()
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(50) // remains unchanged
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted to 0

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
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points were deducted to reach 0

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(100) // remains unchanged
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted to 0

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
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points were deducted to reach 0

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(25) // remains unchanged
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points were deducted to reach 0

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points not awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse1!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // base points not awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse2!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // base points not awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse3!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)
  })

  it('[Instance Point Updates] Verify that deducting all point types from all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // deduct all point types from all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBe(false)
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(false)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // deduct all point types from all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductBasePoints: true,
        deductCorrectnessPoints: true,
        deductBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBe(false)
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBe(false)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // base points remain at zero (element settings)
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse1!.bonusPoints).toBe(0) // bonus points deducted to 0

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
    expect(appliedCorrection1!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted to reach 0
    expect(appliedCorrection1!.deductedBonusPoints).toBe(30) // 30 bonus points were deducted to reach 0

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(0) // base points deducted to 0
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse2!.bonusPoints).toBe(0) // bonus points deducted to 0

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
    expect(appliedCorrection2!.deductedBasePoints).toBe(20) // 20 base points were deducted to reach 0
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points were deducted to reach 0
    expect(appliedCorrection2!.deductedBonusPoints).toBe(60) // 60 bonus points were deducted to reach 0

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // base points remain at zero (element settings)
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse3!.bonusPoints).toBe(0) // bonus points deducted to 0

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection3!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted to reach 0
    expect(appliedCorrection3!.deductedBonusPoints).toBe(15) // 15 bonus points were deducted to reach 0

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points not awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse1!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // base points not awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse2!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection5!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // base points not awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse3!.bonusPoints).toBe(0) // bonus points not awarded

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(0)
    expect(appliedCorrection6!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)
  })

  it('[Instance Point Updates] Verify that awarding and deducting points from all course participants works correctly', async () => {
    const {
      instanceId1,
      instanceId2,
      SCQuestion,
      MCQuestion,
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

    // award and deduct points at the same time from all participants in the assessment course for instance 1 (affects participants 1, 2 and 3)
    const res1 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId1,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res1!.basePoints).toBeNull()
    expect(res1!.correctnessPoints).toBe(false)
    expect(res1!.bonusPoints).toBe(true)
    expect(res1!.reason).toBe('Test Reason')
    expect(res1!.studentReason).toBe('Student Test Reason')
    expect(res1!.correctedBy).not.toBeNull()
    expect(res1!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res1).not.toHaveProperty('participant') // no single participant for course correction
    expect(res1).toHaveProperty('instance')
    expect((res1 as any)!.instance).not.toBeNull()
    expect((res1 as any)!.instance!.id).toBe(instanceId1)
    expect((res1 as any)!.instance!.elementData).not.toBeNull()
    expect((res1 as any)!.instance!.elementData.name).toBe(SCQuestion.name)

    // award and deduct points at the same time from all participants in the assessment course for instance 2 (affects participant 1, 2 and 3)
    const res2 = await correctAssessmentPointsInstance(
      {
        instanceId: instanceId2,
        reason: 'Test Reason',
        studentReason: 'Student Test Reason',
        deductCorrectnessPoints: true,
        awardBonusPoints: true,
        scope: PointCorrectionType.ALL_COURSE,
      },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.type).toBe(PointCorrectionType.ALL_COURSE)
    expect(res2!.basePoints).toBeNull()
    expect(res2!.correctnessPoints).toBe(false)
    expect(res2!.bonusPoints).toBe(true)
    expect(res2!.reason).toBe('Test Reason')
    expect(res2!.studentReason).toBe('Student Test Reason')
    expect(res2!.correctedBy).not.toBeNull()
    expect(res2!.correctedBy!.id).toBe(userOneCtx.user.sub)
    expect(res2).not.toHaveProperty('participant') // no single participant for course correction
    expect(res2).toHaveProperty('instance')
    expect((res2 as any)!.instance).not.toBeNull()
    expect((res2 as any)!.instance!.id).toBe(instanceId2)
    expect((res2 as any)!.instance!.elementData).not.toBeNull()
    expect((res2 as any)!.instance!.elementData.name).toBe(MCQuestion.name)

    // verify that the responses by participant 1 were updated and corresponding applied corrections were created
    const updatedResponse1 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response1.id },
    })
    expect(updatedResponse1).not.toBeNull()
    expect(updatedResponse1!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse1!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse1!.bonusPoints).toBe(30) // bonus points unchanged, since they were already at the maximum value

    const appliedCorrection1 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p1Response1.id,
      },
    })
    expect(appliedCorrection1).not.toBeNull()
    expect(appliedCorrection1!.awardedBasePoints).toBe(0)
    expect(appliedCorrection1!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection1!.awardedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)
    expect(appliedCorrection1!.deductedBasePoints).toBe(0)
    expect(appliedCorrection1!.deductedCorrectnessPoints).toBe(50) // 50 correctness points were deducted to reach 0
    expect(appliedCorrection1!.deductedBonusPoints).toBe(0)

    const updatedResponse2 = await prisma.liveQuizResponse.findUnique({
      where: { id: p1Response2.id },
    })
    expect(updatedResponse2).not.toBeNull()
    expect(updatedResponse2!.basePoints).toBe(20) // remains unchanged
    expect(updatedResponse2!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse2!.bonusPoints).toBe(60) // bonus points unchanged, since they were already at the maximum value

    const appliedCorrection2 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: p1Response2.id,
      },
    })
    expect(appliedCorrection2).not.toBeNull()
    expect(appliedCorrection2!.awardedBasePoints).toBe(0)
    expect(appliedCorrection2!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection2!.awardedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)
    expect(appliedCorrection2!.deductedBasePoints).toBe(0)
    expect(appliedCorrection2!.deductedCorrectnessPoints).toBe(100) // 100 correctness points were deducted to reach 0
    expect(appliedCorrection2!.deductedBonusPoints).toBe(0)

    // verify that the response by participant 2 was updated and a corresponding applied correction was created
    const updatedResponse3 = await prisma.liveQuizResponse.findUnique({
      where: { id: p2Response1.id },
    })
    expect(updatedResponse3).not.toBeNull()
    expect(updatedResponse3!.basePoints).toBe(0) // remains unchanged
    expect(updatedResponse3!.correctnessPoints).toBe(0) // correctness points deducted to 0
    expect(updatedResponse3!.bonusPoints).toBe(30) // bonus points topped up to reach maximum available value

    const appliedCorrection3 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: p2Response1.id,
      },
    })
    expect(appliedCorrection3).not.toBeNull()
    expect(appliedCorrection3!.awardedBasePoints).toBe(0)
    expect(appliedCorrection3!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection3!.awardedBonusPoints).toBe(15) // 15 bonus points were awarded to reach the maximum available value
    expect(appliedCorrection3!.deductedBasePoints).toBe(0)
    expect(appliedCorrection3!.deductedCorrectnessPoints).toBe(25) // 25 correctness points were deducted to reach 0
    expect(appliedCorrection3!.deductedBonusPoints).toBe(0)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 1
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
    expect(newResponse1!.basePoints).toBe(0) // base points not awarded
    expect(newResponse1!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse1!.bonusPoints).toBe(30) // bonus points awarded to reach the maximum available value

    const appliedCorrection4 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res1!.id,
        responseId: newResponse1!.id,
      },
    })
    expect(appliedCorrection4).not.toBeNull()
    expect(appliedCorrection4!.awardedBasePoints).toBe(0)
    expect(appliedCorrection4!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection4!.awardedBonusPoints).toBe(30) // 30 bonus points were awarded to reach the maximum available value
    expect(appliedCorrection4!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection4!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 2 for instance 2
    const newResponse2 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant2.id,
        },
      },
    })
    expect(newResponse2).not.toBeNull()
    expect(newResponse2!.basePoints).toBe(0) // base points not awarded
    expect(newResponse2!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse2!.bonusPoints).toBe(60) // bonus points awarded to reach the maximum available value

    const appliedCorrection5 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse2!.id,
      },
    })
    expect(appliedCorrection5).not.toBeNull()
    expect(appliedCorrection5!.awardedBasePoints).toBe(0)
    expect(appliedCorrection5!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection5!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded to reach the maximum available value
    expect(appliedCorrection5!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection5!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)

    // verify that a new live quiz response and corresponding applied correction were created for participant 3 for instance 2
    const newResponse3 = await prisma.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId: instanceId2,
          elementBlockExecution: 0,
          participantId: participant3.id,
        },
      },
    })
    expect(newResponse3).not.toBeNull()
    expect(newResponse3!.basePoints).toBe(0) // base points not awarded
    expect(newResponse3!.correctnessPoints).toBe(0) // correctness points not awarded
    expect(newResponse3!.bonusPoints).toBe(60) // bonus points awarded to reach the maximum available value

    const appliedCorrection6 = await prisma.appliedPointCorrection.findFirst({
      where: {
        pointCorrectionId: res2!.id,
        responseId: newResponse3!.id,
      },
    })
    expect(appliedCorrection6).not.toBeNull()
    expect(appliedCorrection6!.awardedBasePoints).toBe(0)
    expect(appliedCorrection6!.awardedCorrectnessPoints).toBe(0)
    expect(appliedCorrection6!.awardedBonusPoints).toBe(60) // 60 bonus points were awarded to reach the maximum available value
    expect(appliedCorrection6!.deductedBasePoints).toBe(0) // base points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedCorrectnessPoints).toBe(0) // correctness points remain unchanged (not awarded before)
    expect(appliedCorrection6!.deductedBonusPoints).toBe(0) // bonus points remain unchanged (not awarded before)
  })
  // #endregion
})
