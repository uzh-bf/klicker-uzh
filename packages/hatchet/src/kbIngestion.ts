import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import { KBResourceStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  IngestKBResourceInput,
  KBIngestionModelId,
} from '@klicker-uzh/types'
import { signKBIngestionWebhook } from '@klicker-uzh/util'

const DEFAULT_KB_INGESTION_TIMEOUT_SECONDS = 3600
const KB_BLOB_SAS_CLOCK_SKEW_MS = 5 * 60 * 1000
const KB_BLOB_SAS_VALIDITY_MS = 60 * 60 * 1000
// This duration may need adjustment for larger files or slower ingestion workflows in future modifications.

export const KB_INGESTION_ATTEMPT_METADATA_KEY = 'klickerKBIngestionAttemptId'

type ExternalHatchetTLSStrategy = 'tls' | 'mtls' | 'none'

export type ExternalHatchetConfig = {
  client: {
    token: string
    host_port: string
    api_url: string
    namespace: ''
    tls_config: { tls_strategy: ExternalHatchetTLSStrategy }
  }
  workflowName: string
}

export type ExternalHatchetClient = {
  runNoWait: (
    workflowName: string,
    input: ExternalKBIngestionPayload,
    options: { additionalMetadata: Record<string, string> }
  ) => Promise<{ getWorkflowRunId: () => Promise<string> }>
  runs: {
    get_status: (runId: string) => Promise<ExternalHatchetStatus>
    list: (options: {
      workflowNames: string[]
      additionalMetadata: Record<string, string>
      onlyTasks: boolean
      includePayloads: boolean
      limit: number
      since: Date
    }) => Promise<{
      rows: Array<{
        workflowRunExternalId: string
        createdAt: string
        additionalMetadata?: Record<string, unknown>
      }>
    }>
    cancel: (options: { ids: string[] }) => Promise<unknown>
  }
}

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

export type ExternalHatchetStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type KBIngestionStatusPayload = {
  resourceId: string
  ingestionAttemptId: string
  status: 'PROCESSING' | 'READY' | 'FAILED'
  statusMessage?: string
}

type KBIngestionFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Pick<Response, 'ok'>>

export type DispatchKBIngestionDependencies = {
  prisma: KBIngestionPrisma
  client?: ExternalHatchetClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
}

export type SendKBIngestionStatusDependencies = {
  env?: NodeJS.ProcessEnv
  now?: () => Date
  fetch?: KBIngestionFetch
}

export type MonitorKBIngestionsDependencies = {
  prisma: KBIngestionPrisma
  client?: ExternalHatchetClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
  sendStatus?: (payload: KBIngestionStatusPayload) => Promise<void>
}

export type ExternalKBIngestionPayload = {
  course_id: string
  sources: Array<{ source_id: string; source_url: string }>
  upload_markdown: true
  export_to_falkordb: true
  falkordb_graph_name: string
  speed_mode: IngestKBResourceInput['speedMode']
  generation_model?: KBIngestionModelId
  cleaning_model?: KBIngestionModelId
}

export type KBIngestionSourceInput =
  | {
      type: 'BLOB'
      blobName: string
      containerName: string
    }
  | {
      type: 'URL'
      sourceUrl: string
    }

export type RecoveredExternalKBIngestionRun = {
  runId: string
  startedAt: Date
}

let externalHatchetClient: ExternalHatchetClient | undefined

function requireEnvironmentVariable(
  env: NodeJS.ProcessEnv,
  name: string
): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`${name} must be configured`)
  }
  return value
}

export function getKBIngestionTimeoutSeconds(
  env: NodeJS.ProcessEnv = process.env
): number {
  const configuredValue = env.KB_INGESTION_TIMEOUT_SECONDS
  if (configuredValue === undefined) {
    return DEFAULT_KB_INGESTION_TIMEOUT_SECONDS
  }
  if (!/^[1-9]\d*$/.test(configuredValue)) {
    throw new Error('KB_INGESTION_TIMEOUT_SECONDS must be a positive integer')
  }

  const timeoutSeconds = Number(configuredValue)
  if (!Number.isSafeInteger(timeoutSeconds)) {
    throw new Error('KB_INGESTION_TIMEOUT_SECONDS must be a positive integer')
  }
  return timeoutSeconds
}

export function getExternalHatchetConfig(
  env: NodeJS.ProcessEnv = process.env
): ExternalHatchetConfig {
  const tlsStrategy = requireEnvironmentVariable(
    env,
    'KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY'
  )
  if (
    tlsStrategy !== 'tls' &&
    tlsStrategy !== 'mtls' &&
    tlsStrategy !== 'none'
  ) {
    throw new Error(
      'KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY must be tls, mtls, or none'
    )
  }

  return {
    client: {
      token: requireEnvironmentVariable(
        env,
        'KB_INGESTION_HATCHET_CLIENT_TOKEN'
      ),
      host_port: requireEnvironmentVariable(
        env,
        'KB_INGESTION_HATCHET_CLIENT_HOST_PORT'
      ),
      api_url: requireEnvironmentVariable(env, 'KB_INGESTION_HATCHET_API_URL'),
      namespace: '',
      tls_config: { tls_strategy: tlsStrategy },
    },
    workflowName: requireEnvironmentVariable(
      env,
      'KB_INGESTION_HATCHET_WORKFLOW_NAME'
    ),
  }
}

export function validateKBIngestionWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  getKBIngestionTimeoutSeconds(env)
}

export function getExternalHatchetClient(
  env: NodeJS.ProcessEnv = process.env
): ExternalHatchetClient {
  if (!externalHatchetClient) {
    const config = getExternalHatchetConfig(env)
    externalHatchetClient = HatchetClient.init(
      config.client
    ) as ExternalHatchetClient
  }
  return externalHatchetClient
}

export async function sendKBIngestionStatus(
  payload: KBIngestionStatusPayload,
  dependencies: SendKBIngestionStatusDependencies = {}
): Promise<void> {
  const env = dependencies.env ?? process.env
  const webhookUrl = requireEnvironmentVariable(env, 'KB_WEBHOOK_URL')
  const webhookSecret = requireEnvironmentVariable(env, 'KB_WEBHOOK_SECRET')
  const now = dependencies.now ?? (() => new Date())
  const fetchRequest = dependencies.fetch ?? fetch
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8')
  const signatureHeaders = signKBIngestionWebhook({
    rawBody,
    secret: webhookSecret,
    timestamp: Math.floor(now().getTime() / 1000),
  })

  try {
    const response = await fetchRequest(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...signatureHeaders,
      },
      body: rawBody,
    })
    if (!response.ok) {
      throw new Error('Webhook returned a non-success status')
    }
  } catch {
    throw new Error('KB ingestion status webhook failed')
  }
}

export function buildExternalKBIngestionPayload(
  input: IngestKBResourceInput,
  sourceUrl: string
): ExternalKBIngestionPayload {
  return {
    course_id: input.kbId,
    sources: [
      {
        source_id: input.resourceId,
        source_url: sourceUrl,
      },
    ],
    upload_markdown: true,
    export_to_falkordb: true,
    falkordb_graph_name: `klickeruzh:${input.kbId}`,
    speed_mode: input.speedMode,
  }
}

export function getKBIngestionSourceUrl(
  input: KBIngestionSourceInput,
  {
    env = process.env,
    now = () => new Date(),
  }: { env?: NodeJS.ProcessEnv; now?: () => Date } = {}
): string {
  if (input.type === 'URL') {
    return input.sourceUrl
  }

  const accountName = requireEnvironmentVariable(
    env,
    'BLOB_STORAGE_ACCOUNT_NAME'
  )
  const accessKey = requireEnvironmentVariable(env, 'BLOB_STORAGE_ACCESS_KEY')
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const serviceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  )
  const blobClient = serviceClient
    .getContainerClient(input.containerName)
    .getBlobClient(input.blobName)
  const currentTime = now()
  const sas = generateBlobSASQueryParameters(
    {
      containerName: input.containerName,
      blobName: input.blobName,
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      startsOn: new Date(currentTime.getTime() - KB_BLOB_SAS_CLOCK_SKEW_MS),
      expiresOn: new Date(currentTime.getTime() + KB_BLOB_SAS_VALIDITY_MS),
    },
    credential
  ).toString()

  return `${blobClient.url}?${sas}`
}

export async function recoverExternalKBIngestionRun({
  client,
  workflowName,
  additionalMetadata,
  primaryMetadataKey,
  recoveryAnchor,
}: {
  client: ExternalHatchetClient
  workflowName: string
  additionalMetadata: Record<string, string>
  primaryMetadataKey: string
  recoveryAnchor: Date
}): Promise<RecoveredExternalKBIngestionRun | undefined> {
  const primaryMetadataValue = additionalMetadata[primaryMetadataKey]
  if (!primaryMetadataValue) {
    throw new Error('Primary KB ingestion recovery metadata is missing')
  }

  const existingRuns = await client.runs.list({
    workflowNames: [workflowName],
    // Hatchet combines multiple metadata filters with OR semantics. Query by the
    // unique attempt identifier, then verify the complete metadata set locally.
    additionalMetadata: { [primaryMetadataKey]: primaryMetadataValue },
    onlyTasks: false,
    includePayloads: false,
    limit: 1,
    since: new Date(recoveryAnchor.getTime() - KB_BLOB_SAS_CLOCK_SKEW_MS),
  })
  const recoveredRun = existingRuns.rows.find((run) =>
    Object.entries(additionalMetadata).every(
      ([key, value]) => run.additionalMetadata?.[key] === value
    )
  )
  if (!recoveredRun) return undefined

  return {
    runId: recoveredRun.workflowRunExternalId,
    startedAt: new Date(recoveredRun.createdAt),
  }
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

export async function cancelExternalKBIngestionRunBestEffort({
  client,
  runId,
  identifiers,
  logger,
}: {
  client: ExternalHatchetClient
  runId: string
  identifiers: Record<string, string>
  logger?: KBIngestionLogger
}): Promise<void> {
  try {
    await client.runs.cancel({ ids: [runId] })
  } catch {
    await logErrorBestEffort(
      logger,
      'External KB ingestion cancellation failed',
      identifiers
    )
  }
}

export async function monitorActiveKBIngestions(
  dependencies: MonitorKBIngestionsDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const timeoutMilliseconds = getKBIngestionTimeoutSeconds(env) * 1000
  const sendStatus =
    dependencies.sendStatus ??
    ((payload: KBIngestionStatusPayload) =>
      sendKBIngestionStatus(payload, { env, now }))
  const resources = await dependencies.prisma.kBResource.findMany({
    where: {
      status: {
        in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
      },
      ingestionAttemptId: { not: null },
      externalWorkflowRunId: { not: null },
      externalWorkflowStartedAt: { not: null },
    },
    select: {
      id: true,
      kbId: true,
      ingestionAttemptId: true,
      externalWorkflowRunId: true,
      externalWorkflowStartedAt: true,
    },
  })
  if (resources.length === 0) {
    return
  }
  const client = dependencies.client ?? getExternalHatchetClient(env)

  for (const resource of resources) {
    const {
      ingestionAttemptId,
      externalWorkflowRunId,
      externalWorkflowStartedAt,
    } = resource
    if (
      !ingestionAttemptId ||
      !externalWorkflowRunId ||
      !externalWorkflowStartedAt
    ) {
      continue
    }

    const identifiers = {
      resourceId: resource.id,
      kbId: resource.kbId,
      ingestionAttemptId,
    }
    const statusPayload = (
      status: KBIngestionStatusPayload['status'],
      statusMessage?: string
    ): KBIngestionStatusPayload => ({
      resourceId: resource.id,
      ingestionAttemptId,
      status,
      ...(statusMessage ? { statusMessage } : {}),
    })

    try {
      const externalStatus = await client.runs.get_status(externalWorkflowRunId)

      if (externalStatus === 'COMPLETED') {
        await sendStatus(statusPayload('READY'))
        continue
      }
      if (externalStatus === 'FAILED') {
        await sendStatus(
          statusPayload('FAILED', 'External ingestion workflow failed.')
        )
        continue
      }
      if (externalStatus === 'CANCELLED') {
        await sendStatus(
          statusPayload('FAILED', 'External ingestion workflow was cancelled.')
        )
        continue
      }

      const elapsedMilliseconds =
        now().getTime() - externalWorkflowStartedAt.getTime()
      if (elapsedMilliseconds > timeoutMilliseconds) {
        try {
          await client.runs.cancel({ ids: [externalWorkflowRunId] })
        } catch {
          await logErrorBestEffort(
            dependencies.logger,
            'External KB ingestion timeout cancellation failed',
            identifiers
          )
        }
        await sendStatus(
          statusPayload('FAILED', 'External ingestion timed out.')
        )
        continue
      }

      if (externalStatus === 'RUNNING') {
        await sendStatus(statusPayload('PROCESSING'))
      }
    } catch {
      await logErrorBestEffort(
        dependencies.logger,
        'External KB ingestion monitor failed',
        identifiers
      )
    }
  }
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
        updatedAt: true,
        ingestionAttemptId: true,
        externalWorkflowRunId: true,
      },
    })
    if (
      !resource ||
      resource.ingestionAttemptId !== input.ingestionAttemptId ||
      (resource.status !== KBResourceStatus.QUEUED &&
        resource.status !== KBResourceStatus.PROCESSING)
    ) {
      return undefined
    }
    if (resource.externalWorkflowRunId) {
      return resource.externalWorkflowRunId
    }

    const config = getExternalHatchetConfig(env)
    const client = dependencies.client ?? getExternalHatchetClient(env)
    const additionalMetadata = {
      [KB_INGESTION_ATTEMPT_METADATA_KEY]: input.ingestionAttemptId,
    }
    const recoveredRun = await recoverExternalKBIngestionRun({
      client,
      workflowName: config.workflowName,
      additionalMetadata,
      primaryMetadataKey: KB_INGESTION_ATTEMPT_METADATA_KEY,
      recoveryAnchor: resource.updatedAt,
    })

    let runId: string
    let startedAt: Date
    if (recoveredRun) {
      runId = recoveredRun.runId
      startedAt = recoveredRun.startedAt
    } else {
      const sourceUrl = getKBIngestionSourceUrl(input, { env, now })
      const payload = buildExternalKBIngestionPayload(input, sourceUrl)
      startedAt = now()
      const run = await client.runNoWait(config.workflowName, payload, {
        additionalMetadata,
      })
      runId = await run.getWorkflowRunId()
    }

    const persisted = await dependencies.prisma.kBResource.updateMany({
      where: {
        id: input.resourceId,
        ingestionAttemptId: input.ingestionAttemptId,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
        externalWorkflowRunId: null,
      },
      data: {
        externalWorkflowRunId: runId,
        externalWorkflowStartedAt: startedAt,
      },
    })
    if (persisted.count !== 1) {
      const currentResource = await dependencies.prisma.kBResource.findUnique({
        where: { id: input.resourceId },
        select: {
          ingestionAttemptId: true,
          externalWorkflowRunId: true,
        },
      })
      if (
        currentResource?.ingestionAttemptId === input.ingestionAttemptId &&
        currentResource.externalWorkflowRunId === runId
      ) {
        return runId
      }

      await cancelExternalKBIngestionRunBestEffort({
        client,
        runId,
        identifiers,
        logger: dependencies.logger,
      })
      return undefined
    }

    await logInfoBestEffort(
      dependencies.logger,
      'External KB ingestion dispatched',
      identifiers
    )
    return runId
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'External KB ingestion dispatch failed',
      identifiers
    )
    throw new Error('External KB ingestion dispatch failed')
  }
}
