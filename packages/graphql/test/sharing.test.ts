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
  addAnswerCollectionOption,
  deleteAnswerCollectionEntry,
  editAnswerCollectionEntry,
  getAnswerCollectionsElements,
  getSingleAnswerCollection,
  modifyAnswerCollection,
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

  it("Verify that only users with WRITE / ADMIN / OWNER permissions are allowed to modify the answer collection's content", async () => {
    // test the modification of the answer collection's name and description with OWNER AND ADMIN permissions
    const updatedCollection1 = await modifyAnswerCollection(
      {
        id: AC1Id,
        name: `${answerCollection1.name} (Updated)`,
        description: `${answerCollection1.description} (Updated)`,
      },
      userOneCtx
    )
    expect(updatedCollection1).toBeTruthy()
    expect(updatedCollection1!.name).toBe(`${answerCollection1.name} (Updated)`)
    expect(updatedCollection1!.description).toBe(
      `${answerCollection1.description} (Updated)`
    )

    const updatedCollection2 = await modifyAnswerCollection(
      {
        id: AC2Id,
        name: `${answerCollection2.name} (Updated)`,
        description: `${answerCollection2.description} (Updated)`,
      },
      userTwoCtx
    )
    expect(updatedCollection2).toBeTruthy()
    expect(updatedCollection2!.name).toBe(`${answerCollection2.name} (Updated)`)
    expect(updatedCollection2!.description).toBe(
      `${answerCollection2.description} (Updated)`
    )

    // undo changes with WRITE permissions
    const updatedCollection3 = await modifyAnswerCollection(
      {
        id: AC1Id,
        name: answerCollection1.name,
        description: answerCollection1.description,
      },
      userThreeCtx
    )
    expect(updatedCollection3).toBeTruthy()
    expect(updatedCollection3!.name).toBe(answerCollection1.name)
    expect(updatedCollection3!.description).toBe(answerCollection1.description)

    const updatedCollection4 = await modifyAnswerCollection(
      {
        id: AC2Id,
        name: answerCollection2.name,
        description: answerCollection2.description,
      },
      userThreeCtx
    )
    expect(updatedCollection4).toBeTruthy()
    expect(updatedCollection4!.name).toBe(answerCollection2.name)
    expect(updatedCollection4!.description).toBe(answerCollection2.description)

    // verify that WRITE permissions are correctly verified
    const updatedCollection5 = await modifyAnswerCollection(
      {
        id: AC1Id,
        name: `${answerCollection1.name} (Updated)`,
        description: `${answerCollection1.description} (Updated)`,
      },
      userFourCtx
    )
    expect(updatedCollection5).toBeNull()

    const updatedCollection6 = await modifyAnswerCollection(
      {
        id: AC2Id,
        name: `${answerCollection2.name} (Updated)`,
        description: `${answerCollection2.description} (Updated)`,
      },
      userFiveCtx
    )
    expect(updatedCollection6).toBeNull()

    // verify that changing and answer collection entry value required WRITE permissions (at least)
    const dbAC1 = await prisma.answerCollection.findUnique({
      where: { id: AC1Id },
      include: { entries: true },
    })
    expect(dbAC1).toBeTruthy()
    expect(dbAC1!.entries).toHaveLength(4)
    const entry1 = dbAC1!.entries[0]

    const updatedEntry1 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated)`,
        collectionId: AC1Id,
      },
      userOneCtx
    )
    expect(updatedEntry1).toBeTruthy()
    expect(updatedEntry1!.value).toBe(`${entry1!.value} (Updated)`)

    const updatedEntry2 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated 2)`,
        collectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(updatedEntry2).toBeTruthy()
    expect(updatedEntry2!.value).toBe(`${entry1!.value} (Updated 2)`)

    const updatedEntry3 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: entry1!.value,
        collectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(updatedEntry3).toBeTruthy()
    expect(updatedEntry3!.value).toBe(entry1!.value)

    const updatedEntry4 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated 4)`,
        collectionId: AC1Id,
      },
      userFourCtx
    )
    expect(updatedEntry4).toBeNull()

    const updatedEntry5 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated 5)`,
        collectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(updatedEntry5).toBeNull()

    // verify that users with WRITE permissions can add and remove entries from an answer collection
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx]) {
      // add new value to answer collection
      const newEntryValue = `New Entry ${ctx.user.sub}`
      const newEntry = await addAnswerCollectionOption(
        {
          collectionId: AC1Id,
          value: newEntryValue,
        },
        ctx
      )
      expect(newEntry).toBeTruthy()
      expect(newEntry!.value).toBe(newEntryValue)

      // verify that new entry has been added to answer collection
      const dbAC1Updated = await prisma.answerCollection.findUnique({
        where: { id: AC1Id },
        include: { entries: true },
      })
      expect(dbAC1Updated).toBeTruthy()
      expect(dbAC1Updated!.entries).toHaveLength(5)
      expect(dbAC1Updated!.entries.map((entry) => entry.value)).toEqual(
        expect.arrayContaining([...answerCollection1.entries, newEntryValue])
      )

      // remove the new entry again
      const removedEntry = await deleteAnswerCollectionEntry(
        {
          id: newEntry!.id,
          collectionId: AC1Id,
        },
        ctx
      )
      expect(removedEntry).toBeTruthy()
      expect(removedEntry).toBe(newEntry!.id)

      // verify that the entry has been removed from the answer collection
      const dbAC1Removed = await prisma.answerCollection.findUnique({
        where: { id: AC1Id },
        include: { entries: true },
      })
      expect(dbAC1Removed).toBeTruthy()
      expect(dbAC1Removed!.entries).toHaveLength(4)
      expect(dbAC1Removed!.entries.map((entry) => entry.value)).toEqual(
        expect.arrayContaining(answerCollection1.entries)
      )
    }

    // verify that answers without WRITE permissions cannot add or remove entries
    for (const ctx of [userFourCtx, userFiveCtx]) {
      const newEntry = await addAnswerCollectionOption(
        {
          collectionId: AC1Id,
          value: 'Dummy Content',
        },
        ctx
      )
      expect(newEntry).toBeNull()

      // verify that answer colleciton has not been modified
      const dbAC1AfterAddition = await prisma.answerCollection.findUnique({
        where: { id: AC1Id },
        include: { entries: true },
      })
      expect(dbAC1AfterAddition).toBeTruthy()
      expect(dbAC1AfterAddition!.entries).toHaveLength(4)

      const removedEntry = await deleteAnswerCollectionEntry(
        {
          id: 0,
          collectionId: AC1Id,
        },
        ctx
      )
      expect(removedEntry).toBeNull()

      // verify that answer colleciton has not been modified
      const dbAC1AfterRemoval = await prisma.answerCollection.findUnique({
        where: { id: AC1Id },
        include: { entries: true },
      })
      expect(dbAC1AfterRemoval).toBeTruthy()
      expect(dbAC1AfterRemoval!.entries).toHaveLength(4)
    }
  })

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
})
