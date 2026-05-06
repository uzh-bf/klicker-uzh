import { describe, expect, it } from 'vitest'
import { createQuestionRefSync, verifyQuestionRef } from '../src/questionRef.js'
import type { QuestionRefPayload } from '../src/types.js'

const payload: QuestionRefPayload = {
  participantId: 'participant-1',
  chatbotId: 'chatbot-1',
  courseId: 'course-1',
  stackId: 12,
  orderedElements: [{ instanceId: 34, type: 'SC' }],
}

describe('question refs', () => {
  it('round-trips signed stack context', async () => {
    const token = createQuestionRefSync(payload, {
      secret: 'test-secret',
      ttlSeconds: 60,
    })

    await expect(
      verifyQuestionRef(
        token,
        {
          participantId: payload.participantId,
          chatbotId: payload.chatbotId,
          courseId: payload.courseId,
        },
        { secret: 'test-secret' }
      )
    ).resolves.toEqual(payload)
  })

  it('rejects refs for a different chatbot context', async () => {
    const token = createQuestionRefSync(payload, {
      secret: 'test-secret',
      ttlSeconds: 60,
    })

    await expect(
      verifyQuestionRef(
        token,
        {
          participantId: payload.participantId,
          chatbotId: 'other-chatbot',
          courseId: payload.courseId,
        },
        { secret: 'test-secret' }
      )
    ).rejects.toThrow(/does not match/i)
  })
})
