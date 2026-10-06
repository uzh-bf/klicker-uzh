import { describe, expect, it } from 'vitest'
import {
  type AdaptiveReplayDecide,
  replayAdaptiveAttempt,
} from '../src/services/adaptivePracticeQuizAttemptReplay.js'
import type { AdaptiveRuntimeRoutingPoolItem } from '../src/services/adaptivePracticeQuizRuntime.js'

// Synthetic scale: 6 levels, one per theta unit from -3 to 3.
const levels = [1, 2, 3, 4, 5, 6].map((id) => ({ id, label: `L${id}` }))
const levelAt = (theta: number) =>
  levels[Math.min(5, Math.max(0, Math.floor(theta + 3)))]

function item(
  id: number,
  leafNodeId: number,
  levelId: number
): AdaptiveRuntimeRoutingPoolItem {
  return {
    id,
    leafNodeId,
    nodePath: [1, leafNodeId],
    levelId,
    discrimination: 1.2,
    difficulty: levelId - 3.5,
    guessing: 0,
  } as unknown as AdaptiveRuntimeRoutingPoolItem
}

const responses = [
  item(10, 11, 4),
  item(11, 11, 5),
  item(12, 12, 3),
  item(13, 11, 4),
].map((poolItem, index) => ({
  order: index + 1,
  poolItemId: poolItem.id,
  correct: index !== 1,
  poolItem,
}))

// Fake engine: the root estimate after k answers is k / 2 - 0.5 (null
// before any answer); it serves the actual next item unless told otherwise.
function engine(deviateAt?: number): {
  decide: AdaptiveReplayDecide
  calls: number[]
} {
  const calls: number[] = []
  return {
    calls,
    decide: async (prefix) => {
      calls.push(prefix.length)
      const k = prefix.length
      return {
        nextPoolItemId:
          k === deviateAt ? 999 : (responses[k]?.poolItemId ?? null),
        nodes: new Map([
          [
            1,
            k === 0
              ? { theta: null, standardError: null }
              : { theta: k / 2 - 0.5, standardError: 0.5 },
          ],
        ]),
      }
    },
  }
}

const replay = (decide: AdaptiveReplayDecide) =>
  replayAdaptiveAttempt({
    responses,
    minQuestionsPerLeaf: 2,
    classificationZ: 1.96,
    levelAt,
    levelIndexOf: (levelId) => levelId - 1,
    decide,
  })

describe('adaptive attempt replay', () => {
  it('replays every prefix once, in order', async () => {
    const fake = engine()
    const result = await replay(fake.decide)
    expect(fake.calls).toEqual([0, 1, 2, 3, 4])
    expect(result.exact).toBe(true)
  })

  it('reports the engine estimates before and after each answer', async () => {
    const result = await replay(engine().decide)
    expect(result.answers[0]).toMatchObject({
      competenceThetaBefore: null,
      competenceLevelBefore: null,
      competenceThetaAfter: 0,
      competenceLevelAfter: 'L4',
      levelDistanceBefore: null,
    })
    // Before answer 3 the estimate is 0.5 (L4); the item is L3.
    expect(result.answers[2]).toMatchObject({
      competenceThetaBefore: 0.5,
      competenceLevelBefore: 'L4',
      levelDistanceBefore: -1,
    })
  })

  it('derives the phase from earlier answers in the same leaf', async () => {
    const result = await replay(engine().decide)
    expect(result.answers.map(({ phase }) => phase)).toEqual([
      'COVERAGE',
      'COVERAGE',
      'COVERAGE',
      'PRECISION',
    ])
  })

  it('marks answers the current engine would not have served', async () => {
    const result = await replay(engine(2).decide)
    expect(result.exact).toBe(false)
    expect(result.answers.map(({ replayMatches }) => replayMatches)).toEqual([
      true,
      true,
      false,
      true,
    ])
  })
})
