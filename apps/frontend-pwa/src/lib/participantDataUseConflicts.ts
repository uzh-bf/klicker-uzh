function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const candidate = error as {
    extensions?: { code?: unknown }
    graphQLErrors?: unknown
    errors?: unknown
    cause?: unknown
  }
  if (typeof candidate.extensions?.code === 'string') {
    return candidate.extensions.code
  }

  for (const nestedErrors of [candidate.graphQLErrors, candidate.errors]) {
    if (!Array.isArray(nestedErrors)) continue
    for (const nestedError of nestedErrors) {
      const code = getGraphQLErrorCode(nestedError)
      if (code) return code
    }
  }

  return candidate.cause ? getGraphQLErrorCode(candidate.cause) : undefined
}

export function isDataUseConflict(error: unknown) {
  const code = getGraphQLErrorCode(error)
  return (
    code === 'PARTICIPANT_DATA_USE_STALE_REVISION' ||
    code === 'PARTICIPANT_DATA_USE_INVALID_INPUT'
  )
}
