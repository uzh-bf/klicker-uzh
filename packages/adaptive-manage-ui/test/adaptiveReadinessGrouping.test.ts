import { describe, expect, test } from 'vitest'
import {
  formatAdaptiveCoverageCell,
  groupAdaptiveReadinessIssues,
} from '../src/components/activities/creation/practiceQuiz/adaptiveReadinessGrouping'

function cell(
  code: string,
  leafOrder: number,
  levelOrder: number,
  names: { root?: string; leaf?: string; level?: string } = {}
) {
  return {
    code,
    path: `coverages.${leafOrder}-${levelOrder}`,
    leafNodeId: 100 + leafOrder,
    levelId: 200 + levelOrder,
    parameters: {
      leafOrder,
      levelOrder,
      rootName: names.root ?? 'Grammar',
      leafName: names.leaf ?? `Leaf ${leafOrder}`,
      levelLabel: names.level ?? `L${levelOrder}`,
    },
  }
}

describe('groupAdaptiveReadinessIssues', () => {
  test('groups coverage issues per code and keeps other issues in place', () => {
    const other = { code: 'ADAPTIVE_NO_ENABLED_COMPETENCE', path: 'nodes' }
    const last = { code: 'ADAPTIVE_TIME_BUDGET_EXCEEDED', path: 'budget' }
    const entries = groupAdaptiveReadinessIssues([
      other,
      cell('ADAPTIVE_COVERAGE_CELL_EMPTY', 2, 1),
      cell('ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM', 1, 0),
      cell('ADAPTIVE_COVERAGE_CELL_EMPTY', 1, 3),
      cell('ADAPTIVE_COVERAGE_CELL_EMPTY', 2, 0),
      last,
    ])

    expect(
      entries.map((entry) =>
        entry.kind === 'issue' ? entry.issue.code : `group:${entry.code}`
      )
    ).toEqual([
      'ADAPTIVE_NO_ENABLED_COMPETENCE',
      'group:ADAPTIVE_COVERAGE_CELL_EMPTY',
      'group:ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
      'ADAPTIVE_TIME_BUDGET_EXCEEDED',
    ])
    const empty = entries[1]
    expect(
      empty?.kind === 'coverageGroup' && empty.issues.map((i) => i.path)
    ).toEqual(['coverages.1-3', 'coverages.2-0', 'coverages.2-1'])
  })

  test('falls back to names and ids when tree order is unavailable', () => {
    const issue = (leafName: string, levelLabel: string, levelId: number) => ({
      code: 'ADAPTIVE_COVERAGE_BELOW_TARGET',
      levelId,
      parameters: { rootName: 'Vocabulary', leafName, levelLabel },
    })
    const [group] = groupAdaptiveReadinessIssues([
      issue('Leaf 10', 'B1', 3),
      issue('Leaf 2', 'A2', 2),
      issue('Leaf 2', 'A1', 1),
    ])
    expect(
      group?.kind === 'coverageGroup' &&
        group.issues.map((i) => formatAdaptiveCoverageCell(i))
    ).toEqual([
      'Vocabulary › Leaf 2 · A1',
      'Vocabulary › Leaf 2 · A2',
      'Vocabulary › Leaf 10 · B1',
    ])
  })
})

describe('formatAdaptiveCoverageCell', () => {
  test('omits a root that equals the leaf and falls back to ids', () => {
    expect(
      formatAdaptiveCoverageCell({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        parameters: {
          rootName: 'Género',
          leafName: 'Género',
          levelLabel: 'B2.1',
        },
      })
    ).toBe('Género · B2.1')
    expect(
      formatAdaptiveCoverageCell({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        leafNodeId: 7,
        levelId: 9,
      })
    ).toBe('#7 · #9')
  })
})
