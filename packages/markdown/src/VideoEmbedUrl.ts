const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/
const KALTURA_ENTRY_ID_PATTERN = /^[01]_[a-zA-Z0-9]{8}$/
const NUMERIC_ID_PATTERN = /^\d+$/
const KALTURA_MEDIA_PATH_PATTERN =
  /\/media\/(?:t\/|[^/]+\/)?([01]_[a-zA-Z0-9]{8})(?:\/|$)/
const KALTURA_ENTRY_PATH_PATTERN = /\/entryId\/([01]_[a-zA-Z0-9]{8})(?:\/|$)/i
const KALTURA_PARTNER_PATH_PATTERNS = [
  /\/p\/(\d+)(?:\/|$)/i,
  /\/partner_id\/(\d+)(?:\/|$)/i,
]
const KALTURA_UI_CONF_PATH_PATTERNS = [
  /\/uiconf_id\/(\d+)(?:\/|$)/i,
  /\/uiConfId\/(\d+)(?:\/|$)/i,
]

export const DEFAULT_KALTURA_PARTNER_ID = '106'
export const DEFAULT_KALTURA_UI_CONF_ID = '23449004'

export type VideoEmbedDescriptor =
  | {
      provider: 'youtube'
      videoId: string
    }
  | {
      provider: 'kaltura'
      videoId: string
      partnerId: string
      uiConfId: string
    }

function isHostOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function getPathMatch(
  pathname: string,
  patterns: RegExp[]
): string | undefined {
  for (const pattern of patterns) {
    const match = pathname.match(pattern)?.[1]
    if (match) {
      return match
    }
  }

  return undefined
}

function getNumericQueryValue(url: URL, names: string[]): string | undefined {
  for (const name of names) {
    const value = url.searchParams.get(name)
    if (value && NUMERIC_ID_PATTERN.test(value)) {
      return value
    }
  }

  return undefined
}

function getYoutubeVideoId(url: URL): string | undefined {
  const hostname = url.hostname.toLowerCase()

  if (isHostOrSubdomain(hostname, 'youtu.be')) {
    const videoId = url.pathname.match(/^\/([^/]+)\/?$/)?.[1]
    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)
      ? videoId
      : undefined
  }

  if (!isHostOrSubdomain(hostname, 'youtube.com')) {
    return undefined
  }

  const pathVideoId =
    url.pathname.match(/^\/(?:embed|v)\/([^/]+)\/?$/)?.[1] ??
    url.pathname.match(/^\/u\/[^/]+\/([^/]+)\/?$/)?.[1]
  if (pathVideoId && YOUTUBE_VIDEO_ID_PATTERN.test(pathVideoId)) {
    return pathVideoId
  }

  const queryVideoId = url.searchParams.get('v')
  return queryVideoId && YOUTUBE_VIDEO_ID_PATTERN.test(queryVideoId)
    ? queryVideoId
    : undefined
}

function getKalturaVideoId(url: URL): string | undefined {
  const mediaId = url.pathname.match(KALTURA_MEDIA_PATH_PATTERN)?.[1]
  if (mediaId) {
    return mediaId
  }

  const entryPathId = url.pathname.match(KALTURA_ENTRY_PATH_PATTERN)?.[1]
  if (entryPathId) {
    return entryPathId
  }

  const queryId = url.searchParams.get('entry_id')
  return queryId && KALTURA_ENTRY_ID_PATTERN.test(queryId) ? queryId : undefined
}

export function parseVideoEmbedUrl(value: string): VideoEmbedDescriptor | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }

    const youtubeId = getYoutubeVideoId(url)
    if (youtubeId) {
      return { provider: 'youtube', videoId: youtubeId }
    }

    const hostname = url.hostname.toLowerCase()
    const isKalturaHost =
      isHostOrSubdomain(hostname, 'kaltura.com') ||
      isHostOrSubdomain(hostname, 'cast.switch.ch')
    if (!isKalturaHost) {
      return null
    }

    const kalturaId = getKalturaVideoId(url)
    if (!kalturaId) {
      return null
    }

    return {
      provider: 'kaltura',
      videoId: kalturaId,
      partnerId:
        getPathMatch(url.pathname, KALTURA_PARTNER_PATH_PATTERNS) ??
        getNumericQueryValue(url, ['partner_id', 'partnerId']) ??
        DEFAULT_KALTURA_PARTNER_ID,
      uiConfId:
        getPathMatch(url.pathname, KALTURA_UI_CONF_PATH_PATTERNS) ??
        getNumericQueryValue(url, ['uiconf_id', 'uiConfId']) ??
        DEFAULT_KALTURA_UI_CONF_ID,
    }
  } catch {
    return null
  }
}

export function getVideoEmbedSrc(descriptor: VideoEmbedDescriptor): string {
  if (descriptor.provider === 'youtube') {
    return `https://www.youtube.com/embed/${descriptor.videoId}`
  }

  // Generic Kaltura links intentionally use the UZH SWITCHcast player for now.
  // Tenant-specific Kaltura origins are not preserved by this integration.
  return `https://api.cast.switch.ch/p/${descriptor.partnerId}/embedPlaykitJs/uiconf_id/${descriptor.uiConfId}/partner_id/${descriptor.partnerId}?iframeembed=true&playerId=kaltura_player&entry_id=${descriptor.videoId}`
}
