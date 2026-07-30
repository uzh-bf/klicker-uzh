import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import {
  advanceAdaptiveRuntime,
  prepareAdaptiveRuntime,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
} from '../src/index.js'

describe('adaptive runtime guardrail benchmark', () => {
  it('prepares and advances a 500-node, 20-level, 10,000-item runtime', () => {
    const fixture = guardrailFixture()

    const prepareStartedAt = performance.now()
    const runtime = prepareAdaptiveRuntime(fixture)
    const prepareMs = performance.now() - prepareStartedAt

    const firstStartedAt = performance.now()
    const first = advanceAdaptiveRuntime({
      attemptId: 'benchmark-first',
      runtime,
      responses: [],
    })
    const firstDecisionMs = performance.now() - firstStartedAt

    const lateResponses: AdaptiveRuntimeResponse[] = fixture.pool
      .slice(0, 999)
      .map((poolItem, index) => ({
        order: index + 1,
        poolItemId: poolItem.id,
        poolItem,
        correct: index % 2 === 0,
      }))
    const lateStartedAt = performance.now()
    const late = advanceAdaptiveRuntime({
      attemptId: 'benchmark-late',
      runtime,
      responses: lateResponses,
    })
    const lateDecisionMs = performance.now() - lateStartedAt

    expect(fixture.nodes).toHaveLength(500)
    expect(fixture.levels).toHaveLength(20)
    expect(fixture.pool).toHaveLength(10_000)
    expect(first.nextPoolItem).not.toBeNull()
    expect(late.nextPoolItem).not.toBeNull()

    // Coarse regression ceilings only. Calibrated P95 gates require a pinned runner.
    expect(prepareMs).toBeLessThan(2_000)
    expect(firstDecisionMs).toBeLessThan(2_000)
    expect(lateDecisionMs).toBeLessThan(5_000)

    if (process.env.ADAPTIVE_PERFORMANCE_REPORT === '1') {
      console.info(
        JSON.stringify({ prepareMs, firstDecisionMs, lateDecisionMs })
      )
    }
  })
})

function guardrailFixture() {
  const levels: AdaptiveRuntimeLevel[] = Array.from(
    { length: 20 },
    (_, index) => ({ id: index + 1, label: `L${index + 1}`, order: index })
  )
  const nodes: AdaptiveRuntimeNode[] = []
  const pool: AdaptiveRuntimePoolItem[] = []
  let nodeId = 1
  let itemId = 1

  for (let rootIndex = 0; rootIndex < 250; rootIndex++) {
    const rootId = nodeId++
    const leafId = nodeId++
    nodes.push({
      id: rootId,
      parentId: null,
      kind: 'COMPETENCE',
      depth: 1,
      order: rootIndex,
      enabled: true,
      weight: 1 / 250,
      questionCap: null,
    })
    nodes.push({
      id: leafId,
      parentId: rootId,
      kind: 'SUBCOMPETENCE',
      depth: 2,
      order: 0,
      enabled: true,
      weight: null,
      questionCap: null,
    })
    for (const level of levels) {
      for (let itemIndex = 0; itemIndex < 2; itemIndex++) {
        pool.push({
          id: itemId++,
          leafNodeId: leafId,
          nodePath: [rootId, leafId],
          levelId: level.id,
          discrimination: 1.2,
          difficulty: -3 + (level.order * 6) / 19,
          guessing: 0.25,
        })
      }
    }
  }

  return {
    nodes,
    levels,
    pool,
    settings: {
      totalQuestionCap: 1_000,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST' as const,
      thetaRange: { min: -3, max: 3 },
    },
  }
}
