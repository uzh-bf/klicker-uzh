import { describe, expect, it } from 'vitest'
import {
  FSRS_DESIRED_RETENTION,
  FsrsRating,
  fsrsRetrievability,
  updateFsrsState,
} from '../src/lib/fsrs.js'

const DAY_MS = 24 * 60 * 60 * 1000
const answeredAt = new Date('2026-11-01T10:00:00Z')

function firstAnswer(rating: FsrsRating) {
  return updateFsrsState({
    state: null,
    lastAnsweredAt: null,
    answeredAt,
    rating,
  })
}

describe('FSRS', () => {
  it('schedules a better first answer further into the future', () => {
    const again = firstAnswer(FsrsRating.Again)
    const good = firstAnswer(FsrsRating.Good)

    expect(good.state.stability).toBeGreaterThan(again.state.stability)
    expect(good.nextDueAt.getTime()).toBeGreaterThan(again.nextDueAt.getTime())
    expect(again.nextDueAt.getTime()).toBeGreaterThan(answeredAt.getTime())
  })

  it('predicts the desired retention at the due date and less recall later', () => {
    const { state, nextDueAt } = firstAnswer(FsrsRating.Good)
    const recallAt = (now: Date) =>
      fsrsRetrievability({ state, lastAnsweredAt: answeredAt, now })

    expect(recallAt(answeredAt)).toBeGreaterThan(0.99)
    expect(recallAt(nextDueAt)).toBeCloseTo(FSRS_DESIRED_RETENTION, 2)
    expect(recallAt(new Date(nextDueAt.getTime() + 30 * DAY_MS))).toBeLessThan(
      FSRS_DESIRED_RETENTION
    )
  })

  it('lowers stability after a failed repeat and raises it after a passed one', () => {
    const { state } = firstAnswer(FsrsRating.Good)
    const repeat = (rating: FsrsRating) =>
      updateFsrsState({
        state,
        lastAnsweredAt: answeredAt,
        answeredAt: new Date(answeredAt.getTime() + 5 * DAY_MS),
        rating,
      }).state

    expect(repeat(FsrsRating.Again).stability).toBeLessThan(state.stability)
    expect(repeat(FsrsRating.Good).stability).toBeGreaterThan(state.stability)
  })
})
