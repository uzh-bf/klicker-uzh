/**
 * Derived permission recomputation for Practice Quizzes in KlickerUZH.
 *
 * Delegates to the shared activity recomputation in ./activity.js;
 * practice quizzes differ from the other activity models only in their Prisma
 * delegate and their log labels.
 */

import type { PrismaTransactionClient } from '../types.js'
import {
  type ActivityPermissionModel,
  recomputeActivityPermissions,
  recomputeActivityPermissionsObject,
  recomputeActivityPermissionsUser,
} from './activity.js'

const practiceQuizModel: ActivityPermissionModel = {
  label: 'practice quiz',
  notFoundLabel: 'Practice quiz',
  idField: 'practiceQuizId',
  fetchForUser: async (prisma, id, userId) => {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
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
    if (!practiceQuiz) {
      return null
    }
    return {
      ownerId: practiceQuiz.ownerId,
      isDeleted: practiceQuiz.isDeleted,
      directPermissions: practiceQuiz.directPermissions,
      course: practiceQuiz.course,
      stacks: practiceQuiz.stacks,
    }
  },
  fetchForObject: async (prisma, id) => {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
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
    if (!practiceQuiz) {
      return null
    }
    return {
      ownerId: practiceQuiz.ownerId,
      isDeleted: practiceQuiz.isDeleted,
      directPermissions: practiceQuiz.directPermissions,
      course: practiceQuiz.course,
      stacks: practiceQuiz.stacks,
    }
  },
  accessRequestScope: (id) => ({ practiceQuizId: id }),
}

/**
 * Dispatch function for the recomputation of derived permissions for practice quizzes.
 *
 * Delegates to either user-specific or object-wide permission
 * recomputation based on the provided parameters.
 */
export async function recomputePracticeQuizPermissions(
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
    practiceQuizModel
  )
}

/**
 * Recomputes derived permissions for a specific user on a practice quizzes (see
 * the shared implementation in ./activity.js for the considered sources).
 */
export async function recomputePracticeQuizPermissionsUser(
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
    practiceQuizModel
  )
}

/**
 * Recomputes derived permissions for all users on a practice quizzes (see the
 * shared implementation in ./activity.js for the considered sources).
 */
export async function recomputePracticeQuizPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  return await recomputeActivityPermissionsObject(
    { id, updateAccessRequests },
    prisma,
    practiceQuizModel
  )
}
