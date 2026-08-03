import { createHash } from 'node:crypto'
import {
  ADAPTIVE_SECONDS_PER_ITEM,
  type AdaptiveItemType,
  deriveGuessingParameter,
  prepareAdaptiveV2Runtime,
} from '../src/index.js'
import type {
  AdaptiveV2SimulationInput,
  AdaptiveV2SimulationItem,
} from './simulationV2Types.js'

export function fingerprintAdaptiveSimulationInput(input: unknown): string {
  return createHash('sha256').update(stableSerialize(input)).digest('hex')
}

export function createSimulationRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function simulationChoiceCountFor(type: AdaptiveItemType) {
  return type === 'SC' || type === 'MC' || type === 'KPRIM' ? 4 : null
}

export function assertSimulationInput(input: AdaptiveV2SimulationInput) {
  if (input.estimatorVersion !== 'IRT_V2_EAP_GRID_1') {
    throw new TypeError('The v2 simulation requires IRT_V2_EAP_GRID_1.')
  }
  if (
    !Number.isInteger(input.learnersPerBand) ||
    input.learnersPerBand <
      input.policy.minimumSimulatedLearnersPerRequiredStratum
  ) {
    throw new TypeError(
      'Simulation learners per band must satisfy the release policy minimum.'
    )
  }
  if (
    !Number.isInteger(input.itemsPerAttempt) ||
    input.itemsPerAttempt < 1 ||
    input.itemsPerAttempt > input.pool.length
  ) {
    throw new TypeError('Simulation items per attempt are invalid.')
  }
  if (input.courseCohorts.length === 0) {
    throw new TypeError('At least one simulation course cohort is required.')
  }
  const scenarioPolicy = input.scenarioPolicy
  if (
    !Number.isInteger(scenarioPolicy.modelLearnersPerTheta) ||
    scenarioPolicy.modelLearnersPerTheta < 1 ||
    scenarioPolicy.modelThetaValues.length === 0 ||
    scenarioPolicy.modelThetaValues.some((theta) => !Number.isFinite(theta)) ||
    !Number.isInteger(scenarioPolicy.difLearnersPerTheta) ||
    scenarioPolicy.difLearnersPerTheta < 1 ||
    !Number.isInteger(scenarioPolicy.cutExploratoryLearnersPerTheta) ||
    scenarioPolicy.cutExploratoryLearnersPerTheta < 1 ||
    !Number.isFinite(scenarioPolicy.cutSideOffset) ||
    scenarioPolicy.cutSideOffset <= 0 ||
    !Number.isInteger(scenarioPolicy.capLearnersPerLevel) ||
    scenarioPolicy.capLearnersPerLevel < 1 ||
    !Number.isInteger(scenarioPolicy.researchInclusionDraws) ||
    scenarioPolicy.researchInclusionDraws < 1 ||
    !Number.isInteger(scenarioPolicy.difBootstrapReplicates) ||
    scenarioPolicy.difBootstrapReplicates <
      (input.evidenceProfile === 'RELEASE' ? 1_000 : 100) ||
    scenarioPolicy.difBootstrapUnit !== 'LEARNER_CLUSTER_V1' ||
    !Number.isFinite(scenarioPolicy.minimumDifResidualContrast) ||
    scenarioPolicy.minimumDifResidualContrast <= 0
  ) {
    throw new TypeError('Simulation scenario policy is invalid.')
  }
  const settings = input.simulationSettings
  if (
    !Number.isInteger(settings.bootstrapReplicates) ||
    settings.bootstrapReplicates <
      (input.evidenceProfile === 'RELEASE' ? 1_000 : 100) ||
    !Number.isFinite(settings.wilsonZ) ||
    settings.wilsonZ <= 0 ||
    !Number.isInteger(settings.nearCutLearnersPerBand) ||
    settings.nearCutLearnersPerBand < 1 ||
    settings.nearCutLearnersPerBand >= input.learnersPerBand ||
    input.learnersPerBand - settings.nearCutLearnersPerBand <
      input.policy.minimumSimulatedLearnersPerRequiredStratum ||
    !Number.isFinite(settings.cutSideOffset) ||
    settings.cutSideOffset <= 0 ||
    settings.cutSideOffset > input.policy.cutNeighborhoodWidth ||
    !Number.isFinite(settings.interiorThetaJitter) ||
    settings.interiorThetaJitter < 0 ||
    !Number.isInteger(settings.itemTypeLearnersPerType) ||
    settings.itemTypeLearnersPerType <
      input.policy.minimumSimulatedLearnersPerRequiredStratum ||
    !Number.isInteger(settings.retakeLearnersPerThreshold) ||
    settings.retakeLearnersPerThreshold < 1 ||
    !Number.isInteger(settings.pairwiseFormSampleSize) ||
    settings.pairwiseFormSampleSize < 2 ||
    settings.secondsPerItem !== ADAPTIVE_SECONDS_PER_ITEM ||
    settings.overlapDefinitionVersion.trim().length === 0 ||
    settings.retakeSamplingVersion !== 'STRATIFIED_BAND_CUT_COHORT_V1' ||
    settings.cutSideOffset !== scenarioPolicy.cutSideOffset
  ) {
    throw new TypeError('Simulation statistical settings are invalid.')
  }
  if (settings.interiorThetaCells.length !== input.scale.levels.length) {
    throw new TypeError('Every level requires a theta-cell definition.')
  }
  const interiorLearnersPerBand =
    input.learnersPerBand - settings.nearCutLearnersPerBand
  for (const level of input.scale.levels) {
    const matchingCells = settings.interiorThetaCells.filter(
      ({ levelId }) => levelId === level.id
    )
    if (matchingCells.length !== 1 || matchingCells[0]!.values.length === 0) {
      throw new TypeError('Each level requires one non-empty theta-cell grid.')
    }
    if (
      Math.floor(interiorLearnersPerBand / matchingCells[0]!.values.length) <
      input.policy.minimumSimulatedLearnersPerThetaCell
    ) {
      throw new TypeError('Every theta cell must satisfy its evidence minimum.')
    }
    const halfJitter = settings.interiorThetaJitter / 2
    if (
      matchingCells[0]!.values.some(
        (center) =>
          !Number.isFinite(center) ||
          center - halfJitter <= level.lowerBound ||
          center + halfJitter >= level.upperBound ||
          center - halfJitter < input.runtimeSettings.thetaRange.min ||
          center + halfJitter > input.runtimeSettings.thetaRange.max
      )
    ) {
      throw new TypeError('Theta cells must stay inside their level and range.')
    }
  }
  const supportedThresholds = input.policy.candidateProbabilityThresholds
  if (
    supportedThresholds.length === 0 ||
    supportedThresholds.some(
      (threshold, index) =>
        !Number.isFinite(threshold) ||
        threshold <= 0 ||
        threshold >= 1 ||
        (index > 0 && threshold <= supportedThresholds[index - 1]!)
    )
  ) {
    throw new TypeError('Simulation probability thresholds are invalid.')
  }
  for (const { rootId, weight } of input.rootWeights) {
    const root = input.nodes.find(
      ({ id, parentId }) => id === rootId && parentId === null
    )
    if (root?.weight !== weight) {
      throw new TypeError(
        'Simulation root weights must match the prepared hierarchy.'
      )
    }
  }
  for (const item of input.pool) {
    if (!item.contributesToEstimate || item.calibrationId === null) {
      throw new TypeError(
        'Release model recovery requires calibrated scoring items only.'
      )
    }
    const expectedGuessing = deriveGuessingParameter({
      type: item.itemType,
      choiceCount: item.choiceCount,
    })
    if (item.guessing !== expectedGuessing) {
      throw new TypeError('Simulation item guessing must match its item type.')
    }
  }
  prepareSimulationRuntime(input, supportedThresholds[0]!)
}

export function prepareSimulationRuntime(
  input: AdaptiveV2SimulationInput,
  probabilityThreshold: number,
  pool: AdaptiveV2SimulationItem[] = input.pool,
  totalQuestionCap: number = input.itemsPerAttempt
) {
  return prepareAdaptiveV2Runtime({
    nodes: input.nodes,
    scale: input.scale,
    pool,
    settings: {
      ...input.runtimeSettings,
      totalQuestionCap,
      credibleMass: input.policy.credibleMass,
      classificationProbabilityThreshold: probabilityThreshold,
      researchPolicy: null,
    },
  })
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '"NaN"'
    if (value === Number.POSITIVE_INFINITY) return '"Infinity"'
    if (value === Number.NEGATIVE_INFINITY) return '"-Infinity"'
    if (Object.is(value, -0)) return '0'
    return JSON.stringify(value)
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    )
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(',')}}`
  }
  throw new TypeError('Simulation fingerprints support JSON-shaped data only.')
}

export function stableHash32(value: string) {
  const digest = createHash('sha256').update(value).digest()
  return digest.readUInt32LE(0)
}

export function mixSeed(left: number, right: number) {
  let value = (left ^ right) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}
