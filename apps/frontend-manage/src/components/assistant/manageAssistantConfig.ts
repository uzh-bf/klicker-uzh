type BuildManageAssistantUrlArgs = {
  chatUrl?: string
  locale?: string
  returnTo?: string
}

export function isManageAssistantEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function buildManageAssistantUrl({
  chatUrl,
  locale,
  returnTo,
}: BuildManageAssistantUrlArgs): string | null {
  if (!chatUrl) return null

  try {
    const url = new URL('/manage', chatUrl)
    url.searchParams.set('embed', 'true')
    url.searchParams.set('surface', 'manage')

    if (locale) {
      url.searchParams.set('locale', locale)
    }

    if (returnTo) {
      url.searchParams.set('returnTo', returnTo)
    }

    return url.toString()
  } catch {
    return null
  }
}
