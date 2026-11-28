import { describe, expect, it } from 'vitest'
import {
  isChatMediaS3NotFound,
  resolveChatMediaBackend,
  resolveChatMediaS3Storage,
} from '../src/lib/server/chatMediaStorage'

const complete = {
  CHAT_MEDIA_BACKEND: 's3',
  CHAT_MEDIA_S3_ACCESS_KEY_ID: 'synthetic-access-key',
  CHAT_MEDIA_S3_SECRET_ACCESS_KEY: 'synthetic-secret-key',
  CHAT_MEDIA_S3_REGION: 'us-east-1',
  CHAT_MEDIA_S3_ENDPOINT: 'https://objects.example.test:9000',
  CHAT_MEDIA_S3_COURSE_IMAGES_BUCKET: 'synthetic-figures',
  CHAT_MEDIA_S3_VIDEO_FRAMES_BUCKET: 'synthetic-frames',
} as const

describe('S3-compatible Chat media storage', () => {
  it('requires an explicit valid backend', () => {
    expect(resolveChatMediaBackend({})).toBe('legacy')
    expect(resolveChatMediaBackend({ CHAT_MEDIA_BACKEND: 'azure-blob' })).toBe(
      'azure-blob'
    )
    expect(resolveChatMediaBackend({ CHAT_MEDIA_BACKEND: 's3' })).toBe('s3')
    expect(() =>
      resolveChatMediaBackend({ CHAT_MEDIA_BACKEND: 'automatic' })
    ).toThrow('unavailable')
  })

  it('resolves a separate bucket for each reader', () => {
    expect(resolveChatMediaS3Storage(complete, 'course-images')).toMatchObject({
      bucket: 'synthetic-figures',
      endpoint: 'https://objects.example.test:9000',
      forcePathStyle: true,
      region: 'us-east-1',
    })
    expect(resolveChatMediaS3Storage(complete, 'video-frames')).toMatchObject({
      bucket: 'synthetic-frames',
    })
  })

  it('allows plain HTTP only for loopback MinIO', () => {
    expect(
      resolveChatMediaS3Storage(
        { ...complete, CHAT_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:9000' },
        'course-images'
      )?.endpoint
    ).toBe('http://127.0.0.1:9000')
    expect(() =>
      resolveChatMediaS3Storage(
        { ...complete, CHAT_MEDIA_S3_ENDPOINT: 'http://objects.example.test' },
        'course-images'
      )
    ).toThrow('unavailable')
  })

  it.each([
    'https://user:password@objects.example.test',
    'https://objects.example.test/base',
    'https://objects.example.test?redirect=1',
    'ftp://objects.example.test',
  ])('rejects an untrusted endpoint form: %s', (endpoint) => {
    expect(() =>
      resolveChatMediaS3Storage(
        { ...complete, CHAT_MEDIA_S3_ENDPOINT: endpoint },
        'course-images'
      )
    ).toThrow('unavailable')
  })

  it.each([
    [
      'shared bucket',
      { CHAT_MEDIA_S3_VIDEO_FRAMES_BUCKET: 'synthetic-figures' },
    ],
    ['missing secret', { CHAT_MEDIA_S3_SECRET_ACCESS_KEY: '' }],
    ['missing figures bucket', { CHAT_MEDIA_S3_COURSE_IMAGES_BUCKET: '' }],
    ['invalid region', { CHAT_MEDIA_S3_REGION: 'invalid region' }],
    ['invalid path style', { CHAT_MEDIA_S3_FORCE_PATH_STYLE: 'sometimes' }],
  ])('fails closed for %s', (_, override) => {
    expect(() =>
      resolveChatMediaS3Storage({ ...complete, ...override }, 'course-images')
    ).toThrow('unavailable')
  })

  it('recognizes SDK and service missing-object responses', () => {
    expect(isChatMediaS3NotFound({ $metadata: { httpStatusCode: 404 } })).toBe(
      true
    )
    expect(isChatMediaS3NotFound({ name: 'NoSuchKey' })).toBe(true)
    expect(isChatMediaS3NotFound({ name: 'AccessDenied' })).toBe(false)
  })
})
