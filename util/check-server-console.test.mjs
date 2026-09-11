import assert from 'node:assert/strict'
import test from 'node:test'
import { findActiveConsoleCalls } from './check-server-console.mjs'

test('ignores comments and string contents', () => {
  const source = [
    "const url = 'https://example.test/path' // console.error('comment')",
    "/* console.warn('block comment')",
    '   second block line */',
    'const marker = "/* not a comment */"',
  ].join('\n')

  assert.deepEqual(findActiveConsoleCalls(source), [])
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
})

test('reports console calls inside template interpolations', () => {
  const source = [
    'const message = `result: ${console.error("active")}`',
    'const safe = `text ${/* comment */ 1 + 1}`',
  ].join('\n')

  assert.deepEqual(findActiveConsoleCalls(source), [
    { line: 1, method: 'error' },
  ])
})

test('does not confuse regex contents with comments or interpolation braces', () => {
  const sources = [
    String.raw`const re = /\/\//; console.info('active')`,
    String.raw`const re = /\/\*/; console.info('active')`,
    'const text = `${/}/.test("}") ? console.info("active") : ""}`',
  ]
  for (const source of sources) {
    assert.deepEqual(findActiveConsoleCalls(source), [
      { line: 1, method: 'info' },
    ])
  }
})

test('parses TypeScript assertions using the source file extension', () => {
  assert.deepEqual(
    findActiveConsoleCalls(
      'const x = <string>value; console.error(x)',
      'server.ts'
    ),
    [{ line: 1, method: 'error' }]
  )
})

test('detects optional and literal bracket calls without matching regex text', () => {
  const source = [
    'const pattern = /console.error()/',
    'console?.warn("active")',
    'console["error"]("active")',
  ].join('\n')
  assert.deepEqual(findActiveConsoleCalls(source), [
    { line: 2, method: 'warn' },
    { line: 3, method: 'error' },
  ])
})
