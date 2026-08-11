import {
  validateKBGraphWorkerConfig,
  validateKBIngestionWorkerConfig,
} from '@klicker-uzh/hatchet'

const KB_INGESTION_WORKFLOW_KEYS = new Set([
  'ingestKBResource',
  'deleteKBResource',
  'monitorKBIngestions',
])
const KB_GRAPH_WORKFLOW_KEYS = new Set(['buildKBGraph', 'monitorKBGraphBuilds'])
const KB_MAINTENANCE_WORKFLOW_KEY = 'maintainKBResources'
const AUDIT_WORKFLOW_KEYS = new Set([
  'dispatchAssessmentAuditOutbox',
  'monitorAssessmentAudit',
])

export type KBWorkerIntegrationState = {
  ingestionDisabled: boolean
  graphDisabled: boolean
}

function isDisabled(value: string | undefined): boolean {
  return value?.trim() === 'true'
}

function hasKBIngestionConfiguration(env: NodeJS.ProcessEnv): boolean {
  return [
    env.KB_INGESTION_API_URL,
    env.KB_INGESTION_API_KEY,
    env.KB_SOURCE_GATEWAY_URL,
  ].some((value) => value?.trim())
}

export function validateKBWorkerConfiguration(
  env: NodeJS.ProcessEnv = process.env
): KBWorkerIntegrationState {
  const ingestionGate = env.KB_INGESTION_WORKER_DISABLED?.trim()
  const integrationState = {
    ingestionDisabled:
      isDisabled(ingestionGate) ||
      (!ingestionGate && !hasKBIngestionConfiguration(env)),
    graphDisabled: isDisabled(env.KB_GRAPH_DISABLED),
  }

  if (!integrationState.ingestionDisabled) {
    validateKBIngestionWorkerConfig(env, { required: true })
  }
  if (!integrationState.graphDisabled) {
    validateKBGraphWorkerConfig(env)
  }

  return integrationState
}

export function selectWorkflows<T extends Record<string, unknown>>(
  workflows: T,
  options: KBWorkerIntegrationState & {
    requestedWorkflowNames?: string
    auditWorkerEnabled?: boolean
  }
) {
  const availableKeys = Object.keys(workflows) as Array<keyof T & string>
  const requestedKeys = options.requestedWorkflowNames
    ?.split(',')
    .map((key) => key.trim())
    .filter(Boolean)
  const hasRequestedKeys = requestedKeys && requestedKeys.length > 0
  const unknownKeys = hasRequestedKeys
    ? requestedKeys.filter((key) => !(key in workflows))
    : []
  const requestedCandidates = hasRequestedKeys
    ? requestedKeys.filter((key): key is keyof T & string => key in workflows)
    : availableKeys
  const isAllowed = (key: string) =>
    options.auditWorkerEnabled
      ? AUDIT_WORKFLOW_KEYS.has(key)
      : !AUDIT_WORKFLOW_KEYS.has(key)
  if (options.auditWorkerEnabled && unknownKeys.length > 0) {
    throw new Error(
      `HATCHET_WORKFLOWS contains unknown tasks for the audit worker: ${unknownKeys.join(', ')}`
    )
  }
  const forbidden = hasRequestedKeys
    ? requestedCandidates.filter((key) => !isAllowed(key))
    : []
  if (forbidden.length > 0) {
    throw new Error(
      `HATCHET_WORKFLOWS contains tasks forbidden for this worker identity: ${forbidden.join(', ')}`
    )
  }
  const candidateKeys = requestedCandidates.filter(isAllowed)
  const selectedKeySet = new Set(candidateKeys)
  if (
    options.auditWorkerEnabled &&
    (selectedKeySet.size !== AUDIT_WORKFLOW_KEYS.size ||
      candidateKeys.length !== selectedKeySet.size ||
      [...AUDIT_WORKFLOW_KEYS].some((key) => !selectedKeySet.has(key)))
  ) {
    throw new Error(
      'The audit worker must select every required audit workflow exactly'
    )
  }
  const disabledKeys = candidateKeys.filter(
    (key) =>
      (options.ingestionDisabled && KB_INGESTION_WORKFLOW_KEYS.has(key)) ||
      (options.graphDisabled && KB_GRAPH_WORKFLOW_KEYS.has(key)) ||
      (key === KB_MAINTENANCE_WORKFLOW_KEY &&
        options.ingestionDisabled &&
        options.graphDisabled)
  )
  const selectedKeys = candidateKeys.filter(
    (key) => !disabledKeys.includes(key)
  )

  return {
    workflows: selectedKeys.map((key) => workflows[key]),
    selectedKeys,
    unknownKeys,
    disabledKeys,
  }
}
