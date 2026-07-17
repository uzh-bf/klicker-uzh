import { createHash } from 'node:crypto'
import { IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import { MediaExportOmissionError } from '../src/lib/mediaErrors.js'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
  refreshImportExportFingerprintBatch,
  repairStaleImportExportFingerprints,
} from '../src/services/importExportFingerprintMaintenance.js'
import { finalizeUploadedMediaFingerprintV1 } from '../src/services/importExportFingerprints.js'
import {
  createFingerprintFindMany,
  createFingerprintPrisma,
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
  refreshAnswerCollectionDidacticFingerprintV1:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
  refreshElementDidacticFingerprintV1:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
}))

vi.mock('../src/services/mediaStorage.js', () => ({
  downloadKlickerMediaFile: mocks.downloadKlickerMediaFile,
}))

vi.mock('../src/services/importExportFingerprintPersistence.js', () => ({
  refreshAnswerCollectionDidacticFingerprintV1:
    mocks.refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprintV1:
    mocks.refreshElementDidacticFingerprintV1,
}))

type FakeMediaFile = {
  id: string
  href: string
  contentHash: string | null
  importFingerprintVersion: number | null
}

type MediaFindManyArgs = {
  where: { OR?: unknown[]; id?: { gt: string } }
  take: number
}

type MediaUpdateManyArgs = {
  where: { id: string; href: string; OR: unknown[] }
  data: { contentHash: string | null; importFingerprintVersion: number }
}

function createMediaPrisma(mediaFiles: FakeMediaFile[]) {
  const findMany = vi.fn(async ({ where, take }: MediaFindManyArgs) => {
    return mediaFiles
      .filter(
        (mediaFile) =>
          (!where.OR ||
            mediaFile.importFingerprintVersion !==
              IMPORT_EXPORT_FINGERPRINT_VERSION) &&
          (!where.id || mediaFile.id > where.id.gt)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, take)
      .map(({ id, href }) => ({ id, href }))
  })
  const updateMany = vi.fn(async ({ where, data }: MediaUpdateManyArgs) => {
    const mediaFile = mediaFiles.find(
      (candidate) =>
        candidate.id === where.id &&
        candidate.href === where.href &&
        candidate.importFingerprintVersion !== IMPORT_EXPORT_FINGERPRINT_VERSION
    )
    if (!mediaFile) return { count: 0 }

    mediaFile.contentHash = data.contentHash
    mediaFile.importFingerprintVersion = data.importFingerprintVersion
    return { count: 1 }
  })
  const prisma = {
    mediaFile: { findMany, updateMany },
  } as unknown as Parameters<typeof backfillMediaHashBatch>[1]

  return { findMany, prisma, updateMany }
}

type FakeUploadedMediaFile = FakeMediaFile & { ownerId: string }

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
      data: { contentHash: string | null; importFingerprintVersion: number }
    }) => {
      await beforeUpdateMany?.()
      const mediaFile = mediaFiles.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.ownerId === where.ownerId &&
          candidate.href === where.href &&
          (candidate.importFingerprintVersion !==
            IMPORT_EXPORT_FINGERPRINT_VERSION ||
            (candidate.contentHash === null && data.contentHash !== null))
      )
      if (!mediaFile) return { count: 0 }
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
      }
    }) =>
      mediaFiles.filter(
        (candidate) =>
          candidate.id === where.id &&
          candidate.ownerId === where.ownerId &&
          candidate.href === where.href &&
          candidate.importFingerprintVersion ===
            where.importFingerprintVersion &&
          candidate.contentHash === where.contentHash
      ).length
  )
  const executeRaw = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [ownerId, currentVersion, href] = values as [string, number, string]
      let updated = 0
      for (const element of elements) {
        if (
          element.ownerId !== ownerId ||
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
  const prisma = {
    mediaFile: { count, findFirst, updateMany },
    $executeRaw: executeRaw,
  } as unknown as Parameters<typeof finalizeUploadedMediaFingerprintV1>[1]
  Object.assign(prisma, {
    $transaction: vi.fn(
      async (operation: (tx: typeof prisma) => Promise<unknown>) =>
        await operation(prisma)
    ),
  })

  return { count, executeRaw, findFirst, prisma, updateMany }
}

describe('import/export fingerprint maintenance batches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('does not start a refresh page after cooperative cancellation', async () => {
    await expect(
      refreshImportExportFingerprintBatch(
        { answerCollectionId: 77 },
        {} as Parameters<typeof refreshImportExportFingerprintBatch>[1],
        () => true
      )
    ).resolves.toEqual({
      processed: 0,
      stoppedEarly: true,
    })
    expect(
      mocks.refreshAnswerCollectionDidacticFingerprintV1
    ).not.toHaveBeenCalled()
    expect(mocks.refreshElementDidacticFingerprintV1).not.toHaveBeenCalled()
  })

  it('refreshes one directly authored element without collection fan-out', async () => {
    mocks.refreshElementDidacticFingerprintV1.mockResolvedValue({
      status: 'updated',
      computed: null,
    })

    await expect(
      refreshImportExportFingerprintBatch(
        { elementId: 77 },
        {} as Parameters<typeof refreshImportExportFingerprintBatch>[1]
      )
    ).resolves.toEqual({ processed: 1 })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      77,
      expect.anything()
    )
    expect(
      mocks.refreshAnswerCollectionDidacticFingerprintV1
    ).not.toHaveBeenCalled()
  })

  it('records omitted early media identities and resumes later rows', async () => {
    const mediaFiles = Array.from({ length: 51 }, (_, index) => {
      const id = String(index + 1).padStart(3, '0')
      return {
        id,
        href: `https://storage.invalid/media-${id}`,
        contentHash: null,
        importFingerprintVersion: null,
      }
    })
    const { findMany, prisma, updateMany } = createMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockImplementation(async (href) => {
      if (href.endsWith('001')) throw new MediaExportOmissionError('too-large')
      if (href.endsWith('002')) return null
      return {
        buffer: Buffer.from(`bytes:${href}`),
        contentType: 'image/png',
      }
    })

    const firstPage = await backfillMediaHashBatch({}, prisma)
    const secondPage = await backfillMediaHashBatch(
      { afterId: firstPage.nextAfterId },
      prisma
    )

    expect(firstPage).toEqual({ processed: 50, nextAfterId: '050' })
    expect(secondPage).toEqual({ processed: 1, nextAfterId: undefined })
    expect(mediaFiles[0]?.contentHash).toBeNull()
    expect(mediaFiles[1]?.contentHash).toBeNull()
    expect(mediaFiles[0]?.importFingerprintVersion).toBe(
      IMPORT_EXPORT_FINGERPRINT_VERSION
    )
    expect(mediaFiles[1]?.importFingerprintVersion).toBe(
      IMPORT_EXPORT_FINGERPRINT_VERSION
    )
    expect(mediaFiles[50]?.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledTimes(51)
    expect(updateMany).toHaveBeenCalledTimes(51)
    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    )
  })

  it('conditionally writes a media hash and performs no work on an idempotent rerun', async () => {
    const buffer = Buffer.from('stable media bytes')
    const expectedHash = createHash('sha256').update(buffer).digest('hex')
    const mediaFiles = [
      {
        id: 'media-001',
        href: 'https://storage.invalid/media-001',
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { findMany, prisma, updateMany } = createMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer,
      contentType: 'image/png',
    })

    await expect(backfillMediaHashBatch({}, prisma)).resolves.toEqual({
      processed: 1,
      nextAfterId: undefined,
    })
    await expect(backfillMediaHashBatch({}, prisma)).resolves.toEqual({
      processed: 0,
      nextAfterId: undefined,
    })

    expect(updateMany).toHaveBeenCalledOnce()
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'media-001',
        href: 'https://storage.invalid/media-001',
        OR: expect.any(Array),
      },
      data: {
        contentHash: expectedHash,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      },
    })
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledOnce()
    expect(mediaFiles[0]?.contentHash).toBe(expectedHash)
  })

  it('records unsupported media as a versioned omission without a hash', async () => {
    const mediaFiles = [
      {
        id: 'media-svg',
        href: 'https://storage.invalid/media.svg',
        contentHash: 'a'.repeat(64),
        importFingerprintVersion: null,
      },
    ]
    const { prisma } = createMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer: Buffer.from('<svg/>'),
      contentType: 'image/svg+xml',
    })

    await expect(backfillMediaHashBatch({}, prisma)).resolves.toEqual({
      processed: 1,
      nextAfterId: undefined,
    })
    expect(mediaFiles[0]).toMatchObject({
      contentHash: null,
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
  })

  it('does not swallow a conditional media hash database failure', async () => {
    const mediaFiles = [
      {
        id: 'media-001',
        href: 'https://storage.invalid/media-001',
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { prisma, updateMany } = createMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer: Buffer.from('downloaded bytes'),
      contentType: 'image/png',
    })
    updateMany.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(backfillMediaHashBatch({}, prisma)).rejects.toThrow(
      'database unavailable'
    )
  })

  it('does not swallow an unexpected media download failure', async () => {
    const mediaFiles = [
      {
        id: 'media-001',
        href: 'https://storage.invalid/media-001',
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { prisma, updateMany } = createMediaPrisma(mediaFiles)
    mocks.downloadKlickerMediaFile.mockRejectedValueOnce(
      new Error('storage unavailable')
    )

    await expect(backfillMediaHashBatch({}, prisma)).rejects.toThrow(
      'storage unavailable'
    )
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('securely finalizes an owned direct upload and reruns idempotently', async () => {
    const buffer = Buffer.from('direct upload bytes')
    const expectedHash = createHash('sha256').update(buffer).digest('hex')
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
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
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    expect(updateMany).toHaveBeenCalledOnce()
    expect(executeRaw).toHaveBeenCalledOnce()
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledOnce()
  })

  it('repairs a direct upload classified as omitted before its blob became visible', async () => {
    const href = 'https://storage.invalid/owner-1/media-upload.png'
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href,
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
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
      [null, 1, 1, null]
    )
    expect(elements.map((element) => element.version)).toEqual([2, 1, 1, 2])
    expect(executeRaw).toHaveBeenCalledOnce()

    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
      markFingerprintCurrent(elements, id)
    })
    const { prisma: repairPrisma } = createFingerprintPrisma({ elements })
    await expect(
      repairStaleImportExportFingerprints(repairPrisma)
    ).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 2,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      1,
      expect.anything()
    )
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      4,
      expect.anything()
    )
    expect([elements[0], elements[3]]).toMatchObject([
      {
        importFingerprint: 'fingerprint-1',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      },
      {
        importFingerprint: 'fingerprint-4',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      },
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
        IMPORT_EXPORT_FINGERPRINT_VERSION
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
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    expect(elements[0]).toMatchObject({
      version: 2,
      importFingerprint: null,
      importFingerprintVersion: null,
    })
    expect(executeRaw).toHaveBeenCalledOnce()
  })

  it('does not finalize another owner media or a temporarily missing blob', async () => {
    const mediaFiles: FakeUploadedMediaFile[] = [
      {
        id: 'media-upload',
        ownerId: 'owner-1',
        href: 'https://storage.invalid/owner-1/media-upload.png',
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
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
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
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

  it.each(['ELEMENT', 'ANSWER_COLLECTION'] as const)(
    'rollout-refreshes null and stale-version %s fingerprints and reruns without writes',
    async (resource) => {
      const resources = Array.from({ length: 100 }, (_, index) => {
        const id = index + 1
        const dirtyVariant = id % 3
        return {
          id,
          importFingerprint:
            dirtyVariant === 0 ? null : `legacy-fingerprint-${id}`,
          importFingerprintVersion:
            dirtyVariant === 1
              ? null
              : dirtyVariant === 2
                ? IMPORT_EXPORT_FINGERPRINT_VERSION + 1
                : IMPORT_EXPORT_FINGERPRINT_VERSION,
          isDeleted: false,
        }
      })
      resources.push({
        id: 101,
        importFingerprint: 'current-fingerprint',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      })
      const findMany = createFingerprintFindMany(resources)
      const prisma = {
        element: {
          findMany: resource === 'ELEMENT' ? findMany : vi.fn(),
        },
        answerCollection: {
          findMany: resource === 'ANSWER_COLLECTION' ? findMany : vi.fn(),
        },
      } as unknown as Parameters<typeof backfillFingerprintBatch>[1]
      const refresh =
        resource === 'ELEMENT'
          ? mocks.refreshElementDidacticFingerprintV1
          : mocks.refreshAnswerCollectionDidacticFingerprintV1
      refresh.mockImplementation(async (id) => {
        markFingerprintCurrent(resources, id)
      })

      const firstPage = await backfillFingerprintBatch({ resource }, prisma)
      const continuation = await backfillFingerprintBatch(
        { resource, afterId: firstPage.nextAfterId },
        prisma
      )
      const secondRun = await backfillFingerprintBatch({ resource }, prisma)

      expect(firstPage).toEqual({ processed: 100, nextAfterId: 100 })
      expect(continuation).toEqual({ processed: 0, nextAfterId: undefined })
      expect(secondRun).toEqual({ processed: 0, nextAfterId: undefined })
      expect(refresh).toHaveBeenCalledTimes(100)
      expect(findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { importFingerprint: null },
              { importFingerprintVersion: null },
              {
                importFingerprintVersion: {
                  not: IMPORT_EXPORT_FINGERPRINT_VERSION,
                },
              },
            ],
          }),
          orderBy: { id: 'asc' },
          take: 100,
        })
      )
    }
  )

  it('refreshes a collection first and its linked dirty elements in bounded pages', async () => {
    const collectionId = 77
    const elements: FakeFingerprintResource[] = Array.from(
      { length: 101 },
      (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
        answerCollectionId: collectionId,
      })
    )
    elements.push(
      {
        id: 102,
        importFingerprint: 'current-fingerprint',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
        answerCollectionId: collectionId,
      },
      {
        id: 103,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
        answerCollectionId: collectionId + 1,
      },
      {
        id: 104,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: true,
        answerCollectionId: collectionId,
      }
    )
    const events: string[] = []
    const findMany = createFingerprintFindMany(elements)
    const prisma = {
      element: { findMany },
      answerCollection: { findMany: vi.fn() },
    } as unknown as Parameters<typeof refreshImportExportFingerprintBatch>[1]
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => {
        events.push(`collection:${id}`)
      }
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
      events.push(`element:${id}`)
      markFingerprintCurrent(elements, id)
    })

    const firstPage = await refreshImportExportFingerprintBatch(
      { answerCollectionId: collectionId },
      prisma
    )
    const secondPage = await refreshImportExportFingerprintBatch(
      {
        answerCollectionId: collectionId,
        afterElementId: firstPage.nextAfterElementId,
      },
      prisma
    )

    expect(firstPage).toEqual({
      processed: 101,
      nextAfterElementId: 100,
    })
    expect(secondPage).toEqual({
      processed: 1,
      nextAfterElementId: undefined,
    })
    expect(events[0]).toBe(`collection:${collectionId}`)
    expect(
      mocks.refreshAnswerCollectionDidacticFingerprintV1
    ).toHaveBeenCalledOnce()
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(101)
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          answerCollectionId: collectionId,
          id: { gt: 100 },
        }),
        take: 100,
      })
    )
  })
})
