import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  type AdaptiveCohortAttemptRecord,
  type AdaptiveCohortRuntime,
  accumulateAdaptiveCohortAttempt,
  createAdaptiveCohortAccumulator,
  finalizeAdaptiveCohort,
} from '../src/services/adaptivePracticeQuizCohortAggregation.js'
import { markClassifiedAdaptiveRootEstimates } from '../src/services/adaptivePracticeQuizEstimatePersistence.js'
import type {
  AdaptiveRuntimeEstimates,
  AdaptiveRuntimeNode,
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeRoutingPoolItem,
} from '../src/services/adaptivePracticeQuizRuntime.js'
import type { LoadedAdaptiveRuntime } from '../src/services/adaptivePracticeQuizRuntimeData.js'
import {
  hasAdaptiveV1LeafBreadth,
  resolveAdaptiveV1LeafCoverage,
} from '../src/services/adaptivePracticeQuizSamplingCoverage.js'

// Synthetic topology: root 1 > leaves 11, 12, 13; root 2 > leaf 21.
// Every leaf has two pool items, so the all-leaf minimum coverage is 8.
function node(id: number, parentId: number | null): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
    depth: parentId === null ? 1 : 2,
    order: id,
    enabled: true,
    weight: parentId === null ? 0.5 : null,
    questionCap: null,
  }
}
const nodes = [
  node(1, null),
  node(11, 1),
  node(12, 1),
  node(13, 1),
  node(2, null),
  node(21, 2),
]
const rootOf: Record<number, number> = { 11: 1, 12: 1, 13: 1, 21: 2 }
function poolItem(
  id: number,
  leafNodeId: number,
  additionalLeafNodeIds: number[] = []
) {
  return {
    id,
    leafNodeId,
    nodePath: [rootOf[leafNodeId]!, leafNodeId],
    additionalLeafNodeIds,
    levelId: 1,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0.25,
  } as unknown as AdaptiveRuntimeRoutingPoolItem
}
const pool = [11, 12, 13, 21].flatMap((leaf) => [
  poolItem(leaf * 10, leaf),
  poolItem(leaf * 10 + 1, leaf),
])
const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Advanced', order: 1 },
]
function settings(totalQuestionCap: number) {
  return {
    totalQuestionCap,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 2,
    classificationZ: 0.01,
    topInformationRatio: 0.8,
    levelMappingRule: 'NEAREST' as const,
    thetaRange: { min: -3, max: 3 },
  }
}
// Cap 4 < coverage 8: sampling active. Cap 20 >= 8: no sampling.
const SAMPLING_CAP = 4
const FULL_CAP = 20

function runtime(
  totalQuestionCap: number,
  items: AdaptiveRuntimeRoutingPoolItem[] = pool
) {
  return {
    algorithm: { nodes, levels, settings: settings(totalQuestionCap) },
    pool: items,
  } as unknown as LoadedAdaptiveRuntime
}
function responses(items: AdaptiveRuntimeRoutingPoolItem[]) {
  return items.map(
    (item, index): AdaptiveRuntimeResponse => ({
      order: index + 1,
      poolItemId: item.id,
      poolItem: item,
      correct: true,
    })
  )
}
function rootEstimates(
  stopReason: 'TOTAL_QUESTION_CAP' | 'CLASSIFIED' = 'TOTAL_QUESTION_CAP'
): AdaptiveRuntimeEstimates {
  return {
    overall: {
      nodeKind: 'OVERALL',
      nodeId: null,
      theta: -2,
      standardError: 0.1,
      responseCount: 2,
      levelId: 1,
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
          // At least MIN_REPORTING_RESPONSES, so only breadth decides.
          responseCount: 4,
          levelId: 1,
          stopReason,
        },
      ],
    ]),
  }
}
const item = (id: number) => pool.find((entry) => entry.id === id)!
const enabledIds = new Set(nodes.map(({ id }) => id))

describe('IRT_V1 sampling activation and breadth', () => {
  it('activates sampling only when the leaf coverage exceeds the cap', () => {
    expect(resolveAdaptiveV1LeafCoverage(runtime(7), enabledIds).sampling).toBe(
      true
    )
    expect(resolveAdaptiveV1LeafCoverage(runtime(8), enabledIds).sampling).toBe(
      false
    )
  })

  it('caps leaf coverage at the eligible items and counts mapped leaves', () => {
    const coverage = resolveAdaptiveV1LeafCoverage(
      runtime(SAMPLING_CAP, [poolItem(1, 11, [12]), poolItem(2, 21)]),
      enabledIds
    )
    expect(Object.fromEntries(coverage.coverageByLeaf)).toEqual({
      11: 1,
      12: 1,
      13: 0,
      21: 1,
    })
  })

  it('ignores unanswered leaves only under sampling', () => {
    const leafCounts = new Map([[11, 2]])
    const coverage = resolveAdaptiveV1LeafCoverage(
      runtime(SAMPLING_CAP),
      enabledIds
    )
    const input = { leafIds: [11, 12, 13], leafCounts, minQuestionsPerLeaf: 2 }
    expect(hasAdaptiveV1LeafBreadth({ ...input, coverage })).toBe(true)
    expect(
      hasAdaptiveV1LeafBreadth({
        ...input,
        coverage: { ...coverage, sampling: false },
      })
    ).toBe(false)
    expect(
      hasAdaptiveV1LeafBreadth({
        ...input,
        leafCounts: new Map([
          [11, 2],
          [12, 1],
        ]),
        coverage,
      })
    ).toBe(false)
    expect(
      hasAdaptiveV1LeafBreadth({ ...input, leafCounts: new Map(), coverage })
    ).toBe(false)
  })
})

describe('markClassifiedAdaptiveRootEstimates under sampling', () => {
  it('classifies a sampled root on its sampled leaves', () => {
    const estimates = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(SAMPLING_CAP),
      responses([item(110), item(111)]),
      estimates
    )
    expect(estimates.nodes.get(1)?.stopReason).toBe('CLASSIFIED')
  })

  it('does not classify when a sampled leaf lacks its minimum', () => {
    const estimates = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(SAMPLING_CAP),
      responses([item(110), item(111), item(120)]),
      estimates
    )
    expect(estimates.nodes.get(1)?.stopReason).toBe('TOTAL_QUESTION_CAP')
  })

  it('keeps the all-leaves rule when the quiz is not sampling', () => {
    const partial = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(FULL_CAP),
      responses([item(110), item(111)]),
      partial
    )
    expect(partial.nodes.get(1)?.stopReason).toBe('TOTAL_QUESTION_CAP')

    const complete = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(FULL_CAP),
      responses([110, 111, 120, 121, 130, 131].map(item)),
      complete
    )
    expect(complete.nodes.get(1)?.stopReason).toBe('CLASSIFIED')
  })

  it('counts multi-leaf items for every mapped leaf', () => {
    const multi = [poolItem(901, 11, [12]), poolItem(902, 11, [12])]
    const answered = [...multi, item(130), item(131)]
    const mapped = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(FULL_CAP, [...pool, ...multi]),
      responses(answered),
      mapped
    )
    expect(mapped.nodes.get(1)?.stopReason).toBe('CLASSIFIED')

    // Under sampling, an extra mapped leaf answered once is a sampled leaf
    // below its minimum, so the root stays unclassified.
    const partial = rootEstimates()
    markClassifiedAdaptiveRootEstimates(
      runtime(SAMPLING_CAP, [...pool, ...multi]),
      responses([poolItem(901, 11, [12]), item(110)]),
      partial
    )
    expect(partial.nodes.get(1)?.stopReason).toBe('TOTAL_QUESTION_CAP')
  })

  it('keeps an engine classification as is', () => {
    const estimates = rootEstimates('CLASSIFIED')
    markClassifiedAdaptiveRootEstimates(runtime(SAMPLING_CAP), [], estimates)
    expect(estimates.nodes.get(1)?.stopReason).toBe('CLASSIFIED')
  })
})

describe('cohort determined counts under sampling', () => {
  function cohortRuntime(totalQuestionCap: number) {
    return {
      quiz: { id: 'quiz' },
      config: { id: 'config', attemptSelectionPolicy: 'LATEST' },
      publication: {
        id: 'publication',
        scaleVersionId: 'scale',
        measurementVersion: 'IRT_V1',
        retakePolicy: 'LATEST',
        cutScoreSnapshot: [],
        hierarchicalWeightSnapshot: [],
      },
      tree: {
        nodes: nodes.map(({ id, parentId, depth, order }) => ({
          id,
          parentId,
          name: `Node ${id}`,
          depth,
          order,
        })),
      },
      pool,
      algorithm: { nodes, levels, settings: settings(totalQuestionCap) },
    } as unknown as AdaptiveCohortRuntime
  }
  function attempt(
    stopReason: DB.AdaptivePracticeQuizStopReason | null = null
  ): AdaptiveCohortAttemptRecord {
    const estimate = (
      nodeKind: DB.AdaptiveEstimateNodeKind,
      nodeId: number | null
    ) => ({
      nodeKind,
      nodeId,
      theta: -2,
      standardError: 0.1,
      responseCount: 4,
      levelId: 1,
      resultStatus: null,
      stopReason: nodeId === 1 ? stopReason : null,
    })
    return {
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
      resultStatus: null,
      elapsedSeconds: 60,
      estimates: [
        estimate(DB.AdaptiveEstimateNodeKind.OVERALL, null),
        estimate(DB.AdaptiveEstimateNodeKind.COMPETENCE, 1),
        estimate(DB.AdaptiveEstimateNodeKind.COMPETENCE, 2),
      ],
    }
  }
  function determined(
    totalQuestionCap: number,
    answered: number[],
    stopReason: DB.AdaptivePracticeQuizStopReason | null = null
  ) {
    const cohort = cohortRuntime(totalQuestionCap)
    const accumulator = createAdaptiveCohortAccumulator(cohort)
    accumulateAdaptiveCohortAttempt(
      cohort,
      accumulator,
      attempt(stopReason),
      answered.map((poolItemId) => ({ correct: true, poolItemId }))
    )
    const byNode = new Map(
      finalizeAdaptiveCohort(cohort, accumulator).distributions.map(
        (distribution) => [
          distribution.nodeId,
          distribution.buckets.reduce(
            (sum, bucket) => sum + (bucket.determinedCount ?? 0),
            0
          ),
        ]
      )
    )
    return {
      root1: byNode.get(1),
      root2: byNode.get(2),
      overall: byNode.get(null),
    }
  }

  it('determines sampled roots on the leaves that received responses', () => {
    expect(determined(SAMPLING_CAP, [110, 111, 210, 211])).toEqual({
      root1: 1,
      root2: 1,
      overall: 1,
    })
  })

  it('keeps the all-leaves rule when the quiz is not sampling', () => {
    expect(determined(FULL_CAP, [110, 111, 210, 211])).toEqual({
      root1: 0,
      root2: 1,
      overall: 0,
    })
  })

  it('trusts an engine-classified root under sampling only', () => {
    const classified = DB.AdaptivePracticeQuizStopReason.CLASSIFIED
    expect(determined(SAMPLING_CAP, [110], classified).root1).toBe(1)
    expect(determined(FULL_CAP, [110], classified).root1).toBe(0)
  })
})
