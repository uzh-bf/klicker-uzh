import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '../src/lib/sources/normalizeSources'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'
import {
  sourceMedia,
  withVideoSourceFrames,
} from '../src/lib/sources/videoSourceMedia'

const fixture = JSON.parse(
  await readFile(
    path.resolve('scripts/fixtures/video-frames/query-result.json'),
    'utf8'
  )
)
const frame = videoFrameCandidates(fixture)[0]!
const query: ChatSourcePart = {
  type: 'tool-call',
  toolName: 'KB_doc_query',
  result: fixture,
}
const scope = { chatbotId: 'bot', threadId: 'thread', messageId: 'message' }
const sources = (parts: ChatSourcePart[]) =>
  withVideoSourceFrames(normalizeSourcesFromParts(parts), parts)

describe('video source media', () => {
  it('previews a retrieved frame without requiring an inline image selection', () => {
    const [source] = sources([query])
    expect(source?.videoFrame).toEqual(frame)
    expect(sourceMedia(source!, scope)).toEqual({
      frameSrc: `/api/chatbots/bot/threads/thread/messages/message/frames/${frame.asset_id}`,
      href: `/api/chatbots/bot/threads/thread/messages/message/videos/${frame.asset_id}#t=42`,
    })
  })

  it('keeps same-title recordings associated with their own retrieved source', () => {
    const second = structuredClone(fixture.sources[0])
    second.reference = 'urn:video-ingestion:second-recording'
    second.chunks[0].video_frames.external_resource_id = 'other-recording'
    second.chunks[0].video_frames.source_video_sha256 = 'b'.repeat(64)
    second.chunks[0].video_frames.video.sha256 = 'b'.repeat(64)
    second.chunks[0].video_frames.assets[0].asset_id = 'c'.repeat(64)
    const parts = [
      {
        ...query,
        result: { ...fixture, sources: [fixture.sources[0], second] },
      },
    ]
    const result = sources(parts)
    expect(result).toHaveLength(2)
    expect(result[0]?.videoFrame?.asset_id).toBe(frame.asset_id)
    expect(result[1]?.videoFrame?.asset_id).toBe('c'.repeat(64))
  })

  it('prefers the selected frame within the matching source range', () => {
    const payload = structuredClone(fixture)
    payload.sources[0].chunks[0].video_frames.assets.push({
      ...payload.sources[0].chunks[0].video_frames.assets[0],
      asset_id: 'd'.repeat(64),
      timestamp_sec: 51,
    })
    const selected = videoFrameCandidates(payload)[1]!
    const parts = [
      { ...query, result: payload },
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame: selected },
      },
    ]
    expect(sources(parts)[0]?.videoFrame).toEqual(selected)
  })

  it('does not borrow a frame from another range or a failed search', () => {
    const payload = structuredClone(fixture)
    payload.sources[0].chunks[0].start_sec = 0
    expect(
      sources([{ ...query, result: payload }])[0]?.videoFrame
    ).toBeUndefined()
    expect(sources([{ ...query, isError: true }])).toEqual([])
  })

  it('preserves source numbering, identity and ordinary document navigation', () => {
    const document = {
      reference: 'https://example.com/lecture.pdf',
      title: 'Lecture',
      source_type: 'pdf',
      chunks: [{ content: 'A paragraph', page_number: 3 }],
    }
    const parts = [
      {
        ...query,
        result: { ...fixture, sources: [document, ...fixture.sources] },
      },
    ]
    const normalized = normalizeSourcesFromParts(parts)
    const result = sources(parts)
    expect(result.map(({ id, index }) => ({ id, index }))).toEqual(
      normalized.map(({ id, index }) => ({ id, index }))
    )
    expect(sourceMedia(result[0]!, scope)).toEqual({
      frameSrc: undefined,
      href: 'https://example.com/lecture.pdf#page=3',
    })
    expect(result[1]?.videoFrame).toEqual(frame)
  })

  it('never emits a partial message route or links a private retrieval handle', () => {
    expect(
      sourceMedia(sources([query])[0]!, { ...scope, messageId: '' })
    ).toEqual({ frameSrc: undefined, href: undefined })
  })
})
