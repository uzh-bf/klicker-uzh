import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_CLASSIFICATION_POLICY_V1,
  validateAdaptiveClassificationPolicy,
  type AdaptiveClassificationPolicy,
} from '../src/policy.js'

function createPolicy(
  overrides: Partial<AdaptiveClassificationPolicy> = {}
): AdaptiveClassificationPolicy {
  return {
    version: 1,
    credibleMass: 0.9,
    candidateProbabilityThresholds: [0.8, 0.9, 0.95],
    minimumProbabilityThreshold: 0.8,
    ...overrides,
  }
}

describe('adaptive classification policy', () => {
  it('defines the exact immutable v1 policy', () => {
    expect(ADAPTIVE_CLASSIFICATION_POLICY_V1).toEqual(createPolicy())
    expect(Object.isFrozen(ADAPTIVE_CLASSIFICATION_POLICY_V1)).toBe(true)
    expect(
      Object.isFrozen(
        ADAPTIVE_CLASSIFICATION_POLICY_V1.candidateProbabilityThresholds
      )
    ).toBe(true)

    expect(() => {
      ;(
        ADAPTIVE_CLASSIFICATION_POLICY_V1.candidateProbabilityThresholds as number[]
      ).push(0.99)
    }).toThrowError(TypeError)
    expect(() => {
      ;(
        ADAPTIVE_CLASSIFICATION_POLICY_V1 as {
          credibleMass: number
        }
      ).credibleMass = 0.8
    }).toThrowError(TypeError)
    expect(ADAPTIVE_CLASSIFICATION_POLICY_V1).toEqual(createPolicy())
  })

  it('accepts a finite, sorted policy at or above the minimum', () => {
    expect(validateAdaptiveClassificationPolicy(createPolicy())).toEqual([])
  })

  it.each([
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    0,
    1,
    -0.1,
    1.1,
  ])('rejects an invalid credible mass of %s', (credibleMass) => {
    expect(
      validateAdaptiveClassificationPolicy(createPolicy({ credibleMass }))
    ).toContain('Credible mass must be finite and strictly between 0 and 1.')
  })

  it('rejects unsorted and duplicate candidate thresholds', () => {
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [0.9, 0.8] })
      )
    ).toContain('Candidate probability thresholds must be strictly increasing.')
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [0.8, 0.8] })
      )
    ).toContain('Candidate probability thresholds must be strictly increasing.')
  })

  it('rejects non-finite and out-of-range candidate thresholds', () => {
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [0.8, Number.NaN] })
      )
    ).toContain(
      'Candidate probability thresholds must be finite and strictly between 0 and 1.'
    )
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [0.8, 1] })
      )
    ).toContain(
      'Candidate probability thresholds must be finite and strictly between 0 and 1.'
    )
  })

  it('rejects thresholds below the supported minimum', () => {
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [0.79, 0.9] })
      )
    ).toContain(
      'Candidate probability thresholds must not be below the minimum threshold.'
    )
  })

  it('rejects malformed versions, minimums, and empty candidate lists', () => {
    expect(
      validateAdaptiveClassificationPolicy(createPolicy({ version: 0 }))
    ).toContain('A supported classification policy version is required.')
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ minimumProbabilityThreshold: 1 })
      )
    ).toContain(
      'Minimum probability threshold must be finite and strictly between 0 and 1.'
    )
    expect(
      validateAdaptiveClassificationPolicy(
        createPolicy({ candidateProbabilityThresholds: [] })
      )
    ).toContain('At least one candidate probability threshold is required.')
  })
})
