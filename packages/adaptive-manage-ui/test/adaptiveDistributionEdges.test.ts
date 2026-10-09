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
  it('keeps every level and marks those beyond the levels with elements', () => {
    expect(
      getAdaptiveDistributionRows([
        bucket('A2.2', 2, 4, 2, true),
        bucket('Under A2', 0, 3, 2, false),
        bucket('A2.1', 1, 2, 1, true),
        bucket('Above', 3, 1, 0, false),
      ])
    ).toEqual([
      {
        key: '0',
        levelLabel: 'Under A2',
        edge: 'belowRange',
        count: 3,
        determinedCount: 2,
      },
      {
        key: '1',
        levelLabel: 'A2.1',
        edge: 'none',
        count: 2,
        determinedCount: 1,
      },
      {
        key: '2',
        levelLabel: 'A2.2',
        edge: 'none',
        count: 4,
        determinedCount: 2,
      },
      {
        key: '3',
        levelLabel: 'Above',
        edge: 'aboveRange',
        count: 1,
        determinedCount: 0,
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
