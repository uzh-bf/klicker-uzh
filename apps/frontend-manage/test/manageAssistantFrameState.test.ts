import assert from 'node:assert/strict'
import {
  createManageAssistantFrameState,
  reduceManageAssistantFrameState,
} from '../src/components/assistant/manageAssistantFrameState.ts'

const assistantUrl = 'https://chat.example.test/manage?embed=1'

const loading = createManageAssistantFrameState(assistantUrl)
assert.deepEqual(loading, {
  generation: 0,
  phase: 'loading',
  url: assistantUrl,
})

const delayed = reduceManageAssistantFrameState(loading, {
  generation: 0,
  type: 'deadline',
})
assert.equal(delayed.phase, 'delayed')

const recoveredLate = reduceManageAssistantFrameState(delayed, {
  generation: 0,
  type: 'ready',
})
assert.equal(recoveredLate.phase, 'ready')

const ignoredDelayedError = reduceManageAssistantFrameState(delayed, {
  generation: 0,
  type: 'error',
})
assert.equal(ignoredDelayedError, delayed)

const retrying = reduceManageAssistantFrameState(delayed, {
  type: 'retry',
})
assert.deepEqual(retrying, {
  generation: 1,
  phase: 'retrying',
  url: assistantUrl,
})

const ignoredStaleError = reduceManageAssistantFrameState(retrying, {
  generation: 0,
  type: 'error',
})
assert.equal(ignoredStaleError, retrying)

const ignoredStaleReady = reduceManageAssistantFrameState(retrying, {
  generation: 0,
  type: 'ready',
})
assert.equal(ignoredStaleReady, retrying)

const failed = reduceManageAssistantFrameState(retrying, {
  generation: 1,
  type: 'error',
})
assert.equal(failed.phase, 'failed')

const changedUrl = reduceManageAssistantFrameState(failed, {
  type: 'url-changed',
  url: 'https://chat.example.test/de/manage?embed=1',
})
assert.deepEqual(changedUrl, {
  generation: 2,
  phase: 'loading',
  url: 'https://chat.example.test/de/manage?embed=1',
})

const ignoredOldReady = reduceManageAssistantFrameState(changedUrl, {
  generation: 1,
  type: 'ready',
})
assert.equal(ignoredOldReady, changedUrl)

const changedUrlReady = reduceManageAssistantFrameState(changedUrl, {
  generation: 2,
  type: 'ready',
})
assert.equal(changedUrlReady.phase, 'ready')

const ignoredReadyError = reduceManageAssistantFrameState(changedUrlReady, {
  generation: 2,
  type: 'error',
})
assert.equal(ignoredReadyError, changedUrlReady)
