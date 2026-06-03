import { UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

describe('participant profile routers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    {
      label: 'missing participant',
      currentParticipantId: undefined,
      existingParticipant: null,
      expected: true,
    },
    {
      label: 'own username',
      currentParticipantId: 'participant-1',
      existingParticipant: { id: 'participant-1' },
      expected: true,
    },
    {
      label: 'another participant username',
      currentParticipantId: 'participant-1',
      existingParticipant: { id: 'participant-2' },
      expected: false,
    },
  ])(
    'checks participant username availability for $label',
    async ({ currentParticipantId, existingParticipant, expected }) => {
      const findUnique = vi.fn().mockResolvedValue(existingParticipant)
      const prisma = {
        participant: {
          findUnique,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        currentParticipantId
          ? createContext({ prisma, sub: currentParticipantId })
          : ({ prisma } as TRPCContext)
      )

      await expect(
        caller.participant.checkNameAvailable({ username: ' student1 ' })
      ).resolves.toBe(expected)

      expect(findUnique).toHaveBeenCalledWith({
        where: { username: 'student1' },
        select: { id: true },
      })
    }
  )

  test('updates a participant profile and hashes a provided password', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const update = vi.fn().mockResolvedValue({
      id: 'participant-1',
      username: 'newname',
      email: 'new@example.com',
      isProfilePublic: false,
    })
    const prisma = {
      participant: {
        findUnique,
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.updateProfile({
        username: ' newname ',
        email: 'NEW@example.com',
        password: 'newpassword',
        isProfilePublic: false,
      })
    ).resolves.toEqual({
      id: 'participant-1',
      username: 'newname',
      email: 'new@example.com',
      isProfilePublic: false,
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { username: 'newname' },
      select: { id: true },
    })
    expect(bcryptHash).toHaveBeenCalledWith('newpassword', 12)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        isProfilePublic: false,
        email: 'new@example.com',
        username: 'newname',
        password: 'hashed-newpassword-12',
      },
      select: {
        id: true,
        username: true,
        email: true,
        isProfilePublic: true,
      },
    })
  })

  test('returns null when another participant already uses the username', async () => {
    const update = vi.fn()
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-2' }),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.updateProfile({
        username: 'student2',
        email: 'new@example.com',
      })
    ).resolves.toBeNull()

    expect(update).not.toHaveBeenCalled()
  })

  test.each([
    {
      label: 'short username',
      input: { username: 'abc', email: 'new@example.com' },
    },
    {
      label: 'invalid email',
      input: { username: 'student1', email: 'invalid-email' },
    },
    {
      label: 'short password',
      input: { username: 'student1', email: 'new@example.com', password: 'x' },
    },
  ])('returns null for $label', async ({ input }) => {
    const update = vi.fn()
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue(null),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.updateProfile(input)).resolves.toBeNull()

    expect(update).not.toHaveBeenCalled()
  })

  test('updates participant avatar fields', async () => {
    const avatarSettings = {
      skinTone: 'light',
      eyes: 'happy',
      mouth: 'open',
      hair: 'short',
      facialHair: 'none',
      accessory: 'none',
      hairColor: 'brown',
      clothing: 'shirt',
      clothingColor: 'blue',
    }
    const update = vi.fn().mockResolvedValue({
      avatar: 'avatar-hash',
      avatarSettings,
    })
    const prisma = {
      participant: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.updateAvatar({
        avatar: 'avatar-hash',
        avatarSettings,
      })
    ).resolves.toEqual({
      avatar: 'avatar-hash',
      avatarSettings,
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        avatar: 'avatar-hash',
        avatarSettings,
      },
      select: {
        avatar: true,
        avatarSettings: true,
      },
    })
  })

  test('rejects profile mutations for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.updateProfile({
        username: 'student1',
        email: 'new@example.com',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
