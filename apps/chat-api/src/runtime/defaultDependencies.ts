import { prisma } from '@klicker-uzh/prisma'
import { CreditResetPeriod } from '@klicker-uzh/prisma/client'
import type {
  EngineMessage,
  ImageAttachment,
} from '@klicker-uzh/chat-engine-contract'
import { getCurrentPeriodStart, isPeriodExpired } from './creditPeriods.js'
import { DEFAULT_TUTOR_PROMPT } from './prompts.js'

export type ChatbotRecord = {
  id: string
  courseId: string
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
  persisted: boolean
  creditsCharged: boolean
}

export function getSystemPrompt(chatbot: ChatbotRecord, mode: string): string {
  const prompts =
    chatbot.systemPrompts && typeof chatbot.systemPrompts === 'object'
      ? (chatbot.systemPrompts as Record<string, unknown>)
      : {}
  const selected = prompts[mode]
  let basePrompt: string | null = null
  if (selected && typeof selected === 'object') {
    const prompt = (selected as Record<string, unknown>).prompt
    if (typeof prompt === 'string' && prompt.length > 0) basePrompt = prompt
  }
  basePrompt ??=
    mode === 'tutor'
      ? DEFAULT_TUTOR_PROMPT
      : 'You are KlickerChat, an educational assistant. Answer clearly and help the learner.'
  return `${basePrompt.trimEnd()}\n\nLanguage style: when writing German, use Swiss High German orthography. Write "ss" instead of "ß" (e.g. "gross", not "groß"), and always use real umlauts (ä, ö, ü and Ä, Ö, Ü).`
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
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      id: true,
      courseId: true,
      systemPrompts: true,
      modelSelection: true,
      allowedModelIds: true,
      allowedReasoningEffortsByModel: true,
      openaiApiKey: true,
      openaiBaseUrl: true,
      disclaimerId: true,
    },
  })
  return chatbot
}

export async function checkDisclaimer(
  participantId: string,
  chatbotId: string,
  disclaimerId: string | null
) {
  if (!disclaimerId) return { required: false, accepted: true }
  const credits = await prisma.chatUsageCredits.findUnique({
    where: { participantId_chatbotId: { participantId, chatbotId } },
    select: { acceptedDisclaimerId: true, disclaimerDeclined: true },
  })
  return {
    required: true,
    accepted:
      credits?.acceptedDisclaimerId === disclaimerId &&
      !credits.disclaimerDeclined,
  }
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

async function initializeCredits(
  participantId: string,
  chatbotId: string
): Promise<Credits> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      creditInitialCredits: true,
      creditMaxCredits: true,
      creditResetPeriod: true,
    },
  })
  const initial = chatbot?.creditInitialCredits ?? 1
  const max = chatbot?.creditMaxCredits ?? 1
  const period = chatbot?.creditResetPeriod ?? CreditResetPeriod.WEEKLY
  const created = await prisma.chatUsageCredits.upsert({
    where: { participantId_chatbotId: { participantId, chatbotId } },
    create: {
      participantId,
      chatbotId,
      current: initial,
      total: max,
      periodStartedAt: getCurrentPeriodStart(period),
      lastResetAt: new Date(),
    },
    update: { participantId },
  })
  return {
    current: created.current.toNumber(),
    total: created.total.toNumber(),
  }
}

export async function getCredits(
  participantId: string,
  chatbotId: string
): Promise<Credits> {
  const credits = await prisma.chatUsageCredits.findUnique({
    where: { participantId_chatbotId: { participantId, chatbotId } },
  })
  if (!credits) return initializeCredits(participantId, chatbotId)
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
    },
  })
  if (
    chatbot &&
    chatbot.creditResetPeriod !== CreditResetPeriod.NONE &&
    isPeriodExpired(
      credits.periodStartedAt ?? credits.createdAt,
      chatbot.creditResetPeriod
    )
  ) {
    const current = Math.min(
      credits.current.toNumber() + chatbot.creditResetAmount,
      chatbot.creditMaxCredits
    )
    const updated = await prisma.chatUsageCredits.update({
      where: { participantId_chatbotId: { participantId, chatbotId } },
      data: {
        current,
        total: chatbot.creditMaxCredits,
        periodStartedAt: getCurrentPeriodStart(chatbot.creditResetPeriod),
        lastResetAt: new Date(),
        resetCount: { increment: 1 },
      },
    })
    return {
      current: updated.current.toNumber(),
      total: updated.total.toNumber(),
    }
  }
  return {
    current: credits.current.toNumber(),
    total: credits.total.toNumber(),
  }
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
      select: { threadId: true },
    })
    if (existing) return
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
  return prisma.$transaction(async (tx) => {
    const existing = await tx.chatMessage.findUnique({
      where: { id: input.assistantMessageId },
      select: { threadId: true },
    })
    if (existing)
      return {
        persisted: existing.threadId === input.threadId,
        creditsCharged: false,
      }

    await tx.chatMessage.create({
      data: {
        id: input.assistantMessageId,
        threadId: input.threadId,
        parentId: input.userMessageId,
        role: 'assistant',
        content: input.content,
        chatMode: input.chatMode,
        modelId: input.modelId,
        reasoningEffort: input.reasoningEffort,
        reasoningContent: input.reasoningContent,
        creditsUsed: input.creditsUsed,
      },
    })
    await tx.chatThread.update({
      where: { id: input.threadId },
      data: { updatedAt: new Date() },
    })

    if (input.creditsUsed === null || input.creditsUsed <= 0) {
      return { persisted: true, creditsCharged: false }
    }
    const credits = await tx.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId: input.participantId,
          chatbotId: input.chatbotId,
        },
      },
    })
    if (!credits) throw new Error('Credits record not found')
    await tx.chatUsageCredits.update({
      where: {
        participantId_chatbotId: {
          participantId: input.participantId,
          chatbotId: input.chatbotId,
        },
      },
      data: {
        current: Math.max(0, credits.current.toNumber() - input.creditsUsed),
      },
    })
    return { persisted: true, creditsCharged: true }
  })
}
