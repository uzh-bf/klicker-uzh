import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  DeleteKBResourceInput,
  IngestKBResourceInput,
} from '@klicker-uzh/types'
import {
  MAX_KB_SOURCE_SIZE_BYTES,
  MAX_KB_TOTAL_SIZE_BYTES,
} from '@klicker-uzh/types'
import {
  buildKBIngestionSource,
  createKBIngestionApiClient,
  getKBIngestionProjectId,
  getKBSourceGatewayOrigin,
  type KBIngestionApiClient,
  type KBIngestionSource,
  prepareKBIngestionSource,
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

type KBIngestionPrisma = PrismaClient

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

export type DispatchKBDeletionDependencies = {
  prisma: KBIngestionPrisma
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
}

async function lockPersistedKbScope(
  prisma: Prisma.TransactionClient,
  input: IngestKBResourceInput
): Promise<boolean> {
  const locked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT kb."id"
    FROM "public"."KB" AS kb
    INNER JOIN "public"."KBResource" AS resource ON resource."kbId" = kb."id"
    WHERE kb."id" = CAST(${input.kbId} AS UUID)
      AND resource."id" = CAST(${input.resourceId} AS UUID)
      AND kb."deletedAt" IS NULL
      AND resource."deletedAt" IS NULL
    FOR UPDATE OF kb
  `
  return locked.length === 1
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
    env.KB_SOURCE_GATEWAY_URL,
  ].filter((value) => value?.trim())
  if (configuredValues.length > 0) {
    createKBIngestionApiClient({ env })
    getKBSourceGatewayOrigin(env)
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
  const persisted = await prisma.$transaction(async (tx) => {
    if (!(await lockPersistedKbScope(tx, input))) {
      return false
    }
    const currentResource = await tx.kBResource.findFirst({
      where: {
        id: input.resourceId,
        kbId: input.kbId,
        deletedAt: null,
        kb: { deletedAt: null },
      },
      select: { sizeBytes: true },
    })
    if (!currentResource) {
      return false
    }
    const [resources, unknownSizeResources, uploadTickets] = await Promise.all([
      tx.kBResource.aggregate({
        where: { kbId: input.kbId },
        _sum: { sizeBytes: true },
      }),
      tx.kBResource.count({
        where: { kbId: input.kbId, sizeBytes: null },
      }),
      tx.kBUploadTicket.aggregate({
        where: { kbId: input.kbId },
        _sum: { sizeBytes: true },
      }),
    ])
    const retainedSizeBytes =
      (resources._sum.sizeBytes ?? 0) +
      unknownSizeResources * MAX_KB_SOURCE_SIZE_BYTES
    const projectedSizeBytes =
      retainedSizeBytes +
      (uploadTickets._sum.sizeBytes ?? 0) -
      (currentResource.sizeBytes ?? MAX_KB_SOURCE_SIZE_BYTES) +
      source.sizeBytes
    if (projectedSizeBytes > MAX_KB_TOTAL_SIZE_BYTES) {
      const finishedAt = new Date()
      const resourceUpdate = await tx.kBResource.updateMany({
        where: {
          id: input.resourceId,
          kbId: input.kbId,
          deletedAt: null,
          ingestionAttemptId: input.ingestionAttemptId,
          resourceVersion: input.resourceVersion,
          status: {
            in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
          },
          externalOperationId: null,
        },
        data: {
          status: KBResourceStatus.FAILED,
          statusMessage: 'The knowledge base storage limit was reached.',
          errorCode: 'KB_STORAGE_LIMIT_REACHED',
        },
      })
      if (resourceUpdate.count === 1) {
        const runUpdate = await tx.kBIngestionRun.updateMany({
          where: {
            id: input.ingestionAttemptId,
            resourceId: input.resourceId,
            operation: KBIngestionOperation.UPSERT,
            resourceVersion: input.resourceVersion,
            status: {
              in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
            },
          },
          data: {
            status: KBIngestionStatus.FAILED,
            statusMessage: 'The knowledge base storage limit was reached.',
            errorCode: 'KB_STORAGE_LIMIT_REACHED',
            finishedAt,
          },
        })
        if (runUpdate.count !== 1) {
          throw new Error('KB ingestion source could not be correlated')
        }
      }
      return false
    }

    const resourceUpdate = await tx.kBResource.updateMany({
      where: {
        id: input.resourceId,
        kbId: input.kbId,
        deletedAt: null,
        kb: { deletedAt: null },
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
        sizeBytes: source.sizeBytes,
      },
    })
    if (resourceUpdate.count !== 1) {
      return false
    }
    const runUpdate = await tx.kBIngestionRun.updateMany({
      where: {
        id: input.ingestionAttemptId,
        resourceId: input.resourceId,
        operation: KBIngestionOperation.UPSERT,
        resourceVersion: input.resourceVersion,
        status: {
          in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: { contentSha256: source.contentSha256 },
    })
    if (runUpdate.count !== 1) {
      throw new Error('KB ingestion source could not be correlated')
    }
    return true
  })
  if (persisted) {
    return source
  }

  const current = await prisma.kBResource.findUnique({
    where: { id: input.resourceId },
    select: {
      ingestionAttemptId: true,
      resourceVersion: true,
      contentSha256: true,
      mimeType: true,
      sizeBytes: true,
      kbId: true,
      deletedAt: true,
      kb: { select: { deletedAt: true } },
    },
  })
  if (
    current?.ingestionAttemptId !== input.ingestionAttemptId ||
    current.resourceVersion !== input.resourceVersion ||
    current.kbId !== input.kbId ||
    current.deletedAt !== null ||
    current.kb.deletedAt !== null ||
    !current.contentSha256 ||
    !current.mimeType ||
    current.sizeBytes === null
  ) {
    return undefined
  }
  return buildKBIngestionSource(
    input,
    current.mimeType,
    current.contentSha256,
    current.sizeBytes,
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
        sizeBytes: true,
        kbId: true,
        deletedAt: true,
        kb: { select: { deletedAt: true } },
        externalOperationId: true,
      },
    })
    if (
      !resource ||
      resource.kbId !== input.kbId ||
      resource.deletedAt !== null ||
      resource.kb.deletedAt !== null ||
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
      resource.contentSha256 && resource.mimeType && resource.sizeBytes
        ? buildKBIngestionSource(
            input,
            resource.mimeType,
            resource.contentSha256,
            resource.sizeBytes,
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
    const persisted = await dependencies.prisma.$transaction(async (tx) => {
      const resourceUpdate = await tx.kBResource.updateMany({
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
      if (resourceUpdate.count !== 1) {
        return false
      }
      const runUpdate = await tx.kBIngestionRun.updateMany({
        where: {
          id: input.ingestionAttemptId,
          resourceId: input.resourceId,
          resourceVersion: input.resourceVersion,
          status: {
            in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
          },
        },
        data: {
          externalOperationId: operationId,
          startedAt,
        },
      })
      if (runUpdate.count !== 1) {
        throw new Error('KB ingestion operation could not be correlated')
      }
      return true
    })
    if (!persisted) {
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
  const finishedAt = new Date()
  await prisma.$transaction(async (tx) => {
    const resourceUpdate = await tx.kBResource.updateMany({
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
        errorCode: 'INGESTION_DISPATCH_FAILED',
      },
    })
    if (resourceUpdate.count !== 1) {
      return
    }
    const runUpdate = await tx.kBIngestionRun.updateMany({
      where: {
        id: input.ingestionAttemptId,
        resourceId: input.resourceId,
        operation: KBIngestionOperation.UPSERT,
        resourceVersion: input.resourceVersion,
        status: {
          in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        status: KBIngestionStatus.FAILED,
        statusMessage: 'The ingestion operation could not be started.',
        errorCode: 'INGESTION_DISPATCH_FAILED',
        finishedAt,
      },
    })
    if (runUpdate.count !== 1) {
      throw new Error('KB ingestion dispatch failure could not be correlated')
    }
  })
}

export async function dispatchKBDeletion(
  input: DeleteKBResourceInput,
  dependencies: DispatchKBDeletionDependencies
): Promise<string | undefined> {
  const env = dependencies.env ?? process.env
  const identifiers = {
    resourceId: input.resourceId,
    kbId: input.kbId,
    deletionAttemptId: input.deletionAttemptId,
  }

  try {
    const resource = await dependencies.prisma.kBResource.findUnique({
      where: { id: input.resourceId },
      select: {
        kbId: true,
        deletedAt: true,
        ingestionOperation: true,
        ingestionAttemptId: true,
        resourceVersion: true,
        externalOperationId: true,
      },
    })
    if (
      !resource?.deletedAt ||
      resource.kbId !== input.kbId ||
      resource.ingestionOperation !== KBIngestionOperation.DELETE ||
      resource.ingestionAttemptId !== input.deletionAttemptId ||
      resource.resourceVersion !== input.resourceVersion
    ) {
      return undefined
    }
    if (resource.externalOperationId) {
      return resource.externalOperationId
    }

    const client = dependencies.client ?? createKBIngestionApiClient({ env })
    const startedAt = (dependencies.now ?? (() => new Date()))()
    const operationId = await client.deleteResource(input)
    const persisted = await dependencies.prisma.$transaction(async (tx) => {
      const resourceUpdate = await tx.kBResource.updateMany({
        where: {
          id: input.resourceId,
          deletedAt: { not: null },
          ingestionOperation: KBIngestionOperation.DELETE,
          ingestionAttemptId: input.deletionAttemptId,
          resourceVersion: input.resourceVersion,
          externalOperationId: null,
        },
        data: {
          externalOperationId: operationId,
          externalOperationStartedAt: startedAt,
          statusMessage: null,
          errorCode: null,
        },
      })
      if (resourceUpdate.count !== 1) {
        return false
      }
      const runUpdate = await tx.kBIngestionRun.updateMany({
        where: {
          id: input.deletionAttemptId,
          resourceId: input.resourceId,
          operation: KBIngestionOperation.DELETE,
          resourceVersion: input.resourceVersion,
          status: {
            in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
          },
        },
        data: {
          externalOperationId: operationId,
          startedAt,
          statusMessage: null,
          errorCode: null,
        },
      })
      if (runUpdate.count !== 1) {
        throw new Error('KB deletion operation could not be correlated')
      }
      return true
    })
    if (!persisted) {
      const current = await dependencies.prisma.kBResource.findUnique({
        where: { id: input.resourceId },
        select: {
          ingestionAttemptId: true,
          resourceVersion: true,
          externalOperationId: true,
        },
      })
      if (
        current?.ingestionAttemptId === input.deletionAttemptId &&
        current?.resourceVersion === input.resourceVersion &&
        current?.externalOperationId === operationId
      ) {
        return operationId
      }
      await logErrorBestEffort(
        dependencies.logger,
        'Accepted KB deletion operation could not be correlated',
        identifiers
      )
      return undefined
    }

    await logInfoBestEffort(
      dependencies.logger,
      'KB deletion operation accepted',
      identifiers
    )
    return operationId
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'KB deletion dispatch failed',
      identifiers
    )
    throw new Error('KB deletion dispatch failed')
  }
}

export async function retainFailedKBDeletionDispatch({
  input,
  prisma,
}: {
  input: DeleteKBResourceInput
  prisma: KBIngestionPrisma
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const resourceUpdate = await tx.kBResource.updateMany({
      where: {
        id: input.resourceId,
        deletedAt: { not: null },
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: input.deletionAttemptId,
        resourceVersion: input.resourceVersion,
        externalOperationId: null,
      },
      data: {
        status: KBResourceStatus.QUEUED,
        statusMessage: 'The deletion operation is awaiting retry.',
        errorCode: 'DELETION_DISPATCH_FAILED',
      },
    })
    if (resourceUpdate.count !== 1) {
      return
    }
    const runUpdate = await tx.kBIngestionRun.updateMany({
      where: {
        id: input.deletionAttemptId,
        resourceId: input.resourceId,
        operation: KBIngestionOperation.DELETE,
        resourceVersion: input.resourceVersion,
        status: {
          in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        status: KBIngestionStatus.QUEUED,
        statusMessage: 'The deletion operation is awaiting retry.',
        errorCode: 'DELETION_DISPATCH_FAILED',
      },
    })
    if (runUpdate.count !== 1) {
      throw new Error('KB deletion retry state could not be correlated')
    }
  })
}

function mapOperationStatus(
  status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded'
) {
  switch (status) {
    case 'accepted':
      return {
        resourceStatus: KBResourceStatus.QUEUED,
        runStatus: KBIngestionStatus.QUEUED,
        statusMessage: null,
        terminal: false,
      }
    case 'running':
      return {
        resourceStatus: KBResourceStatus.PROCESSING,
        runStatus: KBIngestionStatus.PROCESSING,
        statusMessage: null,
        terminal: false,
      }
    case 'succeeded':
      return {
        resourceStatus: KBResourceStatus.READY,
        runStatus: KBIngestionStatus.SUCCEEDED,
        statusMessage: null,
        terminal: true,
      }
    case 'failed':
      return {
        resourceStatus: KBResourceStatus.FAILED,
        runStatus: KBIngestionStatus.FAILED,
        statusMessage: 'The ingestion operation failed.',
        terminal: true,
      }
    case 'superseded':
      return {
        resourceStatus: KBResourceStatus.FAILED,
        runStatus: KBIngestionStatus.SUPERSEDED,
        statusMessage: 'The ingestion operation was superseded.',
        terminal: true,
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
    ingestionOperation: KBIngestionOperation
  }
  client: KBIngestionApiClient
  prisma: KBIngestionPrisma
  env: NodeJS.ProcessEnv
  logger?: KBIngestionLogger
}) {
  const { ingestionAttemptId, contentSha256, externalOperationId } = resource
  const ingestionOperation =
    resource.ingestionOperation ?? KBIngestionOperation.UPSERT
  if (
    !ingestionAttemptId ||
    !externalOperationId ||
    (ingestionOperation === KBIngestionOperation.UPSERT && !contentSha256)
  ) {
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
      operation.expectedSha256 !==
        (ingestionOperation === KBIngestionOperation.DELETE
          ? null
          : contentSha256) ||
      (ingestionOperation === KBIngestionOperation.DELETE
        ? operation.operation !== 'delete'
        : operation.operation === 'delete')
    ) {
      await logErrorBestEffort(
        logger,
        'KB ingestion operation correlation failed',
        identifiers
      )
      return
    }

    if (
      ingestionOperation === KBIngestionOperation.UPSERT &&
      operation.status === 'succeeded' &&
      operation.observedSha256 !== contentSha256
    ) {
      await logErrorBestEffort(
        logger,
        'KB ingestion observed digest correlation failed',
        identifiers
      )
      return
    }

    const transition = mapOperationStatus(operation.status)
    const servingMatchesCurrent =
      ingestionOperation === KBIngestionOperation.DELETE
        ? operation.serving.activeResourceVersion === null &&
          operation.serving.activeSha256 === null
        : operation.serving.activeResourceVersion ===
            resource.resourceVersion &&
          operation.serving.activeSha256 === contentSha256
    if (operation.status === 'succeeded' && !servingMatchesCurrent) {
      await logInfoBestEffort(
        logger,
        'KB ingestion succeeded while serving cutover is pending',
        identifiers
      )
    }
    const resourceStatus =
      operation.status === 'succeeded' && !servingMatchesCurrent
        ? KBResourceStatus.PROCESSING
        : transition.resourceStatus
    const sourceStatuses =
      operation.status === 'accepted'
        ? [KBResourceStatus.QUEUED]
        : [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING]
    const sourceRunStatuses =
      operation.status === 'accepted'
        ? [KBIngestionStatus.QUEUED]
        : operation.status === 'succeeded'
          ? [
              KBIngestionStatus.QUEUED,
              KBIngestionStatus.PROCESSING,
              KBIngestionStatus.SUCCEEDED,
            ]
          : [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING]
    const operationUpdatedAt = new Date(operation.updatedAt)
    await prisma.$transaction(async (tx) => {
      const resourceUpdate = await tx.kBResource.updateMany({
        where: {
          id: resource.id,
          ingestionAttemptId,
          resourceVersion: resource.resourceVersion,
          contentSha256:
            ingestionOperation === KBIngestionOperation.DELETE
              ? null
              : contentSha256,
          externalOperationId,
          ingestionOperation,
          status: {
            in: sourceStatuses,
          },
        },
        data: {
          status: resourceStatus,
          statusMessage: transition.statusMessage,
          errorCode: operation.errorCode,
          activeResourceVersion: operation.serving.activeResourceVersion,
          activeContentSha256: operation.serving.activeSha256,
          ...(resourceStatus === KBResourceStatus.READY
            ? { ingestedAt: operationUpdatedAt }
            : {}),
        },
      })
      if (resourceUpdate.count !== 1) {
        return
      }
      const runUpdate = await tx.kBIngestionRun.updateMany({
        where: {
          id: ingestionAttemptId,
          resourceId: resource.id,
          operation: ingestionOperation,
          resourceVersion: resource.resourceVersion,
          status: { in: sourceRunStatuses },
        },
        data: {
          status: transition.runStatus,
          statusMessage: transition.statusMessage,
          errorCode: operation.errorCode,
          ...(transition.terminal ? { finishedAt: operationUpdatedAt } : {}),
        },
      })
      if (runUpdate.count !== 1) {
        throw new Error('KB ingestion operation state could not be correlated')
      }
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
    externalOperationId: { not: null },
    OR: [
      {
        ingestionOperation: KBIngestionOperation.UPSERT,
        contentSha256: { not: null },
        deletedAt: null,
      },
      {
        ingestionOperation: KBIngestionOperation.DELETE,
        deletedAt: { not: null },
      },
    ],
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
      ingestionOperation: true,
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
