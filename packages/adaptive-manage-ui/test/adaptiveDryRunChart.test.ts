import { normalCdf } from '@klicker-uzh/adaptive-contract'
import { describe, expect, it } from 'vitest'
import {
  dryRunAgreement,
  dryRunChartPoints,
  dryRunChartScale,
  dryRunConfusion,
  dryRunLevelSplit,
  dryRunMastery,
  dryRunOverallConfusion,
  dryRunOverallPoints,
  dryRunTrueTheta,
  dryRunUnexpectedAnswers,
  dryRunWithinOneChance,
} from '../src/components/evaluation/adaptive/dryRuns/adaptiveDryRunChart'
import { dryRunWorkspaceOf } from '../src/components/evaluation/adaptive/dryRuns/adaptiveDryRunTypes'

// Four levels on -3..3, NEAREST: questions at -3, -1, 1, 3.
const workspace = {
  levels: ['L0', 'L1', 'L2', 'L3'].map((label, order) => ({
    id: order + 1,
    label,
    order,
    __typename: 'AdaptiveDryRunLevel' as const,
  })),
  scale: { thetaMin: -3, thetaMax: 3, levelMappingRule: 'NEAREST' },
}
const run = (levelReachedFrom: number) =>
  ({
    effectiveSettings: {
      totalQuestionCap: 20,
      minQuestionsPerLeaf: 2,
      classificationZ: 1.28,
      classificationToleranceBands: 0,
      levelReachedFrom,
    },
  }) as const

describe('dry-run chart scale', () => {
  it('uses the reported bands for the true levels too', () => {
    const scale = dryRunChartScale(workspace, run(0.7))!
    // spacing 2: the open outer bands are closed with one spacing
    expect(scale.min).toBeCloseTo(-3)
    expect(scale.max).toBeCloseTo(4.7)
    const l1 = scale.levels[1]!
    // L1 from 70% of the nearest band -2..0, for true and reported levels
    expect(l1.lower).toBeCloseTo(-0.6)
    expect(l1.upper).toBeCloseTo(1.4)
    expect(l1.trueLower).toBeCloseTo(-0.6)
    expect(l1.trueUpper).toBeCloseTo(1.4)
    // the open first band is closed with one spacing for true abilities
    expect(scale.levels[0]!.trueLower).toBeCloseTo(-2.6)
    // every level as wide as the others
    expect(scale.levels[0]!.lower).toBeCloseTo(-2.6)
  })

  it('uses the simulated ability of realistic students', () => {
    const scale = dryRunChartScale(workspace, run(0))!
    expect(dryRunTrueTheta(scale, { levelId: 2, theta: 0.3 })).toBe(0.3)
    expect(dryRunTrueTheta(scale, { levelId: 2 })).toBe(-1)
  })

  it('compares every competence with its true level', () => {
    const scale = dryRunChartScale(workspace, run(0))!
    const student = {
      index: 1,
      trueLevels: [{ nodeId: 7, levelId: 2, theta: 0.2 }],
      stopReason: 'TOTAL_QUESTION_CAP',
      questionCount: 3,
      answers: [
        // L0 wrong and L3 right are unexpected for a true L1 student
        { poolItemId: 1, levelId: 1, correct: false, flipped: false },
        { poolItemId: 2, levelId: 2, correct: true, flipped: false },
        { poolItemId: 3, levelId: 4, correct: true, flipped: false },
      ],
      overall: { theta: 1.2, standardError: 0.4, levelId: 3 },
      competences: [
        {
          nodeId: 7,
          theta: 1.2,
          standardError: 0.4,
          levelId: 3,
          classified: false,
        },
      ],
    }
    expect(dryRunChartPoints([student], workspace.levels, scale)).toMatchObject(
      [{ index: 1, nodeId: 7, trueTheta: 0.2, theta: 1.2, difference: 1 }]
    )
    expect(dryRunUnexpectedAnswers(student, workspace.levels, () => 7)).toBe(2)
  })

  it('splits the chance below, inside and above the reported level', () => {
    // L1 from 70%: -0.6 .. 1.4; estimate 0.4 is in the middle, SE 1
    const scale = dryRunChartScale(workspace, run(0.7))!
    const split = dryRunLevelSplit(scale, {
      theta: 0.4,
      standardError: 1,
      levelId: 2,
    })!
    // each edge 1 SE away: about 16% below and 16% above
    expect(split).toMatchObject({
      lower: 16,
      higher: 16,
      exactly: 68,
      belowLevelId: 1,
      aboveLevelId: 3,
    })
    // nothing below the lowest level
    expect(
      dryRunLevelSplit(scale, { theta: -1, standardError: 1, levelId: 1 })
    ).toMatchObject({ lower: 0, belowLevelId: null })
  })

  it('counts true against reported levels for one competence', () => {
    const student = (
      index: number,
      levels: Array<[nodeId: number, trueId: number, reportedId: number | null]>
    ) =>
      ({
        index,
        trueLevels: levels.map(([nodeId, levelId]) => ({ nodeId, levelId })),
        competences: levels.map(([nodeId, , levelId]) => ({
          nodeId,
          levelId,
          theta: null,
          standardError: null,
          classified: false,
        })),
      }) as never
    const students = [
      student(1, [
        [7, 2, 2],
        [8, 3, 4],
      ]),
      student(2, [
        [7, 2, 3],
        [8, 3, 3],
      ]),
      student(3, [[7, 1, null]]),
    ]
    expect(dryRunConfusion(students, 7)).toEqual([
      {
        trueLevelId: 2,
        reported: [
          { levelId: 2, count: 1 },
          { levelId: 3, count: 1 },
        ],
      },
      { trueLevelId: 1, reported: [{ levelId: null, count: 1 }] },
    ])
    expect(dryRunConfusion(students, 9)).toEqual([])
  })
})

describe('dry-run overall level', () => {
  // Bands at 0%: L0 below -2, L1 -2..0, L2 0..2, L3 from 2.
  const scale = dryRunChartScale(workspace, run(0))!
  const student = (
    index: number,
    trueLevels: Array<{ nodeId: number; levelId: number; theta?: number }>,
    overallLevelId: number | null
  ) =>
    ({
      index,
      trueLevels,
      overall: {
        theta: overallLevelId === null ? null : 0.5,
        standardError: 0.3,
        levelId: overallLevelId,
      },
      competences: [],
      answers: [],
      stopReason: 'CAP',
      questionCount: 10,
    }) as never
  const students = [
    // mean of -1.5 and 1.9 is 0.2: L2
    student(
      1,
      [
        { nodeId: 7, levelId: 2, theta: -1.5 },
        { nodeId: 8, levelId: 3, theta: 1.9 },
      ],
      4
    ),
    // ideal: middles of L1 (-1) and L3 (3) average to 1: L2
    student(
      2,
      [
        { nodeId: 7, levelId: 2 },
        { nodeId: 8, levelId: 4 },
      ],
      2
    ),
    // mean -2.2: L0, nothing reported
    student(
      3,
      [
        { nodeId: 7, levelId: 1, theta: -2.5 },
        { nodeId: 8, levelId: 2, theta: -1.9 },
      ],
      null
    ),
  ]

  it('compares the mean of the true abilities with the overall level', () => {
    expect(dryRunOverallConfusion(students, scale)).toEqual([
      {
        trueLevelId: 3,
        reported: [
          { levelId: 4, count: 1 },
          { levelId: 2, count: 1 },
        ],
      },
      { trueLevelId: 1, reported: [{ levelId: null, count: 1 }] },
    ])
  })

  it('draws one point per student with an overall estimate', () => {
    const points = dryRunOverallPoints(students, scale)
    expect(points.map(({ index, difference }) => [index, difference])).toEqual([
      [1, 1],
      [2, -1],
    ])
    expect(points[0]!.trueTheta).toBeCloseTo(0.2)
    // ideal students are spread inside their true level
    expect(points[1]!.trueTheta).toBeGreaterThanOrEqual(0)
    expect(points[1]!.trueTheta).toBeLessThanOrEqual(2)
  })
})

describe('dry-run agreement', () => {
  it('counts right, one-off, further-off and unreported results', () => {
    expect(
      dryRunAgreement(
        [
          {
            trueLevelId: 2,
            reported: [
              { levelId: 2, count: 3 },
              { levelId: 3, count: 2 },
              { levelId: 4, count: 1 },
              { levelId: null, count: 1 },
            ],
          },
          { trueLevelId: 4, reported: [{ levelId: 1, count: 2 }] },
        ],
        workspace.levels
      )
    ).toEqual({ total: 9, exact: 3, oneOff: 2, moreOff: 3, notReported: 1 })
  })
})

describe('dry-run overall level on a border', () => {
  // Bands at 0%: L1 -2..0, L2 0..2. Ideal students in L1 and L2 average to 0.
  const scale = dryRunChartScale(workspace, run(0))!
  const tie = (reportedLevelId: number) =>
    ({
      index: 1,
      trueLevels: [
        { nodeId: 7, levelId: 2 },
        { nodeId: 8, levelId: 3 },
      ],
      overall: { theta: 0, standardError: 0.3, levelId: reportedLevelId },
      competences: [],
      answers: [],
      stopReason: 'CAP',
      questionCount: 10,
    }) as never

  it('counts either neighbour as the true level', () => {
    for (const reported of [2, 3])
      expect(dryRunOverallConfusion([tie(reported)], scale)).toEqual([
        { trueLevelId: reported, reported: [{ levelId: reported, count: 1 }] },
      ])
    // further away it is one level off from the nearer neighbour
    expect(dryRunOverallConfusion([tie(1)], scale)[0]!.trueLevelId).toBe(2)
    expect(dryRunOverallConfusion([tie(4)], scale)[0]!.trueLevelId).toBe(3)
  })
})

describe('run-scoped workspace', () => {
  const current = {
    ...workspace,
    scale: { ...workspace.scale, __typename: 'AdaptiveDryRunScale' as const },
  } as never
  it('uses the levels and range stored with the run', () => {
    const scoped = dryRunWorkspaceOf(current, {
      summary: {
        scale: {
          thetaMin: -2,
          thetaMax: 2,
          levelMappingRule: 'MASTERY',
          levels: [
            { id: 9, label: 'Old A', order: 0 },
            { id: 10, label: 'Old B', order: 1 },
          ],
        },
      },
    } as never)
    expect(scoped.levels.map(({ label }) => label)).toEqual(['Old A', 'Old B'])
    expect(scoped.scale).toMatchObject({
      thetaMin: -2,
      levelMappingRule: 'MASTERY',
    })
  })
  it('keeps the current workspace for runs without a stored scale', () => {
    expect(dryRunWorkspaceOf(current, { summary: {} } as never)).toBe(current)
  })
})

describe('dry-run mastery', () => {
  const current = {
    ...workspace,
    scale: { ...workspace.scale, __typename: 'AdaptiveDryRunScale' as const },
  } as never
  const masteryRun = {
    effectiveSettings: { ...run(0.7).effectiveSettings, masteryMark: true },
  } as never

  it('uses plain bands and marks 70% of the reported level', () => {
    // plain L1 band -2..0: 70% at -0.6
    expect(
      dryRunMastery(current, masteryRun, { theta: -0.5, levelId: 2 })
    ).toEqual({
      mastered: true,
      markTheta: expect.closeTo(-0.6),
      share: expect.closeTo(0.75),
    })
    expect(
      dryRunMastery(current, masteryRun, { theta: -1, levelId: 2 })?.mastered
    ).toBe(false)
    expect(dryRunChartScale(current, masteryRun)!.levels[1]!.lower).toBeCloseTo(
      -2
    )
  })

  it('shows nothing for runs that shifted the bands', () => {
    expect(dryRunMastery(current, run(0.7), { theta: -0.5, levelId: 2 })).toBe(
      null
    )
  })
})

describe('dry-run chance within one level', () => {
  it('sums the reported level and its neighbours under the curve', () => {
    // bands at 0%: L1 -2..0, so ±1 covers L0..L2 = up to 2
    const scale = dryRunChartScale(workspace, run(0))!
    expect(
      dryRunWithinOneChance(scale, { theta: -1, standardError: 1, levelId: 2 })
    ).toBe(Math.round((normalCdf(3) - 0) * 100))
    expect(
      dryRunWithinOneChance(scale, { theta: -1, standardError: 0, levelId: 2 })
    ).toBe(100)
    expect(
      dryRunWithinOneChance(scale, {
        theta: null,
        standardError: 1,
        levelId: 2,
      })
    ).toBeNull()
  })
})
