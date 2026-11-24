import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { readVideoFrame } from '../src/lib/server/videoFrameStore'
import type { VideoFrame } from '../src/lib/sources/videoFrames'

const hash = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex')
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
function artifact(id: string, padding = 0) {
  const frame = {
    asset_id: hash(id),
    frame_sha256: hash(jpeg),
    manifest_sha256: '',
    visual_state_id: id,
    timestamp_sec: 5,
    start_sec: 0,
    end_sec: 10,
    width_px: 100,
    height_px: 100,
    mime_type: 'image/jpeg',
    kind: 'video_frame',
    source_video_sha256: hash('synthetic-video'),
    kb_id: '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f',
    external_resource_id: 'synthetic-resource',
    resource_version: 1,
    title: 'Synthetic recording',
  } satisfies VideoFrame
  const manifest = Buffer.from(
    JSON.stringify({
      schema_version: 'video_frame_assets.v1',
      source_video_sha256: frame.source_video_sha256,
      assets: [frame],
      padding: 'x'.repeat(padding),
    })
  )
  frame.manifest_sha256 = hash(manifest)
  return { frame, manifest }
}
function storage(artifacts: ReturnType<typeof artifact>[]) {
  const manifests = new Map(
    artifacts.map(({ frame, manifest }) => [frame.manifest_sha256, manifest])
  )
  const read = vi.fn(async (key: string) => {
    if (key.endsWith('.jpg')) return jpeg
    const digest = key.split('/').at(-1)!.replace('.json', '')
    const bytes = manifests.get(digest)
    if (!bytes) throw new Error('Missing synthetic manifest')
    return bytes
  })
  const manifestReads = () =>
    read.mock.calls.filter(([key]) => key.endsWith('.json')).length
  return { read, manifests, manifestReads }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

it('reuses verified metadata while reading and checking the frame on every request', async () => {
  const item = artifact('repeat')
  const { read, manifestReads } = storage([item])
  await readVideoFrame(item.frame, undefined, read)
  await readVideoFrame(item.frame, undefined, read)
  expect(manifestReads()).toBe(1)
  expect(read.mock.calls.filter(([key]) => key.endsWith('.jpg'))).toHaveLength(
    2
  )

  read.mockImplementationOnce(async () => Buffer.from('corrupt JPEG'))
  await expect(readVideoFrame(item.frame, undefined, read)).rejects.toThrow(
    'integrity'
  )
})

it('revalidates source and occurrence bindings even when metadata is cached', async () => {
  const item = artifact('bindings')
  const { read, manifestReads } = storage([item])
  await readVideoFrame(item.frame, undefined, read)
  await expect(
    readVideoFrame(
      { ...item.frame, source_video_sha256: hash('different-video') },
      undefined,
      read
    )
  ).rejects.toThrow('manifest mismatch')
  await expect(
    readVideoFrame({ ...item.frame, visual_state_id: 'other' }, undefined, read)
  ).rejects.toThrow('occurrence mismatch')
  expect(manifestReads()).toBe(1)
  expect(read).toHaveBeenCalledTimes(2)
})

it.each([
  'download',
  'integrity',
  'schema',
])('does not cache %s failures', async (failure) => {
  const item = artifact('retry')
  if (failure === 'schema') {
    item.manifest = Buffer.from('null')
    item.frame.manifest_sha256 = hash(item.manifest)
  }
  const { read, manifestReads } = storage([item])
  if (failure === 'download') read.mockRejectedValueOnce(new Error('offline'))
  if (failure === 'integrity')
    read.mockResolvedValueOnce(Buffer.from('corrupt'))
  await expect(readVideoFrame(item.frame, undefined, read)).rejects.toThrow()
  const retry = readVideoFrame(item.frame, undefined, read)
  if (failure === 'schema') await expect(retry).rejects.toThrow()
  else await expect(retry).resolves.toEqual(jpeg)
  expect(manifestReads()).toBe(2)
})

it('expires metadata after five minutes', async () => {
  vi.useFakeTimers()
  const item = artifact('expiry')
  const { read, manifestReads } = storage([item])
  await readVideoFrame(item.frame, undefined, read)
  vi.advanceTimersByTime(5 * 60_000)
  await readVideoFrame(item.frame, undefined, read)
  expect(manifestReads()).toBe(2)
})

it('evicts the least recently used metadata after 32 entries', async () => {
  const items = Array.from({ length: 33 }, (_, i) => artifact(`entry-${i}`))
  const { read, manifestReads } = storage(items)
  for (const item of items.slice(0, 32)) {
    await readVideoFrame(item.frame, undefined, read)
  }
  await readVideoFrame(items[0]!.frame, undefined, read)
  await readVideoFrame(items[32]!.frame, undefined, read)
  await readVideoFrame(items[0]!.frame, undefined, read)
  expect(manifestReads()).toBe(33)
  await readVideoFrame(items[1]!.frame, undefined, read)
  expect(manifestReads()).toBe(34)
})

it('evicts metadata before its serialized size exceeds eight megabytes', async () => {
  const items = Array.from({ length: 5 }, (_, i) =>
    artifact(`large-${i}`, 1_700_000)
  )
  const { read, manifestReads } = storage(items)
  for (const item of items) await readVideoFrame(item.frame, undefined, read)
  await readVideoFrame(items[4]!.frame, undefined, read)
  expect(manifestReads()).toBe(5)
  await readVideoFrame(items[0]!.frame, undefined, read)
  expect(manifestReads()).toBe(6)
})

it('isolates metadata by reader and storage namespace', async () => {
  const item = artifact('isolation')
  const first = storage([item])
  const second = storage([item])
  await readVideoFrame(item.frame, undefined, first.read)
  await readVideoFrame(item.frame, undefined, second.read)
  expect(second.manifestReads()).toBe(1)
  vi.stubEnv('CHAT_VIDEO_BLOB_CONTAINER', 'another-synthetic-container')
  await readVideoFrame(item.frame, undefined, first.read)
  expect(first.manifestReads()).toBe(2)
})

it('does not fall back to a local root or shared key in workload identity mode', async () => {
  const item = artifact('workload-identity-fallback')
  vi.stubEnv('CHAT_MEDIA_WORKLOAD_IDENTITY_ENABLED', 'true')
  vi.stubEnv('CHAT_VIDEO_BLOB_CONTAINER', 'course-media')
  vi.stubEnv('BLOB_STORAGE_ACCOUNT_NAME', undefined)
  vi.stubEnv('BLOB_STORAGE_ACCESS_KEY', 'synthetic-key')

  await expect(
    readVideoFrame(item.frame, '/synthetic/local-root')
  ).rejects.toThrow('workload identity storage unavailable')
})
