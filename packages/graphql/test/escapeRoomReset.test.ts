import * as DB from '@klicker-uzh/prisma/client'
import { getEscapeRoomLifecycleClaimKey } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  courseId,
  createdUserIds,
  createUserCtx,
  getGradingGroupActivity,
  lecturerCtx,
  participantCtx,
  prisma,
  recomputeDerivedPermissions,
  resetEscapeRoomAttempt,
  scElement,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
  TEST_PREFIX,
} from './escapeRoomTestHarness.js'

// ! B2: lecturer-only reset
// #region
describe('resetEscapeRoomAttempt - lecturer-only reset (B2)', () => {
  it('allows the owning lecturer (with write access) to reset a participant attempt, deleting it', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    await recomputeDerivedPermissions(
      { practiceQuizId: quiz.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const participant = await seedParticipant('reset-owner')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    const result = await resetEscapeRoomAttempt(
      { practiceQuizId: quiz.id, participantId: participant.id },
      lecturerCtx
    )
    expect(result).toBe(true)

    const attemptAfter = await prisma.escapeRoomAttempt.findUnique({
      where: {
        participantId_practiceQuizId: {
          participantId: participant.id,
          practiceQuizId: quiz.id,
        },
      },
    })
    expect(attemptAfter).toBeNull()
  })

  it('refuses to reset while the attempt is processing a response', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    await recomputeDerivedPermissions(
      { practiceQuizId: quiz.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const participant = await seedParticipant('reset-processing')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    const claimKey = getEscapeRoomLifecycleClaimKey(
      'practiceQuiz',
      quiz.id,
      participant.id
    )
    await lecturerCtx.redisExec.set(
      claimKey,
      'in-flight-response',
      'EX',
      300,
      'NX'
    )

    await expect(
      resetEscapeRoomAttempt(
        { practiceQuizId: quiz.id, participantId: participant.id },
        lecturerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' },
    })
    expect(
      await prisma.escapeRoomAttempt.findUnique({ where: { id: attempt.id } })
    ).not.toBeNull()

    await lecturerCtx.redisExec.eval('', 1, claimKey, 'in-flight-response')
  })

  it('rejects a participant caller with the lecturer-only error', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const participant = await seedParticipant('reset-participant')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    await expect(
      resetEscapeRoomAttempt(
        { practiceQuizId: quiz.id, participantId: participant.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Only lecturers can reset escape room attempts')
  })

  it('rejects a lecturer without write access to the quiz', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const participant = await seedParticipant('reset-no-access')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    const otherLecturer = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-other-lecturer@example.com`,
        shortname: `${TEST_PREFIX}-other-lecturer`,
        role: DB.UserRole.USER,
      },
    })
    createdUserIds.push(otherLecturer.id)
    const otherLecturerCtx = createUserCtx(otherLecturer.id, DB.UserRole.USER)

    await expect(
      resetEscapeRoomAttempt(
        { practiceQuizId: quiz.id, participantId: participant.id },
        otherLecturerCtx
      )
    ).rejects.toThrow('You do not have write access to this activity')
  })

  it('resets only the authorized shared group state', async () => {
    const participantA = await seedParticipant('group-reset-a')
    const participantB = await seedParticipant('group-reset-b')
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [scElement],
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    )
    await recomputeDerivedPermissions(
      {
        groupActivityId: fixture.groupActivity.id,
        userId: lecturerCtx.user.sub,
      },
      prisma
    )
    const otherLecturer = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-group-reset-reader@example.com`,
        shortname: `${TEST_PREFIX}-group-reset-reader`,
        role: DB.UserRole.USER,
      },
    })
    createdUserIds.push(otherLecturer.id)

    const ownerView = await getGradingGroupActivity(
      { id: fixture.groupActivity.id },
      lecturerCtx
    )
    expect(ownerView?.escapeRoomConfig).toMatchObject({
      timeLimit: 3600,
      lockoutSeconds: 5,
    })
    expect(ownerView?.canResetEscapeRoom).toBe(true)
    expect(
      (
        await getGradingGroupActivity(
          { id: fixture.groupActivity.id },
          createUserCtx(otherLecturer.id)
        )
      )?.canResetEscapeRoom
    ).toBe(false)

    await expect(
      resetEscapeRoomAttempt(
        {
          groupActivityId: fixture.groupActivity.id,
          groupId: fixture.group.id,
        },
        createUserCtx(otherLecturer.id)
      )
    ).rejects.toThrow('You do not have write access')
    expect(
      await prisma.escapeRoomAttempt.findUnique({
        where: { id: fixture.attempt.id },
      })
    ).not.toBeNull()

    await expect(
      resetEscapeRoomAttempt(
        {
          groupActivityId: fixture.groupActivity.id,
          groupId: fixture.group.id,
        },
        lecturerCtx
      )
    ).resolves.toBe(true)
    expect(
      await prisma.escapeRoomAttempt.findUnique({
        where: { id: fixture.attempt.id },
      })
    ).toBeNull()
    expect(
      await prisma.groupActivityInstance.findUnique({
        where: { id: fixture.activityInstance.id },
      })
    ).toBeNull()
  })
})
// #endregion
