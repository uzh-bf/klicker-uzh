import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { SharingType } from '@klicker-uzh/types'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'owner-1',
}

function createContext(prisma: TRPCContext['prisma']): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('resources answer collection router', () => {
  test('lists answer collections with resource metadata', async () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const updatedAt = new Date('2026-01-02T10:00:00.000Z')
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          permissionLevel: PermissionLevel.OWNER,
          derived: false,
          directPermission: null,
          answerCollection: {
            id: 21,
            name: 'Owned answers',
            description: 'Owned description',
            originalId: null,
            isDeleted: false,
            createdAt,
            updatedAt,
            owner: { shortname: 'owner' },
            _count: {
              entries: 3,
              permissions: 2,
              linkedElements: 0,
              linkedTemplates: 0,
            },
          },
        },
        {
          permissionLevel: PermissionLevel.READ,
          derived: false,
          directPermission: { userGroupId: null },
          answerCollection: {
            id: 22,
            name: 'Shared answers',
            description: 'Shared description',
            originalId: 11,
            isDeleted: false,
            createdAt,
            updatedAt,
            owner: { shortname: 'other-owner' },
            _count: {
              entries: 5,
              permissions: 4,
              linkedElements: 1,
              linkedTemplates: 0,
            },
          },
        },
        {
          permissionLevel: PermissionLevel.READ,
          derived: true,
          directPermission: null,
          answerCollection: {
            id: 23,
            name: 'Deleted dependency',
            description: 'Deleted dependency description',
            originalId: null,
            isDeleted: true,
            createdAt,
            updatedAt,
            owner: { shortname: 'other-owner' },
            _count: {
              entries: 1,
              permissions: 1,
              linkedElements: 0,
              linkedTemplates: 0,
            },
          },
        },
      ],
    })
    const prisma = {
      user: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.resources.answerCollectionsInfo()).resolves.toEqual({
      answerCollections: [
        {
          id: 21,
          name: 'Owned answers',
          description: 'Owned description',
          ownerShortname: 'owner',
          numSharedUsers: 1,
          numOfEntries: 3,
          permissionLevel: PermissionLevel.OWNER,
          isOwner: true,
          isManager: true,
          isEditor: true,
          isImported: false,
          isShared: false,
          isDeletable: true,
          isRemovable: false,
          sharingType: SharingType.OWNED,
          createdAt,
          updatedAt,
        },
        {
          id: 22,
          name: 'Shared answers',
          description: 'Shared description',
          ownerShortname: 'other-owner',
          numSharedUsers: 3,
          numOfEntries: 5,
          permissionLevel: PermissionLevel.READ,
          isOwner: false,
          isManager: false,
          isEditor: false,
          isImported: false,
          isShared: true,
          isDeletable: false,
          isRemovable: false,
          sharingType: SharingType.SHARED,
          createdAt,
          updatedAt,
        },
      ],
    })
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        include: expect.objectContaining({
          objects: expect.objectContaining({
            where: { answerCollectionId: { not: null } },
          }),
        }),
      })
    )
  })

  test('returns single answer collection detail for users with access', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 21,
      name: 'Answers',
      description: 'Description',
      owner: { shortname: 'owner' },
      permissions: [{ permissionLevel: PermissionLevel.ADMIN }],
      _count: { permissions: 3 },
      entries: [
        {
          id: 2,
          value: 'B',
          _count: { itemUsages: 2, templateUsages: 1 },
        },
        {
          id: 1,
          value: 'A',
          _count: { itemUsages: 0, templateUsages: 0 },
        },
      ],
    })
    const prisma = {
      answerCollection: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.singleAnswerCollection({ id: 21 })
    ).resolves.toEqual({
      answerCollection: {
        id: 21,
        name: 'Answers',
        description: 'Description',
        ownerShortname: 'owner',
        numSharedUsers: 2,
        permissionLevel: PermissionLevel.ADMIN,
        isOwner: false,
        isManager: true,
        isEditor: true,
        isShared: true,
        entries: [
          { id: 2, value: 'B', numSolutionUsages: 3 },
          { id: 1, value: 'A', numSolutionUsages: 0 },
        ],
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 21 },
      include: {
        entries: {
          include: {
            _count: { select: { itemUsages: true, templateUsages: true } },
          },
          orderBy: { value: 'asc' },
        },
        permissions: { where: { userId: user.id } },
        owner: { select: { shortname: true } },
        _count: { select: { permissions: true } },
      },
    })
  })

  test('returns null for single answer collection without access', async () => {
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          description: 'Description',
          owner: { shortname: 'owner' },
          permissions: [],
          _count: { permissions: 1 },
          entries: [],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.singleAnswerCollection({ id: 21 })
    ).resolves.toEqual({ answerCollection: null })
  })
})
