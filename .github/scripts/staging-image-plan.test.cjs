'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.join(__dirname, '../..')

const {
  CONSOLIDATED_WORKFLOW_PATH,
  STAGING_IMAGE_TARGETS,
  availableTargets,
  buildJobName,
  scanJobName,
  selectStagingTargets,
  unavailableTargetIds,
} = require('./staging-image-targets.cjs')
const {
  matrixEntry,
  planOutputs,
  planStagingImages,
} = require('./staging-image-plan.cjs')

const CONSOLIDATED = path.join(root, CONSOLIDATED_WORKFLOW_PATH)

function readPackageJson(relativeDirectory) {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativeDirectory, 'package.json'), 'utf8')
  )
}

// The workspace dependency graph the inventory globs must mirror.
function workspaceGraph() {
  const directories = {}
  for (const base of ['apps', 'packages']) {
    for (const name of fs.readdirSync(path.join(root, base)).sort()) {
      const relative = base + '/' + name
      if (!fs.existsSync(path.join(root, relative, 'package.json'))) continue
      directories[readPackageJson(relative).name] = relative
    }
  }
  const edges = {}
  for (const [name, relative] of Object.entries(directories)) {
    const manifest = readPackageJson(relative)
    const declared = new Set()
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const dependency of Object.keys(manifest[field] || {})) {
        if (directories[dependency]) declared.add(dependency)
      }
    }
    edges[name] = [...declared]
  }
  return { directories, edges }
}

function dependencyClosure(graph, rootPackage) {
  const reached = new Set()
  const pending = [rootPackage]
  while (pending.length > 0) {
    for (const dependency of graph.edges[pending.pop()] || []) {
      if (reached.has(dependency)) continue
      reached.add(dependency)
      pending.push(dependency)
    }
  }
  return new Set([rootPackage, ...reached])
}

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'staging-plan-'))
}

// A tree with the consolidated workflow and every target dockerfile: the state
// after S1/S3 on an integration branch.
function completeTree() {
  const directory = scratch()
  fs.mkdirSync(path.join(directory, '.github/workflows'), { recursive: true })
  fs.copyFileSync(
    CONSOLIDATED,
    path.join(directory, '.github/workflows/v3_images-stg.yml')
  )
  for (const target of STAGING_IMAGE_TARGETS) {
    const file = path.join(directory, target.dockerfile)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'FROM scratch\n')
  }
  return directory
}

function changedFiles(directory, files) {
  const target = path.join(directory, 'changed-files.txt')
  fs.writeFileSync(target, files.join('\n') + (files.length ? '\n' : ''))
  return target
}

test('the inventory keeps one entry per promoted image', () => {
  const ids = STAGING_IMAGE_TARGETS.map((target) => target.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate target id')
  for (const target of STAGING_IMAGE_TARGETS) {
    assert.match(target.id, /-arm$/, target.id + ' is not an ARM target')
    assert.ok(
      target.dockerfile.endsWith('Dockerfile'),
      target.id + ' has no dockerfile'
    )
    assert.ok(target.globs.length > 0, target.id + ' has no path globs')
  }
})

test('the job names are deterministic functions of the trusted inventory', () => {
  assert.equal(buildJobName({ jobBase: 'auth' }), 'build-arm-auth')
  assert.equal(
    scanJobName({ jobBase: 'backend-docker' }),
    'scan-arm-backend-docker'
  )
  for (const target of STAGING_IMAGE_TARGETS) {
    assert.equal(
      matrixEntry(target).jobName,
      'build-arm-' + target.jobBase,
      target.id + ' matrix job name drifted'
    )
  }
})

// The workflow builds the reference as '<matrix.image>-arm', so a matrix entry
// without an image would push to 'undefined-arm' and break promotion.
test('every matrix entry names the registry image it publishes', () => {
  for (const target of STAGING_IMAGE_TARGETS) {
    const entry = matrixEntry(target)
    assert.equal(
      typeof entry.image,
      'string',
      target.id + ' has no registry image name'
    )
    assert.ok(entry.image.length > 0, target.id + ' has an empty image name')
    assert.equal(
      entry.image + '-arm',
      target.id,
      target.id + ' image name is not its id without the platform suffix'
    )
  }
  // The migrator publishes its own repository, not the app image.
  assert.equal(
    matrixEntry(
      STAGING_IMAGE_TARGETS.find((t) => t.id === 'backend-docker-migrator-arm')
    ).image,
    'backend-docker-migrator'
  )
})

test('availability follows the tree, not the branch name', () => {
  const limited = scratch()
  fs.mkdirSync(path.join(limited, 'apps/auth'), { recursive: true })
  fs.writeFileSync(path.join(limited, 'apps/auth/Dockerfile'), 'FROM scratch\n')
  const available = availableTargets(limited).map((target) => target.id)
  assert.deepEqual(available, ['auth-arm'])
  const unavailable = unavailableTargetIds(limited)
  assert.equal(unavailable.length, STAGING_IMAGE_TARGETS.length - 1)
  assert.ok(!unavailable.includes('auth-arm'))
})

test('a surviving legacy workflow fails the plan closed', () => {
  const directory = completeTree()
  fs.writeFileSync(
    path.join(directory, '.github/workflows/v3_auth-stg.yml'),
    'name: legacy\n'
  )
  const plan = planStagingImages({
    eventName: 'push',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'unavailable')
  assert.match(plan.reason, /v3_auth-stg\.yml/)
})

test('a push selects every available target', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    eventName: 'push',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'run')
  assert.equal(plan.mode, 'push-all')
  assert.equal(plan.selected.length, STAGING_IMAGE_TARGETS.length)
  const outputs = planOutputs(plan)
  const matrix = JSON.parse(outputs.matrix)
  const migrator = JSON.parse(outputs['migrator-matrix'])
  const afterMigrator = JSON.parse(outputs['after-migrator-matrix'])
  // Every target appears in exactly one build job.
  const total = matrix.length + migrator.length + afterMigrator.length
  assert.equal(total, plan.selected.length)
  assert.equal(migrator.length, 1)
  assert.equal(migrator[0].id, 'backend-docker-migrator-arm')
  assert.equal(afterMigrator.length, 1)
  assert.equal(afterMigrator[0].id, 'backend-docker-arm')
  // Only a push publishes, so the scan and AMD64 legs are present.
  assert.deepEqual(
    JSON.parse(outputs['scan-matrix']).map((entry) => entry.jobName),
    ['scan-arm-backend-docker', 'scan-arm-backend-docker-migrator']
  )
  assert.deepEqual(
    JSON.parse(outputs['amd-matrix']).map((entry) => entry.jobName),
    ['build-amd-mcp-lecturer', 'build-amd-mcp-student']
  )
})

test('a pull request selects only the targets whose inputs changed', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: changedFiles(directory, ['apps/auth/index.ts']),
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'run')
  assert.equal(plan.mode, 'affected')
  assert.deepEqual(plan.selected, ['auth-arm'])
  const outputs = planOutputs(plan)
  // A pull request never publishes, so no scan or AMD64 leg may be expected.
  assert.equal(outputs['scan-build'], 'false')
  assert.equal(outputs['amd-build'], 'false')
  assert.deepEqual(JSON.parse(outputs['scan-matrix']), [])
})

test('a change outside every closure is a validated no-change selection', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: changedFiles(directory, ['docs/only.md']),
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'no-change')
  assert.deepEqual(plan.selected, [])
  const outputs = planOutputs(plan)
  assert.equal(outputs.build, 'false')
  assert.equal(outputs['migrator-build'], 'false')
})

test('changing the consolidated workflow rebuilds every available target', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: changedFiles(directory, [CONSOLIDATED_WORKFLOW_PATH]),
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.equal(plan.mode, 'workflow-change')
  assert.equal(plan.selected.length, STAGING_IMAGE_TARGETS.length)
})

test('a draft pull request defers every build', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: changedFiles(directory, ['apps/auth/index.ts']),
    draft: true,
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'draft')
  const outputs = planOutputs(plan)
  assert.equal(outputs.build, 'false')
  assert.equal(outputs['migrator-build'], 'false')
})

test('an unreadable changed-file list blocks instead of passing as empty', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: path.join(directory, 'absent.txt'),
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.equal(plan.state, 'unavailable')
})

test('the consolidated workflow declares the matrix the plan emits', () => {
  const workflow = YAML.parse(fs.readFileSync(CONSOLIDATED, 'utf8'))
  assert.equal(workflow.name, 'Build staging images')
  assert.deepEqual(workflow.on.push.branches, ['v3', 'v3*'])
  assert.deepEqual(workflow.on.pull_request.types, [
    'opened',
    'synchronize',
    'reopened',
    'edited',
    'ready_for_review',
  ])
  // No path filter: the required context must always be reportable.
  assert.equal(workflow.on.pull_request.paths, undefined)
  assert.deepEqual(workflow.on.pull_request.branches, ['v3', 'v3*'])
  for (const job of [
    'plan',
    'build',
    'build-migrator',
    'build-after-migrator',
  ]) {
    assert.ok(workflow.jobs[job], 'missing job ' + job)
  }
  // The terminal job keeps the exact required context name.
  assert.ok(workflow.jobs['build-images-status'])
  assert.equal(
    workflow.jobs['build-images-status'].if,
    'always()',
    'the status job must always report'
  )
})

test('the consolidated workflow has a single concurrency lane', () => {
  const workflow = YAML.parse(fs.readFileSync(CONSOLIDATED, 'utf8'))
  assert.equal(workflow.concurrency['cancel-in-progress'], true)
  assert.match(workflow.concurrency.group, /github\.workflow/)
})

// The dependency closure is the reason a target is selected at all. A target
// whose globs omit a workspace it bundles would silently under-build after a
// dependency change, which is the regression this suite exists to catch.
test('every target lists its own workspace dependency closure', () => {
  const graph = workspaceGraph()
  const packageForTarget = {
    'auth-arm': '@klicker-uzh/auth',
    'backend-docker-arm': '@klicker-uzh/backend-docker',
    'backend-docker-migrator-arm': '@klicker-uzh/backend-docker',
    'chat-arm': '@klicker-uzh/chat',
    'frontend-assessment-arm': '@klicker-uzh/frontend-pwa',
    'frontend-control-arm': '@klicker-uzh/frontend-control',
    'frontend-manage-arm': '@klicker-uzh/frontend-manage',
    'frontend-pwa-arm': '@klicker-uzh/frontend-pwa',
    'hatchet-worker-general-arm': '@klicker-uzh/hatchet-worker-general',
    'hatchet-worker-response-processor-arm':
      '@klicker-uzh/hatchet-worker-response-processor',
    'lti-arm': '@klicker-uzh/lti-service',
    'olat-api-arm': '@klicker-uzh/olat-api',
    'response-api-arm': '@klicker-uzh/response-api',
  }
  const byId = new Map(
    STAGING_IMAGE_TARGETS.map((target) => [target.id, target])
  )
  for (const [id, rootPackage] of Object.entries(packageForTarget)) {
    const target = byId.get(id)
    assert.ok(target, id + ' is missing from the inventory')
    const declared = new Set(
      target.globs.filter((glob) => glob.endsWith('/**'))
    )
    for (const member of dependencyClosure(graph, rootPackage)) {
      const directory = graph.directories[member]
      assert.ok(
        declared.has(directory + '/**'),
        id + ' must trigger on ' + directory + ', a workspace dependency'
      )
    }
  }
})

test('target globs omit unrelated workspaces', () => {
  const directory = completeTree()
  // packages/word-cloud is bundled only by the frontend images, and
  // packages/transactional only by chat. A change there must never wake the
  // backend, worker, lti, olat-api or response-api images.
  const expectations = [
    [
      'packages/word-cloud/src/index.ts',
      ['backend-docker-arm', 'olat-api-arm'],
    ],
    [
      'packages/transactional/src/index.ts',
      ['response-api-arm', 'hatchet-worker-general-arm'],
    ],
  ]
  for (const [changedFile, excluded] of expectations) {
    const plan = planStagingImages({
      changedFilesPath: changedFiles(directory, [changedFile]),
      eventName: 'pull_request',
      rootDirectory: directory,
    })
    assert.ok(plan.selected.length > 0, changedFile + ' selected nothing')
    for (const id of excluded) {
      assert.ok(
        !plan.selected.includes(id),
        changedFile + ' must not select ' + id
      )
    }
  }
})

// A root build input reaches every image whose docker context is the repository
// root, so it must select every node target and must not select analytics.
test('a root dependency change selects every node target', () => {
  const directory = completeTree()
  const plan = planStagingImages({
    changedFilesPath: changedFiles(directory, ['pnpm-lock.yaml']),
    eventName: 'pull_request',
    rootDirectory: directory,
  })
  assert.ok(plan.selected.includes('auth-arm'))
  assert.ok(plan.selected.includes('frontend-pwa-arm'))
})
