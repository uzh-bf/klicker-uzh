import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const adminUser = {
  sub: 'admin-1',
  role: UserRole.ADMIN,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: false,
}

function createContext(
  prisma: TRPCContext['prisma'],
  user: TRPCContext['user'] = adminUser
): TRPCContext {
  return { prisma, user }
}

describe('user admin router', () => {
  beforeEach(() => {
    delete process.env.TEAMS_WEBHOOK_URL
  })

  test('lists users with private preview access for admins', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { shortname: 'alice', email: 'alice@example.com' },
      { shortname: 'bob', email: 'bob@example.com' },
    ])
    const prisma = {
      user: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.user.privatePreviewUsers()).resolves.toEqual([
      { shortname: 'alice', email: 'alice@example.com' },
      { shortname: 'bob', email: 'bob@example.com' },
    ])
    expect(findMany).toHaveBeenCalledWith({
      where: { privatePreview: true },
      select: { shortname: true, email: true },
    })
  })

  test('rejects private preview list for non-admin users', async () => {
    const prisma = {
      user: { findMany: vi.fn() },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        ...adminUser,
        role: UserRole.USER,
      })
    )

    await expect(caller.user.privatePreviewUsers()).rejects.toBeInstanceOf(
      TRPCError
    )
  })

  test('returns GraphQL-compatible private preview grant status codes', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'existing@example.com',
        shortname: 'existing',
        privatePreview: true,
      })
      .mockResolvedValueOnce({
        id: 'user-3',
        email: 'new@example.com',
        shortname: 'new',
        privatePreview: false,
      })
    const update = vi.fn().mockResolvedValue({})
    const prisma = {
      user: { findUnique, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.grantPrivatePreviewAccess({ email: 'missing@example.com' })
    ).resolves.toBe(1)
    await expect(
      caller.user.grantPrivatePreviewAccess({ email: 'existing@example.com' })
    ).resolves.toBe(2)
    await expect(
      caller.user.grantPrivatePreviewAccess({ email: 'new@example.com' })
    ).resolves.toBe(0)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-3' },
      data: { privatePreview: true },
    })
  })
})
