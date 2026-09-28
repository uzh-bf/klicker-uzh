import type * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptivePrivacyRelease,
  type AdaptivePrivacySuppression,
  compactAdaptivePrivacySuppressions,
  hasAdaptivePrivacyWithholding,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveKnownMissingMetric,
  suppressAdaptiveMetric,
} from './adaptivePracticeQuizPrivacy.js'
import type { AdaptiveRuntimeRoutingPoolItem } from './adaptivePracticeQuizRuntime.js'

const HIGH_EXPOSURE_THRESHOLD = 0.4

export type AdaptiveBoxPlot = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  count: number
}

export type AdaptivePilotMetrics = {
  questionCountBoxPlot?: AdaptiveBoxPlot | null
  completionTimeBoxPlot?: AdaptiveBoxPlot | null
  suppressed: boolean
  suppressions: AdaptivePrivacySuppression[]
  medianQuestionCount: number | null
  p95QuestionCount: number | null
  medianElapsedSeconds: number | null
  p95ElapsedSeconds: number | null
  // Deprecated: model-derived boundary classification is not estimated.
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
  // Deprecated model-derived metrics retained as null for API compatibility.
  expectedCorrectRate: number | null
  residual: number | null
  highExposure: boolean | null
  misfitFlag: boolean | null
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
}

export type AdaptivePracticeQuizDiagnosticsAccumulator = {
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
        },
      ])
    ),
  }
}

export function accumulateAdaptivePracticeQuizDiagnostics({
  accumulator,
  attempt,
  overall,
  responses,
}: {
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator
  attempt: AdaptiveDiagnosticAttempt
  overall: AdaptiveDiagnosticEstimate | undefined
  responses: AdaptiveDiagnosticResponse[]
}) {
  incrementHistogram(accumulator.questionCounts, responses.length)
  if (attempt.elapsedSeconds !== null) {
    incrementHistogram(accumulator.durations, attempt.elapsedSeconds)
  }

  const insufficientData = !overall || overall.levelId === null
  if (!overall || overall.responseCount !== responses.length) {
    accumulator.responseCountMismatch += 1
  }

  for (const response of responses) {
    if (response.poolItemId === null) continue
    const metric = accumulator.items.get(response.poolItemId)
    if (!metric) continue
    metric.responseCount += 1
    metric.correctCount += response.correct ? 1 : 0
  }
  return { insufficientData }
}

export function finalizeAdaptivePilotMetrics({
  practiceQuizId,
  cohortSize,
  accumulator,
}: {
  practiceQuizId: string
  cohortSize: number
  accumulator: AdaptivePracticeQuizDiagnosticsAccumulator
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
    cohortSize > 0 && knownDurations === 0
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
  const suppressions = compactAdaptivePrivacySuppressions([
    questionCountRelease.suppression,
    durationPercentileRelease.suppression,
    mismatchRelease.suppression,
    durationMissingRelease.suppression,
  ])
  return {
    suppressed: hasAdaptivePrivacyWithholding(suppressions),
    suppressions,
    questionCountBoxPlot: questionCountRelease.value
      ? summarizeAdaptiveHistogram(accumulator.questionCounts)
      : null,
    completionTimeBoxPlot: durationPercentileRelease.value
      ? summarizeAdaptiveHistogram(accumulator.durations)
      : null,
    medianQuestionCount: questionCountRelease.value?.median ?? null,
    p95QuestionCount: questionCountRelease.value?.p95 ?? null,
    medianElapsedSeconds: durationPercentileRelease.value?.median ?? null,
    p95ElapsedSeconds: durationPercentileRelease.value?.p95 ?? null,
    nearBoundaryRate: null,
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
    .map(({ item, responseCount, correctCount }) => {
      const exposureRelease = releaseAdaptiveBinaryMetric({
        field: 'ITEM_EXPOSURE',
        total: cohortSize,
        positive: responseCount,
        value: {
          responseCount,
          exposureRate: cohortSize === 0 ? null : responseCount / cohortSize,
        },
      })
      const accuracyRelease: AdaptivePrivacyRelease<number> =
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
                value: correctCount / responseCount,
              })
      const suppressions = compactAdaptivePrivacySuppressions([
        exposureRelease.suppression,
        accuracyRelease.suppression,
      ])
      const exposureRate = exposureRelease.value?.exposureRate ?? null
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
        observedCorrectRate: accuracyRelease.value,
        expectedCorrectRate: null,
        residual: null,
        highExposure:
          exposureRate === null ? null : exposureRate > HIGH_EXPOSURE_THRESHOLD,
        misfitFlag: null,
      }
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

export function summarizeAdaptiveHistogram(
  histogram: Map<number, number>
): AdaptiveBoxPlot | null {
  const count = histogramSize(histogram)
  if (count === 0) return null
  return {
    min: histogramPercentile(histogram, 0)!,
    q1: histogramPercentile(histogram, 0.25)!,
    median: histogramPercentile(histogram, 0.5)!,
    q3: histogramPercentile(histogram, 0.75)!,
    max: histogramPercentile(histogram, 1)!,
    count,
  }
}
