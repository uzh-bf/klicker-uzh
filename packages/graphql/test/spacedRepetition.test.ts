import {
  computeSpacedRepetitionStreak,
  isSpacedRepetitionPass,
  updateSpacedRepetition,
} from '../src/services/stacks.js'

function answer(
  state: { eFactor: number; interval: number; streak: number },
  grade: number
) {
  const result = updateSpacedRepetition({
    eFactor: state.eFactor,
    interval: state.interval,
    streak: computeSpacedRepetitionStreak({
      previousStreak: state.streak,
      grade,
    }),
    grade,
  })
  return {
    eFactor: result.efactor,
    interval: result.interval,
    streak: result.streak,
  }
}

describe('Spaced repetition (SM-2)', () => {
  it('passes grades with a scaled SM-2 quality of at least 3', () => {
    expect(isSpacedRepetitionPass(0)).toBe(false)
    expect(isSpacedRepetitionPass(0.59)).toBe(false)
    expect(isSpacedRepetitionPass(0.6)).toBe(true)
    expect(isSpacedRepetitionPass(1)).toBe(true)
  })

  it('increments the streak on a pass and resets it on a fail', () => {
    expect(computeSpacedRepetitionStreak({ previousStreak: 0, grade: 1 })).toBe(
      1
    )
    expect(
      computeSpacedRepetitionStreak({ previousStreak: 3, grade: 0.8 })
    ).toBe(4)
    expect(
      computeSpacedRepetitionStreak({ previousStreak: 3, grade: 0.5 })
    ).toBe(0)
  })

  it('rejects grades outside [0, 1]', () => {
    expect(() =>
      updateSpacedRepetition({ eFactor: 2.5, interval: 1, streak: 1, grade: 2 })
    ).toThrow()
  })

  it('uses the fixed initial intervals and then multiplies by the e-factor', () => {
    let state = { eFactor: 2.5, interval: 1, streak: 0 }

    state = answer(state, 1)
    expect(state.interval).toBe(2)
    state = answer(state, 1)
    expect(state.interval).toBe(6)
    state = answer(state, 1)
    expect(state.interval).toBe(Math.ceil(6 * state.eFactor))
  })

  it('resets the interval after a failed response', () => {
    const state = answer({ eFactor: 2.5, interval: 15, streak: 3 }, 0.5)

    expect(state.interval).toBe(1)
    expect(state.streak).toBe(0)
    expect(state.eFactor).toBeLessThan(2.5)
  })

  it('never derives a passing interval from a zero streak', () => {
    expect(
      updateSpacedRepetition({ eFactor: 2.5, interval: 1, streak: 0, grade: 1 })
        .interval
    ).toBe(2)
  })

  it('does not give a partial first answer a longer interval than a perfect one', () => {
    const initial = { eFactor: 2.5, interval: 1, streak: 0 }
    const perfect = answer(initial, 1)
    const partial = answer(initial, 0.6)

    expect(perfect.interval).toBe(2)
    expect(partial.interval).toBe(2)
    expect(partial.eFactor).toBeLessThan(perfect.eFactor)
  })

  it('does not collapse the interval after a partial pass', () => {
    let state = { eFactor: 2.6, interval: 15, streak: 3 }

    state = answer(state, 0.8)
    expect(state.streak).toBe(4)
    expect(state.interval).toBe(Math.ceil(15 * 2.6))

    const afterPartial = state.interval
    state = answer(state, 1)
    expect(state.interval).toBeGreaterThan(afterPartial)
  })
})
