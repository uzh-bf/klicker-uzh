import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import {
  type ElementSourceLocator,
  type ElementSourcePageLocator,
  type ElementSourceReference,
  type ElementSourceWebLocator,
  FlashcardCorrectness,
  isSafeElementSourceUrl,
  sanitizeElementSourceIdentity,
  sanitizeElementSourceLabel,
  sanitizeElementSourceLocatorLabels,
  sanitizeElementSourceReferenceIdentities,
} from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { isDeepEqual } from 'remeda'
import { z } from 'zod'
import { sleep } from '../lib/util.js'
import { updateSpacedRepetition } from './stacks.js'

const PERSONAL_ELEMENT_LIMIT = 500
const TRANSACTION_RETRY_LIMIT = 5
const TRANSACTION_RETRY_DELAY_MS = 10
const TRANSACTION_MAX_WAIT_MS = 5_000
const TRANSACTION_TIMEOUT_MS = 15_000
const CARD_GENERATION_LEASE_MS = 5 * 60 * 1000
const MAX_SOURCE_COUNT = 32
const MAX_SOURCE_LOCATOR_COUNT = 16
const MAX_CANDIDATE_COUNT = 32
const MAX_ID_LENGTH = 128
const MAX_TITLE_LENGTH = 256
const MAX_URL_LENGTH = 2_048
const MAX_METADATA_BYTES = 64 * 1024
const MAX_PLAN_CARDS = 5
const MAX_TOPIC_LENGTH = 500
const MAX_INTENT_LENGTH = 1_000
const MAX_QUERY_LENGTH = 500

export const CARD_TITLE_SIMILARITY_THRESHOLD = 0.8

export type DiscardedDuplicateCard = {
  title: string
  matchedTitle: string
  similarity: number
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function titleTokens(value: string) {
  const words = normalizeTitle(value).split(/\s+/).filter(Boolean)
  const tokens = new Set(words)

  // Titles often mix an abbreviation with its expanded form (for example,
  // "CAPM" and "Capital Asset Pricing Model"). Add short initialisms so the
  // deterministic check catches that common duplicate shape without a model.
  for (let start = 0; start < words.length; start += 1) {
    for (
      let length = 3;
      length <= 5 && start + length <= words.length;
      length += 1
    ) {
      tokens.add(
        words
          .slice(start, start + length)
          .map((word) => word[0])
          .join('')
      )
    }
  }

  return tokens
}

function characterNgrams(value: string) {
  const normalized = normalizeTitle(value).replace(/\s+/g, ' ')
  if (normalized.length < 3) return new Set(normalized ? [normalized] : [])

  const ngrams = new Set<string>()
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    ngrams.add(normalized.slice(index, index + 3))
  }
  return ngrams
}

function jaccardSimilarity<T>(left: Set<T>, right: Set<T>) {
  if (left.size === 0 || right.size === 0) return 0

  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }
  return intersection / (left.size + right.size - intersection)
}

function isInitialismOf(shortTitle: string, longTitle: string) {
  if (!/^\p{L}{3,5}$/u.test(shortTitle)) return false
  const words = longTitle.split(/\s+/).filter(Boolean)
  return (
    words.length >= 3 && words.map((word) => word[0]).join('') === shortTitle
  )
}

/**
 * Compares titles without sending them to another provider. Exact matches,
 * token-subset variants, and close spelling variants are treated as possible
 * duplicates; this is intentionally a conservative pre-generation gate.
 */
export function cardTitleSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeTitle(left)
  const normalizedRight = normalizeTitle(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 1

  if (
    isInitialismOf(normalizedLeft, normalizedRight) ||
    isInitialismOf(normalizedRight, normalizedLeft)
  ) {
    return 0.95
  }

  const leftTokens = titleTokens(left)
  const rightTokens = titleTokens(right)
  const tokenSimilarity = jaccardSimilarity(leftTokens, rightTokens)
  const shorterTokenCount = Math.min(leftTokens.size, rightTokens.size)
  let similarity = tokenSimilarity

  // Do not let a one-word title such as "Overview" suppress every longer
  // title containing that word. Multi-word subsets are materially stronger.
  const leftIsSubset = [...leftTokens].every((token) => rightTokens.has(token))
  const rightIsSubset = [...rightTokens].every((token) => leftTokens.has(token))
  if (
    shorterTokenCount >= 2 &&
    tokenSimilarity > 0 &&
    (leftIsSubset || rightIsSubset)
  ) {
    similarity = Math.max(similarity, 0.9)
  }

  return Math.max(
    similarity,
    jaccardSimilarity(characterNgrams(left), characterNgrams(right))
  )
}

export function findPotentialDuplicateTitle(
  title: string,
  existingTitles: readonly string[]
) {
  let match: { matchedTitle: string; similarity: number } | null = null

  for (const existingTitle of existingTitles) {
    const similarity = cardTitleSimilarity(title, existingTitle)
    if (
      similarity >= CARD_TITLE_SIMILARITY_THRESHOLD &&
      (!match || similarity > match.similarity)
    ) {
      match = { matchedTitle: existingTitle, similarity }
    }
  }

  return match
}

const cardExplanationSchema = z
  .string()
  .trim()
  .min(2)
  .max(8_192)
  .refine((value) => /[\p{L}\p{N}]/u.test(value), {
    message: 'Generated card explanation must contain an answer',
  })

const legacySourceMetadataValueSchema = z.union([
  z.string().max(MAX_TITLE_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

const safeSourceUrlSchema = z
  .string()
  .trim()
  .url()
  .max(MAX_URL_LENGTH)
  .refine(isSafeElementSourceUrl, {
    message: 'Source URLs must be stable http(s) addresses without credentials',
  })

const storedLegacySourceUrlSchema = z
  .string()
  .trim()
  .url()
  .max(MAX_URL_LENGTH)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Source URLs must use http(s)',
  })

const pageLocatorSchema = z
  .object({
    type: z.literal('PAGE_RANGE'),
    pageFrom: z.number().int().min(1),
    pageTo: z.number().int().min(1),
    labelFrom: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    labelTo: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  })
  .strict()

const webLocatorSchema = z
  .object({
    type: z.literal('WEB_ANCHOR'),
    url: safeSourceUrlSchema,
    label: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  })
  .strict()

const sourceLocatorSchema = z.discriminatedUnion('type', [
  pageLocatorSchema,
  webLocatorSchema,
])

const elementSourceReferenceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    kind: z.enum(['DOCUMENT', 'WEB']),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    canonicalUrl: safeSourceUrlSchema.optional(),
    chunkIds: z
      .array(z.string().trim().min(1).max(MAX_ID_LENGTH))
      .min(1)
      .max(MAX_SOURCE_COUNT),
    locators: z.array(sourceLocatorSchema).max(MAX_SOURCE_LOCATOR_COUNT),
  })
  .strict()
  .superRefine((source, refinementContext) => {
    if (new Set(source.chunkIds).size !== source.chunkIds.length) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chunkIds'],
        message: 'Source chunk IDs must be unique',
      })
    }

    if (
      source.locators.some((locator) =>
        source.kind === 'DOCUMENT'
          ? locator.type !== 'PAGE_RANGE'
          : locator.type !== 'WEB_ANCHOR'
      )
    ) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locators'],
        message: 'Source locators must match their source kind',
      })
    }

    const pageLocators = source.locators.filter(
      (locator): locator is ElementSourcePageLocator =>
        locator.type === 'PAGE_RANGE'
    )
    for (const [index, locator] of pageLocators.entries()) {
      if (locator.pageTo < locator.pageFrom) {
        refinementContext.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locators', index],
          message: 'Source page ranges must end on or after their first page',
        })
      }
    }
    for (let index = 1; index < pageLocators.length; index += 1) {
      if (pageLocators[index]!.pageFrom <= pageLocators[index - 1]!.pageTo) {
        refinementContext.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locators', index],
          message: 'Source page ranges must be ordered and disjoint',
        })
      }
    }

    const webUrls = source.locators.flatMap((locator) =>
      locator.type === 'WEB_ANCHOR' ? [locator.url] : []
    )
    if (new Set(webUrls).size !== webUrls.length) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locators'],
        message: 'Source web anchors must be unique',
      })
    }
  })

const legacySourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    chunkId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    url: safeSourceUrlSchema.optional(),
    page: z.number().int().min(1).optional(),
    metadata: z
      .record(z.string().max(MAX_ID_LENGTH), legacySourceMetadataValueSchema)
      .optional(),
  })
  .strict()
  .superRefine((source, refinementContext) => {
    for (const key of Object.keys(source.metadata ?? {})) {
      if (/^(?:text|content|body|snippet|excerpt|raw)$/i.test(key)) {
        refinementContext.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata', key],
          message: 'Source text must not be persisted',
        })
      }
    }
  })

const storedLegacySourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    chunkId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    url: storedLegacySourceUrlSchema.optional(),
    page: z.number().finite().optional(),
    metadata: z
      .record(z.string().max(MAX_ID_LENGTH), legacySourceMetadataValueSchema)
      .optional(),
  })
  .strict()

const sourceInputSchema = z.union([
  elementSourceReferenceSchema,
  legacySourceSchema,
])

const sourceInputsSchema = z
  .array(sourceInputSchema)
  .min(1)
  .max(MAX_SOURCE_COUNT)

const storedSourceInputsSchema = z
  .array(z.union([elementSourceReferenceSchema, storedLegacySourceSchema]))
  .min(1)
  .max(MAX_SOURCE_COUNT)

const elementSourceReferencesSchema = z
  .array(elementSourceReferenceSchema)
  .min(1)
  .max(MAX_SOURCE_COUNT)
  .superRefine((sources, refinementContext) => {
    const sourceIds = sources.map((source) => source.sourceId)
    if (new Set(sourceIds).size !== sourceIds.length) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source material IDs must be unique',
      })
    }

    const chunkIds = sources.flatMap((source) => source.chunkIds)
    if (chunkIds.length > MAX_SOURCE_COUNT) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source references exceed the 32 chunk limit',
      })
    }
    if (new Set(chunkIds).size !== chunkIds.length) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source chunk IDs must be unique',
      })
    }

    if (
      Buffer.byteLength(JSON.stringify(sources), 'utf8') > MAX_METADATA_BYTES
    ) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source references exceed the 64 KiB limit',
      })
    }
  })

const candidateSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    name: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    content: z.string().trim().min(1).max(8_192),
    explanation: cardExplanationSchema,
    sourceMessageId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    sourceToolCallId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    origin: z.enum(['AI_GENERATED', 'AUTHORED']).nullish(),
  })
  .strict()

const cardPlanEntrySchema = z
  .object({
    type: z.literal('FLASHCARD'),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    intent: z.string().trim().min(1).max(MAX_INTENT_LENGTH),
    query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  })
  .strict()

const cardPlanInputSchema = z
  .object({
    courseId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    topic: z.string().trim().min(1).max(MAX_TOPIC_LENGTH),
    cards: z.array(cardPlanEntrySchema).min(1).max(MAX_PLAN_CARDS),
  })
  .strict()

const validateCardCandidateInputSchema = z
  .object({
    courseId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    candidateId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    front: z.string().trim().min(1).max(8_192),
    back: cardExplanationSchema,
    sourceMessageId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    sourceToolCallId: z.string().trim().min(1).max(MAX_ID_LENGTH),
  })
  .strict()

const cardGenerationLeaseInputSchema = z
  .object({
    planMessageId: z.string().uuid(),
    planToolCallId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    attemptToken: z.string().trim().min(1).max(MAX_ID_LENGTH),
  })
  .strict()

const leaseSettlementSchema = z.object({
  id: z.string().uuid(),
  attemptToken: z.string().min(1),
})

export type PersonalElementSource = ElementSourceReference

export type PersonalElementCandidate = z.infer<typeof candidateSchema> & {
  sources: ElementSourceReference[]
}

export type PersonalElementCandidateInput = {
  candidateId: string
  name: string
  content: string
  explanation: string
  sources: PersonalElementSourceInput[]
  sourceMessageId: string
  sourceToolCallId: string
  origin?: 'AI_GENERATED' | 'AUTHORED' | null
}

export type PersonalElementSourceInput = {
  sourceId: string
  kind?: 'DOCUMENT' | 'WEB' | null
  title?: string | null
  canonicalUrl?: string | null
  chunkIds?: readonly string[] | null
  locators?:
    | readonly {
        type: 'PAGE_RANGE' | 'WEB_ANCHOR'
        pageFrom?: number | null
        pageTo?: number | null
        labelFrom?: string | null
        labelTo?: string | null
        url?: string | null
        label?: string | null
      }[]
    | null
  // Compatibility fields for candidate messages and rows written by the
  // unreleased flat-source prototype. New clients never send these fields.
  chunkId?: string | null
  url?: string | null
  page?: number | null
  metadata?: unknown
}

export type CardPlanEntry = {
  type: string
  title: string
  intent: string
  query: string
}

export type PrepareCardPlanInput = {
  courseId: string
  topic: string
  cards: CardPlanEntry[]
}

export type ValidateCardCandidateInput = {
  courseId: string
  candidateId: string
  title: string
  front: string
  back: string
  sources: PersonalElementSourceInput[]
  sourceMessageId: string
  sourceToolCallId: string
}

export type CreatePersonalElementsInput = {
  courseId: string
  candidates: readonly PersonalElementCandidateInput[]
}

export type UpdatePersonalElementInput = {
  id: string
  expectedVersion: number
  name?: string | null
  content?: string | null
  explanation?: string | null
  sources?: readonly PersonalElementSourceInput[] | null
}

export type PersonalElementServiceContext = {
  prisma: DB.PrismaClient
  participantId: string
}

export type CardGenerationLeaseInput = {
  planMessageId: string
  planToolCallId: string
  attemptToken: string
}

function personalElementError(code: string, message = code) {
  return new GraphQLError(message, { extensions: { code } })
}

function isPrismaError(error: unknown, code: 'P2002' | 'P2034') {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

// Prisma 7 wraps adapter serialization conflicts as P2034; this catches
// unwrapped raw adapter errors defensively.
function isSerializationConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'kind' in error.cause &&
    error.cause.kind === 'TransactionWriteConflict'
  )
}

function parsePersonalElementInput<T>(schema: z.ZodType<T>, value: unknown) {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw personalElementError(
        'PERSONAL_ELEMENTS_INVALID_INPUT',
        error.issues[0]?.message ?? 'Personal element input is invalid'
      )
    }
    throw error
  }
}

function withoutNullFields(value: PersonalElementSourceInput) {
  const locators = value.locators?.map((locator) => ({
    type: locator.type,
    ...(locator.pageFrom !== undefined && locator.pageFrom !== null
      ? { pageFrom: locator.pageFrom }
      : {}),
    ...(locator.pageTo !== undefined && locator.pageTo !== null
      ? { pageTo: locator.pageTo }
      : {}),
    ...(locator.labelFrom ? { labelFrom: locator.labelFrom } : {}),
    ...(locator.labelTo ? { labelTo: locator.labelTo } : {}),
    ...(locator.url ? { url: locator.url } : {}),
    ...(locator.label ? { label: locator.label } : {}),
  }))

  return {
    sourceId: value.sourceId,
    ...(value.kind ? { kind: value.kind } : {}),
    ...(value.title ? { title: value.title } : {}),
    ...(value.canonicalUrl ? { canonicalUrl: value.canonicalUrl } : {}),
    ...(value.chunkIds ? { chunkIds: [...value.chunkIds] } : {}),
    ...(locators ? { locators } : {}),
    ...(value.chunkId ? { chunkId: value.chunkId } : {}),
    ...(value.url ? { url: value.url } : {}),
    ...(value.page !== undefined && value.page !== null
      ? { page: value.page }
      : {}),
    ...(value.metadata !== undefined && value.metadata !== null
      ? { metadata: value.metadata }
      : {}),
  }
}

function collapsePageLocators(
  locators: readonly ElementSourcePageLocator[]
): ElementSourcePageLocator[] {
  const collapsed: ElementSourcePageLocator[] = []

  for (const locator of locators) {
    const previous = collapsed.at(-1)
    if (previous && locator.pageFrom === previous.pageTo + 1) {
      previous.pageTo = locator.pageTo
      previous.labelTo = locator.labelTo ?? locator.labelFrom
      continue
    }
    collapsed.push({ ...locator })
  }

  return collapsed
}

function canonicalizeReference(
  source: z.infer<typeof elementSourceReferenceSchema>,
  index: number
): ElementSourceReference {
  const sourceId =
    sanitizeElementSourceIdentity(source.sourceId) ??
    `stored-source-${index + 1}`
  const locators: ElementSourceLocator[] =
    source.kind === 'DOCUMENT'
      ? collapsePageLocators(
          source.locators.filter(
            (locator): locator is ElementSourcePageLocator =>
              locator.type === 'PAGE_RANGE'
          )
        ).map((locator) => sanitizeElementSourceLocatorLabels(locator))
      : source.locators
          .filter(
            (locator): locator is ElementSourceWebLocator =>
              locator.type === 'WEB_ANCHOR'
          )
          .map((locator) => sanitizeElementSourceLocatorLabels(locator))

  return {
    sourceId,
    kind: source.kind,
    title: sanitizeElementSourceLabel(source.title) ?? sourceId,
    ...(source.canonicalUrl ? { canonicalUrl: source.canonicalUrl } : {}),
    chunkIds: source.chunkIds.map(
      (chunkId, chunkIndex) =>
        sanitizeElementSourceIdentity(chunkId) ??
        `stored-chunk-${index + 1}-${chunkIndex + 1}`
    ),
    locators,
  }
}

function isPdfSourceUrl(url: string | undefined) {
  if (!url) return false
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}

/**
 * Canonical service-boundary parser for the durable source-reference value.
 * It reads the unreleased flat prototype and the grouped shape, but always
 * returns the grouped, source-body-free domain value used for persistence.
 */
function normalizeElementSourceReferencesWithSchema(
  input: readonly PersonalElementSourceInput[] | unknown,
  inputSchema: typeof sourceInputsSchema | typeof storedSourceInputsSchema
): ElementSourceReference[] {
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_METADATA_BYTES) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      'Source references exceed the 64 KiB limit'
    )
  }

  const normalizedInput = Array.isArray(input)
    ? input.map((source) =>
        source && typeof source === 'object'
          ? withoutNullFields(source as PersonalElementSourceInput)
          : source
      )
    : input
  const parsed = parsePersonalElementInput(inputSchema, normalizedInput)
  const references: ElementSourceReference[] = []
  const legacyBySourceId = new Map<
    string,
    {
      sourceId: string
      kind: 'DOCUMENT' | 'WEB'
      title: string
      canonicalUrl?: string
      chunkIds: string[]
      pageLocators: ElementSourcePageLocator[]
      webLocators: Array<{ type: 'WEB_ANCHOR'; url: string }>
    }
  >()

  for (const [sourceIndex, source] of parsed.entries()) {
    if ('chunkIds' in source) {
      references.push(canonicalizeReference(source, sourceIndex))
      continue
    }

    const sourceId =
      sanitizeElementSourceIdentity(source.sourceId) ??
      `stored-source-${sourceIndex + 1}`
    const stableUrl =
      source.url && isSafeElementSourceUrl(source.url) ? source.url : undefined
    const page = source.page
    const validPage =
      typeof page === 'number' && Number.isInteger(page) && page >= 1
        ? page
        : undefined
    const kind =
      source.page !== undefined || isPdfSourceUrl(source.url)
        ? 'DOCUMENT'
        : 'WEB'
    const title =
      sanitizeElementSourceLabel(source.title ?? source.sourceId) ?? sourceId
    const existing = legacyBySourceId.get(source.sourceId)
    if (
      existing &&
      (existing.kind !== kind ||
        existing.title !== title ||
        existing.canonicalUrl !== stableUrl)
    ) {
      throw personalElementError(
        'PERSONAL_ELEMENTS_INVALID_INPUT',
        'Flat source entries for one material must share the same snapshot'
      )
    }

    const reference = existing ?? {
      sourceId,
      kind,
      title,
      ...(stableUrl ? { canonicalUrl: stableUrl } : {}),
      chunkIds: [],
      pageLocators: [],
      webLocators: [],
    }
    if (inputSchema === storedSourceInputsSchema) {
      if (!reference.chunkIds.includes(source.chunkId)) {
        reference.chunkIds.push(source.chunkId)
      }
    } else {
      reference.chunkIds.push(
        sanitizeElementSourceIdentity(source.chunkId) ??
          `stored-chunk-${sourceIndex + 1}`
      )
    }
    if (validPage !== undefined) {
      reference.pageLocators.push({
        type: 'PAGE_RANGE',
        pageFrom: validPage,
        pageTo: validPage,
      })
    } else if (kind === 'WEB' && stableUrl) {
      reference.webLocators.push({ type: 'WEB_ANCHOR', url: stableUrl })
    }
    legacyBySourceId.set(source.sourceId, reference)
  }

  for (const source of legacyBySourceId.values()) {
    const pageLocators = [...source.pageLocators].sort(
      (left, right) => left.pageFrom - right.pageFrom
    )
    const uniquePageLocators = pageLocators.filter(
      (locator, index) => locator.pageFrom !== pageLocators[index - 1]?.pageFrom
    )
    references.push({
      sourceId: source.sourceId,
      kind: source.kind,
      title: source.title,
      ...(source.canonicalUrl ? { canonicalUrl: source.canonicalUrl } : {}),
      chunkIds: [...source.chunkIds],
      locators:
        source.kind === 'DOCUMENT'
          ? collapsePageLocators(uniquePageLocators)
          : source.webLocators.filter(
              (locator, index, all) =>
                all.findIndex((candidate) => candidate.url === locator.url) ===
                index
            ),
    })
  }

  const canonicalReferences =
    inputSchema === storedSourceInputsSchema
      ? sanitizeElementSourceReferenceIdentities(references)
      : references
  return parsePersonalElementInput(
    elementSourceReferencesSchema,
    canonicalReferences
  )
}

export function normalizeElementSourceReferences(
  input: readonly PersonalElementSourceInput[] | unknown
) {
  return normalizeElementSourceReferencesWithSchema(input, sourceInputsSchema)
}

/**
 * Reads rows written by the earlier flat-source prototype without making old
 * expiring links actionable. Invalid page locators and unsafe URLs are omitted.
 */
export function readElementSourceReferences(input: unknown) {
  return normalizeElementSourceReferencesWithSchema(
    input,
    storedSourceInputsSchema
  )
}

function assertParticipantContext(context: PersonalElementServiceContext) {
  if (context.participantId.trim().length === 0) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_UNAUTHORIZED',
      'Only authenticated participants can use personal elements'
    )
  }
}

async function assertCourseParticipation(
  prisma: PrismaTransactionClient,
  participantId: string,
  courseId: string
) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
    select: { id: true },
  })

  if (!participation) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_NOT_PARTICIPATING',
      'The participant is not enrolled in this course'
    )
  }
}

async function fetchSavedTitles(
  prisma: PrismaTransactionClient,
  participantId: string,
  courseId: string,
  excludeCandidateIds?: readonly string[]
) {
  const savedElements = await prisma.personalElement.findMany({
    where: {
      participantId,
      courseId,
      ...(excludeCandidateIds && excludeCandidateIds.length > 0
        ? { candidateId: { notIn: [...excludeCandidateIds] } }
        : {}),
    },
    select: { name: true },
  })
  return savedElements.map((element) => element.name)
}

export type PreparedCardPlanEntry = {
  type: 'FLASHCARD'
  candidateId: string
  title: string
  intent: string
  query: string
}

export type PreparedCardPlan = {
  courseLanguage: DB.Locale
  existingTitles: string[]
  cards: PreparedCardPlanEntry[]
  discardedDuplicates: DiscardedDuplicateCard[]
}

/**
 * Prepares a card plan on the backend: authorizes the course, loads the
 * course language and the complete saved-title list, screens the proposed
 * titles against saved cards and within the proposal, and assigns stable
 * server-issued candidate identities. The complete title list is returned as
 * read-only model context; the backend repeats authoritative checks at
 * candidate validation.
 */
export async function prepareCardPlan(
  input: PrepareCardPlanInput,
  context: PersonalElementServiceContext
): Promise<PreparedCardPlan> {
  assertParticipantContext(context)
  const parsed = parsePersonalElementInput(cardPlanInputSchema, input)

  const participation = await context.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: parsed.courseId,
        participantId: context.participantId,
      },
    },
    select: { course: { select: { language: true } } },
  })
  if (!participation) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_NOT_PARTICIPATING',
      'The participant is not enrolled in this course'
    )
  }

  const existingTitles = await fetchSavedTitles(
    context.prisma,
    context.participantId,
    parsed.courseId
  )

  const planId = randomUUID()
  const retained: PreparedCardPlanEntry[] = []
  const discardedDuplicates: DiscardedDuplicateCard[] = []
  const titlesToCompare = [...existingTitles]

  for (const [index, card] of parsed.cards.entries()) {
    const match = findPotentialDuplicateTitle(card.title, titlesToCompare)
    if (match) {
      discardedDuplicates.push({ title: card.title, ...match })
      continue
    }
    retained.push({
      type: 'FLASHCARD',
      candidateId: planId + ':card-' + (index + 1),
      title: card.title,
      intent: card.intent,
      query: card.query,
    })
    titlesToCompare.push(card.title)
  }

  return {
    courseLanguage: participation.course.language,
    existingTitles,
    cards: retained,
    discardedDuplicates,
  }
}

/**
 * Validates a generated Flashcard candidate before it can render: course
 * participation, source-message ownership, the structural FLASHCARD payload,
 * source bounds, and current title similarity against saved cards.
 */
export async function validateCardCandidate(
  input: ValidateCardCandidateInput,
  context: PersonalElementServiceContext
): Promise<true> {
  assertParticipantContext(context)
  const { sources, ...candidateInput } = input
  normalizeElementSourceReferences(sources)
  const parsed = parsePersonalElementInput(
    validateCardCandidateInputSchema,
    candidateInput
  )

  await assertCourseParticipation(
    context.prisma,
    context.participantId,
    parsed.courseId
  )

  const sourceMessage = await context.prisma.chatMessage.findFirst({
    where: {
      id: parsed.sourceMessageId,
      thread: { participantId: context.participantId },
    },
    select: { id: true },
  })
  if (!sourceMessage) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_SOURCE_MESSAGE_NOT_FOUND',
      'The source message is not available to this participant'
    )
  }

  const savedTitles = await fetchSavedTitles(
    context.prisma,
    context.participantId,
    parsed.courseId
  )
  const duplicate = findPotentialDuplicateTitle(parsed.title, savedTitles)
  if (duplicate) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_DUPLICATE_TITLE',
      'A card with a similar title already exists: ' + duplicate.matchedTitle
    )
  }

  return true
}

function normalizeCandidates(
  candidates: readonly PersonalElementCandidateInput[]
) {
  if (candidates.length === 0 || candidates.length > MAX_CANDIDATE_COUNT) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      `At least one and at most ${MAX_CANDIDATE_COUNT} candidates are allowed`
    )
  }

  const parsed = candidates.map((candidate) => {
    const { sources, ...candidateInput } = candidate
    return {
      ...parsePersonalElementInput(candidateSchema, candidateInput),
      sources: toPersistedSources(sources),
    }
  })
  const candidateIds = parsed.map((candidate) => candidate.candidateId)
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      'Candidate IDs must be unique within a batch'
    )
  }
  return parsed
}

function toPersistedSources(sources: readonly PersonalElementSourceInput[]) {
  return normalizeElementSourceReferences(sources)
}

const NEW_PERSONAL_ELEMENT_STATE = {
  eFactor: 2.5,
  interval: 0,
  correctCountStreak: 0,
  correctCount: 0,
  partialCorrectCount: 0,
  wrongCount: 0,
  nextDueAt: null,
  lastAnsweredAt: null,
  lastCorrectAt: null,
  lastPartialCorrectAt: null,
  lastWrongAt: null,
  lastResponseCorrectness: null,
} as const

async function runSerializable<T>(
  prisma: DB.PrismaClient,
  callback: (transaction: PrismaTransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      })
    } catch (error) {
      if (
        (isPrismaError(error, 'P2034') ||
          isPrismaError(error, 'P2002') ||
          isSerializationConflict(error)) &&
        attempt < TRANSACTION_RETRY_LIMIT - 1
      ) {
        // Let the winning serializable transaction commit before retrying.
        // Immediate retries can repeatedly collide with the same transaction.
        await sleep(TRANSACTION_RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      throw error
    }
  }

  throw personalElementError('PERSONAL_ELEMENTS_TRANSACTION_FAILED')
}

export async function claimCardGenerationLease(
  input: CardGenerationLeaseInput,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  const parsed = parsePersonalElementInput(
    cardGenerationLeaseInputSchema,
    input
  )
  const ownsPlanMessage = await context.prisma.chatMessage.findFirst({
    where: {
      id: parsed.planMessageId,
      thread: { participantId: context.participantId },
    },
    select: { id: true },
  })
  if (!ownsPlanMessage) {
    throw personalElementError(
      'CARD_GENERATION_PLAN_NOT_FOUND',
      'The card plan is not available to this participant'
    )
  }

  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + CARD_GENERATION_LEASE_MS)
  try {
    return await context.prisma.cardGenerationLease.create({
      data: {
        participantId: context.participantId,
        ...parsed,
        leaseExpiresAt,
      },
    })
  } catch (error) {
    if (!isPrismaError(error, 'P2002')) throw error
  }

  const existing = await context.prisma.cardGenerationLease.findUnique({
    where: {
      participantId_planMessageId_planToolCallId: {
        participantId: context.participantId,
        planMessageId: parsed.planMessageId,
        planToolCallId: parsed.planToolCallId,
      },
    },
  })
  if (existing?.completedAt) {
    throw personalElementError(
      'CARD_GENERATION_ALREADY_COMPLETED',
      'This card plan has already been used'
    )
  }
  if (!existing || existing.leaseExpiresAt > now) {
    throw personalElementError(
      'CARD_GENERATION_IN_PROGRESS',
      'This card plan is already being generated'
    )
  }

  const reclaimed = await context.prisma.cardGenerationLease.updateMany({
    where: {
      id: existing.id,
      completedAt: null,
      leaseExpiresAt: { lte: now },
    },
    data: {
      attemptToken: parsed.attemptToken,
      leaseExpiresAt,
    },
  })
  if (reclaimed.count === 0) {
    throw personalElementError(
      'CARD_GENERATION_IN_PROGRESS',
      'This card plan is already being generated'
    )
  }

  return context.prisma.cardGenerationLease.findUniqueOrThrow({
    where: { id: existing.id },
  })
}

export async function completeCardGenerationLease(
  id: string,
  attemptToken: string,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  const now = new Date()
  const parsed = parsePersonalElementInput(leaseSettlementSchema, {
    id,
    attemptToken,
  })
  const completed = await context.prisma.cardGenerationLease.updateMany({
    where: {
      id: parsed.id,
      participantId: context.participantId,
      attemptToken: parsed.attemptToken,
      completedAt: null,
      leaseExpiresAt: { gt: now },
    },
    data: { completedAt: new Date() },
  })
  return completed.count === 1
}

export async function abortCardGenerationLease(
  id: string,
  attemptToken: string,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  const now = new Date()
  const parsed = parsePersonalElementInput(leaseSettlementSchema, {
    id,
    attemptToken,
  })
  const aborted = await context.prisma.cardGenerationLease.updateMany({
    where: {
      id: parsed.id,
      participantId: context.participantId,
      attemptToken: parsed.attemptToken,
      completedAt: null,
      leaseExpiresAt: { gt: now },
    },
    data: { leaseExpiresAt: new Date() },
  })
  return aborted.count === 1
}

function toCreateData(
  candidate: PersonalElementCandidate,
  participantId: string,
  courseId: string
) {
  return {
    participantId,
    courseId,
    version: 1,
    type: DB.ElementType.FLASHCARD,
    name: candidate.name,
    content: candidate.content,
    explanation: candidate.explanation,
    sources: candidate.sources,
    ...NEW_PERSONAL_ELEMENT_STATE,
    origin:
      candidate.origin === 'AUTHORED'
        ? DB.PersonalElementOrigin.AUTHORED
        : DB.PersonalElementOrigin.AI_GENERATED,
    sourceMessageId: candidate.sourceMessageId,
    sourceToolCallId: candidate.sourceToolCallId,
    candidateId: candidate.candidateId,
  }
}

export async function createPersonalElements(
  input: CreatePersonalElementsInput,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  const candidates = normalizeCandidates(input.candidates)

  return runSerializable(context.prisma, async (transaction) => {
    await assertCourseParticipation(
      transaction,
      context.participantId,
      input.courseId
    )

    const discarded = await transaction.personalElementDiscard.findMany({
      where: {
        participantId: context.participantId,
        courseId: input.courseId,
        candidateId: {
          in: candidates.map((candidate) => candidate.candidateId),
        },
      },
      select: { candidateId: true },
    })
    if (discarded.length > 0) {
      throw personalElementError(
        'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED',
        'A candidate has already been discarded'
      )
    }

    const existing = await transaction.personalElement.findMany({
      where: {
        participantId: context.participantId,
        courseId: input.courseId,
        candidateId: {
          in: candidates.map((candidate) => candidate.candidateId),
        },
      },
    })
    const existingByCandidateId = new Map(
      existing.map((element) => [element.candidateId, element] as const)
    )
    const missing = candidates.filter(
      (candidate) => !existingByCandidateId.has(candidate.candidateId)
    )

    if (missing.length > 0) {
      const titlesToScreen = await fetchSavedTitles(
        transaction,
        context.participantId,
        input.courseId,
        missing.map((candidate) => candidate.candidateId)
      )
      for (const candidate of missing) {
        const duplicate = findPotentialDuplicateTitle(
          candidate.name,
          titlesToScreen
        )
        if (duplicate) {
          throw personalElementError(
            'PERSONAL_ELEMENTS_DUPLICATE_TITLE',
            'A card with a similar title already exists: ' +
              duplicate.matchedTitle
          )
        }
      }

      const count = await transaction.personalElement.count({
        where: {
          participantId: context.participantId,
          courseId: input.courseId,
        },
      })
      if (count + missing.length > PERSONAL_ELEMENT_LIMIT) {
        throw personalElementError(
          'PERSONAL_ELEMENTS_LIMIT_REACHED',
          `A participant can save at most ${PERSONAL_ELEMENT_LIMIT} personal elements per course`
        )
      }

      for (const candidate of missing) {
        const created = await transaction.personalElement.create({
          data: toCreateData(candidate, context.participantId, input.courseId),
        })
        existingByCandidateId.set(candidate.candidateId, created)
      }
    }

    return candidates.map(
      (candidate) => existingByCandidateId.get(candidate.candidateId)!
    )
  })
}

export type DiscardPersonalElementCandidateInput = {
  courseId: string
  candidateId: string
}

/**
 * Records a candidate discard through the same serializable transaction
 * policy as candidate creation. The shared transaction boundary prevents a
 * concurrent save and discard from observing each other as absent.
 */
export async function discardPersonalElementCandidate(
  input: DiscardPersonalElementCandidateInput,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)

  return runSerializable(context.prisma, async (transaction) => {
    await assertCourseParticipation(
      transaction,
      context.participantId,
      input.courseId
    )

    const existingElement = await transaction.personalElement.findFirst({
      where: {
        participantId: context.participantId,
        courseId: input.courseId,
        candidateId: input.candidateId,
      },
      select: { id: true },
    })
    if (existingElement) {
      throw personalElementError(
        'PERSONAL_ELEMENTS_CANDIDATE_SAVED',
        'Candidate has already been saved'
      )
    }

    return transaction.personalElementDiscard.upsert({
      where: {
        participantId_courseId_candidateId: {
          participantId: context.participantId,
          courseId: input.courseId,
          candidateId: input.candidateId,
        },
      },
      create: {
        participantId: context.participantId,
        courseId: input.courseId,
        candidateId: input.candidateId,
      },
      update: {},
    })
  })
}

export async function listPersonalElements(
  { courseId }: { courseId: string },
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  await assertCourseParticipation(
    context.prisma,
    context.participantId,
    courseId
  )

  const elements = await context.prisma.personalElement.findMany({
    where: {
      participantId: context.participantId,
      courseId,
    },
  })

  return elements.sort((left, right) => {
    if (!left.nextDueAt && right.nextDueAt) return -1
    if (left.nextDueAt && !right.nextDueAt) return 1
    if (left.nextDueAt && right.nextDueAt) {
      const dueDifference = left.nextDueAt.getTime() - right.nextDueAt.getTime()
      if (dueDifference !== 0) return dueDifference
    }
    return left.createdAt.getTime() - right.createdAt.getTime()
  })
}

export async function getPersonalElementCounts(
  { courseId }: { courseId: string },
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  await assertCourseParticipation(
    context.prisma,
    context.participantId,
    courseId
  )

  const [personalElementCount, personalDueCount] = await Promise.all([
    context.prisma.personalElement.count({
      where: { participantId: context.participantId, courseId },
    }),
    context.prisma.personalElement.count({
      where: {
        participantId: context.participantId,
        courseId,
        OR: [{ nextDueAt: null }, { nextDueAt: { lte: new Date() } }],
      },
    }),
  ])

  return { personalElementCount, personalDueCount }
}

export async function respondToPersonalElement(
  {
    id,
    response,
    expectedVersion,
  }: { id: string; response: FlashcardCorrectness; expectedVersion: number },
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_VERSION')
  }
  if (!Object.values(FlashcardCorrectness).includes(response)) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_RESPONSE')
  }

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id },
    })
    if (!element || element.participantId !== context.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.participantId,
      element.courseId
    )
    if (element.version !== expectedVersion) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    const correct = response === FlashcardCorrectness.CORRECT
    const partial = response === FlashcardCorrectness.PARTIAL
    const correctness = correct
      ? DB.ResponseCorrectness.CORRECT
      : partial
        ? DB.ResponseCorrectness.PARTIAL
        : DB.ResponseCorrectness.WRONG
    const grade = correct ? 1 : partial ? 0.5 : 0
    const nextStreak = correct ? element.correctCountStreak + 1 : 0
    const spacedRepetition = updateSpacedRepetition({
      eFactor: element.eFactor,
      interval: element.interval,
      streak: nextStreak,
      grade,
    })
    const now = new Date()

    const result = await transaction.personalElement.updateMany({
      where: {
        id,
        participantId: context.participantId,
        version: expectedVersion,
      },
      data: {
        correctCount: { increment: correct ? 1 : 0 },
        correctCountStreak: nextStreak,
        partialCorrectCount: { increment: partial ? 1 : 0 },
        wrongCount: { increment: correct || partial ? 0 : 1 },
        lastAnsweredAt: now,
        lastCorrectAt: correct ? now : undefined,
        lastPartialCorrectAt: partial ? now : undefined,
        lastWrongAt: !correct && !partial ? now : undefined,
        lastResponseCorrectness: correctness,
        eFactor: spacedRepetition.efactor,
        interval: spacedRepetition.interval,
        nextDueAt: spacedRepetition.nextDueAt,
      },
    })
    if (result.count !== 1) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    return transaction.personalElement.findUniqueOrThrow({ where: { id } })
  })
}

export async function updatePersonalElement(
  input: UpdatePersonalElementInput,
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_VERSION')
  }
  if (input.sources && (!input.name || !input.content || !input.explanation)) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      'A generated revision must replace the complete card and source reference set'
    )
  }

  const normalizedSources = input.sources
    ? toPersistedSources(input.sources)
    : undefined
  const updateData = {
    name: input.name?.trim(),
    content: input.content?.trim(),
    explanation: input.explanation?.trim(),
  }
  const parsedFields = parsePersonalElementInput(
    z
      .object({
        name: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
        content: z.string().min(1).max(8_192).optional(),
        explanation: cardExplanationSchema.optional(),
      })
      .strict(),
    updateData
  )
  const parsedUpdate = {
    ...parsedFields,
    ...(normalizedSources ? { sources: normalizedSources } : {}),
  }
  if (Object.values(parsedUpdate).every((value) => value === undefined)) {
    throw personalElementError(
      'PERSONAL_ELEMENT_INVALID_INPUT',
      'At least one card field must be updated'
    )
  }

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id: input.id },
    })
    if (!element || element.participantId !== context.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.participantId,
      element.courseId
    )
    if (element.version !== input.expectedVersion) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    const semanticChanged =
      (parsedUpdate.content !== undefined &&
        parsedUpdate.content !== element.content) ||
      (parsedUpdate.explanation !== undefined &&
        parsedUpdate.explanation !== element.explanation) ||
      (parsedUpdate.sources !== undefined &&
        !isDeepEqual(parsedUpdate.sources, element.sources))

    if (!semanticChanged && parsedUpdate.name === undefined) {
      return element
    }

    return transaction.personalElement.update({
      where: { id: input.id },
      data: {
        ...parsedUpdate,
        ...(semanticChanged
          ? { version: { increment: 1 }, ...NEW_PERSONAL_ELEMENT_STATE }
          : {}),
      },
    })
  })
}

export async function deletePersonalElement(
  { id }: { id: string },
  context: PersonalElementServiceContext
) {
  assertParticipantContext(context)

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id },
    })
    if (!element || element.participantId !== context.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.participantId,
      element.courseId
    )
    await transaction.personalElement.delete({ where: { id } })
    return id
  })
}
