import { logAuditEvent } from './audit.js'
import {
  calculateEffectivePermission,
  getDirectPermission,
  getPermissionRank,
  getResourceById,
  isResourceOwner,
} from './core.js'
import prisma from './lib/prisma.js' // Reverted import path
// Import PermissionGrant from Prisma Client
import type { PermissionGrant } from '@prisma/client'
import {
  AccessLevel,
  AuditActionType,
  PermissionScope,
  ResourceType,
} from './types.js'
// Remove mock data imports if fully switching to DB
// import { mockPermissionGrants, mockGroups, mockGroupMemberships } from './mockData.js';

// Interface for grant options, mirroring relevant PermissionGrant fields
interface GrantPermissionOptions {
  scope?: PermissionScope | null
  propagateToObject?: boolean | null
  propagateObjectLevel?: AccessLevel | null
  // Add other propagation fields if/when needed
}

/**
 * Grant a permission to a user or group for a resource.
 * @param resourceId The ID of the resource
 * @param principalId The ID of the user or group receiving the permission
 * @param level The access level to grant
 * @param grantedBy The ID of the user granting the permission
 * @param options Optional settings like scope and propagation
 * @returns The created PermissionGrant object or null if failed
 */
export async function grantPermission(
  resourceId: string,
  principalId: string,
  level: AccessLevel,
  grantedBy: string,
  options?: GrantPermissionOptions
): Promise<PermissionGrant | null> {
  // Return Promise
  const resource = await getResourceById(resourceId) // Assume getResourceById might become async too
  if (!resource) {
    console.error(`grantPermission: Resource not found: ${resourceId}`)
    return null
  }

  // Permission Check: Ensure granter has ADMIN or OWNER permission
  const granterPermission = await calculateEffectivePermission(
    resourceId,
    grantedBy
  )
  if (
    !granterPermission ||
    getPermissionRank(granterPermission) < getPermissionRank(AccessLevel.ADMIN)
  ) {
    console.error(
      `grantPermission: User ${grantedBy} lacks permission to grant on resource ${resourceId}`
    )
    return null
  }

  // Cannot grant OWNER level directly (use transferOwnership)
  if (level === AccessLevel.OWNER) {
    console.error(
      `grantPermission: Cannot grant OWNER level directly. Use transferOwnership.`
    )
    return null
  }

  // Prevent granting higher level than the granter possesses (unless OWNER)
  if (
    granterPermission !== AccessLevel.OWNER &&
    getPermissionRank(granterPermission) < getPermissionRank(level)
  ) {
    console.error(
      `grantPermission: User ${grantedBy} cannot grant permission level ${level} as it exceeds their own level (${granterPermission}).`
    )
    return null
  }

  // Determine principal type (basic check)
  const isGroupPrincipal = principalId.startsWith('group-')

  try {
    // Check for existing direct grant to avoid duplicates (optional, DB constraint might handle)
    const existingDirectGrant = await getDirectPermission(
      resourceId,
      principalId
    ) // Assume getDirectPermission becomes async
    if (existingDirectGrant) {
      console.warn(
        `grantPermission: Direct grant already exists for principal ${principalId} on resource ${resourceId}. Updating level.`
      )
      // Update existing grant with new level and options
      const updatedGrant = await prisma.permissionGrant.update({
        where: { id: existingDirectGrant.id },
        data: {
          level: level,
          scope: options?.scope,
          propagateToObject: options?.propagateToObject,
          propagateObjectLevel: options?.propagateObjectLevel,
          ...(isGroupPrincipal
            ? { principalGroupId: principalId, principalUserId: null }
            : { principalUserId: principalId, principalGroupId: null }),
          grantedByUserId: grantedBy,
          grantedAt: new Date(),
        },
      })
      // Log the update action
      await logAuditEvent({
        actionType: AuditActionType.PERMISSION_UPDATE,
        performedByUserId: grantedBy,
        resourceId: resourceId,
        resourceType: resource.type,
        details: {
          targetUserId: existingDirectGrant.principalUserId ?? undefined,
          targetGroupId: existingDirectGrant.principalGroupId ?? undefined,
          permissionBefore: existingDirectGrant.level as AccessLevel,
          permissionAfter: level,
          updatedGrantId: existingDirectGrant.id,
        },
      })
      return updatedGrant
    }

    // No existing grant, create a new one
    const newGrant = await prisma.permissionGrant.create({
      data: {
        resourceId: resourceId,
        resourceType: resource.type,
        level: level,
        grantedBy: { connect: { id: grantedBy } },
        ...(isGroupPrincipal
          ? { principalGroup: { connect: { id: principalId } } }
          : { principalUser: { connect: { id: principalId } } }),
        scope: options?.scope,
        propagateToObject: options?.propagateToObject,
        propagateObjectLevel: options?.propagateObjectLevel,
      },
    })

    await logAuditEvent({
      actionType: AuditActionType.PERMISSION_GRANT,
      performedByUserId: grantedBy,
      resourceId: resourceId,
      resourceType: resource.type,
      details: {
        targetUserId: newGrant.principalUserId ?? undefined,
        targetGroupId: newGrant.principalGroupId ?? undefined,
        permissionAfter: level,
      },
    })

    return newGrant
  } catch (error) {
    console.error(
      `grantPermission: Failed to create grant for ${principalId} on ${resourceId}:`,
      error
    )
    return null
  }
}

/**
 * Revoke a permission grant and any permissions derived directly from it.
 * @param grantId The unique ID of the PermissionGrant row to revoke.
 * @param revokedBy The ID of the user performing the revocation.
 * @returns True if successful, false otherwise.
 */
export async function revokePermission(
  grantId: string,
  revokedBy: string
): Promise<boolean> {
  // Return Promise

  // Fetch the grant to revoke to get details
  const grantToRevoke = await prisma.permissionGrant.findUnique({
    where: { id: grantId },
  })

  if (!grantToRevoke) {
    console.error(
      `revokePermission: Permission grant with ID ${grantId} not found.`
    )
    return false
  }

  const {
    resourceId,
    principalUserId,
    principalGroupId,
    level: levelBeforeString,
    resourceType,
  } = grantToRevoke

  // Determine the actual principal ID and type
  const targetPrincipalId = principalUserId ?? principalGroupId
  if (!targetPrincipalId) {
    console.error(`revokePermission: Grant ${grantId} has no principal ID.`)
    return false // Should not happen based on schema constraints
  }
  const levelBefore = levelBeforeString as AccessLevel // Cast string to enum for checks

  // --- Permission Checks (Use await) ---
  const revokerEffectivePermission = await calculateEffectivePermission(
    resourceId,
    revokedBy
  )
  if (
    !revokerEffectivePermission ||
    getPermissionRank(revokerEffectivePermission) <
      getPermissionRank(levelBefore) // <-- Use casted enum
  ) {
    console.error(
      `User ${revokedBy} lacks ADMIN or OWNER permission on resource ${resourceId} to revoke grants.`
    )
    return false
  }
  const isOwner = await isResourceOwner(resourceId, revokedBy)
  if (levelBefore === AccessLevel.OWNER && !isOwner) {
    // <-- Use casted enum
    console.error(
      `Only the resource owner can revoke OWNER level grants. Grant ID: ${grantId}`
    )
    return false
  }
  if (
    levelBefore !== AccessLevel.OWNER && // <-- Use casted enum
    getPermissionRank(revokerEffectivePermission) <
      getPermissionRank(levelBefore) // <-- Use casted enum
  ) {
    console.error(
      `User ${revokedBy} cannot revoke permission level ${levelBefore} as it exceeds their own level (${revokerEffectivePermission}). Grant ID: ${grantId}`
    )
    return false
  }
  // --- End Permission Checks ---

  try {
    // Use a transaction to delete the main grant and its direct derivatives
    const result = await prisma.$transaction(async (tx) => {
      // Find direct derivatives first (before deleting the parent)
      const derivedGrants = await tx.permissionGrant.findMany({
        where: { derivedFromGrantId: grantId },
        select: { id: true }, // Only need IDs
      })
      const derivedGrantCount = derivedGrants.length

      // Delete the main grant
      const deleteMain = await tx.permissionGrant.delete({
        where: { id: grantId },
      })

      // Delete derived grants (if any)
      if (derivedGrantCount > 0) {
        await tx.permissionGrant.deleteMany({
          where: { derivedFromGrantId: grantId }, // Alternative: where: { id: { in: derivedGrants.map(g => g.id) } }
        })
      }

      return { success: !!deleteMain, removedDerivedCount: derivedGrantCount }
    })

    if (result.success) {
      console.log(
        `Removed grant ID ${grantId} and ${result.removedDerivedCount} derived grants.`
      )
      // Audit Log for the primary revoked grant
      await logAuditEvent({
        actionType: AuditActionType.PERMISSION_REVOKE,
        performedByUserId: revokedBy,
        resourceId: resourceId,
        resourceType: resourceType as ResourceType,
        details: {
          targetUserId: principalUserId ?? undefined,
          targetGroupId: principalGroupId ?? undefined,
          permissionBefore: levelBefore,
          revokedGrantId: grantId,
          removedDerivedGrantCount: result.removedDerivedCount,
        },
      })
    } else {
      console.warn(
        `revokePermission: Transaction completed but main grant ${grantId} might not have been deleted?`
      )
      // This case might indicate an unexpected state
    }

    return result.success
  } catch (error) {
    console.error(
      `revokePermission: Failed to revoke grant ID ${grantId}:`,
      error
    )
    return false
  }
}

/**
 * Transfer ownership of a resource to another user.
 * This involves updating the resource's ownerId and adjusting permission grants.
 * NOTE: Updating the resource ownerId itself is assumed to happen *outside* this function
 *       in the module responsible for the resource (e.g., elementManagement, activityManagement).
 *       This function handles only the *permission grant* adjustments.
 * @param resourceId The ID of the resource
 * @param newOwnerId The ID of the new owner
 * @param currentOwnerId The ID of the user performing the transfer (must be current owner)
 * @returns True if permission adjustments were successful, false otherwise.
 */
export async function transferOwnership(
  resourceId: string,
  newOwnerId: string,
  currentOwnerId: string
): Promise<boolean> {
  // Return Promise

  // Permission Check: Verify the user performing the action is the current owner.
  // This requires fetching the resource's current owner.
  const resource = await getResourceById(resourceId) // Assume getResourceById is async
  if (!resource) {
    console.error(`transferOwnership: Resource not found: ${resourceId}`)
    return false
  }
  if (resource.ownerId !== currentOwnerId) {
    console.error(
      `transferOwnership: User ${currentOwnerId} is not the current owner of resource ${resourceId}`
    )
    return false
  }
  if (resource.ownerId === newOwnerId) {
    console.warn(
      `transferOwnership: New owner ${newOwnerId} is already the current owner of ${resourceId}. No permission changes needed.`
    )
    return true // Or false, depending on desired behavior for no-op
  }

  try {
    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Remove any *existing direct* grant for the *new* owner on this resource.
      //    Ownership itself grants OWNER level, so explicit grants become redundant or conflicting.
      await tx.permissionGrant.deleteMany({
        where: {
          resourceId: resourceId,
          principalUserId: newOwnerId,
          derivedFromGrantId: null,
        },
      })

      // 2. Grant the *previous* owner ADMIN permissions (optional, but common practice).
      //    First, delete any existing direct grant for the previous owner to avoid conflicts.
      await tx.permissionGrant.deleteMany({
        where: {
          resourceId: resourceId,
          principalUserId: currentOwnerId,
          derivedFromGrantId: null,
        },
      })
      // Then, create the ADMIN grant.
      await tx.permissionGrant.create({
        data: {
          resourceId: resourceId,
          resourceType: resource.type,
          level: AccessLevel.ADMIN,
          grantedBy: { connect: { id: currentOwnerId } },
          principalUser: { connect: { id: currentOwnerId } },
        },
      })
      // Note: We might need to handle propagation flags if ADMIN should propagate.
    })

    // Log the transfer event
    await logAuditEvent({
      actionType: AuditActionType.OWNERSHIP_TRANSFER,
      performedByUserId: currentOwnerId,
      resourceId: resourceId,
      resourceType: resource.type,
      details: {
        previousOwnerId: currentOwnerId,
        newOwnerId: newOwnerId,
      },
    })

    return true
  } catch (error) {
    console.error(
      `transferOwnership: Failed to adjust permissions for transfer on ${resourceId}:`,
      error
    )
    return false
  }
}
