import { z } from 'zod'
import {
  type ChatSourcePart,
  isDocQueryToolName,
  parseDocQueryPayload,
} from './normalizeSources'
import type { ChatSource } from './types'

export const VIDEO_FRAME_TOOL = 'show_video_frame'
export const MAX_VIDEO_FRAME_CANDIDATES = 30
export const MAX_VIDEO_FRAMES_PER_RESPONSE = 3
export const MAX_VIDEO_SOURCES_SCANNED = 20
const MAX_VIDEO_CHUNKS_PER_SOURCE = 30
const MAX_VIDEO_ASSETS_PER_CHUNK = 10
export const videoAssetIdSchema = z.string().regex(/^[a-f0-9]{64}$/)
const digest = videoAssetIdSchema
export const videoFrameSchema = z
  .object({
    asset_id: digest,
    frame_sha256: digest,
    manifest_sha256: digest,
    visual_state_id: z.string().min(1).max(200),
    timestamp_sec: z.number().finite().nonnegative(),
    start_sec: z.number().finite().nonnegative(),
    end_sec: z.number().finite().nonnegative(),
    width_px: z.number().int().positive().max(20000),
    height_px: z.number().int().positive().max(20000),
    mime_type: z.literal('image/jpeg'),
    kind: z.literal('video_frame'),
    source_video_sha256: digest,
    kb_id: z.string().uuid(),
    external_resource_id: z.string().min(1).max(300),
    resource_version: z.number().int().positive(),
    title: z.string().min(1),
  })
  .refine((frame) => frame.end_sec >= frame.start_sec, {
    message: 'end_sec must not precede start_sec',
  })

export type VideoFrame = z.infer<typeof videoFrameSchema>

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function videoFrameCandidates(raw: unknown): VideoFrame[] {
  if (record(raw)?.isError) return []
  const payload = parseDocQueryPayload(raw)
  if (payload?.mode !== 'documents' || 'error' in payload) return []
  const found = new Map<string, VideoFrame>()
  for (const rawSource of (Array.isArray(payload.sources)
    ? payload.sources
    : []
  ).slice(0, MAX_VIDEO_SOURCES_SCANNED)) {
    const source = record(rawSource)
    if (!source || String(source.source_type).toLowerCase() !== 'video')
      continue
    const title = [source.title, source.display_name, source.file_name]
      .map((value) => (typeof value === 'string' ? value.trim() : undefined))
      .find((value) => value !== undefined && value.length > 0)
    if (!title) continue
    for (const rawChunk of (Array.isArray(source.chunks)
      ? source.chunks
      : []
    ).slice(0, MAX_VIDEO_CHUNKS_PER_SOURCE)) {
      const chunk = record(rawChunk)
      const envelope = record(chunk?.video_frames)
      if (!chunk || envelope?.version !== 1 || !Array.isArray(envelope.assets))
        continue
      for (const rawAsset of envelope.assets.slice(
        0,
        MAX_VIDEO_ASSETS_PER_CHUNK
      )) {
        const asset = record(rawAsset)
        if (!asset) continue
        const parsed = videoFrameSchema.safeParse({
          ...envelope,
          ...asset,
          title,
        })
        if (!parsed.success) {
          console.warn('[chat] ignoring invalid video frame metadata', {
            issues: parsed.error.issues.map((issue) => issue.path.join('.')),
          })
          continue
        }
        if (found.size < MAX_VIDEO_FRAME_CANDIDATES)
          found.set(parsed.data.asset_id, parsed.data)
      }
    }
  }
  return [...found.values()]
}

export function selectedVideoFrames(
  parts: readonly ChatSourcePart[]
): VideoFrame[] {
  const found = new Map<string, VideoFrame>()
  for (const part of parts) {
    const frame = selectedVideoFrame(part)
    if (frame && found.size < MAX_VIDEO_FRAMES_PER_RESPONSE)
      found.set(frame.asset_id, frame)
  }
  return [...found.values()]
}

export function selectedVideoFrame(
  part: ChatSourcePart
): VideoFrame | undefined {
  if (
    part.type !== 'tool-call' ||
    part.toolName !== VIDEO_FRAME_TOOL ||
    part.isError
  )
    return undefined
  const result = record(part.result)
  if (result?.status !== 'selected') return undefined
  const parsed = videoFrameSchema.safeParse(result.frame)
  if (parsed.success) return parsed.data
  console.warn('[chat] ignoring invalid selected video frame', {
    issues: parsed.error.issues.map((issue) => issue.path.join('.')),
  })
  return undefined
}

export function sourceForVideoFrame(
  frame: VideoFrame,
  sources: readonly ChatSource[]
): ChatSource | undefined {
  return sources.find(
    (source) =>
      source.type === 'video' &&
      (source.videoFrame
        ? source.videoFrame.kb_id === frame.kb_id &&
          source.videoFrame.external_resource_id ===
            frame.external_resource_id &&
          source.videoFrame.source_video_sha256 === frame.source_video_sha256
        : source.title === frame.title) &&
      source.startSec !== undefined &&
      source.endSec !== undefined &&
      Math.abs(source.startSec - frame.start_sec) < 0.001 &&
      Math.abs(source.endSec - frame.end_sec) < 0.001
  )
}

export function isVideoSearchTool(name: string) {
  return isDocQueryToolName(name)
}
