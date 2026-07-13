import {
  advanceAdaptiveRuntime,
  deriveGuessingParameter,
  mapLevelsToTheta,
  mapThetaToLevel,
  prepareAdaptiveRuntime,
  probability,
  type AdaptiveItemType,
  type AdaptiveRuntimeCoverage,
  type AdaptiveRuntimeEstimates,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeStopReason,
  type LevelDefinition,
  type LevelMappingRule,
  type ThetaRange,
} from '../src/index.js'

export const SIMULATION_LEVELS: LevelDefinition[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
].map((label, order) => ({ label, order }))

export type SimulationItemMix =
  | 'SC_ONLY'
  | 'CHOICES'
  | 'OPEN_RESPONSE'
  | 'MIXED'

export type SimulationStopReason = Exclude<
  AdaptiveRuntimeStopReason,
  'CLASSIFIED' | 'ABANDONED'
>

export type AdaptiveSimulationConfig = {
  label: string
  mappingRule: LevelMappingRule
  itemMix: SimulationItemMix
  rootCount: number
  leavesPerRoot: number
  itemsPerLevel: number
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  topInformationRatio: number
  discrimination: number
  mislabelProbability: number
  learnersPerLevel: number
  range?: ThetaRange
}

export type AdaptiveSimulationMetrics = {
  learnerCount: number
  exactAccuracy: number
  adjacentAccuracy: number
  meanAbsoluteLevelError: number
  meanQuestionCount: number
  p95QuestionCount: number
  stopReasons: Record<SimulationStopReason, number>
  perLevelAccuracy: Record<string, number>
  perLevelBias: Record<string, number>
  topLevelReached: boolean
}

type SimulationItem = AdaptiveRuntimePoolItem & {
  type: AdaptiveItemType
  trueDifficulty: number
}

type LearnerResult = {
  expectedLevelIndex: number
  estimatedLevelIndex: number
  answeredQuestions: number
  stopReason: SimulationStopReason
}

const DEFAULT_RANGE = { min: -3, max: 3 }

export function runAdaptiveSimulation(
  config: AdaptiveSimulationConfig
): AdaptiveSimulationMetrics {
  const range = config.range ?? DEFAULT_RANGE
  const fixture = buildRuntimeFixture(config, range)
  const runtime = prepareAdaptiveRuntime({
    ...fixture,
    settings: {
      totalQuestionCap: config.totalQuestionCap,
      perLeafQuestionCap: config.perLeafQuestionCap,
      minQuestionsPerLeaf: config.minQuestionsPerLeaf,
      classificationZ: config.classificationZ,
      topInformationRatio: config.topInformationRatio,
      levelMappingRule: config.mappingRule,
      thetaRange: range,
    },
  })
  const mappedLevels = mapLevelsToTheta(
    SIMULATION_LEVELS,
    range,
    config.mappingRule
  )
  const results = SIMULATION_LEVELS.flatMap((level) =>
    Array.from({ length: config.learnersPerLevel }, (_, learnerIndex) => {
      const abilityRandom = mulberry32(
        100_000 + level.order * 1_009 + learnerIndex * 7_919
      )
      const responseRandom = mulberry32(
        200_000 + level.order * 1_009 + learnerIndex * 7_919
      )
      const band = mappedLevels[level.order]!
      const lower = Number.isFinite(band.lowerBound)
        ? Math.max(band.lowerBound, range.min)
        : range.min
      const upper = Number.isFinite(band.upperBound)
        ? Math.min(band.upperBound, range.max)
        : range.max
      const inset = (upper - lower) * 0.08
      const thetaTrue =
        lower + inset + abilityRandom() * Math.max(upper - lower - 2 * inset, 0)

      return simulateLearner({
        attemptId: `simulation:${level.order}:${learnerIndex}`,
        runtime,
        thetaTrue,
        expectedLevelIndex: level.order,
        responseRandom,
        range,
        mappingRule: config.mappingRule,
      })
    })
  )

  return summarize(results)
}

function simulateLearner({
  attemptId,
  runtime,
  thetaTrue,
  expectedLevelIndex,
  responseRandom,
  range,
  mappingRule,
}: {
  attemptId: string
  runtime: ReturnType<typeof prepareAdaptiveRuntime<SimulationItem>>
  thetaTrue: number
  expectedLevelIndex: number
  responseRandom: () => number
  range: ThetaRange
  mappingRule: LevelMappingRule
}): LearnerResult {
  const responses: AdaptiveRuntimeResponse<SimulationItem>[] = []

  while (true) {
    const decision = advanceAdaptiveRuntime({ attemptId, runtime, responses })
    if (decision.stopReason !== null) {
      return completeLearner({
        expectedLevelIndex,
        answeredQuestions: responses.length,
        stopReason: asSimulationStopReason(decision.stopReason),
        estimates: decision.estimates,
        range,
        mappingRule,
      })
    }

    const item = decision.nextPoolItem
    if (!item) {
      throw new Error('Adaptive runtime returned neither an item nor a reason.')
    }
    responses.push({
      order: responses.length + 1,
      poolItemId: item.id,
      poolItem: item,
      correct:
        responseRandom() <
        probability(thetaTrue, {
          a: item.discrimination,
          b: item.trueDifficulty,
          c: item.guessing,
        }),
    })
  }
}

function completeLearner({
  expectedLevelIndex,
  answeredQuestions,
  stopReason,
  estimates,
  range,
  mappingRule,
}: {
  expectedLevelIndex: number
  answeredQuestions: number
  stopReason: SimulationStopReason
  estimates: AdaptiveRuntimeEstimates
  range: ThetaRange
  mappingRule: LevelMappingRule
}): LearnerResult {
  const estimated = mapThetaToLevel(
    estimates.overall.theta ?? 0,
    SIMULATION_LEVELS,
    range,
    mappingRule
  )

  return {
    expectedLevelIndex,
    estimatedLevelIndex: estimated?.order ?? 0,
    answeredQuestions,
    stopReason,
  }
}

function buildRuntimeFixture(
  config: AdaptiveSimulationConfig,
  range: ThetaRange
) {
  const levels: AdaptiveRuntimeLevel[] = mapLevelsToTheta(
    SIMULATION_LEVELS,
    range,
    config.mappingRule
  ).map((level) => ({
    id: level.order + 1,
    label: level.label,
    order: level.order,
  }))
  const mappedLevels = mapLevelsToTheta(
    SIMULATION_LEVELS,
    range,
    config.mappingRule
  )
  const nodes: AdaptiveRuntimeNode[] = []
  const coverages: AdaptiveRuntimeCoverage[] = []
  const pool: SimulationItem[] = []
  const itemTypes = itemTypesFor(config.itemMix)
  const poolRandom = mulberry32(300_000)
  const rawWeights = Array.from(
    { length: config.rootCount },
    (_, index) => config.rootCount - index
  )
  const weightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0)
  let nodeId = 1
  let itemId = 1

  for (let rootIndex = 0; rootIndex < config.rootCount; rootIndex++) {
    const rootId = nodeId++
    nodes.push({
      id: rootId,
      parentId: null,
      kind: 'COMPETENCE',
      depth: 1,
      order: rootIndex,
      enabled: true,
      weight: rawWeights[rootIndex]! / weightTotal,
      questionCap: null,
    })

    for (let leafIndex = 0; leafIndex < config.leavesPerRoot; leafIndex++) {
      const leafId = nodeId++
      nodes.push({
        id: leafId,
        parentId: rootId,
        kind: 'SUBCOMPETENCE',
        depth: 2,
        order: leafIndex,
        enabled: true,
        weight: null,
        questionCap: null,
      })

      for (const level of levels) {
        coverages.push({
          leafNodeId: leafId,
          levelId: level.id,
          targetItemCount: 1,
          enabled: true,
        })
        for (let itemIndex = 0; itemIndex < config.itemsPerLevel; itemIndex++) {
          const type = itemTypes[(itemId - 1) % itemTypes.length]!
          const choiceCount = choiceCountFor(type)
          const shifted =
            config.mislabelProbability > 0 &&
            poolRandom() < config.mislabelProbability
          const levelShift = shifted ? (poolRandom() < 0.5 ? -1 : 1) : 0
          const trueLevelIndex = Math.max(
            0,
            Math.min(levels.length - 1, level.order + levelShift)
          )
          pool.push({
            id: itemId++,
            type,
            leafNodeId: leafId,
            nodePath: [rootId, leafId],
            levelId: level.id,
            discrimination: config.discrimination,
            difficulty: mappedLevels[level.order]!.theta,
            guessing: deriveGuessingParameter({ type, choiceCount }),
            trueDifficulty: mappedLevels[trueLevelIndex]!.theta,
          })
        }
      }
    }
  }

  return { nodes, levels, coverages, pool }
}

function summarize(results: LearnerResult[]): AdaptiveSimulationMetrics {
  const distances = results.map((result) =>
    Math.abs(result.estimatedLevelIndex - result.expectedLevelIndex)
  )
  const questionCounts = results
    .map(({ answeredQuestions }) => answeredQuestions)
    .sort((left, right) => left - right)
  const stopReasons: Record<SimulationStopReason, number> = {
    ALL_ROOTS_CLASSIFIED: 0,
    TOTAL_QUESTION_CAP: 0,
    NODE_QUESTION_CAP: 0,
    POOL_EXHAUSTED: 0,
    INSUFFICIENT_DATA: 0,
  }
  for (const result of results) stopReasons[result.stopReason] += 1

  const perLevelAccuracy = Object.fromEntries(
    SIMULATION_LEVELS.map((level) => {
      const levelResults = results.filter(
        ({ expectedLevelIndex }) => expectedLevelIndex === level.order
      )
      return [
        level.label,
        levelResults.filter(
          ({ estimatedLevelIndex }) => estimatedLevelIndex === level.order
        ).length / levelResults.length,
      ]
    })
  )
  const perLevelBias = Object.fromEntries(
    SIMULATION_LEVELS.map((level) => {
      const levelResults = results.filter(
        ({ expectedLevelIndex }) => expectedLevelIndex === level.order
      )
      const bias =
        levelResults.reduce(
          (sum, result) =>
            sum + result.estimatedLevelIndex - result.expectedLevelIndex,
          0
        ) / levelResults.length
      return [level.label, bias]
    })
  )

  return {
    learnerCount: results.length,
    exactAccuracy:
      distances.filter((distance) => distance === 0).length / results.length,
    adjacentAccuracy:
      distances.filter((distance) => distance <= 1).length / results.length,
    meanAbsoluteLevelError:
      distances.reduce((sum, distance) => sum + distance, 0) / results.length,
    meanQuestionCount:
      questionCounts.reduce((sum, count) => sum + count, 0) / results.length,
    p95QuestionCount:
      questionCounts[Math.ceil(questionCounts.length * 0.95) - 1] ?? 0,
    stopReasons,
    perLevelAccuracy,
    perLevelBias,
    topLevelReached: results.some(
      ({ expectedLevelIndex, estimatedLevelIndex }) =>
        expectedLevelIndex === SIMULATION_LEVELS.length - 1 &&
        estimatedLevelIndex === SIMULATION_LEVELS.length - 1
    ),
  }
}

function itemTypesFor(mix: SimulationItemMix): AdaptiveItemType[] {
  switch (mix) {
    case 'SC_ONLY':
      return ['SC']
    case 'CHOICES':
      return ['SC', 'MC', 'KPRIM']
    case 'OPEN_RESPONSE':
      return ['NUMERICAL', 'FREE_TEXT']
    case 'MIXED':
      return ['SC', 'MC', 'KPRIM', 'NUMERICAL', 'FREE_TEXT']
  }
}

function choiceCountFor(type: AdaptiveItemType) {
  return type === 'SC' || type === 'MC' || type === 'KPRIM' ? 4 : undefined
}

function asSimulationStopReason(
  reason: AdaptiveRuntimeStopReason
): SimulationStopReason {
  if (reason === 'CLASSIFIED' || reason === 'ABANDONED') {
    throw new Error(`Unexpected simulation stop reason ${reason}.`)
  }
  return reason
}

function mulberry32(seed: number) {
  return function random() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
