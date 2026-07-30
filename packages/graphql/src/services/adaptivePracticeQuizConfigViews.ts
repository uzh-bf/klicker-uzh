import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import { assertAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import {
  adaptiveConfigInclude,
  mapTreeLevels,
  prepareConfigurationInput,
  prepareStoredConfiguration,
  type AdaptiveConfigRecord,
  type AdaptivePracticeQuizConfigInput,
  type AdaptivePracticeQuizConfigView,
  type AdaptivePracticeQuizNodeView,
  type PreparedAdaptiveAssignment,
  type PreparedAdaptiveConfiguration,
} from './adaptivePracticeQuizConfigPreparation.js'
import { resolveAdaptiveSourceElementAvailability } from './adaptivePracticeQuizPublicationAuthorization.js'
import type { AdaptiveQuizReadiness } from './adaptivePracticeQuizReadiness.js'

export type AdaptivePracticeQuizAssignmentView = Omit<
  PreparedAdaptiveAssignment,
  'element'
> & {
  a: number
  b: number
  c: number
}

export type AdaptivePracticeQuizTreeView = {
  id: string
  name: string
  displayName: string
  description: string | null
  maxDepth: number
  thetaMin: number
  thetaMax: number
  levels: Array<
    DB.CompetenceTreeLevel & {
      theta: number
      lowerBound: number
      upperBound: number
    }
  >
}

export type AdaptivePracticeQuizPreview = {
  practiceQuizId: string
  mode: DB.PracticeQuizMode
  config: AdaptivePracticeQuizConfigView
  competenceTree: AdaptivePracticeQuizTreeView
  nodes: AdaptivePracticeQuizNodeView[]
  assignments: AdaptivePracticeQuizAssignmentView[]
  readiness: AdaptiveQuizReadiness
  publishedPoolSize: number
}

export type AdaptivePracticeQuizSetupPreview = {
  competenceTree: AdaptivePracticeQuizTreeView
  nodes: AdaptivePracticeQuizNodeView[]
  assignments: AdaptivePracticeQuizAssignmentView[]
  readiness: AdaptiveQuizReadiness
}

export type PracticeQuizPublicationPreview = {
  mode: DB.PracticeQuizMode
  canSchedule: boolean
  readiness: AdaptiveQuizReadiness | null
  rootNodes: AdaptivePracticeQuizNodeView[]
}

export async function getAdaptivePracticeQuizPreview(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizPreview | null> {
  const loaded = await loadAdaptiveConfigurationForQuiz(ctx.prisma, id)
  if (!loaded) return null
  const { quiz, prepared, publishedPoolSize } = loaded

  return {
    practiceQuizId: quiz.id,
    mode: quiz.mode,
    config: prepared.config,
    ...serializePreparedConfiguration(
      prepared,
      prepared.config.levelMappingRule
    ),
    publishedPoolSize,
  }
}

export async function getAdaptivePracticeQuizSetupPreview(
  {
    courseId,
    input,
  }: { courseId: string; input: AdaptivePracticeQuizConfigInput },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizSetupPreview> {
  await assertAdaptiveLearningCourseEnabled(courseId, ctx.prisma)
  const { settings, prepared } = await prepareConfigurationInput(
    { courseId, input, userId: ctx.user.sub },
    ctx.prisma
  )
  return {
    ...serializePreparedConfiguration(prepared, settings.levelMappingRule),
  }
}

export async function getPracticeQuizPublicationPreview(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<PracticeQuizPublicationPreview | null> {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      mode: true,
      course: { select: { isAdaptiveLearningEnabled: true } },
    },
  })
  if (!quiz) return null
  if (quiz.mode === DB.PracticeQuizMode.STANDARD) {
    return {
      mode: quiz.mode,
      canSchedule: true,
      readiness: null,
      rootNodes: [],
    }
  }

  const loaded = await loadAdaptiveConfigurationForQuiz(ctx.prisma, quiz.id)
  const readiness =
    loaded?.prepared.readiness ?? missingAdaptiveConfigurationReadiness()
  return {
    mode: quiz.mode,
    canSchedule: false,
    readiness: quiz.course.isAdaptiveLearningEnabled
      ? readiness
      : {
          ...readiness,
          ready: false,
          errors: [
            {
              code: 'ADAPTIVE_COURSE_DISABLED',
              message: 'Adaptive learning is not enabled for this course.',
              parameters: {},
              path: 'courseId',
            },
            ...readiness.errors,
          ],
        },
    rootNodes:
      loaded?.prepared.nodes.filter((node) => node.parentId === null) ?? [],
  }
}

export async function loadAdaptiveConfigurationForQuiz(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  practiceQuizId: string
): Promise<{
  quiz: Pick<DB.PracticeQuiz, 'id' | 'mode' | 'status' | 'courseId'>
  stackCount: number
  configRecord: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  publishedPoolSize: number
} | null> {
  const quiz = await prisma.practiceQuiz.findUnique({
    where: { id: practiceQuizId, isDeleted: false },
    select: {
      id: true,
      mode: true,
      status: true,
      courseId: true,
      _count: { select: { stacks: true } },
      adaptiveConfig: { include: adaptiveConfigInclude },
    },
  })
  if (
    !quiz ||
    quiz.mode !== DB.PracticeQuizMode.ADAPTIVE ||
    !quiz.adaptiveConfig
  ) {
    return null
  }

  const tree = quiz.adaptiveConfig.competenceTree
  const sourceElementAvailability =
    await resolveAdaptiveSourceElementAvailability({
      ownerId: tree.ownerId,
      elements: tree.elementAssignments.map((assignment) => ({
        id: assignment.elementId,
        isDeleted: assignment.element.isDeleted,
      })),
      prisma,
    })
  const prepared = prepareStoredConfiguration(
    quiz.adaptiveConfig,
    sourceElementAvailability
  )
  if (
    tree.isDeleted ||
    tree.isArchived ||
    !tree.courseLinks.some(({ courseId }) => courseId === quiz.courseId)
  ) {
    prepared.readiness = {
      ...prepared.readiness,
      ready: false,
      errors: [
        {
          code: 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE',
          message:
            'The competence tree is deleted, archived, or no longer linked to this course.',
          parameters: {},
          path: 'competenceTreeId',
        },
        ...prepared.readiness.errors,
      ],
    }
  }
  if (quiz._count.stacks > 0) {
    prepared.readiness = {
      ...prepared.readiness,
      ready: false,
      errors: [
        ...prepared.readiness.errors,
        {
          code: 'ADAPTIVE_STACKS_FORBIDDEN',
          message:
            'Adaptive practice quizzes cannot contain standard element stacks.',
          parameters: {},
          path: 'stacks',
        },
      ],
    }
  }
  return {
    quiz: {
      id: quiz.id,
      mode: quiz.mode,
      status: quiz.status,
      courseId: quiz.courseId,
    },
    stackCount: quiz._count.stacks,
    configRecord: quiz.adaptiveConfig,
    prepared,
    publishedPoolSize: quiz.adaptiveConfig._count.publishedPool,
  }
}

function serializePreparedConfiguration(
  prepared: Omit<PreparedAdaptiveConfiguration, 'config'>,
  levelMappingRule: DB.AdaptiveLevelMappingRule
) {
  return {
    competenceTree: {
      id: prepared.tree.id,
      name: prepared.tree.name,
      displayName: prepared.tree.displayName,
      description: prepared.tree.description,
      maxDepth: prepared.tree.maxDepth,
      thetaMin: prepared.tree.thetaMin,
      thetaMax: prepared.tree.thetaMax,
      levels: mapTreeLevels(prepared.tree, levelMappingRule),
    },
    nodes: prepared.nodes,
    assignments: prepared.assignments.map(
      ({ element: _element, ...assignment }) => ({
        ...assignment,
        a: assignment.discrimination,
        b: assignment.difficulty,
        c: assignment.guessing,
      })
    ),
    readiness: prepared.readiness,
  }
}

function missingAdaptiveConfigurationReadiness(): AdaptiveQuizReadiness {
  return {
    ready: false,
    errors: [
      {
        code: 'ADAPTIVE_CONFIG_MISSING',
        message: 'Adaptive practice quiz configuration was not found.',
        parameters: {},
        path: 'adaptiveConfig',
      },
    ],
    warnings: [],
    coverages: [],
    rootReachability: [],
    enabledRootCount: 0,
    enabledLeafCount: 0,
    enabledAssignmentCount: 0,
    expectedQuestionCount: 0,
    estimatedDurationMinutes: 0,
  }
}
