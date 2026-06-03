import {
  ParameterType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

function createPublishedActivity() {
  return {
    id: 'activity-1',
    status: PublicationStatus.PUBLISHED,
    scheduledStartAt: new Date(Date.now() - 60_000),
    scheduledEndAt: new Date(Date.now() + 60_000),
    clues: [
      {
        name: 'clue-a',
        displayName: 'Clue A',
        type: ParameterType.STRING,
        unit: null,
        value: 'A',
      },
      {
        name: 'clue-b',
        displayName: 'Clue B',
        type: ParameterType.NUMBER,
        unit: 'kg',
        value: '42',
      },
    ],
  }
}

describe('participant group activity routers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts a published group activity for a group member', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const create = vi.fn().mockResolvedValue({
      id: 11,
      clues: [{ id: 101 }, { id: 102 }],
    })
    const update = vi.fn().mockResolvedValue({ id: 11 })
    const tx = {
      groupActivityInstance: {
        create,
        update,
      },
    }
    const transaction = vi.fn(async (fn) => fn(tx))
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-1' }, { id: 'participant-2' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({
      groupActivity: {
        id: 'activity-1',
        status: PublicationStatus.PUBLISHED,
        activityInstance: { id: 11 },
      },
    })

    expect(prisma?.groupActivity.findUnique).toHaveBeenCalledWith({
      where: { id: 'activity-1', status: PublicationStatus.PUBLISHED },
      select: expect.objectContaining({
        clues: expect.objectContaining({
          orderBy: { displayName: 'asc' },
        }),
      }),
    })
    expect(prisma?.participantGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      select: {
        participants: {
          select: { id: true },
        },
      },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        group: { connect: { id: 'group-1' } },
        groupActivity: { connect: { id: 'activity-1' } },
        clues: { create: createPublishedActivity().clues },
      },
      select: {
        id: true,
        clues: {
          select: { id: true },
        },
      },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        clueInstanceAssignment: {
          create: expect.arrayContaining([
            expect.objectContaining({
              groupActivityClueInstance: { connect: { id: 101 } },
            }),
            expect.objectContaining({
              groupActivityClueInstance: { connect: { id: 102 } },
            }),
          ]),
        },
      },
      select: { id: true },
    })
    expect(transaction).toHaveBeenCalledOnce()
  })

  test('returns null when the participant is not a group member', async () => {
    const transaction = vi.fn()
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-2' }, { id: 'participant-3' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ groupActivity: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns null when the group has fewer than two participants', async () => {
    const transaction = vi.fn()
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-1' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ groupActivity: null })

    expect(transaction).not.toHaveBeenCalled()
  })
})
