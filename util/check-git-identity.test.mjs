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

function commit(root, name, email, ...paragraphs) {
  const messageArguments = paragraphs.flatMap((paragraph) => ['-m', paragraph])
  git(
    root,
    '-c',
    `user.name=${name}`,
    '-c',
    `user.email=${email}`,
    'commit',
    '--allow-empty',
    ...messageArguments
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

test('range mode rejects fixture authors and co-author trailers', (t) => {
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
