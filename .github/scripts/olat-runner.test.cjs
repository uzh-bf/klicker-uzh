const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const root = fs.realpathSync(path.resolve(__dirname, '../..'))

test('OLAT runner preserves failure status and always cleans only its own project', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'olat-runner-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const log = path.join(directory, 'calls.jsonl')
  fs.writeFileSync(
    path.join(directory, 'docker'),
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.OLAT_TEST_LOG, JSON.stringify({args, workspace: process.env.OLAT_TEST_WORKSPACE}) + '\\n')
const command = args[5]
process.exit(Number(process.env['OLAT_TEST_' + command.toUpperCase()] || 0))
`,
    { mode: 0o755 }
  )
  const projects = new Set()
  for (const [build, up, down, expected] of [
    [0, 0, 0, 0],
    [0, 37, 0, 37],
    [23, 0, 0, 23],
    [0, 0, 19, 19],
    [0, 37, 19, 37],
  ]) {
    fs.writeFileSync(log, '')
    const result = spawnSync(
      'bash',
      [path.join(root, 'apps/olat-api/run-tests.sh')],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          OLAT_TEST_LOG: log,
          OLAT_TEST_BUILD: String(build),
          OLAT_TEST_UP: String(up),
          OLAT_TEST_DOWN: String(down),
        },
      }
    )
    assert.equal(result.status, expected, result.stderr)
    const calls = fs
      .readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
    const project = calls[0].args[2]
    assert.match(project, /^olat-test-\d+-\d+$/)
    assert.ok(!projects.has(project))
    projects.add(project)
    for (const call of calls) {
      assert.equal(call.workspace, root)
      assert.deepEqual(call.args.slice(0, 5), [
        'compose',
        '--project-name',
        project,
        '-f',
        path.join(root, 'apps/olat-api/test/docker/docker-compose.test.yml'),
      ])
    }
    assert.deepEqual(
      calls.map(({ args }) => args.slice(5)),
      [
        ['build'],
        ...(build === 0
          ? [['up', '--abort-on-container-exit', '--exit-code-from', 'test']]
          : []),
        ['down', '--volumes', '--remove-orphans'],
      ]
    )
  }
})
