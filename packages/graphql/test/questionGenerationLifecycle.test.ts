import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { questionGenerationServiceError } from '../src/services/questionGenerationErrors.js'
import type {
  FlashcardGenerationRuntime,
  QuestionGenerationRuntime,
} from '../src/services/questionGenerationRuntime.js'

const fixtures = vi.hoisted(() => ({
  buildId: '123e4567-e89b-42d3-a456-426614174000',
  graphBuildId: '223e4567-e89b-42d3-a456-426614174000',
  ownerId: '323e4567-e89b-42d3-a456-426614174000',
  dispatchAttemptId: '423e4567-e89b-42d3-a456-426614174000',
  configuration: {
    itemType: 'SC',
    language: 'de',
    questionCount: 1,
    objectives: [],
    sourceScopes: [],
    bloomLevels: ['remember'],
    difficultyPreset: 'uniform',
    difficultyCounts: { d1: 1, d2: 0, d3: 0, d4: 0, d5: 0 },
  },
}))

vi.mock('../src/services/elementGenerationProvider.js', () => ({
  canonicalElementGenerationJson: (value: unknown) => value,
  elementGenerationArtifactPayload: (ref: {
    containerName: string
    blobName: string
    sha256: string
  }) => ({
    container_name: ref.containerName,
    blob_name: ref.blobName,
    sha256: ref.sha256,
  }),
  elementGenerationOutputBlobName: (
    runtime: { questionOutputPrefix: string },
    buildId: string,
    suffix: string
  ) => `${runtime.questionOutputPrefix}/${buildId}/${suffix}`,
  loadReadyElementGenerationGraph: vi.fn(async () => ({
    id: fixtures.graphBuildId,
    sourceSnapshot: [],
    storageName: fixtures.graphBuildId,
  })),
  normalizeElementGenerationIdempotencyKey: (value: string) => value.trim(),
}))

vi.mock(
  '../src/services/elementGenerationAccounting.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../src/services/elementGenerationAccounting.js')
      >()
    return {
      ...actual,
      claimElementGenerationSpend: vi.fn(async () => true),
      createElementGenerationBuildWithSpend: vi.fn(),
      getElementGenerationSpendDispatchState: vi.fn(async () => ({
        costStatus: DB.KBGraphCostStatus.RESERVED,
        dispatchClaimedAt: null,
      })),
      isFlashcardRetrySpend: vi.fn(async () => false),
      releaseStaleClaimedElementGenerationSpend: vi.fn(async () => true),
      releaseUnclaimedElementGenerationSpend: vi.fn(async () => false),
      reserveFlashcardRetrySpend: vi.fn(),
      settleElementGenerationSpend: vi.fn(async () => true),
    }
  }
)

vi.mock('../src/services/questionGenerationConfiguration.js', () => ({
  QuestionGenerationConfigurationError: class extends Error {},
  normalizeQuestionGenerationConfiguration: () => ({
    configuration: fixtures.configuration,
    configurationHash: 'configuration-hash',
  }),
}))

vi.mock('../src/services/questionGenerationBlueprint.js', () => ({
  createQuestionGenerationBlueprint: vi.fn(async () =>
    Buffer.from('immutable-blueprint')
  ),
}))

vi.mock('../src/services/questionGenerationGraph.js', () => ({
  assertQuestionGenerationPreviewAccess: vi.fn(async () => undefined),
  questionGenerationSourceSnapshot: () => [],
}))

import {
  getFlashcardGenerationBuild,
  retryFlashcardGeneration,
} from '../src/services/flashcardGeneration.js'
import {
  isFlashcardRetrySpend,
  reserveFlashcardRetrySpend,
} from '../src/services/elementGenerationAccounting.js'
import {
  getQuestionGenerationBuild,
  reviewQuestionGenerationDesign,
  startQuestionGeneration,
} from '../src/services/questionGeneration.js'

function preparingBuild() {
  return {
    id: fixtures.buildId,
    ownerId: fixtures.ownerId,
    sourceGraphBuildId: fixtures.graphBuildId,
    elementType: DB.ElementType.SC,
    idempotencyKey: 'stable-request',
    configurationHash: 'configuration-hash',
    configuration: fixtures.configuration,
    requestedElementCount: 1,
    costAccountingVersion: 1,
    status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
    providerDispatchAttemptId: fixtures.dispatchAttemptId,
    blueprintArtifact: null,
    reviews: [],
    drafts: [],
    sourceGraphBuild: {
      id: fixtures.graphBuildId,
      kbId: '523e4567-e89b-42d3-a456-426614174000',
      graphBundleSha256: 'a'.repeat(64),
      graphName: `klickeruzh:kb:kb:${fixtures.graphBuildId}`,
      graphManifestArtifact: {
        containerName: 'kg-graph-artifacts',
        blobName: `graph-artifacts/${fixtures.graphBuildId}/${fixtures.graphBuildId}/${'a'.repeat(64)}/manifest.json`,
        sha256: 'b'.repeat(64),
      },
      graphSha256: 'c'.repeat(64),
      graphManifestSchemaVersion: 2,
      graphBundleStorageName: fixtures.graphBuildId,
      sources: [],
    },
  }
}

describe('question-generation preparation lifecycle', () => {
  it('resumes a crash-window build with its durable dispatch attempt', async () => {
    const build = preparingBuild()
    const completed = {
      ...build,
      status: DB.ElementGenerationBuildStatus.DESIGNING,
    }
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const findRunByBuildId = vi.fn(async () => ({
      runId: 'recovered-run',
      status: 'RUNNING' as const,
    }))
    const start = vi.fn()
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(async () => {
        throw questionGenerationServiceError(
          'ARTIFACT_UPLOAD_CONFLICT',
          'already uploaded'
        )
      }),
      downloadVerified: vi.fn(async () => Buffer.from('immutable-blueprint')),
      downloadVerifiedStream: vi.fn(),
      downloadImmutable: vi.fn(),
      start,
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId,
      findRunByQuestionReview: vi.fn(),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findUnique: vi.fn(async () => build),
          findFirst: vi.fn(async () => completed),
          updateMany,
        },
      },
    }

    await expect(
      startQuestionGeneration(
        {
          graphBuildId: fixtures.graphBuildId,
          idempotencyKey: 'stable-request',
        } as never,
        ctx as never
      )
    ).resolves.toEqual(completed)

    expect(runtime.downloadVerified).toHaveBeenCalledOnce()
    expect(findRunByBuildId).toHaveBeenCalledWith(
      fixtures.buildId,
      fixtures.dispatchAttemptId
    )
    expect(start).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          providerWorkflowRunId: 'recovered-run',
          status: DB.ElementGenerationBuildStatus.DESIGNING,
        }),
      })
    )
  })
})

describe('flashcard retry preparation lifecycle', () => {
  it('increments a recovered retry exactly when its build advances', async () => {
    vi.mocked(isFlashcardRetrySpend).mockResolvedValueOnce(true)
    const build = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      configuration: {
        language: 'de',
        flashcardCount: 1,
        objectives: [],
      },
    }
    const queued = {
      ...build,
      status: DB.ElementGenerationBuildStatus.QUEUED,
      retryCount: 1,
    }
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
      startFlashcards: vi.fn(),
      publishIncompleteFlashcards: vi.fn(),
      findRunByFlashcardBuildId: vi.fn(async () => ({
        runId: 'recovered-retry-run',
        status: 'RUNNING' as const,
      })),
    } satisfies FlashcardGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(build)
            .mockResolvedValueOnce(queued),
          updateMany,
        },
      },
    }

    await expect(
      getFlashcardGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(queued)
    expect(runtime.startFlashcards).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ retryCount: { increment: 1 } }),
      })
    )
  })

  it('serializes a retry and poll through one lease-owned provider dispatch', async () => {
    vi.mocked(isFlashcardRetrySpend).mockResolvedValue(true)
    let releaseReservation!: () => void
    const reservationMayReturn = new Promise<void>((resolve) => {
      releaseReservation = resolve
    })
    let reservationRecorded!: () => void
    const reservationWasRecorded = new Promise<void>((resolve) => {
      reservationRecorded = resolve
    })
    let leaseAcquired!: () => void
    const leaseWasAcquired = new Promise<void>((resolve) => {
      leaseAcquired = resolve
    })
    let current = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      configuration: {
        language: 'de',
        flashcardCount: 1,
        objectives: [],
      },
      status: DB.ElementGenerationBuildStatus
        .AWAITING_INCOMPLETE_PUBLICATION as DB.ElementGenerationBuildStatus,
      stage: 'awaiting_incomplete_publication',
      retryCount: 0,
      syncLeaseOwner: null as string | null,
      syncLeaseUntil: null as Date | null,
    }
    vi.mocked(reserveFlashcardRetrySpend).mockImplementationOnce(
      async (_prisma, input) => {
        current = {
          ...current,
          status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
          stage: 'retry_dispatching',
          providerDispatchAttemptId: input.dispatchAttemptId,
        }
        reservationRecorded()
        await reservationMayReturn
        return true
      }
    )
    const updateMany = vi.fn(async ({ where, data }) => {
      if (data.syncLeaseOwner && data.syncLeaseUntil) {
        if (
          current.syncLeaseOwner !== null ||
          (where.status && where.status !== current.status)
        ) {
          return { count: 0 }
        }
        current = {
          ...current,
          syncLeaseOwner: data.syncLeaseOwner,
          syncLeaseUntil: data.syncLeaseUntil,
        }
        leaseAcquired()
        return { count: 1 }
      }
      if (data.status === DB.ElementGenerationBuildStatus.QUEUED) {
        if (
          current.status !== DB.ElementGenerationBuildStatus.PREPARING_INPUT ||
          current.syncLeaseOwner !== where.syncLeaseOwner
        ) {
          return { count: 0 }
        }
        current = {
          ...current,
          ...data,
          retryCount: current.retryCount + 1,
          syncLeaseOwner: current.syncLeaseOwner,
          syncLeaseUntil: current.syncLeaseUntil,
        }
        return { count: 1 }
      }
      if (data.syncLeaseOwner === null && where.syncLeaseOwner) {
        if (current.syncLeaseOwner !== where.syncLeaseOwner) {
          return { count: 0 }
        }
        current = {
          ...current,
          syncLeaseOwner: null,
          syncLeaseUntil: null,
        }
        return { count: 1 }
      }
      return { count: 0 }
    })
    const startFlashcards = vi.fn(
      async (_payload, _scope, _dispatchAttemptId, beforeProviderDispatch) => {
        await beforeProviderDispatch()
        return { eventId: 'retry-event' }
      }
    )
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
      startFlashcards,
      publishIncompleteFlashcards: vi.fn(),
      findRunByFlashcardBuildId: vi.fn(async () => null),
    } satisfies FlashcardGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi.fn(async () => current),
          updateMany,
        },
      },
    }

    const retry = retryFlashcardGeneration(fixtures.buildId, ctx as never)
    await reservationWasRecorded
    const poll = getFlashcardGenerationBuild(fixtures.buildId, ctx as never)
    await leaseWasAcquired
    releaseReservation()
    await Promise.all([retry, poll])

    expect(startFlashcards).toHaveBeenCalledOnce()
    expect(current.retryCount).toBe(1)
    expect(current.status).toBe(DB.ElementGenerationBuildStatus.QUEUED)
    expect(current.status).not.toBe(DB.ElementGenerationBuildStatus.FAILED)
  })
})

describe('terminal workflow artifact lifecycle', () => {
  it('fails a successful question workflow whose required artifact is missing', async () => {
    const build = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      providerEventId: 'question-event',
    }
    const failed = {
      ...build,
      status: DB.ElementGenerationBuildStatus.FAILED,
      errorCode: 'ARTIFACT_INVALID',
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(async () => {
        throw questionGenerationServiceError(
          'ARTIFACT_NOT_FOUND',
          'not available',
          true
        )
      }),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(async () => ({
        runId: 'question-run',
        status: 'SUCCEEDED' as const,
      })),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(build)
            .mockResolvedValueOnce(failed),
          updateMany,
        },
      },
    }

    await expect(
      getQuestionGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(failed)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorCode: 'ARTIFACT_INVALID',
          errorRetryable: false,
        }),
      })
    )
  })

  it('fails a successful flashcard workflow whose required artifact is missing', async () => {
    const build = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      status: DB.ElementGenerationBuildStatus.RUNNING,
      providerEventId: 'flashcard-event',
    }
    const failed = {
      ...build,
      status: DB.ElementGenerationBuildStatus.FAILED,
      errorCode: 'ARTIFACT_INVALID',
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(async () => {
        throw questionGenerationServiceError(
          'ARTIFACT_NOT_FOUND',
          'not available',
          true
        )
      }),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(async () => ({
        runId: 'flashcard-run',
        status: 'SUCCEEDED' as const,
      })),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
      startFlashcards: vi.fn(),
      publishIncompleteFlashcards: vi.fn(),
      findRunByFlashcardBuildId: vi.fn(),
    } satisfies FlashcardGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(build)
            .mockResolvedValueOnce(failed),
          updateMany,
        },
      },
    }

    await expect(
      getFlashcardGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(failed)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorCode: 'ARTIFACT_INVALID',
          errorRetryable: false,
        }),
      })
    )
  })
})

describe('question-generation review dispatch lifecycle', () => {
  it('persists the review claim before dispatching its exact attempt', async () => {
    const review = {
      id: '623e4567-e89b-42d3-a456-426614174000',
      buildId: fixtures.buildId,
      gate: DB.ElementGenerationReviewGate.DESIGN,
      decision: DB.ElementGenerationReviewDecision.APPROVE,
      reviewerId: fixtures.ownerId,
      warningsAcknowledged: true,
      artifact: { containerName: 'question-results' },
      reviewedAt: new Date('2026-08-26T12:00:00.000Z'),
      createdAt: new Date('2026-08-26T12:00:00.000Z'),
    }
    const waiting = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
      designArtifact: review.artifact,
      designSummary: { warnings: [] },
      reviews: [],
    }
    let persistedReviewId = ''
    const createReview = vi.fn(async ({ data }: { data: { id: string } }) => {
      persistedReviewId = data.id
      return { ...review, id: data.id }
    })
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const dispatchReview = vi.fn(async () => ({ eventId: 'review-event' }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: dispatchReview,
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(async () => null),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationReview: { create: createReview },
        elementGenerationBuild: {
          findFirst: vi.fn(async () => {
            if (!persistedReviewId) return waiting
            const claimed = {
              ...waiting,
              reviews: [{ ...review, id: persistedReviewId }],
            }
            return updateMany.mock.calls.length >= 2
              ? {
                  ...claimed,
                  status: DB.ElementGenerationBuildStatus.GENERATING_ITEMS,
                  stage: 'stems',
                }
              : claimed
          }),
          updateMany,
        },
      },
    }

    const result = await reviewQuestionGenerationDesign(
      {
        buildId: fixtures.buildId,
        decision: 'APPROVE',
        warningsAcknowledged: true,
      },
      ctx as never
    )
    expect(result.status).toBe(DB.ElementGenerationBuildStatus.GENERATING_ITEMS)

    expect(createReview).toHaveBeenCalledBefore(dispatchReview)
    expect(persistedReviewId).not.toBe('')
    expect(runtime.findRunByQuestionReview).toHaveBeenCalledWith(
      fixtures.buildId,
      persistedReviewId
    )
    expect(dispatchReview).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          question_build_id: fixtures.buildId,
          decision: 'approve',
        }),
      }),
      `question-build:${fixtures.buildId}`,
      persistedReviewId
    )
  })

  it('recovers a persisted review attempt without dispatching another event', async () => {
    const review = {
      id: '723e4567-e89b-42d3-a456-426614174000',
      buildId: fixtures.buildId,
      gate: DB.ElementGenerationReviewGate.DESIGN,
      decision: DB.ElementGenerationReviewDecision.APPROVE,
      reviewerId: fixtures.ownerId,
      warningsAcknowledged: true,
      artifact: { containerName: 'question-results' },
      reviewedAt: new Date('2026-08-26T12:00:00.000Z'),
      createdAt: new Date('2026-08-26T12:00:00.000Z'),
    }
    const waiting = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
      designArtifact: review.artifact,
      designSummary: { warnings: [] },
      reviews: [review],
    }
    const advanced = {
      ...waiting,
      status: DB.ElementGenerationBuildStatus.GENERATING_ITEMS,
    }
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const dispatchReview = vi.fn()
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: dispatchReview,
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(async () => ({
        runId: 'recovered-review-run',
        status: 'RUNNING' as const,
      })),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(waiting)
            .mockResolvedValueOnce(waiting)
            .mockResolvedValueOnce(advanced),
          updateMany,
        },
      },
    }

    await expect(
      reviewQuestionGenerationDesign(
        {
          buildId: fixtures.buildId,
          decision: 'APPROVE',
          warningsAcknowledged: true,
        },
        ctx as never
      )
    ).resolves.toEqual(advanced)

    expect(runtime.findRunByQuestionReview).toHaveBeenCalledWith(
      fixtures.buildId,
      review.id
    )
    expect(dispatchReview).not.toHaveBeenCalled()
  })

  it('rejects the opposing P2002 loser before external dispatch', async () => {
    const existingReview = {
      id: '923e4567-e89b-42d3-a456-426614174000',
      buildId: fixtures.buildId,
      gate: DB.ElementGenerationReviewGate.DESIGN,
      decision: DB.ElementGenerationReviewDecision.REJECT,
      reviewerId: fixtures.ownerId,
      warningsAcknowledged: false,
      artifact: { containerName: 'question-results' },
      reviewedAt: new Date('2026-08-26T12:00:00.000Z'),
      createdAt: new Date('2026-08-26T12:00:00.000Z'),
    }
    const waiting = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
      designArtifact: existingReview.artifact,
      designSummary: { warnings: [] },
      reviews: [],
    }
    const raced = { ...waiting, reviews: [existingReview] }
    const dispatchReview = vi.fn()
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: dispatchReview,
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationReview: {
          create: vi.fn(async () => {
            throw new DB.Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed',
              { code: 'P2002', clientVersion: '7.8.0' }
            )
          }),
        },
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(waiting)
            .mockResolvedValueOnce(raced),
        },
      },
    }

    await expect(
      reviewQuestionGenerationDesign(
        {
          buildId: fixtures.buildId,
          decision: 'APPROVE',
          warningsAcknowledged: true,
        },
        ctx as never
      )
    ).rejects.toMatchObject({ code: 'REVIEW_CONFLICT' })
    expect(ctx.prisma.elementGenerationReview.create).toHaveBeenCalledOnce()
    expect(dispatchReview).not.toHaveBeenCalled()
  })
})

describe('flashcard incomplete-publication lifecycle', () => {
  it('redispatches a claimed publication with the same durable attempt', async () => {
    const publicationAttemptId = '823e4567-e89b-42d3-a456-426614174000'
    const publishing = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      startManifestArtifact: {
        containerName: 'question-results',
        blobName: `question-builds/${fixtures.buildId}/manifest/start.json`,
        sha256: 'd'.repeat(64),
      },
      incompletePublishedById: fixtures.ownerId,
      providerPublicationDispatchAttemptId: publicationAttemptId,
      providerPublicationEventId: null,
      providerPublicationWorkflowRunId: null,
    }
    const dispatched = {
      ...publishing,
      providerPublicationEventId: 'publication-event',
    }
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const publishIncompleteFlashcards = vi.fn(async () => ({
      eventId: 'publication-event',
    }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
      startFlashcards: vi.fn(),
      publishIncompleteFlashcards,
      findRunByFlashcardBuildId: vi.fn(async () => null),
    } satisfies FlashcardGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(publishing)
            .mockResolvedValueOnce(dispatched),
          updateMany,
        },
      },
    }

    await expect(
      getFlashcardGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(dispatched)

    expect(runtime.findRunByFlashcardBuildId).toHaveBeenNthCalledWith(
      1,
      fixtures.buildId,
      publicationAttemptId,
      'publish-incomplete'
    )
    expect(publishIncompleteFlashcards).toHaveBeenCalledWith(
      expect.objectContaining({
        flashcard_build_id: fixtures.buildId,
        reviewed_by: fixtures.ownerId,
      }),
      `flashcard-build:${fixtures.buildId}`,
      publicationAttemptId
    )
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          providerPublicationDispatchAttemptId: publicationAttemptId,
        }),
        data: expect.objectContaining({
          providerPublicationEventId: 'publication-event',
        }),
      })
    )
  })

  it('recovers the exact publication attempt after uncertain dispatch', async () => {
    const publicationAttemptId = 'a23e4567-e89b-42d3-a456-426614174000'
    const publishing = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      startManifestArtifact: {
        containerName: 'question-results',
        blobName: `question-builds/${fixtures.buildId}/manifest/start.json`,
        sha256: 'd'.repeat(64),
      },
      incompletePublishedById: fixtures.ownerId,
      providerPublicationDispatchAttemptId: publicationAttemptId,
      providerPublicationEventId: null,
      providerPublicationWorkflowRunId: null,
    }
    const recovered = {
      ...publishing,
      providerPublicationWorkflowRunId: 'recovered-publication-run',
    }
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const publishIncompleteFlashcards = vi.fn(async () => {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Publication dispatch outcome is unknown',
        true
      )
    })
    const findRunByFlashcardBuildId = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        runId: 'recovered-publication-run',
        status: 'RUNNING' as const,
      })
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
      startFlashcards: vi.fn(),
      publishIncompleteFlashcards,
      findRunByFlashcardBuildId,
    } satisfies FlashcardGenerationRuntime
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(publishing)
            .mockResolvedValueOnce(recovered),
          updateMany,
        },
      },
    }

    await expect(
      getFlashcardGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(recovered)

    expect(publishIncompleteFlashcards).toHaveBeenCalledOnce()
    expect(findRunByFlashcardBuildId).toHaveBeenNthCalledWith(
      3,
      fixtures.buildId,
      publicationAttemptId,
      'publish-incomplete'
    )
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          providerPublicationEventId: null,
          providerPublicationWorkflowRunId: 'recovered-publication-run',
        }),
      })
    )
  })
})
