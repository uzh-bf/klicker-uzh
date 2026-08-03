export type AdaptiveV2SimulationStratum = {
  key: string
  learnerCount: number
  meanBias: number
  absoluteBiasUpper95: number
  rmse: number
  rmseUpper95: number
  classificationRate: number
  classificationRateLower95: number
  classifiedBandAccuracy: number
  classifiedBandAccuracyLower95: number
  nonAdjacentConfidentErrorRate: number
  nonAdjacentConfidentErrorRateUpper95: number
  confidentMisclassificationRate: number
  confidentMisclassificationRateUpper95: number
  credibleCoverage: number
  credibleCoverageLower95: number
  credibleCoverageUpper95: number
}

export type AdaptiveV2SimulationMetrics = {
  learnerCount: number
  classifiedCount: number
  abstainedCount: number
  classificationRate: number
  classificationRateLower95: number
  requiredRootClassificationRate: number
  requiredRootClassificationRateLower95: number
  meanBias: number
  absoluteBiasUpper95: number
  rmse: number
  rmseUpper95: number
  credibleCoverage: number
  credibleCoverageLower95: number
  credibleCoverageUpper95: number
  classifiedBandAccuracy: number
  classifiedBandAccuracyLower95: number
  nonAdjacentConfidentErrorRate: number
  nonAdjacentConfidentErrorRateUpper95: number
  forcedClassificationCount: number
  unexpectedFallbackCount: number
  medianQuestionCount: number
  meanQuestionCount: number
  p95QuestionCount: number
  medianDurationSeconds: number
  p95DurationSeconds: number
  stopReasons: Record<string, number>
  maximumExposureRate: number
  maximumTestOverlapRate: number
  sampledMaximumPairwiseFormOverlapRate: number
  strata: AdaptiveV2SimulationStratum[]
}

export type AdaptiveV2ReleasePolicy = {
  version: number
  classificationPolicyVersion: number
  credibleMass: number
  candidateProbabilityThresholds: readonly number[]
  minimumProbabilityThreshold: number
  minimumSimulatedLearnersPerRequiredStratum: number
  minimumSimulatedLearnersPerThetaCell: number
  minimumHoldoutLearnersPerMajorStratum: number
  minimumHoldoutLearnersPerDifGroup: number
  minimumInteriorClassificationRate: number
  minimumRequiredRootClassificationRate: number
  cutNeighborhoodWidth: number
  maximumExposureRate: number
  maximumTestOverlapRate: number
  maximumSampledPairwiseFormOverlapRate: number
  maximumMedianDurationSeconds: number
  maximumP95DurationSeconds: number
}

export type AdaptiveV2ReleaseGate = {
  name: string
  passed: boolean
  actual: number
  comparison: 'GTE' | 'LTE' | 'EQ'
  target: number
  required: string
}

export function evaluateAdaptiveV2ReleaseGate(
  gate: Pick<AdaptiveV2ReleaseGate, 'actual' | 'comparison' | 'target'>
) {
  if (!Number.isFinite(gate.actual) || !Number.isFinite(gate.target)) {
    return false
  }

  switch (gate.comparison) {
    case 'GTE':
      return gate.actual >= gate.target
    case 'LTE':
      return gate.actual <= gate.target
    case 'EQ':
      return gate.actual === gate.target
  }
}

export function evaluateV2ReleaseGates(
  metrics: AdaptiveV2SimulationMetrics,
  policy: AdaptiveV2ReleasePolicy
): AdaptiveV2ReleaseGate[] {
  return evaluateReleaseGates({
    metrics,
    policy,
    minimumLearnersFor: (key) =>
      key.startsWith('theta-cell:')
        ? policy.minimumSimulatedLearnersPerThetaCell
        : policy.minimumSimulatedLearnersPerRequiredStratum,
    includeClassificationRate: true,
  })
}

export function evaluateEmpiricalReleaseGates(
  metrics: AdaptiveV2SimulationMetrics,
  policy: AdaptiveV2ReleasePolicy
): AdaptiveV2ReleaseGate[] {
  return evaluateReleaseGates({
    metrics,
    policy,
    minimumLearnersFor: (key) =>
      key.startsWith('dif:')
        ? policy.minimumHoldoutLearnersPerDifGroup
        : policy.minimumHoldoutLearnersPerMajorStratum,
    includeClassificationRate: true,
  })
}

function evaluateReleaseGates({
  metrics,
  policy,
  minimumLearnersFor,
  includeClassificationRate,
}: {
  metrics: AdaptiveV2SimulationMetrics
  policy: AdaptiveV2ReleasePolicy
  minimumLearnersFor: (key: string) => number
  includeClassificationRate: boolean
}): AdaptiveV2ReleaseGate[] {
  const gates = [
    maximumGate('absoluteBiasUpper95', metrics.absoluteBiasUpper95, 0.1),
    maximumGate('rmseUpper95', metrics.rmseUpper95, 0.5),
    minimumGate(
      'credibleCoverageLower95',
      metrics.credibleCoverageLower95,
      0.85
    ),
    maximumGate(
      'credibleCoverageUpper95',
      metrics.credibleCoverageUpper95,
      0.95
    ),
    minimumGate(
      'classifiedBandAccuracyLower95',
      metrics.classifiedBandAccuracyLower95,
      0.9
    ),
    maximumGate(
      'nonAdjacentConfidentErrorRateUpper95',
      metrics.nonAdjacentConfidentErrorRateUpper95,
      0.01
    ),
    minimumGate(
      'requiredRootClassificationRateLower95',
      metrics.requiredRootClassificationRateLower95,
      policy.minimumRequiredRootClassificationRate
    ),
    equalityGate(
      'forcedClassificationCount',
      metrics.forcedClassificationCount,
      0
    ),
    equalityGate('unexpectedFallbackCount', metrics.unexpectedFallbackCount, 0),
    maximumGate(
      'maximumExposureRate',
      metrics.maximumExposureRate,
      policy.maximumExposureRate
    ),
    maximumGate(
      'maximumTestOverlapRate',
      metrics.maximumTestOverlapRate,
      policy.maximumTestOverlapRate
    ),
    maximumGate(
      'sampledMaximumPairwiseFormOverlapRate',
      metrics.sampledMaximumPairwiseFormOverlapRate,
      policy.maximumSampledPairwiseFormOverlapRate
    ),
    maximumGate(
      'medianDurationSeconds',
      metrics.medianDurationSeconds,
      policy.maximumMedianDurationSeconds
    ),
    maximumGate(
      'p95DurationSeconds',
      metrics.p95DurationSeconds,
      policy.maximumP95DurationSeconds
    ),
  ]

  if (includeClassificationRate) {
    const interior = metrics.strata.find(
      ({ key }) => key === 'cut-distance:INTERIOR'
    )
    gates.splice(
      6,
      0,
      minimumGate(
        'classificationRateLower95',
        interior?.classificationRateLower95 ?? 0,
        policy.minimumInteriorClassificationRate
      )
    )
  }

  for (const stratum of metrics.strata) {
    const prefix = `stratum:${stratum.key}`
    gates.push(
      minimumGate(
        `${prefix}:learnerCount`,
        stratum.learnerCount,
        minimumLearnersFor(stratum.key)
      ),
      maximumGate(
        `${prefix}:nonAdjacentConfidentErrorRateUpper95`,
        stratum.nonAdjacentConfidentErrorRateUpper95,
        0.01
      ),
      minimumGate(
        `${prefix}:credibleCoverageLower95`,
        stratum.credibleCoverageLower95,
        0.85
      ),
      maximumGate(
        `${prefix}:credibleCoverageUpper95`,
        stratum.credibleCoverageUpper95,
        0.95
      )
    )
    if (stratum.key !== 'cut-distance:NEAR_CUT') {
      gates.push(
        maximumGate(
          `${prefix}:absoluteBiasUpper95`,
          stratum.absoluteBiasUpper95,
          0.1
        ),
        maximumGate(`${prefix}:rmseUpper95`, stratum.rmseUpper95, 0.5),
        minimumGate(
          `${prefix}:classifiedBandAccuracyLower95`,
          stratum.classifiedBandAccuracyLower95,
          0.9
        )
      )
    } else {
      gates.push(
        maximumGate(
          `${prefix}:confidentMisclassificationRateUpper95`,
          stratum.confidentMisclassificationRateUpper95,
          0.01
        )
      )
    }
  }

  return gates
}

function minimumGate(name: string, actual: number, minimum: number) {
  return {
    name,
    passed: actual >= minimum,
    actual,
    comparison: 'GTE' as const,
    target: minimum,
    required: `>= ${minimum}`,
  }
}

function maximumGate(name: string, actual: number, maximum: number) {
  return {
    name,
    passed: actual <= maximum,
    actual,
    comparison: 'LTE' as const,
    target: maximum,
    required: `<= ${maximum}`,
  }
}

function equalityGate(name: string, actual: number, expected: number) {
  return {
    name,
    passed: actual === expected,
    actual,
    comparison: 'EQ' as const,
    target: expected,
    required: `= ${expected}`,
  }
}
