import assert from 'node:assert/strict'
import {
  createManageAssistantFrameState,
  reduceManageAssistantFrameState,
} from '../src/components/assistant/manageAssistantFrameState'

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
  url: assistantUrl,
})
assert.equal(delayed.phase, 'delayed')

const recoveredLate = reduceManageAssistantFrameState(delayed, {
  generation: 0,
  type: 'ready',
  url: assistantUrl,
})
assert.equal(recoveredLate.phase, 'ready')

const retrying = reduceManageAssistantFrameState(delayed, {
  type: 'retry',
  url: assistantUrl,
})
assert.deepEqual(retrying, {
  generation: 1,
  phase: 'retrying',
  url: assistantUrl,
})

const ignoredStaleError = reduceManageAssistantFrameState(retrying, {
  generation: 0,
  type: 'error',
  url: assistantUrl,
})
assert.equal(ignoredStaleError, retrying)

const ignoredStaleReady = reduceManageAssistantFrameState(retrying, {
  generation: 0,
  type: 'ready',
  url: assistantUrl,
})
assert.equal(ignoredStaleReady, retrying)

const failed = reduceManageAssistantFrameState(retrying, {
  generation: 1,
  type: 'error',
  url: assistantUrl,
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
  generation: 2,
  type: 'ready',
  url: assistantUrl,
})
assert.equal(ignoredOldReady, changedUrl)
