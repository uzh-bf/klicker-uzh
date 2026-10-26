import type { useTranslations } from 'next-intl'

import type { ChatSource, ChatSourceType } from './types'

// Video/image sources get their own compact grid in `sources-section.tsx`.
// Shared by the sources grid and the inline citation hover preview
// (citation-chip.tsx) so both agree on what a source "is".
export const MEDIA_SOURCE_TYPES: readonly ChatSourceType[] = ['video', 'image']

export function isMediaSource(source: Pick<ChatSource, 'type'>): boolean {
  return MEDIA_SOURCE_TYPES.includes(source.type)
}

// next-intl's `useTranslations()` return type, instantiated at the root
// namespace (`<never>`) — same pattern as `lib/config/reasoning.ts`. Bare
// `ReturnType<typeof useTranslations>` hits "type instantiation is
// excessively deep" against the full Messages union.
export type Translate = ReturnType<typeof useTranslations<never>>

const MAX_DISPLAY_URL_LENGTH = 48

/** `754` -> `12:34`, `3723` -> `1:02:03`. Minutes stay unpadded. */
export function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const paddedSeconds = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }
  return `${minutes}:${paddedSeconds}`
}

/**
 * Seconds from the time notations a course video link or a chunk label
 * realistically uses: plain seconds (`90`), clock form (`1:30`, `1:02:03`),
 * and YouTube's compound form (`1m30s`, `1h2m3s`). Returns `undefined` for
 * anything else, so a non-time `labeled_page_number` such as `"Kapitel IV"`
 * is never mistaken for a timestamp.
 */
export function parseTimestampSeconds(value: string): number | undefined {
  const raw = value.trim().toLowerCase()
  if (!raw) return undefined

  if (/^\d+$/.test(raw)) return Number(raw)
  if (/^\d+s$/.test(raw)) return Number(raw.slice(0, -1))

  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/.exec(raw)
  if (clock) {
    const [, hours, minutes, seconds] = clock
    if (Number(minutes) > 59 || Number(seconds) > 59) return undefined
    return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds)
  }

  const compound = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw)
  if (compound && (compound[1] || compound[2] || compound[3])) {
    const [, hours, minutes, seconds] = compound
    return (
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)
    )
  }

  return undefined
}

function parseLabeledTimestampSeconds(value: string): number | undefined {
  return /^\s*\d+\s*$/.test(value) ? undefined : parseTimestampSeconds(value)
}

/**
 * A video position for the card and the hover preview.
 *
 * Structured video results provide `startSec` (and optionally `endSec`), while
 * legacy results may still carry a clock-valued `labeledPage` or a time
 * parameter in the video URL. The structured start wins so a compatibility
 * label cannot disagree with the canonical range metadata.
 */
export function getSourceTimestamp(source: ChatSource): string | undefined {
  if (source.startSec !== undefined) {
    return formatTimestamp(source.startSec)
  }

  if (source.labeledPage) {
    const labeled = parseLabeledTimestampSeconds(source.labeledPage)
    if (labeled !== undefined) return formatTimestamp(labeled)
  }

  if (!source.url) return undefined

  try {
    const parsed = new URL(source.url)
    const candidates = [
      parsed.searchParams.get('t'),
      parsed.searchParams.get('start'),
      parsed.searchParams.get('time_continue'),
      // `#t=90` / `#t=1m30s`
      /^#t=(.+)$/.exec(parsed.hash)?.[1],
    ]

    for (const candidate of candidates) {
      if (!candidate) continue
      const seconds = parseTimestampSeconds(candidate)
      if (seconds !== undefined) return formatTimestamp(seconds)
    }
  } catch {
    return undefined
  }

  return undefined
}

/**
 * The readable form of a web source's address: no scheme, no `www.`, no
 * trailing slash, truncated in the middle of the path rather than at the end
 * so the host always stays visible.
 */
export function getDisplayUrl(url: string): string | undefined {
  let host: string
  let rest: string

  try {
    const parsed = new URL(url)
    host = parsed.host.replace(/^www\./i, '')
    rest = `${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, '')
  } catch {
    return undefined
  }

  if (!host) return undefined
  if (rest === '/' || rest === '') return host

  const full = `${host}${rest}`
  if (full.length <= MAX_DISPLAY_URL_LENGTH) return full

  const keep = Math.max(0, MAX_DISPLAY_URL_LENGTH - host.length - 1)
  return `${host}…${rest.slice(rest.length - keep)}`
}

/** Publisher page labels are independent of physical PDF navigation positions. */
export function getSourcePageLabel(value?: string): string | undefined {
  const label = value?.trim()
  return label && parseLabeledTimestampSeconds(label) === undefined
    ? label
    : undefined
}

/**
 * The page value a card may show on its own, without the answer having named a
 * page: the single publisher label the retrieved chunks agree on.
 *
 * A retrieved span is never displayed. `page`/`pageEnd` and
 * `labeledPage`/`labeledPageEnd` are the envelope of everything retrieval
 * returned, so one question about a 127-page script arrives as `2–127`; a card
 * that prints it reads as "the answer used pages 2 to 127". Only the answer's
 * own page detail may produce a displayed range (see
 * `formatCitedPageRanges`), which is why a span degrades to no page line here.
 * A single physical page stays hidden for the older reason: it is a PDF
 * navigation position, not the number printed on the page (see
 * `getSourceNavigationUrl`).
 */
export function getSourcePageRange(source: ChatSource): string | undefined {
  const label = getSourcePageLabel(source.labeledPage)
  if (!label) return undefined

  // `labeledPageEnd` is derived only when the chunk labels disagree, so its
  // presence is exactly the "retrieval spread past one page" case.
  return source.labeledPageEnd === undefined ? label : undefined
}

/**
 * The smallest set of page ranges that covers exactly the given pages:
 * `[2, 3, 7]` becomes `2–3, 7`. Nothing between cited pages is added, so a
 * card never claims pages the answer did not use — the span from the first to
 * the last of 20 retrieved chunks (`2–95` for an answer that cites pages 6–7)
 * is what this replaces.
 */
export function formatCitedPageRanges(
  pages: readonly number[]
): string | undefined {
  const sorted = [
    ...new Set(pages.filter((page) => Number.isSafeInteger(page))),
  ].sort((left, right) => left - right)
  const first = sorted[0]
  if (first === undefined) return undefined

  const ranges: string[] = []
  let start = first
  let end = first
  for (const page of sorted.slice(1)) {
    if (page === end + 1) {
      end = page
      continue
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`)
    start = page
    end = page
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`)

  return ranges.join(', ')
}

/**
 * The locator line under a source's name, by what that kind of source is
 * actually addressed by: a page for documents, a position for videos, an
 * address for web links. Falls back to the address when a document carries no
 * page at all, so the line stays informative instead of empty. `null` only
 * when nothing at all is known.
 *
 * `citedPageRange` is the page range the answer itself cites for this source
 * (see `formatCitedPageRanges`). It wins over the retrieved envelope, which
 * spans every chunk retrieval returned and is not what the answer used.
 *
 * Shared so the source card and the citation preview render an identical
 * secondary line for the same source.
 */
export function getSourceSecondaryLine(
  source: ChatSource,
  t: Translate,
  citedPageRange?: string
): string | null {
  const parts: string[] = []
  const pageLabel = citedPageRange ?? getSourcePageRange(source)

  if (source.type === 'video') {
    const timestamp = getSourceTimestamp(source)
    parts.push(timestamp ?? t('chat.sources.video'))
    if (timestamp === undefined && pageLabel) {
      parts.push(t('chat.sources.page', { page: pageLabel }))
    }
    return parts.join(' · ')
  }

  if (source.type === 'image') {
    parts.push(t('chat.sources.image'))
    if (pageLabel) {
      parts.push(t('chat.sources.page', { page: pageLabel }))
    }
    return parts.join(' · ')
  }

  // A web link is addressed by its URL, so that leads here even when the
  // payload also carried a page. Documents lead with the page and only fall
  // back to the URL when they have no page at all, which keeps the common
  // "lecture-01.pdf / p. 12" pairing intact.
  const displayUrl = source.url ? getDisplayUrl(source.url) : undefined

  if (source.type === 'link' && displayUrl) {
    return displayUrl
  }

  if (pageLabel) {
    parts.push(t('chat.sources.page', { page: pageLabel }))
  }

  if (parts.length === 0 && displayUrl) parts.push(displayUrl)

  return parts.length > 0 ? parts.join(' · ') : null
}
