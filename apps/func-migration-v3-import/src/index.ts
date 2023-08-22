import { app, InvocationContext, StorageBlobHandler } from '@azure/functions'
import getPrismaClient from './prisma'

const prisma = getPrismaClient()

const blobTrigger: StorageBlobHandler = async function (
  blob: unknown,
  context: InvocationContext
) {
  try {
    const data = blob as Buffer

    const content = data.toString()

    const parsedContent = JSON.parse(content)

    context.log(
      'MigrationV3Import function processing a new exported blob',
      parsedContent['user_email']
    )

    const email = 'lecturer@bf.uzh.ch'

    context.log('__dirname: ', __dirname)

    // const user = await prisma.user.findUnique({
    //   where: {
    //     email,
    //   },
    // })

    // if (!user) {
    //   throw new Error('User not found')
    // }

    // // keep information in memory for more efficient lookup
    // let mappedTags: Record<string, Record<string, string | number>> = {}

    // const batchSize = 50
    // const tags = parsedContent.tags
    // mappedTags = await importTags(prisma, tags, user, batchSize)

    // console.log("mappedTags: ", mappedTags)
  } catch (e) {
    context.error(e)
  }
}

export default blobTrigger

app.storageBlob('MigrationV3Import', {
  connection: 'MIGRATION_BLOB_IMPORT_CONNECTION_STRING',
  path: process.env.MIGRATION_BLOB_STORAGE_PATH as string,
  handler: blobTrigger,
})
