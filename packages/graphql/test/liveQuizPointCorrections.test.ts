import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import {} from 'src/ops.js'
import { ContextWithUser } from '../src/lib/context.js'
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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

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
    } = await seedLiveQuizWithResponses({
      userOneCtx,
      userTwoCtx,
      userThreeCtx,
      userFourCtx,
    })

    // TODO
  })

  // TODO: make sure that all test cases also cover the combination of awarding and deducting points
  // #endregion
})
