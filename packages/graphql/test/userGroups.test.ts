import { PrismaClient } from '@klicker-uzh/prisma'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { createUserGroup } from '../src/services/sharing.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFour, userOne, userThree, userTwo } from './userData.js'

describe('Unit tests for user group management', () => {
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

  describe('Unit tests for user group creation and manipulation', () => {
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
      expect(result).toBeDefined()
      expect(result.name).toBe(groupName)
      expect(result.members.length).toBe(2)
      expect(result.admins.length).toBe(0)
      expect(result.numOfMembers).toBe(3) // 2 members + owner

      // verify that members are correctly assigned
      const memberIds = result.members.map((member) => member.id)
      expect(memberIds).toContain(userTwo.id)
      expect(memberIds).toContain(userThree.id)
    })

    test('Providing members and admins should result in a successful group creation and correct links', async () => {
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
      expect(result).toBeDefined()
      expect(result.name).toBe(groupName)
      expect(result.members.length).toBe(1)
      expect(result.admins.length).toBe(2)
      expect(result.numOfMembers).toBe(4) // 1 member + 2 admins + owner

      // verify that members are correctly assigned to the right roles
      const memberIds = result.members.map((member) => member.id)
      const adminIds = result.admins.map((admin) => admin.id)
      expect(memberIds).toContain(userTwo.id)
      expect(adminIds).toContain(userThree.id)
      expect(adminIds).toContain(userFour.id)
    })

    test('Test that the creation of a ', async () => {
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
      await expect(
        createUserGroup(
          {
            name: groupName,
            members: [{ shortnameOrEmail: userThree.email, isAdmin: false }],
          },
          userOneCtx
        )
      ).rejects.toThrow('User group with this name already exists')
    })

    test('User group creation should fail if no valid members were found', async () => {
      await expect(
        createUserGroup(
          {
            name: 'Empty Group',
            members: [{ shortnameOrEmail: 'nonexistent', isAdmin: false }],
          },
          userOneCtx
        )
      ).rejects.toThrow('No members found')
    })

    test('User group creation should success if at least one valid member was provided, other users should be ignored', async () => {
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
      expect(result).toBeDefined()
      expect(result.name).toBe(groupName)
      expect(result.members.length).toBe(1)
      expect(result.members[0]!.id).toBe(userTwo.id)
    })

    test('Duplicate members and the owner should be filtered from the member / admin lists', async () => {
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
      expect(result).toBeDefined()
      expect(result.members.length).toBe(1)
      expect(result.members[0]!.id).toBe(userTwo.id)
      expect(result.admins.length).toBe(1)
      expect(result.admins[0]!.id).toBe(userThree.id)

      // owner should not appear in members list
      const memberIds = result.members.map((member) => member.id)
      expect(memberIds).not.toContain(userOneCtx.user.sub)
    })
  })
})
