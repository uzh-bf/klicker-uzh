import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import { courseImageMarker } from '@/src/lib/markdown/remarkCourseImages'
import {
  isVideoSearchTool,
  MAX_VIDEO_FRAME_CANDIDATES,
  MAX_VIDEO_FRAMES_PER_RESPONSE,
  VIDEO_FRAME_TOOL,
  type VideoFrame,
  videoAssetIdSchema,
  videoFrameCandidates,
} from '@/src/lib/sources/videoFrames'

/** Request-local registry. Only frames returned by this turn's scoped search are selectable. */
export function withVideoFrameTool(
  tools: ToolSet,
  kbIds: readonly string[],
  readFrame: (frame: VideoFrame) => Promise<unknown>
): ToolSet {
  const candidates = new Map<string, VideoFrame>()
  const selected = new Set<string>()
  const pendingReads = new Map<string, Promise<boolean>>()
  const wrapped: ToolSet = { ...tools }
  for (const [name, definition] of Object.entries(tools)) {
    if (!isVideoSearchTool(name) || !definition.execute) continue
    const execute = definition.execute
    wrapped[name] = {
      ...definition,
      execute: async (input, options) => {
        const result = await execute(input, options)
        for (const frame of videoFrameCandidates(result)) {
          if (
            kbIds.includes(frame.kb_id) &&
            candidates.size < MAX_VIDEO_FRAME_CANDIDATES
          )
            candidates.set(frame.asset_id, frame)
        }
        return result
      },
    }
  }
  wrapped[VIDEO_FRAME_TOOL] = tool({
    description:
      'Display a still image of the representative frame from a retrieved course video only when that visual directly helps explain the answer. First search course material with doc_query, then select an asset_id from video_frames returned by that search. After a successful selection, put the returned placement_marker on its own line, with blank lines before and after, between the paragraphs it illustrates, using the same image placement as course document images. The frame was already described in the retrieved chunk; this displays the original pixels to the student. Numbered citations in the answer and image caption jump to Sources; hovering previews the frame. The full source entry opens the original recording outside chat. There is no video player in the answer. Do not invent frame ids, placement markers or URLs. At most three frames per response.',
    inputSchema: z.object({ asset_id: videoAssetIdSchema }),
    execute: async ({ asset_id }) => {
      const frame = candidates.get(asset_id)
      if (!frame) return { status: 'unavailable' as const }
      const selection = {
        status: 'selected' as const,
        frame,
        placement_marker: courseImageMarker(frame.asset_id),
      }
      if (selected.has(asset_id)) return selection
      const pendingRead = pendingReads.get(asset_id)
      if (pendingRead)
        return (await pendingRead)
          ? selection
          : { status: 'unavailable' as const }
      if (selected.size + pendingReads.size >= MAX_VIDEO_FRAMES_PER_RESPONSE)
        return { status: 'unavailable' as const }

      const readPromise = (async () => {
        try {
          await readFrame(frame)
          selected.add(asset_id)
          return true
        } catch (error) {
          console.error('[chat] video frame selection failed', {
            assetId: asset_id,
            error,
          })
          return false
        } finally {
          pendingReads.delete(asset_id)
        }
      })()
      pendingReads.set(asset_id, readPromise)

      if (!(await readPromise)) return { status: 'unavailable' as const }
      return selection
    },
  })
  return wrapped
}
