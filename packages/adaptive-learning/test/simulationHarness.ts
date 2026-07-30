import {
  ADAPTIVE_SECONDS_PER_ITEM,
  MIN_ADAPTIVE_REPORTING_RESPONSES,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
  advanceAdaptiveRuntime,
  classificationIntervalWithinLevelBand,
  deriveGuessingParameter,
  mapLevelsToTheta,
  prepareAdaptiveRuntime,
  probability,
  type AdaptiveItemType,
  type AdaptivePresetName,
  type AdaptiveRuntimeEstimate,
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

export const BOUNDARY_DISTANCE_STRATA = [
  'LT_10_PERCENT',
  'FROM_10_TO_LT_25_PERCENT',
  'AT_LEAST_25_PERCENT',
] as const

export type BoundaryDistanceStratum = (typeof BOUNDARY_DISTANCE_STRATA)[number]

export type SimulationItemMix = AdaptiveItemType | 'MIXED'

export type SimulationStopReason = Exclude<
  AdaptiveRuntimeStopReason,
  'CLASSIFIED' | 'ABANDONED'
>

export type RootFailureReason =
  | 'BREADTH_MISSING'
  | 'INTERVAL_CROSSES_BOUNDARY'
  | 'NODE_CAP'
  | 'GLOBAL_CAP'
  | 'POOL_EXHAUSTED_OR_INSUFFICIENT'

export type AdaptiveSimulationConfig = {
  label: string
  preset: AdaptivePresetName
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
  configuredDiscrimination: number
  trueDiscrimination: number
  adjacentLevelShiftProbability: number
  learnersPerLevel: number
  seed: number
  range?: ThetaRange
}

export type ResolvedAdaptiveSimulationConfig = Omit<
  AdaptiveSimulationConfig,
  'range'
> & {
  range: ThetaRange
}

export type AdaptiveSimulationStratumMetrics = {
  learnerCount: number
  estimatedLearnerCount: number
  nullEstimateCount: number
  classificationRate: number | null
  strictPreCapClassificationRate: number | null
  totalQuestionCapRate: number | null
  exactAccuracy: number | null
  adjacentAccuracy: number | null
  meanAbsoluteLevelError: number | null
  signedLevelBias: number | null
  meanQuestionCount: number | null
  p95QuestionCount: number | null
  meanDurationSeconds: number | null
  p95DurationSeconds: number | null
}

export type AdaptiveSimulationRootMetrics = AdaptiveSimulationStratumMetrics & {
  rootId: number
  rootOrder: number
  failureReasons: Record<RootFailureReason, number>
}

export type AdaptiveSimulationMetrics = AdaptiveSimulationStratumMetrics & {
  stopReasons: Record<SimulationStopReason, number>
  rootFailureReasons: Record<RootFailureReason, number>
  byLevel: Record<string, AdaptiveSimulationStratumMetrics>
  byRoot: Record<string, AdaptiveSimulationRootMetrics>
  byBoundaryDistance: Record<
    BoundaryDistanceStratum,
    AdaptiveSimulationStratumMetrics
  >
  itemExposure: Array<{
    itemId: number
    learnerCount: number
    exposureRate: number
  }>
  maxItemExposure: number
  p95ItemExposure: number
  durationAssumptionSecondsPerItem: number
  topLevelReached: boolean
}

export type AdaptiveSimulationEstimateTrace = {
  theta: number | null
  standardError: number | null
  levelIndex: number | null
  levelLabel: string | null
}

export type AdaptiveSimulationItemEvidence = {
  itemId: number
  type: AdaptiveItemType
  rootId: number
  leafId: number
  levelId: number
  configuredDiscrimination: number
  trueDiscrimination: number
  configuredDifficulty: number
  trueDifficulty: number
  guessing: number
}

export type AdaptiveSimulationRootTerminalState = {
  rootId: number
  rootOrder: number
  responseCount: number
  breadthSatisfied: boolean
  intervalWithinLevelBand: boolean
  classified: boolean
  classifiedAtQuestion: number | null
  estimate: AdaptiveSimulationEstimateTrace
  failureReasons: RootFailureReason[]
}

export type AdaptiveSimulationLearnerTrace = {
  learnerId: string
  trueTheta: number
  trueLevelIndex: number
  trueLevelLabel: string
  nearestBoundaryDistance: number
  nearestBoundaryDistanceRatio: number
  boundaryDistanceStratum: BoundaryDistanceStratum
  selectedItemIds: number[]
  responseTrajectory: boolean[]
  answeredQuestions: number
  terminalStopReason: SimulationStopReason
  classifiedAtQuestion: number | null
  overallEstimate: AdaptiveSimulationEstimateTrace
  rootTerminalStates: AdaptiveSimulationRootTerminalState[]
}

export type AdaptiveSimulationResult = {
  config: ResolvedAdaptiveSimulationConfig
  metrics: AdaptiveSimulationMetrics
  itemPool: AdaptiveSimulationItemEvidence[]
  learnerTraces: AdaptiveSimulationLearnerTrace[]
}

type SimulationItem = AdaptiveRuntimePoolItem & {
  type: AdaptiveItemType
  trueDifficulty: number
  trueDiscrimination: number
}

type MetricObservation = {
  expectedLevelIndex: number
  estimatedLevelIndex: number | null
  answeredQuestions: number
  classified: boolean
  classifiedAtQuestion: number | null
  stopReason: SimulationStopReason
}

const DEFAULT_RANGE = { min: -3, max: 3 }

export function runAdaptiveSimulation(
  config: AdaptiveSimulationConfig
): AdaptiveSimulationResult {
  const resolvedConfig = {
    ...config,
    range: config.range ?? DEFAULT_RANGE,
  }
  const fixture = buildRuntimeFixture(resolvedConfig)
  const runtime = prepareAdaptiveRuntime({
    ...fixture,
    settings: {
      totalQuestionCap: resolvedConfig.totalQuestionCap,
      perLeafQuestionCap: resolvedConfig.perLeafQuestionCap,
      minQuestionsPerLeaf: resolvedConfig.minQuestionsPerLeaf,
      classificationZ: resolvedConfig.classificationZ,
      topInformationRatio: resolvedConfig.topInformationRatio,
      levelMappingRule: resolvedConfig.mappingRule,
      thetaRange: resolvedConfig.range,
    },
  })
  const mappedLevels = mapLevelsToTheta(
    SIMULATION_LEVELS,
    resolvedConfig.range,
    resolvedConfig.mappingRule
  )
  const learnerTraces = SIMULATION_LEVELS.flatMap((level) =>
    Array.from(
      { length: resolvedConfig.learnersPerLevel },
      (_, learnerIndex) => {
        const learnerSeed = level.order * 1_009 + learnerIndex * 7_919
        const abilityRandom = mulberry32(
          resolvedConfig.seed + 100_000 + learnerSeed
        )
        const responseRandom = mulberry32(
          resolvedConfig.seed + 200_000 + learnerSeed
        )
        const band = mappedLevels[level.order]!
        const lower = Number.isFinite(band.lowerBound)
          ? Math.max(band.lowerBound, resolvedConfig.range.min)
          : resolvedConfig.range.min
        const upper = Number.isFinite(band.upperBound)
          ? Math.min(band.upperBound, resolvedConfig.range.max)
          : resolvedConfig.range.max
        const bandWidth = upper - lower
        const inset = bandWidth * 0.08
        const trueTheta =
          lower + inset + abilityRandom() * Math.max(bandWidth - 2 * inset, 0)
        const nearestBoundaryDistance = Math.min(
          Number.isFinite(band.lowerBound)
            ? trueTheta - band.lowerBound
            : Number.POSITIVE_INFINITY,
          Number.isFinite(band.upperBound)
            ? band.upperBound - trueTheta
            : Number.POSITIVE_INFINITY
        )
        const nearestBoundaryDistanceRatio =
          bandWidth > 0 ? nearestBoundaryDistance / bandWidth : 0

        return simulateLearner({
          learnerId: `simulation:${resolvedConfig.seed}:${level.order}:${learnerIndex}`,
          runtime,
          trueTheta,
          trueLevelIndex: level.order,
          trueLevelLabel: level.label,
          nearestBoundaryDistance,
          nearestBoundaryDistanceRatio,
          responseRandom,
        })
      }
    )
  )

  return {
    config: resolvedConfig,
    metrics: summarize({
      traces: learnerTraces,
      pool: fixture.pool,
      totalQuestionCap: resolvedConfig.totalQuestionCap,
    }),
    itemPool: fixture.pool.map((item) => ({
      itemId: item.id,
      type: item.type,
      rootId: item.nodePath[0]!,
      leafId: item.leafNodeId,
      levelId: item.levelId,
      configuredDiscrimination: item.discrimination,
      trueDiscrimination: item.trueDiscrimination,
      configuredDifficulty: item.difficulty,
      trueDifficulty: item.trueDifficulty,
      guessing: item.guessing,
    })),
    learnerTraces,
  }
}

function simulateLearner({
  learnerId,
  runtime,
  trueTheta,
  trueLevelIndex,
  trueLevelLabel,
  nearestBoundaryDistance,
  nearestBoundaryDistanceRatio,
  responseRandom,
}: {
  learnerId: string
  runtime: ReturnType<typeof prepareAdaptiveRuntime<SimulationItem>>
  trueTheta: number
  trueLevelIndex: number
  trueLevelLabel: string
  nearestBoundaryDistance: number
  nearestBoundaryDistanceRatio: number
  responseRandom: () => number
}): AdaptiveSimulationLearnerTrace {
  const responses: AdaptiveRuntimeResponse<SimulationItem>[] = []
  const responseTrajectory: boolean[] = []
  const classifiedAtByRoot = new Map<number, number>()

  while (true) {
    const decision = advanceAdaptiveRuntime({
      attemptId: learnerId,
      runtime,
      responses,
    })
    const currentRootStates = buildRootStates({
      runtime,
      responses,
      estimates: decision.estimates,
      terminalStopReason: null,
      classifiedAtByRoot,
    })
    for (const rootState of currentRootStates) {
      if (rootState.classified && !classifiedAtByRoot.has(rootState.rootId)) {
        classifiedAtByRoot.set(rootState.rootId, responses.length)
      }
    }

    if (decision.stopReason !== null) {
      const terminalStopReason = asSimulationStopReason(decision.stopReason)
      const rootTerminalStates = buildRootStates({
        runtime,
        responses,
        estimates: decision.estimates,
        terminalStopReason,
        classifiedAtByRoot,
      })
      const classified = rootTerminalStates.every(
        (rootState) => rootState.classified
      )

      return {
        learnerId,
        trueTheta,
        trueLevelIndex,
        trueLevelLabel,
        nearestBoundaryDistance,
        nearestBoundaryDistanceRatio,
        boundaryDistanceStratum: boundaryDistanceStratum(
          nearestBoundaryDistanceRatio
        ),
        selectedItemIds: responses.map(({ poolItemId }) => poolItemId),
        responseTrajectory,
        answeredQuestions: responses.length,
        terminalStopReason,
        classifiedAtQuestion: classified ? responses.length : null,
        overallEstimate: estimateTrace(
          decision.estimates.overall,
          runtime.levels
        ),
        rootTerminalStates,
      }
    }

    const item = decision.nextPoolItem
    if (!item) {
      throw new Error('Adaptive runtime returned neither an item nor a reason.')
    }
    const probabilityCorrect = probability(trueTheta, {
      a: item.trueDiscrimination,
      b: item.trueDifficulty,
      c: item.guessing,
    })
    const correct = responseRandom() < probabilityCorrect
    responses.push({
      order: responses.length + 1,
      poolItemId: item.id,
      poolItem: item,
      correct,
    })
    responseTrajectory.push(correct)
  }
}

function buildRuntimeFixture(config: ResolvedAdaptiveSimulationConfig) {
  const levels: AdaptiveRuntimeLevel[] = mapLevelsToTheta(
    SIMULATION_LEVELS,
    config.range,
    config.mappingRule
  ).map((level) => ({
    id: level.order + 1,
    label: level.label,
    order: level.order,
  }))
  const mappedLevels = mapLevelsToTheta(
    SIMULATION_LEVELS,
    config.range,
    config.mappingRule
  )
  const nodes: AdaptiveRuntimeNode[] = []
  const pool: SimulationItem[] = []
  const itemTypes = itemTypesFor(config.itemMix)
  const poolRandom = mulberry32(config.seed + 300_000)
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
        for (let itemIndex = 0; itemIndex < config.itemsPerLevel; itemIndex++) {
          const type = itemTypes[(itemId - 1) % itemTypes.length]!
          const shifted =
            config.adjacentLevelShiftProbability > 0 &&
            poolRandom() < config.adjacentLevelShiftProbability
          const trueLevelIndex = shifted
            ? adjacentLevelIndex(level.order, levels.length, poolRandom)
            : level.order
          pool.push({
            id: itemId++,
            type,
            leafNodeId: leafId,
            nodePath: [rootId, leafId],
            levelId: level.id,
            discrimination: config.configuredDiscrimination,
            difficulty: mappedLevels[level.order]!.theta,
            guessing: deriveGuessingParameter({
              type,
              choiceCount: choiceCountFor(type),
            }),
            trueDifficulty: mappedLevels[trueLevelIndex]!.theta,
            trueDiscrimination: config.trueDiscrimination,
          })
        }
      }
    }
  }

  return { nodes, levels, pool }
}

function summarize({
  traces,
  pool,
  totalQuestionCap,
}: {
  traces: AdaptiveSimulationLearnerTrace[]
  pool: SimulationItem[]
  totalQuestionCap: number
}): AdaptiveSimulationMetrics {
  const overall = summarizeLearnerTraces(traces, totalQuestionCap)
  const stopReasons = emptyStopReasons()
  const rootFailureReasons = emptyRootFailureReasons()
  for (const trace of traces) {
    stopReasons[trace.terminalStopReason] += 1
    for (const rootState of trace.rootTerminalStates) {
      for (const reason of rootState.failureReasons) {
        rootFailureReasons[reason] += 1
      }
    }
  }

  const byLevel = Object.fromEntries(
    SIMULATION_LEVELS.map((level) => [
      level.label,
      summarizeLearnerTraces(
        traces.filter((trace) => trace.trueLevelIndex === level.order),
        totalQuestionCap
      ),
    ])
  )
  const byBoundaryDistance = Object.fromEntries(
    BOUNDARY_DISTANCE_STRATA.map((stratum) => [
      stratum,
      summarizeLearnerTraces(
        traces.filter((trace) => trace.boundaryDistanceStratum === stratum),
        totalQuestionCap
      ),
    ])
  ) as Record<BoundaryDistanceStratum, AdaptiveSimulationStratumMetrics>
  const byRoot = summarizeRoots(traces, totalQuestionCap)
  const exposureCounts = new Map<number, number>()
  for (const trace of traces) {
    for (const itemId of trace.selectedItemIds) {
      exposureCounts.set(itemId, (exposureCounts.get(itemId) ?? 0) + 1)
    }
  }
  const itemExposure = pool.map(({ id }) => {
    const learnerCount = exposureCounts.get(id) ?? 0
    return {
      itemId: id,
      learnerCount,
      exposureRate: traces.length > 0 ? learnerCount / traces.length : 0,
    }
  })
  const exposureRates = itemExposure
    .map(({ exposureRate }) => exposureRate)
    .sort((left, right) => left - right)

  return {
    ...overall,
    stopReasons,
    rootFailureReasons,
    byLevel,
    byRoot,
    byBoundaryDistance,
    itemExposure,
    maxItemExposure: exposureRates.at(-1) ?? 0,
    p95ItemExposure: percentile(exposureRates, 0.95),
    durationAssumptionSecondsPerItem: ADAPTIVE_SECONDS_PER_ITEM,
    topLevelReached: traces.some(
      ({ trueLevelIndex, overallEstimate }) =>
        trueLevelIndex === SIMULATION_LEVELS.length - 1 &&
        overallEstimate.levelIndex === SIMULATION_LEVELS.length - 1
    ),
  }
}

export function summarizeLearnerTraces(
  traces: AdaptiveSimulationLearnerTrace[],
  totalQuestionCap: number
): AdaptiveSimulationStratumMetrics {
  return summarizeObservations(
    traces.map((trace) => ({
      expectedLevelIndex: trace.trueLevelIndex,
      estimatedLevelIndex: trace.overallEstimate.levelIndex,
      answeredQuestions: trace.answeredQuestions,
      classified: trace.classifiedAtQuestion !== null,
      classifiedAtQuestion: trace.classifiedAtQuestion,
      stopReason: trace.terminalStopReason,
    })),
    totalQuestionCap
  )
}

function summarizeRoots(
  traces: AdaptiveSimulationLearnerTrace[],
  totalQuestionCap: number
) {
  const firstTrace = traces[0]
  if (!firstTrace) return {}

  return Object.fromEntries(
    firstTrace.rootTerminalStates.map((firstRootState) => {
      const rootStates = traces.map((trace) => {
        const rootState = trace.rootTerminalStates.find(
          ({ rootId }) => rootId === firstRootState.rootId
        )
        if (!rootState) {
          throw new Error(
            `Missing root ${firstRootState.rootId} in learner ${trace.learnerId}.`
          )
        }
        return { trace, rootState }
      })
      const failureReasons = emptyRootFailureReasons()
      for (const { rootState } of rootStates) {
        for (const reason of rootState.failureReasons) {
          failureReasons[reason] += 1
        }
      }
      const metrics = summarizeObservations(
        rootStates.map(({ trace, rootState }) => ({
          expectedLevelIndex: trace.trueLevelIndex,
          estimatedLevelIndex: rootState.estimate.levelIndex,
          answeredQuestions: trace.answeredQuestions,
          classified: rootState.classified,
          classifiedAtQuestion: rootState.classifiedAtQuestion,
          stopReason: trace.terminalStopReason,
        })),
        totalQuestionCap
      )

      return [
        `root-${firstRootState.rootOrder + 1}`,
        {
          ...metrics,
          rootId: firstRootState.rootId,
          rootOrder: firstRootState.rootOrder,
          failureReasons,
        },
      ]
    })
  )
}

function summarizeObservations(
  observations: MetricObservation[],
  totalQuestionCap: number
): AdaptiveSimulationStratumMetrics {
  const learnerCount = observations.length
  const estimated = observations.filter(
    (
      observation
    ): observation is MetricObservation & { estimatedLevelIndex: number } =>
      observation.estimatedLevelIndex !== null
  )
  const distances = estimated.map((observation) =>
    Math.abs(observation.estimatedLevelIndex - observation.expectedLevelIndex)
  )
  const signedDifferences = estimated.map(
    (observation) =>
      observation.estimatedLevelIndex - observation.expectedLevelIndex
  )
  const questionCounts = observations
    .map(({ answeredQuestions }) => answeredQuestions)
    .sort((left, right) => left - right)

  return {
    learnerCount,
    estimatedLearnerCount: estimated.length,
    nullEstimateCount: learnerCount - estimated.length,
    classificationRate: rate(
      observations.filter(({ classified }) => classified).length,
      learnerCount
    ),
    strictPreCapClassificationRate: rate(
      observations.filter(
        ({ classifiedAtQuestion }) =>
          classifiedAtQuestion !== null &&
          classifiedAtQuestion < totalQuestionCap
      ).length,
      learnerCount
    ),
    totalQuestionCapRate: rate(
      observations.filter(
        ({ stopReason }) => stopReason === 'TOTAL_QUESTION_CAP'
      ).length,
      learnerCount
    ),
    exactAccuracy: rate(
      observations.filter(
        ({ estimatedLevelIndex, expectedLevelIndex }) =>
          estimatedLevelIndex === expectedLevelIndex
      ).length,
      learnerCount
    ),
    adjacentAccuracy: rate(
      observations.filter(
        ({ estimatedLevelIndex, expectedLevelIndex }) =>
          estimatedLevelIndex !== null &&
          Math.abs(estimatedLevelIndex - expectedLevelIndex) <= 1
      ).length,
      learnerCount
    ),
    meanAbsoluteLevelError: mean(distances),
    signedLevelBias: mean(signedDifferences),
    meanQuestionCount: mean(questionCounts),
    p95QuestionCount:
      questionCounts.length > 0 ? percentile(questionCounts, 0.95) : null,
    meanDurationSeconds:
      questionCounts.length > 0
        ? mean(questionCounts)! * ADAPTIVE_SECONDS_PER_ITEM
        : null,
    p95DurationSeconds:
      questionCounts.length > 0
        ? percentile(questionCounts, 0.95) * ADAPTIVE_SECONDS_PER_ITEM
        : null,
  }
}

function buildRootStates({
  runtime,
  responses,
  estimates,
  terminalStopReason,
  classifiedAtByRoot,
}: {
  runtime: ReturnType<typeof prepareAdaptiveRuntime<SimulationItem>>
  responses: AdaptiveRuntimeResponse<SimulationItem>[]
  estimates: AdaptiveRuntimeEstimates
  terminalStopReason: SimulationStopReason | null
  classifiedAtByRoot: ReadonlyMap<number, number>
}): AdaptiveSimulationRootTerminalState[] {
  const countsByLeaf = new Map<number, number>()
  for (const response of responses) {
    countsByLeaf.set(
      response.poolItem.leafNodeId,
      (countsByLeaf.get(response.poolItem.leafNodeId) ?? 0) + 1
    )
  }

  return runtime.roots.map((root) => {
    const estimate = estimates.nodes.get(root.id)
    if (!estimate) throw new Error(`Missing estimate for root ${root.id}.`)
    const leafIds = runtime.leafIdsByRoot.get(root.id) ?? []
    const breadthSatisfied = leafIds.every(
      (leafId) =>
        (countsByLeaf.get(leafId) ?? 0) >= runtime.settings.minQuestionsPerLeaf
    )
    const reportable =
      estimate.responseCount >= MIN_ADAPTIVE_REPORTING_RESPONSES &&
      estimate.theta !== null &&
      estimate.standardError !== null
    const intervalWithinLevelBand =
      reportable &&
      classificationIntervalWithinLevelBand({
        theta: estimate.theta!,
        standardError: estimate.standardError!,
        levels: runtime.levels,
        range: runtime.settings.thetaRange,
        mappingRule: runtime.settings.levelMappingRule,
        z: runtime.settings.classificationZ,
      })
    const classified = breadthSatisfied && intervalWithinLevelBand
    const failureReasons: RootFailureReason[] = []
    if (!classified) {
      if (!breadthSatisfied) failureReasons.push('BREADTH_MISSING')
      if (reportable && !intervalWithinLevelBand) {
        failureReasons.push('INTERVAL_CROSSES_BOUNDARY')
      }
      const terminalFailure = rootTerminalFailureReason(terminalStopReason)
      if (terminalFailure) failureReasons.push(terminalFailure)
    }

    return {
      rootId: root.id,
      rootOrder: root.order,
      responseCount: estimate.responseCount,
      breadthSatisfied,
      intervalWithinLevelBand,
      classified,
      classifiedAtQuestion:
        classifiedAtByRoot.get(root.id) ??
        (classified ? responses.length : null),
      estimate: estimateTrace(estimate, runtime.levels),
      failureReasons,
    }
  })
}

function estimateTrace(
  estimate: AdaptiveRuntimeEstimate,
  levels: AdaptiveRuntimeLevel[]
): AdaptiveSimulationEstimateTrace {
  const level =
    estimate.levelId === null
      ? null
      : (levels.find(({ id }) => id === estimate.levelId) ?? null)
  return {
    theta: estimate.theta,
    standardError: estimate.standardError,
    levelIndex: level?.order ?? null,
    levelLabel: level?.label ?? null,
  }
}

function rootTerminalFailureReason(
  stopReason: SimulationStopReason | null
): RootFailureReason | null {
  switch (stopReason) {
    case 'NODE_QUESTION_CAP':
      return 'NODE_CAP'
    case 'TOTAL_QUESTION_CAP':
      return 'GLOBAL_CAP'
    case 'POOL_EXHAUSTED':
    case 'INSUFFICIENT_DATA':
      return 'POOL_EXHAUSTED_OR_INSUFFICIENT'
    case 'ALL_ROOTS_CLASSIFIED':
    case null:
      return null
  }
}

function emptyStopReasons(): Record<SimulationStopReason, number> {
  return {
    ALL_ROOTS_CLASSIFIED: 0,
    TOTAL_QUESTION_CAP: 0,
    NODE_QUESTION_CAP: 0,
    POOL_EXHAUSTED: 0,
    INSUFFICIENT_DATA: 0,
  }
}

function emptyRootFailureReasons(): Record<RootFailureReason, number> {
  return {
    BREADTH_MISSING: 0,
    INTERVAL_CROSSES_BOUNDARY: 0,
    NODE_CAP: 0,
    GLOBAL_CAP: 0,
    POOL_EXHAUSTED_OR_INSUFFICIENT: 0,
  }
}

function itemTypesFor(mix: SimulationItemMix): AdaptiveItemType[] {
  return mix === 'MIXED' ? [...SUPPORTED_ADAPTIVE_ITEM_TYPES] : [mix]
}

function choiceCountFor(type: AdaptiveItemType) {
  return type === 'SC' || type === 'MC' || type === 'KPRIM' ? 4 : undefined
}

function adjacentLevelIndex(
  levelIndex: number,
  levelCount: number,
  random: () => number
) {
  if (levelIndex === 0) return 1
  if (levelIndex === levelCount - 1) return levelCount - 2
  return levelIndex + (random() < 0.5 ? -1 : 1)
}

function boundaryDistanceStratum(
  distanceRatio: number
): BoundaryDistanceStratum {
  if (distanceRatio < 0.1) return 'LT_10_PERCENT'
  if (distanceRatio < 0.25) return 'FROM_10_TO_LT_25_PERCENT'
  return 'AT_LEAST_25_PERCENT'
}

function asSimulationStopReason(
  reason: AdaptiveRuntimeStopReason
): SimulationStopReason {
  if (reason === 'CLASSIFIED' || reason === 'ABANDONED') {
    throw new Error(`Unexpected simulation stop reason ${reason}.`)
  }
  return reason
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null
}

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null
}

function percentile(sortedValues: number[], quantile: number) {
  return sortedValues[Math.ceil(sortedValues.length * quantile) - 1] ?? 0
}

function mulberry32(seed: number) {
  return function random() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
