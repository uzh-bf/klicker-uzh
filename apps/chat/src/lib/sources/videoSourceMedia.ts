import {
  type ChatSourcePart,
  isDocQueryToolName,
  normalizeSourcesFromParts,
  parseDocQueryPayload,
} from './normalizeSources'
import { getSourceNavigationUrl } from './sourceUrl'
import type { ChatSource } from './types'
import {
  MAX_VIDEO_SOURCES_SCANNED,
  selectedVideoFrames,
  type VideoFrame,
  videoFrameCandidates,
} from './videoFrames'

/** Match within the original retrieval source, never by recording title alone. */
export function withVideoSourceFrames(
  sources: ChatSource[],
  parts: readonly ChatSourcePart[]
): ChatSource[] {
  if (!sources.some((source) => source.type === 'video')) return sources
  const frames = new Map<string, VideoFrame>()
  const selected = new Set(
    selectedVideoFrames(parts).map((frame) => frame.asset_id)
  )
  for (const part of parts) {
    if (
      part.type !== 'tool-call' ||
      part.isError ||
      !isDocQueryToolName(part.toolName ?? '')
    )
      continue
    const payload = parseDocQueryPayload(part.result)
    if (
      payload?.mode !== 'documents' ||
      'error' in payload ||
      !Array.isArray(payload.sources)
    )
      continue
    for (const rawSource of payload.sources.slice(
      0,
      MAX_VIDEO_SOURCES_SCANNED
    )) {
      const result = { ...payload, sources: [rawSource] }
      const [normalized] = normalizeSourcesFromParts([{ ...part, result }])
      const source = sources.find(
        (item) => item.id === normalized?.id && item.type === 'video'
      )
      if (!source) continue
      const candidates = videoFrameCandidates(result).filter(
        (frame) =>
          source.startSec !== undefined &&
          source.endSec !== undefined &&
          Math.abs(source.startSec - frame.start_sec) < 0.001 &&
          Math.abs(source.endSec - frame.end_sec) < 0.001
      )
      const frame =
        candidates.find((item) => selected.has(item.asset_id)) ?? candidates[0]
      if (frame && (!frames.has(source.id) || selected.has(frame.asset_id)))
        frames.set(source.id, frame)
    }
  }
  return sources.map((source) => {
    const videoFrame = frames.get(source.id)
    return videoFrame ? { ...source, videoFrame } : source
  })
}

export function videoFrameUrls(
  frame: VideoFrame,
  scope: { chatbotId?: string; threadId?: string | null; messageId?: string }
) {
  const { chatbotId, threadId, messageId } = scope
  if (!chatbotId || !threadId || !messageId) return undefined
  const base = `/api/chatbots/${encodeURIComponent(chatbotId)}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`
  return {
    frameSrc: `${base}/frames/${frame.asset_id}`,
    // Open the complete recording at the cited start; do not stop at the end of the excerpt.
    recordingUrl: `${base}/videos/${frame.asset_id}#t=${frame.start_sec}`,
  }
}

export function sourceMedia(
  source: ChatSource | undefined,
  scope: Parameters<typeof videoFrameUrls>[1]
) {
  const media = source?.videoFrame
    ? videoFrameUrls(source.videoFrame, scope)
    : undefined
  return {
    frameSrc: media?.frameSrc,
    href:
      media?.recordingUrl ?? getSourceNavigationUrl(source?.url, source?.page),
  }
}
