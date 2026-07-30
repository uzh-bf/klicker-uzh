import * as DB from '@klicker-uzh/prisma/client'
import { processElementData } from '@klicker-uzh/util'
import { adaptiveServiceError } from './adaptivePracticeQuizConfigPreparation.js'
import { loadAdaptiveConfigurationForQuiz } from './adaptivePracticeQuizConfigViews.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  assertAdaptivePublicationSourceElementsAuthorized,
  lockAdaptivePracticeQuizPublicationSources,
} from './adaptivePracticeQuizPublicationAuthorization.js'
import type { AdaptiveQuizReadiness } from './adaptivePracticeQuizReadiness.js'

const ADAPTIVE_POOL_INSERT_BATCH_SIZE = 500

export async function materializeAdaptivePracticeQuizPool(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<{ poolSize: number; readiness: AdaptiveQuizReadiness }> {
  const quiz = await prisma.practiceQuiz.findUnique({
    where: { id: practiceQuizId, isDeleted: false },
    select: { courseId: true },
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

  await prisma.practiceQuizAdaptivePoolItem.deleteMany({
    where: { configId: loaded.configRecord.id },
  })
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
        const level = levelsById.get(assignment.levelId)
        if (!level) {
          throw adaptiveServiceError(
            `Adaptive assignment ${assignment.id} references a missing level.`,
            'ADAPTIVE_CONFIG_INVALID'
          )
        }
        const path = getNodePath(assignment.leafNodeId, nodesById)
        return {
          configId: loaded.configRecord.id,
          competenceTreeId: loaded.configRecord.competenceTreeId,
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
          discrimination: assignment.discrimination,
          difficulty: assignment.difficulty,
          guessing: assignment.guessing,
          enablePercentInput: assignment.enablePercentInput,
        }
      }),
    })
  }

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
      _count: { select: { publishedPool: true } },
    },
  })
  if (!config || !config.poolPublishedAt || config._count.publishedPool === 0) {
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
      _count: { select: { attempts: true, publishedPool: true } },
    },
  })
  if (!config) return
  if (config._count.attempts > 0) {
    if (retainWhenAttemptsExist) {
      if (!config.poolPublishedAt || config._count.publishedPool === 0) {
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
  await prisma.practiceQuizAdaptivePoolItem.deleteMany({
    where: { configId: config.id },
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
