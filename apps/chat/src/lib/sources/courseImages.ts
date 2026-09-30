import { z } from 'zod'
import {
  type ChatSourcePart,
  isDocQueryToolName,
  normalizeSourcesFromParts,
  parseDocQueryPayload,
} from './normalizeSources'
import type { ChatSource } from './types'

export const COURSE_IMAGE_TOOL = 'show_course_image'
/** Bounds the untrusted document-result envelope and persisted selections. */
export const COURSE_IMAGE_LIMITS = {
  sources: 20,
  chunksPerSource: 30,
  assetsPerChunk: 30,
  candidates: 30,
  selectionsPerResponse: 3,
} as const
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const courseImageCaptionSchema = z.object({
  ref: z
    .string()
    .regex(/^#\/[\w/-]+$/)
    .max(512),
  text: z.string().min(1).max(2000),
})
const boundedCleanString = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine(
      (value) => value === value.trim() && !/\p{C}/u.test(value),
      'expected trimmed text without control characters'
    )
const courseImageDescriptionSchema = z.object({
  version: z.literal(1),
  text: boundedCleanString(4000),
  provenance: z.object({
    kind: z.literal('generated'),
    provider: boundedCleanString(200),
    model: boundedCleanString(200),
    prompt_version: z.number().int().positive(),
    image_sha256: digest,
    asset_image_sha256: digest,
  }),
})
const courseImageWireSchema = z.object({
  asset_id: digest,
  image_sha256: digest,
  physical_page_number: z.number().int().positive(),
  logical_page_number: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((value) => value ?? undefined),
  width_px: z.number().int().positive().max(20000),
  height_px: z.number().int().positive().max(20000),
  mime_type: z.literal('image/png'),
  kind: z.literal('figure'),
  captions: z
    .array(courseImageCaptionSchema)
    .max(16)
    .optional()
    .catch(undefined),
  description: z.unknown().optional(),
  source_content_hash: digest,
  extraction_options_hash: digest,
  manifest_sha256: digest,
  kb_id: z.string().uuid(),
  external_resource_id: z.string().uuid(),
  resource_version: z.number().int().positive(),
  title: z.string().min(1).max(300),
})
export const courseImageSchema = courseImageWireSchema.transform((image) => {
  const parsedDescription = courseImageDescriptionSchema.safeParse(
    image.description
  )
  const { description: _description, ...base } = image
  return {
    ...base,
    ...(parsedDescription.success &&
    parsedDescription.data.provenance.asset_image_sha256 === image.image_sha256
      ? { description: parsedDescription.data }
      : {}),
  }
})
export type CourseImage = z.infer<typeof courseImageSchema>

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * One retrieved figure together with the identity of the source record it was
 * found in.
 */
export interface CourseImageCandidate {
  image: CourseImage
  /**
   * `ChatSource.id` of the documents-mode source record that carried this
   * asset, computed the same way the message's Sources list computes it.
   * Absent when that record would not become a source at all.
   */
  sourceId?: string
}

/**
 * The registry identity of one documents-mode source record, obtained by
 * normalizing that record on its own — the route `sourceCitationIndices`
 * already takes, so the value equals the `ChatSource.id` the message's
 * Sources list carries for the same record.
 */
function sourceIdentity(
  payload: Record<string, unknown>,
  rawSource: unknown
): string | undefined {
  const [normalized] = normalizeSourcesFromParts([
    {
      type: 'tool-call',
      toolName: 'doc_query',
      result: { ...payload, sources: [rawSource] },
    },
  ])
  return normalized ? normalized.id : undefined
}

export function courseImageCandidatesWithSource(
  raw: unknown
): CourseImageCandidate[] {
  if (record(raw)?.isError) return []
  const payload = parseDocQueryPayload(raw)
  if (payload?.mode !== 'documents' || 'error' in payload) return []
  const found = new Map<string, CourseImageCandidate>()
  for (const rawSource of (Array.isArray(payload.sources)
    ? payload.sources
    : []
  ).slice(0, COURSE_IMAGE_LIMITS.sources)) {
    const source = record(rawSource)
    if (!source) continue
    const title = [
      source.title,
      source.display_name,
      source.file_name,
      source.reference,
    ].find((v) => typeof v === 'string' && v.length > 0)
    if (typeof title !== 'string') continue
    // Resolved once per source record, not once per asset.
    const sourceId = sourceIdentity(payload, rawSource)
    for (const rawChunk of (Array.isArray(source.chunks)
      ? source.chunks
      : []
    ).slice(0, COURSE_IMAGE_LIMITS.chunksPerSource)) {
      const chunk = record(rawChunk)
      const envelope = record(chunk?.visual_assets)
      if (!chunk || envelope?.version !== 1 || !Array.isArray(envelope.assets))
        continue
      const start =
          typeof chunk.page_start === 'number' ? chunk.page_start : Number.NaN,
        end = typeof chunk.page_end === 'number' ? chunk.page_end : Number.NaN
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start
      )
        continue
      for (const rawAsset of envelope.assets.slice(
        0,
        COURSE_IMAGE_LIMITS.assetsPerChunk
      )) {
        const asset = record(rawAsset)
        if (!asset) continue
        const parsed = courseImageSchema.safeParse({
          ...envelope,
          ...asset,
          title: title.slice(0, 300),
        })
        if (!parsed.success) continue
        const image = parsed.data
        if (
          image.physical_page_number < start ||
          image.physical_page_number > end
        )
          continue
        if (found.size < COURSE_IMAGE_LIMITS.candidates)
          found.set(image.asset_id, { image, sourceId })
      }
    }
  }
  return [...found.values()]
}

export function courseImageCandidates(raw: unknown): CourseImage[] {
  return courseImageCandidatesWithSource(raw).map(
    (candidate) => candidate.image
  )
}

export function selectedCourseImages(
  parts: readonly ChatSourcePart[]
): CourseImage[] {
  const found = new Map<string, CourseImage>()
  for (const part of parts) {
    if (
      part.type !== 'tool-call' ||
      part.toolName !== COURSE_IMAGE_TOOL ||
      part.isError
    )
      continue
    const result = record(part.result)
    if (result?.status !== 'selected') continue
    const parsed = courseImageSchema.safeParse(result.image)
    if (
      parsed.success &&
      found.size < COURSE_IMAGE_LIMITS.selectionsPerResponse
    )
      found.set(parsed.data.asset_id, parsed.data)
  }
  return [...found.values()]
}

export function isCourseSearchTool(name: string) {
  return isDocQueryToolName(name)
}

/**
 * The message's own Sources card for a displayed figure.
 *
 * The persisted `show_course_image` result carries no reference to the
 * retrieval it came from, so the identity is re-derived from the same
 * doc-query tool results the Sources list is normalized from: the raw source
 * record containing this `asset_id` is normalized on its own, and its
 * `ChatSource.id` is looked up among the message's sources. No array
 * position, title, filename or page is guessed at.
 *
 * Fail-closed: a figure whose asset is absent from the retrieval, whose source
 * record does not become a source, whose records disagree about the identity,
 * or whose identity is not among the message's sources (a source past the
 * `MAX_SOURCES` cap, for instance) gets no citation rather than a wrong one.
 */
export function matchCourseImageSource(
  image: Pick<CourseImage, 'asset_id'>,
  sources: readonly ChatSource[],
  messageParts: readonly ChatSourcePart[]
): ChatSource | undefined {
  return courseImageSourceMap(sources, messageParts).get(image.asset_id)
}

/**
 * Resolves every unambiguous figure-to-source relationship in one pass.
 *
 * This is intended to be computed once per message and shared by all figure
 * cards. It retains the same fail-closed behavior as `matchCourseImageSource`:
 * duplicate source identities, conflicting retrieval records, and assets that
 * point outside the displayed source list are omitted.
 */
export function courseImageSourceMap(
  sources: readonly ChatSource[],
  messageParts: readonly ChatSourcePart[]
): ReadonlyMap<string, ChatSource> {
  const identitiesByAssetId = new Map<string, Set<string>>()

  for (const part of messageParts) {
    if (part.type !== 'tool-call' || part.isError) continue
    if (typeof part.toolName !== 'string' || !isCourseSearchTool(part.toolName))
      continue

    for (const candidate of courseImageCandidatesWithSource(part.result)) {
      if (!candidate.sourceId) continue
      const identities = identitiesByAssetId.get(candidate.image.asset_id)
      if (identities) {
        identities.add(candidate.sourceId)
      } else {
        identitiesByAssetId.set(
          candidate.image.asset_id,
          new Set([candidate.sourceId])
        )
      }
    }
  }

  const sourcesByIdentity = new Map<string, ChatSource | undefined>()
  for (const source of sources) {
    sourcesByIdentity.set(
      source.id,
      sourcesByIdentity.has(source.id) ? undefined : source
    )
  }

  const matches = new Map<string, ChatSource>()
  for (const [assetId, identities] of identitiesByAssetId) {
    if (identities.size !== 1) continue
    const [identity] = identities
    if (!identity) continue
    const source = sourcesByIdentity.get(identity)
    if (source) matches.set(assetId, source)
  }
  return matches
}
