import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  courseImageStoreConfigured,
  readCourseImage,
} from '../src/lib/server/courseImageStore'
import {
  readVideoFrame,
  videoFrameStoreConfigured,
} from '../src/lib/server/videoFrameStore'
import { courseImageCandidates } from '../src/lib/sources/courseImages'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'

const enabled = process.env.CHAT_MEDIA_S3_INTEGRATION === '1'
const endpoint = process.env.CHAT_MEDIA_S3_INTEGRATION_ENDPOINT
const accessKeyId = process.env.CHAT_MEDIA_S3_INTEGRATION_ACCESS_KEY_ID
const secretAccessKey = process.env.CHAT_MEDIA_S3_INTEGRATION_SECRET_ACCESS_KEY
const configured = enabled && endpoint && accessKeyId && secretAccessKey

const courseImageRoot = path.resolve('scripts/fixtures/course-images')
const videoFrameRoot = path.resolve('scripts/fixtures/video-frames')
const courseImageFixture = JSON.parse(
  await readFile(path.join(courseImageRoot, 'query-result.json'), 'utf8')
)
const videoFrameFixture = JSON.parse(
  await readFile(path.join(videoFrameRoot, 'query-result.json'), 'utf8')
)
const courseImage = courseImageCandidates(courseImageFixture)[0]!
const videoFrame = videoFrameCandidates(videoFrameFixture)[0]!
const figuresBucket = `chat-figures-${randomUUID().replaceAll('-', '').slice(0, 20)}`
const framesBucket = `chat-frames-${randomUUID().replaceAll('-', '').slice(0, 20)}`
const uploaded: { bucket: string; key: string }[] = []
let client: S3Client
let figureKey: string
let frameKey: string

function objectPath(
  generation: string,
  kind: string,
  hash: string,
  extension: string
) {
  return `${generation}/${kind}/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`
}

async function upload(
  bucket: string,
  key: string,
  filename: string,
  contentType: string
) {
  const body = await readFile(filename)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  uploaded.push({ bucket, key })
}

describe.skipIf(!configured)(
  'S3-compatible Chat media readers with MinIO',
  () => {
    beforeAll(async () => {
      client = new S3Client({
        endpoint,
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      })
      await client.send(new CreateBucketCommand({ Bucket: figuresBucket }))
      await client.send(new CreateBucketCommand({ Bucket: framesBucket }))

      const manifestKey = objectPath(
        'e4/v3',
        'manifests',
        courseImage.manifest_sha256,
        'json'
      )
      const manifest = JSON.parse(
        await readFile(path.join(courseImageRoot, manifestKey), 'utf8')
      )
      const figureObjects = [
        [manifestKey, 'application/json'],
        [
          objectPath('e4/v3', 'payloads', manifest.payload_sha256, 'json'),
          'application/json',
        ],
        [
          objectPath('e4/v3', 'images', courseImage.image_sha256, 'png'),
          'image/png',
        ],
      ] as const
      figureKey = figureObjects[2][0]
      for (const [relative, contentType] of figureObjects) {
        await upload(
          figuresBucket,
          `projection/${relative}`,
          path.join(courseImageRoot, relative),
          contentType
        )
      }

      const frameManifest = objectPath(
        'e1/v1',
        'manifests',
        videoFrame.manifest_sha256,
        'json'
      )
      frameKey = objectPath('e1/v1', 'frames', videoFrame.frame_sha256, 'jpg')
      await upload(
        framesBucket,
        frameManifest,
        path.join(videoFrameRoot, frameManifest),
        'application/json'
      )
      await upload(
        framesBucket,
        frameKey,
        path.join(videoFrameRoot, frameKey),
        'image/jpeg'
      )

      vi.stubEnv('CHAT_MEDIA_BACKEND', 's3')
      vi.stubEnv('CHAT_MEDIA_S3_ENDPOINT', endpoint!)
      vi.stubEnv('CHAT_MEDIA_S3_REGION', 'us-east-1')
      vi.stubEnv('CHAT_MEDIA_S3_FORCE_PATH_STYLE', 'true')
      vi.stubEnv('CHAT_MEDIA_S3_ACCESS_KEY_ID', accessKeyId!)
      vi.stubEnv('CHAT_MEDIA_S3_SECRET_ACCESS_KEY', secretAccessKey!)
      vi.stubEnv('CHAT_MEDIA_S3_COURSE_IMAGES_BUCKET', figuresBucket)
      vi.stubEnv('CHAT_MEDIA_S3_VIDEO_FRAMES_BUCKET', framesBucket)
      vi.stubEnv('COURSE_IMAGE_PROJECTION_STORAGE_PREFIX', 'projection')
    })

    afterEach(() => {
      vi.stubEnv('CHAT_MEDIA_S3_ACCESS_KEY_ID', accessKeyId!)
      vi.stubEnv('CHAT_MEDIA_S3_SECRET_ACCESS_KEY', secretAccessKey!)
    })

    afterAll(async () => {
      vi.unstubAllEnvs()
      if (!client) return
      for (const { bucket, key } of uploaded) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      }
      for (const bucket of [figuresBucket, framesBucket]) {
        await client
          .send(new DeleteBucketCommand({ Bucket: bucket }))
          .catch(() => undefined)
      }
    })

    it('reads both real manifest-bound readers from separate MinIO buckets', async () => {
      expect(courseImageStoreConfigured()).toBe(true)
      expect(videoFrameStoreConfigured()).toBe(true)

      const figureBytes = await readFile(
        path.join(
          courseImageRoot,
          objectPath('e4/v3', 'images', courseImage.image_sha256, 'png')
        )
      )
      const frameBytes = await readFile(path.join(videoFrameRoot, frameKey))
      await expect(readCourseImage(courseImage)).resolves.toEqual(figureBytes)
      await expect(readVideoFrame(videoFrame)).resolves.toEqual(frameBytes)

      await expect(
        client.send(
          new HeadObjectCommand({ Bucket: figuresBucket, Key: frameKey })
        )
      ).rejects.toThrow()
      await expect(
        client.send(
          new HeadObjectCommand({ Bucket: framesBucket, Key: figureKey })
        )
      ).rejects.toThrow()
    })

    it('rejects invalid MinIO credentials', async () => {
      vi.stubEnv('CHAT_MEDIA_S3_ACCESS_KEY_ID', 'synthetic-denied-access')
      vi.stubEnv('CHAT_MEDIA_S3_SECRET_ACCESS_KEY', 'synthetic-denied-secret')
      await expect(readCourseImage(courseImage)).rejects.toThrow()
      await expect(readVideoFrame(videoFrame)).rejects.toThrow()
    })
  }
)
