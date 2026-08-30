import type {
  ElementSourceLocator,
  ElementSourcePageLocator,
} from '@klicker-uzh/types'
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

function pageRangeLabel(
  from: string | number,
  to: string | number,
  t: Translate,
  pdf = false
) {
  if (String(from) === String(to)) {
    return t(pdf ? 'chat.sources.pdfPage' : 'chat.sources.page', {
      page: from,
    })
  }
  return t(pdf ? 'chat.sources.pdfPages' : 'chat.sources.pages', {
    from,
    to,
  })
}

function pageLocatorLabel(locator: ElementSourcePageLocator, t: Translate) {
  const labelFrom = locator.labelFrom
  const labelTo = locator.labelTo ?? labelFrom
  const physical = pageRangeLabel(locator.pageFrom, locator.pageTo, t)
  if (!labelFrom || !labelTo) return physical

  const labelled = pageRangeLabel(labelFrom, labelTo, t)
  if (
    String(labelFrom) === String(locator.pageFrom) &&
    String(labelTo) === String(locator.pageTo)
  ) {
    return labelled
  }
  return `${labelled} (${pageRangeLabel(locator.pageFrom, locator.pageTo, t, true)})`
}

export function getElementSourceLocatorLabel(
  locator: ElementSourceLocator,
  t: Translate
) {
  if (locator.type === 'PAGE_RANGE') return pageLocatorLabel(locator, t)
  return locator.label ?? getDisplayUrl(locator.url) ?? locator.url
}

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

/**
 * The locator line under a source's name, by what that kind of source is
 * actually addressed by: a page for documents, a position for videos, an
 * address for web links. Falls back to the address when a document carries no
 * page at all, so the line stays informative instead of empty. `null` only
 * when nothing at all is known.
 *
 * Shared so the source card and the citation preview render an identical
 * secondary line for the same source.
 */
export function getSourceSecondaryLine(
  source: ChatSource,
  t: Translate
): string | null {
  const parts: string[] = []

  if (source.elementReference) {
    const locatorLabels = source.elementReference.locators.map((locator) =>
      getElementSourceLocatorLabel(locator, t)
    )
    if (locatorLabels.length > 0) return locatorLabels.join(', ')
    return t('chat.sources.unavailable')
  }

  if (source.type === 'video') {
    const timestamp = getSourceTimestamp(source)
    parts.push(timestamp ?? t('chat.sources.video'))
    if (timestamp === undefined && typeof source.page === 'number') {
      parts.push(t('chat.sources.page', { page: source.page }))
    }
    return parts.join(' · ')
  }

  if (source.type === 'image') {
    parts.push(t('chat.sources.image'))
    if (typeof source.page === 'number') {
      parts.push(t('chat.sources.page', { page: source.page }))
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

  if (typeof source.page === 'number') {
    parts.push(t('chat.sources.page', { page: source.page }))
  }
  // A labeled page ("IV", "A-3") is the publisher's own numbering and only
  // adds something next to the numeric page. A clock- or duration-shaped
  // label ("12:34", "1h2m") is not publisher numbering at all: it is the
  // timestamp channel `getSourceTimestamp` reads, so it is dropped here
  // rather than printed as a page label. Documents and links never reach the
  // video branch above, so this filter is what keeps the two apart.
  if (
    source.labeledPage &&
    parseLabeledTimestampSeconds(source.labeledPage) === undefined
  ) {
    parts.push(source.labeledPage)
  }

  if (parts.length === 0 && displayUrl) parts.push(displayUrl)

  return parts.length > 0 ? parts.join(' · ') : null
}
