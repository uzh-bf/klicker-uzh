import React from 'react'

export function getYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const isYoutubeHost =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host.endsWith('.youtu.be')
    if (!isYoutubeHost) {
      return null
    }

    if (host.endsWith('youtu.be')) {
      const id = parsed.pathname.slice(1)
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id
      }
    }
    if (parsed.pathname.startsWith('/embed/')) {
      const id = parsed.pathname.split('/')[2]
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id
      }
    }
    const v = parsed.searchParams.get('v')
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      return v
    }

    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    const id = match?.[2]
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    // Ignore URL parse error for relative/broken URLs
    return null
  }
}

export function getKalturaId(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.toLowerCase()
    const isKalturaHost =
      host === 'kaltura.com' ||
      host.endsWith('.kaltura.com') ||
      host === 'cast.switch.ch' ||
      host.endsWith('.cast.switch.ch')
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

export function getKalturaUiConfId(url: string): string {
  try {
    const pathMatch = url.match(/\/uiConfId\/(\d+)/i)
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1]
    }
    const parsedUrl = new URL(url)
    const queryId =
      parsedUrl.searchParams.get('uiconf_id') ||
      parsedUrl.searchParams.get('uiConfId')
    if (queryId && /^\d+$/.test(queryId)) {
      return queryId
    }
  } catch {
    // Ignore URL parse error
  }
  return '23449004'
}

export function getKalturaPartnerId(url: string): string {
  try {
    const pathMatch = url.match(/\/partner_id\/(\d+)/i)
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1]
    }
    const parsedUrl = new URL(url)
    const queryId =
      parsedUrl.searchParams.get('partner_id') ||
      parsedUrl.searchParams.get('partnerId')
    if (queryId && /^\d+$/.test(queryId)) {
      return queryId
    }
  } catch {
    // Ignore URL parse error
  }
  return '106'
}

interface VideoEmbedProps {
  provider: 'youtube' | 'kaltura'
  videoId: string
  partnerId?: string | null
  uiConfId?: string | null
}

export function VideoEmbed({
  provider,
  videoId,
  partnerId,
  uiConfId,
}: VideoEmbedProps): React.ReactElement {
  const src =
    provider === 'youtube'
      ? `https://www.youtube.com/embed/${videoId}`
      : `https://api.cast.switch.ch/p/${partnerId || '106'}/embedPlaykitJs/uiconf_id/${uiConfId || '23449004'}/partner_id/${partnerId || '106'}?iframeembed=true&playerId=kaltura_player&entry_id=${videoId}`

  return (
    <div className="my-4 aspect-video w-full overflow-hidden rounded-md border border-slate-200">
      <iframe
        title={
          provider === 'youtube'
            ? 'YouTube video player'
            : 'Kaltura video player'
        }
        src={src}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
