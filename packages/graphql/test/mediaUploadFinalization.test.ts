import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

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

import { IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  createPendingDirectUploadOriginalId,
  DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
  DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
} from '../src/lib/importExportMediaIdentity.js'
import {
  getFileUploadSas,
  getUserMediaFiles,
} from '../src/services/elements.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const visibleMediaLifecycleWhere = {
  OR: [
    { originalId: null },
    {
      AND: [
        {
          NOT: {
            originalId: {
              startsWith: DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
            },
          },
        },
        {
          NOT: {
            originalId: {
              startsWith: DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
            },
          },
        },
      ],
    },
  ],
}

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

  it('keeps both legacy upload operations in the production allowlist', async () => {
    const legacyOperations = JSON.parse(
      await readFile(
        new URL('../src/public/legacy-server.json', import.meta.url),
        'utf8'
      )
    ) as Record<string, string>
    const backend = await readFile(
      new URL('../../../apps/backend-docker/src/app.ts', import.meta.url),
      'utf8'
    )

    expect(Object.keys(legacyOperations).sort()).toEqual(
      [
        '33e50cebe8b82098885152bbbe80a013e9d7c3c87a8c553b4e9647b983686045',
        '85e1fc997cba702c1c7cdc6e62c9ef7a2f4d3c42b451c1858dca80994a0eb160',
        '945a65bc359c672d724041c13987a15d81a17a31e3dd93d70c19de73b7932998',
      ].sort()
    )
    for (const [expectedHash, operation] of Object.entries(legacyOperations)) {
      expect(createHash('sha256').update(operation).digest('hex')).toBe(
        expectedHash
      )
    }
    expect(backend).toContain('legacyPersistedOperations[sha256Hash]')
  })

  it('keeps deployment and rollback ordered across the asymmetric protocol', async () => {
    const runbook = await readFile(
      new URL(
        '../../../docs/import-export-production-runbook.md',
        import.meta.url
      ),
      'utf8'
    )
    const deployment = runbook.slice(
      runbook.indexOf('## Migration: approved dark deployment'),
      runbook.indexOf('## Post-deploy dark operations')
    )
    const rollback = runbook.slice(
      runbook.indexOf('## Rollback'),
      runbook.indexOf('## Staged decision gates')
    )

    expect(deployment).toContain(
      'Do not combine their image changes in one Helm upgrade'
    )
    expect(
      deployment.indexOf('--set backendGraphql.image.tag="$NEXT_BACKEND_TAG"')
    ).toBeGreaterThanOrEqual(0)
    expect(
      deployment.indexOf('--set frontendManage.image.tag="$NEXT_MANAGE_TAG"')
    ).toBeGreaterThan(
      deployment.indexOf('--set backendGraphql.image.tag="$NEXT_BACKEND_TAG"')
    )

    expect(rollback).toContain('Never change both images in one Helm upgrade')
    expect(
      rollback.indexOf('--set backendGraphql.image.tag="$CURRENT_BACKEND_TAG"')
    ).toBeGreaterThanOrEqual(0)
    expect(
      rollback.indexOf('--set backendGraphql.image.tag="$PREVIOUS_BACKEND_TAG"')
    ).toBeGreaterThan(
      rollback.indexOf('--set backendGraphql.image.tag="$CURRENT_BACKEND_TAG"')
    )
  })

  it('mints create-only upload access so finalized bytes cannot be overwritten', async () => {
    const create = vi.fn(async () => ({}))

    const result = await getFileUploadSas(
      {
        fileName: 'diagram.png',
        contentType: 'image/png',
        requiresFinalization: true,
      },
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
        originalId: createPendingDirectUploadOriginalId(result.mediaFileId),
        ownerId: OWNER_ID,
        type: 'image/png',
      },
    })
  })

  it('keeps the legacy upload protocol compatible while the feature is dark', async () => {
    const create = vi.fn(async () => ({}))

    const result = await getFileUploadSas(
      { fileName: 'legacy.png', contentType: 'image/png' },
      {
        user: { sub: OWNER_ID },
        prisma: { mediaFile: { create } },
      } as any
    )

    expect(create).toHaveBeenCalledWith({
      data: {
        href: result.uploadHref,
        id: result.mediaFileId,
        name: 'legacy.png',
        ownerId: OWNER_ID,
        type: 'image/png',
      },
    })
  })

  it('rejects a legacy upload client before side effects once enabled', async () => {
    runtime.enabled = true
    const create = vi.fn(async () => ({}))

    await expect(
      getFileUploadSas({ fileName: 'legacy.png', contentType: 'image/png' }, {
        user: { sub: OWNER_ID },
        prisma: { mediaFile: { create } },
      } as any)
    ).rejects.toThrow('must be refreshed')
    expect(create).not.toHaveBeenCalled()
    expect(azure.generateBlobSASQueryParameters).not.toHaveBeenCalled()
  })

  it('preserves legacy media visibility but hides pending uploads while import/export is disabled', async () => {
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
          where: visibleMediaLifecycleWhere,
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
            ...visibleMediaLifecycleWhere,
            importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  })
})
