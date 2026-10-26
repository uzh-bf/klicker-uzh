import { describe, expect, it } from 'vitest'
import {
  dryRunHint,
  summarizeDryRunHints,
} from '../src/components/evaluation/adaptive/dryRuns/adaptiveDryRunHints'

// Four levels on -3..3, NEAREST: points -3, -1, 1, 3; bands at midpoints.
const workspace = {
  levels: ['L0', 'L1', 'L2', 'L3'].map((label, order) => ({
    id: order + 1,
    label,
    order,
    __typename: 'AdaptiveDryRunLevel' as const,
  })),
  scale: { thetaMin: -3, thetaMax: 3, levelMappingRule: 'NEAREST' },
}

describe('next level within reach', () => {
  it('places the estimate in its band and hints from the threshold on', () => {
    // L1 band: -2 .. 0
    expect(dryRunHint({ theta: -0.4, levelId: 2 }, workspace, 0.7)).toEqual({
      position: expect.closeTo(0.8),
      nextLevelId: 3,
    })
    expect(dryRunHint({ theta: -1.2, levelId: 2 }, workspace, 0.7)).toEqual({
      position: expect.closeTo(0.4),
      nextLevelId: null,
    })
    // the open lowest band uses a regular band width: -4 .. -2
    expect(
      dryRunHint({ theta: -2.5, levelId: 1 }, workspace, 0.7).position
    ).toBeCloseTo(0.75)
    // no next level above the top level
    expect(dryRunHint({ theta: 2.9, levelId: 4 }, workspace, 0.7)).toEqual({
      position: null,
      nextLevelId: null,
    })
  })

  it('measures both readings of a result', () => {
    const student = (trueLevelId: number, theta: number, levelId: number) => ({
      trueLevels: [{ nodeId: 1, levelId: trueLevelId }],
      competences: [
        { nodeId: 1, theta, levelId, standardError: null, classified: false },
      ],
    })
    const summary = summarizeDryRunHints(
      [
        // true L1, reported L1 at the upper edge: hint L2 (= true + 1)
        student(2, -0.1, 2),
        // true L1, reported L1 low in the band: no hint
        student(2, -1.5, 2),
        // true L2, reported L1 with hint: the hint names the true level
        student(3, -0.2, 2),
      ],
      workspace,
      0.7
    )
    expect(summary).toMatchObject({
      count: 3,
      hintShare: 2 / 3,
      reachedShare: 2 / 3,
      nextLevelShare: 1 / 3,
      coveredShare: 1,
    })
  })
})
