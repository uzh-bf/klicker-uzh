import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma/client'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { normalizePublicHttpUrl } from '@klicker-uzh/util/public-url'
import { randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import { validate as validateUuid } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'

const MAX_KB_FILE_SIZE_BYTES = 25 * 1024 * 1024
// Bound external storage I/O while database row locks are held.
const KB_BLOB_DELETE_TIMEOUT_MS = 30_000
// Leave database cleanup time after the bounded storage operation completes or aborts.
const KB_DELETION_TRANSACTION_TIMEOUT_MS = 60_000
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

async function lockOwnedKbOrThrow(
  prisma: DB.Prisma.TransactionClient,
  id: string,
  ownerId: string
) {
  const lockedKb = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."KB"
    WHERE "id" = CAST(${id} AS UUID)
      AND "ownerId" = CAST(${ownerId} AS UUID)
    FOR UPDATE
  `
  if (lockedKb.length === 0) {
    throw new GraphQLError('KB not found')
  }
}

async function lockOwnedKbResourceOrThrow(
  prisma: DB.Prisma.TransactionClient,
  id: string,
  ownerId: string
) {
  const lockedResource = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT resource."id"
    FROM "public"."KBResource" AS resource
    INNER JOIN "public"."KB" AS kb ON kb."id" = resource."kbId"
    WHERE resource."id" = CAST(${id} AS UUID)
      AND kb."ownerId" = CAST(${ownerId} AS UUID)
    FOR UPDATE OF resource
  `
  if (lockedResource.length === 0) {
    throw new GraphQLError('KB resource not found')
  }
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
  return ctx.prisma.$transaction(
    async (prisma) => {
      await lockOwnedKbOrThrow(prisma, id, ctx.user.sub)
      await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "public"."KBResource"
      WHERE "kbId" = CAST(${id} AS UUID)
      FOR UPDATE
    `
      const resources = await prisma.kBResource.findMany({
        where: { kbId: id },
      })

      if (
        resources.some(
          ({ status }) =>
            status === DB.KBResourceStatus.QUEUED ||
            status === DB.KBResourceStatus.PROCESSING
        )
      ) {
        throw new GraphQLError('KB cannot be deleted')
      }

      const blobResources = resources.filter(
        ({ type }) => type === DB.KBResourceType.BLOB
      )
      if (blobResources.length > 0) {
        const { containerClient } = getKbBlobContainer(ctx.user.sub)
        await Promise.all(
          blobResources.map(({ blobName }) => {
            if (!blobName) {
              throw new GraphQLError('KB blob metadata is invalid')
            }
            return containerClient.getBlobClient(blobName).deleteIfExists({
              abortSignal: AbortSignal.timeout(KB_BLOB_DELETE_TIMEOUT_MS),
            })
          })
        )
      }

      return prisma.kB.delete({
        where: { id },
        include: { resources: true },
      })
    },
    { timeout: KB_DELETION_TRANSACTION_TIMEOUT_MS }
  )
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
    where: { id: blobId, kb: { ownerId: ctx.user.sub } },
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

  let sourceUrl: string
  try {
    sourceUrl = normalizePublicHttpUrl(url)
  } catch {
    throw new GraphQLError('KB resource URL is invalid')
  }

  return ctx.prisma.kBResource.create({
    data: {
      kbId,
      type: DB.KBResourceType.URL,
      title: validateKbResourceTitle(title),
      sourceUrl,
      status: DB.KBResourceStatus.ADDED,
    },
  })
}

export async function deleteKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.$transaction(
    async (prisma) => {
      await lockOwnedKbResourceOrThrow(prisma, id, ctx.user.sub)
      const resource = await prisma.kBResource.findUniqueOrThrow({
        where: { id },
      })

      if (
        resource.status === DB.KBResourceStatus.QUEUED ||
        resource.status === DB.KBResourceStatus.PROCESSING
      ) {
        throw new GraphQLError('KB resource cannot be deleted')
      }

      if (resource.type === DB.KBResourceType.BLOB) {
        if (!resource.blobName) {
          throw new GraphQLError('KB blob metadata is invalid')
        }
        const { containerClient } = getKbBlobContainer(ctx.user.sub)
        await containerClient.getBlobClient(resource.blobName).deleteIfExists({
          abortSignal: AbortSignal.timeout(KB_BLOB_DELETE_TIMEOUT_MS),
        })
      }

      return prisma.kBResource.delete({ where: { id } })
    },
    { timeout: KB_DELETION_TRANSACTION_TIMEOUT_MS }
  )
}

export async function ingestKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const resource = await getOwnedKbResourceOrThrow(ctx, id)
  if (
    resource.status !== DB.KBResourceStatus.ADDED &&
    resource.status !== DB.KBResourceStatus.READY &&
    resource.status !== DB.KBResourceStatus.FAILED
  ) {
    throw new GraphQLError('KB resource cannot be ingested')
  }
  if (resource.resourceVersion >= 2_147_483_647) {
    throw new GraphQLError('KB resource version limit reached')
  }

  const ingestionAttemptId = randomUUID()
  const resourceVersion = resource.resourceVersion + 1
  const basePayload = {
    resourceId: resource.id,
    kbId: resource.kbId,
    title: resource.title,
    ingestionAttemptId,
    resourceVersion,
  }
  let payload: IngestKBResourceInput
  if (resource.type === DB.KBResourceType.BLOB) {
    if (
      !resource.blobName ||
      !resource.mimeType ||
      resource.sizeBytes === null
    ) {
      throw new GraphQLError('KB blob metadata is invalid')
    }
    payload = {
      ...basePayload,
      type: DB.KBResourceType.BLOB,
      blobName: resource.blobName,
      containerName: getKbContainerName(ctx.user.sub),
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
    }
  } else {
    if (!resource.sourceUrl) {
      throw new GraphQLError('KB resource URL is invalid')
    }
    payload = {
      ...basePayload,
      type: DB.KBResourceType.URL,
      sourceUrl: resource.sourceUrl,
    }
  }

  const claim = await ctx.prisma.kBResource.updateMany({
    where: {
      id: resource.id,
      status: resource.status,
      ingestionAttemptId: resource.ingestionAttemptId,
      kb: { ownerId: ctx.user.sub },
    },
    data: {
      status: DB.KBResourceStatus.QUEUED,
      statusMessage: null,
      ingestedAt: null,
      ingestionAttemptId,
      resourceVersion,
      contentSha256: null,
      externalOperationId: null,
      externalOperationStartedAt: null,
    },
  })
  if (claim.count !== 1) {
    throw new GraphQLError('KB resource cannot be ingested')
  }

  try {
    await ctx.tasks.ingestKBResource.runNoWait(payload)
  } catch {
    await ctx.prisma.kBResource.updateMany({
      where: {
        id: resource.id,
        status: DB.KBResourceStatus.QUEUED,
        ingestionAttemptId,
      },
      data: {
        status: resource.status,
        statusMessage: resource.statusMessage,
        ingestedAt: resource.ingestedAt,
        ingestionAttemptId: resource.ingestionAttemptId,
        resourceVersion: resource.resourceVersion,
        contentSha256: resource.contentSha256,
        externalOperationId: resource.externalOperationId,
        externalOperationStartedAt: resource.externalOperationStartedAt,
      },
    })
    throw new GraphQLError('KB ingestion could not be queued')
  }

  return ctx.prisma.kBResource.findUniqueOrThrow({
    where: { id: resource.id },
  })
}
