import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AuditLogType,
  ElementType,
  ObjectType,
  PermissionLevel,
  type PrismaClient,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { GraphQLObjectType } from 'graphql'
import { createYoga } from 'graphql-yoga'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  ELEMENT_BATCH_SHARING_MAX_ELEMENTS,
  shareElementsBatch,
  shareObject,
} from '../src/services/sharing.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userOne, userThree, userTwo } from './userData.js'

describe('Integration tests for batch sharing elements', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

  async function seedElement({
    ownerId = userOne.id,
    callerPermissionLevel,
    isDeleted = false,
  }: {
    ownerId?: string
    callerPermissionLevel?: PermissionLevel
    isDeleted?: boolean
  } = {}) {
    const element = await prisma.element.create({
      data: {
        name: `Batch sharing ${Math.random()}`,
        content: 'Content',
        type: ElementType.SC,
        options: {},
        ownerId,
        isDeleted,
        directPermissions: callerPermissionLevel
          ? {
              create: {
                userId: userOne.id,
                permissionLevel: callerPermissionLevel,
              },
            }
          : undefined,
      },
    })

    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    return element
  }

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    emitter = initialized.emitter
    hatchet = initialized.hatchet
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await testCleanup(prisma)
  })

  it('rejects an unknown individual target before processing elements', async () => {
    const result = await shareElementsBatch(
      {
        elementIds: [1, 2],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: 'unknown-user',
      },
      userOneCtx
    )

    expect(result).toEqual({
      targetError: 'INVALID_OR_SELF_TARGET',
      outcomes: [],
    })
    expect(await prisma.permission.count()).toBe(0)
  })

  it('rejects an oversized raw list before resolving the target', async () => {
    const findUserSpy = vi.spyOn(userOneCtx.prisma.user, 'findFirst')

    await expect(
      shareElementsBatch(
        {
          elementIds: Array.from(
            { length: ELEMENT_BATCH_SHARING_MAX_ELEMENTS + 1 },
            () => 1
          ),
          permissionLevel: PermissionLevel.READ,
          shortnameOrEmail: 'unknown-user',
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ELEMENT_BATCH_TOO_LARGE' },
    })

    expect(findUserSpy).not.toHaveBeenCalled()
    expect(await prisma.permission.count()).toBe(0)
  })

  it.each([
    PermissionLevel.OWNER,
    PermissionLevel.EXECUTE,
  ])('rejects unsupported permission level %s before resolving the target', async (permissionLevel) => {
    const findUserSpy = vi.spyOn(userOneCtx.prisma.user, 'findFirst')

    await expect(
      shareElementsBatch(
        {
          elementIds: [1],
          permissionLevel,
          shortnameOrEmail: 'unknown-user',
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ELEMENT_BATCH_PERMISSION_INVALID' },
    })

    expect(findUserSpy).not.toHaveBeenCalled()
    expect(await prisma.permission.count()).toBe(0)
  })

  it('returns generic target errors for invalid or unavailable targets', async () => {
    const element = await seedElement()
    const unavailableGroup = await prisma.userGroup.create({
      data: { name: 'Unavailable group', ownerId: userThree.id },
    })

    await expect(
      shareElementsBatch(
        {
          elementIds: [element.id],
          permissionLevel: PermissionLevel.READ,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      targetError: 'INVALID_OR_SELF_TARGET',
      outcomes: [],
    })
    await expect(
      shareElementsBatch(
        {
          elementIds: [element.id],
          permissionLevel: PermissionLevel.READ,
          shortnameOrEmail: userOne.shortname,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      targetError: 'INVALID_OR_SELF_TARGET',
      outcomes: [],
    })
    await expect(
      shareElementsBatch(
        {
          elementIds: [element.id],
          permissionLevel: PermissionLevel.READ,
          shortnameOrEmail: userTwo.shortname,
          userGroupId: unavailableGroup.id,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      targetError: 'INVALID_OR_SELF_TARGET',
      outcomes: [],
    })
    await expect(
      shareElementsBatch(
        {
          elementIds: [element.id],
          permissionLevel: PermissionLevel.READ,
          userGroupId: unavailableGroup.id,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      targetError: 'USER_GROUP_UNAVAILABLE',
      outcomes: [],
    })
    await expect(
      shareElementsBatch(
        {
          elementIds: [element.id],
          permissionLevel: PermissionLevel.READ,
          userGroupId: unavailableGroup.id + 10_000,
        },
        userOneCtx
      )
    ).resolves.toEqual({
      targetError: 'USER_GROUP_UNAVAILABLE',
      outcomes: [],
    })
    expect(await prisma.permission.count()).toBe(0)
  })

  it('accepts an accessible group for owners, admins, and members', async () => {
    const groups = await Promise.all([
      prisma.userGroup.create({
        data: { name: 'Owned group', ownerId: userOne.id },
      }),
      prisma.userGroup.create({
        data: {
          name: 'Administered group',
          ownerId: userThree.id,
          admins: { connect: { id: userOne.id } },
        },
      }),
      prisma.userGroup.create({
        data: {
          name: 'Member group',
          ownerId: userThree.id,
          members: { connect: { id: userOne.id } },
        },
      }),
    ])

    for (const group of groups) {
      const element = await seedElement()
      await expect(
        shareElementsBatch(
          {
            elementIds: [element.id],
            permissionLevel: PermissionLevel.READ,
            userGroupId: group.id,
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        targetError: null,
        outcomes: [{ elementId: element.id, status: 'SHARED' }],
      })
    }
  })

  it('deduplicates ids in first-seen order and maps eligibility outcomes', async () => {
    const ownerElement = await seedElement()
    const adminElement = await seedElement({
      ownerId: userThree.id,
      callerPermissionLevel: PermissionLevel.ADMIN,
    })
    const readElement = await seedElement({
      ownerId: userThree.id,
      callerPermissionLevel: PermissionLevel.READ,
    })
    const deletedElement = await seedElement({ isDeleted: true })
    const missingId = deletedElement.id + 10_000

    const result = await shareElementsBatch(
      {
        elementIds: [
          adminElement.id,
          ownerElement.id,
          adminElement.id,
          readElement.id,
          deletedElement.id,
          missingId,
        ],
        permissionLevel: PermissionLevel.WRITE,
        shortnameOrEmail: userTwo.shortname,
      },
      userOneCtx
    )

    expect(result).toEqual({
      targetError: null,
      outcomes: [
        { elementId: adminElement.id, status: 'SHARED', reason: null },
        { elementId: ownerElement.id, status: 'SHARED', reason: null },
        {
          elementId: readElement.id,
          status: 'SKIPPED',
          reason: 'INSUFFICIENT_PERMISSION',
        },
        {
          elementId: deletedElement.id,
          status: 'SKIPPED',
          reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
        },
        {
          elementId: missingId,
          status: 'SKIPPED',
          reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
        },
      ],
    })
  })

  it('upserts an individual grant and preserves sharing invariants', async () => {
    const element = await seedElement()
    await prisma.permission.create({
      data: {
        elementId: element.id,
        userId: userTwo.id,
        permissionLevel: PermissionLevel.READ,
        propagation: true,
      },
    })
    await prisma.accessRequest.create({
      data: {
        elementId: element.id,
        userId: userTwo.id,
        objectAdminOrOwnerId: userOne.id,
        permissionLevel: PermissionLevel.WRITE,
      },
    })

    const emitSpy = vi.spyOn(emitter, 'emit')
    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.ADMIN,
        shortnameOrEmail: userTwo.email,
      },
      userOneCtx
    )

    expect(result.outcomes).toEqual([
      { elementId: element.id, status: 'SHARED', reason: null },
    ])
    const directPermissions = await prisma.permission.findMany({
      where: { elementId: element.id, userId: userTwo.id },
    })
    expect(directPermissions).toHaveLength(1)
    expect(directPermissions[0]).toMatchObject({
      permissionLevel: PermissionLevel.ADMIN,
      propagation: false,
    })
    expect(
      await prisma.accessRequest.count({
        where: { elementId: element.id, userId: userTwo.id },
      })
    ).toBe(0)
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).toMatchObject({ permissionLevel: PermissionLevel.ADMIN })
    expect(
      await prisma.auditLogEntry.count({
        where: {
          type: AuditLogType.PERMISSION_GRANTED,
          objectType: ObjectType.ELEMENT,
          objectId: String(element.id),
          sourceUserId: userOne.id,
          targetUserId: userTwo.id,
        },
      })
    ).toBe(1)
    expect(emitSpy).toHaveBeenCalledWith('invalidate', {
      typename: 'Permission',
      id: directPermissions[0]!.id,
    })
  })

  it('shares with an available user group and recomputes member access', async () => {
    const element = await seedElement()
    const group = await prisma.userGroup.create({
      data: {
        name: 'Batch sharing group',
        ownerId: userOne.id,
        members: { connect: { id: userTwo.id } },
      },
    })

    const emitSpy = vi.spyOn(emitter, 'emit')
    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.WRITE,
        userGroupId: group.id,
      },
      userOneCtx
    )
    const updatedResult = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.ADMIN,
        userGroupId: group.id,
      },
      userOneCtx
    )

    expect(result.outcomes).toEqual([
      { elementId: element.id, status: 'SHARED', reason: null },
    ])
    expect(updatedResult.outcomes).toEqual([
      { elementId: element.id, status: 'SHARED', reason: null },
    ])
    const directPermissions = await prisma.permission.findMany({
      where: { elementId: element.id, userGroupId: group.id },
    })
    expect(directPermissions).toHaveLength(1)
    expect(directPermissions[0]).toMatchObject({
      permissionLevel: PermissionLevel.ADMIN,
      propagation: false,
    })
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).toMatchObject({ permissionLevel: PermissionLevel.ADMIN })
    expect(
      await prisma.auditLogEntry.count({
        where: {
          type: AuditLogType.PERMISSION_GRANTED,
          objectType: ObjectType.ELEMENT,
          objectId: String(element.id),
          targetUserGroupId: group.id,
        },
      })
    ).toBe(2)
    expect(emitSpy).toHaveBeenCalledTimes(2)
    expect(emitSpy).toHaveBeenNthCalledWith(1, 'invalidate', {
      typename: 'Permission',
      id: directPermissions[0]!.id,
    })
    expect(emitSpy).toHaveBeenNthCalledWith(2, 'invalidate', {
      typename: 'Permission',
      id: directPermissions[0]!.id,
    })
  })

  it('reports a committed grant as shared when invalidation throws', async () => {
    const element = await seedElement()
    emitter.once('invalidate', () => {
      throw new Error('synthetic invalidation failure')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
      },
      userOneCtx
    )

    expect(result.outcomes).toEqual([
      { elementId: element.id, status: 'SHARED', reason: null },
    ])
    expect(
      await prisma.permission.count({
        where: { elementId: element.id, userId: userTwo.id },
      })
    ).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to invalidate permission %s after sharing element %s',
      expect.any(Number),
      expect.any(Number),
      expect.any(Error)
    )

    const group = await prisma.userGroup.create({
      data: { name: 'Direct resolver priority group', ownerId: userOne.id },
    })
    const userFirstResult = await shareObject(
      {
        elementId: element.id,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
        shortnameOrEmail: userTwo.shortname,
        userGroupId: group.id,
      },
      userOneCtx
    )
    expect(userFirstResult).toMatchObject({
      userId: userTwo.id,
      userGroupId: undefined,
    })
    expect(
      await prisma.permission.findUnique({
        where: {
          elementId_userGroupId: {
            elementId: element.id,
            userGroupId: group.id,
          },
        },
      })
    ).toBeNull()
    await expect(
      shareObject(
        {
          elementId: element.id,
          permissionLevel: PermissionLevel.READ,
          propagation: false,
        },
        userOneCtx
      )
    ).resolves.toBeNull()
  })

  it('keeps direct element sharing propagation and response behavior compatible', async () => {
    const element = await seedElement()
    emitter.once('invalidate', () => {
      throw new Error('synthetic direct invalidation failure')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await shareObject(
      {
        elementId: element.id,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
        shortnameOrEmail: userTwo.shortname,
      },
      userOneCtx
    )

    expect(result).toMatchObject({
      userId: userTwo.id,
      username: userTwo.shortname,
      userEmail: userTwo.email,
      permissionLevel: PermissionLevel.WRITE,
      propagation: true,
      isOwn: false,
    })
    expect(
      await prisma.permission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).toMatchObject({
      permissionLevel: PermissionLevel.WRITE,
      propagation: true,
    })
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to invalidate permission %s after sharing element %s',
      expect.any(Number),
      expect.any(Number),
      expect.any(Error)
    )
  })

  it('enforces full-access lecturer auth at the GraphQL boundary', async () => {
    const field = schema.getMutationType()!.getFields().shareElementsBatch!
    expect(field.type.toString()).toBe('ElementBatchSharingResult!')
    expect(
      Object.fromEntries(
        field.args.map((arg) => [arg.name, arg.type.toString()])
      )
    ).toEqual({
      elementIds: '[Int!]!',
      permissionLevel: 'PermissionLevel!',
      shortnameOrEmail: 'String',
      userGroupId: 'Int',
    })
    const resultType = schema.getType(
      'ElementBatchSharingResult'
    ) as GraphQLObjectType
    expect(
      Object.fromEntries(
        Object.entries(resultType.getFields()).map(([name, resultField]) => [
          name,
          resultField.type.toString(),
        ])
      )
    ).toEqual({
      outcomes: '[ElementBatchSharingOutcome!]!',
      targetError: 'ElementBatchSharingTargetError',
    })

    const source = `
      mutation {
        shareElementsBatch(
          elementIds: []
          permissionLevel: READ
          shortnameOrEmail: "unknown-user"
        ) {
          targetError
          outcomes {
            elementId
          }
        }
      }
    `
    const execute = async (context: ContextWithUser) => {
      const yoga = createYoga({
        schema,
        context: () => context,
        graphqlEndpoint: '/graphql',
      })
      const response = await yoga.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: source }),
      })
      return (await response.json()) as {
        data?: Record<string, unknown>
        errors?: { message: string }[]
      }
    }
    const readOnlyResult = await execute({
      ...userOneCtx,
      user: { ...userOneCtx.user, scope: UserLoginScope.READ_ONLY },
    })
    expect(readOnlyResult.errors?.[0]?.message).toBe('Unauthorized')

    for (const scope of [
      UserLoginScope.FULL_ACCESS,
      UserLoginScope.ACCOUNT_OWNER,
    ]) {
      const authorizedResult = await execute({
        ...userOneCtx,
        user: { ...userOneCtx.user, scope },
      })
      expect(authorizedResult.errors).toBeUndefined()
      expect(authorizedResult.data).toEqual({
        shareElementsBatch: {
          targetError: 'INVALID_OR_SELF_TARGET',
          outcomes: [],
        },
      })
    }
  })

  it('isolates an unexpected transaction failure to one eligible element', async () => {
    const firstElement = await seedElement()
    const secondElement = await seedElement()
    const transaction = prisma.$transaction.bind(prisma)
    const emitSpy = vi.spyOn(emitter, 'emit')
    const transactionMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('synthetic transaction failure'))
      .mockImplementation(transaction as typeof prisma.$transaction)
    const isolatedPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? transactionMock
          : Reflect.get(target, property, receiver)
      },
    })

    const result = await shareElementsBatch(
      {
        elementIds: [firstElement.id, secondElement.id],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
      },
      { ...userOneCtx, prisma: isolatedPrisma }
    )

    expect(result.outcomes).toEqual([
      {
        elementId: firstElement.id,
        status: 'FAILED',
        reason: 'SHARING_FAILED',
      },
      { elementId: secondElement.id, status: 'SHARED', reason: null },
    ])
    const committedPermission = await prisma.permission.findUnique({
      where: {
        elementId_userId: {
          elementId: secondElement.id,
          userId: userTwo.id,
        },
      },
    })
    expect(committedPermission).not.toBeNull()
    expect(emitSpy).toHaveBeenCalledTimes(1)
    expect(emitSpy).toHaveBeenCalledWith('invalidate', {
      typename: 'Permission',
      id: committedPermission!.id,
    })
    expect(prisma.$transaction).toBeTypeOf('function')
  })

  it('retries serializable transaction conflicts before sharing', async () => {
    const element = await seedElement()
    const transaction = prisma.$transaction.bind(prisma)
    const transactionMock = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementation(transaction as typeof prisma.$transaction)
    const isolatedPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? transactionMock
          : Reflect.get(target, property, receiver)
      },
    })

    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
      },
      { ...userOneCtx, prisma: isolatedPrisma }
    )

    expect(result.outcomes).toEqual([
      { elementId: element.id, status: 'SHARED', reason: null },
    ])
    expect(transactionMock).toHaveBeenCalledTimes(2)
    expect(
      await prisma.permission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).not.toBeNull()
  })

  it('rechecks caller permission inside the element transaction', async () => {
    const element = await seedElement({
      ownerId: userThree.id,
      callerPermissionLevel: PermissionLevel.ADMIN,
    })
    const transaction = prisma.$transaction.bind(prisma)
    const transactionMock = vi
      .fn()
      .mockImplementation(async (callback: (tx: PrismaClient) => unknown) => {
        await prisma.permission.deleteMany({
          where: { elementId: element.id, userId: userOne.id },
        })
        await recomputeDerivedPermissions({ elementId: element.id }, prisma)
        return callback(prisma)
      })
    const isolatedPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? transactionMock
          : Reflect.get(target, property, receiver)
      },
    })

    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
      },
      { ...userOneCtx, prisma: isolatedPrisma }
    )

    expect(result.outcomes).toEqual([
      {
        elementId: element.id,
        status: 'SKIPPED',
        reason: 'INSUFFICIENT_PERMISSION',
      },
    ])
    expect(
      await prisma.permission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).toBeNull()
    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(transaction).toBeTypeOf('function')
  })

  it('rechecks deletion inside the element transaction', async () => {
    const element = await seedElement({
      callerPermissionLevel: PermissionLevel.ADMIN,
    })
    const transaction = prisma.$transaction.bind(prisma)
    const transactionMock = vi
      .fn()
      .mockImplementation(async (callback: (tx: PrismaClient) => unknown) => {
        await prisma.element.update({
          where: { id: element.id },
          data: { isDeleted: true },
        })
        return callback(prisma)
      })
    const isolatedPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? transactionMock
          : Reflect.get(target, property, receiver)
      },
    })

    const result = await shareElementsBatch(
      {
        elementIds: [element.id],
        permissionLevel: PermissionLevel.READ,
        shortnameOrEmail: userTwo.shortname,
      },
      { ...userOneCtx, prisma: isolatedPrisma }
    )

    expect(result.outcomes).toEqual([
      {
        elementId: element.id,
        status: 'SKIPPED',
        reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
      },
    ])
    expect(
      await prisma.permission.findUnique({
        where: {
          elementId_userId: { elementId: element.id, userId: userTwo.id },
        },
      })
    ).toBeNull()
    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(transaction).toBeTypeOf('function')
  })
})
