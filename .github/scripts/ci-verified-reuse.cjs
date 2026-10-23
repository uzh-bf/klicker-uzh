// Receipts are untrusted claims. Every acceptance is reconstructed from GitHub
// metadata and Git objects by this policy in the consumer's trusted checkout.
const { createHash } = require('node:crypto')
const { isDeepStrictEqual } = require('node:util')
const {
  listAll,
  successful,
  coverageMatches,
  planMatches,
  readArtifactJson,
} = require('./ci-equivalent-run.cjs')
const REPOSITORY = 'uzh-bf/klicker-uzh'
const CALLER = '.github/workflows/test-playwright.yml'
const CONTROL = `${REPOSITORY}/.github/workflows/public-pr-playwright-shards.yml@v3`
const SHA = /^[a-f0-9]{40}$/
// These are the complete materialized trusted-control checkout roots, enforced
// in every control/action checkout. Hash every entry within them, including new
// transitive helpers, toolchain locks and selector data. Candidate files used by
// builds/tests are bound independently by exact tested-tree identity. A control
// import outside these roots cannot execute: the file is absent from checkout.
const CONTROL_SPARSE_PATHS = ['/.github/', '/playwright/', '/.devrouter.yml']
function isControlPath(file) {
  return (
    file.startsWith('.github/') ||
    file.startsWith('playwright/') ||
    file === '.devrouter.yml'
  )
}
const RUNNERS = Object.freeze({
  hosted: ['Linux', 'X64'],
  'public-pr': ['Linux', 'ARM64'],
})
function requireProof(condition, reason) {
  if (!condition) throw new Error(reason)
}
function fingerprint(tree) {
  requireProof(
    tree?.truncated === false && Array.isArray(tree.tree),
    'control-tree-incomplete'
  )
  const entries = tree.tree.filter(
    (entry) => entry.type !== 'tree' && isControlPath(entry.path)
  )
  requireProof(
    entries.length > 0 &&
      entries.every(
        (e) =>
          typeof e.path === 'string' &&
          SHA.test(e.sha) &&
          ['100644', '100755', '120000', '160000'].includes(e.mode)
      ),
    'control-tree-invalid'
  )
  requireProof(
    new Set(entries.map((e) => e.path)).size === entries.length,
    'control-tree-ambiguous'
  )
  return createHash('sha256')
    .update(
      JSON.stringify(
        entries
          .map(({ path, mode, type, sha }) => [path, mode, type, sha])
          .sort((a, b) => a[0].localeCompare(b[0]))
      )
    )
    .digest('hex')
}
function runnerMatches(receipt, route, workers) {
  const expected = RUNNERS[route]
  return (
    !!expected &&
    receipt.route === route &&
    receipt.runnerOs === expected[0] &&
    receipt.runnerArch === expected[1] &&
    receipt.workers === String(workers)
  )
}
async function treeAt(github, repo, sha) {
  requireProof(SHA.test(sha ?? ''), 'invalid-control-sha')
  const commit = (await github.rest.repos.getCommit({ ...repo, ref: sha })).data
  requireProof(
    commit.sha === sha && SHA.test(commit.commit?.tree?.sha ?? ''),
    'control-commit-unavailable'
  )
  const { data } = await github.rest.git.getTree({
    ...repo,
    tree_sha: commit.commit.tree.sha,
    recursive: 'true',
  })
  return data
}
async function contentAt(github, repo, ref, path) {
  const { data } = await github.rest.repos.getContent({ ...repo, ref, path })
  requireProof(
    data?.type === 'file' && SHA.test(data.sha ?? ''),
    'workflow-content-unavailable'
  )
  return data.sha
}
function runIdentity(run) {
  return [
    run.id,
    run.run_attempt,
    run.workflow_id,
    run.path,
    run.head_sha,
    run.head_branch,
  ]
}
function validateRun(run, pull) {
  requireProof(
    Number.isSafeInteger(run?.id) &&
      Number.isSafeInteger(run.run_attempt) &&
      run.run_attempt > 0 &&
      Number.isSafeInteger(run.workflow_id),
    'run-identity-invalid'
  )
  requireProof(
    run.repository?.full_name === REPOSITORY &&
      run.head_repository?.full_name === REPOSITORY &&
      run.event === 'pull_request' &&
      run.path?.split('@')[0] === CALLER,
    'run-provenance-mismatch'
  )
  requireProof(
    run.head_sha === pull.head.sha && run.head_branch === pull.head.ref,
    'run-head-mismatch'
  )
  requireProof(
    successful(run),
    `source-run-${String(run.status).replaceAll('_', '-')}-${run.conclusion}`
  )
}
async function sourceCandidates(github, repo, pull, currentRunId) {
  return (
    await listAll(
      (paging) =>
        github.rest.actions.listWorkflowRuns({
          ...repo,
          ...paging,
          workflow_id: 'test-playwright.yml',
          event: 'pull_request',
          branch: pull.head.ref,
          head_sha: pull.head.sha,
        }),
      'workflow_runs'
    )
  )
    .filter(
      (run) =>
        run.id !== currentRunId &&
        run.event === 'pull_request' &&
        run.head_sha === pull.head.sha &&
        run.head_branch === pull.head.ref
    )
    .sort((a, b) => b.id - a.id)
}
async function jobsFor(github, repo, run) {
  return listAll(
    (paging) =>
      github.rest.actions.listJobsForWorkflowRunAttempt({
        ...repo,
        ...paging,
        run_id: run.id,
        attempt_number: run.run_attempt,
      }),
    'jobs'
  )
}
async function findVerifiedRun({
  github,
  context,
  controlSha,
  plan,
  route = 'hosted',
  workers = '1',
  enabled = false,
  readArtifact = readArtifactJson,
  onSource = () => {},
  now = Date.now(),
}) {
  requireProof(enabled, 'reuse-disabled')
  requireProof(
    `${context.repo.owner}/${context.repo.repo}` === REPOSITORY,
    'repository-not-trusted'
  )
  requireProof(
    plan?.mode === 'full' && plan.shardCount === 8,
    'coverage-not-full'
  )
  requireProof(SHA.test(controlSha ?? ''), 'trusted-control-unavailable')
  const repo = context.repo
  const push = context.eventName === 'push'
  let pull, target
  if (push) {
    const branch = /^refs\/heads\/(v3(?:-[^/]+)?)$/.exec(context.ref ?? '')?.[1]
    requireProof(branch && SHA.test(context.sha ?? ''), 'push-not-eligible')
    target = (await github.rest.repos.getCommit({ ...repo, ref: context.sha }))
      .data
    requireProof(
      target.sha === context.sha && [1, 2].includes(target.parents?.length),
      'merge-shape-unsupported'
    )
    const associated = (
      await listAll((paging) =>
        github.rest.repos.listPullRequestsAssociatedWithCommit({
          ...repo,
          ...paging,
          commit_sha: context.sha,
        })
      )
    ).filter(
      (p) =>
        p.merged_at &&
        p.merge_commit_sha === context.sha &&
        p.base?.ref === branch &&
        p.head?.repo?.full_name === REPOSITORY &&
        p.base?.repo?.full_name === REPOSITORY
    )
    requireProof(associated.length === 1, 'merged-pr-association-ambiguous')
    pull = (
      await github.rest.pulls.get({
        ...repo,
        pull_number: associated[0].number,
      })
    ).data
    requireProof(
      pull.merged_at &&
        pull.merge_commit_sha === context.sha &&
        pull.base.ref === branch &&
        pull.head.sha === associated[0].head.sha,
      'merged-pr-association-stale'
    )
  } else {
    requireProof(
      context.eventName === 'pull_request' &&
        ['ready_for_review', 'reopened'].includes(context.payload?.action),
      'event-not-eligible'
    )
    const payload = context.payload.pull_request
    pull = (
      await github.rest.pulls.get({ ...repo, pull_number: payload.number })
    ).data
    requireProof(
      pull.state === 'open' &&
        !pull.draft &&
        pull.head.sha === payload.head.sha &&
        pull.base.sha === payload.base.sha,
      'pull-request-stale'
    )
    target = (
      await github.rest.repos.getCommit({
        ...repo,
        ref: `refs/pull/${pull.number}/merge`,
      })
    ).data
    requireProof(
      target.sha === context.sha &&
        target.parents?.length === 2 &&
        target.parents[0].sha === pull.base.sha &&
        target.parents[1].sha === pull.head.sha,
      'merge-context-changed'
    )
  }
  requireProof(
    pull.head?.repo?.full_name === REPOSITORY &&
      pull.base?.repo?.full_name === REPOSITORY &&
      SHA.test(target.commit?.tree?.sha ?? ''),
    'source-repository-or-tree-invalid'
  )
  const candidates = await sourceCandidates(
    github,
    repo,
    pull,
    Number(context.runId)
  )
  // Only a closed-event cancellation job can be passed over. Never search past
  // a failure, a partial run, or a reused placeholder for an older green result.
  let run, jobs
  for (const candidate of candidates) {
    const actual = (
      await github.rest.actions.getWorkflowRun({
        ...repo,
        run_id: candidate.id,
      })
    ).data
    requireProof(
      actual.id === candidate.id &&
        actual.workflow_id === candidate.workflow_id,
      'source-run-changed'
    )
    const actualJobs = await jobsFor(github, repo, actual)
    if (
      actualJobs.some((j) => j.name === 'cancel-closed-pr' && successful(j)) &&
      actualJobs.every(
        (j) => j.name === 'cancel-closed-pr' || j.conclusion === 'skipped'
      )
    )
      continue
    run = actual
    jobs = actualJobs
    break
  }
  requireProof(run, 'source-run-missing')
  if (Number.isSafeInteger(run.id)) onSource(run.id)
  validateRun(run, pull)
  requireProof(
    Number.isFinite(Date.parse(run.updated_at)) &&
      now - Date.parse(run.updated_at) >= 0 &&
      now - Date.parse(run.updated_at) <= 7 * 86400000,
    'source-run-expired'
  )
  const controls = run.referenced_workflows?.filter((w) => w.path === CONTROL)
  requireProof(
    controls?.length === 1 && SHA.test(controls[0].sha),
    'trusted-workflow-binding-missing'
  )
  const sourceControl = controls[0].sha
  const [oldTree, newTree] = await Promise.all([
    treeAt(github, repo, sourceControl),
    treeAt(github, repo, controlSha),
  ])
  const closure = fingerprint(newTree)
  requireProof(fingerprint(oldTree) === closure, 'control-closure-changed')
  const receipt = await readArtifact(
    github,
    repo,
    run,
    'ci-validation-receipt',
    'ci-validation-receipt.json',
    true
  )
  requireProof(
    receipt.schemaVersion === 2 &&
      receipt.repository === REPOSITORY &&
      receipt.event === 'pull_request' &&
      receipt.runId === run.id &&
      receipt.runAttempt === run.run_attempt &&
      receipt.headSha === pull.head.sha &&
      receipt.controlSha === sourceControl &&
      receipt.treeSha === target.commit.tree.sha &&
      SHA.test(receipt.testedSha ?? ''),
    'receipt-binding-invalid'
  )
  requireProof(
    runnerMatches(receipt, route, workers),
    'runner-or-environment-incompatible'
  )
  const tested = (
    await github.rest.repos.getCommit({ ...repo, ref: receipt.testedSha })
  ).data
  requireProof(
    tested.sha === receipt.testedSha &&
      tested.commit?.tree?.sha === receipt.treeSha &&
      tested.parents?.length === 2 &&
      tested.parents[0].sha === receipt.baseSha &&
      tested.parents[1].sha === pull.head.sha,
    'tested-merge-unproven'
  )
  requireProof(
    receipt.baseSha === (push ? target.parents[0].sha : pull.base.sha),
    'merge-base-changed'
  )
  if (push && target.parents.length === 2)
    requireProof(target.parents[1].sha === pull.head.sha, 'merge-head-changed')
  // PR-controlled caller modifications could fabricate job names/artifacts or
  // run additional jobs with the artifact token. Byte-identical trusted caller
  // is mandatory, independently of the receipt and named jobs.
  const [sourceCaller, trustedCaller, targetCaller] = await Promise.all([
    contentAt(github, repo, receipt.testedSha, CALLER),
    contentAt(github, repo, controlSha, CALLER),
    contentAt(github, repo, target.sha, CALLER),
  ])
  requireProof(
    sourceCaller === trustedCaller && targetCaller === trustedCaller,
    'caller-workflow-untrusted'
  )
  requireProof(
    coverageMatches('playwright', jobs, plan, route),
    'actual-full-coverage-missing'
  )
  const build = jobs.find((j) =>
    j.name.endsWith(`/ build-and-compile-${route}`)
  )
  requireProof(
    build?.steps?.some(
      (s) => s.name === 'Upload tested source receipt' && successful(s)
    ),
    'receipt-producer-missing'
  )
  const previous = await readArtifact(
    github,
    repo,
    run,
    'playwright-execution-plan',
    'playwright-execution-plan.json',
    true
  )
  requireProof(
    planMatches(previous, plan) &&
      previous.headSha === pull.head.sha &&
      previous.baseSha === receipt.baseSha,
    'full-plan-changed'
  )
  const fresh = (
    await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id })
  ).data
  validateRun(fresh, pull)
  requireProof(
    isDeepStrictEqual(runIdentity(run), runIdentity(fresh)),
    'source-attempt-changed'
  )
  const freshCandidates = await sourceCandidates(
    github,
    repo,
    pull,
    Number(context.runId)
  )
  requireProof(
    isDeepStrictEqual(
      candidates.map(runIdentity),
      freshCandidates.map(runIdentity)
    ),
    'source-runs-changed'
  )
  const freshPull = (
    await github.rest.pulls.get({ ...repo, pull_number: pull.number })
  ).data
  requireProof(
    freshPull.head.sha === pull.head.sha &&
      freshPull.base.sha === pull.base.sha &&
      freshPull.state === pull.state &&
      freshPull.merge_commit_sha === pull.merge_commit_sha,
    'pull-request-changed-during-proof'
  )
  if (push) {
    const tip = (
      await github.rest.repos.getCommit({ ...repo, ref: context.ref })
    ).data
    requireProof(tip.sha === context.sha, 'push-no-longer-current')
  } else {
    const merge = (
      await github.rest.repos.getCommit({
        ...repo,
        ref: `refs/pull/${pull.number}/merge`,
      })
    ).data
    requireProof(merge.sha === target.sha, 'merge-changed-during-proof')
  }
  return {
    schemaVersion: 2,
    id: run.id,
    attempt: run.run_attempt,
    url: `https://github.com/${REPOSITORY}/actions/runs/${run.id}/attempts/${run.run_attempt}`,
    treeSha: receipt.treeSha,
    testedSha: receipt.testedSha,
    controlFingerprint: closure,
    route,
  }
}
// Privileged consumers ignore the push reporter's duplicate ID. They select and
// verify the source themselves, using the controller revision and GitHub data.
async function verifyPromotionReuse({
  github,
  context,
  run,
  candidateSha,
  sourceBranch,
  controlSha,
  enabled,
  readArtifact = readArtifactJson,
}) {
  requireProof(enabled, 'promotion-reuse-disabled')
  requireProof(
    successful(run) &&
      run.event === 'push' &&
      run.head_sha === candidateSha &&
      run.head_branch === sourceBranch &&
      run.repository?.full_name === REPOSITORY &&
      run.head_repository?.full_name === REPOSITORY &&
      run.path?.split('@')[0] === CALLER,
    'push-run-provenance-invalid'
  )
  const controls = run.referenced_workflows?.filter((w) => w.path === CONTROL)
  requireProof(controls?.length === 1, 'push-control-binding-missing')
  const [actual, trusted] = await Promise.all([
    treeAt(github, context.repo, controls[0].sha),
    treeAt(github, context.repo, controlSha),
  ])
  requireProof(
    fingerprint(actual) === fingerprint(trusted),
    'push-control-closure-changed'
  )
  const [caller, policy] = await Promise.all([
    contentAt(github, context.repo, candidateSha, CALLER),
    contentAt(github, context.repo, controlSha, CALLER),
  ])
  requireProof(caller === policy, 'push-caller-untrusted')
  const plan = await readArtifact(
    github,
    context.repo,
    run,
    'playwright-execution-plan',
    'playwright-execution-plan.json',
    true
  )
  requireProof(
    plan.headSha === candidateSha && plan.baseSha === candidateSha,
    'push-plan-binding-invalid'
  )
  const proof = await findVerifiedRun({
    github,
    context: {
      ...context,
      eventName: 'push',
      sha: candidateSha,
      ref: `refs/heads/${sourceBranch}`,
      runId: run.id,
    },
    controlSha,
    plan,
    route: 'hosted',
    workers: '1',
    enabled,
    readArtifact,
  })
  const fresh = (
    await github.rest.actions.getWorkflowRun({
      ...context.repo,
      run_id: run.id,
    })
  ).data
  requireProof(
    successful(fresh) &&
      isDeepStrictEqual(runIdentity(fresh), runIdentity(run)),
    'push-attempt-changed'
  )
  return proof
}
async function reportVerifiedRun(options) {
  try {
    const proof = await findVerifiedRun({
      ...options,
      onSource: (id) =>
        options.core.info(
          `CI reuse candidate: https://github.com/${REPOSITORY}/actions/runs/${id}`
        ),
    })
    options.core.setOutput('duplicate_run_id', String(proof.id))
    options.core.info(`CI reuse hit: ${proof.url}`)
    await options.core.summary
      .addRaw(
        `Verified full Playwright coverage: [run ${proof.id}, attempt ${proof.attempt}](${proof.url}).\n`
      )
      .write()
    return proof
  } catch (error) {
    options.core.setOutput('duplicate_run_id', '')
    // No credentials, arbitrary API bodies or artifact content in diagnostics.
    const reason = /^[a-z0-9-]+$/.test(error.message)
      ? error.message
      : 'evidence-unavailable'
    options.core.info(`CI reuse miss: ${reason}; executing validation.`)
    return null
  }
}
module.exports = {
  fingerprint,
  runnerMatches,
  findVerifiedRun,
  reportVerifiedRun,
  verifyPromotionReuse,
  CONTROL_SPARSE_PATHS,
}
