import {
  ObjectAccess,
  PermissionLevel,
  PermissionStatus,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeCatalogCollectionName,
  createCatalogCollection,
  shareCatalogCollection,
} from '../src/services/sharing.js'
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

describe('Sharing Service', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser

  beforeAll(async () => {
    // configure database
    const databaseUrl = getDatabaseUrl()
    console.log(
      `Attempting to connect to database: ${databaseUrl.split('@')[1]}`
    )

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
      console.log('Database connection successful!')

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

      // mock context with userd including all required properties
      userOneCtx = {
        user: {
          sub: userOne.sub,
          role: UserRole.ADMIN,
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
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // disconnect from the database
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should create a catalog collection', async () => {
    const collectionName = 'Test Collection'
    const result = await createCatalogCollection(
      {
        name: collectionName,
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )

    // Check result structure
    expect(result).toMatchObject({
      name: collectionName,
      access: ObjectAccess.RESTRICTED,
      ownerId: userOne.id,
      isOwner: true,
      isManager: true,
      isEditor: true,
      isRequested: false,
      isShared: false,
    })

    // Verify database state
    const collectionInDb = await prisma.catalogCollection.findUnique({
      where: { id: result.id },
    })

    expect(collectionInDb).toBeTruthy()
    expect(collectionInDb?.name).toBe(collectionName)
    expect(collectionInDb?.ownerId).toBe(userOne.id)
  })

  it('should update a catalog collection name', async () => {
    // First create a collection to update
    const initialCollection = await createCatalogCollection(
      {
        name: 'Initial Collection Name',
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )

    const updatedName = 'Updated Collection Name'
    const result = await changeCatalogCollectionName(
      {
        catalogCollectionId: initialCollection.id,
        name: updatedName,
      },
      userOneCtx
    )

    // Verify update was successful
    expect(result).toBe(true)

    // Verify database state reflects the update
    const updatedCollection = await prisma.catalogCollection.findUnique({
      where: { id: initialCollection.id },
    })

    expect(updatedCollection?.name).toBe(updatedName)
  })

  it('should share a catalog collection with another user', async () => {
    // First create a collection to share
    const collectionToShare = await createCatalogCollection(
      {
        name: 'Collection to Share',
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )

    // Share the collection with the second user
    const result = await shareCatalogCollection(
      {
        catalogCollectionId: collectionToShare.id,
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userTwo.email,
      },
      userOneCtx
    )

    // Check result structure
    expect(result).toBeTruthy()
    expect(result?.userId).toBe(userTwo.id)
    expect(result?.permissionLevel).toBe(PermissionLevel.READ)
    expect(result?.isRevokable).toBe(true)

    // Verify database state
    const permission = await prisma.permission.findFirst({
      where: {
        catalogCollectionId: collectionToShare.id,
        userId: userTwo.id,
      },
    })

    expect(permission).toBeTruthy()
    expect(permission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission?.permissionStatus).toBe(PermissionStatus.GRANTED)
  })
})
