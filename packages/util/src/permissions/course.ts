/**
 * Derived permission recomputation for Courses in KlickerUZH:
 * - recomputeCoursePermissions: dispatches to user/object variant.
 * - recomputeCoursePermissionsUser: recompute derived permissions for a specific user.
 * - recomputeCoursePermissionsObject: recompute derived permissions for all users.
 */

import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  recomputeGroupActivityPermissionsObject,
  recomputeGroupActivityPermissionsUser,
} from './groupActivity.js'
import {
  recomputeLiveQuizPermissionsObject,
  recomputeLiveQuizPermissionsUser,
} from './liveQuiz.js'
import {
  recomputeMicroLearningPermissionsObject,
  recomputeMicroLearningPermissionsUser,
} from './microlearning.js'
import {
  recomputePracticeQuizPermissionsObject,
  recomputePracticeQuizPermissionsUser,
} from './practiceQuiz.js'

async function recomputeCoursePermissionsSetBased(
  { id, userId }: { id: string; userId?: string },
  prisma: PrismaTransactionClient
) {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      WITH target_scope AS (
        SELECT ${userId ?? null}::uuid AS "userId"
      ),
      target_course AS (
        SELECT course."id", course."ownerId"
        FROM "Course" course
        WHERE course."id" = ${id}::uuid
      ),
      expanded_group_users AS (
        SELECT
          permission."id" AS "permissionId",
          group_data."ownerId" AS "userId"
        FROM "Permission" permission
        INNER JOIN "UserGroup" group_data
          ON group_data."id" = permission."userGroupId"
        WHERE permission."courseId" = ${id}::uuid
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          members."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupMembers" members
          ON members."B" = permission."userGroupId"
        WHERE permission."courseId" = ${id}::uuid
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          admins."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupAdmins" admins
          ON admins."B" = permission."userGroupId"
        WHERE permission."courseId" = ${id}::uuid
          AND permission."userId" IS NULL
      ),
      expanded_permissions AS (
        SELECT
          permission."id" AS "permissionId",
          permission."permissionLevel",
          permission."propagation",
          permission."userId"
        FROM "Permission" permission
        CROSS JOIN target_scope
        WHERE permission."courseId" = ${id}::uuid
          AND permission."userId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."id" AS "permissionId",
          permission."permissionLevel",
          permission."propagation",
          expanded_group_users."userId"
        FROM expanded_group_users
        INNER JOIN "Permission" permission
          ON permission."id" = expanded_group_users."permissionId"
        CROSS JOIN target_scope
        WHERE target_scope."userId" IS NULL
          OR expanded_group_users."userId" = target_scope."userId"
      ),
      candidates AS (
        SELECT
          target_course."ownerId" AS "userId",
          'OWNER'::"PermissionLevel" AS "permissionLevel",
          NULL::integer AS "directPermissionId",
          'OWNER'::text AS "sourceType",
          false AS "propagation"
        FROM target_course
        CROSS JOIN target_scope
        WHERE target_scope."userId" IS NULL
          OR target_course."ownerId" = target_scope."userId"

        UNION ALL

        SELECT
          expanded_permissions."userId",
          expanded_permissions."permissionLevel",
          expanded_permissions."permissionId" AS "directPermissionId",
          'DIRECT'::text AS "sourceType",
          expanded_permissions."propagation"
        FROM expanded_permissions
        CROSS JOIN target_course
      ),
      ranked_candidates AS (
        SELECT
          candidates.*,
          ROW_NUMBER() OVER (
            PARTITION BY candidates."userId"
            ORDER BY
              CASE candidates."permissionLevel"
                WHEN 'OWNER' THEN 5
                WHEN 'ADMIN' THEN 4
                WHEN 'WRITE' THEN 3
                WHEN 'EXECUTE' THEN 2
                WHEN 'READ' THEN 1
              END DESC,
              CASE candidates."sourceType"
                WHEN 'OWNER' THEN 0
                ELSE 1
              END,
              candidates."propagation" DESC,
              candidates."directPermissionId" DESC NULLS LAST
          ) AS "permissionRank"
        FROM candidates
      ),
      desired_permissions AS (
        SELECT
          ranked_candidates."userId",
          ranked_candidates."permissionLevel",
          ranked_candidates."directPermissionId"
        FROM ranked_candidates
        WHERE ranked_candidates."permissionRank" = 1
      ),
      deleted_permissions AS (
        DELETE FROM "DerivedPermission" derived_permission
        USING target_course, target_scope
        WHERE derived_permission."courseId" = target_course."id"
          AND (
            target_scope."userId" IS NULL
            OR derived_permission."userId" = target_scope."userId"
          )
          AND NOT EXISTS (
            SELECT 1
            FROM desired_permissions
            WHERE desired_permissions."userId" = derived_permission."userId"
          )
      )
      INSERT INTO "DerivedPermission" (
        "permissionLevel",
        "directPermissionId",
        "derived",
        "userId",
        "courseId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        desired_permissions."permissionLevel",
        desired_permissions."directPermissionId",
        false,
        desired_permissions."userId",
        ${id}::uuid,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM desired_permissions
      ON CONFLICT ("courseId", "userId")
      DO UPDATE SET
        "permissionLevel" = EXCLUDED."permissionLevel",
        "directPermissionId" = EXCLUDED."directPermissionId",
        "derived" = EXCLUDED."derived",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "DerivedPermission"."permissionLevel" IS DISTINCT FROM EXCLUDED."permissionLevel"
        OR "DerivedPermission"."directPermissionId" IS DISTINCT FROM EXCLUDED."directPermissionId"
        OR "DerivedPermission"."derived" IS DISTINCT FROM EXCLUDED."derived"
    `
  )
}

// #region
/**
 * Dispatch function for the recomputation of derived permissions for courses.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for courses.
 *
 * @param params - Object containing course ID and optional user ID
 * @param params.id - ID of the course
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissions(
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
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeCoursePermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeCoursePermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a course.
 *
 * The set-based recomputation updates or removes only the selected user's row,
 * choosing the highest permission from these sources:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the course
 *
 * Additionally, a recomputation of the derived permissions on all activities
 * contained in the course is triggered (recursively also affecting contained
 * elements and resources)
 *
 * @param params - Object containing course ID and user ID
 * @param params.id - ID of the course
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      liveQuizzes: { select: { id: true } },
      practiceQuizzes: { select: { id: true } },
      microLearnings: { select: { id: true } },
      groupActivities: { select: { id: true } },
    },
  })

  if (!course) {
    return
  }

  await recomputeCoursePermissionsSetBased({ id, userId }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances({ courseId: id, userId }, prisma)
  }

  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsUser(
      { id: liveQuiz.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsUser(
      { id: practiceQuiz.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsUser(
      { id: microLearning.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsUser(
      { id: groupActivity.id, userId, updateAccessRequests },
      prisma
    )
  }
}

/**
 * Recomputes derived permissions for all users on a course.
 *
 * The set-based recomputation converges all rows for the course, choosing the
 * highest permission per user from these sources:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the course
 *
 * Additionally, a recomputation of the derived permissions on all activities
 * contained in the course is triggered.
 *
 * @param params - Object containing course ID
 * @param params.id - ID of the course
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      liveQuizzes: { select: { id: true } },
      practiceQuizzes: { select: { id: true } },
      microLearnings: { select: { id: true } },
      groupActivities: { select: { id: true } },
    },
  })

  if (!course) {
    console.error(`Course with id ${id} not found`)
    return
  }

  await recomputeCoursePermissionsSetBased({ id }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances({ courseId: id }, prisma)
  }

  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsObject(
      { id: liveQuiz.id, updateAccessRequests },
      prisma
    )
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsObject(
      { id: practiceQuiz.id, updateAccessRequests },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsObject(
      { id: microLearning.id, updateAccessRequests },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsObject(
      { id: groupActivity.id, updateAccessRequests },
      prisma
    )
  }
}
