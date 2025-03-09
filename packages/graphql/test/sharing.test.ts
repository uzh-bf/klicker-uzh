import {
  ObjectAccess,
  PermissionLevel,
  PermissionStatus,
  PrismaClient,
} from '@klicker-uzh/prisma'
import * as dotenv from 'dotenv'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeCatalogCollectionName,
  createCatalogCollection,
  shareCatalogCollection,
} from '../src/services/sharing.js'

// Load environment variables from .env file if exists
dotenv.config()

// Mock user for testing - using proper UUIDs
const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  sub: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  shortname: 'testuser',
}

// Secondary test user - using proper UUIDs
const secondUser = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  sub: '223e4567-e89b-12d3-a456-426614174001',
  email: 'second@example.com',
  shortname: 'seconduser',
}

// Setup test database configuration
// Use the DATABASE_URL environment variable if available (for CI or local dev)
// This should point to a Postgres database
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // For local development, fall back to a default PostgreSQL connection
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

describe('Sharing Service', () => {
  // Set up a test database client
  let prisma: PrismaClient
  let emitter: EventEmitter
  let ctx: ContextWithUser

  // Setup before running tests
  beforeAll(async () => {
    // Configure database
    const databaseUrl = getDatabaseUrl()
    console.log(
      `Attempting to connect to database: ${databaseUrl.split('@')[1]}`
    ) // Log DB info without credentials

    try {
      // Initialize PrismaClient with the database URL
      prisma = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
        log: ['error', 'warn'],
      })

      // Test database connection - with robust error handling
      await prisma.$connect()
      console.log('Database connection successful!')

      // Create EventEmitter for test context
      emitter = new EventEmitter()

      // Create test user in database if it doesn't exist
      await prisma.user.upsert({
        where: { id: mockUser.id },
        update: {},
        create: {
          id: mockUser.id,
          email: mockUser.email,
          shortname: mockUser.shortname,
        },
      })

      // Create second test user
      await prisma.user.upsert({
        where: { id: secondUser.id },
        update: {},
        create: {
          id: secondUser.id,
          email: secondUser.email,
          shortname: secondUser.shortname,
        },
      })

      // Mock context with user including all required properties
      ctx = {
        user: mockUser,
        prisma,
        emitter,
        // Add missing required properties from ContextWithUser
        redisExec: jest.fn(),
        pubSub: { publish: jest.fn() },
        req: {} as any,
        res: {} as any,
      } as unknown as ContextWithUser
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      // Rather than skipping tests with a flag, fail them immediately
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // Clean up after all tests
  afterAll(async () => {
    // Clean up created test users
    try {
      // Clean up all catalog collections created by test users
      await prisma.catalogCollection.deleteMany({
        where: {
          ownerId: { in: [mockUser.id, secondUser.id] },
        },
      })

      // Clean up users
      await prisma.user.deleteMany({
        where: { id: { in: [mockUser.id, secondUser.id] } },
      })
    } catch (error) {
      console.error('Error cleaning up test data:', error)
    }

    await prisma.$disconnect()
  })

  it('should create a catalog collection', async () => {
    const collectionName = 'Test Collection'
    const result = await createCatalogCollection(
      {
        name: collectionName,
        access: ObjectAccess.RESTRICTED,
      },
      ctx
    )

    // Check result structure
    expect(result).toMatchObject({
      name: collectionName,
      access: ObjectAccess.RESTRICTED,
      ownerId: mockUser.id,
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
    expect(collectionInDb?.ownerId).toBe(mockUser.id)
  })

  it('should update a catalog collection name', async () => {
    // First create a collection to update
    const initialCollection = await createCatalogCollection(
      {
        name: 'Initial Collection Name',
        access: ObjectAccess.RESTRICTED,
      },
      ctx
    )

    const updatedName = 'Updated Collection Name'
    const result = await changeCatalogCollectionName(
      {
        catalogCollectionId: initialCollection.id,
        name: updatedName,
      },
      ctx
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
      ctx
    )

    // Share the collection with the second user
    const result = await shareCatalogCollection(
      {
        catalogCollectionId: collectionToShare.id,
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: secondUser.email,
      },
      ctx
    )

    // Check result structure
    expect(result).toBeTruthy()
    expect(result?.userId).toBe(secondUser.id)
    expect(result?.permissionLevel).toBe(PermissionLevel.READ)
    expect(result?.isRevokable).toBe(true)

    // Verify database state
    const permission = await prisma.permission.findFirst({
      where: {
        catalogCollectionId: collectionToShare.id,
        userId: secondUser.id,
      },
    })

    expect(permission).toBeTruthy()
    expect(permission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission?.permissionStatus).toBe(PermissionStatus.GRANTED)
  })
})
