const assert = require('node:assert/strict')
const { test } = require('node:test')
const { collectFlaky, render } = require('./playwright-flaky-summary.cjs')

test('collects only flaky tests from nested suites', () => {
  const report = {
    suites: [
      {
        specs: [
          {
            file: 'A.spec.ts',
            line: 3,
            title: 'stable',
            tests: [{ status: 'expected' }],
          },
        ],
        suites: [
          {
            specs: [
              {
                file: 'B.spec.ts',
                line: 9,
                title: 'retried',
                tests: [{ status: 'flaky' }],
              },
              {
                file: 'B.spec.ts',
                line: 20,
                title: 'broken',
                tests: [{ status: 'unexpected' }],
              },
            ],
          },
        ],
      },
    ],
  }
  assert.deepEqual(collectFlaky(report), [
    { file: 'B.spec.ts', line: 9, title: 'retried' },
  ])
})

test('renders nothing when no test was retried', () => {
  assert.equal(render([]), '')
})
