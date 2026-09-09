const assert = require('node:assert/strict')
const test = require('node:test')
const { verifyProductionReport } = require('./account-production-report.cjs')

function fixture() {
  const result = {
    errors: [],
    suites: [
      {
        specs: [
          {
            id: 'synthetic',
            file: 'synthetic.spec.ts',
            tests: [
              {
                projectName: 'chromium',
                expectedStatus: 'passed',
                status: 'expected',
                results: [{ status: 'passed', errors: [] }],
              },
            ],
          },
        ],
      },
    ],
    stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  }
  return {
    inventory: structuredClone(result),
    result,
    expectedSpecs: ['synthetic.spec.ts'],
  }
}

test('accepts complete execution and emits values-free counts', () => {
  assert.deepEqual(verifyProductionReport(fixture()), {
    specs: ['synthetic.spec.ts'],
    tests: 1,
  })
})

test('rejects skipped, failed, expected-failure and unexecuted tests', () => {
  for (const mutate of [
    (test) => {
      test.results = []
    },
    (test) => {
      test.results[0].status = 'skipped'
    },
    (test) => {
      test.results[0].status = 'failed'
    },
    (test) => {
      test.expectedStatus = 'failed'
    },
    (test) => {
      test.status = 'flaky'
    },
  ]) {
    const input = fixture()
    mutate(input.result.suites[0].specs[0].tests[0])
    assert.throws(() => verifyProductionReport(input))
  }
})

test('rejects missing specs, missing tests, duplicates and setup failures', () => {
  for (const mutate of [
    (input) => {
      input.expectedSpecs.push('missing.spec.ts')
    },
    (input) => {
      input.result.suites = []
    },
    (input) => {
      input.result.suites.push(input.result.suites[0])
    },
    (input) => {
      input.result.errors.push({ message: 'setup failed' })
    },
    (input) => {
      input.result.stats.skipped = 1
    },
  ]) {
    const input = fixture()
    mutate(input)
    assert.throws(() => verifyProductionReport(input))
  }
})
