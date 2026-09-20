// Negative cases for the chart's topology-spread verification. They prove the
// assertions in verify-topology-spread.mjs fail on a wrong selector, a missing
// zone constraint, a hard scheduling policy, an unlisted workload, or a
// workload of another kind, and that the structural absence check ignores the
// field name inside string data.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  evaluateSpreadContract,
  expectedSpread,
  findRenderedSpreadFields,
  findUnlistedSpreadFields,
  inspectRenderedDeployments,
} from './verify-topology-spread.mjs'

const zoneKey = 'topology.kubernetes.io/zone'
const hostnameKey = 'kubernetes.io/hostname'

const spreadConstraint = (component, topologyKey, overrides = {}) => ({
  maxSkew: 1,
  topologyKey,
  whenUnsatisfiable: 'ScheduleAnyway',
  labelSelector: {
    matchLabels: { 'app.kubernetes.io/component': component },
  },
  ...overrides,
})

const spreadConstraints = (component) => [
  spreadConstraint(component, zoneKey),
  spreadConstraint(component, hostnameKey),
]

const deployment = (component, constraints) => ({
  kind: 'Deployment',
  metadata: { name: `app-klicker-${component}` },
  spec: {
    template: {
      metadata: { labels: { 'app.kubernetes.io/component': component } },
      spec:
        constraints === undefined
          ? {}
          : { topologySpreadConstraints: constraints },
    },
  },
})

// The production render this check must accept: every expected workload with
// the zone and hostname constraints the chart is meant to forward.
const renderedContract = () =>
  expectedSpread.map((entry) =>
    deployment(entry.component, spreadConstraints(entry.component))
  )

const withConstraints = (documents, component, constraints) =>
  documents.map((document) =>
    document.metadata.name === `app-klicker-${component}`
      ? deployment(component, constraints)
      : document
  )

const failuresFor = (documents) =>
  evaluateSpreadContract(inspectRenderedDeployments(documents))

describe('topology spread contract', () => {
  it('accepts the complete production contract', () => {
    assert.deepEqual(failuresFor(renderedContract()), [])
  })

  it('rejects a constraint that selects another workload', () => {
    const failures = failuresFor(
      withConstraints(renderedContract(), 'frontend-assessment', [
        spreadConstraint('frontend-pwa-assessment', zoneKey),
        spreadConstraint('frontend-pwa-assessment', hostnameKey),
      ])
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('frontend-assessment') &&
          failure.includes(zoneKey) &&
          failure.includes('selects "frontend-pwa-assessment"')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects a missing zone constraint', () => {
    const failures = failuresFor(
      withConstraints(renderedContract(), 'frontend-assessment', [
        spreadConstraint('frontend-assessment', hostnameKey),
      ])
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('frontend-assessment') &&
          failure.includes(
            `expected exactly one ${zoneKey} constraint, found 0`
          )
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects a hard scheduling policy', () => {
    const failures = failuresFor(
      withConstraints(renderedContract(), 'backend-assessment', [
        spreadConstraint('backend-assessment', zoneKey, {
          whenUnsatisfiable: 'DoNotSchedule',
        }),
        spreadConstraint('backend-assessment', hostnameKey),
      ])
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('backend-assessment') &&
          failure.includes('whenUnsatisfiable "DoNotSchedule"') &&
          failure.includes('expected ScheduleAnyway')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects a maxSkew other than one', () => {
    const failures = failuresFor(
      withConstraints(renderedContract(), 'mcp-student', [
        spreadConstraint('mcp-student', zoneKey, { maxSkew: 2 }),
        spreadConstraint('mcp-student', hostnameKey),
      ])
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('mcp-student') &&
          failure.includes('maxSkew 2, expected 1')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects a workload whose values never reach the pod spec', () => {
    const failures = failuresFor(
      withConstraints(renderedContract(), 'hatchet-worker-general', undefined)
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('hatchet-worker-general') &&
          failure.includes('forwards no topologySpreadConstraints') &&
          failure.includes('hatchet.workers.general stays inert')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects a workload that is missing from the render', () => {
    const failures = failuresFor(
      renderedContract().filter(
        (document) =>
          document.metadata.name !== 'app-klicker-backend-assessment'
      )
    )
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('backend-assessment') &&
          failure.includes('no Deployment carries this')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects constraints on a workload outside the contract', () => {
    const failures = failuresFor([
      ...renderedContract(),
      deployment('chat', spreadConstraints('chat')),
    ])
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('chat') &&
          failure.includes('although the expected contract does not cover')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects an empty spread field on a workload outside the contract', () => {
    const failures = failuresFor([
      ...renderedContract(),
      deployment('chat', []),
    ])
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('chat') &&
          failure.includes('renders topologySpreadConstraints (0 constraints)')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects constraints on a pod template without a component label', () => {
    const labelled = deployment('chat', spreadConstraints('chat'))
    const failures = failuresFor([
      ...renderedContract(),
      {
        ...labelled,
        metadata: { name: 'app-klicker-unlabelled' },
        spec: {
          template: {
            metadata: { labels: {} },
            spec: labelled.spec.template.spec,
          },
        },
      },
    ])
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('app-klicker-unlabelled') &&
          failure.includes('without an app.kubernetes.io/component pod label')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })
})

describe('spread field absence in a render', () => {
  it('reports a rendered spread field with its resource identity', () => {
    const fields = findRenderedSpreadFields([
      deployment('chat', spreadConstraints('chat')),
    ])
    assert.deepEqual(fields, [
      {
        kind: 'Deployment',
        name: 'app-klicker-chat',
        path: '$.spec.template.spec.topologySpreadConstraints',
      },
    ])
  })

  it('ignores the field name inside string data', () => {
    const fields = findRenderedSpreadFields([
      {
        kind: 'ConfigMap',
        metadata: { name: 'app-klicker-global' },
        data: {
          NOTE: 'topologySpreadConstraints stay empty unless the values define them',
        },
      },
    ])
    assert.deepEqual(fields, [])
  })

  it('reports no field for a render without spread constraints', () => {
    assert.deepEqual(
      findRenderedSpreadFields([
        deployment('chat', undefined),
        deployment('frontend-assessment', undefined),
      ]),
      []
    )
  })
})

describe('production spread field scope', () => {
  it('accepts the field on the contract Deployments', () => {
    assert.deepEqual(findUnlistedSpreadFields(renderedContract()), [])
  })

  it('rejects the field on a workload of another kind', () => {
    const failures = findUnlistedSpreadFields([
      ...renderedContract(),
      {
        kind: 'Job',
        metadata: { name: 'app-klicker-migrate' },
        spec: {
          template: {
            spec: { topologySpreadConstraints: spreadConstraints('migrate') },
          },
        },
      },
    ])
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('Job app-klicker-migrate') &&
          failure.includes('$.spec.template.spec.topologySpreadConstraints') &&
          failure.includes('covers only Deployment pod specs')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })

  it('rejects the field nested outside the pod spec of a Deployment', () => {
    const labelled = deployment('chat', spreadConstraints('chat'))
    const failures = findUnlistedSpreadFields([
      {
        ...labelled,
        spec: {
          topologySpreadConstraints:
            labelled.spec.template.spec.topologySpreadConstraints,
          template: labelled.spec.template,
        },
      },
    ])
    assert.ok(
      failures.some(
        (failure) =>
          failure.includes('Deployment app-klicker-chat') &&
          failure.includes('$.spec.topologySpreadConstraints') &&
          failure.includes('covers only Deployment pod specs')
      ),
      `unexpected failures: ${failures.join(' | ')}`
    )
  })
})
