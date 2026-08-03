import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import {
  getAdaptivePracticeQuizResult,
  getAdaptivePracticeQuizState,
  restartAdaptivePracticeQuizAttempt,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
} from '../src/services/adaptivePracticeQuizzes.js'

import {
  choiceOptions,
  contextFor,
  createRuntimeFixture,
} from './adaptivePracticeQuizRuntimeTestSupport.js'

export function registerAdaptivePracticeQuizAttemptFlowTests() {
  it('preserves missing response timing and rejects implausible durations', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 86_401,
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ELAPSED_SECONDS_INVALID' },
    })

    const afterMissingTiming = await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: state.servedItem!.poolItemId,
        response: { choiceIndices: [0] },
        elapsedSeconds: null,
      },
      participantCtx
    )
    expect(afterMissingTiming.status).toBe(
      DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    )
    expect(afterMissingTiming.elapsedSeconds).toBeNull()
    await expect(
      getAdaptivePracticeQuizState(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({ elapsedSeconds: null })
    await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: afterMissingTiming.servedItem!.poolItemId,
        response: { choiceIndices: [0] },
        elapsedSeconds: 3,
      },
      participantCtx
    )

    const stored = await prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
      where: { id: state.attemptId },
      include: { responses: { orderBy: { order: 'asc' } } },
    })
    expect(stored.elapsedSeconds).toBeNull()
    expect(
      stored.responses.map(({ elapsedSeconds }) => elapsedSeconds)
    ).toEqual([null, 3])
  })

  it('atomically restarts active attempts but blocks retakes under first-completed policy', async () => {
    const fixture = await createRuntimeFixture({
      attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
    })
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const first = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    let replacement = await restartAdaptivePracticeQuizAttempt(
      { attemptId: first.attemptId },
      participantCtx
    )
    expect(replacement.attemptId).not.toBe(first.attemptId)
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
        where: { id: first.attemptId },
      })
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
    })

    while (
      replacement.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    ) {
      replacement = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: replacement.attemptId,
          servedItemId: replacement.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    }

    await expect(
      getAdaptivePracticeQuizState(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({
      attemptId: replacement.attemptId,
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      canStartNewAttempt: false,
      servedItem: null,
    })

    const retakes = await Promise.allSettled([
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
    ])
    expect(retakes).toHaveLength(2)
    expect(
      retakes.every(
        (retake) =>
          retake.status === 'rejected' &&
          retake.reason?.extensions?.code === 'ADAPTIVE_RETAKE_FORBIDDEN'
      )
    ).toBe(true)
  })

  it('enforces the published retake cooldown independently of later quiz edits', async () => {
    const fixture = await createRuntimeFixture({ resetTimeDays: 2 })
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    let state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      state = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    }

    await prisma.practiceQuiz.update({
      where: { id: fixture.quizId },
      data: { resetTimeDays: 0 },
    })
    await prisma.practiceQuizAdaptiveConfig.update({
      where: { practiceQuizId: fixture.quizId },
      data: { showTimer: false, totalQuestionCap: 7 },
    })
    await expect(
      getAdaptivePracticeQuizState(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({
      attemptId: state.attemptId,
      maximumQuestions: 8,
      showTimer: true,
      canStartNewAttempt: false,
    })
    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_RETAKE_COOLDOWN' },
    })

    await prisma.adaptivePracticeQuizAttempt.update({
      where: { id: state.attemptId },
      data: { completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    })
    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
    })
  })

  it('rejects foreign attempts, arbitrary pool items, and replayed responses', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const otherCtx = contextFor(
      fixture.otherParticipantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const servedItemId = state.servedItem!.poolItemId
    const arbitraryItemId = fixture.poolItemIds.find(
      (poolItemId) => poolItemId !== servedItemId
    )!

    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_PARTICIPATION_REQUIRED' },
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_FOUND' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: arbitraryItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ITEM_NOT_SERVED' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_FOUND' },
    })

    const concurrent = await Promise.allSettled([
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      ),
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      ),
    ])
    expect(
      concurrent.filter(({ status }) => status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      concurrent.filter(({ status }) => status === 'rejected')
    ).toHaveLength(1)
    expect(
      (
        concurrent.find(
          ({ status }) => status === 'rejected'
        ) as PromiseRejectedResult
      ).reason
    ).toMatchObject({
      extensions: { code: 'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED' },
    })
    expect(
      await prisma.adaptivePracticeQuizResponse.count({
        where: { attemptId: state.attemptId },
      })
    ).toBe(1)
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED' },
    })
  })

  it('grades and snapshots the immutable published pool after source edits', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const poolItem =
      await prisma.practiceQuizAdaptivePoolItem.findUniqueOrThrow({
        where: { id: state.servedItem!.poolItemId },
      })
    await prisma.element.update({
      where: { id: poolItem.elementId },
      data: {
        isDeleted: true,
        version: { increment: 1 },
        content: 'Changed after publication',
        options: choiceOptions(1),
      },
    })

    await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: poolItem.id,
        response: { choiceIndices: [0] },
      },
      participantCtx
    )
    const response = await prisma.adaptivePracticeQuizResponse.findFirstOrThrow(
      { where: { attemptId: state.attemptId } }
    )
    const snapshot = response.elementSnapshot as ElementData

    expect(response).toMatchObject({ score: 1, correct: true })
    expect(snapshot.content).toBe(`Adaptive item ${poolItem.id}`)
    expect(
      (snapshot.options as { choices: Array<{ correct?: boolean }> }).choices[0]
        ?.correct
    ).toBe(true)
  })

  it('completes with hierarchical estimates and participant-safe level-band results', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const participantBefore = await prisma.participant.findUniqueOrThrow({
      where: { id: fixture.participantId },
    })
    let state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      state = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 3,
        },
        participantCtx
      )
    }

    const result = await getAdaptivePracticeQuizResult(
      { attemptId: state.attemptId },
      participantCtx
    )
    const estimates = await prisma.adaptivePracticeQuizEstimate.findMany({
      where: { attemptId: state.attemptId },
    })
    const participantAfter = await prisma.participant.findUniqueOrThrow({
      where: { id: fixture.participantId },
    })

    expect(state).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      answeredQuestions: 8,
      canStartNewAttempt: true,
      servedItem: null,
      elapsedSeconds: 24,
    })
    expect(result.levelLabel).not.toBeNull()
    expect(result.levelInterpretation).toBe(DB.AdaptiveLevelMappingRule.NEAREST)
    expect(result.confidence).not.toBe('INSUFFICIENT_DATA')
    expect(result.levelBands).toHaveLength(3)
    expect(result.competenceProfile).toHaveLength(2)
    expect(
      result.competenceProfile.every((node) => node.children.length === 1)
    ).toBe(true)
    expect(result.trajectory.length).toBeGreaterThan(0)
    expect(result.trajectory[0]?.levelLabel).toBeNull()
    expect(result.trajectory.at(-1)?.levelLabel).not.toBeNull()
    expect(result.trajectory.at(-1)?.levelLabel).toBe(result.levelLabel)
    expect(result.trajectory.at(-1)?.position).toBe(result.position)
    expect(result.trajectory.at(-1)?.lowerPosition).toBe(result.lowerPosition)
    expect(result.trajectory.at(-1)?.upperPosition).toBe(result.upperPosition)
    expect(estimates).toHaveLength(5)
    expect(estimates.every((estimate) => estimate.responseCount > 0)).toBe(true)
    expect(
      estimates
        .filter(
          (estimate) =>
            estimate.nodeKind === DB.AdaptiveEstimateNodeKind.COMPETENCE
        )
        .every(
          (estimate) =>
            estimate.stopReason === DB.AdaptivePracticeQuizStopReason.CLASSIFIED
        )
    ).toBe(true)

    expect(participantAfter.xp).toBe(participantBefore.xp)
    expect(await prisma.questionResponse.count()).toBe(0)
    expect(await prisma.questionResponseDetail.count()).toBe(0)
    expect(await prisma.leaderboardEntry.count()).toBe(0)
    expect(await prisma.timelineEntry.count()).toBe(0)
    expect(await prisma.adaptivePracticeQuizCohortSnapshot.count()).toBe(0)

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('standardError')
    expect(serialized).not.toContain('theta')
    expect(serialized).not.toContain('solutions')

    await prisma.adaptivePracticeQuizEstimate.updateMany({
      where: {
        attemptId: state.attemptId,
        nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      },
      data: { responseCount: result.answeredQuestions - 1 },
    })
    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_DATA_INVALID' },
    })

    const retake = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    expect(retake.attemptId).not.toBe(state.attemptId)
    expect(retake.canStartNewAttempt).toBe(false)
  })

  it('exposes mastery interpretation for placement results', async () => {
    const fixture = await createRuntimeFixture({
      attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
    })
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    let state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      state = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 1,
        },
        participantCtx
      )
    }

    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      levelInterpretation: DB.AdaptiveLevelMappingRule.MASTERY,
    })
  })
}
