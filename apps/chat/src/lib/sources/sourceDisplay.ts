import type { ChatSource, ChatSourceType } from './types'

// Video/image sources have no page/chapter data — just a type label — while
// documents and plain links show page/chapter info. Shared by the sources
// grid (sources-section.tsx) and the inline citation hover preview
// (citation-chip.tsx) so both agree on what a source "is".
export const MEDIA_SOURCE_TYPES: readonly ChatSourceType[] = ['video', 'image']

export function isMediaSource(source: Pick<ChatSource, 'type'>): boolean {
  return MEDIA_SOURCE_TYPES.includes(source.type)
}

// A loose stand-in for next-intl's `useTranslations()` return type. The real
// type (`Translator<Messages, never>`) types `key` as a namespace-relative
// union of ~3000 possible message keys and `values` as
// `Record<string, string | number | Date>`; reproducing it here via
// `ReturnType<typeof useTranslations>` blows up into a "type instantiation is
// excessively deep" error, and plain `string`/`Record<string, unknown>` param
// types fail the opposite way (strict contravariance rejects passing the
// narrower real `t` in — `unknown` isn't assignable to `string | number |
// Date`). `any` on both params short-circuits variance checking in both
// directions while keeping this module's own two call sites meaningful.
export type Translate = (key: any, values?: any) => string

/**
 * "S. 4 · IV" when both a numeric page and a human page label are present,
 * either one alone, a type label for video/image, or `null` when none of
 * these apply. Shared so the source card and the citation preview render an
 * identical secondary line for the same source.
 */
export function getSourceSecondaryLine(
  source: ChatSource,
  t: Translate
): string | null {
  const parts: string[] = []

  if (isMediaSource(source)) {
    parts.push(
      t(source.type === 'video' ? 'chat.sources.video' : 'chat.sources.image')
    )
  }
  if (typeof source.page === 'number') {
    parts.push(t('chat.sources.page', { page: source.page }))
  }
  if (source.labeledPage) parts.push(source.labeledPage)

  return parts.length > 0 ? parts.join(' · ') : null
}
