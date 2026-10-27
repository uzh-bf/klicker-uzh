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
  const candidateKeys = hasRequestedKeys
    ? requestedKeys.filter((key): key is keyof T & string => key in workflows)
    : availableKeys
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
