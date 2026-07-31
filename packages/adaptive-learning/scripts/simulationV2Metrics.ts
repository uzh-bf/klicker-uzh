import { createHash } from 'node:crypto'
import type { AdaptiveItemType, AdaptiveScaleDefinition } from '../src/index.js'
import type {
  AdaptiveV2SimulationMetrics,
  AdaptiveV2SimulationStratum,
} from './simulationV2Gates.js'
import {
  deterministicBootstrapUpper,
  mean,
  percentile,
  rate,
  rootMeanSquare,
  wilsonInterval,
} from './simulationV2Statistics.js'
import type {
  AdaptiveV2SimulationInput,
  AdaptiveV2SimulationItem,
  ClassifiedObservation,
  LearnerEvidence,
} from './simulationV2Types.js'

export function reduceAdaptiveV2SimulationMetrics({
  evidence,
  itemTypeEvidence,
  input,
  probabilityThreshold,
  maximumExposureRate,
  maximumTestOverlapRate,
  sampledMaximumPairwiseFormOverlapRate,
}: {
  evidence: LearnerEvidence[]
  itemTypeEvidence: Map<AdaptiveItemType, ClassifiedObservation[]>
  input: AdaptiveV2SimulationInput
  probabilityThreshold: number
  maximumExposureRate: number
  maximumTestOverlapRate: number
  sampledMaximumPairwiseFormOverlapRate: number
}): AdaptiveV2SimulationMetrics {
  const overall = evidence.map(({ observation }) => observation)
  const recoveryPopulation = overall.filter(
    ({ cutDistance }) => cutDistance === 'INTERIOR'
  )
  const errors = recoveryPopulation.map(
    ({ estimatedTheta, trueTheta }) => estimatedTheta - trueTheta
  )
  const questionCounts = overall
    .map(({ questionCount }) => questionCount)
    .sort((left, right) => left - right)
  const classified = overall.filter(
    ({ classifiedLevelId }) => classifiedLevelId !== null
  )
  const recoveryClassified = recoveryPopulation.filter(
    ({ classifiedLevelId }) => classifiedLevelId !== null
  )
  const covered = recoveryPopulation.filter(
    ({ trueTheta, credibleLower, credibleUpper }) =>
      trueTheta >= credibleLower && trueTheta <= credibleUpper
  ).length
  const roots = evidence.flatMap((learner) =>
    learner.roots.map((root) => ({ learner, root }))
  )
  const stratum = (key: string, observations: ClassifiedObservation[]) =>
    summarizeStratum({
      key,
      observations,
      scale: input.scale,
      seed: mixSeed(
        stableHash32(`${input.seed}:${probabilityThreshold}`),
        stableHash32(key)
      ),
      bootstrapReplicates: input.simulationSettings.bootstrapReplicates,
      wilsonZ: input.simulationSettings.wilsonZ,
    })
  const strata: AdaptiveV2SimulationStratum[] = [
    ...input.scale.levels.map((level) =>
      stratum(
        `band:${level.label}`,
        evidence
          .filter(
            ({ trueLevelId, cutDistance }) =>
              trueLevelId === level.id && cutDistance === 'INTERIOR'
          )
          .map(({ observation }) => observation)
      )
    ),
    ...input.rootWeights.map(({ rootId }) =>
      stratum(
        `root:${rootId}`,
        roots
          .filter(
            ({ learner, root }) =>
              root.rootId === rootId && learner.cutDistance === 'INTERIOR'
          )
          .map(({ root }) => root.observation)
      )
    ),
    ...(['NUMERICAL', 'SC', 'MC', 'KPRIM', 'FREE_TEXT'] as const).map(
      (itemType) =>
        stratum(`item-type:${itemType}`, itemTypeEvidence.get(itemType) ?? [])
    ),
    ...input.courseCohorts.map((cohort) =>
      stratum(
        `course-cohort:${cohort}`,
        evidence
          .filter(
            ({ courseCohort, cutDistance }) =>
              courseCohort === cohort && cutDistance === 'INTERIOR'
          )
          .map(({ observation }) => observation)
      )
    ),
    ...input.simulationSettings.interiorThetaCells.flatMap((cells) => {
      const level = input.scale.levels.find(({ id }) => id === cells.levelId)!
      return cells.values.map((center, index) => {
        const key = `theta-cell:${level.label}:${index}:${center}`
        return stratum(
          key,
          evidence
            .filter(({ thetaCellKey }) => thetaCellKey === key)
            .map(({ observation }) => observation)
        )
      })
    }),
    ...(['NEAR_CUT', 'INTERIOR'] as const).map((cutDistance) =>
      stratum(
        `cut-distance:${cutDistance}`,
        evidence
          .filter((learner) => learner.cutDistance === cutDistance)
          .map(({ observation }) => observation)
      )
    ),
  ]
  const classificationInterval = wilsonInterval(
    classified.length,
    overall.length,
    input.simulationSettings.wilsonZ
  )
  const requiredRootClassified = overall.filter(
    ({ requiredRootsClassified }) => requiredRootsClassified
  ).length
  const requiredRootInterval = wilsonInterval(
    requiredRootClassified,
    overall.length,
    input.simulationSettings.wilsonZ
  )
  const coverageInterval = wilsonInterval(
    covered,
    recoveryPopulation.length,
    input.simulationSettings.wilsonZ
  )
  const correctClassifications = recoveryClassified.filter(
    ({ classifiedLevelId, trueLevelId }) => classifiedLevelId === trueLevelId
  ).length
  const accuracyInterval = wilsonInterval(
    correctClassifications,
    recoveryClassified.length,
    input.simulationSettings.wilsonZ
  )
  const nonAdjacentErrors = classified.filter(
    ({ classifiedLevelId, trueLevelId }) =>
      levelDistance(classifiedLevelId!, trueLevelId, input.scale) > 1
  ).length
  const nonAdjacentInterval = wilsonInterval(
    nonAdjacentErrors,
    overall.length,
    input.simulationSettings.wilsonZ
  )

  return {
    learnerCount: overall.length,
    classifiedCount: classified.length,
    abstainedCount: overall.length - classified.length,
    classificationRate: rate(classified.length, overall.length),
    classificationRateLower95: classificationInterval.lower,
    requiredRootClassificationRate: rate(
      requiredRootClassified,
      overall.length
    ),
    requiredRootClassificationRateLower95: requiredRootInterval.lower,
    meanBias: mean(errors),
    absoluteBiasUpper95: deterministicBootstrapUpper({
      values: errors,
      seed: mixSeed(stableHash32(input.seed), 0x51a5),
      replicates: input.simulationSettings.bootstrapReplicates,
      statistic: (sample) => Math.abs(mean(sample)),
    }),
    rmse: rootMeanSquare(errors),
    rmseUpper95: deterministicBootstrapUpper({
      values: errors,
      seed: mixSeed(stableHash32(input.seed), 0x72b7),
      replicates: input.simulationSettings.bootstrapReplicates,
      statistic: rootMeanSquare,
    }),
    credibleCoverage: rate(covered, recoveryPopulation.length),
    credibleCoverageLower95: coverageInterval.lower,
    credibleCoverageUpper95: coverageInterval.upper,
    classifiedBandAccuracy: rate(
      correctClassifications,
      recoveryClassified.length
    ),
    classifiedBandAccuracyLower95: accuracyInterval.lower,
    nonAdjacentConfidentErrorRate: rate(nonAdjacentErrors, overall.length),
    nonAdjacentConfidentErrorRateUpper95: nonAdjacentInterval.upper,
    forcedClassificationCount: overall.filter(
      ({ forcedClassification }) => forcedClassification
    ).length,
    unexpectedFallbackCount: overall.filter(
      ({ unexpectedFallback }) => unexpectedFallback
    ).length,
    medianQuestionCount: percentile(questionCounts, 0.5),
    meanQuestionCount: mean(questionCounts),
    p95QuestionCount: percentile(questionCounts, 0.95),
    medianDurationSeconds:
      percentile(questionCounts, 0.5) * input.simulationSettings.secondsPerItem,
    p95DurationSeconds:
      percentile(questionCounts, 0.95) *
      input.simulationSettings.secondsPerItem,
    stopReasons: countBy(overall.map(({ stopReason }) => stopReason)),
    maximumExposureRate,
    maximumTestOverlapRate,
    sampledMaximumPairwiseFormOverlapRate,
    strata,
  }
}

export function summarizeAdaptiveV2ExposureAndOverlap({
  evidence,
  pool,
  retakePairs,
  sampleSize,
}: {
  evidence: LearnerEvidence[]
  pool: AdaptiveV2SimulationItem[]
  retakePairs: Array<{ primary: number[]; retake: number[] }>
  sampleSize: number
}) {
  const exposure = new Map<number, number>()
  for (const learner of evidence) {
    for (const itemId of new Set(learner.selectedItemIds)) {
      exposure.set(itemId, (exposure.get(itemId) ?? 0) + 1)
    }
  }
  const maximumTestOverlapRate = Math.max(
    0,
    ...retakePairs.map(({ primary, retake }) =>
      formOverlap(primary, retake, 'RIGHT')
    )
  )
  const sampledForms = [...evidence]
    .sort(
      (left, right) =>
        stableHash32(left.learnerId) - stableHash32(right.learnerId)
    )
    .slice(0, sampleSize)
  let sampledMaximumPairwiseFormOverlapRate = 0
  for (let left = 0; left < sampledForms.length; left++) {
    for (let right = left + 1; right < sampledForms.length; right++) {
      sampledMaximumPairwiseFormOverlapRate = Math.max(
        sampledMaximumPairwiseFormOverlapRate,
        formOverlap(
          sampledForms[left]!.selectedItemIds,
          sampledForms[right]!.selectedItemIds,
          'SHORTER'
        )
      )
    }
  }

  return {
    maximumExposureRate: Math.max(
      ...pool.map(({ id }) => rate(exposure.get(id) ?? 0, evidence.length))
    ),
    maximumTestOverlapRate,
    sampledMaximumPairwiseFormOverlapRate,
  }
}

function summarizeStratum({
  key,
  observations,
  scale,
  seed,
  bootstrapReplicates,
  wilsonZ,
}: {
  key: string
  observations: ClassifiedObservation[]
  scale: AdaptiveScaleDefinition
  seed: number
  bootstrapReplicates: number
  wilsonZ: number
}): AdaptiveV2SimulationStratum {
  const errors = observations.map(
    ({ estimatedTheta, trueTheta }) => estimatedTheta - trueTheta
  )
  const classified = observations.filter(
    ({ classifiedLevelId }) => classifiedLevelId !== null
  )
  const correct = classified.filter(
    ({ classifiedLevelId, trueLevelId }) => classifiedLevelId === trueLevelId
  ).length
  const nonAdjacent = classified.filter(
    ({ classifiedLevelId, trueLevelId }) =>
      levelDistance(classifiedLevelId!, trueLevelId, scale) > 1
  ).length
  const covered = observations.filter(
    ({ trueTheta, credibleLower, credibleUpper }) =>
      trueTheta >= credibleLower && trueTheta <= credibleUpper
  ).length
  const classificationInterval = wilsonInterval(
    classified.length,
    observations.length,
    wilsonZ
  )
  const accuracyInterval = wilsonInterval(correct, classified.length, wilsonZ)
  const nonAdjacentInterval = wilsonInterval(
    nonAdjacent,
    observations.length,
    wilsonZ
  )
  const misclassified = classified.length - correct
  const misclassificationInterval = wilsonInterval(
    misclassified,
    observations.length,
    wilsonZ
  )
  const coverageInterval = wilsonInterval(covered, observations.length, wilsonZ)

  return {
    key,
    learnerCount: observations.length,
    meanBias: mean(errors),
    absoluteBiasUpper95:
      errors.length === 0
        ? Number.POSITIVE_INFINITY
        : deterministicBootstrapUpper({
            values: errors,
            seed,
            replicates: bootstrapReplicates,
            statistic: (sample) => Math.abs(mean(sample)),
          }),
    rmse: rootMeanSquare(errors),
    rmseUpper95:
      errors.length === 0
        ? Number.POSITIVE_INFINITY
        : deterministicBootstrapUpper({
            values: errors,
            seed: mixSeed(seed, 0x72b7),
            replicates: bootstrapReplicates,
            statistic: rootMeanSquare,
          }),
    classificationRate: rate(classified.length, observations.length),
    classificationRateLower95: classificationInterval.lower,
    classifiedBandAccuracy: rate(correct, classified.length),
    classifiedBandAccuracyLower95: accuracyInterval.lower,
    nonAdjacentConfidentErrorRate: rate(nonAdjacent, observations.length),
    nonAdjacentConfidentErrorRateUpper95: nonAdjacentInterval.upper,
    confidentMisclassificationRate: rate(misclassified, observations.length),
    confidentMisclassificationRateUpper95: misclassificationInterval.upper,
    credibleCoverage: rate(covered, observations.length),
    credibleCoverageLower95: coverageInterval.lower,
    credibleCoverageUpper95: coverageInterval.upper,
  }
}

function formOverlap(
  leftIds: number[],
  rightIds: number[],
  denominator: 'RIGHT' | 'SHORTER'
) {
  const left = new Set(leftIds)
  const right = new Set(rightIds)
  const divisor =
    denominator === 'RIGHT' ? right.size : Math.min(left.size, right.size)
  if (divisor === 0) return 0
  const overlap = [...right].filter((itemId) => left.has(itemId)).length
  return overlap / divisor
}

function levelDistance(
  leftId: number,
  rightId: number,
  scale: AdaptiveScaleDefinition
) {
  const orderById = new Map(scale.levels.map(({ id, order }) => [id, order]))
  return Math.abs(orderById.get(leftId)! - orderById.get(rightId)!)
}

function stableHash32(value: string) {
  const digest = createHash('sha256').update(value).digest()
  return digest.readUInt32LE(0)
}

function mixSeed(left: number, right: number) {
  let value = (left ^ right) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}
