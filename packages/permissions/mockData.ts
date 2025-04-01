import {
  AccessLevel,
  Activity,
  ActivityType,
  AuditLogEntry,
  Element,
  GroupMembership,
  PermissionGrant,
  ResourceType,
  UserGroup,
} from './types.js'

// Mock data for elements
export const mockElements: Element[] = [
  {
    id: 'elem-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-15'),
    type: ResourceType.ELEMENT,
    name: 'Multiple Choice Question about TypeScript',
    content: 'What is TypeScript?',
    explanation:
      'TypeScript is a superset of JavaScript that adds static typing.',
  },
  {
    id: 'elem-2',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-20'),
    type: ResourceType.ELEMENT,
    name: 'Free Text Question about React',
    content: 'Explain the concept of React hooks.',
  },
  {
    id: 'elem-3',
    ownerId: 'user-2',
    createdAt: new Date('2025-01-25'),
    type: ResourceType.ELEMENT,
    name: 'Numerical Question about Algorithms',
    content: 'What is the time complexity of quicksort in the worst case?',
  },
  {
    id: 'elem-4',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-01'),
    type: ResourceType.ELEMENT,
    name: 'Content Slide about Database Design',
    content: 'Introduction to relational database design principles.',
  },
]

// Mock data for activities
export const mockActivities: Activity[] = [
  {
    id: 'act-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-30'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.PRACTICE_QUIZ,
    name: 'programming-basics',
    displayName: 'Programming Basics Quiz',
    description: 'A quiz covering basic programming concepts',
    elementIds: ['elem-1', 'elem-2'],
  },
  {
    id: 'act-2',
    ownerId: 'user-2',
    createdAt: new Date('2025-02-05'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.LIVE_QUIZ,
    name: 'algorithms-live',
    displayName: 'Algorithms Live Session',
    elementIds: ['elem-3'],
  },
  {
    id: 'act-3',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-10'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.GROUP_ACTIVITY,
    name: 'database-workshop',
    displayName: 'Database Design Workshop',
    description: 'Collaborative workshop on database design',
    elementIds: ['elem-4', 'elem-3'],
  },
]

// Mock data for user groups
export const mockUserGroups: UserGroup[] = [
  {
    id: 'group-1',
    name: 'Teaching Assistants',
    description: 'TAs for Programming 101',
    ownerId: 'user-1',
    isDeleted: false,
    createdAt: new Date(),
    type: ResourceType.USER_GROUP,
  },
  {
    id: 'group-2',
    name: 'Course Instructors',
    description: 'Senior instructors with full access',
    ownerId: 'user-1',
    isDeleted: false,
    createdAt: new Date(),
    type: ResourceType.USER_GROUP,
  },
]

// Mock data for users (Note: User type is not exported, keeping simple structure)
export const mockUsers = [
  { id: 'user-1', name: 'User 1' },
  { id: 'user-2', name: 'User 2' },
  { id: 'user-3', name: 'User 3' },
]

// Mock data for group memberships
export const mockGroupMemberships: GroupMembership[] = [
  {
    id: 'membership-1',
    groupId: 'group-1',
    userId: 'user-2',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
  {
    id: 'membership-2',
    groupId: 'group-1',
    userId: 'user-3',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
  {
    id: 'membership-3',
    groupId: 'group-2',
    userId: 'user-2',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
]

// Mock permission grants
export const mockPermissionGrants: PermissionGrant[] = [
  // Direct element permissions
  {
    id: 'perm-1',
    resourceId: 'elem-1',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-2',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-16'),
  },
  {
    id: 'perm-2',
    resourceId: 'elem-2',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-3',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-21'),
  },

  // Direct activity permissions
  {
    id: 'perm-3',
    resourceId: 'act-1',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-2',
    level: AccessLevel.ADMIN,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-31'),
  },
  {
    id: 'perm-4',
    resourceId: 'act-2',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-1',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-2',
    grantedAt: new Date('2025-02-06'),
  },
  {
    id: 'perm-5',
    resourceId: 'act-3',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-2',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-3',
    grantedAt: new Date('2025-02-11'),
  },
  {
    id: 'perm-6',
    resourceId: 'elem-3',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-1',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-2',
    grantedAt: new Date('2025-02-12'),
  },
  {
    id: 'perm-7',
    resourceId: 'elem-4',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-3',
    level: AccessLevel.ADMIN,
    grantedBy: 'user-3',
    grantedAt: new Date('2025-02-13'),
  },
  {
    id: 'perm-8',
    resourceId: 'elem-clone-elem-2-act-1',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-2',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },

  // Group permissions
  {
    id: 'perm-g1',
    resourceId: 'elem-4',
    resourceType: ResourceType.ELEMENT,
    userId: 'group-1', // Permission granted to the group
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
  {
    id: 'perm-g2',
    resourceId: 'act-3',
    resourceType: ResourceType.ACTIVITY,
    userId: 'group-1', // Permission granted to the group
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
  {
    id: 'perm-g3',
    resourceId: 'elem-3',
    resourceType: ResourceType.ELEMENT,
    userId: 'group-2', // Permission granted to the group
    level: AccessLevel.ADMIN,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
]

// Mock storage for audit logs
export const mockAuditLogs: AuditLogEntry[] = []
