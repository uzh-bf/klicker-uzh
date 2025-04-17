import {
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import { ActivityType, CatalogObjectType } from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
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
  changeObjectPermissionLevel,
  createCatalogCollection,
  deleteCatalogCollection,
  getCatalogAnswerCollections,
  getCatalogCollectionsList,
  importAnswerCollection,
  requestCatalogCollection,
  requestCatalogObject,
  resolveObjectSharingRequest,
  revokeAnswerCollectionAccess,
  revokeCatalogCollectionAccess,
  shareCatalogCollection,
  shareObject,
  transferAnswerCollectionOwnership,
  transferCatalogCollectionOwnership,
} from '../src/services/sharing.js'
import {
  deleteActivityTemplate,
  validateTemplateAccessible,
} from '../src/services/templates.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import {
  answerCollection1,
  answerCollection2,
  catalogCollection1,
  catalogCollection2,
} from './sharingData.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

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
    const { prisma: newPrisma, emitter: newEmitter } = await initializePrisma()
    prisma = newPrisma
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const {
      userOneCtx: ctx1,
      userTwoCtx: ctx2,
      userThreeCtx: ctx3,
      userFourCtx: ctx4,
      userFiveCtx: ctx5,
    } = await testInitialization(prisma, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  async function createAnswerCollections(prisma) {
    // create answer collections that can be added to the catalog to test sharing
    const [AC1, AC2] = await Promise.all(
      [answerCollection1, answerCollection2].map(async (collection) => {
        const newAnswerCollection = await prisma.answerCollection.upsert({
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

        await recomputeDerivedPermissions(
          { answerCollectionId: newAnswerCollection.id, userId: userOne.id },
          prisma
        )

        return newAnswerCollection
      })
    )

    // verify that answer collections have been created correctly in the database (including entries)
    expect([AC1, AC2].map((collection) => collection.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    // identify the collections by name and compare the entries
    expect(AC1).toBeTruthy()
    expect(AC2).toBeTruthy()
    expect(AC1!.entries).toHaveLength(4)
    expect(AC2!.entries).toHaveLength(4)
    expect(AC1!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(AC2!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection2.entries)
    )

    return { AC1, AC2 }
  }

  async function createCatalogCollections(prisma) {
    const [publicCatalog, restrictedCatalog] = await Promise.all([
      createCatalogCollection(
        {
          name: catalogCollection1.name,
          access: catalogCollection1.access,
        },
        userOneCtx
      ),
      createCatalogCollection(
        {
          name: catalogCollection2.name,
          access: catalogCollection2.access,
        },
        userOneCtx
      ),
    ])

    return { publicCatalog, restrictedCatalog }
  }

  async function createLiveQuizTemplates(prisma) {
    // create activity templates (without content, simply for access validation)
    const LQ1Id = 'ca9f1fc4-0daf-4cdb-92b3-e55557b24831'
    const LQ2Id = '86ff081d-07cd-4bea-91b7-fc633ed7a092'
    const LQ3Id = '3be3228c-4a64-4a84-8743-46c4ba0ed333'
    const templateData = [
      { id: LQ1Id, name: 'LQ1' },
      { id: LQ2Id, name: 'LQ2' },
      { id: LQ3Id, name: 'LQ3' },
    ]
    const ATs = await Promise.all(
      templateData.map(async ({ id, name }) => {
        const newTemplate = await prisma.activityTemplate.create({
          data: {
            description: `${name} Description`,
            instructions: `${name} Instructions`,
            liveQuiz: {
              create: {
                id, // activity id is relevant (connected to assignments, etc. - templateId mainly for routing)
                name,
                displayName: name,
                status: PublicationStatus.TEMPLATE,
                owner: {
                  connect: {
                    id: userOne.id,
                  },
                },
              },
            },
          },
        })

        await recomputeDerivedPermissions(
          { liveQuizId: id, userId: userOne.id },
          prisma
        )

        return newTemplate
      })
    )
    const templateId1 = ATs.find((AT) => AT.liveQuizId === LQ1Id)!.id
    const templateId2 = ATs.find((AT) => AT.liveQuizId === LQ2Id)!.id
    const templateId3 = ATs.find((AT) => AT.liveQuizId === LQ3Id)!.id

    return { templateId1, templateId2, templateId3, LQ1Id, LQ2Id, LQ3Id }
  }

  async function seedAnswerCollectionPermissions(prisma, AC1Id, AC2Id) {
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

  async function seedCatalogCollectionPermissions(
    prisma,
    publicId,
    restrictedId
  ) {
    // create permissions for users 2, 3, and 4 (READ, WRITE, ADMIN in ascending order)
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.READ,
          userId: userTwo.id,
          catalogCollectionId: publicId,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: publicId,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: publicId,
        },
        {
          permissionLevel: PermissionLevel.READ,
          userId: userTwo.id,
          catalogCollectionId: restrictedId,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: restrictedId,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: restrictedId,
        },
      ],
    })

    // recompute derived permissions that are checked in backend service functions
    await recomputeDerivedPermissions({ catalogCollectionId: publicId }, prisma)
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedId },
      prisma
    )
  }

  async function seedAnswerCollectionCatalogAssignments(
    prisma,
    AC1Id,
    AC2Id,
    publicId,
    restrictedId
  ) {
    // add all catalog collection assignments we need
    await prisma.catalogCollectionAssignment.createMany({
      data: [
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          answerCollectionId: AC1Id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          answerCollectionId: AC2Id,
        },
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: publicId,
          answerCollectionId: AC1Id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: publicId,
          answerCollectionId: AC2Id,
        },
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: restrictedId,
          answerCollectionId: AC1Id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: restrictedId,
          answerCollectionId: AC2Id,
        },
      ],
    })
  }

  it('Seed all required users and the top-level catalog collection', async () => {
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
  })

  it('Share the answer collections directly with users 2, 3, and 4 with ADMIN, WRITE, and READ permissions, respectively', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)

    // object can only be shared with users that exist (email or username)
    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: 'missing_user_name',
        answerCollectionId: AC1.id,
      },
      userTwoCtx
    )
    expect(res4).toBeNull()

    // user 1 shares the answer collection 1 with users 2, 3, and 4 (via email or username)
    const res5 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.email,
        answerCollectionId: AC1.id,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()
    expect(res5!.userId).toBe(userTwo.id)
    expect(res5!.username).toBe(userTwo.shortname)
    expect(res5!.userEmail).toBe(userTwo.email)
    expect(res5!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res5!.isOwn).toBe(false)

    const res6 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userThree.shortname,
        answerCollectionId: AC1.id,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    expect(res6!.userId).toBe(userThree.id)
    expect(res6!.username).toBe(userThree.shortname)
    expect(res6!.userEmail).toBe(userThree.email)
    expect(res6!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res6!.isOwn).toBe(false)

    const res7 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userFour.email,
        answerCollectionId: AC1.id,
      },
      userOneCtx
    )
    expect(res7).toBeTruthy()
    expect(res7!.userId).toBe(userFour.id)
    expect(res7!.username).toBe(userFour.shortname)
    expect(res7!.userEmail).toBe(userFour.email)
    expect(res7!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res7!.isOwn).toBe(false)

    // user 1 shares the answer collection 2 with user 2
    const res8 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.shortname,
        answerCollectionId: AC2.id,
      },
      userOneCtx
    )
    expect(res8).toBeTruthy()
    expect(res8!.userId).toBe(userTwo.id)
    expect(res8!.username).toBe(userTwo.shortname)
    expect(res8!.userEmail).toBe(userTwo.email)
    expect(res8!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res8!.isOwn).toBe(false)

    // user 2 uses admin permissions to share collection with users 3 and 4
    const res9 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userThree.email,
        answerCollectionId: AC2.id,
      },
      userTwoCtx
    )
    expect(res9).toBeTruthy()
    expect(res9!.userId).toBe(userThree.id)
    expect(res9!.username).toBe(userThree.shortname)
    expect(res9!.userEmail).toBe(userThree.email)
    expect(res9!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res9!.isOwn).toBe(false)

    const res10 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userFour.shortname,
        answerCollectionId: AC2.id,
      },
      userTwoCtx
    )
    expect(res10).toBeTruthy()
    expect(res10!.userId).toBe(userFour.id)
    expect(res10!.username).toBe(userFour.shortname)
    expect(res10!.userEmail).toBe(userFour.email)
    expect(res10!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res10!.isOwn).toBe(false)

    // verify that all permissions have been created correctly in the database
    const permission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permission1).toBeTruthy()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const permission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userThree.id,
        },
      },
    })
    expect(permission2).toBeTruthy()
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const permission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFour.id,
        },
      },
    })
    expect(permission3).toBeTruthy()
    expect(permission3!.permissionLevel).toBe(PermissionLevel.READ)

    const permission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permission4).toBeTruthy()
    expect(permission4!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const permission5 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2.id,
          userId: userThree.id,
        },
      },
    })
    expect(permission5).toBeTruthy()
    expect(permission5!.permissionLevel).toBe(PermissionLevel.WRITE)

    const permission6 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2.id,
          userId: userFour.id,
        },
      },
    })
    expect(permission6).toBeTruthy()
    expect(permission6!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it('Verify that all users with access to the answer collection can at view its content and use it in corresonding elements', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

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

    // check availability for viewing and/or editing modal
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx, userFourCtx]) {
      const collection1 = await getSingleAnswerCollection({ id: AC1.id }, ctx)
      expect(collection1).toBeTruthy()
      expect(collection1!.name).toBe(answerCollection1.name)
      expect(collection1!.description).toBe(answerCollection1.description)
      expect(collection1!.entries).toHaveLength(4)

      const collection2 = await getSingleAnswerCollection({ id: AC2.id }, ctx)
      expect(collection2).toBeTruthy()
      expect(collection2!.name).toBe(answerCollection2.name)
      expect(collection2!.description).toBe(answerCollection2.description)
      expect(collection2!.entries).toHaveLength(4)
    }
  })

  it("Test the modification of the answer collection's content", async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

    // test the modification of the answer collection's name and description with OWNER AND ADMIN permissions
    const updatedCollection1 = await modifyAnswerCollection(
      {
        id: AC1.id,
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
        id: AC2.id,
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
        id: AC1.id,
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
        id: AC2.id,
        name: answerCollection2.name,
        description: answerCollection2.description,
      },
      userThreeCtx
    )
    expect(updatedCollection4).toBeTruthy()
    expect(updatedCollection4!.name).toBe(answerCollection2.name)
    expect(updatedCollection4!.description).toBe(answerCollection2.description)

    // verify that changing and answer collection entry value required WRITE permissions (at least)
    const dbAC1 = await prisma.answerCollection.findUnique({
      where: { id: AC1.id },
      include: { entries: true },
    })
    expect(dbAC1).toBeTruthy()
    expect(dbAC1!.entries).toHaveLength(4)
    const entry1 = dbAC1!.entries[0]

    const updatedEntry1 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated)`,
        collectionId: AC1.id,
      },
      userOneCtx
    )
    expect(updatedEntry1).toBeTruthy()
    expect(updatedEntry1!.value).toBe(`${entry1!.value} (Updated)`)

    const updatedEntry2 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: `${entry1!.value} (Updated 2)`,
        collectionId: AC1.id,
      },
      userTwoCtx
    )
    expect(updatedEntry2).toBeTruthy()
    expect(updatedEntry2!.value).toBe(`${entry1!.value} (Updated 2)`)

    const updatedEntry3 = await editAnswerCollectionEntry(
      {
        id: entry1!.id,
        value: entry1!.value,
        collectionId: AC1.id,
      },
      userThreeCtx
    )
    expect(updatedEntry3).toBeTruthy()
    expect(updatedEntry3!.value).toBe(entry1!.value)

    // verify that users with WRITE permissions can add and remove entries from an answer collection
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx]) {
      // add new value to answer collection
      const newEntryValue = `New Entry ${ctx.user.sub}`
      const newEntry = await addAnswerCollectionOption(
        {
          collectionId: AC1.id,
          value: newEntryValue,
        },
        ctx
      )
      expect(newEntry).toBeTruthy()
      expect(newEntry!.value).toBe(newEntryValue)

      // verify that new entry has been added to answer collection
      const dbAC1Updated = await prisma.answerCollection.findUnique({
        where: { id: AC1.id },
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
          collectionId: AC1.id,
        },
        ctx
      )
      expect(removedEntry).toBeTruthy()
      expect(removedEntry).toBe(newEntry!.id)

      // verify that the entry has been removed from the answer collection
      const dbAC1Removed = await prisma.answerCollection.findUnique({
        where: { id: AC1.id },
        include: { entries: true },
      })
      expect(dbAC1Removed).toBeTruthy()
      expect(dbAC1Removed!.entries).toHaveLength(4)
      expect(dbAC1Removed!.entries.map((entry) => entry.value)).toEqual(
        expect.arrayContaining(answerCollection1.entries)
      )
    }
  })

  it('Test the functionality to add an answer collection to a catalog', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

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
        answerCollectionId: AC1.id,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res1!.id).toBe(AC1.id)
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
        answerCollectionId: AC2.id,
      },
      userTwoCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.id).toBe(AC2.id)
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
        answerCollectionId: AC1.id,
      },
      userThreeCtx
    )
    expect(res3).toBeNull()

    const res4 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1.id,
      },
      userFourCtx
    )
    expect(res4).toBeNull()

    const res5 = await addObjectToCatalog(
      {
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(res5).toBeNull()

    // verify if the assignments have been stored correctly in the database
    const AC1Assignment = await prisma.catalogCollectionAssignment.findUnique({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: AC1.id,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
    })
    expect(AC1Assignment).toBeTruthy()
    expect(AC1Assignment!.access).toBe(ObjectAccess.PUBLIC)

    const AC2Assignment = await prisma.catalogCollectionAssignment.findUnique({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: AC2.id,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
    })
    expect(AC2Assignment).toBeTruthy()
    expect(AC2Assignment!.access).toBe(ObjectAccess.RESTRICTED)
  })

  it('Test the modification of individual permission levels', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

    // fetch the permission that should be modified and verify its initial value
    const permission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFour.id,
        },
      },
    })
    expect(permission).toBeTruthy()
    expect(permission!.permissionLevel).toBe(PermissionLevel.READ)

    // change the permission READ -> WRITE
    const success1 = await changeObjectPermissionLevel(
      {
        permissionId: permission!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1.id,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    // verify that the permission has been updated in the database
    const updatedPermission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFour.id,
        },
      },
    })
    expect(updatedPermission).toBeTruthy()
    expect(updatedPermission!.permissionLevel).toBe(PermissionLevel.WRITE)

    // use admin permissions to change the permission level back to READ
    const success2 = await changeObjectPermissionLevel(
      {
        permissionId: updatedPermission!.id,
        permissionLevel: PermissionLevel.READ,
        answerCollectionId: AC1.id,
      },
      userTwoCtx
    )
    expect(success2).toBeTruthy()

    // verify that the permission has been updated in the database
    const updatedPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFour.id,
        },
      },
    })
    expect(updatedPermission2).toBeTruthy()
    expect(updatedPermission2!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it('Verify that direct permissions to an answer collection can be revoked, but might be replaced with derived permissions', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

    const permission1 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        answerCollection: {
          connect: {
            id: AC1.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by owner
    const deletedPermissionId1 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission1.id,
        collectionId: AC1.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId1).toBe(permission1.id)

    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission1).toBeNull()

    // create a new direct WRITE permission for user 5 on AC1
    const permission2 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollection: {
          connect: {
            id: AC1.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by admin
    const deletedPermissionId2 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission2.id,
        collectionId: AC1.id,
      },
      userTwoCtx
    )
    expect(deletedPermissionId2).toBe(permission2.id)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // create a new direct ADMIN permission for user 5 on AC1
    const permission3 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: AC1.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // create a question with the answer collection
    const selectionQuestion = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Question with answer collection',
        content: 'Question with answer collection',
        options: {},
        answerCollection: {
          connect: {
            id: AC1.id,
          },
        },
        owner: {
          connect: {
            id: userFive.id,
          },
        },
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: selectionQuestion.id,
        userId: userFive.id,
      },
      prisma
    )

    // verify that a dervied permission entry has been created based on the direct permission
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission!.directPermissionId).toBe(permission3.id)
    expect(derivedPermission!.derived).toBe(false)

    // verify that the permission can be revoked by an owner / admin, but will be replaced with a derived READ permission
    const removalSuccess1 = await revokeAnswerCollectionAccess(
      {
        permissionId: permission3.id,
        collectionId: AC1.id,
      },
      userTwoCtx
    )
    expect(removalSuccess1).toBeTruthy()

    // direct permission has been removed
    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    // a new derived permission has been created
    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission2).toBeTruthy()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission2!.derived).toBe(true)

    // grant direct access again to user 5
    const permission4 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: AC1.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC1.id,
        userId: userFive.id,
      },
      prisma
    )

    // verify that permission has been created correctly and a corresponding derived permission has been added
    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission4).toBeTruthy()
    expect(dbPermission4!.id).toBe(permission4.id)
    expect(dbPermission4!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission3).toBeTruthy()
    expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission3!.derived).toBe(false)

    // delete the question and verify that user 5 can revoke own access using admin permissions
    await prisma.element.delete({
      where: {
        id: selectionQuestion.id,
      },
    })

    const permissionSelfRemoval = await revokeAnswerCollectionAccess(
      {
        permissionId: permission4.id,
        collectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(permissionSelfRemoval).toBe(permission4.id)

    // verify that both the direct permission and the derived permission have been removed
    const dbPermission5 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission5).toBeNull()

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission4).toBeNull()
  })

  it('Verify that an answer collection OWNER can transfer the corresponding rights', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

    // verify that the function fails if the specified user does not exist
    const failure5 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1.id,
        shortnameOrEmail: 'missing_user_name',
      },
      userOneCtx
    )
    expect(failure5).toBeNull()

    // transfer ownership from user 1 to user 2, verify that direct ADMIN permissions are awarded to user 1,
    // direct permissions for user 2 are removed (only derived owner access persists)
    const dbPermissionUserTwoOld = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermissionUserTwoOld).toBeTruthy()
    expect(dbPermissionUserTwoOld!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const successPermission1 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1.id,
        shortnameOrEmail: userTwo.email,
      },
      userOneCtx
    )
    expect(successPermission1).toBeTruthy()
    expect(successPermission1!.userId).toBe(userOne.id)
    expect(successPermission1!.username).toBe(userOne.shortname)
    expect(successPermission1!.userEmail).toBe(userOne.email)
    expect(successPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(successPermission1!.isOwn).toBe(true)

    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission1).toBeTruthy()
    expect(dbPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // transfer ownership back to user 1 and verify permission modifications
    const successfulPermission2 = await transferAnswerCollectionOwnership(
      {
        collectionId: AC1.id,
        shortnameOrEmail: userOne.email,
      },
      userTwoCtx
    )
    expect(successfulPermission2).toBeTruthy()
    expect(successfulPermission2!.userId).toBe(userTwo.id)
    expect(successfulPermission2!.username).toBe(userTwo.shortname)
    expect(successfulPermission2!.userEmail).toBe(userTwo.email)
    expect(successfulPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(successfulPermission2!.isOwn).toBe(true)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission3).toBeTruthy()
    expect(dbPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission4).toBeNull()
  })

  it('Verify that an answer collection can be deleted', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)

    // create two new answer collections
    const name1 = `${answerCollection1.name} (New)`
    const name2 = `${answerCollection2.name} (New)`

    for (const collection of [
      { ...answerCollection1, name: name1 },
      { ...answerCollection2, name: name2 },
    ]) {
      const newCollection = await prisma.answerCollection.upsert({
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
          permissions: {
            deleteMany: {},
          },
          directPermissions: {
            deleteMany: {},
          },
        },
        include: {
          entries: true,
        },
      })

      await recomputeDerivedPermissions(
        {
          answerCollectionId: newCollection.id,
        },
        prisma
      )
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

    // seed direct ADMIN permissions for user 2
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: newAC1Id,
          },
        },
        user: {
          connect: {
            id: userTwo.id,
          },
        },
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: newAC2Id,
          },
        },
        user: {
          connect: {
            id: userTwo.id,
          },
        },
      },
    })

    await recomputeDerivedPermissions(
      {
        answerCollectionId: newAC1Id,
        userId: userTwo.id,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      {
        answerCollectionId: newAC2Id,
        userId: userTwo.id,
      },
      prisma
    )

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

    // make sure that all direct permissions have been automatically been revoked (since unused)
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: newAC1Id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission1).toBeNull()

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: newAC2Id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()
  })

  it('Share the catalog collection directly with users 2, 3, and 4 with READ, WRITE, ADMIN permissions, respectively', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)

    for (const { user, permissionLevel } of [
      { user: userTwo, permissionLevel: PermissionLevel.READ },
      { user: userThree, permissionLevel: PermissionLevel.WRITE },
      { user: userFour, permissionLevel: PermissionLevel.ADMIN },
    ]) {
      const newPermission = await shareCatalogCollection(
        {
          catalogCollectionId: publicCatalog.id,
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
      expect(newPermission!.isOwn).toBe(false)

      const dbPermission = await prisma.permission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: publicCatalog.id,
            userId: user.id,
          },
        },
      })
      expect(dbPermission).toBeTruthy()
      expect(dbPermission!.permissionLevel).toBe(permissionLevel)
      expect(dbPermission!.catalogCollectionId).toBe(publicCatalog.id)
      expect(dbPermission!.userId).toBe(user.id)

      const newPermission2 = await shareCatalogCollection(
        {
          catalogCollectionId: restrictedCatalog.id,
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
      expect(newPermission2!.isOwn).toBe(false)

      const dbPermission2 = await prisma.permission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: restrictedCatalog.id,
            userId: user.id,
          },
        },
      })
      expect(dbPermission2).toBeTruthy()
      expect(dbPermission2!.permissionLevel).toBe(permissionLevel)
      expect(dbPermission2!.catalogCollectionId).toBe(restrictedCatalog.id)
      expect(dbPermission2!.userId).toBe(user.id)
    }
  })

  it('Verify that users with direct access can see all collections, other users can only see restricted catalog collection (empty public ones are hidden)', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

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

  it('Test that answer collections can be added as objects to the catalog', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // assign the two answer collections to both the public and restricted catalog collections
    for (const { catalogId, collectionId, access } of [
      {
        catalogId: publicCatalog.id,
        collectionId: AC1.id,
        access: ObjectAccess.PUBLIC,
      },
      {
        catalogId: publicCatalog.id,
        collectionId: AC2.id,
        access: ObjectAccess.RESTRICTED,
      },
      {
        catalogId: restrictedCatalog.id,
        collectionId: AC1.id,
        access: ObjectAccess.PUBLIC,
      },
      {
        catalogId: restrictedCatalog.id,
        collectionId: AC2.id,
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

      const dbAssignment = await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: collectionId,
            catalogCollectionId: catalogId,
          },
        },
      })
      expect(dbAssignment).toBeTruthy()
      expect(dbAssignment!.access).toBe(access)
      expect(dbAssignment!.catalogCollectionId).toBe(catalogId)
      expect(dbAssignment!.answerCollectionId).toBe(collectionId)
    }

    // verify that a total number of 6 catalog object assignments are stored in the database now
    const dbAssignments2 = await prisma.catalogCollectionAssignment.count({
      where: {
        answerCollectionId: {
          in: [AC1.id, AC2.id],
        },
      },
    })
    expect(dbAssignments2).toBe(4)
  })

  it('Verify that the object access level of objects in a catalog collection can be modified', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )
    await seedAnswerCollectionCatalogAssignments(
      prisma,
      AC1.id,
      AC2.id,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // verify that object access permissions on top catalog collection are determined by object access (users 1 and 2 have sufficient permissions)
    const topAssignmentAC1 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(topAssignmentAC1).toBeTruthy()
    expect(topAssignmentAC1!.access).toBe(ObjectAccess.PUBLIC)

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
            answerCollectionId: AC1.id,
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
            answerCollectionId: AC1.id,
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
            answerCollectionId: AC1.id,
            catalogCollectionId: publicCatalog.id,
          },
        },
      })
    expect(catalogAssignment).toBeTruthy()
    expect(catalogAssignment!.access).toBe(ObjectAccess.PUBLIC)

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
            answerCollectionId: AC1.id,
            catalogCollectionId: publicCatalog.id,
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
            answerCollectionId: AC1.id,
            catalogCollectionId: publicCatalog.id,
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
            answerCollectionId: AC1.id,
            catalogCollectionId: publicCatalog.id,
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

  it('Test the modification of a catalog collection name through users with sufficient permissions', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    const newName = `${catalogCollection1.name} (New)`
    const newName2 = `${catalogCollection2.name} (New)`

    // modify the name of the catalog collection through users 1, 3, and 4
    const success1 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalog.id,
        name: newName,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    const dbCatalog2 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalog.id,
      },
    })
    expect(dbCatalog2).toBeTruthy()
    expect(dbCatalog2!.name).toBe(newName)

    const success2 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalog.id,
        name: newName2,
      },
      userThreeCtx
    )
    expect(success2).toBeTruthy()

    const dbCatalog3 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalog.id,
      },
    })
    expect(dbCatalog3).toBeTruthy()
    expect(dbCatalog3!.name).toBe(newName2)

    const success3 = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalog.id,
        name: catalogCollection1.name,
      },
      userFourCtx
    )
    expect(success3).toBeTruthy()

    const dbCatalog4 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalog.id,
      },
    })
    expect(dbCatalog4).toBeTruthy()
    expect(dbCatalog4!.name).toBe(catalogCollection1.name)
  })

  it('Verify that user 5 can request access and import public answer collections in public catalog (incl. clean up)', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )
    await seedAnswerCollectionCatalogAssignments(
      prisma,
      AC1.id,
      AC2.id,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // verify that requesting / importing answer collections through the restricted catalog collection does not work
    const failure1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalog.id,
        answerCollectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await importAnswerCollection(
      {
        catalogCollectionId: restrictedCatalog.id,
        collectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(failure2).toBeFalsy()

    const pendingAccessRequest1 = await prisma.accessRequest.count({
      where: { userId: userFive.id },
    })
    expect(pendingAccessRequest1).toBe(0)
    const importedACs = await prisma.answerCollection.count({
      where: { ownerId: userFive.id },
    })
    expect(importedACs).toBe(0)

    // request access to public and restricted AC
    const success1 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const success2 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC2.id,
      },
      userFiveCtx
    )
    expect(success2).toBeTruthy()

    const pendingAccessRequest2 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(pendingAccessRequest2.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER
    expect(
      pendingAccessRequest2.map((permission) => permission.answerCollectionId)
    ).toEqual(expect.arrayContaining([AC1.id, AC1.id]))

    // import public AC and verify that importing restricted AC does not work
    const failure3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC2.id, // restricted answer collection
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const success3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC1.id, // public answer collection
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const importedACs2 = await prisma.answerCollection.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedACs2.length).toBe(1)
    expect(importedACs2[0]!.originalId).toBe(AC1.id)
    expect(importedACs2[0]!.name).toBe(answerCollection1.name)

    // verify that duplicate requests are not accepted, duplicate imports are not a problem
    const failure4 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const accessRequests3 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(accessRequests3.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER

    const success4 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC1.id,
      },
      userFiveCtx
    )
    expect(success4).toBeTruthy()

    const importedACs3 = await prisma.answerCollection.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedACs3.length).toBe(2)
    expect(importedACs3[0]!.originalId).toBe(AC1.id)
    expect(importedACs3[0]!.name).toContain(answerCollection1.name)
    expect(importedACs3[1]!.originalId).toBe(AC1.id)
    expect(importedACs3[1]!.name).toContain(answerCollection1.name)

    // delete the imported answer collections (2) and the two pending permission requests
    await prisma.answerCollection.deleteMany({
      where: { ownerId: userFive.id },
    })
    await prisma.accessRequest.deleteMany({ where: { userId: userFive.id } })
  })

  it('Request and approve / deny requests to restricted catalog collection', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // request access to the restricted catalog collection for user 5
    const success1 = await requestCatalogCollection(
      {
        catalogCollectionId: restrictedCatalog.id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const pendingAccessRequest1 = await prisma.accessRequest.findFirst({
      where: {
        catalogCollectionId: restrictedCatalog.id,
        userId: userFive.id,
      },
    })
    expect(pendingAccessRequest1).toBeTruthy()
    expect(pendingAccessRequest1!.permissionLevel).toBe(PermissionLevel.READ)

    // deny the access request (only owner is allowed for this operation)
    const failure1 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
        propagation: false,
      },
      userTwoCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
        propagation: false,
      },
      userThreeCtx
    )
    expect(failure2).toBeFalsy()

    const failure3 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
        propagation: false,
      },
      userFourCtx
    )
    expect(failure3).toBeFalsy()

    const failure4 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest1!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: false,
        propagation: false,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const pendingAccessRequest2 = await prisma.accessRequest.findFirst({
      where: {
        catalogCollectionId: restrictedCatalog.id,
        userId: userFive.id,
      },
    })
    expect(pendingAccessRequest2).toBeTruthy()
    expect(pendingAccessRequest2!.permissionLevel).toBe(PermissionLevel.READ)

    const success2 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest2!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ, // dummy value
        approved: false,
        propagation: false, // dummy value
      },
      userOneCtx
    )
    expect(success2).toBeTruthy()

    const deniedPermission = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
    })
    expect(deniedPermission).toBeNull()

    // request access to the restricted catalog collection for user 5 again
    const success3 = await requestCatalogCollection(
      { catalogCollectionId: restrictedCatalog.id },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const pendingAccessRequest3 = await prisma.accessRequest.findFirst({
      where: {
        catalogCollectionId: restrictedCatalog.id,
        userId: userFive.id,
      },
    })
    expect(pendingAccessRequest3).toBeTruthy()
    expect(pendingAccessRequest3!.permissionLevel).toBe(PermissionLevel.READ)

    // approve the access request
    const success4 = await resolveObjectSharingRequest(
      {
        requestId: pendingAccessRequest3!.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.READ,
        approved: true,
        propagation: false,
      },
      userOneCtx
    )
    expect(success4).toBeTruthy()

    const approvedAccessRequest = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
    })
    expect(approvedAccessRequest).toBeTruthy()
    expect(approvedAccessRequest!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it('After being granted access, verify that user 5 can now request / import answer collections from restricted catalog collection (incl. clean up)', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await createAnswerCollections(prisma)
    await seedAnswerCollectionPermissions(prisma, AC1.id, AC2.id)
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )
    await seedAnswerCollectionCatalogAssignments(
      prisma,
      AC1.id,
      AC2.id,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // seed required permission for user 5
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        catalogCollectionId: restrictedCatalog.id,
        userId: userFive.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id, userId: userFive.id },
      prisma
    )

    // request access to restricted answer collection
    const success1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalog.id,
        answerCollectionId: AC2.id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const pendingAccessRequest = await prisma.accessRequest.findFirst({
      where: {
        answerCollectionId: AC2.id,
        userId: userFive.id,
      },
    })
    expect(pendingAccessRequest).toBeTruthy()
    expect(pendingAccessRequest!.permissionLevel).toBe(PermissionLevel.READ)

    // import public answer collection
    const success2 = await importAnswerCollection(
      {
        catalogCollectionId: restrictedCatalog.id,
        collectionId: AC1.id,
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
    expect(importedACs[0]!.originalId).toBe(AC1.id)
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
    await prisma.accessRequest.delete({
      where: { id: pendingAccessRequest!.id },
    })
  })

  it("Verify that users with ADMIN permissions on catalog collection can change other user's permissions", async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    const permissionUser2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionUser2).toBeTruthy()
    expect(permissionUser2!.permissionLevel).toBe(PermissionLevel.READ)

    // change the permission level through catalog collection owner and verify the change
    const success1 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: restrictedCatalog.id,
      },
      userOneCtx
    )
    expect(success1).toBeTruthy()

    const permissionVerification2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionVerification2).toBeTruthy()
    expect(permissionVerification2!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // change the permission level back to READ through ADMIN user and verify the change
    const success2 = await changeCatalogCollectionPermissionLevel(
      {
        permissionId: permissionUser2!.id,
        permissionLevel: PermissionLevel.READ,
        catalogCollectionId: restrictedCatalog.id,
      },
      userOneCtx
    )
    expect(success2).toBeTruthy()

    const permissionVerification3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionVerification3).toBeTruthy()
    expect(permissionVerification3!.permissionLevel).toBe(PermissionLevel.READ)
  })

  it('Verify that users with ADMIN permissions on catalog collection can revoke access', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // grant direct READ permission to restricted catalog collection for user 5
    const permission1 = await prisma.permission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        catalogCollection: {
          connect: {
            id: restrictedCatalog.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })
    expect(permission1).toBeTruthy()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that the permission has not been revoked
    const permissionVerification1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification1).toBeTruthy()
    expect(permissionVerification1!.permissionLevel).toBe(PermissionLevel.READ)

    // revoke permission with owner permissions on restricted catalog collection
    const revokedPermissionId1 = await revokeCatalogCollectionAccess(
      {
        permissionId: permission1.id,
        catalogCollectionId: restrictedCatalog.id,
      },
      userOneCtx
    )
    expect(revokedPermissionId1).toBe(permission1.id)

    const permissionVerification2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification2).toBeNull()

    // re-grant direct WRITE permission to restricted catalog collection for user 5
    const permission2 = await prisma.permission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollection: {
          connect: {
            id: restrictedCatalog.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
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
        catalogCollectionId: restrictedCatalog.id,
      },
      userFourCtx
    )
    expect(revokedPermissionId2).toBe(permission2.id)

    const permissionVerification3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFive.id,
        },
      },
    })
    expect(permissionVerification3).toBeNull()
  })

  it('Verify that a catalog collection OWNER can transfer the corresponding rights', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // transfer ownership rights of restricted catalog collection to other admin (user 4) and validate creation of own admin permission
    const dbPermission = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission).toBeTruthy()
    expect(dbPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const newPermission1 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalog.id,
        shortnameOrEmail: userFour.email,
      },
      userOneCtx
    )
    expect(newPermission1).toBeTruthy()
    expect(newPermission1!.userId).toBe(userOne.id)
    expect(newPermission1!.username).toBe(userOne.shortname)
    expect(newPermission1!.userEmail).toBe(userOne.email)
    expect(newPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(newPermission1!.isOwn).toBe(true)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    const updatedCatalogCollection = await prisma.catalogCollection.findUnique({
      where: {
        id: restrictedCatalog.id,
      },
    })
    expect(updatedCatalogCollection).toBeTruthy()
    expect(updatedCatalogCollection!.ownerId).toBe(userFour.id)

    // transfer ownership rights back to original owner (user 1) and validate that the admin permission has been removed
    const newPermission2 = await transferCatalogCollectionOwnership(
      {
        catalogCollectionId: restrictedCatalog.id,
        shortnameOrEmail: userOne.shortname,
      },
      userFourCtx
    )
    expect(newPermission2).toBeTruthy()
    expect(newPermission2!.userId).toBe(userFour.id)
    expect(newPermission2!.username).toBe(userFour.shortname)
    expect(newPermission2!.userEmail).toBe(userFour.email)
    expect(newPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(newPermission2!.isOwn).toBe(true)

    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission4).toBeTruthy()
    expect(dbPermission4!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission5 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission5).toBeNull()
  })

  it('Validate that access to activity templates is correctly checked', async () => {
    // create activity templates for testing
    const { LQ1Id, LQ2Id, LQ3Id, templateId1, templateId2, templateId3 } =
      await createLiveQuizTemplates(prisma)

    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // verify that the creation was successful
    const templates = await prisma.liveQuiz.findMany({
      where: {
        status: PublicationStatus.TEMPLATE,
      },
    })
    expect(templates.length).toBe(3)
    expect(templates.map((template) => template.id)).toEqual(
      expect.arrayContaining([LQ1Id, LQ2Id, LQ3Id])
    )

    // add LQ1 to top level catlaog collection with public access -> should be accessible to everyone
    const assignment1 = await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: LQ1Id,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: LQ1Id,
          },
        },
        catalogCollection: {
          connect: {
            id: publicCatalog.id,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessible for everyone
    const { accessible: res1 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    const { accessible: res2 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userTwoCtx
    )
    expect(res2).toBeTruthy()
    const { accessible: res3 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userThreeCtx
    )
    expect(res3).toBeTruthy()
    const { accessible: res4 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userFourCtx
    )
    expect(res4).toBeTruthy()
    const { accessible: res5 } = await validateTemplateAccessible(
      { templateId: templateId1 },
      userFiveCtx
    )
    expect(res5).toBeTruthy()

    // add LQ2 to public catalog collection with public access rights -> should be accessible to everyone
    const assignment2 = await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: LQ2Id,
          catalogCollectionId: publicCatalog.id,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: LQ2Id,
          },
        },
        catalogCollection: {
          connect: {
            id: publicCatalog.id,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessible for everyone
    const { accessible: res6 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    const { accessible: res7 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userTwoCtx
    )
    expect(res7).toBeTruthy()
    const { accessible: res8 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userThreeCtx
    )
    expect(res8).toBeTruthy()
    const { accessible: res9 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userFourCtx
    )
    expect(res9).toBeTruthy()
    const { accessible: res10 } = await validateTemplateAccessible(
      { templateId: templateId2 },
      userFiveCtx
    )
    expect(res10).toBeTruthy()

    // add LQ3 to restricted catalog collection with public access rights -> should be accessible to users with access to the restricted catalog collection
    const assignment3 = await prisma.catalogCollectionAssignment.upsert({
      where: {
        liveQuizId_catalogCollectionId: {
          liveQuizId: LQ3Id,
          catalogCollectionId: restrictedCatalog.id,
        },
      },
      create: {
        access: ObjectAccess.PUBLIC,
        liveQuiz: {
          connect: {
            id: LQ3Id,
          },
        },
        catalogCollection: {
          connect: {
            id: restrictedCatalog.id,
          },
        },
      },
      update: {
        access: ObjectAccess.PUBLIC,
      },
    })

    // check accessilbe only to users with access to restricted catalog collection
    const { accessible: res11 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userOneCtx
    )
    expect(res11).toBeTruthy() // owner of restricted catalog collection
    const { accessible: res12 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userTwoCtx
    )
    expect(res12).toBeTruthy() // read permissions on restricted catalog collection
    const { accessible: res13 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userThreeCtx
    )
    expect(res13).toBeTruthy() // write permissions on restricted catalog collection
    const { accessible: res14 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userFourCtx
    )
    expect(res14).toBeTruthy() // admin permissions on restricted catalog collection
    const { accessible: res15 } = await validateTemplateAccessible(
      { templateId: templateId3 },
      userFiveCtx
    )
    expect(res15).toBeFalsy() // no permissions on restricted catalog collection
  })

  it('Verify that users with sufficient permissions can delete the created activity templates', async () => {
    // create activity templates for testing
    const { LQ1Id, LQ2Id, LQ3Id } = await createLiveQuizTemplates(prisma)

    // delete activity templates with owner / admin permissions
    const res5 = await deleteActivityTemplate(
      {
        activityId: LQ1Id,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()
    const res6 = await deleteActivityTemplate(
      {
        activityId: LQ2Id,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()
    const res7 = await deleteActivityTemplate(
      {
        activityId: LQ3Id,
        activityType: ActivityType.LIVE_QUIZ,
      },
      userOneCtx
    )
    expect(res7).toBeTruthy()

    // verify that the activity templates have been removed from the database
    const liveQuizTemplates = await prisma.liveQuiz.findMany({
      where: {
        status: PublicationStatus.TEMPLATE,
      },
    })
    expect(liveQuizTemplates.length).toBe(0)
  })

  it('Verify that users with ADMIN or OWNER permissions can delete a catalog collection', async () => {
    // create catalog collections for testing
    const { publicCatalog, restrictedCatalog } =
      await createCatalogCollections(prisma)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // delete the public catalog collection through user 1 with owner permissions
    const deletedCollectionId4 = await deleteCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    expect(deletedCollectionId4).toBeTruthy()
    expect(deletedCollectionId4).toBe(publicCatalog.id)

    const dbCatalog1 = await prisma.catalogCollection.findUnique({
      where: {
        id: publicCatalog.id,
      },
    })
    expect(dbCatalog1).toBeNull()

    // delete the restricted catalog collection through user 4 with admin permissions
    const deletedCollectionId5 = await deleteCatalogCollection(
      {
        catalogCollectionId: restrictedCatalog.id,
      },
      userFourCtx
    )
    expect(deletedCollectionId5).toBeTruthy()
    expect(deletedCollectionId5).toBe(restrictedCatalog.id)

    const dbCatalog2 = await prisma.catalogCollection.findUnique({
      where: {
        id: restrictedCatalog.id,
      },
    })
    expect(dbCatalog2).toBeNull()
  })

  // TODO: make sure to extend tests once element and activity sharing is available with modifications and impact on derived permissions when executing the following actions
  // - switch of answer collection linked to an element - derived access to previous collection should be removed, access to new one automatically added
  // - switch of an element in an activity - if ADMIN permissions on activity (propagation required), derived admin access should be modified
  // - element instance updates of templates that cause a modification of the answer collection --> corresponding derived permissions for users with shared access to template need to be updated
  // - validate that when changing the course assignment of some activity, that the corresponding permissions of users on the course are adapted accordingly
})
