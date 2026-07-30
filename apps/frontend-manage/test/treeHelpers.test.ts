import {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  applyCompetenceTreeStructuralCommand,
  CompetenceTreeStructuralState,
  getChildren,
  getNodeDepth,
} from '../src/components/resources/competenceTrees/treeHelpers'
import {
  CompetenceTreeAssignmentForm,
  CompetenceTreeCoverageForm,
  CompetenceTreeForm,
  competenceTreeFormToInput,
  CompetenceTreeNodeForm,
  CompetenceTreeValidationView,
} from '../src/components/resources/competenceTrees/types'

const levels = [
  { key: 'level:1', label: 'Low', order: 0 },
  { key: 'level:2', label: 'High', order: 1 },
]

const staleValidation: CompetenceTreeValidationView = {
  valid: false,
  effectiveMaxDepth: 5,
  errors: [{ code: 'STALE', message: 'Stale server result' }],
  warnings: [],
  normalizedRootWeights: [],
}

function node(
  key: string,
  parentKey: string | null,
  order = 0
): CompetenceTreeNodeForm {
  return {
    key,
    parentKey,
    kind:
      parentKey === null
        ? AdaptiveNodeKind.Competence
        : AdaptiveNodeKind.Subcompetence,
    name: key,
    description: '',
    order,
    weight: 1,
  }
}

function coverage(
  leafKey: string,
  levelKey = levels[0].key,
  targetItemCount = 5,
  enabled = true
): CompetenceTreeCoverageForm {
  return { leafKey, levelKey, targetItemCount, enabled }
}

function defaultCoverages(leafKey: string) {
  return levels.map((level) => coverage(leafKey, level.key))
}

function assignment(
  leafKey: string,
  elementId = 1,
  levelKey = levels[0].key
): CompetenceTreeAssignmentForm {
  return {
    key: `assignment:${elementId}`,
    sourceId: elementId,
    elementId,
    elementName: `Element ${elementId}`,
    elementType: ElementType.Sc,
    elementVersion: 1,
    leafKey,
    levelKey,
    enabled: true,
    discrimination: null,
    enablePercentInput: false,
    choiceCount: 4,
    a: 1.2,
    b: 0,
    c: 0.25,
  }
}

function form(
  nodes: CompetenceTreeNodeForm[],
  {
    coverages = [],
    assignments = [],
  }: {
    coverages?: CompetenceTreeCoverageForm[]
    assignments?: CompetenceTreeAssignmentForm[]
  } = {}
): CompetenceTreeForm {
  return {
    name: 'tree',
    displayName: 'Tree',
    description: '',
    maxDepth: 5,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.2,
    levelMappingRule: AdaptiveLevelMappingRule.Nearest,
    levels,
    nodes,
    coverages,
    assignments,
  }
}

function state(
  treeForm: CompetenceTreeForm,
  selectedNodeKey: string | null,
  selectedCell: { leafKey: string; levelKey: string } | null = null
): CompetenceTreeStructuralState {
  return {
    form: treeForm,
    selectedNodeKey,
    selectedCell,
    validation: staleValidation,
  }
}

function chain(depth: number, prefix = 'chain') {
  return Array.from({ length: depth }, (_, index) =>
    node(`${prefix}-${index + 1}`, index === 0 ? null : `${prefix}-${index}`)
  )
}

function siblingsAtDepth(depth: number) {
  if (depth === 1) {
    return [
      node('sibling-0', null, 0),
      node('sibling-1', null, 1),
      node('sibling-2', null, 2),
    ]
  }

  const ancestors = chain(depth - 1, 'ancestor')
  const parentKey = ancestors[ancestors.length - 1].key
  return [
    ...ancestors,
    node('sibling-0', parentKey, 0),
    node('sibling-1', parentKey, 1),
    node('sibling-2', parentKey, 2),
  ]
}

describe('applyCompetenceTreeStructuralCommand', () => {
  describe('move and reorder', () => {
    test.each([1, 2, 3, 4, 5])(
      'moves adjacent siblings without touching dependent state at depth %i',
      (depth) => {
        const preservedCoverage = coverage('sibling-1', levels[0].key, 8)
        const preservedAssignment = assignment('sibling-1')
        const orphanCoverage = coverage('missing-node', 'missing-level', 9)
        const orphanAssignment = assignment('missing-node', 2, 'missing-level')
        const treeForm = form(siblingsAtDepth(depth), {
          coverages: [preservedCoverage, orphanCoverage],
          assignments: [preservedAssignment, orphanAssignment],
        })
        const current = state(treeForm, 'sibling-1', {
          leafKey: 'sibling-1',
          levelKey: levels[0].key,
        })

        const next = applyCompetenceTreeStructuralCommand(current, {
          type: 'move',
          nodeKey: 'sibling-1',
          direction: -1,
        })

        expect(
          getChildren(
            next.form.nodes,
            depth === 1 ? null : `ancestor-${depth - 1}`
          ).map((item) => item.key)
        ).toStrictEqual(['sibling-1', 'sibling-0', 'sibling-2'])
        expect(next.form.coverages).toBe(treeForm.coverages)
        expect(next.form.assignments).toBe(treeForm.assignments)
        expect(next.selectedNodeKey).toBe('sibling-1')
        expect(next.selectedCell).toBe(current.selectedCell)
        expect(next.validation).toBeNull()
      }
    )

    test.each([1, 2, 3, 4, 5])(
      'reorders a sibling to an absolute position at depth %i',
      (depth) => {
        const treeForm = form(siblingsAtDepth(depth), {
          coverages: [coverage('sibling-0', levels[0].key, 7)],
          assignments: [assignment('sibling-0')],
        })
        const current = state(treeForm, 'sibling-0', {
          leafKey: 'sibling-0',
          levelKey: levels[0].key,
        })

        const next = applyCompetenceTreeStructuralCommand(current, {
          type: 'reorder',
          nodeKey: 'sibling-0',
          order: 2,
        })

        expect(
          getChildren(
            next.form.nodes,
            depth === 1 ? null : `ancestor-${depth - 1}`
          ).map((item) => item.key)
        ).toStrictEqual(['sibling-1', 'sibling-2', 'sibling-0'])
        expect(next.form.coverages).toBe(treeForm.coverages)
        expect(next.form.assignments).toBe(treeForm.assignments)
        expect(next.selectedCell).toBe(current.selectedCell)
        expect(next.validation).toBeNull()
      }
    )
  })

  describe('add root', () => {
    test('adds and selects an empty root competence without duplicating a branch', () => {
      const existingCoverage = coverage('leaf', levels[0].key, 8)
      const existingAssignment = assignment('leaf')
      const treeForm = form([node('root', null), node('leaf', 'root')], {
        coverages: [existingCoverage],
        assignments: [existingAssignment],
      })

      const next = applyCompetenceTreeStructuralCommand(
        state(treeForm, 'root'),
        {
          type: 'addRoot',
          name: 'New competence',
        }
      )

      expect(getChildren(next.form.nodes, null)).toHaveLength(2)
      expect(next.form.nodes.at(-1)).toMatchObject({
        key: 'node:local:1',
        parentKey: null,
        kind: AdaptiveNodeKind.Competence,
        name: 'New competence',
        order: 1,
        weight: 1,
      })
      expect(next.form.coverages).toBe(treeForm.coverages)
      expect(next.form.assignments).toBe(treeForm.assignments)
      expect(next.selectedNodeKey).toBe('node:local:1')
      expect(next.selectedCell).toBeNull()
      expect(next.validation).toBeNull()
    })
  })

  describe('add child', () => {
    test.each([1, 2, 3, 4])(
      'adds a default-covered child below a depth-%i leaf',
      (depth) => {
        const nodes = chain(depth)
        const parentKey = nodes[nodes.length - 1].key
        const treeForm = form(nodes, {
          coverages: depth === 1 ? [] : defaultCoverages(parentKey),
        })
        const current = state(
          treeForm,
          parentKey,
          depth === 1 ? null : { leafKey: parentKey, levelKey: levels[0].key }
        )

        const next = applyCompetenceTreeStructuralCommand(current, {
          type: 'addChild',
          parentKey,
          name: 'New child',
        })

        expect(next.form.nodes).toHaveLength(nodes.length + 1)
        expect(next.form.nodes.at(-1)).toMatchObject({
          key: 'node:local:1',
          parentKey,
          kind: AdaptiveNodeKind.Subcompetence,
          name: 'New child',
          order: 0,
        })
        expect(next.form.coverages).toStrictEqual(
          defaultCoverages('node:local:1')
        )
        expect(next.form.assignments).toBe(treeForm.assignments)
        expect(next.selectedNodeKey).toBe('node:local:1')
        expect(next.selectedCell).toBeNull()
        expect(next.validation).toBeNull()
      }
    )

    test('preserves existing leaf data when adding another child to an internal node', () => {
      const existingCoverage = coverage('existing', levels[0].key, 8)
      const existingAssignment = assignment('existing')
      const treeForm = form(
        [
          node('root', null),
          node('parent', 'root'),
          node('existing', 'parent'),
        ],
        {
          coverages: [existingCoverage],
          assignments: [existingAssignment],
        }
      )

      const next = applyCompetenceTreeStructuralCommand(
        state(treeForm, 'parent'),
        { type: 'addChild', parentKey: 'parent', name: 'Sibling' }
      )

      expect(next.form.coverages).toStrictEqual([
        existingCoverage,
        ...defaultCoverages('node:local:1'),
      ])
      expect(next.form.coverages[0]).toBe(existingCoverage)
      expect(next.form.assignments).toBe(treeForm.assignments)
    })

    test.each([
      {
        name: 'custom coverage',
        coverages: [coverage('leaf', levels[0].key, 6)],
        assignments: [],
      },
      {
        name: 'an assignment',
        coverages: defaultCoverages('leaf'),
        assignments: [assignment('leaf')],
      },
    ])('rejects converting a leaf with $name into an internal node', (data) => {
      const treeForm = form([node('root', null), node('leaf', 'root')], data)
      const current = state(treeForm, 'leaf')

      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'addChild',
          parentKey: 'leaf',
          name: 'Child',
        })
      ).toBe(current)
    })

    test('rejects a child below depth five', () => {
      const nodes = chain(5)
      const current = state(form(nodes), nodes[4].key)

      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'addChild',
          parentKey: nodes[4].key,
          name: 'Too deep',
        })
      ).toBe(current)
    })
  })

  describe('reparent', () => {
    test.each([1, 2, 3, 4])(
      'moves a populated subtree below a default leaf at depth %i',
      (targetDepth) => {
        const targetNodes = chain(targetDepth, 'target')
        const targetKey = targetNodes[targetNodes.length - 1].key
        const sourceRoot = node('source-root', null, 1)
        const movingNode = node('moving', sourceRoot.key)
        const movingCoverage = coverage('moving', levels[0].key, 8)
        const movingAssignment = assignment('moving')
        const treeForm = form([...targetNodes, sourceRoot, movingNode], {
          coverages: [
            ...(targetDepth === 1 ? [] : defaultCoverages(targetKey)),
            movingCoverage,
          ],
          assignments: [movingAssignment],
        })
        const current = state(treeForm, 'moving', {
          leafKey: targetKey,
          levelKey: levels[0].key,
        })

        const next = applyCompetenceTreeStructuralCommand(current, {
          type: 'reparent',
          nodeKey: 'moving',
          parentKey: targetKey,
        })

        expect(
          next.form.nodes.find((candidate) => candidate.key === 'moving')
            ?.parentKey
        ).toBe(targetKey)
        expect(getNodeDepth(next.form.nodes, 'moving')).toBe(targetDepth + 1)
        expect(next.form.coverages).toContain(movingCoverage)
        expect(next.form.coverages).not.toEqual(
          expect.arrayContaining(defaultCoverages(targetKey))
        )
        expect(next.form.assignments).toBe(treeForm.assignments)
        expect(next.selectedNodeKey).toBe('moving')
        expect(next.selectedCell).toBeNull()
        expect(next.validation).toBeNull()
      }
    )

    test('adds visible defaults when the old subcompetence parent becomes a leaf', () => {
      const movingCoverage = coverage('moving', levels[0].key, 8)
      const movingAssignment = assignment('moving')
      const oldParentCoverage = coverage('old-parent', levels[0].key, 9, false)
      const orphanCoverage = coverage('orphan', 'missing-level', 9)
      const orphanAssignment = assignment('orphan', 2, 'missing-level')
      const treeForm = form(
        [
          node('root', null),
          node('old-parent', 'root', 0),
          node('target', 'root', 1),
          node('moving', 'old-parent'),
        ],
        {
          coverages: [
            ...defaultCoverages('target'),
            movingCoverage,
            oldParentCoverage,
            orphanCoverage,
          ],
          assignments: [movingAssignment, orphanAssignment],
        }
      )

      const next = applyCompetenceTreeStructuralCommand(
        state(treeForm, 'moving', {
          leafKey: 'target',
          levelKey: levels[0].key,
        }),
        { type: 'reparent', nodeKey: 'moving', parentKey: 'target' }
      )

      expect(next.form.coverages).toStrictEqual([
        movingCoverage,
        oldParentCoverage,
        orphanCoverage,
        coverage('old-parent', levels[1].key),
      ])
      expect(next.form.assignments).toBe(treeForm.assignments)
      expect(next.form.assignments).toContain(orphanAssignment)
      expect(next.selectedCell).toBeNull()
    })

    test.each([
      {
        name: 'custom coverage',
        targetCoverages: [coverage('target', levels[0].key, 6)],
        targetAssignments: [],
      },
      {
        name: 'an assignment',
        targetCoverages: defaultCoverages('target'),
        targetAssignments: [assignment('target', 2)],
      },
    ])('blocks reparenting onto a leaf with $name', (data) => {
      const treeForm = form(
        [
          node('root', null),
          node('source-parent', 'root', 0),
          node('target', 'root', 1),
          node('moving', 'source-parent'),
        ],
        {
          coverages: data.targetCoverages,
          assignments: data.targetAssignments,
        }
      )
      const current = state(treeForm, 'moving')

      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'reparent',
          nodeKey: 'moving',
          parentKey: 'target',
        })
      ).toBe(current)
    })

    test('rejects a subtree that would exceed depth five', () => {
      const targetNodes = chain(5, 'target')
      const treeForm = form([
        ...targetNodes,
        node('source-root', null, 1),
        node('moving', 'source-root'),
      ])
      const current = state(treeForm, 'moving')

      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'reparent',
          nodeKey: 'moving',
          parentKey: 'target-5',
        })
      ).toBe(current)
    })
  })

  describe('duplicate', () => {
    test.each([1, 2, 3, 4, 5])(
      'duplicates coverage but not assignments for a branch at depth %i',
      (depth) => {
        const nodes = chain(depth)
        const sourceKey = nodes[nodes.length - 1].key
        const sourceCoverage = coverage(sourceKey, levels[0].key, 8)
        const sourceAssignment = assignment(sourceKey)
        const treeForm = form(nodes, {
          coverages: [sourceCoverage],
          assignments: [sourceAssignment],
        })

        const next = applyCompetenceTreeStructuralCommand(
          state(treeForm, sourceKey, {
            leafKey: sourceKey,
            levelKey: levels[0].key,
          }),
          { type: 'duplicate', nodeKey: sourceKey }
        )

        expect(next.form.nodes.at(-1)).toMatchObject({
          key: 'node:local:1',
          parentKey: depth === 1 ? null : nodes[depth - 2].key,
          kind:
            depth === 1
              ? AdaptiveNodeKind.Competence
              : AdaptiveNodeKind.Subcompetence,
        })
        expect(next.form.coverages).toStrictEqual([
          sourceCoverage,
          { ...sourceCoverage, leafKey: 'node:local:1' },
        ])
        expect(next.form.assignments).toBe(treeForm.assignments)
        expect(next.selectedNodeKey).toBe('node:local:1')
        expect(next.selectedCell).toStrictEqual({
          leafKey: 'node:local:1',
          levelKey: levels[0].key,
        })
        expect(next.validation).toBeNull()
      }
    )

    test('duplicates a complete branch with remapped parent keys', () => {
      const treeForm = form(
        [node('root', null), node('branch', 'root'), node('leaf', 'branch')],
        { coverages: defaultCoverages('leaf') }
      )

      const next = applyCompetenceTreeStructuralCommand(
        state(treeForm, 'branch'),
        { type: 'duplicate', nodeKey: 'branch' }
      )

      expect(next.form.nodes.slice(-2)).toStrictEqual([
        { ...treeForm.nodes[1], key: 'node:local:1', order: 1 },
        {
          ...treeForm.nodes[2],
          key: 'node:local:2',
          parentKey: 'node:local:1',
        },
      ])
      expect(next.form.coverages.slice(-2)).toStrictEqual(
        defaultCoverages('node:local:2')
      )
    })
  })

  describe('delete', () => {
    test.each([1, 2, 3, 4, 5])(
      'reconciles branch data and selection for a deletion at depth %i',
      (depth) => {
        const nodes =
          depth === 1
            ? [node('deleted', null, 0), node('remaining', null, 1)]
            : chain(depth, 'deleted')
        const deletedKey = depth === 1 ? 'deleted' : nodes[nodes.length - 1].key
        const fallbackKey =
          depth === 1 ? 'remaining' : nodes[nodes.length - 2].key
        const orphanCoverage = coverage('orphan', 'missing-level', 9)
        const orphanAssignment = assignment('orphan', 2, 'missing-level')
        const treeForm = form(nodes, {
          coverages: [coverage(deletedKey, levels[0].key, 8), orphanCoverage],
          assignments: [assignment(deletedKey), orphanAssignment],
        })

        const next = applyCompetenceTreeStructuralCommand(
          state(treeForm, deletedKey, {
            leafKey: deletedKey,
            levelKey: levels[0].key,
          }),
          { type: 'delete', nodeKey: deletedKey }
        )

        expect(next.form.nodes.some((item) => item.key === deletedKey)).toBe(
          false
        )
        expect(next.form.coverages).toContain(orphanCoverage)
        expect(next.form.assignments).toContain(orphanAssignment)
        expect(
          next.form.coverages.some((item) => item.leafKey === deletedKey)
        ).toBe(false)
        expect(
          next.form.assignments.some((item) => item.leafKey === deletedKey)
        ).toBe(false)
        if (depth >= 3) {
          expect(next.form.coverages).toEqual(
            expect.arrayContaining(defaultCoverages(fallbackKey))
          )
        } else {
          expect(
            next.form.coverages.some((item) => item.leafKey === fallbackKey)
          ).toBe(false)
        }
        expect(next.selectedNodeKey).toBe(fallbackKey)
        expect(next.selectedCell).toBeNull()
        expect(next.validation).toBeNull()
      }
    )
  })

  describe('pre-mutation rejection', () => {
    test.each([
      {
        name: 'a nonexistent target parent',
        nodes: [node('root', null), node('moving', 'root')],
        command: {
          type: 'reparent' as const,
          nodeKey: 'moving',
          parentKey: 'missing',
        },
      },
      {
        name: 'a cycle',
        nodes: [
          node('root', null),
          node('parent', 'root'),
          node('moving', 'parent'),
          node('descendant', 'moving'),
        ],
        command: {
          type: 'reparent' as const,
          nodeKey: 'moving',
          parentKey: 'descendant',
        },
      },
      {
        name: 'reparenting a root competence',
        nodes: [
          node('root-a', null, 0),
          node('root-b', null, 1),
          node('target', 'root-b'),
        ],
        command: {
          type: 'reparent' as const,
          nodeKey: 'root-a',
          parentKey: 'target',
        },
      },
    ])('returns the exact state for $name', ({ nodes, command }) => {
      const current = state(form(nodes), command.nodeKey)
      expect(applyCompetenceTreeStructuralCommand(current, command)).toBe(
        current
      )
    })

    test('rejects a form that already contains a missing parent', () => {
      const current = state(
        form([node('root', null), node('orphan', 'missing')]),
        'root'
      )
      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'duplicate',
          nodeKey: 'root',
        })
      ).toBe(current)
    })

    test('rejects a form that already contains a root-kind violation', () => {
      const invalidRoot = {
        ...node('root', null),
        kind: AdaptiveNodeKind.Subcompetence,
      }
      const current = state(form([invalidRoot]), 'root')
      expect(
        applyCompetenceTreeStructuralCommand(current, {
          type: 'addChild',
          parentKey: 'root',
          name: 'Child',
        })
      ).toBe(current)
    })
  })
})

test('competenceTreeFormToInput preserves orphan rows for authoritative validation', () => {
  const orphanCoverage = coverage('missing-node', 'missing-level', 9, false)
  const orphanAssignment = assignment('missing-node', 7, 'missing-level')
  const input = competenceTreeFormToInput(
    form([node('root', null)], {
      coverages: [orphanCoverage],
      assignments: [orphanAssignment],
    })
  )

  expect(input.coverages).toStrictEqual([orphanCoverage])
  expect(input.assignments).toStrictEqual([
    {
      elementId: orphanAssignment.elementId,
      leafKey: orphanAssignment.leafKey,
      levelKey: orphanAssignment.levelKey,
      enabled: orphanAssignment.enabled,
      discrimination: orphanAssignment.discrimination,
      enablePercentInput: orphanAssignment.enablePercentInput,
    },
  ])
})
