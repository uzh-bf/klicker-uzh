import { Locale, UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const bcryptHash = vi.hoisted(() => vi.fn())
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
    compare: vi.fn(),
    hash: bcryptHash,
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

describe('participant account creation routers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.APP_SECRET
    delete process.env.APP_ORIGIN_API
    delete process.env.APP_ORIGIN_PWA
    delete process.env.TEAMS_WEBHOOK_URL
  })

  test('creates a direct participant account and sends an activation email', async () => {
    process.env.APP_SECRET = 'secret'
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    process.env.APP_ORIGIN_PWA = 'http://pwa.localhost'
    bcryptHash.mockResolvedValue('hashed-password')
    nodemailerVerify.mockResolvedValue(undefined)
    nodemailerSendMail.mockResolvedValue(undefined)
    const participant = {
      id: 'participant-1',
      email: 'new@example.com',
      username: 'new-user',
    }
    const createParticipant = vi.fn().mockResolvedValue(participant)
    const upsertParticipation = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        participant: {
          create: createParticipant,
        },
        participation: {
          upsert: upsertParticipation,
        },
      })
    )
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({ isAssessmentEnabled: false }),
      },
      participant: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      emailTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          html: '<a href="[LINK]">Activate</a>',
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.createAccount({
        courseId: 'course-1',
        email: ' New@Example.COM ',
        username: ' new-user ',
        password: 'abcdabcd',
        isProfilePublic: true,
      })
    ).resolves.toEqual({
      participant,
      participantToken: null,
    })

    expect(prisma?.course.findUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: { isAssessmentEnabled: true },
    })
    expect(prisma?.participant.findFirst).toHaveBeenCalledWith({
      where: { email: 'new@example.com' },
      select: { id: true },
    })
    expect(createParticipant).toHaveBeenCalledWith({
      data: {
        email: 'new@example.com',
        username: 'new-user',
        password: 'hashed-password',
        isEmailValid: false,
        isProfilePublic: true,
        isSSOAccount: false,
        lastLoginAt: expect.any(Date),
      },
    })
    expect(upsertParticipation).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      create: {
        course: { connect: { id: 'course-1' } },
        participant: { connect: { id: 'participant-1' } },
      },
      update: {},
    })
    const expectedLink =
      'http://pwa.localhost/activation?token=jwt-participant-1-ACTIVATION'
    expect(prisma?.emailTemplate.findUnique).toHaveBeenCalledWith({
      where: { name: 'ParticipantAccountActivation' },
    })
    expect(nodemailerSendMail).toHaveBeenCalledWith({
      from: process.env.EMAIL_FROM,
      to: 'new@example.com',
      subject: 'KlickerUZH - Account Activation',
      text: `Please click on the following link to activate your KlickerUZH account: ${expectedLink} (validity: 60 minutes)`,
      html: `<a href="${expectedLink}">Activate</a>`,
    })
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('returns null when direct account creation would duplicate an email', async () => {
    const prisma = {
      participant: {
        findFirst: vi.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.createAccount({
        email: 'existing@example.com',
        username: 'new-user',
        password: 'abcdabcd',
        isProfilePublic: false,
      })
    ).resolves.toBeNull()

    expect(prisma?.participant.findFirst).toHaveBeenCalledWith({
      where: { email: 'existing@example.com' },
      select: { id: true },
    })
    expect(prisma?.$transaction).not.toHaveBeenCalled()
  })

  test('logs in an existing LTI participant and ensures course participation', async () => {
    process.env.APP_SECRET = 'secret'
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    verifyJWT.mockResolvedValue({
      sub: 'sso-1',
      email: 'LTI@Example.COM',
      scope: 'LTI1.3',
    })
    const participant = {
      id: 'participant-1',
      email: 'lti@example.com',
      username: 'lti-user',
      locale: Locale.de,
    }
    const account = {
      id: 'account-1',
      ssoEmail: 'lti@example.com',
      ssoType: 'LTI1.3',
      participant,
    }
    const upsertParticipation = vi.fn().mockResolvedValue({})
    const findAccount = vi.fn().mockResolvedValue(account)
    const transaction = vi.fn(async (callback) =>
      callback({
        participantAccount: {
          findUnique: findAccount,
          update: vi.fn(),
        },
        participation: {
          upsert: upsertParticipation,
        },
      })
    )
    const updateParticipant = vi.fn().mockResolvedValue({})
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({ isAssessmentEnabled: false }),
      },
      participant: {
        update: updateParticipant,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.loginWithLti({
        signedLtiData: 'signed-lti-token',
        courseId: 'course-1',
      })
    ).resolves.toEqual({
      participant: { id: 'participant-1' },
      participantToken: `jwt-participant-1-${UserRole.PARTICIPANT}`,
    })

    expect(verifyJWT).toHaveBeenCalledWith('signed-lti-token', 'secret')
    expect(findAccount).toHaveBeenCalledWith({
      where: { ssoId: 'sso-1' },
      include: { participant: true },
    })
    expect(upsertParticipation).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      create: {
        course: { connect: { id: 'course-1' } },
        participant: { connect: { id: 'participant-1' } },
      },
      update: {},
    })
    expect(updateParticipant).toHaveBeenCalledWith({
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

  test('creates and logs in a new LTI participant during account creation', async () => {
    process.env.APP_SECRET = 'secret'
    process.env.APP_ORIGIN_API = 'http://api.localhost'
    verifyJWT.mockResolvedValue({
      sub: 'sso-new',
      email: 'NewLti@Example.COM',
      scope: 'LTI1.3',
    })
    bcryptHash.mockResolvedValue('hashed-password')
    const participant = {
      id: 'participant-1',
      email: 'newlti@example.com',
      username: 'new-lti-user',
      locale: Locale.en,
    }
    const account = {
      id: 'account-1',
      ssoEmail: 'newlti@example.com',
      ssoType: 'LTI1.3',
      participant,
    }
    const createParticipant = vi.fn().mockResolvedValue(participant)
    const createAccount = vi.fn().mockResolvedValue(account)
    const transaction = vi.fn(async (callback) =>
      callback({
        participant: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          create: createParticipant,
        },
        participantAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: createAccount,
        },
        participation: {
          upsert: vi.fn(),
        },
      })
    )
    const updateParticipant = vi.fn().mockResolvedValue({})
    const prisma = {
      participant: {
        update: updateParticipant,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.createAccount({
        email: 'ignored@example.com',
        username: ' new-lti-user ',
        password: 'abcdabcd',
        isProfilePublic: true,
        signedLtiData: 'signed-lti-token',
      })
    ).resolves.toEqual({
      participant: {
        id: 'participant-1',
        email: 'newlti@example.com',
        username: 'new-lti-user',
      },
      participantToken: `jwt-participant-1-${UserRole.PARTICIPANT}`,
    })

    expect(createParticipant).toHaveBeenCalledWith({
      data: {
        email: 'newlti@example.com',
        username: 'new-lti-user',
        password: 'hashed-password',
        isEmailValid: true,
        isProfilePublic: true,
        isSSOAccount: true,
        lastLoginAt: expect.any(Date),
      },
    })
    expect(createAccount).toHaveBeenCalledWith({
      data: {
        ssoId: 'sso-new',
        ssoType: 'LTI1.3',
        ssoEmail: 'newlti@example.com',
        participant: {
          connect: {
            id: 'participant-1',
          },
        },
      },
      include: { participant: true },
    })
    expect(updateParticipant).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
    expect(res.cookie).toHaveBeenCalledWith(
      'participant_token',
      `jwt-participant-1-${UserRole.PARTICIPANT}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    )
  })
})
