import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'

const DEFAULT_SAS_TTL_MINUTES = 5

export async function getAdaptiveExportContainer() {
  const accountName = requiredEnvironment(
    'ADAPTIVE_CALIBRATION_EXPORT_STORAGE_ACCOUNT_NAME'
  )
  const credential = new StorageSharedKeyCredential(
    accountName,
    requiredEnvironment('ADAPTIVE_CALIBRATION_EXPORT_STORAGE_ACCESS_KEY')
  )
  const client = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  )
  const container = client.getContainerClient(
    requiredEnvironment('ADAPTIVE_CALIBRATION_EXPORT_STORAGE_CONTAINER')
  )
  await container.createIfNotExists()
  return container
}

export function createAdaptiveExportOwnerDownloadUrl(
  artifactKey: string,
  requestExpiry: Date
) {
  const accountName = requiredEnvironment(
    'ADAPTIVE_CALIBRATION_EXPORT_STORAGE_ACCOUNT_NAME'
  )
  const containerName = requiredEnvironment(
    'ADAPTIVE_CALIBRATION_EXPORT_STORAGE_CONTAINER'
  )
  const credential = new StorageSharedKeyCredential(
    accountName,
    requiredEnvironment('ADAPTIVE_CALIBRATION_EXPORT_STORAGE_ACCESS_KEY')
  )
  const expiresOn = new Date(
    Math.min(
      requestExpiry.getTime(),
      Date.now() +
        getPositiveIntegerEnvironment(
          'ADAPTIVE_CALIBRATION_EXPORT_SAS_TTL_MINUTES',
          DEFAULT_SAS_TTL_MINUTES
        ) *
          60 *
          1_000
    )
  )
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: artifactKey,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(Date.now() - 60_000),
      expiresOn,
    },
    credential
  )
  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeBlobPath(artifactKey)}?${sas}`
}

export function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

export function getPositiveIntegerEnvironment(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}.`)
  }
  return value
}

function encodeBlobPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}
