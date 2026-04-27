import {
  KBGraphInclusionMode,
  KBIngestionStatus,
  KBIngestionTrigger,
  KBMetadataProfile,
  KBRefreshMode,
  KBRefreshScope,
  KBResourceKind,
  KBResourceStatus,
  KBStatus,
  KBWebhookDestination,
  KBWebhookStatus,
  KBWebsiteStrategy,
  Prisma,
} from '@klicker-uzh/prisma/client'
import type { KBWebhookPayload } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import {
  isResourceIncludedInGraph,
  validateKBMetadata,
  validateKBRefreshPolicy,
  validateKBResourceMetadata,
  validateKBResourceRefreshPolicy,
  validateKBResourceSource,
  validateKBSettings,
} from './knowledgeMetadata.js'
import { dispatchKBWebhook } from './knowledgeWebhooks.js'

const KB_INCLUDE = {
  resources: {
    where: { deletedAt: null },
    include: {
      subresources: { orderBy: { updatedAt: 'desc' as const } },
      ingestionRuns: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
      },
    },
    orderBy: { updatedAt: 'desc' as const },
  },
  ingestionRuns: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
  courses: {
    include: {
      course: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  chatbots: {
    include: {
      chatbot: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: { priority: 'asc' as const },
  },
} as const satisfies Prisma.KBInclude

const RESOURCE_INCLUDE = {
  kb: true,
  subresources: { orderBy: { updatedAt: 'desc' as const } },
  ingestionRuns: { orderBy: { createdAt: 'desc' as const }, take: 5 },
} as const satisfies Prisma.KBResourceInclude

const SOURCE_FIELD_KEYS = [
  'externalResourceId',
  'mediaFileId',
  'documentFileName',
  'documentMimeType',
  'documentPageCount',
  'documentLanguage',
  'websiteUrl',
  'websiteStrategy',
  'crawlDepth',
  'snippetText',
  'snippetLanguage',
  'snippetAuthor',
  'snippetNote',
  'elementId',
  'practiceQuizId',
  'liveQuizId',
  'microLearningId',
  'groupActivityId',
  'answerCollectionId',
] as const

type KBWithInclude = Prisma.KBGetPayload<{ include: typeof KB_INCLUDE }>
type KBResourceWithInclude = Prisma.KBResourceGetPayload<{
  include: typeof RESOURCE_INCLUDE
}>

export interface CreateKBInput {
  name: string
  description?: string | null
  metadataProfile?: KBMetadataProfile | null
  metadata?: unknown
  settings?: unknown
  externalNamespaceId?: string | null
  externalVectorStoreId?: string | null
  externalGraphId?: string | null
  graphEnabled?: boolean | null
  graphResourceKinds?: KBResourceKind[] | null
  refreshMode?: KBRefreshMode | null
  refreshScope?: KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}

export interface UpdateKBInput extends Omit<Partial<CreateKBInput>, 'name'> {
  name?: string | null
  status?: KBStatus | null
  statusMessage?: string | null
}

export interface CreateKBResourceInput {
  title: string
  description?: string | null
  kind: KBResourceKind
  originLabel?: string | null
  originDetail?: string | null
  metadata?: unknown
  graphInclusion?: KBGraphInclusionMode | null
  refreshMode?: KBRefreshMode | null
  refreshScope?: KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
  externalResourceId?: string | null
  mediaFileId?: string | null
  documentFileName?: string | null
  documentMimeType?: string | null
  documentPageCount?: number | null
  documentLanguage?: string | null
  websiteUrl?: string | null
  websiteStrategy?: KBWebsiteStrategy | null
  crawlDepth?: number | null
  snippetText?: string | null
  snippetLanguage?: string | null
  snippetAuthor?: string | null
  snippetNote?: string | null
  elementId?: number | null
  practiceQuizId?: string | null
  liveQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  answerCollectionId?: number | null
}

export interface UpdateKBResourceInput
  extends Omit<Partial<CreateKBResourceInput>, 'title' | 'kind'> {
  title?: string | null
  kind?: KBResourceKind | null
  statusLabel?: string | null
  statusDetail?: string | null
}

export interface UpdateKBRefreshPolicyInput {
  refreshMode: KBRefreshMode
  refreshScope?: KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}

export interface KBResourceFilterInput {
  query?: string | null
  kinds?: KBResourceKind[] | null
  statuses?: KBResourceStatus[] | null
  graphInclusion?: KBGraphInclusionMode | null
  includeDeleted?: boolean | null
}

function assertTitle(title: string | null | undefined) {
  const trimmed = title?.trim()
  if (!trimmed) throw new Error('Title is required')
  return trimmed
}

async function getOwnedKBOrThrow(id: string, ctx: ContextWithUser) {
  const kb = await ctx.prisma.kB.findFirst({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: KB_INCLUDE,
  })

  if (!kb) throw new Error('Knowledge base not found')
  return kb
}

async function getOwnedResourceOrThrow(
  resourceId: string,
  ctx: ContextWithUser
) {
  const resource = await ctx.prisma.kBResource.findFirst({
    where: {
      id: resourceId,
      kb: { ownerId: ctx.user.sub },
    },
    include: RESOURCE_INCLUDE,
  })

  if (!resource) throw new Error('Resource not found')
  return resource
}

function toNullableJson<T>(value: T | null | undefined) {
  return value == null ? undefined : value
}

function refreshPolicyData(input: {
  refreshMode?: KBRefreshMode | null
  refreshScope?: KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}) {
  if (!input.refreshMode) return {}

  const policy = validateKBRefreshPolicy({
    refreshMode: input.refreshMode,
    refreshScope: input.refreshScope,
    refreshIntervalMinutes: input.refreshIntervalMinutes,
    refreshCron: input.refreshCron,
    changeMonitoring: input.changeMonitoring,
  })

  return policy
}

function resourceRefreshPolicyData(input: {
  refreshMode?: KBRefreshMode | null
  refreshScope?: KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}) {
  if (!input.refreshMode) return {}

  const policy = validateKBResourceRefreshPolicy({
    refreshMode: input.refreshMode,
    refreshScope: input.refreshScope,
    refreshIntervalMinutes: input.refreshIntervalMinutes,
    refreshCron: input.refreshCron,
    changeMonitoring: input.changeMonitoring,
  })

  return policy
}

function sourceData(input: CreateKBResourceInput | UpdateKBResourceInput) {
  if (!input.kind) return {}

  const source = validateKBResourceSource({
    kind: input.kind,
    externalResourceId: input.externalResourceId,
    mediaFileId: input.mediaFileId,
    documentFileName: input.documentFileName,
    documentMimeType: input.documentMimeType,
    documentPageCount: input.documentPageCount,
    documentLanguage: input.documentLanguage,
    websiteUrl: input.websiteUrl,
    websiteStrategy: input.websiteStrategy,
    crawlDepth: input.crawlDepth,
    snippetText: input.snippetText,
    snippetLanguage: input.snippetLanguage,
    snippetAuthor: input.snippetAuthor,
    snippetNote: input.snippetNote,
    elementId: input.elementId,
    practiceQuizId: input.practiceQuizId,
    liveQuizId: input.liveQuizId,
    microLearningId: input.microLearningId,
    groupActivityId: input.groupActivityId,
    answerCollectionId: input.answerCollectionId,
  })

  const nullSourceFields = {
    externalResourceId: null,
    mediaFileId: null,
    documentFileName: null,
    documentMimeType: null,
    documentPageCount: null,
    documentLanguage: null,
    websiteUrl: null,
    websiteStrategy: null,
    crawlDepth: null,
    snippetText: null,
    snippetCharacterCount: null,
    snippetLanguage: null,
    snippetAuthor: null,
    snippetNote: null,
    elementId: null,
    practiceQuizId: null,
    liveQuizId: null,
    microLearningId: null,
    groupActivityId: null,
    answerCollectionId: null,
  }

  return { ...nullSourceFields, ...source }
}

function hasProcessingRelevantResourceChanges(input: UpdateKBResourceInput) {
  return (
    input.kind != null ||
    input.title != null ||
    input.metadata != null ||
    SOURCE_FIELD_KEYS.some((key) => input[key] !== undefined)
  )
}

async function validateKlickerObjectAccess(
  input: CreateKBResourceInput | UpdateKBResourceInput,
  ctx: ContextWithUser
) {
  if (input.kind !== KBResourceKind.KLICKER_OBJECT) return

  if (input.elementId != null) {
    const element = await ctx.prisma.element.findFirst({
      where: { id: input.elementId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!element) throw new Error('Invalid resource source for kind')
  }

  if (input.practiceQuizId) {
    const practiceQuiz = await ctx.prisma.practiceQuiz.findFirst({
      where: { id: input.practiceQuizId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!practiceQuiz) throw new Error('Invalid resource source for kind')
  }

  if (input.liveQuizId) {
    const liveQuiz = await ctx.prisma.liveQuiz.findFirst({
      where: { id: input.liveQuizId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!liveQuiz) throw new Error('Invalid resource source for kind')
  }

  if (input.microLearningId) {
    const microLearning = await ctx.prisma.microLearning.findFirst({
      where: { id: input.microLearningId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!microLearning) throw new Error('Invalid resource source for kind')
  }

  if (input.groupActivityId) {
    const groupActivity = await ctx.prisma.groupActivity.findFirst({
      where: { id: input.groupActivityId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!groupActivity) throw new Error('Invalid resource source for kind')
  }

  if (input.answerCollectionId != null) {
    const answerCollection = await ctx.prisma.answerCollection.findFirst({
      where: { id: input.answerCollectionId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!answerCollection) throw new Error('Invalid resource source for kind')
  }

  if (input.mediaFileId) {
    const mediaFile = await ctx.prisma.mediaFile.findFirst({
      where: { id: input.mediaFileId, ownerId: ctx.user.sub },
      select: { id: true },
    })
    if (!mediaFile) throw new Error('Invalid resource source for kind')
  }
}

async function validateDocumentAccess(
  input: CreateKBResourceInput | UpdateKBResourceInput,
  ctx: ContextWithUser
) {
  if (input.kind !== KBResourceKind.DOCUMENT || !input.mediaFileId) return

  const mediaFile = await ctx.prisma.mediaFile.findFirst({
    where: { id: input.mediaFileId, ownerId: ctx.user.sub },
    select: { id: true },
  })
  if (!mediaFile) throw new Error('Invalid resource source for kind')
}

function resourceSourcePayload(resource: KBResourceWithInclude) {
  if (resource.kind === KBResourceKind.WEBSITE) {
    return {
      url: resource.websiteUrl,
      strategy: resource.websiteStrategy,
      crawlDepth: resource.crawlDepth,
    }
  }

  if (resource.kind === KBResourceKind.SNIPPET) {
    return {
      text: resource.snippetText,
      language: resource.snippetLanguage,
    }
  }

  if (resource.kind === KBResourceKind.DOCUMENT) {
    return {
      mediaFileId: resource.mediaFileId,
      externalResourceId: resource.externalResourceId,
      fileName: resource.documentFileName,
      mimeType: resource.documentMimeType,
    }
  }

  const references = [
    ['element', resource.elementId],
    ['practiceQuiz', resource.practiceQuizId],
    ['liveQuiz', resource.liveQuizId],
    ['microLearning', resource.microLearningId],
    ['groupActivity', resource.groupActivityId],
    ['answerCollection', resource.answerCollectionId],
    ['mediaFile', resource.mediaFileId],
  ] as const
  const reference = references.find(([, id]) => id != null)

  return {
    klickerObject: reference
      ? {
          type: reference[0],
          id: String(reference[1]),
        }
      : null,
  }
}

function webhookPayload({
  kb,
  resource,
  ingestionRun,
}: {
  kb: KBWithInclude | KBResourceWithInclude['kb']
  resource: KBResourceWithInclude
  ingestionRun?: { id: string; trigger: KBIngestionTrigger } | null
}): KBWebhookPayload {
  return {
    kb: {
      id: kb.id,
      metadataProfile: kb.metadataProfile,
      metadata: kb.metadata,
      externalNamespaceId: kb.externalNamespaceId,
      externalVectorStoreId: kb.externalVectorStoreId,
    },
    resource: {
      id: resource.id,
      kind: resource.kind,
      title: resource.title,
      metadata: resource.metadata,
      refreshPolicy: {
        mode: resource.refreshMode,
        scope: resource.refreshScope,
        intervalMinutes: resource.refreshIntervalMinutes,
        cron: resource.refreshCron,
        changeMonitoring: resource.changeMonitoring,
      },
      source: resourceSourcePayload(resource),
    },
    ingestionRun: ingestionRun
      ? {
          id: ingestionRun.id,
          trigger: ingestionRun.trigger,
        }
      : undefined,
  }
}

function graphPayload(
  payload: KBWebhookPayload,
  resource: KBResourceWithInclude
) {
  return {
    ...payload,
    graph: {
      graphEnabled: resource.kb.graphEnabled,
      graphIncluded: isResourceIncludedInGraph(resource.kb, resource),
      externalGraphId: resource.kb.externalGraphId,
    },
  }
}

async function dispatchResourceEvent({
  ctx,
  resource,
  eventType,
  ingestionRun,
  graphWasIncluded,
  dispatchIngestion = true,
}: {
  ctx: ContextWithUser
  resource: KBResourceWithInclude
  eventType: 'resource.created' | 'resource.updated' | 'resource.deleted'
  ingestionRun?: { id: string; trigger: KBIngestionTrigger } | null
  graphWasIncluded?: boolean
  dispatchIngestion?: boolean
}) {
  const payload = webhookPayload({
    kb: resource.kb,
    resource,
    ingestionRun,
  })

  if (dispatchIngestion) {
    const ingestionEvent = await dispatchKBWebhook({
      prisma: ctx.prisma,
      destination: KBWebhookDestination.INGESTION,
      eventType,
      payload,
      kbId: resource.kbId,
      resourceId: resource.id,
      ingestionRunId: ingestionRun?.id,
    })

    if (ingestionRun?.id && ingestionEvent.status === KBWebhookStatus.FAILED) {
      await ctx.prisma.kBIngestionRun.update({
        where: { id: ingestionRun.id },
        data: {
          status: KBIngestionStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: ingestionEvent.lastError,
        },
      })
    }
  }

  const graphIncluded = isResourceIncludedInGraph(resource.kb, resource)
  const graphEventType = `catalog.${eventType}` as
    | 'catalog.resource.created'
    | 'catalog.resource.updated'
    | 'catalog.resource.deleted'

  if (graphIncluded || graphWasIncluded) {
    await dispatchKBWebhook({
      prisma: ctx.prisma,
      destination: KBWebhookDestination.GRAPH,
      eventType: graphEventType,
      payload: graphPayload(payload, resource),
      kbId: resource.kbId,
      resourceId: resource.id,
      ingestionRunId: ingestionRun?.id,
    })
  }
}

async function recalculateKBResourceCount(kbId: string, ctx: ContextWithUser) {
  const resourceCount = await ctx.prisma.kBResource.count({
    where: { kbId, deletedAt: null },
  })

  await ctx.prisma.kB.update({
    where: { id: kbId },
    data: { resourceCount },
  })
}

async function createResourceRun({
  ctx,
  kbId,
  resourceId,
  trigger,
}: {
  ctx: ContextWithUser
  kbId: string
  resourceId: string
  trigger: KBIngestionTrigger
}) {
  return await ctx.prisma.kBIngestionRun.create({
    data: {
      kbId,
      resourceId,
      requestedById: ctx.user.sub,
      trigger,
      status: KBIngestionStatus.QUEUED,
    },
  })
}

async function softDeleteResource(
  resource: KBResourceWithInclude,
  ctx: ContextWithUser
) {
  const graphWasIncluded = isResourceIncludedInGraph(resource.kb, resource)
  const deletedResource = await ctx.prisma.kBResource.update({
    where: { id: resource.id },
    data: {
      deletedAt: new Date(),
      deletedById: ctx.user.sub,
      status: KBResourceStatus.DISABLED,
    },
    include: RESOURCE_INCLUDE,
  })
  const run = await createResourceRun({
    ctx,
    kbId: resource.kbId,
    resourceId: resource.id,
    trigger: KBIngestionTrigger.RESOURCE_UPDATED,
  })

  await dispatchResourceEvent({
    ctx,
    resource: deletedResource,
    eventType: 'resource.deleted',
    ingestionRun: run,
    graphWasIncluded,
  })
}

export async function getKBs(ctx: ContextWithUser) {
  return await ctx.prisma.kB.findMany({
    where: { ownerId: ctx.user.sub },
    include: {
      courses: KB_INCLUDE.courses,
      chatbots: KB_INCLUDE.chatbots,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getKB({ id }: { id: string }, ctx: ContextWithUser) {
  return await getOwnedKBOrThrow(id, ctx)
}

export async function getKBResources(
  { kbId, filter }: { kbId: string; filter?: KBResourceFilterInput | null },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)

  return await ctx.prisma.kBResource.findMany({
    where: {
      kbId,
      deletedAt: filter?.includeDeleted ? undefined : null,
      kind: filter?.kinds?.length ? { in: filter.kinds } : undefined,
      status: filter?.statuses?.length ? { in: filter.statuses } : undefined,
      graphInclusion: filter?.graphInclusion ?? undefined,
      OR: filter?.query
        ? [
            { title: { contains: filter.query, mode: 'insensitive' } },
            { description: { contains: filter.query, mode: 'insensitive' } },
            { websiteUrl: { contains: filter.query, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: RESOURCE_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getKBIngestionRuns(
  {
    kbId,
    resourceId,
    limit,
  }: { kbId: string; resourceId?: string | null; limit?: number | null },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)

  return await ctx.prisma.kBIngestionRun.findMany({
    where: { kbId, resourceId: resourceId ?? undefined },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit ?? 20, 1), 100),
  })
}

export async function getKBWebhookEvents(
  {
    kbId,
    resourceId,
    limit,
  }: { kbId: string; resourceId?: string | null; limit?: number | null },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)

  return await ctx.prisma.kBWebhookEvent.findMany({
    where: { kbId, resourceId: resourceId ?? undefined },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit ?? 20, 1), 100),
  })
}

export async function createKB(input: CreateKBInput, ctx: ContextWithUser) {
  const metadataProfile = input.metadataProfile ?? KBMetadataProfile.COURSE_KB
  const metadata = validateKBMetadata(metadataProfile, input.metadata)
  const settings = validateKBSettings(input.settings)
  const refresh = refreshPolicyData({
    refreshMode: input.refreshMode ?? KBRefreshMode.MANUAL,
    refreshScope: input.refreshScope ?? KBRefreshScope.REFRESHABLE,
    refreshIntervalMinutes: input.refreshIntervalMinutes,
    refreshCron: input.refreshCron,
    changeMonitoring: input.changeMonitoring,
  })

  return await ctx.prisma.kB.create({
    data: {
      name: assertTitle(input.name),
      description: input.description?.trim() || null,
      metadataProfile,
      metadata: toNullableJson(metadata),
      settings: toNullableJson(settings),
      externalNamespaceId: input.externalNamespaceId ?? null,
      externalVectorStoreId: input.externalVectorStoreId ?? null,
      externalGraphId: input.externalGraphId ?? null,
      graphEnabled: input.graphEnabled ?? false,
      graphResourceKinds: input.graphResourceKinds ?? [],
      ...refresh,
      ownerId: ctx.user.sub,
    },
    include: KB_INCLUDE,
  })
}

export async function updateKB(
  { id, input }: { id: string; input: UpdateKBInput },
  ctx: ContextWithUser
) {
  const current = await getOwnedKBOrThrow(id, ctx)
  const metadataProfile = input.metadataProfile ?? current.metadataProfile
  const metadata =
    input.metadata === undefined
      ? undefined
      : validateKBMetadata(metadataProfile, input.metadata)
  const settings =
    input.settings === undefined
      ? undefined
      : validateKBSettings(input.settings)
  const graphPolicyChanged =
    input.graphEnabled !== undefined ||
    input.graphResourceKinds !== undefined ||
    input.externalGraphId !== undefined

  const updated = await ctx.prisma.kB.update({
    where: { id },
    data: {
      name: input.name !== undefined ? assertTitle(input.name) : undefined,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : undefined,
      status: input.status ?? undefined,
      statusMessage: input.statusMessage ?? undefined,
      metadataProfile,
      metadata:
        input.metadata === undefined ? undefined : toNullableJson(metadata),
      settings:
        input.settings === undefined ? undefined : toNullableJson(settings),
      externalNamespaceId: input.externalNamespaceId ?? undefined,
      externalVectorStoreId: input.externalVectorStoreId ?? undefined,
      externalGraphId: input.externalGraphId ?? undefined,
      graphEnabled: input.graphEnabled ?? undefined,
      graphResourceKinds: input.graphResourceKinds ?? undefined,
      ...refreshPolicyData(input),
    },
    include: KB_INCLUDE,
  })

  if (graphPolicyChanged) {
    const resources = await ctx.prisma.kBResource.findMany({
      where: { kbId: id, deletedAt: null },
      include: RESOURCE_INCLUDE,
    })

    for (const resource of resources) {
      const wasIncluded = isResourceIncludedInGraph(current, resource)
      const isIncluded = isResourceIncludedInGraph(updated, resource)
      if (wasIncluded || isIncluded) {
        await dispatchResourceEvent({
          ctx,
          resource,
          eventType: 'resource.updated',
          graphWasIncluded: wasIncluded,
          dispatchIngestion: false,
        })
      }
    }
  }

  return updated
}

export async function deleteKB({ id }: { id: string }, ctx: ContextWithUser) {
  await getOwnedKBOrThrow(id, ctx)
  const activeResources = await ctx.prisma.kBResource.findMany({
    where: { kbId: id, deletedAt: null },
    include: RESOURCE_INCLUDE,
  })

  for (const resource of activeResources) {
    await softDeleteResource(resource, ctx)
  }

  await ctx.prisma.kB.update({
    where: { id },
    data: { status: KBStatus.DISABLED, resourceCount: 0 },
  })

  return true
}

export async function createKBResource(
  { kbId, input }: { kbId: string; input: CreateKBResourceInput },
  ctx: ContextWithUser
) {
  const kb = await getOwnedKBOrThrow(kbId, ctx)
  await validateKlickerObjectAccess(input, ctx)
  await validateDocumentAccess(input, ctx)

  const metadata = validateKBResourceMetadata(
    kb.metadataProfile,
    input.metadata
  )
  const created = await ctx.prisma.kBResource.create({
    data: {
      title: assertTitle(input.title),
      description: input.description?.trim() || null,
      status: KBResourceStatus.QUEUED,
      kind: input.kind,
      originLabel: input.originLabel?.trim() || null,
      originDetail: input.originDetail?.trim() || null,
      metadata: toNullableJson(metadata),
      graphInclusion: input.graphInclusion ?? KBGraphInclusionMode.INHERIT,
      ...resourceRefreshPolicyData({
        refreshMode: input.refreshMode ?? KBRefreshMode.INHERIT,
        refreshScope: input.refreshScope,
        refreshIntervalMinutes: input.refreshIntervalMinutes,
        refreshCron: input.refreshCron,
        changeMonitoring: input.changeMonitoring,
      }),
      ...sourceData(input),
      kbId,
    },
    include: RESOURCE_INCLUDE,
  })

  const run = await createResourceRun({
    ctx,
    kbId,
    resourceId: created.id,
    trigger: KBIngestionTrigger.RESOURCE_CREATED,
  })

  await recalculateKBResourceCount(kbId, ctx)
  await dispatchResourceEvent({
    ctx,
    resource: created,
    eventType: 'resource.created',
    ingestionRun: run,
  })

  return await getOwnedResourceOrThrow(created.id, ctx)
}

export async function updateKBResource(
  { resourceId, input }: { resourceId: string; input: UpdateKBResourceInput },
  ctx: ContextWithUser
) {
  const current = await getOwnedResourceOrThrow(resourceId, ctx)
  const effectiveInput = {
    externalResourceId: current.externalResourceId,
    mediaFileId: current.mediaFileId,
    documentFileName: current.documentFileName,
    documentMimeType: current.documentMimeType,
    documentPageCount: current.documentPageCount,
    documentLanguage: current.documentLanguage,
    websiteUrl: current.websiteUrl,
    websiteStrategy: current.websiteStrategy,
    crawlDepth: current.crawlDepth,
    snippetText: current.snippetText,
    snippetLanguage: current.snippetLanguage,
    snippetAuthor: current.snippetAuthor,
    snippetNote: current.snippetNote,
    elementId: current.elementId,
    practiceQuizId: current.practiceQuizId,
    liveQuizId: current.liveQuizId,
    microLearningId: current.microLearningId,
    groupActivityId: current.groupActivityId,
    answerCollectionId: current.answerCollectionId,
    ...input,
    kind: input.kind ?? current.kind,
  }
  await validateKlickerObjectAccess(effectiveInput, ctx)
  await validateDocumentAccess(effectiveInput, ctx)

  const metadata =
    input.metadata === undefined
      ? undefined
      : validateKBResourceMetadata(current.kb.metadataProfile, input.metadata)
  const graphWasIncluded = isResourceIncludedInGraph(current.kb, current)
  const processingRelevant = hasProcessingRelevantResourceChanges(input)

  const updated = await ctx.prisma.kBResource.update({
    where: { id: resourceId },
    data: {
      title: input.title !== undefined ? assertTitle(input.title) : undefined,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : undefined,
      statusLabel: input.statusLabel ?? undefined,
      statusDetail: input.statusDetail ?? undefined,
      kind: input.kind ?? undefined,
      originLabel:
        input.originLabel !== undefined
          ? input.originLabel?.trim() || null
          : undefined,
      originDetail:
        input.originDetail !== undefined
          ? input.originDetail?.trim() || null
          : undefined,
      metadata:
        input.metadata === undefined ? undefined : toNullableJson(metadata),
      graphInclusion: input.graphInclusion ?? undefined,
      ...resourceRefreshPolicyData(input),
      ...(input.kind ||
      SOURCE_FIELD_KEYS.some((key) => input[key] !== undefined)
        ? sourceData(effectiveInput)
        : {}),
    },
    include: RESOURCE_INCLUDE,
  })

  const graphIncluded = isResourceIncludedInGraph(updated.kb, updated)
  const graphChanged = graphWasIncluded !== graphIncluded
  let run: { id: string; trigger: KBIngestionTrigger } | null = null
  if (processingRelevant) {
    run = await createResourceRun({
      ctx,
      kbId: updated.kbId,
      resourceId: updated.id,
      trigger: KBIngestionTrigger.RESOURCE_UPDATED,
    })
  }

  if (processingRelevant || graphChanged) {
    await dispatchResourceEvent({
      ctx,
      resource: updated,
      eventType: 'resource.updated',
      ingestionRun: run,
      graphWasIncluded,
      dispatchIngestion: processingRelevant,
    })
  }

  return await getOwnedResourceOrThrow(resourceId, ctx)
}

export async function deleteKBResources(
  { resourceIds }: { resourceIds: string[] },
  ctx: ContextWithUser
) {
  const resources = await ctx.prisma.kBResource.findMany({
    where: { id: { in: resourceIds }, kb: { ownerId: ctx.user.sub } },
    include: RESOURCE_INCLUDE,
  })

  if (resources.length !== resourceIds.length) {
    throw new Error('Resource not found')
  }

  const affectedKBIds = new Set<string>()
  for (const resource of resources) {
    await softDeleteResource(resource, ctx)
    affectedKBIds.add(resource.kbId)
  }

  for (const kbId of affectedKBIds) {
    await recalculateKBResourceCount(kbId, ctx)
  }

  return true
}

export async function updateKBRefreshPolicy(
  { kbId, input }: { kbId: string; input: UpdateKBRefreshPolicyInput },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)
  return await ctx.prisma.kB.update({
    where: { id: kbId },
    data: refreshPolicyData(input),
    include: KB_INCLUDE,
  })
}

export async function updateKBResourceRefreshPolicy(
  {
    resourceId,
    input,
  }: { resourceId: string; input: UpdateKBRefreshPolicyInput },
  ctx: ContextWithUser
) {
  await getOwnedResourceOrThrow(resourceId, ctx)
  return await ctx.prisma.kBResource.update({
    where: { id: resourceId },
    data: resourceRefreshPolicyData(input),
    include: RESOURCE_INCLUDE,
  })
}

export async function linkKBCourse(
  { kbId, courseId }: { kbId: string; courseId: string },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)
  const course = await ctx.prisma.course.findFirst({
    where: { id: courseId, ownerId: ctx.user.sub },
    select: { id: true },
  })
  if (!course) throw new Error('Course not found')

  await ctx.prisma.kBCourse.upsert({
    where: { kbId_courseId: { kbId, courseId } },
    create: { kbId, courseId },
    update: {},
  })

  return await getOwnedKBOrThrow(kbId, ctx)
}

export async function unlinkKBCourse(
  { kbId, courseId }: { kbId: string; courseId: string },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)
  await ctx.prisma.kBCourse.deleteMany({ where: { kbId, courseId } })
  return await getOwnedKBOrThrow(kbId, ctx)
}

export async function linkKBChatbot(
  {
    kbId,
    chatbotId,
    isEnabled,
    priority,
  }: {
    kbId: string
    chatbotId: string
    isEnabled?: boolean | null
    priority?: number | null
  },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: { id: chatbotId, ownerId: ctx.user.sub },
    select: { id: true },
  })
  if (!chatbot) throw new Error('Chatbot not found')

  await ctx.prisma.kBChatbot.upsert({
    where: { kbId_chatbotId: { kbId, chatbotId } },
    create: {
      kbId,
      chatbotId,
      isEnabled: isEnabled ?? true,
      priority: priority ?? 0,
    },
    update: {
      isEnabled: isEnabled ?? undefined,
      priority: priority ?? undefined,
    },
  })

  return await getOwnedKBOrThrow(kbId, ctx)
}

export async function unlinkKBChatbot(
  { kbId, chatbotId }: { kbId: string; chatbotId: string },
  ctx: ContextWithUser
) {
  await getOwnedKBOrThrow(kbId, ctx)
  await ctx.prisma.kBChatbot.deleteMany({ where: { kbId, chatbotId } })
  return await getOwnedKBOrThrow(kbId, ctx)
}
