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
  createFreeTextAttempt,
  decideSemanticEvaluationConsent,
} from '../src/services/freeTextEvaluation.js'
import { handleEvaluateFreeTextAttempt } from '../src/services/freeTextEvaluationHandler.js'
import {
  cleanupFixtures,
  createFixture,
  evaluatorResponse,
  participantContext,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-dispatch-${Date.now()}`
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

describe('semantic free-text evaluation dispatch authorization', () => {
  it('does not dispatch externally when consent is declined before authorization', async () => {
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
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
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

    expect(fetchMock).not.toHaveBeenCalled()
    await expect(
      prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: pending.currentAttempt!.id },
        select: {
          evaluationAuthorizedAt: true,
          evaluationStatus: true,
          availabilityReason: true,
        },
      })
    ).resolves.toEqual({
      evaluationAuthorizedAt: null,
      evaluationStatus: 'UNAVAILABLE',
      availabilityReason: 'CONSENT_DECLINED',
    })
  })

  it('finishes a dispatch authorized before a later consent decline', async () => {
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
    let resolveEvaluator: ((response: Response) => void) | undefined
    const evaluatorResponsePromise = new Promise<Response>((resolve) => {
      resolveEvaluator = resolve
    })
    let markFetchStarted: (() => void) | undefined
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        markFetchStarted?.()
        return evaluatorResponsePromise
      })
    )

    const evaluation = handleEvaluateFreeTextAttempt(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: 0,
      },
      { prisma } as never,
      {} as never
    )
    await fetchStarted
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    resolveEvaluator?.(
      new Response(
        JSON.stringify(
          evaluatorResponse(pending.currentAttempt!.id, 60, 'partial')
        ),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    await expect(evaluation).resolves.toEqual({
      success: true,
      applied: true,
    })
    await expect(
      prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: pending.currentAttempt!.id },
        select: {
          evaluationAuthorizedAt: true,
          evaluationStatus: true,
          evaluationSource: true,
        },
      })
    ).resolves.toMatchObject({
      evaluationAuthorizedAt: expect.any(Date),
      evaluationStatus: 'EVALUATED',
      evaluationSource: 'SEMANTIC',
    })
  })

  it('does not resend an answer after consent is declined between deliveries', async () => {
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
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      handleEvaluateFreeTextAttempt(
        {
          attemptId: pending.currentAttempt!.id,
          evaluationRevision: 0,
        },
        { prisma } as never,
        {} as never
      )
    ).rejects.toThrow('Semantic evaluator request failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    fetchMock.mockClear()

    await handleEvaluateFreeTextAttempt(
      {
        attemptId: pending.currentAttempt!.id,
        evaluationRevision: 0,
      },
      { prisma } as never,
      {} as never
    )

    expect(fetchMock).not.toHaveBeenCalled()
    await expect(
      prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: pending.currentAttempt!.id },
        select: {
          evaluationAuthorizedAt: true,
          evaluationStatus: true,
          availabilityReason: true,
        },
      })
    ).resolves.toEqual({
      evaluationAuthorizedAt: expect.any(Date),
      evaluationStatus: 'UNAVAILABLE',
      availabilityReason: 'CONSENT_DECLINED',
    })
  })

  it('does not apply exact fallback after participant access is lost', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const pending = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'Diversification reduces idiosyncratic risk.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    await prisma.practiceQuiz.update({
      where: { id: fixture.practiceQuiz.id },
      data: { isDeleted: true },
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

    expect(fetchMock).not.toHaveBeenCalled()
    await expect(
      prisma.freeTextAttempt.findUniqueOrThrow({
        where: { id: pending.currentAttempt!.id },
        select: {
          evaluationStatus: true,
          evaluationSource: true,
          availabilityReason: true,
          questionResponseDetailId: true,
        },
      })
    ).resolves.toEqual({
      evaluationStatus: 'UNAVAILABLE',
      evaluationSource: null,
      availabilityReason: 'PARTICIPANT_ACCESS_UNAVAILABLE',
      questionResponseDetailId: null,
    })
  })
})
