import {
  ElementBlockStatus,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  activateLiveQuizBlock,
  cancelLiveQuiz,
  deactivateLiveQuizBlock,
  endLiveQuiz,
  startLiveQuiz,
} from '../../services/liveQuizExecution.js'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('../../services/liveQuizExecution.js', () => ({
  activateLiveQuizBlock: vi.fn(),
  cancelLiveQuiz: vi.fn(),
  deactivateLiveQuizBlock: vi.fn(),
  endLiveQuiz: vi.fn(),
  startLiveQuiz: vi.fn(),
}))

const user = {
  id: 'user-1',
}

function createPrisma(permissionLevel: PermissionLevel | null) {
  return {
    derivedPermission: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        if (!permissionLevel) return null
        if (!where.permissionLevel.in.includes(permissionLevel)) return null

        return {
          permissionLevel,
        }
      }),
    },
  } as unknown as TRPCContext['prisma']
}

function createContext({
  prisma = createPrisma(PermissionLevel.EXECUTE),
  res = { cookie: vi.fn() },
  scope = UserLoginScope.ACCOUNT_OWNER,
  includeExecutionContext = true,
}: {
  prisma?: TRPCContext['prisma']
  res?: { cookie: ReturnType<typeof vi.fn> }
  scope?: UserLoginScope
  includeExecutionContext?: boolean
} = {}): TRPCContext {
  return {
    prisma,
    res,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
    ...(includeExecutionContext
      ? {
          redisExec: {},
          redisAssessmentExec: {},
          pubSub: {},
          emitter: new EventEmitter(),
          hatchet: {},
          tasks: {},
        }
      : {}),
  }
}

describe('control mutation routers', () => {
  beforeEach(() => {
    vi.mocked(activateLiveQuizBlock).mockReset()
    vi.mocked(cancelLiveQuiz).mockReset()
    vi.mocked(deactivateLiveQuizBlock).mockReset()
    vi.mocked(endLiveQuiz).mockReset()
    vi.mocked(startLiveQuiz).mockReset()
  })

  test('expires the lecturer session cookie on logout', async () => {
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ res }))

    await expect(caller.user.logout()).resolves.toBe(user.id)

    expect(res.cookie).toHaveBeenCalledWith(
      'next-auth.session-token',
      'logoutString',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
      })
    )
  })

  test('requires session execution scope for live quiz mutations', async () => {
    const caller = appRouter.createCaller(
      createContext({ scope: UserLoginScope.READ_ONLY })
    )

    await expect(caller.liveQuiz.start({ id: 'quiz-1' })).rejects.toThrow(
      'Forbidden'
    )
    expect(startLiveQuiz).not.toHaveBeenCalled()
  })

  test('requires execute permission for live quiz mutations', async () => {
    const caller = appRouter.createCaller({
      ...createContext({
        prisma: createPrisma(PermissionLevel.READ),
        includeExecutionContext: false,
      }),
    })

    await expect(caller.liveQuiz.end({ id: 'quiz-1' })).rejects.toThrow(
      'Forbidden'
    )
    expect(endLiveQuiz).not.toHaveBeenCalled()
  })

  test('starts a live quiz and returns the control DTO', async () => {
    vi.mocked(startLiveQuiz).mockResolvedValue({
      id: 'quiz-1',
      name: 'Quiz 1',
      status: PublicationStatus.PUBLISHED,
    } as any)
    const caller = appRouter.createCaller(createContext())

    await expect(caller.liveQuiz.start({ id: 'quiz-1' })).resolves.toEqual({
      liveQuiz: {
        id: 'quiz-1',
        name: 'Quiz 1',
        status: PublicationStatus.PUBLISHED,
      },
    })
  })

  test('activates a live quiz block and returns block statuses', async () => {
    vi.mocked(activateLiveQuizBlock).mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      blocks: [
        {
          id: 1,
          status: ElementBlockStatus.ACTIVE,
        },
      ],
    } as any)
    const caller = appRouter.createCaller(createContext())

    await expect(
      caller.liveQuiz.activateBlock({ quizId: 'quiz-1', blockId: 1 })
    ).resolves.toEqual({
      liveQuiz: {
        id: 'quiz-1',
        status: PublicationStatus.PUBLISHED,
        blocks: [
          {
            id: 1,
            status: ElementBlockStatus.ACTIVE,
          },
        ],
      },
    })
  })

  test('deactivates a live quiz block and returns the boolean result', async () => {
    vi.mocked(deactivateLiveQuizBlock).mockResolvedValue(true)
    const caller = appRouter.createCaller(createContext())

    await expect(
      caller.liveQuiz.deactivateBlock({ quizId: 'quiz-1', blockId: 1 })
    ).resolves.toEqual({ deactivated: true })
  })

  test('ends a live quiz and returns the status DTO', async () => {
    vi.mocked(endLiveQuiz).mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.ENDED,
    } as any)
    const caller = appRouter.createCaller(createContext())

    await expect(caller.liveQuiz.end({ id: 'quiz-1' })).resolves.toEqual({
      liveQuiz: {
        id: 'quiz-1',
        status: PublicationStatus.ENDED,
      },
    })
  })

  test('cancels a live quiz and returns the status DTO', async () => {
    vi.mocked(cancelLiveQuiz).mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.DRAFT,
    } as any)
    const caller = appRouter.createCaller(createContext())

    await expect(caller.liveQuiz.cancel({ id: 'quiz-1' })).resolves.toEqual({
      liveQuiz: {
        id: 'quiz-1',
        status: PublicationStatus.DRAFT,
      },
    })
  })
})
