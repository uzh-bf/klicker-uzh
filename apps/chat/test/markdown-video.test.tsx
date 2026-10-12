import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The chat suite runs in the node environment without jsdom or
// testing-library, so the real assistant-ui markdown primitive cannot mount
// here. These stand-ins hand the production anchor override in
// `markdown-text.tsx` the link props under test, while the anchor override and
// the shared `VideoEmbed`/`parseVideoEmbedUrl` stay the real implementations —
// the markup asserted below is their actual output, not a helper mirror.
type LinkProps = { href?: string; children?: React.ReactNode }
type ComponentsShape = { a: (link: LinkProps) => React.ReactElement }

const mocks = vi.hoisted(() => ({
  link: { href: '', children: 'video' } as LinkProps,
}))

vi.mock('@assistant-ui/react', () => ({
  useMessagePartText: () => ({ text: '', status: { type: 'complete' } }),
}))

vi.mock('@assistant-ui/react-markdown', () => ({
  MarkdownTextPrimitive: ({ components }: { components: ComponentsShape }) =>
    components.a(mocks.link),
  unstable_memoizeMarkdownComponents: (components: Record<string, unknown>) =>
    components,
  useIsMarkdownCodeBlock: () => false,
}))

// `CitationChip` needs the message-sources context and a radix tooltip, neither
// of which mounts in the node environment. The precedence guard only needs the
// citation branch to be taken before any video handling, so the chip itself is
// replaced by a marker element.
vi.mock('../src/components/citation-chip', () => ({
  CitationChip: ({ index }: { index: number }) =>
    React.createElement('span', { 'data-chip': index }),
}))

import { MarkdownText } from '../src/components/markdown-text'

const YOUTUBE_ID = 'dQw4w9WgXcQ'
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${YOUTUBE_ID}`
// Plain `media/<title>/<entryId>` SWITCHcast link; the parser keeps the UZH
// playkit defaults for this shape.
const KALTURA_URL =
  'https://uzh.mediaspace.cast.switch.ch/media/10+Untersuchung/0_ipqc15ga/124135'

function renderLink(href: string, children: React.ReactNode): string {
  mocks.link = { href, children }
  return renderToStaticMarkup(React.createElement(MarkdownText))
}

describe('chat markdown video embeds', () => {
  beforeEach(() => {
    mocks.link = { href: '', children: 'video' }
  })

  test('renders an allowlisted video-labelled link as the shared inline player', () => {
    const html = renderLink(YOUTUBE_URL, 'video')

    expect(html).toContain('<iframe ')
    expect(html).toContain(`src="https://www.youtube.com/embed/${YOUTUBE_ID}"`)
    expect(html).toContain('loading="lazy"')
    // Inline wrapper only: a block element would be invalid inside the
    // paragraph that carries model-written video links.
    expect(html).toContain('<span class="my-4 block')
    expect(html).not.toContain('<div')
    expect(html).not.toContain('<a ')
  })

  test('treats the embed label as a video link too', () => {
    const html = renderLink(KALTURA_URL, 'embed')

    expect(html).toContain('<iframe ')
    expect(html).toContain('entry_id=0_ipqc15ga')
    expect(html).not.toContain('<a ')
  })

  test('keeps an unsupported host as a plain anchor', () => {
    const html = renderLink(
      `https://evil.example/watch?v=${YOUTUBE_ID}`,
      'video'
    )

    expect(html).not.toContain('<iframe')
    expect(html).toContain(`href="https://evil.example/watch?v=${YOUTUBE_ID}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('>video</a>')
  })

  test('keeps a formatted video label as a plain anchor', () => {
    const html = renderLink(
      YOUTUBE_URL,
      React.createElement('strong', null, 'video')
    )

    expect(html).not.toContain('<iframe')
    expect(html).toContain('<strong>video</strong>')
    expect(html).toContain(`href="${YOUTUBE_URL}"`)
  })

  test('keeps an ordinary label on an allowlisted video URL as a plain anchor', () => {
    const html = renderLink(YOUTUBE_URL, 'Watch the lecture')

    expect(html).not.toContain('<iframe')
    expect(html).toContain('>Watch the lecture</a>')
  })

  test('resolves a citation link through the chip before any video handling', () => {
    const html = renderLink('#cite-2', 'video')

    expect(html).toContain('data-chip="2"')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<a ')
  })
})
