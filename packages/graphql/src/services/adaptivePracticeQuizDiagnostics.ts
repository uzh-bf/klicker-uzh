import {
  isNearLevelBoundary,
  probability,
  updateTheta,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ADAPTIVE_PRIVACY_MIN_CELL_SIZE,
  compactAdaptivePrivacySuppressions,
  hasAdaptivePrivacyWithholding,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveKnownMissingMetric,
  suppressAdaptiveMetric,
  type AdaptivePrivacyRelease,
  type AdaptivePrivacySuppression,
} from './adaptivePracticeQuizPrivacy.js'
import {
  MIN_REPORTING_RESPONSES,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

const ITEM_DIAGNOSTIC_MIN_RESPONSES = 30
const HIGH_EXPOSURE_THRESHOLD = 0.4
const ITEM_RESIDUAL_WARNING_THRESHOLD = 0.25

export type AdaptivePilotMetrics = {
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  medianQuestionCount: number | null
  p95QuestionCount: number | null
  medianElapsedSeconds: number | null
  p95ElapsedSeconds: number | null
  nearBoundaryRate: number | null
  responseCountMismatchDetected: boolean | null
  durationMissingDetected: boolean | null
}

export type AdaptiveItemDiagnostic = {
  poolItemId: number
  elementName: string
  elementType: DB.ElementType
  nodeNamePath: string[]
  levelLabel: string
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  responseCount: number | null
  exposureRate: number | null
  observedCorrectRate: number | null
  expectedCorrectRate: number | null
  residual: number | null
  highExposure: boolean | null
  misfitFlag: boolean | null
}

type AdaptiveDiagnosticRuntime = {
  algorithm: {
    levels: AdaptiveRuntimeLevel[]
    settings: AdaptiveRuntimeSettings
  }
}

type AdaptiveDiagnosticEstimate = {
  theta: number | null
  standardError: number | null
  responseCount: number
  levelId: number | null
}

type AdaptiveDiagnosticAttempt = {
  elapsedSeconds: number | null
}

type AdaptiveDiagnosticResponse = {
  correct: boolean
  poolItemId: number | null
}

type AdaptiveItemDiagnosticAccumulator = {
  item: AdaptiveRuntimeRoutingPoolItem
  responseCount: number
  correctCount: number
  expectedTotal: number
  expectedCount: number
}

export type AdaptivePracticeQuizDiagnosticsAccumulator = {
  nearBoundary: number
  responseCountMismatch: number
  questionCounts: Map<number, number>
  durations: Map<number, number>
  poolById: Map<number, AdaptiveRuntimeRoutingPoolItem>
  items: Map<number, AdaptiveItemDiagnosticAccumulator>
}

export function createAdaptivePracticeQuizDiagnosticsAccumulator(
  pool: AdaptiveRuntimeRoutingPoolItem[]
): AdaptivePracticeQuizDiagnosticsAccumulator {
  return {
    nearBoundary: 0,
    responseCountMismatch: 0,
    questionCounts: new Map(),
    durations: new Map(),
    poolById: new Map(pool.map((item) => [item.id, item])),
    items: new Map(
      pool.map((item) => [
        item.id,
        {
          item,
          responseCount: 0,
          correctCount: 0,
          expectedTotal: 0,
          expectedCount: 0,
        },
      ])
    ),
  }
}

export function accumulateAdaptivePracticeQuizDiagnostics({
  runtime,
  accumulator,
  attempt,
  overall,
  responses,
}: {
  runtime: AdaptiveDiagnosticRuntime
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator
  attempt: AdaptiveDiagnosticAttempt
  overall: AdaptiveDiagnosticEstimate | undefined
  responses: AdaptiveDiagnosticResponse[]
}) {
  incrementHistogram(accumulator.questionCounts, responses.length)
  if (attempt.elapsedSeconds !== null) {
    incrementHistogram(accumulator.durations, attempt.elapsedSeconds)
  }

  const insufficientData =
    !overall ||
    overall.responseCount < MIN_REPORTING_RESPONSES ||
    overall.levelId === null
  if (!insufficientData && isEstimateNearBoundary(runtime, overall)) {
    accumulator.nearBoundary += 1
  }
  if (!overall || overall.responseCount !== responses.length) {
    accumulator.responseCountMismatch += 1
  }

  accumulateItemDiagnostics(runtime, accumulator, responses)
  return { insufficientData }
}

export function finalizeAdaptivePilotMetrics({
  practiceQuizId,
  cohortSize,
  accumulator,
  attemptSummary,
}: {
  practiceQuizId: string
  cohortSize: number
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator
  attemptSummary: {
    nearBoundary: number | null
    suppressions: AdaptivePrivacySuppression[]
  }
}): AdaptivePilotMetrics {
  const questionCountRelease = releaseAdaptiveKnownMissingMetric({
    field: 'QUESTION_COUNT_PERCENTILES',
    total: cohortSize,
    known: cohortSize,
    value: {
      median: histogramPercentile(accumulator.questionCounts, 0.5),
      p95: histogramPercentile(accumulator.questionCounts, 0.95),
    },
  })
  const knownDurations = histogramSize(accumulator.durations)
  const durationPercentileRelease =
    cohortSize >= ADAPTIVE_PRIVACY_MIN_CELL_SIZE && knownDurations === 0
      ? suppressAdaptiveMetric<{ median: number | null; p95: number | null }>(
          'DURATION_PERCENTILES',
          'MINIMUM_RESPONSES'
        )
      : releaseAdaptiveKnownMissingMetric({
          field: 'DURATION_PERCENTILES',
          total: cohortSize,
          known: knownDurations,
          value: {
            median: histogramPercentile(accumulator.durations, 0.5),
            p95: histogramPercentile(accumulator.durations, 0.95),
          },
        })
  const mismatchRelease = releaseAdaptiveBinaryMetric({
    field: 'RESPONSE_COUNT_MISMATCH',
    total: cohortSize,
    positive: accumulator.responseCountMismatch,
    value: accumulator.responseCountMismatch > 0,
  })
  if (accumulator.responseCountMismatch > 0 && mismatchRelease.value === null) {
    console.warn(
      `event=adaptive_cohort_integrity_anomaly type=response_count_mismatch practiceQuizId=${practiceQuizId}`
    )
  }
  const durationMissingRelease = releaseAdaptiveKnownMissingMetric({
    field: 'DURATION_MISSING',
    total: cohortSize,
    known: knownDurations,
    value: knownDurations !== cohortSize,
  })
  const nearBoundarySuppression = attemptSummary.suppressions.find(
    ({ field }) => field === 'NEAR_BOUNDARY'
  )
  const nearBoundaryRelease: AdaptivePrivacyRelease<number> =
    attemptSummary.nearBoundary === null
      ? suppressAdaptiveMetric(
          'NEAR_BOUNDARY',
          nearBoundarySuppression?.reason ?? 'BELOW_RELEASE_THRESHOLD'
        )
      : {
          value: attemptSummary.nearBoundary / cohortSize,
          suppression: null,
        }
  const suppressions = compactAdaptivePrivacySuppressions([
    questionCountRelease.suppression,
    durationPercentileRelease.suppression,
    nearBoundaryRelease.suppression,
    mismatchRelease.suppression,
    durationMissingRelease.suppression,
  ])
  return {
    suppressed: hasAdaptivePrivacyWithholding(suppressions),
    suppressions,
    medianQuestionCount: questionCountRelease.value?.median ?? null,
    p95QuestionCount: questionCountRelease.value?.p95 ?? null,
    medianElapsedSeconds: durationPercentileRelease.value?.median ?? null,
    p95ElapsedSeconds: durationPercentileRelease.value?.p95 ?? null,
    nearBoundaryRate: nearBoundaryRelease.value,
    responseCountMismatchDetected: mismatchRelease.value,
    durationMissingDetected: durationMissingRelease.value,
  }
}

export function finalizeAdaptiveItemDiagnostics(
  cohortSize: number,
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator
): AdaptiveItemDiagnostic[] {
  return [...accumulator.items.values()]
    .sort((left, right) => left.item.id - right.item.id)
    .map(
      ({ item, responseCount, correctCount, expectedTotal, expectedCount }) => {
        const exposureRelease = releaseAdaptiveBinaryMetric({
          field: 'ITEM_EXPOSURE',
          total: cohortSize,
          positive: responseCount,
          value: {
            responseCount,
            exposureRate: cohortSize === 0 ? null : responseCount / cohortSize,
          },
        })
        const accuracyRelease: AdaptivePrivacyRelease<{
          observedCorrectRate: number
          expectedCorrectRate: number
        }> =
          responseCount === 0
            ? { value: null, suppression: null }
            : exposureRelease.suppression
              ? suppressAdaptiveMetric(
                  'ITEM_ACCURACY',
                  exposureRelease.suppression.reason
                )
              : releaseAdaptiveBinaryMetric({
                  field: 'ITEM_ACCURACY',
                  total: responseCount,
                  positive: correctCount,
                  value: {
                    observedCorrectRate: correctCount / responseCount,
                    expectedCorrectRate: expectedTotal / expectedCount,
                  },
                })
        const residualRelease: AdaptivePrivacyRelease<number> =
          accuracyRelease.suppression
            ? suppressAdaptiveMetric(
                'ITEM_RESIDUAL',
                accuracyRelease.suppression.reason
              )
            : responseCount < ITEM_DIAGNOSTIC_MIN_RESPONSES ||
                accuracyRelease.value === null
              ? suppressAdaptiveMetric('ITEM_RESIDUAL', 'MINIMUM_RESPONSES')
              : {
                  value:
                    accuracyRelease.value.observedCorrectRate -
                    accuracyRelease.value.expectedCorrectRate,
                  suppression: null,
                }
        const suppressions = compactAdaptivePrivacySuppressions([
          exposureRelease.suppression,
          accuracyRelease.suppression,
          residualRelease.suppression,
        ])
        const exposureRate = exposureRelease.value?.exposureRate ?? null
        const residual = residualRelease.value
        return {
          poolItemId: item.id,
          elementName: item.elementName,
          elementType: item.elementType,
          nodeNamePath: item.nodeNamePath,
          levelLabel: item.levelLabel,
          suppressed: hasAdaptivePrivacyWithholding(suppressions),
          suppressions,
          responseCount: exposureRelease.value?.responseCount ?? null,
          exposureRate,
          observedCorrectRate:
            accuracyRelease.value?.observedCorrectRate ?? null,
          expectedCorrectRate:
            accuracyRelease.value?.expectedCorrectRate ?? null,
          residual,
          highExposure:
            exposureRate === null
              ? null
              : exposureRate > HIGH_EXPOSURE_THRESHOLD,
          misfitFlag:
            residual === null
              ? null
              : Math.abs(residual) >= ITEM_RESIDUAL_WARNING_THRESHOLD,
        }
      }
    )
}

function accumulateItemDiagnostics(
  runtime: AdaptiveDiagnosticRuntime,
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator,
  responses: AdaptiveDiagnosticResponse[]
) {
  const evidenceByRoot = new Map<
    number,
    Array<{
      item: { id: number; a: number; b: number; c: number }
      correct: boolean
    }>
  >()
  for (const response of responses) {
    if (response.poolItemId === null) continue
    const item = accumulator.poolById.get(response.poolItemId)
    const metric = accumulator.items.get(response.poolItemId)
    const rootId = item?.nodePath[0]
    if (!item || !metric || typeof rootId !== 'number') continue

    const evidence = evidenceByRoot.get(rootId) ?? []
    const routingTheta = updateTheta({
      responses: evidence,
      range: runtime.algorithm.settings.thetaRange,
      usePrior: true,
      priorMean: 0,
      priorSD: 1,
    }).theta
    metric.responseCount += 1
    metric.correctCount += response.correct ? 1 : 0
    metric.expectedTotal += probability(routingTheta, {
      a: item.discrimination,
      b: item.difficulty,
      c: item.guessing,
    })
    metric.expectedCount += 1
    evidence.push({
      item: {
        id: item.id,
        a: item.discrimination,
        b: item.difficulty,
        c: item.guessing,
      },
      correct: response.correct,
    })
    evidenceByRoot.set(rootId, evidence)
  }
}

function isEstimateNearBoundary(
  runtime: AdaptiveDiagnosticRuntime,
  estimate: AdaptiveDiagnosticEstimate
) {
  if (
    estimate.responseCount < MIN_REPORTING_RESPONSES ||
    estimate.theta === null ||
    estimate.standardError === null ||
    estimate.levelId === null
  ) {
    return false
  }
  return isNearLevelBoundary({
    theta: estimate.theta,
    levels: runtime.algorithm.levels,
    range: runtime.algorithm.settings.thetaRange,
    mappingRule: runtime.algorithm.settings.levelMappingRule,
    margin: runtime.algorithm.settings.classificationZ * estimate.standardError,
  })
}

function incrementHistogram(histogram: Map<number, number>, value: number) {
  histogram.set(value, (histogram.get(value) ?? 0) + 1)
}

function histogramSize(histogram: Map<number, number>) {
  return [...histogram.values()].reduce((sum, count) => sum + count, 0)
}

function histogramPercentile(
  histogram: Map<number, number>,
  quantile: number
): number | null {
  const size = histogramSize(histogram)
  if (size === 0) return null
  const position = (size - 1) * quantile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const ordered = [...histogram.entries()].sort(
    ([left], [right]) => left - right
  )
  const valueAt = (target: number) => {
    let seen = 0
    for (const [value, count] of ordered) {
      seen += count
      if (target < seen) return value
    }
    return ordered.at(-1)![0]
  }
  const lower = valueAt(lowerIndex)
  const upper = valueAt(upperIndex)
  return lower + (upper - lower) * (position - lowerIndex)
}
