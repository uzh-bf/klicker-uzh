import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  res = { clearCookie: vi.fn(), cookie: vi.fn() },
}: {
  prisma?: TRPCContext['prisma']
  res?: {
    clearCookie: ReturnType<typeof vi.fn>
    cookie: ReturnType<typeof vi.fn>
  }
} = {}): TRPCContext {
  return {
    prisma,
    res,
  }
}

function createPrisma(liveQuiz: unknown) {
  return {
    liveQuiz: {
      findUnique: vi.fn().mockResolvedValue(liveQuiz),
    },
  } as unknown as TRPCContext['prisma']
}

describe('participant live quiz session routers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.COOKIE_DOMAIN
  })

  test('sets the live quiz pin cookie for a valid published quiz pin', async () => {
    process.env.COOKIE_DOMAIN = 'klicker.localhost'
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'ABC123',
      })
    ).resolves.toBe(true)

    expect(prisma?.liveQuiz.findUnique).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      select: { id: true, status: true, pinCode: true },
    })
    expect(res.clearCookie).not.toHaveBeenCalled()
    expect(res.cookie).toHaveBeenCalledWith(
      'live-quiz-pin-quiz-1',
      'ABC123',
      expect.objectContaining({
        domain: 'klicker.localhost',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        path: '/',
        sameSite: 'lax',
      })
    )
  })

  test('clears the live quiz pin cookie and rejects an invalid pin', async () => {
    process.env.COOKIE_DOMAIN = 'klicker.localhost'
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'WRONG',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_INVALID',
    })

    expect(res.clearCookie).toHaveBeenCalledWith('live-quiz-pin-quiz-1', {
      domain: 'klicker.localhost',
      path: '/',
    })
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('rejects unavailable live quiz pin submissions without setting cookies', async () => {
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.DRAFT,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'ABC123',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_INVALID',
    })

    expect(res.clearCookie).not.toHaveBeenCalled()
    expect(res.cookie).not.toHaveBeenCalled()
  })
})
