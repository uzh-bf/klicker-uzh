import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const azureMocks = vi.hoisted(() => ({
  blobServiceClient: vi.fn(),
  createContainer: vi.fn(),
  exists: vi.fn(),
  generateSas: vi.fn(),
  getContainerClient: vi.fn(),
  parsePermissions: vi.fn(),
  sharedKeyCredential: vi.fn(),
}))

vi.mock('@azure/storage-blob', () => ({
  BlobSASPermissions: {
    parse: vi.fn((permissions: string) => {
      azureMocks.parsePermissions(permissions)
      return { permissions }
    }),
  },
  BlobServiceClient: vi.fn().mockImplementation((url, credential) => {
    azureMocks.blobServiceClient(url, credential)
    return {
      createContainer: azureMocks.createContainer,
      getContainerClient: azureMocks.getContainerClient,
    }
  }),
  generateBlobSASQueryParameters: vi.fn((values, credential) => {
    azureMocks.generateSas(values, credential)
    return 'sv=mock'
  }),
  StorageSharedKeyCredential: vi.fn().mockImplementation((account, key) => {
    azureMocks.sharedKeyCredential(account, key)
    return { account, key }
  }),
}))

const { appRouter } = await import('../root.js')

const user = {
  id: 'owner-1',
}

function createContext(prisma?: TRPCContext['prisma']): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('element media file router', () => {
  const originalStorageAccountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const originalStorageAccessKey = process.env.BLOB_STORAGE_ACCESS_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'storageaccount'
    process.env.BLOB_STORAGE_ACCESS_KEY = Buffer.alloc(64).toString('base64')
  })

  afterEach(() => {
    if (originalStorageAccountName === undefined) {
      delete process.env.BLOB_STORAGE_ACCOUNT_NAME
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_NAME = originalStorageAccountName
    }

    if (originalStorageAccessKey === undefined) {
      delete process.env.BLOB_STORAGE_ACCESS_KEY
    } else {
      process.env.BLOB_STORAGE_ACCESS_KEY = originalStorageAccessKey
    }
  })

  test('returns user media files ordered by creation date', async () => {
    const mediaFile = {
      id: 'media-1',
      name: 'diagram.png',
      type: 'image/png',
      href: 'https://storageaccount.blob.core.windows.net/owner-1/media-1.png',
      description: null,
      originalId: null,
      ownerId: user.id,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    }
    const findUnique = vi.fn().mockResolvedValue({ mediaFiles: [mediaFile] })
    const prisma = {
      user: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.mediaFiles()).resolves.toEqual({
      mediaFiles: [mediaFile],
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      include: { mediaFiles: { orderBy: { createdAt: 'desc' } } },
    })
  })

  test('returns an empty list when the user no longer exists', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      user: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.mediaFiles()).resolves.toEqual({
      mediaFiles: [],
    })
  })

  test('creates a writable blob SAS and media file row', async () => {
    const mediaFileCreate = vi.fn().mockResolvedValue({})
    azureMocks.exists.mockResolvedValue(false)
    azureMocks.getContainerClient.mockReturnValue({
      exists: azureMocks.exists,
    })
    const prisma = {
      mediaFile: { create: mediaFileCreate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    const result = await caller.element.fileUploadSas({
      fileName: 'chart.png',
      contentType: 'image/png',
    })

    const sas = result.fileUploadSas
    expect(sas.uploadSasURL).toBe(
      'https://storageaccount.blob.core.windows.net?sv=mock'
    )
    expect(sas.containerName).toBe(user.id)
    expect(sas.fileName).toMatch(/^[0-9a-f-]+\.png$/)
    expect(sas.uploadHref).toBe(
      `https://storageaccount.blob.core.windows.net/${user.id}/${sas.fileName}`
    )

    const mediaFileId = sas.fileName.replace(/\.png$/, '')
    expect(mediaFileCreate).toHaveBeenCalledWith({
      data: {
        id: mediaFileId,
        ownerId: user.id,
        type: 'image/png',
        name: 'chart.png',
        href: sas.uploadHref,
      },
    })
    expect(azureMocks.sharedKeyCredential).toHaveBeenCalledWith(
      'storageaccount',
      process.env.BLOB_STORAGE_ACCESS_KEY
    )
    expect(azureMocks.blobServiceClient).toHaveBeenCalledWith(
      'https://storageaccount.blob.core.windows.net',
      { account: 'storageaccount', key: process.env.BLOB_STORAGE_ACCESS_KEY }
    )
    expect(azureMocks.getContainerClient).toHaveBeenCalledWith(user.id)
    expect(azureMocks.createContainer).toHaveBeenCalledWith(user.id, {
      access: 'blob',
    })
    expect(azureMocks.parsePermissions).toHaveBeenCalledWith('w')
    expect(azureMocks.generateSas).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: user.id,
        permissions: { permissions: 'w' },
        blobName: sas.fileName,
        contentType: 'image/png',
      }),
      { account: 'storageaccount', key: process.env.BLOB_STORAGE_ACCESS_KEY }
    )
  })

  test('reuses an existing blob container', async () => {
    azureMocks.exists.mockResolvedValue(true)
    azureMocks.getContainerClient.mockReturnValue({
      exists: azureMocks.exists,
    })
    const prisma = {
      mediaFile: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await caller.element.fileUploadSas({
      fileName: 'chart.jpg',
      contentType: 'image/jpeg',
    })

    expect(azureMocks.createContainer).not.toHaveBeenCalled()
  })
})
