import {
  ObjectAccess,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { MISSING_CATALOG_COLLECTION_ID } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  userFive,
  userFour,
  userOne,
  userThree,
  userTwo,
} from './sharingData.js'

// setup test database configuration
// use the DATABASE_URL environment variable if available (for CI or local dev)
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // as a fallback, use default PostgreSQL connection
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

describe('Unit tests covering the creation of derived permissions', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

  beforeAll(async () => {
    // configure database
    const databaseUrl = getDatabaseUrl()

    try {
      // initialize PrismaClient with the database URL
      prisma = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
        log: ['error', 'warn'],
      })

      // test database connection
      await prisma.$connect()

      // create EventEmitter for test context
      emitter = new EventEmitter()

      // upsert all users in the database
      const users = await Promise.all(
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

      // mock context with user including all required properties
      userOneCtx = {
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
      userTwoCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userTwo.sub },
      }
      userThreeCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userThree.sub },
      }
      userFourCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userFour.sub },
      }
      userFiveCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userFive.sub },
      }

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
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // disconnect from the database
  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ! Course permissions tests
  // #region
  // TODO: Verify that owner and direct permissions are correctly copied into the derived permissions table
  // TODO: Verify that group permissions are correctly expanded into individual derived permissions
  // TODO: Verify that the higher direct permission (individual or group) takes precedence
  // TODO: Verify that when deleting direct permissions the corresponding derived permissions are removed
  // TODO: Verify that when using the recomputation function with a userId, only the corresponding derived permissions are updated
  // -> test adding permissions, updating permissions, removing permissions, deduplication with group permissions, removal & adding of group permissions

  // ? Course -> Activity
  // TODO: Verify that minimum required permissions are correctly granted on activities for individual users
  // --> according to table in DOCX
  // TODO: Verify that propagated permissions are correctly granted on activities for individual users
  // --> according to table in DOCX
  // TODO: Verify that minimum required permissions are correctly granted on activities for user groups
  // --> according to table in DOCX
  // TODO: Verify that propagated permissions are correctly granted on activities for user groups
  // --> according to table in DOCX
  // TODO: Verify that revoking access to the course also revokes access to the activity (assuming no direct access)
  // TODO: Verify that revoking group access to the course also revokes access to the activity (assuming no direct access)
  // TODO: Verify that revoking group access to the course does not revoke access to the activity if individual access exists
  // TODO: Verify that direct access to the activity takes precedence over course access (if higher; individual recomputation with userId)
  // TODO: Verify that direct group access to the activity takes precedence over course access (if higher; individual recomputation with userId)
  // TODO: Verify that derived access from the course takes precedence over direct access to the activity (if higher; individual recomputation with userId)
  // TODO: Verify that derived access from the course takes precedence over direct group access to the activity (if higher; individual recomputation with userId)
  // TODO: Verify that direct access to the activity takes precedence over course access (if higher; object recomputation without userId)
  // TODO: Verify that direct group access to the activity takes precedence over course access (if higher; object recomputation without userId)
  // TODO: Verify that derived access from the course takes precedence over direct access to the activity (if higher; object recomputation without userId)
  // TODO: Verify that derived access from the course takes precedence over direct group access to the activity (if higher; object recomputation without userId)

  // ? Course -> Activity -> Element -> Answer Collection
  // TODO: Verify that minimum required permissions are correctly passed down from course all the way down to answer collection
  // --> according to table in DOCX (test different levels on course)
  // TODO: Verify that propagated permissions are correctly passed down from course all the way down to answer collection
  // --> according to table in DOCX (test different levels on course)
  // TODO: Verify that minimum required permissions from direct group permission on course are correctly passed down to answer collection
  // --> according to table in DOCX (test different levels on course)
  // TODO: Verify that propagated permissions from direct group permission on course are correctly passed down to answer collection
  // --> according to table in DOCX (test different levels on course)
  // TODO: Verify that revoking access to the course also revokes access to the elements and answer collection (assuming no direct access)
  // #endregion

  it('Remove all created data and users & verify their deletion', async () => {
    // verify that only the default catalog collection is left in the database
    const dbCatalogs = await prisma.catalogCollection.count()
    expect(dbCatalogs).toBe(1)

    // remove the answer collections from the top-level catalog collection
    const dbAssignments = await prisma.catalogCollectionAssignment.count({
      where: {
        catalogCollectionId: { not: MISSING_CATALOG_COLLECTION_ID },
      },
    })
    expect(dbAssignments).toBe(0)
    await prisma.catalogCollectionAssignment.deleteMany({})
    const dbAssignments2 = await prisma.catalogCollectionAssignment.count()
    expect(dbAssignments2).toBe(0)

    // remove the top level catalog collection for test suite independence
    await prisma.catalogCollection.delete({
      where: { id: MISSING_CATALOG_COLLECTION_ID },
    })
    const dbCatalogs2 = await prisma.catalogCollection.count()
    expect(dbCatalogs2).toBe(0)

    // delete all elements from the database
    await prisma.element.deleteMany({})
    const dbPermissions = await prisma.element.count()
    expect(dbPermissions).toBe(0)

    // delete all answer collections that are left in the database
    await prisma.answerCollection.deleteMany({})
    const dbAnswerCollections = await prisma.answerCollection.count()
    expect(dbAnswerCollections).toBe(0)

    // delete all activities that are left in the database
    await prisma.liveQuiz.deleteMany({})
    const liveQuizzes = await prisma.liveQuiz.count()
    expect(liveQuizzes).toBe(0)
    await prisma.practiceQuiz.deleteMany({})
    const practiceQuizzes = await prisma.practiceQuiz.count()
    expect(practiceQuizzes).toBe(0)
    await prisma.microLearning.deleteMany({})
    const microLearning = await prisma.microLearning.count()
    expect(microLearning).toBe(0)
    await prisma.groupActivity.deleteMany({})
    const groupActivities = await prisma.groupActivity.count()
    expect(groupActivities).toBe(0)

    // delete all users that have been created for the test and validate that they have been removed
    await prisma.user.deleteMany({})
    const dbUsers = await prisma.user.count()
    expect(dbUsers).toBe(0)
  })
})
