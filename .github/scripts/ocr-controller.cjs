'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { isDeepStrictEqual } = require('node:util')

const ROOT = path.resolve(__dirname, '../..')
const MANIFEST = '.github/open-code-review/runtime-manifest.json'
const SKILL = '.agents/skills/ocr-reviewer/SKILL.md'
const ASSETS = [
  '.github/actions/ocr-review/action.yml',
  '.github/scripts/ocr-controller.cjs',
  '.github/scripts/ocr-draft-review.cjs',
  '.github/scripts/ocr-mistral-adapter.cjs',
  '.github/scripts/ocr-review-tools.cjs',
  '.github/scripts/ocr-review-shared.cjs',
  '.github/scripts/ocr-runtime-config.cjs',
  '.github/scripts/install-patched-ocr.cjs',
  '.github/open-code-review/ocr-compression.patch',
  SKILL,
]
const SHA = /^[a-f0-9]{40}$/
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9_-]*\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/
const digest = (bytes) =>
  crypto.createHash('sha256').update(bytes).digest('hex')
const fail = (code) => {
  throw new Error(code)
}

function readFile(root, file, limit = 4 * 1024 * 1024) {
  let current = root
  for (const part of file.split('/')) {
    if (!part || part === '.' || part === '..') fail('invalid_runtime')
    current = path.join(current, part)
    if (fs.lstatSync(current).isSymbolicLink()) fail('invalid_runtime')
  }
  const stat = fs.statSync(current)
  if (!stat.isFile() || stat.size > limit) fail('invalid_runtime')
  return fs.readFileSync(current)
}

// Only built-ins run until the complete release has been checked. The caller
// repository supplies policy blobs; it never supplies executable runtime files.
function verifyRelease(root = ROOT) {
  let bytes, manifest
  try {
    bytes = readFile(root, MANIFEST, 32768)
    manifest = JSON.parse(bytes)
    if (
      manifest.schema !== 'ocr-runtime/v1' ||
      !manifest.assets ||
      Object.keys(manifest.assets).sort().join('\n') !==
        [...ASSETS].sort().join('\n')
    )
      fail('invalid_runtime')
    for (const file of ASSETS) {
      if (
        !/^[a-f0-9]{64}$/.test(manifest.assets[file]) ||
        digest(readFile(root, file)) !== manifest.assets[file]
      )
        fail('invalid_runtime')
    }
  } catch {
    fail('invalid_runtime')
  }
  const runner = require(
    path.join(root, '.github/scripts/ocr-draft-review.cjs')
  )
  const adapter = require(
    path.join(root, '.github/scripts/ocr-mistral-adapter.cjs')
  )
  const installer = require(
    path.join(root, '.github/scripts/install-patched-ocr.cjs')
  )
  if (
    !isDeepStrictEqual(manifest.draft.profile, runner.DRAFT_PROFILE) ||
    manifest.draft.model !== adapter.MISTRAL_FLASH_MODEL ||
    manifest.draft.advisor_model !== adapter.MISTRAL_MODEL ||
    manifest.draft.package !== '@alibaba-group/open-code-review@1.13.0' ||
    manifest.draft.publisher.repository !== 'alibaba/open-code-review' ||
    manifest.draft.publisher.revision !==
      '1672852136fc87748249d22bce0819f33419ea79' ||
    manifest.draft.publisher.sha256 !== runner.PUBLISHER_SHA256 ||
    manifest.final.source !== installer.SOURCE_COMMIT ||
    manifest.final.archive_sha256 !== installer.SOURCE_SHA256 ||
    manifest.final.go !== installer.GO_VERSION ||
    manifest.final.patch_sha256 !==
      manifest.assets['.github/open-code-review/ocr-compression.patch']
  )
    fail('invalid_runtime')
  return { manifest, manifestDigest: digest(bytes), runner }
}

function metadataGit(repo, args, env) {
  return execFileSync('git', args, {
    cwd: repo,
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function checkPolicy(root, release, repo, policy) {
  const { readRepositoryConfig, readPolicyBlob } = require(
    path.join(root, '.github/scripts/ocr-runtime-config.cjs')
  )
  const config = readRepositoryConfig(repo, policy)
  let skill
  try {
    skill = readPolicyBlob(repo, policy, SKILL, 32768)
  } catch {
    fail('skill_mismatch')
  }
  if (digest(skill) !== release.manifest.assets[SKILL]) fail('skill_mismatch')
  return config
}

function prepareReview(options) {
  const {
    root = ROOT,
    repo,
    temp,
    event,
    repository,
    revision,
    runtimeRepository,
    server = 'https://github.com',
    token,
    git = metadataGit,
  } = options
  const release = verifyRelease(root)
  const pull = event?.pull_request
  if (
    options.eventName !== 'pull_request_target' ||
    !SHA.test(revision) ||
    !REPOSITORY.test(runtimeRepository) ||
    !REPOSITORY.test(repository) ||
    event.repository?.full_name !== repository ||
    pull?.base?.repo?.full_name !== repository ||
    pull?.draft !== true ||
    pull?.user?.login === 'dependabot[bot]' ||
    !Number.isSafeInteger(pull?.number) ||
    pull.number < 1 ||
    !SHA.test(pull?.head?.sha) ||
    !SHA.test(pull?.base?.sha)
  )
    fail('invalid_review_identity')
  const url = new URL(server)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    fail('invalid_review_identity')
  const { gitEnvironment } = require(
    path.join(root, '.github/scripts/ocr-runtime-config.cjs')
  )
  const env = gitEnvironment()
  const policy = git(repo, ['rev-parse', 'HEAD'], env)
  if (!SHA.test(policy)) fail('invalid_review_identity')
  const config = checkPolicy(root, release, repo, policy)
  // Authentication exists only in these fetch processes, never Git config on
  // disk, subprocess arguments, metadata reads, or the review child.
  const fetchEnv = { ...env }
  if (token) {
    fetchEnv.GIT_CONFIG_COUNT = '1'
    fetchEnv.GIT_CONFIG_KEY_0 = `http.${url.origin}/.extraheader`
    fetchEnv.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
  }
  const remote = `${url.origin}/${repository}.git`
  const fetch = (ref) => {
    try {
      git(repo, ['fetch', '--no-tags', remote, ref], fetchEnv)
    } catch {
      fail('source_unavailable')
    }
  }
  fetch(`pull/${pull.number}/head`)
  if (git(repo, ['rev-parse', 'FETCH_HEAD'], env) !== pull.head.sha)
    fail('source_changed')
  fetch(pull.base.sha)
  const from = git(repo, ['merge-base', pull.base.sha, pull.head.sha], env)
  if (!SHA.test(from)) fail('invalid_review_identity')
  const { buildReviewBackground } = require(
    path.join(root, '.github/scripts/ocr-review-shared.cjs')
  )
  const context = {
    schema: 'ocr-action-context/v1',
    repository,
    number: pull.number,
    runtime_repository: runtimeRepository,
    runtime_revision: revision,
    manifest_sha256: release.manifestDigest,
    policy,
    base: pull.base.sha,
    head: pull.head.sha,
    from,
    background: buildReviewBackground(pull.title, pull.body),
  }
  fs.writeFileSync(
    path.join(temp, 'ocr-action-context.json'),
    JSON.stringify(context),
    { mode: 0o600 }
  )
  const { background, ...identity } = context
  fs.writeFileSync(
    path.join(temp, 'ocr-runtime-identity.json'),
    JSON.stringify({
      ...identity,
      profile: config.profile,
      config_sha256: digest(JSON.stringify(config)),
      skill_sha256: release.manifest.assets[SKILL],
    }),
    { mode: 0o600 }
  )
  return context
}

function readContext(root, repo, temp) {
  const release = verifyRelease(root)
  const context = JSON.parse(readFile(temp, 'ocr-action-context.json', 65536))
  if (
    context.schema !== 'ocr-action-context/v1' ||
    !REPOSITORY.test(context.repository) ||
    !REPOSITORY.test(context.runtime_repository) ||
    !Number.isSafeInteger(context.number) ||
    context.number < 1 ||
    ![
      context.runtime_revision,
      context.policy,
      context.base,
      context.head,
      context.from,
    ].every((v) => SHA.test(v)) ||
    context.manifest_sha256 !== release.manifestDigest ||
    typeof context.background !== 'string'
  )
    fail('invalid_review_identity')
  const { gitEnvironment } = require(
    path.join(root, '.github/scripts/ocr-runtime-config.cjs')
  )
  if (
    metadataGit(repo, ['rev-parse', 'HEAD'], gitEnvironment()) !==
    context.policy
  )
    fail('policy_changed')
  checkPolicy(root, release, repo, context.policy)
  return { release, context }
}

async function runCommand(command, options) {
  const {
    root = ROOT,
    repo,
    temp,
    publisherRoot = path.join(repo, '.ocr-upstream'),
  } = options
  if (command === 'summary' || command === 'verify-install') {
    return verifyRelease(root).runner.main({
      command,
      repo,
      temp,
      publisherRoot,
    })
  }
  if (!['run', 'validate'].includes(command)) fail('invalid_command')
  let credentials
  if (command === 'run') {
    credentials = {
      apiKey: process.env.MISTRAL_API_KEY,
      advisorApiKey: process.env.MISTRAL_API_KEY,
      context7ApiKey: process.env.CONTEXT7_API_KEY,
    }
    for (const name of Object.keys(process.env)) {
      if (
        /(?:TOKEN|API_KEY|PASSWORD|SECRET|AUTHORIZATION|CREDENTIAL)/i.test(name)
      )
        delete process.env[name]
    }
  }
  const { release, context } = readContext(root, repo, temp)
  return release.runner.main({
    command,
    repo,
    temp,
    publisherRoot,
    policy: context.policy,
    from: context.from,
    head: context.head,
    background: context.background,
    credentials,
  })
}

async function publishReview(
  { github, context: githubContext, core },
  options
) {
  const {
    root = ROOT,
    repo,
    temp,
    publisherRoot = path.join(repo, '.ocr-upstream'),
  } = options
  const { release, context } = readContext(root, repo, temp)
  if (
    `${githubContext.repo.owner}/${githubContext.repo.repo}` !==
      context.repository ||
    githubContext.payload.pull_request.number !== context.number
  )
    fail('invalid_review_identity')
  const current = (
    await github.rest.pulls.get({
      ...githubContext.repo,
      pull_number: context.number,
    })
  ).data
  if (
    current.state !== 'open' ||
    current.draft !== true ||
    current.head.sha !== context.head
  )
    fail('review_superseded')
  await release.runner.main({
    command: 'validate',
    repo,
    temp,
    head: context.head,
  })
  const file = 'scripts/github-actions/post-review-comments.js'
  if (
    digest(readFile(publisherRoot, file)) !==
    release.manifest.draft.publisher.sha256
  )
    fail('invalid_publisher')
  const { runPostReviewComments } = (options.loadPublisher ?? require)(
    path.join(publisherRoot, file)
  )
  try {
    await runPostReviewComments({
      github,
      context: githubContext,
      fs,
      core: {
        ...core,
        info: () => {},
        warning: () => core.warning('OCR publisher reported a warning'),
      },
      prNumber: context.number,
      resultPath: path.join(temp, 'draft-ai-review-publication.json'),
      stderrPath: path.join(temp, 'draft-ai-review-publisher-stderr.log'),
      stickySummary: true,
      incremental: true,
      incrementalOverlapThreshold: 0.6,
      reviewCommentBatchSize: 50,
      routeSeverityBelow: 'low',
      routeCategories: '',
      checkpointEnabled: false,
      checkpointCarry: '',
      checkpointFingerprint: '',
      rangeMode: '',
      rangeFrom: '',
      rangeTo: '',
      resolveOutdated: 'false',
    })
  } catch {
    fail('publication_failed')
  }
}

function checkCaller(workflow, options) {
  const {
    root = ROOT,
    repo,
    policy,
    revision,
    runtimeRepository,
    activation,
  } = options
  const release = verifyRelease(root)
  if (!SHA.test(revision) || !REPOSITORY.test(runtimeRepository))
    fail('invalid_caller')
  checkPolicy(root, release, repo, policy)
  const job = workflow.jobs?.['ocr-review']
  const admission =
    "github.event.pull_request.user.login != 'dependabot[bot]' && github.event.pull_request.draft == true"
  const expression = (value) =>
    String(value ?? '')
      .trim()
      .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const wanted = activation ? `(${admission}) && (${activation})` : admission
  const steps = job?.steps
  const permissions = job?.permissions ?? workflow.permissions
  if (
    Object.keys(workflow).some(
      (key) =>
        !['name', 'on', 'permissions', 'concurrency', 'jobs'].includes(key)
    ) ||
    Object.keys(workflow.on ?? {}).join() !== 'pull_request_target' ||
    !isDeepStrictEqual(workflow.on.pull_request_target?.types, [
      'opened',
      'synchronize',
      'reopened',
      'ready_for_review',
      'converted_to_draft',
    ]) ||
    Object.keys(workflow.jobs ?? {}).join() !== 'ocr-review' ||
    Object.keys(job ?? {}).some(
      (key) =>
        ![
          'name',
          'permissions',
          'runs-on',
          'timeout-minutes',
          'if',
          'env',
          'steps',
        ].includes(key)
    ) ||
    !isDeepStrictEqual(permissions, {
      contents: 'read',
      'pull-requests': 'write',
    }) ||
    job?.['timeout-minutes'] !== 45 ||
    job?.['runs-on'] !== 'ubuntu-latest' ||
    expression(job?.if) !== wanted ||
    job?.env?.OCR_NO_UPDATE !== '1' ||
    workflow.concurrency?.['cancel-in-progress'] !== true ||
    workflow.concurrency?.group !==
      '${{ github.workflow }}-${{ github.event.pull_request.number || github.ref_name }}' ||
    Object.keys(job?.env ?? {}).some(
      (name) => !['OCR_NO_UPDATE', 'OCR_ADAPTER_PROVIDER'].includes(name)
    ) ||
    (job?.env?.OCR_ADAPTER_PROVIDER !== undefined &&
      job.env.OCR_ADAPTER_PROVIDER !== 'mistral-flash') ||
    !Array.isArray(steps) ||
    steps.length !== 1 ||
    steps[0].uses !==
      `${runtimeRepository}/.github/actions/ocr-review@${revision}` ||
    Object.keys(steps[0]).some(
      (key) => !['name', 'uses', 'with'].includes(key)
    ) ||
    !isDeepStrictEqual(steps[0].with, {
      'mistral-api-key': '${{ secrets.MISTRAL_API_KEY }}',
      'context7-api-key': '${{ secrets.CONTEXT7_API_KEY }}',
      'github-token': '${{ github.token }}',
    })
  )
    fail('invalid_caller')
  return { profile: release.manifest.draft.profile.id, revision }
}

async function main() {
  const options = {
    repo: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    temp: process.env.RUNNER_TEMP,
  }
  if (!options.temp || !path.isAbsolute(options.temp))
    fail('invalid_run_directory')
  const command = process.argv[2]
  if (command === 'prepare') {
    prepareReview({
      ...options,
      event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      eventName: process.env.GITHUB_EVENT_NAME,
      repository: process.env.GITHUB_REPOSITORY,
      revision: process.env.OCR_ACTION_REF,
      runtimeRepository: process.env.OCR_ACTION_REPOSITORY,
      server: process.env.GITHUB_SERVER_URL,
      token: process.env.GITHUB_TOKEN,
    })
    return 0
  }
  if (command === 'check-caller') {
    checkCaller(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), {
      ...options,
      policy: process.argv[4],
      revision: process.env.OCR_ACTION_REF,
      runtimeRepository: process.env.OCR_ACTION_REPOSITORY,
      activation: process.env.OCR_CALLER_ACTIVATION,
    })
    return 0
  }
  if (command === 'verify-release') {
    const { manifest } = verifyRelease()
    if (
      !SHA.test(process.env.OCR_ACTION_REF) ||
      !REPOSITORY.test(process.env.OCR_ACTION_REPOSITORY)
    )
      fail('invalid_runtime_identity')
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `package=${manifest.draft.package}\npublisher-revision=${manifest.draft.publisher.revision}\n`
    )
    return 0
  }
  return runCommand(command, options)
}

module.exports = {
  verifyRelease,
  prepareReview,
  runCommand,
  publishReview,
  checkCaller,
  ASSETS,
}
if (require.main === module)
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      const known = new Set([
        'invalid_runtime',
        'skill_mismatch',
        'invalid_review_identity',
        'source_unavailable',
        'source_changed',
        'policy_changed',
        'invalid_command',
        'invalid_publisher',
        'review_superseded',
        'publication_failed',
        'invalid_caller',
        'invalid_run_directory',
        'invalid_runtime_identity',
        'invalid_repository_config',
        'review_source_unavailable',
        'invalid_result',
        'invalid_install',
      ])
      process.stderr.write(
        `OCR shared controller failed: ${known.has(error.message) ? error.message : 'execution_failed'}\n`
      )
      process.exitCode = 1
    })
