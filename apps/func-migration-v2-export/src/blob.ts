import { InvocationContext } from '@azure/functions'
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

let blobClient: ContainerClient

async function getBlobClient(context: InvocationContext) {
  if (!blobClient) {
    try {
      const blobServiceClient = new BlobServiceClient(
        process.env.MIGRATION_BLOB_EXPORT_CONNECTION_STRING as string
      )

      blobClient = blobServiceClient.getContainerClient('exports')
    } catch (e) {
      context.error(e)
    }
  }

  return blobClient
}

export default getBlobClient
