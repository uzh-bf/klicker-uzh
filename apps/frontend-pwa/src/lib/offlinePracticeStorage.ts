import type {
  GetPracticeQuizDownloadSnapshotQuery,
  RespondToElementStackMutation,
  StackResponseInput,
} from '@klicker-uzh/graphql/dist/ops'

const OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION = 2
const OFFLINE_PRACTICE_ROOT = 'offline-practice'
const OFFLINE_PRACTICE_PARTICIPANT_ID_KEY =
  'klicker-offline-practice-participant-id'

export type OfflinePracticeSnapshot = NonNullable<
  GetPracticeQuizDownloadSnapshotQuery['practiceQuizDownloadSnapshot']
>

export interface OfflinePracticeIndexEntry {
  quizId: string
  courseId: string
  displayName: string
  courseDisplayName?: string | null
  quizRevision: string
  schemaVersion: number
  downloadedAt: string
  validUntil: string
  snapshotPath: string
  sizeBytes: number
  assetCount: number
  pendingAttemptCount: number
  updatedAt: string
}

export type OfflinePracticeAttemptSyncStatus =
  | 'pending'
  | 'accepted'
  | 'already_synced'
  | 'stale_revision'
  | 'no_longer_authorized'
  | 'server_error'

export type OfflinePracticeStackFeedback = NonNullable<
  RespondToElementStackMutation['respondToElementStack']
>

export interface OfflinePracticeAttempt {
  clientAttemptId: string
  participantId: string
  courseId: string
  quizId: string
  quizRevision: string
  stackId: number
  responses: StackResponseInput[]
  answerTime: number
  localEvaluation: OfflinePracticeStackFeedback
  syncMessage?: string | null
  syncedAt?: string | null
  createdAt: string
  updatedAt: string
  syncStatus: OfflinePracticeAttemptSyncStatus
}

export interface OfflinePracticeAttemptIndexEntry {
  clientAttemptId: string
  quizId: string
  quizRevision: string
  stackId: number
  attemptPath: string
  syncStatus: OfflinePracticeAttemptSyncStatus
  createdAt: string
  updatedAt: string
}

export interface OfflinePracticeIndex {
  schemaVersion: number
  quizzes: OfflinePracticeIndexEntry[]
  attempts: OfflinePracticeAttemptIndexEntry[]
}

export interface OfflinePracticeStorageAdapter {
  readText(path: string): Promise<string | null>
  writeText(path: string, data: string): Promise<void>
  deleteDirectory(path: string): Promise<void>
}

export type OfflinePracticeStorageErrorCode =
  | 'read_failed'
  | 'write_failed'
  | 'delete_failed'
  | 'quota_exceeded'

export class OfflinePracticeStorageError extends Error {
  code: OfflinePracticeStorageErrorCode
  cause?: unknown

  constructor(
    code: OfflinePracticeStorageErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'OfflinePracticeStorageError'
    this.code = code
    this.cause = cause
  }
}

function getLocalStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function rememberOfflinePracticeParticipant(participantId: string) {
  getLocalStorage()?.setItem(OFFLINE_PRACTICE_PARTICIPANT_ID_KEY, participantId)
}

export function readRememberedOfflinePracticeParticipant() {
  return getLocalStorage()?.getItem(OFFLINE_PRACTICE_PARTICIPANT_ID_KEY) ?? null
}

export function forgetRememberedOfflinePracticeParticipant(
  participantId?: string | null
) {
  const localStorage = getLocalStorage()
  if (!localStorage) return

  const rememberedParticipantId = localStorage.getItem(
    OFFLINE_PRACTICE_PARTICIPANT_ID_KEY
  )
  if (
    typeof participantId === 'undefined' ||
    participantId === null ||
    rememberedParticipantId === participantId
  ) {
    localStorage.removeItem(OFFLINE_PRACTICE_PARTICIPANT_ID_KEY)
  }
}

function encodedPathSegment(value: string) {
  return encodeURIComponent(value)
}

export function getDownloadedPracticeLocalStorageId(
  participantId: string,
  quizId: string
) {
  return `downloaded-${encodedPathSegment(participantId)}-${encodedPathSegment(
    quizId
  )}`
}

function getParticipantRoot(participantId: string) {
  return `${OFFLINE_PRACTICE_ROOT}/participants/${encodedPathSegment(
    participantId
  )}`
}

function getIndexPath(participantId: string) {
  return `${getParticipantRoot(participantId)}/index.json`
}

function getSnapshotPath(
  participantId: string,
  quizId: string,
  quizRevision: string
) {
  return `${getParticipantRoot(participantId)}/quizzes/${encodedPathSegment(
    quizId
  )}/${encodedPathSegment(quizRevision)}.json`
}

function getQuizDirectory(participantId: string, quizId: string) {
  return `${getParticipantRoot(participantId)}/quizzes/${encodedPathSegment(
    quizId
  )}`
}

function getAttemptsDirectory(participantId: string) {
  return `${getParticipantRoot(participantId)}/attempts`
}

function getQuizAttemptsDirectory(participantId: string, quizId: string) {
  return `${getAttemptsDirectory(participantId)}/${encodedPathSegment(quizId)}`
}

function getAttemptPath(
  participantId: string,
  quizId: string,
  clientAttemptId: string
) {
  return `${getQuizAttemptsDirectory(participantId, quizId)}/${encodedPathSegment(
    clientAttemptId
  )}.json`
}

export function getOfflinePracticeStoragePaths(participantId: string) {
  return {
    root: OFFLINE_PRACTICE_ROOT,
    participantRoot: getParticipantRoot(participantId),
    index: getIndexPath(participantId),
    attemptsDirectory: getAttemptsDirectory(participantId),
    quizAttemptsDirectory: (quizId: string) =>
      getQuizAttemptsDirectory(participantId, quizId),
    attempt: (quizId: string, clientAttemptId: string) =>
      getAttemptPath(participantId, quizId, clientAttemptId),
    quizDirectory: (quizId: string) => getQuizDirectory(participantId, quizId),
    snapshot: (quizId: string, quizRevision: string) =>
      getSnapshotPath(participantId, quizId, quizRevision),
  }
}

function isMissingFileError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | undefined

  return (
    candidate?.code === 'OS-PLUG-FILE-0008' ||
    candidate?.code === 'ENOENT' ||
    /(?:not found|does not exist|no such file)/i.test(candidate?.message ?? '')
  )
}

function isQuotaError(error: unknown) {
  const candidate = error as { code?: string; message?: string; name?: string }

  return (
    candidate?.name === 'QuotaExceededError' ||
    /(?:quota|no space|storage full)/i.test(candidate?.message ?? '')
  )
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString()

  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString()
}

function jsonSizeBytes(value: string) {
  return new TextEncoder().encode(value).length
}

function getDefaultIndex(): OfflinePracticeIndex {
  return {
    schemaVersion: OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
    quizzes: [],
    attempts: [],
  }
}

function isPendingAttemptStatus(status: OfflinePracticeAttemptSyncStatus) {
  return status === 'pending'
}

function countPendingAttemptsForQuiz(
  attempts: OfflinePracticeAttemptIndexEntry[],
  quizId: string
) {
  return attempts.filter(
    (attempt) =>
      attempt.quizId === quizId && isPendingAttemptStatus(attempt.syncStatus)
  ).length
}

function withPendingAttemptCounts(
  index: OfflinePracticeIndex
): OfflinePracticeIndex {
  return {
    ...index,
    quizzes: index.quizzes.map((entry) => ({
      ...entry,
      pendingAttemptCount: countPendingAttemptsForQuiz(
        index.attempts,
        entry.quizId
      ),
    })),
  }
}

export function createOfflinePracticeIndexEntry(
  snapshot: OfflinePracticeSnapshot,
  snapshotPath: string,
  previousEntry?: OfflinePracticeIndexEntry
): OfflinePracticeIndexEntry {
  return {
    quizId: snapshot.quiz.id,
    courseId: snapshot.quiz.course?.id ?? '',
    displayName: snapshot.quiz.displayName,
    courseDisplayName: snapshot.quiz.course?.displayName ?? null,
    quizRevision: snapshot.quizRevision,
    schemaVersion: snapshot.schemaVersion,
    downloadedAt: toIsoString(snapshot.downloadedAt),
    validUntil: toIsoString(snapshot.validUntil),
    snapshotPath,
    sizeBytes: jsonSizeBytes(JSON.stringify(snapshot)),
    assetCount: snapshot.assetManifest.length,
    pendingAttemptCount: previousEntry?.pendingAttemptCount ?? 0,
    updatedAt: new Date().toISOString(),
  }
}

export async function readOfflinePracticeIndex(
  participantId: string,
  storage = createCapacitorOfflinePracticeStorage()
): Promise<OfflinePracticeIndex> {
  const rawIndex = await storage.readText(getIndexPath(participantId))
  if (!rawIndex) return getDefaultIndex()

  let parsed: Partial<OfflinePracticeIndex>

  try {
    parsed = JSON.parse(rawIndex) as Partial<OfflinePracticeIndex>
  } catch {
    return getDefaultIndex()
  }

  return withPendingAttemptCounts({
    schemaVersion:
      parsed.schemaVersion ?? OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
    quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
    attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
  })
}

async function writeOfflinePracticeIndex(
  participantId: string,
  storage: OfflinePracticeStorageAdapter,
  index: OfflinePracticeIndex
) {
  await storage.writeText(
    getIndexPath(participantId),
    JSON.stringify(index, null, 2)
  )
}

export async function saveDownloadedPracticeQuiz(
  participantId: string,
  snapshot: OfflinePracticeSnapshot,
  storage = createCapacitorOfflinePracticeStorage()
) {
  const quizDirectory = getQuizDirectory(participantId, snapshot.quiz.id)
  const snapshotPath = getSnapshotPath(
    participantId,
    snapshot.quiz.id,
    snapshot.quizRevision
  )
  const serializedSnapshot = JSON.stringify(snapshot, null, 2)
  const index = await readOfflinePracticeIndex(participantId, storage)
  const previousEntry = index.quizzes.find(
    (entry) => entry.quizId === snapshot.quiz.id
  )

  await storage.deleteDirectory(quizDirectory)
  await storage.writeText(snapshotPath, serializedSnapshot)

  const entry = {
    ...createOfflinePracticeIndexEntry(snapshot, snapshotPath, previousEntry),
    sizeBytes: jsonSizeBytes(serializedSnapshot),
    pendingAttemptCount: countPendingAttemptsForQuiz(
      index.attempts,
      snapshot.quiz.id
    ),
  }

  await writeOfflinePracticeIndex(participantId, storage, {
    schemaVersion: OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
    quizzes: [
      entry,
      ...index.quizzes.filter((item) => item.quizId !== snapshot.quiz.id),
    ].sort((itemA, itemB) =>
      itemA.displayName.localeCompare(itemB.displayName)
    ),
    attempts: index.attempts,
  })

  return entry
}

function createOfflinePracticeAttemptIndexEntry(
  participantId: string,
  attempt: OfflinePracticeAttempt
): OfflinePracticeAttemptIndexEntry {
  return {
    clientAttemptId: attempt.clientAttemptId,
    quizId: attempt.quizId,
    quizRevision: attempt.quizRevision,
    stackId: attempt.stackId,
    attemptPath: getAttemptPath(
      participantId,
      attempt.quizId,
      attempt.clientAttemptId
    ),
    syncStatus: attempt.syncStatus,
    createdAt: toIsoString(attempt.createdAt),
    updatedAt: toIsoString(attempt.updatedAt),
  }
}

export async function saveOfflinePracticeAttempt(
  participantId: string,
  attempt: OfflinePracticeAttempt,
  storage = createCapacitorOfflinePracticeStorage()
) {
  const attemptPath = getAttemptPath(
    participantId,
    attempt.quizId,
    attempt.clientAttemptId
  )
  const serializedAttempt = JSON.stringify(attempt, null, 2)
  const index = await readOfflinePracticeIndex(participantId, storage)
  const attemptEntry = createOfflinePracticeAttemptIndexEntry(
    participantId,
    attempt
  )
  const attempts = [
    attemptEntry,
    ...index.attempts.filter(
      (entry) => entry.clientAttemptId !== attempt.clientAttemptId
    ),
  ].sort((itemA, itemB) => itemB.createdAt.localeCompare(itemA.createdAt))

  await storage.writeText(attemptPath, serializedAttempt)
  await writeOfflinePracticeIndex(
    participantId,
    storage,
    withPendingAttemptCounts({
      ...index,
      schemaVersion: OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
      attempts,
    })
  )

  return attemptEntry
}

export async function loadOfflinePracticeAttempt(
  participantId: string,
  clientAttemptId: string,
  storage = createCapacitorOfflinePracticeStorage()
): Promise<OfflinePracticeAttempt | null> {
  const index = await readOfflinePracticeIndex(participantId, storage)
  const entry = index.attempts.find(
    (attempt) => attempt.clientAttemptId === clientAttemptId
  )
  if (!entry) return null

  const rawAttempt = await storage.readText(entry.attemptPath)
  if (!rawAttempt) return null

  return JSON.parse(rawAttempt) as OfflinePracticeAttempt
}

export async function updateOfflinePracticeAttemptSyncStatus(
  participantId: string,
  clientAttemptId: string,
  {
    syncStatus,
    syncMessage,
  }: {
    syncStatus: OfflinePracticeAttemptSyncStatus
    syncMessage?: string | null
  },
  storage = createCapacitorOfflinePracticeStorage()
) {
  const index = await readOfflinePracticeIndex(participantId, storage)
  const entry = index.attempts.find(
    (attempt) => attempt.clientAttemptId === clientAttemptId
  )

  if (!entry) return null

  const rawAttempt = await storage.readText(entry.attemptPath)
  if (!rawAttempt) return null

  const now = new Date().toISOString()
  const attempt = JSON.parse(rawAttempt) as OfflinePracticeAttempt
  const updatedAttempt: OfflinePracticeAttempt = {
    ...attempt,
    syncStatus,
    syncMessage: syncMessage ?? null,
    syncedAt: now,
    updatedAt: now,
  }

  await storage.writeText(
    entry.attemptPath,
    JSON.stringify(updatedAttempt, null, 2)
  )
  await writeOfflinePracticeIndex(
    participantId,
    storage,
    withPendingAttemptCounts({
      ...index,
      attempts: index.attempts.map((attemptEntry) =>
        attemptEntry.clientAttemptId === clientAttemptId
          ? {
              ...attemptEntry,
              syncStatus,
              updatedAt: now,
            }
          : attemptEntry
      ),
    })
  )

  return updatedAttempt
}

export async function listOfflinePracticeAttempts(
  participantId: string,
  storage = createCapacitorOfflinePracticeStorage(),
  syncStatus?: OfflinePracticeAttemptSyncStatus
): Promise<OfflinePracticeAttempt[]> {
  const index = await readOfflinePracticeIndex(participantId, storage)
  const entries =
    typeof syncStatus === 'undefined'
      ? index.attempts
      : index.attempts.filter((attempt) => attempt.syncStatus === syncStatus)
  const attempts = await Promise.all(
    entries.map((entry) =>
      loadOfflinePracticeAttempt(participantId, entry.clientAttemptId, storage)
    )
  )

  return attempts.filter((attempt): attempt is OfflinePracticeAttempt =>
    Boolean(attempt)
  )
}

export async function listDownloadedPracticeQuizzes(
  participantId: string,
  storage = createCapacitorOfflinePracticeStorage()
) {
  return (await readOfflinePracticeIndex(participantId, storage)).quizzes
}

export async function loadDownloadedPracticeQuiz(
  participantId: string,
  quizId: string,
  storage = createCapacitorOfflinePracticeStorage(),
  quizRevision?: string
): Promise<OfflinePracticeSnapshot | null> {
  const index = await readOfflinePracticeIndex(participantId, storage)
  const entry = index.quizzes.find(
    (item) =>
      item.quizId === quizId &&
      (typeof quizRevision === 'undefined' ||
        item.quizRevision === quizRevision)
  )

  if (!entry) return null

  const rawSnapshot = await storage.readText(entry.snapshotPath)
  if (!rawSnapshot) return null

  return JSON.parse(rawSnapshot) as OfflinePracticeSnapshot
}

export async function deleteDownloadedPracticeQuiz(
  participantId: string,
  quizId: string,
  storage = createCapacitorOfflinePracticeStorage()
) {
  const index = await readOfflinePracticeIndex(participantId, storage)

  await storage.deleteDirectory(getQuizDirectory(participantId, quizId))
  await storage.deleteDirectory(getQuizAttemptsDirectory(participantId, quizId))
  await writeOfflinePracticeIndex(participantId, storage, {
    ...index,
    quizzes: index.quizzes.filter((entry) => entry.quizId !== quizId),
    attempts: index.attempts.filter((entry) => entry.quizId !== quizId),
  })
}

export async function clearOfflinePracticeData(
  participantId: string,
  storage = createCapacitorOfflinePracticeStorage()
) {
  await storage.deleteDirectory(getParticipantRoot(participantId))
  forgetRememberedOfflinePracticeParticipant(participantId)
}

export async function clearOfflinePracticeDataBestEffort(
  participantId: string | null | undefined,
  storage = createCapacitorOfflinePracticeStorage()
) {
  if (!participantId) return

  try {
    await clearOfflinePracticeData(participantId, storage)
  } catch (error) {
    console.warn('Could not clear offline practice data:', error)
  }
}

export function createCapacitorOfflinePracticeStorage(): OfflinePracticeStorageAdapter {
  async function getFilesystem() {
    const { Directory, Encoding, Filesystem } = await import(
      '@capacitor/filesystem'
    )
    return { Directory, Encoding, Filesystem }
  }

  return {
    async readText(path) {
      const { Directory, Encoding, Filesystem } = await getFilesystem()

      try {
        const { data } = await Filesystem.readFile({
          path,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        })

        return String(data)
      } catch (error) {
        if (isMissingFileError(error)) return null

        throw new OfflinePracticeStorageError(
          'read_failed',
          `Could not read offline practice file ${path}`,
          error
        )
      }
    },
    async writeText(path, data) {
      const { Directory, Encoding, Filesystem } = await getFilesystem()

      try {
        await Filesystem.writeFile({
          path,
          data,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        })
      } catch (error) {
        throw new OfflinePracticeStorageError(
          isQuotaError(error) ? 'quota_exceeded' : 'write_failed',
          `Could not write offline practice file ${path}`,
          error
        )
      }
    },
    async deleteDirectory(path) {
      const { Directory, Filesystem } = await getFilesystem()

      try {
        await Filesystem.rmdir({
          path,
          directory: Directory.Data,
          recursive: true,
        })
      } catch (error) {
        if (isMissingFileError(error)) return

        throw new OfflinePracticeStorageError(
          'delete_failed',
          `Could not delete offline practice directory ${path}`,
          error
        )
      }
    },
  }
}

export function createMemoryOfflinePracticeStorage(
  initialFiles?: Record<string, string>
): OfflinePracticeStorageAdapter & { files: Map<string, string> } {
  const files = new Map(Object.entries(initialFiles ?? {}))

  return {
    files,
    async readText(path) {
      return files.get(path) ?? null
    },
    async writeText(path, data) {
      files.set(path, data)
    },
    async deleteDirectory(path) {
      const prefix = `${path}/`

      for (const filePath of Array.from(files.keys())) {
        if (filePath === path || filePath.startsWith(prefix)) {
          files.delete(filePath)
        }
      }
    },
  }
}
