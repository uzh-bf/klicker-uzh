import { KBResourceStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import {
  buildKBIngestionSource,
  createKBIngestionApiClient,
  getKBIngestionProjectId,
  prepareKBIngestionSource,
  type KBIngestionApiClient,
  type KBIngestionSource,
} from './kbIngestionApi.js'

const KB_INGESTION_POLL_CONCURRENCY = 8
const KB_INGESTION_POLL_LIMIT = 32

export type KBIngestionLogger = {
  info?: (
    message: string,
    metadata?: Record<string, string>
  ) => unknown | Promise<unknown>
  error?: (
    message: string,
    metadata?: Record<string, string>
  ) => unknown | Promise<unknown>
}

type KBIngestionPrisma = Pick<PrismaClient, 'kBResource'>

export type DispatchKBIngestionDependencies = {
  prisma: KBIngestionPrisma
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
  prepareSource?: (
    input: IngestKBResourceInput,
    env: NodeJS.ProcessEnv
  ) => Promise<KBIngestionSource>
}

export type MonitorKBIngestionsDependencies = {
  prisma: KBIngestionPrisma
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
}

async function logErrorBestEffort(
  logger: KBIngestionLogger | undefined,
  message: string,
  identifiers: Record<string, string>
): Promise<void> {
  try {
    await logger?.error?.(message, identifiers)
  } catch {
    // Error handling must continue when the logger transport is unavailable.
  }
}

async function logInfoBestEffort(
  logger: KBIngestionLogger | undefined,
  message: string,
  identifiers: Record<string, string>
): Promise<void> {
  try {
    await logger?.info?.(message, identifiers)
  } catch {
    // A completed dispatch must not fail when the logger transport is unavailable.
  }
}

export function validateKBIngestionWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  const configuredValues = [
    env.KB_INGESTION_API_URL,
    env.KB_INGESTION_API_KEY,
  ].filter((value) => value?.trim())
  if (configuredValues.length > 0) {
    createKBIngestionApiClient({ env })
  }
}

async function persistPreparedSource({
  input,
  prisma,
  source,
  env,
}: {
  input: IngestKBResourceInput
  prisma: KBIngestionPrisma
  source: KBIngestionSource
  env: NodeJS.ProcessEnv
}): Promise<KBIngestionSource | undefined> {
  const persisted = await prisma.kBResource.updateMany({
    where: {
      id: input.resourceId,
      ingestionAttemptId: input.ingestionAttemptId,
      resourceVersion: input.resourceVersion,
      status: {
        in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
      },
      contentSha256: null,
      externalOperationId: null,
    },
    data: {
      contentSha256: source.contentSha256,
      mimeType: source.mimeType,
    },
  })
  if (persisted.count === 1) {
    return source
  }

  const current = await prisma.kBResource.findUnique({
    where: { id: input.resourceId },
    select: {
      ingestionAttemptId: true,
      resourceVersion: true,
      contentSha256: true,
      mimeType: true,
    },
  })
  if (
    current?.ingestionAttemptId !== input.ingestionAttemptId ||
    current.resourceVersion !== input.resourceVersion ||
    !current.contentSha256 ||
    !current.mimeType
  ) {
    return undefined
  }
  return buildKBIngestionSource(
    input,
    current.mimeType,
    current.contentSha256,
    env
  )
}

export async function dispatchKBIngestion(
  input: IngestKBResourceInput,
  dependencies: DispatchKBIngestionDependencies
): Promise<string | undefined> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const identifiers = {
    resourceId: input.resourceId,
    kbId: input.kbId,
    ingestionAttemptId: input.ingestionAttemptId,
  }

  try {
    const resource = await dependencies.prisma.kBResource.findUnique({
      where: { id: input.resourceId },
      select: {
        status: true,
        ingestionAttemptId: true,
        resourceVersion: true,
        contentSha256: true,
        mimeType: true,
        externalOperationId: true,
      },
    })
    if (
      !resource ||
      resource.ingestionAttemptId !== input.ingestionAttemptId ||
      resource.resourceVersion !== input.resourceVersion ||
      (resource.status !== KBResourceStatus.QUEUED &&
        resource.status !== KBResourceStatus.PROCESSING)
    ) {
      return undefined
    }
    if (resource.externalOperationId) {
      return resource.externalOperationId
    }

    let source =
      resource.contentSha256 && resource.mimeType
        ? buildKBIngestionSource(
            input,
            resource.mimeType,
            resource.contentSha256,
            env
          )
        : undefined
    if (!source) {
      const prepareSource =
        dependencies.prepareSource ??
        ((sourceInput, sourceEnv) =>
          prepareKBIngestionSource(sourceInput, sourceEnv))
      const preparedSource = await prepareSource(input, env)
      source = await persistPreparedSource({
        input,
        prisma: dependencies.prisma,
        source: preparedSource,
        env,
      })
      if (!source) {
        return undefined
      }
    }

    const client = dependencies.client ?? createKBIngestionApiClient({ env })
    const startedAt = now()
    const operationId = await client.acceptResource({
      resourceId: input.resourceId,
      kbId: input.kbId,
      resourceVersion: input.resourceVersion,
      ingestionAttemptId: input.ingestionAttemptId,
      source,
    })
    const persisted = await dependencies.prisma.kBResource.updateMany({
      where: {
        id: input.resourceId,
        ingestionAttemptId: input.ingestionAttemptId,
        resourceVersion: input.resourceVersion,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
        contentSha256: source.contentSha256,
        externalOperationId: null,
      },
      data: {
        externalOperationId: operationId,
        externalOperationStartedAt: startedAt,
      },
    })
    if (persisted.count !== 1) {
      const currentResource = await dependencies.prisma.kBResource.findUnique({
        where: { id: input.resourceId },
        select: {
          ingestionAttemptId: true,
          resourceVersion: true,
          externalOperationId: true,
        },
      })
      if (
        currentResource?.ingestionAttemptId === input.ingestionAttemptId &&
        currentResource.resourceVersion === input.resourceVersion &&
        currentResource.externalOperationId === operationId
      ) {
        return operationId
      }

      await logErrorBestEffort(
        dependencies.logger,
        'Accepted KB ingestion operation could not be correlated',
        identifiers
      )
      return undefined
    }

    await logInfoBestEffort(
      dependencies.logger,
      'KB ingestion operation accepted',
      identifiers
    )
    return operationId
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'KB ingestion dispatch failed',
      identifiers
    )
    throw new Error('KB ingestion dispatch failed')
  }
}

export async function failKBIngestionDispatch({
  input,
  prisma,
}: {
  input: IngestKBResourceInput
  prisma: KBIngestionPrisma
}): Promise<void> {
  await prisma.kBResource.updateMany({
    where: {
      id: input.resourceId,
      ingestionAttemptId: input.ingestionAttemptId,
      resourceVersion: input.resourceVersion,
      externalOperationId: null,
      status: {
        in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
      },
    },
    data: {
      status: KBResourceStatus.FAILED,
      statusMessage: 'The ingestion operation could not be started.',
    },
  })
}

function mapOperationStatus(
  status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded'
) {
  switch (status) {
    case 'accepted':
      return {
        status: KBResourceStatus.QUEUED,
        statusMessage: null,
        ingestedAt: undefined,
      }
    case 'running':
      return {
        status: KBResourceStatus.PROCESSING,
        statusMessage: null,
        ingestedAt: undefined,
      }
    case 'succeeded':
      return {
        status: KBResourceStatus.READY,
        statusMessage: null,
        ingestedAt: new Date(),
      }
    case 'failed':
      return {
        status: KBResourceStatus.FAILED,
        statusMessage: 'The ingestion operation failed.',
        ingestedAt: undefined,
      }
    case 'superseded':
      return {
        status: KBResourceStatus.FAILED,
        statusMessage: 'The ingestion operation was superseded.',
        ingestedAt: undefined,
      }
  }
}

async function reconcileResource({
  resource,
  client,
  prisma,
  env,
  logger,
}: {
  resource: {
    id: string
    kbId: string
    ingestionAttemptId: string | null
    resourceVersion: number
    contentSha256: string | null
    externalOperationId: string | null
  }
  client: KBIngestionApiClient
  prisma: KBIngestionPrisma
  env: NodeJS.ProcessEnv
  logger?: KBIngestionLogger
}) {
  const { ingestionAttemptId, contentSha256, externalOperationId } = resource
  if (!ingestionAttemptId || !contentSha256 || !externalOperationId) {
    return
  }
  const identifiers = {
    resourceId: resource.id,
    kbId: resource.kbId,
    ingestionAttemptId,
  }

  try {
    const operation = await client.getOperation(externalOperationId)
    if (
      operation.operationId !== externalOperationId ||
      operation.projectId !== getKBIngestionProjectId(env) ||
      operation.producer !== 'klicker' ||
      operation.externalResourceId !== resource.id ||
      operation.resourceVersion !== resource.resourceVersion ||
      operation.expectedSha256 !== contentSha256
    ) {
      await logErrorBestEffort(
        logger,
        'KB ingestion operation correlation failed',
        identifiers
      )
      return
    }

    if (
      operation.status === 'succeeded' &&
      (operation.observedSha256 !== contentSha256 ||
        operation.serving.activeResourceVersion !== resource.resourceVersion ||
        operation.serving.activeSha256 !== contentSha256)
    ) {
      await logErrorBestEffort(
        logger,
        'KB ingestion serving correlation failed',
        identifiers
      )
      return
    }

    const transition = mapOperationStatus(operation.status)
    const sourceStatuses =
      operation.status === 'accepted'
        ? [KBResourceStatus.QUEUED]
        : [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING]
    await prisma.kBResource.updateMany({
      where: {
        id: resource.id,
        ingestionAttemptId,
        resourceVersion: resource.resourceVersion,
        contentSha256,
        externalOperationId,
        status: {
          in: sourceStatuses,
        },
      },
      data: {
        status: transition.status,
        statusMessage: transition.statusMessage,
        ...(transition.ingestedAt ? { ingestedAt: transition.ingestedAt } : {}),
      },
    })
  } catch {
    await logErrorBestEffort(
      logger,
      'KB ingestion operation reconciliation failed',
      identifiers
    )
  }
}

export async function monitorActiveKBIngestions(
  dependencies: MonitorKBIngestionsDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const activeWhere = {
    status: {
      in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
    },
    ingestionAttemptId: { not: null },
    contentSha256: { not: null },
    externalOperationId: { not: null },
  }
  const activeCount = await dependencies.prisma.kBResource.count({
    where: activeWhere,
  })
  if (activeCount === 0) {
    return
  }

  const pollWindow = Math.floor(
    (dependencies.now?.() ?? new Date()).getTime() / 60_000
  )
  const skip =
    ((pollWindow % activeCount) * KB_INGESTION_POLL_LIMIT) % activeCount
  const query = {
    where: activeWhere,
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      kbId: true,
      ingestionAttemptId: true,
      resourceVersion: true,
      contentSha256: true,
      externalOperationId: true,
    },
  }
  const resources = await dependencies.prisma.kBResource.findMany({
    ...query,
    skip,
    take: KB_INGESTION_POLL_LIMIT,
  })
  if (resources.length < KB_INGESTION_POLL_LIMIT && skip > 0) {
    resources.push(
      ...(await dependencies.prisma.kBResource.findMany({
        ...query,
        take: Math.min(KB_INGESTION_POLL_LIMIT - resources.length, skip),
      }))
    )
  }
  const client = dependencies.client ?? createKBIngestionApiClient({ env })

  for (
    let start = 0;
    start < resources.length;
    start += KB_INGESTION_POLL_CONCURRENCY
  ) {
    await Promise.all(
      resources
        .slice(start, start + KB_INGESTION_POLL_CONCURRENCY)
        .map((resource) =>
          reconcileResource({
            resource,
            client,
            prisma: dependencies.prisma,
            env,
            logger: dependencies.logger,
          })
        )
    )
  }
}
