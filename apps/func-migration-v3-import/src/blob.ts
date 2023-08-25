import { InvocationContext } from '@azure/functions'
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

let blobClient: ContainerClient

async function getBlobClient(context: InvocationContext) {
  if (!blobClient) {
    try {
      const blobServiceClient = new BlobServiceClient(
        process.env.DUPLICATED_MIGRATION_BLOB_IMPORT_CONNECTION_STRING as string
      )

      blobClient = blobServiceClient.getContainerClient(
        process.env.MIGRATION_BLOB_IMPORT_STORAGE_PATH as string
      )
    } catch (e) {
      context.error("Something went wrong while creating a blob client: ", e)
    }
  }

  return blobClient
}

export default getBlobClient
