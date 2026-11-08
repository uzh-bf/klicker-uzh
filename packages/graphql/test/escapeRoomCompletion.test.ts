import * as DB from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import { isEscapeRoomStackCleared } from '../src/services/escapeRooms.js'
import {
  courseId,
  participantCtx,
  prisma,
  respondToElementStack,
  scResponse,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
} from './escapeRoomTestHarness.js'

// ! Escape room completion
// #region
describe('respondToElementStack - escape room completion', () => {
  it('keeps a content-only stack active until its read response is persisted', () => {
    expect(
      isEscapeRoomStackCleared([
        { elementType: DB.ElementType.CONTENT, responses: [] },
      ])
    ).toBe(false)
    expect(
      isEscapeRoomStackCleared([
        {
          elementType: DB.ElementType.CONTENT,
          responses: [
            { lastResponseCorrectness: DB.ResponseCorrectness.CORRECT },
          ],
        },
      ])
    ).toBe(true)
  })

  it('completes the attempt exactly once when the last remaining stack is answered correctly', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const stack0 = quiz.stacks[0]!
    const stack1 = quiz.stacks[1]!
    const participant = await seedParticipant('completion')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    // answer stack 0 correctly first (required by sequential gating)
    await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(stack0.elements[0]!.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )

    // answer stack 1 (the last remaining stack) correctly -> completes the attempt
    const result = await respondToElementStack(
      {
        stackId: stack1.id,
        courseId,
        responses: [scResponse(stack1.elements[0]!.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    expect(result!.status).toBe(StackFeedbackStatus.CORRECT)

    const attemptWhere = {
      participantId_practiceQuizId: {
        participantId: participant.id,
        practiceQuizId: quiz.id,
      },
    }
    const completedAttempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: attemptWhere,
    })
    expect(completedAttempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    expect(completedAttempt.completedAt).not.toBeNull()

    // A second correct submit to the (now completed) last stack does not
    // silently re-run the completion update. The attempt is no longer
    // IN_PROGRESS, so respondToElementStack rejects it via the same guard
    // that normally requires an active attempt for a participant - this
    // proves the completion update above fired exactly once, since
    // completedAt is unchanged afterwards.
    await expect(
      respondToElementStack(
        {
          stackId: stack1.id,
          courseId,
          responses: [scResponse(stack1.elements[0]!.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('No active escape room attempt found for this activity')

    const attemptAfterSecondSubmit =
      await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: attemptWhere,
      })
    expect(attemptAfterSecondSubmit.completedAt?.getTime()).toBe(
      completedAttempt.completedAt?.getTime()
    )
  })
})
// #endregion
