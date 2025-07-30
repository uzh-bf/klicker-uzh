import * as DB from '@klicker-uzh/prisma'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import { inversePermissionLevelMap } from './constants.js'
import { getMaxAccessLevelIndividual } from './util.js'

/**
 * Recomputes derived permissions for a specific user on an answer collection.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the answer collection
 * - any derived permission granted to the individual user on an element that is
 *   linked to the answer collection (selection / case study question)
 *   --> READ permissions on the answer collection
 * - any derived permission granted to the individual user on an activity template
 *   that is linked to the answer collection
 *   --> READ permissions on the answer collection
 *
 * @param params - Object containing answer collection ID and user ID
 * @param params.id - ID of the answer collection
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function processPendingPermissionAnswerCollection(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // check for ownership, direct permissions or links to other objects that would imply derived permissions
  const answerCollection = await prisma.answerCollection.findUnique({
    where: { id },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            {
              userGroup: {
                OR: [
                  { ownerId: userId },
                  { members: { some: { id: userId } } },
                  { admins: { some: { id: userId } } },
                ],
              },
            },
          ],
        },
      },
      linkedElements: {
        where: { permissions: { some: { userId } } },
        include: { permissions: { where: { userId } } },
      },
      linkedTemplates: {
        where: {
          OR: [
            {
              liveQuiz: { permissions: { some: { userId } } },
              practiceQuiz: { permissions: { some: { userId } } },
              microLearning: { permissions: { some: { userId } } },
              groupActivity: { permissions: { some: { userId } } },
            },
          ],
        },
        include: {
          liveQuiz: { include: { permissions: { where: { userId } } } },
          practiceQuiz: { include: { permissions: { where: { userId } } } },
          microLearning: { include: { permissions: { where: { userId } } } },
          groupActivity: { include: { permissions: { where: { userId } } } },
        },
      },
    },
  })

  // if the answer collection does not exist, return
  if (!answerCollection) {
    return
  }

  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: id,
        userId,
      },
    },
  })

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  // if user is answer collection owner, set the corresponding permission
  if (answerCollection.ownerId === userId && !answerCollection.isDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    answerCollection.directPermissions.length > 0 ||
    answerCollection.linkedElements.length > 0 ||
    answerCollection.linkedTemplates.length > 0
  ) {
    // if the object is soft-deleted, not direct permissions are valid anymore
    if (
      answerCollection.directPermissions.length > 0 &&
      !answerCollection.isDeleted
    ) {
      // determine the highest available direct permission level
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: answerCollection.directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }
    // if the user does not have direct access to the answer collection, but has access to linked elements -> derived permission
    // if direct access was granted, inherited permissions do not need to be considered -> can only be READ level for answer collections
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedElements.length > 0 &&
      typeof answerCollection.linkedElements[0] !== 'undefined'
    ) {
      const element = answerCollection.linkedElements[0]!

      // if the user has more than one derived permission on the linked element, something went wrong
      if (element.permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for answer collection ${id} (id) and a single user ${userId} (id).`
        )
      }

      // use the permission of the linked element to set the derived permission
      const permissionLinkedElement = element.permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedElement?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
    // derived permissions based on template usage
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedTemplates.length > 0 &&
      typeof answerCollection.linkedTemplates[0] !== 'undefined'
    ) {
      const template = answerCollection.linkedTemplates[0]!
      const permissions =
        template.liveQuiz?.permissions ??
        template.practiceQuiz?.permissions ??
        template.microLearning?.permissions ??
        template.groupActivity?.permissions ??
        []

      // if the user has more than one derived permission on the linked template, something went wrong
      if (permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for tmeplate ${template.id} (id) and a single user ${userId} (id).`
        )
      }

      const permissionLinkedTemplate = permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedTemplate?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
  }

  // if the user still has access, add a corresponding derived permission
  if (
    typeof maxAccessLevel !== 'undefined' &&
    (!existingPermission ||
      existingPermission.permissionLevel !== maxAccessLevel ||
      existingPermission.derived !== derived ||
      existingPermission.directPermissionId !== parentPermissionId)
  ) {
    await prisma.derivedPermission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: id,
          userId,
        },
      },
      create: {
        permissionLevel: maxAccessLevel,
        derived,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        answerCollection: { connect: { id } },
        user: { connect: { id: userId } },
      },
      update: {
        permissionLevel: maxAccessLevel,
        derived,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : { disconnect: true },
      },
    })
  }
  // if a derived permission exists, remove it
  else if (existingPermission && typeof maxAccessLevel === 'undefined') {
    await prisma.derivedPermission.delete({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    // TODO: migrate this to hatchet-based solution as well
    await updateAccessRequestInstances(
      {
        answerCollectionId: id,
        userId,
        objectSoftDeleted: answerCollection.isDeleted,
      },
      prisma
    )
  }

  return
}
