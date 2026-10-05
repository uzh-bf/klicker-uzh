/**
 * Splits the cohort results missing from a node's level distribution into
 * results that did not test the node at all (no responses, e.g. under
 * subcompetence sampling) and results that were tested but lack a usable
 * estimate. Neither group is ever counted as a level estimate.
 */
export function summarizeAdaptiveDistributionCoverage({
  cohortSize,
  estimatedCount,
  notTestedCount,
}: {
  cohortSize: number | null
  estimatedCount: number
  notTestedCount?: number | null
}): { notTested: number | null; withoutUsableEstimate: number | null } {
  if (cohortSize === null)
    return { notTested: null, withoutUsableEstimate: null }
  const missing = Math.max(0, cohortSize - estimatedCount)
  const notTested =
    typeof notTestedCount === 'number'
      ? Math.min(missing, Math.max(0, notTestedCount))
      : null
  return {
    notTested,
    withoutUsableEstimate: missing - (notTested ?? 0),
  }
}
