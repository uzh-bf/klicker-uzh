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
  markFreeTextAttemptUnavailable,
  retryFreeTextEvaluation,
  revealFreeTextSolution,
} from '../src/services/freeTextEvaluation.js'
import {
  handleEvaluateFreeTextAttempt,
  handleEvaluateFreeTextAttemptFailure,
} from '../src/services/freeTextEvaluationHandler.js'
import { applyEvaluatedFreeTextAttempt } from '../src/services/freeTextPracticeResponseApplication.js'
import {
  cleanupFixtures,
  createFixture,
  evaluatorResponse,
  participantContext,
  semanticConfig,
  workflowRunRef,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-worker-${Date.now()}`
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

    expect(state?.currentAttempt?.structuredResult?.rubricAssessments).toEqual([
      expect.objectContaining({
        proposedLevel: 'excellent',
        normalizedScore: 80,
        criterionStatus: 'CORRECT',
      }),
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

  it.each([
    'retry',
    'reveal',
  ] as const)('does not let stale worker completion overwrite a %s transition', async (transition) => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
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
    await markFreeTextAttemptUnavailable(
      {
        attemptId: attempt.id,
        evaluationRevision: attempt.evaluationRevision,
        reason: 'EVALUATOR_RESULT_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )
    const participantTransition =
      transition === 'retry'
        ? retryFreeTextEvaluation({ attemptId: attempt.id }, ctx, {
            disclosureVersion: '2026-08-18',
          })
        : revealFreeTextSolution({ cycleId: pending.cycleId }, ctx)
    const state = await participantTransition
    const workerApplied = await prisma.$transaction((tx) =>
      completeFreeTextAttemptEvaluationInTransaction(
        {
          attemptId: attempt.id,
          evaluationRevision: attempt.evaluationRevision,
          evaluation: evaluatorResponse(attempt.id, 60, 'partial'),
        },
        tx
      )
    )
    expect(workerApplied).toBe(false)
    expect(state.currentAttempt?.evaluationSource).toBeNull()
    if (transition === 'retry') {
      expect(state).toMatchObject({
        cycleStatus: 'ACTIVE',
        currentAttempt: {
          evaluationRevision: 1,
          evaluationStatus: 'PENDING',
        },
      })
    } else {
      expect(state).toMatchObject({
        cycleStatus: 'SOLUTION_REVEALED',
        currentAttempt: {
          evaluationRevision: 0,
          evaluationStatus: 'UNAVAILABLE',
        },
      })
    }
  })

  it('keeps an uncertain non-match unavailable', async () => {
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
    const response = evaluatorResponse(
      pending.currentAttempt!.id,
      60,
      'partial'
    )
    response.rubric_assessments[0]!.needs_review = true
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
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
      attemptsUsed: 1,
      attemptsRemaining: 1,
      canSubmitAnswer: true,
      currentAttempt: {
        evaluationStatus: 'UNAVAILABLE',
        evaluationSource: null,
        correctness: null,
        availabilityReason: 'EVALUATOR_RESULT_UNAVAILABLE',
        retryable: false,
      },
    })
  })

  it('uses exact matching when an evaluator result is uncertain', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: semanticConfig.accepted_exact_answers[0]!,
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const response = evaluatorResponse(
      pending.currentAttempt!.id,
      60,
      'partial'
    )
    response.rubric_assessments[0]!.needs_review = true
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
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

    const storedAttempt = await prisma.freeTextAttempt.findUniqueOrThrow({
      where: { id: pending.currentAttempt!.id },
      include: { cycle: true },
    })
    expect(storedAttempt).toMatchObject({
      evaluationStatus: 'EVALUATED',
      evaluationSource: 'EXACT_MATCH',
      aggregateScore: 100,
      correctness: 'CORRECT',
      availabilityReason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: false,
      cycle: {
        status: 'CORRECT',
        bestScore: 100,
        pointsAwarded: 10,
      },
    })
    expect(storedAttempt.questionResponseDetailId).not.toBeNull()
  })

  it('uses exact matching after evaluator retries are exhausted exactly once', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: semanticConfig.accepted_exact_answers[0]!,
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const input = {
      attemptId: pending.currentAttempt!.id,
      evaluationRevision: 0,
    }

    const first = await handleEvaluateFreeTextAttemptFailure(
      input,
      { prisma } as never,
      {} as never
    )
    const duplicate = await handleEvaluateFreeTextAttemptFailure(
      input,
      { prisma } as never,
      {} as never
    )

    expect(first).toEqual({ success: true, applied: true })
    expect(duplicate).toEqual({ success: true, applied: false })
    expect(
      await prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: input.attemptId },
        select: {
          evaluationStatus: true,
          evaluationSource: true,
          aggregateScore: true,
          questionResponseDetailId: true,
        },
      })
    ).toMatchObject({
      evaluationStatus: 'EVALUATED',
      evaluationSource: 'EXACT_MATCH',
      aggregateScore: 100,
    })
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: input.attemptId } },
      })
    ).toBe(1)
  })

  it('uses exact matching when semantic evaluation cannot be scheduled', async () => {
    const schedule = vi.fn().mockRejectedValue(new Error('scheduler offline'))
    const ctx = participantContext(fixture.participant.id, schedule)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: semanticConfig.accepted_exact_answers[0]!,
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(state).toMatchObject({
      cycleStatus: 'CORRECT',
      attemptsUsed: 1,
      currentAttempt: {
        evaluationStatus: 'EVALUATED',
        evaluationSource: 'EXACT_MATCH',
        correctness: 'CORRECT',
      },
    })
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('ends the cycle after the configured evaluated attempts and reveals the solution', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    for (const score of [0, 0]) {
      const pending = await createFreeTextAttempt(
        {
          instanceId: fixture.instance.id,
          answer: `Incomplete answer ${score}`,
          answerTime: 2,
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
                evaluatorResponse(pending.currentAttempt!.id, score, 'missing')
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
    }

    const exhausted = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )
    expect(exhausted).toMatchObject({
      cycleStatus: 'EXHAUSTED',
      attemptsUsed: 2,
      attemptsRemaining: 0,
      solutionAuthorized: true,
      referenceSolution: semanticConfig.reference_solution,
      canPracticeAgain: true,
      canSubmitAnswer: false,
    })
    await expect(
      createFreeTextAttempt(
        {
          instanceId: fixture.instance.id,
          answer: 'A third answer',
          answerTime: 2,
          clientSubmissionId: randomUUID(),
        },
        ctx
      )
    ).rejects.toThrow('Start a new free-text practice cycle')
  })

  it('rechecks lecturer entitlement before external evaluation', async () => {
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
    await prisma.user.update({
      where: { id: fixture.lecturer.id },
      data: { catalystIndividual: false, catalystInstitutional: false },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

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
    expect(state?.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      evaluationSource: null,
      correctness: null,
      availabilityReason: 'LECTURER_ENTITLEMENT_UNAVAILABLE',
      retryable: true,
    })
    expect(state?.canSubmitAnswer).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves an exhausted cycle terminal without solution details when reveal is disabled', async () => {
    await prisma.elementInstance.update({
      where: { id: fixture.instance.id },
      data: {
        elementData: {
          ...fixture.instance.elementData,
          options: {
            ...(fixture.instance.elementData as { options: object }).options,
            semanticEvaluation: {
              ...semanticConfig,
              solution_reveal_enabled: false,
            },
          },
        } as never,
      },
    })
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    for (const score of [0, 0]) {
      const pending = await createFreeTextAttempt(
        {
          instanceId: fixture.instance.id,
          answer: `Incomplete answer ${score}`,
          answerTime: 2,
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
                evaluatorResponse(pending.currentAttempt!.id, score, 'missing')
              ),
              { status: 200, headers: { 'content-type': 'application/json' } }
            )
          )
      )
      await handleEvaluateFreeTextAttempt(
        {
          attemptId: pending.currentAttempt!.id,
          evaluationRevision: pending.currentAttempt!.evaluationRevision,
        },
        { prisma } as never,
        {} as never
      )
    }

    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )
    expect(state).toMatchObject({
      cycleStatus: 'EXHAUSTED',
      canPracticeAgain: true,
      canRevealSolution: false,
      solutionAuthorized: false,
      referenceSolution: null,
      explanation: null,
    })
  })
})
