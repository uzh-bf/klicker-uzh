import assert from 'node:assert/strict'
import test from 'node:test'
import {
  finalizeMediaUploadWithRetry,
  MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS,
} from '../src/lib/mediaUpload.ts'

const MEDIA_FILE_ID = 'media-file-id'

function recordedWait(delays: number[]) {
  return async (delayMs: number) => {
    delays.push(delayMs)
  }
}

test('retries a false finalization result with the same media file id', async () => {
  const ids: string[] = []
  const delays: number[] = []
  const results = [false, true]

  await finalizeMediaUploadWithRetry(
    MEDIA_FILE_ID,
    async (mediaFileId) => {
      ids.push(mediaFileId)
      return results.shift() ?? false
    },
    recordedWait(delays)
  )

  assert.deepEqual(ids, [MEDIA_FILE_ID, MEDIA_FILE_ID])
  assert.deepEqual(delays, [MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS[0]])
})

test('retries a rejected finalization call with the same media file id', async () => {
  const ids: string[] = []
  const delays: number[] = []
  let calls = 0

  await finalizeMediaUploadWithRetry(
    MEDIA_FILE_ID,
    async (mediaFileId) => {
      ids.push(mediaFileId)
      calls++
      if (calls === 1) throw new Error('transient network failure')
      return true
    },
    recordedWait(delays)
  )

  assert.deepEqual(ids, [MEDIA_FILE_ID, MEDIA_FILE_ID])
  assert.deepEqual(delays, [MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS[0]])
})

test('throws after all three finalization attempts are exhausted', async () => {
  const ids: string[] = []
  const delays: number[] = []

  await assert.rejects(
    finalizeMediaUploadWithRetry(
      MEDIA_FILE_ID,
      async (mediaFileId) => {
        ids.push(mediaFileId)
        return false
      },
      recordedWait(delays)
    ),
    /Uploaded media could not be finalized\./
  )

  assert.deepEqual(ids, [MEDIA_FILE_ID, MEDIA_FILE_ID, MEDIA_FILE_ID])
  assert.deepEqual(delays, MEDIA_UPLOAD_FINALIZATION_RETRY_DELAYS_MS)
})

test('does not wait or call finalization again after success', async () => {
  let calls = 0
  const delays: number[] = []

  await finalizeMediaUploadWithRetry(
    MEDIA_FILE_ID,
    async () => {
      calls++
      return true
    },
    recordedWait(delays)
  )

  assert.equal(calls, 1)
  assert.deepEqual(delays, [])
})
