// Server codes that mean "the quiz is temporarily busy": the calculation
// service stayed overloaded or unreachable after the server's own retries,
// or concurrent activity on the attempt could not be resolved. Each is safe
// to retry, so the participant gets a calm message and a retry button.
const ADAPTIVE_BUSY_CODES = new Set([
  'ADAPTIVE_ENGINE_BUSY',
  'ADAPTIVE_ENGINE_UNAVAILABLE',
  'ADAPTIVE_ATTEMPT_CONFLICT',
])

export function isAdaptiveBusyError(error: unknown): boolean {
  const graphQLErrors = (
    error as {
      graphQLErrors?: ReadonlyArray<{ extensions?: { code?: unknown } }>
    } | null
  )?.graphQLErrors
  return (
    Array.isArray(graphQLErrors) &&
    graphQLErrors.some((graphQLError) => {
      const code = graphQLError?.extensions?.code
      return typeof code === 'string' && ADAPTIVE_BUSY_CODES.has(code)
    })
  )
}
