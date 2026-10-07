import { describe, expect, it } from 'vitest'
import { backfillAdaptivePracticeQuizAttemptEstimates } from '../src/services/adaptivePracticeQuizAttemptBackfill.js'
import {
  type AdaptiveReplayDecide,
  replayAdaptiveAttempt,
} from '../src/services/adaptivePracticeQuizAttemptReplay.js'
import type { AdaptiveRuntimeRoutingPoolItem } from '../src/services/adaptivePracticeQuizRuntime.js'

function item(id: number, leafNodeId: number): AdaptiveRuntimeRoutingPoolItem {
  return {
    id,
    leafNodeId,
    nodePath: [1, leafNodeId],
    levelId: 1,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0,
  } as unknown as AdaptiveRuntimeRoutingPoolItem
}

const responses = [item(10, 11), item(11, 11), item(12, 12)].map(
  (poolItem, index) => ({
    order: index + 1,
    poolItemId: poolItem.id,
    correct: index !== 1,
    poolItem,
  })
)

// Fake engine: the root estimate after k answers is k / 2 (none before any
// answer); it serves the actual next item unless told otherwise.
function engine(deviateAt?: number) {
  const calls: number[] = []
  const decide: AdaptiveReplayDecide = async (prefix) => {
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
            : { theta: k / 2, standardError: 1 / k },
        ],
      ]),
    }
  }
  return { calls, decide }
}

describe('adaptive attempt replay', () => {
  it('replays every prefix once, in order', async () => {
    const fake = engine()
    const result = await replayAdaptiveAttempt({
      responses,
      decide: fake.decide,
    })
    expect(fake.calls).toEqual([0, 1, 2, 3])
    expect(result.exact).toBe(true)
  })

  it('returns the competence estimate before and after each answer', async () => {
    const result = await replayAdaptiveAttempt({
      responses,
      decide: engine().decide,
    })
    expect(
      result.answers.map(({ competenceBefore }) => competenceBefore)
    ).toEqual([
      { theta: null, standardError: null },
      { theta: 0.5, standardError: 1 },
      { theta: 1, standardError: 0.5 },
    ])
    expect(result.answers[2]?.competenceAfter).toEqual({
      theta: 1.5,
      standardError: 1 / 3,
    })
  })

  it('marks answers the current engine would not have served', async () => {
    const result = await replayAdaptiveAttempt({
      responses,
      decide: engine(1).decide,
    })
    expect(result.exact).toBe(false)
    expect(result.answers.map(({ replayMatches }) => replayMatches)).toEqual([
      true,
      false,
      true,
    ])
  })

  it('refuses the backfill outside testing environments', async () => {
    await expect(
      backfillAdaptivePracticeQuizAttemptEstimates(
        { practiceQuizId: 'quiz' },
        {} as never,
        ''
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_DIAGNOSTICS_DISABLED' },
    })
  })
})
