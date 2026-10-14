import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import {
  appendObjectPath,
  MEDIA_UPLOAD_EXPIRY_SECONDS,
  type MediaStorage,
  type MediaUploadRequest,
  requireStorageValue,
  validateMediaObject,
} from './types.js'

/** Keeps existing per-owner public containers and legacy SAS response intact. */
export class AzureMediaStorage implements MediaStorage {
  private readonly credential: StorageSharedKeyCredential
  private readonly service: BlobServiceClient
  private readonly accountUrl: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const accountName = requireStorageValue(env, 'BLOB_STORAGE_ACCOUNT_NAME')
    const accessKey = requireStorageValue(env, 'BLOB_STORAGE_ACCESS_KEY')
    this.credential = new StorageSharedKeyCredential(accountName, accessKey)
    this.accountUrl = getBlobStorageAccountUrl(
      accountName,
      env.BLOB_STORAGE_ACCOUNT_URL
    )
    const internalUrl = getBlobStorageAccountUrl(
      accountName,
      env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? this.accountUrl
    )
    this.service = new BlobServiceClient(internalUrl, this.credential)
  }

  async createUpload(request: MediaUploadRequest) {
    validateMediaObject(request)
    const { ownerId, fileName, contentType } = request
    // Await container creation before allowing the browser to PUT the blob.
    await this.service
      .getContainerClient(ownerId)
      .createIfNotExists({ access: 'blob' })
    const sas = generateBlobSASQueryParameters(
      {
        containerName: ownerId,
        blobName: fileName,
        contentType,
        permissions: BlobSASPermissions.parse('w'),
        expiresOn: new Date(Date.now() + MEDIA_UPLOAD_EXPIRY_SECONDS * 1000),
      },
      this.credential
    ).toString()
    const uploadHref = appendObjectPath(this.accountUrl, ownerId, fileName)
    return {
      uploadUrl: `${uploadHref}?${sas}`,
      uploadHref,
      uploadHeaders: [
        { name: 'Content-Type', value: contentType },
        { name: 'x-ms-blob-type', value: 'BlockBlob' },
      ],
      // Existing clients still construct their BlobServiceClient from this URL.
      uploadSasURL: `${this.accountUrl}?${sas}`,
      containerName: ownerId,
      fileName,
    }
  }
}
