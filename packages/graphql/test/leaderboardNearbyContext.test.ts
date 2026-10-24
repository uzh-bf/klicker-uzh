import { describe, expect, it } from 'vitest'
import { selectLeaderboardNearbyContext } from '@/services/courses.js'

function entries(count: number) {
  return Array.from({ length: count }, (_, ix) => ({
    participantId: `p${ix + 1}`,
    score: (count - ix) * 10,
  }))
}

describe('selectLeaderboardNearbyContext', () => {
  it('returns the top 10 when self is inside the top 10', () => {
    const result = selectLeaderboardNearbyContext(entries(20), 'p5')
    expect(result).toHaveLength(10)
    expect(result[0]!.participantId).toBe('p1')
  })

  it('adds up to three rows before and after self outside the top 10', () => {
    const result = selectLeaderboardNearbyContext(entries(20), 'p15')
    expect(result.map((entry) => entry.participantId)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
      'p9',
      'p10',
      'p12',
      'p13',
      'p14',
      'p15',
      'p16',
      'p17',
      'p18',
    ])
  })

  it('clamps the nearby window at the end of the leaderboard', () => {
    const result = selectLeaderboardNearbyContext(entries(14), 'p14')
    expect(result.map((entry) => entry.participantId)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
      'p9',
      'p10',
      'p11',
      'p12',
      'p13',
      'p14',
    ])
  })

  it('returns the top 10 when self is not part of the leaderboard', () => {
    const result = selectLeaderboardNearbyContext(entries(12), undefined)
    expect(result).toHaveLength(10)
  })

  it('returns fewer entries than the window on small leaderboards', () => {
    const result = selectLeaderboardNearbyContext(entries(7), 'p4')
    expect(result).toHaveLength(7)
  })
})
