const assert = require('node:assert/strict')
const http = require('node:http')
const { execFile, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

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

// A rename is the case the downstream classifier cannot reconstruct from a
// name-only diff: the old path disappears from the list and only the
// destination remains, which would read as an added application file.
function commitPackageRename(root, from, to) {
  fs.mkdirSync(path.join(root, 'packages'), { recursive: true })
  fs.writeFileSync(path.join(root, 'packages', from), 'x\n')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', `add ${from}`)
  git(root, 'push', '-q', 'origin', 'HEAD')
  const base = git(root, 'rev-parse', 'HEAD')
  git(root, 'mv', `packages/${from}`, `packages/${to}`)
  git(root, 'commit', '-q', '-m', `rename ${from}`)
  git(root, 'push', '-q', 'origin', 'HEAD')
  return { base, head: git(root, 'rev-parse', 'HEAD') }
}

// One mock server per runAction call: it stands in for the GitHub check-run
// endpoint the composite queries before honouring a metadata-only skip. The
// action runs the step script through an asynchronous child, because the mock
// answers on this process's event loop; a synchronous child would deadlock.
async function withCheckRunServer(handler, fn) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function readOutput(root) {
  const out = path.join(root, 'gh_output.txt')
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

function extractScript() {
  // The run block is the tail of the action, so everything after the marker
  // belongs to the script; blank lines inside it are literal content.
  const source = fs.readFileSync(ACTION, 'utf8')
  const start = source.indexOf('- id: check')
  assert.ok(start >= 0, 'check step not found')
  const runMarker = source.indexOf('run: |', start)
  assert.ok(runMarker > start, 'run block not found')
  return source
    .slice(runMarker + 'run: |'.length + 1)
    .split('\n')
    .map((line) => line.replace(/^ {8}/, ''))
    .join('\n')
}

async function runAction(
  root,
  { env, checkRuns = [], checkRunsStatus = 200, skipRequestAssertions = false }
) {
  let hits = 0
  return withCheckRunServer(
    (req, res) => {
      hits += 1
      if (!skipRequestAssertions && checkRunsStatus === 200) {
        const url = new URL(req.url, 'http://localhost')
        assert.equal(
          url.pathname,
          `/repos/test-owner/test-repo/commits/${env.HEAD_SHA}/check-runs`
        )
        assert.equal(url.searchParams.get('check_name'), env.PRIOR_CHECK_NAME)
      }
      res.writeHead(checkRunsStatus, { 'content-type': 'application/json' })
      res.end(
        checkRunsStatus === 200
          ? JSON.stringify({
              total_count: checkRuns.length,
              check_runs: checkRuns,
            })
          : JSON.stringify({ message: 'boom' })
      )
    },
    async (apiUrl) => {
      const out = path.join(root, 'gh_output.txt')
      fs.rmSync(out, { force: true })
      await execFileAsync('bash', ['-c', extractScript()], {
        cwd: root,
        env: {
          ...process.env,
          GITHUB_OUTPUT: out,
          GITHUB_API_URL: apiUrl,
          GITHUB_REPOSITORY: 'test-owner/test-repo',
          PATTERN,
          ...env,
        },
      })
      const outputs = readOutput(root)
      if (skipRequestAssertions) {
        assert.equal(hits, 0, 'the lookup must be skipped when no name is set')
      }
      return outputs
    }
  )
}

const successCheckRun = (headSha) => ({
  name: 'suite',
  head_sha: headSha,
  status: 'completed',
  conclusion: 'success',
})

test('a metadata-only edited event skips when the prior run succeeded', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [successCheckRun(head)],
  })
  assert.equal(out.should_run, 'false')
  assert.equal(out.skip_reason, 'validated-prior-success')
})

test('a metadata-only edited event re-runs after a prior failure', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [
      {
        name: 'suite',
        head_sha: head,
        status: 'completed',
        conclusion: 'failure',
      },
    ],
  })
  assert.equal(out.should_run, 'true')
  assert.equal(out.skip_reason, undefined)
})

test('a metadata-only edited event re-runs while the prior run is pending', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [
      {
        name: 'suite',
        head_sha: head,
        status: 'in_progress',
        conclusion: null,
      },
    ],
  })
  assert.equal(out.should_run, 'true')
})

test('a metadata-only edited event re-runs when the prior check is missing', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [],
  })
  assert.equal(out.should_run, 'true')
})

test('a metadata-only edited event re-runs when the check API fails', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRunsStatus: 500,
  })
  assert.equal(out.should_run, 'true')
  assert.equal(out.skip_reason, undefined)
})

test('a metadata-only edited event re-runs when the prior check belongs to another head', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [successCheckRun('0'.repeat(40))],
  })
  assert.equal(out.should_run, 'true')
})

test('a metadata-only edited event without a prior-check name always runs', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: '',
    },
    checkRuns: [successCheckRun(head)],
    // An unset name disables the lookup entirely, so the mock must not be hit.
    skipRequestAssertions: true,
  })
  assert.equal(out.should_run, 'true')
})

test('an edited event that retargets the base still computes the diff', async () => {
  const root = makeRepo()
  const oldBase = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'graphql.txt')
  const newBase = git(root, 'rev-parse', 'HEAD')
  commitPackageChange(root, 'grading.txt')
  const head = git(root, 'rev-parse', 'HEAD')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: newBase,
      HEAD_SHA: head,
      ACTION: 'edited',
      EDITED_BASE_FROM: oldBase,
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [successCheckRun(head)],
  })
  assert.equal(out.should_run, 'true')
  assert.equal(out.skip_reason, undefined)
})

test('a synchronize event still selects matching changes', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'synchronize',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [successCheckRun(head)],
  })
  assert.equal(out.should_run, 'true')
})

test('a non-edited event never consults the prior check', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'reopened',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [],
  })
  assert.equal(out.should_run, 'true')
})

test('an empty diff still fails open on a push event', async () => {
  const root = makeRepo()
  const sha = git(root, 'rev-parse', 'HEAD')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'push',
      BEFORE_SHA: '0000000000000000000000000000000000000000',
      BASE_REF: sha,
      HEAD_SHA: sha,
      ACTION: '',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
    },
    checkRuns: [],
  })
  assert.equal(out.should_run, 'true')
})

// A consumer classifier needs the records for the exact diff the filter decided
// on. A rename reaches it as a rename, so it can see that a path left the tree
// instead of reading the destination as a newly added file.
test('a pull request records the rename-aware diff for its consumer', async () => {
  const root = makeRepo()
  const { base, head } = commitPackageRename(root, 'graphql.txt', 'grading.txt')
  const records = path.join(root, 'changed-records.bin')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'synchronize',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
      RECORDS_PATH: records,
    },
    checkRuns: [],
  })

  assert.equal(out.should_run, 'true')
  assert.equal(out.records_path, records)
  const fields = fs.readFileSync(records, 'utf8').split('\0').filter(Boolean)
  assert.match(fields[0], /^R\d+$/)
  assert.deepEqual(fields.slice(1), [
    'packages/graphql.txt',
    'packages/grading.txt',
  ])
})

test('a push records the diff of the complete pushed range', async () => {
  const root = makeRepo()
  const before = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const records = path.join(root, 'changed-records.bin')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'push',
      BEFORE_SHA: before,
      BASE_REF: before,
      HEAD_SHA: head,
      ACTION: '',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
      RECORDS_PATH: records,
    },
    checkRuns: [],
  })

  assert.equal(out.should_run, 'true')
  assert.deepEqual(
    fs.readFileSync(records, 'utf8').split('\0').filter(Boolean),
    ['A', 'packages/graphql.txt']
  )
})

// An undeterminable diff must stay unproven. Writing an empty file would let a
// consumer read "no changed paths" from a diff that was never computed.
test('an undeterminable diff writes no records', async () => {
  const root = makeRepo()
  const sha = git(root, 'rev-parse', 'HEAD')
  const records = path.join(root, 'changed-records.bin')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'push',
      BEFORE_SHA: '0000000000000000000000000000000000000000',
      BASE_REF: sha,
      HEAD_SHA: sha,
      ACTION: '',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
      RECORDS_PATH: records,
    },
    checkRuns: [],
  })

  assert.equal(out.should_run, 'true')
  assert.equal(out.records_path, undefined)
  assert.equal(fs.existsSync(records), false)
})

// The records are opt-in: a caller that only needs the boolean decision must not
// leave a file behind next to its checkout.
test('records stay unwritten when the caller does not ask for them', async () => {
  const root = makeRepo()
  const base = git(root, 'rev-parse', 'HEAD')
  const head = commitPackageChange(root, 'graphql.txt')
  const out = await runAction(root, {
    env: {
      GITHUB_EVENT_NAME: 'pull_request',
      BASE_REF: base,
      HEAD_SHA: head,
      ACTION: 'synchronize',
      EDITED_BASE_FROM: '',
      PRIOR_CHECK_NAME: 'suite',
      RECORDS_PATH: '',
    },
    checkRuns: [],
  })

  assert.equal(out.should_run, 'true')
  assert.equal(out.records_path, undefined)
  assert.deepEqual(
    fs.readdirSync(root).filter((entry) => entry.endsWith('.bin')),
    []
  )
})
