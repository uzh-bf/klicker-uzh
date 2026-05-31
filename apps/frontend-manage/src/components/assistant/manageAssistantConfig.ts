type BuildManageAssistantUrlArgs = {
  chatUrl?: string
  locale?: string
}

export function isManageAssistantEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function buildManageAssistantUrl({
  chatUrl,
  locale,
}: BuildManageAssistantUrlArgs): string | null {
  if (!chatUrl) return null

  try {
    const url = new URL('/manage', chatUrl)
    url.searchParams.set('embed', 'true')

    if (locale) {
      url.searchParams.set('locale', locale)
    }

    return url.toString()
  } catch {
    return null
  }
}
