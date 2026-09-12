import { isImportExportLocalRuntime } from './importExportPackageConfig.js'

const IMPORT_EXPORT_TOKEN_SECRET_ENV = 'IMPORT_EXPORT_TOKEN_SECRET'
const MIN_PRODUCTION_TOKEN_SECRET_BYTES = 32

export function getImportExportTokenSecret() {
  const secret =
    process.env[IMPORT_EXPORT_TOKEN_SECRET_ENV] ??
    (!isImportExportLocalRuntime()
      ? undefined
      : (process.env.APP_SECRET ??
        process.env.NEXTAUTH_SECRET ??
        process.env.BLOB_STORAGE_ACCESS_KEY))

  if (!secret) {
    throw new Error('Import/export token secret is not configured.')
  }

  return secret
}

export function assertImportExportTokenSecretConfig() {
  if (isImportExportLocalRuntime()) return

  const secret = process.env[IMPORT_EXPORT_TOKEN_SECRET_ENV]
  if (!secret) {
    throw new Error(
      `${IMPORT_EXPORT_TOKEN_SECRET_ENV} must be configured in production.`
    )
  }
  if (Buffer.byteLength(secret, 'utf8') < MIN_PRODUCTION_TOKEN_SECRET_BYTES) {
    throw new Error(
      `${IMPORT_EXPORT_TOKEN_SECRET_ENV} must contain at least ${MIN_PRODUCTION_TOKEN_SECRET_BYTES} bytes in production.`
    )
  }

  getImportExportTokenSecret()
}
