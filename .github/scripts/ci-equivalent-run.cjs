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
// Pull-request lifecycle events that never change the merge input may validate
// an equivalent completed run instead of repeating it. Everything else — a new
// head, a retargeted base, an unknown action — falls back to normal validation.
const PR_REUSE_ACTIONS = new Set(['ready_for_review', 'edited', 'reopened'])
// Job-name evidence per route: the single build and the eight shard jobs the
// route produces, plus the marker that identifies the other route's jobs.
const PLAYWRIGHT_ROUTE_JOBS = {
  hosted: {
    build: 'build-and-compile-hosted',
    shards: '/ test-playwright-hosted (',
    other: 'public-pr',
  },
  'public-pr': {
    build: 'build-and-compile-public-pr',
    shards: '/ test-playwright-public-pr (',
    other: 'hosted',
  },
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

function coverageMatches(kind, jobs, plan, route = 'hosted') {
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
  const names = PLAYWRIGHT_ROUTE_JOBS[route]
  if (!names) return false
  const builds = jobs.filter((job) => job.name.endsWith(`/ ${names.build}`))
  const shards = jobs.filter((job) => job.name.includes(names.shards))
  return (
    builds.length === 1 &&
    successful(builds[0]) &&
    shards.length === 8 &&
    shards.every(successful) &&
    Array.from({ length: 8 }, (_, i) => i + 1).every(
      (index) =>
        shards.filter((job) => job.name.endsWith(` (${index}, 8)`)).length === 1
    ) &&
    jobs.every(
      (job) => !job.name.includes(names.other) || job.conclusion === 'skipped'
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

// A pull-request lifecycle event (ready transition, title or body edit,
// reopen) may validate an already-completed full run of the same pull request
// instead of rebuilding and retesting an unchanged merge input. The prior run
// must bind to the same pull request, head and base, have tested the exact
// merge tree this event will test, have executed the same trusted control
// revision, and still be the latest attempt; the coverage must match the route
// the current event selected. Any failed proof returns null and the event runs
// normal validation.
async function findEquivalentPullRequestRun({
  github,
  context,
  kind,
  controlSha,
  plan,
  readPlan,
  readReceipt,
  route = 'hosted',
}) {
  const repository = REPOSITORY
  if (context.eventName !== 'pull_request' || !WORKFLOWS[kind]) return null
  if (kind === 'playwright' && !PLAYWRIGHT_ROUTE_JOBS[route]) return null
  if (!PR_REUSE_ACTIONS.has(context.payload?.action)) return null
  const payload = context.payload?.pull_request
  if (!payload?.number || !payload?.head?.sha || !payload?.base?.sha)
    return null

  const repo = context.repo
  const { data: pull } = await github.rest.pulls.get({
    ...repo,
    pull_number: payload.number,
  })
  if (!samePull(pull, repository, payload.head.ref, payload.head.sha))
    return null
  if (pull.head.sha !== payload.head.sha || pull.base.sha !== payload.base.sha)
    return null

  // The prior run must have tested the exact merge input this event tests, so
  // a retargeted or otherwise stale base can never validate the current head.
  const { data: merge } = await github.rest.repos.getCommit({
    ...repo,
    ref: `refs/pull/${pull.number}/merge`,
  })
  if (
    merge.parents?.length !== 2 ||
    merge.parents[0].sha !== pull.base.sha ||
    merge.parents[1].sha !== pull.head.sha ||
    !merge.commit?.tree?.sha
  )
    return null

  const headSha = pull.head.sha
  const treeSha = merge.commit.tree.sha
  // The current run is always the newest run for this head, and a run that is
  // still executing is never successful. Excluding it is what lets the lookup
  // reach the completed run this lifecycle event may actually reuse.
  const currentRunId = Number(context.runId ?? 0)
  const getRuns = () =>
    listAll(
      (paging) =>
        github.rest.actions.listWorkflowRuns({
          ...repo,
          ...paging,
          workflow_id: WORKFLOWS[kind],
          event: 'pull_request',
          branch: pull.head.ref,
          head_sha: headSha,
        }),
      'workflow_runs'
    )
  const chooseLatest = (runs) =>
    runs
      .filter(
        (run) =>
          run.id !== currentRunId &&
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
    receipt.headSha !== headSha ||
    receipt.baseSha !== pull.base.sha ||
    receipt.treeSha !== treeSha ||
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
  if (!coverageMatches(kind, jobs, plan, route)) return null
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
      previous.headSha !== headSha ||
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
    !samePull(freshPull, repository, pull.head.ref, headSha) ||
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

async function findEquivalentRun(options) {
  if (options.context?.eventName === 'pull_request')
    return findEquivalentPullRequestRun(options)
  const { github, context, kind, controlSha, plan, readPlan, readReceipt } =
    options
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
      // This lookup runs on a push, so the current run is a push run and can
      // never appear among these pull-request candidates.
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
  PR_REUSE_ACTIONS,
  listAll,
  samePull,
  successful,
  bindsPull,
  coverageMatches,
  planMatches,
  findEquivalentPullRequestRun,
  findEquivalentRun,
  reportEquivalentRun,
}
