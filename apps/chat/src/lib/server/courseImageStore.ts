import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CourseImage } from '@/src/lib/sources/courseImages'

const DIGEST = /^[a-f0-9]{64}$/
export function courseImageStoreConfigured() {
  return Boolean(process.env.CHAT_COURSE_IMAGE_STORE_PATH)
}

/** Read only verified processor projections from a server-configured mounted store. */
export async function readCourseImage(
  image: CourseImage,
  root = process.env.CHAT_COURSE_IMAGE_STORE_PATH
): Promise<Buffer> {
  if (!root) throw new Error('Course image storage unavailable')
  const base = await realpath(root)
  // Resolve the manifest's cache generation once; never mix generations.
  if (!DIGEST.test(image.manifest_sha256))
    throw new Error('Invalid image reference')
  let generation: string | undefined
  for (const candidate of ['e6/v3', 'e5/v3', 'e4/v3']) {
    try {
      await stat(
        path.join(
          base,
          candidate,
          'manifests',
          'sha256',
          image.manifest_sha256.slice(0, 2),
          image.manifest_sha256.slice(2, 4),
          `${image.manifest_sha256}.json`
        )
      )
      generation = candidate
      break
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error
    }
  }
  if (!generation) throw new Error('Image manifest unavailable')
  const storeGeneration = generation
  async function object(
    kind: string,
    hash: string,
    extension: string,
    limit: number
  ) {
    if (!DIGEST.test(hash)) throw new Error('Invalid image reference')
    const filename = await realpath(
      path.join(
        base,
        storeGeneration,
        kind,
        'sha256',
        hash.slice(0, 2),
        hash.slice(2, 4),
        `${hash}.${extension}`
      )
    )
    if (!filename.startsWith(base + path.sep))
      throw new Error('Invalid image path')
    if ((await stat(filename)).size > limit)
      throw new Error('Image artifact exceeds size limit')
    const bytes = await readFile(filename)
    if (
      bytes.length > limit ||
      createHash('sha256').update(bytes).digest('hex') !== hash
    )
      throw new Error('Image artifact integrity failed')
    return bytes
  }
  const manifest = JSON.parse(
    (
      await object('manifests', image.manifest_sha256, 'json', 2_000_000)
    ).toString()
  )
  if (
    manifest.source_sha256 !== image.source_content_hash ||
    manifest.extraction_options_hash !== image.extraction_options_hash ||
    !Object.values(manifest.images ?? {}).includes(image.image_sha256)
  )
    throw new Error('Image manifest mismatch')
  const payload = JSON.parse(
    (
      await object('payloads', manifest.payload_sha256, 'json', 10_000_000)
    ).toString()
  )
  const assets = payload.visual_assets?.assets
  if (
    !Array.isArray(assets) ||
    !assets.some(
      (asset) =>
        asset.asset_id === image.asset_id &&
        asset.image_sha256 === image.image_sha256 &&
        asset.physical_page_number === image.physical_page_number &&
        asset.width_px === image.width_px &&
        asset.height_px === image.height_px
    )
  )
    throw new Error('Image occurrence mismatch')
  const bytes = await object('images', image.image_sha256, 'png', 10_000_000)
  if (
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Invalid PNG')
  return bytes
}
