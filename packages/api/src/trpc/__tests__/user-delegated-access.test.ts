import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const bcryptHash = vi.hoisted(() =>
  vi.fn(
    async (password: string, rounds: number) => `hashed-${password}-${rounds}`
  )
)

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptHash,
  },
}))

const { appRouter } = await import('../root.js')

const accountOwner = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: false,
}

function createContext(
  prisma: TRPCContext['prisma'],
  user: TRPCContext['user'] = accountOwner
): TRPCContext {
  return { prisma, user }
}

describe('user delegated access router', () => {
  test('lists delegated logins with current user scope', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'login-1',
        name: 'Assistant',
        scope: UserLoginScope.FULL_ACCESS,
        lastLoginAt: null,
        user: { id: accountOwner.sub, shortname: 'lecturer' },
      },
    ])
    const prisma = {
      userLogin: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.user.delegatedAccess()).resolves.toEqual({
      userScope: UserLoginScope.ACCOUNT_OWNER,
      userLogins: [
        {
          id: 'login-1',
          name: 'Assistant',
          scope: UserLoginScope.FULL_ACCESS,
          lastLoginAt: null,
          user: { id: accountOwner.sub, shortname: 'lecturer' },
        },
      ],
    })
    expect(findMany).toHaveBeenCalledWith({
      where: { user: { id: accountOwner.sub } },
      select: expect.objectContaining({
        id: true,
        name: true,
        scope: true,
      }),
      orderBy: { scope: 'asc' },
    })
  })

  test('creates full-access delegated logins for account owners', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'login-1',
      name: 'Assistant',
      scope: UserLoginScope.FULL_ACCESS,
      lastLoginAt: null,
      user: { id: accountOwner.sub, shortname: 'lecturer' },
    })
    const prisma = {
      userLogin: { create },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.createUserLogin({
        name: ' Assistant ',
        password: 'secret',
        scope: UserLoginScope.READ_ONLY,
      })
    ).resolves.toMatchObject({
      id: 'login-1',
      name: 'Assistant',
      scope: UserLoginScope.FULL_ACCESS,
    })
    expect(bcryptHash).toHaveBeenCalledWith('secret', 12)
    expect(create).toHaveBeenCalledWith({
      data: {
        password: 'hashed-secret-12',
        name: 'Assistant',
        scope: UserLoginScope.FULL_ACCESS,
        user: { connect: { id: accountOwner.sub } },
      },
      select: expect.objectContaining({
        id: true,
        name: true,
        scope: true,
      }),
    })
  })

  test('updates delegated login password only for owned logins', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'login-1', userId: accountOwner.sub })
    const update = vi.fn().mockResolvedValue({
      id: 'login-1',
      name: 'Assistant',
      scope: UserLoginScope.FULL_ACCESS,
      lastLoginAt: null,
      user: { id: accountOwner.sub, shortname: 'lecturer' },
    })
    const prisma = {
      userLogin: { findUnique, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.updateUserLogin({ id: 'missing', password: 'new' })
    ).resolves.toBeNull()
    await expect(
      caller.user.updateUserLogin({ id: 'login-1', password: 'new' })
    ).resolves.toMatchObject({ id: 'login-1' })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'login-1' },
      data: { password: 'hashed-new-12' },
      select: expect.objectContaining({
        id: true,
        name: true,
        scope: true,
      }),
    })
  })

  test('deletes existing delegated logins for account owners', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'login-1' })
    const deleteLogin = vi.fn().mockResolvedValue({ id: 'login-1' })
    const prisma = {
      userLogin: { findUnique, delete: deleteLogin },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.deleteUserLogin({ id: 'missing' })
    ).resolves.toBeNull()
    await expect(
      caller.user.deleteUserLogin({ id: 'login-1' })
    ).resolves.toEqual({ id: 'login-1' })
    expect(deleteLogin).toHaveBeenCalledWith({
      where: { id: 'login-1' },
      select: { id: true },
    })
    expect(findUnique).toHaveBeenLastCalledWith({
      where: { id: 'login-1', userId: accountOwner.sub },
    })
  })

  test('rejects delegated login mutations without account-owner scope', async () => {
    const prisma = {
      userLogin: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        ...accountOwner,
        scope: UserLoginScope.FULL_ACCESS,
      })
    )

    await expect(
      caller.user.createUserLogin({
        name: 'Assistant',
        password: 'secret',
        scope: UserLoginScope.FULL_ACCESS,
      })
    ).rejects.toThrow()
    await expect(
      caller.user.updateUserLogin({ id: 'login-1', password: 'secret' })
    ).rejects.toThrow()
    await expect(
      caller.user.deleteUserLogin({ id: 'login-1' })
    ).rejects.toThrow()
  })
})
