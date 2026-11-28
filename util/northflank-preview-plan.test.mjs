import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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
const NATIVE_PROFILE_RESULTS = {
  chat: {
    apps: ['api', 'auth', 'chat'],
    services: [
      'postgres',
      'hatchet',
      'redis_exec',
      'redis_assessment',
      'redis_cache',
    ],
    processes: ['klicker-dev'],
  },
  'ai,chat,mcp': {
    apps: ['api', 'auth', 'chat', 'pwa'],
    services: [
      'postgres',
      'hatchet',
      'redis_exec',
      'redis_assessment',
      'redis_cache',
      'litellm',
    ],
    processes: ['klicker-dev', 'klicker-local-mcp'],
  },
  full: {
    apps: [
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
    ],
    services: [
      'postgres',
      'hatchet',
      'redis_exec',
      'redis_assessment',
      'redis_cache',
      'litellm',
      'mailhog',
      'oidc',
    ],
    processes: ['klicker-dev', 'klicker-local-mcp'],
  },
  pwa: {
    apps: ['api', 'auth', 'pwa'],
    services: [
      'postgres',
      'hatchet',
      'redis_exec',
      'redis_assessment',
      'redis_cache',
    ],
    processes: ['klicker-dev'],
  },
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

function fixtureGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function commitFixture(root, message = 'fixture') {
  fixtureGit(root, ['add', '-A'])
  fixtureGit(root, [
    '-c',
    'user.name=Preview Fixture',
    '-c',
    'user.email=preview-fixture@example.invalid',
    '-c',
    'commit.gpgSign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    message,
  ])
  return headSha(root)
}

function headSha(root) {
  return fixtureGit(root, ['rev-parse', 'HEAD'])
}

function fixture(
  t,
  { candidateAdditions = false, includeMcp = false, git = true } = {}
) {
  const root = mkdtempSync(join(tmpdir(), 'northflank-plan-'))
  const contract = join(root, 'deploy/northflank/runtime-contract.yml')
  mkdirSync(dirname(contract), { recursive: true })
  copyFileSync(CONTRACT, contract)
  mkdirSync(join(root, 'util'), { recursive: true })
  copyFileSync(
    join(REPOSITORY, 'util/profile-resolver.sh'),
    join(root, 'util/profile-resolver.sh')
  )
  for (const path of [
    '.github/scripts/minimum-validation-class.cjs',
    '.github/scripts/staging-image-targets.cjs',
    'util/devrouter-cli.mjs',
    'util/northflank-preview-plan.mjs',
  ]) {
    const destination = join(root, path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(REPOSITORY, path), destination)
  }
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
  if (git) {
    fixtureGit(root, ['init', '--quiet'])
    commitFixture(root)
  }
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

function resolvedProfile(repo, profile) {
  const result = NATIVE_PROFILE_RESULTS[profile]
  assert.ok(result, `missing native fixture for ${profile}`)
  const baseServices = ['postgres', 'hatchet']
  return {
    schemaVersion: 1,
    repoPath: repo,
    profile,
    apps: [...result.apps].sort(),
    dependencies: [],
    readiness: [],
    managedRuntime: {
      baseServices,
      profileServices: [...result.services]
        .filter((name) => !baseServices.includes(name))
        .sort(),
      services: [...result.services].sort(),
      processes: [...result.processes].sort(),
    },
  }
}

function plan(t, options = {}) {
  const controllerRoot =
    options.controllerRoot ?? options.root ?? fixture(t, options)
  const candidateRoot = options.candidateRoot ?? options.root ?? controllerRoot
  return buildPreviewPlan({
    controllerRoot,
    candidateRoot,
    baseSha: headSha(candidateRoot),
    candidateSha: headSha(candidateRoot),
    controllerSha: headSha(controllerRoot),
    sourceSelection: {
      eventName: 'push',
      sourceBranch: 'v3-ai',
      repository: 'example-org/klicker-uzh',
      headRepository: 'example-org/klicker-uzh',
    },
    profileResolver: ({ repo, profile }) => resolvedProfile(repo, profile),
    workerMarker: (profiles) =>
      profiles
        .split(',')
        .some((name) => name === 'full' || name === 'live-quiz'),
    ...options,
  })
}

function nativePreviewNodes() {
  const graph = JSON.parse(
    readFileSync(
      join(REPOSITORY, 'deploy/northflank/klicker-preview.json'),
      'utf8'
    )
  )
  return graph.spec.spec.steps.flatMap((workflow) => workflow.spec.steps)
}

test('native application runtimes receive the preview cookie namespace and explicit origins', () => {
  const nodes = nativePreviewNodes()
  const applications = nodes.filter(
    (node) =>
      node.kind === 'DeploymentService' &&
      node.spec.deployment.internal &&
      node.ref !== 'local_mcp_service'
  )
  for (const node of applications) {
    assert.equal(
      node.spec.runtimeEnvironment.NEXT_PUBLIC_PREVIEW_ID,
      '${args.envId}',
      node.ref
    )
  }
  const runtime = nodes.find((node) => node.ref === 'runtime_config_secret')
  assert.equal(runtime.kind, 'SecretGroup')
  assert.equal(runtime.skipNodeExecution, '${args.skip.runtimeConfig}')
  assert.equal(runtime.spec.restrictions.restricted, true)
  assert.deepEqual(
    new Set(runtime.spec.restrictions.nfObjects),
    new Set(
      applications.map((node) => ({ id: node.spec.name, type: 'service' }))
    )
  )
  const keys = [
    'COOKIE_DOMAIN',
    'APP_ORIGIN_API',
    'APP_ORIGIN_AUTH',
    'APP_ORIGIN_MANAGE',
    'APP_ORIGIN_PWA',
    'APP_ORIGIN_LTI',
    'APP_ORIGIN_ASSESSMENT_API',
    'APP_ORIGIN_ASSESSMENT_PWA',
    'NEXTAUTH_URL',
  ]
  assert.deepEqual(
    runtime.spec.secrets.variables,
    Object.fromEntries(
      keys.map((key) => [key, '${args.runtimeEnvironment.' + key + '}'])
    )
  )
})

test('native signing secrets are supplied separately and restricted to application services', () => {
  const nodes = nativePreviewNodes()
  const targets = (ref) => {
    const group = nodes.find((node) => node.ref === ref)
    assert.equal(group.kind, 'SecretGroup')
    assert.equal(group.spec.restrictions.restricted, true)
    assert.ok(
      group.spec.restrictions.nfObjects.every(
        (object) => object.type === 'service'
      )
    )
    return group.spec.restrictions.nfObjects.map((object) => object.id).sort()
  }
  const applications = nodes
    .filter(
      (node) =>
        node.kind === 'DeploymentService' &&
        node.spec.deployment.internal &&
        node.ref !== 'local_mcp_service'
    )
    .map((node) => node.spec.name)
    .sort()
  assert.deepEqual(targets('app_signing_secret'), applications)
  assert.deepEqual(
    targets('nextauth_signing_secret'),
    ['auth', 'chat', 'control', 'manage', 'pwa'].map(
      (name) => '${args.envId}-' + name
    )
  )
  for (const [ref, key, argument] of [
    ['app_signing_secret', 'APP_SECRET', '${args.secrets.appSecret}'],
    [
      'nextauth_signing_secret',
      'NEXTAUTH_SECRET',
      '${args.secrets.nextauthSecret}',
    ],
  ]) {
    assert.deepEqual(
      nodes.find((node) => node.ref === ref).spec.secrets.variables,
      { [key]: argument }
    )
  }
})

test('native local MCP runs the server with matching host and scoped authentication', () => {
  const nodes = nativePreviewNodes()
  const harness = nodes.find((node) => node.ref === 'local_mcp_service')
  const chat = nodes.find((node) => node.ref === 'chat_service')
  assert.deepEqual(harness.spec.deployment.docker, {
    configType: 'customEntrypointCustomCommand',
    customEntrypoint: 'node',
    customCommand: '/app/apps/chat/scripts/local-mcp-server.mjs',
  })
  assert.equal(harness.spec.runtimeEnvironment.LOCAL_MCP_BIND_HOST, '0.0.0.0')
  const authority = '${args.bindings.localMcp.host}:1417'
  assert.equal(
    harness.spec.runtimeEnvironment.LOCAL_MCP_ALLOWED_HOSTS,
    authority
  )
  assert.equal(
    chat.spec.runtimeEnvironment.LOCAL_MCP_URL,
    `http://${authority}/mcp`
  )
  const auth = nodes.find((node) => node.ref === 'local_mcp_auth_secret')
  assert.equal(auth.skipNodeExecution, harness.skipNodeExecution)
  assert.equal(auth.spec.restrictions.restricted, true)
  assert.deepEqual(
    new Set(auth.spec.restrictions.nfObjects),
    new Set([
      { id: harness.spec.name, type: 'service' },
      { id: chat.spec.name, type: 'service' },
    ])
  )
  assert.deepEqual(auth.spec.secrets.variables, {
    LOCAL_MCP_TRANSPORT_TOKEN: '${args.secrets.localMcpToken}',
    LOCAL_MCP_PUBLIC_KEY: '${args.secrets.localMcpPublicKey}',
    LOCAL_MCP_GENERATION: '${args.secrets.localMcpGeneration}',
    DOC_QUERY_SCOPE_KID: '${args.secrets.localMcpGeneration}',
    DOC_QUERY_SCOPE_ISSUER: '${args.bindings.localMcp.issuer}',
    DOC_QUERY_SCOPE_AUDIENCE: '${args.bindings.localMcp.audience}',
  })
  const signer = nodes.find((node) => node.ref === 'local_mcp_signer_secret')
  assert.equal(signer.skipNodeExecution, harness.skipNodeExecution)
  assert.equal(signer.spec.restrictions.restricted, true)
  assert.deepEqual(signer.spec.restrictions.nfObjects, [
    { id: chat.spec.name, type: 'service' },
  ])
  assert.deepEqual(signer.spec.secrets.variables, {
    DOC_QUERY_SCOPE_PRIVATE_KEY: '${args.secrets.localMcpPrivateKey}',
  })
  for (const node of nodes.filter((node) => node.kind === 'SecretGroup')) {
    if (node === signer) continue
    assert.equal(
      node.spec.secrets?.variables?.DOC_QUERY_SCOPE_PRIVATE_KEY,
      undefined
    )
  }
})

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

test('push admission requires exact repository identity or contract approval', () => {
  const contract = loadRuntimeContract()
  const source = {
    eventName: 'push',
    sourceBranch: 'v3-ai',
    repository: 'example-org/klicker-uzh',
    headRepository: 'example-org/klicker-uzh',
  }
  const branchOnly = selectPreviewSource(
    { eventName: 'push', sourceBranch: 'v3-ai' },
    contract
  )
  assert.equal(branchOnly.eligible, false)
  assert.equal(branchOnly.reason, 'push-repository-unknown')

  const exact = selectPreviewSource(source, contract)
  assert.equal(exact.eligible, true)
  assert.equal(exact.reason, 'allowlisted-branch')
  assert.equal(exact.repository, source.repository)
  assert.equal(exact.headRepository, source.headRepository)

  const cases = [
    [{ ...source, headRepository: undefined }, 'push-repository-incomplete'],
    [
      { ...source, headRepository: 'someone-else/klicker-uzh' },
      'repository-mismatch',
    ],
    [{ ...source, sourceBranch: 'feature/test' }, 'branch-not-allowlisted'],
  ]
  for (const [input, reason] of cases) {
    const result = selectPreviewSource(input, contract)
    assert.equal(result.eligible, false, reason)
    assert.equal(result.reason, reason)
  }

  const approvedContract = {
    ...contract,
    sourceSelection: {
      ...contract.sourceSelection,
      repository: source.repository,
    },
  }
  const approvedOnly = selectPreviewSource(
    { eventName: 'push', sourceBranch: 'v3-ai' },
    approvedContract
  )
  assert.equal(approvedOnly.eligible, true)
  assert.equal(approvedOnly.reason, 'allowlisted-contract-repository')
  assert.equal(approvedOnly.approvedRepository, source.repository)

  const unapproved = selectPreviewSource(
    {
      ...source,
      repository: 'other-org/klicker-uzh',
      headRepository: 'other-org/klicker-uzh',
    },
    approvedContract
  )
  assert.equal(unapproved.eligible, false)
  assert.equal(unapproved.reason, 'repository-not-approved')
})

test('pull request admission accepts label or manual opt-in and fails closed on source metadata', () => {
  const contract = loadRuntimeContract()
  const source = {
    eventName: 'pull_request',
    sourceBranch: 'feature/test',
    repository: 'example-org/klicker-uzh',
    headRepository: 'example-org/klicker-uzh',
    state: 'open',
    merged: false,
    isFork: false,
  }
  const labelled = selectPreviewSource(
    { ...source, labels: ['preview'] },
    contract
  )
  assert.equal(labelled.eligible, true)
  assert.equal(labelled.reason, 'preview-label')
  assert.equal(labelled.repository, source.repository)
  assert.equal(labelled.headRepository, source.headRepository)
  assert.equal(labelled.state, 'open')
  assert.equal(labelled.merged, false)
  assert.equal(labelled.isFork, false)

  const manual = selectPreviewSource({ ...source, manualOptIn: true }, contract)
  assert.equal(manual.eligible, true)
  assert.equal(manual.reason, 'manual-opt-in')

  const both = selectPreviewSource(
    { ...source, labels: ['preview'], manualOptIn: true },
    contract
  )
  assert.equal(both.eligible, true)
  assert.equal(both.reason, 'preview-label-or-manual-opt-in')

  const cases = [
    [{ ...source, state: undefined }, 'pull-request-state-unknown'],
    [{ ...source, state: 'draft' }, 'pull-request-state-unknown'],
    [{ ...source, state: 'closed' }, 'pull-request-closed'],
    [{ ...source, merged: true }, 'pull-request-merged'],
    [{ ...source, isFork: true }, 'pull-request-fork'],
    [{ ...source, isFork: undefined }, 'pull-request-fork-unknown'],
    [{ ...source, merged: undefined }, 'pull-request-merge-state-unknown'],
    [
      { ...source, headRepository: 'someone-else/klicker-uzh' },
      'repository-mismatch',
    ],
    [{ ...source, repository: undefined }, 'pull-request-repository-unknown'],
    [source, 'preview-opt-in-missing'],
  ]
  for (const [input, reason] of cases) {
    const result = selectPreviewSource(input, contract)
    assert.equal(result.eligible, false, reason)
    assert.equal(result.reason, reason)
  }

  const approvedContract = {
    ...contract,
    sourceSelection: {
      ...contract.sourceSelection,
      repository: 'example-org/klicker-uzh',
    },
  }
  const approved = selectPreviewSource(
    { ...source, labels: ['preview'] },
    approvedContract
  )
  assert.equal(approved.eligible, true)
  const unapproved = selectPreviewSource(
    {
      ...source,
      labels: ['preview'],
      repository: 'other-org/klicker-uzh',
      headRepository: 'other-org/klicker-uzh',
    },
    approvedContract
  )
  assert.equal(unapproved.eligible, false)
  assert.equal(unapproved.reason, 'repository-not-approved')
})

test('ineligible sources and absent source changes cannot be planning-ready', (t) => {
  const root = fixture(t)
  const ineligible = plan(t, {
    root,
    changedRecords: [{ kind: 'M', paths: ['apps/chat/src/page.tsx'] }],
    sourceSelection: {
      eventName: 'push',
      sourceBranch: 'feature/test',
      repository: 'example-org/klicker-uzh',
      headRepository: 'example-org/klicker-uzh',
    },
  })
  assert.equal(ineligible.status, 'blocked')
  assert.equal(ineligible.sourceSelection.reason, 'branch-not-allowlisted')
  assert.deepEqual(ineligible.reuseEligibility.reasons, ['source-not-eligible'])

  const empty = plan(t, { root, changedRecords: [] })
  assert.equal(empty.status, 'blocked')
  assert.deepEqual(empty.reuseEligibility.reasons, ['source-changes-missing'])

  const documentation = plan(t, {
    root,
    changedRecords: [{ kind: 'M', paths: ['docs/runtime.md'] }],
  })
  assert.equal(documentation.status, 'planning-ready')
  assert.deepEqual(documentation.reuseEligibility.reasons, [])

  const explicit = plan(t, { root, profile: 'pwa' })
  assert.equal(explicit.status, 'planning-ready')
  assert.deepEqual(explicit.reuseEligibility.reasons, [])
})

test('reported revisions require matching clean control-file provenance', (t) => {
  const root = fixture(t)
  const head = headSha(root)
  const clean = plan(t, { root, profile: 'pwa' })
  assert.equal(clean.status, 'planning-ready')
  assert.equal(clean.sha.controller, head)
  assert.equal(clean.sha.candidate, head)
  assert.equal(clean.provenance.controller.status, 'verified')
  assert.equal(clean.provenance.candidate.status, 'verified')

  assert.throws(
    () => plan(t, { root, profile: 'pwa', controllerSha: 'd'.repeat(40) }),
    { code: 'SOURCE_PROVENANCE_MISMATCH' }
  )

  writeFileSync(
    join(root, 'util/profile-resolver.sh'),
    '# dirty control replacement\n'
  )
  assert.throws(
    () => plan(t, { root, profile: 'pwa' }),
    (error) => {
      assert.equal(error.code, 'SOURCE_PROVENANCE_MISMATCH')
      assert.equal(
        error.details.files.includes('util/profile-resolver.sh'),
        true
      )
      return true
    }
  )
})

test('controller provenance pins planner, helper, inventory, contract, and integration controls', (t) => {
  const root = fixture(t)
  const integrationControls = [
    '.github/workflows/northflank-previews.yml',
    'deploy/northflank/klicker-preview.json',
    'util/northflank-preview-lifecycle.mjs',
  ]
  for (const path of integrationControls) {
    const destination = join(root, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, `# ${path}\n`)
  }
  const revision = commitFixture(root, 'add preview integration controls')
  const result = plan(t, { root, profile: 'pwa' })
  assert.equal(result.status, 'planning-ready')
  assert.equal(result.sha.controller, revision)
  assert.deepEqual(
    result.provenance.controller.files,
    [
      '.devrouter.yml',
      '.github/scripts/minimum-validation-class.cjs',
      '.github/scripts/staging-image-targets.cjs',
      ...integrationControls,
      'deploy/northflank/runtime-contract.yml',
      'util/devrouter-cli.mjs',
      'util/northflank-preview-plan.mjs',
      'util/profile-resolver.sh',
    ].sort()
  )

  writeFileSync(
    join(root, '.github/scripts/staging-image-targets.cjs'),
    '# controller inventory replacement\n'
  )
  assert.throws(
    () => plan(t, { root, profile: 'pwa' }),
    (error) => {
      assert.equal(error.code, 'SOURCE_PROVENANCE_MISMATCH')
      assert.equal(
        error.details.files.includes(
          '.github/scripts/staging-image-targets.cjs'
        ),
        true
      )
      return true
    }
  )
  copyFileSync(
    join(REPOSITORY, '.github/scripts/staging-image-targets.cjs'),
    join(root, '.github/scripts/staging-image-targets.cjs')
  )

  rmSync(join(root, '.github/workflows/northflank-previews.yml'))
  assert.throws(
    () => plan(t, { root, profile: 'pwa' }),
    (error) => {
      assert.equal(error.code, 'SOURCE_PROVENANCE_MISMATCH')
      assert.equal(
        error.details.files.includes(
          '.github/workflows/northflank-previews.yml'
        ),
        true
      )
      return true
    }
  )
})

test('separate controller and candidate roots retain independent revisions', (t) => {
  const controller = fixture(t)
  const candidate = fixture(t)
  mkdirSync(join(candidate, 'docs'), { recursive: true })
  writeFileSync(
    join(candidate, 'docs/candidate-only.md'),
    '# Candidate-only note\n'
  )
  commitFixture(candidate, 'add candidate-only source')
  assert.notEqual(headSha(controller), headSha(candidate))

  const result = plan(t, {
    controllerRoot: controller,
    candidateRoot: candidate,
    profile: 'pwa',
  })
  assert.equal(result.status, 'planning-ready')
  assert.equal(result.sha.controller, headSha(controller))
  assert.equal(result.sha.candidate, headSha(candidate))
  assert.equal(result.provenance.controller.root, realpathSync(controller))
  assert.equal(result.provenance.candidate.root, realpathSync(candidate))
})

test('a non-Git snapshot never claims to verify a supplied revision', (t) => {
  const snapshot = fixture(t, { git: false })
  assert.throws(
    () =>
      buildPreviewPlan({
        controllerRoot: snapshot,
        candidateRoot: snapshot,
        profile: 'pwa',
        controllerSha: 'a'.repeat(40),
        candidateSha: 'a'.repeat(40),
        sourceSelection: { eventName: 'push', sourceBranch: 'v3-ai' },
      }),
    { code: 'SOURCE_PROVENANCE_UNAVAILABLE' }
  )

  const unverified = buildPreviewPlan({
    controllerRoot: snapshot,
    candidateRoot: snapshot,
    profile: 'pwa',
    sourceSelection: { eventName: 'push', sourceBranch: 'v3-ai' },
    profileResolver: ({ repo, profile }) => resolvedProfile(repo, profile),
    workerMarker: () => false,
  })
  assert.equal(unverified.status, 'blocked')
  assert.equal(unverified.sha.controller, null)
  assert.equal(unverified.sha.candidate, null)
  assert.equal(unverified.provenance.controller.status, 'unverified')
  assert.equal(
    unverified.reuseEligibility.reasons.includes(
      'source-provenance-unverified'
    ),
    true
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
  const candidateRevision = headSha(candidate)
  writeFileSync(
    join(root, 'deploy/northflank/runtime-contract.yml'),
    JSON.stringify({
      ...contract,
      qualifiedProfiles: [{ revision: candidateRevision, files }],
    })
  )
  const controllerRevision = commitFixture(root, 'qualify profile controls')
  writeFileSync(join(candidate, 'deploy/northflank/runtime-contract.yml'), '{}')
  const result = plan(t, {
    controllerRoot: root,
    candidateRoot: candidate,
    profile: 'chat',
  })
  assert.equal(result.controlParity.status, 'qualified')
  assert.equal(result.sha.controller, controllerRevision)
  assert.equal(result.controlParity.qualifiedRevision, candidateRevision)
  writeFileSync(
    join(candidate, 'util/profile-resolver.sh'),
    '# unqualified replacement\n'
  )
  commitFixture(candidate, 'introduce unqualified profile helper')
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
  for (const name of ['api', 'auth', 'chat', 'control', 'manage', 'pwa']) {
    assert.equal(contract.apps[name].nativePort, 3000, name)
  }
  assert.equal(contract.apps.lti.nativePort, 4000)
  assert.equal(contract.apps['olat-api'].nativePort, 3030)
  assert.equal(contract.apps['response-api'].nativePort, 7078)
  assert.equal(contract.apps.db.publicListener, false)
  const branchOnly = selectPreviewSource(
    { eventName: 'push', sourceBranch: 'v3-ai' },
    contract
  )
  assert.equal(branchOnly.eligible, false)
  assert.equal(branchOnly.reason, 'push-repository-unknown')
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

test('CLI carries exact push source metadata into admission', (t) => {
  const root = fixture(t)
  const base = headSha(root)
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'docs/runtime-note.md'), '# Runtime note\n')
  const head = commitFixture(root, 'add runtime documentation')
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--base',
      base,
      '--head',
      head,
      '--controller-root',
      root,
      '--candidate-root',
      root,
      '--event',
      'push',
      '--source-branch',
      'v3-ai',
      '--source-repository',
      'example-org/klicker-uzh',
      '--source-head-repository',
      'example-org/klicker-uzh',
    ],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.status, 'planning-ready')
  assert.equal(output.sourceSelection.reason, 'allowlisted-branch')
  assert.equal(output.sourceSelection.repository, 'example-org/klicker-uzh')
  assert.equal(output.sourceSelection.headRepository, 'example-org/klicker-uzh')
})

test('CLI carries exact pull request source metadata into admission', (t) => {
  const root = fixture(t)
  const base = headSha(root)
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'docs/runtime-note.md'), '# Runtime note\n')
  const head = commitFixture(root, 'add runtime documentation')
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--base',
      base,
      '--head',
      head,
      '--controller-root',
      root,
      '--candidate-root',
      root,
      '--event',
      'pull_request',
      '--source-branch',
      'feature/test',
      '--preview-label',
      'preview',
      '--source-repository',
      'example-org/klicker-uzh',
      '--source-head-repository',
      'someone-else/klicker-uzh',
      '--source-state',
      'open',
      '--source-merged',
      'false',
      '--source-fork',
      'false',
    ],
    { encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.sourceSelection.repository, 'example-org/klicker-uzh')
  assert.equal(
    output.sourceSelection.headRepository,
    'someone-else/klicker-uzh'
  )
  assert.equal(output.sourceSelection.state, 'open')
  assert.equal(output.sourceSelection.merged, false)
  assert.equal(output.sourceSelection.isFork, false)
  assert.equal(output.status, 'blocked')
  assert.deepEqual(output.reuseEligibility.reasons, ['source-not-eligible'])
})
