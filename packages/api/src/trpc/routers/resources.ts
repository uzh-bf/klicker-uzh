import { getPrisma } from '../context.js'
import {
  toAnswerCollectionInfo,
  toSingleAnswerCollection,
} from '../dto/resources.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'
import { singleAnswerCollectionInput } from '../schemas/resources.js'

async function getAnswerCollectionsInfo({
  prisma,
  userId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      objects: {
        where: { answerCollectionId: { not: null } },
        include: {
          directPermission: true,
          answerCollection: {
            include: {
              _count: {
                select: {
                  entries: true,
                  permissions: true,
                  linkedElements: {
                    where: { permissions: { some: { userId } } },
                  },
                  linkedTemplates: {
                    where: {
                      OR: [
                        {
                          liveQuiz: {
                            permissions: { some: { userId } },
                          },
                        },
                        {
                          practiceQuiz: {
                            permissions: { some: { userId } },
                          },
                        },
                        {
                          microLearning: {
                            permissions: { some: { userId } },
                          },
                        },
                        {
                          groupActivity: {
                            permissions: { some: { userId } },
                          },
                        },
                      ],
                    },
                  },
                },
              },
              owner: { select: { shortname: true } },
            },
          },
        },
      },
    },
  })

  if (!user) return []

  return user.objects.flatMap((object) => {
    const collection = toAnswerCollectionInfo(object)
    return collection ? [collection] : []
  })
}

async function getSingleAnswerCollection({
  prisma,
  userId,
  id,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  id: number
}) {
  const collection = await prisma.answerCollection.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          _count: { select: { itemUsages: true, templateUsages: true } },
        },
        orderBy: { value: 'asc' },
      },
      permissions: { where: { userId } },
      owner: { select: { shortname: true } },
      _count: { select: { permissions: true } },
    },
  })

  return toSingleAnswerCollection(collection)
}

export const resourcesRouter = router({
  answerCollectionsInfo: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      answerCollections: await getAnswerCollectionsInfo({
        prisma,
        userId: ctx.user.sub,
      }),
    }
  }),

  singleAnswerCollection: userProcedure
    .input(singleAnswerCollectionInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        answerCollection: await getSingleAnswerCollection({
          prisma,
          userId: ctx.user.sub,
          id: input.id,
        }),
      }
    }),
})
