// @klicker-uzh/chat-api
//
// Standalone Hono service hosting the extracted Mastra chat engine
// (@klicker-uzh/chat-engine). The Next chat route in apps/chat proxies to this
// service when CHAT_USE_MASTRA_ENGINE is on, forwarding the participant_token
// cookie; this service owns auth, the disclaimer gate, the image pipeline, the
// engine call, streaming, persistence, and credit metering — a drop-in for the
// legacy streamText route with the same SSE wire format.
//
// The handler mirrors apps/chat .../[chatbotId]/chat/route.ts step for step;
// streamText is replaced by engine buildAgent + agent.stream + @mastra/ai-sdk
// toAISdkStream, and reasoningContent is carried race-free through a downstream
// TransformStream (the A2 finding) instead of the route's module-var pattern.
import { serve } from '@hono/node-server'
import {
  buildAgent,
  buildTutorMastraMemoryRuntime,
  buildTutorObservabilityAttributes,
  calcCost,
  composeTutorInstructionsSuffix,
  composeTutorMemoryInstructionsSuffix,
  composeTutorVerifierInstructionsSuffix,
  evaluateTutorMemoryGate,
  extractEvidenceIdsFromToolPayload,
  responsesProviderOptions,
  runTutorVerifierPreflight,
  shutdownObservability,
  verifyTutorOutputText,
  withObservability,
  type ChatbotConfig,
  type TutorMemoryGateConfig,
} from '@klicker-uzh/chat-engine'
import { prisma } from '@klicker-uzh/prisma'
import { toAISdkStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse, generateText } from 'ai'
import { randomUUID } from 'crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import { withChatbotAuth } from './lib/auth.js'
import {
  getAllowedReasoningEffortsForModel,
  getAutomaticModelId,
  getChatModelRegistry,
  type ChatModelConfig,
} from './lib/chatModelRegistry.js'
import { ensureImagePreviewBase64 } from './lib/imagePreview.js'
import { loadMcpTools } from './lib/mcp.js'
import {
  buildImageDescriptionModel,
  resolveProviderConfig,
} from './lib/model.js'
import {
  mapAssistantStepContent,
  normalizeReasoningContent,
  type PersistedAssistantContentPart,
} from './lib/persistedContent.js'
import { DEFAULT_PROMPT } from './lib/prompts.js'
import { type ReasoningEffort } from './lib/reasoning.js'
import {
  detectTutorFeedbackUptake,
  loadLatestTutorFeedbackEvent,
  logTutorEvent,
  summarizeTutorUserMessage,
  tutorStateEventPayload,
} from './lib/tutorEvents.js'
import { isTutorMode, planTutorTurnState } from './lib/tutorState.js'
import { CreditsService } from './services/credits.js'
import { DisclaimersService } from './services/disclaimers.js'
import { ThreadService } from './services/threads.js'

const PORT = Number(process.env.PORT ?? 3005)

// Body-size guard for the chat route. Unlike the legacy Next.js route — which
// gets an implicit platform/ingress body cap — this standalone Hono service has
// no default, so `c.req.json()` would buffer an arbitrarily large body into the
// heap before validation (a DoS reachable by any authenticated participant, and
// chat-api has no ingress body cap yet). 32 MB covers the schema's worst case
// (3 image data URLs at ~7 MB each) plus message history and headroom.
const MAX_BODY_BYTES = 32 * 1024 * 1024

function envFlag(name: string) {
  return process.env[name] === '1' || process.env[name] === 'true'
}

function resolveTutorMemoryGateConfig(): TutorMemoryGateConfig {
  const retentionDays = Number(process.env.CHAT_TUTOR_MEMORY_RETENTION_DAYS)
  return {
    enabled: envFlag('CHAT_TUTOR_MEMORY_ENABLED'),
    privacyApproved: envFlag('CHAT_TUTOR_MEMORY_PRIVACY_APPROVED'),
    deletionSupported: envFlag('CHAT_TUTOR_MEMORY_DELETION_SUPPORTED'),
    studentTransparencyEnabled: envFlag(
      'CHAT_TUTOR_MEMORY_STUDENT_TRANSPARENCY_ENABLED'
    ),
    embeddingEndpointApproved: envFlag(
      'CHAT_TUTOR_MEMORY_EMBEDDING_ENDPOINT_APPROVED'
    ),
    ...(Number.isFinite(retentionDays) && retentionDays > 0
      ? { retentionDays }
      : {}),
  }
}

// APP_SECRET is required to verify participant_token JWTs and decrypt per-chatbot
// secrets. Without it, jose.jwtVerify runs with an empty key (rejecting every
// request — a silent DoS) and safeDecrypt throws. As a standalone service with no
// supervisor to surface that, fail fast at boot rather than degrade silently.
if (!process.env.APP_SECRET) {
  console.error(
    '[chat-api] FATAL: APP_SECRET is not set — JWT verification and secret decryption will fail for every request'
  )
  process.exit(1)
}
if (!process.env.OPENAI_BASE_URL) {
  console.warn(
    '[chat-api] OPENAI_BASE_URL is not set — model requests will use provider defaults'
  )
}
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    '[chat-api] OPENAI_API_KEY is not set — model requests without per-chatbot keys will fail'
  )
}

// Mirror apps/chat getOpenAIResponsesStore(): the Responses-API `store` flag is
// driven by CHAT_OPENAI_STORE_RESPONSES (default false). Shared/staged Azure
// backends set it true (tool-call continuation needs stored items); local
// OpenRouter-style backends leave it false.
const STORE_TRUTHY = new Set(['true', '1', 'yes', 'on'])
function getOpenAIResponsesStore(): boolean {
  const value = process.env.CHAT_OPENAI_STORE_RESPONSES
  if (!value) return false
  return STORE_TRUTHY.has(value.trim().toLowerCase())
}

type IncomingImageAttachment = {
  imageBase64: string
  imagePreviewBase64: string | null
}

type ChatRouteModelMessage = {
  role: 'user' | 'assistant'
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>
}

// Minimal structural view of a converted v6 UI part. The accumulator inspects
// type + delta and patches the finish part's metadata (reasoningContent), and
// records streamed text/reasoning for partial-abort persistence.
type UiPart = {
  type: string
  delta?: string
  messageMetadata?: Record<string, unknown>
}

// Mirror of the route's getDefaultReasoningEffort.
function getDefaultReasoningEffort(
  allowedReasoningEfforts: ReasoningEffort[]
): ReasoningEffort | null {
  if (allowedReasoningEfforts.length === 0) {
    return null
  }
  if (allowedReasoningEfforts.includes('medium')) {
    return 'medium'
  }
  return allowedReasoningEfforts[0]!
}

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.post(
  '/api/chatbots/:chatbotId/chat',
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Request body too large' }, 413),
  }),
  async (c) => {
    const chatbotId = c.req.param('chatbotId')
    const requestId = randomUUID()

    // 2.1 — auth: verify the forwarded participant_token cookie, resolve the
    // chatbot's course, enforce participation.
    const participantToken = getCookie(c, 'participant_token')
    const auth = await withChatbotAuth(participantToken, chatbotId)
    if ('error' in auth) {
      return c.json({ error: auth.error }, auth.status)
    }
    const { participantId } = auth

    // 2.2 — disclaimer gate before streaming.
    try {
      const disclaimerStatus = await DisclaimersService.checkDisclaimerStatus(
        chatbotId,
        participantId
      )
      if (disclaimerStatus.required && !disclaimerStatus.accepted) {
        return c.json(
          {
            error: 'Disclaimer must be accepted before using the chatbot',
            code: 'DISCLAIMER_NOT_ACCEPTED',
          },
          403
        )
      }
    } catch (error) {
      console.error('Error checking disclaimer status:', { requestId, error })
      return c.json({ error: 'Error checking disclaimer status' }, 500)
    }

    // 2.3 — request body (identical schema to the route; selectedMode/selectedModel
    // are renamed to mode/model when handed to the engine below).
    const imageDataUrlSchema = z
      .string()
      .max(7_000_000)
      .refine(
        (value) => /^data:image\/(jpeg|png|gif|webp);base64,/.test(value),
        {
          message: 'Must be a base64 data URL for jpeg, png, gif, or webp',
        }
      )

    const bodySchema = z.object({
      messages: z.array(
        z.object({
          id: z.string().min(1),
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })
      ),
      threadId: z.string().min(1).nullable().optional(),
      selectedModel: z.string().min(1),
      selectedMode: z
        .string()
        .optional()
        .transform((val) => val?.toLowerCase())
        .default('tutor'),
      reasoningEffort: z.string().min(1).optional().default('none'),
      parentId: z.string().min(1).nullable().optional(),
      assistantMessageId: z.string().min(1),
      images: z
        .array(
          z.union([
            imageDataUrlSchema,
            z.object({
              imageBase64: imageDataUrlSchema,
              imagePreviewBase64: imageDataUrlSchema.nullable(),
            }),
          ])
        )
        .max(3)
        .optional()
        .default([]),
    })

    let parsed
    try {
      parsed = bodySchema.parse(await c.req.json())
    } catch (e) {
      console.error('Invalid request body:', { requestId, error: e })
      return c.json({ error: 'Invalid request body' }, 400)
    }
    const {
      messages,
      threadId,
      selectedMode,
      reasoningEffort: requestedReasoningEffort,
      parentId,
      assistantMessageId,
      images,
    } = parsed

    const normalizedImages: IncomingImageAttachment[] = images.map((image) =>
      typeof image === 'string'
        ? { imageBase64: image, imagePreviewBase64: null }
        : image
    )
    const resolvedImages = await Promise.all(
      normalizedImages.map((image) => ensureImagePreviewBase64(image))
    )

    let selectedModel = parsed.selectedModel
    let currentThreadId = threadId
    let userMessageId: string | null = null

    // 2.4 (data) — fetch the chatbot with its enabled MCP configurations for this
    // mode (priority asc), resolve the system prompt with the DEFAULT_PROMPT
    // fallback, exactly like the route. A DB error returns a structured 500 (same
    // { error } shape as the other gates) rather than an unhandled rejection.
    let chatbot
    try {
      chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
        include: {
          mcpConfigurations: {
            where: { chatMode: selectedMode, isEnabled: true },
            include: { mcpServer: true },
            orderBy: { priority: 'asc' },
          },
        },
      })
    } catch (error) {
      console.error('Failed to fetch chatbot configuration:', {
        requestId,
        error,
      })
      return c.json({ error: 'Failed to fetch chatbot configuration' }, 500)
    }

    if (!chatbot) {
      return c.json({ error: 'Chatbot not found' }, 404)
    }

    const systemPrompts = chatbot.systemPrompts as Record<
      string,
      Record<string, string>
    > | null
    const systemPrompt =
      systemPrompts?.[selectedMode]?.prompt ||
      DEFAULT_PROMPT[selectedMode]?.prompt ||
      ''

    // 2.7 (tools) — load MCP tools via the engine's Mastra toolset builder, merged
    // across servers in priority order (first-wins). Released after the stream.
    const mcpToolset = await loadMcpTools(chatbot.mcpConfigurations, chatbotId)

    // create a new thread if none exists
    if (!currentThreadId && messages.length > 0) {
      try {
        const newThread = await ThreadService.createThread(
          participantId,
          chatbotId,
          null
        )
        currentThreadId = newThread.id
      } catch (error) {
        console.error('Failed to create thread:', { requestId, error })
      }
    }

    const lastMessage =
      messages.length > 0 ? messages[messages.length - 1]! : null
    if (lastMessage?.role === 'user') {
      userMessageId = lastMessage.id
    }

    const modelMessages: ChatRouteModelMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // 2.4 — model selection + credit gating (registry + credit-aware automatic id;
    // allow-list enforcement; fallback when out of credits). Identical to route.
    const modelRegistry = getChatModelRegistry()
    const allowedIds =
      chatbot.allowedModelIds.length > 0
        ? new Set(chatbot.allowedModelIds as string[])
        : null

    let userCredits: { current: number; total: number } | null = null
    if (!chatbot.modelSelection) {
      userCredits = await CreditsService.getUserCredits(
        participantId,
        chatbotId
      )
      selectedModel = getAutomaticModelId(
        userCredits,
        chatbot.allowedModelIds as string[]
      )
    }

    let selectedModelConfig: ChatModelConfig | undefined = modelRegistry.find(
      (m) => m.id === selectedModel
    )
    if (!selectedModelConfig) {
      return c.json({ error: `Unknown model: ${selectedModel}` }, 400)
    }

    if (
      allowedIds &&
      !allowedIds.has(selectedModelConfig.id) &&
      !selectedModelConfig.fallback
    ) {
      return c.json(
        { error: `Model not available for this chatbot: ${selectedModel}` },
        400
      )
    }

    const maxOutputTokens = selectedModelConfig.maxOutputTokens

    if (chatbot.modelSelection && !selectedModelConfig.fallback) {
      userCredits =
        userCredits ??
        (await CreditsService.getUserCredits(participantId, chatbotId))
      if (userCredits.current <= 0) {
        selectedModel = getAutomaticModelId(
          userCredits,
          chatbot.allowedModelIds as string[]
        )
        selectedModelConfig = modelRegistry.find((m) => m.id === selectedModel)
        if (!selectedModelConfig) {
          return c.json({ error: `Unknown model: ${selectedModel}` }, 400)
        }
      }
    }

    const allowedReasoningEfforts = getAllowedReasoningEffortsForModel(
      selectedModelConfig,
      chatbot.allowedReasoningEffortsByModel
    )
    const appliedReasoningEffort: ReasoningEffort | null =
      allowedReasoningEfforts.length > 0
        ? allowedReasoningEfforts.includes(requestedReasoningEffort)
          ? requestedReasoningEffort
          : getDefaultReasoningEffort(allowedReasoningEfforts)
        : null

    const providerReasoningEffort =
      appliedReasoningEffort && appliedReasoningEffort !== 'none'
        ? appliedReasoningEffort
        : undefined

    // Resolve the effective provider config once: feeds both the engine agent
    // (via ChatbotConfig) and the image-description model.
    const providerConfig = resolveProviderConfig(chatbot)

    // 2.5 — image pipeline: per-image description via generateText, cost
    // attribution, and injection of the raw images into the current user message.
    let imageDescriptionCost = 0
    const imageAttachments: {
      imageBase64: string
      imagePreviewBase64: string | null
      imageDescription: string | null
    }[] = []
    if (normalizedImages.length > 0 && lastMessage?.role === 'user') {
      const imageDescriptionModel = buildImageDescriptionModel(
        providerConfig,
        selectedModelConfig.deploymentId
      )
      const descriptionPrompt = (userContent: string | undefined) =>
        `${userContent ? `User message context: ${userContent}\n\n` : ''}Describe this image in detail. Include all visible text, diagrams, charts, equations, labels, and notable visual elements. This description will serve as context for an ongoing conversation.`

      const results = await Promise.allSettled(
        resolvedImages.map(async (image) => {
          const descriptionResult = await generateText({
            model: imageDescriptionModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', image: image.imageBase64 },
                  {
                    type: 'text',
                    text: descriptionPrompt(lastMessage?.content),
                  },
                ],
              },
            ],
            maxOutputTokens: 1000,
          })
          return { image, descriptionResult }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { image, descriptionResult } = result.value
          imageAttachments.push({
            imageBase64: image.imageBase64,
            imagePreviewBase64: image.imagePreviewBase64,
            imageDescription: descriptionResult.text,
          })
          if (descriptionResult.usage) {
            imageDescriptionCost += calcCost(
              selectedModelConfig.cost,
              descriptionResult.usage.inputTokens || 0,
              descriptionResult.usage.outputTokens || 0
            )
          }
        } else {
          console.error('Failed to generate image description:', {
            requestId,
            error: result.reason,
          })
          const idx = results.indexOf(result)
          imageAttachments.push({
            imageBase64: normalizedImages[idx]!.imageBase64,
            imagePreviewBase64: normalizedImages[idx]!.imagePreviewBase64,
            imageDescription:
              'The user attached an image that could not be described automatically.',
          })
        }
      }

      const lastMessageIndex = messages.length - 1
      if (lastMessageIndex >= 0) {
        const messageText = messages[lastMessageIndex]?.content
        modelMessages[lastMessageIndex] = {
          ...modelMessages[lastMessageIndex]!,
          content: [
            ...(messageText
              ? [{ type: 'text' as const, text: messageText }]
              : []),
            ...resolvedImages.map((image) => ({
              type: 'image' as const,
              image: image.imageBase64,
            })),
          ],
        }
      }
    }

    const owningThread = currentThreadId
      ? await prisma.chatThread.findFirst({
          where: { id: currentThreadId, participantId, chatbotId },
          select: { id: true },
        })
      : null

    // inject prior-message image descriptions (text) into the model context
    const priorMessageIds = messages
      .filter(
        (m) =>
          m.role === 'user' &&
          !(imageAttachments.length > 0 && m.id === lastMessage?.id)
      )
      .map((m) => m.id)
    if (owningThread && priorMessageIds.length > 0) {
      try {
        const priorAttachments = await prisma.chatAttachment.findMany({
          where: {
            messageId: { in: priorMessageIds },
            imageDescription: { not: null },
            message: { threadId: owningThread.id },
          },
          select: { messageId: true, imageDescription: true },
          orderBy: [{ messageId: 'asc' }, { position: 'asc' }],
        })
        const descriptionsByMsgId = new Map<string, string[]>()
        for (const a of priorAttachments) {
          const existing = descriptionsByMsgId.get(a.messageId) ?? []
          existing.push(a.imageDescription!)
          descriptionsByMsgId.set(a.messageId, existing)
        }
        for (let i = 0; i < messages.length; i++) {
          const descs = descriptionsByMsgId.get(messages[i]!.id)
          if (descs && descs.length > 0) {
            const suffix =
              descs.length === 1
                ? `\n\n[Attached image description: ${descs[0]}]`
                : '\n\n' +
                  descs
                    .map(
                      (d, idx) =>
                        `[Attached image ${idx + 1} description: ${d}]`
                    )
                    .join('\n\n')
            modelMessages[i] = {
              ...modelMessages[i]!,
              content: `${modelMessages[i]!.content}${suffix}`,
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch prior image descriptions:', {
          requestId,
          error,
        })
      }
    }

    // 2.6 — persist the user message (update-or-create) + attachments before stream
    if (
      currentThreadId &&
      owningThread &&
      lastMessage?.role === 'user' &&
      userMessageId
    ) {
      try {
        const metadata = {
          chatMode: selectedMode,
          modelId: selectedModelConfig.id,
          reasoningEffort: appliedReasoningEffort,
        }

        const persistAttachments = async (messageId: string) => {
          if (imageAttachments.length === 0) return
          await prisma.$transaction([
            prisma.chatAttachment.deleteMany({ where: { messageId } }),
            prisma.chatAttachment.createMany({
              data: imageAttachments.map((att, position) => ({
                type: 'IMAGE' as const,
                messageId,
                position,
                imageBase64: att.imageBase64 ?? null,
                imagePreviewBase64: att.imagePreviewBase64 ?? null,
                imageDescription: att.imageDescription ?? null,
              })),
            }),
          ])
        }

        const updated = await prisma.chatMessage.updateMany({
          where: { id: userMessageId, threadId: currentThreadId },
          data: metadata,
        })

        if (updated.count === 0) {
          const existingMessage = await prisma.chatMessage.findUnique({
            where: { id: userMessageId },
            select: { id: true },
          })
          if (existingMessage) {
            console.warn(
              'Skipping user message update: message exists outside current thread',
              { requestId, messageId: userMessageId, threadId: currentThreadId }
            )
          } else {
            await prisma.chatMessage.create({
              data: {
                id: lastMessage.id,
                threadId: currentThreadId,
                parentId: parentId || null,
                role: lastMessage.role,
                content: [{ type: 'text', text: lastMessage.content }],
                ...metadata,
              },
            })
            await persistAttachments(lastMessage.id)
          }
        } else {
          await persistAttachments(userMessageId)
        }

        await prisma.chatThread.update({
          where: { id: currentThreadId },
          data: { updatedAt: new Date() },
        })
      } catch (error) {
        console.error('Failed to save user message:', { requestId, error })
      }
    }

    // 2.7 — build the engine agent from the chatbot config (system prompt resolved
    // above is handed in via systemPrompts[mode]) with the merged MCP toolset.
    const chatbotConfig: ChatbotConfig = {
      id: chatbot.id,
      name: chatbot.name,
      courseId: chatbot.courseId,
      systemPrompts: { [selectedMode]: { prompt: systemPrompt } },
      allowedModelIds: chatbot.allowedModelIds as string[],
      modelSelection: chatbot.modelSelection,
      openaiApiKey: providerConfig.apiKey ?? null,
      openaiBaseUrl: providerConfig.baseUrl ?? null,
    }

    const tutorPlannerMessages = modelMessages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : message.content
              .map((part) =>
                part.type === 'text' ? part.text : '[Attached image]'
              )
              .join('\n'),
    }))
    const tutorModeSelected = isTutorMode(selectedMode)
    const latestTutorUserMessage =
      [...tutorPlannerMessages]
        .reverse()
        .find((message) => message.role === 'user')?.content ?? ''
    const previousTutorFeedbackEvent = tutorModeSelected
      ? await loadLatestTutorFeedbackEvent({
          prisma,
          requestId,
          chatbotId,
          threadId: currentThreadId,
        })
      : null

    if (tutorModeSelected && latestTutorUserMessage) {
      await logTutorEvent({
        prisma,
        requestId,
        eventType: 'student_attempt_received',
        participantId,
        chatbotId,
        threadId: currentThreadId,
        messageId: userMessageId,
        payload: {
          selectedMode,
          modelId: selectedModelConfig.id,
          messageSummary: summarizeTutorUserMessage(latestTutorUserMessage),
        },
      })

      const uptake = detectTutorFeedbackUptake({
        latestUserMessage: latestTutorUserMessage,
        previousFeedbackEvent: previousTutorFeedbackEvent,
      })
      if (uptake) {
        await logTutorEvent({
          prisma,
          requestId,
          eventType: 'feedback_uptake_detected',
          participantId,
          chatbotId,
          threadId: currentThreadId,
          messageId: userMessageId,
          payload: {
            selectedMode,
            ...uptake,
          },
        })
      }
    }

    const tutorPromptVersion = selectedMode
    const tutorMemoryGate = tutorModeSelected
      ? evaluateTutorMemoryGate(resolveTutorMemoryGateConfig())
      : null
    const tutorMastraMemory =
      tutorMemoryGate && tutorModeSelected
        ? buildTutorMastraMemoryRuntime({
            decision: tutorMemoryGate,
            connectionString: process.env.DATABASE_URL,
            participantId,
            chatbotId,
            courseId: chatbot.courseId,
            threadId: currentThreadId,
          })
        : null

    const tutorStateResult = isTutorMode(selectedMode)
      ? await planTutorTurnState({
          messages: tutorPlannerMessages,
          model: buildImageDescriptionModel(
            providerConfig,
            process.env.CHAT_TUTOR_STATE_MODEL_ID ??
              selectedModelConfig.deploymentId
          ),
          providerOptions: responsesProviderOptions(
            selectedModelConfig.deploymentId,
            undefined,
            getOpenAIResponsesStore()
          ).options,
          skillPackVersion: tutorPromptVersion,
        })
      : null

    const tutorVerifierPreflight = tutorStateResult
      ? runTutorVerifierPreflight({
          state: tutorStateResult.state,
          latestUserMessage: latestTutorUserMessage,
        })
      : null

    if (
      tutorStateResult &&
      (process.env.NODE_ENV !== 'production' ||
        process.env.CHAT_TUTOR_STATE_LOG === '1')
    ) {
      console.info('[chat-api] tutor turn state', {
        requestId,
        source: tutorStateResult.source,
        state: tutorStateResult.state,
        attributes: buildTutorObservabilityAttributes({
          chatbotId,
          courseId: chatbot.courseId,
          selectedMode,
          modelId: selectedModelConfig.id,
          state: tutorStateResult.state,
          verifierPreflight: tutorVerifierPreflight,
          memoryGate: tutorMemoryGate,
        }),
        ...(tutorStateResult.errorMessage
          ? { error: tutorStateResult.errorMessage }
          : {}),
      })
    }

    if (tutorStateResult) {
      const payload = {
        selectedMode,
        source: tutorStateResult.source,
        ...tutorStateEventPayload(tutorStateResult.state),
      }
      await logTutorEvent({
        prisma,
        requestId,
        eventType: 'tutor_state_planned',
        participantId,
        chatbotId,
        threadId: currentThreadId,
        messageId: userMessageId,
        payload,
      })
      await logTutorEvent({
        prisma,
        requestId,
        eventType: 'tutor_move_selected',
        participantId,
        chatbotId,
        threadId: currentThreadId,
        messageId: userMessageId,
        payload: {
          selectedMode,
          source: tutorStateResult.source,
          allowedMove: tutorStateResult.state.allowedMove,
          hintDepth: tutorStateResult.state.hintDepth,
          leakageAllowed: tutorStateResult.state.leakageAllowed,
          retrievalNeeded: tutorStateResult.state.retrievalNeeded,
          misconceptionLabel:
            tutorStateResult.state.misconception?.label ?? null,
        },
      })
    }
    if (tutorMemoryGate) {
      if (
        tutorMemoryGate.status === 'blocked' &&
        process.env.CHAT_TUTOR_MEMORY_ENABLED
      ) {
        console.warn('[chat-api] tutor memory blocked by privacy gate', {
          requestId,
          missingRequirements: tutorMemoryGate.missingRequirements,
        })
      }
      await logTutorEvent({
        prisma,
        requestId,
        eventType: 'tutor_memory_gate_decision',
        participantId,
        chatbotId,
        threadId: currentThreadId,
        messageId: userMessageId,
        payload: {
          selectedMode,
          status: tutorMemoryGate.status,
          scope: tutorMemoryGate.scope,
          allowedCategories: tutorMemoryGate.allowedCategories,
          missingRequirements: tutorMemoryGate.missingRequirements,
          retentionDays: tutorMemoryGate.retentionDays ?? null,
          mastraMemoryStatus: tutorMastraMemory?.status ?? 'inactive',
          mastraMemoryReason: tutorMastraMemory?.reason ?? null,
        },
      })
    }

    if (
      tutorVerifierPreflight &&
      (process.env.NODE_ENV !== 'production' ||
        process.env.CHAT_TUTOR_VERIFIER_LOG === '1')
    ) {
      console.info('[chat-api] tutor verifier preflight', {
        requestId,
        risk: tutorVerifierPreflight.risk,
        failures: tutorVerifierPreflight.failures,
      })
    }

    const agentExtras = {
      ...(mcpToolset.toolNames.length > 0
        ? { tools: mcpToolset.tools as never }
        : {}),
      ...(tutorStateResult
        ? {
            instructionsSuffix: [
              composeTutorInstructionsSuffix(tutorStateResult.state),
              tutorMemoryGate
                ? composeTutorMemoryInstructionsSuffix(tutorMemoryGate)
                : '',
              tutorVerifierPreflight
                ? composeTutorVerifierInstructionsSuffix(tutorVerifierPreflight)
                : '',
            ].join(''),
          }
        : {}),
      ...(tutorMastraMemory?.agentMemory
        ? { memory: tutorMastraMemory.agentMemory }
        : {}),
    }

    const agent = withObservability(
      buildAgent(
        chatbotConfig,
        selectedMode,
        selectedModelConfig.deploymentId,
        agentExtras
      )
    )

    const { options: providerOptions } = responsesProviderOptions(
      selectedModelConfig.deploymentId,
      providerReasoningEffort,
      getOpenAIResponsesStore()
    )

    // pin the resolved config for the closures (TS narrowing across callbacks)
    const modelConfig = selectedModelConfig

    // Partial accumulation. partialContent/partialReasoningContent are filled
    // synchronously in onChunk (inside the Mastra loop), so they are reliable when
    // onAbort fires; the downstream accumulator below only fills as the client
    // drains the body and would be empty on an early abort. streamedReasoning is
    // filled by that downstream accumulator and used ONLY for the race-free
    // finish-chunk metadata patch. collectedSteps holds per-step usage for
    // abort-time credit math (Mastra's onAbort gives no steps).
    let partialContent = ''
    let partialReasoningContent = ''
    let streamedReasoning = ''
    const collectedSteps: Array<{
      usage?: { inputTokens?: number; outputTokens?: number }
    }> = []
    const persistAssistant = async (
      content: PersistedAssistantContentPart[],
      reasoningContent: string | null,
      creditsUsed: number | null
    ) => {
      if (!currentThreadId || !owningThread) return
      const metadata = {
        chatMode: selectedMode,
        modelId: modelConfig.id,
        reasoningEffort: appliedReasoningEffort,
        reasoningContent,
        creditsUsed,
      }
      const updated = await prisma.chatMessage.updateMany({
        where: { id: assistantMessageId, threadId: currentThreadId },
        data: { content, ...metadata },
      })
      if (updated.count === 0) {
        const existingMessage = await prisma.chatMessage.findUnique({
          where: { id: assistantMessageId },
          select: { id: true },
        })
        if (!existingMessage) {
          await prisma.chatMessage.create({
            data: {
              id: assistantMessageId,
              threadId: currentThreadId,
              parentId: userMessageId,
              role: 'assistant',
              content,
              ...metadata,
            },
          })
        } else {
          console.warn(
            'Skipping assistant message update: message exists outside current thread',
            {
              requestId,
              messageId: assistantMessageId,
              threadId: currentThreadId,
            }
          )
        }
      }
      await prisma.chatThread.update({
        where: { id: currentThreadId },
        data: { updatedAt: new Date() },
      })
    }

    const streamOptions = {
      abortSignal: c.req.raw.signal,
      providerOptions,
      toolChoice: 'auto',
      maxSteps: 5,
      ...(tutorMastraMemory?.runMemory
        ? { memory: tutorMastraMemory.runMemory }
        : {}),
      ...(maxOutputTokens ? { modelSettings: { maxOutputTokens } } : {}),

      // Accumulate partial text/reasoning synchronously inside the Mastra loop so
      // they are reliable when onAbort fires (the downstream accumulator only fills
      // as the client drains the body). Mirrors the route's onChunk.
      onChunk: (chunk: { type: string; payload?: { text?: string } }) => {
        if (chunk.type === 'text-delta' && chunk.payload?.text) {
          partialContent += chunk.payload.text
        }
        if (chunk.type === 'reasoning-delta' && chunk.payload?.text) {
          partialReasoningContent += chunk.payload.text
        }
      },

      onStepFinish: (step: unknown) => {
        const s = step as {
          usage?: { inputTokens?: number; outputTokens?: number }
        }
        collectedSteps.push({ usage: s.usage })
      },

      // 2.10 — assistant persistence + credit decrement on normal finish.
      onFinish: async (event: {
        totalUsage?: { inputTokens?: number; outputTokens?: number }
        steps?: Array<{ content?: unknown[]; reasoningText?: string }>
        reasoningText?: string
      }) => {
        const creditsUsed = event.totalUsage
          ? calcCost(
              modelConfig.cost,
              event.totalUsage.inputTokens || 0,
              event.totalUsage.outputTokens || 0
            ) + imageDescriptionCost
          : null
        const finishedReasoningContent =
          normalizeReasoningContent(
            event.reasoningText ||
              (event.steps ?? [])
                .map((step) => step.reasoningText || '')
                .filter((value) => value.length > 0)
                .join('')
          ) ?? normalizeReasoningContent(partialReasoningContent)

        if (
          currentThreadId &&
          owningThread &&
          event.steps &&
          event.steps.length > 0
        ) {
          try {
            await persistAssistant(
              mapAssistantStepContent(event.steps),
              finishedReasoningContent,
              creditsUsed
            )
          } catch (error) {
            console.error('Failed to save assistant message:', {
              requestId,
              error,
            })
          }
        }

        if (creditsUsed !== null) {
          try {
            await CreditsService.decrementCredits(
              participantId,
              chatbotId,
              creditsUsed
            )
          } catch (error) {
            console.error('Failed to deduct credits:', { requestId, error })
          }
        }

        if (tutorStateResult && partialContent.trim()) {
          const retrievedEvidenceIds = extractEvidenceIdsFromToolPayload(
            event.steps ?? []
          )
          if (
            retrievedEvidenceIds.length > 0 &&
            (process.env.NODE_ENV !== 'production' ||
              process.env.CHAT_TUTOR_VERIFIER_LOG === '1')
          ) {
            console.info('[chat-api] tutor retrieved evidence ids', {
              requestId,
              retrievedEvidenceIds,
            })
          }

          const outputVerification = verifyTutorOutputText({
            state: tutorStateResult.state,
            text: partialContent,
            retrievedEvidenceIds,
          })
          const tutorAttributes = buildTutorObservabilityAttributes({
            chatbotId,
            courseId: chatbot.courseId,
            selectedMode,
            modelId: modelConfig.id,
            state: tutorStateResult.state,
            verifierPreflight: tutorVerifierPreflight,
            outputVerification,
            memoryGate: tutorMemoryGate,
            retrievedEvidenceIds,
          })
          await logTutorEvent({
            prisma,
            requestId,
            eventType: 'feedback_delivered',
            participantId,
            chatbotId,
            threadId: currentThreadId,
            messageId: assistantMessageId,
            payload: {
              selectedMode,
              modelId: modelConfig.id,
              textLength: partialContent.length,
              verifierPassed: outputVerification.passed,
              verifierFailures: outputVerification.failures,
              verifierStats: outputVerification.stats,
              attributes: tutorAttributes,
              ...tutorStateEventPayload(tutorStateResult.state),
              retrievedEvidenceIds,
            },
          })
          if (outputVerification.failures.includes('unsupported_citation')) {
            await logTutorEvent({
              prisma,
              requestId,
              eventType: 'citation_fidelity_failed',
              participantId,
              chatbotId,
              threadId: currentThreadId,
              messageId: assistantMessageId,
              payload: {
                selectedMode,
                retrievedEvidenceIds,
                verifierFailures: outputVerification.failures,
              },
            })
          }
          if (
            !outputVerification.passed ||
            process.env.CHAT_TUTOR_VERIFIER_LOG === '1'
          ) {
            console.warn('[chat-api] tutor verifier posthoc', {
              requestId,
              passed: outputVerification.passed,
              failures: outputVerification.failures,
              stats: outputVerification.stats,
              attributes: tutorAttributes,
            })
          }
        }
      },

      // 2.10 — partial persistence + partial credit decrement on abort. Mastra's
      // onAbort gives no steps, so credits come from the per-step usage collected
      // in onStepFinish and the partial text/reasoning from onChunk.
      onAbort: async () => {
        let creditsUsed: number | null = null
        let totalCost = 0
        let hasUsage = false
        for (const step of collectedSteps) {
          if (step.usage) {
            hasUsage = true
            totalCost += calcCost(
              modelConfig.cost,
              step.usage.inputTokens || 0,
              step.usage.outputTokens || 0
            )
          }
        }
        if (hasUsage) creditsUsed = totalCost + imageDescriptionCost

        if (creditsUsed !== null && creditsUsed > 0) {
          try {
            await CreditsService.decrementCredits(
              participantId,
              chatbotId,
              creditsUsed
            )
          } catch (error) {
            console.error('Failed to deduct credits:', { requestId, error })
          }
        }

        const abortedReasoningContent = normalizeReasoningContent(
          partialReasoningContent
        )

        if (
          currentThreadId &&
          owningThread &&
          (partialContent.trim() || abortedReasoningContent)
        ) {
          try {
            const partial: PersistedAssistantContentPart[] = []
            if (partialContent.trim()) {
              partial.push({ type: 'text', text: partialContent })
            }
            if (abortedReasoningContent) {
              partial.push({ type: 'reasoning', text: abortedReasoningContent })
            }
            await persistAssistant(
              partial,
              abortedReasoningContent,
              creditsUsed
            )
          } catch (error) {
            console.error('Failed to save partial message:', {
              requestId,
              error,
            })
          }
        }
      },

      onError: ({ error }: { error: unknown }) => {
        console.error('Error during streaming response:', { requestId, error })
      },
    }

    // Cast the method (not the args) and coerce the awaited result to exactly the
    // type toAISdkStream expects. agent.stream resolves to MastraModelOutput<undefined>,
    // but the `#private` brand makes that invariant with the <unknown> the overload
    // wants; passing `streamOptions as never` instead would force TOutput=any and
    // break overload selection.
    const stream = (await (
      agent.stream as unknown as (
        messages: unknown,
        options: unknown
      ) => Promise<unknown>
    )(modelMessages, streamOptions)) as Parameters<typeof toAISdkStream>[0]

    // 2.8 — convert the Mastra stream to the AI SDK v6 UI-message stream and
    // re-attach our per-message finish metadata (creditsUsed/modelId/chatMode/
    // reasoningEffort/finishReason). reasoningContent is NOT set here — it is
    // injected race-free by the accumulator below.
    const uiStream = toAISdkStream(stream, {
      from: 'agent',
      version: 'v6',
      sendReasoning: true,
      messageMetadata: ({
        part,
      }: {
        part: {
          type: string
          finishReason?: string
          totalUsage?: { inputTokens?: number; outputTokens?: number }
        }
      }) => {
        if (part.type !== 'finish') return undefined
        const creditsUsed = part.totalUsage
          ? calcCost(
              modelConfig.cost,
              part.totalUsage.inputTokens || 0,
              part.totalUsage.outputTokens || 0
            ) + imageDescriptionCost
          : null
        // 2.9 — finishReason: the prototype omitted it; the client needs it for the
        // "Response truncated" notice on 'length'. Read off the converted finish
        // part. (Mastra may emit 'unknown'; Phase 4 verifies the truncation path.)
        return {
          finishReason: part.finishReason,
          chatMode: selectedMode,
          modelId: modelConfig.id,
          reasoningEffort: appliedReasoningEffort,
          creditsUsed,
        }
      },
    })

    // A2 — reasoning accumulator: every reasoning-delta precedes the finish chunk,
    // so accumulating here and patching the finish part's metadata is race-free
    // (a finish-time read of an onStepFinish var intermittently drops the summary
    // under backpressure). Partial text/reasoning for abort persistence come from
    // onChunk instead — this accumulator only fills as the client drains the body.
    const withReasoning = (
      uiStream as unknown as ReadableStream<UiPart>
    ).pipeThrough(
      new TransformStream<UiPart, UiPart>({
        transform(part, controller) {
          if (part.type === 'reasoning-delta')
            streamedReasoning += part.delta ?? ''
          controller.enqueue(
            part.type === 'finish'
              ? {
                  ...part,
                  messageMetadata: {
                    ...(part.messageMetadata ?? {}),
                    reasoningContent:
                      normalizeReasoningContent(streamedReasoning),
                  },
                }
              : part
          )
        },
      })
    )

    // Cast bridges a known version skew: Mastra vendors its own ai-v6 chunk types
    // whose finish chunk allows finishReason 'unknown', while the app's `ai`
    // package narrows it out. Runtime chunks are identical; only the types differ.
    const response = createUIMessageStreamResponse({
      stream: withReasoning as unknown as Parameters<
        typeof createUIMessageStreamResponse
      >[0]['stream'],
    })

    // Release the per-request MCP clients once the body is drained (or aborted).
    // A one-shot guard prevents a double disconnect when both the flush and the
    // abort listener fire (abort can arrive after the stream already flushed).
    if (mcpToolset.toolNames.length > 0 && response.body) {
      let disconnected = false
      const cleanup = () => {
        if (disconnected) return
        disconnected = true
        void mcpToolset.disconnectAll()
      }
      const monitored = response.body.pipeThrough(
        new TransformStream({
          flush() {
            cleanup()
          },
        })
      )
      c.req.raw.signal.addEventListener('abort', cleanup, { once: true })
      return new Response(monitored, {
        status: response.status,
        headers: response.headers,
      })
    }

    return response
  }
)

// The host owns process lifecycle: flush in-flight observability spans on
// shutdown, then exit (awaiting alone does not exit the process). No-op when
// tracing is off.
function registerShutdown(signal: 'SIGTERM' | 'SIGINT') {
  process.once(signal, async () => {
    await shutdownObservability()
    process.exit(0)
  })
}
registerShutdown('SIGTERM')
registerShutdown('SIGINT')

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[chat-api] Ready and listening on http://localhost:${info.port}`)
})

export { app }
