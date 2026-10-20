import {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  applyCoverageBulkPlan,
  countEnabledAssignmentsByCell,
  coverageCellId,
  planCoverageBulkAction,
} from '../src/components/resources/competenceTrees/coverageBulkSelection'
import type {
  CompetenceTreeAssignmentForm,
  CompetenceTreeForm,
  CompetenceTreeNodeForm,
} from '../src/components/resources/competenceTrees/types'

const levels = [
  { key: 'l1', label: 'A1.1', order: 0 },
  { key: 'l2', label: 'A2.1', order: 1 },
  { key: 'l3', label: 'B1.1', order: 2 },
]

function node(key: string, parentKey: string | null): CompetenceTreeNodeForm {
  return {
    key,
    parentKey,
    kind:
      parentKey === null
        ? AdaptiveNodeKind.Competence
        : AdaptiveNodeKind.Subcompetence,
    name: key,
    description: '',
    order: 0,
    weight: 1,
  }
}

let nextElementId = 1
function assignment(
  leafKey: string,
  levelKey: string,
  overrides: Partial<CompetenceTreeAssignmentForm> = {}
): CompetenceTreeAssignmentForm {
  const elementId = nextElementId++
  return {
    key: `assignment:${elementId}`,
    sourceId: elementId,
    elementId,
    elementName: `Element ${elementId}`,
    elementType: ElementType.Sc,
    elementVersion: 1,
    leafKey,
    additionalLeafKeys: [],
    levelKey,
    enabled: true,
    discrimination: null,
    enablePercentInput: false,
    choiceCount: 4,
    a: 1,
    b: 0,
    c: 0.25,
    ...overrides,
  }
}

function many(count: number, leafKey: string, levelKey: string) {
  return Array.from({ length: count }, () => assignment(leafKey, levelKey))
}

function form(overrides: Partial<CompetenceTreeForm> = {}): CompetenceTreeForm {
  return {
    name: 'Tree',
    displayName: 'Tree',
    description: '',
    maxDepth: 3,
    defaultTotalQuestionCap: 20,
    defaultTimeLimitSeconds: null,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1,
    levelMappingRule: AdaptiveLevelMappingRule.Nearest,
    levels,
    nodes: [
      node('root', null),
      node('leafA', 'root'),
      node('leafB', 'root'),
      node('leafC', 'root'),
    ],
    coverages: [],
    assignments: [],
    ...overrides,
  }
}

function cellIds(cells: { leafKey: string; levelKey: string }[]) {
  return cells.map(({ leafKey, levelKey }) => `${leafKey}/${levelKey}`)
}

describe('countEnabledAssignmentsByCell', () => {
  test('counts enabled primary and additional leaves once per assignment', () => {
    const counts = countEnabledAssignmentsByCell([
      assignment('leafA', 'l1', { additionalLeafKeys: ['leafB', 'leafB'] }),
      assignment('leafA', 'l1', { enabled: false }),
    ])
    expect(counts.get(coverageCellId('leafA', 'l1'))).toBe(1)
    expect(counts.get(coverageCellId('leafB', 'l1'))).toBe(1)
  })
})

describe('planCoverageBulkAction', () => {
  test('switches off empty enabled cells, including unsaved default cells', () => {
    const tree = form({
      coverages: [
        {
          leafKey: 'leafA',
          levelKey: 'l3',
          targetItemCount: 5,
          enabled: false,
        },
      ],
      assignments: [assignment('leafA', 'l1'), assignment('leafB', 'l2')],
    })
    const plan = planCoverageBulkAction(tree, ['leafA', 'leafB'], {
      type: 'switchOffEmpty',
    })

    expect(plan.enabled).toBe(false)
    expect(cellIds(plan.cells)).toEqual(['leafA/l2', 'leafB/l1', 'leafB/l3'])
    expect(plan.disabledAssignmentKeys).toEqual([])
    expect(plan.removedAdditionalLinks).toEqual([])
    expect(plan.skippedLeafKeys).toEqual([])
  })

  test('only considers the leaves in scope', () => {
    const plan = planCoverageBulkAction(
      form({ assignments: [assignment('leafA', 'l1')] }),
      ['leafA'],
      { type: 'switchOffEmpty' }
    )
    expect(cellIds(plan.cells)).toEqual(['leafA/l2', 'leafA/l3'])
  })

  test('skips leaves that would lose every enabled level', () => {
    const plan = planCoverageBulkAction(
      form({ assignments: [assignment('leafA', 'l1')] }),
      ['leafA', 'leafC'],
      { type: 'switchOffEmpty' }
    )
    expect(cellIds(plan.cells)).toEqual(['leafA/l2', 'leafA/l3'])
    expect(plan.skippedLeafKeys).toEqual(['leafC'])
  })

  test('switches off cells below the minimum and disables or unlinks their elements', () => {
    const below = many(3, 'leafA', 'l2')
    const linked = assignment('leafB', 'l2', { additionalLeafKeys: ['leafA'] })
    const tree = form({
      assignments: [...many(5, 'leafA', 'l1'), ...below, linked],
    })
    const plan = planCoverageBulkAction(tree, ['leafA'], {
      type: 'switchOffBelow',
      minimum: 5,
    })

    // l2 has 3 primary + 1 additional = 4 elements, l3 is empty.
    expect(cellIds(plan.cells)).toEqual(['leafA/l2', 'leafA/l3'])
    expect(plan.disabledAssignmentKeys).toEqual(below.map(({ key }) => key))
    expect(plan.removedAdditionalLinks).toEqual([
      { assignmentKey: linked.key, leafKey: 'leafA' },
    ])
  })

  test('keeps cells that reach the minimum', () => {
    const plan = planCoverageBulkAction(
      form({
        assignments: [...many(5, 'leafA', 'l1'), ...many(5, 'leafA', 'l2')],
      }),
      ['leafA'],
      { type: 'switchOffBelow', minimum: 5 }
    )
    expect(cellIds(plan.cells)).toEqual(['leafA/l3'])
  })

  test('switches on every disabled cell in scope', () => {
    const tree = form({
      coverages: [
        {
          leafKey: 'leafA',
          levelKey: 'l1',
          targetItemCount: 5,
          enabled: false,
        },
        { leafKey: 'leafA', levelKey: 'l2', targetItemCount: 3, enabled: true },
        {
          leafKey: 'leafB',
          levelKey: 'l3',
          targetItemCount: 5,
          enabled: false,
        },
      ],
    })
    const plan = planCoverageBulkAction(tree, ['leafA'], {
      type: 'switchOnAll',
    })
    expect(plan.enabled).toBe(true)
    expect(cellIds(plan.cells)).toEqual(['leafA/l1'])
  })
})

describe('applyCoverageBulkPlan', () => {
  test('updates existing cells, adds missing ones and adjusts assignments', () => {
    const below = assignment('leafA', 'l2')
    const linked = assignment('leafB', 'l2', {
      additionalLeafKeys: ['leafA', 'leafC'],
    })
    const kept = many(5, 'leafA', 'l1')
    const tree = form({
      coverages: [
        { leafKey: 'leafA', levelKey: 'l2', targetItemCount: 7, enabled: true },
      ],
      assignments: [...kept, below, linked],
    })
    const plan = planCoverageBulkAction(tree, ['leafA'], {
      type: 'switchOffBelow',
      minimum: 5,
    })
    const next = applyCoverageBulkPlan(tree, plan)

    expect(next.coverages).toEqual([
      { leafKey: 'leafA', levelKey: 'l2', targetItemCount: 7, enabled: false },
      { leafKey: 'leafA', levelKey: 'l3', targetItemCount: 5, enabled: false },
    ])
    expect(next.assignments.find(({ key }) => key === below.key)?.enabled).toBe(
      false
    )
    expect(
      next.assignments.find(({ key }) => key === linked.key)?.additionalLeafKeys
    ).toEqual(['leafC'])
    expect(next.assignments.slice(0, 5)).toEqual(kept)
    expect(tree.coverages[0]?.enabled).toBe(true)
  })

  test('returns the same form when nothing changes', () => {
    const tree = form({ assignments: many(5, 'leafA', 'l1') })
    const plan = planCoverageBulkAction(tree, ['leafA'], {
      type: 'switchOnAll',
    })
    expect(applyCoverageBulkPlan(tree, plan)).toBe(tree)
  })
})
