const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const SCRIPT = path.join(__dirname, 'pnpm-install-retry.sh')

// Runs the retry wrapper against a stub pnpm that fails a scripted number of
// times. Records every invocation so the test can prove the wrapper retries
// and that it never masks a persistent failure.
function runWrapper({ failures, attempts = '3', delay = '0' }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pnpm-retry-'))
  const counter = path.join(directory, 'count')
  const log = path.join(directory, 'log')
  fs.writeFileSync(counter, '0')
  fs.writeFileSync(
    path.join(directory, 'pnpm'),
    [
      '#!/usr/bin/env bash',
      'count=$(cat "$COUNTER")',
      'count=$(( count + 1 ))',
      'echo "$count" > "$COUNTER"',
      'echo "invoked $*" >> "$LOG"',
      'if [ "$count" -le "$FAILURES" ]; then echo "synthetic failure" >&2; exit 7; fi',
      'exit 0',
      '',
    ].join('\n'),
    { mode: 0o755 }
  )

  const result = spawnSync('bash', [SCRIPT, '--frozen-lockfile'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      COUNTER: counter,
      LOG: log,
      FAILURES: String(failures),
      PNPM_INSTALL_ATTEMPTS: attempts,
      PNPM_INSTALL_RETRY_DELAY_SECONDS: delay,
    },
  })

  const invocations = Number(fs.readFileSync(counter, 'utf8'))
  const logged = fs.readFileSync(log, 'utf8')
  fs.rmSync(directory, { recursive: true, force: true })
  return { ...result, invocations, logged }
}

test('a first-attempt success installs once and forwards its arguments', () => {
  const run = runWrapper({ failures: 0 })
  assert.equal(run.status, 0)
  assert.equal(run.invocations, 1)
  // The wrapper preserves the previous bare install and forwards extra flags.
  assert.equal(run.logged, 'invoked install --frozen-lockfile\n')
})

test('a transient failure is retried instead of failing the wave', () => {
  const run = runWrapper({ failures: 1 })
  assert.equal(run.status, 0)
  assert.equal(run.invocations, 2)
})

test('a failure on the last permitted attempt stays fatal', () => {
  const run = runWrapper({ failures: 3, attempts: '3' })
  assert.notEqual(run.status, 0)
  assert.equal(run.invocations, 3)
  // The original exit status is preserved so CI reports the real pnpm error.
  assert.equal(run.status, 7)
  assert.match(run.stderr, /failed after 3 attempts/)
})

test('the retry budget is bounded by the configured attempt count', () => {
  const run = runWrapper({ failures: 99, attempts: '2' })
  assert.notEqual(run.status, 0)
  assert.equal(run.invocations, 2)
})

test('every Playwright install step uses the bounded retry wrapper', () => {
  const root = path.resolve(__dirname, '../..')
  for (const action of ['playwright-build', 'playwright-shard']) {
    const contents = fs.readFileSync(
      path.join(root, `.github/actions/${action}/action.yml`),
      'utf8'
    )
    assert.ok(
      contents.includes(
        'run: bash .ci-control/.github/scripts/pnpm-install-retry.sh'
      ),
      `${action} must install through the retry wrapper`
    )
    assert.ok(
      !/run: pnpm install/.test(contents),
      `${action} must not call pnpm install directly`
    )
  }

  // The seeder produces the store that every PR shard restores, so a flake
  // there removes the seed for the whole fleet rather than one wave.
  const seed = fs.readFileSync(
    path.join(root, '.github/workflows/playwright-cache-seed.yml'),
    'utf8'
  )
  assert.ok(
    seed.includes(
      'run: bash .github/scripts/pnpm-install-retry.sh --frozen-lockfile'
    ),
    'the cache seeder must install through the retry wrapper'
  )
  assert.ok(
    !seed.includes('run: pnpm install --frozen-lockfile'),
    'the cache seeder must not call pnpm install directly'
  )
})
