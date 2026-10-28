import { prisma } from '@klicker-uzh/prisma'
import type { ChatUsageClass, Prisma } from '@klicker-uzh/prisma/client'
import type {
  EngineMessage,
  ImageAttachment,
} from '@klicker-uzh/chat-engine-contract'
import { compileSystemPrompt } from '../host/lib/server/systemPromptCompiler.js'
import type {
  AnswerStyle,
  AnswerTone,
} from '../host/lib/config/answerStyles.js'
import type { ChatModeMCPConfiguration } from '../host/lib/server/effectiveChatModes.js'
import { CreditsService } from '../host/services/credits.js'
import { DisclaimersService } from '../host/services/disclaimers.js'
import { finalizeChatTurn } from '../host/services/accountUsage.js'

export type ChatbotRecord = {
  id: string
  courseId: string
  ownerId: string
  owner: { aiFeaturesEnabled: boolean }
  course: { displayName: string }
  standardModeConfig: unknown
  answerPreferencesEnabled: boolean
  mcpConfigurations: ChatModeMCPConfiguration[]
  systemPrompts: unknown
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: unknown
  openaiApiKey: string | null
  openaiBaseUrl: string | null
  disclaimerId: string | null
}

export type Credits = { current: number; total: number }

export type PersistedMessage = {
  id: string
  threadId: string
  parentId: string | null
  role: string
  content: unknown
  attachments: Array<{
    id: string
    imageBase64: string | null
    imageDescription: string | null
  }>
}

export type FinalizeAssistantInput = {
  ownerId: string
  usageClass: ChatUsageClass
  lifecycleAttemptId: string | null
  participantId: string
  chatbotId: string
  threadId: string
  assistantMessageId: string
  userMessageId: string | null
  chatMode: string
  modelId: string
  reasoningEffort: string | null
  reasoningContent: string | null
  content: unknown[]
  creditsUsed: number | null
}

export type FinalizeAssistantResult = {
  creditsUsed?: number | null
  persisted: boolean
  creditsCharged: boolean
}

export function getSystemPrompt(
  chatbot: ChatbotRecord,
  mode: string,
  context: {
    toolNames: readonly string[]
    answerStyle?: AnswerStyle
    answerTone?: AnswerTone
  }
): string {
  return compileSystemPrompt(chatbot.systemPrompts, mode, {
    courseDisplayName: chatbot.course.displayName,
    standardModeConfig: chatbot.standardModeConfig,
    ...context,
  })
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function contentParts(
  message: PersistedMessage,
  bodyMessage: { id: string; role: 'user' | 'assistant'; content: string },
  images: ImageAttachment[]
): EngineMessage {
  const parts: EngineMessage['parts'] = []
  const rawContent = Array.isArray(message.content) ? message.content : []
  for (const rawPart of rawContent) {
    const part = jsonRecord(rawPart)
    if (!part || typeof part.type !== 'string') continue
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({ type: 'text', text: part.text })
    } else if (part.type === 'reasoning' && typeof part.text === 'string') {
      parts.push({ type: 'reasoning', text: part.text })
    } else if (part.type === 'tool-call') {
      const toolCallId =
        typeof part.toolCallId === 'string' ? part.toolCallId : null
      const toolName = typeof part.toolName === 'string' ? part.toolName : null
      if (!toolCallId || !toolName) continue
      parts.push({
        type: 'tool-call',
        toolCallId,
        toolName,
        input: part.args,
        output: part.result,
        ...(part.isError === true ? { isError: true } : {}),
      })
    }
  }

  if (parts.length === 0 && bodyMessage.content.length > 0) {
    parts.push({ type: 'text', text: bodyMessage.content })
  }
  if (bodyMessage.role === 'user' && message.id === bodyMessage.id) {
    for (const image of images) parts.push(image)
  }
  if (parts.length === 0) parts.push({ type: 'text', text: '' })
  return { id: bodyMessage.id, role: bodyMessage.role, parts }
}

export async function loadEngineMessages(
  threadId: string,
  bodyMessages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
  }>,
  images: ImageAttachment[]
): Promise<EngineMessage[]> {
  const records = await prisma.chatMessage.findMany({
    where: { threadId, id: { in: bodyMessages.map((message) => message.id) } },
    include: {
      attachments: {
        orderBy: { position: 'asc' },
        select: { id: true, imageBase64: true, imageDescription: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const byId = new Map(
    records.map((record) => [record.id, record as unknown as PersistedMessage])
  )
  return bodyMessages.map((bodyMessage) => {
    const record = byId.get(bodyMessage.id) ?? {
      id: bodyMessage.id,
      threadId,
      parentId: null,
      role: bodyMessage.role,
      content: [{ type: 'text', text: bodyMessage.content }],
      attachments: [],
    }
    const bodyImages =
      bodyMessage.id === bodyMessages[bodyMessages.length - 1]?.id ? images : []
    return contentParts(record, bodyMessage, bodyImages)
  })
}

export async function getChatbot(
  chatbotId: string
): Promise<ChatbotRecord | null> {
  return prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      id: true,
      courseId: true,
      ownerId: true,
      owner: { select: { aiFeaturesEnabled: true } },
      course: { select: { displayName: true } },
      systemPrompts: true,
      standardModeConfig: true,
      modelSelection: true,
      answerPreferencesEnabled: true,
      allowedModelIds: true,
      allowedReasoningEffortsByModel: true,
      openaiApiKey: true,
      openaiBaseUrl: true,
      disclaimerId: true,
      mcpConfigurations: {
        select: {
          chatMode: true,
          allowedTools: true,
          isEnabled: true,
          parameters: true,
          mcpServerId: true,
          priority: true,
        },
      },
    },
  })
}

export async function checkDisclaimer(
  participantId: string,
  chatbotId: string,
  _disclaimerId: string | null
) {
  return DisclaimersService.checkDisclaimerStatus(chatbotId, participantId)
}

export async function getThread(
  threadId: string,
  participantId: string,
  chatbotId: string
) {
  return prisma.chatThread.findFirst({
    where: { id: threadId, participantId, chatbotId },
    select: { id: true },
  })
}

export async function getCredits(
  participantId: string,
  chatbotId: string
): Promise<Credits> {
  return CreditsService.getUserCredits(participantId, chatbotId)
}

export async function persistUserMessage(input: {
  threadId: string
  messageId: string
  parentId: string | null
  content: string
  chatMode: string
  modelId: string
  reasoningEffort: string | null
  attachments: ImageAttachment[]
}) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.chatMessage.findUnique({
      where: { id: input.messageId },
      select: { threadId: true, role: true },
    })
    if (existing) {
      if (existing.threadId !== input.threadId || existing.role !== 'user')
        throw new Error('Message identity is unavailable')
      return
    }
    if (input.parentId) {
      const parent = await tx.chatMessage.findFirst({
        where: {
          id: input.parentId,
          threadId: input.threadId,
          lifecycleStatus: 'COMPLETED',
        },
        select: { id: true },
      })
      if (!parent) throw new Error('Parent message is unavailable')
    }
    await tx.chatMessage.create({
      data: {
        id: input.messageId,
        threadId: input.threadId,
        parentId: input.parentId,
        role: 'user',
        content: [{ type: 'text', text: input.content }],
        chatMode: input.chatMode,
        modelId: input.modelId,
        reasoningEffort: input.reasoningEffort,
      },
    })
    if (input.attachments.length > 0) {
      await tx.chatAttachment.createMany({
        data: input.attachments.map((attachment, position) => ({
          type: 'IMAGE' as const,
          messageId: input.messageId,
          position,
          imageBase64: attachment.dataUrl,
          imagePreviewBase64: null,
          imageDescription: attachment.description ?? null,
        })),
      })
    }
    await tx.chatThread.update({
      where: { id: input.threadId },
      data: { updatedAt: new Date() },
    })
  })
}

export async function finalizeAssistantTurn(
  input: FinalizeAssistantInput
): Promise<FinalizeAssistantResult> {
  const result = await finalizeChatTurn({
    ownerId: input.ownerId,
    usageClass: input.usageClass,
    lifecycleAttemptId: input.lifecycleAttemptId,
    participantId: input.participantId,
    chatbotId: input.chatbotId,
    threadId: input.threadId,
    assistantMessageId: input.assistantMessageId,
    parentId: input.userMessageId,
    content: input.content as Prisma.InputJsonValue,
    chatMode: input.chatMode,
    modelId: input.modelId,
    reasoningEffort: input.reasoningEffort,
    reasoningContent: input.reasoningContent,
    rawCreditsUsed: input.creditsUsed,
  })
  return {
    creditsUsed: result.creditsUsed,
    persisted: result.outcome !== 'empty',
    creditsCharged:
      result.outcome === 'completed' && result.creditsUsed !== null,
  }
}
