const REPOSITORY = 'uzh-bf/klicker-uzh'
const PAIRS = [
  { head: 'v3', base: 'v3-ai' },
  { head: 'v3-ai', base: 'v3-audit' },
]

// Sync pull requests never use the long-lived source branch as their head.
// GitHub's "Update branch" and conflict edits write to the pull request head,
// so a source-branch head would let them merge the target back into the source.
function syncBranch({ head, base }) {
  return `sync/${head}-into-${base}`
}

function acceptsEvent(context) {
  if (`${context.repo.owner}/${context.repo.repo}` !== REPOSITORY) return false
  if (context.ref !== 'refs/heads/v3') return false
  if (context.eventName === 'workflow_dispatch') return true
  const run = context.payload.workflow_run
  return (
    context.eventName === 'workflow_run' &&
    context.payload.action === 'completed' &&
    run?.event === 'push' &&
    run.name === 'Check codebase' &&
    run.head_repository?.full_name === REPOSITORY &&
    PAIRS.some(({ head }) => head === run.head_branch)
  )
}

async function findOpenPr({ github, repo, head, base }) {
  const prs = await github.paginate(github.rest.pulls.list, {
    ...repo,
    state: 'open',
    head: `${repo.owner}:${head}`,
    base,
    per_page: 100,
  })
  return prs.find(
    (pr) =>
      pr.head.ref === head &&
      pr.base.ref === base &&
      pr.head.repo?.full_name === REPOSITORY &&
      pr.base.repo?.full_name === REPOSITORY
  )
}

// Moves an open sync pull request's head to the current source tip. A head
// that maintainers changed (conflict resolution, "Update branch") is never
// reset; the source is merged into it instead, and a conflict is left to them.
async function advanceSyncBranch({ github, repo, branch, pr, sourceSha }) {
  const syncSha = pr.head.sha
  if (syncSha === sourceSha) return 'existing'
  const { data: comparison } =
    await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${syncSha}...${sourceSha}`,
      per_page: 1,
    })
  if (comparison.status === 'identical' || comparison.status === 'behind') {
    return 'existing'
  }
  if (comparison.status === 'ahead') {
    await github.rest.git.updateRef({
      ...repo,
      ref: `heads/${branch}`,
      sha: sourceSha,
      force: false,
    })
    return 'advanced'
  }
  try {
    await github.rest.repos.merge({
      ...repo,
      base: branch,
      head: sourceSha,
      commit_message: `chore(sync): merge ${sourceSha.slice(0, 10)} into ${branch}`,
    })
    return 'merged-source'
  } catch (error) {
    if (error.status === 409) return 'conflict'
    throw error
  }
}

// Points the bot-owned sync branch at the source tip. Only called when no open
// pull request uses the branch, so any leftover commits on it are discarded.
async function resetSyncBranch({ github, repo, branch, sourceSha }) {
  try {
    await github.rest.git.createRef({
      ...repo,
      ref: `refs/heads/${branch}`,
      sha: sourceSha,
    })
  } catch (error) {
    if (error.status !== 422) throw error
    await github.rest.git.updateRef({
      ...repo,
      ref: `heads/${branch}`,
      sha: sourceSha,
      force: true,
    })
  }
}

async function maintainDraftSyncPrs({ github, context, dryRun = true }) {
  if (!acceptsEvent(context)) return []
  const repo = context.repo
  const results = []

  for (const pair of PAIRS) {
    const { head, base } = pair
    const branch = syncBranch(pair)
    const report = (action, number) =>
      results.push({ head, base, branch, action, ...(number && { number }) })

    // A pull request opened before sync branches existed still has the source
    // branch as its head. Leave it alone; closing it lets the next run migrate.
    const legacy = await findOpenPr({ github, repo, head, base })
    if (legacy) {
      report('legacy', legacy.number)
      continue
    }

    // Read current branches rather than replaying the triggering run's old SHA.
    const { data: source } = await github.rest.repos.getBranch({
      ...repo,
      branch: head,
    })
    const sourceSha = source.commit.sha

    const existing = await findOpenPr({ github, repo, head: branch, base })
    if (existing) {
      if (dryRun) {
        report(
          existing.head.sha === sourceSha ? 'existing' : 'would-advance',
          existing.number
        )
        continue
      }
      const action = await advanceSyncBranch({
        github,
        repo,
        branch,
        pr: existing,
        sourceSha,
      })
      report(action, existing.number)
      continue
    }

    const { data: comparison } =
      await github.rest.repos.compareCommitsWithBasehead({
        ...repo,
        basehead: `${base}...${sourceSha}`,
        per_page: 1,
      })
    if (comparison.ahead_by === 0 || comparison.files?.length === 0) {
      report('up-to-date')
      continue
    }
    if (dryRun) {
      report('would-create')
      continue
    }

    await resetSyncBranch({ github, repo, branch, sourceSha })
    try {
      const { data: pr } = await github.rest.pulls.create({
        ...repo,
        head: branch,
        base,
        draft: true,
        title: `chore(sync): merge ${head} into ${base}`,
        body: [
          `Integrate \`${head}\` into \`${base}\`. The head \`${branch}\` is a bot-owned copy of \`${head}\` that follows it automatically.`,
          '',
          'Mark ready when the accumulated changes should be reviewed and validated for integration. Use a merge commit to preserve branch ancestry.',
          '',
          `Resolve conflicts on \`${branch}\` itself, or use "Update branch"; neither touches \`${head}\`. Later \`${head}\` pushes are merged into your resolution rather than replacing it.`,
          '',
          'Creation is automated; readiness and merging remain manual.',
        ].join('\n'),
      })
      report('created', pr.number)
    } catch (error) {
      if (error.status !== 422) throw error
      // A maintainer or another caller may have created the same PR meanwhile.
      const concurrent = await findOpenPr({ github, repo, head: branch, base })
      if (!concurrent) throw error
      report('existing', concurrent.number)
    }
  }
  return results
}

module.exports = { PAIRS, acceptsEvent, maintainDraftSyncPrs, syncBranch }
