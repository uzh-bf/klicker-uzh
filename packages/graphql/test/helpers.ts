import {
  ObjectAccess,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { MISSING_CATALOG_COLLECTION_ID } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

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
