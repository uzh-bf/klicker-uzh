import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const guardPath = fileURLToPath(
  new URL('./check-git-identity.sh', import.meta.url)
)
const gitEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
)
const fixtureName = 'CI fixture'
const fixtureEmail = 'ci@example.invalid'

function git(root, ...args) {
  return childProcess
    .execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      env: gitEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    .trim()
}

function createRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-identity-guard-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 'Developer')
  git(root, 'config', 'user.email', 'developer@example.com')
  return root
}

function createRepositoryWithRemote(t) {
  const origin = fs.mkdtempSync(
    path.join(os.tmpdir(), 'git-identity-guard-origin-')
  )
  const root = createRepository(t)
  t.after(() => fs.rmSync(origin, { recursive: true, force: true }))
  git(origin, 'init', '-q', '--bare', '-b', 'main')
  git(root, 'remote', 'add', 'origin', origin)
  return root
}

function commit(root, name, email, ...paragraphs) {
  return commitWithIdentities(root, name, email, name, email, ...paragraphs)
}

function commitWithIdentities(
  root,
  authorName,
  authorEmail,
  committerName,
  committerEmail,
  ...paragraphs
) {
  const messageArguments = paragraphs.flatMap((paragraph) => ['-m', paragraph])
  childProcess.execFileSync(
    'git',
    [
      '-C',
      root,
      '-c',
      `user.name=${committerName}`,
      '-c',
      `user.email=${committerEmail}`,
      'commit',
      '--allow-empty',
      ...messageArguments,
    ],
    {
      env: {
        ...gitEnvironment,
        GIT_AUTHOR_NAME: authorName,
        GIT_AUTHOR_EMAIL: authorEmail,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  return git(root, 'rev-parse', 'HEAD')
}

function runGuard(root, mode, ...args) {
  return childProcess.spawnSync('bash', [guardPath, mode, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment,
  })
}

function assertRejected(result) {
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Git identity guard failed:/)
}

test('current mode rejects the fixture repository identity', (t) => {
  const root = createRepository(t)
  assert.equal(runGuard(root, 'current').status, 0)

  git(root, 'config', 'user.email', fixtureEmail)
  assertRejected(runGuard(root, 'current'))
})

test('range mode tolerates published fixture commits via --published refs', (t) => {
  const root = createRepository(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  // A fixture-identity commit that is already part of a published
  // integration branch cannot be rewritten, so --published excludes it.
  const published = commit(root, fixtureName, fixtureEmail, 'published fixture')
  git(root, 'update-ref', 'refs/remotes/origin/v3-ai', published)
  const clean = commit(root, 'Developer', 'developer@example.com', 'clean')

  const tolerated = runGuard(
    root,
    'range',
    `${base}..${clean}`,
    '--published',
    'origin/v3-ai'
  )
  assert.equal(tolerated.status, 0)

  // Without the published exclusion the same range still rejects.
  assertRejected(runGuard(root, 'range', `${base}..${clean}`))

  // A brand-new fixture commit outside every published ref stays rejected.
  const fresh = commit(root, fixtureName, fixtureEmail, 'fresh fixture')
  assertRejected(
    runGuard(root, 'range', `${clean}..${fresh}`, '--published', 'origin/v3-ai')
  )

  // Unresolvable published refs are skipped instead of failing the scan.
  const withUnknownRef = runGuard(
    root,
    'range',
    `${clean}..${fresh}`,
    '--published',
    'origin/does-not-exist',
    'origin/v3-ai'
  )
  assertRejected(withUnknownRef)
})

test('range mode expands --published-glob across v3-prefixed branches', (t) => {
  const root = createRepository(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  // Two published integration branches carry fixture commits; a
  // non-v3-prefixed branch deliberately does not participate in the
  // exclusion, so its fixture commits stay rejected.
  const publishedA = commit(root, fixtureName, fixtureEmail, 'fixture on v3-ai')
  const publishedB = commit(
    root,
    fixtureName,
    fixtureEmail,
    'fixture on v3-audit'
  )
  git(root, 'update-ref', 'refs/remotes/origin/v3-ai', publishedA)
  git(root, 'update-ref', 'refs/remotes/origin/v3-audit', publishedB)
  const clean = commit(root, 'Developer', 'developer@example.com', 'clean')

  // The published range tolerates everything reachable from any v3* ref.
  const tolerated = runGuard(
    root,
    'range',
    `${base}..${clean}`,
    '--published-glob',
    'refs/remotes/origin/v3*'
  )
  assert.equal(tolerated.status, 0)

  // Without the published exclusion the same range still rejects.
  assertRejected(runGuard(root, 'range', `${base}..${clean}`))

  // A fixture commit published only on a non-v3 branch stays rejected even
  // though it is part of the scanned history.
  const unpublished = commit(
    root,
    fixtureName,
    fixtureEmail,
    'fixture on feature branch'
  )
  git(root, 'update-ref', 'refs/remotes/origin/feature-fixture', unpublished)
  assertRejected(
    runGuard(
      root,
      'range',
      `${base}..${unpublished}`,
      '--published-glob',
      'refs/remotes/origin/v3*'
    )
  )
})

test('range mode rejects fixture authors, committers, and co-author trailers', (t) => {
  const root = createRepository(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  const normal = commit(root, 'Developer', 'developer@example.com', 'normal')
  assert.equal(runGuard(root, 'range', `${base}..${normal}`).status, 0)

  const fixture = commit(root, fixtureName, fixtureEmail, 'fixture author')
  assertRejected(runGuard(root, 'range', `${normal}..${fixture}`))

  const trailer = commit(
    root,
    'Developer',
    'developer@example.com',
    'fixture trailer',
    `Co-authored-by: ${fixtureName} <${fixtureEmail}>`
  )
  assertRejected(runGuard(root, 'range', `${fixture}..${trailer}`))

  const fixtureCommitter = commitWithIdentities(
    root,
    'Developer',
    'developer@example.com',
    fixtureName,
    fixtureEmail,
    'fixture committer'
  )
  assertRejected(runGuard(root, 'range', `${trailer}..${fixtureCommitter}`))
})

test('pre-push mode checks the exact outgoing range', (t) => {
  const root = createRepository(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  const normal = commit(root, 'Developer', 'developer@example.com', 'normal')
  const normalInput = `refs/heads/test ${normal} refs/heads/test ${base}\n`
  const normalResult = childProcess.spawnSync('bash', [guardPath, 'pre-push'], {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment,
    input: normalInput,
  })
  assert.equal(normalResult.status, 0)

  const fixture = commit(root, fixtureName, fixtureEmail, 'fixture author')
  const fixtureInput = `refs/heads/test ${fixture} refs/heads/test ${normal}\n`
  const fixtureResult = childProcess.spawnSync(
    'bash',
    [guardPath, 'pre-push'],
    {
      cwd: root,
      encoding: 'utf8',
      env: gitEnvironment,
      input: fixtureInput,
    }
  )
  assertRejected(fixtureResult)
})

function runPrePush(root, localRef, localSha, remoteSha) {
  return childProcess.spawnSync('bash', [guardPath, 'pre-push'], {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment,
    input: `${localRef} ${localSha} ${localRef} ${remoteSha}\n`,
  })
}

test('pre-push mode skips merged upstream history already on a remote', (t) => {
  const root = createRepositoryWithRemote(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  git(root, 'push', '-q', 'origin', 'main')

  // a trailer commit that already reached the remote through another branch
  git(root, 'switch', '-q', '-c', 'feature')
  const upstream = commit(
    root,
    'Developer',
    'developer@example.com',
    'upstream work',
    `Co-authored-by: ${fixtureName} <${fixtureEmail}>`
  )
  git(root, 'push', '-q', 'origin', 'feature')

  // the local branch merges that branch, like an upstream sync merge
  git(root, 'switch', '-q', 'main')
  git(root, 'merge', '--no-ff', '-m', 'merge upstream', upstream)
  const merged = git(root, 'rev-parse', 'HEAD')

  assert.equal(
    runPrePush(root, 'refs/heads/main', merged, base).status,
    0,
    'commits already pushed through the feature branch must not fail the push'
  )
})

test('pre-push mode still rejects new fixture commits after an upstream merge', (t) => {
  const root = createRepositoryWithRemote(t)
  const base = commit(root, 'Developer', 'developer@example.com', 'base')
  git(root, 'push', '-q', 'origin', 'main')

  git(root, 'switch', '-q', '-c', 'feature')
  const upstream = commit(
    root,
    'Developer',
    'developer@example.com',
    'upstream work',
    `Co-authored-by: ${fixtureName} <${fixtureEmail}>`
  )
  git(root, 'push', '-q', 'origin', 'feature')
  git(root, 'switch', '-q', 'main')
  git(root, 'merge', '--no-ff', '-m', 'merge upstream', upstream)

  const freshFixture = commit(root, fixtureName, fixtureEmail, 'fresh fixture')
  assertRejected(runPrePush(root, 'refs/heads/main', freshFixture, base))

  const freshTrailer = commit(
    root,
    'Developer',
    'developer@example.com',
    'fresh trailer',
    `Co-authored-by: ${fixtureName} <${fixtureEmail}>`
  )
  assertRejected(
    runPrePush(root, 'refs/heads/main', freshTrailer, freshFixture)
  )
})
