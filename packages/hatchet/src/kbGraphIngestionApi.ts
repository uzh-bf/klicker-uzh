import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import { getKnowledgeGraphConfig } from '@klicker-uzh/knowledge-graph'
import {
  KBGraphQualityTier,
  KBResourceType,
  type KBGraphBuildSource,
} from '@klicker-uzh/prisma/client'
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'

const DEFAULT_KB_GRAPH_TIMEOUT_SECONDS = 6 * 60 * 60
const KB_GRAPH_BLOB_SAS_CLOCK_SKEW_MS = 5 * 60 * 1000
const KB_GRAPH_ARTIFACT_PREFIX = 'knowledge-graphs'
// Only chart-owned (ConfigMap) keys may arm the all-or-nothing startup gate.
// `KB_GRAPH_HATCHET_CLIENT_TOKEN` lives in the out-of-repo general-worker secret,
// so listing it would let a secret rollout on its own halt every unrelated job on
// that worker before the chart values completing the configuration have landed.
// Once one of these keys is set the token is still required.
const KB_GRAPH_CONFIGURATION_ENVIRONMENT_VARIABLES = [
  'KB_GRAPH_HATCHET_CLIENT_HOST_PORT',
  'KB_GRAPH_HATCHET_API_URL',
  'KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY',
  'KB_GRAPH_HATCHET_WORKFLOW_NAME',
  'KB_GRAPH_TIMEOUT_SECONDS',
  'KB_GRAPH_STANDARD_GENERATION_MODEL',
  'KB_GRAPH_STANDARD_CLEANING_MODEL',
  'KB_GRAPH_HIGH_GENERATION_MODEL',
  'KB_GRAPH_HIGH_CLEANING_MODEL',
] as const

export const KB_GRAPH_BUILD_METADATA_KEY = 'klickerKBGraphBuildId'
export const KB_GRAPH_KB_METADATA_KEY = 'klickerKBGraphKbId'

type ExternalHatchetTLSStrategy = 'tls' | 'mtls' | 'none'

export type ExternalKBGraphPayload = {
  course_id: string
  storage_name: string
  sources: Array<{
    source_id: string
    source_url: string
    expected_content_sha256: string
  }>
  upload_markdown: false
  export_to_falkordb: true
  falkordb_graph_name: string
  speed_mode: 'balanced' | 'quality'
  generation_model: string
  cleaning_model: string
  klicker_graph_build: {
    build_id: string
    kb_id: string
    owner_id: string
    source_content_digest: string
    graphml_container_name: string
    graphml_blob_name: string
  }
}

export type ExternalKBGraphStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type ExternalKBGraphClient = {
  runNoWait: (
    workflowName: string,
    input: ExternalKBGraphPayload,
    options: { additionalMetadata: Record<string, string> }
  ) => Promise<{ getWorkflowRunId: () => Promise<string> }>
  runs: {
    get: (runId: string) => Promise<{
      run: { output: unknown }
    }>
    get_status: (runId: string) => Promise<ExternalKBGraphStatus>
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

export type KBGraphLogger = {
  info?: (
    message: string,
    metadata?: Record<string, string>
  ) => unknown | Promise<unknown>
  error?: (
    message: string,
    metadata?: Record<string, string>
  ) => unknown | Promise<unknown>
}

export type ExternalKBGraphConfig = {
  client: {
    token: string
    host_port: string
    api_url: string
    namespace: ''
    tls_config: { tls_strategy: ExternalHatchetTLSStrategy }
  }
  workflowName: string
}

export type KBGraphQualityConfig = {
  speedMode: 'balanced' | 'quality'
  generationModel: string
  cleaningModel: string
}

export type RecoveredExternalKBGraphRun = {
  runId: string
  startedAt: Date
}

let externalKBGraphClient: ExternalKBGraphClient | undefined

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

export function getKBGraphArtifactBlobName(buildId: string): string {
  return `${KB_GRAPH_ARTIFACT_PREFIX}/${buildId}.graphml`
}

export function getKBGraphOwnerContainerName(ownerId: string): string {
  return `kb-${ownerId}`
}

export function getKBGraphTimeoutSeconds(
  env: NodeJS.ProcessEnv = process.env
): number {
  const configuredValue = env.KB_GRAPH_TIMEOUT_SECONDS
  if (configuredValue === undefined) {
    return DEFAULT_KB_GRAPH_TIMEOUT_SECONDS
  }
  if (!/^[1-9]\d*$/.test(configuredValue)) {
    throw new Error('KB_GRAPH_TIMEOUT_SECONDS must be a positive integer')
  }

  const timeoutSeconds = Number(configuredValue)
  if (!Number.isSafeInteger(timeoutSeconds)) {
    throw new Error('KB_GRAPH_TIMEOUT_SECONDS must be a positive integer')
  }
  return timeoutSeconds
}

export function getExternalKBGraphConfig(
  env: NodeJS.ProcessEnv = process.env
): ExternalKBGraphConfig {
  const tlsStrategy = requireEnvironmentVariable(
    env,
    'KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY'
  )
  if (
    tlsStrategy !== 'tls' &&
    tlsStrategy !== 'mtls' &&
    tlsStrategy !== 'none'
  ) {
    throw new Error(
      'KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY must be tls, mtls, or none'
    )
  }

  return {
    client: {
      token: requireEnvironmentVariable(env, 'KB_GRAPH_HATCHET_CLIENT_TOKEN'),
      host_port: requireEnvironmentVariable(
        env,
        'KB_GRAPH_HATCHET_CLIENT_HOST_PORT'
      ),
      api_url: requireEnvironmentVariable(env, 'KB_GRAPH_HATCHET_API_URL'),
      namespace: '',
      tls_config: { tls_strategy: tlsStrategy },
    },
    workflowName: requireEnvironmentVariable(
      env,
      'KB_GRAPH_HATCHET_WORKFLOW_NAME'
    ),
  }
}

export function getKBGraphQualityConfig(
  qualityTier: KBGraphQualityTier,
  env: NodeJS.ProcessEnv = process.env
): KBGraphQualityConfig {
  switch (qualityTier) {
    case KBGraphQualityTier.STANDARD:
      return {
        speedMode: 'balanced',
        generationModel: requireEnvironmentVariable(
          env,
          'KB_GRAPH_STANDARD_GENERATION_MODEL'
        ),
        cleaningModel: requireEnvironmentVariable(
          env,
          'KB_GRAPH_STANDARD_CLEANING_MODEL'
        ),
      }
    case KBGraphQualityTier.HIGH:
      return {
        speedMode: 'quality',
        generationModel: requireEnvironmentVariable(
          env,
          'KB_GRAPH_HIGH_GENERATION_MODEL'
        ),
        cleaningModel: requireEnvironmentVariable(
          env,
          'KB_GRAPH_HIGH_CLEANING_MODEL'
        ),
      }
  }
}

/**
 * Keep the existing worker usable before graph integration is configured, but
 * fail its startup on an incomplete graph configuration instead of consuming
 * lecturer-triggered build retries with a predictable environment error.
 */
export function validateKBGraphWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  const graphIntegrationConfigured =
    KB_GRAPH_CONFIGURATION_ENVIRONMENT_VARIABLES.some((name) =>
      env[name]?.trim()
    )
  if (!graphIntegrationConfigured) {
    return
  }

  getExternalKBGraphConfig(env)
  getKnowledgeGraphConfig(env)
  getKBGraphTimeoutSeconds(env)
  getKBGraphQualityConfig(KBGraphQualityTier.STANDARD, env)
  getKBGraphQualityConfig(KBGraphQualityTier.HIGH, env)
}

export function getExternalKBGraphClient(
  env: NodeJS.ProcessEnv = process.env
): ExternalKBGraphClient {
  if (!externalKBGraphClient) {
    externalKBGraphClient = HatchetClient.init(
      getExternalKBGraphConfig(env).client
    ) as ExternalKBGraphClient
  }
  return externalKBGraphClient
}

export async function getKBGraphTerminalResult(
  runId: string,
  client: ExternalKBGraphClient = getExternalKBGraphClient()
): Promise<unknown> {
  const details = await client.runs.get(runId)
  return details.run.output
}

export function getKBGraphSourceUrl(
  source: Pick<KBGraphBuildSource, 'type' | 'sourceUrl' | 'blobName'>,
  {
    ownerId,
    env = process.env,
    now = () => new Date(),
  }: {
    ownerId: string
    env?: NodeJS.ProcessEnv
    now?: () => Date
  }
): string {
  if (source.type === KBResourceType.URL) {
    if (!source.sourceUrl) {
      throw new Error('KB graph URL source is invalid')
    }
    return source.sourceUrl
  }
  if (source.type !== KBResourceType.BLOB || !source.blobName) {
    throw new Error('KB graph blob source is invalid')
  }

  const accountName = requireEnvironmentVariable(
    env,
    'BLOB_STORAGE_ACCOUNT_NAME'
  )
  const accessKey = requireEnvironmentVariable(env, 'BLOB_STORAGE_ACCESS_KEY')
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  // The external LightRAG worker needs the public account URL; never hand it a
  // cluster-internal Blob endpoint.
  const serviceClient = new BlobServiceClient(
    getBlobStorageAccountUrl(accountName, env.BLOB_STORAGE_ACCOUNT_URL),
    credential
  )
  const containerName = getKBGraphOwnerContainerName(ownerId)
  const blobClient = serviceClient
    .getContainerClient(containerName)
    .getBlobClient(source.blobName)
  const currentTime = now()
  const expiresOn = new Date(
    currentTime.getTime() +
      (getKBGraphTimeoutSeconds(env) * 1000 + KB_GRAPH_BLOB_SAS_CLOCK_SKEW_MS)
  )
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: source.blobName,
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      startsOn: new Date(
        currentTime.getTime() - KB_GRAPH_BLOB_SAS_CLOCK_SKEW_MS
      ),
      expiresOn,
    },
    credential
  ).toString()

  return `${blobClient.url}?${sas}`
}

export async function recoverExternalKBGraphRun({
  client,
  workflowName,
  additionalMetadata,
  recoveryAnchor,
}: {
  client: ExternalKBGraphClient
  workflowName: string
  additionalMetadata: Record<string, string>
  recoveryAnchor: Date
}): Promise<RecoveredExternalKBGraphRun | undefined> {
  const buildId = additionalMetadata[KB_GRAPH_BUILD_METADATA_KEY]
  if (!buildId) {
    throw new Error('KB graph build recovery metadata is missing')
  }

  const existingRuns = await client.runs.list({
    workflowNames: [workflowName],
    // Hatchet treats metadata filters as OR. Query on the unique build id and
    // verify the rest locally before recovering a run.
    additionalMetadata: { [KB_GRAPH_BUILD_METADATA_KEY]: buildId },
    onlyTasks: false,
    includePayloads: false,
    // An empty answer is taken as proof that the provider never accepted a run
    // for this build (it releases the cost reservation), so the page must be
    // large enough that a matching row can never be truncated away.
    limit: 10,
    since: new Date(recoveryAnchor.getTime() - KB_GRAPH_BLOB_SAS_CLOCK_SKEW_MS),
  })
  const recoveredRun = existingRuns.rows.find((run) =>
    Object.entries(additionalMetadata).every(
      ([key, value]) => run.additionalMetadata?.[key] === value
    )
  )
  if (!recoveredRun) {
    return undefined
  }

  return {
    runId: recoveredRun.workflowRunExternalId,
    startedAt: new Date(recoveredRun.createdAt),
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
    // State reconciliation must not fail merely because logging is unavailable.
  }
}

export async function cancelExternalKBGraphRunBestEffort({
  client,
  runId,
  identifiers,
  logger,
}: {
  client: ExternalKBGraphClient
  runId: string
  identifiers: Record<string, string>
  logger?: KBGraphLogger
}): Promise<void> {
  try {
    await client.runs.cancel({ ids: [runId] })
  } catch {
    await logErrorBestEffort(
      logger,
      'External KB graph workflow cancellation failed',
      identifiers
    )
  }
}
