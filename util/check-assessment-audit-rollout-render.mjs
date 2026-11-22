import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse, parseAllDocuments } from 'yaml'

// Every process that can activate assessment audit coverage must see the same
// rollout selection. Course copies and scheduled readiness run in the general
// Hatchet worker, so it needs the keys as well as the backend; a missing key
// silently falls back to "disabled" there.
const chartPath = 'deploy/charts/klicker-uzh-v3'
const rolloutKeys = [
  'ASSESSMENT_AUDIT_ROLLOUT',
  'ASSESSMENT_AUDIT_PILOT_LIVE_QUIZ_IDS',
]
const activatingConfigMaps = [
  'config-backend-graphql',
  'config-hatchet-worker-general',
]
const environments = [
  { name: 'stg', values: 'deploy/env-uzh-stg/values.yaml' },
  { name: 'prd', values: 'deploy/env-uzh-prd/values.yaml' },
]

function fail(message) {
  throw new Error(`Assessment audit rollout render check failed: ${message}`)
}

function renderConfigMaps(valuesPath) {
  const result = spawnSync(
    'helm',
    [
      'template',
      'klicker',
      chartPath,
      '--values',
      valuesPath,
      '--set',
      'global.imageTag=render-check',
      '--show-only',
      'templates/cm-backend-graphql.yaml',
      '--show-only',
      'templates/cm-hatchet-workers.yaml',
    ],
    { encoding: 'utf8' }
  )
  if (result.error) fail(`could not run helm: ${result.error.message}`)
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
  if (!configMap) fail(`missing ConfigMap ending in ${suffix}`)
  return configMap
}

for (const environment of environments) {
  const values = parse(readFileSync(environment.values, 'utf8'))
  const audit = values?.assessmentAudit ?? {}
  const configMaps = renderConfigMaps(environment.values)
  for (const suffix of activatingConfigMaps) {
    const data = findConfigMap(configMaps, suffix).data ?? {}
    for (const key of rolloutKeys) {
      if (!audit.enabled) {
        if (key in data) {
          fail(`${environment.name} ${suffix} renders ${key} without audit`)
        }
        continue
      }
      const expected =
        key === 'ASSESSMENT_AUDIT_ROLLOUT'
          ? String(audit.rollout ?? 'disabled')
          : String(audit.pilotLiveQuizIds ?? '')
      if (data[key] !== expected) {
        fail(
          `${environment.name} ${suffix} expected ${key}=${JSON.stringify(expected)}, received ${JSON.stringify(data[key])}`
        )
      }
    }
  }
}

console.log(
  `Assessment audit rollout keys match in ${activatingConfigMaps.join(' and ')} for ${environments.map(({ name }) => name).join(', ')}`
)
