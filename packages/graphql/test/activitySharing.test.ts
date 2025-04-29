import {
  AuditLogType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma'
import { CatalogObjectType } from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  addObjectToCatalog,
  getCatalogLiveQuizTemplates,
  removeCatalogObjectAssignment,
  verifyCatalogObjectEditPermissions,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedCatalogCollections,
  seedLiveQuizTemplates,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests for sharing functionalities of activities (e.g. live quiz)', () => {
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

  // ! Catalog Operations with Live Quizzes (incl. Templates)
  // #region
  it('Verify that permissions on answer collection determine allowed actions when included in top-level catalog collection', async () => {
    const { activityId1 } = await seedLiveQuizTemplates(prisma)

    // grant READ, WRITE and ADMIN permissions on the live quiz template to users 2, 3, and 4
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          liveQuizId: activityId1,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          liveQuizId: activityId1,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFour.id,
          liveQuizId: activityId1,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId1 }, prisma)

    // assign the answer collection to the top-level catalog collection
    const assignment = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId1,
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

  it('Verify that correct live quiz templates are shown to the user as a selection to be added to the catalog collection', async () => {
    const { activityId1, activityId2, activityId3 } =
      await seedLiveQuizTemplates(prisma)

    // grant ADMIN permissions on the first activity to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activityId1,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId1 }, prisma)

    // grant READ permissions on the second activity to user 3
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activityId2,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId2 }, prisma)

    // verify that user 1 can add all live quiz templates to the catalog collection
    const avilableActivities1 = await getCatalogLiveQuizTemplates(userOneCtx)
    expect(avilableActivities1).toHaveLength(3)
    expect(avilableActivities1.map((a) => a.id).sort()).toEqual(
      [activityId1, activityId2, activityId3].sort()
    )

    // verify that user 2 can add only the first live quiz template to the catalog collection
    const avilableActivities2 = await getCatalogLiveQuizTemplates(userTwoCtx)
    expect(avilableActivities2).toHaveLength(1)
    expect(avilableActivities2[0]!.id).toEqual(activityId1)

    // verify that users 3 and 4 cannot add any live quiz templates to the catalog collection
    const avilableActivities3 = await getCatalogLiveQuizTemplates(userThreeCtx)
    expect(avilableActivities3).toHaveLength(0)
    const avilableActivities4 = await getCatalogLiveQuizTemplates(userFourCtx)
    expect(avilableActivities4).toHaveLength(0)
  })

  it('Test that live quiz templates can be added to a catalog collection by users with sufficient permissions', async () => {
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)
    const { activityId1, activityId2, templateId1, templateId2 } =
      await seedLiveQuizTemplates(prisma)

    // grand READ permissions on the first activity to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activityId1,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId1 }, prisma)

    // grand ADMIN permissions on the second activity to users 3 and 4
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activityId2,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activityId2,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId2 }, prisma)

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

    // verify that user 2 has insufficient permissions to add the first activity to the top-level catalog collection
    const res1 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId1,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()

    // verify that user 1 has sufficient permissions to add the first activity to the top-level catalog collection
    const res2 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId1,
        access: ObjectAccess.PUBLIC,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.uuid).toEqual(activityId1)
    expect(res2!.objectType).toEqual(CatalogObjectType.LIVE_QUIZ_TEMPLATE)
    expect(res2!.templateId).toEqual(templateId1)
    expect(res2!.access).toEqual(ObjectAccess.PUBLIC)
    expect(res2!.ownerShortname).toEqual(userOne.shortname)
    expect(res2!.isOwner).toBe(true)
    expect(res2!.isManager).toBe(true)
    expect(res2!.isRequested).toBe(false)
    expect(res2!.isShared).toBe(false)

    // verify that a proper catalog assignment was created
    const catalogAssignment1 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          liveQuizId_catalogCollectionId: {
            liveQuizId: activityId1,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment1).toBeTruthy()
    expect(catalogAssignment1!.access).toEqual(ObjectAccess.PUBLIC)

    // verify that an audit log entry was created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId1,
        sourceUserId: userOne.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId1}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userOne.id}.`
    )

    // verify that user 3 has sufficient permissions to add the second activity to the top-level catalog collection
    const res3 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId2,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(res3).toBeTruthy()
    expect(res3!.uuid).toEqual(activityId2)
    expect(res3!.objectType).toEqual(CatalogObjectType.LIVE_QUIZ_TEMPLATE)
    expect(res3!.templateId).toEqual(templateId2)
    expect(res3!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res3!.ownerShortname).toEqual(userOne.shortname)
    expect(res3!.isOwner).toBe(false)
    expect(res3!.isManager).toBe(true)
    expect(res3!.isRequested).toBe(false)
    expect(res3!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment2 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          liveQuizId_catalogCollectionId: {
            liveQuizId: activityId2,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment2).toBeTruthy()
    expect(catalogAssignment2!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userThree.id}.`
    )

    // verify that user 4 has sufficient permissions to add the second activity to the restricted catalog collection
    // -> >= WRITE permissions are required and satisfied
    const res5 = await addObjectToCatalog(
      {
        catalogCollectionId: restrictedCatalog.id,
        liveQuizId: activityId2,
        access: ObjectAccess.RESTRICTED,
      },
      userFourCtx
    )
    expect(res5).toBeTruthy()
    expect(res5!.uuid).toEqual(activityId2)
    expect(res5!.objectType).toEqual(CatalogObjectType.LIVE_QUIZ_TEMPLATE)
    expect(res5!.templateId).toEqual(templateId2)
    expect(res5!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res5!.ownerShortname).toEqual(userOne.shortname)
    expect(res5!.isOwner).toBe(false)
    expect(res5!.isManager).toBe(true)
    expect(res5!.isRequested).toBe(false)
    expect(res5!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment3 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          liveQuizId_catalogCollectionId: {
            liveQuizId: activityId2,
            catalogCollectionId: restrictedCatalog.id,
          },
        },
      })
    expect(catalogAssignment3).toBeTruthy()
    expect(catalogAssignment3!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) added to catalog collection (ID ${restrictedCatalog.id}) by user ${userFour.id}.`
    )
  })

  it('Test that objects can be removed from the catalog collections with appropriate permissions', async () => {
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)
    const {
      activityId1,
      activityId2,
      activityId3,
      templateId1,
      templateId2,
      templateId3,
    } = await seedLiveQuizTemplates(prisma)

    // grant READ permissions on the first activity to user 2 -> cannot revoke / do anything
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activityId1,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId1 }, prisma)

    // grant ADMIN permissions on the first activity to user 3 -> can remove it from top-level catalog
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activityId1,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId1 }, prisma)

    // grant ADMIN permissions on the second activity to user 4 -> cannot remove it from user-defined catalog collection
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activityId2,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activityId2 }, prisma)

    // grant WRITE permissions on the restricted catalog collection to user 5 -> can remove objects from the catalog collection
    await prisma.permission.create({
      data: {
        userId: userFive.id,
        catalogCollectionId: restrictedCatalog.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // add assignments for all three activities in the top-level catalog and the restricted catalog collection
    const assignment1 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId1,
      },
    })
    const assignment2 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId2,
      },
    })
    const assignment3 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        liveQuizId: activityId3,
      },
    })
    const assignment4 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: restrictedCatalog.id,
        liveQuizId: activityId1,
      },
    })
    const assignment5 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: restrictedCatalog.id,
        liveQuizId: activityId2,
      },
    })
    const assignment6 = await prisma.catalogCollectionAssignment.create({
      data: {
        catalogCollectionId: restrictedCatalog.id,
        liveQuizId: activityId3,
      },
    })

    // verify that user 2 cannot remove the first activity from the top-level catalog collection
    const res1 = await removeCatalogObjectAssignment(
      { assignmentId: assignment1.id },
      userTwoCtx
    )
    expect(res1).toBe(false)

    const assignment1Persistent =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment1.id,
        },
      })
    expect(assignment1Persistent).toBeTruthy()

    // verify that user 3 can remove the first activity from the top-level catalog collection (ADMIN object permissions)
    const res2 = await removeCatalogObjectAssignment(
      { assignmentId: assignment1.id },
      userThreeCtx
    )
    expect(res2).toBe(true)

    const assignment1Removed =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment1.id,
        },
      })
    expect(assignment1Removed).toBeNull()

    // verify that an audit log entry was created for the removal of the object from the catalog collection
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId1,
        sourceUserId: userThree.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId1}) removed from catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userThree.id}.`
    )

    // verify that user 1 can remove the second activity from the top-level catalog collection (OWNER)
    const res3 = await removeCatalogObjectAssignment(
      { assignmentId: assignment2.id },
      userOneCtx
    )
    expect(res3).toBe(true)

    const assignment2Removed =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment2.id,
        },
      })
    expect(assignment2Removed).toBeNull()

    // verify that an audit log entry was created for the removal of the object from the catalog collection
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userOne.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) removed from catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userOne.id}.`
    )

    // verify that user 1 can remove the first activity from the restricted catalog collection (OWNER on both)
    const res4 = await removeCatalogObjectAssignment(
      { assignmentId: assignment4.id },
      userOneCtx
    )
    expect(res4).toBe(true)

    const assignment4Removed =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment4.id,
        },
      })
    expect(assignment4Removed).toBeNull()

    // verify that an audit log entry was created for the removal of the object from the catalog collection
    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId1,
        sourceUserId: userOne.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId1}) removed from catalog collection (ID ${restrictedCatalog.id}) by user ${userOne.id}.`
    )

    // verify that user 4 cannot remove the second activity from the restricted catalog collection (ADMIN object permissions)
    const res5 = await removeCatalogObjectAssignment(
      { assignmentId: assignment5.id },
      userFourCtx
    )
    expect(res5).toBe(false)

    const assignment5Persistent =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment5.id,
        },
      })
    expect(assignment5Persistent).toBeTruthy()

    // verify that user 5 can remove the second activity from the restricted catalog collection (WRITE catalog permissions)
    const res6 = await removeCatalogObjectAssignment(
      { assignmentId: assignment5.id },
      userFiveCtx
    )
    expect(res6).toBe(true)

    const assignment5Removed =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          id: assignment5.id,
        },
      })
    expect(assignment5Removed).toBeNull()

    // verify that an audit log entry was created for the removal of the object from the catalog collection
    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) removed from catalog collection (ID ${restrictedCatalog.id}) by user ${userFive.id}.`
    )
  })
  // #endregion

  // ! Sharing Operations for Live Quizzes (incl. Templates)
  // #region
  // TODO: add most important functions and functions specific to live quizzes / live quiz templates here
  // TODO: make sure to cover the case where the live quiz is assigned to a course and a user with permissions >= WRITE wants to access it, that the course is available (independent of actual access on course) (getActiveUserCourses)
  // #endregion

  // ! Sharing Operations for Practice Quizzes (reduced - due to shared logic with live quizzes)
  // #region
  // TODO: add most important functions and functions specific to practice quizzes here
  // TODO: make sure to cover the case where the practice quiz is assigned to a course and a user with permissions >= WRITE wants to access it, that the course is available (independent of actual access on course) (getActiveUserCourses)
  // #endregion

  // ! Sharing Operations for Microlearnings (reduced - due to shared logic with live quizzes)
  // #region
  // TODO: add most important functions and functions specific to microlearnings here
  // TODO: make sure to cover the case where the microlearning is assigned to a course and a user with permissions >= WRITE wants to access it, that the course is available (independent of actual access on course) (getActiveUserCourses)
  // #endregion

  // ! Sharing Operations for Group Activities (reduced - due to shared logic with live quizzes)
  // #region
  // TODO: add most important functions and functions specific to group activities here
  // TODO: make sure to cover the case where the group activity is assigned to a course and a user with permissions >= WRITE wants to access it, that the course is available (independent of actual access on course) (getActiveUserCourses)

  // #endregion
})
