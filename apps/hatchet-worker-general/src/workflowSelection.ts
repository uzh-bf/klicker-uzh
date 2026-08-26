import {
  validateKBGraphWorkerConfig,
  validateKBIngestionWorkerConfig,
} from '@klicker-uzh/hatchet'

const KB_INGESTION_WORKFLOW_KEYS = new Set([
  'ingestKBResource',
  'deleteKBResource',
  'monitorKBIngestions',
  'maintainKBResources',
])
const KB_GRAPH_WORKFLOW_KEYS = new Set(['buildKBGraph', 'monitorKBGraphBuilds'])

export type KBWorkerIntegrationState = {
  ingestionDisabled: boolean
  graphDisabled: boolean
}

function isDisabled(value: string | undefined): boolean {
  return value === 'true'
}

export function validateKBWorkerConfiguration(
  env: NodeJS.ProcessEnv = process.env
): KBWorkerIntegrationState {
  const integrationState = {
    ingestionDisabled: isDisabled(env.KB_INGESTION_WORKER_DISABLED),
    graphDisabled: isDisabled(env.KB_GRAPH_DISABLED),
  }

  if (!integrationState.ingestionDisabled) {
    validateKBIngestionWorkerConfig(env)
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
      (options.graphDisabled && KB_GRAPH_WORKFLOW_KEYS.has(key))
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
