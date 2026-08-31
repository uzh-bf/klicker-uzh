import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

interface IKBFileUpload {
  uploadSasURL: string
  containerName: string
  blobName: string
}

export const KBFileUploadRef = builder.objectRef<IKBFileUpload>('KBFileUpload')
export const KBFileUpload = KBFileUploadRef.implement({
  fields: (t) => ({
    uploadSasURL: t.exposeString('uploadSasURL'),
    containerName: t.exposeString('containerName'),
    blobName: t.exposeString('blobName'),
  }),
})

export const KBResourceType = builder.enumType('KBResourceType', {
  values: Object.values(DB.KBResourceType),
})

export const KBResourceMaterialType = builder.enumType(
  'KBResourceMaterialType',
  {
    values: Object.values(DB.KBResourceMaterialType),
  }
)

export const KBResourceStatus = builder.enumType('KBResourceStatus', {
  values: Object.values(DB.KBResourceStatus),
})

export const KBIngestionStatus = builder.enumType('KBIngestionStatus', {
  values: Object.values(DB.KBIngestionStatus),
})

export const KBIngestionRunRef =
  builder.objectRef<DB.KBIngestionRun>('KBIngestionRun')
export const KBIngestionRun = KBIngestionRunRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    status: t.expose('status', { type: KBIngestionStatus }),
    resourceVersion: t.exposeInt('resourceVersion'),
    contentSha256: t.exposeString('contentSha256', { nullable: true }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

interface IKBResource extends DB.KBResource {
  ingestionRuns?: DB.KBIngestionRun[]
}

export const KBResourceRef = builder.objectRef<IKBResource>('KBResource')
export const KBResource = KBResourceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    type: t.expose('type', { type: KBResourceType }),
    materialType: t.expose('materialType', { type: KBResourceMaterialType }),
    title: t.exposeString('title'),
    sourceUrl: t.exposeString('sourceUrl', { nullable: true }),
    originalFilename: t.exposeString('originalFilename', { nullable: true }),
    mimeType: t.exposeString('mimeType', { nullable: true }),
    sizeBytes: t.exposeInt('sizeBytes', { nullable: true }),
    status: t.expose('status', { type: KBResourceStatus }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    ingestedAt: t.expose('ingestedAt', { type: 'Date', nullable: true }),
    resourceVersion: t.exposeInt('resourceVersion'),
    activeResourceVersion: t.exposeInt('activeResourceVersion', {
      nullable: true,
    }),
    activeContentSha256: t.exposeString('activeContentSha256', {
      nullable: true,
    }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    latestIngestionRun: t.field({
      type: KBIngestionRunRef,
      nullable: true,
      resolve: (resource) => resource.ingestionRuns?.[0] ?? null,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

interface IKBMetrics {
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

export const KBMetricsRef = builder.objectRef<IKBMetrics>('KBMetrics')
export const KBMetrics = KBMetricsRef.implement({
  fields: (t) => ({
    visibleResourceCount: t.exposeInt('visibleResourceCount'),
    visibleSizeBytes: t.exposeInt('visibleSizeBytes'),
    unknownSizeResourceCount: t.exposeInt('unknownSizeResourceCount'),
    quotaResourceCount: t.exposeInt('quotaResourceCount'),
    quotaSizeBytes: t.exposeInt('quotaSizeBytes'),
    resourceLimit: t.exposeInt('resourceLimit'),
    storageLimitBytes: t.exposeInt('storageLimitBytes'),
    pendingCleanupCount: t.exposeInt('pendingCleanupCount'),
    pendingCleanupSizeBytes: t.exposeInt('pendingCleanupSizeBytes'),
    reservedResourceCount: t.exposeInt('reservedResourceCount'),
    reservedSizeBytes: t.exposeInt('reservedSizeBytes'),
    linkedConsumerCount: t.exposeInt('linkedConsumerCount'),
  }),
})

interface IKB extends DB.KB {
  metrics?: IKBMetrics
}

export const KBRef = builder.objectRef<IKB>('KB')
export const KB = KBRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    metrics: t.field({
      type: KBMetricsRef,
      nullable: true,
      resolve: (kb) => kb.metrics ?? null,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

interface IKBPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export const KBPageInfoRef = builder.objectRef<IKBPageInfo>('KBPageInfo')
export const KBPageInfo = KBPageInfoRef.implement({
  fields: (t) => ({
    hasNextPage: t.exposeBoolean('hasNextPage'),
    endCursor: t.exposeString('endCursor', { nullable: true }),
  }),
})

interface IKBConnection {
  items: IKB[]
  pageInfo: IKBPageInfo
  totalCount: number
}

export const KBConnectionRef = builder.objectRef<IKBConnection>('KBConnection')
export const KBConnection = KBConnectionRef.implement({
  fields: (t) => ({
    items: t.expose('items', { type: [KBRef] }),
    pageInfo: t.expose('pageInfo', { type: KBPageInfoRef }),
    totalCount: t.exposeInt('totalCount'),
  }),
})

interface IKBResourceConnection {
  items: IKBResource[]
  pageInfo: IKBPageInfo
  totalCount: number
  needsIngestionCount: number
  failedIngestionCount: number
  inProgressCount: number
}

export const KBResourceConnectionRef = builder.objectRef<IKBResourceConnection>(
  'KBResourceConnection'
)
export const KBResourceConnection = KBResourceConnectionRef.implement({
  fields: (t) => ({
    items: t.expose('items', { type: [KBResourceRef] }),
    pageInfo: t.expose('pageInfo', { type: KBPageInfoRef }),
    totalCount: t.exposeInt('totalCount'),
    needsIngestionCount: t.exposeInt('needsIngestionCount'),
    failedIngestionCount: t.exposeInt('failedIngestionCount'),
    inProgressCount: t.exposeInt('inProgressCount'),
  }),
})

interface IKBIngestAllResult {
  queuedCount: number
  retriedFailedCount: number
  alreadyCurrentCount: number
  alreadyInProgressCount: number
  queueFailureCount: number
}

export const KBIngestAllResultRef =
  builder.objectRef<IKBIngestAllResult>('KBIngestAllResult')
export const KBIngestAllResult = KBIngestAllResultRef.implement({
  fields: (t) => ({
    queuedCount: t.exposeInt('queuedCount'),
    retriedFailedCount: t.exposeInt('retriedFailedCount'),
    alreadyCurrentCount: t.exposeInt('alreadyCurrentCount'),
    alreadyInProgressCount: t.exposeInt('alreadyInProgressCount'),
    queueFailureCount: t.exposeInt('queueFailureCount'),
  }),
})

interface IKBChatbotBinding {
  chatbotId: string
  chatbotName: string
  enabledKbId: string | null
  enabledKbName: string | null
}

export const KBChatbotBindingRef =
  builder.objectRef<IKBChatbotBinding>('KBChatbotBinding')
export const KBChatbotBinding = KBChatbotBindingRef.implement({
  fields: (t) => ({
    chatbotId: t.exposeID('chatbotId'),
    chatbotName: t.exposeString('chatbotName'),
    enabledKbId: t.exposeID('enabledKbId', { nullable: true }),
    enabledKbName: t.exposeString('enabledKbName', { nullable: true }),
  }),
})
