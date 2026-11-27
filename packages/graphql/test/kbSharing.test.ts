import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ObjectType,
  PermissionLevel,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { getPositiveObjectPermission } from '@klicker-uzh/util'
import type { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  changeObjectPermissionLevel,
  checkAccess,
  createUserGroup,
  deleteUserGroup,
  getKnowledgeBasePermissions,
  getObjectPermissionRemovalPreview,
  removeUserFromGroup,
  revokeObjectAccess,
  shareObject,
} from '../src/services/sharing.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userOne, userThree, userTwo } from './userData.js'

describe('Knowledge base and chatbot sharing permissions', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  function createKnowledgeBase(ctx: ContextWithUser, name: string) {
    return prisma.kB.create({ data: { name, ownerId: ctx.user.sub } })
  }

  it('shares direct and group read, write, and admin grants', async () => {
    const kb = await createKnowledgeBase(userOneCtx, 'Sharing permissions KB')
    const group = await createUserGroup(
      {
        name: 'KB collaboration group',
        members: [
          { shortnameOrEmail: userTwo.shortname },
          { shortnameOrEmail: userThree.shortname },
        ],
      },
      userOneCtx
    )

    await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        propagation: false,
      },
      userOneCtx
    )
    const groupPermission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group!.id,
        propagation: false,
      },
      userOneCtx
    )

    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userTwo.id },
        prisma
      )
    ).toBe(PermissionLevel.ADMIN)
    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userThree.id },
        prisma
      )
    ).toBe(PermissionLevel.ADMIN)

    const derived = await prisma.derivedPermission.findUnique({
      where: { kbId_userId: { kbId: kb.id, userId: userThree.id } },
    })
    expect(derived?.permissionLevel).toBe(PermissionLevel.ADMIN)

    const listed = await getKnowledgeBasePermissions({ id: kb.id }, userOneCtx)
    expect(listed.ownerPermission?.permissionLevel).toBe(PermissionLevel.OWNER)
    expect(listed.permissions).toHaveLength(2)

    expect(
      await changeObjectPermissionLevel(
        {
          permissionId: groupPermission!.permissionId,
          permissionLevel: PermissionLevel.WRITE,
          propagation: false,
          kbId: kb.id,
        },
        userOneCtx
      )
    ).toBe(true)
    expect(
      await prisma.derivedPermission.findUnique({
        where: { kbId_userId: { kbId: kb.id, userId: userThree.id } },
      })
    ).toMatchObject({ permissionLevel: PermissionLevel.WRITE })
  })

  it('previews and preserves the highest overlapping grant on revocation', async () => {
    const kb = await createKnowledgeBase(userOneCtx, 'Overlapping grants KB')
    const group = await createUserGroup(
      {
        name: 'Overlapping grants group',
        members: [{ shortnameOrEmail: userTwo.shortname }],
      },
      userOneCtx
    )
    const directPermission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        propagation: false,
      },
      userOneCtx
    )
    const groupPermission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group!.id,
        propagation: false,
      },
      userOneCtx
    )

    expect(
      await getObjectPermissionRemovalPreview(
        { permissionId: directPermission!.permissionId, kbId: kb.id },
        userOneCtx
      )
    ).toEqual({
      permissionId: directPermission!.permissionId,
      readSurvives: true,
    })
    expect(
      await getObjectPermissionRemovalPreview(
        { permissionId: groupPermission!.permissionId, kbId: kb.id },
        userOneCtx
      )
    ).toEqual({
      permissionId: groupPermission!.permissionId,
      readSurvives: null,
    })

    await revokeObjectAccess(
      { permissionId: directPermission!.permissionId, kbId: kb.id },
      userOneCtx
    )
    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userTwo.id },
        prisma
      )
    ).toBe(PermissionLevel.WRITE)

    await revokeObjectAccess(
      { permissionId: groupPermission!.permissionId, kbId: kb.id },
      userOneCtx
    )
    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userTwo.id },
        prisma
      )
    ).toBeNull()
    expect(
      await prisma.derivedPermission.findUnique({
        where: { kbId_userId: { kbId: kb.id, userId: userTwo.id } },
      })
    ).toBeNull()
  })

  it('recomputes grants when a group member leaves and when a group is deleted', async () => {
    const kb = await createKnowledgeBase(userOneCtx, 'Group lifecycle KB')
    const group = await createUserGroup(
      {
        name: 'Lifecycle group',
        members: [{ shortnameOrEmail: userTwo.shortname }],
      },
      userOneCtx
    )
    await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        userGroupId: group!.id,
        propagation: false,
      },
      userOneCtx
    )

    await removeUserFromGroup(
      { groupId: group!.id, userId: userTwo.id },
      userOneCtx
    )
    expect(
      await prisma.derivedPermission.findUnique({
        where: { kbId_userId: { kbId: kb.id, userId: userTwo.id } },
      })
    ).toBeNull()

    await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        userGroupId: group!.id,
        propagation: false,
      },
      userOneCtx
    )
    await deleteUserGroup({ groupId: group!.id }, userOneCtx)
    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userTwo.id },
        prisma
      )
    ).toBeNull()
  })

  it('denies unsupported levels and cross-object permission edits', async () => {
    const kb = await createKnowledgeBase(userOneCtx, 'Permission bounds KB')
    const otherKb = await createKnowledgeBase(userOneCtx, 'Other permission KB')

    expect(
      await shareObject(
        {
          kbId: kb.id,
          permissionLevel: PermissionLevel.OWNER,
          shortnameOrEmail: userTwo.shortname,
          propagation: false,
        },
        userOneCtx
      )
    ).toBeNull()
    expect(
      await shareObject(
        {
          kbId: kb.id,
          permissionLevel: PermissionLevel.EXECUTE,
          shortnameOrEmail: userTwo.shortname,
          propagation: false,
        },
        userOneCtx
      )
    ).toBeNull()
    expect(
      await shareObject(
        {
          kbId: kb.id,
          permissionLevel: PermissionLevel.READ,
          shortnameOrEmail: userTwo.shortname,
          propagation: true,
        },
        userOneCtx
      )
    ).toBeNull()

    const permission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        propagation: false,
      },
      userOneCtx
    )
    expect(
      await changeObjectPermissionLevel(
        {
          permissionId: permission!.permissionId,
          permissionLevel: PermissionLevel.WRITE,
          propagation: false,
          kbId: otherKb.id,
        },
        userOneCtx
      )
    ).toBe(false)
    expect(
      await revokeObjectAccess(
        { permissionId: permission!.permissionId, kbId: otherKb.id },
        userOneCtx
      )
    ).toBeNull()
    expect(
      await changeObjectPermissionLevel(
        {
          permissionId: permission!.permissionId,
          permissionLevel: PermissionLevel.EXECUTE,
          propagation: false,
          kbId: kb.id,
        },
        userOneCtx
      )
    ).toBe(false)
  })

  it('denies non-admin callers and unavailable deleted knowledge bases', async () => {
    const kb = await createKnowledgeBase(userOneCtx, 'Authorization KB')
    const permission = await shareObject(
      {
        kbId: kb.id,
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
        propagation: false,
      },
      userOneCtx
    )

    expect(
      await shareObject(
        {
          kbId: kb.id,
          permissionLevel: PermissionLevel.READ,
          shortnameOrEmail: userThree.shortname,
          propagation: false,
        },
        userTwoCtx
      )
    ).toBeNull()
    expect(
      await revokeObjectAccess(
        { permissionId: permission!.permissionId, kbId: kb.id },
        userTwoCtx
      )
    ).toBeNull()
    expect(
      await checkAccess(
        [
          {
            kbId: kb.id,
            minimumPermissionLevel: PermissionLevel.ADMIN,
          },
        ],
        userTwoCtx
      )
    ).toBe(false)

    await prisma.kB.update({
      data: { deletedAt: new Date() },
      where: { id: kb.id },
    })
    expect(
      await getPositiveObjectPermission(
        { objectType: ObjectType.KB, objectId: kb.id, userId: userOne.id },
        prisma
      )
    ).toBeNull()
  })

  it('grants, changes and revokes chatbot access through object sharing', async () => {
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Generic permission chatbot',
        courseId: course.id,
        ownerId: userOne.id,
        systemPrompts: {
          tutor: { prompt: 'Tutor prompt', description: 'Tutor' },
          explainer: { prompt: 'Explainer prompt', description: 'Explainer' },
        },
      },
    })
    const grant = await shareObject(
      {
        chatbotId: chatbot.id,
        shortnameOrEmail: userTwo.shortname,
        permissionLevel: PermissionLevel.READ,
        propagation: false,
      },
      userOneCtx
    )
    expect(grant?.permissionId).toBeGreaterThan(0)
    const effective = () =>
      getPositiveObjectPermission(
        {
          objectType: ObjectType.CHATBOT,
          objectId: chatbot.id,
          userId: userTwo.id,
        },
        prisma
      )
    expect(await effective()).toBe(PermissionLevel.READ)
    await changeObjectPermissionLevel(
      {
        chatbotId: chatbot.id,
        permissionId: grant!.permissionId,
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      },
      userOneCtx
    )
    expect(await effective()).toBe(PermissionLevel.WRITE)
    await revokeObjectAccess(
      { chatbotId: chatbot.id, permissionId: grant!.permissionId },
      userOneCtx
    )
    expect(await effective()).toBeNull()
  })
})
