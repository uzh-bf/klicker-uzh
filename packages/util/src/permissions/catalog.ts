/**
 * Derived permission recomputation for Catalog Collections in KlickerUZH:
 * - recomputeCatalogCollectionPermissions: dispatches to user/object variants.
 * - recomputeCatalogCollectionPermissionsUser: recomputes for a specific user.
 * - recomputeCatalogCollectionPermissionsObject: recomputes for all users.
 */
import * as DB from '@klicker-uzh/prisma/client'
import {
  MISSING_CATALOG_COLLECTION_ID,
  type PrismaTransactionClient,
} from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'

async function recomputeCatalogCollectionPermissionsSetBased(
  { id, userId }: { id: string; userId?: string },
  prisma: PrismaTransactionClient
) {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      WITH target_scope AS (
        SELECT ${userId ?? null}::uuid AS "userId"
      ),
      catalog_collection AS (
        SELECT collection."id", collection."ownerId"
        FROM "CatalogCollection" collection
        WHERE collection."id" = ${id}::uuid
      ),
      expanded_group_users AS (
        SELECT
          permission."id" AS "permissionId",
          group_data."ownerId" AS "userId"
        FROM "Permission" permission
        INNER JOIN "UserGroup" group_data
          ON group_data."id" = permission."userGroupId"
        WHERE permission."catalogCollectionId" = ${id}::uuid

        UNION

        SELECT
          permission."id" AS "permissionId",
          members."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupMembers" members
          ON members."B" = permission."userGroupId"
        WHERE permission."catalogCollectionId" = ${id}::uuid

        UNION

        SELECT
          permission."id" AS "permissionId",
          admins."A" AS "userId"
        FROM "Permission" permission
        INNER JOIN "_UserGroupAdmins" admins
          ON admins."B" = permission."userGroupId"
        WHERE permission."catalogCollectionId" = ${id}::uuid
      ),
      expanded_permissions AS (
        SELECT
          permission."id" AS "permissionId",
          permission."permissionLevel",
          permission."propagation",
          permission."userId"
        FROM "Permission" permission
        CROSS JOIN target_scope
        WHERE permission."catalogCollectionId" = ${id}::uuid
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
      ranked_permissions AS (
        SELECT
          expanded_permissions.*,
          ROW_NUMBER() OVER (
            PARTITION BY expanded_permissions."userId"
            ORDER BY
              CASE expanded_permissions."permissionLevel"
                WHEN 'OWNER' THEN 5
                WHEN 'ADMIN' THEN 4
                WHEN 'WRITE' THEN 3
                WHEN 'EXECUTE' THEN 2
                WHEN 'READ' THEN 1
              END DESC,
              expanded_permissions."propagation" DESC,
              expanded_permissions."permissionId" DESC
          ) AS "permissionRank"
        FROM expanded_permissions
      ),
      desired_permissions AS (
        SELECT
          catalog_collection."ownerId" AS "userId",
          'OWNER'::"PermissionLevel" AS "permissionLevel",
          NULL::integer AS "directPermissionId"
        FROM catalog_collection
        CROSS JOIN target_scope
        WHERE catalog_collection."ownerId" IS NOT NULL
          AND (
            target_scope."userId" IS NULL
            OR catalog_collection."ownerId" = target_scope."userId"
          )

        UNION ALL

        SELECT
          ranked_permissions."userId",
          ranked_permissions."permissionLevel",
          ranked_permissions."permissionId" AS "directPermissionId"
        FROM ranked_permissions
        CROSS JOIN catalog_collection
        WHERE ranked_permissions."permissionRank" = 1
          AND (
            catalog_collection."ownerId" IS NULL
            OR ranked_permissions."userId" <> catalog_collection."ownerId"
          )
      ),
      deleted_permissions AS (
        DELETE FROM "DerivedPermission" derived_permission
        USING catalog_collection, target_scope
        WHERE derived_permission."catalogCollectionId" = catalog_collection."id"
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
        "catalogCollectionId",
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
      ON CONFLICT ("catalogCollectionId", "userId")
      DO UPDATE SET
        "permissionLevel" = EXCLUDED."permissionLevel",
        "directPermissionId" = EXCLUDED."directPermissionId",
        "derived" = false,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "DerivedPermission"."permissionLevel" IS DISTINCT FROM EXCLUDED."permissionLevel"
        OR "DerivedPermission"."directPermissionId" IS DISTINCT FROM EXCLUDED."directPermissionId"
        OR "DerivedPermission"."derived" IS DISTINCT FROM false
    `
  )
}

/**
 * Dispatch function for the recomputation of derived permissions for catalog collections
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for catalog collections.
 */
export async function recomputeCatalogCollectionPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId?: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // for the top-level default catalog collection, no permissions are awarded
  if (id === MISSING_CATALOG_COLLECTION_ID) {
    return
  }

  if (userId) {
    return await recomputeCatalogCollectionPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  return await recomputeCatalogCollectionPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a catalog collection.
 */
export async function recomputeCatalogCollectionPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!catalogCollection) {
    return
  }

  await recomputeCatalogCollectionPermissionsSetBased({ id, userId }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { catalogCollectionId: id, userId },
      prisma
    )
  }
}

/**
 * Recomputes derived permissions for all users on a catalog collection.
 */
export async function recomputeCatalogCollectionPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!catalogCollection) {
    console.error(`Catalog collection with id ${id} not found`)
    return
  }

  await recomputeCatalogCollectionPermissionsSetBased({ id }, prisma)

  if (updateAccessRequests) {
    await updateAccessRequestInstances({ catalogCollectionId: id }, prisma)
  }
}
