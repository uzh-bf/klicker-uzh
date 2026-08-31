const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  EXPECTED_BUILD_ACTION,
  EXPECTED_CALL,
  EXPECTED_SHARD_ACTION,
  validatePublicPlaywrightWorkflow,
} = require('./validate-public-playwright-workflow.cjs')

test('the current public workflow satisfies the runner trust boundary', () => {
  const result = validatePublicPlaywrightWorkflow(path.join(__dirname, '../..'))

  assert.equal(result.ok, true, result.issues.join('\n'))
  assert.match(EXPECTED_CALL, /@refs\/heads\/v3$/)
  assert.match(EXPECTED_BUILD_ACTION, /@refs\/heads\/v3$/)
  assert.match(EXPECTED_SHARD_ACTION, /@refs\/heads\/v3$/)
})

test('the reusable envelope owns lifecycle routing and selector shadow planning', () => {
  const workflow = fs.readFileSync(
    path.join(
      path.join(__dirname, '../..'),
      '.github/workflows/test-playwright.yml'
    ),
    'utf8'
  )

  assert.match(
    workflow,
    /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft\]/
  )
  assert.match(workflow, /test-playwright-execution:/)
  assert.match(
    workflow,
    /uses: uzh-bf\/klicker-uzh\/.github\/workflows\/public-pr-playwright-shards\.yml@refs\/heads\/v3/
  )
  assert.doesNotMatch(workflow, /group: public-pr-arm64/)
  assert.match(workflow, /test-playwright-status:/)
})
