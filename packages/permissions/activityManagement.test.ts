import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process' // Needed for beforeAll
import path from 'path' // Needed for beforeAll
import { fileURLToPath } from 'url' // Needed for beforeAll
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest' // Updated imports
import { shareActivity } from './activityManagement.js'
import { calculateEffectivePermission } from './core.js'
// import prisma from './lib/prisma.js'
// Remove mock data imports
// import {
//   mockActivities,
//   mockAuditLogs,
//   mockElements,
//   mockPermissionGrants,
//   mockUserGroups,
//   mockUsers,
// } from './mockData.js'
// import { promisify } from 'util'
import {
  AccessLevel,
  ActivityType,
  ResourceType,
  ShareActivityOptions,
} from './types.js'

// Define common IDs for tests
const OWNER_ID = 'user-owner-am'
const SHARER_ID = 'user-sharer-am'
const RECIPIENT_ID = 'user-recipient-am'
const OTHER_USER_ID = 'user-other-am'
const ACTIVITY_ID = 'act-1-am'
const ELEMENT_1_ID = 'elem-act1-1-am'
const ELEMENT_2_ID = 'elem-act1-2-am'

// Declare prisma variable, now initialized in describe block
// let prisma: PrismaClient // Remove this

// --- Remove old cleanup function ---
// async function cleanupDatabase(client: PrismaClient) { ... }

describe('Activity Management & Configurable Propagation', () => {
  // Initialize prisma instance for the test suite
  const prisma = new PrismaClient()

  // Reset database once before all tests using the core.test.ts pattern
  beforeAll(async () => {
    console.log(
      'Running prisma migrate reset once before all activityManagement tests...'
    )
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const packagePath = path.resolve(__dirname)
      execSync('pnpm prisma migrate reset --force', {
        cwd: packagePath,
        stdio: 'inherit',
      })
      console.log('Prisma migrate reset successful (activityManagement).')
    } catch (error) {
      console.error('Failed to reset database (activityManagement):', error)
      if (error instanceof Error) {
        throw new Error(`Database reset failed: ${error.message}`)
      } else {
        throw new Error(`Database reset failed with unknown error: ${error}`)
      }
    }
  })

  // Clean up database after each test using the core.test.ts pattern
  afterEach(async () => {
    console.log('--- Cleaning database after activityManagement test ---')
    // Explicitly list models for type safety
    await prisma.$transaction(async (tx) => {
      // Disable foreign key checks for SQLite during transaction
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = OFF;')

      // Delete data from tables in reverse order of dependency
      // Junction table first
      await tx.$executeRawUnsafe(`DELETE FROM "_ActivityToElement";`)
      await tx.permissionGrant.deleteMany({}) // Depends on User, Group
      await tx.groupMembership.deleteMany({}) // Depends on User, Group
      await tx.activity.deleteMany({}) // Depends on User
      await tx.element.deleteMany({}) // Depends on User
      await tx.userGroup.deleteMany({}) // Depends on User
      await tx.auditLog.deleteMany({}) // Added: Depends on User
      // User must be deleted last due to dependencies in other tables
      await tx.user.deleteMany({})

      // Re-enable foreign key checks
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
    })
    // Corrected log message slightly
    console.log('--- Database cleanup complete (activityManagement) ---')
  })

  // Disconnect the shared client after all tests
  afterAll(async () => {
    await prisma.$disconnect()
  })

  // Helper function for common seeding within tests
  async function seedBaseData() {
    console.log('--- Starting seedBaseData (activityManagement) ---') // Log start of seeding
    // Use upsert instead of create for robustness in tests
    await prisma.user.upsert({
      where: { id: OWNER_ID },
      update: {},
      create: { id: OWNER_ID, email: 'owner@test.com', name: 'Owner' },
    })
    await prisma.user.upsert({
      where: { id: SHARER_ID },
      update: {},
      create: { id: SHARER_ID, email: 'sharer@test.com', name: 'Sharer' },
    })
    await prisma.user.upsert({
      where: { id: RECIPIENT_ID },
      update: {},
      create: {
        id: RECIPIENT_ID,
        email: 'recipient@test.com',
        name: 'Recipient',
      },
    })
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      update: {},
      create: {
        id: OTHER_USER_ID,
        email: 'other@test.com',
        name: 'Other User',
      },
    })

    // Explicitly check if owner user exists before creating activity (keep this check)
    try {
      await prisma.user.findUniqueOrThrow({ where: { id: OWNER_ID } })
      console.log(`Owner ${OWNER_ID} found before Activity create.`)
    } catch (findError) {
      console.error(
        `Owner ${OWNER_ID} NOT found before Activity create! Failing test.`,
        findError
      )
      throw findError
    }
    // Create Activity first (using upsert)
    await prisma.activity.upsert({
      where: { id: ACTIVITY_ID },
      update: {},
      create: {
        id: ACTIVITY_ID,
        ownerId: OWNER_ID, // Direct assignment is fine here if OWNER_ID exists
        // owner: { connect: { id: OWNER_ID } }, // connect is also valid
        name: 'Test Activity 1',
        displayName: 'Test Activity 1',
        activityType: ActivityType.PRACTICE_QUIZ,
      },
    })

    // Then create Elements, linking them to the Activity (using upsert)
    await prisma.element.upsert({
      where: { id: ELEMENT_1_ID },
      update: {}, // Ensure activities connection is handled if element already exists? Maybe not needed if cleanup is solid.
      create: {
        id: ELEMENT_1_ID,
        ownerId: OWNER_ID,
        // owner: { connect: { id: OWNER_ID } },
        name: 'Element 1 for Act1',
        content: '...',
        activities: { connect: { id: ACTIVITY_ID } }, // Link activity
      },
    })
    await prisma.element.upsert({
      where: { id: ELEMENT_2_ID },
      update: {},
      create: {
        id: ELEMENT_2_ID,
        ownerId: OWNER_ID,
        // owner: { connect: { id: OWNER_ID } },
        name: 'Element 2 for Act1',
        content: '...',
        activities: { connect: { id: ACTIVITY_ID } }, // Link activity
      },
    })

    // Create initial permission grant (using upsert)
    await prisma.permissionGrant.upsert({
      where: { id: 'perm-sharer-admin' },
      update: {},
      create: {
        id: 'perm-sharer-admin',
        resourceId: ACTIVITY_ID,
        resourceType: ResourceType.ACTIVITY,
        level: AccessLevel.ADMIN,
        grantedBy: { connect: { id: OWNER_ID } },
        principalUser: { connect: { id: SHARER_ID } },
      },
    })
  }

  describe('shareActivity with Propagation Options', () => {
    it('should NOT propagate element permissions if propagateToObject is false', async () => {
      // --- Seed data for this specific test ---
      await seedBaseData()
      // --- End Seed ---

      const options: ShareActivityOptions = {
        activityId: ACTIVITY_ID,
        level: AccessLevel.EDITOR,
        userId: RECIPIENT_ID,
        grantedBy: SHARER_ID,
        propagateToObject: false, // Explicitly disable propagation
      }

      const primaryGrant = await shareActivity(options)

      // Check primary grant was created
      expect(primaryGrant).toBeDefined()
      expect(primaryGrant).not.toBeNull()
      expect(primaryGrant?.resourceId).toBe(ACTIVITY_ID)
      expect(primaryGrant?.principalUserId).toBe(RECIPIENT_ID)
      expect(primaryGrant?.level).toBe(AccessLevel.EDITOR)

      // Verify recipient has EDITOR on activity
      expect(
        await calculateEffectivePermission(ACTIVITY_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)

      // Verify NO derived grants were created in the DB
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: { derivedFromGrantId: primaryGrant?.id },
      })
      expect(derivedGrants.length).toBe(0)

      // Verify recipient CANNOT access elements directly
      expect(
        await calculateEffectivePermission(ELEMENT_1_ID, RECIPIENT_ID)
      ).toBeNull()
      expect(
        await calculateEffectivePermission(ELEMENT_2_ID, RECIPIENT_ID)
      ).toBeNull()
    })

    it('should propagate default element permissions if propagateToObject is null/undefined', async () => {
      // --- Seed data for this specific test ---
      await seedBaseData()
      // --- End Seed ---

      const optionsDefault: ShareActivityOptions = {
        activityId: ACTIVITY_ID,
        level: AccessLevel.EDITOR,
        userId: RECIPIENT_ID,
        grantedBy: SHARER_ID,
      }

      const primaryGrant = await shareActivity(optionsDefault)
      expect(primaryGrant).toBeDefined()
      expect(primaryGrant?.id).toBeDefined()

      // Verify recipient has EDITOR on activity
      expect(
        await calculateEffectivePermission(ACTIVITY_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)

      // Verify TWO derived grants were created with default level (VIEWER)
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: { derivedFromGrantId: primaryGrant?.id },
      })
      expect(derivedGrants.length).toBe(2)

      const elem1Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_1_ID)
      const elem2Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_2_ID)

      expect(elem1Perm).toBeDefined()
      expect(elem1Perm?.level).toBe(AccessLevel.VIEWER) // Default for EDITOR on activity
      expect(elem1Perm?.derivedFromGrantId).toBe(primaryGrant?.id)

      expect(elem2Perm).toBeDefined()
      expect(elem2Perm?.level).toBe(AccessLevel.VIEWER)
      expect(elem2Perm?.derivedFromGrantId).toBe(primaryGrant?.id)

      // Verify recipient CAN access elements with derived permission
      expect(
        await calculateEffectivePermission(ELEMENT_1_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.VIEWER)
      expect(
        await calculateEffectivePermission(ELEMENT_2_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.VIEWER)
    })

    it('should propagate explicit element permissions level if propagateObjectLevel is set', async () => {
      // --- Seed data for this specific test ---
      await seedBaseData()
      // --- End Seed ---

      const optionsExplicitLevel: ShareActivityOptions = {
        activityId: ACTIVITY_ID,
        level: AccessLevel.EDITOR,
        userId: RECIPIENT_ID,
        grantedBy: SHARER_ID,
        propagateToObject: true,
        propagateObjectLevel: AccessLevel.EDITOR,
      }

      const primaryGrant = await shareActivity(optionsExplicitLevel)
      expect(primaryGrant).toBeDefined()

      // Verify TWO derived grants were created with EXPLICIT level (EDITOR)
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: { derivedFromGrantId: primaryGrant?.id },
      })
      expect(derivedGrants.length).toBe(2)

      const elem1Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_1_ID)
      const elem2Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_2_ID)

      expect(elem1Perm?.level).toBe(AccessLevel.EDITOR) // Explicit level
      expect(elem2Perm?.level).toBe(AccessLevel.EDITOR)

      // Verify recipient access reflects the explicit level
      expect(
        await calculateEffectivePermission(ELEMENT_1_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)
      expect(
        await calculateEffectivePermission(ELEMENT_2_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)
    })

    it('should use default propagation for ADMIN level on activity (propagate EDITOR)', async () => {
      // --- Seed data for this specific test ---
      await seedBaseData()
      // --- End Seed ---

      const optionsAdminDefault: ShareActivityOptions = {
        activityId: ACTIVITY_ID,
        level: AccessLevel.ADMIN,
        userId: RECIPIENT_ID,
        grantedBy: SHARER_ID,
      }

      const primaryGrant = await shareActivity(optionsAdminDefault)
      expect(primaryGrant).toBeDefined()
      expect(primaryGrant?.level).toBe(AccessLevel.ADMIN)

      // Verify TWO derived grants were created with default level (EDITOR for ADMIN)
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: { derivedFromGrantId: primaryGrant?.id },
      })
      expect(derivedGrants.length).toBe(2)

      const elem1Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_1_ID)
      const elem2Perm = derivedGrants.find((p) => p.resourceId === ELEMENT_2_ID)

      expect(elem1Perm?.level).toBe(AccessLevel.EDITOR) // Default for ADMIN on activity
      expect(elem2Perm?.level).toBe(AccessLevel.EDITOR)

      // Verify recipient access
      expect(
        await calculateEffectivePermission(ELEMENT_1_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)
      expect(
        await calculateEffectivePermission(ELEMENT_2_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.EDITOR)
    })

    it('should not propagate permission to an element if recipient already has direct permission', async () => {
      // --- Seed data for this specific test ---
      await seedBaseData()
      // Give recipient direct VIEWER access beforehand - USE CONNECT
      await prisma.permissionGrant.create({
        data: {
          id: 'perm-direct-viewer',
          resourceId: ELEMENT_1_ID,
          resourceType: ResourceType.ELEMENT,
          level: AccessLevel.VIEWER,
          grantedBy: { connect: { id: OWNER_ID } },
          principalUser: { connect: { id: RECIPIENT_ID } },
        },
      })
      // --- End Seed ---

      const options: ShareActivityOptions = {
        activityId: ACTIVITY_ID,
        level: AccessLevel.EDITOR, // Should normally propagate VIEW
        userId: RECIPIENT_ID,
        grantedBy: SHARER_ID,
      }

      const primaryGrant = await shareActivity(options)
      expect(primaryGrant).toBeDefined()

      // Verify ONLY ONE derived grant was created (for ELEMENT_2_ID)
      const derivedGrants = await prisma.permissionGrant.findMany({
        where: { derivedFromGrantId: primaryGrant?.id },
      })
      expect(derivedGrants.length).toBe(1)

      // Add a check to satisfy TS, although the previous assertion should guarantee it exists
      const derivedGrantForElem2 = derivedGrants[0]
      expect(derivedGrantForElem2).toBeDefined()
      if (derivedGrantForElem2) {
        expect(derivedGrantForElem2.resourceId).toBe(ELEMENT_2_ID)
        expect(derivedGrantForElem2.level).toBe(AccessLevel.VIEWER)
      }

      // Verify recipient still has original direct VIEWER on elem-1 (not overwritten by derived)
      expect(
        await calculateEffectivePermission(ELEMENT_1_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.VIEWER)
      // Verify recipient got derived VIEWER on elem-2
      expect(
        await calculateEffectivePermission(ELEMENT_2_ID, RECIPIENT_ID)
      ).toBe(AccessLevel.VIEWER)
    })

    // TODO: Add test for sharing with a group principal
    // TODO: Add test for logging audit event (requires checking DB)
  })
})
