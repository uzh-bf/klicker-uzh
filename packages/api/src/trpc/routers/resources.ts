import {
  AuditLogType,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { getPrisma } from '../context.js'
import {
  toAnswerCollectionEntry,
  toAnswerCollectionInfo,
  toModifiedAnswerCollection,
  toOwnedAnswerCollectionMutationResult,
  toSingleAnswerCollection,
} from '../dto/resources.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  addAnswerCollectionOptionInput,
  answerCollectionEntryInput,
  answerCollectionIdInput,
  createAnswerCollectionInput,
  deleteAnswerCollectionEntryInput,
  deleteAnswerCollectionInput,
  modifyAnswerCollectionInput,
  singleAnswerCollectionInput,
} from '../schemas/resources.js'

function emitAnswerCollectionInvalidation({
  collectionId,
  emitter,
}: {
  collectionId: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  emitter?.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })
}

async function hasAnswerCollectionPermission({
  ctx,
  collectionId,
  permissionLevel,
}: {
  ctx: Parameters<typeof hasObjectPermission>[0]
  collectionId: number
  permissionLevel: PermissionLevel
}) {
  return hasObjectPermission(
    ctx,
    {
      objectId: String(collectionId),
      objectType: ObjectType.ANSWER_COLLECTION,
    },
    permissionLevel
  )
}

async function incrementCollectionVersion({
  prisma,
  collectionId,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  collectionId: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const collection = await prisma.answerCollection.update({
    where: { id: collectionId },
    data: { version: { increment: 1 } },
  })

  emitAnswerCollectionInvalidation({ collectionId, emitter })

  return collection
}

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

async function createAnswerCollection({
  prisma,
  userId,
  name,
  description,
  answers,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  name: string
  description: string
  answers: string[]
}) {
  const collection = await prisma.$transaction(async (transaction) => {
    const newCollection = await transaction.answerCollection.create({
      data: {
        name,
        description,
        entries: {
          create: answers.map((answer) => ({ value: answer })),
        },
        owner: { connect: { id: userId } },
      },
      include: { entries: true },
    })

    await recomputeDerivedPermissions(
      { answerCollectionId: newCollection.id, userId },
      transaction
    )

    return newCollection
  })

  return toOwnedAnswerCollectionMutationResult(collection)
}

async function duplicateAnswerCollection({
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
    include: { entries: true },
  })

  if (!collection) return null

  const duplicatedCollection = await prisma.$transaction(
    async (transaction) => {
      const newCollection = await transaction.answerCollection.create({
        data: {
          name: `${collection.name} (Copy)`,
          description: collection.description,
          entries: {
            create: collection.entries.map((entry) => ({ value: entry.value })),
          },
          owner: { connect: { id: userId } },
        },
        include: { entries: true },
      })

      await recomputeDerivedPermissions(
        { answerCollectionId: newCollection.id, userId },
        transaction
      )

      return newCollection
    }
  )

  return toOwnedAnswerCollectionMutationResult(duplicatedCollection)
}

async function modifyAnswerCollection({
  prisma,
  emitter,
  id,
  name,
  description,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  id: number
  name?: string | null
  description?: string | null
}) {
  const collection = await prisma.answerCollection.findUnique({
    where: { id },
    include: { _count: { select: { permissions: true } } },
  })

  if (!collection) return null

  const updatedCollection = await prisma.$transaction(async (transaction) => {
    const updateResult = await transaction.answerCollection.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        version: { increment: 1 },
      },
      include: { entries: true },
    })

    emitAnswerCollectionInvalidation({ collectionId: id, emitter })

    return {
      ...updateResult,
      numSharedUsers: collection._count.permissions - 1,
    }
  })

  return toModifiedAnswerCollection(updatedCollection)
}

async function deleteAnswerCollection({
  prisma,
  userId,
  collectionId,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  collectionId: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const collectionUser = await prisma.answerCollection.findUnique({
    where: { id: collectionId },
    include: {
      _count: {
        select: {
          linkedElements: {
            where: { permissions: { some: { userId } } },
          },
          linkedTemplates: {
            where: {
              OR: [
                { liveQuiz: { permissions: { some: { userId } } } },
                { practiceQuiz: { permissions: { some: { userId } } } },
                { microLearning: { permissions: { some: { userId } } } },
                { groupActivity: { permissions: { some: { userId } } } },
              ],
            },
          },
          permissions: true,
        },
      },
    },
  })

  if (
    !collectionUser ||
    collectionUser._count.linkedElements > 0 ||
    collectionUser._count.linkedTemplates > 0
  ) {
    return null
  }

  const collection = await prisma.answerCollection.findUnique({
    where: { id: collectionId },
    include: {
      _count: { select: { linkedElements: true, linkedTemplates: true } },
    },
  })

  if (!collection) return null

  const remainingLinkedElements = collection._count.linkedElements
  const remainingLinkedTemplates = collection._count.linkedTemplates

  if (remainingLinkedElements > 0 || remainingLinkedTemplates > 0) {
    await prisma.$transaction(async (transaction) => {
      await transaction.accessRequest.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      await transaction.permission.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      await transaction.catalogCollectionAssignment.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      const updatedAnswerCollection = await transaction.answerCollection.update(
        {
          where: { id: collectionId },
          data: {
            isDeleted: true,
            directPermissions: { deleteMany: {} },
          },
        }
      )

      await recomputeDerivedPermissions(
        { answerCollectionId: updatedAnswerCollection.id },
        transaction
      )
    })
  } else {
    await prisma.answerCollection.delete({
      where: { id: collectionId },
    })
  }

  emitAnswerCollectionInvalidation({ collectionId, emitter })

  return collectionId
}

async function removeAnswerCollection({
  prisma,
  userId,
  id,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  id: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const permission = await prisma.permission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: id,
        userId,
      },
    },
    include: {
      answerCollection: {
        include: {
          _count: {
            select: {
              linkedElements: {
                where: { permissions: { some: { userId } } },
              },
              linkedTemplates: {
                where: {
                  OR: [
                    { liveQuiz: { permissions: { some: { userId } } } },
                    { practiceQuiz: { permissions: { some: { userId } } } },
                    { microLearning: { permissions: { some: { userId } } } },
                    { groupActivity: { permissions: { some: { userId } } } },
                  ],
                },
              },
              permissions: true,
            },
          },
        },
      },
    },
  })

  const collection = permission?.answerCollection
  if (
    !permission ||
    !collection ||
    collection._count.linkedElements > 0 ||
    collection._count.linkedTemplates > 0 ||
    collection.ownerId === userId
  ) {
    return null
  }

  if (collection._count.permissions === 1 && collection.isDeleted === true) {
    await prisma.answerCollection.delete({ where: { id } })
  } else {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.permission.delete({ where: { id: permission.id } })

        await transaction.auditLogEntry.create({
          data: {
            type: AuditLogType.PERMISSION_REMOVED,
            objectId: String(id),
            objectType: ObjectType.ANSWER_COLLECTION,
            sourceUserId: userId,
            message: `User ${userId} removed own permission on ${ObjectType.ANSWER_COLLECTION} (ID: ${id})`,
          },
        })

        await recomputeDerivedPermissions(
          { answerCollectionId: id, userId },
          transaction
        )
      },
      { timeout: 60000 }
    )
  }

  emitAnswerCollectionInvalidation({ collectionId: collection.id, emitter })

  return collection.id
}

async function addAnswerCollectionOption({
  prisma,
  collectionId,
  value,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  collectionId: number
  value: string
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const newEntry = await prisma.answerCollectionEntry.create({
    data: {
      value,
      collection: { connect: { id: collectionId } },
    },
  })

  await incrementCollectionVersion({
    prisma,
    collectionId: newEntry.collectionId,
    emitter,
  })

  return toAnswerCollectionEntry(newEntry)
}

async function editAnswerCollectionEntry({
  prisma,
  id,
  value,
  collectionId,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  id: number
  value: string
  collectionId: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const updatedEntry = await prisma.answerCollectionEntry.update({
    where: { id, collectionId },
    data: { value },
  })

  await incrementCollectionVersion({
    prisma,
    collectionId: updatedEntry.collectionId,
    emitter,
  })

  return toAnswerCollectionEntry(updatedEntry)
}

async function deleteAnswerCollectionEntry({
  prisma,
  id,
  collectionId,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  id: number
  collectionId: number
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  const entry = await prisma.answerCollectionEntry.findUnique({
    where: { id, collectionId },
    include: { _count: { select: { itemUsages: true, templateUsages: true } } },
  })

  if (
    !entry ||
    entry._count.itemUsages > 0 ||
    entry._count.templateUsages > 0
  ) {
    return null
  }

  const deletedEntry = await prisma.answerCollectionEntry.delete({
    where: { id },
  })

  await incrementCollectionVersion({
    prisma,
    collectionId: deletedEntry.collectionId,
    emitter,
  })

  return deletedEntry.id
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

  createAnswerCollection: userFullAccessProcedure
    .input(createAnswerCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        answerCollection: await createAnswerCollection({
          prisma,
          userId: ctx.user.sub,
          name: input.name,
          description: input.description,
          answers: input.answers,
        }),
      }
    }),

  duplicateAnswerCollection: userFullAccessProcedure
    .input(answerCollectionIdInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.id,
        permissionLevel: PermissionLevel.READ,
      })

      return {
        answerCollection: hasPermission
          ? await duplicateAnswerCollection({
              prisma,
              userId: ctx.user.sub,
              id: input.id,
            })
          : null,
      }
    }),

  modifyAnswerCollection: userFullAccessProcedure
    .input(modifyAnswerCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.id,
        permissionLevel: PermissionLevel.WRITE,
      })

      return {
        answerCollection: hasPermission
          ? await modifyAnswerCollection({
              prisma,
              emitter: ctx.emitter,
              id: input.id,
              name: input.name,
              description: input.description,
            })
          : null,
      }
    }),

  deleteAnswerCollection: userFullAccessProcedure
    .input(deleteAnswerCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.collectionId,
        permissionLevel: PermissionLevel.ADMIN,
      })

      return {
        deletedAnswerCollectionId: hasPermission
          ? await deleteAnswerCollection({
              prisma,
              userId: ctx.user.sub,
              collectionId: input.collectionId,
              emitter: ctx.emitter,
            })
          : null,
      }
    }),

  removeAnswerCollection: userFullAccessProcedure
    .input(answerCollectionIdInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        removedAnswerCollectionId: await removeAnswerCollection({
          prisma,
          userId: ctx.user.sub,
          id: input.id,
          emitter: ctx.emitter,
        }),
      }
    }),

  addAnswerCollectionOption: userFullAccessProcedure
    .input(addAnswerCollectionOptionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.collectionId,
        permissionLevel: PermissionLevel.WRITE,
      })

      return {
        answerCollectionEntry: hasPermission
          ? await addAnswerCollectionOption({
              prisma,
              collectionId: input.collectionId,
              value: input.value,
              emitter: ctx.emitter,
            })
          : null,
      }
    }),

  editAnswerCollectionEntry: userFullAccessProcedure
    .input(answerCollectionEntryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.collectionId,
        permissionLevel: PermissionLevel.WRITE,
      })

      return {
        answerCollectionEntry: hasPermission
          ? await editAnswerCollectionEntry({
              prisma,
              id: input.id,
              value: input.value,
              collectionId: input.collectionId,
              emitter: ctx.emitter,
            })
          : null,
      }
    }),

  deleteAnswerCollectionEntry: userFullAccessProcedure
    .input(deleteAnswerCollectionEntryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hasPermission = await hasAnswerCollectionPermission({
        ctx,
        collectionId: input.collectionId,
        permissionLevel: PermissionLevel.WRITE,
      })

      return {
        deletedAnswerCollectionEntryId: hasPermission
          ? await deleteAnswerCollectionEntry({
              prisma,
              id: input.id,
              collectionId: input.collectionId,
              emitter: ctx.emitter,
            })
          : null,
      }
    }),
})
