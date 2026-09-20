'use strict'

// A step whose whole run value is a repository script path executes that file,
// so the file must carry the executable bit in the committed tree. Without it
// the step dies with exit code 126 and nothing but "Permission denied", which
// no review of the workflow text can see. The mode is read from the index,
// because a fresh checkout receives exactly what the index records.

const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..')

const DIRECT_INVOCATION =
  /^\s*run:\s*(?:\.\/)?(\.github\/scripts\/[\w.-]+\.(?:sh|bash))\s*$/
const EXECUTABLE_BITS = 0o111

function directInvocations(text) {
  const found = []
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    const match = line.match(DIRECT_INVOCATION)
    if (match) found.push({ line: index + 1, script: match[1] })
  })
  return found
}

function isExecutableMode(mode) {
  return (Number.parseInt(mode, 8) & EXECUTABLE_BITS) !== 0
}

function trackedFiles(pattern) {
  return execFileSync('git', ['ls-files', pattern], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

function stepFiles() {
  return [
    ...trackedFiles('.github/workflows/*.yml'),
    ...trackedFiles('.github/workflows/*.yaml'),
    ...trackedFiles('.github/actions/*/action.yml'),
    ...trackedFiles('.github/actions/*/action.yaml'),
  ]
}

// The committed mode of a script, read from the index.
function committedMode(script) {
  const entry = execFileSync('git', ['ls-files', '--stage', '--', script], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  assert.ok(entry, script + ' is not tracked')
  return entry.split(' ')[0]
}

test('every directly invoked repository script is committed executable', () => {
  const invocations = stepFiles().flatMap((file) =>
    directInvocations(fs.readFileSync(path.join(root, file), 'utf8')).map(
      (entry) => ({ ...entry, file })
    )
  )

  // A regex that stopped matching would pass this test silently, so the
  // discovery itself is asserted against the invocations that motivated it.
  assert.ok(
    invocations.length >= 6,
    'expected the staging guard invocations, found ' + invocations.length
  )
  assert.ok(
    invocations.some(({ script }) =>
      script.endsWith('stg-image-reuse-guard.sh')
    ),
    'the reuse guard invocation was not discovered, so this proves nothing'
  )

  const offenders = invocations
    .filter(({ script }) => !isExecutableMode(committedMode(script)))
    .map(({ file, line, script }) => file + ':' + line + ' runs ' + script)

  assert.deepEqual(offenders, [])
})

test('the invocation reader reports only direct script executions', () => {
  const direct = directInvocations(
    [
      'run: .github/scripts/probe.sh',
      '        run: ./.github/scripts/probe.sh',
      'run: |',
      '  .github/scripts/probe.sh',
      'run: bash .github/scripts/probe.sh',
      'run: node .github/scripts/probe.cjs',
      'run: .github/scripts/probe.cjs',
      'run: ./.github/scripts/stg-image-publish-guard.sh',
    ].join('\n')
  )

  assert.deepEqual(direct, [
    { line: 1, script: '.github/scripts/probe.sh' },
    { line: 2, script: '.github/scripts/probe.sh' },
    { line: 8, script: '.github/scripts/stg-image-publish-guard.sh' },
  ])
  assert.equal(isExecutableMode('100755'), true)
  assert.equal(isExecutableMode('100644'), false)
})
