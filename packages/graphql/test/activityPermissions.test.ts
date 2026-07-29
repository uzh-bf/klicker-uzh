import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  Permission,
  PermissionLevel,
  PrismaClient,
  UserGroup,
} from '@klicker-uzh/prisma/client'
import { ChoicesElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests covering the creation of derived permissions for activities', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter

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

  beforeEach(async () => await testInitialization(prisma, hatchet, emitter))

  afterEach(async () => await testCleanup(prisma))

  // ! Live quiz permissions tests
  // #region
  it('LQ: Verify that owner permissions on a live quiz are correctly copied into the derived permissions table', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that a correct derived ownership permission has been created for the activity owner
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()
  })

  it('LQ: Verify that other direct permissions are correctly copied into the derived permissions table', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4 on activity
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (READ - derived), user 3 (WRITE - derived), user 4 (ADMIN - derived)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()
  })

  it('LQ: Verify that when passing a userId only the corresponding derived permissions are updated', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group consisting of user 3 and 4
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4 on activity
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant ADMIN permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity and user 1
    await recomputeDerivedPermissions(
      { liveQuizId: activity.id, userId: userOne.id },
      prisma
    )

    // verify that only a derived permission for the activity owner has been created
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

    // verify that permissions for user 2, 3, and 4 have not been created yet
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()

    const missingPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(missingPermissionUserThree).toBeNull()

    const missingPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(missingPermissionUserFour).toBeNull()

    // trigger recomputation of derived permissions for the activity and user 3
    await recomputeDerivedPermissions(
      { liveQuizId: activity.id, userId: userThree.id },
      prisma
    )

    // verify that a derived permission with ADMIN permission level has been created for user 3 (users 2 and 4 still have no access)
    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const missingPermissionUserTwo2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(missingPermissionUserTwo2).toBeNull()

    const missingPermissionUserFour2 =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      })
    expect(missingPermissionUserFour2).toBeNull()
  })

  it('LQ: Verify that user group permissions are correctly expanded into individual derived permissions', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group consisting of user 2 and 3 and grant READ permissions to them
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // create a second user group consisting of users 3 and 4 and grant WRITE permissions to them
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const groupPermission2 = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (READ - group), user 3 (WRITE - group), user 4 (WRITE - group)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission2.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      groupPermission2.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()
  })

  it('LQ: Verify that on deletion of the direct permission, the derived permissions from direct permissions are removed', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group with users 2 and 3, grant them WRITE access and give individual ADMIN access to user 4
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 3 (WRITE - group), user 4 (ADMIN - individual)
    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      individualPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    // remove both direct permission and recompute the derived permissions
    await prisma.permission.delete({
      where: {
        id: groupPermission.id,
      },
    })
    await prisma.permission.delete({
      where: {
        id: individualPermission.id,
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the derived permissions have been removed
    const missingPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(missingPermissionUserThree).toBeNull()

    const missingPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(missingPermissionUserFour).toBeNull()
  })

  it('LQ: Verify that individual permissions have precedence over user group permissions if higher and vice-versa', async () => {
    // create a live quiz
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group with users 2, 3, and 4 and grant WRITE permissions to it
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userTwo.id },
            { id: userThree.id },
            { id: userFour.id },
          ],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant individual READ, WRITE and ADMIN access to users 2, 3, and 4 respectively
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const individualPermissionUserThree = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const individualPermissionUserFour = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 2 (WRITE - group), user 3 (WRITE - group / individual), user 4 (ADMIN - individual)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect([individualPermissionUserThree.id, groupPermission.id]).toContain(
      derivedPermissionUserThree!.directPermissionId
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      individualPermissionUserFour.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()
  })

  // ? Course -> Activity
  async function prepareCourseActivitiesIndividual(prisma, propagation) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // add individual READ permissions for user 2, WRITE permissions for user 3, ADMIN permissions for user 4 on the course, EXECUTE permissions for user 5
    const courseREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const courseWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const courseADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })
    const courseEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })

    // recompute the derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    return {
      course,
      activity,
      courseREADPermissions,
      courseWRITEPermissions,
      courseADMINPermissions,
      courseEXECUTEPermissions,
    }
  }

  it('LQ: Verify that minimum required permissions are correctly granted on activities for individual users', async () => {
    const {
      activity,
      courseREADPermissions,
      courseWRITEPermissions,
      courseADMINPermissions,
      courseEXECUTEPermissions,
    } = await prepareCourseActivitiesIndividual(prisma, false)

    // verify that the correct derived permission entries have been created on the activity (minimum required - propagation disabled)
    // user 2 (READ - course), user 3 (READ - course), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      courseREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      courseWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      courseADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      courseEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  })

  it('LQ: Verify that propagated permissions are correctly granted on activities for individual users', async () => {
    const {
      activity,
      courseREADPermissions,
      courseWRITEPermissions,
      courseADMINPermissions,
      courseEXECUTEPermissions,
    } = await prepareCourseActivitiesIndividual(prisma, true)

    // verify that the correct derived permission entries have been created on the activity (propagation enabled)
    // user 2 (READ - course), user 3 (WRITE - course), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      courseREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      courseWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      courseADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      courseEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  })

  async function prepareCourseActivitiesGroups(prisma, propagation) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create separate user groups for the users 2, 3, 4, and 5
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup5 = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // grant READ, WRITE, ADMIN, and EXECUTE permissions to the user groups, respectively (propagation disabled)
    const groupREADPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const groupWRITEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const groupADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })
    const groupEXECUTEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })

    // recompute the derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    return {
      course,
      activity,
      userGroup2,
      userGroup3,
      userGroup4,
      userGroup5,
      groupREADPermissions,
      groupWRITEPermissions,
      groupADMINPermissions,
      groupEXECUTEPermissions,
    }
  }

  it('LQ: Verify that minimum required permissions are correctly granted on activities for user groups', async () => {
    const {
      activity,
      groupREADPermissions,
      groupWRITEPermissions,
      groupADMINPermissions,
      groupEXECUTEPermissions,
    } = await prepareCourseActivitiesGroups(prisma, false)

    // verify that the correct derived permission entries have been created on the activity (minimum required - propagation disabled)
    // user 2 (READ - course), user 3 (READ - course), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      groupADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      groupEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  })

  it('LQ: Verify that propagated permissions are correctly granted on activities for user groups', async () => {
    const {
      activity,
      groupREADPermissions,
      groupWRITEPermissions,
      groupADMINPermissions,
      groupEXECUTEPermissions,
    } = await prepareCourseActivitiesGroups(prisma, true)

    // verify that the correct derived permission entries have been created on the activity (minimum required - propagation disabled)
    // user 2 (READ - course), user 3 (WRITE - course), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      groupADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      groupEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  })

  it('LQ: Verify that revoking access to the course also revokes access to the activity (assuming no direct access)', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // grant individual access to user 2 (WRITE permissions)
    const courseWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (minimum required - propagation disabled)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      courseWRITEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    // revoke direct permissions and recompute the derived permissions
    await prisma.permission.delete({
      where: {
        id: courseWRITEPermissions.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permissions have been removed
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()
  })

  it('LQ: Verify that revoking group access to the course also revokes access to the activity (assuming no direct access)', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a user group with user 2 and grant ADMIN access to it
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (minimum required - propagation disabled)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    // revoke group permissions and recompute the derived permissions
    await prisma.permission.delete({
      where: {
        id: groupPermission.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permissions have been removed
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()
  })

  it('LQ: Verify that revoking group access to the course does not revoke access to the activity if individual access exists', async () => {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create a user group with users 2 & 3 and grant WRITE access to it
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })

    // grant individual READ access to user 3
    const individualPermissionUserThree = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (propagation enabled)
    // user 2 (WRITE - course), user 3 (WRITE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    // revoke direct access to the course for the user group and recompute the derived permissions
    await prisma.permission.delete({
      where: {
        id: groupPermission.id,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the permissions for user 2 have been removed, user 3 has been reset to the individual permission level
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree2 =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree2).toBeTruthy()
    expect(derivedPermissionUserThree2!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserThree2!.directPermissionId).toBe(
      individualPermissionUserThree.id
    )
    expect(derivedPermissionUserThree2!.derived).toBeTruthy()
  })

  async function courseActivityPermissionPrecedenceIndividual(
    prisma,
    individualRecomputation
  ) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // grant individual READ, WRITE, ADMIN, and EXECUTE permissions to user 2, 3, 4, and 5 on the course
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })
    const courseADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
    })
    const courseEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: true,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // grant individual EXECUTE, ADMIN, WRITE, READ permissions to user 2, 3, 4, and 5 on the activity
    const activityEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: false,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFive.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (individualRecomputation) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)
    }

    // verify that the correct derived permission entries have been created on the activity (propagation enabled)
    // user 2 (EXECUTE - activity), user 3 (ADMIN - activity), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityEXECUTEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      courseADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      courseEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('LQ: Verify that direct access to the activity takes precedence over course access if higher - and vice-versa (individual recomputation with userId)', async () => {
    await courseActivityPermissionPrecedenceIndividual(prisma, true)
  })

  async function courseActivityPermissionPrecedenceGroups(
    prisma,
    individualRecomputation
  ) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        description: 'Description',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // create single participant user groups for users 2, 3, 4, and 5
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup5 = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // grant READ, WRITE, ADMIN, and EXECUTE permissions to the user groups on the course
    await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })
    const courseADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
    })
    const courseEXECUTEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: true,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // create a live quiz and link it to the course
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })

    // grant EXECUTE, ADMIN, WRITE, READ permissions to the user groups on the activity
    const activityEXECUTEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation: false,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (individualRecomputation) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)
    }

    // verify that the correct derived permission entries have been created on the activity (propagation enabled)
    // user 2 (EXECUTE - activity), user 3 (ADMIN - activity), user 4 (ADMIN - course), user 5 (EXECUTE - course)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityEXECUTEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      courseADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      courseEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('LQ: Verify that direct group access to the activity takes precedence over course access if higher - and vice-versa (individual recomputation with userId)', async () => {
    await courseActivityPermissionPrecedenceGroups(prisma, true)
  })

  it('LQ: Verify that direct access to the activity takes precedence over course access if higher - and vice-versa (object recomputation without userId)', async () => {
    await courseActivityPermissionPrecedenceIndividual(prisma, false)
  })

  it('LQ: Verify that direct group access to the activity takes precedence over course access if higher - and vice-versa (object recomputation without userId)', async () => {
    await courseActivityPermissionPrecedenceGroups(prisma, false)
  })

  // ? Activity -> Element
  async function createActivityWithElement(prisma) {
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

    // create an activity that contains an instance of the element
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    return { element, activity }
  }

  async function testActivityElementPropagationIndividual(prisma, propagation) {
    const { element, activity } = await createActivityWithElement(prisma)

    // grant individual READ, WRITE, ADMIN, and EXECUTE permissions to user 2, 3, 4, and 5 on the activity
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const activityEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFive.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (min. required = propagation enabled)
    // user 2 (no access when min. required, READ access when propagation enabled),
    // user 3 (no access when min. required, READ access when propagation enabled),
    // user 4 (no access when min. required, WRITE access when propagation enabled),
    // user 5 (ADMIN access - min. required = propagated)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })

    if (propagation) {
      expect(derivedPermissionUserTwo).toBeTruthy()
      expect(derivedPermissionUserTwo!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(derivedPermissionUserTwo!.directPermissionId).toBe(
        activityREADPermissions.id
      )
      expect(derivedPermissionUserTwo!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserTwo).toBeNull()
    }

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })

    if (propagation) {
      expect(derivedPermissionUserThree).toBeTruthy()
      expect(derivedPermissionUserThree!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(derivedPermissionUserThree!.directPermissionId).toBe(
        activityEXECUTEPermissions.id
      )
      expect(derivedPermissionUserThree!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserThree).toBeNull()
    }

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFour.id,
          },
        },
      }
    )

    if (propagation) {
      expect(derivedPermissionUserFour).toBeTruthy()
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        activityWRITEPermissions.id
      )
      expect(derivedPermissionUserFour!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserFour).toBeNull()
    }

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFive.id,
          },
        },
      }
    )

    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('LQ: Verify that minimum required permissions are correctly granted on elements for individual users', async () => {
    await testActivityElementPropagationIndividual(prisma, false)
  })

  it('LQ: Verify that propagated permissions are correctly granted on elements for individual users', async () => {
    await testActivityElementPropagationIndividual(prisma, true)
  })

  async function testActivityElementPropagationGroups(prisma, propagation) {
    const { element, activity } = await createActivityWithElement(prisma)

    // create single participant user groups for users 2, 3, 4, and 5
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroup5 = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // grant individual READ, WRITE, ADMIN, and EXECUTE permissions to user groups 2, 3, 4, and 5 on the activity
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const activityEXECUTEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (min. required = propagation enabled)
    // user 2 (no access when min. required, READ access when propagation enabled),
    // user 3 (no access when min. required, READ access when propagation enabled),
    // user 4 (no access when min. required, WRITE access when propagation enabled),
    // user 5 (ADMIN access - min. required = propagated)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })

    if (propagation) {
      expect(derivedPermissionUserTwo).toBeTruthy()
      expect(derivedPermissionUserTwo!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(derivedPermissionUserTwo!.directPermissionId).toBe(
        activityREADPermissions.id
      )
      expect(derivedPermissionUserTwo!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserTwo).toBeNull()
    }

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })

    if (propagation) {
      expect(derivedPermissionUserThree).toBeTruthy()
      expect(derivedPermissionUserThree!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(derivedPermissionUserThree!.directPermissionId).toBe(
        activityEXECUTEPermissions.id
      )
      expect(derivedPermissionUserThree!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserThree).toBeNull()
    }

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFour.id,
          },
        },
      }
    )

    if (propagation) {
      expect(derivedPermissionUserFour).toBeTruthy()
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        activityWRITEPermissions.id
      )
      expect(derivedPermissionUserFour!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserFour).toBeNull()
    }

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('LQ: Verify that minimum required permissions are correctly granted on elements for user groups', async () => {
    await testActivityElementPropagationGroups(prisma, false)
  })

  it('LQ: Verify that propagated permissions are correctly granted on elements for user groups', async () => {
    await testActivityElementPropagationGroups(prisma, true)
  })

  it('LQ: Verify that derived permissions on elements from activity are revoked when removing access to the activity (assuming no direct access)', async () => {
    const { element, activity } = await createActivityWithElement(prisma)

    // grant direct access to activity (ADMIN level) to user 2
    const activityPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (propagation disabled)
    // user 2 (ADMIN - activity)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    // revoke direct access to the activity for user 2
    await prisma.permission.delete({
      where: {
        id: activityPermission.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the derived permission entries have been removed on the activity
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()
  })

  it('LQ: Verify that derived permissions on elements from activity are revoked when removing group access to the activity (assuming no direct access)', async () => {
    const { element, activity } = await createActivityWithElement(prisma)

    // create single participant user group for user 2
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant direct access to activity (ADMIN level) to the user group
    const activityPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (propagation disabled)
    // user 2 (ADMIN - activity), user 3 (ADMIN - activity)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    // revoke direct access to the activity for the user group
    await prisma.permission.delete({
      where: {
        id: activityPermission.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the derived permission entries have been removed on the activity
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()

    const missingPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(missingPermissionUserThree).toBeNull()
  })

  it('LQ: Verify that derived permissions on elements from activity are not revoked if group access to activity is revoked, but individual activity access exists', async () => {
    const { element, activity } = await createActivityWithElement(prisma)

    // create single participant user group for user 2
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant direct access to activity (ADMIN level) to the user group
    const activityPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // grant individual ADMIN access to the activity (ADMIN level) to user 2
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries have been created on the activity (propagation disabled)
    // user 2 (ADMIN - activity), user 3 (ADMIN - activity)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect([activityPermission.id, userTwoPermission.id]).toContain(
      derivedPermissionUserTwo!.directPermissionId
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    // revoke direct access to the activity for the user group
    await prisma.permission.delete({
      where: {
        id: activityPermission.id,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the derived access to the element has been removed for user 3, but not for user 2
    const intactPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(intactPermissionUserTwo).toBeTruthy()
    expect(intactPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(intactPermissionUserTwo!.directPermissionId).toBe(
      userTwoPermission.id
    )
    expect(intactPermissionUserTwo!.derived).toBeTruthy()

    const missingPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(missingPermissionUserThree).toBeNull()
  })

  async function testActivityAnswerCollectionPropagation(
    prisma,
    groupPermissions
  ) {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element that is linked to the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create an activity that contains an instance of the element
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    let userGroup2: UserGroup | null = null
    let userGroup3: UserGroup | null = null
    let userGroup4: UserGroup | null = null
    let userGroup5: UserGroup | null = null
    let activityADMINPermissions: Permission
    if (groupPermissions) {
      // create individual user groups for users 2, 3, 4, and 5
      userGroup2 = await prisma.userGroup.create({
        data: {
          name: 'User Group 2',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
        },
      })
      userGroup3 = await prisma.userGroup.create({
        data: {
          name: 'User Group 3',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userThree.id }],
          },
        },
      })
      userGroup4 = await prisma.userGroup.create({
        data: {
          name: 'User Group 4',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userFour.id }],
          },
        },
      })
      userGroup5 = await prisma.userGroup.create({
        data: {
          name: 'User Group 5',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userFive.id }],
          },
        },
      })

      // grant READ, WRITE, ADMIN, and EXECUTE group permissions to user 2, 3, 4, and 5 on the activity
      await prisma.permission.create({
        data: {
          userGroupId: userGroup2?.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.READ,
        },
      })
      await prisma.permission.create({
        data: {
          userGroupId: userGroup3?.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      })
      activityADMINPermissions = await prisma.permission.create({
        data: {
          userGroupId: userGroup4?.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      })
      await prisma.permission.create({
        data: {
          userGroupId: userGroup5?.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
      })
    } else {
      // grant individual READ, WRITE, ADMIN, and EXECUTE permissions to user 2, 3, 4, and 5 on the activity
      await prisma.permission.create({
        data: {
          userId: userTwo.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.READ,
        },
      })
      await prisma.permission.create({
        data: {
          userId: userThree.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.WRITE,
        },
      })
      activityADMINPermissions = await prisma.permission.create({
        data: {
          userId: userFour.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      })
      await prisma.permission.create({
        data: {
          userId: userFive.id,
          liveQuizId: activity.id,
          permissionLevel: PermissionLevel.EXECUTE,
        },
      })
    }

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that only user 4 was granted derived READ permissions on the answer collection (through propagation to element)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeNull()
  }

  it('LQ: Verify that when sufficient direct permission exists on live quiz for derived permissions on elements, derived permissions are extended to answer collections', async () => {
    await testActivityAnswerCollectionPropagation(prisma, false)
  })

  it('LQ: Verify that when sufficient direct group permission exists on live quiz for derived permissions on elements, derived permissions are extended to answer collections', async () => {
    await testActivityAnswerCollectionPropagation(prisma, true)
  })

  async function testOwnerPropagationToElement(prisma, individualRecompute) {
    // create an element with user 2 as the owner
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userTwo.id,
      },
    })

    // create an activity that contains an instance of the element with user 1 as the owner
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    // trigger recomputation of the derived permissions on the activity
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userTwo.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)
    }

    // verify that the correct derived permission entries have been created on the element
    // user 1 (ADMIN - derived from activity), user 2 (OWNER)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeTruthy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBeNull()
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()
  }

  it('Verify that owner permissions are correctly propagated to required elements (user-specific derived permissions recomputation)', async () => {
    await testOwnerPropagationToElement(prisma, true)
  })

  it('Verify that owner permissions are correctly propagated to required elements (object-level derived permissions recomputation)', async () => {
    await testOwnerPropagationToElement(prisma, false)
  })

  async function testOwnerPropagationFromCourse(prisma, individualRecompute) {
    // create a course with user 1 as the owner
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 2000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

    // trigger recomputation of the derived permissions on the course
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // create an activity that is linked to the course with user 2 as the owner
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userTwo.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of the derived permissions on the activity
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userTwo.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)
    }

    // verify that the correct derived permission entries have been created on the activity
    // user 1 (ADMIN - derived from course), user 2 (OWNER)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeTruthy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBeNull()
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()
  }

  it('Verify that owner permissions are correctly propagated from dependent courses (user-specific derived permissions recomputation)', async () => {
    await testOwnerPropagationFromCourse(prisma, true)
  })

  it('Verify that owner permissions are correctly propagated from dependent courses (object-level derived permissions recomputation)', async () => {
    await testOwnerPropagationFromCourse(prisma, false)
  })

  it('LQ: converges exact rows across direct, group, and course sources', async () => {
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Activity permission oracle group',
        ownerId: userThree.id,
        members: { connect: { id: userFour.id } },
        admins: { connect: { id: userFive.id } },
      },
    })
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const courseWritePermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    const courseAdminPermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await prisma.derivedPermission.deleteMany({
      where: { liveQuizId: activity.id },
    })

    const readRows = async () =>
      await prisma.derivedPermission.findMany({
        where: { liveQuizId: activity.id },
        select: {
          userId: true,
          permissionLevel: true,
          directPermissionId: true,
          derived: true,
        },
        orderBy: { userId: 'asc' },
      })
    const sortedRows = (
      rows: {
        userId: string
        permissionLevel: PermissionLevel
        directPermissionId: number | null
        derived: boolean
      }[]
    ) => rows.sort((left, right) => left.userId.localeCompare(right.userId))

    await recomputeDerivedPermissions(
      { liveQuizId: activity.id, userId: userTwo.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { liveQuizId: activity.id, userId: userFour.id },
      prisma
    )

    expect(await readRows()).toEqual(
      sortedRows([
        {
          userId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: directPermission.id,
          derived: false,
        },
        {
          userId: userFour.id,
          permissionLevel: PermissionLevel.EXECUTE,
          directPermissionId: courseWritePermission.id,
          derived: true,
        },
      ])
    )

    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    expect(await readRows()).toEqual(
      sortedRows([
        {
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
          directPermissionId: null,
          derived: false,
        },
        {
          userId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: directPermission.id,
          derived: false,
        },
        {
          userId: userThree.id,
          permissionLevel: PermissionLevel.READ,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFour.id,
          permissionLevel: PermissionLevel.EXECUTE,
          directPermissionId: courseWritePermission.id,
          derived: true,
        },
        {
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: courseAdminPermission.id,
          derived: true,
        },
      ])
    )

    await prisma.permission.deleteMany({
      where: {
        id: { in: [directPermission.id, courseWritePermission.id] },
      },
    })
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    expect(await readRows()).toEqual(
      sortedRows([
        {
          userId: userOne.id,
          permissionLevel: PermissionLevel.OWNER,
          directPermissionId: null,
          derived: false,
        },
        {
          userId: userThree.id,
          permissionLevel: PermissionLevel.READ,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFour.id,
          permissionLevel: PermissionLevel.READ,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: courseAdminPermission.id,
          derived: true,
        },
      ])
    )
  })
  // #endregion

  // ! Practice quiz permissions tests (reduced due to shared logic with live quiz)
  // #region
  async function createPracticeQuiz(prisma) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

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

    // create a practice quiz that contains an instance of the element
    const activity = await prisma.practiceQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userOne.id,
        courseId: course.id,
        stacks: {
          create: [
            {
              type: ElementStackType.PRACTICE_QUIZ,
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.PRACTICE_QUIZ,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    return { element, activity, course }
  }

  async function individualPermissionsCopyToDerived({
    prisma,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    prisma: any
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  }) {
    // create direct individual permissions for users 2, 3, 4, and 5 on the activity
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const activityEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userFive.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (practiceQuizId) {
      await recomputeDerivedPermissions({ practiceQuizId }, prisma)
    } else if (microLearningId) {
      await recomputeDerivedPermissions({ microLearningId }, prisma)
    } else if (groupActivityId) {
      await recomputeDerivedPermissions({ groupActivityId }, prisma)
    }

    // verify that the correct derived permission entries have been created on the activity
    // user 2 (READ), user 3 (WRITE), user 4 (ADMIN), and user 5 (EXECUTE)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId:
          typeof practiceQuizId !== 'undefined'
            ? {
                practiceQuizId,
                userId: userTwo.id,
              }
            : undefined,
        microLearningId_userId:
          typeof microLearningId !== 'undefined'
            ? {
                microLearningId,
                userId: userTwo.id,
              }
            : undefined,
        groupActivityId_userId:
          typeof groupActivityId !== 'undefined'
            ? {
                groupActivityId,
                userId: userTwo.id,
              }
            : undefined,
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userThree.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userThree.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userThree.id,
                }
              : undefined,
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFour.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFour.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFour.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFive.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFive.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFive.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      activityEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()
  }

  it('PQ: Verify that owner and direct permissions are correctly copied into the derived permissions table', async () => {
    const { activity } = await createPracticeQuiz(prisma)

    await individualPermissionsCopyToDerived({
      prisma,
      practiceQuizId: activity.id,
    })
  })

  async function groupPermissionsCopyDerived({
    prisma,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    prisma: any
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  }) {
    // create four user groups with users 2 and 3, 3 and 4, 4 and 5 and 5 only respectively
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }, { id: userFive.id }],
        },
      },
    })
    const userGroup5 = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // create direct group permissions on the activity
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (practiceQuizId) {
      await recomputeDerivedPermissions({ practiceQuizId }, prisma)
    } else if (microLearningId) {
      await recomputeDerivedPermissions({ microLearningId }, prisma)
    } else if (groupActivityId) {
      await recomputeDerivedPermissions({ groupActivityId }, prisma)
    }

    // verify that the correct derived permission entries have been created on the activity
    // user 2 (READ), user 3 (WRITE), user 4 (ADMIN), and user 5 (ADMIN)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId:
          typeof practiceQuizId !== 'undefined'
            ? {
                practiceQuizId,
                userId: userTwo.id,
              }
            : undefined,
        microLearningId_userId:
          typeof microLearningId !== 'undefined'
            ? {
                microLearningId,
                userId: userTwo.id,
              }
            : undefined,
        groupActivityId_userId:
          typeof groupActivityId !== 'undefined'
            ? {
                groupActivityId,
                userId: userTwo.id,
              }
            : undefined,
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userThree.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userThree.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userThree.id,
                }
              : undefined,
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFour.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFour.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFour.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFive.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFive.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFive.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()
  }

  it('PQ: Verify that group permissions are correctly expanded into individual derived permissions', async () => {
    const { activity } = await createPracticeQuiz(prisma)

    await groupPermissionsCopyDerived({
      prisma,
      practiceQuizId: activity.id,
    })
  })

  async function testCourseToActivityPermissionsPropagation({
    prisma,
    courseId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
    propagation,
  }: {
    prisma: any
    courseId: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
    propagation: boolean
  }) {
    // grant direct permissions on the course to users 2, 3, 4, and 5 with propagation according to parameter
    const courseREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: courseId,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const courseWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: courseId,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const courseADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: courseId,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })
    const courseEXECUTEPermissions = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: courseId,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })

    // trigger recomputation of derived permissions for the course
    await recomputeDerivedPermissions({ courseId: courseId }, prisma)

    // verify that the correct derived permission entries have been created on the activity
    // (propagation disabled) user 2 (READ), user 3 (READ), user 4 (ADMIN), and user 5 (EXECUTE)
    // (propagation enabled) user 2 (READ), user 3 (WRITE), user 4 (ADMIN), and user 5 (EXECUTE)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId:
          typeof practiceQuizId !== 'undefined'
            ? {
                practiceQuizId,
                userId: userTwo.id,
              }
            : undefined,
        microLearningId_userId:
          typeof microLearningId !== 'undefined'
            ? {
                microLearningId,
                userId: userTwo.id,
              }
            : undefined,
        groupActivityId_userId:
          typeof groupActivityId !== 'undefined'
            ? {
                groupActivityId,
                userId: userTwo.id,
              }
            : undefined,
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      courseREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userThree.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userThree.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userThree.id,
                }
              : undefined,
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      courseWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFour.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFour.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFour.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      courseADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId:
            typeof practiceQuizId !== 'undefined'
              ? {
                  practiceQuizId,
                  userId: userFive.id,
                }
              : undefined,
          microLearningId_userId:
            typeof microLearningId !== 'undefined'
              ? {
                  microLearningId,
                  userId: userFive.id,
                }
              : undefined,
          groupActivityId_userId:
            typeof groupActivityId !== 'undefined'
              ? {
                  groupActivityId,
                  userId: userFive.id,
                }
              : undefined,
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      courseEXECUTEPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('PQ: Verify that minimum required permissions from course are granted on practice quiz', async () => {
    const { activity, course } = await createPracticeQuiz(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      practiceQuizId: activity.id,
      propagation: false,
    })
  })

  it('PQ: Verify that propagated permissions from course are granted on practice quiz', async () => {
    const { activity, course } = await createPracticeQuiz(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      practiceQuizId: activity.id,
      propagation: true,
    })
  })

  async function testActivityToElementPermissionsPropagation({
    prisma,
    elementId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    prisma: any
    elementId: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  }) {
    // create direct individual permissions for users 2, 3, 4, and 5 on the activity
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFive.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (practiceQuizId) {
      await recomputeDerivedPermissions({ practiceQuizId }, prisma)
    } else if (microLearningId) {
      await recomputeDerivedPermissions({ microLearningId }, prisma)
    } else if (groupActivityId) {
      await recomputeDerivedPermissions({ groupActivityId }, prisma)
    }

    // verify that the correct derived permission entries for the contained element have been created
    // user 2 (no access), user 3 (no access), user 4 (ADMIN), and user 5 (no access)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeNull()
  }

  it('PQ: Verify that derived access to elements is granted for users with sufficient access on practice quiz', async () => {
    const { element, activity } = await createPracticeQuiz(prisma)

    await testActivityToElementPermissionsPropagation({
      prisma,
      elementId: element.id,
      practiceQuizId: activity.id,
    })
  })

  async function testActivityToElementGroupPermissionsPropagation({
    prisma,
    elementId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    prisma: any
    elementId: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  }) {
    // create user groups with users 2 and 3, 3 and 4, 4 and 5 and 5 only respectively
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const userGroup4 = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }, { id: userFive.id }],
        },
      },
    })
    const userGroup5 = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // create direct individual permissions for users 2, 3, 4, and 5 on the activity
    await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (practiceQuizId) {
      await recomputeDerivedPermissions({ practiceQuizId }, prisma)
    } else if (microLearningId) {
      await recomputeDerivedPermissions({ microLearningId }, prisma)
    } else if (groupActivityId) {
      await recomputeDerivedPermissions({ groupActivityId }, prisma)
    }

    // verify that the correct derived permission entries for the contained element have been created
    // user 2 (no access), user 3 (no access), user 4 (ADMIN), and user 5 (ADMIN)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('PQ: Verify that derived access to elements is granted for user groups with sufficient access on practice quiz', async () => {
    const { element, activity } = await createPracticeQuiz(prisma)

    await testActivityToElementGroupPermissionsPropagation({
      prisma,
      elementId: element.id,
      practiceQuizId: activity.id,
    })
  })
  // #endregion

  // ! Microlearning permissions tests (reduced due to shared logic with live quiz)
  // #region
  async function createMicroLearning(prisma) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

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

    // create a microlearning that contains an instance of the element
    const activity = await prisma.microLearning.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        stacks: {
          create: [
            {
              type: ElementStackType.MICROLEARNING,
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.MICROLEARNING,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    return { element, activity, course }
  }

  it('ML: Verify that owner and direct permissions are correctly copied into the derived permissions table', async () => {
    const { activity } = await createMicroLearning(prisma)

    await individualPermissionsCopyToDerived({
      prisma,
      microLearningId: activity.id,
    })
  })

  it('ML: Verify that group permissions are correctly expanded into individual derived permissions', async () => {
    const { activity } = await createMicroLearning(prisma)

    await groupPermissionsCopyDerived({
      prisma,
      microLearningId: activity.id,
    })
  })

  it('ML: Verify that minimum required permissions from course are granted on microlearning', async () => {
    const { activity, course } = await createMicroLearning(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      microLearningId: activity.id,
      propagation: false,
    })
  })

  it('ML: Verify that propagated permissions from course are granted on microlearning', async () => {
    const { activity, course } = await createMicroLearning(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      microLearningId: activity.id,
      propagation: true,
    })
  })

  it('ML: Verify that derived access to elements is granted for users with sufficient access on microlearning', async () => {
    const { element, activity } = await createMicroLearning(prisma)

    await testActivityToElementPermissionsPropagation({
      prisma,
      elementId: element.id,
      microLearningId: activity.id,
    })
  })

  it('ML: Verify that derived access to elements is granted for user groups with sufficient access on microlearning', async () => {
    const { element, activity } = await createMicroLearning(prisma)

    await testActivityToElementGroupPermissionsPropagation({
      prisma,
      elementId: element.id,
      microLearningId: activity.id,
    })
  })
  // #endregion

  // ! Group activity permissions tests (reduced due to shared logic with live quiz)
  // #region
  async function createGroupActivity(prisma) {
    // create a course
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })

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

    // create a microlearning that contains an instance of the element
    const activity = await prisma.groupActivity.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        ownerId: userOne.id,
        courseId: course.id,
        stacks: {
          create: [
            {
              type: ElementStackType.GROUP_ACTIVITY,
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: element.id,
                    type: ElementInstanceType.GROUP_ACTIVITY,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userOne.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })

    return { element, activity, course }
  }

  it('GA: Verify that owner and direct permissions are correctly copied into the derived permissions table', async () => {
    const { activity } = await createGroupActivity(prisma)

    await individualPermissionsCopyToDerived({
      prisma,
      groupActivityId: activity.id,
    })
  })

  it('GA: Verify that group permissions are correctly expanded into individual derived permissions', async () => {
    const { activity } = await createGroupActivity(prisma)

    await groupPermissionsCopyDerived({
      prisma,
      groupActivityId: activity.id,
    })
  })

  it('GA: Verify that minimum required permissions from course are granted on group activity', async () => {
    const { activity, course } = await createGroupActivity(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      groupActivityId: activity.id,
      propagation: false,
    })
  })

  it('GA: Verify that propagated permissions from course are granted on group activity', async () => {
    const { activity, course } = await createGroupActivity(prisma)

    await testCourseToActivityPermissionsPropagation({
      prisma,
      courseId: course.id,
      groupActivityId: activity.id,
      propagation: true,
    })
  })

  it('GA: Verify that derived access to elements is granted for users with sufficient access on group activity', async () => {
    const { element, activity } = await createGroupActivity(prisma)

    await testActivityToElementPermissionsPropagation({
      prisma,
      elementId: element.id,
      groupActivityId: activity.id,
    })
  })

  it('GA: Verify that derived access to elements is granted for user groups with sufficient access on group activity', async () => {
    const { element, activity } = await createGroupActivity(prisma)

    await testActivityToElementGroupPermissionsPropagation({
      prisma,
      elementId: element.id,
      groupActivityId: activity.id,
    })
  })
  // #endregion
})
