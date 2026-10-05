import { describe, expect, test } from 'vitest'
import { summarizeAdaptiveDistributionCoverage } from '../src/components/evaluation/adaptive/adaptiveDistributionCoverage'

describe('summarizeAdaptiveDistributionCoverage', () => {
  test('separates untested results from results without a usable estimate', () => {
    expect(
      summarizeAdaptiveDistributionCoverage({
        cohortSize: 30,
        estimatedCount: 12,
        notTestedCount: 15,
      })
    ).toEqual({ notTested: 15, withoutUsableEstimate: 3 })
  })

  test('keeps untested results out of the estimate count', () => {
    expect(
      summarizeAdaptiveDistributionCoverage({
        cohortSize: 10,
        estimatedCount: 0,
        notTestedCount: 10,
      })
    ).toEqual({ notTested: 10, withoutUsableEstimate: 0 })
  })

  test('falls back to one excluded group for older payloads', () => {
    expect(
      summarizeAdaptiveDistributionCoverage({
        cohortSize: 10,
        estimatedCount: 7,
        notTestedCount: null,
      })
    ).toEqual({ notTested: null, withoutUsableEstimate: 3 })
  })

  test('clamps inconsistent counts and handles a withheld cohort size', () => {
    expect(
      summarizeAdaptiveDistributionCoverage({
        cohortSize: 5,
        estimatedCount: 4,
        notTestedCount: 9,
      })
    ).toEqual({ notTested: 1, withoutUsableEstimate: 0 })
    expect(
      summarizeAdaptiveDistributionCoverage({
        cohortSize: null,
        estimatedCount: 4,
        notTestedCount: 1,
      })
    ).toEqual({ notTested: null, withoutUsableEstimate: null })
  })
})
