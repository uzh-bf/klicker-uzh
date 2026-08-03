import { describe, expect, it } from 'vitest'
import {
  UNEXPECTED_CLEAN_FALLBACKS,
  evaluateRegressionGates,
  type RegressionGateResult,
} from '../scripts/simulationGates.js'
import {
  CANONICAL_PRODUCT_SCENARIOS,
  DIFFICULTY_SHIFT_SWEEP_SCENARIOS,
  DISCRIMINATION_SWEEP_SCENARIOS,
  ITEM_TYPE_SWEEP_SCENARIOS,
  POOL_SIZE_SWEEP_SCENARIOS,
  SIMULATION_REPORT_SCENARIOS,
  STRESS_OVERLAY_SCENARIOS,
  type AdaptiveSimulationScenario,
} from '../scripts/simulationScenarios.js'
import {
  ADAPTIVE_SECONDS_PER_ITEM,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
  deriveGuessingParameter,
  getAdaptivePresetDefaults,
  minimumReachableStandardError,
  type AdaptiveItemType,
} from '../src/index.js'
import {
  BOUNDARY_DISTANCE_STRATA,
  runAdaptiveSimulation,
  type AdaptiveSimulationMetrics,
  type AdaptiveSimulationResult,
} from './simulationHarness.js'

const resultCache = new Map<string, AdaptiveSimulationResult>()
const stressScenarios = SIMULATION_REPORT_SCENARIOS.filter(
  ({ canonicalProductProfile }) => !canonicalProductProfile
)

describe('adaptive-learning production-shaped simulations', () => {
  it.each(CANONICAL_PRODUCT_SCENARIOS)(
    '$config.label uses the canonical shipped preset defaults',
    ({ config }) => {
      const defaults = getAdaptivePresetDefaults(config.preset)

      expect(config).toMatchObject({
        totalQuestionCap: defaults.totalQuestionCap,
        perLeafQuestionCap: defaults.perLeafQuestionCap,
        minQuestionsPerLeaf: defaults.minQuestionsPerLeaf,
        classificationZ: defaults.classificationZ,
        topInformationRatio: defaults.topInformationRatio,
        configuredDiscrimination: defaults.defaultDiscrimination,
        mappingRule: defaults.levelMappingRule,
      })
    }
  )

  it.each(CANONICAL_PRODUCT_SCENARIOS)(
    '$config.label satisfies every Phase 11 engineering regression gate',
    (scenario) => {
      const first = resultFor(scenario)
      const replay = runAdaptiveSimulation(scenario.config)
      const gateResults = evaluateRegressionGates({
        metrics: first.metrics,
        totalQuestionCap: first.config.totalQuestionCap,
        poolProfile: scenario.poolProfile as 'TARGET' | 'RICH',
      })
      const failures = gateResults.filter(({ passed }) => !passed)

      assertMetrics(first.metrics)
      expect(replay).toEqual(first)
      expect(
        Object.fromEntries(
          UNEXPECTED_CLEAN_FALLBACKS.map((stopReason) => [
            stopReason,
            first.metrics.stopReasons[stopReason],
          ])
        )
      ).toEqual({
        NODE_QUESTION_CAP: 0,
        POOL_EXHAUSTED: 0,
        INSUFFICIENT_DATA: 0,
      })
      if (failures.length > 0) {
        throw new Error(formatGateFailures(scenario.config.label, failures))
      }
    }
  )

  it('keeps the old short and long forms explicitly named as stress overlays', () => {
    expect(STRESS_OVERLAY_SCENARIOS.map(({ config }) => config.label)).toEqual([
      'stress-overlay-short-form',
      'stress-overlay-long-form',
    ])
    expect(
      STRESS_OVERLAY_SCENARIOS.every(
        ({ canonicalProductProfile }) => !canonicalProductProfile
      )
    ).toBe(true)
  })

  it('declares the complete deterministic Phase 11 stress matrix', () => {
    expect(
      DISCRIMINATION_SWEEP_SCENARIOS.map(
        ({ config }) => config.configuredDiscrimination
      )
    ).toEqual([1.2, 1.2, 1.2, 1.2])
    expect(
      DISCRIMINATION_SWEEP_SCENARIOS.map(
        ({ config }) => config.trueDiscrimination
      )
    ).toEqual([0.8, 1, 1.2, 1.5])
    expect(
      DIFFICULTY_SHIFT_SWEEP_SCENARIOS.map(
        ({ config }) => config.adjacentLevelShiftProbability
      )
    ).toEqual([0, 0.1, 0.2])
    expect(
      ITEM_TYPE_SWEEP_SCENARIOS.map(({ config }) => config.itemMix)
    ).toEqual(SUPPORTED_ADAPTIVE_ITEM_TYPES)
    expect(
      POOL_SIZE_SWEEP_SCENARIOS.map(({ poolProfile, config }) => [
        poolProfile,
        config.itemsPerLevel,
      ])
    ).toEqual([
      ['SPARSE', 1],
      ['TARGET', 5],
      ['RICH', 10],
    ])

    for (const scenario of DISCRIMINATION_SWEEP_SCENARIOS) {
      const result = resultFor(scenario)
      expect(
        result.itemPool.every(
          ({ configuredDiscrimination, trueDiscrimination }) =>
            configuredDiscrimination === 1.2 &&
            trueDiscrimination === scenario.config.trueDiscrimination
        )
      ).toBe(true)
    }
    for (const scenario of DIFFICULTY_SHIFT_SWEEP_SCENARIOS) {
      const result = resultFor(scenario)
      const shiftedCount = result.itemPool.filter(
        ({ configuredDifficulty, trueDifficulty }) =>
          configuredDifficulty !== trueDifficulty
      ).length
      if (scenario.config.adjacentLevelShiftProbability === 0) {
        expect(shiftedCount).toBe(0)
      } else {
        expect(shiftedCount).toBeGreaterThan(0)
      }
    }
    for (const scenario of ITEM_TYPE_SWEEP_SCENARIOS) {
      const result = resultFor(scenario)
      expect([...new Set(result.itemPool.map(({ type }) => type))]).toEqual([
        scenario.config.itemMix,
      ])
    }
    for (const scenario of POOL_SIZE_SWEEP_SCENARIOS) {
      const result = resultFor(scenario)
      expect(result.itemPool).toHaveLength(
        scenario.config.rootCount *
          scenario.config.leavesPerRoot *
          6 *
          scenario.config.itemsPerLevel
      )
    }
  })

  it.each(stressScenarios)(
    '$config.label produces complete, stratified evidence',
    (scenario) => {
      const result = resultFor(scenario)

      assertMetrics(result.metrics)
      expect(totalStops(result.metrics)).toBe(result.metrics.learnerCount)
      expect(Object.keys(result.metrics.byLevel)).toEqual([
        'A1',
        'A2',
        'B1',
        'B2',
        'C1',
        'C2',
      ])
      expect(Object.keys(result.metrics.byRoot)).toEqual(['root-1', 'root-2'])
      expect(Object.keys(result.metrics.byBoundaryDistance)).toEqual(
        BOUNDARY_DISTANCE_STRATA
      )
      const itemIds = new Set(result.itemPool.map(({ itemId }) => itemId))
      for (const trace of result.learnerTraces) {
        expect(trace.selectedItemIds).toHaveLength(trace.answeredQuestions)
        expect(
          trace.selectedItemIds.every((itemId) => itemIds.has(itemId))
        ).toBe(true)
        expect(trace.responseTrajectory).toHaveLength(trace.answeredQuestions)
        expect(
          trace.responseTrajectory.every(
            (response) => typeof response === 'boolean'
          )
        ).toBe(true)
        expect(trace.rootTerminalStates).toHaveLength(result.config.rootCount)
        expect(Number.isFinite(trace.trueTheta)).toBe(true)
        expect(Number.isFinite(trace.nearestBoundaryDistance)).toBe(true)
        expect(Number.isFinite(trace.nearestBoundaryDistanceRatio)).toBe(true)
      }
    }
  )

  it('preserves a null overall estimate instead of coercing it to theta zero', () => {
    const base = CANONICAL_PRODUCT_SCENARIOS.find(
      ({ config, poolProfile }) =>
        config.preset === 'DIAGNOSTIC' && poolProfile === 'TARGET'
    )!.config
    const result = runAdaptiveSimulation({
      ...base,
      label: 'stress-null-overall-estimate',
      totalQuestionCap: 1,
      learnersPerLevel: 1,
    })

    expect(result.learnerTraces).toHaveLength(6)
    for (const trace of result.learnerTraces) {
      expect(trace.terminalStopReason).toBe('TOTAL_QUESTION_CAP')
      expect(trace.overallEstimate).toEqual({
        theta: null,
        standardError: null,
        levelIndex: null,
        levelLabel: null,
      })
      expect(trace.responseTrajectory).toHaveLength(1)
    }
    expect(result.metrics.nullEstimateCount).toBe(6)
    expect(result.metrics.exactAccuracy).toBe(0)
  })

  it.each(
    SUPPORTED_ADAPTIVE_ITEM_TYPES.map((type) => [
      type,
      choiceCountFor(type),
    ]) satisfies Array<[AdaptiveItemType, number | undefined]>
  )(
    'keeps a %s pool within the analytical reachability range',
    (type, count) => {
      const guessing = deriveGuessingParameter({ type, choiceCount: count })
      const reachable = minimumReachableStandardError({
        itemCount: 100,
        a: 1.2,
        c: guessing,
      })

      expect(Number.isFinite(reachable)).toBe(true)
      expect(reachable).toBeLessThan(0.25)
    }
  )
})

function resultFor(scenario: AdaptiveSimulationScenario) {
  const cached = resultCache.get(scenario.config.label)
  if (cached) return cached
  const result = runAdaptiveSimulation(scenario.config)
  resultCache.set(scenario.config.label, result)
  return result
}

function assertMetrics(metrics: AdaptiveSimulationMetrics) {
  expect(metrics.learnerCount).toBeGreaterThan(0)
  expect(metrics.estimatedLearnerCount).toBeGreaterThanOrEqual(0)
  expect(metrics.nullEstimateCount).toBe(
    metrics.learnerCount - metrics.estimatedLearnerCount
  )
  assertRate(metrics.classificationRate)
  assertRate(metrics.strictPreCapClassificationRate)
  assertRate(metrics.totalQuestionCapRate)
  assertRate(metrics.exactAccuracy)
  assertRate(metrics.adjacentAccuracy)
  expect(metrics.adjacentAccuracy!).toBeGreaterThanOrEqual(
    metrics.exactAccuracy!
  )
  expectNullableFinite(metrics.meanAbsoluteLevelError)
  expectNullableFinite(metrics.signedLevelBias)
  expectNullableFinite(metrics.meanQuestionCount)
  expectNullableFinite(metrics.p95QuestionCount)
  expect(metrics.meanDurationSeconds).toBe(
    metrics.meanQuestionCount! * ADAPTIVE_SECONDS_PER_ITEM
  )
  expect(metrics.p95DurationSeconds).toBe(
    metrics.p95QuestionCount! * ADAPTIVE_SECONDS_PER_ITEM
  )
  assertRootFailureReasonShape(metrics)
}

function assertRootFailureReasonShape(metrics: AdaptiveSimulationMetrics) {
  const expectedKeys = [
    'BREADTH_MISSING',
    'INTERVAL_CROSSES_BOUNDARY',
    'NODE_CAP',
    'GLOBAL_CAP',
    'POOL_EXHAUSTED_OR_INSUFFICIENT',
  ]
  expect(Object.keys(metrics.rootFailureReasons)).toEqual(expectedKeys)
  for (const root of Object.values(metrics.byRoot)) {
    expect(Object.keys(root.failureReasons)).toEqual(expectedKeys)
  }
}

function assertRate(value: number | null) {
  expect(value).not.toBeNull()
  expect(value!).toBeGreaterThanOrEqual(0)
  expect(value!).toBeLessThanOrEqual(1)
}

function expectNullableFinite(value: number | null) {
  expect(value === null || Number.isFinite(value)).toBe(true)
}

function totalStops(metrics: AdaptiveSimulationMetrics) {
  return Object.values(metrics.stopReasons).reduce(
    (total, count) => total + count,
    0
  )
}

function formatGateFailures(label: string, failures: RegressionGateResult[]) {
  const details = failures
    .map(
      ({ metric, scope, actual, comparison, threshold }) =>
        `${metric} (${scope}): actual=${String(
          actual
        )}, required ${comparison} ${threshold}`
    )
    .join('\n')
  return `${label} failed Phase 11 engineering regression gates:\n${details}`
}

function choiceCountFor(type: AdaptiveItemType) {
  return type === 'SC' || type === 'MC' || type === 'KPRIM' ? 4 : undefined
}
