import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma/client'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  completeFreeTextAttemptEvaluationInTransaction,
  createFreeTextAttempt,
  decideSemanticEvaluationConsent,
  getFreeTextPracticeState,
} from '../src/services/freeTextEvaluation.js'
import { handleEvaluateFreeTextAttempt } from '../src/services/freeTextEvaluationHandler.js'
import { applyEvaluatedFreeTextAttempt } from '../src/services/freeTextPracticeResponseApplication.js'
import {
  cleanupFixtures,
  createFixture,
  evaluatorResponse,
  participantContext,
  semanticConfig,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-worker-application-${Date.now()}`
type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture

beforeEach(async () => {
  vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', 'http://127.0.0.1:7099')
  vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_ALLOW_INSECURE_LOCAL', 'true')
  fixture = await createFixture(TEST_PREFIX)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
afterAll(async () => {
  await cleanupFixtures(TEST_PREFIX)
})

describe('semantic free-text evaluation worker', () => {
  it('persists a valid semantic result and ignores duplicate worker delivery', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads investments across assets.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const attempt = pending.currentAttempt!
    let requestBody: Record<string, unknown> | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify(evaluatorResponse(attempt.id, 60, 'partial')),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      })
    )

    const input = {
      attemptId: attempt.id,
      evaluationRevision: attempt.evaluationRevision,
    }
    const first = await handleEvaluateFreeTextAttempt(
      input,
      { prisma } as never,
      {} as never
    )
    const duplicate = await handleEvaluateFreeTextAttempt(
      input,
      { prisma } as never,
      {} as never
    )
    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )

    expect(first).toEqual({ success: true, applied: true })
    expect(duplicate).toEqual({ success: true, applied: false })
    expect(state).toMatchObject({
      cycleStatus: 'ACTIVE',
      stateVersion: 3,
      attemptsUsed: 1,
      attemptsRemaining: 1,
      currentAttempt: {
        evaluationStatus: 'EVALUATED',
        evaluationSource: 'SEMANTIC',
        aggregateScore: null,
        outcomeBandId: null,
        correctness: 'PARTIAL',
      },
    })
    expect(requestBody).toMatchObject({
      contract_version: '1',
      task_bundle_id: attempt.id,
      question: { language: 'en' },
      response: { text: 'It spreads investments across assets.' },
    })
    expect(requestBody).not.toHaveProperty('participantId')
    expect(requestBody).not.toHaveProperty('courseId')

    const improved = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It reduces asset-specific risk through imperfect correlation.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify(
              evaluatorResponse(improved.currentAttempt!.id, 100, 'complete')
            ),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
    )
    await handleEvaluateFreeTextAttempt(
      {
        attemptId: improved.currentAttempt!.id,
        evaluationRevision: 0,
      },
      { prisma } as never,
      {} as never
    )
    const completed = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )
    const cycle = await prisma.freeTextPracticeCycle.findUniqueOrThrow({
      where: { id: completed!.cycleId },
    })
    const details = await prisma.questionResponseDetail.findMany({
      where: { freeTextAttempt: { cycleId: completed!.cycleId } },
      orderBy: { createdAt: 'asc' },
    })
    expect(completed?.cycleStatus).toBe('CORRECT')
    expect(completed?.stateVersion).toBe(5)
    expect(completed?.attempts[0]).toMatchObject({
      aggregateScore: 60,
      outcomeBandId: 'partially-correct',
      structuredResult: {
        rubricAssessments: [
          {
            rubricId: 'risk',
            rubricName: 'Risk reduction',
            proposedLevel: 'partial',
            normalizedScore: 60,
            criterionStatus: 'PARTIAL',
            rationale: 'The answer identifies diversification of risk.',
          },
        ],
        feedbackProposals: [],
      },
    })
    expect(details.map((detail) => detail.pointsAwarded)).toEqual([6, 4])
    expect(completed?.attempts.map((attempt) => attempt.pointsAwarded)).toEqual(
      [6, 4]
    )
    expect(cycle.pointsAwarded).toBe(10)
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { cycleId: completed!.cycleId } },
      })
    ).toBe(2)
  })

  it('classifies the highest lecturer-defined rubric anchor as met', async () => {
    const elementData = fixture.instance.elementData
    if (elementData.type !== ElementType.FREE_TEXT) {
      throw new Error('Expected a free-text fixture')
    }
    const topLevelConfig = {
      ...semanticConfig,
      rubric_schema: {
        ...semanticConfig.rubric_schema,
        rubrics: [
          {
            ...semanticConfig.rubric_schema.rubrics[0]!,
            achievement_levels: [
              {
                name: 'excellent',
                description: 'Meets the configured criterion.',
                normalized_score: 80,
              },
              {
                name: 'open',
                description: 'Does not yet meet the criterion.',
                normalized_score: 0,
              },
            ],
          },
        ],
      },
    }
    await prisma.elementInstance.update({
      where: { id: fixture.instance.id },
      data: {
        elementData: {
          ...elementData,
          options: {
            ...elementData.options,
            semanticEvaluation: topLevelConfig,
          },
        },
      },
    })
    await prisma.instanceStatistics.update({
      where: { elementInstanceId: fixture.instance.id },
      data: {
        firstCorrectCount: 0,
        firstPartialCorrectCount: 0,
        firstWrongCount: 0,
        lastCorrectCount: 0,
        lastPartialCorrectCount: 0,
        lastWrongCount: 0,
      },
    })
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It reduces asset-specific risk.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify(
              evaluatorResponse(pending.currentAttempt!.id, 80, 'excellent')
            ),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
    )

    await handleEvaluateFreeTextAttempt(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: 0,
      },
      { prisma } as never,
      {} as never
    )
    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )

    expect(state).toMatchObject({
      cycleStatus: 'CORRECT',
      currentAttempt: {
        aggregateScore: 80,
        correctness: 'CORRECT',
        pointsAwarded: 8,
        xpAwarded: 10,
      },
    })
    expect(state?.currentAttempt?.structuredResult?.rubricAssessments).toEqual([
      expect.objectContaining({
        proposedLevel: 'excellent',
        normalizedScore: 80,
        criterionStatus: 'CORRECT',
      }),
    ])
    expect(
      await prisma.freeTextPracticeCycle.findUniqueOrThrow({
        where: { id: pending.cycleId },
        select: { pointsAwarded: true, xpAwarded: true, bestXp: true },
      })
    ).toEqual({ pointsAwarded: 8, xpAwarded: 10, bestXp: 10 })
    expect(
      await prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participant.id },
        select: { xp: true },
      })
    ).toEqual({ xp: 10 })
    const appliedAttempt = await prisma.freeTextAttempt.findUniqueOrThrow({
      where: { id: pending.currentAttempt!.id },
      include: { questionResponseDetail: true },
    })
    expect(appliedAttempt.questionResponseDetail).toMatchObject({
      score: 8,
      pointsAwarded: 8,
      xpAwarded: 10,
    })

    const questionResponse = await prisma.questionResponse.findUniqueOrThrow({
      where: {
        participantId_elementInstanceId: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      },
    })
    expect(questionResponse).toMatchObject({
      totalScore: 8,
      firstResponseCorrectness: 'CORRECT',
      lastResponseCorrectness: 'CORRECT',
      correctCount: 1,
      correctCountStreak: 1,
      partialCorrectCount: 0,
      wrongCount: 0,
    })
    const responseResults = questionResponse.aggregatedResponses as {
      responses: Record<
        string,
        { value: string; count: number; correct: boolean }
      >
      total: number
    }
    expect(responseResults.total).toBe(1)
    expect(Object.values(responseResults.responses)).toEqual([
      {
        value: 'it reduces asset-specific risk.',
        count: 1,
        correct: true,
      },
    ])

    const trackedInstance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instance.id },
      select: { results: true, instanceStatistics: true },
    })
    expect(trackedInstance.instanceStatistics).toMatchObject({
      correctCount: 1,
      partialCorrectCount: 0,
      wrongCount: 0,
      firstCorrectCount: 1,
      firstPartialCorrectCount: 0,
      firstWrongCount: 0,
      lastCorrectCount: 1,
      lastPartialCorrectCount: 0,
      lastWrongCount: 0,
    })
    const instanceResults = trackedInstance.results as {
      responses: Record<
        string,
        { value: string; count: number; correct: boolean }
      >
      total: number
    }
    expect(instanceResults.total).toBe(1)
    expect(Object.values(instanceResults.responses)).toEqual([
      {
        value: 'it reduces asset-specific risk.',
        count: 1,
        correct: true,
      },
    ])
  })

  it('applies a recovered evaluated attempt exactly once under concurrency', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads investments across assets.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const attempt = pending.currentAttempt!
    const evaluationApplied = await prisma.$transaction((tx) =>
      completeFreeTextAttemptEvaluationInTransaction(
        {
          attemptId: attempt.id,
          evaluationRevision: attempt.evaluationRevision,
          evaluation: evaluatorResponse(attempt.id, 60, 'partial'),
        },
        tx
      )
    )
    expect(evaluationApplied).toBe(true)

    const applications = await Promise.all([
      applyEvaluatedFreeTextAttempt({ attemptId: attempt.id }, prisma),
      applyEvaluatedFreeTextAttempt({ attemptId: attempt.id }, prisma),
    ])

    expect(applications.sort()).toEqual([false, true])
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: attempt.id } },
      })
    ).toBe(1)
    expect(
      await prisma.freeTextPracticeCycle.findUniqueOrThrow({
        where: { id: pending.cycleId },
        select: { pointsAwarded: true, xpAwarded: true },
      })
    ).toEqual({ pointsAwarded: 6, xpAwarded: 0 })
    expect(
      await prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participant.id },
        select: { xp: true },
      })
    ).toEqual({ xp: 0 })
    expect(
      await prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: fixture.participant.id,
            courseId: fixture.course.id,
          },
        },
        select: { score: true },
      })
    ).toEqual({ score: 6 })
  })

  it('does not apply an evaluated attempt with an invalid aggregate score', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads investments across assets.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const attempt = pending.currentAttempt!
    await prisma.$transaction((tx) =>
      completeFreeTextAttemptEvaluationInTransaction(
        {
          attemptId: attempt.id,
          evaluationRevision: attempt.evaluationRevision,
          evaluation: evaluatorResponse(attempt.id, 60, 'partial'),
        },
        tx
      )
    )
    await prisma.freeTextAttempt.update({
      where: { id: attempt.id },
      data: { aggregateScore: 101 },
    })

    await expect(
      applyEvaluatedFreeTextAttempt({ attemptId: attempt.id }, prisma)
    ).rejects.toThrow('invalid aggregate score')
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: attempt.id } },
      })
    ).toBe(0)
  })

  it('preserves incremental rewards when recovered attempts apply out of order', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const firstPending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads investments across assets.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const firstAttempt = firstPending.currentAttempt!
    expect(
      await prisma.$transaction((tx) =>
        completeFreeTextAttemptEvaluationInTransaction(
          {
            attemptId: firstAttempt.id,
            evaluationRevision: firstAttempt.evaluationRevision,
            evaluation: evaluatorResponse(firstAttempt.id, 60, 'partial'),
          },
          tx
        )
      )
    ).toBe(true)

    const secondPending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It reduces asset-specific risk through imperfect correlation.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const secondAttempt = secondPending.currentAttempt!
    expect(
      await prisma.$transaction((tx) =>
        completeFreeTextAttemptEvaluationInTransaction(
          {
            attemptId: secondAttempt.id,
            evaluationRevision: secondAttempt.evaluationRevision,
            evaluation: evaluatorResponse(secondAttempt.id, 100, 'complete'),
          },
          tx
        )
      )
    ).toBe(true)

    expect(
      await applyEvaluatedFreeTextAttempt(
        { attemptId: secondAttempt.id },
        prisma
      )
    ).toBe(true)
    expect(
      await applyEvaluatedFreeTextAttempt(
        { attemptId: firstAttempt.id },
        prisma
      )
    ).toBe(true)

    const attempts = await prisma.freeTextAttempt.findMany({
      where: { cycleId: firstPending.cycleId },
      orderBy: { ordinal: 'asc' },
      include: { questionResponseDetail: true },
    })
    expect(
      attempts.map((attempt) => attempt.questionResponseDetail?.pointsAwarded)
    ).toEqual([6, 4])
    expect(
      await prisma.freeTextPracticeCycle.findUniqueOrThrow({
        where: { id: firstPending.cycleId },
        select: { pointsAwarded: true, xpAwarded: true, bestXp: true },
      })
    ).toEqual({ pointsAwarded: 10, xpAwarded: 10, bestXp: 10 })
    expect(
      await prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participant.id },
        select: { xp: true },
      })
    ).toEqual({ xp: 10 })
    expect(
      await prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: fixture.participant.id,
            courseId: fixture.course.id,
          },
        },
        select: { score: true },
      })
    ).toEqual({ score: 10 })
  })

  it('rolls back semantic evaluation when response application fails', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads investments across assets.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const attempt = pending.currentAttempt!
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify(evaluatorResponse(attempt.id, 60, 'partial')),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
    )
    const failingPrisma = prisma.$extends({
      query: {
        questionResponseDetail: {
          create() {
            throw new Error('simulated response application failure')
          },
        },
      },
    })

    await expect(
      handleEvaluateFreeTextAttempt(
        {
          attemptId: attempt.id,
          evaluationRevision: attempt.evaluationRevision,
        },
        { prisma: failingPrisma } as never,
        {} as never
      )
    ).rejects.toThrow('simulated response application failure')

    const storedAttempt = await prisma.freeTextAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: { cycle: true },
    })
    expect(storedAttempt.evaluationStatus).toBe('PENDING')
    expect(storedAttempt.cycle.status).toBe('ACTIVE')
    expect(storedAttempt.questionResponseDetailId).toBeNull()
  })
})
