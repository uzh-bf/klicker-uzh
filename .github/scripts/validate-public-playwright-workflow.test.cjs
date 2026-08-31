const assert = require('node:assert/strict')
const fs = require('node:fs')
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

test('selector shadow observes every pull request lifecycle transition', () => {
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
  assert.match(workflow, /playwright-selector-shadow:/)
  assert.match(workflow, /path: \.ci-control[\s\S]*path: \.candidate/)
  assert.match(workflow, /playwright-selector\.cjs/)
})
