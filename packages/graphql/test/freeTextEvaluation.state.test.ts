import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  FreeTextEvaluationStatus,
  PublicationStatus,
  SemanticEvaluationConsentDecision,
} from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
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
  process.env.CATALYST_FORMATIVE_EVALUATOR_URL = 'http://evaluator.test'
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

  it('makes scheduling failures retryable without duplicating the answer', async () => {
    const clientSubmissionId = randomUUID()
    const failedSchedule = vi.fn().mockRejectedValue(new Error('offline'))
    const failedCtx = participantContext(fixture.participant.id, failedSchedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      failedCtx
    )

    const unavailable = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 4,
        clientSubmissionId,
      },
      failedCtx,
      { disclosureVersion: '2026-08-18' }
    )
    expect(unavailable.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      availabilityReason: 'SCHEDULING_FAILED',
      retryable: true,
    })
    expect(unavailable.attemptsUsed).toBe(0)

    const recoveredSchedule = vi.fn().mockResolvedValue(workflowRunRef())
    const recovered = await retryFreeTextEvaluation(
      { attemptId: unavailable.currentAttempt!.id },
      participantContext(fixture.participant.id, recoveredSchedule),
      { disclosureVersion: '2026-08-18' }
    )

    expect(recoveredSchedule).toHaveBeenCalledTimes(1)
    expect(recovered.attempts).toHaveLength(1)
    expect(recovered.currentAttempt).toMatchObject({
      id: unavailable.currentAttempt!.id,
      evaluationRevision: 1,
      evaluationStatus: 'PENDING',
    })
    expect(
      await prisma.freeTextAttempt.count({
        where: { cycleId: recovered.cycleId },
      })
    ).toBe(1)
  })

  it('rechecks active quiz access before retrying an evaluation', async () => {
    const failedCtx = participantContext(
      fixture.participant.id,
      vi.fn().mockRejectedValue(new Error('offline'))
    )
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

  it('keeps legacy free-text submissions on exact grading without semantic attempts', async () => {
    const result = await respondToElementStack(
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

    expect(result?.status).toBe(StackFeedbackStatus.CORRECT)
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

  it('uses honest unavailable fallback after consent is declined', async () => {
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
      retryable: true,
      availabilityReason: 'CONSENT_DECLINED',
    })
    expect(state.attemptsUsed).toBe(0)
    expect(state.attemptsRemaining).toBe(2)
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
      availabilityReason: null,
      retryable: false,
      aggregateScore: 100,
      correctness: 'CORRECT',
    })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('persists a declined disclosure on an existing unavailable attempt', async () => {
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
      availabilityReason: 'CONSENT_REQUIRED',
    })
    expect(awaitingConsent.stateVersion).toBe(2)

    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    const declined = await getFreeTextPracticeState(
      { instanceId: fixture.instance.id },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(declined?.currentAttempt).toMatchObject({
      evaluationStatus: 'UNAVAILABLE',
      availabilityReason: 'CONSENT_DECLINED',
      retryable: true,
    })
    expect(declined?.canRetryEvaluation).toBe(false)
    expect(declined?.stateVersion).toBe(3)
  })

  it('returns the latest participant consent decision for the current disclosure', async () => {
    const ctx = participantContext(fixture.participant.id)

    await expect(getSemanticFreeTextCapability(ctx)).resolves.toMatchObject({
      disclosureVersion: '2026-08-18',
      entitled: false,
      consentDecision: null,
    })

    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    await expect(getSemanticFreeTextCapability(ctx)).resolves.toMatchObject({
      consentDecision: SemanticEvaluationConsentDecision.ACCEPTED,
    })

    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    await expect(getSemanticFreeTextCapability(ctx)).resolves.toMatchObject({
      consentDecision: SemanticEvaluationConsentDecision.DECLINED,
    })

    await expect(
      getSemanticFreeTextCapability(lecturerContext(fixture.lecturer.id))
    ).resolves.toMatchObject({ consentDecision: null })
  })

  it('allows declined consent to be accepted later and retries the same answer revision', async () => {
    const ctx = participantContext(fixture.participant.id)
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', '')
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
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
    expect(unavailable).toMatchObject({
      stateVersion: 2,
      currentAttempt: { availabilityReason: 'CONSENT_DECLINED' },
    })
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', 'http://evaluator.test')

    const retried = await retryFreeTextEvaluation(
      { attemptId: unavailable.currentAttempt!.id },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(retried.currentAttempt).toMatchObject({
      id: unavailable.currentAttempt!.id,
      evaluationRevision: 1,
      evaluationStatus: 'PENDING',
    })
    expect(retried.stateVersion).toBe(3)
    expect(retried.attemptsUsed).toBe(0)
  })

  it('schedules one revision when evaluation retry requests race', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
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
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

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
  })

  it('keeps retry and solution reveal as mutually exclusive transitions', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
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
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
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

  it('persists consent decisions as an append-only event history', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    // A flip on the same version must append, not overwrite: the ledger keeps
    // the demonstrable-consent trail for both decisions.
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    vi.stubEnv('SEMANTIC_EVALUATION_DISCLOSURE_VERSION', '2026-08-19')
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-19', accepted: false },
      ctx
    )

    const events = await prisma.freeTextConsentEvent.findMany({
      where: { participantId: fixture.participant.id },
      orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }],
    })
    expect(
      events.map((event) => [event.disclosureVersion, event.decision])
    ).toEqual([
      ['2026-08-18', SemanticEvaluationConsentDecision.ACCEPTED],
      ['2026-08-18', SemanticEvaluationConsentDecision.DECLINED],
      ['2026-08-19', SemanticEvaluationConsentDecision.DECLINED],
    ])
  })

  it('rejects consent decisions for a stale disclosure version', async () => {
    await expect(
      decideSemanticEvaluationConsent(
        { disclosureVersion: 'stale-version', accepted: true },
        participantContext(fixture.participant.id)
      )
    ).rejects.toThrow('Disclosure version is not current')
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

  it('returns at most the most frequent peer answers after authorization', async () => {
    const responses = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [
        String(index),
        { value: `Answer ${String(index).padStart(2, '0')}`, count: index + 1 },
      ])
    )
    await prisma.elementInstance.update({
      where: { id: fixture.instance.id },
      data: { results: { responses, total: 325 } },
    })

    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'Diversification reduces idiosyncratic risk.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      participantContext(fixture.participant.id)
    )

    expect(state.peerAnswers).toHaveLength(20)
    expect(state.peerAnswers[0]).toEqual({ value: 'Answer 24', count: 25 })
    expect(state.peerAnswers.at(-1)).toEqual({ value: 'Answer 05', count: 6 })
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

  it('ends a non-retryable unavailable evaluation without revealing solution details', async () => {
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
      cycleStatus: 'UNAVAILABLE',
      canPracticeAgain: true,
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
