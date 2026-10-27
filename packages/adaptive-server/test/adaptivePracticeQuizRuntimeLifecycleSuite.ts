import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { assertAdaptiveV2DiagnosticAttemptStartEnabled } from '../src/services/adaptivePracticeQuizCommandSupport.js'
import {
  getAdaptivePracticeQuizResult,
  getAdaptivePracticeQuizState,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
} from '../src/services/adaptivePracticeQuizzes.js'

import {
  contextFor,
  createRuntimeFixture,
} from './adaptivePracticeQuizRuntimeTestSupport.js'
import { itWithAdaptiveEngine } from './adaptiveEngineTestEnv.js'

export function registerAdaptivePracticeQuizRuntimeLifecycleTests() {
  it('keeps new v2 Diagnostic attempts behind the internal release gate', () => {
    expect(() =>
      assertAdaptiveV2DiagnosticAttemptStartEnabled({
        publication: {
          measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
          preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        },
      } as never)
    ).toThrowError(
      expect.objectContaining({
        extensions: {
          code: 'ADAPTIVE_V2_DIAGNOSTIC_RELEASE_DISABLED',
        },
      })
    )

    expect(() =>
      assertAdaptiveV2DiagnosticAttemptStartEnabled({
        publication: {
          measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
          preset: DB.AdaptivePracticeQuizPreset.RESEARCH,
        },
      } as never)
    ).not.toThrow()
    expect(() =>
      assertAdaptiveV2DiagnosticAttemptStartEnabled({
        publication: {
          measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
          preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        },
      } as never)
    ).not.toThrow()
  })

  itWithAdaptiveEngine(
    'starts and resumes one attempt for an enrolled participant regardless of isActive',
    async () => {
      const fixture = await createRuntimeFixture()
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )

      const starts = await Promise.all(
        Array.from({ length: 6 }, () =>
          startAdaptivePracticeQuizAttempt(
            { practiceQuizId: fixture.quizId },
            participantCtx
          )
        )
      )
      const first = starts[0]!
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
        elapsedSeconds: null,
        showTimer: true,
        canStartNewAttempt: false,
      })
      expect(first.servedItem).not.toBeNull()
      expect(new Set(starts.map(({ attemptId }) => attemptId))).toEqual(
        new Set([first.attemptId])
      )
      expect(resumed.attemptId).toBe(first.attemptId)
      expect(queried?.attemptId).toBe(first.attemptId)
      expect(
        await prisma.adaptivePracticeQuizAttempt.count({
          where: { participantId: fixture.participantId },
        })
      ).toBe(1)
    }
  )

  itWithAdaptiveEngine(
    'expires a paused attempt at its wall-clock deadline without recording a late response',
    async () => {
      const fixture = await createRuntimeFixture({ timeLimitSeconds: 60 })
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )
      const state = await startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
      const expiredStartedAt = new Date(Date.now() - 60_001)
      const deadline = new Date(expiredStartedAt.getTime() + 60_000)
      await prisma.adaptivePracticeQuizAttempt.update({
        where: { id: state.attemptId },
        data: { startedAt: expiredStartedAt },
      })

      const timedOut = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
      expect(timedOut).toMatchObject({
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        stopReason: DB.AdaptivePracticeQuizStopReason.TIME_LIMIT,
        answeredQuestions: 0,
        elapsedSeconds: 60,
        timeLimitSeconds: 60,
        deadlineAt: deadline,
        servedItem: null,
      })
      await expect(
        prisma.adaptivePracticeQuizResponse.count({
          where: { attemptId: state.attemptId },
        })
      ).resolves.toBe(0)
      await expect(
        resumeAdaptivePracticeQuizAttempt(
          { attemptId: state.attemptId },
          participantCtx
        )
      ).resolves.toMatchObject({
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        stopReason: DB.AdaptivePracticeQuizStopReason.TIME_LIMIT,
      })
      await expect(
        getAdaptivePracticeQuizResult(
          { attemptId: state.attemptId },
          participantCtx
        )
      ).resolves.toMatchObject({
        stopReason: DB.AdaptivePracticeQuizStopReason.TIME_LIMIT,
        answeredQuestions: 0,
      })
    }
  )

  itWithAdaptiveEngine(
    'seals a Bayesian result when an attempt expires before its first response',
    async () => {
      const fixture = await createRuntimeFixture({
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        timeLimitSeconds: 60,
      })
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )
      const state = await startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
      await prisma.adaptivePracticeQuizAttempt.update({
        where: { id: state.attemptId },
        data: { startedAt: new Date(Date.now() - 60_001) },
      })

      await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )

      await expect(
        getAdaptivePracticeQuizResult(
          { attemptId: state.attemptId },
          participantCtx
        )
      ).resolves.toMatchObject({
        stopReason: DB.AdaptivePracticeQuizStopReason.TIME_LIMIT,
        answeredQuestions: 0,
      })
    }
  )

  itWithAdaptiveEngine(
    'runs Research through Bayesian EAP while excluding field tests from proficiency',
    async () => {
      const fixture = await createRuntimeFixture({
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
      })
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )
      let state = await startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
      while (
        state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
      ) {
        state = await submitAdaptivePracticeQuizResponse(
          {
            attemptId: state.attemptId,
            servedItemId: state.servedItem!.poolItemId,
            response: { choiceIndices: [0] },
          },
          participantCtx
        )
      }

      const attempt =
        await prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
          where: { id: state.attemptId },
          include: { responses: { orderBy: { order: 'asc' } } },
        })
      const exposures = await prisma.adaptivePracticeQuizItemExposure.findMany({
        where: { publicationId: attempt.publicationId },
      })
      const fieldTests = attempt.responses.filter(
        ({ itemRole }) => itemRole === DB.AdaptivePoolItemRole.FIELD_TEST
      )

      expect(attempt).toMatchObject({
        status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        resultStatus: DB.AdaptiveResultStatus.RESEARCH_ONLY,
        finalLevelId: null,
        finalScaleLevelId: null,
        nextPoolItemId: null,
        nextItemRole: null,
      })
      expect(attempt.responses).toHaveLength(8)
      expect(fieldTests).toHaveLength(2)
      expect(
        fieldTests.every(
          (response) =>
            response.overallThetaBefore === response.overallThetaAfter
        )
      ).toBe(true)
      expect(
        attempt.responses.every(
          (response) =>
            response.administrationProbability !== null &&
            response.randomizationVersion !== null &&
            response.randomDraw !== null &&
            response.candidateSetHash !== null &&
            response.collectionDesignVersion !== null
        )
      ).toBe(true)
      expect(
        exposures.reduce((sum, exposure) => sum + exposure.servedCount, 0n)
      ).toBe(8n)
      expect(
        exposures.reduce((sum, exposure) => sum + exposure.answeredCount, 0n)
      ).toBe(8n)
      expect(state.submittedResponseFeedback).toBeNull()
      const result = await getAdaptivePracticeQuizResult(
        { attemptId: state.attemptId },
        participantCtx
      )
      expect(result).toMatchObject({
        classification: DB.AdaptiveResultStatus.RESEARCH_ONLY,
        levelLabel: null,
        leadingLevelLabels: [],
        classificationProbability: null,
        position: null,
        lowerPosition: null,
        upperPosition: null,
        levelBands: [],
        trajectory: [],
      })
      const resultNodes = result!.competenceProfile.flatMap(
        function flatten(node): typeof result.competenceProfile {
          return [node, ...node.children.flatMap(flatten)]
        }
      )
      expect(resultNodes).not.toHaveLength(0)
      expect(
        resultNodes.every(
          (node) =>
            node.classification === DB.AdaptiveResultStatus.RESEARCH_ONLY &&
            node.levelLabel === null &&
            node.leadingLevelLabels.length === 0 &&
            node.classificationProbability === null &&
            node.position === null &&
            node.lowerPosition === null &&
            node.upperPosition === null
        )
      ).toBe(true)
    }
  )

  itWithAdaptiveEngine(
    'computes v2 shadow output for legacy Research without changing its result',
    async () => {
      const fixture = await createRuntimeFixture({
        preset: DB.AdaptivePracticeQuizPreset.RESEARCH,
      })
      const participantCtx = contextFor(
        fixture.participantId,
        DB.UserRole.PARTICIPANT
      )
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      let state = await startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
      while (
        state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
      ) {
        state = await submitAdaptivePracticeQuizResponse(
          {
            attemptId: state.attemptId,
            servedItemId: state.servedItem!.poolItemId,
            response: { choiceIndices: [0] },
          },
          participantCtx
        )
      }

      const persisted =
        await prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
          where: { id: state.attemptId },
        })
      expect(persisted.measurementVersion).toBe(
        DB.AdaptiveMeasurementVersion.IRT_V1
      )
      expect(persisted.resultStatus).toBeNull()
      expect(persisted.finalLevelId).not.toBeNull()

      const shadowLine = info.mock.calls
        .map(([line]) => String(line))
        .find((line) => line.includes('adaptive_irt_shadow_'))
      expect(shadowLine).toContain('adaptive_irt_shadow_computed')
      expect(shadowLine).not.toMatch(/participant|attempt|response|solution/i)
      info.mockRestore()
    }
  )
}
