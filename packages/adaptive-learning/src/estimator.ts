export const ADAPTIVE_MEASUREMENT_VERSIONS = Object.freeze([
  'IRT_V1',
  'IRT_V2_EAP_GRID_1',
] as const)

export type AdaptiveMeasurementVersion =
  (typeof ADAPTIVE_MEASUREMENT_VERSIONS)[number]

export type AdaptiveEstimator = Readonly<{
  version: AdaptiveMeasurementVersion
  estimation: 'LEGACY_MLE_MAP' | 'BAYESIAN_EAP_GRID'
}>

export class AdaptiveRuntimeConfigurationError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AdaptiveRuntimeConfigurationError'
    this.code = code
  }
}

const ESTIMATORS = Object.freeze({
  IRT_V1: Object.freeze({
    version: 'IRT_V1',
    estimation: 'LEGACY_MLE_MAP',
  }),
  IRT_V2_EAP_GRID_1: Object.freeze({
    version: 'IRT_V2_EAP_GRID_1',
    estimation: 'BAYESIAN_EAP_GRID',
  }),
}) satisfies Readonly<Record<AdaptiveMeasurementVersion, AdaptiveEstimator>>

export function resolveAdaptiveEstimator(
  version: AdaptiveMeasurementVersion
): AdaptiveEstimator {
  assertSupportedEstimatorVersion(version)
  return ESTIMATORS[version]
}

export function assertSupportedEstimatorVersion(
  version: string
): asserts version is AdaptiveMeasurementVersion {
  if (
    !ADAPTIVE_MEASUREMENT_VERSIONS.includes(
      version as AdaptiveMeasurementVersion
    )
  ) {
    throw new AdaptiveRuntimeConfigurationError(
      `Unsupported adaptive estimator version: ${version}`,
      'ADAPTIVE_ESTIMATOR_UNSUPPORTED'
    )
  }
}
