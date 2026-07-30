import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_PRESET_DEFAULTS,
  aggregateInverseVariance,
  aggregateWeightedEstimates,
  classificationIntervalWithinLevelBand,
  computeSubCompetenceCoverageWeights,
  deriveGuessingParameter,
  getAdaptivePresetDefaults,
  information,
  informationAtDifficulty,
  isNearLevelBoundary,
  mapLevelsToTheta,
  mapThetaToLevel,
  matchResultMessage,
  matchResultMessages,
  minimumReachableStandardError,
  normalizeAdaptiveEstimateForChart,
  normalizeFreeTextResponse,
  normalizeNumericalResponse,
  normalizeThetaForChart,
  probability,
  selectNextItem,
  selectSubCompetence,
  updateTheta,
  validateEnabledStructure,
} from '../src/index.js'

describe('adaptive preset contract', () => {
  it('defines the shipped defaults once for every preset', () => {
    expect(ADAPTIVE_PRESET_DEFAULTS).toEqual({
      PLACEMENT: {
        totalQuestionCap: 50,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 2,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        defaultDiscrimination: 1.2,
        levelMappingRule: 'MASTERY',
        attemptSelectionPolicy: 'FIRST_COMPLETED',
        showTimer: true,
      },
      DIAGNOSTIC: {
        totalQuestionCap: 50,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 2,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        defaultDiscrimination: 1.2,
        levelMappingRule: 'NEAREST',
        attemptSelectionPolicy: 'LATEST_COMPLETED',
        showTimer: true,
      },
      RESEARCH: {
        totalQuestionCap: 50,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 2,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        defaultDiscrimination: 1.2,
        levelMappingRule: 'NEAREST',
        attemptSelectionPolicy: 'LATEST_COMPLETED',
        showTimer: true,
      },
    })
  })

  it('uses the competence-tree discrimination as the Research default', () => {
    expect(
      getAdaptivePresetDefaults('RESEARCH', {
        treeDefaultDiscrimination: 1.7,
      }).defaultDiscrimination
    ).toBe(1.7)
    expect(
      getAdaptivePresetDefaults('DIAGNOSTIC', {
        treeDefaultDiscrimination: 1.7,
      }).defaultDiscrimination
    ).toBe(1.2)
  })
})

describe('adaptive-learning core', () => {
  it('maps lecturer levels evenly across the theta range', () => {
    const levels = mapLevelsToTheta([
      { label: 'A2', order: 0 },
      { label: 'B1', order: 1 },
      { label: 'B2', order: 2 },
      { label: 'C1', order: 3 },
    ])

    expect(levels.map((level) => level.theta)).toEqual([-3, -1, 1, 3])
    expect(mapThetaToLevel(0.2, levels)?.label).toBe('B2')
  })

  it('maps a single level to the theta midpoint', () => {
    const levels = mapLevelsToTheta([{ label: 'Complete', order: 0 }])

    expect(levels[0]?.theta).toBe(0)
    expect(mapThetaToLevel(2, levels)?.label).toBe('Complete')
  })

  it('normalizes estimates and uncertainty to bounded chart coordinates', () => {
    expect(normalizeThetaForChart(0)).toBe(0.5)
    expect(normalizeThetaForChart(-9)).toBe(0)
    expect(normalizeThetaForChart(9)).toBe(1)
    expect(
      normalizeAdaptiveEstimateForChart({
        theta: 0,
        standardError: 0.5,
        z: 2,
      })
    ).toEqual({
      position: 0.5,
      lowerPosition: 1 / 3,
      upperPosition: 2 / 3,
    })
  })

  it('rejects invalid chart-normalization inputs', () => {
    expect(() => normalizeThetaForChart(0, { min: 1, max: 1 })).toThrowError(
      TypeError
    )
    expect(() =>
      normalizeAdaptiveEstimateForChart({
        theta: 0,
        standardError: Number.POSITIVE_INFINITY,
      })
    ).toThrowError(TypeError)
  })

  it('computes 3PL probabilities and information', () => {
    const item = { a: 1.5, b: 0, c: 0.25 }

    expect(probability(0, item)).toBeCloseTo(0.625, 3)
    expect(probability(2, item)).toBeGreaterThan(probability(-2, item))
    expect(information(0, item)).toBeGreaterThan(0)
  })

  it('uses item discrimination to sharpen the response curve', () => {
    const lowerDiscrimination = { a: 0.6, b: 0, c: 0.25 }
    const higherDiscrimination = { a: 1.8, b: 0, c: 0.25 }

    expect(probability(1, higherDiscrimination)).toBeGreaterThan(
      probability(1, lowerDiscrimination)
    )
  })

  it('derives guessing values by item type', () => {
    expect(deriveGuessingParameter({ type: 'SC', choiceCount: 4 })).toBe(0.25)
    expect(deriveGuessingParameter({ type: 'MC', choiceCount: 4 })).toBeCloseTo(
      1 / 15,
      6
    )
    expect(deriveGuessingParameter({ type: 'KPRIM', choiceCount: 4 })).toBe(
      1 / 16
    )
    expect(deriveGuessingParameter({ type: 'NUMERICAL' })).toBe(0)
    expect(deriveGuessingParameter({ type: 'FREE_TEXT' })).toBe(0)
  })

  it('supports nearest and mastery level mapping rules', () => {
    const levels = [
      { label: 'A1', order: 0 },
      { label: 'A2', order: 1 },
      { label: 'B1', order: 2 },
    ]

    expect(mapThetaToLevel(2, levels)?.label).toBe('B1')
    expect(mapThetaToLevel(0, levels, undefined, 'MASTERY')?.label).toBe('A2')
    expect(mapThetaToLevel(2, levels, undefined, 'MASTERY')?.label).toBe('B1')
    expect(
      mapLevelsToTheta(levels, undefined, 'NEAREST').map((level) => [
        level.label,
        level.lowerBound,
        level.upperBound,
      ])
    ).toEqual([
      ['A1', Number.NEGATIVE_INFINITY, -1.5],
      ['A2', -1.5, 1.5],
      ['B1', 1.5, Number.POSITIVE_INFINITY],
    ])
    expect(
      mapLevelsToTheta(levels, undefined, 'MASTERY').map((level) => [
        level.label,
        level.lowerBound,
        level.upperBound,
      ])
    ).toEqual([
      ['A1', Number.NEGATIVE_INFINITY, -1],
      ['A2', -1, 1],
      ['B1', 1, Number.POSITIVE_INFINITY],
    ])
  })

  it('updates theta in the expected direction', () => {
    const correct = updateTheta({
      responses: [
        { item: { id: 1, a: 1.5, b: -1, c: 0.25 }, correct: true },
        { item: { id: 2, a: 1.5, b: 0, c: 0.25 }, correct: true },
        { item: { id: 3, a: 1.5, b: 1, c: 0.25 }, correct: true },
      ],
    })
    const wrong = updateTheta({
      responses: [
        { item: { id: 1, a: 1.5, b: -1, c: 0.25 }, correct: false },
        { item: { id: 2, a: 1.5, b: 0, c: 0.25 }, correct: false },
        { item: { id: 3, a: 1.5, b: 1, c: 0.25 }, correct: false },
      ],
    })

    expect(correct.theta).toBeGreaterThan(0)
    expect(wrong.theta).toBeLessThan(0)
    expect(correct.standardError).toBeGreaterThan(0)
  })

  it('uses MAP prior precision in the returned standard error', () => {
    const estimate = updateTheta({
      responses: [{ item: { id: 1, a: 1.5, b: 0, c: 0.25 }, correct: true }],
      usePrior: true,
      priorSD: 1,
    })

    expect(Math.abs(estimate.theta)).toBeLessThan(1.5)
    expect(estimate.standardError).toBeLessThan(1)
  })

  it('selects subcompetences by largest coverage and randomizes ties', () => {
    const selected = selectSubCompetence({
      candidates: [
        {
          competenceId: 'grammar',
          subCompetenceId: 'a',
          enabled: true,
          levelThetas: [-3, -1],
        },
        {
          competenceId: 'grammar',
          subCompetenceId: 'b',
          enabled: true,
          levelThetas: [-3, 1, 3],
        },
      ],
    })

    expect(selected?.subCompetenceId).toBe('b')

    const tie = selectSubCompetence({
      candidates: [
        {
          competenceId: 'grammar',
          subCompetenceId: 'a',
          enabled: true,
          coverage: 2,
        },
        {
          competenceId: 'grammar',
          subCompetenceId: 'b',
          enabled: true,
          coverage: 2,
        },
      ],
      random: () => 0.75,
    })

    expect(tie?.subCompetenceId).toBe('b')
  })

  it('weights subcompetence coverage by distinct remaining levels', () => {
    const weights = computeSubCompetenceCoverageWeights([
      {
        competenceId: 'grammar',
        subCompetenceId: 'wide',
        enabled: true,
        coverage: 5,
      },
      {
        competenceId: 'grammar',
        subCompetenceId: 'narrow',
        enabled: true,
        coverage: 3,
      },
    ])

    expect(
      weights.find((entry) => entry.candidate.subCompetenceId === 'wide')
        ?.weight
    ).toBeCloseTo(5 / 8, 6)
    expect(
      weights.find((entry) => entry.candidate.subCompetenceId === 'narrow')
        ?.weight
    ).toBeCloseTo(3 / 8, 6)
  })

  it('selects max-information items and randomizes ties', () => {
    const item = selectNextItem({
      theta: 0,
      items: [
        { id: 1, b: 0, exposure: 7 },
        { id: 2, b: 0, exposure: 1 },
        { id: 3, b: 3, exposure: 0 },
      ],
      random: () => 0.75,
    })

    expect(item?.id).toBe(2)
  })

  it('supports randomesque top-information item selection', () => {
    const item = selectNextItem({
      theta: 0,
      topInformationRatio: 0.7,
      items: [
        { id: 1, b: 0 },
        { id: 2, b: 0.1 },
        { id: 3, b: 3 },
      ],
      random: () => 0.75,
    })

    expect(item?.id).toBe(2)
  })

  it('keeps selecting when exposure penalties make all scores negative', () => {
    const item = selectNextItem({
      theta: 0,
      topInformationRatio: 0.8,
      exposurePenalty: 10,
      items: [
        { id: 1, b: 0, exposure: 1 },
        { id: 2, b: 0, exposure: 2 },
      ],
    })

    expect(item?.id).toBe(1)
  })

  it('computes stop feasibility and classification bands', () => {
    const levels = [
      { label: 'A1', order: 0 },
      { label: 'A2', order: 1 },
      { label: 'B1', order: 2 },
    ]

    expect(informationAtDifficulty({ a: 1.5, c: 0.25 })).toBeCloseTo(0.3375, 4)
    expect(
      minimumReachableStandardError({ itemCount: 8, a: 1.5, c: 0.25 })
    ).toBeCloseTo(0.6086, 3)
    expect(
      classificationIntervalWithinLevelBand({
        theta: 0,
        standardError: 0.2,
        levels,
      })
    ).toBe(true)
    expect(
      classificationIntervalWithinLevelBand({
        theta: 1.45,
        standardError: 0.2,
        levels,
      })
    ).toBe(false)
    expect(isNearLevelBoundary({ theta: 1.45, levels, margin: 0.1 })).toBe(true)
    expect(
      classificationIntervalWithinLevelBand({
        theta: 2.5,
        standardError: 0.2,
        levels,
        mappingRule: 'MASTERY',
      })
    ).toBe(true)
  })

  it('normalizes numerical adaptive responses', () => {
    expect(normalizeNumericalResponse('0,5')).toEqual({
      value: 0.5,
      normalized: '0.5',
    })
    expect(normalizeNumericalResponse('1,5')).toEqual({
      value: 1.5,
      normalized: '1.5',
    })
    expect(normalizeNumericalResponse('−1 200')).toEqual({
      value: -1200,
      normalized: '-1200',
    })
    expect(normalizeNumericalResponse('1/4')).toEqual({
      value: 0.25,
      normalized: '0.25',
    })
    expect(normalizeNumericalResponse('1e-3')).toEqual({
      value: 0.001,
      normalized: '0.001',
    })
    expect(normalizeNumericalResponse('1,200').value).toBeNull()
    expect(normalizeNumericalResponse('12,000').value).toBeNull()
    expect(normalizeNumericalResponse('0,500')).toEqual({
      value: 0.5,
      normalized: '0.5',
    })
    expect(normalizeNumericalResponse(',500')).toEqual({
      value: 0.5,
      normalized: '0.5',
    })
    expect(normalizeNumericalResponse('25%').value).toBeNull()
    expect(
      normalizeNumericalResponse('25%', { allowPercentInput: true })
    ).toEqual({
      value: 0.25,
      normalized: '0.25',
    })
    expect(normalizeNumericalResponse('1,234.56').value).toBeNull()
  })

  it('normalizes free-text adaptive responses', () => {
    expect(normalizeFreeTextResponse('  Está   BIEN  ')).toBe('esta bien')
  })

  it('aggregates estimates with inverse variance weighting', () => {
    const aggregate = aggregateInverseVariance([
      { theta: -1, standardError: 1 },
      { theta: 1, standardError: 0.5 },
    ])

    expect(aggregate?.theta).toBeCloseTo(0.6, 3)
    expect(aggregate?.standardError).toBeCloseTo(0.447, 3)

    expect(
      aggregateInverseVariance([
        { theta: Number.NaN, standardError: 0.1 },
        { theta: 1, standardError: 0.5, weight: -1 },
        { theta: 2, standardError: 1 },
      ])
    ).toEqual({ theta: 2, standardError: 1 })

    const extremePrecision = aggregateInverseVariance([
      { theta: -1, standardError: 1e-200, weight: 1e200 },
      { theta: 1, standardError: 1e-200, weight: 1e200 },
    ])
    expect(extremePrecision?.theta).toBe(0)
    expect(Number.isFinite(extremePrecision?.standardError)).toBe(true)
    expect(
      aggregateInverseVariance([
        { theta: 0, standardError: 1e308, weight: Number.MIN_VALUE },
      ])
    ).toBeNull()
  })

  it('aggregates weighted estimates with propagated variance', () => {
    const aggregate = aggregateWeightedEstimates([
      { theta: -1, standardError: 0.5, weight: 1 },
      { theta: 1, standardError: 0.5, weight: 3 },
    ])

    expect(aggregate?.theta).toBeCloseTo(0.5, 3)
    expect(aggregate?.standardError).toBeCloseTo(0.395, 3)

    const largeWeights = aggregateWeightedEstimates([
      { theta: -1, standardError: 0.5, weight: 1e308 },
      { theta: 1, standardError: 0.5, weight: 1e308 },
    ])
    expect(largeWeights?.theta).toBe(0)
    expect(largeWeights?.standardError).toBeCloseTo(0.354, 3)
    expect(
      aggregateWeightedEstimates([
        { theta: -1, standardError: 0.5, weight: 0 },
        { theta: 1, standardError: 0.5, weight: 0 },
      ])
    ).toBeNull()
  })

  it('validates disabled pools', () => {
    expect(
      validateEnabledStructure([
        { enabled: false, subCompetences: [{ enabled: true }] },
      ]).valid
    ).toBe(false)
    expect(
      validateEnabledStructure([
        { enabled: true, subCompetences: [{ enabled: false }] },
      ]).valid
    ).toBe(false)
    expect(
      validateEnabledStructure([
        { enabled: true, subCompetences: [{ enabled: true }] },
      ]).valid
    ).toBe(true)
  })

  it('matches custom result messages before fallback', () => {
    const message = matchResultMessage({
      theta: 0.6,
      levelLabel: 'B1',
      rules: [
        {
          order: 0,
          levelLabel: 'B1',
          message: 'Try B2 as well.',
        },
        {
          order: 99,
          isFallback: true,
          message: 'Thanks.',
        },
      ],
    })

    expect(message).toBe('Try B2 as well.')
  })

  it('adds optional interval result messages only to completed summaries', () => {
    const messages = matchResultMessages({
      theta: 2.6,
      levelLabel: 'Mastery',
      rules: [
        {
          order: 0,
          levelLabel: 'Mastery',
          message: 'Excellent final standing.',
        },
        {
          order: 1,
          minTheta: 2.5,
          maxTheta: 2.75,
          message: 'You are close to the top mastery band.',
        },
        {
          order: 2,
          minTheta: 1.5,
          maxTheta: 1.75,
          message: 'You are entering advanced territory.',
        },
        {
          order: 99,
          isFallback: true,
          message: 'Thanks.',
        },
      ],
    })

    expect(messages).toEqual([
      'Excellent final standing.',
      'You are close to the top mastery band.',
    ])
  })
})
