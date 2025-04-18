import {
  AnswerCollection,
  CatalogCollection,
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { createAnswerCollection } from '../src/services/resources.js'
import { createCatalogCollection } from '../src/services/sharing.js'
import {
  answerCollection1,
  answerCollection2,
  catalogCollection1,
  catalogCollection2,
} from './testData.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

// ! General Test Suite Helpers (general setup, user seeding, database connections, cleanup, etc.)
// #region
export async function testInitialization(prisma, emitter) {
  // upsert all users in the database
  await Promise.all(
    [userOne, userTwo, userThree, userFour, userFive].map(
      async (user) =>
        await prisma.user.upsert({
          where: { id: user.id },
          update: {},
          create: {
            id: user.id,
            email: user.email,
            shortname: user.shortname,
          },
        })
    )
  )

  // verify that users have been created correctly in the database
  const dbUsers = await prisma.user.findMany()
  expect(dbUsers).toHaveLength(5)
  const actualEmails = dbUsers.map((user) => user.email)
  expect(actualEmails).toEqual(
    expect.arrayContaining([
      userOne.email,
      userTwo.email,
      userThree.email,
      userFour.email,
      userFive.email,
    ])
  )
  expect(actualEmails).toHaveLength(5)

  // seed the top-level catalog collection with fixed ID
  await prisma.catalogCollection.upsert({
    where: { id: MISSING_CATALOG_COLLECTION_ID },
    create: {
      id: MISSING_CATALOG_COLLECTION_ID,
      name: '',
      access: ObjectAccess.PUBLIC,
    },
    update: {},
  })

  // mock context with user including all required properties
  const userOneCtx = {
    user: {
      sub: userOne.sub,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    prisma,
    emitter,
    redisExec: jest.fn() as unknown as ContextWithUser['redisExec'],
    pubSub: { publish: jest.fn(), subscribe: jest.fn() },
    req: {} as any,
    res: {} as any,
  }

  // mock remaining contexts
  const userTwoCtx = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userTwo.sub },
  }
  const userThreeCtx = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userThree.sub },
  }
  const userFourCtx = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userFour.sub },
  }
  const userFiveCtx = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userFive.sub },
  }

  return {
    userOneCtx,
    userTwoCtx,
    userThreeCtx,
    userFourCtx,
    userFiveCtx,
  }
}

// function to be run at the end of a test suite / test case to ensure complete deletion of all test data
export async function testCleanup(prisma) {
  // delete all catalog collections (including top-level) and other objects from the database
  await prisma.catalogCollection.deleteMany()
  await prisma.answerCollection.deleteMany()
  await prisma.element.deleteMany()
  await prisma.liveQuiz.deleteMany()
  await prisma.practiceQuiz.deleteMany()
  await prisma.microLearning.deleteMany()
  await prisma.groupActivity.deleteMany()
  await prisma.course.deleteMany()

  // verify that no permission or derived permission entries are left in the database (deleted through cascading)
  const dbPermissions = await prisma.permission.count()
  const dbPermissionsDerived = await prisma.derivedPermission.count()
  if (dbPermissions > 0 || dbPermissionsDerived > 0) {
    throw new Error(
      `Permissions or derived permissions still exist in the database: ${dbPermissions} permissions, ${dbPermissionsDerived} derived permissions`
    )
  }

  // delete all users that have been added for the test run
  await prisma.user.deleteMany()
}

// setup test database configuration
// use the DATABASE_URL environment variable if available (for CI or local dev)
export function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // as a fallback, use default PostgreSQL connection
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

export async function initializePrisma() {
  // configure database
  const databaseUrl = getDatabaseUrl()

  try {
    // initialize PrismaClient with the database URL
    const prisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log: ['error', 'warn'],
    })

    // test database connection
    await prisma.$connect()

    // create EventEmitter for test context
    const emitter = new EventEmitter()

    return { prisma, emitter }
  } catch (error) {
    console.error('Failed to initialize test environment:', error)
    throw new Error(`Database connection failed: ${error}`)
  }
}
// #endregion

// ! Content helpers (object creation for testing)
// #region
/**
 * Seeds two answer collections with different access levels (public and restricted).
 *
 * @param userContext - The user context for the current operation
 * @returns {Promise<AnswerCollection[]>}
 */
export async function seedAnswerCollections(
  userContext
): Promise<AnswerCollection[]> {
  const collections = await Promise.all(
    [answerCollection1, answerCollection2].map((collection) =>
      createAnswerCollection(
        {
          name: collection.name,
          description: collection.description,
          answers: collection.entries,
        },
        userContext
      )
    )
  )

  if (
    !collections ||
    collections.some((collection) => !collection) ||
    collections.length !== 2
  ) {
    throw new Error('Failed to create answer collections')
  }

  return collections as AnswerCollection[]
}

/**
 * Seeds two catalog collections with different access levels (public and restricted).
 *
 * @param userContext - The user context for the current operation
 * @returns {Promise<{ publicCatalog: CatalogCollection, restrictedCatalog: CatalogCollection }>}
 */
export async function seedCatalogCollections(userContext): Promise<{
  publicCatalog: CatalogCollection
  restrictedCatalog: CatalogCollection
}> {
  const [publicCatalog, restrictedCatalog] = await Promise.all([
    createCatalogCollection(
      {
        name: catalogCollection1.name,
        access: catalogCollection1.access,
      },
      userContext
    ),
    createCatalogCollection(
      {
        name: catalogCollection2.name,
        access: catalogCollection2.access,
      },
      userContext
    ),
  ])

  return { publicCatalog, restrictedCatalog }
}

/**
 * Seeds permission records for two answer collections, setting up a hierarchical access structure
 * with different permission levels (ADMIN, WRITE, READ) for users 2, 3, and 4.
 *
 * @param prisma - The Prisma client instance for database operations
 * @param AC1Id - The ID of the first answer collection to create permissions for
 * @param AC2Id - The ID of the second answer collection to create permissions for
 * @returns {Promise<void>}
 *
 */
export async function seedAnswerCollectionPermissions(prisma, AC1Id, AC2Id) {
  // create permissions for users 2, 3, and 4 (ADMIN, WRITE, READ in descending order)
  await prisma.permission.createMany({
    data: [
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC2Id,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        answerCollectionId: AC2Id,
      },
      {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        answerCollectionId: AC2Id,
      },
    ],
  })

  // recompute derived permissions that are checked in backend service functions
  await recomputeDerivedPermissions({ answerCollectionId: AC1Id }, prisma)
  await recomputeDerivedPermissions({ answerCollectionId: AC2Id }, prisma)
}
// #endregion
