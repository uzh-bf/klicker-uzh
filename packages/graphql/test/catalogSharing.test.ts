import {
  AuditLogType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma'
import { SharingObjectType } from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeCatalogCollectionName,
  changeCatalogCollectionObjectAccess,
  changeCatalogObjectAccess,
  changeObjectPermissionLevel,
  countCatalogSharingRequests,
  createCatalogCollection,
  deleteCatalogCollection,
  getCatalogCollectionInfo,
  getCatalogCollectionPermissions,
  getCatalogCollectionsList,
  getCatalogObjects,
  getCatalogSharingRequests,
  requestCatalogCollection,
  resolveObjectSharingRequest,
  revokeObjectAccess,
  shareObject,
  transferCatalogCollectionOwnership,
  validateCatalogCollectionPermissions,
  verifyCatalogCollectionBrowsable,
  verifyCatalogObjectEditPermissions,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCatalogCollections,
  seedElements,
  seedLiveQuizTemplates,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests for sharing functionalities of catalog collections', () => {
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

  // ! Catalog Collection Access Validation
  // #region
  it('Verify that the catalog collection access is correctly validated', async () => {
    // the top-level answer collection should always be accessible
    const { valid: valid1, catalogCollection: catalog1 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          minimumPermissionLevel: PermissionLevel.READ,
        },
        userTwoCtx
      )
    expect(valid1).toBe(true)
    expect(catalog1).toBeDefined()
    expect(catalog1?.id).toBe(MISSING_CATALOG_COLLECTION_ID)

    // seed public and restricted catalog collections with user 1 as the owner
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // verify that user 1 can access both the public and restricted catalog collections
    const { valid: valid2, catalogCollection: catalog2 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: publicCatalog.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        userOneCtx
      )
    expect(valid2).toBe(true)
    expect(catalog2).toBeDefined()
    expect(catalog2?.id).toBe(publicCatalog.id)

    const { valid: valid3, catalogCollection: catalog3 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: restrictedCatalog.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
        userOneCtx
      )
    expect(valid3).toBe(true)
    expect(catalog3).toBeDefined()
    expect(catalog3?.id).toBe(restrictedCatalog.id)

    // verify that the validation fails for user 2 without access to neither catalog collection
    const { valid: valid4, catalogCollection: catalog4 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: publicCatalog.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
        userTwoCtx
      )
    expect(valid4).toBe(false)

    const { valid: valid5, catalogCollection: catalog5 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: restrictedCatalog.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        userTwoCtx
      )
    expect(valid5).toBe(false)

    // create explicit permissions for users 3 and 4 on the collections
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: restrictedCatalog.id,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // verify that the validation is successful, given sufficient permissions for the queried permission level
    const { valid: valid6, catalogCollection: catalog6 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: publicCatalog.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
        userThreeCtx
      )
    expect(valid6).toBe(true)
    expect(catalog6).toBeDefined()
    expect(catalog6?.id).toBe(publicCatalog.id)

    const { valid: valid7, catalogCollection: catalog7 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: publicCatalog.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        userThreeCtx
      )
    expect(valid7).toBe(true)
    expect(catalog7).toBeDefined()
    expect(catalog7?.id).toBe(publicCatalog.id)

    const { valid: valid8, catalogCollection: catalog8 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: restrictedCatalog.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
        userFourCtx
      )
    expect(valid8).toBe(true)
    expect(catalog8).toBeDefined()
    expect(catalog8?.id).toBe(restrictedCatalog.id)

    const { valid: failed1, catalogCollection: failedCatalog1 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: publicCatalog.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
        userThreeCtx
      )
    expect(failed1).toBe(false)

    const { valid: failed2, catalogCollection: failedCatalog2 } =
      await validateCatalogCollectionPermissions(
        {
          catalogCollectionId: restrictedCatalog.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
        userFourCtx
      )
    expect(failed2).toBe(false)
  })

  it('Verify that public catalog collections are browsable and restricted collections require at least READ permissions', async () => {
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // grant WRITE access to user 2 on the public catalog collection
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // grant READ access to user 3 on the restricted catalog collection
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userThree.id,
        catalogCollectionId: restrictedCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // verify that users 1, 2, and 3 can browse the public catalog collection
    const canBrowsePublic1 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: publicCatalog.id },
      userOneCtx
    )
    expect(canBrowsePublic1).toBe(true)

    const canBrowsePublic2 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: publicCatalog.id },
      userTwoCtx
    )
    expect(canBrowsePublic2).toBe(true)

    const canBrowsePublic3 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: publicCatalog.id },
      userThreeCtx
    )
    expect(canBrowsePublic3).toBe(true)

    // verify that only users 1 and 3 can browse the restricted catalog collection
    const canBrowseRestricted1 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: restrictedCatalog.id },
      userOneCtx
    )
    expect(canBrowseRestricted1).toBe(true)

    const canBrowseRestricted2 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: restrictedCatalog.id },
      userTwoCtx
    )
    expect(canBrowseRestricted2).toBe(false)

    const canBrowseRestricted3 = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId: restrictedCatalog.id },
      userThreeCtx
    )
    expect(canBrowseRestricted3).toBe(true)
  })

  it('Verify that if an object is included in a catalog collection, the permissions on the catalog collection decide about allowed operations', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create an answer collection and add it to the public catalog collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Test Answer Collection',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })
    const assignment = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // grant ADMIN access to user 2 on the included answer collection object
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // grant READ, WRITE and ADMIN access to users 3, 4, and 5 on the public catalog collection
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.READ,
          userId: userThree.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userFour.id,
          catalogCollectionId: publicCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFive.id,
          catalogCollectionId: publicCatalog.id,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // verify that users 1, 4, and 5 have sufficient permissions on the catalog collection, to make modifications to the assignment
    const { sufficientPermissions: res1 } =
      await verifyCatalogObjectEditPermissions(
        { assignmentId: assignment.id },
        userOneCtx
      )
    expect(res1).toBe(true)

    const { sufficientPermissions: res2 } =
      await verifyCatalogObjectEditPermissions(
        { assignmentId: assignment.id },
        userTwoCtx
      )
    expect(res2).toBe(false)

    const { sufficientPermissions: res3 } =
      await verifyCatalogObjectEditPermissions(
        { assignmentId: assignment.id },
        userThreeCtx
      )
    expect(res3).toBe(false)

    const { sufficientPermissions: res4 } =
      await verifyCatalogObjectEditPermissions(
        { assignmentId: assignment.id },
        userFourCtx
      )
    expect(res4).toBe(true)

    const { sufficientPermissions: res5 } =
      await verifyCatalogObjectEditPermissions(
        { assignmentId: assignment.id },
        userFiveCtx
      )
    expect(res5).toBe(true)
  })
  // #endregion

  // ! Catalog Collection Management
  // #region
  it('Verify that the catalog collection creation function works correctly', async () => {
    const publicName = 'Test Public Catalog Collection'
    const restrictedName = 'Test Restricted Catalog Collection'

    const publicCatalog = await createCatalogCollection(
      {
        name: publicName,
        access: ObjectAccess.PUBLIC,
      },
      userOneCtx
    )
    expect(publicCatalog).toBeDefined()
    expect(publicCatalog.name).toBe(publicName)
    expect(publicCatalog.access).toBe(ObjectAccess.PUBLIC)

    const restrictedCatalog = await createCatalogCollection(
      {
        name: restrictedName,
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )
    expect(restrictedCatalog).toBeDefined()
    expect(restrictedCatalog.name).toBe(restrictedName)
    expect(restrictedCatalog.access).toBe(ObjectAccess.RESTRICTED)

    // verify that the catalog collection has been created correctly in the database
    const dbCatalog = await prisma.catalogCollection.findUnique({
      where: { id: publicCatalog.id },
    })
    expect(dbCatalog).toBeDefined()
    expect(dbCatalog?.name).toBe(publicName)
    expect(dbCatalog?.access).toBe(ObjectAccess.PUBLIC)
    expect(dbCatalog?.ownerId).toBe(userOne.id)
    const dbCatalog2 = await prisma.catalogCollection.findUnique({
      where: { id: restrictedCatalog.id },
    })
    expect(dbCatalog2).toBeDefined()
    expect(dbCatalog2?.name).toBe(restrictedName)
    expect(dbCatalog2?.access).toBe(ObjectAccess.RESTRICTED)
    expect(dbCatalog2?.ownerId).toBe(userOne.id)
  })

  it('Verify that the catalog collection info retrieval function works correctly', async () => {
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // grant READ, WRITE, and ADMIN access to users 2, 3, and 4 on the restricted catalog collection
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.READ,
          userId: userTwo.id,
          catalogCollectionId: restrictedCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          catalogCollectionId: restrictedCatalog.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userFour.id,
          catalogCollectionId: restrictedCatalog.id,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // create an access request for user 5 on the public catalog collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    // no info is given on the top-level catalog collection
    const info1 = await getCatalogCollectionInfo(
      { catalogCollectionId: MISSING_CATALOG_COLLECTION_ID },
      userOneCtx
    )
    expect(info1).toBeNull()

    const info2 = await getCatalogCollectionInfo(
      { catalogCollectionId: undefined },
      userOneCtx
    )
    expect(info2).toBeNull()

    // verify that all users can access the content of the public catalog collection
    const info3 = await getCatalogCollectionInfo(
      { catalogCollectionId: publicCatalog.id },
      userOneCtx
    )
    expect(info3).toBeDefined()
    expect(info3!.id).toBe(publicCatalog.id)
    expect(info3!.name).toBe(publicCatalog.name)
    expect(info3!.access).toBe(ObjectAccess.PUBLIC)
    expect(info3!.ownerShortname).toBe(userOne.shortname)
    expect(info3!.ownerId).toBe(userOne.id)
    expect(info3!.isOwner).toBe(true)
    expect(info3!.isManager).toBe(true)
    expect(info3!.isEditor).toBe(true)
    expect(info3!.isRequested).toBe(false)
    expect(info3!.isShared).toBe(false)

    const info4 = await getCatalogCollectionInfo(
      { catalogCollectionId: publicCatalog.id },
      userTwoCtx
    )
    expect(info4).toBeDefined()
    expect(info4!.id).toBe(publicCatalog.id)
    expect(info4!.name).toBe(publicCatalog.name)
    expect(info4!.access).toBe(ObjectAccess.PUBLIC)
    expect(info4!.ownerShortname).toBe(userOne.shortname)
    expect(info4!.ownerId).toBe(userOne.id)
    expect(info4!.isOwner).toBe(false)
    expect(info4!.isManager).toBe(false)
    expect(info4!.isEditor).toBe(false)
    expect(info4!.isRequested).toBe(false)
    expect(info4!.isShared).toBe(false)

    // user 5 has requested access to the public catalog collection
    const info5 = await getCatalogCollectionInfo(
      { catalogCollectionId: publicCatalog.id },
      userFiveCtx
    )
    expect(info5).toBeDefined()
    expect(info5!.id).toBe(publicCatalog.id)
    expect(info5!.name).toBe(publicCatalog.name)
    expect(info5!.access).toBe(ObjectAccess.PUBLIC)
    expect(info5!.ownerShortname).toBe(userOne.shortname)
    expect(info5!.ownerId).toBe(userOne.id)
    expect(info5!.isOwner).toBe(false)
    expect(info5!.isManager).toBe(false)
    expect(info5!.isEditor).toBe(false)
    expect(info5!.isRequested).toBe(true)
    expect(info5!.isShared).toBe(false)

    // verify that users 1 to 4 can access the content of the restricted catalog collection, user 5 cannot
    const info6 = await getCatalogCollectionInfo(
      { catalogCollectionId: restrictedCatalog.id },
      userOneCtx
    )
    expect(info6).toBeDefined()
    expect(info6!.id).toBe(restrictedCatalog.id)
    expect(info6!.name).toBe(restrictedCatalog.name)
    expect(info6!.access).toBe(ObjectAccess.RESTRICTED)
    expect(info6!.ownerShortname).toBe(userOne.shortname)
    expect(info6!.ownerId).toBe(userOne.id)
    expect(info6!.isOwner).toBe(true)
    expect(info6!.isManager).toBe(true)
    expect(info6!.isEditor).toBe(true)
    expect(info6!.isRequested).toBe(false)
    expect(info6!.isShared).toBe(false)

    const info7 = await getCatalogCollectionInfo(
      { catalogCollectionId: restrictedCatalog.id },
      userTwoCtx
    )
    expect(info7).toBeDefined()
    expect(info7!.id).toBe(restrictedCatalog.id)
    expect(info7!.name).toBe(restrictedCatalog.name)
    expect(info7!.access).toBe(ObjectAccess.RESTRICTED)
    expect(info7!.ownerShortname).toBe(userOne.shortname)
    expect(info7!.ownerId).toBe(userOne.id)
    expect(info7!.isOwner).toBe(false)
    expect(info7!.isManager).toBe(false)
    expect(info7!.isEditor).toBe(false)
    expect(info7!.isRequested).toBe(false)
    expect(info7!.isShared).toBe(true)

    const info8 = await getCatalogCollectionInfo(
      { catalogCollectionId: restrictedCatalog.id },
      userThreeCtx
    )
    expect(info8).toBeDefined()
    expect(info8!.id).toBe(restrictedCatalog.id)
    expect(info8!.name).toBe(restrictedCatalog.name)
    expect(info8!.access).toBe(ObjectAccess.RESTRICTED)
    expect(info8!.ownerShortname).toBe(userOne.shortname)
    expect(info8!.ownerId).toBe(userOne.id)
    expect(info8!.isOwner).toBe(false)
    expect(info8!.isManager).toBe(false)
    expect(info8!.isEditor).toBe(true)
    expect(info8!.isRequested).toBe(false)
    expect(info8!.isShared).toBe(true)

    const info9 = await getCatalogCollectionInfo(
      { catalogCollectionId: restrictedCatalog.id },
      userFourCtx
    )
    expect(info9).toBeDefined()
    expect(info9!.id).toBe(restrictedCatalog.id)
    expect(info9!.name).toBe(restrictedCatalog.name)
    expect(info9!.access).toBe(ObjectAccess.RESTRICTED)
    expect(info9!.ownerShortname).toBe(userOne.shortname)
    expect(info9!.ownerId).toBe(userOne.id)
    expect(info9!.isOwner).toBe(false)
    expect(info9!.isManager).toBe(true)
    expect(info9!.isEditor).toBe(true)
    expect(info9!.isRequested).toBe(false)
    expect(info9!.isShared).toBe(true)
  })

  it('Verify that the catalog collection access can be modified', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // switch the catalog collection access from PUBLIC to RESTRICTED
    const success = await changeCatalogCollectionObjectAccess(
      {
        catalogCollectionId: publicCatalog.id,
        access: ObjectAccess.RESTRICTED,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the catalog collection access has been changed in the database
    const updatedCatalog = await prisma.catalogCollection.findUnique({
      where: { id: publicCatalog.id },
    })
    expect(updatedCatalog).toBeDefined()
    expect(updatedCatalog?.access).toBe(ObjectAccess.RESTRICTED)

    // verify that an audit log entry has been created successfully
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry?.sourceUserId).toBe(userOne.id)
    expect(auditLogEntry?.message).toBe(
      `Catalog collection access level changed to ${ObjectAccess.RESTRICTED}`
    )
  })

  it('Verify that the catalog collection name can be modified', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // change the catalog collection name
    const newName = 'New Catalog Collection Name'
    const success = await changeCatalogCollectionName(
      {
        catalogCollectionId: publicCatalog.id,
        name: newName,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    const updatedCatalog = await prisma.catalogCollection.findUnique({
      where: { id: publicCatalog.id },
    })
    expect(updatedCatalog).toBeDefined()
    expect(updatedCatalog?.name).toBe(newName)
  })

  it('Verify that the catalog collections are correctly loaded for all users', async () => {
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // grant WRITE permissions to user 2 - empty public catalog collections are only shown to users with access
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // check that the created catalog collections are loaded correctly
    const catalogs1 = await getCatalogCollectionsList(userOneCtx)
    expect(catalogs1).toBeDefined()
    expect(catalogs1.length).toBe(2)

    const publicCatalog1 = catalogs1.find(
      (catalog) => catalog.id === publicCatalog.id
    )
    const restrictedCatalog1 = catalogs1.find(
      (catalog) => catalog.id === restrictedCatalog.id
    )
    expect(publicCatalog1).toBeDefined()
    expect(restrictedCatalog1).toBeDefined()
    expect(publicCatalog1?.name).toBe(publicCatalog.name)
    expect(publicCatalog1?.access).toBe(ObjectAccess.PUBLIC)
    expect(publicCatalog1?.ownerId).toBe(userOne.id)
    expect(publicCatalog1?.ownerShortname).toBe(userOne.shortname)
    expect(publicCatalog1?.isOwner).toBe(true)
    expect(publicCatalog1?.isManager).toBe(true)
    expect(publicCatalog1?.isEditor).toBe(true)
    expect(publicCatalog1?.isRequested).toBe(false)
    expect(publicCatalog1?.isShared).toBe(false)
    expect(restrictedCatalog1?.name).toBe(restrictedCatalog.name)
    expect(restrictedCatalog1?.access).toBe(ObjectAccess.RESTRICTED)
    expect(restrictedCatalog1?.ownerId).toBe(userOne.id)
    expect(restrictedCatalog1?.ownerShortname).toBe(userOne.shortname)
    expect(restrictedCatalog1?.isOwner).toBe(true)
    expect(restrictedCatalog1?.isManager).toBe(true)
    expect(restrictedCatalog1?.isEditor).toBe(true)
    expect(restrictedCatalog1?.isRequested).toBe(false)
    expect(restrictedCatalog1?.isShared).toBe(false)

    const catalogs2 = await getCatalogCollectionsList(userTwoCtx)
    expect(catalogs2).toBeDefined()
    expect(catalogs2.length).toBe(2)

    const publicCatalog2 = catalogs2.find(
      (catalog) => catalog.id === publicCatalog.id
    )
    const restrictedCatalog2 = catalogs2.find(
      (catalog) => catalog.id === restrictedCatalog.id
    )
    expect(publicCatalog2).toBeDefined()
    expect(restrictedCatalog2).toBeDefined()
    expect(publicCatalog2?.name).toBe(publicCatalog.name)
    expect(publicCatalog2?.access).toBe(ObjectAccess.PUBLIC)
    expect(publicCatalog2?.ownerId).toBe(userOne.id)
    expect(publicCatalog2?.ownerShortname).toBe(userOne.shortname)
    expect(publicCatalog2?.isOwner).toBe(false)
    expect(publicCatalog2?.isManager).toBe(false)
    expect(publicCatalog2?.isEditor).toBe(true)
    expect(publicCatalog2?.isRequested).toBe(false)
    expect(publicCatalog2?.isShared).toBe(true)
    expect(restrictedCatalog2?.name).toBe(restrictedCatalog.name)
    expect(restrictedCatalog2?.access).toBe(ObjectAccess.RESTRICTED)
    expect(restrictedCatalog2?.ownerId).toBe(userOne.id)
    expect(restrictedCatalog2?.ownerShortname).toBe(userOne.shortname)
    expect(restrictedCatalog2?.isOwner).toBe(false)
    expect(restrictedCatalog2?.isManager).toBe(false)
    expect(restrictedCatalog2?.isEditor).toBe(false)
    expect(restrictedCatalog2?.isRequested).toBe(false)
    expect(restrictedCatalog2?.isShared).toBe(false)

    const catalogs3 = await getCatalogCollectionsList(userThreeCtx)
    expect(catalogs3).toBeDefined()
    expect(catalogs3.length).toBe(1)
    const publicCatalog3 = catalogs3.find(
      (catalog) => catalog.id === publicCatalog.id
    )
    const restrictedCatalog3 = catalogs3.find(
      (catalog) => catalog.id === restrictedCatalog.id
    )
    expect(publicCatalog3).toBeUndefined()
    expect(restrictedCatalog3).toBeDefined()
    expect(restrictedCatalog3?.name).toBe(restrictedCatalog.name)
    expect(restrictedCatalog3?.access).toBe(ObjectAccess.RESTRICTED)
    expect(restrictedCatalog3?.ownerId).toBe(userOne.id)
    expect(restrictedCatalog3?.ownerShortname).toBe(userOne.shortname)
    expect(restrictedCatalog3?.isOwner).toBe(false)
    expect(restrictedCatalog3?.isManager).toBe(false)
    expect(restrictedCatalog3?.isEditor).toBe(false)
    expect(restrictedCatalog3?.isRequested).toBe(false)
    expect(restrictedCatalog3?.isShared).toBe(false)

    // add an object to the public catalog collection and verify that it is now shown to user 3
    const [AC1] = await seedAnswerCollections(userOneCtx)
    await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC1!.id,
      },
    })

    const catalogs4 = await getCatalogCollectionsList(userThreeCtx)
    expect(catalogs4).toBeDefined()
    expect(catalogs4.length).toBe(2)
    const publicCatalog4 = catalogs4.find(
      (catalog) => catalog.id === publicCatalog.id
    )
    const restrictedCatalog4 = catalogs4.find(
      (catalog) => catalog.id === restrictedCatalog.id
    )
    expect(publicCatalog4).toBeDefined()
    expect(restrictedCatalog4).toBeDefined()
    expect(publicCatalog4?.name).toBe(publicCatalog.name)
    expect(publicCatalog4?.access).toBe(ObjectAccess.PUBLIC)
    expect(publicCatalog4?.ownerId).toBe(userOne.id)
    expect(publicCatalog4?.ownerShortname).toBe(userOne.shortname)
    expect(publicCatalog4?.isOwner).toBe(false)
    expect(publicCatalog4?.isManager).toBe(false)
    expect(publicCatalog4?.isEditor).toBe(false)
    expect(publicCatalog4?.isRequested).toBe(false)
    expect(publicCatalog4?.isShared).toBe(false)
  })

  it('Verify that requesting a catalog collection works correctly', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant ADMIN priviliges to user 2 on the public catalog collection
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // request access to the public catalog collection for user 3
    const requestSuccess = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userThreeCtx
    )
    expect(requestSuccess).toBeTruthy()

    // verify that the access requests were created correctly in the database for owner and admins
    const ownerAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(ownerAccessRequest).toBeDefined()
    expect(ownerAccessRequest?.permissionLevel).toBe(PermissionLevel.WRITE)

    const adminAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(adminAccessRequest).toBeDefined()
    expect(adminAccessRequest?.permissionLevel).toBe(PermissionLevel.WRITE)

    // verify that the corresponding audit log entries have been created successfully
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: publicCatalog.id,
        sourceUserId: userThree.id,
        targetUserId: userOne.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1?.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by user ${userThree.id} for owner / admin ${userOne.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: publicCatalog.id,
        sourceUserId: userThree.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2?.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by user ${userThree.id} for owner / admin ${userTwo.id}.`
    )

    // verify that requesting access to the collection for user 3 again does fail (if the same permission level is used)
    const requestFail = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userThreeCtx
    )
    expect(requestFail).toBeNull()

    // delete the access requests and create a direct permission for user 3
    await prisma.accessRequest.deleteMany({
      where: {
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // verify that requesting access to the collection for user 3 again does fail (if the same permission level is used)
    const requestFail2 = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userThreeCtx
    )
    expect(requestFail2).toBeNull()

    // verify that requesting another access level is successful
    const requestSuccess2 = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.ADMIN,
      },
      userThreeCtx
    )
    expect(requestSuccess2).toBeTruthy()

    // delete the existing permission and access requests, re-request access with READ permissions
    await prisma.permission.deleteMany({
      where: {
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
      },
    })
    await prisma.accessRequest.deleteMany({
      where: {
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    const requestSuccess3 = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.READ,
      },
      userThreeCtx
    )
    expect(requestSuccess3).toBeTruthy()

    // verify that the access requests were created correctly in the database for owner and admins
    const ownerAccessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(ownerAccessRequest2).toBeDefined()
    expect(ownerAccessRequest2?.permissionLevel).toBe(PermissionLevel.READ)

    const adminAccessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(adminAccessRequest2).toBeDefined()
    expect(adminAccessRequest2?.permissionLevel).toBe(PermissionLevel.READ)

    // request access again with WRITE permissions and verify that the permission level is updated accordingly
    const requestSuccess4 = await requestCatalogCollection(
      {
        catalogCollectionId: publicCatalog.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userThreeCtx
    )
    expect(requestSuccess4).toBeTruthy()

    const ownerAccessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(ownerAccessRequest3).toBeDefined()
    expect(ownerAccessRequest3?.permissionLevel).toBe(PermissionLevel.WRITE)

    const adminAccessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(adminAccessRequest3).toBeDefined()
    expect(adminAccessRequest3?.permissionLevel).toBe(PermissionLevel.WRITE)
  })

  it('Verify that the catalog collection deletion function works correctly', async () => {
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // create an answer collection and assign it to the restricted catalog collection
    const [AC1] = await seedAnswerCollections(userOneCtx)
    await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: restrictedCatalog.id,
        answerCollectionId: AC1!.id,
      },
    })

    // delete both catalog collections
    const deletedCollectionId1 = await deleteCatalogCollection(
      { catalogCollectionId: publicCatalog.id },
      userOneCtx
    )
    expect(deletedCollectionId1).toBe(publicCatalog.id)
    const deletedCollectionId2 = await deleteCatalogCollection(
      { catalogCollectionId: restrictedCatalog.id },
      userOneCtx
    )
    expect(deletedCollectionId2).toBe(restrictedCatalog.id)

    // verify that the catalog collection and the assignment have been deleted
    const deletedAssignment =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1!.id,
            catalogCollectionId: restrictedCatalog.id,
          },
        },
      })
    expect(deletedAssignment).toBeNull()

    const deletedCatalog = await prisma.catalogCollection.findUnique({
      where: { id: publicCatalog.id },
    })
    expect(deletedCatalog).toBeNull()
    const deletedCatalog2 = await prisma.catalogCollection.findUnique({
      where: { id: restrictedCatalog.id },
    })
    expect(deletedCatalog2).toBeNull()
  })
  // #endregion

  // ! Catalog Object Sharing (general functions without explicit object dependence)
  // #region
  it('Verify that the correct number of access requests is shown to all users', async () => {
    const [AC1, AC2] = await seedAnswerCollections(userOneCtx)

    // add three two access requests for user 1 and one for user 2
    await prisma.accessRequest.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.WRITE,
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          answerCollectionId: AC2!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      ],
    })

    // two access requests are linked to the owner
    const ownerCount = await countCatalogSharingRequests(userOneCtx)
    expect(ownerCount).toBe(2)
    const adminCount = await countCatalogSharingRequests(userTwoCtx)
    expect(adminCount).toBe(1)
  })

  it('Verify that access requests are correctly removed and new permissions created when being resolved', async () => {
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // add two access requests for users 2 and 3 on the answer collection
    const request1 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const request2 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const request3 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    // resolving the access request for user 3 does not work for a user that is now owner / admin (has no access request)
    const failure1 = await resolveObjectSharingRequest(
      {
        requestId: request1.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.WRITE,
        approved: true,
        propagation: false,
      },
      userFiveCtx
    )
    expect(failure1).toBe(false)

    const dbRequest1 = await prisma.accessRequest.findUnique({
      where: {
        id: request1.id,
      },
    })
    expect(dbRequest1).toBeDefined()

    // deny the access request and verify that it is removed from the database
    const success1 = await resolveObjectSharingRequest(
      {
        requestId: request1.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.WRITE,
        approved: false,
        propagation: false,
      },
      userOneCtx
    )
    expect(success1).toBe(true)

    // verify that the access request has been removed from the database
    const dbRequest2 = await prisma.accessRequest.findUnique({
      where: {
        id: request1.id,
      },
    })
    expect(dbRequest2).toBeNull()

    // verify that the audit log entry has been created successfully
    const auditLogEntryDecline = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_RESOLVED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntryDecline).toBeTruthy()
    expect(auditLogEntryDecline?.message).toBe(
      `Access request declined for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} for user ${userThree.id}.`
    )

    // approve the access request and verify the creation of a proper direct permission (and derived one)
    const success2 = await resolveObjectSharingRequest(
      {
        requestId: request2.id,
        userId: userFour.id,
        permissionLevel: PermissionLevel.READ,
        approved: true,
        propagation: false,
      },
      userOneCtx
    )
    expect(success2).toBe(true)

    // verify that the access request has been removed from the database
    const dbRequest3 = await prisma.accessRequest.findUnique({
      where: {
        id: request2.id,
      },
    })
    expect(dbRequest3).toBeNull()
    const dbRequest4 = await prisma.permission.findUnique({
      where: {
        id: request3.id,
      },
    })
    expect(dbRequest4).toBeNull()

    // verify that the direct and derived permission have been created correctly
    const directPermission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(directPermission).toBeDefined()
    expect(directPermission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(directPermission?.answerCollectionId).toBe(AC1!.id)
    expect(directPermission?.userId).toBe(userFour.id)

    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission).toBeDefined()
    expect(derivedPermission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission?.answerCollectionId).toBe(AC1!.id)
    expect(derivedPermission?.userId).toBe(userFour.id)

    // verify that the audit log entry has been created successfully
    const auditLogEntryApprove = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_RESOLVED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntryApprove).toBeTruthy()
    expect(auditLogEntryApprove?.message).toBe(
      `Access request approved (with permission level ${PermissionLevel.READ}) for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} for user ${userFour.id}.`
    )
  })

  it('Make sure that objects in the catalog are queried correctly', async () => {
    const [AC1, AC2] = await seedAnswerCollections(userOneCtx)
    const { SC, MC } = await seedElements(userOneCtx, AC1!.id)
    const { activityId1, activityId2 } = await seedLiveQuizTemplates(prisma)
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // assign objects to the top-level catalog collection
    const assignment1 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
      },
    })
    const assignment2 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId1,
      },
    })
    const assignment3 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        elementId: SC.id,
      },
    })

    // assign objects to the top-level catalog collection
    const assignment4 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC2!.id,
      },
    })
    const assignment5 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        liveQuizId: activityId2,
      },
    })
    const assignment6 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        elementId: MC.id,
      },
    })

    // verify that the correct objects are returned for the top-level catalog collection
    const catalogObjects = await getCatalogObjects(
      { catalogCollectionId: MISSING_CATALOG_COLLECTION_ID },
      userOneCtx
    )
    expect(catalogObjects).toBeDefined()
    expect(catalogObjects.length).toBe(3)

    const catalogObject1 = catalogObjects.find(
      (object) =>
        object.id === AC1!.id &&
        object.objectType === SharingObjectType.ANSWER_COLLECTION
    )
    const catalogObject2 = catalogObjects.find(
      (object) => object.uuid === activityId1
    )
    const catalogObject3 = catalogObjects.find(
      (object) =>
        object.id === SC.id && object.objectType === SharingObjectType.ELEMENT
    )
    expect(catalogObject1).toBeDefined()
    expect(catalogObject2).toBeDefined()
    expect(catalogObject3).toBeDefined()

    expect(catalogObject1!.id).toBe(AC1!.id)
    expect(catalogObject1!.objectType).toBe(SharingObjectType.ANSWER_COLLECTION)
    expect(catalogObject1!.assignmentId).toBe(assignment1.id)

    expect(catalogObject2!.uuid).toBe(activityId1)
    expect(catalogObject2!.objectType).toBe(
      SharingObjectType.LIVE_QUIZ_TEMPLATE
    )
    expect(catalogObject2!.assignmentId).toBe(assignment2.id)

    expect(catalogObject3!.id).toBe(SC.id)
    expect(catalogObject3!.objectType).toBe(SharingObjectType.ELEMENT)
    expect(catalogObject3!.assignmentId).toBe(assignment3.id)

    // verify that the correct objects are returned for the public catalog collection
    const catalogObjects2 = await getCatalogObjects(
      { catalogCollectionId: publicCatalog.id },
      userOneCtx
    )
    expect(catalogObjects2).toBeDefined()
    expect(catalogObjects2.length).toBe(3)

    const catalogObject4 = catalogObjects2.find(
      (object) =>
        object.id === AC2!.id &&
        object.objectType === SharingObjectType.ANSWER_COLLECTION
    )
    const catalogObject5 = catalogObjects2.find(
      (object) => object.uuid === activityId2
    )
    const catalogObject6 = catalogObjects2.find(
      (object) =>
        object.id === MC.id && object.objectType === SharingObjectType.ELEMENT
    )
    expect(catalogObject4).toBeDefined()
    expect(catalogObject5).toBeDefined()
    expect(catalogObject6).toBeDefined()

    expect(catalogObject4!.id).toBe(AC2!.id)
    expect(catalogObject4!.objectType).toBe(SharingObjectType.ANSWER_COLLECTION)
    expect(catalogObject4!.assignmentId).toBe(assignment4.id)
    expect(catalogObject5!.uuid).toBe(activityId2)
    expect(catalogObject5!.objectType).toBe(
      SharingObjectType.LIVE_QUIZ_TEMPLATE
    )
    expect(catalogObject5!.assignmentId).toBe(assignment5.id)
    expect(catalogObject6!.id).toBe(MC.id)
    expect(catalogObject6!.objectType).toBe(SharingObjectType.ELEMENT)
    expect(catalogObject6!.assignmentId).toBe(assignment6.id)
  })
  // #endregion

  // ! Catalog Collection Sharing
  // #region
  it('Change the permission level of a direct individual permission on a catalog collection', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant READ permissions to user 2
    const readPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // change the permission level to WRITE
    const success = await changeObjectPermissionLevel(
      {
        catalogCollectionId: publicCatalog.id,
        permissionId: readPermission.id,
        permissionLevel: PermissionLevel.WRITE,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the permission level has been updated in the database
    const updatedPermission = await prisma.permission.findUnique({
      where: {
        id: readPermission.id,
      },
    })
    expect(updatedPermission).toBeDefined()
    expect(updatedPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(updatedPermission?.catalogCollectionId).toBe(publicCatalog.id)
    expect(updatedPermission?.userId).toBe(userTwo.id)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.WRITE} for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) through owner / admin ${userOne.id} for user ${userTwo.id}.`
    )
  })

  it('Change the permission level of a direct user group permission on a catalog collection', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 1, 2, and 3 (ADMIN)
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })

    // grant READ permissions to the user group
    const readPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // change the permission level to WRITE
    const success = await changeObjectPermissionLevel(
      {
        catalogCollectionId: publicCatalog.id,
        permissionId: readPermission.id,
        permissionLevel: PermissionLevel.WRITE,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the permission level has been updated in the database
    const updatedPermission = await prisma.permission.findUnique({
      where: {
        id: readPermission.id,
      },
    })
    expect(updatedPermission).toBeDefined()
    expect(updatedPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(updatedPermission?.catalogCollectionId).toBe(publicCatalog.id)
    expect(updatedPermission?.userGroupId).toBe(group.id)

    // verify that the individual permissions of the user group members have been updated
    const ownerPerimission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(ownerPerimission).toBeDefined()
    expect(ownerPerimission?.permissionLevel).toBe(PermissionLevel.OWNER)

    const userTwoPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(userTwoPermission).toBeDefined()
    expect(userTwoPermission?.permissionLevel).toBe(PermissionLevel.WRITE)

    const userThreePermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
        },
      },
    })
    expect(userThreePermission).toBeDefined()
    expect(userThreePermission?.permissionLevel).toBe(PermissionLevel.WRITE)

    const userFourPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(userFourPermission).toBeNull()

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.WRITE} for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) through owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Verify that direct individual permissions on the catalog collection can be revoked without conditions', async () => {
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // grant READ permissions to user 2
    const readPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // revoke the permission
    const permissionDeletionFailure = await revokeObjectAccess(
      {
        catalogCollectionId: restrictedCatalog.id,
        permissionId: readPermission.id,
      },
      userOneCtx
    )
    expect(permissionDeletionFailure).toBeNull()

    const deletedPermissionId = await revokeObjectAccess(
      {
        catalogCollectionId: publicCatalog.id,
        permissionId: readPermission.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId).toBe(readPermission.id)

    // verify that both the acutal permission and the derived one have been deleted
    const deletedPermission = await prisma.permission.findUnique({
      where: {
        id: readPermission.id,
      },
    })
    expect(deletedPermission).toBeNull()
    const deletedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(deletedPermission2).toBeNull()

    // verify that an audit log entry has been created for this permission revocation
    const audigLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} for user ${userTwo.id}.`
    )
  })

  it('Verify that direct group permissions on the catalog collection can be revoked without conditions', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 1, 2, 3, and 4 (OWNER)
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userFour.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
          ],
        },
      },
    })

    // grant WRITE permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // verify that all users have derived permissions for the catalog collection
    const permissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(permissionUserOne).toBeDefined()
    expect(permissionUserOne?.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(permissionUserOne?.directPermissionId).toBeNull()

    const permissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionUserTwo).toBeDefined()
    expect(permissionUserTwo?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserTwo?.directPermissionId).toBe(groupPermission.id)

    const permissionUserThree = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
        },
      },
    })
    expect(permissionUserThree).toBeDefined()
    expect(permissionUserThree?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserThree?.directPermissionId).toBe(groupPermission.id)

    const permissionUserFour = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(permissionUserFour).toBeDefined()
    expect(permissionUserFour?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserFour?.directPermissionId).toBe(groupPermission.id)

    // revoke the permission
    const deletedPermissionId = await revokeObjectAccess(
      {
        catalogCollectionId: publicCatalog.id,
        permissionId: groupPermission.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId).toBe(groupPermission.id)

    // verify that both the acutal permission and the derived ones have been deleted
    const deletedPermission = await prisma.permission.findUnique({
      where: {
        id: groupPermission.id,
      },
    })
    expect(deletedPermission).toBeNull()

    const persistentPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: publicCatalog.id,
            userId: userOne.id,
          },
        },
      })
    expect(persistentPermissionUserOne).toBeDefined()
    expect(persistentPermissionUserOne?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const deletedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(deletedPermissionUserTwo).toBeNull()

    const deletedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: publicCatalog.id,
            userId: userThree.id,
          },
        },
      })
    expect(deletedPermissionUserThree).toBeNull()

    const deletedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: publicCatalog.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(deletedPermissionUserFour).toBeNull()

    // verify that an audit log entry has been created for this permission revocation
    const audigLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Verify that direct permissions on the answer collection are loaded correctly', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant READ permissions to user 2
    const dbUserPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        catalogCollectionId: publicCatalog.id,
      },
    })

    // create a user group with users 3 and 4 and grant WRITE permissions to the group
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const dbGroupPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group.id,
        catalogCollectionId: publicCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // fetch the direct permissions and make sure that they are correct
    const directPermissions = await getCatalogCollectionPermissions(
      { id: publicCatalog.id },
      userOneCtx
    )
    expect(directPermissions).toBeDefined()
    expect(directPermissions.length).toBe(2)

    const userPermission = directPermissions.find(
      (permission) => permission.userId === userTwo.id
    )
    const groupPermission = directPermissions.find(
      (permission) => permission.userGroupId === group.id
    )
    expect(userPermission).toBeDefined()
    expect(groupPermission).toBeDefined()
    expect(userPermission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(userPermission?.userId).toBe(userTwo.id)
    expect(userPermission?.permissionId).toBe(dbUserPermission.id)
    expect(groupPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupPermission?.userGroupId).toBe(group.id)
    expect(groupPermission?.permissionId).toBe(dbGroupPermission.id)
  })

  it('Verify that a catalog collection OWNER can transfer the corresponding rights', async () => {
    // create catalog collections for testing
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)

    // add direct admin permissions to user 4
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        catalogCollectionId: restrictedCatalog.id,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
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
        id: restrictedCatalog.id,
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

    // verify that correct direct permissions have been created and the one for user 4 removed
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

    // verify that derived ownership and admin permissions have been created correctly
    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdminPermission!.userId).toBe(userOne.id)
    expect(derivedAdminPermission!.catalogCollectionId).toBe(
      restrictedCatalog.id
    )

    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: restrictedCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.userId).toBe(userFour.id)
    expect(derivedOwnerPermission!.catalogCollectionId).toBe(
      restrictedCatalog.id
    )

    const updatedCatalogCollection = await prisma.catalogCollection.findUnique({
      where: {
        id: restrictedCatalog.id,
      },
    })
    expect(updatedCatalogCollection).toBeTruthy()
    expect(updatedCatalogCollection!.ownerId).toBe(userFour.id)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.OWNER_TRANSFERRED,
        objectId: restrictedCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Ownership of ${ObjectType.CATALOG_COLLECTION} (ID ${restrictedCatalog.id}) transferred from user ${userOne.id} to user ${userFour.id}.`
    )
  })

  it('Verify that catalog collections can be directly shared with individual users', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // verify that the function fails, if the provided user does not exist
    const failure1 = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        shortnameOrEmail: 'non-existing-user',
        permissionLevel: PermissionLevel.READ,
      },
      userOneCtx
    )
    expect(failure1).toBeNull()

    // grant direct READ, WRITE and ADMIN permissions on the public catalog collection for users 2, 3, and 4 respectively
    const readPermission = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        shortnameOrEmail: userTwo.email,
        permissionLevel: PermissionLevel.READ,
      },
      userOneCtx
    )
    expect(readPermission).toBeTruthy()
    expect(readPermission!.userId).toBe(userTwo.id)
    expect(readPermission!.username).toBe(userTwo.shortname)
    expect(readPermission!.userEmail).toBe(userTwo.email)
    expect(readPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermission!.isOwn).toBe(false)

    const writePermission = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        shortnameOrEmail: userThree.shortname,
        permissionLevel: PermissionLevel.WRITE,
      },
      userOneCtx
    )
    expect(writePermission).toBeTruthy()
    expect(writePermission!.userId).toBe(userThree.id)
    expect(writePermission!.username).toBe(userThree.shortname)
    expect(writePermission!.userEmail).toBe(userThree.email)
    expect(writePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(writePermission!.isOwn).toBe(false)

    const adminPermission = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        shortnameOrEmail: userFour.shortname,
        permissionLevel: PermissionLevel.ADMIN,
      },
      userOneCtx
    )
    expect(adminPermission).toBeTruthy()
    expect(adminPermission!.userId).toBe(userFour.id)
    expect(adminPermission!.username).toBe(userFour.shortname)
    expect(adminPermission!.userEmail).toBe(userFour.email)
    expect(adminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(adminPermission!.isOwn).toBe(false)

    // verify that the permissions have been created correctly in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission1).toBeDefined()
    expect(dbPermission1?.permissionLevel).toBe(PermissionLevel.READ)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
        },
      },
    })
    expect(dbPermission2).toBeDefined()
    expect(dbPermission2?.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeDefined()
    expect(dbPermission3?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the recomputation of derived permissions was triggered correctly
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission1).toBeDefined()
    expect(derivedPermission1?.permissionLevel).toBe(PermissionLevel.READ)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )
  })

  it('Verify that catalog collections can be shared with user groups', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 1 (ADMIN), 2, and 3 and grant WRITE permissions to them
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const groupPermission = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.WRITE,
      },
      userOneCtx
    )
    expect(groupPermission).toBeTruthy()
    expect(groupPermission!.userGroupId).toBe(group.id)
    expect(groupPermission!.userGroupName).toBe(group.name)

    // create a user group with users 1, 3 (ADMIN), and 4 and grant ADMIN permissions to them
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Test Group 2',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const groupPermission2 = await shareObject(
      {
        catalogCollectionId: publicCatalog.id,
        userGroupId: group2.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
      userOneCtx
    )
    expect(groupPermission2).toBeTruthy()
    expect(groupPermission2!.userGroupId).toBe(group2.id)
    expect(groupPermission2!.userGroupName).toBe(group2.name)

    // verify that the correct direct permissions have been created in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userGroupId: {
          catalogCollectionId: publicCatalog.id,
          userGroupId: group.id,
        },
      },
    })
    expect(dbPermission1).toBeDefined()
    expect(dbPermission1?.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        catalogCollectionId_userGroupId: {
          catalogCollectionId: publicCatalog.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(dbPermission2).toBeDefined()
    expect(dbPermission2?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct derived permissions have been created in the database
    // OWNER for user 1, WRITE for user 2, ADMIN for users 3 and 4
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission1).toBeDefined()
    expect(derivedPermission1?.permissionLevel).toBe(PermissionLevel.OWNER)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission2).toBeDefined()
    expect(derivedPermission2?.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission3).toBeDefined()
    expect(derivedPermission3?.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission4).toBeDefined()
    expect(derivedPermission4?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} to user group ${group.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )
  })

  it('Verify that access requests to catalog collections are shown correctly to owners and admins', async () => {
    const { restrictedCatalog, publicCatalog } =
      await seedCatalogCollections(userOneCtx)

    // create access requests for user 3 (on both) and user 4 (on the public catalog)
    // access requests for the publbic catalog should be linked to both user 1 (owner) and user 2 (admin)
    const request1 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request2 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    const request3 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: restrictedCatalog.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request4 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request5 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    // get the pending sharing requests for user 1 and check their content
    const requests = await getCatalogSharingRequests(userOneCtx)
    expect(requests).toBeDefined()
    expect(requests!.length).toBe(3)
    const publicRequestUserThree = requests!.find(
      (request) => request.requestId === request1.id
    )
    const publicRequestUserFour = requests!.find(
      (request) => request.requestId === request4.id
    )
    const restrictedRequestUserThree = requests!.find(
      (request) => request.requestId === request3.id
    )
    expect(publicRequestUserThree).toBeDefined()
    expect(publicRequestUserFour).toBeDefined()
    expect(restrictedRequestUserThree).toBeDefined()
    expect(publicRequestUserThree?.objectType).toBe(
      SharingObjectType.CATALOG_COLLECTION
    )
    expect(publicRequestUserThree?.requestId).toBe(request1.id)
    expect(publicRequestUserThree?.userId).toBe(userThree.id)
    expect(publicRequestUserThree?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour?.objectType).toBe(
      SharingObjectType.CATALOG_COLLECTION
    )
    expect(publicRequestUserFour?.requestId).toBe(request4.id)
    expect(publicRequestUserFour?.userId).toBe(userFour.id)
    expect(publicRequestUserFour?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour?.userShortname).toBe(userFour.shortname)

    expect(restrictedRequestUserThree?.objectType).toBe(
      SharingObjectType.CATALOG_COLLECTION
    )
    expect(restrictedRequestUserThree?.requestId).toBe(request3.id)
    expect(restrictedRequestUserThree?.userId).toBe(userThree.id)
    expect(restrictedRequestUserThree?.userEmail).toBe(userThree.email)
    expect(restrictedRequestUserThree?.userShortname).toBe(userThree.shortname)

    // get the pending sharing requests for user 2 and check their content
    const requests2 = await getCatalogSharingRequests(userTwoCtx)
    expect(requests2).toBeDefined()
    expect(requests2!.length).toBe(2)
    const publicRequestUserThree2 = requests2!.find(
      (request) => request.requestId === request2.id
    )
    const publicRequestUserFour2 = requests2!.find(
      (request) => request.requestId === request5.id
    )
    expect(publicRequestUserThree2).toBeDefined()
    expect(publicRequestUserFour2).toBeDefined()

    expect(publicRequestUserThree2?.objectType).toBe(
      SharingObjectType.CATALOG_COLLECTION
    )
    expect(publicRequestUserThree2?.requestId).toBe(request2.id)
    expect(publicRequestUserThree2?.userId).toBe(userThree.id)
    expect(publicRequestUserThree2?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree2?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour2?.objectType).toBe(
      SharingObjectType.CATALOG_COLLECTION
    )
    expect(publicRequestUserFour2?.requestId).toBe(request5.id)
    expect(publicRequestUserFour2?.userId).toBe(userFour.id)
    expect(publicRequestUserFour2?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour2?.userShortname).toBe(userFour.shortname)
  })

  it('Verify that the object access of an object included in the catalog can be modified (assuming sufficient permissions)', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // assign the answer collection to the top-level and public catalog collections
    const assignment1 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
        access: ObjectAccess.PUBLIC,
      },
    })
    const assignment2 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC1!.id,
        access: ObjectAccess.RESTRICTED,
      },
    })

    // modfiy the first assignment to restricted and the restricted assignment to public
    const success = await changeCatalogObjectAccess(
      { assignmentId: assignment1.id, access: ObjectAccess.RESTRICTED },
      userOneCtx
    )
    expect(success).toBe(true)
    const success2 = await changeCatalogObjectAccess(
      { assignmentId: assignment2.id, access: ObjectAccess.PUBLIC },
      userOneCtx
    )
    expect(success2).toBe(true)

    // verify that the catalog object assignments have been updated correctly
    const updatedAssignment1 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment1.id,
        },
      })
    expect(updatedAssignment1).toBeDefined()
    expect(updatedAssignment1?.access).toBe(ObjectAccess.RESTRICTED)
    expect(updatedAssignment1?.answerCollectionId).toBe(AC1!.id)
    expect(updatedAssignment1?.catalogCollectionId).toBe(
      MISSING_CATALOG_COLLECTION_ID
    )

    const updatedAssignment2 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment2.id,
        },
      })
    expect(updatedAssignment2).toBeDefined()
    expect(updatedAssignment2?.access).toBe(ObjectAccess.PUBLIC)
    expect(updatedAssignment2?.answerCollectionId).toBe(AC1!.id)
    expect(updatedAssignment2?.catalogCollectionId).toBe(publicCatalog.id)

    // verify that audit log entries have been created for these changes
    const auditLog1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
      },
    })
    expect(auditLog1).toBeTruthy()
    expect(auditLog1?.sourceUserId).toBe(userOne.id)
    expect(auditLog1?.message).toBe(
      `Catalog object assignment (ID ${updatedAssignment1!.id} for ${ObjectType.ANSWER_COLLECTION} with ID ${AC1!.id}) access level changed to ${ObjectAccess.RESTRICTED}`
    )
  })
  // #endregion
})
