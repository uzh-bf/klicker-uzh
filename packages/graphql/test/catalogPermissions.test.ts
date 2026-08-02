import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ObjectAccess,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests covering the creation of derived permissions for catalog collections', () => {
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

  // ! Catalog collection permissions tests
  // #region
  it('Verify that owner permissions on a catalog collection are correctly copied into the derived permissions table', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that a derived owner permission has been created
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission!.directPermissionId).toBeNull()
    expect(derivedPermission!.derived).toBeFalsy()
  })

  it('Verify that other direct permissions are correctly copied into the derived permissions table', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // grant direct access with different permission levels to users 2, 3, and 4
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const userThreePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const userFourPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the derived permissions have been created
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      userTwoPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
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
  })

  it('Verify that when passing a userId only the corresponding derived permissions are updated', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // grant direct access with different permission levels to users 2, 3, and 4
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const userThreePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    await prisma.permission.create({
      data: {
        userId: userFour.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger a recomputation of the derived permissions for user 1 only
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id, userId: userOne.id },
      prisma
    )

    // verify that only the derived permission for user 1 has been created
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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

    const missingPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermission1).toBeNull()

    const missingPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userThree.id,
        },
      },
    })
    expect(missingPermission2).toBeNull()

    const missingPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userFour.id,
        },
      },
    })
    expect(missingPermission3).toBeNull()

    // trigger a recomputation of the derived permissions for user 3 only
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id, userId: userThree.id },
      prisma
    )

    // verify that only the derived permission for user 3 has been created
    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const missingPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermission4).toBeNull()

    const missingPermission5 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userFour.id,
        },
      },
    })
    expect(missingPermission5).toBeNull()

    // modify the permission level of user 3 to ADMIN
    await prisma.permission.update({
      where: { id: userThreePermission.id },
      data: { permissionLevel: PermissionLevel.ADMIN },
    })

    // trigger a recomputation of the derived permissions for user 3 only
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id, userId: userThree.id },
      prisma
    )

    // verify that the derived permission for user 3 has been updated
    const updatedDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserThree).toBeTruthy()
    expect(updatedDerivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(updatedDerivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(updatedDerivedPermissionUserThree!.derived).toBeFalsy()
  })

  it('Verify that user group permissions are correctly expanded into individual derived permissions', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        access: ObjectAccess.RESTRICTED,
        ownerId: userOne.id,
      },
    })

    // create a second catalog collection owned by user 2
    const catalogCollection2 = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection 2',
        description: 'Description',
        access: ObjectAccess.PUBLIC,
        ownerId: userTwo.id,
      },
    })

    // create two user groups - one with users 1, 2, and 3, the other one with 3 and 4
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
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })

    // grant ADMIN permissions to the first group and WRITE permissions to the second group (first catalog collection)
    const groupPermission1 = await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    const groupPermission2 = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant READ permissions to the first group and WRITE for the second group (second catalog collection)
    await prisma.permission.create({
      data: {
        userGroupId: userGroup1.id,
        catalogCollectionId: catalogCollection2.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const groupPermission4 = await prisma.permission.create({
      data: {
        userGroupId: userGroup2.id,
        catalogCollectionId: catalogCollection2.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection2.id },
      prisma
    )

    // verify that the correct derived permission entries have been created for the respecitve users on the first catalog collection
    // user 1 (OWNER), user 2 (ADMIN), user 3 (ADMIN - group 1 overrides), user 4 (WRITE - group 2)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission1.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    const derivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission1.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
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

    // verify that the correct derived permission entries have been created for the respecitve users on the second catalog collection
    // user 1 (WRITE - group 2), user 2 (OWNER), user 3 (WRITE - group 2 overrides), user 4 (WRITE - group 2)
    const derivedPermissionUserOne2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection2.id,
            userId: userOne.id,
          },
        },
      }
    )
    expect(derivedPermissionUserOne2).toBeTruthy()
    expect(derivedPermissionUserOne2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserOne2!.directPermissionId).toBe(
      groupPermission4.id
    )
    expect(derivedPermissionUserOne2!.derived).toBeFalsy()

    const derivedPermissionUserTwo2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection2.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(derivedPermissionUserTwo2).toBeTruthy()
    expect(derivedPermissionUserTwo2!.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(derivedPermissionUserTwo2!.directPermissionId).toBeNull()
    expect(derivedPermissionUserTwo2!.derived).toBeFalsy()

    const derivedPermissionUserThree2 =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection2.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree2).toBeTruthy()
    expect(derivedPermissionUserThree2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserThree2!.directPermissionId).toBe(
      groupPermission4.id
    )
    expect(derivedPermissionUserThree2!.derived).toBeFalsy()

    const derivedPermissionUserFour2 =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection2.id,
            userId: userFour.id,
          },
        },
      })
    expect(derivedPermissionUserFour2).toBeTruthy()
    expect(derivedPermissionUserFour2!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(derivedPermissionUserFour2!.directPermissionId).toBe(
      groupPermission4.id
    )
    expect(derivedPermissionUserFour2!.derived).toBeFalsy()
  })

  it('expands every group role, prefers propagating ties, and preserves user-scoped recomputation', async () => {
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Set-based catalog permission coverage',
        ownerId: userOne.id,
      },
    })
    const userGroup = await prisma.userGroup.create({
      data: {
        name: 'Set-based catalog permission group',
        ownerId: userTwo.id,
        members: { connect: { id: userThree.id } },
        admins: { connect: { id: userFour.id } },
      },
    })
    const groupPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: catalogCollection.id,
        userGroupId: userGroup.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    const propagatingUserPermission = await prisma.permission.create({
      data: {
        catalogCollectionId: catalogCollection.id,
        userId: userFour.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })
    const readDerivedPermissions = () =>
      prisma.derivedPermission.findMany({
        where: { catalogCollectionId: catalogCollection.id },
        select: {
          userId: true,
          permissionLevel: true,
          directPermissionId: true,
          derived: true,
        },
        orderBy: { userId: 'asc' },
      })

    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    expect(await readDerivedPermissions()).toEqual([
      {
        userId: userTwo.id,
        permissionLevel: PermissionLevel.WRITE,
        directPermissionId: groupPermission.id,
        derived: false,
      },
      {
        userId: userOne.id,
        permissionLevel: PermissionLevel.OWNER,
        directPermissionId: null,
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
        directPermissionId: propagatingUserPermission.id,
        derived: false,
      },
    ])

    await prisma.permission.update({
      where: { id: groupPermission.id },
      data: { permissionLevel: PermissionLevel.ADMIN },
    })
    await recomputeDerivedPermissions(
      {
        catalogCollectionId: catalogCollection.id,
        userId: userTwo.id,
      },
      prisma
    )

    expect(await readDerivedPermissions()).toEqual([
      {
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
        directPermissionId: groupPermission.id,
        derived: false,
      },
      {
        userId: userOne.id,
        permissionLevel: PermissionLevel.OWNER,
        directPermissionId: null,
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
        directPermissionId: propagatingUserPermission.id,
        derived: false,
      },
    ])

    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    expect(await readDerivedPermissions()).toEqual([
      {
        userId: userTwo.id,
        permissionLevel: PermissionLevel.ADMIN,
        directPermissionId: groupPermission.id,
        derived: false,
      },
      {
        userId: userOne.id,
        permissionLevel: PermissionLevel.OWNER,
        directPermissionId: null,
        derived: false,
      },
      {
        userId: userThree.id,
        permissionLevel: PermissionLevel.ADMIN,
        directPermissionId: groupPermission.id,
        derived: false,
      },
      {
        userId: userFour.id,
        permissionLevel: PermissionLevel.ADMIN,
        directPermissionId: groupPermission.id,
        derived: false,
      },
    ])
  })

  async function permissionPrecendenceIndividualGroup(
    prisma,
    individualRecompute
  ) {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        ownerId: userOne.id,
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

    // grant WRITE permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // create individual permissions with READ, WRITE, and ADMIN access for users 2, 3, and 4
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    const userThreePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const userFourPermission = await prisma.permission.create({
      data: {
        userId: userFour.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    if (individualRecompute) {
      await recomputeDerivedPermissions(
        { catalogCollectionId: catalogCollection.id, userId: userOne.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { catalogCollectionId: catalogCollection.id, userId: userTwo.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { catalogCollectionId: catalogCollection.id, userId: userThree.id },
        prisma
      )
      await recomputeDerivedPermissions(
        { catalogCollectionId: catalogCollection.id, userId: userFour.id },
        prisma
      )
    } else {
      await recomputeDerivedPermissions(
        { catalogCollectionId: catalogCollection.id },
        prisma
      )
    }

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (WRITE - group), user 3 (WRITE - individual), user 4 (ADMIN - individual)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect([userThreePermission.id, groupPermission.id]).toContain(
      // same permission level - could be group or individual direct permission
      derivedPermissionUserThree!.directPermissionId
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    const derivedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
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
  }

  it('Verify that individual permissions have precedence over user group permissions if higher (and vice-versa) (individual derived permission recomputation with userId)', async () => {
    await permissionPrecendenceIndividualGroup(prisma, true)
  })

  it('Verify that individual permissions have precedence over user group permissions if higher (and vice-versa) (object-level derived permission recomputation without userId)', async () => {
    await permissionPrecendenceIndividualGroup(prisma, false)
  })

  it('Verify that on removal of direct group permissions, individual derived permissions are also removed', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
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

    // grant READ permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (READ - group), user 3 (READ - group)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
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

    // remove the group permission
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the derived permissions for users 2 and 3 have been removed
    const missingPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermission1).toBeNull()

    const missingPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userThree.id,
        },
      },
    })
    expect(missingPermission2).toBeNull()
  })

  it('Verify that on removal of direct individual permissions, corresponding derived permissions are also removed', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
        description: 'Description',
        ownerId: userOne.id,
      },
    })

    // grant READ permissions to user 2
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the correct derived permission entry has been created
    // user 1 (OWNER), user 2 (READ - individual)
    const derivedPermissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermissionUserTwo).toBeTruthy()
    expect(derivedPermissionUserTwo!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermissionUserTwo!.directPermissionId).toBe(
      userTwoPermission.id
    )
    expect(derivedPermissionUserTwo!.derived).toBeFalsy()

    // remove the individual permission
    await prisma.permission.delete({
      where: { id: userTwoPermission.id },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the derived permission for user 2 has been removed
    const missingPermission = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
          userId: userTwo.id,
        },
      },
    })
    expect(missingPermission).toBeNull()
  })

  it('Verify that on removal of direct individual permissions, remaining group permissions take effect (also if lower)', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
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

    // grant READ permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant READ permissions to user 2
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // grant ADMIN permissions to user 3
    const userThreePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (WRITE - group), user 3 (ADMIN - individual)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    // remove the individual permissions
    await prisma.permission.delete({
      where: { id: userTwoPermission.id },
    })
    await prisma.permission.delete({
      where: { id: userThreePermission.id },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the updated derived permissions are correct
    const updatedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(updatedDerivedPermissionUserTwo!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(updatedDerivedPermissionUserTwo!.derived).toBeFalsy()

    const updatedDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserThree).toBeTruthy()
    expect(updatedDerivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.WRITE
    )
    expect(updatedDerivedPermissionUserThree!.directPermissionId).toBe(
      groupPermission.id
    )
    expect(updatedDerivedPermissionUserThree!.derived).toBeFalsy()
  })

  it('Verify that on removal of direct group permissions, remaining individual permissions take effect (also if lower)', async () => {
    // create a catalog collection
    const catalogCollection = await prisma.catalogCollection.create({
      data: {
        name: 'Catalog Collection',
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

    // grant READ permissions to the user group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: userGroup.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    // grant READ permissions to user 2
    const userTwoPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.READ,
      },
    })

    // grant ADMIN permissions to user 3
    const userThreePermission = await prisma.permission.create({
      data: {
        userId: userThree.id,
        catalogCollectionId: catalogCollection.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the correct derived permission entries have been created
    // user 1 (OWNER), user 2 (WRITE - group), user 3 (ADMIN - individual)
    const derivedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: catalogCollection.id,
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
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(derivedPermissionUserThree).toBeTruthy()
    expect(derivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(derivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(derivedPermissionUserThree!.derived).toBeFalsy()

    // remove the group permission
    await prisma.permission.delete({
      where: { id: groupPermission.id },
    })

    // trigger recomputation of derived permissions for the catalog collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: catalogCollection.id },
      prisma
    )

    // verify that the updated derived permissions are correct
    const updatedDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userTwo.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserTwo).toBeTruthy()
    expect(updatedDerivedPermissionUserTwo!.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(updatedDerivedPermissionUserTwo!.directPermissionId).toBe(
      userTwoPermission.id
    )
    expect(updatedDerivedPermissionUserTwo!.derived).toBeFalsy()

    const updatedDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: catalogCollection.id,
            userId: userThree.id,
          },
        },
      })
    expect(updatedDerivedPermissionUserThree).toBeTruthy()
    expect(updatedDerivedPermissionUserThree!.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )
    expect(updatedDerivedPermissionUserThree!.directPermissionId).toBe(
      userThreePermission.id
    )
    expect(updatedDerivedPermissionUserThree!.derived).toBeFalsy()
  })
  // #endregion
})
