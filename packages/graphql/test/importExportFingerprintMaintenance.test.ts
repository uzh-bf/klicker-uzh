import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  createDirectUploadCleanupOriginalId,
  createPendingDirectUploadOriginalId,
  hasDirectUploadLifecycleMarker,
} from '../src/lib/importExportMediaIdentity.js'
import { MediaExportOmissionError } from '../src/lib/mediaErrors.js'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
  refreshImportExportFingerprintBatch,
} from '../src/services/importExportFingerprintMaintenance.js'
import {
  ensureAnswerCollectionAndLinkedElementFingerprintsCurrent,
  ensureElementFingerprintCurrent,
  invalidateElementFingerprintsForFinalizedMediaV1,
  lockElementFingerprintDependencies,
} from '../src/services/importExportFingerprints.js'
import {
  createFingerprintFindMany,
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
  refreshLinkedElementDidacticFingerprintPages:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
}))

vi.mock('../src/services/mediaStorageTargets.js', () => ({
  downloadKlickerMediaFile: mocks.downloadKlickerMediaFile,
}))

vi.mock('../src/services/importExportFingerprintPersistence.js', () => ({
  refreshAnswerCollectionDidacticFingerprint:
    mocks.refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprint: mocks.refreshElementDidacticFingerprintV1,
  refreshLinkedElementDidacticFingerprintPages:
    mocks.refreshLinkedElementDidacticFingerprintPages,
}))

type FakeMediaFile = {
  id: string
  href: string
  ownerId?: string
  originalId?: string | null
  contentHash: string | null
  importFingerprintVersion: number | null
}

type MediaFindManyArgs = {
  where: { AND?: unknown[]; id?: { gt: string } }
  take: number
}

type MediaUpdateManyArgs = {
  where: {
    id: string
    href: string
    originalId?: string | null
    OR: unknown[]
  }
  data: { contentHash: string | null; importFingerprintVersion: number }
}

function createMediaPrisma(
  mediaFiles: FakeMediaFile[],
  elements: FakeUploadedMediaReferenceElement[] = []
) {
  let nextTransactionId = 1
  const findMany = vi.fn(async ({ where, take }: MediaFindManyArgs) => {
    return mediaFiles
      .filter(
        (mediaFile) =>
          mediaFile.importFingerprintVersion !==
            IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION &&
          !hasDirectUploadLifecycleMarker(mediaFile.originalId ?? null) &&
          (!where.id || mediaFile.id > where.id.gt)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, take)
      .map(({ id, href, ownerId, originalId }) => ({
        id,
        href,
        ownerId: ownerId ?? 'owner-1',
        originalId: originalId ?? null,
      }))
  })

  const updateMany = vi.fn(async ({ where, data }: MediaUpdateManyArgs) => {
    const mediaFile = mediaFiles.find(
      (candidate) =>
        candidate.id === where.id &&
        candidate.href === where.href &&
        (candidate.originalId ?? null) === (where.originalId ?? null) &&
        candidate.importFingerprintVersion !==
          IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    )
    if (!mediaFile) return { count: 0 }

    mediaFile.contentHash = data.contentHash
    mediaFile.importFingerprintVersion = data.importFingerprintVersion
    return { count: 1 }
  })
  const invalidateAllElements = vi.fn(
    async (_strings: TemplateStringsArray) => {
      const dirtyToken = (nextTransactionId++).toString(16).padStart(64, '0')
      let updated = 0
      for (const element of elements) {
        if (element.isDeleted) continue
        element.importFingerprint = dirtyToken
        element.importFingerprintVersion = null
        updated += 1
      }
      return updated
    }
  )
  const prisma = {
    $executeRaw: invalidateAllElements,
    mediaFile: { findMany, updateMany },
  } as unknown as Parameters<typeof backfillMediaHashBatch>[1]

  return { findMany, invalidateAllElements, prisma, updateMany }
}

type FakeUploadedMediaReferenceElement = FakeFingerprintResource & {
  version: number
  ownerId: string
  content: string
  explanation: string | null
  options: unknown
}

describe('import/export fingerprint maintenance batches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('retries an optimistic fingerprint conflict and returns only a persisted result', async () => {
    mocks.refreshElementDidacticFingerprintV1
      .mockResolvedValueOnce({
        status: 'stale',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: 'lost-race',
        },
      })
      .mockResolvedValueOnce({
        status: 'updated',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: 'persisted',
        },
      })

    await expect(
      ensureElementFingerprintCurrent(
        77,
        {} as Parameters<typeof ensureElementFingerprintCurrent>[1]
      )
    ).resolves.toMatchObject({ fingerprint: 'persisted' })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(2)
  })

  it('rejects a missing authored element instead of committing without a fingerprint', async () => {
    mocks.refreshElementDidacticFingerprintV1.mockResolvedValue({
      status: 'missing',
      computed: null,
    })

    await expect(
      ensureElementFingerprintCurrent(
        77,
        {} as Parameters<typeof ensureElementFingerprintCurrent>[1]
      )
    ).rejects.toThrow('Cannot fingerprint missing element 77.')
  })

  it('rejects an exact pending direct-upload marker even after hash backfill classified the row', async () => {
    const previousAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    const mediaFileId = '22222222-2222-4222-8222-222222222222'
    const ownerId = '11111111-1111-4111-8111-111111111111'
    const href = `https://testaccount.blob.core.windows.net/${ownerId}/${mediaFileId}.png`
    const queryRaw = vi.fn().mockResolvedValue([
      {
        id: mediaFileId,
        href,
        ownerId,
        originalId: createPendingDirectUploadOriginalId(mediaFileId),
        contentHash: 'a'.repeat(64),
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    ])

    try {
      await expect(
        lockElementFingerprintDependencies(
          {
            type: ElementType.CONTENT,
            content: `![pending](<${href}>)`,
            explanation: null,
            options: {},
          },
          { $queryRaw: queryRaw } as never
        )
      ).rejects.toThrow(
        'Element references first-party media that has not been finalized.'
      )
    } finally {
      if (typeof previousAccount === 'undefined') {
        delete process.env.BLOB_STORAGE_ACCOUNT_NAME
      } else {
        process.env.BLOB_STORAGE_ACCOUNT_NAME = previousAccount
      }
    }
  })

  it('allows unresolved historical media while the feature is dark but always rejects lifecycle markers', async () => {
    const previousAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    const mediaFileId = '22222222-2222-4222-8222-222222222222'
    const ownerId = '11111111-1111-4111-8111-111111111111'
    const href = `https://testaccount.blob.core.windows.net/${ownerId}/${mediaFileId}.png`
    const mediaFile: {
      id: string
      href: string
      ownerId: string
      originalId: string | null
      contentHash: string | null
      importFingerprintVersion: number | null
    } = {
      id: mediaFileId,
      href,
      ownerId,
      originalId: null as string | null,
      contentHash: null,
      importFingerprintVersion: null,
    }
    const queryRaw = vi.fn(async () => [mediaFile])
    const input = {
      type: ElementType.CONTENT,
      content: `![legacy](<${href}>)`,
      explanation: null,
      options: {},
      requireVerifiedMedia: false,
    }

    try {
      await expect(
        lockElementFingerprintDependencies(input, {
          $queryRaw: queryRaw,
        } as never)
      ).resolves.toBeUndefined()

      input.requireVerifiedMedia = true
      mediaFile.importFingerprintVersion =
        IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
      await expect(
        lockElementFingerprintDependencies(input, {
          $queryRaw: queryRaw,
        } as never)
      ).resolves.toBeUndefined()

      mediaFile.originalId = createDirectUploadCleanupOriginalId(mediaFileId)
      mediaFile.contentHash = 'a'.repeat(64)
      await expect(
        lockElementFingerprintDependencies(input, {
          $queryRaw: queryRaw,
        } as never)
      ).rejects.toThrow(
        'Element references first-party media that has not been finalized.'
      )
    } finally {
      if (typeof previousAccount === 'undefined') {
        delete process.env.BLOB_STORAGE_ACCOUNT_NAME
      } else {
        process.env.BLOB_STORAGE_ACCOUNT_NAME = previousAccount
      }
    }
  })

  it('bulk-fingerprints linked elements and retries only page CAS misses', async () => {
    const answerCollectionId = 77
    const prisma = {} as unknown as Parameters<
      typeof ensureAnswerCollectionAndLinkedElementFingerprintsCurrent
    >[1]
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockResolvedValue({
      status: 'updated',
      computed: {
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        fingerprint: 'collection-fingerprint',
      },
    })
    mocks.refreshLinkedElementDidacticFingerprintPages.mockResolvedValue({
      staleElementIds: [50, 101],
    })
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(
      async (id) => ({
        status: 'updated',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: `fingerprint-${id}`,
        },
      })
    )

    await expect(
      ensureAnswerCollectionAndLinkedElementFingerprintsCurrent(
        answerCollectionId,
        prisma
      )
    ).resolves.toBeUndefined()
    expect(
      mocks.refreshLinkedElementDidacticFingerprintPages
    ).toHaveBeenCalledWith(answerCollectionId, prisma)
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(2)
    expect(
      mocks.refreshElementDidacticFingerprintV1.mock.calls.map(([id]) => id)
    ).toEqual([50, 101])
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
      computed: {
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        fingerprint: 'fingerprint-77',
      },
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

  it('retries a stale compare-and-set during one-time backfill', async () => {
    const resources: FakeFingerprintResource[] = [
      {
        id: 77,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
    ]
    const prisma = {
      element: { findMany: createFingerprintFindMany(resources) },
      answerCollection: { findMany: vi.fn() },
    } as unknown as Parameters<typeof backfillFingerprintBatch>[1]
    mocks.refreshElementDidacticFingerprintV1
      .mockResolvedValueOnce({
        status: 'stale',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: 'lost-race',
        },
      })
      .mockResolvedValueOnce({
        status: 'updated',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: 'persisted',
        },
      })

    await expect(
      backfillFingerprintBatch({ resource: 'ELEMENT' }, prisma)
    ).resolves.toEqual({ processed: 1, nextAfterId: undefined })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(2)
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
      IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    )
    expect(mediaFiles[1]?.importFingerprintVersion).toBe(
      IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    )
    expect(mediaFiles[50]?.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledTimes(51)
    expect(updateMany).toHaveBeenCalledTimes(51)
    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
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
        originalId: null,
        OR: expect.any(Array),
      },
      data: {
        contentHash: expectedHash,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledOnce()
    expect(mediaFiles[0]?.contentHash).toBe(expectedHash)
  })

  it('atomically invalidates referenced elements for the full didactic pass', async () => {
    const href = 'https://storage.invalid/owner-1/media-001.png'
    const mediaFiles = [
      {
        id: 'media-001',
        href,
        ownerId: 'owner-1',
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
    const { invalidateAllElements, prisma } = createMediaPrisma(
      mediaFiles,
      elements
    )
    mocks.downloadKlickerMediaFile.mockResolvedValue({
      buffer: Buffer.from('stable media bytes'),
      contentType: 'image/png',
    })
    await expect(backfillMediaHashBatch({}, prisma)).resolves.toEqual({
      processed: 1,
      nextAfterId: undefined,
    })

    expect(mediaFiles[0]).toMatchObject({
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    })
    expect(elements[0]).toMatchObject({
      version: 1,
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: null,
    })
    expect(invalidateAllElements).toHaveBeenCalledOnce()
    expect(
      Array.from(invalidateAllElements.mock.calls[0]![0]).join('?')
    ).toContain("lpad(to_hex(txid_current()), 64, '0')")
    expect(mocks.refreshElementDidacticFingerprintV1).not.toHaveBeenCalled()
  })

  it('uses a new transaction-scoped dirty token for every media invalidation', async () => {
    const href = 'https://storage.invalid/owner-1/media-001.png'
    const elements: FakeUploadedMediaReferenceElement[] = [
      {
        id: 1,
        version: 1,
        ownerId: 'owner-1',
        content: `![diagram](<${href}>)`,
        explanation: null,
        options: {},
        importFingerprint: 'current-fingerprint',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
    ]
    let nextTransactionId = 1
    const queryRaw = vi.fn(
      async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const [referencedHref] = values as [string]
        const dirtyToken = (nextTransactionId++).toString(16).padStart(64, '0')
        return elements.flatMap((element) => {
          if (element.isDeleted || !element.content.includes(referencedHref)) {
            return []
          }
          element.importFingerprint = dirtyToken
          element.importFingerprintVersion = null
          return [{ id: element.id }]
        })
      }
    )
    const prisma = { $queryRaw: queryRaw } as unknown as Parameters<
      typeof invalidateElementFingerprintsForFinalizedMediaV1
    >[1]

    await expect(
      invalidateElementFingerprintsForFinalizedMediaV1({ href }, prisma)
    ).resolves.toEqual([{ id: 1 }])
    const firstDirtyToken = elements[0]!.importFingerprint
    await expect(
      invalidateElementFingerprintsForFinalizedMediaV1({ href }, prisma)
    ).resolves.toEqual([{ id: 1 }])

    expect(firstDirtyToken).toMatch(/^[a-f0-9]{64}$/)
    expect(elements[0]).toMatchObject({
      version: 1,
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: null,
    })
    expect(elements[0]!.importFingerprint).not.toBe(firstDirtyToken)
    expect(Array.from(queryRaw.mock.calls[0]![0]).join('?')).toContain(
      "lpad(to_hex(txid_current()), 64, '0')"
    )
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
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
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

  it('waits for started sibling media work before propagating a failure', async () => {
    const mediaFiles = [
      {
        id: 'media-001',
        href: 'https://storage.invalid/media-001',
        contentHash: null,
        importFingerprintVersion: null,
      },
      {
        id: 'media-002',
        href: 'https://storage.invalid/media-002',
        contentHash: null,
        importFingerprintVersion: null,
      },
    ]
    const { prisma } = createMediaPrisma(mediaFiles)
    let finishSiblingDownload!: (value: {
      buffer: Buffer
      contentType: string
    }) => void
    const siblingDownload = new Promise<{
      buffer: Buffer
      contentType: string
    }>((resolve) => {
      finishSiblingDownload = resolve
    })
    mocks.downloadKlickerMediaFile.mockImplementation(async (href) => {
      if (href.endsWith('001')) throw new Error('storage unavailable')
      return await siblingDownload
    })

    const operation = backfillMediaHashBatch({}, prisma)
    let settled = false
    const settlement = operation.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await vi.waitFor(() => {
      expect(mocks.downloadKlickerMediaFile).toHaveBeenCalledTimes(2)
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    finishSiblingDownload({
      buffer: Buffer.from('sibling bytes'),
      contentType: 'image/png',
    })
    await settlement

    await expect(operation).rejects.toThrow('storage unavailable')
    expect(mediaFiles[1]?.importFingerprintVersion).toBe(
      IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    )
  })

  it.each(['ELEMENT', 'ANSWER_COLLECTION'] as const)(
    'rollout-rescans every active %s after media classification',
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
        return {
          status: 'updated',
          computed: {
            version: IMPORT_EXPORT_FINGERPRINT_VERSION,
            fingerprint: `fingerprint-${id}`,
          },
        }
      })

      const firstPage = await backfillFingerprintBatch({ resource }, prisma)
      const continuation = await backfillFingerprintBatch(
        { resource, afterId: firstPage.nextAfterId },
        prisma
      )
      const secondRun = await backfillFingerprintBatch({ resource }, prisma)

      expect(firstPage).toEqual({ processed: 100, nextAfterId: 100 })
      expect(continuation).toEqual({ processed: 1, nextAfterId: undefined })
      expect(secondRun).toEqual({ processed: 100, nextAfterId: 100 })
      expect(refresh).toHaveBeenCalledTimes(201)
      expect(findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.not.objectContaining({ OR: expect.anything() }),
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
        return {
          status: 'updated',
          computed: {
            version: IMPORT_EXPORT_FINGERPRINT_VERSION,
            fingerprint: `collection-fingerprint-${id}`,
          },
        }
      }
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
      events.push(`element:${id}`)
      markFingerprintCurrent(elements, id)
      return {
        status: 'updated',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: `element-fingerprint-${id}`,
        },
      }
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
