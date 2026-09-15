/**
 * Derived permission recomputation for Group Activities in KlickerUZH.
 *
 * Delegates to the shared activity recomputation in ./activity.js;
 * group activities differ from the other activity models only in their Prisma
 * delegate and their log labels.
 */

import type { PrismaTransactionClient } from '../types.js'
import {
  type ActivityPermissionModel,
  recomputeActivityPermissions,
  recomputeActivityPermissionsObject,
  recomputeActivityPermissionsUser,
} from './activity.js'

const groupActivityModel: ActivityPermissionModel = {
  label: 'group activity',
  notFoundLabel: 'Group activity',
  idField: 'groupActivityId',
  fetchForUser: async (prisma, id, userId) => {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: {
        id,
      },
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
        // course from which derived permissions would be inherited
        course: {
          include: {
            permissions: {
              where: {
                userId,
              },
              include: {
                directPermission: true,
              },
            },
          },
        },
        // element instances (with elementId on them) contained in this activity to propagate the derived permission update to elements
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })
    if (!groupActivity) {
      return null
    }
    return {
      ownerId: groupActivity.ownerId,
      isDeleted: groupActivity.isDeleted,
      directPermissions: groupActivity.directPermissions,
      course: groupActivity.course,
      stacks: groupActivity.stacks,
    }
  },
  fetchForObject: async (prisma, id) => {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: {
        id,
      },
      include: {
        directPermissions: {
          include: {
            userGroup: {
              include: {
                members: true,
                admins: true,
              },
            },
          },
        },
        // course from which derived permissions would be inherited
        course: {
          include: {
            permissions: {
              include: {
                directPermission: true,
              },
            },
          },
        },
        // element instances contained in the activity to propagate the derived permission update to elements
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })
    if (!groupActivity) {
      return null
    }
    return {
      ownerId: groupActivity.ownerId,
      isDeleted: groupActivity.isDeleted,
      directPermissions: groupActivity.directPermissions,
      course: groupActivity.course,
      stacks: groupActivity.stacks,
    }
  },
  accessRequestScope: (id) => ({ groupActivityId: id }),
}

/**
 * Dispatch function for the recomputation of derived permissions for group activities.
 *
 * Delegates to either user-specific or object-wide permission
 * recomputation based on the provided parameters.
 */
export async function recomputeGroupActivityPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: {
    id: string
    userId?: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  return await recomputeActivityPermissions(
    { id, userId, updateAccessRequests },
    prisma,
    groupActivityModel
  )
}

/**
 * Recomputes derived permissions for a specific user on a group activities (see
 * the shared implementation in ./activity.js for the considered sources).
 */
export async function recomputeGroupActivityPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  return await recomputeActivityPermissionsUser(
    { id, userId, updateAccessRequests },
    prisma,
    groupActivityModel
  )
}

/**
 * Recomputes derived permissions for all users on a group activities (see the
 * shared implementation in ./activity.js for the considered sources).
 */
export async function recomputeGroupActivityPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  return await recomputeActivityPermissionsObject(
    { id, updateAccessRequests },
    prisma,
    groupActivityModel
  )
}
