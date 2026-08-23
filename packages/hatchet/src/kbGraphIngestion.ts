import { getKnowledgeGraphName } from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
  KBGraphCostStatus,
  type KBGraphBuildSource,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { BuildKBGraphInput } from '@klicker-uzh/types'
import {
  KB_GRAPH_BUILD_METADATA_KEY,
  KB_GRAPH_KB_METADATA_KEY,
  cancelExternalKBGraphRunBestEffort,
  getExternalKBGraphClient,
  getExternalKBGraphConfig,
  getKBGraphArtifactBlobName,
  getKBGraphOwnerContainerName,
  getKBGraphQualityConfig,
  getKBGraphSourceUrl,
  getKBGraphTimeoutSeconds,
  recoverExternalKBGraphRun,
  type ExternalKBGraphClient,
  type ExternalKBGraphPayload,
  type KBGraphLogger,
} from './kbGraphIngestionApi.js'

const KB_GRAPH_MONITOR_BATCH_SIZE = 32
const KB_GRAPH_MONITOR_CONCURRENCY = 8
const KB_GRAPH_MONITOR_INTERVAL_MS = 15 * 60 * 1000
const KB_GRAPH_MONITOR_PROVIDER_TIMEOUT_MS = 10_000
export const KB_GRAPH_DISPATCH_AMBIGUOUS_CODE = 'KB_GRAPH_DISPATCH_AMBIGUOUS'
const KB_GRAPH_DISPATCH_FAILED_CODE = 'KB_GRAPH_DISPATCH_FAILED'
// A dispatch claim is written just before the provider call, so a claimed build
// with no external operation id is ambiguous for as long as the first attempt may
// still be inside that call. Within this window a duplicate task run must leave
// the build alone: asking the provider too early answers "no run yet", and acting
// on that answer would release the reservation while the real run is starting and
// goes on to spend. Only a claim older than the window is treated as abandoned.
const KB_GRAPH_DISPATCH_CLAIM_GRACE_MS = 15 * 60 * 1000

type KBGraphPrisma = Pick<
  PrismaClient,
  | '$queryRaw'
  | '$transaction'
  | 'kB'
  | 'kBGraphBuild'
  | 'kBGraphQuota'
  | 'kBResource'
>

type KBGraphDispatchRecord = {
  id: string
  kbId: string
  sourceContentDigest: string
  graphName: string
  graphmlBlobName: string | null
  qualityTier: Parameters<typeof getKBGraphQualityConfig>[0]
  createdAt: Date
  kb: {
    ownerId: string
    knowledgeGraphEnabled: boolean
  }
  sources: Array<
    Pick<
      KBGraphBuildSource,
      'resourceId' | 'type' | 'sourceUrl' | 'blobName' | 'contentSha256'
    >
  >
}

type KBGraphReservationRecord = {
  estimatedCostMinorUnits: number | null
  costCurrency: string | null
  costPricingVersion: string | null
  semesterKey: string | null
  costStatus: KBGraphCostStatus | null
  quotaId: string | null
  quota: {
    id: string
    ownerId: string
    semesterKey: string
    currency: string
    limitMinorUnits: number
    reservedMinorUnits: number
  } | null
  kb: { ownerId: string }
}

export type DispatchKBGraphDependencies = {
  prisma: KBGraphPrisma
  client?: ExternalKBGraphClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBGraphLogger
  providerOperationTimeoutMs?: number
  getSourceUrl?: (
    source: KBGraphDispatchRecord['sources'][number],
    options: { ownerId: string; env: NodeJS.ProcessEnv; now: () => Date }
  ) => string
}

export type MonitorKBGraphBuildsDependencies = {
  prisma: KBGraphPrisma
  client?: ExternalKBGraphClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBGraphLogger
  providerOperationTimeoutMs?: number
  getTerminalResult?: (runId: string) => Promise<unknown>
  settleTerminalResult?: (input: {
    buildId: string
    result: unknown
    finishedAt: Date
    allowLateSuccess?: boolean
  }) => Promise<'SETTLED' | 'RELEASED' | 'NEEDS_HUMAN_REVIEW' | 'DUPLICATE'>
}

function graphIdentifiers(build: Pick<KBGraphDispatchRecord, 'id' | 'kbId'>) {
  return { buildId: build.id, kbId: build.kbId }
}

async function logInfoBestEffort(
  logger: KBGraphLogger | undefined,
  message: string,
  identifiers: Record<string, string>
): Promise<void> {
  try {
    await logger?.info?.(message, identifiers)
  } catch {
    // External state has already been persisted; logging must not undo it.
  }
}

async function logErrorBestEffort(
  logger: KBGraphLogger | undefined,
  message: string,
  identifiers: Record<string, string>
): Promise<void> {
  try {
    await logger?.error?.(message, identifiers)
  } catch {
    // Reconciliation must remain retryable when the logger is unavailable.
  }
}

function isActiveBuildStatus(status: KBGraphBuildStatus) {
  return (
    status === KBGraphBuildStatus.QUEUED ||
    status === KBGraphBuildStatus.PROCESSING
  )
}

async function releaseKBGraphReservationInTransaction(
  prisma: Prisma.TransactionClient,
  buildId: string,
  // A held reservation normally only leaves RESERVED. Resolving an ambiguous
  // dispatch also has to unwind a hold that was already parked for review, once
  // the provider has confirmed that no run of that build id ever existed.
  releasableCostStatuses: KBGraphCostStatus[] = [KBGraphCostStatus.RESERVED]
): Promise<void> {
  const build = await prisma.kBGraphBuild.findUnique({
    where: { id: buildId },
    select: {
      quotaId: true,
      estimatedCostMinorUnits: true,
      costStatus: true,
    },
  })
  if (
    !build ||
    build.costStatus === null ||
    !releasableCostStatuses.includes(build.costStatus) ||
    build.estimatedCostMinorUnits === null
  ) {
    return
  }

  if (build.quotaId) {
    await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "public"."KBGraphQuota"
      WHERE "id" = CAST(${build.quotaId} AS UUID)
      FOR UPDATE
    `
  }
  const updated = await prisma.kBGraphBuild.updateMany({
    where: {
      id: buildId,
      costStatus: build.costStatus,
    },
    data: { costStatus: KBGraphCostStatus.RELEASED },
  })
  if (updated.count !== 1 || !build.quotaId) return

  const quotaUpdated = await prisma.kBGraphQuota.updateMany({
    where: {
      id: build.quotaId,
      reservedMinorUnits: { gte: build.estimatedCostMinorUnits },
    },
    data: {
      reservedMinorUnits: { decrement: build.estimatedCostMinorUnits },
    },
  })
  if (quotaUpdated.count !== 1) {
    throw new Error('KB graph quota reservation could not be released')
  }
}

function getGraphMonitorBatchOffset(total: number, now: Date) {
  if (total <= KB_GRAPH_MONITOR_BATCH_SIZE) {
    return 0
  }
  const runNumber = Math.floor(now.getTime() / KB_GRAPH_MONITOR_INTERVAL_MS)
  return (runNumber * KB_GRAPH_MONITOR_BATCH_SIZE) % total
}

async function withProviderTimeout<T>(
  operation: Promise<T>,
  timeoutMilliseconds: number | undefined
): Promise<T> {
  if (timeoutMilliseconds === undefined) {
    return operation
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('KB graph provider operation timed out')),
          timeoutMilliseconds
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function runWithConcurrency<T>(
  items: T[],
  task: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0
  const workerCount = Math.min(KB_GRAPH_MONITOR_CONCURRENCY, items.length)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]!
        nextIndex += 1
        await task(item)
      }
    })
  )
}

function isDispatchableBuild(build: {
  id: string
  status: KBGraphBuildStatus
  externalOperationId: string | null
  dispatchClaimedAt: Date | null
  graphmlBlobName: string | null
  estimatedCostMinorUnits: number | null
  costCurrency: string | null
  costPricingVersion: string | null
  semesterKey: string | null
  costStatus: KBGraphCostStatus | null
  quotaId: string | null
  quota: KBGraphReservationRecord['quota']
  kb: {
    ownerId: string
    deletedAt: Date | null
    activeGraphBuildId: string | null
    knowledgeGraphEnabled: boolean
  }
  sources: KBGraphDispatchRecord['sources']
}) {
  return (
    isActiveBuildStatus(build.status) &&
    build.externalOperationId === null &&
    build.dispatchClaimedAt === null &&
    hasCompleteKBGraphReservation(build) &&
    build.kb.deletedAt === null &&
    build.kb.activeGraphBuildId === build.id &&
    build.kb.knowledgeGraphEnabled &&
    build.sources.length > 0 &&
    build.graphmlBlobName !== null
  )
}

function hasCompleteKBGraphReservation(
  build: Pick<
    KBGraphReservationRecord,
    | 'estimatedCostMinorUnits'
    | 'costCurrency'
    | 'costPricingVersion'
    | 'semesterKey'
    | 'costStatus'
    | 'quotaId'
    | 'quota'
    | 'kb'
  >
): boolean {
  return (
    build.costStatus === KBGraphCostStatus.RESERVED &&
    build.estimatedCostMinorUnits !== null &&
    build.estimatedCostMinorUnits > 0 &&
    build.costCurrency !== null &&
    build.costCurrency.length > 0 &&
    build.costPricingVersion !== null &&
    build.costPricingVersion.length > 0 &&
    build.semesterKey !== null &&
    build.semesterKey.length > 0 &&
    build.quotaId !== null &&
    build.quota !== null &&
    build.quota.id === build.quotaId &&
    build.quota.ownerId === build.kb.ownerId &&
    build.quota.semesterKey === build.semesterKey &&
    build.quota.currency === build.costCurrency &&
    build.quota.limitMinorUnits > 0 &&
    build.quota.reservedMinorUnits >= build.estimatedCostMinorUnits
  )
}

function isUnstartedActiveBuild(build: {
  id: string
  status: KBGraphBuildStatus
  externalOperationId: string | null
  dispatchClaimedAt: Date | null
  kb: { deletedAt: Date | null; activeGraphBuildId: string | null }
}) {
  return (
    isActiveBuildStatus(build.status) &&
    build.externalOperationId === null &&
    build.dispatchClaimedAt === null &&
    build.kb.deletedAt === null &&
    build.kb.activeGraphBuildId === build.id
  )
}

function getDispatchGateFailure(
  build: KBGraphReservationRecord & {
    kb: KBGraphReservationRecord['kb'] & { knowledgeGraphEnabled: boolean }
  },
  env: NodeJS.ProcessEnv
): { statusMessage: string; errorCode: string } | null {
  if (env.KB_GRAPH_DISABLED === 'true') {
    return {
      statusMessage: 'KB graph generation is currently disabled.',
      errorCode: 'KB_GRAPH_DISABLED',
    }
  }
  if (!build.kb.knowledgeGraphEnabled) {
    return {
      statusMessage: 'KB graph generation is not enabled for this KB.',
      errorCode: 'KB_GRAPH_NOT_ENABLED',
    }
  }
  if (!hasCompleteKBGraphReservation(build)) {
    return {
      statusMessage:
        'The KB graph build has no complete cost reservation and requires review.',
      errorCode: 'KB_GRAPH_RESERVATION_INCOMPLETE',
    }
  }
  return null
}

async function failKBGraphBuildBeforeDispatch(
  prisma: KBGraphPrisma,
  {
    buildId,
    kbId,
    statusMessage,
    errorCode,
  }: {
    buildId: string
    kbId: string
    statusMessage: string
    errorCode: string
  },
  finishedAt: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.kBGraphBuild.findUnique({
      where: { id: buildId },
      select: {
        externalOperationId: true,
        dispatchClaimedAt: true,
        costStatus: true,
        status: true,
        kb: {
          select: { deletedAt: true, activeGraphBuildId: true },
        },
      },
    })
    if (
      !current ||
      !isUnstartedActiveBuild({
        id: buildId,
        status: current.status,
        externalOperationId: current.externalOperationId,
        dispatchClaimedAt: current.dispatchClaimedAt,
        kb: current.kb,
      })
    ) {
      return
    }

    const failed = await tx.kBGraphBuild.updateMany({
      where: {
        id: buildId,
        kbId,
        externalOperationId: null,
        dispatchClaimedAt: null,
        status: {
          in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
        },
      },
      data: {
        status: KBGraphBuildStatus.FAILED,
        statusMessage,
        errorCode,
        finishedAt,
      },
    })
    if (failed.count !== 1) return

    if (
      current.costStatus === KBGraphCostStatus.RESERVED &&
      errorCode !== 'KB_GRAPH_RESERVATION_INCOMPLETE'
    ) {
      await releaseKBGraphReservationInTransaction(tx, buildId)
    } else if (
      current.costStatus === null ||
      (current.costStatus === KBGraphCostStatus.RESERVED &&
        errorCode === 'KB_GRAPH_RESERVATION_INCOMPLETE')
    ) {
      await tx.kBGraphBuild.updateMany({
        where: { id: buildId, costStatus: current.costStatus },
        data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
      })
    }
    await tx.kB.updateMany({
      where: { id: kbId, activeGraphBuildId: buildId },
      data: { activeGraphBuildId: null },
    })
  })
}

export function buildExternalKBGraphPayload(
  build: KBGraphDispatchRecord,
  sourceUrls: string[],
  env: NodeJS.ProcessEnv = process.env
): ExternalKBGraphPayload {
  if (sourceUrls.length !== build.sources.length) {
    throw new Error('KB graph source URL count does not match')
  }
  if (build.graphmlBlobName !== getKBGraphArtifactBlobName(build.id)) {
    throw new Error('KB graph artifact path is invalid')
  }

  const quality = getKBGraphQualityConfig(build.qualityTier, env)
  return {
    course_id: build.id,
    storage_name: build.id,
    sources: build.sources.map((source, index) => ({
      source_id: source.resourceId,
      source_url: sourceUrls[index]!,
      expected_content_sha256: source.contentSha256,
    })),
    upload_markdown: false,
    export_to_falkordb: true,
    falkordb_graph_name: build.graphName,
    speed_mode: quality.speedMode,
    generation_model: quality.generationModel,
    cleaning_model: quality.cleaningModel,
    klicker_graph_build: {
      build_id: build.id,
      kb_id: build.kbId,
      owner_id: build.kb.ownerId,
      source_content_digest: build.sourceContentDigest,
      graphml_container_name: getKBGraphOwnerContainerName(build.kb.ownerId),
      graphml_blob_name: build.graphmlBlobName,
    },
  }
}

function validateBuildIdentity(build: KBGraphDispatchRecord): void {
  if (build.graphmlBlobName !== getKBGraphArtifactBlobName(build.id)) {
    throw new Error('KB graph artifact path is invalid')
  }
  if (
    build.graphName !== getKnowledgeGraphName(build.kbId, build.id) ||
    build.sources.some(
      (source) =>
        !source.contentSha256 ||
        (source.type === 'BLOB' && !source.blobName) ||
        (source.type === 'URL' && !source.sourceUrl)
    )
  ) {
    throw new Error('KB graph build snapshot is invalid')
  }
}

/**
 * Outcome of asking the provider whether an accepted-but-uncorrelated dispatch
 * actually produced a run.
 *
 * - `CORRELATED`: the run exists and the build now carries its id again.
 * - `RELEASED`: the provider has no such run, so nothing external is spending;
 *   the reservation is released and the KB build slot is freed for a rebuild.
 * - `HELD`: the provider could not be asked, so a run may still be spending and
 *   both the reservation and the build slot stay fenced until the next attempt.
 */
export type KBGraphDispatchAmbiguityResolution =
  | 'CORRELATED'
  | 'RELEASED'
  | 'HELD'

/**
 * Resolves a build whose dispatch was claimed but never correlated. The provider
 * lookup decides: only a definitive "no run for this build id" may unwind the
 * hold, because releasing a reservation for a run that is still generating would
 * both under-charge the lecturer's quota and allow a second external run.
 */
export async function resolveAmbiguousKBGraphDispatch(
  build: { id: string; kbId: string; createdAt: Date },
  dependencies: Pick<
    DispatchKBGraphDependencies,
    | 'prisma'
    | 'client'
    | 'env'
    | 'logger'
    | 'now'
    | 'providerOperationTimeoutMs'
  >
): Promise<KBGraphDispatchAmbiguityResolution> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const identifiers = graphIdentifiers(build)

  let recoveredRun: Awaited<ReturnType<typeof recoverExternalKBGraphRun>>
  try {
    const config = getExternalKBGraphConfig(env)
    const client = dependencies.client ?? getExternalKBGraphClient(env)
    recoveredRun = await withProviderTimeout(
      recoverExternalKBGraphRun({
        client,
        workflowName: config.workflowName,
        additionalMetadata: {
          [KB_GRAPH_BUILD_METADATA_KEY]: build.id,
          [KB_GRAPH_KB_METADATA_KEY]: build.kbId,
        },
        recoveryAnchor: build.createdAt,
      }),
      dependencies.providerOperationTimeoutMs
    )
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'KB graph dispatch ambiguity could not be resolved against the provider',
      identifiers
    )
    return 'HELD'
  }

  if (recoveredRun) {
    const correlated = await dependencies.prisma.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: null,
        dispatchClaimedAt: { not: null },
        kb: { deletedAt: null, activeGraphBuildId: build.id },
      },
      data: {
        externalOperationId: recoveredRun.runId,
        dispatchClaimedAt: null,
        externalStartedAt: recoveredRun.startedAt,
        startedAt: recoveredRun.startedAt,
        status: KBGraphBuildStatus.PROCESSING,
        statusMessage: null,
        errorCode: null,
        finishedAt: null,
      },
    })
    if (correlated.count !== 1) {
      return 'HELD'
    }
    await logInfoBestEffort(
      dependencies.logger,
      'KB graph dispatch ambiguity resolved by correlating the external run',
      identifiers
    )
    return 'CORRELATED'
  }

  await dependencies.prisma.$transaction(async (tx) => {
    const failed = await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: null,
        // Second money fence: re-checked at write time so a claim refreshed by a
        // concurrent dispatch between the provider lookup and this update keeps
        // its reservation instead of being released underneath a starting run.
        dispatchClaimedAt: {
          lte: new Date(now().getTime() - KB_GRAPH_DISPATCH_CLAIM_GRACE_MS),
        },
      },
      data: {
        status: KBGraphBuildStatus.FAILED,
        statusMessage: 'The external KB graph workflow could not be started.',
        errorCode: KB_GRAPH_DISPATCH_FAILED_CODE,
        finishedAt: new Date(),
      },
    })
    if (failed.count !== 1) {
      return
    }
    await releaseKBGraphReservationInTransaction(tx, build.id, [
      KBGraphCostStatus.RESERVED,
      KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
    ])
    await tx.kB.updateMany({
      where: { id: build.kbId, activeGraphBuildId: build.id },
      data: { activeGraphBuildId: null },
    })
  })
  await logInfoBestEffort(
    dependencies.logger,
    'KB graph dispatch ambiguity resolved: the provider has no run for this build',
    identifiers
  )
  return 'RELEASED'
}

export async function dispatchKBGraphBuild(
  input: BuildKBGraphInput,
  dependencies: DispatchKBGraphDependencies
): Promise<string | undefined> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const build = await dependencies.prisma.kBGraphBuild.findUnique({
    where: { id: input.buildId },
    select: {
      id: true,
      kbId: true,
      sourceContentDigest: true,
      graphName: true,
      graphmlBlobName: true,
      qualityTier: true,
      status: true,
      externalOperationId: true,
      dispatchClaimedAt: true,
      estimatedCostMinorUnits: true,
      costCurrency: true,
      costPricingVersion: true,
      semesterKey: true,
      costStatus: true,
      quotaId: true,
      quota: {
        select: {
          id: true,
          ownerId: true,
          semesterKey: true,
          currency: true,
          limitMinorUnits: true,
          reservedMinorUnits: true,
        },
      },
      createdAt: true,
      kb: {
        select: {
          ownerId: true,
          deletedAt: true,
          activeGraphBuildId: true,
          knowledgeGraphEnabled: true,
        },
      },
      sources: {
        select: {
          resourceId: true,
          type: true,
          sourceUrl: true,
          blobName: true,
          contentSha256: true,
        },
        orderBy: { resourceId: 'asc' },
      },
    },
  })
  if (!build) {
    return undefined
  }
  if (build.dispatchClaimedAt !== null && build.externalOperationId === null) {
    if (
      now().getTime() - build.dispatchClaimedAt.getTime() <
      KB_GRAPH_DISPATCH_CLAIM_GRACE_MS
    ) {
      // A sibling task run for the same build is probably still inside the
      // provider call. Leave its claim, its reservation, and its status exactly
      // as they are; the graph monitor revisits the build once the claim ages
      // past the grace.
      await logInfoBestEffort(
        dependencies.logger,
        'KB graph dispatch is already claimed and may still be in flight',
        graphIdentifiers(build)
      )
      return undefined
    }
    // Ask the provider before parking the build for review: the earlier attempt
    // may have produced a run that simply lost its id, and an unresolvable hold
    // fences the KB slot and the lecturer's quota with no way out.
    const resolution = await resolveAmbiguousKBGraphDispatch(
      build,
      dependencies
    )
    if (resolution === 'HELD') {
      await markKBGraphBuildDispatchFailed(input, dependencies.prisma)
    }
    return undefined
  }
  if (isUnstartedActiveBuild(build)) {
    const gateFailure = getDispatchGateFailure(build, env)
    if (gateFailure) {
      await failKBGraphBuildBeforeDispatch(
        dependencies.prisma,
        {
          buildId: build.id,
          kbId: build.kbId,
          ...gateFailure,
        },
        now()
      )
      return undefined
    }
  }
  if (!isDispatchableBuild(build)) return undefined

  const dispatchBuild: KBGraphDispatchRecord = {
    id: build.id,
    kbId: build.kbId,
    sourceContentDigest: build.sourceContentDigest,
    graphName: build.graphName,
    graphmlBlobName: build.graphmlBlobName,
    qualityTier: build.qualityTier,
    createdAt: build.createdAt,
    kb: {
      ownerId: build.kb.ownerId,
      knowledgeGraphEnabled: build.kb.knowledgeGraphEnabled,
    },
    sources: build.sources,
  }
  const identifiers = graphIdentifiers(dispatchBuild)

  try {
    validateBuildIdentity(dispatchBuild)
    const config = getExternalKBGraphConfig(env)
    const client = dependencies.client ?? getExternalKBGraphClient(env)
    const additionalMetadata = {
      [KB_GRAPH_BUILD_METADATA_KEY]: dispatchBuild.id,
      [KB_GRAPH_KB_METADATA_KEY]: dispatchBuild.kbId,
    }
    const recoveredRun = await recoverExternalKBGraphRun({
      client,
      workflowName: config.workflowName,
      additionalMetadata,
      recoveryAnchor: dispatchBuild.createdAt,
    })

    let runId: string
    let startedAt: Date
    if (recoveredRun) {
      runId = recoveredRun.runId
      startedAt = recoveredRun.startedAt
      const claimed = await dependencies.prisma.kBGraphBuild.updateMany({
        where: {
          id: dispatchBuild.id,
          kbId: dispatchBuild.kbId,
          status: {
            in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
          },
          externalOperationId: null,
          dispatchClaimedAt: null,
          kb: {
            deletedAt: null,
            activeGraphBuildId: dispatchBuild.id,
          },
        },
        data: { dispatchClaimedAt: startedAt },
      })
      if (claimed.count !== 1) {
        return undefined
      }
    } else {
      const current = await dependencies.prisma.kBGraphBuild.findUnique({
        where: { id: dispatchBuild.id },
        select: {
          id: true,
          status: true,
          externalOperationId: true,
          dispatchClaimedAt: true,
          estimatedCostMinorUnits: true,
          costCurrency: true,
          costPricingVersion: true,
          semesterKey: true,
          costStatus: true,
          quotaId: true,
          quota: {
            select: {
              id: true,
              ownerId: true,
              semesterKey: true,
              currency: true,
              limitMinorUnits: true,
              reservedMinorUnits: true,
            },
          },
          kb: {
            select: {
              ownerId: true,
              deletedAt: true,
              activeGraphBuildId: true,
              knowledgeGraphEnabled: true,
            },
          },
        },
      })
      const gateFailure = current ? getDispatchGateFailure(current, env) : null
      if (!current || !isUnstartedActiveBuild(current) || gateFailure) {
        if (current && isUnstartedActiveBuild(current) && gateFailure) {
          await failKBGraphBuildBeforeDispatch(
            dependencies.prisma,
            {
              buildId: current.id,
              kbId: dispatchBuild.kbId,
              ...gateFailure,
            },
            now()
          )
        }
        return undefined
      }
      const getSourceUrl = dependencies.getSourceUrl ?? getKBGraphSourceUrl
      const sourceUrls = dispatchBuild.sources.map((source) =>
        getSourceUrl(source, {
          ownerId: dispatchBuild.kb.ownerId,
          env,
          now,
        })
      )
      const payload = buildExternalKBGraphPayload(
        dispatchBuild,
        sourceUrls,
        env
      )
      startedAt = now()
      const claimed = await dependencies.prisma.kBGraphBuild.updateMany({
        where: {
          id: dispatchBuild.id,
          kbId: dispatchBuild.kbId,
          status: {
            in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
          },
          externalOperationId: null,
          dispatchClaimedAt: null,
          kb: {
            deletedAt: null,
            activeGraphBuildId: dispatchBuild.id,
          },
        },
        data: { dispatchClaimedAt: startedAt },
      })
      if (claimed.count !== 1) {
        return undefined
      }
      const run = await client.runNoWait(config.workflowName, payload, {
        additionalMetadata,
      })
      runId = await run.getWorkflowRunId()
    }

    const persisted = await dependencies.prisma.kBGraphBuild.updateMany({
      where: {
        id: dispatchBuild.id,
        kbId: dispatchBuild.kbId,
        status: {
          in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
        },
        externalOperationId: null,
        dispatchClaimedAt: startedAt,
        kb: {
          deletedAt: null,
          activeGraphBuildId: dispatchBuild.id,
        },
      },
      data: {
        externalOperationId: runId,
        dispatchClaimedAt: null,
        externalStartedAt: startedAt,
        startedAt,
        statusMessage: null,
        errorCode: null,
      },
    })
    if (persisted.count === 1) {
      await logInfoBestEffort(
        dependencies.logger,
        'External KB graph build dispatched',
        identifiers
      )
      return runId
    }

    const current = await dependencies.prisma.kBGraphBuild.findUnique({
      where: { id: dispatchBuild.id },
      select: { externalOperationId: true },
    })
    if (current?.externalOperationId === runId) {
      return runId
    }

    await cancelExternalKBGraphRunBestEffort({
      client,
      runId,
      identifiers,
      logger: dependencies.logger,
    })
    return undefined
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'External KB graph build dispatch failed',
      identifiers
    )
    throw new Error('External KB graph build dispatch failed')
  }
}

async function finishKBGraphBuild({
  build,
  status,
  statusMessage,
  errorCode,
  prisma,
  finishedAt,
}: {
  build: {
    id: string
    kbId: string
    externalOperationId: string
  }
  status: typeof KBGraphBuildStatus.SUCCEEDED | typeof KBGraphBuildStatus.FAILED
  statusMessage: string | null
  errorCode: string | null
  prisma: KBGraphPrisma
  finishedAt: Date
}) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: build.externalOperationId,
        status: {
          in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
        },
      },
      data: {
        status,
        statusMessage,
        errorCode,
        finishedAt,
      },
    })
    if (updated.count !== 1) {
      return
    }

    await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        costStatus: {
          in: [
            KBGraphCostStatus.RESERVED,
            KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
          ],
        },
      },
      data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
    })

    await tx.kB.updateMany({
      where: { id: build.kbId, activeGraphBuildId: build.id },
      data: { activeGraphBuildId: null },
    })
  })
}

type TimedOutKBGraphBuild = {
  id: string
  kbId: string
  sourceContentDigest: string
  createdAt: Date
  externalOperationId: string
}

async function recordIneligibleLateSuccess(
  build: TimedOutKBGraphBuild,
  prisma: Pick<KBGraphPrisma, 'kBGraphBuild'>,
  status:
    | typeof KBGraphBuildStatus.FAILED
    | typeof KBGraphBuildStatus.SUPERSEDED,
  statusMessage: string,
  errorCode: string
): Promise<void> {
  await prisma.kBGraphBuild.updateMany({
    where: {
      id: build.id,
      kbId: build.kbId,
      externalOperationId: build.externalOperationId,
      status: KBGraphBuildStatus.FAILED,
      errorCode: 'KB_GRAPH_TIMEOUT',
      cleanedAt: null,
      cleanupStartedAt: null,
    },
    data: { status, statusMessage, errorCode },
  })
}

async function monitorTimedOutKBGraphBuilds(
  builds: TimedOutKBGraphBuild[],
  dependencies: MonitorKBGraphBuildsDependencies,
  client: ExternalKBGraphClient,
  now: () => Date,
  providerOperationTimeoutMs: number
): Promise<void> {
  await runWithConcurrency(builds, async (build) => {
    const identifiers = graphIdentifiers(build)
    try {
      const externalStatus = await withProviderTimeout(
        client.runs.get_status(build.externalOperationId),
        providerOperationTimeoutMs
      )
      if (externalStatus !== 'COMPLETED') {
        return
      }

      if (dependencies.getTerminalResult && dependencies.settleTerminalResult) {
        const terminalResult = await withProviderTimeout(
          dependencies.getTerminalResult(build.externalOperationId),
          providerOperationTimeoutMs
        )
        await dependencies.settleTerminalResult({
          buildId: build.id,
          result: terminalResult,
          finishedAt: now(),
          allowLateSuccess: true,
        })
      } else {
        await recordIneligibleLateSuccess(
          build,
          dependencies.prisma,
          KBGraphBuildStatus.FAILED,
          'The external workflow completed after timeout without a versioned terminal result.',
          'KB_GRAPH_RESULT_REQUIRED'
        )
      }
    } catch {
      await logErrorBestEffort(
        dependencies.logger,
        'Timed-out external KB graph build monitor failed',
        identifiers
      )
    }
  })
}

export async function monitorActiveKBGraphBuilds(
  dependencies: MonitorKBGraphBuildsDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const timeoutMilliseconds = getKBGraphTimeoutSeconds(env) * 1000
  const providerOperationTimeoutMs =
    dependencies.providerOperationTimeoutMs ??
    KB_GRAPH_MONITOR_PROVIDER_TIMEOUT_MS
  const sweepNow = now()
  const activeWhere = {
    status: {
      in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
    },
    externalOperationId: { not: null },
    externalStartedAt: { not: null },
  } satisfies Prisma.KBGraphBuildWhereInput
  const activeCount = await dependencies.prisma.kBGraphBuild.count({
    where: activeWhere,
  })
  const activeOffset = getGraphMonitorBatchOffset(activeCount, sweepNow)
  const builds = await dependencies.prisma.kBGraphBuild.findMany({
    where: activeWhere,
    select: {
      id: true,
      kbId: true,
      externalOperationId: true,
      externalStartedAt: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(activeOffset > 0 ? { skip: activeOffset } : {}),
    take: KB_GRAPH_MONITOR_BATCH_SIZE,
  })
  const timedOutWhere = {
    status: KBGraphBuildStatus.FAILED,
    errorCode: 'KB_GRAPH_TIMEOUT',
    externalOperationId: { not: null },
    cleanedAt: null,
    cleanupStartedAt: null,
  } satisfies Prisma.KBGraphBuildWhereInput
  const timedOutCount = await dependencies.prisma.kBGraphBuild.count({
    where: timedOutWhere,
  })
  const timedOutOffset = getGraphMonitorBatchOffset(timedOutCount, sweepNow)
  const timedOutBuilds = await dependencies.prisma.kBGraphBuild.findMany({
    where: timedOutWhere,
    select: {
      id: true,
      kbId: true,
      sourceContentDigest: true,
      createdAt: true,
      externalOperationId: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(timedOutOffset > 0 ? { skip: timedOutOffset } : {}),
    take: KB_GRAPH_MONITOR_BATCH_SIZE,
  })
  // Runs ahead of the early return: a build parked on an ambiguous dispatch has
  // neither a correlated run nor a timeout, so no other sweep would revisit it.
  await recheckAmbiguousKBGraphDispatches(
    { ...dependencies, providerOperationTimeoutMs },
    sweepNow
  )

  if (builds.length === 0 && timedOutBuilds.length === 0) {
    return
  }

  const client = dependencies.client ?? getExternalKBGraphClient(env)
  await runWithConcurrency(builds, async (build) => {
    if (!build.externalOperationId || !build.externalStartedAt) {
      return
    }
    const identifiers = graphIdentifiers(build)
    try {
      const externalStatus = await withProviderTimeout(
        client.runs.get_status(build.externalOperationId),
        providerOperationTimeoutMs
      )
      const observedAt = now()
      if (
        externalStatus === 'COMPLETED' ||
        externalStatus === 'FAILED' ||
        externalStatus === 'CANCELLED'
      ) {
        if (
          !dependencies.getTerminalResult ||
          !dependencies.settleTerminalResult
        ) {
          const statusMessage =
            externalStatus === 'COMPLETED'
              ? 'The external workflow completed without a versioned terminal result.'
              : `The external workflow ended with ${externalStatus.toLowerCase()} without a versioned terminal result.`
          await finishKBGraphBuild({
            build: {
              ...build,
              externalOperationId: build.externalOperationId,
            },
            status: KBGraphBuildStatus.FAILED,
            statusMessage,
            errorCode: 'KB_GRAPH_RESULT_REQUIRED',
            prisma: dependencies.prisma,
            finishedAt: observedAt,
          })
          return
        }

        const terminalResult = await withProviderTimeout(
          dependencies.getTerminalResult(build.externalOperationId),
          providerOperationTimeoutMs
        )
        await dependencies.settleTerminalResult({
          buildId: build.id,
          result: terminalResult,
          finishedAt: observedAt,
        })
        return
      }

      if (
        observedAt.getTime() - build.externalStartedAt.getTime() >
        timeoutMilliseconds
      ) {
        await withProviderTimeout(
          cancelExternalKBGraphRunBestEffort({
            client,
            runId: build.externalOperationId,
            identifiers,
            logger: dependencies.logger,
          }),
          providerOperationTimeoutMs
        )
        await finishKBGraphBuild({
          build: {
            ...build,
            externalOperationId: build.externalOperationId,
          },
          status: KBGraphBuildStatus.FAILED,
          statusMessage: 'External KB graph workflow timed out.',
          errorCode: 'KB_GRAPH_TIMEOUT',
          prisma: dependencies.prisma,
          finishedAt: observedAt,
        })
        return
      }

      if (externalStatus === 'RUNNING') {
        await dependencies.prisma.kBGraphBuild.updateMany({
          where: {
            id: build.id,
            kbId: build.kbId,
            externalOperationId: build.externalOperationId,
            status: KBGraphBuildStatus.QUEUED,
          },
          data: {
            status: KBGraphBuildStatus.PROCESSING,
            statusMessage: null,
          },
        })
      }
    } catch {
      await logErrorBestEffort(
        dependencies.logger,
        'External KB graph build monitor failed',
        identifiers
      )
    }
  })
  await monitorTimedOutKBGraphBuilds(
    timedOutBuilds.flatMap((build) =>
      build.externalOperationId === null
        ? []
        : [{ ...build, externalOperationId: build.externalOperationId }]
    ),
    dependencies,
    client,
    now,
    providerOperationTimeoutMs
  )
}

/**
 * Retries the provider lookup for every build still parked on an ambiguous
 * dispatch. A provider outage is transient, so the hold is a waiting state rather
 * than a permanent one: each sweep either correlates the run or, once the
 * provider is reachable and reports no run, releases the reservation and frees
 * the KB build slot so the lecturer can rebuild without an operator.
 */
export async function recheckAmbiguousKBGraphDispatches(
  dependencies: Pick<
    MonitorKBGraphBuildsDependencies,
    'prisma' | 'client' | 'env' | 'logger' | 'providerOperationTimeoutMs'
  >,
  sweepNow: Date
): Promise<void> {
  const ambiguousWhere = {
    errorCode: KB_GRAPH_DISPATCH_AMBIGUOUS_CODE,
    externalOperationId: null,
    // Only claims older than the in-flight grace are candidates: a fresher claim
    // may belong to a dispatch that is still inside the provider call.
    dispatchClaimedAt: {
      lte: new Date(sweepNow.getTime() - KB_GRAPH_DISPATCH_CLAIM_GRACE_MS),
    },
  } satisfies Prisma.KBGraphBuildWhereInput
  const ambiguousCount = await dependencies.prisma.kBGraphBuild.count({
    where: ambiguousWhere,
  })
  const ambiguousOffset = getGraphMonitorBatchOffset(ambiguousCount, sweepNow)
  const ambiguousBuilds = await dependencies.prisma.kBGraphBuild.findMany({
    where: ambiguousWhere,
    select: { id: true, kbId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    ...(ambiguousOffset > 0 ? { skip: ambiguousOffset } : {}),
    take: KB_GRAPH_MONITOR_BATCH_SIZE,
  })
  await runWithConcurrency(ambiguousBuilds, async (build) => {
    await resolveAmbiguousKBGraphDispatch(build, {
      ...dependencies,
      now: () => sweepNow,
    })
  })
}

export async function markKBGraphBuildDispatchFailed(
  input: BuildKBGraphInput,
  prisma: KBGraphPrisma
): Promise<void> {
  const finishedAt = new Date()
  await prisma.$transaction(async (tx) => {
    const build = await tx.kBGraphBuild.findUnique({
      where: { id: input.buildId },
      select: {
        id: true,
        kbId: true,
        dispatchClaimedAt: true,
        costStatus: true,
      },
    })
    if (!build) return

    const failed = await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: null,
        dispatchClaimedAt:
          build.dispatchClaimedAt === null ? null : { not: null },
        status: {
          in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
        },
      },
      data: {
        status: KBGraphBuildStatus.FAILED,
        statusMessage:
          build.dispatchClaimedAt === null
            ? 'The external KB graph workflow could not be started.'
            : 'The external KB graph workflow may have been accepted but could not be correlated; manual review is required.',
        errorCode:
          build.dispatchClaimedAt === null
            ? 'KB_GRAPH_DISPATCH_FAILED'
            : 'KB_GRAPH_DISPATCH_AMBIGUOUS',
        finishedAt,
      },
    })
    if (failed.count === 1) {
      if (
        build.dispatchClaimedAt === null &&
        build.costStatus === KBGraphCostStatus.RESERVED
      ) {
        await releaseKBGraphReservationInTransaction(tx, build.id)
      } else if (
        build.costStatus === null ||
        build.costStatus === KBGraphCostStatus.RESERVED
      ) {
        await tx.kBGraphBuild.updateMany({
          where: { id: build.id, costStatus: build.costStatus },
          data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
        })
      }
      if (build.dispatchClaimedAt === null) {
        await tx.kB.updateMany({
          where: { id: build.kbId, activeGraphBuildId: build.id },
          data: { activeGraphBuildId: null },
        })
      }
    }
  })
}
