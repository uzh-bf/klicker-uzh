import { z } from 'zod'
import { parseDocQueryPayload } from '@/src/lib/sources/normalizeSources'

export const MAX_CARDS = 5
const MAX_CHUNKS = 32

const groundingDisclaimers = new Set([
  'die flashcard verwendet ausschließlich die informationen aus dem bereitgestellten chunk.',
  'die flashcard verwendet ausschließlich die informationen aus dem bereitgestellten chunk',
  'die flashcard verwendet ausschliesslich die informationen aus dem bereitgestellten chunk.',
  'die flashcard verwendet ausschliesslich die informationen aus dem bereitgestellten chunk',
  'the flashcard uses only the information from the provided chunk.',
  'the flashcard uses only the information from the provided chunk',
])

const provenanceOnlyPatterns = [
  /^(?:the|this) (?:flashcard|card) uses only (?:the )?(?:supplied|provided) (?:evidence|information|course material|chunks?)[.]?$/,
  /^(?:the|this) (?:flashcard|card) contains only (?:the )?(?:supplied|provided) (?:evidence|information|course material|chunks?)[.]?$/,
]

export function isGroundingDisclaimer(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  return (
    groundingDisclaimers.has(normalized) ||
    provenanceOnlyPatterns.some((pattern) => pattern.test(normalized))
  )
}

export const cardExplanationSchema = z
  .string()
  .trim()
  .min(2)
  .max(8192)
  .refine((value) => /[\p{L}\p{N}]/u.test(value), {
    message: 'Generated card explanation must contain an answer',
  })
  .refine((value) => !isGroundingDisclaimer(value), {
    message: 'Generated card explanation must contain the answer',
  })

export const personalElementTypeSchema = z.literal('FLASHCARD')

export const cardPlanEntrySchema = z.object({
  type: personalElementTypeSchema,
  candidateId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(256),
  intent: z.string().trim().min(1).max(1000),
  query: z.string().trim().min(1).max(500),
})

export const cardPlanInputSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  cards: z
    .array(cardPlanEntrySchema.omit({ candidateId: true }))
    .min(1)
    .max(MAX_CARDS),
})

export const discardedDuplicateCardSchema = z.object({
  title: z.string().trim().min(1).max(256),
})

export const cardPlanSchema = cardPlanInputSchema.extend({
  planId: z.string().uuid(),
  cards: z.array(cardPlanEntrySchema).min(1).max(MAX_CARDS),
  discardedDuplicates: z
    .array(discardedDuplicateCardSchema)
    .max(MAX_CARDS)
    .optional(),
})

const cardPlanReadySchema = cardPlanSchema.extend({
  status: z.literal('ready'),
})

const cardPlanAllDuplicatesSchema = z.object({
  status: z.literal('all_duplicates'),
  planId: z.string().uuid(),
  topic: z.string().trim().min(1).max(500),
  cards: z.array(cardPlanEntrySchema).max(MAX_CARDS),
  discardedDuplicates: z
    .array(discardedDuplicateCardSchema)
    .min(1)
    .max(MAX_CARDS),
})

export const cardPlanProposalSchema = z.discriminatedUnion('status', [
  cardPlanReadySchema,
  cardPlanAllDuplicatesSchema,
])

export const generationCandidateSchema = z
  .object({
    type: personalElementTypeSchema,
    name: z.string().trim().min(1).max(256),
    content: z.string().trim().min(1).max(8192),
    explanation: cardExplanationSchema,
    citedChunkIds: z
      .array(z.string().trim().min(1).max(128))
      .min(1)
      .max(MAX_CHUNKS),
  })
  .strict()

const persistedSourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(128),
    chunkId: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(256).optional(),
    url: z
      .string()
      .trim()
      .url()
      .max(2_048)
      .refine((value) => /^https?:\/\//iu.test(value), {
        message: 'Source URLs must use http or https',
      })
      .optional(),
    page: z.number().finite().optional(),
    metadata: z
      .record(
        z.string().max(128),
        z.union([
          z.string().max(256),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ])
      )
      .optional(),
  })
  .strict()

export const generatedCardCandidateSchema = z
  .object({
    type: personalElementTypeSchema,
    candidateId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    content: z.string().trim().min(1).max(8_192),
    explanation: cardExplanationSchema,
    sources: z.array(persistedSourceSchema).min(1).max(32),
    sourceMessageId: z.string().trim().min(1).max(128),
    sourceToolCallId: z.string().trim().min(1).max(128),
    origin: z.literal('AI_GENERATED'),
  })
  .strict()

export type CardPlan = z.infer<typeof cardPlanSchema>
export type CardPlanInput = z.infer<typeof cardPlanInputSchema>
export type GeneratedCardCandidate = z.infer<
  typeof generatedCardCandidateSchema
>

export type RetrievedChunk = {
  chunkId: string
  sourceId: string
  text: string
  title?: string
  url?: string
  page?: number
}

export type PersonalElementCandidate = {
  candidateId: string
  name: string
  content: string
  explanation: string
  sources: Array<{
    sourceId: string
    chunkId: string
    title?: string
    url?: string
    page?: number
  }>
  sourceMessageId: string
  sourceToolCallId: string
  origin?: 'AI_GENERATED' | 'AUTHORED' | null
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function httpUrl(value: unknown): string | undefined {
  const candidate = stringValue(value)
  if (!candidate) return undefined
  if (candidate.length > 2_048) {
    throw new Error('Retrieved source URL exceeds the 2048 character limit')
  }
  return /^https?:\/\//i.test(candidate) ? candidate : undefined
}

function sourceIdFor(source: Record<string, unknown>, index: number) {
  return (
    stringValue(source.file_name) ??
    stringValue(source.reference) ??
    stringValue(source.source_url) ??
    `retrieval-source-${index + 1}`
  )
}

/**
 * Converts the MCP envelope into bounded evidence. Chunk text is used only
 * for the nested model call; the source objects returned to the client omit it.
 */
export function normalizeRetrievedChunks(raw: unknown): {
  chunks: RetrievedChunk[]
  sources: PersonalElementCandidate['sources']
} {
  const payload = parseDocQueryPayload(raw)
  if (!payload || 'error' in payload) return { chunks: [], sources: [] }

  const rawSources = Array.isArray(payload.sources) ? payload.sources : []
  const chunks: RetrievedChunk[] = []
  const sources: PersonalElementCandidate['sources'] = []
  const seen = new Set<string>()

  for (const [sourceIndex, value] of rawSources.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Retrieved source has an invalid shape')
    }
    const source = value as Record<string, unknown>
    const sourceId = sourceIdFor(source, sourceIndex)
    if (sourceId.length > 128) {
      throw new Error('Retrieved source ID exceeds the 128 character limit')
    }
    const title =
      stringValue(source.title) ??
      stringValue(source.file_name) ??
      stringValue(source.expert)
    if (title && title.length > 256) {
      throw new Error('Retrieved source title exceeds the 256 character limit')
    }
    const url = httpUrl(source.source_url ?? source.reference)
    const page = numberValue(source.page_number)
    const rawChunks = source.chunks
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) continue

    for (const chunkValue of rawChunks) {
      if (
        !chunkValue ||
        typeof chunkValue !== 'object' ||
        Array.isArray(chunkValue)
      ) {
        throw new Error('Retrieved chunk has an invalid shape')
      }
      const chunk = chunkValue as Record<string, unknown>
      const text =
        stringValue(chunk.content) ??
        stringValue(chunk.text) ??
        stringValue(chunk.excerpt)
      if (!text) throw new Error('Retrieved chunk has no text')

      const chunkId =
        stringValue(chunk.chunk_id) ??
        stringValue(chunk.chunkId) ??
        stringValue(chunk.id)
      if (!chunkId) throw new Error('Retrieved chunk has no stable ID')
      if (chunkId.length > 128) {
        throw new Error('Retrieved chunk ID exceeds the 128 character limit')
      }
      if (seen.has(chunkId)) {
        throw new Error('Retrieved chunk IDs must be unique')
      }
      if (chunks.length >= MAX_CHUNKS) {
        throw new Error('Retrieved result exceeds the 32 chunk limit')
      }
      seen.add(chunkId)
      chunks.push({ chunkId, sourceId, text, title, url, page })
      sources.push({
        sourceId,
        chunkId,
        ...(title ? { title } : {}),
        ...(url ? { url } : {}),
        ...(page !== undefined ? { page } : {}),
      })
    }
    if (chunks.length >= MAX_CHUNKS) break
  }

  return { chunks, sources }
}

export function assertCitedChunks(
  citedChunkIds: readonly string[],
  chunks: readonly RetrievedChunk[]
) {
  const available = new Set(chunks.map((chunk) => chunk.chunkId))
  const cited = [...new Set(citedChunkIds)]
  if (cited.length === 0 || cited.some((id) => !available.has(id))) {
    throw new Error('Generated card has no citation from its own retrieval')
  }
  return cited
}
