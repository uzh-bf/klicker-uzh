export type AdaptiveClassificationPolicy = {
  version: number
  credibleMass: number
  candidateProbabilityThresholds: readonly number[]
  minimumProbabilityThreshold: number
}

const V1_CANDIDATE_PROBABILITY_THRESHOLDS = Object.freeze([0.8, 0.9, 0.95])

export const ADAPTIVE_CLASSIFICATION_POLICY_V1 = Object.freeze({
  version: 1,
  credibleMass: 0.9,
  candidateProbabilityThresholds: V1_CANDIDATE_PROBABILITY_THRESHOLDS,
  minimumProbabilityThreshold: 0.8,
}) satisfies Readonly<AdaptiveClassificationPolicy>

export function validateAdaptiveClassificationPolicy(
  policy: AdaptiveClassificationPolicy
): string[] {
  const errors: string[] = []
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message)
  }

  if (!Number.isInteger(policy.version) || policy.version < 1) {
    addError('A supported classification policy version is required.')
  }
  if (!isProbability(policy.credibleMass)) {
    addError('Credible mass must be finite and strictly between 0 and 1.')
  }
  if (!isProbability(policy.minimumProbabilityThreshold)) {
    addError(
      'Minimum probability threshold must be finite and strictly between 0 and 1.'
    )
  }
  if (policy.candidateProbabilityThresholds.length === 0) {
    addError('At least one candidate probability threshold is required.')
  }

  for (
    let index = 0;
    index < policy.candidateProbabilityThresholds.length;
    index++
  ) {
    const threshold = policy.candidateProbabilityThresholds[index]!
    const previous = policy.candidateProbabilityThresholds[index - 1]

    if (!isProbability(threshold)) {
      addError(
        'Candidate probability thresholds must be finite and strictly between 0 and 1.'
      )
    }
    if (previous !== undefined && threshold <= previous) {
      addError('Candidate probability thresholds must be strictly increasing.')
    }
    if (
      Number.isFinite(policy.minimumProbabilityThreshold) &&
      threshold < policy.minimumProbabilityThreshold
    ) {
      addError(
        'Candidate probability thresholds must not be below the minimum threshold.'
      )
    }
  }

  return errors
}

function isProbability(value: number) {
  return Number.isFinite(value) && value > 0 && value < 1
}
