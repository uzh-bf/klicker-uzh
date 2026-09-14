import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  deleteImportedMediaFile: vi.fn(),
  resolveKlickerMediaHref: vi.fn(),
}))

vi.mock('../src/services/mediaStorageTargets.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/services/mediaStorageTargets.js')
  >()),
  deleteImportedMediaFile: storage.deleteImportedMediaFile,
  resolveKlickerMediaHref: storage.resolveKlickerMediaHref,
}))

import {
  createDirectUploadCleanupOriginalId,
  createPendingDirectUploadOriginalId,
} from '../src/lib/importExportMediaIdentity.js'
import {
  ABANDONED_DIRECT_UPLOAD_MIN_AGE_MS,
  cleanupAbandonedDirectMediaUploads,
} from '../src/services/mediaStorageCleanup.js'

const MEDIA_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_ID = '22222222-2222-4222-8222-222222222222'
const HREF = `https://storage.blob.core.windows.net/${OWNER_ID}/${MEDIA_ID}.png`

function createCandidate(
  originalId = createPendingDirectUploadOriginalId(MEDIA_ID)
) {
  return {
    id: MEDIA_ID,
    href: HREF,
    ownerId: OWNER_ID,
    originalId,
    createdAt: new Date('2026-07-22T08:00:00.000Z'),
  }
}

function createPrisma({
  candidate = createCandidate(),
  claimCount = 1,
  deleteCount = 1,
}: {
  candidate?: ReturnType<typeof createCandidate>
  claimCount?: number
  deleteCount?: number
} = {}) {
  const findMany = vi.fn(async () => [candidate])
  const updateMany = vi.fn(async () => ({ count: claimCount }))
  const deleteMany = vi.fn(async () => ({ count: deleteCount }))
  return {
    findMany,
    updateMany,
    deleteMany,
    prisma: {
      mediaFile: { findMany, updateMany, deleteMany },
    } as any,
  }
}

function resolveCanonicalTarget() {
  storage.resolveKlickerMediaHref.mockReturnValue({
    canonicalHref: HREF,
    ownerId: OWNER_ID,
    storage: 'azure',
    location: { containerName: OWNER_ID, blobName: `${MEDIA_ID}.png` },
    storageIdentity: `${OWNER_ID}\0${MEDIA_ID}.png`,
  })
}

describe('abandoned direct media upload cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('claims an expired exact marker before deleting its blob and row', async () => {
    const calls: string[] = []
    resolveCanonicalTarget()
    storage.deleteImportedMediaFile.mockImplementation(async () => {
      calls.push('delete-blob')
      return true
    })
    const { prisma, updateMany, deleteMany } = createPrisma()
    updateMany.mockImplementation(async () => {
      calls.push('claim')
      return { count: 1 }
    })
    deleteMany.mockImplementation(async () => {
      calls.push('delete-row')
      return { count: 1 }
    })

    await expect(
      cleanupAbandonedDirectMediaUploads({
        prisma,
        now: new Date('2026-07-22T10:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      deletedDirectUploadBlobs: 1,
      deletedDirectUploadRows: 1,
      wouldDeleteDirectUploads: 1,
      failedDirectUploadCleanups: 0,
    })

    expect(calls).toEqual(['claim', 'delete-blob', 'delete-row'])
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          originalId: createDirectUploadCleanupOriginalId(MEDIA_ID),
        },
      })
    )
  })

  it('does no storage work when a concurrent finalizer wins the marker CAS', async () => {
    resolveCanonicalTarget()
    const { prisma } = createPrisma({ claimCount: 0 })

    await expect(
      cleanupAbandonedDirectMediaUploads({
        prisma,
        now: new Date('2026-07-22T10:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      deletedDirectUploadRows: 0,
      failedDirectUploadCleanups: 0,
    })
    expect(storage.deleteImportedMediaFile).not.toHaveBeenCalled()
  })

  it('retains the claimed row for retry when blob deletion is indeterminate', async () => {
    resolveCanonicalTarget()
    storage.deleteImportedMediaFile.mockRejectedValue(new Error('timeout'))
    const { prisma, deleteMany } = createPrisma()

    await expect(
      cleanupAbandonedDirectMediaUploads({
        prisma,
        now: new Date('2026-07-22T10:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      deletedDirectUploadRows: 0,
      failedDirectUploadCleanups: 1,
    })
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('rejects non-exact markers and enforces the SAS-expiry safety margin', async () => {
    resolveCanonicalTarget()
    const now = new Date('2026-07-22T10:00:00.000Z')
    const { prisma, findMany } = createPrisma({
      candidate: createCandidate(
        createPendingDirectUploadOriginalId(
          '33333333-3333-4333-8333-333333333333'
        )
      ),
    })

    await expect(
      cleanupAbandonedDirectMediaUploads({ prisma, now })
    ).resolves.toMatchObject({
      unsafeDirectUploadTargets: 1,
      wouldDeleteDirectUploads: 0,
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            lte: new Date(now.getTime() - ABANDONED_DIRECT_UPLOAD_MIN_AGE_MS),
          },
        }),
      })
    )
    expect(storage.deleteImportedMediaFile).not.toHaveBeenCalled()
  })
})
