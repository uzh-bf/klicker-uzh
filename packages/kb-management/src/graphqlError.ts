export function getGraphQLErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const graphQLErrors = (
    error as {
      graphQLErrors?: Array<{ extensions?: { code?: unknown } }>
    }
  ).graphQLErrors
  const code = graphQLErrors?.find(
    ({ extensions }) => typeof extensions?.code === 'string'
  )?.extensions?.code
  return typeof code === 'string' ? code : null
}
