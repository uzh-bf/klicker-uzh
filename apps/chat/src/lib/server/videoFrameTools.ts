import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import {
  isVideoSearchTool,
  VIDEO_FRAME_TOOL,
  type VideoFrame,
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
  const wrapped: ToolSet = { ...tools }
  for (const [name, definition] of Object.entries(tools)) {
    if (!isVideoSearchTool(name) || !definition.execute) continue
    const execute = definition.execute
    wrapped[name] = {
      ...definition,
      execute: async (input, options) => {
        const result = await execute(input, options)
        for (const frame of videoFrameCandidates(result)) {
          if (kbIds.includes(frame.kb_id) && candidates.size < 30)
            candidates.set(frame.asset_id, frame)
        }
        return result
      },
    }
  }
  wrapped[VIDEO_FRAME_TOOL] = tool({
    description:
      'Display the representative frame from a retrieved course video when that visual directly helps explain the answer. First search course material with doc_query, then select an asset_id from video_frames returned by that search. When selecting a frame, begin the final answer with a short paragraph that introduces what the student is about to see; the UI places the video directly after that paragraph. Continue the explanation afterward when useful. The frame was already described in the retrieved chunk; this displays the original pixels to the student. Do not invent frame ids or URLs. At most three frames per response.',
    inputSchema: z.object({ asset_id: z.string().regex(/^[a-f0-9]{64}$/) }),
    execute: async ({ asset_id }) => {
      const frame = candidates.get(asset_id)
      if (!frame || (!selected.has(asset_id) && selected.size >= 3))
        return { status: 'unavailable' as const }
      selected.add(asset_id)
      try {
        await readFrame(frame)
      } catch {
        selected.delete(asset_id)
        return { status: 'unavailable' as const }
      }
      return { status: 'selected' as const, frame }
    },
  })
  return wrapped
}
