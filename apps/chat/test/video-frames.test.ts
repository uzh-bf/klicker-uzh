import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { type ToolSet, tool } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  readVideoFrame,
  videoFrameStoreConfigured,
} from '../src/lib/server/videoFrameStore'
import {
  parseVideoByteRange,
  readLocalVideo,
  signedVideoPlaybackUrl,
  videoObjectKey,
} from '../src/lib/server/videoPlaybackStore'
import { withVideoFrameTool } from '../src/lib/server/videoFrameTools'
import {
  selectedVideoFrame,
  selectedVideoFrames,
  sourceForVideoFrame,
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
  it('enables frame retrieval for either local fixtures or complete Blob configuration', () => {
    expect(
      videoFrameStoreConfigured({ CHAT_VIDEO_FRAME_STORE_PATH: root })
    ).toBe(true)
    expect(
      videoFrameStoreConfigured({
        CHAT_VIDEO_BLOB_CONTAINER: 'course-media',
        BLOB_STORAGE_ACCOUNT_NAME: 'storage',
        BLOB_STORAGE_ACCESS_KEY: 'secret',
      })
    ).toBe(true)
    expect(
      videoFrameStoreConfigured({
        CHAT_VIDEO_BLOB_CONTAINER: 'course-media',
        BLOB_STORAGE_ACCOUNT_NAME: 'storage',
      })
    ).toBe(false)
  })

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

  it('links a selected frame to its matching timestamped source', () => {
    const sources = [
      {
        id: 'matching',
        index: 1,
        type: 'video' as const,
        title: candidate.title,
        startSec: candidate.start_sec,
        endSec: candidate.end_sec,
      },
      {
        id: 'other-range',
        index: 2,
        type: 'video' as const,
        title: candidate.title,
        startSec: 0,
        endSec: candidate.start_sec,
      },
    ]

    expect(sourceForVideoFrame(candidate, sources)?.index).toBe(1)
    expect(
      sourceForVideoFrame(
        { ...candidate, title: 'Different recording' },
        sources
      )
    ).toBeUndefined()
  })

  it('normalizes the video title exactly like document sources', () => {
    const titled = structuredClone(fixture)
    titled.sources[0].title = '  Lecture recording  '
    expect(videoFrameCandidates(titled)[0]?.title).toBe('Lecture recording')

    delete titled.sources[0].title
    delete titled.sources[0].display_name
    titled.sources[0].file_name = 'lecture-01.mp4'
    expect(videoFrameCandidates(titled)[0]?.title).toBe('lecture-01.mp4')
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

  it('reads and verifies manifests and frames from the production Blob projection', async () => {
    const frameBytes = await readFile(
      path.join(
        root,
        'e1/v1/frames/sha256',
        candidate.frame_sha256.slice(0, 2),
        candidate.frame_sha256.slice(2, 4),
        `${candidate.frame_sha256}.jpg`
      )
    )
    const manifest = {
      schema_version: 'video_frame_assets.v1',
      source_video_sha256: candidate.source_video_sha256,
      assets: [
        {
          asset_id: candidate.asset_id,
          frame_sha256: candidate.frame_sha256,
          visual_state_id: candidate.visual_state_id,
          timestamp_sec: candidate.timestamp_sec,
          width_px: candidate.width_px,
          height_px: candidate.height_px,
          mime_type: candidate.mime_type,
        },
      ],
    }
    const manifestBytes = Buffer.from(JSON.stringify(manifest))
    const manifestSha256 = createHash('sha256')
      .update(manifestBytes)
      .digest('hex')
    const objects = new Map([
      [
        `e1/v1/manifests/sha256/${manifestSha256.slice(0, 2)}/${manifestSha256.slice(2, 4)}/${manifestSha256}.json`,
        manifestBytes,
      ],
      [
        `e1/v1/frames/sha256/${candidate.frame_sha256.slice(0, 2)}/${candidate.frame_sha256.slice(2, 4)}/${candidate.frame_sha256}.jpg`,
        frameBytes,
      ],
    ])
    const requestedKeys: string[] = []
    const blobReader = vi.fn(async (key: string) => {
      requestedKeys.push(key)
      return objects.get(key)!
    })
    await expect(
      readVideoFrame(
        { ...candidate, manifest_sha256: manifestSha256 },
        undefined,
        blobReader
      )
    ).resolves.toEqual(frameBytes)
    expect(requestedKeys).toEqual([...objects.keys()])
  })

  it('resolves the cited recording from the content-addressed video projection', async () => {
    expect(videoObjectKey(candidate)).toContain(candidate.video_sha256)
    expect(() =>
      videoObjectKey({ ...candidate, video_extension: 'avi' as 'mp4' })
    ).toThrow('extension')
    const previous = process.env.CHAT_VIDEO_FRAME_STORE_PATH
    process.env.CHAT_VIDEO_FRAME_STORE_PATH = root
    try {
      const { filename, size } = await readLocalVideo(candidate)
      const bytes = await readFile(filename)
      expect(size).toBe(33688)
      expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp')
    } finally {
      if (previous === undefined) delete process.env.CHAT_VIDEO_FRAME_STORE_PATH
      else process.env.CHAT_VIDEO_FRAME_STORE_PATH = previous
    }
  })

  it('uses the configured Blob endpoint for signed playback', async () => {
    const previous = {
      account: process.env.BLOB_STORAGE_ACCOUNT_NAME,
      accountUrl: process.env.BLOB_STORAGE_ACCOUNT_URL,
      accessKey: process.env.BLOB_STORAGE_ACCESS_KEY,
      container: process.env.CHAT_VIDEO_BLOB_CONTAINER,
    }
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'devstoreaccount1'
    process.env.BLOB_STORAGE_ACCOUNT_URL =
      'http://localhost:10000/devstoreaccount1'
    process.env.BLOB_STORAGE_ACCESS_KEY = Buffer.alloc(32).toString('base64')
    process.env.CHAT_VIDEO_BLOB_CONTAINER = 'course-media'
    try {
      await expect(signedVideoPlaybackUrl(candidate)).resolves.toMatch(
        /^http:\/\/localhost:10000\/devstoreaccount1\/course-media\//
      )
    } finally {
      if (previous.account === undefined)
        delete process.env.BLOB_STORAGE_ACCOUNT_NAME
      else process.env.BLOB_STORAGE_ACCOUNT_NAME = previous.account
      if (previous.accountUrl === undefined)
        delete process.env.BLOB_STORAGE_ACCOUNT_URL
      else process.env.BLOB_STORAGE_ACCOUNT_URL = previous.accountUrl
      if (previous.accessKey === undefined)
        delete process.env.BLOB_STORAGE_ACCESS_KEY
      else process.env.BLOB_STORAGE_ACCESS_KEY = previous.accessKey
      if (previous.container === undefined)
        delete process.env.CHAT_VIDEO_BLOB_CONTAINER
      else process.env.CHAT_VIDEO_BLOB_CONTAINER = previous.container
    }
  })

  it('parses explicit and suffix byte ranges without falling back silently', () => {
    expect(parseVideoByteRange(null, 1000)).toEqual({
      start: 0,
      end: 999,
      partial: false,
    })
    expect(parseVideoByteRange('bytes=100-199', 1000)).toEqual({
      start: 100,
      end: 199,
      partial: true,
    })
    expect(parseVideoByteRange('bytes=-200', 1000)).toEqual({
      start: 800,
      end: 999,
      partial: true,
    })
    expect(parseVideoByteRange('bytes=-2000', 1000)).toEqual({
      start: 0,
      end: 999,
      partial: true,
    })
    expect(parseVideoByteRange('bytes=100-50', 1000)).toBeUndefined()
    expect(parseVideoByteRange('bytes=0-1,4-5', 1000)).toBeUndefined()
    expect(parseVideoByteRange('items=0-5', 1000)).toBeUndefined()
  })
})
