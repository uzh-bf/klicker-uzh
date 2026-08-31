import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import { SemanticEvaluationConsentDecision } from '@klicker-uzh/prisma/client'
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
  getSemanticFreeTextCapability,
} from '../src/services/freeTextEvaluation.js'
import {
  cleanupFixtures,
  createFixture,
  lecturerContext,
  participantContext,
  semanticConfig,
  workflowRunRef,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-evaluation-privacy-${Date.now()}`
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

describe('semantic free-text privacy and consent', () => {
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

  it('allows declined consent to be accepted before the next answer', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', '')
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    const fallback = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It makes a portfolio safer.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )
    expect(fallback).toMatchObject({
      stateVersion: 2,
      currentAttempt: {
        evaluationStatus: 'UNAVAILABLE',
        evaluationSource: null,
        availabilityReason: 'CONSENT_DECLINED',
      },
    })
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    vi.stubEnv('CATALYST_FORMATIVE_EVALUATOR_URL', 'http://127.0.0.1:7099')

    const retried = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk across investments.',
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(retried.currentAttempt).toMatchObject({
      evaluationRevision: 0,
      evaluationStatus: 'PENDING',
    })
    expect(retried.stateVersion).toBe(3)
    expect(retried.attemptsUsed).toBe(2)
    expect(schedule).toHaveBeenCalledTimes(1)
  })

  it('stores one current consent decision per disclosure version', async () => {
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )
    vi.stubEnv('SEMANTIC_EVALUATION_DISCLOSURE_VERSION', '2026-08-19')
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-19', accepted: false },
      ctx
    )

    const consents = await prisma.participantSemanticEvaluationConsent.findMany(
      {
        where: { participantId: fixture.participant.id },
        orderBy: { disclosureVersion: 'asc' },
      }
    )
    expect(
      consents.map((consent) => [consent.disclosureVersion, consent.decision])
    ).toEqual([
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

  it('excludes the participant own applied answers from peer answers', async () => {
    const ownAnswer = semanticConfig.accepted_exact_answers[0]!
    await prisma.elementInstance.update({
      where: { id: fixture.instance.id },
      data: {
        results: {
          responses: {
            own: { value: ownAnswer.toLowerCase(), count: 1 },
            peer: { value: 'A peer response', count: 2 },
          },
          total: 3,
        },
      },
    })
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: false },
      ctx
    )

    const state = await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: ownAnswer,
        answerTime: 3,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    expect(state.peerAnswers).toEqual([{ value: 'A peer response', count: 2 }])
  })
})
