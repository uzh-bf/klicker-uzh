import { randomUUID } from 'node:crypto'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  FreeTextEvaluationSource,
  FreeTextEvaluationStatus,
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
import {
  createFreeTextAttempt,
  decideSemanticEvaluationConsent,
  revealFreeTextSolution,
  startFreeTextPracticeCycle,
} from '../src/services/freeTextEvaluation.js'
import { getLocalExactFreeTextSubmissionId } from '../src/services/freeTextEvaluationCommands.js'
import { respondToElementStack } from '../src/services/stacks.js'
import {
  cleanupFixtures,
  createFixture,
  participantContext,
  semanticConfig,
  workflowRunRef,
} from './freeTextEvaluation.fixture.js'

const TEST_PREFIX = `free-text-stack-compatibility-${Date.now()}`
type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture

async function createLegacyFreeTextInstance(fixture: Fixture) {
  const elementData = fixture.instance.elementData
  if (elementData.type !== ElementType.FREE_TEXT) {
    throw new Error('Expected a free-text fixture')
  }
  const { semanticEvaluation: _semanticEvaluation, ...legacyOptions } =
    elementData.options

  return await prisma.elementInstance.create({
    data: {
      type: fixture.instance.type,
      elementType: fixture.instance.elementType,
      order: 1,
      options: fixture.instance.options,
      elementData: { ...elementData, options: legacyOptions },
      results: fixture.instance.results,
      anonymousResults: fixture.instance.anonymousResults,
      elementId: fixture.instance.elementId,
      elementStackId: fixture.instance.elementStackId,
      ownerId: fixture.instance.ownerId,
      instanceStatistics: { create: {} },
    },
  })
}

function legacySemanticStackInput(answer: string) {
  return {
    stackId: fixture.practiceQuiz.stacks[0]!.id,
    courseId: fixture.course.id,
    responses: [
      {
        instanceId: fixture.instance.id,
        type: ElementType.FREE_TEXT,
        freeTextResponse: answer,
      },
    ],
    stackAnswerTime: 3,
  }
}

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

describe('semantic free-text stack compatibility', () => {
  it('keeps legacy exact submissions local and idempotent on replay', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    const input = legacySemanticStackInput(
      'Diversification reduces idiosyncratic risk.'
    )

    const first = await respondToElementStack(input, ctx)
    const replay = await respondToElementStack(input, ctx)

    expect(first?.status).toBe('correct')
    expect(replay?.status).toBe('correct')
    expect(schedule).not.toHaveBeenCalled()
    const attempts = await prisma.freeTextAttempt.findMany({
      where: {
        cycle: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      },
    })
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.evaluationSource).toBe(
      FreeTextEvaluationSource.EXACT_MATCH
    )
    expect(attempts[0]?.availabilityReason).toBe(
      'CLIENT_SUBMISSION_ID_UNAVAILABLE'
    )
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: attempts[0]!.id } },
      })
    ).toBe(1)
  })

  it('allows the same legacy exact answer in an explicitly new cycle', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    const input = legacySemanticStackInput(
      'Diversification reduces idiosyncratic risk.'
    )

    await respondToElementStack(input, ctx)
    await startFreeTextPracticeCycle({ instanceId: fixture.instance.id }, ctx)
    await respondToElementStack(input, ctx)

    expect(schedule).not.toHaveBeenCalled()
    expect(
      await prisma.freeTextPracticeCycle.count({
        where: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      })
    ).toBe(2)
    expect(
      await prisma.freeTextAttempt.count({
        where: {
          cycle: {
            participantId: fixture.participant.id,
            elementInstanceId: fixture.instance.id,
          },
        },
      })
    ).toBe(2)
  })

  it('keeps legacy semantic non-matches unavailable and local', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )

    await respondToElementStack(
      legacySemanticStackInput('An unrelated answer.'),
      ctx
    )

    expect(schedule).not.toHaveBeenCalled()
    const attempt = await prisma.freeTextAttempt.findFirstOrThrow({
      where: {
        cycle: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instance.id,
        },
      },
    })
    expect(attempt.evaluationStatus).toBe(FreeTextEvaluationStatus.UNAVAILABLE)
    expect(attempt.correctness).toBeNull()
    expect(attempt.availabilityReason).toBe('CLIENT_SUBMISSION_ID_UNAVAILABLE')
    expect(
      await prisma.questionResponseDetail.count({
        where: { freeTextAttempt: { id: attempt.id } },
      })
    ).toBe(0)
  })

  it('allows an explicit solution reveal after a local non-match', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)

    await respondToElementStack(
      legacySemanticStackInput('An unrelated answer.'),
      ctx
    )
    const cycle = await prisma.freeTextPracticeCycle.findFirstOrThrow({
      where: {
        participantId: fixture.participant.id,
        elementInstanceId: fixture.instance.id,
      },
    })

    const revealed = await revealFreeTextSolution({ cycleId: cycle.id }, ctx)

    expect(revealed.solutionAuthorized).toBe(true)
    expect(revealed.referenceSolution).toBe(semanticConfig.reference_solution)
    expect(revealed.explanation).toBe(fixture.instance.elementData.explanation)
    expect(schedule).not.toHaveBeenCalled()
  })

  it('rejects a caller-supplied course that does not own the stack', async () => {
    const ctx = participantContext(fixture.participant.id, vi.fn())

    await expect(
      respondToElementStack(
        {
          ...legacySemanticStackInput('An unrelated answer.'),
          courseId: randomUUID(),
        },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    })
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

  it('never resumes a colliding pending attempt from local-only mode', async () => {
    const schedule = vi.fn().mockResolvedValue(workflowRunRef())
    const ctx = participantContext(fixture.participant.id, schedule)
    const answer = 'An unrelated answer.'
    const state = await startFreeTextPracticeCycle(
      { instanceId: fixture.instance.id },
      ctx
    )
    const clientSubmissionId = getLocalExactFreeTextSubmissionId({
      cycleId: state.cycleId,
      answer,
    })
    await prisma.freeTextAttempt.create({
      data: {
        cycleId: state.cycleId,
        ordinal: 1,
        clientSubmissionId,
        answer,
        answerTime: 3,
        evaluationStatus: FreeTextEvaluationStatus.PENDING,
        rubricSchemaVersion: semanticConfig.rubric_schema.schema_version,
        rubricSchemaHash: 'synthetic-test-hash',
      },
    })

    await respondToElementStack(legacySemanticStackInput(answer), ctx)

    expect(schedule).not.toHaveBeenCalled()
    expect(
      await prisma.freeTextAttempt.findUniqueOrThrow({
        where: {
          cycleId_clientSubmissionId: {
            cycleId: state.cycleId,
            clientSubmissionId,
          },
        },
      })
    ).toMatchObject({ workflowRunId: null })
  })

  it('preflights semantic input before writing earlier responses', async () => {
    const legacyInstance = await createLegacyFreeTextInstance(fixture)
    await expect(
      respondToElementStack(
        {
          stackId: fixture.practiceQuiz.stacks[0]!.id,
          courseId: fixture.course.id,
          responses: [
            {
              instanceId: legacyInstance.id,
              type: ElementType.FREE_TEXT,
              freeTextResponse: 'A legacy response that must not be written.',
            },
            {
              instanceId: fixture.instance.id,
              type: ElementType.FREE_TEXT,
              freeTextResponse: 'Diversification reduces idiosyncratic risk.',
              clientSubmissionId: 'not-a-uuid',
            },
          ],
          stackAnswerTime: 3,
        },
        participantContext(fixture.participant.id)
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(
      await prisma.questionResponse.count({
        where: {
          participantId: fixture.participant.id,
          elementInstanceId: legacyInstance.id,
        },
      })
    ).toBe(0)
  })

  it('processes idempotent semantic responses before legacy writes', async () => {
    const legacyInstance = await createLegacyFreeTextInstance(fixture)
    const ctx = participantContext(fixture.participant.id)
    await decideSemanticEvaluationConsent(
      { disclosureVersion: '2026-08-18', accepted: true },
      ctx
    )
    await createFreeTextAttempt(
      {
        instanceId: fixture.instance.id,
        answer: 'It spreads risk.',
        answerTime: 2,
        clientSubmissionId: randomUUID(),
      },
      ctx,
      { disclosureVersion: '2026-08-18' }
    )

    await expect(
      respondToElementStack(
        {
          stackId: fixture.practiceQuiz.stacks[0]!.id,
          courseId: fixture.course.id,
          responses: [
            {
              instanceId: legacyInstance.id,
              type: ElementType.FREE_TEXT,
              freeTextResponse: 'A legacy response that must not be written.',
            },
            {
              instanceId: fixture.instance.id,
              type: ElementType.FREE_TEXT,
              freeTextResponse: 'A second semantic answer.',
              clientSubmissionId: randomUUID(),
            },
          ],
          stackAnswerTime: 4,
        },
        ctx
      )
    ).rejects.toThrow('Retry the current free-text evaluation before answering')
    expect(
      await prisma.questionResponse.count({
        where: {
          participantId: fixture.participant.id,
          elementInstanceId: legacyInstance.id,
        },
      })
    ).toBe(0)
  })
})
