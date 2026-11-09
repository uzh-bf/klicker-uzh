import { describe, expect, it } from 'vitest'
import { findAdditionalLeafMappingIssue } from '../src/services/adaptivePracticeQuizAdditionalLeaves.js'
import { markClassifiedAdaptiveRootEstimates } from '../src/services/adaptivePracticeQuizEstimatePersistence.js'
import {
  buildAdaptiveDecisionRequest,
  type LoadedAdaptiveEstimator,
} from '../src/services/adaptivePracticeQuizEstimatorVersions.js'
import {
  type AdaptiveRuntimeEstimates,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  getMappedRuntimeLeafIds,
  getMappedRuntimeNodeIds,
} from '../src/services/adaptivePracticeQuizRuntime.js'
import type { LoadedAdaptiveRuntime } from '../src/services/adaptivePracticeQuizRuntimeData.js'

// Synthetic topology: root 1 > group 2 > leaves 3, 4; root 1 > leaf 5;
// root 10 > leaf 11.
function node(
  id: number,
  parentId: number | null,
  depth: number,
  enabled = true
): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
    depth,
    order: 0,
    enabled,
    weight: parentId === null ? 1 : null,
    questionCap: null,
  }
}
const nodes = [
  node(1, null, 1),
  node(2, 1, 2),
  node(3, 2, 3),
  node(4, 2, 3),
  node(5, 1, 2),
  node(10, null, 1),
  node(11, 10, 2),
]
const paths: Record<number, number[]> = {
  3: [1, 2, 3],
  4: [1, 2, 4],
  5: [1, 5],
  11: [10, 11],
}
function poolItem(
  id: number,
  leafNodeId: number,
  additionalLeafNodeIds: number[] = []
) {
  return {
    id,
    leafNodeId,
    nodePath: paths[leafNodeId]!,
    additionalLeafNodeIds,
    levelId: 1,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0.25,
  } as unknown as AdaptiveRuntimeRoutingPoolItem
}
const settings = {
  totalQuestionCap: 20,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 1,
  classificationZ: 0.01,
  topInformationRatio: 0.8,
  levelMappingRule: 'NEAREST' as const,
  thetaRange: { min: -3, max: 3 },
}
const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Advanced', order: 1 },
]

describe('additional subcompetence mapping rules', () => {
  const nodesById = new Map(nodes.map((entry) => [entry.id, entry]))
  const parentIds = new Set(
    nodes.flatMap(({ parentId }) => (parentId === null ? [] : [parentId]))
  )
  const enabled = new Map(nodes.map(({ id }) => [id, id !== 4]))
  const check = (additionalLeafNodeIds: number[], requireEnabled = false) =>
    findAdditionalLeafMappingIssue({
      leafNodeId: 3,
      additionalLeafNodeIds,
      nodesById,
      parentIds,
      requireEnabled,
      effectiveNodeEnabled: enabled,
    })

  it('accepts distinct leaves of the same root competence', () => {
    expect(check([])).toBeNull()
    expect(check([4, 5])).toBeNull()
  })

  it('rejects another root with a dedicated code', () => {
    expect(check([11])).toBe('ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAF_OTHER_ROOT')
    expect(check([5, 11])).toBe(
      'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAF_OTHER_ROOT'
    )
  })

  it.each([
    ['the primary leaf', [3]],
    ['a duplicate', [5, 5]],
    ['a non-leaf node', [2]],
    ['an unknown node', [99]],
  ])('rejects %s', (_, ids) => {
    expect(check(ids)).toBe('ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID')
  })

  it('tolerates disabled targets unless enabled targets are required', () => {
    expect(check([4])).toBeNull()
    expect(check([4], true)).toBe(
      'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID'
    )
  })
})

describe('IRT_V1 multi-leaf engine payload', () => {
  const runtime = (pool: AdaptiveRuntimeRoutingPoolItem[]) =>
    ({
      measurementVersion: 'IRT_V1',
      algorithm: { nodes, levels, pool, settings },
    }) as LoadedAdaptiveEstimator

  it('sends additional leaves only for items that have them', () => {
    const request = buildAdaptiveDecisionRequest({
      attemptId: '11111111-1111-4111-8111-111111111111',
      runtime: runtime([poolItem(1, 3, [4, 5]), poolItem(2, 11)]),
      responses: [],
    })
    if (request.measurementVersion !== 'IRT_V1') throw new Error('V1 only')
    expect(request.pool[0]).toMatchObject({
      id: 1,
      leafNodeId: 3,
      nodePath: [1, 2, 3],
      additionalLeafNodeIds: [4, 5],
    })
    // Single-leaf items keep the exact request shape older engines accept.
    expect(Object.keys(request.pool[1]!)).not.toContain('additionalLeafNodeIds')
  })
})

describe('host-side multi-leaf evidence accounting', () => {
  const enabledIds = new Set(nodes.map(({ id }) => id))

  it('maps one answer to every enabled leaf and each node once', () => {
    const item = poolItem(1, 3, [4, 5])
    expect(getMappedRuntimeLeafIds(item, enabledIds)).toEqual([3, 4, 5])
    expect(getMappedRuntimeNodeIds(item, nodes, enabledIds).sort()).toEqual([
      1, 2, 3, 4, 5,
    ])
    const withoutFour = new Set([...enabledIds].filter((id) => id !== 4))
    expect(getMappedRuntimeLeafIds(item, withoutFour)).toEqual([3, 5])
    expect(
      getMappedRuntimeNodeIds(poolItem(2, 5, [4]), nodes, withoutFour)
    ).toEqual([1, 5])
  })

  it('finalizes a root as classified when extra targets provide coverage', () => {
    const answered = [poolItem(1, 3, [4]), poolItem(2, 5)]
    const pool = [...answered, poolItem(3, 4), poolItem(4, 11)]
    const responses: AdaptiveRuntimeResponse[] = answered.map(
      (item, index) => ({
        order: index + 1,
        poolItemId: item.id,
        poolItem: item,
        correct: true,
      })
    )
    const estimates = (): AdaptiveRuntimeEstimates => ({
      overall: {
        nodeKind: 'OVERALL',
        nodeId: null,
        theta: 0,
        standardError: 0.1,
        responseCount: 4,
        levelId: null,
        stopReason: 'TOTAL_QUESTION_CAP',
      },
      nodes: new Map([
        [
          1,
          {
            nodeKind: 'COMPETENCE',
            nodeId: 1,
            theta: -2,
            standardError: 0.1,
            responseCount: 4,
            levelId: 1,
            stopReason: 'TOTAL_QUESTION_CAP',
          },
        ],
      ]),
    })
    const loaded = (items: AdaptiveRuntimeRoutingPoolItem[]) =>
      ({
        algorithm: { nodes, levels, settings },
        pool: items,
      }) as unknown as LoadedAdaptiveRuntime
    const covered = estimates()
    markClassifiedAdaptiveRootEstimates(loaded(pool), responses, covered)
    expect(covered.nodes.get(1)?.stopReason).toBe('CLASSIFIED')

    const singleLeaf = answered.map((item) => ({
      ...item,
      additionalLeafNodeIds: [],
    }))
    const uncovered = estimates()
    markClassifiedAdaptiveRootEstimates(
      loaded([...singleLeaf, poolItem(3, 4), poolItem(4, 11)]),
      responses.map((response, index) => ({
        ...response,
        poolItem: singleLeaf[index]!,
      })),
      uncovered
    )
    expect(uncovered.nodes.get(1)?.stopReason).toBe('TOTAL_QUESTION_CAP')
  })
})
