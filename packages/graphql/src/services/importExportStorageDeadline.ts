import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'

export type ImportExportStorageOperation = 'metadata' | 'transfer'

export class ImportExportStorageDeadlineError extends ImportExportDomainError {
  constructor(operation: ImportExportStorageOperation) {
    super(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
      new Error(`Import/export storage ${operation} deadline exceeded.`)
    )
    this.name = 'ImportExportStorageDeadlineError'
  }
}

function getDeadlineMs(operation: ImportExportStorageOperation) {
  const { timeouts } = getImportExportRuntimeConfig()
  return operation === 'metadata'
    ? timeouts.azureMetadataMs
    : timeouts.azureTransferMs
}

/**
 * Bounds both the Azure SDK request (through abortSignal) and the returned
 * promise. The promise race is intentional: test doubles and a stalled stream
 * are not required to honor AbortSignal, while the caller must still regain
 * control and retain its durable cleanup ledger.
 */
export async function withImportExportStorageDeadline<T>(
  operation: ImportExportStorageOperation,
  callback: (signal: AbortSignal) => Promise<T>
) {
  const controller = new AbortController()
  const timeoutMs = getDeadlineMs(operation)
  let timer: NodeJS.Timeout | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ImportExportStorageDeadlineError(operation)
      // Settle the public deadline first, then notify cooperative clients.
      // This keeps the externally observed error stable even when an abort
      // listener rejects synchronously with a provider-specific error.
      reject(error)
      controller.abort(error)
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      Promise.resolve().then(() => callback(controller.signal)),
      timeout,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
