import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRuntimePlan,
  buildStartCommand,
  validateRuntimePlan,
} from './playwright-profile-runtime.mjs'

function report(overrides = {}) {
  return {
    schemaVersion: 1,
    repoPath: '/repo',
    profile: 'manage,pwa',
    apps: ['api', 'auth', 'manage', 'pwa'],
    dependencies: [],
    readiness: ['api', 'manage', 'pwa'],
    managedRuntime: {
      baseServices: ['hatchet', 'postgres'],
      profileServices: ['redis_assessment', 'redis_cache', 'redis_exec'],
      services: [
        'hatchet',
        'postgres',
        'redis_assessment',
        'redis_cache',
        'redis_exec',
      ],
      processes: ['klicker-dev'],
    },
    ...overrides,
  }
}

test('maps selected apps to exact Turbo filters and readiness endpoints', () => {
  const plan = buildRuntimePlan(report())

  assert.deepEqual(plan.turboFilters, [
    '--filter=@klicker-uzh/auth',
    '--filter=@klicker-uzh/backend-docker',
    '--filter=@klicker-uzh/frontend-manage',
    '--filter=@klicker-uzh/frontend-pwa',
  ])
  assert.deepEqual(plan.serviceEndpoints, [
    'http://127.0.0.1:3000/healthz',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3010',
  ])
  assert.deepEqual(validateRuntimePlan(plan), plan)
})

test('response-api adds both Hatchet workers and its health endpoint', () => {
  const plan = buildRuntimePlan(
    report({
      profile: 'live-quiz,manage',
      apps: ['api', 'auth', 'control', 'manage', 'pwa', 'response-api'],
      readiness: ['api', 'manage', 'pwa', 'response-api'],
    })
  )

  assert.ok(plan.turboFilters.includes('--filter=@klicker-uzh/response-api'))
  assert.ok(
    plan.turboFilters.includes('--filter=@klicker-uzh/hatchet-worker-general')
  )
  assert.ok(
    plan.turboFilters.includes(
      '--filter=@klicker-uzh/hatchet-worker-response-processor'
    )
  )
  assert.ok(plan.serviceEndpoints.includes('http://127.0.0.1:7078/healthz'))
})

test('unknown apps and shell-like values fail closed', () => {
  assert.throws(
    () =>
      buildRuntimePlan(
        report({ apps: ['api', 'unknown'], readiness: ['api'] })
      ),
    /unsupported Playwright app unknown/
  )
  assert.throws(
    () =>
      buildRuntimePlan(
        report({ apps: ['api', 'pwa;touch /tmp/x'], readiness: ['api'] })
      ),
    /unsupported Playwright app/
  )
})

test('unsupported dependencies, services, and processes fail closed', () => {
  assert.throws(
    () => buildRuntimePlan(report({ dependencies: ['db'] })),
    /unsupported Devrouter dependencies/
  )
  assert.throws(
    () =>
      buildRuntimePlan(
        report({
          managedRuntime: {
            ...report().managedRuntime,
            services: ['hatchet', 'litellm', 'postgres'],
          },
        })
      ),
    /unsupported managed service litellm/
  )
  assert.throws(
    () =>
      buildRuntimePlan(
        report({
          managedRuntime: {
            ...report().managedRuntime,
            processes: ['klicker-dev', 'klicker-local-mcp'],
          },
        })
      ),
    /managedRuntime.processes does not match/
  )
})

test('a modified runtime plan cannot inject a Turbo argument or endpoint', () => {
  const plan = buildRuntimePlan(report())

  assert.throws(
    () =>
      validateRuntimePlan({
        ...plan,
        turboFilters: [...plan.turboFilters, '--filter=malicious'],
      }),
    /turboFilters does not match/
  )
  assert.throws(
    () =>
      validateRuntimePlan({
        ...plan,
        serviceEndpoints: ['http://example.invalid'],
      }),
    /serviceEndpoints does not match/
  )
})

test('the start command passes validated filters as distinct argv entries', () => {
  const plan = buildRuntimePlan(report())

  assert.deepEqual(buildStartCommand(plan), {
    command: 'bash',
    args: [
      './util/_with_local_test_origins.sh',
      'cross-env',
      'NODE_ENV=test',
      'turbo',
      'run',
      'start:test',
      '--filter=@klicker-uzh/auth',
      '--filter=@klicker-uzh/backend-docker',
      '--filter=@klicker-uzh/frontend-manage',
      '--filter=@klicker-uzh/frontend-pwa',
    ],
  })
})
