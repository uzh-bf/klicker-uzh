import * as DB from '@klicker-uzh/prisma/client'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import {
  adaptiveServiceError,
  prepareConfigurationInput,
  type AdaptivePracticeQuizConfigInput,
} from './adaptivePracticeQuizConfigPreparation.js'

export async function replaceAdaptivePracticeQuizConfig(
  {
    practiceQuizId,
    courseId,
    input,
    userId,
  }: {
    practiceQuizId: string
    courseId: string
    input: AdaptivePracticeQuizConfigInput
    userId: string
  },
  prisma: DB.Prisma.TransactionClient
): Promise<string> {
  await lockAdaptiveLearningCourseEnabled(courseId, prisma)
  await lockCompetenceTreeForAdaptiveConfig(prisma, input.competenceTreeId)
  const { settings, prepared } = await prepareConfigurationInput(
    { courseId, input, userId },
    prisma
  )
  const tree = prepared.tree

  const existing = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    include: { _count: { select: { attempts: true } } },
  })
  if (existing && existing._count.attempts > 0) {
    throw adaptiveServiceError(
      'Adaptive configuration cannot change after an attempt exists. Duplicate the practice quiz instead.',
      'ADAPTIVE_CONFIG_LOCKED'
    )
  }
  if (existing) {
    await prisma.practiceQuizAdaptiveConfig.delete({
      where: { id: existing.id },
    })
  }

  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId,
      competenceTreeId: tree.id,
      preset: settings.preset,
      attemptSelectionPolicy: settings.attemptSelectionPolicy,
      totalQuestionCap: settings.totalQuestionCap,
      perLeafQuestionCap: settings.perLeafQuestionCap,
      minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
      classificationZ: settings.classificationZ,
      topInformationRatio: settings.topInformationRatio,
      defaultDiscrimination: settings.defaultDiscrimination,
      levelMappingRule: settings.levelMappingRule,
      showTimer: settings.showTimer,
    },
    select: { id: true },
  })

  await prisma.practiceQuizAdaptiveNodeOverride.createMany({
    data: prepared.nodes.map((node) => ({
      configId: config.id,
      competenceTreeId: tree.id,
      nodeId: node.id,
      enabled: node.overrideEnabled,
      weight: node.weight,
      questionCap: node.questionCap,
    })),
  })
  await prisma.practiceQuizAdaptiveElementOverride.createMany({
    data: prepared.assignments.map((assignment) => ({
      configId: config.id,
      competenceTreeId: tree.id,
      assignmentId: assignment.id,
      enabled: assignment.overrideEnabled,
      discrimination: assignment.overrideDiscrimination,
    })),
  })

  return config.id
}

export async function removeAdaptivePracticeQuizConfig(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  const existing = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    include: { _count: { select: { attempts: true } } },
  })
  if (!existing) return
  if (existing._count.attempts > 0) {
    throw adaptiveServiceError(
      'Adaptive configuration cannot be removed after an attempt exists.',
      'ADAPTIVE_CONFIG_LOCKED'
    )
  }
  await prisma.practiceQuizAdaptiveConfig.delete({ where: { id: existing.id } })
}

async function lockCompetenceTreeForAdaptiveConfig(
  prisma: DB.Prisma.TransactionClient,
  competenceTreeId: string
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; isDeleted: boolean; isArchived: boolean }>
  >`SELECT "id", "isDeleted", "isArchived"
    FROM "CompetenceTree"
    WHERE "id" = ${competenceTreeId}::uuid
    FOR SHARE`
  if (!rows[0] || rows[0].isDeleted || rows[0].isArchived) {
    throw adaptiveServiceError(
      'The selected competence tree is not linked to a course you can edit.',
      'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
    )
  }
}
