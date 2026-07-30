import { describe, expect, it } from 'vitest'
import {
  AdaptiveRuntimeConfigurationError,
  advanceAdaptiveRuntime,
  computeAdaptiveRuntimeEstimates,
  prepareAdaptiveRuntime,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
} from '../src/index.js'

const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Intermediate', order: 1 },
  { id: 3, label: 'Advanced', order: 2 },
]
const settings = {
  totalQuestionCap: 40,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 1,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  levelMappingRule: 'NEAREST' as const,
  thetaRange: { min: -3, max: 3 },
}

describe('adaptive runtime core', () => {
  it('rejects an all-zero enabled root-weight configuration', () => {
    const nodes = runtimeNodes([0, 0])

    expect(() =>
      prepareAdaptiveRuntime({
        nodes,
        levels,
        pool: runtimePool(),
        settings,
      })
    ).toThrowError(AdaptiveRuntimeConfigurationError)
  })

  it('keeps overall estimates invariant under proportional weight scaling', () => {
    const pool = runtimePool()
    const responses: AdaptiveRuntimeResponse[] = pool.map((item, index) => ({
      order: index + 1,
      poolItemId: item.id,
      poolItem: item,
      correct: index % 3 !== 0,
    }))
    const estimate = (weights: [number, number]) =>
      computeAdaptiveRuntimeEstimates({
        nodes: runtimeNodes(weights),
        levels,
        responses,
        settings,
      }).overall

    const normalized = estimate([0.25, 0.75])
    const scaled = estimate([25, 75])
    expect(scaled.theta).toBe(normalized.theta)
    expect(scaled.standardError).toBe(normalized.standardError)
    expect(scaled.levelId).toBe(normalized.levelId)
  })

  it('distributes equivalent sequential item ids deterministically across attempts', () => {
    const pool = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      leafNodeId: 2,
      nodePath: [1, 2],
      levelId: 2,
      discrimination: 1.2,
      difficulty: 0,
      guessing: 0,
    }))
    const runtime = prepareAdaptiveRuntime({
      nodes: [rootNode(1, 0, 1), leafNode(2, 1)],
      levels,
      pool,
      settings,
    })
    const select = () =>
      Array.from(
        { length: 1_000 },
        (_, index) =>
          advanceAdaptiveRuntime({
            attemptId: `attempt-${index}`,
            runtime,
            responses: [],
          }).nextPoolItem!.id
      )

    const first = select()
    const counts = new Map<number, number>()
    for (const itemId of first) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
    }

    expect(select()).toEqual(first)
    expect(counts.size).toBe(pool.length)
    expect(Math.min(...counts.values())).toBeGreaterThanOrEqual(90)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(160)
  })
})

function runtimeNodes(weights: [number, number]): AdaptiveRuntimeNode[] {
  return [
    rootNode(1, 0, weights[0]),
    leafNode(2, 1),
    rootNode(3, 1, weights[1]),
    leafNode(4, 3),
  ]
}

function rootNode(id: number, order: number, weight: number) {
  return {
    id,
    parentId: null,
    kind: 'COMPETENCE' as const,
    depth: 1,
    order,
    enabled: true,
    weight,
    questionCap: null,
  }
}

function leafNode(id: number, parentId: number) {
  return {
    id,
    parentId,
    kind: 'SUBCOMPETENCE' as const,
    depth: 2,
    order: 0,
    enabled: true,
    weight: null,
    questionCap: null,
  }
}

function runtimePool(): AdaptiveRuntimePoolItem[] {
  return [1, 3].flatMap((rootId, rootIndex) =>
    [-2, -1, 1, 2].map((difficulty, itemIndex) => ({
      id: rootIndex * 4 + itemIndex + 1,
      leafNodeId: rootId + 1,
      nodePath: [rootId, rootId + 1],
      levelId: itemIndex < 2 ? 1 : 3,
      discrimination: 1.2,
      difficulty,
      guessing: 0.25,
    }))
  )
}
