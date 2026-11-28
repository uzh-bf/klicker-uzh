import type {
  ElementInstance,
  ElementStack,
  QuestionResponse,
} from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData, ElementOptionsSelection } from '@klicker-uzh/types'
import { sort } from 'remeda'
import {
  elapsedDays,
  FsrsRating,
  type FsrsState,
  fsrsRetrievability,
  updateFsrsState,
} from './fsrs.js'

// a guess-corrected correctness below this counts as forgotten
export const RECALL_THRESHOLD = 0.5
// recall probability SM-2 is assumed to target at its due date
const SM2_ASSUMED_RETENTION = 0.9

type FsrsFields = Pick<
  QuestionResponse,
  'fsrsStability' | 'fsrsStabilityFast' | 'fsrsDifficulty'
>

export type FsrsResult = {
  fsrsStability: number
  fsrsStabilityFast: number
  fsrsDifficulty: number
  nextDueAt: Date
}

// check if an element has any recall information (graded answers or sample
// solution)
export function hasRecallInformation(elementData: ElementData): boolean {
  if (elementData.type === DB.ElementType.FLASHCARD) return true
  if (elementData.type === DB.ElementType.CONTENT) return false
  return !!elementData.options.hasSampleSolution
}

// adjust correctness for the chance of guessing a correct answer in a
// selection: a random entry is correct with probability solutions / entries
function guessCorrectedSelectionCorrectness(
  options: ElementOptionsSelection,
  correctness: number
): number {
  const solutions = options.answerCollectionSolutionIds?.length ?? 0
  const entries = options.answerCollection?.entries.length ?? 0
  const chance = entries > 0 ? solutions / entries : 0
  if (chance <= 0 || chance >= 1) return correctness
  return Math.max((correctness - chance) / (1 - chance), 0)
}

// map correctness to FSRS rating: < RECALL_THRESHOLD = Again, < 1 = Hard,
// 1 = Good
export function correctnessToFsrsRating(correctness: number): FsrsRating {
  if (correctness < RECALL_THRESHOLD) return FsrsRating.Again
  if (correctness < 1) return FsrsRating.Hard
  return FsrsRating.Good
}

// convert FSRS fields of a response to an FSRS state
export function fsrsStateFromResponse(response: FsrsFields): FsrsState | null {
  if (
    response.fsrsStability === null ||
    response.fsrsStabilityFast === null ||
    response.fsrsDifficulty === null
  ) {
    return null
  }
  return {
    stability: response.fsrsStability,
    stabilityFast: response.fsrsStabilityFast,
    difficulty: response.fsrsDifficulty,
  }
}

// compute the new FSRS state and next due date for an element after a graded
// answer
export function computeFsrsResult({
  elementData,
  existingResponse,
  correctness,
  answeredAt = new Date(),
}: {
  elementData: ElementData
  existingResponse:
    | (FsrsFields & Pick<QuestionResponse, 'lastAnsweredAt'>)
    | null
  correctness: number
  answeredAt?: Date
}): FsrsResult | null {
  if (!hasRecallInformation(elementData)) return null

  const recallCorrectness =
    elementData.type === DB.ElementType.SELECTION
      ? guessCorrectedSelectionCorrectness(elementData.options, correctness)
      : correctness

  const { state, nextDueAt } = updateFsrsState({
    state: existingResponse ? fsrsStateFromResponse(existingResponse) : null,
    lastAnsweredAt: existingResponse?.lastAnsweredAt ?? null,
    answeredAt,
    rating: correctnessToFsrsRating(recallCorrectness),
  })

  return {
    fsrsStability: state.stability,
    fsrsStabilityFast: state.stabilityFast,
    fsrsDifficulty: state.difficulty,
    nextDueAt,
  }
}

type StackWithResponses = ElementStack & {
  elements: (ElementInstance & { responses?: QuestionResponse[] })[]
}

// compute the predicted recall probability of an element at a given time
function recallNow(
  element: ElementInstance,
  response: QuestionResponse,
  now: Date
): number | null {
  if (!hasRecallInformation(element.elementData) || !response.lastAnsweredAt) {
    return null
  }

  const state = fsrsStateFromResponse(response)
  if (state) {
    return fsrsRetrievability({
      state,
      lastAnsweredAt: response.lastAnsweredAt,
      now,
    })
  }

  // fall back to SM-2 assumption if FSRS state not available
  const days = elapsedDays(response.lastAnsweredAt, now)
  return SM2_ASSUMED_RETENTION ** (days / Math.max(response.interval, 1))
}

type StackPriority =
  | { tier: 'unanswered' }
  | { tier: 'scheduled'; recall: number }
  | { tier: 'viewed'; lastAnsweredAt: number }

// map a stack to its spaced-repetition priority
function stackPriority(stack: StackWithResponses, now: Date): StackPriority {
  const answered = stack.elements.flatMap((element) =>
    (element.responses ?? []).map((response) => ({ element, response }))
  )
  if (answered.length === 0) return { tier: 'unanswered' }

  const recalls = answered
    .map(({ element, response }) => recallNow(element, response, now))
    .filter((recall) => recall !== null)
  if (recalls.length > 0) {
    return { tier: 'scheduled', recall: Math.min(...recalls) }
  }

  return {
    tier: 'viewed',
    lastAnsweredAt: Math.max(
      ...answered.map(({ response }) => response.lastAnsweredAt?.getTime() ?? 0)
    ),
  }
}

const TIER_ORDER: Record<StackPriority['tier'], number> = {
  unanswered: 0,
  scheduled: 1,
  viewed: 2,
}

// order stacks by spaced-repetition priority: 1. unanswered, 2. scheduled
// (lowest recall first), 3. viewed (oldest last answered first)
export function orderStacks<T extends StackWithResponses>(
  stacks: T[],
  now: Date = new Date()
): T[] {
  const prioritized = stacks.map((stack) => ({
    stack,
    priority: stackPriority(stack, now),
  }))

  return sort(prioritized, (a, b) => {
    const tierDifference =
      TIER_ORDER[a.priority.tier] - TIER_ORDER[b.priority.tier]
    if (tierDifference !== 0) return tierDifference
    if (a.priority.tier === 'scheduled' && b.priority.tier === 'scheduled') {
      return a.priority.recall - b.priority.recall
    }
    if (a.priority.tier === 'viewed' && b.priority.tier === 'viewed') {
      return a.priority.lastAnsweredAt - b.priority.lastAnsweredAt
    }
    return 0
  }).map(({ stack }) => stack)
}
