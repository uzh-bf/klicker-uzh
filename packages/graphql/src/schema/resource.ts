import * as DB from '@klicker-uzh/prisma/client'
import type { SharingType as SharingTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import type {
  ChatAccountUsageLane,
  ChatAccountUsageOverview,
} from '../services/chatAccountUsage.js'
import { CourseListEntryRef, type ICourseListEntry } from './course.js'
import { PermissionLevel, SharingType } from './sharing.js'

// ----- ANSWER COLLECTIONS -----
// #region
interface IAnswerCollectionEntry extends DB.AnswerCollectionEntry {
  numSolutionUsages?: number
}

export const AnswerCollectionEntryRef =
  builder.objectRef<IAnswerCollectionEntry>('AnswerCollectionEntry')
export const AnswerCollectionEntry = AnswerCollectionEntryRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    value: t.exposeString('value'),
    numSolutionUsages: t.exposeInt('numSolutionUsages', { nullable: true }),
  }),
})

interface IAnswerCollectionPreviewEntry {
  id: number
  value: string
}

export const AnswerCollectionPreviewEntryRef =
  builder.objectRef<IAnswerCollectionPreviewEntry>(
    'AnswerCollectionPreviewEntry'
  )
export const AnswerCollectionPreviewEntry =
  AnswerCollectionPreviewEntryRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

interface IAnswerCollection extends DB.AnswerCollection {
  entries?: DB.AnswerCollectionEntry[]
  numOfEntries?: number
  permissionLevel?: DB.PermissionLevel
  ownerShortname?: string
  numSharedUsers?: number
  isOwner?: boolean // = OWNER
  isManager?: boolean // = OWNER / ADMIN
  isEditor?: boolean // = OWNER / ADMIN / WRITE
  isImported?: boolean // imported flag for UI icon
  isShared?: boolean // flag to signal whether the object is owned or shared
  isRemovable?: boolean // flag to signal the option to remove the direct individual permission & the existence of dependent objects
  isDeletable?: boolean // flag to signal whether the object can be deleted / the existence of dependent objects
  sharingType?: SharingTypeEnum // owned / shared / dependency
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description'),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
    numOfEntries: t.exposeInt('numOfEntries', { nullable: true }),
    permissionLevel: t.expose('permissionLevel', {
      type: PermissionLevel,
      nullable: true,
    }),

    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    isManager: t.exposeBoolean('isManager', { nullable: true }),
    isEditor: t.exposeBoolean('isEditor', { nullable: true }),
    isImported: t.exposeBoolean('isImported', { nullable: true }),
    isShared: t.exposeBoolean('isShared', { nullable: true }),
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
    isDeletable: t.exposeBoolean('isDeletable', { nullable: true }),
    sharingType: t.expose('sharingType', { type: SharingType, nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})

// #endregion

// ----- CHATBOTS -----
// #region
export const CreditResetPeriod = builder.enumType('CreditResetPeriod', {
  values: Object.values(DB.CreditResetPeriod),
})

export const ChatbotStatus = builder.enumType('ChatbotStatus', {
  values: Object.values(DB.ChatbotStatus),
})

export const ChatUsageClass = builder.enumType('ChatUsageClass', {
  values: Object.values(DB.ChatUsageClass),
})

export const ChatAccountUsageLaneRef = builder.objectRef<ChatAccountUsageLane>(
  'ChatAccountUsageLane'
)
export const ChatAccountUsageLaneType = ChatAccountUsageLaneRef.implement({
  fields: (t) => ({
    usageClass: t.expose('usageClass', { type: ChatUsageClass }),
    budgetCredits: t.exposeFloat('budgetCredits'),
    usedCredits: t.exposeFloat('usedCredits'),
    remainingCredits: t.exposeFloat('remainingCredits'),
    resetAt: t.expose('resetAt', { type: 'Date' }),
  }),
})

export const ChatAccountUsageOverviewRef =
  builder.objectRef<ChatAccountUsageOverview>('ChatAccountUsageOverview')
export const ChatAccountUsageOverviewType =
  ChatAccountUsageOverviewRef.implement({
    fields: (t) => ({
      authorized: t.exposeBoolean('authorized'),
      baseModelUsage: t.expose('baseModelUsage', {
        type: ChatAccountUsageLaneRef,
      }),
      advancedModelUsage: t.expose('advancedModelUsage', {
        type: ChatAccountUsageLaneRef,
      }),
    }),
  })

export interface IChatbotReasoningConfig {
  modelId: string
  efforts: string[]
}

export type ChatbotReasoningConfigInputType = {
  modelId: string
  efforts: string[]
}

export const ChatbotReasoningConfigInputRef =
  builder.inputRef<ChatbotReasoningConfigInputType>(
    'ChatbotReasoningConfigInput'
  )
export const ChatbotReasoningConfigInput =
  ChatbotReasoningConfigInputRef.implement({
    fields: (t) => ({
      modelId: t.string({ required: true }),
      efforts: t.stringList({ required: true }),
    }),
  })

export const ChatbotReasoningConfigRef =
  builder.objectRef<IChatbotReasoningConfig>('ChatbotReasoningConfig')
export const ChatbotReasoningConfig = ChatbotReasoningConfigRef.implement({
  fields: (t) => ({
    modelId: t.exposeString('modelId'),
    efforts: t.exposeStringList('efforts'),
  }),
})

export interface IChatModelCapability {
  id: string
  name: string
  description: string
  fallback: boolean
  supportsReasoning: boolean
  supportedReasoningEfforts: string[]
}

export const ChatModelCapabilityRef = builder.objectRef<IChatModelCapability>(
  'ChatModelCapability'
)
export const ChatModelCapability = ChatModelCapabilityRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description'),
    fallback: t.exposeBoolean('fallback'),
    supportsReasoning: t.exposeBoolean('supportsReasoning'),
    supportedReasoningEfforts: t.exposeStringList('supportedReasoningEfforts'),
  }),
})

export interface IChatbot {
  id: string
  name: string
  description?: string | null
  avatar?: string | null
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel?: IChatbotReasoningConfig[]
  creditInitialCredits: number
  creditResetPeriod: DB.CreditResetPeriod
  creditResetAmount: number
  creditMaxCredits: number
  status: DB.ChatbotStatus
  publicationUseCase?: string | null
  expectedStudentCount?: number | null
  reviewComment?: string | null
  publishedAt?: Date | null
  courses?: ICourseListEntry[]
  createdAt?: Date | null
  updatedAt?: Date | null
  usageSummary?: IChatbotUsageSummary | null
  disclaimerSummary?: IChatbotDisclaimerSummary | null
  mcpConfigurations?: IChatbotMcpConfigurationSummary[]
}

export interface IChatbotPublic {
  id: string
  name: string
  description?: string | null
  avatar?: string | null
}
export const ChatbotPublicRef =
  builder.objectRef<IChatbotPublic>('ChatbotPublic')
export const ChatbotPublic = ChatbotPublicRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
  }),
})

export interface IChatbotUsageSummary {
  threadCount: number
  messageCount: number
  participantCount: number
  lastActivityAt?: Date | null
  totalCredits?: number | null
  currentCredits?: number | null
  totalResets?: number | null
  lastResetAt?: Date | null
}

export const ChatbotUsageSummaryRef = builder.objectRef<IChatbotUsageSummary>(
  'ChatbotUsageSummary'
)
export const ChatbotUsageSummary = ChatbotUsageSummaryRef.implement({
  fields: (t) => ({
    threadCount: t.exposeInt('threadCount'),
    messageCount: t.exposeInt('messageCount'),
    participantCount: t.exposeInt('participantCount'),
    lastActivityAt: t.expose('lastActivityAt', {
      type: 'Date',
      nullable: true,
    }),
    totalCredits: t.exposeFloat('totalCredits', { nullable: true }),
    currentCredits: t.exposeFloat('currentCredits', { nullable: true }),
    totalResets: t.exposeInt('totalResets', { nullable: true }),
    lastResetAt: t.expose('lastResetAt', { type: 'Date', nullable: true }),
  }),
})

export interface IChatbotDisclaimerSummary {
  id: string
  name: string
  title: string
  acceptedCount: number
  declinedCount: number
  pendingCount: number
}

export const ChatbotDisclaimerSummaryRef =
  builder.objectRef<IChatbotDisclaimerSummary>('ChatbotDisclaimerSummary')
export const ChatbotDisclaimerSummary = ChatbotDisclaimerSummaryRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    title: t.exposeString('title'),
    acceptedCount: t.exposeInt('acceptedCount'),
    declinedCount: t.exposeInt('declinedCount'),
    pendingCount: t.exposeInt('pendingCount'),
  }),
})

export interface IChatbotMcpConfigurationSummary {
  serverId: string
  serverName: string
  serverDescription?: string | null
  serverIsActive: boolean
  chatMode: string
  isEnabled: boolean
  priority: number
  allowedToolsCount?: number | null
}

export const ChatbotMcpConfigurationSummaryRef =
  builder.objectRef<IChatbotMcpConfigurationSummary>(
    'ChatbotMcpConfigurationSummary'
  )
export const ChatbotMcpConfigurationSummary =
  ChatbotMcpConfigurationSummaryRef.implement({
    fields: (t) => ({
      serverId: t.exposeID('serverId'),
      serverName: t.exposeString('serverName'),
      serverDescription: t.exposeString('serverDescription', {
        nullable: true,
      }),
      serverIsActive: t.exposeBoolean('serverIsActive'),
      chatMode: t.exposeString('chatMode'),
      isEnabled: t.exposeBoolean('isEnabled'),
      priority: t.exposeInt('priority'),
      allowedToolsCount: t.exposeInt('allowedToolsCount', { nullable: true }),
    }),
  })

export const ChatbotRef = builder.objectRef<IChatbot>('Chatbot')
export const Chatbot = ChatbotRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
    modelSelection: t.exposeBoolean('modelSelection'),
    allowedModelIds: t.exposeStringList('allowedModelIds'),
    allowedReasoningEffortsByModel: t.field({
      type: [ChatbotReasoningConfigRef],
      resolve: (chatbot) => chatbot.allowedReasoningEffortsByModel ?? [],
    }),
    creditInitialCredits: t.exposeInt('creditInitialCredits'),
    creditResetPeriod: t.expose('creditResetPeriod', {
      type: CreditResetPeriod,
    }),
    creditResetAmount: t.exposeInt('creditResetAmount'),
    creditMaxCredits: t.exposeInt('creditMaxCredits'),
    status: t.expose('status', { type: ChatbotStatus }),
    publicationUseCase: t.exposeString('publicationUseCase', {
      nullable: true,
    }),
    expectedStudentCount: t.exposeInt('expectedStudentCount', {
      nullable: true,
    }),
    reviewComment: t.exposeString('reviewComment', { nullable: true }),
    publishedAt: t.expose('publishedAt', { type: 'Date', nullable: true }),
    courses: t.field({
      type: [CourseListEntryRef],
      resolve: (chatbot) => chatbot.courses ?? [],
    }),
    usageSummary: t.field({
      type: ChatbotUsageSummaryRef,
      nullable: true,
      resolve: (chatbot) => chatbot.usageSummary ?? null,
    }),
    disclaimerSummary: t.field({
      type: ChatbotDisclaimerSummaryRef,
      nullable: true,
      resolve: (chatbot) => chatbot.disclaimerSummary ?? null,
    }),
    mcpConfigurations: t.field({
      type: [ChatbotMcpConfigurationSummaryRef],
      resolve: (chatbot) => chatbot.mcpConfigurations ?? [],
    }),
    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})

// #endregion
