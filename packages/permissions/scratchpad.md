# KlickerUZH Permission Management System

## Project Overview
Building a permission management system for KlickerUZH that allows users to create and share elements (e.g., quiz questions) and activities (comprised of multiple elements) with different permission levels:
- VIEWER (read)
- EDITOR (write)
- ADMIN (manage permissions)
- OWNER (full control with transfer rights)

## Current Progress

### Completed Tasks
- [X] Define data models (AccessLevel enum, Element and Activity interfaces, PermissionGrant interface)
- [X] Create mock data for testing (elements, activities, permission grants)
- [X] Implement core permission functions:
  - [X] Calculate effective permissions (direct and derived)
  - [X] Permission granting and revoking
  - [X] Ownership transfer
  - [X] Element deletion checks
- [X] Implement complete permission table for caching:
  - [X] Compute permission table for all users and resources
  - [X] Serialize/deserialize permission table
  - [X] Lookup permissions from cached table
- [X] Create demo function to test all features
- [X] Implement proper element deletion handling when used in activities
- [X] Implement activity-element permission propagation

### Next Steps
- [ ] Implement efficient invalidation strategy for the permission cache
- [ ] Add unit tests for all permission functions
- [ ] Integrate with the actual database schema
- [ ] Handle permission inheritance for new elements added to activities
- [X] **Improve handling of derived element permissions through activity sharing**

## Implementation Notes

### Permission Calculation Logic
- Direct permissions: Explicitly granted to a user for a resource
- Derived permissions: Inherited from containing resources (e.g., activities)
- Ownership: Resource creators automatically get OWNER permission
- Permission propagation: When a user has access to an activity, they get appropriate (but potentially reduced) permissions on contained elements

### Caching Strategy
- Complete permission table is computed for all users and resources
- Table is serialized for storage and deserialized when needed
- Lookup from the table is O(1) operation, much faster than recalculating permissions

### Element Deletion Challenges
When an element is used in one or more activities, simply deleting it would break those activities. We've implemented two approaches:

1. **Soft Deletion**: The `softDeleteElement()` function marks elements as deleted but keeps them in the database, allowing activities to continue using them.

2. **Clone-and-Replace**: The `cloneElementForActivities()` function creates element clones for each activity that uses the element, updates the activities to reference the clones, and then deletes the original. This preserves the content for each activity while allowing the original to be removed.

The system now prevents direct deletion of elements used in activities, redirecting users to use these safer alternatives instead.

### Activity-Element Permission Propagation

When a user is granted access to an activity, they also need to see all elements within that activity. We've implemented a permission propagation system that:

1. **Automatically grants READ access** to all elements in an activity when a user is granted any permission on the activity
2. **Verifies element access** before allowing activity editing, ensuring users can see all elements they need to work with
3. **Provides detailed feedback** about which elements a user might be missing access to

This approach ensures that:
- Users can properly view and edit activities they have access to
- Element permissions are managed automatically when activities are shared
- The UI can show appropriate warnings if some elements are inaccessible

The implementation includes:
- `grantPermissionWithPropagation()`: Enhanced permission granting with automatic propagation
- `propagateActivityPermissionsToElements()`: Creates READ permissions on all elements in an activity
- `canEditActivityWithElements()`: Checks if a user can edit an activity and all its elements

### Derived Element Permissions Through Activity Sharing

**Challenge:** When User A shares an element with User B, who then creates an activity with that element and shares it with User C, User C implicitly gains access to the element. This behavior may not be intuitive to all users.

**Possible Solutions:**

1. **UI Clarity for Derived Permissions**
   - Visually distinguish between direct and derived permissions in the UI
   - Show permission inheritance paths (e.g., "Access via Activity X")
   - Provide tooltips explaining how permissions were obtained

2. **Granular Permission Control**
   - Allow activity sharers to specify whether recipients get:
     - Activity-only access to elements (can only use elements within the activity)
     - Full library access to elements (can reuse elements in their own activities)
   - Implement permission scopes (e.g., `VIEWER_SCOPED_TO_ACTIVITY`)

3. **Permission Override Mechanisms**
   - Allow element owners to override derived permissions
   - Provide conflict resolution when overrides would break activities
   - Implement permission expiration or automatic revocation when activities are deleted

4. **Element Instance Isolation**
   - Further isolate element instances from original elements
   - Create "shadow copies" of elements that exist only in the context of an activity
   - Implement reference counting to track usage and dependencies

**Technical Implementation Considerations:**
- Need to track permission provenance (how a permission was granted)
- May require extending the permission model with scopes or contexts
- UI needs to clearly communicate permission relationships
- Cache invalidation becomes more complex with overrides and scopes

**Implemented Solution:**

We've implemented a **permission scoping system** that allows element permissions to be restricted to specific activity contexts:

1. **Enhanced Permission Model:**
   - Added `scope` field to `PermissionGrant` to specify where a permission applies
   - Added `derivedFrom` field to track the source of derived permissions
   - Implemented `PermissionScope.ACTIVITY_ONLY` to restrict element access to activity contexts

2. **Context-Aware Permission Checking:**
   - Updated `getEffectivePermission()` to consider the context when checking permissions
   - Element permissions with `ACTIVITY_ONLY` scope are only valid within their activity context
   - Users can see and use elements in shared activities but not in their library

3. **Granular Sharing Control:**
   - Added options to `grantPermissionWithPropagation()` to specify element permission scope
   - Activity owners can choose whether shared users get global or activity-scoped access to elements

This solution balances usability (users can still edit shared activities) with control (activity owners can limit element reuse). The demo shows that User D can access Element 1 within Activity X but not outside that context.

## Lessons
- Using `tsx` for running TypeScript files directly
- Used `pnpm` as the package manager for the project
- Implemented tsconfig.json with recommended settings from https://www.totaltypescript.com/tsconfig-cheat-sheet
- Nested Map structure works well for the permission table, with O(1) lookup time
- KlickerUZH uses an instance-based model where elements are cloned to instances when added to activities
- When editing an activity, new instances are created for all elements to prevent changes to one activity from affecting others
- Permission system must account for both original elements (for visibility in the library) and instances (for use in activities)
