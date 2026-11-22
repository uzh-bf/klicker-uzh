export type AdaptiveSubmissionErrorKey =
  | 'locked'
  | 'coverage'
  | 'invalid'
  | 'unavailable'

export function getAdaptiveSubmissionErrorKey(
  error: unknown
): AdaptiveSubmissionErrorKey | null {
  if (!error || typeof error !== 'object') return null

  const graphQLErrors = (error as { graphQLErrors?: unknown }).graphQLErrors
  if (!Array.isArray(graphQLErrors)) return null

  const codes = graphQLErrors.flatMap((graphQLError) => {
    if (!graphQLError || typeof graphQLError !== 'object') return []
    const extensions = (graphQLError as { extensions?: unknown }).extensions
    if (!extensions || typeof extensions !== 'object') return []
    const code = (extensions as { code?: unknown }).code
    return typeof code === 'string' ? [code] : []
  })

  if (codes.includes('COMPETENCE_TREE_STRUCTURE_LOCKED')) return 'locked'
  if (codes.includes('COMPETENCE_TREE_ASSIGNMENT_COVERAGE_INVALID')) {
    return 'coverage'
  }
  if (codes.includes('COMPETENCE_TREE_INVALID')) return 'invalid'
  if (codes.includes('NOT_FOUND') || codes.includes('FORBIDDEN')) {
    return 'unavailable'
  }
  return null
}
