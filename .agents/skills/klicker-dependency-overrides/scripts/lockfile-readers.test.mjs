import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const modules = path.resolve(scripts, '../../../..')
const environment = `lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
    packageManagerDependencies:
      pnpm: {specifier: 12.11.2, version: 12.11.2}
packages:
  pnpm@12.11.2: {}
snapshots:
  pnpm@12.11.2: {}
`
const project = (version) => `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      fixture: {specifier: ${version}, version: ${version}}
packages:
  fixture@${version}: {}
snapshots:
  fixture@${version}: {}
`
function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'klicker-lockfile-readers-')
  )
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-root',
      dependencies: { fixture: '2.0.0' },
    })
  )
  fs.writeFileSync(
    path.join(root, 'pnpm-workspace.yaml'),
    'packages: []\noverrides:\n  fixture: 2.0.0\n'
  )
  fs.writeFileSync(
    path.join(root, 'before.yaml'),
    "overrides:\n  'fixture@<2.0.0': 2.0.0\n"
  )
  return root
}
function run(root, script) {
  const args = [
    path.join(scripts, `${script}.mjs`),
    '--root',
    root,
    '--modules',
    modules,
  ]
  if (script === 'verify-dropped')
    args.push('--before', path.join(root, 'before.yaml'))
  if (script === 'audit-overrides')
    args.push(
      '--meta',
      path.join(root, 'meta'),
      '--json',
      path.join(root, 'audit.json')
    )
  // All registry metadata is supplied by fixtures. An unexpected curl call must
  // fail rather than touch the network or populate a real metadata cache.
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, PATH: root },
  })
}

test('all three readers select the project graph and reject ambiguous layouts', (t) => {
  const root = fixture(t)
  const cases = [
    ['single vulnerable', project('1.0.0'), false, true],
    [
      'manager-first vulnerable',
      `${environment}---\n${project('1.0.0')}`,
      false,
      true,
    ],
    ['single safe', project('2.0.0'), false, false],
    [
      'manager-first safe',
      `---\n${environment}---\n${project('2.0.0')}`,
      false,
      false,
    ],
    [
      'config-first',
      environment.replace(
        '    packageManagerDependencies:\n      pnpm: {specifier: 12.11.2, version: 12.11.2}\n',
        ''
      ) +
        '---\n' +
        project('2.0.0'),
      false,
      false,
    ],
    ['empty', '', true],
    ['environment only', environment, true],
    ['two project graphs', `${project('1.0.0')}---\n${project('2.0.0')}`, true],
    ['reversed', `${project('2.0.0')}---\n${environment}`, true],
    [
      'three documents',
      `${environment}---\n${project('1.0.0')}---\n${project('2.0.0')}`,
      true,
    ],
    [
      'missing importers',
      `${environment}---\nlockfileVersion: 9.0\npackages: {}\n`,
      true,
    ],
    [
      'empty importers',
      `${environment}---\nlockfileVersion: 9.0\nimporters: {}\n`,
      true,
    ],
    [
      'invalid importer',
      `${environment}---\nlockfileVersion: 9.0\nimporters: {.: null}\n`,
      true,
    ],
    ['malformed project', `${environment}---\nlockfileVersion: [\n`, true],
    ['malformed environment', `invalid: [\n---\n${project('2.0.0')}`, true],
    [
      'duplicate YAML key',
      `${environment}---\n${project('2.0.0')}importers: {}\n`,
      true,
    ],
    [
      'mixed environment/project',
      environment.replace(
        '    configDependencies: {}',
        '    configDependencies: {}\n    dependencies: {}'
      ) +
        '---\n' +
        project('2.0.0'),
      true,
    ],
  ]
  for (const [label, lock, reject, vulnerable] of cases) {
    fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), lock)
    for (const script of [
      'scan-spec-mismatch',
      'verify-dropped',
      'audit-overrides',
    ]) {
      const result = run(root, script)
      const context = `${label}: ${script}\n${result.stdout}\n${result.stderr}`
      assert.equal(result.error, undefined, context)
      if (reject) {
        assert.notEqual(result.status, 0, context)
        assert.match(result.stderr, /Error/, context)
        continue
      }
      assert.equal(
        result.status,
        script === 'audit-overrides' ? 0 : Number(vulnerable),
        context
      )
      if (script === 'scan-spec-mismatch') {
        assert.match(
          result.stdout,
          new RegExp(
            `compared 1 specifiers across 1 projects; mismatches=${Number(vulnerable)}`
          ),
          context
        )
      } else if (script === 'verify-dropped') {
        assert.match(
          result.stdout,
          new RegExp(`problems=${Number(vulnerable)}`),
          context
        )
      } else {
        const rows = JSON.parse(
          fs.readFileSync(path.join(root, 'audit.json'), 'utf8')
        )
        assert.equal(rows.length, 1, context)
        assert.equal(rows[0].locked, 1, context)
        assert.equal(rows[0].verdict, 'exact-pin', context)
      }
    }
  }
})

test('audit matches pnpm 12 exact release-age unions without exempting other versions', (t) => {
  const root = fixture(t)
  const owner = path.join(
    root,
    'node_modules/.pnpm/owner@1.0.0/node_modules/owner'
  )
  fs.mkdirSync(owner, { recursive: true })
  fs.mkdirSync(path.join(root, 'meta'))
  for (const name of ['fixture', '@scope/fixture']) {
    fs.writeFileSync(
      path.join(owner, 'package.json'),
      JSON.stringify({
        name: 'owner',
        version: '1.0.0',
        dependencies: { [name]: '*' },
      })
    )
    fs.writeFileSync(
      path.join(root, 'pnpm-lock.yaml'),
      `lockfileVersion: '9.0'
importers: {.: {}}
packages:
  '${name}@1.1.0': {}
  owner@1.0.0: {}
snapshots:
  '${name}@1.1.0': {}
  owner@1.0.0:
    dependencies:
      '${name}': 1.1.0
`
    )
    const fresh = new Date().toISOString()
    fs.writeFileSync(
      path.join(root, 'meta', `${name.replaceAll('/', '+')}.json`),
      JSON.stringify({
        versions: { '0.9.0': {}, '1.0.0': {}, '1.1.0': {}, '1.2.0': {} },
        time: {
          '0.9.0': '2020-01-01T00:00:00.000Z',
          '1.0.0': fresh,
          '1.1.0': fresh,
          '1.2.0': fresh,
        },
      })
    )
    const cases = [
      [[], 'load-bearing'],
      [[`${name}@1.0.0`], 'load-bearing'],
      [[`${name}@1.1.0`], 'line-pin'],
      [[`${name}@1.0.0||1.1.0`], 'line-pin'],
      [[`${name}@1.0.0 || 1.1.0`], 'line-pin'],
      [[`${name}@1.0.0`, `${name}@1.1.0`], 'line-pin'],
      [[`${name}@1.1.0`, `${name}@1.0.0`], 'line-pin'],
      [[name], 'downgrade'],
      [[`${name}@1.0.0`, name], 'downgrade'],
      [[name, `${name}@1.0.0`], 'downgrade'],
      [[`${name}@^1.0.0||1.1.0`], null],
      [[`${name}@1.0.0||`], null],
    ]
    for (const [exceptions, verdict] of cases) {
      fs.writeFileSync(
        path.join(root, 'pnpm-workspace.yaml'),
        `packages: []
minimumReleaseAge: 20160
minimumReleaseAgeExclude: ${JSON.stringify(exceptions)}
overrides:
  '${name}@<2.0.0': 1.1.0
`
      )
      const result = run(root, 'audit-overrides')
      const context = `${name}: ${JSON.stringify(exceptions)}\n${result.stdout}\n${result.stderr}`
      assert.equal(result.error, undefined, context)
      if (verdict === null) {
        assert.notEqual(result.status, 0, context)
        assert.match(
          result.stderr,
          /Invalid exact minimumReleaseAgeExclude version/,
          context
        )
      } else {
        assert.equal(result.status, 0, context)
        const rows = JSON.parse(
          fs.readFileSync(path.join(root, 'audit.json'), 'utf8')
        )
        assert.equal(rows[0].verdict, verdict, context)
      }
    }
  }
})
