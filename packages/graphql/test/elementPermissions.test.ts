import {
  ElementInstanceType,
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma'
import { ChoicesElementData, ElementInstanceResults } from '@klicker-uzh/types'
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

describe('Unit tests covering the creation of derived permissions for elements', () => {
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

  // ! Element permissions tests
  // #region
  it('Verify that owner permissions on an element are correctly copied into the derived permissions table', async () => {
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

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entry has been created
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission!.directPermissionId).toBeNull()
    expect(derivedPermission!.derived).toBeFalsy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that other direct permissions are correctly copied into the derived permissions table', async () => {
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

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4
    const directREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const directWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const directADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entry has been created
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      directWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

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
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      directADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that when passing a userId only the corresponding derived permissions are updated', async () => {
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

    // grant READ permissions to user 2, WRITE permissions to user 3
    const directREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const directWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the element and user 2
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userTwo.id },
      prisma
    )

    // verify that the correct derived permission entry has been created
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    // verify that the derived permission for users 3 has not been created
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0) // element should be deleted
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that on deletion of the direct permission, the derived permissions from direct permissions are removed', async () => {
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

    // grant READ permissions to user 2, WRITE permissions to user 3
    const directREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const directWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entry has been created
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      directREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      directWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    // remove the individual permission
    await prisma.permission.delete({
      where: { id: directREADPermissions.id },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permission for user 2 has been removed
    const missingPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermissionUserTwo).toBeNull()

    // verify that the derived permission for user 3 still exists
    const existingPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(existingPermissionUserThree).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that user group permissions are correctly expanded into individual derived permissions', async () => {
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

    // create a user group with users 1, 2, and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
          ],
        },
      },
    })

    // grant READ permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (READ - group), user 3 (READ - group)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
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
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    // cleanup: delete all created objects and user groups
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
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

  async function precedenceIndividualGroupPermissions(
    prisma,
    individualRecompute
  ) {
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

    // create two user groups with users 1, 2, and 3 and users 3, 4, and 5 respectively
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'User Group 1',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
          ],
        },
      },
    })

    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userThree.id },
            { id: userFour.id },
            { id: userFive.id },
          ],
        },
      },
    })

    // grant READ permissions to user group 1, WRITE permissions to user group 2
    const groupPermission1 = await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const groupPermission2 = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant WRITE permissions to user 2, ADMIN permissions to user 4, READ permissions to user 5
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const userFourPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    const userFivePermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the element
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userFour.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: userFive.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    }

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (WRITE - individual), user 3 (WRITE - group 2), user 4 (ADMIN - individual), user 5 (WRITE - group 2)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      userTwoPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission2.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

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
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      userFourPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      groupPermission2.id
    )
    expect(derivedPermissionUserFive!.derived).toBeFalsy()

    // cleanup: delete all created objects and user groups
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.userGroup.deleteMany({
      where: { id: { in: [userGroup1.id, userGroup2.id] } },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  }

  it('Verify that individual permissions have precedence over user group permissions if higher (and vice-versa) (individual derived permission recomputation)', async () => {
    await precedenceIndividualGroupPermissions(prisma, true)
  })

  it('Verify that individual permissions have precedence over user group permissions if higher (and vice-versa) (object-level derived permission recomputation)', async () => {
    await precedenceIndividualGroupPermissions(prisma, false)
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
                    migrationId: '',
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

  it('Verify that minimum required permissions are correctly derived from activities for individual users (min. required = propagated for elements)', async () => {
    const { element, activity } = await createActivityWithElement(prisma)

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4 on activity
    // ? select propagation to be disabled
    const activityREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
    })
    const activityWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
    })
    const activityADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries on the element have been created
    // user 1 (OWNER - ADMIN would be min. required = propagated), user 2 & user 3 (no access), user 4 (ADMIN - min. required = propagated)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

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
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

    // update the permissions to have propagation enabled
    await prisma.permission.update({
      where: { id: activityREADPermissions.id },
      data: { propagation: true },
    })
    await prisma.permission.update({
      where: { id: activityWRITEPermissions.id },
      data: { propagation: true },
    })
    await prisma.permission.update({
      where: { id: activityADMINPermissions.id },
      data: { propagation: true },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries on the element have been created
    // user 1 (OWNER - ADMIN would be min. required = propagated), user 2 & user 3 (no access), user 4 (ADMIN - min. required = propagated)
    const derivedPermissionUserOne2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userOne.id,
          },
        },
      }
    )
    expect(derivedPermissionUserOne2).toBeTruthy()
    expect(derivedPermissionUserOne2!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne2!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne2!.derived).toBeFalsy()

    const derivedPermissionUserTwo2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(derivedPermissionUserTwo2).toBeNull()

    const derivedPermissionUserThree2 =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree2).toBeNull()

    const derivedPermissionUserFour2 =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionUserFour2).toBeTruthy()
    expect(derivedPermissionUserFour2!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour2!.directPermissionId).toBe(
      activityADMINPermissions.id
    )
    expect(derivedPermissionUserFour2!.derived).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
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

  it('Verify that minimum required permissions are correctly derived from activities for user groups (min. required = propagated for elements)', async () => {
    const { element, activity } = await createActivityWithElement(prisma)

    // create a user group with users 1 and 2, which gets READ permissions
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })
    const userGroup1Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // create a user group with users 3 and 4, which gets WRITE permissions
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const userGroup2Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create a user group with users 4 and 5, which gets ADMIN permissions
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userFour.id,
        members: {
          connect: [{ id: userFour.id }, { id: userFive.id }],
        },
      },
    })
    const userGroup3Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity
    await recomputeDerivedPermissions({ liveQuizId: activity.id }, prisma)

    // verify that the correct derived permission entries on the element have been created
    // user 1 (OWNER - ADMIN would be min. required = propagated), user 2 (no access), user 3 (no access), user 4 (ADMIN - group), user 5 (ADMIN - group)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeNull()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeNull()

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
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      userGroup3Permission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeTruthy()

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
      userGroup3Permission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.deleteMany({
      where: { id: { in: [userGroup1.id, userGroup2.id, userGroup3.id] } },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  async function activityElementPermissionsPrecedenceIndividual(
    prisma,
    individualRecompute
  ) {
    const { element, activity } = await createActivityWithElement(prisma)

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to users 4 and 5 on activity
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
    const activityADMINPermissions2 = await prisma.permission.create({
      data: {
        userId: userFive.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant WRITE permissions to user 2, ADMIN permissions to user 3, READ permissions to user 4 on element
    const elementWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const elementADMINPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const elementREADPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userOne.id },
        prisma
      )
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

    // verify that the correct derived permission entries on the element have been created
    // user 1 (OWNER - ADMIN would be min. required = propagated), user 2 (WRITE - individual), user 3 (ADMIN - individual), user 4 (ADMIN - derived), user 5 (ADMIN - derived)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      elementWRITEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

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
      elementADMINPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

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
      activityADMINPermissions2.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  }

  it('Verify that derived permissions from activity take precedence over direct permissions if higher and vice-versa (individual derived permission recomputation)', async () => {
    await activityElementPermissionsPrecedenceIndividual(prisma, true)
  })

  it('Verify that derived permissions from activity take precedence over direct permissions if higher and vice-versa (object-level derived permission recomputation)', async () => {
    await activityElementPermissionsPrecedenceIndividual(prisma, false)
  })

  async function activityElementPermissionPrecedenceGroups(
    prisma,
    individualRecompute
  ) {
    const { element, activity } = await createActivityWithElement(prisma)

    // create a user group with users 1 and 2, which gets READ permissions on the activity
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })
    const userGroup1Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // create a user group with users 3 and 4, which gets WRITE permissions on the activity
    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const userGroup2Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create a user group with users 4 and 5, which gets ADMIN permissions on the activity
    const userGroup3 = await prisma.userGroup.create({
      data: {
        name: 'User Group 3',
        ownerId: userFour.id,
        members: {
          connect: [{ id: userFour.id }, { id: userFive.id }],
        },
      },
    })
    const userGroup3Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup3.id,
        liveQuizId: activity.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant WRITE permissions to group 1 on element
    const elementWRITEPermissions = await prisma.permission.create({
      data: {
        elementId: element.id,
        userGroupId: userGroup1.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant ADMIN permissions to group 2 on element
    const elementADMINPermissions = await prisma.permission.create({
      data: {
        elementId: element.id,
        userGroupId: userGroup2.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the activity
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { liveQuizId: activity.id, userId: userOne.id },
        prisma
      )
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

    // verify that the correct derived permission entries on the element have been created
    // user 1 (OWNER - ADMIN would be min. required = propagated), user 2 (WRITE - group direct),
    // user 3 (ADMIN - group direct), user 4 (ADMIN - group direct), user 5 (ADMIN - group derived)
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      elementWRITEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

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
      elementADMINPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

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
    expect(derivedPermissionUserFour).toBeTruthy()
    expect(derivedPermissionUserFour!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      elementADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

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
      userGroup3Permission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.liveQuiz.delete({
      where: { id: activity.id },
    })
    const activityCount = await prisma.liveQuiz.count()
    expect(activityCount).toBe(0)
    await prisma.userGroup.deleteMany({
      where: { id: { in: [userGroup1.id, userGroup2.id, userGroup3.id] } },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  }

  it('Verify that derived group permissions from activity take precedence over direct (group) permissions if higher and vice-versa (individual derived permission recomputation)', async () => {
    await activityElementPermissionPrecedenceGroups(prisma, true)
  })

  it('Verify that derived group permissions from activity take precedence over direct (group) permissions if higher and vice-versa (object-level derived permission recomputation)', async () => {
    await activityElementPermissionPrecedenceGroups(prisma, false)
  })

  it('Verify that individual permissions are correctly updated in the presence of direct group permissions when passing userId parameter', async () => {
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

    // create a user group with users 1, 2, and 3, which gets WRITE permissions on the element
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
          ],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the element and user 1
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userOne.id },
      prisma
    )

    // verify that the correct derived permission entries have been created
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
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionUserOne!.derived).toBeFalsy()

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

    // trigger recomputation of derived permissions for the element and user 2
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userTwo.id },
      prisma
    )

    // verify that the correct derived permission entries have been created
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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const missingPermissionUserThree2 =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userThree.id,
          },
        },
      })
    expect(missingPermissionUserThree2).toBeNull()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
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

  // ? Element -> Answer Collection
  async function createElementWithAnswerCollection(prisma) {
    // create answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
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

    return { element, answerCollection }
  }

  it('Verify that all users with permission on element automatically get derived access on linked answer collections (derived permissions always READ)', async () => {
    const { element, answerCollection } =
      await createElementWithAnswerCollection(prisma)

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4 on element
    const elementREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const elementWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const elementADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entries on the answer collection have been created
    // user 1 (OWNER), user 2 (READ - derived), user 3 (WRITE - derived), user 4 (ADMIN - derived)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
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
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      elementREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      elementWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

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
      elementADMINPermissions.id
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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that direct permissions on answer collections still take precedence over derived permissions (if equal or higher - always the case here)', async () => {
    const { element, answerCollection } =
      await createElementWithAnswerCollection(prisma)

    // grant READ permissions to user 2, WRITE permissions to user 3, ADMIN permissions to user 4 on element
    const elementREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const elementWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const elementADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant ADMIN permissions to user 2, WRITE permissions to user 3, READ permissions to user 4 on answer collection
    const answerCollectionREADPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const answerCollectionWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const answerCollectionADMINPermissions = await prisma.permission.create({
      data: {
        userId: userFour.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the element and answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entries on the answer collection have been created
    // user 1 (OWNER), user 2 (ADMIN - direct), user 3 (WRITE - direct), user 4 (READ - direct)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
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
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      answerCollectionREADPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      answerCollectionWRITEPermissions.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

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
      answerCollectionADMINPermissions.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that derived permissions are revoked properly after removing direct individual or group permissions', async () => {
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

    // create a user group with users 1 and 2 which gets WRITE permissions on the element
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant individual ADMIN access to user 3
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (WRITE - group), user 3 (ADMIN - individual)
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
      PermissionLevel.OWNER
    )

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
      PermissionLevel.WRITE
    )

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

    // remove both direct permissions and recompute the derived permissions
    await prisma.permission.deleteMany({
      where: {
        id: { in: [individualPermission.id, groupPermission.id] },
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permissions have been removed
    const missingPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userOne.id,
        },
      },
    })
    expect(missingPermissionUserOne).toBeTruthy()
    expect(derivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

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

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
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

  it('Verify that access to answer collection persists on removal of group access to element if an individual permission exists', async () => {
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

    // create a user group with users 1 and 2 which gets ADMIN permissions on the element
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant individual WRITE access to user 2
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permission entries have been created
    // user 2 (ADMIN - group)
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
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    // remove the group permission and recompute the derived permissions
    await prisma.permission.deleteMany({
      where: {
        id: groupPermission.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permissions have been removed
    const modifiedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      })
    expect(modifiedDerivedPermissionUserTwo).toBeTruthy()
    expect(modifiedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(modifiedDerivedPermissionUserTwo!.directPermissionId).toBe(
      individualPermission.id
    )
    expect(modifiedDerivedPermissionUserTwo!.derived).toBeFalsy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
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

  it('Verify that changing the answer collection linked to an element updates the derived permissions', async () => {
    const { element, answerCollection } =
      await createElementWithAnswerCollection(prisma)

    // add WRITE permission for user 2 on the element
    const elementWRITEPermissions = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that user 2 was granted derived access to the answer collection included in the element
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      elementWRITEPermissions.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeTruthy()

    // modify the answer collection linked to the element
    const answerCollection2 = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection 2',
        description: 'Description',
        ownerId: userOne.id,
      },
    })
    await prisma.element.update({
      where: { id: element.id },
      data: { answerCollectionId: answerCollection2.id },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that user 2 was granted derived access to the new answer collection and previous access was revoked
    const revokedDerivedAccess = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(revokedDerivedAccess).toBeNull()

    const newDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userTwo.id,
          },
        },
      })
    expect(newDerivedPermissionUserTwo).toBeTruthy()
    expect(newDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(newDerivedPermissionUserTwo!.directPermissionId).toBe(
      elementWRITEPermissions.id
    )
    expect(newDerivedPermissionUserTwo!.derived).toBeTruthy()

    // cleanup: delete all created objects and verify the deletion of all direct / derived permissions
    await prisma.element.delete({
      where: { id: element.id },
    })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.deleteMany({
      where: { id: { in: [answerCollection.id, answerCollection2.id] } },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })
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
