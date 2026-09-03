import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findActiveConsoleCalls,
  stripComments,
} from './check-server-console.mjs'

test('strips comments without changing line numbers or string contents', () => {
  const source = [
    "const url = 'https://example.test/path' // console.error('comment')",
    "/* console.warn('block comment')",
    '   second block line */',
    'const marker = "/* not a comment */"',
  ].join('\n')

  const stripped = stripComments(source)

  assert.equal(stripped.split('\n').length, source.split('\n').length)
  assert.match(stripped, /https:\/\/example\.test\/path/)
  assert.match(stripped, /\/\* not a comment \*\//)
  assert.doesNotMatch(stripped, /console\.(?:error|warn)/)
})

test('reports active console calls with their source lines', () => {
  const source = [
    "console.error('active')",
    "// console.log('comment')",
    "const text = 'console.info(inside a string)'",
    "console . warn('active')",
  ].join('\n')

  assert.deepEqual(findActiveConsoleCalls(source), [
    { line: 1, method: 'error' },
    { line: 4, method: 'warn' },
  ])

  test('reports console calls inside template interpolations', () => {
    const source = [
      'const message = `result: ${console.error("active")}`',
      'const safe = `text ${/* comment */ 1 + 1}`',
    ].join('\n')

    assert.deepEqual(findActiveConsoleCalls(source), [
      { line: 1, method: 'error' },
    ])
  })
})
