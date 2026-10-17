const { createChangelog } = require('./sync-pr-changelog.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const PAIRS = [
  { head: 'v3', base: 'v3-ai' },
  { head: 'v3-ai', base: 'v3-audit' },
  { head: 'v3-ai', base: 'v3-adaptive-learning' },
]

// Sync pull requests never use the long-lived source branch as their head.
// GitHub's "Update branch" and conflict edits write to the pull request head,
// so a source-branch head would let them merge the target back into the source.
// Each new pull request gets a fresh branch named after its starting source
// SHA, so the controller never has to reset a branch that someone else used.
function syncBranchPrefix({ head, base }) {
  return `sync/${head}-into-${base}-`
}

function syncBranch(pair, sourceSha) {
  return `${syncBranchPrefix(pair)}${sourceSha.slice(0, 10)}`
}

// Whether a branch name is a controller-owned sync branch of a maintained pair.
function isSyncBranch(ref) {
  return (
    typeof ref === 'string' &&
    PAIRS.some((pair) =>
      new RegExp(`^${syncBranchPrefix(pair)}[0-9a-f]{10}$`).test(ref)
    )
  )
}

function acceptsEvent(context) {
  if (`${context.repo.owner}/${context.repo.repo}` !== REPOSITORY) return false
  if (context.ref !== 'refs/heads/v3') return false
  if (context.eventName === 'workflow_dispatch') return true
  const run = context.payload.workflow_run
  return Boolean(
    context.eventName === 'workflow_run' &&
      context.payload.action === 'completed' &&
      run &&
      run.name === 'Check codebase' &&
      run.head_repository?.full_name === REPOSITORY &&
      ((run.event === 'push' &&
        PAIRS.some(({ head, base }) =>
          [head, base].includes(run.head_branch)
        )) ||
        (run.event === 'pull_request' && isSyncBranch(run.head_branch)))
  )
}

async function findOpenPr({ github, repo, base, matches }) {
  const prs = await github.paginate(github.rest.pulls.list, {
    ...repo,
    state: 'open',
    base,
    per_page: 100,
  })
  return prs.find(
    (pr) =>
      matches(pr.head.ref) &&
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

// Creates the fresh sync branch for a new pull request. An existing branch of
// that name is reused only when it still points at the source tip; anything
// else is someone's work and is never overwritten.
async function createSyncBranch({ github, repo, branch, sourceSha }) {
  try {
    await github.rest.git.createRef({
      ...repo,
      ref: `refs/heads/${branch}`,
      sha: sourceSha,
    })
    return true
  } catch (error) {
    // 422 also covers refusals such as missing workflow-file permission.
    if (error.status !== 422 || !/already exists/i.test(error.message)) {
      throw error
    }
    const { data: ref } = await github.rest.git.getRef({
      ...repo,
      ref: `heads/${branch}`,
    })
    return ref.object.sha === sourceSha
  }
}

const CONFLICT_MARKER = '<!-- sync-pr-source-conflict -->'

// Keeps one bot comment on a sync pull request while the source cannot be
// merged into its head, because the PR stays mergeable into its target while
// lacking that source commit. The comment is removed once the merge succeeds.
async function updateConflictNotice({
  github,
  repo,
  pr,
  head,
  sourceSha,
  conflict,
}) {
  const { data: bot } = await github.rest.users.getAuthenticated()
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...repo,
    issue_number: pr.number,
    per_page: 100,
  })
  const notice = comments.find(
    (comment) =>
      comment.user?.login === bot.login &&
      comment.body?.startsWith(CONFLICT_MARKER)
  )
  if (!conflict) {
    if (notice) {
      await github.rest.issues.deleteComment({ ...repo, comment_id: notice.id })
    }
    return
  }
  const branch = pr.head.ref
  const body = [
    CONFLICT_MARKER,
    `\`${head}\` at \`${sourceSha.slice(0, 10)}\` conflicts with \`${branch}\`, so this pull request does not contain it yet. Merge \`${sourceSha}\` into \`${branch}\` and resolve the conflicts there; automatic updates resume afterwards.`,
  ].join('\n')
  if (notice?.body === body) return
  if (notice) {
    await github.rest.issues.updateComment({
      ...repo,
      comment_id: notice.id,
      body,
    })
  } else {
    await github.rest.issues.createComment({
      ...repo,
      issue_number: pr.number,
      body,
    })
  }
}

function matchesSyncPr(pr, pair, branch) {
  return (
    pr.state === 'open' &&
    pr.head.ref === branch &&
    branch.startsWith(syncBranchPrefix(pair)) &&
    pr.base.ref === pair.base &&
    pr.head.repo?.full_name === REPOSITORY &&
    pr.base.repo?.full_name === REPOSITORY
  )
}

async function maintainDraftSyncPrs({
  github,
  context,
  dryRun = true,
  historyToken,
  changelogFactory = createChangelog,
}) {
  if (!acceptsEvent(context)) return []
  const repo = context.repo
  const results = []
  let changelog

  const branchSha = async (branch) => {
    const { data } = await github.rest.repos.getBranch({ ...repo, branch })
    return data.commit.sha
  }
  const describe = async (snapshots) => {
    try {
      changelog ??= changelogFactory({
        repository: REPOSITORY,
        token: historyToken,
      })
      const { body } = await changelog.generate(snapshots)
      if (typeof body !== 'string' || !body) throw new Error('empty changelog')
      return { body }
    } catch {
      // Git diagnostics can include credential-bearing transport details.
      return { description: 'error' }
    }
  }
  const describeExisting = async (pr, pair, sourceSha) => {
    const branch = pr.head.ref
    const readPr = async () =>
      (await github.rest.pulls.get({ ...repo, pull_number: pr.number })).data
    const current = await readPr()
    if (!matchesSyncPr(current, pair, branch)) {
      return { description: 'deferred' }
    }
    const headSha = current.head.sha
    const targetSha = await branchSha(pair.base)
    if (current.base.sha !== targetSha) return { description: 'deferred' }
    const generated = await describe({ sourceSha, targetSha, headSha })
    if (!generated.body) return generated
    if (dryRun) return { ...generated, description: 'preview' }

    const latest = await readPr()
    if (
      !matchesSyncPr(latest, pair, branch) ||
      latest.head.sha !== headSha ||
      latest.base.sha !== targetSha ||
      (await branchSha(branch)) !== headSha ||
      (await branchSha(pair.base)) !== targetSha
    ) {
      return { description: 'deferred' }
    }
    if (latest.body === generated.body) return { description: 'unchanged' }
    await github.rest.pulls.update({
      ...repo,
      pull_number: pr.number,
      body: generated.body,
    })
    return { description: 'updated' }
  }

  try {
    for (const pair of PAIRS) {
      const { head, base } = pair
      const prefix = syncBranchPrefix(pair)
      const report = (action, number, branch, description) =>
        results.push({
          head,
          base,
          branch: branch ?? prefix,
          action,
          ...(number && { number }),
          ...description,
        })

      // A pull request opened before sync branches existed still has the source
      // branch as its head. Leave it alone; closing it lets the next run migrate.
      const legacy = await findOpenPr({
        github,
        repo,
        base,
        matches: (ref) => ref === head,
      })
      if (legacy) {
        report('legacy', legacy.number, head)
        continue
      }

      // Read current branches rather than replaying the triggering run's old SHA.
      const sourceSha = await branchSha(head)

      const existing = await findOpenPr({
        github,
        repo,
        base,
        matches: (ref) => ref.startsWith(prefix),
      })
      if (existing) {
        const branch = existing.head.ref
        if (dryRun) {
          report(
            existing.head.sha === sourceSha ? 'existing' : 'would-advance',
            existing.number,
            branch,
            await describeExisting(existing, pair, sourceSha)
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
        await updateConflictNotice({
          github,
          repo,
          pr: existing,
          head,
          sourceSha,
          conflict: action === 'conflict',
        })
        report(
          action,
          existing.number,
          branch,
          await describeExisting(existing, pair, sourceSha)
        )
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
      const targetSha = await branchSha(base)
      const generated = await describe({
        sourceSha,
        targetSha,
        headSha: sourceSha,
      })
      if (!generated.body) {
        report('description-error', undefined, undefined, generated)
        continue
      }
      if (dryRun) {
        report('would-create', undefined, undefined, {
          ...generated,
          description: 'preview',
        })
        continue
      }

      const branch = syncBranch(pair, sourceSha)
      if (!(await createSyncBranch({ github, repo, branch, sourceSha }))) {
        report('stale-branch', undefined, branch)
        continue
      }
      if (
        (await branchSha(branch)) !== sourceSha ||
        (await branchSha(base)) !== targetSha
      ) {
        report('stale-description', undefined, branch, {
          description: 'deferred',
        })
        continue
      }
      try {
        const { data: pr } = await github.rest.pulls.create({
          ...repo,
          head: branch,
          base,
          draft: true,
          title: `chore(sync): merge ${head} into ${base}`,
          body: generated.body,
        })
        report('created', pr.number, branch)
      } catch (error) {
        if (error.status !== 422) throw error
        // A maintainer or another caller may have created the same PR meanwhile.
        const concurrent = await findOpenPr({
          github,
          repo,
          base,
          matches: (ref) => ref.startsWith(prefix),
        })
        if (!concurrent) throw error
        report(
          'existing',
          concurrent.number,
          concurrent.head.ref,
          await describeExisting(concurrent, pair, sourceSha)
        )
      }
    }
  } finally {
    await changelog?.close()
  }
  return results
}

module.exports = {
  PAIRS,
  acceptsEvent,
  isSyncBranch,
  maintainDraftSyncPrs,
  syncBranch,
  syncBranchPrefix,
}
