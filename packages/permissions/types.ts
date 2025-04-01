export enum ResourceType {
  ELEMENT = 'element',
  ACTIVITY = 'activity',
  USER_GROUP = 'user_group',
  OWNER = 'owner',
}

export enum ShareMode {
  ACTIVITY_ONLY = 'activity_only',
  ACTIVITY_AND_ELEMENTS = 'activity_and_elements',
}

export enum AccessLevel {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export enum PrincipalType {
  USER = 'USER',
  GROUP = 'GROUP',
}

export const AccessLevelNames = {
  [AccessLevel.VIEWER]: 'viewer',
  [AccessLevel.EDITOR]: 'editor',
  [AccessLevel.ADMIN]: 'admin',
  [AccessLevel.OWNER]: 'owner',
}

interface ResourceBase {
  id: string
  ownerId: string
  createdAt: Date
  type: ResourceType
  isDeleted?: boolean
}

export interface Element extends ResourceBase {
  type: ResourceType.ELEMENT
  name: string
  content: string
  explanation?: string
}

export enum ActivityType {
  PRACTICE_QUIZ = 'practiceQuiz',
  LIVE_QUIZ = 'liveQuiz',
  MICROLEARNING = 'microlearning',
  GROUP_ACTIVITY = 'groupActivity',
}

export interface Activity extends ResourceBase {
  type: ResourceType.ACTIVITY
  activityType: ActivityType
  name: string
  displayName: string
  description?: string
  elementIds: string[]
}

export interface UserGroup extends ResourceBase {
  type: ResourceType.USER_GROUP
  name: string
  description?: string
  isDeleted: boolean
}

export interface GroupMembership {
  id: string
  groupId: string
  userId: string
  addedByUserId: string
  addedAt: Date
}

export enum PermissionScope {
  GLOBAL = 'global',
  ACTIVITY_ONLY = 'activity_only',
}

export interface ShareActivityOptions {
  activityId: string
  level: AccessLevel // Level to grant on the Activity itself
  // Provide EITHER userId OR groupId
  userId?: string // User ID to share with
  groupId?: string // Group ID to share with
  grantedBy: string
  reason?: string

  // --- NEW: Propagation Controls --- (User choices when sharing)
  // Explicit controls allow overriding defaults. null/undefined means use system default.
  propagateToObject?: boolean | null
  propagateObjectLevel?: AccessLevel | null
  // propagateToResource options likely not relevant when sharing an *Activity*
}

export enum AuditActionType {
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_UPDATE = 'permission_update',
  PERMISSION_REVOKE = 'permission_revoke',
  OWNERSHIP_TRANSFER = 'ownership_transfer',
  GROUP_MEMBER_ADD = 'group_member_add',
  GROUP_MEMBER_REMOVE = 'group_member_remove',
  ELEMENT_DELETE = 'element_delete',
  ELEMENT_SOFT_DELETE = 'element_soft_delete',
  ACTIVITY_SHARE = 'activity_share',
}

export interface AuditLogEntry {
  id: string
  timestamp: Date
  actionType: AuditActionType
  performedBy: string
  resourceId: string
  resourceType: ResourceType
  details: {
    targetUserId?: string
    groupId?: string
    targetGroupId?: string
    memberId?: string
    permissionBefore?: AccessLevel | null
    permissionAfter?: AccessLevel | null
    reason?: string
    metadata?: Record<string, any>
    // Added optional fields for shareActivity logs
    shareMode?: ShareMode
    accessLevel?: AccessLevel
    // Added optional fields for PERMISSION_REVOKE logs
    revokedGrantId?: string
    removedDerivedGrantCount?: number
    // Added optional field for PERMISSION_UPDATE logs
    updatedGrantId?: string
    // Added optional field for ELEMENT_DELETE logs
    removedPermissionCount?: number
    // Added optional fields for OWNERSHIP_TRANSFER logs
    previousOwnerId?: string
    newOwnerId?: string
  }
}
