const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const {
  EXPECTED_CALL,
  validatePublicPlaywrightWorkflow,
} = require('./validate-public-playwright-workflow.cjs')

test('the current public workflow satisfies the runner trust boundary', () => {
  const result = validatePublicPlaywrightWorkflow(path.join(__dirname, '../..'))

  assert.equal(result.ok, true, result.issues.join('\n'))
  assert.match(EXPECTED_CALL, /@refs\/heads\/v3$/)
})
