import { InvocationContext } from '@azure/functions'
import { PrismaClient, User } from '@klicker-uzh/prisma'
import axios from 'axios'
import { randomUUID } from 'crypto'
import getBlobClient from './blob'
import { sendTeamsNotifications } from './utils'

export const migrateFiles = async (
  prisma: PrismaClient,
  files: any,
  context: InvocationContext,
  user: User
) => {
  try {
    let mappedFileURLs: Record<string, Record<string, string>> = {}
    const blobClient = await getBlobClient(context, user.id)

    for (const file of files) {
      // download file with public link
      const response = await axios.get(
        `https://tc-klicker-prod.s3.amazonaws.com/images/${file.name}`,
        { responseType: 'arraybuffer' }
      )

      // upload file to azure blob storage
      const id = randomUUID()
      const extension = file.originalName.split('.').pop()
      const blockBlobClient = blobClient.getBlockBlobClient(
        `${id}.${extension}`
      )

      await blockBlobClient.uploadData(response.data, {
        blockSize: 4 * 1024 * 1024, // 4MB block size
      })

      // TODO: add files to media library
      // TODO: think about more efficient promise.allSettled or transaction
      // await prisma.

      const publicUrl = blockBlobClient.url.split('?')[0]
      mappedFileURLs[file._id] = {
        id,
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
    throw new (error as any)()
  }
}
