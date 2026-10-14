import { BlobServiceClient } from '@azure/storage-blob'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AzureMediaStorage } from '../src/services/mediaStorage/azure.js'
import { createMediaStorage } from '../src/services/mediaStorage/index.js'
import { S3MediaStorage } from '../src/services/mediaStorage/s3.js'
import {
  appendObjectPath,
  storageUrl,
  validateMediaObject,
} from '../src/services/mediaStorage/types.js'

const ownerId = '11111111-1111-4111-8111-111111111111'
const fileName = '22222222-2222-4222-8222-222222222222.png'
const request = { ownerId, fileName, contentType: 'image/png' }
const azureEnv = {
  BLOB_STORAGE_ACCOUNT_NAME: 'syntheticaccount',
  BLOB_STORAGE_ACCESS_KEY: Buffer.from(
    'synthetic-media-storage-test-key'
  ).toString('base64'),
}
const s3Env = {
  MEDIA_STORAGE_PROVIDER: 's3',
  MEDIA_STORAGE_PUBLIC_URL: 'https://media.example.test/assets/',
  MEDIA_S3_BUCKET: 'synthetic-media',
  MEDIA_S3_REGION: 'us-east-1',
}

beforeEach(() => {
  // Never consult a developer/CI profile or metadata service during signing.
  for (const name of [
    'AWS_PROFILE',
    'AWS_DEFAULT_PROFILE',
    'AWS_ENDPOINT_URL',
    'AWS_ENDPOINT_URL_S3',
  ]) {
    vi.stubEnv(name, undefined)
  }
  vi.stubEnv('AWS_CONFIG_FILE', '/__klicker_synthetic_config_not_present')
  vi.stubEnv(
    'AWS_SHARED_CREDENTIALS_FILE',
    '/__klicker_synthetic_credentials_not_present'
  )
  vi.stubEnv('AWS_EC2_METADATA_DISABLED', 'true')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('Azure media compatibility', () => {
  it('defaults to Azure and preserves permanent href and legacy account SAS', async () => {
    let ready = false
    const createIfNotExists = vi.fn(async () => {
      await Promise.resolve()
      ready = true
    })
    const getContainer = vi
      .spyOn(BlobServiceClient.prototype, 'getContainerClient')
      .mockReturnValue({ createIfNotExists } as never)
    const storage = createMediaStorage(azureEnv)
    expect(storage).toBeInstanceOf(AzureMediaStorage)
    const upload = await (storage as AzureMediaStorage).createUpload(request)
    expect(ready).toBe(true)
    expect(getContainer).toHaveBeenCalledWith(ownerId)
    expect(createIfNotExists).toHaveBeenCalledWith({ access: 'blob' })
    expect(upload.uploadHref).toBe(
      `https://syntheticaccount.blob.core.windows.net/${ownerId}/${fileName}`
    )
    expect(upload.containerName).toBe(ownerId)
    expect(upload.fileName).toBe(fileName)
    const legacy = new URL(upload.uploadSasURL)
    const direct = new URL(upload.uploadUrl)
    expect(legacy.pathname).toBe('/')
    expect(direct.pathname).toBe(`/${ownerId}/${fileName}`)
    expect(direct.search).toBe(legacy.search)
    expect(direct.searchParams.get('sp')).toBe('w')
    expect(direct.searchParams.get('sr')).toBe('b')
    expect(new Date(direct.searchParams.get('se')!).getTime()).toBeGreaterThan(
      Date.now() + 14 * 60 * 1000
    )
    expect(upload.uploadHeaders).toEqual([
      { name: 'Content-Type', value: 'image/png' },
      { name: 'x-ms-blob-type', value: 'BlockBlob' },
    ])
  })

  it('keeps external Azurite URLs and propagates container creation errors', async () => {
    const createIfNotExists = vi
      .fn()
      .mockRejectedValue(new Error('container failure'))
    vi.spyOn(BlobServiceClient.prototype, 'getContainerClient').mockReturnValue(
      { createIfNotExists } as never
    )
    const storage = new AzureMediaStorage({
      ...azureEnv,
      BLOB_STORAGE_ACCOUNT_URL: 'http://127.0.0.1:10000/syntheticaccount/',
      BLOB_STORAGE_INTERNAL_ACCOUNT_URL:
        'http://127.0.0.1:10001/syntheticaccount',
    })
    await expect(storage.createUpload(request)).rejects.toThrow(
      'container failure'
    )
    createIfNotExists.mockResolvedValue(undefined)
    const upload = await storage.createUpload(request)
    expect(upload.uploadHref).toBe(
      `http://127.0.0.1:10000/syntheticaccount/${ownerId}/${fileName}`
    )
  })
})

describe('S3 media signing', () => {
  function credentials() {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'synthetic-access-id')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'synthetic-secret-key')
    vi.stubEnv('AWS_SESSION_TOKEN', 'synthetic-session-token')
  }

  it('signs a single PUT with content type and uses a separate durable CDN URL', async () => {
    credentials()
    const upload = await createMediaStorage(s3Env).createUpload(request)
    const url = new URL(upload.uploadUrl)
    expect(url.hostname).toBe('synthetic-media.s3.us-east-1.amazonaws.com')
    expect(url.pathname).toBe(`/${ownerId}/${fileName}`)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-type'
    )
    expect(url.searchParams.get('X-Amz-Security-Token')).toBe(
      'synthetic-session-token'
    )
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false)
    expect(upload.uploadHref).toBe(
      `https://media.example.test/assets/${ownerId}/${fileName}`
    )
    expect(upload.uploadHeaders).toEqual([
      { name: 'Content-Type', value: 'image/png' },
    ])
    expect(JSON.stringify(upload)).not.toContain('synthetic-secret-key')
  })

  it('supports a browser-reachable custom endpoint with explicit path-style addressing', async () => {
    credentials()
    const upload = await new S3MediaStorage({
      ...s3Env,
      MEDIA_S3_ENDPOINT: 'http://127.0.0.1:9000',
      MEDIA_S3_FORCE_PATH_STYLE: 'true',
      MEDIA_STORAGE_PUBLIC_URL: 'http://127.0.0.1:9000/synthetic-media',
    }).createUpload(request)
    const url = new URL(upload.uploadUrl)
    expect(url.origin).toBe('http://127.0.0.1:9000')
    expect(url.pathname).toBe(`/synthetic-media/${ownerId}/${fileName}`)
    expect(upload.uploadHref).toBe(
      `http://127.0.0.1:9000/synthetic-media/${ownerId}/${fileName}`
    )
  })
})

describe('configuration and key validation', () => {
  it('rejects unknown providers and incomplete or invalid configuration', () => {
    expect(() =>
      createMediaStorage({ MEDIA_STORAGE_PROVIDER: 'typo' })
    ).toThrow(/PROVIDER/)
    expect(() => createMediaStorage({})).toThrow(/ACCOUNT_NAME/)
    for (const name of [
      'MEDIA_STORAGE_PUBLIC_URL',
      'MEDIA_S3_BUCKET',
      'MEDIA_S3_REGION',
    ]) {
      expect(() => createMediaStorage({ ...s3Env, [name]: '' })).toThrow(name)
    }
    expect(() =>
      createMediaStorage({ ...s3Env, MEDIA_S3_FORCE_PATH_STYLE: 'yes' })
    ).toThrow(/FORCE_PATH_STYLE/)
    expect(() =>
      createMediaStorage({ ...s3Env, MEDIA_S3_BUCKET: 'bucket/path' })
    ).toThrow(/BUCKET/)
    expect(() =>
      createMediaStorage({
        ...s3Env,
        MEDIA_S3_ENDPOINT: 'https://example.test?signature=x',
      })
    ).toThrow(/ENDPOINT/)
  })

  it('rejects traversal, foreign namespaces and unsupported MIME types before any upload', async () => {
    for (const input of [
      { ...request, ownerId: '../owner' },
      { ...request, fileName: '../key.png' },
      { ...request, fileName: `${fileName}?token=1` },
      { ...request, contentType: 'text/html' },
    ]) {
      expect(() => validateMediaObject(input)).toThrow(/invalid/)
      await expect(
        createMediaStorage(s3Env).createUpload(input)
      ).rejects.toThrow(/invalid/)
    }
  })

  it('normalizes safe base URLs and encodes path segments independently', () => {
    expect(storageUrl('https://example.test/media///', 'URL')).toBe(
      'https://example.test/media'
    )
    expect(storageUrl('http://localhost:9000/bucket', 'URL')).toBe(
      'http://localhost:9000/bucket'
    )
    expect(appendObjectPath('https://example.test', 'a b', 'c/d')).toBe(
      'https://example.test/a%20b/c%2Fd'
    )
    for (const value of [
      'bad',
      'ftp://example.test',
      'http://example.test',
      'https://user:secret@example.test',
      'https://example.test?q=x',
      'https://example.test#x',
      'https://*.example.test/media',
      'https://example.test/!(private)',
      'https://example.test/a[bc]',
      'https://example.test/{a,b}',
    ]) {
      expect(() => storageUrl(value, 'URL')).toThrow(/URL/)
    }
  })
})
