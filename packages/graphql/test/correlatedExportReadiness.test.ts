import {
  LiveQuizResponseCollectionMode,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '../src/lib/context.js'
import { getCorrelatedExportReadiness } from '../src/services/liveQuizzes.js'

interface LiveQuizFixture {
  status: PublicationStatus
  isAssessmentEnabled: boolean
  responseCollectionMode: LiveQuizResponseCollectionMode
  publicationGeneration: number
}

const settledQuiz: LiveQuizFixture = {
  status: PublicationStatus.ENDED,
  isAssessmentEnabled: false,
  responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
  publicationGeneration: 4,
}

// the readiness answer is the conjunction of five independent counts, so each
// blocker is expressed on its own and the fixture stays at zero everywhere else
function createContext({
  liveQuiz = settledQuiz,
  unfinalizedRespondentCount = 0,
  expiredRespondentCount = 0,
  activeBindingCount = 0,
  pendingResponseCount = 0,
  invalidResponseCount = 0n,
}: {
  liveQuiz?: LiveQuizFixture | null
  unfinalizedRespondentCount?: number
  expiredRespondentCount?: number
  activeBindingCount?: number
  pendingResponseCount?: number
  invalidResponseCount?: bigint
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(liveQuiz)
  // both respondent counts hit the same delegate; the expired one is the only
  // query filtering on the retention cutoff
  const respondentCount = vi
    .fn()
    .mockImplementation(
      async ({ where }: { where: { finalizedAt?: unknown } }) =>
        where.finalizedAt ? expiredRespondentCount : unfinalizedRespondentCount
    )
  const bindingCount = vi.fn().mockResolvedValue(activeBindingCount)
  const pendingCount = vi.fn().mockResolvedValue(pendingResponseCount)
  const queryRaw = vi.fn().mockResolvedValue([{ invalidResponseCount }])

  return {
    findUnique,
    respondentCount,
    ctx: {
      prisma: {
        liveQuiz: { findUnique },
        liveQuizRespondent: { count: respondentCount },
        liveQuizRespondentBinding: { count: bindingCount },
        liveQuizPendingResponse: { count: pendingCount },
        $queryRaw: queryRaw,
      },
    } as unknown as Context,
  }
}

describe('getCorrelatedExportReadiness', () => {
  it('reports a fully settled correlated quiz as ready', async () => {
    const { ctx, respondentCount } = createContext()

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(true)
    expect(respondentCount).toHaveBeenCalledTimes(2)
  })

  it('refuses a quiz that has not ended without counting anything', async () => {
    const { ctx, respondentCount } = createContext({
      liveQuiz: { ...settledQuiz, status: PublicationStatus.PUBLISHED },
    })

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(false)
    expect(respondentCount).not.toHaveBeenCalled()
  })

  it('refuses assessment quizzes', async () => {
    const { ctx } = createContext({
      liveQuiz: { ...settledQuiz, isAssessmentEnabled: true },
    })

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(false)
  })

  it('refuses quizzes that collect aggregate anonymous responses', async () => {
    const { ctx } = createContext({
      liveQuiz: {
        ...settledQuiz,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
    })

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(false)
  })

  it('refuses an unknown quiz', async () => {
    const { ctx } = createContext({ liveQuiz: null })

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(false)
  })

  it.each([
    [
      'respondents are still missing an export label',
      { unfinalizedRespondentCount: 1 },
    ],
    ['account bindings still exist', { activeBindingCount: 1 }],
    ['responses have not settled yet', { pendingResponseCount: 1 }],
    [
      'responses are not owned by a finalized label',
      { invalidResponseCount: 1n },
    ],
    [
      'retention has started removing respondents',
      { expiredRespondentCount: 1 },
    ],
  ])('refuses an ended correlated quiz while %s', async (_label, blocker) => {
    const { ctx } = createContext(blocker)

    await expect(
      getCorrelatedExportReadiness({ id: 'quiz-id' }, ctx)
    ).resolves.toBe(false)
  })
})
