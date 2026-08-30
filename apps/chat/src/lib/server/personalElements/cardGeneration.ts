import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import { hasToolCall, isStepCount, type ToolSet } from 'ai'
import { z } from 'zod'
import {
  isSettledTerminalPartialPersonalElementPart,
  isTerminalPartialPersonalElementPart,
} from '@/src/lib/personalElements/failure'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'
import {
  isPersonalCardGenerationEnabled,
  type PersonalCardGenerationEvaluator,
} from './featureFlag'
import {
  getPersonalElementGenerationContext,
  listCompletedGenerationLeaseAttemptTokens,
  listDiscardedCandidateIds,
  listSavedPersonalElementCandidateIds,
  prepareCardPlan,
  validateCardCandidate,
} from './graphqlClient'
import {
  extractUnsavedCandidates,
  getActiveBranchMessageIds,
  hasChunkedDocQueryResult,
  hasNewerCardPlan,
  hasToolPart,
  isFailedGenerationContent,
  parseAcceptedCardPlan,
  type ThreadHistoryMessage,
} from './history'
import {
  abortGenerationLease,
  type CardGenerationLease,
  claimGenerationLease,
  completeGenerationLease,
  createGenerationAttemptMessage,
} from './lease'
import { discardPotentialDuplicateCards } from './titleSimilarity'
import {
  createGenerateCardsTool,
  createListPersonalElementsTool,
  createProposeCardPlanTool,
  createRevisePersonalElementTool,
} from './tools'

const MAX_RETRIEVAL_ATTEMPTS = 2
const RETRIEVAL_UNAVAILABLE_TOOL_NAME = 'course_retrieval_unavailable'
const RESPONSE_TYPE_TOOL_NAME = 'select_response_type'

const responseTypeSchema = z.object({
  responseType: z.enum(['answer', 'card_plan']),
})

type ResponseType = z.infer<typeof responseTypeSchema>['responseType']

type AcceptedPlanReference = {
  messageId: string
  toolCallId: string
}

type ExecutableTool = {
  execute?: (input: unknown, options: Record<string, unknown>) => unknown
}

type CardGenerationError = {
  ok: false
  status: 400 | 409
  error: string
}

type LeaseSettlement =
  | { status: 'none' | 'partial' | 'completed' }
  | {
      status: 'aborted'
      reason: 'assistant-message-not-persisted' | 'generation-failed'
    }
  | { status: 'lost' | 'failed' }

function markTerminalPartialSettlement(content: unknown) {
  if (!Array.isArray(content)) return null

  let found = false
  let changed = false
  const marked = content.map((part) => {
    if (!isTerminalPartialPersonalElementPart(part, 'generate_cards')) {
      return part
    }
    found = true
    if (isSettledTerminalPartialPersonalElementPart(part, 'generate_cards')) {
      return part
    }
    if (!part || typeof part !== 'object') return part
    const result = (part as { result?: unknown }).result
    if (!result || typeof result !== 'object') return part
    changed = true
    return {
      ...part,
      result: { ...result, settlement: 'partial' },
    }
  })

  return found ? { content: marked, changed } : null
}

export type CardGenerationSetup = {
  ok: true
  tools: ToolSet
  toolOrder: string[]
  instructions: string
  prepareStep: (input: {
    stepNumber: number
    steps: Array<{ toolResults?: unknown[] }>
  }) => Record<string, unknown>
  stopWhen: ReturnType<typeof isStepCount> | ReturnType<typeof hasToolCall>[]
  telemetry: {
    docQueryToolName: string | null
    retrievalRequired: boolean
    personalToolsEligible: boolean
    cardGenerationEnabled: boolean
    generationEligible: boolean
  }
  getNestedGenerationCost: () => number
  settleLease: (input: {
    assistantMessagePersisted: boolean
    assistantMessageContent: unknown
  }) => Promise<LeaseSettlement>
  abortLease: () => Promise<void>
}

function createRetrievalUnavailableTool() {
  return {
    description:
      'Use this terminal tool when the course-material search returned no usable evidence after the allowed attempts. Do not answer the student from general knowledge.',
    inputSchema: z.object({}),
    execute: async () => ({ status: 'course_material_unavailable' as const }),
  }
}

function createResponseTypeTool() {
  return {
    description:
      'Select card_plan only when the student is asking to create or propose new personal flashcards. Select answer for every other request, including explanations, revisions, and questions about flashcards. This tool only selects the response path and must not answer the request.',
    inputSchema: responseTypeSchema,
    execute: async (input: z.infer<typeof responseTypeSchema>) => input,
  }
}

function getSelectedResponseType(
  steps: Array<{ toolResults?: unknown[] }>
): ResponseType | null {
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      if (!result || typeof result !== 'object') continue
      const candidate = result as {
        toolName?: unknown
        output?: unknown
        result?: unknown
      }
      if (candidate.toolName !== RESPONSE_TYPE_TOOL_NAME) continue
      const parsed = responseTypeSchema.safeParse(
        candidate.output ?? candidate.result
      )
      if (parsed.success) return parsed.data.responseType
    }
  }
  return null
}

function getForcedToolName({
  docQueryToolName,
  retrievalRequired,
  hasRetrieved,
}: {
  docQueryToolName: string | undefined
  retrievalRequired: boolean
  hasRetrieved: boolean
}): string | null {
  if (docQueryToolName && retrievalRequired && !hasRetrieved) {
    return docQueryToolName
  }
  return null
}

export async function createCardGeneration({
  prisma,
  participantId,
  chatbotId,
  courseId,
  threadId,
  activeBranchLeafId,
  attemptParentMessageId,
  assistantMessageId,
  assistantMessageAlreadyCreated = false,
  threadHistory,
  acceptedPlanReference,
  baseTools,
  model,
  systemPrompt,
  latestUserContent,
  hasImage,
  hasGenerationCredits,
  calculateNestedCost,
  evaluateCardGeneration,
}: {
  prisma: PrismaClient
  participantId: string
  chatbotId: string
  courseId: string
  threadId: string | null
  activeBranchLeafId: string | null
  attemptParentMessageId: string | null
  assistantMessageId: string
  assistantMessageAlreadyCreated?: boolean
  threadHistory: readonly ThreadHistoryMessage[]
  acceptedPlanReference?: AcceptedPlanReference
  baseTools: ToolSet
  model: Parameters<typeof createGenerateCardsTool>[0]['model']
  systemPrompt: string
  latestUserContent: string
  hasImage: boolean
  hasGenerationCredits: boolean
  calculateNestedCost: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => number
  evaluateCardGeneration?: PersonalCardGenerationEvaluator
}): Promise<CardGenerationSetup | CardGenerationError> {
  const baseToolNames = Object.keys(baseTools)
  const docQueryToolName = baseToolNames.find(isDocQueryToolName)
  const retrievalRequired = hasImage || latestUserContent.trim().length > 0
  const personalToolsEligible = Boolean(docQueryToolName)
  let personalElementContext: Awaited<
    ReturnType<typeof getPersonalElementGenerationContext>
  > | null = null
  if (personalToolsEligible) {
    try {
      personalElementContext = await getPersonalElementGenerationContext(
        courseId,
        participantId
      )
    } catch {
      personalElementContext = null
    }
  }
  let cardGenerationEnabled = false
  if (personalToolsEligible) {
    try {
      cardGenerationEnabled = Boolean(
        await (evaluateCardGeneration ?? isPersonalCardGenerationEnabled)({
          participantId,
          chatbotId,
        })
      )
    } catch {
      cardGenerationEnabled = false
    }
  }
  const generationEligible =
    personalToolsEligible &&
    personalElementContext !== null &&
    cardGenerationEnabled &&
    hasGenerationCredits
  const branchIds = getActiveBranchMessageIds(threadHistory, activeBranchLeafId)
  let tools: ToolSet = baseTools
  let toolOrder = [...baseToolNames]
  let nestedGenerationCost = 0
  let lease: CardGenerationLease | null = null
  let leaseSettlementPromise: Promise<LeaseSettlement> | null = null
  let leaseSettlementDone = false
  let acceptedPlan = null
  const personalToolNames: string[] = []
  const courseLanguage = String(personalElementContext?.courseLanguage ?? 'en')
  const existingCardTitles = personalElementContext?.existingTitles ?? []
  if (personalToolsEligible && docQueryToolName) {
    const personalToolOptions = {
      participantId,
      courseId,
      model,
      courseLanguage,
      docQueryTool: baseTools[docQueryToolName] as ExecutableTool,
      onNestedUsage: (usage: {
        inputTokens?: number
        outputTokens?: number
      }) => {
        nestedGenerationCost += calculateNestedCost(usage)
      },
    }
    tools = {
      ...tools,
      list_personal_elements: createListPersonalElementsTool({
        participantId,
        courseId,
      }),
    }
    personalToolNames.push('list_personal_elements')
    if (hasGenerationCredits && personalElementContext) {
      tools = {
        ...tools,
        revise_personal_element:
          createRevisePersonalElementTool(personalToolOptions),
      }
      personalToolNames.push('revise_personal_element')
    }
    toolOrder = [...baseToolNames, ...personalToolNames]
  }

  if (personalToolsEligible && retrievalRequired && !acceptedPlanReference) {
    tools = {
      ...tools,
      [RETRIEVAL_UNAVAILABLE_TOOL_NAME]: createRetrievalUnavailableTool(),
    }
    toolOrder = [...toolOrder, RETRIEVAL_UNAVAILABLE_TOOL_NAME]
  }

  if (generationEligible && !acceptedPlanReference) {
    tools = {
      ...tools,
      [RESPONSE_TYPE_TOOL_NAME]: createResponseTypeTool(),
      propose_card_plan: createProposeCardPlanTool({
        preparePlan: async (input) =>
          prepareCardPlan({ ...input, courseId }, participantId),
      }),
    }
    toolOrder = [
      ...baseToolNames,
      ...personalToolNames,
      RESPONSE_TYPE_TOOL_NAME,
      'propose_card_plan',
      ...(retrievalRequired ? [RETRIEVAL_UNAVAILABLE_TOOL_NAME] : []),
    ]
  }

  if (acceptedPlanReference) {
    if (!generationEligible || !docQueryToolName || !threadId) {
      return {
        ok: false,
        status: 400,
        error: 'Card generation is unavailable for this request',
      }
    }

    const planMessage = threadHistory.find(
      (message) =>
        message.id === acceptedPlanReference.messageId &&
        message.role === 'assistant'
    )
    acceptedPlan = planMessage
      ? parseAcceptedCardPlan(
          planMessage.content,
          acceptedPlanReference.toolCallId
        )
      : null
    if (!acceptedPlan || !planMessage) {
      return {
        ok: false,
        status: 409,
        error: 'The accepted card plan could not be found',
      }
    }
    if (!branchIds.has(planMessage.id)) {
      return {
        ok: false,
        status: 409,
        error: 'The accepted card plan is not on the active branch',
      }
    }
    if (
      !Array.isArray(planMessage.content) ||
      !planMessage.content.some(hasChunkedDocQueryResult)
    ) {
      return {
        ok: false,
        status: 409,
        error: 'The accepted card plan has no chunked retrieval evidence',
      }
    }
    if (hasNewerCardPlan(threadHistory, branchIds, planMessage)) {
      return {
        ok: false,
        status: 409,
        error: 'This card plan was replaced by a newer plan',
      }
    }

    const planCandidateIds = new Set(
      acceptedPlan.cards.map((card) => card.candidateId)
    )
    const savedPlanCandidateIds = new Set(
      await listSavedPersonalElementCandidateIds(
        courseId,
        [...planCandidateIds],
        participantId
      )
    )
    const discardedPlanCandidates = await listDiscardedCandidateIds({
      participantId,
      courseId,
      candidateIds: [...planCandidateIds],
    })
    const generationMessageIds = threadHistory.flatMap((message) =>
      message.role === 'assistant' &&
      branchIds.has(message.id) &&
      hasToolPart(message.content, 'generate_cards')
        ? [message.id]
        : []
    )
    const completedLeaseAttemptTokens =
      await listCompletedGenerationLeaseAttemptTokens({
        participantId,
        attemptTokens: generationMessageIds,
      })
    const priorCandidates = extractUnsavedCandidates(
      threadHistory,
      branchIds,
      new Set(completedLeaseAttemptTokens),
      savedPlanCandidateIds
    )
    const skippedCandidateIds = new Set([
      ...savedPlanCandidateIds,
      ...discardedPlanCandidates,
      ...[...priorCandidates.keys()].filter((candidateId) =>
        planCandidateIds.has(candidateId)
      ),
    ])
    const duplicateCheck = discardPotentialDuplicateCards(
      acceptedPlan.cards.filter(
        (card) => !skippedCandidateIds.has(card.candidateId)
      ),
      existingCardTitles
    )
    if (duplicateCheck.discardedDuplicates.length > 0) {
      return {
        ok: false,
        status: 409,
        error: `The accepted card plan contains a potential duplicate: ${duplicateCheck.discardedDuplicates[0]!.title}`,
      }
    }
    if (
      acceptedPlan.cards.every((card) =>
        skippedCandidateIds.has(card.candidateId)
      )
    ) {
      return {
        ok: false,
        status: 409,
        error: 'All cards in this plan have already been generated or decided',
      }
    }

    let attemptMessageCreated = false
    try {
      if (!assistantMessageAlreadyCreated) {
        await createGenerationAttemptMessage({
          prisma,
          assistantMessageId,
          threadId,
          parentId: attemptParentMessageId,
        })
        attemptMessageCreated = true
      }
      lease = await claimGenerationLease({
        participantId,
        courseId,
        planMessageId: acceptedPlanReference.messageId,
        planToolCallId: acceptedPlanReference.toolCallId,
        attemptToken: assistantMessageId,
      })
    } catch (error) {
      if (attemptMessageCreated) {
        await prisma.chatMessage.deleteMany({
          where: {
            id: assistantMessageId,
            threadId,
            role: 'assistant',
          },
        })
      }
      return {
        ok: false,
        status: 409,
        error:
          error instanceof Error ? error.message : 'Card plan replay rejected',
      }
    }

    tools = {
      ...tools,
      generate_cards: createGenerateCardsTool({
        model,
        courseLanguage,
        approvedPlan: acceptedPlan,
        skipCandidateIds: skippedCandidateIds,
        sourceMessageId: assistantMessageId,
        onNestedUsage: (usage) => {
          nestedGenerationCost += calculateNestedCost(usage)
        },
        docQueryTool: baseTools[docQueryToolName] as ExecutableTool,
        validateCandidate: async (candidate) =>
          validateCardCandidate(
            {
              courseId,
              candidateId: candidate.candidateId,
              title: candidate.name,
              front: candidate.content,
              back: candidate.explanation,
              sources: candidate.sources,
              sourceMessageId: candidate.sourceMessageId,
              sourceToolCallId: candidate.sourceToolCallId,
            },
            participantId
          ),
      }),
    }
    toolOrder = [...baseToolNames, ...personalToolNames, 'generate_cards']
  }

  if (generationEligible && !acceptedPlan) {
    systemPrompt = `${systemPrompt}\n\nAfter retrieving course material, call select_response_type. If it selects card_plan, call propose_card_plan next and never print the requested cards as prose. Never generate or save cards before the student accepts the plan.`
  }
  if (generationEligible && !acceptedPlan) {
    systemPrompt = `${systemPrompt}\n\nBefore proposing cards, avoid repeating existing personal cards. The server compares every proposed title against the complete saved-title list with a conservative local similarity check and removes potential duplicates.`
  }
  if (personalToolsEligible) {
    systemPrompt = `${systemPrompt}\n\nFor saved personal cards, call list_personal_elements before revise_personal_element and pass the exact current id and version.`
  }
  if (acceptedPlan) {
    systemPrompt = `${systemPrompt}\n\nThe student accepted this exact final card plan. Call generate_cards once with this JSON and do not change any plan entry: ${JSON.stringify(acceptedPlan)}. Do not send a text explanation before or after the tool call; the card interface displays the generated cards and their progress.`
  }

  const prepareStep = ({
    stepNumber,
    steps,
  }: {
    stepNumber: number
    steps: Array<{ toolResults?: unknown[] }>
  }) => {
    if (acceptedPlan) {
      return stepNumber === 0
        ? {
            activeTools: ['generate_cards'],
            toolChoice: { type: 'tool', toolName: 'generate_cards' },
          }
        : {
            activeTools: [...baseToolNames, ...personalToolNames],
            toolChoice: 'none',
          }
    }

    if (!personalToolsEligible) return { activeTools: baseToolNames }
    const hasRetrieved = steps.some((step) =>
      (step.toolResults ?? []).some(hasChunkedDocQueryResult)
    )
    const forcedToolName = getForcedToolName({
      docQueryToolName,
      retrievalRequired,
      hasRetrieved,
    })
    if (forcedToolName) {
      if (
        forcedToolName === docQueryToolName &&
        stepNumber >= MAX_RETRIEVAL_ATTEMPTS
      ) {
        return {
          activeTools: [RETRIEVAL_UNAVAILABLE_TOOL_NAME],
          toolChoice: {
            type: 'tool',
            toolName: RETRIEVAL_UNAVAILABLE_TOOL_NAME,
          },
          toolOrder,
        }
      }
      return {
        activeTools: [forcedToolName],
        toolChoice: { type: 'tool', toolName: forcedToolName },
        toolOrder,
      }
    }
    if (hasRetrieved && generationEligible) {
      const responseType = getSelectedResponseType(steps)
      if (!responseType) {
        return {
          activeTools: [RESPONSE_TYPE_TOOL_NAME],
          toolChoice: {
            type: 'tool',
            toolName: RESPONSE_TYPE_TOOL_NAME,
          },
          toolOrder,
        }
      }
      if (responseType === 'card_plan') {
        return {
          activeTools: ['propose_card_plan'],
          toolChoice: { type: 'tool', toolName: 'propose_card_plan' },
          toolOrder,
        }
      }
    }
    return {
      activeTools: [...baseToolNames, ...personalToolNames],
      toolOrder,
    }
  }

  const stopWhen = acceptedPlan
    ? hasToolCall('generate_cards')
    : generationEligible
      ? [
          hasToolCall('propose_card_plan'),
          hasToolCall(RETRIEVAL_UNAVAILABLE_TOOL_NAME),
          isStepCount(5),
        ]
      : retrievalRequired && personalToolsEligible
        ? [hasToolCall(RETRIEVAL_UNAVAILABLE_TOOL_NAME), isStepCount(5)]
        : isStepCount(5)

  const abortLease = async () => {
    if (leaseSettlementPromise) {
      await leaseSettlementPromise
      return
    }
    if (!lease) return
    const currentLease = lease
    await abortGenerationLease({ participantId, lease: currentLease })
    lease = null
  }

  const persistTerminalPartialSettlement = async (content: unknown) => {
    const marked = markTerminalPartialSettlement(content)
    if (!marked) return false
    if (!marked.changed) return true

    const updated = await prisma.chatMessage.updateMany({
      where: {
        id: assistantMessageId,
        ...(threadId ? { threadId } : {}),
      },
      data: { content: marked.content as Prisma.InputJsonValue },
    })
    return updated.count === 1
  }

  const settleLease = async ({
    assistantMessagePersisted,
    assistantMessageContent,
  }: {
    assistantMessagePersisted: boolean
    assistantMessageContent: unknown
  }): Promise<LeaseSettlement> => {
    if (leaseSettlementPromise) return leaseSettlementPromise
    if (leaseSettlementDone || !lease) return { status: 'none' }
    const currentLease = lease
    const settlementPromise: Promise<LeaseSettlement> = (async () => {
      if (!assistantMessagePersisted) {
        try {
          const aborted = await abortGenerationLease({
            participantId,
            lease: currentLease,
          })
          lease = null
          if (!aborted) return { status: 'lost' }
          return {
            status: 'aborted',
            reason: 'assistant-message-not-persisted',
          }
        } catch {
          return { status: 'failed' }
        }
      }

      const isTerminalPartial =
        Array.isArray(assistantMessageContent) &&
        assistantMessageContent.some((part) =>
          isTerminalPartialPersonalElementPart(part, 'generate_cards')
        )
      if (
        isTerminalPartial ||
        isFailedGenerationContent(assistantMessageContent)
      ) {
        try {
          const aborted = await abortGenerationLease({
            participantId,
            lease: currentLease,
          })
          lease = null
          if (!aborted) return { status: 'lost' }
          if (isTerminalPartial) {
            const persisted = await persistTerminalPartialSettlement(
              assistantMessageContent
            )
            return persisted ? { status: 'partial' } : { status: 'failed' }
          }
          return { status: 'aborted', reason: 'generation-failed' }
        } catch {
          return { status: 'failed' }
        }
      }

      try {
        const completed = await completeGenerationLease({
          participantId,
          lease: currentLease,
        })
        lease = null
        return { status: completed ? 'completed' : 'lost' }
      } catch {
        // A failed completion must not look successful. Release the lease when
        // possible, but retain it until that durable cleanup attempt settles.
        try {
          await abortGenerationLease({
            participantId,
            lease: currentLease,
          })
          lease = null
        } catch {
          // Leave the lease for its expiry when neither settlement nor cleanup
          // reached the database. The route still fails closed below.
        }
        return { status: 'failed' }
      }
    })()
    leaseSettlementPromise = settlementPromise
    void settlementPromise.then(
      () => {
        if (leaseSettlementPromise === settlementPromise) {
          leaseSettlementPromise = null
        }
        leaseSettlementDone = true
      },
      () => {
        if (leaseSettlementPromise === settlementPromise) {
          leaseSettlementPromise = null
        }
      }
    )
    return settlementPromise
  }

  return {
    ok: true,
    tools,
    toolOrder,
    instructions: systemPrompt,
    prepareStep,
    stopWhen,
    telemetry: {
      docQueryToolName: docQueryToolName ?? null,
      retrievalRequired,
      personalToolsEligible,
      cardGenerationEnabled,
      generationEligible,
    },
    getNestedGenerationCost: () => nestedGenerationCost,
    settleLease,
    abortLease,
  }
}
