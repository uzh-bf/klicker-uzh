import { getUserGroups } from './groups.js' // Needed for calculateEffectivePermission
import prisma from './lib/prisma.js' // Reverted import path
// Import PermissionGrant directly from Prisma Client
import { type PermissionGrant } from '@prisma/client'
// Remove mock data imports
// import {
//   mockActivities,
//   mockElements,
//   mockPermissionGrants,
//   mockUserGroups,
// } from './mockData.js'
import {
  AccessLevel,
  // We might not need the specific resource types here anymore
  // Activity,
  // Element,
  PermissionScope,
  ResourceType, // Keep ResourceType enum
} from './types.js'
// Import Prisma types if needed for casting or explicit typing

// Type definition for the unified resource shape returned by getResourceById
// Includes essential fields needed by permission checks (id, type, ownerId)
interface BaseResource {
  id: string
  type: ResourceType
  ownerId: string
}

// ===== Core Functions =====

/**
 * Get a resource (Element, Activity, or UserGroup) by its ID.
 * @param resourceId The ID of the resource to retrieve.
 * @returns A BaseResource object (id, type, ownerId) or null if not found.
 */
export async function getResourceById(
  resourceId: string
): Promise<BaseResource | null> {
  // Return Promise<BaseResource | null>
  try {
    // Check elements
    const element = await prisma.element.findUnique({
      where: { id: resourceId },
      select: { id: true, ownerId: true }, // Select only needed fields
    })
    if (element) {
      return { ...element, type: ResourceType.ELEMENT }
    }

    // Check activities
    const activity = await prisma.activity.findUnique({
      where: { id: resourceId },
      select: { id: true, ownerId: true },
    })
    if (activity) {
      return { ...activity, type: ResourceType.ACTIVITY }
    }

    // Check user groups
    console.log(`getResourceById: Checking UserGroup for ID: ${resourceId}`)
    const userGroup = await prisma.userGroup.findUnique({
      where: { id: resourceId },
      select: { id: true, ownerId: true }, // Revert to original selection
    })
    console.log(
      `getResourceById: Found UserGroup: ${JSON.stringify(userGroup)}`
    )
    if (userGroup) {
      return { ...userGroup, type: ResourceType.USER_GROUP }
    }

    // Not found in any relevant table
    return null
  } catch (error) {
    console.error(
      `getResourceById: Error fetching resource ${resourceId}:`,
      error
    )
    return null // Return null on error
  }
}

/**
 * Retrieve a direct (non-derived) permission grant for a specific principal (user or group) on a resource.
 * @param resourceId The ID of the resource.
 * @param principalId The ID of the user or group
 * @returns The PermissionGrant object if found and not derived, otherwise null.
 */
export async function getDirectPermission(
  resourceId: string,
  principalId: string // Can be userId or groupId
): Promise<PermissionGrant | null> {
  try {
    // Basic check to determine if principal is likely a group (can be improved)
    const isGroupPrincipal = principalId.startsWith('group-') // Simple heuristic

    const grant = await prisma.permissionGrant.findFirst({
      where: {
        resourceId: resourceId,
        // Use principalUserId or principalGroupId based on heuristic
        ...(isGroupPrincipal
          ? { principalGroupId: principalId } // Check group ID field
          : { principalUserId: principalId }), // Check user ID field
        derivedFromGrantId: null, // Ensure it's a direct grant
      },
    })
    // Return type should align better now, but keep cast via unknown for safety
    return grant
  } catch (error) {
    console.error(
      `getDirectPermission: Error fetching direct grant for ${principalId} on ${resourceId}:`,
      error
    )
    return null // Return null on error
  }
}

/**
 * Check if a user is the owner of a resource.
 * @param resourceId The ID of the resource.
 * @param userId The ID of the user.
 * @returns True if the user is the owner, false otherwise.
 */
export async function isResourceOwner(
  resourceId: string,
  userId: string
): Promise<boolean> {
  const resource = await getResourceById(resourceId)
  const isOwner = !!resource && resource.ownerId === userId
  return isOwner
}

/**
 * Calculate the effective access level for a user on a resource,
 * considering ownership, direct grants, group grants, and derived grants.
 *
 * Precedence: Owner > Direct User Grant > Direct Group Grant > Derived Grant (highest level wins *within* type)
 *
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @param context Optional context (e.g., activityId for scope checks)
 * @returns The effective access level or null if no access
 */
export async function calculateEffectivePermission(
  resourceId: string,
  userId: string,
  context?: {
    activityId?: string
  }
): Promise<AccessLevel | null> {
  try {
    // 1. Check Ownership (Highest Priority)
    if (await isResourceOwner(resourceId, userId)) {
      return AccessLevel.OWNER
    }

    // Initialize highest levels found
    let highestUserLevel: AccessLevel | null = null
    let highestGroupLevel: AccessLevel | null = null

    // 2. Check Direct User Grant (Non-Derived)
    const directUserGrant = await getDirectPermission(resourceId, userId)
    console.log(
      `[calculateEffectivePermission] directUserGrant for user ${userId} on resource ${resourceId}: ${JSON.stringify(directUserGrant)}`
    )
    if (directUserGrant) {
      // Check scope if applicable
      // Assuming scope is null if not set
      if (directUserGrant.scope === PermissionScope.ACTIVITY_ONLY) {
        console.log(
          `[calculateEffectivePermission] Grant scope is ACTIVITY_ONLY`
        )
        if (context?.activityId) {
          console.log(
            `[calculateEffectivePermission] Grant scope ACTIVITY_ONLY applies due to context`
          )
          highestUserLevel = directUserGrant.level as AccessLevel
        } else {
          // Grant is activity-scoped, but no activity context provided -> grant doesn't apply here
          console.log(
            `[calculateEffectivePermission] Grant scope ACTIVITY_ONLY ignored due to missing context`
          )
          // --- Potential Issue: Code falls through here instead of returning null or stopping ---
        }
      } else {
        // Global grant applies (or scope is null)
        console.log(
          `[calculateEffectivePermission] Grant scope is GLOBAL or NULL, found level: ${directUserGrant.level}`
        )
        highestUserLevel = directUserGrant.level as AccessLevel
      }
      // If code reaches here, it means an ACTIVITY_ONLY grant was found but didn't apply.
    }

    // 3. Check Direct Group Grants (Non-Derived)
    const userGroups = await getUserGroups(userId)
    if (userGroups.length > 0) {
      const groupGrants = await prisma.permissionGrant.findMany({
        where: {
          resourceId: resourceId,
          principalGroup: {
            id: { in: userGroups },
          },
          derivedFromGrantId: null,
          scope: {
            // Consider scope here as well (similar to direct user check)
            // For simplicity, assuming GLOBAL scope for now if not ACTIVITY_ONLY
            not: PermissionScope.ACTIVITY_ONLY, // Simplified: Ignore activity-only grants for now unless context matches
            // TODO: Add logic to include ACTIVITY_ONLY if context?.activityId matches grant details
          },
        },
        orderBy: {
          level: 'desc', // Get highest level grant first
        },
        take: 1, // Only need the highest one
      })

      if (groupGrants.length > 0 && groupGrants[0]) {
        highestGroupLevel = groupGrants[0].level as AccessLevel
      }
    }

    // 4. Check Derived Grants (User or Group)
    let highestDerivedLevel: AccessLevel | null = null
    // Only check derived if no direct user or group grant was higher
    if (
      getPermissionRank(
        highestUserLevel ?? AccessLevel.VIEWER /* dummy lowest */
      ) < getPermissionRank(AccessLevel.ADMIN) // Avoid redundant checks if already admin/owner
    ) {
      const principalIdsToCheck = [userId, ...userGroups] // Check grants for user OR their groups
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: {
          resourceId: resourceId,
          derivedFromGrantId: { not: null }, // It IS derived
          OR: [
            { principalUser: { id: userId } },
            { principalGroup: { id: { in: userGroups } } },
          ],
          // Basic scope check for derived (can be refined)
          scope: {
            not: PermissionScope.ACTIVITY_ONLY,
            // TODO: Add logic for ACTIVITY_ONLY with context
          },
        },
        orderBy: {
          // Order by level first, then potentially date?
          level: 'desc',
        },
        // No need to fetch all, just check if highest exists?
        // take: 1, // Optimization: Get only the potentially highest derived grant
      })

      // Find the highest applicable derived grant
      for (const derivedGrant of derivedGrants) {
        const currentLevel = derivedGrant.level as AccessLevel
        if (
          !highestDerivedLevel ||
          getPermissionRank(currentLevel) >
            getPermissionRank(highestDerivedLevel)
        ) {
          // TODO: Add scope check here based on context if needed
          highestDerivedLevel = currentLevel
        }
      }
    }

    // 5. Determine final highest level based on precedence
    // Return the highest level found according to strict precedence:
    // Owner (already returned) > Direct User > Direct Group > Derived
    return highestUserLevel ?? highestGroupLevel ?? highestDerivedLevel ?? null
  } catch (error) {
    console.error(
      `calculateEffectivePermission: Error for user ${userId} on resource ${resourceId}:`,
      error
    )
    return null // Return null on error
  }
}

/**
 * Get a numeric rank for permission levels to compare them
 * @param level The access level
 * @returns A numeric rank (highest means more permissions)
 */
export function getPermissionRank(level: AccessLevel): number {
  switch (level) {
    case AccessLevel.OWNER:
      return 4
    case AccessLevel.ADMIN:
      return 3
    case AccessLevel.EDITOR:
      return 2
    case AccessLevel.VIEWER:
      return 1
    default:
      return 0
  }
}

/**
 * @deprecated This function iterates through all resources and calls the async calculateEffectivePermission,
 * which is highly inefficient with database calls. Use specific permission checks as needed.
 */
export async function calculateAllDerivedPermissions(
  userId: string
): Promise<Map<string, AccessLevel>> {
  console.warn(
    'calculateAllDerivedPermissions is deprecated and inefficient with DB calls.'
  )
  const permissionMap = new Map<string, AccessLevel>()
  // This is extremely inefficient - requires separate DB checks for every single resource.
  // A better approach would be needed in a real DB scenario, perhaps fetching all
  // user/group grants upfront.
  // For now, let's leave it but marked as deprecated.

  // Example (Inefficient): Fetch all resource IDs first
  // const allElementIds = await prisma.element.findMany({ select: { id: true } });
  // for (const element of allElementIds) {
  //    const permission = await calculateEffectivePermission(element.id, userId);
  //    if (permission) permissionMap.set(element.id, permission);
  // }
  // Similarly for activities and groups...

  return permissionMap
}

/**
 * Check if a user can perform a specific operation on a resource
 */
export async function canPerformOperation(
  resourceId: string,
  userId: string,
  requiredLevel: AccessLevel
): Promise<boolean> {
  // Return Promise
  const effectiveLevel = await calculateEffectivePermission(resourceId, userId) // Use await
  if (!effectiveLevel) {
    return false
  }
  return getPermissionRank(effectiveLevel) >= getPermissionRank(requiredLevel)
}
