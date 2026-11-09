import { GraphQLInt } from 'graphql'
import { describe, expect, it } from 'vitest'
import { temporaryLeaderboardEntryId } from '../src/lib/util.js'

// LeaderboardEntry.id is a non-null Int inside a non-null list, so a single
// unserializable id nulls the entire leaderboard for every viewer of the quiz,
// not just the temporary participant it belongs to.
describe('temporaryLeaderboardEntryId', () => {
  it('serializes as a GraphQL Int for an id whose hash exceeds the signed range', () => {
    const id = temporaryLeaderboardEntryId(
      '00000000-0000-4000-8000-000000000000'
    )

    expect(() => GraphQLInt.serialize(id)).not.toThrow()
  })

  it('serializes as a GraphQL Int across a broad range of participant ids', () => {
    const ids = Array.from({ length: 2000 }, (_, index) =>
      temporaryLeaderboardEntryId(`temporary-participant-${index}`)
    )

    for (const id of ids) {
      expect(() => GraphQLInt.serialize(id)).not.toThrow()
    }
  })

  it('returns the same id for the same participant across calls', () => {
    const first = temporaryLeaderboardEntryId('stable-participant')
    const second = temporaryLeaderboardEntryId('stable-participant')

    expect(second).toBe(first)
  })

  it('distinguishes different participants', () => {
    expect(temporaryLeaderboardEntryId('participant-a')).not.toBe(
      temporaryLeaderboardEntryId('participant-b')
    )
  })
})
