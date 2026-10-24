import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import stagingImageTargets from '../.github/scripts/staging-image-targets.cjs'
import {
  buildPreviewPlan,
  loadRuntimeContract,
  resolveCanonicalProfile,
  selectIntent,
  selectPreviewSource,
  validateCanonicalResolved,
} from './northflank-preview-plan.mjs'

const DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY = resolve(DIRECTORY, '..')
const CONTRACT = join(REPOSITORY, 'deploy/northflank/runtime-contract.yml')
const SCRIPT = join(DIRECTORY, 'northflank-preview-plan.mjs')
const CONTROLLER_SHA = 'a'.repeat(40)
const BASE_SHA = 'b'.repeat(40)
const CANDIDATE_SHA = 'c'.repeat(40)
const PROFILES = [
  'ai',
  'chat',
  'db',
  'eduid',
  'email',
  'full',
  'live-quiz',
  'manage',
  'mcp',
  'playwright',
  'pwa',
]
const ROUTE_APPS = {
  manage: ['manage'],
  pwa: ['pwa'],
  chat: ['chat', 'pwa'],
  'live-quiz': ['control', 'pwa', 'response-api'],
  playwright: ['chat', 'control', 'manage', 'pwa', 'response-api'],
}

function devrouterFixture(candidateAdditions = false) {
  const profiles = Object.fromEntries(PROFILES.map((name) => [name, {}]))
  if (candidateAdditions) {
    profiles.standard = { default: true }
    profiles.workers = {}
  }
  const services = candidateAdditions
    ? [
        'redis_exec',
        'redis_assessment',
        'redis_cache',
        'litellm',
        'mailhog',
        'azurite',
        'mcp_postgres',
        'oidc',
      ]
    : [
        'redis_exec',
        'redis_assessment',
        'redis_cache',
        'litellm',
        'mailhog',
        'oidc',
      ]
  const apps = [
    'api',
    'auth',
    'chat',
    'control',
    'manage',
    'pwa',
    'lti',
    'olat-api',
    'response-api',
    'db',
    'oidc',
    ...(candidateAdditions ? ['blob'] : []),
  ]
  return JSON.stringify({
    version: 1,
    profiles,
    managedRuntime: {
      devcontainer: {
        baseServices: [
          'postgres',
          ...(candidateAdditions ? ['azurite'] : []),
          'hatchet',
        ],
        profileServices: services,
      },
      processes: ['klicker-dev', 'klicker-local-mcp'],
    },
    apps: apps.map((name) => ({ name })),
  })
}

function fixture(t, { candidateAdditions = false, includeMcp = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'northflank-plan-'))
  const contract = join(root, 'deploy/northflank/runtime-contract.yml')
  mkdirSync(dirname(contract), { recursive: true })
  copyFileSync(CONTRACT, contract)
  mkdirSync(join(root, 'util'), { recursive: true })
  copyFileSync(
    join(REPOSITORY, 'util/profile-resolver.sh'),
    join(root, 'util/profile-resolver.sh')
  )
  writeFileSync(
    join(root, '.devrouter.yml'),
    devrouterFixture(candidateAdditions)
  )
  for (const target of stagingImageTargets.STAGING_IMAGE_TARGETS) {
    if (target.optional && !includeMcp) continue
    const dockerfile = join(root, target.dockerfile)
    mkdirSync(dirname(dockerfile), { recursive: true })
    const port = target.id === 'response-api-arm' ? 7078 : 3000
    writeFileSync(dockerfile, `EXPOSE ${port}\n`)
  }
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function resolvedProfile(repo, profile) {
  const names = new Set(profile.split(','))
  const apps = new Set()
  const services = new Set(['postgres', 'hatchet'])
  const processes = new Set()
  const addApplications = () => {
    apps.add('api')
    apps.add('auth')
    for (const name of ['redis_exec', 'redis_assessment', 'redis_cache']) {
      services.add(name)
    }
    processes.add('klicker-dev')
  }
  if (names.has('full')) {
    for (const name of [
      'api',
      'auth',
      'chat',
      'control',
      'db',
      'lti',
      'manage',
      'olat-api',
      'oidc',
      'pwa',
      'response-api',
    ]) {
      apps.add(name)
    }
    for (const name of [
      'redis_exec',
      'redis_assessment',
      'redis_cache',
      'litellm',
      'mailhog',
      'oidc',
    ]) {
      services.add(name)
    }
    processes.add('klicker-dev')
    processes.add('klicker-local-mcp')
  }
  const routes = Object.entries(ROUTE_APPS).filter(([name]) => names.has(name))
  if (routes.length > 0) {
    addApplications()
    for (const [, routeApps] of routes) {
      for (const name of routeApps) apps.add(name)
    }
  }
  if (names.has('ai')) services.add('litellm')
  if (names.has('email')) services.add('mailhog')
  if (names.has('eduid')) {
    apps.add('oidc')
    services.add('oidc')
  }
  if (names.has('db')) apps.add('db')
  if (names.has('mcp')) processes.add('klicker-local-mcp')
  return {
    schemaVersion: 1,
    repoPath: repo,
    profile,
    apps: [...apps].sort(),
    dependencies: [],
    readiness: [],
    managedRuntime: {
      baseServices: ['postgres', 'hatchet'],
      profileServices: [...services]
        .filter((name) => !['postgres', 'hatchet'].includes(name))
        .sort(),
      services: [...services].sort(),
      processes: [...processes].sort(),
    },
  }
}

function plan(t, options = {}) {
  const root = options.root ?? fixture(t, options)
  return buildPreviewPlan({
    controllerRoot: root,
    candidateRoot: root,
    baseSha: BASE_SHA,
    candidateSha: CANDIDATE_SHA,
    controllerSha: CONTROLLER_SHA,
    sourceSelection: { eventName: 'push', sourceBranch: 'v3-ai' },
    profileResolver: ({ repo, profile }) => resolvedProfile(repo, profile),
    workerMarker: (profiles) =>
      profiles
        .split(',')
        .some((name) => name === 'full' || name === 'live-quiz'),
    ...options,
  })
}

test('chat plans its app/data closure without management, live-quiz, or workers', (t) => {
  const result = plan(t, {
    changedRecords: [{ kind: 'M', paths: ['apps/chat/src/page.tsx'] }],
  })
  assert.equal(result.status, 'planning-ready')
  assert.deepEqual(result.profile.canonical, ['ai,chat,mcp'])
  assert.deepEqual(result.apps, ['api', 'auth', 'chat', 'pwa'])
  assert.deepEqual(result.resources.dataResources, [
    'postgres',
    'redis_assessment',
    'redis_cache',
    'redis_exec',
  ])
  assert.equal(
    result.resources.bindings.some(
      (binding) =>
        binding.binding === 'klicker-local-mcp' && binding.kind === 'process'
    ),
    true
  )
  assert.deepEqual(result.workerMarker, {
    evaluated: true,
    selected: false,
    images: [],
  })
  const bindings = new Set(
    result.resources.bindings.map((binding) => binding.binding)
  )
  for (const name of ['manage', 'control', 'response-api', 'migrator']) {
    assert.equal(bindings.has(name), false, name)
  }
})

test('full plans the complete inventory, four data services, and both workers', (t) => {
  const result = plan(t, {
    changedRecords: [
      { kind: 'M', paths: ['packages/shared-components/button.tsx'] },
    ],
  })
  assert.deepEqual(result.profile.canonical, ['full'])
  assert.equal(
    result.images.inventory.length +
      Object.keys(loadRuntimeContract().unsupportedResources).length,
    16
  )
  assert.deepEqual(result.resources.dataResources, [
    'postgres',
    'redis_assessment',
    'redis_cache',
    'redis_exec',
  ])
  assert.equal(
    result.resources.bindings.filter((binding) => binding.binding === 'oidc')
      .length,
    1
  )
  assert.equal(
    result.images.inventory.find(
      (image) => image.targetId === 'frontend-assessment-arm'
    ).excluded,
    true
  )
  assert.deepEqual(result.workerMarker, {
    evaluated: true,
    selected: true,
    images: ['worker-general', 'worker-response'],
  })
  const targets = new Set(result.images.builds.map((build) => build.targetId))
  for (const target of [
    'backend-docker-migrator-arm',
    'hatchet-worker-general-arm',
    'hatchet-worker-response-processor-arm',
  ]) {
    assert.equal(targets.has(target), true, target)
  }
  assert.equal(targets.has('frontend-assessment-arm'), false)
})

test('intent table covers renames, documentation, artifacts, fallback, seeds, and LiteLLM', () => {
  const contract = loadRuntimeContract()
  const renamed = selectIntent(
    [{ kind: 'R', paths: ['docs/chat.md', 'apps/chat/src/page.tsx'] }],
    contract
  )
  assert.deepEqual(renamed.paths, ['apps/chat/src/page.tsx', 'docs/chat.md'])
  assert.deepEqual(renamed.canonicalProfiles, ['ai,chat,mcp'])
  assert.equal(
    selectIntent(['docs/runtime.md'], contract).mode,
    'documentation-only'
  )
  assert.equal(
    selectIntent(['project/plan.md'], contract).mode,
    'documentation-only'
  )
  assert.deepEqual(selectIntent(['apps/docs/src/page.tsx'], contract).intents, [
    'artifact-checks',
  ])
  for (const path of [
    'packages/shared-components/x.tsx',
    'package.json',
    'new/file',
  ]) {
    const intent = selectIntent([path], contract)
    assert.deepEqual(intent.canonicalProfiles, ['full'])
    assert.deepEqual(intent.intents[0].extraImages, ['migrator'])
  }
  const seed = selectIntent(['packages/prisma-data/src/seed.ts'], contract)
  assert.equal(seed.recreation.required, true)
  assert.deepEqual(seed.canonicalProfiles, ['full'])
  assert.deepEqual(
    selectIntent(['util/litellm/config.yaml'], contract).canonicalProfiles,
    ['ai,chat']
  )
})

test('unsafe profiles and noncanonical resolver results fail closed', (t) => {
  const root = fixture(t)
  const contract = loadRuntimeContract()
  assert.throws(
    () =>
      resolveCanonicalProfile({
        profile: 'chat,unknown',
        candidateRoot: root,
        allowedProfiles: PROFILES,
        profileResolver: () => assert.fail('resolver must not run'),
        contract,
      }),
    { code: 'INVALID_PLAN_INPUT' }
  )
  const valid = resolvedProfile(root, 'chat')
  assert.throws(
    () =>
      validateCanonicalResolved(
        { ...valid, schemaVersion: 2 },
        { profile: 'chat', root },
        contract
      ),
    /schemaVersion/
  )
  assert.throws(
    () =>
      validateCanonicalResolved(
        { ...valid, apps: [...valid.apps, 'unknown'] },
        { profile: 'chat', root },
        contract
      ),
    { code: 'MISSING_CONTROLLER_OBJECT' }
  )
})

test('candidate control drift blocks and names unsupported v3-ai objects', (t) => {
  const root = fixture(t)
  const candidate = fixture(t, {
    candidateAdditions: true,
    includeMcp: true,
  })
  assert.throws(
    () =>
      plan(t, {
        controllerRoot: root,
        candidateRoot: candidate,
        changedRecords: [{ kind: 'M', paths: ['apps/analytics/run.py'] }],
      }),
    (error) => {
      assert.equal(error.code, 'CANDIDATE_CONTROL_DRIFT')
      const names = new Set(
        error.details.unsupportedCandidateObjects.map(
          (item) => `${item.kind}:${item.name}`
        )
      )
      for (const name of [
        'profile:standard',
        'profile:workers',
        'profile-default:standard',
      ]) {
        assert.equal(names.has(name), true, name)
      }
      return true
    }
  )
})

test('analytics-only changes plan only Postgres fixtures and the analytics image', (t) => {
  const result = plan(t, {
    changedRecords: [{ kind: 'M', paths: ['apps/analytics/run.py'] }],
  })
  assert.equal(result.intentSelection.auxJob, true)
  assert.equal(result.postgresFixturesRequired, true)
  assert.deepEqual(
    result.resources.bindings.map((binding) => binding.binding),
    ['analytics', 'postgres', 'postgres-fixtures']
  )
  assert.deepEqual(result.apps, [])
  assert.deepEqual(result.managedServices, ['postgres'])
  assert.deepEqual(
    result.images.builds.map((build) => build.targetId),
    ['analytics-arm']
  )
})

test('available real MCP images follow process roots without expanding Chat', (t) => {
  const result = plan(t, {
    includeMcp: true,
    changedRecords: [{ kind: 'M', paths: ['apps/chat/src/page.tsx'] }],
  })
  assert.equal(result.status, 'planning-ready')
  assert.equal(
    result.images.builds.some((build) => build.targetId.startsWith('mcp-')),
    false
  )
  const full = plan(t, { includeMcp: true, profile: 'full' })
  for (const target of ['mcp-lecturer-arm', 'mcp-student-arm']) {
    assert.equal(
      full.images.builds.some((image) => image.targetId === target),
      true
    )
  }
})

test('only a controller-qualified pair of profile files can expand candidate controls', (t) => {
  const root = fixture(t)
  const candidate = fixture(t, { candidateAdditions: true, includeMcp: true })
  const contract = loadRuntimeContract()
  const files = Object.fromEntries(
    ['.devrouter.yml', 'util/profile-resolver.sh'].map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(join(candidate, path)))
        .digest('hex'),
    ])
  )
  writeFileSync(
    join(root, 'deploy/northflank/runtime-contract.yml'),
    JSON.stringify({
      ...contract,
      qualifiedProfiles: [{ revision: CANDIDATE_SHA, files }],
    })
  )
  writeFileSync(join(candidate, 'deploy/northflank/runtime-contract.yml'), '{}')
  const result = plan(t, {
    controllerRoot: root,
    candidateRoot: candidate,
    profile: 'chat',
  })
  assert.equal(result.controlParity.status, 'qualified')
  assert.equal(result.controlParity.qualifiedRevision, CANDIDATE_SHA)
  writeFileSync(
    join(candidate, 'util/profile-resolver.sh'),
    '# unqualified replacement\n'
  )
  assert.throws(
    () =>
      plan(t, {
        controllerRoot: root,
        candidateRoot: candidate,
        profile: 'chat',
      }),
    { code: 'CANDIDATE_CONTROL_DRIFT' }
  )
})

test('contract ports and source opt-in metadata reflect the hosted boundary', () => {
  const contract = loadRuntimeContract()
  for (const name of [
    'api',
    'auth',
    'chat',
    'control',
    'manage',
    'pwa',
    'olat-api',
  ]) {
    assert.equal(contract.apps[name].nativePort, 3000, name)
  }
  assert.equal(contract.apps.lti.nativePort, 4000)
  assert.equal(contract.apps['response-api'].nativePort, 7078)
  assert.equal(contract.apps.db.publicListener, false)
  assert.equal(
    selectPreviewSource({ eventName: 'push', sourceBranch: 'v3-ai' }, contract)
      .eligible,
    true
  )
  assert.equal(
    selectPreviewSource(
      {
        eventName: 'pull_request',
        sourceBranch: 'feature/test',
        labels: ['preview'],
      },
      contract
    ).eligible,
    false
  )
})

test('CLI help succeeds without reading the workspace', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'northflank-help-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const result = spawnSync(process.execPath, [SCRIPT, '--help'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /--profile <names>/)
})
