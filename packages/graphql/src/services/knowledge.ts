import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  computeKBContentDigest,
  getKnowledgeGraphName,
  getPublishedKnowledgeGraph,
  hashKBContentDigestEntries,
  KnowledgeGraphNotPublishedError,
  type PublishedKnowledgeGraph,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from '@klicker-uzh/knowledge-graph'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  DeleteKBResourceInput,
  IngestKBResourceInput,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import {
  MAX_KB_RESOURCE_COUNT,
  MAX_KB_SOURCE_SIZE_BYTES,
  MAX_KB_TOTAL_SIZE_BYTES,
} from '@klicker-uzh/types'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import { normalizePublicHttpUrl } from '@klicker-uzh/util/public-url'
import { createHash, randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import { validate as validateUuid } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { assertManageAiEnabled } from '../lib/manageAiFeatureGate.js'
import { getKBGraphBundleCoordinates } from './kbGraphBundleCoordinates.js'
import {
  getKBGraphRemainingQuota,
  releaseKBGraphCostReservation,
  reserveKBGraphCost,
  settleKBGraphBuildCost,
} from './knowledgeGraphAccounting.js'
import {
  getKBGraphBillingLabel,
  getKBGraphCostConfiguration,
  requireKBGraphCostConfiguration,
} from './knowledgeGraphCost.js'

const MAX_KB_FILE_SIZE_BYTES = MAX_KB_SOURCE_SIZE_BYTES
const KB_DELETE_QUEUE_CONCURRENCY = 8
const KB_DEFAULT_PAGE_SIZE = 20
const KB_MAX_PAGE_SIZE = 50
const KB_BULK_DELETE_LIMIT = 50
const KB_CURSOR_VERSION = 1
const KB_MCP_SERVER_NAME = 'KB'
const KB_MCP_CHAT_MODES = ['tutor', 'explainer'] as const
const KB_FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  md: ['text/plain'],
}

type KBPaginationKind = 'knowledge-bases' | 'resources'

interface KBPaginationCursor {
  version: number
  kind: KBPaginationKind
  filterHash: string
  timestamp: string
  id: string
}

export interface KBPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface KBMetrics {
  visibleResourceCount: number
  visibleSizeBytes: number
  unknownSizeResourceCount: number
  quotaResourceCount: number
  quotaSizeBytes: number
  resourceLimit: number
  storageLimitBytes: number
  pendingCleanupCount: number
  pendingCleanupSizeBytes: number
  reservedResourceCount: number
  reservedSizeBytes: number
  linkedConsumerCount: number
}

export interface KBWithMetrics extends DB.KB {
  metrics: KBMetrics
}

export interface KBConnection {
  items: KBWithMetrics[]
  pageInfo: KBPageInfo
  totalCount: number
}

export interface KBResourceConnection {
  items: Array<DB.KBResource & { ingestionRuns: DB.KBIngestionRun[] }>
  pageInfo: KBPageInfo
  totalCount: number
}

function invalidPaginationInput(message: string): never {
  throw new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT' },
  })
}

function normalizePageSize(first: number | null | undefined) {
  const pageSize = first ?? KB_DEFAULT_PAGE_SIZE
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > KB_MAX_PAGE_SIZE
  ) {
    invalidPaginationInput('KB page size is invalid')
  }
  return pageSize
}

function normalizeSearch(search: string | null | undefined) {
  const normalized = search?.trim().replace(/\s+/g, ' ') ?? ''
  if (normalized.length > 200) {
    invalidPaginationInput('KB search is too long')
  }
  return normalized
}

function getFilterHash(filters: Record<string, string | null>) {
  return createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('base64url')
}

function encodePaginationCursor(cursor: KBPaginationCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodePaginationCursor(
  value: string | null | undefined,
  expectedKind: KBPaginationKind,
  expectedFilterHash: string
) {
  if (!value) return null
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    invalidPaginationInput('KB pagination cursor is invalid')
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<KBPaginationCursor>
    const timestamp = new Date(parsed.timestamp ?? '')
    if (
      parsed.version !== KB_CURSOR_VERSION ||
      parsed.kind !== expectedKind ||
      parsed.filterHash !== expectedFilterHash ||
      !validateUuid(parsed.id ?? '') ||
      Number.isNaN(timestamp.getTime()) ||
      timestamp.toISOString() !== parsed.timestamp
    ) {
      invalidPaginationInput('KB pagination cursor is invalid')
    }
    return {
      timestamp,
      id: parsed.id!,
    }
  } catch (error) {
    if (error instanceof GraphQLError) throw error
    invalidPaginationInput('KB pagination cursor is invalid')
  }
}

function createPaginationResult<T extends { id: string }>(
  items: T[],
  pageSize: number,
  cursorForItem: (item: T) => KBPaginationCursor,
  totalCount: number
) {
  const hasNextPage = items.length > pageSize
  const pageItems = hasNextPage ? items.slice(0, pageSize) : items
  const lastItem = pageItems.at(-1)
  return {
    items: pageItems,
    pageInfo: {
      hasNextPage,
      endCursor: lastItem
        ? encodePaginationCursor(cursorForItem(lastItem))
        : null,
    },
    totalCount,
  }
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
  const accountUrl = getBlobStorageAccountUrl(
    accountName,
    process.env.BLOB_STORAGE_ACCOUNT_URL
  )
  const internalAccountUrl = getBlobStorageAccountUrl(
    accountName,
    process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? accountUrl
  )
  const serviceClient = new BlobServiceClient(internalAccountUrl, credential)

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

async function getKbQuotaUsage(
  prisma: DB.Prisma.TransactionClient,
  kbId: string
) {
  const [resources, unknownSizeResources, uploadTickets] = await Promise.all([
    prisma.kBResource.aggregate({
      where: { kbId },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    prisma.kBResource.count({
      where: { kbId, sizeBytes: null },
    }),
    prisma.kBUploadTicket.aggregate({
      where: { kbId },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
  ])

  return {
    resourceCount: resources._count._all + uploadTickets._count._all,
    sizeBytes:
      (resources._sum.sizeBytes ?? 0) +
      unknownSizeResources * MAX_KB_FILE_SIZE_BYTES +
      (uploadTickets._sum.sizeBytes ?? 0),
  }
}

async function assertKbQuotaAvailable(
  prisma: DB.Prisma.TransactionClient,
  {
    kbId,
    resourceCount = 0,
    sizeBytes = 0,
  }: {
    kbId: string
    resourceCount?: number
    sizeBytes?: number
  }
) {
  const usage = await getKbQuotaUsage(prisma, kbId)
  if (usage.resourceCount + resourceCount > MAX_KB_RESOURCE_COUNT) {
    throw new GraphQLError('KB resource limit reached', {
      extensions: { code: 'KB_RESOURCE_LIMIT_REACHED' },
    })
  }
  if (usage.sizeBytes + sizeBytes > MAX_KB_TOTAL_SIZE_BYTES) {
    throw new GraphQLError('KB storage limit reached', {
      extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
    })
  }
}

function assertKbIngestionEnabled() {
  if (process.env.KB_INGESTION_DISABLED === 'true') {
    throw new GraphQLError('KB ingestion is currently disabled', {
      extensions: { code: 'KB_INGESTION_DISABLED' },
    })
  }
}

function assertKbGraphGenerationEnabled() {
  if (process.env.KB_GRAPH_DISABLED === 'true') {
    throw new GraphQLError('KB graph generation is currently disabled', {
      extensions: { code: 'KB_GRAPH_DISABLED' },
    })
  }
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

async function lockKbResourceInKbOrThrow(
  prisma: DB.Prisma.TransactionClient,
  kbId: string,
  resourceId: string
) {
  const lockedResource = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."KBResource"
    WHERE "id" = CAST(${resourceId} AS UUID)
      AND "kbId" = CAST(${kbId} AS UUID)
      AND "deletedAt" IS NULL
    FOR UPDATE
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
    select: { id: true, isActive: true },
  })
  if (!mcpServer || !mcpServer.isActive) {
    throw new GraphQLError('Knowledge base retrieval is not configured')
  }
  return mcpServer
}

function createKbMetrics({
  visibleResourceCount = 0,
  visibleSizeBytes = 0,
  visibleUnknownSizeCount = 0,
  retainedResourceCount = 0,
  retainedSizeBytes = 0,
  retainedUnknownSizeCount = 0,
  reservedResourceCount = 0,
  reservedSizeBytes = 0,
  linkedConsumerCount = 0,
}: Partial<{
  visibleResourceCount: number
  visibleSizeBytes: number
  visibleUnknownSizeCount: number
  retainedResourceCount: number
  retainedSizeBytes: number
  retainedUnknownSizeCount: number
  reservedResourceCount: number
  reservedSizeBytes: number
  linkedConsumerCount: number
}> = {}): KBMetrics {
  const quotaRetainedSizeBytes =
    retainedSizeBytes + retainedUnknownSizeCount * MAX_KB_FILE_SIZE_BYTES
  const quotaVisibleSizeBytes =
    visibleSizeBytes + visibleUnknownSizeCount * MAX_KB_FILE_SIZE_BYTES

  return {
    visibleResourceCount,
    visibleSizeBytes,
    unknownSizeResourceCount: visibleUnknownSizeCount,
    quotaResourceCount: retainedResourceCount + reservedResourceCount,
    quotaSizeBytes: quotaRetainedSizeBytes + reservedSizeBytes,
    resourceLimit: MAX_KB_RESOURCE_COUNT,
    storageLimitBytes: MAX_KB_TOTAL_SIZE_BYTES,
    pendingCleanupCount: retainedResourceCount - visibleResourceCount,
    pendingCleanupSizeBytes: quotaRetainedSizeBytes - quotaVisibleSizeBytes,
    reservedResourceCount,
    reservedSizeBytes,
    linkedConsumerCount,
  }
}

async function getKbMetricsMap(
  prisma: DB.Prisma.TransactionClient | ContextWithUser['prisma'],
  kbIds: string[]
) {
  if (kbIds.length === 0) return new Map<string, KBMetrics>()

  const [
    visibleResources,
    visibleUnknownSizes,
    retainedResources,
    retainedUnknownSizes,
    uploadTickets,
    linkedConsumers,
  ] = await Promise.all([
    prisma.kBResource.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds }, deletedAt: null },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    prisma.kBResource.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds }, deletedAt: null, sizeBytes: null },
      _count: { _all: true },
    }),
    prisma.kBResource.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    prisma.kBResource.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds }, sizeBytes: null },
      _count: { _all: true },
    }),
    prisma.kBUploadTicket.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    prisma.kBChatbot.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds }, isEnabled: true },
      _count: { _all: true },
    }),
  ])

  const visibleByKb = new Map(visibleResources.map((row) => [row.kbId, row]))
  const visibleUnknownByKb = new Map(
    visibleUnknownSizes.map((row) => [row.kbId, row._count._all])
  )
  const retainedByKb = new Map(retainedResources.map((row) => [row.kbId, row]))
  const retainedUnknownByKb = new Map(
    retainedUnknownSizes.map((row) => [row.kbId, row._count._all])
  )
  const ticketsByKb = new Map(uploadTickets.map((row) => [row.kbId, row]))
  const consumersByKb = new Map(
    linkedConsumers.map((row) => [row.kbId, row._count._all])
  )

  return new Map(
    kbIds.map((kbId) => {
      const visible = visibleByKb.get(kbId)
      const retained = retainedByKb.get(kbId)
      const tickets = ticketsByKb.get(kbId)
      return [
        kbId,
        createKbMetrics({
          visibleResourceCount: visible?._count._all,
          visibleSizeBytes: visible?._sum.sizeBytes ?? 0,
          visibleUnknownSizeCount: visibleUnknownByKb.get(kbId),
          retainedResourceCount: retained?._count._all,
          retainedSizeBytes: retained?._sum.sizeBytes ?? 0,
          retainedUnknownSizeCount: retainedUnknownByKb.get(kbId),
          reservedResourceCount: tickets?._count._all,
          reservedSizeBytes: tickets?._sum.sizeBytes ?? 0,
          linkedConsumerCount: consumersByKb.get(kbId),
        }),
      ]
    })
  )
}

async function getKbMetrics(
  prisma: DB.Prisma.TransactionClient | ContextWithUser['prisma'],
  kbId: string
): Promise<KBMetrics> {
  const metrics = await getKbMetricsMap(prisma, [kbId])
  return metrics.get(kbId) ?? createKbMetrics()
}

export async function getUserKbsConnection(
  {
    first,
    after,
    search,
  }: {
    first?: number | null
    after?: string | null
    search?: string | null
  },
  ctx: ContextWithUser
): Promise<KBConnection> {
  await assertManageAiEnabled(ctx)
  const pageSize = normalizePageSize(first)
  const normalizedSearch = normalizeSearch(search)
  const filterHash = getFilterHash({
    ownerId: ctx.user.sub,
    search: normalizedSearch,
  })
  const cursor = decodePaginationCursor(after, 'knowledge-bases', filterHash)
  const searchWhere: DB.Prisma.KBWhereInput = normalizedSearch
    ? {
        OR: [
          { name: { contains: normalizedSearch, mode: 'insensitive' } },
          {
            description: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
        ],
      }
    : {}
  const where: DB.Prisma.KBWhereInput = {
    ownerId: ctx.user.sub,
    deletedAt: null,
    ...searchWhere,
    ...(cursor
      ? {
          AND: [
            searchWhere,
            {
              OR: [
                { updatedAt: { lt: cursor.timestamp } },
                {
                  updatedAt: cursor.timestamp,
                  id: { lt: cursor.id },
                },
              ],
            },
          ],
        }
      : {}),
  }

  const [items, totalCount] = await Promise.all([
    ctx.prisma.kB.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    }),
    ctx.prisma.kB.count({
      where: {
        ownerId: ctx.user.sub,
        deletedAt: null,
        ...searchWhere,
      },
    }),
  ])
  const metrics = await getKbMetricsMap(
    ctx.prisma,
    items.map(({ id }) => id)
  )
  const itemsWithMetrics = items.map((kb) => ({
    ...kb,
    resources: [],
    metrics: metrics.get(kb.id) ?? createKbMetrics(),
  }))

  return createPaginationResult(
    itemsWithMetrics,
    pageSize,
    (kb) => ({
      version: KB_CURSOR_VERSION,
      kind: 'knowledge-bases',
      filterHash,
      timestamp: kb.updatedAt.toISOString(),
      id: kb.id,
    }),
    totalCount
  )
}

export async function getKb({ id }: { id: string }, ctx: ContextWithUser) {
  await assertManageAiEnabled(ctx)
  const kb = await ctx.prisma.kB.findFirst({
    where: { id, ownerId: ctx.user.sub, deletedAt: null },
  })
  if (!kb) {
    throw new GraphQLError('KB not found')
  }
  return {
    ...kb,
    metrics: await getKbMetrics(ctx.prisma, kb.id),
  } satisfies KBWithMetrics
}

export async function getKbResourcesConnection(
  {
    kbId,
    first,
    after,
    search,
    type,
    status,
  }: {
    kbId: string
    first?: number | null
    after?: string | null
    search?: string | null
    type?: DB.KBResourceType | null
    status?: DB.KBIngestionStatus | null
  },
  ctx: ContextWithUser
): Promise<KBResourceConnection> {
  await assertManageAiEnabled(ctx)
  await getOwnedKbOrThrow(ctx, kbId)
  const pageSize = normalizePageSize(first)
  const normalizedSearch = normalizeSearch(search)
  const filterHash = getFilterHash({
    ownerId: ctx.user.sub,
    kbId,
    search: normalizedSearch,
    type: type ?? null,
    status: status ?? null,
  })
  const cursor = decodePaginationCursor(after, 'resources', filterHash)
  const operationStatusResourceIds = status
    ? await ctx.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT resource."id"
        FROM "public"."KBResource" AS resource
        INNER JOIN "public"."KBIngestionRun" AS run
          ON run."id" = resource."ingestionAttemptId"
        WHERE resource."kbId" = CAST(${kbId} AS UUID)
          AND run."status" = CAST(${status} AS "KBIngestionStatus")
      `
    : null
  const searchWhere: DB.Prisma.KBResourceWhereInput = normalizedSearch
    ? {
        OR: [
          { title: { contains: normalizedSearch, mode: 'insensitive' } },
          {
            originalFilename: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            sourceUrl: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
        ],
      }
    : {}
  const baseWhere: DB.Prisma.KBResourceWhereInput = {
    kbId,
    kb: {
      is: {
        ownerId: ctx.user.sub,
        deletedAt: null,
      },
    },
    deletedAt: null,
    ...(type ? { type } : {}),
    ...(operationStatusResourceIds
      ? { id: { in: operationStatusResourceIds.map(({ id }) => id) } }
      : {}),
    ...searchWhere,
  }
  const where: DB.Prisma.KBResourceWhereInput = cursor
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { createdAt: { lt: cursor.timestamp } },
              {
                createdAt: cursor.timestamp,
                id: { lt: cursor.id },
              },
            ],
          },
        ],
      }
    : baseWhere

  const [items, totalCount] = await Promise.all([
    ctx.prisma.kBResource.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    }),
    ctx.prisma.kBResource.count({ where: baseWhere }),
  ])
  const currentAttemptIds = items.flatMap(({ ingestionAttemptId }) =>
    ingestionAttemptId ? [ingestionAttemptId] : []
  )
  const currentRuns =
    currentAttemptIds.length === 0
      ? []
      : await ctx.prisma.kBIngestionRun.findMany({
          where: { id: { in: currentAttemptIds } },
        })
  const currentRunsById = new Map(currentRuns.map((run) => [run.id, run]))
  const itemsWithCurrentRuns = items.map((resource) => {
    const currentRun = resource.ingestionAttemptId
      ? currentRunsById.get(resource.ingestionAttemptId)
      : undefined

    // A platform refresh appends a historic ledger row but must not replace
    // the lecturer operation currently recorded on the resource.
    return {
      ...resource,
      ingestionRuns: currentRun ? [currentRun] : [],
    }
  })

  return createPaginationResult(
    itemsWithCurrentRuns,
    pageSize,
    (resource) => ({
      version: KB_CURSOR_VERSION,
      kind: 'resources',
      filterHash,
      timestamp: resource.createdAt.toISOString(),
      id: resource.id,
    }),
    totalCount
  )
}

export async function getKbChatbotBindings(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
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
  await assertManageAiEnabled(ctx)
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
  await assertManageAiEnabled(ctx)
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
  await assertManageAiEnabled(ctx)
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
  await assertManageAiEnabled(ctx)
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
    await Promise.allSettled(
      results.map((result, index) =>
        result.status === 'rejected'
          ? recordDeletionQueueFailure(batch[index]!, ctx)
          : Promise.resolve()
      )
    )
  }
}

export async function deleteKb({ id }: { id: string }, ctx: ContextWithUser) {
  await assertManageAiEnabled(ctx)
  const { kb, deletionInputs } = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockOwnedKbOrThrow(prisma, id, ctx.user.sub)
      const graphState = await prisma.kB.findUniqueOrThrow({
        where: { id },
        select: { activeGraphBuildId: true },
      })
      if (graphState.activeGraphBuildId) {
        throw new GraphQLError('KB cannot be deleted while a graph build runs')
      }
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
        data: {
          deletedAt,
          deletedById: ctx.user.sub,
          publishedGraphBuildId: null,
        },
      })
      const bindingCandidates = await prisma.kBChatbot.findMany({
        where: { kbId: id, isEnabled: true },
        select: { chatbotId: true },
        orderBy: { chatbotId: 'asc' },
      })
      for (const { chatbotId } of bindingCandidates) {
        await lockOwnedChatbotOrThrow(prisma, chatbotId, ctx.user.sub)
      }
      const bindings = await prisma.kBChatbot.findMany({
        where: { kbId: id, isEnabled: true },
        select: { chatbotId: true },
      })
      if (bindings.length > 0) {
        await prisma.kBChatbot.updateMany({
          where: { kbId: id, isEnabled: true },
          data: { isEnabled: false },
        })
        const chatbotIds = bindings.map(({ chatbotId }) => chatbotId)
        const remainingBindings = await prisma.kBChatbot.findMany({
          where: {
            chatbotId: { in: chatbotIds },
            isEnabled: true,
          },
          select: { chatbotId: true },
        })
        const stillEnabled = new Set(
          remainingBindings.map(({ chatbotId }) => chatbotId)
        )
        const unboundChatbotIds = chatbotIds.filter(
          (chatbotId) => !stillEnabled.has(chatbotId)
        )
        const mcpServer = await prisma.chatbotMCPServer.findUnique({
          where: { name: KB_MCP_SERVER_NAME },
          select: { id: true },
        })
        if (mcpServer && unboundChatbotIds.length > 0) {
          await prisma.chatbotMCPConfig.updateMany({
            where: {
              mcpServerId: mcpServer.id,
              chatbotId: { in: unboundChatbotIds },
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
  await assertManageAiEnabled(ctx)
  assertKbIngestionEnabled()
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
    await assertKbQuotaAvailable(prisma, {
      kbId,
      resourceCount: 1,
      sizeBytes,
    })
    await prisma.kBUploadTicket.create({
      data: {
        id: blobId,
        kbId,
        blobName,
        sizeBytes,
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

function assertMatchingConfirmedBlob(
  resource: DB.KBResource,
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
  }
) {
  if (
    resource.kbId !== kbId ||
    resource.type !== DB.KBResourceType.BLOB ||
    resource.blobName !== blobName
  ) {
    throw new GraphQLError('KB blob name is invalid')
  }
  if (
    resource.title !== title ||
    resource.originalFilename !== originalFilename ||
    resource.mimeType !== mimeType ||
    resource.sizeBytes !== sizeBytes
  ) {
    throw new GraphQLError('KB upload ticket is invalid', {
      extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
    })
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
  await assertManageAiEnabled(ctx)
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
    assertMatchingConfirmedBlob(existingResource, {
      kbId,
      blobName,
      title: normalizedTitle,
      originalFilename,
      mimeType: validated.contentType,
      sizeBytes,
    })
    return existingResource
  }

  const { accountUrl, containerClient } = getKbBlobContainer(ctx.user.sub)
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
      assertMatchingConfirmedBlob(racedResource, {
        kbId,
        blobName,
        title: normalizedTitle,
        originalFilename,
        mimeType: validated.contentType,
        sizeBytes,
      })
      return racedResource
    }

    const ticket = await prisma.kBUploadTicket.findFirst({
      where: {
        id: blobId,
        kbId,
        blobName,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, sizeBytes: true },
    })
    if (!ticket || (ticket.sizeBytes !== 0 && ticket.sizeBytes !== sizeBytes)) {
      throw new GraphQLError('KB upload ticket is invalid', {
        extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
      })
    }
    if (ticket.sizeBytes === 0) {
      await assertKbQuotaAvailable(prisma, { kbId, sizeBytes })
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
        blobHref: `${accountUrl}/${containerClient.containerName}/${blobName}`,
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
  await assertManageAiEnabled(ctx)
  assertKbIngestionEnabled()
  await getOwnedKbOrThrow(ctx, kbId)

  let sourceUrl: string
  try {
    sourceUrl = normalizePublicHttpUrl(url)
  } catch {
    throw new GraphQLError('KB resource URL is invalid')
  }

  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await assertKbQuotaAvailable(prisma, {
      kbId,
      resourceCount: 1,
      sizeBytes: MAX_KB_FILE_SIZE_BYTES,
    })
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
  await assertManageAiEnabled(ctx)
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

export async function deleteKbResources(
  { kbId, ids }: { kbId: string; ids: string[] },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  if (
    ids.length === 0 ||
    ids.length > KB_BULK_DELETE_LIMIT ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !validateUuid(id))
  ) {
    invalidPaginationInput('KB bulk deletion selection is invalid')
  }
  // Explicit code-unit order: this fixes the child lock order, so it must not
  // vary with the runtime locale.
  const sortedIds = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const { resources, deletionInputs } = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
      for (const resourceId of sortedIds) {
        await lockKbResourceInKbOrThrow(prisma, kbId, resourceId)
      }

      const resourceRows = await prisma.kBResource.findMany({
        where: {
          id: { in: sortedIds },
          kbId,
          deletedAt: null,
        },
      })
      if (resourceRows.length !== sortedIds.length) {
        throw new GraphQLError('KB resource not found')
      }
      if (
        resourceRows.some(
          ({ status }) =>
            status === DB.KBResourceStatus.QUEUED ||
            status === DB.KBResourceStatus.PROCESSING
        )
      ) {
        throw new GraphQLError('KB resources cannot be deleted', {
          extensions: { code: 'KB_RESOURCE_ACTIVE' },
        })
      }
      if (
        resourceRows.some(
          ({ resourceVersion }) => resourceVersion >= 2_147_483_647
        )
      ) {
        throw new GraphQLError('KB resource version limit reached')
      }

      const byId = new Map(
        resourceRows.map((resource) => [resource.id, resource])
      )
      const orderedResources = sortedIds.map((id) => byId.get(id)!)
      const deletedAt = new Date()
      const deletionInputs = orderedResources.map((resource) => ({
        resourceId: resource.id,
        kbId,
        deletionAttemptId: randomUUID(),
        resourceVersion: resource.resourceVersion + 1,
      }))
      const resources: DB.KBResource[] = []
      for (const [index, resource] of orderedResources.entries()) {
        const input = deletionInputs[index]!
        resources.push(
          await prisma.kBResource.update({
            where: { id: resource.id },
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
        )
        await prisma.kBIngestionRun.create({
          data: {
            id: input.deletionAttemptId,
            resourceId: resource.id,
            operation: DB.KBIngestionOperation.DELETE,
            resourceVersion: input.resourceVersion,
          },
        })
      }
      return { resources, deletionInputs }
    }
  )

  await queueKbDeletions(deletionInputs, ctx)
  return resources
}

export async function ingestKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  assertKbIngestionEnabled()
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

export interface KBKnowledgeGraphConfig {
  kbId: string
  isEnabled: boolean
  buildId: string | null
  status: DB.KBGraphBuildStatus | null
  statusMessage: string | null
  qualityTier: DB.KBGraphQualityTier | null
  sourceContentDigest: string | null
  activeBuildId: string | null
  publishedBuildId: string | null
  isStale: boolean
  startedAt: Date | null
  finishedAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
  costConfigurationReady: boolean
  costCurrency: string | null
  quotaCurrency: string | null
  billingLabel: string | null
  standardEstimateMinorUnits: number | null
  highEstimateMinorUnits: number | null
  estimatedCostMinorUnits: number | null
  actualCostMinorUnits: number | null
  actualInputTokens: number | null
  actualOutputTokens: number | null
  actualEmbeddingTokens: number | null
  actualRequestCount: number | null
  maxCostMinorUnits: number | null
  costStatus: DB.KBGraphCostStatus | null
  semesterKey: string | null
  semesterQuotaMinorUnits: number | null
  semesterReservedMinorUnits: number | null
  semesterSettledMinorUnits: number | null
  remainingSemesterQuotaMinorUnits: number | null
  worstCaseRemainingMinorUnits: number | null
}

function getKBGraphArtifactBlobName(buildId: string): string {
  return `knowledge-graphs/${buildId}.graphml`
}

const KB_GRAPH_BUILD_CONFIG_SELECT = {
  id: true,
  status: true,
  statusMessage: true,
  qualityTier: true,
  sourceContentDigest: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  estimatedCostMinorUnits: true,
  actualCostMinorUnits: true,
  actualInputTokens: true,
  actualOutputTokens: true,
  actualEmbeddingTokens: true,
  actualRequestCount: true,
  costCurrency: true,
  costStatus: true,
  errorCode: true,
  quotaId: true,
  quota: {
    select: {
      currency: true,
      limitMinorUnits: true,
      reservedMinorUnits: true,
      settledMinorUnits: true,
    },
  },
} satisfies DB.Prisma.KBGraphBuildSelect

export function getKBGraphBuildConfig(
  kb: {
    id: string
    knowledgeGraphEnabled: boolean
    activeGraphBuildId: string | null
    publishedGraphBuildId: string | null
  },
  build: {
    id: string
    status: DB.KBGraphBuildStatus
    statusMessage: string | null
    qualityTier: DB.KBGraphQualityTier
    sourceContentDigest: string
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date
    updatedAt: Date
    estimatedCostMinorUnits: number | null
    actualCostMinorUnits: number | null
    actualInputTokens: number | null
    actualOutputTokens: number | null
    actualEmbeddingTokens: number | null
    actualRequestCount: number | null
    costCurrency: string | null
    costStatus: DB.KBGraphCostStatus | null
    quotaId: string | null
    quota: {
      currency: string
      limitMinorUnits: number
      reservedMinorUnits: number
      settledMinorUnits: number
    } | null
  } | null,
  isStale: boolean,
  quota: {
    currency: string
    limitMinorUnits: number
    reservedMinorUnits: number
    settledMinorUnits: number
  } | null,
  costConfiguration: ReturnType<typeof getKBGraphCostConfiguration>
): KBKnowledgeGraphConfig {
  const quotaConfigurationMatches =
    quota === null ||
    (quota.currency === costConfiguration.currency &&
      quota.limitMinorUnits === costConfiguration.semesterQuotaMinorUnits)
  const costConfigurationReady =
    costConfiguration.ready && quotaConfigurationMatches
  const remainingSemesterQuotaMinorUnits = getKBGraphRemainingQuota(
    quota,
    costConfiguration
  )
  const worstCaseRemainingMinorUnits =
    remainingSemesterQuotaMinorUnits !== null &&
    costConfiguration.maxCostMinorUnits !== null
      ? remainingSemesterQuotaMinorUnits - costConfiguration.maxCostMinorUnits
      : null
  return {
    kbId: kb.id,
    isEnabled: kb.knowledgeGraphEnabled,
    buildId: build?.id ?? null,
    status: build?.status ?? null,
    statusMessage: build?.statusMessage ?? null,
    qualityTier: build?.qualityTier ?? null,
    sourceContentDigest: build?.sourceContentDigest ?? null,
    activeBuildId: kb.activeGraphBuildId,
    publishedBuildId: kb.publishedGraphBuildId,
    isStale,
    startedAt: build?.startedAt ?? null,
    finishedAt: build?.finishedAt ?? null,
    createdAt: build?.createdAt ?? null,
    updatedAt: build?.updatedAt ?? null,
    costConfigurationReady,
    costCurrency: build?.costCurrency ?? costConfiguration.currency,
    quotaCurrency: quota?.currency ?? costConfiguration.currency,
    billingLabel: getKBGraphBillingLabel(costConfiguration),
    standardEstimateMinorUnits: costConfiguration.standardEstimateMinorUnits,
    highEstimateMinorUnits: costConfiguration.highEstimateMinorUnits,
    estimatedCostMinorUnits:
      build?.estimatedCostMinorUnits ??
      costConfiguration.standardEstimateMinorUnits,
    actualCostMinorUnits: build?.actualCostMinorUnits ?? null,
    actualInputTokens: build?.actualInputTokens ?? null,
    actualOutputTokens: build?.actualOutputTokens ?? null,
    actualEmbeddingTokens: build?.actualEmbeddingTokens ?? null,
    actualRequestCount: build?.actualRequestCount ?? null,
    maxCostMinorUnits: costConfiguration.maxCostMinorUnits,
    costStatus: build?.costStatus ?? null,
    semesterKey: costConfiguration.semesterKey,
    semesterQuotaMinorUnits:
      quota?.limitMinorUnits ?? costConfiguration.semesterQuotaMinorUnits,
    semesterReservedMinorUnits: quota?.reservedMinorUnits ?? 0,
    semesterSettledMinorUnits: quota?.settledMinorUnits ?? 0,
    remainingSemesterQuotaMinorUnits,
    worstCaseRemainingMinorUnits,
  }
}

export async function getKbKnowledgeGraphConfig(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
): Promise<KBKnowledgeGraphConfig> {
  await assertManageAiEnabled(ctx)
  const kb = await getOwnedKbOrThrow(ctx, kbId)
  const costConfiguration = getKBGraphCostConfiguration()
  const [build, publishedBuild] = await Promise.all([
    ctx.prisma.kBGraphBuild.findFirst({
      where: { kbId: kb.id },
      select: KB_GRAPH_BUILD_CONFIG_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    kb.publishedGraphBuildId
      ? ctx.prisma.kBGraphBuild.findFirst({
          where: {
            id: kb.publishedGraphBuildId,
            kbId: kb.id,
            status: DB.KBGraphBuildStatus.SUCCEEDED,
          },
          select: { sourceContentDigest: true },
        })
      : Promise.resolve(null),
  ])
  const quota = await ctx.prisma.kBGraphQuota.findUnique({
    where: {
      ownerId_semesterKey: {
        ownerId: kb.ownerId,
        semesterKey: costConfiguration.semesterKey,
      },
    },
    select: {
      currency: true,
      limitMinorUnits: true,
      reservedMinorUnits: true,
      settledMinorUnits: true,
    },
  })
  const isStale =
    publishedBuild !== null
      ? publishedBuild.sourceContentDigest !==
        (await computeKBContentDigest(ctx.prisma, kb.id))
      : false
  return getKBGraphBuildConfig(kb, build, isStale, quota, costConfiguration)
}

async function readOwnedPublishedKBGraph(
  kbId: string,
  ctx: ContextWithUser,
  read: (graph: PublishedKnowledgeGraph) => Promise<KnowledgeGraphResponse>
) {
  await assertManageAiEnabled(ctx)
  await getOwnedKbOrThrow(ctx, kbId)
  try {
    return await read(await getPublishedKnowledgeGraph(ctx.prisma, kbId))
  } catch (error) {
    if (error instanceof KnowledgeGraphNotPublishedError) {
      throw new GraphQLError('KB knowledge graph is not published', {
        extensions: { code: `KB_GRAPH_${error.code}` },
      })
    }
    throw error
  }
}

export async function getKbKnowledgeGraphOverview(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
) {
  return readOwnedPublishedKBGraph(kbId, ctx, readKnowledgeGraphOverview)
}

export async function searchKbKnowledgeGraph(
  { kbId, query }: { kbId: string; query: string },
  ctx: ContextWithUser
) {
  return readOwnedPublishedKBGraph(kbId, ctx, (graph) =>
    searchKnowledgeGraph(graph, query)
  )
}

export async function getKbKnowledgeGraphNeighbors(
  { kbId, nodeId }: { kbId: string; nodeId: string },
  ctx: ContextWithUser
) {
  return readOwnedPublishedKBGraph(kbId, ctx, (graph) =>
    readKnowledgeGraphNeighbors(graph, nodeId)
  )
}

export async function setKbKnowledgeGraphEnabled(
  { kbId, enabled }: { kbId: string; enabled: boolean },
  ctx: ContextWithUser
): Promise<KBKnowledgeGraphConfig> {
  await assertManageAiEnabled(ctx)
  if (enabled) {
    assertKbGraphGenerationEnabled()
    requireKBGraphCostConfiguration()
  }

  await ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await prisma.kB.update({
      where: { id: kbId },
      data: { knowledgeGraphEnabled: enabled },
    })
  })

  return getKbKnowledgeGraphConfig({ kbId }, ctx)
}

export async function settleKbKnowledgeGraphResult(
  prisma: DB.PrismaClient,
  {
    buildId,
    result,
    allowLateSuccess,
  }: { buildId: string; result: unknown; allowLateSuccess?: boolean },
  finishedAt = new Date()
) {
  return prisma.$transaction((transaction) =>
    settleKBGraphBuildCost(transaction, {
      buildId,
      result,
      finishedAt,
      allowLateSuccess,
    })
  )
}

type GraphBuildSnapshotResource = {
  id: string
  title: string
  type: DB.KBResourceType
  sourceUrl: string | null
  blobName: string | null
  activeContentSha256: string | null
}

function validateGraphBuildSnapshotResource(
  resource: GraphBuildSnapshotResource
) {
  if (!resource.activeContentSha256) {
    throw new GraphQLError('KB graph source is not serving content')
  }
  if (resource.type === DB.KBResourceType.BLOB && !resource.blobName) {
    throw new GraphQLError('KB graph blob source is invalid')
  }
  if (resource.type === DB.KBResourceType.URL && !resource.sourceUrl) {
    throw new GraphQLError('KB graph URL source is invalid')
  }
  return resource.activeContentSha256
}

export async function rebuildKbKnowledgeGraph(
  {
    kbId,
    qualityTier: requestedQualityTier,
  }: {
    kbId: string
    qualityTier?: DB.KBGraphQualityTier | null
  },
  ctx: ContextWithUser
): Promise<KBKnowledgeGraphConfig> {
  const qualityTier = requestedQualityTier ?? DB.KBGraphQualityTier.STANDARD
  await assertManageAiEnabled(ctx)
  assertKbGraphGenerationEnabled()
  const result = await ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    const kb = await prisma.kB.findUniqueOrThrow({
      where: { id: kbId },
      select: {
        id: true,
        knowledgeGraphEnabled: true,
        activeGraphBuildId: true,
        publishedGraphBuildId: true,
      },
    })

    if (!kb.knowledgeGraphEnabled) {
      throw new GraphQLError('KB knowledge graph is not enabled', {
        extensions: { code: 'KB_GRAPH_NOT_ENABLED' },
      })
    }

    if (kb.activeGraphBuildId) {
      const activeBuild = await prisma.kBGraphBuild.findFirst({
        where: { id: kb.activeGraphBuildId, kbId },
        select: KB_GRAPH_BUILD_CONFIG_SELECT,
      })
      if (
        activeBuild &&
        (activeBuild.status === DB.KBGraphBuildStatus.QUEUED ||
          activeBuild.status === DB.KBGraphBuildStatus.PROCESSING)
      ) {
        return { kb, build: activeBuild, queueBuildId: null }
      }
      if (activeBuild?.errorCode === 'KB_GRAPH_DISPATCH_AMBIGUOUS') {
        throw new GraphQLError(
          'The previous KB graph dispatch requires manual review before another build can start.',
          { extensions: { code: 'KB_GRAPH_DISPATCH_AMBIGUOUS' } }
        )
      }
      await prisma.kB.updateMany({
        where: { id: kbId, activeGraphBuildId: kb.activeGraphBuildId },
        data: { activeGraphBuildId: null },
      })
    }

    const resources = await prisma.kBResource.findMany({
      where: {
        kbId,
        deletedAt: null,
        activeContentSha256: { not: null },
      },
      select: {
        id: true,
        title: true,
        type: true,
        sourceUrl: true,
        blobName: true,
        activeContentSha256: true,
      },
      orderBy: { id: 'asc' },
    })
    if (resources.length === 0) {
      throw new GraphQLError('KB has no active graph sources', {
        extensions: { code: 'KB_GRAPH_EMPTY' },
      })
    }

    const validatedResources = resources.map((resource) => ({
      resource,
      contentSha256: validateGraphBuildSnapshotResource(resource),
    }))
    const sourceContentDigest = hashKBContentDigestEntries(
      validatedResources.map(({ resource, contentSha256 }) => ({
        resourceId: resource.id,
        contentSha256,
      }))
    )
    const buildId = randomUUID()
    const graphBundleCoordinates = getKBGraphBundleCoordinates(buildId)
    const reservation = await reserveKBGraphCost(prisma, {
      ownerId: ctx.user.sub,
      qualityTier,
    })
    const build = await prisma.kBGraphBuild.create({
      data: {
        id: buildId,
        kbId,
        requestedById: ctx.user.sub,
        qualityTier,
        sourceContentDigest,
        graphName: getKnowledgeGraphName(kbId, buildId),
        graphmlBlobName: getKBGraphArtifactBlobName(buildId),
        graphBundleContainerName: graphBundleCoordinates.containerName,
        graphBundleBlobPrefix: graphBundleCoordinates.blobPrefix,
        estimatedCostMinorUnits: reservation.estimatedCostMinorUnits,
        costCurrency: reservation.currency,
        costPricingVersion: reservation.pricingVersion,
        costStatus: DB.KBGraphCostStatus.RESERVED,
        semesterKey: reservation.semesterKey,
        quotaId: reservation.quotaId,
        sources: {
          create: validatedResources.map(({ resource, contentSha256 }) => ({
            resourceId: resource.id,
            title: resource.title,
            type: resource.type,
            sourceUrl: resource.sourceUrl,
            blobName: resource.blobName,
            contentSha256,
          })),
        },
      },
      select: KB_GRAPH_BUILD_CONFIG_SELECT,
    })
    const claimed = await prisma.kB.updateMany({
      where: { id: kbId, activeGraphBuildId: null },
      data: { activeGraphBuildId: buildId },
    })
    if (claimed.count !== 1) {
      throw new Error('KB graph build slot could not be claimed')
    }
    return {
      kb: { ...kb, activeGraphBuildId: buildId },
      build,
      queueBuildId: buildId,
    }
  })

  if (result.queueBuildId) {
    try {
      await ctx.tasks.buildKBGraph.runNoWait({ buildId: result.queueBuildId })
    } catch {
      const finishedAt = new Date()
      await ctx.prisma.$transaction(async (prisma) => {
        const failed = await prisma.kBGraphBuild.updateMany({
          where: {
            id: result.queueBuildId!,
            kbId,
            externalOperationId: null,
            dispatchClaimedAt: null,
            status: DB.KBGraphBuildStatus.QUEUED,
          },
          data: {
            status: DB.KBGraphBuildStatus.FAILED,
            statusMessage: 'The KB graph build could not be queued.',
            errorCode: 'KB_GRAPH_QUEUE_DISPATCH_FAILED',
            finishedAt,
          },
        })
        if (failed.count === 1) {
          await releaseKBGraphCostReservation(prisma, result.queueBuildId!)
          await prisma.kB.updateMany({
            where: { id: kbId, activeGraphBuildId: result.queueBuildId! },
            data: { activeGraphBuildId: null },
          })
        }
      })
      throw new GraphQLError('KB graph build could not be queued')
    }
  }

  const isStale =
    result.build.status === DB.KBGraphBuildStatus.SUCCEEDED
      ? result.build.sourceContentDigest !==
        (await computeKBContentDigest(ctx.prisma, kbId))
      : false
  const costConfiguration = getKBGraphCostConfiguration()
  const quota = await ctx.prisma.kBGraphQuota.findUnique({
    where: {
      ownerId_semesterKey: {
        ownerId: ctx.user.sub,
        semesterKey: costConfiguration.semesterKey,
      },
    },
    select: {
      currency: true,
      limitMinorUnits: true,
      reservedMinorUnits: true,
      settledMinorUnits: true,
    },
  })
  return getKBGraphBuildConfig(
    result.kb,
    result.build,
    isStale,
    quota,
    costConfiguration
  )
}
