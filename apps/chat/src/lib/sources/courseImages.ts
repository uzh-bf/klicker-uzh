import { z } from 'zod'
import {
  type ChatSourcePart,
  isDocQueryToolName,
  parseDocQueryPayload,
} from './normalizeSources'

export const COURSE_IMAGE_TOOL = 'show_course_image'
const digest = z.string().regex(/^[a-f0-9]{64}$/)
export const courseImageSchema = z.object({
  asset_id: digest,
  image_sha256: digest,
  physical_page_number: z.number().int().positive(),
  logical_page_number: z.number().int().positive().optional(),
  width_px: z.number().int().positive().max(20000),
  height_px: z.number().int().positive().max(20000),
  mime_type: z.literal('image/png'),
  kind: z.literal('figure'),
  source_content_hash: digest,
  extraction_options_hash: digest,
  manifest_sha256: digest,
  kb_id: z.string().uuid(),
  external_resource_id: z.string().uuid(),
  resource_version: z.number().int().positive(),
  title: z.string().min(1).max(300),
})
export type CourseImage = z.infer<typeof courseImageSchema>

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function courseImageCandidates(raw: unknown): CourseImage[] {
  if (record(raw)?.isError) return []
  const payload = parseDocQueryPayload(raw)
  if (payload?.mode !== 'documents' || 'error' in payload) return []
  const found = new Map<string, CourseImage>()
  for (const rawSource of (Array.isArray(payload.sources)
    ? payload.sources
    : []
  ).slice(0, 20)) {
    const source = record(rawSource)
    if (!source) continue
    const title = [
      source.title,
      source.display_name,
      source.file_name,
      source.reference,
    ].find((v) => typeof v === 'string' && v.length > 0)
    if (typeof title !== 'string') continue
    for (const rawChunk of (Array.isArray(source.chunks)
      ? source.chunks
      : []
    ).slice(0, 30)) {
      const chunk = record(rawChunk)
      const envelope = record(chunk?.visual_assets)
      if (!chunk || envelope?.version !== 1 || !Array.isArray(envelope.assets))
        continue
      const start = Number(chunk.page_start),
        end = Number(chunk.page_end)
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start
      )
        continue
      for (const rawAsset of envelope.assets.slice(0, 30)) {
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
        if (found.size < 30) found.set(image.asset_id, image)
      }
    }
  }
  return [...found.values()]
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
    if (parsed.success && found.size < 3)
      found.set(parsed.data.asset_id, parsed.data)
  }
  return [...found.values()]
}

export function isCourseSearchTool(name: string) {
  return isDocQueryToolName(name)
}
