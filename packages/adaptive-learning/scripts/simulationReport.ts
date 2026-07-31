import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { ADAPTIVE_SECONDS_PER_ITEM } from '../src/index.js'
import {
  runAdaptiveSimulation,
  summarizeLearnerTraces,
  type AdaptiveSimulationEstimateTrace,
  type AdaptiveSimulationLearnerTrace,
  type AdaptiveSimulationMetrics,
  type AdaptiveSimulationResult,
  type AdaptiveSimulationRootTerminalState,
  type AdaptiveSimulationStratumMetrics,
  type BoundaryDistanceStratum,
  type RootFailureReason,
  type SimulationStopReason,
} from '../test/simulationHarness.js'
import {
  runAdaptiveV2Simulation,
  type AdaptiveV2SimulationReport,
} from './internalSimulation.js'
import {
  PHASE_11_REGRESSION_GATES,
  UNEXPECTED_CLEAN_FALLBACKS,
  equalityGate,
  evaluateRegressionGates,
  type RegressionGateResult,
} from './simulationGates.js'
import {
  CANONICAL_LEARNERS_PER_LEVEL,
  SIMULATION_REPORT_SCENARIOS,
  SIMULATION_SEED,
  STRESS_LEARNERS_PER_LEVEL,
  type AdaptiveSimulationScenario,
  type SimulationPoolProfile,
  type SimulationScenarioCategory,
} from './simulationScenarios.js'
import {
  ADAPTIVE_V2_SCENARIO_SET,
  buildAdaptiveV2ReleaseInput,
  runAdaptiveV2ScenarioProbes,
  type AdaptiveV2ScenarioProbe,
} from './simulationV2Scenarios.js'

export const SIMULATION_TRACE_ENCODING = {
  learnerTuple: [
    'learnerId',
    'trueTheta',
    'trueLevelIndex',
    'trueLevelLabel',
    'nearestBoundaryDistance',
    'nearestBoundaryDistanceRatio',
    'boundaryDistanceStratum',
    'selectedItemIdsCsv',
    'responseTrajectoryBits',
    'answeredQuestions',
    'terminalStopReason',
    'classifiedAtQuestion',
    'overallEstimate',
    'rootTerminalStates',
  ],
  estimateTuple: ['theta', 'standardError', 'levelIndex', 'levelLabel'],
  rootTerminalStateTuple: [
    'rootId',
    'rootOrder',
    'responseCount',
    'breadthSatisfied',
    'intervalWithinLevelBand',
    'classified',
    'classifiedAtQuestion',
    'estimate',
    'failureReasons',
  ],
  selectedItemIdsCsv: 'Comma-separated item ids in response order.',
  responseTrajectoryBits:
    'One bit per selected item in response order: 1 is correct and 0 is incorrect.',
} as const

export type AdaptiveSimulationReportScenario = {
  category: SimulationScenarioCategory
  poolProfile: SimulationPoolProfile
  canonicalProductProfile: boolean
  deterministic: boolean | null
  config: AdaptiveSimulationResult['config']
  metrics: AdaptiveSimulationMetrics
  itemPool: AdaptiveSimulationResult['itemPool']
  learnerTraces: EncodedLearnerTrace[]
  regressionGateResults: RegressionGateResult[]
  regressionGatesPassed: boolean | null
}

export type AdaptiveSimulationReport = {
  schemaVersion: 3
  traceEncoding: typeof SIMULATION_TRACE_ENCODING
  assumptions: {
    seed: number
    secondsPerItem: number
    configuredDiscrimination: number
    interiorBoundaryDistanceRatio: number
    canonicalLearnersPerLevel: number
    stressLearnersPerLevel: number
  }
  regressionGates: typeof PHASE_11_REGRESSION_GATES
  unexpectedCleanFallbacks: typeof UNEXPECTED_CLEAN_FALLBACKS
  metricsByPreset: Record<
    'PLACEMENT' | 'DIAGNOSTIC',
    AdaptiveSimulationStratumMetrics
  >
  scenarios: AdaptiveSimulationReportScenario[]
  irtV2: AdaptiveV2SimulationReport
  irtV2ScenarioSet: typeof ADAPTIVE_V2_SCENARIO_SET
  irtV2ScenarioProbes: AdaptiveV2ScenarioProbe[]
}

type EncodedEstimateTrace = [
  theta: number | null,
  standardError: number | null,
  levelIndex: number | null,
  levelLabel: string | null,
]

type EncodedRootTerminalState = [
  rootId: number,
  rootOrder: number,
  responseCount: number,
  breadthSatisfied: boolean,
  intervalWithinLevelBand: boolean,
  classified: boolean,
  classifiedAtQuestion: number | null,
  estimate: EncodedEstimateTrace,
  failureReasons: RootFailureReason[],
]

type EncodedLearnerTrace = [
  learnerId: string,
  trueTheta: number,
  trueLevelIndex: number,
  trueLevelLabel: string,
  nearestBoundaryDistance: number,
  nearestBoundaryDistanceRatio: number,
  boundaryDistanceStratum: BoundaryDistanceStratum,
  selectedItemIdsCsv: string,
  responseTrajectoryBits: string,
  answeredQuestions: number,
  terminalStopReason: SimulationStopReason,
  classifiedAtQuestion: number | null,
  overallEstimate: EncodedEstimateTrace,
  rootTerminalStates: EncodedRootTerminalState[],
]

type ExecutedScenario = {
  definition: AdaptiveSimulationScenario
  result: AdaptiveSimulationResult
  deterministic: boolean | null
}

export function buildSimulationReport(): AdaptiveSimulationReport {
  const executions = SIMULATION_REPORT_SCENARIOS.map((definition) => {
    const result = runAdaptiveSimulation(definition.config)
    const deterministic = definition.canonicalProductProfile
      ? identicalResults(result, runAdaptiveSimulation(definition.config))
      : null
    return { definition, result, deterministic }
  })
  const scenarios = executions.map(({ definition, result, deterministic }) => {
    const regressionGateResults = definition.canonicalProductProfile
      ? [
          ...evaluateRegressionGates({
            metrics: result.metrics,
            totalQuestionCap: result.config.totalQuestionCap,
            poolProfile: definition.poolProfile as 'TARGET' | 'RICH',
          }),
          equalityGate(
            'deterministicReplay',
            'identical-seed-and-configuration',
            deterministic ? 1 : 0,
            1
          ),
        ]
      : []

    return {
      category: definition.category,
      poolProfile: definition.poolProfile,
      canonicalProductProfile: definition.canonicalProductProfile,
      deterministic,
      config: result.config,
      metrics: result.metrics,
      itemPool: result.itemPool,
      learnerTraces: result.learnerTraces.map(encodeLearnerTrace),
      regressionGateResults,
      regressionGatesPassed: definition.canonicalProductProfile
        ? regressionGateResults.every(({ passed }) => passed)
        : null,
    }
  })

  return {
    schemaVersion: 3,
    traceEncoding: SIMULATION_TRACE_ENCODING,
    assumptions: {
      seed: SIMULATION_SEED,
      secondsPerItem: ADAPTIVE_SECONDS_PER_ITEM,
      configuredDiscrimination: 1.2,
      interiorBoundaryDistanceRatio: 0.25,
      canonicalLearnersPerLevel: CANONICAL_LEARNERS_PER_LEVEL,
      stressLearnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
    },
    regressionGates: PHASE_11_REGRESSION_GATES,
    unexpectedCleanFallbacks: UNEXPECTED_CLEAN_FALLBACKS,
    metricsByPreset: {
      PLACEMENT: aggregateCanonicalPresetMetrics(executions, 'PLACEMENT'),
      DIAGNOSTIC: aggregateCanonicalPresetMetrics(executions, 'DIAGNOSTIC'),
    },
    scenarios,
    irtV2: runAdaptiveV2Simulation(buildAdaptiveV2ReleaseInput()),
    irtV2ScenarioSet: ADAPTIVE_V2_SCENARIO_SET,
    irtV2ScenarioProbes: runAdaptiveV2ScenarioProbes(),
  }
}

export async function writeSimulationReport({
  reportDirectory = fileURLToPath(new URL('../reports/', import.meta.url)),
}: { reportDirectory?: string } = {}) {
  const report = buildSimulationReport()
  const jsonPath = resolve(reportDirectory, 'simulation-report.json')
  const markdownPath = resolve(reportDirectory, 'simulation-summary.md')
  mkdirSync(reportDirectory, { recursive: true })
  writeFileSync(jsonPath, await renderCanonicalJsonReport(report, jsonPath))
  writeFileSync(
    markdownPath,
    await renderCanonicalMarkdownSummary(report, markdownPath)
  )
  return { report, jsonPath, markdownPath }
}

export async function renderCanonicalJsonReport(
  report: AdaptiveSimulationReport,
  _jsonPath: string
) {
  return `${JSON.stringify(report, null, 2)}\n`
}

export async function renderCanonicalMarkdownSummary(
  report: AdaptiveSimulationReport,
  markdownPath: string
) {
  const config = (await resolveConfig(markdownPath)) ?? {}
  return format(renderMarkdownSummary(report), {
    ...config,
    filepath: markdownPath,
  })
}

export function regressionGateFailures(report: AdaptiveSimulationReport) {
  return report.scenarios.flatMap((scenario) =>
    scenario.regressionGateResults
      .filter(({ passed }) => !passed)
      .map((gate) => ({ scenario: scenario.config.label, ...gate }))
  )
}

export function formatRegressionGateFailures(
  failures: ReturnType<typeof regressionGateFailures>
) {
  return failures
    .map(
      ({ scenario, metric, scope, comparison, threshold, actual }) =>
        `${scenario}: ${metric} (${scope}) actual=${String(
          actual
        )} required ${comparison} ${threshold}`
    )
    .join('\n')
}

export function renderMarkdownSummary(report: AdaptiveSimulationReport) {
  const canonical = report.scenarios.filter(
    ({ canonicalProductProfile }) => canonicalProductProfile
  )
  const stress = report.scenarios.filter(
    ({ canonicalProductProfile }) => !canonicalProductProfile
  )
  const failures = regressionGateFailures(report)
  const v2Failures = report.irtV2.thresholdResults.flatMap(
    ({ probabilityThreshold, gates }) =>
      gates
        .filter(({ passed }) => !passed)
        .map((gate) => ({ probabilityThreshold, ...gate }))
  )
  const lines = [
    '# Adaptive Learning Simulation Summary',
    '',
    'Deterministic Phase 11 evidence generated from production runtime helpers and canonical preset defaults.',
    '',
    `Assumptions: seed ${report.assumptions.seed}; ${report.assumptions.canonicalLearnersPerLevel} learners per level for canonical product profiles; ${report.assumptions.secondsPerItem} seconds per item.`,
    '',
    '## Engineering Regression Thresholds',
    '',
    '| Common metric | Required |',
    '| --- | ---: |',
    '| Exact level agreement (overall) | >= 70% |',
    '| Same-or-adjacent agreement (overall and populated levels) | >= 95% |',
    '| Exact level agreement (populated levels) | >= 60% |',
    '| Mean absolute level error | <= 0.35 bands |',
    '| Absolute signed per-level bias | <= 0.50 bands |',
    '| Unexpected node/pool/insufficient fallbacks | 0 |',
    '| Determinism | identical replay |',
    '',
    '| Pool profile | Interior classified | Total cap | Max exposure | P95 exposure | Mean length |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    '| Target (5 items per leaf-level cell) | >= 15% | <= 90% | <= 90% | <= 80% | <= 99% of cap |',
    '| Rich (10 items per leaf-level cell) | >= 25% | <= 80% | <= 60% | <= 45% | <= 99% of cap |',
    '',
    'These are deterministic code-regression baselines for the six-band synthetic model. They are not psychometric validation or permission to use outcomes in a real course.',
    '',
    '## Feasibility Boundary',
    '',
    'The former 90% interior-classification gate was mathematically incompatible with the shipped two-root, 50-item cap. Six equal bands over theta [-3, 3] are 1.2 wide. At exactly 25% of a band from a boundary, z = 1.28 requires SE <= 0.234375. Even with ideal c = 0 items at maximum information a^2 / 4 = 0.36, one root needs at least 51 responses; two roots need at least 102. Guessing makes the requirement stricter.',
    '',
    'The former 40% synthetic maximum-exposure gate was also not a valid minimum-bank invariant. The target bank has 120 items and the observed mean length is about 48, so average exposure is already about 40% before information-based concentration. The real-course pilot still requires TOTAL_QUESTION_CAP <= 25% and maximum exposure <= 40%; meeting those gates requires a course-calibrated bank and may require more than ten items per cell or an approved algorithm/profile change.',
    '',
    '## Canonical Product Profiles',
    '',
    '| Profile | Pool | Exact | Adjacent | Interior classified | Total cap | Max / P95 exposure | Mean items / cap | Regression |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...canonical.map((scenario) => {
      const metrics = scenario.metrics
      return `| ${scenario.config.label} | ${scenario.poolProfile} | ${percent(
        metrics.exactAccuracy
      )} | ${percent(metrics.adjacentAccuracy)} | ${percent(
        metrics.byBoundaryDistance.AT_LEAST_25_PERCENT.classificationRate
      )} | ${percent(metrics.totalQuestionCapRate)} | ${percent(
        metrics.maxItemExposure
      )} / ${percent(metrics.p95ItemExposure)} | ${decimal(
        metrics.meanQuestionCount
      )} / ${
        scenario.config.totalQuestionCap
      } | ${scenario.regressionGatesPassed ? 'PASS' : 'FAIL'} |`
    }),
    '',
    '## Failing Regressions',
    '',
    ...(failures.length === 0
      ? ['All canonical engineering regression gates pass.']
      : [
          '| Profile | Metric | Scope | Actual | Required |',
          '| --- | --- | --- | ---: | --- |',
          ...failures.map(
            ({ scenario, metric, scope, actual, comparison, threshold }) =>
              `| ${scenario} | ${metric} | ${scope} | ${decimal(
                actual
              )} | ${comparison} ${threshold} |`
          ),
        ]),
    '',
    '## Stress Evidence',
    '',
    '| Scenario | Category | Classified | Pre-cap classified | Total cap | Exact | Mean items |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...stress.map(
      (scenario) =>
        `| ${scenario.config.label} | ${scenario.category} | ${percent(
          scenario.metrics.classificationRate
        )} | ${percent(
          scenario.metrics.strictPreCapClassificationRate
        )} | ${percent(scenario.metrics.totalQuestionCapRate)} | ${percent(
          scenario.metrics.exactAccuracy
        )} | ${decimal(scenario.metrics.meanQuestionCount)} |`
    ),
    '',
    'The JSON artifact contains resolved configuration, profile-aware regression gates, preset aggregates, level/root/boundary strata, exposure, terminal failure reasons, and losslessly encoded nullable learner traces.',
    '',
    '## Bayesian IRT v2 Release Evidence',
    '',
    `Input fingerprint: \`${report.irtV2.inputFingerprint}\`. Evidence: \`${report.irtV2.evidenceProfile}\`; estimator: \`${report.irtV2.estimatorVersion}\`; policy: ${report.irtV2.policyVersion}.`,
    '',
    '| Threshold | Classified | Required roots | Accuracy when classified | Bias upper 95% | RMSE upper 95% | Coverage 95% interval | Exposure / retake / sampled pairwise overlap | Release |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |',
    ...report.irtV2.thresholdResults.map(
      ({ probabilityThreshold, metrics, passed }) =>
        `| ${probabilityThreshold.toFixed(2)} | ${percent(
          metrics.classificationRate
        )} | ${percent(
          metrics.requiredRootClassificationRate
        )} | ${percent(metrics.classifiedBandAccuracy)} | ${decimal(
          metrics.absoluteBiasUpper95
        )} | ${decimal(metrics.rmseUpper95)} | ${percent(
          metrics.credibleCoverageLower95
        )} - ${percent(metrics.credibleCoverageUpper95)} | ${percent(
          metrics.maximumExposureRate
        )} / ${percent(metrics.maximumTestOverlapRate)} / ${percent(
          metrics.sampledMaximumPairwiseFormOverlapRate
        )} | ${passed ? 'PASS' : 'BLOCKED'} |`
    ),
    '',
    report.irtV2.passed
      ? `The lowest fully approved threshold is ${report.irtV2.approvedProbabilityThreshold}.`
      : 'No candidate threshold passes all reviewed release gates. Broad IRT v2 Diagnostic release remains blocked; the simulation does not silently lower any gate.',
    '',
    '| Threshold | Failed gate | Actual | Required |',
    '| ---: | --- | ---: | --- |',
    ...v2Failures.map(
      ({ probabilityThreshold, name, actual, required }) =>
        `| ${probabilityThreshold.toFixed(2)} | ${name} | ${decimal(
          actual
        )} | ${required} |`
    ),
    '',
    `The v2 scenario catalog contains ${report.irtV2ScenarioSet.length} executed profiles across model recovery, boundaries, misspecification, hierarchy, item types, calibration, Research collection, retakes, and pool sizes. Only ${report.irtV2.retainedTraces.length} compact canonical traces are retained; all ${report.irtV2.thresholdResults[0]!.metrics.learnerCount} canonical outcomes contribute to the aggregate and stratum metrics.`,
    '',
    'EXECUTED means that a probe completed and its declared invariant was evaluated; it is not a psychometric pass. Production-routed near-cut strata, injected-DIF detection, cap, and exhaustion checks are included in the blocking gate table above.',
    '',
    '| Scenario | Category | Learners | Bias | RMSE | Coverage | Classified | Execution |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.irtV2ScenarioProbes.map(
      (probe) =>
        `| ${probe.id} | ${probe.category} | ${probe.learnerCount} | ${decimal(
          probe.meanBias
        )} | ${decimal(probe.rmse)} | ${percent(
          probe.credibleCoverage
        )} | ${percent(probe.classificationRate)} | ${
          probe.executedSuccessfully ? 'EXECUTED' : 'FAILED'
        } |`
    ),
    '',
  ]
  return `${lines.join('\n')}\n`
}

function aggregateCanonicalPresetMetrics(
  executions: ExecutedScenario[],
  preset: 'PLACEMENT' | 'DIAGNOSTIC'
) {
  const matching = executions.filter(
    ({ definition }) =>
      definition.canonicalProductProfile && definition.config.preset === preset
  )
  const totalQuestionCaps = new Set(
    matching.map(({ result }) => result.config.totalQuestionCap)
  )
  if (totalQuestionCaps.size !== 1) {
    throw new Error(`Canonical ${preset} profiles do not share one cap.`)
  }
  return summarizeLearnerTraces(
    matching.flatMap(({ result }) => result.learnerTraces),
    matching[0]!.result.config.totalQuestionCap
  )
}

function encodeLearnerTrace(
  trace: AdaptiveSimulationLearnerTrace
): EncodedLearnerTrace {
  return [
    trace.learnerId,
    trace.trueTheta,
    trace.trueLevelIndex,
    trace.trueLevelLabel,
    trace.nearestBoundaryDistance,
    trace.nearestBoundaryDistanceRatio,
    trace.boundaryDistanceStratum,
    trace.selectedItemIds.join(','),
    trace.responseTrajectory.map((correct) => (correct ? '1' : '0')).join(''),
    trace.answeredQuestions,
    trace.terminalStopReason,
    trace.classifiedAtQuestion,
    encodeEstimate(trace.overallEstimate),
    trace.rootTerminalStates.map(encodeRootTerminalState),
  ]
}

function encodeEstimate(
  estimate: AdaptiveSimulationEstimateTrace
): EncodedEstimateTrace {
  return [
    estimate.theta,
    estimate.standardError,
    estimate.levelIndex,
    estimate.levelLabel,
  ]
}

function encodeRootTerminalState(
  state: AdaptiveSimulationRootTerminalState
): EncodedRootTerminalState {
  return [
    state.rootId,
    state.rootOrder,
    state.responseCount,
    state.breadthSatisfied,
    state.intervalWithinLevelBand,
    state.classified,
    state.classifiedAtQuestion,
    encodeEstimate(state.estimate),
    state.failureReasons,
  ]
}

function identicalResults(
  left: AdaptiveSimulationResult,
  right: AdaptiveSimulationResult
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function percent(value: number | null) {
  return value === null ? 'null' : `${(value * 100).toFixed(1)}%`
}

function decimal(value: number | null) {
  return value === null ? 'null' : value.toFixed(3)
}
