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

const avatarSettings = {
  skinTone: 'tone',
  eyes: 'eyes',
  mouth: 'mouth',
  hair: 'hair',
  facialHair: 'facialHair',
  accessory: 'accessory',
  hairColor: 'hairColor',
  clothing: 'clothing',
  clothingColor: 'clothingColor',
}

const levelData = {
  id: 1,
  index: 1,
  name: 'Starter',
  avatar: null,
  requiredXp: 0,
  nextLevel: {
    id: 2,
    index: 2,
    name: 'Next',
    avatar: 'next.svg',
    requiredXp: 9000,
  },
}

const achievementInstance = {
  id: 11,
  achievedAt: new Date('2026-01-01T00:00:00.000Z'),
  achievedCount: 2,
  achievement: {
    id: 12,
    nameDE: 'Erfolg',
    nameEN: 'Achievement',
    descriptionDE: 'Beschreibung',
    descriptionEN: 'Description',
    icon: '/achievement.svg',
    iconColor: null,
  },
}

const achievement = achievementInstance.achievement

function createParticipant(
  overrides: Partial<{
    avatar: string | null
    id: string
    isProfilePublic: boolean
    username: string
    xp: number
  }> = {}
) {
  return {
    id: 'participant-1',
    username: 'student1',
    avatar: 'avatar-1',
    avatarSettings,
    isProfilePublic: true,
    xp: 0,
    achievements: [achievementInstance],
    ...overrides,
  }
}

function expectedPublicProfile(
  overrides: Partial<ReturnType<typeof createParticipant>> & {
    isSelf?: boolean
  } = {}
) {
  const participant = createParticipant(overrides)

  return {
    id: participant.id,
    username: participant.username,
    avatar: participant.avatar,
    avatarSettings,
    isProfilePublic: participant.isProfilePublic,
    isSelf: overrides.isSelf ?? null,
    level: 1,
    levelData,
    xp: participant.xp,
    achievements: [achievementInstance],
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

  test('returns the full public profile for the current participant', async () => {
    const findUnique = vi.fn().mockResolvedValue(createParticipant())
    const levelFindUnique = vi.fn().mockResolvedValue(levelData)
    const prisma = {
      participant: {
        findUnique,
      },
      level: {
        findUnique: levelFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.publicProfile({ participantId: 'participant-1' })
    ).resolves.toEqual({
      publicParticipantProfile: expectedPublicProfile({ isSelf: true }),
    })

    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'participant-1' } })
    )
    expect(levelFindUnique).toHaveBeenCalledWith({
      where: { index: 1 },
      include: { nextLevel: true },
    })
  })

  test('returns the current participant with all possible achievements', async () => {
    const findUnique = vi.fn().mockResolvedValue(createParticipant())
    const achievementFindMany = vi.fn().mockResolvedValue([achievement])
    const levelFindUnique = vi.fn().mockResolvedValue(levelData)
    const prisma = {
      participant: {
        findUnique,
      },
      achievement: {
        findMany: achievementFindMany,
      },
      level: {
        findUnique: levelFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.selfWithAchievements()).resolves.toEqual({
      selfWithAchievements: {
        participant: expectedPublicProfile({ isSelf: true }),
        achievements: [achievement],
      },
    })

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'participant-1' } })
    )
    expect(achievementFindMany).toHaveBeenCalledWith({
      select: {
        id: true,
        nameDE: true,
        nameEN: true,
        descriptionDE: true,
        descriptionEN: true,
        icon: true,
        iconColor: true,
      },
    })
    expect(levelFindUnique).toHaveBeenCalledWith({
      where: { index: 1 },
      include: { nextLevel: true },
    })
  })

  test('returns another participant profile when both profiles are public', async () => {
    const target = createParticipant({
      id: 'participant-2',
      username: 'student2',
      avatar: 'avatar-2',
      isProfilePublic: true,
    })
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(createParticipant({ isProfilePublic: true }))
      .mockResolvedValueOnce(target)
    const prisma = {
      participant: {
        findUnique,
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.publicProfile({ participantId: 'participant-2' })
    ).resolves.toEqual({
      publicParticipantProfile: expectedPublicProfile({
        id: 'participant-2',
        username: 'student2',
        avatar: 'avatar-2',
      }),
    })

    expect(findUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'participant-1' } })
    )
    expect(findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'participant-2' } })
    )
  })

  test('anonymizes another participant profile unless both profiles are public', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(createParticipant({ isProfilePublic: false }))
      .mockResolvedValueOnce(
        createParticipant({
          id: 'participant-2',
          username: 'student2',
          avatar: 'avatar-2',
          isProfilePublic: true,
        })
      )
    const prisma = {
      participant: {
        findUnique,
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.publicProfile({ participantId: 'participant-2' })
    ).resolves.toEqual({
      publicParticipantProfile: expectedPublicProfile({
        id: 'participant-2',
        username: 'Anonymous',
        avatar: null,
        isProfilePublic: true,
      }),
    })
  })

  test('returns null for a missing public participant profile', async () => {
    const levelFindUnique = vi.fn()
    const prisma = {
      participant: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(createParticipant())
          .mockResolvedValueOnce(null),
      },
      level: {
        findUnique: levelFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.publicProfile({ participantId: 'missing' })
    ).resolves.toEqual({
      publicParticipantProfile: null,
    })

    expect(levelFindUnique).not.toHaveBeenCalled()
  })

  test('rejects public profile queries for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.publicProfile({ participantId: 'participant-1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
