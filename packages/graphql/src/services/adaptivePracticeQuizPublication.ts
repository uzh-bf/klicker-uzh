import * as DB from '@klicker-uzh/prisma/client'
import { processElementData } from '@klicker-uzh/util'
import { adaptiveServiceError } from './adaptivePracticeQuizConfigPreparation.js'
import { loadAdaptiveConfigurationForQuiz } from './adaptivePracticeQuizConfigViews.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  assertAdaptivePublicationSourceElementsAuthorized,
  lockAdaptivePracticeQuizPublicationSources,
} from './adaptivePracticeQuizPublicationAuthorization.js'
import { prepareAdaptivePublicationSnapshot } from './adaptivePracticeQuizPublicationSnapshot.js'
import type { AdaptiveQuizReadiness } from './adaptivePracticeQuizReadiness.js'

const ADAPTIVE_POOL_INSERT_BATCH_SIZE = 500

export async function materializeAdaptivePracticeQuizPool(
  practiceQuizId: string,
  publishedById: string,
  prisma: DB.Prisma.TransactionClient
): Promise<{ poolSize: number; readiness: AdaptiveQuizReadiness }> {
  const quiz = await prisma.practiceQuiz.findUnique({
    where: { id: practiceQuizId, isDeleted: false },
    select: { courseId: true, resetTimeDays: true },
  })
  if (!quiz) {
    throw adaptiveServiceError(
      'Adaptive practice quiz was not found.',
      'ADAPTIVE_QUIZ_NOT_FOUND'
    )
  }
  const sourceAuthorization = await lockAdaptivePracticeQuizPublicationSources(
    practiceQuizId,
    prisma
  )
  const loaded = await loadAdaptiveConfigurationForQuiz(prisma, practiceQuizId)
  if (!loaded) {
    throw adaptiveServiceError(
      'Adaptive practice quiz configuration was not found.',
      'ADAPTIVE_CONFIG_MISSING'
    )
  }
  if (loaded.configRecord._count.attempts > 0) {
    throw adaptiveServiceError(
      'The published adaptive pool cannot change after an attempt exists. Duplicate the practice quiz instead.',
      'ADAPTIVE_POOL_LOCKED'
    )
  }
  const effectivelyEnabledNodes = getEffectivelyEnabledNodes(
    loaded.prepared.nodes
  )
  const levelsById = new Map(
    loaded.prepared.tree.levels.map((level) => [level.id, level])
  )
  const nodesById = new Map(
    loaded.prepared.nodes.map((node) => [node.id, node])
  )
  const selectedPoolAssignments = loaded.prepared.assignments.filter(
    (assignment) =>
      assignment.enabled && effectivelyEnabledNodes.has(assignment.leafNodeId)
  )
  assertAdaptivePublicationSourceElementsAuthorized(
    selectedPoolAssignments.map(({ elementId }) => elementId),
    sourceAuthorization
  )
  if (!loaded.prepared.readiness.ready) {
    const staleIssueCount = [
      ...loaded.prepared.readiness.errors,
      ...loaded.prepared.readiness.warnings,
    ].filter(
      ({ code }) =>
        code === 'ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH' ||
        code === 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE'
    ).length
    if (staleIssueCount > 0) {
      emitAdaptiveOperationalEvent({
        name: 'adaptive_calibration_stale',
        practiceQuizId,
        staleIssueCount,
      })
    }
    emitAdaptiveOperationalEvent({
      name: 'adaptive_publication_blocked',
      practiceQuizId,
      blockingIssueCount:
        loaded.prepared.readiness.errors.length +
        loaded.prepared.readiness.warnings.length,
    })
    throw adaptiveServiceError(
      'Adaptive practice quiz is not ready to publish.',
      'ADAPTIVE_QUIZ_NOT_READY'
    )
  }
  const poolAssignments = selectedPoolAssignments.filter(
    ({ available }) => available
  )

  const latestPublication =
    await prisma.practiceQuizAdaptivePublication.findFirst({
      where: { configId: loaded.configRecord.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
  const snapshot = await prepareAdaptivePublicationSnapshot({
    config: loaded.configRecord,
    prepared: loaded.prepared,
    publishedById,
    publicationVersion: (latestPublication?.version ?? 0) + 1,
    retakeCooldownDays: quiz.resetTimeDays,
    prisma,
  })
  const publication = await prisma.practiceQuizAdaptivePublication.create({
    data: snapshot.publicationData,
    select: { id: true },
  })
  const calibrationByAssignment = new Map(
    snapshot.calibrations.map((entry) => [entry.assignmentId, entry])
  )
  for (
    let offset = 0;
    offset < poolAssignments.length;
    offset += ADAPTIVE_POOL_INSERT_BATCH_SIZE
  ) {
    const batch = poolAssignments.slice(
      offset,
      offset + ADAPTIVE_POOL_INSERT_BATCH_SIZE
    )
    await prisma.practiceQuizAdaptivePoolItem.createMany({
      data: batch.map((assignment) => {
        const sourceLevel = levelsById.get(assignment.levelId)
        if (!sourceLevel) {
          throw adaptiveServiceError(
            `Adaptive assignment ${assignment.id} references a missing level.`,
            'ADAPTIVE_CONFIG_INVALID'
          )
        }
        const level =
          snapshot.publicationData.measurementVersion ===
          DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
            ? snapshot.scale.levels.find(
                ({ sourceLevelId }) => sourceLevelId === sourceLevel.id
              )
            : sourceLevel
        if (!level) {
          throw adaptiveServiceError(
            `Adaptive assignment ${assignment.id} is not mapped to the published scale.`,
            'ADAPTIVE_SCALE_LEVEL_MAPPING_INVALID'
          )
        }
        const path = getNodePath(assignment.leafNodeId, nodesById)
        const calibrationEntry = calibrationByAssignment.get(assignment.id)
        if (!calibrationEntry) {
          throw adaptiveServiceError(
            `Adaptive assignment ${assignment.id} has no publication calibration.`,
            'ADAPTIVE_CALIBRATION_MISSING'
          )
        }
        const { calibration } = calibrationEntry
        return {
          configId: loaded.configRecord.id,
          competenceTreeId: loaded.configRecord.competenceTreeId,
          publicationId: publication.id,
          scaleVersionId: snapshot.scale.id,
          calibrationId: calibration.id,
          sourceAssignmentId: assignment.id,
          elementId: assignment.elementId,
          elementVersion: assignment.elementVersion,
          elementType: assignment.element.type,
          elementName: assignment.elementName,
          elementData: processElementData(assignment.element),
          leafNodeId: assignment.leafNodeId,
          nodePath: path.map((node) => node.id),
          nodeNamePath: path.map((node) => node.name),
          levelId: level.id,
          levelLabel: level.label,
          levelOrder: level.order,
          discrimination: calibration.discrimination,
          difficulty: calibration.difficulty,
          guessing: calibration.guessing,
          measurementVersion: snapshot.publicationData.measurementVersion,
          calibrationVersion: calibration.version,
          calibrationStatus: calibration.status,
          itemModel: calibration.model,
          modelImplementationVersion: calibration.modelImplementationVersion,
          role: calibrationEntry.role,
          contributesToEstimate: calibrationEntry.contributesToEstimate,
          enablePercentInput: assignment.enablePercentInput,
        }
      }),
    })
  }

  const poolItems = await prisma.practiceQuizAdaptivePoolItem.findMany({
    where: { publicationId: publication.id },
    select: { id: true },
  })
  await prisma.adaptivePracticeQuizItemExposure.createMany({
    data: poolItems.map(({ id }) => ({
      publicationId: publication.id,
      poolItemId: id,
    })),
  })
  const sealedAt = new Date()
  // Retire the previous active snapshot before sealing the replacement. Both
  // writes share this transaction, so a failed seal restores the old active
  // publication while preserving the one-active-publication constraint.
  await prisma.practiceQuizAdaptivePublication.updateMany({
    where: {
      configId: loaded.configRecord.id,
      id: { not: publication.id },
      sealedAt: { not: null },
      supersededAt: null,
      unpublishedAt: null,
    },
    data: { supersededAt: sealedAt },
  })
  await prisma.practiceQuizAdaptivePublication.update({
    where: { id: publication.id },
    data: { sealedAt },
  })

  await prisma.practiceQuizAdaptiveConfig.update({
    where: { id: loaded.configRecord.id },
    data: { poolPublishedAt: new Date() },
  })

  return {
    poolSize: poolAssignments.length,
    readiness: loaded.prepared.readiness,
  }
}

export async function assertAdaptivePublishedPool(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    select: {
      poolPublishedAt: true,
      publications: {
        where: {
          sealedAt: { not: null },
          supersededAt: null,
          unpublishedAt: null,
        },
        select: { _count: { select: { poolItems: true } } },
        take: 1,
      },
    },
  })
  if (
    !config ||
    !config.poolPublishedAt ||
    config.publications.length !== 1 ||
    config.publications[0]!._count.poolItems === 0
  ) {
    throw adaptiveServiceError(
      'The scheduled adaptive practice quiz has no materialized publication pool.',
      'ADAPTIVE_POOL_MISSING'
    )
  }
}

export async function clearAdaptivePublishedPool(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient,
  {
    retainWhenAttemptsExist = false,
  }: { retainWhenAttemptsExist?: boolean } = {}
): Promise<void> {
  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    select: {
      id: true,
      poolPublishedAt: true,
      _count: { select: { attempts: true } },
      publications: {
        where: {
          sealedAt: { not: null },
          supersededAt: null,
          unpublishedAt: null,
        },
        select: { id: true, _count: { select: { poolItems: true } } },
      },
    },
  })
  if (!config) return
  if (config._count.attempts > 0) {
    if (retainWhenAttemptsExist) {
      if (
        !config.poolPublishedAt ||
        config.publications.length !== 1 ||
        config.publications[0]!._count.poolItems === 0
      ) {
        throw adaptiveServiceError(
          'The adaptive practice quiz has attempts but no reusable published pool.',
          'ADAPTIVE_POOL_MISSING'
        )
      }
      return
    }
    throw adaptiveServiceError(
      'The adaptive pool cannot be cleared after an attempt exists.',
      'ADAPTIVE_POOL_LOCKED'
    )
  }
  await prisma.practiceQuizAdaptivePublication.updateMany({
    where: {
      configId: config.id,
      sealedAt: { not: null },
      supersededAt: null,
      unpublishedAt: null,
    },
    data: { unpublishedAt: new Date() },
  })
  await prisma.practiceQuizAdaptiveConfig.update({
    where: { id: config.id },
    data: { poolPublishedAt: null },
  })
}

function getEffectivelyEnabledNodes(
  nodes: Array<{
    id: number
    parentId: number | null
    depth: number
    enabled: boolean
  }>
): Set<number> {
  const enabled = new Set<number>()
  for (const node of nodes.slice().sort((a, b) => a.depth - b.depth)) {
    if (
      node.enabled &&
      (node.parentId === null || enabled.has(node.parentId))
    ) {
      enabled.add(node.id)
    }
  }
  return enabled
}

function getNodePath<T extends { id: number; parentId: number | null }>(
  leafNodeId: number,
  nodesById: Map<number, T>
): T[] {
  const path: T[] = []
  const seen = new Set<number>()
  let current = nodesById.get(leafNodeId)
  while (current) {
    if (seen.has(current.id)) {
      throw adaptiveServiceError(
        'Competence tree contains a cycle.',
        'COMPETENCE_TREE_DATA_INVALID'
      )
    }
    seen.add(current.id)
    path.push(current)
    current =
      current.parentId === null ? undefined : nodesById.get(current.parentId)
  }
  return path.reverse()
}
