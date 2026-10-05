import { describe, expect, it } from 'vitest'
import { getAdaptiveDistributionRows } from '../src/components/evaluation/adaptive/adaptiveDistributionEdges'

const bucket = (
  levelLabel: string,
  levelOrder: number,
  count: number,
  determinedCount: number,
  hasElements?: boolean
) => ({ levelLabel, levelOrder, count, determinedCount, hasElements })

describe('cohort distribution rows', () => {
  it('folds unmeasured edge levels into the nearest measurable level', () => {
    expect(
      getAdaptiveDistributionRows([
        bucket('A2.2', 2, 4, 2, true),
        bucket('Under A2', 0, 3, 2, false),
        bucket('A2.1', 1, 2, 1, true),
        bucket('Above', 3, 1, 0, false),
      ])
    ).toEqual([
      {
        key: '1',
        levelLabel: 'A2.1',
        edge: 'belowRange',
        count: 5,
        determinedCount: 3,
      },
      {
        key: '2',
        levelLabel: 'A2.2',
        edge: 'aboveRange',
        count: 5,
        determinedCount: 2,
      },
    ])
  })

  it('keeps every level when the payload has no element information', () => {
    expect(
      getAdaptiveDistributionRows([
        bucket('Under A2', 0, 3, 2),
        bucket('A2.1', 1, 2, 1),
      ]).map(({ levelLabel, edge }) => [levelLabel, edge])
    ).toEqual([
      ['Under A2', 'none'],
      ['A2.1', 'none'],
    ])
  })
})
