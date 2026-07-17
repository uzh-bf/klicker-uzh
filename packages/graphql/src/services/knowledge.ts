import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import { validate as validateUuid } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'

const MAX_KB_FILE_SIZE_BYTES = 25 * 1024 * 1024
const KB_FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain', 'text/x-markdown'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
}

function getKbContainerName(userId: string) {
  return `kb-${userId}`
}

function getKbBlobContainer(userId: string) {
  const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY
  if (!accountName || !accessKey) {
    throw new GraphQLError('Blob storage is not configured')
  }

  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const accountUrl = `https://${accountName}.blob.core.windows.net`
  const serviceClient = new BlobServiceClient(accountUrl, credential)

  return {
    containerClient: serviceClient.getContainerClient(
      getKbContainerName(userId)
    ),
    accountUrl,
    credential,
  }
}

function validateKbFile({
  fileName,
  contentType,
  sizeBytes,
}: {
  fileName: string
  contentType: string
  sizeBytes: number
}) {
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_KB_FILE_SIZE_BYTES
  ) {
    throw new GraphQLError('KB file size is invalid')
  }

  const extension = fileName.trim().split('.').pop()?.toLowerCase()
  const normalizedContentType = contentType.trim().toLowerCase()
  if (
    !extension ||
    !KB_FILE_TYPES[extension]?.includes(normalizedContentType)
  ) {
    throw new GraphQLError('KB file type is not supported')
  }

  return { extension, contentType: normalizedContentType }
}

function validateKbResourceTitle(title: string) {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) {
    throw new GraphQLError('KB resource title is required')
  }
  return normalizedTitle
}

async function getOwnedKbOrThrow(ctx: ContextWithUser, id: string) {
  const kb = await ctx.prisma.kB.findUnique({ where: { id } })
  if (!kb || kb.ownerId !== ctx.user.sub) {
    throw new GraphQLError('KB not found')
  }
  return kb
}

async function getOwnedKbResourceOrThrow(ctx: ContextWithUser, id: string) {
  const resource = await ctx.prisma.kBResource.findFirst({
    where: { id, kb: { ownerId: ctx.user.sub } },
  })
  if (!resource) {
    throw new GraphQLError('KB resource not found')
  }
  return resource
}

export async function getUserKbs(ctx: ContextWithUser) {
  return ctx.prisma.kB.findMany({
    where: { ownerId: ctx.user.sub },
    include: {
      resources: { orderBy: { updatedAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getKb({ id }: { id: string }, ctx: ContextWithUser) {
  await getOwnedKbOrThrow(ctx, id)

  return ctx.prisma.kB.findUniqueOrThrow({
    where: { id },
    include: {
      resources: { orderBy: { updatedAt: 'desc' } },
    },
  })
}

export async function createKb(
  {
    name,
    description,
  }: {
    name: string
    description?: string | null
  },
  ctx: ContextWithUser
) {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new GraphQLError('KB name is required')
  }

  return ctx.prisma.kB.create({
    data: {
      name: normalizedName,
      description,
      ownerId: ctx.user.sub,
    },
    include: { resources: true },
  })
}

export async function deleteKb({ id }: { id: string }, ctx: ContextWithUser) {
  await getOwnedKbOrThrow(ctx, id)

  const blobResources = await ctx.prisma.kBResource.findMany({
    where: { kbId: id, type: DB.KBResourceType.BLOB },
    select: { blobName: true },
  })

  if (blobResources.length > 0) {
    const { containerClient } = getKbBlobContainer(ctx.user.sub)
    await Promise.all(
      blobResources.map(({ blobName }) => {
        if (!blobName) {
          throw new GraphQLError('KB blob metadata is invalid')
        }
        return containerClient.getBlobClient(blobName).deleteIfExists()
      })
    )
  }

  return ctx.prisma.kB.delete({
    where: { id },
    include: { resources: true },
  })
}

export async function requestKbFileUpload(
  {
    kbId,
    fileName,
    contentType,
    sizeBytes,
  }: {
    kbId: string
    fileName: string
    contentType: string
    sizeBytes: number
  },
  ctx: ContextWithUser
) {
  await getOwnedKbOrThrow(ctx, kbId)
  const validated = validateKbFile({ fileName, contentType, sizeBytes })
  const { accountUrl, containerClient, credential } = getKbBlobContainer(
    ctx.user.sub
  )
  await containerClient.createIfNotExists()

  const blobName = `${randomUUID()}.${validated.extension}`
  const permissions = BlobSASPermissions.parse('cw')
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: containerClient.containerName,
      blobName,
      permissions,
      expiresOn: new Date(Date.now() + 15 * 60 * 1000),
    },
    credential
  )

  return {
    uploadSasURL: `${accountUrl}?${queryParams.toString()}`,
    containerName: containerClient.containerName,
    blobName,
  }
}

export async function confirmKbFileUpload(
  {
    kbId,
    blobName,
    title,
    originalFilename,
    mimeType,
    sizeBytes,
  }: {
    kbId: string
    blobName: string
    title: string
    originalFilename: string
    mimeType: string
    sizeBytes: number
  },
  ctx: ContextWithUser
) {
  await getOwnedKbOrThrow(ctx, kbId)
  const validated = validateKbFile({
    fileName: originalFilename,
    contentType: mimeType,
    sizeBytes,
  })
  const separator = blobName.lastIndexOf('.')
  const blobId = blobName.slice(0, separator)
  const blobExtension = blobName.slice(separator + 1).toLowerCase()
  if (
    separator <= 0 ||
    !validateUuid(blobId) ||
    blobExtension !== validated.extension
  ) {
    throw new GraphQLError('KB blob name is invalid')
  }
  const normalizedTitle = validateKbResourceTitle(title)

  const existingResource = await ctx.prisma.kBResource.findFirst({
    where: { id: blobId, kbId },
  })
  if (existingResource) {
    if (
      existingResource.kbId === kbId &&
      existingResource.type === DB.KBResourceType.BLOB &&
      existingResource.blobName === blobName
    ) {
      return existingResource
    }
    throw new GraphQLError('KB blob name is invalid')
  }

  const { containerClient } = getKbBlobContainer(ctx.user.sub)
  const blobClient = containerClient.getBlobClient(blobName)
  if (!(await blobClient.exists())) {
    throw new GraphQLError('KB blob was not found')
  }

  const properties = await blobClient.getProperties()
  if (
    properties.contentLength !== sizeBytes ||
    properties.contentType?.trim().toLowerCase() !== validated.contentType
  ) {
    await blobClient.deleteIfExists()
    throw new GraphQLError('KB blob metadata is invalid')
  }

  let resource: DB.KBResource
  try {
    resource = await ctx.prisma.kBResource.upsert({
      where: { id: blobId },
      create: {
        id: blobId,
        kbId,
        type: DB.KBResourceType.BLOB,
        title: normalizedTitle,
        originalFilename,
        mimeType: validated.contentType,
        sizeBytes,
        blobName,
        blobHref: blobClient.url,
        status: DB.KBResourceStatus.ADDED,
      },
      update: {},
    })
  } catch (error) {
    if (
      !(error instanceof DB.Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }

    const racedResource = await ctx.prisma.kBResource.findUnique({
      where: { id: blobId },
    })
    if (!racedResource) throw error
    resource = racedResource
  }

  if (resource.kbId !== kbId || resource.blobName !== blobName) {
    throw new GraphQLError('KB blob name is invalid')
  }

  return resource
}

export async function createKbUrlResource(
  {
    kbId,
    url,
    title,
  }: {
    kbId: string
    url: string
    title: string
  },
  ctx: ContextWithUser
) {
  await getOwnedKbOrThrow(ctx, kbId)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim())
  } catch {
    throw new GraphQLError('KB resource URL is invalid')
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new GraphQLError('KB resource URL is invalid')
  }

  return ctx.prisma.kBResource.create({
    data: {
      kbId,
      type: DB.KBResourceType.URL,
      title: validateKbResourceTitle(title),
      sourceUrl: parsedUrl.toString(),
      status: DB.KBResourceStatus.ADDED,
    },
  })
}

export async function deleteKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const resource = await getOwnedKbResourceOrThrow(ctx, id)

  if (resource.type === DB.KBResourceType.BLOB) {
    if (!resource.blobName) {
      throw new GraphQLError('KB blob metadata is invalid')
    }
    const { containerClient } = getKbBlobContainer(ctx.user.sub)
    await containerClient.getBlobClient(resource.blobName).deleteIfExists()
  }

  return ctx.prisma.kBResource.delete({ where: { id } })
}
