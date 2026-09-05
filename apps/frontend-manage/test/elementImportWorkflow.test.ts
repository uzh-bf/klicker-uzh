import assert from 'node:assert/strict'
import test from 'node:test'
import type { ElementImportReviewModel } from '../src/lib/elementImportPreview.ts'
import {
  elementImportWorkflowReducer,
  initialElementImportWorkflowState,
  isElementImportWorkflowBusy,
  type ElementImportWorkflowAction,
  type ElementImportWorkflowState,
} from '../src/lib/elementImportWorkflow.ts'

const review: ElementImportReviewModel = {
  importToken: 'token',
  warnings: [],
  elements: {},
  elementMeta: {},
  answerCollectionEntries: {},
  answerCollections: [],
}

function dispatch(
  state: ElementImportWorkflowState,
  action: ElementImportWorkflowAction
) {
  return elementImportWorkflowReducer(state, action)
}

function reviewingState(): ElementImportWorkflowState {
  const uploading = dispatch(initialElementImportWorkflowState, {
    type: 'START_UPLOAD',
    generation: 1,
    fileName: 'elements.zip',
  })
  const validating = dispatch(uploading, {
    type: 'START_VALIDATION',
    generation: 1,
  })
  return dispatch(validating, {
    type: 'REVIEW_READY',
    generation: 1,
    review,
  })
}

test('follows the allowed upload, validation, review, import and refresh path', () => {
  const uploading = dispatch(initialElementImportWorkflowState, {
    type: 'START_UPLOAD',
    generation: 1,
    fileName: 'elements.zip',
  })
  assert.equal(uploading.phase, 'uploading')
  assert.equal(isElementImportWorkflowBusy(uploading), true)

  const validating = dispatch(uploading, {
    type: 'START_VALIDATION',
    generation: 1,
  })
  assert.equal(validating.phase, 'validating')

  const reviewing = dispatch(validating, {
    type: 'REVIEW_READY',
    generation: 1,
    review,
  })
  assert.equal(reviewing.phase, 'reviewing')
  assert.equal(isElementImportWorkflowBusy(reviewing), false)

  const importing = dispatch(reviewing, { type: 'START_IMPORT' })
  assert.equal(importing.phase, 'importing')
  assert.equal(isElementImportWorkflowBusy(importing), true)

  const refreshing = dispatch(importing, {
    type: 'IMPORT_COMMITTED',
    importedElements: 3,
    cleanupPending: true,
  })
  assert.deepEqual(refreshing, {
    phase: 'success',
    generation: 1,
    fileName: 'elements.zip',
    importedElements: 3,
    cleanupPending: true,
    refreshStatus: 'refreshing',
  })

  const refreshFailed = dispatch(refreshing, { type: 'REFRESH_FAILED' })
  assert.equal(refreshFailed.phase, 'success')
  if (refreshFailed.phase === 'success') {
    assert.equal(refreshFailed.refreshStatus, 'failed')
  }
})

test('returns to the same review after a commit failure', () => {
  const reviewing = reviewingState()
  const importing = dispatch(reviewing, { type: 'START_IMPORT' })
  const failed = dispatch(importing, {
    type: 'IMPORT_FAILED',
    message: 'Try again.',
  })

  assert.equal(failed.phase, 'reviewing')
  if (failed.phase === 'reviewing') {
    assert.equal(failed.review, review)
    assert.equal(failed.commitError, 'Try again.')
  }
})

test('allows replacement from review and error, but not while busy', () => {
  const reviewing = reviewingState()
  const replacement = dispatch(reviewing, {
    type: 'START_UPLOAD',
    generation: 2,
    fileName: 'replacement.zip',
  })
  assert.equal(replacement.phase, 'uploading')

  const error = dispatch(initialElementImportWorkflowState, {
    type: 'FILE_REJECTED',
    generation: 1,
    message: 'Invalid package.',
  })
  const retry = dispatch(error, {
    type: 'START_UPLOAD',
    generation: 2,
    fileName: 'retry.zip',
  })
  assert.equal(retry.phase, 'uploading')

  const validating = dispatch(replacement, {
    type: 'START_VALIDATION',
    generation: 2,
  })
  const importing = dispatch(reviewing, { type: 'START_IMPORT' })
  for (const busy of [replacement, validating, importing]) {
    const forbidden = dispatch(busy, {
      type: 'START_UPLOAD',
      generation: 99,
      fileName: 'forbidden.zip',
    })
    assert.equal(forbidden, busy)
  }
})

test('ignores stale generations and out-of-order responses', () => {
  const uploading = dispatch(initialElementImportWorkflowState, {
    type: 'START_UPLOAD',
    generation: 4,
    fileName: 'elements.zip',
  })
  assert.equal(
    dispatch(uploading, { type: 'START_VALIDATION', generation: 3 }),
    uploading
  )
  assert.equal(
    dispatch(uploading, {
      type: 'UPLOAD_FAILED',
      generation: 3,
      message: 'stale',
    }),
    uploading
  )

  const validating = dispatch(uploading, {
    type: 'START_VALIDATION',
    generation: 4,
  })
  assert.equal(
    dispatch(validating, {
      type: 'REVIEW_READY',
      generation: 3,
      review,
    }),
    validating
  )
})

test('rejects phase-invalid transitions without mutating state', () => {
  const reviewing = reviewingState()
  const invalidActions: ElementImportWorkflowAction[] = [
    { type: 'START_VALIDATION', generation: 1 },
    { type: 'REVIEW_READY', generation: 1, review },
    { type: 'UPLOAD_FAILED', generation: 1, message: 'invalid' },
    { type: 'IMPORT_COMMITTED', importedElements: 1, cleanupPending: false },
    { type: 'IMPORT_FAILED', message: 'invalid' },
    { type: 'REFRESH_FAILED' },
  ]

  for (const action of invalidActions) {
    assert.equal(dispatch(reviewing, action), reviewing)
  }
})
