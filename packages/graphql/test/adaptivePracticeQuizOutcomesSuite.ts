import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  abandonAdaptivePracticeQuizAttempt,
  getAdaptivePracticeQuizCohortResults,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  withSerializableRetry,
} from '../src/services/adaptivePracticeQuizzes.js'

import {
  contextFor,
  createRuntimeFixture,
} from './adaptivePracticeQuizRuntimeTestSupport.js'

export function registerAdaptivePracticeQuizOutcomeTests() {
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
          ...fixture.publicationIdentity,
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
    expect(cohort.attemptSummary).toMatchObject({
      suppressed: true,
      capped: 10,
      insufficientData: null,
    })
    expect(cohort.attemptSummary.suppressions).toContainEqual({
      field: 'INSUFFICIENT_DATA',
      reason: 'SMALL_CELL_OR_COMPLEMENT',
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
          ...fixture.publicationIdentity,
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
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => {})
    const concurrentFirstReads = await Promise.all(
      Array.from({ length: 6 }, () =>
        getAdaptivePracticeQuizCohortResults(
          { practiceQuizId: fixture.quizId },
          lecturerCtx
        )
      )
    )
    expect(errorOutput.mock.calls.flat().join('\n')).not.toContain(
      '"event":"adaptive_cohort_snapshot","outcome":"FAILED"'
    )
    errorOutput.mockRestore()
    const firstRelease = concurrentFirstReads[0]!
    expect(concurrentFirstReads).toEqual(
      Array.from({ length: 6 }, () => firstRelease)
    )
    expect(firstRelease.cohortSize).toBe(5)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
        where: { configId: fixture.configId },
        select: {
          releaseSize: true,
          policyVersion: true,
          aggregate: true,
          invalidatedAt: true,
        },
      })
    ).toEqual([
      {
        releaseSize: 5,
        policyVersion: 2,
        aggregate: expect.objectContaining({ schemaVersion: 2 }),
        invalidatedAt: null,
      },
    ])

    await addCompletedAttempt(5, releasedParticipants[0])
    const afterRetake = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterRetake).toEqual(firstRelease)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: { configId: fixture.configId },
      })
    ).toBe(1)

    releasedParticipants.push(await addCompletedAttempt(6))
    const afterSixthParticipant = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterSixthParticipant).toEqual(firstRelease)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: { configId: fixture.configId },
      })
    ).toBe(1)

    for (let index = 7; index <= 10; index++) {
      releasedParticipants.push(await addCompletedAttempt(index))
    }
    const secondRelease = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(secondRelease.cohortSize).toBe(10)
    const snapshots = await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
      where: { configId: fixture.configId },
      orderBy: { releaseSize: 'asc' },
    })
    expect(snapshots.map(({ releaseSize }) => releaseSize)).toEqual([5, 10])
    expect(
      snapshots.every(
        ({ policyVersion, aggregate }) =>
          policyVersion === 2 && aggregate.schemaVersion === 2
      )
    ).toBe(true)
    const serializedSnapshots = JSON.stringify(snapshots)
    expect(serializedSnapshots).not.toContain('participantId')
    expect(serializedSnapshots).not.toContain('attemptId')
    expect(serializedSnapshots).not.toContain('adaptive-release-participant')
    expect(serializedSnapshots).not.toContain('normalizedResponse')

    await prisma.participant.delete({
      where: { id: releasedParticipants.at(-1)!.participantId },
    })
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: {
          configId: fixture.configId,
          invalidatedAt: { not: null },
        },
      })
    ).toBe(2)
    const afterDeletion = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    const afterRepeatedPolling = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterDeletion).toEqual(firstRelease)
    expect(afterRepeatedPolling).toEqual(afterDeletion)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
        where: { configId: fixture.configId },
        orderBy: { releaseSize: 'asc' },
        select: { releaseSize: true, invalidatedAt: true },
      })
    ).toEqual([
      { releaseSize: 5, invalidatedAt: null },
      { releaseSize: 10, invalidatedAt: expect.any(Date) },
    ])
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
          ...fixture.publicationIdentity,
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
      suppressed: false,
      suppressions: [],
      classified: 5,
      betweenLevels: 0,
      insufficientEvidence: 10,
      poolLimited: 5,
      researchOnly: 0,
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
      where: { id: { in: fixture.poolItemIds.slice(0, 5) } },
      orderBy: { id: 'asc' },
    })
    expect(poolItems).toHaveLength(5)

    for (let index = 0; index < 43; index++) {
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
        index < 30
          ? poolItems[0]!
          : index < 35
            ? poolItems[1]!
            : index < 39
              ? poolItems[2]!
              : poolItems[3]!
      const correct = index < 21 || (index >= 30 && index < 35)
      const startedAt = new Date(
        new Date('2026-07-10T12:00:00.000Z').getTime() + index * 60_000
      )
      const elapsedSeconds = 60 + index
      const reportedElapsedSeconds = index === 0 ? null : elapsedSeconds
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          ...fixture.publicationIdentity,
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
          publicationId: attempt.publicationId,
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
          responseCount: index === 1 ? 2 : 1,
          levelId: fixture.levelIds[1]!,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
        },
      })
    }

    const telemetry = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(telemetry).toHaveBeenCalledWith(
      `event=adaptive_cohort_integrity_anomaly type=response_count_mismatch practiceQuizId=${fixture.quizId}`
    )
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain(
      'adaptive-pilot-participant'
    )
    telemetry.mockRestore()
    expect(cohort.cohortSize).toBe(40)
    expect(cohort.pilotMetrics).toMatchObject({
      suppressed: true,
      medianQuestionCount: 1,
      p95QuestionCount: 1,
      medianElapsedSeconds: null,
      p95ElapsedSeconds: null,
      responseCountMismatchDetected: null,
      durationMissingDetected: null,
    })
    expect(cohort.pilotMetrics.suppressions).toEqual(
      expect.arrayContaining([
        {
          field: 'DURATION_PERCENTILES',
          reason: 'SMALL_KNOWN_OR_MISSING_PARTITION',
        },
        {
          field: 'RESPONSE_COUNT_MISMATCH',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
        {
          field: 'DURATION_MISSING',
          reason: 'SMALL_KNOWN_OR_MISSING_PARTITION',
        },
      ])
    )

    const diagnostic = cohort.itemDiagnostics.find(
      ({ poolItemId }) => poolItemId === poolItems[0]!.id
    )
    expect(diagnostic).toMatchObject({
      suppressed: false,
      suppressions: [],
      responseCount: 30,
      exposureRate: 30 / 40,
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
        ({ poolItemId }) => poolItemId === poolItems[1]!.id
      )?.suppressions
    ).toContainEqual({
      field: 'ITEM_RESIDUAL',
      reason: 'MINIMUM_RESPONSES',
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[2]!.id
      )
    ).toMatchObject({
      suppressed: true,
      responseCount: null,
      exposureRate: null,
      observedCorrectRate: null,
      expectedCorrectRate: null,
      residual: null,
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[2]!.id
      )?.suppressions
    ).toEqual(
      expect.arrayContaining([
        {
          field: 'ITEM_EXPOSURE',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
        {
          field: 'ITEM_ACCURACY',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
      ])
    )
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[4]!.id
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
    Object.assign(new Error('PostgreSQL deadlock'), {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'TransactionWriteConflict',
            originalCode: '40P01',
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
}
