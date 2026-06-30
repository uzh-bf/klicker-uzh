import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  res = { cookie: vi.fn() },
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  prisma?: TRPCContext['prisma']
  res?: { cookie: ReturnType<typeof vi.fn> }
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    prisma,
    res,
    user: {
      sub,
      role,
    },
  }
}

describe('participant account routers', () => {
  test('deletes a participant account and groups left empty by the deletion', async () => {
    const deleteParticipantGroup = vi.fn().mockReturnValue('delete-group-1')
    const deleteParticipant = vi.fn().mockReturnValue('delete-participant-1')
    const transaction = vi.fn().mockResolvedValue([])
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          participantGroups: [
            {
              id: 'group-1',
              participants: [{ id: 'participant-1' }],
            },
            {
              id: 'group-2',
              participants: [{ id: 'participant-1' }, { id: 'participant-2' }],
            },
          ],
        }),
        delete: deleteParticipant,
      },
      participantGroup: {
        delete: deleteParticipantGroup,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(caller.participant.deleteAccount()).resolves.toBe(true)

    expect(prisma?.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      select: {
        participantGroups: {
          select: {
            id: true,
            participants: {
              select: { id: true },
            },
          },
        },
      },
    })
    expect(res.cookie).toHaveBeenCalledWith(
      'participant_token',
      'logoutString',
      expect.objectContaining({ maxAge: 0 })
    )
    expect(deleteParticipantGroup).toHaveBeenCalledTimes(1)
    expect(deleteParticipantGroup).toHaveBeenCalledWith({
      where: { id: 'group-1' },
    })
    expect(deleteParticipant).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
    })
    expect(transaction).toHaveBeenCalledWith([
      'delete-group-1',
      'delete-participant-1',
    ])
  })

  test('returns false when deleting a missing participant account', async () => {
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      participantGroup: {
        delete: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']
    const res = { cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(caller.participant.deleteAccount()).resolves.toBe(false)

    expect(res.cookie).not.toHaveBeenCalled()
    expect(prisma?.participant.delete).not.toHaveBeenCalled()
    expect(prisma?.participantGroup.delete).not.toHaveBeenCalled()
    expect(prisma?.$transaction).not.toHaveBeenCalled()
  })

  test('rejects account deletion for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(caller.participant.deleteAccount()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
