import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { type ToolSet, tool } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { readVideoFrame } from '../src/lib/server/videoFrameStore'
import {
  readLocalVideo,
  videoObjectKey,
} from '../src/lib/server/videoPlaybackStore'
import { withVideoFrameTool } from '../src/lib/server/videoFrameTools'
import {
  selectedVideoFrame,
  selectedVideoFrames,
  videoFrameCandidates,
} from '../src/lib/sources/videoFrames'

const root = path.resolve('scripts/fixtures/video-frames')
const fixture = JSON.parse(
  await readFile(path.join(root, 'query-result.json'), 'utf8')
)
const candidate = videoFrameCandidates(fixture)[0]!
const options = { toolCallId: 'synthetic', messages: [], context: undefined }
async function call(tools: ToolSet, name: string, input: unknown) {
  return tools[name]!.execute!(input, options)
}
function searchTools(result: unknown = fixture): ToolSet {
  return {
    KB_doc_query: tool({
      inputSchema: z.object({ query: z.string() }),
      execute: async () => result,
    }),
  }
}

describe('video frame selection', () => {
  it('preserves the representative frame and retrieved time range', () => {
    expect(candidate.timestamp_sec).toBe(50)
    expect(candidate.start_sec).toBe(42)
    expect(candidate.end_sec).toBe(59)
    expect(
      videoFrameCandidates({
        content: [{ type: 'text', text: JSON.stringify(fixture) }],
      })
    ).toEqual([candidate])
  })

  it('rejects non-video, failed and out-of-range frame evidence', () => {
    expect(videoFrameCandidates({ isError: true, ...fixture })).toEqual([])
    const broken = structuredClone(fixture)
    broken.sources[0].source_type = 'pdf'
    expect(videoFrameCandidates(broken)).toEqual([])
    broken.sources[0].source_type = 'video'
    broken.sources[0].chunks[0].video_frames.assets[0].timestamp_sec = 60
    expect(videoFrameCandidates(broken)).toEqual([])
  })

  it('requires current-turn evidence and allowed KB before opening storage', async () => {
    const read = vi.fn().mockResolvedValue(Buffer.from('jpeg'))
    const tools = withVideoFrameTool(searchTools(), [candidate.kb_id], read)
    expect(
      await call(tools, 'show_video_frame', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'unavailable' })
    await call(tools, 'KB_doc_query', { query: 'diagram in lecture' })
    expect(
      await call(tools, 'show_video_frame', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'selected', frame: candidate })
    expect(read).toHaveBeenCalledTimes(1)

    const other = withVideoFrameTool(searchTools(), [], read)
    await call(other, 'KB_doc_query', { query: 'diagram in lecture' })
    expect(
      await call(other, 'show_video_frame', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'unavailable' })
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('renders only explicitly selected persisted tool results', () => {
    const parts = [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame: candidate },
      },
    ]
    expect(selectedVideoFrames(JSON.parse(JSON.stringify(parts)))).toEqual([
      candidate,
    ])
    expect(selectedVideoFrame(parts[0]!)).toEqual(candidate)
    expect(
      selectedVideoFrame({
        ...parts[0]!,
        result: { status: 'unavailable' },
      })
    ).toBeUndefined()
    expect(
      selectedVideoFrames([
        { type: 'tool-call', toolName: 'KB_doc_query', result: fixture },
      ])
    ).toEqual([])
  })

  it('resolves the authoritative JPEG occurrence and verifies its hash', async () => {
    const bytes = await readVideoFrame(candidate, root)
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
    await expect(
      readVideoFrame({ ...candidate, visual_state_id: 'other' }, root)
    ).rejects.toThrow('occurrence')
    await expect(
      readVideoFrame({ ...candidate, frame_sha256: 'a'.repeat(64) }, root)
    ).rejects.toThrow('occurrence')
    await expect(
      readVideoFrame(
        { ...candidate, source_video_sha256: 'a'.repeat(64) },
        root
      )
    ).rejects.toThrow('manifest')
    await expect(
      readVideoFrame({ ...candidate, manifest_sha256: 'a'.repeat(64) }, root)
    ).rejects.toThrow()
  })

  it('resolves the cited recording from the content-addressed video projection', async () => {
    expect(videoObjectKey(candidate)).toContain(candidate.video_sha256)
    const previous = process.env.CHAT_VIDEO_FRAME_STORE_PATH
    process.env.CHAT_VIDEO_FRAME_STORE_PATH = root
    try {
      const { bytes, size } = await readLocalVideo(candidate)
      expect(size).toBe(33688)
      expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp')
    } finally {
      if (previous === undefined) delete process.env.CHAT_VIDEO_FRAME_STORE_PATH
      else process.env.CHAT_VIDEO_FRAME_STORE_PATH = previous
    }
  })
})
