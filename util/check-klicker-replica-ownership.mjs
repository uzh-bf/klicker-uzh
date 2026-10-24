import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { parseAllDocuments } from 'yaml'

const chartPath = 'deploy/charts/klicker-uzh-v3'

const environments = [
  {
    name: 'base',
    namespace: 'klicker-base',
    values: null,
  },
  {
    name: 'stg',
    namespace: 'stg-klicker',
    values: 'deploy/env-uzh-stg/values.yaml',
  },
  {
    name: 'prd',
    namespace: 'prd-klicker',
    values: 'deploy/env-uzh-prd/values.yaml',
  },
]

const hpaEnvironment = {
  name: 'hpa',
  namespace: 'klicker-hpa',
  values: null,
  overrides: [
    'frontendPWA.autoscaling.enabled=true',
    'frontendManage.autoscaling.enabled=true',
    'backendGraphql.autoscaling.enabled=true',
  ],
}

function renderChart({ namespace, values, overrides = [] }) {
  const args = ['template', 'klicker', chartPath, '--namespace', namespace]

  if (values) {
    args.push('--values', values)
  }

  for (const override of overrides) {
    args.push('--set', override)
  }

  return execFileSync('helm', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function parseManifest(rendered, source) {
  return parseAllDocuments(rendered).flatMap((document) => {
    assert.equal(
      document.errors.length,
      0,
      `${source}: Helm output contains invalid YAML`
    )

    const resource = document.toJSON()
    return resource ? [resource] : []
  })
}

function resourceKey(resource, fallbackNamespace) {
  const namespace = resource.metadata?.namespace ?? fallbackNamespace
  const name = resource.metadata?.name

  assert.ok(name, 'Rendered resource is missing metadata.name')
  return `${namespace}/${name}`
}

function scalerTargetKey(resource, fallbackNamespace) {
  const target = resource.spec?.scaleTargetRef
  const targetKind =
    target?.kind ??
    (resource.kind === 'ScaledObject' ? 'Deployment' : undefined)

  assert.equal(
    targetKind,
    'Deployment',
    `${resource.kind} ${resourceKey(resource, fallbackNamespace)} must target a Deployment`
  )
  assert.ok(
    target.name,
    `${resource.kind} ${resourceKey(resource, fallbackNamespace)} is missing a target name`
  )

  const namespace = resource.metadata?.namespace ?? fallbackNamespace
  return `${namespace}/${target.name}`
}

function assertReplicaOwnership(resources, source, expectedDeploymentCount) {
  const deployments = resources.filter(({ kind }) => kind === 'Deployment')
  assert.equal(
    deployments.length,
    expectedDeploymentCount,
    `${source}: expected ${expectedDeploymentCount} Deployments, found ${deployments.length}`
  )

  const owners = new Map(
    deployments.map((deployment) => [
      resourceKey(deployment, source),
      {
        deployment,
        scalers: [],
      },
    ])
  )

  const scalers = resources.filter(({ kind }) =>
    ['HorizontalPodAutoscaler', 'ScaledObject'].includes(kind)
  )

  for (const scaler of scalers) {
    const targetKey = scalerTargetKey(scaler, source)
    const owner = owners.get(targetKey)

    assert.ok(
      owner,
      `${source}: ${scaler.kind} targets unknown Deployment ${targetKey}`
    )
    owner.scalers.push(scaler)
  }

  for (const [key, { deployment, scalers: deploymentScalers }] of owners) {
    const hasStaticOwner = Object.hasOwn(deployment.spec ?? {}, 'replicas')
    const ownerCount = Number(hasStaticOwner) + deploymentScalers.length

    assert.equal(
      ownerCount,
      1,
      `${source}: Deployment ${key} has ${ownerCount} replica owners`
    )
  }
}

function assertHpaSchema(resources, source) {
  const hpas = resources.filter(
    ({ kind }) => kind === 'HorizontalPodAutoscaler'
  )
  const deployments = resources.filter(({ kind }) => kind === 'Deployment')

  assert.equal(hpas.length, 3, `${source}: expected three HPAs`)

  const targetKeys = hpas.map((hpaResource) =>
    scalerTargetKey(hpaResource, source)
  )
  assert.equal(
    new Set(targetKeys).size,
    hpas.length,
    `${source}: HPA targets must be unique`
  )

  for (const hpaResource of hpas) {
    assert.equal(
      hpaResource.apiVersion,
      'autoscaling/v2',
      `${source}: HPA ${resourceKey(hpaResource, source)} must use autoscaling/v2`
    )

    const metrics = hpaResource.spec?.metrics ?? []
    assert.equal(
      metrics.length,
      1,
      `${source}: HPA ${resourceKey(hpaResource, source)} must have exactly one metric`
    )
    assert.deepEqual(
      new Set(metrics.map((metric) => metric.resource?.name)),
      new Set(['cpu']),
      `${source}: HPA ${resourceKey(hpaResource, source)} must target CPU only`
    )

    for (const metric of metrics) {
      assert.equal(
        metric.type,
        'Resource',
        `${source}: HPA metrics must use Resource targets`
      )
      assert.equal(
        metric.resource?.target?.type,
        'Utilization',
        `${source}: HPA resource targets must use Utilization`
      )
      assert.equal(
        typeof metric.resource?.target?.averageUtilization,
        'number',
        `${source}: HPA resource targets need averageUtilization`
      )
      assert.equal(
        Object.hasOwn(metric.resource ?? {}, 'targetAverageUtilization'),
        false,
        `${source}: HPA output contains targetAverageUtilization`
      )
    }
  }

  const autoscaledDeployments = deployments
    .filter(
      (deploymentResource) =>
        !Object.hasOwn(deploymentResource.spec ?? {}, 'replicas')
    )
    .map((deploymentResource) => resourceKey(deploymentResource, source))
    .sort()

  assert.deepEqual(
    targetKeys.sort(),
    autoscaledDeployments,
    `${source}: HPA targets must be exactly the Deployments without replicas`
  )
}

function assertStaticLti(resources, source, expectedReplicas) {
  const ltiDeployments = resources.filter(
    (resource) =>
      resource.kind === 'Deployment' &&
      resource.metadata?.labels?.['app.kubernetes.io/component'] === 'lti'
  )

  assert.equal(
    ltiDeployments.length,
    1,
    `${source}: expected one LTI Deployment`
  )

  const ltiDeployment = ltiDeployments[0]
  assert.equal(
    ltiDeployment.spec?.replicas,
    expectedReplicas,
    `${source}: LTI must be a static Deployment with ${expectedReplicas} replicas`
  )
}

function assertWorkerDisruptionBudgets(resources, source, expectedBudgets) {
  const disruptionBudgets = resources.filter(
    ({ kind }) => kind === 'PodDisruptionBudget'
  )

  for (const [component, expectedMinAvailable] of Object.entries(
    expectedBudgets
  )) {
    const matchingBudgets = disruptionBudgets.filter(
      (resource) =>
        resource.metadata?.labels?.['app.kubernetes.io/component'] === component
    )

    assert.equal(
      matchingBudgets.length,
      1,
      `${source}: expected one PodDisruptionBudget for ${component}`
    )
    assert.equal(
      matchingBudgets[0].spec?.minAvailable,
      expectedMinAvailable,
      `${source}: ${component} PodDisruptionBudget must set minAvailable to ${expectedMinAvailable}`
    )
  }
}

function assertWorkerRuntimeContracts(resources, source) {
  const workerContracts = [
    {
      component: 'hatchet-worker-general',
      healthPort: 8001,
    },
    {
      component: 'hatchet-worker-response-processor',
      healthPort: 8002,
    },
    {
      component: 'hatchet-worker-response-processor-assessment',
      healthPort: 8003,
    },
  ]

  for (const { component, healthPort } of workerContracts) {
    const deployments = resources.filter(
      (resource) =>
        resource.kind === 'Deployment' &&
        resource.metadata?.labels?.['app.kubernetes.io/component'] === component
    )
    assert.equal(
      deployments.length,
      1,
      `${source}: expected one Deployment for ${component}`
    )

    const podSpec = deployments[0].spec?.template?.spec
    assert.equal(
      podSpec?.terminationGracePeriodSeconds,
      90,
      `${source}: ${component} must have a 90-second termination grace period`
    )

    const containers = (podSpec?.containers ?? []).filter(
      (container) => container.name === component
    )
    assert.equal(
      containers.length,
      1,
      `${source}: expected one ${component} container`
    )

    const container = containers[0]
    assert.deepEqual(
      container.ports,
      [{ name: 'http', containerPort: healthPort, protocol: 'TCP' }],
      `${source}: ${component} must expose health port ${healthPort} as http`
    )
    assert.deepEqual(
      container.livenessProbe?.httpGet,
      { path: '/healthz', port: 'http' },
      `${source}: ${component} must use /healthz for liveness`
    )
    assert.deepEqual(
      container.readinessProbe?.httpGet,
      { path: '/readyz', port: 'http' },
      `${source}: ${component} must use /readyz for readiness`
    )

    const configMaps = resources.filter(
      (resource) =>
        resource.kind === 'ConfigMap' &&
        resource.data?.HATCHET_WORKER_NAME === component
    )
    assert.equal(
      configMaps.length,
      1,
      `${source}: expected one ConfigMap for ${component}`
    )

    const configMap = configMaps[0]
    assert.equal(
      configMap.data?.HATCHET_WORKER_SLOTS,
      '100',
      `${source}: ${component} must have 100 non-durable slots`
    )
    assert.equal(
      configMap.data?.HATCHET_WORKER_DURABLE_SLOTS,
      '1000',
      `${source}: ${component} must have 1000 durable slots`
    )
    assert.equal(
      configMap.data?.HATCHET_WORKER_HEALTH_PORT,
      String(healthPort),
      `${source}: ${component} ConfigMap must use health port ${healthPort}`
    )
    assert.ok(
      (container.envFrom ?? []).some(
        (sourceReference) =>
          sourceReference.configMapRef?.name === configMap.metadata?.name
      ),
      `${source}: ${component} must load its worker ConfigMap`
    )
  }
}

function assertNoAutoscalingStanzas(values, source) {
  const allowedHpaWorkloads = new Set([
    'frontendPWA',
    'frontendManage',
    'backendGraphql',
    'mcpStudent',
    'mcpLecturer',
  ])
  const phantomOwners = []

  function visit(value, path = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return

    const workloadPath = path.join('.')
    if (
      Object.hasOwn(value, 'autoscaling') &&
      !allowedHpaWorkloads.has(workloadPath)
    ) {
      phantomOwners.push(workloadPath)
    }

    for (const [name, nestedValue] of Object.entries(value)) {
      if (name !== 'autoscaling') {
        visit(nestedValue, [...path, name])
      }
    }
  }

  visit(values)

  assert.deepEqual(
    phantomOwners,
    [],
    `${source}: values contain phantom autoscaling stanzas on non-autoscaled workloads`
  )
}

function deployment(name, replicas) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name },
    ...(replicas === undefined ? {} : { spec: { replicas } }),
  }
}

function hpa(name, targetName) {
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: { name },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: targetName,
      },
    },
  }
}

function assertNegativeFixtures() {
  assert.throws(
    () => assertReplicaOwnership([deployment('ownerless')], 'zero-owner', 1),
    /zero-owner: Deployment .* has 0 replica owners/
  )
  assert.throws(
    () =>
      assertReplicaOwnership(
        [deployment('dual-owned', 1), hpa('dual-owned-hpa', 'dual-owned')],
        'dual-owner',
        1
      ),
    /dual-owner: Deployment .* has 2 replica owners/
  )
  assert.throws(
    () =>
      assertReplicaOwnership(
        [
          deployment('duplicate-owned'),
          hpa('duplicate-hpa-a', 'duplicate-owned'),
          hpa('duplicate-hpa-b', 'duplicate-owned'),
        ],
        'duplicate-owner',
        1
      ),
    /duplicate-owner: Deployment .* has 2 replica owners/
  )
  assert.throws(
    () =>
      assertNoAutoscalingStanzas(
        {
          assessment: {
            frontendPWA: { autoscaling: { enabled: true } },
          },
        },
        'nested-phantom'
      ),
    /nested-phantom: values contain phantom autoscaling stanzas.*assessment\.frontendPWA/s
  )

  for (const workload of ['frontendPWA', 'frontendManage', 'backendGraphql']) {
    assert.throws(
      () =>
        renderChart({
          namespace: 'invalid-hpa',
          values: null,
          overrides: [
            `${workload}.autoscaling.enabled=true`,
            `${workload}.autoscaling.targetCPUUtilizationPercentage=0`,
          ],
        }),
      new RegExp(
        `${workload}\\.autoscaling\\.targetCPUUtilizationPercentage must be greater than zero`
      )
    )
  }
}

for (const environment of environments) {
  const resources = parseManifest(renderChart(environment), environment.name)
  assertReplicaOwnership(resources, environment.name, 17)
  assertStaticLti(
    resources,
    environment.name,
    { base: 2, stg: 1, prd: 2 }[environment.name]
  )
  assertWorkerDisruptionBudgets(
    resources,
    environment.name,
    {
      base: {
        'hatchet-worker-general': 1,
        'hatchet-worker-response-processor': 1,
        'hatchet-worker-response-processor-assessment': 1,
        'backend-assessment': 2,
      },
      stg: {
        'hatchet-worker-general': 0,
        'hatchet-worker-response-processor': 0,
        'hatchet-worker-response-processor-assessment': 0,
        'backend-assessment': 2,
      },
      prd: {
        'hatchet-worker-general': 1,
        'hatchet-worker-response-processor': 2,
        'hatchet-worker-response-processor-assessment': 2,
        'backend-assessment': 2,
      },
    }[environment.name]
  )
  assertWorkerRuntimeContracts(resources, environment.name)
}

const hpaResources = parseManifest(
  renderChart(hpaEnvironment),
  hpaEnvironment.name
)
assertReplicaOwnership(hpaResources, hpaEnvironment.name, 17)
assertHpaSchema(hpaResources, hpaEnvironment.name)

for (const valuesSource of [
  `${chartPath}/values.yaml`,
  ...environments.flatMap(({ values }) => (values ? [values] : [])),
]) {
  const valuesDocument = parseAllDocuments(
    readFileSync(valuesSource, 'utf8')
  )[0]
  assert.equal(valuesDocument.errors.length, 0)
  assertNoAutoscalingStanzas(valuesDocument.toJSON(), valuesSource)
}

assertNegativeFixtures()

console.log(
  `Replica ownership, worker runtime contract, and disruption budget checks passed for ${environments.length} default Helm renders, one all-three-HPA render, three values files, and seven negative fixtures`
)
