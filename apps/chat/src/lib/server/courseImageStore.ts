import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { BlobServiceClient } from '@azure/storage-blob'
import type { CourseImage } from '@/src/lib/sources/courseImages'

const DIGEST = /^[a-f0-9]{64}$/
const PROJECTION_GENERATIONS = ['e6/v3', 'e5/v3', 'e4/v3'] as const
const DEFAULT_PROJECTION_CONTAINER = 'doc-processing'
const MANIFEST_SIZE_LIMIT = 2_000_000
const PAYLOAD_SIZE_LIMIT = 10_000_000
const IMAGE_SIZE_LIMIT = 10_000_000

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function courseImageStoreConfigured() {
  return Boolean(
    process.env.CHAT_COURSE_IMAGE_STORE_PATH ||
      (projectionConnectionString() && projectionContainer())
  )
}

function projectionConnectionString() {
  return (
    process.env.COURSE_IMAGE_PROJECTION_STORAGE_CONNECTION_STRING ??
    process.env.DOC_PROCESSING_AZURE_STORAGE_CONNECTION_STRING
  )
}

function projectionContainer() {
  return (
    process.env.COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER ??
    process.env.DOC_PROCESSING_AZURE_STORAGE_CONTAINER ??
    DEFAULT_PROJECTION_CONTAINER
  )
}

function projectionObjectPath(
  kind: string,
  hash: string,
  extension: string,
  generation: string
) {
  return `${generation}/${kind}/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`
}

/** Read only verified processor projections from a server-configured mounted store. */
export async function readCourseImage(
  image: CourseImage,
  root = process.env.CHAT_COURSE_IMAGE_STORE_PATH
): Promise<Buffer> {
  let generation: (typeof PROJECTION_GENERATIONS)[number] =
    PROJECTION_GENERATIONS[0]
  async function object(
    kind: string,
    hash: string,
    extension: string,
    limit: number
  ) {
    if (!DIGEST.test(hash)) throw new Error('Invalid image reference')
    let bytes: Buffer
    if (root) {
      const base = await realpath(root)
      const filename = await realpath(
        path.join(base, projectionObjectPath(kind, hash, extension, generation))
      )
      if (!filename.startsWith(base + path.sep))
        throw new Error('Invalid image path')
      if ((await stat(filename)).size > limit)
        throw new Error('Image artifact exceeds size limit')
      bytes = await readFile(filename)
    } else {
      const connectionString = projectionConnectionString()
      const container = projectionContainer()
      if (!connectionString || !container)
        throw new Error('Course image storage unavailable')
      const client = BlobServiceClient.fromConnectionString(connectionString)
        .getContainerClient(container)
        .getBlobClient(projectionObjectPath(kind, hash, extension, generation))
      bytes = Buffer.from(await client.downloadToBuffer(0, limit + 1))
    }
    if (
      bytes.length > limit ||
      createHash('sha256').update(bytes).digest('hex') !== hash
    )
      throw new Error('Image artifact integrity failed')
    return bytes
  }
  let manifestBytes: Buffer | undefined
  for (const candidate of PROJECTION_GENERATIONS) {
    generation = candidate
    try {
      manifestBytes = await object(
        'manifests',
        image.manifest_sha256,
        'json',
        MANIFEST_SIZE_LIMIT
      )
      break
    } catch (error) {
      const missing =
        error instanceof Error &&
        (('code' in error && error.code === 'ENOENT') ||
          ('statusCode' in error && error.statusCode === 404))
      if (!missing) throw error
    }
  }
  if (!manifestBytes) throw new Error('Image manifest unavailable')
  const manifest = record(JSON.parse(manifestBytes.toString()))
  const manifestImages = record(manifest?.images)
  if (
    !manifest ||
    !manifestImages ||
    typeof manifest.payload_sha256 !== 'string' ||
    manifest.source_sha256 !== image.source_content_hash ||
    manifest.extraction_options_hash !== image.extraction_options_hash ||
    !Object.values(manifestImages).includes(image.image_sha256)
  )
    throw new Error('Image manifest mismatch')
  const payload = record(
    JSON.parse(
      (
        await object(
          'payloads',
          manifest.payload_sha256,
          'json',
          PAYLOAD_SIZE_LIMIT
        )
      ).toString()
    )
  )
  if (!payload) throw new Error('Image payload mismatch')
  const assets = record(payload.visual_assets)?.assets
  if (
    !Array.isArray(assets) ||
    !assets.some((value) => {
      const asset = record(value)
      return (
        asset?.asset_id === image.asset_id &&
        asset.image_sha256 === image.image_sha256 &&
        asset.physical_page_number === image.physical_page_number &&
        (asset.logical_page_number ?? undefined) ===
          image.logical_page_number &&
        asset.width_px === image.width_px &&
        asset.height_px === image.height_px
      )
    })
  )
    throw new Error('Image occurrence mismatch')
  const bytes = await object(
    'images',
    image.image_sha256,
    'png',
    IMAGE_SIZE_LIMIT
  )
  if (
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Invalid PNG')
  return bytes
}
