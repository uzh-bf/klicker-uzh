import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  emitter,
  prisma,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  emitter?: TRPCContext['emitter']
  prisma?: TRPCContext['prisma']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    emitter,
    prisma,
    user: {
      sub,
      role,
    },
  }
}

describe('participant join routers', () => {
  test('checks whether a course PIN resolves to a course id', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      pinCode: 123456789,
    })
    const prisma = {
      course: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.checkValidCoursePin({ pin: 123456789 })
    ).resolves.toBe('course-1')

    expect(findUnique).toHaveBeenCalledWith({
      where: { pinCode: 123456789 },
      select: { id: true, pinCode: true },
    })
  })

  test('returns null when a course PIN is not valid', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.checkValidCoursePin({ pin: 987654321 })
    ).resolves.toBeNull()
  })

  test('joins a participant to a course with a valid PIN', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'participant-1' })
    const emit = vi.fn()
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isAssessmentEnabled: false,
          pinCode: 123456789,
        }),
      },
      participant: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).resolves.toEqual({ id: 'participant-1' })

    expect(prisma?.course.findUnique).toHaveBeenCalledWith({
      where: { pinCode: 123456789, isAssessmentEnabled: false },
      select: { id: true, isAssessmentEnabled: true, pinCode: true },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        participations: {
          connectOrCreate: {
            where: {
              courseId_participantId: {
                courseId: 'course-1',
                participantId: 'participant-1',
              },
            },
            create: { course: { connect: { id: 'course-1' } } },
          },
        },
      },
      select: { id: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Participant',
      id: 'participant-1',
    })
  })

  test.each([
    {
      label: 'missing course',
      course: null,
    },
    {
      label: 'assessment course',
      course: {
        id: 'assessment-course',
        isAssessmentEnabled: true,
        pinCode: 123456789,
      },
    },
  ])('returns null when joining with $label', async ({ course }) => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(course),
      },
      participant: {
        update: vi.fn(),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).resolves.toBeNull()

    expect(prisma?.participant.update).not.toHaveBeenCalled()
  })

  test('rejects course joining for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
