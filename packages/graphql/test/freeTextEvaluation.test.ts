import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  FreeTextEvaluationStatus,
  PublicationStatus,
  SemanticEvaluationConsentDecision,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsFreeText,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
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
  freeTextExplanationForViewer,
  freeTextSolutionsForViewer,
  semanticEvaluationForViewer,
} from '../src/schema/elementData.js'
import { manipulateElement } from '../src/services/elements.js'
import {
  createFreeTextAttempt,
  decideSemanticEvaluationConsent,
  getFreeTextPracticeState,
  retryFreeTextEvaluation,
  revealFreeTextSolution,
  startFreeTextPracticeCycle,
} from '../src/services/freeTextEvaluation.js'
import { handleEvaluateFreeTextAttempt } from '../src/services/freeTextEvaluationHandler.js'

const TEST_PREFIX = `free-text-evaluation-${Date.now()}`

const semanticConfig: SemanticFreeTextConfig = {
  contract_version: '1',
  question_language: 'en',
  attempt_limit: 2,
  solution_reveal_enabled: true,
  accepted_exact_answers: ['Diversification reduces idiosyncratic risk.'],
  reference_solution:
    'Diversification reduces idiosyncratic risk by combining imperfectly correlated assets.',
  rubric_schema: {
    schema_version: '1.0',
    name: 'Diversification',
    description: 'Explain the principal benefit of diversification.',
    rubrics: [
      {
        id: 'risk',
        name: 'Risk reduction',
        description: 'Connect diversification to idiosyncratic risk.',
        weight: 1,
        achievement_levels: [
          {
            name: 'complete',
            description: 'Makes the complete connection.',
            normalized_score: 100,
          },
          {
            name: 'missing',
            description: 'Does not make the connection.',
            normalized_score: 0,
          },
        ],
      },
    ],
  },
}

type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture

function workflowRunRef() {
  return {
    getWorkflowRunId: vi.fn().mockResolvedValue(randomUUID()),
  }
}

function participantContext(
  participantId: string,
  schedule = vi.fn().mockResolvedValue(workflowRunRef())
): ContextWithUser {
  return {
    prisma,
    emitter: { emit: vi.fn() },
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.READ_ONLY,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    tasks: {
      evaluateFreeTextAttempt: { runNoWait: schedule },
    },
  } as unknown as ContextWithUser
}

function lecturerContext(lecturerId: string): ContextWithUser {
  return {
    prisma,
    emitter: { emit: vi.fn() },
    user: {
      sub: lecturerId,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

async function createFixture() {
  const suffix = randomUUID()
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${TEST_PREFIX}-${suffix}`,
      email: `${TEST_PREFIX}-${suffix}@example.org`,
      catalystIndividual: true,
    },
  })
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${suffix}`,
      displayName: 'Semantic free-text test',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      groupDeadlineDate: new Date(),
      authType: CourseAuthType.SSO,
      ownerId: lecturer.id,
    },
  })
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${suffix}`,
      password: 'not-used',
      isActive: true,
      participations: {
        create: { courseId: course.id, isActive: true },
      },
    },
    include: { participations: true },
  })
  const element = await prisma.element.create({
    data: {
      name: 'Why diversify?',
      content: 'What is the principal benefit of diversification?',
      explanation: 'Diversification reduces asset-specific risk.',
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        solutions: ['Diversification reduces idiosyncratic risk.'],
        semanticEvaluation: semanticConfig,
      },
      ownerId: lecturer.id,
    },
  })
  const elementData = processElementData(element)
  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${TEST_PREFIX}-${suffix}`,
      displayName: 'Semantic free-text test',
      status: PublicationStatus.PUBLISHED,
      courseId: course.id,
      ownerId: lecturer.id,
      stacks: {
        create: {
          order: 0,
          type: ElementStackType.PRACTICE_QUIZ,
          elements: {
            create: {
              order: 0,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.FREE_TEXT,
              elementId: element.id,
              ownerId: lecturer.id,
              options: { pointsMultiplier: 1, resetTimeDays: 6 },
              elementData,
              results: getInitialInstanceResults(elementData),
              anonymousResults: getInitialInstanceResults(elementData),
              instanceStatistics: { create: {} },
            },
          },
        },
      },
    },
    include: { stacks: { include: { elements: true } } },
  })

  return {
    lecturer,
    course,
    participant,
    practiceQuiz,
    instance: practiceQuiz.stacks[0]!.elements[0]!,
  }
}

beforeEach(async () => {
  process.env.CATALYST_FORMATIVE_EVALUATOR_URL = 'http://evaluator.test'
  fixture = await createFixture()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await prisma.course.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  })
  await prisma.participant.deleteMany({
    where: { username: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { shortname: { startsWith: TEST_PREFIX } },
  })
  await prisma.$disconnect()
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
    expect(schedule).toHaveBeenCalled()
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

  it('confirms an accepted exact answer without external processing', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: '  diversification REDUCES idiosyncratic risk. ',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      participantContext(fixture.participant.id, schedule)
    )

    expect(state.cycleStatus).toBe('CORRECT')
    expect(state.currentAttempt).toMatchObject({
      evaluationStatus: 'EVALUATED',
      evaluationSource: 'EXACT_MATCH',
      correctness: 'CORRECT',
      aggregateScore: 100,
    })
    expect(schedule).toHaveBeenCalledTimes(1)

    const applied = await handleEvaluateFreeTextAttempt(
      {
        attemptId: state.currentAttempt!.id,
        evaluationRevision: 0,
      },
      { prisma } as never,
      {} as never
    )
    expect(applied).toEqual({ success: true, applied: true })
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: state.currentAttempt!.id } },
      })
    ).toBe(1)
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

  it('retries evaluation on the same answer revision without consuming an answer attempt', async () => {
    const ctx = participantContext(fixture.participant.id)
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
    expect(retried.attemptsUsed).toBe(0)
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

    const restarted = await startFreeTextPracticeCycle(
      { instanceId: fixture.instance.id },
      ctx
    )
    expect(restarted.cycleId).not.toBe(active.cycleId)
    expect(restarted.cycleOrdinal).toBe(2)
    expect(restarted.cycleStatus).toBe('ACTIVE')
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

  it('rechecks active course access before revealing a solution', async () => {
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

    await expect(
      revealFreeTextSolution({ cycleId: active.cycleId }, ctx)
    ).rejects.toThrow('Participant does not have active access to this course')
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
          JSON.stringify(evaluatorResponse(attempt.id, 60, 'complete')),
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
      attemptsUsed: 1,
      attemptsRemaining: 1,
      currentAttempt: {
        evaluationStatus: 'EVALUATED',
        evaluationSource: 'SEMANTIC',
        aggregateScore: 60,
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
    expect(details.map((detail) => detail.pointsAwarded)).toEqual([6, 4])
    expect(cycle.pointsAwarded).toBe(10)
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { cycleId: completed!.cycleId } },
      })
    ).toBe(2)
  })

  it('marks uncertain output unavailable without consuming an answer attempt', async () => {
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
      'complete'
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
      attemptsUsed: 0,
      attemptsRemaining: 2,
      currentAttempt: {
        evaluationStatus: 'UNAVAILABLE',
        availabilityReason: 'EVALUATOR_RESULT_UNAVAILABLE',
        retryable: true,
      },
    })
  })

  it('ends the cycle after the configured evaluated attempts and reveals the solution', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    for (const score of [20, 30]) {
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
      availabilityReason: 'LECTURER_ENTITLEMENT_UNAVAILABLE',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves semantic configuration when an older client omits the field', async () => {
    await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        status: 'READY',
        name: 'Why diversify?',
        content: 'What is the principal benefit of diversification?',
        explanation: 'Diversification reduces asset-specific risk.',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          solutions: ['Diversification reduces idiosyncratic risk.'],
        },
      },
      lecturerContext(fixture.lecturer.id)
    )

    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })
    expect(element.options).toMatchObject({
      semanticEvaluation: semanticConfig,
    })
  })

  it('rejects invalid semantic configuration before persistence', async () => {
    const result = await manipulateElement(
      {
        id: fixture.instance.elementId,
        type: ElementType.FREE_TEXT,
        options: {
          hasSampleSolution: true,
          solutions: ['Diversification reduces idiosyncratic risk.'],
          semanticEvaluation: {
            ...semanticConfig,
            attempt_limit: 0,
          },
        },
      },
      lecturerContext(fixture.lecturer.id)
    )
    expect(result).toBeNull()
  })

  it('withholds semantic authoring data from participant activity reads', async () => {
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.instance.elementId },
    })

    expect(
      semanticEvaluationForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.PARTICIPANT
      )
    ).toBeNull()
    expect(
      semanticEvaluationForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.USER
      )
    ).toEqual(semanticConfig)
    expect(
      freeTextSolutionsForViewer(
        element.options as ElementOptionsFreeText,
        UserRole.PARTICIPANT
      )
    ).toBeNull()
    expect(
      freeTextExplanationForViewer(
        {
          ...element,
          id: String(element.id),
          elementId: element.id,
          options: element.options as ElementOptionsFreeText,
        },
        UserRole.PARTICIPANT
      )
    ).toBeNull()
  })
})

function evaluatorResponse(
  taskBundleId: string,
  normalizedScore: number,
  proposedLevel: string
) {
  return {
    contract_version: '1' as const,
    task_bundle_id: taskBundleId,
    evaluator_version: 'test-evaluator-1',
    model_version: 'test-model-1',
    rubric_assessments: [
      {
        task_bundle_id: taskBundleId,
        rubric_id: 'risk',
        rubric_name: 'Risk reduction',
        proposed_level: proposedLevel,
        normalized_score: normalizedScore,
        justification: 'The response addresses risk reduction.',
        evidence_ids: [],
        confidence: 0.9,
        needs_review: false,
        review_flags: [],
        used_evidence_ids: [],
        unsupported_claims: [],
        rationale: 'The answer identifies diversification of risk.',
      },
    ],
  }
}
