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
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
  updateAccessRequestInstances,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeObjectPermissionLevel,
  checkAccess,
  checkCatalogAssignment,
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
  seedElements,
  seedLiveQuiz,
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

describe('Integration tests for object access validation', () => {
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

  // ! Access Validation
  // #region
  it('Rejects empty access check lists', async () => {
    await expect(checkAccess([], userOneCtx)).rejects.toThrow(
      'At least one permission check is required.'
    )
  })

  it('Rejects unsupported object types in sharing mutations', async () => {
    const resolver = schema.getMutationType()?.getFields().shareObject?.resolve
    expect(resolver).toBeDefined()

    const result = await resolver!(
      {},
      {
        objectId: '1',
        objectType: ObjectType.USER_GROUP,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        userGroupId: null,
        propagation: false,
      },
      userOneCtx,
      {} as never
    )

    expect(result).toBeNull()
  })

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

  // ! Updates of Pending Access Requests
  // #region
  it('Verify that new access request instances are created for new object admins (with userId argument)', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC!.id)

    // create an access request for user 2 on all objects
    const catalogRequest = await prisma.accessRequest.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const answerCollectionRequest = await prisma.accessRequest.create({
      data: {
        answerCollectionId: AC!.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const elementRequest = await prisma.accessRequest.create({
      data: {
        elementId: SC.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // add ADMIN permissions for user 3 on all objects
    await prisma.permission.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          answerCollectionId: AC!.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          elementId: SC.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // create a user group with users 4 and 5 and grant ADMIN permissions to the group on all objects
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        admins: { connect: { id: userFive.id } },
        members: { connect: { id: userFour.id } },
      },
    })
    await prisma.permission.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          answerCollectionId: AC!.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          elementId: SC.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // recompute the derived permissions on all objects without updating the access requests
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await recomputeDerivedPermissions({ elementId: SC.id }, prisma)

    // verify that still only three access requests are pending
    const pendingRequestsCount = await prisma.accessRequest.count()
    expect(pendingRequestsCount).toBe(3)

    // update the access request instances for user 3 on one object after the other and verify the results
    await updateAccessRequestInstances(
      { catalogCollectionId: publicCatalog.id, userId: userThree.id },
      prisma
    )
    const pendingRequestsCount2 = await prisma.accessRequest.count()
    expect(pendingRequestsCount2).toBe(4)
    const newRequest1 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newRequest1).toBeTruthy()
    expect(newRequest1!.permissionLevel).toBe(catalogRequest.permissionLevel)

    await updateAccessRequestInstances(
      { answerCollectionId: AC!.id, userId: userThree.id },
      prisma
    )
    const pendingRequestsCount3 = await prisma.accessRequest.count()
    expect(pendingRequestsCount3).toBe(5)
    const newRequest2 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newRequest2).toBeTruthy()
    expect(newRequest2!.permissionLevel).toBe(
      answerCollectionRequest.permissionLevel
    )

    await updateAccessRequestInstances(
      { elementId: SC.id, userId: userThree.id },
      prisma
    )
    const pendingRequestsCount4 = await prisma.accessRequest.count()
    expect(pendingRequestsCount4).toBe(6)
    const newRequest3 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newRequest3).toBeTruthy()
    expect(newRequest3!.permissionLevel).toBe(elementRequest.permissionLevel)

    // update the access request instances for user 4 on all objects in the same way
    await updateAccessRequestInstances(
      { catalogCollectionId: publicCatalog.id, userId: userFour.id },
      prisma
    )
    const pendingRequestsCount5 = await prisma.accessRequest.count()
    expect(pendingRequestsCount5).toBe(7)
    const newRequest4 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(newRequest4).toBeTruthy()
    expect(newRequest4!.permissionLevel).toBe(catalogRequest.permissionLevel)

    await updateAccessRequestInstances(
      { answerCollectionId: AC!.id, userId: userFour.id },
      prisma
    )
    const pendingRequestsCount6 = await prisma.accessRequest.count()
    expect(pendingRequestsCount6).toBe(8)
    const newRequest5 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(newRequest5).toBeTruthy()
    expect(newRequest5!.permissionLevel).toBe(
      answerCollectionRequest.permissionLevel
    )

    await updateAccessRequestInstances(
      { elementId: SC.id, userId: userFour.id },
      prisma
    )
    const pendingRequestsCount7 = await prisma.accessRequest.count()
    expect(pendingRequestsCount7).toBe(9)
    const newRequest6 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(newRequest6).toBeTruthy()
    expect(newRequest6!.permissionLevel).toBe(elementRequest.permissionLevel)

    // trigger access request recomputation through derived permissions update for user 5 on all objects
    await recomputeDerivedPermissions(
      {
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC!.id,
        userId: userFive.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: SC.id, userId: userFive.id, updateAccessRequests: true },
      prisma
    )

    // verify that the access requests for user 5 have been created
    const pendingRequestsCount8 = await prisma.accessRequest.count()
    expect(pendingRequestsCount8).toBe(12)

    const newRequest7 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(newRequest7).toBeTruthy()
    expect(newRequest7!.permissionLevel).toBe(catalogRequest.permissionLevel)

    const newRequest8 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(newRequest8).toBeTruthy()
    expect(newRequest8!.permissionLevel).toBe(
      answerCollectionRequest.permissionLevel
    )

    const newRequest9 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(newRequest9).toBeTruthy()
    expect(newRequest9!.permissionLevel).toBe(elementRequest.permissionLevel)
  })

  it('Verify that access request instances are removed alongisde derived permissions when user looses admin or owner access', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC!.id)

    // add ADMIN permissions for user 3 on all objects
    await prisma.permission.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          answerCollectionId: AC!.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          elementId: SC.id,
          userId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // create a user group with users 4 and 5 and grant ADMIN permissions to the group on all objects
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        admins: { connect: { id: userFive.id } },
        members: { connect: { id: userFour.id } },
      },
    })
    await prisma.permission.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          answerCollectionId: AC!.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          elementId: SC.id,
          userGroupId: group.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })

    // recompute the derived permissions on all objects without updating the access requests
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await recomputeDerivedPermissions({ elementId: SC.id }, prisma)

    // create access requests for user 2 on all objects and linked to all admins
    await prisma.accessRequest.createMany({
      data: [
        {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    const accessRequestsCount = await prisma.accessRequest.count()
    expect(accessRequestsCount).toBe(12)

    // remove the admin permissions for user 3 and the group
    await prisma.permission.deleteMany({
      where: {
        OR: [
          {
            catalogCollectionId: publicCatalog.id,
            userId: userThree.id,
          },
          {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
          {
            elementId: SC.id,
            userId: userThree.id,
          },
          {
            catalogCollectionId: publicCatalog.id,
            userGroupId: group.id,
          },
          {
            answerCollectionId: AC!.id,
            userGroupId: group.id,
          },
          {
            elementId: SC.id,
            userGroupId: group.id,
          },
        ],
      },
    })

    // recompute derived permissions without triggering an access request update
    await recomputeDerivedPermissions(
      { catalogCollectionId: publicCatalog.id },
      prisma
    )
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await recomputeDerivedPermissions({ elementId: SC.id }, prisma)
    const accessRequestsCount2 = await prisma.accessRequest.count()
    expect(accessRequestsCount2).toBe(12)

    // update the access request instances for user 3 and verify that they are removed correctly
    await updateAccessRequestInstances(
      { catalogCollectionId: publicCatalog.id, userId: userThree.id },
      prisma
    )
    await updateAccessRequestInstances(
      { answerCollectionId: AC!.id, userId: userThree.id },
      prisma
    )
    await updateAccessRequestInstances(
      { elementId: SC.id, userId: userThree.id },
      prisma
    )
    const accessRequestsCount3 = await prisma.accessRequest.count()
    expect(accessRequestsCount3).toBe(9)

    const accessRequest1 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequest1).toBeNull()
    const accessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequest2).toBeNull()
    const accessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(accessRequest3).toBeNull()

    // update the access request instances for user 4 and verify that they are removed correctly
    await updateAccessRequestInstances(
      { catalogCollectionId: publicCatalog.id, userId: userFour.id },
      prisma
    )
    await updateAccessRequestInstances(
      { answerCollectionId: AC!.id, userId: userFour.id },
      prisma
    )
    await updateAccessRequestInstances(
      { elementId: SC.id, userId: userFour.id },
      prisma
    )
    const accessRequestsCount4 = await prisma.accessRequest.count()
    expect(accessRequestsCount4).toBe(6)

    const accessRequest4 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequest4).toBeNull()
    const accessRequest5 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequest5).toBeNull()
    const accessRequest6 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(accessRequest6).toBeNull()

    // update the access request instances for user 5 through the derived permissions recomputation function and verify that they are removed correctly
    await recomputeDerivedPermissions(
      {
        catalogCollectionId: publicCatalog.id,
        userId: userFive.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      {
        answerCollectionId: AC!.id,
        userId: userFive.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: SC.id, userId: userFive.id, updateAccessRequests: true },
      prisma
    )
    const accessRequestsCount5 = await prisma.accessRequest.count()
    expect(accessRequestsCount5).toBe(3)

    const accessRequest7 = await prisma.accessRequest.findUnique({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: publicCatalog.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(accessRequest7).toBeNull()
    const accessRequest8 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(accessRequest8).toBeNull()
    const accessRequest9 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(accessRequest9).toBeNull()

    // verify that on object deletion, the access requests are removed through cascading delete
    await prisma.catalogCollection.delete({
      where: { id: publicCatalog.id },
    })
    await prisma.answerCollection.delete({
      where: { id: AC!.id },
    })
    await prisma.element.delete({
      where: { id: SC.id },
    })
    const accessRequestsCount6 = await prisma.accessRequest.count()
    expect(accessRequestsCount6).toBe(0)
  })

  it('Verify that access requests for soft-deleted objects are automatically removed for all users', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC!.id)
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz Test',
        displayName: 'Live Quiz Test',
        description: 'Test Description',
        ownerId: userOne.id,
      },
    })
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
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz Test',
        displayName: 'Practice Quiz Test',
        description: 'Test Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })
    const microlearning = await prisma.microLearning.create({
      data: {
        name: 'Microlearning Test',
        displayName: 'Microlearning Test',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
      },
    })
    const groupActivity = await prisma.groupActivity.create({
      data: {
        name: 'Group Activity Test',
        displayName: 'Group Activity Test',
        description: 'Test Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // create access requests for user 2 on all objects
    await prisma.accessRequest.createMany({
      data: [
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          courseId: course.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          practiceQuizId: practiceQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: microlearning.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          groupActivityId: groupActivity.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    const accessRequestsCount = await prisma.accessRequest.count()
    expect(accessRequestsCount).toBe(7)

    // soft delete the objects one after the other and verify that the corresponding access requests are removed
    // to update access requests use a combination of the update access requests functions (with and without userId) and the derived permission recomputation
    await prisma.answerCollection.update({
      where: { id: AC!.id },
      data: { isDeleted: true },
    })
    await updateAccessRequestInstances(
      {
        answerCollectionId: AC!.id,
        userId: userOne.id,
        objectSoftDeleted: true,
      },
      prisma
    )
    const accessRequestsCount2 = await prisma.accessRequest.count()
    expect(accessRequestsCount2).toBe(6)

    await prisma.element.update({
      where: { id: SC.id },
      data: { isDeleted: true },
    })
    await updateAccessRequestInstances(
      { elementId: SC.id, userId: userOne.id, objectSoftDeleted: true },
      prisma
    )
    const accessRequestsCount3 = await prisma.accessRequest.count()
    expect(accessRequestsCount3).toBe(5)

    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { isDeleted: true },
    })
    await updateAccessRequestInstances(
      { liveQuizId: liveQuiz.id, objectSoftDeleted: true },
      prisma
    )
    const accessRequestsCount4 = await prisma.accessRequest.count()
    expect(accessRequestsCount4).toBe(4)

    await prisma.practiceQuiz.update({
      where: { id: practiceQuiz.id },
      data: { isDeleted: true },
    })
    await updateAccessRequestInstances(
      { practiceQuizId: practiceQuiz.id, objectSoftDeleted: true },
      prisma
    )
    const accessRequestsCount5 = await prisma.accessRequest.count()
    expect(accessRequestsCount5).toBe(3)

    await prisma.microLearning.update({
      where: { id: microlearning.id },
      data: { isDeleted: true },
    })
    await recomputeDerivedPermissions(
      {
        microLearningId: microlearning.id,
        userId: userOne.id,
        updateAccessRequests: true,
      },
      prisma
    )
    const accessRequestsCount6 = await prisma.accessRequest.count()
    expect(accessRequestsCount6).toBe(2)

    await prisma.groupActivity.update({
      where: { id: groupActivity.id },
      data: { isDeleted: true },
    })
    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id, updateAccessRequests: true },
      prisma
    )
    const accessRequestsCount7 = await prisma.accessRequest.count()
    expect(accessRequestsCount7).toBe(1)
  })

  it('Test the combination of permission propagation and access request instance updates', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC!.id)
    const liveQuiz = await seedLiveQuiz(
      { elements: [{ id: SE.id, type: ElementType.SELECTION }] },
      userOneCtx
    )

    // create access requests for user 2 on all objects
    await prisma.accessRequest.createMany({
      data: [
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    const accessRequestsCount = await prisma.accessRequest.count()
    expect(accessRequestsCount).toBe(3)

    // add ADMIN permissions for user 3 on the live quiz
    await prisma.permission.create({
      data: {
        liveQuizId: liveQuiz.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger a recomputation of the derived permissions and verify that derived
    // permissions on all three objects were created with the correct permission levels
    await recomputeDerivedPermissions(
      {
        liveQuizId: liveQuiz.id,
        userId: userThree.id,
        updateAccessRequests: true,
      },
      prisma
    )

    const derivedPermissionLiveQuiz = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(derivedPermissionLiveQuiz).toBeTruthy()
    expect(derivedPermissionLiveQuiz!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    const derivedPermissionElement = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermissionElement).toBeTruthy()
    expect(derivedPermissionElement!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    const derivedPermissionAnswerCollection =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollection).toBeTruthy()
    expect(derivedPermissionAnswerCollection!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    // verify that new access request instances have been created for user 3 on the objects where they are admin
    const accessRequestsCount2 = await prisma.accessRequest.count()
    expect(accessRequestsCount2).toBe(5)

    const newAccessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newAccessRequestLiveQuiz).toBeTruthy()
    expect(newAccessRequestLiveQuiz!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    const newAccessRequestElement = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newAccessRequestElement).toBeTruthy()
    expect(newAccessRequestElement!.permissionLevel).toBe(PermissionLevel.WRITE)

    const newAccessRequestAnswerCollection =
      await prisma.accessRequest.findUnique({
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC!.id,
            userId: userTwo.id,
            objectAdminOrOwnerId: userThree.id,
          },
        },
      })
    expect(newAccessRequestAnswerCollection).toBeNull()

    // remove the direct ADMIN permission on the live quiz again
    await prisma.permission.delete({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
        },
      },
    })

    // trigger a recomputation of the derived permissions and verify that the access request instances are removed
    await recomputeDerivedPermissions(
      {
        liveQuizId: liveQuiz.id,
        userId: userThree.id,
        updateAccessRequests: true,
      },
      prisma
    )
    const accessRequestsCount3 = await prisma.accessRequest.count()
    expect(accessRequestsCount3).toBe(3)

    const removedAccessRequestLiveQuiz = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(removedAccessRequestLiveQuiz).toBeNull()

    const removedAccessRequestElement = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SE.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(removedAccessRequestElement).toBeNull()
  })

  it('Verify that triggering an access request instances update without userId does update the instances for all users', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC!.id)

    // create access requests for user 2 on all objects
    await prisma.accessRequest.createMany({
      data: [
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestsCount = await prisma.accessRequest.count()
    expect(accessRequestsCount).toBe(2)

    // grant ADMIN permissions to user 3 on both objects
    await prisma.permission.create({
      data: {
        answerCollectionId: AC!.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        elementId: SC.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // create a user gorup with users 4, 5, and 6 and grant ADMIN permissions to the group on both objects
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userSix.id,
        admins: { connect: [{ id: userFive.id }, { id: userOne.id }] },
        members: { connect: { id: userFour.id } },
      },
    })
    await prisma.permission.create({
      data: {
        answerCollectionId: AC!.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        elementId: SC.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger a recomputation of the derived permissions without updating the access requests
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await updateAccessRequestInstances({ answerCollectionId: AC!.id }, prisma)
    const accessRequestsCount2 = await prisma.accessRequest.count()
    expect(accessRequestsCount2).toBe(6)

    const newAccessRequest1 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newAccessRequest1).toBeTruthy()
    expect(newAccessRequest1!.permissionLevel).toBe(PermissionLevel.READ)

    const newAccessRequest2 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(newAccessRequest2).toBeTruthy()
    expect(newAccessRequest2!.permissionLevel).toBe(PermissionLevel.READ)

    const newAccessRequest3 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(newAccessRequest3).toBeTruthy()
    expect(newAccessRequest3!.permissionLevel).toBe(PermissionLevel.READ)

    const newAccessRequest4 = await prisma.accessRequest.findUnique({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userSix.id,
        },
      },
    })
    expect(newAccessRequest4).toBeTruthy()
    expect(newAccessRequest4!.permissionLevel).toBe(PermissionLevel.READ)

    // trigger a recomputation of the dervied permissions, including an update of the corresponding access request instances
    await recomputeDerivedPermissions(
      {
        elementId: SC.id,
        updateAccessRequests: true,
      },
      prisma
    )
    const accessRequestsCount3 = await prisma.accessRequest.count()
    expect(accessRequestsCount3).toBe(10)

    const newAccessRequest5 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
        },
      },
    })
    expect(newAccessRequest5).toBeTruthy()
    expect(newAccessRequest5!.permissionLevel).toBe(PermissionLevel.WRITE)

    const newAccessRequest6 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
        },
      },
    })
    expect(newAccessRequest6).toBeTruthy()
    expect(newAccessRequest6!.permissionLevel).toBe(PermissionLevel.WRITE)

    const newAccessRequest7 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(newAccessRequest7).toBeTruthy()
    expect(newAccessRequest7!.permissionLevel).toBe(PermissionLevel.WRITE)

    const newAccessRequest8 = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userSix.id,
        },
      },
    })
    expect(newAccessRequest8).toBeTruthy()
    expect(newAccessRequest8!.permissionLevel).toBe(PermissionLevel.WRITE)
  })

  it('Verify that triggering an access request instances update without userId after permission revocation does update the instances for all users', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC!.id)

    // grant ADMIN permissions to user 3 on both objects
    await prisma.permission.create({
      data: {
        answerCollectionId: AC!.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        elementId: SC.id,
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // create a user gorup with users 4, 5, and 6 and grant ADMIN permissions to the group on both objects
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userSix.id,
        admins: { connect: [{ id: userFive.id }, { id: userOne.id }] },
        members: { connect: { id: userFour.id } },
      },
    })
    await prisma.permission.create({
      data: {
        answerCollectionId: AC!.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        elementId: SC.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger a recomputation of the derived permissions for both objects
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await recomputeDerivedPermissions({ elementId: SC.id }, prisma)

    // create access requests for user 2 on all objects for all admin users (1, 3, 4, 5, and 6)
    await prisma.accessRequest.createMany({
      data: [
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userFive.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          answerCollectionId: AC!.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userSix.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userSix.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const accessRequestsCount = await prisma.accessRequest.count()
    expect(accessRequestsCount).toBe(10)

    // revoke the admin permissions on the answer collection and recompute the access requests using the dedicated function
    await prisma.permission.deleteMany({
      where: {
        OR: [
          {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
          {
            answerCollectionId: AC!.id,
            userGroupId: group.id,
          },
        ],
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC!.id }, prisma)
    await updateAccessRequestInstances({ answerCollectionId: AC!.id }, prisma)

    // verify that the admin access request instances for the answer collection were removed
    const accessRequestsCount2 = await prisma.accessRequest.count()
    expect(accessRequestsCount2).toBe(6)

    // revoke the admin permissions on the element and recompute the access requests inside the derived permissions function
    await prisma.permission.deleteMany({
      where: {
        OR: [
          {
            elementId: SC.id,
            userId: userThree.id,
          },
          {
            elementId: SC.id,
            userGroupId: group.id,
          },
        ],
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SC.id, updateAccessRequests: true },
      prisma
    )

    // verify that the admin access request instances for the element were removed
    const accessRequestsCount3 = await prisma.accessRequest.count()
    expect(accessRequestsCount3).toBe(2)

    // verify that only the access request instances for the owner persist
    const ownerAnswerCollectionAccessRequest =
      await prisma.accessRequest.findUnique({
        where: {
          answerCollectionId_userId_objectAdminOrOwnerId: {
            answerCollectionId: AC!.id,
            userId: userTwo.id,
            objectAdminOrOwnerId: userOne.id,
          },
        },
      })
    expect(ownerAnswerCollectionAccessRequest).toBeTruthy()
    expect(ownerAnswerCollectionAccessRequest!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const ownerElementAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        elementId_userId_objectAdminOrOwnerId: {
          elementId: SC.id,
          userId: userTwo.id,
          objectAdminOrOwnerId: userOne.id,
        },
      },
    })
    expect(ownerElementAccessRequest).toBeTruthy()
    expect(ownerElementAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
  })

  it('Test that resolving an access request with ADMIN permissions triggers a duplication of pending access requests', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
        propagation: false,
      },
      userOneCtx
    )
    await changeObjectPermissionLevel(
      {
        permissionId: answerCollectionPermission.id,
        permissionLevel: PermissionLevel.ADMIN,
        answerCollectionId: AC1!.id,
        propagation: false,
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
        propagation: false,
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
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
        propagation: false,
      },
      userOneCtx
    )
    await changeObjectPermissionLevel(
      {
        permissionId: answerCollectionPermission.id,
        permissionLevel: PermissionLevel.READ,
        answerCollectionId: AC1!.id,
        propagation: false,
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
        propagation: false,
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

  it('Test that reducing the level of existing mixed permissions from ADMIN level results in the removal of pending access requests for users without other access', async () => {
    const { publicCatalog } = await seedCatalogCollections(userOneCtx)

    // grant individual ADMIN access to users 2, 4, and 5
    const permission2 = await prisma.permission.create({
      data: {
        catalogCollectionId: publicCatalog.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
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
    await prisma.permission.create({
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
          objectAdminOrOwnerId: userOne.id, // object owner
          permissionLevel: PermissionLevel.WRITE,
        },
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
    expect(accessRequestCount1).toBe(5)

    // lower the individual permission of user 2 -> access request for user 2 should be removed
    await changeObjectPermissionLevel(
      {
        permissionId: permission2.id,
        permissionLevel: PermissionLevel.WRITE,
        catalogCollectionId: publicCatalog.id,
        propagation: false,
      },
      userOneCtx
    )
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

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
        propagation: false,
      },
      userOneCtx
    )
    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(3)
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
        propagation: false,
      },
      userOneCtx
    )
    const accessRequestCount4 = await prisma.accessRequest.count()
    expect(accessRequestCount4).toBe(3)

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
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
    await prisma.permission.create({
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
    await prisma.permission.create({
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
          objectAdminOrOwnerId: userOne.id, // object owner
          permissionLevel: PermissionLevel.WRITE,
        },
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
    expect(accessRequestCount1).toBe(5)

    // revoke the individual permission of user 2 -> access request for user 2 should be removed
    await revokeObjectAccess(
      {
        permissionId: permission2.id,
        catalogCollectionId: publicCatalog.id,
      },
      userOneCtx
    )
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

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
    expect(accessRequestCount3).toBe(3)
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
    expect(accessRequestCount4).toBe(3)

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
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
    const { AC1 } = await seedAnswerCollections(userOneCtx)

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
        propagation: false,
      },
      userOneCtx
    )
    await shareObject(
      {
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.shortname,
        answerCollectionId: AC1!.id,
        propagation: false,
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
