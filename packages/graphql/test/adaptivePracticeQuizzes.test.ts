import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { EventEmitter } from 'node:events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  abandonAdaptivePracticeQuizAttempt,
  getAdaptivePracticeQuizCohortResults,
  getAdaptivePracticeQuizResult,
  getAdaptivePracticeQuizState,
  restartAdaptivePracticeQuizAttempt,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
  withSerializableRetry,
} from '../src/services/adaptivePracticeQuizzes.js'

describe('adaptive practice quiz service', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('starts and resumes one attempt for an enrolled participant regardless of isActive', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )

    const [first, second] = await Promise.all([
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
    ])
    const resumed = await resumeAdaptivePracticeQuizAttempt(
      { attemptId: first.attemptId },
      participantCtx
    )
    const queried = await getAdaptivePracticeQuizState(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    expect(first).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
      answeredQuestions: 0,
      questionNumber: 1,
      maximumQuestions: 8,
      showTimer: true,
      canStartNewAttempt: false,
    })
    expect(first.servedItem).not.toBeNull()
    expect(second.attemptId).toBe(first.attemptId)
    expect(resumed.attemptId).toBe(first.attemptId)
    expect(queried?.attemptId).toBe(first.attemptId)
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { participantId: fixture.participantId },
      })
    ).toBe(1)
  })

  it('enforces the course rollout gate without deleting attempt history', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const ownerCtx = contextFor(fixture.ownerId, DB.UserRole.USER)
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })

    for (const operation of [
      () =>
        getAdaptivePracticeQuizState(
          { practiceQuizId: fixture.quizId },
          participantCtx
        ),
      () =>
        resumeAdaptivePracticeQuizAttempt(
          { attemptId: state.attemptId },
          participantCtx
        ),
      () =>
        restartAdaptivePracticeQuizAttempt(
          { attemptId: state.attemptId },
          participantCtx
        ),
      () =>
        submitAdaptivePracticeQuizResponse(
          {
            attemptId: state.attemptId,
            servedItemId: state.servedItem!.poolItemId,
            response: { choiceIndices: [0] },
          },
          participantCtx
        ),
    ]) {
      await expect(operation()).rejects.toMatchObject({
        extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
      })
    }

    await expect(
      abandonAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
    })
    await expect(
      getAdaptivePracticeQuizCohortResults(
        { practiceQuizId: fixture.quizId },
        ownerCtx
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: true },
    })
    let completed = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (
      completed.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    ) {
      completed = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: completed.attemptId,
          servedItemId: completed.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    }

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })
    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: completed.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      getAdaptivePracticeQuizCohortResults(
        { practiceQuizId: fixture.quizId },
        ownerCtx
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })

    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(2)
  })

  it('does not create an attempt while adaptive learning is disabled', async () => {
    const fixture = await createRuntimeFixture()
    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })

    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(0)
  })

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

  it('abandons attempts and suppresses small cohort distributions', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const abandoned = await abandonAdaptivePracticeQuizAttempt(
      { attemptId: state.attemptId },
      participantCtx
    )
    expect(abandoned).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
      servedItem: null,
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_IN_PROGRESS' },
    })

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(cohort).toMatchObject({
      cohortSize: null,
      suppressed: true,
      attemptSummary: {
        total: null,
        completed: null,
        inProgress: null,
        abandoned: null,
        suppressed: true,
        classified: null,
        capped: null,
        poolExhausted: null,
        stoppedInsufficientData: null,
        insufficientData: null,
        nearBoundary: null,
      },
    })
    expect(cohort.distributions.every(({ suppressed }) => suppressed)).toBe(
      true
    )
    expect(
      cohort.distributions.every(({ buckets }) => buckets.length === 0)
    ).toBe(true)
    expect(cohort.distributions).toContainEqual(
      expect.objectContaining({
        nodeKind: DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
        parentNodeId: expect.any(Number),
        depth: 1,
        order: 0,
      })
    )
  })

  it('suppresses a small insufficient-data cohort bucket', async () => {
    const fixture = await createRuntimeFixture()

    for (let index = 0; index < 10; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-cohort-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
          completedAt: new Date('2026-07-10T12:00:00.000Z'),
        },
      })
      const levelId =
        index < 5
          ? fixture.levelIds[0]!
          : index < 9
            ? fixture.levelIds[1]!
            : null
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: levelId === null ? null : index < 5 ? -1 : 1,
          standardError: levelId === null ? null : 0.5,
          responseCount: levelId === null ? 0 : 4,
          levelId,
          stopReason:
            levelId === null
              ? DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
              : DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
        },
      })
    }

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    const overall = cohort.distributions.find(
      ({ nodeKind }) => nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
    )

    expect(cohort.cohortSize).toBe(10)
    expect(overall).toMatchObject({
      suppressed: true,
      insufficientDataCount: null,
      buckets: [],
    })
  })

  it('publishes cohort results only at fixed five-participant boundaries', async () => {
    const fixture = await createRuntimeFixture()
    const lecturerCtx = contextFor(fixture.ownerId, DB.UserRole.USER)

    async function addCompletedAttempt(
      index: number,
      existing?: { participantId: string; participationId: number }
    ) {
      const participant = existing
        ? { id: existing.participantId }
        : await prisma.participant.create({
            data: {
              username: `adaptive-release-participant-${index}`,
              password: 'test',
            },
          })
      const participation = existing
        ? { id: existing.participationId }
        : await prisma.participation.create({
            data: {
              courseId: fixture.courseId,
              participantId: participant.id,
            },
          })
      const stopReason = DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason,
          completedAt: new Date(
            new Date('2026-07-10T13:00:00.000Z').getTime() + index * 1000
          ),
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: 0,
          standardError: 0.5,
          responseCount: 4,
          levelId: fixture.levelIds[1]!,
          stopReason,
        },
      })

      return {
        participantId: participant.id,
        participationId: participation.id,
      }
    }

    const releasedParticipants: {
      participantId: string
      participationId: number
    }[] = []
    for (let index = 0; index < 5; index++) {
      releasedParticipants.push(await addCompletedAttempt(index))
    }
    const firstRelease = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(firstRelease.cohortSize).toBe(5)

    await addCompletedAttempt(5, releasedParticipants[0])
    const afterRetake = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterRetake).toEqual(firstRelease)

    await addCompletedAttempt(6)
    const afterSixthParticipant = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterSixthParticipant).toEqual(firstRelease)

    for (let index = 7; index <= 10; index++) {
      await addCompletedAttempt(index)
    }
    const secondRelease = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(secondRelease.cohortSize).toBe(10)
    expect(secondRelease.attemptSummary.total).toBe(10)
  })

  it('summarizes selected outcomes and computes near-boundary counts', async () => {
    const fixture = await createRuntimeFixture()

    for (let index = 0; index < 20; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-summary-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const stopReason =
        index < 5
          ? DB.AdaptivePracticeQuizStopReason.CLASSIFIED
          : index < 10
            ? DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
            : index < 15
              ? DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
              : DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason,
          completedAt: new Date(
            new Date('2026-07-10T12:00:00.000Z').getTime() + index * 1000
          ),
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: index < 5 ? -1.5 : 0,
          standardError: 0.1,
          responseCount: 4,
          levelId: fixture.levelIds[1]!,
          stopReason,
        },
      })
    }

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(cohort.attemptSummary).toEqual({
      total: 20,
      completed: 20,
      inProgress: null,
      abandoned: null,
      suppressed: false,
      classified: 5,
      capped: 5,
      poolExhausted: 5,
      stoppedInsufficientData: 5,
      insufficientData: 0,
      nearBoundary: 5,
    })
  })

  it('computes privacy-safe pilot metrics from canonical responses', async () => {
    const fixture = await createRuntimeFixture()
    const poolItems = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { id: { in: fixture.poolItemIds.slice(0, 3) } },
      orderBy: { id: 'asc' },
    })
    expect(poolItems).toHaveLength(3)

    for (let index = 0; index < 38; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-pilot-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const poolItem =
        index < 30 ? poolItems[0]! : index < 35 ? poolItems[1]! : poolItems[2]!
      const correct = index < 21 || (index >= 30 && index < 35)
      const startedAt = new Date(
        new Date('2026-07-10T12:00:00.000Z').getTime() + index * 60_000
      )
      const elapsedSeconds = 60 + index
      const reportedElapsedSeconds = index === 0 ? null : elapsedSeconds
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
          startedAt,
          completedAt: new Date(startedAt.getTime() + elapsedSeconds * 1000),
          elapsedSeconds: reportedElapsedSeconds,
        },
      })
      await prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          assignmentId: poolItem.sourceAssignmentId,
          poolItemId: poolItem.id,
          elementId: poolItem.elementId,
          elementSnapshot: poolItem.elementData,
          order: 1,
          response: { choiceIndices: [correct ? 0 : 1] },
          normalizedResponse: { choiceIndices: [correct ? 0 : 1] },
          score: correct ? 1 : 0,
          correct,
          overallThetaBefore: 0,
          overallThetaAfter: correct ? 0.2 : -0.2,
          overallStandardErrorAfter: 0.9,
          elapsedSeconds: reportedElapsedSeconds,
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: correct ? 0.2 : -0.2,
          standardError: 0.9,
          responseCount: 1,
          levelId: fixture.levelIds[1]!,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
        },
      })
    }

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(cohort.pilotMetrics).toMatchObject({
      suppressed: false,
      medianQuestionCount: 1,
      p95QuestionCount: 1,
      medianElapsedSeconds: 77.5,
      p95ElapsedSeconds: 92.35,
      responseCountMismatchDetected: false,
      durationMissingDetected: true,
    })

    const diagnostic = cohort.itemDiagnostics.find(
      ({ poolItemId }) => poolItemId === poolItems[0]!.id
    )
    expect(diagnostic).toMatchObject({
      suppressed: false,
      responseCount: 30,
      exposureRate: 30 / 35,
      observedCorrectRate: 0.7,
      highExposure: true,
      misfitFlag: true,
    })
    expect(diagnostic?.expectedCorrectRate).toBeGreaterThan(0.9)
    expect(diagnostic?.residual).toBeLessThan(-0.2)

    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[1]!.id
      )
    ).toMatchObject({
      suppressed: false,
      responseCount: 5,
      residual: null,
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[2]!.id
      )
    ).toMatchObject({
      suppressed: false,
      responseCount: 0,
      exposureRate: 0,
      observedCorrectRate: null,
      expectedCorrectRate: null,
      residual: null,
    })
  })

  it('enforces lecturer permissions on the cohort GraphQL field', async () => {
    const fixture = await createRuntimeFixture()
    const outsider = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-outsider@example.com',
        shortname: 'adaptive-runtime-outsider',
      },
    })
    const reader = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-reader@example.com',
        shortname: 'adaptive-runtime-reader',
      },
    })
    const manager = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-manager@example.com',
        shortname: 'adaptive-runtime-manager',
      },
    })
    await prisma.derivedPermission.createMany({
      data: [
        {
          practiceQuizId: fixture.quizId,
          userId: reader.id,
          permissionLevel: DB.PermissionLevel.READ,
        },
        {
          practiceQuizId: fixture.quizId,
          userId: manager.id,
          permissionLevel: DB.PermissionLevel.ADMIN,
        },
      ],
    })
    const resolver = schema.getQueryType()!.getFields()
      .adaptivePracticeQuizCohortResults!.resolve!
    const info = {
      fieldName: 'adaptivePracticeQuizCohortResults',
    } as never

    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(fixture.participantId, DB.UserRole.PARTICIPANT),
        info
      )
    ).rejects.toMatchObject({ message: 'Unauthorized' })
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(outsider.id, DB.UserRole.USER),
        info
      )
    ).resolves.toBeNull()
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(manager.id, DB.UserRole.USER),
        info
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(reader.id, DB.UserRole.USER),
        info
      )
    ).resolves.toBeNull()
  })

  it.each([
    Object.assign(new Error('Prisma transaction conflict'), { code: 'P2034' }),
    Object.assign(new Error('PostgreSQL serialization conflict'), {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'TransactionWriteConflict',
            originalCode: '40001',
          },
        },
      },
    }),
  ])('returns a stable API error after retry exhaustion', async (error) => {
    const transaction = vi.fn().mockRejectedValue(error)
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => undefined)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_CONFLICT' },
    })
    expect(transaction).toHaveBeenCalledTimes(3)
  })
})

async function createRuntimeFixture({
  attemptSelectionPolicy = DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
}: {
  attemptSelectionPolicy?: DB.AdaptiveAttemptSelectionPolicy
} = {}) {
  const owner = await prisma.user.create({
    data: {
      id: '20000000-0000-4000-8000-000000000001',
      email: 'adaptive-runtime-owner@example.com',
      shortname: 'adaptive-runtime-owner',
    },
  })
  const course = await prisma.course.create({
    data: {
      name: 'adaptive-runtime-course',
      displayName: 'Adaptive runtime course',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
      pinCode: 4242,
      ownerId: owner.id,
      isAdaptiveLearningEnabled: true,
    },
  })
  const tree = await prisma.competenceTree.create({
    data: {
      name: 'adaptive-runtime-tree',
      displayName: 'Adaptive runtime tree',
      ownerId: owner.id,
      thetaMin: -3,
      thetaMax: 3,
      levelMappingRule: DB.AdaptiveLevelMappingRule.NEAREST,
    },
  })
  await prisma.competenceTreeCourse.create({
    data: { treeId: tree.id, courseId: course.id, linkedById: owner.id },
  })
  const levels = await Promise.all(
    ['Basic', 'Independent', 'Advanced'].map((label, order) =>
      prisma.competenceTreeLevel.create({
        data: { treeId: tree.id, label, order },
      })
    )
  )
  const firstRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Reading',
      order: 0,
      depth: 0,
      weight: 0.6,
    },
  })
  const firstLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Scanning',
      order: 0,
      depth: 1,
      parentId: firstRoot.id,
    },
  })
  const secondRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Grammar',
      order: 1,
      depth: 0,
      weight: 0.4,
    },
  })
  const secondLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Agreement',
      order: 0,
      depth: 1,
      parentId: secondRoot.id,
    },
  })
  for (const leafNodeId of [firstLeaf.id, secondLeaf.id]) {
    for (const level of levels) {
      await prisma.competenceTreeLeafLevelCoverage.create({
        data: {
          treeId: tree.id,
          leafNodeId,
          levelId: level.id,
          targetItemCount: 2,
        },
      })
    }
  }

  const quiz = await prisma.practiceQuiz.create({
    data: {
      name: 'adaptive-runtime-quiz',
      displayName: 'Adaptive runtime quiz',
      ownerId: owner.id,
      courseId: course.id,
      mode: DB.PracticeQuizMode.ADAPTIVE,
      status: DB.PublicationStatus.PUBLISHED,
      pointsMultiplier: 0,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
    },
  })
  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId: quiz.id,
      competenceTreeId: tree.id,
      preset:
        attemptSelectionPolicy ===
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
          ? DB.AdaptivePracticeQuizPreset.PLACEMENT
          : DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
      attemptSelectionPolicy,
      levelMappingRule:
        attemptSelectionPolicy ===
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
          ? DB.AdaptiveLevelMappingRule.MASTERY
          : DB.AdaptiveLevelMappingRule.NEAREST,
      totalQuestionCap: 8,
      perLeafQuestionCap: 4,
      minQuestionsPerLeaf: 1,
      classificationZ: 0.2,
      poolPublishedAt: new Date(),
    },
  })
  await prisma.practiceQuizAdaptiveNodeOverride.createMany({
    data: [
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstRoot.id,
        enabled: true,
        weight: 0.6,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstLeaf.id,
        enabled: true,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondRoot.id,
        enabled: true,
        weight: 0.4,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondLeaf.id,
        enabled: true,
      },
    ],
  })

  const poolItemIds: number[] = []
  const difficulties = [-2, -0.5, 0.5, 2]
  for (const [root, leaf] of [
    [firstRoot, firstLeaf],
    [secondRoot, secondLeaf],
  ] as const) {
    for (let index = 0; index < difficulties.length; index++) {
      const level = levels[Math.min(index, levels.length - 1)]!
      const element = await prisma.element.create({
        data: {
          type: DB.ElementType.SC,
          name: `Adaptive item ${root.id}-${index}`,
          content: `Adaptive item pending`,
          options: choiceOptions(0),
          ownerId: owner.id,
        },
      })
      const assignment = await prisma.competenceTreeElementAssignment.create({
        data: {
          treeId: tree.id,
          elementId: element.id,
          leafNodeId: leaf.id,
          levelId: level.id,
        },
      })
      const itemData = elementData(element, `Adaptive item pending`)
      const poolItem = await prisma.practiceQuizAdaptivePoolItem.create({
        data: {
          configId: config.id,
          competenceTreeId: tree.id,
          sourceAssignmentId: assignment.id,
          elementId: element.id,
          elementVersion: element.version,
          elementType: element.type,
          elementName: element.name,
          elementData: itemData,
          leafNodeId: leaf.id,
          nodePath: [root.id, leaf.id],
          nodeNamePath: [root.name, leaf.name],
          levelId: level.id,
          levelLabel: level.label,
          levelOrder: level.order,
          discrimination: 1.2,
          difficulty: difficulties[index]!,
          guessing: 0.5,
        },
      })
      await prisma.element.update({
        where: { id: element.id },
        data: { content: `Adaptive item ${poolItem.id}` },
      })
      await prisma.practiceQuizAdaptivePoolItem.update({
        where: { id: poolItem.id },
        data: {
          elementData: elementData(
            { ...element, content: `Adaptive item ${poolItem.id}` },
            `Adaptive item ${poolItem.id}`
          ),
        },
      })
      poolItemIds.push(poolItem.id)
    }
  }

  const participant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-participant', password: 'test' },
  })
  const otherParticipant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-other', password: 'test' },
  })
  await prisma.participation.createMany({
    data: [
      { courseId: course.id, participantId: participant.id, isActive: false },
    ],
  })

  return {
    ownerId: owner.id,
    courseId: course.id,
    treeId: tree.id,
    configId: config.id,
    quizId: quiz.id,
    levelIds: levels.map(({ id }) => id),
    participantId: participant.id,
    otherParticipantId: otherParticipant.id,
    poolItemIds,
  }
}

function choiceOptions(correctIndex: number) {
  return {
    displayMode: 'LIST',
    choices: [
      { ix: 0, value: 'A', correct: correctIndex === 0 },
      { ix: 1, value: 'B', correct: correctIndex === 1 },
    ],
  }
}

function elementData(
  element: Pick<
    DB.Element,
    'id' | 'version' | 'name' | 'type' | 'pointsMultiplier'
  > & { content: string },
  content: string
): ElementData {
  return {
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
    type: element.type,
    name: element.name,
    content,
    pointsMultiplier: element.pointsMultiplier,
    options: choiceOptions(0),
  } as ElementData
}

function contextFor(subject: string, role: DB.UserRole): ContextWithUser {
  return {
    prisma,
    user: {
      sub: subject,
      role,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    emitter: new EventEmitter(),
    redisExec: {} as ContextWithUser['redisExec'],
    redisAssessmentExec: {} as ContextWithUser['redisAssessmentExec'],
    pubSub: {} as ContextWithUser['pubSub'],
    hatchet: {} as ContextWithUser['hatchet'],
    tasks: {} as ContextWithUser['tasks'],
    req: {} as ContextWithUser['req'],
    res: {} as ContextWithUser['res'],
  }
}
