import { Locale, UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const bcryptCompare = vi.hoisted(() => vi.fn())
const nodemailerSendMail = vi.hoisted(() => vi.fn())
const nodemailerVerify = vi.hoisted(() => vi.fn())
const nodemailerCreateTransport = vi.hoisted(() =>
  vi.fn(() => ({
    verify: nodemailerVerify,
    sendMail: nodemailerSendMail,
  }))
)
const signJWT = vi.hoisted(() =>
  vi.fn(
    async (payload: { role?: UserRole; scope?: UserLoginScope; sub: string }) =>
      `jwt-${payload.sub}-${payload.scope ?? payload.role}`
  )
)
const verifyJWT = vi.hoisted(() => vi.fn())

vi.mock('bcryptjs', () => ({
  default: {
    compare: bcryptCompare,
  },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: nodemailerCreateTransport,
  },
}))

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...actual,
    signJWT,
    verifyJWT,
  }
})

const { appRouter } = await import('../root.js')

function createContext({
  prisma,
  res = { cookie: vi.fn() },
}: {
  prisma?: TRPCContext['prisma']
  res?: { cookie: ReturnType<typeof vi.fn> }
} = {}): TRPCContext {
  return {
    prisma,
    res,
  }
}

describe('participant auth routers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.APP_SECRET
    delete process.env.APP_ORIGIN_API
    delete process.env.APP_ORIGIN_PWA
  })

  test('logs in a participant by username and sets auth and locale cookies', async () => {
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    bcryptCompare.mockResolvedValue(true)
    const update = vi.fn().mockResolvedValue({})
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'participant-1',
          username: 'student1',
          password: 'hashed-password',
          locale: Locale.en,
        }),
        findMany: vi.fn(),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.login({
        usernameOrEmail: ' student1 ',
        password: 'abcd',
      })
    ).resolves.toBe('participant-1')

    expect(prisma?.participant.findUnique).toHaveBeenCalledWith({
      where: { username: 'student1' },
    })
    expect(bcryptCompare).toHaveBeenCalledWith('abcd', 'hashed-password')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
    expect(res.cookie).toHaveBeenCalledWith(
      'participant_token',
      `jwt-participant-1-${UserRole.PARTICIPANT}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
    expect(res.cookie).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      Locale.en,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
  })

  test('returns null and does not set cookies when password login fails', async () => {
    bcryptCompare.mockResolvedValue(false)
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'participant-1',
          password: 'hashed-password',
          locale: Locale.en,
        }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.login({
        usernameOrEmail: 'student1',
        password: 'wrong',
      })
    ).resolves.toBeNull()

    expect(prisma?.participant.update).not.toHaveBeenCalled()
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('tries all matching email candidates when logging in by email', async () => {
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    bcryptCompare.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const update = vi.fn().mockResolvedValue({})
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'manual-1',
            password: 'manual-hash',
            locale: Locale.en,
          },
          {
            id: 'sso-1',
            password: 'sso-hash',
            locale: Locale.de,
          },
        ]),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.login({
        usernameOrEmail: 'STUDENT@EXAMPLE.COM',
        password: 'abcd',
      })
    ).resolves.toBe('sso-1')

    expect(prisma?.participant.findMany).toHaveBeenCalledWith({
      where: { email: 'student@example.com' },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'sso-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
  })

  test('returns true for magic link requests when no participant matches', async () => {
    const prisma = {
      participant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.sendMagicLink({
        usernameOrEmail: 'missing@example.com',
      })
    ).resolves.toBe(true)

    expect(nodemailerCreateTransport).not.toHaveBeenCalled()
  })

  test('sends a magic link email for a matching participant', async () => {
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    process.env.APP_ORIGIN_PWA = 'http://pwa.localhost'
    nodemailerVerify.mockResolvedValue(undefined)
    nodemailerSendMail.mockResolvedValue(undefined)
    const prisma = {
      participant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'participant-1',
            email: 'student@example.com',
          },
        ]),
      },
      emailTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          html: '<a href="[LINK]">Login</a>',
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.sendMagicLink({
        usernameOrEmail: 'student1',
      })
    ).resolves.toBe(true)

    const expectedLink = `http://pwa.localhost/magicLogin?token=jwt-participant-1-${UserLoginScope.OTP}`
    expect(prisma?.emailTemplate.findUnique).toHaveBeenCalledWith({
      where: { name: 'MagicLinkRequested' },
    })
    expect(nodemailerSendMail).toHaveBeenCalledWith({
      from: process.env.EMAIL_FROM,
      to: 'student@example.com',
      subject: 'KlickerUZH - Your One-Time Login Link',
      text: `Please click on the following link to log in to KlickerUZH PWA: ${expectedLink} (validity: 15 minutes)`,
      html: `<a href="${expectedLink}">Login</a>`,
    })
  })

  test('returns false for magic link requests to participants without email', async () => {
    const prisma = {
      participant: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'participant-1', email: null }]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.sendMagicLink({
        usernameOrEmail: 'student-no-email',
      })
    ).resolves.toBe(false)
  })

  test('logs in a participant with a valid magic link token', async () => {
    process.env.APP_SECRET = 'secret'
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      scope: UserLoginScope.OTP,
    })
    const update = vi.fn().mockResolvedValue({})
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'participant-1',
          locale: Locale.de,
        }),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.loginWithMagicLink({
        token: 'valid-token',
      })
    ).resolves.toBe('participant-1')

    expect(verifyJWT).toHaveBeenCalledWith('valid-token', 'secret')
    expect(prisma?.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
    expect(res.cookie).toHaveBeenCalledWith(
      'participant_token',
      `jwt-participant-1-${UserRole.PARTICIPANT}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
    expect(res.cookie).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      Locale.de,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
  })

  test.each([
    {
      label: 'wrong scope',
      token: 'wrong-scope-token',
      setupToken: () =>
        verifyJWT.mockResolvedValue({
          sub: 'participant-1',
          scope: UserLoginScope.READ_ONLY,
        }),
    },
    {
      label: 'invalid token',
      token: 'invalid-token',
      setupToken: () => verifyJWT.mockRejectedValue(new Error('Invalid token')),
    },
    {
      label: 'missing participant',
      token: 'valid-token',
      setupToken: () =>
        verifyJWT.mockResolvedValue({
          sub: 'missing-participant',
          scope: UserLoginScope.OTP,
        }),
      expectedLookup: 'missing-participant',
      findUniqueResult: null,
    },
  ])(
    'returns null for magic link tokens with $label',
    async ({ token, setupToken, expectedLookup, findUniqueResult }) => {
      process.env.APP_SECRET = 'secret'
      setupToken()
      const findUnique = vi.fn()

      if (findUniqueResult !== undefined) {
        findUnique.mockResolvedValue(findUniqueResult)
      }

      const prisma = {
        participant: {
          findUnique,
          update: vi.fn(),
        },
      } as unknown as TRPCContext['prisma']
      const res = { cookie: vi.fn() }
      const caller = appRouter.createCaller(createContext({ prisma, res }))

      await expect(
        caller.participant.loginWithMagicLink({ token })
      ).resolves.toBeNull()

      expect(verifyJWT).toHaveBeenCalledWith(token, 'secret')
      if (expectedLookup) {
        expect(prisma?.participant.findUnique).toHaveBeenCalledWith({
          where: { id: expectedLookup },
        })
      } else {
        expect(prisma?.participant.findUnique).not.toHaveBeenCalled()
      }
      expect(prisma?.participant.update).not.toHaveBeenCalled()
      expect(res.cookie).not.toHaveBeenCalled()
    }
  )

  test('activates a participant account and logs the participant in', async () => {
    process.env.APP_SECRET = 'secret'
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      scope: UserLoginScope.ACTIVATION,
    })
    const update = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'participant-1',
        locale: Locale.en,
      })
      .mockResolvedValueOnce({})
    const prisma = {
      participant: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.activateAccount({
        token: 'activation-token',
      })
    ).resolves.toBe('participant-1')

    expect(verifyJWT).toHaveBeenCalledWith('activation-token', 'secret')
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'participant-1' },
      data: { isEmailValid: true },
    })
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'participant-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
    expect(res.cookie).toHaveBeenCalledWith(
      'participant_token',
      `jwt-participant-1-${UserRole.PARTICIPANT}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
    expect(res.cookie).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      Locale.en,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
  })

  test.each([
    {
      label: 'wrong scope',
      token: 'wrong-scope-token',
      setupToken: () =>
        verifyJWT.mockResolvedValue({
          sub: 'participant-1',
          scope: UserLoginScope.OTP,
        }),
    },
    {
      label: 'invalid token',
      token: 'invalid-token',
      setupToken: () => verifyJWT.mockRejectedValue(new Error('Invalid token')),
    },
    {
      label: 'missing participant',
      token: 'valid-token',
      setupToken: () =>
        verifyJWT.mockResolvedValue({
          sub: 'missing-participant',
          scope: UserLoginScope.ACTIVATION,
        }),
      updateError: { code: 'P2025' },
    },
  ])(
    'returns null for activation tokens with $label',
    async ({ token, setupToken, updateError }) => {
      process.env.APP_SECRET = 'secret'
      setupToken()
      const update = vi.fn()

      if (updateError !== undefined) {
        update.mockRejectedValue(updateError)
      }

      const prisma = {
        participant: {
          update,
        },
      } as unknown as TRPCContext['prisma']
      const res = { cookie: vi.fn() }
      const caller = appRouter.createCaller(createContext({ prisma, res }))

      await expect(
        caller.participant.activateAccount({ token })
      ).resolves.toBeNull()

      expect(verifyJWT).toHaveBeenCalledWith(token, 'secret')
      if (updateError) {
        expect(prisma?.participant.update).toHaveBeenCalledWith({
          where: { id: 'missing-participant' },
          data: { isEmailValid: true },
        })
      } else {
        expect(prisma?.participant.update).not.toHaveBeenCalled()
      }
      expect(res.cookie).not.toHaveBeenCalled()
    }
  )
})
