const assert = require('node:assert/strict')
// Run explicitly with node --test; do not include in Vitest's *.test.* discovery.
const { spawnSync } = require('node:child_process')
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} = require('node:fs')
const { tmpdir } = require('node:os')
const { dirname, isAbsolute, join } = require('node:path')
const { test } = require('node:test')

test('CI refreshes pnpm workspace state after moving into the test container', () => {
  assert.ok(
    process.env.PNPM_EXECUTABLE && isAbsolute(process.env.PNPM_EXECUTABLE),
    'PNPM_EXECUTABLE must be the absolute path from the pnpm setup step'
  )
  const pnpmExecutable = realpathSync(process.env.PNPM_EXECUTABLE)
  const root = mkdtempSync(join(tmpdir(), 'olat-workspace-install-'))
  try {
    const host = join(root, 'host')
    const container = join(root, 'container')
    mkdirSync(join(host, 'packages', 'fixture'), { recursive: true })
    writeFileSync(join(host, 'package.json'), JSON.stringify({ private: true }))
    writeFileSync(
      join(host, 'pnpm-workspace.yaml'),
      'packages:\n  - packages/*\nverifyDepsBeforeRun: error\n'
    )
    writeFileSync(
      join(host, 'packages/fixture/package.json'),
      JSON.stringify({
        name: 'fixture',
        scripts: { build: 'node -e "process.exit(0)"' },
      })
    )
    const env = {
      ...process.env,
      CI: 'true',
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      PNPM_EXECUTABLE: pnpmExecutable,
    }
    const run = (cwd, args) =>
      spawnSync(pnpmExecutable, args, { cwd, env, encoding: 'utf8' })
    const installed = run(host, [
      'install',
      '--no-frozen-lockfile',
      '--offline',
    ])
    assert.equal(installed.status, 0, installed.stdout + installed.stderr)
    renameSync(host, container)
    const stale = run(container, ['--filter', 'fixture', 'run', 'build'])
    assert.notEqual(stale.status, 0)
    assert.match(stale.stdout + stale.stderr, /workspace structure has changed/)

    // Replay the actual entrypoint's install block, stopping before database setup.
    const dockerfile = readFileSync(join(__dirname, 'Dockerfile.test'), 'utf8')
    const entrypoint = dockerfile
      .match(/RUN echo '([\s\S]*?)' > \/app\/run-tests.sh/)[1]
      .replaceAll(/\\n\\\n/g, '\n')
    const setup = entrypoint
      .split('  # Ensure PostgreSQL is ready')[0]
      .replace('cd /usr/src/app', 'cd "$FIXTURE_WORKSPACE"')
      .replace('pnpm install', '"$PNPM_EXECUTABLE" install')
    const refreshed = spawnSync('/bin/bash', ['-c', setup], {
      cwd: container,
      env: { ...env, FIXTURE_WORKSPACE: container },
      encoding: 'utf8',
    })
    assert.equal(refreshed.status, 0, refreshed.stdout + refreshed.stderr)
    const built = run(container, ['--filter', 'fixture', 'run', 'build'])
    assert.equal(built.status, 0, built.stdout + built.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
