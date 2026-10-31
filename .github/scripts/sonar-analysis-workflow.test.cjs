const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')

const ROOT = path.resolve(__dirname, '../..')
const workflow = fs.readFileSync(
  path.join(ROOT, '.github/workflows/sonar-analysis.yml'),
  'utf8'
)

function runBlock(name) {
  const step = workflow.split(`      - name: ${name}\n`)[1]
  assert.ok(step, `Missing workflow step: ${name}`)
  const script = step.split('        run: |\n')[1]
  assert.ok(script, `Missing shell block: ${name}`)
  const lines = script.split('\n')
  const end = lines.findIndex(
    (line) => !line.startsWith('          ') && line.trim()
  )
  return lines
    .slice(0, end < 0 ? undefined : end)
    .map((line) => line.slice(10))
    .join('\n')
}

function execute(t, script, env = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-workflow-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  const summary = path.join(cwd, 'summary.md')
  const output = path.join(cwd, 'output')
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ version: '0.0.0-synthetic' })
  )
  const result = spawnSync('/bin/bash', ['-e', '-c', script], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
      ...env,
    },
  })
  assert.ifError(result.error)
  return {
    ...result,
    summary: fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '',
    output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
  }
}

describe('Sonar workflow shell boundaries', () => {
  it('stops an absent credential before subsequent execution', (t) => {
    const result = execute(
      t,
      `${runBlock('Require the analysis credential')}\nprintf 'continued\\n'`
    )
    assert.equal(result.status, 1)
    assert.match(result.stdout, /::error::/)
    assert.notEqual(result.summary.length, 0)
    assert.doesNotMatch(result.stdout, /continued/)
  })

  it('accepts a supplied credential without printing it', (t) => {
    const token = 'synthetic-sonar-credential'
    const result = execute(t, runBlock('Require the analysis credential'), {
      SONAR_TOKEN: token,
    })
    assert.equal(result.status, 0)
    assert.equal(result.summary, '')
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    assert.ok(!result.output.includes(token))
  })

  it('writes the package version as a workflow output', (t) => {
    const result = execute(t, runBlock('Resolve the project version'))
    assert.equal(result.status, 0)
    assert.equal(result.output, 'value=0.0.0-synthetic\n')
  })
})

const properties = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, 'sonar-project.properties'), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1)]
    })
)

function csv(key) {
  return (properties[key] || '').split(',').filter(Boolean)
}

function matches(file, pattern) {
  const expression = pattern
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?'
      if (part === '**') return '.*'
      if (part === '*') return '[^/]*'
      if (part === '?') return '[^/]'
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${expression}$`).test(file)
}

function indexed(file) {
  const inRoots = (key) => csv(key).some((root) => file.startsWith(`${root}/`))
  const includedTest = csv('sonar.test.inclusions').some((pattern) =>
    matches(file, pattern)
  )
  const excludedSource = csv('sonar.exclusions').some((pattern) =>
    matches(file, pattern)
  )
  return {
    source: inRoots('sonar.sources') && !includedTest && !excludedSource,
    test: inRoots('sonar.tests') && includedTest,
  }
}

describe('Sonar classification contract', () => {
  it('keeps test fixtures separate from production and credential-sensitive scripts', () => {
    for (const file of [
      'apps/example/src/handler.test.ts',
      'packages/example/test/handler.ts',
      '.github/scripts/example.test.cjs',
      '.github/scripts/test_update_playwright_timings.py',
      'util/test-klicker-eval-integration.py',
      'util/test-klicker-eval-judge.py',
    ]) {
      assert.deepEqual(indexed(file), { source: false, test: true }, file)
    }
    for (const file of [
      'apps/example/src/handler.ts',
      'packages/example/src/handler.ts',
      'deploy/charts/example/templates/deployment.yaml',
      'util/init.sql',
      '.github/scripts/sonar-coverage-inputs.cjs',
    ]) {
      assert.deepEqual(indexed(file), { source: true, test: false }, file)
    }
  })

  it('assigns migration SQL to PostgreSQL while retaining the other dialect suffixes', () => {
    assert.ok(csv('sonar.postgres.file.suffixes').includes('sql'))
    assert.ok(!csv('sonar.plsql.file.suffixes').includes('sql'))
    assert.ok(csv('sonar.postgres.file.suffixes').includes('pgsql'))
    assert.ok(csv('sonar.postgres.file.suffixes').includes('psql'))
    assert.ok(csv('sonar.plsql.file.suffixes').includes('tab'))
    assert.ok(csv('sonar.plsql.file.suffixes').includes('pkb'))
    assert.equal(properties['sonar.tsql.file.suffixes'], undefined)
  })
})
