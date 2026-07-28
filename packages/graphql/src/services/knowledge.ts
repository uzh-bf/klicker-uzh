import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  DeleteKBResourceInput,
  IngestKBResourceInput,
} from '@klicker-uzh/types'
import { normalizePublicHttpUrl } from '@klicker-uzh/util/public-url'
import { randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import { validate as validateUuid } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'

const MAX_KB_FILE_SIZE_BYTES = 25 * 1024 * 1024
const KB_DELETE_QUEUE_CONCURRENCY = 8
const KB_MCP_SERVER_NAME = 'KB'
const KB_MCP_CHAT_MODES = ['tutor', 'explainer'] as const
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
  const kb = await ctx.prisma.kB.findFirst({
    where: { id, deletedAt: null },
  })
  if (!kb || kb.ownerId !== ctx.user.sub) {
    throw new GraphQLError('KB not found')
  }
  return kb
}

async function getOwnedKbResourceOrThrow(ctx: ContextWithUser, id: string) {
  const resource = await ctx.prisma.kBResource.findFirst({
    where: {
      id,
      deletedAt: null,
      kb: { ownerId: ctx.user.sub, deletedAt: null },
    },
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
      AND "deletedAt" IS NULL
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
      AND resource."deletedAt" IS NULL
      AND kb."deletedAt" IS NULL
    FOR UPDATE OF resource
  `
  if (lockedResource.length === 0) {
    throw new GraphQLError('KB resource not found')
  }
}

async function lockOwnedKbForResourceOrThrow(
  prisma: DB.Prisma.TransactionClient,
  resourceId: string,
  ownerId: string
) {
  const lockedKb = await prisma.$queryRaw<Array<{ kbId: string }>>`
    SELECT kb."id" AS "kbId"
    FROM "public"."KB" AS kb
    INNER JOIN "public"."KBResource" AS resource ON resource."kbId" = kb."id"
    WHERE resource."id" = CAST(${resourceId} AS UUID)
      AND kb."ownerId" = CAST(${ownerId} AS UUID)
      AND kb."deletedAt" IS NULL
      AND resource."deletedAt" IS NULL
    FOR UPDATE OF kb
  `
  if (lockedKb.length === 0) {
    throw new GraphQLError('KB resource not found')
  }
  return lockedKb[0]!.kbId
}

async function lockOwnedChatbotOrThrow(
  prisma: DB.Prisma.TransactionClient,
  id: string,
  ownerId: string
) {
  const lockedChatbot = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."Chatbot"
    WHERE "id" = CAST(${id} AS UUID)
      AND "ownerId" = CAST(${ownerId} AS UUID)
    FOR UPDATE
  `
  if (lockedChatbot.length === 0) {
    throw new GraphQLError('Chatbot not found')
  }
}

async function getKbMcpServerOrThrow(prisma: DB.Prisma.TransactionClient) {
  const mcpServer = await prisma.chatbotMCPServer.findUnique({
    where: { name: KB_MCP_SERVER_NAME },
    select: { id: true, authType: true, isActive: true },
  })
  if (
    !mcpServer ||
    !mcpServer.isActive ||
    mcpServer.authType !== 'scope_token'
  ) {
    throw new GraphQLError('Knowledge base retrieval is not configured')
  }
  return mcpServer
}

export async function getUserKbs(ctx: ContextWithUser) {
  return ctx.prisma.kB.findMany({
    where: { ownerId: ctx.user.sub, deletedAt: null },
    include: {
      resources: {
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getKb({ id }: { id: string }, ctx: ContextWithUser) {
  const kb = await ctx.prisma.kB.findFirst({
    where: { id, ownerId: ctx.user.sub, deletedAt: null },
    include: {
      resources: {
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          ingestionRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })
  if (!kb) {
    throw new GraphQLError('KB not found')
  }
  return kb
}

export async function getKbChatbotBindings(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
) {
  await getOwnedKbOrThrow(ctx, kbId)

  const chatbots = await ctx.prisma.chatbot.findMany({
    where: { ownerId: ctx.user.sub },
    select: {
      id: true,
      name: true,
      knowledgeBases: {
        where: { isEnabled: true },
        select: {
          kb: { select: { id: true, name: true } },
        },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })

  return chatbots.map((chatbot) => ({
    chatbotId: chatbot.id,
    chatbotName: chatbot.name,
    enabledKbId: chatbot.knowledgeBases[0]?.kb.id ?? null,
    enabledKbName: chatbot.knowledgeBases[0]?.kb.name ?? null,
  }))
}

export async function attachKbToChatbot(
  { kbId, chatbotId }: { kbId: string; chatbotId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await lockOwnedChatbotOrThrow(prisma, chatbotId, ctx.user.sub)
    const mcpServer = await getKbMcpServerOrThrow(prisma)

    await prisma.kBChatbot.updateMany({
      where: {
        chatbotId,
        kbId: { not: kbId },
        isEnabled: true,
      },
      data: { isEnabled: false },
    })
    await prisma.kBChatbot.upsert({
      where: { kbId_chatbotId: { kbId, chatbotId } },
      create: { kbId, chatbotId, isEnabled: true },
      update: { isEnabled: true },
    })

    for (const chatMode of KB_MCP_CHAT_MODES) {
      await prisma.chatbotMCPConfig.upsert({
        where: {
          chatbotId_mcpServerId_chatMode: {
            chatbotId,
            mcpServerId: mcpServer.id,
            chatMode,
          },
        },
        create: {
          chatbotId,
          mcpServerId: mcpServer.id,
          chatMode,
          allowedTools: ['doc_query'],
          priority: 0,
          isEnabled: true,
        },
        update: {
          allowedTools: ['doc_query'],
          priority: 0,
          isEnabled: true,
        },
      })
    }

    const [chatbot, kb] = await Promise.all([
      prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbotId },
        select: { name: true },
      }),
      prisma.kB.findUniqueOrThrow({
        where: { id: kbId },
        select: { name: true },
      }),
    ])
    return {
      chatbotId,
      chatbotName: chatbot.name,
      enabledKbId: kbId,
      enabledKbName: kb.name,
    }
  })
}

export async function detachKbFromChatbot(
  { kbId, chatbotId }: { kbId: string; chatbotId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await lockOwnedChatbotOrThrow(prisma, chatbotId, ctx.user.sub)

    await prisma.kBChatbot.deleteMany({ where: { kbId, chatbotId } })
    const enabledBinding = await prisma.kBChatbot.findFirst({
      where: { chatbotId, isEnabled: true },
      select: { id: true },
    })
    if (!enabledBinding) {
      const mcpServer = await prisma.chatbotMCPServer.findUnique({
        where: { name: KB_MCP_SERVER_NAME },
        select: { id: true },
      })
      if (mcpServer) {
        await prisma.chatbotMCPConfig.updateMany({
          where: { chatbotId, mcpServerId: mcpServer.id },
          data: { isEnabled: false },
        })
      }
    }

    return true
  })
}

export async function getKbResourceIngestionRuns(
  { resourceId }: { resourceId: string },
  ctx: ContextWithUser
) {
  await getOwnedKbResourceOrThrow(ctx, resourceId)

  return ctx.prisma.kBIngestionRun.findMany({
    where: {
      resourceId,
      resource: {
        deletedAt: null,
        kb: { ownerId: ctx.user.sub, deletedAt: null },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
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

async function recordDeletionQueueFailure(
  input: DeleteKBResourceInput,
  ctx: ContextWithUser
) {
  await ctx.prisma.$transaction(async (prisma) => {
    const resourceUpdate = await prisma.kBResource.updateMany({
      where: {
        id: input.resourceId,
        deletedAt: { not: null },
        ingestionOperation: DB.KBIngestionOperation.DELETE,
        ingestionAttemptId: input.deletionAttemptId,
        resourceVersion: input.resourceVersion,
        externalOperationId: null,
      },
      data: {
        status: DB.KBResourceStatus.QUEUED,
        statusMessage: 'The deletion operation is awaiting retry.',
        errorCode: 'DELETION_QUEUE_FAILED',
      },
    })
    if (resourceUpdate.count !== 1) return

    await prisma.kBIngestionRun.updateMany({
      where: {
        id: input.deletionAttemptId,
        resourceId: input.resourceId,
        operation: DB.KBIngestionOperation.DELETE,
        resourceVersion: input.resourceVersion,
        status: {
          in: [DB.KBIngestionStatus.QUEUED, DB.KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        status: DB.KBIngestionStatus.QUEUED,
        statusMessage: 'The deletion operation is awaiting retry.',
        errorCode: 'DELETION_QUEUE_FAILED',
      },
    })
  })
}

async function queueKbDeletions(
  inputs: DeleteKBResourceInput[],
  ctx: ContextWithUser
) {
  for (
    let start = 0;
    start < inputs.length;
    start += KB_DELETE_QUEUE_CONCURRENCY
  ) {
    const batch = inputs.slice(start, start + KB_DELETE_QUEUE_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((input) => ctx.tasks.deleteKBResource.runNoWait(input))
    )
    await Promise.all(
      results.map((result, index) =>
        result.status === 'rejected'
          ? recordDeletionQueueFailure(batch[index]!, ctx)
          : Promise.resolve()
      )
    )
  }
}

export async function deleteKb({ id }: { id: string }, ctx: ContextWithUser) {
  const { kb, deletionInputs } = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockOwnedKbOrThrow(prisma, id, ctx.user.sub)
      await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "public"."KBResource"
      WHERE "kbId" = CAST(${id} AS UUID)
        AND "deletedAt" IS NULL
      FOR UPDATE
    `
      await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "public"."KBUploadTicket"
      WHERE "kbId" = CAST(${id} AS UUID)
      FOR UPDATE
    `
      const resources = await prisma.kBResource.findMany({
        where: { kbId: id, deletedAt: null },
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
      if (
        resources.some(
          ({ resourceVersion }) => resourceVersion >= 2_147_483_647
        )
      ) {
        throw new GraphQLError('KB resource version limit reached')
      }

      const deletedAt = new Date()
      const deletionInputs = resources.map((resource) => ({
        resourceId: resource.id,
        kbId: id,
        deletionAttemptId: randomUUID(),
        resourceVersion: resource.resourceVersion + 1,
      }))

      await prisma.kB.update({
        where: { id },
        data: { deletedAt, deletedById: ctx.user.sub },
      })
      const bindings = await prisma.kBChatbot.findMany({
        where: { kbId: id, isEnabled: true },
        select: { chatbotId: true },
      })
      if (bindings.length > 0) {
        await prisma.kBChatbot.updateMany({
          where: { kbId: id, isEnabled: true },
          data: { isEnabled: false },
        })
        const mcpServer = await prisma.chatbotMCPServer.findUnique({
          where: { name: KB_MCP_SERVER_NAME },
          select: { id: true },
        })
        if (mcpServer) {
          await prisma.chatbotMCPConfig.updateMany({
            where: {
              mcpServerId: mcpServer.id,
              chatbotId: { in: bindings.map(({ chatbotId }) => chatbotId) },
            },
            data: { isEnabled: false },
          })
        }
      }

      for (const input of deletionInputs) {
        await prisma.kBResource.update({
          where: { id: input.resourceId },
          data: {
            deletedAt,
            deletedById: ctx.user.sub,
            status: DB.KBResourceStatus.QUEUED,
            statusMessage: null,
            ingestionOperation: DB.KBIngestionOperation.DELETE,
            ingestionAttemptId: input.deletionAttemptId,
            resourceVersion: input.resourceVersion,
            contentSha256: null,
            externalOperationId: null,
            externalOperationStartedAt: null,
            errorCode: null,
          },
        })
        await prisma.kBIngestionRun.create({
          data: {
            id: input.deletionAttemptId,
            resourceId: input.resourceId,
            operation: DB.KBIngestionOperation.DELETE,
            resourceVersion: input.resourceVersion,
          },
        })
      }

      const kb = await prisma.kB.findUniqueOrThrow({
        where: { id },
        include: { resources: true },
      })
      return { kb, deletionInputs }
    }
  )
  await queueKbDeletions(deletionInputs, ctx)
  return kb
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

  const blobId = randomUUID()
  const blobName = `${blobId}.${validated.extension}`
  const expiresOn = new Date(Date.now() + 15 * 60 * 1000)
  await ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await prisma.kBUploadTicket.create({
      data: {
        id: blobId,
        kbId,
        blobName,
        expiresAt: expiresOn,
      },
    })
  })
  const permissions = BlobSASPermissions.parse('cw')
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: containerClient.containerName,
      blobName,
      permissions,
      expiresOn,
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

  const existingResource = await ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    return prisma.kBResource.findFirst({
      where: {
        id: blobId,
        deletedAt: null,
        kb: { ownerId: ctx.user.sub, deletedAt: null },
      },
    })
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

  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    const racedResource = await prisma.kBResource.findFirst({
      where: { id: blobId, deletedAt: null },
    })
    if (racedResource) {
      if (
        racedResource.kbId === kbId &&
        racedResource.type === DB.KBResourceType.BLOB &&
        racedResource.blobName === blobName
      ) {
        return racedResource
      }
      throw new GraphQLError('KB blob name is invalid')
    }

    const ticket = await prisma.kBUploadTicket.findFirst({
      where: {
        id: blobId,
        kbId,
        blobName,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })
    if (!ticket) {
      throw new GraphQLError('KB upload ticket is invalid')
    }

    const resource = await prisma.kBResource.create({
      data: {
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
    })
    await prisma.kBUploadTicket.delete({ where: { id: ticket.id } })
    return resource
  })
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

  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    return prisma.kBResource.create({
      data: {
        kbId,
        type: DB.KBResourceType.URL,
        title: validateKbResourceTitle(title),
        sourceUrl,
        status: DB.KBResourceStatus.ADDED,
      },
    })
  })
}

export async function deleteKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const { resource, deletionInput } = await ctx.prisma.$transaction(
    async (prisma) => {
      const kbId = await lockOwnedKbForResourceOrThrow(prisma, id, ctx.user.sub)
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
      if (resource.resourceVersion >= 2_147_483_647) {
        throw new GraphQLError('KB resource version limit reached')
      }

      const deletionInput = {
        resourceId: resource.id,
        kbId,
        deletionAttemptId: randomUUID(),
        resourceVersion: resource.resourceVersion + 1,
      } satisfies DeleteKBResourceInput
      const deletedResource = await prisma.kBResource.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: ctx.user.sub,
          status: DB.KBResourceStatus.QUEUED,
          statusMessage: null,
          ingestionOperation: DB.KBIngestionOperation.DELETE,
          ingestionAttemptId: deletionInput.deletionAttemptId,
          resourceVersion: deletionInput.resourceVersion,
          contentSha256: null,
          externalOperationId: null,
          externalOperationStartedAt: null,
          errorCode: null,
        },
      })
      await prisma.kBIngestionRun.create({
        data: {
          id: deletionInput.deletionAttemptId,
          resourceId: resource.id,
          operation: DB.KBIngestionOperation.DELETE,
          resourceVersion: deletionInput.resourceVersion,
        },
      })
      return { resource: deletedResource, deletionInput }
    }
  )
  await queueKbDeletions([deletionInput], ctx)
  return resource
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

  await ctx.prisma.$transaction(async (prisma) => {
    const claim = await prisma.kBResource.updateMany({
      where: {
        id: resource.id,
        status: resource.status,
        ingestionAttemptId: resource.ingestionAttemptId,
        deletedAt: null,
        kb: { ownerId: ctx.user.sub, deletedAt: null },
      },
      data: {
        status: DB.KBResourceStatus.QUEUED,
        statusMessage: null,
        ingestionOperation: DB.KBIngestionOperation.UPSERT,
        ingestionAttemptId,
        resourceVersion,
        contentSha256: null,
        externalOperationId: null,
        externalOperationStartedAt: null,
        errorCode: null,
      },
    })
    if (claim.count !== 1) {
      throw new GraphQLError('KB resource cannot be ingested')
    }
    await prisma.kBIngestionRun.create({
      data: {
        id: ingestionAttemptId,
        resourceId: resource.id,
        operation: DB.KBIngestionOperation.UPSERT,
        resourceVersion,
      },
    })
  })

  try {
    await ctx.tasks.ingestKBResource.runNoWait(payload)
  } catch {
    const finishedAt = new Date()
    await ctx.prisma.$transaction(async (prisma) => {
      const failed = await prisma.kBResource.updateMany({
        where: {
          id: resource.id,
          status: DB.KBResourceStatus.QUEUED,
          ingestionAttemptId,
        },
        data: {
          status: DB.KBResourceStatus.FAILED,
          statusMessage: 'The ingestion operation could not be queued.',
          errorCode: 'QUEUE_DISPATCH_FAILED',
        },
      })
      if (failed.count === 1) {
        await prisma.kBIngestionRun.update({
          where: { id: ingestionAttemptId },
          data: {
            status: DB.KBIngestionStatus.FAILED,
            statusMessage: 'The ingestion operation could not be queued.',
            errorCode: 'QUEUE_DISPATCH_FAILED',
            finishedAt,
          },
        })
      }
    })
    throw new GraphQLError('KB ingestion could not be queued')
  }

  return ctx.prisma.kBResource.findUniqueOrThrow({
    where: { id: resource.id },
  })
}
