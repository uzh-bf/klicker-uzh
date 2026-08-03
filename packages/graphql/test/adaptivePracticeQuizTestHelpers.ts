import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { processElementData } from '@klicker-uzh/util'
import {
  adaptiveConfigInclude,
  prepareStoredConfiguration,
} from '../src/services/adaptivePracticeQuizConfigPreparation.js'
import { prepareAdaptivePublicationSnapshot } from '../src/services/adaptivePracticeQuizPublicationSnapshot.js'

export async function createLegacyAdaptivePublicationFixture({
  configId,
  publishedById,
  poolParameters = new Map(),
  beforeSeal,
}: {
  configId: string
  publishedById: string
  poolParameters?: ReadonlyMap<
    number,
    Partial<{
      discrimination: number
      difficulty: number
      guessing: number
    }>
  >
  beforeSeal?: (input: {
    prisma: DB.Prisma.TransactionClient
    publicationId: string
    poolItems: DB.PracticeQuizAdaptivePoolItem[]
  }) => Promise<void>
}) {
  return prisma.$transaction(async (tx) => {
    const config = await tx.practiceQuizAdaptiveConfig.findUniqueOrThrow({
      where: { id: configId },
      include: adaptiveConfigInclude,
    })
    const prepared = prepareStoredConfiguration(
      config,
      new Map(
        config.competenceTree.elementAssignments.map(({ elementId }) => [
          elementId,
          'AVAILABLE' as const,
        ])
      )
    )
    const latest = await tx.practiceQuizAdaptivePublication.aggregate({
      where: { configId },
      _max: { version: true },
    })
    const quiz = await tx.practiceQuiz.findUniqueOrThrow({
      where: { id: config.practiceQuizId },
      select: { resetTimeDays: true },
    })
    const snapshot = await prepareAdaptivePublicationSnapshot({
      config,
      prepared,
      publishedById,
      publicationVersion: (latest._max.version ?? 0) + 1,
      retakeCooldownDays: quiz.resetTimeDays,
      prisma: tx,
    })
    const publication = await tx.practiceQuizAdaptivePublication.create({
      data: snapshot.publicationData,
    })
    const calibrationByAssignment = new Map(
      snapshot.calibrations.map(({ assignmentId, calibration }) => [
        assignmentId,
        calibration,
      ])
    )
    const nodesById = new Map(
      prepared.tree.nodes.map((node) => [node.id, node])
    )
    const levelsById = new Map(
      prepared.tree.levels.map((level) => [level.id, level])
    )
    const poolItems: DB.PracticeQuizAdaptivePoolItem[] = []
    for (const assignment of prepared.assignments.filter(
      ({ enabled, available }) => enabled && available
    )) {
      const calibration = calibrationByAssignment.get(assignment.id)!
      const level = levelsById.get(assignment.levelId)!
      const path = nodePath(assignment.leafNodeId, nodesById)
      const parameters = poolParameters.get(assignment.id)
      poolItems.push(
        await tx.practiceQuizAdaptivePoolItem.create({
          data: {
            configId,
            competenceTreeId: config.competenceTreeId,
            publicationId: publication.id,
            scaleVersionId: publication.scaleVersionId,
            calibrationId: calibration.id,
            sourceAssignmentId: assignment.id,
            elementId: assignment.elementId,
            elementVersion: assignment.elementVersion,
            elementType: assignment.elementType,
            elementName: assignment.elementName,
            elementData: processElementData(assignment.element),
            leafNodeId: assignment.leafNodeId,
            nodePath: path.map(({ id }) => id),
            nodeNamePath: path.map(({ name }) => name),
            levelId: level.id,
            levelLabel: level.label,
            levelOrder: level.order,
            discrimination:
              parameters?.discrimination ?? assignment.discrimination,
            difficulty: parameters?.difficulty ?? assignment.difficulty,
            guessing: parameters?.guessing ?? assignment.guessing,
            measurementVersion: publication.measurementVersion,
            calibrationVersion: calibration.version,
            calibrationStatus: calibration.status,
            itemModel: calibration.model,
            modelImplementationVersion: calibration.modelImplementationVersion,
            role: DB.AdaptivePoolItemRole.SCORING,
            contributesToEstimate: true,
            enablePercentInput: assignment.enablePercentInput,
          },
        })
      )
    }
    if (poolItems.length === 0) {
      throw new Error('Adaptive publication fixture requires a pool item.')
    }
    await beforeSeal?.({
      prisma: tx,
      publicationId: publication.id,
      poolItems,
    })
    await tx.adaptivePracticeQuizItemExposure.createMany({
      data: poolItems.map(({ id }) => ({
        publicationId: publication.id,
        poolItemId: id,
      })),
    })
    const sealedAt = new Date()
    const sealedPublication = await tx.practiceQuizAdaptivePublication.update({
      where: { id: publication.id },
      data: { sealedAt },
    })
    await tx.practiceQuizAdaptiveConfig.update({
      where: { id: configId },
      data: { poolPublishedAt: sealedAt },
    })
    return { publication: sealedPublication, poolItems }
  })
}

function nodePath<
  T extends { id: number; name: string; parentId: number | null },
>(leafNodeId: number, nodesById: ReadonlyMap<number, T>) {
  const path: T[] = []
  let current = nodesById.get(leafNodeId)
  while (current) {
    path.push(current)
    current =
      current.parentId === null ? undefined : nodesById.get(current.parentId)
  }
  return path.reverse()
}
