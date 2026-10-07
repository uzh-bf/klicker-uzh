import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import type { LoadedAdaptiveRuntime } from './adaptivePracticeQuizRuntimeData.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** The retake part of an IRT_V1 decision request (Catalyst SEQUENTIAL_ROOTS_V7). */
export type AdaptiveRetakeRequest = {
  startingEstimates: Array<{ nodeId: number; theta: number }>
  seenPoolItemIds: number[]
}

/**
 * Snapshot of the learner's earlier attempts, taken when an IRT_V1 attempt
 * starts and stored on the attempt so every decision of that attempt sends
 * the same context:
 *
 * - starting estimates: the per-competence theta of the latest completed
 *   attempt on this quiz, when it is at most `retakeStartMaxAgeDays` old;
 * - seen items: the current pool items whose element the learner answered in
 *   any earlier attempt on this quiz (also across publications).
 *
 * Returns null when the publication has both settings off, for IRT v2, or
 * when there is nothing to carry over (a first attempt).
 */
export async function loadAdaptiveRetakeContext({
  prisma,
  runtime,
  participantId,
  now = new Date(),
}: {
  prisma: PrismaTransactionClient
  runtime: LoadedAdaptiveRuntime
  participantId: string
  now?: Date
}): Promise<PrismaJson.PrismaAdaptiveRetakeContext | null> {
  const { publication } = runtime
  if (
    runtime.estimator.measurementVersion !==
      DB.AdaptiveMeasurementVersion.IRT_V1 ||
    (!publication.retakeStartFromPreviousResult &&
      !publication.retakePreferNewQuestions)
  ) {
    return null
  }

  let sourceAttemptId: string | null = null
  let startingEstimates: PrismaJson.PrismaAdaptiveRetakeContext['startingEstimates'] =
    []
  if (publication.retakeStartFromPreviousResult) {
    const rootIds = new Set(
      runtime.estimator.algorithm.nodes
        .filter((node) => node.parentId === null && node.enabled)
        .map(({ id }) => id)
    )
    const previous = await prisma.adaptivePracticeQuizAttempt.findFirst({
      where: {
        practiceQuizId: runtime.quiz.id,
        participantId,
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        completedAt: {
          gte: new Date(
            now.getTime() - publication.retakeStartMaxAgeDays * DAY_MS
          ),
        },
      },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        estimates: {
          where: {
            nodeKind: DB.AdaptiveEstimateNodeKind.COMPETENCE,
            theta: { not: null },
            responseCount: { gt: 0 },
          },
          select: { nodeId: true, theta: true },
        },
      },
    })
    if (previous) {
      startingEstimates = previous.estimates.flatMap(({ nodeId, theta }) =>
        nodeId !== null &&
        rootIds.has(nodeId) &&
        theta !== null &&
        Number.isFinite(theta)
          ? [{ nodeId, theta }]
          : []
      )
      if (startingEstimates.length > 0) sourceAttemptId = previous.id
    }
  }

  let seenPoolItemIds: number[] = []
  if (publication.retakePreferNewQuestions) {
    const answered = await prisma.adaptivePracticeQuizResponse.findMany({
      where: {
        attempt: { participantId, practiceQuizId: runtime.quiz.id },
      },
      select: { assignmentId: true, elementId: true },
      distinct: ['assignmentId', 'elementId'],
    })
    // Matched by assignment and element, so an edited element version still
    // counts as seen.
    const answeredKeys = new Set(
      answered.map(({ assignmentId, elementId }) =>
        seenItemKey(assignmentId, elementId)
      )
    )
    seenPoolItemIds = runtime.pool.flatMap((item) =>
      answeredKeys.has(seenItemKey(item.sourceAssignmentId, item.elementId))
        ? [item.id]
        : []
    )
  }

  if (startingEstimates.length === 0 && seenPoolItemIds.length === 0) {
    return null
  }
  return { sourceAttemptId, startingEstimates, seenPoolItemIds }
}

/** The request part for a stored context; undefined when there is none. */
export function toAdaptiveRetakeRequest(
  context: PrismaJson.PrismaAdaptiveRetakeContext | null | undefined
): AdaptiveRetakeRequest | undefined {
  if (
    !context ||
    (context.startingEstimates.length === 0 &&
      context.seenPoolItemIds.length === 0)
  ) {
    return undefined
  }
  return {
    startingEstimates: context.startingEstimates.map(({ nodeId, theta }) => ({
      nodeId,
      theta,
    })),
    seenPoolItemIds: [...context.seenPoolItemIds],
  }
}

function seenItemKey(assignmentId: number, elementId: number) {
  return `${assignmentId}:${elementId}`
}
