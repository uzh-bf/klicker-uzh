import { createHash, randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementManipulationInput,
  FlashcardGenerationConfiguration,
  GeneratedFlashcardEditable,
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
  generatedFlashcardElementInput,
  manipulateElement,
} from './elements.js'
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
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'
import type {
  FlashcardGenerationRuntime,
  FlashcardWorkflowIncompletePublicationEvent,
  FlashcardWorkflowStartPayload,
  QuestionGenerationRuntime,
} from './questionGenerationRuntime.js'

const SYNC_LEASE_MILLISECONDS = 15_000
const NON_SYNCHRONIZING_STATUSES = new Set<DB.ElementGenerationBuildStatus>([
  DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
  DB.ElementGenerationBuildStatus.FAILED,
])
const REVIEWABLE_STATUSES = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
]

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

function isFlashcardRuntime(
  runtime: QuestionGenerationRuntime
): runtime is FlashcardGenerationRuntime {
  return (
    'startFlashcards' in runtime &&
    'publishIncompleteFlashcards' in runtime &&
    'findRunByFlashcardBuildId' in runtime
  )
}

function requireRuntime(ctx: ContextWithUser): FlashcardGenerationRuntime {
  const runtime = ctx.elementGenerationRuntime
  if (!runtime || !isFlashcardRuntime(runtime)) {
    return serviceError(
      'QUESTION_GENERATION_UNAVAILABLE',
      'Flashcard generation is not configured'
    )
  }
  return runtime as FlashcardGenerationRuntime
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
    'configurationHash' | 'sourceGraphBuildId' | 'elementType'
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
  await ctx.prisma.elementGenerationBuild.updateMany({
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
  let eventId: string | null = null
  let recoveredRunId: string | null = null
  const alreadyDispatched = await runtime.findRunByFlashcardBuildId(
    build.id,
    build.providerDispatchAttemptId,
    'start'
  )
  if (alreadyDispatched) {
    recoveredRunId = alreadyDispatched.runId
  } else {
    try {
      eventId = (
        await runtime.startFlashcards(
          payload,
          `flashcard-build:${build.id}`,
          build.providerDispatchAttemptId
        )
      ).eventId
    } catch (error) {
      if (
        !(error instanceof QuestionGenerationServiceError) ||
        error.code !== 'WORKFLOW_DISPATCH_UNCERTAIN'
      ) {
        throw error
      }
      const recovered = await runtime.findRunByFlashcardBuildId(
        build.id,
        build.providerDispatchAttemptId,
        'start'
      )
      if (!recovered) throw error
      recoveredRunId = recovered.runId
    }
  }

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
    return recordStartFailure(build.id, error, ctx, leaseOwner)
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
  const runtime = requireRuntime(ctx)
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
  try {
    await ctx.prisma.elementGenerationBuild.create({
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
  } catch (error) {
    if (
      error instanceof DB.Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raced = await ctx.prisma.elementGenerationBuild.findUniqueOrThrow({
        where: {
          ownerId_idempotencyKey: {
            ownerId: ctx.user.sub,
            idempotencyKey,
          },
        },
        include: buildInclude,
      })
      assertMatchingIdempotentBuild(raced, {
        configurationHash: normalized.configurationHash,
        graphBuildId: graph.id,
      })
      return raced.status === DB.ElementGenerationBuildStatus.PREPARING_INPUT
        ? resumePreparingBuild(raced, runtime, ctx)
        : raced
    }
    throw error
  }

  return resumePreparingBuild(await findOwnedBuild(buildId, ctx), runtime, ctx)
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
    publication ? 'publish-incomplete' : 'start'
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
    'publish-incomplete'
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
          'publish-incomplete'
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
      (error.code === 'ARTIFACT_NOT_FOUND' || error.retryable)
    ) {
      return
    }
    const normalized =
      error instanceof QuestionGenerationServiceError
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
    !isFlashcardRuntime(runtime) ||
    NON_SYNCHRONIZING_STATUSES.has(build.status)
  ) {
    return build
  }

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
  const runtime = requireRuntime(ctx)
  const build = await findOwnedBuild(buildId, ctx)
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
  const claimed = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
    },
    data: {
      status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
      stage: 'retry_dispatching',
      providerDispatchAttemptId: dispatchAttemptId,
      providerEventId: null,
      providerWorkflowRunId: null,
    },
  })
  if (claimed.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build was changed by another request'
    )
  }
  try {
    const payload = workflowPayload(build, runtime)
    let eventId: string | null = null
    let recoveredRunId: string | null = null
    try {
      eventId = (
        await runtime.startFlashcards(
          payload,
          `flashcard-build:${build.id}`,
          dispatchAttemptId
        )
      ).eventId
    } catch (error) {
      if (
        !(error instanceof QuestionGenerationServiceError) ||
        error.code !== 'WORKFLOW_DISPATCH_UNCERTAIN'
      ) {
        throw error
      }
      const recovered = await runtime.findRunByFlashcardBuildId(
        build.id,
        dispatchAttemptId,
        'start'
      )
      if (!recovered) throw error
      recoveredRunId = recovered.runId
    }
    await ctx.prisma.elementGenerationBuild.update({
      where: { id: build.id },
      data: {
        providerEventId: eventId,
        providerWorkflowRunId: recoveredRunId,
        status: DB.ElementGenerationBuildStatus.QUEUED,
        stage: 'queued',
        retryCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
        errorRetryable: null,
      },
    })
    return findOwnedBuild(build.id, ctx)
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError && error.retryable) {
      throw error
    }
    await ctx.prisma.elementGenerationBuild.updateMany({
      where: {
        id: build.id,
        status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
      },
      data: {
        status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
        stage: 'awaiting_incomplete_publication',
      },
    })
    throw error
  }
}

export async function publishIncompleteFlashcardGeneration(
  input: { buildId: string; acknowledgeIncomplete: boolean },
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  requireRuntime(ctx)
  if (input.acknowledgeIncomplete !== true) {
    return serviceError(
      'CONFIGURATION_INVALID',
      'Incomplete publication must be explicitly acknowledged'
    )
  }
  const build = await findOwnedBuild(input.buildId, ctx)
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
  const publicationDispatchAttemptId = randomUUID()
  const claimed = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
    },
    data: {
      status: DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE,
      stage: 'publishing_incomplete',
      incompletePublishedById: ctx.user.sub,
      incompletePublishedAt: new Date(),
      providerPublicationDispatchAttemptId: publicationDispatchAttemptId,
      providerPublicationEventId: null,
      providerPublicationWorkflowRunId: null,
    },
  })
  if (claimed.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Flashcard build was changed by another request'
    )
  }
  return getFlashcardGenerationBuild(build.id, ctx)
}

export async function saveGeneratedFlashcards(
  buildId: string,
  ctx: ContextWithUser
): Promise<{
  createdElementIds: number[]
  alreadySavedElementIds: number[]
}> {
  await assertQuestionGenerationPreviewAccess(ctx)

  return ctx.prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "ElementGenerationBuild"
      WHERE "id" = ${buildId}::uuid
      FOR UPDATE
    `
    const build = await transaction.elementGenerationBuild.findFirst({
      where: {
        id: buildId,
        ownerId: ctx.user.sub,
        elementType: DB.ElementType.FLASHCARD,
        status: { in: REVIEWABLE_STATUSES },
      },
      select: {
        drafts: {
          where: {
            decision: DB.GeneratedElementDecision.ACCEPTED,
            elementType: DB.ElementType.FLASHCARD,
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })
    if (!build) {
      return serviceError(
        'FLASHCARD_GENERATION_BUILD_NOT_FOUND',
        'Terminal flashcard-generation build not found'
      )
    }

    const alreadySavedElementIds = build.drafts.flatMap((draft) =>
      draft.savedElementId === null ? [] : [draft.savedElementId]
    )
    const createdElementIds: number[] = []
    for (const draft of build.drafts) {
      if (draft.savedElementId !== null) continue
      let elementInput: ElementManipulationInput
      try {
        elementInput = generatedFlashcardElementInput({
          sourceFlashcardId: draft.sourceElementId,
          ...(draft.current as GeneratedFlashcardEditable),
        })
      } catch {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated flashcard draft is not a valid Flashcard element'
        )
      }
      const element = await manipulateElement(elementInput, {
        ...ctx,
        prisma: transaction,
      })
      if (!element) {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated flashcard draft is not a valid Flashcard element'
        )
      }
      const linked = await transaction.generatedElementDraft.updateMany({
        where: {
          id: draft.id,
          elementType: DB.ElementType.FLASHCARD,
          decision: DB.GeneratedElementDecision.ACCEPTED,
          savedElementId: null,
        },
        data: { savedElementId: element.id, savedAt: new Date() },
      })
      if (linked.count !== 1) {
        return serviceError(
          'CONCURRENT_MODIFICATION',
          'Generated flashcard was saved by another request'
        )
      }
      createdElementIds.push(element.id)
    }
    return { createdElementIds, alreadySavedElementIds }
  })
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
