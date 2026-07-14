import { GraphQLError } from 'graphql'

export const ImportExportErrorCode = {
  DISABLED: 'IMPORT_EXPORT_DISABLED',
  ELEMENT_EXPORT_PERMISSION: 'ELEMENT_EXPORT_PERMISSION',
  ANSWER_COLLECTION_EXPORT_PERMISSION: 'ANSWER_COLLECTION_EXPORT_PERMISSION',
  TOO_MANY_ELEMENTS: 'TOO_MANY_ELEMENTS',
  EXPORT_AGGREGATE_LIMIT: 'EXPORT_AGGREGATE_LIMIT',
  EXPORT_PACKAGE_TOO_LARGE: 'EXPORT_PACKAGE_TOO_LARGE',
  EXPORT_SOURCE_CHANGED: 'EXPORT_SOURCE_CHANGED',
  ELEMENT_NOT_PORTABLE: 'ELEMENT_NOT_PORTABLE',
  RATE_LIMITED: 'IMPORT_EXPORT_RATE_LIMITED',
  RATE_LIMIT_UNAVAILABLE: 'IMPORT_EXPORT_RATE_LIMIT_UNAVAILABLE',
  UNSUPPORTED_FILE_TYPE: 'IMPORT_UNSUPPORTED_FILE_TYPE',
  UPLOAD_TOO_LARGE: 'IMPORT_UPLOAD_TOO_LARGE',
  ARTIFACT_QUOTA_EXCEEDED: 'IMPORT_ARTIFACT_QUOTA_EXCEEDED',
  PACKAGE_NOT_FOUND: 'IMPORT_PACKAGE_NOT_FOUND',
  PACKAGE_EXPIRED: 'IMPORT_PACKAGE_EXPIRED',
  INVALID_PACKAGE: 'IMPORT_INVALID_PACKAGE',
  MANIFEST_NOT_AT_ROOT: 'IMPORT_MANIFEST_NOT_AT_ROOT',
  UNSUPPORTED_PACKAGE: 'IMPORT_UNSUPPORTED_PACKAGE',
  INVALID_OPTIONS: 'IMPORT_INVALID_OPTIONS',
  UNSAFE_REFERENCE: 'IMPORT_UNSAFE_REFERENCE',
  AGGREGATE_LIMIT: 'IMPORT_AGGREGATE_LIMIT',
  PACKAGE_TOO_LARGE: 'IMPORT_PACKAGE_TOO_LARGE',
  TOKEN_INVALID: 'IMPORT_TOKEN_INVALID',
  TOKEN_EXPIRED: 'IMPORT_TOKEN_EXPIRED',
  REPLAY_MISMATCH: 'IMPORT_REPLAY_MISMATCH',
  IMPORT_IN_PROGRESS: 'IMPORT_IN_PROGRESS',
  PACKAGE_CHANGED: 'IMPORT_PACKAGE_CHANGED',
  INVALID_SELECTION: 'IMPORT_INVALID_SELECTION',
  INFRASTRUCTURE_FAILURE: 'IMPORT_EXPORT_INFRASTRUCTURE_FAILURE',
} as const

export type ImportExportErrorCode =
  (typeof ImportExportErrorCode)[keyof typeof ImportExportErrorCode]

export const ImportExportWarningCode = {
  STATUS_NORMALIZED: 'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
  EXTERNAL_MEDIA: 'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED',
  MEDIA_NOT_INCLUDED: 'IMPORT_MEDIA_NOT_INCLUDED',
  UNUSED_MEDIA: 'IMPORT_UNUSED_MEDIA',
  CLEANUP_PENDING: 'IMPORT_CLEANUP_PENDING',
} as const

export type ImportExportWarningCode =
  (typeof ImportExportWarningCode)[keyof typeof ImportExportWarningCode]

const ERROR_CODES = new Set<string>(Object.values(ImportExportErrorCode))

export function isImportExportErrorCode(
  value: unknown
): value is ImportExportErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value)
}

export class ImportExportDomainError extends Error {
  constructor(
    readonly code: ImportExportErrorCode,
    override readonly cause?: unknown
  ) {
    super('Import/export request failed.')
    this.name = 'ImportExportDomainError'
  }
}

export function getImportExportErrorCode(
  error: unknown,
  fallback: ImportExportErrorCode = ImportExportErrorCode.INFRASTRUCTURE_FAILURE
) {
  if (error instanceof ImportExportDomainError) return error.code
  if (error instanceof GraphQLError) {
    const code = error.extensions.code
    if (isImportExportErrorCode(code)) return code
  }
  return fallback
}

export function toImportExportGraphQLError(
  error: unknown,
  fallback: ImportExportErrorCode = ImportExportErrorCode.INFRASTRUCTURE_FAILURE
) {
  return new GraphQLError('Import/export request failed.', {
    extensions: { code: getImportExportErrorCode(error, fallback) },
  })
}
