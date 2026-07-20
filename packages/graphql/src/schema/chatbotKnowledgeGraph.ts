import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  AvailableChatbotKnowledgeGraphResource,
  AvailableChatbotKnowledgeGraphResourceGroup,
  ChatbotKnowledgeGraphConfig,
} from '../services/chatbotKnowledgeGraphs.js'
import { KBResourceStatus, KBResourceType, KBSpeedMode } from './knowledge.js'

function toGraphQLSpeedMode(speedMode: DB.KBIngestionSpeedMode | null) {
  switch (speedMode) {
    case DB.KBIngestionSpeedMode.BALANCED:
      return 'balanced' as const
    case DB.KBIngestionSpeedMode.QUALITY:
      return 'quality' as const
    case DB.KBIngestionSpeedMode.FAST:
      return 'fast' as const
    case null:
      return null
  }
}

export const ChatbotKnowledgeGraphStatus = builder.enumType(
  'ChatbotKnowledgeGraphStatus',
  { values: Object.values(DB.ChatbotKnowledgeGraphStatus) }
)

export const AvailableChatbotKnowledgeGraphResourceRef =
  builder.objectRef<AvailableChatbotKnowledgeGraphResource>(
    'AvailableChatbotKnowledgeGraphResource'
  )
export const AvailableChatbotKnowledgeGraphResourceType =
  AvailableChatbotKnowledgeGraphResourceRef.implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      type: t.expose('type', { type: KBResourceType }),
      title: t.exposeString('title'),
      status: t.expose('status', { type: KBResourceStatus }),
      assignmentChatbotId: t.exposeID('assignmentChatbotId', {
        nullable: true,
      }),
      assignmentChatbotName: t.exposeString('assignmentChatbotName', {
        nullable: true,
      }),
    }),
  })

export const AvailableChatbotKnowledgeGraphResourceGroupRef =
  builder.objectRef<AvailableChatbotKnowledgeGraphResourceGroup>(
    'AvailableChatbotKnowledgeGraphResourceGroup'
  )
export const AvailableChatbotKnowledgeGraphResourceGroupType =
  AvailableChatbotKnowledgeGraphResourceGroupRef.implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      description: t.exposeString('description', { nullable: true }),
      resources: t.expose('resources', {
        type: [AvailableChatbotKnowledgeGraphResourceRef],
      }),
    }),
  })

export const ChatbotKnowledgeGraphConfigRef =
  builder.objectRef<ChatbotKnowledgeGraphConfig>('ChatbotKnowledgeGraphConfig')
export const ChatbotKnowledgeGraphConfigType =
  ChatbotKnowledgeGraphConfigRef.implement({
    fields: (t) => ({
      id: t.exposeID('id', { nullable: true }),
      chatbotId: t.exposeID('chatbotId'),
      status: t.expose('status', { type: ChatbotKnowledgeGraphStatus }),
      statusMessage: t.exposeString('statusMessage', { nullable: true }),
      selectionRevision: t.exposeInt('selectionRevision'),
      builtRevision: t.exposeInt('builtRevision', { nullable: true }),
      activeBuildRevision: t.exposeInt('activeBuildRevision', {
        nullable: true,
      }),
      externalWorkflowRunId: t.exposeString('externalWorkflowRunId', {
        nullable: true,
      }),
      externalStartedAt: t.expose('externalStartedAt', {
        type: 'Date',
        nullable: true,
      }),
      lastBuiltAt: t.expose('lastBuiltAt', {
        type: 'Date',
        nullable: true,
      }),
      lastBuildSpeedMode: t.field({
        type: KBSpeedMode,
        nullable: true,
        resolve: ({ lastBuildSpeedMode }) =>
          toGraphQLSpeedMode(lastBuildSpeedMode),
      }),
      selectedResourceIds: t.field({
        type: ['ID'],
        resolve: ({ selectedResourceIds }) => selectedResourceIds,
      }),
      createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
      updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
    }),
  })
