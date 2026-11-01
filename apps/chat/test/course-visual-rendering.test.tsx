import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSourcePart } from '../src/lib/sources/normalizeSources'

const state = vi.hoisted(() => ({
  partIndex: 1,
  message: {
    id: 'message',
    status: { type: 'complete' },
    content: [] as ChatSourcePart[],
  },
}))

vi.mock('@assistant-ui/react', () => ({
  useAui: () => ({
    part: {
      source: 'message',
      query: { type: 'index', index: state.partIndex },
    },
  }),
  useAuiState: (select: (value: typeof state) => unknown) => select(state),
}))
vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'chatbot' }),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('../src/stores/chatStore', () => ({ useChatStore: () => 'thread' }))
vi.mock('../src/components/message-sources-context', () => ({
  useMessageSourcesContext: () => ({
    sources: [],
    courseImageSourcesByAssetId: new Map(),
  }),
}))
// Keep the real cards and shared viewer; only Next's image adapter needs a
// stand-in in this Node-only suite. Browser verification exercises zoom/focus.
vi.mock('next/image', () => ({
  default: ({
    unoptimized: _unoptimized,
    ...props
  }: {
    unoptimized?: boolean
  }) => React.createElement('img', props),
}))

import {
  CourseImagesSection,
  InlineCourseImage,
} from '../src/components/course-images-section'
import { courseImageMarker } from '../src/lib/markdown/remarkCourseImages'
import { courseImageCandidates } from '../src/lib/sources/courseImages'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'

const image = courseImageCandidates(
  JSON.parse(
    readFileSync('scripts/fixtures/course-images/query-result.json', 'utf8')
  )
)[0]!
const frame = videoFrameCandidates(
  JSON.parse(
    readFileSync('scripts/fixtures/video-frames/query-result.json', 'utf8')
  )
)[0]!
const selection: ChatSourcePart = {
  type: 'tool-call',
  toolName: 'show_video_frame',
  result: { status: 'selected', frame },
}
const placed = {
  type: 'text',
  text: `Before.\n\n${courseImageMarker(frame.asset_id)}\n\nAfter.`,
}

beforeEach(() => {
  state.partIndex = 1
  state.message.status.type = 'complete'
  state.message.content = [selection, placed]
})

describe('shared course image rendering for video stills', () => {
  it('renders a selected still at the shared marker with the real image viewer and no player', () => {
    const html = renderToStaticMarkup(
      <InlineCourseImage assetId={frame.asset_id} />
    )
    expect(html).toContain('data-cy="course-image-expand"')
    expect(html).toContain(`/messages/message/frames/${frame.asset_id}`)
    expect(html).not.toContain('<video')
    expect(renderToStaticMarkup(<CourseImagesSection />)).toBe('')
  })

  it('keeps duplicate placements and unselected ids out of the rendered answer', () => {
    state.message.content.push(placed)
    state.partIndex = 2
    expect(
      renderToStaticMarkup(<InlineCourseImage assetId={frame.asset_id} />)
    ).toBe('')
    state.message.content = [placed]
    state.partIndex = 0
    expect(
      renderToStaticMarkup(<InlineCourseImage assetId={frame.asset_id} />)
    ).toBe('')
  })

  it('uses the shared legacy fallback for both document images and video stills', () => {
    state.message.content = [
      selection,
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ]
    const html = renderToStaticMarkup(<CourseImagesSection />)
    expect(html).toContain(`/images/${image.asset_id}`)
    expect(html).toContain(`/frames/${frame.asset_id}`)
    expect(html.match(/data-cy="course-image-expand"/g)).toHaveLength(2)
  })

  it.each([
    'running',
    'requires-action',
  ])('waits for persisted media while the answer is %s', (status) => {
    state.message.status.type = status
    expect(
      renderToStaticMarkup(<InlineCourseImage assetId={frame.asset_id} />)
    ).toBe('')
    state.message.content = [selection]
    expect(renderToStaticMarkup(<CourseImagesSection />)).toBe('')
  })
})
