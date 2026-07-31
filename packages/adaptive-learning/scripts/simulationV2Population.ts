import {
  probability,
  type AdaptiveItemType,
  type AdaptiveRuntimeResponse,
  type AdaptiveScaleDefinition,
  type AdaptiveV2PoolItem,
  type PreparedAdaptiveV2Runtime,
} from '../src/index.js'
import {
  computeAdaptiveV2Estimates,
  countAdaptiveV2Responses,
} from '../src/runtimeV2Estimation.js'
import {
  buildLearnerEvidence,
  simulateAdaptiveAttemptAcrossThresholds,
} from './simulationV2Attempt.js'
import {
  createSimulationRandom,
  mixSeed,
  prepareSimulationRuntime,
  stableHash32,
} from './simulationV2Support.js'
import type {
  AdaptiveV2SimulationInput,
  ClassifiedObservation,
  LearnerEvidence,
} from './simulationV2Types.js'

export function generateLearnerEvidence(
  input: AdaptiveV2SimulationInput,
  runtime: PreparedAdaptiveV2Runtime,
  thresholds: number[]
) {
  const byThreshold = new Map(
    thresholds.map((threshold) => [threshold, [] as LearnerEvidence[]])
  )
  const retakePairsByThreshold = new Map(
    thresholds.map((threshold) => [
      threshold,
      [] as Array<{ primary: number[]; retake: number[] }>,
    ])
  )
  const baseSeed = stableHash32(input.seed)

  for (const level of input.scale.levels) {
    for (
      let learnerIndex = 0;
      learnerIndex < input.learnersPerBand;
      learnerIndex++
    ) {
      const globalIndex = level.order * input.learnersPerBand + learnerIndex
      const learnerSeed = mixSeed(baseSeed, globalIndex + 1)
      const ability = simulatedAbility({
        level,
        learnerIndex,
        nearCutLearnersPerBand: input.simulationSettings.nearCutLearnersPerBand,
        cutSideOffset: input.simulationSettings.cutSideOffset,
        interiorThetaJitter: input.simulationSettings.interiorThetaJitter,
        interiorThetaCells: input.simulationSettings.interiorThetaCells,
        random: createSimulationRandom(mixSeed(learnerSeed, 0xabc123)),
      })
      const learnerId = `irt-v2:${input.seed}:${level.order}:${learnerIndex}`
      const interiorLearnersPerBand =
        input.learnersPerBand - input.simulationSettings.nearCutLearnersPerBand
      const cohortSequence =
        ability.cutDistance === 'NEAR_CUT'
          ? level.order * input.simulationSettings.nearCutLearnersPerBand +
            learnerIndex
          : level.order * interiorLearnersPerBand +
            learnerIndex -
            input.simulationSettings.nearCutLearnersPerBand
      const cohortIndex = cohortSequence % input.courseCohorts.length
      const outcomes = simulateAdaptiveAttemptAcrossThresholds({
        attemptId: `${learnerId}:primary`,
        runtime,
        thresholds,
        pool: input.pool,
        trueTheta: ability.theta,
        trueLevelId: level.id,
        courseCohort: input.courseCohorts[cohortIndex]!,
        cutDistance: ability.cutDistance,
        thetaCellKey: ability.thetaCellKey,
        responseSeed: mixSeed(learnerSeed, 0xdef456),
      })
      for (const threshold of thresholds) {
        byThreshold.get(threshold)!.push(outcomes.get(threshold)!)
      }
    }
  }

  for (const threshold of thresholds) {
    const thresholdRuntime = prepareSimulationRuntime(input, threshold)
    const retakeEvidence = selectStratifiedRetakeEvidence(
      byThreshold.get(threshold)!,
      input.simulationSettings.retakeLearnersPerThreshold
    )
    for (const primary of retakeEvidence) {
      const retake = simulateAdaptiveAttemptAcrossThresholds({
        attemptId: `${primary.learnerId}:retake:${threshold}`,
        runtime: thresholdRuntime,
        thresholds: [threshold],
        pool: input.pool,
        trueTheta: primary.trueTheta,
        trueLevelId: primary.trueLevelId,
        courseCohort: primary.courseCohort,
        cutDistance: primary.cutDistance,
        thetaCellKey: primary.thetaCellKey,
        responseSeed: mixSeed(
          stableHash32(primary.learnerId),
          Math.round(threshold * 10_000) + 0x7e7a
        ),
        priorAttemptPoolItemIds: new Set(primary.selectedItemIds),
      }).get(threshold)!
      retakePairsByThreshold.get(threshold)!.push({
        primary: primary.selectedItemIds,
        retake: retake.selectedItemIds,
      })
    }
  }

  return { byThreshold, retakePairsByThreshold }
}

export function generateItemTypeEvidence(
  input: AdaptiveV2SimulationInput,
  thresholds: number[]
) {
  const evidence = new Map(
    thresholds.map((threshold) => [
      threshold,
      new Map<AdaptiveItemType, ClassifiedObservation[]>(),
    ])
  )
  const maximumThreshold = thresholds.at(-1)!
  const baseSeed = stableHash32(`${input.seed}:item-type`)

  for (const itemType of [
    'NUMERICAL',
    'SC',
    'MC',
    'KPRIM',
    'FREE_TEXT',
  ] as const) {
    const pool = input.pool.filter((item) => item.itemType === itemType)
    const runtime = prepareSimulationRuntime(
      input,
      maximumThreshold,
      pool,
      pool.length
    )
    for (
      let learnerIndex = 0;
      learnerIndex < input.simulationSettings.itemTypeLearnersPerType;
      learnerIndex++
    ) {
      const level =
        input.scale.levels[learnerIndex % input.scale.levels.length]!
      const random = createSimulationRandom(
        mixSeed(baseSeed, itemType.length * 65_537 + learnerIndex)
      )
      const theta = interiorAbility({
        level,
        cellIndex: Math.floor(learnerIndex / input.scale.levels.length),
        interiorThetaCells: input.simulationSettings.interiorThetaCells,
        jitter: input.simulationSettings.interiorThetaJitter,
        random,
      }).theta
      const responses = pool.map(
        (item, index): AdaptiveRuntimeResponse<AdaptiveV2PoolItem> => ({
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
        })
      )
      const estimates = computeAdaptiveV2Estimates({
        runtime,
        responses,
        eligibleScoringItems: [],
        counts: countAdaptiveV2Responses(responses),
        terminalReason: 'POOL_EXHAUSTED',
      })
      for (const threshold of thresholds) {
        const learner = buildLearnerEvidence({
          learnerId: `irt-v2-type:${itemType}:${learnerIndex}`,
          trueTheta: theta,
          trueLevelId: level.id,
          courseCohort: `ITEM_TYPE_${itemType}`,
          cutDistance: 'INTERIOR',
          thetaCellKey: null,
          responses,
          responseBits: responses.map(({ correct }) => (correct ? '1' : '0')),
          estimates,
          runtime,
          threshold,
          stopReason: 'POOL_EXHAUSTED',
        })
        const byType = evidence.get(threshold)!
        const observations = byType.get(itemType) ?? []
        observations.push(learner.observation)
        byType.set(itemType, observations)
      }
    }
  }

  return evidence
}

function simulatedAbility({
  level,
  learnerIndex,
  nearCutLearnersPerBand,
  cutSideOffset,
  interiorThetaJitter,
  interiorThetaCells,
  random,
}: {
  level: AdaptiveScaleDefinition['levels'][number]
  learnerIndex: number
  nearCutLearnersPerBand: number
  cutSideOffset: number
  interiorThetaJitter: number
  interiorThetaCells: AdaptiveV2SimulationInput['simulationSettings']['interiorThetaCells']
  random: () => number
}) {
  if (learnerIndex < nearCutLearnersPerBand) {
    const finiteBounds = [level.lowerBound, level.upperBound].filter(
      Number.isFinite
    )
    const cut = finiteBounds[learnerIndex % finiteBounds.length]!
    const direction = cut === level.lowerBound ? 1 : -1
    return {
      theta: cut + direction * cutSideOffset,
      cutDistance: 'NEAR_CUT' as const,
      thetaCellKey: null,
    }
  }

  const interior = interiorAbility({
    level,
    cellIndex: learnerIndex - nearCutLearnersPerBand,
    interiorThetaCells,
    jitter: interiorThetaJitter,
    random,
  })
  return {
    theta: interior.theta,
    cutDistance: 'INTERIOR' as const,
    thetaCellKey: interior.thetaCellKey,
  }
}

function interiorAbility({
  level,
  cellIndex,
  interiorThetaCells,
  jitter,
  random,
}: {
  level: AdaptiveScaleDefinition['levels'][number]
  cellIndex: number
  interiorThetaCells: AdaptiveV2SimulationInput['simulationSettings']['interiorThetaCells']
  jitter: number
  random: () => number
}) {
  const cells = interiorThetaCells.find(({ levelId }) => levelId === level.id)!
  const index = cellIndex % cells.values.length
  const center = cells.values[index]!
  return {
    theta: center + (random() - 0.5) * jitter,
    thetaCellKey: thetaCellKey(level, index, center),
  }
}

export function selectStratifiedRetakeEvidence<
  T extends Pick<
    LearnerEvidence,
    'learnerId' | 'trueLevelId' | 'cutDistance' | 'courseCohort'
  >,
>(evidence: readonly T[], requestedCount: number): T[] {
  if (!Number.isInteger(requestedCount) || requestedCount < 0) {
    throw new TypeError('Retake evidence sample size must be non-negative.')
  }
  const groups = new Map<string, T[]>()
  for (const learner of evidence) {
    const key = [
      learner.trueLevelId,
      learner.cutDistance,
      learner.courseCohort,
    ].join(':')
    const group = groups.get(key) ?? []
    group.push(learner)
    groups.set(key, group)
  }
  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) =>
      group.sort(
        (left, right) =>
          stableHash32(left.learnerId) - stableHash32(right.learnerId) ||
          left.learnerId.localeCompare(right.learnerId)
      )
    )
  const selected: T[] = []
  for (
    let round = 0;
    selected.length < Math.min(requestedCount, evidence.length);
    round++
  ) {
    let selectedInRound = false
    for (const group of orderedGroups) {
      const learner = group[round]
      if (learner === undefined) continue
      selected.push(learner)
      selectedInRound = true
      if (selected.length === Math.min(requestedCount, evidence.length)) break
    }
    if (!selectedInRound) break
  }
  return selected
}

function thetaCellKey(
  level: AdaptiveScaleDefinition['levels'][number],
  index: number,
  center: number
) {
  return `theta-cell:${level.label}:${index}:${center}`
}
