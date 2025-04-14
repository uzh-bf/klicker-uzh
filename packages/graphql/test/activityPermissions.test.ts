import {
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  userFive,
  userFour,
  userOne,
  userThree,
  userTwo,
} from './sharingData.js'

// setup test database configuration
// use the DATABASE_URL environment variable if available (for CI or local dev)
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // as a fallback, use default PostgreSQL connection
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

describe('Unit tests covering the creation of derived permissions', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

  beforeAll(async () => {
    // configure database
    const databaseUrl = getDatabaseUrl()

    try {
      // initialize PrismaClient with the database URL
      prisma = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
        log: ['error', 'warn'],
      })

      // test database connection
      await prisma.$connect()

      // create EventEmitter for test context
      emitter = new EventEmitter()

      // upsert all users in the database
      const users = await Promise.all(
        [userOne, userTwo, userThree, userFour, userFive].map(
          async (user) =>
            await prisma.user.upsert({
              where: { id: user.id },
              update: {},
              create: {
                id: user.id,
                email: user.email,
                shortname: user.shortname,
              },
            })
        )
      )

      // mock context with user including all required properties
      userOneCtx = {
        user: {
          sub: userOne.sub,
          role: UserRole.USER,
          scope: UserLoginScope.ACCOUNT_OWNER,
          catalystInstitutional: true,
          catalystIndividual: true,
        },
        prisma,
        emitter,
        redisExec: jest.fn() as unknown as ContextWithUser['redisExec'],
        pubSub: { publish: jest.fn(), subscribe: jest.fn() },
        req: {} as any,
        res: {} as any,
      }

      // mock remaining contexts
      userTwoCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userTwo.sub },
      }
      userThreeCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userThree.sub },
      }
      userFourCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userFour.sub },
      }
      userFiveCtx = {
        ...userOneCtx,
        user: { ...userOneCtx.user, sub: userFive.sub },
      }

      // seed the top-level catalog collection with fixed ID
      await prisma.catalogCollection.upsert({
        where: { id: MISSING_CATALOG_COLLECTION_ID },
        create: {
          id: MISSING_CATALOG_COLLECTION_ID,
          name: '',
          access: ObjectAccess.PUBLIC,
        },
        update: {},
      })
    } catch (error) {
      console.error('Failed to initialize test environment:', error)
      throw new Error(`Database connection failed: ${error}`)
    }
  })

  // disconnect from the database
  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ! Live quiz permissions tests
  // #region
  it('Verify that owner permissions on a live quiz are correctly copied into the derived permissions table', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that other direct permissions are correctly copied into the derived permissions table', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that when passing a userId only the corresponding derived permissions are updated', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.delete({
      where: { id: userGroup.id },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that user group permissions are correctly expanded into individual derived permissions', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.deleteMany({
      where: { id: { in: [userGroup.id, userGroup2.id] } },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that on deletion of the direct permission, the derived permissions from direct permissions are removed', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.delete({
      where: { id: userGroup.id },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that individual permissions have precedence over user group permissions if higher and vice-versa', async () => {
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
    const individualPermissionUserTwo = await prisma.permission.create({
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.delete({
      where: { id: userGroup.id },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  // ? Course -> Activity
  async function cleanupCourseLiveQuiz(prisma, courseId, activityId) {
    await prisma.liveQuiz.delete({
      where: { id: activityId },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.course.delete({
      where: { id: courseId },
    })
    const courseCount = await prisma.course.count()
    expect(courseCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  }

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

  it('Verify that minimum required permissions are correctly granted on activities for individual users', async () => {
    const {
      course,
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
      PermissionLevel.READ
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  })

  it('Verify that propagated permissions are correctly granted on activities for individual users', async () => {
    const {
      course,
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
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

  it('Verify that minimum required permissions are correctly granted on activities for user groups', async () => {
    const {
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
      PermissionLevel.READ
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.userGroup.deleteMany({
      where: {
        id: {
          in: [userGroup2.id, userGroup3.id, userGroup4.id, userGroup5.id],
        },
      },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  })

  it('Verify that propagated permissions are correctly granted on activities for user groups', async () => {
    const {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.userGroup.deleteMany({
      where: {
        id: {
          in: [userGroup2.id, userGroup3.id, userGroup4.id, userGroup5.id],
        },
      },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  })

  it('Verify that revoking access to the course also revokes access to the activity (assuming no direct access)', async () => {
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
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  })

  it('Verify that revoking group access to the course also revokes access to the activity (assuming no direct access)', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.userGroup.delete({
      where: { id: userGroup.id },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  })

  it('Verify that revoking group access to the course does not revoke access to the activity if individual access exists', async () => {
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.userGroup.delete({
      where: { id: userGroup.id },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
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
    const courseREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
    })
    const courseWRITEPermissions = await prisma.permission.create({
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
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    const activityREADPermissions = await prisma.permission.create({
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  }

  it('Verify that direct access to the activity takes precedence over course access if higher - and vice-versa (individual recomputation with userId)', async () => {
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
    const courseREADPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        courseId: course.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
    })
    const courseWRITEPermissions = await prisma.permission.create({
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
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userGroupId: userGroup4.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    const activityREADPermissions = await prisma.permission.create({
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.userGroup.deleteMany({
      where: {
        id: {
          in: [userGroup2.id, userGroup3.id, userGroup4.id, userGroup5.id],
        },
      },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    await cleanupCourseLiveQuiz(prisma, course.id, activity.id)
  }

  it('Verify that direct group access to the activity takes precedence over course access if higher - and vice-versa (individual recomputation with userId)', async () => {
    await courseActivityPermissionPrecedenceGroups(prisma, true)
  })

  it('Verify that direct access to the activity takes precedence over course access if higher - and vice-versa (object recomputation without userId)', async () => {
    await courseActivityPermissionPrecedenceIndividual(prisma, false)
  })

  it('Verify that direct group access to the activity takes precedence over course access if higher - and vice-versa (object recomputation without userId)', async () => {
    await courseActivityPermissionPrecedenceGroups(prisma, false)
  })

  // ? Activity -> Element
  // TODO: Verify that minimum required permissions are correctly granted on elements for individual users
  // --> according to table in DOCX
  // TODO: Verify that propagated permissions are correctly granted on elements for individual users
  // --> according to table in DOCX
  // TODO: Verify that minimum required permissions are correctly granted on elements for user groups
  // --> according to table in DOCX
  // TODO: Verify that propagated permissions are correctly granted on elements for user groups
  // --> according to table in DOCX
  // TODO: Verify that derived permissions on elements from activity are revoked when removing access to the activity (assuming no direct access)
  // TODO: Verify that derived permissions on elements from activity are revoked when removing group access to the activity (assuming no direct access)
  // TODO: Verify that derived permissions on elements from activity are not revoked if group access to activity is revoked, but individual activity access exists
  // TODO: Verify that when sufficient direct permission exists on live quiz for derived permissions on elements, derived permissions are extended to answer collections
  // TODO: Verify that when sufficient direct group permission exists on live quiz for derived permissions on elements, derived permissions are extended to answer collections
  // #endregion

  // ! Practice quiz permissions tests (reduced due to shared logic with live quiz)
  // #region
  // TODO: Verify that owner and direct permissions are correctly copied into the derived permissions table
  // TODO: Verify that group permissions are correctly expanded into individual derived permissions
  // TODO: Verify that minimum required permissions from course are granted on practice quiz
  // TODO: Verify that propagated permissions from course are granted on practice quiz
  // TODO: Verify that derived access to elements is granted for users with sufficient access on practice quiz
  // TODO: Verify that derived access to elements is granted for user groups with sufficient access on practice quiz
  // #endregion

  // ! Microlearning permissions tests (reduced due to shared logic with live quiz)
  // #region
  // TODO: Verify that owner and direct permissions are correctly copied into the derived permissions table
  // TODO: Verify that group permissions are correctly expanded into individual derived permissions
  // TODO: Verify that minimum required permissions from course are granted on microlearning
  // TODO: Verify that propagated permissions from course are granted on microlearning
  // TODO: Verify that derived access to elements is granted for users with sufficient access on microlearning
  // TODO: Verify that derived access to elements is granted for user groups with sufficient access on microlearning
  // #endregion

  // ! Group activity permissions tests (reduced due to shared logic with live quiz)
  // #region
  // TODO: Verify that owner and direct permissions are correctly copied into the derived permissions table
  // TODO: Verify that group permissions are correctly expanded into individual derived permissions
  // TODO: Verify that minimum required permissions from course are granted on group activity
  // TODO: Verify that propagated permissions from course are granted on group activity
  // TODO: Verify that derived access to elements is granted for users with sufficient access on group activity
  // TODO: Verify that derived access to elements is granted for user groups with sufficient access on group activity
  // #endregion

  it('Remove all created data and users & verify their deletion', async () => {
    // verify that only the default catalog collection is left in the database
    const dbCatalogs = await prisma.catalogCollection.count()
    expect(dbCatalogs).toBe(1)

    // remove the answer collections from the top-level catalog collection
    const dbAssignments = await prisma.catalogCollectionAssignment.count({
      where: {
        catalogCollectionId: { not: MISSING_CATALOG_COLLECTION_ID },
      },
    })
    expect(dbAssignments).toBe(0)
    await prisma.catalogCollectionAssignment.deleteMany({})
    const dbAssignments2 = await prisma.catalogCollectionAssignment.count()
    expect(dbAssignments2).toBe(0)

    // remove the top level catalog collection for test suite independence
    await prisma.catalogCollection.delete({
      where: { id: MISSING_CATALOG_COLLECTION_ID },
    })
    const dbCatalogs2 = await prisma.catalogCollection.count()
    expect(dbCatalogs2).toBe(0)

    // delete all elements from the database
    await prisma.element.deleteMany({})
    const dbPermissions = await prisma.element.count()
    expect(dbPermissions).toBe(0)

    // delete all answer collections that are left in the database
    await prisma.answerCollection.deleteMany({})
    const dbAnswerCollections = await prisma.answerCollection.count()
    expect(dbAnswerCollections).toBe(0)

    // delete all activities that are left in the database
    await prisma.liveQuiz.deleteMany({})
    const liveQuizzes = await prisma.liveQuiz.count()
    expect(liveQuizzes).toBe(0)
    await prisma.practiceQuiz.deleteMany({})
    const practiceQuizzes = await prisma.practiceQuiz.count()
    expect(practiceQuizzes).toBe(0)
    await prisma.microLearning.deleteMany({})
    const microLearning = await prisma.microLearning.count()
    expect(microLearning).toBe(0)
    await prisma.groupActivity.deleteMany({})
    const groupActivities = await prisma.groupActivity.count()
    expect(groupActivities).toBe(0)

    // delete all users that have been created for the test and validate that they have been removed
    await prisma.user.deleteMany({})
    const dbUsers = await prisma.user.count()
    expect(dbUsers).toBe(0)
  })
})
