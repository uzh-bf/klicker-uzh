# Permissions Module Concept

This document details how KlickerUZH manages permissions across elements, activities, and courses. It explains core constants, helper functions, recompute entrypoints, and the overall data flow.

---

## 1. Constants & Types

- **permissionLevelMap**: maps each `DB.PermissionLevel` to a numeric rank:
  - OWNER=5, ADMIN=4, WRITE=3, EXECUTE=2, READ=1, NONE=0
- **inversePermissionLevelMap**: converts a numeric rank back to its `DB.PermissionLevel` (or `undefined`).
- **UserAccessMap**: `{ [userId: string]: { maxAccessLevel: PermissionLevel; parentPermissionId?: number; derived: boolean } }`

## 2. Core Helpers

### 2.1 getMaxAccessLevelIndividual

- Input: all direct `Permission` rows for one user (including group grants).
- Finds the highest-ranked permission (`maxDirectPermission`) and its `id`, breaking ties in favor of `propagation=true`.
- Output: `{ maxDirectPermission: number, directPermissionId?: number }`.

### 2.2 getMaxAccessLevelCombined

- Input: array of direct permissions for an object (per-user and per-group), `objectDeleted`, optional `ownerId`.
- Seeds owner→OWNER if not deleted.
- Iterates each direct grant to build a `UserAccessMap`, applying same max-level + propagation rules per user.
- Output: full map of every user’s highest direct access.

### 2.3 getActivityAccessFromCourse

- Input: a user’s derived `coursePermissionLevel` and its direct `Permission` row.
- Propagates course rights to contained activity:
  - OWNER/ADMIN → ADMIN
  - WRITE → WRITE (if propagation) or EXECUTE
  - EXECUTE → EXECUTE
  - READ → READ
- Always marks `derived=true`.
- Returns: `{ maxAccessLevel?: PermissionLevel; parentPermissionId?: number; derived: boolean } | null`.
- Usage:
  - invoked by `getActivityPermissionsUser` and `getActivityPermissionsObject` to fold course-level grants into activity access.

### 2.4 getActivityPermissionsUser

- Computes one user’s effective access on a single activity.
- Steps:
  1. If user is owner & not deleted → OWNER.
  2. Else if any direct permissions & not deleted → use **getMaxAccessLevelIndividual** → map back to `PermissionLevel`.
  3. Else if exactly one derived course permission → apply **getActivityAccessFromCourse** and compare to direct.
  4. Return `null` if no access.
- Returns: `{ maxAccessLevel?: PermissionLevel; parentPermissionId?: number; derived: boolean } | null`.
- Usage:
  - invoked by `recomputePracticeQuizPermissionsUser`, `recomputeLiveQuizPermissionsUser`, `recomputeMicroLearningPermissionsUser`, and `recomputeGroupActivityPermissionsUser`.

### 2.5 getActivityPermissionsObject

- Builds full `UserAccessMap` for an activity:
  1. Start with **getMaxAccessLevelCombined** on direct grants + ownership.
  2. Fold in each derived course entry via **getActivityAccessFromCourse** if it improves access.
- Output: map of all users with any access.

### 2.6 propagateActivityToElementsUser & propagateActivityToElements

- Input: `stacks`: array of element stacks or blocks (with `elements: DB.ElementInstance[]`); `updateAccessRequests`: boolean.
- **User** variant: loops unique element IDs in stacks/blocks and calls `recomputeElementPermissionsUser` per user.
- **Object** variant: calls `recomputeElementPermissionsObject` per element (all users).
- Returns: `Promise<void>`.
- Usage:
  - `propagateActivityToElementsUser` invoked by `recomputePracticeQuizPermissionsUser`, `recomputeLiveQuizPermissionsUser`, `recomputeMicroLearningPermissionsUser`, and `recomputeGroupActivityPermissionsUser`.
  - `propagateActivityToElements` invoked by `recomputePracticeQuizPermissionsObject`, `recomputeLiveQuizPermissionsObject`, `recomputeMicroLearningPermissionsObject`, and `recomputeGroupActivityPermissionsObject`.

---

## 3. Entrypoints for Derived Permissions

For each domain (element, answer collection, course, live quiz, practice quiz, microlearning, group activity):

1. **recomputeXxxPermissions** (dispatcher)

   - If `userId` provided → call user-scoped recompute.
   - Else → call object-scoped recompute.

2. **recomputeXxxPermissionsUser**

   - Fetch existing derived row.
   - Load direct grants, owner, and—in activities—linked course perms & element instances.
   - Compute new access via helpers (`getActivityPermissionsUser` or element logic).
   - Upsert or delete `derivedPermission` row.
   - If flag `updateAccessRequests` → call **updateAccessRequestInstances**.
   - Propagate downwards:
     - Activity → elements → answer collections.

3. **recomputeXxxPermissionsObject**
   - Delete all existing derived rows for this object.
   - Compute full access map via `getMaxAccessLevelCombined` or `getActivityPermissionsObject`.
   - Upsert one derived row per user.
   - Call **updateAccessRequestInstances** once.
   - Propagate to child objects.

---

## 4. Access Request Synchronization

- **updateAccessRequestInstances**:
  - Ensures pending requests are assigned only to valid admins/owners.
  - Deletes requests when object is soft-deleted or admin loses rights.
  - Upserts requests for each remaining admin or owner.

---

## 5. Data Flow Summary

1. **Direct grants** → max-level per user (`getMaxAccessLevelIndividual` / combined).
2. **Course→Activity** propagation → boost activity perms above direct when allowed.
3. **Activity→Element** propagation → ADMIN on an activity grants ADMIN on linked elements.
4. **Persistence** → derivedPermission upserts/deletions (user-scoped or full rebuild).
5. **Access requests** → validated and reassigned via `updateAccessRequestInstances`.
6. **Chained propagation** → ensure consistency down to answer collections.

## Review Summary

| Function                                                      | Purpose                                                                                                                                                             | Strengths                                                                      | Suggestions                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| getMaxAccessLevelIndividual                                   | Finds the highest direct permission rank and its source ID from a user’s direct and group grants.                                                                   | O(n) pass; clear tie-breaker for propagation; handles empty input.             | Add unit tests for empty input & propagation ties; validate unknown enum values; consider returning enum directly.                                                                           |
| getMaxAccessLevelCombined                                     | Builds a map of all users’ highest direct permissions on an object, seeding owner and handling group grants.                                                        | Single O(n) pass; unified user+group logic; honors propagation flag.           | Filter out direct permissions when `objectDeleted`; add tests for soft-deletion, empty input, group overlaps; guard missing levels gracefully.                                               |
| getActivityAccessFromCourse                                   | Propagates course-level permissions into effective activity-level access (OWNER/ADMIN→ADMIN, WRITE→WRITE/EXECUTE based on propagation, EXECUTE→EXECUTE, READ→READ). | Simple switch; clear mapping; respects propagation flag; always marks derived. | Add unit tests for all course permission levels and propagation variants; guard missing directCoursePermission; verify usage in getActivityPermissionsUser and getActivityPermissionsObject. |
| getMaxAccessLevelCombined                                     | Builds a map of all users’ highest direct permissions on an object, seeding owner and handling group grants.                                                        | Single O(n) pass; unified user+group logic; honors propagation flag.           | Filter out direct permissions when `objectDeleted`; add tests for soft-deletion, empty input, group overlaps; guard missing levels gracefully.                                               |
| getActivityPermissionsUser                                    | Computes one user’s effective access on a single activity.                                                                                                          | Handles owner, direct, and derived cases; propagation-aware.                   | Add unit tests for all permission combinations; validate unknown enum values; consider returning enum directly.                                                                              |
| getActivityPermissionsObject                                  | Builds full `UserAccessMap` for an activity: folding in direct and derived course permissions.                                                                      | Unified logic; propagation-aware; handles empty input.                         | Add unit tests for soft-deletion, empty input, group overlaps; guard missing levels gracefully; verify usage in propagateActivityToElements.                                                 |
| propagateActivityToElementsUser & propagateActivityToElements | Propagates activity permissions to elements (user-scoped or object-scoped).                                                                                         | Unified logic; propagation-aware; handles empty input.                         | Add unit tests for soft-deletion, empty input, group overlaps; guard missing levels gracefully; verify usage in recomputeXxxPermissionsUser/Object.                                          |

## Potential Improvements

- Consolidate the top-level recompute dispatcher into a shared `dispatchRecompute` helper in `util.ts`, eliminating boilerplate in each module.
- Introduce a `makeRecomputers` factory in `util.ts` to generate user- and object-scoped recompute functions, centralizing shared logic.
- Abstract deletion and upsert of `derivedPermission` rows into a single helper to avoid repetition across modules.
- Unify activity-to-element propagation into one helper that parametrizes both `propagateActivityToElementsUser` and `propagateActivityToElements`.
- Embed the `updateAccessRequestInstances` call within the recompute factories to remove repetitive manual invocation.

- **Repository/Service Layer Separation** _(Medium)_: Extract database interactions into a dedicated repository or service layer (e.g., `DerivedPermissionRepository`). Decoupling business logic from Prisma calls simplifies unit testing and clarifies responsibilities.
- **Transactional Wrapper & Bulk Upserts** _(Medium)_: Wrap delete, upsert, and propagation operations in a single `prisma.$transaction()` call and batch upserts for object-scoped recompute. This guarantees atomicity and reduces database round trips with moderate code changes.
- **Instrumentation & Metrics** _(Medium)_: Add timing, counters, and logging around recompute operations (e.g., Prometheus metrics). This provides visibility into performance and failures, aiding debugging and maintenance with low overhead.
- **Unified CLI/API** _(Medium)_: Expose a thin CLI command or REST/GraphQL endpoint (e.g., `klicker util recompute liveQuiz --id`) that delegates to the orchestrator. This improves on-demand usage and integration without deep changes to core logic.
- **Data-Driven Entity Configuration** _(Hard)_: Replace per-entity modules with a configuration array defining loaders, compute functions, and propagation hooks. A generic engine consumes this config to dynamically generate recompute functions, requiring upfront design.
- **Strategy-Pattern Registry** _(Hard)_: Define a strategy interface (`load`, `computeUser`, `computeObject`, `propagate`) and register each entity’s implementation in a registry. A single orchestrator dispatches based on entity type, offering flexibility at the cost of extra abstraction.
- **Incremental/Event-Driven Recompute** _(Hard)_: Shift from full-table recompute to event-driven updates (DB triggers or message queues) and cache last-computed states to only recalc diffs. This boosts performance but requires new infrastructure and careful error handling.
