import { describe, expect, it } from 'vitest'
import {
  dryRunMainLevels,
  dryRunMainMastery,
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

describe('main-level mastery', () => {
  // Six levels: A2.1-A2.3, B1.1-B1.3 on -3..3 (spacing 1.2); B1 spans 0 ..
  // 3.6 (the open top band closed with a regular width), cut at 70%: 2.52.
  const cefr = {
    levels: ['A2.1', 'A2.2', 'A2.3', 'B1.1', 'B1.2', 'B1.3'].map(
      (label, order) => ({
        id: order + 1,
        label,
        order,
        __typename: 'AdaptiveDryRunLevel' as const,
      })
    ),
    scale: { thetaMin: -3, thetaMax: 3, levelMappingRule: 'NEAREST' },
  }

  it('groups sublevels and judges the whole main level', () => {
    expect(dryRunMainLevels(cefr.levels)).toEqual([
      { label: 'A2', fromOrder: 0, toOrder: 2 },
      { label: 'B1', fromOrder: 3, toOrder: 5 },
    ])
    expect(
      dryRunMainMastery(
        { theta: 3, standardError: 0.2, levelId: 6 },
        cefr,
        settings
      )
    ).toMatchObject({ label: 'B1', mastered: true, highestMastered: 'B1' })
    expect(
      dryRunMainMastery(
        { theta: 1.8, standardError: 0.2, levelId: 5 },
        cefr,
        settings
      )
    ).toMatchObject({ label: 'B1', mastered: false, highestMastered: 'A2' })
  })

  it('counts a main level as truly mastered from its last sublevel', () => {
    const student = (trueLevelId: number, theta: number, levelId: number) => ({
      trueLevels: [{ nodeId: 1, levelId: trueLevelId }],
      competences: [
        { nodeId: 1, theta, levelId, standardError: 0.2, classified: false },
      ],
    })
    const summary = summarizeDryRunMastery(
      [
        // true B1.3, "B1 mastered": right
        student(6, 3, 6),
        // true B1.2, "B1 not mastered, A2 mastered": right
        student(5, 1.8, 5),
      ],
      cefr,
      settings
    )
    expect(summary.main).toEqual({
      masteredShare: 1 / 2,
      masteredRightShare: 1,
      highestExactShare: 1,
    })
  })
})
