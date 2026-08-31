import { prisma } from '@klicker-uzh/prisma'
import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ElementOptionsFreeText } from '@klicker-uzh/types'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { Context } from '../src/lib/context.js'
import {
  freeTextExplanationForViewer,
  freeTextSolutionsForViewer,
  semanticEvaluationForViewer,
} from '../src/schema/elementData.js'
import { manipulateElement } from '../src/services/elements.js'
import { getRunningLiveQuiz } from '../src/services/liveQuizzes.js'
import { getMicroLearningData } from '../src/services/microLearning.js'
import { getPracticeQuizData } from '../src/services/practiceQuizzes.js'
import {
  cleanupFixtures,
  createFixture,
  lecturerContext,
  participantContext,
  semanticConfig,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-authoring-${Date.now()}`
type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture
beforeEach(async () => {
  fixture = await createFixture(TEST_PREFIX)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
afterAll(async () => {
  await cleanupFixtures(TEST_PREFIX)
})

describe('semantic free-text authoring', () => {
  it('preserves semantic configuration when an older client omits the field', async () => {
    await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name: 'Why diversify?',
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          solutions: ['Diversification reduces idiosyncratic risk.'],
        },
      },
      lecturerContext(fixture.lecturer.id)
    )

    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })
    expect(element.options).toMatchObject({
      semanticEvaluation: semanticConfig,
    })
  })

  it('removes semantic configuration when a client explicitly disables it', async () => {
    await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name: 'Why diversify?',
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          solutions: ['Diversification reduces idiosyncratic risk.'],
          semanticEvaluation: null,
        },
      },
      lecturerContext(fixture.lecturer.id)
    )

    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })
    expect(
      (element.options as ElementOptionsFreeText).semanticEvaluation
    ).toBeUndefined()
  })

  it('rejects invalid semantic configuration before persistence', async () => {
    const result = await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name: 'Why diversify?',
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          solutions: ['Diversification reduces idiosyncratic risk.'],
          semanticEvaluation: {
            ...semanticConfig,
            attempt_limit: 0,
          },
        },
      },
      lecturerContext(fixture.lecturer.id)
    )
    expect(result).toBeNull()
  })

  it('enforces semantic authoring entitlement inside the element service', async () => {
    const ctx = lecturerContext(fixture.lecturer.id)
    ctx.user.catalystInstitutional = false
    ctx.user.catalystIndividual = false

    const result = await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        options: {
          hasSampleSolution: true,
          semanticEvaluation: { ...semanticConfig, attempt_limit: 3 },
        },
      },
      ctx
    )

    expect(result).toBeNull()
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })
    expect(
      (element.options as ElementOptionsFreeText).semanticEvaluation
        ?.attempt_limit
    ).toBe(2)
  })

  it('rejects semantic configuration on creation without entitlement', async () => {
    const ctx = lecturerContext(fixture.lecturer.id)
    ctx.user.catalystInstitutional = false
    ctx.user.catalystIndividual = false
    const name = `${TEST_PREFIX}-blocked-creation`

    const result = await manipulateElement(
      {
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name,
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          semanticEvaluation: semanticConfig,
        },
      },
      ctx
    )

    expect(result).toBeNull()
    await expect(
      prisma.element.findFirst({ where: { name } })
    ).resolves.toBeNull()
  })

  it('accepts a semantic reference solution without a legacy exact solution', async () => {
    const result = await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name: 'Why diversify?',
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          semanticEvaluation: semanticConfig,
        },
      },
      lecturerContext(fixture.lecturer.id)
    )

    expect(result).not.toBeNull()
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })
    expect(element.options).toMatchObject({
      hasSampleSolution: true,
      semanticEvaluation: semanticConfig,
    })
    expect(
      (element.options as ElementOptionsFreeText).solutions
    ).toBeUndefined()
  })

  it('withholds semantic authoring data from participant activity reads', async () => {
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })

    expect(
      semanticEvaluationForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.PARTICIPANT
      )
    ).toBeNull()
    expect(
      semanticEvaluationForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.USER
      )
    ).toEqual(semanticConfig)
    expect(
      freeTextSolutionsForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.PARTICIPANT
      )
    ).toBeNull()
    expect(
      freeTextExplanationForViewer(
        {
          ...element,
          id: String(element.id),
          elementId: element.id,
          options: element.options as ElementOptionsFreeText,
        },
        UserRole.PARTICIPANT
      )
    ).toBeNull()
  })

  it('withholds semantic authoring data from unrelated lecturers', async () => {
    const unrelated = await createFixture(`${TEST_PREFIX}-unrelated`)

    const unauthorizedView = await getPracticeQuizData(
      { id: fixture.practiceQuiz.id },
      lecturerContext(unrelated.lecturer.id)
    )
    const unauthorizedData =
      unauthorizedView?.stacks[0]?.elements[0]?.elementData
    expect(unauthorizedData?.type).toBe(ElementType.FREE_TEXT)
    if (unauthorizedData?.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text element instance')
    }
    expect(unauthorizedData.options.semanticEvaluation).toBeUndefined()
    expect(unauthorizedData.options.solutions).toBeNull()
    expect(unauthorizedData.explanation).toBeNull()

    const ownerView = await getPracticeQuizData(
      { id: fixture.practiceQuiz.id },
      lecturerContext(fixture.lecturer.id)
    )
    const ownerData = ownerView?.stacks[0]?.elements[0]?.elementData
    expect(ownerData?.type).toBe(ElementType.FREE_TEXT)
    if (ownerData?.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text element instance')
    }
    expect(ownerData.options.semanticEvaluation).toEqual(semanticConfig)
    expect(ownerData.options.solutions).toEqual([
      'Diversification reduces idiosyncratic risk.',
    ])
  })

  it('loads published practice quizzes for anonymous viewers', async () => {
    const anonymousContext = {
      ...lecturerContext(fixture.lecturer.id),
      user: undefined,
    } as unknown as Context

    const view = await getPracticeQuizData(
      { id: fixture.practiceQuiz.id },
      anonymousContext
    )

    expect(view?.id).toBe(fixture.practiceQuiz.id)
  })

  it('withholds semantic authoring data from unrelated lecturers in microlearning', async () => {
    const unrelated = await createFixture(`${TEST_PREFIX}-micro-unrelated`)
    const microLearning = await prisma.microLearning.create({
      data: {
        name: `${TEST_PREFIX}-microlearning`,
        displayName: 'Semantic microlearning',
        status: PublicationStatus.PUBLISHED,
        scheduledStartAt: new Date(Date.now() - 60_000),
        scheduledEndAt: new Date(Date.now() + 60_000),
        courseId: fixture.course.id,
        ownerId: fixture.lecturer.id,
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.MICROLEARNING,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.MICROLEARNING,
                elementType: ElementType.FREE_TEXT,
                elementId: fixture.instance.elementId,
                ownerId: fixture.lecturer.id,
                options: fixture.instance.options,
                elementData: fixture.instance.elementData,
                results: fixture.instance.results,
                anonymousResults: fixture.instance.anonymousResults,
              },
            },
          },
        },
      },
    })

    const unauthorizedView = await getMicroLearningData(
      { id: microLearning.id },
      lecturerContext(unrelated.lecturer.id)
    )
    const unauthorizedData =
      unauthorizedView?.stacks[0]?.elements[0]?.elementData
    expect(unauthorizedData?.type).toBe(ElementType.FREE_TEXT)
    if (unauthorizedData?.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text element instance')
    }
    expect(unauthorizedData.options.semanticEvaluation).toBeUndefined()
    expect(unauthorizedData.options.solutions).toEqual([
      'Diversification reduces idiosyncratic risk.',
    ])
    expect(unauthorizedData.explanation).toBe(
      'Diversification reduces asset-specific risk.'
    )

    const ownerView = await getMicroLearningData(
      { id: microLearning.id },
      lecturerContext(fixture.lecturer.id)
    )
    const ownerData = ownerView?.stacks[0]?.elements[0]?.elementData
    expect(ownerData?.type).toBe(ElementType.FREE_TEXT)
    if (ownerData?.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text element instance')
    }
    expect(ownerData.options.semanticEvaluation).toEqual(semanticConfig)
  })

  it('withholds semantic authoring and solution data from live quiz reads', async () => {
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: `${TEST_PREFIX}-live-quiz`,
        displayName: 'Semantic live quiz',
        status: PublicationStatus.PUBLISHED,
        courseId: fixture.course.id,
        ownerId: fixture.lecturer.id,
        blocks: {
          create: {
            order: 0,
            status: ElementBlockStatus.EXECUTED,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.FREE_TEXT,
                elementId: fixture.instance.elementId,
                ownerId: fixture.lecturer.id,
                options: fixture.instance.options,
                elementData: fixture.instance.elementData,
                results: fixture.instance.results,
                anonymousResults: fixture.instance.anonymousResults,
              },
            },
          },
        },
      },
    })

    const participantView = await getRunningLiveQuiz(
      { id: liveQuiz.id },
      participantContext(fixture.participant.id)
    )
    const participantData = participantView?.blocks[0]?.elements[0]?.elementData
    expect(participantData?.type).toBe(ElementType.FREE_TEXT)
    if (participantData?.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text element instance')
    }
    expect(participantData.options.semanticEvaluation).toBeUndefined()
    expect(participantData.options.solutions).toBeUndefined()
    expect(participantData.explanation).toBeNull()
  })
})
