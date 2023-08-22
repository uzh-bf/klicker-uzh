import { PrismaClient, QuestionType } from './client'

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

export async function importTags(
  prisma: PrismaClient,
  tags: any,
  user,
  batchSize: number
) {
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
