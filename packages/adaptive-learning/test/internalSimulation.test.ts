import { describe, expect, it } from 'vitest'
import {
  type AdaptiveV2SimulationMetrics,
  type AdaptiveV2SimulationReport,
  fingerprintAdaptiveSimulationInput,
  selectStratifiedRetakeEvidence,
  simulateAdaptiveAttemptAcrossThresholds,
} from '../scripts/internalSimulation.js'
import {
  evaluateEmpiricalReleaseGates,
  evaluateV2ReleaseGates,
} from '../scripts/simulationV2Gates.js'
import { assertAdaptiveV2SimulationRelease } from '../scripts/simulationV2ReleaseAssertion.js'
import {
  ADAPTIVE_V2_SCENARIO_SET,
  buildAdaptiveV2ReleaseInput,
  buildAdaptiveV2ScenarioReleaseGates,
  runAdaptiveV2ScenarioProbes,
} from '../scripts/simulationV2Scenarios.js'
import * as publicApi from '../src/index.js'
import { prepareAdaptiveV2Runtime } from '../src/index.js'

describe('internal-only adaptive v2 simulation contracts', () => {
  it('keeps the simulation runner out of the production package API', () => {
    expect(publicApi).not.toHaveProperty('runAdaptiveV2Simulation')
    expect(publicApi).not.toHaveProperty('fingerprintAdaptiveSimulationInput')
  })

  it('fingerprints JSON-shaped inputs deterministically and sensitively', () => {
    const left = {
      scale: {
        lower: Number.NEGATIVE_INFINITY,
        upper: Number.POSITIVE_INFINITY,
      },
      policy: { threshold: 0.8 },
    }
    const reordered = {
      policy: { threshold: 0.8 },
      scale: {
        upper: Number.POSITIVE_INFINITY,
        lower: Number.NEGATIVE_INFINITY,
      },
    }

    expect(fingerprintAdaptiveSimulationInput(left)).toBe(
      fingerprintAdaptiveSimulationInput(reordered)
    )
    expect(
      fingerprintAdaptiveSimulationInput({
        ...left,
        policy: { threshold: 0.9 },
      })
    ).not.toBe(fingerprintAdaptiveSimulationInput(left))
  })

  it('fingerprints every effective runtime and statistical setting', () => {
    const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })
    const changedRuntime = {
      ...input,
      runtimeSettings: { ...input.runtimeSettings, topInformationRatio: 0.7 },
    }
    const changedStatistics = {
      ...input,
      simulationSettings: {
        ...input.simulationSettings,
        bootstrapReplicates: 2_000,
      },
    }
    const changedBoundarySchedule = {
      ...input,
      simulationSettings: {
        ...input.simulationSettings,
        cutSideOffset: 0.03,
      },
    }
    const changedScenarioPolicy = {
      ...input,
      scenarioPolicy: {
        ...input.scenarioPolicy,
        difLearnersPerTheta: input.scenarioPolicy.difLearnersPerTheta + 1,
      },
    }

    expect(fingerprintAdaptiveSimulationInput(changedRuntime)).not.toBe(
      fingerprintAdaptiveSimulationInput(input)
    )
    expect(fingerprintAdaptiveSimulationInput(changedStatistics)).not.toBe(
      fingerprintAdaptiveSimulationInput(input)
    )
    expect(
      fingerprintAdaptiveSimulationInput(changedBoundarySchedule)
    ).not.toBe(fingerprintAdaptiveSimulationInput(input))
    expect(fingerprintAdaptiveSimulationInput(changedScenarioPolicy)).not.toBe(
      fingerprintAdaptiveSimulationInput(input)
    )
  })

  it('reproduces the reviewed depth-five, two-root, mixed 60-item fixture', () => {
    const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })

    expect(input.pool).toHaveLength(60)
    expect(input.nodes).toHaveLength(10)
    expect(Math.max(...input.nodes.map(({ depth }) => depth))).toBe(5)
    expect(input.rootWeights).toEqual([
      { rootId: 1, weight: 3 },
      { rootId: 6, weight: 2 },
    ])
    expect(new Set(input.pool.map(({ itemType }) => itemType))).toEqual(
      new Set(['NUMERICAL', 'SC', 'MC', 'KPRIM', 'FREE_TEXT'])
    )
    expect(input.learnersPerBand).toBe(2_334)
    expect(input.simulationSettings.cutSideOffset).toBe(0.02)
    expect(input.simulationSettings.interiorThetaCells).toEqual([
      { levelId: 1, values: [-2.9, -2.6, -2.3, -2, -1.7] },
      { levelId: 2, values: [-1.2, -0.6, 0, 0.6, 1.2] },
      { levelId: 3, values: [1.7, 2, 2.3, 2.6, 2.9] },
    ])
    expect(input.policy.minimumSimulatedLearnersPerThetaCell).toBe(400)
    expect(input.scenarioPolicy.difLearnersPerTheta).toBe(384)
    expect(input.scenarioPolicy.difBootstrapUnit).toBe('LEARNER_CLUSTER_V1')
  })

  it('catalogs every required shipping and non-shipping stress family', () => {
    const ids = new Set(ADAPTIVE_V2_SCENARIO_SET.map(({ id }) => id))
    const categories = new Set(
      ADAPTIVE_V2_SCENARIO_SET.map(({ category }) => category)
    )

    expect(ids).toContain('canonical-depth-five-mixed')
    expect(ids).toContain('cut-sides')
    expect(ids).toContain('cap-abstention')
    expect(ids).toContain('pool-exhaustion-abstention')
    expect(ids).toContain('response-80-20')
    expect(ids).toContain('response-deterministic-threshold')
    expect(ids).toContain('incorrect-provisional-b')
    expect(ids).toContain('true-a-0.8')
    expect(ids).toContain('true-a-1.5')
    expect(ids).toContain('item-drift')
    expect(ids).toContain('item-type-dif-sc')
    expect(ids).toContain('course-cohort-dif')
    expect(ids).toContain('adjacent-band-mislabel')
    expect(ids).toContain('heterogeneous-root-abilities')
    expect(ids).toContain('heterogeneous-leaf-abilities')
    expect(ids).toContain('all-correct')
    expect(ids).toContain('all-wrong')
    expect(ids).toContain('guessing-only')
    expect(ids).toContain('item-type-mixed')
    expect(ids).toContain('calibrated-provisional-contamination')
    expect(ids).toContain('research-connected-anchors')
    expect(ids).toContain('research-disconnected-anchors')
    expect(ids).toContain('research-known-inclusion-probability')
    expect(ids).toContain('retake-cooldown')
    expect(ids).toContain('retake-latest-result')
    expect(ids).toContain('retake-overlap-control')
    expect(ids).toContain('first-exposure-calibration')
    expect(ids).toContain('pool-sparse')
    expect(ids).toContain('pool-target')
    expect(ids).toContain('pool-rich')
    expect(categories).toEqual(
      new Set([
        'MODEL_RECOVERY',
        'BOUNDARY',
        'MISSPECIFICATION',
        'HIERARCHY',
        'ITEM_TYPE',
        'CALIBRATION',
        'RESEARCH',
        'RETAKE',
        'POOL_SIZE',
      ])
    )
  })

  it('executes every cataloged profile as release or exploratory evidence', () => {
    const probes = runAdaptiveV2ScenarioProbes()

    expect(probes.map(({ id }) => id)).toEqual(
      ADAPTIVE_V2_SCENARIO_SET.map(({ id }) => id)
    )
    expect(
      probes.every(({ executedSuccessfully }) => executedSuccessfully)
    ).toBe(true)
    expect(
      probes
        .filter(
          ({ category }) => category !== 'RESEARCH' && category !== 'RETAKE'
        )
        .every(({ learnerCount }) => learnerCount > 0)
    ).toBe(true)
  })

  it('makes DIF detection, cap, and exhaustion checks release-blocking', () => {
    const gates = buildAdaptiveV2ScenarioReleaseGates()

    expect(gates).toHaveLength(18)
    expect(
      new Set(gates.map(({ probabilityThreshold }) => probabilityThreshold))
    ).toEqual(new Set([0.8, 0.9, 0.95]))
    expect(gates.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'scenario:item-type-dif-sc:difResidualContrastLower95',
        'scenario:course-cohort-dif:difResidualContrastLower95',
        'scenario:cap-abstention:forcedClassificationCount',
        'scenario:cap-abstention:expectedStopRate',
        'scenario:pool-exhaustion-abstention:forcedClassificationCount',
        'scenario:pool-exhaustion-abstention:expectedStopRate',
      ])
    )
    expect(gates.every(({ passed }) => passed)).toBe(true)
  })

  it('stratifies retake evidence across every band, cut class, and cohort', () => {
    const evidence = [1, 2, 3].flatMap((trueLevelId) =>
      (['NEAR_CUT', 'INTERIOR'] as const).flatMap((cutDistance) =>
        ['A', 'B', 'C'].flatMap((courseCohort) =>
          [0, 1].map((duplicate) => ({
            learnerId: `${trueLevelId}:${cutDistance}:${courseCohort}:${duplicate}`,
            trueLevelId,
            cutDistance,
            courseCohort,
          }))
        )
      )
    )

    const selected = selectStratifiedRetakeEvidence(evidence, 18)
    const selectedKeys = new Set(
      selected.map(({ trueLevelId, cutDistance, courseCohort }) =>
        [trueLevelId, cutDistance, courseCohort].join(':')
      )
    )

    expect(selected).toHaveLength(18)
    expect(selectedKeys).toHaveLength(18)
    expect(selectStratifiedRetakeEvidence([...evidence].reverse(), 18)).toEqual(
      selected
    )
  })

  it('lets the release assertion pass exactly when an approved threshold passes', () => {
    const passing: AdaptiveV2SimulationReport = {
      schemaVersion: 1,
      evidenceProfile: 'RELEASE',
      inputFingerprint: 'a'.repeat(64),
      estimatorVersion: 'IRT_V2_EAP_GRID_1',
      policyVersion: 1,
      seed: 'release-assertion',
      thresholdResults: [
        {
          probabilityThreshold: 0.8,
          metrics: passingMetrics(),
          gates: [
            {
              name: 'all-reviewed-gates',
              passed: true,
              actual: 1,
              comparison: 'EQ',
              target: 1,
              required: '= 1',
            },
          ],
          passed: true,
        },
      ],
      approvedProbabilityThreshold: 0.8,
      passed: true,
      retainedTraces: [],
    }

    expect(assertAdaptiveV2SimulationRelease(passing)).toBe(0.8)
    expect(() =>
      assertAdaptiveV2SimulationRelease({
        ...passing,
        evidenceProfile: 'CONTRACT',
      })
    ).toThrow('require RELEASE evidence')
    expect(() =>
      assertAdaptiveV2SimulationRelease({
        ...passing,
        approvedProbabilityThreshold: null,
        passed: false,
        thresholdResults: [
          {
            ...passing.thresholdResults[0]!,
            gates: [
              {
                name: 'classificationRateLower95',
                passed: false,
                actual: 0.7,
                comparison: 'GTE',
                target: 0.8,
                required: '>= 0.8',
              },
            ],
            passed: false,
          },
        ],
      })
    ).toThrow('No v2 threshold passed')
    expect(() =>
      assertAdaptiveV2SimulationRelease({
        ...passing,
        thresholdResults: [
          {
            ...passing.thresholdResults[0]!,
            gates: [
              {
                name: 'tampered-gate',
                passed: false,
                actual: 0,
                comparison: 'EQ',
                target: 1,
                required: '= 1',
              },
            ],
          },
        ],
      })
    ).toThrow('internally inconsistent')
    expect(() =>
      assertAdaptiveV2SimulationRelease({
        ...passing,
        thresholdResults: [
          {
            ...passing.thresholdResults[0]!,
            gates: [
              {
                name: 'tampered-passing-gate',
                passed: true,
                actual: 0,
                comparison: 'GTE',
                target: 1,
                required: '>= 1',
              },
            ],
          },
        ],
      })
    ).toThrow('internally inconsistent')
    expect(() =>
      assertAdaptiveV2SimulationRelease({
        ...passing,
        passed: false,
      })
    ).toThrow('approval fields contradict')
  })

  it('matches a direct production replay at a lower threshold', () => {
    const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })
    const runtimeFor = (threshold: number) =>
      prepareAdaptiveV2Runtime({
        nodes: input.nodes,
        scale: input.scale,
        pool: input.pool,
        settings: {
          ...input.runtimeSettings,
          totalQuestionCap: input.itemsPerAttempt,
          credibleMass: input.policy.credibleMass,
          classificationProbabilityThreshold: threshold,
          researchPolicy: null,
        },
      })
    const attempt = {
      attemptId: 'threshold-prefix-replay',
      pool: input.pool,
      trueTheta: 0,
      trueLevelId: 2,
      courseCohort: 'REPLAY',
      cutDistance: 'INTERIOR' as const,
      responseSeed: 47_311,
    }
    const sharedPath = simulateAdaptiveAttemptAcrossThresholds({
      ...attempt,
      runtime: runtimeFor(0.95),
      thresholds: [0.8, 0.9, 0.95],
    }).get(0.8)!
    const directReplay = simulateAdaptiveAttemptAcrossThresholds({
      ...attempt,
      runtime: runtimeFor(0.8),
      thresholds: [0.8],
    }).get(0.8)!

    expect(sharedPath.selectedItemIds).toEqual(directReplay.selectedItemIds)
    expect(sharedPath.responseBits).toBe(directReplay.responseBits)
    expect(sharedPath.observation.stopReason).toBe(
      directReplay.observation.stopReason
    )
    expect(sharedPath.posterior.mean).toBeCloseTo(
      directReplay.posterior.mean,
      12
    )
  })

  it('blocks release when synthetic or empirical strata are underpowered', () => {
    const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })
    const metrics = passingMetrics()
    metrics.strata[0]!.learnerCount = 999

    expect(
      evaluateV2ReleaseGates(metrics, input.policy).find(
        ({ name }) => name === 'stratum:band:A1:learnerCount'
      )?.passed
    ).toBe(false)

    metrics.strata[0]!.learnerCount = 199
    expect(
      evaluateEmpiricalReleaseGates(metrics, input.policy).find(
        ({ name }) => name === 'stratum:band:A1:learnerCount'
      )?.passed
    ).toBe(false)

    metrics.strata[0] = {
      ...metrics.strata[0]!,
      key: 'theta-cell:Foundation:0:-2.9',
      learnerCount: 399,
    }
    expect(
      evaluateV2ReleaseGates(metrics, input.policy).find(
        ({ name }) =>
          name === 'stratum:theta-cell:Foundation:0:-2.9:learnerCount'
      )?.passed
    ).toBe(false)
  })

  it('requires near-cut abstention when confident adjacent errors exceed one percent', () => {
    const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })
    const metrics = passingMetrics()
    metrics.strata[0] = {
      ...metrics.strata[0]!,
      key: 'cut-distance:NEAR_CUT',
      classifiedBandAccuracy: 0.5,
      classifiedBandAccuracyLower95: 0.4,
      confidentMisclassificationRate: 0.02,
      confidentMisclassificationRateUpper95: 0.03,
    }

    const gates = evaluateV2ReleaseGates(metrics, input.policy)
    expect(
      gates.find(
        ({ name }) =>
          name ===
          'stratum:cut-distance:NEAR_CUT:confidentMisclassificationRateUpper95'
      )?.passed
    ).toBe(false)
    expect(
      gates.some(
        ({ name }) =>
          name === 'stratum:cut-distance:NEAR_CUT:classifiedBandAccuracyLower95'
      )
    ).toBe(false)
  })
})

function passingMetrics(): AdaptiveV2SimulationMetrics {
  return {
    learnerCount: 1_000,
    classifiedCount: 950,
    abstainedCount: 50,
    classificationRate: 0.95,
    classificationRateLower95: 0.94,
    requiredRootClassificationRate: 0.9,
    requiredRootClassificationRateLower95: 0.88,
    meanBias: 0,
    absoluteBiasUpper95: 0.05,
    rmse: 0.25,
    rmseUpper95: 0.3,
    credibleCoverage: 0.9,
    credibleCoverageLower95: 0.87,
    credibleCoverageUpper95: 0.93,
    classifiedBandAccuracy: 0.97,
    classifiedBandAccuracyLower95: 0.95,
    nonAdjacentConfidentErrorRate: 0,
    nonAdjacentConfidentErrorRateUpper95: 0.005,
    forcedClassificationCount: 0,
    unexpectedFallbackCount: 0,
    medianQuestionCount: 40,
    meanQuestionCount: 40,
    p95QuestionCount: 45,
    medianDurationSeconds: 2_400,
    p95DurationSeconds: 2_700,
    stopReasons: { ALL_ROOTS_CLASSIFIED: 950, TOTAL_QUESTION_CAP: 50 },
    maximumExposureRate: 0.8,
    maximumTestOverlapRate: 0.8,
    sampledMaximumPairwiseFormOverlapRate: 0.8,
    strata: [
      {
        key: 'band:A1',
        learnerCount: 1_000,
        meanBias: 0,
        absoluteBiasUpper95: 0.05,
        rmse: 0.25,
        rmseUpper95: 0.3,
        classificationRate: 0.95,
        classificationRateLower95: 0.94,
        classifiedBandAccuracy: 0.97,
        classifiedBandAccuracyLower95: 0.95,
        nonAdjacentConfidentErrorRate: 0,
        nonAdjacentConfidentErrorRateUpper95: 0.005,
        confidentMisclassificationRate: 0.005,
        confidentMisclassificationRateUpper95: 0.009,
        credibleCoverage: 0.9,
        credibleCoverageLower95: 0.87,
        credibleCoverageUpper95: 0.93,
      },
    ],
  }
}
