import { describe, expect, it } from 'vitest'
import { normalizeEnabledRootWeights } from '../src/weights.js'

describe('enabled root-weight normalization', () => {
  it('normalizes positive relative weights while preserving order', () => {
    const result = normalizeEnabledRootWeights([
      { key: 'reading', weight: 3 },
      { key: 'writing', weight: 2 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.normalized.map(({ key }) => key)).toEqual([
      'reading',
      'writing',
    ])
    expect(result.normalized[0]!.weight).toBeCloseTo(0.6, 12)
    expect(result.normalized[1]!.weight).toBeCloseTo(0.4, 12)
    expect(normalizeEnabledRootWeights([{ key: 1, weight: 7 }])).toEqual({
      ok: true,
      normalized: [{ key: 1, weight: 1 }],
    })
  })

  it('uses maximum-weight scaling for extreme finite values', () => {
    const result = normalizeEnabledRootWeights([
      { key: 1, weight: Number.MAX_VALUE },
      { key: 2, weight: Number.MAX_VALUE },
    ])

    expect(result).toEqual({
      ok: true,
      normalized: [
        { key: 1, weight: 0.5 },
        { key: 2, weight: 0.5 },
      ],
    })
  })

  it('rejects relative weights that underflow during normalization', () => {
    expect(
      normalizeEnabledRootWeights([
        { key: 'tiny', weight: Number.MIN_VALUE },
        { key: 'large', weight: Number.MAX_VALUE },
      ])
    ).toEqual({
      ok: false,
      reason: 'INVALID_ENABLED_ROOT_WEIGHT',
      invalidKeys: ['tiny'],
    })
  })

  it('rejects an empty enabled set', () => {
    expect(normalizeEnabledRootWeights([])).toEqual({
      ok: false,
      reason: 'NO_ENABLED_ROOTS',
      invalidKeys: [],
    })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects enabled weight %s',
    (weight) => {
      expect(
        normalizeEnabledRootWeights([
          { key: 'invalid', weight },
          { key: 'valid', weight: 1 },
        ])
      ).toEqual({
        ok: false,
        reason: 'INVALID_ENABLED_ROOT_WEIGHT',
        invalidKeys: ['invalid'],
      })
    }
  )
})
