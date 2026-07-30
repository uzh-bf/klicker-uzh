import type {
  AdaptiveSimulationMetrics,
  SimulationStopReason,
} from '../test/simulationHarness.js'
import type { SimulationPoolProfile } from './simulationScenarios.js'

export const PHASE_11_REGRESSION_GATES = {
  minimumExactAccuracy: 0.7,
  minimumAdjacentAccuracy: 0.95,
  minimumPerLevelExactAccuracy: 0.6,
  maximumMeanAbsoluteLevelError: 0.35,
  maximumAbsolutePerLevelBias: 0.5,
  maximumUnexpectedFallbackCount: 0,
  poolProfiles: {
    TARGET: {
      minimumInteriorClassificationRate: 0.15,
      maximumTotalQuestionCapRate: 0.9,
      maximumItemExposure: 0.9,
      maximumP95ItemExposure: 0.8,
      maximumMeanQuestionCapRatio: 0.99,
    },
    RICH: {
      minimumInteriorClassificationRate: 0.25,
      maximumTotalQuestionCapRate: 0.8,
      maximumItemExposure: 0.6,
      maximumP95ItemExposure: 0.45,
      maximumMeanQuestionCapRatio: 0.99,
    },
  },
} as const

export type CanonicalSimulationPoolProfile = Extract<
  SimulationPoolProfile,
  'TARGET' | 'RICH'
>

export const UNEXPECTED_CLEAN_FALLBACKS = [
  'NODE_QUESTION_CAP',
  'POOL_EXHAUSTED',
  'INSUFFICIENT_DATA',
] as const satisfies ReadonlyArray<SimulationStopReason>

export type RegressionGateResult = {
  metric: string
  scope: string
  comparison: '>=' | '<=' | '=='
  threshold: number
  actual: number | null
  passed: boolean
}

export function evaluateRegressionGates({
  metrics,
  totalQuestionCap,
  poolProfile,
}: {
  metrics: AdaptiveSimulationMetrics
  totalQuestionCap: number
  poolProfile: CanonicalSimulationPoolProfile
}): RegressionGateResult[] {
  const profileGates = PHASE_11_REGRESSION_GATES.poolProfiles[poolProfile]
  const results: RegressionGateResult[] = [
    minimumGate(
      'exactAccuracy',
      'overall',
      metrics.exactAccuracy,
      PHASE_11_REGRESSION_GATES.minimumExactAccuracy
    ),
    minimumGate(
      'adjacentAccuracy',
      'overall',
      metrics.adjacentAccuracy,
      PHASE_11_REGRESSION_GATES.minimumAdjacentAccuracy
    ),
    maximumGate(
      'meanAbsoluteLevelError',
      'overall',
      metrics.meanAbsoluteLevelError,
      PHASE_11_REGRESSION_GATES.maximumMeanAbsoluteLevelError
    ),
    minimumGate(
      'classificationRate',
      'boundary-distance:AT_LEAST_25_PERCENT',
      metrics.byBoundaryDistance.AT_LEAST_25_PERCENT.classificationRate,
      profileGates.minimumInteriorClassificationRate
    ),
    maximumGate(
      'totalQuestionCapRate',
      'overall',
      metrics.totalQuestionCapRate,
      profileGates.maximumTotalQuestionCapRate
    ),
    maximumGate(
      'maxItemExposure',
      'overall',
      metrics.maxItemExposure,
      profileGates.maximumItemExposure
    ),
    maximumGate(
      'p95ItemExposure',
      'overall',
      metrics.p95ItemExposure,
      profileGates.maximumP95ItemExposure
    ),
    maximumGate(
      'meanQuestionCount',
      'overall',
      metrics.meanQuestionCount,
      profileGates.maximumMeanQuestionCapRatio * totalQuestionCap
    ),
  ]

  for (const [level, levelMetrics] of Object.entries(metrics.byLevel)) {
    if (levelMetrics.learnerCount === 0) continue
    results.push(
      minimumGate(
        'adjacentAccuracy',
        `level:${level}`,
        levelMetrics.adjacentAccuracy,
        PHASE_11_REGRESSION_GATES.minimumAdjacentAccuracy
      ),
      minimumGate(
        'exactAccuracy',
        `level:${level}`,
        levelMetrics.exactAccuracy,
        PHASE_11_REGRESSION_GATES.minimumPerLevelExactAccuracy
      ),
      maximumGate(
        'absoluteSignedLevelBias',
        `level:${level}`,
        levelMetrics.signedLevelBias === null
          ? null
          : Math.abs(levelMetrics.signedLevelBias),
        PHASE_11_REGRESSION_GATES.maximumAbsolutePerLevelBias
      )
    )
  }

  for (const stopReason of UNEXPECTED_CLEAN_FALLBACKS) {
    results.push(
      equalityGate(
        'terminalFallbackCount',
        `stop-reason:${stopReason}`,
        metrics.stopReasons[stopReason],
        PHASE_11_REGRESSION_GATES.maximumUnexpectedFallbackCount
      )
    )
  }

  return results
}

export function equalityGate(
  metric: string,
  scope: string,
  actual: number | null,
  threshold: number
): RegressionGateResult {
  return {
    metric,
    scope,
    comparison: '==',
    threshold,
    actual,
    passed: actual !== null && actual === threshold,
  }
}

function minimumGate(
  metric: string,
  scope: string,
  actual: number | null,
  threshold: number
): RegressionGateResult {
  return {
    metric,
    scope,
    comparison: '>=',
    threshold,
    actual,
    passed: actual !== null && actual >= threshold,
  }
}

function maximumGate(
  metric: string,
  scope: string,
  actual: number | null,
  threshold: number
): RegressionGateResult {
  return {
    metric,
    scope,
    comparison: '<=',
    threshold,
    actual,
    passed: actual !== null && actual <= threshold,
  }
}
