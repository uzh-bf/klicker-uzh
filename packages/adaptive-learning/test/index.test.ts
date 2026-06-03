import { describe, expect, it } from 'vitest'
import {
  aggregateInverseVariance,
  aggregateWeightedEstimates,
  computeSubCompetenceCoverageWeights,
  deriveGuessingParameter,
  information,
  mapLevelsToTheta,
  mapThetaToLevel,
  matchResultMessage,
  matchResultMessages,
  probability,
  selectNextItem,
  selectSubCompetence,
  shouldStop,
  updateTheta,
  validateEnabledStructure,
} from '../src/index.js'

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
    expect(deriveGuessingParameter({ type: 'FREE_TEXT' })).toBe(0.01)
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

  it('stops by standard error or question threshold', () => {
    expect(
      shouldStop({
        answeredQuestions: 2,
        questionThreshold: 4,
        standardError: 0.3,
        standardErrorThreshold: 0.4,
      })
    ).toBe(true)
    expect(
      shouldStop({
        answeredQuestions: 4,
        questionThreshold: 4,
        standardError: 0.9,
        standardErrorThreshold: 0.4,
      })
    ).toBe(true)
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

  it('aggregates estimates with inverse variance weighting', () => {
    const aggregate = aggregateInverseVariance([
      { theta: -1, standardError: 1 },
      { theta: 1, standardError: 0.5 },
    ])

    expect(aggregate?.theta).toBeCloseTo(0.6, 3)
    expect(aggregate?.standardError).toBeCloseTo(0.447, 3)
  })

  it('aggregates weighted estimates with propagated variance', () => {
    const aggregate = aggregateWeightedEstimates([
      { theta: -1, standardError: 0.5, weight: 1 },
      { theta: 1, standardError: 0.5, weight: 3 },
    ])

    expect(aggregate?.theta).toBeCloseTo(0.5, 3)
    expect(aggregate?.standardError).toBeCloseTo(0.395, 3)
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
