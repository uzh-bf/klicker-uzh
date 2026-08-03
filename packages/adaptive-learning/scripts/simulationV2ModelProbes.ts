import {
  classifyPosterior,
  combineWeightedPosteriors,
  estimateEapPosterior,
  levelForTheta,
  prepareAdaptiveV2Runtime,
  probability,
  type AdaptiveScoredResponse,
} from '../src/index.js'
import {
  computeAdaptiveV2Estimates,
  countAdaptiveV2Responses,
} from '../src/runtimeV2Estimation.js'
import {
  ADAPTIVE_V2_RELEASE_POLICY,
  ADAPTIVE_V2_SCALE,
  buildDepthFiveNodes,
  buildMixedPool,
  cloneScale,
  probeSeed,
  type AdaptiveV2ScenarioDefinition,
  type AdaptiveV2ScenarioPolicy,
  type AdaptiveV2ScenarioProbe,
} from './simulationV2Fixtures.js'
import {
  deterministicBootstrapAbsoluteMeanLower,
  deterministicBootstrapDifferenceLower,
} from './simulationV2Statistics.js'
import { createSimulationRandom } from './simulationV2Support.js'
import type { AdaptiveV2SimulationItem } from './simulationV2Types.js'

export function hierarchyProbe(
  definition: AdaptiveV2ScenarioDefinition,
  scenarioPolicy: AdaptiveV2ScenarioPolicy
): AdaptiveV2ScenarioProbe {
  const pool = buildMixedPool()
  const rootOne = pool.filter(({ nodePath }) => nodePath[0] === 1)
  const rootTwo = pool.filter(({ nodePath }) => nodePath[0] === 6)
  const branchedNodes = [
    ...buildDepthFiveNodes(),
    {
      id: 11,
      parentId: 4,
      kind: 'SUBCOMPETENCE' as const,
      depth: 5,
      order: 1,
      enabled: true,
      weight: null,
      questionCap: null,
    },
  ]
  const branchedPool = pool.map((item, index) =>
    item.nodePath[0] === 1 && index % 2 === 1
      ? { ...item, leafNodeId: 11, nodePath: [1, 2, 3, 4, 11] }
      : item
  )
  const branchedRuntime = prepareAdaptiveV2Runtime({
    nodes: branchedNodes,
    scale: cloneScale(ADAPTIVE_V2_SCALE),
    pool: branchedPool,
    settings: {
      totalQuestionCap: branchedPool.length,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST',
      thetaRange: { min: -3, max: 3 },
      mode: 'DIAGNOSTIC',
      credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
      classificationProbabilityThreshold: 0.8,
      minimumRootResponses: 1,
      researchPolicy: null,
    },
  })
  const errors: number[] = []
  let covered = 0
  let classified = 0
  const trueThetas = scenarioPolicy.modelThetaValues

  for (let thetaIndex = 0; thetaIndex < trueThetas.length; thetaIndex++) {
    const baseTheta = trueThetas[thetaIndex]!
    for (
      let learnerIndex = 0;
      learnerIndex < scenarioPolicy.modelLearnersPerTheta;
      learnerIndex++
    ) {
      const random = createSimulationRandom(
        probeSeed(definition.id, thetaIndex * 1_009 + learnerIndex)
      )
      let posterior
      let expectedTheta
      if (definition.id === 'heterogeneous-root-abilities') {
        const firstTheta = baseTheta - 0.4
        const secondTheta = baseTheta + 0.4
        const first = posteriorForProbeItems(rootOne, firstTheta, random)
        const second = posteriorForProbeItems(rootTwo, secondTheta, random)
        posterior = combineWeightedPosteriors({
          entries: [
            { key: 'root-1', posterior: first, weight: 3 },
            { key: 'root-2', posterior: second, weight: 2 },
          ],
          scale: ADAPTIVE_V2_SCALE,
          credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
        })
        expectedTheta = (3 * firstTheta + 2 * secondTheta) / 5
      } else {
        const responses = branchedPool
          .filter(({ nodePath }) => nodePath[0] === 1)
          .map((item, index) => {
            const theta =
              item.leafNodeId === 5 ? baseTheta - 0.3 : baseTheta + 0.3
            return {
              order: index + 1,
              poolItemId: item.id,
              poolItem: item,
              correct:
                random() <
                probability(theta, {
                  a: item.trueDiscrimination,
                  b: item.trueDifficulty,
                  c: item.trueGuessing,
                }),
            }
          })
        const estimates = computeAdaptiveV2Estimates({
          runtime: branchedRuntime,
          responses,
          eligibleScoringItems: branchedPool.filter(
            ({ nodePath }) => nodePath[0] === 6
          ),
          counts: countAdaptiveV2Responses(responses),
          terminalReason: 'TOTAL_QUESTION_CAP',
        })
        posterior = estimates.nodes.get(1)!.posterior
        expectedTheta = baseTheta
      }
      const classification = classifyPosterior({
        posterior,
        scale: ADAPTIVE_V2_SCALE,
        credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
        probabilityThreshold: 0.8,
        evidenceSatisfied: true,
        evidenceReachable: true,
        calibratedCoverageSatisfied: true,
        integritySatisfied: true,
        terminalReason: 'TOTAL_QUESTION_CAP',
      })
      errors.push(posterior.mean - expectedTheta)
      if (
        expectedTheta >= posterior.credibleLower &&
        expectedTheta <= posterior.credibleUpper
      ) {
        covered++
      }
      if (classification.status === 'CLASSIFIED') classified++
    }
  }

  const learnerCount = trueThetas.length * scenarioPolicy.modelLearnersPerTheta
  const meanBias = meanProbe(errors)
  const rmse = Math.sqrt(meanProbe(errors.map((error) => error * error)))
  return {
    id: definition.id,
    category: definition.category,
    learnerCount,
    meanBias,
    rmse,
    credibleCoverage: covered / learnerCount,
    classificationRate: classified / learnerCount,
    executedSuccessfully: Number.isFinite(meanBias) && Number.isFinite(rmse),
    releaseGate: null,
    note:
      definition.id === 'heterogeneous-root-abilities'
        ? 'Two independent root posteriors are combined with the reviewed 3:2 weights.'
        : 'Two real depth-five sibling leaves with independent abilities are pooled once through the production hierarchy estimator.',
  }
}

export function modelProbe(
  definition: AdaptiveV2ScenarioDefinition,
  probabilityThreshold: number,
  scenarioPolicy: AdaptiveV2ScenarioPolicy
): AdaptiveV2ScenarioProbe {
  const baseItems = buildMixedPool().filter(({ nodePath }) => nodePath[0] === 1)
  const items = resolveProbeItems(baseItems, definition)
  const trueThetas =
    definition.id === 'cut-sides'
      ? ADAPTIVE_V2_SCALE.levels
          .slice(0, -1)
          .flatMap((level) => [
            level.upperBound - scenarioPolicy.cutSideOffset,
            level.upperBound + scenarioPolicy.cutSideOffset,
          ])
      : scenarioPolicy.modelThetaValues
  const errors: number[] = []
  let covered = 0
  let classified = 0
  let learnerCount = 0
  const difPairedLearnerContrasts: number[] = []
  const difAffectedLearnerMeans: number[] = []
  const difReferenceLearnerMeans: number[] = []
  const learnersPerTheta =
    definition.id === 'cut-sides'
      ? scenarioPolicy.cutExploratoryLearnersPerTheta
      : definition.id === 'item-type-dif-sc' ||
          definition.id === 'course-cohort-dif'
        ? scenarioPolicy.difLearnersPerTheta
        : scenarioPolicy.modelLearnersPerTheta

  for (let thetaIndex = 0; thetaIndex < trueThetas.length; thetaIndex++) {
    const baseTheta = trueThetas[thetaIndex]!
    for (
      let learnerIndex = 0;
      learnerIndex < learnersPerTheta;
      learnerIndex++
    ) {
      const random = createSimulationRandom(
        probeSeed(definition.id, thetaIndex * 1_009 + learnerIndex)
      )
      const theta = resolveProbeTheta(baseTheta, learnerIndex, definition)
      const affectedItemResiduals: number[] = []
      const referenceItemResiduals: number[] = []
      const allItemResiduals: number[] = []
      const responseOutcomes = items
        .filter((item) =>
          definition.id === 'calibrated-provisional-contamination'
            ? item.calibrationId !== null
            : true
        )
        .map((item) => {
          const correct = probeCorrect({
            item,
            theta,
            random,
            definition,
            learnerIndex,
          })
          const residual =
            Number(correct) -
            probability(theta, {
              a: item.discrimination,
              b: item.difficulty,
              c: item.guessing,
            })
          allItemResiduals.push(residual)
          if (definition.id === 'item-type-dif-sc') {
            const residuals =
              item.itemType === 'SC'
                ? affectedItemResiduals
                : referenceItemResiduals
            residuals.push(residual)
          }
          return {
            item: {
              id: item.id,
              itemType: item.itemType,
              choiceCount: item.choiceCount,
              model: item.model,
              calibrationId: item.calibrationId!,
              discrimination: item.discrimination,
              difficulty: item.difficulty,
              guessing: item.guessing,
            },
            correct,
          } satisfies AdaptiveScoredResponse
        })
      const responses = responseOutcomes
      if (definition.id === 'item-type-dif-sc') {
        difPairedLearnerContrasts.push(
          meanProbe(affectedItemResiduals) - meanProbe(referenceItemResiduals)
        )
      } else if (definition.id === 'course-cohort-dif') {
        const learnerMeans =
          learnerIndex % 2 === 0
            ? difAffectedLearnerMeans
            : difReferenceLearnerMeans
        learnerMeans.push(meanProbe(allItemResiduals))
      }
      const posterior = estimateEapPosterior({
        responses,
        scale: ADAPTIVE_V2_SCALE,
        credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
      })
      const classification = classifyPosterior({
        posterior,
        scale: ADAPTIVE_V2_SCALE,
        credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
        probabilityThreshold,
        evidenceSatisfied: true,
        evidenceReachable: true,
        calibratedCoverageSatisfied: true,
        integritySatisfied: true,
        terminalReason: 'TOTAL_QUESTION_CAP',
      })
      errors.push(posterior.mean - theta)
      if (
        theta >= posterior.credibleLower &&
        theta <= posterior.credibleUpper
      ) {
        covered++
      }
      if (classification.status === 'CLASSIFIED') classified++
      learnerCount++
    }
  }

  const meanBias = meanProbe(errors)
  const rmse = Math.sqrt(meanProbe(errors.map((error) => error * error)))
  const finite =
    Number.isFinite(meanBias) &&
    Number.isFinite(rmse) &&
    covered >= 0 &&
    classified >= 0
  const difResidualContrastLower95 =
    difPairedLearnerContrasts.length > 0
      ? deterministicBootstrapAbsoluteMeanLower({
          values: difPairedLearnerContrasts,
          seed: probeSeed(`${definition.id}:dif-bootstrap`, 0),
          replicates: scenarioPolicy.difBootstrapReplicates,
        })
      : difAffectedLearnerMeans.length > 0 &&
          difReferenceLearnerMeans.length > 0
        ? deterministicBootstrapDifferenceLower({
            left: difAffectedLearnerMeans,
            right: difReferenceLearnerMeans,
            seed: probeSeed(`${definition.id}:dif-bootstrap`, 0),
            replicates: scenarioPolicy.difBootstrapReplicates,
          })
        : null
  return {
    id: definition.id,
    category: definition.category,
    learnerCount,
    meanBias,
    rmse,
    credibleCoverage: covered / learnerCount,
    classificationRate: classified / learnerCount,
    executedSuccessfully: finite,
    releaseGate:
      difResidualContrastLower95 === null
        ? null
        : {
            name: `scenario:${definition.id}:difResidualContrastLower95`,
            passed:
              difResidualContrastLower95 >=
              scenarioPolicy.minimumDifResidualContrast,
            actual: difResidualContrastLower95,
            comparison: 'GTE',
            target: scenarioPolicy.minimumDifResidualContrast,
            required: `>= ${scenarioPolicy.minimumDifResidualContrast}`,
          },
    note: definition.shippingProfile
      ? 'Canonical release metrics are evaluated separately with full strata and gates.'
      : 'Exploratory stress evidence only; it cannot approve a release policy.',
  }
}

function resolveProbeItems(
  baseItems: AdaptiveV2SimulationItem[],
  definition: AdaptiveV2ScenarioDefinition
) {
  let items = baseItems.map((item) => ({
    ...item,
    nodePath: [...item.nodePath],
  }))
  const requestedType = definition.parameters.itemType
  if (typeof requestedType === 'string' && requestedType !== 'MIXED') {
    items = items.filter(({ itemType }) => itemType === requestedType)
  }
  if (definition.id === 'pool-sparse') items = items.slice(0, 12)
  if (definition.id === 'pool-rich') {
    items = [
      ...items,
      ...items.map((item) => ({
        ...item,
        id: item.id + 10_000,
        calibrationId: `${item.calibrationId}-replicate`,
      })),
    ]
  }
  if (definition.id === 'incorrect-provisional-b') {
    items = items.map((item) => ({
      ...item,
      difficulty: item.difficulty + 0.35,
    }))
  }
  if (definition.id === 'item-drift') {
    items = items.map((item) => ({
      ...item,
      trueDifficulty: item.trueDifficulty + 0.3,
    }))
  }
  if (definition.id === 'item-type-dif-sc') {
    const difficultyShift = Number(definition.parameters.difficultyShift)
    items = items.map((item) =>
      item.itemType === 'SC'
        ? { ...item, trueDifficulty: item.trueDifficulty + difficultyShift }
        : item
    )
  }
  if (definition.id === 'adjacent-band-mislabel') {
    items = items.map((item, index) =>
      index % 5 === 0
        ? {
            ...item,
            trueDifficulty: item.levelId === 3 ? 0 : item.levelId === 1 ? 0 : 3,
          }
        : item
    )
  }
  if (definition.id.startsWith('true-a-')) {
    const trueDiscrimination = Number(definition.parameters.trueDiscrimination)
    items = items.map((item) => ({ ...item, trueDiscrimination }))
  }
  if (definition.id === 'calibrated-provisional-contamination') {
    items = items.map((item, index) =>
      index % 5 === 0 ? { ...item, calibrationId: null } : item
    )
  }
  return items
}

function resolveProbeTheta(
  theta: number,
  learnerIndex: number,
  definition: AdaptiveV2ScenarioDefinition
) {
  void learnerIndex
  void definition
  return theta
}

function posteriorForProbeItems(
  items: AdaptiveV2SimulationItem[],
  theta: number,
  random: () => number
) {
  return estimateEapPosterior({
    responses: probeResponses(items, theta, random),
    scale: ADAPTIVE_V2_SCALE,
    credibleMass: ADAPTIVE_V2_RELEASE_POLICY.credibleMass,
  })
}

function probeResponses(
  items: AdaptiveV2SimulationItem[],
  theta: number,
  random: () => number
): AdaptiveScoredResponse[] {
  return items.map((item) => ({
    item: {
      id: item.id,
      itemType: item.itemType,
      choiceCount: item.choiceCount,
      model: item.model,
      calibrationId: item.calibrationId!,
      discrimination: item.discrimination,
      difficulty: item.difficulty,
      guessing: item.guessing,
    },
    correct:
      random() <
      probability(theta, {
        a: item.trueDiscrimination,
        b: item.trueDifficulty,
        c: item.trueGuessing,
      }),
  }))
}

function probeCorrect({
  item,
  theta,
  random,
  definition,
  learnerIndex,
}: {
  item: AdaptiveV2SimulationItem
  theta: number
  random: () => number
  definition: AdaptiveV2ScenarioDefinition
  learnerIndex: number
}) {
  if (definition.id === 'all-correct') return true
  if (definition.id === 'all-wrong') return false
  if (definition.id === 'guessing-only') return random() < item.trueGuessing
  const trueLevel = levelForTheta(theta, ADAPTIVE_V2_SCALE.levels)!
  if (definition.id === 'response-deterministic-threshold') {
    return item.levelId <= trueLevel.id
  }
  if (definition.id.startsWith('response-')) {
    const correctPercent = Number(definition.parameters.correctPercent)
    const atOrBelowProbability = correctPercent / 100
    const residualFraction = 1 - atOrBelowProbability
    const aboveProbability =
      item.trueGuessing + residualFraction * (1 - item.trueGuessing)
    return (
      random() <
      (item.levelId <= trueLevel.id ? atOrBelowProbability : aboveProbability)
    )
  }
  return (
    random() <
    probability(theta, {
      a: item.trueDiscrimination,
      b:
        item.trueDifficulty +
        (definition.id === 'course-cohort-dif' && learnerIndex % 2 === 0
          ? Number(definition.parameters.difficultyShift)
          : 0),
      c: item.trueGuessing,
    })
  )
}

function meanProbe(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
