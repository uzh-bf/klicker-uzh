const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const {
  attributeDivergence,
  evaluateParity,
  normalizeDeployFile,
} = require('./deploy-parity.cjs')

const CHART_TEMPLATE =
  'deploy/charts/klicker-uzh-v3/templates/cm-mcp-lecturer.yaml'
const CHART_VALUES = 'deploy/charts/klicker-uzh-v3/values.yaml'
const ENV_VALUES = 'deploy/env-uzh-prd/values.yaml'

const configMap = (extra) =>
  [
    'apiVersion: v1',
    'kind: ConfigMap',
    'data:',
    '  MCP_LECTURER_HOST: "0.0.0.0"',
    ...(extra ?? []),
    '',
  ].join('\n')

const envValues = (tag, pullPolicy, replicaCount) =>
  [
    'mcpLecturer:',
    '  replicaCount: ' + replicaCount,
    '  image:',
    '    repository: ghcr.io/uzh-bf/klicker-uzh/mcp-lecturer-arm',
    '    pullPolicy: ' + pullPolicy,
    '    tag: ' + tag,
    '',
  ].join('\n')

describe('deploy parity between the integration branches', () => {
  it('passes when the two revisions match', () => {
    const { violations, environmentOwned } = evaluateParity([])
    assert.deepEqual(violations, [])
    assert.deepEqual(environmentOwned, [])
  })

  it('fails on a listed difference outside the environment values', () => {
    const changes = [
      {
        status: 'M',
        path: CHART_TEMPLATE,
        otherText: configMap(),
        candidateText: configMap(),
      },
    ]
    const { violations, environmentOwned } = evaluateParity(changes)
    assert.deepEqual(environmentOwned, [])
    assert.deepEqual(violations, [{ path: CHART_TEMPLATE, kind: 'content' }])
  })

  it('fails when a template carries a fix on one revision only', () => {
    const changes = [
      {
        status: 'M',
        path: CHART_TEMPLATE,
        otherText: configMap(),
        candidateText: configMap(['  FASTMCP_STATELESS: "true"']),
      },
    ]
    const { violations } = evaluateParity(changes)
    assert.deepEqual(violations, [{ path: CHART_TEMPLATE, kind: 'content' }])
  })

  it('fails when a path exists on one revision only', () => {
    const changes = [
      { status: 'A', path: CHART_TEMPLATE },
      { status: 'D', path: CHART_VALUES },
    ]
    const { violations } = evaluateParity(changes)
    assert.deepEqual(violations, [
      { path: CHART_TEMPLATE, kind: 'only-candidate' },
      { path: CHART_VALUES, kind: 'only-other' },
    ])
  })

  it('tolerates environment-owned image references', () => {
    const changes = [
      {
        status: 'M',
        path: ENV_VALUES,
        otherText: envValues('v3.4.0-alpha.61', 'Always', 2),
        candidateText: envValues('v3.4.0-alpha.79', 'IfNotPresent', 2),
      },
    ]
    const { violations, environmentOwned } = evaluateParity(changes)
    assert.deepEqual(violations, [])
    assert.deepEqual(environmentOwned, [ENV_VALUES])
  })

  it('fails on environment values that differ outside the image reference', () => {
    const changes = [
      {
        status: 'M',
        path: ENV_VALUES,
        otherText: envValues('v3.4.0-alpha.79', 'IfNotPresent', 2),
        candidateText: envValues('v3.4.0-alpha.79', 'IfNotPresent', 3),
      },
    ]
    const { violations } = evaluateParity(changes)
    assert.deepEqual(violations, [{ path: ENV_VALUES, kind: 'content' }])
  })

  it('does not treat image references of the chart defaults as environment-owned', () => {
    const changes = [
      {
        status: 'M',
        path: CHART_VALUES,
        otherText: 'image:\n  tag: v3.4.0-alpha.61\n',
        candidateText: 'image:\n  tag: v3.4.0-alpha.79\n',
      },
    ]
    const { violations } = evaluateParity(changes)
    assert.deepEqual(violations, [{ path: CHART_VALUES, kind: 'content' }])
  })

  it('keeps the key structure of environment values comparable', () => {
    const normalized = normalizeDeployFile(
      ENV_VALUES,
      envValues('v3.4.0-alpha.79', 'IfNotPresent', 2)
    )
    assert.match(normalized, /replicaCount: 2/)
    assert.match(normalized, /tag: <environment-owned>/)
    assert.match(normalized, /pullPolicy: <environment-owned>/)
  })
})

describe('deploy parity attribution', () => {
  it('blocks a divergence the change itself introduced', () => {
    const violations = [{ path: CHART_TEMPLATE, kind: 'content' }]
    const { blocking, preexisting } = attributeDivergence(violations, true)
    assert.deepEqual(blocking, violations)
    assert.deepEqual(preexisting, [])
  })

  it('reports a divergence the change did not introduce without failing it', () => {
    const violations = [
      { path: CHART_TEMPLATE, kind: 'only-candidate' },
      { path: CHART_VALUES, kind: 'content' },
    ]
    const { blocking, preexisting } = attributeDivergence(violations, false)
    assert.deepEqual(blocking, [])
    assert.deepEqual(preexisting, violations)
  })
})
