import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { VideoFrame } from '@/src/lib/sources/videoFrames'

const DIGEST = /^[a-f0-9]{64}$/

export function videoObjectKey(frame: VideoFrame) {
  if (!DIGEST.test(frame.video_sha256))
    throw new Error('Invalid video reference')
  return `e1/v1/videos/sha256/${frame.video_sha256.slice(0, 2)}/${frame.video_sha256.slice(2, 4)}/${frame.video_sha256}.${frame.video_extension}`
}

/** Return a short-lived direct Blob URL when production Blob storage is configured. */
export async function signedVideoPlaybackUrl(frame: VideoFrame) {
  const account = process.env.BLOB_STORAGE_ACCOUNT_NAME
  const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY
  const container = process.env.CHAT_VIDEO_BLOB_CONTAINER
  if (!account || !accessKey || !container) return undefined
  const {
    BlobSASPermissions,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
  } = await import('@azure/storage-blob')
  const credential = new StorageSharedKeyCredential(account, accessKey)
  const now = Date.now()
  const blobName = videoObjectKey(frame)
  const query = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(now - 60_000),
      expiresOn: new Date(now + 10 * 60_000),
      contentType: frame.video_mime_type,
      contentDisposition: 'inline',
    },
    credential
  ).toString()
  return `https://${account}.blob.core.windows.net/${encodeURIComponent(container)}/${blobName}?${query}`
}

/** Local fixture adapter used by the checked-in chatbot demo. */
export async function readLocalVideo(frame: VideoFrame) {
  const root = process.env.CHAT_VIDEO_FRAME_STORE_PATH
  if (!root) throw new Error('Video storage unavailable')
  const base = await realpath(root)
  const filename = await realpath(path.join(base, videoObjectKey(frame)))
  if (!filename.startsWith(base + path.sep))
    throw new Error('Invalid video path')
  const info = await stat(filename)
  return { filename, size: info.size }
}
