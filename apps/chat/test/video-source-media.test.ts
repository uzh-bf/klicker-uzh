import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '../src/lib/sources/normalizeSources'
import {
  sourceForVideoFrame,
  videoFrameCandidates,
} from '../src/lib/sources/videoFrames'
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
      href: undefined,
    })
  })

  it('opens the supplied recording URL while keeping the protected frame preview', () => {
    const payload = structuredClone(fixture)
    const url = 'https://video.example.edu/recordings/lecture-01#t=42,59'
    payload.sources[0].source_url = url
    const [source] = sources([{ ...query, result: payload }])
    expect(sourceMedia(source, scope)).toEqual({
      frameSrc: `/api/chatbots/bot/threads/thread/messages/message/frames/${frame.asset_id}`,
      href: url,
    })
    expect(sourceMedia(source, { ...scope, messageId: '' })).toEqual({
      frameSrc: undefined,
      href: url,
    })
  })

  it.each([
    'javascript:alert(1)',
    'https://user:password@video.example.edu/lecture',
    'http://127.0.0.1/recording',
  ])('never opens an unsafe supplied recording URL: %s', (url) => {
    const payload = structuredClone(fixture)
    payload.sources[0].source_url = url
    const [source] = sources([{ ...query, result: payload }])
    expect(sourceMedia(source, scope).href).toBeUndefined()
    expect(sourceMedia(source, scope).frameSrc).toContain('/frames/')
  })

  it('keeps same-title recordings associated with their own retrieved source', () => {
    const second = structuredClone(fixture.sources[0])
    second.reference = 'urn:video-ingestion:second-recording'
    second.chunks[0].video_frames.external_resource_id = 'other-recording'
    second.chunks[0].video_frames.source_video_sha256 = 'b'.repeat(64)
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

  it('associates a selected later-chunk frame with its retrieved source', () => {
    const payload = structuredClone(fixture)
    const later = structuredClone(payload.sources[0].chunks[0])
    later.start_sec = 70
    later.end_sec = 90
    later.content = 'The explanation in the later section.'
    payload.sources[0].source_url = 'https://video.example.edu/lecture#t=42,59'
    Object.assign(later.video_frames.assets[0], {
      asset_id: 'd'.repeat(64),
      start_sec: 70,
      end_sec: 90,
      timestamp_sec: 80,
    })
    payload.sources[0].chunks.push(later)
    const selected = videoFrameCandidates(payload)[1]!
    const parts = [
      { ...query, result: payload },
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame: selected },
      },
    ]
    const result = sources(parts)
    expect(result[0]?.videoFrame).toEqual(selected)
    expect(result[0]).toMatchObject({
      id: normalizeSourcesFromParts(parts)[0]!.id,
      index: 1,
      startSec: 70,
      endSec: 90,
      excerpt: 'The explanation in the later section.',
      url: 'https://video.example.edu/lecture#t=42,59',
    })
    expect(sourceForVideoFrame(selected, result)).toBe(result[0])
    expect(sourceForVideoFrame(videoFrameCandidates(payload)[0]!, result)).toBe(
      result[0]
    )
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
