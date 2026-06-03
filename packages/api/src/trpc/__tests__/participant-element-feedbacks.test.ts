import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  prisma?: TRPCContext['prisma']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    prisma,
    user: {
      sub,
      role,
    },
  }
}

describe('participant element feedback routers', () => {
  test('returns stack element feedbacks for the participant', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 11,
        elementInstanceId: 101,
        upvote: true,
        downvote: false,
        feedback: 'Clear question',
      },
    ])
    const prisma = {
      elementFeedback: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.stackElementFeedbacks({
        instanceIds: [101, 102],
      })
    ).resolves.toEqual([
      {
        id: 11,
        elementInstanceId: 101,
        upvote: true,
        downvote: false,
        feedback: 'Clear question',
      },
    ])

    expect(findMany).toHaveBeenCalledWith({
      where: {
        elementInstanceId: {
          in: [101, 102],
        },
        participantId: 'participant-1',
      },
      select: {
        id: true,
        elementInstanceId: true,
        upvote: true,
        downvote: true,
        feedback: true,
      },
    })
  })

  test('creates a new rating and increments instance statistics', async () => {
    const tx = {
      elementFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 12,
          elementInstanceId: 101,
          upvote: true,
          downvote: false,
          feedback: null,
        }),
      },
      instanceStatistics: {
        update: vi.fn().mockResolvedValue({ elementInstanceId: 101 }),
      },
    }
    const transaction = vi.fn(
      async <T>(callback: (txClient: typeof tx) => Promise<T> | T) =>
        callback(tx)
    )
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.rateElement({
        elementInstanceId: 101,
        elementId: 7,
        rating: 1,
      })
    ).resolves.toEqual({
      id: 12,
      elementInstanceId: 101,
      upvote: true,
      downvote: false,
      feedback: null,
    })

    expect(tx.elementFeedback.findUnique).toHaveBeenCalledWith({
      where: {
        participantId_elementInstanceId: {
          participantId: 'participant-1',
          elementInstanceId: 101,
        },
      },
      select: {
        upvote: true,
        downvote: true,
      },
    })
    expect(tx.elementFeedback.create).toHaveBeenCalledWith({
      data: {
        upvote: true,
        downvote: false,
        elementInstance: { connect: { id: 101 } },
        element: { connect: { id: 7 } },
        participant: { connect: { id: 'participant-1' } },
      },
      select: {
        id: true,
        elementInstanceId: true,
        upvote: true,
        downvote: true,
        feedback: true,
      },
    })
    expect(tx.instanceStatistics.update).toHaveBeenCalledWith({
      where: { elementInstanceId: 101 },
      data: {
        upvoteCount: { increment: 1 },
        downvoteCount: { increment: 0 },
      },
    })
  })

  test('updates an existing rating and offsets the previous vote', async () => {
    const tx = {
      elementFeedback: {
        findUnique: vi.fn().mockResolvedValue({
          upvote: true,
          downvote: false,
        }),
        update: vi.fn().mockResolvedValue({
          id: 12,
          elementInstanceId: 101,
          upvote: false,
          downvote: true,
          feedback: 'Needs context',
        }),
      },
      instanceStatistics: {
        update: vi.fn().mockResolvedValue({ elementInstanceId: 101 }),
      },
    }
    const transaction = vi.fn(
      async <T>(callback: (txClient: typeof tx) => Promise<T> | T) =>
        callback(tx)
    )
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.rateElement({
        elementInstanceId: 101,
        elementId: 7,
        rating: -1,
      })
    ).resolves.toEqual({
      id: 12,
      elementInstanceId: 101,
      upvote: false,
      downvote: true,
      feedback: 'Needs context',
    })

    expect(tx.elementFeedback.update).toHaveBeenCalledWith({
      where: {
        participantId_elementInstanceId: {
          participantId: 'participant-1',
          elementInstanceId: 101,
        },
      },
      data: {
        upvote: false,
        downvote: true,
      },
      select: {
        id: true,
        elementInstanceId: true,
        upvote: true,
        downvote: true,
        feedback: true,
      },
    })
    expect(tx.instanceStatistics.update).toHaveBeenCalledWith({
      where: { elementInstanceId: 101 },
      data: {
        upvoteCount: { increment: -1 },
        downvoteCount: { increment: 1 },
      },
    })
  })

  test('returns null for unsupported rating values', async () => {
    const transaction = vi.fn()
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.rateElement({
        elementInstanceId: 101,
        elementId: 7,
        rating: 0,
      })
    ).resolves.toBeNull()

    expect(transaction).not.toHaveBeenCalled()
  })

  test('rejects element feedback procedures for lecturers', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.stackElementFeedbacks({
        instanceIds: [101],
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.rateElement({
        elementInstanceId: 101,
        elementId: 7,
        rating: 1,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
