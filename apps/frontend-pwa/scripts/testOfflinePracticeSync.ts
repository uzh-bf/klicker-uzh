import {
  ElementType,
  OfflinePracticeAttemptSyncStatus,
  StackFeedbackStatus,
  type OfflinePracticeAttemptSyncInput,
} from '@klicker-uzh/graphql/dist/ops'
import assert from 'node:assert/strict'
import {
  createMemoryOfflinePracticeStorage,
  listDownloadedPracticeQuizzes,
  listOfflinePracticeAttempts,
  loadOfflinePracticeAttempt,
  saveDownloadedPracticeQuiz,
  saveOfflinePracticeAttempt,
  type OfflinePracticeAttempt,
  type OfflinePracticeSnapshot,
} from '../src/lib/offlinePracticeStorage'
import { syncPendingOfflinePracticeAttempts } from '../src/lib/offlinePracticeSync'

const participantId = 'participant-id'

const snapshot = {
  schemaVersion: 1,
  quizRevision: 'quiz-id:2026-06-01T12:00:00.000Z',
  downloadedAt: '2026-06-07T10:00:00.000Z',
  validUntil: '2026-07-07T10:00:00.000Z',
  assetManifest: [],
  quiz: {
    id: 'quiz-id',
    displayName: 'Offline quiz',
    course: {
      id: 'course-id',
      displayName: 'Course',
    },
  },
} as unknown as OfflinePracticeSnapshot

function createAttempt(clientAttemptId: string): OfflinePracticeAttempt {
  return {
    clientAttemptId,
    participantId,
    courseId: 'course-id',
    quizId: 'quiz-id',
    quizRevision: snapshot.quizRevision,
    stackId: 1,
    responses: [
      {
        instanceId: 10,
        type: ElementType.Content,
        contentReponse: true,
      },
    ],
    answerTime: 12,
    localEvaluation: {
      __typename: 'StackFeedback',
      id: 1,
      status: StackFeedbackStatus.Correct,
      score: null,
      evaluations: [],
    },
    createdAt: '2026-06-07T10:01:00.000Z',
    updatedAt: '2026-06-07T10:01:00.000Z',
    syncStatus: 'pending',
  }
}

async function run() {
  const storage = createMemoryOfflinePracticeStorage()

  await saveDownloadedPracticeQuiz(participantId, snapshot, storage)
  await saveOfflinePracticeAttempt(
    participantId,
    createAttempt('accepted-attempt'),
    storage
  )
  await saveOfflinePracticeAttempt(
    participantId,
    createAttempt('stale-attempt'),
    storage
  )

  const syncedInputs: OfflinePracticeAttemptSyncInput[][] = []
  const result = await syncPendingOfflinePracticeAttempts({
    participantId,
    storage,
    syncAttempts: async (attempts) => {
      syncedInputs.push(attempts)
      return [
        {
          clientAttemptId: 'accepted-attempt',
          status: OfflinePracticeAttemptSyncStatus.Accepted,
          message: null,
          feedback: null,
        },
        {
          clientAttemptId: 'stale-attempt',
          status: OfflinePracticeAttemptSyncStatus.StaleRevision,
          message: 'Downloaded revision is stale.',
          feedback: null,
        },
      ]
    },
  })

  assert.equal(result.attemptedCount, 2)
  assert.equal(result.resultCount, 2)
  assert.equal(result.acceptedCount, 1)
  assert.equal(result.rejectedCount, 1)
  assert.equal(result.remainingPendingAttemptCount, 0)
  assert.equal(syncedInputs.length, 1)
  assert.deepEqual(
    syncedInputs[0]?.map((attempt) => attempt.clientAttemptId).sort(),
    ['accepted-attempt', 'stale-attempt']
  )
  assert.equal(
    syncedInputs[0]?.find(
      (attempt) => attempt.clientAttemptId === 'accepted-attempt'
    )?.stackAnswerTime,
    12
  )

  assert.equal(
    (
      await loadOfflinePracticeAttempt(
        participantId,
        'accepted-attempt',
        storage
      )
    )?.syncStatus,
    'accepted'
  )
  const staleAttempt = await loadOfflinePracticeAttempt(
    participantId,
    'stale-attempt',
    storage
  )
  assert.equal(staleAttempt?.syncStatus, 'stale_revision')
  assert.equal(staleAttempt?.syncMessage, 'Downloaded revision is stale.')
  assert.equal(
    (await listOfflinePracticeAttempts(participantId, storage, 'pending'))
      .length,
    0
  )
  assert.equal(
    (await listDownloadedPracticeQuizzes(participantId, storage))[0]
      ?.pendingAttemptCount,
    0
  )

  await saveOfflinePracticeAttempt(
    participantId,
    createAttempt('network-error-attempt'),
    storage
  )

  await assert.rejects(
    syncPendingOfflinePracticeAttempts({
      participantId,
      storage,
      syncAttempts: async () => {
        throw new Error('offline')
      },
    })
  )
  assert.equal(
    (
      await loadOfflinePracticeAttempt(
        participantId,
        'network-error-attempt',
        storage
      )
    )?.syncStatus,
    'pending'
  )
  assert.equal(
    (await listOfflinePracticeAttempts(participantId, storage, 'pending'))
      .length,
    1
  )

  const partialStorage = createMemoryOfflinePracticeStorage()
  await saveDownloadedPracticeQuiz(participantId, snapshot, partialStorage)
  await saveOfflinePracticeAttempt(
    participantId,
    createAttempt('partial-accepted'),
    partialStorage
  )
  await saveOfflinePracticeAttempt(
    participantId,
    createAttempt('partial-missing'),
    partialStorage
  )

  const partialCalls: OfflinePracticeAttemptSyncInput[][] = []
  const partialResult = await syncPendingOfflinePracticeAttempts({
    participantId,
    storage: partialStorage,
    syncAttempts: async (attempts) => {
      partialCalls.push(attempts)
      return [
        {
          clientAttemptId: 'partial-accepted',
          status: OfflinePracticeAttemptSyncStatus.Accepted,
          message: null,
          feedback: null,
        },
      ]
    },
  })

  assert.equal(partialResult.attemptedCount, 2)
  assert.equal(partialResult.resultCount, 1)
  assert.equal(partialResult.acceptedCount, 1)
  assert.equal(partialResult.rejectedCount, 0)
  assert.equal(partialResult.remainingPendingAttemptCount, 1)
  assert.equal(partialCalls.length, 1)
  assert.deepEqual(
    partialCalls[0]?.map((attempt) => attempt.clientAttemptId).sort(),
    ['partial-accepted', 'partial-missing']
  )
  assert.equal(
    (
      await loadOfflinePracticeAttempt(
        participantId,
        'partial-missing',
        partialStorage
      )
    )?.syncStatus,
    'pending'
  )

  const batchStorage = createMemoryOfflinePracticeStorage()
  await saveDownloadedPracticeQuiz(participantId, snapshot, batchStorage)
  const batchAttemptIds = Array.from(
    { length: 26 },
    (_, index) => `batch-attempt-${index}`
  )

  for (const clientAttemptId of batchAttemptIds) {
    await saveOfflinePracticeAttempt(
      participantId,
      createAttempt(clientAttemptId),
      batchStorage
    )
  }

  const batchSizes: number[] = []
  const batchResult = await syncPendingOfflinePracticeAttempts({
    participantId,
    storage: batchStorage,
    syncAttempts: async (attempts) => {
      batchSizes.push(attempts.length)
      return attempts.map((attempt) => ({
        clientAttemptId: attempt.clientAttemptId,
        status: OfflinePracticeAttemptSyncStatus.Accepted,
        message: null,
        feedback: null,
      }))
    },
  })

  assert.deepEqual(batchSizes, [25, 1])
  assert.equal(batchResult.attemptedCount, 26)
  assert.equal(batchResult.resultCount, 26)
  assert.equal(batchResult.acceptedCount, 26)
  assert.equal(batchResult.rejectedCount, 0)
  assert.equal(batchResult.remainingPendingAttemptCount, 0)
  assert.equal(
    (await listOfflinePracticeAttempts(participantId, batchStorage, 'pending'))
      .length,
    0
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
