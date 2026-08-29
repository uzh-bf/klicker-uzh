import { randomUUID } from 'node:crypto'
import { generateObject, tool } from 'ai'
import { z } from 'zod'
import {
  assertCitedChunks,
  type CardPlan,
  cardExplanationSchema,
  cardPlanInputSchema,
  cardPlanProposalSchema,
  cardPlanSchema,
  type GeneratedCardCandidate,
  generatedCardCandidateSchema,
  generationCandidateSchema,
  MAX_CARDS,
  normalizeRetrievedChunks,
} from './contracts'
import { listPersonalElements, updatePersonalElement } from './graphqlClient'
import { discardPotentialDuplicateCards } from './titleSimilarity'

export const generationFailureCodeSchema = z.enum([
  'retrieval_unavailable',
  'insufficient_evidence',
  'generation_failed',
])

export const generationFailureSchema = z.object({
  candidateId: z.string().trim().min(1).max(128),
  code: generationFailureCodeSchema,
})

export const generationOutputSchema = z
  .object({
    status: z.enum(['completed', 'partial', 'error']),
    planId: z.string().uuid(),
    completed: z.number().int().min(0).max(MAX_CARDS),
    total: z.number().int().min(1).max(MAX_CARDS),
    candidates: z.array(generatedCardCandidateSchema).max(MAX_CARDS),
    failedCards: z.array(generationFailureSchema).max(MAX_CARDS).optional(),
  })
  .strict()

type ExecutableTool = {
  execute?: (input: unknown, options: Record<string, unknown>) => unknown
}

type GenerationFailureCode = z.infer<typeof generationFailureCodeSchema>

class CardGenerationFailure extends Error {
  readonly code: GenerationFailureCode

  constructor(code: GenerationFailureCode) {
    super(code)
    this.name = 'CardGenerationFailure'
    this.code = code
  }
}

const revisionInputSchema = z.object({
  id: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
  instruction: z.string().trim().min(1).max(2_000),
})

const revisionOutputSchema = z.object({
  status: z.enum(['updated', 'conflict']),
  id: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
  version: z.number().int().min(1).optional(),
  candidateId: z.string().min(1).max(128).optional(),
  name: z.string().min(1).max(256).optional(),
  content: z.string().min(1).max(8_192).optional(),
  explanation: cardExplanationSchema.optional(),
  sources: z.array(z.record(z.string(), z.unknown())).max(32).optional(),
  reason: z.string().max(256).optional(),
})

export function createProposeCardPlanTool(options?: {
  existingCardTitles?: readonly string[]
  getExistingCardTitles?: () => readonly string[] | Promise<readonly string[]>
}) {
  return tool({
    description:
      'After retrieving course material, propose a flashcard plan. Never generate card content in this tool and wait for the student to accept the plan. The server checks every proposed title against the complete saved-title list and removes exact or substantially similar duplicates.',
    inputSchema: cardPlanInputSchema,
    outputSchema: cardPlanProposalSchema,
    execute: async (input) => {
      const existingCardTitles = options?.getExistingCardTitles
        ? await options.getExistingCardTitles()
        : (options?.existingCardTitles ?? [])
      const { retained, discardedDuplicates } = discardPotentialDuplicateCards(
        input.cards,
        existingCardTitles
      )
      if (retained.length === 0) {
        return {
          status: 'all_duplicates' as const,
          planId: randomUUID(),
          topic: input.topic,
          cards: [],
          discardedDuplicates: discardedDuplicates.map(({ title }) => ({
            title,
          })),
        }
      }

      const planId = randomUUID()
      return {
        status: 'ready' as const,
        planId,
        topic: input.topic,
        cards: retained.map((card, index) => ({
          ...card,
          candidateId: `${planId}:card-${index + 1}`,
        })),
        discardedDuplicates: discardedDuplicates.map(({ title }) => ({
          title,
        })),
      }
    },
  })
}

export type GenerateCardsToolContext = {
  model: Parameters<typeof generateObject>[0]['model']
  courseLanguage: string
  approvedPlan: CardPlan
  sourceMessageId: string
  onNestedUsage: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => void
  docQueryTool: ExecutableTool
  skipCandidateIds?: ReadonlySet<string>
}

async function executeDocQuery(
  toolDefinition: ExecutableTool,
  query: string,
  toolCallId: string,
  abortSignal?: AbortSignal
) {
  if (typeof toolDefinition.execute !== 'function') {
    throw new Error('The configured doc_query tool cannot be executed')
  }
  // The current shared doc-query contract exposes `question` as its retrieval
  // input and rejects unknown fields before executing the retrieval pipeline.
  return await toolDefinition.execute(
    { question: query },
    { toolCallId, messages: [], abortSignal, context: {} }
  )
}

type PersonalElementToolOptions = {
  participantId: string
  courseId: string
  model: Parameters<typeof generateObject>[0]['model']
  courseLanguage: string
  docQueryTool: ExecutableTool
  onNestedUsage: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => void
}

function compactElement(element: {
  id: string
  version: number
  name: string
  content: string
  explanation: string
  origin: string
  nextDueAt?: string | null
}) {
  return {
    id: element.id,
    version: element.version,
    name: element.name,
    content: element.content,
    explanation: element.explanation,
    origin: element.origin,
    nextDueAt: element.nextDueAt ?? null,
  }
}

async function generateRevision(
  entry: {
    candidateId: string
    name: string
    content: string
    explanation: string
    instruction: string
  },
  toolCallId: string,
  options: PersonalElementToolOptions,
  query: string,
  abortSignal?: AbortSignal
) {
  const retrieval = await executeDocQuery(
    options.docQueryTool,
    query,
    `${toolCallId}:${entry.candidateId}`,
    abortSignal
  )
  const { chunks, sources } = normalizeRetrievedChunks(retrieval)
  if (chunks.length === 0 || sources.length === 0) {
    throw new Error('No grounded retrieval result for card revision')
  }

  const generated = await generateObject({
    model: options.model,
    schema: generationCandidateSchema,
    system:
      'Revise one flashcard using only the supplied course chunks. Follow the student instruction, preserve factual meaning, and cite at least one exact chunk id. The back is the answer on the card; write a substantive answer.',
    prompt: JSON.stringify({
      language: options.courseLanguage,
      instruction: entry.instruction,
      currentCard: {
        name: entry.name,
        content: entry.content,
        explanation: entry.explanation,
      },
      chunks: chunks.map(({ chunkId, text }) => ({ chunkId, text })),
    }),
    maxOutputTokens: 700,
    maxRetries: 1,
    abortSignal,
  })
  if (generated.usage) options.onNestedUsage(generated.usage)
  const citedChunkIds = assertCitedChunks(
    generated.object.citedChunkIds,
    chunks
  )
  return {
    name: generated.object.title,
    content: generated.object.front,
    explanation: generated.object.back,
    sources: sources.filter((source) => citedChunkIds.includes(source.chunkId)),
  }
}

export function createListPersonalElementsTool(options: {
  participantId: string
  courseId: string
}) {
  return tool({
    description:
      "List the student's own saved flashcards for this course. Return compact IDs and versions before revising a saved card.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async ({ limit = 20 }) => {
      const elements = await listPersonalElements(
        options.courseId,
        options.participantId
      )
      return {
        elements: elements.slice(0, limit).map(compactElement),
      }
    },
  })
}

export function createRevisePersonalElementTool(
  options: PersonalElementToolOptions
) {
  return tool({
    description:
      'Revise one saved personal flashcard in place. Use list_personal_elements first and pass the exact current version; a stale version returns a conflict and must not be retried blindly.',
    inputSchema: revisionInputSchema,
    outputSchema: revisionOutputSchema,
    execute: async (input, executionOptions) => {
      const parsed = revisionInputSchema.parse(input)
      const elements = await listPersonalElements(
        options.courseId,
        options.participantId
      )
      const current = elements.find((element) => element.id === parsed.id)
      if (!current) {
        return {
          status: 'conflict' as const,
          id: parsed.id,
          expectedVersion: parsed.expectedVersion,
          reason: 'The saved card is not available in this course',
        }
      }

      if (current.version !== parsed.expectedVersion) {
        return {
          status: 'conflict' as const,
          id: parsed.id,
          expectedVersion: parsed.expectedVersion,
          version: current.version,
          reason: 'The saved card changed before this revision started',
        }
      }

      const revised = await generateRevision(
        {
          candidateId: current.id,
          name: current.name,
          content: current.content,
          explanation: current.explanation,
          instruction: parsed.instruction,
        },
        executionOptions.toolCallId,
        options,
        `${current.name}: ${parsed.instruction}`,
        executionOptions.abortSignal
      )

      try {
        const updated = await updatePersonalElement(
          {
            id: parsed.id,
            expectedVersion: parsed.expectedVersion,
            ...revised,
          },
          options.participantId
        )
        return {
          status: 'updated' as const,
          id: updated.id,
          expectedVersion: parsed.expectedVersion,
          version: updated.version,
          name: updated.name,
          content: updated.content,
          explanation: updated.explanation,
          sources: revised.sources,
        }
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'extensions' in error
            ? (error.extensions as { code?: unknown })?.code
            : undefined
        if (code === 'PERSONAL_ELEMENT_VERSION_CONFLICT') {
          return {
            status: 'conflict' as const,
            id: parsed.id,
            expectedVersion: parsed.expectedVersion,
            version: current.version,
            reason: 'The saved card changed before this revision completed',
          }
        }
        throw error
      }
    },
  })
}

async function generateCard(
  entry: CardPlan['cards'][number],
  toolCallId: string,
  options: GenerateCardsToolContext & { abortSignal?: AbortSignal }
): Promise<GeneratedCardCandidate> {
  let retrieval: unknown
  try {
    retrieval = await executeDocQuery(
      options.docQueryTool,
      entry.query,
      `${toolCallId}:${entry.candidateId}`,
      options.abortSignal
    )
  } catch {
    throw new CardGenerationFailure('retrieval_unavailable')
  }

  let normalized: ReturnType<typeof normalizeRetrievedChunks>
  try {
    normalized = normalizeRetrievedChunks(retrieval)
  } catch {
    throw new CardGenerationFailure('retrieval_unavailable')
  }
  const { chunks, sources } = normalized
  if (chunks.length === 0 || sources.length === 0) {
    throw new CardGenerationFailure('insufficient_evidence')
  }

  let generated: {
    object: z.infer<typeof generationCandidateSchema>
    usage?: {
      inputTokens?: number
      outputTokens?: number
    }
  }
  try {
    generated = await generateObject({
      model: options.model,
      schema: generationCandidateSchema,
      system:
        'Generate one concise flashcard from the supplied course chunks. Use only the chunks. Cite at least one exact chunk id, and do not invent ids. The back is the answer on the card; write a substantive answer.',
      prompt: JSON.stringify({
        language: options.courseLanguage,
        title: entry.title,
        intent: entry.intent,
        chunks: chunks.map(({ chunkId, text }) => ({ chunkId, text })),
      }),
      maxOutputTokens: 700,
      maxRetries: 1,
      abortSignal: options.abortSignal,
    })
  } catch {
    throw new CardGenerationFailure('generation_failed')
  }
  if (generated.usage) {
    options.onNestedUsage(generated.usage)
  }

  let citedChunkIds: string[]
  try {
    citedChunkIds = assertCitedChunks(generated.object.citedChunkIds, chunks)
  } catch {
    throw new CardGenerationFailure('generation_failed')
  }
  const selectedSources = sources.filter((source) =>
    citedChunkIds.includes(source.chunkId)
  )
  return {
    type: generated.object.type,
    candidateId: entry.candidateId,
    // Keep the persisted title equal to the accepted plan entry. The model
    // generates the card body, but must not silently change the deduplication
    // key after acceptance.
    name: entry.title,
    content: generated.object.front,
    explanation: generated.object.back,
    sources: selectedSources,
    sourceMessageId: options.sourceMessageId,
    sourceToolCallId: toolCallId,
    origin: 'AI_GENERATED',
  }
}

export function createGenerateCardsTool(options: GenerateCardsToolContext) {
  return tool({
    description:
      'Generate the approved flashcard plan. Retrieve once per card and include only cards grounded in that card retrieval.',
    inputSchema: cardPlanSchema,
    outputSchema: generationOutputSchema,
    execute: async function* (input, executionOptions) {
      const parsed = cardPlanSchema.parse(input)
      if (
        parsed.planId !== options.approvedPlan.planId ||
        parsed.cards.length !== options.approvedPlan.cards.length ||
        parsed.cards.some(
          (card, index) =>
            card.candidateId !==
              options.approvedPlan.cards[index]?.candidateId ||
            card.title !== options.approvedPlan.cards[index]?.title ||
            card.intent !== options.approvedPlan.cards[index]?.intent ||
            card.query !== options.approvedPlan.cards[index]?.query
        )
      ) {
        yield {
          status: 'error' as const,
          planId: options.approvedPlan.planId,
          completed: 0,
          total: options.approvedPlan.cards.length,
          candidates: [],
        }
        return
      }

      const candidates: GeneratedCardCandidate[] = []
      const failedCards: Array<{
        candidateId: string
        code: GenerationFailureCode
      }> = []
      const pending = new Map<
        string,
        Promise<{
          candidateId: string
          value?: GeneratedCardCandidate
          failureCode?: GenerationFailureCode
        }>
      >()
      let nextIndex = 0
      const start = (entry: CardPlan['cards'][number]) => {
        const promise = generateCard(entry, executionOptions.toolCallId, {
          ...options,
          abortSignal: executionOptions.abortSignal,
        })
          .then((value) => ({ candidateId: entry.candidateId, value }))
          .catch((error: unknown) => ({
            candidateId: entry.candidateId,
            failureCode:
              error instanceof CardGenerationFailure
                ? error.code
                : ('generation_failed' as const),
          }))
        pending.set(entry.candidateId, promise)
      }

      const approvedCards = options.approvedPlan.cards.filter(
        (card) => !options.skipCandidateIds?.has(card.candidateId)
      )
      const decidedCount =
        options.approvedPlan.cards.length - approvedCards.length
      while (nextIndex < approvedCards.length && pending.size < 3) {
        start(approvedCards[nextIndex++])
      }

      while (pending.size > 0) {
        const finished = await Promise.race(pending.values())
        pending.delete(finished.candidateId)
        const candidateId = finished.candidateId
        if (finished.value) candidates.push(finished.value)
        else {
          failedCards.push({
            candidateId,
            code: finished.failureCode ?? 'generation_failed',
          })
        }
        if (nextIndex < approvedCards.length) {
          start(approvedCards[nextIndex++])
        }
        const allCardsFailed =
          candidates.length === 0 && failedCards.length === approvedCards.length
        yield {
          status: allCardsFailed
            ? ('error' as const)
            : failedCards.length > 0
              ? ('partial' as const)
              : ('completed' as const),
          planId: parsed.planId,
          completed: decidedCount + candidates.length + failedCards.length,
          total: parsed.cards.length,
          candidates: [...candidates],
          ...(failedCards.length > 0 ? { failedCards } : {}),
        }
      }
    },
  })
}
