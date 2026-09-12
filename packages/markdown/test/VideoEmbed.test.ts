import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown from '../src/Markdown.js'
import {
  DEFAULT_KALTURA_PARTNER_ID,
  DEFAULT_KALTURA_UI_CONF_ID,
  getVideoEmbedSrc,
  parseVideoEmbedUrl,
} from '../src/VideoEmbedUrl.js'

const YOUTUBE_ID = 'dQw4w9WgXcQ'
const KALTURA_ID = '0_um01ms1s'

function renderMarkdown(
  content: string,
  props: Partial<React.ComponentProps<typeof Markdown>> = {}
): string {
  return renderToStaticMarkup(
    React.createElement(Markdown, { content, ...props })
  )
}

describe('parseVideoEmbedUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
    `https://m.youtube.com/watch?v=${YOUTUBE_ID}&feature=share`,
    `https://youtu.be/${YOUTUBE_ID}?t=12`,
    `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`,
    `https://www.youtube.com/v/${YOUTUBE_ID}`,
    `https://www.youtube.com/u/1/${YOUTUBE_ID}`,
    `https://www.youtube.com/legacy-player?v=${YOUTUBE_ID}`,
  ])('parses supported YouTube URL %s', (url) => {
    expect(parseVideoEmbedUrl(url)).toEqual({
      provider: 'youtube',
      videoId: YOUTUBE_ID,
    })
  })

  it.each([
    `https://evil.example/watch?v=${YOUTUBE_ID}`,
    `https://youtube.com.evil.example/watch?v=${YOUTUBE_ID}`,
    `https://notyoutube.com/watch?v=${YOUTUBE_ID}`,
    `https://attackyoutu.be/${YOUTUBE_ID}`,
    `ftp://youtube.com/watch?v=${YOUTUBE_ID}`,
    `/embed/${YOUTUBE_ID}`,
    'https://youtube.com/watch?v=tooShort',
    `https://youtube.com/shorts/${YOUTUBE_ID}`,
  ])('rejects unsupported or malformed YouTube URL %s', (url) => {
    expect(parseVideoEmbedUrl(url)).toBeNull()
  })

  it.each([
    [
      'https://uzh.mediaspace.cast.switch.ch/media/10+Untersuchung+Kopf+beim+Hund/0_ipqc15ga/124135',
      {
        provider: 'kaltura',
        videoId: '0_ipqc15ga',
        partnerId: DEFAULT_KALTURA_PARTNER_ID,
        uiConfId: DEFAULT_KALTURA_UI_CONF_ID,
      },
    ],
    [
      `https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/${KALTURA_ID}/uiConfId/987654/st/0?partnerId=123`,
      {
        provider: 'kaltura',
        videoId: KALTURA_ID,
        partnerId: '123',
        uiConfId: '987654',
      },
    ],
    [
      `https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?iframeembed=true&entry_id=${KALTURA_ID}`,
      {
        provider: 'kaltura',
        videoId: KALTURA_ID,
        partnerId: '123',
        uiConfId: '987654',
      },
    ],
    [
      `https://www.kaltura.com/index.php?entry_id=${KALTURA_ID}&partner_id=321&uiconf_id=456`,
      {
        provider: 'kaltura',
        videoId: KALTURA_ID,
        partnerId: '321',
        uiConfId: '456',
      },
    ],
  ])('parses supported Kaltura URL %s', (url, expected) => {
    expect(parseVideoEmbedUrl(url)).toEqual(expected)
  })

  it.each([
    `https://evil.example/media/title/${KALTURA_ID}`,
    `https://cast.switch.ch.evil.example/media/title/${KALTURA_ID}`,
    `https://evilkaltura.com/media/title/${KALTURA_ID}`,
    `https://evilcast.switch.ch/media/title/${KALTURA_ID}`,
    `ftp://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?entry_id=${KALTURA_ID}`,
    'https://uzh.mediaspace.cast.switch.ch/media/title/invalid_id',
  ])('rejects unsupported or malformed Kaltura URL %s', (url) => {
    expect(parseVideoEmbedUrl(url)).toBeNull()
  })
})

describe('getVideoEmbedSrc', () => {
  it('builds the original YouTube embed URL', () => {
    expect(getVideoEmbedSrc({ provider: 'youtube', videoId: YOUTUBE_ID })).toBe(
      `https://www.youtube.com/embed/${YOUTUBE_ID}`
    )
  })

  it('builds the Kaltura PlayKit URL with the parsed configuration', () => {
    expect(
      getVideoEmbedSrc({
        provider: 'kaltura',
        videoId: KALTURA_ID,
        partnerId: '123',
        uiConfId: '987654',
      })
    ).toBe(
      `https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654/partner_id/123?iframeembed=true&playerId=kaltura_player&entry_id=${KALTURA_ID}`
    )
  })
})

describe('Markdown video embed rendering', () => {
  it('renders a standalone YouTube link as an immediate iframe in valid DOM', () => {
    const html = renderMarkdown(
      `[video](https://www.youtube.com/watch?v=${YOUTUBE_ID})`
    )

    expect(html).toContain(`<iframe title="YouTube video player"`)
    expect(html).toContain(`src="https://www.youtube.com/embed/${YOUTUBE_ID}"`)
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('aspect-video')
    expect(html).not.toContain('<p><div')
    expect(html).not.toContain('</div></p>')
    expect(html).toContain('<p><span class="my-4 block')
  })

  it('renders Kaltura with its partner and UI configuration', () => {
    const html = renderMarkdown(
      `[embed](https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?iframeembed=true&entry_id=${KALTURA_ID})`
    )

    expect(html).toContain(`<iframe title="Kaltura video player"`)
    expect(html).toContain(
      `src="https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654/partner_id/123?iframeembed=true&amp;playerId=kaltura_player&amp;entry_id=${KALTURA_ID}"`
    )
  })

  it('keeps unsupported video-labelled links as regular links', () => {
    const html = renderMarkdown(
      `[video](https://evil.example/watch?v=${YOUTUBE_ID})`
    )

    expect(html).toContain(`href="https://evil.example/watch?v=${YOUTUBE_ID}"`)
    expect(html).not.toContain('<iframe')
  })

  it('promotes video-labelled links inside a paragraph and preserves its text', () => {
    const html = renderMarkdown(
      [
        `[video](https://www.youtube.com/watch?v=${YOUTUBE_ID})`,
        '. YouTube description',
        '[embed](https://uzh.mediaspace.cast.switch.ch/media/10+Untersuchung+Kopf+beim+Hund/0_ipqc15ga/124135)',
        '. Hosted Kaltura description',
        `[embed](https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?iframeembed=true&entry_id=${KALTURA_ID})`,
        '. Custom Kaltura description',
        '[Link to YouTube](https://youtube.com)',
      ].join('\n'),
      { withLinkButtons: true }
    )

    expect(html.match(/<iframe /g)).toHaveLength(3)
    expect(html).toContain('. YouTube description')
    expect(html).toContain('. Hosted Kaltura description')
    expect(html).toContain('. Custom Kaltura description')
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="https://youtube.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('<span>Link to YouTube</span>')
    expect(html).not.toContain('<p><div')
    expect(html).not.toContain('</div></p>')
    expect(html.match(/<p><span class="my-4 block/g)).toHaveLength(1)
  })

  it('preserves video-link interception in headings and lists', () => {
    const html = renderMarkdown(
      [
        `## [video](https://www.youtube.com/watch?v=${YOUTUBE_ID})`,
        '',
        `- [embed](https://api.cast.switch.ch/p/123/embedPlaykitJs/uiconf_id/987654?iframeembed=true&entry_id=${KALTURA_ID})`,
      ].join('\n')
    )

    expect(html.match(/<iframe /g)).toHaveLength(2)
    expect(html).toContain('<h2><span class="my-4 block')
    expect(html).toContain('<li><span class="my-4 block')
    expect(html).not.toContain('<h2><div')
    expect(html).not.toContain('<li><div')
  })

  it('keeps formatted video labels as regular links', () => {
    const html = renderMarkdown(
      `[**video**](https://www.youtube.com/watch?v=${YOUTUBE_ID})`
    )

    expect(html).toContain('<strong>video</strong>')
    expect(html).not.toContain('<iframe')
  })

  it('uses inline children for link-button markup', () => {
    const html = renderMarkdown('[YouTube](https://youtube.com)', {
      withLinkButtons: true,
    })

    expect(html).toContain('<span></span><span>YouTube</span>')
    expect(html).not.toMatch(/<a[^>]*><div/)
  })
})
