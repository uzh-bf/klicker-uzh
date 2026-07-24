type BuildManageAssistantUrlArgs = {
  chatUrl?: string
  locale?: string
  parentOrigin?: string
}

export function isManageAssistantEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function buildManageAssistantUrl({
  chatUrl,
  locale,
  parentOrigin,
}: BuildManageAssistantUrlArgs): string | null {
  if (!chatUrl) return null

  try {
    const url = new URL('/manage', chatUrl)
    url.searchParams.set('embed', 'true')

    if (locale) {
      url.searchParams.set('locale', locale)
    }

    // Hand the embedder's own origin to the embedded assistant so its
    // readiness ping can target a concrete origin instead of a '*' wildcard.
    if (parentOrigin) {
      url.searchParams.set('parentOrigin', parentOrigin)
    }

    return url.toString()
  } catch {
    return null
  }
}
