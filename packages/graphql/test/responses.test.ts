import { StackFeedbackStatus } from '@klicker-uzh/types'
import { combineStackStatus } from '../src/services/practiceQuizzes.js'

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
})
