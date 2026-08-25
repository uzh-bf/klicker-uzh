import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { ChoicesElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests covering the creation of derived permissions for courses', () => {
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

  beforeEach(async () => testInitialization(prisma, hatchet, emitter))

  afterEach(async () => await testCleanup(prisma))

  // ! Course permissions tests
  // #region
  async function createCourse(prisma) {
    return await prisma.course.create({
      data: {
        name: 'Test Course',
        displayName: 'Test Course',
        pinCode: 1000,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        ownerId: userOne.id,
      },
    })
  }

  it('converges scoped and object rows and propagates the selected course source', async () => {
    const course = await createCourse(prisma)
    const activity = await prisma.practiceQuiz.create({
      data: {
        name: 'Course permission oracle activity',
        displayName: 'Course permission oracle activity',
        ownerId: userOne.id,
        courseId: course.id,
      },
    })
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Course permission oracle group',
        ownerId: userThree.id,
        members: { connect: { id: userTwo.id } },
        admins: { connect: { id: userFour.id } },
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
    const adminPermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    const readRows = () =>
      prisma.derivedPermission.findMany({
        where: { courseId: course.id },
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

    for (const userId of [userTwo.id, userFour.id, userFive.id]) {
      await recomputeDerivedPermissions({ courseId: course.id, userId }, prisma)
    }

    expect(await readRows()).toEqual(
      sortedRows([
        {
          userId: userTwo.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: adminPermission.id,
          derived: false,
        },
      ])
    )
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    ).toMatchObject({
      permissionLevel: PermissionLevel.WRITE,
      directPermissionId: groupPermission.id,
      derived: true,
    })

    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

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
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFour.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: adminPermission.id,
          derived: false,
        },
      ])
    )

    await prisma.userGroup.update({
      where: { id: userGroup.id },
      data: { admins: { disconnect: { id: userFour.id } } },
    })
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userFour.id },
      prisma
    )

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
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userThree.id,
          permissionLevel: PermissionLevel.WRITE,
          directPermissionId: groupPermission.id,
          derived: false,
        },
        {
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: adminPermission.id,
          derived: false,
        },
      ])
    )
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFour.id,
          },
        },
      })
    ).toBeNull()

    await prisma.permission.delete({ where: { id: groupPermission.id } })
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

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
          userId: userFive.id,
          permissionLevel: PermissionLevel.ADMIN,
          directPermissionId: adminPermission.id,
          derived: false,
        },
      ])
    )
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    ).toMatchObject({
      permissionLevel: PermissionLevel.EXECUTE,
      directPermissionId: directPermission.id,
      derived: true,
    })
  })

  it('Verify that owner and direct permissions are correctly copied into the derived permissions table', async () => {
    // create a course
    const course = await createCourse(prisma)

    // create direct permissions on the course for users 2, 3, 4, and 5 with permission levels READ, WRITE, ADMIN, and EXECUTE
    const directReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const directExecutePermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the correct derived permissions have been created
    // user 1 (OWNER), user 2 (READ), user 3 (WRITE), user 4 (ADMIN), user 5 (EXECUTE)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      directWritePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directAdminPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directExecutePermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()
  })

  it('Verify that group permissions are correctly expanded into individual derived permissions', async () => {
    // create a course
    const course = await createCourse(prisma)

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

    // create group permissions on the course for user groups 2, 3, 4, and 5 with permission levels READ, WRITE, ADMIN, and EXECUTE
    const activityReadPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const activityWritePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityAdminPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroup5.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the correct derived permissions have been created
    // user 1 (OWNER), user 2 (READ), user 3 (WRITE), user 4 (ADMIN), user 5 (ADMIN)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityReadPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWritePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      activityAdminPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      activityAdminPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()
  })

  async function testCoursePermissionsPrecedence(prisma, recomputeIndividual) {
    // create a course
    const course = await createCourse(prisma)

    // create a user group with users 2, 3, 4, and 5
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userTwo.id },
            { id: userThree.id },
            { id: userFour.id },
            { id: userFive.id },
          ],
        },
      },
    })

    // grant WRITE permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant individual READ, WRITE, ADMIN and EXECUTE permissions to users 2, 3, 4, and 5
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const individualWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const individualAdminPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })

    // trigger recomputation of derived permissions
    if (recomputeIndividual) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions have been created
    // user 1 (OWNER), user 2 (WRITE - group), user 3 (WRITE - group / individual), user 4 (ADMIN - individual), user 5 (WRITE - group)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        courseId_userId: {
          courseId: course.id,
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
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect([individualWritePermission.id, groupPermission.id]).toContain(
      derivedPermissionUserThree!.directPermissionId
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      individualAdminPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()
  }

  it('Verify that the higher direct permission (individual or group) takes precedence (individual derived permission computation)', async () => {
    await testCoursePermissionsPrecedence(prisma, true)
  })

  it('Verify that the higher direct permission (individual or group) takes precedence (object-level derived permission computation)', async () => {
    await testCoursePermissionsPrecedence(prisma, false)
  })

  it('Verify that when deleting direct permissions the corresponding derived permissions are removed', async () => {
    // create a course
    const course = await createCourse(prisma)

    // grant individual WRITE permission to user 3
    const individualWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the correct derived permissions have been created
    // user 2 (WRITE - individual)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      individualWritePermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    // delete the individual WRITE permission
    await prisma.permission.delete({
      where: { id: individualWritePermission.id },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permission has been removed
    const derivedPermissionUserTwoAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserTwoAfterDeletion).toBeNull()
  })

  it('Verify that when using the recomputation function with a userId, only the corresponding derived permissions are updated', async () => {
    // create a course
    const course = await createCourse(prisma)

    // grant individual READ and WRITE permissions to users 2 and 3
    const courseReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for user 2
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

    // verify that the derived permission for user 2 has been created, the one for user 3 not yet
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      courseReadPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

    // update the direct permission for user 2 to WRITE
    await prisma.permission.update({
      where: { id: courseReadPermission.id },
      data: { permissionLevel: PermissionLevel.WRITE },
    })

    // trigger recomputation of derived permissions for user 2
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

    // verify that the derived permission for user 2 has been updated
    const updatedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(updatedDerivedPermissionUserTwo!.directPermissionId).toBe(
      courseReadPermission.id
    )
    expect(updatedDerivedPermissionUserTwo!.derived).toBeFalsy()

    // delete the individual permission for user 2
    await prisma.permission.delete({
      where: { id: courseReadPermission.id },
    })

    // trigger recomputation of derived permissions for user 2
    await recomputeDerivedPermissions(
      { courseId: course.id, userId: userTwo.id },
      prisma
    )

    // verify that the derived permission for user 2 has been removed
    const derivedPermissionUserTwoAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionUserTwoAfterDeletion).toBeNull()
  })

  // ? Course -> Activity (propagation of permissions already covered in activity permissions test suite)
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

  it('Verify that revoking access to the course also revokes access to the activity (assuming no direct access)', async () => {
    const { activity, course } = await createPracticeQuiz(prisma)

    // grant individual WRITE permission to user 2
    const individualWritePermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the correct derived permissions have been created
    // user 2 (READ - individual)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      individualWritePermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    // delete the direct permission on the course
    await prisma.permission.delete({
      where: { id: individualWritePermission.id },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permission on the activity for user 2 was removed
    const derivedPermissionUserTwoAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionUserTwoAfterDeletion).toBeNull()
  })

  it('Verify that revoking group access to the course also revokes access to the activity (assuming no direct access)', async () => {
    const { activity, course } = await createPracticeQuiz(prisma)

    // create a user group with users 2 and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant direct WRITE access with propagation on the course to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the users were granted derived WRITE access to the activity
    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
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

    // delete the group permission on the course
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permission on the activity for user 3 was removed
    const derivedPermissionUserThreeAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThreeAfterDeletion).toBeNull()
  })

  it('Verify that revoking group access to the course does not revoke access to the activity if individual access exists', async () => {
    const { activity, course } = await createPracticeQuiz(prisma)

    // create a user group with users 2 and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // grant direct WRITE access with propagation on the course to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })

    // grant direct READ access on the activity to user 2
    const individualReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the users were granted derived WRITE access to the activity
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: activity.id,
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
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
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

    // revoke the group permission on the course
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that user 2 retains READ access on the activity, while the access for user 3 has been revoked completely
    const derivedPermissionUserTwoAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionUserTwoAfterDeletion).toBeTruthy()
    expect(derivedPermissionUserTwoAfterDeletion!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserTwoAfterDeletion!.directPermissionId).toBe(
      individualReadPermission.id
    )
    expect(derivedPermissionUserTwoAfterDeletion!.derived).toBeFalsy()

    const derivedPermissionUserThreeAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThreeAfterDeletion).toBeNull()
  })

  async function individualPermissionsCourseActivityPrecedence(
    prisma,
    individualRecompute,
    propagation
  ) {
    const { activity, course } = await createPracticeQuiz(prisma)

    // grant individual READ, EXECUTE, WRITE, and ADMIN access on course to users 2, 3, 4, and 5
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // grant individual ADMIN, WRITE, EXECUTE, and READ access directly on activity to users 2, 3, 4, and
    // propagation parameter is not set here - does not affect granted permissions on dependent objects
    const activityAdminPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const activityWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityExecutePermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFive.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions have been created
    // (propagation disabled) user 1 (OWNER), user 2 (ADMIN - activity), user 3 (WRITE - activity), user 4 (EXECUTE - activity), user 5 (ADMIN - course)
    // (propagation enabled)user 1 (OWNER), user 2 (ADMIN - activity), user 3 (WRITE - activity), user 4 (WRITE - course), user 5 (ADMIN - course)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        practiceQuizId_userId: {
          practiceQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityAdminPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWritePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    if (propagation) {
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        directWritePermission.id
      )
      expect(derivedPermissionUserFour!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.EXECUTE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        activityExecutePermission.id
      )
      expect(derivedPermissionUserFour!.derived).toBeFalsy()
    }

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
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
      directAdminPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('Verify that direct access to the activity takes precedence over course access if higher and vice-versa (without propagation, individual recomputation with userId)', async () => {
    await individualPermissionsCourseActivityPrecedence(prisma, true, false)
  })

  it('Verify that direct access to the activity takes precedence over course access if higher and vice-versa (without propagation, object recomputation without userId)', async () => {
    await individualPermissionsCourseActivityPrecedence(prisma, false, false)
  })

  it('Verify that direct access to the activity takes precedence over course access if higher and vice-versa (with propagation, individual recomputation with userId)', async () => {
    await individualPermissionsCourseActivityPrecedence(prisma, true, true)
  })

  it('Verify that direct access to the activity takes precedence over course access if higher and vice-versa (with propagation, object recomputation without userId)', async () => {
    await individualPermissionsCourseActivityPrecedence(prisma, false, true)
  })

  async function GroupPermissionsCourseActivityPrecedence(
    prisma,
    individualRecompute,
    propagation
  ) {
    const { activity, course } = await createPracticeQuiz(prisma)

    // create single pariticipant user groups with users 2, 3, 4, and 5
    const userGroupTwo = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroupThree = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroupFour = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroupFive = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // grant group READ, EXECUTE, WRITE, and ADMIN access on course to users 2, 3, 4, and 5
    await prisma.permission.create({
      data: {
        userGroupId: userGroupTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroupThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // grant individual ADMIN, WRITE, EXECUTE, and READ access directly on activity to users 2, 3, 4, and
    // propagation parameter is not set here - does not affect granted permissions on dependent objects
    const activityAdminPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupTwo.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const activityWritePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupThree.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const activityExecutePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupFour.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })
    await prisma.permission.create({
      data: {
        userGroupId: userGroupFive.id,
        practiceQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions have been created
    // (propagation disabled) user 1 (OWNER), user 2 (ADMIN - activity), user 3 (WRITE - activity), user 4 (EXECUTE - activity), user 5 (ADMIN - course)
    // (propagation enabled)user 1 (OWNER), user 2 (ADMIN - activity), user 3 (WRITE - activity), user 4 (WRITE - course), user 5 (ADMIN - course)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        practiceQuizId_userId: {
          practiceQuizId: activity.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      activityAdminPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      activityWritePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(derivedPermissionUserFour).toBeTruthy()
    if (propagation) {
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        directWritePermission.id
      )
      expect(derivedPermissionUserFour!.derived).toBeTruthy()
    } else {
      expect(derivedPermissionUserFour!.permissionLevel).toBe(
        PermissionLevel.EXECUTE
      )
      expect(derivedPermissionUserFour!.directPermissionId).toBe(
        activityExecutePermission.id
      )
      expect(derivedPermissionUserFour!.derived).toBeFalsy()
    }

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
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
      directAdminPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()
  }

  it('Verify that direct group access to the activity takes precedence over course access if higher and vice-versa (without propagation, individual recomputation with userId)', async () => {
    await GroupPermissionsCourseActivityPrecedence(prisma, true, false)
  })

  it('Verify that direct group access to the activity takes precedence over course access if higher and vice-versa (without propagation, object recomputation without userId)', async () => {
    await GroupPermissionsCourseActivityPrecedence(prisma, false, false)
  })

  it('Verify that direct group access to the activity takes precedence over course access if higher and vice-versa (with propagation, individual recomputation with userId)', async () => {
    await GroupPermissionsCourseActivityPrecedence(prisma, true, true)
  })

  it('Verify that direct group access to the activity takes precedence over course access if higher and vice-versa (with propagation, object recomputation without userId)', async () => {
    await GroupPermissionsCourseActivityPrecedence(prisma, false, true)
  })

  // ? Course -> Activity -> Element -> Answer Collection
  async function createCourseWithActivityElementResource(prisma) {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userTwo.id,
      },
    })

    // create an element that contains an instance of the answer collection
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

    // create an activity that contains an instance of the element
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

    return { answerCollection, element, activity, course }
  }

  async function testFullCoursePropagationIndividual(
    prisma,
    individualRecompute,
    propagation
  ) {
    // answer collection owned by user 2, element, activity and course all owned by user 1
    const { answerCollection, element, activity, course } =
      await createCourseWithActivityElementResource(prisma)

    // grant individual permissions on the course with READ, EXECUTE, WRITE, and ADMIN level to users 2, 3, 4, and 5
    const directReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const directExecutePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // trigger recomputation of derived permissions
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions on the course have been created
    // user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (WRITE), user 5 (ADMIN)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      directExecutePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directWritePermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directAdminPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()

    // verify that the correct derived permissions on the practice quiz (activity) have been created
    // (propagation disabled) user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (READ), user 5 (ADMIN)
    // (propagation enabled) user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (WRITE), user 5 (ADMIN)
    const derivedPermissionActivityUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionActivityUserOne).toBeTruthy()
    expect(derivedPermissionActivityUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionActivityUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionActivityUserOne!.derived).toBeFalsy()

    const derivedPermissionActivityUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionActivityUserTwo).toBeTruthy()
    expect(derivedPermissionActivityUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionActivityUserTwo!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedPermissionActivityUserTwo!.derived).toBeTruthy()

    const derivedPermissionActivityUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionActivityUserThree).toBeTruthy()
    expect(derivedPermissionActivityUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionActivityUserThree!.directPermissionId).toBe(
      directExecutePermission.id
    )
    expect(derivedPermissionActivityUserThree!.derived).toBeTruthy()

    const derivedPermissionActivityUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionActivityUserFour).toBeTruthy()
    expect(derivedPermissionActivityUserFour!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(derivedPermissionActivityUserFour!.directPermissionId).toBe(
      directWritePermission.id
    )
    expect(derivedPermissionActivityUserFour!.derived).toBeTruthy()

    const derivedPermissionActivityUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionActivityUserFive).toBeTruthy()
    expect(derivedPermissionActivityUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionActivityUserFive!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionActivityUserFive!.derived).toBeTruthy()

    // verify that the correct derived permissions on the element have been created
    // user 1 (OWNER), user 2 (no access), user 3 (no access), user 4 (no access), user 5 (ADMIN)
    const derivedPermissionElementUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionElementUserOne).toBeTruthy()
    expect(derivedPermissionElementUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionElementUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionElementUserOne!.derived).toBeFalsy()

    const derivedPermissionElementUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionElementUserTwo).toBeNull()

    const derivedPermissionElementUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionElementUserThree).toBeNull()

    const derivedPermissionElementUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionElementUserFour).toBeNull()

    const derivedPermissionElementUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionElementUserFive).toBeTruthy()
    expect(derivedPermissionElementUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionElementUserFive!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionElementUserFive!.derived).toBeTruthy()

    // verify that the correct derived permissions on the answer collection have been created
    // user 1 (READ), user 2 (OWNER), user 3 (no access), user 4 (no access), user 5 (READ)
    const derivedPermissionAnswerCollectionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserOne).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserOne!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(
      derivedPermissionAnswerCollectionUserOne!.directPermissionId
    ).toBeNull()
    expect(derivedPermissionAnswerCollectionUserOne!.derived).toBeTruthy()

    const derivedPermissionAnswerCollectionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserTwo).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserTwo!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(
      derivedPermissionAnswerCollectionUserTwo!.directPermissionId
    ).toBeNull()
    expect(derivedPermissionAnswerCollectionUserTwo!.derived).toBeFalsy()

    const derivedPermissionAnswerCollectionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserThree).toBeNull()

    const derivedPermissionAnswerCollectionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserFour).toBeNull()

    const derivedPermissionAnswerCollectionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserFive).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserFive!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionAnswerCollectionUserFive?.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionAnswerCollectionUserFive!.derived).toBeTruthy()
  }

  it('Verify that minimum required permissions are correctly passed down from course all the way down to answer collection (individual derived permission recomputation)', async () => {
    await testFullCoursePropagationIndividual(prisma, true, false)
  })

  it('Verify that minimum required permissions are correctly passed down from course all the way down to answer collection (object-level derived permission recomputation)', async () => {
    await testFullCoursePropagationIndividual(prisma, false, false)
  })

  it('Verify that propagated permissions are correctly passed down from course all the way down to answer collection (individual derived permission recomputation)', async () => {
    await testFullCoursePropagationIndividual(prisma, true, true)
  })

  it('Verify that propagated permissions are correctly passed down from course all the way down to answer collection (object-level derived permission recomputation)', async () => {
    await testFullCoursePropagationIndividual(prisma, false, true)
  })

  async function testFullCoursePropagationGroups(
    prisma,
    individualRecompute,
    propagation
  ) {
    // answer collection owned by user 2, element, activity and course all owned by user 1
    const { answerCollection, element, activity, course } =
      await createCourseWithActivityElementResource(prisma)

    // create single pariticipant user groups with users 2, 3, 4, and 5
    const userGroupTwo = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }],
        },
      },
    })
    const userGroupThree = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }],
        },
      },
    })
    const userGroupFour = await prisma.userGroup.create({
      data: {
        name: 'User Group 4',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFour.id }],
        },
      },
    })
    const userGroupFive = await prisma.userGroup.create({
      data: {
        name: 'User Group 5',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userFive.id }],
        },
      },
    })

    // grant group permissions on the course with READ, EXECUTE, WRITE, and ADMIN level to users 2, 3, 4, and 5
    const directReadPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation,
      },
    })
    const directExecutePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.EXECUTE,
        propagation,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupFour.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroupFive.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation,
      },
    })

    // trigger recomputation of derived permissions
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions on the course have been created
    // user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (WRITE), user 5 (ADMIN)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
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
        courseId_userId: {
          courseId: course.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      directExecutePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directWritePermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    const derivedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          courseId_userId: {
            courseId: course.id,
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
      directAdminPermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()

    // verify that the correct derived permissions on the practice quiz (activity) have been created
    // (propagation disabled) user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (READ), user 5 (ADMIN)
    // (propagation enabled) user 1 (OWNER), user 2 (READ), user 3 (EXECUTE), user 4 (WRITE), user 5 (ADMIN)
    const derivedPermissionActivityUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionActivityUserOne).toBeTruthy()
    expect(derivedPermissionActivityUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionActivityUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionActivityUserOne!.derived).toBeFalsy()

    const derivedPermissionActivityUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionActivityUserTwo).toBeTruthy()
    expect(derivedPermissionActivityUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionActivityUserTwo!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedPermissionActivityUserTwo!.derived).toBeTruthy()

    const derivedPermissionActivityUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionActivityUserThree).toBeTruthy()
    expect(derivedPermissionActivityUserThree!.permissionLevel).toBe(
      PermissionLevel.EXECUTE
    )
    expect(derivedPermissionActivityUserThree!.directPermissionId).toBe(
      directExecutePermission.id
    )
    expect(derivedPermissionActivityUserThree!.derived).toBeTruthy()

    const derivedPermissionActivityUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionActivityUserFour).toBeTruthy()
    expect(derivedPermissionActivityUserFour!.permissionLevel).toBe(
      propagation ? PermissionLevel.WRITE : PermissionLevel.EXECUTE
    )
    expect(derivedPermissionActivityUserFour!.directPermissionId).toBe(
      directWritePermission.id
    )
    expect(derivedPermissionActivityUserFour!.derived).toBeTruthy()

    const derivedPermissionActivityUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: activity.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionActivityUserFive).toBeTruthy()
    expect(derivedPermissionActivityUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionActivityUserFive!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionActivityUserFive!.derived).toBeTruthy()

    // verify that the correct derived permissions on the element have been created
    // user 1 (OWNER), user 2 (no access), user 3 (no access), user 4 (no access), user 5 (ADMIN)
    const derivedPermissionElementUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionElementUserOne).toBeTruthy()
    expect(derivedPermissionElementUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionElementUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionElementUserOne!.derived).toBeFalsy()

    const derivedPermissionElementUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionElementUserTwo).toBeNull()

    const derivedPermissionElementUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionElementUserThree).toBeNull()

    const derivedPermissionElementUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionElementUserFour).toBeNull()

    const derivedPermissionElementUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionElementUserFive).toBeTruthy()
    expect(derivedPermissionElementUserFive!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionElementUserFive!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionElementUserFive!.derived).toBeTruthy()

    // verify that the correct derived permissions on the answer collection have been created
    // user 1 (READ), user 2 (OWNER), user 3 (no access), user 4 (no access), user 5 (READ)
    const derivedPermissionAnswerCollectionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserOne).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserOne!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(
      derivedPermissionAnswerCollectionUserOne!.directPermissionId
    ).toBeNull()
    expect(derivedPermissionAnswerCollectionUserOne!.derived).toBeTruthy()

    const derivedPermissionAnswerCollectionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserTwo).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserTwo!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(
      derivedPermissionAnswerCollectionUserTwo!.directPermissionId
    ).toBeNull()
    expect(derivedPermissionAnswerCollectionUserTwo!.derived).toBeFalsy()

    const derivedPermissionAnswerCollectionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserThree).toBeNull()

    const derivedPermissionAnswerCollectionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserFour).toBeNull()

    const derivedPermissionAnswerCollectionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserFive).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserFive!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionAnswerCollectionUserFive?.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionAnswerCollectionUserFive!.derived).toBeTruthy()
  }

  it('Verify that minimum required permissions from direct group permission on course are correctly passed down to answer collection (individual derived permission recomputation)', async () => {
    await testFullCoursePropagationGroups(prisma, true, false)
  })

  it('Verify that minimum required permissions from direct group permission on course are correctly passed down to answer collection (object-level derived permission recomputation)', async () => {
    await testFullCoursePropagationGroups(prisma, false, false)
  })

  it('Verify that propagated permissions from direct group permission on course are correctly passed down to answer collection (individual derived permission recomputation)', async () => {
    await testFullCoursePropagationGroups(prisma, true, true)
  })

  it('Verify that propagated permissions from direct group permission on course are correctly passed down to answer collection (object-level derived permission recomputation)', async () => {
    await testFullCoursePropagationGroups(prisma, false, true)
  })

  it('Verify that revoking access to the course also revokes access to the elements and answer collection (assuming no direct access)', async () => {
    const { answerCollection, course } =
      await createCourseWithActivityElementResource(prisma)

    // grant individual admin access to the course to user 3
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that a derived READ permission on the answer collection has been created for user 3
    const derivedPermissionAnswerCollectionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserThree).toBeTruthy()
    expect(derivedPermissionAnswerCollectionUserThree!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionAnswerCollectionUserThree!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedPermissionAnswerCollectionUserThree!.derived).toBeTruthy()

    // revoke the direct access to the course
    await prisma.permission.delete({
      where: { id: directAdminPermission.id },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    // verify that the derived permission on the answer collection has been removed
    const derivedPermissionAnswerCollectionUserThree2 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionAnswerCollectionUserThree2).toBeNull()
  })

  async function testOwnerPropagationToActivity(prisma, individualRecompute) {
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

    // create an activity with user 2 as the owner
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userTwo.id,
        courseId: course.id,
      },
    })

    // trigger recomputation of the derived permissions on the course
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { courseId: course.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userTwo.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    }

    // verify that the correct derived permissions have been created on the activity
    // user 1 (ADMIN - derived from course ownership), user 2 (OWNER)
    const derivedPermissionActivityUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionActivityUserOne).toBeTruthy()
    expect(derivedPermissionActivityUserOne!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionActivityUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionActivityUserOne!.derived).toBeTruthy()

    const derivedPermissionActivityUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: activity.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionActivityUserTwo).toBeTruthy()
    expect(derivedPermissionActivityUserTwo!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionActivityUserTwo!.directPermissionId).toBeNull()
    expect(derivedPermissionActivityUserTwo!.derived).toBeFalsy()
  }

  it('Verify that owner permissions are correctly propagated to required activities (user-specific derived permissions recomputation)', async () => {
    await testOwnerPropagationToActivity(prisma, true)
  })

  it('Verify that owner permissions are correctly propagated to required activities (object-level derived permissions recomputation)', async () => {
    await testOwnerPropagationToActivity(prisma, false)
  })
  // #endregion
})
