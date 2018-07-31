import _round from 'lodash/round'
import { calculateMax, calculateMin, calculateMean, calculateMedian } from './math'

describe('math', () => {
  const results = {
    data: [
      { count: 4, value: -3 },
      { count: 5, value: 3 },
      { count: '2', value: '4' },
      { count: 1, value: 7 },
      { count: '2', value: '10' },
    ],
    totalResponses: 14,
  }

  it('calculates max and min correctly', () => {
    expect(calculateMax(results)).toEqual(10)
    expect(calculateMin(results)).toEqual(-3)
  })

  it('calculates mean correctly', () => {
    expect(_round(calculateMean(results), 3)).toEqual(2.714)
  })

  it('calculates median correctly', () => {
    expect(calculateMedian(results)).toEqual(3)
  })

  it.skip('calculates q1 correctly', () => {
    // TODO
  })

  it.skip('calcilates q3 correctly', () => {
    // TODO
  })

  it.skip('calculates std correctly', () => {
    // TODO
  })
})
