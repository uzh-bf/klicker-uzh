import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  estimateEapPosterior,
  stableBernoulliLogLikelihood,
  summarizeAdaptivePosterior,
  type AdaptiveScoredItem,
  type AdaptiveScoredResponse,
} from '../src/posterior.js'
import type { AdaptiveScaleDefinition } from '../src/scale.js'

const scale = createScale()
const referenceFixtureUrl = new URL(
  './fixtures/eap-reference.json',
  import.meta.url
)
const referenceProvenanceUrl = new URL(
  './fixtures/eap-reference-provenance.md',
  import.meta.url
)
const referenceGeneratorUrl = new URL(
  '../scripts/generateEapReference.ts',
  import.meta.url
)
const referenceFixtureText = readFileSync(referenceFixtureUrl, 'utf8')
const reference = JSON.parse(referenceFixtureText) as EapReferenceFixture

describe('adaptive EAP posterior', () => {
  it.each(reference.cases)(
    'recovers the independent $id reference posterior',
    (referenceCase) => {
      const referenceScale = createScale()
      Object.assign(referenceScale, {
        priorMean: reference.scale.priorMean,
        priorStandardDeviation: reference.scale.priorStandardDeviation,
        gridMin: reference.scale.gridMin,
        gridMax: reference.scale.gridMax,
        gridStep: reference.scale.gridStep,
      })
      const posterior = estimateEapPosterior({
        responses: referenceCase.input.responses,
        scale: referenceScale,
        credibleMass: reference.credibleMass,
      })

      expect(posterior.mean).toBeCloseTo(referenceCase.output.discrete.mean, 10)
      expect(posterior.standardDeviation).toBeCloseTo(
        referenceCase.output.discrete.standardDeviation,
        10
      )
      expect(posterior.credibleLower).toBeCloseTo(
        referenceCase.output.discrete.credibleLower,
        12
      )
      expect(posterior.credibleUpper).toBeCloseTo(
        referenceCase.output.discrete.credibleUpper,
        12
      )
      posterior.bandProbabilities.forEach((band, index) => {
        expect(band.probability).toBeCloseTo(
          referenceCase.output.discrete.bandProbabilities[index]!,
          10
        )
      })
      expect(posterior.mean).toBeCloseTo(
        referenceCase.output.continuous.mean,
        2
      )
      expect(posterior.standardDeviation).toBeCloseTo(
        referenceCase.output.continuous.standardDeviation,
        2
      )
    }
  )

  it('verifies the frozen fixture and generator checksums', () => {
    const provenance = readFileSync(referenceProvenanceUrl, 'utf8')
    const fixtureChecksum = provenance.match(
      /Fixture SHA-256: `([a-f0-9]{64})`/
    )?.[1]
    const generatorChecksum = provenance.match(
      /Generator SHA-256: `([a-f0-9]{64})`/
    )?.[1]

    expect(sha256(referenceFixtureText)).toBe(fixtureChecksum)
    expect(sha256(readFileSync(referenceGeneratorUrl))).toBe(generatorChecksum)
  })

  it('returns the normalized truncated prior without responses', () => {
    const posterior = estimateEapPosterior({
      responses: [],
      scale,
      credibleMass: 0.9,
    })

    expect(posterior.points[0]).toBe(scale.gridMin)
    expect(posterior.points.at(-1)).toBe(scale.gridMax)
    expect(posterior.points).toHaveLength(121)
    expect(posterior.mean).toBeCloseTo(0, 12)
    expect(posterior.standardDeviation).toBeCloseTo(1, 6)
    expect(sum(posterior.probabilities)).toBeCloseTo(1, 12)
    expect(
      sum(posterior.bandProbabilities.map(({ probability }) => probability))
    ).toBeCloseTo(1, 12)
  })

  it.each([
    { correct: true, direction: 1 },
    { correct: false, direction: -1 },
  ])('keeps uniform response strings finite', ({ correct, direction }) => {
    const responses = Array.from({ length: 60 }, (_, index) => ({
      item: createItem({
        id: index + 1,
        calibrationId: `calibration-${index + 1}`,
        difficulty: -3 + (index % 7),
      }),
      correct,
    }))
    const posterior = estimateEapPosterior({
      responses,
      scale,
      credibleMass: 0.9,
    })

    expect(Number.isFinite(posterior.mean)).toBe(true)
    expect(Number.isFinite(posterior.standardDeviation)).toBe(true)
    expect(Math.sign(posterior.mean)).toBe(direction)
    expect(posterior.mean).toBeGreaterThan(scale.gridMin)
    expect(posterior.mean).toBeLessThan(scale.gridMax)
  })

  it('evaluates extreme 2PL and 3PL responses without rounded probabilities', () => {
    const twoPl = createItem({ discrimination: 10, difficulty: -10 })
    const threePl = createItem({
      itemType: 'SC',
      choiceCount: 4,
      model: 'THREE_PL_FIXED_C',
      guessing: 0.25,
      discrimination: 10,
      difficulty: 10,
    })

    expect(
      Number.isFinite(
        stableBernoulliLogLikelihood(10, { item: twoPl, correct: false })
      )
    ).toBe(true)
    expect(
      Number.isFinite(
        stableBernoulliLogLikelihood(-10, {
          item: threePl,
          correct: true,
        })
      )
    ).toBe(true)
  })

  it('uses generalized inverse-CDF bounds and splits exact-cut grid mass', () => {
    const posterior = summarizeAdaptivePosterior({
      points: [-1.5, 0, 1.5],
      probabilities: [0.04, 0.92, 0.04],
      scale,
      credibleMass: 0.9,
    })

    expect(posterior.credibleLower).toBe(0)
    expect(posterior.credibleUpper).toBe(0)
    expect(posterior.bandProbabilities.map(({ levelId }) => levelId)).toEqual([
      1, 2, 3,
    ])
    expect(
      posterior.bandProbabilities.map(({ probability }) => probability)
    ).toEqual([
      expect.closeTo(0.02, 12),
      expect.closeTo(0.96, 12),
      expect.closeTo(0.02, 12),
    ])
  })

  it.each([
    { calibrationId: '' },
    { itemType: 'CONTENT' as 'NUMERICAL' },
    { discrimination: 0 },
    { difficulty: 11 },
    { guessing: 0.1 },
    { model: 'THREE_PL_FIXED_C' as const },
    { choiceCount: 4 },
  ])('rejects malformed or non-calibrated scored items: %o', (overrides) => {
    expect(() =>
      estimateEapPosterior({
        responses: [
          {
            item: createItem(overrides as Partial<AdaptiveScoredItem>),
            correct: true,
          },
        ],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError(TypeError)
  })

  it('rejects incorrect fixed guessing and malformed choice metadata', () => {
    expect(() =>
      estimateEapPosterior({
        responses: [
          {
            item: createItem({
              itemType: 'SC',
              choiceCount: 4,
              model: 'THREE_PL_FIXED_C',
              guessing: 0.2,
            }),
            correct: true,
          },
        ],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError(
      'Scored item guessing must match its item-type guessing parameter.'
    )
    expect(() =>
      estimateEapPosterior({
        responses: [
          {
            item: createItem({
              itemType: 'KPRIM',
              choiceCount: 3,
              model: 'THREE_PL_FIXED_C',
              guessing: 1 / 8,
            }),
            correct: true,
          },
        ],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('Scored KPRIM items must contain exactly 4 statements.')
  })

  it('rejects duplicate item and calibration evidence', () => {
    const item = createItem()
    expect(() =>
      estimateEapPosterior({
        responses: [
          { item, correct: true },
          { item: { ...item }, correct: false },
        ],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('A scored item response must not be counted twice.')

    expect(() =>
      estimateEapPosterior({
        responses: [
          { item, correct: true },
          {
            item: { ...item, id: 'item-2' },
            correct: false,
          },
        ],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('A scored calibration response must not be counted twice.')
  })
})

function createScale(): AdaptiveScaleDefinition {
  return {
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -6,
    gridMax: 6,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    levels: [
      {
        id: 1,
        label: 'Foundation',
        order: 0,
        lowerBound: Number.NEGATIVE_INFINITY,
        upperBound: -1.5,
        itemDifficultyPrior: -3,
      },
      {
        id: 2,
        label: 'Independent',
        order: 1,
        lowerBound: -1.5,
        upperBound: 1.5,
        itemDifficultyPrior: 0,
      },
      {
        id: 3,
        label: 'Advanced',
        order: 2,
        lowerBound: 1.5,
        upperBound: Number.POSITIVE_INFINITY,
        itemDifficultyPrior: 3,
      },
    ],
  }
}

function createItem(
  overrides: Partial<AdaptiveScoredItem> = {}
): AdaptiveScoredItem {
  return {
    id: 'item-1',
    itemType: 'NUMERICAL',
    choiceCount: null,
    model: 'TWO_PL',
    calibrationId: 'calibration-1',
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0,
    ...overrides,
  }
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

type EapReferenceFixture = {
  schemaVersion: 1
  scale: {
    priorMean: number
    priorStandardDeviation: number
    gridMin: number
    gridMax: number
    gridStep: number
    cuts: number[]
  }
  credibleMass: number
  cases: Array<{
    id: string
    input: { responses: AdaptiveScoredResponse[] }
    output: {
      discrete: {
        mean: number
        standardDeviation: number
        credibleLower: number
        credibleUpper: number
        bandProbabilities: number[]
      }
      continuous: {
        mean: number
        standardDeviation: number
      }
    }
  }>
}
