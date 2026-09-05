import * as DB from '@klicker-uzh/prisma/client'
import { SharingType } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  ensureAnswerCollectionAndLinkedElementFingerprintsCurrent,
  ensureAnswerCollectionFingerprintCurrent,
} from './importExportFingerprints.js'
import { validateTemplateAccessible } from './templates.js'

// ! Answer Collections
// #region
async function lockAnswerCollectionForDidacticMutation(
  collectionId: number,
  prisma: PrismaTransactionContextWithUser['prisma']
) {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "public"."AnswerCollection"
    WHERE "id" = ${collectionId}
    FOR UPDATE
  `
}

async function markAnswerCollectionDidacticChange(
  collectionId: number,
  prisma: PrismaTransactionContextWithUser['prisma']
) {
  await prisma.answerCollection.update({
    where: { id: collectionId },
    data: {
      version: { increment: 1 },
    },
  })
  await ensureAnswerCollectionAndLinkedElementFingerprintsCurrent(
    collectionId,
    prisma
  )
}

function invalidateAnswerCollection(
  collectionId: number,
  ctx: ContextWithUser
) {
  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })
}

export async function createAnswerCollection(
  {
    name,
    description,
    answers,
  }: {
    name: string
    description: string
    answers: string[]
  },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.$transaction(async (prisma) => {
    const newCollection = await prisma.answerCollection.create({
      data: {
        name,
        description,
        entries: {
          create: answers.map((answer) => ({
            value: answer,
          })),
        },
        owner: {
          connect: {
            id: ctx.user.sub,
          },
        },
      },
      include: {
        entries: true,
      },
    })

    await ensureAnswerCollectionFingerprintCurrent(newCollection.id, prisma)

    // trigger recomputation of derived permissions (-> owner should get new one)
    await recomputeDerivedPermissions(
      { answerCollectionId: newCollection.id, userId: ctx.user.sub },
      prisma
    )

    return newCollection
  })

  return {
    ...collection,
    numSharedUsers: 0,
    numOfEntries: collection.entries.length,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isImported: false,
    isShared: false,
    isDeletable: true,
    isRemovable: false,
    sharingType: SharingType.OWNED,
  }
}

export async function duplicateAnswerCollection(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch the existing answer collection, including its entries
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
    include: { entries: true },
  })

  if (!collection) {
    return null
  }

  // create a new collection with the same entries
  const duplicatedCollection = await ctx.prisma.$transaction(async (prisma) => {
    const name = `${collection.name} (Copy)`
    const newCollection = await prisma.answerCollection.create({
      data: {
        name,
        description: collection.description,
        entries: {
          create: collection.entries.map((entry) => ({
            value: entry.value,
          })),
        },
        owner: {
          connect: {
            id: ctx.user.sub,
          },
        },
      },
      include: { entries: true },
    })

    await ensureAnswerCollectionFingerprintCurrent(newCollection.id, prisma)

    // trigger recomputation of derived permissions (-> owner should get new one)
    await recomputeDerivedPermissions(
      { answerCollectionId: newCollection.id, userId: ctx.user.sub },
      prisma
    )

    return newCollection
  })

  return {
    ...duplicatedCollection,
    numSharedUsers: 0,
    numOfEntries: duplicatedCollection.entries.length,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isImported: false,
    isShared: false,
    isDeletable: true,
    isRemovable: false,
    sharingType: SharingType.OWNED,
  }
}

export async function getAnswerCollectionsElements(
  { templateId }: { templateId?: string | null },
  ctx: PrismaTransactionContextWithUser
) {
  // fetch all answer collections, which are available to be included in elements
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: { answerCollectionId: { not: null } },
        include: {
          answerCollection: {
            include: {
              owner: { select: { shortname: true } },
              entries: { orderBy: { value: 'asc' } },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return []
  }

  // include answer collections used in any element of the template (required for preview / editing)
  // in case the instances were not modified, the user would get access to them either way
  let templateAnswerCollections: (DB.AnswerCollection & {
    entries: DB.AnswerCollectionEntry[]
  })[] = []
  if (templateId) {
    // verify that the user has access to the template activity
    const { accessible } = await validateTemplateAccessible({ templateId }, ctx)
    if (accessible) {
      const template = await ctx.prisma.activityTemplate.findUnique({
        where: {
          id: templateId,
        },
        include: {
          answerCollections: {
            include: {
              entries: {
                orderBy: {
                  value: 'asc',
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      })

      templateAnswerCollections = template?.answerCollections ?? []
    } else {
      templateAnswerCollections = []
    }
  }

  // get the ids of all answer collections that are shared with the user
  const sharedAnswerCollectionIds = user.objects
    .filter((object) => object.answerCollection)
    .map((object) => object.answerCollection!.id)

  const combinedAnswerCollections = [
    ...user.objects.flatMap((object) =>
      object.answerCollection
        ? {
            ...object.answerCollection,
            isShared: object.permissionLevel !== DB.PermissionLevel.OWNER,
            isEditor:
              object.permissionLevel === DB.PermissionLevel.WRITE ||
              object.permissionLevel === DB.PermissionLevel.ADMIN ||
              object.permissionLevel === DB.PermissionLevel.OWNER,
          }
        : []
    ),
    ...templateAnswerCollections
      .filter(
        (collection) => !sharedAnswerCollectionIds.includes(collection.id)
      )
      .map((collection) => ({
        ...collection,
        isShared: false,
        isEditor: false,
      })),
  ]

  // return deduplicated list of answer collections (based on id)
  return combinedAnswerCollections.reduce<
    (DB.AnswerCollection & { entries: DB.AnswerCollectionEntry[] })[]
  >((acc, collection) => {
    if (!acc.some((c) => c.id === collection.id)) {
      acc.push(collection)
    }

    return acc
  }, [])
}

export async function getSingleAnswerCollection(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          _count: { select: { itemUsages: true, templateUsages: true } },
        },
        orderBy: { value: 'asc' },
      },
      permissions: { where: { userId: ctx.user.sub } },
      owner: { select: { shortname: true } },
      _count: { select: { permissions: true } },
    },
  })

  if (!collection || collection.permissions.length === 0) {
    return null
  }

  // return owned collection (editable, etc. if the ownerId is the user's id)
  const permissionLevel = collection.permissions[0]?.permissionLevel
  const isOwner = permissionLevel === DB.PermissionLevel.OWNER
  const isManager =
    permissionLevel === DB.PermissionLevel.ADMIN ||
    permissionLevel === DB.PermissionLevel.OWNER
  const isEditor =
    permissionLevel === DB.PermissionLevel.WRITE ||
    permissionLevel === DB.PermissionLevel.ADMIN ||
    permissionLevel === DB.PermissionLevel.OWNER
  return {
    ...collection,
    entries: collection.entries.map((entry) => ({
      ...entry,
      numSolutionUsages: entry._count.itemUsages + entry._count.templateUsages,
    })),
    numSharedUsers: isManager ? collection._count.permissions - 1 : undefined,
    permissionLevel: permissionLevel ?? DB.PermissionLevel.READ,
    ownerShortname: collection.owner?.shortname,
    isOwner,
    isManager,
    isEditor,
    isShared: permissionLevel !== DB.PermissionLevel.OWNER,
  }
}

export async function getAnswerCollectionsInfo(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
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
                    where: { permissions: { some: { userId: ctx.user.sub } } },
                  },
                  linkedTemplates: {
                    where: {
                      OR: [
                        {
                          liveQuiz: {
                            permissions: { some: { userId: ctx.user.sub } },
                          },
                        },
                        {
                          practiceQuiz: {
                            permissions: { some: { userId: ctx.user.sub } },
                          },
                        },
                        {
                          microLearning: {
                            permissions: { some: { userId: ctx.user.sub } },
                          },
                        },
                        {
                          groupActivity: {
                            permissions: { some: { userId: ctx.user.sub } },
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

  if (!user) {
    return []
  }

  // owned answer collections are included in shared ones through derived permissions with OWNER level
  const collections = user.objects.flatMap((object) => {
    const collection = object.answerCollection

    if (!collection || (object.derived && collection.isDeleted)) {
      return []
    }

    return {
      ...collection,
      numOfEntries: collection._count.entries,
      numSharedUsers: collection._count.permissions - 1,
      permissionLevel: object.permissionLevel,
      ownerShortname: collection.owner?.shortname,
      isOwner: object.permissionLevel === DB.PermissionLevel.OWNER,
      isManager:
        object.permissionLevel === DB.PermissionLevel.ADMIN ||
        object.permissionLevel === DB.PermissionLevel.OWNER,
      isEditor:
        object.permissionLevel === DB.PermissionLevel.WRITE ||
        object.permissionLevel === DB.PermissionLevel.ADMIN ||
        object.permissionLevel === DB.PermissionLevel.OWNER,
      isImported:
        object.permissionLevel === DB.PermissionLevel.OWNER &&
        object.answerCollection?.originalId !== null,
      isShared: object.permissionLevel !== DB.PermissionLevel.OWNER,
      isDeletable:
        collection._count.linkedElements === 0 &&
        collection._count.linkedTemplates === 0,
      isRemovable:
        collection._count.linkedElements === 0 &&
        collection._count.linkedTemplates === 0 &&
        object.permissionLevel !== DB.PermissionLevel.OWNER &&
        !object.derived &&
        object.directPermission?.userGroupId === null,
      sharingType:
        object.permissionLevel === DB.PermissionLevel.OWNER
          ? SharingType.OWNED
          : object.derived
            ? SharingType.DEPENDENCY
            : SharingType.SHARED,
    }
  })

  return collections
}

export async function modifyAnswerCollection(
  {
    id,
    name,
    description,
  }: { id: number; name?: string | null; description?: string | null },
  ctx: ContextWithUser
) {
  // fetch the existing answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
    include: { _count: { select: { permissions: true } } },
  })

  if (!collection) {
    return null
  }

  const updatedCollection = await ctx.prisma.$transaction(async (tx) => {
    // update changes in the database
    const updateResult = await tx.answerCollection.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        version: { increment: 1 },
      },
      include: { entries: true },
    })
    await ensureAnswerCollectionFingerprintCurrent(id, tx)

    // invalidate the answer collection
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: id,
    })

    return {
      ...updateResult,
      numSharedUsers: collection._count.permissions - 1,
    }
  })

  return updatedCollection
}

export async function deleteAnswerCollection(
  { collectionId }: { collectionId: number },
  ctx: ContextWithUser
) {
  // fetch answer collection as owner or admin
  const collectionUser = await ctx.prisma.answerCollection.findUnique({
    where: { id: collectionId },
    include: {
      _count: {
        select: {
          linkedElements: {
            where: { permissions: { some: { userId: ctx.user.sub } } },
          },
          linkedTemplates: {
            where: {
              OR: [
                {
                  liveQuiz: { permissions: { some: { userId: ctx.user.sub } } },
                },
                {
                  practiceQuiz: {
                    permissions: { some: { userId: ctx.user.sub } },
                  },
                },
                {
                  microLearning: {
                    permissions: { some: { userId: ctx.user.sub } },
                  },
                },
                {
                  groupActivity: {
                    permissions: { some: { userId: ctx.user.sub } },
                  },
                },
              ],
            },
          },
          permissions: true,
        },
      },
    },
  })

  // if collection does not exist or is still linked to own elements, do not allow deletion
  if (
    !collectionUser ||
    collectionUser._count.linkedElements > 0 ||
    collectionUser._count.linkedTemplates > 0
  ) {
    return null
  }

  // check if any elements or templates are still linked to the collection (--> soft delete)
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id: collectionId },
    include: {
      _count: { select: { linkedElements: true, linkedTemplates: true } },
    },
  })

  if (!collection) {
    return null
  }

  const remainingLinkedElements = collection._count.linkedElements
  const remainingLinkedTemplates = collection._count.linkedTemplates

  // if there are any elements or templates still linked to the collection, revoke all unused permissions and then soft-delete the collection
  let updatedCollection: DB.AnswerCollection
  if (remainingLinkedElements > 0 || remainingLinkedTemplates > 0) {
    updatedCollection = await ctx.prisma.$transaction(async (prisma) => {
      // ? Remove all access requests
      await prisma.accessRequest.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      // ? Revoke all direct permissions on the answer collection
      // only users with linked elements or templates should retain valid access --> stored in derived permissions
      await prisma.permission.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      // ? Remove all catalog assignments
      await prisma.catalogCollectionAssignment.deleteMany({
        where: { answerCollectionId: collectionId },
      })

      // ? Soft-delete the answer collection
      const updatedAnswerCollection = await prisma.answerCollection.update({
        where: { id: collectionId },
        data: {
          isDeleted: true,
          directPermissions: { deleteMany: {} }, // delete all direct permissions on the activity
        },
      })

      // trigger recomputation of all derived permissions for this answer collection object
      // (required, since some users will retain derived access through linked elements)
      await recomputeDerivedPermissions(
        { answerCollectionId: updatedAnswerCollection.id },
        prisma
      )

      return updatedAnswerCollection
    })
  } else {
    // otherwise delete the collection
    updatedCollection = await ctx.prisma.answerCollection.delete({
      where: { id: collectionId },
    })
  }

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })

  return updatedCollection.id
}

export async function removeAnswerCollection(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch existing permission and collection
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: id,
        userId: ctx.user.sub,
      },
    },
    include: {
      answerCollection: {
        include: {
          _count: {
            select: {
              linkedElements: {
                where: { permissions: { some: { userId: ctx.user.sub } } },
              },
              linkedTemplates: {
                where: {
                  OR: [
                    {
                      liveQuiz: {
                        permissions: { some: { userId: ctx.user.sub } },
                      },
                    },
                    {
                      practiceQuiz: {
                        permissions: { some: { userId: ctx.user.sub } },
                      },
                    },
                    {
                      microLearning: {
                        permissions: { some: { userId: ctx.user.sub } },
                      },
                    },
                    {
                      groupActivity: {
                        permissions: { some: { userId: ctx.user.sub } },
                      },
                    },
                  ],
                },
              },
              // count derived permissions to determine if the collection can be deleted
              // (i.e. if other users still have access to it or not)
              permissions: true,
            },
          },
        },
      },
    },
  })

  // if collection does not exist, is linked to own elements, or does belong to the user, do not allow removal
  const collection = permission?.answerCollection
  if (
    !permission ||
    !collection ||
    collection._count.linkedElements > 0 ||
    collection._count.linkedTemplates > 0 ||
    collection.ownerId === ctx.user.sub // users cannot "remove" an answer collection from their account, but only delete it
  ) {
    return null
  }

  // if no other users have access to this collection and the owner is already soft-deleted, fully delete it
  if (collection._count.permissions === 1 && collection.isDeleted === true) {
    await ctx.prisma.answerCollection.delete({ where: { id: id } })
  } else {
    // otherwise, delete the sharing permission
    await ctx.prisma.$transaction(
      async (prisma) => {
        await prisma.permission.delete({ where: { id: permission.id } })

        // create an audit log entry for the removal
        await prisma.auditLogEntry.create({
          data: {
            type: DB.AuditLogType.PERMISSION_REMOVED,
            objectId: String(id),
            objectType: DB.ObjectType.ANSWER_COLLECTION,
            sourceUserId: ctx.user.sub,
            message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.ANSWER_COLLECTION} (ID: ${id})`,
          },
        })

        // trigger recomputation of derived permissions
        await recomputeDerivedPermissions(
          { answerCollectionId: id, userId: ctx.user.sub },
          prisma
        )
      },
      { timeout: 60000 }
    )
  }

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collection.id,
  })

  return String(collection.id)
}

export async function editAnswerCollectionEntry(
  {
    id,
    value,
    collectionId,
  }: { id: number; value: string; collectionId: number },
  ctx: ContextWithUser
) {
  const updatedEntry = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockAnswerCollectionForDidacticMutation(collectionId, prisma)
      const entry = await prisma.answerCollectionEntry.update({
        where: { id, collectionId },
        data: { value },
      })
      await markAnswerCollectionDidacticChange(collectionId, prisma)
      return entry
    },
    { timeout: 60000 }
  )
  invalidateAnswerCollection(collectionId, ctx)

  return updatedEntry
}

export async function deleteAnswerCollectionEntry(
  { id, collectionId }: { id: number; collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the answer collection entry is not linked to any elements
  const entry = await ctx.prisma.answerCollectionEntry.findUnique({
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

  const updatedEntry = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockAnswerCollectionForDidacticMutation(collectionId, prisma)
      const deletedEntry = await prisma.answerCollectionEntry.delete({
        where: { id },
      })
      await markAnswerCollectionDidacticChange(collectionId, prisma)
      return deletedEntry
    },
    { timeout: 60000 }
  )
  invalidateAnswerCollection(collectionId, ctx)

  return updatedEntry.id
}

export async function addAnswerCollectionOption(
  { collectionId, value }: { collectionId: number; value: string },
  ctx: ContextWithUser
) {
  const newEntry = await ctx.prisma.$transaction(
    async (prisma) => {
      await lockAnswerCollectionForDidacticMutation(collectionId, prisma)
      const entry = await prisma.answerCollectionEntry.create({
        data: {
          value,
          collection: { connect: { id: collectionId } },
        },
      })
      await markAnswerCollectionDidacticChange(collectionId, prisma)
      return entry
    },
    { timeout: 60000 }
  )
  invalidateAnswerCollection(collectionId, ctx)

  return newEntry
}
// #endregion
