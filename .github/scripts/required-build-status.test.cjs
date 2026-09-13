'use strict'

const assert = require('node:assert/strict')
const childProcess = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.join(__dirname, '../..')
const {
  IMAGE_WORKFLOWS,
  ROOT_BUILD_GLOBS,
  decideBuildStatus,
  evaluateBuildImagesStatus,
  evaluateWorkflowRun,
  matchGlob,
  presentImageWorkflows,
  selectImageWorkflows,
  selectRun,
  selectionMode,
} = require('./required-build-status.cjs')

function readWorkflow(name) {
  return YAML.parse(
    fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8')
  )
}

function readSource(name) {
  return fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8')
}

// build-amd jobs are gated with an always-false condition, so only the active
// build jobs are required for a run.
const INACTIVE_IF = '$' + '{{ false }}'

function activeBuildJobs(workflow) {
  return Object.entries(workflow.jobs)
    .filter(([id, job]) => id.startsWith('build-') && job.if !== INACTIVE_IF)
    .map(([id]) => id)
}

const REPOSITORY = 'uzh-bf/klicker-uzh'
const PR_SHA = 'a'.repeat(40)
const MERGE_SHA = 'b'.repeat(40)
const BASE_SHA = 'c'.repeat(40)
const PR_REF = 'refs/pull/12/merge'

function workflowRun(overrides = {}) {
  return {
    conclusion: 'success',
    event: 'pull_request',
    head_branch: 'feat/x',
    head_sha: PR_SHA,
    id: 100,
    path: '.github/workflows/v3_lti-stg.yml',
    repository: { full_name: REPOSITORY },
    run_attempt: 1,
    status: 'completed',
    ...overrides,
  }
}

function workflowJob(overrides = {}) {
  return {
    conclusion: 'success',
    head_sha: PR_SHA,
    html_url: 'https://example.test/job/1',
    id: 500,
    name: 'build-arm',
    status: 'completed',
    ...overrides,
  }
}

function pullRequestContext(overrides = {}) {
  return {
    eventName: 'pull_request',
    payload: {
      action: 'opened',
      pull_request: {
        base: { ref: 'v3', sha: BASE_SHA },
        draft: false,
        head: { ref: 'feat/x', sha: PR_SHA },
      },
    },
    ref: PR_REF,
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runAttempt: 1,
    runId: 99,
    sha: MERGE_SHA,
    ...overrides,
  }
}

// Records every endpoint call so the tests can bind request parameters, and
// answers with the runs and jobs the scenario provides.
function fakeGithub({ jobsByRun = {}, runsByWorkflow = {}, calls = [] } = {}) {
  return {
    calls,
    rest: {
      actions: {
        listJobsForWorkflowRunAttempt: async (params) => {
          calls.push({ endpoint: 'jobs', params })
          const key = params.run_id + ':' + params.attempt_number
          return { data: { jobs: jobsByRun[key] ?? [] } }
        },
        listWorkflowRuns: async (params) => {
          calls.push({ endpoint: 'runs', params })
          return {
            data: { workflow_runs: runsByWorkflow[params.workflow_id] ?? [] },
          }
        },
      },
    },
  }
}

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'build-status-'))
}

function changedFiles(directory, files) {
  const target = path.join(directory, 'changed-files.txt')
  fs.writeFileSync(target, files.join('\n') + '\n')
  return target
}

function readEvidence(directory) {
  return JSON.parse(
    fs.readFileSync(path.join(directory, 'required-ci-evidence.json'), 'utf8')
  )
}

test('image build inventory mirrors the v3_*-stg.yml workflows', () => {
  const present = presentImageWorkflows(root)
  assert.deepEqual(
    IMAGE_WORKFLOWS.map((item) => item.path).sort(),
    present,
    'inventory and present image workflows drifted'
  )
  for (const item of IMAGE_WORKFLOWS) {
    const workflow = readWorkflow(item.path)
    assert.deepEqual(
      [...item.globs].sort(),
      [...workflow.on.pull_request.paths].sort(),
      item.path + ' pull_request path filter drifted'
    )
    assert.deepEqual(
      item.jobs,
      activeBuildJobs(workflow),
      item.path + ' required build jobs drifted'
    )
    assert.deepEqual(
      workflow.on.push.branches,
      ['v3', 'v3*'],
      item.path + ' must build on every v3 / v3-* push'
    )
    assert.ok(
      workflow.on.pull_request.types.includes('edited'),
      item.path + ' must rebuild when a pull request is retargeted'
    )
    for (const [id, job] of Object.entries(workflow.jobs)) {
      if (job.if === INACTIVE_IF || !id.startsWith('build-')) continue
      if (job.if !== undefined) {
        assert.match(
          job.if,
          /github\.event_name != 'pull_request'/,
          item.path + ' ' + id + ' would be skipped on push'
        )
      }
      // Draft pull requests run the same builds as ready ones, so no build job
      // may gate on the draft state.
      assert.doesNotMatch(
        String(job.if ?? ''),
        /github\.event\.pull_request\.draft/,
        item.path + ' ' + id + ' must not gate on the draft state'
      )
    }
  }
})

test('the fallback stays the always-reported image build contract', () => {
  const workflow = readWorkflow('v3_build-fallback.yml')
  const source = readSource('v3_build-fallback.yml')

  assert.deepEqual(workflow.on.push.branches, ['v3', 'v3*'])
  assert.deepEqual(workflow.on.pull_request.branches, ['v3', 'v3*'])
  assert.ok(
    workflow.on.pull_request.types.includes('edited'),
    'the required context must recompute when a pull request is retargeted'
  )
  assert.ok(
    !workflow.on.pull_request.types.includes('ready_for_review'),
    'the required context must not re-run on an unchanged head at the ready transition'
  )
  // No path filter: the required check must always be reported.
  for (const trigger of [workflow.on.push, workflow.on.pull_request]) {
    assert.equal(trigger.paths, undefined)
    assert.equal(trigger['paths-ignore'], undefined)
  }

  assert.deepEqual(Object.keys(workflow.jobs), ['build-images-status'])
  const job = workflow.jobs['build-images-status']
  assert.equal(job.if, undefined)

  // The controlled polling budget must stay inside the job timeout so the
  // decision and its evidence are written before GitHub cancels the job.
  const budget =
    (Number(job.env.BUILD_STATUS_MAX_ATTEMPTS) *
      Number(job.env.BUILD_STATUS_RETRY_DELAY_MS)) /
    60000
  assert.ok(budget > 0 && budget < Number(job['timeout-minutes']))

  const diff = job.steps.find((step) => step.name === 'Determine changed files')
  assert.equal(
    diff.env.BASE_SHA,
    '$' + '{{ github.event.pull_request.base.sha }}'
  )
  assert.equal(
    diff.env.HEAD_SHA,
    '$' + '{{ github.event.pull_request.head.sha }}'
  )

  const report = job.steps.find(
    (step) => step.name === 'Report affected image build status'
  )
  // A failed changed-file step must still publish its selection evidence.
  assert.equal(report.if, '$' + '{{ !cancelled() }}')
  // A draft must not be deferred: no draft input and no draft gate anywhere.
  assert.equal(report.env.PR_DRAFT, undefined)
  assert.doesNotMatch(source, /pull_request\.draft/)

  const upload = job.steps.find(
    (step) => step.name === 'Upload build status evidence'
  )
  assert.equal(upload.if, 'always()')
  assert.equal(upload.with.name, 'required-ci-evidence')
  assert.equal(upload.with['if-no-files-found'], 'error')
})

test('the changed-file step diffs the event head against the event merge base', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'build-status-diff-'))
  t.after(() =>
    fs.rmSync(directory, {
      force: true,
      maxRetries: 10,
      recursive: true,
      retryDelay: 50,
    })
  )
  // Git exports repository-local variables to hooks. Fixture repositories must
  // not inherit them, or `git -C` can still mutate the parent repository.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )
  Object.assign(environment, {
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
  })
  // Signing and hooks stay off so the fixture never depends on the host Git
  // configuration or a hook inside the temporary repositories.
  const git = (...args) =>
    childProcess
      .execFileSync(
        'git',
        [
          '-c',
          'commit.gpgsign=false',
          '-c',
          'core.hooksPath=/dev/null',
          ...args,
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          env: environment,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      .trim()

  // A common ancestor, an event base that advanced only on the analytics
  // workflow and an event head that changed an application path.
  const source = path.join(directory, 'source')
  git('init', '-q', '-b', 'base', 'source')
  fs.mkdirSync(path.join(source, 'apps/chat/src'), { recursive: true })
  fs.mkdirSync(path.join(source, '.github/workflows'), { recursive: true })
  fs.writeFileSync(path.join(source, 'README.md'), 'common\n')
  const analyticsPath = path.join(
    source,
    '.github/workflows/v3_analytics-stg.yml'
  )
  fs.writeFileSync(analyticsPath, 'name: analytics\n')
  git('-C', 'source', 'add', '-A')
  git('-C', 'source', 'commit', '-q', '-m', 'common ancestor')
  const ancestor = git('-C', 'source', 'rev-parse', 'HEAD')
  fs.writeFileSync(analyticsPath, 'name: analytics\non: push\n')
  git('-C', 'source', 'commit', '-q', '-am', 'base-only analytics change')
  const baseSha = git('-C', 'source', 'rev-parse', 'HEAD')
  git('-C', 'source', 'checkout', '-q', '-b', 'candidate', ancestor)
  fs.writeFileSync(path.join(source, 'apps/chat/src/synthetic.ts'), 'chat\n')
  git('-C', 'source', 'add', '-A')
  git('-C', 'source', 'commit', '-q', '-m', 'head chat change')
  const headSha = git('-C', 'source', 'rev-parse', 'HEAD')
  git('-C', 'source', 'checkout', '-q', '-b', 'analytics-candidate', ancestor)
  fs.writeFileSync(analyticsPath, 'name: analytics\non: pull_request\n')
  git('-C', 'source', 'commit', '-q', '-am', 'head analytics change')
  const analyticsHeadSha = git('-C', 'source', 'rev-parse', 'HEAD')
  // The pull-request ref GitHub checks out is a real two-parent merge of the
  // event base and head, so the fixture merges both sides instead of naming a
  // synthetic commit that exists on neither.
  git('-C', 'source', 'checkout', '-q', '-b', 'merge', 'base')
  git(
    '-C',
    'source',
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'merge event base into head',
    'candidate'
  )
  const mergeSha = git('-C', 'source', 'rev-parse', 'HEAD')

  // A criss-cross history: two sibling merges of the same two parents in
  // opposite order have two merge bases, so no single base is unambiguous.
  git('-C', 'source', 'checkout', '-q', '-b', 'left', ancestor)
  fs.mkdirSync(path.join(source, 'apps/chat/src'), { recursive: true })
  fs.writeFileSync(path.join(source, 'apps/chat/src/left.ts'), 'left\n')
  git('-C', 'source', 'add', '-A')
  git('-C', 'source', 'commit', '-q', '-m', 'left change')
  git('-C', 'source', 'checkout', '-q', '-b', 'right', ancestor)
  fs.mkdirSync(path.join(source, 'apps/chat/src'), { recursive: true })
  fs.writeFileSync(path.join(source, 'apps/chat/src/right.ts'), 'right\n')
  git('-C', 'source', 'add', '-A')
  git('-C', 'source', 'commit', '-q', '-m', 'right change')
  git('-C', 'source', 'checkout', '-q', '-b', 'merge-left', 'left')
  git(
    '-C',
    'source',
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'merge right into left',
    'right'
  )
  const crissCrossLeftSha = git('-C', 'source', 'rev-parse', 'HEAD')
  git('-C', 'source', 'checkout', '-q', '-b', 'merge-right', 'right')
  git(
    '-C',
    'source',
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'merge left into right',
    'left'
  )
  const crissCrossRightSha = git('-C', 'source', 'rev-parse', 'HEAD')

  git('clone', '-q', '--bare', 'source', 'origin.git')
  git('--git-dir=origin.git', 'symbolic-ref', 'HEAD', 'refs/heads/merge')
  const mergeParents = git(
    '--git-dir=origin.git',
    'rev-list',
    '--parents',
    '-n',
    '1',
    mergeSha
  )
  assert.equal(mergeParents.split(' ').length, 3)
  const crissCrossBases = git(
    '--git-dir=origin.git',
    'merge-base',
    '--all',
    crissCrossLeftSha,
    crissCrossRightSha
  )
    .trim()
    .split('\n')
  assert.equal(crissCrossBases.length, 2)
  // Unrelated history is advertised by the same origin, so its fetch succeeds
  // and only the merge-base comparison can fail.
  git('init', '-q', '-b', 'unrelated', 'unrelated')
  fs.writeFileSync(path.join(directory, 'unrelated', 'orphan.txt'), 'x\n')
  git('-C', 'unrelated', 'add', '-A')
  git('-C', 'unrelated', 'commit', '-q', '-m', 'unrelated history')
  const unrelatedSha = git('-C', 'unrelated', 'rev-parse', 'HEAD')
  git(
    '-C',
    'unrelated',
    'push',
    '-q',
    path.join(directory, 'origin.git'),
    'HEAD:refs/heads/unrelated'
  )

  // A depth-1 clone of the merge ref: the checkout starts on the merge commit
  // and must still be there after the step fetches the event endpoints.
  git(
    'clone',
    '-q',
    '--branch',
    'merge',
    '--depth',
    '1',
    'file://' + path.join(directory, 'origin.git'),
    'checkout'
  )
  assert.equal(git('-C', 'checkout', 'rev-parse', 'HEAD'), mergeSha)

  const workflow = readWorkflow('v3_build-fallback.yml')
  const step = workflow.jobs['build-images-status'].steps.find(
    (candidate) => candidate.name === 'Determine changed files'
  )
  const outputPath = path.join(directory, 'changed-files.txt')
  const runStep = (base, head) =>
    childProcess.spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], {
      cwd: path.join(directory, 'checkout'),
      encoding: 'utf8',
      env: {
        ...environment,
        BASE_SHA: base,
        CHANGED_FILES_PATH: outputPath,
        HEAD_SHA: head,
      },
      timeout: 120_000,
    })
  const selectedFiles = () =>
    fs.readFileSync(outputPath, 'utf8').trim().split('\n')
  const presentFiles = presentImageWorkflows(root)

  // The depth-1 checkout exercises the unshallow fetch branch first.
  assert.equal(
    git('-C', 'checkout', 'rev-parse', '--is-shallow-repository'),
    'true'
  )
  const head = runStep(baseSha, headSha)
  assert.equal(head.status, 0, head.stderr)
  assert.deepEqual(selectedFiles(), ['apps/chat/src/synthetic.ts'])
  const chatSelection = selectImageWorkflows({
    changedFiles: selectedFiles(),
    eventName: 'pull_request',
    presentFiles,
  })
  assert.deepEqual(chatSelection.unknown, [])
  assert.deepEqual(
    chatSelection.expected.map((entry) => entry.path),
    ['v3_chat-stg.yml']
  )
  assert.equal(git('-C', 'checkout', 'rev-parse', 'HEAD'), mergeSha)

  // Control: a plain two-endpoint diff of the same commits carries the
  // base-only change, so the exclusion above comes from the merge base of the
  // comparison rather than from the merge tree the checkout sits on.
  const twoEndpoint = git(
    '-C',
    'checkout',
    'diff',
    '--name-only',
    `${baseSha}..${headSha}`
  )
    .split('\n')
    .sort()
  assert.deepEqual(twoEndpoint, [
    '.github/workflows/v3_analytics-stg.yml',
    'apps/chat/src/synthetic.ts',
  ])

  // A head that really changes the analytics workflow must select it.
  const analytics = runStep(baseSha, analyticsHeadSha)
  assert.equal(analytics.status, 0, analytics.stderr)
  assert.deepEqual(selectedFiles(), ['.github/workflows/v3_analytics-stg.yml'])
  const analyticsSelection = selectImageWorkflows({
    changedFiles: selectedFiles(),
    eventName: 'pull_request',
    presentFiles,
  })
  assert.deepEqual(
    analyticsSelection.expected.map((entry) => entry.path),
    ['v3_analytics-stg.yml']
  )

  // Unrelated ancestry and a missing endpoint both fail and clear the output.
  // An ambiguous merge base must fail the same way.
  fs.writeFileSync(outputPath, 'stale\n')
  const unrelated = runStep(baseSha, unrelatedSha)
  assert.notEqual(unrelated.status, 0)
  assert.equal(fs.existsSync(outputPath), false)
  fs.writeFileSync(outputPath, 'stale\n')
  const missing = runStep('f'.repeat(40), headSha)
  assert.notEqual(missing.status, 0)
  assert.equal(fs.existsSync(outputPath), false)
  fs.writeFileSync(outputPath, 'stale\n')
  const crissCross = runStep(crissCrossLeftSha, crissCrossRightSha)
  assert.equal(
    git(
      '-C',
      'checkout',
      'merge-base',
      '--all',
      crissCrossLeftSha,
      crissCrossRightSha
    ).split('\n').length,
    2
  )
  assert.notEqual(crissCross.status, 0)
  assert.equal(fs.existsSync(outputPath), false)
  assert.equal(git('-C', 'checkout', 'rev-parse', 'HEAD'), mergeSha)
})

test('path globs follow GitHub filter semantics', () => {
  assert.equal(matchGlob('apps/auth/**', 'apps/auth/src/index.ts'), true)
  // '*' stops at a path separator, '**' crosses it.
  assert.equal(matchGlob('apps/*/x.ts', 'apps/auth/x.ts'), true)
  assert.equal(matchGlob('apps/*/x.ts', 'apps/auth/src/x.ts'), false)
  // A literal root file is matched exactly, not as a directory prefix.
  assert.equal(matchGlob('pnpm-lock.yaml', 'pnpm-lock.yaml'), true)
  assert.equal(matchGlob('package.json', 'apps/auth/package.json'), false)
  assert.equal(matchGlob('turbo.json', 'apps/turbo.json'), false)
  assert.equal(matchGlob('.dockerignore', '.dockerignore'), true)
})

test('a push selects every present image workflow', () => {
  const presentFiles = presentImageWorkflows(root)
  const { expected, unknown } = selectImageWorkflows({
    eventName: 'push',
    presentFiles,
  })
  assert.deepEqual(unknown, [])
  assert.deepEqual(expected.map((entry) => entry.path).sort(), presentFiles)
  assert.equal(
    selectionMode({ binding: { event: 'push' }, expected }),
    'push-all'
  )
})

test('a root dependency change selects every node image but not analytics', () => {
  const presentFiles = presentImageWorkflows(root)
  // .dockerignore is also a root build input for analytics, which has no node
  // workspace dependency and therefore does not take the node manifests.
  const nodeOnlyGlobs = ROOT_BUILD_GLOBS.filter(
    (glob) => glob !== '.dockerignore'
  )
  for (const file of nodeOnlyGlobs) {
    const { expected } = selectImageWorkflows({
      changedFiles: [file],
      eventName: 'pull_request',
      presentFiles,
    })
    const selected = expected.map((entry) => entry.path).sort()
    assert.ok(
      selected.includes('v3_backend-docker-stg.yml'),
      file + ' must rebuild the backend image'
    )
    assert.ok(
      selected.includes('v3_frontend-pwa-docker-stg.yml'),
      file + ' must rebuild the pwa image'
    )
    assert.ok(
      !selected.includes('v3_analytics-stg.yml'),
      file + ' cannot select the dependency-free analytics image'
    )
    assert.equal(selected.length, IMAGE_WORKFLOWS.length - 1)
  }
})

test('analytics is selected by its schema, sync script and docker context', () => {
  const presentFiles = presentImageWorkflows(root)
  for (const file of [
    'packages/prisma/src/prisma/schema/question.prisma',
    'util/sync-schema.sh',
    '.dockerignore',
  ]) {
    const { expected } = selectImageWorkflows({
      changedFiles: [file],
      eventName: 'pull_request',
      presentFiles,
    })
    assert.ok(
      expected.some((entry) => entry.path === 'v3_analytics-stg.yml'),
      file + ' must rebuild the analytics image'
    )
  }
})

test('a packages-only pull request never resolves to a no-change', () => {
  const presentFiles = presentImageWorkflows(root)
  const { expected } = selectImageWorkflows({
    changedFiles: ['packages/util/src/index.ts'],
    eventName: 'pull_request',
    presentFiles,
  })
  assert.ok(expected.length > 0)
  assert.equal(
    selectionMode({ binding: { event: 'pull_request' }, expected }),
    'affected'
  )
})

test('a docs-only pull request is a validated no-change', () => {
  const presentFiles = presentImageWorkflows(root)
  const { expected, unknown } = selectImageWorkflows({
    changedFiles: ['docs/ci-and-deployment.md'],
    eventName: 'pull_request',
    presentFiles,
  })
  assert.deepEqual(unknown, [])
  assert.deepEqual(expected, [])
  const decision = decideBuildStatus({ evidence: [], expected, unknown })
  assert.equal(decision.ok, true)
  assert.equal(decision.noChange, true)
})

test('an unknown image workflow fails closed', () => {
  const presentFiles = [
    ...presentImageWorkflows(root),
    'v3_new-service-stg.yml',
  ]
  const { unknown } = selectImageWorkflows({
    changedFiles: ['apps/new-service/x.ts'],
    eventName: 'pull_request',
    presentFiles,
  })
  assert.deepEqual(unknown, ['v3_new-service-stg.yml'])
  const decision = decideBuildStatus({ evidence: [], expected: [], unknown })
  assert.equal(decision.ok, false)
  assert.match(decision.reason, /uncovered image workflow/)
})

test('deleting a required publisher blocks qualification', () => {
  const { unknown } = selectImageWorkflows({
    presentFiles: presentImageWorkflows(root).filter(
      (name) => name !== 'v3_auth-stg.yml'
    ),
    eventName: 'pull_request',
    changedFiles: ['apps/auth/src/index.ts'],
  })
  assert.deepEqual(unknown, ['v3_auth-stg.yml'])
  assert.equal(
    decideBuildStatus({ evidence: [], expected: [], unknown }).ok,
    false
  )
})

test('run binding never mixes push and pull-request evidence', () => {
  const entry = { jobs: ['build-arm'], path: 'v3_lti-stg.yml' }
  const binding = {
    branch: 'feat/x',
    event: 'pull_request',
    repository: REPOSITORY,
    sha: PR_SHA,
  }
  const runs = [
    workflowRun(),
    workflowRun({ event: 'push' }),
    workflowRun({ head_sha: MERGE_SHA }),
    workflowRun({ head_branch: 'other' }),
    workflowRun({ path: '.github/workflows/v3_auth-stg.yml' }),
    workflowRun({ repository: { full_name: 'someone/fork' } }),
    workflowRun({
      id: 101,
      path: '.github/workflows/v3_lti-stg.yml@refs/pull/12/merge',
    }),
  ]
  assert.deepEqual(
    runs.filter((run) => selectRun([run], entry, binding)).map((run) => run.id),
    [100, 101]
  )
  assert.equal(selectRun(runs, entry, binding).id, 101)
})

test('a run outcome decides the required build result', () => {
  const entry = { jobs: ['build-arm'], path: 'v3_lti-stg.yml' }
  const binding = {
    branch: 'feat/x',
    event: 'pull_request',
    repository: REPOSITORY,
    sha: PR_SHA,
  }
  const evaluate = (overrides, jobs = [workflowJob()]) =>
    evaluateWorkflowRun({
      binding,
      entry,
      jobs,
      run: workflowRun(overrides),
    })

  assert.equal(evaluate({}).status, 'success')
  assert.equal(evaluate({ status: 'in_progress' }).status, 'running')
  assert.equal(evaluate({ conclusion: 'failure' }).status, 'failed')
  assert.equal(evaluate({ conclusion: 'cancelled' }).status, 'cancelled')
  // A draft-era skip is never a deferral: the same head must not stay green.
  assert.equal(evaluate({ conclusion: 'skipped' }).status, 'failed')
  assert.equal(evaluate({ conclusion: null }).status, 'failed')
  // A build job that did not run, ran elsewhere or failed blocks.
  assert.equal(evaluate({}, []).status, 'wrong_evidence')
  assert.equal(
    evaluate({}, [workflowJob({ head_sha: MERGE_SHA })]).status,
    'wrong_evidence'
  )
  assert.equal(
    evaluate({}, [workflowJob({ conclusion: 'failure' })]).status,
    'failed'
  )
  assert.equal(
    evaluate({}, [workflowJob({ status: 'queued', conclusion: null })]).status,
    'running'
  )
  assert.equal(
    evaluate({}, [workflowJob(), workflowJob({ id: 501 })]).status,
    'wrong_evidence'
  )
  assert.deepEqual(
    evaluate({}, [workflowJob(), workflowJob({ name: 'other' })]).jobs,
    [
      {
        conclusion: 'success',
        jobId: 500,
        name: 'build-arm',
        url: 'https://example.test/job/1',
      },
    ]
  )
})

test('the aggregate decision blocks failures and reports evidence', () => {
  const expected = [
    { jobs: ['build-arm'], path: 'v3_lti-stg.yml' },
    { jobs: ['build-arm'], path: 'v3_chat-stg.yml' },
  ]
  const passing = [
    {
      jobs: [],
      reason: 'ok',
      run: { id: 1 },
      status: 'success',
      workflow: 'v3_lti-stg.yml',
    },
    {
      jobs: [],
      reason: 'ok',
      run: { id: 2 },
      status: 'success',
      workflow: 'v3_chat-stg.yml',
    },
  ]
  assert.equal(
    decideBuildStatus({ evidence: passing, expected, unknown: [] }).ok,
    true
  )
  const failing = [
    passing[0],
    {
      jobs: [],
      reason: 'run 2 concluded failure',
      run: { id: 2 },
      status: 'failed',
      workflow: 'v3_chat-stg.yml',
    },
  ]
  const decision = decideBuildStatus({
    evidence: failing,
    expected,
    unknown: [],
  })
  assert.equal(decision.ok, false)
  assert.deepEqual(
    decision.failures.map((entry) => entry.workflow),
    ['v3_chat-stg.yml']
  )
  assert.match(decision.reason, /v3_chat-stg\.yml/)
})

test('a draft pull request qualifies its builds instead of being deferred', async () => {
  const directory = scratch()
  const github = fakeGithub({
    jobsByRun: {
      '100:1': [workflowJob({ id: 501 })],
    },
    runsByWorkflow: {
      'v3_lti-stg.yml': [
        workflowRun({ path: '.github/workflows/v3_lti-stg.yml' }),
      ],
    },
  })
  const evidencePath = path.join(directory, 'required-ci-evidence.json')
  const decision = await evaluateBuildImagesStatus({
    changedFilesPath: changedFiles(directory, ['apps/lti/src/x.ts']),
    context: pullRequestContext({
      payload: {
        action: 'opened',
        pull_request: {
          base: { ref: 'v3', sha: BASE_SHA },
          draft: true,
          head: { ref: 'feat/x', sha: PR_SHA },
        },
      },
    }),
    evidencePath,
    github,
    maxAttempts: 2,
    rootDirectory: root,
  })
  assert.equal(decision.ok, true, JSON.stringify(decision))
  const evidence = readEvidence(directory)
  assert.equal(evidence.decision.outcome, 'pass')
  assert.equal(evidence.selection.mode, 'affected')
  assert.equal(evidence.selection.state, 'run')
  assert.equal(evidence.builds.length, 1)
  fs.rmSync(directory, { force: true, recursive: true })
})

test('missing selection evidence blocks instead of passing as no-change', async () => {
  const directory = scratch()
  const github = fakeGithub()
  await assert.rejects(
    evaluateBuildImagesStatus({
      changedFilesPath: path.join(directory, 'absent.txt'),
      context: pullRequestContext(),
      evidencePath: path.join(directory, 'required-ci-evidence.json'),
      github,
      maxAttempts: 2,
      rootDirectory: root,
      sleep: () => {
        throw new Error('an unknown selection must not wait')
      },
    }),
    /changed-file selection is unavailable/
  )
  assert.deepEqual(github.calls, [])
  assert.equal(readEvidence(directory).selection.mode, 'selection-unavailable')
  fs.rmSync(directory, { force: true, recursive: true })
})

test('a genuine build failure is not retried', async () => {
  const directory = scratch()
  const github = fakeGithub({
    jobsByRun: { '100:1': [workflowJob({ conclusion: 'failure' })] },
    runsByWorkflow: {
      'v3_lti-stg.yml': [workflowRun({ conclusion: 'failure' })],
    },
  })
  let sleeps = 0
  await assert.rejects(
    evaluateBuildImagesStatus({
      changedFilesPath: changedFiles(directory, ['apps/lti/src/x.ts']),
      context: pullRequestContext(),
      evidencePath: path.join(directory, 'required-ci-evidence.json'),
      github,
      maxAttempts: 5,
      rootDirectory: root,
      sleep: () => {
        sleeps += 1
      },
    }),
    /v3_lti-stg\.yml \(run 100 concluded failure\)/
  )
  assert.equal(sleeps, 0)
  assert.equal(
    github.calls.filter((call) => call.endpoint === 'runs').length,
    1
  )
  fs.rmSync(directory, { force: true, recursive: true })
})

test('missing runs are retried up to the bounded attempt budget', async () => {
  const directory = scratch()
  const github = fakeGithub()
  let sleeps = 0
  await assert.rejects(
    evaluateBuildImagesStatus({
      changedFilesPath: changedFiles(directory, ['apps/lti/src/x.ts']),
      context: pullRequestContext(),
      evidencePath: path.join(directory, 'required-ci-evidence.json'),
      github,
      maxAttempts: 3,
      rootDirectory: root,
      retryDelayMs: 0,
      sleep: () => {
        sleeps += 1
      },
    }),
    /no run for this event, branch and commit/
  )
  assert.equal(sleeps, 2)
  assert.equal(
    github.calls.filter((call) => call.endpoint === 'runs').length,
    3
  )
  const evidence = readEvidence(directory)
  assert.equal(evidence.decision.outcome, 'fail')
  assert.equal(evidence.selection.state, 'run')
  fs.rmSync(directory, { force: true, recursive: true })
})

test('runs and jobs are read through their scoped endpoints', async () => {
  const directory = scratch()
  const github = fakeGithub({
    jobsByRun: { '100:1': [workflowJob()] },
    runsByWorkflow: {
      'v3_chat-stg.yml': [
        workflowRun({
          id: 7,
          path: '.github/workflows/v3_chat-stg.yml',
          status: 'in_progress',
        }),
      ],
      'v3_lti-stg.yml': [workflowRun()],
    },
  })
  await assert.rejects(
    evaluateBuildImagesStatus({
      changedFilesPath: changedFiles(directory, [
        'apps/chat/src/a.ts',
        'apps/lti/src/b.ts',
      ]),
      context: pullRequestContext(),
      evidencePath: path.join(directory, 'required-ci-evidence.json'),
      github,
      maxAttempts: 2,
      rootDirectory: root,
      retryDelayMs: 0,
      sleep: () => {},
    }),
    /v3_chat-stg\.yml/
  )
  const runs = github.calls.filter((call) => call.endpoint === 'runs')
  const jobs = github.calls.filter((call) => call.endpoint === 'jobs')
  // Per-workflow listing, never a repository-wide listing without a workflow.
  assert.deepEqual(runs.map((call) => call.params.workflow_id).sort(), [
    'v3_chat-stg.yml',
    'v3_chat-stg.yml',
    'v3_lti-stg.yml',
    'v3_lti-stg.yml',
  ])
  for (const call of runs) {
    assert.equal(call.params.event, 'pull_request')
    assert.equal(call.params.branch, 'feat/x')
    assert.equal(call.params.head_sha, PR_SHA)
  }
  // The completed run's jobs are read for its exact attempt and cached, while
  // the still-running workflow is re-listed on the next attempt.
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].params.run_id, 100)
  assert.equal(jobs[0].params.attempt_number, 1)
  fs.rmSync(directory, { force: true, recursive: true })
})

test('a successful selection records the evidence envelope', async () => {
  const directory = scratch()
  const github = fakeGithub({
    jobsByRun: { '100:1': [workflowJob({ id: 501 })] },
    runsByWorkflow: { 'v3_lti-stg.yml': [workflowRun()] },
  })
  const decision = await evaluateBuildImagesStatus({
    changedFilesPath: changedFiles(directory, ['apps/lti/src/x.ts']),
    context: pullRequestContext(),
    evidencePath: path.join(directory, 'required-ci-evidence.json'),
    github,
    maxAttempts: 2,
    rootDirectory: root,
    sleep: () => {},
  })
  assert.equal(decision.ok, true)
  const evidence = readEvidence(directory)
  assert.equal(evidence.schemaVersion, 1)
  assert.deepEqual(evidence.workflow, {
    path: '.github/workflows/v3_build-fallback.yml',
    terminalJob: 'build-images-status',
  })
  assert.equal(evidence.repository, REPOSITORY)
  assert.deepEqual(evidence.run, { attempt: 1, id: 99 })
  assert.equal(evidence.reuse, null)
  assert.equal(evidence.event.name, 'pull_request')
  assert.equal(evidence.event.branch, 'feat/x')
  assert.equal(evidence.event.sha, PR_SHA)
  assert.deepEqual(evidence.selection.state, 'run')
  assert.equal(evidence.selection.mode, 'affected')
  assert.equal(evidence.selection.changedFileCount, 1)
  assert.equal(evidence.decision.outcome, 'pass')
  assert.deepEqual(evidence.builds, [
    {
      jobs: [
        {
          conclusion: 'success',
          jobId: 501,
          name: 'build-arm',
          url: 'https://example.test/job/1',
        },
      ],
      path: '.github/workflows/v3_lti-stg.yml',
      reason: 'build job succeeded',
      result: 'success',
      run: {
        attempt: 1,
        branch: 'feat/x',
        event: 'pull_request',
        id: 100,
        sha: PR_SHA,
        url: '',
      },
    },
  ])
  fs.rmSync(directory, { force: true, recursive: true })
})
