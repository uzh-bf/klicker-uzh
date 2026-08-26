import { createHash, randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementManipulationInput,
  GeneratedQuestionEditable,
  QuestionGenerationArtifactRef,
  QuestionGenerationConfiguration,
  QuestionGenerationPlanSummary,
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
  releaseUnclaimedElementGenerationSpend,
} from './elementGenerationAccounting.js'
import { dispatchCostAccountedElementGeneration } from './elementGenerationDispatch.js'
import {
  generatedKPRIMElementInput,
  generatedMCElementInput,
  generatedSCElementInput,
  manipulateElement,
} from './elements.js'
import {
  parseQuestionGenerationDesign,
  parseQuestionGenerationFinalBank,
  parseQuestionGenerationGraphManifest,
  parseQuestionGenerationPlan,
  parseQuestionGenerationProvenanceClaims,
  parseQuestionGenerationProvenanceIndex,
  parseQuestionGenerationResult,
  type QuestionGenerationGraphLineage,
  type QuestionGenerationProvenanceAuthority,
  verifyQuestionGenerationProvenanceAuthority,
} from './questionGenerationArtifacts.js'
import { createQuestionGenerationBlueprint } from './questionGenerationBlueprint.js'
import {
  normalizeQuestionGenerationConfiguration,
  QuestionGenerationConfigurationError,
  type QuestionGenerationConfigurationInput,
} from './questionGenerationConfiguration.js'
import { persistInitialGeneratedQuestionDrafts } from './questionGenerationDrafts.js'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'
import {
  assertQuestionGenerationPreviewAccess,
  questionGenerationSourceSnapshot,
} from './questionGenerationGraph.js'
import type {
  QuestionGenerationRuntime,
  QuestionWorkflowReviewEvent,
  QuestionWorkflowStartPayload,
} from './questionGenerationRuntime.js'

const SYNC_LEASE_MILLISECONDS = 15_000
const REVIEW_DISPATCH_RECOVERY_MILLISECONDS = 15_000
const TERMINAL_STATUSES = new Set<DB.ElementGenerationBuildStatus>([
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.REJECTED,
  DB.ElementGenerationBuildStatus.FAILED,
])
const QUESTION_ELEMENT_TYPES: DB.ElementType[] = [
  DB.ElementType.SC,
  DB.ElementType.MC,
  DB.ElementType.KPRIM,
]

const buildInclude = {
  reviews: { orderBy: { reviewedAt: 'asc' as const } },
  drafts: {
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  sourceGraphBuild: {
    select: {
      id: true,
      kbId: true,
      graphBundleSha256: true,
      graphName: true,
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

type QuestionBuild = DB.Prisma.ElementGenerationBuildGetPayload<{
  include: typeof buildInclude
}>

export type StartQuestionGenerationInput =
  QuestionGenerationConfigurationInput & {
    graphBuildId: string
    idempotencyKey: string
  }

export type ReviewQuestionGenerationInput = {
  buildId: string
  decision: 'APPROVE' | 'REJECT'
  warningsAcknowledged: boolean
}

function serviceError(
  code: Parameters<typeof questionGenerationServiceError>[0],
  message: string,
  retryable = false
): never {
  throw questionGenerationServiceError(code, message, retryable)
}

function requireRuntime(ctx: ContextWithUser): QuestionGenerationRuntime {
  if (!ctx.elementGenerationRuntime) {
    return serviceError(
      'QUESTION_GENERATION_UNAVAILABLE',
      'Question generation is not configured'
    )
  }
  return ctx.elementGenerationRuntime
}

function questionWorkflowStartManifestSha256(
  payload: QuestionWorkflowStartPayload
): string {
  const normalized = {
    ...payload,
    falkordb_graph_name: null,
    vdb_chunks: null,
    vdb_entities: null,
    resolved_domain_policy: null,
    generation_recipe: null,
    domain_policy_digest: null,
    generation_recipe_digest: null,
    models: {
      generation_model: null,
      generation_effort: null,
      grounding_model: null,
      grounding_effort: null,
      difficulty_model: null,
      difficulty_effort: null,
    },
  }
  return createHash('sha256')
    .update(JSON.stringify(canonicalElementGenerationJson(normalized)))
    .digest('hex')
}

function artifactsEqual(
  left: QuestionGenerationArtifactRef,
  right: QuestionGenerationArtifactRef
) {
  return (
    left.containerName === right.containerName &&
    left.blobName === right.blobName &&
    left.sha256 === right.sha256
  )
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
    !QUESTION_ELEMENT_TYPES.includes(build.elementType)
  ) {
    return serviceError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key is already used for a different question build'
    )
  }
  assertElementGenerationCostAccounted(build)
}

async function findOwnedBuild(buildId: string, ctx: ContextWithUser) {
  const build = await ctx.prisma.elementGenerationBuild.findFirst({
    where: {
      id: buildId,
      ownerId: ctx.user.sub,
      elementType: { in: QUESTION_ELEMENT_TYPES },
    },
    include: buildInclude,
  })
  if (!build) {
    return serviceError(
      'QUESTION_GENERATION_BUILD_NOT_FOUND',
      'Question-generation build not found'
    )
  }
  return build
}

async function recordBuildFailure(
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
          'Question generation could not be started',
          true
        )
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
      const build = await transaction.elementGenerationBuild.findUniqueOrThrow({
        where: { id: buildId },
        select: { providerDispatchAttemptId: true },
      })
      await releaseUnclaimedElementGenerationSpend(
        transaction,
        build.providerDispatchAttemptId
      )
    }
  })
  throw normalized
}

function questionWorkflowPayload(
  build: Pick<
    QuestionBuild,
    'id' | 'blueprintArtifact' | 'configuration' | 'sourceGraphBuild'
  >,
  runtime: QuestionGenerationRuntime
): QuestionWorkflowStartPayload {
  if (
    !build.blueprintArtifact ||
    !build.sourceGraphBuild.graphManifestArtifact ||
    !build.sourceGraphBuild.graphBundleStorageName
  ) {
    return serviceError(
      'ARTIFACT_INVALID',
      'Question build is missing pinned input artifacts'
    )
  }
  const configuration = build.configuration as QuestionGenerationConfiguration
  return {
    schema_version: 3,
    question_build_id: build.id,
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
    language: configuration.language,
  }
}

async function dispatchPreparingQuestionBuild(
  build: QuestionBuild,
  runtime: QuestionGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  const configuration = build.configuration as QuestionGenerationConfiguration
  const blueprintBytes = await createQuestionGenerationBlueprint(
    configuration,
    questionGenerationSourceSnapshot(build.sourceGraphBuild.sources)
  )
  const blueprintArtifact: QuestionGenerationArtifactRef = {
    containerName: runtime.questionInputContainer,
    blobName: `question-builds/${build.id}/blueprints/blueprint_input.json`,
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

  const payload = questionWorkflowPayload(
    { ...build, blueprintArtifact },
    runtime
  )
  const { eventId, recoveredRunId } =
    await dispatchCostAccountedElementGeneration({
      prisma: ctx.prisma,
      dispatchAttemptId: build.providerDispatchAttemptId,
      recover: () =>
        runtime.findRunByBuildId(
          build.id,
          build.providerDispatchAttemptId,
          build.createdAt
        ),
      dispatch: (beforeProviderDispatch) =>
        runtime.start(
          payload,
          `question-build:${build.id}`,
          build.providerDispatchAttemptId,
          beforeProviderDispatch
        ),
    })

  const updated = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
      syncLeaseOwner: leaseOwner,
    },
    data: {
      blueprintArtifact,
      providerEventId: eventId,
      providerWorkflowRunId: recoveredRunId,
      status: DB.ElementGenerationBuildStatus.DESIGNING,
      stage: 'design',
      startedAt: new Date(),
    },
  })
  if (updated.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Question build preparation was changed by another request'
    )
  }
}

async function resumePreparingQuestionBuild(
  build: QuestionBuild,
  runtime: QuestionGenerationRuntime,
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
    await dispatchPreparingQuestionBuild(build, runtime, leaseOwner, ctx)
  } catch (error) {
    return recordBuildFailure(build.id, error, ctx, leaseOwner)
  } finally {
    await ctx.prisma.elementGenerationBuild.updateMany({
      where: { id: build.id, syncLeaseOwner: leaseOwner },
      data: { syncLeaseOwner: null, syncLeaseUntil: null },
    })
  }
  return findOwnedBuild(build.id, ctx)
}

export async function startQuestionGeneration(
  input: StartQuestionGenerationInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const runtime = requireRuntime(ctx)
  const idempotencyKey = normalizeElementGenerationIdempotencyKey(
    input.idempotencyKey
  )
  const graph = await loadReadyElementGenerationGraph(input.graphBuildId, ctx)

  let normalized: ReturnType<typeof normalizeQuestionGenerationConfiguration>
  try {
    normalized = normalizeQuestionGenerationConfiguration(input, graph)
  } catch (error) {
    if (error instanceof QuestionGenerationConfigurationError) {
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
      ? resumePreparingQuestionBuild(existing, runtime, ctx)
      : existing
  }

  const buildId = randomUUID()
  const creation = await createElementGenerationBuildWithSpend(ctx.prisma, {
    ownerId: ctx.user.sub,
    idempotencyKey,
    spendClass: DB.KBGraphQuotaSpendClass.QUESTION_GENERATION,
    data: {
      id: buildId,
      ownerId: ctx.user.sub,
      sourceGraphBuildId: graph.id,
      elementType: normalized.configuration.itemType,
      idempotencyKey,
      configurationHash: normalized.configurationHash,
      configuration: normalized.configuration,
      requestedElementCount: normalized.configuration.questionCount,
      inputArtifactContainer: runtime.questionInputContainer,
      inputArtifactPrefix: `question-builds/${buildId}`,
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
      ? resumePreparingQuestionBuild(raced, runtime, ctx)
      : raced
  }

  return resumePreparingQuestionBuild(
    await findOwnedBuild(creation.buildId, ctx),
    runtime,
    ctx
  )
}

async function synchronizeLeasedBuild(
  build: Awaited<ReturnType<typeof findOwnedBuild>>,
  runtime: QuestionGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser
) {
  const configuration = build.configuration as QuestionGenerationConfiguration
  let workflowSucceeded = false
  const artifactPath = (
    suffix: string
  ): Promise<{
    ref: QuestionGenerationArtifactRef
    bytes: Buffer
  }> =>
    runtime.downloadImmutable(
      runtime.questionOutputContainer,
      elementGenerationOutputBlobName(runtime, build.id, suffix)
    )

  try {
    const pendingReview = build.reviews.find(
      (review) =>
        (build.status ===
          DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW &&
          review.gate === DB.ElementGenerationReviewGate.DESIGN) ||
        (build.status ===
          DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW &&
          review.gate === DB.ElementGenerationReviewGate.PLAN)
    )
    if (pendingReview) {
      await dispatchQuestionReviewLeased(
        build,
        pendingReview,
        runtime,
        leaseOwner,
        ctx,
        false
      )
      return
    }
    if (build.providerEventId || build.providerWorkflowRunId) {
      const run = build.providerEventId
        ? await runtime.getRun(build.providerEventId)
        : await runtime.getRunById(build.providerWorkflowRunId!)
      if (
        run.runId !== build.providerWorkflowRunId ||
        build.lastSynchronizedAt === null
      ) {
        await ctx.prisma.elementGenerationBuild.updateMany({
          where: { id: build.id, syncLeaseOwner: leaseOwner },
          data: {
            providerWorkflowRunId: run.runId,
            lastSynchronizedAt: new Date(),
          },
        })
      }
      if (run.status === 'FAILED' || run.status === 'CANCELLED') {
        await ctx.prisma.elementGenerationBuild.updateMany({
          where: { id: build.id, syncLeaseOwner: leaseOwner },
          data: {
            status: DB.ElementGenerationBuildStatus.FAILED,
            stage: 'failed',
            errorCode: `WORKFLOW_${run.status}`,
            errorMessage: 'Question-generation workflow did not complete',
            errorRetryable: false,
            completedAt: new Date(),
          },
        })
        return
      }
      workflowSucceeded = run.status === 'SUCCEEDED'
    }

    if (build.status === DB.ElementGenerationBuildStatus.DESIGNING) {
      const artifact = await artifactPath('design/resolved.json')
      const summary = parseQuestionGenerationDesign(artifact.bytes, {
        buildId: build.id,
        configuration,
        sourceSnapshot: questionGenerationSourceSnapshot(
          build.sourceGraphBuild.sources
        ),
      })
      await ctx.prisma.elementGenerationBuild.updateMany({
        where: { id: build.id, syncLeaseOwner: leaseOwner },
        data: {
          designArtifact: artifact.ref,
          designSummary: summary,
          status: DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW,
          stage: 'design_review',
          lastSynchronizedAt: new Date(),
        },
      })
      return
    }

    if (build.status === DB.ElementGenerationBuildStatus.GENERATING_ITEMS) {
      const artifact = await artifactPath('plans/stems.json')
      const graphManifest = build.sourceGraphBuild
        .graphManifestArtifact as QuestionGenerationArtifactRef | null
      const blueprint =
        build.blueprintArtifact as QuestionGenerationArtifactRef | null
      const graphSha256 = build.sourceGraphBuild.graphSha256
      let v3Evidence:
        | Parameters<typeof parseQuestionGenerationPlan>[1]['v3Evidence']
        | undefined
      if (graphManifest !== null) {
        if (blueprint === null || graphSha256 === null) {
          return serviceError(
            'ARTIFACT_INVALID',
            'Question-generation build has incomplete dispatched graph evidence'
          )
        }
        const startPayload: QuestionWorkflowStartPayload = {
          schema_version: 3,
          question_build_id: build.id,
          graph_version_id: build.sourceGraphBuild.id,
          graph_manifest: elementGenerationArtifactPayload(graphManifest),
          storage_name: build.sourceGraphBuild.graphBundleStorageName!,
          blueprint: elementGenerationArtifactPayload(blueprint),
          output: {
            container_name: runtime.questionOutputContainer,
            blob_prefix: runtime.questionOutputPrefix,
          },
          language: configuration.language,
        }
        v3Evidence = {
          graphVersionId: build.sourceGraphBuild.id,
          graphManifest,
          graphSha256,
          startManifestSha256:
            questionWorkflowStartManifestSha256(startPayload),
        }
      }
      const summary = parseQuestionGenerationPlan(artifact.bytes, {
        buildId: build.id,
        configuration,
        sourceSnapshot: questionGenerationSourceSnapshot(
          build.sourceGraphBuild.sources
        ),
        v3Evidence,
      })
      await ctx.prisma.elementGenerationBuild.updateMany({
        where: { id: build.id, syncLeaseOwner: leaseOwner },
        data: {
          planArtifact: artifact.ref,
          planSummary: summary,
          status: DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW,
          stage: 'plan_review',
          lastSynchronizedAt: new Date(),
        },
      })
      return
    }

    if (build.status === DB.ElementGenerationBuildStatus.FINALIZING) {
      const artifact = await artifactPath('result.json')
      const result = parseQuestionGenerationResult(artifact.bytes, {
        buildId: build.id,
        questionCount: build.requestedElementCount,
        requiresCompleteProvenance:
          build.sourceGraphBuild.graphManifestArtifact !== null,
      })
      if (result.status === 'rejected') {
        await ctx.prisma.elementGenerationBuild.updateMany({
          where: { id: build.id, syncLeaseOwner: leaseOwner },
          data: {
            resultManifestArtifact: artifact.ref,
            status: DB.ElementGenerationBuildStatus.REJECTED,
            stage: 'rejected',
            completedAt: new Date(),
            lastSynchronizedAt: new Date(),
          },
        })
      } else if (result.status === 'failed') {
        await ctx.prisma.elementGenerationBuild.updateMany({
          where: { id: build.id, syncLeaseOwner: leaseOwner },
          data: {
            resultManifestArtifact: artifact.ref,
            status: DB.ElementGenerationBuildStatus.FAILED,
            stage: 'failed',
            errorCode: 'WORKFLOW_FAILED',
            errorMessage: 'Question-generation workflow reported a failure',
            errorRetryable: false,
            completedAt: new Date(),
            lastSynchronizedAt: new Date(),
          },
        })
      } else {
        const finalQuestions = result.finalQuestions
        if (!finalQuestions) {
          return serviceError(
            'ARTIFACT_INVALID',
            'Completed question-generation result has no final question bank'
          )
        }
        if (
          finalQuestions.containerName !== runtime.questionOutputContainer ||
          finalQuestions.blobName !==
            elementGenerationOutputBlobName(
              runtime,
              build.id,
              'questions/final.json'
            )
        ) {
          return serviceError(
            'ARTIFACT_INVALID',
            'Completed question-generation result has invalid artifact coordinates'
          )
        }
        const provenanceIndex = result.questionProvenanceIndex
        if (
          (build.sourceGraphBuild.graphManifestArtifact !== null &&
            (provenanceIndex === null ||
              provenanceIndex.containerName !==
                runtime.questionOutputContainer ||
              provenanceIndex.blobName !==
                elementGenerationOutputBlobName(
                  runtime,
                  build.id,
                  'questions/question_provenance_index.json'
                ))) ||
          (build.sourceGraphBuild.graphManifestArtifact === null &&
            provenanceIndex !== null)
        ) {
          return serviceError(
            'ARTIFACT_INVALID',
            'Completed question-generation result has invalid provenance coordinates'
          )
        }
        const finalBytes = await runtime.downloadVerified(finalQuestions)
        let lineage: QuestionGenerationGraphLineage | null = null
        let provenanceAuthority: QuestionGenerationProvenanceAuthority | null =
          null
        if (build.sourceGraphBuild.graphManifestArtifact !== null) {
          const registeredManifest = build.sourceGraphBuild
            .graphManifestArtifact as QuestionGenerationArtifactRef
          const dispatchedManifest = registeredManifest
          if (!artifactsEqual(dispatchedManifest, registeredManifest)) {
            return serviceError(
              'ARTIFACT_INVALID',
              'Question-generation graph manifest lineage changed after dispatch'
            )
          }
          const manifestBytes =
            await runtime.downloadVerified(dispatchedManifest)
          if (build.sourceGraphBuild.graphSha256 === null) {
            return serviceError(
              'ARTIFACT_INVALID',
              'Question-generation graph build has no graph digest'
            )
          }
          const graphEvidence = parseQuestionGenerationGraphManifest(
            manifestBytes,
            {
              graphVersionId: build.sourceGraphBuild.id,
              storageName: build.sourceGraphBuild.graphBundleStorageName!,
              falkordbGraphName: build.sourceGraphBuild.graphName,
              bundleSha256: build.sourceGraphBuild.graphBundleSha256!,
              graphSha256: build.sourceGraphBuild.graphSha256,
            }
          )
          lineage = graphEvidence
          provenanceAuthority =
            await verifyQuestionGenerationProvenanceAuthority(
              runtime.downloadVerifiedStream(graphEvidence.graphArtifact),
              runtime.downloadVerifiedStream(graphEvidence.chunksArtifact),
              parseQuestionGenerationProvenanceClaims(finalBytes)
            )
        }
        const planSummary =
          build.planSummary as QuestionGenerationPlanSummary | null
        const expectedQuestionIds =
          planSummary?.questions.map((question) => question.sourceQuestionId) ??
          []
        if (
          planSummary?.questionCount !== build.requestedElementCount ||
          expectedQuestionIds.length !== build.requestedElementCount
        ) {
          return serviceError(
            'ARTIFACT_INVALID',
            'Completed question-generation build has no verified Plan'
          )
        }
        const questions = parseQuestionGenerationFinalBank(finalBytes, {
          itemType: configuration.itemType ?? 'SC',
          questionCount: build.requestedElementCount,
          sourceSnapshot: questionGenerationSourceSnapshot(
            build.sourceGraphBuild.sources
          ),
          expectedQuestionIds,
          result,
          lineage,
          provenanceAuthority,
        })
        if (provenanceIndex) {
          const provenanceIndexBytes =
            await runtime.downloadVerified(provenanceIndex)
          parseQuestionGenerationProvenanceIndex(
            provenanceIndexBytes,
            questions
          )
        }
        await persistInitialGeneratedQuestionDrafts(
          {
            buildId: build.id,
            leaseOwner,
            questions,
            resultManifestArtifact: artifact.ref,
            finalBankArtifact: finalQuestions,
            questionProvenanceIndexArtifact: provenanceIndex,
          },
          ctx
        )
      }
    }
  } catch (error) {
    if (
      error instanceof QuestionGenerationServiceError &&
      error.code === 'ARTIFACT_NOT_FOUND' &&
      !workflowSucceeded
    ) {
      return
    }
    if (
      error instanceof QuestionGenerationServiceError &&
      error.code !== 'ARTIFACT_NOT_FOUND' &&
      error.retryable
    ) {
      return
    }
    const normalized =
      error instanceof QuestionGenerationServiceError &&
      error.code === 'ARTIFACT_NOT_FOUND' &&
      workflowSucceeded
        ? questionGenerationServiceError(
            'ARTIFACT_INVALID',
            'Question-generation workflow succeeded without its required artifact'
          )
        : error instanceof QuestionGenerationServiceError
          ? error
          : questionGenerationServiceError(
              'ARTIFACT_INVALID',
              'Question-generation output could not be validated'
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

export async function getQuestionGenerationBuild(
  buildId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const build = await findOwnedBuild(buildId, ctx)
  const runtime = ctx.elementGenerationRuntime
  if (!runtime || TERMINAL_STATUSES.has(build.status)) return build
  assertElementGenerationCostAccounted(build)
  if (build.status === DB.ElementGenerationBuildStatus.PREPARING_INPUT) {
    return resumePreparingQuestionBuild(build, runtime, ctx)
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

function questionReviewState(
  gate: DB.ElementGenerationReviewGate,
  decision: DB.ElementGenerationReviewDecision
) {
  const expectedStatus =
    gate === DB.ElementGenerationReviewGate.DESIGN
      ? DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW
      : DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW
  const nextStatus =
    decision === DB.ElementGenerationReviewDecision.REJECT
      ? DB.ElementGenerationBuildStatus.REJECTED
      : gate === DB.ElementGenerationReviewGate.DESIGN
        ? DB.ElementGenerationBuildStatus.GENERATING_ITEMS
        : DB.ElementGenerationBuildStatus.FINALIZING
  const nextStage =
    decision === DB.ElementGenerationReviewDecision.REJECT
      ? 'rejected'
      : gate === DB.ElementGenerationReviewGate.DESIGN
        ? 'stems'
        : 'finalizing'
  return { expectedStatus, nextStatus, nextStage }
}

function questionReviewEvent(
  buildId: string,
  review: QuestionBuild['reviews'][number]
): QuestionWorkflowReviewEvent {
  return {
    key:
      review.gate === DB.ElementGenerationReviewGate.DESIGN
        ? 'course-question-blueprint-generation:design-reviewed'
        : 'course-question-blueprint-generation:plan-reviewed',
    payload: {
      schema_version: 1,
      question_build_id: buildId,
      decision:
        review.decision === DB.ElementGenerationReviewDecision.APPROVE
          ? 'approve'
          : 'reject',
      reviewed_by: review.reviewerId,
      acknowledge_warnings:
        review.decision === DB.ElementGenerationReviewDecision.APPROVE
          ? true
          : review.warningsAcknowledged,
      artifact: null,
    },
  }
}

async function dispatchQuestionReviewLeased(
  build: QuestionBuild,
  review: QuestionBuild['reviews'][number],
  runtime: QuestionGenerationRuntime,
  leaseOwner: string,
  ctx: ContextWithUser,
  allowNewDispatch: boolean
) {
  const { expectedStatus, nextStatus, nextStage } = questionReviewState(
    review.gate,
    review.decision
  )
  if (build.status !== expectedStatus) return

  let recovered = await runtime.findRunByQuestionReview(
    build.id,
    review.id,
    review.createdAt
  )
  if (!recovered) {
    const dispatchIsFresh =
      Date.now() - review.createdAt.getTime() <
      REVIEW_DISPATCH_RECOVERY_MILLISECONDS
    if (!allowNewDispatch && dispatchIsFresh) return
    try {
      await runtime.review(
        questionReviewEvent(build.id, review),
        `question-build:${build.id}`,
        review.id
      )
    } catch (error) {
      if (
        !(error instanceof QuestionGenerationServiceError) ||
        error.code !== 'WORKFLOW_DISPATCH_UNCERTAIN'
      ) {
        throw error
      }
      recovered = await runtime.findRunByQuestionReview(
        build.id,
        review.id,
        review.createdAt
      )
      if (!recovered) throw error
    }
  }

  if (recovered?.status === 'FAILED' || recovered?.status === 'CANCELLED') {
    await ctx.prisma.elementGenerationBuild.updateMany({
      where: {
        id: build.id,
        ownerId: ctx.user.sub,
        status: expectedStatus,
        syncLeaseOwner: leaseOwner,
      },
      data: {
        status: DB.ElementGenerationBuildStatus.FAILED,
        stage: 'failed',
        errorCode: `WORKFLOW_${recovered.status}`,
        errorMessage: 'Question-generation review workflow did not complete',
        errorRetryable: false,
        completedAt: new Date(),
      },
    })
    return
  }

  const updated = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: expectedStatus,
      syncLeaseOwner: leaseOwner,
    },
    data: {
      status: nextStatus,
      stage: nextStage,
      completedAt:
        nextStatus === DB.ElementGenerationBuildStatus.REJECTED
          ? new Date()
          : null,
    },
  })
  if (updated.count !== 1) {
    return serviceError(
      'CONCURRENT_MODIFICATION',
      'Question-generation review was changed by another request'
    )
  }
}

async function resumeQuestionReviewDispatch(
  buildId: string,
  reviewId: string,
  runtime: QuestionGenerationRuntime,
  ctx: ContextWithUser,
  allowNewDispatch: boolean
) {
  const build = await findOwnedBuild(buildId, ctx)
  const review = build.reviews.find((candidate) => candidate.id === reviewId)
  if (!review) {
    return serviceError(
      'INVALID_STAGE',
      'Question-generation review claim could not be loaded'
    )
  }
  const { expectedStatus } = questionReviewState(review.gate, review.decision)
  if (build.status !== expectedStatus) return build

  const leaseOwner = randomUUID()
  const now = new Date()
  const acquired = await ctx.prisma.elementGenerationBuild.updateMany({
    where: {
      id: build.id,
      ownerId: ctx.user.sub,
      status: expectedStatus,
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }],
    },
    data: {
      syncLeaseOwner: leaseOwner,
      syncLeaseUntil: new Date(now.getTime() + SYNC_LEASE_MILLISECONDS),
    },
  })
  if (acquired.count === 1) {
    try {
      await dispatchQuestionReviewLeased(
        build,
        review,
        runtime,
        leaseOwner,
        ctx,
        allowNewDispatch
      )
    } finally {
      await ctx.prisma.elementGenerationBuild.updateMany({
        where: { id: build.id, syncLeaseOwner: leaseOwner },
        data: { syncLeaseOwner: null, syncLeaseUntil: null },
      })
    }
  }
  return findOwnedBuild(build.id, ctx)
}

async function reviewQuestionGenerationGate(
  gate: DB.ElementGenerationReviewGate,
  input: ReviewQuestionGenerationInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const runtime = requireRuntime(ctx)
  const build = await findOwnedBuild(input.buildId, ctx)
  assertElementGenerationCostAccounted(build)
  const expectedStatus =
    gate === DB.ElementGenerationReviewGate.DESIGN
      ? DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW
      : DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW
  const artifact =
    gate === DB.ElementGenerationReviewGate.DESIGN
      ? build.designArtifact
      : build.planArtifact
  const summary =
    gate === DB.ElementGenerationReviewGate.DESIGN
      ? build.designSummary
      : build.planSummary
  const existing = build.reviews.find((review) => review.gate === gate)
  const decision = DB.ElementGenerationReviewDecision[input.decision]
  const warningsAcknowledged =
    decision === DB.ElementGenerationReviewDecision.APPROVE
      ? true
      : input.warningsAcknowledged

  if (
    decision === DB.ElementGenerationReviewDecision.APPROVE &&
    (summary?.warnings.length ?? 0) > 0 &&
    !input.warningsAcknowledged
  ) {
    return serviceError(
      'REVIEW_WARNINGS_NOT_ACKNOWLEDGED',
      'Review warnings must be acknowledged before approval'
    )
  }

  if (existing) {
    const existingWarningsAcknowledged =
      existing.decision === DB.ElementGenerationReviewDecision.APPROVE
        ? true
        : existing.warningsAcknowledged
    if (
      existing.decision !== decision ||
      existingWarningsAcknowledged !== warningsAcknowledged
    ) {
      return serviceError(
        'REVIEW_CONFLICT',
        'This review gate already has a different decision'
      )
    }
    return build.status === expectedStatus
      ? resumeQuestionReviewDispatch(build.id, existing.id, runtime, ctx, false)
      : build
  }
  if (build.status !== expectedStatus || !artifact || !summary) {
    return serviceError(
      'INVALID_STAGE',
      'Question-generation build is not waiting at this review gate'
    )
  }
  const reviewId = randomUUID()
  try {
    await ctx.prisma.elementGenerationReview.create({
      data: {
        id: reviewId,
        buildId: build.id,
        gate,
        decision,
        reviewerId: ctx.user.sub,
        warningsAcknowledged,
        artifact,
        reviewedAt: new Date(),
      },
    })
  } catch (error) {
    if (
      !(error instanceof DB.Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }
    const raced = await findOwnedBuild(build.id, ctx)
    const racedReview = raced.reviews.find((review) => review.gate === gate)
    if (!racedReview) throw error
    const racedWarningsAcknowledged =
      racedReview.decision === DB.ElementGenerationReviewDecision.APPROVE
        ? true
        : racedReview.warningsAcknowledged
    if (
      racedReview.decision !== decision ||
      racedWarningsAcknowledged !== warningsAcknowledged
    ) {
      return serviceError(
        'REVIEW_CONFLICT',
        'This review gate already has a different decision'
      )
    }
    return raced.status === expectedStatus
      ? resumeQuestionReviewDispatch(
          raced.id,
          racedReview.id,
          runtime,
          ctx,
          false
        )
      : raced
  }
  return resumeQuestionReviewDispatch(build.id, reviewId, runtime, ctx, true)
}

export function reviewQuestionGenerationDesign(
  input: ReviewQuestionGenerationInput,
  ctx: ContextWithUser
) {
  return reviewQuestionGenerationGate(
    DB.ElementGenerationReviewGate.DESIGN,
    input,
    ctx
  )
}

export function reviewQuestionGenerationPlan(
  input: ReviewQuestionGenerationInput,
  ctx: ContextWithUser
) {
  return reviewQuestionGenerationGate(
    DB.ElementGenerationReviewGate.PLAN,
    input,
    ctx
  )
}

export async function saveGeneratedQuestions(
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
        elementType: {
          in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
        },
        status: DB.ElementGenerationBuildStatus.COMPLETED,
      },
      select: {
        drafts: {
          where: {
            decision: DB.GeneratedElementDecision.ACCEPTED,
            elementType: {
              in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
            },
          },
          orderBy: [
            { order: 'asc' },
            { duplicationIndex: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    })
    if (!build) {
      return serviceError(
        'QUESTION_GENERATION_BUILD_NOT_FOUND',
        'Completed question-generation build not found'
      )
    }

    const alreadySavedElementIds = build.drafts.flatMap((draft) =>
      draft.savedElementId === null ? [] : [draft.savedElementId]
    )
    const createdElementIds: number[] = []
    for (const draft of build.drafts) {
      if (draft.savedElementId !== null) continue

      let input: ElementManipulationInput
      try {
        const current = draft.current as GeneratedQuestionEditable
        if (draft.targetDifficulty === null) {
          return serviceError(
            'SAVE_VALIDATION_FAILED',
            'A generated question draft has no reviewed difficulty'
          )
        }
        switch (current.itemType ?? 'SC') {
          case 'KPRIM':
            input = generatedKPRIMElementInput(current, draft.targetDifficulty)
            break
          case 'MC':
            input = generatedMCElementInput(current, draft.targetDifficulty)
            break
          case 'SC':
            input = generatedSCElementInput(current, draft.targetDifficulty)
            break
          default:
            return serviceError(
              'SAVE_VALIDATION_FAILED',
              'A generated question draft has an unsupported element type'
            )
        }
      } catch {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated question draft is not a valid question element'
        )
      }
      const element = await manipulateElement(input, {
        ...ctx,
        prisma: transaction,
      })
      if (!element) {
        return serviceError(
          'SAVE_VALIDATION_FAILED',
          'A generated question draft is not a valid question element'
        )
      }
      const linked = await transaction.generatedElementDraft.updateMany({
        where: {
          id: draft.id,
          elementType: {
            in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
          },
          decision: DB.GeneratedElementDecision.ACCEPTED,
          savedElementId: null,
        },
        data: { savedElementId: element.id, savedAt: new Date() },
      })
      if (linked.count !== 1) {
        return serviceError(
          'CONCURRENT_MODIFICATION',
          'Generated question draft was saved by another request'
        )
      }
      createdElementIds.push(element.id)
    }

    return { createdElementIds, alreadySavedElementIds }
  })
}

export {
  duplicateGeneratedQuestionDraft,
  normalizeGeneratedQuestionEditable,
  setGeneratedQuestionDecision,
  updateGeneratedQuestionDraft,
} from './questionGenerationDrafts.js'
