# KlickerUZH Permission Management System

## Project Overview

Building a permission management system for KlickerUZH that allows users to create and share elements (e.g., quiz questions) and activities (comprised of multiple elements) with different permission levels:

- VIEWER (read)
- EDITOR (write)
- ADMIN (manage permissions)
- OWNER (full control with transfer rights)

## Implementation Status

### Current System Architecture

The permission management system is now fully implemented with the following key components:

1. **Core Data Models**:

   - Resource types (Element, Activity, UserGroup)
   - Access levels (VIEWER, EDITOR, ADMIN, OWNER)
   - Permission grants with support for scoping and derivation tracking
   - User groups and group memberships

2. **Permission Management Functions**:

   - Direct permission granting and revoking
   - Permission propagation (activity to elements)
   - Ownership transfer
   - Group-based permission inheritance
   - Context-aware permission checking

3. **Performance Optimizations**:

   - Complete permission table computation
   - Serialization/deserialization for caching
   - O(1) permission lookups from cached tables

4. **Resource Management**:

   - Safe element deletion with dependency checking
   - Soft deletion and clone-and-replace strategies
   - Activity-element relationship management

5. **User Group System**:
   - Group creation and management
   - Group membership functions
   - Permission inheritance from groups to members

### Completed Features

- [x] Basic permission model with four access levels
- [x] Direct and derived permission calculation
- [x] Permission caching and lookup optimization
- [x] Safe element deletion strategies
- [x] Activity-element permission propagation
- [x] Permission scoping for context-specific access
- [x] User group permission inheritance
- [x] Edge case identification and handling plans
- [x] Audit logging for permission changes

### Pending Implementation

- [ ] Temporal permissions with expiration dates
- [ ] Bulk permission operations with transaction support
- [ ] UI components for permission management
- [ ] Circular reference detection and prevention
- [ ] Performance benchmarking for large datasets

## Edge Case Handling Implementation Status

Based on our detailed edge case analysis, here's the current implementation status:

| Edge Case                    | Status         | Notes                                                     |
| ---------------------------- | -------------- | --------------------------------------------------------- |
| Add Direct Permission        | ✅ Implemented | Via `grantPermission` function                            |
| Add Group Permission         | ✅ Implemented | Via enhanced `grantPermissionWithPropagation`             |
| Modify Direct Permission     | ✅ Implemented | Existing permission is overridden                         |
| Remove Direct Permission     | ✅ Implemented | Via `revokePermission` function                           |
| Conflict Resolution          | ✅ Implemented | Direct permissions take precedence over group permissions |
| Activity-Element Propagation | ✅ Implemented | Via `propagateActivityPermissionsToElements`              |
| Resource Editing             | ⚠️ Partial     | Content changes handled, structural changes need work     |
| Resource Deletion            | ✅ Implemented | Both soft deletion and clone-and-replace strategies       |
| Ownership Transfer           | ✅ Implemented | Via `transferOwnership` function                          |
| Circular Permission Checks   | ⚠️ Partial     | Basic safeguards in place, needs enhancement              |
| Group Membership Changes     | ✅ Implemented | Via add/remove group member functions                     |
| Bulk Permission Changes      | ❌ Pending     | Not yet implemented                                       |
| Temporal Permissions         | ❌ Pending     | Not yet implemented                                       |

## Implementation Summary

The enhanced activity sharing functionality has been successfully implemented with the following components:

1. **ShareMode Enum**: Defines two sharing modes:

   - `ACTIVITY_ONLY`: Grants permissions to the activity with activity-scoped element permissions
   - `ACTIVITY_AND_ELEMENTS`: Grants permissions to both the activity and its elements with global permissions

2. **ShareActivityOptions Interface**: Encapsulates all parameters needed for sharing:

   - `userId`: The user to share with
   - `level`: The access level to grant
   - `grantedBy`: The user granting the permission
   - `shareMode`: The sharing mode (ACTIVITY_ONLY or ACTIVITY_AND_ELEMENTS)
   - `reason`: Optional reason for sharing

3. **shareActivity Function**: Implements the sharing logic:

   - Grants permission to the activity
   - Propagates permissions to elements based on the selected sharing mode
   - Logs the sharing action to the audit log

4. **Audit Logging**: Records all sharing actions with detailed information:

   - Who shared the activity
   - Who received access
   - What permissions were granted
   - Which sharing mode was used
   - The reason for sharing

5. **Demo Implementation**: Created a comprehensive demo that showcases:
   - Sharing with ACTIVITY_ONLY mode
   - Sharing with ACTIVITY_AND_ELEMENTS mode
   - Verification of permission propagation
   - Audit log entries for sharing actions

This implementation provides a flexible and secure way to share activities while maintaining control over element permissions. It integrates with the existing permission system and audit logging functionality to ensure proper tracking and accountability.

## Next Steps for Implementation

1. **Complete Edge Case Handling:**

   - [ ] Enhance circular reference detection
   - [ ] Implement bulk permission operations
   - [ ] Add temporal permission support

2. **Performance Optimization:**

   - [ ] Optimize permission calculation for large datasets
   - [ ] Implement more efficient caching strategies
   - [ ] Add benchmarking to measure performance improvements

3. **UI Integration:**

   - [ ] Design UI components for permission management
   - [ ] Create visualizations for permission inheritance
   - [ ] Implement user notifications for permission changes

4. **Testing and Documentation:**
   - [ ] Create comprehensive test suite for all edge cases
   - [ ] Test performance with large datasets
   - [ ] Document the permission system architecture and API

## Lessons

1. **TypeScript Runtime**: Always use `tsx` instead of `ts-node` for running TypeScript files in this project.

2. **Optional Chaining**: When working with complex objects like audit logs, always use optional chaining (`?.`) to safely access potentially undefined properties.

3. **Function Parameter Design**: The `logAuditEvent` function uses a single object parameter with named fields, which is more maintainable than multiple positional parameters.

4. **Audit Logging**: The audit logging system is a critical component for tracking permission changes and should be integrated with all permission-modifying functions.

5. **Permission Scoping**: The permission system supports both global and activity-scoped permissions, providing flexibility in how resources are shared.

6. **Export Management**: When creating demo files, ensure all necessary functions and variables are properly exported from the main module.

7. **Error Handling**: Implement proper error handling and null checks to prevent runtime errors, especially when dealing with user input or external data.

## Current Task: Permission Derivation from Database Schema

### Requirements

1. Update our permission model to align with the provided database schema:

   - PermissionLevel: READ, WRITE, EXECUTE, ADMIN
   - PermissionStatus: REQUESTED, GRANTED
   - UserGroup structure with members and admins
   - Various resource types that can have permissions

2. Implement a function that:
   - Takes a list of direct permissions from the database
   - Derives all effective permissions (including group permissions)
   - Deduplicates permissions (max 1 permission per user-resource pair)
   - Resolves permission precedence (higher specificity wins)
   - Returns a comprehensive list of effective permissions

### Progress

- [x] Update permission model types to match database schema
- [x] Implement permission derivation function
- [x] Add deduplication and precedence resolution
- [x] Test with sample data

### Implementation Summary

1. **Database Permission Model**:

   - Created types that match the Prisma schema: `PermissionLevel`, `PermissionStatus`, `ResourceType`
   - Implemented interfaces for `UserGroup` and `DatabasePermission`
   - Added mapping functions between database models and our internal models

2. **Permission Derivation Function**:

   - Implemented `deriveEffectivePermissions` function that:
     - Takes raw database permissions and user groups
     - Processes direct user permissions first
     - Processes group permissions and resolves conflicts
     - Handles owner permissions with highest precedence
     - Returns deduplicated permissions with proper precedence

3. **Precedence Rules**:

   - Direct permissions take precedence over group permissions
   - Owner permissions take precedence over everything
   - For group permissions, higher permission levels take precedence
   - Requested permissions are filtered out (only granted permissions are considered)

4. **Testing**:
   - Created comprehensive test cases with various scenarios:
     - Direct vs. group permission conflicts
     - Multiple group memberships
     - Owner permissions
     - Requested vs. granted permissions

## Current Task: Enhanced Activity Sharing with PermissionScope

### Requirements

- When a user shares an activity, they should have two options:
  1. Share only the activity (activity-scoped permissions)
     - Direct permission to the activity will be created
     - Elements will be accessible only within the activity context
     - No standalone access to elements outside the activity
  2. Share the activity and all contained elements (global permissions)
     - Direct permission to the activity will be created
     - Direct permissions to all contained elements will also be created
     - Elements will be accessible both within and outside the activity context

### Implementation Plan

1. **Enhance Activity Sharing Interface**

   - [ ] Create a `ShareActivityOptions` interface with:
     - `shareMode`: enum with values `ACTIVITY_ONLY` or `ACTIVITY_AND_ELEMENTS`
     - `level`: AccessLevel to grant
     - `userId`: ID of user to share with
     - `grantedBy`: ID of user granting the permission

2. **Implement Enhanced Sharing Function**

   - [ ] Create a `shareActivity` function that:
     - Takes an activity ID and ShareActivityOptions
     - Grants permission to the activity
     - Based on shareMode, either:
       - Creates activity-scoped permissions for elements (ACTIVITY_ONLY)
       - Creates global permissions for all elements (ACTIVITY_AND_ELEMENTS)
     - Returns a result with all created permissions

3. **Update Permission Propagation**

   - [ ] Modify `propagateActivityPermissionsToElements` to support both sharing modes
   - [ ] Ensure proper scope is set on propagated permissions

4. **Add Audit Logging**

   - [ ] Log the activity sharing with appropriate details
   - [ ] Include the sharing mode in the audit log

5. **Update Permission Calculation**
   - [ ] Ensure `calculateEffectivePermission` correctly handles both types of sharing
   - [ ] Optimize permission lookup for activity-scoped elements

### Implementation Details

#### ShareMode Enum

```typescript
export enum ShareMode {
  ACTIVITY_ONLY = 'activity_only',
  ACTIVITY_AND_ELEMENTS = 'activity_and_elements',
}
```

#### ShareActivityOptions Interface

```typescript
export interface ShareActivityOptions {
  shareMode: ShareMode
  level: AccessLevel
  userId: string
  grantedBy: string
  reason?: string
}
```

#### shareActivity Function Signature

```typescript
export function shareActivity(
  activityId: string,
  options: ShareActivityOptions
): {
  success: boolean
  message: string
  activityPermission?: PermissionGrant
  elementPermissions?: PermissionGrant[]
}
```

### Progress

- [x] Define ShareMode enum and ShareActivityOptions interface
- [x] Implement shareActivity function
- [x] Update propagateActivityPermissionsToElements
- [x] Add audit logging for activity sharing
- [x] Test both sharing modes

## Implementation Summary

### Audit Logging System

We've successfully implemented a comprehensive audit logging system for the permission management module. The system tracks all permission-related operations and provides flexible querying capabilities.

#### Key Features

1. **Comprehensive Event Tracking**

   - All permission changes are logged with detailed context
   - Each log entry includes who performed the action, what changed, and when
   - Before/after states are captured for permission changes

2. **Flexible Querying**

   - Logs can be filtered by:
     - Time range
     - User who performed the action
     - User affected by the action
     - Resource ID
     - Action type

3. **Integration Points**
   - Audit logging is integrated with all permission-modifying functions:
     - `grantPermission`: Logs permission grants with before/after states
     - `revokePermission`: Logs permission revocations with before state
     - `transferOwnership`: Logs ownership transfers with previous and new owners
     - `addGroupMember`: Logs group membership additions
     - `removeGroupMember`: Logs group membership removals
     - `softDeleteElement`: Logs element soft deletions

#### Technical Implementation

1. **Data Model**

   - `AuditActionType` enum defines all possible audit event types
   - `AuditLogEntry` interface provides a structured format for log entries
   - Flexible `details` object allows storing action-specific information

2. **Core Functions**

   - `logAuditEvent`: Central function for recording all audit events
   - `getAuditLogs`: Main query function with flexible filtering options
   - Specialized query functions for common use cases

3. **Demo and Testing**
   - Created a comprehensive demo that showcases all audit logging functionality
   - Verified that logs contain all necessary information
   - Tested filtering and querying capabilities

#### Future Enhancements

1. **Persistence**

   - Currently using in-memory storage (mockAuditLogs array)
   - Need to implement database storage for production use

2. **Performance Optimizations**

   - Add pagination for large log volumes
   - Consider indexing strategies for efficient queries

3. **User Interface**

   - Create admin UI for viewing and searching audit logs
   - Add visualization tools for audit log analysis

4. **Compliance Features**
   - Add export functionality for compliance reporting
   - Implement log retention policies

## Appendix: Detailed Edge Case Handling Plan

Based on a thorough analysis of potential edge cases in the permission system, here's a detailed plan to address them:

### 1. Add Direct Permission

- **Problem:** Granting a user a direct permission (VIEWER, EDITOR, ADMIN) on a resource.
- **Solution:**
  - Update the permission grant store and cache.
  - Trigger recalculation of effective permissions.
  - Log the change for audit purposes.
- **Implementation Plan:**
  - Enhance the `grantPermission` function to update both direct and derived caches.
  - Add events or hooks for UI updates.
  - Create audit log mechanism.

### 2. Add Group Permission

- **Problem:** Granting a permission to a group so that each member inherits that access.
- **Solution:**
  - Ensure group-level permissions are applied on membership changes.
  - Recalculate effective permissions for members on group permission change.
- **Implementation Plan:**
  - Update group permission functions (e.g., in `grantPermissionWithPropagation`) to incorporate group permission changes.
  - Trigger a recalculation when group membership updates occur.
  - Integrate notifications for affected users.

### 3. Modify Direct Permission

- **Problem:** Changing a direct permission (e.g., elevating a VIEWER to EDITOR).
- **Solution:**
  - Override previous permissions and update derived permissions.
  - Maintain a history/versioning system.
- **Implementation Plan:**
  - Enhance permission update functions to compare new vs. old levels.
  - Update audit logs with change history.
  - Recompute cached permissions where necessary.

### 4. Remove Direct Permission

- **Problem:** Revoking a user's direct permission.
- **Solution:**
  - Remove the direct grant and fall back to inherited or group permissions.
- **Implementation Plan:**
  - Update `revokePermission` function to automatically trigger fallback recalculation.
  - Verify effective permission change across the permission cache.
  - Add error handling if no valid fallback exists.

### 5. Conflict Between Direct and Group Permissions

- **Problem:** Conflicts when direct and group permissions differ.
- **Solution:**
  - Define clear precedence (e.g., direct overrides group or vice versa, based on configuration).
- **Implementation Plan:**
  - Document and implement a configurable precedence policy.
  - Adjust the effective permission calculation to consider both.
  - Provide a UI dashboard indicating conflicts for adjustments if needed.

### 6. Propagation from Activity to Elements

- **Problem:** Propagating permissions from an activity to its associated elements.
- **Solution:**
  - Automatically derive appropriate permissions for each element based on the activity's level.
  - Consider existing direct permissions and prevent override if direct permission exists.
- **Implementation Plan:**
  - Refine `propagateActivityPermissionsToElements` to check and merge permissions.
  - Include a downgrade logic (e.g., ADMIN becomes EDITOR).
  - Validate and recalculate if any element already has a conflicting direct permission.

### 7. Editing a Resource

- **Problem:** Changing content or structural composition of resources.
- **Solution:**
  - Preserve direct permissions if changes are content-based.
  - Trigger recomputation of affected permissions if structure changes (e.g., modifying element composition in an activity).
- **Implementation Plan:**
  - Implement event listeners for structural changes.
  - Ensure updates in the permission calculations when an element is added or removed.
  - Document and maintain backward compatibility.

### 8. Deleting an Element or Activity

- **Problem:** Handling deletion (both soft and hard deletion) of resources.
- **Solution:**
  - For soft deletion, mark as deleted but maintain permission links.
  - For hard deletion, enforce dependency checks.
- **Implementation Plan:**
  - Integrate deletion guards in functions like `canDeleteElement`.
  - For hard deletion, assert that no active dependencies exist.
  - Recompute permissions to remove references to the deleted resource.
  - Log deletion events with audit trail.

### 9. Ownership Transfer

- **Problem:** Transferring resource ownership.
- **Solution:**
  - Automatically update permissions so that the new owner gains OWNER privileges.
  - Demote the previous owner's rights appropriately.
- **Implementation Plan:**
  - Update the `transferOwnership` function to trigger permission recalculations.
  - Log the ownership transfer and notify stakeholders.
  - Re-check derived permissions for consistency.

### 10. Circular/Recursive Permission Checks

- **Problem:** Potential infinite recursion during permission propagation.
- **Solution:**
  - Implement flags (e.g., `skipGroupCheck`) and recursion depth limits.
- **Implementation Plan:**
  - Enhance the calculation functions with safeguards.
  - Set a maximum recursion limit and throw error/log warning if exceeded.
  - Ensure that cyclic dependencies are identified and broken.

### 11. Changes in Group Membership

- **Problem:** Adding or removing users from groups.
- **Solution:**
  - Recalculate effective permissions when group membership changes.
- **Implementation Plan:**
  - Trigger permission recalculations upon membership change events.
  - Update cached permission tables immediately.
  - Notify affected users and log the change.

### 12. Bulk Permission Changes

- **Problem:** Applying changes to a large set of resources.
- **Solution:**
  - Provide batch processing with atomicity (rollback mechanisms).
- **Implementation Plan:**
  - Design bulk operation APIs that process permissions in transactions.
  - Implement rollback strategies on error.
  - Optimize performance for large-scale operations.

### 13. Temporal Permissions

- **Problem:** Managing permissions valid only within a specified time period.
- **Solution:**
  - Implement expiry dates in permission grants.
  - Set up scheduled re-checks to update or revoke expired permissions.
- **Implementation Plan:**
  - Extend permission schema to include a valid until attribute.
  - Add scheduled tasks to invalidate or renew permissions.
  - Alert users when permissions are nearing expiry.

## Appendix: User Group Permissions Implementation

### Requirements

- Implement user groups that can have permissions on resources (elements, activities)
- Users in a group inherit the group's permissions
- User's direct permissions take precedence if they're higher than the group's
- Derived permissions should account for both direct user permissions and group permissions

### Completed Implementation

- Added `UserGroup` and `GroupMembership` interfaces to model user groups and memberships
- Created mock data for user groups and group memberships
- Enhanced `calculateEffectivePermission()` to check both direct and group-derived permissions
- Updated `propagateActivityPermissionsToElements()` to handle group permissions
- Modified `grantPermissionWithPropagation()` to support group permission propagation
- Added a comprehensive demo function `runUserGroupPermissionDemo()` to test various group permission scenarios
- Implemented helper functions for working with groups:
  - `isGroupMember()` - Check if a user is a member of a group
  - `getUserGroups()` - Get all groups a user belongs to
  - `getGroupMembers()` - Get all members of a group
  - `addGroupMember()` - Add a user to a group
  - `removeGroupMember()` - Remove a user from a group
  - `createUserGroup()` - Create a new user group

### UI Considerations for Group Permissions

- Display group membership information in user profiles
- Show which permissions are derived from group membership vs. direct grants
- Allow administrators to manage group memberships and permissions in bulk
- Provide visual indicators for resources accessible via group membership
- When sharing resources, offer options to share with individual users or entire groups
