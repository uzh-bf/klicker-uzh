import {
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PermissionStatus,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { CatalogObjectType } from '@klicker-uzh/types'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  addAnswerCollectionOption,
  deleteAnswerCollection,
  deleteAnswerCollectionEntry,
  editAnswerCollectionEntry,
  getAnswerCollectionsElements,
  getSingleAnswerCollection,
  modifyAnswerCollection,
} from '../src/services/resources.js'
import {
  addObjectToCatalog,
  changeCatalogCollectionName,
  changeCatalogCollectionPermissionLevel,
  changeCatalogObjectAccess,
  changeCatalogObjectPermissionLevel,
  createCatalogCollection,
  deleteCatalogCollection,
  getCatalogAnswerCollections,
  getCatalogCollectionsList,
  importAnswerCollection,
  MISSING_CATALOG_COLLECTION_ID,
  requestCatalogCollection,
  requestCatalogObject,
  resolveObjectSharingRequest,
  revokeAnswerCollectionAccess,
  revokeCatalogCollectionAccess,
  shareCatalogCollection,
  shareCatalogObject,
  transferAnswerCollectionOwnership,
  transferCatalogCollectionOwnership,
} from '../src/services/sharing.js'
import {
  answerCollection1,
  answerCollection2,
  catalogCollection1,
  catalogCollection2,
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
  let publicCatalogId: string
  let restrictedCatalogId: string

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
        shortnameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()
    const res2 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(res2).toBeNull()
    const res3 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userFive.email,
        answerCollectionId: AC1Id,
      },
      userFourCtx
    )
    expect(res3).toBeNull()

    // object can only be shared with users that exist (email or username)
    const res4 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: 'missing_user_name',
        answerCollectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(res4).toBeNull()

    // user 1 shares the answer collection 1 with users 2, 3, and 4 (via email or username)
    const res5 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.email,
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
        shortnameOrEmail: userThree.shortname,
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
        shortnameOrEmail: userFour.email,
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
        shortnameOrEmail: userTwo.shortname,
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
        shortnameOrEmail: userThree.email,
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
        shortnameOrEmail: userFour.shortname,
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
        shortnameOrEmail: userFive.email,
        answerCollectionId: AC2Id,
      },
      userThreeCtx
    )
    expect(res11).toBeNull()
    const res12 = await shareCatalogObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userFive.shortname,
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
    const collectionsUserOne = await getAnswerCollectionsElements(
      { templateId: undefined },
      userOneCtx
    )
    expect(collectionsUserOne).toHaveLength(2)
    expect(collectionsUserOne.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserTwo = await getAnswerCollectionsElements(
      { templateId: undefined },
      userTwoCtx
    )
    expect(collectionsUserTwo).toHaveLength(2)
    expect(collectionsUserTwo.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserThree = await getAnswerCollectionsElements(
      { templateId: undefined },
      userThreeCtx
    )
    expect(collectionsUserThree).toHaveLength(2)
    expect(collectionsUserThree.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserFour = await getAnswerCollectionsElements(
      { templateId: undefined },
      userFourCtx
    )
    expect(collectionsUserFour).toHaveLength(2)
    expect(collectionsUserFour.map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const collectionsUserFive = await getAnswerCollectionsElements(
      { templateId: undefined },
      userFiveCtx
    )
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

  it('Verify that only users with ADMIN and OWNER permissions on an answer collection can add it to a catalog', async () => {
    // verify that the query for the catalog addition only returns the collections that can be added
    const availableCollectionsUserOne =
      await getCatalogAnswerCollections(userOneCtx)
    expect(availableCollectionsUserOne).toHaveLength(2)
    expect(
      availableCollectionsUserOne.map((collection) => collection.name)
    ).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const availableCollectionsUserTwo =
      await getCatalogAnswerCollections(userTwoCtx)
    expect(availableCollectionsUserTwo).toHaveLength(2)
    expect(
      availableCollectionsUserTwo.map((collection) => collection.name)
    ).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    const availableCollectionsUserThree =
      await getCatalogAnswerCollections(userThreeCtx)
    expect(availableCollectionsUserThree).toHaveLength(0)

    const availableCollectionsUserFour =
      await getCatalogAnswerCollections(userFourCtx)
    expect(availableCollectionsUserFour).toHaveLength(0)

    const availableCollectionsUserFive =
      await getCatalogAnswerCollections(userFiveCtx)
    expect(availableCollectionsUserFive).toHaveLength(0)

    // verify that only users with sufficient permissions on the object can add it to the catalog at the top-level (AC1 as public, AC2 as restricted)
    const res1 = await addObjectToCatalog(
      {
        access: ObjectAccess.PUBLIC,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1Id,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res1!.id).toBe(AC1Id)
    expect(res1!.objectType).toBe(CatalogObjectType.ANSWER_COLLECTION)
    expect(res1!.access).toBe(ObjectAccess.PUBLIC)
    expect(res1!.ownerShortname).toBe(userOne.shortname)
    expect(res1!.isOwner).toBe(true)
    expect(res1!.isManager).toBe(true)
    expect(res1!.isRequested).toBe(false)
    expect(res1!.isShared).toBe(false)

    const res2 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        answerCollectionId: AC2Id,
      },
      userTwoCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.id).toBe(AC2Id)
    expect(res2!.objectType).toBe(CatalogObjectType.ANSWER_COLLECTION)
    expect(res2!.access).toBe(ObjectAccess.RESTRICTED)
    expect(res2!.ownerShortname).toBe(userOne.shortname)
    expect(res2!.isOwner).toBe(false)
    expect(res2!.isManager).toBe(true)
    expect(res2!.isRequested).toBe(false)
    expect(res2!.isShared).toBe(true)

    // verify that users with insufficient permissions cannot add the answer collections to the catalog
    const res3 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(res3).toBeNull()

    const res4 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1Id,
      },
      userFourCtx
    )
    expect(res4).toBeNull()

    const res5 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(res5).toBeNull()

    // verify if the assignments have been stored correctly in the database
    const AC1Assignment = await prisma.catalogCollectionAssignment.findUnique({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: AC1Id,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
    })
    expect(AC1Assignment).toBeTruthy()
    expect(AC1Assignment!.access).toBe(ObjectAccess.PUBLIC)

    const AC2Assignment = await prisma.catalogCollectionAssignment.findUnique({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: AC2Id,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
    })
    expect(AC2Assignment).toBeTruthy()
    expect(AC2Assignment!.access).toBe(ObjectAccess.RESTRICTED)
  })

  it('Verify that only object ADMIN / OWNER can modify the individual permission levels', async () => {
    // fetch the permission that should be modified and verify its initial value
    const permission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFour.id,
        },
      },
    })
    expect(permission).toBeTruthy()
    expect(permission!.permissionLevel).toBe(PermissionLevel.READ)

    // change the permission READ -> WRITE
    const success1 = await changeCatalogObjectPermissionLevel(
      {
        permissionId: permission!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1Id,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    // verify that the permission has been updated in the database
    const updatedPermission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFour.id,
        },
      },
    })
    expect(updatedPermission).toBeTruthy()
    expect(updatedPermission!.permissionLevel).toBe(PermissionLevel.WRITE)

    // use admin permissions to change the permission level back to READ
    const success2 = await changeCatalogObjectPermissionLevel(
      {
        permissionId: updatedPermission!.id,
        permissionLevel: PermissionLevel.READ,
        answerCollectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(success2).toBeTruthy()

    // verify that the permission has been updated in the database
    const updatedPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFour.id,
        },
      },
    })
    expect(updatedPermission2).toBeTruthy()
    expect(updatedPermission2!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that all other users do not have sufficient permissions on the object for a permission level change
    const success3 = await changeCatalogObjectPermissionLevel(
      {
        permissionId: updatedPermission2!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(success3).toBeFalsy()

    const success4 = await changeCatalogObjectPermissionLevel(
      {
        permissionId: updatedPermission2!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1Id,
      },
      userFourCtx
    )
    expect(success4).toBeFalsy()

    const success5 = await changeCatalogObjectPermissionLevel(
      {
        permissionId: updatedPermission2!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(success5).toBeFalsy()

    // verify that the permission has not been updated in the database
    const updatedPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFour.id,
        },
      },
    })
    expect(updatedPermission3).toBeTruthy()
    expect(updatedPermission3!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it("Verify that permissions to an answer collection can only be revoked as long as they are unused and only by the object's ADMIN or OWNER", async () => {
    // create a new READ permission for user 5 on AC1
    const permission1 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        permissionStatus: PermissionStatus.GRANTED,
        answerCollection: {
          connect: {
            id: AC1Id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
        objectOwner: {
          connect: {
            id: userOne.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by owner
    const deletedPermissionId1 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission1.id,
        collectionId: AC1Id,
      },
      userOneCtx
    )
    expect(deletedPermissionId1).toBe(permission1.id)

    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission1).toBeNull()

    // create a new WRITE permission for user 5 on AC1
    const permission2 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        permissionStatus: PermissionStatus.GRANTED,
        answerCollection: {
          connect: {
            id: AC1Id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
        objectOwner: {
          connect: {
            id: userOne.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by admin
    const deletedPermissionId2 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission2.id,
        collectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(deletedPermissionId2).toBe(permission2.id)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // create a new ADMIN permission for user 5 on AC1
    const permission3 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        permissionStatus: PermissionStatus.GRANTED,
        answerCollection: {
          connect: {
            id: AC1Id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
        objectOwner: {
          connect: {
            id: userOne.id,
          },
        },
      },
      update: {},
    })

    // verify that the permission cannot be deleted by any other user with insufficient permissions
    const deletedPermissionId3 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1Id,
      },
      userThreeCtx
    )
    expect(deletedPermissionId3).toBeNull()

    const deletedPermissionId4 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1Id,
      },
      userFourCtx
    )
    expect(deletedPermissionId4).toBeNull()

    // create a question with the answer collection
    const selectionQuestion = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Question with answer collection',
        content: 'Question with answer collection',
        options: {},
        answerCollection: {
          connect: {
            id: AC1Id,
          },
        },
        owner: {
          connect: {
            id: userFive.id,
          },
        },
      },
    })

    // verify that the permission cannot be revoked any longer
    const removalSuccess1 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1Id,
      },
      userOneCtx
    )
    expect(removalSuccess1).toBeNull()

    const removalSuccess2 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1Id,
      },
      userTwoCtx
    )
    expect(removalSuccess2).toBeNull()

    // delete the question and verify that user 5 can revoke own access using admin permissions
    await prisma.element.delete({
      where: {
        id: selectionQuestion.id,
      },
    })

    const permissionSelfRemoval = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(permissionSelfRemoval).toBe(permission3.id)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()
  })

  it('Verify that only an answer collection OWNER can transfer the corresponding rights', async () => {
    // verify that users without owner permissions cannot transfer ownership
    const failure1 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userTwo.email,
      },
      userTwoCtx
    )
    expect(failure1).toBeNull()

    const failure2 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userThree.shortname,
      },
      userThreeCtx
    )
    expect(failure2).toBeNull()

    const failure3 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userFour.email,
      },
      userFourCtx
    )
    expect(failure3).toBeNull()

    const failure4 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userFive.shortname,
      },
      userFiveCtx
    )
    expect(failure4).toBeNull()

    // verify that the function fails if the specified user does not exist
    const failure5 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: 'missing_user_name',
      },
      userOneCtx
    )
    expect(failure5).toBeNull()

    // transfer ownership from user 1 to user 2, verify that admin permissions are awarded to user 1, permissions for user 2 are removed
    const dbPermissionUserTwoOld = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermissionUserTwoOld).toBeTruthy()
    expect(dbPermissionUserTwoOld!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const successPermission1 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userTwo.email,
      },
      userOneCtx
    )
    expect(successPermission1).toBeTruthy()
    expect(successPermission1!.userId).toBe(userOne.id)
    expect(successPermission1!.username).toBe(userOne.shortname)
    expect(successPermission1!.userEmail).toBe(userOne.email)
    expect(successPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(successPermission1!.isRevokable).toBe(true)
    expect(successPermission1!.isOwn).toBe(true)

    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission1).toBeTruthy()
    expect(dbPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // transfer ownership back to user 1 and verify permission modifications
    const successfulPermission2 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1Id,
        shortnameOrEmail: userOne.email,
      },
      userTwoCtx
    )
    expect(successfulPermission2).toBeTruthy()
    expect(successfulPermission2!.userId).toBe(userTwo.id)
    expect(successfulPermission2!.username).toBe(userTwo.shortname)
    expect(successfulPermission2!.userEmail).toBe(userTwo.email)
    expect(successfulPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(successfulPermission2!.isRevokable).toBe(true)
    expect(successfulPermission2!.isOwn).toBe(true)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission3).toBeTruthy()
    expect(dbPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1Id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission4).toBeNull()
  })

  it('Verify that only users with ADMIN or OWNER permissions can delete an answer collection', async () => {
    // create two new answer collections
    const name1 = `${answerCollection1.name} (New)`
    const name2 = `${answerCollection2.name} (New)`

    for (const collection of [
      { ...answerCollection1, name: name1 },
      { ...answerCollection2, name: name2 },
    ]) {
      await prisma.answerCollection.upsert({
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
    }

    const newAC1Id = (await prisma.answerCollection.findUnique({
      where: {
        ownerId_name: {
          ownerId: userOne.id,
          name: name1,
        },
      },
    }))!.id
    const newAC2Id = (await prisma.answerCollection.findUnique({
      where: {
        ownerId_name: {
          ownerId: userOne.id,
          name: name2,
        },
      },
    }))!.id

    // seed permissions for users 2, 3, 4 (ADMIN, WRITE, READ)
    for (const { user, permissionLevel } of [
      { user: userTwo, permissionLevel: PermissionLevel.ADMIN },
      { user: userThree, permissionLevel: PermissionLevel.WRITE },
      { user: userFour, permissionLevel: PermissionLevel.READ },
    ]) {
      await prisma.permission.create({
        data: {
          permissionLevel,
          permissionStatus: PermissionStatus.GRANTED,
          answerCollection: {
            connect: {
              id: newAC1Id,
            },
          },
          user: {
            connect: {
              id: user.id,
            },
          },
          objectOwner: {
            connect: {
              id: userOne.id,
            },
          },
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel,
          permissionStatus: PermissionStatus.GRANTED,
          answerCollection: {
            connect: {
              id: newAC2Id,
            },
          },
          user: {
            connect: {
              id: user.id,
            },
          },
          objectOwner: {
            connect: {
              id: userOne.id,
            },
          },
        },
      })
    }

    // try to delete answer collection with insufficient permissions
    const deletionFailure1 = await deleteAnswerCollection(
      { collectionId: newAC1Id },
      userThreeCtx
    )
    expect(deletionFailure1).toBeNull()

    const deletionFailure2 = await deleteAnswerCollection(
      { collectionId: newAC2Id },
      userFourCtx
    )
    expect(deletionFailure2).toBeNull()

    const deletionFailure3 = await deleteAnswerCollection(
      { collectionId: newAC1Id },
      userFiveCtx
    )
    expect(deletionFailure3).toBeNull()

    // delete first answer collection through user with ADMIN permissions
    const deletedACId = await deleteAnswerCollection(
      { collectionId: newAC1Id },
      userTwoCtx
    )
    expect(deletedACId).toBe(newAC1Id)

    // delete the second answer collection through user with OWNER permissions
    const deletedACId2 = await deleteAnswerCollection(
      { collectionId: newAC2Id },
      userOneCtx
    )
    expect(deletedACId2).toBe(newAC2Id)

    // make sure that all permissions have been automatically been revoked (since unused)
    for (const user of [userTwo, userThree, userFour]) {
      const dbPermission1 = await prisma.permission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: newAC1Id,
            userId: user.id,
          },
        },
      })
      expect(dbPermission1).toBeNull()

      const dbPermission2 = await prisma.permission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: newAC2Id,
            userId: user.id,
          },
        },
      })
      expect(dbPermission2).toBeNull()
    }
  })

  it('Create two catalog collections, one with PUBLIC access and one with RESTRICTED access', async () => {
    for (const collection of [catalogCollection1, catalogCollection2]) {
      const newCollection = await createCatalogCollection(
        {
          name: collection.name,
          access: collection.access,
        },
        userOneCtx
      )
      expect(newCollection).toBeTruthy()
      expect(newCollection!.name).toBe(collection.name)
      expect(newCollection!.access).toBe(collection.access)
      expect(newCollection!.ownerId).toBe(userOne.id)
      expect(newCollection!.ownerShortname).toBe(userOne.shortname)
      expect(newCollection!.isOwner).toBe(true)
      expect(newCollection!.isManager).toBe(true)
      expect(newCollection!.isEditor).toBe(true)
      expect(newCollection!.isRequested).toBe(false)
      expect(newCollection!.isShared).toBe(false)

      if (collection.access === ObjectAccess.PUBLIC) {
        publicCatalogId = newCollection!.id
      } else {
        restrictedCatalogId = newCollection!.id
      }
    }
  })

  it('Share the catalog collection directly with users 2, 3, and 4 with READ, WRITE, ADMIN permissions, respectively', async () => {
    for (const { user, permissionLevel } of [
      { user: userTwo, permissionLevel: PermissionLevel.READ },
      { user: userThree, permissionLevel: PermissionLevel.WRITE },
      { user: userFour, permissionLevel: PermissionLevel.ADMIN },
    ]) {
      const newPermission = await shareCatalogCollection(
        {
          catalogCollectionId: publicCatalogId,
          shortnameOrEmail: user.email,
          permissionLevel,
        },
        userOneCtx
      )
      expect(newPermission).toBeTruthy()
      expect(newPermission!.userId).toBe(user.id)
      expect(newPermission!.username).toBe(user.shortname)
      expect(newPermission!.userEmail).toBe(user.email)
      expect(newPermission!.permissionLevel).toBe(permissionLevel)
      expect(newPermission!.isRevokable).toBe(true)
      expect(newPermission!.isOwn).toBe(false)

      const newPermission2 = await shareCatalogCollection(
        {
          catalogCollectionId: restrictedCatalogId,
          shortnameOrEmail: user.shortname,
          permissionLevel,
        },
        userOneCtx
      )
      expect(newPermission2).toBeTruthy()
      expect(newPermission2!.userId).toBe(user.id)
      expect(newPermission2!.username).toBe(user.shortname)
      expect(newPermission2!.userEmail).toBe(user.email)
      expect(newPermission2!.permissionLevel).toBe(permissionLevel)
      expect(newPermission2!.isRevokable).toBe(true)
      expect(newPermission2!.isOwn).toBe(false)
    }
  })

  it('Verify that users with direct access can see all collections, other users can only see restricted catalog collection (empty public ones are hidden)', async () => {
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx, userFourCtx]) {
      const collections = await getCatalogCollectionsList(ctx)
      expect(collections).toHaveLength(2)
      expect(collections.map((collection) => collection.name)).toEqual(
        expect.arrayContaining([
          catalogCollection1.name,
          catalogCollection2.name,
        ])
      )
    }

    const collectionsUserFive = await getCatalogCollectionsList(userFiveCtx)
    expect(collectionsUserFive).toHaveLength(1)
    expect(collectionsUserFive[0]!.name).toBe(catalogCollection2.name)
  })

  it('Add answer collections to the catalog and verify required permissions', async () => {
    // verify that user 2 has insufficient permissions on the catalog collections
    // verify that users 3, 4, and 5 have insufficient permissions either on the catalog collection or answer collections (or both)
    for (const ctx of [userTwoCtx, userThreeCtx, userFourCtx, userFiveCtx]) {
      const res1 = await addObjectToCatalog(
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: publicCatalogId,
          answerCollectionId: AC1Id,
        },
        ctx
      )
      expect(res1).toBeNull()

      const res2 = await addObjectToCatalog(
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: restrictedCatalogId,
          answerCollectionId: AC2Id,
        },
        ctx
      )
      expect(res2).toBeNull()
    }

    // verify that no catalog collection assignments except the ones from the top level are stored in the database
    const dbAssignments1 = await prisma.catalogCollectionAssignment.count({
      where: {
        catalogCollectionId: {
          not: MISSING_CATALOG_COLLECTION_ID,
        },
        answerCollectionId: {
          in: [AC1Id, AC2Id],
        },
      },
    })
    expect(dbAssignments1).toBe(0)

    // assign the two answer collections to both the public and restricted catalog collections
    for (const { catalogId, collectionId, access } of [
      {
        catalogId: publicCatalogId,
        collectionId: AC1Id,
        access: ObjectAccess.PUBLIC,
      },
      {
        catalogId: publicCatalogId,
        collectionId: AC2Id,
        access: ObjectAccess.RESTRICTED,
      },
      {
        catalogId: restrictedCatalogId,
        collectionId: AC1Id,
        access: ObjectAccess.PUBLIC,
      },
      {
        catalogId: restrictedCatalogId,
        collectionId: AC2Id,
        access: ObjectAccess.RESTRICTED,
      },
    ]) {
      const res = await addObjectToCatalog(
        {
          access,
          catalogCollectionId: catalogId,
          answerCollectionId: collectionId,
        },
        userOneCtx
      )
      expect(res).toBeTruthy()
      expect(res!.id).toBe(collectionId)
      expect(res!.objectType).toBe(CatalogObjectType.ANSWER_COLLECTION)
      expect(res!.access).toBe(access)
      expect(res!.ownerShortname).toBe(userOne.shortname)
      expect(res!.isOwner).toBe(true)
      expect(res!.isManager).toBe(true)
      expect(res!.isRequested).toBe(false)
      expect(res!.isShared).toBe(false)
    }

    // verify that a total number of 6 catalog object assignments are stored in the database now (incl. 2 on top level)
    const dbAssignments2 = await prisma.catalogCollectionAssignment.count({
      where: {
        answerCollectionId: {
          in: [AC1Id, AC2Id],
        },
      },
    })
    expect(dbAssignments2).toBe(6)
  })

  it('Verify modification object access on catalog collections and their interplay with object permissions', async () => {
    // verify that object access permissions on top catalog collection are determined by object access (users 1 and 2 have sufficient permissions)
    const topAssignmentAC1 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(topAssignmentAC1).toBeTruthy()
    expect(topAssignmentAC1!.access).toBe(ObjectAccess.PUBLIC)

    const failure1 = await changeCatalogObjectAccess(
      {
        assignmentId: topAssignmentAC1!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await changeCatalogObjectAccess(
      {
        assignmentId: topAssignmentAC1!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userFourCtx
    )
    expect(failure2).toBeFalsy()

    const failure3 = await changeCatalogObjectAccess(
      {
        assignmentId: topAssignmentAC1!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const topAssignmentAC1NotUpdated =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(topAssignmentAC1NotUpdated).toBeTruthy()
    expect(topAssignmentAC1NotUpdated!.access).toBe(ObjectAccess.PUBLIC)

    const success1 = await changeCatalogObjectAccess(
      {
        assignmentId: topAssignmentAC1!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    const topAssignmentAC1Updated =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(topAssignmentAC1Updated).toBeTruthy()
    expect(topAssignmentAC1Updated!.access).toBe(ObjectAccess.RESTRICTED)

    const success2 = await changeCatalogObjectAccess(
      {
        assignmentId: topAssignmentAC1!.id,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(success2).toBeTruthy()

    const topAssignmentAC1dReverted =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(topAssignmentAC1dReverted).toBeTruthy()
    expect(topAssignmentAC1dReverted!.access).toBe(ObjectAccess.PUBLIC)

    // verify that all users with WRITE permissions can change the object access of objects included in a catalog collection
    // user 2 should not have these permissions, despite having admin rights on the object itself (insufficient permissions on the catalog collection)
    const catalogAssignment =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: publicCatalogId,
          },
        },
      })
    expect(catalogAssignment).toBeTruthy()
    expect(catalogAssignment!.access).toBe(ObjectAccess.PUBLIC)

    const failure4 = await changeCatalogObjectAccess(
      {
        assignmentId: catalogAssignment!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userTwoCtx
    )
    expect(failure4).toBeFalsy()

    const failure5 = await changeCatalogObjectAccess(
      {
        assignmentId: catalogAssignment!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userFiveCtx
    )
    expect(failure5).toBeFalsy()

    const catalogAssignmentNotUpdated =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: publicCatalogId,
          },
        },
      })
    expect(catalogAssignmentNotUpdated).toBeTruthy()
    expect(catalogAssignmentNotUpdated!.access).toBe(ObjectAccess.PUBLIC)

    const success3 = await changeCatalogObjectAccess(
      {
        assignmentId: catalogAssignment!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )
    expect(success3).toBeTruthy()

    const catalogAssignmentUpdated =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: publicCatalogId,
          },
        },
      })
    expect(catalogAssignmentUpdated).toBeTruthy()
    expect(catalogAssignmentUpdated!.access).toBe(ObjectAccess.RESTRICTED)

    const success4 = await changeCatalogObjectAccess(
      {
        assignmentId: catalogAssignment!.id,
        access: ObjectAccess.PUBLIC,
      },
      userFourCtx
    )
    expect(success4).toBeTruthy()

    const catalogAssignmentReverted =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: publicCatalogId,
          },
        },
      })
    expect(catalogAssignmentReverted).toBeTruthy()
    expect(catalogAssignmentReverted!.access).toBe(ObjectAccess.PUBLIC)

    const success5 = await changeCatalogObjectAccess(
      {
        assignmentId: catalogAssignment!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(success5).toBeTruthy()

    const catalogAssignmentUpdated2 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1Id,
            catalogCollectionId: publicCatalogId,
          },
        },
      })
    expect(catalogAssignmentUpdated2).toBeTruthy()
    expect(catalogAssignmentUpdated2!.access).toBe(ObjectAccess.RESTRICTED)

    // undo change in the assignment of the catalog collection
    await prisma.catalogCollectionAssignment.update({
      where: {
        id: catalogAssignment!.id,
      },
      data: {
        access: ObjectAccess.PUBLIC,
      },
    })
  })

  it('Verify that all users with WRITE permissions on a catalog collection can trigger name modifications', async () => {
    const newName = `${catalogCollection1.name} (New)`
    const newName2 = `${catalogCollection2.name} (New)`

    // users 2 and 5 have insufficient permissions
    const failure1 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalogId,
        name: newName,
      },
      userTwoCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalogId,
        name: newName,
      },
      userFiveCtx
    )
    expect(failure2).toBeFalsy()

    // verify that the name of the catalog collection has not been modified
    const dbCatalog1 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalogId,
      },
    })
    expect(dbCatalog1).toBeTruthy()
    expect(dbCatalog1!.name).toBe(catalogCollection1.name)

    // modify the name of the catalog collection through users 1, 3, and 4
    const success1 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalogId,
        name: newName,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    const dbCatalog2 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalogId,
      },
    })
    expect(dbCatalog2).toBeTruthy()
    expect(dbCatalog2!.name).toBe(newName)

    const success2 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalogId,
        name: newName2,
      },
      userThreeCtx
    )
    expect(success2).toBeTruthy()

    const dbCatalog3 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalogId,
      },
    })
    expect(dbCatalog3).toBeTruthy()
    expect(dbCatalog3!.name).toBe(newName2)

    const success3 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalogId,
        name: catalogCollection1.name,
      },
      userFourCtx
    )
    expect(success3).toBeTruthy()

    const dbCatalog4 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalogId,
      },
    })
    expect(dbCatalog4).toBeTruthy()
    expect(dbCatalog4!.name).toBe(catalogCollection1.name)
  })

  it('Verify that user 5 can request access and import public answer collections in public catalog (incl. clean up)', async () => {
    // verify that requesting / importing answer collections through the restricted catalog collection does not work
    const failure1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalogId,
        answerCollectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await importAnswerCollection(
      {
        catalogCollectionId: restrictedCatalogId,
        collectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(failure2).toBeFalsy()

    const pendingPermissions1 = await prisma.permission.count({
      where: {
        permissionStatus: PermissionStatus.REQUESTED,
        userId: userFive.id,
      },
    })
    expect(pendingPermissions1).toBe(0)
    const importedACs = await prisma.answerCollection.count({
      where: {
        ownerId: userFive.id,
      },
    })
    expect(importedACs).toBe(0)

    // request access to public and restricted AC
    const success1 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalogId,
        answerCollectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const success2 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalogId,
        answerCollectionId: AC2Id,
      },
      userFiveCtx
    )
    expect(success2).toBeTruthy()

    const pendingPermissions2 = await prisma.permission.findMany({
      where: {
        permissionStatus: PermissionStatus.REQUESTED,
        userId: userFive.id,
      },
    })
    expect(pendingPermissions2.length).toBe(2)
    expect(
      pendingPermissions2.map((permission) => permission.answerCollectionId)
    ).toEqual(expect.arrayContaining([AC1Id, AC1Id]))

    // import public AC and verify that importing restricted AC does not work
    const failure3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalogId,
        collectionId: AC2Id, // restricted answer collection
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const success3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalogId,
        collectionId: AC1Id, // public answer collection
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const importedACs2 = await prisma.answerCollection.findMany({
      where: {
        ownerId: userFive.id,
      },
    })
    expect(importedACs2.length).toBe(1)
    expect(importedACs2[0]!.originalId).toBe(AC1Id)
    expect(importedACs2[0]!.name).toBe(answerCollection1.name)

    // verify that duplicate requests are not accepted, duplicate imports are not a problem
    const failure4 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalogId,
        answerCollectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const pendingPermissions3 = await prisma.permission.findMany({
      where: {
        permissionStatus: PermissionStatus.REQUESTED,
        userId: userFive.id,
      },
    })
    expect(pendingPermissions3.length).toBe(2)

    const success4 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalogId,
        collectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(success4).toBeTruthy()

    const importedACs3 = await prisma.answerCollection.findMany({
      where: {
        ownerId: userFive.id,
      },
    })
    expect(importedACs3.length).toBe(2)
    expect(importedACs3[0]!.originalId).toBe(AC1Id)
    expect(importedACs3[0]!.name).toContain(answerCollection1.name)
    expect(importedACs3[1]!.originalId).toBe(AC1Id)
    expect(importedACs3[1]!.name).toContain(answerCollection1.name)

    // delete the imported answer collections (2) and the two pending permission requests
    await prisma.answerCollection.deleteMany({
      where: {
        ownerId: userFive.id,
      },
    })
    await prisma.permission.deleteMany({
      where: {
        permissionStatus: PermissionStatus.REQUESTED,
        userId: userFive.id,
      },
    })
  })

  it('Request and approve / deny requests to restricted catalog collection', async () => {
    // request access to the restricted catalog collection for user 5
    const success1 = await requestCatalogCollection(
      {
        catalogCollectionId: restrictedCatalogId,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const pendingAccessRequest1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(pendingAccessRequest1).toBeTruthy()
    expect(pendingAccessRequest1!.permissionStatus).toBe(
      PermissionStatus.REQUESTED
    )

    // deny the access request (only owner is allowed for this operation)
    const failure1 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
      },
      userTwoCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
      },
      userThreeCtx
    )
    expect(failure2).toBeFalsy()

    const failure3 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
      },
      userFourCtx
    )
    expect(failure3).toBeFalsy()

    const failure4 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const pendingAccessRequest2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(pendingAccessRequest2).toBeTruthy()
    expect(pendingAccessRequest2!.permissionStatus).toBe(
      PermissionStatus.REQUESTED
    )

    const success2 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest2!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
      },
      userOneCtx
    )
    expect(success2).toBeTruthy()

    const deniedAccessRequest = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(deniedAccessRequest).toBeNull()

    // request access to the restricted catalog collection for user 5 again
    const success3 = await requestCatalogCollection(
      {
        catalogCollectionId: restrictedCatalogId,
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const pendingAccessRequest3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(pendingAccessRequest3).toBeTruthy()
    expect(pendingAccessRequest3!.permissionStatus).toBe(
      PermissionStatus.REQUESTED
    )

    // approve the access request
    const success4 = await resolveObjectSharingRequest(
      {
        permissionId: pendingAccessRequest3!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: true,
      },
      userOneCtx
    )
    expect(success4).toBeTruthy()

    const approvedAccessRequest = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(approvedAccessRequest).toBeTruthy()
    expect(approvedAccessRequest!.permissionStatus).toBe(
      PermissionStatus.GRANTED
    )
  })

  it('After being granted access, verify that user 5 can now request / import answer collections from restricted catalog collection (incl. clean up)', async () => {
    // request access to restricted answer collection
    const success1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalogId,
        answerCollectionId: AC2Id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const pendingPermissionRequest = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2Id,
          userId: userFive.id,
        },
      },
    })
    expect(pendingPermissionRequest).toBeTruthy()
    expect(pendingPermissionRequest!.permissionStatus).toBe(
      PermissionStatus.REQUESTED
    )

    // import public answer collection
    const success2 = await importAnswerCollection(
      {
        catalogCollectionId: restrictedCatalogId,
        collectionId: AC1Id,
      },
      userFiveCtx
    )
    expect(success2).toBeTruthy()

    const importedACs = await prisma.answerCollection.findMany({
      where: {
        ownerId: userFive.id,
      },
    })
    expect(importedACs.length).toBe(1)
    expect(importedACs[0]!.originalId).toBe(AC1Id)
    expect(importedACs[0]!.name).toBe(answerCollection1.name)

    // clean up - remove imported answer collection and pending permission request
    await prisma.answerCollection.delete({
      where: {
        ownerId_name: {
          ownerId: userFive.id,
          name: answerCollection1.name,
        },
      },
    })
    await prisma.permission.delete({
      where: {
        id: pendingPermissionRequest!.id,
      },
    })
  })

  it("Verify that only users with ADMIN permissions on catalog collection can change other user's permissions", async () => {
    const permissionUser2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionUser2).toBeTruthy()
    expect(permissionUser2!.permissionStatus).toBe(PermissionStatus.GRANTED)
    expect(permissionUser2!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that READ and WRITE permission are insufficient for permission level change
    const failure1 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: restrictedCatalogId,
      },
      userTwoCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: restrictedCatalogId,
      },
      userThreeCtx
    )

    const failure3 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: restrictedCatalogId,
      },
      userFiveCtx
    )

    // verify that the permission has not been changed
    const permissionVerification1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionVerification1).toBeTruthy()
    expect(permissionVerification1!.permissionStatus).toBe(
      PermissionStatus.GRANTED
    )
    expect(permissionVerification1!.permissionLevel).toBe(PermissionLevel.READ)

    // change the permission level through catalog collection owner and verify the change
    const success1 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: restrictedCatalogId,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    const permissionVerification2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionVerification2).toBeTruthy()
    expect(permissionVerification2!.permissionStatus).toBe(
      PermissionStatus.GRANTED
    )
    expect(permissionVerification2!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // change the permission level back to READ through ADMIN user and verify the change
    const success2 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.READ,
        catalogCollectionId: restrictedCatalogId,
      },
      userOneCtx
    )
    expect(success2).toBeTruthy()

    const permissionVerification3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionVerification3).toBeTruthy()
    expect(permissionVerification3!.permissionStatus).toBe(
      PermissionStatus.GRANTED
    )
    expect(permissionVerification3!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it('Verify that only users with ADMIN permissions on catalog collection can revoke access', async () => {
    // add READ permission to restricted catalog collection for user 5
    const permission1 = await prisma.permission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        permissionStatus: PermissionStatus.GRANTED,
        catalogCollection: {
          connect: {
            id: restrictedCatalogId,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
        objectOwner: {
          connect: {
            id: userOne.id,
          },
        },
      },
      update: {},
    })
    expect(permission1).toBeTruthy()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that permission cannot be revoked with READ and WRITE access
    const failure1 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission1.id,
        catalogCollectionId: restrictedCatalogId,
      },
      userTwoCtx
    )
    expect(failure1).toBeNull()

    const failure2 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission1.id,
        catalogCollectionId: restrictedCatalogId,
      },
      userThreeCtx
    )
    expect(failure2).toBeNull()

    const failure3 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission1.id,
        catalogCollectionId: restrictedCatalogId,
      },
      userFiveCtx
    )
    expect(failure3).toBeNull()

    // verify that the permission has not been revoked
    const permissionVerification1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification1).toBeTruthy()
    expect(permissionVerification1!.permissionStatus).toBe(
      PermissionStatus.GRANTED
    )
    expect(permissionVerification1!.permissionLevel).toBe(PermissionLevel.READ)

    // revoke permission with owner permissions on restricted catalog collection
    const revokedPermissionId1 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission1.id,
        catalogCollectionId: restrictedCatalogId,
      },
      userOneCtx
    )
    expect(revokedPermissionId1).toBe(permission1.id)

    const permissionVerification2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification2).toBeNull()

    // re-add WRITE permission to restricted catalog collection for user 5
    const permission2 = await prisma.permission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        permissionStatus: PermissionStatus.GRANTED,
        catalogCollection: {
          connect: {
            id: restrictedCatalogId,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
        objectOwner: {
          connect: {
            id: userOne.id,
          },
        },
      },
      update: {},
    })
    expect(permission2).toBeTruthy()
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    // revoke permission with ADMIN permissions on restricted catalog collection
    const revokedPermissionId2 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission2.id,
        catalogCollectionId: restrictedCatalogId,
      },
      userFourCtx
    )
    expect(revokedPermissionId2).toBe(permission2.id)

    const permissionVerification3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification3).toBeNull()
  })

  it('Verify that only an catalog collection OWNER can transfer the corresponding rights', async () => {
    // verify that transferring ownership fails for all users that have no owner privileges
    const failure1 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userFour.email,
      },
      userTwoCtx
    )
    expect(failure1).toBeNull()

    const failure2 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userFour.email,
      },
      userThreeCtx
    )
    expect(failure2).toBeNull()

    const failure3 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userFour.email,
      },
      userFourCtx
    )
    expect(failure3).toBeNull()

    const failure4 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userFour.email,
      },
      userFiveCtx
    )
    expect(failure4).toBeNull()

    // transfer ownership rights of restricted catalog collection to other admin (user 4) and validate creation of own admin permission
    const dbPermission = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission).toBeTruthy()
    expect(dbPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(dbPermission!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const newPermission1 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userFour.email,
      },
      userOneCtx
    )
    expect(newPermission1).toBeTruthy()
    expect(newPermission1!.userId).toBe(userOne.id)
    expect(newPermission1!.username).toBe(userOne.shortname)
    expect(newPermission1!.userEmail).toBe(userOne.email)
    expect(newPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(newPermission1!.isRevokable).toBe(true)
    expect(newPermission1!.isOwn).toBe(true)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(dbPermission2!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    const updatedCatalogCollection = await prisma.catalogCollection.findUnique({
      where: {
        id: restrictedCatalogId,
      },
    })
    expect(updatedCatalogCollection).toBeTruthy()
    expect(updatedCatalogCollection!.ownerId).toBe(userFour.id)

    // transfer ownership rights back to original owner (user 1) and validate that the admin permission has been removed
    const newPermission2 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalogId,
        shortnameOrEmail: userOne.shortname,
      },
      userFourCtx
    )
    expect(newPermission2).toBeTruthy()
    expect(newPermission2!.userId).toBe(userFour.id)
    expect(newPermission2!.username).toBe(userFour.shortname)
    expect(newPermission2!.userEmail).toBe(userFour.email)
    expect(newPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(newPermission2!.isRevokable).toBe(true)
    expect(newPermission2!.isOwn).toBe(true)

    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission4).toBeTruthy()
    expect(dbPermission4!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(dbPermission4!.permissionStatus).toBe(PermissionStatus.GRANTED)

    const dbPermission5 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalogId,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission5).toBeNull()
  })

  it('Verify that only users with ADMIN or OWNER permissions can delete a catalog collection', async () => {
    // verify that the deletion of a catalog collection by users without sufficient permissions fails
    const deletedCollectionId1 = await deleteCatalogCollection(
      {
        catalogCollectionId: publicCatalogId,
      },
      userTwoCtx
    )
    expect(deletedCollectionId1).toBeNull()

    const deletedCollectionId2 = await deleteCatalogCollection(
      {
        catalogCollectionId: publicCatalogId,
      },
      userThreeCtx
    )
    expect(deletedCollectionId2).toBeNull()

    const deletedCollectionId3 = await deleteCatalogCollection(
      {
        catalogCollectionId: publicCatalogId,
      },
      userFiveCtx
    )
    expect(deletedCollectionId3).toBeNull()

    // delete the public catalog collection through user 1 with owner permissions
    const deletedCollectionId4 = await deleteCatalogCollection(
      {
        catalogCollectionId: publicCatalogId,
      },
      userOneCtx
    )
    expect(deletedCollectionId4).toBeTruthy()
    expect(deletedCollectionId4).toBe(publicCatalogId)

    const dbCatalog1 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalogId,
      },
    })
    expect(dbCatalog1).toBeNull()

    // delete the restricted catalog collection through user 4 with admin permissions
    const deletedCollectionId5 = await deleteCatalogCollection(
      {
        catalogCollectionId: restrictedCatalogId,
      },
      userFourCtx
    )
    expect(deletedCollectionId5).toBeTruthy()
    expect(deletedCollectionId5).toBe(restrictedCatalogId)

    const dbCatalog2 = await prisma.catalogCollection.findUnique({
      where: {
        id: restrictedCatalogId,
      },
    })
    expect(dbCatalog2).toBeNull()
  })

  it('Verify that all catalog assignments have been removed automatically, clean up created answer collections and users', async () => {
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

    // verify that no elements are left in the permission table
    const dbPermissions = await prisma.element.count()
    expect(dbPermissions).toBe(0)

    // delete all answer collections that are left in the database
    await prisma.answerCollection.deleteMany({})
    const dbAnswerCollections = await prisma.answerCollection.count()
    expect(dbAnswerCollections).toBe(0)

    // delete all users that have been created for the test and validate that they have been removed
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: userOne.email },
          { email: userTwo.email },
          { email: userThree.email },
          { email: userFour.email },
          { email: userFive.email },
        ],
      },
    })
    const dbUsers = await prisma.user.count()
    expect(dbUsers).toBe(0)
  })
})
