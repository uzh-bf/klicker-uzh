/**
 * Derived permission recomputation for Answer Collections in KlickerUZH:
 * - recomputeAnswerCollectionPermissions: dispatches to user/object variant.
 * - recomputeAnswerCollectionPermissionsUser: recompute derived permissions for a single user.
 * - recomputeAnswerCollectionPermissionsObject: recompute derived permissions for all users.
 */
import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'

async function recomputeAnswerCollectionPermissionsSetBased(
  { id, userId }: { id: number; userId?: string },
  prisma: PrismaTransactionClient
) {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      WITH target_scope AS (
        SELECT ${userId ?? null}::uuid AS "userId"
      ),
      answer_collection AS (
        SELECT collection."id", collection."ownerId", collection."isDeleted"
        FROM "AnswerCollection" collection
        WHERE collection."id" = ${id}
      ),
      expanded_group_users AS (
        SELECT
          permission."id" AS "permissionId",
          group_data."ownerId" AS "userId"
        FROM "Permission" permission
        INNER JOIN "UserGroup" group_data
          ON group_data."id" = permission."userGroupId"
        WHERE permission."answerCollectionId" = ${id}
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          members."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupMembers" members
          ON members."B" = permission."userGroupId"
        WHERE permission."answerCollectionId" = ${id}
          AND permission."userId" IS NULL

        UNION

        SELECT
          permission."id" AS "permissionId",
          admins."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupAdmins" admins
          ON admins."B" = permission."userGroupId"
        WHERE permission."answerCollectionId" = ${id}
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
        WHERE permission."answerCollectionId" = ${id}
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
          1 AS "sourcePriority",
          expanded_permissions."propagation",
          expanded_permissions."permissionId"::text AS "sourceKey"
        FROM expanded_permissions
        CROSS JOIN answer_collection
        WHERE NOT answer_collection."isDeleted"
      ),
      element_candidates AS (
        SELECT
          permission."userId",
          'READ'::"PermissionLevel" AS "permissionLevel",
          permission."directPermissionId",
          true AS "derived",
          2 AS "sourcePriority",
          false AS "propagation",
          element."id"::text AS "sourceKey"
        FROM "Element" element
        INNER JOIN "DerivedPermission" permission
          ON permission."elementId" = element."id"
        CROSS JOIN target_scope
        WHERE element."answerCollectionId" = ${id}
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )
      ),
      template_candidates AS (
        SELECT
          permission."userId",
          'READ'::"PermissionLevel" AS "permissionLevel",
          permission."directPermissionId",
          true AS "derived",
          3 AS "sourcePriority",
          false AS "propagation",
          template."id"::text AS "sourceKey"
        FROM "_TemplateAnswerCollectionUsages" usage
        INNER JOIN "ActivityTemplate" template
          ON template."id" = usage."A"
        INNER JOIN "DerivedPermission" permission
          ON permission."liveQuizId" = template."liveQuizId"
        CROSS JOIN target_scope
        WHERE usage."B" = ${id}
          AND template."liveQuizId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          'READ'::"PermissionLevel" AS "permissionLevel",
          permission."directPermissionId",
          true AS "derived",
          3 AS "sourcePriority",
          false AS "propagation",
          template."id"::text AS "sourceKey"
        FROM "_TemplateAnswerCollectionUsages" usage
        INNER JOIN "ActivityTemplate" template
          ON template."id" = usage."A"
        INNER JOIN "DerivedPermission" permission
          ON permission."practiceQuizId" = template."practiceQuizId"
        CROSS JOIN target_scope
        WHERE usage."B" = ${id}
          AND template."liveQuizId" IS NULL
          AND template."practiceQuizId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          'READ'::"PermissionLevel" AS "permissionLevel",
          permission."directPermissionId",
          true AS "derived",
          3 AS "sourcePriority",
          false AS "propagation",
          template."id"::text AS "sourceKey"
        FROM "_TemplateAnswerCollectionUsages" usage
        INNER JOIN "ActivityTemplate" template
          ON template."id" = usage."A"
        INNER JOIN "DerivedPermission" permission
          ON permission."microLearningId" = template."microLearningId"
        CROSS JOIN target_scope
        WHERE usage."B" = ${id}
          AND template."liveQuizId" IS NULL
          AND template."practiceQuizId" IS NULL
          AND template."microLearningId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          permission."userId",
          'READ'::"PermissionLevel" AS "permissionLevel",
          permission."directPermissionId",
          true AS "derived",
          3 AS "sourcePriority",
          false AS "propagation",
          template."id"::text AS "sourceKey"
        FROM "_TemplateAnswerCollectionUsages" usage
        INNER JOIN "ActivityTemplate" template
          ON template."id" = usage."A"
        INNER JOIN "DerivedPermission" permission
          ON permission."groupActivityId" = template."groupActivityId"
        CROSS JOIN target_scope
        WHERE usage."B" = ${id}
          AND template."liveQuizId" IS NULL
          AND template."practiceQuizId" IS NULL
          AND template."microLearningId" IS NULL
          AND template."groupActivityId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR permission."userId" = target_scope."userId"
          )
      ),
      candidates AS (
        SELECT
          answer_collection."ownerId" AS "userId",
          'OWNER'::"PermissionLevel" AS "permissionLevel",
          NULL::integer AS "directPermissionId",
          false AS "derived",
          0 AS "sourcePriority",
          false AS "propagation",
          ''::text AS "sourceKey"
        FROM answer_collection
        CROSS JOIN target_scope
        WHERE NOT answer_collection."isDeleted"
          AND (
            target_scope."userId" IS NULL
            OR answer_collection."ownerId" = target_scope."userId"
          )

        UNION ALL

        SELECT * FROM direct_candidates

        UNION ALL

        SELECT * FROM element_candidates

        UNION ALL

        SELECT * FROM template_candidates
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
              candidates."sourcePriority",
              candidates."propagation" DESC,
              CASE
                WHEN candidates."sourcePriority" = 1
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
        USING answer_collection, target_scope
        WHERE derived_permission."answerCollectionId" = answer_collection."id"
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
        "answerCollectionId",
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
      ON CONFLICT ("answerCollectionId", "userId")
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
 * Dispatch function for the recomputation of derived permissions for answer collections.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for answer collections.
 *
 * @param params - Object containing answer collection ID and optional user ID
 * @param params.id - ID of the answer collection
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeAnswerCollectionPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId?: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeAnswerCollectionPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeAnswerCollectionPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

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
export async function recomputeAnswerCollectionPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const answerCollection = await prisma.answerCollection.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  })

  if (!answerCollection) {
    return
  }

  await recomputeAnswerCollectionPermissionsSetBased({ id, userId }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      {
        answerCollectionId: id,
        userId,
        objectSoftDeleted: answerCollection.isDeleted,
      },
      prisma
    )
  }
}

/**
 * Recomputes derived permissions for all users on an answer collection.
 *
 * This function deletes all existing derived permissions for the answer collection
 * and then recomputes them. Permissions are directly deduplicated for the derived
 * permissions table to only contain the highest permission level for each user.
 * The following sources for direct permissions on answer collections are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the answer collection
 * - derived permissions granted to users on linked elements
 *   (selection / case study element --> READ permissions)
 * - derived permissions granted to users on linked activity templates
 *   (--> READ permissions)
 *
 * @param params - Object containing answer collection ID
 * @param params.id - ID of the answer collection
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeAnswerCollectionPermissionsObject(
  { id, updateAccessRequests }: { id: number; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const answerCollection = await prisma.answerCollection.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  })

  if (!answerCollection) {
    console.error(`Answer collection with id ${id} not found`)
    return
  }

  await recomputeAnswerCollectionPermissionsSetBased({ id }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { answerCollectionId: id, objectSoftDeleted: answerCollection.isDeleted },
      prisma
    )
  }
}
