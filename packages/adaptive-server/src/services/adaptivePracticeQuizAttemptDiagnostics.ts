import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveDiagnosticAnswer,
  type AdaptiveDiagnosticAttemptRecord,
  type AdaptiveDiagnosticNodeResult,
  type AdaptiveDiagnosticSummary,
  adaptivePseudonymCode,
  buildAdaptiveAttemptDiagnostic,
} from './adaptivePracticeQuizAttemptDiagnosticsModel.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { getEffectivelyEnabledRuntimeNodes } from './adaptivePracticeQuizEstimatePersistence.js'
import { createAdaptiveV1LevelDetermination } from './adaptivePracticeQuizLevelDetermination.js'
import {
  type LoadedAdaptiveRuntime,
  loadAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'
import { isAdaptiveTestingInfoEnabled } from './adaptivePracticeQuizTestingInfo.js'
import { getAdaptiveRootWeightShares } from './adaptivePracticeQuizWeightShares.js'

/**
 * Lecturer attempt diagnostics. Only where ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true
 * (staging, local): students are told that instructors see only anonymous
 * group results, so production never exposes per-attempt data. Callers are
 * authorized by the GraphQL field (asUser + ADMIN permission on the quiz).
 * Only completed attempts of the current publication are listed; attempts of
 * earlier publications are counted.
 */

const attemptSelect = {
  id: true,
  participationId: true,
  measurementVersion: true,
  stopReason: true,
  startedAt: true,
  completedAt: true,
  elapsedSeconds: true,
  estimates: {
    select: {
      nodeKind: true,
      nodeId: true,
      theta: true,
      standardError: true,
      responseCount: true,
      stopReason: true,
      coverageStatus: true,
    },
  },
  responses: {
    select: {
      order: true,
      poolItemId: true,
      elementId: true,
      correct: true,
      score: true,
      overallThetaAfter: true,
    },
    orderBy: { order: 'asc' },
  },
} satisfies DB.Prisma.AdaptivePracticeQuizAttemptSelect

export type AdaptiveAttemptDiagnosticsList = {
  levelLabels: string[]
  attempts: AdaptiveDiagnosticSummary[]
  earlierPublicationAttemptCount: number
}

export type AdaptiveAttemptDiagnosticDetail = {
  levelLabels: string[]
  summary: AdaptiveDiagnosticSummary
  nodes: AdaptiveDiagnosticNodeResult[]
  answers: AdaptiveDiagnosticAnswer[]
}

async function loadDiagnosticsInput(
  practiceQuizId: string,
  ctx: ContextWithUser
) {
  const runtime = await loadAdaptiveRuntime(ctx.prisma, practiceQuizId, {
    includeAlgorithmData: true,
  })
  const [attempts, earlierPublicationAttemptCount] = await Promise.all([
    ctx.prisma.adaptivePracticeQuizAttempt.findMany({
      where: {
        practiceQuizId,
        publicationId: runtime.publication.id,
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      },
      select: attemptSelect,
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    }),
    ctx.prisma.adaptivePracticeQuizAttempt.count({
      where: {
        practiceQuizId,
        publicationId: { not: runtime.publication.id },
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      },
    }),
  ])
  return { runtime, attempts, earlierPublicationAttemptCount }
}

function buildDiagnostics(
  runtime: LoadedAdaptiveRuntime,
  attempts: AdaptiveDiagnosticAttemptRecord[]
) {
  const nodes = getEffectivelyEnabledRuntimeNodes(runtime.algorithm.nodes)
  const nodeNames = new Map(
    runtime.publication.hierarchicalWeightSnapshot.map(({ nodeId, name }) => [
      nodeId,
      name,
    ])
  )
  const levels = runtime.algorithm.levels
  const levelIdsWithElements = new Set(
    runtime.pool.map(({ levelId }) => levelId)
  )
  const weightShares = getAdaptiveRootWeightShares(runtime.algorithm.nodes)
  const attemptNumbers = new Map<number, number>()

  // Attempts arrive in start order, so the counter numbers each
  // participation's retakes from 1.
  return attempts.map((attempt) => {
    const attemptNumber = (attemptNumbers.get(attempt.participationId) ?? 0) + 1
    attemptNumbers.set(attempt.participationId, attemptNumber)
    const determination = createAdaptiveV1LevelDetermination({
      runtime,
      answeredPoolItemIds: attempt.responses.map(
        ({ poolItemId }) => poolItemId
      ),
      coverageStatusByLeaf: new Map(
        attempt.estimates.flatMap((estimate) =>
          estimate.nodeKind === DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE &&
          estimate.nodeId !== null
            ? [[estimate.nodeId, estimate.coverageStatus] as const]
            : []
        )
      ),
    })
    return buildAdaptiveAttemptDiagnostic(
      {
        nodes,
        nodeNames,
        levels,
        settings: runtime.algorithm.settings,
        poolById: runtime.poolById,
        levelIdsWithElements,
        weightShares,
        isDetermined: (nodeId, estimate) =>
          determination.isDetermined(nodeId, estimate),
      },
      attempt,
      attemptNumber
    )
  })
}

const levelLabelsOf = (runtime: LoadedAdaptiveRuntime) =>
  runtime.algorithm.levels
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(({ label }) => label)

export async function getAdaptivePracticeQuizAttemptDiagnostics(
  { practiceQuizId }: { practiceQuizId: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveAttemptDiagnosticsList | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const { runtime, attempts, earlierPublicationAttemptCount } =
    await loadDiagnosticsInput(practiceQuizId, ctx)
  return {
    levelLabels: levelLabelsOf(runtime),
    // Newest first for the table.
    attempts: buildDiagnostics(runtime, attempts)
      .map(({ summary }) => summary)
      .reverse(),
    earlierPublicationAttemptCount,
  }
}

export async function getAdaptivePracticeQuizAttemptDiagnostic(
  {
    practiceQuizId,
    attemptCode,
  }: { practiceQuizId: string; attemptCode: string },
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveAttemptDiagnosticDetail | null> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const { runtime, attempts } = await loadDiagnosticsInput(practiceQuizId, ctx)
  const index = attempts.findIndex(
    ({ id }) => adaptivePseudonymCode('attempt', id) === attemptCode
  )
  if (index < 0) {
    throw adaptivePracticeQuizError(
      'The adaptive attempt was not found in this practice quiz.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }
  // Attempt numbers need the earlier attempts of the same participation.
  const diagnostic = buildDiagnostics(runtime, attempts.slice(0, index + 1)).at(
    -1
  )!
  return { levelLabels: levelLabelsOf(runtime), ...diagnostic }
}
