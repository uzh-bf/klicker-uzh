/**
 * Derived permission recomputation for Practice Quizzes in KlickerUZH:
 * - recomputePracticeQuizPermissions: dispatches to user/object variant.
 * - recomputePracticeQuizPermissionsUser: recompute derived permissions for a specific user.
 * - recomputePracticeQuizPermissionsObject: recompute derived permissions for all users.
 */

import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  propagateActivityToElements,
  propagateActivityToElementsUser,
} from './util.js'

async function recomputePracticeQuizPermissionsSetBased(
  { id, userId }: { id: string; userId?: string },
  prisma: PrismaTransactionClient
) {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      WITH target_scope AS (
        SELECT ${userId ?? null}::uuid AS "userId"
      ),
      target_activity AS (
        SELECT
          activity."id",
          activity."ownerId",
          activity."isDeleted",
          activity."courseId"
        FROM "PracticeQuiz" activity
        WHERE activity."id" = ${id}::uuid
      ),
      expanded_group_users AS (
        SELECT
          permission."id" AS "permissionId",
          group_data."ownerId" AS "userId"
        FROM "Permission" permission
        INNER JOIN "UserGroup" group_data
          ON group_data."id" = permission."userGroupId"
        WHERE permission."practiceQuizId" = ${id}::uuid
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          members."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupMembers" members
          ON members."B" = permission."userGroupId"
        WHERE permission."practiceQuizId" = ${id}::uuid
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          admins."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupAdmins" admins
          ON admins."B" = permission."userGroupId"
        WHERE permission."practiceQuizId" = ${id}::uuid
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
        WHERE permission."practiceQuizId" = ${id}::uuid
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
      direct_candidates AS (
        SELECT
          expanded_permissions."userId",
          expanded_permissions."permissionLevel",
          expanded_permissions."permissionId" AS "directPermissionId",
          false AS "derived",
          'DIRECT'::text AS "sourceType",
          expanded_permissions."propagation"
        FROM expanded_permissions
        CROSS JOIN target_activity
        WHERE NOT target_activity."isDeleted"
      ),
      course_candidates AS (
        SELECT
          course_permission."userId",
          CASE course_permission."permissionLevel"
            WHEN 'OWNER' THEN 'ADMIN'::"PermissionLevel"
            WHEN 'ADMIN' THEN 'ADMIN'::"PermissionLevel"
            WHEN 'WRITE' THEN
              CASE
                WHEN direct_permission."propagation"
                THEN 'WRITE'::"PermissionLevel"
                ELSE 'EXECUTE'::"PermissionLevel"
              END
            WHEN 'EXECUTE' THEN 'EXECUTE'::"PermissionLevel"
            WHEN 'READ' THEN 'READ'::"PermissionLevel"
          END AS "permissionLevel",
          course_permission."directPermissionId",
          true AS "derived",
          'COURSE'::text AS "sourceType",
          false AS "propagation"
        FROM target_activity
        INNER JOIN "DerivedPermission" course_permission
          ON course_permission."courseId" = target_activity."courseId"
        LEFT JOIN "Permission" direct_permission
          ON direct_permission."id" = course_permission."directPermissionId"
        CROSS JOIN target_scope
        WHERE (
            target_scope."userId" IS NULL
            OR course_permission."userId" = target_scope."userId"
          )
          AND (
            course_permission."permissionLevel" = 'OWNER'
            OR direct_permission."id" IS NOT NULL
          )
      ),
      candidates AS (
        SELECT
          target_activity."ownerId" AS "userId",
          'OWNER'::"PermissionLevel" AS "permissionLevel",
          NULL::integer AS "directPermissionId",
          false AS "derived",
          'OWNER'::text AS "sourceType",
          false AS "propagation"
        FROM target_activity
        CROSS JOIN target_scope
        WHERE NOT target_activity."isDeleted"
          AND (
            target_scope."userId" IS NULL
            OR target_activity."ownerId" = target_scope."userId"
          )

        UNION ALL

        SELECT * FROM direct_candidates

        UNION ALL

        SELECT * FROM course_candidates
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
                WHEN 'DIRECT' THEN 1
                ELSE 2
              END,
              candidates."propagation" DESC,
              CASE
                WHEN candidates."sourceType" = 'DIRECT'
                THEN candidates."directPermissionId"
              END DESC
          ) AS "permissionRank"
        FROM candidates
      ),
      desired_permissions AS (
        SELECT
          ranked_candidates."userId",
          ranked_candidates."permissionLevel",
          ranked_candidates."directPermissionId",
          ranked_candidates."derived"
        FROM ranked_candidates
        WHERE ranked_candidates."permissionRank" = 1
      ),
      deleted_permissions AS (
        DELETE FROM "DerivedPermission" derived_permission
        USING target_activity, target_scope
        WHERE derived_permission."practiceQuizId" = target_activity."id"
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
        "practiceQuizId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        desired_permissions."permissionLevel",
        desired_permissions."directPermissionId",
        desired_permissions."derived",
        desired_permissions."userId",
        ${id}::uuid,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM desired_permissions
      ON CONFLICT ("practiceQuizId", "userId")
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

/**
 * Dispatch function for the recomputation of derived permissions for practice quizzes.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for practice quizzes.
 *
 * @param params - Object containing practice quiz ID and optional user ID
 * @param params.id - ID of the practice quiz
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
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
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputePracticeQuizPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputePracticeQuizPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a practice quiz.
 *
 * The set-based recomputation updates or removes only the selected user's row,
 * choosing the highest permission from these sources:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the practice quiz
 * - any derived permission granted to the individual user on a course that
 *   includes the considered practice quiz:
 *   READ maps to READ, non-propagating WRITE maps to EXECUTE, propagating
 *   WRITE maps to WRITE, EXECUTE maps to EXECUTE, and ADMIN/OWNER map to ADMIN.
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing practice quiz ID and user ID
 * @param params.id - ID of the practice quiz
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePracticeQuizPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
    where: { id },
    select: {
      isDeleted: true,
      stacks: {
        select: { elements: true },
      },
    },
  })

  if (!practiceQuiz) {
    return
  }

  await recomputePracticeQuizPermissionsSetBased({ id, userId }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { practiceQuizId: id, userId, objectSoftDeleted: practiceQuiz.isDeleted },
      prisma
    )
  }

  await propagateActivityToElementsUser(
    { stacks: practiceQuiz.stacks, userId, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for all users on a practice quiz.
 *
 * The set-based recomputation converges all rows for the practice quiz, choosing
 * the highest permission per user from these sources:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the practice quiz
 * - derived permissions granted to users on a course that includes the considered
 *   practice quiz, according to the same rules as for the user-specific derived
 *   permissions recomputation for live quizzes (see above).
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing practice quiz ID
 * @param params.id - ID of the practice quiz
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePracticeQuizPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
    where: { id },
    select: {
      isDeleted: true,
      stacks: {
        select: { elements: true },
      },
    },
  })

  if (!practiceQuiz) {
    console.error(
      `Practice quiz with id ${id} or corresponding owner not found`
    )
    return
  }

  await recomputePracticeQuizPermissionsSetBased({ id }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { practiceQuizId: id, objectSoftDeleted: practiceQuiz.isDeleted },
      prisma
    )
  }

  await propagateActivityToElements(
    { stacks: practiceQuiz.stacks, updateAccessRequests },
    prisma
  )
}
