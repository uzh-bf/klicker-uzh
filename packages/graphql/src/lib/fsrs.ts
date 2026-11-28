import {
  FSRS7_DEFAULT_WEIGHTS,
  FSRS7_MODEL_BOUNDS,
  FSRS7Algorithm,
} from 'ts-fsrs/models/fsrs-7'

// Spaced repetition with FSRS-7
export const FSRS_WEIGHTS: readonly number[] = FSRS7_DEFAULT_WEIGHTS
export const FSRS_DESIRED_RETENTION = 0.9

const DAY_MS = 24 * 60 * 60 * 1000

const algorithm = new FSRS7Algorithm([...FSRS_WEIGHTS], FSRS7_MODEL_BOUNDS)

export enum FsrsRating {
  Again = 1,
  Hard = 2,
  Good = 3,
}

export interface FsrsState {
  stability: number
  stabilityFast: number
  difficulty: number
}

export function elapsedDays(from: Date, to: Date): number {
  return Math.max((to.getTime() - from.getTime()) / DAY_MS, 0)
}

export function updateFsrsState({
  state,
  lastAnsweredAt,
  answeredAt,
  rating,
}: {
  state: FsrsState | null
  lastAnsweredAt: Date | null
  answeredAt: Date
  rating: FsrsRating
}): { state: FsrsState; nextDueAt: Date } {
  const elapsed =
    state && lastAnsweredAt ? elapsedDays(lastAnsweredAt, answeredAt) : 0
  const next = algorithm.next_state(state, elapsed, rating)
  const interval = algorithm.next_interval(next, FSRS_DESIRED_RETENTION)

  return {
    state: {
      stability: next.stability,
      stabilityFast: next.stabilityFast,
      difficulty: next.difficulty,
    },
    nextDueAt: new Date(answeredAt.getTime() + interval * DAY_MS),
  }
}

// probability that the element is recalled at `now`
export function fsrsRetrievability({
  state,
  lastAnsweredAt,
  now,
}: {
  state: FsrsState
  lastAnsweredAt: Date
  now: Date
}): number {
  return algorithm.curve(elapsedDays(lastAnsweredAt, now), state).retrievability
}
