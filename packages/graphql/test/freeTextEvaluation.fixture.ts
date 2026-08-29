import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

export const semanticConfig: SemanticFreeTextConfig = {
  contract_version: '1',
  question_language: 'en',
  attempt_limit: 2,
  solution_reveal_enabled: true,
  accepted_exact_answers: ['Diversification reduces idiosyncratic risk.'],
  reference_solution:
    'Diversification reduces idiosyncratic risk by combining imperfectly correlated assets.',
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
            name: 'partial',
            description: 'Makes part of the connection.',
            normalized_score: 60,
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

export function workflowRunRef() {
  return { getWorkflowRunId: vi.fn().mockResolvedValue(randomUUID()) }
}

export function participantContext(
  participantId: string,
  schedule = vi.fn().mockResolvedValue(workflowRunRef())
): ContextWithUser {
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
    tasks: { evaluateFreeTextAttempt: { runNoWait: schedule } },
  } as unknown as ContextWithUser
}

export function lecturerContext(lecturerId: string): ContextWithUser {
  return {
    prisma,
    emitter: { emit: vi.fn() },
    user: {
      sub: lecturerId,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  } as unknown as ContextWithUser
}

export async function createFixture(prefix: string) {
  const suffix = randomUUID()
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${prefix}-${suffix}`,
      email: `${prefix}-${suffix}@example.org`,
      catalystIndividual: true,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: `${prefix}-${suffix}`,
      displayName: 'Semantic free-text test',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      groupDeadlineDate: new Date(),
      authType: CourseAuthType.SSO,
      ownerId: lecturer.id,
    },
  })
  const participant = await prisma.participant.create({
    data: {
      username: `${prefix}-${suffix}`,
      password: 'not-used',
      isActive: true,
      participations: { create: { courseId: course.id, isActive: true } },
    },
    include: { participations: true },
  })
  const element = await prisma.element.create({
    data: {
      name: 'Why diversify?',
      content: 'What is the principal benefit of diversification?',
      explanation: 'Diversification reduces asset-specific risk.',
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        solutions: ['Diversification reduces idiosyncratic risk.'],
        semanticEvaluation: semanticConfig,
      },
      ownerId: lecturer.id,
    },
  })
  const elementData = processElementData(element)
  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${prefix}-${suffix}`,
      displayName: 'Semantic free-text test',
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
  return {
    lecturer,
    course,
    participant,
    practiceQuiz,
    instance: practiceQuiz.stacks[0]!.elements[0]!,
  }
}

export async function cleanupFixtures(prefix: string) {
  await prisma.course.deleteMany({ where: { name: { startsWith: prefix } } })
  await prisma.participant.deleteMany({
    where: { username: { startsWith: prefix } },
  })
  await prisma.user.deleteMany({ where: { shortname: { startsWith: prefix } } })
}

export function evaluatorResponse(
  taskBundleId: string,
  normalizedScore: number,
  proposedLevel: string
) {
  return {
    contract_version: '1' as const,
    task_bundle_id: taskBundleId,
    evaluator_version: 'test-evaluator-1',
    model_version: 'test-model-1',
    rubric_assessments: [
      {
        task_bundle_id: taskBundleId,
        rubric_id: 'risk',
        rubric_name: 'Risk reduction',
        proposed_level: proposedLevel,
        normalized_score: normalizedScore,
        justification: 'The response addresses risk reduction.',
        evidence_ids: [],
        confidence: 0.9,
        needs_review: false,
        review_flags: [],
        used_evidence_ids: [],
        unsupported_claims: [],
        rationale: 'The answer identifies diversification of risk.',
      },
    ],
  }
}
