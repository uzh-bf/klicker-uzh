import {
  advanceAdaptiveV2Runtime,
  classifyPosterior,
  probability,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeStopReason,
  type AdaptiveV2Estimate,
  type AdaptiveV2Estimates,
  type AdaptiveV2PoolItem,
  type PreparedAdaptiveV2Runtime,
} from '../src/index.js'
import { createSimulationRandom } from './simulationV2Support.js'
import type {
  AdaptiveV2SimulationItem,
  ClassifiedObservation,
  LearnerEvidence,
} from './simulationV2Types.js'

export function simulateAdaptiveAttemptAcrossThresholds({
  attemptId,
  runtime,
  thresholds,
  pool,
  trueTheta,
  trueLevelId,
  courseCohort,
  cutDistance,
  thetaCellKey = null,
  responseSeed,
  priorAttemptPoolItemIds,
}: {
  attemptId: string
  runtime: PreparedAdaptiveV2Runtime
  thresholds: number[]
  pool: AdaptiveV2SimulationItem[]
  trueTheta: number
  trueLevelId: number
  courseCohort: string
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
  thetaCellKey?: string | null
  responseSeed: number
  priorAttemptPoolItemIds?: ReadonlySet<number>
}) {
  const outcomes = new Map<number, LearnerEvidence>()
  const pending = new Set(thresholds)
  const responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[] = []
  const responseBits: string[] = []
  const simulationPoolById = new Map(pool.map((item) => [item.id, item]))
  const responseRandom = createSimulationRandom(responseSeed)

  while (pending.size > 0) {
    const decision = advanceAdaptiveV2Runtime({
      attemptId,
      runtime,
      responses,
      selectionContext: { priorAttemptPoolItemIds },
    })

    for (const threshold of [...pending]) {
      if (
        rootsClassifiedAtThreshold({
          estimates: decision.estimates,
          runtime,
          threshold,
          terminalReason: 'ALL_ROOTS_CLASSIFIED',
        })
      ) {
        outcomes.set(
          threshold,
          buildLearnerEvidence({
            learnerId: attemptId.replace(/:(primary|retake:[^:]+)$/, ''),
            trueTheta,
            trueLevelId,
            courseCohort,
            cutDistance,
            thetaCellKey,
            responses,
            responseBits,
            estimates: decision.estimates,
            runtime,
            threshold,
            stopReason: 'ALL_ROOTS_CLASSIFIED',
          })
        )
        pending.delete(threshold)
      }
    }
    if (pending.size === 0) break

    if (decision.nextPoolItem !== null) {
      const simulationItem = simulationPoolById.get(decision.nextPoolItem.id)!
      const correct =
        responseRandom() <
        probability(trueTheta, {
          a: simulationItem.trueDiscrimination,
          b: simulationItem.trueDifficulty,
          c: simulationItem.trueGuessing,
        })
      responseBits.push(correct ? '1' : '0')
      responses.push({
        order: responses.length + 1,
        poolItemId: decision.nextPoolItem.id,
        poolItem: decision.nextPoolItem,
        correct,
      })
      continue
    }

    if (decision.stopReason === null) {
      throw new Error('Production adaptive simulation reached no decision.')
    }
    for (const threshold of pending) {
      outcomes.set(
        threshold,
        buildLearnerEvidence({
          learnerId: attemptId.replace(/:(primary|retake:[^:]+)$/, ''),
          trueTheta,
          trueLevelId,
          courseCohort,
          cutDistance,
          thetaCellKey,
          responses,
          responseBits,
          estimates: decision.estimates,
          runtime,
          threshold,
          stopReason: decision.stopReason,
        })
      )
    }
    pending.clear()
  }

  return outcomes
}

function rootsClassifiedAtThreshold({
  estimates,
  runtime,
  threshold,
  terminalReason,
}: {
  estimates: AdaptiveV2Estimates
  runtime: PreparedAdaptiveV2Runtime
  threshold: number
  terminalReason: AdaptiveRuntimeStopReason
}) {
  return runtime.roots.every((root) => {
    const estimate = estimates.nodes.get(root.id)!
    return (
      classifyEstimateAtThreshold({
        estimate,
        runtime,
        threshold,
        terminalReason,
      }).status === 'CLASSIFIED'
    )
  })
}

export function buildLearnerEvidence({
  learnerId,
  trueTheta,
  trueLevelId,
  courseCohort,
  cutDistance,
  thetaCellKey,
  responses,
  responseBits,
  estimates,
  runtime,
  threshold,
  stopReason,
}: {
  learnerId: string
  trueTheta: number
  trueLevelId: number
  courseCohort: string
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
  thetaCellKey: string | null
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
  responseBits: string[]
  estimates: AdaptiveV2Estimates
  runtime: PreparedAdaptiveV2Runtime
  threshold: number
  stopReason: AdaptiveRuntimeStopReason
}): LearnerEvidence {
  const rootResults = runtime.roots.map((root) => {
    const estimate = estimates.nodes.get(root.id)!
    const classification = classifyEstimateAtThreshold({
      estimate,
      runtime,
      threshold,
      terminalReason: stopReason,
    })
    return { root, estimate, classification }
  })
  const requiredRootsClassified = rootResults.every(
    ({ classification }) => classification.status === 'CLASSIFIED'
  )
  const rawOverallClassification = classifyEstimateAtThreshold({
    estimate: estimates.overall,
    runtime,
    threshold,
    terminalReason: stopReason,
  })
  const overallClassification =
    !requiredRootsClassified && rawOverallClassification.status === 'CLASSIFIED'
      ? {
          status: estimates.overall.evidenceReachable
            ? ('INSUFFICIENT_EVIDENCE' as const)
            : ('POOL_LIMITED' as const),
          levelId: null,
          probability: 0,
          leadingLevelIds: [] as number[],
        }
      : rawOverallClassification
  const observation = observationFromClassification({
    classification: overallClassification,
    estimate: estimates.overall,
    trueTheta,
    trueLevelId,
    requiredRootsClassified,
    questionCount: responses.length,
    stopReason,
    cutDistance,
    overall: true,
  })
  const roots = rootResults.map(({ root, estimate, classification }) => ({
    rootId: root.id,
    trueTheta,
    trueLevelId,
    posterior: estimate.posterior,
    observation: observationFromClassification({
      classification,
      estimate,
      trueTheta,
      trueLevelId,
      requiredRootsClassified: classification.status === 'CLASSIFIED',
      questionCount: estimate.administeredResponseCount,
      stopReason,
      cutDistance,
      overall: false,
    }),
  }))

  return {
    learnerId,
    trueTheta,
    trueLevelId,
    courseCohort,
    cutDistance,
    thetaCellKey,
    selectedItemIds: responses.map(({ poolItemId }) => poolItemId),
    selectedItemTypes: new Set(
      responses.map(({ poolItem }) => poolItem.itemType)
    ),
    responseBits: responseBits.join(''),
    posterior: estimates.overall.posterior,
    roots,
    observation,
  }
}

function classifyEstimateAtThreshold({
  estimate,
  runtime,
  threshold,
  terminalReason,
}: {
  estimate: AdaptiveV2Estimate
  runtime: PreparedAdaptiveV2Runtime
  threshold: number
  terminalReason: AdaptiveRuntimeStopReason
}) {
  return classifyPosterior({
    posterior: estimate.posterior,
    scale: runtime.scale,
    credibleMass: runtime.settings.credibleMass,
    probabilityThreshold: threshold,
    evidenceSatisfied: estimate.evidenceSatisfied,
    evidenceReachable: estimate.evidenceReachable,
    calibratedCoverageSatisfied: estimate.calibratedCoverageSatisfied,
    integritySatisfied: true,
    terminalReason,
  })
}

function observationFromClassification({
  classification,
  estimate,
  trueTheta,
  trueLevelId,
  requiredRootsClassified,
  questionCount,
  stopReason,
  cutDistance,
  overall,
}: {
  classification: ReturnType<typeof classifyPosterior>
  estimate: AdaptiveV2Estimate
  trueTheta: number
  trueLevelId: number
  requiredRootsClassified: boolean
  questionCount: number
  stopReason: AdaptiveRuntimeStopReason
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
  overall: boolean
}): ClassifiedObservation {
  const classifiedLevelId =
    classification.status === 'CLASSIFIED' ? classification.levelId : null
  return {
    trueTheta,
    trueLevelId,
    estimatedTheta: estimate.posterior.mean,
    credibleLower: estimate.posterior.credibleLower,
    credibleUpper: estimate.posterior.credibleUpper,
    classifiedLevelId,
    resultStatus: classification.status,
    requiredRootsClassified,
    forcedClassification:
      overall &&
      classifiedLevelId !== null &&
      (!requiredRootsClassified || stopReason !== 'ALL_ROOTS_CLASSIFIED'),
    unexpectedFallback:
      classification.status === 'CLASSIFIED' &&
      (classification.probability <= 0 ||
        !classification.leadingLevelIds.includes(classification.levelId!)),
    questionCount,
    stopReason,
    cutDistance,
  }
}
