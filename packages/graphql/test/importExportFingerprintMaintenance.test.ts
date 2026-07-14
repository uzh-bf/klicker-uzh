import { createHash } from 'node:crypto'
import { IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import { MediaExportOmissionError } from '../src/lib/mediaErrors.js'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
  refreshAnswerCollectionFingerprintBatch,
} from '../src/services/importExportFingerprintMaintenance.js'

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

type FakeFingerprintResource = {
  id: number
  importFingerprint: string | null
  importFingerprintVersion: number | null
  isDeleted: boolean
  answerCollectionId?: number | null
}

type FingerprintFindManyArgs = {
  where: {
    id?: { gt: number }
    isDeleted?: boolean
    answerCollectionId?: number
    OR?: unknown[]
  }
  take: number
}

function isDirtyFingerprint(resource: FakeFingerprintResource) {
  return (
    resource.importFingerprint === null ||
    resource.importFingerprintVersion === null ||
    resource.importFingerprintVersion !== IMPORT_EXPORT_FINGERPRINT_VERSION
  )
}

function createFingerprintFindMany(resources: FakeFingerprintResource[]) {
  return vi.fn(async ({ where, take }: FingerprintFindManyArgs) => {
    return resources
      .filter(
        (resource) =>
          (where.isDeleted !== false || !resource.isDeleted) &&
          (typeof where.answerCollectionId === 'undefined' ||
            resource.answerCollectionId === where.answerCollectionId) &&
          (!where.id || resource.id > where.id.gt) &&
          (!where.OR || isDirtyFingerprint(resource))
      )
      .sort((left, right) => left.id - right.id)
      .slice(0, take)
      .map(({ id }) => ({ id }))
  })
}

function markFingerprintCurrent(
  resources: FakeFingerprintResource[],
  resourceId: number
) {
  const resource = resources.find(({ id }) => id === resourceId)
  if (!resource)
    throw new Error(`Missing fake fingerprint resource ${resourceId}`)

  resource.importFingerprint = `fingerprint-${resourceId}`
  resource.importFingerprintVersion = IMPORT_EXPORT_FINGERPRINT_VERSION
}

describe('import/export fingerprint maintenance batches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

  it.each(['ELEMENT', 'ANSWER_COLLECTION'] as const)(
    'globally refreshes null and mismatched %s fingerprints, advances the cursor, and reruns without writes',
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
    } as unknown as Parameters<
      typeof refreshAnswerCollectionFingerprintBatch
    >[1]
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => {
        events.push(`collection:${id}`)
      }
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
      events.push(`element:${id}`)
      markFingerprintCurrent(elements, id)
    })

    const firstPage = await refreshAnswerCollectionFingerprintBatch(
      { answerCollectionId: collectionId },
      prisma
    )
    const secondPage = await refreshAnswerCollectionFingerprintBatch(
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
