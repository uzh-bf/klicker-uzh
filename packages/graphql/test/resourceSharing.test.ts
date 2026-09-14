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
import type { ContextWithUser } from '../src/lib/context.js'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  addObjectToCatalog,
  cancelObjectSharingRequest,
  changeObjectPermissionLevel,
  copyAnswerCollectionToAccount,
  getAnswerCollectionCatalogInfo,
  getAnswerCollectionPermissions,
  getCatalogAnswerCollections,
  getCatalogSharingRequests,
  getDerivedAnswerCollectionPermissions,
  importAnswerCollection,
  requestCatalogObject,
  revokeObjectAccess,
  shareObject,
  transferAnswerCollectionOwnership,
  verifyCatalogObjectEditPermissions,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollectionPermissions,
  seedAnswerCollections,
  seedCatalogCollectionPermissions,
  seedCatalogCollections,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { answerCollection1, answerCollection2 } from './testData.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for sharing functionalities of resources (e.g. answer collections)', () => {
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

  // TODO - as soon as elements and courses can also be shared, add additional small test suites with essential sharing functionalities
  // TODO: make sure to extend tests once element and activity sharing is available with modifications and impact on derived permissions when executing the following actions
  // - switch of answer collection linked to an element - derived access to previous collection should be removed, access to new one automatically added
  // - switch of an element in an activity - if ADMIN permissions on activity (propagation required), derived admin access should be modified
  // - element instance updates of templates that cause a modification of the answer collection --> corresponding derived permissions for users with shared access to template need to be updated
  // - validate that when changing the course assignment of some activity, that the corresponding permissions of users on the course are adapted accordingly

  // ! Catalog Operations with Answer Collections
  // #region
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

  it('Verify that permissions on answer collection determine allowed actions when included in top-level catalog collection', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // grant READ, WRITE and ADMIN permissions on the answer collection to users 2, 3, and 4
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          answerCollectionId: AC1!.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          answerCollectionId: AC1!.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFour.id,
          answerCollectionId: AC1!.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // assign the answer collection to the top-level catalog collection
    const assignment = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
      },
    })

    // verify that only users 1 and 4 have sufficient permissions to modify this assignment
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
    expect(res5).toBe(false)
  })

  it('Verify that access requests to answer collections are shown correctly to owners and admins', async () => {
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)

    // create access requests for user 3 (on both) and user 4 (on the public catalog)
    // access requests for the publbic catalog should be linked to both user 1 (owner) and user 2 (admin)
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
        userId: userThree.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    const request3 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC2!.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request4 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request5 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    // get the pending sharing requests for user 1 and check their content
    const requests = await getCatalogSharingRequests(userOneCtx)
    expect(requests).not.toBeNull()
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
    expect(publicRequestUserThree).not.toBeNull()
    expect(publicRequestUserFour).not.toBeNull()
    expect(restrictedRequestUserThree).not.toBeNull()
    expect(publicRequestUserThree?.objectType).toBe(
      ObjectType.ANSWER_COLLECTION
    )
    expect(publicRequestUserThree?.requestId).toBe(request1.id)
    expect(publicRequestUserThree?.userId).toBe(userThree.id)
    expect(publicRequestUserThree?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour?.objectType).toBe(ObjectType.ANSWER_COLLECTION)
    expect(publicRequestUserFour?.requestId).toBe(request4.id)
    expect(publicRequestUserFour?.userId).toBe(userFour.id)
    expect(publicRequestUserFour?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour?.userShortname).toBe(userFour.shortname)

    expect(restrictedRequestUserThree?.objectType).toBe(
      ObjectType.ANSWER_COLLECTION
    )
    expect(restrictedRequestUserThree?.requestId).toBe(request3.id)
    expect(restrictedRequestUserThree?.userId).toBe(userThree.id)
    expect(restrictedRequestUserThree?.userEmail).toBe(userThree.email)
    expect(restrictedRequestUserThree?.userShortname).toBe(userThree.shortname)

    // get the pending sharing requests for user 2 and check their content
    const requests2 = await getCatalogSharingRequests(userTwoCtx)
    expect(requests2).not.toBeNull()
    expect(requests2!.length).toBe(2)
    const publicRequestUserThree2 = requests2!.find(
      (request) => request.requestId === request2.id
    )
    const publicRequestUserFour2 = requests2!.find(
      (request) => request.requestId === request5.id
    )
    expect(publicRequestUserThree2).not.toBeNull()
    expect(publicRequestUserFour2).not.toBeNull()

    expect(publicRequestUserThree2?.objectType).toBe(
      ObjectType.ANSWER_COLLECTION
    )
    expect(publicRequestUserThree2?.requestId).toBe(request2.id)
    expect(publicRequestUserThree2?.userId).toBe(userThree.id)
    expect(publicRequestUserThree2?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree2?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour2?.objectType).toBe(
      ObjectType.ANSWER_COLLECTION
    )
    expect(publicRequestUserFour2?.requestId).toBe(request5.id)
    expect(publicRequestUserFour2?.userId).toBe(userFour.id)
    expect(publicRequestUserFour2?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour2?.userShortname).toBe(userFour.shortname)
  })

  it('Verify that user 5 can request access and copy the public answer collections in public catalog', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )
    await seedAnswerCollectionCatalogAssignments(
      prisma,
      AC1!.id,
      AC2!.id,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // verify that requesting / importing answer collections through the restricted catalog collection does not work
    const failure1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalog.id,
        answerCollectionId: AC1!.id,
      },
      userFiveCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await copyAnswerCollectionToAccount(
      {
        catalogCollectionId: restrictedCatalog.id,
        collectionId: AC1!.id,
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
        answerCollectionId: AC1!.id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const success2 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC2!.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userFiveCtx
    )
    expect(success2).toBeTruthy()

    // verify that the access requests have been created correctly
    const pendingAccessRequest2 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(pendingAccessRequest2.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER
    expect(
      pendingAccessRequest2.map((permission) => permission.answerCollectionId)
    ).toEqual(expect.arrayContaining([AC1!.id, AC2!.id]))

    // verify that proper audit log entries have been created for both access requests
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userFive.id,
        targetUserId: userOne.id, // owner
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Access request (permission level ${PermissionLevel.READ}) created for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by user ${userFive.id} for owner / admin ${userOne.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userFive.id,
        targetUserId: userTwo.id, // admin
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Access request (permission level ${PermissionLevel.READ}) created for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by user ${userFive.id} for owner / admin ${userTwo.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC2!.id),
        sourceUserId: userFive.id,
        targetUserId: userOne.id, // owner
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.ANSWER_COLLECTION} (ID ${AC2!.id}) by user ${userFive.id} for owner / admin ${userOne.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC2!.id),
        sourceUserId: userFive.id,
        targetUserId: userTwo.id, // admin
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.ANSWER_COLLECTION} (ID ${AC2!.id}) by user ${userFive.id} for owner / admin ${userTwo.id}.`
    )

    // import public AC and verify that importing restricted AC does not work
    const failure3 = await copyAnswerCollectionToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC2!.id, // restricted answer collection
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const success3 = await copyAnswerCollectionToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC1!.id, // public answer collection
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const importedACs2 = await prisma.answerCollection.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedACs2.length).toBe(1)
    expect(importedACs2[0]!.originalId).toBe(AC1!.id)
    expect(importedACs2[0]!.name).toBe(answerCollection1.name)
    expect(importedACs2[0]).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })

    // verify that duplicate requests are not accepted, duplicate imports are not a problem
    const failure4 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        answerCollectionId: AC1!.id,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const accessRequests3 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(accessRequests3.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER

    const success4 = await copyAnswerCollectionToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC1!.id,
      },
      userFiveCtx
    )
    expect(success4).toBeTruthy()

    const importedACs3 = await prisma.answerCollection.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedACs3.length).toBe(2)
    expect(importedACs3[0]!.originalId).toBe(AC1!.id)
    expect(importedACs3[0]!.name).toContain(answerCollection1.name)
    expect(importedACs3[1]!.originalId).toBe(AC1!.id)
    expect(importedACs3[1]!.name).toContain(answerCollection1.name)
    for (const imported of importedACs3) {
      expect(imported).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    }
  })

  it('Verify that user 5 can import the public answer collections in public catalog', async () => {
    // create answer collections and catalog collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )
    await seedAnswerCollectionCatalogAssignments(
      prisma,
      AC1!.id,
      AC2!.id,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // import public AC and verify that importing restricted AC does not work
    const failure3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC2!.id, // restricted answer collection
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const success3 = await importAnswerCollection(
      {
        catalogCollectionId: publicCatalog.id,
        collectionId: AC1!.id, // public answer collection
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    // verify that a correct direct permission has been created
    const permission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userFive.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(permission).not.toBeNull()
    expect(permission!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that a corresponding derived permission has been created
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userFive.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(derivedPermission).not.toBeNull()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.READ)

    // find assignment for answer collection to public catalog collection
    const assignment = await prisma.catalogCollectionAssignment.findUnique({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: AC1!.id,
          catalogCollectionId: publicCatalog.id,
        },
      },
    })

    // verify that a correct audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userFive.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Read permission granted on answer collection (ID ${AC1!.id}) through public catalog collection (ID ${publicCatalog.id}) and assignment (ID ${assignment!.id}) for user ${userFive.id}.`
    )
  })

  it('Verify that answer collection sharing requests can be cancelled by the initiator', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const request = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    // verify that the request is pending
    const pendingRequest = await prisma.accessRequest.findUnique({
      where: { id: request.id },
    })
    expect(pendingRequest).not.toBeNull()

    // verify that such a request fails for users that have not requested access
    const failure = await cancelObjectSharingRequest(
      { answerCollectionId: AC1!.id },
      userThreeCtx
    )
    expect(failure).toBe(false)

    // cancel the request
    const success = await cancelObjectSharingRequest(
      { answerCollectionId: AC1!.id },
      userTwoCtx
    )
    expect(success).toBe(true)

    // verify that the request is no longer pending
    const cancelledRequest = await prisma.accessRequest.findUnique({
      where: { id: request.id },
    })
    expect(cancelledRequest).toBeNull()

    // verify that a corresponding audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CANCELLED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Access request cancelled for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by user ${userTwo.id}.`
    )
  })

  it('Test that answer collections can be added to a catalog collection by users with sufficient permissions', async () => {
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)

    // grand READ permissions on the first answer collection to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // grand ADMIN permissions on the second answer collection to users 3 and 4
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: AC2!.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        answerCollectionId: AC2!.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC2!.id }, prisma)

    // grant WRITE permissions on the restricted catalog collection to user 4
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        catalogCollectionId: restrictedCatalog.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // verify that user 2 has insufficient permissions to add the first answer collection to the top-level catalog collection
    const res1 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()

    // verify that user 1 has sufficient permissions to add the first answer collection to the top-level catalog collection
    const res2 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
        access: ObjectAccess.PUBLIC,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.objectId).toEqual(AC1!.id)
    expect(res2!.objectType).toEqual(ObjectType.ANSWER_COLLECTION)
    expect(res2!.access).toEqual(ObjectAccess.PUBLIC)
    expect(res2!.ownerShortname).toEqual(userOne.shortname)
    expect(res2!.isOwner).toBe(true)
    expect(res2!.isManager).toBe(true)
    expect(res2!.isRequested).toBe(false)
    expect(res2!.isShared).toBe(false)

    // verify that a proper catalog assignment was created
    const catalogAssignment2 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC1!.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment2).toBeTruthy()
    expect(catalogAssignment2!.access).toEqual(ObjectAccess.PUBLIC)

    // verify that an audit log entry was created
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userOne.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userOne.id}.`
    )

    // verify that user 3 has sufficient permissions to add the second answer collection to the top-level catalog collection
    const res3 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC2!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(res3).toBeTruthy()
    expect(res3!.objectId).toEqual(AC2!.id)
    expect(res3!.objectType).toEqual(ObjectType.ANSWER_COLLECTION)
    expect(res3!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res3!.ownerShortname).toEqual(userOne.shortname)
    expect(res3!.isOwner).toBe(false)
    expect(res3!.isManager).toBe(true)
    expect(res3!.isRequested).toBe(false)
    expect(res3!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment3 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC2!.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment3).toBeTruthy()
    expect(catalogAssignment3!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC2!.id),
        sourceUserId: userThree.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `${ObjectType.ANSWER_COLLECTION} (ID ${AC2!.id}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userThree.id}.`
    )

    // verify that user 4 has sufficient permissions to add the second answer collection to the restricted catalog collection
    // -> >= WRITE permissions are required and satisfied
    const res4 = await addObjectToCatalog(
      {
        catalogCollectionId: restrictedCatalog.id,
        answerCollectionId: AC2!.id,
        access: ObjectAccess.RESTRICTED,
      },
      userFourCtx
    )
    expect(res4).toBeTruthy()
    expect(res4!.objectId).toEqual(AC2!.id)
    expect(res4!.objectType).toEqual(ObjectType.ANSWER_COLLECTION)
    expect(res4!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res4!.ownerShortname).toEqual(userOne.shortname)
    expect(res4!.isOwner).toBe(false)
    expect(res4!.isManager).toBe(true)
    expect(res4!.isRequested).toBe(false)
    expect(res4!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment4 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: AC2!.id,
            catalogCollectionId: restrictedCatalog.id,
          },
        },
      })
    expect(catalogAssignment4).toBeTruthy()
    expect(catalogAssignment4!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC2!.id),
        sourceUserId: userFour.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `${ObjectType.ANSWER_COLLECTION} (ID ${AC2!.id}) added to catalog collection (ID ${restrictedCatalog.id}) by user ${userFour.id}.`
    )
  })

  it('Verify that the correct information is extracted for public / restricted answer collections in the catalog', async () => {
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // add the answer collection to the top-level catalog collection
    await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC1!.id,
        access: ObjectAccess.PUBLIC,
      },
    })
    await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        answerCollectionId: AC2!.id,
        access: ObjectAccess.RESTRICTED,
      },
    })

    // when querying an invalid assignment, null should be returned
    const failure = await getAnswerCollectionCatalogInfo(
      { collectionId: AC1!.id, catalogCollectionId: publicCatalog.id },
      userOneCtx
    )
    expect(failure).toBeNull()

    // verify that for the publicly included answer collection, all information is returned
    const res1 = await getAnswerCollectionCatalogInfo(
      { collectionId: AC1!.id },
      userOneCtx
    )
    expect(res1).not.toBeNull()
    expect(res1!.id).toEqual(AC1!.id)
    expect(res1!.name).toEqual(answerCollection1.name)
    expect(res1!.description).toEqual(answerCollection1.description)
    expect(res1!.entries).toHaveLength(answerCollection1.entries.length)

    // verify that for the restrictedly included answer collection, the entries are hidden
    const res2 = await getAnswerCollectionCatalogInfo(
      { collectionId: AC2!.id },
      userOneCtx
    )
    expect(res2).not.toBeNull()
    expect(res2!.id).toEqual(AC2!.id)
    expect(res2!.name).toEqual(answerCollection2.name)
    expect(res2!.description).toEqual(answerCollection2.description)
    expect(res2!.entries).toHaveLength(0)
  })

  it('Verify that the correct answer collections are fetched to be included in the catalog', async () => {
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)

    // grant ADMIN permissions to user 2 on the first collection only
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // query the available answer collections for user 1
    const collections1 = await getCatalogAnswerCollections(userOneCtx)
    expect(collections1).not.toBeNull()
    expect(collections1!.length).toBe(2)
    expect(collections1!.map((c) => parseInt(c.id))).toEqual(
      expect.arrayContaining([AC1!.id, AC2!.id])
    )
    expect(collections1!.map((c) => c.name)).toEqual(
      expect.arrayContaining([answerCollection1.name, answerCollection2.name])
    )

    // query the available answer collections for user 2
    const collections2 = await getCatalogAnswerCollections(userTwoCtx)
    expect(collections2).not.toBeNull()
    expect(collections2!.length).toBe(1)
    expect(parseInt(collections2![0]!.id)).toBe(AC1!.id)
    expect(collections2![0]!.name).toBe(answerCollection1.name)

    // query that for any other user (e.g. user 3) no answer collections are returned
    const collections3 = await getCatalogAnswerCollections(userThreeCtx)
    expect(collections3).not.toBeNull()
    expect(collections3!.length).toBe(0)
  })
  // #endregion

  // ! Sharing Operations for Answer Collections
  // #region
  it('Verify that the level of granted direct individual permissions can be modified', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // grant READ permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // verify that user 2 has READ permissions
    const permission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userTwo.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(permission1).not.toBeNull()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)

    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userTwo.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(derivedPermission1).not.toBeNull()
    expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that if all information is consistent, the permission level is changed and correctly propagated
    const success = await changeObjectPermissionLevel(
      {
        permissionId: permission1!.id,
        permissionLevel: PermissionLevel.WRITE,
        answerCollectionId: AC1!.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the direct and derived permissions have been updated correctly
    const permission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userTwo.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(permission2).not.toBeNull()
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          userId: userTwo.id,
          answerCollectionId: AC1!.id,
        },
      },
    })
    expect(derivedPermission2).not.toBeNull()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.WRITE} for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) through owner / admin ${userOne.id} for user ${userTwo.id}.`
    )
  })

  it('Verify that the level of granted direct group permissions can be modified', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // change the permission level to WRITE
    const success = await changeObjectPermissionLevel(
      {
        answerCollectionId: AC1!.id,
        permissionId: readPermission.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
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
    expect(updatedPermission).not.toBeNull()
    expect(updatedPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(updatedPermission?.answerCollectionId).toBe(AC1!.id)
    expect(updatedPermission?.userGroupId).toBe(group.id)

    // verify that the individual permissions of the user group members have been updated
    const ownerPerimission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(ownerPerimission).not.toBeNull()
    expect(ownerPerimission?.permissionLevel).toBe(PermissionLevel.OWNER)

    const userTwoPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(userTwoPermission).not.toBeNull()
    expect(userTwoPermission?.permissionLevel).toBe(PermissionLevel.WRITE)

    const userThreePermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(userThreePermission).not.toBeNull()
    expect(userThreePermission?.permissionLevel).toBe(PermissionLevel.WRITE)

    const userFourPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(userFourPermission).toBeNull()

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.WRITE} for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) through owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Verify that direct individual permissions to an answer collection can be revoked, but might be replaced with derived permissions', async () => {
    // create answer collections for testing
    const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
    await seedAnswerCollectionPermissions(prisma, AC1!.id, AC2!.id)

    const permission1 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        answerCollection: {
          connect: {
            id: AC1!.id,
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
    const deletedPermissionId1 = await revokeObjectAccess(
      {
        permissionId: permission1.id,
        answerCollectionId: AC1!.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId1).toBe(permission1.id)

    // verify that the direct permission has been deleted
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission1).toBeNull()

    // verify that an audit log entry has been created for this permission revocation
    const audigLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} for user ${userFive.id}.`
    )

    // create a new direct WRITE permission for user 5 on AC1
    const permission2 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        answerCollection: {
          connect: {
            id: AC1!.id,
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
    const deletedPermissionId2 = await revokeObjectAccess(
      {
        permissionId: permission2.id,
        answerCollectionId: AC1!.id,
      },
      userTwoCtx
    )
    expect(deletedPermissionId2).toBe(permission2.id)

    // verify that the direct permission has been deleted
    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // create a new direct ADMIN permission for user 5 on AC1
    const permission3 = await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: AC1!.id,
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
            id: AC1!.id,
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
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission!.directPermissionId).toBe(permission3.id)
    expect(derivedPermission!.derived).toBe(false)

    // verify that the permission can be revoked by an owner / admin, but will be replaced with a derived READ permission
    const removalSuccess1 = await revokeObjectAccess(
      {
        permissionId: permission3.id,
        answerCollectionId: AC1!.id,
      },
      userTwoCtx
    )
    expect(removalSuccess1).toBeTruthy()

    // direct permission has been removed
    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    // a new derived permission has been created
    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
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
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        answerCollection: {
          connect: {
            id: AC1!.id,
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
        answerCollectionId: AC1!.id,
        userId: userFive.id,
      },
      prisma
    )

    // verify that permission has been created correctly and a corresponding derived permission has been added
    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
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
          answerCollectionId: AC1!.id,
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

    const permissionSelfRemoval = await revokeObjectAccess(
      {
        permissionId: permission4.id,
        answerCollectionId: AC1!.id,
      },
      userFiveCtx
    )
    expect(permissionSelfRemoval).toBe(permission4.id)

    // verify that both the direct permission and the derived permission have been removed
    const dbPermission5 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission5).toBeNull()

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission4).toBeNull()
  })

  it('Verify that direct group permissions on an answer collection can be revoked without conditions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)

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
        answerCollectionId: AC!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)

    // verify that all users have derived permissions for the answer collection
    const permissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC!.id,
          userId: userOne.id,
        },
      },
    })
    expect(permissionUserOne).not.toBeNull()
    expect(permissionUserOne?.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(permissionUserOne?.directPermissionId).toBeNull()

    const permissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionUserTwo).not.toBeNull()
    expect(permissionUserTwo?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserTwo?.directPermissionId).toBe(groupPermission.id)

    const permissionUserThree = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC!.id,
          userId: userThree.id,
        },
      },
    })
    expect(permissionUserThree).not.toBeNull()
    expect(permissionUserThree?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserThree?.directPermissionId).toBe(groupPermission.id)

    const permissionUserFour = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC!.id,
          userId: userFour.id,
        },
      },
    })
    expect(permissionUserFour).not.toBeNull()
    expect(permissionUserFour?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserFour?.directPermissionId).toBe(groupPermission.id)

    // revoke the permission
    const deletedPermissionId = await revokeObjectAccess(
      {
        answerCollectionId: AC!.id,
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
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userOne.id,
          },
        },
      })
    expect(persistentPermissionUserOne).not.toBeNull()
    expect(persistentPermissionUserOne?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const deletedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(deletedPermissionUserTwo).toBeNull()

    const deletedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
        },
      })
    expect(deletedPermissionUserThree).toBeNull()

    const deletedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
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
        objectId: String(AC!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.ANSWER_COLLECTION} (ID ${AC!.id}) by owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Verify that direct permissions on the answer collection are loaded correctly', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // grant READ permissions to user 2
    const dbUserPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
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
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // fetch the direct permissions and make sure that they are correct
    const { permissions: directPermissions } =
      await getAnswerCollectionPermissions({ id: AC1!.id }, userOneCtx)
    expect(directPermissions).not.toBeNull()
    expect(directPermissions.length).toBe(2)

    const userPermission = directPermissions.find(
      (permission) => permission.userId === userTwo.id
    )
    const groupPermission = directPermissions.find(
      (permission) => permission.userGroupId === group.id
    )
    expect(userPermission).not.toBeNull()
    expect(groupPermission).not.toBeNull()
    expect(userPermission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(userPermission?.userId).toBe(userTwo.id)
    expect(userPermission?.permissionId).toBe(dbUserPermission.id)
    expect(groupPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupPermission?.userGroupId).toBe(group.id)
    expect(groupPermission?.permissionId).toBe(dbGroupPermission.id)
  })

  it('Verify that derived permissions on the answer collection are loaded correctly', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // seed derived READ, WRITE and ADMIN permissions for user 2, 3 and 4
    const permission1 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        derived: true,
      },
    })
    const permission2 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        answerCollectionId: AC1!.id,
        derived: true,
      },
    })
    const permission3 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC1!.id,
        derived: true,
      },
    })

    // derived permissions that are copies of direct permissions / resolved group permissions,
    // should not show up in the derived permissions query
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFive.id,
        answerCollectionId: AC1!.id,
        derived: false,
      },
    })

    // fetch the derived permissions and make sure that they are correct
    const derivedPermissions = await getDerivedAnswerCollectionPermissions(
      { id: AC1!.id },
      userOneCtx
    )
    expect(derivedPermissions).not.toBeNull()
    expect(derivedPermissions!.length).toBe(3)

    const permissionIds = derivedPermissions!.map((p) => p.permissionId)
    expect(permissionIds).toEqual(
      expect.arrayContaining([permission1.id, permission2.id, permission3.id])
    )

    const READPermission = derivedPermissions!.find(
      (permission) => permission.userId === userTwo.id
    )
    const WRITEPermission = derivedPermissions!.find(
      (permission) => permission.userId === userThree.id
    )
    const ADMINPermission = derivedPermissions!.find(
      (permission) => permission.userId === userFour.id
    )
    expect(READPermission).not.toBeNull()
    expect(WRITEPermission).not.toBeNull()
    expect(ADMINPermission).not.toBeNull()
    expect(READPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(READPermission!.userId).toBe(userTwo.id)
    expect(READPermission!.permissionId).toBe(permission1.id)
    expect(WRITEPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(WRITEPermission!.userId).toBe(userThree.id)
    expect(WRITEPermission!.permissionId).toBe(permission2.id)
    expect(ADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(ADMINPermission!.userId).toBe(userFour.id)
    expect(ADMINPermission!.permissionId).toBe(permission3.id)
  })

  it('Verify that an answer collection OWNER can transfer the corresponding rights', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // add direct admin permissions to user 4
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC1!.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // transfer ownership rights of first answer collection to other admin (user 4) and validate creation of own admin permission
    const dbPermission = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission).toBeTruthy()
    expect(dbPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const newPermission1 = await transferAnswerCollectionOwnership(
      {
        id: AC1!.id,
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
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    // verify that derived ownership and admin permissions have been created correctly
    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdminPermission!.userId).toBe(userOne.id)
    expect(derivedAdminPermission!.answerCollectionId).toBe(AC1!.id)

    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.userId).toBe(userFour.id)
    expect(derivedOwnerPermission!.answerCollectionId).toBe(AC1!.id)

    const updatedAnswerCollection = await prisma.answerCollection.findUnique({
      where: {
        id: AC1!.id,
      },
    })
    expect(updatedAnswerCollection).toBeTruthy()
    expect(updatedAnswerCollection!.ownerId).toBe(userFour.id)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.OWNER_TRANSFERRED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(AC1!.id),
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Ownership of ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) transferred from user ${userOne.id} to user ${userFour.id}.`
    )
  })

  it('Test the direct sharing functionality for answer collections with different permission levels and individual users', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

    // try sharing the object with a user that does not exist
    const res1 = await shareObject(
      {
        answerCollectionId: AC1!.id,
        shortnameOrEmail: 'nonExistingUser',
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    // grant READ, WRITE and ADMIN permissions to users 2, 3, and 4
    const permission1 = await shareObject(
      {
        answerCollectionId: AC1!.id,
        shortnameOrEmail: userTwo.email,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission1).toBeTruthy()
    expect(permission1!.userId).toBe(userTwo.id)
    expect(permission1!.username).toBe(userTwo.shortname)
    expect(permission1!.userEmail).toBe(userTwo.email)
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission1!.propagation).toBe(false)
    expect(permission1!.isOwn).toBe(false)

    const permission2 = await shareObject(
      {
        answerCollectionId: AC1!.id,
        shortnameOrEmail: userThree.email,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission2).toBeTruthy()
    expect(permission2!.userId).toBe(userThree.id)
    expect(permission2!.username).toBe(userThree.shortname)
    expect(permission2!.userEmail).toBe(userThree.email)
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permission2!.propagation).toBe(false)
    expect(permission2!.isOwn).toBe(false)

    const permission3 = await shareObject(
      {
        answerCollectionId: AC1!.id,
        shortnameOrEmail: userFour.email,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission3).toBeTruthy()
    expect(permission3!.userId).toBe(userFour.id)
    expect(permission3!.username).toBe(userFour.shortname)
    expect(permission3!.userEmail).toBe(userFour.email)
    expect(permission3!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(permission3!.propagation).toBe(false)
    expect(permission3!.isOwn).toBe(false)

    // verify that the correct direct and derived permission entries have been stored in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission1).toBeTruthy()
    expect(dbPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeTruthy()
    expect(dbPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission1).toBeTruthy()
    expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission2).toBeTruthy()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission3).toBeTruthy()
    expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )
  })

  it('Test the direct sharing functionality for answer collections with different permission levels and user groups', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
        answerCollectionId: AC1!.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(groupPermission).toBeTruthy()
    expect(groupPermission!.userGroupId).toBe(group.id)
    expect(groupPermission!.userGroupName).toBe(group.name)
    expect(groupPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupPermission!.propagation).toBe(false)

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
        answerCollectionId: AC1!.id,
        userGroupId: group2.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
      userOneCtx
    )
    expect(groupPermission2).toBeTruthy()
    expect(groupPermission2!.userGroupId).toBe(group2.id)
    expect(groupPermission2!.userGroupName).toBe(group2.name)
    expect(groupPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupPermission2!.propagation).toBe(false)

    // verify that the correct direct permissions have been created in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userGroupId: {
          answerCollectionId: AC1!.id,
          userGroupId: group.id,
        },
      },
    })
    expect(dbPermission1).not.toBeNull()
    expect(dbPermission1?.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        answerCollectionId_userGroupId: {
          answerCollectionId: AC1!.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(dbPermission2).not.toBeNull()
    expect(dbPermission2?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct derived permissions have been created in the database
    // OWNER for user 1, WRITE for user 2, ADMIN for users 3 and 4
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission1).not.toBeNull()
    expect(derivedPermission1?.permissionLevel).toBe(PermissionLevel.OWNER)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission2).not.toBeNull()
    expect(derivedPermission2?.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission3).not.toBeNull()
    expect(derivedPermission3?.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission4).not.toBeNull()
    expect(derivedPermission4?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} to user group ${group.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(AC1!.id),
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.ANSWER_COLLECTION} (ID ${AC1!.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )
  })
  // #endregion
})
