import { InvocationContext } from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'

async function getBlobClient(context: InvocationContext, userId: string) {
  const blobServiceClient = new BlobServiceClient(
    process.env.MIGRATION_BLOB_IMPORT_IMAGES_CONNECTION_STRING as string
  )

  const containerClient = blobServiceClient.getContainerClient(userId)

  if (!(await containerClient.exists())) {
    await containerClient.create()
  }

  return containerClient
}

export default getBlobClient
