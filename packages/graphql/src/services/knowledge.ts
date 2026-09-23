import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  computeKBContentDigest,
  getDefaultKBGraphDomainCatalog,
  getKnowledgeGraphName,
  getPublishedKnowledgeGraph,
  hashKBContentDigestEntries,
  isKBGraphDomainCapabilityEnabled,
  KB_GRAPH_DOMAIN_ERROR_CODES,
  type KBGraphDomainCategory,
  type KBGraphDomainSelection,
  type KBGraphDomainSelectionRejectionReason,
  type KBGraphDomainSelectionRequest,
  KnowledgeGraphNotPublishedError,
  type PublishedKnowledgeGraph,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  resolveKBGraphDomainSelection,
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
  resolveKBStorageLimitBytes,
} from '@klicker-uzh/types'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import { normalizePublicHttpUrl } from '@klicker-uzh/util/public-url'
import { createHash, randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import { validate as validateUuid } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import {
  isFeatureFlagEnabled,
  isFeatureFlagEnabledForAccount,
} from '../lib/featureFlags.js'
import {
  assertManageAiCapability,
  assertManageAiEnabled,
  getAccountManageAiCapability,
} from '../lib/manageAiFeatureGate.js'
import {
  fetchKbSourceInventory,
  type KbSourceInventoryDeps,
} from './docQuerySources.js'
import { isElementGenerationGraphBundleReady } from './elementGenerationGraphReadiness.js'
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
const KB_BULK_INGEST_DISPATCH_CONCURRENCY = 8
const KB_CURSOR_VERSION = 1
// Mirrors the provider's CourseKGInput.focus_topic bound. The provider rejects
// longer values, so the request is refused before a cost reservation exists
// rather than failing after dispatch.
const KB_GRAPH_FOCUS_TOPIC_MAX_LENGTH = 300
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
  servingResourceCount: number
  processingResourceCount: number
  failedResourceCount: number
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
  needsIngestionCount: number
  failedIngestionCount: number
  inProgressCount: number
}

export interface KBImportedSource {
  id: string
  title: string
  sourceType: string | null
  sourceUrl: string | null
  ingestedAt: Date | null
  observedAt: Date | null
  chunkCount: number
  origin: KBSourceOrigin
}

/**
 * Where an indexed source came from. ``MANAGED`` is a resource added through
 * the app, ``IMPORTED`` is content written straight into the vector store by
 * an operator import.
 */
export const KB_SOURCE_ORIGINS = ['MANAGED', 'IMPORTED'] as const
export type KBSourceOrigin = (typeof KB_SOURCE_ORIGINS)[number]

export interface KBImportedSourceConnection {
  items: KBImportedSource[]
  pageInfo: KBPageInfo
  totalSourcesInScan: number
  incomplete: boolean
  unidentifiedChunks: number
}

export interface KBIngestAllResult {
  queuedCount: number
  retriedFailedCount: number
  alreadyCurrentCount: number
  alreadyInProgressCount: number
  queueFailureCount: number
}

type KBResourceReconciliationRecord = Pick<
  DB.KBResource,
  | 'status'
  | 'resourceVersion'
  | 'contentSha256'
  | 'activeResourceVersion'
  | 'activeContentSha256'
  | 'ingestionAttemptId'
>

function hasCurrentServingIdentity(resource: KBResourceReconciliationRecord) {
  return (
    resource.activeResourceVersion !== null &&
    resource.activeContentSha256 !== null &&
    resource.contentSha256 !== null &&
    resource.activeResourceVersion === resource.resourceVersion &&
    resource.activeContentSha256 === resource.contentSha256
  )
}

function getResourceReconciliationState(
  resource: KBResourceReconciliationRecord,
  currentRun?: Pick<DB.KBIngestionRun, 'status'>
) {
  if (
    resource.status === DB.KBResourceStatus.QUEUED ||
    resource.status === DB.KBResourceStatus.PROCESSING ||
    currentRun?.status === DB.KBIngestionStatus.QUEUED ||
    currentRun?.status === DB.KBIngestionStatus.PROCESSING
  ) {
    return 'in-progress' as const
  }

  // A newer platform serving revision is authoritative. Never create a
  // lecturer attempt that would move this resource backwards.
  if (
    resource.activeResourceVersion !== null &&
    resource.activeResourceVersion > resource.resourceVersion
  ) {
    return 'current' as const
  }

  if (
    resource.status === DB.KBResourceStatus.ADDED ||
    (resource.status === DB.KBResourceStatus.FAILED &&
      !hasCurrentServingIdentity(resource)) ||
    (resource.status === DB.KBResourceStatus.READY &&
      !hasCurrentServingIdentity(resource))
  ) {
    return 'needs-ingestion' as const
  }

  return 'current' as const
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

function normalizeKbResourceMaterialType(
  materialType: DB.KBResourceMaterialType | null | undefined
) {
  return materialType ?? DB.KBResourceMaterialType.UNCLASSIFIED
}

async function getKbQuotaUsage(
  prisma: DB.Prisma.TransactionClient,
  kbId: string
) {
  const [resources, unknownSizeResources, uploadTickets, createUploadTickets] =
    await Promise.all([
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
        _sum: { sizeBytes: true },
      }),
      prisma.kBUploadTicket.count({
        where: { kbId, replacementResourceId: null },
      }),
    ])

  return {
    resourceCount: resources._count._all + createUploadTickets,
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
  const [usage, kb] = await Promise.all([
    getKbQuotaUsage(prisma, kbId),
    prisma.kB.findUniqueOrThrow({
      where: { id: kbId },
      select: { storageLimitMiB: true },
    }),
  ])
  if (usage.resourceCount + resourceCount > MAX_KB_RESOURCE_COUNT) {
    throw new GraphQLError('KB resource limit reached', {
      extensions: { code: 'KB_RESOURCE_LIMIT_REACHED' },
    })
  }
  if (
    usage.sizeBytes + sizeBytes >
    resolveKBStorageLimitBytes(kb.storageLimitMiB)
  ) {
    throw new GraphQLError('KB storage limit reached', {
      extensions: { code: 'KB_STORAGE_LIMIT_REACHED' },
    })
  }
}

/**
 * Admission for new ingestion work. The actor's rollout decides whether an
 * upload ticket, URL resource, or ingestion attempt may start; an absent,
 * unregistered, or unusable evaluation refuses one rather than admitting work
 * the deployment cannot honor. Upload confirmation starts ingestion and is
 * gated here as well, but only where it creates the resource: repeating a
 * confirmation that already succeeded returns the existing resource without
 * consulting the rollout. Reads, deletion, cleanup and already queued
 * reconciliation stay available, and the general worker keeps its separate
 * startup gate.
 */
async function assertKbIngestionEnabled(ctx: ContextWithUser) {
  if (!(await isFeatureFlagEnabled(ctx, 'kb-ingestion'))) {
    throw new GraphQLError('KB ingestion is currently disabled', {
      extensions: { code: 'KB_INGESTION_DISABLED' },
    })
  }
}

/**
 * Admission for new graph builds. Opting a KB in and rebuilding both start
 * work, so both consult the actor's rollout before any cost reservation. A
 * published graph keeps being served, and an accepted build keeps running,
 * settling and publishing on the gates it passed.
 */
async function assertKbGraphGenerationEnabled(ctx: ContextWithUser) {
  if (!(await isFeatureFlagEnabled(ctx, 'kb-graph-builds'))) {
    throwKbGraphGenerationDisabled()
  }
}

function throwKbGraphGenerationDisabled(): never {
  throw new GraphQLError('KB graph generation is currently disabled', {
    extensions: { code: 'KB_GRAPH_DISABLED' },
  })
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
    select: {
      id: true,
      isActive: true,
      url: true,
      authType: true,
      authSecret: true,
    },
  })
  if (!mcpServer || !mcpServer.isActive) {
    throw new GraphQLError('Knowledge base retrieval is not configured')
  }
  return mcpServer
}

function createKbMetrics({
  storageLimitBytes = MAX_KB_TOTAL_SIZE_BYTES,
  visibleResourceCount = 0,
  visibleSizeBytes = 0,
  visibleUnknownSizeCount = 0,
  retainedResourceCount = 0,
  retainedSizeBytes = 0,
  retainedUnknownSizeCount = 0,
  reservedResourceCount = 0,
  reservedSizeBytes = 0,
  linkedConsumerCount = 0,
  servingResourceCount = 0,
  processingResourceCount = 0,
  failedResourceCount = 0,
}: Partial<{
  storageLimitBytes: number
  visibleResourceCount: number
  visibleSizeBytes: number
  visibleUnknownSizeCount: number
  retainedResourceCount: number
  retainedSizeBytes: number
  retainedUnknownSizeCount: number
  reservedResourceCount: number
  reservedSizeBytes: number
  linkedConsumerCount: number
  servingResourceCount: number
  processingResourceCount: number
  failedResourceCount: number
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
    storageLimitBytes,
    pendingCleanupCount: retainedResourceCount - visibleResourceCount,
    pendingCleanupSizeBytes: quotaRetainedSizeBytes - quotaVisibleSizeBytes,
    reservedResourceCount,
    reservedSizeBytes,
    linkedConsumerCount,
    servingResourceCount,
    processingResourceCount,
    failedResourceCount,
  }
}

export async function getKbMetricsMap(
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
    createUploadTickets,
    linkedConsumers,
    knowledgeBases,
    resourceStatuses,
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
      _sum: { sizeBytes: true },
    }),
    prisma.kBUploadTicket.groupBy({
      by: ['kbId'],
      where: {
        kbId: { in: kbIds },
        replacementResourceId: null,
      },
      _count: { _all: true },
    }),
    prisma.kBChatbot.groupBy({
      by: ['kbId'],
      where: { kbId: { in: kbIds }, isEnabled: true },
      _count: { _all: true },
    }),
    prisma.kB.findMany({
      where: { id: { in: kbIds } },
      select: { id: true, storageLimitMiB: true },
    }),
    // Counting the serving revision per status lets a resource whose
    // replacement is still processing or has failed keep counting as
    // retrievable through the revision it already serves.
    prisma.kBResource.groupBy({
      by: ['kbId', 'status'],
      where: { kbId: { in: kbIds }, deletedAt: null },
      _count: { _all: true, activeResourceVersion: true },
    }),
  ])

  const storageLimitsByKb = new Map(
    knowledgeBases.map((kb) => [
      kb.id,
      resolveKBStorageLimitBytes(kb.storageLimitMiB),
    ])
  )
  const visibleByKb = new Map(visibleResources.map((row) => [row.kbId, row]))
  const visibleUnknownByKb = new Map(
    visibleUnknownSizes.map((row) => [row.kbId, row._count._all])
  )
  const retainedByKb = new Map(retainedResources.map((row) => [row.kbId, row]))
  const retainedUnknownByKb = new Map(
    retainedUnknownSizes.map((row) => [row.kbId, row._count._all])
  )
  const ticketsByKb = new Map(uploadTickets.map((row) => [row.kbId, row]))
  const createTicketsByKb = new Map(
    createUploadTickets.map((row) => [row.kbId, row._count._all])
  )
  const consumersByKb = new Map(
    linkedConsumers.map((row) => [row.kbId, row._count._all])
  )
  const readinessByKb = new Map<
    string,
    { serving: number; processing: number; failed: number }
  >()
  for (const row of resourceStatuses) {
    const readiness = readinessByKb.get(row.kbId) ?? {
      serving: 0,
      processing: 0,
      failed: 0,
    }
    readiness.serving += row._count.activeResourceVersion
    if (
      row.status === DB.KBResourceStatus.QUEUED ||
      row.status === DB.KBResourceStatus.PROCESSING
    ) {
      readiness.processing += row._count._all
    }
    if (row.status === DB.KBResourceStatus.FAILED) {
      readiness.failed += row._count._all
    }
    readinessByKb.set(row.kbId, readiness)
  }

  return new Map(
    kbIds.map((kbId) => {
      const visible = visibleByKb.get(kbId)
      const retained = retainedByKb.get(kbId)
      const tickets = ticketsByKb.get(kbId)
      const readiness = readinessByKb.get(kbId)
      return [
        kbId,
        createKbMetrics({
          storageLimitBytes: storageLimitsByKb.get(kbId),
          visibleResourceCount: visible?._count._all,
          visibleSizeBytes: visible?._sum.sizeBytes ?? 0,
          visibleUnknownSizeCount: visibleUnknownByKb.get(kbId),
          retainedResourceCount: retained?._count._all,
          retainedSizeBytes: retained?._sum.sizeBytes ?? 0,
          retainedUnknownSizeCount: retainedUnknownByKb.get(kbId),
          reservedResourceCount: createTicketsByKb.get(kbId),
          reservedSizeBytes: tickets?._sum.sizeBytes ?? 0,
          linkedConsumerCount: consumersByKb.get(kbId),
          servingResourceCount: readiness?.serving,
          processingResourceCount: readiness?.processing,
          failedResourceCount: readiness?.failed,
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
    materialType,
  }: {
    kbId: string
    first?: number | null
    after?: string | null
    search?: string | null
    type?: DB.KBResourceType | null
    status?: DB.KBIngestionStatus | null
    materialType?: DB.KBResourceMaterialType | null
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
    materialType: materialType ?? null,
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
    ...(materialType ? { materialType } : {}),
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

  const [items, totalCount, summaryResources] = await Promise.all([
    ctx.prisma.kBResource.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    }),
    ctx.prisma.kBResource.count({ where: baseWhere }),
    ctx.prisma.kBResource.findMany({
      where: {
        kbId,
        kb: {
          is: {
            ownerId: ctx.user.sub,
            deletedAt: null,
          },
        },
        deletedAt: null,
      },
      select: {
        status: true,
        resourceVersion: true,
        contentSha256: true,
        activeResourceVersion: true,
        activeContentSha256: true,
        ingestionAttemptId: true,
      },
    }),
  ])
  const currentAttemptIds = summaryResources.flatMap(
    ({ ingestionAttemptId }) => (ingestionAttemptId ? [ingestionAttemptId] : [])
  )
  const currentRuns =
    currentAttemptIds.length === 0
      ? []
      : await ctx.prisma.kBIngestionRun.findMany({
          where: { id: { in: currentAttemptIds } },
        })
  const currentRunsById = new Map(currentRuns.map((run) => [run.id, run]))
  const summary = summaryResources.reduce(
    (counts, resource) => {
      const currentRun = resource.ingestionAttemptId
        ? currentRunsById.get(resource.ingestionAttemptId)
        : undefined
      const state = getResourceReconciliationState(resource, currentRun)
      if (state === 'needs-ingestion') counts.needsIngestionCount += 1
      if (state === 'in-progress') counts.inProgressCount += 1
      if (
        resource.status === DB.KBResourceStatus.FAILED ||
        currentRun?.status === DB.KBIngestionStatus.FAILED
      ) {
        counts.failedIngestionCount += 1
      }
      return counts
    },
    {
      needsIngestionCount: 0,
      failedIngestionCount: 0,
      inProgressCount: 0,
    }
  )
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

  return {
    ...createPaginationResult(
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
    ),
    ...summary,
  }
}

export async function getKbImportedSourcesConnection(
  {
    kbId,
    first,
    after,
  }: {
    kbId: string
    first?: number | null
    after?: string | null
  },
  ctx: ContextWithUser,
  deps: KbSourceInventoryDeps = {}
): Promise<KBImportedSourceConnection> {
  await assertManageAiEnabled(ctx)
  await getOwnedKbOrThrow(ctx, kbId)
  const pageSize = normalizePageSize(first)
  const mcpServer = await getKbMcpServerOrThrow(ctx.prisma)

  try {
    const inventory = await fetchKbSourceInventory(
      {
        server: mcpServer,
        kbId,
        limit: pageSize,
        after,
      },
      deps
    )
    // A source is app-managed exactly when its recorded external resource id
    // belongs to this knowledge base; everything else was written into the
    // vector scope by an operator import. Only the ids on this page are looked
    // up, and only the UUID-shaped ones, so one bounded indexed read answers the
    // whole page without touching the import lane's non-UUID markers.
    const candidateResourceIds = inventory.items
      .map((item) => item.externalResourceId)
      .filter((value): value is string => value !== null && validateUuid(value))
    const resourceIds = new Set(
      candidateResourceIds.length === 0
        ? []
        : (
            await ctx.prisma.kBResource.findMany({
              where: { kbId, id: { in: candidateResourceIds } },
              select: { id: true },
            })
          ).map((resource) => resource.id)
    )
    return {
      items: inventory.items.map(
        ({ externalResourceId, ...item }): KBImportedSource => ({
          ...item,
          origin:
            externalResourceId !== null && resourceIds.has(externalResourceId)
              ? 'MANAGED'
              : 'IMPORTED',
        })
      ),
      pageInfo: {
        hasNextPage: inventory.nextCursor !== null,
        endCursor: inventory.nextCursor,
      },
      totalSourcesInScan: inventory.totalSourcesInScan,
      incomplete: inventory.incomplete,
      unidentifiedChunks: inventory.unidentifiedChunks,
    }
  } catch (error) {
    console.error('Failed to load imported KB sources', {
      kbId,
      error,
    })
    throw new GraphQLError('Imported sources could not be loaded')
  }
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
      status: true,
      knowledgeBases: {
        where: { isEnabled: true, kb: { deletedAt: null } },
        select: {
          kb: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return chatbots.map((chatbot) => ({
    chatbotId: chatbot.id,
    chatbotName: chatbot.name,
    chatbotStatus: chatbot.status,
    enabledKbs: chatbot.knowledgeBases.map(({ kb }) => kb),
    enabledKbId:
      chatbot.knowledgeBases.length === 1
        ? (chatbot.knowledgeBases[0]?.kb.id ?? null)
        : null,
    enabledKbName:
      chatbot.knowledgeBases.length === 1
        ? (chatbot.knowledgeBases[0]?.kb.name ?? null)
        : null,
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
          parameters: { required: true, toolAlias: 'doc_query', kb_id: kbId },
          priority: 0,
          isEnabled: true,
        },
        update: {
          allowedTools: ['doc_query'],
          parameters: { required: true, toolAlias: 'doc_query', kb_id: kbId },
          priority: 0,
          isEnabled: true,
        },
      })
    }

    const [chatbot, kb] = await Promise.all([
      prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbotId },
        select: { name: true, status: true },
      }),
      prisma.kB.findUniqueOrThrow({
        where: { id: kbId },
        select: { name: true },
      }),
    ])
    return {
      chatbotId,
      chatbotName: chatbot.name,
      chatbotStatus: chatbot.status,
      enabledKbId: kbId,
      enabledKbName: kb.name,
      enabledKbs: [{ id: kbId, name: kb.name }],
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
    domainPolicyId,
    domainPolicyVersion,
    domainPolicyLanguage,
  }: {
    name: string
    description?: string | null
    domainPolicyId?: string | null
    domainPolicyVersion?: number | null
    domainPolicyLanguage?: string | null
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new GraphQLError('KB name is required')
  }
  // A suggested subject and language reach the server only because the
  // lecturer accepted them, so an omitted selection stays absent rather than
  // being filled in here.
  const domain = await resolveRequestedKBGraphDomainSelection(
    {
      domainPolicyId,
      domainPolicyVersion,
      language: domainPolicyLanguage,
    },
    ctx
  )

  return ctx.prisma.kB.create({
    data: {
      name: normalizedName,
      description,
      ownerId: ctx.user.sub,
      domainPolicyId: domain?.domainPolicyId ?? null,
      domainPolicyVersion: domain?.domainPolicyVersion ?? null,
      domainPolicyLanguage: domain?.language ?? null,
    },
  })
}

/**
 * Owner-scoped edit of the settings a lecturer controls on a knowledge base.
 * An omitted argument leaves its field alone, so a caller that only renames the
 * knowledge base cannot drop its subject area. A graph build snapshots the
 * subject and language it ran with, so changing them here leaves every existing
 * build, published chatbot and generated question exactly as it was.
 */
export async function updateKb(
  {
    id,
    name,
    description,
    domainPolicyId,
    domainPolicyVersion,
    domainPolicyLanguage,
  }: {
    id: string
    name?: string | null
    description?: string | null
    domainPolicyId?: string | null
    domainPolicyVersion?: number | null
    domainPolicyLanguage?: string | null
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  const normalizedName = name === undefined ? undefined : (name ?? '').trim()
  if (normalizedName !== undefined && !normalizedName) {
    throw new GraphQLError('KB name is required')
  }
  // Reject an unsupported or half-specified selection before the row is locked.
  const domain = await resolveRequestedKBGraphDomainSelection(
    {
      domainPolicyId,
      domainPolicyVersion,
      language: domainPolicyLanguage,
    },
    ctx
  )

  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, id, ctx.user.sub)
    return prisma.kB.update({
      where: { id },
      data: {
        ...(normalizedName !== undefined ? { name: normalizedName } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(domain
          ? {
              domainPolicyId: domain.domainPolicyId,
              domainPolicyVersion: domain.domainPolicyVersion,
              domainPolicyLanguage: domain.language,
            }
          : {}),
      },
    })
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
  await assertKbIngestionEnabled(ctx)
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

async function getReplaceableKbResourceOrThrow(
  prisma: DB.Prisma.TransactionClient,
  {
    kbId,
    resourceId,
    ownerId,
  }: { kbId: string; resourceId: string; ownerId: string }
) {
  await lockOwnedKbOrThrow(prisma, kbId, ownerId)
  const resource = await prisma.kBResource.findFirst({
    where: {
      id: resourceId,
      kbId,
      deletedAt: null,
      kb: { ownerId, deletedAt: null },
    },
  })
  if (!resource) {
    throw new GraphQLError('KB resource not found')
  }
  if (resource.type !== DB.KBResourceType.BLOB) {
    throw new GraphQLError('KB resource is not a file')
  }
  if (
    resource.status === DB.KBResourceStatus.QUEUED ||
    resource.status === DB.KBResourceStatus.PROCESSING
  ) {
    throw new GraphQLError('KB resource cannot be replaced', {
      extensions: { code: 'KB_RESOURCE_ACTIVE' },
    })
  }
  if (resource.resourceVersion >= 2_147_483_647) {
    throw new GraphQLError('KB resource version limit reached')
  }
  return resource
}

export async function confirmKbFileUpload(
  {
    kbId,
    blobName,
    title,
    originalFilename,
    mimeType,
    sizeBytes,
    materialType,
  }: {
    kbId: string
    blobName: string
    title: string
    originalFilename: string
    mimeType: string
    sizeBytes: number
    materialType?: DB.KBResourceMaterialType | null
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

  // Only genuinely new content is subject to the ingestion rollout. The
  // repeated-confirmation return above stays reachable with the rollout
  // closed so that a client retrying a call that already succeeded is
  // answered with its resource instead of a refusal for work it is not
  // asking to start.
  await assertKbIngestionEnabled(ctx)

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

  const ingestionAttemptId = randomUUID()
  const result = await ctx.prisma.$transaction(async (prisma) => {
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
      return { resource: racedResource, payload: null }
    }

    const ticket = await prisma.kBUploadTicket.findFirst({
      where: {
        id: blobId,
        kbId,
        blobName,
        replacementResourceId: null,
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
        materialType: normalizeKbResourceMaterialType(materialType),
        title: normalizedTitle,
        originalFilename,
        mimeType: validated.contentType,
        sizeBytes,
        blobName,
        blobHref: `${accountUrl}/${containerClient.containerName}/${blobName}`,
        status: DB.KBResourceStatus.QUEUED,
        ingestionAttemptId,
        resourceVersion: 1,
        ingestionOperation: DB.KBIngestionOperation.UPSERT,
      },
    })
    await prisma.kBIngestionRun.create({
      data: {
        id: ingestionAttemptId,
        resourceId: resource.id,
        operation: DB.KBIngestionOperation.UPSERT,
        resourceVersion: 1,
      },
    })
    await prisma.kBUploadTicket.delete({ where: { id: ticket.id } })
    return {
      resource,
      payload: buildKbIngestionPayload(
        resource,
        ingestionAttemptId,
        1,
        ctx.user.sub
      ),
    }
  })

  if (result.payload) {
    try {
      await ctx.tasks.ingestKBResource.runNoWait(result.payload)
    } catch {
      await markKbIngestionQueueFailure(
        ctx,
        result.resource.id,
        ingestionAttemptId
      )
      throw new GraphQLError('KB ingestion could not be queued', {
        extensions: { code: 'KB_INGESTION_QUEUE_FAILED' },
      })
    }
  }

  return result.resource
}

export async function requestKbFileReplacement(
  {
    kbId,
    resourceId,
    fileName,
    contentType,
    sizeBytes,
  }: {
    kbId: string
    resourceId: string
    fileName: string
    contentType: string
    sizeBytes: number
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  await assertKbIngestionEnabled(ctx)
  const validated = validateKbFile({ fileName, contentType, sizeBytes })
  const { accountUrl, containerClient, credential } = getKbBlobContainer(
    ctx.user.sub
  )
  await containerClient.createIfNotExists()

  const blobId = randomUUID()
  const blobName = `${blobId}.${validated.extension}`
  const expiresOn = new Date(Date.now() + 15 * 60 * 1000)
  await ctx.prisma.$transaction(async (prisma) => {
    const resource = await getReplaceableKbResourceOrThrow(prisma, {
      kbId,
      resourceId,
      ownerId: ctx.user.sub,
    })
    await assertKbQuotaAvailable(prisma, { kbId, sizeBytes })
    await prisma.kBUploadTicket.create({
      data: {
        id: blobId,
        kbId,
        blobName,
        sizeBytes,
        expiresAt: expiresOn,
        replacementResourceId: resource.id,
        expectedResourceVersion: resource.resourceVersion,
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

export async function confirmKbFileReplacement(
  {
    kbId,
    resourceId,
    blobName,
    originalFilename,
    mimeType,
    sizeBytes,
  }: {
    kbId: string
    resourceId: string
    blobName: string
    originalFilename: string
    mimeType: string
    sizeBytes: number
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  await assertKbIngestionEnabled(ctx)
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

  const confirmedReplacement = await ctx.prisma.kBResource.findFirst({
    where: {
      id: resourceId,
      kbId,
      blobName,
      deletedAt: null,
      kb: { ownerId: ctx.user.sub, deletedAt: null },
    },
  })
  if (confirmedReplacement) {
    assertMatchingConfirmedBlob(confirmedReplacement, {
      kbId,
      blobName,
      title: confirmedReplacement.title,
      originalFilename,
      mimeType: validated.contentType,
      sizeBytes,
    })
    return confirmedReplacement
  }

  const ticket = await ctx.prisma.kBUploadTicket.findFirst({
    where: {
      id: blobId,
      kbId,
      blobName,
      replacementResourceId: resourceId,
      expiresAt: { gt: new Date() },
      kb: { ownerId: ctx.user.sub, deletedAt: null },
    },
    select: { id: true },
  })
  if (!ticket) {
    throw new GraphQLError('KB upload ticket is invalid', {
      extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
    })
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

  const ingestionAttemptId = randomUUID()
  const result = await ctx.prisma.$transaction(async (prisma) => {
    const resource = await getReplaceableKbResourceOrThrow(prisma, {
      kbId,
      resourceId,
      ownerId: ctx.user.sub,
    })

    const currentTicket = await prisma.kBUploadTicket.findFirst({
      where: {
        id: blobId,
        kbId,
        blobName,
        replacementResourceId: resource.id,
        expectedResourceVersion: resource.resourceVersion,
        expiresAt: { gt: new Date() },
      },
    })
    if (!currentTicket || currentTicket.sizeBytes !== sizeBytes) {
      throw new GraphQLError('KB upload ticket is invalid', {
        extensions: { code: 'KB_UPLOAD_TICKET_MISMATCH' },
      })
    }

    const resourceVersion = resource.resourceVersion + 1
    const claim = await prisma.kBResource.updateMany({
      where: {
        id: resource.id,
        status: resource.status,
        ingestionAttemptId: resource.ingestionAttemptId,
        resourceVersion: resource.resourceVersion,
        deletedAt: null,
      },
      data: {
        blobName,
        blobHref: `${accountUrl}/${containerClient.containerName}/${blobName}`,
        originalFilename,
        mimeType: validated.contentType,
        sizeBytes,
        status: DB.KBResourceStatus.QUEUED,
        statusMessage: null,
        errorCode: null,
        ingestionOperation: DB.KBIngestionOperation.UPSERT,
        ingestionAttemptId,
        resourceVersion,
        contentSha256: null,
        externalOperationId: null,
        externalOperationStartedAt: null,
      },
    })
    if (claim.count !== 1) {
      throw new GraphQLError('KB resource cannot be replaced')
    }

    await prisma.kBIngestionRun.create({
      data: {
        id: ingestionAttemptId,
        resourceId: resource.id,
        operation: DB.KBIngestionOperation.UPSERT,
        resourceVersion,
      },
    })
    await prisma.kBUploadTicket.delete({ where: { id: currentTicket.id } })

    const updated = await prisma.kBResource.findUniqueOrThrow({
      where: { id: resource.id },
    })
    return {
      resource: updated,
      payload: buildKbIngestionPayload(
        updated,
        ingestionAttemptId,
        resourceVersion,
        ctx.user.sub
      ),
      previousBlobName: resource.blobName,
    }
  })

  let queueFailed = false
  try {
    await ctx.tasks.ingestKBResource.runNoWait(result.payload)
  } catch {
    await markKbIngestionQueueFailure(
      ctx,
      result.resource.id,
      ingestionAttemptId
    )
    queueFailed = true
  }

  if (result.previousBlobName && result.previousBlobName !== blobName) {
    try {
      await containerClient
        .getBlobClient(result.previousBlobName)
        .deleteIfExists()
    } catch {
      // Blob cleanup is best-effort. The canonical replacement and its
      // ingestion state must remain committed when storage cleanup fails.
    }
  }

  if (queueFailed) {
    throw new GraphQLError('KB ingestion could not be queued', {
      extensions: { code: 'KB_INGESTION_QUEUE_FAILED' },
    })
  }

  return result.resource
}

export async function createKbUrlResource(
  {
    kbId,
    url,
    title,
    materialType,
  }: {
    kbId: string
    url: string
    title: string
    materialType?: DB.KBResourceMaterialType | null
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  await assertKbIngestionEnabled(ctx)
  await getOwnedKbOrThrow(ctx, kbId)

  let sourceUrl: string
  try {
    sourceUrl = normalizePublicHttpUrl(url)
  } catch {
    throw new GraphQLError('KB resource URL is invalid')
  }

  const ingestionAttemptId = randomUUID()
  const result = await ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
    await assertKbQuotaAvailable(prisma, {
      kbId,
      resourceCount: 1,
      sizeBytes: MAX_KB_FILE_SIZE_BYTES,
    })
    const resource = await prisma.kBResource.create({
      data: {
        kbId,
        type: DB.KBResourceType.URL,
        materialType: normalizeKbResourceMaterialType(materialType),
        title: validateKbResourceTitle(title),
        sourceUrl,
        status: DB.KBResourceStatus.QUEUED,
        ingestionAttemptId,
        resourceVersion: 1,
        ingestionOperation: DB.KBIngestionOperation.UPSERT,
      },
    })
    await prisma.kBIngestionRun.create({
      data: {
        id: ingestionAttemptId,
        resourceId: resource.id,
        operation: DB.KBIngestionOperation.UPSERT,
        resourceVersion: 1,
      },
    })
    return {
      resource,
      payload: buildKbIngestionPayload(
        resource,
        ingestionAttemptId,
        1,
        ctx.user.sub
      ),
    }
  })

  try {
    await ctx.tasks.ingestKBResource.runNoWait(result.payload)
  } catch {
    await markKbIngestionQueueFailure(
      ctx,
      result.resource.id,
      ingestionAttemptId
    )
    throw new GraphQLError('KB ingestion could not be queued', {
      extensions: { code: 'KB_INGESTION_QUEUE_FAILED' },
    })
  }

  return result.resource
}

export async function updateKbResourceMaterialType(
  {
    id,
    materialType,
  }: {
    id: string
    materialType: DB.KBResourceMaterialType
  },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedKbResourceOrThrow(prisma, id, ctx.user.sub)
    return prisma.kBResource.update({
      where: { id },
      data: { materialType },
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

function buildKbIngestionPayload(
  resource: DB.KBResource,
  ingestionAttemptId: string,
  resourceVersion: number,
  ownerId: string
): IngestKBResourceInput {
  const basePayload = {
    resourceId: resource.id,
    kbId: resource.kbId,
    title: resource.title,
    ingestionAttemptId,
    resourceVersion,
  }
  if (resource.type === DB.KBResourceType.BLOB) {
    if (
      !resource.blobName ||
      !resource.mimeType ||
      resource.sizeBytes === null
    ) {
      throw new GraphQLError('KB blob metadata is invalid')
    }
    return {
      ...basePayload,
      type: DB.KBResourceType.BLOB,
      blobName: resource.blobName,
      containerName: getKbContainerName(ownerId),
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
    }
  }
  if (!resource.sourceUrl) {
    throw new GraphQLError('KB resource URL is invalid')
  }
  return {
    ...basePayload,
    type: DB.KBResourceType.URL,
    sourceUrl: resource.sourceUrl,
  }
}

async function markKbIngestionQueueFailure(
  ctx: ContextWithUser,
  resourceId: string,
  ingestionAttemptId: string
) {
  const finishedAt = new Date()
  await ctx.prisma.$transaction(async (prisma) => {
    const failed = await prisma.kBResource.updateMany({
      where: {
        id: resourceId,
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
      await prisma.kBIngestionRun.updateMany({
        where: {
          id: ingestionAttemptId,
          resourceId,
          status: DB.KBIngestionStatus.QUEUED,
        },
        data: {
          status: DB.KBIngestionStatus.FAILED,
          statusMessage: 'The ingestion operation could not be queued.',
          errorCode: 'QUEUE_DISPATCH_FAILED',
          finishedAt,
        },
      })
    }
  })
}

export async function ingestKbResource(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  await assertManageAiEnabled(ctx)
  await assertKbIngestionEnabled(ctx)
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
  const payload = buildKbIngestionPayload(
    resource,
    ingestionAttemptId,
    resourceVersion,
    ctx.user.sub
  )

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
    await markKbIngestionQueueFailure(ctx, resource.id, ingestionAttemptId)
    throw new GraphQLError('KB ingestion could not be queued')
  }

  return ctx.prisma.kBResource.findUniqueOrThrow({
    where: { id: resource.id },
  })
}

type QueuedKbIngestion = {
  payload: IngestKBResourceInput
  resourceId: string
  ingestionAttemptId: string
  retriedFailed: boolean
}

export async function ingestAllKbResources(
  { kbId }: { kbId: string },
  ctx: ContextWithUser
): Promise<KBIngestAllResult> {
  await assertManageAiEnabled(ctx)
  await assertKbIngestionEnabled(ctx)
  await getOwnedKbOrThrow(ctx, kbId)

  const { queued, alreadyCurrentCount, alreadyInProgressCount } =
    await ctx.prisma.$transaction(async (prisma) => {
      await lockOwnedKbOrThrow(prisma, kbId, ctx.user.sub)
      const resources = await prisma.kBResource.findMany({
        where: { kbId, deletedAt: null },
        orderBy: { id: 'asc' },
      })
      const currentAttemptIds = resources.flatMap(({ ingestionAttemptId }) =>
        ingestionAttemptId ? [ingestionAttemptId] : []
      )
      const currentRuns =
        currentAttemptIds.length === 0
          ? []
          : await prisma.kBIngestionRun.findMany({
              where: { id: { in: currentAttemptIds } },
              select: { id: true, status: true },
            })
      const currentRunsById = new Map(currentRuns.map((run) => [run.id, run]))
      const queued: QueuedKbIngestion[] = []
      let alreadyCurrentCount = 0
      let alreadyInProgressCount = 0

      for (const resource of resources) {
        const currentRun = resource.ingestionAttemptId
          ? currentRunsById.get(resource.ingestionAttemptId)
          : undefined
        const state = getResourceReconciliationState(resource, currentRun)
        if (state === 'current') {
          alreadyCurrentCount += 1
          continue
        }
        if (state === 'in-progress') {
          alreadyInProgressCount += 1
          continue
        }
        if (resource.resourceVersion >= 2_147_483_647) {
          throw new GraphQLError('KB resource version limit reached')
        }

        const ingestionAttemptId = randomUUID()
        const resourceVersion = resource.resourceVersion + 1
        const claim = await prisma.kBResource.updateMany({
          where: {
            id: resource.id,
            status: resource.status,
            ingestionAttemptId: resource.ingestionAttemptId,
            resourceVersion: resource.resourceVersion,
            deletedAt: null,
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
          const claimedResource = await prisma.kBResource.findFirst({
            where: { id: resource.id, kbId, deletedAt: null },
          })
          if (!claimedResource) {
            throw new GraphQLError('KB resource changed during ingestion')
          }
          const claimedRun = claimedResource.ingestionAttemptId
            ? await prisma.kBIngestionRun.findUnique({
                where: { id: claimedResource.ingestionAttemptId },
                select: { status: true },
              })
            : undefined
          const claimedState = getResourceReconciliationState(
            claimedResource,
            claimedRun ?? undefined
          )
          if (claimedState === 'current') {
            alreadyCurrentCount += 1
            continue
          }
          if (claimedState === 'in-progress') {
            alreadyInProgressCount += 1
            continue
          }
          throw new GraphQLError('KB resource changed during ingestion')
        }

        await prisma.kBIngestionRun.create({
          data: {
            id: ingestionAttemptId,
            resourceId: resource.id,
            operation: DB.KBIngestionOperation.UPSERT,
            resourceVersion,
          },
        })
        queued.push({
          payload: buildKbIngestionPayload(
            resource,
            ingestionAttemptId,
            resourceVersion,
            ctx.user.sub
          ),
          resourceId: resource.id,
          ingestionAttemptId,
          retriedFailed: resource.status === DB.KBResourceStatus.FAILED,
        })
      }

      return { queued, alreadyCurrentCount, alreadyInProgressCount }
    })

  let queuedCount = 0
  let retriedFailedCount = 0
  let queueFailureCount = 0
  for (
    let index = 0;
    index < queued.length;
    index += KB_BULK_INGEST_DISPATCH_CONCURRENCY
  ) {
    const batch = queued.slice(
      index,
      index + KB_BULK_INGEST_DISPATCH_CONCURRENCY
    )
    await Promise.all(
      batch.map(
        async ({ payload, resourceId, ingestionAttemptId, retriedFailed }) => {
          try {
            await ctx.tasks.ingestKBResource.runNoWait(payload)
            queuedCount += 1
            if (retriedFailed) retriedFailedCount += 1
          } catch {
            queueFailureCount += 1
            await markKbIngestionQueueFailure(
              ctx,
              resourceId,
              ingestionAttemptId
            )
          }
        }
      )
    )
  }

  return {
    queuedCount,
    retriedFailedCount,
    alreadyCurrentCount,
    alreadyInProgressCount,
    queueFailureCount,
  }
}

export interface KBKnowledgeGraphConfig {
  kbId: string
  isEnabled: boolean
  buildId: string | null
  status: DB.KBGraphBuildStatus | null
  statusMessage: string | null
  qualityTier: DB.KBGraphQualityTier | null
  /** Frozen domain selection of the reported build; null is the legacy policy. */
  domainPolicyId: string | null
  domainPolicyVersion: number | null
  domainPolicyLanguage: string | null
  /** Lecturer focus recorded on the reported build; null means no focus. */
  focusTopic: string | null
  /** Domain selection frozen on the currently published build, when it has one. */
  publishedDomainPolicyId: string | null
  publishedDomainPolicyVersion: number | null
  publishedDomainPolicyLanguage: string | null
  /** Categories of the selected policy, so the panel never restates catalog prose. */
  domainCategories: KBGraphDomainCategory[] | null
  sourceContentDigest: string | null
  activeBuildId: string | null
  publishedBuildId: string | null
  elementGenerationReady: boolean
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
  domainPolicyId: true,
  domainPolicyVersion: true,
  domainPolicyLanguage: true,
  focusTopic: true,
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

export interface KbGraphDomainConfigLanguage {
  language: string
  categories: KBGraphDomainCategory[]
}

export interface KbGraphDomainConfigOption {
  id: string
  version: number
  labelKey: string
  languages: KbGraphDomainConfigLanguage[]
}

export interface KbGraphDomainConfig {
  capabilityEnabled: boolean
  catalogRevision: string | null
  catalogDigest: string | null
  options: KbGraphDomainConfigOption[]
}

type KBGraphDomainPersistedFields = {
  domainPolicyId?: string | null
  domainPolicyVersion?: number | null
  domainPolicyLanguage?: string | null
} | null

/**
 * Categories of a persisted explicit domain selection, resolved through the
 * shipped catalog. A legacy all-null build has no explicit selection, and a
 * selection the current catalog no longer describes returns null rather than
 * inventing category labels.
 */
function resolvePersistedKBGraphDomainCategories(
  build: KBGraphDomainPersistedFields
): KBGraphDomainCategory[] | null {
  if (!build) {
    return null
  }
  const catalog = getDefaultKBGraphDomainCatalog()
  const resolution = resolveKBGraphDomainSelection(
    {
      domainPolicyId: build.domainPolicyId ?? null,
      domainPolicyVersion: build.domainPolicyVersion ?? null,
      language: build.domainPolicyLanguage ?? null,
    },
    { catalog, capabilityEnabled: true }
  )
  return resolution.ok ? (resolution.selection?.categories ?? null) : null
}

/**
 * Explicit domain selection and the graph build focus share one admission
 * decision: the deployment must declare the catalog revision its provider
 * pipeline supports, and the actor's rollout must admit the request. The
 * rollout narrows that contract and never widens it, so no flag can offer a
 * selection the shipped catalog does not cover.
 */
async function isKBGraphDomainSelectionAdmitted(
  ctx: ContextWithUser
): Promise<boolean> {
  const catalog = getDefaultKBGraphDomainCatalog()
  return (
    isKBGraphDomainCapabilityEnabled(catalog.revision, process.env) &&
    (await isFeatureFlagEnabled(ctx, 'kb-graph-domain-selection'))
  )
}

/**
 * Domain-selection capability handshake for the lecturer panel. Category prose
 * is only advertised while the configured catalog revision matches the shipped
 * export and the requesting actor's rollout admits explicit selection, so the
 * client never offers a selection this deployment or this actor would reject.
 */
export async function getKbKnowledgeGraphDomainConfig(
  { kbId }: { kbId?: string | null },
  ctx: ContextWithUser
): Promise<KbGraphDomainConfig> {
  await assertManageAiEnabled(ctx)
  // Knowledge-base creation offers the same subjects before a knowledge base
  // exists, so an omitted id asks what this deployment supports at all rather
  // than what one knowledge base may use.
  if (kbId) {
    await getOwnedKbOrThrow(ctx, kbId)
  }
  const catalog = getDefaultKBGraphDomainCatalog()
  const capabilityEnabled = await isKBGraphDomainSelectionAdmitted(ctx)
  return {
    capabilityEnabled,
    catalogRevision: catalog.revision,
    catalogDigest: catalog.digest,
    options: capabilityEnabled
      ? catalog.policies.map((policy) => ({
          id: policy.id,
          version: policy.version,
          labelKey: policy.labelKey,
          languages: policy.languages.map((language) => ({
            language: language.language,
            categories: language.categories,
          })),
        }))
      : [],
  }
}

function kbGraphDomainRejectionMessage(
  reason: KBGraphDomainSelectionRejectionReason
): string {
  switch (reason) {
    case 'INCOMPLETE':
      return 'A domain selection requires a policy, a positive version, and a language.'
    case 'CAPABILITY_DISABLED':
      return 'This deployment does not support explicit domain selection.'
    case 'UNKNOWN_POLICY':
      return 'The requested domain policy is not part of this deployment catalog.'
    case 'UNSUPPORTED_VERSION':
      return 'The requested domain policy version is not supported.'
    case 'UNSUPPORTED_LANGUAGE':
      return 'The requested domain language is not provided by this policy.'
  }
}

/**
 * Resolves a lecturer-supplied domain selection, rejecting anything the catalog
 * or the capability gate does not support before any cost reservation is made.
 * An entirely omitted request is the legacy path and resolves to null.
 */
async function resolveRequestedKBGraphDomainSelection(
  request: KBGraphDomainSelectionRequest,
  ctx: ContextWithUser
): Promise<KBGraphDomainSelection | null> {
  const catalog = getDefaultKBGraphDomainCatalog()
  const capabilityEnabled = await isKBGraphDomainSelectionAdmitted(ctx)
  const resolution = resolveKBGraphDomainSelection(request, {
    catalog,
    capabilityEnabled,
  })
  if (!resolution.ok) {
    throw new GraphQLError(kbGraphDomainRejectionMessage(resolution.reason), {
      extensions: { code: KB_GRAPH_DOMAIN_ERROR_CODES[resolution.reason] },
    })
  }
  return resolution.selection
}

/**
 * Resolves the selection a build runs with from the knowledge base itself. The
 * knowledge base owns the choice, so a build never carries one in its request:
 * every caller, including the batch scheduler, reads the same stored columns.
 *
 * A stored pair this deployment cannot honor falls back to the provider default
 * instead of refusing the build. The capability gate means "the catalog shipped
 * here is the one this pair was chosen against", so a deployment that ships a
 * different catalog cannot honor the pair and has nothing better to offer than
 * the default the graph provider already applies. Refusing instead would leave
 * a lecturer with a graph they can neither rebuild nor reconfigure, because the
 * same closed gate also hides the controls that would replace the pair.
 */
function resolveStoredKBGraphDomainSelection(
  kb: {
    domainPolicyId: string | null
    domainPolicyVersion: number | null
    domainPolicyLanguage: string | null
  },
  options: { capabilityEnabled: boolean }
): KBGraphDomainSelection | null {
  const resolution = resolveKBGraphDomainSelection(
    {
      domainPolicyId: kb.domainPolicyId,
      domainPolicyVersion: kb.domainPolicyVersion,
      language: kb.domainPolicyLanguage,
    },
    {
      catalog: getDefaultKBGraphDomainCatalog(),
      capabilityEnabled: options.capabilityEnabled,
    }
  )
  return resolution.ok ? resolution.selection : null
}

/**
 * Normalizes a lecturer-supplied build focus. The focus is prompt guidance, so
 * a blank value is the same as no focus. It rides the same provider contract as
 * the explicit domain selection, so a deployment or actor this rollout does not
 * admit refuses one it cannot honor instead of recording guidance that is
 * dropped later.
 */
async function resolveRequestedKBGraphFocusTopic(
  focusTopic: string | null | undefined,
  ctx: ContextWithUser
): Promise<string | null> {
  const normalized = focusTopic?.trim()
  if (!normalized) {
    return null
  }
  if (normalized.length > KB_GRAPH_FOCUS_TOPIC_MAX_LENGTH) {
    throw new GraphQLError(
      `A graph build focus may contain at most ${KB_GRAPH_FOCUS_TOPIC_MAX_LENGTH} characters.`,
      { extensions: { code: 'KB_GRAPH_FOCUS_TOPIC_TOO_LONG' } }
    )
  }
  if (!(await isKBGraphDomainSelectionAdmitted(ctx))) {
    throw new GraphQLError(
      'This deployment does not support a graph build focus.',
      { extensions: { code: KB_GRAPH_DOMAIN_ERROR_CODES.CAPABILITY_DISABLED } }
    )
  }
  return normalized
}

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
    domainPolicyId?: string | null
    domainPolicyVersion?: number | null
    domainPolicyLanguage?: string | null
    focusTopic?: string | null
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
  costConfiguration: ReturnType<typeof getKBGraphCostConfiguration>,
  elementGenerationReady: boolean,
  publishedDomain?: {
    domainPolicyId: string | null
    domainPolicyVersion: number | null
    domainPolicyLanguage: string | null
  } | null
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
    domainPolicyId: build?.domainPolicyId ?? null,
    domainPolicyVersion: build?.domainPolicyVersion ?? null,
    domainPolicyLanguage: build?.domainPolicyLanguage ?? null,
    focusTopic: build?.focusTopic ?? null,
    publishedDomainPolicyId: publishedDomain?.domainPolicyId ?? null,
    publishedDomainPolicyVersion: publishedDomain?.domainPolicyVersion ?? null,
    publishedDomainPolicyLanguage:
      publishedDomain?.domainPolicyLanguage ?? null,
    domainCategories: resolvePersistedKBGraphDomainCategories(build),
    sourceContentDigest: build?.sourceContentDigest ?? null,
    activeBuildId: kb.activeGraphBuildId,
    publishedBuildId: kb.publishedGraphBuildId,
    elementGenerationReady,
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
          select: {
            sourceContentDigest: true,
            domainPolicyId: true,
            domainPolicyVersion: true,
            domainPolicyLanguage: true,
            status: true,
            graphBundleContainerName: true,
            graphBundleBlobPrefix: true,
            graphBundleStorageName: true,
            graphBundleSha256: true,
            graphSha256: true,
            graphManifestSchemaVersion: true,
            graphManifestArtifact: true,
          },
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
  return getKBGraphBuildConfig(
    kb,
    build,
    isStale,
    quota,
    costConfiguration,
    isElementGenerationGraphBundleReady(publishedBuild),
    publishedBuild
  )
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
    await assertKbGraphGenerationEnabled(ctx)
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

/**
 * Quality tier of automatic graph preparation. Scheduled builds always use it;
 * the higher tier and provider tuning stay an explicit interactive choice.
 */
export const KB_GRAPH_PREPARATION_QUALITY_TIER = DB.KBGraphQualityTier.STANDARD

/**
 * Everything a graph build represents: the frozen domain triple, the quality
 * tier and the source-only `sourceContentDigest`. The domain triple is the
 * selection a build would actually freeze, so a deployment or rollout that
 * cannot honor the stored KB choice yields the legacy all-null triple.
 */
export interface KBGraphPreparationIdentity {
  domainPolicyId: string | null
  domainPolicyVersion: number | null
  domainPolicyLanguage: string | null
  qualityTier: DB.KBGraphQualityTier
  sourceContentDigest: string
}

/**
 * Stable identity of a desired or published preparation. It extends the
 * source-only digest with the settings that change what a build produces, so
 * a language change alone produces a different fingerprint.
 */
export function getKBGraphPreparationFingerprint(
  identity: KBGraphPreparationIdentity
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'kb-graph-preparation/v1',
        identity.sourceContentDigest,
        identity.domainPolicyId,
        identity.domainPolicyVersion,
        identity.domainPolicyLanguage,
        identity.qualityTier,
      ])
    )
    .digest('hex')
}

export type KBGraphPreparationPendingReason =
  | 'NO_PUBLISHED_GRAPH'
  | 'SETTINGS_CHANGED'
  | 'SOURCES_CHANGED'

/**
 * Timing policy of scheduled preparation. The quiet period coalesces bursts of
 * changes, the maximum deferral bounds how long continuous changes can keep
 * postponing a pending preparation, and the backoff spaces failed attempts.
 */
export interface KBGraphPreparationTiming {
  now: Date
  /** Latest serving-source or settings change. */
  lastChangeAt: Date | null
  quietPeriodMs: number
  /** When the currently unmet preparation first became pending. */
  pendingSinceAt: Date | null
  maxDeferralMs: number
  lastFailedAt: Date | null
  backoffMs: number
}

export interface KBGraphPreparationStatus {
  /** The published graph does not represent the desired preparation. */
  pending: boolean
  /** Pending, and the timing policy (when supplied) admits a build now. */
  due: boolean
  reason: KBGraphPreparationPendingReason | null
  desiredFingerprint: string
  /** Earliest time a pending preparation becomes due; null when due or current. */
  deferredUntil: Date | null
}

/**
 * The due check shared by build admission and generation readiness. A
 * preparation is pending when no graph is published, when the published build
 * froze a different domain, language or tier than the KB now asks for, or when
 * the serving sources moved on. Without a timing policy a pending preparation
 * is due immediately.
 */
export function getKBGraphPreparationStatus({
  desired,
  published,
  timing,
}: {
  desired: KBGraphPreparationIdentity
  published: KBGraphPreparationIdentity | null
  timing?: KBGraphPreparationTiming
}): KBGraphPreparationStatus {
  const desiredFingerprint = getKBGraphPreparationFingerprint(desired)
  let reason: KBGraphPreparationPendingReason | null = null
  if (!published) {
    reason = 'NO_PUBLISHED_GRAPH'
  } else if (
    published.domainPolicyId !== desired.domainPolicyId ||
    published.domainPolicyVersion !== desired.domainPolicyVersion ||
    published.domainPolicyLanguage !== desired.domainPolicyLanguage ||
    published.qualityTier !== desired.qualityTier
  ) {
    reason = 'SETTINGS_CHANGED'
  } else if (published.sourceContentDigest !== desired.sourceContentDigest) {
    reason = 'SOURCES_CHANGED'
  }

  if (reason === null) {
    return {
      pending: false,
      due: false,
      reason,
      desiredFingerprint,
      deferredUntil: null,
    }
  }
  if (!timing) {
    return {
      pending: true,
      due: true,
      reason,
      desiredFingerprint,
      deferredUntil: null,
    }
  }

  const now = timing.now.getTime()
  const waits: number[] = []
  const deferralExhausted =
    timing.pendingSinceAt !== null &&
    timing.pendingSinceAt.getTime() + timing.maxDeferralMs <= now
  if (timing.lastChangeAt && !deferralExhausted) {
    waits.push(timing.lastChangeAt.getTime() + timing.quietPeriodMs)
  }
  // The age bound only overrides the quiet period; a failed attempt always
  // waits out its backoff so a failing build is never retried in a loop.
  if (timing.lastFailedAt) {
    waits.push(timing.lastFailedAt.getTime() + timing.backoffMs)
  }
  const readyAt = Math.max(now, ...waits)
  return {
    pending: true,
    due: readyAt <= now,
    reason,
    desiredFingerprint,
    deferredUntil: readyAt <= now ? null : new Date(readyAt),
  }
}

export type KBQuestionPreparationState =
  | 'WAITING_FOR_MATERIALS'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'DELAYED'
  | 'NEEDS_ATTENTION'
  | 'UNAVAILABLE'
  | 'NO_ELIGIBLE_MATERIALS'

export interface KBQuestionPreparationInput {
  /**
   * AI entitlement, `kb-graph-builds`, the per-KB opt-in and the cost
   * configuration all admit a new build for the owner.
   */
  buildAdmitted: boolean
  /** Scheduled preparation admits this KB, so no lecturer action is needed. */
  automaticPreparationAdmitted: boolean
  /** Course-content resources only; administrative material never counts. */
  courseContent: { serving: number; processing: number; failed: number }
  /**
   * Build holding the KB's single slot while it is still queued or running,
   * the same filter build admission applies; any other slot holder is null.
   */
  activeBuild: {
    status:
      | typeof DB.KBGraphBuildStatus.QUEUED
      | typeof DB.KBGraphBuildStatus.PROCESSING
  } | null
  /** The published build carries a bundle question generation can use. */
  publishedGraphReady: boolean
  preparation: Pick<KBGraphPreparationStatus, 'pending' | 'reason'>
  /** Start of the currently unmet preparation, kept through retries. */
  pendingSinceAt: Date | null
  now: Date
  delayedAfterMs: number
}

export interface KBQuestionPreparation {
  state: KBQuestionPreparationState
  pendingReason: KBGraphPreparationPendingReason | null
}

/**
 * Generation readiness of a KB, derived from the resource and build ledgers
 * rather than persisted. Queued or processing is reported only while a build
 * holds the slot or scheduled preparation will admit one, and a preparation
 * pending longer than the delay window reports delayed instead.
 */
export function deriveKBQuestionPreparation(
  input: KBQuestionPreparationInput
): KBQuestionPreparation {
  const pendingReason = input.preparation.pending
    ? input.preparation.reason
    : null
  const result = (state: KBQuestionPreparationState) => ({
    state,
    pendingReason,
  })
  const isOverdue =
    input.pendingSinceAt !== null &&
    input.now.getTime() - input.pendingSinceAt.getTime() > input.delayedAfterMs
  const inFlight = (state: 'QUEUED' | 'PROCESSING') =>
    result(isOverdue ? 'DELAYED' : state)

  // An accepted build keeps running when admission later closes.
  if (input.activeBuild) {
    return inFlight(
      input.activeBuild.status === DB.KBGraphBuildStatus.QUEUED
        ? 'QUEUED'
        : 'PROCESSING'
    )
  }

  const { serving, processing, failed } = input.courseContent
  if (serving + processing + failed === 0) {
    return result('NO_ELIGIBLE_MATERIALS')
  }
  if (!input.preparation.pending) {
    // A current graph without a usable bundle cannot be repaired by waiting.
    return result(input.publishedGraphReady ? 'READY' : 'NEEDS_ATTENTION')
  }
  if (!input.buildAdmitted || !input.automaticPreparationAdmitted) {
    return result('UNAVAILABLE')
  }
  if (serving === 0) {
    return result(
      processing === 0 ? 'NEEDS_ATTENTION' : 'WAITING_FOR_MATERIALS'
    )
  }
  return inFlight('QUEUED')
}

/**
 * Who starts a graph build. An interactive trigger acts as the signed-in
 * lecturer and may choose the tier and focus. A system trigger is a trusted
 * scheduler acting for the KB owner named explicitly; it carries no session,
 * always uses the fixed preparation recipe, and passes the owner's own
 * entitlement and rollout.
 */
export type KBGraphBuildTrigger =
  | {
      kind: 'user'
      ctx: ContextWithUser
      qualityTier?: DB.KBGraphQualityTier | null
      focusTopic?: string | null
    }
  | { kind: 'system'; ownerId: string }

export type KBGraphBuildServiceContext = Pick<
  Context,
  'prisma' | 'tasks' | 'featureFlags'
>

type KBGraphBuildAdmission = {
  ownerId: string
  qualityTier: DB.KBGraphQualityTier
  focusTopic: string | null
  domainCapabilityEnabled: boolean
}

/**
 * Admission decided before the KB lock is taken, so no lock is held across a
 * feature-flag lookup: AI entitlement, then `kb-graph-builds`, then the
 * domain-selection capability and focus the build may use.
 */
async function admitKBGraphBuildTrigger(
  trigger: KBGraphBuildTrigger,
  deps: KBGraphBuildServiceContext
): Promise<KBGraphBuildAdmission> {
  if (trigger.kind === 'user') {
    const { ctx } = trigger
    await assertManageAiEnabled(ctx)
    await assertKbGraphGenerationEnabled(ctx)
    const domainCapabilityEnabled = await isKBGraphDomainSelectionAdmitted(ctx)
    const focusTopic = await resolveRequestedKBGraphFocusTopic(
      trigger.focusTopic,
      ctx
    )
    return {
      ownerId: ctx.user.sub,
      qualityTier: trigger.qualityTier ?? DB.KBGraphQualityTier.STANDARD,
      focusTopic,
      domainCapabilityEnabled,
    }
  }

  const owner = await deps.prisma.user.findUnique({
    where: { id: trigger.ownerId },
    select: {
      id: true,
      role: true,
      catalystInstitutional: true,
      catalystIndividual: true,
      aiFeaturesEnabled: true,
      betaEnabled: true,
    },
  })
  assertManageAiCapability(
    getAccountManageAiCapability(deps.featureFlags, owner)
  )
  if (
    !owner ||
    !isFeatureFlagEnabledForAccount(deps.featureFlags, owner, 'kb-graph-builds')
  ) {
    throwKbGraphGenerationDisabled()
  }
  const catalog = getDefaultKBGraphDomainCatalog()
  return {
    ownerId: owner.id,
    qualityTier: KB_GRAPH_PREPARATION_QUALITY_TIER,
    focusTopic: null,
    domainCapabilityEnabled:
      isKBGraphDomainCapabilityEnabled(catalog.revision, process.env) &&
      isFeatureFlagEnabledForAccount(
        deps.featureFlags,
        owner,
        'kb-graph-domain-selection'
      ),
  }
}

export type KBGraphBuildStart = {
  /**
   * QUEUED dispatched a new build, ALREADY_ACTIVE returned the build holding
   * the slot, and NOT_DUE means a system trigger found the published graph
   * already matching the desired preparation and reserved nothing.
   */
  outcome: 'QUEUED' | 'ALREADY_ACTIVE' | 'NOT_DUE'
  kb: {
    id: string
    knowledgeGraphEnabled: boolean
    activeGraphBuildId: string | null
    publishedGraphBuildId: string | null
  }
  build: DB.Prisma.KBGraphBuildGetPayload<{
    select: typeof KB_GRAPH_BUILD_CONFIG_SELECT
  }> | null
}

/**
 * Starts a graph build for one KB. Admission order: AI entitlement,
 * `kb-graph-builds`, the per-KB opt-in, serving course-content sources, the
 * cost configuration and quota reservation, then a compare-and-swap on the
 * KB's single build slot. A system trigger additionally skips a KB whose
 * published graph already matches the desired preparation, so unchanged
 * inputs never reserve cost.
 */
export async function startKbKnowledgeGraphBuild(
  { kbId }: { kbId: string },
  trigger: KBGraphBuildTrigger,
  deps: KBGraphBuildServiceContext
): Promise<KBGraphBuildStart> {
  const { ownerId, qualityTier, focusTopic, domainCapabilityEnabled } =
    await admitKBGraphBuildTrigger(trigger, deps)
  const result = await deps.prisma.$transaction(async (prisma) => {
    await lockOwnedKbOrThrow(prisma, kbId, ownerId)
    const kb = await prisma.kB.findUniqueOrThrow({
      where: { id: kbId },
      select: {
        id: true,
        knowledgeGraphEnabled: true,
        activeGraphBuildId: true,
        publishedGraphBuildId: true,
        domainPolicyId: true,
        domainPolicyVersion: true,
        domainPolicyLanguage: true,
      },
    })
    const storedDomain = resolveStoredKBGraphDomainSelection(kb, {
      capabilityEnabled: domainCapabilityEnabled,
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
        return {
          outcome: 'ALREADY_ACTIVE' as const,
          kb,
          build: activeBuild,
          queueBuildId: null,
        }
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
        // Graph builds intentionally cover only lecturer-curated course
        // material: administrative uploads (tutorials, syllabi, rules) must
        // not leak into graph nodes and generated questions.
        materialType: DB.KBResourceMaterialType.COURSE_CONTENT,
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
      throw new GraphQLError(
        'KB has no course-content resources with served content',
        {
          extensions: { code: 'KB_GRAPH_NO_COURSE_CONTENT' },
        }
      )
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
    if (trigger.kind === 'system') {
      const publishedBuild = kb.publishedGraphBuildId
        ? await prisma.kBGraphBuild.findFirst({
            where: {
              id: kb.publishedGraphBuildId,
              kbId,
              status: DB.KBGraphBuildStatus.SUCCEEDED,
            },
            select: {
              domainPolicyId: true,
              domainPolicyVersion: true,
              domainPolicyLanguage: true,
              qualityTier: true,
              sourceContentDigest: true,
            },
          })
        : null
      const preparation = getKBGraphPreparationStatus({
        desired: {
          domainPolicyId: storedDomain?.domainPolicyId ?? null,
          domainPolicyVersion: storedDomain?.domainPolicyVersion ?? null,
          domainPolicyLanguage: storedDomain?.language ?? null,
          qualityTier,
          sourceContentDigest,
        },
        published: publishedBuild,
      })
      if (!preparation.pending) {
        return {
          outcome: 'NOT_DUE' as const,
          kb,
          build: null,
          queueBuildId: null,
        }
      }
    }
    const buildId = randomUUID()
    const graphBundleCoordinates = getKBGraphBundleCoordinates(buildId)
    const reservation = await reserveKBGraphCost(prisma, {
      ownerId,
      qualityTier,
    })
    // Only an explicit, validated selection is frozen onto the build; the
    // legacy path writes nothing so established provider defaults stay implicit.
    const domainFields = storedDomain
      ? {
          domainPolicyId: storedDomain.domainPolicyId,
          domainPolicyVersion: storedDomain.domainPolicyVersion,
          domainPolicyLanguage: storedDomain.language,
        }
      : {}
    const build = await prisma.kBGraphBuild.create({
      data: {
        id: buildId,
        kbId,
        requestedById: ownerId,
        qualityTier,
        ...domainFields,
        focusTopic,
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
      outcome: 'QUEUED' as const,
      kb: { ...kb, activeGraphBuildId: buildId },
      build,
      queueBuildId: buildId,
    }
  })

  if (result.queueBuildId) {
    try {
      await deps.tasks.buildKBGraph.runNoWait({ buildId: result.queueBuildId })
    } catch {
      const finishedAt = new Date()
      await deps.prisma.$transaction(async (prisma) => {
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

  return { outcome: result.outcome, kb: result.kb, build: result.build }
}

export async function rebuildKbKnowledgeGraph(
  {
    kbId,
    qualityTier,
    focusTopic,
  }: {
    kbId: string
    qualityTier?: DB.KBGraphQualityTier | null
    focusTopic?: string | null
  },
  ctx: ContextWithUser
): Promise<KBKnowledgeGraphConfig> {
  const result = await startKbKnowledgeGraphBuild(
    { kbId },
    { kind: 'user', ctx, qualityTier, focusTopic },
    ctx
  )

  const isStale =
    result.build?.status === DB.KBGraphBuildStatus.SUCCEEDED
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
  const publishedBuild = result.kb.publishedGraphBuildId
    ? await ctx.prisma.kBGraphBuild.findFirst({
        where: {
          id: result.kb.publishedGraphBuildId,
          kbId,
          status: DB.KBGraphBuildStatus.SUCCEEDED,
        },
        select: {
          status: true,
          domainPolicyId: true,
          domainPolicyVersion: true,
          domainPolicyLanguage: true,
          graphBundleContainerName: true,
          graphBundleBlobPrefix: true,
          graphBundleStorageName: true,
          graphBundleSha256: true,
          graphSha256: true,
          graphManifestSchemaVersion: true,
          graphManifestArtifact: true,
        },
      })
    : null
  return getKBGraphBuildConfig(
    result.kb,
    result.build,
    isStale,
    quota,
    costConfiguration,
    isElementGenerationGraphBundleReady(publishedBuild),
    publishedBuild
  )
}
