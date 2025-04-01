import { logAuditEvent } from './audit.js'
import prisma from './lib/prisma.js'
// Import Prisma types
import type { GroupMembership, UserGroup } from '@prisma/client'
import { AuditActionType, ResourceType } from './types.js'

/**
 * Check if a user is a member of a group
 * @param groupId The ID of the group
 * @param userId The ID of the user
 * @returns True if the user is a member of the group
 */
export async function isGroupMember(
  groupId: string,
  userId: string
): Promise<boolean> {
  const membership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId: groupId,
        userId: userId,
      },
    },
  })
  return !!membership
}

/**
 * Get all groups that a user is a member of
 * @param userId The ID of the user
 * @returns Array of group IDs
 */
export async function getUserGroups(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: userId },
    select: { groupId: true },
  })
  return memberships.map((membership) => membership.groupId)
}

/**
 * Get all members (user IDs) of a group
 * @param groupId The ID of the group
 * @returns Array of user IDs
 */
export async function getGroupMembers(groupId: string): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId: groupId },
    select: { userId: true },
  })
  return memberships.map((membership) => membership.userId)
}

/**
 * Add a user to a group
 * @param groupId The ID of the group
 * @param userId The ID of the user to add
 * @param addedBy The ID of the user adding the member
 * @returns Result of the operation
 */
export async function addGroupMember(
  groupId: string,
  userId: string,
  addedBy: string
): Promise<{
  success: boolean
  message: string
  membership?: GroupMembership
}> {
  try {
    // Check if the group exists
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } })
    if (!group || group.isDeleted) {
      return { success: false, message: 'Group not found or has been deleted' }
    }

    // Check if user is already a member
    if (await isGroupMember(groupId, userId)) {
      return {
        success: false,
        message: 'User is already a member of this group',
      }
    }

    // Add the membership
    const newMembership = await prisma.groupMembership.create({
      data: {
        groupId: groupId,
        userId: userId,
        addedByUserId: addedBy,
      },
    })

    await logAuditEvent({
      actionType: AuditActionType.GROUP_MEMBER_ADD,
      performedByUserId: addedBy,
      resourceId: groupId,
      resourceType: ResourceType.USER_GROUP,
      details: {
        memberId: userId,
      },
    })
    return {
      success: true,
      message: 'User added to group successfully',
      membership: newMembership,
    }
  } catch (error) {
    console.error(
      `addGroupMember: Failed to add user ${userId} to group ${groupId}:`,
      error
    )
    return {
      success: false,
      message: 'Failed to add user to group due to an internal error.',
    }
  }
}

/**
 * Remove a user from a group
 * @param groupId The ID of the group
 * @param userId The ID of the user to remove
 * @param removedBy The ID of the user performing the removal (for audit log)
 * @returns Result of the operation
 */
export async function removeGroupMember(
  groupId: string,
  userId: string,
  removedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Use delete based on the compound key
    const deleteResult = await prisma.groupMembership.delete({
      where: {
        groupId_userId: {
          groupId: groupId,
          userId: userId,
        },
      },
    })

    // If delete succeeded (didn't throw), log the event
    await logAuditEvent({
      actionType: AuditActionType.GROUP_MEMBER_REMOVE,
      performedByUserId: removedBy,
      resourceId: groupId,
      resourceType: ResourceType.USER_GROUP,
      details: {
        memberId: userId,
      },
    })
    return { success: true, message: 'User removed from group successfully' }
  } catch (error: any) {
    // Check if the error is because the record was not found
    if (error.code === 'P2025') {
      return { success: false, message: 'User is not a member of this group' }
    }
    console.error(
      `removeGroupMember: Failed to remove user ${userId} from group ${groupId}:`,
      error
    )
    return {
      success: false,
      message: 'Failed to remove user from group due to an internal error.',
    }
  }
}

/**
 * Create a new user group
 * @param name The name of the group
 * @param ownerId The ID of the group owner
 * @param description Optional description of the group
 * @returns The created group or null if failed
 */
export async function createUserGroup(
  name: string,
  ownerId: string,
  description?: string
): Promise<UserGroup | null> {
  try {
    const newGroup = await prisma.userGroup.create({
      data: {
        id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: name,
        description: description,
        ownerId: ownerId,
      },
    })
    return newGroup
  } catch (error) {
    console.error(`createUserGroup: Failed to create group "${name}":`, error)
    return null
  }
}
