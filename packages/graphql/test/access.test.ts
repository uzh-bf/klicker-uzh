import {
  ElementType,
  ObjectAccess,
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
import { checkAccess, checkCatalogAssignment } from '../src/services/sharing.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests for object access validation', () => {
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

  // ! Catalog Collection Assignment Validation
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
})
