import type { PermissionGrant, Prisma } from '@prisma/client'
import { logAuditEvent } from './audit.js'
import {
  calculateEffectivePermission,
  getDirectPermission,
  getPermissionRank,
} from './core.js'
import prisma from './lib/prisma.js'
import { grantPermission } from './permissionManagement.js'
import {
  AccessLevel,
  AuditActionType,
  PermissionScope,
  PrincipalType,
  ResourceType,
  ShareActivityOptions,
} from './types.js'

// --- Activity/Element Helper Functions ---

/**
 * Get all element IDs associated with a specific activity
 * @param activityId The ID of the activity
 * @returns Array of element IDs contained in the activity
 */
export async function getActivityElements(
  activityId: string
): Promise<string[]> {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId, isDeleted: false },
      select: { elements: { select: { id: true } } },
    })
    return activity?.elements.map((elem: { id: string }) => elem.id) || []
  } catch (error) {
    console.error(
      `getActivityElements: Failed for activity ${activityId}:`,
      error
    )
    return []
  }
}

/**
 * Get all activities that contain a specific element
 * @param elementId The ID of the element
 * @returns Array of activity IDs that contain the element
 */
export async function getElementActivities(
  elementId: string
): Promise<string[]> {
  try {
    const activities = await prisma.activity.findMany({
      where: {
        elements: {
          some: { id: elementId },
        },
        isDeleted: false,
      },
      select: { id: true },
    })
    return activities.map((act: { id: string }) => act.id)
  } catch (error) {
    console.error(
      `getElementActivities: Failed for element ${elementId}:`,
      error
    )
    return []
  }
}

/**
 * Determines the default propagation level for contained objects (e.g., Elements)
 * based on the permission level granted on the container (e.g., Activity).
 */
function getDefaultObjectPropagationLevel(
  containerLevel: AccessLevel
): AccessLevel | null {
  switch (containerLevel) {
    case AccessLevel.VIEWER:
      return AccessLevel.VIEWER
    case AccessLevel.EDITOR:
      return AccessLevel.VIEWER
    case AccessLevel.ADMIN:
    case AccessLevel.OWNER:
      return AccessLevel.EDITOR
    default:
      return null
  }
}

/**
 * Propagate permissions from a container (Activity) grant to its contained objects (Elements).
 * Creates derived PermissionGrant records in the database.
 * @param containerGrant The original PermissionGrant object on the container resource.
 */
export async function propagatePermissionsToContainedObjects(
  containerGrant: PermissionGrant
): Promise<PermissionGrant[]> {
  let containedElementIds: string[] = []
  try {
    const container = await prisma.activity.findUnique({
      where: { id: containerGrant.resourceId, isDeleted: false },
      select: { elements: { select: { id: true } } },
    })
    if (!container || container.elements.length === 0) {
      return []
    }
    containedElementIds = container.elements.map((e: { id: string }) => e.id)
  } catch (error) {
    console.error(
      `propagatePermissions: Failed to fetch container ${containerGrant.resourceId} or its elements:`,
      error
    )
    return []
  }

  const shouldPropagate = containerGrant.propagateToObject !== false
  if (!shouldPropagate) {
    return []
  }

  let finalPropagationLevel: AccessLevel | null
  if (
    containerGrant.propagateObjectLevel !== null &&
    containerGrant.propagateObjectLevel !== undefined
  ) {
    finalPropagationLevel =
      containerGrant.propagateObjectLevel as AccessLevel | null
  } else {
    finalPropagationLevel = getDefaultObjectPropagationLevel(
      containerGrant.level as AccessLevel
    )
  }

  if (!finalPropagationLevel) {
    return []
  }

  // Determine the correct principal ID (user or group) from the container grant
  const targetPrincipalId =
    containerGrant.principalUserId ?? containerGrant.principalGroupId
  if (!targetPrincipalId) {
    console.error(
      `propagatePermissionsToContainedObjects: Container grant ${containerGrant.id} has no principalUserId or principalGroupId.`
    )
    return [] // Cannot proceed without a principal
  }

  // Determine the principal type based on which ID was found
  const targetPrincipalType = containerGrant.principalUserId
    ? PrincipalType.USER
    : PrincipalType.GROUP

  const grantsToCreateData: Omit<
    Prisma.PermissionGrantCreateManyInput,
    'id'
  >[] = []

  for (const elementId of containedElementIds) {
    const existingDirectGrant = await getDirectPermission(
      elementId,
      targetPrincipalId
    )
    if (
      existingDirectGrant &&
      existingDirectGrant.derivedFromGrantId === null
    ) {
      continue
    }

    // Prepare data for createMany, setting either userId or groupId
    const grantData: Omit<Prisma.PermissionGrantCreateManyInput, 'id'> = {
      resourceId: elementId,
      resourceType: ResourceType.ELEMENT,
      level: finalPropagationLevel,
      grantedByUserId: containerGrant.grantedByUserId,
      derivedFromGrantId: containerGrant.id,
      scope: containerGrant.scope || PermissionScope.GLOBAL,
      // Conditionally set principalUserId or principalGroupId
      ...(targetPrincipalType === PrincipalType.USER
        ? { principalUserId: targetPrincipalId }
        : { principalGroupId: targetPrincipalId }),
    }

    grantsToCreateData.push(grantData)
  }

  if (grantsToCreateData.length > 0) {
    try {
      await prisma.permissionGrant.createMany({
        data: grantsToCreateData,
      })

      const createdGrants = await prisma.permissionGrant.findMany({
        where: {
          derivedFromGrantId: containerGrant.id,
          resourceId: { in: grantsToCreateData.map((g) => g.resourceId) },
        },
      })
      return createdGrants
    } catch (error) {
      console.error(
        `Failed to bulk create derived grants from grant ${containerGrant.id}:`,
        error
      )
      return []
    }
  } else {
    return []
  }
}

// --- Activity Sharing ---

/**
 * Share an activity with a user or group, optionally propagating permissions.
 * @param options Options including activityId, principalId, level, grantedBy, and propagation settings.
 * @returns The primary PermissionGrant on the activity, or null if failed.
 */
export async function shareActivity(
  options: ShareActivityOptions
): Promise<PermissionGrant | null> {
  const {
    activityId,
    userId,
    groupId,
    level,
    grantedBy,
    propagateToObject,
    propagateObjectLevel,
    reason,
  } = options

  // Validate principal: exactly one of userId or groupId must be provided
  if ((!userId && !groupId) || (userId && groupId)) {
    console.error(
      'shareActivity: Must provide either userId or groupId, but not both.'
    )
    // Optionally throw an error instead of returning null
    // throw new Error('Invalid arguments: Must provide either userId or groupId.');
    return null
  }

  // Determine the principal ID to use for granting
  const principalId = userId ?? groupId!
  const principalType = userId ? PrincipalType.USER : PrincipalType.GROUP

  const activityGrant = await grantPermission(
    activityId,
    principalId, // Pass the determined principalId
    level,
    grantedBy,
    {
      propagateToObject: propagateToObject,
      propagateObjectLevel: propagateObjectLevel,
    }
  )

  if (!activityGrant) {
    console.error(
      `shareActivity: Failed to grant initial permission on activity ${activityId} to ${principalId}`
    )
    return null
  }

  // Only propagate if the option was set and the grant was successful
  if (propagateToObject !== false && activityGrant) {
    await propagatePermissionsToContainedObjects(activityGrant)
  }

  await logAuditEvent({
    actionType: AuditActionType.ACTIVITY_SHARE,
    performedByUserId: grantedBy,
    resourceId: activityId,
    resourceType: ResourceType.ACTIVITY,
    details: {
      // Log target based on provided principal type
      ...(principalType === PrincipalType.USER
        ? { targetUserId: principalId }
        : { targetGroupId: principalId }),
      accessLevel: level,
      reason: reason,
    },
  })

  return activityGrant
}

// --- Deprecated / Needs Review ---

/**
 * @deprecated Prefer direct grantPermission or shareActivity with propagation options.
 */
export async function grantPermissionWithPropagation(
  resourceId: string,
  principalId: string,
  level: AccessLevel,
  grantedBy: string
): Promise<PermissionGrant | null> {
  console.warn('grantPermissionWithPropagation is deprecated')
  const grant = await grantPermission(resourceId, principalId, level, grantedBy)
  if (grant) {
    if (grant.resourceType === ResourceType.ACTIVITY) {
      await propagatePermissionsToContainedObjects(grant)
    }
  }
  return grant
}

/**
 * Check if a user has permission to edit an activity and all its elements.
 */
export async function canEditActivityWithElements(
  activityId: string,
  userId: string
): Promise<boolean> {
  const activityPermission = await calculateEffectivePermission(
    activityId,
    userId
  )

  if (
    activityPermission === AccessLevel.ADMIN ||
    activityPermission === AccessLevel.OWNER
  ) {
    return true
  }

  if (activityPermission === AccessLevel.EDITOR) {
    const elementIds: string[] = await getActivityElements(activityId)
    if (elementIds.length === 0) return true

    for (const elementId of elementIds) {
      const elementPermission = await calculateEffectivePermission(
        elementId,
        userId
      )
      if (
        !elementPermission ||
        getPermissionRank(elementPermission) <
          getPermissionRank(AccessLevel.EDITOR)
      ) {
        return false
      }
    }
    return true
  }

  return false
}

/**
 * Check if a user can access all elements in an activity (at least VIEWER level)
 */
export async function canAccessAllActivityElements(
  activityId: string,
  userId: string
): Promise<boolean> {
  const elementIds: string[] = await getActivityElements(activityId)

  if (elementIds.length === 0) {
    return true
  }

  for (const elementId of elementIds) {
    const permission = await calculateEffectivePermission(elementId, userId)
    if (
      !permission ||
      getPermissionRank(permission) < getPermissionRank(AccessLevel.VIEWER)
    ) {
      return false
    }
  }
  return true
}
