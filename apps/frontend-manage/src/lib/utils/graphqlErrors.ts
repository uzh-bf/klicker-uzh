export function getGraphQLErrorCode(error: unknown): string | undefined {
  const pendingErrors = [error]
  const visitedErrors = new WeakSet<object>()

  while (pendingErrors.length > 0) {
    const currentError = pendingErrors.pop()
    if (
      !currentError ||
      typeof currentError !== 'object' ||
      visitedErrors.has(currentError)
    ) {
      continue
    }
    visitedErrors.add(currentError)

    const extensions = (currentError as { extensions?: { code?: unknown } })
      .extensions
    if (typeof extensions?.code === 'string') return extensions.code

    const errors = (currentError as { errors?: unknown }).errors
    if (Array.isArray(errors)) {
      for (let index = errors.length - 1; index >= 0; index--) {
        pendingErrors.push(errors[index])
      }
    }

    const graphQLErrors = (currentError as { graphQLErrors?: unknown })
      .graphQLErrors
    if (Array.isArray(graphQLErrors)) {
      for (let index = graphQLErrors.length - 1; index >= 0; index--) {
        pendingErrors.push(graphQLErrors[index])
      }
    }
  }

  return undefined
}
