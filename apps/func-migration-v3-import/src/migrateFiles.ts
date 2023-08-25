import { InvocationContext } from '@azure/functions'
import axios from 'axios'
import getBlobClient from './blob'
import { sendTeamsNotifications } from './utils'

export const migrateFiles = async (
  files: any,
  context: InvocationContext,
  user
) => {
  try {
    let mappedFileURLs: Record<string, Record<string, string>> = {}
    const blobClient = await getBlobClient(context)

    for (const file of files) {
      // download file with public link
      const response = await axios.get(
        `https://tc-klicker-prod.s3.amazonaws.com/images/${file.name}`,
        { responseType: 'arraybuffer' }
      )

      // upload file to azure blob storage
      // TODO: discuss if we want to use the original file name or the uuid --> original file name overwrites if not unique
      // TODO: how to handle newly added files (not via migration)?
      const blockBlobClient = blobClient.getBlockBlobClient(file.name)

      await blockBlobClient.uploadData(response.data, {
        blockSize: 4 * 1024 * 1024, // 4MB block size
      })

      const publicUrl = blockBlobClient.url.split('?')[0]
      mappedFileURLs[file._id] = {
        url: publicUrl,
        originalName: file.originalName,
      }
    }

    return mappedFileURLs
  } catch (error) {
    context.error('Something went wrong while migrating files: ', error)
    sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of images for user '${user.email}'`
    )
    throw new Error('Something went wrong while migrating files')
  }
}
