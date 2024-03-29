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
        owner: {
          id: user.id,
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
    const tagsNameDict: Record<string, any> = tagsInDb.reduce(
      (acc, t) => ({
        ...acc,
        [t.name]: t,
      }),
      {}
    )

    const batches = sliceIntoChunks(tags, 20)

    for (const batch of batches) {
      const preparedTags = batch.flatMap((tag) => {
        const tagExistsById = tagsDict[tag._id]
        const tagExistsByName = tagsNameDict[tag.name]

        if (tagExistsById) {
          mappedTags[tag._id] = {
            id: tagExistsById.id,
            name: tagExistsById.name,
          }
          return []
        }

        if (tagExistsByName) {
          mappedTags[tag._id] = {
            id: tagExistsByName.id,
            name: tagExistsByName.name,
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

    const userWithTags = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        tags: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    })

    const [orderedTags, totalTags] = await prisma.$transaction(
      userWithTags.tags.map((tag, index) =>
        prisma.tag.update({
          where: {
            id: tag.id,
          },
          data: {
            order: index,
          },
        })
      )
    )

    console.log('ordered tags: ', orderedTags)

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
