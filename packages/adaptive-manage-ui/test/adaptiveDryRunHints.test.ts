import { describe, expect, it } from 'vitest'
import {
  dryRunMastery,
  summarizeDryRunMastery,
} from '../src/components/evaluation/adaptive/dryRuns/adaptiveDryRunHints'

// Four levels on -3..3, NEAREST: points -3, -1, 1, 3; bands at midpoints, so
// L1 spans -2 .. 0 and its mastery point (70%) is -0.6.
const workspace = {
  levels: ['L0', 'L1', 'L2', 'L3'].map((label, order) => ({
    id: order + 1,
    label,
    order,
    __typename: 'AdaptiveDryRunLevel' as const,
  })),
  scale: { thetaMin: -3, thetaMax: 3, levelMappingRule: 'NEAREST' },
}
const settings = { masteryPoint: 0.7, probability: 0.7 }

describe('mastery probability', () => {
  it('needs a precise estimate beyond the mastery point', () => {
    // 0.4 above the mastery point with SE 0.2: z = 2, about 98%
    expect(
      dryRunMastery(
        { theta: -0.2, standardError: 0.2, levelId: 2 },
        workspace,
        settings
      )
    ).toMatchObject({
      position: expect.closeTo(0.9),
      probability: expect.closeTo(0.977, 2),
      mastered: true,
      highestMasteredLevelId: 2,
    })
    // the same estimate with SE 1: z = 0.4, about 66% - not shown as mastered
    expect(
      dryRunMastery(
        { theta: -0.2, standardError: 1, levelId: 2 },
        workspace,
        settings
      )
    ).toMatchObject({
      probability: expect.closeTo(0.655, 2),
      mastered: false,
      highestMasteredLevelId: 1,
    })
  })

  it('measures the client reading of a run', () => {
    const student = (
      trueLevelId: number,
      theta: number,
      standardError: number,
      levelId: number
    ) => ({
      trueLevels: [{ nodeId: 1, levelId: trueLevelId }],
      competences: [
        { nodeId: 1, theta, levelId, standardError, classified: false },
      ],
    })
    const summary = summarizeDryRunMastery(
      [
        // true L1, high in L1 and precise: "L1 mastered" - right
        student(2, -0.2, 0.2, 2),
        // true L1, reported L2 low in its band: "L1 mastered, L2 not" - right
        student(2, 0.3, 0.3, 3),
        // true L0, reported L1 precise and high: "L1 mastered" - wrong
        student(1, -0.1, 0.1, 2),
      ],
      workspace,
      settings
    )
    expect(summary).toMatchObject({
      count: 3,
      masteredShare: 2 / 3,
      masteredRightShare: 1 / 2,
      highestExactShare: 2 / 3,
      highestWithinOneShare: 1,
    })
  })
})
