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
    const tagsInDb = await prisma.tag.findMany({
      where: {
        originalId: {
          not: null,
        },
      },
    })
    const tagsDict: Record<string, any> = tagsInDb.reduce(
      (acc, t) => ({
        ...acc,
        [t.originalId]: t,
      }),
      {}
    )

    const batches = sliceIntoChunks(tags, 20)

    for (const batch of batches) {
      const preparedTags = batch.flatMap((tag) => {
        const tagExists = tagsDict[tag._id]

        if (tagExists) {
          mappedTags[tag._id] = {
            id: tagExists.id,
            name: tagExists.name,
          }
          return []
        }

        return [
          {
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
              createdAt: new Date(tag.createdAt),
              updatedAt: new Date(tag.updatedAt),
            },
          },
        ]
      })

      const migratedTags = await prisma.$transaction(
        preparedTags.map((data) => prisma.tag.upsert(data))
      )

      migratedTags.forEach((tag) => {
        mappedTags[tag.originalId] = { id: tag.id, name: tag.name }
      })
    }

    context.log('mappedTags: ', mappedTags)

    return mappedTags
  } catch (error) {
    context.error('Something went wrong while importing tags: ', error)
    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of tags for user '${user.email}' because of ${error}`,
      context
    )
    throw error
  }
}
