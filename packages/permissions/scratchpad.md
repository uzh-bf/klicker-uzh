# KlickerUZH Permission Management System

## Project Overview

Building a permission management system for KlickerUZH that allows users to create and share elements (e.g., quiz questions) and activities (comprised of multiple elements) with different permission levels:

- VIEWER (read)
- EDITOR (write)
- ADMIN (manage permissions)
- OWNER (full control with transfer rights)

## Current Status (DB Refactoring In Progress)

- **Goal:** Refactor the `permissions` package to use Prisma/SQLite instead of in-memory mocks and make relevant functions asynchronous.
- **Progress:**
  - Prisma schema defined and generated (`User`, `UserGroup`, `GroupMembership`, `Element`, `Activity`, `PermissionGrant`, `AuditLog`).
  - Core functions refactored to `async` and use `prisma`: `getResourceById`, `isResourceOwner`, `getDirectPermission`, `calculateEffectivePermission`, `grantPermission`, `revokePermission`, `transferOwnership`, group management functions, `shareActivity`, `propagatePermissionsToContainedObjects`, `logAuditEvent`.
  - Inefficient `calculateAllDerivedPermissions` deprecated.
  - Tests (`core.test.ts`, `activityManagement.test.ts`) refactored to use Prisma.
- **Key Features Implemented:**
  - Modular Design.
  - Hybrid Deletion Strategy (soft/hard delete logic in `elementManagement.ts`).
  - Configurable Permission Propagation logic implemented.
  - Caching layer removed.

## Current Blocker: Test Failures

Persistent test failures (25/26 failing) prevent verifying the refactored logic:

- **Foreign Key Constraint Violations:** Occurring during both cleanup (`beforeEach`) and seeding (`it` blocks or `beforeEach`), despite trying strict deletion orders, sequential `create`, and test-specific seeding (in `activityManagement.test.ts`). Indicates fundamental DB state management issues between tests.
- **Assertion Errors:** Likely symptoms of DB state issues or logic bugs. Examples: `expected 'viewer' to be 'editor'`, `expected +0 to be 2` (derived grants count).
- **TypeScript Errors:** Persistent Prisma Client type errors in tests (e.g., `Property 'activity' does not exist...`). Ignored for now.

## Next Steps

1.  **Standardize Test Setup:** Apply the **test-specific seeding** strategy (cleanup in `beforeEach`, seeding in `it` blocks) to `core.test.ts` to match `activityManagement.test.ts`.
2.  **Run Tests:** Execute `pnpm exec vitest run` within `packages/permissions`.
3.  **Debug Blockers:**
    - Focus _first_ on resolving the remaining **Foreign Key errors**. Investigate the specific constraint being violated, check the schema relations (`onDelete` rules?), and the exact state of the DB when the error occurs.
    - Once FK errors are resolved, address the **assertion errors** by debugging the test logic and the refactored permission functions (`shareActivity`, `calculateEffectivePermission`, etc.).
4.  **(Lower Priority)** Resolve TypeScript Prisma Client type errors in test files once the core functionality is stable.
5.  Refactor remaining functions in `elementManagement.ts` (`softDeleteElement`, `hardDeleteElementDirectly`).
6.  Add tests for group sharing propagation (`activityManagement.test.ts`).
7.  Add comprehensive tests for other modules (`groups.ts`, `permissionManagement.ts`, etc.).

## Configurable Permission Propagation Model

This model introduces explicit controls within the permission grant itself to define how permissions cascade downwards.

**Changes to `PermissionGrant` Type:**

- `propagateToObject?: boolean | null;`
- `propagateObjectLevel?: AccessLevel | null;`
- `propagateToResource?: boolean | null;`
- `propagateResourceLevel?: AccessLevel | null;`

**Logic:** Granting functions (`shareActivity`, `grantPermission`) accept options to set these flags. Propagation functions (`propagatePermissionsToContainedObjects`) read these flags (or apply defaults) when creating derived grants.

**Default Propagation Behavior (Examples):**

- Grant EDIT on Activity -> Propagates VIEW on Elements (Minimum for functionality).
- Grant ADMIN on Activity -> Propagates EDITOR on Elements.
- Grant on Element -> Propagates VIEW on Embedded Resources (assumes central mgmt).

**Requirements Table (Reflecting Defaults/Minimums):**

| Scenario (Grant Action)           | Default Object Propagation | Default Resource Propagation (If Applicable) | Minimum Requirement (For Parent Functionality) | Reasoning for Default                                                                                               |
| :-------------------------------- | :------------------------- | :------------------------------------------- | :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Grant VIEW on Course**          | VIEW on Activities         | N/A                                          | None                                           | Viewing course implies seeing activities.                                                                           |
| **Grant VIEW on Activity**        | VIEW on Elements           | N/A                                          | None                                           | Viewing activity implies seeing elements.                                                                           |
| **Grant EDIT on Activity**        | VIEW on Elements           | N/A                                          | VIEW on ALL contained Elements                 | Editing activity requires seeing elements. Default grants minimum necessary VIEW. User can explicitly grant higher. |
| **Grant ADMIN/OWNER on Activity** | EDITOR on Elements         | N/A                                          | VIEW on ALL contained Elements                 | Admin/Owner needs broader control; EDITOR is reasonable default, less than full ADMIN.                              |
| **Grant VIEW on Element**         | N/A                        | VIEW on Embedded Resources                   | None                                           | Viewing element implies seeing embedded parts.                                                                      |
| **Grant EDIT on Element**         | N/A                        | VIEW on Embedded Resources                   | VIEW on Embedded Resources                     | Editing element requires seeing embedded parts. Default grants VIEW, user could explicitly grant higher if needed.  |
| **Grant ADMIN/OWNER on Element**  | N/A                        | VIEW on Embedded Resources                   | VIEW on Embedded Resources                     | Even full control might default to VIEW on centrally managed resources. Explicit override needed for more.          |

## Database Integration Plan (Revised: SQLite First with Prisma)

The goal is to replace the in-memory mock arrays with a database, using **SQLite** for local development/testing via **Prisma ORM** to facilitate an eventual transition to PostgreSQL.

**1. Technology Choices:**

- **Database (Dev/Test):** SQLite (File-based, no separate server needed).
- **Database (Production Target):** PostgreSQL.
- **ORM/Query Builder:** Prisma (Supports both SQLite and PostgreSQL, provides type safety, migrations).

**2. Prisma Schema Definition (`schema.prisma`):**

- Create/Update `packages/permissions/prisma/schema.prisma`.
- **Datasource Configuration:**

  ```prisma
  datasource db {
    provider = "sqlite"
    url      = "file:./dev.db" // Path to the SQLite database file
  }

  generator client {
    provider = "prisma-client-js"
  }
  ```

- **Model Definitions:** Translate the previously discussed SQL schema into Prisma models.

  ```prisma
  model PermissionGrant {
    id                  String    @id @default(uuid()) // Use UUID for unique IDs
    resourceId          String    @map("resource_id")
    resourceType        String    @map("resource_type") // Consider defining an Enum later if needed
    principalId         String    @map("principal_id") // User or Group ID
    principalType       String    @map("principal_type") // 'USER' or 'GROUP'
    level               String    // AccessLevel enum value stored as string
    grantedByUserId     String    @map("granted_by_user_id")
    grantedAt           DateTime  @default(now()) @map("granted_at")
    derivedFromGrantId  String?   @map("derived_from_grant_id") // Nullable self-relation ID

    // Optional: Store propagation flags if needed, or handle in application logic
    // propagateToObject    Boolean? @map("propagate_to_object")
    // propagateObjectLevel String?  @map("propagate_object_level")
    // ... other propagation flags

    scope               String?   // 'GLOBAL', 'ACTIVITY_ONLY', etc.

    // Define the self-relation for derived grants
    derivedFrom         PermissionGrant? @relation("DerivedGrants", fields: [derivedFromGrantId], references: [id], onDelete: Cascade) // Cascade delete derived grants when parent is deleted
    derivedGrants       PermissionGrant[] @relation("DerivedGrants")

    @@index([resourceId])
    @@index([principalId, principalType])
    @@index([derivedFromGrantId])
    @@map("permission_grants") // Explicitly map to table name
  }

  model UserGroup {
    id          String    @id // Use `group-...` prefix via application logic? Or UUID? Let's use String for flexibility.
    name        String
    description String?
    ownerId     String    @map("owner_id")
    createdAt   DateTime  @default(now()) @map("created_at")
    isDeleted   Boolean   @default(false) @map("is_deleted")

    memberships GroupMembership[] // Relation to memberships

    @@map("user_groups")
  }

  model GroupMembership {
    id            String    @id @default(uuid())
    groupId       String    @map("group_id")
    userId        String    @map("user_id")
    addedByUserId String    @map("added_by_user_id")
    addedAt       DateTime  @default(now()) @map("added_at")

    group UserGroup @relation(fields: [groupId], references: [id])
    // user User @relation(fields: [userId], references: [id]) // Relation to an external User model if it exists

    @@unique([groupId, userId]) // Prevent duplicate memberships
    @@index([groupId])
    @@index([userId])
    @@map("group_memberships")
  }

  model AuditLog {
    id                 String    @id @default(uuid())
    timestamp          DateTime  @default(now())
    actionType         String    @map("action_type")
    performedByUserId  String    @map("performed_by_user_id")
    resourceId         String?   @map("resource_id") // Optional resource ID
    resourceType       String?   @map("resource_type") // Optional resource type
    details            Json?     // Store details as JSON

    @@map("audit_logs")
  }
  ```

  _(Note: Type `String` generally maps well to `TEXT/VARCHAR` in both SQLite and PostgreSQL. `Json` works for JSONB/JSON/TEXT.)_

**3. Initial Setup & Migration (SQLite):**

- **Install Prisma CLI:** `pnpm add -D prisma` (if not already done).
- **Generate Initial Migration:** Run `pnpm exec prisma migrate dev --name init-permissions` in `packages/permissions`. This will:
  - Create the `prisma` directory and the `schema.prisma` file (if not present).
  - Create the SQLite database file (e.g., `packages/permissions/prisma/dev.db`).
  - Create and apply the initial SQL migration.
  - Generate the Prisma Client (`@prisma/client`).

**4. Refactoring Data Access Logic (using Prisma Client):**

- **Generate/Update Client:** Run `pnpm exec prisma generate` whenever the schema changes.
- **Instantiate Client:** Create a singleton instance (`packages/permissions/lib/prisma.ts` or similar).

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
export const prisma = new PrismaClient()
```

- **Replace Mock Data Usage:** Systematically replace mock array operations with Prisma Client calls.
- **Rewrite Key Functions:** Implement the database query logic outlined previously, using async/await and Prisma Client methods. Pay special attention to `calculateEffectivePermission` and use `prisma.$transaction` for atomic writes (`revokePermission`).
  - **DONE:**
    - `audit.ts` (`logAuditEvent`)
    - `permissionManagement.ts` (`grantPermission`, `revokePermission`, `transferOwnership`)
    - `groups.ts` (all functions: `isGroupMember`, `getUserGroups`, `getGroupMembers`, `addGroupMember`, `removeGroupMember`, `createUserGroup`)
  - **TODO:**
    - `elementManagement.ts`: Refactor `softDeleteElement`, `hardDeleteElementDirectly`. Requires fetching element data and deleting associated permissions via Prisma.
    - `activityManagement.ts`: Refactor `shareActivity`, `propagatePermissionsToContainedObjects`. Requires fetching/creating grants, fetching element IDs, potentially bulk creating derived grants.
    - `core.ts`: Refactor `getResourceById`, `getDirectPermission`, `isResourceOwner`, and `calculateEffectivePermission`. This involves replacing mock array lookups with Prisma queries, including potentially complex logic for `calculateEffectivePermission` based on precedence.

**5. Testing Strategy (SQLite):**

- **Recommendation:** Use a separate test database file (e.g., `prisma/test.db`).
- **Configuration:** Use environment variables (e.g., `DATABASE_URL`) in `schema.prisma` (`url = env("DATABASE_URL")`) and set `DATABASE_URL=file:./test.db` during tests.
- **Test Setup/Teardown:**
  - **Current Status:** Using `beforeEach` for cleanup and test-specific seeding (via helper function called in `it` blocks) in `activityManagement.test.ts`. `core.test.ts` still uses global seeding in `beforeEach` (Needs refactoring - see Next Steps).
  - **Goal:** Ensure the test database schema is up-to-date (`prisma migrate deploy` or similar). Reliably clear data from tables before each test using a strict order. Seed necessary data _within_ each test block to isolate state.
  - Ensure the Prisma Client instance used by tests points to the test database.

**6. Documentation for PostgreSQL Migration:**

- Update `README.md` and `scratchpad.md` to note the SQLite/Prisma setup.
- Add a section detailing the steps to switch to PostgreSQL:
  1.  Update `datasource db` provider to `"postgresql"`.
  2.  Set `DATABASE_URL` environment variable to the PostgreSQL connection string.
  3.  Run `pnpm exec prisma migrate dev` to create PostgreSQL migrations.
  4.  Deploy migrations to the production PostgreSQL database (`prisma migrate deploy`).
  5.  Test thoroughly.

---

## Previous Notes (Archive / Reference)

_Older sections on derivation, sharing modes, database mapping etc. can be kept below for reference if needed, or removed._

...
