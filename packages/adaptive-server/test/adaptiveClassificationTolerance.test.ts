import {
  classificationIntervalWithinLevelBand,
  intervalWithinToleranceBands,
  mapLevelsToTheta,
} from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  type AdaptiveCohortRuntime,
  accumulateAdaptiveCohortAttempt,
  createAdaptiveCohortAccumulator,
  finalizeAdaptiveCohort,
} from '../src/services/adaptivePracticeQuizCohortAggregation.js'
import {
  assertClassificationToleranceSupported,
  resolvePresetSettings,
} from '../src/services/adaptivePracticeQuizConfigSettings.js'
import { assertAdaptiveEngineSupportsClassificationTolerance } from '../src/services/adaptivePracticeQuizEngineCapabilities.js'
import { markClassifiedAdaptiveRootEstimates } from '../src/services/adaptivePracticeQuizEstimatePersistence.js'
import { v1EngineSettings } from '../src/services/adaptivePracticeQuizEstimatorVersions.js'
import { createAdaptiveV1LevelDetermination } from '../src/services/adaptivePracticeQuizLevelDetermination.js'
import { countClassifiableLevels } from '../src/services/adaptivePracticeQuizReachability.js'
import type {
  AdaptiveRuntimeEstimates,
  AdaptiveRuntimeRoutingPoolItem,
} from '../src/services/adaptivePracticeQuizRuntime.js'
import type { LoadedAdaptiveRuntime } from '../src/services/adaptivePracticeQuizRuntimeData.js'

// Four NEAREST levels on [-3, 3]: bands (-∞,-2) [-2,0) [0,2) [2,∞).
const levels = [0, 1, 2, 3].map((order) => ({
  id: order + 1,
  label: `L${order}`,
  order,
}))
const range = { min: -3, max: 3 }

describe('tolerance band rule', () => {
  const bands = mapLevelsToTheta(levels, range, 'NEAREST')
  const within = (theta: number, se: number, toleranceBands: number) =>
    intervalWithinToleranceBands({
      theta,
      lower: theta - se,
      upper: theta + se,
      bands,
      toleranceBands,
    })

  it('is identical to the single-band rule for t = 0', () => {
    for (let theta = -4; theta <= 4; theta += 0.37) {
      for (const se of [0, 0.2, 0.5, 0.9, 1.4, 3]) {
        const singleBand = bands.some(
          (band) =>
            theta - se >= band.lowerBound && theta + se < band.upperBound
        )
        expect(within(theta, se, 0)).toBe(singleBand)
        expect(
          classificationIntervalWithinLevelBand({
            theta,
            standardError: se,
            levels,
            range,
            z: 1,
          })
        ).toBe(singleBand)
      }
    }
  })

  it('accepts neighbouring bands within ±t, clipped at both ends', () => {
    expect(within(-0.5, 1, 0)).toBe(false)
    expect(within(-0.5, 1, 1)).toBe(true)
    // Bottom band: k − t is clipped to the first band.
    expect(within(-2.5, 3, 1)).toBe(false)
    expect(within(-2.5, 3, 2)).toBe(true)
    expect(
      classificationIntervalWithinLevelBand({
        theta: -0.5,
        standardError: 1,
        levels,
        range,
        z: 1,
        toleranceBands: 1,
      })
    ).toBe(true)
  })
})

describe('classification tolerance settings', () => {
  const treeDefaults = {
    defaultDiscrimination: 1.2,
    defaultTotalQuestionCap: 50,
    defaultTimeLimitSeconds: null,
  }
  const resolve = (classificationToleranceBands?: number) =>
    resolvePresetSettings(
      {
        competenceTreeId: 'tree',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        classificationToleranceBands,
      },
      treeDefaults
    )

  it('defaults to the exact rule and accepts 0–5', () => {
    expect(resolve().classificationToleranceBands).toBe(0)
    expect(resolve(5).classificationToleranceBands).toBe(5)
    for (const invalid of [-1, 6, 1.5])
      expect(() => resolve(invalid)).toThrow(
        expect.objectContaining({
          extensions: { code: 'ADAPTIVE_CLASSIFICATION_TOLERANCE_INVALID' },
        })
      )
  })

  it('rejects a tolerance for IRT v2 configurations', () => {
    expect(() =>
      assertClassificationToleranceSupported(
        DB.AdaptiveMeasurementVersion.IRT_V1,
        { classificationToleranceBands: 2 }
      )
    ).not.toThrow()
    expect(() =>
      assertClassificationToleranceSupported(
        DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        { classificationToleranceBands: 0 }
      )
    ).not.toThrow()
    expect(() =>
      assertClassificationToleranceSupported(
        DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        { classificationToleranceBands: 1 }
      )
    ).toThrow(
      expect.objectContaining({
        extensions: { code: 'ADAPTIVE_CLASSIFICATION_TOLERANCE_UNSUPPORTED' },
      })
    )
  })

  it('sends the tolerance to the engine only when above 0', () => {
    const settings = {
      totalQuestionCap: 20,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 2,
      classificationZ: 1,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST' as const,
      thetaRange: range,
    }
    expect(
      'classificationToleranceBands' in
        v1EngineSettings({ ...settings, classificationToleranceBands: 0 })
    ).toBe(false)
    expect(v1EngineSettings(settings)).toEqual(settings)
    expect(
      v1EngineSettings({ ...settings, classificationToleranceBands: 1 })
        .classificationToleranceBands
    ).toBe(1)
  })
})

describe('engine support guard for a tolerance', () => {
  const engine = (rejectTolerance: boolean, unavailable = false) => ({
    calls: [] as unknown[],
    async validate(request: { settings: Record<string, unknown> }) {
      this.calls.push(request.settings.classificationToleranceBands)
      if (unavailable) throw new Error('down')
      if (rejectTolerance && 'classificationToleranceBands' in request.settings)
        throw new Error('invalid')
      return {
        contractVersion: 1 as const,
        measurementVersion: 'IRT_V1' as const,
        valid: true as const,
      }
    },
  })

  it('does not probe the engine for the exact rule', async () => {
    const validator = engine(true)
    await assertAdaptiveEngineSupportsClassificationTolerance(0, validator)
    expect(validator.calls).toEqual([])
  })

  it('accepts an engine that supports the setting', async () => {
    const validator = engine(false)
    await assertAdaptiveEngineSupportsClassificationTolerance(1, validator)
    expect(validator.calls).toEqual([undefined, 1])
  })

  it('reports an older engine with a clear unsupported error', async () => {
    await expect(
      assertAdaptiveEngineSupportsClassificationTolerance(1, engine(true))
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_CLASSIFICATION_TOLERANCE_UNSUPPORTED' },
    })
    await expect(
      assertAdaptiveEngineSupportsClassificationTolerance(1, engine(true, true))
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ENGINE_UNAVAILABLE' },
    })
  })
})

describe('readiness classifiable bands under tolerance', () => {
  const configured = mapLevelsToTheta(levels, range, 'NEAREST').map(
    ({ id, theta, lowerBound, upperBound }) => ({
      id,
      theta,
      lowerBound,
      upperBound,
    })
  )
  // Information 1 everywhere: the planning half-width is z = 1.
  const thetaGrid = [-2.5, -1, 1, 2.5]
  const count = (toleranceBands: number) =>
    countClassifiableLevels({
      levels: configured,
      thetaRange: range,
      thetaGrid,
      information: [1, 1, 1, 1],
      classificationZ: 1,
      toleranceBands,
    })

  it('counts bands classifiable within ±t', () => {
    expect(count(0)).toBe(0)
    expect(count(1)).toBe(4)
  })
})

// One root (1) with one leaf (11) and two items: breadth is satisfied by two
// answers, so only the interval rule decides.
const nodes = [
  {
    id: 1,
    parentId: null,
    kind: 'COMPETENCE' as const,
    depth: 1,
    order: 0,
    enabled: true,
    weight: 1,
    questionCap: null,
  },
  {
    id: 11,
    parentId: 1,
    kind: 'SUBCOMPETENCE' as const,
    depth: 2,
    order: 0,
    enabled: true,
    weight: null,
    questionCap: null,
  },
]
const pool = [110, 111].map(
  (id) =>
    ({
      id,
      leafNodeId: 11,
      nodePath: [1, 11],
      levelId: 2,
      discrimination: 1.2,
      difficulty: 0,
      guessing: 0.25,
    }) as unknown as AdaptiveRuntimeRoutingPoolItem
)
function settings(classificationToleranceBands: number) {
  return {
    totalQuestionCap: 20,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 2,
    classificationZ: 1,
    topInformationRatio: 0.8,
    levelMappingRule: 'NEAREST' as const,
    thetaRange: range,
    classificationToleranceBands,
  }
}
function runtime(classificationToleranceBands: number) {
  return {
    pool,
    algorithm: {
      nodes,
      levels,
      settings: settings(classificationToleranceBands),
    },
  } as unknown as LoadedAdaptiveRuntime
}
// θ = -0.5 ± 1 spans bands 1 and 2.
const estimate = {
  theta: -0.5,
  standardError: 1,
  responseCount: 4,
  levelId: 2,
}

describe('host classification under tolerance', () => {
  function rootEstimates(): AdaptiveRuntimeEstimates {
    return {
      overall: {
        ...estimate,
        nodeKind: 'OVERALL',
        nodeId: null,
        stopReason: 'TOTAL_QUESTION_CAP',
      },
      nodes: new Map([
        [
          1,
          {
            ...estimate,
            nodeKind: 'COMPETENCE',
            nodeId: 1,
            stopReason: 'TOTAL_QUESTION_CAP',
          },
        ],
      ]),
    }
  }
  const responses = pool.map((poolItem, index) => ({
    order: index + 1,
    poolItemId: poolItem.id,
    poolItem,
    correct: true,
  }))

  it('classifies a root within ±1 only when the quiz tolerance allows it', () => {
    const exact = rootEstimates()
    markClassifiedAdaptiveRootEstimates(runtime(0), responses, exact)
    expect(exact.nodes.get(1)?.stopReason).toBe('TOTAL_QUESTION_CAP')
    const tolerant = rootEstimates()
    markClassifiedAdaptiveRootEstimates(runtime(1), responses, tolerant)
    expect(tolerant.nodes.get(1)?.stopReason).toBe('CLASSIFIED')
  })

  it('determines the same nodes for the student result', () => {
    for (const [tolerance, expected] of [
      [0, false],
      [1, true],
    ] as const) {
      const determination = createAdaptiveV1LevelDetermination({
        runtime: runtime(tolerance),
        answeredPoolItemIds: [110, 111],
        coverageStatusByLeaf: new Map(),
      })
      expect(determination.isDetermined(1, estimate)).toBe(expected)
      expect(determination.isDetermined(null, estimate)).toBe(expected)
    }
    // Without breadth the level is not determined, whatever the interval.
    const withoutBreadth = createAdaptiveV1LevelDetermination({
      runtime: runtime(1),
      answeredPoolItemIds: [110],
      coverageStatusByLeaf: new Map(),
    })
    expect(withoutBreadth.isDetermined(1, estimate)).toBe(false)
  })

  it('counts cohort determined levels with the same tolerance', () => {
    const determined = (tolerance: number) => {
      const cohort = {
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
        algorithm: { nodes, levels, settings: settings(tolerance) },
      } as unknown as AdaptiveCohortRuntime
      const accumulator = createAdaptiveCohortAccumulator(cohort)
      const row = (
        nodeKind: DB.AdaptiveEstimateNodeKind,
        nodeId: number | null
      ) => ({ ...estimate, nodeKind, nodeId, resultStatus: null })
      accumulateAdaptiveCohortAttempt(
        cohort,
        accumulator,
        {
          measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
          resultStatus: null,
          elapsedSeconds: 60,
          estimates: [
            row(DB.AdaptiveEstimateNodeKind.OVERALL, null),
            row(DB.AdaptiveEstimateNodeKind.COMPETENCE, 1),
          ],
        },
        [110, 111].map((poolItemId) => ({ correct: true, poolItemId }))
      )
      const root = finalizeAdaptiveCohort(
        cohort,
        accumulator
      ).distributions.find(({ nodeId }) => nodeId === 1)
      return {
        determinedLevels: root?.buckets.reduce(
          (sum, bucket) => sum + (bucket.determinedCount ?? 0),
          0
        ),
        // The attempt summary counts the overall level with the same rule,
        // separately from the stop reason.
        overallDetermined:
          accumulator.classifications[DB.AdaptiveResultStatus.CLASSIFIED],
        stoppedClassified: accumulator.classified,
        bucketsWithElements: root?.buckets
          .filter(({ hasElements }) => hasElements)
          .map(({ levelOrder }) => levelOrder),
      }
    }
    expect(determined(0)).toMatchObject({
      determinedLevels: 0,
      overallDetermined: 0,
      stoppedClassified: 0,
    })
    expect(determined(1)).toMatchObject({
      determinedLevels: 1,
      overallDetermined: 1,
      stoppedClassified: 0,
    })
    expect(determined(1).bucketsWithElements).toEqual(
      [...new Set(pool.map(({ levelId }) => levelId - 1))].sort()
    )
  })
})
