const azure = vi.hoisted(() => ({
  exists: vi.fn(async () => true),
  generateBlobSASQueryParameters: vi.fn(() => 'create-only-sas'),
  parsePermissions: vi.fn(() => 'create-only'),
}))

const runtime = vi.hoisted(() => ({ enabled: false }))

vi.mock('@azure/storage-blob', () => ({
  BlobSASPermissions: { parse: azure.parsePermissions },
  BlobServiceClient: class {
    getContainerClient() {
      return { exists: azure.exists }
    }
  },
  generateBlobSASQueryParameters: azure.generateBlobSASQueryParameters,
  StorageSharedKeyCredential: class {},
}))

vi.mock('../src/lib/importExportRuntimeConfig.js', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('../src/lib/importExportRuntimeConfig.js')
    >()

  return {
    ...original,
    getImportExportRuntimeConfig: () => ({ enabled: runtime.enabled }),
  }
})

import { IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  getFileUploadSas,
  getUserMediaFiles,
} from '../src/services/elements.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'

describe('direct media upload finalization contract', () => {
  const previousAccount = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const previousAccessKey = process.env.BLOB_STORAGE_ACCESS_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    runtime.enabled = false
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = 'test-key'
  })

  afterAll(() => {
    if (typeof previousAccount === 'undefined') {
      delete process.env.BLOB_STORAGE_ACCOUNT_NAME
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_NAME = previousAccount
    }
    if (typeof previousAccessKey === 'undefined') {
      delete process.env.BLOB_STORAGE_ACCESS_KEY
    } else {
      process.env.BLOB_STORAGE_ACCESS_KEY = previousAccessKey
    }
  })

  it('mints create-only upload access so finalized bytes cannot be overwritten', async () => {
    const create = vi.fn(async () => ({}))

    const result = await getFileUploadSas(
      { fileName: 'diagram.png', contentType: 'image/png' },
      {
        user: { sub: OWNER_ID },
        prisma: { mediaFile: { create } },
      } as any
    )

    expect(azure.parsePermissions).toHaveBeenCalledOnce()
    expect(azure.parsePermissions).toHaveBeenCalledWith('c')
    expect(azure.generateBlobSASQueryParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: result.fileName,
        containerName: OWNER_ID,
        permissions: 'create-only',
      }),
      expect.anything()
    )
    expect(create).toHaveBeenCalledWith({
      data: {
        href: result.uploadHref,
        id: result.mediaFileId,
        name: 'diagram.png',
        ownerId: OWNER_ID,
        type: 'image/png',
      },
    })
  })

  it('preserves legacy media visibility while import/export is disabled', async () => {
    const mediaFiles = [{ id: 'pending-media' }, { id: 'classified-media' }]
    const findUnique = vi.fn(async () => ({ mediaFiles }))

    const result = await getUserMediaFiles({
      user: { sub: OWNER_ID },
      prisma: { user: { findUnique } },
    } as any)

    expect(result).toBe(mediaFiles)
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      include: {
        mediaFiles: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  })

  it('only exposes classified media while import/export is enabled', async () => {
    runtime.enabled = true
    const mediaFiles = [{ id: 'classified-media' }]
    const findUnique = vi.fn(async () => ({ mediaFiles }))

    const result = await getUserMediaFiles({
      user: { sub: OWNER_ID },
      prisma: { user: { findUnique } },
    } as any)

    expect(result).toBe(mediaFiles)
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      include: {
        mediaFiles: {
          where: {
            importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  })
})
