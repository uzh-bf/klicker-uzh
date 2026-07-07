import React from 'react'

export function getYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname.endsWith('youtube.com') ||
      parsed.hostname.endsWith('youtu.be')
    ) {
      if (parsed.hostname.endsWith('youtu.be')) {
        const id = parsed.pathname.slice(1)
        return id.length === 11 ? id : null
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2]
        return id && id.length === 11 ? id : null
      }
      const v = parsed.searchParams.get('v')
      if (v && v.length === 11) {
        return v
      }
    }
  } catch {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    const id = match?.[2]
    return id && id.length === 11 ? id : null
  }
  return null
}

export function getKalturaId(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.toLowerCase()
    const isKalturaHost =
      host.endsWith('kaltura.com') || host.endsWith('cast.switch.ch')
    if (!isKalturaHost) {
      return null
    }

    const mediaSpaceMatch = url.match(
      /\/media\/(?:t\/|[^/]+\/)?([01]_[a-zA-Z0-9]{8})(?:[/?#]|$)/
    )
    if (mediaSpaceMatch && mediaSpaceMatch[1]) {
      return mediaSpaceMatch[1]
    }

    const entryIdPathMatch = url.match(
      /\/entryId\/([01]_[a-zA-Z0-9]{8})(?:[/?#]|$)/i
    )
    if (entryIdPathMatch && entryIdPathMatch[1]) {
      return entryIdPathMatch[1]
    }

    const entryId = parsedUrl.searchParams.get('entry_id')
    if (entryId && /^[01]_[a-zA-Z0-9]{8}$/.test(entryId)) {
      return entryId
    }
  } catch {
    // Ignore URL parse error
  }
  return null
}

export function getKalturaHost(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.toLowerCase()
    const isKalturaHost =
      host.endsWith('kaltura.com') || host.endsWith('cast.switch.ch')
    return isKalturaHost ? parsedUrl.hostname : null
  } catch {
    return null
  }
}

export function getKalturaUiConfId(url: string): string | null {
  try {
    const pathMatch = url.match(/\/uiConfId\/(\d+)/i)
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1]
    }
    const parsedUrl = new URL(url)
    const queryId = parsedUrl.searchParams.get('uiconf_id')
    if (queryId && /^\d+$/.test(queryId)) {
      return queryId
    }
  } catch {
    // Ignore URL parse error
  }
  return null
}

interface VideoEmbedProps {
  provider: 'youtube' | 'kaltura'
  videoId: string
  host?: string | null
  uiConfId?: string | null
}

export function VideoEmbed({
  provider,
  videoId,
  host,
  uiConfId,
}: VideoEmbedProps): React.ReactElement {
  const src =
    provider === 'youtube'
      ? `https://www.youtube.com/embed/${videoId}`
      : `https://${host || 'uzh.mediaspace.cast.switch.ch'}/embed/secure/iframe/entryId/${videoId}/uiConfId/${uiConfId || '23449004'}/st/0`

  return (
    <div className="my-4 aspect-video w-full overflow-hidden rounded-md border border-slate-200">
      <iframe
        src={src}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
