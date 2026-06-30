import {
  ActivityLogType,
  ObjectType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'user-1',
}

function createContext(
  prisma: TRPCContext['prisma'],
  options?: { scope?: UserLoginScope }
): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: options?.scope ?? UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('sharing activity log router', () => {
  test('returns null object activity when read permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const findMany = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      activityLogEntry: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.objectActivity({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ objectActivity: null })

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.READ,
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(findMany).not.toHaveBeenCalled()
  })

  test('returns mapped activity entries for a readable object', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const updatedAt = new Date('2026-01-02T00:00:00.000Z')
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 1,
        type: ActivityLogType.MESSAGE,
        objectType: ObjectType.LIVE_QUIZ,
        message: 'Looks good',
        modificationDetails: null,
        resolved: false,
        resolvedAt: null,
        userId: user.id,
        user: { shortname: 'lecturer' },
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 2,
        type: ActivityLogType.MODIFICATION,
        objectType: ObjectType.LIVE_QUIZ,
        message: null,
        modificationDetails: {
          field: 'title',
          oldValue: 'Old title',
          newValue: 'New title',
        },
        resolved: false,
        resolvedAt: null,
        userId: 'user-2',
        user: { shortname: 'other' },
        createdAt,
        updatedAt,
      },
    ])
    const prisma = {
      derivedPermission: { findFirst },
      activityLogEntry: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.objectActivity({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      objectActivity: [
        {
          id: 1,
          type: ActivityLogType.MESSAGE,
          objectType: ObjectType.LIVE_QUIZ,
          message: 'Looks good',
          resolved: false,
          resolvedAt: null,
          username: 'lecturer',
          isOwn: true,
          options: { field: null, oldValue: null, newValue: null },
          isEdited: false,
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 2,
          type: ActivityLogType.MODIFICATION,
          objectType: ObjectType.LIVE_QUIZ,
          message: null,
          resolved: false,
          resolvedAt: null,
          username: 'other',
          isOwn: false,
          options: {
            field: 'title',
            oldValue: 'Old title',
            newValue: 'New title',
          },
          isEdited: true,
          createdAt,
          updatedAt,
        },
      ],
    })

    expect(findMany).toHaveBeenCalledWith({
      where: { liveQuizId: 'live-quiz-1' },
      include: { user: { select: { shortname: true } } },
      orderBy: { createdAt: 'asc' },
    })
  })

  test('adds an activity message for a readable object', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
    const create = vi.fn().mockResolvedValue({
      id: 3,
      type: ActivityLogType.MESSAGE,
      objectType: ObjectType.LIVE_QUIZ,
      message: 'New comment',
      modificationDetails: null,
      resolved: false,
      resolvedAt: null,
      userId: user.id,
      user: { shortname: 'lecturer' },
      createdAt,
      updatedAt: createdAt,
    })
    const prisma = {
      derivedPermission: { findFirst },
      activityLogEntry: { create },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.addActivityMessage({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
        message: 'New comment',
      })
    ).resolves.toEqual({
      activityMessage: {
        id: 3,
        type: ActivityLogType.MESSAGE,
        objectType: ObjectType.LIVE_QUIZ,
        message: 'New comment',
        resolved: false,
        resolvedAt: null,
        username: 'lecturer',
        isOwn: true,
        options: { field: null, oldValue: null, newValue: null },
        isEdited: false,
        createdAt,
        updatedAt: createdAt,
      },
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        type: ActivityLogType.MESSAGE,
        message: 'New comment',
        objectType: ObjectType.LIVE_QUIZ,
        liveQuizId: 'live-quiz-1',
        userId: user.id,
      },
      include: { user: { select: { shortname: true } } },
    })
  })

  test('fails closed for unsupported activity message object types', async () => {
    const findFirst = vi.fn()
    const create = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      activityLogEntry: { create },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.addActivityMessage({
        objectId: '1',
        objectType: ObjectType.CATALOG_COLLECTION,
        message: 'Unsupported',
      })
    ).resolves.toEqual({ activityMessage: null })

    expect(findFirst).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  test('deletes only own activity messages', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, userId: user.id })
      .mockResolvedValueOnce({ id: 2, userId: 'user-2' })
    const deleteMessage = vi.fn().mockResolvedValue({})
    const prisma = {
      activityLogEntry: { findUnique, delete: deleteMessage },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.deleteActivityMessage({ id: 1 })
    ).resolves.toEqual({ deleted: true })
    await expect(
      caller.sharing.deleteActivityMessage({ id: 2 })
    ).resolves.toEqual({ deleted: false })

    expect(deleteMessage).toHaveBeenCalledTimes(1)
    expect(deleteMessage).toHaveBeenCalledWith({
      where: { id: 1, userId: user.id },
    })
  })
})
