const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '../..')
const INSTALLER = path.join(__dirname, 'install-devrouter-locked.sh')

function fixture(t, { exitCode = 0, missingBinary = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'locked-devrouter-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const mockBin = path.join(directory, 'mock-bin')
  fs.mkdirSync(mockBin)
  const mockCli = path.join(directory, 'mock-devrouter.cjs')
  fs.writeFileSync(
    mockCli,
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
if (args[0] === '-V') {
  console.log('Installed CLI version: 0.6.1')
  console.log('Local repo version (.devrouter.yml): 0.6.1')
  process.exit(0)
}
if (args[0] !== 'profile' || args[1] !== 'plan') process.exit(2)
const value = key => args[args.indexOf(key) + 1]
const plan = {
  schemaVersion: 1,
  repoPath: value('--repo'),
  profile: value('--profile'),
  apps: ['api'], dependencies: [], readiness: ['api'],
  managedRuntime: { services: ['postgres'], processes: ['klicker-dev'] },
  contractPath: value('--contract'),
  bindings: {
    turboFilters: ['--filter=@klicker-uzh/backend-docker'],
    serviceEndpoints: ['http://127.0.0.1:3000/healthz'],
  },
}
fs.writeFileSync(value('--output'), JSON.stringify(plan))
console.log(JSON.stringify(plan))
`,
    { mode: 0o755 }
  )
  fs.writeFileSync(
    path.join(mockBin, 'npm'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "$MOCK_NPM_ARGUMENTS"
pwd -P > "$MOCK_NPM_WORKDIR"
if [ "$MOCK_NPM_EXIT" != 0 ]; then exit "$MOCK_NPM_EXIT"; fi
if [ "$MOCK_MISSING_BINARY" = true ]; then exit 0; fi
mkdir -p node_modules/.bin
cp "$MOCK_DEVROUTER" node_modules/.bin/devrouter
chmod +x node_modules/.bin/devrouter
`,
    { mode: 0o755 }
  )
  const runnerTemp = path.join(directory, 'runner-temp')
  const githubPath = path.join(directory, 'github-path')
  const githubEnv = path.join(directory, 'github-env')
  const argsLog = path.join(directory, 'npm-arguments')
  const workdirLog = path.join(directory, 'npm-workdir')
  const env = {
    ...process.env,
    BASH_ENV: '/dev/null',
    PATH: [mockBin, path.dirname(process.execPath), process.env.PATH].join(
      path.delimiter
    ),
    RUNNER_TEMP: runnerTemp,
    GITHUB_PATH: githubPath,
    GITHUB_ENV: githubEnv,
    MOCK_NPM_ARGUMENTS: argsLog,
    MOCK_NPM_WORKDIR: workdirLog,
    MOCK_NPM_EXIT: String(exitCode),
    MOCK_MISSING_BINARY: String(missingBinary),
    MOCK_DEVROUTER: mockCli,
  }
  const prefix = path.join(runnerTemp, 'klicker-devrouter-locked')
  const run = () =>
    spawnSync('bash', [INSTALLER], { cwd: ROOT, env, encoding: 'utf8' })
  return {
    directory,
    prefix,
    githubPath,
    githubEnv,
    argsLog,
    workdirLog,
    env,
    run,
  }
}

test('locked installer exposes the actual executable through the host resolver and runtime planner', async (t) => {
  const state = fixture(t)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = state.run()
    assert.equal(result.status, 0, result.stderr)
  }
  const binary = path.join(state.prefix, 'bin/devrouter')
  assert.equal(fs.readlinkSync(binary), '../node_modules/.bin/devrouter')
  assert.equal(
    fs.readFileSync(state.githubPath, 'utf8'),
    `${path.dirname(binary)}\n`.repeat(2)
  )
  assert.equal(
    fs.readFileSync(state.githubEnv, 'utf8'),
    `KLICKER_DEVROUTER_BIN=${binary}\n`.repeat(2)
  )
  assert.equal(
    fs.readFileSync(state.workdirLog, 'utf8').trim(),
    fs.realpathSync(state.prefix)
  )
  assert.deepEqual(fs.readFileSync(state.argsLog, 'utf8').trim().split('\n'), [
    'ci',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--workspaces=false',
  ])
  for (const filename of ['package.json', 'package-lock.json']) {
    assert.deepEqual(
      fs.readFileSync(path.join(state.prefix, filename)),
      fs.readFileSync(path.join(ROOT, '.github/toolchains/devrouter', filename))
    )
  }
  const { resolveDevrouter } = await import(
    pathToFileURL(path.join(ROOT, 'util/devrouter-cli.mjs')).href
  )
  assert.equal(
    resolveDevrouter({ repo: ROOT, env: state.env, executable: binary }),
    binary
  )
  assert.throws(
    () =>
      resolveDevrouter({
        repo: ROOT,
        env: state.env,
        executable: path.join(state.prefix, 'node_modules/.bin/devrouter'),
      }),
    /No executable host Devrouter/
  )
  // Invoke the same wrapper used by CI rather than proving only the direct CLI.
  const output = path.join(state.directory, 'runtime-plan.json')
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'util/playwright-profile-runtime.mjs'),
      'resolve',
      '--repo',
      ROOT,
      '--devrouter-bin',
      binary,
      '--profile',
      'full',
      '--output',
      output,
    ],
    { cwd: ROOT, env: state.env, encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Resolved Playwright profile playwright: api/)
  const runtime = JSON.parse(fs.readFileSync(output, 'utf8'))
  assert.equal(runtime.profile, 'playwright')
  assert.deepEqual(runtime.apps, ['api'])
  assert.deepEqual(runtime.bindings.turboFilters, [
    '--filter=@klicker-uzh/backend-docker',
  ])
})

test('a failed locked install publishes no executable or workflow environment', (t) => {
  const state = fixture(t, { exitCode: 7 })
  const result = state.run()
  assert.equal(result.status, 7, result.stderr)
  assert.equal(fs.existsSync(state.githubPath), false)
  assert.equal(fs.existsSync(state.githubEnv), false)
  assert.equal(fs.existsSync(path.join(state.prefix, 'bin/devrouter')), false)
})

test('a successful install without an executable fails before publishing the path', (t) => {
  const state = fixture(t, { missingBinary: true })
  const result = state.run()
  assert.equal(result.status, 1, result.stderr)
  assert.equal(fs.existsSync(state.githubPath), false)
  assert.equal(fs.existsSync(state.githubEnv), false)
})
