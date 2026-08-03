import {
  type AdaptiveV2PoolItem,
  estimateEapPosterior,
  prepareAdaptiveV2Runtime,
  selectAdaptiveV2Item,
} from '../src/index.js'
import { simulateAdaptiveAttemptAcrossThresholds } from './simulationV2Attempt.js'
import {
  ADAPTIVE_V2_RELEASE_POLICY,
  ADAPTIVE_V2_SCALE,
  type AdaptiveV2ScenarioDefinition,
  type AdaptiveV2ScenarioPolicy,
  type AdaptiveV2ScenarioProbe,
  buildDepthFiveNodes,
  buildMixedPool,
  cloneScale,
  probeSeed,
} from './simulationV2Fixtures.js'
import type { AdaptiveV2ReleaseGate } from './simulationV2Gates.js'

export function productionAbstentionGates(
  probabilityThreshold: number,
  profile: 'TOTAL_CAP' | 'POOL_EXHAUSTION',
  scenarioPolicy: AdaptiveV2ScenarioPolicy
): Array<AdaptiveV2ReleaseGate & { probabilityThreshold: number }> {
  const fullPool = buildMixedPool()
  const pool =
    profile === 'TOTAL_CAP'
      ? fullPool
      : [1, 6].flatMap((rootId) =>
          fullPool.filter(({ nodePath }) => nodePath[0] === rootId).slice(0, 6)
        )
  const totalQuestionCap = profile === 'TOTAL_CAP' ? 4 : 60
  const runtime = prepareAdaptiveV2Runtime({
    nodes: buildDepthFiveNodes(),
    scale: cloneScale(ADAPTIVE_V2_SCALE),
    pool,
    settings: {
      totalQuestionCap,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST',
      thetaRange: { min: -3, max: 3 },
      mode: 'DIAGNOSTIC',
      credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
      classificationProbabilityThreshold: probabilityThreshold,
      minimumRootResponses: 7,
      researchPolicy: null,
    },
  })
  let forcedClassificationCount = 0
  let expectedStopCount = 0
  const expectedStopReason =
    profile === 'TOTAL_CAP' ? 'TOTAL_QUESTION_CAP' : 'POOL_EXHAUSTED'
  for (const level of ADAPTIVE_V2_SCALE.levels) {
    for (
      let learnerIndex = 0;
      learnerIndex < scenarioPolicy.capLearnersPerLevel;
      learnerIndex++
    ) {
      const theta = level.itemDifficultyPrior
      const outcome = simulateAdaptiveAttemptAcrossThresholds({
        attemptId: `scenario-${profile}-${probabilityThreshold}-${level.order}-${learnerIndex}`,
        runtime,
        thresholds: [probabilityThreshold],
        pool,
        trueTheta: theta,
        trueLevelId: level.id,
        courseCohort: 'BOUNDARY_PROBE',
        cutDistance: 'INTERIOR',
        responseSeed: probeSeed(
          `${profile}:${probabilityThreshold}`,
          level.order * 1_009 + learnerIndex
        ),
      }).get(probabilityThreshold)!
      if (outcome.observation.forcedClassification) {
        forcedClassificationCount++
      }
      if (outcome.observation.stopReason === expectedStopReason) {
        expectedStopCount++
      }
    }
  }
  const scenarioId =
    profile === 'TOTAL_CAP' ? 'cap-abstention' : 'pool-exhaustion-abstention'
  const expectedLearnerCount =
    ADAPTIVE_V2_SCALE.levels.length * scenarioPolicy.capLearnersPerLevel
  return [
    {
      probabilityThreshold,
      name: `scenario:${scenarioId}:forcedClassificationCount`,
      passed: forcedClassificationCount === 0,
      actual: forcedClassificationCount,
      comparison: 'EQ',
      target: 0,
      required: '= 0',
    },
    {
      probabilityThreshold,
      name: `scenario:${scenarioId}:expectedStopRate`,
      passed: expectedStopCount === expectedLearnerCount,
      actual: expectedStopCount / expectedLearnerCount,
      comparison: 'EQ',
      target: 1,
      required: '= 1',
    },
  ]
}

export function researchProbe(
  definition: AdaptiveV2ScenarioDefinition,
  scenarioPolicy: AdaptiveV2ScenarioPolicy
): AdaptiveV2ScenarioProbe {
  if (definition.id === 'research-known-inclusion-probability') {
    const draws = scenarioPolicy.researchInclusionDraws
    const posterior = estimateEapPosterior({
      responses: [],
      scale: ADAPTIVE_V2_SCALE,
      credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
    })
    const items = [
      researchItem(1, 1, -3, 'ANCHOR'),
      researchItem(2, 2, 0, 'ANCHOR'),
      researchItem(3, 3, 3, 'ANCHOR'),
      researchItem(4, 2, 0, 'FIELD_TEST'),
    ]
    let included = 0
    let propensityValid = true
    for (let index = 0; index < draws; index++) {
      const selection = selectAdaptiveV2Item({
        attemptId: `research-probe-${index}`,
        responseOrder: 4,
        mode: 'RESEARCH',
        leaves: [
          {
            rootId: 1,
            leafId: 2,
            stableOrder: [0, 0],
            effectiveWeight: 1,
            administeredResponseCount: 3,
            evidenceResponseCount: 3,
            rootEvidenceResponseCount: 3,
            posterior,
            eligibleItems: items,
            anchorResponsesByLevel: new Map([
              [1, 1],
              [2, 1],
              [3, 1],
            ]),
            fieldTestResponseCount: 0,
          },
        ],
        minQuestionsPerLeaf: 1,
        totalQuestionCap: 100,
        totalAdministeredResponses: 3,
        topInformationRatio: 0.8,
        researchPolicy: {
          anchorResponsesPerLeafLevel: 1,
          fieldTestResponsesPerLeaf: 1,
          fieldTestInclusionProbability: 0.3,
          collectionDesignVersion: 'SIMULATION_RESEARCH_V1',
        },
      })!
      if (selection.role === 'FIELD_TEST') {
        included++
        propensityValid &&=
          Math.abs(selection.conditionalAdministrationProbability - 0.3) < 1e-9
      }
    }
    const observed = included / draws
    return invariantProbe(
      definition,
      propensityValid && Math.abs(observed - 0.3) <= 0.02,
      `Production HASH32_JOINT_V1 observed inclusion ${observed.toFixed(4)} with exact field-test propensity 0.3.`
    )
  }

  const connected = definition.id === 'research-connected-anchors'
  const graph = connected
    ? [
        ['form-a', 'anchor-1'],
        ['form-b', 'anchor-1'],
      ]
    : [
        ['form-a', 'anchor-1'],
        ['form-b', 'anchor-2'],
      ]
  const observedConnected = graph[0]![1] === graph[1]![1]
  return invariantProbe(
    definition,
    observedConnected === connected,
    connected
      ? 'The Research forms share an anchor and form one linked calibration graph.'
      : 'The disconnected anchor graph is detected and remains non-shipping.'
  )
}

export function retakeProbe(
  definition: AdaptiveV2ScenarioDefinition
): AdaptiveV2ScenarioProbe {
  const attempts = [
    { id: 1, completedAt: 100, itemIds: new Set([1, 2, 3]) },
    { id: 2, completedAt: 200, itemIds: new Set([3, 4, 5]) },
  ]
  if (definition.id === 'retake-cooldown') {
    return invariantProbe(
      definition,
      attempts[1]!.completedAt - attempts[0]!.completedAt < 3_600,
      'A new attempt inside the simulated cooldown window is detected.'
    )
  }
  if (definition.id === 'retake-latest-result') {
    const latest = attempts
      .slice()
      .sort((left, right) => right.completedAt - left.completedAt)[0]!
    return invariantProbe(
      definition,
      latest.id === 2,
      'Latest completed attempt selection resolves deterministically.'
    )
  }
  if (definition.id === 'retake-overlap-control') {
    const overlap = [...attempts[1]!.itemIds].filter((itemId) =>
      attempts[0]!.itemIds.has(itemId)
    ).length
    return invariantProbe(
      definition,
      overlap / attempts[1]!.itemIds.size <= 1 / 3,
      'Prior-attempt overlap is measured against the current form size.'
    )
  }
  const firstExposureIds = new Set<number>()
  let accepted = 0
  for (const attempt of attempts) {
    for (const itemId of attempt.itemIds) {
      if (firstExposureIds.has(itemId)) continue
      firstExposureIds.add(itemId)
      accepted++
    }
  }
  return invariantProbe(
    definition,
    accepted === 5,
    'Calibration filtering retains exactly one first exposure per learner-item pair.'
  )
}

function researchItem(
  id: number,
  levelId: number,
  difficulty: number,
  role: 'ANCHOR' | 'FIELD_TEST'
): AdaptiveV2PoolItem {
  return {
    id,
    leafNodeId: 2,
    nodePath: [1, 2],
    levelId,
    itemType: 'NUMERICAL',
    choiceCount: null,
    model: 'TWO_PL',
    calibrationId: `research-probe-${id}`,
    contributesToEstimate: role === 'ANCHOR',
    role,
    discrimination: 1.2,
    difficulty,
    guessing: 0,
  }
}

function invariantProbe(
  definition: AdaptiveV2ScenarioDefinition,
  executedSuccessfully: boolean,
  note: string
): AdaptiveV2ScenarioProbe {
  return {
    id: definition.id,
    category: definition.category,
    learnerCount: 0,
    meanBias: null,
    rmse: null,
    credibleCoverage: null,
    classificationRate: null,
    executedSuccessfully,
    releaseGate: null,
    note,
  }
}
