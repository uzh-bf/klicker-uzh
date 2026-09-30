import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import { z } from 'zod'
import type { VideoFrame } from '@/src/lib/sources/videoFrames'

const DIGEST = /^[a-f0-9]{64}$/
const MAX_MANIFEST_BYTES = 2_000_000
const MAX_FRAME_BYTES = 15_000_000
const manifestSchema = z.object({
  schema_version: z.literal('video_frame_assets.v1'),
  source_video_sha256: z.string().regex(DIGEST),
  assets: z.array(
    z.object({
      asset_id: z.string().regex(DIGEST),
      frame_sha256: z.string().regex(DIGEST),
      visual_state_id: z.string(),
      timestamp_sec: z.number(),
      width_px: z.number(),
      height_px: z.number(),
      mime_type: z.string(),
    })
  ),
})

type VideoFrameStoreEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | 'CHAT_VIDEO_FRAME_STORE_PATH'
    | 'CHAT_VIDEO_BLOB_CONTAINER'
    | 'BLOB_STORAGE_ACCOUNT_NAME'
    | 'BLOB_STORAGE_ACCESS_KEY'
  >
>

export function videoFrameStoreConfigured(
  env: VideoFrameStoreEnvironment = process.env as VideoFrameStoreEnvironment
) {
  return Boolean(
    env.CHAT_VIDEO_FRAME_STORE_PATH ||
      (env.CHAT_VIDEO_BLOB_CONTAINER &&
        env.BLOB_STORAGE_ACCOUNT_NAME &&
        env.BLOB_STORAGE_ACCESS_KEY)
  )
}

function assertInside(base: string, candidate: string) {
  if (!candidate.startsWith(base + path.sep))
    throw new Error('Invalid video frame path')
}

function objectKey(
  kind: 'manifests' | 'frames',
  hash: string,
  extension: 'json' | 'jpg'
) {
  if (!DIGEST.test(hash)) throw new Error('Invalid video frame reference')
  return `e1/v1/${kind}/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`
}

async function readLocalObject(root: string, key: string, limit: number) {
  const base = await realpath(root)
  const filename = await realpath(path.join(base, key))
  assertInside(base, filename)
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const metadata = await file.stat()
    if (!metadata.isFile() || metadata.size > limit)
      throw new Error('Video frame artifact exceeds size limit')
    return await file.readFile()
  } finally {
    await file.close()
  }
}

async function readBlobObject(key: string, limit: number) {
  const account = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY
  const container = process.env.CHAT_VIDEO_BLOB_CONTAINER
  if (!account || !accessKey || !container)
    throw new Error('Video frame storage unavailable')

  const { BlobServiceClient, StorageSharedKeyCredential } = await import(
    '@azure/storage-blob'
  )
  const credential = new StorageSharedKeyCredential(account, accessKey)
  const blob = new BlobServiceClient(
    getBlobStorageAccountUrl(account, process.env.BLOB_STORAGE_ACCOUNT_URL),
    credential
  )
    .getContainerClient(container)
    .getBlobClient(key)
  const properties = await blob.getProperties()
  if (
    properties.contentLength === undefined ||
    properties.contentLength > limit
  )
    throw new Error('Video frame artifact exceeds size limit')

  const response = await blob.download()
  if (!response.readableStreamBody)
    throw new Error('Video frame artifact download failed')
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of response.readableStreamBody) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > limit) throw new Error('Video frame artifact exceeds size limit')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, size)
}

async function readObject(
  root: string | undefined,
  kind: 'manifests' | 'frames',
  hash: string,
  extension: 'json' | 'jpg',
  limit: number,
  blobReader: (key: string, limit: number) => Promise<Buffer>
) {
  const key = objectKey(kind, hash, extension)
  const bytes = root
    ? await readLocalObject(root, key, limit)
    : await blobReader(key, limit)
  if (
    bytes.length > limit ||
    createHash('sha256').update(bytes).digest('hex') !== hash
  )
    throw new Error('Video frame artifact integrity failed')
  return bytes
}

/** Read one manifest-bound frame from a content-addressed Blob projection. */
export async function readVideoFrame(
  frame: VideoFrame,
  root = process.env.CHAT_VIDEO_FRAME_STORE_PATH,
  blobReader = readBlobObject
): Promise<Buffer> {
  const manifest = manifestSchema.parse(
    JSON.parse(
      (
        await readObject(
          root,
          'manifests',
          frame.manifest_sha256,
          'json',
          MAX_MANIFEST_BYTES,
          blobReader
        )
      ).toString()
    )
  )
  if (
    manifest.schema_version !== 'video_frame_assets.v1' ||
    manifest.source_video_sha256 !== frame.source_video_sha256
  )
    throw new Error('Video frame manifest mismatch')
  if (
    !manifest.assets.some(
      (asset) =>
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

  const bytes = await readObject(
    root,
    'frames',
    frame.frame_sha256,
    'jpg',
    MAX_FRAME_BYTES,
    blobReader
  )
  if (!bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    throw new Error('Invalid JPEG')
  return bytes
}
