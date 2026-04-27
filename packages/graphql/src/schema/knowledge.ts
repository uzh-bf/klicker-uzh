import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type * as KnowledgeService from '../services/knowledge.js'

export const KBStatusRef = builder.enumType(DB.KBStatus, {
  name: 'KBStatus',
})
export const KBResourceStatusRef = builder.enumType(DB.KBResourceStatus, {
  name: 'KBResourceStatus',
})
export const KBResourceKindRef = builder.enumType(DB.KBResourceKind, {
  name: 'KBResourceKind',
})
export const KBWebsiteStrategyRef = builder.enumType(DB.KBWebsiteStrategy, {
  name: 'KBWebsiteStrategy',
})
export const KBRefreshModeRef = builder.enumType(DB.KBRefreshMode, {
  name: 'KBRefreshMode',
})
export const KBRefreshScopeRef = builder.enumType(DB.KBRefreshScope, {
  name: 'KBRefreshScope',
})
export const KBMetadataProfileRef = builder.enumType(DB.KBMetadataProfile, {
  name: 'KBMetadataProfile',
})
export const KBIngestionTriggerRef = builder.enumType(DB.KBIngestionTrigger, {
  name: 'KBIngestionTrigger',
})
export const KBIngestionStatusRef = builder.enumType(DB.KBIngestionStatus, {
  name: 'KBIngestionStatus',
})
export const KBGraphInclusionModeRef = builder.enumType(
  DB.KBGraphInclusionMode,
  {
    name: 'KBGraphInclusionMode',
  }
)
export const KBWebhookDirectionRef = builder.enumType(DB.KBWebhookDirection, {
  name: 'KBWebhookDirection',
})
export const KBWebhookStatusRef = builder.enumType(DB.KBWebhookStatus, {
  name: 'KBWebhookStatus',
})
export const KBWebhookDestinationRef = builder.enumType(
  DB.KBWebhookDestination,
  {
    name: 'KBWebhookDestination',
  }
)

type KBResourceShape = DB.KBResource & {
  subresources?: DB.KBWebsiteSubresource[]
  ingestionRuns?: DB.KBIngestionRun[]
}

type KBShape = DB.KB & {
  resources?: KBResourceShape[]
  ingestionRuns?: DB.KBIngestionRun[]
  courses?: Array<
    DB.KBCourse & {
      course?: Pick<DB.Course, 'id' | 'name' | 'displayName'>
    }
  >
  chatbots?: Array<
    DB.KBChatbot & {
      chatbot?: Pick<DB.Chatbot, 'id' | 'name' | 'description'>
    }
  >
}

export const KBWebsiteSubresourceRef =
  builder.objectRef<DB.KBWebsiteSubresource>('KBWebsiteSubresource')
export const KBIngestionRunRef =
  builder.objectRef<DB.KBIngestionRun>('KBIngestionRun')
export const KBCourseRef = builder.objectRef<
  DB.KBCourse & {
    course?: Pick<DB.Course, 'id' | 'name' | 'displayName'>
  }
>('KBCourse')
export const KBChatbotRef = builder.objectRef<
  DB.KBChatbot & {
    chatbot?: Pick<DB.Chatbot, 'id' | 'name' | 'description'>
  }
>('KBChatbot')
export const KBWebhookEventRef =
  builder.objectRef<DB.KBWebhookEvent>('KBWebhookEvent')
export const KBResourceRef = builder.objectRef<KBResourceShape>('KBResource')
export const KBRef = builder.objectRef<KBShape>('KB')

export const KBWebsiteSubresource = KBWebsiteSubresourceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    url: t.exposeString('url'),
    title: t.exposeString('title', { nullable: true }),
    status: t.expose('status', { type: KBResourceStatusRef }),
    statusDetail: t.exposeString('statusDetail', { nullable: true }),
    chunkCount: t.exposeInt('chunkCount', { nullable: true }),
    sourceHash: t.exposeString('sourceHash', { nullable: true }),
    contentHash: t.exposeString('contentHash', { nullable: true }),
    lastCheckedAt: t.expose('lastCheckedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastRemoteModifiedAt: t.expose('lastRemoteModifiedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastContentChangedAt: t.expose('lastContentChangedAt', {
      type: 'Date',
      nullable: true,
    }),
    resourceId: t.exposeID('resourceId'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBIngestionRun = KBIngestionRunRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    trigger: t.expose('trigger', { type: KBIngestionTriggerRef }),
    status: t.expose('status', { type: KBIngestionStatusRef }),
    hatchetTaskId: t.exposeString('hatchetTaskId', { nullable: true }),
    externalRunId: t.exposeString('externalRunId', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    stats: t.expose('stats', { type: 'Json', nullable: true }),
    errorMessage: t.exposeString('errorMessage', { nullable: true }),
    errorDetails: t.exposeString('errorDetails', { nullable: true }),
    kbId: t.exposeID('kbId'),
    resourceId: t.exposeID('resourceId', { nullable: true }),
    requestedById: t.exposeID('requestedById', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBCourse = KBCourseRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    kbId: t.exposeID('kbId'),
    courseId: t.exposeID('courseId'),
    courseName: t.string({
      nullable: true,
      resolve: (link) => link.course?.displayName ?? link.course?.name,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBChatbot = KBChatbotRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    kbId: t.exposeID('kbId'),
    chatbotId: t.exposeID('chatbotId'),
    chatbotName: t.string({
      nullable: true,
      resolve: (link) => link.chatbot?.name,
    }),
    chatbotDescription: t.string({
      nullable: true,
      resolve: (link) => link.chatbot?.description,
    }),
    priority: t.exposeInt('priority'),
    isEnabled: t.exposeBoolean('isEnabled'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBWebhookEvent = KBWebhookEventRef.implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    eventId: t.exposeString('eventId', {}),
    direction: t.expose('direction', { type: KBWebhookDirectionRef }),
    eventType: t.exposeString('eventType', {}),
    status: t.expose('status', { type: KBWebhookStatusRef }),
    destination: t.expose('destination', { type: KBWebhookDestinationRef }),
    payload: t.expose('payload', { type: 'Json' }),
    attempts: t.exposeInt('attempts', {}),
    lastError: t.exposeString('lastError', { nullable: true }),
    lastAttemptAt: t.expose('lastAttemptAt', {
      type: 'Date',
      nullable: true,
    }),
    deliveredAt: t.expose('deliveredAt', { type: 'Date', nullable: true }),
    kbId: t.exposeID('kbId', { nullable: true }),
    resourceId: t.exposeID('resourceId', { nullable: true }),
    ingestionRunId: t.exposeID('ingestionRunId', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBResource = KBResourceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    kind: t.expose('kind', { type: KBResourceKindRef }),
    status: t.expose('status', { type: KBResourceStatusRef }),
    statusLabel: t.exposeString('statusLabel', { nullable: true }),
    statusDetail: t.exposeString('statusDetail', { nullable: true }),
    progress: t.exposeInt('progress', { nullable: true }),
    originLabel: t.exposeString('originLabel', { nullable: true }),
    originDetail: t.exposeString('originDetail', { nullable: true }),
    sizeBytes: t.string({
      nullable: true,
      resolve: (resource) => resource.sizeBytes?.toString(),
    }),
    chunkCount: t.exposeInt('chunkCount', { nullable: true }),
    entityCount: t.exposeInt('entityCount', { nullable: true }),
    externalResourceId: t.exposeString('externalResourceId', {
      nullable: true,
    }),
    externalIndexId: t.exposeString('externalIndexId', { nullable: true }),
    sourceHash: t.exposeString('sourceHash', { nullable: true }),
    contentHash: t.exposeString('contentHash', { nullable: true }),
    graphInclusion: t.expose('graphInclusion', {
      type: KBGraphInclusionModeRef,
    }),
    metadata: t.expose('metadata', { type: 'Json', nullable: true }),
    lastIndexedAt: t.expose('lastIndexedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastCheckedAt: t.expose('lastCheckedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastRemoteModifiedAt: t.expose('lastRemoteModifiedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastContentChangedAt: t.expose('lastContentChangedAt', {
      type: 'Date',
      nullable: true,
    }),
    nextRefreshAt: t.expose('nextRefreshAt', {
      type: 'Date',
      nullable: true,
    }),
    changeStatus: t.exposeString('changeStatus', { nullable: true }),
    refreshMode: t.expose('refreshMode', { type: KBRefreshModeRef }),
    refreshScope: t.expose('refreshScope', {
      type: KBRefreshScopeRef,
      nullable: true,
    }),
    refreshIntervalMinutes: t.exposeInt('refreshIntervalMinutes', {
      nullable: true,
    }),
    refreshCron: t.exposeString('refreshCron', { nullable: true }),
    changeMonitoring: t.exposeBoolean('changeMonitoring', { nullable: true }),
    documentFileName: t.exposeString('documentFileName', { nullable: true }),
    documentMimeType: t.exposeString('documentMimeType', { nullable: true }),
    documentPageCount: t.exposeInt('documentPageCount', { nullable: true }),
    documentLanguage: t.exposeString('documentLanguage', { nullable: true }),
    websiteUrl: t.exposeString('websiteUrl', { nullable: true }),
    websiteStrategy: t.expose('websiteStrategy', {
      type: KBWebsiteStrategyRef,
      nullable: true,
    }),
    sitemapFound: t.exposeBoolean('sitemapFound', { nullable: true }),
    sitemapPageCount: t.exposeInt('sitemapPageCount', { nullable: true }),
    scrapedPageCount: t.exposeInt('scrapedPageCount', { nullable: true }),
    crawlDepth: t.exposeInt('crawlDepth', { nullable: true }),
    snippetText: t.exposeString('snippetText', { nullable: true }),
    snippetCharacterCount: t.exposeInt('snippetCharacterCount', {
      nullable: true,
    }),
    snippetLanguage: t.exposeString('snippetLanguage', { nullable: true }),
    snippetAuthor: t.exposeString('snippetAuthor', { nullable: true }),
    snippetNote: t.exposeString('snippetNote', { nullable: true }),
    kbId: t.exposeID('kbId'),
    elementId: t.exposeInt('elementId', { nullable: true }),
    practiceQuizId: t.exposeID('practiceQuizId', { nullable: true }),
    liveQuizId: t.exposeID('liveQuizId', { nullable: true }),
    microLearningId: t.exposeID('microLearningId', { nullable: true }),
    groupActivityId: t.exposeID('groupActivityId', { nullable: true }),
    answerCollectionId: t.exposeInt('answerCollectionId', { nullable: true }),
    mediaFileId: t.exposeID('mediaFileId', { nullable: true }),
    deletedAt: t.expose('deletedAt', { type: 'Date', nullable: true }),
    deletedById: t.exposeID('deletedById', { nullable: true }),
    subresources: t.field({
      type: [KBWebsiteSubresourceRef],
      resolve: (resource) => resource.subresources ?? [],
    }),
    ingestionRuns: t.field({
      type: [KBIngestionRunRef],
      resolve: (resource) => resource.ingestionRuns ?? [],
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KB = KBRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    status: t.expose('status', { type: KBStatusRef }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    metadataProfile: t.expose('metadataProfile', {
      type: KBMetadataProfileRef,
    }),
    metadata: t.expose('metadata', { type: 'Json', nullable: true }),
    settings: t.expose('settings', { type: 'Json', nullable: true }),
    externalNamespaceId: t.exposeString('externalNamespaceId', {
      nullable: true,
    }),
    externalVectorStoreId: t.exposeString('externalVectorStoreId', {
      nullable: true,
    }),
    externalGraphId: t.exposeString('externalGraphId', { nullable: true }),
    graphEnabled: t.exposeBoolean('graphEnabled'),
    graphResourceKinds: t.field({
      type: [KBResourceKindRef],
      resolve: (kb) => kb.graphResourceKinds,
    }),
    resourceCount: t.exposeInt('resourceCount'),
    chunkCount: t.exposeInt('chunkCount'),
    entityCount: t.exposeInt('entityCount'),
    sizeBytes: t.string({
      nullable: true,
      resolve: (kb) => kb.sizeBytes?.toString(),
    }),
    refreshMode: t.expose('refreshMode', { type: KBRefreshModeRef }),
    refreshScope: t.expose('refreshScope', { type: KBRefreshScopeRef }),
    refreshIntervalMinutes: t.exposeInt('refreshIntervalMinutes', {
      nullable: true,
    }),
    refreshCron: t.exposeString('refreshCron', { nullable: true }),
    changeMonitoring: t.exposeBoolean('changeMonitoring'),
    lastIndexedAt: t.expose('lastIndexedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastCheckedAt: t.expose('lastCheckedAt', {
      type: 'Date',
      nullable: true,
    }),
    lastContentChangedAt: t.expose('lastContentChangedAt', {
      type: 'Date',
      nullable: true,
    }),
    nextRefreshAt: t.expose('nextRefreshAt', {
      type: 'Date',
      nullable: true,
    }),
    ownerId: t.exposeID('ownerId'),
    resources: t.field({
      type: [KBResourceRef],
      resolve: (kb) => kb.resources ?? [],
    }),
    ingestionRuns: t.field({
      type: [KBIngestionRunRef],
      resolve: (kb) => kb.ingestionRuns ?? [],
    }),
    courses: t.field({
      type: [KBCourseRef],
      resolve: (kb) => kb.courses ?? [],
    }),
    chatbots: t.field({
      type: [KBChatbotRef],
      resolve: (kb) => kb.chatbots ?? [],
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

type KBRefreshPolicyInputShape = {
  refreshMode: DB.KBRefreshMode
  refreshScope?: DB.KBRefreshScope | null
  refreshIntervalMinutes?: number | null
  refreshCron?: string | null
  changeMonitoring?: boolean | null
}

export const KBRefreshPolicyInputRef =
  builder.inputRef<KBRefreshPolicyInputShape>('KBRefreshPolicyInput')
export const KBRefreshPolicyInput = KBRefreshPolicyInputRef.implement({
  fields: (t) => ({
    refreshMode: t.field({ type: KBRefreshModeRef, required: true }),
    refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
    refreshIntervalMinutes: t.int({ required: false }),
    refreshCron: t.string({ required: false }),
    changeMonitoring: t.boolean({ required: false }),
  }),
})

export const KBResourceRefreshPolicyInputRef =
  builder.inputRef<KBRefreshPolicyInputShape>('KBResourceRefreshPolicyInput')
export const KBResourceRefreshPolicyInput =
  KBResourceRefreshPolicyInputRef.implement({
    fields: (t) => ({
      refreshMode: t.field({ type: KBRefreshModeRef, required: true }),
      refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
      refreshIntervalMinutes: t.int({ required: false }),
      refreshCron: t.string({ required: false }),
      changeMonitoring: t.boolean({ required: false }),
    }),
  })

export const CreateKBInputRef =
  builder.inputRef<KnowledgeService.CreateKBInput>('CreateKBInput')
export const CreateKBInput = CreateKBInputRef.implement({
  fields: (t) => ({
    name: t.string({ required: true }),
    description: t.string({ required: false }),
    metadataProfile: t.field({ type: KBMetadataProfileRef, required: false }),
    metadata: t.field({ type: 'Json', required: false }),
    settings: t.field({ type: 'Json', required: false }),
    externalNamespaceId: t.string({ required: false }),
    externalVectorStoreId: t.string({ required: false }),
    externalGraphId: t.string({ required: false }),
    graphEnabled: t.boolean({ required: false }),
    graphResourceKinds: t.field({
      type: [KBResourceKindRef],
      required: false,
    }),
    refreshMode: t.field({ type: KBRefreshModeRef, required: false }),
    refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
    refreshIntervalMinutes: t.int({ required: false }),
    refreshCron: t.string({ required: false }),
    changeMonitoring: t.boolean({ required: false }),
  }),
})

export const UpdateKBInputRef =
  builder.inputRef<KnowledgeService.UpdateKBInput>('UpdateKBInput')
export const UpdateKBInput = UpdateKBInputRef.implement({
  fields: (t) => ({
    name: t.string({ required: false }),
    description: t.string({ required: false }),
    status: t.field({ type: KBStatusRef, required: false }),
    statusMessage: t.string({ required: false }),
    metadataProfile: t.field({ type: KBMetadataProfileRef, required: false }),
    metadata: t.field({ type: 'Json', required: false }),
    settings: t.field({ type: 'Json', required: false }),
    externalNamespaceId: t.string({ required: false }),
    externalVectorStoreId: t.string({ required: false }),
    externalGraphId: t.string({ required: false }),
    graphEnabled: t.boolean({ required: false }),
    graphResourceKinds: t.field({
      type: [KBResourceKindRef],
      required: false,
    }),
    refreshMode: t.field({ type: KBRefreshModeRef, required: false }),
    refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
    refreshIntervalMinutes: t.int({ required: false }),
    refreshCron: t.string({ required: false }),
    changeMonitoring: t.boolean({ required: false }),
  }),
})

export const CreateKBResourceInputRef =
  builder.inputRef<KnowledgeService.CreateKBResourceInput>(
    'CreateKBResourceInput'
  )
export const CreateKBResourceInput = CreateKBResourceInputRef.implement({
  fields: (t) => ({
    title: t.string({ required: true }),
    description: t.string({ required: false }),
    kind: t.field({ type: KBResourceKindRef, required: true }),
    originLabel: t.string({ required: false }),
    originDetail: t.string({ required: false }),
    metadata: t.field({ type: 'Json', required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    refreshMode: t.field({ type: KBRefreshModeRef, required: false }),
    refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
    refreshIntervalMinutes: t.int({ required: false }),
    refreshCron: t.string({ required: false }),
    changeMonitoring: t.boolean({ required: false }),
    externalResourceId: t.string({ required: false }),
    mediaFileId: t.string({ required: false }),
    documentFileName: t.string({ required: false }),
    documentMimeType: t.string({ required: false }),
    documentPageCount: t.int({ required: false }),
    documentLanguage: t.string({ required: false }),
    websiteUrl: t.string({ required: false }),
    websiteStrategy: t.field({ type: KBWebsiteStrategyRef, required: false }),
    crawlDepth: t.int({ required: false }),
    snippetText: t.string({ required: false }),
    snippetLanguage: t.string({ required: false }),
    snippetAuthor: t.string({ required: false }),
    snippetNote: t.string({ required: false }),
    elementId: t.int({ required: false }),
    practiceQuizId: t.string({ required: false }),
    liveQuizId: t.string({ required: false }),
    microLearningId: t.string({ required: false }),
    groupActivityId: t.string({ required: false }),
    answerCollectionId: t.int({ required: false }),
  }),
})

export const UpdateKBResourceInputRef =
  builder.inputRef<KnowledgeService.UpdateKBResourceInput>(
    'UpdateKBResourceInput'
  )
export const UpdateKBResourceInput = UpdateKBResourceInputRef.implement({
  fields: (t) => ({
    title: t.string({ required: false }),
    description: t.string({ required: false }),
    kind: t.field({ type: KBResourceKindRef, required: false }),
    statusLabel: t.string({ required: false }),
    statusDetail: t.string({ required: false }),
    originLabel: t.string({ required: false }),
    originDetail: t.string({ required: false }),
    metadata: t.field({ type: 'Json', required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    refreshMode: t.field({ type: KBRefreshModeRef, required: false }),
    refreshScope: t.field({ type: KBRefreshScopeRef, required: false }),
    refreshIntervalMinutes: t.int({ required: false }),
    refreshCron: t.string({ required: false }),
    changeMonitoring: t.boolean({ required: false }),
    externalResourceId: t.string({ required: false }),
    mediaFileId: t.string({ required: false }),
    documentFileName: t.string({ required: false }),
    documentMimeType: t.string({ required: false }),
    documentPageCount: t.int({ required: false }),
    documentLanguage: t.string({ required: false }),
    websiteUrl: t.string({ required: false }),
    websiteStrategy: t.field({ type: KBWebsiteStrategyRef, required: false }),
    crawlDepth: t.int({ required: false }),
    snippetText: t.string({ required: false }),
    snippetLanguage: t.string({ required: false }),
    snippetAuthor: t.string({ required: false }),
    snippetNote: t.string({ required: false }),
    elementId: t.int({ required: false }),
    practiceQuizId: t.string({ required: false }),
    liveQuizId: t.string({ required: false }),
    microLearningId: t.string({ required: false }),
    groupActivityId: t.string({ required: false }),
    answerCollectionId: t.int({ required: false }),
  }),
})

export const KBResourceFilterInputRef =
  builder.inputRef<KnowledgeService.KBResourceFilterInput>(
    'KBResourceFilterInput'
  )
export const KBResourceFilterInput = KBResourceFilterInputRef.implement({
  fields: (t) => ({
    query: t.string({ required: false }),
    kinds: t.field({ type: [KBResourceKindRef], required: false }),
    statuses: t.field({ type: [KBResourceStatusRef], required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    includeDeleted: t.boolean({ required: false }),
  }),
})
