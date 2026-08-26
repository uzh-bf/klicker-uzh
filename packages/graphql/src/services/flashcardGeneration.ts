import { createHash, randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  FlashcardGenerationConfiguration,
  QuestionGenerationArtifactRef,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import {
  canonicalElementGenerationJson,
  elementGenerationArtifactPayload,
  elementGenerationOutputBlobName,
  loadReadyElementGenerationGraph,
  normalizeElementGenerationIdempotencyKey,
} from './elementGenerationProvider.js'
import {
  assertElementGenerationCostAccounted,
  createElementGenerationBuildWithSpend,
  isFlashcardRetrySpend,
  releaseUnclaimedElementGenerationSpend,
  reserveFlashcardRetrySpend,
} from './elementGenerationAccounting.js'
import { dispatchCostAccountedElementGeneration } from './elementGenerationDispatch.js'
import {
  parseFlashcardGenerationResult,
  parseTerminalFlashcardGenerationBank,
} from './flashcardGenerationArtifacts.js'
import { createFlashcardGenerationBlueprint } from './flashcardGenerationBlueprint.js'
import {
  FlashcardGenerationConfigurationError,
  type FlashcardGenerationConfigurationInput,
  normalizeFlashcardGenerationConfiguration,
} from './flashcardGenerationConfiguration.js'
import {
  persistInitialGeneratedFlashcardDrafts,
  setGeneratedFlashcardDecision,
  updateGeneratedFlashcardDraft,
} from './flashcardGenerationDrafts.js'
import { claimIncompleteFlashcardPublication } from './flashcardGenerationPersistence.js'
import {
  isFlashcardGenerationRuntime,
  requireFlashcardGenerationRuntime,
} from './flashcardGenerationRuntime.js'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'
import type {
  FlashcardGenerationRuntime,
  FlashcardWorkflowIncompletePublicationEvent,
  FlashcardWorkflowStartPayload,
} from './questionGenerationRuntime.js'

const SYNC_LEASE_MILLISECONDS = 15_000
const NON_SYNCHRONIZING_STATUSES = new Set<DB.ElementGenerationBuildStatus>([
  DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
  DB.ElementGenerationBuildStatus.FAILED,
])
const buildInclude = {
  drafts: {
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  sourceGraphBuild: {
    select: {
      id: true,
      kbId: true,
      graphManifestArtifact: true,
      graphSha256: true,
      graphManifestSchemaVersion: true,
      graphBundleStorageName: true,
      sources: {
        select: {
          resourceId: true,
          title: true,
          contentSha256: true,
          sourceUrl: true,
          blobName: true,
        },
        orderBy: { resourceId: 'asc' as const },
      },
    },
  },
} satisfies DB.Prisma.ElementGenerationBuildInclude

type FlashcardBuild = DB.Prisma.ElementGenerationBuildGetPayload<{
  include: typeof buildInclude
}>

export type StartFlashcardGenerationInput =
  FlashcardGenerationConfigurationInput & {
    graphBuildId: string
    idempotencyKey: string
  }

function serviceError(
  code: Parameters<typeof questionGenerationServiceError>[0],
  message: string,
  retryable = false
): never {
  throw questionGenerationServiceError(code, message, retryable)
}

function startManifestSha256(payload: FlashcardWorkflowStartPayload): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalElementGenerationJson(payload)))
    .digest('hex')
}

async function findOwnedBuild(buildId: string, ctx: ContextWithUser) {
  const build = await ctx.prisma.elementGenerationBuild.findFirst({
    where: {
      id: buildId,
      ownerId: ctx.user.sub,
      elementType: DB.ElementType.FLASHCARD,
    },
    include: buildInclude,
  })
  if (!build) {
    return serviceError(
      'FLASHCARD_GENERATION_BUILD_NOT_FOUND',
      'Flashcard-generation build not found'
    )
  }
  return build
}

function assertMatchingIdempotentBuild(
  build: Pick<
    DB.ElementGenerationBuild,
    | 'configurationHash'
    | 'sourceGraphBuildId'
    | 'elementType'
    | 'costAccountingVersion'
  >,
  expected: { configurationHash: string; graphBuildId: string }
) {
  if (
    build.configurationHash !== expected.configurationHash ||
    build.sourceGraphBuildId !== expected.graphBuildId ||
    build.elementType !== DB.ElementType.FLASHCARD
  ) {
    return serviceError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key is already used for a different flashcard build'
    )
  }
  assertElementGenerationCostAccounted(build)
}

function workflowPayload(
  build: Pick<
    FlashcardBuild,
    'id' | 'blueprintArtifact' | 'configuration' | 'sourceGraphBuild'
  >,
  runtime: FlashcardGenerationRuntime
): FlashcardWorkflowStartPayload {
  if (
    !build.blueprintArtifact ||
    !build.sourceGraphBuild.graphManifestArtifact ||
    !build.sourceGraphBuild.graphBundleStorageName
  ) {
    return serviceError(
      'ARTIFACT_INVALID',
      'Flashcard build is missing pinned input artifacts'
    )
  }
  return {
    schema_version: 1,
    flashcard_build_id: build.id,
    graph_version_id: build.sourceGraphBuild.id,
    graph_manifest: elementGenerationArtifactPayload(
      build.sourceGraphBuild.graphManifestArtifact
    ),
    storage_name: build.sourceGraphBuild.graphBundleStorageName,
    blueprint: elementGenerationArtifactPayload(build.blueprintArtifact),
    output: {
      container_name: runtime.questionOutputContainer,
      blob_prefix: runtime.questionOutputPrefix,
    },
    language: build.configuration.language,
  }
}

async function recordStartFailure(
  buildId: string,
  dispatchAttemptId: string,
  error: unknown,
  ctx: ContextWithUser,
  leaseOwner?: string
): Promise<never> {
  const normalized =
    error instanceof QuestionGenerationServiceError
      ? error
      : questionGenerationServiceError(
          'QUESTION_GENERATION_UNAVAILABLE',
          'Flashcard generation could not be started',
          true
        )
  const retrySpend = await isFlashcardRetrySpend(ctx.prisma, dispatchAttemptId)
  await ctx.prisma.$transaction(async (transaction) => {
    const updated = await transaction.elementGenerationBuild.updateMany({
      where: {
        id: buildId,
        ownerId: ctx.user.sub,
        ...(leaseOwner ? { syncLeaseOwner: leaseOwner } : {}),
      },
      data: normalized.retryable
        ? {
            status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
            stage: 'preparing_input',
            errorCode: normalized.code,
            errorMessage: normalized.message,
            errorRetryable: true,
            syncLeaseOwner: null,
            syncLeaseUntil: null,
          }
        : retrySpend
          ? {
              status:
                DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
              stage: 'awaiting_incomplete_publication',
              syncLeaseOwner: null,
              syncLeaseUntil: null,
            }
          : {
              status: DB.ElementGenerationBuildStatus.FAILED,
              stage: 'failed',
              errorCode: normalized.code,
              errorMessage: normalized.message,
              errorRetryable: false,
              completedAt: new Date(),
              syncLeaseOwner: null,
              syncLeaseUntil: null,
            },
    })
    if (!normalized.retryable && updated.count === 1) {
      await releaseUnclaimedElementGenerationSpend(
        transaction,
        dispatchAttemptId
      )
    }
  })
  throw normalized
}

async function dispatchPreparingBuild(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  const blueprintBytes = createFlashcardGenerationBlueprint(
    build.configuration as FlashcardGenerationConfiguration
  )
  const blueprintArtifact: QuestionGenerationArtifactRef = {
    containerName: runtime.questionInputContainer,
    blobName: `flashcard-builds/${build.id}/blueprints/blueprint.json`,
    sha256: createHash('sha256').update(blueprintBytes).digest('hex'),
  }
  try {
    await runtime.uploadCreateOnly(blueprintArtifact, blueprintBytes)
  } catch (error) {
    if (
      !(error instanceof QuestionGenerationServiceError) ||
      error.code !== 'ARTIFACT_UPLOAD_CONFLICT'
    ) {
      throw error
    }
    await runtime.downloadVerified(blueprintArtifact)
  }

  const payload = workflowPayload({ ...build, blueprintArtifact }, runtime)
  const startManifestArtifact: QuestionGenerationArtifactRef = {
    containerName: runtime.questionOutputContainer,
    blobName: elementGenerationOutputBlobName(
      runtime,
      build.id,
      'manifest/start.json'
    ),
    sha256: startManifestSha256(payload),
  }
  const { eventId, recoveredRunId } =
    await dispatchCostAccountedElementGeneration({
      prisma: ctx.prisma,
      dispatchAttemptId: build.providerDispatchAttemptId,
      recover: () =>
        runtime.findRunByFlashcardBuildId(
          build.id,
          build.providerDispatchAttemptId,
          'start',
          build.createdAt
        ),
      dispatch: (beforeProviderDispatch) =>
        runtime.startFlashcards(
          payload,
          `flashcard-build:${build.id}`,
          build.providerDispatchAttemptId,
          beforeProviderDispatch
        ),
    })
  const recoveredRetry = await isFlashcardRetrySpend(
    ctx.prisma,
    build.providerDispatchAttemptId
  )

  const updated = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
      syncLeaseOwner: leaseOwner,
    },
    data: {
      blueprintArtifact,
      startManifestArtifact,
      providerEventId: eventId,
      providerWorkflowRunId: recoveredRunId,
      status: DB.ElementGenerationBuildStatus.QUEUED,
      stage: 'queued',
      startedAt: new Date(),
      ...(recoveredRetry ? { retryCount: { increment: 1 } } : {}),
    },
  })
  if (updated.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build preparation was changed by another request'
    )
  }
}

async function resumePreparingBuild(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime,
  ctx: ContextWithUser
) {
  const leaseOwner = randomUUID()
  const now = new Date()
  const acquired = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }],
    },
    data: {
      syncLeaseOwner: leaseOwner,
      syncLeaseUntil: new Date(now.getTime() + SYNC_LEASE_MILLISECONDS),
    },
  })
  if (acquired.count !== 1) return findOwnedBuild(build.id, ctx)

  try {
    await dispatchPreparingBuild(build, runtime, leaseOwner, ctx)
  } catch (error) {
    return recordStartFailure(
      build.id,
      build.providerDispatchAttemptId,
      error,
      ctx,
      leaseOwner
    )
  } finally {
    await ctx.prisma.elementGenerationBuild.updateMany({
      where: { id: build.id, syncLeaseOwner: leaseOwner },
      data: { syncLeaseOwner: null, syncLeaseUntil: null },
    })
  }
  return findOwnedBuild(build.id, ctx)
}

export async function startFlashcardGeneration(
  input: StartFlashcardGenerationInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const runtime = requireFlashcardGenerationRuntime(ctx)
  const idempotencyKey = normalizeElementGenerationIdempotencyKey(
    input.idempotencyKey
  )
  const graph = await loadReadyElementGenerationGraph(input.graphBuildId, ctx)

  let normalized: ReturnType<typeof normalizeFlashcardGenerationConfiguration>
  try {
    normalized = normalizeFlashcardGenerationConfiguration(input, {
      language: null,
    })
  } catch (error) {
    if (error instanceof FlashcardGenerationConfigurationError) {
      return serviceError('CONFIGURATION_INVALID', error.message)
    }
    throw error
  }

  const existing = await ctx.prisma.elementGenerationBuild.findUnique({
    where: {
      ownerId_idempotencyKey: { ownerId: ctx.user.sub, idempotencyKey },
    },
    include: buildInclude,
  })
  if (existing) {
    assertMatchingIdempotentBuild(existing, {
      configurationHash: normalized.configurationHash,
      graphBuildId: graph.id,
    })
    return existing.status === DB.ElementGenerationBuildStatus.PREPARING_INPUT
      ? resumePreparingBuild(existing, runtime, ctx)
      : existing
  }

  const buildId = randomUUID()
  const creation = await createElementGenerationBuildWithSpend(ctx.prisma, {
    ownerId: ctx.user.sub,
    idempotencyKey,
    spendClass: DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
    data: {
      id: buildId,
      ownerId: ctx.user.sub,
      sourceGraphBuildId: graph.id,
      elementType: DB.ElementType.FLASHCARD,
      idempotencyKey,
      configurationHash: normalized.configurationHash,
      configuration: normalized.configuration,
      requestedElementCount: normalized.configuration.flashcardCount,
      inputArtifactContainer: runtime.questionInputContainer,
      inputArtifactPrefix: `flashcard-builds/${buildId}`,
      outputArtifactContainer: runtime.questionOutputContainer,
      outputArtifactPrefix: `${runtime.questionOutputPrefix}/${buildId}`,
    },
  })
  if (!creation.created) {
    const raced = await findOwnedBuild(creation.buildId, ctx)
    assertMatchingIdempotentBuild(raced, {
      configurationHash: normalized.configurationHash,
      graphBuildId: graph.id,
    })
    return raced.status === DB.ElementGenerationBuildStatus.PREPARING_INPUT
      ? resumePreparingBuild(raced, runtime, ctx)
      : raced
  }

  return resumePreparingBuild(
    await findOwnedBuild(creation.buildId, ctx),
    runtime,
    ctx
  )
}

async function recoverOrLoadRun(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime
) {
  const publication =
    build.status === DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
  const runId = publication
    ? build.providerPublicationWorkflowRunId
    : build.providerWorkflowRunId
  const eventId = publication
    ? build.providerPublicationEventId
    : build.providerEventId
  if (runId) return runtime.getRunById(runId)
  if (eventId) return runtime.getRun(eventId)
  const dispatchAttemptId = publication
    ? build.providerPublicationDispatchAttemptId
    : build.providerDispatchAttemptId
  if (!dispatchAttemptId) return null
  return runtime.findRunByFlashcardBuildId(
    build.id,
    dispatchAttemptId,
    publication ? 'publish-incomplete' : 'start',
    publication
      ? (build.incompletePublishedAt ?? build.createdAt)
      : build.createdAt
  )
}

function incompletePublicationEvent(
  build: FlashcardBuild
): FlashcardWorkflowIncompletePublicationEvent {
  if (
    !build.startManifestArtifact ||
    !build.incompletePublishedById ||
    !build.providerPublicationDispatchAttemptId
  ) {
    return serviceError(
      'ARTIFACT_INVALID',
      'Incomplete flashcard publication is missing durable dispatch metadata'
    )
  }
  return {
    schema_version: 1,
    flashcard_build_id: build.id,
    start_manifest: elementGenerationArtifactPayload(
      build.startManifestArtifact
    ),
    reviewed_by: build.incompletePublishedById,
    acknowledge_incomplete: true,
  }
}

async function dispatchIncompletePublication(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  const dispatchAttemptId = build.providerPublicationDispatchAttemptId
  if (!dispatchAttemptId) {
    return serviceError(
      'ARTIFACT_INVALID',
      'Incomplete flashcard publication has no dispatch attempt'
    )
  }
  const event = incompletePublicationEvent(build)
  let eventId: string | null = null
  let recoveredRunId: string | null = null
  const alreadyDispatched = await runtime.findRunByFlashcardBuildId(
    build.id,
    dispatchAttemptId,
    'publish-incomplete',
    build.incompletePublishedAt ?? build.createdAt
  )
  if (alreadyDispatched) {
    recoveredRunId = alreadyDispatched.runId
  } else {
    try {
      eventId = (
        await runtime.publishIncompleteFlashcards(
          event,
          `flashcard-build:${build.id}`,
          dispatchAttemptId
        )
      ).eventId
    } catch (error) {
      if (
        error instanceof QuestionGenerationServiceError &&
        error.code === 'WORKFLOW_DISPATCH_UNCERTAIN'
      ) {
        const recovered = await runtime.findRunByFlashcardBuildId(
          build.id,
          dispatchAttemptId,
          'publish-incomplete',
          build.incompletePublishedAt ?? build.createdAt
        )
        if (!recovered) throw error
        recoveredRunId = recovered.runId
      } else {
        await ctx.prisma.elementGenerationBuild.updateMany({
          where: {
            id: build.id,
            ownerId: ctx.user.sub,
            status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
            syncLeaseOwner: leaseOwner,
            providerPublicationDispatchAttemptId: dispatchAttemptId,
            providerPublicationEventId: null,
            providerPublicationWorkflowRunId: null,
          },
          data: {
            status:
              DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
            stage: 'awaiting_incomplete_publication',
            incompletePublishedById: null,
            incompletePublishedAt: null,
            providerPublicationDispatchAttemptId: null,
          },
        })
        return
      }
    }
  }

  const updated = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      syncLeaseOwner: leaseOwner,
      providerPublicationDispatchAttemptId: dispatchAttemptId,
    },
    data: {
      providerPublicationEventId: eventId,
      providerPublicationWorkflowRunId: recoveredRunId,
      lastSynchronizedAt: new Date(),
    },
  })
  if (updated.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Incomplete flashcard publication was changed by another request'
    )
  }
}

async function markResumableOrFailed(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  let checkpoint: QuestionGenerationArtifactRef | null = null
  try {
    checkpoint = (
      await runtime.downloadImmutable(
        runtime.questionOutputContainer,
        elementGenerationOutputBlobName(
          runtime,
          build.id,
          'checkpoints/resume.json'
        )
      )
    ).ref
  } catch (error) {
    if (
      !(error instanceof QuestionGenerationServiceError) ||
      error.code !== 'ARTIFACT_NOT_FOUND'
    ) {
      throw error
    }
  }

  await ctx.prisma.elementGenerationBuild.updateMany({
    where: { id: build.id, syncLeaseOwner: leaseOwner },
    data: checkpoint
      ? {
          status:
            DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
          stage: 'awaiting_incomplete_publication',
          checkpointArtifact: checkpoint,
          errorCode: 'FLASHCARD_GENERATION_INCOMPLETE',
          errorMessage:
            'Generation stopped with a resumable checkpoint. Retry or explicitly publish the incomplete bank.',
          errorRetryable: true,
          lastSynchronizedAt: new Date(),
        }
      : {
          status: DB.ElementGenerationBuildStatus.FAILED,
          stage: 'failed',
          errorCode: 'WORKFLOW_FAILED',
          errorMessage:
            'Flashcard generation failed before a resumable checkpoint was available.',
          errorRetryable: false,
          completedAt: new Date(),
          lastSynchronizedAt: new Date(),
        },
  })
}

async function synchronizeLeasedBuild(
  build: FlashcardBuild,
  runtime: FlashcardGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  let workflowSucceeded = false
  try {
    if (build.status === DB.ElementGenerationBuildStatus.PREPARING_INPUT) {
      await dispatchPreparingBuild(build, runtime, leaseOwner, ctx)
      return
    }
    const publication =
      build.status === DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
    const run = await recoverOrLoadRun(build, runtime)
    if (!run) {
      if (publication) {
        await dispatchIncompletePublication(build, runtime, leaseOwner, ctx)
      }
      return
    }
    const runField = publication
      ? 'providerPublicationWorkflowRunId'
      : 'providerWorkflowRunId'

    if (run.status === 'PENDING' || run.status === 'RUNNING') {
      await ctx.prisma.elementGenerationBuild.updateMany({
        where: { id: build.id, syncLeaseOwner: leaseOwner },
        data: {
          [runField]: run.runId,
          status: publication
            ? DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
            : run.status === 'RUNNING'
              ? DB.ElementGenerationBuildStatus.RUNNING
              : DB.ElementGenerationBuildStatus.QUEUED,
          stage: publication
            ? 'publishing_incomplete'
            : run.status === 'RUNNING'
              ? 'running'
              : 'queued',
          lastSynchronizedAt: new Date(),
        },
      })
      return
    }
    if (run.status === 'FAILED' || run.status === 'CANCELLED') {
      await markResumableOrFailed(build, runtime, leaseOwner, ctx)
      return
    }
    workflowSucceeded = true

    const resultArtifact = await runtime.downloadImmutable(
      runtime.questionOutputContainer,
      elementGenerationOutputBlobName(runtime, build.id, 'manifest/result.json')
    )
    if (
      !build.blueprintArtifact ||
      !build.sourceGraphBuild.graphManifestArtifact
    ) {
      return serviceError(
        'ARTIFACT_INVALID',
        'Flashcard build is missing pinned input artifacts'
      )
    }
    const result = parseFlashcardGenerationResult(resultArtifact.bytes, {
      buildId: build.id,
      graphVersionId: build.sourceGraphBuild.id,
      graphManifest: build.sourceGraphBuild.graphManifestArtifact,
      blueprint: build.blueprintArtifact,
      requestedFlashcardCount: build.requestedElementCount,
      outputContainer: runtime.questionOutputContainer,
      outputPrefix: runtime.questionOutputPrefix,
    })
    if (
      result.status === 'incomplete' &&
      result.reviewedBy !== build.incompletePublishedById
    ) {
      return serviceError(
        'ARTIFACT_INVALID',
        'Incomplete flashcard result reviewer does not match the publication authorization'
      )
    }
    const bankBytes = await runtime.downloadVerified(result.flashcardBank)
    const bank = parseTerminalFlashcardGenerationBank(bankBytes, {
      graphVersionId: build.sourceGraphBuild.id,
      graphManifest: build.sourceGraphBuild.graphManifestArtifact,
      blueprint: build.blueprintArtifact,
      requestedFlashcardCount: result.requestedFlashcards,
      acceptedFlashcardCount: result.acceptedFlashcards,
      unresolvedFlashcardCount: result.unresolvedFlashcards,
      publicationStatus:
        result.status === 'incomplete' ? 'incomplete' : 'complete',
      checkpointSnapshot: result.checkpointSnapshot,
    })
    await persistInitialGeneratedFlashcardDrafts(
      {
        buildId: build.id,
        leaseOwner,
        cards: bank.cards,
        resultStatus: result.status,
        unresolvedElementCount: result.unresolvedFlashcards,
        warningCount: result.warningCount,
        resultManifestArtifact: resultArtifact.ref,
        finalBankArtifact: result.flashcardBank,
        checkpointArtifact: result.checkpointSnapshot,
      },
      ctx
    )
  } catch (error) {
    if (
      error instanceof QuestionGenerationServiceError &&
      ((error.code === 'ARTIFACT_NOT_FOUND' && !workflowSucceeded) ||
        (error.code !== 'ARTIFACT_NOT_FOUND' && error.retryable))
    ) {
      return
    }
    const normalized =
      error instanceof QuestionGenerationServiceError &&
      error.code === 'ARTIFACT_NOT_FOUND' &&
      workflowSucceeded
        ? questionGenerationServiceError(
            'ARTIFACT_INVALID',
            'Flashcard-generation workflow succeeded without its required artifact'
          )
        : error instanceof QuestionGenerationServiceError
          ? error
          : questionGenerationServiceError(
              'ARTIFACT_INVALID',
              'Flashcard-generation output could not be validated'
            )
    await ctx.prisma.elementGenerationBuild.updateMany({
      where: { id: build.id, syncLeaseOwner: leaseOwner },
      data: {
        status: DB.ElementGenerationBuildStatus.FAILED,
        stage: 'failed',
        errorCode: normalized.code,
        errorMessage: normalized.message,
        errorRetryable: normalized.retryable,
        completedAt: new Date(),
      },
    })
  }
}

export async function getFlashcardGenerationBuild(
  buildId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const build = await findOwnedBuild(buildId, ctx)
  const runtime = ctx.elementGenerationRuntime
  if (
    !runtime ||
    !isFlashcardGenerationRuntime(runtime) ||
    NON_SYNCHRONIZING_STATUSES.has(build.status)
  ) {
    return build
  }
  assertElementGenerationCostAccounted(build)

  const leaseOwner = randomUUID()
  const now = new Date()
  const acquired = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }],
    },
    data: {
      syncLeaseOwner: leaseOwner,
      syncLeaseUntil: new Date(now.getTime() + SYNC_LEASE_MILLISECONDS),
    },
  })
  if (acquired.count === 1) {
    try {
      await synchronizeLeasedBuild(build, runtime, leaseOwner, ctx)
    } finally {
      await ctx.prisma.elementGenerationBuild.updateMany({
        where: { id: build.id, syncLeaseOwner: leaseOwner },
        data: { syncLeaseOwner: null, syncLeaseUntil: null },
      })
    }
  }
  return findOwnedBuild(buildId, ctx)
}

export async function retryFlashcardGeneration(
  buildId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const runtime = requireFlashcardGenerationRuntime(ctx)
  const build = await findOwnedBuild(buildId, ctx)
  assertElementGenerationCostAccounted(build)
  if (
    build.status !==
    DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION
  ) {
    return serviceError(
      'INVALID_STAGE',
      'Only a resumable flashcard build can be retried'
    )
  }
  const dispatchAttemptId = randomUUID()
  const claimed = await reserveFlashcardRetrySpend(ctx.prisma, {
    buildId: build.id,
    ownerId: ctx.user.sub,
    dispatchAttemptId,
  })
  if (!claimed) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build was changed by another request'
    )
  }
  return resumePreparingBuild(await findOwnedBuild(build.id, ctx), runtime, ctx)
}

export async function publishIncompleteFlashcardGeneration(
  input: { buildId: string; acknowledgeIncomplete: boolean },
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  requireFlashcardGenerationRuntime(ctx)
  if (input.acknowledgeIncomplete !== true) {
    return serviceError(
      'CONFIGURATION_INVALID',
      'Incomplete publication must be explicitly acknowledged'
    )
  }
  const build = await findOwnedBuild(input.buildId, ctx)
  assertElementGenerationCostAccounted(build)
  if (
    build.status !==
      DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION ||
    !build.startManifestArtifact
  ) {
    return serviceError(
      'INVALID_STAGE',
      'Flashcard build is not awaiting incomplete publication'
    )
  }
  await claimIncompleteFlashcardPublication(build.id, ctx)
  return getFlashcardGenerationBuild(build.id, ctx)
}

export async function getFlashcardGenerationCapabilities(ctx: ContextWithUser) {
  await assertQuestionGenerationPreviewAccess(ctx)
  return {
    languages: ['de', 'en'] as const,
    cardTypes: ['definition', 'formula', 'calculation'] as const,
    maximumFlashcardCount: 20,
    supportsRetry: true,
    supportsIncompletePublication: true,
  }
}

export { setGeneratedFlashcardDecision, updateGeneratedFlashcardDraft }
export { saveGeneratedFlashcards } from './flashcardGenerationPersistence.js'
