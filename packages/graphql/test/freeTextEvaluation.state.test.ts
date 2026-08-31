import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  FreeTextEvaluationStatus,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createFreeTextAttempt,
  decideSemanticEvaluationConsent,
  getFreeTextPracticeState,
  getSemanticFreeTextCapability,
  markFreeTextAttemptUnavailable,
  retryFreeTextEvaluation,
  revealFreeTextSolution,
  startFreeTextPracticeCycle,
} from '../src/services/freeTextEvaluation.js'
import { respondToElementStack } from '../src/services/stacks.js'
import {
  cleanupFixtures,
  createFixture,
  lecturerContext,
  participantContext,
  semanticConfig,
  workflowRunRef,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-state-${Date.now()}`
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
})
afterAll(async () => {
  await cleanupFixtures(TEST_PREFIX)
})

describe('semantic free-text practice state', () => {
  it('creates one pending attempt for duplicate submission ids and schedules it once', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    const clientSubmissionId = randomUUID()
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    const first = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId,
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const duplicate = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId,
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(duplicate.currentAttempt?.id).toBe(first.currentAttempt?.id)
    expect(first.currentAttempt?.evaluationStatus).toBe(
      FreeTextEvaluationStatus.PENDING
    )
    expect(schedule).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent duplicate submissions into one persisted attempt', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    const clientSubmissionId = randomUUID()
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const input = {
      instanceId: fixture.instance.id,
      answer: 'It spreads risk.',
      answerTime: 4,
      clientSubmissionId,
    }

    const [first, duplicate] = await Promise.all([
      createFreeTextAttempt(input, ctx, {
        disclosureVersion: '2026-08-18',
      }),
      createFreeTextAttempt(input, ctx, {
        disclosureVersion: '2026-08-18',
      }),
    ])

    expect(first.currentAttempt?.id).toBe(duplicate.currentAttempt?.id)
    expect(
      await prisma.freeTextAttempt.count({
        where: { cycleId: first.cycleId },
      })
    ).toBe(1)
    expect(schedule).toHaveBeenCalledTimes(1)
  })

  it('keeps a scheduling-failure non-match unavailable and accepts a new answer', async () => {
    const clientSubmissionId = randomUUID()
    const failedSchedule = vi.fn().mockRejectedValue(new Error('offline'))
    const failedCtx = participantContext(fixture.participant.id, failedSchedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      failedCtx
    )

    const fallback = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId,
      },
      failedCtx,
      { disclosureVersion: '2026-08-18' }
    )
    expect(fallback.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      evaluationSource: null,
      correctness: null,
      availabilityReason: 'SCHEDULING_FAILED',
      retryable: true,
    })
    expect(fallback.attemptsUsed).toBe(1)
    expect(fallback.canSubmitAnswer).toBe(true)

    const recoveredSchedule = vi.fn().mockResolvedValue(workflowRunRef())
    const recovered = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads company-specific risk.',
        answerTime: 4,
        clientSubmissionId: randomUUID(),
      },
      participantContext(fixture.participant.id, recoveredSchedule),
      { disclosureVersion: '2026-08-18' }
    )

    expect(recoveredSchedule).toHaveBeenCalledTimes(1)
    expect(recovered.attempts).toHaveLength(2)
    expect(recovered.currentAttempt).toMatchObject({
      evaluationRevision: 0,
      evaluationStatus: 'PENDING',
    })
    expect(
      await prisma.freeTextAttempt.count({
        where: { cycleId: recovered.cycleId },
      })
    ).toBe(2)
  })

  it('rechecks active quiz access before retrying an evaluation', async () => {
    const failedCtx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      failedCtx
    )
    const unavailable = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId: randomUUID(),
      },
      failedCtx,
      { disclosureVersion: '2026-08-18' }
    )
    await markFreeTextAttemptUnavailable(
      {
        attemptId: unavailable.currentAttempt!.id,
        evaluationRevision: 0,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )
    await prisma.practiceQuiz.update({
      where: { id: fixture.practiceQuiz.id },
      data: { status: PublicationStatus.DRAFT },
    })

    await expect(
      retryFreeTextEvaluation(
        { attemptId: unavailable.currentAttempt!.id },
        participantContext(fixture.participant.id),
        { disclosureVersion: '2026-08-18' }
      )
    ).rejects.toThrow('Published practice quiz instance not found')
  })

  it('schedules an accepted exact answer for semantic rubric feedback', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const clientSubmissionId = randomUUID()
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: '  diversification REDUCES idiosyncratic risk. ',
        answerTime: 3,
        clientSubmissionId,
      },
      ctx
    )

    expect(state.cycleStatus).toBe('ACTIVE')
    expect(state.currentAttempt).toMatchObject({
      evaluationStatus: 'PENDING',
      evaluationSource: null,
      correctness: null,
      aggregateScore: null,
    })
    expect(schedule).toHaveBeenCalledTimes(1)
    const duplicate = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'Diversification reduces idiosyncratic risk.',
        answerTime: 3,
        clientSubmissionId,
      },
      ctx
    )
    expect(duplicate.currentAttempt?.id).toBe(state.currentAttempt?.id)
    expect(duplicate.stateVersion).toBe(state.stateVersion)
    expect(state.stateVersion).toBe(2)
    expect(
      await prisma.freeTextPracticeCycle.count({
        where: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      })
    ).toBe(1)
    expect(
      await prisma.freeTextAttempt.count({ where: { cycleId: state.cycleId } })
    ).toBe(1)
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: state.currentAttempt!.id } },
      })
    ).toBe(0)
  })

  it('rejects semantic stack submissions without a client submission ID', async () => {
    await expect(
      respondToElementStack(
        {
          stackId: fixture.practiceQuiz.stacks[0]!.id,
          courseId: fixture.course.id,
          responses: [
            {
              instanceId: fixture.instance.id,
              type: ElementType.FREE_TEXT,
              freeTextResponse: 'Diversification reduces idiosyncratic risk.',
            },
          ],
          stackAnswerTime: 3,
        },
        participantContext(fixture.participant.id)
      )
    ).rejects.toThrow(
      'Semantic free-text responses require an answer and client submission ID'
    )
    expect(
      await prisma.freeTextAttempt.count({
        where: {
          cycle: {
            participantId: fixture.participant.id,
            elementInstanceId: fixture.instance.id,
          },
        },
      })
    ).toBe(0)
  })

  it('rolls back an exact-match attempt when the cycle transition fails', async () => {
    const failingPrisma = prisma.$extends({
      query: {
        freeTextPracticeCycle: {
          update({ args, query }) {
            if (args.data.status === 'CORRECT') {
              throw new Error('simulated cycle transition failure')
            }
            return query(args)
          },
          updateMany({ args, query }) {
            if (args.data.status === 'CORRECT') {
              throw new Error('simulated cycle transition failure')
            }
            return query(args)
          },
        },
      },
    })
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = {
      ...participantContext(fixture.participant.id, schedule),
      prisma: failingPrisma,
    } as unknown as ContextWithUser

    await expect(
      createFreeTextAttempt(
        {
          instanceId: fixture.instance.id,
          answer: 'Diversification reduces idiosyncratic risk.',
          answerTime: 3,
          clientSubmissionId: randomUUID(),
        },
        ctx
      )
    ).rejects.toThrow('simulated cycle transition failure')

    const cycle = await prisma.freeTextPracticeCycle.findFirstOrThrow({
      where: {
        participantId: fixture.participant.id,
        elementInstanceId: fixture.instance.id,
      },
    })
    expect(cycle.status).toBe('ACTIVE')
    expect(
      await prisma.freeTextAttempt.count({ where: { cycleId: cycle.id } })
    ).toBe(0)
    expect(schedule).not.toHaveBeenCalled()
  })

  it('keeps a non-match unavailable after consent is declined', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )

    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(state.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      evaluationSource: null,
      correctness: null,
      retryable: true,
      availabilityReason: 'CONSENT_DECLINED',
    })
    expect(state.attemptsUsed).toBe(1)
    expect(state.attemptsRemaining).toBe(1)
    expect(state.canSubmitAnswer).toBe(true)
  })

  it('ends honestly as unavailable when non-matches reach the answer limit', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )

    await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'First inconclusive answer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    const terminal = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'Second inconclusive answer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(terminal).toMatchObject({
      cycleStatus: 'UNAVAILABLE',
      attemptsUsed: 2,
      attemptsRemaining: 0,
      canSubmitAnswer: false,
      canPracticeAgain: true,
      solutionAuthorized: false,
      currentAttempt: {
        evaluationStatus: 'UNAVAILABLE',
        evaluationSource: null,
        aggregateScore: null,
        correctness: null,
      },
    })
  })

  it('uses exact matching when semantic evaluation is declined', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )

    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'Diversification reduces idiosyncratic risk.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(state.cycleStatus).toBe('CORRECT')
    expect(state.currentAttempt).toMatchObject({
      evaluationStatus: 'EVALUATED',
      evaluationSource: 'EXACT_MATCH',
      availabilityReason: 'CONSENT_DECLINED',
      retryable: false,
      aggregateScore: 100,
      correctness: 'CORRECT',
    })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('keeps a non-match unavailable while semantic consent is still required', async () => {
    const ctx = participantContext(fixture.participant.id)
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', '')
    const awaitingConsent = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(awaitingConsent.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      evaluationSource: null,
      correctness: null,
      availabilityReason: 'CONSENT_REQUIRED',
    })
    expect(awaitingConsent.stateVersion).toBe(2)
    expect(awaitingConsent.canSubmitAnswer).toBe(true)
  })

  it('reports a configured evaluator as unavailable when its health check fails', async () => {
    vi.stubEnv(
      'CATALYST_FORMATIVE_EVALUATOR_HEALTH_URL',
      'http://127.0.0.1:7099/healthz'
    )
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(
      getSemanticFreeTextCapability(lecturerContext(fixture.lecturer.id))
    ).resolves.toMatchObject({
      availability: 'UNAVAILABLE',
      reason: 'EVALUATOR_UNAVAILABLE',
      retryable: true,
    })
  })

  it('reports a configured evaluator as available after a healthy response', async () => {
    vi.stubEnv(
      'CATALYST_FORMATIVE_EVALUATOR_HEALTH_URL',
      'http://127.0.0.1:7099/healthz'
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(
      getSemanticFreeTextCapability(lecturerContext(fixture.lecturer.id))
    ).resolves.toMatchObject({
      availability: 'AVAILABLE',
      reason: null,
      retryable: false,
    })
  })

  it('schedules one revision when evaluation retry requests race', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const unavailable = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await markFreeTextAttemptUnavailable(
      {
        attemptId: unavailable.currentAttempt!.id,
        evaluationRevision: 0,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )
    await prisma.freeTextAttempt.update({
      where: { id: unavailable.currentAttempt!.id },
      data: { evaluationAuthorizedAt: new Date() },
    })
    schedule.mockClear()

    const retries = await Promise.all(
      Array.from({ length: 4 }, () =>
        retryFreeTextEvaluation(
          { attemptId: unavailable.currentAttempt!.id },
          ctx,
          { disclosureVersion: '2026-08-18' }
        )
      )
    )

    expect(schedule).toHaveBeenCalledTimes(1)
    expect(
      retries.map((state) => state.currentAttempt?.evaluationRevision)
    ).toEqual([1, 1, 1, 1])
    expect(
      retries.map((state) => state.currentAttempt?.evaluationStatus)
    ).toEqual(['PENDING', 'PENDING', 'PENDING', 'PENDING'])
    await expect(
      prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: unavailable.currentAttempt!.id },
        select: { evaluationAuthorizedAt: true },
      })
    ).resolves.toEqual({ evaluationAuthorizedAt: null })
  })

  it('projects retry availability from the current evaluator and entitlement gates', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await markFreeTextAttemptUnavailable(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: 0,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )

    await expect(
      getFreeTextPracticeState({ instanceId: fixture.instance.id }, ctx)
    ).resolves.toMatchObject({ canRetryEvaluation: true })

    await prisma.user.update({
      where: { id: fixture.lecturer.id },
      data: { catalystIndividual: false },
    })
    await expect(
      getFreeTextPracticeState({ instanceId: fixture.instance.id }, ctx)
    ).resolves.toMatchObject({ canRetryEvaluation: false })

    await prisma.user.update({
      where: { id: fixture.lecturer.id },
      data: { catalystIndividual: true },
    })
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', '')
    await expect(
      getFreeTextPracticeState({ instanceId: fixture.instance.id }, ctx)
    ).resolves.toMatchObject({ canRetryEvaluation: false })
  })

  it('serializes evaluation retry against a changed answer submission', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const first = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await markFreeTextAttemptUnavailable(
      {
        attemptId: first.currentAttempt!.id,
        evaluationRevision: 0,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )
    schedule.mockClear()

    await Promise.allSettled([
      retryFreeTextEvaluation({ attemptId: first.currentAttempt!.id }, ctx, {
        disclosureVersion: '2026-08-18',
      }),
      createFreeTextAttempt(
        {
          instanceId: fixture.instance.id,
          answer: 'It spreads risk across investments.',
          answerTime: 3,
          clientSubmissionId: randomUUID(),
        },
        ctx,
        { disclosureVersion: '2026-08-18' }
      ),
    ])

    expect(
      await prisma.freeTextAttempt.count({
        where: {
          cycleId: first.cycleId,
          evaluationStatus: 'PENDING',
        },
      })
    ).toBe(1)
  })

  it('keeps retry and solution reveal as mutually exclusive transitions', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const unavailable = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await markFreeTextAttemptUnavailable(
      {
        attemptId: unavailable.currentAttempt!.id,
        evaluationRevision: 0,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: true,
      },
      prisma
    )

    await Promise.all([
      retryFreeTextEvaluation(
        { attemptId: unavailable.currentAttempt!.id },
        ctx,
        { disclosureVersion: '2026-08-18' }
      ),
      revealFreeTextSolution({ cycleId: unavailable.cycleId }, ctx),
    ])

    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    expect(
      state?.cycleStatus === 'SOLUTION_REVEALED' &&
        state.currentAttempt?.evaluationStatus === 'PENDING'
    ).toBe(false)
    if (state?.currentAttempt?.evaluationStatus === 'PENDING') {
      expect(state.cycleStatus).toBe('ACTIVE')
    } else {
      expect(state?.cycleStatus).toBe('SOLUTION_REVEALED')
    }
  })

  it('reveals the solution terminally and permits a new cycle', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    const active = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    const revealed = await revealFreeTextSolution(
      { cycleId: active.cycleId },
      ctx
    )
    expect(revealed).toMatchObject({
      cycleStatus: 'SOLUTION_REVEALED',
      referenceSolution: semanticConfig.reference_solution,
      explanation: 'Diversification reduces asset-specific risk.',
      canPracticeAgain: true,
    })
    const repeatedReveal = await revealFreeTextSolution(
      { cycleId: active.cycleId },
      ctx
    )
    expect(repeatedReveal.stateVersion).toBe(revealed.stateVersion)

    const restarts = await Promise.all(
      Array.from({ length: 4 }, () =>
        startFreeTextPracticeCycle({ instanceId: fixture.instance.id }, ctx)
      )
    )
    const restarted = restarts[0]!
    expect(restarted.cycleId).not.toBe(active.cycleId)
    expect(restarted.cycleOrdinal).toBe(2)
    expect(restarted.cycleStatus).toBe('ACTIVE')
    expect(new Set(restarts.map(({ cycleId }) => cycleId))).toEqual(
      new Set([restarted.cycleId])
    )
    expect(
      await prisma.freeTextPracticeCycle.count({
        where: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      })
    ).toBe(2)
  })

  it('keeps course access when leaderboard participation is inactive', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    const active = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await prisma.participation.update({
      where: { id: fixture.participant.participations[0]!.id },
      data: { isActive: false },
    })

    const revealed = await revealFreeTextSolution(
      { cycleId: active.cycleId },
      ctx
    )
    expect(revealed.cycleStatus).toBe('SOLUTION_REVEALED')
  })

  it('does not expose solution details for an active cycle', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )
    expect(state?.referenceSolution).toBeNull()
    expect(state?.explanation).toBeNull()
  })

  it('allows another answer after a non-retryable unavailable evaluation', async () => {
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

    await markFreeTextAttemptUnavailable(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: pending.currentAttempt!.evaluationRevision,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: false,
      },
      prisma
    )
    const state = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx
    )

    expect(state).toMatchObject({
      cycleStatus: 'ACTIVE',
      canPracticeAgain: false,
      canSubmitAnswer: true,
      canRetryEvaluation: false,
      canRevealSolution: false,
      solutionAuthorized: false,
      referenceSolution: null,
      explanation: null,
      currentAttempt: {
        evaluationStatus: 'UNAVAILABLE',
        retryable: false,
      },
    })
  })

  it('allows an explicitly enabled solution reveal from a terminal unavailable cycle', async () => {
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
    await markFreeTextAttemptUnavailable(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: pending.currentAttempt!.evaluationRevision,
        reason: 'EVALUATOR_UNAVAILABLE',
        retryable: false,
      },
      prisma
    )

    const revealed = await revealFreeTextSolution(
      { cycleId: pending.cycleId },
      ctx
    )
    expect(revealed).toMatchObject({
      cycleStatus: 'SOLUTION_REVEALED',
      solutionAuthorized: true,
      referenceSolution: semanticConfig.reference_solution,
    })
  })
})
