import type { ElementData } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import { FsrsRating, updateFsrsState } from '../src/lib/fsrs.js'
import {
  computeFsrsResult,
  correctnessToFsrsRating,
  fsrsStateFromResponse,
  orderStacks,
} from '../src/lib/spacedRepetition.js'

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date('2026-11-20T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)

type Stacks = Parameters<typeof orderStacks>[0]

function fsrsResponse(lastAnsweredAt: Date) {
  const { state } = updateFsrsState({
    state: null,
    lastAnsweredAt: null,
    answeredAt: lastAnsweredAt,
    rating: FsrsRating.Good,
  })
  return {
    lastAnsweredAt,
    interval: 1,
    fsrsStability: state.stability,
    fsrsStabilityFast: state.stabilityFast,
    fsrsDifficulty: state.difficulty,
  }
}

function sm2Response(lastAnsweredAt: Date, interval: number) {
  return {
    lastAnsweredAt,
    interval,
    fsrsStability: null,
    fsrsStabilityFast: null,
    fsrsDifficulty: null,
  }
}

function element(
  elementType: string,
  responses: object[],
  hasSampleSolution = true
) {
  return {
    elementType,
    elementData: { type: elementType, options: { hasSampleSolution } },
    responses,
  }
}

function order(stacks: { id: string; elements: object[] }[]) {
  return orderStacks(stacks as unknown as Stacks, now).map((stack) => stack.id)
}

describe('orderStacks', () => {
  it('shows unanswered stacks first and stacks without recall information last', () => {
    expect(
      order([
        {
          id: 'content',
          elements: [element('CONTENT', [fsrsResponse(daysAgo(1))])],
        },
        {
          id: 'question',
          elements: [element('SC', [fsrsResponse(daysAgo(1))])],
        },
        { id: 'new', elements: [element('SC', [])] },
      ])
    ).toEqual(['new', 'question', 'content'])
  })

  it('orders answered stacks by their lowest predicted recall', () => {
    expect(
      order([
        {
          id: 'recent',
          elements: [element('FLASHCARD', [fsrsResponse(daysAgo(1))])],
        },
        {
          id: 'old',
          elements: [element('FLASHCARD', [fsrsResponse(daysAgo(20))])],
        },
        {
          id: 'mixed',
          elements: [
            element('SC', [fsrsResponse(daysAgo(1))]),
            element('MC', [fsrsResponse(daysAgo(10))]),
          ],
        },
      ])
    ).toEqual(['old', 'mixed', 'recent'])
  })

  it('ignores questions without a sample solution when ranking', () => {
    expect(
      order([
        {
          id: 'unsolved-only',
          elements: [element('FREE_TEXT', [fsrsResponse(daysAgo(30))], false)],
        },
        { id: 'graded', elements: [element('SC', [fsrsResponse(daysAgo(1))])] },
      ])
    ).toEqual(['graded', 'unsolved-only'])
  })

  it('estimates recall from the SM-2 interval for answers without FSRS state', () => {
    expect(
      order([
        {
          id: 'fsrs-recent',
          elements: [element('SC', [fsrsResponse(daysAgo(1))])],
        },
        {
          id: 'sm2-overdue',
          elements: [element('SC', [sm2Response(daysAgo(30), 2)])],
        },
      ])
    ).toEqual(['sm2-overdue', 'fsrs-recent'])
  })

  it('shows the least recently viewed content first', () => {
    expect(
      order([
        {
          id: 'viewed-today',
          elements: [element('CONTENT', [sm2Response(daysAgo(0), 1)])],
        },
        {
          id: 'viewed-long-ago',
          elements: [element('CONTENT', [sm2Response(daysAgo(9), 1)])],
        },
      ])
    ).toEqual(['viewed-long-ago', 'viewed-today'])
  })
})

function elementData(type: string, options: object = {}) {
  return { type, options } as unknown as ElementData
}

function firstStability(data: ElementData, correctness: number) {
  return computeFsrsResult({
    elementData: data,
    existingResponse: null,
    correctness,
    answeredAt: now,
  })?.fsrsStability
}

describe('FSRS answers', () => {
  it('maps correctness to ratings at the recall threshold', () => {
    expect(correctnessToFsrsRating(0)).toBe(FsrsRating.Again)
    expect(correctnessToFsrsRating(0.49)).toBe(FsrsRating.Again)
    expect(correctnessToFsrsRating(0.5)).toBe(FsrsRating.Hard)
    expect(correctnessToFsrsRating(0.99)).toBe(FsrsRating.Hard)
    expect(correctnessToFsrsRating(1)).toBe(FsrsRating.Good)
  })

  it('reads a state only when all three fields are stored', () => {
    expect(
      fsrsStateFromResponse({
        fsrsStability: 3,
        fsrsStabilityFast: 2,
        fsrsDifficulty: 5,
      })
    ).toEqual({ stability: 3, stabilityFast: 2, difficulty: 5 })
    expect(
      fsrsStateFromResponse({
        fsrsStability: 3,
        fsrsStabilityFast: null,
        fsrsDifficulty: 5,
      })
    ).toBeNull()
  })

  it('stores no FSRS state for elements without recall information', () => {
    expect(firstStability(elementData('CONTENT'), 1)).toBeUndefined()
    expect(
      firstStability(elementData('SC', { hasSampleSolution: false }), 1)
    ).toBeUndefined()
    expect(firstStability(elementData('FLASHCARD'), 1)).toBeDefined()
  })

  it('rates a selection answer after removing the chance of guessing', () => {
    const selection = elementData('SELECTION', {
      hasSampleSolution: true,
      answerCollectionSolutionIds: [1, 2, 3],
      answerCollection: {
        entries: Array.from({ length: 10 }, (_, id) => ({ id })),
      },
    })
    const choices = elementData('SC', { hasSampleSolution: true })

    const withoutEntries = elementData('SELECTION', { hasSampleSolution: true })

    // 3 of 10 entries are correct, so 0.3 is the chance level
    expect(firstStability(selection, 0.1)).toBe(firstStability(choices, 0))
    expect(firstStability(selection, 0.3)).toBe(firstStability(choices, 0))
    expect(firstStability(selection, 0.65)).toBe(firstStability(choices, 0.5))
    expect(firstStability(selection, 1)).toBe(firstStability(choices, 1))
    expect(firstStability(withoutEntries, 0.5)).toBe(
      firstStability(choices, 0.5)
    )
  })
})
