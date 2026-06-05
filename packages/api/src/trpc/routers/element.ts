import { ObjectType, PermissionLevel } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { getPrisma, type TRPCContext } from '../context.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import { elementIdInput } from '../schemas/element.js'

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
})
