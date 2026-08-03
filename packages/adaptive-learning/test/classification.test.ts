import { describe, expect, it } from 'vitest'
import {
  AdaptiveClassificationIntegrityError,
  classifyPosterior,
} from '../src/classification.js'
import {
  type AdaptivePosterior,
  buildAdaptivePosteriorGrid,
  summarizeAdaptivePosterior,
} from '../src/posterior.js'
import type { AdaptiveRuntimeStopReason } from '../src/runtime.js'
import type { AdaptiveScaleDefinition } from '../src/scale.js'

const scale = createScale()

describe('posterior probability classification', () => {
  it('classifies only a band at the exact approved threshold', () => {
    expect(classify([0.1, 0.8, 0.1])).toEqual({
      status: 'CLASSIFIED',
      levelId: 2,
      probability: 0.8,
      leadingLevelIds: [2],
    })
  })

  it('reports an adjacent split without selecting a mean fallback', () => {
    expect(classify([0.05, 0.72, 0.23])).toEqual({
      status: 'BETWEEN_LEVELS',
      levelId: null,
      probability: 0.95,
      leadingLevelIds: [2, 3],
    })
  })

  it('does not report non-adjacent or three-way ambiguous bands', () => {
    expect(classify([0.45, 0.1, 0.45])).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
      levelId: null,
      probability: 0,
    })
    expect(classify([1 / 3, 1 / 3, 1 / 3], { threshold: 0.6 })).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
    })
  })

  it('requires evidence and calibrated coverage before reporting mass', () => {
    expect(
      classify([0.05, 0.9, 0.05], { evidenceSatisfied: false })
    ).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
      probability: 0,
    })
    expect(
      classify([0.05, 0.9, 0.05], {
        calibratedCoverageSatisfied: false,
      })
    ).toMatchObject({ status: 'POOL_LIMITED', probability: 0 })
    expect(
      classify([0.05, 0.9, 0.05], {
        evidenceSatisfied: false,
        evidenceReachable: false,
      })
    ).toMatchObject({ status: 'POOL_LIMITED', probability: 0 })
  })

  it('keeps a supported adjacent result when a cap makes future evidence unreachable', () => {
    expect(
      classify([0.05, 0.72, 0.23], {
        evidenceReachable: false,
        terminalReason: 'TOTAL_QUESTION_CAP',
      })
    ).toMatchObject({ status: 'BETWEEN_LEVELS', probability: 0.95 })
  })

  it('never classifies an abandoned attempt', () => {
    expect(
      classify([0.05, 0.9, 0.05], { terminalReason: 'ABANDONED' })
    ).toMatchObject({ status: 'INSUFFICIENT_EVIDENCE', probability: 0 })
  })

  it('rejects integrity failures and inconsistent classified stops', () => {
    expect(() =>
      classify([0.05, 0.9, 0.05], { integritySatisfied: false })
    ).toThrowError(AdaptiveClassificationIntegrityError)
    expect(() =>
      classify([0.34, 0.33, 0.33], { terminalReason: 'CLASSIFIED' })
    ).toThrowError(
      'A classified stop reason requires a qualifying posterior band.'
    )
    expect(() =>
      classify([0.05, 0.72, 0.23], { terminalReason: 'CLASSIFIED' })
    ).toThrowError(
      'A classified stop reason requires a qualifying posterior band.'
    )
    expect(() =>
      classify([0.05, 0.9, 0.05], {
        evidenceSatisfied: false,
        terminalReason: 'CLASSIFIED',
      })
    ).toThrowError(
      'A classified stop reason requires satisfied evidence and calibrated coverage.'
    )
    expect(() =>
      classify([0.05, 0.9, 0.05], {
        calibratedCoverageSatisfied: false,
        terminalReason: 'CLASSIFIED',
      })
    ).toThrowError(
      'A classified stop reason requires satisfied evidence and calibrated coverage.'
    )
  })

  it('rejects malformed posterior distributions before classification', () => {
    const malformed = posteriorWithBandMass([0.1, 0.8, 0.1])
    malformed.mean = Number.NaN
    expect(() =>
      classifyPosterior({
        posterior: malformed,
        scale,
        credibleMass: 0.9,
        probabilityThreshold: 0.8,
        evidenceSatisfied: true,
        evidenceReachable: true,
        calibratedCoverageSatisfied: true,
        integritySatisfied: true,
        terminalReason: null,
      })
    ).toThrowError('Posterior summary is malformed.')
  })

  it('rejects summaries and bands that contradict point probabilities', () => {
    const mutations: Array<(posterior: AdaptivePosterior) => void> = [
      (posterior) => {
        posterior.mean += 0.1
      },
      (posterior) => {
        posterior.variance += 0.1
      },
      (posterior) => {
        posterior.standardDeviation += 0.1
      },
      (posterior) => {
        posterior.credibleLower += 0.1
      },
      (posterior) => {
        posterior.bandProbabilities = [
          { levelId: 1, probability: 0.05 },
          { levelId: 2, probability: 0.9 },
          { levelId: 3, probability: 0.05 },
        ]
      },
    ]

    for (const mutate of mutations) {
      const posterior = posteriorWithBandMass([0.8, 0.1, 0.1])
      mutate(posterior)
      expect(() => classifyPosterior(baseInput(posterior))).toThrowError(
        /match its point probabilities/
      )
    }
  })

  it('rejects non-canonical points and deserialized non-boolean guards', () => {
    const posterior = posteriorWithBandMass([0.1, 0.8, 0.1])
    posterior.points[0] = posterior.points[0]! + 0.01
    expect(() => classifyPosterior(baseInput(posterior))).toThrowError(
      'Posterior points must use the canonical scale grid.'
    )

    for (const key of [
      'evidenceSatisfied',
      'evidenceReachable',
      'calibratedCoverageSatisfied',
      'integritySatisfied',
    ] as const) {
      const input: Record<string, unknown> = baseInput(
        posteriorWithBandMass([0.1, 0.8, 0.1])
      )
      input[key] = 'false'
      expect(() =>
        classifyPosterior(
          input as unknown as Parameters<typeof classifyPosterior>[0]
        )
      ).toThrowError('must be boolean')
    }
  })

  it('allows an uncertain overall result after all roots classify', () => {
    expect(
      classify([0.05, 0.72, 0.23], {
        terminalReason: 'ALL_ROOTS_CLASSIFIED',
      })
    ).toMatchObject({ status: 'BETWEEN_LEVELS' })
  })

  it.each([
    null,
    'TOTAL_QUESTION_CAP',
    'NODE_QUESTION_CAP',
    'POOL_EXHAUSTED',
    'INSUFFICIENT_DATA',
  ] as const satisfies readonly (AdaptiveRuntimeStopReason | null)[])('handles the non-success terminal reason %s exhaustively', (terminalReason) => {
    expect(classify([0.34, 0.33, 0.33], { terminalReason })).toMatchObject({
      status: 'INSUFFICIENT_EVIDENCE',
    })
  })
})

function classify(
  masses: [number, number, number],
  overrides: {
    threshold?: number
    evidenceSatisfied?: boolean
    evidenceReachable?: boolean
    calibratedCoverageSatisfied?: boolean
    integritySatisfied?: boolean
    terminalReason?: AdaptiveRuntimeStopReason | null
  } = {}
) {
  return classifyPosterior({
    posterior: posteriorWithBandMass(masses),
    scale,
    credibleMass: 0.9,
    probabilityThreshold: overrides.threshold ?? 0.8,
    evidenceSatisfied: overrides.evidenceSatisfied ?? true,
    evidenceReachable: overrides.evidenceReachable ?? true,
    calibratedCoverageSatisfied: overrides.calibratedCoverageSatisfied ?? true,
    integritySatisfied: overrides.integritySatisfied ?? true,
    terminalReason: overrides.terminalReason ?? null,
  })
}

function posteriorWithBandMass(
  masses: [number, number, number]
): AdaptivePosterior {
  const points = buildAdaptivePosteriorGrid(scale)
  const probabilities = points.map(() => 0)
  probabilities[points.indexOf(-3)] = masses[0]
  probabilities[points.indexOf(0)] = masses[1]
  probabilities[points.indexOf(3)] = masses[2]
  return summarizeAdaptivePosterior({
    points,
    probabilities,
    scale,
    credibleMass: 0.9,
  })
}

function baseInput(posterior: AdaptivePosterior) {
  return {
    posterior,
    scale,
    credibleMass: 0.9,
    probabilityThreshold: 0.8,
    evidenceSatisfied: true,
    evidenceReachable: true,
    calibratedCoverageSatisfied: true,
    integritySatisfied: true,
    terminalReason: null,
  }
}

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
