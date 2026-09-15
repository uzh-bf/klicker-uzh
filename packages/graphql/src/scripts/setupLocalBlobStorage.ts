import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'

const accountName = process.env.BLOB_STORAGE_ACCOUNT_NAME?.trim()
const accessKey = process.env.BLOB_STORAGE_ACCESS_KEY?.trim()
const manageUrl = process.env.NEXT_PUBLIC_MANAGE_URL?.trim()

if (!accountName || !accessKey || !manageUrl) {
  throw new Error('Local Blob storage configuration is incomplete')
}

const publicAccountUrl = getBlobStorageAccountUrl(
  accountName,
  process.env.BLOB_STORAGE_ACCOUNT_URL
)
const setupAccountUrl = getBlobStorageAccountUrl(
  accountName,
  process.env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? publicAccountUrl
)
const publicStorageUrl = new URL(publicAccountUrl)
const setupStorageUrl = new URL(setupAccountUrl)
const manageOrigin = new URL(manageUrl).origin

if (
  publicStorageUrl.hostname !== 'localhost' &&
  !publicStorageUrl.hostname.endsWith('.localhost')
) {
  throw new Error('Refusing to configure CORS on non-local Blob storage')
}

if (
  setupStorageUrl.hostname !== 'azurite' &&
  !setupStorageUrl.hostname.endsWith('-azurite') &&
  setupStorageUrl.hostname !== 'localhost' &&
  !setupStorageUrl.hostname.endsWith('.localhost')
) {
  throw new Error('Refusing to configure a non-local Blob storage endpoint')
}

const serviceClient = new BlobServiceClient(
  setupAccountUrl,
  new StorageSharedKeyCredential(accountName, accessKey)
)
await serviceClient.setProperties({
  cors: [
    {
      allowedOrigins: manageOrigin,
      allowedMethods: 'DELETE,GET,HEAD,OPTIONS,PUT',
      allowedHeaders: '*',
      exposedHeaders: 'x-ms-*',
      maxAgeInSeconds: 3600,
    },
  ],
})

console.info(`[blob-storage] Azurite CORS configured for ${manageOrigin}`)
