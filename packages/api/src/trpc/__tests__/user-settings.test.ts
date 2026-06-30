import { Locale, UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { seedDemoQuestions } from '../../services/demoQuestions.js'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('../../services/demoQuestions.js', () => ({
  seedDemoQuestions: vi.fn(),
}))

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: false,
}

function createContext(
  prisma: TRPCContext['prisma'],
  overrides: Partial<TRPCContext> = {}
): TRPCContext {
  return {
    prisma,
    user,
    res: { cookie: vi.fn() },
    ...overrides,
  }
}

describe('user settings router', () => {
  beforeEach(() => {
    vi.mocked(seedDemoQuestions).mockReset()
  })

  test('checks shortname availability against the current user', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: user.sub })
      .mockResolvedValueOnce({ id: 'other-user' })
    const prisma = {
      user: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.checkShortnameAvailable({ shortname: ' newname ' })
    ).resolves.toBe(true)
    await expect(
      caller.user.checkShortnameAvailable({ shortname: 'owner' })
    ).resolves.toBe(true)
    await expect(
      caller.user.checkShortnameAvailable({ shortname: 'taken' })
    ).resolves.toBe(false)
    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { shortname: 'newname' },
    })
  })

  test('changes shortname or returns the current shortname when taken', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 'other-user' })
      .mockResolvedValueOnce({ id: user.sub, shortname: 'current' })
      .mockResolvedValueOnce(null)
    const update = vi
      .fn()
      .mockResolvedValue({ id: user.sub, shortname: 'fresh' })
    const prisma = {
      user: { findUnique, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.changeShortname({ shortname: 'taken' })
    ).resolves.toEqual({ id: user.sub, shortname: 'current' })
    await expect(
      caller.user.changeShortname({ shortname: ' fresh ' })
    ).resolves.toEqual({ id: user.sub, shortname: 'fresh' })
    await expect(
      caller.user.changeShortname({ shortname: 'abc' })
    ).resolves.toBe(null)
    expect(update).toHaveBeenCalledWith({
      where: { id: user.sub },
      data: { shortname: 'fresh' },
      select: { id: true, shortname: true },
    })
  })

  test('changes locale and writes the NEXT_LOCALE cookie', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({ id: user.sub, locale: Locale.de })
    const prisma = {
      user: { update },
    } as unknown as TRPCContext['prisma']
    const cookie = vi.fn()
    const caller = appRouter.createCaller(
      createContext(prisma, { res: { cookie } })
    )

    await expect(
      caller.user.changeUserLocale({ locale: Locale.de })
    ).resolves.toEqual({ id: user.sub, locale: Locale.de })
    expect(update).toHaveBeenCalledWith({
      where: { id: user.sub },
      data: { locale: Locale.de },
      select: { id: true, locale: true },
    })
    expect(cookie).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      Locale.de,
      expect.objectContaining({ path: '/', httpOnly: true })
    )
  })

  test('changes email update preferences', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({ id: user.sub, sendProjectUpdates: true })
    const prisma = {
      user: { update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.changeEmailSettings({ projectUpdates: true })
    ).resolves.toEqual({ id: user.sub, sendProjectUpdates: true })
    expect(update).toHaveBeenCalledWith({
      where: { id: user.sub },
      data: { sendProjectUpdates: true },
      select: { id: true, sendProjectUpdates: true },
    })
  })

  test('changes initial settings and seeds demo elements on request', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const update = vi.fn().mockResolvedValue({
      id: user.sub,
      email: 'lecturer@example.com',
      shortname: 'fresh',
      locale: Locale.de,
      firstLogin: false,
      catalystInstitutional: true,
      catalystIndividual: false,
      catalystTier: 'pro',
    })
    const prisma = {
      user: { findFirst, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.changeInitialSettings({
        shortname: ' fresh ',
        locale: Locale.de,
        sendUpdates: true,
        seedDemoElements: true,
      })
    ).resolves.toEqual({
      id: user.sub,
      email: 'lecturer@example.com',
      shortname: 'fresh',
      locale: Locale.de,
      firstLogin: false,
      catalyst: true,
      catalystTier: 'pro',
    })
    expect(seedDemoQuestions).toHaveBeenCalledWith({ prisma, userId: user.sub })
    expect(update).toHaveBeenCalledWith({
      where: { id: user.sub },
      data: {
        shortname: 'fresh',
        locale: Locale.de,
        sendProjectUpdates: true,
        firstLogin: false,
      },
      select: expect.objectContaining({
        id: true,
        email: true,
        shortname: true,
      }),
    })
  })

  test('keeps first-login open when the initial shortname is taken', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'other-user' })
    const update = vi.fn().mockResolvedValue({
      id: user.sub,
      email: 'lecturer@example.com',
      shortname: 'current',
      locale: Locale.de,
      firstLogin: true,
      catalystInstitutional: false,
      catalystIndividual: false,
      catalystTier: null,
    })
    const prisma = {
      user: { findFirst, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.user.changeInitialSettings({
        shortname: 'taken',
        locale: Locale.de,
        sendUpdates: false,
        seedDemoElements: true,
      })
    ).resolves.toEqual({
      id: user.sub,
      email: 'lecturer@example.com',
      shortname: 'current',
      locale: Locale.de,
      firstLogin: true,
      catalyst: false,
      catalystTier: null,
    })
    expect(seedDemoQuestions).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      where: { id: user.sub },
      data: { locale: Locale.de },
      select: expect.objectContaining({
        firstLogin: true,
        shortname: true,
      }),
    })
  })
})
