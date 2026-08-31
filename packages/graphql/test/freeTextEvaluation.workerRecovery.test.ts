import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
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
import {
  cleanupFixtures,
  createFixture,
  evaluatorResponse,
  participantContext,
  semanticConfig,
  workflowRunRef,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-worker-recovery-${Date.now()}`
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

async function evaluateAttempt({
  ctx,
  answer,
  answerTime = 3,
  score,
  level,
  needsReview = false,
}: {
  ctx: ReturnType<typeof participantContext>
  answer: string
  answerTime?: number
  score: number
  level: Parameters<typeof evaluatorResponse>[2]
  needsReview?: boolean
}) {
  const pending = await createFreeTextAttempt(
    {
      instanceId: fixture.instance.id,
      answer,
      answerTime,
      clientSubmissionId: randomUUID(),
    },
    ctx,
    { disclosureVersion: '2026-08-18' }
  )
  const response = evaluatorResponse(pending.currentAttempt!.id, score, level)
  response.rubric_assessments[0]!.needs_review = needsReview
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
      evaluationRevision: pending.currentAttempt!.evaluationRevision,
    },
    { prisma } as never,
    {} as never
  )
  return pending
}

describe('semantic free-text evaluation worker recovery', () => {
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
    await evaluateAttempt({
      ctx,
      answer: 'It spreads investments across assets.',
      score: 60,
      level: 'partial',
      needsReview: true,
    })
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
    const pending = await evaluateAttempt({
      ctx,
      answer: semanticConfig.accepted_exact_answers[0]!,
      score: 60,
      level: 'partial',
      needsReview: true,
    })

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
      await evaluateAttempt({
        ctx,
        answer: `Incomplete answer ${score}`,
        answerTime: 2,
        score,
        level: 'missing',
      })
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
      await evaluateAttempt({
        ctx,
        answer: `Incomplete answer ${score}`,
        answerTime: 2,
        score,
        level: 'missing',
      })
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
