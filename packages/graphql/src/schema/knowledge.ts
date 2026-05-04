import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type * as KnowledgeService from '../services/knowledge.js'

export const KBStatusRef = builder.enumType(DB.KBStatus, {
  name: 'KBStatus',
})
export const KBResourceKindRef = builder.enumType(DB.KBResourceKind, {
  name: 'KBResourceKind',
})
export const KBWebsiteStrategyRef = builder.enumType(DB.KBWebsiteStrategy, {
  name: 'KBWebsiteStrategy',
})
export const KBMetadataProfileRef = builder.enumType(DB.KBMetadataProfile, {
  name: 'KBMetadataProfile',
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

type KBResourceShape = DB.KBResource & {
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
export const KBResourceRef = builder.objectRef<KBResourceShape>('KBResource')
export const KBRef = builder.objectRef<KBShape>('KB')

export const KBIngestionRun = KBIngestionRunRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    status: t.expose('status', { type: KBIngestionStatusRef }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    errorMessage: t.exposeString('errorMessage', { nullable: true }),
    kbId: t.exposeID('kbId'),
    resourceId: t.exposeID('resourceId', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
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

export const KBResource = KBResourceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    kind: t.expose('kind', { type: KBResourceKindRef }),
    status: t.expose('status', { type: KBStatusRef }),
    statusDetail: t.exposeString('statusDetail', { nullable: true }),
    graphInclusion: t.expose('graphInclusion', {
      type: KBGraphInclusionModeRef,
    }),
    metadata: t.expose('metadata', { type: 'Json', nullable: true }),
    refreshIntervalMinutes: t.exposeInt('refreshIntervalMinutes', {
      nullable: true,
    }),
    lastIndexedAt: t.expose('lastIndexedAt', {
      type: 'Date',
      nullable: true,
    }),
    nextRefreshAt: t.expose('nextRefreshAt', {
      type: 'Date',
      nullable: true,
    }),
    externalResourceId: t.exposeString('externalResourceId', {
      nullable: true,
    }),
    websiteUrl: t.exposeString('websiteUrl', { nullable: true }),
    websiteStrategy: t.expose('websiteStrategy', {
      type: KBWebsiteStrategyRef,
      nullable: true,
    }),
    snippetText: t.exposeString('snippetText', { nullable: true }),
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
    sizeBytes: t.string({
      nullable: true,
      resolve: (kb) => kb.sizeBytes?.toString(),
    }),
    refreshIntervalMinutes: t.exposeInt('refreshIntervalMinutes', {
      nullable: true,
    }),
    lastIndexedAt: t.expose('lastIndexedAt', {
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
  refreshIntervalMinutes?: number | null
}

export const KBRefreshPolicyInputRef =
  builder.inputRef<KBRefreshPolicyInputShape>('KBRefreshPolicyInput')
export const KBRefreshPolicyInput = KBRefreshPolicyInputRef.implement({
  fields: (t) => ({
    refreshIntervalMinutes: t.int({ required: false }),
  }),
})

export const KBResourceRefreshPolicyInputRef =
  builder.inputRef<KBRefreshPolicyInputShape>('KBResourceRefreshPolicyInput')
export const KBResourceRefreshPolicyInput =
  KBResourceRefreshPolicyInputRef.implement({
    fields: (t) => ({
      refreshIntervalMinutes: t.int({ required: false }),
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
    refreshIntervalMinutes: t.int({ required: false }),
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
    refreshIntervalMinutes: t.int({ required: false }),
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
    metadata: t.field({ type: 'Json', required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    refreshIntervalMinutes: t.int({ required: false }),
    externalResourceId: t.string({ required: false }),
    mediaFileId: t.string({ required: false }),
    websiteUrl: t.string({ required: false }),
    websiteStrategy: t.field({ type: KBWebsiteStrategyRef, required: false }),
    snippetText: t.string({ required: false }),
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
    statusDetail: t.string({ required: false }),
    metadata: t.field({ type: 'Json', required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    refreshIntervalMinutes: t.int({ required: false }),
    externalResourceId: t.string({ required: false }),
    mediaFileId: t.string({ required: false }),
    websiteUrl: t.string({ required: false }),
    websiteStrategy: t.field({ type: KBWebsiteStrategyRef, required: false }),
    snippetText: t.string({ required: false }),
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
    statuses: t.field({ type: [KBStatusRef], required: false }),
    graphInclusion: t.field({
      type: KBGraphInclusionModeRef,
      required: false,
    }),
    includeDeleted: t.boolean({ required: false }),
  }),
})
