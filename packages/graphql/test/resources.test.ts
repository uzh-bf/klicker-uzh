import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AuditLogType,
  ElementType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import { refreshElementImportFingerprint } from '../src/services/importExportFingerprints.js'
import {
  addAnswerCollectionOption,
  createAnswerCollection,
  deleteAnswerCollection,
  deleteAnswerCollectionEntry,
  duplicateAnswerCollection,
  editAnswerCollectionEntry,
  getAnswerCollectionsElements,
  getAnswerCollectionsInfo,
  getSingleAnswerCollection,
  modifyAnswerCollection,
  removeAnswerCollection,
} from '../src/services/resources.js'
import {
  initializePrisma,
  seedAnswerCollectionPermissions,
  seedAnswerCollections,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { answerCollection1, answerCollection2 } from './testData.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for resource management (e.g. answer collections)', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
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
    } = await testInitialization(prisma, hatchet, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
  })

  afterEach(async () => await testCleanup(prisma))

  // ! Answer Collection Management
  // #region
  it('Test the creation of an answer collection and validate created derived permissions', async () => {
    const AC = await createAnswerCollection(
      {
        name: answerCollection1.name,
        description: answerCollection1.description,
        answers: answerCollection1.entries,
      },
      userOneCtx
    )
    expect(AC).toBeTruthy()
    expect(AC!.name).toBe(answerCollection1.name)
    expect(AC!.description).toBe(answerCollection1.description)
    expect(AC!.numOfEntries).toBe(answerCollection1.entries.length)
    expect(AC!.numSharedUsers).toBe(0)
    expect(AC!.isOwner).toBeTruthy()
    expect(AC!.isManager).toBeTruthy()
    expect(AC!.isEditor).toBeTruthy()
    expect(AC!.isImported).toBeFalsy()
    expect(AC!.isShared).toBeFalsy()
    expect(AC!.isDeletable).toBeTruthy()
    expect(AC!.isRemovable).toBeFalsy()

    // test that the answer collection has been correctly created in the database
    const dbAC = await prisma.answerCollection.findUnique({
      where: {
        id: AC!.id,
      },
      include: {
        entries: true,
      },
    })
    expect(dbAC).toBeTruthy()
    expect(dbAC!.name).toBe(answerCollection1.name)
    expect(dbAC!.description).toBe(answerCollection1.description)
    expect(dbAC!.entries.length).toBe(answerCollection1.entries.length)
    expect(dbAC).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })

    for (const answer of answerCollection1.entries) {
      const dbAnswer = dbAC!.entries.find((entry) => entry.value === answer)
      expect(dbAnswer).toBeTruthy()
    }

    // test that a derived permission has been added for the owner
    const derivedPermission = await prisma.derivedPermission.findFirst({
      where: {
        answerCollectionId: AC!.id,
        userId: userOne.id,
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission!.directPermissionId).toBeNull()
    expect(derivedPermission!.derived).toBeFalsy()
  })

  it('Verify that all users with at least READ permissions on an answer collection can duplicate it', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)

    // duplicate the answer collection as user 1 (owner)
    const res1 = await duplicateAnswerCollection({ id: AC1!.id }, userOneCtx)
    expect(res1).toBeTruthy()
    expect(res1!.ownerId).toBe(userOne.id)

    // duplicate the answer collection as user 2 (admin)
    const res2 = await duplicateAnswerCollection({ id: AC1!.id }, userTwoCtx)
    expect(res2).toBeTruthy()
    expect(res2!.ownerId).toBe(userTwo.id)

    // duplicate the answer collection as user 3 (editor)
    const res3 = await duplicateAnswerCollection({ id: AC1!.id }, userThreeCtx)
    expect(res3).toBeTruthy()
    expect(res3!.ownerId).toBe(userThree.id)

    // duplicate the answer collection as user 4 (reader)
    const res4 = await duplicateAnswerCollection({ id: AC1!.id }, userFourCtx)
    expect(res4).toBeTruthy()
    expect(res4!.ownerId).toBe(userFour.id)

    // verify that the duplication has been correctly performed for all users
    const duplicatedCollections = await prisma.answerCollection.findMany({
      where: {
        name: `${AC1!.name} (Copy)`,
      },
      include: {
        entries: true,
      },
    })
    expect(duplicatedCollections).toHaveLength(4)

    for (const collection of duplicatedCollections) {
      expect(collection.name).toBe(`${answerCollection1.name} (Copy)`)
      expect(collection.description).toBe(answerCollection1.description)
      expect(collection.entries.length).toBe(answerCollection1.entries.length)
      expect(collection).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    }
  })

  it('Verify that all users with access to the answer collection can use the query to include it in elements', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)

    // check availability of answer collection during element creation
    for (const ctx of [userOneCtx, userTwoCtx, userThreeCtx, userFourCtx]) {
      const queriedCollections = await getAnswerCollectionsElements(
        { templateId: undefined },
        ctx
      )
      expect(queriedCollections).toHaveLength(2)
      expect(queriedCollections.map((collection) => collection.name)).toEqual(
        expect.arrayContaining([answerCollection1.name, answerCollection2.name])
      )
    }
  })

  it('Verify that all users with access to the answer collection can query its content', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)

    // check availability of answer collection during element creation
    const collection1 = await getSingleAnswerCollection(
      { id: AC1!.id },
      userOneCtx
    )
    expect(collection1).toBeTruthy()
    expect(collection1!.name).toBe(answerCollection1.name)
    expect(collection1!.description).toBe(answerCollection1.description)
    expect(collection1!.entries).toHaveLength(answerCollection1.entries.length)
    expect(collection1!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(collection1!.numSharedUsers).toBe(3)
    expect(collection1!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(collection1!.isOwner).toBeTruthy()
    expect(collection1!.isManager).toBeTruthy()
    expect(collection1!.isEditor).toBeTruthy()
    expect(collection1!.isShared).toBeFalsy()

    const collection2 = await getSingleAnswerCollection(
      { id: AC1!.id },
      userTwoCtx
    )
    expect(collection2).toBeTruthy()
    expect(collection2!.name).toBe(answerCollection1.name)
    expect(collection2!.description).toBe(answerCollection1.description)
    expect(collection2!.entries).toHaveLength(answerCollection1.entries.length)
    expect(collection2!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(collection2!.numSharedUsers).toBe(3)
    expect(collection2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(collection2!.isOwner).toBeFalsy()
    expect(collection2!.isManager).toBeTruthy()
    expect(collection2!.isEditor).toBeTruthy()
    expect(collection2!.isShared).toBeTruthy()

    const collection3 = await getSingleAnswerCollection(
      { id: AC1!.id },
      userThreeCtx
    )
    expect(collection3).toBeTruthy()
    expect(collection3!.name).toBe(answerCollection1.name)
    expect(collection3!.description).toBe(answerCollection1.description)
    expect(collection3!.entries).toHaveLength(answerCollection1.entries.length)
    expect(collection3!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(collection3!.numSharedUsers).toBeUndefined()
    expect(collection3!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(collection3!.isOwner).toBeFalsy()
    expect(collection3!.isManager).toBeFalsy()
    expect(collection3!.isEditor).toBeTruthy()
    expect(collection3!.isShared).toBeTruthy()

    const collection4 = await getSingleAnswerCollection(
      { id: AC1!.id },
      userFourCtx
    )
    expect(collection4).toBeTruthy()
    expect(collection4!.name).toBe(answerCollection1.name)
    expect(collection4!.description).toBe(answerCollection1.description)
    expect(collection4!.entries).toHaveLength(answerCollection1.entries.length)
    expect(collection4!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(answerCollection1.entries)
    )
    expect(collection4!.numSharedUsers).toBeUndefined()
    expect(collection4!.permissionLevel).toBe(PermissionLevel.READ)
    expect(collection4!.isOwner).toBeFalsy()
    expect(collection4!.isManager).toBeFalsy()
    expect(collection4!.isEditor).toBeFalsy()
    expect(collection4!.isShared).toBeTruthy()
  })

  it('Verify that answer collection info is correctly loaded (including potential links to elements and templates impacting removability)', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)

    // seed an element, owned by user 1 and shared with user 3
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: AC1!.id,
        directPermissions: {
          create: [
            {
              permissionLevel: PermissionLevel.WRITE,
              userId: userThree.id,
            },
            {
              permissionLevel: PermissionLevel.WRITE,
              userId: userFive.id,
            },
          ],
        },
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // seed a template, owned by user 1 and shared with user 4
    const activityId = '066eb3c2-b6dd-4f9a-92d0-3da45224cfc6'
    await prisma.activityTemplate.create({
      data: {
        description: 'Description',
        instructions: 'Instructions',
        answerCollections: {
          connect: {
            id: AC1!.id,
          },
        },
        liveQuiz: {
          create: {
            id: activityId,
            name: 'Live Quiz',
            displayName: 'Live Quiz Display Name',
            ownerId: userOne.id,
            directPermissions: {
              create: {
                permissionLevel: PermissionLevel.READ,
                userId: userFour.id,
              },
            },
          },
        },
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId }, prisma)

    // verify the correctness of the query results for the answer collection info
    // user 1: direct access (OWNER permissions) and object use through element and template
    const collections1 = await getAnswerCollectionsInfo(userOneCtx)
    expect(collections1).toHaveLength(2)
    const firstCollection1 = collections1.find(
      (collection) => collection.id === AC1!.id
    )
    expect(firstCollection1).toBeTruthy()
    expect(firstCollection1!.name).toBe(answerCollection1.name)
    expect(firstCollection1!.description).toBe(answerCollection1.description)
    expect(firstCollection1!.ownerShortname).toBe(userOne.shortname)
    expect(firstCollection1!.numOfEntries).toBe(
      answerCollection1.entries.length
    )
    expect(firstCollection1!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(firstCollection1!.isOwner).toBeTruthy()
    expect(firstCollection1!.isManager).toBeTruthy()
    expect(firstCollection1!.isEditor).toBeTruthy()
    expect(firstCollection1!.isImported).toBeFalsy()
    expect(firstCollection1!.isShared).toBeFalsy()
    expect(firstCollection1!.isRemovable).toBeFalsy() // object in use

    // user 2: direct access (ADMIN permissions) and no object use
    const collections2 = await getAnswerCollectionsInfo(userTwoCtx)
    expect(collections2).toHaveLength(2)
    const firstCollection2 = collections2.find(
      (collection) => collection.id === AC1!.id
    )
    expect(firstCollection2).toBeTruthy()
    expect(firstCollection2!.name).toBe(answerCollection1.name)
    expect(firstCollection2!.description).toBe(answerCollection1.description)
    expect(firstCollection2!.ownerShortname).toBe(userOne.shortname)
    expect(firstCollection2!.numOfEntries).toBe(
      answerCollection1.entries.length
    )
    expect(firstCollection2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(firstCollection2!.isOwner).toBeFalsy()
    expect(firstCollection2!.isManager).toBeTruthy()
    expect(firstCollection2!.isEditor).toBeTruthy()
    expect(firstCollection2!.isImported).toBeFalsy()
    expect(firstCollection2!.isShared).toBeTruthy()
    expect(firstCollection2!.isRemovable).toBeTruthy() // object not in use

    // user 3: direct access (WRITE permissions) and object use through element
    const collections3 = await getAnswerCollectionsInfo(userThreeCtx)
    expect(collections3).toHaveLength(2)
    const firstCollection3 = collections3.find(
      (collection) => collection.id === AC1!.id
    )
    expect(firstCollection3).toBeTruthy()
    expect(firstCollection3!.name).toBe(answerCollection1.name)
    expect(firstCollection3!.description).toBe(answerCollection1.description)
    expect(firstCollection3!.ownerShortname).toBe(userOne.shortname)
    expect(firstCollection3!.numOfEntries).toBe(
      answerCollection1.entries.length
    )
    expect(firstCollection3!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(firstCollection3!.isOwner).toBeFalsy()
    expect(firstCollection3!.isManager).toBeFalsy()
    expect(firstCollection3!.isEditor).toBeTruthy()
    expect(firstCollection3!.isImported).toBeFalsy()
    expect(firstCollection3!.isShared).toBeTruthy()
    expect(firstCollection3!.isRemovable).toBeFalsy() // object in use

    // user 4: direct access (READ permissions) and object use through template
    const collections4 = await getAnswerCollectionsInfo(userFourCtx)
    expect(collections4).toHaveLength(2)
    const firstCollection4 = collections4.find(
      (collection) => collection.id === AC1!.id
    )
    expect(firstCollection4).toBeTruthy()
    expect(firstCollection4!.name).toBe(answerCollection1.name)
    expect(firstCollection4!.description).toBe(answerCollection1.description)
    expect(firstCollection4!.ownerShortname).toBe(userOne.shortname)
    expect(firstCollection4!.numOfEntries).toBe(
      answerCollection1.entries.length
    )
    expect(firstCollection4!.permissionLevel).toBe(PermissionLevel.READ)
    expect(firstCollection4!.isOwner).toBeFalsy()
    expect(firstCollection4!.isManager).toBeFalsy()
    expect(firstCollection4!.isEditor).toBeFalsy()
    expect(firstCollection4!.isImported).toBeFalsy()
    expect(firstCollection4!.isShared).toBeTruthy()
    expect(firstCollection4!.isRemovable).toBeFalsy() // object in use

    // user 5: derived access (READ permissions) and object use through element
    const collections5 = await getAnswerCollectionsInfo(userFiveCtx)
    expect(collections5).toHaveLength(1)
    const firstCollection5 = collections5[0]
    expect(firstCollection5).toBeTruthy()
    expect(firstCollection5!.name).toBe(answerCollection1.name)
    expect(firstCollection5!.description).toBe(answerCollection1.description)
    expect(firstCollection5!.ownerShortname).toBe(userOne.shortname)
    expect(firstCollection5!.numOfEntries).toBe(
      answerCollection1.entries.length
    )
    expect(firstCollection5!.permissionLevel).toBe(PermissionLevel.READ)
    expect(firstCollection5!.isOwner).toBeFalsy()
    expect(firstCollection5!.isManager).toBeFalsy()
    expect(firstCollection5!.isEditor).toBeFalsy()
    expect(firstCollection5!.isImported).toBeFalsy()
    expect(firstCollection5!.isShared).toBeTruthy()
    expect(firstCollection5!.isRemovable).toBeFalsy() // object in use
  })

  it('Verify that answer collection metadata updates are executed and stored correctly', async () => {
    // create answer collections for testing
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    const updatedName = 'Updated Name'
    const updatedDescription = 'Updated Description'

    // update the answer collection
    const updatedAC = await modifyAnswerCollection(
      { id: AC1!.id, name: updatedName, description: updatedDescription },
      userOneCtx
    )
    expect(updatedAC).toBeTruthy()
    expect(updatedAC!.name).toBe(updatedName)
    expect(updatedAC!.description).toBe(updatedDescription)

    // verify that the content of the database has been updated
    const dbAC = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
    })
    expect(dbAC).toBeTruthy()
    expect(dbAC!.name).toBe(updatedName)
    expect(dbAC!.description).toBe(updatedDescription)
  })

  it('keeps linked element fingerprints stable when collection metadata changes', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const collection = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: AC1!.id },
      include: { entries: true },
    })
    const entry = collection.entries[0]!
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Linked Selection',
        content: 'Choose an option',
        options: {
          answerCollection: AC1!.id,
          correctAnswers: [entry.id],
        },
        ownerId: userOne.id,
        answerCollectionId: collection.id,
        answerCollectionItems: {
          connect: {
            id: entry.id,
          },
        },
      },
    })
    await refreshElementImportFingerprint(element.id, prisma)
    const before = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { importFingerprint: true },
    })

    await modifyAnswerCollection(
      { id: AC1!.id, name: 'Updated Linked Collection' },
      userOneCtx
    )

    const after = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { importFingerprint: true },
    })
    expect(after.importFingerprint).toBe(before.importFingerprint)
  })

  it('retains a current collection fingerprint for metadata-only changes without Hatchet', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const before = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: AC1!.id },
      select: {
        importFingerprint: true,
        importFingerprintVersion: true,
      },
    })
    const runNoWait = vi.spyOn(
      userOneCtx.tasks.refreshImportExportFingerprints,
      'runNoWait'
    )

    try {
      await modifyAnswerCollection(
        { id: AC1!.id, name: 'Metadata-only update' },
        userOneCtx
      )

      expect(runNoWait).not.toHaveBeenCalled()
      await expect(
        prisma.answerCollection.findUniqueOrThrow({
          where: { id: AC1!.id },
          select: {
            importFingerprint: true,
            importFingerprintVersion: true,
          },
        })
      ).resolves.toEqual(before)
      expect(before).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    } finally {
      runNoWait.mockRestore()
    }
  })

  it('Verify that answer collections can be deleted when unused (hard deletion case)', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // connect the first answer collection to an element
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the answer collection cannot be deleted
    const failure1 = await deleteAnswerCollection(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(failure1).toBeNull()

    // delete the element and link the answer collection to a template instead
    await prisma.element.delete({
      where: {
        id: element.id,
      },
    })
    const activityId = '15179237-5db0-47a1-8846-dabb9774f2c5'
    await prisma.activityTemplate.create({
      data: {
        description: 'Description',
        instructions: 'Instructions',
        answerCollections: {
          connect: {
            id: AC1!.id,
          },
        },
        liveQuiz: {
          create: {
            id: activityId,
            name: 'Live Quiz',
            displayName: 'Live Quiz Display Name',
            ownerId: userOne.id,
          },
        },
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId }, prisma)

    // verify that the answer collection cannot be deleted
    const failure2 = await deleteAnswerCollection(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(failure2).toBeNull()

    // delete the template and verify that the deletion of the answer collection is now successful
    await prisma.liveQuiz.delete({ where: { id: activityId } }) // template is automatically deleted through cascading
    const deletionId = await deleteAnswerCollection(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(deletionId).toBe(AC1!.id)

    // verify that the answer collection has been removed from the database (hard deletion)
    const dbAC = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
    })
    expect(dbAC).toBeNull()
  })

  it('Verify that answer collections can be deleted when unused (soft deletion case)', async () => {
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)

    // connect the first answer collection to an element of user 2
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the answer collection can be deleted by the owner
    const deletionId = await deleteAnswerCollection(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(deletionId).toBe(AC1!.id)

    // verify that the answer collection has been soft-deleted and the derived permission for the owner has been removed
    const dbAC = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
    })
    expect(dbAC).toBeTruthy()
    expect(dbAC!.isDeleted).toBeTruthy()

    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeNull()

    const remainingDerivedPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
    expect(remainingDerivedPermission).toBeTruthy()
    expect(remainingDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(remainingDerivedPermission!.derived).toBeTruthy()

    // add an element linked to the answer collection with user one as its owner
    const element2 = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element 2',
        content: 'Test Element Content 2',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: AC2!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element2.id }, prisma)

    // delete the element through another user (assumption: ADMIN)
    const deletionId2 = await deleteAnswerCollection(
      { collectionId: AC2!.id },
      userTwoCtx
    )
    expect(deletionId2).toBe(AC2!.id)

    // verify that the answer collection has been correctly marked as deleted
    const dbAC2 = await prisma.answerCollection.findUnique({
      where: {
        id: AC2!.id,
      },
    })
    expect(dbAC2).toBeTruthy()
    expect(dbAC2!.isDeleted).toBeTruthy()

    // verify that the owner retains a derived permission for the deleted answer collection
    const derivedOwnerPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC2!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedOwnerPermission2).toBeTruthy()
    expect(derivedOwnerPermission2!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedOwnerPermission2!.derived).toBeTruthy()
  })

  it('Verify that on deletion, all access requests, direct permissions and catalog collection assignments are removed', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // add an element for user 4 linked to the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userFour.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // create a direct permission for user 2
    const directACPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // check that corresponding derived permissions have been created for users 2 and 4
    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission2).toBeTruthy()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(derivedPermission2!.directPermissionId).toBe(directACPermission.id)
    expect(derivedPermission2!.derived).toBeFalsy()

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission4).toBeTruthy()
    expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission4!.directPermissionId).toBeNull() // element owner - no direct permission id
    expect(derivedPermission4!.derived).toBeTruthy()

    // create an access request to the answer collection for user 3
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        answerCollectionId: AC1!.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    // assign the answer collection to the top-level catalog collection
    await prisma.catalogCollectionAssignment.create({
      data: {
        access: ObjectAccess.PUBLIC,
        answerCollectionId: AC1!.id,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
      },
    })

    // delete the answer collection
    const deletionId = await deleteAnswerCollection(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(deletionId).toBe(AC1!.id)

    // verify that the answer collection has only been soft-deleted (since it is used by user 4)
    const dbAC = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
    })
    expect(dbAC).toBeTruthy()
    expect(dbAC!.isDeleted).toBeTruthy()

    // verify that the direct permission has been removed
    const deletedDirectPermission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(deletedDirectPermission).toBeNull()

    // the derived permission for user 2 should be removed, the one for user 4 persists
    const deletedDerivedPermission2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(deletedDerivedPermission2).toBeNull()

    const remainingDerivedPermission4 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userFour.id,
          },
        },
      })
    expect(remainingDerivedPermission4).toBeTruthy()
    expect(remainingDerivedPermission4!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(remainingDerivedPermission4!.directPermissionId).toBeNull() // element owner - no direct permission id
    expect(remainingDerivedPermission4!.derived).toBeTruthy()

    // verify that the access request has been removed
    const deletedAccessRequest = await prisma.accessRequest.findMany({
      where: { answerCollectionId: AC1!.id },
    })
    expect(deletedAccessRequest).toHaveLength(0)

    // verify that the catalog collection assignment has been deleted
    const deletedCatalogCollectionAssignment =
      await prisma.catalogCollectionAssignment.findMany({
        where: { answerCollectionId: AC1!.id },
      })
    expect(deletedCatalogCollectionAssignment).toHaveLength(0)
  })

  it('Verify that own permission can only be removed if the answer collection is unused', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // add an explicite permission for user 2 on the answer collection
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // add an element linked to the answer collection for user 2
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that a derived permission has been created for user 2
    const derivedPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionElement).toBeTruthy()
    expect(derivedPermissionElement!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionElement!.directPermissionId).not.toBeNull()
    expect(derivedPermissionElement!.derived).toBeFalsy()

    // verify that the answer collection cannot be removed from the account of user 2 (used in element)
    const failure1 = await removeAnswerCollection({ id: AC1!.id }, userTwoCtx)
    expect(failure1).toBeNull()

    // remove the element and add an activity template with the answer collection as dependency
    await prisma.element.delete({
      where: {
        id: element.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    const activityId = 'b8263085-f8ca-4d11-b0a4-73a19b827ee4'
    await prisma.activityTemplate.create({
      data: {
        description: 'Description',
        instructions: 'Instructions',
        answerCollections: {
          connect: {
            id: AC1!.id,
          },
        },
        liveQuiz: {
          create: {
            id: activityId,
            name: 'Live Quiz',
            displayName: 'Live Quiz Display Name',
            ownerId: userTwo.id,
          },
        },
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId }, prisma)

    // verify that the answer collection cannot be removed from the account of user 2 (used in template)
    const failure2 = await removeAnswerCollection({ id: AC1!.id }, userTwoCtx)
    expect(failure2).toBeNull()

    // remove the template and verify that the answer collection can now be removed
    await prisma.liveQuiz.delete({ where: { id: activityId } }) // template is automatically deleted through cascading
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)
    const removalId = await removeAnswerCollection({ id: AC1!.id }, userTwoCtx)
    expect(removalId).toBe(String(AC1!.id))

    // verify that an audit log entry has been created for the removal
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `User ${userTwo.id} removed own permission on ${ObjectType.ANSWER_COLLECTION} (ID: ${AC1!.id})`
    )

    // verify that the user has no derived access to the answer collection anymore
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission).toBeNull()

    // verify that the owner retains a derived permission on the answer collection
    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.derived).toBeFalsy()

    // verify that the owner cannot use the removal function, but only delete the answer collection
    const failure3 = await removeAnswerCollection({ id: AC1!.id }, userOneCtx)
    expect(failure3).toBeNull()
  })

  it('Test the modification of answer collection entries', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    const dbAC1 = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
      include: {
        entries: true,
      },
    })
    const entries = dbAC1!.entries

    // trigger the modification of the first element
    const newEntry = 'New Entry'
    const modifiedEntry = await editAnswerCollectionEntry(
      { id: entries[0]!.id, collectionId: AC1!.id, value: newEntry },
      userOneCtx
    )
    expect(modifiedEntry).toBeTruthy()
    expect(modifiedEntry!.id).toBe(entries[0]!.id)
    expect(modifiedEntry!.value).toBe(newEntry)

    // verify that the entry has been modified in the database
    const dbEntry = await prisma.answerCollectionEntry.findUnique({
      where: {
        id: entries[0]!.id,
      },
    })
    expect(dbEntry).toBeTruthy()
    expect(dbEntry!.value).toBe(newEntry)
    expect(dbEntry!.collectionId).toBe(AC1!.id)
  })

  it('refreshes high-fan-out fingerprints atomically without Hatchet', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const collection = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: AC1!.id },
      include: { entries: true },
    })
    await prisma.element.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        type: ElementType.SELECTION,
        name: `High fan-out ${index}`,
        content: 'Choose an option',
        options: { hasSampleSolution: false, numberOfInputs: 1 },
        ownerId: userOne.id,
        answerCollectionId: collection.id,
        importFingerprint: 'a'.repeat(64),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })),
    })

    const runNoWait = vi
      .spyOn(userOneCtx.tasks.refreshImportExportFingerprints, 'runNoWait')
      .mockRejectedValue(new Error('Hatchet unavailable'))

    try {
      const result = await editAnswerCollectionEntry(
        {
          id: collection.entries[0]!.id,
          collectionId: collection.id,
          value: 'Updated without waiting',
        },
        userOneCtx
      )

      expect(result.value).toBe('Updated without waiting')
      expect(runNoWait).not.toHaveBeenCalled()
      await expect(
        prisma.element.count({
          where: {
            answerCollectionId: collection.id,
            importFingerprint: { not: null },
            importFingerprintVersion:
              IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
          },
        })
      ).resolves.toBe(101)
      await expect(
        prisma.answerCollection.findUniqueOrThrow({
          where: { id: collection.id },
          select: {
            importFingerprint: true,
            importFingerprintVersion: true,
          },
        })
      ).resolves.toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    } finally {
      runNoWait.mockRestore()
    }
  })

  it('persists collection and linked-element fingerprints without Hatchet', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const collection = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: AC1!.id },
      include: { entries: true },
    })
    const linkedElement = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Enqueue failure linked selection',
        content: 'Choose an option',
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        ownerId: userOne.id,
        answerCollectionId: collection.id,
        answerCollectionItems: {
          connect: { id: collection.entries[0]!.id },
        },
        importFingerprint: 'a'.repeat(64),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.refreshImportExportFingerprints, 'runNoWait')
      .mockRejectedValue(new Error('Hatchet unavailable'))

    try {
      const entry = await addAnswerCollectionOption(
        { collectionId: AC1!.id, value: 'Durably current' },
        userOneCtx
      )

      expect(entry.value).toBe('Durably current')
      expect(runNoWait).not.toHaveBeenCalled()
      await expect(
        prisma.answerCollection.findUniqueOrThrow({
          where: { id: AC1!.id },
          select: {
            importFingerprint: true,
            importFingerprintVersion: true,
          },
        })
      ).resolves.toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
      await expect(
        prisma.element.findUniqueOrThrow({
          where: { id: linkedElement.id },
          select: {
            importFingerprint: true,
            importFingerprintVersion: true,
          },
        })
      ).resolves.toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
      await expect(
        prisma.element.count({
          where: {
            answerCollectionId: collection.id,
            isDeleted: false,
            OR: [
              { importFingerprint: null },
              { importFingerprintVersion: null },
              {
                importFingerprintVersion: {
                  not: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
                },
              },
            ],
          },
        })
      ).resolves.toBe(0)
    } finally {
      runNoWait.mockRestore()
    }
  })

  it('Test that the deletion of answer collection entries is possible if they are not used in an element', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    const dbAC1 = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
      include: {
        entries: true,
      },
    })
    const firstEntry = dbAC1!.entries[0]!

    // add an element that is linked to the first answer collection entry (with user 1 as the element owner)
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element',
        content: 'Test Element Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: AC1!.id,
        answerCollectionItems: {
          connect: {
            id: firstEntry.id,
          },
        },
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the answer collection entry cannot be deleted
    const failure1 = await deleteAnswerCollectionEntry(
      { id: firstEntry.id, collectionId: AC1!.id },
      userOneCtx
    )
    expect(failure1).toBeNull()

    // delete the first element, create a second element owned by user 2 and link it again to the first answer collection entry
    await prisma.element.delete({
      where: {
        id: element.id,
      },
    })
    const element2 = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Test Element 2',
        content: 'Test Element Content 2',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: AC1!.id,
        answerCollectionItems: {
          connect: {
            id: firstEntry.id,
          },
        },
      },
    })
    await recomputeDerivedPermissions({ elementId: element2.id }, prisma)

    // verify that the answer collection entry cannot be deleted
    const failure2 = await deleteAnswerCollectionEntry(
      { id: firstEntry.id, collectionId: AC1!.id },
      userOneCtx
    )
    expect(failure2).toBeNull()

    // delete the second element and verify that the answer collection entry can now be deleted
    await prisma.element.delete({
      where: {
        id: element2.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)
    const deletionId = await deleteAnswerCollectionEntry(
      { id: firstEntry.id, collectionId: AC1!.id },
      userOneCtx
    )
    expect(deletionId).toBe(firstEntry.id)

    // verify that the entry has been removed from the database
    const dbEntry = await prisma.answerCollectionEntry.findUnique({
      where: {
        id: firstEntry.id,
      },
    })
    expect(dbEntry).toBeNull()

    // verify that the answer collection has been updated
    const dbAC = await prisma.answerCollection.findUnique({
      where: { id: AC1!.id },
      include: { entries: true },
    })
    expect(dbAC).toBeTruthy()
    expect(dbAC!.entries).toHaveLength(answerCollection1.entries.length - 1)
  })

  it('Test the creation of a new answer collection entry for an existing answer collection', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    const newEntry = 'New Entry'
    const createdEntry = await addAnswerCollectionOption(
      { collectionId: AC1!.id, value: newEntry },
      userOneCtx
    )
    expect(createdEntry).toBeTruthy()
    expect(createdEntry!.value).toBe(newEntry)
    expect(createdEntry!.collectionId).toBe(AC1!.id)

    // verify that the entry has been created in the database
    const dbCollection = await prisma.answerCollection.findUnique({
      where: { id: AC1!.id },
      include: { entries: true },
    })
    expect(dbCollection).toBeTruthy()
    expect(dbCollection!.entries).toHaveLength(
      answerCollection1.entries.length + 1
    )
    expect(dbCollection!.entries.map((entry) => entry.value)).toEqual(
      expect.arrayContaining([newEntry])
    )
  })
  // #endregion
})
