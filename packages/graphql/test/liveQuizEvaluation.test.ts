import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { createHmac } from 'crypto'
import { EventEmitter } from 'events'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const utilMocks = vi.hoisted(() => ({
  getCachedBlockResults: vi.fn(),
}))

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const original = await importOriginal<typeof import('@klicker-uzh/util')>()
  return { ...original, ...utilMocks }
})

import type { Context, ContextWithUser } from '../src/lib/context.js'
import { getLiveQuizEvaluation } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Unit tests for live quiz evaluation service', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

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
    const { userOneCtx: newUserOneCtx } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = newUserOneCtx
    utilMocks.getCachedBlockResults.mockReset()
  })

  it('strips element content for SCHEDULED blocks while preserving block status metadata', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question1 = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Single Choice Question 1',
        content: 'Question 1 Content',
        explanation: 'Question 1 Explanation',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        ownerId: userOneCtx.user.sub,
      },
    })

    const question2 = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Single Choice Question 2',
        content: 'Question 2 Content',
        explanation: 'Question 2 Explanation',
        options: {
          choices: [
            { ix: 0, value: 'X', correct: true },
            { ix: 1, value: 'Y', correct: false },
          ],
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        ownerId: userOneCtx.user.sub,
      },
    })

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Evaluation Quiz',
        displayName: 'Evaluation Quiz',
        status: PublicationStatus.PUBLISHED,
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
        blocks: {
          create: [
            {
              order: 0,
              status: ElementBlockStatus.SCHEDULED,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question1.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question1),
                    results: getInitialInstanceResults(
                      processElementData(question1)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question1)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
            {
              order: 1,
              status: ElementBlockStatus.EXECUTED,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question2.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question2),
                    results: getInitialInstanceResults(
                      processElementData(question2)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question2)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const evaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id },
      userOneCtx
    )

    expect(evaluation).not.toBeNull()
    expect(evaluation?.results).toHaveLength(2)

    const results = evaluation!.results
    // scheduled block must carry empty instances so solutions are not leaked
    const scheduledRes = results[0]!
    expect(scheduledRes.status).toEqual(ElementBlockStatus.SCHEDULED)
    expect(scheduledRes.instanceCount).toBe(1)
    expect(scheduledRes.instances).toEqual([])

    // executed block must carry full instances
    const executedRes = results[1]!
    expect(executedRes.status).toEqual(ElementBlockStatus.EXECUTED)
    expect(executedRes.instances.length).toBeGreaterThan(0)
    expect(executedRes.instances[0]?.name).toEqual('Single Choice Question 2')
  })

  it('returns metadata without evaluation content for HMAC requests to DRAFT quizzes', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Draft HMAC Question',
        content: 'Draft HMAC Question Content',
        explanation: 'Draft HMAC Question Explanation',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        ownerId: userOneCtx.user.sub,
      },
    })

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Draft Quiz',
        displayName: 'Draft Quiz',
        status: PublicationStatus.DRAFT,
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
        blocks: {
          create: [
            {
              order: 0,
              status: ElementBlockStatus.EXECUTED,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question),
                    results: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
    hmacEncoder.update(liveQuiz.namespace + liveQuiz.id)
    const validHmac = hmacEncoder.digest('hex')

    const anonymousCtx: Context = {
      ...userOneCtx,
      user: undefined,
    }

    const evaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id, hmac: validHmac },
      anonymousCtx
    )

    expect(evaluation).toMatchObject({
      id: liveQuiz.id,
      displayName: 'Draft Quiz',
      status: PublicationStatus.DRAFT,
      courseName: course.name,
      results: [],
    })

    const rejectedEvaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id, hmac: 'invalid' },
      anonymousCtx
    )

    expect(rejectedEvaluation).toBeNull()
  })

  it('strips evaluation content for authenticated non-published quizzes', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Draft Question',
        content: 'Draft Question Content',
        explanation: 'Draft Question Explanation',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        ownerId: userOneCtx.user.sub,
      },
    })

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Draft Quiz',
        displayName: 'Draft Quiz',
        status: PublicationStatus.DRAFT,
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
        blocks: {
          create: [
            {
              order: 0,
              status: ElementBlockStatus.EXECUTED,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question),
                    results: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    const evaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id },
      userOneCtx
    )

    expect(evaluation).not.toBeNull()
    expect(evaluation?.status).toEqual(PublicationStatus.DRAFT)
    expect(evaluation?.results).toHaveLength(1)
    expect(evaluation?.results[0]?.instanceCount).toBe(1)
    expect(evaluation?.results[0]?.instances).toEqual([])
  })

  it('deduplicates active block in-place instead of appending duplicate block', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question = await prisma.element.create({
      data: {
        status: 'READY',
        type: 'SC',
        name: 'Active Question',
        content: 'Active Question Content',
        options: {
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
          displayMode: 'LIST',
        },
        ownerId: userOneCtx.user.sub,
      },
    })

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Active Quiz',
        displayName: 'Live Active Quiz',
        status: PublicationStatus.PUBLISHED,
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
        blocks: {
          create: [
            {
              order: 0,
              status: ElementBlockStatus.ACTIVE,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question),
                    results: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
            {
              order: 1,
              status: ElementBlockStatus.SCHEDULED,
              elements: {
                create: [
                  {
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId: question.id,
                    elementType: ElementType.SC,
                    order: 0,
                    options: {},
                    elementData: processElementData(question),
                    results: getInitialInstanceResults(
                      processElementData(question)
                    ),
                    anonymousResults: getInitialInstanceResults(
                      processElementData(question)
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
        blocks: { include: { elements: true } },
      },
    })

    expect(liveQuiz.blocks).toHaveLength(2)
    const activeBlock = liveQuiz.blocks[0]!
    const scheduledBlock = liveQuiz.blocks[1]!
    const activeInstance = activeBlock.elements[0]!

    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { activeBlockId: activeBlock.id },
    })

    // Mock cached results for active block
    utilMocks.getCachedBlockResults.mockResolvedValue({
      instanceResults: {
        [activeInstance.id]: {
          anonymousResults: { choices: { 0: 5, 1: 0 }, total: 5 },
        },
      },
    })

    const evaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id },
      userOneCtx
    )

    expect(evaluation).not.toBeNull()
    // Must contain exactly 2 blocks, NOT 3
    expect(evaluation?.results).toHaveLength(2)

    const results = evaluation!.results
    const stackIds = results.map((r) => r.stackId)
    expect(stackIds).toEqual([activeBlock.id, scheduledBlock.id])
    expect(new Set(stackIds).size).toEqual(2)

    // First block should be marked active: true
    expect(results[0]!.stackActive).toBe(true)
    expect(results[0]!.instances).toHaveLength(1)
    expect(results[0]!.instances[0]).toMatchObject({
      id: activeInstance.id,
      results: { totalAnswers: 5, anonymousAnswers: 5 },
    })
    expect(results[1]!.stackActive).toBe(false)
  })
})
