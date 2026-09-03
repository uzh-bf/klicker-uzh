import assert from 'node:assert/strict'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildGrowthBookCommand,
  buildStartCommand,
  createTerminalAccounting,
  resolveRuntimePlan,
  stopRunningChildren,
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

test('the runtime keeps the mock GrowthBook server running beside the apps', () => {
  assert.deepEqual(buildGrowthBookCommand(), {
    command: 'node',
    args: ['./playwright/util/mockGrowthBookServer.mjs'],
  })
  statSync(
    new URL('../playwright/util/mockGrowthBookServer.mjs', import.meta.url)
  )
})

test('terminal accounting records each child once and keeps the first failure', () => {
  const first = createTerminalAccounting(2)
  assert.equal(first.record(0, null), undefined)
  assert.equal(first.record(0, 1), undefined)
  assert.equal(first.record(1, 3), 3)

  const second = createTerminalAccounting(2)
  assert.equal(second.record(0, 7), undefined)
  assert.equal(second.record(0, 9), undefined)
  assert.equal(second.record(1, null), 7)

  const clean = createTerminalAccounting(2)
  assert.equal(clean.record(0, null), undefined)
  assert.equal(clean.record(1, null), 0)
})

test('stopping the runtime only marks children that are still running', () => {
  const makeChild = (state) => ({
    exitCode: null,
    killed: false,
    signalCode: null,
    signals: [],
    ...state,
    kill(signal) {
      this.signals.push(signal)
      if (this.killFails) {
        return false
      }
      this.killed = true
      return true
    },
  })
  const exited = makeChild({ exitCode: 1 })
  const signaled = makeChild({ signalCode: 'SIGKILL' })
  const alreadyKilled = makeChild({ killed: true })
  const justExited = makeChild({ killFails: true })
  const running = makeChild({})
  const entries = [
    { name: 'exited', child: exited, stoppedByUs: false },
    { name: 'signaled', child: signaled, stoppedByUs: false },
    { name: 'alreadyKilled', child: alreadyKilled, stoppedByUs: false },
    { name: 'justExited', child: justExited, stoppedByUs: false },
    { name: 'running', child: running, stoppedByUs: false },
  ]

  stopRunningChildren(entries, 'SIGTERM')

  const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry]))
  assert.equal(byName.exited.stoppedByUs, false)
  assert.deepEqual(exited.signals, [])
  assert.equal(byName.signaled.stoppedByUs, false)
  assert.deepEqual(signaled.signals, [])
  assert.equal(byName.alreadyKilled.stoppedByUs, false)
  assert.deepEqual(alreadyKilled.signals, [])
  assert.equal(byName.justExited.stoppedByUs, false)
  assert.deepEqual(justExited.signals, ['SIGTERM'])
  assert.equal(byName.running.stoppedByUs, true)
  assert.deepEqual(running.signals, ['SIGTERM'])

  stopRunningChildren(entries, 'SIGTERM')
  assert.deepEqual(running.signals, ['SIGTERM'])
})

test('workflow shard startup steps explicitly select Bash', () => {
  const action = readFileSync(
    new URL('../.github/actions/playwright-shard/action.yml', import.meta.url),
    'utf8'
  )
  assert.match(
    action,
    /- name: Start services, wait for readiness, and run Playwright tests\n\s+shell: bash\n\s+run: \|/
  )
})

test('workflow shard startup supports only complete profile or legacy runtimes', () => {
  const action = readFileSync(
    new URL('../.github/actions/playwright-shard/action.yml', import.meta.url),
    'utf8'
  )
  assert.match(action, /PROFILE_RUNTIME_FILES=/)
  assert.match(action, /profile_file_count/)
  assert.match(action, /legacy full-stack Playwright startup/)
  assert.match(action, /partially present/)
})

test('local full-stack startup stays independent from the CI runtime plan', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.equal(
    packageJson.scripts['start:playwright'],
    'run-s --npm-path pnpm build:test start:playwright:full'
  )
  assert.match(
    packageJson.scripts['start:playwright:full'],
    /turbo run start:test --filter=/
  )
  assert.equal(
    packageJson.scripts['start:playwright:ci'],
    'node ./util/playwright-profile-runtime.mjs start'
  )
})

test('accepts equivalent runtime plans with different JSON property order', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'klicker-profile-order-'))
  const output = join(outputDir, 'profile.json')
  const devrouterBin = join(outputDir, 'devrouter')
  const plan = profilePlan()

  writeFileSync(
    devrouterBin,
    `#!/usr/bin/env node
const { writeFileSync } = require('node:fs')
const args = process.argv.slice(2)
const output = args[args.indexOf('--output') + 1]
const plan = ${JSON.stringify(plan)}
const reorderedPlan = {
  bindings: plan.bindings,
  managedRuntime: plan.managedRuntime,
  readiness: plan.readiness,
  dependencies: plan.dependencies,
  apps: plan.apps,
  profile: plan.profile,
  repoPath: plan.repoPath,
  schemaVersion: plan.schemaVersion,
  contractPath: plan.contractPath,
}
writeFileSync(output, JSON.stringify(plan))
process.stdout.write(JSON.stringify(reorderedPlan))
`
  )
  chmodSync(devrouterBin, 0o755)

  try {
    const runtime = resolveRuntimePlan({
      profile: plan.profile,
      output,
      repo: plan.repoPath,
      devrouterBin,
    })
    assert.equal(runtime.profile, plan.profile)
    assert.deepEqual(runtime.apps, plan.apps)
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})

test('installed Devrouter plans every shard profile union from the real contract', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'klicker-profile-plan-'))
  const profiles = [
    'manage,pwa',
    'live-quiz,manage,pwa',
    'chat,manage,pwa',
    'full,live-quiz,manage,pwa',
  ]

  try {
    const runtimes = profiles.map((profile, index) => {
      const output = join(outputDir, `profile-${index}.json`)
      const runtime = resolveRuntimePlan({ profile, output })
      assert.equal(statSync(output).mode & 0o777, 0o600)
      return runtime
    })

    assert.deepEqual(
      runtimes.map((runtime) => runtime.turboFilters.length),
      [4, 8, 5, 9]
    )
    assert.ok(
      runtimes[1].turboFilters.includes(
        '--filter=@klicker-uzh/hatchet-worker-response-processor'
      )
    )
    assert.ok(
      runtimes[2].serviceEndpoints.includes('http://127.0.0.1:3004/noLogin')
    )
    assert.equal(runtimes[3].profile, 'playwright')
    assert.throws(
      () =>
        resolveRuntimePlan({
          profile: 'full,does-not-exist',
          output: join(outputDir, 'invalid-profile.json'),
        }),
      /does-not-exist/
    )
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})
