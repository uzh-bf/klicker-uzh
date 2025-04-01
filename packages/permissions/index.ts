// Main entry point for the permissions package

// Re-export functions from activityManagement
export {
  canAccessAllActivityElements,
  canEditActivityWithElements,
  getActivityElements,
  getElementActivities,
  grantPermissionWithPropagation,
  propagatePermissionsToContainedObjects,
  shareActivity,
} from './activityManagement.js'

// Re-export functions from audit
// (Export logAuditEvent if it needs to be part of the public API)
// export { logAuditEvent } from './audit.js';

// Re-export functions from core
export {
  calculateAllDerivedPermissions,
  calculateEffectivePermission,
  canPerformOperation,
  getDirectPermission,
  getPermissionRank,
  getResourceById,
  isResourceOwner,
} from './core.js'

// Re-export functions from elementManagement
export {
  _cloneElementForDependentActivitiesAndDeleteOriginal,
  canDeleteElement,
  checkElementDependencies,
  hardDeleteElementDirectly,
  softDeleteElement,
} from './elementManagement.js'

// Re-export functions from groups
export {
  addGroupMember,
  createUserGroup,
  getGroupMembers,
  getUserGroups,
  isGroupMember,
  removeGroupMember,
} from './groups.js'

// Re-export functions from permissionManagement
export {
  grantPermission,
  revokePermission,
  transferOwnership,
} from './permissionManagement.js'

// Re-export all types and enums
export * from './types.js'
