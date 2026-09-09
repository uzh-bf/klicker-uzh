import { ImportExportErrorCode } from '@klicker-uzh/graphql/dist/ops.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { isRetryableElementExportPreviewError } from '../src/lib/importExportErrors.ts'

const RETRYABLE_CODES = new Set<ImportExportErrorCode>([
  ImportExportErrorCode.ImportExportRateLimited,
  ImportExportErrorCode.ImportExportRateLimitUnavailable,
  ImportExportErrorCode.ImportExportInfrastructureFailure,
])

test('classifies every import/export error code for export-preview retry', () => {
  for (const code of Object.values(ImportExportErrorCode)) {
    assert.equal(
      isRetryableElementExportPreviewError({
        code,
        unknownNetworkError: false,
      }),
      RETRYABLE_CODES.has(code),
      `unexpected retry classification for ${code}`
    )
  }
})

test('allows retry for an unknown network error only', () => {
  assert.equal(
    isRetryableElementExportPreviewError({
      code: null,
      unknownNetworkError: true,
    }),
    true
  )
  assert.equal(
    isRetryableElementExportPreviewError({
      code: null,
      unknownNetworkError: false,
    }),
    false
  )
})
