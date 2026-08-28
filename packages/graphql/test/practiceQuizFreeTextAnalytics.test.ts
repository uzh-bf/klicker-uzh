import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementInstanceType,
  ElementType,
  FreeTextCorrectnessCategory,
  FreeTextEvaluationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPracticeQuizEvaluation } from '../src/services/practiceQuizzes.js'
import {
  cleanupFixtures,
  createFixture,
  lecturerContext,
  semanticConfig,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `practice-quiz-free-text-analytics-${Date.now()}`
type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture

async function createFreeTextInstance({
  semantic,
  order,
}: {
  semantic: boolean
  order: number
}) {
  const element = await prisma.element.create({
    data: {
      name: semantic ? 'Semantic follow-up' : 'Legacy free-text',
      content: 'Explain diversification.',
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        solutions: ['It reduces idiosyncratic risk.'],
        ...(semantic ? { semanticEvaluation: semanticConfig } : {}),
      },
      ownerId: fixture.lecturer.id,
    },
  })
  const elementData = processElementData(element)

  return await prisma.elementInstance.create({
    data: {
      order,
      type: ElementInstanceType.PRACTICE_QUIZ,
      elementType: ElementType.FREE_TEXT,
      elementId: element.id,
      elementStackId: fixture.instance.elementStackId,
      ownerId: fixture.lecturer.id,
      options: { pointsMultiplier: 1, resetTimeDays: 6 },
      elementData,
      results: getInitialInstanceResults(elementData),
      anonymousResults: getInitialInstanceResults(elementData),
      instanceStatistics: { create: {} },
    },
  })
}

async function createCycle(
  instanceId: number,
  ordinal: number,
  revealed = false
) {
  return await prisma.freeTextPracticeCycle.create({
    data: {
      ordinal,
      attemptLimit: 2,
      pointsRewardEligible: true,
      xpRewardEligible: true,
      solutionRevealedAt: revealed ? new Date() : undefined,
      participantId: fixture.participant.id,
      participationId: fixture.participant.participations[0]!.id,
      elementInstanceId: instanceId,
      practiceQuizId: fixture.practiceQuiz.id,
    },
  })
}

async function createAttempt({
  cycleId,
  ordinal,
  evaluationStatus,
  correctness,
}: {
  cycleId: string
  ordinal: number
  evaluationStatus: FreeTextEvaluationStatus
  correctness?: FreeTextCorrectnessCategory
}) {
  await prisma.freeTextAttempt.create({
    data: {
      cycleId,
      ordinal,
      clientSubmissionId: randomUUID(),
      answer: `synthetic-answer-${ordinal}`,
      answerTime: 1,
      evaluationStatus,
      correctness,
      rubricSchemaVersion: semanticConfig.rubric_schema.schema_version,
      rubricSchemaHash: 'synthetic-test-hash',
    },
  })
}

beforeAll(async () => {
  fixture = await createFixture(TEST_PREFIX)
})

afterAll(async () => {
  await cleanupFixtures(TEST_PREFIX)
  await prisma.$disconnect()
})

describe('practice quiz free-text retry analytics', () => {
  it('aggregates only semantic instances without hydrating attempt data', async () => {
    const semanticInstance = await createFreeTextInstance({
      semantic: true,
      order: 1,
    })
    const legacyInstance = await createFreeTextInstance({
      semantic: false,
      order: 2,
    })

    const firstCycle = await createCycle(semanticInstance.id, 1)
    await createAttempt({
      cycleId: firstCycle.id,
      ordinal: 1,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      correctness: FreeTextCorrectnessCategory.INCORRECT,
    })
    await createAttempt({
      cycleId: firstCycle.id,
      ordinal: 2,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      correctness: FreeTextCorrectnessCategory.CORRECT,
    })

    const revealedCycle = await createCycle(semanticInstance.id, 2, true)
    await createAttempt({
      cycleId: revealedCycle.id,
      ordinal: 1,
      evaluationStatus: FreeTextEvaluationStatus.UNAVAILABLE,
    })
    await createAttempt({
      cycleId: revealedCycle.id,
      ordinal: 2,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      correctness: FreeTextCorrectnessCategory.PARTIAL,
    })

    const successfulCycle = await createCycle(semanticInstance.id, 3)
    await createAttempt({
      cycleId: successfulCycle.id,
      ordinal: 1,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      correctness: FreeTextCorrectnessCategory.CORRECT,
    })

    const legacyCycle = await createCycle(legacyInstance.id, 1)
    await createAttempt({
      cycleId: legacyCycle.id,
      ordinal: 1,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      correctness: FreeTextCorrectnessCategory.CORRECT,
    })

    const evaluation = await getPracticeQuizEvaluation(
      { id: fixture.practiceQuiz.id },
      lecturerContext(fixture.lecturer.id)
    )
    const instances = evaluation!.results.flatMap((stack) => stack.instances)
    const analytics = instances.find((item) => item.id === semanticInstance.id)
    const zeroCycleAnalytics = instances.find(
      (item) => item.id === fixture.instance.id
    )
    const legacyAnalytics = instances.find(
      (item) => item.id === legacyInstance.id
    )

    expect(analytics).toMatchObject({
      retryAnalytics: {
        cycleCount: 3,
        totalAttempts: 5,
        averageAttempts: 5 / 3,
        successRate: 2 / 3,
        revealRate: 1 / 3,
        unavailableCount: 1,
        first: { correct: 1, partial: 1, incorrect: 1 },
        best: { correct: 2, partial: 1, incorrect: 0 },
      },
    })
    expect(zeroCycleAnalytics).toMatchObject({
      retryAnalytics: {
        cycleCount: 0,
        totalAttempts: 0,
        averageAttempts: 0,
        successRate: 0,
        revealRate: 0,
        unavailableCount: 0,
        first: { correct: 0, partial: 0, incorrect: 0 },
        best: { correct: 0, partial: 0, incorrect: 0 },
      },
    })
    expect(legacyAnalytics).not.toHaveProperty('retryAnalytics')
  })
})
