import { randomUUID } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { parseCanonicalAuditEnvelope } from '@klicker-uzh/audit'
import {
  AuditLogType,
  ElementType,
  ObjectType,
  PermissionLevel,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  addUserToUserGroup,
  changeUserGroupName,
  createUserGroup,
  deleteUserGroup,
  demoteGroupAdminToMember,
  leaveUserGroup,
  promoteGroupMemberToAdmin,
  removeUserFromGroup,
  transferGroupOwnership,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedAnswerCollections,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFour, userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for user group management', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser

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
    } = await testInitialization(prisma, hatchet, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
  })

  afterEach(async () => await testCleanup(prisma))

  describe('Integration tests for user group creation and manipulation, including member management', () => {
    it('Providing regular members should result in a successful group creation', async () => {
      // create a group with two regular members (not admins)
      const groupName = 'Test Group'
      const result = await createUserGroup(
        {
          name: groupName,
          members: [
            { shortnameOrEmail: userTwo.shortname, isAdmin: false },
            { shortnameOrEmail: userThree.email, isAdmin: false },
          ],
        },
        userOneCtx
      )

      // verify the result
      expect(result).toBeTruthy()
      expect(result!.name).toBe(groupName)
      expect(result!.members.length).toBe(2)
      expect(result!.admins.length).toBe(0)
      expect(result!.numOfMembers).toBe(3) // 2 members + owner

      // verify that members are correctly assigned
      const memberIds = result!.members.map((member) => member.id)
      expect(memberIds).toContain(userTwo.id)
      expect(memberIds).toContain(userThree.id)

      // verify that a correct audit log entry has been created
      const auditLog = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(result!.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_CREATED,
        },
      })
      expect(auditLog).toBeTruthy()
      expect(auditLog!.sourceUserId).toBe(userOne.id)
      expect(auditLog!.message).toBe(
        `User group created with members [${userTwo.id},${userThree.id}] and admins [].`
      )
    })

    it('Providing members and admins should result in a successful group creation and correct links', async () => {
      // create a group with one regular member and two admins
      const groupName = 'Mixed Group'
      const result = await createUserGroup(
        {
          name: groupName,
          members: [
            { shortnameOrEmail: userTwo.shortname, isAdmin: false },
            { shortnameOrEmail: userThree.email, isAdmin: true },
            { shortnameOrEmail: userFour.shortname, isAdmin: true },
          ],
        },
        userOneCtx
      )

      // verify the result
      expect(result).toBeTruthy()
      expect(result!.name).toBe(groupName)
      expect(result!.members.length).toBe(1)
      expect(result!.admins.length).toBe(2)
      expect(result!.numOfMembers).toBe(4) // 1 member + 2 admins + owner

      // verify that members are correctly assigned to the right roles
      const memberIds = result!.members.map((member) => member.id)
      const adminIds = result!.admins.map((admin) => admin.id)
      expect(memberIds).toContain(userTwo.id)
      expect(adminIds).toContain(userThree.id)
      expect(adminIds).toContain(userFour.id)

      // verify that a correct audit log entry has been created
      const auditLog = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(result!.id),
          type: AuditLogType.USER_GROUP_CREATED,
        },
      })
      expect(auditLog).toBeTruthy()
      expect(auditLog!.sourceUserId).toBe(userOne.id)
      expect(auditLog!.message).toBe(
        `User group created with members [${userTwo.id}] and admins [${userFour.id},${userThree.id}].`
      )
    })

    it('Test that the creation of a user group with duplicated name fails', async () => {
      // create a valid user group
      const groupName = 'Duplicate Group'
      await createUserGroup(
        {
          name: groupName,
          members: [{ shortnameOrEmail: userTwo.shortname, isAdmin: false }],
        },
        userOneCtx
      )

      // try to create another group with the same name
      const duplicateGroup = await createUserGroup(
        {
          name: groupName,
          members: [{ shortnameOrEmail: userTwo.shortname, isAdmin: false }],
        },
        userOneCtx
      )
      expect(duplicateGroup).toBeNull()
    })

    it('User group creation should fail if no valid members were found', async () => {
      const userGroup = await createUserGroup(
        {
          name: 'Empty Group',
          members: [{ shortnameOrEmail: 'nonexistent', isAdmin: false }],
        },
        userOneCtx
      )
      expect(userGroup).toBeNull()
    })

    it('User group creation should success if at least one valid member was provided, other users should be ignored', async () => {
      // create a group with one valid member and one invalid member
      const groupName = 'Partial Group'
      const result = await createUserGroup(
        {
          name: groupName,
          members: [
            { shortnameOrEmail: userTwo.shortname, isAdmin: false },
            { shortnameOrEmail: 'nonexistent', isAdmin: false },
          ],
        },
        userOneCtx
      )

      // Verify only the valid member was added
      expect(result).toBeTruthy()
      expect(result!.name).toBe(groupName)
      expect(result!.members.length).toBe(1)
      expect(result!.members[0]!.id).toBe(userTwo.id)
    })

    it('Duplicate members and the owner should be filtered from the member / admin lists', async () => {
      // create a group where one of the members is the owner and other members are included twice
      const groupName = 'Owner Included Group'
      const result = await createUserGroup(
        {
          name: groupName,
          members: [
            { shortnameOrEmail: userOne.shortname, isAdmin: false }, // onwer (should be ignored)
            { shortnameOrEmail: userTwo.shortname, isAdmin: false },
            { shortnameOrEmail: userTwo.email, isAdmin: false }, // duplicate member (should be ignored)
            { shortnameOrEmail: userThree.shortname, isAdmin: true },
            { shortnameOrEmail: userThree.email, isAdmin: true }, // duplicate admin (should be ignored)
          ],
        },
        userOneCtx
      )

      // verify only non-owner members were added
      expect(result).toBeTruthy()
      expect(result!.members.length).toBe(1)
      expect(result!.members[0]!.id).toBe(userTwo.id)
      expect(result!.admins.length).toBe(1)
      expect(result!.admins[0]!.id).toBe(userThree.id)

      // owner should not appear in members list
      const memberIds = result!.members.map((member) => member.id)
      expect(memberIds).not.toContain(userOneCtx.user.sub)
    })

    it('Members of the group should be able to leave the group successfully', async () => {
      // create a group with a regular member
      const group = await prisma.userGroup.create({
        data: {
          name: 'Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // have a member leave the group
      const result = await leaveUserGroup({ groupId: group.id }, userTwoCtx)
      expect(result).toBe(true)

      // verify the user is no longer in the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(0)

      // verify that a correct audit log entry has been created
      const auditLog = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_USER_REMOVED,
          sourceUserId: userTwo.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLog).toBeTruthy()
      expect(auditLog!.message).toBe('User left user group.')
    })

    it('Admins of the group should be able to leave the group successfully', async () => {
      // create a group with an admin member
      const group = await prisma.userGroup.create({
        data: {
          name: 'Test Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // have a member leave the group
      const result = await leaveUserGroup({ groupId: group.id }, userTwoCtx)
      expect(result).toBe(true)

      // verify the user is no longer in the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup?.admins.length).toBe(0)
    })

    it('Users that are not part of the group should not be able to trigger the leave group mutation', async () => {
      // Create a group with one member
      const group = await prisma.userGroup.create({
        data: {
          name: 'Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // user three tries to leave the group -> should be handled gracefully
      const result = await leaveUserGroup({ groupId: group.id }, userThreeCtx)
      expect(result).toBe(false)
    })

    it('Trying to leave a group that does not exist should fail gracefully', async () => {
      const result = await leaveUserGroup(
        { groupId: 99999 }, // Non-existent group ID
        userTwoCtx
      )
      expect(result).toBe(false)
    })

    it('Owners should not be able to leave user groups using the leave function (can only delete them)', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Owner Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // try to trigger the leaveUserGroup function as owner
      const result = await leaveUserGroup({ groupId: group.id }, userOneCtx)
      expect(result).toBe(false)

      // verify the group still exists with the owner
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroup).not.toBeNull()
      expect(updatedGroup?.ownerId).toBe(userOne.id)
    })

    it('Verify that permissions granted to the user group are no longer applied to users that left the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Permission Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // create an answer collection and grant permissions to the group
      const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          answerCollectionId: AC1!.id,
        },
      })
      await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

      // create an element using the second answer collection and grant permissions to the group
      const element = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          name: 'Element',
          content: 'Content',
          options: {},
          ownerId: userOne.id,
          answerCollectionId: AC2!.id,
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          elementId: element.id,
        },
      })
      await recomputeDerivedPermissions({ elementId: element.id }, prisma)

      // verify that derived permissions on AC1 were created for both users
      const derivedPermission1 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission1).toBeTruthy()
      expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission1!.derived).toBe(false)

      const derivedPermission2 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission2).toBeTruthy()
      expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission2!.derived).toBe(false)

      // verify that derived permissions on AC2 were created for both users (derived from element)
      const derivedPermission3 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission3).toBeTruthy()
      expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission3!.derived).toBe(true)

      const derivedPermission4 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission4).toBeTruthy()
      expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission4!.derived).toBe(true)

      // have user two leave the group
      await leaveUserGroup({ groupId: group.id }, userTwoCtx)

      // verify that user two no longer has the derived permission
      const updatedDerivedPermission1 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC1!.id,
              userId: userTwo.id,
            },
          },
        })
      expect(updatedDerivedPermission1).toBeNull()

      const updatedDerivedPermission3 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC2!.id,
              userId: userTwo.id,
            },
          },
        })
      expect(updatedDerivedPermission3).toBeNull()

      // verify that user three still has the derived permission
      const persistentDerivedPermission2 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC1!.id,
              userId: userThree.id,
            },
          },
        })
      expect(persistentDerivedPermission2).toBeTruthy()
      expect(persistentDerivedPermission2!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(persistentDerivedPermission2!.derived).toBe(false)

      const persistentDerivedPermission4 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC2!.id,
              userId: userThree.id,
            },
          },
        })
      expect(persistentDerivedPermission4).toBeTruthy()
      expect(persistentDerivedPermission4!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(persistentDerivedPermission4!.derived).toBe(true)
    })

    it('The group owner should be able to delete a user group successfully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Group to Delete',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // owner should be able to delete the user group
      const result = await deleteUserGroup({ groupId: group.id }, userOneCtx)
      expect(result).toBe(true)

      // verify the group no longer exists
      const deletedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(deletedGroup).toBeNull()

      // verify that the audit log entry was created
      // verify that the audit log entry was created
      const auditLog = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_DELETED,
          sourceUserId: userOne.id,
        },
      })
      expect(auditLog).toBeTruthy()
      expect(auditLog!.message).toBe('User group deleted by owner.')
    })

    it('Non-owners should not be able to delete a user group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-owner Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // members are not able to delete the group
      const memberResult = await deleteUserGroup(
        { groupId: group.id },
        userTwoCtx
      )
      expect(memberResult).toBe(false)

      // admins are not able to delete the group
      const adminResult = await deleteUserGroup(
        { groupId: group.id },
        userThreeCtx
      )
      expect(adminResult).toBe(false)

      // verify the group still exists
      const existingGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(existingGroup).not.toBeNull()
    })

    it('Attempting to delete a non-existent group should fail gracefully', async () => {
      const result = await deleteUserGroup({ groupId: 99999 }, userOneCtx)
      expect(result).toBe(false)
    })

    it('Deleting a user group should remove all associated permissions', async () => {
      // Create a user group
      const group = await prisma.userGroup.create({
        data: {
          name: 'Permission Group To Delete',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // create an answer collection and grant permissions to the group
      const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          answerCollectionId: AC1!.id,
        },
      })
      await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

      // create an element using the second answer collection and grant permissions to the group
      const element = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          name: 'Element',
          content: 'Content',
          options: {},
          ownerId: userOne.id,
          answerCollectionId: AC2!.id,
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          elementId: element.id,
        },
      })
      await recomputeDerivedPermissions({ elementId: element.id }, prisma)

      // verify that derived permissions on AC1 were created for both users
      const derivedPermission1 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission1).toBeTruthy()
      expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission1!.derived).toBe(false)

      const derivedPermission2 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission2).toBeTruthy()
      expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission2!.derived).toBe(false)

      // verify that derived permissions on AC2 were created for both users (derived from element)
      const derivedPermission3 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission3).toBeTruthy()
      expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission3!.derived).toBe(true)

      const derivedPermission4 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission4).toBeTruthy()
      expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission4!.derived).toBe(true)

      // delete the user group
      const result = await deleteUserGroup({ groupId: group.id }, userOneCtx)
      expect(result).toBe(true)

      // verify that all permissions associated with the group are removed
      const deletedPermission1 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(deletedPermission1).toBeNull()

      const deletedPermission2 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userThree.id,
          },
        },
      })
      expect(deletedPermission2).toBeNull()

      const deletedPermission3 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(deletedPermission3).toBeNull()

      const deletedPermission4 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userThree.id,
          },
        },
      })
      expect(deletedPermission4).toBeNull()
    })

    it('Group owner should be able to promote a member to admin', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Promotion Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // owner promotes the member to admin
      const result = await promoteGroupMemberToAdmin(
        { groupId: group.id, memberId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(true)

      // verify the user is now an admin and not a regular member
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(0)
      expect(updatedGroup!.admins.length).toBe(1)
      expect(updatedGroup!.admins[0]?.id).toBe(userTwo.id)

      // verify that a correct audit log entry has been created
      const auditLogEntry = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_USER_MODIFIED,
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLogEntry).toBeTruthy()
      expect(auditLogEntry!.message).toBe(`User promoted from member to admin.`)
    })

    it('Group admin should be able to promote a member to admin', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Admin Promotion Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // admin promotes the member to admin
      const result = await promoteGroupMemberToAdmin(
        { groupId: group.id, memberId: userTwo.id },
        userThreeCtx
      )
      expect(result).toBe(true)

      // verify the user is now an admin and not a regular member
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(0)
      expect(updatedGroup!.admins.length).toBe(1)
      expect(updatedGroup!.admins[0]?.id).toBe(userTwo.id)
    })

    it('Regular members should not be able to promote another member to admin', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Member Promotion Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
        },
      })

      // regular member tries to promote another member to admin
      const result = await promoteGroupMemberToAdmin(
        { groupId: group.id, memberId: userThree.id },
        userTwoCtx
      )
      expect(result).toBe(false)

      // verify that the group was not modified
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userThree.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(1)
      expect(updatedGroup!.admins.length).toBe(0)
    })

    it('Promoting a user that is not a member of the group should fail gracefully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-existent Member Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // try to promote a user who is not in the group
      const result = await promoteGroupMemberToAdmin(
        { groupId: group.id, memberId: userThree.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Trying to promote a member in a non-existent group should fail gracefully', async () => {
      const result = await promoteGroupMemberToAdmin(
        { groupId: 99999, memberId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('If a user is already an admin of the group, the promotion should fail', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Double Admin Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
        },
      })

      // admin tries to promote another admin
      const result = await promoteGroupMemberToAdmin(
        { groupId: group.id, memberId: userThree.id },
        userTwoCtx
      )
      expect(result).toBe(false)

      // verify that the user group has not changed
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          _count: {
            select: {
              admins: true,
            },
          },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!._count.admins).toBe(2)
    })

    it('The group owner should be able to demote an admin to a regular member', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Demotion Test Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // owner demotes the admin to a member
      const result = await demoteGroupAdminToMember(
        { groupId: group.id, adminId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(true)

      // verify the user is now a regular member and not an admin
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(1)
      expect(updatedGroup!.members[0]?.id).toBe(userTwo.id)
      expect(updatedGroup!.admins.length).toBe(0)

      // verify that a correct audit log entry has been created
      const auditLogEntry = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_USER_MODIFIED,
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLogEntry).toBeTruthy()
      expect(auditLogEntry!.message).toBe(`User demoted from admin to member.`)
    })

    it('Any group admin should be able to demote another admin to a regular member', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Admin Demotion Test Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
        },
      })

      // one of the admin demotes another admin to a member
      const result = await demoteGroupAdminToMember(
        { groupId: group.id, adminId: userThree.id },
        userTwoCtx
      )
      expect(result).toBe(true)

      // verify the user is now a regular member and not an admin
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userThree.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(1)
      expect(updatedGroup!.members[0]?.id).toBe(userThree.id)
      expect(updatedGroup!.admins.length).toBe(0)
    })

    it('Regular members should not be able to demote an admin to a member', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Member Cannot Demote Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
          members: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // regular member tries to demote an admin
      const result = await demoteGroupAdminToMember(
        { groupId: group.id, adminId: userTwo.id },
        userThreeCtx
      )
      expect(result).toBe(false)

      // verify no changes were made to the user group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: true,
          admins: true,
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.admins.length).toBe(1)
      expect(updatedGroup!.admins[0]?.id).toBe(userTwo.id)
      expect(updatedGroup!.members.length).toBe(1)
      expect(updatedGroup!.members[0]?.id).toBe(userThree.id)
    })

    it('Trying to demote a non-existing admin of the user group should fail gracefully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-existent Admin Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // try to demote a user who is not an admin
      const result = await demoteGroupAdminToMember(
        { groupId: group.id, adminId: userThree.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Trying to demote a user in a group that does not exist should fail gracefully', async () => {
      const result = await demoteGroupAdminToMember(
        { groupId: 99999, adminId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Verify that the group owner can remove regular members and admins from the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Remove Member Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // owner removes the member
      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(true)

      // owner removes the admin
      const resultAdmin = await removeUserFromGroup(
        { groupId: group.id, userId: userThree.id },
        userOneCtx
      )
      expect(resultAdmin).toBe(true)

      // verify that both users were removed from the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(0)
      expect(updatedGroup?.admins.length).toBe(0)

      // verify that a correct audit log entry has been created
      const auditLogEntry = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_USER_REMOVED,
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLogEntry).toBeTruthy()
      expect(auditLogEntry!.message).toBe(`User removed from group.`)
    })

    it('Verify that group admins are able to remove regular and admin members from the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Admin Removes Member Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
          members: {
            connect: [{ id: userFour.id }],
          },
        },
      })

      // admin removes the regular member
      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userFour.id },
        userTwoCtx
      )
      expect(result).toBe(true)

      // admin removes the other admin
      const resultAdmin = await removeUserFromGroup(
        { groupId: group.id, userId: userThree.id },
        userTwoCtx
      )
      expect(resultAdmin).toBe(true)

      // Verify the member was removed from the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userFour.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(0)
      expect(updatedGroup?.admins.length).toBe(0)
    })

    it('Verify that regular members cannot remove other members from the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Member Cannot Remove Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
          members: {
            connect: [{ id: userThree.id }, { id: userFour.id }],
          },
        },
      })

      // regular member tries to remove another member
      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userFour.id },
        userThreeCtx
      )
      expect(result).toBe(false)

      // regular member tries to remove admin from the group
      const resultAdmin = await removeUserFromGroup(
        { groupId: group.id, userId: userTwo.id },
        userThreeCtx
      )
      expect(resultAdmin).toBe(false)

      // verify no changes were made to the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: true,
          admins: true,
        },
      })
      expect(updatedGroup?.members.length).toBe(2)
      expect(updatedGroup?.admins.length).toBe(1)
    })

    it('Users should not be able to remove themselves using the user removal function', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Self Remove Test Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // User tries to remove themselves
      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userTwo.id },
        userTwoCtx
      )
      expect(result).toBe(false)

      // verify no changes were made
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(1)
    })

    it('Trying to remove a non-existent user from a group should fail gracefully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-existent User Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userThree.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Trying to remove a user from a non-existent group should fail gracefully', async () => {
      const result = await removeUserFromGroup(
        { groupId: 99999, userId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('When a user is removed from a group, their permissions granted through the group should be revoked', async () => {
      // create a group with two members
      const group = await prisma.userGroup.create({
        data: {
          name: 'Permission Revocation Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
        },
      })

      // create an answer collection and grant permissions to the group
      const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          answerCollectionId: AC1!.id,
        },
      })
      await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

      // create an element using the second answer collection and grant permissions to the group
      const element = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          name: 'Element',
          content: 'Content',
          options: {},
          ownerId: userOne.id,
          answerCollectionId: AC2!.id,
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          elementId: element.id,
        },
      })
      await recomputeDerivedPermissions({ elementId: element.id }, prisma)

      // verify that derived permissions on AC1 were created for both users
      const derivedPermission1 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission1).toBeTruthy()
      expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission1!.derived).toBe(false)

      const derivedPermission2 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission2).toBeTruthy()
      expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission2!.derived).toBe(false)

      // verify that derived permissions on AC2 were created for both users (derived from element)
      const derivedPermission3 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission3).toBeTruthy()
      expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission3!.derived).toBe(true)

      const derivedPermission4 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userThree.id,
          },
        },
      })
      expect(derivedPermission4).toBeTruthy()
      expect(derivedPermission4!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission4!.derived).toBe(true)

      // remove one user from the group
      const result = await removeUserFromGroup(
        { groupId: group.id, userId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(true)

      // verify that user two no longer has the derived permission
      const updatedDerivedPermission1 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC1!.id,
              userId: userTwo.id,
            },
          },
        })
      expect(updatedDerivedPermission1).toBeNull()

      const updatedDerivedPermission3 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC2!.id,
              userId: userTwo.id,
            },
          },
        })
      expect(updatedDerivedPermission3).toBeNull()

      // verify that user three still has the derived permission
      const persistentDerivedPermission2 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC1!.id,
              userId: userThree.id,
            },
          },
        })
      expect(persistentDerivedPermission2).toBeTruthy()
      expect(persistentDerivedPermission2!.permissionLevel).toBe(
        PermissionLevel.WRITE
      )
      expect(persistentDerivedPermission2!.derived).toBe(false)

      const persistentDerivedPermission4 =
        await prisma.derivedPermission.findUnique({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: AC2!.id,
              userId: userThree.id,
            },
          },
        })
      expect(persistentDerivedPermission4).toBeTruthy()
      expect(persistentDerivedPermission4!.permissionLevel).toBe(
        PermissionLevel.READ
      )
      expect(persistentDerivedPermission4!.derived).toBe(true)
    })

    it('Verify that group owners and admins can update the user group name, regular users cannot', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Original Group Name',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
          admins: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // owner changes the group name
      const newName = 'Updated Group Name'
      const result = await changeUserGroupName(
        { id: group.id, name: newName },
        userOneCtx
      )
      expect(result).toBe(true)

      // verify the group name was updated
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroup?.name).toBe(newName)

      // verify that an appropriate audit log entry has been created
      const auditLogEntry = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_MODIFIED,
          sourceUserId: userOne.id,
        },
      })
      expect(auditLogEntry).toBeTruthy()
      expect(auditLogEntry!.message).toBe(
        `User group name changed to ${newName}.`
      )

      // admin changes the group name
      const newNameAdmin = 'Updated Group Name by Admin'
      const resultAdmin = await changeUserGroupName(
        { id: group.id, name: newNameAdmin },
        userThreeCtx
      )
      expect(resultAdmin).toBe(true)

      // verify the group name was updated
      const updatedGroupAdmin = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroupAdmin?.name).toBe(newNameAdmin)

      // verify that an appropriate audit log entry has been created
      const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
        where: {
          objectId: String(group.id),
          objectType: ObjectType.USER_GROUP,
          type: AuditLogType.USER_GROUP_MODIFIED,
          sourceUserId: userThree.id,
        },
      })
      expect(auditLogEntry2).toBeTruthy()
      expect(auditLogEntry2!.message).toBe(
        `User group name changed to ${newNameAdmin}.`
      )

      // regular member tries to change the group name
      const newNameMember = 'Updated Group Name by Member'
      const resultMember = await changeUserGroupName(
        { id: group.id, name: newNameMember },
        userTwoCtx
      )
      expect(resultMember).toBe(false)

      // verify the group name was not updated
      const updatedGroupMember = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroupMember?.name).toBe(newNameAdmin)

      // non-member tries to change the group name
      const newNameNonMember = 'Updated Group Name by Non-Member'
      const resultNonMember = await changeUserGroupName(
        { id: group.id, name: newNameNonMember },
        userFourCtx
      )
      expect(resultNonMember).toBe(false)

      // verify the group name was not updated
      const updatedGroupNonMember = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroupNonMember?.name).toBe(newNameAdmin)
    })

    it('Verify that trying to update the name of a non-existent group fails gracefully', async () => {
      const result = await changeUserGroupName(
        { id: 99999, name: 'New Name' },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Test the successful transfer of a user group ownership from owner to admin', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Transfer Ownership Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // transfer ownership to the admin
      const result = await transferGroupOwnership(
        { id: group.id, newOwnerId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(true)

      // verify the group ownership was updated
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          admins: true,
        },
      })
      expect(updatedGroup?.ownerId).toBe(userTwo.id)

      // verify that the previous owner is now an admin and that the previous admin was removed
      const admins = updatedGroup?.admins.map((admin) => admin.id) || []
      expect(admins).toContain(userOne.id)
      expect(admins).not.toContain(userTwo.id)

      // verify that a correct audit log entry has been created
      const auditLogEntry = await prisma.auditLogEntry.findFirst({
        where: {
          type: AuditLogType.USER_GROUP_MODIFIED,
          objectType: ObjectType.USER_GROUP,
          objectId: String(updatedGroup!.id),
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLogEntry).toBeTruthy()
      expect(auditLogEntry!.message).toBe(
        `User group ownership transferred to group admin.`
      )
    })

    it('Verify that uniqueness constraints on the user group name are resolved gracefully', async () => {
      // create three user groups owned by users 1, 2, and 3 respectively
      const groupName = 'Unique Group Name'
      const group1 = await prisma.userGroup.create({
        data: {
          name: groupName,
          ownerId: userOne.id,
        },
      })
      const group2 = await prisma.userGroup.create({
        data: {
          name: groupName,
          ownerId: userTwo.id,
          admins: {
            connect: [{ id: userOne.id }],
          },
        },
      })
      const group3 = await prisma.userGroup.create({
        data: {
          name: groupName,
          ownerId: userThree.id,
          admins: {
            connect: [{ id: userOne.id }],
          },
        },
      })

      // transfer the ownership of the second group to user 1
      const result = await transferGroupOwnership(
        { id: group2.id, newOwnerId: userOne.id },
        userTwoCtx
      )
      expect(result).toBe(true)

      // verify that the ownership was updated and the name extended with a version number
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group2.id },
      })
      expect(updatedGroup?.ownerId).toBe(userOne.id)
      expect(updatedGroup?.name).toBe(`${groupName} (1)`)

      // verify that the first group name remains unchanged
      const originalGroup = await prisma.userGroup.findUnique({
        where: { id: group1.id },
      })
      expect(originalGroup?.name).toBe(groupName)
      expect(originalGroup?.ownerId).toBe(userOne.id)

      // transfer the ownership of the third group to user 1
      const result2 = await transferGroupOwnership(
        { id: group3.id, newOwnerId: userOne.id },
        userThreeCtx
      )
      expect(result2).toBe(true)

      // verify that the ownership was updated and the name extended with a version number
      const updatedGroup2 = await prisma.userGroup.findUnique({
        where: { id: group3.id },
      })
      expect(updatedGroup2?.ownerId).toBe(userOne.id)
      expect(updatedGroup2?.name).toBe(`${groupName} (2)`)

      // verify that the second group name remains unchanged
      const originalGroup2 = await prisma.userGroup.findUnique({
        where: { id: group2.id },
      })
      expect(originalGroup2?.name).toBe(`${groupName} (1)`)
      expect(originalGroup2?.ownerId).toBe(userOne.id)

      // verify that the first group name remains unchanged
      const originalGroup3 = await prisma.userGroup.findUnique({
        where: { id: group1.id },
      })
      expect(originalGroup3?.name).toBe(groupName)
      expect(originalGroup3?.ownerId).toBe(userOne.id)
    })

    it('Admins and regular members should not be allowed to trigger ownership transfer', async () => {
      // Create a group with two admins
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-owner Transfer Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }, { id: userThree.id }],
          },
          members: {
            connect: [{ id: userFour.id }],
          },
        },
      })

      // admin tries to transfer ownership
      const result = await transferGroupOwnership(
        { id: group.id, newOwnerId: userThree.id },
        userTwoCtx
      )
      expect(result).toBe(false)

      // verify the group ownership was not changed
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroup?.ownerId).toBe(userOne.id)

      // regular member tries to transfer ownership
      const resultMember = await transferGroupOwnership(
        { id: group.id, newOwnerId: userFour.id },
        userFourCtx
      )
      expect(resultMember).toBe(false)

      // verify the group ownership was not changed
      const updatedGroupMember = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroupMember?.ownerId).toBe(userOne.id)
    })

    it('Verify that the ownership cannot be transferred to a regular user or a non-member', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Transfer To Member Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
          members: {
            connect: [{ id: userThree.id }],
          },
        },
      })

      // owner tries to transfer ownership to regular member
      const result = await transferGroupOwnership(
        { id: group.id, newOwnerId: userThree.id },
        userOneCtx
      )
      expect(result).toBe(false)

      // verify the group ownership was not changed
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroup?.ownerId).toBe(userOne.id)

      // owner tries to transfer ownership to non-member
      const resultNonMember = await transferGroupOwnership(
        { id: group.id, newOwnerId: userFour.id },
        userOneCtx
      )
      expect(resultNonMember).toBe(false)

      // verify the group ownership was not changed
      const updatedGroupNonMember = await prisma.userGroup.findUnique({
        where: { id: group.id },
      })
      expect(updatedGroupNonMember?.ownerId).toBe(userOne.id)
    })

    it('Verify that trying to transfer the ownership of a non-existent group should fail gracefully', async () => {
      const result = await transferGroupOwnership(
        { id: 99999, newOwnerId: userTwo.id },
        userOneCtx
      )
      expect(result).toBe(false)
    })

    it('Verify that group owner can add a user as a regular or admin member', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Add Member Test Group',
          ownerId: userOne.id,
        },
      })

      // owner adds a new user as a regular member
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userTwo.shortname,
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeTruthy()
      expect(result?.id).toBe(userTwo.id)
      expect(result?.shortname).toBe(userTwo.shortname)
      expect(result?.email).toBe(userTwo.email)
      expect(result?.isSelf).toBe(false)

      // verify the user was added to the group as a member
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(1)
      expect(updatedGroup?.members[0]?.id).toBe(userTwo.id)
      expect(updatedGroup?.admins.length).toBe(0)

      // verify that a correct audit log entry has been created
      const auditLogEntry1 = await prisma.auditLogEntry.findFirst({
        where: {
          type: AuditLogType.USER_GROUP_USER_ADDED,
          objectType: ObjectType.USER_GROUP,
          objectId: String(updatedGroup!.id),
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
      expect(auditLogEntry1).toBeTruthy()
      expect(auditLogEntry1!.message).toBe(`New user added to group as member.`)

      // owner adds another user as an admin
      const resultAdmin = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userThree.shortname,
          asAdmin: true,
        },
        userOneCtx
      )
      expect(resultAdmin).toBeTruthy()
      expect(resultAdmin?.id).toBe(userThree.id)
      expect(resultAdmin?.shortname).toBe(userThree.shortname)
      expect(resultAdmin?.email).toBe(userThree.email)

      // verify the user was added to the group as an admin
      const updatedGroupAdmin = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userThree.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroupAdmin?.members.length).toBe(0)
      expect(updatedGroupAdmin?.admins.length).toBe(1)
      expect(updatedGroupAdmin?.admins[0]?.id).toBe(userThree.id)

      // verify that a correct audit log entry has been created
      const auditLogEntry2 = await prisma.auditLogEntry.findFirst({
        where: {
          type: AuditLogType.USER_GROUP_USER_ADDED,
          objectType: ObjectType.USER_GROUP,
          objectId: String(updatedGroupAdmin!.id),
          sourceUserId: userOne.id,
          targetUserId: userThree.id,
        },
      })
      expect(auditLogEntry2).toBeTruthy()
      expect(auditLogEntry2!.message).toBe(`New user added to group as admin.`)
    })

    it('Verify that group admins are able to add regular users and admins to the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Admin Adding Test Group',
          ownerId: userOne.id,
          admins: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // admin adds a new user as a regular member
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userThree.shortname,
          asAdmin: false,
        },
        userTwoCtx
      )
      expect(result).toBeTruthy()
      expect(result?.id).toBe(userThree.id)
      expect(result?.shortname).toBe(userThree.shortname)

      // verify the user was added to the group as a member
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userThree.id } },
          admins: { where: { id: userThree.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(1)
      expect(updatedGroup?.members[0]?.id).toBe(userThree.id)
      expect(updatedGroup?.admins.length).toBe(0)

      // admin adds another user as an admin
      const resultAdmin = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userFour.shortname,
          asAdmin: true,
        },
        userTwoCtx
      )
      expect(resultAdmin).toBeTruthy()
      expect(resultAdmin?.id).toBe(userFour.id)
      expect(resultAdmin?.shortname).toBe(userFour.shortname)
      expect(resultAdmin?.email).toBe(userFour.email)
      expect(resultAdmin?.isSelf).toBe(false)

      // verify the user was added to the group as an admin
      const updatedGroupAdmin = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userFour.id } },
          admins: { where: { id: userFour.id } },
        },
      })
      expect(updatedGroupAdmin?.members.length).toBe(0)
      expect(updatedGroupAdmin?.admins.length).toBe(1)
      expect(updatedGroupAdmin?.admins[0]?.id).toBe(userFour.id)
    })

    it('Regular members should not be able to add other users to the group', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Member Cannot Add Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // regular member tries to add another user
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userThree.shortname,
          asAdmin: false,
        },
        userTwoCtx
      )
      expect(result).toBeNull()

      // verify no changes were made to the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: true,
        },
      })
      expect(updatedGroup?.members.length).toBe(1)
      expect(updatedGroup?.members[0]?.id).toBe(userTwo.id)
    })

    it('Verify that users can also be added to the group with their email address', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Add By Email Group',
          ownerId: userOne.id,
        },
      })

      // add a user using their email address
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userTwo.email,
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeTruthy()
      expect(result?.id).toBe(userTwo.id)
      expect(result?.email).toBe(userTwo.email)

      // verify the user was added to the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup?.members.length).toBe(1)
      expect(updatedGroup?.members[0]?.id).toBe(userTwo.id)
      expect(updatedGroup?.admins.length).toBe(0)
    })

    it('Verify that trying to add a non-existent user fails gracefully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Non-existent User Add Group',
          ownerId: userOne.id,
        },
      })

      // try to add a non-existent user
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: 'nonexistent-user',
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeNull()

      // verify no changes were made to the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: true,
          admins: true,
        },
      })
      expect(updatedGroup?.members.length).toBe(0)
      expect(updatedGroup?.admins.length).toBe(0)
    })

    it('Verify that trying to add a user to a non-existent group fails gracefully', async () => {
      const result = await addUserToUserGroup(
        {
          groupId: 99999,
          shortnameOrEmail: userTwo.shortname,
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeNull()
    })

    it('Verify that adding a user who is already a member of the group fails gracefully', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Duplicate Member Group',
          ownerId: userOne.id,
          members: {
            connect: [{ id: userTwo.id }],
          },
        },
      })

      // try to add the same user again
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userTwo.shortname,
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeNull()

      // verify no changes were made to the group
      const updatedGroup = await prisma.userGroup.findUnique({
        where: { id: group.id },
        include: {
          members: { where: { id: userTwo.id } },
          admins: { where: { id: userTwo.id } },
        },
      })
      expect(updatedGroup).toBeTruthy()
      expect(updatedGroup!.members.length).toBe(1)
      expect(updatedGroup!.members[0]?.id).toBe(userTwo.id)
      expect(updatedGroup!.admins.length).toBe(0)
    })

    it('Verify that the correct derived permissions are created for the new group member on addition', async () => {
      const group = await prisma.userGroup.create({
        data: {
          name: 'Permission Inheritance Group',
          ownerId: userOne.id,
        },
      })

      // create an answer collection and grant permissions to the group
      const { AC1, AC2 } = await seedAnswerCollections(userOneCtx)
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.WRITE,
          userGroupId: group.id,
          answerCollectionId: AC1!.id,
        },
      })
      await recomputeDerivedPermissions({ answerCollectionId: AC1!.id }, prisma)

      // create an element using the second answer collection and grant permissions to the group
      const element = await prisma.element.create({
        data: {
          type: ElementType.SELECTION,
          name: 'Element',
          content: 'Content',
          options: {},
          ownerId: userOne.id,
          answerCollectionId: AC2!.id,
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.ADMIN,
          userGroupId: group.id,
          elementId: element.id,
        },
      })
      await recomputeDerivedPermissions({ elementId: element.id }, prisma)

      // add a new user to the group
      const result = await addUserToUserGroup(
        {
          groupId: group.id,
          shortnameOrEmail: userTwo.shortname,
          asAdmin: false,
        },
        userOneCtx
      )
      expect(result).toBeTruthy()
      expect(result?.id).toBe(userTwo.id)
      expect(result?.shortname).toBe(userTwo.shortname)
      expect(result?.email).toBe(userTwo.email)

      // verify that the user was granted the correct derived permissions
      const derivedPermission1 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC1!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission1).toBeTruthy()
      expect(derivedPermission1!.permissionLevel).toBe(PermissionLevel.WRITE)
      expect(derivedPermission1!.derived).toBe(false)

      const derivedPermission2 = await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: element.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission2).toBeTruthy()
      expect(derivedPermission2!.permissionLevel).toBe(PermissionLevel.ADMIN)
      expect(derivedPermission2!.derived).toBe(false)

      const derivedPermission3 = await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: AC2!.id,
            userId: userTwo.id,
          },
        },
      })
      expect(derivedPermission3).toBeTruthy()
      expect(derivedPermission3!.permissionLevel).toBe(PermissionLevel.READ)
      expect(derivedPermission3!.derived).toBe(true)
    })

    it('emits exact assessment permission evidence when group membership changes', async () => {
      const liveQuizId = randomUUID()
      const group = await prisma.userGroup.create({
        data: {
          name: 'Assessment Permission Evidence Group',
          ownerId: userOne.id,
        },
      })
      await prisma.liveQuiz.create({
        data: {
          id: liveQuizId,
          name: 'Assessment permission evidence quiz',
          displayName: 'Assessment permission evidence quiz',
          ownerId: userOne.id,
          isAssessmentEnabled: true,
        },
      })
      await prisma.permission.create({
        data: {
          permissionLevel: PermissionLevel.EXECUTE,
          userGroupId: group.id,
          liveQuizId,
        },
      })
      await prisma.assessmentAuditScope.create({
        data: {
          liveQuizId,
          lifecycleEpoch: 1,
          coverageState: 'COVERED',
        },
      })
      await recomputeDerivedPermissions({ liveQuizId }, prisma)

      try {
        await addUserToUserGroup(
          {
            groupId: group.id,
            shortnameOrEmail: userTwo.shortname,
          },
          userOneCtx
        )
        const grant = await prisma.assessmentAuditOutboxEvent.findFirst({
          where: {
            liveQuizId,
            eventType: 'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
          },
        })
        expect(grant).not.toBeNull()
        expect(
          parseCanonicalAuditEnvelope(grant!.canonicalEnvelope).payload
        ).toMatchObject({
          subjectType: 'USER',
          subjectId: userTwo.id,
          change: 'GRANTED',
          permission: 'EXECUTE',
          reasonCode: 'EFFECTIVE_LECTURER_PERMISSION_MUTATION',
        })

        await leaveUserGroup({ groupId: group.id }, userTwoCtx)
        const revoke = await prisma.assessmentAuditOutboxEvent.findFirst({
          where: {
            liveQuizId,
            eventType: 'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
            eventId: { not: grant!.eventId },
          },
        })
        expect(revoke).not.toBeNull()
        expect(
          parseCanonicalAuditEnvelope(revoke!.canonicalEnvelope).payload
        ).toMatchObject({
          subjectType: 'USER',
          subjectId: userTwo.id,
          change: 'REVOKED',
          permission: 'EXECUTE',
          reasonCode: 'EFFECTIVE_LECTURER_PERMISSION_MUTATION',
        })
      } finally {
        await prisma.assessmentAuditOutboxEvent.deleteMany({
          where: { liveQuizId },
        })
        await prisma.assessmentAuditScope.deleteMany({
          where: { liveQuizId },
        })
        await prisma.permission.deleteMany({ where: { liveQuizId } })
        await prisma.liveQuiz.delete({ where: { id: liveQuizId } })
        await prisma.userGroup.delete({ where: { id: group.id } })
      }
    })
  })
})
