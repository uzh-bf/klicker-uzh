import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  FreeTextEvaluationSource,
  FreeTextEvaluationStatus,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { createYoga } from 'graphql-yoga'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

const TEST_PREFIX = `free-text-graphql-${Date.now()}`
const semanticConfig: SemanticFreeTextConfig = {
  contract_version: '1',
  question_language: 'en',
  attempt_limit: 2,
  solution_reveal_enabled: true,
  accepted_exact_answers: [],
  reference_solution: 'Diversification reduces asset-specific risk.',
  rubric_schema: {
    schema_version: '1.0',
    name: 'Diversification',
    description: 'Explain the principal benefit of diversification.',
    rubrics: [
      {
        id: 'risk',
        name: 'Risk reduction',
        description: 'Connect diversification to idiosyncratic risk.',
        weight: 1,
        achievement_levels: [
          {
            name: 'complete',
            description: 'Makes the complete connection.',
            normalized_score: 100,
          },
          {
            name: 'missing',
            description: 'Does not make the connection.',
            normalized_score: 0,
          },
        ],
      },
    ],
  },
}

let fixture: Awaited<ReturnType<typeof createFixture>>

function participantContext(participantId: string): ContextWithUser {
  return {
    prisma,
    emitter: { emit: vi.fn() },
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.READ_ONLY,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    tasks: {
      evaluateFreeTextAttempt: { runNoWait: vi.fn() },
    },
  } as unknown as ContextWithUser
}

async function executeRetry(context: ContextWithUser, attemptId: string) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation RetryFreeTextEvaluation($attemptId: String!) {
          retryFreeTextEvaluation(attemptId: $attemptId) {
            cycleId
          }
        }
      `,
      variables: { attemptId },
    }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string; extensions?: { code?: string } }[]
  }
}

async function createFixture() {
  const suffix = randomUUID()
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${TEST_PREFIX}-${suffix}`,
      email: `${TEST_PREFIX}-${suffix}@example.org`,
      catalystIndividual: true,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${suffix}`,
      displayName: 'Semantic free-text GraphQL test',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      groupDeadlineDate: new Date(),
      authType: CourseAuthType.SSO,
      ownerId: lecturer.id,
    },
  })
  const participants = await Promise.all(
    ['owner', 'other'].map((label) =>
      prisma.participant.create({
        data: {
          username: `${TEST_PREFIX}-${label}-${suffix}`,
          password: 'not-used',
          isActive: true,
          participations: {
            create: { courseId: course.id, isActive: true },
          },
        },
        include: { participations: true },
      })
    )
  )
  const element = await prisma.element.create({
    data: {
      name: 'Why diversify?',
      content: 'What is the principal benefit of diversification?',
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        semanticEvaluation: semanticConfig,
      },
      ownerId: lecturer.id,
    },
  })
  const elementData = processElementData(element)
  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${TEST_PREFIX}-${suffix}`,
      displayName: 'Semantic free-text GraphQL test',
      status: PublicationStatus.PUBLISHED,
      courseId: course.id,
      ownerId: lecturer.id,
      stacks: {
        create: {
          order: 0,
          type: ElementStackType.PRACTICE_QUIZ,
          elements: {
            create: {
              order: 0,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.FREE_TEXT,
              elementId: element.id,
              ownerId: lecturer.id,
              options: { pointsMultiplier: 1, resetTimeDays: 6 },
              elementData,
              results: getInitialInstanceResults(elementData),
              anonymousResults: getInitialInstanceResults(elementData),
              instanceStatistics: { create: {} },
            },
          },
        },
      },
    },
    include: { stacks: { include: { elements: true } } },
  })
  const cycle = await prisma.freeTextPracticeCycle.create({
    data: {
      ordinal: 1,
      attemptLimit: 2,
      pointsRewardEligible: true,
      xpRewardEligible: true,
      participantId: participants[0]!.id,
      participationId: participants[0]!.participations[0]!.id,
      elementInstanceId: practiceQuiz.stacks[0]!.elements[0]!.id,
      practiceQuizId: practiceQuiz.id,
    },
  })
  const attempt = await prisma.freeTextAttempt.create({
    data: {
      cycleId: cycle.id,
      ordinal: 1,
      clientSubmissionId: randomUUID(),
      answer: 'It spreads investments across assets.',
      answerTime: 3,
      evaluationStatus: FreeTextEvaluationStatus.EVALUATED,
      evaluationSource: FreeTextEvaluationSource.SEMANTIC,
      retryable: false,
      completedAt: new Date(),
      rubricSchemaVersion: semanticConfig.rubric_schema.schema_version,
      rubricSchemaHash: 'synthetic-test-hash',
      aggregateScore: 50,
    },
  })

  return { lecturer, course, participants, attempt }
}

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await prisma.course.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  })
  await prisma.participant.deleteMany({
    where: { username: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { shortname: { startsWith: TEST_PREFIX } },
  })
  await prisma.$disconnect()
})

describe('semantic free-text GraphQL boundary', () => {
  it('exposes a stable code for an owned non-retryable attempt', async () => {
    const result = await executeRetry(
      participantContext(fixture.participants[0]!.id),
      fixture.attempt.id
    )

    expect(result.data).toBeNull()
    expect(result.errors?.[0]).toMatchObject({
      message: 'Free-text evaluation cannot be retried',
      extensions: { code: 'FREE_TEXT_EVALUATION_NOT_RETRYABLE' },
    })
  })

  it('does not reveal another participant attempt through the mutation', async () => {
    const before = await prisma.freeTextAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })
    const result = await executeRetry(
      participantContext(fixture.participants[1]!.id),
      fixture.attempt.id
    )
    const after = await prisma.freeTextAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })

    expect(result.data).toBeNull()
    expect(result.errors?.[0]).toMatchObject({
      message: 'Free-text evaluation attempt not found',
      extensions: { code: 'NOT_FOUND' },
    })
    expect(after.evaluationRevision).toBe(before.evaluationRevision)
    expect(after.evaluationStatus).toBe(before.evaluationStatus)
    expect(after.workflowRunId).toBe(before.workflowRunId)
  })
})
