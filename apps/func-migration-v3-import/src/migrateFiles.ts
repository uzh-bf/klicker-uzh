import { InvocationContext } from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'
import axios from 'axios'

export const migrateFiles = async (files: any, context: InvocationContext) => {
    let mappedFileURLs: Record<string, Record<string, string>> = {}
    try {
      // setup Azure Blob Storage client
      const account = process.env.NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT_NAME
      const containerName = process.env.NEXT_PUBLIC_AZURE_CONTAINER_NAME
      const sasToken = process.env.AZURE_SAS_TOKEN
      
      const blobServiceClient = new BlobServiceClient(
        `https://${account}.blob.core.windows.net?${sasToken}`
      )
  
      const containerClient = blobServiceClient.getContainerClient(containerName)
  
      for (const file of files) {
        // download file with public link
        const response = await axios.get(
          `https://tc-klicker-prod.s3.amazonaws.com/images/${file.name}`,
          { responseType: 'arraybuffer' }
        )
  
        // upload file to azure blob storage
        // TODO: discuss if we want to use the original file name or the uuid --> original file name overwrites if not unique
        // TODO: how to handle newly added files (not via migration)?
        const blockBlobClient = containerClient.getBlockBlobClient(file.name)
  
        await blockBlobClient.uploadData(response.data, {
          blockSize: 4 * 1024 * 1024, // 4MB block size
        })
  
        const publicUrl = blockBlobClient.url.split('?')[0]
        mappedFileURLs[file._id] = {
          url: publicUrl,
          originalName: file.originalName,
        }
      }
    } catch (error) {
      context.error('Something went wrong while importing files: ', error)
    }
  
    return mappedFileURLs
}