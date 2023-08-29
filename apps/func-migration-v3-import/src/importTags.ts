import { InvocationContext } from '@azure/functions'
import { PrismaClient } from '@klicker-uzh/prisma'
import { sendTeamsNotifications, sliceIntoChunks } from './utils'

export async function importTags(
  prisma: PrismaClient,
  tags: any,
  user,
  batchSize: number,
  context: InvocationContext
) {
  try {
    let mappedTags: Record<string, Record<string, string | number>> = {}
    const tagsInDb = await prisma.tag.findMany()
    const tagsDict: Record<string, any> = tagsInDb.reduce((acc, t) => {
      if (t.originalId != null) {
        acc[t.originalId] = t
      }
      return acc
    }, {})

    const batches = sliceIntoChunks(tags, 1)

    for (const batch of batches) {
      await prisma.$transaction(async (prisma) => {
        for (const tag of batch) {
          const tagExists = tagsDict[tag._id]

          if (tagExists) {
            mappedTags[tag._id] = {
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
              originalId: tag._id,
              owner: {
                connect: {
                  id: user.id,
                },
              },
            },
          })
          const extractedId = tag._id
          mappedTags[extractedId] = { id: newTag.id, name: newTag.name }
        }
      })
    }

    return mappedTags
  } catch (error) {
    context.error('Something went wrong while importing tags: ', error)
    sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of tags for user '${user.email}' because of ${error}`
    )
    throw error
  }
}
