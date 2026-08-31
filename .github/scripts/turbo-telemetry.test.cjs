const assert = require('node:assert/strict')
const test = require('node:test')

const { parseTurboOutput } = require('./turbo-telemetry.cjs')

test('parses the standard Turbo task and cache summary', () => {
  assert.deepEqual(
    parseTurboOutput(`
Tasks:    21 successful, 21 total
Cached:    17 cached, 21 total
`),
    {
      tasksSuccessful: 21,
      tasksTotal: 21,
      tasksCached: 17,
      cachedTotal: 21,
    }
  )
})

test('missing or unsuccessful Turbo summaries remain bounded', () => {
  assert.deepEqual(
    parseTurboOutput('build failed before Turbo printed a summary'),
    {
      tasksSuccessful: null,
      tasksTotal: null,
      tasksCached: null,
      cachedTotal: null,
    }
  )
})
