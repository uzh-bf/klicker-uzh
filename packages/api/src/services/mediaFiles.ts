import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import { randomUUID } from 'node:crypto'

const FILE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
}

type MediaFileServiceContext = {
  prisma: PrismaClient
  userId: string
}

export async function getUserMediaFiles({
  prisma,
  userId,
}: MediaFileServiceContext) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { mediaFiles: { orderBy: { createdAt: 'desc' } } },
  })

  return user?.mediaFiles ?? []
}

export async function getFileUploadSas(
  {
    fileName,
    contentType,
  }: {
    fileName: string
    contentType: string
  },
  { prisma, userId }: MediaFileServiceContext
) {
  const storageAccountName = process.env.BLOB_STORAGE_ACCOUNT_NAME as string
  const sharedKeyCredential = new StorageSharedKeyCredential(
    storageAccountName,
    process.env.BLOB_STORAGE_ACCESS_KEY as string
  )

  const storageAccount = `https://${storageAccountName}.blob.core.windows.net`
  const client = new BlobServiceClient(storageAccount, sharedKeyCredential)
  const containerClient = client.getContainerClient(userId)
  if (!(await containerClient.exists())) {
    await client.createContainer(userId, {
      access: 'blob',
    })
  }

  const id = randomUUID()
  const blobName = `${id}.${FILE_EXTENSIONS[contentType]}`
  const fileHref = `${storageAccount}/${userId}/${blobName}`
  const permissions = BlobSASPermissions.parse('w')
  const startDate = dayjs()
  const expiryDate = startDate.add(15, 'minutes')
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: userId,
      permissions,
      expiresOn: expiryDate.toDate(),
      blobName,
      contentType,
    },
    sharedKeyCredential
  )

  await prisma.mediaFile.create({
    data: {
      id,
      ownerId: userId,
      type: contentType,
      name: fileName,
      href: fileHref,
    },
  })

  return {
    uploadSasURL: `${storageAccount}?${queryParams}`,
    uploadHref: fileHref,
    containerName: userId,
    fileName: blobName,
  }
}
