import { createHash } from 'node:crypto'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  createDirectUploadCleanupOriginalId,
  createPendingDirectUploadOriginalId,
} from '../src/lib/importExportMediaIdentity.js'
import {
  MAX_DIRECT_MEDIA_UPLOAD_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
} from '../src/lib/importExportPackageConfig.js'
import { MediaExportOmissionError } from '../src/lib/mediaErrors.js'
import { finalizeUploadedMediaFingerprintV1 } from '../src/services/importExportFingerprints.js'
import {
  markFingerprintCurrent,
  type FakeFingerprintResource,
} from './importExportFingerprintTestSupport.js'

const mocks = vi.hoisted(() => ({
  downloadKlickerMediaFile:
    vi.fn<
      (
        href: string,
        ctx: { prisma: unknown }
      ) => Promise<{ buffer: Buffer; contentType: string } | null>
    >(),
  refreshElementDidacticFingerprintV1:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
}))

vi.mock('../src/services/mediaStorageTargets.js', () => ({
  downloadKlickerMediaFile: mocks.downloadKlickerMediaFile,
}))

vi.mock(
  '../src/services/importExportFingerprintPersistence.js',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../src/services/importExportFingerprintPersistence.js')
    >()),
    refreshElementDidacticFingerprint:
      mocks.refreshElementDidacticFingerprintV1,
  })
)

type FakeMediaFile = {
  id: string
  href: string
  ownerId?: string
  originalId?: string | null
  contentHash: string | null
  importFingerprintVersion: number | null
}

type FakeUploadedMediaFile = FakeMediaFile & {
  ownerId: string
  originalId?: string | null
}

type FakeUploadedMediaReferenceElement = FakeFingerprintResource & {
  version: number
  ownerId: string
  content: string
  explanation: string | null
  options: unknown
}

function createUploadedMediaPrisma(
  mediaFiles: FakeUploadedMediaFile[],
  elements: FakeUploadedMediaReferenceElement[] = [],
  beforeUpdateMany?: () => void | Promise<void>
) {
  let nextTransactionId = 1
  const findFirst = vi.fn(
    async ({ where }: { where: { id: string; ownerId: string } }) => {
      const mediaFile = mediaFiles.find(
        (candidate) =>
          candidate.id === where.id && candidate.ownerId === where.ownerId
      )
      return mediaFile
        ? {
            id: mediaFile.id,
            href: mediaFile.href,
            originalId: mediaFile.originalId ?? null,
            contentHash: mediaFile.contentHash,
            importFingerprintVersion: mediaFile.importFingerprintVersion,
          }
        : null
    }
  )
  const updateMany = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string; ownerId: string; href: string; OR: unknown[] }
      data: {
        originalId?: null
        contentHash: string | null
        importFingerprintVersion: number
      }
    }) => {
      await beforeUpdateMany?.()
      const mediaFile = mediaFiles.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.ownerId === where.ownerId &&
          candidate.href === where.href &&
          (candidate.importFingerprintVersion !==
            IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION ||
            (candidate.contentHash === null && data.contentHash !== null))
      )
      if (!mediaFile) return { count: 0 }
      if ('originalId' in data) mediaFile.originalId = data.originalId
      mediaFile.contentHash = data.contentHash
      mediaFile.importFingerprintVersion = data.importFingerprintVersion
      return { count: 1 }
    }
  )
  const count = vi.fn(
    async ({
      where,
    }: {
      where: {
        id: string
        ownerId: string
        href: string
        importFingerprintVersion: number
        contentHash: string | null
        originalId?: string | null
      }
    }) =>
      mediaFiles.filter(
        (candidate) =>
          candidate.id === where.id &&
          candidate.ownerId === where.ownerId &&
          candidate.href === where.href &&
          (typeof where.originalId === 'undefined' ||
            (candidate.originalId ?? null) === where.originalId) &&
          candidate.importFingerprintVersion ===
            where.importFingerprintVersion &&
          candidate.contentHash === where.contentHash
      ).length
  )
  const executeRaw = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [currentVersion, href] = values as [number, string]
      let updated = 0
      for (const element of elements) {
        if (
          element.isDeleted ||
          (element.importFingerprintVersion !== null &&
            element.importFingerprintVersion !== currentVersion) ||
          ![
            element.content,
            element.explanation ?? '',
            JSON.stringify(element.options),
          ].some((value) => value.includes(href))
        ) {
          continue
        }

        element.version += 1
        element.importFingerprint = null
        element.importFingerprintVersion = null
        updated += 1
      }
      return updated
    }
  )
  const queryRaw = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [href] = values as [string]
      const dirtyToken = (nextTransactionId++).toString(16).padStart(64, '0')
      return elements.flatMap((element) => {
        const referencesHref = [
          element.content,
          element.explanation ?? '',
          JSON.stringify(element.options),
        ].some((value) => value.includes(href))
        if (element.isDeleted || !referencesHref) return []

        element.importFingerprint = dirtyToken
        element.importFingerprintVersion = null
        return [{ id: element.id }]
      })
    }
  )
  mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
    markFingerprintCurrent(elements, id)
    return {
      status: 'updated',
      computed: {
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        fingerprint: `fingerprint-${id}`,
      },
    }
  })
  const prisma = {
    mediaFile: { count, findFirst, updateMany },
    $executeRaw: executeRaw,
    $queryRaw: queryRaw,
  } as unknown as Parameters<typeof finalizeUploadedMediaFingerprintV1>[1]
  Object.assign(prisma, {
    $transaction: vi.fn(
      async (operation: (tx: typeof prisma) => Promise<unknown>) =>
        await operation(prisma)
    ),
  })

  return { count, executeRaw, findFirst, prisma, queryRaw, updateMany }
}

describe('direct media upload fingerprint finalization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('securely finalizes an owned direct upload and reruns idempotently', async () => {
    const buffer = Buffer.from('direct upload bytes')
    const expectedHash = createHash('sha256').update(buffer).digest('hex')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: createPendingDirectUploadOriginalId('media-upload'),
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { executeRaw, prisma, updateMany } =
      createUploadedMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer,
      contentType: 'image/png',
    })

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)
    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)

    expect(mediaFiles[0]).toMatchObject({
      contentHash: expectedHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })
    expect(updateMany).toHaveBeenCalledOnce()
    expect(executeRaw).not.toHaveBeenCalled()
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledOnce()
  })

  it('hashes direct media at the package export byte boundary', async () => {
    const buffer = Buffer.alloc(MAX_IMPORT_EXPORT_MEDIA_BYTES)
    const expectedHash = createHash('sha256').update(buffer).digest('hex')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: createPendingDirectUploadOriginalId('media-upload'),
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { prisma } = createUploadedMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer,
      contentType: 'image/png',
    })

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)
    expect(mediaFiles[0]).toMatchObject({
      originalId: null,
      contentHash: expectedHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })
  })

  it('finalizes direct media at the upload limit as a known export omission', async () => {
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: createPendingDirectUploadOriginalId('media-upload'),
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { executeRaw, prisma, updateMany } =
      createUploadedMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockRejectedValue(
      new MediaExportOmissionError('too-large', MAX_DIRECT_MEDIA_UPLOAD_BYTES)
    )

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)
    expect(mediaFiles[0]).toMatchObject({
      originalId: null,
      contentHash: null,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })
    expect(updateMany).toHaveBeenCalledOnce()
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('keeps a direct upload above the absolute limit pending for cleanup', async () => {
    const pendingOriginalId =
      createPendingDirectUploadOriginalId('media-upload')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: pendingOriginalId,
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { prisma, updateMany } = createUploadedMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockRejectedValue(
      new MediaExportOmissionError(
        'too-large',
        MAX_DIRECT_MEDIA_UPLOAD_BYTES + 1
      )
    )

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(false)
    expect(mediaFiles[0]).toMatchObject({
      originalId: pendingOriginalId,
      contentHash: null,
      importFingerprintVersion: null,
    })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('keeps an indeterminate pending upload hidden for bounded cleanup', async () => {
    const pendingOriginalId =
      createPendingDirectUploadOriginalId('media-upload')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: pendingOriginalId,
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { executeRaw, prisma, updateMany } =
      createUploadedMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockRejectedValue(
      new MediaExportOmissionError('unknown-size')
    )

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(false)
    expect(mediaFiles[0]).toMatchObject({
      originalId: pendingOriginalId,
      contentHash: null,
      importFingerprintVersion: null,
    })
    expect(updateMany).not.toHaveBeenCalled()
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('does not scan or mutate elements when a pending direct upload becomes visible', async () => {
    const href = 'https://storage.invalid/owner-1/media-upload.png'
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href,
        originalId: createPendingDirectUploadOriginalId('media-upload'),
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    ]
    const elements: FakeUploadedMediaReferenceElement[] = [
      {
        id: 1,
        version: 1,
        ownerId: 'owner-1',
        content: `![diagram](<${href}>)`,
        explanation: null,
        options: {},
        importFingerprint: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 2,
        version: 1,
        ownerId: 'owner-2',
        content: `![diagram](<${href}>)`,
        explanation: null,
        options: {},
        importFingerprint: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 3,
        version: 1,
        ownerId: 'owner-1',
        content: 'No media reference',
        explanation: null,
        options: {},
        importFingerprint: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 4,
        version: 1,
        ownerId: 'owner-1',
        content: `![diagram](<${href}>)`,
        explanation: null,
        options: {},
        importFingerprint: 'already-computed',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
    ]
    const { executeRaw, prisma } = createUploadedMediaPrisma(
      mediaFiles,
      elements
    )
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer: Buffer.from('direct upload bytes'),
      contentType: 'image/png',
    })

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)

    expect(elements.map((element) => element.importFingerprintVersion)).toEqual(
      Array(4).fill(IMPORT_EXPORT_FINGERPRINT_VERSION)
    )
    expect(elements.map((element) => element.version)).toEqual([1, 1, 1, 1])
    expect(executeRaw).not.toHaveBeenCalled()
    expect(mocks.refreshElementDidacticFingerprintV1).not.toHaveBeenCalled()
    expect(elements.map((element) => element.importFingerprint)).toEqual([
      null,
      null,
      null,
      'already-computed',
    ])
  })

  it('repairs the media hash when rollout backfill wins between read and compare-and-set', async () => {
    const href = 'https://storage.invalid/owner-1/media-upload.png'
    const buffer = Buffer.from('direct upload bytes')
    const expectedHash = createHash('sha256').update(buffer).digest('hex')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href,
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const elements: FakeUploadedMediaReferenceElement[] = [
      {
        id: 1,
        version: 1,
        ownerId: 'owner-1',
        content: `![diagram](<${href}>)`,
        explanation: null,
        options: {},
        importFingerprint: 'omission-fingerprint',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
    ]
    const backfillWinsRace = vi.fn(() => {
      mediaFiles[0]!.contentHash = expectedHash
      mediaFiles[0]!.importFingerprintVersion =
        IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    })
    const { executeRaw, prisma, updateMany } = createUploadedMediaPrisma(
      mediaFiles,
      elements,
      backfillWinsRace
    )
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer,
      contentType: 'image/png',
    })

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)

    expect(backfillWinsRace).toHaveBeenCalledOnce()
    expect(updateMany).toHaveBeenCalledOnce()
    expect(mediaFiles[0]).toMatchObject({
      contentHash: expectedHash,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })
    expect(elements[0]).toMatchObject({
      version: 1,
      importFingerprint: 'fingerprint-1',
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('does not finalize another owner media or a temporarily missing blob', async () => {
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: createPendingDirectUploadOriginalId('media-upload'),
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    ]
    const { prisma, updateMany } = createUploadedMediaPrisma(mediaFiles)

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-2' },
        prisma
      )
    ).resolves.toBe(false)
    mocks.downloadKlickerMediaFile.mockResolvedValue(null)
    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(false)

    expect(updateMany).not.toHaveBeenCalled()
    expect(mediaFiles[0]).toMatchObject({
      contentHash: null,
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })

    const buffer = Buffer.from('eventually visible upload')
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer,
      contentType: 'image/png',
    })
    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(true)
    expect(mediaFiles[0]?.contentHash).toBe(
      createHash('sha256').update(buffer).digest('hex')
    )
    expect(updateMany).toHaveBeenCalledOnce()
  })

  it('does not finalize a direct upload after cleanup has claimed it', async () => {
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        originalId: createDirectUploadCleanupOriginalId('media-upload'),
        contentHash: 'a'.repeat(64),
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    ]
    const { prisma, updateMany } = createUploadedMediaPrisma(mediaFiles)

    await expect(
      finalizeUploadedMediaFingerprintV1(
        { mediaFileId: 'media-upload', ownerId: 'owner-1' },
        prisma
      )
    ).resolves.toBe(false)
    expect(updateMany).not.toHaveBeenCalled()
    expect(mocks.downloadKlickerMediaFile).not.toHaveBeenCalled()
  })
})
