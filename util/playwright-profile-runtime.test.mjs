import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildStartCommand,
  resolveRuntimePlan,
  validateRuntimePlan,
} from './playwright-profile-runtime.mjs'

function profilePlan(overrides = {}) {
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
    contractPath: 'playwright/runtime-contract.yml',
    bindings: {
      serviceEndpoints: [
        'http://127.0.0.1:3000/healthz',
        'http://127.0.0.1:3010',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3001',
      ],
      turboFilters: [
        '--filter=@klicker-uzh/backend-docker',
        '--filter=@klicker-uzh/auth',
        '--filter=@klicker-uzh/frontend-manage',
        '--filter=@klicker-uzh/frontend-pwa',
      ],
    },
    ...overrides,
  }
}

test('accepts deterministic repository-owned bindings', () => {
  const runtime = validateRuntimePlan(profilePlan())

  assert.deepEqual(runtime, {
    schemaVersion: 1,
    profile: 'manage,pwa',
    apps: ['api', 'auth', 'manage', 'pwa'],
    upstreamReadiness: ['api', 'manage', 'pwa'],
    managedServices: [
      'hatchet',
      'postgres',
      'redis_assessment',
      'redis_cache',
      'redis_exec',
    ],
    serviceEndpoints: [
      'http://127.0.0.1:3000/healthz',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3010',
    ],
    turboFilters: [
      '--filter=@klicker-uzh/auth',
      '--filter=@klicker-uzh/backend-docker',
      '--filter=@klicker-uzh/frontend-manage',
      '--filter=@klicker-uzh/frontend-pwa',
    ],
  })
})

test('response-api adds both Hatchet workers and its health endpoint', () => {
  const runtime = validateRuntimePlan(
    profilePlan({
      profile: 'live-quiz,manage',
      apps: ['api', 'auth', 'control', 'manage', 'pwa', 'response-api'],
      readiness: ['api', 'manage', 'pwa', 'response-api'],
      bindings: {
        serviceEndpoints: [
          'http://127.0.0.1:3000/healthz',
          'http://127.0.0.1:3010',
          'http://127.0.0.1:3003',
          'http://127.0.0.1:3002',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:7078/healthz',
        ],
        turboFilters: [
          '--filter=@klicker-uzh/backend-docker',
          '--filter=@klicker-uzh/auth',
          '--filter=@klicker-uzh/frontend-control',
          '--filter=@klicker-uzh/frontend-manage',
          '--filter=@klicker-uzh/frontend-pwa',
          '--filter=@klicker-uzh/hatchet-worker-general',
          '--filter=@klicker-uzh/hatchet-worker-response-processor',
          '--filter=@klicker-uzh/response-api',
        ],
      },
    })
  )

  assert.ok(runtime.turboFilters.includes('--filter=@klicker-uzh/response-api'))
  assert.ok(
    runtime.turboFilters.includes(
      '--filter=@klicker-uzh/hatchet-worker-general'
    )
  )
  assert.ok(
    runtime.turboFilters.includes(
      '--filter=@klicker-uzh/hatchet-worker-response-processor'
    )
  )
  assert.ok(runtime.serviceEndpoints.includes('http://127.0.0.1:7078/healthz'))
})

test('the exact contract path and binding keys fail closed', () => {
  assert.throws(
    () =>
      validateRuntimePlan(
        profilePlan({ contractPath: 'playwright/other-contract.yml' })
      ),
    /contractPath must equal playwright\/runtime-contract.yml/
  )
  assert.throws(
    () =>
      validateRuntimePlan({
        ...profilePlan(),
        bindings: { ...profilePlan().bindings, unexpected: ['value'] },
      }),
    /binding keys must equal serviceEndpoints, turboFilters/
  )
})

test('unsupported dependencies and malformed managed resources fail closed', () => {
  assert.throws(
    () => validateRuntimePlan(profilePlan({ dependencies: ['db'] })),
    /Playwright runtime does not support dependencies/
  )
  assert.throws(
    () =>
      validateRuntimePlan(
        profilePlan({
          managedRuntime: {
            ...profilePlan().managedRuntime,
            services: ['hatchet', 'hatchet'],
          },
        })
      ),
    /managedRuntime.services must not contain duplicates/
  )
  assert.throws(
    () =>
      validateRuntimePlan(
        profilePlan({
          managedRuntime: {
            ...profilePlan().managedRuntime,
            processes: 'klicker-dev',
          },
        })
      ),
    /managedRuntime.processes must be an array/
  )
})

test('empty app selections and readiness widening fail closed', () => {
  assert.throws(
    () => validateRuntimePlan(profilePlan({ apps: [] })),
    /must select at least one app/
  )
  assert.throws(
    () =>
      validateRuntimePlan(
        profilePlan({ readiness: ['api', 'unselected-app'] })
      ),
    /readiness app unselected-app is not selected/
  )
})

test('shell-like Turbo arguments and external endpoints fail closed', () => {
  assert.throws(
    () =>
      validateRuntimePlan({
        ...profilePlan(),
        bindings: {
          ...profilePlan().bindings,
          turboFilters: [
            ...profilePlan().bindings.turboFilters,
            '--filter=@klicker-uzh/frontend-pwa;touch',
          ],
        },
      }),
    /unsafe Turbo filter/
  )
  assert.throws(
    () =>
      validateRuntimePlan({
        ...profilePlan(),
        bindings: {
          ...profilePlan().bindings,
          serviceEndpoints: ['http://example.invalid'],
        },
      }),
    /unsafe service endpoint/
  )
})

test('the start command passes validated filters as distinct argv entries', () => {
  const runtime = validateRuntimePlan(profilePlan())

  assert.deepEqual(buildStartCommand(runtime), {
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

test('installed Devrouter plans every shard profile union from the real contract', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'klicker-profile-plan-'))
  const profiles = ['manage,pwa', 'live-quiz,manage,pwa', 'chat,manage,pwa']

  try {
    const runtimes = profiles.map((profile, index) => {
      const output = join(outputDir, `profile-${index}.json`)
      const runtime = resolveRuntimePlan({ profile, output })
      assert.equal(statSync(output).mode & 0o777, 0o600)
      return runtime
    })

    assert.deepEqual(
      runtimes.map((runtime) => runtime.turboFilters.length),
      [4, 8, 5]
    )
    assert.ok(
      runtimes[1].turboFilters.includes(
        '--filter=@klicker-uzh/hatchet-worker-response-processor'
      )
    )
    assert.ok(
      runtimes[2].serviceEndpoints.includes('http://127.0.0.1:3004/noLogin')
    )
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})
