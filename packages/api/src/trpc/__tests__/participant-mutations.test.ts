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

describe('participant mutation routers', () => {
  test('subscribes a participant to push notifications', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 3,
      subscriptions: [{ id: 7, endpoint: 'endpoint-1' }],
    })
    const prisma = {
      participation: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.subscribeToPush({
        courseId: 'course-1',
        subscriptionObject: {
          endpoint: 'endpoint-1',
          expirationTime: null,
          keys: {
            auth: 'auth-key',
            p256dh: 'p256dh-key',
          },
        },
      })
    ).resolves.toEqual({
      participation: {
        id: 3,
        subscriptions: [{ id: 7, endpoint: 'endpoint-1' }],
      },
    })

    expect(update).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      data: {
        subscriptions: {
          upsert: {
            where: {
              participantId_courseId_endpoint: {
                participantId: 'participant-1',
                courseId: 'course-1',
                endpoint: 'endpoint-1',
              },
            },
            create: {
              endpoint: 'endpoint-1',
              expirationTime: null,
              p256dh: 'p256dh-key',
              auth: 'auth-key',
              course: { connect: { id: 'course-1' } },
              participant: { connect: { id: 'participant-1' } },
            },
            update: {},
          },
        },
      },
      select: {
        id: true,
        subscriptions: {
          select: {
            id: true,
            endpoint: true,
          },
        },
      },
    })
  })

  test('unsubscribes a participant from push notifications', async () => {
    const deleteSubscription = vi.fn().mockResolvedValue({ id: 7 })
    const prisma = {
      pushSubscription: {
        delete: deleteSubscription,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.unsubscribeFromPush({
        courseId: 'course-1',
        endpoint: 'endpoint-1',
      })
    ).resolves.toBe(true)

    expect(deleteSubscription).toHaveBeenCalledWith({
      where: {
        participantId_courseId_endpoint: {
          participantId: 'participant-1',
          courseId: 'course-1',
          endpoint: 'endpoint-1',
        },
      },
    })
  })

  test('returns false when push unsubscribe cannot delete a subscription', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const prisma = {
      pushSubscription: {
        delete: vi.fn().mockRejectedValue(new Error('not found')),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.unsubscribeFromPush({
        courseId: 'course-1',
        endpoint: 'endpoint-1',
      })
    ).resolves.toBe(false)

    consoleError.mockRestore()
  })

  test('rejects participant push mutations for lecturers', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.subscribeToPush({
        courseId: 'course-1',
        subscriptionObject: {
          endpoint: 'endpoint-1',
          keys: {
            auth: 'auth-key',
            p256dh: 'p256dh-key',
          },
        },
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.unsubscribeFromPush({
        courseId: 'course-1',
        endpoint: 'endpoint-1',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
