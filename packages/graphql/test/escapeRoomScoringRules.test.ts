import { describe, expect, it } from 'vitest'
import { skipEscapeRoomStage } from '../src/services/escapeRooms.js'
import { parseEscapeRoomStageOutcomes } from '../src/services/escapeRoomStageOutcomes.js'
import { parseGroupEscapeRoomStageResponses } from '../src/services/groupEscapeRoomSubmissions.js'
import {
  courseId,
  createdParticipantIds,
  DB,
  groupScResponse,
  lecturerCtx,
  participantCtx,
  prisma,
  requestEscapeRoomHint,
  respondToElementStack,
  scElement,
  scResponse,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
  submitGroupActivityDecisions,
} from './escapeRoomTestHarness.js'

// Four stages: the first is revealed after two wrong answers and two hints,
// the second skipped, the third solved and the fourth is the bonus stage.
const RULES = {
  hintPenalties: [10, 20],
  wrongAnswerPenalty: 30,
  maxWrongAttempts: 2,
  revealPenalty: 100,
  skipPenalty: 200,
  bonusSeconds: 50,
  lockoutSeconds: 0,
}
const EXPECTED_PENALTY = 10 + 20 + 30 + 30 + 100 + 200
const EXPECTED_OUTCOMES = ['REVEALED', 'SKIPPED', 'SOLVED', 'BONUS_CORRECT']
const HINTS = [
  { text: 'first hint', penalty: null },
  { text: 'second hint', penalty: null },
]

describe('escape room scoring rules', () => {
  it('scores the same answer sequence identically in Practice Quiz and Group Activity', async () => {
    // Practice Quiz: one stack per stage.
    const quiz = await seedEscapeRoomQuiz(4)
    await prisma.escapeRoomConfig.update({
      where: { practiceQuizId: quiz.id },
      data: RULES,
    })
    const stackInstances = quiz.stacks.map((stack) => stack.elements[0]!)
    await prisma.elementInstance.update({
      where: { id: stackInstances[0]!.id },
      data: {
        options: { ...stackInstances[0]!.options, escapeRoomHints: HINTS },
      },
    })
    const participant = await seedParticipant('scoring-individual')
    const ctx = participantCtx(participant.id)
    await startEscapeRoomAttempt({ practiceQuizId: quiz.id }, ctx)

    const individualHints: Awaited<ReturnType<typeof requestEscapeRoomHint>>[] =
      []
    for (let i = 0; i < 3; i++) {
      individualHints.push(
        await requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId: stackInstances[0]!.id },
          ctx
        )
      )
    }
    expect(individualHints.map((result) => result!.hints)).toEqual([
      ['first hint'],
      ['first hint', 'second hint'],
      ['first hint', 'second hint'],
    ])
    expect(individualHints.at(-1)!.hasMoreHints).toBe(false)

    const answer = (stage: number, selectedIx: 0 | 1) =>
      respondToElementStack(
        {
          stackId: quiz.stacks[stage]!.id,
          courseId,
          responses: [scResponse(stackInstances[stage]!.id, selectedIx)],
          stackAnswerTime: 10,
        },
        ctx
      )
    await answer(0, 1)
    await answer(0, 1)
    await skipEscapeRoomStage({ practiceQuizId: quiz.id }, ctx)
    await answer(2, 0)
    const completedIndividual =
      await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: {
          participantId_practiceQuizId: {
            participantId: participant.id,
            practiceQuizId: quiz.id,
          },
        },
      })
    expect(completedIndividual.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    await answer(3, 0)
    await expect(answer(3, 0)).rejects.toThrow()

    const individual = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: completedIndividual.id },
    })
    const individualOutcomes = parseEscapeRoomStageOutcomes(
      individual.stageOutcomes
    )
    const individualByStage = quiz.stacks.map(
      (stack) =>
        individualOutcomes.find((entry) => entry.stageKey === String(stack.id))
          ?.outcome
    )

    // Group Activity: one answerable element per stage.
    const memberA = await seedParticipant(
      `scoring-a-${createdParticipantIds.length}`
    )
    const memberB = await seedParticipant(
      `scoring-b-${createdParticipantIds.length}`
    )
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [scElement, scElement, scElement, scElement],
        courseId,
        participantIds: [memberA.id, memberB.id],
        lockoutSeconds: 0,
      },
      lecturerCtx
    )
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: RULES,
    })
    const stages = fixture.groupActivity.stacks[0]!.elements
    await prisma.elementInstance.update({
      where: { id: stages[0]!.id },
      data: { options: { ...stages[0]!.options, escapeRoomHints: HINTS } },
    })
    const groupArgs = {
      groupActivityId: fixture.groupActivity.id,
      groupId: fixture.group.id,
    }
    await requestEscapeRoomHint(
      { ...groupArgs, instanceId: stages[0]!.id },
      participantCtx(memberA.id)
    )
    await requestEscapeRoomHint(
      { ...groupArgs, instanceId: stages[0]!.id },
      participantCtx(memberB.id)
    )
    const submit = (stage: number, selectedIx: 0 | 1, member = memberA) =>
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(stages[stage]!.id, selectedIx)],
        },
        participantCtx(member.id)
      )
    await expect(submit(0, 1)).rejects.toThrow('incorrect')
    await expect(submit(0, 1, memberB)).rejects.toThrow('revealed')
    await skipEscapeRoomStage(groupArgs, participantCtx(memberA.id))
    await submit(2, 0, memberB)
    await submit(3, 0)
    await expect(submit(3, 0)).rejects.toThrow()

    const group = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })
    const groupEntries = parseGroupEscapeRoomStageResponses(
      group.stageResponses
    )
    const groupByStage = stages.map(
      (stage) =>
        groupEntries.find((entry) => entry.instanceId === stage.id)?.outcome
    )
    const instance = await prisma.groupActivityInstance.findUniqueOrThrow({
      where: { id: fixture.activityInstance.id },
    })

    expect(individualByStage).toEqual(EXPECTED_OUTCOMES)
    expect(groupByStage).toEqual(EXPECTED_OUTCOMES)
    expect(individual.penaltySeconds).toBe(EXPECTED_PENALTY)
    expect(group.penaltySeconds).toBe(EXPECTED_PENALTY)
    expect(group.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    // Only the solved stage carries a team answer into the decisions.
    expect(instance.decisions).toHaveLength(1)
    expect(instance.decisionsSubmittedAt).not.toBeNull()
  })

  it('charges a concurrent skip by two team members only once', async () => {
    const memberA = await seedParticipant(
      `skip-race-a-${createdParticipantIds.length}`
    )
    const memberB = await seedParticipant(
      `skip-race-b-${createdParticipantIds.length}`
    )
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [scElement, scElement],
        courseId,
        participantIds: [memberA.id, memberB.id],
      },
      lecturerCtx
    )
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: { skipPenalty: 200 },
    })
    const groupArgs = {
      groupActivityId: fixture.groupActivity.id,
      groupId: fixture.group.id,
    }

    const results = await Promise.allSettled([
      skipEscapeRoomStage(groupArgs, participantCtx(memberA.id)),
      skipEscapeRoomStage(groupArgs, participantCtx(memberB.id)),
    ])

    const attempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(attempt.penaltySeconds).toBe(200)
    expect(parseGroupEscapeRoomStageResponses(attempt.stageResponses)).toEqual([
      expect.objectContaining({ outcome: 'SKIPPED', response: null }),
    ])
  })

  it('rejects skipping when the rules do not allow it', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const participant = await seedParticipant('scoring-no-skip')
    const ctx = participantCtx(participant.id)
    await startEscapeRoomAttempt({ practiceQuizId: quiz.id }, ctx)
    await expect(
      skipEscapeRoomStage({ practiceQuizId: quiz.id }, ctx)
    ).rejects.toThrow('Skipping is not enabled')
  })
})
