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
  getAnswerCollectionsElements,
  getSingleAnswerCollection,
} from '../src/services/resources.js'
import {
  MISSING_CATALOG_COLLECTION_ID,
  shareCatalogObject,
} from '../src/services/sharing.js'
import {
  answerCollection1,
  answerCollection2,
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

describe('Unit tests for sharing service', () => {
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
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // disconnect from the database
  afterAll(async () => {
    await prisma.$disconnect()
  })

  // keep track of objects that are re-used across unit test cases
  let AC1Id: number
  let AC2Id: number

  it('Data preparation', async () => {
    // verify that users have been created correctly in the database
    const users = await prisma.user.findMany()
    expect(users).toHaveLength(5)
    const actualEmails = users.map((user) => user.email)
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

    // create answer collections that can be added to the catalog to test sharing
    const answerCollections = await Promise.all(
      [answerCollection1, answerCollection2].map(async (collection) => {
        return await prisma.answerCollection.upsert({
          where: {
            ownerId_name: {
              ownerId: userOne.id,
              name: collection.name,
            },
          },
          create: {
            name: collection.name,
            description: collection.description,
            entries: {
              create: collection.entries.map((entry) => ({
                value: entry,
              })),
            },
            owner: {
              connect: {
                id: userOne.id,
              },
            },
          },
          update: {
            name: collection.name,
            description: collection.description,
          },
          include: {
            entries: true,
          },
        })
      })
    )

    // verify that answer collections have been created correctly in the database (including entries)
    expect(answerCollections).toHaveLength(2)
    expect(answerCollections).toHaveLength(2)
    expect(answerCollections.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    // identify the collections by name and compare the entries
    const collection1 = answerCollections.find(
      (c) => c.name === answerCollection1.name
    )
    const collection2 = answerCollections.find(
      (c) => c.name === answerCollection2.name
    )
    expect(collection1).toBeTruthy()
    expect(collection2).toBeTruthy()
    AC1Id = collection1!.id
    AC2Id = collection2!.id

    expect(collection1!.entries).toHaveLength(4)
    expect(collection2!.entries).toHaveLength(4)
    expect(collection1!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(collection2!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection2.entries)
    )

    // seed the top-level catalog collection with fixed ID
    const topLevelCatalogCollection = await prisma.catalogCollection.upsert({
      where: { id: MISSING_CATALOG_COLLECTION_ID },
      create: {
        id: MISSING_CATALOG_COLLECTION_ID,
        name: '',
        access: ObjectAccess.PUBLIC,
      },
      update: {},
    })
  })

  it('Share the answer collections directly with users 2, 3, and 4 with ADMIN, WRITE, and READ permissions, respectively', async () => {
    // users 2, 3, 4 have insufficient permissions to share an answer collection
    const res1 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()
    const res2 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(res2).toBeNull()
    const res3 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userFourCtx
    )
    expect(res3).toBeNull()

    // object can only be shared with users that exist (email or username)
    const res4 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: 'missing_user_name',
        answerCollectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(res4).toBeNull()

    // user 1 shares the answer collection 1 with users 2, 3, and 4 (via email or username)
    const res5 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        usernameOrEmail: userTwo.email,
        answerCollectionId: AC1Id,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()
    expect(res5!.userId).toBe(userTwo.id)
    expect(res5!.username).toBe(userTwo.shortname)
    expect(res5!.userEmail).toBe(userTwo.email)
    expect(res5!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res5!.isRevokable).toBe(true)
    expect(res5!.isOwn).toBe(false)

    const res6 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        usernameOrEmail: userThree.email,
        answerCollectionId: AC1Id,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    expect(res6!.userId).toBe(userThree.id)
    expect(res6!.username).toBe(userThree.shortname)
    expect(res6!.userEmail).toBe(userThree.email)
    expect(res6!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res6!.isRevokable).toBe(true)
    expect(res6!.isOwn).toBe(false)

    const res7 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFour.email,
        answerCollectionId: AC1Id,
      },
      userOneCtx
    )
    expect(res7).toBeTruthy()
    expect(res7!.userId).toBe(userFour.id)
    expect(res7!.username).toBe(userFour.shortname)
    expect(res7!.userEmail).toBe(userFour.email)
    expect(res7!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res7!.isRevokable).toBe(true)
    expect(res7!.isOwn).toBe(false)

    // user 1 shares the answer collection 2 with user 2
    const res8 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        usernameOrEmail: userTwo.email,
        answerCollectionId: AC2Id,
      },
      userOneCtx
    )
    expect(res8).toBeTruthy()
    expect(res8!.userId).toBe(userTwo.id)
    expect(res8!.username).toBe(userTwo.shortname)
    expect(res8!.userEmail).toBe(userTwo.email)
    expect(res8!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res8!.isRevokable).toBe(true)
    expect(res8!.isOwn).toBe(false)

    // user 2 uses admin permissions to share collection with users 3 and 4
    const res9 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        usernameOrEmail: userThree.email,
        answerCollectionId: AC2Id,
      },
      userTwoCtx
    )
    expect(res9).toBeTruthy()
    expect(res9!.userId).toBe(userThree.id)
    expect(res9!.username).toBe(userThree.shortname)
    expect(res9!.userEmail).toBe(userThree.email)
    expect(res9!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res9!.isRevokable).toBe(true)
    expect(res9!.isOwn).toBe(false)

    const res10 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFour.email,
        answerCollectionId: AC2Id,
      },
      userTwoCtx
    )
    expect(res10).toBeTruthy()
    expect(res10!.userId).toBe(userFour.id)
    expect(res10!.username).toBe(userFour.shortname)
    expect(res10!.userEmail).toBe(userFour.email)
    expect(res10!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res10!.isRevokable).toBe(true)
    expect(res10!.isOwn).toBe(false)

    // verify that users 3 and 4 still have insufficient permissions to share the object further (with user 5)
    const res11 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFive.email,
        answerCollectionId: AC2Id,
      },
      userThreeCtx
    )
    expect(res11).toBeNull()
    const res12 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        usernameOrEmail: userFive.email,
        answerCollectionId: AC2Id,
      },
      userFourCtx
    )
    expect(res12).toBeNull()

    // verify that all permissions have been created correctly in the database
    const permission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userTwo.id,
        },
      },
    })
    expect(permission1).toBeTruthy()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(permission1!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const permission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userThree.id,
        },
      },
    })
    expect(permission2).toBeTruthy()
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permission2!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const permission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFour.id,
        },
      },
    })
    expect(permission3).toBeTruthy()
    expect(permission3!.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission3!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const permission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2Id,
          userId: userTwo.id,
        },
      },
    })
    expect(permission4).toBeTruthy()
    expect(permission4!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(permission4!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const permission5 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2Id,
          userId: userThree.id,
        },
      },
    })
    expect(permission5).toBeTruthy()
    expect(permission5!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permission5!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const permission6 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2Id,
          userId: userFour.id,
        },
      },
    })
    expect(permission6).toBeTruthy()
    expect(permission6!.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission6!.permissionStatus).toBe(PermissionStatus.GRANTED)
  })

  it('Verify that all users with access to the answer collection can at view its content and use it in corresonding elements', async () => {
    // check availability of answer collection during element creation
    const collectionsUserOne = await getAnswerCollectionsElements(userOneCtx)
    expect(collectionsUserOne).toHaveLength(2)
    expect(collectionsUserOne.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserTwo = await getAnswerCollectionsElements(userTwoCtx)
    expect(collectionsUserTwo).toHaveLength(2)
    expect(collectionsUserTwo.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserThree =
      await getAnswerCollectionsElements(userThreeCtx)
    expect(collectionsUserThree).toHaveLength(2)
    expect(collectionsUserThree.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserFour = await getAnswerCollectionsElements(userFourCtx)
    expect(collectionsUserFour).toHaveLength(2)
    expect(collectionsUserFour.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserFive = await getAnswerCollectionsElements(userFiveCtx)
    expect(collectionsUserFive).toHaveLength(0)

    // check availability for viewing and/or editing modal
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx, userFourCtx]) {
      const collection1 = await getSingleAnswerCollection({ id: AC1Id }, ctx)
      expect(collection1).toBeTruthy()
      expect(collection1!.name).toBe(answerCollection1.name)
      expect(collection1!.description).toBe(answerCollection1.description)
      expect(collection1!.entries).toHaveLength(4)

      const collection2 = await getSingleAnswerCollection({ id: AC2Id }, ctx)
      expect(collection2).toBeTruthy()
      expect(collection2!.name).toBe(answerCollection2.name)
      expect(collection2!.description).toBe(answerCollection2.description)
      expect(collection2!.entries).toHaveLength(4)
    }

    const collection1UserOne = await getSingleAnswerCollection(
      { id: AC1Id },
      userFiveCtx
    )
    expect(collection1UserOne).toBeNull()

    const collection2UserOne = await getSingleAnswerCollection(
      { id: AC2Id },
      userFiveCtx
    )
    expect(collection2UserOne).toBeNull()
  })

  // TODO: verify that only user 1, 2, 3 are allowed to modifiy content (edit options, name, etc.)

  // TODO: verify that only user 1, 2 can share the collection - use direct sharing, remove permission again afterwards

  // TODO: verify that only user 1, 2 can add the answer collections to a catalog (1 public, 1 restricted)

  // TODO: verify that only user 1, 2 can modify the permissions of the answer collections

  // TODO: verify that only user 1, 2 can revoke access to the answer collections (as long as not used in a question - create a question with it by user 5?) - include cleanup

  // TODO: verify that only user 1 can transfer ownership and then give it back again from user 2

  // TODO: verify that only user 1, 2 can delete the answer collections

  // TODO: create two catalog collections (1 public, 1 restricted)

  // TODO: share the catalog collection with user 2, 3, and 4 with ADMIN, WRITE, READ permissions

  // TODO: verify that users 1, 2, 3, 4 can see both catalog collections, user 5 is only shown restricted (since public one is empty)

  // TODO: add answer collections to the catalog collections with users 1, 2 - verify that 3, 4, have insufficient access to the answer collection

  // TODO: verify that users 1, 2, 3 can change the object access of the included answer collections and remove them

  // TODO: verify that user 5 in public catalog collection can request access to restricted AC and import public AC

  // TODO: verify that user 5 can request access to the restricted catalog collection, which can then be granted by users 1, 2 (request, deny, request, approve)

  // TODO: verify that user 5 in restricted catalog collection can now request access to restricted AC and import public AC

  // TODO: verify that users 1, 2 can change permissions on catalog collection

  // TODO: verify that users 1, 2 can revoke access to catalog collection

  // TODO: verify that users 1 can transfer ownership of catalog collection (and transfer it back afterwards)

  // TODO: verify that users 1, 2 can delete catalog collections

  // it('should update a catalog collection name', async () => {
  // const collectionName = 'Test Collection'
  // const result = await createCatalogCollection(
  //   {
  //     name: collectionName,
  //     access: ObjectAccess.RESTRICTED,
  //   },
  //   userOneCtx
  // )
  // // Check result structure
  // expect(result).toMatchObject({
  //   name: collectionName,
  //   access: ObjectAccess.RESTRICTED,
  //   ownerId: userOne.id,
  //   isOwner: true,
  //   isManager: true,
  //   isEditor: true,
  //   isRequested: false,
  //   isShared: false,
  // })
  // // Verify database state
  // const collectionInDb = await prisma.catalogCollection.findUnique({
  //   where: { id: result.id },
  // })
  // expect(collectionInDb).toBeTruthy()
  // expect(collectionInDb?.name).toBe(collectionName)
  // expect(collectionInDb?.ownerId).toBe(userOne.id)
  // // First create a collection to update
  // const initialCollection = await createCatalogCollection(
  //   {
  //     name: 'Initial Collection Name',
  //     access: ObjectAccess.RESTRICTED,
  //   },
  //   userOneCtx
  // )
  // const updatedName = 'Updated Collection Name'
  // const result = await changeCatalogCollectionName(
  //   {
  //     catalogCollectionId: initialCollection.id,
  //     name: updatedName,
  //   },
  //   userOneCtx
  // )
  // // Verify update was successful
  // expect(result).toBe(true)
  // // Verify database state reflects the update
  // const updatedCollection = await prisma.catalogCollection.findUnique({
  //   where: { id: initialCollection.id },
  // })
  // expect(updatedCollection?.name).toBe(updatedName)
  // })

  // it('should share a catalog collection with another user', async () => {
  // // First create a collection to share
  // const collectionToShare = await createCatalogCollection(
  //   {
  //     name: 'Collection to Share',
  //     access: ObjectAccess.RESTRICTED,
  //   },
  //   userOneCtx
  // )

  // // Share the collection with the second user
  // const result = await shareCatalogCollection(
  //   {
  //     catalogCollectionId: collectionToShare.id,
  //     permissionLevel: PermissionLevel.READ,
  //     usernameOrEmail: userTwo.email,
  //   },
  //   userOneCtx
  // )

  // // Check result structure
  // expect(result).toBeTruthy()
  // expect(result?.userId).toBe(userTwo.id)
  // expect(result?.permissionLevel).toBe(PermissionLevel.READ)
  // expect(result?.isRevokable).toBe(true)

  // // Verify database state
  // const permission = await prisma.permission.findFirst({
  //   where: {
  //     catalogCollectionId: collectionToShare.id,
  //     userId: userTwo.id,
  //   },
  // })

  // expect(permission).toBeTruthy()
  // expect(permission?.permissionLevel).toBe(PermissionLevel.READ)
  // expect(permission?.permissionStatus).toBe(PermissionStatus.GRANTED)
  // })
})
