import { ObjectType, PermissionLevel } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { getPrisma, type TRPCContext } from '../context.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  editTagInput,
  elementIdInput,
  tagOrderingInput,
} from '../schemas/element.js'

type TagRecord = {
  id: number
  name: string
  order: number
}

function toTagDto(tag: TagRecord) {
  return {
    id: tag.id,
    name: tag.name,
    order: tag.order,
  }
}

function reorderTags<T>(tags: T[], originIx: number, targetIx: number) {
  const reorderedTags = [...tags]

  if (
    originIx < 0 ||
    targetIx < 0 ||
    originIx >= reorderedTags.length ||
    targetIx >= reorderedTags.length
  ) {
    return reorderedTags
  }

  const originTag = reorderedTags[originIx]!
  reorderedTags[originIx] = reorderedTags[targetIx]!
  reorderedTags[targetIx] = originTag

  return reorderedTags
}

async function hasElementAdminPermission({
  ctx,
  id,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  id: number
}) {
  return hasObjectPermission(
    ctx,
    { objectId: String(id), objectType: ObjectType.ELEMENT },
    PermissionLevel.ADMIN
  )
}

export const elementRouter = router({
  tags: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      include: { tags: { orderBy: { order: 'asc' } } },
    })

    return { tags: user?.tags.map(toTagDto) ?? [] }
  }),

  summary: userProcedure.input(elementIdInput).query(async ({ ctx, input }) => {
    if (!(await hasElementAdminPermission({ ctx, id: input.id }))) {
      return { elementSummary: null }
    }

    const prisma = getPrisma(ctx)
    const adminLevels = [PermissionLevel.ADMIN, PermissionLevel.OWNER]
    const element = await prisma.element.findUnique({
      where: { id: input.id },
      include: {
        answerCollection: {
          include: {
            permissions: {
              where: {
                userId: ctx.user.sub,
                permissionLevel: { not: PermissionLevel.OWNER },
              },
            },
          },
        },
        elementInstances: {
          include: {
            elementStack: {
              include: {
                microLearning: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
                practiceQuiz: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
                groupActivity: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
              },
            },
            elementBlock: {
              include: {
                liveQuiz: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!element) return { elementSummary: null }

    return {
      elementSummary: {
        sharedElementActivityUse: element.elementInstances.some(
          (instance) => instance.ownerId !== ctx.user.sub
        ),
        retainsDerivedAccess: element.elementInstances.some(
          (instance) =>
            (instance.elementStack?.microLearning?.permissions.length ?? 0) >
              0 ||
            (instance.elementStack?.practiceQuiz?.permissions.length ?? 0) >
              0 ||
            (instance.elementStack?.groupActivity?.permissions.length ?? 0) >
              0 ||
            (instance.elementBlock?.liveQuiz?.permissions.length ?? 0) > 0
        ),
        derivedAccessToResources:
          (element.answerCollection?.permissions.length ?? 0) > 0,
      },
    }
  }),

  delete: userFullAccessProcedure
    .input(elementIdInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasElementAdminPermission({ ctx, id: input.id }))) {
        return { deletedElementId: null }
      }

      const prisma = getPrisma(ctx)
      const { deletedElement, originalElement } = await prisma.$transaction(
        async (transaction) => {
          const originalElement = await transaction.element.findUnique({
            where: { id: input.id },
          })

          if (!originalElement) {
            throw new Error('Element not found')
          }

          const deletedElement = await transaction.element.update({
            where: { id: input.id },
            data: {
              isDeleted: true,
              answerCollection: { disconnect: true },
              answerCollectionItems: { set: [] },
              directPermissions: { deleteMany: {} },
            },
            include: { tags: true },
          })

          await recomputeDerivedPermissions(
            { elementId: input.id },
            transaction
          )

          if (originalElement.answerCollectionId !== null) {
            await recomputeDerivedPermissions(
              { answerCollectionId: originalElement.answerCollectionId },
              transaction
            )
          }

          for (const tag of deletedElement.tags) {
            const elementTag = await transaction.tag.findUnique({
              where: { id: tag.id },
              include: {
                _count: {
                  select: { questions: { where: { isDeleted: false } } },
                },
              },
            })

            if (elementTag?._count.questions === 0) {
              await transaction.tag.delete({ where: { id: tag.id } })
            }
          }

          await transaction.element.update({
            where: { id: input.id },
            data: { tags: { set: [] } },
          })

          return { deletedElement, originalElement }
        },
        { timeout: 60000 }
      )

      ctx.emitter?.emit('invalidate', {
        typename: 'Element',
        id: deletedElement.id,
      })

      if (deletedElement.answerCollectionId) {
        ctx.emitter?.emit('invalidate', {
          typename: 'AnswerCollection',
          id: originalElement.answerCollectionId,
        })
      }

      return { deletedElementId: deletedElement.id }
    }),

  editTag: userFullAccessProcedure
    .input(editTagInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const existingTag = await prisma.tag.findUnique({
        where: { ownerId_name: { ownerId: ctx.user.sub, name: input.name } },
      })

      if (existingTag) {
        return { tag: null }
      }

      const tag = await prisma.tag.update({
        where: { id: input.id, ownerId: ctx.user.sub },
        data: { name: input.name },
      })

      return { tag: toTagDto(tag) }
    }),

  deleteTag: userFullAccessProcedure
    .input(elementIdInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const tag = await prisma.tag.delete({
        where: {
          id: input.id,
          ownerId: ctx.user.sub,
        },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'Tag',
        id: tag.id,
      })

      return { tag: toTagDto(tag) }
    }),

  updateTagOrdering: userFullAccessProcedure
    .input(tagOrderingInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const tags = await prisma.tag.findMany({
        where: {
          ownerId: ctx.user.sub,
        },
        orderBy: {
          order: 'asc',
        },
      })

      const sortedTags = [...tags].sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name)
      )
      const reorderedTags = reorderTags(
        sortedTags,
        input.originIx,
        input.targetIx
      )

      await prisma.$transaction(
        reorderedTags.map((tag, ix) =>
          prisma.tag.update({
            where: { id: tag.id },
            data: { order: ix },
          })
        )
      )

      return { tags: reorderedTags.map(toTagDto) }
    }),
})
