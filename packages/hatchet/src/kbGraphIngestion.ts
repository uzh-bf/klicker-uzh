import {
  computeKBContentDigest,
  getKnowledgeGraphName,
} from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
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
const KB_GRAPH_MONITOR_INTERVAL_MS = 15 * 60 * 1000

type KBGraphPrisma = Pick<
  PrismaClient,
  '$queryRaw' | '$transaction' | 'kB' | 'kBGraphBuild' | 'kBResource'
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
  }
  sources: Array<
    Pick<
      KBGraphBuildSource,
      'resourceId' | 'type' | 'sourceUrl' | 'blobName' | 'contentSha256'
    >
  >
}

export type DispatchKBGraphDependencies = {
  prisma: KBGraphPrisma
  client?: ExternalKBGraphClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBGraphLogger
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

function getGraphMonitorBatchOffset(total: number, now: Date) {
  if (total <= KB_GRAPH_MONITOR_BATCH_SIZE) {
    return 0
  }
  const runNumber = Math.floor(now.getTime() / KB_GRAPH_MONITOR_INTERVAL_MS)
  return (runNumber * KB_GRAPH_MONITOR_BATCH_SIZE) % total
}

function isDispatchableBuild(build: {
  id: string
  status: KBGraphBuildStatus
  externalOperationId: string | null
  graphmlBlobName: string | null
  kb: { deletedAt: Date | null; activeGraphBuildId: string | null }
  sources: KBGraphDispatchRecord['sources']
}) {
  return (
    isActiveBuildStatus(build.status) &&
    build.externalOperationId === null &&
    build.kb.deletedAt === null &&
    build.kb.activeGraphBuildId === build.id &&
    build.sources.length > 0 &&
    build.graphmlBlobName !== null
  )
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
      createdAt: true,
      kb: {
        select: {
          ownerId: true,
          deletedAt: true,
          activeGraphBuildId: true,
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
  if (!build || !isDispatchableBuild(build)) {
    return undefined
  }

  const dispatchBuild: KBGraphDispatchRecord = {
    id: build.id,
    kbId: build.kbId,
    sourceContentDigest: build.sourceContentDigest,
    graphName: build.graphName,
    graphmlBlobName: build.graphmlBlobName,
    qualityTier: build.qualityTier,
    createdAt: build.createdAt,
    kb: { ownerId: build.kb.ownerId },
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
    } else {
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
        kb: {
          deletedAt: null,
          activeGraphBuildId: dispatchBuild.id,
        },
      },
      data: {
        externalOperationId: runId,
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
  publish,
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
  publish: boolean
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

    if (publish) {
      const published = await tx.kB.updateMany({
        where: {
          id: build.kbId,
          deletedAt: null,
          activeGraphBuildId: build.id,
        },
        data: {
          activeGraphBuildId: null,
          publishedGraphBuildId: build.id,
        },
      })
      if (published.count !== 1) {
        throw new Error('KB graph build lost its active publication slot')
      }
      return
    }

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

async function acceptLateKBGraphSuccess(
  build: TimedOutKBGraphBuild,
  prisma: KBGraphPrisma,
  finishedAt: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lockedKb = await tx.$queryRaw<
      Array<{
        id: string
        activeGraphBuildId: string | null
        deletedAt: Date | null
      }>
    >`
      SELECT "id", "activeGraphBuildId", "deletedAt"
      FROM "public"."KB"
      WHERE "id" = CAST(${build.kbId} AS UUID)
      FOR UPDATE
    `
    const currentKb = lockedKb[0]
    if (
      lockedKb.length !== 1 ||
      !currentKb ||
      currentKb.deletedAt !== null ||
      currentKb.activeGraphBuildId !== null
    ) {
      await recordIneligibleLateSuccess(
        build,
        tx,
        KBGraphBuildStatus.SUPERSEDED,
        'A newer KB graph build replaced this timed-out build.',
        'KB_GRAPH_LATE_SUCCESS_SUPERSEDED'
      )
      return
    }

    const newerBuild = await tx.kBGraphBuild.findFirst({
      where: { kbId: build.kbId, createdAt: { gt: build.createdAt } },
      select: { id: true },
    })
    if (newerBuild) {
      await recordIneligibleLateSuccess(
        build,
        tx,
        KBGraphBuildStatus.SUPERSEDED,
        'A newer KB graph build replaced this timed-out build.',
        'KB_GRAPH_LATE_SUCCESS_SUPERSEDED'
      )
      return
    }

    // Resource refresh webhooks lock only their resource row. Lock every
    // current resource after the KB row so a serving hash cannot change while
    // the pinned digest is checked. Resource creation/deletion already takes
    // the KB row lock, so the set cannot change around this snapshot.
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT resource."id"
      FROM "public"."KBResource" AS resource
      WHERE resource."kbId" = CAST(${build.kbId} AS UUID)
        AND resource."deletedAt" IS NULL
      ORDER BY resource."id" ASC
      FOR UPDATE OF resource
    `

    const currentDigest = await computeKBContentDigest(tx, build.kbId)
    if (currentDigest !== build.sourceContentDigest) {
      await recordIneligibleLateSuccess(
        build,
        tx,
        KBGraphBuildStatus.FAILED,
        'The KB changed before the timed-out build completed.',
        'KB_GRAPH_LATE_SUCCESS_STALE'
      )
      return
    }

    const updated = await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: build.externalOperationId,
        status: KBGraphBuildStatus.FAILED,
        errorCode: 'KB_GRAPH_TIMEOUT',
        cleanedAt: null,
        cleanupStartedAt: null,
      },
      data: {
        status: KBGraphBuildStatus.SUCCEEDED,
        statusMessage:
          'The external KB graph workflow completed after timeout.',
        errorCode: null,
        finishedAt,
      },
    })
    if (updated.count !== 1) {
      return
    }

    const published = await tx.kB.updateMany({
      where: {
        id: build.kbId,
        deletedAt: null,
        activeGraphBuildId: null,
      },
      data: { publishedGraphBuildId: build.id },
    })
    if (published.count !== 1) {
      throw new Error('KB graph build changed while accepting late success')
    }
  })
}

async function monitorTimedOutKBGraphBuilds(
  builds: TimedOutKBGraphBuild[],
  dependencies: MonitorKBGraphBuildsDependencies,
  client: ExternalKBGraphClient,
  now: () => Date
): Promise<void> {
  for (const build of builds) {
    const identifiers = graphIdentifiers(build)
    try {
      const externalStatus = await client.runs.get_status(
        build.externalOperationId
      )
      if (externalStatus !== 'COMPLETED') {
        continue
      }

      // R5: a late completion can recover a timeout only when it still
      // represents the current KB revision and no newer build has taken over.
      await acceptLateKBGraphSuccess(build, dependencies.prisma, now())
    } catch {
      await logErrorBestEffort(
        dependencies.logger,
        'Timed-out external KB graph build monitor failed',
        identifiers
      )
    }
  }
}

export async function monitorActiveKBGraphBuilds(
  dependencies: MonitorKBGraphBuildsDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const timeoutMilliseconds = getKBGraphTimeoutSeconds(env) * 1000
  const sweepNow = now()
  const builds = await dependencies.prisma.kBGraphBuild.findMany({
    where: {
      status: {
        in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
      },
      externalOperationId: { not: null },
      externalStartedAt: { not: null },
    },
    select: {
      id: true,
      kbId: true,
      externalOperationId: true,
      externalStartedAt: true,
    },
    orderBy: { createdAt: 'asc' },
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
  if (builds.length === 0 && timedOutBuilds.length === 0) {
    return
  }

  const client = dependencies.client ?? getExternalKBGraphClient(env)
  for (const build of builds) {
    if (!build.externalOperationId || !build.externalStartedAt) {
      continue
    }
    const identifiers = graphIdentifiers(build)
    try {
      const externalStatus = await client.runs.get_status(
        build.externalOperationId
      )
      const observedAt = now()
      if (externalStatus === 'COMPLETED') {
        // R1: a build may publish the digest it pinned even if the KB changed
        // meanwhile. The UI marks it stale instead of replacing serving data.
        await finishKBGraphBuild({
          build: {
            ...build,
            externalOperationId: build.externalOperationId,
          },
          status: KBGraphBuildStatus.SUCCEEDED,
          statusMessage: null,
          errorCode: null,
          prisma: dependencies.prisma,
          finishedAt: observedAt,
          publish: true,
        })
        continue
      }
      if (externalStatus === 'FAILED' || externalStatus === 'CANCELLED') {
        await finishKBGraphBuild({
          build: {
            ...build,
            externalOperationId: build.externalOperationId,
          },
          status: KBGraphBuildStatus.FAILED,
          statusMessage:
            externalStatus === 'FAILED'
              ? 'External KB graph workflow failed.'
              : 'External KB graph workflow was cancelled.',
          errorCode:
            externalStatus === 'FAILED'
              ? 'KB_GRAPH_EXTERNAL_FAILED'
              : 'KB_GRAPH_EXTERNAL_CANCELLED',
          prisma: dependencies.prisma,
          finishedAt: observedAt,
          publish: false,
        })
        continue
      }

      if (
        observedAt.getTime() - build.externalStartedAt.getTime() >
        timeoutMilliseconds
      ) {
        await cancelExternalKBGraphRunBestEffort({
          client,
          runId: build.externalOperationId,
          identifiers,
          logger: dependencies.logger,
        })
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
          publish: false,
        })
        continue
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
  }
  await monitorTimedOutKBGraphBuilds(
    timedOutBuilds.flatMap((build) =>
      build.externalOperationId === null
        ? []
        : [{ ...build, externalOperationId: build.externalOperationId }]
    ),
    dependencies,
    client,
    now
  )
}

export async function markKBGraphBuildDispatchFailed(
  input: BuildKBGraphInput,
  prisma: KBGraphPrisma
): Promise<void> {
  const finishedAt = new Date()
  const build = await prisma.kBGraphBuild.findUnique({
    where: { id: input.buildId },
    select: { id: true, kbId: true },
  })
  if (!build) {
    return
  }
  await prisma.$transaction(async (tx) => {
    const failed = await tx.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        externalOperationId: null,
        status: {
          in: [KBGraphBuildStatus.QUEUED, KBGraphBuildStatus.PROCESSING],
        },
      },
      data: {
        status: KBGraphBuildStatus.FAILED,
        statusMessage: 'The external KB graph workflow could not be started.',
        errorCode: 'KB_GRAPH_DISPATCH_FAILED',
        finishedAt,
      },
    })
    if (failed.count === 1) {
      await tx.kB.updateMany({
        where: { id: build.kbId, activeGraphBuildId: build.id },
        data: { activeGraphBuildId: null },
      })
    }
  })
}
