import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
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
      'Display the representative frame from a retrieved course video when that visual directly helps explain the answer. First search course material with doc_query, then select an asset_id from video_frames returned by that search. When selecting a frame, begin the final answer with a short paragraph that introduces what the student is about to see; the UI places the video directly after that paragraph. Continue the explanation afterward when useful. The frame was already described in the retrieved chunk; this displays the original pixels to the student. Do not invent frame ids or URLs. At most three frames per response.',
    inputSchema: z.object({ asset_id: videoAssetIdSchema }),
    execute: async ({ asset_id }) => {
      const frame = candidates.get(asset_id)
      if (!frame) return { status: 'unavailable' as const }
      if (selected.has(asset_id)) return { status: 'selected' as const, frame }
      const pendingRead = pendingReads.get(asset_id)
      if (pendingRead)
        return (await pendingRead)
          ? { status: 'selected' as const, frame }
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
      return { status: 'selected' as const, frame }
    },
  })
  return wrapped
}
