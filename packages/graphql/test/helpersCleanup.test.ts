import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { testCleanup } from './helpers.js'

describe('testCleanup', () => {
  it('enables privileged course cleanup before normalizing deleted fixtures', async () => {
    let courseMutationAllowed = false
    const transactionClient = {
      $executeRaw: vi.fn().mockImplementation(() => {
        courseMutationAllowed = true
        return 1
      }),
      course: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn().mockImplementation(() => {
          if (!courseMutationAllowed) {
            throw new Error(
              'Course mutation is disabled while deletion is pending or complete.'
            )
          }
          return { count: 1 }
        }),
      },
    }
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 })
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation((callback) => callback(transactionClient)),
      answerCollection: { deleteMany },
      catalogCollection: { deleteMany },
      course: transactionClient.course,
      derivedPermission: { count: vi.fn().mockResolvedValue(0) },
      element: { deleteMany },
      groupActivity: { deleteMany },
      liveQuiz: { deleteMany },
      microLearning: { deleteMany },
      participant: { deleteMany },
      participantGroup: { deleteMany },
      permission: { count: vi.fn().mockResolvedValue(0) },
      practiceQuiz: { deleteMany },
      user: { deleteMany },
      userGroup: { deleteMany },
    } as unknown as PrismaClient

    await expect(testCleanup(prisma)).resolves.toBeUndefined()
    expect(transactionClient.course.updateMany).toHaveBeenCalledOnce()
    expect(transactionClient.course.deleteMany).toHaveBeenCalledOnce()
  })
})
