import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  appendObjectPath,
  MEDIA_UPLOAD_EXPIRY_SECONDS,
  type MediaStorage,
  type MediaUploadRequest,
  requireStorageValue,
  storageUrl,
  validateMediaObject,
} from './types.js'

export class S3MediaStorage implements MediaStorage {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicUrl: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.bucket = requireStorageValue(env, 'MEDIA_S3_BUCKET')
    // A bucket is a name, not a URL, ARN or object prefix.
    if (
      !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(this.bucket) ||
      this.bucket.includes('..')
    ) {
      throw new Error('MEDIA_S3_BUCKET is invalid')
    }
    this.publicUrl = storageUrl(
      requireStorageValue(env, 'MEDIA_STORAGE_PUBLIC_URL'),
      'MEDIA_STORAGE_PUBLIC_URL'
    )
    const pathStyle = env.MEDIA_S3_FORCE_PATH_STYLE?.trim() || 'false'
    if (pathStyle !== 'true' && pathStyle !== 'false') {
      throw new Error('MEDIA_S3_FORCE_PATH_STYLE must be true or false')
    }
    this.client = new S3Client({
      region: requireStorageValue(env, 'MEDIA_S3_REGION'),
      endpoint: env.MEDIA_S3_ENDPOINT?.trim()
        ? storageUrl(env.MEDIA_S3_ENDPOINT.trim(), 'MEDIA_S3_ENDPOINT')
        : undefined,
      forcePathStyle: pathStyle === 'true',
      // Browser uploads carry the real body. Do not sign a checksum of the
      // empty server-side signing request; not all S3-compatible stores support
      // the SDK's optional checksum extensions either.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      // Credentials intentionally use the official SDK's server-side chain.
      // No credentials or SDK code are sent to the browser.
    })
  }

  async createUpload(request: MediaUploadRequest) {
    validateMediaObject(request)
    const { ownerId, fileName, contentType } = request
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: `${ownerId}/${fileName}`,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: MEDIA_UPLOAD_EXPIRY_SECONDS,
      signableHeaders: new Set(['content-type']),
    })
    return {
      uploadUrl,
      uploadHref: appendObjectPath(this.publicUrl, ownerId, fileName),
      uploadHeaders: [{ name: 'Content-Type', value: contentType }],
    }
  }
}
