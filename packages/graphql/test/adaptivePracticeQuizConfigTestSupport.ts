import { prisma } from '@klicker-uzh/prisma'
import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementOrderType,
  ElementType,
  PracticeQuizMode,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { getAdaptivePracticeQuizPreview } from '../src/services/adaptivePracticeQuizConfig.js'
import {
  createCompetenceTree,
  linkCompetenceTreeToCourse,
  type CompetenceTreeInput,
} from '../src/services/competenceTreeManagement.js'
import { manipulatePracticeQuiz } from '../src/services/practiceQuizzes.js'

let nextCoursePin = 4100
export type TreeFixture = {
  treeId: string
  rootIds: number[]
  assignmentIds: number[]
  elementIds: number[]
}

export function getSchemaFieldNames(typeName: string): string[] {
  const type = schema.getType(typeName) as
    | { getFields?: () => Record<string, unknown> }
    | undefined
  if (!type?.getFields) throw new Error(`Missing schema type ${typeName}.`)
  return Object.keys(type.getFields()).sort()
}

export async function waitForElementPermissionRevocationLock(
  elementId: number
) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Element"
          WHERE "id" = ${elementId}
          FOR SHARE NOWAIT
        `
      })
    } catch (error) {
      const metadata = (
        error as {
          meta?: {
            code?: string
            driverAdapterError?: {
              cause?: { code?: string; originalCode?: string }
            }
          }
        }
      ).meta
      const databaseCode =
        metadata?.code ??
        metadata?.driverAdapterError?.cause?.originalCode ??
        metadata?.driverAdapterError?.cause?.code
      if (databaseCode === '55P03') {
        return
      }
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the element revocation lock.')
}

export function contextFor(
  userId: string,
  scheduledTaskCreate: ReturnType<typeof vi.fn>,
  scheduledTaskDelete: ReturnType<typeof vi.fn>
): ContextWithUser {
  return {
    prisma,
    emitter: new EventEmitter(),
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: true,
      catalystIndividual: false,
    },
    tasks: {
      publishScheduledPracticeQuiz: { schedule: scheduledTaskCreate },
    },
    hatchet: { scheduled: { delete: scheduledTaskDelete } },
  } as unknown as ContextWithUser
}

export async function createCourse(ownerId: string) {
  const startDate = new Date(Date.now() - 86_400_000)
  const endDate = new Date(Date.now() + 7 * 86_400_000)
  return await prisma.course.create({
    data: {
      name: `course-${crypto.randomUUID()}`,
      displayName: 'Adaptive course',
      ownerId,
      pinCode: nextCoursePin++,
      startDate,
      endDate,
      groupDeadlineDate: endDate,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      isAdaptiveLearningEnabled: true,
    },
  })
}

export async function createTreeFixture(
  courseId: string,
  ctx: ContextWithUser,
  suffix = 'main'
): Promise<TreeFixture> {
  const elementSpecs = ['Reading', 'Writing'].flatMap((competence) =>
    ['basic', 'advanced'].flatMap((levelKey) =>
      Array.from({ length: 5 }, (_, index) => ({
        competence,
        levelKey,
        index,
      }))
    )
  )
  const elements = await Promise.all(
    elementSpecs.map(({ competence, levelKey, index }) =>
      createNumericalElement(
        `${competence} ${levelKey} numerical ${index + 1}${suffix === 'main' ? '' : ` ${suffix}`}`,
        ctx
      )
    )
  )
  const input: CompetenceTreeInput = {
    name: `adaptive-tree-${suffix}-${crypto.randomUUID()}`,
    displayName: `Adaptive tree ${suffix}`,
    maxDepth: 5,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.7,
    levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
    levels: [
      { key: 'basic', label: 'Basic', order: 0 },
      { key: 'advanced', label: 'Advanced', order: 1 },
    ],
    nodes: [
      {
        key: 'reading',
        kind: 'COMPETENCE',
        name: 'Reading',
        order: 0,
        weight: 2,
      },
      {
        key: 'scanning',
        parentKey: 'reading',
        kind: 'SUBCOMPETENCE',
        name: 'Scanning',
        order: 0,
      },
      {
        key: 'writing',
        kind: 'COMPETENCE',
        name: 'Writing',
        order: 1,
        weight: 1,
      },
      {
        key: 'structure',
        parentKey: 'writing',
        kind: 'SUBCOMPETENCE',
        name: 'Structure',
        order: 0,
      },
    ],
    coverages: [
      {
        leafKey: 'scanning',
        levelKey: 'basic',
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'structure',
        levelKey: 'basic',
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'scanning',
        levelKey: 'advanced',
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'structure',
        levelKey: 'advanced',
        targetItemCount: 5,
        enabled: true,
      },
    ],
    assignments: elements.map((element, index) => ({
      elementId: element.id,
      leafKey:
        elementSpecs[index]!.competence === 'Reading'
          ? 'scanning'
          : 'structure',
      levelKey: elementSpecs[index]!.levelKey,
      enabled: true,
      discrimination: 2,
      enablePercentInput: false,
    })),
  }
  const tree = await createCompetenceTree({ input }, ctx)
  await linkCompetenceTreeToCourse({ treeId: tree.id, courseId }, ctx)

  return {
    treeId: tree.id,
    rootIds: tree.nodes
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id),
    assignmentIds: tree.elementAssignments.map(({ id }) => id),
    elementIds: elements.map(({ id }) => id),
  }
}

export async function createAllFalseKprimTreeFixture(
  courseId: string,
  ctx: ContextWithUser
): Promise<TreeFixture> {
  const elementSpecs = ['basic', 'advanced'].flatMap((levelKey) =>
    Array.from({ length: 6 }, (_, index) => ({ levelKey, index }))
  )
  const elements = await Promise.all(
    elementSpecs.map(({ levelKey, index }) =>
      prisma.element.create({
        data: {
          type: ElementType.KPRIM,
          name: `All-false ${levelKey} KPRIM ${index + 1}`,
          content: 'Select every statement that is correct.',
          options: {
            choices: Array.from({ length: 4 }, (_, ix) => ({
              ix,
              value: `Statement ${ix + 1}`,
              correct: false,
            })),
          },
          ownerId: ctx.user.sub,
        },
      })
    )
  )
  const tree = await createCompetenceTree(
    {
      input: {
        name: `kprim-tree-${crypto.randomUUID()}`,
        displayName: 'KPRIM tree',
        maxDepth: 5,
        thetaMin: -3,
        thetaMax: 3,
        defaultDiscrimination: 1.2,
        levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
        levels: [
          { key: 'basic', label: 'Basic', order: 0 },
          { key: 'advanced', label: 'Advanced', order: 1 },
        ],
        nodes: [
          {
            key: 'reasoning',
            kind: 'COMPETENCE',
            name: 'Reasoning',
            order: 0,
            weight: 1,
          },
          {
            key: 'classification',
            parentKey: 'reasoning',
            kind: 'SUBCOMPETENCE',
            name: 'Classification',
            order: 0,
          },
        ],
        coverages: [
          {
            leafKey: 'classification',
            levelKey: 'basic',
            targetItemCount: 6,
            enabled: true,
          },
          {
            leafKey: 'classification',
            levelKey: 'advanced',
            targetItemCount: 6,
            enabled: true,
          },
        ],
        assignments: elements.map((element, index) => ({
          elementId: element.id,
          leafKey: 'classification',
          levelKey: elementSpecs[index]!.levelKey,
          enabled: true,
          discrimination: 1.2,
          enablePercentInput: false,
        })),
      },
    },
    ctx
  )
  await linkCompetenceTreeToCourse({ treeId: tree.id, courseId }, ctx)
  return {
    treeId: tree.id,
    rootIds: tree.nodes
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id),
    assignmentIds: tree.elementAssignments.map(({ id }) => id),
    elementIds: elements.map(({ id }) => id),
  }
}

export async function createNumericalElement(
  name: string,
  ctx: ContextWithUser
) {
  return await prisma.element.create({
    data: {
      type: ElementType.NUMERICAL,
      name,
      content: 'Adaptive question',
      options: {
        exactSolutions: [0],
      },
      ownerId: ctx.user.sub,
    },
  })
}

export function quizInput({
  courseId,
  name,
}: {
  courseId: string
  name: string
}) {
  return {
    name,
    displayName: name,
    description: null,
    stacks: [],
    courseId,
    multiplier: 3,
    order: ElementOrderType.SEQUENTIAL,
    resetTimeDays: 6,
  }
}

export async function createAdaptiveQuiz({
  courseId,
  fixture,
  ctx,
  name = 'adaptive-quiz',
  preset = AdaptivePracticeQuizPreset.DIAGNOSTIC,
  nodeOverrides,
  elementOverrides,
  researchSettings,
  totalQuestionCap,
  minQuestionsPerLeaf,
}: {
  courseId: string
  fixture: TreeFixture
  ctx: ContextWithUser
  name?: string
  preset?: AdaptivePracticeQuizPreset
  nodeOverrides?: Array<{
    nodeId: number
    enabled: boolean
    weight?: number
  }>
  elementOverrides?: Array<{
    assignmentId: number
    enabled: boolean
    discrimination?: number
  }>
  researchSettings?: {
    levelMappingRule: AdaptiveLevelMappingRule
    attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy
    defaultDiscrimination: number
    topInformationRatio: number
  }
  totalQuestionCap?: number
  minQuestionsPerLeaf?: number
}) {
  return await manipulatePracticeQuiz(
    {
      ...quizInput({ courseId, name }),
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveConfig: {
        competenceTreeId: fixture.treeId,
        preset,
        totalQuestionCap,
        minQuestionsPerLeaf,
        nodeOverrides,
        elementOverrides,
        researchSettings,
      },
    },
    ctx
  )
}

export async function editAdaptiveQuiz({
  id,
  ...input
}: Parameters<typeof createAdaptiveQuiz>[0] & { id: string }) {
  return await manipulatePracticeQuiz(
    {
      ...quizInput({
        courseId: input.courseId,
        name: 'adaptive-quiz-edited',
      }),
      id,
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveConfig: {
        competenceTreeId: input.fixture.treeId,
        preset: input.preset ?? AdaptivePracticeQuizPreset.DIAGNOSTIC,
        nodeOverrides: input.nodeOverrides,
        elementOverrides: input.elementOverrides,
        researchSettings: input.researchSettings,
      },
    },
    input.ctx
  )
}

export function rootWeightOverrides(fixture: TreeFixture, weights: number[]) {
  return fixture.rootIds.map((nodeId, index) => ({
    nodeId,
    enabled: true,
    weight: weights[index]!,
  }))
}

export function rootWeights(
  preview: NonNullable<
    Awaited<ReturnType<typeof getAdaptivePracticeQuizPreview>>
  >
) {
  return preview.nodes
    .filter(({ parentId }) => parentId === null)
    .map(({ weight }) => weight)
}

export async function cleanup() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
  )
}
