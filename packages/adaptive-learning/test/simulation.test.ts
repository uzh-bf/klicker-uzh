import { describe, expect, it } from 'vitest'
import {
  deriveGuessingParameter,
  minimumReachableStandardError,
  type AdaptiveItemType,
  type LevelMappingRule,
} from '../src/index.js'
import {
  runAdaptiveSimulation,
  type AdaptiveSimulationConfig,
  type AdaptiveSimulationMetrics,
} from './simulationHarness.js'

const BASE_CONFIG = {
  rootCount: 2,
  leavesPerRoot: 2,
  itemsPerLevel: 5,
  totalQuestionCap: 60,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 2,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  discrimination: 1.2,
  mislabelProbability: 0,
  learnersPerLevel: 50,
  itemMix: 'MIXED',
  mappingRule: 'NEAREST',
} satisfies Omit<AdaptiveSimulationConfig, 'label'>

const PRESETS = [
  {
    label: 'placement-mastery',
    mappingRule: 'MASTERY',
    totalQuestionCap: 60,
  },
  {
    label: 'diagnostic-nearest',
    mappingRule: 'NEAREST',
    totalQuestionCap: 50,
  },
  {
    label: 'short-form',
    mappingRule: 'NEAREST',
    totalQuestionCap: 36,
  },
  {
    label: 'long-form',
    mappingRule: 'NEAREST',
    itemsPerLevel: 10,
    totalQuestionCap: 90,
  },
] as const satisfies ReadonlyArray<
  Partial<AdaptiveSimulationConfig> & {
    label: string
    mappingRule: LevelMappingRule
  }
>

const SHIPPING_GATES = {
  'placement-mastery': {
    minimumExact: 0.7,
    minimumAdjacent: 0.95,
    maximumMeanAbsoluteError: 0.35,
    maximumMeanQuestions: 58,
    maximumP95Questions: 60,
    maximumAbsoluteLevelBias: 0.75,
    minimumPerLevelExact: 0.55,
    maximumPoolFallbackRate: 0,
  },
  'diagnostic-nearest': {
    minimumExact: 0.7,
    minimumAdjacent: 0.95,
    maximumMeanAbsoluteError: 0.35,
    maximumMeanQuestions: 50,
    maximumP95Questions: 50,
    maximumAbsoluteLevelBias: 0.75,
    minimumPerLevelExact: 0.55,
    maximumPoolFallbackRate: 0,
  },
  'short-form': {
    minimumExact: 0.65,
    minimumAdjacent: 0.9,
    maximumMeanAbsoluteError: 0.45,
    maximumMeanQuestions: 36,
    maximumP95Questions: 36,
    maximumAbsoluteLevelBias: 1,
    minimumPerLevelExact: 0.5,
    maximumPoolFallbackRate: 0,
  },
  'long-form': {
    minimumExact: 0.72,
    minimumAdjacent: 0.95,
    maximumMeanAbsoluteError: 0.32,
    maximumMeanQuestions: 80,
    maximumP95Questions: 90,
    maximumAbsoluteLevelBias: 0.75,
    minimumPerLevelExact: 0.55,
    maximumPoolFallbackRate: 0,
  },
} as const

describe('adaptive-learning production-shaped simulations', () => {
  it.each(PRESETS)('$label satisfies its explicit shipping gates', (preset) => {
    const metrics = runAdaptiveSimulation({ ...BASE_CONFIG, ...preset })
    reportMetrics(preset.label, metrics)
    assertMetrics(metrics)
    const gates = SHIPPING_GATES[preset.label]

    expect(metrics.exactAccuracy).toBeGreaterThanOrEqual(gates.minimumExact)
    expect(metrics.adjacentAccuracy).toBeGreaterThanOrEqual(
      gates.minimumAdjacent
    )
    expect(metrics.meanAbsoluteLevelError).toBeLessThanOrEqual(
      gates.maximumMeanAbsoluteError
    )
    expect(metrics.meanQuestionCount).toBeLessThanOrEqual(
      gates.maximumMeanQuestions
    )
    expect(metrics.p95QuestionCount).toBeLessThanOrEqual(
      gates.maximumP95Questions
    )
    expect(
      Math.max(...Object.values(metrics.perLevelBias).map(Math.abs))
    ).toBeLessThanOrEqual(gates.maximumAbsoluteLevelBias)
    expect(
      Math.min(...Object.values(metrics.perLevelAccuracy))
    ).toBeGreaterThanOrEqual(gates.minimumPerLevelExact)
    expect(
      (metrics.stopReasons.POOL_EXHAUSTED +
        metrics.stopReasons.NODE_QUESTION_CAP) /
        metrics.learnerCount
    ).toBeLessThanOrEqual(gates.maximumPoolFallbackRate)
    expect(metrics.topLevelReached).toBe(true)
  })

  it.each([
    ['sc-only', 'SC_ONLY'],
    ['sc-mc-kprim', 'CHOICES'],
    ['numerical-free-text', 'OPEN_RESPONSE'],
    ['mixed', 'MIXED'],
  ] as const)('tracks recovery for the %s item mix', (label, itemMix) => {
    const metrics = runAdaptiveSimulation({
      ...BASE_CONFIG,
      label: `item-mix-${label}`,
      itemMix,
    })
    reportMetrics(`item-mix-${label}`, metrics)
    assertMetrics(metrics)
    expect(metrics.adjacentAccuracy).toBeGreaterThanOrEqual(0.9)
  })

  it.each([
    ['sparse', 1],
    ['target', 5],
    ['rich', 10],
  ] as const)('tracks the %s pool fallback profile', (label, itemsPerLevel) => {
    const metrics = runAdaptiveSimulation({
      ...BASE_CONFIG,
      label: `pool-${label}`,
      itemsPerLevel,
    })
    reportMetrics(`pool-${label}`, metrics)
    assertMetrics(metrics)
    expect(totalStops(metrics)).toBe(metrics.learnerCount)
    if (label === 'sparse') {
      expect(metrics.stopReasons.POOL_EXHAUSTED).toBeGreaterThan(0)
    }
  })

  it.each([
    ['clean', 0],
    ['ten-percent-shifted', 0.1],
    ['twenty-percent-shifted', 0.2],
  ] as const)('tracks bias under %s item-level noise', (label, noise) => {
    const metrics = runAdaptiveSimulation({
      ...BASE_CONFIG,
      label: `noise-${label}`,
      mislabelProbability: noise,
    })
    reportMetrics(`noise-${label}`, metrics)
    assertMetrics(metrics)
    expect(metrics.adjacentAccuracy).toBeGreaterThanOrEqual(0.85)
  })

  it.each([
    ['SC', 4],
    ['MC', 4],
    ['KPRIM', 4],
    ['NUMERICAL', undefined],
    ['FREE_TEXT', undefined],
  ] satisfies Array<[AdaptiveItemType, number | undefined]>)(
    'keeps a %s pool within the analytical reachability range',
    (type, choiceCount) => {
      const guessing = deriveGuessingParameter({ type, choiceCount })
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

function assertMetrics(metrics: AdaptiveSimulationMetrics) {
  expect(metrics.learnerCount).toBeGreaterThan(0)
  expect(metrics.exactAccuracy).toBeGreaterThanOrEqual(0)
  expect(metrics.exactAccuracy).toBeLessThanOrEqual(1)
  expect(metrics.adjacentAccuracy).toBeGreaterThanOrEqual(metrics.exactAccuracy)
  expect(Number.isFinite(metrics.meanAbsoluteLevelError)).toBe(true)
  expect(Number.isFinite(metrics.meanQuestionCount)).toBe(true)
  expect(Number.isFinite(metrics.p95QuestionCount)).toBe(true)
  expect(Object.values(metrics.perLevelBias).every(Number.isFinite)).toBe(true)
}

function totalStops(metrics: AdaptiveSimulationMetrics) {
  return Object.values(metrics.stopReasons).reduce(
    (total, count) => total + count,
    0
  )
}

function reportMetrics(label: string, metrics: AdaptiveSimulationMetrics) {
  if (process.env.ADAPTIVE_SIMULATION_REPORT !== '1') return
  console.info(
    JSON.stringify({
      label,
      exactAccuracy: metrics.exactAccuracy,
      adjacentAccuracy: metrics.adjacentAccuracy,
      meanAbsoluteLevelError: metrics.meanAbsoluteLevelError,
      meanQuestionCount: metrics.meanQuestionCount,
      p95QuestionCount: metrics.p95QuestionCount,
      stopReasons: metrics.stopReasons,
      perLevelAccuracy: metrics.perLevelAccuracy,
      perLevelBias: metrics.perLevelBias,
    })
  )
}
