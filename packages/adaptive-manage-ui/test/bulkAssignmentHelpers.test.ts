import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import { addElementBatch } from '../src/components/resources/competenceTrees/bulkAssignmentHelpers'
import { createDefaultCompetenceTreeForm } from '../src/components/resources/competenceTrees/types'

const initial = () =>
  createDefaultCompetenceTreeForm({
    levels: ['A1', 'A2', 'B1'],
    root: 'Grammar',
    leaf: 'Gender',
  })
const element = (id: number) => ({
  id,
  name: `Synthetic ${id}`,
  type: ElementType.Sc,
  version: 1,
  choiceCount: 4,
})
const leaf = 'node:local:2'
const level = 'level:local:2'

describe('bulk element assignments', () => {
  test('preserves existing mappings and deduplicates repeated selections', () => {
    const form = addElementBatch(initial(), [element(1)], leaf, level)
    form.assignments[0]!.additionalLeafKeys = ['another-leaf']
    const next = addElementBatch(
      form,
      [element(1), element(2), element(2)],
      leaf,
      level
    )
    expect(next.assignments).toHaveLength(2)
    expect(next.assignments[0]).toBe(form.assignments[0])
    expect(next.assignments[0]!.additionalLeafKeys).toEqual(['another-leaf'])
    expect(form.assignments).toHaveLength(1)
  })
  test('rejects a parent competence or missing level without modifying the form', () => {
    const form = initial()
    expect(addElementBatch(form, [element(1)], 'node:local:1', level)).toBe(
      form
    )
    expect(addElementBatch(form, [element(1)], leaf, 'missing')).toBe(form)
  })
  test('enables the target coverage and derives the item parameters', () => {
    const form = initial()
    form.coverages = []
    const next = addElementBatch(form, [element(1)], leaf, level)
    expect(next.coverages).toEqual([
      { leafKey: leaf, levelKey: level, enabled: true, targetItemCount: 5 },
    ])
    expect(next.assignments[0]).toMatchObject({
      a: 1.2,
      b: 0,
      c: 0.25,
      enabled: true,
      levelKey: level,
      leafKey: leaf,
    })
    expect(
      addElementBatch(next, [element(2)], leaf, level).coverages
    ).toHaveLength(1)
  })
  test('adds thousands of distinct elements without duplicating coverage', () => {
    const next = addElementBatch(
      initial(),
      Array.from({ length: 3000 }, (_, i) => element(i + 1)),
      leaf,
      level
    )
    expect(next.assignments).toHaveLength(3000)
    expect(new Set(next.assignments.map((item) => item.elementId)).size).toBe(
      3000
    )
    expect(next.coverages).toHaveLength(3)
  })
})
