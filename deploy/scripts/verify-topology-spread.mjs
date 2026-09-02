// Verifies the production topology-spread contract by rendering the chart
// with helm and inspecting the rendered Deployment pod specs. Run from the
// repo root after changing scheduling values:
//   node deploy/scripts/verify-topology-spread.mjs
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAllDocuments } from 'yaml'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const chartPath = join(repoRoot, 'deploy', 'charts', 'klicker-uzh-v3')
const prodValuesPath = join(repoRoot, 'deploy', 'env-uzh-prd', 'values.yaml')

// Deployment component label -> expected number of spread constraints.
const expectedConstraints = {
  'hatchet-worker-general': 2,
  'hatchet-worker-response-processor': 2,
  'hatchet-worker-response-processor-assessment': 2,
  'frontend-assessment': 2,
  'backend-assessment': 2,
}

function render(valuesArgs) {
  const stdout = execFileSync(
    'helm',
    ['template', 'verify-spread', chartPath, ...valuesArgs],
    { encoding: 'utf8' }
  )
  const documents = parseAllDocuments(stdout)
  const parseErrors = documents.flatMap((document) => document.errors)
  if (parseErrors.length > 0) {
    throw new Error(`render produced invalid YAML: ${parseErrors[0]}`)
  }
  return documents.map((document) => document.toJS()).filter(Boolean)
}

function deploymentComponent(deployment) {
  const labels = deployment.spec?.template?.metadata?.labels
  return labels ? labels['app.kubernetes.io/component'] : undefined
}

function spreadConstraints(deployment) {
  return deployment.spec?.template?.spec?.topologySpreadConstraints
}

const failures = []

const prodDeployments = render(['--values', prodValuesPath]).filter(
  (resource) => resource.kind === 'Deployment'
)
const prodSpread = new Map()
for (const deployment of prodDeployments) {
  const constraints = spreadConstraints(deployment)
  if (Array.isArray(constraints) && constraints.length > 0) {
    prodSpread.set(deploymentComponent(deployment), constraints)
  }
}

for (const [component, expectedCount] of Object.entries(expectedConstraints)) {
  const constraints = prodSpread.get(component)
  if (!constraints) {
    failures.push(`${component}: no topology spread constraints`)
    continue
  }
  if (constraints.length !== expectedCount) {
    failures.push(
      `${component}: expected ${expectedCount} constraints, found ${constraints.length}`
    )
  }
  for (const constraint of constraints) {
    const selected =
      constraint.labelSelector?.matchLabels?.['app.kubernetes.io/component']
    if (selected !== component) {
      failures.push(
        `${component}: constraint selects ${JSON.stringify(selected)}`
      )
    }
  }
  prodSpread.delete(component)
}

for (const [component] of prodSpread) {
  failures.push(`${component}: unexpected topology spread constraints`)
}

const defaultSerialized = JSON.stringify(
  render([]).filter((resource) => resource.kind === 'Deployment')
)
if (defaultSerialized.includes('topologySpreadConstraints')) {
  failures.push('chart defaults rendered a topologySpreadConstraints field')
}

if (failures.length > 0) {
  console.error('topology spread verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(
  `topology spread verification passed: ${
    Object.keys(expectedConstraints).length
  } deployments carry the expected constraints, defaults render clean`
)
