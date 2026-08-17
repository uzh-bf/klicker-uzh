type BuildManageAssistantUrlArgs = {
  chatUrl?: string
  locale?: string
  parentOrigin?: string
  // Defaults to true so existing (iframe) call sites are unaffected. The
  // standalone "open in new tab" link must pass `embed: false` to get a
  // clean, non-embedded URL that keeps the assistant's normal login CTA.
  embed?: boolean
}

export function isManageAssistantEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function buildManageAssistantUrl({
  chatUrl,
  locale,
  parentOrigin,
  embed = true,
}: BuildManageAssistantUrlArgs): string | null {
  if (!chatUrl) return null

  try {
    const url = new URL('/manage', chatUrl)

    if (embed) {
      url.searchParams.set('embed', 'true')
    }

    if (locale) {
      url.searchParams.set('locale', locale)
    }

    // Hand the embedder's own origin to the embedded assistant so its
    // readiness ping can target a concrete origin instead of a '*' wildcard.
    // Only relevant (and only sent) for the embedded iframe URL.
    if (embed && parentOrigin) {
      url.searchParams.set('parentOrigin', parentOrigin)
    }

    return url.toString()
  } catch {
    return null
  }
}
