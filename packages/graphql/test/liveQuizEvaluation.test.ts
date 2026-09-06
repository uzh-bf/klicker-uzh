import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { createHmac } from 'crypto'
import type { EventEmitter } from 'events'
import {
  afterAll,
  afterEach,
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

type SingleChoiceQuestionOptions = {
  name: string
  content?: string
  explanation?: string
  choiceValues?: readonly string[]
  includeSolutionMetadata?: boolean
}

async function createSingleChoiceQuestion(
  prisma: PrismaClient,
  ownerId: string,
  {
    name,
    content = `${name} Content`,
    explanation,
    choiceValues = ['A', 'B'],
    includeSolutionMetadata = true,
  }: SingleChoiceQuestionOptions
) {
  const resolvedExplanation = includeSolutionMetadata
    ? (explanation ?? `${name} Explanation`)
    : explanation

  return prisma.element.create({
    data: {
      status: 'READY',
      type: 'SC',
      name,
      content,
      ...(resolvedExplanation === undefined
        ? {}
        : { explanation: resolvedExplanation }),
      options: {
        choices: choiceValues.map((value, ix) => ({
          ix,
          value,
          correct: ix === 0,
        })),
        displayMode: 'LIST',
        ...(includeSolutionMetadata
          ? { hasSampleSolution: true, hasAnswerFeedbacks: true }
          : {}),
      },
      ownerId,
    },
  })
}

type SyntheticQuestion = Awaited<ReturnType<typeof createSingleChoiceQuestion>>

function createEvaluationBlock(
  question: SyntheticQuestion,
  status: ElementBlockStatus,
  order: number,
  ownerId: string
) {
  const elementData = processElementData(question)

  return {
    order,
    status,
    elements: {
      create: [
        {
          type: ElementInstanceType.LIVE_QUIZ,
          elementId: question.id,
          elementType: ElementType.SC,
          order: 0,
          options: {},
          elementData,
          results: getInitialInstanceResults(elementData),
          anonymousResults: getInitialInstanceResults(elementData),
          ownerId,
        },
      ],
    },
  }
}

type EvaluationBlock = ReturnType<typeof createEvaluationBlock>

async function createEvaluationQuiz(
  prisma: PrismaClient,
  {
    courseId,
    ownerId,
    name,
    status,
    blocks,
    pinCode,
  }: {
    courseId: string
    ownerId: string
    name: string
    status: PublicationStatus
    blocks: EvaluationBlock[]
    pinCode?: string
  }
) {
  return prisma.liveQuiz.create({
    data: {
      name,
      displayName: name,
      ...(pinCode === undefined ? {} : { pinCode }),
      status,
      ownerId,
      courseId,
      blocks: { create: blocks },
    },
    include: {
      blocks: { include: { elements: true } },
    },
  })
}

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
    vi.stubEnv('APP_SECRET', 'evaluation-test-secret')
    const { userOneCtx: newUserOneCtx } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = newUserOneCtx
    utilMocks.getCachedBlockResults.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('strips element content for SCHEDULED blocks while preserving block status metadata', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question1 = await createSingleChoiceQuestion(
      prisma,
      userOneCtx.user.sub,
      { name: 'Single Choice Question 1' }
    )
    const question2 = await createSingleChoiceQuestion(
      prisma,
      userOneCtx.user.sub,
      { name: 'Single Choice Question 2', choiceValues: ['X', 'Y'] }
    )

    const liveQuiz = await createEvaluationQuiz(prisma, {
      name: 'Evaluation Quiz',
      status: PublicationStatus.PUBLISHED,
      ownerId: userOneCtx.user.sub,
      courseId: course.id,
      blocks: [
        createEvaluationBlock(
          question1,
          ElementBlockStatus.SCHEDULED,
          0,
          userOneCtx.user.sub
        ),
        createEvaluationBlock(
          question2,
          ElementBlockStatus.EXECUTED,
          1,
          userOneCtx.user.sub
        ),
      ],
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
    expect(executedRes.instances[0]?.name).toEqual(question2.name)
  })

  it.each([
    PublicationStatus.DRAFT,
    PublicationStatus.SCHEDULED,
  ])('returns metadata without evaluation content for HMAC requests to %s quizzes', async (status) => {
    const course = await seedCourse({}, userOneCtx)

    const question = await createSingleChoiceQuestion(
      prisma,
      userOneCtx.user.sub,
      { name: 'Draft HMAC Question' }
    )

    const liveQuiz = await createEvaluationQuiz(prisma, {
      name: 'Draft Quiz',
      pinCode: `pin-${status}`,
      status,
      ownerId: userOneCtx.user.sub,
      courseId: course.id,
      blocks: [
        createEvaluationBlock(
          question,
          ElementBlockStatus.EXECUTED,
          0,
          userOneCtx.user.sub
        ),
      ],
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

    expect(evaluation).toEqual({
      id: liveQuiz.id,
      name: liveQuiz.name,
      displayName: liveQuiz.displayName,
      status,
      courseLanguage: course.language,
      courseName: course.name,
      description: null,
      isAssessmentEnabled: null,
      pinCode: null,
      results: [],
      feedbacks: null,
      confusionFeedbacks: null,
    })

    const findQuiz = vi.fn(prisma.liveQuiz.findUnique.bind(prisma.liveQuiz))
    utilMocks.getCachedBlockResults.mockClear()
    const rejectedEvaluation = await getLiveQuizEvaluation(
      { id: liveQuiz.id, hmac: 'invalid' },
      {
        ...anonymousCtx,
        prisma: {
          ...prisma,
          liveQuiz: new Proxy(prisma.liveQuiz, {
            get(target, property, receiver) {
              return property === 'findUnique'
                ? findQuiz
                : Reflect.get(target, property, receiver)
            },
          }),
        },
      }
    )

    expect(rejectedEvaluation).toBeNull()
    expect(findQuiz).toHaveBeenCalledExactlyOnceWith({
      where: expect.objectContaining({ id: liveQuiz.id, isDeleted: false }),
      select: { id: true, namespace: true },
    })
    expect(utilMocks.getCachedBlockResults).not.toHaveBeenCalled()
  })

  it('strips evaluation content for authenticated non-published quizzes', async () => {
    const course = await seedCourse({}, userOneCtx)

    const question = await createSingleChoiceQuestion(
      prisma,
      userOneCtx.user.sub,
      { name: 'Draft Question' }
    )

    const liveQuiz = await createEvaluationQuiz(prisma, {
      name: 'Draft Quiz',
      status: PublicationStatus.DRAFT,
      ownerId: userOneCtx.user.sub,
      courseId: course.id,
      blocks: [
        createEvaluationBlock(
          question,
          ElementBlockStatus.EXECUTED,
          0,
          userOneCtx.user.sub
        ),
      ],
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

    const question = await createSingleChoiceQuestion(
      prisma,
      userOneCtx.user.sub,
      {
        name: 'Active Question',
        includeSolutionMetadata: false,
      }
    )

    const liveQuiz = await createEvaluationQuiz(prisma, {
      name: 'Live Active Quiz',
      status: PublicationStatus.PUBLISHED,
      ownerId: userOneCtx.user.sub,
      courseId: course.id,
      blocks: [
        createEvaluationBlock(
          question,
          ElementBlockStatus.ACTIVE,
          0,
          userOneCtx.user.sub
        ),
        createEvaluationBlock(
          question,
          ElementBlockStatus.SCHEDULED,
          1,
          userOneCtx.user.sub
        ),
      ],
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
