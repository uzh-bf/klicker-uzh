import type { Activity } from '@prisma/client'
import { logAuditEvent } from './audit.js'
import { canPerformOperation } from './core.js'
import prisma from './lib/prisma.js'
import { AccessLevel, AuditActionType, ResourceType } from './types.js'

// --- Dependency Checking ---

/**
 * Finds all activities that currently include the given element ID.
 * @param elementId The ID of the element to check.
 * @returns An array of Activity objects that depend on the element.
 */
export async function checkElementDependencies(
  elementId: string
): Promise<Activity[]> {
  // Find activities where the 'elements' relation includes this elementId
  const activities = await prisma.activity.findMany({
    where: {
      elements: {
        some: {
          id: elementId,
        },
      },
      isDeleted: false, // Only consider non-deleted activities
    },
  })
  return activities
}

// --- Deletion Permission Check ---

/**
 * Checks if a user has the required permission level (ADMIN) to initiate deletion (soft or hard) of an element.
 * NOTE: Assumes canPerformOperation is updated to use the database.
 * @param elementId The ID of the element.
 * @param userId The ID of the user attempting the deletion.
 * @returns An object indicating if the user has permission and a reason if not.
 */
export async function canDeleteElement(
  elementId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // This relies on canPerformOperation being async and DB-aware
  const hasPermission = await canPerformOperation(
    elementId,
    userId,
    AccessLevel.ADMIN
  )

  if (!hasPermission) {
    return {
      allowed: false,
      reason:
        'Insufficient permissions (ADMIN required) to delete this element.',
    }
  }

  return { allowed: true }
}

// --- Soft Deletion ---

/**
 * Soft delete an element by marking it as deleted.
 * @param elementId The ID of the element to soft delete.
 * @param userId The ID of the user performing the deletion (for permission check and audit).
 * @returns An object with success status and message.
 */
export async function softDeleteElement(
  elementId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check permissions first (assuming canDeleteElement is updated)
    const permissionCheck = await canDeleteElement(elementId, userId)
    if (!permissionCheck.allowed) {
      return {
        success: false,
        message: permissionCheck.reason || 'Permission denied.',
      }
    }

    // Find the element to ensure it exists before update
    const element = await prisma.element.findUnique({
      where: { id: elementId },
    })

    if (!element) {
      return { success: false, message: 'Element not found' }
    }
    // Don't soft delete if already deleted
    if (element.isDeleted) {
      return {
        success: true,
        message: `Element "${element.name}" was already marked as deleted.`,
      }
    }

    // Update the element to mark as deleted
    const updatedElement = await prisma.element.update({
      where: { id: elementId },
      data: { isDeleted: true },
    })

    await logAuditEvent({
      actionType: AuditActionType.ELEMENT_SOFT_DELETE,
      performedByUserId: userId,
      resourceId: elementId,
      resourceType: ResourceType.ELEMENT,
      details: {},
    })

    return {
      success: true,
      message: `Element "${updatedElement.name}" has been soft-deleted (marked as deleted).`,
    }
  } catch (error) {
    console.error(`softDeleteElement: Failed for element ${elementId}:`, error)
    return {
      success: false,
      message: 'Failed to soft delete element due to an internal error.',
    }
  }
}

// --- Hard Deletion (Internal/Backend Use) ---

/**
 * Performs a direct hard delete of an element from the data store and removes associated permissions.
 * IMPORTANT: Assumes permissions have been checked AND dependencies handled (e.g., via cloning) by the calling process.
 * @param elementId The ID of the element to permanently delete.
 * @param performedByUserId The ID of the user *triggering* the action.
 * @returns An object indicating success or failure.
 */
export async function hardDeleteElementDirectly(
  elementId: string,
  performedByUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Use transaction for atomicity: delete permissions, then delete element
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete Associated Permissions
      const { count: removedPermissionCount } =
        await tx.permissionGrant.deleteMany({
          where: { resourceId: elementId },
        })
      if (removedPermissionCount > 0) {
        console.log(
          `Removed ${removedPermissionCount} permission grants associated with element ${elementId} being hard-deleted.`
        )
      }

      // 2. Delete the Element itself
      // Fetch name before deleting for the message
      const elementToDelete = await tx.element.findUnique({
        where: { id: elementId },
        select: { name: true },
      })
      const deletedElementName = elementToDelete?.name || 'Unknown Element'

      await tx.element.delete({
        where: { id: elementId },
      })

      return { deletedElementName, removedPermissionCount }
    })

    // Log audit event after successful transaction
    await logAuditEvent({
      actionType: AuditActionType.ELEMENT_DELETE,
      performedByUserId: performedByUserId,
      resourceId: elementId,
      resourceType: ResourceType.ELEMENT,
      details: { removedPermissionCount: result.removedPermissionCount },
    })

    return {
      success: true,
      message: `Element "${result.deletedElementName}" (${elementId}) has been hard-deleted. ${result.removedPermissionCount} associated permissions removed.`,
    }
  } catch (error: any) {
    // Check if the error is because the element to delete was not found
    if (error.code === 'P2025') {
      return { success: false, message: 'Element not found for hard deletion.' }
    }
    console.error(
      `hardDeleteElementDirectly: Failed for element ${elementId}:`,
      error
    )
    return {
      success: false,
      message: 'Failed to hard delete element due to an internal error.',
    }
  }
}

// --- Clone and Delete for Dependency Resolution (Internal/Backend Use) ---

/**
 * [Requires Update for Prisma] Clones an element for each dependent activity, updates the activities,
 * and then hard-deletes the original element.
 */
export async function _cloneElementForDependentActivitiesAndDeleteOriginal(
  elementId: string,
  performedByUserId: string,
  dependentActivitiesInput?: Activity[]
): Promise<{
  success: boolean
  message: string
  clonedElementIds?: Record<string, string> // Map<activityId, clonedElementId>
}> {
  console.warn(
    '_cloneElementForDependentActivitiesAndDeleteOriginal function needs updating for Prisma relations.'
  )
  // Basic structure remains, but Prisma calls replace mock array manipulations

  const element = await prisma.element.findUnique({ where: { id: elementId } })
  if (!element || element.isDeleted) {
    return {
      success: false,
      message: 'Original element not found or already deleted for cloning.',
    }
  }

  // Find dependent activities if not provided (ensure this function is updated too)
  const activitiesToUpdate =
    dependentActivitiesInput || (await checkElementDependencies(elementId))

  if (activitiesToUpdate.length === 0) {
    // No dependencies, just hard delete the original
    const deleteResult = await hardDeleteElementDirectly(
      elementId,
      performedByUserId
    )
    return {
      success: deleteResult.success,
      message: deleteResult.success
        ? `Element ${elementId} had no dependencies and was hard-deleted.`
        : `Element ${elementId} had no dependencies but hard-delete failed: ${deleteResult.message}`,
    }
  }

  const clonedElementIds: Record<string, string> = {}

  try {
    // Process clones and updates within a transaction? Maybe too complex?
    // Process one by one for now.
    for (const activity of activitiesToUpdate) {
      const cloneOwnerId = activity.ownerId // Or system user?
      const newCloneId = `elem-clone-${element.id.substring(5)}-${activity.id.substring(4)}-${Date.now().toString().slice(-5)}`

      // Create the clone
      const clonedElement = await prisma.element.create({
        data: {
          id: newCloneId,
          ownerId: cloneOwnerId,
          // Copy relevant fields, DO NOT copy 'id', set new 'createdAt'
          name: `${element.name} (Archived copy for ${activity.name})`,
          content: element.content,
          explanation: element.explanation,
          isDeleted: false, // Clones are not deleted initially
          // DO NOT link activities here, do it in the activity update
        },
      })

      clonedElementIds[activity.id] = clonedElement.id

      // Update the activity: disconnect old element, connect new element
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          elements: {
            disconnect: { id: elementId },
            connect: { id: clonedElement.id },
          },
        },
      })
    }

    // After successfully cloning and updating all activities, hard-delete the original
    const finalDeleteResult = await hardDeleteElementDirectly(
      elementId,
      performedByUserId
    )
    if (!finalDeleteResult.success) {
      // This is problematic - clones exist but original delete failed.
      // Manual intervention might be needed. Log critical error.
      console.error(
        `CRITICAL: Cloned element ${elementId} for dependencies, but failed to hard-delete original: ${finalDeleteResult.message}`
      )
      return {
        success: false,
        message: `Cloning succeeded but failed to delete original element ${elementId}. Requires administrative review.`,
        clonedElementIds,
      }
    }

    return {
      success: true,
      message: `Element ${elementId} cloned for ${activitiesToUpdate.length} activities and original hard-deleted.`,
      clonedElementIds,
    }
  } catch (error) {
    console.error(
      `_cloneElementForDependentActivitiesAndDeleteOriginal: Failed during cloning/update for element ${elementId}:`,
      error
    )
    // Rollback is tricky here without a full transaction. Clones might be left orphaned.
    return {
      success: false,
      message: 'Failed during clone/update process. Potential orphaned clones.',
    }
  }
}
