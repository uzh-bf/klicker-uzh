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
  readImage: (image: CourseImage) => Promise<unknown>
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
        for (const image of courseImageCandidates(result)) {
          if (kbIds.includes(image.kb_id) && candidates.size < 30)
            candidates.set(image.asset_id, image)
        }
        return result
      },
    }
  }
  wrapped[COURSE_IMAGE_TOOL] = tool({
    description:
      'Display an original course figure ONLY when the student explicitly asks to see an image or diagram. First search course material with doc_query. Select an asset_id from that search visual_assets. This displays pixels to the student, but does not let you inspect them; do not claim to see visual details. Never invent image URLs. At most three images per response.',
    inputSchema: z.object({ asset_id: z.string().regex(/^[a-f0-9]{64}$/) }),
    execute: async ({ asset_id }) => {
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
      return { status: 'selected' as const, image }
    },
  })
  return wrapped
}
