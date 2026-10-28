/**
 * Derived permission recomputation for Microlearnings in KlickerUZH.
 *
 * Delegates to the shared activity recomputation in ./activity.js;
 * microlearnings differ from the other activity models only in their Prisma
 * delegate and their log labels.
 */

import type { PrismaTransactionClient } from '../types.js'
import {
  type ActivityPermissionModel,
  recomputeActivityPermissions,
  recomputeActivityPermissionsObject,
  recomputeActivityPermissionsUser,
} from './activity.js'

const microLearningModel: ActivityPermissionModel = {
  label: 'microlearning',
  notFoundLabel: 'Microlearning',
  idField: 'microLearningId',
  fetchForUser: async (prisma, id, userId) => {
    const microLearning = await prisma.microLearning.findUnique({
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
    if (!microLearning) {
      return null
    }
    return {
      ownerId: microLearning.ownerId,
      isDeleted: microLearning.isDeleted,
      directPermissions: microLearning.directPermissions,
      course: microLearning.course,
      stacks: microLearning.stacks,
    }
  },
  fetchForObject: async (prisma, id) => {
    const microLearning = await prisma.microLearning.findUnique({
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
    if (!microLearning) {
      return null
    }
    return {
      ownerId: microLearning.ownerId,
      isDeleted: microLearning.isDeleted,
      directPermissions: microLearning.directPermissions,
      course: microLearning.course,
      stacks: microLearning.stacks,
    }
  },
  accessRequestScope: (id) => ({ microLearningId: id }),
}

/**
 * Dispatch function for the recomputation of derived permissions for microlearnings.
 *
 * Delegates to either user-specific or object-wide permission
 * recomputation based on the provided parameters.
 */
export async function recomputeMicroLearningPermissions(
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
    microLearningModel
  )
}

/**
 * Recomputes derived permissions for a specific user on a microlearnings (see
 * the shared implementation in ./activity.js for the considered sources).
 */
export async function recomputeMicroLearningPermissionsUser(
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
    microLearningModel
  )
}

/**
 * Recomputes derived permissions for all users on a microlearnings (see the
 * shared implementation in ./activity.js for the considered sources).
 */
export async function recomputeMicroLearningPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  return await recomputeActivityPermissionsObject(
    { id, updateAccessRequests },
    prisma,
    microLearningModel
  )
}
