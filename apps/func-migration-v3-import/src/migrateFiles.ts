import { InvocationContext } from '@azure/functions'
import { PrismaClient, User } from '@klicker-uzh/prisma'
import axios from 'axios'
import { v5 as uuidv5 } from 'uuid'
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
      const id = uuidv5(file._id, 'aac50793-04e0-490c-acac-8d21275c2338')
      const extension = file.originalName.split('.').pop()
      const blockBlobClient = blobClient.getBlockBlobClient(
        `${id}.${extension}`
      )

      // TODO: think about more efficient promise.allSettled or transaction
      try {
        await prisma.mediaFile.create({
          data: {
            id,
            name: file.originalName,
            type: 'unset',
            href: blockBlobClient.url.split('?')[0],
            originalId: file._id,
            owner: {
              connect: {
                id: user.id,
              },
            },
          },
        })

        context.log(
          `Uploading file ${file.originalName} to ${blockBlobClient.url}`
        )

        await blockBlobClient.uploadData(response.data, {
          blockSize: 4 * 1024 * 1024, // 4MB block size
        })
      } catch (e) {
        // TODO: also ignore if the file already exists and cannot be uploaded, or just reupload
        if (!e.message.includes('Unique constraint failed')) {
          throw e
        }
      }

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
    throw error
  }
}
