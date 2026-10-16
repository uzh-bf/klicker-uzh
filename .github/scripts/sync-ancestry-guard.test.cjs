const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')
const {
  DOWNSTREAM_ROOTS,
  SOURCES,
  findBackflow,
  findUnrepairedSquashedSync,
} = require('./sync-ancestry-guard.cjs')

function repository() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-ancestry-'))
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  }
  const git = (...args) =>
    execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
  git('init', '-q', '-b', 'v3')
  const commit = (file, message = file) => {
    fs.writeFileSync(path.join(cwd, file), message)
    git('add', file)
    git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  // Squash-merges the named branch onto the current branch; returns the
  // single-parent commit and the pull request head that it replaced.
  const squash = (branch) => {
    const headSha = git('rev-parse', branch)
    git('merge', '-q', '--squash', branch)
    git('commit', '-q', '-m', `squash ${branch}`)
    return { commit: git('rev-parse', 'HEAD'), headSha }
  }
  commit('root')
  git('switch', '-q', '-c', 'v3-ai')
  commit('ai')
  return { cwd, git, commit, squash }
}

function detect({ cwd, git }, pullRequests) {
  return findUnrepairedSquashedSync({
    cwd,
    baseSha: git('rev-parse', 'v3-ai'),
    sourceSha: git('rev-parse', 'v3'),
    resolvePullRequest: async (commit) => pullRequests.get(commit) ?? null,
  })
}

test('flags a squashed sync until its original head is merged', async () => {
  const repo = repository()
  const { git, commit, squash } = repo
  git('switch', '-q', 'v3')
  commit('v3-feature')
  git('switch', '-q', '-c', 'sync', 'v3-ai')
  git('merge', '-q', '--no-edit', 'v3')
  git('switch', '-q', 'v3-ai')
  const squashed = squash('sync')
  const pullRequests = new Map([
    [squashed.commit, { number: 7, headSha: squashed.headSha }],
  ])

  assert.deepEqual(await detect(repo, pullRequests), {
    commit: squashed.commit,
    number: 7,
    headSha: squashed.headSha,
  })

  git('merge', '-q', '--no-edit', squashed.headSha)
  assert.equal(await detect(repo, pullRequests), null)
})

test('ignores squashed feature pull requests and merge-commit syncs', async () => {
  const repo = repository()
  const { git, commit, squash } = repo
  git('switch', '-q', 'v3')
  commit('v3-feature')
  git('switch', '-q', 'v3-ai')
  git('merge', '-q', '--no-edit', 'v3')
  git('switch', '-q', '-c', 'feature')
  commit('feature')
  git('switch', '-q', 'v3-ai')
  const feature = squash('feature')

  const pullRequests = new Map([
    [feature.commit, { number: 8, headSha: feature.headSha }],
  ])
  assert.equal(await detect(repo, pullRequests), null)
})

test('flags downstream history in its upstream branch until recovery', () => {
  const { cwd, git, commit } = repository()
  git('switch', '-q', '-c', 'v3-audit')
  const root = commit('audit-only')
  git('switch', '-q', 'v3-ai')
  commit('ai-next')
  git('switch', '-q', '-c', 'feature')
  commit('feature')
  git('switch', '-q', 'v3-audit')
  git('merge', '-q', '--no-edit', 'v3-ai')
  const check = (parent, head) =>
    findBackflow(cwd, {
      parent,
      head,
      downstreamSha: git('rev-parse', 'v3-audit'),
      root,
    })
  const clean = git('rev-parse', 'v3-ai')

  // Forward work and the downstream's own sync merges are not backflow.
  assert.equal(check(clean, git('rev-parse', 'feature')), null)

  // "Update branch" on a v3-ai -> v3-audit PR whose head is v3-ai itself.
  git('switch', '-q', 'v3-ai')
  git('merge', '-q', '--no-ff', '--no-edit', 'v3-audit')
  const contaminated = git('rev-parse', 'v3-ai')
  assert.deepEqual(check(clean, contaminated), { existing: false })

  // An ordinary follow-up on the contaminated branch stays blocked, both as a
  // pull request and as the push that lands it.
  git('switch', '-q', '-c', 'follow-up')
  const followUp = commit('follow-up')
  assert.deepEqual(check(contaminated, followUp), { existing: true })
  git('switch', '-q', 'v3-ai')
  git('merge', '-q', '--no-ff', '--no-edit', 'follow-up')
  assert.deepEqual(check(contaminated, git('rev-parse', 'v3-ai')), {
    existing: true,
  })

  // A pin that is not on the downstream line fails closed.
  assert.throws(() =>
    findBackflow(cwd, {
      parent: clean,
      head: clean,
      downstreamSha: git('rev-parse', 'v3-audit'),
      root: followUp,
    })
  )
})

test('pins backflow roots only for chain edges into guarded targets', () => {
  for (const [base, { downstreams, root }] of Object.entries(
    DOWNSTREAM_ROOTS
  )) {
    assert.ok(SOURCES[base])
    // Every target fed by this branch is protected against flowing back.
    const fed = Object.keys(SOURCES).filter(
      (target) => SOURCES[target] === base
    )
    assert.deepEqual([...downstreams].sort(), fed.sort())
    assert.match(root, /^[0-9a-f]{40}$/)
  }
  assert.deepEqual(Object.keys(DOWNSTREAM_ROOTS), ['v3-ai'])
})

test('guards exactly the target branches of the sync chain', () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/sync-ancestry-guard.yml'),
      'utf8'
    )
  )
  const targets = Object.keys(SOURCES).sort()
  assert.deepEqual([...workflow.on.push.branches].sort(), targets)
  assert.deepEqual([...workflow.on.pull_request.branches].sort(), targets)
})
