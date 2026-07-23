import { describe, expect, it } from 'vitest'
import { computeRanks } from '../src/lib/util.js'

describe('computeRanks', () => {
  it('assigns sequential ranks when all scores differ', () => {
    const ranked = computeRanks([
      { username: 'a', score: 300 },
      { username: 'b', score: 200 },
      { username: 'c', score: 100 },
    ])

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3])
  })

  it('gives tied entries the same rank and skips the ranks they consume', () => {
    const ranked = computeRanks([
      { username: 'a', score: 500 },
      { username: 'b', score: 400 },
      { username: 'c', score: 400 },
      { username: 'd', score: 100 },
    ])

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 2, 4])
  })

  it('handles a tie at the top and a tie at the bottom', () => {
    const ranked = computeRanks([
      { username: 'a', score: 500 },
      { username: 'b', score: 500 },
      { username: 'c', score: 200 },
      { username: 'd', score: 200 },
    ])

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3, 3])
  })

  it('gives every entry rank 1 when all scores are equal', () => {
    const ranked = computeRanks([
      { username: 'a', score: 0 },
      { username: 'b', score: 0 },
      { username: 'c', score: 0 },
    ])

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 1])
  })

  it('preserves the incoming order and the other entry fields', () => {
    const ranked = computeRanks([
      { username: 'alice', score: 400, avatar: 'cat' },
      { username: 'bob', score: 400, avatar: 'dog' },
    ])

    expect(ranked).toEqual([
      { username: 'alice', score: 400, avatar: 'cat', rank: 1 },
      { username: 'bob', score: 400, avatar: 'dog', rank: 1 },
    ])
  })

  it('returns an empty array for an empty leaderboard', () => {
    expect(computeRanks([])).toEqual([])
  })
})
