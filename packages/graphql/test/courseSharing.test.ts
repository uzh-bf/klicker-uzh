import {
  AuditLogType,
  ElementType,
  ObjectType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { removeCourse } from '../src/services/courses.js'
import {
  changeObjectPermissionLevel,
  getCoursePermissions,
  getDerivedAnswerCollectionPermissions,
  getDerivedCoursePermissions,
  getDerivedElementPermissions,
  getDerivedGroupActivityPermissions,
  getDerivedLiveQuizPermissions,
  getDerivedMicroLearningPermissions,
  getDerivedPracticeQuizPermissions,
  revokeObjectAccess,
  shareObject,
  transferCourseOwnership,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCourse,
  seedElements,
  seedGroupActivity,
  seedLiveQuiz,
  seedMicroLearning,
  seedPracticeQuiz,
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

describe('Unit tests for sharing functionalities of courses', () => {
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

  async function seedCourseActivities(prisma) {
    // create a course with activities, elements and resources
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SC, MC, KP, NR, FT, SE, CS, FC, CT } = await seedElements(
      userOneCtx,
      AC.id
    )
    const course = await seedCourse({}, userOneCtx)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: MC.id, type: ElementType.KPRIM },
          { id: KP.id, type: ElementType.NUMERICAL },
        ],
        courseId: course.id,
      },
      userOneCtx
    )
    const practiceQuiz = await seedPracticeQuiz(
      {
        elements: [
          { id: NR.id, type: ElementType.FREE_TEXT },
          { id: FT.id, type: ElementType.SELECTION },
        ],
        courseId: course.id,
      },
      userOneCtx
    )
    const microlearning = await seedMicroLearning(
      {
        elements: [
          { id: SE.id, type: ElementType.CASE_STUDY },
          { id: CS.id, type: ElementType.FLASHCARD },
        ],
        courseId: course.id,
      },
      userOneCtx
    )
    const groupActivity = await seedGroupActivity(
      {
        elements: [
          { id: FC.id, type: ElementType.CONTENT },
          { id: CT.id, type: ElementType.CONTENT },
        ],
        courseId: course.id,
      },
      userOneCtx
    )

    // create user groups including users 2, 3, 4, and 5 individually (as members, admins, owners)
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
        ownerId: userOne.id,
        admins: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const group3 = await prisma.userGroup.create({
      data: {
        name: 'Group 3',
        ownerId: userFour.id,
        members: {
          connect: [{ id: userOne.id }],
        },
      },
    })
    const group4 = await prisma.userGroup.create({
      data: {
        name: 'Group 4',
        ownerId: userFive.id,
        admins: {
          connect: [{ id: userOne.id }],
        },
      },
    })

    return {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group1,
      group2,
      group3,
      group4,
    }
  }

  async function verifyDirectUserPermissions(prisma, propagation) {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
    } = await seedCourseActivities(prisma)

    // share the course directly with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions, respectively
    const res1 = await shareObject(
      {
        shortnameOrEmail: userTwo.shortname,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res1!.userId).toBe(userTwo.id)
    expect(res1!.username).toBe(userTwo.shortname)
    expect(res1!.userEmail).toBe(userTwo.email)
    expect(res1!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res1!.propagation).toBe(propagation)

    const res2 = await shareObject(
      {
        shortnameOrEmail: userThree.shortname,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.userId).toBe(userThree.id)
    expect(res2!.username).toBe(userThree.shortname)
    expect(res2!.userEmail).toBe(userThree.email)
    expect(res2!.permissionLevel).toBe(PermissionLevel.EXECUTE)
    expect(res2!.propagation).toBe(propagation)

    const res3 = await shareObject(
      {
        shortnameOrEmail: userFour.email,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()
    expect(res3!.userId).toBe(userFour.id)
    expect(res3!.username).toBe(userFour.shortname)
    expect(res3!.userEmail).toBe(userFour.email)
    expect(res3!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res3!.propagation).toBe(propagation)

    const res4 = await shareObject(
      {
        shortnameOrEmail: userFive.email,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()
    expect(res4!.userId).toBe(userFive.id)
    expect(res4!.username).toBe(userFive.shortname)
    expect(res4!.userEmail).toBe(userFive.email)
    expect(res4!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res4!.propagation).toBe(propagation)

    // verify that the correct direct permissions have been created
    const readPermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermission).toBeTruthy()
    expect(readPermission!.id).toBe(res1!.permissionId)
    expect(readPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermission!.propagation).toBe(propagation)

    const executePermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userThree.id,
        },
      },
    })
    expect(executePermission).toBeTruthy()
    expect(executePermission!.id).toBe(res2!.permissionId)
    expect(executePermission!.permissionLevel).toBe(PermissionLevel.EXECUTE)
    expect(executePermission!.propagation).toBe(propagation)

    const writePermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFour.id,
        },
      },
    })
    expect(writePermission).toBeTruthy()
    expect(writePermission!.id).toBe(res3!.permissionId)
    expect(writePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(writePermission!.propagation).toBe(propagation)

    const adminPermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFive.id,
        },
      },
    })
    expect(adminPermission).toBeTruthy()
    expect(adminPermission!.id).toBe(res4!.permissionId)
    expect(adminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(adminPermission!.propagation).toBe(propagation)

    // verify that derived permissions on the course have been created
    const courseREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(courseREADPermission).toBeTruthy()
    expect(courseREADPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(courseREADPermission!.directPermissionId).toBe(readPermission!.id)
    expect(courseREADPermission!.derived).toBe(false)

    const courseEXECUTEPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userThree.id,
        },
      },
    })
    expect(courseEXECUTEPermission).toBeTruthy()
    expect(courseEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(courseEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(courseEXECUTEPermission!.derived).toBe(false)

    const courseWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFour.id,
        },
      },
    })
    expect(courseWRITEPermission).toBeTruthy()
    expect(courseWRITEPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(courseWRITEPermission!.directPermissionId).toBe(writePermission!.id)
    expect(courseWRITEPermission!.derived).toBe(false)

    const courseADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFive.id,
        },
      },
    })
    expect(courseADMINPermission).toBeTruthy()
    expect(courseADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(courseADMINPermission!.directPermissionId).toBe(adminPermission!.id)
    expect(courseADMINPermission!.derived).toBe(false)

    // verify that derived permissions on all activities with the corresponding permissions have been created
    const liveQuizREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(liveQuizREADPermission).toBeTruthy()
    expect(liveQuizREADPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(liveQuizREADPermission!.directPermissionId).toBe(readPermission!.id)
    expect(liveQuizREADPermission!.derived).toBe(true)

    const practiceQuizREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(practiceQuizREADPermission).toBeTruthy()
    expect(practiceQuizREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(practiceQuizREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(practiceQuizREADPermission!.derived).toBe(true)

    const microlearningREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(microlearningREADPermission).toBeTruthy()
    expect(microlearningREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(microlearningREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(microlearningREADPermission!.derived).toBe(true)

    const groupActivityREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(groupActivityREADPermission).toBeTruthy()
    expect(groupActivityREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(groupActivityREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(groupActivityREADPermission!.derived).toBe(true)

    const liveQuizEXECUTEPermission = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(liveQuizEXECUTEPermission).toBeTruthy()
    expect(liveQuizEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(liveQuizEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(liveQuizEXECUTEPermission!.derived).toBe(true)

    const practiceQuizEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(practiceQuizEXECUTEPermission).toBeTruthy()
    expect(practiceQuizEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(practiceQuizEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(practiceQuizEXECUTEPermission!.derived).toBe(true)

    const microlearningEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userThree.id,
          },
        },
      })
    expect(microlearningEXECUTEPermission).toBeTruthy()
    expect(microlearningEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(microlearningEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(microlearningEXECUTEPermission!.derived).toBe(true)

    const groupActivityEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userThree.id,
          },
        },
      })
    expect(groupActivityEXECUTEPermission).toBeTruthy()
    expect(groupActivityEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupActivityEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(groupActivityEXECUTEPermission!.derived).toBe(true)

    const liveQuizWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(liveQuizWRITEPermission).toBeTruthy()
    expect(liveQuizWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(liveQuizWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(liveQuizWRITEPermission!.derived).toBe(true)

    const practiceQuizWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(practiceQuizWRITEPermission).toBeTruthy()
    expect(practiceQuizWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(practiceQuizWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(practiceQuizWRITEPermission!.derived).toBe(true)

    const microlearningWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFour.id,
          },
        },
      })
    expect(microlearningWRITEPermission).toBeTruthy()
    expect(microlearningWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(microlearningWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(microlearningWRITEPermission!.derived).toBe(true)

    const groupActivityWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFour.id,
          },
        },
      })
    expect(groupActivityWRITEPermission).toBeTruthy()
    expect(groupActivityWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(groupActivityWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(groupActivityWRITEPermission!.derived).toBe(true)

    const liveQuizADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(liveQuizADMINPermission).toBeTruthy()
    expect(liveQuizADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(liveQuizADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(liveQuizADMINPermission!.derived).toBe(true)

    const practiceQuizADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFive.id,
          },
        },
      })
    expect(practiceQuizADMINPermission).toBeTruthy()
    expect(practiceQuizADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(practiceQuizADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(practiceQuizADMINPermission!.derived).toBe(true)

    const microlearningADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFive.id,
          },
        },
      })
    expect(microlearningADMINPermission).toBeTruthy()
    expect(microlearningADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(microlearningADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(microlearningADMINPermission!.derived).toBe(true)

    const groupActivityADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFive.id,
          },
        },
      })
    expect(groupActivityADMINPermission).toBeTruthy()
    expect(groupActivityADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(groupActivityADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(groupActivityADMINPermission!.derived).toBe(true)

    // verify that derived permissions on all elements have been created for the user with ADMIN permissions
    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]

    for (const elementId of elementIds) {
      const elemenREADPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userTwo.id,
          },
        },
      })
      expect(elemenREADPermission).toBeNull()

      const elementEXECUTEPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId: elementId,
              userId: userThree.id,
            },
          },
        })
      expect(elementEXECUTEPermission).toBeNull()

      const elementWRITEPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userFour.id,
          },
        },
      })
      expect(elementWRITEPermission).toBeNull()

      const elementADMINPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userFive.id,
          },
        },
      })
      expect(elementADMINPermission).toBeTruthy()
      expect(elementADMINPermission!.permissionLevel).toBe(
        PermissionLevel.ADMIN
      )
      expect(elementADMINPermission!.directPermissionId).toBe(
        adminPermission!.id
      )
      expect(elementADMINPermission!.derived).toBe(true)
    }

    // verify that derived permissions on the resource have been created for the user with ADMIN permissions
    const resourceREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(resourceREADPermission).toBeNull()

    const resourceEXECUTEPermission = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(resourceEXECUTEPermission).toBeNull()

    const resourceWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userFour.id,
        },
      },
    })
    expect(resourceWRITEPermission).toBeNull()

    const resourceADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userFive.id,
        },
      },
    })
    expect(resourceADMINPermission).toBeTruthy()
    expect(resourceADMINPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(resourceADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(resourceADMINPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user ${userFive.id}.`
    )
  }

  async function verifyDirectGroupPermissions(prisma, propagation) {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group1,
      group2,
      group3,
      group4,
    } = await seedCourseActivities(prisma)

    // share the course directly with groups 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions, respectively
    const res1 = await shareObject(
      {
        userGroupId: group1.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res1!.userGroupId).toBe(group1.id)
    expect(res1!.userGroupName).toBe(group1.name)
    expect(res1!.permissionLevel).toBe(PermissionLevel.READ)
    expect(res1!.propagation).toBe(propagation)

    const res2 = await shareObject(
      {
        userGroupId: group2.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.userGroupId).toBe(group2.id)
    expect(res2!.userGroupName).toBe(group2.name)
    expect(res2!.permissionLevel).toBe(PermissionLevel.EXECUTE)
    expect(res2!.propagation).toBe(propagation)

    const res3 = await shareObject(
      {
        userGroupId: group3.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()
    expect(res3!.userGroupId).toBe(group3.id)
    expect(res3!.userGroupName).toBe(group3.name)
    expect(res3!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(res3!.propagation).toBe(propagation)

    const res4 = await shareObject(
      {
        userGroupId: group4.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()
    expect(res4!.userGroupId).toBe(group4.id)
    expect(res4!.userGroupName).toBe(group4.name)
    expect(res4!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(res4!.propagation).toBe(propagation)

    // verify that the correct direct permissions have been created
    const readPermission = await prisma.permission.findUnique({
      where: {
        courseId_userGroupId: {
          courseId: course.id,
          userGroupId: group1.id,
        },
      },
    })
    expect(readPermission).toBeTruthy()
    expect(readPermission!.id).toBe(res1!.permissionId)
    expect(readPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermission!.propagation).toBe(propagation)

    const executePermission = await prisma.permission.findUnique({
      where: {
        courseId_userGroupId: {
          courseId: course.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(executePermission).toBeTruthy()
    expect(executePermission!.id).toBe(res2!.permissionId)
    expect(executePermission!.permissionLevel).toBe(PermissionLevel.EXECUTE)
    expect(executePermission!.propagation).toBe(propagation)

    const writePermission = await prisma.permission.findUnique({
      where: {
        courseId_userGroupId: {
          courseId: course.id,
          userGroupId: group3.id,
        },
      },
    })
    expect(writePermission).toBeTruthy()
    expect(writePermission!.id).toBe(res3!.permissionId)
    expect(writePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(writePermission!.propagation).toBe(propagation)

    const adminPermission = await prisma.permission.findUnique({
      where: {
        courseId_userGroupId: {
          courseId: course.id,
          userGroupId: group4.id,
        },
      },
    })
    expect(adminPermission).toBeTruthy()
    expect(adminPermission!.id).toBe(res4!.permissionId)
    expect(adminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(adminPermission!.propagation).toBe(propagation)

    // verify that derived permissions on the course have been created
    const courseREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(courseREADPermission).toBeTruthy()
    expect(courseREADPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(courseREADPermission!.directPermissionId).toBe(readPermission!.id)
    expect(courseREADPermission!.derived).toBe(false)

    const courseEXECUTEPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userThree.id,
        },
      },
    })
    expect(courseEXECUTEPermission).toBeTruthy()
    expect(courseEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(courseEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(courseEXECUTEPermission!.derived).toBe(false)

    const courseWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFour.id,
        },
      },
    })
    expect(courseWRITEPermission).toBeTruthy()
    expect(courseWRITEPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(courseWRITEPermission!.directPermissionId).toBe(writePermission!.id)
    expect(courseWRITEPermission!.derived).toBe(false)

    const courseADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userFive.id,
        },
      },
    })
    expect(courseADMINPermission).toBeTruthy()
    expect(courseADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(courseADMINPermission!.directPermissionId).toBe(adminPermission!.id)
    expect(courseADMINPermission!.derived).toBe(false)

    // verify that derived permissions on all activities with the corresponding permissions have been created
    const liveQuizREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(liveQuizREADPermission).toBeTruthy()
    expect(liveQuizREADPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(liveQuizREADPermission!.directPermissionId).toBe(readPermission!.id)
    expect(liveQuizREADPermission!.derived).toBe(true)

    const practiceQuizREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(practiceQuizREADPermission).toBeTruthy()
    expect(practiceQuizREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(practiceQuizREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(practiceQuizREADPermission!.derived).toBe(true)

    const microlearningREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(microlearningREADPermission).toBeTruthy()
    expect(microlearningREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(microlearningREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(microlearningREADPermission!.derived).toBe(true)

    const groupActivityREADPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(groupActivityREADPermission).toBeTruthy()
    expect(groupActivityREADPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(groupActivityREADPermission!.directPermissionId).toBe(
      readPermission!.id
    )
    expect(groupActivityREADPermission!.derived).toBe(true)

    const liveQuizEXECUTEPermission = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(liveQuizEXECUTEPermission).toBeTruthy()
    expect(liveQuizEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(liveQuizEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(liveQuizEXECUTEPermission!.derived).toBe(true)

    const practiceQuizEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(practiceQuizEXECUTEPermission).toBeTruthy()
    expect(practiceQuizEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(practiceQuizEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(practiceQuizEXECUTEPermission!.derived).toBe(true)

    const microlearningEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userThree.id,
          },
        },
      })
    expect(microlearningEXECUTEPermission).toBeTruthy()
    expect(microlearningEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(microlearningEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(microlearningEXECUTEPermission!.derived).toBe(true)

    const groupActivityEXECUTEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userThree.id,
          },
        },
      })
    expect(groupActivityEXECUTEPermission).toBeTruthy()
    expect(groupActivityEXECUTEPermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(groupActivityEXECUTEPermission!.directPermissionId).toBe(
      executePermission!.id
    )
    expect(groupActivityEXECUTEPermission!.derived).toBe(true)

    const liveQuizWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFour.id,
        },
      },
    })
    expect(liveQuizWRITEPermission).toBeTruthy()
    expect(liveQuizWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(liveQuizWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(liveQuizWRITEPermission!.derived).toBe(true)

    const practiceQuizWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(practiceQuizWRITEPermission).toBeTruthy()
    expect(practiceQuizWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(practiceQuizWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(practiceQuizWRITEPermission!.derived).toBe(true)

    const microlearningWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFour.id,
          },
        },
      })
    expect(microlearningWRITEPermission).toBeTruthy()
    expect(microlearningWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(microlearningWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(microlearningWRITEPermission!.derived).toBe(true)

    const groupActivityWRITEPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFour.id,
          },
        },
      })
    expect(groupActivityWRITEPermission).toBeTruthy()
    expect(groupActivityWRITEPermission!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(groupActivityWRITEPermission!.directPermissionId).toBe(
      writePermission!.id
    )
    expect(groupActivityWRITEPermission!.derived).toBe(true)

    const liveQuizADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userFive.id,
        },
      },
    })
    expect(liveQuizADMINPermission).toBeTruthy()
    expect(liveQuizADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(liveQuizADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(liveQuizADMINPermission!.derived).toBe(true)

    const practiceQuizADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFive.id,
          },
        },
      })
    expect(practiceQuizADMINPermission).toBeTruthy()
    expect(practiceQuizADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(practiceQuizADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(practiceQuizADMINPermission!.derived).toBe(true)

    const microlearningADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFive.id,
          },
        },
      })
    expect(microlearningADMINPermission).toBeTruthy()
    expect(microlearningADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(microlearningADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(microlearningADMINPermission!.derived).toBe(true)

    const groupActivityADMINPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userFive.id,
          },
        },
      })
    expect(groupActivityADMINPermission).toBeTruthy()
    expect(groupActivityADMINPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(groupActivityADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(groupActivityADMINPermission!.derived).toBe(true)

    // verify that derived permissions on all elements have been created for the user with ADMIN permissions
    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]

    for (const elementId of elementIds) {
      const elemenREADPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userTwo.id,
          },
        },
      })
      expect(elemenREADPermission).toBeNull()

      const elementEXECUTEPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId: elementId,
              userId: userThree.id,
            },
          },
        })
      expect(elementEXECUTEPermission).toBeNull()

      const elementWRITEPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userFour.id,
          },
        },
      })
      expect(elementWRITEPermission).toBeNull()

      const elementADMINPermission = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: elementId,
            userId: userFive.id,
          },
        },
      })
      expect(elementADMINPermission).toBeTruthy()
      expect(elementADMINPermission!.permissionLevel).toBe(
        PermissionLevel.ADMIN
      )
      expect(elementADMINPermission!.directPermissionId).toBe(
        adminPermission!.id
      )
      expect(elementADMINPermission!.derived).toBe(true)
    }

    // verify that derived permissions on the resource have been created for the user with ADMIN permissions
    const resourceREADPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userTwo.id,
        },
      },
    })
    expect(resourceREADPermission).toBeNull()

    const resourceEXECUTEPermission = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(resourceEXECUTEPermission).toBeNull()

    const resourceWRITEPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userFour.id,
        },
      },
    })
    expect(resourceWRITEPermission).toBeNull()

    const resourceADMINPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC.id,
          userId: userFive.id,
        },
      },
    })
    expect(resourceADMINPermission).toBeTruthy()
    expect(resourceADMINPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(resourceADMINPermission!.directPermissionId).toBe(
      adminPermission!.id
    )
    expect(resourceADMINPermission!.derived).toBe(true)

    // verify that proper audit log entries were created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group1.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user group ${group1.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.EXECUTE} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user group ${group3.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} to user group ${group4.id}.`
    )
  }

  it('Test that courses can be shared with individual users through the corresponding service function (without propagation)', async () => {
    await verifyDirectUserPermissions(prisma, false)
  })

  it('Test that courses can be shared with individual users through the corresponding service function (with propagation)', async () => {
    await verifyDirectUserPermissions(prisma, true)
  })

  it('Test that courses can be shared with groups through the corresponding service function (without propagation)', async () => {
    await verifyDirectGroupPermissions(prisma, false)
  })

  it('Test that courses can be shared with groups through the corresponding service function (with propagation)', async () => {
    await verifyDirectGroupPermissions(prisma, true)
  })

  it('Verify that access requests are correctly duplicated on courses and dependent activities / elements when shared with individual ADMIN permissions', async () => {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
    } = await seedCourseActivities(prisma)

    // create access requests on all objects for user 6
    await prisma.accessRequest.createMany({
      data: [
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          courseId: course.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          microLearningId: microlearning.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: MC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: KP.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: NR.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: FT.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SE.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: CS.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: FC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: CT.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          answerCollectionId: AC.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(15)

    // share the course with users 2, 3, 4, and 5 with READ, EXECUTE, WRITE, and ADMIN permissions, respectively
    const res1 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userTwo.shortname,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
      userOneCtx
    )
    const res2 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userThree.shortname,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: true,
      },
      userOneCtx
    )
    const res3 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userFour.shortname,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    const res4 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userFive.shortname,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res2).toBeTruthy()
    expect(res3).toBeTruthy()
    expect(res4).toBeTruthy()

    // verify that the access requests have only been duplicated for the admin user
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(29)

    // course access request has been duplicated
    const courseAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        courseId_userId_objectAdminOrOwnerId: {
          courseId: course.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(courseAccessRequest).toBeTruthy()
    expect(courseAccessRequest!.permissionLevel).toBe(PermissionLevel.READ)

    // activity access requests have been duplicated
    const liveQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(liveQuizAccessRequest).toBeTruthy()
    expect(liveQuizAccessRequest!.permissionLevel).toBe(PermissionLevel.WRITE)

    const practiceQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        practiceQuizId_userId_objectAdminOrOwnerId: {
          practiceQuizId: practiceQuiz.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(practiceQuizAccessRequest).toBeTruthy()
    expect(practiceQuizAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const microlearningAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        microLearningId_userId_objectAdminOrOwnerId: {
          microLearningId: microlearning.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(microlearningAccessRequest).toBeTruthy()
    expect(microlearningAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const groupActivityAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        groupActivityId_userId_objectAdminOrOwnerId: {
          groupActivityId: groupActivity.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(groupActivityAccessRequest).toBeTruthy()
    expect(groupActivityAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    // element access requests have been duplicated
    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]
    for (const elementId of elementIds) {
      const elementAccessRequest = await prisma.accessRequest.findUnique({
        where: {
          elementId_userId_objectAdminOrOwnerId: {
            elementId,
            userId: userSix.id,
            objectAdminOrOwnerId: userFive.id,
          },
        },
      })
      expect(elementAccessRequest).toBeTruthy()
      expect(elementAccessRequest!.permissionLevel).toBe(PermissionLevel.ADMIN)
    }
  })

  it('Verify that access requests are correctly duplicated on courses and dependent activities / elements when shared with group ADMIN permissions', async () => {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group1,
      group2,
      group3,
      group4,
    } = await seedCourseActivities(prisma)

    // create access requests on all objects for user 6
    await prisma.accessRequest.createMany({
      data: [
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          courseId: course.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          practiceQuizId: practiceQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          microLearningId: microlearning.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          groupActivityId: groupActivity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: MC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: KP.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: NR.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: FT.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SE.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: CS.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: FC.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: CT.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          answerCollectionId: AC.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(15)

    // share the course with groups 1, 2, 3, and 4 with READ, EXECUTE, WRITE, and ADMIN permissions, respectively
    const res1 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group1.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
      userOneCtx
    )
    const res2 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group2.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: true,
      },
      userOneCtx
    )
    const res3 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group3.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    const res4 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group4.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res2).toBeTruthy()
    expect(res3).toBeTruthy()
    expect(res4).toBeTruthy()

    // verify that the access requests have only been duplicated for the admin user
    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(29)

    // course access request has been duplicated
    const courseAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        courseId_userId_objectAdminOrOwnerId: {
          courseId: course.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(courseAccessRequest).toBeTruthy()
    expect(courseAccessRequest!.permissionLevel).toBe(PermissionLevel.READ)

    // activity access requests have been duplicated
    const liveQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(liveQuizAccessRequest).toBeTruthy()
    expect(liveQuizAccessRequest!.permissionLevel).toBe(PermissionLevel.WRITE)

    const practiceQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        practiceQuizId_userId_objectAdminOrOwnerId: {
          practiceQuizId: practiceQuiz.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(practiceQuizAccessRequest).toBeTruthy()
    expect(practiceQuizAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const microlearningAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        microLearningId_userId_objectAdminOrOwnerId: {
          microLearningId: microlearning.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(microlearningAccessRequest).toBeTruthy()
    expect(microlearningAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const groupActivityAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        groupActivityId_userId_objectAdminOrOwnerId: {
          groupActivityId: groupActivity.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userFive.id,
        },
      },
    })
    expect(groupActivityAccessRequest).toBeTruthy()
    expect(groupActivityAccessRequest!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    // element access requests have been duplicated
    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]
    for (const elementId of elementIds) {
      const elementAccessRequest = await prisma.accessRequest.findUnique({
        where: {
          elementId_userId_objectAdminOrOwnerId: {
            elementId,
            userId: userSix.id,
            objectAdminOrOwnerId: userFive.id,
          },
        },
      })
      expect(elementAccessRequest).toBeTruthy()
      expect(elementAccessRequest!.permissionLevel).toBe(PermissionLevel.ADMIN)
    }
  })

  it('Test the getter function for direct course permissions and all kinds of derived permissions for dependent objects', async () => {
    const {
      AC,
      SC,
      SE,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group1,
      group2,
      group3,
      group4,
    } = await seedCourseActivities(prisma)

    // grant direct permissions to the individual users and user groups
    const res1 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userTwo.shortname,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    const res2 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userThree.shortname,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: false,
      },
      userOneCtx
    )
    const res3 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userFour.shortname,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    const res4 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userFive.shortname,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()
    expect(res2).toBeTruthy()
    expect(res3).toBeTruthy()
    expect(res4).toBeTruthy()

    const res5 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group1.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
      userOneCtx
    )
    const res6 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group2.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: true,
      },
      userOneCtx
    )
    const res7 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group3.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    const res8 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group4.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()
    expect(res6).toBeTruthy()
    expect(res7).toBeTruthy()
    expect(res8).toBeTruthy()

    // verify that all direct permissions are correctly returned
    const directPermissions = await getCoursePermissions(
      { id: course.id },
      userOneCtx
    )
    expect(directPermissions).toBeTruthy()
    expect(directPermissions!.length).toBe(8)

    const individualReadPermission = directPermissions!.find(
      (permission) =>
        permission.userId === userTwo.id &&
        permission.permissionLevel === PermissionLevel.READ
    )
    expect(individualReadPermission).toBeTruthy()
    expect(individualReadPermission!.propagation).toBe(false)

    const individualExecutePermission = directPermissions!.find(
      (permission) =>
        permission.userId === userThree.id &&
        permission.permissionLevel === PermissionLevel.EXECUTE
    )
    expect(individualExecutePermission).toBeTruthy()
    expect(individualExecutePermission!.propagation).toBe(false)

    const individualWritePermission = directPermissions!.find(
      (permission) =>
        permission.userId === userFour.id &&
        permission.permissionLevel === PermissionLevel.WRITE
    )
    expect(individualWritePermission).toBeTruthy()
    expect(individualWritePermission!.propagation).toBe(false)

    const individualAdminPermission = directPermissions!.find(
      (permission) =>
        permission.userId === userFive.id &&
        permission.permissionLevel === PermissionLevel.ADMIN
    )
    expect(individualAdminPermission).toBeTruthy()
    expect(individualAdminPermission!.propagation).toBe(false)

    const groupReadPermission = directPermissions!.find(
      (permission) =>
        permission.userGroupId === group1.id &&
        permission.permissionLevel === PermissionLevel.READ
    )
    expect(groupReadPermission).toBeTruthy()
    expect(groupReadPermission!.propagation).toBe(true)

    const groupExecutePermission = directPermissions!.find(
      (permission) =>
        permission.userGroupId === group2.id &&
        permission.permissionLevel === PermissionLevel.EXECUTE
    )
    expect(groupExecutePermission).toBeTruthy()
    expect(groupExecutePermission!.propagation).toBe(true)

    const groupWritePermission = directPermissions!.find(
      (permission) =>
        permission.userGroupId === group3.id &&
        permission.permissionLevel === PermissionLevel.WRITE
    )
    expect(groupWritePermission).toBeTruthy()
    expect(groupWritePermission!.propagation).toBe(true)

    const groupAdminPermission = directPermissions!.find(
      (permission) =>
        permission.userGroupId === group4.id &&
        permission.permissionLevel === PermissionLevel.ADMIN
    )
    expect(groupAdminPermission).toBeTruthy()
    expect(groupAdminPermission!.propagation).toBe(true)

    // verify that the correct derived permissions have been created for the users (& linked to the correct direct permissions)
    const courseDerivedReadPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(courseDerivedReadPermission).toBeTruthy()
    expect(courseDerivedReadPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(courseDerivedReadPermission!.directPermissionId).toBe(
      res5!.permissionId // group permission should dominate individual permission (same permission level, but propagation enabled)
    )

    const courseDerivedExecutePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(courseDerivedExecutePermission).toBeTruthy()
    expect(courseDerivedExecutePermission!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(courseDerivedExecutePermission!.directPermissionId).toBe(
      res6!.permissionId
    )

    const courseDerivedWritePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFour.id,
          },
        },
      })
    expect(courseDerivedWritePermission).toBeTruthy()
    expect(courseDerivedWritePermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(courseDerivedWritePermission!.directPermissionId).toBe(
      res7!.permissionId
    )

    const courseDerivedAdminPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFive.id,
          },
        },
      })
    expect(courseDerivedAdminPermission).toBeTruthy()
    expect(courseDerivedAdminPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(courseDerivedAdminPermission!.directPermissionId).toBe(
      res8!.permissionId
    )

    // test fetching derived permissions on contained activities / elements / resources
    const derivedPermissionsCourse = await getDerivedCoursePermissions(
      { id: course.id },
      userOneCtx
    )
    const derivedPermissionsLiveQuiz = await getDerivedLiveQuizPermissions(
      { id: liveQuiz.id },
      userOneCtx
    )
    const derivedPermissionsPracticeQuiz =
      await getDerivedPracticeQuizPermissions(
        { id: practiceQuiz.id },
        userOneCtx
      )
    const derivedPermissionsMicrolearning =
      await getDerivedMicroLearningPermissions(
        { id: microlearning.id },
        userOneCtx
      )
    const derivedPermissionsGroupActivity =
      await getDerivedGroupActivityPermissions(
        { id: groupActivity.id },
        userOneCtx
      )
    const derivedPermissionsSC = await getDerivedElementPermissions(
      { id: SC.id },
      userOneCtx
    )
    const derivedPermissionsSE = await getDerivedElementPermissions(
      { id: SE.id },
      userOneCtx
    )
    const derivedPermissionsAnswerCollection =
      await getDerivedAnswerCollectionPermissions({ id: AC.id }, userOneCtx)

    // verify that no derived permissions are returned on the course (no "derived" permissions available)
    expect(derivedPermissionsCourse).toBeTruthy()
    expect(derivedPermissionsCourse!.length).toBe(0)

    // verify that the correct derived permissions for all users are returned on the live quiz
    expect(derivedPermissionsLiveQuiz).toBeTruthy()
    expect(derivedPermissionsLiveQuiz!.length).toBe(4)
    expect(
      derivedPermissionsLiveQuiz!.find(
        (permission) => permission.userId === userTwo.id
      )?.permissionLevel
    ).toBe(PermissionLevel.READ)
    expect(
      derivedPermissionsLiveQuiz!.find(
        (permission) => permission.userId === userThree.id
      )?.permissionLevel
    ).toBe(PermissionLevel.EXECUTE)
    expect(
      derivedPermissionsLiveQuiz!.find(
        (permission) => permission.userId === userFour.id
      )?.permissionLevel
    ).toBe(PermissionLevel.WRITE)
    expect(
      derivedPermissionsLiveQuiz!.find(
        (permission) => permission.userId === userFive.id
      )?.permissionLevel
    ).toBe(PermissionLevel.ADMIN)

    // verify that the correct derived permissions for all users are returned on the practice quiz
    expect(derivedPermissionsPracticeQuiz).toBeTruthy()
    expect(derivedPermissionsPracticeQuiz!.length).toBe(4)
    expect(
      derivedPermissionsPracticeQuiz!.find(
        (permission) => permission.userId === userTwo.id
      )?.permissionLevel
    ).toBe(PermissionLevel.READ)
    expect(
      derivedPermissionsPracticeQuiz!.find(
        (permission) => permission.userId === userThree.id
      )?.permissionLevel
    ).toBe(PermissionLevel.EXECUTE)
    expect(
      derivedPermissionsPracticeQuiz!.find(
        (permission) => permission.userId === userFour.id
      )?.permissionLevel
    ).toBe(PermissionLevel.WRITE)
    expect(
      derivedPermissionsPracticeQuiz!.find(
        (permission) => permission.userId === userFive.id
      )?.permissionLevel
    ).toBe(PermissionLevel.ADMIN)

    // verify that the correct derived permissions for all users are returned on the microlearning
    expect(derivedPermissionsMicrolearning).toBeTruthy()
    expect(derivedPermissionsMicrolearning!.length).toBe(4)
    expect(
      derivedPermissionsMicrolearning!.find(
        (permission) =>
          permission.userId === userTwo.id &&
          permission.permissionLevel === PermissionLevel.READ
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsMicrolearning!.find(
        (permission) =>
          permission.userId === userThree.id &&
          permission.permissionLevel === PermissionLevel.EXECUTE
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsMicrolearning!.find(
        (permission) =>
          permission.userId === userFour.id &&
          permission.permissionLevel === PermissionLevel.WRITE
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsMicrolearning!.find(
        (permission) =>
          permission.userId === userFive.id &&
          permission.permissionLevel === PermissionLevel.ADMIN
      )
    ).toBeTruthy()

    // verify that the correct derived permissions for all users are returned on the group activity
    expect(derivedPermissionsGroupActivity).toBeTruthy()
    expect(derivedPermissionsGroupActivity!.length).toBe(4)
    expect(
      derivedPermissionsGroupActivity!.find(
        (permission) =>
          permission.userId === userTwo.id &&
          permission.permissionLevel === PermissionLevel.READ
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsGroupActivity!.find(
        (permission) =>
          permission.userId === userThree.id &&
          permission.permissionLevel === PermissionLevel.EXECUTE
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsGroupActivity!.find(
        (permission) =>
          permission.userId === userFour.id &&
          permission.permissionLevel === PermissionLevel.WRITE
      )
    ).toBeTruthy()
    expect(
      derivedPermissionsGroupActivity!.find(
        (permission) =>
          permission.userId === userFive.id &&
          permission.permissionLevel === PermissionLevel.ADMIN
      )
    ).toBeTruthy()

    // verify that the correct derived permissions for all users are returned on the elements
    expect(derivedPermissionsSC).toBeTruthy()
    expect(derivedPermissionsSC!.length).toBe(1) // only for admin users on the activity, permissions propagate to elements
    expect(derivedPermissionsSC![0]!.userId).toBe(userFive.id)
    expect(derivedPermissionsSC![0]!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    expect(derivedPermissionsSE).toBeTruthy()
    expect(derivedPermissionsSE!.length).toBe(1) // only for admin users on the activity, permissions propagate to elements
    expect(derivedPermissionsSE![0]!.userId).toBe(userFive.id)
    expect(derivedPermissionsSE![0]!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    // verify that only the one user with propagated permissions to the elements gets a derived permission on the resource
    expect(derivedPermissionsAnswerCollection).toBeTruthy()
    expect(derivedPermissionsAnswerCollection!.length).toBe(1)
    expect(derivedPermissionsAnswerCollection![0]!.userId).toBe(userFive.id)
    expect(derivedPermissionsAnswerCollection![0]!.permissionLevel).toBe(
      PermissionLevel.READ
    )
  })

  it('Verify that the level of an individual course permission can be changed', async () => {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
    } = await seedCourseActivities(prisma)

    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]

    // grant individual READ permissions on the course to user 2
    const res1 = await shareObject(
      {
        courseId: course.id,
        shortnameOrEmail: userTwo.shortname,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // create an access request for user 3 on the course, live quiz, selection question and answer collection
    await prisma.accessRequest.createMany({
      data: [
        {
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          courseId: course.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SC.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userThree.id,
          objectAdminOrOwnerId: userOne.id,
          answerCollectionId: AC.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    // verify that user 2 has READ permissions on the course and all activities (taking sample = live quiz), but no elements
    const readPermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionCourse).toBeTruthy()
    expect(readPermissionCourse!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermissionCourse!.directPermissionId).toBe(res1!.permissionId)

    const readPermissionLiveQuiz = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionLiveQuiz).toBeTruthy()
    expect(readPermissionLiveQuiz!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermissionLiveQuiz!.directPermissionId).toBe(res1!.permissionId)

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to EXECUTE and verify that the number of access requests has not changed
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

    // verify that user 2 has EXECUTE permissions on the course and all activities (taking sample = practice quiz), but no elements
    const executePermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionCourse).toBeTruthy()
    expect(executePermissionCourse!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    const executePermissionPracticeQuiz =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executePermissionPracticeQuiz).toBeTruthy()
    expect(executePermissionPracticeQuiz!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // verify that a proper audit log entry has been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toContain(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.EXECUTE} for ${ObjectType.COURSE} (ID ${course.id}) through owner / admin ${userOne.id} for user ${userTwo.id}.`
    )

    // change the permission level of user 2 to WRITE (without propagation) and verify that the number of access requests has not changed
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(4)

    // verify that user 2 has EXECUTE permissions on the course and all activities (taking sample = microlearning), but no elements
    const writePermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionCourse).toBeTruthy()
    expect(writePermissionCourse!.permissionLevel).toBe(PermissionLevel.WRITE)

    const writePermissionMicrolearning =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionMicrolearning).toBeTruthy()
    expect(writePermissionMicrolearning!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to WRITE (with propagation) and verify that the number of access requests has not changed
    const res4 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    const accessRequestCount4 = await prisma.accessRequest.count()
    expect(accessRequestCount4).toBe(4)

    // verify that user 2 has WRITE permissions on the course and all activities (taking sample = microlearning), but no elements
    const writePermissionCourse2 = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionCourse2).toBeTruthy()
    expect(writePermissionCourse2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const writePermissionMicrolearning2 =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionMicrolearning2).toBeTruthy()
    expect(writePermissionMicrolearning2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to ADMIN and verify that the number of access requests has changed (instances for user 2 were created)
    const res5 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()

    const accessRequestCount5 = await prisma.accessRequest.count()
    expect(accessRequestCount5).toBe(7) // access requests on course, live quiz, single choice question have been duplicated

    const newCourseAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        courseId_userId_objectAdminOrOwnerId: {
          courseId: course.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(newCourseAccessRequest).toBeTruthy()

    const newLiveQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userThree.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(newLiveQuizAccessRequest).toBeTruthy()

    const newSelectionQuestionAccessRequest =
      await prisma.accessRequest.findUnique({
        where: {
          elementId_userId_objectAdminOrOwnerId: {
            elementId: SC.id,
            userId: userThree.id,
            objectAdminOrOwnerId: userTwo.id,
          },
        },
      })
    expect(newSelectionQuestionAccessRequest).toBeTruthy()

    // verify that user 2 has ADMIN permissions on the course and all activities & elements (taking samples)
    const adminPermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionCourse).toBeTruthy()
    expect(adminPermissionCourse!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const adminPermissionGroupActivity =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionGroupActivity).toBeTruthy()
    expect(adminPermissionGroupActivity!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    for (const elementId of elementIds) {
      const adminPermissionElement = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId,
            userId: userTwo.id,
          },
        },
      })
      expect(adminPermissionElement).toBeTruthy()
      expect(adminPermissionElement!.permissionLevel).toBe(
        PermissionLevel.ADMIN
      )
    }

    // downgrade the user to WRITE permissions again and verify that the corresponding derived permissions and access requests have been removed again
    const res6 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()

    const accessRequestCount6 = await prisma.accessRequest.count()
    expect(accessRequestCount6).toBe(4) // access requests on course, live quiz, single choice question have been removed

    const downgradedCourseDerivedPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(downgradedCourseDerivedPermission).toBeTruthy()
    expect(downgradedCourseDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const downgradedLiveQuizDerivedPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(downgradedLiveQuizDerivedPermission).toBeTruthy()
    expect(downgradedLiveQuizDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    for (const elementId of elementIds) {
      const removedElementPermissions =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(removedElementPermissions).toBeNull()
    }

    // verify that a proper audit log entry has been created
    const auditLogEntry5 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry5).toBeTruthy()
    expect(auditLogEntry5!.message).toContain(
      `Permission level changed from ${PermissionLevel.ADMIN} to ${PermissionLevel.WRITE} for ${ObjectType.COURSE} (ID ${course.id}) through owner / admin ${userOne.id} for user ${userTwo.id}.`
    )
  })

  it('Verify that the level of an group course permission can be changed', async () => {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group1,
    } = await seedCourseActivities(prisma)

    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]

    // grant individual READ permissions on the course to user 2
    const res1 = await shareObject(
      {
        courseId: course.id,
        userGroupId: group1.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // create an access request for user 3 on the course, live quiz, selection question and answer collection
    await prisma.accessRequest.createMany({
      data: [
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          courseId: course.id,
          permissionLevel: PermissionLevel.READ,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          liveQuizId: liveQuiz.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          elementId: SC.id,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          userId: userSix.id,
          objectAdminOrOwnerId: userOne.id,
          answerCollectionId: AC.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    const accessRequestCount = await prisma.accessRequest.count()
    expect(accessRequestCount).toBe(4)

    // verify that user 2 has READ permissions on the course and all activities (taking sample = live quiz), but no elements
    const readPermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionCourse).toBeTruthy()
    expect(readPermissionCourse!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermissionCourse!.directPermissionId).toBe(res1!.permissionId)

    const readPermissionLiveQuiz = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwo.id,
        },
      },
    })
    expect(readPermissionLiveQuiz).toBeTruthy()
    expect(readPermissionLiveQuiz!.permissionLevel).toBe(PermissionLevel.READ)
    expect(readPermissionLiveQuiz!.directPermissionId).toBe(res1!.permissionId)

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to EXECUTE and verify that the number of access requests has not changed
    const res2 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: false,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const accessRequestCount2 = await prisma.accessRequest.count()
    expect(accessRequestCount2).toBe(4)

    // verify that user 2 has EXECUTE permissions on the course and all activities (taking sample = practice quiz), but no elements
    const executePermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(executePermissionCourse).toBeTruthy()
    expect(executePermissionCourse!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    const executePermissionPracticeQuiz =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(executePermissionPracticeQuiz).toBeTruthy()
    expect(executePermissionPracticeQuiz!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to WRITE (without propagation) and verify that the number of access requests has not changed
    const res3 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const accessRequestCount3 = await prisma.accessRequest.count()
    expect(accessRequestCount3).toBe(4)

    // verify that user 2 has EXECUTE permissions on the course and all activities (taking sample = microlearning), but no elements
    const writePermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionCourse).toBeTruthy()
    expect(writePermissionCourse!.permissionLevel).toBe(PermissionLevel.WRITE)

    const writePermissionMicrolearning =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionMicrolearning).toBeTruthy()
    expect(writePermissionMicrolearning!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to WRITE (with propagation) and verify that the number of access requests has not changed
    const res4 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    const accessRequestCount4 = await prisma.accessRequest.count()
    expect(accessRequestCount4).toBe(4)

    // verify that user 2 has WRITE permissions on the course and all activities (taking sample = microlearning), but no elements
    const writePermissionCourse2 = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(writePermissionCourse2).toBeTruthy()
    expect(writePermissionCourse2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const writePermissionMicrolearning2 =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userTwo.id,
          },
        },
      })
    expect(writePermissionMicrolearning2).toBeTruthy()
    expect(writePermissionMicrolearning2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    for (const elementId of elementIds) {
      const missingElementPermission =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(missingElementPermission).toBeNull()
    }

    // change the permission level of user 2 to ADMIN and verify that the number of access requests has changed (instances for user 2 were created)
    const res5 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
      userOneCtx
    )
    expect(res5).toBeTruthy()

    const accessRequestCount5 = await prisma.accessRequest.count()
    expect(accessRequestCount5).toBe(7) // access requests on course, live quiz, single choice question have been duplicated

    const newCourseAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        courseId_userId_objectAdminOrOwnerId: {
          courseId: course.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(newCourseAccessRequest).toBeTruthy()

    const newLiveQuizAccessRequest = await prisma.accessRequest.findUnique({
      where: {
        liveQuizId_userId_objectAdminOrOwnerId: {
          liveQuizId: liveQuiz.id,
          userId: userSix.id,
          objectAdminOrOwnerId: userTwo.id,
        },
      },
    })
    expect(newLiveQuizAccessRequest).toBeTruthy()

    const newSelectionQuestionAccessRequest =
      await prisma.accessRequest.findUnique({
        where: {
          elementId_userId_objectAdminOrOwnerId: {
            elementId: SC.id,
            userId: userSix.id,
            objectAdminOrOwnerId: userTwo.id,
          },
        },
      })
    expect(newSelectionQuestionAccessRequest).toBeTruthy()

    // verify that user 2 has ADMIN permissions on the course and all activities & elements (taking samples)
    const adminPermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(adminPermissionCourse).toBeTruthy()
    expect(adminPermissionCourse!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const adminPermissionGroupActivity =
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: groupActivity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(adminPermissionGroupActivity).toBeTruthy()
    expect(adminPermissionGroupActivity!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    for (const elementId of elementIds) {
      const adminPermissionElement = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId,
            userId: userTwo.id,
          },
        },
      })
      expect(adminPermissionElement).toBeTruthy()
      expect(adminPermissionElement!.permissionLevel).toBe(
        PermissionLevel.ADMIN
      )
    }

    // downgrade the user to WRITE permissions again and verify that the corresponding derived permissions and access requests have been removed again
    const res6 = await changeObjectPermissionLevel(
      {
        permissionId: res1!.permissionId,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
      userOneCtx
    )
    expect(res6).toBeTruthy()

    const accessRequestCount6 = await prisma.accessRequest.count()
    expect(accessRequestCount6).toBe(4) // access requests on course, live quiz, single choice question have been removed

    const downgradedCourseDerivedPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(downgradedCourseDerivedPermission).toBeTruthy()
    expect(downgradedCourseDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    const downgradedLiveQuizDerivedPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      })
    expect(downgradedLiveQuizDerivedPermission).toBeTruthy()
    expect(downgradedLiveQuizDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )

    for (const elementId of elementIds) {
      const removedElementPermissions =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(removedElementPermissions).toBeNull()
    }
  })

  it('Verify that the ownership transfer function works correctly', async () => {
    const {
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      microlearning,
    } = await seedCourseActivities(prisma)

    const elementIds = [
      SC.id,
      MC.id,
      KP.id,
      NR.id,
      FT.id,
      SE.id,
      CS.id,
      FC.id,
      CT.id,
    ]

    // grant WRITE permissions to user 2 on the course
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

    // transfer the ownership of the course to user 2
    const res1 = await transferCourseOwnership(
      { id: course.id, shortnameOrEmail: userTwo.shortname },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    // verify that a proper audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.OWNER_TRANSFERRED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toContain(
      `Ownership of ${ObjectType.COURSE} (ID ${course.id}) transferred from user ${userOne.id} to user ${userTwo.id}.`
    )

    // verify that the direct permission on the course has been removed, but derived permissions on the depenent objects were created
    const removedDirectPermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          userId: userTwo.id,
          courseId: course.id,
        },
      },
    })
    expect(removedDirectPermission).toBeNull()

    const derivedPermissionCourse = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionCourse).toBeTruthy()
    expect(derivedPermissionCourse!.permissionLevel).toBe(PermissionLevel.OWNER)

    const derivedPermissionLiveQuiz = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(derivedPermissionLiveQuiz).toBeTruthy()
    expect(derivedPermissionLiveQuiz!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    for (const elementId of elementIds) {
      const derivedPermissionElement =
        await prisma.derivedPermission.findUnique({
          where: {
            elementId_userId: {
              elementId,
              userId: userTwo.id,
            },
          },
        })
      expect(derivedPermissionElement).toBeTruthy()
      expect(derivedPermissionElement!.permissionLevel).toBe(
        PermissionLevel.ADMIN
      )
    }

    // verify that the original owner (user 1) was granted ADMIN permissions on the course
    const newDirectPermissionForOwner = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          userId: userOne.id,
          courseId: course.id,
        },
      },
    })
    expect(newDirectPermissionForOwner).toBeTruthy()
    expect(newDirectPermissionForOwner!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    // transfer the ownership of the course to user 3
    const res2 = await transferCourseOwnership(
      { id: course.id, shortnameOrEmail: userThree.email },
      userTwoCtx
    )
    expect(res2).toBeTruthy()

    // verify that a proper audit log entry has been created
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.OWNER_TRANSFERRED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userTwo.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toContain(
      `Ownership of ${ObjectType.COURSE} (ID ${course.id}) transferred from user ${userTwo.id} to user ${userThree.id}.`
    )

    // verify that derived permissions on the course and the dependent objects were created for the new owner
    const derivedPermissionCourse2 = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermissionCourse2).toBeTruthy()
    expect(derivedPermissionCourse2!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const derivedPermissionMicrolearning =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionMicrolearning).toBeTruthy()
    expect(derivedPermissionMicrolearning!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
  })

  it('Verify that individual and group permissions can be revoked on courses', async () => {
    const {
      AC,
      SC,
      MC,
      KP,
      NR,
      FT,
      SE,
      CS,
      FC,
      CT,
      course,
      liveQuiz,
      practiceQuiz,
      microlearning,
      groupActivity,
      group3,
      group4,
    } = await seedCourseActivities(prisma)

    // grant individual READ and ADMIN permissions to users 2 and 3 on the course
    // grand group WRITE and ADMIN permissions to group 3 and 4 (users 4 and 5) on the course
    const indReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })
    const indAdminPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })
    const groupWritePermission = await prisma.permission.create({
      data: {
        userGroupId: group3.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })
    const groupAdminPermission = await prisma.permission.create({
      data: {
        userGroupId: group4.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // revoke the individual READ permission and verify that the corresponding derived permissions were removed
    const existingReadCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(existingReadCoursePermission).toBeTruthy()

    const res1 = await revokeObjectAccess(
      { permissionId: indReadPermission.id, courseId: course.id },
      userOneCtx
    )
    expect(res1).toBeTruthy()

    const removedReadCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(removedReadCoursePermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toContain(
      `Permission revoked for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} for user ${userTwo.id}.`
    )

    // revoke the individual ADMIN permission and verify that the corresponding derived permissions were removed
    const existingAdminCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(existingAdminCoursePermission).toBeTruthy()

    const existingDerivedLiveQuizPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(existingDerivedLiveQuizPermission).toBeTruthy()

    const res2 = await revokeObjectAccess(
      { permissionId: indAdminPermission.id, courseId: course.id },
      userOneCtx
    )
    expect(res2).toBeTruthy()

    const removedAdminCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(removedAdminCoursePermission).toBeNull()

    const removedDerivedLiveQuizPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: liveQuiz.id,
            userId: userThree.id,
          },
        },
      })
    expect(removedDerivedLiveQuizPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toContain(
      `Permission revoked for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} for user ${userThree.id}.`
    )

    // revoke the group WRITE permission and verify that the corresponding derived permissions were removed
    const existingGroupWriteCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFour.id,
          },
        },
      })
    expect(existingGroupWriteCoursePermission).toBeTruthy()

    const existingGroupWritePracticeQuizPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(existingGroupWritePracticeQuizPermission).toBeTruthy()

    const res3 = await revokeObjectAccess(
      { permissionId: groupWritePermission.id, courseId: course.id },
      userOneCtx
    )
    expect(res3).toBeTruthy()

    const removedGroupWriteCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFour.id,
          },
        },
      })
    expect(removedGroupWriteCoursePermission).toBeNull()

    const removedGroupWritePracticeQuizPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: practiceQuiz.id,
            userId: userFour.id,
          },
        },
      })
    expect(removedGroupWritePracticeQuizPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group3.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toContain(
      `Permission revoked for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} for user group ${group3.id}.`
    )

    // revoke the group ADMIN permission and verify that the corresponding derived permissions were removed
    const existingGroupAdminCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFive.id,
          },
        },
      })
    expect(existingGroupAdminCoursePermission).toBeTruthy()

    const existingGroupAdminMicrolearningPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFive.id,
          },
        },
      })
    expect(existingGroupAdminMicrolearningPermission).toBeTruthy()

    const existingGroupAdminElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(existingGroupAdminElementPermission).toBeTruthy()

    const res4 = await revokeObjectAccess(
      { permissionId: groupAdminPermission.id, courseId: course.id },
      userOneCtx
    )
    expect(res4).toBeTruthy()

    const removedGroupAdminCoursePermission =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFive.id,
          },
        },
      })
    expect(removedGroupAdminCoursePermission).toBeNull()

    const removedGroupAdminMicrolearningPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: microlearning.id,
            userId: userFive.id,
          },
        },
      })
    expect(removedGroupAdminMicrolearningPermission).toBeNull()

    const removedGroupAdminElementPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SC.id,
            userId: userFive.id,
          },
        },
      })
    expect(removedGroupAdminElementPermission).toBeNull()

    // verify that a proper audit log entry has been created
    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectType: ObjectType.COURSE,
        objectId: course.id,
        sourceUserId: userOne.id,
        targetUserGroupId: group4.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toContain(
      `Permission revoked for ${ObjectType.COURSE} (ID ${course.id}) by owner / admin ${userOne.id} for user group ${group4.id}.`
    )
  })

  it('Verify that users can remove their own direct permission to a course', async () => {
    const { course, liveQuiz } = await seedCourseActivities(prisma)

    // grant WRITE permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

    // check that the owner cannot use the removal function to revoke a user's access
    const res = await removeCourse({ id: course.id }, userOneCtx)
    expect(res).toBeNull()
    const res2 = await removeCourse({ id: course.id }, userThreeCtx)
    expect(res2).toBeNull()
    const res3 = await removeCourse({ id: course.id }, userTwoCtx)
    expect(res3).toBeTruthy()

    // check that the direct permission was removed correctly
    const removedWritePermission = await prisma.permission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
  })
})
