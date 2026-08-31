const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  EXPECTED_CALL,
  validatePublicPlaywrightWorkflow,
} = require('./validate-public-playwright-workflow.cjs')

test('the current public workflow satisfies the runner trust boundary', () => {
  const root = path.join(__dirname, '../..')
  const result = validatePublicPlaywrightWorkflow(root)

  assert.equal(result.ok, true, result.issues.join('\n'))
  const sources = [
    fs.readFileSync(
      path.join(root, '.github/workflows/test-playwright.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/workflows/public-pr-playwright-shards.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/actions/playwright-build/action.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/actions/playwright-shard/action.yml'),
      'utf8'
    ),
  ]
  assert.ok(sources[0].includes(EXPECTED_CALL))
  assert.match(sources[1], /playwright-build@refs\/heads\/v3/)
  assert.match(sources[1], /playwright-shard@refs\/heads\/v3/)
  assert.match(sources[2], /repository: \$\{\{ job\.workflow_repository \}\}/)
  assert.match(sources[2], /ref: \$\{\{ job\.workflow_sha \}\}/)
  assert.match(sources[3], /repository: \$\{\{ job\.workflow_repository \}\}/)
  assert.match(sources[3], /ref: \$\{\{ job\.workflow_sha \}\}/)
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

test('missing policy files produce actionable validator issues', (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'public-playwright-policy-')
  )
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const result = validatePublicPlaywrightWorkflow(root)

  assert.equal(result.ok, false)
  assert.ok(
    result.issues.some((issue) =>
      issue.includes('.github/workflows/test-playwright.yml')
    )
  )
})
