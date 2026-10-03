const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const YAML = require('yaml')

const root = path.resolve(__dirname, '../..')
const actionPath = '.github/actions/setup-node-pnpm/action.yml'
const readYaml = (file) =>
  YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const action = readYaml(actionPath)
const [setup, locate, restore] = action.runs.steps

// These expressions use only string comparisons and boolean operators, whose
// semantics match JavaScript for the string-valued inputs tested here.
function evaluate(expression, requested, event) {
  const source = expression
    .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
    .replaceAll('inputs.cache-write', "inputs['cache-write']")
  return vm.runInNewContext(source, {
    inputs: { 'cache-write': requested },
    github: { event_name: event },
  })
}

test('only explicitly enabled push jobs write; all other cases restore only', () => {
  assert.equal(action.inputs['cache-write'].default, 'false')
  assert.equal(setup.uses, 'actions/setup-node@v4')
  assert.equal(setup.with['node-version-file'], 'package.json')
  assert.equal(setup.with['cache-dependency-path'], 'pnpm-lock.yaml')
  assert.equal(restore.uses, 'actions/cache/restore@v4')
  assert.equal(restore.with['restore-keys'], undefined)
  assert.equal(restore.with['fail-on-cache-miss'], undefined)
  assert.equal(restore.with.path, `\${{ steps.cache.outputs.path }}`)
  assert.equal(restore.with.key, `\${{ steps.cache.outputs.key }}`)
  for (const requested of ['true', 'false', '', 'unexpected']) {
    for (const event of [
      'push',
      'pull_request',
      'pull_request_target',
      'workflow_dispatch',
      'schedule',
    ]) {
      const writer = requested === 'true' && event === 'push'
      assert.equal(
        evaluate(setup.with.cache, requested, event),
        writer ? 'pnpm' : ''
      )
      assert.equal(evaluate(locate.if, requested, event), !writer)
      assert.equal(evaluate(restore.if, requested, event), !writer)
    }
  }
})

test('readers retain setup-node v4 cache keys and reject missing cache inputs', (t) => {
  assert.equal(locate.env.LOCKFILE_HASH, `\${{ hashFiles('pnpm-lock.yaml') }}`)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-cache-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const output = path.join(directory, 'outputs')
  fs.writeFileSync(
    path.join(directory, 'pnpm'),
    '#!/bin/sh\n[ "$*" = "store path --silent" ] || exit 1\nprintf "%s\\n" "$TEST_STORE"\n',
    { mode: 0o755 }
  )
  const run = (hash, store) =>
    spawnSync('bash', ['-c', locate.run], {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_OUTPUT: output,
        LOCKFILE_HASH: hash,
        RUNNER_OS: 'Linux',
        TEST_STORE: store,
      },
    })
  assert.equal(run('synthetic-hash', '/synthetic/store/v11').status, 0)
  assert.equal(
    fs.readFileSync(output, 'utf8'),
    `path=/synthetic/store/v11\nkey=node-cache-Linux-${os.arch()}-pnpm-synthetic-hash\n`
  )
  assert.notEqual(run('', '/synthetic/store/v11').status, 0)
  assert.notEqual(run('synthetic-hash', '').status, 0)
})

test('the check push is the only configured hosted writer and helper edits reach tests', () => {
  const workflows = ['check', 'test-graphql', 'test-unit'].map((name) =>
    readYaml(`.github/workflows/${name}.yml`)
  )
  for (const [index, workflow] of workflows.entries()) {
    const steps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
    const callers = steps.filter(
      (step) => step.uses === './.github/actions/setup-node-pnpm'
    )
    assert.equal(callers.length, 1)
    assert.equal(
      callers[0].with?.['cache-write'] ?? 'false',
      index === 0 ? 'true' : 'false'
    )
    assert.ok(
      !steps.some(
        (step) =>
          step.uses?.startsWith('actions/setup-node@') ||
          step.uses?.startsWith('actions/cache/save@')
      )
    )
    assert.ok(
      steps.some((step) => step.run === 'pnpm install --frozen-lockfile')
    )
  }
  assert.deepEqual(workflows[0].on.push.branches, ['v3', 'v3*'])
  const filter = workflows[1].jobs.filter.steps.find(
    (step) => step.uses === './.github/actions/changed-paths'
  )
  assert.match(actionPath, new RegExp(filter.with.pattern))
  // The unit selector moved from workflow-level paths to a job so a required
  // status can always report; the filter must still cover helper edits.
  const unitFilter = workflows[2].jobs.filter.steps.find(
    (step) => step.uses === './.github/actions/changed-paths'
  )
  for (const marker of [
    '\\.github/actions/setup-node-pnpm/',
    '\\.github/workflows/test-unit\\.yml$',
    '\\.github/scripts/required-ci-status\\.cjs$',
  ]) {
    assert.ok(unitFilter.with.pattern.includes(marker), marker)
  }
})
