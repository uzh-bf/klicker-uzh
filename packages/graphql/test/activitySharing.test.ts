import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AuditLogType,
  ElementType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { getActiveUserCourses } from '../src/services/courses.js'
import { removeGroupActivity } from '../src/services/groups.js'
import {
  getUserRunningLiveQuizzes,
  removeLiveQuiz,
} from '../src/services/liveQuizzes.js'
import { removeMicroLearning } from '../src/services/microLearning.js'
import { removePracticeQuiz } from '../src/services/practiceQuizzes.js'
import {
  addObjectToCatalog,
  changeObjectPermissionLevel,
  getCatalogLiveQuizTemplates,
  getGroupActivityPermissions,
  getLiveQuizPermissions,
  getMicroLearningPermissions,
  getPracticeQuizPermissions,
  removeCatalogObjectAssignment,
  revokeObjectAccess,
  shareObject,
  transferGroupActivityOwnership,
  transferLiveQuizOwnership,
  transferMicroLearningOwnership,
  transferPracticeQuizOwnership,
  verifyCatalogObjectEditPermissions,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCatalogCollections,
  seedCourse,
  seedElements,
  seedGroupActivity,
  seedLiveQuiz,
  seedLiveQuizTemplates,
  seedMicroLearning,
  seedPracticeQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for sharing functionalities of activities (e.g. live quiz)', () => {
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
    expect(res2!.objectUuid).toEqual(activityId1)
    expect(res2!.objectType).toEqual(ObjectType.LIVE_QUIZ)
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
    expect(res3!.objectUuid).toEqual(activityId2)
    expect(res3!.objectType).toEqual(ObjectType.LIVE_QUIZ)
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
    expect(res5!.objectUuid).toEqual(activityId2)
    expect(res5!.objectType).toEqual(ObjectType.LIVE_QUIZ)
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
    const auditLogEntry3 = await prisma.auditLogEntry.findFirstOrThrow({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userFour.id,
      },
      orderBy: { id: 'desc' },
    })
    expect(auditLogEntry3.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) added to catalog collection (ID ${restrictedCatalog.id}) by user ${userFour.id}.`
    )
  })

  it('Test that objects can be removed from the catalog collections with appropriate permissions', async () => {
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)
    const { activityId1, activityId2, activityId3 } =
      await seedLiveQuizTemplates(prisma)

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
    await prisma.catalogCollectionAssignment.create({
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
    await prisma.catalogCollectionAssignment.create({
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
    const auditLogEntry3 = await prisma.auditLogEntry.findFirstOrThrow({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId1,
        sourceUserId: userOne.id,
      },
      orderBy: { id: 'desc' },
    })
    expect(auditLogEntry3.message).toBe(
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
    const auditLogEntry4 = await prisma.auditLogEntry.findFirstOrThrow({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: activityId2,
        sourceUserId: userFive.id,
      },
      orderBy: { id: 'desc' },
    })
    expect(auditLogEntry4.message).toBe(
      `${ObjectType.LIVE_QUIZ} (ID ${activityId2}) removed from catalog collection (ID ${restrictedCatalog.id}) by user ${userFive.id}.`
    )
  })
  // #endregion

  // ! Sharing Operations for Live Quizzes (incl. Templates)
  // #region
  it('Test that live quizzes can be shared with individual users through the corresponding service function (without propagation)', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // directly share the live quiz with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions
    await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        shortnameOrEmail: userThree.shortname,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userFour.email,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userFive.email,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )

    // verify that the correct direct permissions were created
    const directReadPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)

    const directExecutePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directWritePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directAdminPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the live quiz
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(derivedReadPermission!.derived).toBe(false)

    const derivedExecutePermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedExecutePermission).toBeTruthy()
    expect(derivedExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedExecutePermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(derivedExecutePermission!.derived).toBe(false)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(derivedWritePermission!.derived).toBe(false)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(derivedAdminPermission!.derived).toBe(false)

    // verify that for users with ADMIN permissions, derived ADMIN permissions were created on the contained elements
    const noReadElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(noReadElementPermission).toBeNull()

    const noExecuteElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(noExecuteElementPermission).toBeNull()

    const noWriteElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFour.id,
        },
      },
    })
    expect(noWriteElementPermission).toBeNull()

    const adminElementPermissions = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminElementPermissions).toBeTruthy()
    expect(adminElementPermissions!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(adminElementPermissions!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminElementPermissions!.derived).toBe(true)

    // verify that for the user with derived ADMIN permissions, corresponding permissions have also been created on the answer collection
    const noReadAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(noReadAnswerCollectionPermission).toBeNull()

    const noExecuteAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(noExecuteAnswerCollectionPermission).toBeNull()

    const noWriteAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(noWriteAnswerCollectionPermission).toBeNull()

    const adminAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(adminAnswerCollectionPermission).toBeTruthy()
    expect(adminAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(adminAnswerCollectionPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminAnswerCollectionPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  })

  it('Test that live quizzes can be shared with groups through the corresponding service function (without propagation)', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create user groups with users 1 and 2, 2 and 3, 4, and 4 and 5 respectively
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        members: {
          connect: [{ id: userFour.id }, { id: userOne.id }],
        },
      },
    })

    // directly share the live quiz with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions
    const res1 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const res2 = await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        userGroupId: group2.id,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const res3 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group3.id,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group4.id,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    // verify that the correct direct permissions were created
    const directGroupReadPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(directGroupReadPermission).toBeTruthy()
    expect(directGroupReadPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const directGroupExecutePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(directGroupExecutePermission).toBeTruthy()
    expect(directGroupExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directGroupWritePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(directGroupWritePermission).toBeTruthy()
    expect(directGroupWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directGroupAdminPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(directGroupAdminPermission).toBeTruthy()
    expect(directGroupAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the live quiz
    // OWNER (user 1), ADMIN (users 4 and 5), WRITE (user 2), EXECUTE (user 3)
    const derivedLQPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedLQPermissionUserOne).toBeTruthy()
    expect(derivedLQPermissionUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedLQPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedLQPermissionUserOne!.derived).toBe(false)

    const derivedLQPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedLQPermissionUserTwo).toBeTruthy()
    expect(derivedLQPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedLQPermissionUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedLQPermissionUserTwo!.derived).toBe(false)

    const derivedLQPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedLQPermissionUserThree).toBeTruthy()
    expect(derivedLQPermissionUserThree!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedLQPermissionUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedLQPermissionUserThree!.derived).toBe(false)

    const derivedLQPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedLQPermissionUserFour).toBeTruthy()
    expect(derivedLQPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFour!.derived).toBe(false)

    const derivedLQPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedLQPermissionUserFive).toBeTruthy()
    expect(derivedLQPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFive!.derived).toBe(false)

    // verify that derived ADMIN permissions were created for the admin users of the activity
    const derivedElementPermissionsUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedElementPermissionsUserOne).toBeTruthy()
    expect(derivedElementPermissionsUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermissionsUserOne!.directPermissionId).toBeNull()
    expect(derivedElementPermissionsUserOne!.derived).toBe(false)

    const derivedElementPermissionsUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFour).toBeTruthy()
    expect(derivedElementPermissionsUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFour!.derived).toBe(true)

    const derivedElementPermissionsUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFive).toBeTruthy()
    expect(derivedElementPermissionsUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFive!.derived).toBe(true)

    // verify that derived permissions on the live quiz were created for the admin users on the element
    const derivedACPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedACPermissionUserFour).toBeTruthy()
    expect(derivedACPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFour!.derived).toBe(true)

    const derivedACPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedACPermissionUserFive).toBeTruthy()
    expect(derivedACPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFive!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  })

  it('Test that live quizzes can be shared with individual users through the corresponding service function (with propagation)', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // directly share the live quiz with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions
    await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        shortnameOrEmail: userThree.shortname,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userFour.email,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userFive.email,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )

    // verify that the correct direct permissions were created
    const directReadPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)

    const directExecutePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directWritePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directAdminPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the live quiz
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(derivedReadPermission!.derived).toBe(false)

    const derivedExecutePermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedExecutePermission).toBeTruthy()
    expect(derivedExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedExecutePermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(derivedExecutePermission!.derived).toBe(false)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(derivedWritePermission!.derived).toBe(false)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(derivedAdminPermission!.derived).toBe(false)

    // verify that for all users the correct derived permissions were created on the contained elements
    // READ -> READ, EXECUTE -> READ, WRITE -> WRITE, ADMIN -> ADMIN, OWNER -> ADMIN
    const readElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readElementPermission).toBeTruthy()
    expect(readElementPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(readElementPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(readElementPermission!.derived).toBe(true)

    const executeElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(executeElementPermission).toBeTruthy()
    expect(executeElementPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(executeElementPermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(executeElementPermission!.derived).toBe(true)

    const writeElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFour.id,
        },
      },
    })
    expect(writeElementPermission).toBeTruthy()
    expect(writeElementPermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(writeElementPermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(writeElementPermission!.derived).toBe(true)

    const adminElementPermissions = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminElementPermissions).toBeTruthy()
    expect(adminElementPermissions!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(adminElementPermissions!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminElementPermissions!.derived).toBe(true)

    // verify that all users also received derived permissions on the answer collection
    const readAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readAnswerCollectionPermission).toBeTruthy()
    expect(readAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(readAnswerCollectionPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(readAnswerCollectionPermission!.derived).toBe(true)

    const executeAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(executeAnswerCollectionPermission).toBeTruthy()
    expect(executeAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(executeAnswerCollectionPermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(executeAnswerCollectionPermission!.derived).toBe(true)

    const writeAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(writeAnswerCollectionPermission).toBeTruthy()
    expect(writeAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(writeAnswerCollectionPermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(writeAnswerCollectionPermission!.derived).toBe(true)

    const adminAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(adminAnswerCollectionPermission).toBeTruthy()
    expect(adminAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(adminAnswerCollectionPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminAnswerCollectionPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  })

  it('Test that live quizzes can be shared with groups through the corresponding service function (with propagation)', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create user groups with users 1 and 2, 2 and 3, 4, and 4 and 5 respectively
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        members: {
          connect: [{ id: userFour.id }, { id: userOne.id }],
        },
      },
    })

    // directly share the live quiz with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions
    const res1 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const res2 = await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        userGroupId: group2.id,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const res3 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group3.id,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group4.id,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    // verify that the correct direct permissions were created
    const directGroupReadPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(directGroupReadPermission).toBeTruthy()
    expect(directGroupReadPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const directGroupExecutePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(directGroupExecutePermission).toBeTruthy()
    expect(directGroupExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directGroupWritePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(directGroupWritePermission).toBeTruthy()
    expect(directGroupWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directGroupAdminPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userGroupId: {
          liveQuizId: liveQuiz.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(directGroupAdminPermission).toBeTruthy()
    expect(directGroupAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the live quiz
    // OWNER (user 1), ADMIN (users 4 and 5), WRITE (user 2), EXECUTE (user 3)
    const derivedLQPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedLQPermissionUserOne).toBeTruthy()
    expect(derivedLQPermissionUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedLQPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedLQPermissionUserOne!.derived).toBe(false)

    const derivedLQPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedLQPermissionUserTwo).toBeTruthy()
    expect(derivedLQPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedLQPermissionUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedLQPermissionUserTwo!.derived).toBe(false)

    const derivedLQPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedLQPermissionUserThree).toBeTruthy()
    expect(derivedLQPermissionUserThree!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedLQPermissionUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedLQPermissionUserThree!.derived).toBe(false)

    const derivedLQPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedLQPermissionUserFour).toBeTruthy()
    expect(derivedLQPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFour!.derived).toBe(false)

    const derivedLQPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedLQPermissionUserFive).toBeTruthy()
    expect(derivedLQPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFive!.derived).toBe(false)

    // verify that derived permissions on the live quiz were created for the admin users on the element
    // user 1: activity OWNER -> element ADMIN
    // user 2: activity WRITE -> element WRITE
    // user 3: activity EXECUTE -> element READ
    // user 4: activity ADMIN -> element ADMIN
    // user 5: activity ADMIN -> element ADMIN
    const derivedElementPermissionsUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedElementPermissionsUserOne).toBeTruthy()
    expect(derivedElementPermissionsUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermissionsUserOne!.directPermissionId).toBeNull()
    expect(derivedElementPermissionsUserOne!.derived).toBe(false)

    const derivedElementPermissionsUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedElementPermissionsUserTwo).toBeTruthy()
    expect(derivedElementPermissionsUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedElementPermissionsUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedElementPermissionsUserTwo!.derived).toBe(true)

    const derivedElementPermissionsUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedElementPermissionsUserThree).toBeTruthy()
    expect(derivedElementPermissionsUserThree!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedElementPermissionsUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedElementPermissionsUserThree!.derived).toBe(true)

    const derivedElementPermissionsUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFour).toBeTruthy()
    expect(derivedElementPermissionsUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFour!.derived).toBe(true)

    const derivedElementPermissionsUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFive).toBeTruthy()
    expect(derivedElementPermissionsUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFive!.derived).toBe(true)

    // verify that all users also received derived permissions on the answer collection
    for (const user of [userTwo, userThree, userFour, userFive]) {
      const derivedAnswerCollectionPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC.id,
              userId: user.id,
            },
          },
        })
      expect(derivedAnswerCollectionPermission).toBeTruthy()
      expect(derivedAnswerCollectionPermission!.permissionLevel).toEqual(
        PermissionLevel.READ
      )
      expect(derivedAnswerCollectionPermission!.derived).toBe(true)
    }

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: liveQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.LIVE_QUIZ} (ID ${liveQuiz.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  })

  it('Verify that access requests are correctly duplicated on live quizzes and dependent elements when shared with individual ADMIN permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create an access request for user 2 on the live quiz, elements, and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    // share the live quiz with user 3 with admin permissions
    const res = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userThree.email,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that the access requests on the live quiz and elements were duplicated (not on the answer collection)
    const accessRequestCountAfter = await prisma.accessRequest.count()
    expect(accessRequestCountAfter).toBe(7)

    const accessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz).toBeTruthy()
    expect(accessRequestLiveQuiz!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestElement1 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement1).toBeTruthy()
    expect(accessRequestElement1!.permissionLevel).toEqual(PermissionLevel.READ)

    const accessRequestElement2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement2).toBeTruthy()
    expect(accessRequestElement2!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
  })

  it('Verify that access requests are correctly duplicated on live quizzes and dependent elements when shared with group ADMIN permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create an access request for user 2 on the live quiz, elements, and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userTwo.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    // create a group with users 3 and 4
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        admins: { connect: [{ id: userThree.id }] },
        members: { connect: [{ id: userFour.id }] },
      },
    })

    // share the live quiz with group 1 with admin permissions
    const res = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that the access requests on the live quiz and element were duplicated (not on the answer collection)
    const accessRequestCountAfter = await prisma.accessRequest.count()
    expect(accessRequestCountAfter).toBe(10)

    const accessRequestLiveQuiz1 = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz1).toBeTruthy()
    expect(accessRequestLiveQuiz1!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    const accessRequestLiveQuiz2 = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequestLiveQuiz2).toBeTruthy()
    expect(accessRequestLiveQuiz2!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestElement1 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement1).toBeTruthy()
    expect(accessRequestElement1!.permissionLevel).toEqual(PermissionLevel.READ)
    const accessRequestElement2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequestElement2).toBeTruthy()
    expect(accessRequestElement2!.permissionLevel).toEqual(PermissionLevel.READ)

    const accessRequestElement3 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement3).toBeTruthy()
    expect(accessRequestElement3!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    const accessRequestElement4 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequestElement4).toBeTruthy()
    expect(accessRequestElement4!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
  })

  it('Test the getter function for live quiz permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create 4 user groups with the individual users 2, 3, 4, and 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // granted READ, EXECUTE, WRITE, and ADMIN permissions to the individual users and the user groups
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userGroupId: userGroup1.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userGroupId: userGroup2.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userGroupId: userGroup3.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userGroupId: userGroup4.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // call the getter function
    const { permissions } = await getLiveQuizPermissions(
      { id: liveQuiz.id },
      userTwoCtx
    )
    expect(permissions).toBeTruthy()
    expect(permissions).toHaveLength(8)

    const directReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ && p.userId === userTwo.id
    )
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.isOwn).toBe(true)
    expect(directReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(directReadPermission!.username).toBe(userTwo.shortname)
    expect(directReadPermission!.userGroupId).not.toBeDefined()
    expect(directReadPermission!.userGroupName).not.toBeDefined()

    const directExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userId === userThree.id
    )
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.isOwn).toBeFalsy()
    expect(directExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(directExecutePermission!.username).toBe(userThree.shortname)
    expect(directExecutePermission!.userGroupId).not.toBeDefined()
    expect(directExecutePermission!.userGroupName).not.toBeDefined()

    const directWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE && p.userId === userFour.id
    )
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.isOwn).toBe(false)
    expect(directWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(directWritePermission!.username).toBe(userFour.shortname)
    expect(directWritePermission!.userGroupId).not.toBeDefined()
    expect(directWritePermission!.userGroupName).not.toBeDefined()

    const directAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN && p.userId === userFive.id
    )
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.isOwn).toBe(false)
    expect(directAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(directAdminPermission!.username).toBe(userFive.shortname)
    expect(directAdminPermission!.userGroupId).not.toBeDefined()
    expect(directAdminPermission!.userGroupName).not.toBeDefined()

    const groupReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ &&
        p.userGroupId === userGroup1.id
    )
    expect(groupReadPermission).toBeTruthy()
    expect(groupReadPermission!.isOwn).toBe(false)
    expect(groupReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(groupReadPermission!.userId).not.toBeDefined()
    expect(groupReadPermission!.username).not.toBeDefined()
    expect(groupReadPermission!.userGroupName).toBe(userGroup1.name)

    const groupExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userGroupId === userGroup2.id
    )
    expect(groupExecutePermission).toBeTruthy()
    expect(groupExecutePermission!.isOwn).toBe(false)
    expect(groupExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupExecutePermission!.userId).not.toBeDefined()
    expect(groupExecutePermission!.username).not.toBeDefined()
    expect(groupExecutePermission!.userGroupName).toBe(userGroup2.name)

    const groupWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE &&
        p.userGroupId === userGroup3.id
    )
    expect(groupWritePermission).toBeTruthy()
    expect(groupWritePermission!.isOwn).toBe(false)
    expect(groupWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupWritePermission!.userId).not.toBeDefined()
    expect(groupWritePermission!.username).not.toBeDefined()
    expect(groupWritePermission!.userGroupName).toBe(userGroup3.name)

    const groupAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN &&
        p.userGroupId === userGroup4.id
    )
    expect(groupAdminPermission).toBeTruthy()
    expect(groupAdminPermission!.isOwn).toBe(false)
    expect(groupAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupAdminPermission!.userId).not.toBeDefined()
    expect(groupAdminPermission!.username).not.toBeDefined()
    expect(groupAdminPermission!.userGroupName).toBe(userGroup4.name)
  })

  it('Verify that running live quiz is returned for all users with at least execution permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )

    // granted READ, EXECUTE, WRITE, and ADMIN permissions to the individual users
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // call the getter function
    const runningQuizzesUserTwo = await getUserRunningLiveQuizzes(userTwoCtx)
    expect(runningQuizzesUserTwo).toBeTruthy()
    expect(runningQuizzesUserTwo).toHaveLength(0)

    const runningQuizzesUserThree =
      await getUserRunningLiveQuizzes(userThreeCtx)
    expect(runningQuizzesUserThree).toBeTruthy()
    expect(runningQuizzesUserThree).toHaveLength(1)
    expect(runningQuizzesUserThree[0]!.id).toEqual(liveQuiz.id)
    expect(runningQuizzesUserThree[0]!.name).toEqual(liveQuiz.name)

    const runningQuizzesUserFour = await getUserRunningLiveQuizzes(userFourCtx)
    expect(runningQuizzesUserFour).toBeTruthy()
    expect(runningQuizzesUserFour).toHaveLength(1)
    expect(runningQuizzesUserFour[0]!.id).toEqual(liveQuiz.id)
    expect(runningQuizzesUserFour[0]!.name).toEqual(liveQuiz.name)

    const runningQuizzesUserFive = await getUserRunningLiveQuizzes(userFiveCtx)
    expect(runningQuizzesUserFive).toBeTruthy()
    expect(runningQuizzesUserFive).toHaveLength(1)
    expect(runningQuizzesUserFive[0]!.id).toEqual(liveQuiz.id)
    expect(runningQuizzesUserFive[0]!.name).toEqual(liveQuiz.name)
  })

  it('Verify that the level of an individual live quiz permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ permissions to user 2 (without propagation)
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userTwo.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    const readPermissionsAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionsAnswerCollection).toBeNull()

    // enable propagation
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.READ,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const readPermissionActivityPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionActivityPropagated).toBeTruthy()
    expect(readPermissionActivityPropagated!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readElementPermissionPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readElementPermissionPropagated).toBeTruthy()
    expect(readElementPermissionPropagated!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(readElementPermissionPropagated!.directPermissionId).toBe(
      directPermission!.id
    )
    expect(readElementPermissionPropagated!.derived).toBe(true)

    const readAnswerCollectionPermissionPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readAnswerCollectionPermissionPropagated).toBeTruthy()
    expect(readAnswerCollectionPermissionPropagated!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(readAnswerCollectionPermissionPropagated!.directPermissionId).toBe(
      directPermission!.id
    )
    expect(readAnswerCollectionPermissionPropagated!.derived).toBe(true)

    // change the permission level to EXECUTE (with propagation)
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const executePermissionActivityPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executePermissionActivityPropagated).toBeTruthy()
    expect(executePermissionActivityPropagated!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executeElementPermissionPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executeElementPermissionPropagated).toBeTruthy()
    expect(executeElementPermissionPropagated!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(executeElementPermissionPropagated!.directPermissionId).toBe(
      directPermission!.id
    )
    expect(executeElementPermissionPropagated!.derived).toBe(true)

    const executeAnswerCollectionPermissionPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executeAnswerCollectionPermissionPropagated).toBeTruthy()
    expect(
      executeAnswerCollectionPermissionPropagated!.permissionLevel
    ).toEqual(PermissionLevel.READ)
    expect(
      executeAnswerCollectionPermissionPropagated!.directPermissionId
    ).toBe(directPermission!.id)
    expect(executeAnswerCollectionPermissionPropagated!.derived).toBe(true)

    // disable propagation
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    const executePermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executePermissionAnswerCollection).toBeNull()

    // change the permission level to WRITE (without propagation)
    const res4 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    const writePermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionAnswerCollection).toBeNull()

    // enable propagation
    const res5 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        liveQuizId: liveQuiz.id,
        propagation: true,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()

    const writePermissionActivityPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionActivityPropagated).toBeTruthy()
    expect(writePermissionActivityPropagated!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElementPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionElementPropagated).toBeTruthy()
    expect(writePermissionElementPropagated!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(writePermissionElementPropagated!.directPermissionId).toBe(
      directPermission!.id
    )
    expect(writePermissionElementPropagated!.derived).toBe(true)

    const writePermissionAnswerCollectionPropagated =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionAnswerCollectionPropagated).toBeTruthy()
    expect(writePermissionAnswerCollectionPropagated!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(writePermissionAnswerCollectionPropagated!.directPermissionId).toBe(
      directPermission!.id
    )
    expect(writePermissionAnswerCollectionPropagated!.derived).toBe(true)

    // change the permission level to ADMIN (without propagation)
    const res6 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()

    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement2).toBeTruthy()
    expect(adminPermissionElement2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionAnswerCollection).toBeTruthy()
    expect(adminPermissionAnswerCollection!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
  })

  it('Verify that the level of a group live quiz permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create a group with users 2 and 3
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant READ permissions to the group
    const directGroupReadPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // update the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // update the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // update the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
  })

  it('Verify that access requests are correctly duplicated when individual permission is changed to admin level', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      { elements: [{ id: SC.id, type: ElementType.SC }] },
      userOneCtx
    )

    // create an access request for user 2 on the live quiz, elements, and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(3)

    // grant READ permissions to user 3 on the live quiz
    const directPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userThree.id },
      prisma
    )

    // verify that user 3 only has permissions on the live quiz and not on the elements
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // verify that the number of access requests is unchanged
    const accessRequestCountAfter = await prisma.accessRequest.count()
    expect(accessRequestCountAfter).toBe(3)

    // change the permission level to ADMIN
    const res = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that the access requests on the live quiz and elements were duplicated (not on the answer collection)
    const accessRequestCountAfter2 = await prisma.accessRequest.count()
    expect(accessRequestCountAfter2).toBe(5)

    const accessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz).toBeTruthy()
    expect(accessRequestLiveQuiz!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestElement = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement).toBeTruthy()
    expect(accessRequestElement!.permissionLevel).toEqual(PermissionLevel.READ)
  })

  it('Verify that access requests are correctly duplicated when group permission is changed to admin level', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      { elements: [{ id: SC.id, type: ElementType.SC }] },
      userOneCtx
    )

    // create a group with users 2 and 3
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // create an access request for user 4 on the live quiz, elements, and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(3)

    // grant READ permissions to the group
    const directGroupReadPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // verify that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // verify that the number of access requests is unchanged
    const accessRequestCountAfter = await prisma.accessRequest.count()
    expect(accessRequestCountAfter).toBe(3)

    // change the permission level to ADMIN
    const res = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        liveQuizId: liveQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that the access requests on the live quiz and elements were duplicated (not on the answer collection)
    const accessRequestCountAfter2 = await prisma.accessRequest.count()
    expect(accessRequestCountAfter2).toBe(7)

    const accessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz).toBeTruthy()
    expect(accessRequestLiveQuiz!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestLiveQuiz2 = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(accessRequestLiveQuiz2).toBeTruthy()
    expect(accessRequestLiveQuiz2!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestElement = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestElement).toBeTruthy()
    expect(accessRequestElement!.permissionLevel).toEqual(PermissionLevel.READ)

    const accessRequestElement2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(accessRequestElement2).toBeTruthy()
    expect(accessRequestElement2!.permissionLevel).toEqual(PermissionLevel.READ)
  })

  it('Verify that the ownership transfer function for live quizzes works correctly', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      { elements: [{ id: SE.id, type: ElementType.SELECTION }] },
      userOneCtx
    )

    // grant direct ADMIN permissions to user 2 on the live quiz and the anwer collection
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userTwo.id },
      prisma
    )

    // create an access request for user 4 on the live quiz, elements and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        liveQuizId: liveQuiz.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(5)

    // transfer ownership to user 2
    const res = await transferLiveQuizOwnership(
      { id: liveQuiz.id, shortnameOrEmail: userTwo.shortname },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that user 2 is the new owner and its admin permission was removed
    const liveQuiz2 = await prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
      select: { ownerId: true },
    })
    expect(liveQuiz2).toBeTruthy()
    expect(liveQuiz2!.ownerId).toEqual(userTwo.id)

    const removedDirectPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          userId: userTwo.id,
          liveQuizId: liveQuiz.id,
        },
      },
    })
    expect(removedDirectPermission).toBeNull()

    // verify that a new admin permission was granted to user 1
    const newDirectPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          userId: userOne.id,
          liveQuizId: liveQuiz.id,
        },
      },
    })
    expect(newDirectPermission).toBeTruthy()
    expect(newDirectPermission!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    // verify that the access requests have not changed
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(5)

    // transfer the ownership to user 3
    const res2 = await transferLiveQuizOwnership(
      { id: liveQuiz.id, shortnameOrEmail: userThree.shortname },
      userTwoCtx
    )
    expect(res2).toBeTruthy()

    // verify that user 3 is the new owner
    const liveQuiz3 = await prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
      select: { ownerId: true },
    })
    expect(liveQuiz3).toBeTruthy()
    expect(liveQuiz3!.ownerId).toEqual(userThree.id)

    // verify that user 2 is no longer the owner, but got another admin permission
    const grantedAdminPermissionUserTwo = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          userId: userTwo.id,
          liveQuizId: liveQuiz.id,
        },
      },
    })
    expect(grantedAdminPermissionUserTwo).toBeTruthy()
    expect(grantedAdminPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the access requests for the activity and the element were duplicated for the new owner
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(7)
    const accessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz).toBeTruthy()
    expect(accessRequestLiveQuiz!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestLiveQuiz2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestLiveQuiz2).toBeTruthy()
    expect(accessRequestLiveQuiz2!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const accessRequestAnswerCollection = await prisma.accessRequest.findUnique(
      {
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
            objectAdminOrOwnerId: userThree.id,
          },
        },
      }
    )
    expect(accessRequestAnswerCollection).toBeNull()
  })

  it('Verify that individual and group permissions can be revoked on live quizzes', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userTwo.id },
      prisma
    )

    // create a user group with users 3 and 4
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant ADMIN permissions to the group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    const adminActivityPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminActivityPermission).toBeTruthy()
    expect(adminActivityPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission).toBeTruthy()
    expect(adminElementPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission2).toBeTruthy()
    expect(adminElementPermission2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const readAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(readAnswerCollectionPermission).toBeTruthy()
    expect(readAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    // revoke both direct permissions
    await revokeObjectAccess(
      {
        permissionId: directPermission!.id,
        liveQuizId: liveQuiz.id,
      },
      userOneCtx
    )
    await revokeObjectAccess(
      {
        permissionId: groupPermission!.id,
        liveQuizId: liveQuiz.id,
      },
      userOneCtx
    )

    // check that the derived permissions were removed correctly
    const readPermissionActivityAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionActivityAfter).toBeNull()

    const readPermissionElementAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionElementAfter).toBeNull()

    const adminActivityPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminActivityPermissionAfter).toBeNull()

    const adminElementPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermissionAfter).toBeNull()

    const adminElementPermission2After =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermission2After).toBeNull()

    const adminAnswerCollectionPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminAnswerCollectionPermissionAfter).toBeNull()
  })

  it('Verify that courses linked to a live quiz are also returned during editing for users with sufficient permissions', async () => {
    // create two courses owned by user 1 and 2 respectively
    const course1 = await prisma.course.create({
      data: {
        name: 'Course 1',
        displayName: 'Course 1',
        description: 'Test Description',
        pinCode: 1234,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week in the past
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week in the future
        groupDeadlineDate: new Date(), // now
        ownerId: userOne.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course1.id }, prisma)

    const course2 = await prisma.course.create({
      data: {
        name: 'Course 2',
        displayName: 'Course 2',
        description: 'Test Description',
        pinCode: 5678,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userTwo.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course2.id }, prisma)

    const course3 = await prisma.course.create({
      data: {
        name: 'Course 3',
        displayName: 'Course 3',
        description: 'Test Description',
        pinCode: 91011,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userThree.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course3.id }, prisma)

    const course4 = await prisma.course.create({
      data: {
        name: 'Course 4',
        displayName: 'Course 4',
        description: 'Test Description',
        pinCode: 121314,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFour.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course4.id }, prisma)

    const course5 = await prisma.course.create({
      data: {
        name: 'Course 5',
        displayName: 'Course 5',
        description: 'Test Description',
        pinCode: 151617,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFive.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course5.id }, prisma)

    // create a live quiz that is linked to course 1
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { courseId: course1.id },
    })

    // grant READ, EXECUTE, WRITE, and ADMIN permissions to users 2, 3, 4, and 5 on the activity
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)

    // verify that users with >= WRITE permissions can also see the linked course during editing
    const userOneCourses = await getActiveUserCourses(
      { activityId: liveQuiz.id, activityType: ActivityType.LIVE_QUIZ },
      userOneCtx
    )
    expect(userOneCourses).toBeTruthy()
    expect(userOneCourses).toHaveLength(1)
    expect(userOneCourses[0]!.id).toEqual(course1.id)

    const userTwoCourses = await getActiveUserCourses(
      { activityId: liveQuiz.id, activityType: ActivityType.LIVE_QUIZ },
      userTwoCtx
    )
    expect(userTwoCourses).toBeTruthy()
    expect(userTwoCourses).toHaveLength(1)
    expect(userTwoCourses[0]!.id).toEqual(course2.id)

    const userThreeCourses = await getActiveUserCourses(
      { activityId: liveQuiz.id, activityType: ActivityType.LIVE_QUIZ },
      userThreeCtx
    )
    expect(userThreeCourses).toBeTruthy()
    expect(userThreeCourses).toHaveLength(1)
    expect(userThreeCourses[0]!.id).toEqual(course3.id)

    const userFourCourses = await getActiveUserCourses(
      { activityId: liveQuiz.id, activityType: ActivityType.LIVE_QUIZ },
      userFourCtx
    )
    expect(userFourCourses).toBeTruthy()
    expect(userFourCourses).toHaveLength(2)
    const courseIdsUserThree = userFourCourses.map((course) => course.id)
    expect(courseIdsUserThree).toContain(course1.id)
    expect(courseIdsUserThree).toContain(course4.id)

    const userFiveCourses = await getActiveUserCourses(
      { activityId: liveQuiz.id, activityType: ActivityType.LIVE_QUIZ },
      userFiveCtx
    )
    expect(userFiveCourses).toBeTruthy()
    expect(userFiveCourses).toHaveLength(2)
    const courseIdsUserFive = userFiveCourses.map((course) => course.id)
    expect(courseIdsUserFive).toContain(course1.id)
    expect(courseIdsUserFive).toContain(course5.id)
  })

  it('Verify that users can remove their own direct permission to a live quiz', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: liveQuiz.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: userTwo.id },
      prisma
    )

    // check that the owner cannot use the removal function to revoke a user's access
    const res = await removeLiveQuiz({ id: liveQuiz.id }, userOneCtx)
    expect(res).toBeNull()
    const res2 = await removeLiveQuiz({ id: liveQuiz.id }, userThreeCtx)
    expect(res2).toBeNull()
    const res3 = await removeLiveQuiz({ id: liveQuiz.id }, userTwoCtx)
    expect(res3).toBeTruthy()

    // check that the direct permission was removed correctly
    const removedWritePermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedWritePermission).toBeNull()

    // verify that also the derived permissions were removed
    const removedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedDerivedPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: String(liveQuiz.id),
        objectType: ObjectType.LIVE_QUIZ,
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `User ${userTwo.id} removed own permission on ${ObjectType.LIVE_QUIZ} (ID: ${liveQuiz.id})`
    )
  })
  // #endregion

  // ! Sharing Operations for Practice Quizzes (reduced - due to shared logic with live quizzes)
  // #region
  it('Test that practice quizzes can be shared with individual users through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // directly share the activity with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions
    await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        shortnameOrEmail: userThree.shortname,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userFour.email,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userFive.email,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )

    // verify that the correct direct permissions were created
    const directReadPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)

    const directExecutePermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directWritePermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directAdminPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(derivedReadPermission!.derived).toBe(false)

    const derivedExecutePermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedExecutePermission).toBeTruthy()
    expect(derivedExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedExecutePermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(derivedExecutePermission!.derived).toBe(false)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(derivedWritePermission!.derived).toBe(false)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(derivedAdminPermission!.derived).toBe(false)

    // verify that for users with ADMIN permissions, derived ADMIN permissions were created on the contained elements
    const noReadElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(noReadElementPermission).toBeNull()

    const noExecuteElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(noExecuteElementPermission).toBeNull()

    const noWriteElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFour.id,
        },
      },
    })
    expect(noWriteElementPermission).toBeNull()

    const adminElementPermissions = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminElementPermissions).toBeTruthy()
    expect(adminElementPermissions!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(adminElementPermissions!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminElementPermissions!.derived).toBe(true)

    // verify that for the user with derived ADMIN permissions, corresponding permissions have also been created on the answer collection
    const adminAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(adminAnswerCollectionPermission).toBeTruthy()
    expect(adminAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(adminAnswerCollectionPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminAnswerCollectionPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  })

  it('Test that practice quizzes can be shared with groups through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create user groups with users 1 and 2, 2 and 3, 4, and 4 and 5 respectively
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        members: {
          connect: [{ id: userFour.id }, { id: userOne.id }],
        },
      },
    })

    // directly share the activity with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions
    const res1 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group1.id,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const res2 = await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        userGroupId: group2.id,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const res3 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group3.id,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group4.id,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    // verify that the correct direct permissions were created
    const directGroupReadPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userGroupId: {
          practiceQuizId: practiceQuiz.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(directGroupReadPermission).toBeTruthy()
    expect(directGroupReadPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const directGroupExecutePermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userGroupId: {
          practiceQuizId: practiceQuiz.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(directGroupExecutePermission).toBeTruthy()
    expect(directGroupExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directGroupWritePermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userGroupId: {
          practiceQuizId: practiceQuiz.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(directGroupWritePermission).toBeTruthy()
    expect(directGroupWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directGroupAdminPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userGroupId: {
          practiceQuizId: practiceQuiz.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(directGroupAdminPermission).toBeTruthy()
    expect(directGroupAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    // OWNER (user 1), ADMIN (users 4 and 5), WRITE (user 2), EXECUTE (user 3)
    const derivedLQPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedLQPermissionUserOne).toBeTruthy()
    expect(derivedLQPermissionUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedLQPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedLQPermissionUserOne!.derived).toBe(false)

    const derivedLQPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedLQPermissionUserTwo).toBeTruthy()
    expect(derivedLQPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedLQPermissionUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedLQPermissionUserTwo!.derived).toBe(false)

    const derivedLQPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedLQPermissionUserThree).toBeTruthy()
    expect(derivedLQPermissionUserThree!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedLQPermissionUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedLQPermissionUserThree!.derived).toBe(false)

    const derivedLQPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedLQPermissionUserFour).toBeTruthy()
    expect(derivedLQPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFour!.derived).toBe(false)

    const derivedLQPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedLQPermissionUserFive).toBeTruthy()
    expect(derivedLQPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFive!.derived).toBe(false)

    // verify that derived ADMIN permissions were created for the admin users of the activity
    const derivedElementPermissionsUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedElementPermissionsUserOne).toBeTruthy()
    expect(derivedElementPermissionsUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermissionsUserOne!.directPermissionId).toBeNull()
    expect(derivedElementPermissionsUserOne!.derived).toBe(false)

    const derivedElementPermissionsUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFour).toBeTruthy()
    expect(derivedElementPermissionsUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFour!.derived).toBe(true)

    const derivedElementPermissionsUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFive).toBeTruthy()
    expect(derivedElementPermissionsUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFive!.derived).toBe(true)

    // verify that derived permissions on the activity were created for the admin users on the element
    const derivedACPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedACPermissionUserFour).toBeTruthy()
    expect(derivedACPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFour!.derived).toBe(true)

    const derivedACPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedACPermissionUserFive).toBeTruthy()
    expect(derivedACPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFive!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.PRACTICE_QUIZ,
        objectId: practiceQuiz.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.PRACTICE_QUIZ} (ID ${practiceQuiz.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  })

  it('Verify that the level of an individual practice quiz permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id, userId: userTwo.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // change the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // change the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // change the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement2).toBeTruthy()
    expect(adminPermissionElement2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionAnswerCollection).toBeTruthy()
    expect(adminPermissionAnswerCollection!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
  })

  it('Verify that the level of a group practice quiz permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create a group with users 2 and 3
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant READ permissions to the group
    const directGroupReadPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // update the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // update the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // update the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        practiceQuizId: practiceQuiz.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
  })

  it('Verify that the ownership transfer function for practice quizzes works correctly', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [{ id: SE.id, type: ElementType.SELECTION }],
      },
      userOneCtx
    )

    // grant direct ADMIN permissions to user 2 on the activity and the anwer collection
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id, userId: userTwo.id },
      prisma
    )

    // create an access request for user 4 on the activity, elements and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        practiceQuizId: practiceQuiz.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        practiceQuizId: practiceQuiz.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(5)

    // transfer ownership to user 2
    const res = await transferPracticeQuizOwnership(
      { id: practiceQuiz.id, shortnameOrEmail: userTwo.shortname },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that user 2 is the new owner and its admin permission was removed
    const activity2 = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuiz.id },
      select: { ownerId: true },
    })
    expect(activity2).toBeTruthy()
    expect(activity2!.ownerId).toEqual(userTwo.id)

    const removedDirectPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          userId: userTwo.id,
          practiceQuizId: practiceQuiz.id,
        },
      },
    })
    expect(removedDirectPermission).toBeNull()

    // verify that a new admin permission was granted to user 1
    const newDirectPermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          userId: userOne.id,
          practiceQuizId: practiceQuiz.id,
        },
      },
    })
    expect(newDirectPermission).toBeTruthy()
    expect(newDirectPermission!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    // verify that the access requests have not changed
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(5)

    // transfer the ownership to user 3
    const res2 = await transferPracticeQuizOwnership(
      { id: practiceQuiz.id, shortnameOrEmail: userThree.shortname },
      userTwoCtx
    )
    expect(res2).toBeTruthy()

    // verify that user 3 is the new owner
    const activity3 = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuiz.id },
      select: { ownerId: true },
    })
    expect(activity3).toBeTruthy()
    expect(activity3!.ownerId).toEqual(userThree.id)

    // verify that user 2 is no longer the owner, but got another admin permission
    const grantedAdminPermissionUserTwo = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          userId: userTwo.id,
          practiceQuizId: practiceQuiz.id,
        },
      },
    })
    expect(grantedAdminPermissionUserTwo).toBeTruthy()
    expect(grantedAdminPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the access requests for the activity and the element were duplicated for the new owner
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(7)
    const accessRequestsActivity = await prisma.accessRequest.findUnique({
      where: {
        practiceQuizId_userId_objectAdminOrOwnerId: {
          practiceQuizId: practiceQuiz.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity).toBeTruthy()
    expect(accessRequestsActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestsActivity2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity2).toBeTruthy()
    expect(accessRequestsActivity2!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const accessRequestAnswerCollection = await prisma.accessRequest.findUnique(
      {
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
            objectAdminOrOwnerId: userThree.id,
          },
        },
      }
    )
    expect(accessRequestAnswerCollection).toBeNull()
  })

  it('Test the getter function for practice quiz permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create 4 user groups with the individual users 2, 3, 4, and 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // granted READ, EXECUTE, WRITE, and ADMIN permissions to the individual users and the user groups
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userGroupId: userGroup1.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userGroupId: userGroup2.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userGroupId: userGroup3.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userGroupId: userGroup4.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )

    // call the getter function
    const { permissions } = await getPracticeQuizPermissions(
      { id: practiceQuiz.id },
      userTwoCtx
    )
    expect(permissions).toBeTruthy()
    expect(permissions).toHaveLength(8)

    const directReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ && p.userId === userTwo.id
    )
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.isOwn).toBe(true)
    expect(directReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(directReadPermission!.username).toBe(userTwo.shortname)
    expect(directReadPermission!.userGroupId).not.toBeDefined()
    expect(directReadPermission!.userGroupName).not.toBeDefined()

    const directExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userId === userThree.id
    )
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.isOwn).toBeFalsy()
    expect(directExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(directExecutePermission!.username).toBe(userThree.shortname)
    expect(directExecutePermission!.userGroupId).not.toBeDefined()
    expect(directExecutePermission!.userGroupName).not.toBeDefined()

    const directWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE && p.userId === userFour.id
    )
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.isOwn).toBe(false)
    expect(directWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(directWritePermission!.username).toBe(userFour.shortname)
    expect(directWritePermission!.userGroupId).not.toBeDefined()
    expect(directWritePermission!.userGroupName).not.toBeDefined()

    const directAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN && p.userId === userFive.id
    )
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.isOwn).toBe(false)
    expect(directAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(directAdminPermission!.username).toBe(userFive.shortname)
    expect(directAdminPermission!.userGroupId).not.toBeDefined()
    expect(directAdminPermission!.userGroupName).not.toBeDefined()

    const groupReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ &&
        p.userGroupId === userGroup1.id
    )
    expect(groupReadPermission).toBeTruthy()
    expect(groupReadPermission!.isOwn).toBe(false)
    expect(groupReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(groupReadPermission!.userId).not.toBeDefined()
    expect(groupReadPermission!.username).not.toBeDefined()
    expect(groupReadPermission!.userGroupName).toBe(userGroup1.name)

    const groupExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userGroupId === userGroup2.id
    )
    expect(groupExecutePermission).toBeTruthy()
    expect(groupExecutePermission!.isOwn).toBe(false)
    expect(groupExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupExecutePermission!.userId).not.toBeDefined()
    expect(groupExecutePermission!.username).not.toBeDefined()
    expect(groupExecutePermission!.userGroupName).toBe(userGroup2.name)

    const groupWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE &&
        p.userGroupId === userGroup3.id
    )
    expect(groupWritePermission).toBeTruthy()
    expect(groupWritePermission!.isOwn).toBe(false)
    expect(groupWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupWritePermission!.userId).not.toBeDefined()
    expect(groupWritePermission!.username).not.toBeDefined()
    expect(groupWritePermission!.userGroupName).toBe(userGroup3.name)

    const groupAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN &&
        p.userGroupId === userGroup4.id
    )
    expect(groupAdminPermission).toBeTruthy()
    expect(groupAdminPermission!.isOwn).toBe(false)
    expect(groupAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupAdminPermission!.userId).not.toBeDefined()
    expect(groupAdminPermission!.username).not.toBeDefined()
    expect(groupAdminPermission!.userGroupName).toBe(userGroup4.name)
  })

  it('Verify that individual and group permissions can be revoked on practice quizzes', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id, userId: userTwo.id },
      prisma
    )

    // create a user group with users 3 and 4
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant ADMIN permissions to the group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    const adminActivityPermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminActivityPermission).toBeTruthy()
    expect(adminActivityPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission).toBeTruthy()
    expect(adminElementPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission2).toBeTruthy()
    expect(adminElementPermission2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const readAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(readAnswerCollectionPermission).toBeTruthy()
    expect(readAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    // revoke both direct permissions
    await revokeObjectAccess(
      {
        permissionId: directPermission!.id,
        practiceQuizId: practiceQuiz.id,
      },
      userOneCtx
    )
    await revokeObjectAccess(
      {
        permissionId: groupPermission!.id,
        practiceQuizId: practiceQuiz.id,
      },
      userOneCtx
    )

    // check that the derived permissions were removed correctly
    const readPermissionActivityAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionActivityAfter).toBeNull()

    const readPermissionElementAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionElementAfter).toBeNull()

    const adminActivityPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminActivityPermissionAfter).toBeNull()

    const adminElementPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermissionAfter).toBeNull()

    const adminElementPermission2After =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermission2After).toBeNull()

    const adminAnswerCollectionPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminAnswerCollectionPermissionAfter).toBeNull()
  })

  it('Verify that users can remove their own direct permission to a practice quiz', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: practiceQuiz.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id, userId: userTwo.id },
      prisma
    )

    // check that the owner cannot use the removal function to revoke a user's access
    const res = await removePracticeQuiz({ id: practiceQuiz.id }, userOneCtx)
    expect(res).toBeNull()
    const res2 = await removePracticeQuiz({ id: practiceQuiz.id }, userThreeCtx)
    expect(res2).toBeNull()
    const res3 = await removePracticeQuiz({ id: practiceQuiz.id }, userTwoCtx)
    expect(res3).toBeTruthy()

    // check that the direct permission was removed correctly
    const removedWritePermission = await prisma.permission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedWritePermission).toBeNull()

    // verify that also the derived permissions were removed
    const removedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedDerivedPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: practiceQuiz.id,
        objectType: ObjectType.PRACTICE_QUIZ,
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `User ${userTwo.id} removed own permission on ${ObjectType.PRACTICE_QUIZ} (ID: ${practiceQuiz.id})`
    )
  })

  it('Verify that courses linked to a practice quiz are also returned during editing for users with sufficient permissions', async () => {
    // create two courses owned by user 1 and 2 respectively
    const course1 = await prisma.course.create({
      data: {
        name: 'Course 1',
        displayName: 'Course 1',
        description: 'Test Description',
        pinCode: 1234,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week in the past
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week in the future
        groupDeadlineDate: new Date(), // now
        ownerId: userOne.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course1.id }, prisma)

    const course2 = await prisma.course.create({
      data: {
        name: 'Course 2',
        displayName: 'Course 2',
        description: 'Test Description',
        pinCode: 5678,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userTwo.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course2.id }, prisma)

    const course3 = await prisma.course.create({
      data: {
        name: 'Course 3',
        displayName: 'Course 3',
        description: 'Test Description',
        pinCode: 91011,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userThree.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course3.id }, prisma)

    const course4 = await prisma.course.create({
      data: {
        name: 'Course 4',
        displayName: 'Course 4',
        description: 'Test Description',
        pinCode: 121314,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFour.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course4.id }, prisma)

    const course5 = await prisma.course.create({
      data: {
        name: 'Course 5',
        displayName: 'Course 5',
        description: 'Test Description',
        pinCode: 151617,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFive.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course5.id }, prisma)

    // create an activity that is linked to course 1
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const practiceQuiz = await seedPracticeQuiz(
      {
        courseId: course1.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ, EXECUTE, WRITE, and ADMIN permissions to users 2, 3, 4, and 5 on the activity
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )

    // verify that users with >= WRITE permissions can also see the linked course during editing
    const userOneCourses = await getActiveUserCourses(
      { activityId: practiceQuiz.id, activityType: ActivityType.PRACTICE_QUIZ },
      userOneCtx
    )
    expect(userOneCourses).toBeTruthy()
    expect(userOneCourses).toHaveLength(1)
    expect(userOneCourses[0]!.id).toEqual(course1.id)

    const userTwoCourses = await getActiveUserCourses(
      { activityId: practiceQuiz.id, activityType: ActivityType.PRACTICE_QUIZ },
      userTwoCtx
    )
    expect(userTwoCourses).toBeTruthy()
    expect(userTwoCourses).toHaveLength(1)
    expect(userTwoCourses[0]!.id).toEqual(course2.id)

    const userThreeCourses = await getActiveUserCourses(
      { activityId: practiceQuiz.id, activityType: ActivityType.PRACTICE_QUIZ },
      userThreeCtx
    )
    expect(userThreeCourses).toBeTruthy()
    expect(userThreeCourses).toHaveLength(1)
    expect(userThreeCourses[0]!.id).toEqual(course3.id)

    const userFourCourses = await getActiveUserCourses(
      { activityId: practiceQuiz.id, activityType: ActivityType.PRACTICE_QUIZ },
      userFourCtx
    )
    expect(userFourCourses).toBeTruthy()
    expect(userFourCourses).toHaveLength(2)
    const courseIdsUserThree = userFourCourses.map((course) => course.id)
    expect(courseIdsUserThree).toContain(course1.id)
    expect(courseIdsUserThree).toContain(course4.id)

    const userFiveCourses = await getActiveUserCourses(
      { activityId: practiceQuiz.id, activityType: ActivityType.PRACTICE_QUIZ },
      userFiveCtx
    )
    expect(userFiveCourses).toBeTruthy()
    expect(userFiveCourses).toHaveLength(2)
    const courseIdsUserFive = userFiveCourses.map((course) => course.id)
    expect(courseIdsUserFive).toContain(course1.id)
    expect(courseIdsUserFive).toContain(course5.id)
  })
  // #endregion

  // ! Sharing Operations for Microlearnings (reduced - due to shared logic with live quizzes)
  // #region
  it('Test that microlearnings can be shared with individual users through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // directly share the activity with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions
    await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        shortnameOrEmail: userThree.shortname,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userFour.email,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userFive.email,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )

    // verify that the correct direct permissions were created
    const directReadPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)

    const directExecutePermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userThree.id,
        },
      },
    })
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directWritePermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userFour.id,
        },
      },
    })
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directAdminPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userFive.id,
        },
      },
    })
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(derivedReadPermission!.derived).toBe(false)

    const derivedExecutePermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedExecutePermission).toBeTruthy()
    expect(derivedExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedExecutePermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(derivedExecutePermission!.derived).toBe(false)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(derivedWritePermission!.derived).toBe(false)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(derivedAdminPermission!.derived).toBe(false)

    // verify that for users with ADMIN permissions, derived ADMIN permissions were created on the contained elements
    const noReadElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(noReadElementPermission).toBeNull()

    const noExecuteElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(noExecuteElementPermission).toBeNull()

    const noWriteElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFour.id,
        },
      },
    })
    expect(noWriteElementPermission).toBeNull()

    const adminElementPermissions = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminElementPermissions).toBeTruthy()
    expect(adminElementPermissions!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(adminElementPermissions!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminElementPermissions!.derived).toBe(true)

    // verify that for the user with derived ADMIN permissions, corresponding permissions have also been created on the answer collection
    const adminAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(adminAnswerCollectionPermission).toBeTruthy()
    expect(adminAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(adminAnswerCollectionPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminAnswerCollectionPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  })

  it('Test that microlearnings can be shared with groups through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create user groups with users 1 and 2, 2 and 3, 4, and 4 and 5 respectively
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        members: {
          connect: [{ id: userFour.id }, { id: userOne.id }],
        },
      },
    })

    // directly share the activity with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions
    const res1 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group1.id,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const res2 = await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        userGroupId: group2.id,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const res3 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group3.id,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group4.id,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    // verify that the correct direct permissions were created
    const directGroupReadPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userGroupId: {
          microLearningId: microLearning.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(directGroupReadPermission).toBeTruthy()
    expect(directGroupReadPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const directGroupExecutePermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userGroupId: {
          microLearningId: microLearning.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(directGroupExecutePermission).toBeTruthy()
    expect(directGroupExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directGroupWritePermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userGroupId: {
          microLearningId: microLearning.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(directGroupWritePermission).toBeTruthy()
    expect(directGroupWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directGroupAdminPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userGroupId: {
          microLearningId: microLearning.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(directGroupAdminPermission).toBeTruthy()
    expect(directGroupAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    // OWNER (user 1), ADMIN (users 4 and 5), WRITE (user 2), EXECUTE (user 3)
    const derivedLQPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedLQPermissionUserOne).toBeTruthy()
    expect(derivedLQPermissionUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedLQPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedLQPermissionUserOne!.derived).toBe(false)

    const derivedLQPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedLQPermissionUserTwo).toBeTruthy()
    expect(derivedLQPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedLQPermissionUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedLQPermissionUserTwo!.derived).toBe(false)

    const derivedLQPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedLQPermissionUserThree).toBeTruthy()
    expect(derivedLQPermissionUserThree!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedLQPermissionUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedLQPermissionUserThree!.derived).toBe(false)

    const derivedLQPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedLQPermissionUserFour).toBeTruthy()
    expect(derivedLQPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFour!.derived).toBe(false)

    const derivedLQPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedLQPermissionUserFive).toBeTruthy()
    expect(derivedLQPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFive!.derived).toBe(false)

    // verify that derived ADMIN permissions were created for the admin users of the activity
    const derivedElementPermissionsUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedElementPermissionsUserOne).toBeTruthy()
    expect(derivedElementPermissionsUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermissionsUserOne!.directPermissionId).toBeNull()
    expect(derivedElementPermissionsUserOne!.derived).toBe(false)

    const derivedElementPermissionsUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFour).toBeTruthy()
    expect(derivedElementPermissionsUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFour!.derived).toBe(true)

    const derivedElementPermissionsUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFive).toBeTruthy()
    expect(derivedElementPermissionsUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFive!.derived).toBe(true)

    // verify that derived permissions on the activity were created for the admin users on the element
    const derivedACPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedACPermissionUserFour).toBeTruthy()
    expect(derivedACPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFour!.derived).toBe(true)

    const derivedACPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedACPermissionUserFive).toBeTruthy()
    expect(derivedACPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFive!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.MICRO_LEARNING,
        objectId: microLearning.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.MICRO_LEARNING} (ID ${microLearning.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  })

  it('Verify that the level of an individual microlearning permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id, userId: userTwo.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // change the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // change the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // change the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement2).toBeTruthy()
    expect(adminPermissionElement2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionAnswerCollection).toBeTruthy()
    expect(adminPermissionAnswerCollection!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
  })

  it('Verify that the level of a group microlearning permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create a group with users 2 and 3
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant READ permissions to the group
    const directGroupReadPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // update the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // update the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // update the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        microLearningId: microLearning.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
  })

  it('Verify that the ownership transfer function for microlearnings works correctly', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [{ id: SE.id, type: ElementType.SELECTION }],
      },
      userOneCtx
    )

    // grant direct ADMIN permissions to user 2 on the activity and the anwer collection
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id, userId: userTwo.id },
      prisma
    )

    // create an access request for user 4 on the activity, elements and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        microLearningId: microLearning.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        microLearningId: microLearning.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(5)

    // transfer ownership to user 2
    const res = await transferMicroLearningOwnership(
      { id: microLearning.id, shortnameOrEmail: userTwo.shortname },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that user 2 is the new owner and its admin permission was removed
    const activity2 = await prisma.microLearning.findUnique({
      where: { id: microLearning.id },
      select: { ownerId: true },
    })
    expect(activity2).toBeTruthy()
    expect(activity2!.ownerId).toEqual(userTwo.id)

    const removedDirectPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          userId: userTwo.id,
          microLearningId: microLearning.id,
        },
      },
    })
    expect(removedDirectPermission).toBeNull()

    // verify that a new admin permission was granted to user 1
    const newDirectPermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          userId: userOne.id,
          microLearningId: microLearning.id,
        },
      },
    })
    expect(newDirectPermission).toBeTruthy()
    expect(newDirectPermission!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    // verify that the access requests have not changed
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(5)

    // transfer the ownership to user 3
    const res2 = await transferMicroLearningOwnership(
      { id: microLearning.id, shortnameOrEmail: userThree.shortname },
      userTwoCtx
    )
    expect(res2).toBeTruthy()

    // verify that user 3 is the new owner
    const activity3 = await prisma.microLearning.findUnique({
      where: { id: microLearning.id },
      select: { ownerId: true },
    })
    expect(activity3).toBeTruthy()
    expect(activity3!.ownerId).toEqual(userThree.id)

    // verify that user 2 is no longer the owner, but got another admin permission
    const grantedAdminPermissionUserTwo = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          userId: userTwo.id,
          microLearningId: microLearning.id,
        },
      },
    })
    expect(grantedAdminPermissionUserTwo).toBeTruthy()
    expect(grantedAdminPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the access requests for the activity and the element were duplicated for the new owner
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(7)
    const accessRequestsActivity = await prisma.accessRequest.findUnique({
      where: {
        microLearningId_userId_objectAdminOrOwnerId: {
          microLearningId: microLearning.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity).toBeTruthy()
    expect(accessRequestsActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestsActivity2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity2).toBeTruthy()
    expect(accessRequestsActivity2!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const accessRequestAnswerCollection = await prisma.accessRequest.findUnique(
      {
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
            objectAdminOrOwnerId: userThree.id,
          },
        },
      }
    )
    expect(accessRequestAnswerCollection).toBeNull()
  })

  it('Test the getter function for microlearning permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create 4 user groups with the individual users 2, 3, 4, and 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // granted READ, EXECUTE, WRITE, and ADMIN permissions to the individual users and the user groups
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userGroupId: userGroup1.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userGroupId: userGroup2.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userGroupId: userGroup3.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userGroupId: userGroup4.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id },
      prisma
    )

    // call the getter function
    const { permissions } = await getMicroLearningPermissions(
      { id: microLearning.id },
      userTwoCtx
    )
    expect(permissions).toBeTruthy()
    expect(permissions).toHaveLength(8)

    const directReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ && p.userId === userTwo.id
    )
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.isOwn).toBe(true)
    expect(directReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(directReadPermission!.username).toBe(userTwo.shortname)
    expect(directReadPermission!.userGroupId).not.toBeDefined()
    expect(directReadPermission!.userGroupName).not.toBeDefined()

    const directExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userId === userThree.id
    )
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.isOwn).toBeFalsy()
    expect(directExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(directExecutePermission!.username).toBe(userThree.shortname)
    expect(directExecutePermission!.userGroupId).not.toBeDefined()
    expect(directExecutePermission!.userGroupName).not.toBeDefined()

    const directWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE && p.userId === userFour.id
    )
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.isOwn).toBe(false)
    expect(directWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(directWritePermission!.username).toBe(userFour.shortname)
    expect(directWritePermission!.userGroupId).not.toBeDefined()
    expect(directWritePermission!.userGroupName).not.toBeDefined()

    const directAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN && p.userId === userFive.id
    )
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.isOwn).toBe(false)
    expect(directAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(directAdminPermission!.username).toBe(userFive.shortname)
    expect(directAdminPermission!.userGroupId).not.toBeDefined()
    expect(directAdminPermission!.userGroupName).not.toBeDefined()

    const groupReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ &&
        p.userGroupId === userGroup1.id
    )
    expect(groupReadPermission).toBeTruthy()
    expect(groupReadPermission!.isOwn).toBe(false)
    expect(groupReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(groupReadPermission!.userId).not.toBeDefined()
    expect(groupReadPermission!.username).not.toBeDefined()
    expect(groupReadPermission!.userGroupName).toBe(userGroup1.name)

    const groupExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userGroupId === userGroup2.id
    )
    expect(groupExecutePermission).toBeTruthy()
    expect(groupExecutePermission!.isOwn).toBe(false)
    expect(groupExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupExecutePermission!.userId).not.toBeDefined()
    expect(groupExecutePermission!.username).not.toBeDefined()
    expect(groupExecutePermission!.userGroupName).toBe(userGroup2.name)

    const groupWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE &&
        p.userGroupId === userGroup3.id
    )
    expect(groupWritePermission).toBeTruthy()
    expect(groupWritePermission!.isOwn).toBe(false)
    expect(groupWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupWritePermission!.userId).not.toBeDefined()
    expect(groupWritePermission!.username).not.toBeDefined()
    expect(groupWritePermission!.userGroupName).toBe(userGroup3.name)

    const groupAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN &&
        p.userGroupId === userGroup4.id
    )
    expect(groupAdminPermission).toBeTruthy()
    expect(groupAdminPermission!.isOwn).toBe(false)
    expect(groupAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupAdminPermission!.userId).not.toBeDefined()
    expect(groupAdminPermission!.username).not.toBeDefined()
    expect(groupAdminPermission!.userGroupName).toBe(userGroup4.name)
  })

  it('Verify that individual and group permissions can be revoked on microlearnings', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id, userId: userTwo.id },
      prisma
    )

    // create a user group with users 3 and 4
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant ADMIN permissions to the group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    const adminActivityPermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminActivityPermission).toBeTruthy()
    expect(adminActivityPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission).toBeTruthy()
    expect(adminElementPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission2).toBeTruthy()
    expect(adminElementPermission2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const readAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(readAnswerCollectionPermission).toBeTruthy()
    expect(readAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    // revoke both direct permissions
    await revokeObjectAccess(
      {
        permissionId: directPermission!.id,
        microLearningId: microLearning.id,
      },
      userOneCtx
    )
    await revokeObjectAccess(
      {
        permissionId: groupPermission!.id,
        microLearningId: microLearning.id,
      },
      userOneCtx
    )

    // check that the derived permissions were removed correctly
    const readPermissionActivityAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionActivityAfter).toBeNull()

    const readPermissionElementAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionElementAfter).toBeNull()

    const adminActivityPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microLearning.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminActivityPermissionAfter).toBeNull()

    const adminElementPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermissionAfter).toBeNull()

    const adminElementPermission2After =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermission2After).toBeNull()

    const adminAnswerCollectionPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminAnswerCollectionPermissionAfter).toBeNull()
  })

  it('Verify that users can remove their own direct permission to a microlearning', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const microLearning = await seedMicroLearning(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        microLearningId: microLearning.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id, userId: userTwo.id },
      prisma
    )

    // check that the owner cannot use the removal function to revoke a user's access
    const res = await removeMicroLearning({ id: microLearning.id }, userOneCtx)
    expect(res).toBeNull()
    const res2 = await removeMicroLearning(
      { id: microLearning.id },
      userThreeCtx
    )
    expect(res2).toBeNull()
    const res3 = await removeMicroLearning({ id: microLearning.id }, userTwoCtx)
    expect(res3).toBeTruthy()

    // check that the direct permission was removed correctly
    const removedWritePermission = await prisma.permission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedWritePermission).toBeNull()

    // verify that also the derived permissions were removed
    const removedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedDerivedPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: microLearning.id,
        objectType: ObjectType.MICRO_LEARNING,
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `User ${userTwo.id} removed own permission on ${ObjectType.MICRO_LEARNING} (ID: ${microLearning.id})`
    )
  })

  it('Verify that courses linked to a microlearning are also returned during editing for users with sufficient permissions', async () => {
    // create two courses owned by user 1 and 2 respectively
    const course1 = await prisma.course.create({
      data: {
        name: 'Course 1',
        displayName: 'Course 1',
        description: 'Test Description',
        pinCode: 1234,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week in the past
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week in the future
        groupDeadlineDate: new Date(), // now
        ownerId: userOne.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course1.id }, prisma)

    const course2 = await prisma.course.create({
      data: {
        name: 'Course 2',
        displayName: 'Course 2',
        description: 'Test Description',
        pinCode: 5678,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userTwo.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course2.id }, prisma)

    const course3 = await prisma.course.create({
      data: {
        name: 'Course 3',
        displayName: 'Course 3',
        description: 'Test Description',
        pinCode: 91011,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userThree.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course3.id }, prisma)

    const course4 = await prisma.course.create({
      data: {
        name: 'Course 4',
        displayName: 'Course 4',
        description: 'Test Description',
        pinCode: 121314,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFour.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course4.id }, prisma)

    const course5 = await prisma.course.create({
      data: {
        name: 'Course 5',
        displayName: 'Course 5',
        description: 'Test Description',
        pinCode: 151617,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFive.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course5.id }, prisma)

    // create an activity that is linked to course 1
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const microLearning = await seedMicroLearning(
      {
        courseId: course1.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ, EXECUTE, WRITE, and ADMIN permissions to users 2, 3, 4, and 5 on the activity
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          microLearningId: microLearning.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id },
      prisma
    )

    // verify that users with >= WRITE permissions can also see the linked course during editing
    const userOneCourses = await getActiveUserCourses(
      {
        activityId: microLearning.id,
        activityType: ActivityType.MICRO_LEARNING,
      },
      userOneCtx
    )
    expect(userOneCourses).toBeTruthy()
    expect(userOneCourses).toHaveLength(1)
    expect(userOneCourses[0]!.id).toEqual(course1.id)

    const userTwoCourses = await getActiveUserCourses(
      {
        activityId: microLearning.id,
        activityType: ActivityType.MICRO_LEARNING,
      },
      userTwoCtx
    )
    expect(userTwoCourses).toBeTruthy()
    expect(userTwoCourses).toHaveLength(1)
    expect(userTwoCourses[0]!.id).toEqual(course2.id)

    const userThreeCourses = await getActiveUserCourses(
      {
        activityId: microLearning.id,
        activityType: ActivityType.MICRO_LEARNING,
      },
      userThreeCtx
    )
    expect(userThreeCourses).toBeTruthy()
    expect(userThreeCourses).toHaveLength(1)
    expect(userThreeCourses[0]!.id).toEqual(course3.id)

    const userFourCourses = await getActiveUserCourses(
      {
        activityId: microLearning.id,
        activityType: ActivityType.MICRO_LEARNING,
      },
      userFourCtx
    )
    expect(userFourCourses).toBeTruthy()
    expect(userFourCourses).toHaveLength(2)
    const courseIdsUserThree = userFourCourses.map((course) => course.id)
    expect(courseIdsUserThree).toContain(course1.id)
    expect(courseIdsUserThree).toContain(course4.id)

    const userFiveCourses = await getActiveUserCourses(
      {
        activityId: microLearning.id,
        activityType: ActivityType.MICRO_LEARNING,
      },
      userFiveCtx
    )
    expect(userFiveCourses).toBeTruthy()
    expect(userFiveCourses).toHaveLength(2)
    const courseIdsUserFive = userFiveCourses.map((course) => course.id)
    expect(courseIdsUserFive).toContain(course1.id)
    expect(courseIdsUserFive).toContain(course5.id)
  })
  // #endregion

  // ! Sharing Operations for Group Activities (reduced - due to shared logic with live quizzes)
  // #region
  it('Test that group activities can be shared with individual users through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // directly share the activity with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions
    await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        shortnameOrEmail: userThree.shortname,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userFour.email,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userFive.email,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )

    // verify that the correct direct permissions were created
    const directReadPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)

    const directExecutePermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userThree.id,
        },
      },
    })
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directWritePermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userFour.id,
        },
      },
    })
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directAdminPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userFive.id,
        },
      },
    })
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toEqual(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission!.id
    )
    expect(derivedReadPermission!.derived).toBe(false)

    const derivedExecutePermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedExecutePermission).toBeTruthy()
    expect(derivedExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedExecutePermission!.directPermissionId).toBe(
      directExecutePermission!.id
    )
    expect(derivedExecutePermission!.derived).toBe(false)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission!.id
    )
    expect(derivedWritePermission!.derived).toBe(false)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(derivedAdminPermission!.derived).toBe(false)

    // verify that for users with ADMIN permissions, derived ADMIN permissions were created on the contained elements
    const noReadElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(noReadElementPermission).toBeNull()

    const noExecuteElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(noExecuteElementPermission).toBeNull()

    const noWriteElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFour.id,
        },
      },
    })
    expect(noWriteElementPermission).toBeNull()

    const adminElementPermissions = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminElementPermissions).toBeTruthy()
    expect(adminElementPermissions!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(adminElementPermissions!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminElementPermissions!.derived).toBe(true)

    // verify that for the user with derived ADMIN permissions, corresponding permissions have also been created on the answer collection
    const adminAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(adminAnswerCollectionPermission).toBeTruthy()
    expect(adminAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(adminAnswerCollectionPermission!.directPermissionId).toBe(
      directAdminPermission!.id
    )
    expect(adminAnswerCollectionPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  })

  it('Test that group activities can be shared with groups through the corresponding service function', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create user groups with users 1 and 2, 2 and 3, 4, and 4 and 5 respectively
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        members: {
          connect: [{ id: userFour.id }, { id: userOne.id }],
        },
      },
    })

    // directly share the activity with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions
    const res1 = await shareObject(
      {
        permissionLevel: PermissionLevel.READ,
        userGroupId: group1.id,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const res2 = await shareObject(
      {
        permissionLevel: PermissionLevel.EXECUTE,
        userGroupId: group2.id,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const res3 = await shareObject(
      {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group3.id,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const res4 = await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group4.id,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    // verify that the correct direct permissions were created
    const directGroupReadPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userGroupId: {
          groupActivityId: groupActivity.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(directGroupReadPermission).toBeTruthy()
    expect(directGroupReadPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const directGroupExecutePermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userGroupId: {
          groupActivityId: groupActivity.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(directGroupExecutePermission).toBeTruthy()
    expect(directGroupExecutePermission!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const directGroupWritePermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userGroupId: {
          groupActivityId: groupActivity.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(directGroupWritePermission).toBeTruthy()
    expect(directGroupWritePermission!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const directGroupAdminPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userGroupId: {
          groupActivityId: groupActivity.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(directGroupAdminPermission).toBeTruthy()
    expect(directGroupAdminPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the correct derived permissions were created for the activity
    // OWNER (user 1), ADMIN (users 4 and 5), WRITE (user 2), EXECUTE (user 3)
    const derivedLQPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedLQPermissionUserOne).toBeTruthy()
    expect(derivedLQPermissionUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedLQPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedLQPermissionUserOne!.derived).toBe(false)

    const derivedLQPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedLQPermissionUserTwo).toBeTruthy()
    expect(derivedLQPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )
    expect(derivedLQPermissionUserTwo!.directPermissionId).toBe(
      directGroupWritePermission!.id
    )
    expect(derivedLQPermissionUserTwo!.derived).toBe(false)

    const derivedLQPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedLQPermissionUserThree).toBeTruthy()
    expect(derivedLQPermissionUserThree!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )
    expect(derivedLQPermissionUserThree!.directPermissionId).toBe(
      directGroupExecutePermission!.id
    )
    expect(derivedLQPermissionUserThree!.derived).toBe(false)

    const derivedLQPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedLQPermissionUserFour).toBeTruthy()
    expect(derivedLQPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFour!.derived).toBe(false)

    const derivedLQPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedLQPermissionUserFive).toBeTruthy()
    expect(derivedLQPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedLQPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedLQPermissionUserFive!.derived).toBe(false)

    // verify that derived ADMIN permissions were created for the admin users of the activity
    const derivedElementPermissionsUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedElementPermissionsUserOne).toBeTruthy()
    expect(derivedElementPermissionsUserOne!.permissionLevel).toEqual(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermissionsUserOne!.directPermissionId).toBeNull()
    expect(derivedElementPermissionsUserOne!.derived).toBe(false)

    const derivedElementPermissionsUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFour).toBeTruthy()
    expect(derivedElementPermissionsUserFour!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFour!.derived).toBe(true)

    const derivedElementPermissionsUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedElementPermissionsUserFive).toBeTruthy()
    expect(derivedElementPermissionsUserFive!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermissionsUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedElementPermissionsUserFive!.derived).toBe(true)

    // verify that derived permissions on the activity were created for the admin users on the element
    const derivedACPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedACPermissionUserFour).toBeTruthy()
    expect(derivedACPermissionUserFour!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFour!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFour!.derived).toBe(true)

    const derivedACPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedACPermissionUserFive).toBeTruthy()
    expect(derivedACPermissionUserFive!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
    expect(derivedACPermissionUserFive!.directPermissionId).toBe(
      directGroupAdminPermission!.id
    )
    expect(derivedACPermissionUserFive!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.GROUP_ACTIVITY,
        objectId: groupActivity.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.GROUP_ACTIVITY} (ID ${groupActivity.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  })

  it('Verify that the level of an individual group activity permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id, userId: userTwo.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // change the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // change the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // change the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement2).toBeTruthy()
    expect(adminPermissionElement2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionAnswerCollection).toBeTruthy()
    expect(adminPermissionAnswerCollection!.permissionLevel).toEqual(
      PermissionLevel.READ
    )
  })

  it('Verify that the level of a group group activity permission can be changed', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create a group with users 2 and 3
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant READ permissions to the group
    const directGroupReadPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    // update the permission level to EXECUTE
    const res1 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.EXECUTE,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // check that the derived permissions were updated correctly
    const executePermissionActivity = await prisma.derivedPermission.findUnique(
      {
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(executePermissionActivity).toBeTruthy()
    expect(executePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const executePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionElement).toBeNull()

    // update the permission level to WRITE
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.WRITE,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    // check that the derived permissions were updated correctly
    const writePermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionActivity).toBeTruthy()
    expect(writePermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const writePermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionElement).toBeNull()

    // update the permission level to ADMIN
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: directGroupReadPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        groupActivityId: groupActivity.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    // check that the derived permissions were updated correctly (and new permissions created on the elements)
    const adminPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionActivity).toBeTruthy()
    expect(adminPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionElement).toBeTruthy()
    expect(adminPermissionElement!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )
  })

  it('Verify that the ownership transfer function for group activities works correctly', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [{ id: SE.id, type: ElementType.SELECTION }],
      },
      userOneCtx
    )

    // grant direct ADMIN permissions to user 2 on the activity and the anwer collection
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id, userId: userTwo.id },
      prisma
    )

    // create an access request for user 4 on the activity, elements and answer collection
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        groupActivityId: groupActivity.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        answerCollectionId: AC.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.EXECUTE,
        userId: userFour.id,
        groupActivityId: groupActivity.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: SE.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(5)

    // transfer ownership to user 2
    const res = await transferGroupActivityOwnership(
      { id: groupActivity.id, shortnameOrEmail: userTwo.shortname },
      userOneCtx
    )
    expect(res).toBeTruthy()

    // verify that user 2 is the new owner and its admin permission was removed
    const activity2 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
      select: { ownerId: true },
    })
    expect(activity2).toBeTruthy()
    expect(activity2!.ownerId).toEqual(userTwo.id)

    const removedDirectPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          userId: userTwo.id,
          groupActivityId: groupActivity.id,
        },
      },
    })
    expect(removedDirectPermission).toBeNull()

    // verify that a new admin permission was granted to user 1
    const newDirectPermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          userId: userOne.id,
          groupActivityId: groupActivity.id,
        },
      },
    })
    expect(newDirectPermission).toBeTruthy()
    expect(newDirectPermission!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    // verify that the access requests have not changed
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(5)

    // transfer the ownership to user 3
    const res2 = await transferGroupActivityOwnership(
      { id: groupActivity.id, shortnameOrEmail: userThree.shortname },
      userTwoCtx
    )
    expect(res2).toBeTruthy()

    // verify that user 3 is the new owner
    const activity3 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
      select: { ownerId: true },
    })
    expect(activity3).toBeTruthy()
    expect(activity3!.ownerId).toEqual(userThree.id)

    // verify that user 2 is no longer the owner, but got another admin permission
    const grantedAdminPermissionUserTwo = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          userId: userTwo.id,
          groupActivityId: groupActivity.id,
        },
      },
    })
    expect(grantedAdminPermissionUserTwo).toBeTruthy()
    expect(grantedAdminPermissionUserTwo!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    // verify that the access requests for the activity and the element were duplicated for the new owner
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(7)
    const accessRequestsActivity = await prisma.accessRequest.findUnique({
      where: {
        groupActivityId_userId_objectAdminOrOwnerId: {
          groupActivityId: groupActivity.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity).toBeTruthy()
    expect(accessRequestsActivity!.permissionLevel).toEqual(
      PermissionLevel.EXECUTE
    )

    const accessRequestsActivity2 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequestsActivity2).toBeTruthy()
    expect(accessRequestsActivity2!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    const accessRequestAnswerCollection = await prisma.accessRequest.findUnique(
      {
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC.id,
            userId: userFour.id,
            objectAdminOrOwnerId: userThree.id,
          },
        },
      }
    )
    expect(accessRequestAnswerCollection).toBeNull()
  })

  it('Test the getter function for group activity permissions', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // create 4 user groups with the individual users 2, 3, 4, and 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // granted READ, EXECUTE, WRITE, and ADMIN permissions to the individual users and the user groups
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userGroupId: userGroup1.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userGroupId: userGroup2.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userGroupId: userGroup3.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userGroupId: userGroup4.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id },
      prisma
    )

    // call the getter function
    const { permissions } = await getGroupActivityPermissions(
      { id: groupActivity.id },
      userTwoCtx
    )
    expect(permissions).toBeTruthy()
    expect(permissions).toHaveLength(8)

    const directReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ && p.userId === userTwo.id
    )
    expect(directReadPermission).toBeTruthy()
    expect(directReadPermission!.isOwn).toBe(true)
    expect(directReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(directReadPermission!.username).toBe(userTwo.shortname)
    expect(directReadPermission!.userGroupId).not.toBeDefined()
    expect(directReadPermission!.userGroupName).not.toBeDefined()

    const directExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userId === userThree.id
    )
    expect(directExecutePermission).toBeTruthy()
    expect(directExecutePermission!.isOwn).toBeFalsy()
    expect(directExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(directExecutePermission!.username).toBe(userThree.shortname)
    expect(directExecutePermission!.userGroupId).not.toBeDefined()
    expect(directExecutePermission!.userGroupName).not.toBeDefined()

    const directWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE && p.userId === userFour.id
    )
    expect(directWritePermission).toBeTruthy()
    expect(directWritePermission!.isOwn).toBe(false)
    expect(directWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(directWritePermission!.username).toBe(userFour.shortname)
    expect(directWritePermission!.userGroupId).not.toBeDefined()
    expect(directWritePermission!.userGroupName).not.toBeDefined()

    const directAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN && p.userId === userFive.id
    )
    expect(directAdminPermission).toBeTruthy()
    expect(directAdminPermission!.isOwn).toBe(false)
    expect(directAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(directAdminPermission!.username).toBe(userFive.shortname)
    expect(directAdminPermission!.userGroupId).not.toBeDefined()
    expect(directAdminPermission!.userGroupName).not.toBeDefined()

    const groupReadPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.READ &&
        p.userGroupId === userGroup1.id
    )
    expect(groupReadPermission).toBeTruthy()
    expect(groupReadPermission!.isOwn).toBe(false)
    expect(groupReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(groupReadPermission!.userId).not.toBeDefined()
    expect(groupReadPermission!.username).not.toBeDefined()
    expect(groupReadPermission!.userGroupName).toBe(userGroup1.name)

    const groupExecutePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.EXECUTE &&
        p.userGroupId === userGroup2.id
    )
    expect(groupExecutePermission).toBeTruthy()
    expect(groupExecutePermission!.isOwn).toBe(false)
    expect(groupExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupExecutePermission!.userId).not.toBeDefined()
    expect(groupExecutePermission!.username).not.toBeDefined()
    expect(groupExecutePermission!.userGroupName).toBe(userGroup2.name)

    const groupWritePermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.WRITE &&
        p.userGroupId === userGroup3.id
    )
    expect(groupWritePermission).toBeTruthy()
    expect(groupWritePermission!.isOwn).toBe(false)
    expect(groupWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupWritePermission!.userId).not.toBeDefined()
    expect(groupWritePermission!.username).not.toBeDefined()
    expect(groupWritePermission!.userGroupName).toBe(userGroup3.name)

    const groupAdminPermission = permissions.find(
      (p) =>
        p.permissionLevel === PermissionLevel.ADMIN &&
        p.userGroupId === userGroup4.id
    )
    expect(groupAdminPermission).toBeTruthy()
    expect(groupAdminPermission!.isOwn).toBe(false)
    expect(groupAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupAdminPermission!.userId).not.toBeDefined()
    expect(groupAdminPermission!.username).not.toBeDefined()
    expect(groupAdminPermission!.userGroupName).toBe(userGroup4.name)
  })

  it('Verify that individual and group permissions can be revoked on group activities', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id, userId: userTwo.id },
      prisma
    )

    // create a user group with users 3 and 4
    const group1 = await prisma.userGroup.create({
      data: {
        name: 'Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant ADMIN permissions to the group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: group1.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id },
      prisma
    )

    // check that the derived permissions were created correctly
    const readPermissionActivity = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionActivity).toBeTruthy()
    expect(readPermissionActivity!.permissionLevel).toEqual(
      PermissionLevel.WRITE
    )

    const readPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionElement).toBeNull()

    const adminActivityPermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminActivityPermission).toBeTruthy()
    expect(adminActivityPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission).toBeTruthy()
    expect(adminElementPermission!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const adminElementPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(adminElementPermission2).toBeTruthy()
    expect(adminElementPermission2!.permissionLevel).toEqual(
      PermissionLevel.ADMIN
    )

    const readAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(readAnswerCollectionPermission).toBeTruthy()
    expect(readAnswerCollectionPermission!.permissionLevel).toEqual(
      PermissionLevel.READ
    )

    // revoke both direct permissions
    await revokeObjectAccess(
      {
        permissionId: directPermission!.id,
        groupActivityId: groupActivity.id,
      },
      userOneCtx
    )
    await revokeObjectAccess(
      {
        permissionId: groupPermission!.id,
        groupActivityId: groupActivity.id,
      },
      userOneCtx
    )

    // check that the derived permissions were removed correctly
    const readPermissionActivityAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionActivityAfter).toBeNull()

    const readPermissionElementAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userTwo.id,
          },
        },
      })
    expect(readPermissionElementAfter).toBeNull()

    const adminActivityPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminActivityPermissionAfter).toBeNull()

    const adminElementPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermissionAfter).toBeNull()

    const adminElementPermission2After =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminElementPermission2After).toBeNull()

    const adminAnswerCollectionPermissionAfter =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      })
    expect(adminAnswerCollectionPermissionAfter).toBeNull()
  })

  it('Verify that users can remove their own direct permission to a group activity', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const course = await seedCourse({}, userOneCtx)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant WRITE permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        groupActivityId: groupActivity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id, userId: userTwo.id },
      prisma
    )

    // check that the owner cannot use the removal function to revoke a user's access
    const res = await removeGroupActivity({ id: groupActivity.id }, userOneCtx)
    expect(res).toBeNull()
    const res2 = await removeGroupActivity(
      { id: groupActivity.id },
      userThreeCtx
    )
    expect(res2).toBeNull()
    const res3 = await removeGroupActivity({ id: groupActivity.id }, userTwoCtx)
    expect(res3).toBeTruthy()

    // check that the direct permission was removed correctly
    const removedWritePermission = await prisma.permission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedWritePermission).toBeNull()

    // verify that also the derived permissions were removed
    const removedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(removedDerivedPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: groupActivity.id,
        objectType: ObjectType.GROUP_ACTIVITY,
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `User ${userTwo.id} removed own permission on ${ObjectType.GROUP_ACTIVITY} (ID: ${groupActivity.id})`
    )
  })

  it('Verify that courses linked to a group activity are also returned during editing for users with sufficient permissions', async () => {
    // create two courses owned by user 1 and 2 respectively
    const course1 = await prisma.course.create({
      data: {
        name: 'Course 1',
        displayName: 'Course 1',
        description: 'Test Description',
        pinCode: 1234,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week in the past
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week in the future
        groupDeadlineDate: new Date(), // now
        ownerId: userOne.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course1.id }, prisma)

    const course2 = await prisma.course.create({
      data: {
        name: 'Course 2',
        displayName: 'Course 2',
        description: 'Test Description',
        pinCode: 5678,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userTwo.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course2.id }, prisma)

    const course3 = await prisma.course.create({
      data: {
        name: 'Course 3',
        displayName: 'Course 3',
        description: 'Test Description',
        pinCode: 91011,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userThree.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course3.id }, prisma)

    const course4 = await prisma.course.create({
      data: {
        name: 'Course 4',
        displayName: 'Course 4',
        description: 'Test Description',
        pinCode: 121314,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFour.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course4.id }, prisma)

    const course5 = await prisma.course.create({
      data: {
        name: 'Course 5',
        displayName: 'Course 5',
        description: 'Test Description',
        pinCode: 151617,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(),
        ownerId: userFive.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course5.id }, prisma)

    // create an activity that is linked to course 1
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, SE } = await seedElements(userOneCtx, AC.id)
    const groupActivity = await seedGroupActivity(
      {
        courseId: course1.id,
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: SE.id, type: ElementType.SELECTION },
        ],
      },
      userOneCtx
    )

    // grant READ, EXECUTE, WRITE, and ADMIN permissions to users 2, 3, 4, and 5 on the activity
    await prisma.permission.createMany({
      data: [
        {
          userId: userTwo.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          userId: userFour.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userFive.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id },
      prisma
    )

    // verify that users with >= WRITE permissions can also see the linked course during editing
    const userOneCourses = await getActiveUserCourses(
      {
        activityId: groupActivity.id,
        activityType: ActivityType.GROUP_ACTIVITY,
      },
      userOneCtx
    )
    expect(userOneCourses).toBeTruthy()
    expect(userOneCourses).toHaveLength(1)
    expect(userOneCourses[0]!.id).toEqual(course1.id)

    const userTwoCourses = await getActiveUserCourses(
      {
        activityId: groupActivity.id,
        activityType: ActivityType.GROUP_ACTIVITY,
      },
      userTwoCtx
    )
    expect(userTwoCourses).toBeTruthy()
    expect(userTwoCourses).toHaveLength(1)
    expect(userTwoCourses[0]!.id).toEqual(course2.id)

    const userThreeCourses = await getActiveUserCourses(
      {
        activityId: groupActivity.id,
        activityType: ActivityType.GROUP_ACTIVITY,
      },
      userThreeCtx
    )
    expect(userThreeCourses).toBeTruthy()
    expect(userThreeCourses).toHaveLength(1)
    expect(userThreeCourses[0]!.id).toEqual(course3.id)

    const userFourCourses = await getActiveUserCourses(
      {
        activityId: groupActivity.id,
        activityType: ActivityType.GROUP_ACTIVITY,
      },
      userFourCtx
    )
    expect(userFourCourses).toBeTruthy()
    expect(userFourCourses).toHaveLength(2)
    const courseIdsUserThree = userFourCourses.map((course) => course.id)
    expect(courseIdsUserThree).toContain(course1.id)
    expect(courseIdsUserThree).toContain(course4.id)

    const userFiveCourses = await getActiveUserCourses(
      {
        activityId: groupActivity.id,
        activityType: ActivityType.GROUP_ACTIVITY,
      },
      userFiveCtx
    )
    expect(userFiveCourses).toBeTruthy()
    expect(userFiveCourses).toHaveLength(2)
    const courseIdsUserFive = userFiveCourses.map((course) => course.id)
    expect(courseIdsUserFive).toContain(course1.id)
    expect(courseIdsUserFive).toContain(course5.id)
  })
  // #endregion
})
