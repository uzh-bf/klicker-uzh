// Verifies the chart's topology-spread contract by rendering the deployment
// chart with helm and inspecting the rendered Deployment pod specs. Production
// values define the constraints, but a workload receives them only when its
// template forwards the value to the pod spec, so reading the values file
// cannot show whether a scheduling policy reaches Kubernetes.
//
// Run from the repository root after changing scheduling values:
//   node deploy/scripts/verify-topology-spread.mjs
//
// The required `check` workflow runs this script together with the negative
// cases in `deploy/scripts/verify-topology-spread.test.mjs`.
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseAllDocuments } from 'yaml'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const chartPath = join(repoRoot, 'deploy', 'charts', 'klicker-uzh-v3')
const stagingValuesPath = join(repoRoot, 'deploy', 'env-uzh-stg', 'values.yaml')
const productionValuesPath = join(
  repoRoot,
  'deploy',
  'env-uzh-prd',
  'values.yaml'
)

const releaseName = 'app-klicker'
const componentLabel = 'app.kubernetes.io/component'
const spreadField = 'topologySpreadConstraints'
const expectedMaxSkew = 1
const expectedWhenUnsatisfiable = 'ScheduleAnyway'
const topologyKeys = ['topology.kubernetes.io/zone', 'kubernetes.io/hostname']

// The complete production contract. `origin` separates the workloads this
// chart revision started rendering from the MCP workloads whose templates
// already forwarded the value: the MCP pair keeps the constraints it already
// rendered, so weakening them to satisfy this check is a regression.
export const expectedSpread = [
  {
    component: 'hatchet-worker-general',
    valuesPath: 'hatchet.workers.general',
    origin: 'this-change',
  },
  {
    component: 'hatchet-worker-response-processor',
    valuesPath: 'hatchet.workers.responseProcessor',
    origin: 'this-change',
  },
  {
    component: 'hatchet-worker-response-processor-assessment',
    valuesPath: 'hatchet.workers.responseProcessorAssessment',
    origin: 'this-change',
  },
  {
    component: 'frontend-assessment',
    valuesPath: 'assessment.frontendPWA',
    origin: 'this-change',
  },
  {
    component: 'backend-assessment',
    valuesPath: 'assessment.backendGraphql',
    origin: 'this-change',
  },
  {
    component: 'mcp-student',
    valuesPath: 'mcpStudent',
    origin: 'pre-existing',
  },
  {
    component: 'mcp-lecturer',
    valuesPath: 'mcpLecturer',
    origin: 'pre-existing',
  },
]

export const renderConfigurations = [
  { label: 'chart defaults', valuesPath: undefined },
  { label: 'staging values', valuesPath: stagingValuesPath },
  { label: 'production values', valuesPath: productionValuesPath },
]

// Property paths of every spread field in a parsed document. The walk is
// structural: a serialized substring search would also match the field name
// inside string data, such as a container argument or a quoted manifest.
export function findSpreadFields(value, path = '$') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSpreadFields(item, `${path}[${index}]`)
    )
  }
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) =>
    key === spreadField
      ? [`${path}.${key}`]
      : findSpreadFields(nested, `${path}.${key}`)
  )
}

export function findRenderedSpreadFields(documents) {
  return documents.flatMap((document) =>
    findSpreadFields(document).map((path) => ({
      kind: document?.kind ?? 'document without kind',
      name: document?.metadata?.name ?? 'document without name',
      path,
    }))
  )
}

export function inspectRenderedDeployments(documents) {
  return documents
    .filter((document) => document?.kind === 'Deployment')
    .map((deployment) => ({
      name: deployment.metadata?.name ?? 'Deployment without name',
      component: deployment.spec?.template?.metadata?.labels?.[componentLabel],
      constraints: deployment.spec?.template?.spec?.[spreadField],
    }))
}

function evaluateConstraint(component, topologyKey, constraint) {
  const failures = []
  if (constraint?.maxSkew !== expectedMaxSkew) {
    failures.push(
      `${component}: the ${topologyKey} constraint has maxSkew ${JSON.stringify(
        constraint?.maxSkew
      )}, expected ${expectedMaxSkew}`
    )
  }
  if (constraint?.whenUnsatisfiable !== expectedWhenUnsatisfiable) {
    failures.push(
      `${component}: the ${topologyKey} constraint has ` +
        `whenUnsatisfiable ${JSON.stringify(
          constraint?.whenUnsatisfiable
        )}, expected ${expectedWhenUnsatisfiable} (a hard policy can ` +
        'leave pods unschedulable)'
    )
  }
  const selected = constraint?.labelSelector?.matchLabels?.[componentLabel]
  if (selected !== component) {
    failures.push(
      `${component}: the ${topologyKey} constraint selects ${JSON.stringify(
        selected
      )}, expected ${component}`
    )
  }
  return failures
}

export function evaluateSpreadContract(deployments, expected = expectedSpread) {
  const failures = []
  const renderedComponents = new Set()
  const renderedSpread = new Map()

  for (const deployment of deployments) {
    if (deployment.component === undefined) {
      if (Array.isArray(deployment.constraints)) {
        failures.push(
          `${deployment.name}: renders ${spreadField} without an ` +
            `${componentLabel} pod label`
        )
      }
      continue
    }
    renderedComponents.add(deployment.component)
    if (Array.isArray(deployment.constraints)) {
      renderedSpread.set(deployment.component, deployment.constraints)
    }
  }

  const expectedComponents = new Set()
  for (const entry of expected) {
    expectedComponents.add(entry.component)
    if (!renderedComponents.has(entry.component)) {
      failures.push(
        `${entry.component}: no Deployment carries this ${componentLabel} ` +
          'label in the production render'
      )
      continue
    }
    const constraints = renderedSpread.get(entry.component)
    if (constraints === undefined) {
      failures.push(
        `${entry.component}: the production render forwards no ${spreadField} ` +
          `to the pod spec, so ${entry.valuesPath} stays inert`
      )
      continue
    }
    if (constraints.length !== topologyKeys.length) {
      failures.push(
        `${entry.component}: expected exactly ${topologyKeys.length} constraints ` +
          `(${topologyKeys.join(', ')}), found ${constraints.length}`
      )
    }
    for (const topologyKey of topologyKeys) {
      const matching = constraints.filter(
        (constraint) => constraint?.topologyKey === topologyKey
      )
      if (matching.length !== 1) {
        failures.push(
          `${entry.component}: expected exactly one ${topologyKey} constraint, ` +
            `found ${matching.length}`
        )
        continue
      }
      failures.push(
        ...evaluateConstraint(entry.component, topologyKey, matching[0])
      )
    }
  }

  for (const [component, constraints] of renderedSpread) {
    if (expectedComponents.has(component)) continue
    failures.push(
      `${component}: renders ${spreadField} (${constraints.length} constraints) ` +
        'although the expected contract does not cover this workload; ' +
        'extend expectedSpread or remove the values entry'
    )
  }

  return failures
}

function parseRenderedDocuments(rendered) {
  const documents = parseAllDocuments(rendered)
  const parseErrors = documents.flatMap((document) => document.errors)
  if (parseErrors.length > 0) {
    throw new Error(`render produced invalid YAML: ${parseErrors[0]}`)
  }
  return documents.map((document) => document.toJS()).filter(Boolean)
}

function helm(args) {
  try {
    return execFileSync('helm', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'helm is not installed; the chart scheduling check needs the Helm CLI'
      )
    }
    const detail = String(error.stderr ?? '').trim()
    throw new Error(
      `helm ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`
    )
  }
}

export function lintChart(valuesPath) {
  const args = ['lint', chartPath]
  if (valuesPath !== undefined) args.push('--values', valuesPath)
  helm(args)
}

export function renderChart(valuesPath) {
  const args = ['template', releaseName, chartPath]
  if (valuesPath !== undefined) args.push('--values', valuesPath)
  return parseRenderedDocuments(helm(args))
}

// Lint and render every supported configuration, then assert that only the
// production workloads in the expected contract carry spread constraints and
// that each of them carries the intended scheduling settings.
export function verifyChartContract() {
  for (const render of renderConfigurations) lintChart(render.valuesPath)

  const failures = []
  let productionDocuments = []
  for (const render of renderConfigurations) {
    const documents = renderChart(render.valuesPath)
    if (render.label === 'production values') {
      productionDocuments = documents
      continue
    }
    for (const field of findRenderedSpreadFields(documents)) {
      failures.push(
        `${render.label}: ${field.kind} ${field.name} renders ${field.path}; ` +
          'the chart must render the field only where the values define it'
      )
    }
  }

  failures.push(
    ...evaluateSpreadContract(inspectRenderedDeployments(productionDocuments))
  )
  return failures
}

export function summarizeContract() {
  const rendered = expectedSpread.filter(
    (entry) => entry.origin === 'this-change'
  )
  const existing = expectedSpread.filter(
    (entry) => entry.origin === 'pre-existing'
  )
  return (
    `${rendered.length} workloads newly render zone and hostname constraints ` +
    `(${rendered.map((entry) => entry.component).join(', ')}); ` +
    `${existing.length} keep the constraints they already rendered ` +
    `(${existing.map((entry) => entry.component).join(', ')}); ` +
    'chart defaults and staging values render no spread field'
  )
}

function main() {
  let failures
  try {
    failures = verifyChartContract()
  } catch (error) {
    console.error(error.message)
    return 2
  }
  if (failures.length > 0) {
    console.error('topology spread verification failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    return 1
  }
  console.log(
    `topology spread verification passed: ${summarizeContract()} (${helm([
      'version',
      '--short',
    ]).trim()})`
  )
  return 0
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
