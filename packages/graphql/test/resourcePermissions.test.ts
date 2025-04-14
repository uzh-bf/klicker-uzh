import {
  ElementType,
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

describe('Unit tests covering the creation of derived permissions for resources (e.g. answer collections)', () => {
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

  // ! Answer collection permissions tests
  // #region
  it('Verify that owner permissions on an answer collection are correctly copied into the derived permissions table', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // trigger the recomputation of derived permissions for this object and user
    await recomputeDerivedPermissions(
      {
        answerCollectionId: answerCollection.id,
        userId: userOne.id,
      },
      prisma
    )

    // verify that a derived permission has been created for the owner
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission!.directPermissionId).toBeNull()
    expect(derivedPermission!.derived).toBeFalsy()

    // delete the created answer collection
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
  })

  it('Verify that other direct permissions are correctly copied into the derived permissions table', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create direct permissions with different levels for the answer collection
    const directReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger the recomputation of derived permissions for the object
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that derived permissions have been created for the users
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedReadPermission!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedReadPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(derivedWritePermission!.directPermissionId).toBe(
      directWritePermission.id
    )
    expect(derivedWritePermission!.derived).toBeFalsy() // permission is not derived from another object permission

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedAdminPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // delete the answer collection and verify the deletion of all linked permissions and derived permissions
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directReadPermissionCount = await prisma.permission.count({
      where: { id: directReadPermission.id },
    })
    expect(directReadPermissionCount).toBe(0)
    const derivedReadPermissionCount = await prisma.derivedPermission.count()
    expect(derivedReadPermissionCount).toBe(0)
  })

  it('Verify that when using answer collection in an element, the direct permission has precedence (if higher - should always be the case)', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a new element with the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create direct permission for another user on the answer collection and element
    const directPermissionOnAnswerCollection = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const directPermissionOnElement = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger the recomputation of derived permissions for the created element
    // (with the contained answer collection - computation should propagated)
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // validate derived permissions on element for all users (owner and shared access)
    const derivedElementPermission1 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userOne.id,
          },
        },
      }
    )
    expect(derivedElementPermission1).toBeTruthy()
    expect(derivedElementPermission1!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedElementPermission1!.directPermissionId).toBeNull()
    expect(derivedElementPermission1!.derived).toBeFalsy()

    const derivedElementPermission2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(derivedElementPermission2).toBeTruthy()
    expect(derivedElementPermission2!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    ) // user has direct access to element with admin rights
    expect(derivedElementPermission2!.directPermissionId).toBe(
      directPermissionOnElement.id
    )
    expect(derivedElementPermission2!.derived).toBeFalsy() // permission is not derived from another object permission

    // verify that owner has corresponding access to the answer collection
    const derivedAnswerCollectionPermission1 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedAnswerCollectionPermission1).toBeTruthy()
    expect(derivedAnswerCollectionPermission1!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedAnswerCollectionPermission1!.directPermissionId).toBeNull()
    expect(derivedAnswerCollectionPermission1!.derived).toBeFalsy()

    // verify that direct access for second user overrides derived access through element usage
    const derivedAnswerCollectionPermission2 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedAnswerCollectionPermission2).toBeTruthy()
    expect(derivedAnswerCollectionPermission2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    ) // user has direct access to answer collection with write rights
    expect(derivedAnswerCollectionPermission2!.directPermissionId).toBe(
      directPermissionOnAnswerCollection.id
    )
    expect(derivedAnswerCollectionPermission2!.derived).toBeFalsy() // permission is not derived from a permission on another object

    // delete the created element and answer collection and verify full removal of permissions
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({ where: { id: answerCollection.id } })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that users with access to an element containing an answer collection automatically get derived access (permission level on element does not matter)', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a new element with the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create direct permissions with different permission levels on the element
    const directReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger the recomputation of derived permissions for the created element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // validate that correct derived permissions have been created on the answer collection
    const derivedCollectionPermission1 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedCollectionPermission1).toBeTruthy()
    expect(derivedCollectionPermission1!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedCollectionPermission1!.directPermissionId).toBe(
      directReadPermission.id
    )
    expect(derivedCollectionPermission1!.derived).toBeTruthy() // permission is derived from another object permission (element)

    const derivedCollectionPermission2 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedCollectionPermission2).toBeTruthy()
    expect(derivedCollectionPermission2!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedCollectionPermission2!.directPermissionId).toBe(
      directWritePermission.id
    )
    expect(derivedCollectionPermission2!.derived).toBeTruthy() // permission is derived from another object permission (element)

    const derivedCollectionPermission3 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedCollectionPermission3).toBeTruthy()
    expect(derivedCollectionPermission3!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedCollectionPermission3!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedCollectionPermission3!.derived).toBeTruthy() // permission is derived from another object permission (element)

    // delete the created element and answer collection and verify full removal of permissions
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({ where: { id: answerCollection.id } })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that on deletion of a direct permission, the derived permissions from direct permissions are removed', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create direct permissions with different permission levels for the answer collection
    const directReadPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that derived permissions have been created for the users
    const derivedReadPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedReadPermission).toBeTruthy()
    expect(derivedReadPermission!.permissionLevel).toBe(PermissionLevel.READ)

    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // delete the direct permissions
    await prisma.permission.deleteMany({
      where: {
        id: {
          in: [
            directReadPermission.id,
            directWritePermission.id,
            directAdminPermission.id,
          ],
        },
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permissions have also been removed
    const derivedReadPermissionAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedReadPermissionAfterDeletion).toBeNull()

    const derivedWritePermissionAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedWritePermissionAfterDeletion).toBeNull()

    const derivedAdminPermissionAfterDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedAdminPermissionAfterDeletion).toBeNull()

    // delete the answer collection and verify the deletion of all linked permissions and derived permissions
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

  it('Verify that modifications of the direct permissions result in corresponding changes in the derived permissions', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a direct permission on the answer collection
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that a derived permission has been created for the user
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission!.directPermissionId).toBe(directPermission.id)
    expect(derivedPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // verify that a derived permission for the owner has been created
    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.directPermissionId).toBeNull()
    expect(derivedOwnerPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // modify the existing direct permission, change the owner of the collection and create a new direct admin permission for the old owner
    await prisma.permission.update({
      where: { id: directPermission.id },
      data: { permissionLevel: PermissionLevel.WRITE },
    })
    await prisma.answerCollection.update({
      where: { id: answerCollection.id },
      data: { ownerId: userThree.id },
    })
    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userOne.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the new owner has a derived owner permission
    const derivedNewOwnerPermission = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(derivedNewOwnerPermission).toBeTruthy()
    expect(derivedNewOwnerPermission!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedNewOwnerPermission!.directPermissionId).toBeNull()
    expect(derivedNewOwnerPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // verify that the previous direct permission has been updated
    const updatedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(updatedDerivedPermission).toBeTruthy()
    expect(updatedDerivedPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    ) // permission level has been updated
    expect(updatedDerivedPermission!.directPermissionId).toBe(
      directPermission.id
    )
    expect(updatedDerivedPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // verify that the previous owner now has a derived admin permission
    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN) // permission level has been updated
    expect(derivedAdminPermission!.directPermissionId).toBe(
      directAdminPermission.id
    )
    expect(derivedAdminPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // delete the answer collection and verify the deletion of all linked permissions and derived permissions
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

  it('Verify that when passing a userId only the corresponding derived permissions are updated', async () => {
    // create a new answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create direct permissions on the answer collection and the element
    const directPermissionOnAnswerCollection = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const directPermissionOnElement = await prisma.permission.create({
      data: {
        userId: userThree.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived premissions for user 1
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userOne.id },
      prisma
    )

    // verify that only the derived permissions for user 1 have been created
    const derivedPermissionForUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionForUserOne).toBeTruthy()
    expect(derivedPermissionForUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionForUserOne!.directPermissionId).toBeNull()
    expect(derivedPermissionForUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

    const missingDerivedPermission1 = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(missingDerivedPermission1).toBeNull()

    const missingDerivedPermission2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(missingDerivedPermission2).toBeNull()

    // trigger recomputation of derived permissions for user 2
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userTwo.id },
      prisma
    )

    // verify that the correct derived permissions for user 1 and 2 have been created
    const derivedPermissionForUserOne2 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionForUserOne2).toBeTruthy()
    expect(derivedPermissionForUserOne2!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const derivedPermissionForUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionForUserTwo).toBeTruthy()
    expect(derivedPermissionForUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionForUserTwo!.directPermissionId).toBe(
      directPermissionOnAnswerCollection.id
    )
    expect(derivedPermissionForUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    const missingDerivedPermission3 = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(missingDerivedPermission3).toBeNull()

    // trigger recomputation of derived permissions for user 3
    // (first for element, then remove derived permission to test function on answer collection level and then recompute)
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userThree.id },
      prisma
    )
    await prisma.derivedPermission.deleteMany({
      where: {
        answerCollectionId: answerCollection.id,
        userId: userThree.id,
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userThree.id },
      prisma
    )

    // verify that the correct derived permissions for user 1, 2 and 3 have been created
    const derivedPermissionForUserOne3 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(derivedPermissionForUserOne3).toBeTruthy()
    expect(derivedPermissionForUserOne3!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const derivedPermissionForUserTwo2 =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionForUserTwo2).toBeTruthy()
    expect(derivedPermissionForUserTwo2!.permissionLevel).toBe(
      PermissionLevel.READ
    )

    const derivedPermissionForUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })

    expect(derivedPermissionForUserThree).toBeTruthy()
    expect(derivedPermissionForUserThree!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionForUserThree!.directPermissionId).toBe(
      directPermissionOnElement.id
    )
    expect(derivedPermissionForUserThree!.derived).toBeTruthy() // permission is derived from another object permission (element)

    // delete the element and change the permission level of the user with direct access to the answer collection
    await prisma.element.delete({ where: { id: element.id } })
    const updatedDirectPermission = await prisma.permission.update({
      where: { id: directPermissionOnAnswerCollection.id },
      data: { permissionLevel: PermissionLevel.WRITE },
    })

    // recompute the derived permissions for user 2
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userTwo.id },
      prisma
    )

    // verify that only the derived permission for user 2 has been updated
    const updatedDerivedPermissionForUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionForUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionForUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(updatedDerivedPermissionForUserTwo!.directPermissionId).toBe(
      updatedDirectPermission.id
    )
    expect(updatedDerivedPermissionForUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    // the derived permission for user three has been delted automatically through cascading
    const remainingDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(remainingDerivedPermissionUserThree).toBeNull()

    // delete the created answer collection and verify the deletion of all linked permissions and derived permissions
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

  it('Verify that having access to an element containing the collection and removing the direct permission, a derived permission persists', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create a direct permission on the answer collection with WRITE access
    const directPermissionOnAnswerCollection = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create a direct permission on the element with ADMIN access for the same user
    const directPermissionOnElement = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute the derived permissions for the answer collection and the element
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the correct derived permissions have been created for the user with shared access
    const derivedElementPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedElementPermission).toBeTruthy()
    expect(derivedElementPermission!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedElementPermission!.directPermissionId).toBe(
      directPermissionOnElement.id
    )
    expect(derivedElementPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    const derivedAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedAnswerCollectionPermission).toBeTruthy()
    expect(derivedAnswerCollectionPermission!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedAnswerCollectionPermission!.directPermissionId).toBe(
      directPermissionOnAnswerCollection.id
    )
    expect(derivedAnswerCollectionPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // remove the direct access to the answer collection
    await prisma.permission.delete({
      where: { id: directPermissionOnAnswerCollection.id },
    })

    // recompute the derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permission on the element has been removed and the one on
    // the answer collection updated to a derived permission with READ access only
    const updatedDerivedAnswerCollectionPermission =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedAnswerCollectionPermission).toBeTruthy()
    expect(updatedDerivedAnswerCollectionPermission!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(updatedDerivedAnswerCollectionPermission!.directPermissionId).toBe(
      directPermissionOnElement.id
    )
    expect(updatedDerivedAnswerCollectionPermission!.derived).toBeTruthy() // permission is derived from another object permission (element)

    // delete the created element and answer collection and verify full removal of permissions
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({ where: { id: answerCollection.id } })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that when deleting a used answer collection as an owner (soft-deletion), only the own permissions are removed (derived access for other users persists)', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // recompute the derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that a derived permission has been created for the owner
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission!.directPermissionId).toBeNull()
    expect(derivedPermission!.derived).toBeFalsy() // permission is not derived from another object permission

    // soft-delete the answer collection
    await prisma.answerCollection.update({
      where: { id: answerCollection.id },
      data: { isDeleted: true },
    })

    // trigger a recomputation of the derived permissions
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permission for the owner has been removed
    const removedDerivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(removedDerivedPermission).toBeNull()

    // delete the created answer collection and verify the deletion of all linked permissions and derived permissions
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

  it('Verify that when deleting a used answer collection as an owner (soft-deletion), all direct permissions by other users are removed, derived permissions persist', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userOne.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create direct permissions with different permission levels for the answer collection
    const directWritePermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const directAdminPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // create a direct permission for user three on the element
    const directElementPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the element and answer collection
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that derived permissions have been created for the users
    const derivedWritePermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedWritePermission).toBeTruthy()
    expect(derivedWritePermission!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // soft-delete the answer collection (including removal of all direct permissions)
    await prisma.answerCollection.update({
      where: { id: answerCollection.id },
      data: { isDeleted: true, directPermissions: { deleteMany: {} } },
    })

    // trigger a recomputation of the derived permissions
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that only the user with access to the element retains a derived permission
    const derivedPermissionUserTwoDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(derivedPermissionUserTwoDeletion).toBeTruthy()
    expect(derivedPermissionUserTwoDeletion!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserTwoDeletion!.directPermissionId).toBe(
      directElementPermission.id
    )
    expect(derivedPermissionUserTwoDeletion!.derived).toBeTruthy() // permission is derived from another object permission (element)

    const derivedPermissionUserThreeDeletion =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThreeDeletion).toBeNull()

    // delete the created element and verify the deletion of all linked permissions and derived permissions
    await prisma.element.delete({ where: { id: element.id } })
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

  it('Verify that direct permissions for user groups result in derived permissions for individual users', async () => {
    // create answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create two user groups
    const userGroup1 = await prisma.userGroup.create({
      data: {
        name: 'User Group 1',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })

    const userGroup2 = await prisma.userGroup.create({
      data: {
        name: 'User Group 2',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // add WRITE and ADMIN permissions for the user groups, respectively
    const group1Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const group2Permission = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that derived permissions have been created for the users in the groups
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
    expect(derivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      group1Permission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      group2Permission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      group2Permission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy() // permission is not derived from another object permission

    // cleanup: delete all created objects and user groups
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.deleteMany({
      where: { id: { in: [userGroup1.id, userGroup2.id] } },
    })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that direct permission for user group on element results in derived permissions for individual users', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create a user group
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userTwo.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })

    // add WRITE permission for the user group on the element
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the permissions on the element result in derived permissions on the answer collection
    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: answerCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.directPermissionId).toBeNull()
    expect(derivedOwnerPermission!.derived).toBeFalsy() // permission is not derived from another object permission

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
    expect(derivedPermissionUserTwo!.directPermissionId).toBeNull() // derived permission received through element ownership (not group)
    expect(derivedPermissionUserTwo!.derived).toBeTruthy() // permission is derived from another object permission (element)

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
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy() // permission is derived from another object permission (element)

    // cleanup: delete all created objects and user groups
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that individual permissions have precendence over user group permissions if higher', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
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

    // add WRITE permission for the user group on the answer collection
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // add individual ADMIN permission for user 3
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permissions have been created correctly: user 1 (OWNER), user 2 (WRITE), user 3 (ADMIN)
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
    expect(derivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      individualPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy() // permission is not derived from another object permission

    // cleanup: delete all created objects and user groups
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that group permissions have precedence over individual permissions if higher', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
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

    // grant ADMIN permission for the user group on the answer collection
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // grant individual WRITE permission for user 3
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permissions have been created correctly: user 1 (OWNER), user 2 (ADMIN), user 3 (ADMIN)
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
    expect(derivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

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
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy() // permission is not derived from another object permission

    // cleanup: delete all created objects and user groups
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that removal of direct permissions for user group results in removal of derived permissions for individual users', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group with users 1 and 2
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })

    // grant WRITE permission for the user group on the answer collection
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permissions have been created correctly: user 1 (OWNER), user 2 (WRITE)
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
    expect(derivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    // remove the direct permission for the user group
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permission for user 2 has been removed
    const removedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(removedDerivedPermissionUserTwo).toBeNull()

    // verify that the derived permission for user 1 is still present
    const retainedDerivedPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(retainedDerivedPermissionUserOne).toBeTruthy()
    expect(retainedDerivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    // cleanup: delete all created objects and user groups
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that removal of direct permissions for user group on element results in removal of derived collections permissions for individual users', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // create a user group with users 1, 2, and 3
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userTwo.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
          ],
        },
      },
    })

    // grant WRITE permission for the user group on the element
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permissions have been created correctly
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
    expect(derivedPermissionUserTwo!.directPermissionId).toBeNull() // derived permission received through element ownership (not group)
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
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    // remove the direct permission for the user group
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // recompute derived permissions for the element
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // verify that the derived permission for user 3 has been removed
    const removedDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(removedDerivedPermissionUserThree).toBeNull()

    // cleanup: delete all created objects and user groups
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that direct / derived access for individual users persists after group access removal (if user has direct / derived access through element)', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an element using the answer collection (different user as owner)
    const element = await prisma.element.create({
      data: {
        type: ElementType.SELECTION,
        name: 'Element',
        content: 'Content',
        options: {},
        ownerId: userTwo.id,
        answerCollectionId: answerCollection.id,
      },
    })

    // add individual access to the answer collection for user 3 (WRITE permissions)
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create a user group with users 1, 2, 3, and 4
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [
            { id: userOne.id },
            { id: userTwo.id },
            { id: userThree.id },
            { id: userFour.id },
          ],
        },
      },
    })

    // grant ADMIN permissions to the user group on the answer collection
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // recompute derived permissions for the element and answer collection
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the derived permissions based on the group permission dominate for everyone except the owner
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
    expect(derivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

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
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy() // permission is not derived from another object permission

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
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserFour!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserFour!.derived).toBeFalsy() // permission is not derived from another object permission

    // remove the group permission for the user group
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the updated derived permissions are correct:
    // user 1 (OWNER), user 2 (READ - derived), user 3 (WRITE - direct), user 4 (no access)
    const updatedDerivedPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userOne.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserOne).toBeTruthy()
    expect(updatedDerivedPermissionUserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(updatedDerivedPermissionUserOne!.directPermissionId).toBeNull()
    expect(updatedDerivedPermissionUserOne!.derived).toBeFalsy() // permission is not derived from another object permission

    const updatedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(updatedDerivedPermissionUserTwo!.directPermissionId).toBeNull() // derived permission received through element ownership (not group)
    expect(updatedDerivedPermissionUserTwo!.derived).toBeTruthy() // permission is derived from another object permission

    const updatedDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserThree).toBeTruthy()
    expect(updatedDerivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(updatedDerivedPermissionUserThree!.directPermissionId).toBe(
      individualPermission.id
    )
    expect(updatedDerivedPermissionUserThree!.derived).toBeFalsy() // permission is not derived from another object permission

    const updatedDerivedPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userFour.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserFour).toBeNull() // permission has been removed

    // cleanup: delete all created objects and user groups
    await prisma.element.delete({ where: { id: element.id } })
    const elementCount = await prisma.element.count()
    expect(elementCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it("Verify that a user's permission are updated with individual derived permission updating function if the group permission changes", async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a user group with users 1 and 2
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'User Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })

    // add an individual permission with READ access for user 2
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // add a group permission with WRITE access for the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the answer collection
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that user 2 is granted write permissions based on the group permission
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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    // update the group permissions to be at ADMIN level
    await prisma.permission.update({
      where: { id: groupPermission.id },
      data: { permissionLevel: PermissionLevel.ADMIN },
    })

    // recompute derived permissions for the answer collection and user 2
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userTwo.id },
      prisma
    )

    // verify that user 2 is granted admin permissions based on the group permission
    const updatedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(updatedDerivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(updatedDerivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    // update the individual permission to be at WRITE level, downgrade the group permission to READ level
    await prisma.permission.update({
      where: { id: individualPermission.id },
      data: { permissionLevel: PermissionLevel.WRITE },
    })
    await prisma.permission.update({
      where: { id: groupPermission.id },
      data: { permissionLevel: PermissionLevel.READ },
    })

    // recompute derived permissions for the answer collection and user 2
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id, userId: userTwo.id },
      prisma
    )

    // verify that user 2 is granted write permissions based on the individual permission
    const finalDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(finalDerivedPermissionUserTwo).toBeTruthy()
    expect(finalDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(finalDerivedPermissionUserTwo!.directPermissionId).toBe(
      individualPermission.id
    )
    expect(finalDerivedPermissionUserTwo!.derived).toBeFalsy() // permission is not derived from another object permission

    // cleanup: delete all created objects and user groups
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that access to an activity template also results in the creation of derived access', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })
    const answerCollection2 = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection 2',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create an empty course (to connect the asynchronous activities to it)
    const course = await prisma.course.create({
      data: {
        name: 'Course',
        displayName: 'Course',
        pinCode: 100,
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
        owner: {
          connect: { id: userOne.id },
        },
      },
    })

    // create a live quiz activity template with the answer collection linked to it
    const liveQuizTemplate = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz Template',
        displayName: 'Live Quiz Template',
        description: 'Description',
        templateInfo: {
          create: {
            description: 'Description',
            instructions: 'Instructions',
            answerCollections: {
              connect: [
                { id: answerCollection.id },
                { id: answerCollection2.id },
              ],
            },
          },
        },
        owner: {
          connect: { id: userOne.id },
        },
      },
    })

    // add a shared access for user 5 to the live quiz template
    const templatePermission = await prisma.permission.create({
      data: {
        userId: userFive.id,
        liveQuizId: liveQuizTemplate.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create a practice quiz activity template with the answer collection linked to it
    const practiceQuizTemplate = await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz Template',
        displayName: 'Practice Quiz Template',
        description: 'Description',
        templateInfo: {
          create: {
            description: 'Description',
            instructions: 'Instructions',
            answerCollections: {
              connect: [
                { id: answerCollection.id },
                { id: answerCollection2.id },
              ],
            },
          },
        },
        course: {
          connect: { id: course.id },
        },
        owner: {
          connect: { id: userTwo.id },
        },
      },
    })

    // create a microlearning activity template with the answer collection linked to it
    const microlearningTemplate = await prisma.microLearning.create({
      data: {
        name: 'Microlearning Template',
        displayName: 'Microlearning Template',
        description: 'Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        templateInfo: {
          create: {
            description: 'Description',
            instructions: 'Instructions',
            answerCollections: {
              connect: [{ id: answerCollection.id }],
            },
          },
        },
        course: {
          connect: { id: course.id },
        },
        owner: {
          connect: { id: userThree.id },
        },
      },
    })

    // create a group activity template with the answer collection linked to it
    const groupTemplate = await prisma.groupActivity.create({
      data: {
        name: 'Group Template',
        displayName: 'Group Template',
        description: 'Description',
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(),
        templateInfo: {
          create: {
            description: 'Description',
            instructions: 'Instructions',
            answerCollections: {
              connect: [{ id: answerCollection.id }],
            },
          },
        },
        course: {
          connect: { id: course.id },
        },
        owner: {
          connect: { id: userFour.id },
        },
      },
    })

    // trigger recomputation of derived permissions for all activities and the answer collection
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuizTemplate.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuizTemplate.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { microLearningId: microlearningTemplate.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { groupActivityId: groupTemplate.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection2.id },
      prisma
    )

    // verify that all users have access to the answer collection and users 1, 2, and 5 have access to the second answer collection (OWNER / READ permissions)
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

    const derivedPermission2UserOne = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userOne.id,
          },
        },
      }
    )
    expect(derivedPermission2UserOne).toBeTruthy()
    expect(derivedPermission2UserOne!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermission2UserOne!.directPermissionId).toBeNull()
    expect(derivedPermission2UserOne!.derived).toBeFalsy()

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
    expect(derivedPermissionUserTwo!.directPermissionId).toBeNull() // activity owner -> no permission that could be linked
    expect(derivedPermissionUserTwo!.derived).toBeTruthy() // permission is derived from another object (activity template)

    const derivedPermission2UserTwo = await prisma.derivedPermission.findUnique(
      {
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(derivedPermission2UserTwo).toBeTruthy()
    expect(derivedPermission2UserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermission2UserTwo!.directPermissionId).toBeNull() // activity owner -> no permission that could be linked
    expect(derivedPermission2UserTwo!.derived).toBeTruthy() // permission is derived from another object (activity template)

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
    expect(derivedPermissionUserThree!.directPermissionId).toBeNull() // activity owner -> no permission that could be linked
    expect(derivedPermissionUserThree!.derived).toBeTruthy() // permission is derived from another object (activity template)

    const derivedPermission2UserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermission2UserThree).toBeNull() // no access to the second answer collection (not included in activity)$

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
    expect(derivedPermissionUserFour!.directPermissionId).toBeNull() // activity owner -> no permission that could be linked
    expect(derivedPermissionUserFour!.derived).toBeTruthy() // permission is derived from another object (activity template)

    const derivedPermission2UserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermission2UserFour).toBeNull() // no access to the second answer collection (not included in activity)

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
    expect(derivedPermissionUserFive).toBeTruthy()
    expect(derivedPermissionUserFive!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermissionUserFive!.directPermissionId).toBe(
      templatePermission.id
    )
    expect(derivedPermissionUserFive!.derived).toBeTruthy()

    const derivedPermission2UserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: answerCollection2.id,
            userId: userFive.id,
          },
        },
      })
    expect(derivedPermission2UserFive).toBeTruthy()
    expect(derivedPermission2UserFive!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(derivedPermission2UserFive!.directPermissionId).toBe(
      templatePermission.id
    )
    expect(derivedPermission2UserFive!.derived).toBeTruthy()

    // cleanup: delete all created objects and user groups
    await prisma.liveQuiz.delete({
      where: { id: liveQuizTemplate.id },
    })
    const liveQuizCount = await prisma.liveQuiz.count()
    expect(liveQuizCount).toBe(0)
    await prisma.practiceQuiz.delete({
      where: { id: practiceQuizTemplate.id },
    })
    const practiceQuizCount = await prisma.practiceQuiz.count()
    expect(practiceQuizCount).toBe(0)
    await prisma.microLearning.delete({
      where: { id: microlearningTemplate.id },
    })
    const microLearningCount = await prisma.microLearning.count()
    expect(microLearningCount).toBe(0)
    await prisma.groupActivity.delete({
      where: { id: groupTemplate.id },
    })
    const groupActivityCount = await prisma.groupActivity.count()
    expect(groupActivityCount).toBe(0)
    await prisma.answerCollection.deleteMany()
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.course.delete({
      where: { id: course.id },
    })
    const courseCount = await prisma.course.count()
    expect(courseCount).toBe(0)
    const directPermissionsCount = await prisma.permission.count()
    expect(directPermissionsCount).toBe(0)
    const derivedPermissionsCount = await prisma.derivedPermission.count()
    expect(derivedPermissionsCount).toBe(0)
  })

  it('Verify that access of a user group to an activity template also results in corresponding derived access for individual users', async () => {
    // create an answer collection
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Answer Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // create a live quiz template linked to the answer collection
    const liveQuizTemplate = await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz Template',
        displayName: 'Live Quiz Template',
        description: 'Description',
        templateInfo: {
          create: {
            description: 'Description',
            instructions: 'Instructions',
            answerCollections: {
              connect: [{ id: answerCollection.id }],
            },
          },
        },
        owner: {
          connect: { id: userOne.id },
        },
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

    // add a group permission with WRITE access for the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        liveQuizId: liveQuizTemplate.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant direct access to the answer collection for user 2
    const individualPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: answerCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // recompute derived permissions for the live quiz template
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuizTemplate.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { answerCollectionId: answerCollection.id },
      prisma
    )

    // verify that the correct derived permission entries have been created on the answer collection
    // user 1 (OWNER), user 2 (WRITE - direct), user 3 (READ - derived group template access)
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
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      individualPermission.id
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
      PermissionLevel.READ
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeTruthy()

    // cleanup: delete all created objects and user groups
    await prisma.liveQuiz.delete({
      where: { id: liveQuizTemplate.id },
    })
    const liveQuizCount = await prisma.liveQuiz.count()
    expect(liveQuizCount).toBe(0)
    await prisma.answerCollection.delete({
      where: { id: answerCollection.id },
    })
    const answerCollectionCount = await prisma.answerCollection.count()
    expect(answerCollectionCount).toBe(0)
    await prisma.userGroup.delete({ where: { id: userGroup.id } })
    const userGroupCount = await prisma.userGroup.count()
    expect(userGroupCount).toBe(0)
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
