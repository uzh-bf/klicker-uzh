import { z } from 'zod'
import {
  type ChatSourcePart,
  isDocQueryToolName,
  parseDocQueryPayload,
} from './normalizeSources'

export const VIDEO_FRAME_TOOL = 'show_video_frame'
const digest = z.string().regex(/^[a-f0-9]{64}$/)

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
    video_sha256: digest,
    video_mime_type: z.enum([
      'video/mp4',
      'video/webm',
      'video/x-m4v',
      'video/quicktime',
    ]),
    video_extension: z.enum(['mp4', 'webm', 'm4v', 'mov']),
    title: z.string().min(1).max(300),
  })
  .refine((frame) => frame.end_sec >= frame.start_sec, {
    message: 'end_sec must not precede start_sec',
  })
  .refine((frame) => frame.video_sha256 === frame.source_video_sha256, {
    message: 'video asset must match the cited source video',
  })
  .refine(
    (frame) =>
      ({
        mp4: 'video/mp4',
        webm: 'video/webm',
        m4v: 'video/x-m4v',
        mov: 'video/quicktime',
      })[frame.video_extension] === frame.video_mime_type,
    { message: 'video format is inconsistent' }
  )
  .refine(
    (frame) =>
      frame.timestamp_sec >= frame.start_sec &&
      frame.timestamp_sec <= frame.end_sec,
    { message: 'timestamp_sec must lie inside the retrieved video range' }
  )

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
  ).slice(0, 20)) {
    const source = record(rawSource)
    if (!source || String(source.source_type).toLowerCase() !== 'video')
      continue
    const title = [source.title, source.display_name, source.video_name].find(
      (value) => typeof value === 'string' && value.length > 0
    )
    if (typeof title !== 'string') continue
    for (const rawChunk of (Array.isArray(source.chunks)
      ? source.chunks
      : []
    ).slice(0, 30)) {
      const chunk = record(rawChunk)
      const envelope = record(chunk?.video_frames)
      const video = record(envelope?.video)
      if (
        !chunk ||
        envelope?.version !== 1 ||
        !video ||
        video.kind !== 'video' ||
        !Array.isArray(envelope.assets)
      )
        continue
      for (const rawAsset of envelope.assets.slice(0, 10)) {
        const asset = record(rawAsset)
        if (!asset) continue
        const parsed = videoFrameSchema.safeParse({
          ...envelope,
          ...asset,
          video_sha256: video.sha256,
          video_mime_type: video.mime_type,
          video_extension: video.extension,
          title: title.slice(0, 300),
        })
        if (!parsed.success) continue
        if (found.size < 30) found.set(parsed.data.asset_id, parsed.data)
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
    if (frame && found.size < 3) found.set(frame.asset_id, frame)
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
  return parsed.success ? parsed.data : undefined
}

export function isVideoSearchTool(name: string) {
  return isDocQueryToolName(name)
}
