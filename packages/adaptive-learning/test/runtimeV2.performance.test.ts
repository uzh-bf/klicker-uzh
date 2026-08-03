import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import {
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeResponse,
  type AdaptiveScaleDefinition,
  type AdaptiveV2PoolItem,
  type AdaptiveV2RuntimeSettings,
  advanceAdaptiveV2Runtime,
  prepareAdaptiveV2Runtime,
} from '../src/index.js'

describe('adaptive v2 runtime guardrail benchmark', () => {
  it('prepares and advances a 60-item depth-five fixture', () => {
    const fixture = depthFiveFixture()
    const prepareStartedAt = performance.now()
    const runtime = prepareAdaptiveV2Runtime(fixture)
    const prepareMs = performance.now() - prepareStartedAt

    const firstStartedAt = performance.now()
    const first = advanceAdaptiveV2Runtime({
      attemptId: 'v2-performance-first',
      runtime,
      responses: [],
    })
    const firstDecisionMs = performance.now() - firstStartedAt

    const responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[] =
      fixture.pool.slice(0, 30).map((poolItem, index) => ({
        order: index + 1,
        poolItemId: poolItem.id,
        poolItem,
        correct: index % 2 === 0,
      }))
    const lateStartedAt = performance.now()
    const late = advanceAdaptiveV2Runtime({
      attemptId: 'v2-performance-late',
      runtime,
      responses,
    })
    const lateDecisionMs = performance.now() - lateStartedAt

    expect(first.nextPoolItem).not.toBeNull()
    expect(late.nextPoolItem).not.toBeNull()
    expect(prepareMs).toBeLessThan(2_000)
    expect(firstDecisionMs).toBeLessThan(2_000)
    expect(lateDecisionMs).toBeLessThan(2_000)

    if (process.env.ADAPTIVE_PERFORMANCE_REPORT === '1') {
      console.info(
        JSON.stringify({ prepareMs, firstDecisionMs, lateDecisionMs })
      )
    }
  })

  it('advances a two-root composite on the maximum supported grid', () => {
    const scale: AdaptiveScaleDefinition = {
      priorMean: 0,
      priorStandardDeviation: 1,
      gridMin: -10,
      gridMax: 10,
      gridStep: 0.01,
      classificationPolicyVersion: 1,
      levels: [
        {
          id: 1,
          label: 'Foundation',
          order: 0,
          lowerBound: Number.NEGATIVE_INFINITY,
          upperBound: -1,
          itemDifficultyPrior: -2,
        },
        {
          id: 2,
          label: 'Independent',
          order: 1,
          lowerBound: -1,
          upperBound: 1,
          itemDifficultyPrior: 0,
        },
        {
          id: 3,
          label: 'Advanced',
          order: 2,
          lowerBound: 1,
          upperBound: Number.POSITIVE_INFINITY,
          itemDifficultyPrior: 2,
        },
      ],
    }
    const nodes = [
      node(1, null, 'COMPETENCE', 1),
      node(2, 1, 'SUBCOMPETENCE', 2),
      { ...node(3, null, 'COMPETENCE', 1), order: 1 },
      node(4, 3, 'SUBCOMPETENCE', 2),
    ]
    const pool: AdaptiveV2PoolItem[] = [2, 4].flatMap((leafNodeId, leafIndex) =>
      [-1, 1].map((difficulty, itemIndex) => ({
        id: leafIndex * 2 + itemIndex + 1,
        leafNodeId,
        nodePath: [leafNodeId === 2 ? 1 : 3, leafNodeId],
        levelId: difficulty < 0 ? 1 : 3,
        itemType: 'NUMERICAL' as const,
        choiceCount: null,
        model: 'TWO_PL' as const,
        calibrationId: `wide-grid-calibration-${leafIndex}-${itemIndex}`,
        contributesToEstimate: true,
        role: 'SCORING' as const,
        discrimination: 1.2,
        difficulty,
        guessing: 0,
      }))
    )
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale,
      pool,
      settings: {
        totalQuestionCap: 4,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 1,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        levelMappingRule: 'NEAREST',
        thetaRange: { min: -3, max: 3 },
        mode: 'DIAGNOSTIC',
        credibleMass: 0.9,
        classificationProbabilityThreshold: 0.8,
        minimumRootResponses: 1,
        researchPolicy: null,
      },
    })
    const startedAt = performance.now()
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'v2-performance-wide-grid',
      runtime,
      responses: [],
    })
    const elapsedMs = performance.now() - startedAt

    expect(decision.nextPoolItem).not.toBeNull()
    expect(elapsedMs).toBeLessThan(2_000)
  })
})

function depthFiveFixture(): {
  nodes: AdaptiveRuntimeNode[]
  scale: AdaptiveScaleDefinition
  pool: AdaptiveV2PoolItem[]
  settings: AdaptiveV2RuntimeSettings
} {
  const nodes: AdaptiveRuntimeNode[] = [
    node(1, null, 'COMPETENCE', 1),
    node(2, 1, 'SUBCOMPETENCE', 2),
    node(3, 2, 'SUBCOMPETENCE', 3),
    node(4, 3, 'SUBCOMPETENCE', 4),
    node(5, 4, 'SUBCOMPETENCE', 5),
  ]
  const pool = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1,
    leafNodeId: 5,
    nodePath: [1, 2, 3, 4, 5],
    levelId: (index % 3) + 1,
    itemType: 'NUMERICAL' as const,
    choiceCount: null,
    model: 'TWO_PL' as const,
    calibrationId: `performance-calibration-${index + 1}`,
    contributesToEstimate: true,
    role: 'SCORING' as const,
    discrimination: 1.2,
    difficulty: -2.5 + (5 * index) / 59,
    guessing: 0,
  }))
  return {
    nodes,
    scale: {
      priorMean: 0,
      priorStandardDeviation: 1,
      gridMin: -6,
      gridMax: 6,
      gridStep: 0.1,
      classificationPolicyVersion: 1,
      levels: [
        {
          id: 1,
          label: 'Foundation',
          order: 0,
          lowerBound: Number.NEGATIVE_INFINITY,
          upperBound: -1,
          itemDifficultyPrior: -2,
        },
        {
          id: 2,
          label: 'Independent',
          order: 1,
          lowerBound: -1,
          upperBound: 1,
          itemDifficultyPrior: 0,
        },
        {
          id: 3,
          label: 'Advanced',
          order: 2,
          lowerBound: 1,
          upperBound: Number.POSITIVE_INFINITY,
          itemDifficultyPrior: 2,
        },
      ],
    },
    pool,
    settings: {
      totalQuestionCap: 60,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST',
      thetaRange: { min: -3, max: 3 },
      mode: 'DIAGNOSTIC',
      credibleMass: 0.9,
      classificationProbabilityThreshold: 0.8,
      minimumRootResponses: 60,
      researchPolicy: null,
    },
  }
}

function node(
  id: number,
  parentId: number | null,
  kind: 'COMPETENCE' | 'SUBCOMPETENCE',
  depth: number
): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind,
    depth,
    order: 0,
    enabled: true,
    weight: parentId === null ? 1 : null,
    questionCap: null,
  }
}
