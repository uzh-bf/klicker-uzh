import * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveCohortAttemptRecord,
  type AdaptiveCohortRuntime,
  accumulateAdaptiveCohortAttempt,
  createAdaptiveCohortAccumulator,
  finalizeAdaptiveCohort,
} from '../src/services/adaptivePracticeQuizCohortAggregation.js'

const runtime = {
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
  tree: { nodes: [] },
  pool: [],
  algorithm: {
    nodes: [],
    levels: [
      { id: 1, order: 0, label: 'A1' },
      { id: 2, order: 1, label: 'A2' },
      { id: 3, order: 2, label: 'B1' },
    ],
    settings: {
      thetaRange: { min: -3, max: 3 },
      classificationZ: 1.28,
      levelMappingRule: 'NEAREST',
    },
  },
} as unknown as AdaptiveCohortRuntime

function attempt(
  theta: number | null,
  standardError = 0.2,
  levelId: number | null = 2
): AdaptiveCohortAttemptRecord {
  return {
    measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
    stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
    resultStatus: null,
    elapsedSeconds: 60,
    estimates: [
      {
        nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
        nodeId: null,
        theta,
        standardError,
        responseCount: 50,
        levelId,
        resultStatus: null,
      },
    ],
  }
}

describe('overall estimated level distribution', () => {
  it('includes precise and provisional capped estimates without changing stop summary', () => {
    const accumulator = createAdaptiveCohortAccumulator(runtime)
    for (const row of [attempt(0), attempt(1.4), attempt(null, 0.2, null)]) {
      accumulateAdaptiveCohortAttempt(runtime, accumulator, row, [])
    }
    const result = finalizeAdaptiveCohort(runtime, accumulator)
    expect(
      result.distributions[0]!.buckets.find((b) => b.levelOrder === 1)
    ).toMatchObject({ count: 2, determinedCount: 1 })
    expect(result.attemptSummary).toMatchObject({ classified: 0, capped: 3 })
  })

  it.each([NaN, Infinity])('excludes non-finite estimates (%s)', (theta) => {
    const accumulator = createAdaptiveCohortAccumulator(runtime)
    accumulateAdaptiveCohortAttempt(runtime, accumulator, attempt(theta), [])
    expect(
      finalizeAdaptiveCohort(
        runtime,
        accumulator
      ).distributions[0]!.buckets.every((b) => b.count === 0)
    ).toBe(true)
  })

  it('does not display research-only mapped estimates', () => {
    const accumulator = createAdaptiveCohortAccumulator(runtime)
    const row = attempt(0)
    row.resultStatus = DB.AdaptiveResultStatus.RESEARCH_ONLY
    accumulateAdaptiveCohortAttempt(runtime, accumulator, row, [])
    expect(
      finalizeAdaptiveCohort(
        runtime,
        accumulator
      ).distributions[0]!.buckets.every((b) => b.count === 0)
    ).toBe(true)
  })
  it('uses explicit calibrated status for versioned estimates', () => {
    const versioned = {
      ...runtime,
      publication: {
        ...runtime.publication,
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        cutScoreSnapshot: [{ sourceLevelId: 20, scaleLevelId: 2 }],
      },
    } as AdaptiveCohortRuntime
    const accumulator = createAdaptiveCohortAccumulator(versioned)
    for (const status of [
      DB.AdaptiveResultStatus.CLASSIFIED,
      DB.AdaptiveResultStatus.BETWEEN_LEVELS,
    ]) {
      const row = attempt(0, 0.2, 20)
      row.measurementVersion = DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
      row.resultStatus = status
      accumulateAdaptiveCohortAttempt(versioned, accumulator, row, [])
    }
    expect(
      finalizeAdaptiveCohort(
        versioned,
        accumulator
      ).distributions[0]!.buckets.find((b) => b.levelOrder === 1)
    ).toMatchObject({ count: 2, determinedCount: 1 })
  })

  it('keeps a precise estimate provisional when an enabled leaf has no responses', () => {
    const withLeaf = {
      ...runtime,
      tree: {
        nodes: [{ id: 10, parentId: null, name: 'Leaf', depth: 0, order: 0 }],
      },
      algorithm: {
        ...runtime.algorithm,
        nodes: [
          {
            id: 10,
            parentId: null,
            kind: 'SUBCOMPETENCE',
            enabled: true,
            depth: 0,
            order: 0,
          },
        ],
        settings: { ...runtime.algorithm.settings, minQuestionsPerLeaf: 4 },
      },
    } as unknown as AdaptiveCohortRuntime
    const accumulator = createAdaptiveCohortAccumulator(withLeaf)
    accumulateAdaptiveCohortAttempt(withLeaf, accumulator, attempt(0), [])
    expect(
      finalizeAdaptiveCohort(
        withLeaf,
        accumulator
      ).distributions[0]!.buckets.find((b) => b.levelOrder === 1)
    ).toMatchObject({ count: 1, determinedCount: 0 })
  })
  it('classifies each competence independently of other competence intervals', () => {
    const nodes = [10, 20].map((id) => ({
      id,
      parentId: null,
      kind: 'COMPETENCE',
      enabled: true,
      depth: 0,
      order: id,
      name: `Competence ${id}`,
    }))
    const scoped = {
      ...runtime,
      tree: { nodes },
      algorithm: {
        ...runtime.algorithm,
        nodes,
        settings: { ...runtime.algorithm.settings, minQuestionsPerLeaf: 0 },
      },
    } as unknown as AdaptiveCohortRuntime
    const accumulator = createAdaptiveCohortAccumulator(scoped)
    const row = attempt(0)
    row.estimates.push({
      ...row.estimates[0]!,
      nodeKind: DB.AdaptiveEstimateNodeKind.COMPETENCE,
      nodeId: 10,
    })
    row.estimates.push({
      ...row.estimates[0]!,
      nodeKind: DB.AdaptiveEstimateNodeKind.COMPETENCE,
      nodeId: 20,
      theta: 1.4,
    })
    accumulateAdaptiveCohortAttempt(scoped, accumulator, row, [])
    const result = finalizeAdaptiveCohort(scoped, accumulator)
    expect(
      result.distributions
        .find((d) => d.nodeId === 10)!
        .buckets.find((b) => b.levelOrder === 1)
    ).toMatchObject({ count: 1, determinedCount: 1 })
    expect(
      result.distributions
        .find((d) => d.nodeId === 20)!
        .buckets.find((b) => b.levelOrder === 1)
    ).toMatchObject({ count: 1, determinedCount: 0 })
  })

  it('requires only the covered descendants of each competence', () => {
    const nodes = [
      [10, null],
      [20, null],
      [11, 10],
      [12, 10],
      [21, 20],
    ].map(([id, parentId]) => ({
      id,
      parentId,
      kind: parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
      enabled: true,
      depth: parentId === null ? 0 : 1,
      order: 0,
      name: `Node ${id}`,
    }))
    const pool = [11, 12, 21].map((id) => ({
      id,
      leafNodeId: id,
      difficulty: 0,
      discrimination: 1.2,
      guessing: 0.25,
      nodePath: [id === 21 ? 20 : 10, id],
      elementName: 'Synthetic',
      elementType: 'SC',
      nodeNamePath: [],
      levelLabel: 'A2',
    }))
    const scoped = {
      ...runtime,
      pool,
      tree: { nodes },
      algorithm: {
        ...runtime.algorithm,
        nodes,
        settings: { ...runtime.algorithm.settings, minQuestionsPerLeaf: 1 },
      },
    } as unknown as AdaptiveCohortRuntime
    const accumulator = createAdaptiveCohortAccumulator(scoped)
    const row = attempt(0)
    for (const nodeId of [10, 20, 11, 12, 21])
      row.estimates.push({
        ...row.estimates[0]!,
        nodeKind:
          nodeId <= 20 && nodeId % 10 === 0
            ? DB.AdaptiveEstimateNodeKind.COMPETENCE
            : DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
        nodeId,
      })
    accumulateAdaptiveCohortAttempt(scoped, accumulator, row, [
      { correct: true, poolItemId: 11 },
      { correct: true, poolItemId: 21 },
    ])
    const result = finalizeAdaptiveCohort(scoped, accumulator)
    for (const [id, determinedCount] of [
      [10, 0],
      [20, 1],
      [11, 1],
      [12, 0],
      [21, 1],
    ]) {
      expect(
        result.distributions
          .find((d) => d.nodeId === id)!
          .buckets.find((b) => b.levelOrder === 1)
      ).toMatchObject({ count: 1, determinedCount })
    }
  })
  it('reports untested subcompetences separately and never as estimates', () => {
    const sampled = {
      ...runtime,
      tree: {
        nodes: [
          { id: 1, parentId: null, name: 'Root', depth: 1, order: 0 },
          { id: 11, parentId: 1, name: 'Tested', depth: 2, order: 0 },
          { id: 12, parentId: 1, name: 'Sampled out', depth: 2, order: 1 },
        ],
      },
      algorithm: {
        ...runtime.algorithm,
        nodes: [
          [1, null, 'COMPETENCE'],
          [11, 1, 'SUBCOMPETENCE'],
          [12, 1, 'SUBCOMPETENCE'],
        ].map(([id, parentId, kind], order) => ({
          id,
          parentId,
          kind,
          enabled: true,
          depth: parentId === null ? 1 : 2,
          order,
          weight: parentId === null ? 1 : null,
          questionCap: null,
        })),
        settings: { ...runtime.algorithm.settings, minQuestionsPerLeaf: 2 },
      },
    } as unknown as AdaptiveCohortRuntime
    const node = (
      nodeId: number,
      nodeKind: DB.AdaptiveEstimateNodeKind,
      responseCount: number
    ) => ({
      nodeKind,
      nodeId,
      theta: responseCount > 0 ? 0 : null,
      standardError: responseCount > 0 ? 0.2 : null,
      responseCount,
      levelId: responseCount > 0 ? 2 : null,
      resultStatus: null,
    })
    const accumulator = createAdaptiveCohortAccumulator(sampled)
    for (let index = 0; index < 3; index++) {
      const row = attempt(0)
      row.estimates.push(
        node(1, DB.AdaptiveEstimateNodeKind.COMPETENCE, 4),
        node(11, DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE, 4)
      )
      // The second subcompetence has a zero-response estimate in one attempt
      // and no estimate at all in the others.
      if (index === 0) {
        row.estimates.push(
          node(12, DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE, 0)
        )
      }
      accumulateAdaptiveCohortAttempt(sampled, accumulator, row, [])
    }
    const byNode = new Map(
      finalizeAdaptiveCohort(sampled, accumulator).distributions.map(
        (distribution) => [distribution.nodeId, distribution]
      )
    )
    expect(byNode.get(12)).toMatchObject({
      notTestedCount: 3,
      insufficientDataCount: 3,
    })
    expect(byNode.get(12)!.buckets.every(({ count }) => count === 0)).toBe(true)
    expect(byNode.get(11)).toMatchObject({ notTestedCount: 0 })
    expect(byNode.get(1)).toMatchObject({ notTestedCount: 0 })
    expect(byNode.get(null)).toMatchObject({ notTestedCount: 0 })
  })
})
