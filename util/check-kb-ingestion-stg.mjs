import { spawnSync } from 'node:child_process'
import { parseAllDocuments } from 'yaml'

const chartPath = 'deploy/charts/klicker-uzh-v3'
const stagingValuesPath = 'deploy/env-uzh-stg/values.yaml'
const expectedWorkerData = {
  KB_GRAPH_DISABLED: 'true',
  KB_INGESTION_API_URL:
    'http://ingestion-resource-api.stg-ingestion.svc.cluster.local:8000',
  KB_INGESTION_PROJECT_ID: 'klicker-course-materials',
  KB_SOURCE_GATEWAY_URL:
    'http://app-klicker-klicker-uzh-v2-backend-graphql.stg-klicker.svc.cluster.local:3000',
}
const expectedBackendData = {
  KB_GRAPH_DISABLED: 'true',
}
const workerOnlyKeys = [
  ...Object.keys(expectedWorkerData),
  'KB_INGESTION_WORKER_DISABLED',
]
const secretKeys = [
  'KB_INGESTION_API_KEY',
  'KB_SOURCE_GATEWAY_KEY',
  'KB_WEBHOOK_SECRET',
  'KB_WEBHOOK_PREVIOUS_SECRET',
]

function fail(message) {
  throw new Error(`KB ingestion STG render check failed: ${message}`)
}

function renderConfigMaps() {
  const result = spawnSync(
    'helm',
    [
      'template',
      'klicker',
      chartPath,
      '--values',
      stagingValuesPath,
      '--show-only',
      'templates/cm-backend-graphql.yaml',
      '--show-only',
      'templates/cm-hatchet-workers.yaml',
    ],
    { encoding: 'utf8' }
  )

  if (result.error) {
    fail(`could not run helm: ${result.error.message}`)
  }
  if (result.status !== 0) {
    fail(result.stderr.trim() || `helm exited with status ${result.status}`)
  }

  return parseAllDocuments(result.stdout)
    .map((document) => document.toJSON())
    .filter((value) => value?.kind === 'ConfigMap')
}

function findConfigMap(configMaps, suffix) {
  const configMap = configMaps.find((value) =>
    value.metadata?.name?.endsWith(suffix)
  )
  if (!configMap) {
    fail(`missing ConfigMap ending in ${suffix}`)
  }
  return configMap
}

function requireData(configMap, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (configMap.data?.[key] !== value) {
      fail(
        `${configMap.metadata.name} expected ${key}=${JSON.stringify(value)}, received ${JSON.stringify(configMap.data?.[key])}`
      )
    }
  }
}

function requireAbsent(configMap, keys) {
  for (const key of keys) {
    if (key in (configMap.data ?? {})) {
      fail(`${configMap.metadata.name} must not render ${key}`)
    }
  }
}

const configMaps = renderConfigMaps()
const backend = findConfigMap(configMaps, '-config-backend-graphql')
const generalWorker = findConfigMap(
  configMaps,
  '-config-hatchet-worker-general'
)
const responseProcessors = configMaps.filter((value) =>
  value.metadata?.name?.includes('-config-hatchet-worker-response-processor')
)

requireData(backend, expectedBackendData)
requireData(generalWorker, expectedWorkerData)
requireAbsent(backend, ['KB_INGESTION_DISABLED'])
requireAbsent(generalWorker, ['KB_INGESTION_WORKER_DISABLED'])
if (responseProcessors.length !== 2) {
  fail(
    `expected two response-processor ConfigMaps, received ${responseProcessors.length}`
  )
}
for (const configMap of responseProcessors) {
  for (const key of workerOnlyKeys) {
    if (key in (configMap.data ?? {})) {
      fail(`${configMap.metadata.name} must not receive ${key}`)
    }
  }
}
for (const configMap of configMaps) {
  for (const key of secretKeys) {
    if (key in (configMap.data ?? {})) {
      fail(`${configMap.metadata.name} must not render secret key ${key}`)
    }
  }
}

console.log('KB ingestion STG render check passed.')
