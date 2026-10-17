import { AdaptiveNodeKind, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  getAdditionalLeafOptions,
  updateElementMapping,
} from '../src/components/resources/competenceTrees/assignmentHelpers'
import { addElementBatch } from '../src/components/resources/competenceTrees/bulkAssignmentHelpers'
import {
  type CompetenceTreeForm,
  createDefaultCompetenceTreeForm,
} from '../src/components/resources/competenceTrees/types'

// Synthetic tree: Grammar > Gender, Cases; Vocabulary > Food.
function form(): CompetenceTreeForm {
  const base = createDefaultCompetenceTreeForm({
    levels: ['A1', 'A2', 'B1'],
    root: 'Grammar',
    leaf: 'Gender',
  })
  const subcompetence = (key: string, parentKey: string, name: string) => ({
    key,
    parentKey,
    kind: AdaptiveNodeKind.Subcompetence,
    name,
    description: '',
    order: 1,
    weight: 1,
  })
  const withNodes = {
    ...base,
    nodes: [
      ...base.nodes,
      subcompetence('cases', 'node:local:1', 'Cases'),
      {
        key: 'vocabulary',
        parentKey: null,
        kind: AdaptiveNodeKind.Competence,
        name: 'Vocabulary',
        description: '',
        order: 1,
        weight: 1,
      },
      subcompetence('food', 'vocabulary', 'Food'),
    ],
  }
  return addElementBatch(
    withNodes,
    [
      {
        id: 1,
        name: 'Synthetic 1',
        type: ElementType.Sc,
        version: 1,
        choiceCount: 4,
      },
    ],
    'node:local:2',
    'level:local:1'
  )
}

describe('additional subcompetence mappings', () => {
  test('offers only other leaves of the same root competence', () => {
    expect(
      getAdditionalLeafOptions(form(), 'node:local:2').map(({ key }) => key)
    ).toEqual(['cases'])
    expect(getAdditionalLeafOptions(form(), 'food')).toEqual([])
    expect(getAdditionalLeafOptions(form(), '')).toEqual([])
  })

  test('adds coverage for an extra leaf at the assignment level', () => {
    const initial = form()
    const next = updateElementMapping(initial, initial.assignments[0]!.key, {
      additionalLeafKeys: ['cases', 'cases', 'node:local:2'],
    })
    expect(next.assignments[0]!.additionalLeafKeys).toEqual(['cases'])
    expect(next.coverages).toContainEqual(
      expect.objectContaining({
        leafKey: 'cases',
        levelKey: 'level:local:1',
        enabled: true,
      })
    )
  })

  test('drops extra leaves of another root when the primary leaf moves', () => {
    const initial = form()
    const key = initial.assignments[0]!.key
    const mapped = updateElementMapping(initial, key, {
      additionalLeafKeys: ['cases'],
    })
    const moved = updateElementMapping(mapped, key, { leafKey: 'food' })
    expect(moved.assignments[0]!.leafKey).toBe('food')
    expect(moved.assignments[0]!.additionalLeafKeys).toEqual([])
    const back = updateElementMapping(mapped, key, { leafKey: 'cases' })
    expect(back.assignments[0]!.additionalLeafKeys).toEqual([])
  })
})
