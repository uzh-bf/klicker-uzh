import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_V2_EXPOSURE_CEILING,
  AdaptiveRuntimeConfigurationError,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeResponse,
  type AdaptiveScaleDefinition,
  type AdaptiveV2PoolItem,
  type AdaptiveV2RuntimeSettings,
  advanceAdaptiveV2Runtime,
  deriveGuessingParameter,
  expectedPosteriorInformation,
  prepareAdaptiveV2Runtime,
} from '../src/index.js'

describe('hierarchical Bayesian adaptive runtime', () => {
  it('propagates each response exactly once through a depth-five hierarchy', () => {
    const nodes = depthFiveNodes()
    const pool = depthFivePool()
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale: standardScale(),
      pool,
      settings: diagnosticSettings(),
    })
    const responses = [
      response(pool[0]!, 1, true),
      response(pool[1]!, 2, false),
      response(pool[4]!, 3, true),
      response(pool[5]!, 4, false),
    ]

    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-depth-five',
      runtime,
      responses,
    })

    expect(decision.estimates.nodes.get(5)?.responseCount).toBe(2)
    expect(decision.estimates.nodes.get(6)?.responseCount).toBe(2)
    expect(decision.estimates.nodes.get(4)?.responseCount).toBe(4)
    expect(decision.estimates.nodes.get(1)?.responseCount).toBe(4)
    expect(decision.estimates.overall.responseCount).toBe(4)
    expect(runtime.effectiveLeafWeights.get(5)).toBeCloseTo(0.75, 12)
    expect(runtime.effectiveLeafWeights.get(6)).toBeCloseTo(0.25, 12)
  })

  it('serves missing evidence before following hierarchical allocation deficits', () => {
    const nodes = weightedLeaves()
    const pool = weightedLeafPool()
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale: standardScale(),
      pool,
      settings: diagnosticSettings(),
    })

    const first = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-allocation',
      runtime,
      responses: [],
    })
    expect(first.nextPoolItem?.leafNodeId).toBe(2)

    const responses = [response(first.nextPoolItem!, 1, true)]
    const second = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-allocation',
      runtime,
      responses,
    })
    expect(second.nextPoolItem?.leafNodeId).toBe(3)

    responses.push(response(second.nextPoolItem!, 2, true))
    const third = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-allocation',
      runtime,
      responses,
    })
    expect(third.nextPoolItem?.leafNodeId).toBe(2)
  })

  it('gives every enabled root evidence before returning to a heavier root', () => {
    const nodes = [
      root(1, 0, 9),
      leaf(2, 1, 0, 2),
      root(3, 1, 1),
      leaf(4, 3, 0, 2),
    ]
    const pool = [
      ...Array.from({ length: 4 }, (_, index) =>
        scoringItem({
          id: index + 1,
          leafId: 2,
          path: [1, 2],
          levelId: 2,
          difficulty: 0,
        })
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        scoringItem({
          id: index + 5,
          leafId: 4,
          path: [3, 4],
          levelId: 2,
          difficulty: 0,
        })
      ),
    ]
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale: standardScale(),
      pool,
      settings: diagnosticSettings(),
    })
    const first = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-root-breadth',
      runtime,
      responses: [],
    }).nextPoolItem!
    expect(first.leafNodeId).toBe(2)

    const second = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-root-breadth',
      runtime,
      responses: [response(first, 1, true)],
    }).nextPoolItem!
    expect(second.leafNodeId).toBe(4)
  })

  it('rejects a zero weight on any enabled root', () => {
    const nodes = [
      root(1, 0, 0),
      leaf(2, 1, 0, 2),
      root(3, 1, 1),
      leaf(4, 3, 0, 2),
    ]
    const pool = [
      scoringItem({
        id: 1,
        leafId: 2,
        path: [1, 2],
        levelId: 2,
        difficulty: 0,
      }),
      scoringItem({
        id: 2,
        leafId: 4,
        path: [3, 4],
        levelId: 2,
        difficulty: 0,
      }),
    ]

    expect(() =>
      prepareAdaptiveV2Runtime({
        nodes,
        scale: standardScale(),
        pool,
        settings: diagnosticSettings(),
      })
    ).toThrowError(AdaptiveRuntimeConfigurationError)
  })

  it('respects ancestor caps and reports the cap stop explicitly', () => {
    const nodes = weightedLeaves()
    nodes[0]!.questionCap = 1
    const pool = weightedLeafPool()
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale: standardScale(),
      pool,
      settings: diagnosticSettings(),
    })
    const first = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-cap',
      runtime,
      responses: [],
    }).nextPoolItem!
    const terminal = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-cap',
      runtime,
      responses: [response(first, 1, true)],
    })

    expect(terminal.nextPoolItem).toBeNull()
    expect(terminal.stopReason).toBe('NODE_QUESTION_CAP')
    expect(terminal.resultStatus).toBe('POOL_LIMITED')
  })

  it('rejects non-calibrated Diagnostic pools before delivery', () => {
    const pool = weightedLeafPool()
    pool[0] = {
      ...pool[0]!,
      calibrationId: 'calibration-field-test',
      contributesToEstimate: false,
      role: 'FIELD_TEST',
    }

    expect(() =>
      prepareAdaptiveV2Runtime({
        nodes: weightedLeaves(),
        scale: standardScale(),
        pool,
        settings: diagnosticSettings(),
      })
    ).toThrowError(
      'Diagnostic pools may contain only calibrated scoring items.'
    )
  })

  it('excludes Research field tests from EAP and final classification', () => {
    const runtime = researchRuntime({ totalQuestionCap: 4 })
    const fieldTest = runtime.pool.find(({ role }) => role === 'FIELD_TEST')!
    const anchorResponses = [
      response(researchAnchor(runtime.pool, 1), 1, true),
      response(researchAnchor(runtime.pool, 2), 2, false),
      response(researchAnchor(runtime.pool, 3), 3, true),
    ]
    const beforeFieldTest = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-research-field',
      runtime,
      responses: anchorResponses,
    })
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-research-field',
      runtime,
      responses: [...anchorResponses, response(fieldTest, 4, true)],
    })

    expect(decision.stopReason).toBe('TOTAL_QUESTION_CAP')
    expect(decision.resultStatus).toBe('RESEARCH_ONLY')
    expect(decision.estimates.overall.responseCount).toBe(3)
    expect(decision.estimates.overall.administeredResponseCount).toBe(4)
    expect(decision.estimates.overall.posterior.mean).toBeCloseTo(
      beforeFieldTest.estimates.overall.posterior.mean,
      12
    )
    expect(decision.estimates.overall.classifiedLevelId).toBeNull()
  })

  it('rejects field-test histories that bypass mandatory Research anchors', () => {
    const runtime = researchRuntime({ totalQuestionCap: 4 })
    const fieldTest = runtime.pool.find(({ role }) => role === 'FIELD_TEST')!

    expect(() =>
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-research-invalid-history',
        runtime,
        responses: [response(fieldTest, 1, true)],
      })
    ).toThrowError(
      'Research response history violates mandatory anchor ordering.'
    )
  })

  it('satisfies Research anchors before randomized field-test inclusion', () => {
    const runtime = researchRuntime()
    const first = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-research-first',
      runtime,
      responses: [],
    })
    expect(first.nextPoolItem?.role).toBe('ANCHOR')
    expect(first.nextPoolItem?.levelId).toBe(1)

    const anchorResponses = [
      response(researchAnchor(runtime.pool, 1), 1, true),
      response(researchAnchor(runtime.pool, 2), 2, false),
      response(researchAnchor(runtime.pool, 3), 3, true),
    ]
    const roles = new Set<string>()
    for (let index = 0; index < 64; index++) {
      const decision = advanceAdaptiveV2Runtime({
        attemptId: `attempt-research-random-${index}`,
        runtime,
        responses: anchorResponses,
      })
      roles.add(decision.nextPoolItem!.role)
      expect(decision.selection?.collectionDesignVersion).toBe(
        'RESEARCH_DESIGN_V1'
      )
      const selectedRoleIsFieldTest =
        decision.nextPoolItem!.role === 'FIELD_TEST'
      const roleCandidates = runtime.pool.filter(
        (item) =>
          !anchorResponses.some(({ poolItemId }) => poolItemId === item.id) &&
          (selectedRoleIsFieldTest
            ? item.role === 'FIELD_TEST'
            : item.role !== 'FIELD_TEST')
      )
      const posterior = decision.estimates.nodes.get(2)!.posterior
      const information = roleCandidates.map((item) =>
        expectedPosteriorInformation({ posterior, item })
      )
      const maximumInformation = Math.max(...information)
      const approvedCandidates = roleCandidates
        .filter(
          (_, candidateIndex) =>
            information[candidateIndex]! >= maximumInformation * 0.8
        )
        .sort((left, right) => left.id - right.id)
      const selectedIndex = approvedCandidates.findIndex(
        ({ id }) => id === decision.nextPoolItem!.id
      )
      const drawSpan = 0x8000_0000
      const preimageCount =
        Math.floor((drawSpan - 1 - selectedIndex) / approvedCandidates.length) +
        1
      expect(decision.selection?.conditionalAdministrationProbability).toBe(
        preimageCount / 0x1_0000_0000
      )
    }
    expect(roles).toEqual(new Set(['ANCHOR', 'FIELD_TEST']))
  })

  it('rejects Research banks below the exposure-safe distinct-item minima', () => {
    const pool = researchPool()
    const input = {
      nodes: [root(1, 0, 1), leaf(2, 1, 0, 2)],
      scale: standardScale(),
      settings: researchSettings(),
    }

    expect(() =>
      prepareAdaptiveV2Runtime({
        ...input,
        pool: pool.filter((item) => item.id !== 3),
      })
    ).toThrowError(
      'Research pools require exposure-safe calibrated anchor coverage for every leaf and level.'
    )
    expect(() =>
      prepareAdaptiveV2Runtime({
        ...input,
        pool: pool.filter((item) => item.id !== 13),
      })
    ).toThrowError(
      'Research pools require enough field-test and scoring items for the collection design.'
    )
    expect(() =>
      prepareAdaptiveV2Runtime({
        ...input,
        pool: pool.filter((item) => item.id !== 10),
      })
    ).toThrowError(
      'Research pools require enough field-test and scoring items for the collection design.'
    )
  })

  it('keeps the minimum Research bank selectable across sequential attempts', () => {
    const runtime = researchRuntime({ totalQuestionCap: 4 })
    const servedCountByPoolItem = new Map<number, number>()
    const priorAttemptPoolItemIds = new Set<number>()

    for (let attemptNumber = 1; attemptNumber <= 12; attemptNumber++) {
      const exposureCapacity = Math.max(
        1,
        Math.ceil(ADAPTIVE_V2_EXPOSURE_CEILING * attemptNumber)
      )
      const responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[] = []
      const priorIds = new Set(priorAttemptPoolItemIds)
      const selectionContext = {
        servedCountByPoolItem,
        priorAttemptPoolItemIds: priorIds,
        isExposureEligible: (item: AdaptiveV2PoolItem) =>
          (servedCountByPoolItem.get(item.id) ?? 0) < exposureCapacity,
      }

      while (responses.length < runtime.settings.totalQuestionCap) {
        const decision = advanceAdaptiveV2Runtime({
          attemptId: `attempt-exposure-${attemptNumber}`,
          runtime,
          responses,
          selectionContext,
        })
        expect(decision.nextPoolItem).not.toBeNull()
        expect(decision.stopReason).toBeNull()

        const item = decision.nextPoolItem!
        servedCountByPoolItem.set(
          item.id,
          (servedCountByPoolItem.get(item.id) ?? 0) + 1
        )
        responses.push(response(item, responses.length + 1, true))
      }

      const terminal = advanceAdaptiveV2Runtime({
        attemptId: `attempt-exposure-${attemptNumber}`,
        runtime,
        responses,
        selectionContext,
      })
      expect(terminal.stopReason).toBe('TOTAL_QUESTION_CAP')
      expect(
        responses.filter(({ poolItem }) => poolItem.role === 'ANCHOR')
      ).toHaveLength(3)
      expect(
        responses.filter(({ poolItem }) => poolItem.role === 'FIELD_TEST')
      ).toHaveLength(1)
      expect(Math.max(...servedCountByPoolItem.values())).toBeLessThanOrEqual(
        exposureCapacity
      )
      responses.forEach(({ poolItem }) => {
        priorAttemptPoolItemIds.add(poolItem.id)
      })
    }
  })

  it('keeps an uncertain boundary result between levels at the total cap', () => {
    const pool = Array.from({ length: 4 }, (_, index) =>
      scoringItem({
        id: index + 1,
        leafId: 2,
        path: [1, 2],
        levelId: 2,
        difficulty: 0,
      })
    )
    const runtime = prepareAdaptiveV2Runtime({
      nodes: [root(1, 0, 1), leaf(2, 1, 0, 2)],
      scale: boundaryScale(),
      pool,
      settings: diagnosticSettings({ totalQuestionCap: 4 }),
    })
    const responses = pool.map((item, index) =>
      response(item, index + 1, index % 2 === 0)
    )
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-boundary',
      runtime,
      responses,
    })

    expect(decision.stopReason).toBe('TOTAL_QUESTION_CAP')
    expect(decision.resultStatus).toBe('BETWEEN_LEVELS')
    expect(decision.estimates.overall.classifiedLevelId).toBeNull()
    expect(decision.estimates.overall.leadingLevelIds).toEqual([2, 3])
  })

  it('rejects response objects that do not match the immutable pool', () => {
    const runtime = prepareAdaptiveV2Runtime({
      nodes: weightedLeaves(),
      scale: standardScale(),
      pool: weightedLeafPool(),
      settings: diagnosticSettings(),
    })
    const tampered = {
      ...runtime.pool[0]!,
      difficulty: runtime.pool[0]!.difficulty + 1,
    }

    expect(() =>
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-tampered',
        runtime,
        responses: [response(tampered, 1, true)],
      })
    ).toThrowError(AdaptiveRuntimeConfigurationError)
  })

  it('snapshots mutable preparation inputs', () => {
    const nodes = weightedLeaves()
    const scale = standardScale()
    const pool = weightedLeafPool()
    const settings = diagnosticSettings()
    const runtime = prepareAdaptiveV2Runtime({ nodes, scale, pool, settings })

    nodes[0]!.weight = 99
    scale.levels[0]!.label = 'Mutated'
    pool[0]!.difficulty = 5
    settings.thetaRange.min = -1

    expect(runtime.roots[0]!.weight).toBe(1)
    expect(runtime.scale.levels[0]!.label).toBe('Foundation')
    expect(runtime.pool[0]!.difficulty).toBe(-1)
    expect(runtime.settings.thetaRange.min).toBe(-3)
  })

  it('exposes only factory-branded immutable prepared runtimes', () => {
    const runtime = prepareAdaptiveV2Runtime({
      nodes: weightedLeaves(),
      scale: standardScale(),
      pool: weightedLeafPool(),
      settings: diagnosticSettings(),
    })

    expect(Object.isFrozen(runtime)).toBe(true)
    expect(Object.isFrozen(runtime.pool)).toBe(true)
    expect(Object.isFrozen(runtime.pool[0])).toBe(true)
    expect(Object.isFrozen(runtime.pool[0]!.nodePath)).toBe(true)
    expect(Object.isFrozen(runtime.scale.levels)).toBe(true)
    expect(() => {
      runtime.pool[0]!.difficulty = 5
    }).toThrow(TypeError)
    const mutableNodesById = runtime.nodesById as Map<
      number,
      AdaptiveRuntimeNode
    >
    expect(() => {
      mutableNodesById.set(99, root(99, 0, 1))
    }).toThrow(TypeError)

    expect(() =>
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-forged-runtime',
        runtime: { ...runtime },
        responses: [],
      })
    ).toThrowError('must be prepared by the IRT_V2_EAP_GRID_1 factory')
  })

  it('rejects over-cap response histories before estimation', () => {
    const pool = weightedLeafPool()
    const runtime = prepareAdaptiveV2Runtime({
      nodes: weightedLeaves(),
      scale: standardScale(),
      pool,
      settings: diagnosticSettings({ totalQuestionCap: 1 }),
    })

    expect(() =>
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-over-cap-history',
        runtime,
        responses: [response(pool[0]!, 1, true), response(pool[1]!, 2, true)],
      })
    ).toThrowError('response history exceeds a configured question cap')
  })

  it.each([
    [
      'per-leaf',
      () => {
        const pool = weightedLeafPool()
        return {
          runtime: prepareAdaptiveV2Runtime({
            nodes: weightedLeaves(),
            scale: standardScale(),
            pool,
            settings: diagnosticSettings({ perLeafQuestionCap: 1 }),
          }),
          pool,
        }
      },
    ],
    [
      'direct node',
      () => {
        const nodes = weightedLeaves()
        nodes[1]!.questionCap = 1
        const pool = weightedLeafPool()
        return {
          runtime: prepareAdaptiveV2Runtime({
            nodes,
            scale: standardScale(),
            pool,
            settings: diagnosticSettings(),
          }),
          pool,
        }
      },
    ],
    [
      'depth-five ancestor',
      () => {
        const nodes = depthFiveNodes()
        nodes[2]!.questionCap = 1
        const pool = depthFivePool()
        return {
          runtime: prepareAdaptiveV2Runtime({
            nodes,
            scale: standardScale(),
            pool,
            settings: diagnosticSettings(),
          }),
          pool,
        }
      },
    ],
  ] as const)('rejects %s cap violations in response history', (_, fixture) => {
    const { runtime, pool } = fixture()

    expect(() =>
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-structural-cap-history',
        runtime,
        responses: [response(pool[0]!, 1, true), response(pool[1]!, 2, true)],
      })
    ).toThrowError('response history exceeds a configured question cap')
  })

  it('does not classify the overall result while a required root is uncertain', () => {
    const dominantPool = Array.from({ length: 20 }, (_, index) =>
      scoringItem({
        id: index + 1,
        leafId: 2,
        path: [1, 2],
        levelId: 3,
        difficulty: -1 + (3 * index) / 19,
      })
    )
    const uncertainItem = scoringItem({
      id: 21,
      leafId: 4,
      path: [3, 4],
      levelId: 2,
      difficulty: 0,
    })
    const pool = [...dominantPool, uncertainItem]
    const runtime = prepareAdaptiveV2Runtime({
      nodes: [
        root(1, 0, 1_000),
        leaf(2, 1, 0, 2),
        root(3, 1, 1),
        leaf(4, 3, 0, 2),
      ],
      scale: standardScale(),
      pool,
      settings: diagnosticSettings({
        totalQuestionCap: pool.length,
        minimumRootResponses: 1,
      }),
    })
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-required-root-gate',
      runtime,
      responses: pool.map((item, index) =>
        response(item, index + 1, item.leafNodeId === 2)
      ),
    })

    expect(decision.estimates.nodes.get(1)?.resultStatus).toBe('CLASSIFIED')
    expect(decision.estimates.nodes.get(3)?.resultStatus).not.toBe('CLASSIFIED')
    expect(
      decision.estimates.overall.posterior.bandProbabilities[2]!.probability
    ).toBeGreaterThanOrEqual(0.8)
    expect(decision.resultStatus).not.toBe('CLASSIFIED')
    expect(decision.estimates.overall.classifiedLevelId).toBeNull()
  })

  it('accounts for every leaf minimum when checking ancestor-cap reachability', () => {
    const nodes = [
      { ...root(1, 0, 1), questionCap: 5 },
      leaf(2, 1, 0, 2),
      leaf(3, 2, 0, 3),
      leaf(4, 2, 1, 3),
      leaf(5, 2, 2, 3),
    ]
    const pool = [3, 4, 5].flatMap((leafId, leafIndex) =>
      [0, 1].map((copy) =>
        scoringItem({
          id: leafIndex * 2 + copy + 1,
          leafId,
          path: [1, 2, leafId],
          levelId: 2,
          difficulty: 0,
        })
      )
    )
    const runtime = prepareAdaptiveV2Runtime({
      nodes,
      scale: standardScale(),
      pool,
      settings: diagnosticSettings({
        minQuestionsPerLeaf: 2,
        minimumRootResponses: 4,
      }),
    })
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-nested-cap-reachability',
      runtime,
      responses: [],
    })

    expect(decision.estimates.nodes.get(2)?.evidenceReachable).toBe(false)
    expect(decision.estimates.nodes.get(1)?.evidenceReachable).toBe(false)
  })

  it('uses a pool-limited stop when exposure control blocks every item', () => {
    const runtime = prepareAdaptiveV2Runtime({
      nodes: weightedLeaves(),
      scale: standardScale(),
      pool: weightedLeafPool(),
      settings: diagnosticSettings(),
    })
    const decision = advanceAdaptiveV2Runtime({
      attemptId: 'attempt-exposure-exhausted',
      runtime,
      responses: [],
      selectionContext: { isExposureEligible: () => false },
    })

    expect(decision.stopReason).toBe('POOL_EXHAUSTED')
    expect(decision.resultStatus).toBe('POOL_LIMITED')
  })

  it('accepts only code-owned classification policy thresholds', () => {
    expect(() =>
      prepareAdaptiveV2Runtime({
        nodes: weightedLeaves(),
        scale: standardScale(),
        pool: weightedLeafPool(),
        settings: diagnosticSettings({
          classificationProbabilityThreshold: 0.85,
        }),
      })
    ).toThrowError('must use an approved policy threshold')
  })

  it('runs calibrated pools across every supported adaptive item type', () => {
    const itemTypes = [
      ['NUMERICAL', null, 'TWO_PL'],
      ['SC', 4, 'THREE_PL_FIXED_C'],
      ['MC', 4, 'THREE_PL_FIXED_C'],
      ['KPRIM', 4, 'THREE_PL_FIXED_C'],
      ['FREE_TEXT', null, 'TWO_PL'],
    ] as const
    const pool: AdaptiveV2PoolItem[] = itemTypes.map(
      ([itemType, choiceCount, model], index) => ({
        id: index + 1,
        leafNodeId: 2,
        nodePath: [1, 2],
        levelId: 2,
        itemType,
        choiceCount,
        model,
        calibrationId: `mixed-type-calibration-${index + 1}`,
        contributesToEstimate: true,
        role: 'SCORING',
        discrimination: 1.2,
        difficulty: 0,
        guessing: deriveGuessingParameter({ type: itemType, choiceCount }),
      })
    )
    const runtime = prepareAdaptiveV2Runtime({
      nodes: [root(1, 0, 1), leaf(2, 1, 0, 2)],
      scale: standardScale(),
      pool,
      settings: diagnosticSettings(),
    })

    expect(
      advanceAdaptiveV2Runtime({
        attemptId: 'attempt-mixed-item-types',
        runtime,
        responses: [],
      }).nextPoolItem
    ).not.toBeNull()
  })
})

function depthFiveNodes(): AdaptiveRuntimeNode[] {
  return [
    root(1, 0, 1),
    leaf(2, 1, 0, 2),
    leaf(3, 2, 0, 3),
    leaf(4, 3, 0, 4),
    leaf(5, 4, 0, 5, 3),
    leaf(6, 4, 1, 5, 1),
  ]
}

function depthFivePool() {
  return [5, 6].flatMap((leafId, leafIndex) =>
    [-1.5, -0.5, 0.5, 1.5].map((difficulty, itemIndex) =>
      scoringItem({
        id: leafIndex * 4 + itemIndex + 1,
        leafId,
        path: [1, 2, 3, 4, leafId],
        levelId: itemIndex < 2 ? 1 : 3,
        difficulty,
      })
    )
  )
}

function weightedLeaves(): AdaptiveRuntimeNode[] {
  return [root(1, 0, 1), leaf(2, 1, 0, 2, 3), leaf(3, 1, 1, 2, 1)]
}

function weightedLeafPool() {
  return [2, 3].flatMap((leafId, leafIndex) =>
    [-1, 0, 1, 2].map((difficulty, itemIndex) =>
      scoringItem({
        id: leafIndex * 4 + itemIndex + 1,
        leafId,
        path: [1, leafId],
        levelId: difficulty < 0 ? 1 : difficulty > 0 ? 3 : 2,
        difficulty,
      })
    )
  )
}

function researchRuntime(overrides: Partial<AdaptiveV2RuntimeSettings> = {}) {
  const scale = standardScale()
  return prepareAdaptiveV2Runtime({
    nodes: [root(1, 0, 1), leaf(2, 1, 0, 2)],
    scale,
    pool: researchPool(),
    settings: researchSettings(overrides),
  })
}

function researchPool(): AdaptiveV2PoolItem[] {
  const scale = standardScale()
  const anchors = scale.levels.flatMap((level, levelIndex) =>
    [0, 1, 2].map((copy) =>
      scoringItem({
        id: levelIndex * 3 + copy + 1,
        leafId: 2,
        path: [1, 2],
        levelId: level.id,
        difficulty: level.itemDifficultyPrior,
        role: 'ANCHOR',
      })
    )
  )
  const scoringRedundancy = scoringItem({
    id: 10,
    leafId: 2,
    path: [1, 2],
    levelId: 2,
    difficulty: 0,
    role: 'ANCHOR',
  })
  const fieldTests = [11, 12, 13].map((id) => ({
    ...scoringItem({
      id,
      leafId: 2,
      path: [1, 2],
      levelId: 2,
      difficulty: 0,
    }),
    calibrationId: `calibration-field-test-${id}`,
    contributesToEstimate: false,
    role: 'FIELD_TEST' as const,
  }))
  return [...anchors, scoringRedundancy, ...fieldTests]
}

function researchAnchor(pool: readonly AdaptiveV2PoolItem[], levelId: number) {
  return pool.find(
    (item) => item.role === 'ANCHOR' && item.levelId === levelId
  )!
}

function scoringItem({
  id,
  leafId,
  path,
  levelId,
  difficulty,
  role = 'SCORING',
}: {
  id: number
  leafId: number
  path: number[]
  levelId: number
  difficulty: number
  role?: 'SCORING' | 'ANCHOR'
}): AdaptiveV2PoolItem {
  return {
    id,
    leafNodeId: leafId,
    nodePath: path,
    levelId,
    itemType: 'NUMERICAL',
    choiceCount: null,
    model: 'TWO_PL',
    calibrationId: `calibration-${id}`,
    contributesToEstimate: true,
    role,
    discrimination: 1.2,
    difficulty,
    guessing: 0,
  }
}

function response(
  poolItem: AdaptiveV2PoolItem,
  order: number,
  correct: boolean
): AdaptiveRuntimeResponse<AdaptiveV2PoolItem> {
  return { order, poolItemId: poolItem.id, poolItem, correct }
}

function root(id: number, order: number, weight: number): AdaptiveRuntimeNode {
  return {
    id,
    parentId: null,
    kind: 'COMPETENCE',
    depth: 1,
    order,
    enabled: true,
    weight,
    questionCap: null,
  }
}

function leaf(
  id: number,
  parentId: number,
  order: number,
  depth: number,
  weight: number | null = null
): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: 'SUBCOMPETENCE',
    depth,
    order,
    enabled: true,
    weight,
    questionCap: null,
  }
}

function diagnosticSettings(
  overrides: Partial<AdaptiveV2RuntimeSettings> = {}
): AdaptiveV2RuntimeSettings {
  return {
    totalQuestionCap: 40,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 1,
    classificationZ: 1.28,
    topInformationRatio: 0.8,
    levelMappingRule: 'NEAREST',
    thetaRange: { min: -3, max: 3 },
    mode: 'DIAGNOSTIC',
    credibleMass: 0.9,
    classificationProbabilityThreshold: 0.8,
    minimumRootResponses: 4,
    researchPolicy: null,
    ...overrides,
  }
}

function researchSettings(
  overrides: Partial<AdaptiveV2RuntimeSettings> = {}
): AdaptiveV2RuntimeSettings {
  return {
    ...diagnosticSettings(),
    totalQuestionCap: 20,
    mode: 'RESEARCH',
    researchPolicy: {
      anchorResponsesPerLeafLevel: 1,
      fieldTestResponsesPerLeaf: 1,
      fieldTestInclusionProbability: 0.5,
      collectionDesignVersion: 'RESEARCH_DESIGN_V1',
    },
    ...overrides,
  }
}

function standardScale(): AdaptiveScaleDefinition {
  return {
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -6,
    gridMax: 6,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    levels: [
      level(1, 'Foundation', 0, Number.NEGATIVE_INFINITY, -1, -2),
      level(2, 'Independent', 1, -1, 1, 0),
      level(3, 'Advanced', 2, 1, Number.POSITIVE_INFINITY, 2),
    ],
  }
}

function boundaryScale(): AdaptiveScaleDefinition {
  return {
    ...standardScale(),
    levels: [
      level(1, 'Foundation', 0, Number.NEGATIVE_INFINITY, -1, -2),
      level(2, 'Developing', 1, -1, 0, -0.5),
      level(3, 'Advanced', 2, 0, Number.POSITIVE_INFINITY, 1),
    ],
  }
}

function level(
  id: number,
  label: string,
  order: number,
  lowerBound: number,
  upperBound: number,
  itemDifficultyPrior: number
) {
  return { id, label, order, lowerBound, upperBound, itemDifficultyPrior }
}
