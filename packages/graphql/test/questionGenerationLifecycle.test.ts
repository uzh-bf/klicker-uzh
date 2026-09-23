import { createLogger } from '@klicker-uzh/logging/node'
import * as DB from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      reserveElementGenerationRetrySpend: vi.fn(),
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

// The DB transaction of completeElementGeneration has its own integration
// suite; these tests assert the transition the lifecycle hands it.
vi.mock('../src/services/elementGenerationCompletion.js', () => ({
  completeElementGeneration: vi.fn(async () => undefined),
}))

import {
  isFlashcardRetrySpend,
  releaseUnclaimedElementGenerationSpend,
  reserveElementGenerationRetrySpend,
  reserveFlashcardRetrySpend,
} from '../src/services/elementGenerationAccounting.js'
import { completeElementGeneration } from '../src/services/elementGenerationCompletion.js'
import {
  getFlashcardGenerationBuild,
  retryFlashcardGeneration,
} from '../src/services/flashcardGeneration.js'
import {
  getQuestionGenerationBuild,
  retryQuestionGeneration,
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
    createdAt: new Date('2026-08-26T12:00:00.000Z'),
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

function resolvedDesignArtifact() {
  return Buffer.from(
    JSON.stringify({
      schema_version: 1,
      state: 'resolved',
      assessment: {
        id: fixtures.buildId,
        title: 'Generated questions',
        language: 'de',
        target_questions: 1,
      },
      modules: [{ module_id: 'M1', module_name: 'All material' }],
      objectives: [],
      sources: [],
      resolved_slots: [
        {
          design_slot_id: 'slot-1',
          module_id: 'M1',
          objective_id: '',
          origin_mode: 'new',
          item_format: 'single_choice',
          difficulty_scale: 1,
          bloom_level: 'remember',
        },
      ],
      topic_overview: { coverage_warnings: [] },
      generation_policy: 'new_only',
      origin_counts: { new: 1, reuse: 0, update: 0 },
    })
  )
}

function failedResultArtifact(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: 1,
      question_build_id: fixtures.buildId,
      status: 'failed',
      generation_policy: 'new_only',
      requested_questions: 1,
      generated_questions: 0,
      final_questions: null,
      review_required_questions: 0,
      review_required_question_ids: [],
      rejected_at: null,
      reviewed_by: null,
      ...overrides,
    })
  )
}

const FINAL_BANK_REF = {
  container_name: 'question-results',
  blob_name: `question-builds/${'123e4567-e89b-42d3-a456-426614174000'}/questions/final.json`,
  sha256: 'c'.repeat(64),
}

// A single grounded question in the legacy (schema version 1) shape. The
// partial bank is a subset of the reviewed Plan, so it only has to carry the
// slots the worker could ground.
function finalBankArtifact(ids: string[]): Buffer {
  return Buffer.from(
    JSON.stringify({
      metadata: { format: 'MC5', total_questions: ids.length },
      questions: ids.map((id) => ({
        id,
        stem: `Synthetic question ${id}`,
        bloom_level: 'remember',
        origin_mode: 'new',
        item_format: 'single_choice',
        difficulty_scale: 3,
        difficulty_status: 'llm_reviewed',
        options: [
          { label: 'A', text: `Correct ${id}`, is_correct: true },
          { label: 'B', text: `Wrong ${id}`, is_correct: false },
        ],
        correct_label: 'A',
        citations: [],
      })),
    })
  )
}

function partialResultArtifact(
  overrides: Record<string, unknown> = {}
): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: 1,
      question_build_id: fixtures.buildId,
      status: 'completed_partial',
      generation_policy: 'new_only',
      requested_questions: 2,
      generated_questions: 1,
      final_questions: FINAL_BANK_REF,
      review_required_questions: 0,
      review_required_question_ids: [],
      rejected_at: null,
      reviewed_by: null,
      slot_failures: [groundingSlotFailure()],
      ...overrides,
    })
  )
}

function groundingSlotFailure(overrides: Record<string, unknown> = {}) {
  return {
    slot_id: 'q02',
    module_id: 'M1',
    objective: 'Explain malolactic fermentation.',
    objective_source: 'provided',
    requested_level: 'remember',
    evidence_target: 'wine-chemistry.pdf#page=3',
    reason_code: 'NO_SUPPORTING_DOCUMENTS',
    failure_class: 'user_input',
    detail: null,
    suggestions: ['Malolactic fermentation'],
    ...overrides,
  }
}

// A two-slot Plan whose ids are the reviewed universe for a partial subset.
function twoSlotPlanSummary() {
  return {
    questionCount: 2,
    questions: ['q01', 'q02'].map((sourceQuestionId, index) => ({
      sourceQuestionId,
      moduleId: 'M1',
      objectiveId: null,
      stem: `Plan stem ${sourceQuestionId}`,
      bloomLevel: 'remember',
      targetDifficulty: index + 1,
      sources: [],
    })),
    warnings: [],
  }
}

function failedBuild() {
  return {
    ...preparingBuild(),
    status: DB.ElementGenerationBuildStatus.FAILED,
    stage: 'failed',
    errorCode: 'WORKFLOW_FAILED',
    resultManifestArtifact: {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/result.json`,
      sha256: 'e'.repeat(64),
    },
  }
}

function failedBuildRuntime(
  downloadVerified: (ref: unknown) => Promise<Buffer>
) {
  return {
    questionInputContainer: 'question-inputs',
    questionOutputContainer: 'question-results',
    questionOutputPrefix: 'question-builds',
    uploadCreateOnly: vi.fn(),
    downloadImmutable: vi.fn(),
    downloadVerified,
    downloadVerifiedStream: vi.fn(),
    start: vi.fn(),
    review: vi.fn(),
    getRun: vi.fn(),
    getRunById: vi.fn(),
    findRunByBuildId: vi.fn(),
    findRunByQuestionReview: vi.fn(),
  } satisfies QuestionGenerationRuntime
}

function failedBuildContext(
  build: ReturnType<typeof failedBuild>,
  runtime: ReturnType<typeof failedBuildRuntime>
) {
  return {
    user: { sub: fixtures.ownerId },
    elementGenerationRuntime: runtime,
    prisma: {
      elementGenerationBuild: {
        findFirst: vi.fn(async () => build),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      fixtures.dispatchAttemptId,
      build.createdAt
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

describe('question-generation synchronization lifecycle', () => {
  it('exposes a resolved Design while its Hatchet workflow waits for review', async () => {
    const build = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.DESIGNING,
      providerEventId: 'question-event',
      providerWorkflowRunId: null,
      lastSynchronizedAt: null,
    }
    const designArtifact = {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/design/resolved.json`,
      sha256: 'd'.repeat(64),
    }
    const designSummary = {
      title: 'Generated questions',
      questionCount: 1,
      objectives: [],
      modules: [
        { moduleId: 'M1', moduleName: 'All material', questionCount: 1 },
      ],
      sources: [],
      slots: [
        {
          sourceQuestionId: 'slot-1',
          moduleId: 'M1',
          objectiveId: null,
          bloomLevel: 'remember',
          targetDifficulty: 1,
          evidenceEntityIds: [],
        },
      ],
      warnings: [],
    }
    const waiting = {
      ...build,
      providerWorkflowRunId: 'question-run',
      designArtifact,
      designSummary,
      status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
      stage: 'design_review',
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(async () => ({
        ref: designArtifact,
        bytes: resolvedDesignArtifact(),
      })),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(async () => ({
        runId: 'question-run',
        status: 'RUNNING' as const,
      })),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(),
      findRunByQuestionReview: vi.fn(),
    } satisfies QuestionGenerationRuntime
    const ctx = {
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: runtime,
      prisma: {
        elementGenerationBuild: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(build)
            .mockResolvedValueOnce(waiting),
          updateMany,
        },
      },
    }

    await expect(
      getQuestionGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toEqual(waiting)

    expect(runtime.downloadImmutable).toHaveBeenCalledWith(
      'question-results',
      `question-builds/${fixtures.buildId}/design/resolved.json`
    )
    expect(runtime.getRun).toHaveBeenCalledWith('question-event')
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSummary,
          status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
          stage: 'design_review',
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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

describe('question-generation retry lifecycle', () => {
  beforeEach(() => {
    vi.mocked(reserveElementGenerationRetrySpend).mockClear()
  })

  it('re-dispatches a failed build whose reasons the system can fix', async () => {
    let current = {
      ...failedBuild(),
      status: DB.ElementGenerationBuildStatus
        .FAILED as DB.ElementGenerationBuildStatus,
      errorRetryable: true,
      retryCount: 0,
      syncLeaseOwner: null as string | null,
      syncLeaseUntil: null as Date | null,
      providerEventId: null as string | null,
    }
    vi.mocked(reserveElementGenerationRetrySpend).mockImplementationOnce(
      async (_prisma, input) => {
        current = {
          ...current,
          status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
          stage: 'retry_dispatching',
          providerDispatchAttemptId: input.dispatchAttemptId,
        }
        return true
      }
    )
    const updateMany = vi.fn(async ({ where, data }) => {
      if (data.syncLeaseOwner && data.syncLeaseUntil) {
        if (current.syncLeaseOwner !== null) return { count: 0 }
        current = {
          ...current,
          syncLeaseOwner: data.syncLeaseOwner,
          syncLeaseUntil: data.syncLeaseUntil,
        }
        return { count: 1 }
      }
      if (data.status === DB.ElementGenerationBuildStatus.DESIGNING) {
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
        }
        return { count: 1 }
      }
      if (data.syncLeaseOwner === null && where.syncLeaseOwner) {
        if (current.syncLeaseOwner !== where.syncLeaseOwner) return { count: 0 }
        current = { ...current, syncLeaseOwner: null, syncLeaseUntil: null }
        return { count: 1 }
      }
      return { count: 0 }
    })
    const start = vi.fn(
      async (
        _payload: unknown,
        _scope: string,
        _dispatchAttemptId: string,
        beforeProviderDispatch: () => Promise<void>
      ) => {
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
      start,
      review: vi.fn(),
      getRun: vi.fn(),
      getRunById: vi.fn(),
      findRunByBuildId: vi.fn(async () => null),
      findRunByQuestionReview: vi.fn(),
    } satisfies QuestionGenerationRuntime
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

    await expect(
      retryQuestionGeneration(fixtures.buildId, ctx as never)
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.DESIGNING,
    })

    expect(reserveElementGenerationRetrySpend).toHaveBeenCalledWith(
      ctx.prisma,
      expect.objectContaining({
        buildId: fixtures.buildId,
        ownerId: fixtures.ownerId,
        spendClass: DB.KBGraphQuotaSpendClass.QUESTION_GENERATION,
        elementTypes: [
          DB.ElementType.SC,
          DB.ElementType.MC,
          DB.ElementType.KPRIM,
        ],
        expectedStatus: DB.ElementGenerationBuildStatus.FAILED,
      })
    )
    expect(start).toHaveBeenCalledOnce()
    expect(current.retryCount).toBe(1)
    expect(current.providerEventId).toBe('retry-event')
  })

  it('leaves a failure the lecturer has to fix in place', async () => {
    const ctx = {
      user: { sub: fixtures.ownerId },
      elementGenerationRuntime: { questionInputContainer: 'question-inputs' },
      prisma: {
        elementGenerationBuild: {
          findFirst: vi.fn(async () => ({
            ...failedBuild(),
            errorRetryable: false,
          })),
        },
      },
    }

    await expect(
      retryQuestionGeneration(fixtures.buildId, ctx as never)
    ).rejects.toMatchObject({ code: 'INVALID_STAGE' })
    expect(reserveElementGenerationRetrySpend).not.toHaveBeenCalled()
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { id: fixtures.buildId, syncLeaseOwner: expect.any(String) },
      data: { syncLeaseOwner: null, syncLeaseUntil: null },
    })
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

  it('serves the structured slot reasons of a build that fails during the poll', async () => {
    const build = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      providerEventId: 'question-event',
      providerWorkflowRunId: 'question-run',
      lastSynchronizedAt: new Date('2026-08-26T12:05:00.000Z'),
    }
    const resultArtifact = {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/result.json`,
      sha256: 'e'.repeat(64),
    }
    const failedResult = failedResultArtifact({
      slot_failures: [
        {
          slot_id: 'q01',
          module_id: 'M1',
          objective: 'Explain malolactic fermentation.',
          objective_source: 'provided',
          requested_level: 'apply',
          evidence_target: 'wine-chemistry.pdf#page=3',
          reason_code: 'NO_SUPPORTING_DOCUMENTS',
          failure_class: 'user_input',
          detail: null,
          suggestions: ['Malolactic fermentation'],
        },
      ],
    })
    const failed = {
      ...build,
      resultManifestArtifact: resultArtifact,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const downloadVerified = vi.fn(async () => failedResult)
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(async () => ({
        ref: resultArtifact,
        bytes: failedResult,
      })),
      downloadVerified,
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
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
      slotFailures: [
        {
          slotId: 'q01',
          moduleId: 'M1',
          objective: 'Explain malolactic fermentation.',
          objectiveSource: 'provided',
          requestedLevel: 'apply',
          evidenceTarget: 'wine-chemistry.pdf#page=3',
          reasonCode: 'NO_SUPPORTING_DOCUMENTS',
          failureClass: 'user_input',
          detail: null,
          suggestions: ['Malolactic fermentation'],
        },
      ],
    })
    expect(downloadVerified).toHaveBeenCalledWith(resultArtifact)
  })

  it('serves the structured slot reasons when the provider reports a failed run', async () => {
    // A run the provider itself reports as failed never reaches the
    // FINALIZING synchronizer branch, so its failed result manifest would be
    // invisible unless the run-level branch reads it. This is the live
    // strict-mode symptom: the worker aborts the workflow and writes reasons
    // only into result.json.
    const build = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      providerEventId: 'question-event',
      providerWorkflowRunId: 'question-run',
      lastSynchronizedAt: new Date('2026-08-26T12:05:00.000Z'),
    }
    const resultArtifact = {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/result.json`,
      sha256: 'e'.repeat(64),
    }
    const failedResult = failedResultArtifact({
      slot_failures: [groundingSlotFailure()],
    })
    // The reread build carries the manifest the run-level branch persisted but
    // no summary copy, so the served reasons provably come from the artifact
    // the branch pinned rather than from a persisted shape.
    const failed = {
      ...build,
      resultManifestArtifact: resultArtifact,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
    }
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const downloadImmutable = vi.fn(async () => ({
      ref: resultArtifact,
      bytes: failedResult,
    }))
    const runtime = {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable,
      downloadVerified: vi.fn(async () => failedResult),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(async () => ({
        runId: 'question-run',
        status: 'FAILED' as const,
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
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
      slotFailures: [
        {
          slotId: 'q02',
          reasonCode: 'NO_SUPPORTING_DOCUMENTS',
          failureClass: 'user_input',
        },
      ],
    })
    expect(downloadImmutable).toHaveBeenCalledWith(
      'question-results',
      `question-builds/${fixtures.buildId}/result.json`
    )
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorCode: 'WORKFLOW_FAILED',
          errorRetryable: false,
          resultManifestArtifact: resultArtifact,
        }),
      })
    )
  })

  it('keeps the generic workflow message when a failed run wrote no result manifest', async () => {
    const build = {
      ...preparingBuild(),
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      providerEventId: 'question-event',
      providerWorkflowRunId: 'question-run',
      lastSynchronizedAt: new Date('2026-08-26T12:05:00.000Z'),
    }
    const failed = {
      ...build,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
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
          'result.json is not published'
        )
      }),
      downloadVerified: vi.fn(),
      downloadVerifiedStream: vi.fn(),
      start: vi.fn(),
      review: vi.fn(),
      getRun: vi.fn(async () => ({
        runId: 'question-run',
        status: 'FAILED' as const,
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
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorCode: 'WORKFLOW_FAILED',
          errorMessage: 'Question-generation workflow did not complete',
        }),
      })
    )
    // No persistence call may pin a result manifest when none could be read,
    // so the build keeps the legacy failure surface rather than a dangling
    // artifact reference.
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain(
      'resultManifestArtifact'
    )
  })

  it('serves an empty reason list for a legacy failed artifact', async () => {
    const build = failedBuild()
    const runtime = failedBuildRuntime(
      vi.fn(async () => failedResultArtifact())
    )
    const ctx = failedBuildContext(build, runtime)

    await expect(
      getQuestionGenerationBuild(fixtures.buildId, ctx as never)
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
      slotFailures: [],
    })
  })

  it('keeps the persisted failure surface when the result manifest is unreadable', async () => {
    const build = failedBuild()
    const runtime = failedBuildRuntime(
      vi.fn(async () => Buffer.from('{"status":"failed"}'))
    )
    const ctx = failedBuildContext(build, runtime)

    const resolved = await getQuestionGenerationBuild(
      fixtures.buildId,
      ctx as never
    )
    expect(resolved).toEqual(build)
    // The legacy fallback stays distinct from a run that reported no failed
    // slots: the persisted row carries no reason list at all.
    expect(Object.hasOwn(resolved, 'slotFailures')).toBe(false)
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { id: fixtures.buildId, syncLeaseOwner: expect.any(String) },
      data: { syncLeaseOwner: null, syncLeaseUntil: null },
    })
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      persistedReviewId,
      review.createdAt
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      review.id,
      review.createdAt
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      'publish-incomplete',
      publishing.createdAt
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
      log: createLogger({ service: 'graphql-test', level: 'silent' }),
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
      'publish-incomplete',
      publishing.createdAt
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

describe('flashcard preparation polling failure policy', () => {
  it.each([
    true,
    false,
  ])('preserves polling failure policy when retryable=%s', async (retryable) => {
    const failure = questionGenerationServiceError(
      'ARTIFACT_INVALID',
      'Synthetic polling upload failure',
      retryable
    )
    let build = {
      ...preparingBuild(),
      elementType: DB.ElementType.FLASHCARD,
      configuration: { language: 'de', flashcardCount: 1, objectives: [] },
    }
    const release = vi
      .mocked(releaseUnclaimedElementGenerationSpend)
      .mockClear()
    const log = createLogger({ service: 'graphql-test', level: 'silent' })
    const errorLog = vi.spyOn(log, 'error')
    const updateMany = vi.fn(async ({ data }) => {
      build = { ...build, ...data }
      return { count: 1 }
    })
    try {
      const result = await getFlashcardGenerationBuild(fixtures.buildId, {
        log,
        user: { sub: fixtures.ownerId },
        prisma: {
          elementGenerationBuild: {
            findFirst: vi.fn(async () => build),
            updateMany,
          },
        },
        elementGenerationRuntime: {
          questionInputContainer: 'synthetic',
          uploadCreateOnly: vi.fn(async () => {
            throw failure
          }),
          startFlashcards: vi.fn(),
          publishIncompleteFlashcards: vi.fn(),
          findRunByFlashcardBuildId: vi.fn(),
        },
      } as never)
      expect(result.status).toBe(
        retryable
          ? DB.ElementGenerationBuildStatus.PREPARING_INPUT
          : DB.ElementGenerationBuildStatus.FAILED
      )
      if (!retryable) {
        expect(result.errorCode).toBe(failure.code)
        expect(result.errorRetryable).toBe(false)
      }
      expect(result.syncLeaseOwner).toBeNull()
      expect(release).not.toHaveBeenCalled()
      expect(errorLog).toHaveBeenCalledTimes(retryable ? 0 : 1)
    } finally {
      errorLog.mockRestore()
    }
  })
})

describe('partial question-generation delivery lifecycle', () => {
  beforeEach(() => {
    vi.mocked(completeElementGeneration).mockClear()
  })

  function partialBuild() {
    return {
      ...preparingBuild(),
      requestedElementCount: 2,
      status: DB.ElementGenerationBuildStatus.FINALIZING,
      providerEventId: 'question-event',
      providerWorkflowRunId: 'question-run',
      lastSynchronizedAt: new Date('2026-08-26T12:05:00.000Z'),
      planSummary: twoSlotPlanSummary(),
      // These builds pin no graph evidence, so the delivered bank needs no
      // provenance index; the graph-evidence path has its own artifact suite.
      sourceGraphBuild: {
        ...preparingBuild().sourceGraphBuild,
        graphManifestArtifact: null,
        graphSha256: null,
      },
      configuration: {
        ...fixtures.configuration,
        questionCount: 2,
        difficultyCounts: { d1: 2, d2: 0, d3: 0, d4: 0, d5: 0 },
      },
    }
  }

  function partialRuntime(
    resultBytes: Buffer,
    bankBytes: Buffer,
    downloadVerified = vi.fn(async (ref: { blobName: string }) =>
      ref.blobName.endsWith('final.json') ? bankBytes : resultBytes
    )
  ) {
    return {
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
      uploadCreateOnly: vi.fn(),
      downloadImmutable: vi.fn(async () => ({
        ref: {
          containerName: FINAL_BANK_REF.container_name,
          blobName: FINAL_BANK_REF.blob_name,
          sha256: FINAL_BANK_REF.sha256,
        },
        bytes: resultBytes,
      })),
      downloadVerified,
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
  }

  function partialContext(
    current: Record<string, unknown>,
    runtime: ReturnType<typeof partialRuntime>,
    settled: Record<string, unknown>
  ) {
    const updateMany = vi.fn(async () => ({ count: 1 }))
    // The first read is the row the poll observed, the second the row the
    // synchronization transitioned; a terminal row is read only once.
    const findFirst = vi.fn(async () => settled)
    if (current !== settled) {
      findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(settled)
    }
    return {
      updateMany,
      ctx: {
        user: { sub: fixtures.ownerId },
        elementGenerationRuntime: runtime,
        prisma: {
          elementGenerationBuild: {
            findFirst,
            updateMany,
          },
        },
      } as never,
    }
  }

  it('delivers the passing subset through the incomplete-review state', async () => {
    const build = partialBuild()
    const settled = {
      ...build,
      status: DB.ElementGenerationBuildStatus.INCOMPLETE,
      stage: 'incomplete',
      resultManifestArtifact: FINAL_BANK_REF,
    }
    const runtime = partialRuntime(
      partialResultArtifact(),
      finalBankArtifact(['q01'])
    )
    const { ctx } = partialContext(build, runtime, settled)

    await getQuestionGenerationBuild(fixtures.buildId, ctx)

    expect(completeElementGeneration).toHaveBeenCalledOnce()
    expect(
      vi.mocked(completeElementGeneration).mock.calls[0]?.[0]
    ).toMatchObject({
      kind: 'questions',
      buildId: fixtures.buildId,
      resultStatus: 'incomplete',
      unresolvedElementCount: 1,
      slotFailures: [
        expect.objectContaining({
          slotId: 'q02',
          reasonCode: 'NO_SUPPORTING_DOCUMENTS',
          failureClass: 'user_input',
        }),
      ],
    })
    const delivered = (
      vi.mocked(completeElementGeneration).mock.calls[0]?.[0] as {
        questions: Array<{ sourceQuestionId: string }>
      }
    ).questions
    expect(delivered.map((question) => question.sourceQuestionId)).toEqual([
      'q01',
    ])
  })

  it('serves the persisted attention cards of a partial build without a download', async () => {
    const settled = {
      ...partialBuild(),
      status: DB.ElementGenerationBuildStatus.INCOMPLETE,
      stage: 'incomplete',
      planSummary: {
        ...twoSlotPlanSummary(),
        slotFailures: [
          {
            slotId: 'q02',
            moduleId: 'M1',
            objective: 'Explain malolactic fermentation.',
            objectiveSource: 'provided',
            requestedLevel: 'remember',
            evidenceTarget: 'wine-chemistry.pdf#page=3',
            reasonCode: 'NO_SUPPORTING_DOCUMENTS',
            failureClass: 'user_input',
            detail: null,
            suggestions: ['Malolactic fermentation'],
          },
        ],
      },
    }
    const runtime = partialRuntime(
      partialResultArtifact(),
      finalBankArtifact(['q01'])
    )
    const { ctx } = partialContext(settled, runtime, settled)

    const resolved = await getQuestionGenerationBuild(fixtures.buildId, ctx)

    expect(resolved).toMatchObject({
      status: DB.ElementGenerationBuildStatus.INCOMPLETE,
      slotFailures: [expect.objectContaining({ slotId: 'q02' })],
    })
    expect(runtime.downloadVerified).not.toHaveBeenCalled()
  })

  it('ends a partial result with zero passing questions in the failure surface', async () => {
    const build = partialBuild()
    const resultArtifact = {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/result.json`,
      sha256: 'e'.repeat(64),
    }
    const settled = {
      ...build,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
      resultManifestArtifact: resultArtifact,
    }
    const resultBytes = failedResultArtifact({
      requested_questions: 2,
      slot_failures: [groundingSlotFailure()],
    })
    const runtime = partialRuntime(resultBytes, finalBankArtifact(['q01']))
    runtime.downloadImmutable = vi.fn(async () => ({
      ref: resultArtifact,
      bytes: resultBytes,
    }))
    const { ctx, updateMany } = partialContext(build, runtime, settled)

    const resolved = await getQuestionGenerationBuild(fixtures.buildId, ctx)

    expect(resolved).toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
      slotFailures: [expect.objectContaining({ slotId: 'q02' })],
    })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorRetryable: false,
          planSummary: expect.objectContaining({
            slotFailures: [expect.objectContaining({ slotId: 'q02' })],
          }),
        }),
      })
    )
    expect(completeElementGeneration).not.toHaveBeenCalled()
  })

  it('offers a retry when a failed result only reports reasons the system can fix', async () => {
    const build = partialBuild()
    const resultArtifact = {
      containerName: 'question-results',
      blobName: `question-builds/${fixtures.buildId}/result.json`,
      sha256: 'e'.repeat(64),
    }
    const settled = {
      ...build,
      status: DB.ElementGenerationBuildStatus.FAILED,
      stage: 'failed',
      errorCode: 'WORKFLOW_FAILED',
      resultManifestArtifact: resultArtifact,
    }
    const resultBytes = failedResultArtifact({
      requested_questions: 2,
      slot_failures: [
        groundingSlotFailure({
          reason_code: 'NO_DISTINCT_EVIDENCE',
          failure_class: 'self_repairable',
        }),
      ],
    })
    const runtime = partialRuntime(resultBytes, finalBankArtifact(['q01']))
    runtime.downloadImmutable = vi.fn(async () => ({
      ref: resultArtifact,
      bytes: resultBytes,
    }))
    const { ctx, updateMany } = partialContext(build, runtime, settled)

    await expect(
      getQuestionGenerationBuild(fixtures.buildId, ctx)
    ).resolves.toMatchObject({
      status: DB.ElementGenerationBuildStatus.FAILED,
      slotFailures: [expect.objectContaining({ slotId: 'q02' })],
    })

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.ElementGenerationBuildStatus.FAILED,
          errorRetryable: true,
        }),
      })
    )
  })

  it('keeps a strict completed build on the exact-count path', async () => {
    const build = {
      ...partialBuild(),
      requestedElementCount: 1,
      configuration: fixtures.configuration,
      planSummary: {
        ...twoSlotPlanSummary(),
        questionCount: 1,
        questions: [
          {
            sourceQuestionId: 'q01',
            moduleId: 'M1',
            objectiveId: null,
            stem: 'Plan stem q01',
            bloomLevel: 'remember',
            targetDifficulty: 1,
            sources: [],
          },
        ],
      },
    }
    const settled = {
      ...build,
      status: DB.ElementGenerationBuildStatus.COMPLETED,
      stage: 'completed',
    }
    const runtime = partialRuntime(
      Buffer.from(
        JSON.stringify({
          schema_version: 1,
          question_build_id: fixtures.buildId,
          status: 'completed',
          generation_policy: 'new_only',
          requested_questions: 1,
          generated_questions: 1,
          final_questions: FINAL_BANK_REF,
          review_required_questions: 0,
          review_required_question_ids: [],
          rejected_at: null,
          reviewed_by: null,
        })
      ),
      finalBankArtifact(['q01'])
    )
    const { ctx } = partialContext(build, runtime, settled)

    await getQuestionGenerationBuild(fixtures.buildId, ctx)

    expect(
      vi.mocked(completeElementGeneration).mock.calls[0]?.[0]
    ).toMatchObject({
      resultStatus: 'completed',
      unresolvedElementCount: 0,
      slotFailures: [],
    })
  })
})
