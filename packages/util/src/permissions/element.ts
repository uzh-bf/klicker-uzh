/**
 * Derived permission recomputation for Elements in KlickerUZH:
 * - recomputeElementPermissions: dispatches to user/object variant.
 * - recomputeElementPermissionsUser: recompute derived permissions for a specific user.
 * - recomputeElementPermissionsObject: recompute derived permissions for all users.
 */

import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  recomputeAnswerCollectionPermissionsObject,
  recomputeAnswerCollectionPermissionsUser,
} from './answerCollection.js'

async function recomputeElementPermissionsSetBased(
  { id, userId }: { id: number; userId?: string },
  prisma: PrismaTransactionClient
) {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      WITH target_scope AS (
        SELECT ${userId ?? null}::uuid AS "userId"
      ),
      target_element AS (
        SELECT
          element."id",
          element."ownerId",
          element."isDeleted"
        FROM "Element" element
        WHERE element."id" = ${id}
      ),
      expanded_group_users AS (
        SELECT
          permission."id" AS "permissionId",
          group_data."ownerId" AS "userId"
        FROM "Permission" permission
        INNER JOIN "UserGroup" group_data
          ON group_data."id" = permission."userGroupId"
        WHERE permission."elementId" = ${id}
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          members."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupMembers" members
          ON members."B" = permission."userGroupId"
        WHERE permission."elementId" = ${id}
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          admins."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupAdmins" admins
          ON admins."B" = permission."userGroupId"
        WHERE permission."elementId" = ${id}
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
        WHERE permission."elementId" = ${id}
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
          expanded_permissions."propagation",
          expanded_permissions."permissionId"::text AS "sourceKey"
        FROM expanded_permissions
        CROSS JOIN target_element
        WHERE NOT target_element."isDeleted"
      ),
      activity_permissions AS (
        SELECT
          permission."userId",
          permission."permissionLevel",
          permission."directPermissionId",
          'LIVE_QUIZ:' || block."liveQuizId"::text || ':' || instance."id"::text
            AS "sourceKey"
        FROM "ElementInstance" instance
        INNER JOIN "ElementBlock" block
          ON block."id" = instance."elementBlockId"
        INNER JOIN "DerivedPermission" permission
          ON permission."liveQuizId" = block."liveQuizId"
        CROSS JOIN target_scope
        WHERE instance."elementId" = ${id}
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          permission."permissionLevel",
          permission."directPermissionId",
          'PRACTICE_QUIZ:' || stack."practiceQuizId"::text || ':' || instance."id"::text
            AS "sourceKey"
        FROM "ElementInstance" instance
        INNER JOIN "ElementStack" stack
          ON stack."id" = instance."elementStackId"
        INNER JOIN "DerivedPermission" permission
          ON permission."practiceQuizId" = stack."practiceQuizId"
        CROSS JOIN target_scope
        WHERE instance."elementId" = ${id}
          AND stack."practiceQuizId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          permission."permissionLevel",
          permission."directPermissionId",
          'MICROLEARNING:' || stack."microLearningId"::text || ':' || instance."id"::text
            AS "sourceKey"
        FROM "ElementInstance" instance
        INNER JOIN "ElementStack" stack
          ON stack."id" = instance."elementStackId"
        INNER JOIN "DerivedPermission" permission
          ON permission."microLearningId" = stack."microLearningId"
        CROSS JOIN target_scope
        WHERE instance."elementId" = ${id}
          AND stack."microLearningId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          permission."permissionLevel",
          permission."directPermissionId",
          'GROUP_ACTIVITY:' || stack."groupActivityId"::text || ':' || instance."id"::text
            AS "sourceKey"
        FROM "ElementInstance" instance
        INNER JOIN "ElementStack" stack
          ON stack."id" = instance."elementStackId"
        INNER JOIN "DerivedPermission" permission
          ON permission."groupActivityId" = stack."groupActivityId"
        CROSS JOIN target_scope
        WHERE instance."elementId" = ${id}
          AND stack."groupActivityId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )
      ),
      activity_candidates AS (
        SELECT
          activity_permissions."userId",
          CASE activity_permissions."permissionLevel"
            WHEN 'OWNER' THEN 'ADMIN'::"PermissionLevel"
            WHEN 'ADMIN' THEN 'ADMIN'::"PermissionLevel"
            WHEN 'WRITE' THEN 'WRITE'::"PermissionLevel"
            WHEN 'EXECUTE' THEN 'READ'::"PermissionLevel"
            WHEN 'READ' THEN 'READ'::"PermissionLevel"
          END AS "permissionLevel",
          activity_permissions."directPermissionId",
          true AS "derived",
          'ACTIVITY'::text AS "sourceType",
          false AS "propagation",
          activity_permissions."sourceKey"
        FROM activity_permissions
        LEFT JOIN "Permission" direct_permission
          ON direct_permission."id" = activity_permissions."directPermissionId"
        WHERE
          activity_permissions."permissionLevel" IN ('OWNER', 'ADMIN')
          OR (
            activity_permissions."permissionLevel" IN ('READ', 'EXECUTE', 'WRITE')
            AND direct_permission."propagation"
            AND (
              direct_permission."liveQuizId" IS NOT NULL
              OR direct_permission."practiceQuizId" IS NOT NULL
              OR direct_permission."microLearningId" IS NOT NULL
              OR direct_permission."groupActivityId" IS NOT NULL
            )
          )
      ),
      candidates AS (
        SELECT
          target_element."ownerId" AS "userId",
          'OWNER'::"PermissionLevel" AS "permissionLevel",
          NULL::integer AS "directPermissionId",
          false AS "derived",
          'OWNER'::text AS "sourceType",
          false AS "propagation",
          ''::text AS "sourceKey"
        FROM target_element
        CROSS JOIN target_scope
        WHERE NOT target_element."isDeleted"
          AND (
            target_scope."userId" IS NULL
            OR target_element."ownerId" = target_scope."userId"
          )

        UNION ALL

        SELECT * FROM direct_candidates

        UNION ALL

        SELECT * FROM activity_candidates
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
              CASE
                WHEN candidates."sourceType" = 'OWNER' THEN 0
                WHEN
                  candidates."permissionLevel" = 'ADMIN'
                  AND candidates."sourceType" = 'DIRECT'
                THEN 1
                WHEN candidates."sourceType" = 'ACTIVITY' THEN 2
                ELSE 3
              END,
              candidates."propagation" DESC,
              CASE
                WHEN candidates."sourceType" = 'DIRECT'
                THEN candidates."directPermissionId"
              END DESC,
              candidates."sourceKey"
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
        USING target_element, target_scope
        WHERE derived_permission."elementId" = target_element."id"
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
        "elementId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        desired_permissions."permissionLevel",
        desired_permissions."directPermissionId",
        desired_permissions."derived",
        desired_permissions."userId",
        ${id},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM desired_permissions
      ON CONFLICT ("elementId", "userId")
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
 * Dispatch function for the recomputation of derived permissions for elements.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for elements.
 *
 * @param params - Object containing element ID and optional user ID
 * @param params.id - ID of the element
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: {
    id: number
    userId?: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeElementPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeElementPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on an element.
 *
 * The set-based recomputation updates or removes only the selected user's row,
 * choosing the highest permission from these sources:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the element
 * - any derived permission granted to the individual user on an activity where
 *   an instance of the element is included, according to the following rules:
 *   propagated READ / EXECUTE on activity --> READ on element
 *   propagated WRITE on activity --> WRITE on element
 *   ADMIN on activity --> ADMIN on element
 *   OWNER on activity --> ADMIN on element
 *
 * The reason behind the last rule is that the sharing of activities, which is
 * allowed with >= ADMIN permissions, with a sufficiently high permission level
 * implicitly also results in the sharing of the associated elements. To ensure
 * consistency with the permission levels and sharing activities on elements, the
 * users therefore need to be granted at least ADMIN permissions on the element.
 *
 * Additionally, if the element is linked to an answer collection, all derived
 * permissions on the latter are recomputed for the user.
 *
 * @param params - Object containing element ID and user ID
 * @param params.id - ID of the element
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const targetElement = await prisma.element.findUnique({
    where: { id },
    select: { isDeleted: true, answerCollectionId: true },
  })

  if (!targetElement) {
    return
  }

  await recomputeElementPermissionsSetBased({ id, userId }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { elementId: id, userId, objectSoftDeleted: targetElement.isDeleted },
      prisma
    )
  }

  if (targetElement.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsUser(
      { id: targetElement.answerCollectionId, userId, updateAccessRequests },
      prisma
    )
  }
}

/**
 * Recomputes derived permissions for all users on an element.
 *
 * The set-based recomputation converges all rows for the element, choosing the
 * highest permission per user from these sources:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the element
 * - derived permissions granted to users on activities where an instance of
 *   the element is included, according to the same rules as for the user-specific
 *   derived permissions recomputation for elements (see above).
 *
 *
 * The reason behind the last rule is that the sharing of activities, which is
 * allowed with >= ADMIN permissions, with a sufficiently high permission level
 * implicitly also results in the sharing of the associated elements. To ensure
 * consistency with the permission levels and sharing activities on elements, the
 * users therefore need to be granted at least ADMIN permissions on the element.
 *
 * Additionally, if the element is linked to an answer collection, all derived
 * permissions on the latter are recomputed.
 *
 * @param params - Object containing element ID
 * @param params.id - ID of the element
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissionsObject(
  { id, updateAccessRequests }: { id: number; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const targetElement = await prisma.element.findUnique({
    where: { id },
    select: { isDeleted: true, answerCollectionId: true },
  })

  if (!targetElement) {
    console.error(`Element with id ${id} not found`)
    return
  }

  await recomputeElementPermissionsSetBased({ id }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { elementId: id, objectSoftDeleted: targetElement.isDeleted },
      prisma
    )
  }

  if (targetElement.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsObject(
      { id: targetElement.answerCollectionId, updateAccessRequests },
      prisma
    )
  }
}
