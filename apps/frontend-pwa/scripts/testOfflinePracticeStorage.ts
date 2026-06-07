import assert from 'node:assert/strict'
import {
  clearOfflinePracticeData,
  createMemoryOfflinePracticeStorage,
  getOfflinePracticeStoragePaths,
  listDownloadedPracticeQuizzes,
  loadDownloadedPracticeQuiz,
  readOfflinePracticeIndex,
  saveDownloadedPracticeQuiz,
  type OfflinePracticeSnapshot,
} from '../src/lib/offlinePracticeStorage'

const snapshot = {
  schemaVersion: 1,
  quizRevision: 'quiz-id:2026-06-01T12:00:00.000Z',
  downloadedAt: '2026-06-07T10:00:00.000Z',
  validUntil: '2026-07-07T10:00:00.000Z',
  assetManifest: ['/assets/diagram.png'],
  quiz: {
    id: 'quiz-id',
    displayName: 'Offline quiz',
    course: {
      id: 'course-id',
      displayName: 'Course',
    },
  },
} as OfflinePracticeSnapshot

async function run() {
  const storage = createMemoryOfflinePracticeStorage()
  const participantId = 'participant-id'
  const otherParticipantId = 'other-participant-id'
  const paths = getOfflinePracticeStoragePaths(participantId)

  assert.equal(
    paths.index,
    'offline-practice/participants/participant-id/index.json'
  )
  assert.equal(
    paths.snapshot(snapshot.quiz.id, snapshot.quizRevision),
    'offline-practice/participants/participant-id/quizzes/quiz-id/quiz-id%3A2026-06-01T12%3A00%3A00.000Z.json'
  )

  assert.deepEqual(await readOfflinePracticeIndex(participantId, storage), {
    schemaVersion: 1,
    quizzes: [],
  })

  const savedEntry = await saveDownloadedPracticeQuiz(
    participantId,
    snapshot,
    storage
  )

  assert.equal(savedEntry.quizId, 'quiz-id')
  assert.equal(savedEntry.courseId, 'course-id')
  assert.equal(savedEntry.quizRevision, snapshot.quizRevision)
  assert.equal(savedEntry.assetCount, 1)
  assert.equal(savedEntry.pendingAttemptCount, 0)

  const entries = await listDownloadedPracticeQuizzes(participantId, storage)
  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.snapshotPath, savedEntry.snapshotPath)

  assert.deepEqual(
    await listDownloadedPracticeQuizzes(otherParticipantId, storage),
    []
  )

  const loadedSnapshot = await loadDownloadedPracticeQuiz(
    participantId,
    'quiz-id',
    storage
  )
  assert.deepEqual(loadedSnapshot, snapshot)

  await saveDownloadedPracticeQuiz(
    participantId,
    {
      ...snapshot,
      quizRevision: 'quiz-id:2026-06-02T12:00:00.000Z',
      assetManifest: [],
    },
    storage
  )

  assert.equal(
    storage.files.has(savedEntry.snapshotPath),
    false,
    'old snapshot revision should be removed'
  )
  assert.equal(
    (await listDownloadedPracticeQuizzes(participantId, storage)).length,
    1
  )
  assert.equal(
    (await loadDownloadedPracticeQuiz(participantId, 'quiz-id', storage))
      ?.quizRevision,
    'quiz-id:2026-06-02T12:00:00.000Z'
  )

  await storage.writeText(paths.index, '{')
  assert.deepEqual(await readOfflinePracticeIndex(participantId, storage), {
    schemaVersion: 1,
    quizzes: [],
  })

  await clearOfflinePracticeData(participantId, storage)
  assert.equal(storage.files.size, 0)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
