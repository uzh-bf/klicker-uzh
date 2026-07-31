import { describe, expect, it } from 'vitest'
import {
  deterministicBootstrapAbsoluteMeanLower,
  deterministicBootstrapDifferenceLower,
  deterministicBootstrapUpper,
  mean,
  rootMeanSquare,
  wilsonInterval,
} from '../scripts/simulationV2Statistics.js'

describe('IRT v2 release statistics', () => {
  it('matches reviewed Wilson interval reference values', () => {
    expect(wilsonInterval(0, 100, 1.959963984540054)).toEqual({
      lower: 0,
      upper: expect.closeTo(0.03699349820698568, 12),
    })
    expect(wilsonInterval(50, 100, 1.959963984540054)).toEqual({
      lower: expect.closeTo(0.4038315303659956, 12),
      upper: expect.closeTo(0.5961684696340044, 12),
    })
    expect(wilsonInterval(100, 100, 1.959963984540054)).toEqual({
      lower: expect.closeTo(0.9630065017930143, 12),
      upper: 1,
    })
  })

  it('powers zero-event theta-cell safety bounds below one percent', () => {
    const z = 1.959963984540054

    expect(wilsonInterval(0, 200, z).upper).toBeGreaterThan(0.01)
    expect(wilsonInterval(0, 400, z).upper).toBeLessThan(0.01)
  })

  it('keeps deterministic bootstrap bounds reproducible', () => {
    const input = {
      values: [-0.4, -0.2, 0, 0.1, 0.5],
      seed: 123_456,
      replicates: 1_000,
      statistic: (sample: number[]) => Math.abs(mean(sample)),
    }

    const first = deterministicBootstrapUpper(input)
    expect(first).toBe(deterministicBootstrapUpper(input))
    expect(first).toBeGreaterThanOrEqual(Math.abs(mean(input.values)))
  })

  it('computes the lower 95% bootstrap bound of an absolute mean difference', () => {
    expect(
      deterministicBootstrapDifferenceLower({
        left: [1, 1, 1],
        right: [4, 4],
        seed: 7,
        replicates: 250,
      })
    ).toBe(3)
  })

  it('keeps difference bootstrap bounds reproducible for the same seed', () => {
    const input = {
      left: [-0.4, 0.1, 0.3, 0.8],
      right: [0.2, 0.6, 1.1],
      seed: 867_530,
      replicates: 1_000,
    }

    const first = deterministicBootstrapDifferenceLower(input)
    expect(first).toBe(deterministicBootstrapDifferenceLower(input))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(
      Math.abs(mean(input.left) - mean(input.right))
    )
  })

  it('bootstraps paired learner contrasts as independent clusters', () => {
    const input = {
      values: [-0.4, -0.5, -0.3, -0.6],
      seed: 98_765,
      replicates: 1_000,
    }
    const first = deterministicBootstrapAbsoluteMeanLower(input)

    expect(first).toBe(deterministicBootstrapAbsoluteMeanLower(input))
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThanOrEqual(Math.abs(mean(input.values)))
  })

  it.each([
    { values: [], seed: 1, replicates: 10 },
    { values: [Number.NaN], seed: 1, replicates: 10 },
    { values: [1], seed: 1.5, replicates: 10 },
    { values: [1], seed: 1, replicates: 0 },
  ])('rejects invalid absolute-mean bootstrap input %#', (input) => {
    expect(() => deterministicBootstrapAbsoluteMeanLower(input)).toThrowError(
      new TypeError('Deterministic absolute-mean bootstrap inputs are invalid.')
    )
  })

  it.each([
    { left: [], right: [1], seed: 1, replicates: 10 },
    { left: [1], right: [], seed: 1, replicates: 10 },
    { left: [Number.NaN], right: [1], seed: 1, replicates: 10 },
    { left: [1], right: [Number.POSITIVE_INFINITY], seed: 1, replicates: 10 },
    { left: [1], right: [2], seed: 1.5, replicates: 10 },
    { left: [1], right: [2], seed: 1, replicates: 0 },
    { left: [1], right: [2], seed: 1, replicates: 1.5 },
  ])('rejects invalid difference bootstrap input %#', (input) => {
    expect(() => deterministicBootstrapDifferenceLower(input)).toThrowError(
      new TypeError('Deterministic difference bootstrap inputs are invalid.')
    )
  })

  it('computes root mean square without bias cancellation', () => {
    expect(mean([-1, 1])).toBe(0)
    expect(rootMeanSquare([-1, 1])).toBe(1)
  })
})
