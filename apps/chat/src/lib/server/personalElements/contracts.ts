import {
  type ElementSourceLocator,
  type ElementSourcePageLocator,
  type ElementSourceReference,
  type ElementSourceWebLocator,
  isSafeElementSourceUrl,
  sanitizeElementSourceIdentity,
  sanitizeElementSourceLabel,
} from '@klicker-uzh/types'
import { z } from 'zod'
import { parseDocQueryPayload } from '@/src/lib/sources/normalizeSources'

export const MAX_CARDS = 5
const MAX_CHUNKS = 32

export const cardExplanationSchema = z
  .string()
  .trim()
  .min(2)
  .max(8192)
  .refine((value) => /[\p{L}\p{N}]/u.test(value), {
    message: 'Generated card explanation must contain an answer',
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
    title: z.string().trim().min(1).max(256),
    front: z.string().trim().min(1).max(8192),
    back: cardExplanationSchema,
    citedChunkIds: z
      .array(z.string().trim().min(1).max(128))
      .min(1)
      .max(MAX_CHUNKS),
  })
  .strict()

const persistedSourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(128),
    kind: z.enum(['DOCUMENT', 'WEB']),
    title: z.string().trim().min(1).max(256),
    canonicalUrl: z
      .string()
      .trim()
      .url()
      .max(2_048)
      .refine(isSafeElementSourceUrl, {
        message: 'Source URLs must be stable http(s) addresses',
      })
      .optional(),
    chunkIds: z.array(z.string().trim().min(1).max(128)).min(1).max(MAX_CHUNKS),
    locators: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('PAGE_RANGE'),
              pageFrom: z.number().int().min(1),
              pageTo: z.number().int().min(1),
              labelFrom: z.string().trim().min(1).max(256).optional(),
              labelTo: z.string().trim().min(1).max(256).optional(),
            })
            .strict(),
          z
            .object({
              type: z.literal('WEB_ANCHOR'),
              url: z
                .string()
                .trim()
                .url()
                .max(2_048)
                .refine(isSafeElementSourceUrl),
              label: z.string().trim().min(1).max(256).optional(),
            })
            .strict(),
        ])
      )
      .min(1)
      .max(16),
  })
  .strict()
  .superRefine((source, context) => {
    for (const [index, locator] of source.locators.entries()) {
      if (source.kind === 'DOCUMENT' && locator.type !== 'PAGE_RANGE') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locators', index],
          message: 'Document sources require page-range locators',
        })
      }
      if (source.kind === 'WEB' && locator.type !== 'WEB_ANCHOR') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locators', index],
          message: 'Web sources require web-anchor locators',
        })
      }
      if (locator.type === 'PAGE_RANGE' && locator.pageTo < locator.pageFrom) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locators', index, 'pageTo'],
          message: 'Page ranges must be ordered',
        })
      }
    }
  })

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

const storedHttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))

const storedFlatSourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(128),
    chunkId: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(256).optional(),
    url: storedHttpUrlSchema.optional(),
    page: z.number().finite().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const storedFlatCandidateSchema = generatedCardCandidateSchema.extend({
  sources: z.array(storedFlatSourceSchema).min(1).max(MAX_CHUNKS),
})

const storedGroupedSourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(128),
    kind: z.enum(['DOCUMENT', 'WEB']),
    title: z.string().trim().min(1).max(256),
    canonicalUrl: storedHttpUrlSchema.optional(),
    chunkIds: z.array(z.string().trim().min(1).max(128)).min(1).max(MAX_CHUNKS),
    locators: z
      .array(
        z.union([
          z
            .object({
              type: z.literal('PAGE_RANGE'),
              pageFrom: z.number().finite(),
              pageTo: z.number().finite(),
              labelFrom: z.string().trim().min(1).max(256).optional(),
              labelTo: z.string().trim().min(1).max(256).optional(),
            })
            .strict(),
          z
            .object({
              type: z.literal('WEB_ANCHOR'),
              url: storedHttpUrlSchema,
              label: z.string().trim().min(1).max(256).optional(),
            })
            .strict(),
        ])
      )
      .max(16),
  })
  .strict()

const storedGroupedCandidateSchema = generatedCardCandidateSchema.extend({
  sources: z.array(storedGroupedSourceSchema).min(1).max(MAX_CHUNKS),
})

function storedSourceIsPdf(url: string | undefined) {
  if (!url) return false
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}

/**
 * Reads candidate messages written by the flat-source prototype. It keeps the
 * source identity but drops old source bodies, unsafe links, and invalid pages.
 */
export function parseStoredGeneratedCardCandidate(
  input: unknown
): GeneratedCardCandidate | null {
  const groupedCandidate = storedGroupedCandidateSchema.safeParse(input)
  if (groupedCandidate.success) {
    return {
      ...groupedCandidate.data,
      sources: groupedCandidate.data.sources.map((source, index) => {
        const sourceId =
          sanitizeElementSourceIdentity(source.sourceId) ??
          `stored-source-${index + 1}`
        return {
          sourceId,
          kind: source.kind,
          title: sanitizeElementSourceLabel(source.title) ?? sourceId,
          ...(source.canonicalUrl && isSafeElementSourceUrl(source.canonicalUrl)
            ? { canonicalUrl: source.canonicalUrl }
            : {}),
          chunkIds: [...new Set(source.chunkIds)],
          locators: canonicalizeStoredLocators(source),
        }
      }),
    }
  }

  const legacy = storedFlatCandidateSchema.safeParse(input)
  if (!legacy.success) return null

  const grouped = new Map<string, ElementSourceReference>()
  for (const [sourceIndex, source] of legacy.data.sources.entries()) {
    const sourceId =
      sanitizeElementSourceIdentity(source.sourceId) ??
      `stored-source-${sourceIndex + 1}`
    const stableUrl =
      source.url && isSafeElementSourceUrl(source.url) ? source.url : undefined
    const validPage =
      Number.isInteger(source.page) && (source.page ?? 0) >= 1
        ? source.page
        : undefined
    const kind =
      source.page !== undefined || storedSourceIsPdf(source.url)
        ? 'DOCUMENT'
        : 'WEB'
    const existing = grouped.get(sourceId)
    if (existing && existing.kind !== kind) return null

    const reference = existing ?? {
      sourceId,
      kind,
      title:
        sanitizeElementSourceLabel(source.title ?? source.sourceId) ?? sourceId,
      chunkIds: [],
      locators: [],
    }
    if (!reference.canonicalUrl && stableUrl) {
      reference.canonicalUrl = stableUrl
    } else if (
      stableUrl &&
      reference.canonicalUrl &&
      reference.canonicalUrl !== stableUrl
    ) {
      return null
    }
    if (!reference.chunkIds.includes(source.chunkId)) {
      reference.chunkIds.push(source.chunkId)
    }
    if (kind === 'DOCUMENT' && validPage !== undefined) {
      reference.locators.push({
        type: 'PAGE_RANGE',
        pageFrom: validPage,
        pageTo: validPage,
      })
    } else if (kind === 'WEB' && stableUrl) {
      reference.locators.push({ type: 'WEB_ANCHOR', url: stableUrl })
    }
    grouped.set(sourceId, reference)
  }

  for (const source of grouped.values()) {
    source.locators = canonicalizeStoredLocators(source)
    if (source.locators.length > 16) return null
  }

  return { ...legacy.data, sources: [...grouped.values()] }
}

function canonicalizeStoredLocators(
  source: Pick<ElementSourceReference, 'kind' | 'locators'>
): ElementSourceLocator[] {
  if (source.kind === 'WEB') {
    return source.locators
      .filter(
        (locator): locator is ElementSourceWebLocator =>
          locator.type === 'WEB_ANCHOR' && isSafeElementSourceUrl(locator.url)
      )
      .filter(
        (locator, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.type === 'WEB_ANCHOR' && candidate.url === locator.url
          ) === index
      )
  }

  const validPages = source.locators
    .filter(
      (locator): locator is ElementSourcePageLocator =>
        locator.type === 'PAGE_RANGE' &&
        Number.isInteger(locator.pageFrom) &&
        Number.isInteger(locator.pageTo) &&
        locator.pageFrom >= 1 &&
        locator.pageTo >= locator.pageFrom
    )
    .sort(
      (left, right) =>
        left.pageFrom - right.pageFrom || left.pageTo - right.pageTo
    )

  return validPages.reduce<ElementSourcePageLocator[]>((locators, locator) => {
    const previous = locators.at(-1)
    if (!previous || locator.pageFrom > previous.pageTo + 1) {
      locators.push({ ...locator })
      return locators
    }
    if (locator.pageTo > previous.pageTo) {
      previous.pageTo = locator.pageTo
      previous.labelTo = locator.labelTo ?? locator.labelFrom
    }
    return locators
  }, [])
}

export type RetrievedChunk = {
  chunkId: string
  sourceId: string
  text: string
  kind: 'DOCUMENT' | 'WEB'
  title: string
  canonicalUrl?: string
  page?: number
  labeledPage?: string
  webAnchor?: string
}

export type PersonalElementCandidate = {
  candidateId: string
  name: string
  content: string
  explanation: string
  sources: ElementSourceReference[]
  sourceMessageId: string
  sourceToolCallId: string
  origin?: 'AI_GENERATED' | 'AUTHORED' | null
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function pageValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined
  }
  return undefined
}

function httpUrl(value: unknown): string | undefined {
  const candidate = stringValue(value)
  if (!candidate) return undefined
  if (candidate.length > 2_048) {
    throw new Error('Retrieved source URL exceeds the 2048 character limit')
  }
  return isSafeElementSourceUrl(candidate) ? candidate : undefined
}

function sourceIdentity(value: unknown) {
  const candidate = stringValue(value)
  return candidate ? sanitizeElementSourceIdentity(candidate) : undefined
}

function sourceLabel(value: unknown) {
  const candidate = stringValue(value)
  return candidate ? sanitizeElementSourceLabel(candidate) : undefined
}

function sourceIdFor(source: Record<string, unknown>, index: number) {
  return (
    sourceIdentity(source.source_id) ??
    sourceIdentity(source.resource_id) ??
    sourceIdentity(source.file_name) ??
    sourceIdentity(source.reference) ??
    sourceIdentity(source.source_url) ??
    `retrieval-source-${index + 1}`
  )
}

function sourceKindFor(source: Record<string, unknown>): 'DOCUMENT' | 'WEB' {
  const kind = [source.source_type, source.reference_type]
    .map(stringValue)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\b(?:url|web|website|link)\b/u.test(kind) ? 'WEB' : 'DOCUMENT'
}

function sourceTitleFor(
  source: Record<string, unknown>,
  sourceId: string,
  canonicalUrl?: string
) {
  return (
    sourceLabel(source.title) ??
    sourceLabel(source.file_name) ??
    sourceLabel(source.reference) ??
    sourceLabel(canonicalUrl) ??
    sourceLabel(source.source_url) ??
    sourceLabel(source.expert) ??
    sourceId
  )
}

function webAnchorFor(
  source: Record<string, unknown>,
  chunk: Record<string, unknown>,
  canonicalUrl?: string
) {
  const exactTarget = stringValue(
    chunk.anchor_url ?? chunk.source_url ?? chunk.url ?? chunk.reference
  )
  if (exactTarget) return httpUrl(exactTarget)

  const fragment = stringValue(chunk.anchor ?? chunk.fragment)
  if (fragment) {
    if (!canonicalUrl || !fragment.startsWith('#')) return undefined
    const target = new URL(canonicalUrl)
    target.hash = fragment.slice(1)
    const assembledTarget = target.toString()
    return isSafeElementSourceUrl(assembledTarget) ? assembledTarget : undefined
  }

  return httpUrl(source.source_url ?? source.reference)
}

/**
 * Converts the MCP envelope into bounded evidence. Chunk text is used only
 * for the nested model call; the source objects returned to the client omit it.
 */
export function normalizeRetrievedChunks(raw: unknown): {
  chunks: RetrievedChunk[]
} {
  const payload = parseDocQueryPayload(raw)
  if (!payload || 'error' in payload) return { chunks: [] }

  const rawSources = Array.isArray(payload.sources) ? payload.sources : []
  const chunks: RetrievedChunk[] = []
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
    const canonicalUrl = httpUrl(source.source_url ?? source.reference)
    const title = sourceTitleFor(source, sourceId, canonicalUrl)
    if (title.length > 256) {
      throw new Error('Retrieved source title exceeds the 256 character limit')
    }
    const kind = sourceKindFor(source)
    const parentPage = pageValue(source.page_number)
    const parentLabel = stringValue(source.labeled_page_number)
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
      const page = pageValue(chunk.page_number) ?? parentPage
      const labeledPage = stringValue(chunk.labeled_page_number) ?? parentLabel
      const webAnchor =
        kind === 'WEB' ? webAnchorFor(source, chunk, canonicalUrl) : undefined
      chunks.push({
        chunkId,
        sourceId,
        text,
        kind,
        title,
        ...(canonicalUrl ? { canonicalUrl } : {}),
        ...(page !== undefined ? { page } : {}),
        ...(labeledPage ? { labeledPage } : {}),
        ...(webAnchor ? { webAnchor } : {}),
      })
    }
    if (chunks.length >= MAX_CHUNKS) break
  }

  return { chunks }
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

function collapsePages(
  pages: Array<{ page: number; label?: string }>
): ElementSourcePageLocator[] {
  const locators: ElementSourcePageLocator[] = []
  const uniquePages = [...pages]
    .sort((left, right) => left.page - right.page)
    .filter((page, index, all) => {
      const previous = all[index - 1]
      if (!previous || previous.page !== page.page) return true
      if (previous.label !== page.label) {
        throw new Error('Retrieved page labels disagree for one physical page')
      }
      return false
    })

  for (const page of uniquePages) {
    const previous = locators.at(-1)
    if (previous && page.page === previous.pageTo + 1) {
      previous.pageTo = page.page
      previous.labelTo = page.label
      continue
    }
    locators.push({
      type: 'PAGE_RANGE',
      pageFrom: page.page,
      pageTo: page.page,
      ...(page.label ? { labelFrom: page.label, labelTo: page.label } : {}),
    })
  }

  return locators
}

/** Builds one exact, source-body-free reference per cited source material. */
export function buildElementSourceReferences(
  citedChunkIds: readonly string[],
  chunks: readonly RetrievedChunk[]
): ElementSourceReference[] {
  const cited = assertCitedChunks(citedChunkIds, chunks)
  const citedSet = new Set(cited)
  const selected = chunks.filter((chunk) => citedSet.has(chunk.chunkId))
  const grouped = new Map<
    string,
    {
      sourceId: string
      kind: 'DOCUMENT' | 'WEB'
      title: string
      canonicalUrl?: string
      chunkIds: string[]
      pages: Array<{ page: number; label?: string }>
      webAnchors: string[]
    }
  >()

  for (const chunk of selected) {
    const existing = grouped.get(chunk.sourceId)
    if (
      existing &&
      (existing.kind !== chunk.kind ||
        existing.title !== chunk.title ||
        existing.canonicalUrl !== chunk.canonicalUrl)
    ) {
      throw new Error('Retrieved source snapshot changed between cited chunks')
    }
    const source = existing ?? {
      sourceId: chunk.sourceId,
      kind: chunk.kind,
      title: chunk.title,
      ...(chunk.canonicalUrl ? { canonicalUrl: chunk.canonicalUrl } : {}),
      chunkIds: [],
      pages: [],
      webAnchors: [],
    }
    source.chunkIds.push(chunk.chunkId)
    if (chunk.kind === 'DOCUMENT') {
      if (chunk.page === undefined) {
        throw new Error('Cited document chunk has no physical page locator')
      }
      source.pages.push({
        page: chunk.page,
        ...(chunk.labeledPage ? { label: chunk.labeledPage } : {}),
      })
    } else {
      if (!chunk.webAnchor) {
        throw new Error('Cited web chunk has no provider-supplied anchor')
      }
      source.webAnchors.push(chunk.webAnchor)
    }
    grouped.set(chunk.sourceId, source)
  }

  return [...grouped.values()].map((source) => ({
    sourceId: source.sourceId,
    kind: source.kind,
    title: source.title,
    ...(source.canonicalUrl ? { canonicalUrl: source.canonicalUrl } : {}),
    chunkIds: source.chunkIds,
    locators:
      source.kind === 'DOCUMENT'
        ? collapsePages(source.pages)
        : source.webAnchors
            .filter((url, index, all) => all.indexOf(url) === index)
            .map((url) => ({ type: 'WEB_ANCHOR' as const, url })),
  }))
}
