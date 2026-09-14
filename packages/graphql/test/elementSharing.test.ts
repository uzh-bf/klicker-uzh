import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AuditLogType,
  ElementInstanceType,
  ElementType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { ChoicesElementData, ElementInstanceResults } from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  addObjectToCatalog,
  cancelObjectSharingRequest,
  changeObjectPermissionLevel,
  copyElementToAccount,
  getCatalogElements,
  getCatalogSharingRequests,
  getDerivedElementPermissions,
  getElementPermissions,
  requestCatalogObject,
  revokeObjectAccess,
  shareObject,
  transferElementOwnership,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCatalogCollectionPermissions,
  seedCatalogCollections,
  seedElements,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFive, userFour, userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for sharing functionalities of elements (questions, content snippets, flashcards)', () => {
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

  // ! Sharing functionalities for elements
  // #region
  it('Verify that the level of granted direct individual permissions can be modified', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC1!.id)

    // grant READ permissions to user 2
    await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: SC!.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ elementId: SC!.id }, prisma)

    // verify that user 2 has READ permissions
    const permission1 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          userId: userTwo.id,
          elementId: SC!.id,
        },
      },
    })
    expect(permission1).not.toBeNull()
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)

    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          userId: userTwo.id,
          elementId: SC!.id,
        },
      },
    })
    expect(derivedPermission1).not.toBeNull()
    expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    // verify that if all information is consistent, the permission level is changed and correctly propagated
    const success = await changeObjectPermissionLevel(
      {
        permissionId: permission1!.id,
        permissionLevel: PermissionLevel.WRITE,
        elementId: SC!.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the direct and derived permissions have been updated correctly
    const permission2 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          userId: userTwo.id,
          elementId: SC!.id,
        },
      },
    })
    expect(permission2).not.toBeNull()
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          userId: userTwo.id,
          elementId: SC!.id,
        },
      },
    })
    expect(derivedPermission2).not.toBeNull()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SC!.id),
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.WRITE} for ${ObjectType.ELEMENT} (ID ${SC!.id}) through owner / admin ${userOne.id} for user ${userTwo.id}.`
    )
  })

  it('Verify that the level of granted direct group permissions can be modified', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // create a user group with users 1, 2, and 3 (ADMIN)
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userOne.id }, { id: userTwo.id }],
        },
      },
    })

    // grant individual WRITE permissions to user 2
    const directPermission = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        elementId: SE.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SE.id, userId: userTwo.id },
      prisma
    )

    // grant READ permissions to the group
    const groupPermission = await prisma.permission.create({
      data: {
        userGroupId: group.id,
        elementId: SE.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ elementId: SE.id }, prisma)

    // verify that the correct derived permissions have been created in the database
    // OWNER for user 1, WRITE for user 2, READ for user 3
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission1).not.toBeNull()
    expect(derivedPermission1?.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission1?.directPermissionId).toBeNull()

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission2).not.toBeNull()
    expect(derivedPermission2?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(derivedPermission2?.directPermissionId).toBe(directPermission.id)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission3).not.toBeNull()
    expect(derivedPermission3?.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission3?.directPermissionId).toBe(groupPermission.id)

    // change the group permission level to change to ADMIN, overriding individual permissions
    const success = await changeObjectPermissionLevel(
      {
        permissionId: groupPermission!.id,
        permissionLevel: PermissionLevel.ADMIN,
        elementId: SE.id,
        propagation: false,
      },
      userOneCtx
    )
    expect(success).toBe(true)

    // verify that the direct and derived permissions have been updated correctly
    const updatedDirectPermission = await prisma.permission.findUnique({
      where: {
        elementId_userGroupId: {
          elementId: SE.id,
          userGroupId: group.id,
        },
      },
    })
    expect(updatedDirectPermission).not.toBeNull()
    expect(updatedDirectPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // OWNER for user 1, ADMIN for user 2, ADMIN for user 3
    const updatedDerivedPermission1 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userOne.id,
          },
        },
      }
    )
    expect(updatedDerivedPermission1).not.toBeNull()
    expect(updatedDerivedPermission1?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )

    const updatedDerivedPermission2 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userTwo.id,
          },
        },
      }
    )
    expect(updatedDerivedPermission2).not.toBeNull()
    expect(updatedDerivedPermission2?.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    const updatedDerivedPermission3 = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      }
    )
    expect(updatedDerivedPermission3).not.toBeNull()
    expect(updatedDerivedPermission3?.permissionLevel).toBe(
      PermissionLevel.ADMIN
    )

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SE!.id),
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Permission level changed from ${PermissionLevel.READ} to ${PermissionLevel.ADMIN} for ${ObjectType.ELEMENT} (ID ${SE.id}) through owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Test the direct sharing functionality for elements with different permission levels for individual users', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // seed ADMIN and READ permissions on the answer collection for users 2 and 3
    const ACPermission1 = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const ACPermission2 = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // try sharing the object with a user that does not exist
    const res1 = await shareObject(
      {
        elementId: SE.id,
        shortnameOrEmail: 'nonExistingUser',
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    // grant READ, WRITE and ADMIN permissions to users 2, 3, and 4
    const permission1 = await shareObject(
      {
        elementId: SE.id,
        shortnameOrEmail: userTwo.email,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission1).toBeTruthy()
    expect(permission1!.userId).toBe(userTwo.id)
    expect(permission1!.username).toBe(userTwo.shortname)
    expect(permission1!.userEmail).toBe(userTwo.email)
    expect(permission1!.permissionLevel).toBe(PermissionLevel.READ)
    expect(permission1!.propagation).toBe(false)
    expect(permission1!.isOwn).toBe(false)

    const permission2 = await shareObject(
      {
        elementId: SE.id,
        shortnameOrEmail: userThree.email,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission2).toBeTruthy()
    expect(permission2!.userId).toBe(userThree.id)
    expect(permission2!.username).toBe(userThree.shortname)
    expect(permission2!.userEmail).toBe(userThree.email)
    expect(permission2!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permission2!.propagation).toBe(false)
    expect(permission2!.isOwn).toBe(false)

    const permission3 = await shareObject(
      {
        elementId: SE.id,
        shortnameOrEmail: userFour.email,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
      userOneCtx
    )
    expect(permission3).toBeTruthy()
    expect(permission3!.userId).toBe(userFour.id)
    expect(permission3!.username).toBe(userFour.shortname)
    expect(permission3!.userEmail).toBe(userFour.email)
    expect(permission3!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(permission3!.propagation).toBe(false)
    expect(permission3!.isOwn).toBe(false)

    // verify that the correct direct and derived permission entries have been stored in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(dbPermission1).toBeTruthy()
    expect(dbPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeTruthy()
    expect(dbPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission1).toBeTruthy()
    expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.READ)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission2).toBeTruthy()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission3).toBeTruthy()
    expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserId: userTwo.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.READ} granted for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} to user ${userTwo.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserId: userThree.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} to user ${userThree.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} to user ${userFour.id}.`
    )

    // verify that derived permissions on the dependent answer collection have been created for all users (READ if no higher direct permission)
    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission4).toBeTruthy()
    expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission4!.directPermissionId).toBe(ACPermission1.id)
    expect(derivedPermission4!.derived).toBe(false)

    const derivedPermission5 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission5).toBeTruthy()
    expect(derivedPermission5!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission5!.directPermissionId).toBe(ACPermission2.id)
    expect(derivedPermission5!.derived).toBe(false)

    const derivedPermission6 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission6).toBeTruthy()
    expect(derivedPermission6!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission6!.directPermissionId).toBe(dbPermission3!.id)
    expect(derivedPermission6!.derived).toBe(true)
  })

  it('Verify that direct group permissions on the element can be revoked without conditions and derived permissions are revoked as well', async () => {
    const { AC1: AC } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC!.id)

    // create a user group with users 1, 2, 3, 4, and 5 (OWNER)
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userFive.id,
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
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group.id,
        elementId: SE.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: SE.id }, prisma)

    // grant direct individual READ permissions to user 2 and 3 on the answer collection and element respectively
    const elementReadPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SE.id,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: SE.id, userId: userTwo.id },
      prisma
    )
    const answerCollectionReadPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userThree.id,
        answerCollectionId: AC!.id,
      },
    })
    await recomputeDerivedPermissions(
      { answerCollectionId: AC!.id, userId: userThree.id },
      prisma
    )

    // verify that all users have derived permissions on the element
    const permissionUserOne = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userOne.id,
        },
      },
    })
    expect(permissionUserOne).not.toBeNull()
    expect(permissionUserOne?.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(permissionUserOne?.directPermissionId).toBeNull()

    const permissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(permissionUserTwo).not.toBeNull()
    expect(permissionUserTwo?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserTwo?.directPermissionId).toBe(groupPermission.id)

    const permissionUserThree = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(permissionUserThree).not.toBeNull()
    expect(permissionUserThree?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserThree?.directPermissionId).toBe(groupPermission.id)

    const permissionUserFour = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(permissionUserFour).not.toBeNull()
    expect(permissionUserFour?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserFour?.directPermissionId).toBe(groupPermission.id)

    const permissionUserFive = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFive.id,
        },
      },
    })
    expect(permissionUserFive).not.toBeNull()
    expect(permissionUserFive?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(permissionUserFive?.directPermissionId).toBe(groupPermission.id)

    // verify that derived permissions on the contained answer collection exist
    const ACDerivedPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userOne.id,
          },
        },
      })
    expect(ACDerivedPermissionUserOne).not.toBeNull()
    expect(ACDerivedPermissionUserOne?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(ACDerivedPermissionUserOne?.directPermissionId).toBeNull()
    expect(ACDerivedPermissionUserOne?.derived).toBe(false)

    const ACDerivedPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userTwo.id,
          },
        },
      })
    expect(ACDerivedPermissionUserTwo).not.toBeNull()
    expect(ACDerivedPermissionUserTwo?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(ACDerivedPermissionUserTwo?.directPermissionId).toBe(
      groupPermission.id
    )
    expect(ACDerivedPermissionUserTwo?.derived).toBe(true)

    const ACDerivedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
        },
      })
    expect(ACDerivedPermissionUserThree).not.toBeNull()
    expect(ACDerivedPermissionUserThree?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(ACDerivedPermissionUserThree?.directPermissionId).toBe(
      answerCollectionReadPermission.id
    )
    expect(ACDerivedPermissionUserThree?.derived).toBe(false)

    const ACDerivedPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userFour.id,
          },
        },
      })
    expect(ACDerivedPermissionUserFour).not.toBeNull()
    expect(ACDerivedPermissionUserFour?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(ACDerivedPermissionUserFour?.directPermissionId).toBe(
      groupPermission.id
    )
    expect(ACDerivedPermissionUserFour?.derived).toBe(true)

    const ACDerivedPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userFive.id,
          },
        },
      })
    expect(ACDerivedPermissionUserFive).not.toBeNull()
    expect(ACDerivedPermissionUserFive?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(ACDerivedPermissionUserFive?.directPermissionId).toBe(
      groupPermission.id
    )
    expect(ACDerivedPermissionUserFive?.derived).toBe(true)

    // revoke the permission
    const deletedPermissionId = await revokeObjectAccess(
      {
        elementId: SE.id,
        permissionId: groupPermission.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId).toBe(groupPermission.id)

    // verify that both the acutal permission and the derived ones have been deleted
    const deletedPermission = await prisma.permission.findUnique({
      where: {
        id: groupPermission.id,
      },
    })
    expect(deletedPermission).toBeNull()

    const persistentPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userOne.id,
          },
        },
      })
    expect(persistentPermissionUserOne).not.toBeNull()
    expect(persistentPermissionUserOne?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(persistentPermissionUserOne?.directPermissionId).toBeNull()
    expect(persistentPermissionUserOne?.derived).toBe(false)

    const deletedPermissionUserTwo = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(deletedPermissionUserTwo).not.toBeNull()
    expect(deletedPermissionUserTwo?.permissionLevel).toBe(PermissionLevel.READ)
    expect(deletedPermissionUserTwo?.directPermissionId).toBe(
      elementReadPermission.id
    )
    expect(deletedPermissionUserTwo?.derived).toBe(false)

    const deletedPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userThree.id,
          },
        },
      })
    expect(deletedPermissionUserThree).toBeNull()

    const deletedPermissionUserFour = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userFour.id,
          },
        },
      }
    )
    expect(deletedPermissionUserFour).toBeNull()

    const deletedPermissionUserFive = await prisma.derivedPermission.findUnique(
      {
        where: {
          elementId_userId: {
            elementId: SE.id,
            userId: userFive.id,
          },
        },
      }
    )
    expect(deletedPermissionUserFive).toBeNull()

    // verify that the derived perissions on the answer collection only persist for user 1, 2 (derived) and 3 (direct)
    const persistentACPermissionUserOne =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userOne.id,
          },
        },
      })
    expect(persistentACPermissionUserOne).not.toBeNull()
    expect(persistentACPermissionUserOne?.permissionLevel).toBe(
      PermissionLevel.OWNER
    )
    expect(persistentACPermissionUserOne?.directPermissionId).toBeNull()
    expect(persistentACPermissionUserOne?.derived).toBe(false)

    const persistentACPermissionUserTwo =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userTwo.id,
          },
        },
      })
    expect(persistentACPermissionUserTwo).not.toBeNull()
    expect(persistentACPermissionUserTwo?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(persistentACPermissionUserTwo?.directPermissionId).toBe(
      elementReadPermission.id
    )
    expect(persistentACPermissionUserTwo?.derived).toBe(true)

    const persistentACPermissionUserThree =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userThree.id,
          },
        },
      })
    expect(persistentACPermissionUserThree).not.toBeNull()
    expect(persistentACPermissionUserThree?.permissionLevel).toBe(
      PermissionLevel.READ
    )
    expect(persistentACPermissionUserThree?.directPermissionId).toBe(
      answerCollectionReadPermission.id
    )
    expect(persistentACPermissionUserThree?.derived).toBe(false)

    const deletedACPermissionUserFour =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userFour.id,
          },
        },
      })
    expect(deletedACPermissionUserFour).toBeNull()

    const deletedACPermissionUserFive =
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC!.id,
            userId: userFive.id,
          },
        },
      })
    expect(deletedACPermissionUserFive).toBeNull()

    // verify that an audit log entry has been created for this permission revocation
    const audigLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} for user group ${group.id}.`
    )
  })

  it('Test the direct sharing functionality for elements with different permission levels for user groups', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // create a user group with users 1 (ADMIN), 2, and 3 and grant WRITE permissions on the element to them
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userTwo.id }, { id: userThree.id }],
        },
      },
    })
    const groupPermission = await shareObject(
      {
        elementId: SE.id,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(groupPermission).toBeTruthy()
    expect(groupPermission!.userGroupId).toBe(group.id)
    expect(groupPermission!.userGroupName).toBe(group.name)
    expect(groupPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupPermission!.propagation).toBe(false)

    // create a user group with users 1, 3 (ADMIN), and 4 and grant ADMIN permissions on the element to them
    const group2 = await prisma.userGroup.create({
      data: {
        name: 'Test Group 2',
        ownerId: userThree.id,
        members: {
          connect: [{ id: userOne.id }, { id: userFour.id }],
        },
      },
    })
    const groupPermission2 = await shareObject(
      {
        elementId: SE.id,
        userGroupId: group2.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
      userOneCtx
    )
    expect(groupPermission2).toBeTruthy()
    expect(groupPermission2!.userGroupId).toBe(group2.id)
    expect(groupPermission2!.userGroupName).toBe(group2.name)
    expect(groupPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(groupPermission2!.propagation).toBe(false)

    // seed ADMIN and READ permissions on the answer collection for users 2 and 3
    const ACPermission1 = await prisma.permission.create({
      data: {
        userId: userTwo.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const ACPermission2 = await prisma.permission.create({
      data: {
        userId: userThree.id,
        answerCollectionId: AC1!.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // try sharing the object with a user group that does not exist
    const res1 = await shareObject(
      {
        elementId: SE.id,
        userGroupId: 123456789,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(res1).toBeNull()

    // verify that the correct direct permissions have been created in the database
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        elementId_userGroupId: {
          elementId: SE.id,
          userGroupId: group.id,
        },
      },
    })
    expect(dbPermission1).not.toBeNull()
    expect(dbPermission1?.permissionLevel).toBe(PermissionLevel.WRITE)

    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        elementId_userGroupId: {
          elementId: SE.id,
          userGroupId: group2.id,
        },
      },
    })
    expect(dbPermission2).not.toBeNull()
    expect(dbPermission2?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct derived permissions have been created in the database
    // OWNER for user 1, WRITE for user 2, ADMIN for users 3 and 4
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission1).not.toBeNull()
    expect(derivedPermission1?.permissionLevel).toBe(PermissionLevel.OWNER)

    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission2).not.toBeNull()
    expect(derivedPermission2?.permissionLevel).toBe(PermissionLevel.WRITE)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission3).not.toBeNull()
    expect(derivedPermission3?.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission4).not.toBeNull()
    expect(derivedPermission4?.permissionLevel).toBe(PermissionLevel.ADMIN)

    // verify that the correct audit log entries have been created
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserGroupId: group.id,
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Direct permission with level ${PermissionLevel.WRITE} granted for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} to user group ${group.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectId: String(SE.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserGroupId: group2.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Direct permission with level ${PermissionLevel.ADMIN} granted for ${ObjectType.ELEMENT} (ID ${SE.id}) by owner / admin ${userOne.id} to user group ${group2.id}.`
    )

    // verify that derived permissions on the dependent answer collection have been created for all users (READ if no higher direct permission)
    const derivedPermission5 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedPermission5).toBeTruthy()
    expect(derivedPermission5!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedPermission5!.directPermissionId).toBeNull()
    expect(derivedPermission5!.derived).toBe(false)

    const derivedPermission6 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userTwo.id,
        },
      },
    })
    expect(derivedPermission6).toBeTruthy()
    expect(derivedPermission6!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission6!.directPermissionId).toBe(ACPermission1.id)
    expect(derivedPermission6!.derived).toBe(false)

    const derivedPermission7 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userThree.id,
        },
      },
    })
    expect(derivedPermission7).toBeTruthy()
    expect(derivedPermission7!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission7!.directPermissionId).toBe(ACPermission2.id)
    expect(derivedPermission7!.derived).toBe(false)

    const derivedPermission8 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission8).toBeTruthy()
    expect(derivedPermission8!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission8!.directPermissionId).toBe(dbPermission2!.id)
    expect(derivedPermission8!.derived).toBe(true)
  })

  it('Verify that direct permissions on the elements are loaded correctly', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // grant READ permissions to user 2
    const dbUserPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SE.id,
      },
    })

    // create a user group with users 3 and 4 and grant WRITE permissions to the group
    const group = await prisma.userGroup.create({
      data: {
        name: 'Test Group',
        ownerId: userOne.id,
        members: {
          connect: [{ id: userThree.id }, { id: userFour.id }],
        },
      },
    })
    const dbGroupPermission = await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group.id,
        elementId: SE.id,
      },
    })
    await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

    // fetch the direct permissions and make sure that they are correct
    const { permissions: directPermissions } = await getElementPermissions(
      { id: SE.id },
      userOneCtx
    )
    expect(directPermissions).not.toBeNull()
    expect(directPermissions.length).toBe(2)

    const userPermission = directPermissions.find(
      (permission) => permission.userId === userTwo.id
    )
    const groupPermission = directPermissions.find(
      (permission) => permission.userGroupId === group.id
    )
    expect(userPermission).not.toBeNull()
    expect(groupPermission).not.toBeNull()
    expect(userPermission?.permissionLevel).toBe(PermissionLevel.READ)
    expect(userPermission?.userId).toBe(userTwo.id)
    expect(userPermission?.permissionId).toBe(dbUserPermission.id)
    expect(groupPermission?.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(groupPermission?.userGroupId).toBe(group.id)
    expect(groupPermission?.permissionId).toBe(dbGroupPermission.id)
  })

  it('Verify that derived permissions on the element are loaded correctly', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // seed derived READ, WRITE and ADMIN permissions for user 2, 3 and 4
    const permission1 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SE.id,
        derived: true,
      },
    })
    const permission2 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        elementId: SE.id,
        derived: true,
      },
    })
    const permission3 = await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        elementId: SE.id,
        derived: true,
      },
    })

    // derived permissions that are copies of direct permissions / resolved group permissions,
    // should not show up in the derived permissions query
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFive.id,
        elementId: SE.id,
        derived: false,
      },
    })

    // fetch the derived permissions and make sure that they are correct
    const derivedPermissions = await getDerivedElementPermissions(
      { id: SE.id },
      userOneCtx
    )
    expect(derivedPermissions).not.toBeNull()
    expect(derivedPermissions!.length).toBe(3)

    const permissionIds = derivedPermissions!.map((p) => p.permissionId)
    expect(permissionIds).toEqual(
      expect.arrayContaining([permission1.id, permission2.id, permission3.id])
    )

    const READPermission = derivedPermissions!.find(
      (permission) => permission.userId === userTwo.id
    )
    const WRITEPermission = derivedPermissions!.find(
      (permission) => permission.userId === userThree.id
    )
    const ADMINPermission = derivedPermissions!.find(
      (permission) => permission.userId === userFour.id
    )
    expect(READPermission).not.toBeNull()
    expect(WRITEPermission).not.toBeNull()
    expect(ADMINPermission).not.toBeNull()
    expect(READPermission!.permissionLevel).toBe(PermissionLevel.READ)
    expect(READPermission!.userId).toBe(userTwo.id)
    expect(READPermission!.permissionId).toBe(permission1.id)
    expect(WRITEPermission!.permissionLevel).toBe(PermissionLevel.WRITE)
    expect(WRITEPermission!.userId).toBe(userThree.id)
    expect(WRITEPermission!.permissionId).toBe(permission2.id)
    expect(ADMINPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(ADMINPermission!.userId).toBe(userFour.id)
    expect(ADMINPermission!.permissionId).toBe(permission3.id)
  })

  it('Verify that direct permissions to an element can be revoked, but might be replaced with derived permissions', async () => {
    // create answer collections for testing
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC1!.id)

    const permission1 = await prisma.permission.upsert({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        element: {
          connect: {
            id: SC.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by owner
    const deletedPermissionId1 = await revokeObjectAccess(
      {
        permissionId: permission1.id,
        elementId: SC.id,
      },
      userOneCtx
    )
    expect(deletedPermissionId1).toBe(permission1.id)

    // verify that the direct permission has been deleted
    const dbPermission1 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission1).toBeNull()

    // verify that an audit log entry has been created for this permission revocation
    const audigLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.PERMISSION_REVOKED,
        objectId: String(SC.id),
        objectType: ObjectType.ELEMENT,
        sourceUserId: userOne.id,
        targetUserId: userFive.id,
      },
    })
    expect(audigLogEntry).toBeTruthy()
    expect(audigLogEntry!.message).toBe(
      `Permission revoked for ${ObjectType.ELEMENT} (ID ${SC.id}) by owner / admin ${userOne.id} for user ${userFive.id}.`
    )

    // create a new direct WRITE permission for user 5 on SC
    const permission2 = await prisma.permission.upsert({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        element: {
          connect: {
            id: SC.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // delete the permission through the corresponding mutation by admin
    const deletedPermissionId2 = await revokeObjectAccess(
      {
        permissionId: permission2.id,
        elementId: SC.id,
      },
      userTwoCtx
    )
    expect(deletedPermissionId2).toBe(permission2.id)

    // verify that the direct permission has been deleted
    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission2).toBeNull()

    // create a new direct ADMIN permission for user 5 on SC
    const permission3 = await prisma.permission.upsert({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        element: {
          connect: {
            id: SC.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })

    // create an activity containing the element
    const activity = await prisma.liveQuiz.create({
      data: {
        name: 'Activity',
        displayName: 'Activity',
        description: 'Description',
        ownerId: userFive.id,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    elementId: SC.id,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementType: ElementType.SC,
                    options: {},
                    elementData: {} as ChoicesElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    ownerId: userFive.id,
                  },
                ],
              },
            },
          ],
        },
      },
    })
    await recomputeDerivedPermissions(
      {
        liveQuizId: activity.id,
        userId: userFive.id,
      },
      prisma
    )

    // verify that a dervied permission entry has been created based on the direct permission
    const derivedPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission).toBeTruthy()
    expect(derivedPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission!.directPermissionId).toBe(permission3.id)
    expect(derivedPermission!.derived).toBe(false)

    // verify that the permission can be revoked by an owner / admin, but will be replaced with a derived READ permission
    const removalSuccess1 = await revokeObjectAccess(
      {
        permissionId: permission3.id,
        elementId: SC.id,
      },
      userTwoCtx
    )
    expect(removalSuccess1).toBeTruthy()

    // direct permission has been removed
    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    // a new derived permission has been created
    const derivedPermission2 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission2).toBeTruthy()
    expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission2!.derived).toBe(true)

    // grant direct access again to user 5
    const permission4 = await prisma.permission.upsert({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.ADMIN,
        element: {
          connect: {
            id: SC.id,
          },
        },
        user: {
          connect: {
            id: userFive.id,
          },
        },
      },
      update: {},
    })
    await recomputeDerivedPermissions(
      {
        elementId: SC.id,
        userId: userFive.id,
      },
      prisma
    )

    // verify that permission has been created correctly and a corresponding derived permission has been added
    const dbPermission4 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission4).toBeTruthy()
    expect(dbPermission4!.id).toBe(permission4.id)
    expect(dbPermission4!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedPermission3 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission3).toBeTruthy()
    expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedPermission3!.derived).toBe(false)

    // delete the live quiz and verify that user 5 can revoke own access using admin permissions
    await prisma.liveQuiz.delete({
      where: {
        id: activity.id,
      },
    })

    const permissionSelfRemoval = await revokeObjectAccess(
      {
        permissionId: permission4.id,
        elementId: SC.id,
      },
      userFiveCtx
    )
    expect(permissionSelfRemoval).toBe(permission4.id)

    // verify that both the direct permission and the derived permission have been removed
    const dbPermission5 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(dbPermission5).toBeNull()

    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SC.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission4).toBeNull()
  })

  it('Verify that an element OWNER can transfer the corresponding rights and that derived permissions are created correctly', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)

    // add direct admin permissions to user 4
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        elementId: SE.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: SE.id }, prisma)

    // transfer ownership rights of selection question to other admin (user 4) and validate creation of own admin permission
    const dbPermission = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission).toBeTruthy()
    expect(dbPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const newPermission1 = await transferElementOwnership(
      {
        id: SE.id,
        shortnameOrEmail: userFour.email,
      },
      userOneCtx
    )
    expect(newPermission1).toBeTruthy()
    expect(newPermission1!.userId).toBe(userOne.id)
    expect(newPermission1!.username).toBe(userOne.shortname)
    expect(newPermission1!.userEmail).toBe(userOne.email)
    expect(newPermission1!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(newPermission1!.isOwn).toBe(true)

    // verify that correct direct permissions have been created and the one for user 4 removed
    const dbPermission2 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userOne.id,
        },
      },
    })
    expect(dbPermission2).toBeTruthy()
    expect(dbPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const dbPermission3 = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(dbPermission3).toBeNull()

    // verify that derived ownership and admin permissions have been created correctly
    const derivedAdminPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userOne.id,
        },
      },
    })
    expect(derivedAdminPermission).toBeTruthy()
    expect(derivedAdminPermission!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdminPermission!.userId).toBe(userOne.id)

    const derivedOwnerPermission = await prisma.derivedPermission.findUnique({
      where: {
        elementId_userId: {
          elementId: SE.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedOwnerPermission).toBeTruthy()
    expect(derivedOwnerPermission!.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(derivedOwnerPermission!.userId).toBe(userFour.id)

    const updatedElement = await prisma.element.findUnique({
      where: { id: SE.id },
    })
    expect(updatedElement).toBeTruthy()
    expect(updatedElement!.ownerId).toBe(userFour.id)

    // verify that the new owner has been granted derived permissions on the dependent answer collection
    const derivedPermission4 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFour.id,
        },
      },
    })
    expect(derivedPermission4).toBeTruthy()
    expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission4!.directPermissionId).toBeNull()
    expect(derivedPermission4!.derived).toBe(true)

    // verify that the audit log entry has been created correctly
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.OWNER_TRANSFERRED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SE.id),
        sourceUserId: userOne.id,
        targetUserId: userFour.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Ownership of ${ObjectType.ELEMENT} (ID ${SE.id}) transferred from user ${userOne.id} to user ${userFour.id}.`
    )
  })
  // #endregion

  // ! Catalog functionalities for elements
  // #region
  it('Verify that only elements where a user has admin permissions are returned for the addition to the catalog', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC, MC } = await seedElements(userOneCtx, AC1!.id)

    // grant admin permissions to users 2 and 3, and write permissions to user 4 on the single choice question
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        elementId: SC!.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userThree.id,
        elementId: SC!.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userFour.id,
        elementId: SC!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: SC!.id }, prisma)

    // grant admin, write and read permissions to users 2, 3, and 4 on the multiple choice question
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        elementId: MC!.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        elementId: MC!.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        elementId: MC!.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: MC!.id }, prisma)

    // verify that the correct elements are returned when querying them for the addition to the catalog
    const elementsUserOne = await getCatalogElements(userOneCtx)
    expect(elementsUserOne).not.toBeNull()
    expect(elementsUserOne.length).toBe(2)
    const elementIds1 = elementsUserOne.map((element) => element.id)
    expect(elementIds1).toEqual(
      expect.arrayContaining([String(SC.id), String(MC.id)])
    )

    const elementsUserTwo = await getCatalogElements(userTwoCtx)
    expect(elementsUserTwo).not.toBeNull()
    expect(elementsUserTwo.length).toBe(2)
    const elementIds2 = elementsUserTwo.map((element) => element.id)
    expect(elementIds2).toEqual(
      expect.arrayContaining([String(SC.id), String(MC.id)])
    )

    const elementsUserThree = await getCatalogElements(userThreeCtx)
    expect(elementsUserThree).not.toBeNull()
    expect(elementsUserThree.length).toBe(1)
    const elementIds3 = elementsUserThree.map((element) => element.id)
    expect(elementIds3).toEqual(expect.arrayContaining([String(SC.id)]))

    const elementsUserFour = await getCatalogElements(userFourCtx)
    expect(elementsUserFour).not.toBeNull()
    expect(elementsUserFour.length).toBe(0)
    const elementIds4 = elementsUserFour.map((element) => element.id)
    expect(elementIds4).toEqual(expect.arrayContaining([]))
  })

  it('Test that elements can be added to a catalog collection by users with sufficient permissions', async () => {
    const { restrictedCatalog } = await seedCatalogCollections(userOneCtx)
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC, MC } = await seedElements(userOneCtx, AC1!.id)

    // grand READ permissions on the selection question to user 2
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        elementId: SC.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: SC!.id }, prisma)

    // grand ADMIN permissions on the multiple choice to users 3 and 4
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userThree.id,
        elementId: MC.id,
      },
    })
    await prisma.permission.create({
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        elementId: MC.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: MC!.id }, prisma)

    // grant WRITE permissions on the restricted catalog collection to user 4
    await prisma.permission.create({
      data: {
        userId: userFour.id,
        catalogCollectionId: restrictedCatalog.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })
    await recomputeDerivedPermissions(
      { catalogCollectionId: restrictedCatalog.id },
      prisma
    )

    // verify that user 2 has insufficient permissions to add the single choice question to the top-level catalog collection
    const res1 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        elementId: SC.id,
        access: ObjectAccess.PUBLIC,
      },
      userTwoCtx
    )
    expect(res1).toBeNull()

    // verify that user 1 has sufficient permissions to add the single choice question to the top-level catalog collection
    const res2 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        elementId: SC.id,
        access: ObjectAccess.PUBLIC,
      },
      userOneCtx
    )
    expect(res2).toBeTruthy()
    expect(res2!.objectId).toEqual(SC.id)
    expect(res2!.objectType).toEqual(ObjectType.ELEMENT)
    expect(res2!.access).toEqual(ObjectAccess.PUBLIC)
    expect(res2!.ownerShortname).toEqual(userOne.shortname)
    expect(res2!.isOwner).toBe(true)
    expect(res2!.isManager).toBe(true)
    expect(res2!.isRequested).toBe(false)
    expect(res2!.isShared).toBe(false)

    // verify that a proper catalog assignment was created
    const catalogAssignment2 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          elementId_catalogCollectionId: {
            elementId: SC.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment2).toBeTruthy()
    expect(catalogAssignment2!.access).toEqual(ObjectAccess.PUBLIC)

    // verify that an audit log entry was created
    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SC.id),
        sourceUserId: userOne.id,
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `${ObjectType.ELEMENT} (ID ${SC.id}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userOne.id}.`
    )

    // verify that user 3 has sufficient permissions to add the multiple choice question to the top-level catalog collection
    const res3 = await addObjectToCatalog(
      {
        catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        elementId: MC.id,
        access: ObjectAccess.RESTRICTED,
      },
      userThreeCtx
    )
    expect(res3).toBeTruthy()
    expect(res3!.objectId).toEqual(MC.id)
    expect(res3!.objectType).toEqual(ObjectType.ELEMENT)
    expect(res3!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res3!.ownerShortname).toEqual(userOne.shortname)
    expect(res3!.isOwner).toBe(false)
    expect(res3!.isManager).toBe(true)
    expect(res3!.isRequested).toBe(false)
    expect(res3!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment3 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          elementId_catalogCollectionId: {
            elementId: MC.id,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        },
      })
    expect(catalogAssignment3).toBeTruthy()
    expect(catalogAssignment3!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(MC.id),
        sourceUserId: userThree.id,
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `${ObjectType.ELEMENT} (ID ${MC.id}) added to catalog collection (ID ${MISSING_CATALOG_COLLECTION_ID}) by user ${userThree.id}.`
    )

    // verify that user 4 has sufficient permissions to add the multiple choice question to the restricted catalog collection
    // -> >= WRITE permissions are required and satisfied
    const res4 = await addObjectToCatalog(
      {
        catalogCollectionId: restrictedCatalog.id,
        elementId: MC.id,
        access: ObjectAccess.RESTRICTED,
      },
      userFourCtx
    )
    expect(res4).toBeTruthy()
    expect(res4!.objectId).toEqual(MC.id)
    expect(res4!.objectType).toEqual(ObjectType.ELEMENT)
    expect(res4!.access).toEqual(ObjectAccess.RESTRICTED)
    expect(res4!.ownerShortname).toEqual(userOne.shortname)
    expect(res4!.isOwner).toBe(false)
    expect(res4!.isManager).toBe(true)
    expect(res4!.isRequested).toBe(false)
    expect(res4!.isShared).toBe(true)

    // verify that a proper catalog assignment was created
    const catalogAssignment4 =
      await prisma.catalogCollectionAssignment.findUnique({
        where: {
          elementId_catalogCollectionId: {
            elementId: MC.id,
            catalogCollectionId: restrictedCatalog.id,
          },
        },
      })
    expect(catalogAssignment4).toBeTruthy()
    expect(catalogAssignment4!.access).toEqual(ObjectAccess.RESTRICTED)

    // verify that an audit log entry was created
    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(MC.id),
        sourceUserId: userFour.id,
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `${ObjectType.ELEMENT} (ID ${MC.id}) added to catalog collection (ID ${restrictedCatalog.id}) by user ${userFour.id}.`
    )
  })

  it('Verify that user 5 can request access and import public elements in public catalog (incl. derived permissions on answer collections)', async () => {
    // create elements and catalog collections for testing
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE, CS } = await seedElements(userOneCtx, AC1!.id)
    const { publicCatalog, restrictedCatalog } =
      await seedCatalogCollections(userOneCtx)

    // create permissions for users 2, 3, and 4 (ADMIN, WRITE, READ in descending order)
    await prisma.permission.createMany({
      data: [
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userTwo.id,
          elementId: SE.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          elementId: SE.id,
        },
        {
          permissionLevel: PermissionLevel.READ,
          userId: userFour.id,
          elementId: SE.id,
        },
        {
          permissionLevel: PermissionLevel.ADMIN,
          userId: userTwo.id,
          elementId: CS.id,
        },
        {
          permissionLevel: PermissionLevel.WRITE,
          userId: userThree.id,
          elementId: CS.id,
        },
        {
          permissionLevel: PermissionLevel.READ,
          userId: userFour.id,
          elementId: CS.id,
        },
      ],
    })

    // recompute derived permissions that are checked in backend service functions
    await recomputeDerivedPermissions({ elementId: SE.id }, prisma)
    await recomputeDerivedPermissions({ elementId: CS.id }, prisma)

    // seed permissions on catalog collections
    await seedCatalogCollectionPermissions(
      prisma,
      publicCatalog.id,
      restrictedCatalog.id
    )

    // seed catalog collection assignments for elements
    // add all catalog collection assignments we need
    await prisma.catalogCollectionAssignment.createMany({
      data: [
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          elementId: SE.id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          elementId: CS.id,
        },
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: publicCatalog.id,
          elementId: SE.id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: publicCatalog.id,
          elementId: CS.id,
        },
        {
          access: ObjectAccess.PUBLIC,
          catalogCollectionId: restrictedCatalog.id,
          elementId: SE.id,
        },
        {
          access: ObjectAccess.RESTRICTED,
          catalogCollectionId: restrictedCatalog.id,
          elementId: CS.id,
        },
      ],
    })

    // verify that requesting / importing elements through the restricted catalog collection does not work
    const failure1 = await requestCatalogObject(
      {
        catalogCollectionId: restrictedCatalog.id,
        elementId: SE.id,
      },
      userFiveCtx
    )
    expect(failure1).toBeFalsy()

    const failure2 = await copyElementToAccount(
      {
        catalogCollectionId: restrictedCatalog.id,
        elementId: SE.id,
      },
      userFiveCtx
    )
    expect(failure2).toBeFalsy()

    const pendingAccessRequest1 = await prisma.accessRequest.count({
      where: { userId: userFive.id },
    })
    expect(pendingAccessRequest1).toBe(0)
    const importedSEs = await prisma.element.count({
      where: { ownerId: userFive.id },
    })
    expect(importedSEs).toBe(0)

    // request access to SE and CS elements through the public catalog collection
    const success1 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: SE.id,
      },
      userFiveCtx
    )
    expect(success1).toBeTruthy()

    const success2 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: CS.id,
        requestedPermissionLevel: PermissionLevel.WRITE,
      },
      userFiveCtx
    )
    expect(success2).toBeTruthy()

    // verify that the access requests have been created correctly
    const pendingAccessRequest2 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(pendingAccessRequest2.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER
    expect(
      pendingAccessRequest2.map((permission) => permission.elementId)
    ).toEqual(expect.arrayContaining([SE.id, CS.id]))

    // verify that proper audit log entries have been created for both access requests
    const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SE.id),
        sourceUserId: userFive.id,
        targetUserId: userOne.id, // owner
      },
    })
    expect(auditLogEntry1).toBeTruthy()
    expect(auditLogEntry1!.message).toBe(
      `Access request (permission level ${PermissionLevel.READ}) created for ${ObjectType.ELEMENT} (ID ${SE.id}) by user ${userFive.id} for owner / admin ${userOne.id}.`
    )

    const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SE.id),
        sourceUserId: userFive.id,
        targetUserId: userTwo.id, // admin
      },
    })
    expect(auditLogEntry2).toBeTruthy()
    expect(auditLogEntry2!.message).toBe(
      `Access request (permission level ${PermissionLevel.READ}) created for ${ObjectType.ELEMENT} (ID ${SE.id}) by user ${userFive.id} for owner / admin ${userTwo.id}.`
    )

    const auditLogEntry3 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(CS.id),
        sourceUserId: userFive.id,
        targetUserId: userOne.id, // owner
      },
    })
    expect(auditLogEntry3).toBeTruthy()
    expect(auditLogEntry3!.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.ELEMENT} (ID ${CS.id}) by user ${userFive.id} for owner / admin ${userOne.id}.`
    )

    const auditLogEntry4 = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ELEMENT,
        objectId: String(CS.id),
        sourceUserId: userFive.id,
        targetUserId: userTwo.id, // admin
      },
    })
    expect(auditLogEntry4).toBeTruthy()
    expect(auditLogEntry4!.message).toBe(
      `Access request (permission level ${PermissionLevel.WRITE}) created for ${ObjectType.ELEMENT} (ID ${CS.id}) by user ${userFive.id} for owner / admin ${userTwo.id}.`
    )

    // import the selection element and verify that importing case study element does not work
    const failure3 = await copyElementToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: CS.id, // restricted access
      },
      userFiveCtx
    )
    expect(failure3).toBeFalsy()

    const success3 = await copyElementToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: SE.id, // public access
      },
      userFiveCtx
    )
    expect(success3).toBeTruthy()

    const importedSEs2 = await prisma.element.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedSEs2.length).toBe(1)
    expect(importedSEs2[0]!.originalId).toBe(String(SE.id))
    expect(importedSEs2[0]!.name).toBe(SE.name)
    expect(importedSEs2[0]).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    })

    // verify that a derived READ permission has been created for user 5 on the answer collection
    const derivedPermission1 = await prisma.derivedPermission.findUnique({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: AC1!.id,
          userId: userFive.id,
        },
      },
    })
    expect(derivedPermission1).toBeTruthy()
    expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.READ)
    expect(derivedPermission1!.directPermissionId).toBeNull()
    expect(derivedPermission1!.derived).toBe(true)

    // verify that duplicate requests are not accepted, duplicate imports are not a problem
    const failure4 = await requestCatalogObject(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: SE.id,
      },
      userFiveCtx
    )
    expect(failure4).toBeFalsy()

    const accessRequests3 = await prisma.accessRequest.findMany({
      where: { userId: userFive.id },
    })
    expect(accessRequests3.length).toBe(4) // 2 access requests, one entry in table each for 1 ADMIN and 1 OWNER

    const success4 = await copyElementToAccount(
      {
        catalogCollectionId: publicCatalog.id,
        elementId: SE.id,
      },
      userFiveCtx
    )
    expect(success4).toBeTruthy()

    const importedACs3 = await prisma.element.findMany({
      where: { ownerId: userFive.id },
    })
    expect(importedACs3.length).toBe(2)
    expect(importedACs3[0]!.originalId).toBe(String(SE.id))
    expect(importedACs3[0]!.name).toContain(SE.name)
    expect(importedACs3[1]!.originalId).toBe(String(SE.id))
    expect(importedACs3[1]!.name).toContain(SE.name)
    for (const imported of importedACs3) {
      expect(imported).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      })
    }
  })

  it('Verify that element sharing requests can be cancelled by the initiator', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE } = await seedElements(userOneCtx, AC1!.id)
    const request = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: SE.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    // verify that the request is pending
    const pendingRequest = await prisma.accessRequest.findUnique({
      where: { id: request.id },
    })
    expect(pendingRequest).not.toBeNull()

    // verify that such a request fails for users that have not requested access
    const failure = await cancelObjectSharingRequest(
      { elementId: SE.id },
      userThreeCtx
    )
    expect(failure).toBe(false)

    // cancel the request
    const success = await cancelObjectSharingRequest(
      { elementId: SE.id },
      userTwoCtx
    )
    expect(success).toBe(true)

    // verify that the request is no longer pending
    const cancelledRequest = await prisma.accessRequest.findUnique({
      where: { id: request.id },
    })
    expect(cancelledRequest).toBeNull()

    // verify that a corresponding audit log entry has been created
    const auditLogEntry = await prisma.auditLogEntry.findFirst({
      where: {
        type: AuditLogType.REQUEST_CANCELLED,
        objectType: ObjectType.ELEMENT,
        objectId: String(SE.id),
        sourceUserId: userTwo.id,
      },
    })
    expect(auditLogEntry).toBeTruthy()
    expect(auditLogEntry!.message).toBe(
      `Access request cancelled for ${ObjectType.ELEMENT} (ID ${SE.id}) by user ${userTwo.id}.`
    )
  })

  it('Verify that access requests to answer collections are shown correctly to owners and admins', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SE, CS } = await seedElements(userOneCtx, AC1!.id)

    // create access requests for user 3 (on both questions) and user 4 (on the case study question)
    // access requests for the selection question should be linked to both user 1 (owner) and user 2 (admin)
    const request1 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: SE.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request2 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: SE.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    const request3 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: CS.id,
        userId: userThree.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request4 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: SE.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userOne.id,
      },
    })

    const request5 = await prisma.accessRequest.create({
      data: {
        permissionLevel: PermissionLevel.WRITE,
        elementId: SE.id,
        userId: userFour.id,
        objectAdminOrOwnerId: userTwo.id,
      },
    })

    // get the pending sharing requests for user 1 and check their content
    const requests = await getCatalogSharingRequests(userOneCtx)
    expect(requests).not.toBeNull()
    expect(requests!.length).toBe(3)
    const publicRequestUserThree = requests!.find(
      (request) => request.requestId === request1.id
    )
    const publicRequestUserFour = requests!.find(
      (request) => request.requestId === request4.id
    )
    const restrictedRequestUserThree = requests!.find(
      (request) => request.requestId === request3.id
    )
    expect(publicRequestUserThree).not.toBeNull()
    expect(publicRequestUserFour).not.toBeNull()
    expect(restrictedRequestUserThree).not.toBeNull()
    expect(publicRequestUserThree?.objectType).toBe(ObjectType.ELEMENT)
    expect(publicRequestUserThree?.requestId).toBe(request1.id)
    expect(publicRequestUserThree?.userId).toBe(userThree.id)
    expect(publicRequestUserThree?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour?.objectType).toBe(ObjectType.ELEMENT)
    expect(publicRequestUserFour?.requestId).toBe(request4.id)
    expect(publicRequestUserFour?.userId).toBe(userFour.id)
    expect(publicRequestUserFour?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour?.userShortname).toBe(userFour.shortname)

    expect(restrictedRequestUserThree?.objectType).toBe(ObjectType.ELEMENT)
    expect(restrictedRequestUserThree?.requestId).toBe(request3.id)
    expect(restrictedRequestUserThree?.userId).toBe(userThree.id)
    expect(restrictedRequestUserThree?.userEmail).toBe(userThree.email)
    expect(restrictedRequestUserThree?.userShortname).toBe(userThree.shortname)

    // get the pending sharing requests for user 2 and check their content
    const requests2 = await getCatalogSharingRequests(userTwoCtx)
    expect(requests2).not.toBeNull()
    expect(requests2!.length).toBe(2)
    const publicRequestUserThree2 = requests2!.find(
      (request) => request.requestId === request2.id
    )
    const publicRequestUserFour2 = requests2!.find(
      (request) => request.requestId === request5.id
    )
    expect(publicRequestUserThree2).not.toBeNull()
    expect(publicRequestUserFour2).not.toBeNull()

    expect(publicRequestUserThree2?.objectType).toBe(ObjectType.ELEMENT)
    expect(publicRequestUserThree2?.requestId).toBe(request2.id)
    expect(publicRequestUserThree2?.userId).toBe(userThree.id)
    expect(publicRequestUserThree2?.userEmail).toBe(userThree.email)
    expect(publicRequestUserThree2?.userShortname).toBe(userThree.shortname)

    expect(publicRequestUserFour2?.objectType).toBe(ObjectType.ELEMENT)
    expect(publicRequestUserFour2?.requestId).toBe(request5.id)
    expect(publicRequestUserFour2?.userId).toBe(userFour.id)
    expect(publicRequestUserFour2?.userEmail).toBe(userFour.email)
    expect(publicRequestUserFour2?.userShortname).toBe(userFour.shortname)
  })
  // #endregion
})
