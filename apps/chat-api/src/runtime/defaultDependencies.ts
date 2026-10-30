import { randomUUID } from 'node:crypto'
import {
  CHAT_ENGINE_CONTRACT_V2,
  type EngineV2ChatRequest,
  type EngineV2Message,
  type ImageAttachment,
  type ImageV2Attachment,
  imageV2AttachmentSchema,
} from '@klicker-uzh/chat-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import type {
  AiSubscriptionTier,
  ChatUsageClass,
  Prisma,
} from '@klicker-uzh/prisma/client'
import type { EngineClient } from '../engine/client.js'
import {
  createValidatedPlatformStream,
  usageIsChargeable,
} from '../engine/stream.js'
import { buildDocumentPageSummaryRow } from '../host/lib/attachments/attachmentState.js'
import { stripDocumentBlocks } from '../host/lib/attachments/documentText.js'
import type {
  AnswerStyle,
  AnswerTone,
} from '../host/lib/config/answerStyles.js'
import type { ChatModeMCPConfiguration } from '../host/lib/server/effectiveChatModes.js'
import { ensureImagePreviewBase64 } from '../host/lib/server/imagePreview.js'
import { renderPromptTemplate } from '../host/lib/server/promptTemplates.js'
import { compileSystemPrompt } from '../host/lib/server/systemPromptCompiler.js'
import { finalizeChatTurn } from '../host/services/accountUsage.js'
import {
  formatKlickerChatContextForPrompt,
  sanitizeKlickerChatContextV2,
} from '../host/services/chatContext.js'
import { CreditsService } from '../host/services/credits.js'
import { DisclaimersService } from '../host/services/disclaimers.js'
import {
  formatElearningEvidencePolicy,
  formatElearningSnapshotContext,
  matchesPersistedLearningHistory,
  normalizePersistedLearningContext,
  resolveElearningTurnContext,
  verifyAndNormalizeElearningChatContext,
} from '../host/services/elearningContext.js'
import type { MCPServerConfig } from '../host/services/mcpClients.js'
import { calculateCost } from '../policy/modelRegistry.js'

export type ChatbotRecord = {
  id: string
  courseId: string
  ownerId: string
  owner: {
    aiFeaturesEnabled: boolean
    aiSubscriptionTier: AiSubscriptionTier
    aiChatbotCostCenter: string | null
  }
  course: { displayName: string }
  standardModeConfig: unknown
  customModeConfig?: unknown
  knowledgeGraphRetrievalEnabled?: boolean
  answerPreferencesEnabled: boolean
  mcpConfigurations: Array<
    ChatModeMCPConfiguration & {
      mcpServer?: Omit<MCPServerConfig, 'authSecret' | 'chatbotIdHeader'> & {
        authSecret?: MCPServerConfig['authSecret'] | null
        chatbotIdHeader?: MCPServerConfig['chatbotIdHeader'] | null
      }
    }
  >
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
    imagePreviewBase64: string | null
    imageDescription: string | null
  }>
}

type ReplayAttachment = {
  id: string
  description: string | null
  original: ImageV2Attachment | null
  selected: boolean
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
    customModeConfig: chatbot.customModeConfig,
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
  role: 'user' | 'assistant',
  attachments: ReplayAttachment[]
): EngineV2Message {
  const parts: EngineV2Message['parts'] = []
  const addPart = (part: EngineV2Message['parts'][number]) => {
    if (parts.length >= 256) throw new Error('Message has too many parts')
    parts.push(part)
  }
  const addText = (type: 'text' | 'reasoning', text: string) => {
    const previous = parts.at(-1)
    if (
      (previous?.type === 'text' || previous?.type === 'reasoning') &&
      previous.type === type
    ) {
      if (text.length === 0) return
      text = previous.text + text
      parts.pop()
    }
    let start = 0
    do {
      let end = Math.min(start + 200_000, text.length)
      if (
        end < text.length &&
        text.charCodeAt(end - 1) >= 0xd800 &&
        text.charCodeAt(end - 1) <= 0xdbff &&
        text.charCodeAt(end) >= 0xdc00 &&
        text.charCodeAt(end) <= 0xdfff
      ) {
        end -= 1
      }
      addPart({ type, text: text.slice(start, end) })
      start = end
    } while (start < text.length)
  }
  const rawContent = Array.isArray(message.content) ? message.content : []
  for (const rawPart of rawContent) {
    const part = jsonRecord(rawPart)
    if (!part || typeof part.type !== 'string') continue
    if (part.type === 'text' && typeof part.text === 'string') {
      addText('text', part.text)
    } else if (part.type === 'reasoning' && typeof part.text === 'string') {
      addText('reasoning', part.text)
    } else if (part.type === 'tool-call') {
      const toolCallId =
        typeof part.toolCallId === 'string' ? part.toolCallId : null
      const toolName = typeof part.toolName === 'string' ? part.toolName : null
      const output = part.result !== undefined ? part.result : part.output
      if (!toolCallId || !toolName || output === undefined) continue
      addPart({
        type: 'tool-call',
        toolCallId,
        toolName,
        input: part.args !== undefined ? part.args : part.input,
        output,
        ...(part.isError === true ? { isError: true } : {}),
      })
    }
  }

  if (role === 'user') {
    for (const attachment of message.attachments) {
      if (
        attachment.imageBase64 === null &&
        attachment.imagePreviewBase64 === null &&
        attachment.imageDescription?.trim()
      ) {
        addText(
          'text',
          `\n\nDocument page summary:\n${attachment.imageDescription}`
        )
      }
    }
  }
  for (const attachment of attachments) {
    if (attachment.selected && attachment.original) {
      addPart(attachment.original)
      if (attachment.description && attachment.description.length > 20_000) {
        addText(
          'text',
          `\n\nImage ${attachment.id} description: ${attachment.description}`
        )
      }
    } else if (attachment.description?.trim()) {
      addText(
        'text',
        `\n\nImage ${attachment.id} description: ${attachment.description}`
      )
    } else {
      addText(
        'text',
        `\n\nImage ${attachment.id} is unavailable in this context. Ask the user to reattach it if needed.`
      )
    }
  }
  if (parts.length === 0) addPart({ type: 'text', text: '' })
  return { id: message.id, role, parts }
}

export async function loadEngineMessages(
  threadId: string,
  bodyMessages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
  }>,
  images: ImageAttachment[]
): Promise<EngineV2Message[]> {
  const records = await prisma.chatMessage.findMany({
    where: { threadId, id: { in: bodyMessages.map((message) => message.id) } },
    include: {
      attachments: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          imageBase64: true,
          imagePreviewBase64: true,
          imageDescription: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const byId = new Map(
    records.map((record) => [record.id, record as unknown as PersistedMessage])
  )
  const current = bodyMessages[bodyMessages.length - 1]
  if (images.length > 0 && current?.role !== 'user') {
    throw new Error('Current images require a user message')
  }

  const makeAttachment = (
    id: string,
    dataUrl: string | null,
    description: string | null,
    declaredMediaType?: ImageAttachment['mediaType']
  ): ReplayAttachment => {
    const mediaType = dataUrl?.match(
      /^data:(image\/(?:jpeg|png|gif|webp));base64,/
    )?.[1]
    const parsed = imageV2AttachmentSchema.safeParse({
      id,
      type: 'image',
      source: 'attachment',
      mediaType: declaredMediaType ?? mediaType,
      dataUrl,
      ...(description !== null && description.length <= 20_000
        ? { description }
        : {}),
    })
    return {
      id,
      description,
      original: parsed.success ? parsed.data : null,
      selected: false,
    }
  }

  const attachmentsById = new Map<string, ReplayAttachment[]>()
  const messages = bodyMessages.map((bodyMessage, index) => {
    if (attachmentsById.has(bodyMessage.id)) {
      throw new Error('Message identity is duplicated')
    }
    let record = byId.get(bodyMessage.id)
    if (!record) {
      if (index !== bodyMessages.length - 1 || bodyMessage.role !== 'user') {
        throw new Error('Historical message is unavailable')
      }
      record = {
        id: bodyMessage.id,
        threadId,
        parentId: null,
        role: 'user',
        content: [{ type: 'text', text: bodyMessage.content }],
        attachments: [],
      }
    } else if (
      record.threadId !== threadId ||
      record.role !== bodyMessage.role
    ) {
      throw new Error('Message identity is unavailable')
    }
    if (
      index === bodyMessages.length - 1 &&
      bodyMessage.role === 'user' &&
      record.content == null &&
      bodyMessage.content.length > 0
    ) {
      record = {
        ...record,
        content: [{ type: 'text', text: bodyMessage.content }],
      }
    }

    const attachments =
      bodyMessage.role !== 'user'
        ? []
        : bodyMessage.id === current?.id && images.length > 0
          ? images.map((image) =>
              makeAttachment(
                image.id,
                image.dataUrl,
                image.description ?? null,
                image.mediaType
              )
            )
          : record.attachments
              .filter(
                (attachment) =>
                  attachment.imageBase64 !== null ||
                  attachment.imagePreviewBase64 !== null
              )
              .map((attachment) =>
                makeAttachment(
                  attachment.id,
                  attachment.imageBase64,
                  attachment.imageDescription
                )
              )
    attachmentsById.set(bodyMessage.id, attachments)
    return { record, role: bodyMessage.role, attachments }
  })

  let selectedImages = 0
  const selectImages = (attachments: ReplayAttachment[]) => {
    for (const attachment of attachments) {
      if (attachment.original && selectedImages < 3) {
        attachment.selected = true
        selectedImages += 1
      }
    }
  }
  if (current && images.length > 0) {
    selectImages(attachmentsById.get(current.id) ?? [])
  }
  for (const record of [...records].reverse()) {
    if (
      (record.id === current?.id && images.length > 0) ||
      record.role !== 'user'
    ) {
      continue
    }
    selectImages(attachmentsById.get(record.id) ?? [])
  }

  return messages.map(({ record, role, attachments }) =>
    contentParts(record, role, attachments)
  )
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
      owner: {
        select: {
          aiFeaturesEnabled: true,
          aiSubscriptionTier: true,
          aiChatbotCostCenter: true,
        },
      },
      course: { select: { displayName: true } },
      systemPrompts: true,
      standardModeConfig: true,
      customModeConfig: true,
      knowledgeGraphRetrievalEnabled: true,
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
          mcpServer: true,
          priority: true,
        },
      },
    },
  })
}

export async function checkDisclaimer(
  participantId: string,
  chatbotId: string
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
    select: { id: true, origin: true },
  })
}

export async function previewCredits(
  participantId: string,
  chatbotId: string
): Promise<Credits> {
  return CreditsService.previewUserCredits(participantId, chatbotId)
}

export async function getCredits(
  participantId: string,
  chatbotId: string
): Promise<Credits> {
  return CreditsService.getUserCredits(participantId, chatbotId)
}

export async function loadTurnContext(input: {
  chatbotId: string
  courseId: string
  threadId: string
  origin?: string | null
  learnerBinding?: string
  rawContext?: unknown
  userMessageId: string
  sourceMessageId?: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
}): Promise<
  | { prompt: string; learningContext: Prisma.InputJsonValue | null }
  | {
      error:
        | 'INVALID_CHAT_CONTEXT'
        | 'INVALID_CHAT_HISTORY'
        | 'SOURCE_MESSAGE_NOT_FOUND'
    }
> {
  const context = sanitizeKlickerChatContextV2(input.rawContext)
  if (input.rawContext != null && !context)
    return { error: 'INVALID_CHAT_CONTEXT' }
  const isElearningThread = input.origin === 'elearning'
  if ((isElearningThread || input.learnerBinding) && context?.source === 'pwa')
    return { error: 'INVALID_CHAT_CONTEXT' }
  const verifiedContext =
    context?.source === 'elearning'
      ? await verifyAndNormalizeElearningChatContext(context.envelope, {
          chatbotId: input.chatbotId,
          klickerCourseId: input.courseId,
          learnerBinding: input.learnerBinding,
        })
      : null
  if (context?.source === 'elearning' && !verifiedContext)
    return { error: 'INVALID_CHAT_CONTEXT' }
  if (isElearningThread || input.learnerBinding) {
    const persisted = await prisma.chatMessage.findMany({
      where: {
        threadId: input.threadId,
        id: { in: input.messages.map((message) => message.id) },
        lifecycleStatus: 'COMPLETED',
      },
      select: { id: true, role: true, content: true },
    })
    if (!matchesPersistedLearningHistory(input.messages, persisted))
      return { error: 'INVALID_CHAT_HISTORY' }
  }
  const learning = await resolveElearningTurnContext(
    {
      isElearningThread,
      userMessageId: input.userMessageId,
      sourceMessageId: input.sourceMessageId,
      verifiedContext,
    },
    async (id) => {
      const row = await prisma.chatMessage.findFirst({
        where: { id, threadId: input.threadId, role: 'user' },
        select: { learningContext: true },
      })
      return row
        ? {
            present: true,
            snapshot: normalizePersistedLearningContext(row.learningContext),
          }
        : { present: false }
    }
  )
  if (learning.sourceMessageMissing)
    return { error: 'SOURCE_MESSAGE_NOT_FOUND' }
  const prompt = isElearningThread
    ? `${formatElearningEvidencePolicy()}\n\n${formatElearningSnapshotContext(learning.snapshot)}`
    : formatKlickerChatContextForPrompt(
        context?.source === 'pwa' && context.courseId === input.courseId
          ? context
          : null
      )
  return {
    prompt,
    learningContext: learning.persistSnapshot as Prisma.InputJsonValue | null,
  }
}

export async function prepareAttachmentContext(input: {
  request: EngineV2ChatRequest
  images: ImageAttachment[]
  documentPages: string[]
  engine: EngineClient
  signal: AbortSignal
  engineId: string
  providerAuthorization?: string
  cost: { input: number; output: number }
}): Promise<{
  images: ImageAttachment[]
  documentPageSummary: string | null
  creditsUsed: number
  aborted?: boolean
}> {
  let creditsUsed = 0
  let aborted = input.signal.aborted
  const describe = async (
    images: EngineV2Message['parts'],
    prompt: () => string,
    maxOutputTokens: number
  ): Promise<string | null> => {
    if (aborted || input.signal.aborted) {
      aborted = true
      return null
    }
    try {
      const request: EngineV2ChatRequest = {
        ...input.request,
        requestId: randomUUID(),
        runId: randomUUID(),
        tools: [],
        systemPrompt: '',
        stepPolicy: undefined,
        assistantMessageId: randomUUID(),
        generation: {
          ...input.request.generation,
          maxOutputTokens,
          reasoningEffort: 'none',
          reasoningSummary: 'none',
        },
        messages: [
          {
            id: input.request.userMessageId,
            role: 'user',
            parts: [...images, { type: 'text', text: prompt() }],
          },
        ],
      }
      const response = await input.engine.chat(request, {
        signal: input.signal,
        providerAuthorization: input.providerAuthorization,
      })
      let text: string | null = null
      const validated = createValidatedPlatformStream(response, {
        contractVersion: CHAT_ENGINE_CONTRACT_V2,
        expected: {
          assistantMessageId: request.assistantMessageId,
          engineId: input.engineId,
          toolNames: [],
          runId: request.runId,
          modelId: request.generation.modelId,
          deploymentId: request.generation.deploymentId,
        },
        metadata: () => ({
          chatMode: 'attachment-context',
          modelId: request.generation.modelId,
          reasoningEffort: null,
          userMessageId: request.userMessageId,
          assistantMessageId: request.assistantMessageId,
          creditsUsed: null,
          finalPersistenceStatus: 'not-applicable',
        }),
        finalize: async (state) => {
          if (usageIsChargeable(state.usage))
            creditsUsed += calculateCost(
              input.cost,
              state.usage!.inputTokens!,
              state.usage!.outputTokens!
            )
          if (state.status === 'finished') text = state.text.trim() || null
          if (state.status === 'aborted') aborted = true
          return { creditsUsed: null, finalPersistenceStatus: 'not-applicable' }
        },
      })
      const reader = validated.getReader()
      try {
        while (!(await reader.read()).done) {}
      } finally {
        reader.releaseLock()
      }
      return text
    } catch (error) {
      if (input.signal.aborted || jsonRecord(error)?.name === 'AbortError')
        aborted = true
      return null
    }
  }
  const userContent =
    input.request.messages
      .at(-1)
      ?.parts.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') ?? ''
  const images: ImageAttachment[] = []
  for (const image of input.images) {
    images.push({
      ...image,
      description:
        (await describe(
          [{ ...image, source: 'attachment' }],
          () => renderPromptTemplate('image-description', { userContent }),
          1000
        )) ??
        image.description ??
        'The user attached an image that could not be described automatically.',
    })
  }
  const documentPageSummary =
    input.documentPages.length > 0
      ? await describe(
          input.documentPages.map((page, index) => ({
            id: `page-${index}`,
            type: 'image',
            source: 'document-page',
            mediaType: 'image/jpeg',
            dataUrl: page,
          })),
          () =>
            renderPromptTemplate('document-pages-summary', {
              userContent: stripDocumentBlocks(userContent),
              pageCount: input.documentPages.length,
            }),
          1500
        )
      : null
  return {
    images,
    documentPageSummary,
    creditsUsed,
    aborted: aborted || input.signal.aborted,
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
  learningContext?: Prisma.InputJsonValue | null
  documentPageSummary?: string | null
  imagePreviews?: Array<string | null>
}) {
  const attachments = input.attachments
    .map((attachment, inputPosition) => ({ attachment, inputPosition }))
    .filter(
      ({ attachment }) => jsonRecord(attachment)?.source !== 'document-page'
    )
  await prisma.$transaction(async (tx) => {
    const existing = await tx.chatMessage.findUnique({
      where: { id: input.messageId },
      select: { threadId: true, role: true },
    })
    if (
      existing &&
      (existing.threadId !== input.threadId || existing.role !== 'user')
    )
      throw new Error('Message identity is unavailable')
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
    if (!existing)
      await tx.chatMessage.create({
        data: {
          id: input.messageId,
          threadId: input.threadId,
          parentId: input.parentId,
          role: 'user',
          content: [{ type: 'text', text: input.content }],
          ...(input.learningContext
            ? { learningContext: input.learningContext }
            : {}),
          chatMode: input.chatMode,
          modelId: input.modelId,
          reasoningEffort: input.reasoningEffort,
        },
      })
    const storedAttachments =
      attachments.length > 0 || input.documentPageSummary
        ? await tx.chatAttachment.findMany({
            where: { messageId: input.messageId },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              position: true,
              imageBase64: true,
              imagePreviewBase64: true,
              imageDescription: true,
            },
          })
        : []
    const storedImages = storedAttachments.filter(
      (attachment) =>
        attachment.imageBase64 !== null ||
        attachment.imagePreviewBase64 !== null
    )
    if (attachments.length > 0) {
      const retained = new Set<string>()
      for (const [
        position,
        { attachment, inputPosition },
      ] of attachments.entries()) {
        const previous = storedImages.find(
          (stored) =>
            !retained.has(stored.id) &&
            stored.imageBase64 === attachment.dataUrl
        )
        const existingPreview =
          input.imagePreviews?.[inputPosition] ??
          previous?.imagePreviewBase64 ??
          null
        let preview = existingPreview
        try {
          preview = (
            await ensureImagePreviewBase64({
              imageBase64: attachment.dataUrl,
              imagePreviewBase64: existingPreview,
            })
          ).imagePreviewBase64
        } catch {
          preview = existingPreview
        }
        const data = {
          type: 'IMAGE' as const,
          messageId: input.messageId,
          position,
          imageBase64: attachment.dataUrl,
          imagePreviewBase64: preview,
          imageDescription:
            attachment.description ?? previous?.imageDescription ?? null,
        }
        if (previous) {
          retained.add(previous.id)
          await tx.chatAttachment.update({ where: { id: previous.id }, data })
        } else {
          await tx.chatAttachment.create({ data })
        }
      }
      const replacedIds = storedImages
        .filter((attachment) => !retained.has(attachment.id))
        .map((attachment) => attachment.id)
      if (replacedIds.length > 0) {
        await tx.chatAttachment.deleteMany({
          where: { messageId: input.messageId, id: { in: replacedIds } },
        })
      }
    }
    if (input.documentPageSummary) {
      const summaries = storedAttachments.filter(
        (attachment) =>
          attachment.imageBase64 === null &&
          attachment.imagePreviewBase64 === null
      )
      const position =
        attachments.length > 0
          ? attachments.length
          : Math.max(
              0,
              ...storedImages.map((attachment) => attachment.position + 1)
            )
      const data = buildDocumentPageSummaryRow({
        messageId: input.messageId,
        position,
        summary: input.documentPageSummary,
      })
      const previous = summaries[0]
      if (previous) {
        await tx.chatAttachment.update({ where: { id: previous.id }, data })
        const duplicateIds = summaries
          .slice(1)
          .map((attachment) => attachment.id)
        if (duplicateIds.length > 0) {
          await tx.chatAttachment.deleteMany({
            where: { messageId: input.messageId, id: { in: duplicateIds } },
          })
        }
      } else {
        await tx.chatAttachment.create({ data })
      }
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
  }
}
