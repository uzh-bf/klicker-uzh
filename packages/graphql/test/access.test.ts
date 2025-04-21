import {
  AuditLogType,
  ElementType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeObjectPermissionLevel,
  checkAccess,
  checkCatalogAssignment,
  createAccessRequestInstancesNewAdmin,
  resolveObjectSharingRequest,
  revokeObjectAccess,
  shareObject,
  transferAnswerCollectionOwnership,
  transferCatalogCollectionOwnership,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCatalogCollections,
  testCleanup,
  testInitialization,
} from './helpers.js'
import {
  userFive,
  userFour,
  userOne,
  userSix,
  userThree,
  userTwo,
} from './userData.js'

describe('Unit tests for object access validation', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser
  let userSixCtx: ContextWithUser

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
      userSixCtx: ctx6,
    } = await testInitialization(prisma, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
    userSixCtx = ctx6
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  // ! Access Validation
  // #region
  it('Verify that the access for catalog collections is checked correctly', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Access Test Catalog Collection',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: catalogCollection.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: catalogCollection.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          catalogCollectionId: catalogCollection.id,
          userId: userFive.id,
          permissionLevel: PermissionLevel.OWNER,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    const check4 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFiveCtx
    )
    expect(check4).toBeTruthy()

    // validate the access checks for WRITE access
    const check5 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check5).toBeFalsy()

    const check6 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check6).toBeTruthy()

    const check7 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check7).toBeTruthy()

    const check8 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFiveCtx
    )
    expect(check8).toBeTruthy()

    // validate the access checks for ADMIN access
    const check9 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check9).toBeFalsy()

    const check10 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check10).toBeFalsy()

    const check11 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check11).toBeTruthy()

    const check12 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFiveCtx
    )
    expect(check12).toBeTruthy()

    // validate the access checks for OWNER access
    const check13 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
      ],
      userTwoCtx
    )
    expect(check13).toBeFalsy()

    const check14 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
      ],
      userThreeCtx
    )
    expect(check14).toBeFalsy()

    const check15 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
      ],
      userFourCtx
    )
    expect(check15).toBeFalsy()

    const check16 = await checkAccess(
      [
        {
          catalogCollectionId: catalogCollection.id,
          minimumPermissionLevel: PermissionLevel.OWNER,
        },
      ],
      userFiveCtx
    )
    expect(check16).toBeTruthy()
  })

  it('Verify that the access for answer collections is checked correctly', async () => {
    // create a catalog collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Access Test Answer Collection',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: answerCollection.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: answerCollection.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          answerCollectionId: answerCollection.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for elements is checked correctly', async () => {
    // create an element
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          elementId: element.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: element.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          elementId: element.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          elementId: element.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for live quizzes is checked correctly', async () => {
    // create a live quiz
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        description: 'Test Description',
        ownerId: userOne.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          liveQuizId: liveQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for practice quizzes is checked correctly', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Practice Quiz Course',
        displayName: 'Practice Quiz Course',
        description: 'Test Description',
        pinCode: 5555,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a practice quiz
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz',
        displayName: 'Practice Quiz',
        description: 'Test Description',
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          practiceQuizId: practiceQuiz.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          practiceQuizId: practiceQuiz.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for microlearnings is checked correctly', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Microlearning Course',
        displayName: 'Microlearning Course',
        description: 'Test Description',
        pinCode: 6666,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a microlearning
    const microlearning = await prisma.microLearning.create({
      data: {
        name: 'Microlearning',
        displayName: 'Microlearning',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          microLearningId: microlearning.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          microLearningId: microlearning.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: microlearning.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for group activities is checked correctly', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Group Activity Course',
        displayName: 'Group Activity Course',
        description: 'Test Description',
        pinCode: 7777,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a group activity
    const groupActivity = await prisma.groupActivity.create({
      data: {
        name: 'Group Activity',
        displayName: 'Group Activity',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          groupActivityId: groupActivity.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          groupActivityId: groupActivity.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          groupActivityId: groupActivity.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify that the access for courses is checked correctly', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course Test',
        displayName: 'Course Test',
        description: 'Test Description',
        pinCode: 8888,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create derived READ, WRITE, and ADMIN permissions for users 2, 3, and 4
    await prisma.derivedPermission.createMany({
      data: [
        {
          courseId: course.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          courseId: course.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          courseId: course.id,
          userId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // validate the access checks for READ access
    const check1 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    const check2 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    const check3 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFourCtx
    )
    expect(check3).toBeTruthy()

    // validate the access checks for WRITE access
    const check4 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userTwoCtx
    )
    expect(check4).toBeFalsy()

    const check5 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userThreeCtx
    )
    expect(check5).toBeTruthy()

    const check6 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
      ],
      userFourCtx
    )
    expect(check6).toBeTruthy()

    // validate the access checks for ADMIN access
    const check7 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check7).toBeFalsy()

    const check8 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check8).toBeFalsy()

    const check9 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userFourCtx
    )
    expect(check9).toBeTruthy()
  })

  it('Verify multiple combined access checks work correctly', async () => {
    // create a course with associated activities
    const course = await prisma.course.create({
      data: {
        name: 'Combined Access Course',
        displayName: 'Combined Access Course',
        description: 'Test Description',
        pinCode: 9999,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz Combined',
        displayName: 'Practice Quiz Combined',
        description: 'Test Description',
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    const microlearning = await prisma.microLearning.create({
      data: {
        name: 'Microlearning Combined',
        displayName: 'Microlearning Combined',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create permissions for different users
    await prisma.derivedPermission.createMany({
      data: [
        {
          courseId: course.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: microlearning.id,
          userId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          courseId: course.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          practiceQuizId: practiceQuiz.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          microLearningId: microlearning.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // test combined access checks - positive cases
    // user 2 has WRITE on practiceQuiz and READ on microlearning
    const check1 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userTwoCtx
    )
    expect(check1).toBeTruthy()

    // user 3 has ADMIN on course and microlearning
    const check2 = await checkAccess(
      [
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check2).toBeTruthy()

    // test combined access checks - negative cases
    // user 2 does not have ADMIN on practiceQuiz
    const check3 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userTwoCtx
    )
    expect(check3).toBeFalsy()

    // user 3 does not have WRITE on practiceQuiz
    const check4 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.WRITE,
        },
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      userThreeCtx
    )
    expect(check4).toBeFalsy()

    // user without any permissions
    const check5 = await checkAccess(
      [
        {
          practiceQuizId: practiceQuiz.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
        {
          microLearningId: microlearning.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
        {
          courseId: course.id,
          minimumPermissionLevel: PermissionLevel.READ,
        },
      ],
      userFiveCtx
    )
    expect(check5).toBeFalsy()
  })
  // #endregion

  // ! Duplication of Pending Access Requests
  // #region
  it('Verify that the helper function for duplicating existing access requests for new admins works correctly', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create two access requests for users 2 and 3 on the public catalog
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // trigger the duplication computation for the access requests for a new admin user 4
    await createAccessRequestInstancesNewAdmin(
      {
        newAdminId: userFour.id,
        existingAdminOwnerId: userOne.id,
        catalogCollectionId: publicCatalog.id,
      },
      prisma
    )

    // verify that the access requests have been duplicated correctly
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    const AR1 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(AR1).toBeTruthy()
    expect(AR1!.permissionLevel).toBe(PermissionLevel.READ)

    const AR2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(AR2).toBeTruthy()
    expect(AR2!.permissionLevel).toBe(PermissionLevel.WRITE)
  })

  it('Test that resolving an access request with ADMIN permissions triggers a duplication of pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // create two access requests for the public catalog collection (user 2 and 3)
    const catalogRequest2 = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const catalogRequest3 = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create two access requests for the answer collection (user 2 and 3)
    const collectionRequest2 = await prisma.accessRequest.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const collectionRequest3 = await prisma.accessRequest.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // resolve the access requests for user two and grant ADMIN permissions
    await resolveObjectSharingRequest(
      {
        requestId: catalogRequest2.id,
        permissionLevel: PermissionLevel.ADMIN,
        approved: true,
        userId: userTwo.id,
        propagation: false,
      },
      userOneCtx
    )
    await resolveObjectSharingRequest(
      {
        requestId: collectionRequest2.id,
        permissionLevel: PermissionLevel.ADMIN,
        approved: true,
        userId: userTwo.id,
        propagation: false,
      },
      userOneCtx
    )

    // verify that the access requests for user 3 have been duplicated and assigned to user 2 as well
    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.id).toBe(catalogRequest3.id)
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Duplicated).toBeTruthy()
    expect(catalogRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.id).toBe(collectionRequest3.id)
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    const collectionRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Duplicated).toBeTruthy()
    expect(collectionRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
  })

  it('Test that increasing the level of an existing individual permission to ADMIN level results in a duplication of all pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // grant READ permissions to user 2 on the public catalog collection and the answer collection
    const catalogPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const answerCollectionPermission = await prisma.permission.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // create two access requests on the two objects for user 3
    const catalogRequest3 = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const collectionRequest3 = await prisma.accessRequest.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    // increase the permission level of user 2 to ADMIN (both objects)
    await changeObjectPermissionLevel(
      {
        permissionId: catalogPermission.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    await changeObjectPermissionLevel(
      {
        permissionId: answerCollectionPermission.id,
        permissionLevel: PermissionLevel.ADMIN,
        answerCollectionId: AC1!.id,
      },
      userOneCtx
    )

    // verify that the access requests have been duplicated for the new ADMIN
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.id).toBe(catalogRequest3.id)
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Duplicated).toBeTruthy()
    expect(catalogRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.id).toBe(collectionRequest3.id)
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Duplicated).toBeTruthy()
    expect(collectionRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Test that increasing the level of an existing group permission to ADMIN level results in a duplication of all pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 2 and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Test User Group',
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
        ownerId: userOne.id,
      },
    })

    // grant READ permissions to the user group on the public catalog collection
    const groupPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // create access requests for users 4 and 5 on the public catalog collection
    const catalogRequest4 = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const catalogRequest5 = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // increase the permission level of the user group to ADMIN
    await changeObjectPermissionLevel(
      {
        permissionId: groupPermission.id,
        permissionLevel: PermissionLevel.ADMIN,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )

    // verify that a correct audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectId: publicCatalog.id,
        objectType: ObjectType.CATALOG_COLLECTION,
        sourceUserId: userOne.id,
        targetUserGroupId: userGroup.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.ADMIN} for ${ObjectType.CATALOG_COLLECTION} (ID ${publicCatalog.id}) through owner / admin ${userOne.id} for user group ${userGroup.id}.`
    )

    // verify that the access request for user 4 has been duplicated for users 2 and 3
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(6)

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.id).toBe(catalogRequest4.id)
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Duplicated1 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Duplicated1).toBeTruthy()
    expect(catalogRequest4Duplicated1!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Duplicated2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest4Duplicated2).toBeTruthy()
    expect(catalogRequest4Duplicated2!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest5Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest5Persistent).toBeTruthy()
    expect(catalogRequest5Persistent!.id).toBe(catalogRequest5.id)
    expect(catalogRequest5Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest5Duplicated1 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest5Duplicated1).toBeTruthy()
    expect(catalogRequest5Duplicated1!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest5Duplicated2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest5Duplicated2).toBeTruthy()
    expect(catalogRequest5Duplicated2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Test that reduction the level of an existing individual permission from ADMIN level results in a duplication of all pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // grant ADMIN permissions to user 2 on the public catalog collection and the answer collection
    const catalogPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const answerCollectionPermission = await prisma.permission.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // create access requests for user 3 for the owner and the ADMIN user
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // reduce the permission level of user 2 to WRITE and READ (both objects)
    await changeObjectPermissionLevel(
      {
        permissionId: catalogPermission.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    await changeObjectPermissionLevel(
      {
        permissionId: answerCollectionPermission.id,
        permissionLevel: PermissionLevel.READ,
        answerCollectionId: AC1!.id,
      },
      userOneCtx
    )

    // verify that the access requests for the previous ADMIN user have been removed
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest3Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Removed).toBeNull()

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest3Removed = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Removed).toBeNull()
  })

  it('Test that reduction the level of an existing group permission from ADMIN level results in a duplication of all pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 2 and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Test User Group',
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
        ownerId: userOne.id,
      },
    })

    // grant ADMIN permissions to the user group on the public catalog collection
    const groupPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // create access requests for users 4 and 5 on the public catalog collection
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // reduce the permission level of the user group to WRITE
    await changeObjectPermissionLevel(
      {
        permissionId: groupPermission.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )

    // verify that the access request instances for users 4 and 5 have been removed for previous ADMINS 2 and 3
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Removed).toBeNull()

    const catalogRequest4Removed2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest4Removed2).toBeNull()

    const catalogRequest5Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest5Persistent).toBeTruthy()
    expect(catalogRequest5Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest5Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest5Removed).toBeNull()

    const catalogRequest5Removed2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest5Removed2).toBeNull()
  })

  it('Test that reduction the level of existing mixed permissions from ADMIN level results in a removal of all pending access requests for users without other access', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant individual ADMIN access to users 2, 4, and 5
    const permission2 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const permission4 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFour.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const permission5 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // create a user group with users 3 and 4 and a single participant group for user 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Test User Group 1',
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
        ownerId: userOne.id,
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Test User Group 2',
        members: {
          connect: [{ id: userFive.id }],
        },
        ownerId: userOne.id,
      },
    })

    // grant group ADMIN permissions to the user groups
    const groupPermission1 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup1.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const groupPermission2 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup2.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // create an access request for user 6 with instances for all ADMINS
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestCount1 = await prisma.accessRequest.count()
    expect(accessRequestCount1).toBe(4)

    // lower the individual permission of user 2 -> access request for user 2 should be removed
    await changeObjectPermissionLevel(
      {
        permissionId: permission2.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(3)

    const removedAccessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(removedAccessRequest2).toBeNull()

    // lower the group permission of user group 1 (users 3 and 4)
    // access request for user 3 should be removed, but not for user 4 (retains individual ADMIN access)
    await changeObjectPermissionLevel(
      {
        permissionId: groupPermission1.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(2)
    const removedAccessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(removedAccessRequest3).toBeNull()

    const retainedAccessRequest4 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(retainedAccessRequest4).toBeTruthy()
    expect(retainedAccessRequest4!.permissionLevel).toBe(PermissionLevel.WRITE)

    // lower the individual permission for user 5 -> access request for user 5 should persist (group ADMIN access)
    await changeObjectPermissionLevel(
      {
        permissionId: permission5.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount4 = await prisma.accessRequest.count()
    expect(accessRequestCount4).toBe(2)

    const retainedAccessRequest5 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(retainedAccessRequest5).toBeTruthy()
    expect(retainedAccessRequest5!.permissionLevel).toBe(PermissionLevel.WRITE)
  })

  it('Verify that on revocation of individual ADMIN object permissions, access request instances are removed for the previous ADMIN', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // grant ADMIN permissions to user 2 on the public catalog collection and the answer collection
    const catalogPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const answerCollectionPermission = await prisma.permission.create({
      data: {
        answerCollectionId: AC1!.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // create access requests for users 3 and 4 on both objects
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // revoke the permissions of user 2 from both objects
    await revokeObjectAccess(
      {
        permissionId: catalogPermission.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    await revokeObjectAccess(
      {
        permissionId: answerCollectionPermission.id,
        answerCollectionId: AC1!.id,
      },
      userOneCtx
    )

    // verify that the access requests for user 3 and 4 have been removed for the previous ADMIN
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest3Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Removed).toBeNull()

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest4Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Removed).toBeNull()

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest3Removed = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Removed).toBeNull()

    const collectionRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest4Persistent).toBeTruthy()
    expect(collectionRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest4Removed = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest4Removed).toBeNull()
  })

  it('Verify that on revocation of group ADMIN object permissions, access request instances are removed for the previous ADMIN', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create a user group with users 2 and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Test User Group',
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
        ownerId: userOne.id,
      },
    })

    // grant ADMIN permissions to the user group on the public catalog collection
    const groupPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // create access requests for users 4 and 5 on the public catalog collection
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // revoke the permissions of user group from the public catalog collection
    await revokeObjectAccess(
      {
        permissionId: groupPermission.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )

    // verify that the access requests for user 4 and 5 have been removed for the previous ADMIN
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Removed).toBeNull()

    const catalogRequest4Removed2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest4Removed2).toBeNull()

    const catalogRequest5Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest5Persistent).toBeTruthy()
    expect(catalogRequest5Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest5Removed = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest5Removed).toBeNull()

    const catalogRequest5Removed2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFive.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(catalogRequest5Removed2).toBeNull()
  })

  it('Verify that on revocation of mixed ADMIN object permissions, access request instances are removed only for users without other access', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant individual ADMIN access to users 2, 4, and 5
    const permission2 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const permission4 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFour.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const permission5 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // create a user group with users 3 and 4 and a single participant group for user 5
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'Test User Group 1',
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
        ownerId: userOne.id,
      },
    })
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'Test User Group 2',
        members: {
          connect: [{ id: userFive.id }],
        },
        ownerId: userOne.id,
      },
    })

    // grant group ADMIN permissions to the user groups
    const groupPermission1 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup1.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const groupPermission2 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userGroupId: userGroup2.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )

    // create an access request for user 6 with instances for all ADMINS
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestCount1 = await prisma.accessRequest.count()
    expect(accessRequestCount1).toBe(4)

    // revoke the individual permission of user 2 -> access request for user 2 should be removed
    await revokeObjectAccess(
      {
        permissionId: permission2.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(3)

    const removedAccessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(removedAccessRequest2).toBeNull()

    // revoke the group permission of user group 1 (users 3 and 4)
    // access request for user 3 should be removed, but not for user 4 (retains individual ADMIN access)
    await revokeObjectAccess(
      {
        permissionId: groupPermission1.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(2)
    const removedAccessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(removedAccessRequest3).toBeNull()

    const retainedAccessRequest4 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(retainedAccessRequest4).toBeTruthy()
    expect(retainedAccessRequest4!.permissionLevel).toBe(PermissionLevel.WRITE)

    // revoke the individual permission for user 5 -> access request for user 5 should persist (group ADMIN access)
    await revokeObjectAccess(
      {
        permissionId: permission5.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount4 = await prisma.accessRequest.count()
    expect(accessRequestCount4).toBe(2)

    const retainedAccessRequest5 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(retainedAccessRequest5).toBeTruthy()
    expect(retainedAccessRequest5!.permissionLevel).toBe(PermissionLevel.WRITE)
  })

  it('Verify that any pending access requests are also assigned to new owner on catalog collection ownership transfer', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // create access requests for users 3 and 4
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    // transfer ownership of the catalog collection to user 2
    await transferCatalogCollectionOwnership(
      {
        id: publicCatalog.id,
        shortnameOrEmail: userTwo.shortname,
      },
      userOneCtx
    )

    // verify that the access requests have been duplicated for the new owner
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Duplicated).toBeTruthy()
    expect(catalogRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest4Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Duplicated).toBeTruthy()
    expect(catalogRequest4Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Verify that any pending access requests are also assigned to new owner on answer collection ownership transfer', async () => {
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // create access requests for users 3 and 4
    await prisma.accessRequest.createMany({
      data: [
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(2)

    // transfer ownership of the answer collection to user 2
    await transferAnswerCollectionOwnership(
      {
        id: AC1!.id,
        shortnameOrEmail: userTwo.shortname,
      },
      userOneCtx
    )

    // verify that the access requests have been duplicated for the new owner
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Duplicated).toBeTruthy()
    expect(collectionRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest4Persistent).toBeTruthy()
    expect(collectionRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest4Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest4Duplicated).toBeTruthy()
    expect(collectionRequest4Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Verify that any pending access requests to an object are duplicated when granting ADMIN permissions to a new user', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const [AC1] = await seedAnswerCollections(userOneCtx)

    // create access requests for users 3 and 4
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })

    // grant ADMIN permissions to user 2 on the public catalog collection and the answer collection
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.shortname,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.shortname,
        answerCollectionId: AC1!.id,
      },
      userOneCtx
    )

    // verify that the access requests have been duplicated for the new ADMIN
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(8)

    const catalogRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest3Persistent).toBeTruthy()
    expect(catalogRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest3Duplicated).toBeTruthy()
    expect(catalogRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(catalogRequest4Persistent).toBeTruthy()
    expect(catalogRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const catalogRequest4Duplicated = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(catalogRequest4Duplicated).toBeTruthy()
    expect(catalogRequest4Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest3Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest3Persistent).toBeTruthy()
    expect(collectionRequest3Persistent!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest3Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest3Duplicated).toBeTruthy()
    expect(collectionRequest3Duplicated!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const collectionRequest4Persistent = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(collectionRequest4Persistent).toBeTruthy()
    expect(collectionRequest4Persistent!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const collectionRequest4Duplicated = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(collectionRequest4Duplicated).toBeTruthy()
    expect(collectionRequest4Duplicated!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Verify that any pending access requests to an object are duplicated when granting ADMIN permissions to a new user group', async () => {
    // TODO: introduce this test case, once user groups are supported in direct object sharing
    // const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    // // create a user group with users 2 and 3
    // const userGroup = await prisma.userGroup.create({
    //   data: {
    //     name: 'Test User Group',
    //     members: {
    //       connect: [{ id: userTwo.id }, { id: userThree.id }],
    //     },
    //     ownerId: userOne.id,
    //   },
    // })
    // // create access requests for users 4 and 5
    // await prisma.accessRequest.createMany({
    //   data: [
    //     {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFour.id,
    //       objectAdminOrOwnerId: userOne.id,
    //       permissionLevel: PermissionLevel.READ,
    //     },
    //     {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFive.id,
    //       objectAdminOrOwnerId: userOne.id,
    //       permissionLevel: PermissionLevel.WRITE,
    //     },
    //   ],
    // })
    // // grant ADMIN permissions to user group on the public catalog collection
    // await shareObject(
    //   {
    //     userGroupId: userGroup.id,
    //     permissionLevel: PermissionLevel.ADMIN,
    //     catalogCollectionId: publicCatalog.id,
    //   },
    //   userOneCtx
    // )
    // // verify that the access requests have been duplicated for the new ADMIN
    // const accessRequestCount = await prisma.accessRequest.count()
    // expect(accessRequestCount).toBe(6)
    // const catalogRequest4Persistent = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFour.id,
    //       objectAdminOrOwnerId: userOne.id,
    //     },
    //   },
    // })
    // expect(catalogRequest4Persistent).toBeTruthy()
    // expect(catalogRequest4Persistent!.permissionLevel).toBe(
    //   PermissionLevel.READ
    // )
    // const catalogRequest4Duplicated1 = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFour.id,
    //       objectAdminOrOwnerId: userTwo.id,
    //     },
    //   },
    // })
    // expect(catalogRequest4Duplicated1).toBeTruthy()
    // expect(catalogRequest4Duplicated1!.permissionLevel).toBe(
    //   PermissionLevel.READ
    // )
    // const catalogRequest4Duplicated2 = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFour.id,
    //       objectAdminOrOwnerId: userThree.id,
    //     },
    //   },
    // })
    // expect(catalogRequest4Duplicated2).toBeTruthy()
    // expect(catalogRequest4Duplicated2!.permissionLevel).toBe(
    //   PermissionLevel.READ
    // )
    // const catalogRequest5Persistent = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFive.id,
    //       objectAdminOrOwnerId: userOne.id,
    //     },
    //   },
    // })
    // expect(catalogRequest5Persistent).toBeTruthy()
    // expect(catalogRequest5Persistent!.permissionLevel).toBe(
    //   PermissionLevel.WRITE
    // )
    // const catalogRequest5Duplicated1 = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFive.id,
    //       objectAdminOrOwnerId: userTwo.id,
    //     },
    //   },
    // })
    // expect(catalogRequest5Duplicated1).toBeTruthy()
    // expect(catalogRequest5Duplicated1!.permissionLevel).toBe(
    //   PermissionLevel.WRITE
    // )
    // const catalogRequest5Duplicated2 = await prisma.accessRequest.findUnique({
    //   where: {
    //     catalogCollectionId_userId_objectAdminOrOwnerId: {
    //       catalogCollectionId: publicCatalog.id,
    //       userId: userFive.id,
    //       objectAdminOrOwnerId: userThree.id,
    //     },
    //   },
    // })
    // expect(catalogRequest5Duplicated2).toBeTruthy()
    // expect(catalogRequest5Duplicated2!.permissionLevel).toBe(
    //   PermissionLevel.WRITE
    // )
  })
  // #endregion

  // ! Catalog Collection Assignment Validation
  // #region
  async function createCatalogCollections(prisma) {
    // create a public catalog collection
    const publicCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Test Description',
        ownerId: userOne.id,
        access: ObjectAccess.PUBLIC,
      },
    })

    // create a restricted catalog collection
    const restrictedCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Restricted Catalog Collection',
        description: 'Test Description',
        ownerId: userOne.id,
        access: ObjectAccess.RESTRICTED,
      },
    })

    // grant READ permissions to user 2 on the restricted catalog collection
    await prisma.permission.create({
      data: {
        catalogCollectionId: restrictedCollection.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCollection.id },
      prisma
    )

    return { publicCollection, restrictedCollection }
  }

  async function testObjectAssignment(args: {
    publicCollectionId: string
    restrictedCollectionId: string
    publicAnswerCollectionId?: number
    restrictedAnswerCollectionId?: number
    publicElementId?: number
    restrictedElementId?: number
    publicLiveQuizId?: string
    restrictedLiveQuizId?: string
    publicPracticeQuizId?: string
    restrictedPracticeQuizId?: string
    publicMicrolearningId?: string
    restrictedMicrolearningId?: string
    publicGroupActivityId?: string
    restrictedGroupActivityId?: string
    publicCourseId?: string
    restrictedCourseId?: string
  }) {
    // assign the object with public or restricted access, respectively, to the catalog collections
    await prisma.catalogCollectionAssignment.createMany({
      data: [
        {
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          answerCollectionId: args.publicAnswerCollectionId,
          elementId: args.publicElementId,
          liveQuizId: args.publicLiveQuizId,
          practiceQuizId: args.publicPracticeQuizId,
          microLearningId: args.publicMicrolearningId,
          groupActivityId: args.publicGroupActivityId,
          courseId: args.publicCourseId,
          access: ObjectAccess.PUBLIC,
        },
        {
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          answerCollectionId: args.restrictedAnswerCollectionId,
          elementId: args.restrictedElementId,
          liveQuizId: args.restrictedLiveQuizId,
          practiceQuizId: args.restrictedPracticeQuizId,
          microLearningId: args.restrictedMicrolearningId,
          groupActivityId: args.restrictedGroupActivityId,
          courseId: args.restrictedCourseId,
          access: ObjectAccess.RESTRICTED,
        },
        {
          catalogCollectionId: args.publicCollectionId,
          answerCollectionId: args.publicAnswerCollectionId,
          elementId: args.publicElementId,
          liveQuizId: args.publicLiveQuizId,
          practiceQuizId: args.publicPracticeQuizId,
          microLearningId: args.publicMicrolearningId,
          groupActivityId: args.publicGroupActivityId,
          courseId: args.publicCourseId,
          access: ObjectAccess.PUBLIC,
        },
        {
          catalogCollectionId: args.publicCollectionId,
          answerCollectionId: args.restrictedAnswerCollectionId,
          elementId: args.restrictedElementId,
          liveQuizId: args.restrictedLiveQuizId,
          practiceQuizId: args.restrictedPracticeQuizId,
          microLearningId: args.restrictedMicrolearningId,
          groupActivityId: args.restrictedGroupActivityId,
          courseId: args.restrictedCourseId,
          access: ObjectAccess.RESTRICTED,
        },
        {
          catalogCollectionId: args.restrictedCollectionId,
          answerCollectionId: args.publicAnswerCollectionId,
          elementId: args.publicElementId,
          liveQuizId: args.publicLiveQuizId,
          practiceQuizId: args.publicPracticeQuizId,
          microLearningId: args.publicMicrolearningId,
          groupActivityId: args.publicGroupActivityId,
          courseId: args.publicCourseId,
          access: ObjectAccess.PUBLIC,
        },
        {
          catalogCollectionId: args.restrictedCollectionId,
          answerCollectionId: args.restrictedAnswerCollectionId,
          elementId: args.restrictedElementId,
          liveQuizId: args.restrictedLiveQuizId,
          practiceQuizId: args.restrictedPracticeQuizId,
          microLearningId: args.restrictedMicrolearningId,
          groupActivityId: args.restrictedGroupActivityId,
          courseId: args.restrictedCourseId,
          access: ObjectAccess.RESTRICTED,
        },
      ],
    })

    // type the public and restricted object clauses correctly for compatibility with checkCatalogAssignment function
    let publicObjectClause:
      | { answerCollectionId: number }
      | { elementId: number }
      | { liveQuizId: string }
      | { practiceQuizId: string }
      | { microLearningId: string }
      | { groupActivityId: string }
      | { courseId: string }
    let restrictedObjectClause:
      | { answerCollectionId: number }
      | { elementId: number }
      | { liveQuizId: string }
      | { practiceQuizId: string }
      | { microLearningId: string }
      | { groupActivityId: string }
      | { courseId: string }

    if (
      typeof args.publicAnswerCollectionId !== 'undefined' &&
      typeof args.restrictedAnswerCollectionId !== 'undefined'
    ) {
      publicObjectClause = { answerCollectionId: args.publicAnswerCollectionId }
      restrictedObjectClause = {
        answerCollectionId: args.restrictedAnswerCollectionId,
      }
    } else if (
      typeof args.publicElementId !== 'undefined' &&
      typeof args.restrictedElementId !== 'undefined'
    ) {
      publicObjectClause = { elementId: args.publicElementId }
      restrictedObjectClause = { elementId: args.restrictedElementId }
    } else if (
      typeof args.publicLiveQuizId !== 'undefined' &&
      typeof args.restrictedLiveQuizId !== 'undefined'
    ) {
      publicObjectClause = { liveQuizId: args.publicLiveQuizId }
      restrictedObjectClause = { liveQuizId: args.restrictedLiveQuizId }
    } else if (
      typeof args.publicPracticeQuizId !== 'undefined' &&
      typeof args.restrictedPracticeQuizId !== 'undefined'
    ) {
      publicObjectClause = { practiceQuizId: args.publicPracticeQuizId }
      restrictedObjectClause = {
        practiceQuizId: args.restrictedPracticeQuizId,
      }
    } else if (
      typeof args.publicMicrolearningId !== 'undefined' &&
      typeof args.restrictedMicrolearningId !== 'undefined'
    ) {
      publicObjectClause = { microLearningId: args.publicMicrolearningId }
      restrictedObjectClause = {
        microLearningId: args.restrictedMicrolearningId,
      }
    } else if (
      typeof args.publicGroupActivityId !== 'undefined' &&
      typeof args.restrictedGroupActivityId !== 'undefined'
    ) {
      publicObjectClause = { groupActivityId: args.publicGroupActivityId }
      restrictedObjectClause = {
        groupActivityId: args.restrictedGroupActivityId,
      }
    } else if (
      typeof args.publicCourseId !== 'undefined' &&
      typeof args.restrictedCourseId !== 'undefined'
    ) {
      publicObjectClause = { courseId: args.publicCourseId }
      restrictedObjectClause = { courseId: args.restrictedCourseId }
    } else {
      throw new Error('No valid object clause found.')
    }

    // public object in top-level catalog collection -> true if no access arg, true if access public, false if access restricted
    const access1 = await checkCatalogAssignment(
      { ...publicObjectClause },
      userThreeCtx
    )
    expect(access1).toBeTruthy()

    const access2 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        access: ObjectAccess.PUBLIC,
      },
      userThreeCtx
    )
    expect(access2).toBeTruthy()

    const access3 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(access3).toBeFalsy()

    // public object in public catalog collection -> true if no access arg, true if access public, false if access restricted
    const access4 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.publicCollectionId,
      },
      userThreeCtx
    )
    expect(access4).toBeTruthy()

    const access5 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.publicCollectionId,
        access: ObjectAccess.PUBLIC,
      },
      userThreeCtx
    )
    expect(access5).toBeTruthy()

    const access6 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.publicCollectionId,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(access6).toBeFalsy()

    // public object in restricted catalog collection -> false if no access to catalog collection, true if no access arg / access public, false if access restricted
    const access7 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
      },
      userThreeCtx
    )
    expect(access7).toBeFalsy()

    const access8 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
      },
      userTwoCtx
    )
    expect(access8).toBeTruthy()

    const access9 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(access9).toBeTruthy()

    const access10 = await checkCatalogAssignment(
      {
        ...publicObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
        access: ObjectAccess.RESTRICTED,
      },
      userTwoCtx
    )
    expect(access10).toBeFalsy()

    // restricted object in top-level catalog collection -> true if no access arg, false if access public, true if access restricted
    const access11 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
      },
      userThreeCtx
    )
    expect(access11).toBeTruthy()

    const access12 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        access: ObjectAccess.PUBLIC,
      },
      userThreeCtx
    )
    expect(access12).toBeFalsy()

    const access13 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(access13).toBeTruthy()

    // restricted object in public catalog collection -> true if no access arg, false if access public, true if access restricted
    const access14 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.publicCollectionId,
      },
      userThreeCtx
    )
    expect(access14).toBeTruthy()

    const access15 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.publicCollectionId,
        access: ObjectAccess.PUBLIC,
      },
      userThreeCtx
    )
    expect(access15).toBeFalsy()

    const access16 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.publicCollectionId,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(access16).toBeTruthy()

    // restricted object in restricted catalog collection -> false if no access to catalog collection, false if access public, true if no access arg / accessrestricted
    const access17 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
      },
      userThreeCtx
    )
    expect(access17).toBeFalsy()

    const access18 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
      },
      userTwoCtx
    )
    expect(access18).toBeTruthy()

    const access19 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(access19).toBeFalsy()

    const access20 = await checkCatalogAssignment(
      {
        ...restrictedObjectClause,
        catalogCollectionId: args.restrictedCollectionId,
        access: ObjectAccess.RESTRICTED,
      },
      userTwoCtx
    )
    expect(access20).toBeTruthy()
  }

  it('Verify that the access to an answer collection in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create an answer collection
    const publicAnswerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })

    // create a second answer collection
    const restrictedAnswerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection 2',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicAnswerCollectionId: publicAnswerCollection.id,
      restrictedAnswerCollectionId: restrictedAnswerCollection.id,
    })
  })

  it('Verify that the access to an element in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create an element
    const publicElement = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
      },
    })

    // create a second element
    const restrictedElement = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Element 2',
        content: 'Content 2',
        options: {},
        ownerId: userOne.id,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicElementId: publicElement.id,
      restrictedElementId: restrictedElement.id,
    })
  })

  it('Verify that the access to a live quiz in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create a live quiz
    const publicLiveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        description: 'Test Description',
        ownerId: userOne.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create a second live quiz
    const restrictedLiveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz 2',
        displayName: 'Live Quiz 2',
        description: 'Test Description',
        ownerId: userOne.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicLiveQuizId: publicLiveQuiz.id,
      restrictedLiveQuizId: restrictedLiveQuiz.id,
    })
  })

  it('Verify that the access to a practice quiz in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course Test',
        displayName: 'Course Test',
        description: 'Test Description',
        pinCode: 8888,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a practice quiz
    const publicPracticeQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz',
        displayName: 'Practice Quiz',
        description: 'Test Description',
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create a second practice quiz
    const restrictedPracticeQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz 2',
        displayName: 'Practice Quiz 2',
        description: 'Test Description',
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicPracticeQuizId: publicPracticeQuiz.id,
      restrictedPracticeQuizId: restrictedPracticeQuiz.id,
    })
  })

  it('Verify that the access to a microlearning in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course Test',
        displayName: 'Course Test',
        description: 'Test Description',
        pinCode: 8888,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a microlearning
    const publicMicrolearning = await prisma.microLearning.create({
      data: {
        name: 'Microlearning',
        displayName: 'Microlearning',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create a second microlearning
    const restrictedMicrolearning = await prisma.microLearning.create({
      data: {
        name: 'Microlearning 2',
        displayName: 'Microlearning 2',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicMicrolearningId: publicMicrolearning.id,
      restrictedMicrolearningId: restrictedMicrolearning.id,
    })
  })

  it('Verify that the access to a group activity in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course Test',
        displayName: 'Course Test',
        description: 'Test Description',
        pinCode: 8888,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a group activity
    const publicGroupActivity = await prisma.groupActivity.create({
      data: {
        name: 'Group Activity',
        displayName: 'Group Activity',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // create a second group activity
    const restrictedGroupActivity = await prisma.groupActivity.create({
      data: {
        name: 'Group Activity 2',
        displayName: 'Group Activity 2',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        status: PublicationStatus.PUBLISHED,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicGroupActivityId: publicGroupActivity.id,
      restrictedGroupActivityId: restrictedGroupActivity.id,
    })
  })

  it('Verify that the access to a course in the catalog is checked correctly', async () => {
    const { publicCollection, restrictedCollection } =
      await createCatalogCollections(prisma)

    // create a course
    const publicCourse = await prisma.course.create({
      data: {
        name: 'Course Test',
        displayName: 'Course Test',
        description: 'Test Description',
        pinCode: 8888,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a second course
    const restrictedCourse = await prisma.course.create({
      data: {
        name: 'Course Test 2',
        displayName: 'Course Test 2',
        description: 'Test Description',
        pinCode: 9999,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // validate the correctness of the catalog collection assignment validation logic
    await testObjectAssignment({
      publicCollectionId: publicCollection.id,
      restrictedCollectionId: restrictedCollection.id,
      publicCourseId: publicCourse.id,
      restrictedCourseId: restrictedCourse.id,
    })
  })
  // #endregion
})
