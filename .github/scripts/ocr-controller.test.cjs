const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const test = require('node:test')
const vm = require('node:vm')
const YAML = require('yaml')
const {
  verifyRelease,
  prepareReview,
  runCommand,
  publishReview,
  checkCaller,
  ASSETS,
} = require('./ocr-controller.cjs')

const ROOT = path.resolve(__dirname, '../..')
const MANIFEST = '.github/open-code-review/runtime-manifest.json'
const SKILL = '.agents/skills/ocr-reviewer/SKILL.md'
const REVISION = 'a'.repeat(40)
const digest = (bytes) =>
  crypto.createHash('sha256').update(bytes).digest('hex')

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-shared-contract-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const root = path.join(temp, 'runtime')
  for (const file of [...ASSETS, MANIFEST]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.copyFileSync(path.join(ROOT, file), path.join(root, file))
  }
  const repo = path.join(temp, 'caller')
  fs.mkdirSync(repo)
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  git('config', 'commit.gpgSign', 'false')
  for (const [file, content] of [
    [SKILL, fs.readFileSync(path.join(ROOT, SKILL))],
    [
      '.github/open-code-review/repository.json',
      JSON.stringify({ schema: 'ocr-repository/v1', rootFiles: ['GUIDE.md'] }),
    ],
    ['GUIDE.md', 'Synthetic trusted guide'],
    ['source.js', 'export const value = 1\n'],
    [
      '.github/scripts/ocr-draft-review.cjs',
      "throw new Error('CALLER_CODE_MUST_NOT_RUN')\n",
    ],
  ]) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    fs.writeFileSync(path.join(repo, file), content)
  }
  git('add', '.')
  git('commit', '-m', 'test: synthetic policy')
  const policy = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(repo, 'source.js'), 'export const value = 2\n')
  fs.writeFileSync(path.join(repo, SKILL), 'UNTRUSTED_CANDIDATE_SKILL')
  git('add', '.')
  git('commit', '-m', 'test: synthetic candidate')
  const head = git('rev-parse', 'HEAD')
  git('checkout', '--detach', policy)
  const calls = []
  const options = {
    root,
    repo,
    temp,
    revision: REVISION,
    runtimeRepository: 'synthetic/runtime',
    repository: 'synthetic/caller',
    eventName: 'pull_request_target',
    token: 'synthetic-fetch-token',
    event: {
      repository: { full_name: 'synthetic/caller', default_branch: 'main' },
      pull_request: {
        number: 1,
        draft: true,
        title: 'Synthetic change',
        body: 'Synthetic context',
        user: { login: 'synthetic-author' },
        head: { sha: head },
        base: { sha: policy, repo: { full_name: 'synthetic/caller' } },
      },
    },
    git: (_repo, args, env) => {
      calls.push({ args, env })
      if (args[0] === 'fetch') {
        fs.writeFileSync(path.join(repo, '.git/FETCH_HEAD'), head)
        return ''
      }
      return execFileSync('git', args, {
        cwd: repo,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    },
  }
  return { root, repo, temp, policy, head, git, options, calls }
}

function result(head, status = 'partial') {
  return {
    status,
    comments: [],
    manifest: {
      input: { resolved_head: head },
      coverage: {
        selected: ['a', 'b'],
        completed: ['a'],
        failed: [{ classification: 'provider' }],
        reused: [],
        waived: [],
      },
    },
  }
}

function caller() {
  return {
    name: 'Synthetic review',
    on: {
      pull_request_target: {
        types: [
          'opened',
          'synchronize',
          'reopened',
          'ready_for_review',
          'converted_to_draft',
        ],
      },
    },
    permissions: { contents: 'read', 'pull-requests': 'write' },
    concurrency: {
      group:
        '${{ github.workflow }}-${{ github.event.pull_request.number || github.ref_name }}',
      'cancel-in-progress': true,
    },
    jobs: {
      'ocr-review': {
        if: "github.event.pull_request.user.login != 'dependabot[bot]' && github.event.pull_request.draft == true",
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 45,
        env: { OCR_NO_UPDATE: '1' },
        steps: [
          {
            uses: `synthetic/runtime/.github/actions/ocr-review@${REVISION}`,
            with: {
              'mistral-api-key': '${{ secrets.MISTRAL_API_KEY }}',
              'context7-api-key': '${{ secrets.CONTEXT7_API_KEY }}',
              'github-token': '${{ github.token }}',
            },
          },
        ],
      },
    },
  }
}

test('required stock qualification cannot silently skip unavailable fixtures', () => {
  if (process.env.OCR_REQUIRE_STOCK_BINARY !== '1') return
  assert.ok(
    process.env.OCR_TEST_BINARY && fs.existsSync(process.env.OCR_TEST_BINARY)
  )
  assert.ok(
    process.env.OCR_TEST_PUBLISHER &&
      fs.existsSync(process.env.OCR_TEST_PUBLISHER)
  )
  const version = execFileSync(process.env.OCR_TEST_BINARY, ['version'], {
    env: { ...process.env, OCR_NO_UPDATE: '1' },
    encoding: 'utf8',
  })
  assert.match(version, /^open-code-review v?1\.13\.0 \(1672852\)/)
  assert.equal(
    digest(fs.readFileSync(process.env.OCR_TEST_PUBLISHER)),
    verifyRelease().manifest.draft.publisher.sha256
  )
})

test('release bootstrap rejects missing, changed and symlink-substituted assets before importing them', (t) => {
  assert.equal(verifyRelease().manifest.draft.profile.reasoning, 'max')
  const f = fixture(t)
  const file = path.join(f.root, '.github/scripts/ocr-draft-review.cjs')
  const original = fs.readFileSync(file)
  fs.writeFileSync(file, "throw new Error('UNVERIFIED_CODE_RAN')")
  assert.throws(() => verifyRelease(f.root), /invalid_runtime/)
  assert.equal(require.cache[file], undefined)
  fs.unlinkSync(file)
  assert.throws(() => verifyRelease(f.root), /invalid_runtime/)
  fs.writeFileSync(path.join(f.temp, 'replacement.cjs'), original)
  fs.symlinkSync(path.join(f.temp, 'replacement.cjs'), file)
  assert.throws(() => verifyRelease(f.root), /invalid_runtime/)
  assert.equal(require.cache[file], undefined)
  fs.writeFileSync(path.join(f.root, MANIFEST), '{invalid JSON')
  assert.throws(() => verifyRelease(f.root), /invalid_runtime/)
})

test('release metadata must match the actual patched installer identity', (t) => {
  const f = fixture(t)
  const file = '.github/scripts/install-patched-ocr.cjs'
  fs.appendFileSync(
    path.join(f.root, file),
    "\nmodule.exports.SOURCE_COMMIT = 'b'.repeat(40)\n"
  )
  const manifestPath = path.join(f.root, MANIFEST)
  const manifest = JSON.parse(fs.readFileSync(manifestPath))
  manifest.assets[file] = digest(fs.readFileSync(path.join(f.root, file)))
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  assert.throws(() => verifyRelease(f.root), /invalid_runtime/)
})

test('preparation freezes caller objects and release identity; fetch credentials never enter metadata reads', (t) => {
  const f = fixture(t)
  const context = prepareReview(f.options)
  assert.equal(context.policy, f.policy)
  assert.equal(context.head, f.head)
  assert.equal(context.from, f.policy)
  assert.equal(context.runtime_revision, REVISION)
  assert.equal(f.calls.filter(({ args }) => args[0] === 'fetch').length, 2)
  for (const { args, env } of f.calls) {
    assert.ok(!JSON.stringify(args).includes('synthetic-fetch-token'))
    assert.equal(env.GIT_NO_REPLACE_OBJECTS, '1')
    assert.equal(env.GIT_CONFIG_GLOBAL, os.devNull)
    assert.equal(env.GITHUB_TOKEN, undefined)
    assert.equal(env.MISTRAL_API_KEY, undefined)
    assert.equal(Boolean(env.GIT_CONFIG_VALUE_0), args[0] === 'fetch')
  }
  const receipt = fs.readFileSync(
    path.join(f.temp, 'ocr-runtime-identity.json'),
    'utf8'
  )
  assert.ok(!receipt.includes('Synthetic context'))
  assert.ok(!receipt.includes('synthetic-fetch-token'))
  assert.equal(JSON.parse(receipt).policy, f.policy)
  assert.equal(
    fs.statSync(path.join(f.temp, 'ocr-action-context.json')).mode & 0o777,
    0o600
  )
})

test('invalid event and mismatched policy skill fail before source fetch or provider execution', (t) => {
  const f = fixture(t)
  for (const patch of [
    { revision: 'main' },
    { eventName: 'pull_request' },
    { repository: 'other/caller' },
  ]) {
    assert.throws(
      () => prepareReview({ ...f.options, ...patch }),
      /invalid_review_identity/
    )
  }
  assert.equal(f.calls.length, 0)
  fs.writeFileSync(path.join(f.repo, SKILL), 'MISMATCHED_POLICY_SKILL')
  f.git('add', '.')
  f.git('commit', '-m', 'test: mismatched skill')
  assert.throws(() => prepareReview(f.options), /skill_mismatch/)
  assert.equal(
    f.calls.some(({ args }) => args[0] === 'fetch'),
    false
  )
  fs.unlinkSync(path.join(f.repo, SKILL))
  f.git('add', '.')
  f.git('commit', '-m', 'test: missing policy skill')
  assert.throws(() => prepareReview(f.options), /skill_mismatch/)
})

test('a moved fetched head has a fixed diagnostic distinct from fetch failure', (t) => {
  const f = fixture(t)
  const git = (repo, args, env) =>
    args.join(' ') === 'rev-parse FETCH_HEAD'
      ? 'f'.repeat(40)
      : f.options.git(repo, args, env)
  assert.throws(() => prepareReview({ ...f.options, git }), /source_changed/)
  assert.equal(f.calls.filter(({ args }) => args[0] === 'fetch').length, 1)
})

test('an unrelated working directory and hostile caller scripts cannot supply runtime code', async (t) => {
  const f = fixture(t)
  prepareReview(f.options)
  const resultPath = path.join(f.temp, 'draft-ai-review-result.json')
  fs.writeFileSync(resultPath, JSON.stringify(result(f.head)))
  const validated = spawnSync(
    process.execPath,
    [path.join(f.root, '.github/scripts/ocr-controller.cjs'), 'validate'],
    {
      cwd: os.tmpdir(),
      env: {
        ...process.env,
        GITHUB_WORKSPACE: f.repo,
        RUNNER_TEMP: f.temp,
        HEAD_SHA: 'f'.repeat(40),
      },
      encoding: 'utf8',
      timeout: 30000,
    }
  )
  assert.equal(validated.status, 0, validated.stderr)
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(f.temp, 'draft-ai-review-publication.json'))
    ).manifest.input.resolved_head,
    f.head
  )
  f.git('checkout', '--detach', f.head)
  await assert.rejects(runCommand('validate', f), /policy_changed/)
})

test('controller preserves failed review exit and sanitized child environment before partial publication', (t) => {
  const f = fixture(t)
  prepareReview(f.options)
  const bin = path.join(f.temp, 'bin')
  fs.mkdirSync(bin)
  fs.writeFileSync(
    path.join(bin, 'ocr'),
    `#!${process.execPath}\nconst args=process.argv.slice(2); if(process.env.GITHUB_TOKEN || process.env.MISTRAL_API_KEY || process.env.CONTEXT7_API_KEY) process.exit(99); process.stdout.write(JSON.stringify(${JSON.stringify(result(f.head))})); process.exitCode=7\n`,
    { mode: 0o700 }
  )
  const ran = spawnSync(
    process.execPath,
    [path.join(f.root, '.github/scripts/ocr-controller.cjs'), 'run'],
    {
      cwd: os.tmpdir(),
      env: {
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        GITHUB_WORKSPACE: f.repo,
        RUNNER_TEMP: f.temp,
        MISTRAL_API_KEY: 'synthetic-provider',
        GITHUB_TOKEN: 'synthetic-publication',
        CONTEXT7_API_KEY: 'synthetic-docs',
      },
      encoding: 'utf8',
      timeout: 30000,
    }
  )
  assert.equal(ran.status, 7, ran.stderr)
  assert.match(
    ran.stdout,
    /OCR coverage status=partial selected=2 completed=1 failed=1/
  )
  assert.ok(!ran.stdout.includes('synthetic-provider'))
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(f.temp, 'draft-ai-review-outcome.json'))
    ).policy_sha,
    f.policy
  )
})

test('publication rejects superseded heads and malformed results before loading the publisher', async (t) => {
  const f = fixture(t)
  prepareReview(f.options)
  const context = {
    repo: { owner: 'synthetic', repo: 'caller' },
    payload: { pull_request: { number: 1 } },
  }
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: { state: 'open', draft: true, head: { sha: 'f'.repeat(40) } },
        }),
      },
    },
  }
  let loaded = false
  const options = {
    ...f,
    loadPublisher: () => {
      loaded = true
    },
  }
  await assert.rejects(
    publishReview({ github, context, core: {} }, options),
    /review_superseded/
  )
  github.rest.pulls.get = async () => ({
    data: { state: 'open', draft: true, head: { sha: f.head } },
  })
  fs.writeFileSync(path.join(f.temp, 'draft-ai-review-result.json'), '{}')
  await assert.rejects(
    publishReview({ github, context, core: {} }, options),
    /invalid_result/
  )
  assert.equal(loaded, false)
})

test('valid partial findings reach only the verified publisher and preserve its publication policy', {
  skip: !process.env.OCR_TEST_PUBLISHER,
}, async (t) => {
  const f = fixture(t)
  prepareReview(f.options)
  fs.writeFileSync(
    path.join(f.temp, 'draft-ai-review-result.json'),
    JSON.stringify(result(f.head))
  )
  const file = path.join(
    f.repo,
    '.ocr-upstream/scripts/github-actions/post-review-comments.js'
  )
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.copyFileSync(process.env.OCR_TEST_PUBLISHER, file)
  let published
  const options = {
    ...f,
    loadPublisher: (value) => {
      assert.equal(value, file)
      return {
        runPostReviewComments: async (input) => {
          published = input
        },
      }
    },
  }
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: { state: 'open', draft: true, head: { sha: f.head } },
        }),
      },
    },
  }
  const context = {
    repo: { owner: 'synthetic', repo: 'caller' },
    payload: { pull_request: { number: 1 } },
  }
  await publishReview({ github, context, core: {} }, options)
  const sent = JSON.parse(fs.readFileSync(published.resultPath))
  assert.equal(sent.status, 'partial')
  assert.equal(sent.warnings.at(-1).type, 'review_incomplete')
  assert.equal(published.incrementalOverlapThreshold, 0.6)
  assert.equal(published.reviewCommentBatchSize, 50)
  assert.equal(published.routeSeverityBelow, 'low')
  assert.equal(published.resolveOutdated, 'false')
  fs.writeFileSync(file, 'UNVERIFIED_PUBLISHER')
  await assert.rejects(
    publishReview({ github, context, core: {} }, options),
    /invalid_publisher/
  )
})

test('the shared caller check rejects mutated pins, execution, credentials, policy and admission', (t) => {
  const f = fixture(t)
  const options = {
    ...f,
    revision: REVISION,
    runtimeRepository: 'synthetic/runtime',
  }
  assert.equal(checkCaller(caller(), options).revision, REVISION)
  for (const change of [
    (w) => {
      w.jobs['ocr-review'].steps[0].uses =
        'synthetic/runtime/.github/actions/ocr-review@main'
    },
    (w) => {
      w.jobs['ocr-review'].steps.push({ run: 'candidate-command' })
    },
    (w) => {
      w.permissions.contents = 'write'
    },
    (w) => {
      w.env = { GITHUB_TOKEN: 'synthetic-leak' }
    },
    (w) => {
      w.jobs['ocr-review'].steps[0].env = { MISTRAL_API_KEY: 'synthetic-leak' }
    },
    (w) => {
      w.jobs['ocr-review'].if = 'true'
    },
    (w) => {
      w.concurrency['cancel-in-progress'] = false
    },
    (w) => {
      w.jobs['ocr-review']['timeout-minutes'] = 90
    },
    (w) => {
      w.jobs['ocr-review'].env.OCR_NO_UPDATE = '0'
    },
    (w) => {
      w.jobs['ocr-review']['continue-on-error'] = true
    },
  ]) {
    const workflow = caller()
    change(workflow)
    assert.throws(() => checkCaller(workflow, options), /invalid_caller/)
  }
  const workflow = caller()
  const activation = "vars.OCR_ENABLED == 'true'"
  workflow.jobs['ocr-review'].if =
    `(${workflow.jobs['ocr-review'].if}) && (${activation})`
  assert.throws(() => checkCaller(workflow, options), /invalid_caller/)
  assert.equal(
    checkCaller(workflow, { ...options, activation }).revision,
    REVISION
  )
  const config = path.join(f.repo, '.github/open-code-review/repository.json')
  fs.writeFileSync(
    config,
    JSON.stringify({ schema: 'ocr-repository/v1', model: 'unapproved' })
  )
  assert.equal(checkCaller(caller(), options).revision, REVISION)
  f.git('add', '.')
  f.git('commit', '-m', 'test: invalid trusted configuration')
  assert.throws(
    () =>
      checkCaller(caller(), { ...options, policy: f.git('rev-parse', 'HEAD') }),
    /invalid_repository_config/
  )
  fs.writeFileSync(config, JSON.stringify({ schema: 'ocr-repository/v1' }))
  fs.writeFileSync(path.join(f.repo, SKILL), 'MISMATCHED_POLICY_SKILL')
  f.git('add', '.')
  f.git('commit', '-m', 'test: invalid trusted skill')
  assert.throws(
    () =>
      checkCaller(caller(), { ...options, policy: f.git('rev-parse', 'HEAD') }),
    /skill_mismatch/
  )
})

test('the composite preserves failure, cancellation, validation, artifact and summary conclusions', () => {
  const action = YAML.parse(
    fs.readFileSync(
      path.join(ROOT, '.github/actions/ocr-review/action.yml'),
      'utf8'
    )
  )
  const steps = action.runs.steps
  const validation = steps.find((step) => step.id === 'validate')
  const publication = steps.find(
    (step) => step.name === 'Publish draft findings'
  )
  const artifacts = steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )
  const summary = steps.find((step) => step.run?.includes(' summary'))
  const admitted = (step, states, cancelled) =>
    vm.runInNewContext(
      step.if.replace(/^\$\{\{\s*|\s*\}\}$/g, ''),
      { steps: states, cancelled: () => cancelled },
      { timeout: 100 }
    )
  assert.equal(
    admitted(validation, { review: { outcome: 'failure' } }, false),
    true
  )
  assert.equal(
    admitted(publication, { validate: { outcome: 'success' } }, false),
    true
  )
  assert.equal(
    admitted(publication, { validate: { outcome: 'failure' } }, false),
    false
  )
  assert.equal(
    admitted(publication, { validate: { outcome: 'success' } }, true),
    false
  )
  assert.notEqual(
    steps.find((step) => step.id === 'review')['continue-on-error'],
    true
  )
  assert.notEqual(publication['continue-on-error'], true)
  assert.notEqual(artifacts['continue-on-error'], true)
  assert.equal(summary['continue-on-error'], true)
  const review = steps.find((step) => step.id === 'review')
  assert.equal(review.env.MISTRAL_API_KEY, '${{ inputs.mistral-api-key }}')
  assert.equal(review.env.OCR_NO_UPDATE, '1')
  assert.equal(publication.env.MISTRAL_API_KEY, undefined)
  assert.equal(publication.env.OCR_ACTION_PATH, '${{ github.action_path }}')
  for (const step of steps) {
    if (step !== review) {
      assert.equal(step.env?.MISTRAL_API_KEY, undefined)
      assert.equal(step.env?.CONTEXT7_API_KEY, undefined)
    }
  }
  assert.equal(artifacts.with['retention-days'], 7)
  const checkout = steps.find(
    (step) => step.name === 'Checkout trusted review policy'
  )
  assert.equal(checkout.with['fetch-depth'], 0)
  assert.equal(checkout.with['persist-credentials'], false)
  assert.equal(checkout.with.filter, undefined)
  assert.equal(checkout.with['sparse-checkout'], undefined)
})
