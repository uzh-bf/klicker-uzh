import { ApolloError } from '@apollo/client'
import { ImportExportErrorCode } from '@klicker-uzh/graphql/dist/ops'

const IMPORT_EXPORT_ERROR_CODES = new Set<string>(
  Object.values(ImportExportErrorCode)
)

function asImportExportErrorCode(value: unknown) {
  return typeof value === 'string' && IMPORT_EXPORT_ERROR_CODES.has(value)
    ? (value as ImportExportErrorCode)
    : null
}

export function getImportExportGraphQLErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null

  const extensions = Reflect.get(error, 'extensions')
  if (!extensions || typeof extensions !== 'object') return null

  return asImportExportErrorCode(Reflect.get(extensions, 'code'))
}

export function getImportExportRouteErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  return asImportExportErrorCode(Reflect.get(error, 'code'))
}

/**
 * Extracts only codes from the closed import/export GraphQL error contract.
 * Error messages are deliberately ignored because they can contain internal or
 * package-authored text and must never be rendered directly.
 */
export function getImportExportErrorCode(error: unknown) {
  if (error instanceof ApolloError) {
    for (const graphQLError of error.graphQLErrors) {
      const code = getImportExportGraphQLErrorCode(graphQLError)
      if (code) return code
    }
  }

  if (error && typeof error === 'object') {
    const directCode = getImportExportGraphQLErrorCode(error)
    if (directCode) return directCode

    const graphQLErrors = Reflect.get(error, 'graphQLErrors')
    if (Array.isArray(graphQLErrors)) {
      for (const graphQLError of graphQLErrors) {
        const code = getImportExportGraphQLErrorCode(graphQLError)
        if (code) return code
      }
    }
  }

  return null
}
