const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const ACTION = path.join(__dirname, '../actions/changed-paths/action.yml')
// A pattern the fixtures deliberately match, mirroring how the real
// workflows scope to package paths.
const PATTERN = '^packages/'

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'changed-paths-'))
  execFileSync('git', ['init', '-q', root])
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Test')
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed\n')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'seed')
  // The action always fetches the base from origin, so the fixture provides a
  // local bare remote exactly the way CI provides the GitHub remote.
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), 'changed-paths-origin-'))
  execFileSync('git', ['init', '-q', '--bare', origin])
  git(root, 'remote', 'add', 'origin', origin)
  git(root, 'push', '-q', 'origin', 'HEAD')
  return root
}

function commitPackageChange(root, name) {
  fs.mkdirSync(path.join(root, 'packages'), { recursive: true })
  fs.writeFileSync(path.join(root, 'packages', name), 'x\n')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', name)
  git(root, 'push', '-q', 'origin', 'HEAD')
  return git(root, 'rev-parse', 'HEAD')
}

function runAction(root, env) {
  // The composite's step body is extracted verbatim so the test exercises the
  // exact script CI runs rather than a paraphrase.
  const source = fs.readFileSync(ACTION, 'utf8')
  const start = source.indexOf('- id: check')
  assert.ok(start >= 0, 'check step not found')
  const runMarker = source.indexOf('run: |', start)
  assert.ok(runMarker > start, 'run block not found')
  // The run block is the tail of this action, so everything after the marker
  // belongs to the script; blank lines inside it are literal content.
  const script = source
    .slice(runMarker + 'run: |'.length + 1)
    .split('\n')
    .map((line) => line.replace(/^ {8}/, ''))
    .join('\n')
  const out = path.join(root, 'gh_output.txt')
  fs.rmSync(out, { force: true })
  execFileSync('bash', ['-c', script], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_OUTPUT: out,
      PATTERN,
      ...env,
    },
  })
  return Object.fromEntries(
    fs
      .readFileSync(out, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1)]
      })
  )
}

test('a metadata-only edited event selects no suite on an unchanged base', () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'graphql.txt')
  const out = runAction(root, {
    GITHUB_EVENT_NAME: 'pull_request',
    BASE_REF: base,
    ACTION: 'edited',
    EDITED_BASE_FROM: '',
  })
  assert.equal(out.should_run, 'false')
})

test('an edited event that retargets the base still computes the diff', () => {
  const root = makeRepo()
  const oldBase = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'graphql.txt')
  const newBase = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'grading.txt')
  const out = runAction(root, {
    GITHUB_EVENT_NAME: 'pull_request',
    BASE_REF: newBase,
    ACTION: 'edited',
    EDITED_BASE_FROM: oldBase,
  })
  assert.equal(out.should_run, 'true')
})

test('a synchronize event still selects matching changes', () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'graphql.txt')
  const out = runAction(root, {
    GITHUB_EVENT_NAME: 'pull_request',
    BASE_REF: base,
    ACTION: 'synchronize',
    EDITED_BASE_FROM: '',
  })
  assert.equal(out.should_run, 'true')
})

test('a non-edited event ignores metadata-only state entirely', () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'graphql.txt')
  const out = runAction(root, {
    GITHUB_EVENT_NAME: 'pull_request',
    BASE_REF: base,
    ACTION: 'reopened',
    EDITED_BASE_FROM: '',
  })
  assert.equal(out.should_run, 'true')
})

test('an empty diff still fails open on a push event', () => {
  const root = makeRepo()
  const sha = git(root, 'rev-parse', 'HEAD')
  const out = runAction(root, {
    GITHUB_EVENT_NAME: 'push',
    BEFORE_SHA: '0000000000000000000000000000000000000000',
    BASE_REF: sha,
    ACTION: '',
    EDITED_BASE_FROM: '',
  })
  assert.equal(out.should_run, 'true')
})
