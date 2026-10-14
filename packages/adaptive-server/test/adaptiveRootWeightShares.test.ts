import { describe, expect, it } from 'vitest'
import type { AdaptiveRuntimeNode } from '../src/services/adaptivePracticeQuizRuntime.js'
import { getAdaptiveRootWeightShares } from '../src/services/adaptivePracticeQuizWeightShares.js'

function node(
  id: number,
  parentId: number | null,
  weight: number | null,
  enabled = true
): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
    depth: parentId === null ? 1 : 2,
    order: id,
    enabled,
    weight,
    questionCap: null,
  }
}

describe('adaptive root weight shares', () => {
  it('normalizes enabled competence weights and skips subcompetences', () => {
    const shares = getAdaptiveRootWeightShares([
      node(1, null, 2),
      node(11, 1, null),
      node(2, null, 1),
      node(3, null, 1),
    ])
    expect(shares.get(1)).toBeCloseTo(0.5)
    expect(shares.get(2)).toBeCloseTo(0.25)
    expect(shares.get(3)).toBeCloseTo(0.25)
    expect(shares.has(11)).toBe(false)
  })

  it('leaves disabled competences out of the total', () => {
    const shares = getAdaptiveRootWeightShares([
      node(1, null, 1),
      node(2, null, 1, false),
    ])
    expect(shares.get(1)).toBeCloseTo(1)
    expect(shares.has(2)).toBe(false)
  })

  it('reports no shares when a weight is unusable', () => {
    expect(
      getAdaptiveRootWeightShares([node(1, null, 1), node(2, null, null)]).size
    ).toBe(0)
  })
})
