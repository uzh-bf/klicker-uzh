import {
  KnowledgeGraphNotPublishedError,
  type PublishedKnowledgeGraph,
  getPublishedKnowledgeGraph,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from '@klicker-uzh/knowledge-graph'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  BuildChatbotKnowledgeGraphInput,
  KBIngestionSpeedMode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { randomUUID } from 'crypto'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

export interface ChatbotKnowledgeGraphConfig {
  id: string | null
  chatbotId: string
  status: DB.ChatbotKnowledgeGraphStatus
  statusMessage: string | null
  selectionRevision: number
  builtRevision: number | null
  activeAttemptId: string | null
  activeBuildRevision: number | null
  externalWorkflowRunId: string | null
  externalStartedAt: Date | null
  lastBuiltAt: Date | null
  lastBuildSpeedMode: DB.KBIngestionSpeedMode | null
  selectedResourceIds: string[]
  createdAt: Date | null
  updatedAt: Date | null
}

export interface AvailableChatbotKnowledgeGraphResource {
  id: string
  type: DB.KBResourceType
  title: string
  status: DB.KBResourceStatus
  assignmentChatbotId: string | null
  assignmentChatbotName: string | null
}

export interface AvailableChatbotKnowledgeGraphResourceGroup {
  id: string
  name: string
  description: string | null
  resources: AvailableChatbotKnowledgeGraphResource[]
}

type GraphWithResources = DB.Prisma.ChatbotKnowledgeGraphGetPayload<{
  include: { resources: { select: { id: true } } }
}>

function emptyConfig(chatbotId: string): ChatbotKnowledgeGraphConfig {
  return {
    id: null,
    chatbotId,
    status: DB.ChatbotKnowledgeGraphStatus.EMPTY,
    statusMessage: null,
    selectionRevision: 0,
    builtRevision: null,
    activeAttemptId: null,
    activeBuildRevision: null,
    externalWorkflowRunId: null,
    externalStartedAt: null,
    lastBuiltAt: null,
    lastBuildSpeedMode: null,
    selectedResourceIds: [],
    createdAt: null,
    updatedAt: null,
  }
}

function toConfig(graph: GraphWithResources): ChatbotKnowledgeGraphConfig {
  return {
    id: graph.id,
    chatbotId: graph.chatbotId,
    status: graph.status,
    statusMessage: graph.statusMessage,
    selectionRevision: graph.selectionRevision,
    builtRevision: graph.builtRevision,
    activeAttemptId: graph.activeAttemptId,
    activeBuildRevision: graph.activeBuildRevision,
    externalWorkflowRunId: graph.externalWorkflowRunId,
    externalStartedAt: graph.externalStartedAt,
    lastBuiltAt: graph.lastBuiltAt,
    lastBuildSpeedMode: graph.lastBuildSpeedMode,
    selectedResourceIds: graph.resources.map(({ id }) => id).sort(),
    createdAt: graph.createdAt,
    updatedAt: graph.updatedAt,
  }
}

async function getOwnedChatbotOrThrow(ctx: ContextWithUser, chatbotId: string) {
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: { id: chatbotId, ownerId: ctx.user.sub },
    select: { id: true },
  })
  if (!chatbot) {
    throw new GraphQLError('Chatbot not found')
  }
  return chatbot
}

type KnowledgeGraphReadOperation = 'overview' | 'search' | 'neighbors'

async function readOwnedPublishedKnowledgeGraph(
  chatbotId: string,
  operation: KnowledgeGraphReadOperation,
  ctx: ContextWithUser,
  read: (
    publishedGraph: PublishedKnowledgeGraph
  ) => Promise<KnowledgeGraphResponse>
): Promise<KnowledgeGraphResponse> {
  await getOwnedChatbotOrThrow(ctx, chatbotId)

  try {
    const publishedGraph = await getPublishedKnowledgeGraph(
      ctx.prisma,
      chatbotId
    )
    return await read(publishedGraph)
  } catch (error) {
    if (error instanceof KnowledgeGraphNotPublishedError) {
      throw new GraphQLError('Knowledge graph is not published', {
        extensions: {
          code: 'KNOWLEDGE_GRAPH_NOT_PUBLISHED',
          publicationStatus: error.code,
        },
      })
    }

    console.error('Knowledge graph read failed', { chatbotId, operation })
    throw new GraphQLError('Knowledge graph is temporarily unavailable', {
      extensions: { code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE' },
    })
  }
}

async function lockOwnedChatbotOrThrow(
  prisma: DB.Prisma.TransactionClient,
  chatbotId: string,
  ownerId: string
) {
  const chatbots = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."Chatbot"
    WHERE "id" = CAST(${chatbotId} AS UUID)
      AND "ownerId" = CAST(${ownerId} AS UUID)
    FOR UPDATE
  `
  if (chatbots.length === 0) {
    throw new GraphQLError('Chatbot not found')
  }
}

async function lockGraph(prisma: DB.Prisma.TransactionClient, graphId: string) {
  await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."ChatbotKnowledgeGraph"
    WHERE "id" = CAST(${graphId} AS UUID)
    FOR UPDATE
  `
}

function normalizedResourceIds(resourceIds: readonly string[]) {
  const uniqueIds = new Set(resourceIds)
  if (uniqueIds.size !== resourceIds.length) {
    throw new GraphQLError('Duplicate KB resource IDs are not allowed')
  }
  return [...uniqueIds].sort()
}

function sameIdSet(
  currentIds: readonly string[],
  requestedIds: readonly string[]
) {
  if (currentIds.length !== requestedIds.length) return false
  return currentIds.every((id, index) => id === requestedIds[index])
}

function toDBSpeedMode(speedMode: KBIngestionSpeedMode) {
  switch (speedMode) {
    case 'balanced':
      return DB.KBIngestionSpeedMode.BALANCED
    case 'quality':
      return DB.KBIngestionSpeedMode.QUALITY
    case 'fast':
      return DB.KBIngestionSpeedMode.FAST
  }
}

async function markLocalBuildDispatchFailed(
  {
    graphId,
    chatbotId,
    attemptId,
    selectionRevision,
  }: Pick<
    BuildChatbotKnowledgeGraphInput,
    'graphId' | 'chatbotId' | 'attemptId' | 'selectionRevision'
  >,
  ctx: ContextWithUser
) {
  const activeAttempt = {
    id: graphId,
    chatbotId,
    activeAttemptId: attemptId,
    activeBuildRevision: selectionRevision,
  }
  const clearActiveAttempt = {
    activeAttemptId: null,
    activeBuildRevision: null,
    externalWorkflowRunId: null,
    externalStartedAt: null,
  }

  const failed = await ctx.prisma.chatbotKnowledgeGraph.updateMany({
    where: {
      ...activeAttempt,
      selectionRevision,
    },
    data: {
      status: DB.ChatbotKnowledgeGraphStatus.FAILED,
      statusMessage: 'The knowledge graph build could not be queued.',
      ...clearActiveAttempt,
    },
  })
  if (failed.count === 1) return

  await ctx.prisma.chatbotKnowledgeGraph.updateMany({
    where: {
      ...activeAttempt,
      selectionRevision: { not: selectionRevision },
    },
    data: {
      status: DB.ChatbotKnowledgeGraphStatus.DIRTY,
      statusMessage: null,
      ...clearActiveAttempt,
    },
  })
}

async function lockOwnedResources(
  prisma: DB.Prisma.TransactionClient,
  resourceIds: readonly string[],
  ownerId: string
) {
  if (resourceIds.length === 0) return []

  const idList = DB.Prisma.join(
    resourceIds.map((id) => DB.Prisma.sql`CAST(${id} AS UUID)`)
  )
  return prisma.$queryRaw<Array<{ id: string }>>(DB.Prisma.sql`
    SELECT resource."id"
    FROM "public"."KBResource" AS resource
    INNER JOIN "public"."KB" AS kb ON kb."id" = resource."kbId"
    WHERE resource."id" IN (${idList})
      AND kb."ownerId" = CAST(${ownerId} AS UUID)
    ORDER BY resource."id"
    FOR UPDATE OF resource
  `)
}

async function loadGraph(
  prisma: DB.Prisma.TransactionClient,
  chatbotId: string
) {
  return prisma.chatbotKnowledgeGraph.findUnique({
    where: { chatbotId },
    include: { resources: { select: { id: true } } },
  })
}

export async function getChatbotKnowledgeGraphConfig(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
): Promise<ChatbotKnowledgeGraphConfig> {
  await getOwnedChatbotOrThrow(ctx, chatbotId)
  const graph = await ctx.prisma.chatbotKnowledgeGraph.findUnique({
    where: { chatbotId },
    include: { resources: { select: { id: true } } },
  })
  return graph ? toConfig(graph) : emptyConfig(chatbotId)
}

export async function getChatbotKnowledgeGraphOverview(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
): Promise<KnowledgeGraphResponse> {
  return readOwnedPublishedKnowledgeGraph(
    chatbotId,
    'overview',
    ctx,
    readKnowledgeGraphOverview
  )
}

export async function searchChatbotKnowledgeGraph(
  { chatbotId, query }: { chatbotId: string; query: string },
  ctx: ContextWithUser
): Promise<KnowledgeGraphResponse> {
  return readOwnedPublishedKnowledgeGraph(chatbotId, 'search', ctx, (graph) =>
    searchKnowledgeGraph(graph, query)
  )
}

export async function getChatbotKnowledgeGraphNeighbors(
  { chatbotId, nodeId }: { chatbotId: string; nodeId: string },
  ctx: ContextWithUser
): Promise<KnowledgeGraphResponse> {
  return readOwnedPublishedKnowledgeGraph(
    chatbotId,
    'neighbors',
    ctx,
    (graph) => readKnowledgeGraphNeighbors(graph, nodeId)
  )
}

export async function getAvailableChatbotKnowledgeGraphResources(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
): Promise<AvailableChatbotKnowledgeGraphResourceGroup[]> {
  await getOwnedChatbotOrThrow(ctx, chatbotId)

  const knowledgeBases = await ctx.prisma.kB.findMany({
    where: { ownerId: ctx.user.sub },
    include: {
      resources: {
        include: {
          knowledgeGraph: {
            select: {
              chatbot: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return knowledgeBases.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    resources: kb.resources.map((resource) => ({
      id: resource.id,
      type: resource.type,
      title: resource.title,
      status: resource.status,
      assignmentChatbotId: resource.knowledgeGraph?.chatbot.id ?? null,
      assignmentChatbotName: resource.knowledgeGraph?.chatbot.name ?? null,
    })),
  }))
}

export async function updateChatbotKnowledgeGraphResources(
  {
    chatbotId,
    resourceIds,
  }: {
    chatbotId: string
    resourceIds: string[]
  },
  ctx: ContextWithUser
): Promise<ChatbotKnowledgeGraphConfig> {
  const requestedIds = normalizedResourceIds(resourceIds)

  return ctx.prisma.$transaction(async (prisma) => {
    await lockOwnedChatbotOrThrow(prisma, chatbotId, ctx.user.sub)

    let graph = await loadGraph(prisma, chatbotId)
    if (!graph) {
      graph = await prisma.chatbotKnowledgeGraph.create({
        data: { chatbotId },
        include: { resources: { select: { id: true } } },
      })
    } else {
      await lockGraph(prisma, graph.id)
      graph = await loadGraph(prisma, chatbotId)
      if (!graph) {
        throw new GraphQLError('Chatbot knowledge graph not found')
      }
    }

    const currentIds = graph.resources.map(({ id }) => id).sort()
    const idsToLock = [...new Set([...currentIds, ...requestedIds])].sort()
    const ownedLockedResources = await lockOwnedResources(
      prisma,
      idsToLock,
      ctx.user.sub
    )
    const ownedLockedIds = new Set(ownedLockedResources.map(({ id }) => id))
    if (requestedIds.some((id) => !ownedLockedIds.has(id))) {
      throw new GraphQLError('KB resource not found')
    }

    const requestedResources = await prisma.kBResource.findMany({
      where: { id: { in: requestedIds } },
      select: { id: true, knowledgeGraphId: true },
    })
    if (requestedResources.length !== requestedIds.length) {
      throw new GraphQLError('KB resource not found')
    }
    if (
      requestedResources.some(
        ({ knowledgeGraphId }) =>
          knowledgeGraphId !== null && knowledgeGraphId !== graph.id
      )
    ) {
      throw new GraphQLError('KB resource is assigned to another chatbot')
    }

    const selectionChanged = !sameIdSet(currentIds, requestedIds)
    if (selectionChanged) {
      await prisma.kBResource.updateMany({
        where: {
          knowledgeGraphId: graph.id,
          id: requestedIds.length > 0 ? { notIn: requestedIds } : undefined,
        },
        data: { knowledgeGraphId: null },
      })
      if (requestedIds.length > 0) {
        await prisma.kBResource.updateMany({
          where: {
            id: { in: requestedIds },
            OR: [{ knowledgeGraphId: null }, { knowledgeGraphId: graph.id }],
          },
          data: { knowledgeGraphId: graph.id },
        })
      }
    }

    const nextRevision = selectionChanged
      ? graph.selectionRevision + 1
      : graph.selectionRevision
    const hasActiveAttempt = graph.activeAttemptId !== null
    const nextStatus = hasActiveAttempt
      ? graph.status
      : requestedIds.length === 0
        ? DB.ChatbotKnowledgeGraphStatus.EMPTY
        : selectionChanged
          ? DB.ChatbotKnowledgeGraphStatus.DIRTY
          : graph.status

    const updated = await prisma.chatbotKnowledgeGraph.update({
      where: { id: graph.id },
      data: {
        selectionRevision: nextRevision,
        status: nextStatus,
        statusMessage:
          hasActiveAttempt || !selectionChanged ? graph.statusMessage : null,
      },
      include: { resources: { select: { id: true } } },
    })

    return toConfig(updated)
  })
}

export async function rebuildChatbotKnowledgeGraph(
  {
    chatbotId,
    speedMode,
  }: { chatbotId: string; speedMode: KBIngestionSpeedMode },
  ctx: ContextWithUser
): Promise<ChatbotKnowledgeGraphConfig> {
  await getOwnedChatbotOrThrow(ctx, chatbotId)

  const graph = await ctx.prisma.chatbotKnowledgeGraph.findUnique({
    where: { chatbotId },
    include: { resources: { orderBy: { id: 'asc' } } },
  })
  if (!graph || graph.resources.length === 0) {
    throw new GraphQLError('Chatbot knowledge graph has no selected resources')
  }

  const resources: BuildChatbotKnowledgeGraphInput['resources'] =
    graph.resources.map((resource) => {
      const base = { resourceId: resource.id, title: resource.title }
      if (resource.type === DB.KBResourceType.BLOB) {
        if (!resource.blobName) {
          throw new GraphQLError('Chatbot knowledge graph resource is invalid')
        }
        return {
          ...base,
          type: 'BLOB',
          blobName: resource.blobName,
          containerName: `kb-${ctx.user.sub}`,
        }
      }
      if (!resource.sourceUrl) {
        throw new GraphQLError('Chatbot knowledge graph resource is invalid')
      }
      return { ...base, type: 'URL', sourceUrl: resource.sourceUrl }
    })

  const attemptId = randomUUID()
  const payload: BuildChatbotKnowledgeGraphInput = {
    graphId: graph.id,
    chatbotId,
    attemptId,
    selectionRevision: graph.selectionRevision,
    speedMode,
    resources,
  }
  const claim = await ctx.prisma.chatbotKnowledgeGraph.updateMany({
    where: {
      id: graph.id,
      chatbotId,
      selectionRevision: graph.selectionRevision,
      activeAttemptId: null,
      activeBuildRevision: null,
    },
    data: {
      status: DB.ChatbotKnowledgeGraphStatus.QUEUED,
      statusMessage: null,
      activeAttemptId: attemptId,
      activeBuildRevision: graph.selectionRevision,
      externalWorkflowRunId: null,
      externalStartedAt: null,
      lastBuildSpeedMode: toDBSpeedMode(speedMode),
    },
  })
  if (claim.count !== 1) {
    const current = await ctx.prisma.chatbotKnowledgeGraph.findUnique({
      where: { id: graph.id },
      select: { activeAttemptId: true },
    })
    if (current?.activeAttemptId) {
      throw new GraphQLError('Chatbot knowledge graph build is already active')
    }
    throw new GraphQLError('Chatbot knowledge graph build could not be queued')
  }

  try {
    await ctx.tasks.buildChatbotKnowledgeGraph.runNoWait(payload)
  } catch {
    await markLocalBuildDispatchFailed(payload, ctx)
    throw new GraphQLError('Chatbot knowledge graph build could not be queued')
  }

  const claimed = await ctx.prisma.chatbotKnowledgeGraph.findUniqueOrThrow({
    where: { id: graph.id },
    include: { resources: { select: { id: true } } },
  })
  return toConfig(claimed)
}
