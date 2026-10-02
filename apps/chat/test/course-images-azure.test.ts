import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readCourseImage } from '../src/lib/server/courseImageStore'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

const root = path.resolve('scripts/fixtures/course-images')
const fixture = JSON.parse(
  await readFile(path.join(root, 'query-result.json'), 'utf8')
)
const original = courseImageCandidates(fixture)[0]!
const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex')
const objectPath = (kind: string, hash: string, extension: string) =>
  `e4/v3/${kind}/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`
const limits = {
  manifests: 2_000_000,
  payloads: 10_000_000,
  images: 10_000_000,
}
type Kind = keyof typeof limits

// Keep the real Azure SDK in the loop. The local HTTP fixture implements its
// HEAD/range-GET contract, including Azure's shorter response past end-of-blob.
describe('Azure course image storage through the real SDK', () => {
  let server: Server
  let blobs: Map<string, Buffer>
  let requests: {
    method: string
    key: string
    range?: string
    ifMatch?: string
  }[]
  let changed: boolean
  let missingEtag: boolean

  beforeEach(async () => {
    blobs = new Map()
    requests = []
    changed = false
    missingEtag = false
    server = createServer((req, res) => {
      const key = decodeURIComponent(
        new URL(req.url!, 'http://localhost').pathname
      ).replace('/synthetic/course-images/', '')
      const range = req.headers['x-ms-range'] ?? req.headers.range
      requests.push({
        method: req.method!,
        key,
        range: typeof range === 'string' ? range : undefined,
        ifMatch: req.headers['if-match'],
      })
      const bytes = blobs.get(key)
      if (!bytes) {
        res.writeHead(404).end()
        return
      }
      if (req.method === 'GET' && changed && req.headers['if-match']) {
        res.writeHead(412, { 'x-ms-error-code': 'ConditionNotMet' }).end()
        return
      }
      if (!missingEtag) res.setHeader('ETag', '"synthetic-v1"')
      res.setHeader('Last-Modified', new Date(0).toUTCString())
      res.setHeader('x-ms-blob-type', 'BlockBlob')
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Length': bytes.length }).end()
        return
      }
      const match =
        typeof range === 'string' ? /^bytes=(\d+)-(\d*)$/.exec(range) : null
      const start = match ? Number(match[1]) : 0
      const end = Math.min(
        match?.[2] ? Number(match[2]) : bytes.length - 1,
        bytes.length - 1
      )
      const body = bytes.subarray(start, end + 1)
      if (match)
        res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`)
      res
        .writeHead(match ? 206 : 200, { 'Content-Length': body.length })
        .end(body)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing test server address')
    vi.stubEnv('CHAT_COURSE_IMAGE_STORE_PATH', '')
    vi.stubEnv('COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER', 'course-images')
    vi.stubEnv(
      'COURSE_IMAGE_PROJECTION_STORAGE_CONNECTION_STRING',
      `DefaultEndpointsProtocol=http;AccountName=synthetic;AccountKey=${Buffer.from('synthetic-test-only').toString('base64')};BlobEndpoint=http://127.0.0.1:${address.port}/synthetic;`
    )
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  })

  async function seed(kind?: Kind, size?: number) {
    const resize = (bytes: Buffer, current: Kind) =>
      kind === current && size !== undefined
        ? Buffer.concat([
            bytes,
            Buffer.alloc(size - bytes.length, current === 'images' ? 0 : 32),
          ])
        : bytes
    const png = resize(
      await readFile(
        path.join(root, objectPath('images', original.image_sha256, 'png'))
      ),
      'images'
    )
    const imageHash = digest(png)
    const manifest = JSON.parse(
      await readFile(
        path.join(
          root,
          objectPath('manifests', original.manifest_sha256, 'json')
        ),
        'utf8'
      )
    )
    const payload = JSON.parse(
      await readFile(
        path.join(
          root,
          objectPath('payloads', manifest.payload_sha256, 'json')
        ),
        'utf8'
      )
    )
    for (const asset of payload.visual_assets.assets)
      asset.image_sha256 = imageHash
    const payloadBytes = resize(
      Buffer.from(JSON.stringify(payload)),
      'payloads'
    )
    manifest.payload_sha256 = digest(payloadBytes)
    for (const key of Object.keys(manifest.images))
      manifest.images[key] = imageHash
    const manifestBytes = resize(
      Buffer.from(JSON.stringify(manifest)),
      'manifests'
    )
    const candidate = {
      ...original,
      image_sha256: imageHash,
      manifest_sha256: digest(manifestBytes),
    }
    blobs.set(objectPath('images', imageHash, 'png'), png)
    blobs.set(
      objectPath('payloads', manifest.payload_sha256, 'json'),
      payloadBytes
    )
    blobs.set(
      objectPath('manifests', candidate.manifest_sha256, 'json'),
      manifestBytes
    )
    return { candidate, png }
  }

  it('loads a small manifest, payload and PNG with exact conditional downloads', async () => {
    const { candidate, png } = await seed()
    expect((await readCourseImage(candidate)).equals(png)).toBe(true)
    for (const request of requests.filter((entry) => entry.method === 'GET')) {
      expect(request.ifMatch).toBe('"synthetic-v1"')
      expect(request.range).toBe(
        `bytes=0-${blobs.get(request.key)!.length - 1}`
      )
    }
  })

  for (const kind of Object.keys(limits) as Kind[]) {
    it.each([
      -1, 0, 1,
    ])(`${kind} enforces its byte limit (offset %i)`, async (offset) => {
      const { candidate, png } = await seed(kind, limits[kind] + offset)
      if (offset <= 0)
        expect((await readCourseImage(candidate)).equals(png)).toBe(true)
      else {
        await expect(readCourseImage(candidate)).rejects.toThrow('size limit')
        expect(
          requests.filter(
            (entry) => entry.method === 'GET' && entry.key.includes(`/${kind}/`)
          )
        ).toHaveLength(0)
      }
    })
  }

  it('rejects a blob changed between metadata and download', async () => {
    const { candidate } = await seed()
    changed = true
    await expect(readCourseImage(candidate)).rejects.toThrow()
    expect(requests.find((entry) => entry.method === 'GET')?.ifMatch).toBe(
      '"synthetic-v1"'
    )
  })

  it('fails closed without an ETag', async () => {
    const { candidate } = await seed()
    missingEtag = true
    await expect(readCourseImage(candidate)).rejects.toThrow()
    expect(requests.some((entry) => entry.method === 'GET')).toBe(false)
  })

  it('still rejects corrupt bytes with a mismatched digest', async () => {
    const { candidate } = await seed()
    blobs.get(objectPath('images', candidate.image_sha256, 'png'))![8] ^= 1
    await expect(readCourseImage(candidate)).rejects.toThrow('integrity')
  })
})
