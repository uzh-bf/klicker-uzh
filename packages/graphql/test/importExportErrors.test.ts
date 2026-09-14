import { GraphQLError } from 'graphql'
import {
  getImportExportErrorCode,
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
  isImportExportErrorCode,
  toImportExportGraphQLError,
} from '../src/lib/importExportErrors.js'

describe('import/export error contract', () => {
  it('contains unique closed error and warning code sets', () => {
    const errors = Object.values(ImportExportErrorCode)
    const warnings = Object.values(ImportExportWarningCode)
    expect(new Set(errors).size).toBe(errors.length)
    expect(new Set(warnings).size).toBe(warnings.length)
    expect(errors.every(isImportExportErrorCode)).toBe(true)
    expect(isImportExportErrorCode('package-authored-code')).toBe(false)
  })

  it('preserves typed codes while redacting internal causes', () => {
    const internalMessage = 'secret storage account and authored filename'
    const error = new ImportExportDomainError(
      ImportExportErrorCode.PACKAGE_NOT_FOUND,
      new Error(internalMessage)
    )
    const graphQLError = toImportExportGraphQLError(error)

    expect(graphQLError.extensions.code).toBe(
      ImportExportErrorCode.PACKAGE_NOT_FOUND
    )
    expect(graphQLError.message).not.toContain(internalMessage)
    expect(JSON.stringify(graphQLError)).not.toContain(internalMessage)
  })

  it('maps unknown and uncoded GraphQL failures to infrastructure failure', () => {
    expect(getImportExportErrorCode(new Error('database URL'))).toBe(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE
    )
    expect(
      getImportExportErrorCode(
        new GraphQLError('masked', { extensions: { code: 'INTERNAL' } })
      )
    ).toBe(ImportExportErrorCode.INFRASTRUCTURE_FAILURE)
  })

  it('preserves a closed code but redacts an already coded GraphQL error', () => {
    const sensitiveMessage = 'Unavailable: redis.internal.example'
    const original = new GraphQLError(sensitiveMessage, {
      extensions: { code: ImportExportErrorCode.DISABLED },
    })
    const redacted = toImportExportGraphQLError(original)

    expect(redacted).not.toBe(original)
    expect(redacted.extensions.code).toBe(ImportExportErrorCode.DISABLED)
    expect(redacted.message).not.toContain(sensitiveMessage)
    expect(JSON.stringify(redacted)).not.toContain(sensitiveMessage)
  })
})
