import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { VideoFrame } from '@/src/lib/sources/videoFrames'

const DIGEST = /^[a-f0-9]{64}$/
const MAX_MANIFEST_BYTES = 2_000_000
const MAX_FRAME_BYTES = 15_000_000

export function videoFrameStoreConfigured() {
  return Boolean(process.env.CHAT_VIDEO_FRAME_STORE_PATH)
}

function assertInside(base: string, candidate: string) {
  if (!candidate.startsWith(base + path.sep))
    throw new Error('Invalid video frame path')
}

/** Read one manifest-bound frame from a content-addressed Blob projection. */
export async function readVideoFrame(
  frame: VideoFrame,
  root = process.env.CHAT_VIDEO_FRAME_STORE_PATH
): Promise<Buffer> {
  if (!root) throw new Error('Video frame storage unavailable')
  const base = await realpath(root)
  async function object(
    kind: 'manifests' | 'frames',
    hash: string,
    extension: 'json' | 'jpg',
    limit: number
  ) {
    if (!DIGEST.test(hash)) throw new Error('Invalid video frame reference')
    const filename = await realpath(
      path.join(
        base,
        'e1/v1',
        kind,
        'sha256',
        hash.slice(0, 2),
        hash.slice(2, 4),
        `${hash}.${extension}`
      )
    )
    assertInside(base, filename)
    if ((await stat(filename)).size > limit)
      throw new Error('Video frame artifact exceeds size limit')
    const bytes = await readFile(filename)
    if (
      bytes.length > limit ||
      createHash('sha256').update(bytes).digest('hex') !== hash
    )
      throw new Error('Video frame artifact integrity failed')
    return bytes
  }

  const manifest = JSON.parse(
    (
      await object(
        'manifests',
        frame.manifest_sha256,
        'json',
        MAX_MANIFEST_BYTES
      )
    ).toString()
  )
  if (
    manifest.schema_version !== 'video_frame_assets.v1' ||
    manifest.source_video_sha256 !== frame.source_video_sha256
  )
    throw new Error('Video frame manifest mismatch')
  if (
    !Array.isArray(manifest.assets) ||
    !manifest.assets.some(
      (asset: Record<string, unknown>) =>
        asset.asset_id === frame.asset_id &&
        asset.frame_sha256 === frame.frame_sha256 &&
        asset.visual_state_id === frame.visual_state_id &&
        asset.timestamp_sec === frame.timestamp_sec &&
        asset.width_px === frame.width_px &&
        asset.height_px === frame.height_px &&
        asset.mime_type === frame.mime_type
    )
  )
    throw new Error('Video frame occurrence mismatch')

  const bytes = await object(
    'frames',
    frame.frame_sha256,
    'jpg',
    MAX_FRAME_BYTES
  )
  if (!bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    throw new Error('Invalid JPEG')
  return bytes
}
