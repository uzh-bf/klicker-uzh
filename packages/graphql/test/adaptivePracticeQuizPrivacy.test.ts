import {
  decideAdaptivePrivacyPartition,
  releaseAdaptiveBinaryMetric,
  releaseAdaptiveCategoricalMetric,
  releaseAdaptiveKnownMissingMetric,
} from '../src/services/adaptivePracticeQuizPrivacy.js'

describe('adaptive practice quiz privacy policy', () => {
  it.each([
    { total: 0, positive: 0, released: false },
    { total: 4, positive: 0, released: false },
    { total: 5, positive: 0, released: true },
    { total: 5, positive: 5, released: true },
    { total: 6, positive: 1, released: false },
    { total: 6, positive: 5, released: false },
    { total: 9, positive: 5, released: false },
    { total: 10, positive: 5, released: true },
    { total: 10, positive: 9, released: false },
    { total: 15, positive: 5, released: true },
    { total: 15, positive: 10, released: true },
  ])(
    'releases=$released for binary partition $positive/$total',
    ({ total, positive, released }) => {
      const result = releaseAdaptiveBinaryMetric({
        field: 'NEAR_BOUNDARY',
        total,
        positive,
        value: positive,
      })

      expect(result.value === positive).toBe(released)
      expect(result.suppression === null).toBe(released)
    }
  )

  it('blocks singleton values and complements for every cohort size from 0 to 15', () => {
    for (let total = 0; total <= 15; total++) {
      for (const positive of new Set(
        [0, 1, Math.max(0, total - 1), total].filter((count) => count <= total)
      )) {
        const decision = decideAdaptivePrivacyPartition([
          positive,
          total - positive,
        ])
        const expected =
          total >= 5 &&
          [positive, total - positive].every(
            (count) => count === 0 || count >= 5
          )

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
    ).toEqual({
      value: null,
      suppression: {
        field: 'DISTRIBUTION',
        reason: 'SMALL_CELL_OR_COMPLEMENT',
      },
    })
  })

  it.each([
    { total: 5, known: 5, released: true },
    { total: 5, known: 4, released: false },
    { total: 10, known: 5, released: true },
    { total: 10, known: 9, released: false },
    { total: 15, known: 10, released: true },
  ])(
    'protects known/missing source populations ($known/$total)',
    ({ total, known, released }) => {
      const result = releaseAdaptiveKnownMissingMetric({
        field: 'DURATION_PERCENTILES',
        total,
        known,
        value: 42,
      })

      expect(result.value === 42).toBe(released)
      expect(result.suppression === null).toBe(released)
      if (!released && total >= 5) {
        expect(result.suppression?.reason).toBe(
          'SMALL_KNOWN_OR_MISSING_PARTITION'
        )
      }
    }
  )

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
