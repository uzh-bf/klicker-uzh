import { randomUUID } from 'node:crypto'

const TELEMETRY_SCHEMA_VERSION = 1 as const
const TELEMETRY_EVENT = 'import_export_operation' as const
const STABLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

export type ImportExportTelemetryOperation =
  | 'backfill'
  | 'canary'
  | 'capability'
  | 'cleanup'
  | 'concurrency'
  | 'download'
  | 'export'
  | 'import'
  | 'preflight'
  | 'preview'
  | 'rate_limit'
  | 'receipt'
  | 'storage'
  | 'unknown'
  | 'upload'
  | 'validate'

export type ImportExportTelemetryOutcome =
  | 'failure'
  | 'rejected'
  | 'replayed'
  | 'started'
  | 'success'
  | 'timeout'
  | 'unknown'

export type ImportExportTelemetryService =
  | 'backend'
  | 'graphql'
  | 'script'
  | 'unknown'
  | 'worker'

type ImportExportTelemetryMetrics = Readonly<{
  answerCollectionCount?: number
  attemptedCount?: number
  batchCount?: number
  cleanupFailureCount?: number
  deletedCount?: number
  durationMs?: number
  elementCount?: number
  errorCount?: number
  limit?: number
  mediaFileCount?: number
  packageBytes?: number
  rateLimitCount?: number
  retryCount?: number
  selectedCount?: number
  skippedCount?: number
  unsafeTargetCount?: number
  warningCount?: number
  windowSeconds?: number
  wouldDeleteCount?: number
}>

export type ImportExportTelemetryInput = ImportExportTelemetryMetrics &
  Readonly<{
    backlogRemaining?: boolean
    code?: string | null
    correlationId?: string
    operation: ImportExportTelemetryOperation
    outcome: ImportExportTelemetryOutcome
    service?: ImportExportTelemetryService
  }>

export type ImportExportTelemetryEvent = Readonly<{
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
  event: typeof TELEMETRY_EVENT
  occurredAt: string
  service: ImportExportTelemetryService
  environment: 'development' | 'production' | 'staging' | 'test' | 'unknown'
  correlationId: string
  operation: ImportExportTelemetryOperation
  outcome: ImportExportTelemetryOutcome
  code?: string
  backlogRemaining?: boolean
  metrics?: ImportExportTelemetryMetrics
}>

const METRIC_KEYS = [
  'answerCollectionCount',
  'attemptedCount',
  'batchCount',
  'cleanupFailureCount',
  'deletedCount',
  'durationMs',
  'elementCount',
  'errorCount',
  'limit',
  'mediaFileCount',
  'packageBytes',
  'rateLimitCount',
  'retryCount',
  'selectedCount',
  'skippedCount',
  'unsafeTargetCount',
  'warningCount',
  'windowSeconds',
  'wouldDeleteCount',
] as const satisfies readonly (keyof ImportExportTelemetryMetrics)[]

const OPERATIONS = new Set<ImportExportTelemetryOperation>([
  'backfill',
  'canary',
  'capability',
  'cleanup',
  'concurrency',
  'download',
  'export',
  'import',
  'preflight',
  'preview',
  'rate_limit',
  'receipt',
  'storage',
  'unknown',
  'upload',
  'validate',
])
const OUTCOMES = new Set<ImportExportTelemetryOutcome>([
  'failure',
  'rejected',
  'replayed',
  'started',
  'success',
  'timeout',
  'unknown',
])
const SERVICES = new Set<ImportExportTelemetryService>([
  'backend',
  'graphql',
  'script',
  'unknown',
  'worker',
])

function runtimeEnvironment(
  nodeEnvironment: string | undefined
): ImportExportTelemetryEvent['environment'] {
  if (
    nodeEnvironment === 'development' ||
    nodeEnvironment === 'production' ||
    nodeEnvironment === 'test'
  ) {
    return nodeEnvironment
  }
  if (nodeEnvironment === 'stg' || nodeEnvironment === 'staging') {
    return 'staging'
  }
  return 'unknown'
}

function stableCode(code: string | null | undefined) {
  if (typeof code === 'undefined' || code === null) return undefined
  return STABLE_CODE_PATTERN.test(code) ? code : 'UNCLASSIFIED'
}

function safeCount(value: number | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}

function safeCorrelationId(value: string | undefined) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
    ? value
    : randomUUID()
}

export function createImportExportTelemetryEvent(
  input: ImportExportTelemetryInput,
  {
    nodeEnvironment = process.env.NODE_ENV,
    now = new Date(),
  }: { nodeEnvironment?: string; now?: Date } = {}
): ImportExportTelemetryEvent {
  const metrics: Record<string, number> = {}
  for (const key of METRIC_KEYS) {
    const value = safeCount(input[key])
    if (typeof value !== 'undefined') metrics[key] = value
  }

  const code = stableCode(input.code)
  return Object.freeze({
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    event: TELEMETRY_EVENT,
    occurredAt: now.toISOString(),
    service:
      typeof input.service === 'string' && SERVICES.has(input.service)
        ? input.service
        : input.service
          ? 'unknown'
          : 'graphql',
    environment: runtimeEnvironment(nodeEnvironment),
    correlationId: safeCorrelationId(input.correlationId),
    operation:
      typeof input.operation === 'string' && OPERATIONS.has(input.operation)
        ? input.operation
        : 'unknown',
    outcome:
      typeof input.outcome === 'string' && OUTCOMES.has(input.outcome)
        ? input.outcome
        : 'unknown',
    ...(code ? { code } : {}),
    ...(typeof input.backlogRemaining === 'boolean'
      ? { backlogRemaining: input.backlogRemaining }
      : {}),
    ...(Object.keys(metrics).length > 0
      ? { metrics: Object.freeze(metrics) }
      : {}),
  })
}

export function emitImportExportTelemetry(
  input: ImportExportTelemetryInput,
  sink: (event: ImportExportTelemetryEvent) => void = (event) =>
    console.info('[ImportExportTelemetry]', JSON.stringify(event))
) {
  try {
    sink(createImportExportTelemetryEvent(input))
  } catch {
    // Observability must never change the outcome of an import/export request.
  }
}
