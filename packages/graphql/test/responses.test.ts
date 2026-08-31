import { StackFeedbackStatus } from '@klicker-uzh/types'
import type { Context } from '../src/lib/context.js'
import {
  combineStackStatus,
  respondToElementStack,
} from '../src/services/stacks.js'

describe('Test the response logic for element stacks', () => {
  it('Test the combination of different element responses', () => {
    const correct = StackFeedbackStatus.CORRECT
    const partial = StackFeedbackStatus.PARTIAL
    const wrong = StackFeedbackStatus.INCORRECT
    const unanswered = StackFeedbackStatus.UNANSWERED

    // if new status is unanswered, the previous one should be returned
    const res1 = combineStackStatus({
      prevStatus: unanswered,
      newStatus: unanswered,
    })
    expect(res1).toBe(unanswered)
    const res2 = combineStackStatus({
      prevStatus: correct,
      newStatus: unanswered,
    })
    expect(res2).toBe(correct)
    const res3 = combineStackStatus({
      prevStatus: partial,
      newStatus: unanswered,
    })
    expect(res3).toBe(partial)
    const res4 = combineStackStatus({
      prevStatus: wrong,
      newStatus: unanswered,
    })
    expect(res4).toBe(wrong)

    // if the previous status is unanswered, expect the new status
    const res5 = combineStackStatus({
      prevStatus: unanswered,
      newStatus: unanswered,
    })
    expect(res5).toBe(unanswered)
    const res6 = combineStackStatus({
      prevStatus: unanswered,
      newStatus: correct,
    })
    expect(res6).toBe(correct)
    const res7 = combineStackStatus({
      prevStatus: unanswered,
      newStatus: partial,
    })
    expect(res7).toBe(partial)
    const res8 = combineStackStatus({
      prevStatus: unanswered,
      newStatus: wrong,
    })
    expect(res8).toBe(wrong)
  })

  it('accepts activity-owned stacks without a direct course link', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 1 })
    const ctx = {
      prisma: { elementStack: { findUnique } },
      user: undefined,
    } as unknown as Context

    const result = await respondToElementStack(
      {
        stackId: 1,
        courseId: 'course-id',
        responses: [],
        stackAnswerTime: 0,
        isOwner: true,
      },
      ctx
    )

    expect(result).toEqual({
      id: 1,
      status: StackFeedbackStatus.UNANSWERED,
      score: undefined,
      evaluations: [],
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([
          {
            microLearning: {
              course: {
                id: 'course-id',
                isDeleted: false,
                isDeletionPending: false,
              },
            },
          },
        ]),
        id: 1,
      },
      select: { id: true },
    })
    expect(findUnique.mock.calls[0]?.[0].where.OR).toHaveLength(3)
  })
})
