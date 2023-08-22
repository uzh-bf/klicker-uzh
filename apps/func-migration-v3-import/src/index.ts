import { app, InvocationContext, StorageBlobHandler } from '@azure/functions'
import { QuestionType } from '@klicker-uzh/prisma'
import getPrismaClient from './prisma'

const extractString = (stringItem: string) => {
  const pattern = /"(.*)"/
  const match = stringItem.match(pattern)

  return match ? match[1] : stringItem
}

const QuestionTypeMap: Record<string, QuestionType> = {
  SC: 'SC',
  MC: 'MC',
  FREE_RANGE: 'NUMERICAL',
  FREE: 'FREE_TEXT',
}

function sliceIntoChunks(array: any[], chunkSize: number) {
  const result = []
  let index = 0
  while (index < array.length) {
    result.push(array.slice(index, index + chunkSize))
    index += chunkSize
  }
  return result
}

const importTags = async (tags: any, user, batchSize: number) => {
  let mappedTags: Record<string, Record<string, string | number>> = {}
  const tagsInDb = await prisma.tag.findMany()
  const tagsDict: Record<string, any> = tagsInDb.reduce((acc, t) => {
    if (t.originalId != null) {
      acc[t.originalId] = t
    }
    return acc
  }, {})
  const batches = sliceIntoChunks(tags, batchSize)
  try {
    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const tag of batch) {
          const tagExists = tagsDict[extractString(tag._id)]

          if (tagExists) {
            console.log('tag already exists: ', tagExists)
            mappedTags[extractString(tag._id)] = {
              id: tagExists.id,
              name: tagExists.name,
            }
            continue
          }

          const newTag = await prisma.tag.upsert({
            where: {
              ownerId_name: {
                ownerId: user.id,
                name: tag.name,
              },
            },
            update: {},
            create: {
              name: tag.name,
              originalId: extractString(tag._id),
              owner: {
                connect: {
                  id: user.id,
                },
              },
            },
          })
          // console.log("new tag created: ", newTag)
          const extractedId = extractString(tag._id)
          // console.log("tag._id: ", extractedId)
          mappedTags[extractedId] = { id: newTag.id, name: newTag.name }
        }
        // console.log("mappedTagIds: ", mappedTags)
      })
    }
  } catch (error) {
    console.log('Something went wrong while importing tags: ', error)
  }
  return mappedTags
}

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

    const client = getPrismaClient(context)

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
