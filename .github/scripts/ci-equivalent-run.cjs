const { isDeepStrictEqual } = require('node:util')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const WORKFLOWS = {
  unit: 'test-unit.yml',
  playwright: 'test-playwright.yml',
}
const UNIT_STEPS = [
  'Test Prisma disposable guard',
  'Test chat app',
  'Test frontend PWA',
  'Test grading package',
  'Test markdown package',
  'Test util package',
]

// Bounded pagination never treats a partial API response as complete evidence.
async function listAll(request, key) {
  const values = []
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await request({ page, per_page: 100 })
    const batch = key ? data[key] : data
    if (!Array.isArray(batch)) throw new Error('Invalid API collection')
    values.push(...batch)
    if (batch.length < 100) {
      if (key && data.total_count !== values.length) {
        throw new Error('Incomplete API collection')
      }
      return values
    }
  }
  throw new Error('API pagination limit reached')
}

async function readArtifactJson(github, repo, run, name, filename) {
  const artifacts = await listAll(
    (paging) =>
      github.rest.actions.listWorkflowRunArtifacts({
        ...repo,
        ...paging,
        run_id: run.id,
      }),
    'artifacts'
  )
  const matches = artifacts.filter(
    (artifact) => artifact.name === name && !artifact.expired
  )
  if (matches.length !== 1 || matches[0].size_in_bytes > 1048576)
    throw new Error('Missing or ambiguous artifact')
  const response = await github.rest.actions.downloadArtifact({
    ...repo,
    artifact_id: matches[0].id,
    archive_format: 'zip',
  })
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-proof-'))
  try {
    const archive = path.join(directory, 'proof.zip')
    fs.writeFileSync(archive, Buffer.from(response.data))
    return JSON.parse(
      execFileSync('unzip', ['-p', archive, filename], {
        encoding: 'utf8',
        maxBuffer: 1048576,
        timeout: 10000,
      })
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

function samePull(pull, repository, branch, sha) {
  return (
    pull.state === 'open' &&
    pull.draft === false &&
    pull.head?.repo?.full_name === repository &&
    pull.base?.repo?.full_name === repository &&
    pull.head.ref === branch &&
    pull.head.sha === sha
  )
}

function successful(run) {
  return run.status === 'completed' && run.conclusion === 'success'
}

function bindsPull(run, pull, repository) {
  const binding = run.pull_requests?.find((item) => item.number === pull.number)
  return (
    run.repository?.full_name === repository &&
    run.head_repository?.full_name === repository &&
    run.event === 'pull_request' &&
    run.head_branch === pull.head.ref &&
    run.head_sha === pull.head.sha &&
    binding?.head?.sha === pull.head.sha &&
    binding?.head?.repo?.id === pull.head.repo.id &&
    binding?.base?.sha === pull.base.sha &&
    binding?.base?.repo?.id === pull.base.repo.id
  )
}

function coverageMatches(kind, jobs, plan) {
  if (kind === 'unit') {
    const matches = jobs.filter((job) => job.name === 'test-unit')
    return (
      matches.length === 1 &&
      successful(matches[0]) &&
      UNIT_STEPS.every((name) =>
        matches[0].steps?.some((step) => step.name === name && successful(step))
      )
    )
  }
  if (kind !== 'playwright' || plan?.mode !== 'full' || plan.shardCount !== 8) {
    return false
  }
  const builds = jobs.filter((job) =>
    job.name.endsWith('/ build-and-compile-hosted')
  )
  const shards = jobs.filter((job) =>
    job.name.includes('/ test-playwright-hosted (')
  )
  return (
    builds.length === 1 &&
    successful(builds[0]) &&
    shards.length === 8 &&
    shards.every(successful) &&
    Array.from({ length: 8 }, (_, i) => i + 1).every(
      (index) =>
        shards.filter((job) =>
          job.name.endsWith(`/ test-playwright-hosted (${index}, 8)`)
        ).length === 1
    ) &&
    jobs.every(
      (job) => !job.name.includes('public-pr') || job.conclusion === 'skipped'
    )
  )
}

function planMatches(previous, current) {
  const fields = [
    'schemaVersion',
    'mode',
    'trustedRuntimeApps',
    'candidateSpecs',
    'selectedSpecs',
    'profileAssignments',
    'selectedProfiles',
    'shardCount',
    'shards',
  ]
  return (
    previous?.mode === 'full' &&
    current?.mode === 'full' &&
    current.shardCount === 8 &&
    fields.every(
      (field) =>
        current[field] !== undefined &&
        isDeepStrictEqual(previous[field], current[field])
    )
  )
}

async function findEquivalentRun({
  github,
  context,
  kind,
  controlSha,
  plan,
  readPlan,
  readReceipt,
}) {
  const repository = `${context.repo.owner}/${context.repo.repo}`
  // Every v3 / v3-* push is a possible deployment source and must carry its own
  // push validation, so no equivalent PR run may substitute for one.
  if (
    repository !== REPOSITORY ||
    context.eventName !== 'push' ||
    !context.ref?.startsWith('refs/heads/') ||
    context.ref.startsWith('refs/heads/v3') ||
    !WORKFLOWS[kind]
  )
    return null

  const branch = context.ref.slice('refs/heads/'.length)
  const repo = context.repo
  const pulls = await listAll((paging) =>
    github.rest.pulls.list({
      ...repo,
      ...paging,
      state: 'open',
      head: `${repo.owner}:${branch}`,
    })
  )
  if (
    pulls.length !== 1 ||
    !samePull(pulls[0], repository, branch, context.sha)
  )
    return null
  const pull = pulls[0]
  const getRuns = () =>
    listAll(
      (paging) =>
        github.rest.actions.listWorkflowRuns({
          ...repo,
          ...paging,
          workflow_id: WORKFLOWS[kind],
          event: 'pull_request',
          branch,
          head_sha: context.sha,
        }),
      'workflow_runs'
    )
  const chooseLatest = (runs) =>
    runs
      .filter((run) =>
        run.pull_requests?.some((item) => item.number === pull.number)
      )
      .sort((a, b) => b.id - a.id)[0]
  const candidate = chooseLatest(await getRuns())
  if (!candidate) return null
  const { data: run } = await github.rest.actions.getWorkflowRun({
    ...repo,
    run_id: candidate.id,
  })
  if (
    run.id !== candidate.id ||
    run.workflow_id !== candidate.workflow_id ||
    !successful(run) ||
    !bindsPull(run, pull, repository)
  )
    return null
  if (run.path?.split('@')[0] !== `.github/workflows/${WORKFLOWS[kind]}`)
    return null

  // PR workflows normally test the merge ref, while push workflows test head.
  // Equal parents and trees prove this PR's current synthetic merge is equivalent.
  const [{ data: merge }, { data: head }] = await Promise.all([
    github.rest.repos.getCommit({
      ...repo,
      ref: `refs/pull/${pull.number}/merge`,
    }),
    github.rest.repos.getCommit({ ...repo, ref: context.sha }),
  ])
  if (
    merge.parents?.length !== 2 ||
    merge.parents[0].sha !== pull.base.sha ||
    merge.parents[1].sha !== context.sha ||
    !head.commit?.tree?.sha ||
    merge.commit?.tree?.sha !== head.commit.tree.sha
  )
    return null

  const receipt = await (readReceipt
    ? readReceipt(run)
    : readArtifactJson(
        github,
        repo,
        run,
        'ci-validation-receipt',
        'ci-validation-receipt.json'
      ))
  if (
    receipt.schemaVersion !== 1 ||
    receipt.event !== 'pull_request' ||
    receipt.runId !== run.id ||
    receipt.runAttempt !== run.run_attempt ||
    receipt.headSha !== context.sha ||
    receipt.baseSha !== pull.base.sha ||
    receipt.treeSha !== head.commit.tree.sha ||
    (kind === 'playwright' && receipt.controlSha !== controlSha)
  )
    return null

  const jobs = await listAll(
    (paging) =>
      github.rest.actions.listJobsForWorkflowRunAttempt({
        ...repo,
        ...paging,
        run_id: run.id,
        attempt_number: run.run_attempt,
      }),
    'jobs'
  )
  if (!coverageMatches(kind, jobs, plan)) return null
  if (kind === 'playwright') {
    const controls = run.referenced_workflows?.filter(
      (workflow) =>
        workflow.path ===
        `${repository}/.github/workflows/public-pr-playwright-shards.yml@v3`
    )
    if (controls?.length !== 1 || controls[0].sha !== controlSha) return null
    const previous = await (readPlan
      ? readPlan(run)
      : readArtifactJson(
          github,
          repo,
          run,
          'playwright-execution-plan',
          'playwright-execution-plan.json'
        ))
    if (
      !planMatches(previous, plan) ||
      previous.headSha !== context.sha ||
      previous.baseSha !== pull.base.sha
    )
      return null
  }

  const [{ data: freshPull }, { data: freshRun }, latestRuns] =
    await Promise.all([
      github.rest.pulls.get({ ...repo, pull_number: pull.number }),
      github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id }),
      getRuns(),
    ])
  if (
    !samePull(freshPull, repository, branch, context.sha) ||
    freshPull.base.sha !== pull.base.sha ||
    freshRun.id !== run.id ||
    freshRun.workflow_id !== run.workflow_id ||
    freshRun.path !== run.path ||
    freshRun.run_attempt !== run.run_attempt ||
    !successful(freshRun) ||
    !bindsPull(freshRun, freshPull, repository) ||
    chooseLatest(latestRuns)?.id !== run.id
  )
    return null
  return { id: run.id, url: run.html_url, attempt: run.run_attempt }
}

async function reportEquivalentRun(options) {
  const { core } = options
  try {
    const run = await findEquivalentRun(options)
    core.setOutput('duplicate_run_id', run ? String(run.id) : '')
    if (run) {
      await core.summary
        .addRaw(
          `Validation already passed in [run ${run.id}, attempt ${run.attempt}](${run.url}).\n`
        )
        .write()
    }
    return run
  } catch {
    core.info(
      'Equivalent PR validation could not be proved; running normal validation.'
    )
    core.setOutput('duplicate_run_id', '')
    return null
  }
}

module.exports = {
  listAll,
  samePull,
  successful,
  bindsPull,
  coverageMatches,
  planMatches,
  findEquivalentRun,
  reportEquivalentRun,
}
