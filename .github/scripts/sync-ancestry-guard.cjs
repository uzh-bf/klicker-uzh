const { execFileSync } = require('node:child_process')
const { PAIRS } = require('./draft-sync-prs.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
// Integration branch -> the branch whose history it must keep as ancestry.
const SOURCES = Object.fromEntries(PAIRS.map(({ head, base }) => [base, head]))
// Sync target -> the branch it feeds, which must never flow back into it,
// pinned to that downstream branch's oldest own first-parent commit. Every later
// downstream commit descends from the root, so any back-merge carries it, even
// after an earlier bypass already contaminated the target. v3 has no entry:
// ADR 0007 plans to fold v3-ai back into v3, and this guard does not run there.
const DOWNSTREAM_ROOTS = {
  'v3-ai': {
    downstream: 'v3-audit',
    root: 'f9c8fa7c72f201bec66e99c0b886b1f6a9e87ef1',
  },
}
const STATUS_CONTEXT = 'sync-ancestry'

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  }).trim()
}

function isAncestor(cwd, ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      stdio: 'ignore',
    })
    return true
  } catch (error) {
    if (error.status === 1) return false
    throw error
  }
}

// True when merging `head` onto `parent` brings source-branch commits that
// `parent` lacks, i.e. the change is a sync rather than an ordinary feature.
function bringsSourceCommits(cwd, { parent, head, sourceSha }) {
  let mergeBase
  try {
    mergeBase = git(cwd, ['merge-base', head, sourceSha])
  } catch {
    return false
  }
  return !isAncestor(cwd, mergeBase, parent)
}

// Reports whether `head` contains downstream history, for example after
// "Update branch" on a pull request whose head was the upstream branch.
// `existing` means `parent` already contained it, so the target needs recovery
// rather than a rejected change. A pin that left the downstream branch's
// first-parent line fails closed instead of passing every change.
function findBackflow(cwd, { parent, head, downstreamSha, root }) {
  const line = git(cwd, ['rev-list', '--first-parent', downstreamSha])
  if (!line.split('\n').includes(root)) {
    throw new Error(
      `Pinned root ${root} is not on the downstream first-parent line; update DOWNSTREAM_ROOTS.`
    )
  }
  if (!isAncestor(cwd, root, head)) return null
  return { existing: Boolean(parent) && isAncestor(cwd, root, parent) }
}

function hasCommit(cwd, sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
      cwd,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

// A squash merge records a sync as a single-parent commit, so the source
// commits it carried never become ancestors of the integration branch and
// every later sync re-conflicts on them. A later merge-commit sync restores
// that ancestry, so the walk stops at the most recent one. Merging the newest
// squashed sync's head also covers older ones, so only that one is returned.
async function findUnrepairedSquashedSync({
  cwd,
  baseSha,
  sourceSha,
  resolvePullRequest,
  limit = 200,
}) {
  const history = git(cwd, [
    'rev-list',
    '--first-parent',
    '--parents',
    `--max-count=${limit}`,
    baseSha,
  ])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(' '))

  for (const [commit, parent, merged] of history) {
    if (!parent) break
    if (merged) {
      if (bringsSourceCommits(cwd, { parent, head: merged, sourceSha })) break
      continue
    }
    const pr = await resolvePullRequest(commit)
    if (!pr) continue
    if (!bringsSourceCommits(cwd, { parent, head: pr.headSha, sourceSha })) {
      continue
    }
    if (isAncestor(cwd, pr.headSha, baseSha)) continue
    return { commit, number: pr.number, headSha: pr.headSha }
  }
  return null
}

function repairBranch(number) {
  return `chore/restore-ancestry-pr-${number}`
}

async function ensureRepairPullRequest({ github, repo, base, finding }) {
  const branch = repairBranch(finding.number)
  try {
    await github.rest.git.createRef({
      ...repo,
      ref: `refs/heads/${branch}`,
      sha: finding.headSha,
    })
  } catch (error) {
    if (error.status !== 422) throw error
  }

  const open = await github.paginate(github.rest.pulls.list, {
    ...repo,
    state: 'open',
    head: `${repo.owner}:${branch}`,
    base,
    per_page: 100,
  })
  let number = open[0]?.number
  if (!number) {
    const { data: pr } = await github.rest.pulls.create({
      ...repo,
      head: branch,
      base,
      title: `chore(sync): restore ancestry lost in the #${finding.number} squash`,
      body: [
        `#${finding.number} was a sync into \`${base}\` and was squash-merged, so its source commits never became ancestors of \`${base}\` and later syncs re-conflict on them.`,
        '',
        `This pull request's head is #${finding.number}'s original head (\`${finding.headSha.slice(0, 10)}\`). Its changes are already on \`${base}\`, so GitHub's file list repeats them while the merge itself restores ancestry.`,
        '',
        '**Merge with "Create a merge commit". Do not squash.** The `sync-ancestry` check blocks further merges into this branch until this is merged.',
      ].join('\n'),
    })
    number = pr.number
  }

  // Token-created pull requests start no workflows, so the required context is
  // recorded on the repair head directly.
  await github.rest.repos.createCommitStatus({
    ...repo,
    sha: finding.headSha,
    state: 'success',
    context: STATUS_CONTEXT,
    description: `Restores ancestry lost in #${finding.number}`,
  })
  return number
}

async function guardSyncAncestry({ github, context, core, cwd }) {
  if (`${context.repo.owner}/${context.repo.repo}` !== REPOSITORY) return
  const repo = context.repo
  const pullRequest = context.payload.pull_request
  const base = pullRequest
    ? pullRequest.base.ref
    : context.ref.replace('refs/heads/', '')
  const source = SOURCES[base]
  if (!source) return

  const baseSha = pullRequest
    ? git(cwd, ['rev-parse', `origin/${base}`])
    : context.sha
  const sourceSha = git(cwd, ['rev-parse', `origin/${source}`])

  const edge = DOWNSTREAM_ROOTS[base]
  const downstream = edge?.downstream
  const before = pullRequest ? baseSha : context.payload.before
  const head = pullRequest ? pullRequest.head.sha : baseSha
  // A branch creation or a force push may leave no comparable parent.
  const backflow = edge
    ? findBackflow(cwd, {
        parent: before && hasCommit(cwd, before) ? before : null,
        head,
        downstreamSha: git(cwd, ['rev-parse', `origin/${downstream}`]),
        root: edge.root,
      })
    : null
  const leakMessage = !backflow
    ? null
    : backflow.existing
      ? `${base} already contains ${downstream} history (root ${edge.root.slice(0, 10)}). Nothing can merge into ${base} until it is recovered; see "Sync direction guard" in docs/ci-and-deployment.md.`
      : `This change merges ${downstream} history (root ${edge.root.slice(0, 10)}) back into ${base}. Changes move ${source} -> ${base} -> ${downstream} only.`

  const finding = await findUnrepairedSquashedSync({
    cwd,
    baseSha,
    sourceSha,
    async resolvePullRequest(commit) {
      const { data: prs } =
        await github.rest.repos.listPullRequestsAssociatedWithCommit({
          ...repo,
          commit_sha: commit,
        })
      const pr = prs.find(
        (candidate) =>
          candidate.merged_at &&
          candidate.base.ref === base &&
          candidate.merge_commit_sha === commit
      )
      if (!pr) return null
      git(cwd, [
        'fetch',
        '--no-tags',
        '--filter=blob:none',
        'origin',
        `+refs/pull/${pr.number}/head:refs/sync-ancestry/pr-${pr.number}`,
      ])
      return { number: pr.number, headSha: pr.head.sha }
    },
  })

  if (pullRequest) {
    if (leakMessage) {
      core.setFailed(leakMessage)
      return
    }
    // Merging any sync with a merge commit, including a repair pull request,
    // restores the ancestry, so syncs stay mergeable while the branch is blocked.
    const isSync = bringsSourceCommits(cwd, {
      parent: baseSha,
      head: pullRequest.head.sha,
      sourceSha,
    })
    if (isSync) {
      core.warning(
        `This pull request syncs ${source} into ${base}. Merge it with "Create a merge commit"; a squash loses the ancestry and blocks ${base}.`
      )
    } else if (finding) {
      core.setFailed(
        `${base} lost sync ancestry in the #${finding.number} squash. Merge the open chore(sync) restore pull request with a merge commit first.`
      )
    }
    return
  }

  let repair
  if (finding) {
    repair = await ensureRepairPullRequest({ github, repo, base, finding })
  }
  await github.rest.repos.createCommitStatus({
    ...repo,
    sha: baseSha,
    state: finding || leakMessage ? 'failure' : 'success',
    context: STATUS_CONTEXT,
    description: leakMessage
      ? `${downstream} history flowed back into ${base}`
      : finding
        ? `Squashed sync #${finding.number}; merge #${repair} with a merge commit`
        : `${source} ancestry intact`,
  })
  if (leakMessage) core.setFailed(leakMessage)
  if (finding) {
    core.setFailed(
      `#${finding.number} squash-merged a sync into ${base}; merge repair #${repair} with a merge commit.`
    )
  }
}

module.exports = {
  DOWNSTREAM_ROOTS,
  SOURCES,
  bringsSourceCommits,
  findBackflow,
  findUnrepairedSquashedSync,
  guardSyncAncestry,
}
