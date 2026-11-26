import {
  decideAdaptivePrivacyPartition,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveCategoricalMetric,
  releaseAdaptiveKnownMissingMetric,
} from '../src/services/adaptivePracticeQuizPrivacy.js'

describe('adaptive practice quiz reporting availability', () => {
  it.each([
    { total: 0, positive: 0, released: false },
    { total: 4, positive: 0, released: true },
    { total: 5, positive: 0, released: true },
    { total: 5, positive: 5, released: true },
    { total: 6, positive: 1, released: true },
    { total: 6, positive: 5, released: true },
    { total: 9, positive: 5, released: true },
    { total: 10, positive: 5, released: true },
    { total: 10, positive: 9, released: true },
    { total: 15, positive: 5, released: true },
    { total: 15, positive: 10, released: true },
  ])('releases=$released for binary partition $positive/$total', ({
    total,
    positive,
    released,
  }) => {
    const result = releaseAdaptiveBinaryMetric({
      field: 'NEAR_BOUNDARY',
      total,
      positive,
      value: positive,
    })

    expect(result.value === positive).toBe(released)
    expect(result.suppression === null).toBe(released)
  })

  it('reports singleton values and complements for every cohort size from 0 to 15', () => {
    for (let total = 0; total <= 15; total++) {
      for (const positive of new Set(
        [0, 1, Math.max(0, total - 1), total].filter((count) => count <= total)
      )) {
        const decision = decideAdaptivePrivacyPartition([
          positive,
          total - positive,
        ])
        const expected = total > 0

        expect(decision.allowed).toBe(expected)
      }
    }
  })

  it('uses one categorical rule for levels and insufficient data', () => {
    expect(
      releaseAdaptiveCategoricalMetric({
        field: 'DISTRIBUTION',
        cells: [5, 5, 0],
        value: 'released',
      })
    ).toEqual({ value: 'released', suppression: null })
    expect(
      releaseAdaptiveCategoricalMetric({
        field: 'DISTRIBUTION',
        cells: [5, 4, 1],
        value: 'released',
      })
    ).toEqual({ value: 'released', suppression: null })
  })

  it.each([
    { total: 5, known: 5, released: true },
    { total: 5, known: 4, released: true },
    { total: 10, known: 5, released: true },
    { total: 10, known: 9, released: true },
    { total: 15, known: 10, released: true },
  ])('reports available data with small known/missing source populations ($known/$total)', ({
    total,
    known,
    released,
  }) => {
    const result = releaseAdaptiveKnownMissingMetric({
      field: 'DURATION_PERCENTILES',
      total,
      known,
      value: 42,
    })

    expect(result.value === 42).toBe(released)
    expect(result.suppression === null).toBe(released)
  })

  it('rejects malformed partitions instead of silently releasing them', () => {
    expect(() => decideAdaptivePrivacyPartition([5])).toThrow()
    expect(() => decideAdaptivePrivacyPartition([5, -1])).toThrow()
    expect(() =>
      releaseAdaptiveBinaryMetric({
        field: 'CLASSIFIED',
        total: 5,
        positive: 6,
        value: 6,
      })
    ).toThrow()
  })
})
