# @klicker-uzh/permissions

## Overview

This package implements the permission management system for KlickerUZH. It allows users (Principals) to own, manage, and share resources (Activities, Elements, UserGroups) with varying levels of access. The system supports direct grants to users or groups, as well as derived permissions based on container relationships (e.g., access to an Activity granting access to its Elements).

## Core Concepts

### Principals

- **Users:** Individual users identified by a unique `userId`.
- **Groups:** Collections of users (`UserGroup`) identified by a unique `groupId`. Groups can be granted permissions directly, and members inherit those permissions subject to precedence rules.

### Resources

- **Elements:** Individual content items (e.g., quiz questions, content slides) identified by `elementId`. Each Element has an `ownerId`.
- **Activities:** Collections of Elements, potentially representing quizzes, presentations, etc., identified by `activityId`. Each Activity has an `ownerId` and contains a list of `elementIds`.
- **UserGroups:** Groups themselves are resources that can be managed, identified by `groupId`. Each group has an `ownerId`.

### Access Levels

Permissions are granted at specific access levels, defined in `AccessLevel` enum:

1.  `VIEWER`: Read-only access.
2.  `EDITOR`: Read and write access.
3.  `ADMIN`: Read, write, and permission management access (granting/revoking up to ADMIN level).
4.  `OWNER`: Full control, including granting/revoking all levels and transferring ownership.

### Permission Grants (`PermissionGrant`)

The core data structure representing a permission assignment. Key fields:

- `id`: Unique identifier for the grant itself.
- `resourceId`: The ID of the resource permission is granted on.
- `resourceType`: The type of the resource (`ElementType`, `ActivityType`, `UserGroupType`).
- `userId`: The ID of the principal receiving the grant (**can be a `userId` or a `groupId`**).
- `level`: The `AccessLevel` granted.
- `grantedBy`: `userId` of the user who performed the grant action.
- `grantedAt`: Timestamp of the grant.
- `derivedFrom?`: Optional object indicating if this grant was derived from another grant (see below). Contains `resourceId`, `resourceType`, and `grantId` of the _parent_ grant.
- `propagateToObject?`, `propagateObjectLevel?`, etc.: Optional flags controlling how this specific grant should propagate to contained objects/resources (used during grant creation).

### Derived Permissions

Permissions can be automatically derived based on grants on container objects. For example, granting access to an Activity can implicitly grant access to the Elements within it.

- **Implementation:** Derived permissions are represented as explicit `PermissionGrant` records in the data store (`mockPermissionGrants` currently).
- **Tracking:** The `derivedFrom` field links a derived grant back to the specific parent `PermissionGrant` (identified by `grantId`) on the container resource that caused its creation.
- **Creation:** The `propagatePermissionsToContainedObjects` function (in `activityManagement.ts`) creates these derived grants based on the propagation flags set on the parent grant or system defaults.
- **Precedence:** Derived grants have the lowest precedence when calculating effective permissions.

### Permission Precedence Rules

The effective permission level a user has on a resource is determined by the highest applicable grant according to the following strict order:

1.  **Ownership:** If the user is the `ownerId` of the resource, they have `OWNER` level.
2.  **Direct User Grant:** If a non-derived `PermissionGrant` exists directly for the `userId` on the resource, that level applies.
3.  **Direct Group Grant:** If the user is a member of a group that has a non-derived `PermissionGrant` on the resource, the highest level among all applicable group grants applies.
4.  **Derived Grant:** If a `PermissionGrant` marked with `derivedFrom` exists for the user _or_ a group they are in, the highest level among all applicable derived grants applies.

If none of the above apply, the user has no access (`null`).

## Key Functions (Public API via `index.ts`)

- **Checking Permissions:**
  - `calculateEffectivePermission(resourceId, userId)`: Calculates the final access level based on all rules. **This is the primary function for checking access.**
  - `canPerformOperation(resourceId, userId, requiredLevel)`: Checks if the user's effective permission meets a minimum required level.
  - `isResourceOwner(resourceId, userId)`: Checks for direct ownership.
  - `getDirectPermission(resourceId, principalId)`: Retrieves only direct (non-derived) grants.
- **Modifying Permissions:**
  - `grantPermission(...)`: Creates a direct `PermissionGrant`. Accepts propagation options.
  - `revokePermission(grantId, revokedBy)`: Removes a specific grant (by its `id`) and any grants derived _directly_ from it.
  - `transferOwnership(...)`: Changes the `ownerId` of a resource.
- **Activity Management & Sharing:**
  - `shareActivity(...)`: Grants permission on an activity and potentially triggers propagation based on options.
  - `propagatePermissionsToContainedObjects(containerGrant)`: Creates derived grants for elements within an activity based on the container grant's settings.
  - `getActivityElements(activityId)`, `getElementActivities(elementId)`: Helpers for relationship lookup.
  - `canAccessAllActivityElements(...)`, `canEditActivityWithElements(...)`: Convenience checks.
- **Group Management:**
  - `createUserGroup(...)`, `addGroupMember(...)`, `removeGroupMember(...)`: Standard group operations.
  - `isGroupMember(groupId, userId)`, `getUserGroups(userId)`, `getGroupMembers(groupId)`: Membership checks and lookups.
- **Element Management:**
  - `softDeleteElement(...)`, `hardDeleteElementDirectly(...)`: Element deletion (hard delete removes associated permissions).
  - `checkElementDependencies(...)`, `canDeleteElement(...)`: Helpers for deletion workflow.

## Implementation Details (Current - Mock Data)

- **Data Store:** Currently uses in-memory arrays (`mockElements`, `mockActivities`, `mockUserGroups`, `mockGroupMemberships`, `mockPermissionGrants`) defined in `mockData.ts`. **This is intended for development and testing.**
- **Permission Calculation:** Access checks primarily rely on `calculateEffectivePermission` performing on-demand filtering and checks against the `mockPermissionGrants` array and group memberships.
- **No Caching:** The previous permission table caching mechanism (`cache.ts`) has been removed in favor of on-demand calculation.

## Design Decisions

- **Single `PermissionGrant` Array:** Using one array (`mockPermissionGrants`) for both direct and derived grants simplifies the mock implementation and serves as a model for a potential normalized database table (e.g., `permission_grants`).
- **Explicit Derived Grants:** Storing derived grants explicitly with a `derivedFrom` link provides clear traceability and avoids complex recursive calculations within the core `calculateEffectivePermission` function. The checking function remains relatively simple, querying the grant list based on precedence.
- **Precedence Order:** The chosen order (Owner > Direct User > Direct Group > Derived) provides predictable and generally expected permission resolution. Direct assignments override inherited/derived ones.
- **Configurable Propagation:** Allowing propagation behavior (`propagateToObject`, `propagateObjectLevel`, etc.) to be specified _on the parent grant_ provides flexibility when sharing container resources like Activities.

## Default Propagation Behavior

When propagating permissions from a container (e.g., Activity) to contained objects (e.g., Elements), if no explicit `propagateObjectLevel` is set on the container grant, the following defaults apply:

| Container Grant Level | Default Propagated Level on Object | Reasoning                                          |
| :-------------------- | :--------------------------------- | :------------------------------------------------- |
| `VIEWER`              | `VIEWER`                           | Viewing container implies viewing contained items. |
| `EDITOR`              | `VIEWER`                           | Editing container requires viewing items.          |
| `ADMIN` / `OWNER`     | `EDITOR`                           | Higher control implies editing contained items.    |

_Note: These are defaults. The actual propagated level can be overridden via options during the grant action._

## Future Work / TODOs

- **Database Integration:** Replace mock data arrays with a proper database implementation (e.g., PostgreSQL) using a schema based on the `PermissionGrant` structure. This involves rewriting data access functions.
- **Testing:**
  - Add tests for `revokePermission` cascading derived grant removal.
  - Add tests for `hardDeleteElementDirectly` permission cleanup.
  - Add tests for propagation edge cases (group grants, existing derived grants).
  - Add tests for `PermissionScope.ACTIVITY_ONLY`.
- **Linter Warning:** Address or explicitly ignore the `Object is possibly 'undefined'` warning in `elementManagement.ts` line 129.
- **API Layer:** Build an API (e.g., GraphQL, REST) on top of this package.
- **Refine Error Handling:** Improve error reporting and handling throughout the functions.
