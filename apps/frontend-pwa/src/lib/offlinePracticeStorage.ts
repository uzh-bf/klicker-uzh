import type { GetPracticeQuizDownloadSnapshotQuery } from '@klicker-uzh/graphql/dist/ops'

const OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION = 1
const OFFLINE_PRACTICE_ROOT = 'offline-practice'

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

export interface OfflinePracticeIndex {
  schemaVersion: number
  quizzes: OfflinePracticeIndexEntry[]
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

function encodedPathSegment(value: string) {
  return encodeURIComponent(value)
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

export function getOfflinePracticeStoragePaths(participantId: string) {
  return {
    root: OFFLINE_PRACTICE_ROOT,
    participantRoot: getParticipantRoot(participantId),
    index: getIndexPath(participantId),
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

  return {
    schemaVersion:
      parsed.schemaVersion ?? OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
    quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
  }
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
  }

  await writeOfflinePracticeIndex(participantId, storage, {
    schemaVersion: OFFLINE_PRACTICE_INDEX_SCHEMA_VERSION,
    quizzes: [
      entry,
      ...index.quizzes.filter((item) => item.quizId !== snapshot.quiz.id),
    ].sort((itemA, itemB) =>
      itemA.displayName.localeCompare(itemB.displayName)
    ),
  })

  return entry
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
  await writeOfflinePracticeIndex(participantId, storage, {
    ...index,
    quizzes: index.quizzes.filter((entry) => entry.quizId !== quizId),
  })
}

export async function clearOfflinePracticeData(
  participantId: string,
  storage = createCapacitorOfflinePracticeStorage()
) {
  await storage.deleteDirectory(getParticipantRoot(participantId))
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
