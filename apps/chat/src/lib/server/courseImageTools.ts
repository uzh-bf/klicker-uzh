import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import {
  COURSE_IMAGE_TOOL,
  type CourseImage,
  courseImageCandidates,
  isCourseSearchTool,
} from '@/src/lib/sources/courseImages'

/** Request-local registry. Client messages and model-provided hashes never grant access. */
export function withCourseImageTool(
  tools: ToolSet,
  kbIds: readonly string[],
  readImage: (image: CourseImage) => Promise<unknown>,
  onDecisionPendingChange?: (pending: boolean) => void
): ToolSet {
  const candidates = new Map<string, CourseImage>()
  const selected = new Set<string>()
  const wrapped: ToolSet = { ...tools }
  for (const [name, definition] of Object.entries(tools)) {
    if (!isCourseSearchTool(name) || !definition.execute) continue
    const execute = definition.execute
    wrapped[name] = {
      ...definition,
      execute: async (input, options) => {
        const result = await execute(input, options)
        let hasUsableCandidates = false
        for (const image of courseImageCandidates(result)) {
          if (
            kbIds.includes(image.kb_id) &&
            (candidates.has(image.asset_id) || candidates.size < 30)
          ) {
            candidates.set(image.asset_id, image)
            hasUsableCandidates = true
          }
        }
        if (hasUsableCandidates) onDecisionPendingChange?.(true)
        return result
      },
    }
  }
  wrapped[COURSE_IMAGE_TOOL] = tool({
    description:
      'Decide whether to display an original course figure for the LATEST question. Default to no image. A previous turn showing an image is not a reason to show another. Set asset_id to null when no image is needed or supported, or the student requests text only. Select a figure when explicitly requested OR when retrieved evidence shows it materially helps explain the student’s question. In that case show it proactively, without asking for confirmation. First search with doc_query; choose an asset_id from its visual_assets and give a short evidence-grounded reason. Skip weak associations, simple facts, and text-only requests. Prefer one useful figure; at most three per response. This displays pixels to the student, not to you. Do not claim visual inspection or invent image URLs.',
    inputSchema: z.object({
      reason: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .describe(
          'First decide whether the latest question needs an image. A definition, short factual answer, text-only request, or unrelated question needs none. Otherwise explain the retrieved evidence connecting a figure to the concept.'
        ),
      asset_id: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .describe(
          'Use null for definitions, simple facts, text-only requests, or unsupported topics, EVEN if a retrieved figure mentions the term. Otherwise choose a retrieved asset_id that clarifies the requested relationship/process, or matches an explicit image request.'
        ),
    }),
    execute: async ({ asset_id, reason }) => {
      onDecisionPendingChange?.(false)
      if (asset_id === null) return { status: 'skipped' as const, reason }
      const image = candidates.get(asset_id)
      if (!image || (!selected.has(asset_id) && selected.size >= 3))
        return { status: 'unavailable' as const }
      selected.add(asset_id)
      try {
        await readImage(image)
      } catch {
        selected.delete(asset_id)
        return { status: 'unavailable' as const }
      }
      return { status: 'selected' as const, image, reason }
    },
  })
  return wrapped
}
