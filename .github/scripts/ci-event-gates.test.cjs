const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.join(__dirname, '../..')

function readWorkflow(name) {
  return YAML.parse(
    fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8')
  )
}

// Evaluate the actual checked-in predicate against synthetic GitHub contexts.
function evaluateGate(expression, github, needs = {}, cancelled = false) {
  const normalized = expression.replace(
    /needs\.([a-z][a-z0-9-]*)/g,
    'needs["$1"]'
  )
  // Repository-controlled input only: the expression must originate from a
  // parsed file under .github/workflows/. Do not route external or untrusted
  // text here.
  return new Function(
    'github',
    'needs',
    'always',
    'cancelled',
    `return (${normalized})`
  )(
    github,
    needs,
    () => true,
    () => cancelled
  )
}

test('trusted review policy admits only lifecycle events and exact PR commands', () => {
  const workflow = readWorkflow('check-ocr-final-review.yml')
  const gate = workflow.jobs.trusted_policy.if

  const allowed = [
    { name: 'pull_request_target' },
    {
      name: 'issue_comment',
      issuePullRequest: true,
      comment: '/final-review',
    },
    {
      name: 'issue_comment',
      issuePullRequest: true,
      comment: '/final-review-stack',
    },
  ]
  const denied = [
    {
      name: 'issue_comment',
      issuePullRequest: false,
      comment: '/final-review',
    },
    {
      name: 'issue_comment',
      issuePullRequest: true,
      comment: '/final-review ',
    },
    { name: 'issue_comment', issuePullRequest: true, comment: 'final-review' },
    { name: 'workflow_dispatch' },
    { name: 'push' },
  ]

  for (const [events, expected] of [
    [allowed, true],
    [denied, false],
  ]) {
    for (const event of events) {
      assert.equal(
        evaluateGate(gate, {
          event_name: event.name,
          event: {
            issue: { pull_request: event.issuePullRequest ? {} : null },
            comment: { body: event.comment },
          },
        }),
        expected
      )
    }
  }
})

test('reporting jobs keep real failures and successful path skips visible', () => {
  const graphql = readWorkflow('test-graphql.yml')
  const playwright = readWorkflow('test-playwright.yml')

  assert.match(graphql.jobs['test-graphql-status'].if, /always\(\)/)
  assert.match(graphql.jobs['test-graphql-status'].if, /!cancelled\(\)/)
  assert.match(
    graphql.jobs['test-graphql-status'].if,
    /needs\.filter\.result != 'cancelled'/
  )
  assert.match(
    graphql.jobs['test-graphql-status'].if,
    /needs\.test-graphql\.result != 'cancelled'/
  )
  assert.match(playwright.jobs['test-playwright-status'].if, /!cancelled\(\)/)
  assert.match(
    playwright.jobs['test-playwright-status'].if,
    /needs\.test-playwright-execution\.result != 'cancelled'/
  )

  for (const result of ['success', 'failure', 'skipped', 'cancelled']) {
    for (const canceled of [false, true]) {
      assert.equal(
        evaluateGate(
          graphql.jobs['test-graphql-status'].if,
          {},
          {
            filter: { result: 'success' },
            'test-graphql': { result },
          },
          canceled
        ),
        !canceled && result !== 'cancelled'
      )
      assert.equal(
        evaluateGate(
          playwright.jobs['test-playwright-status'].if,
          {
            event_name: 'pull_request',
            event: { action: 'synchronize' },
          },
          { 'test-playwright-execution': { result } },
          canceled
        ),
        !canceled && result !== 'cancelled'
      )
    }
  }
})

// Marking a draft PR ready fires ready_for_review on the unchanged head SHA
// and re-runs every workflow that lists it. That is only justified when the
// draft boundary changes what the workflow executes: either jobs are gated on
// the draft state (skipped while drafting, first real run at the transition),
// or the workflow owns PR lifecycle handling. Workflows that execute
// identically for draft and ready PRs must not list the type, or marking a
// PR ready duplicates validation that already passed.
const READY_FOR_REVIEW_LIFECYCLE_WORKFLOWS = new Map([
  [
    'test-playwright.yml',
    'drafts skip execution and report the skip; ready transitions start the full run and draft conversion or closure cancels it',
  ],
  [
    'check-ocr-final-review.yml',
    'final review ownership transfers from the draft review at the ready boundary',
  ],
])

test('ready_for_review triggers only change execution at the draft boundary', () => {
  const directory = path.join(root, '.github/workflows')
  const unaccounted = []

  for (const entry of fs.readdirSync(directory).sort()) {
    if (!entry.endsWith('.yml')) continue
    const workflow = YAML.parse(
      fs.readFileSync(path.join(directory, entry), 'utf8')
    )
    const triggers = [
      workflow.on?.pull_request,
      workflow.on?.pull_request_target,
    ]
    const listsReadyForReview = triggers.some(
      (trigger) =>
        Array.isArray(trigger?.types) &&
        trigger.types.includes('ready_for_review')
    )
    if (!listsReadyForReview) continue

    const source = fs.readFileSync(path.join(directory, entry), 'utf8')
    const draftGated = /pull_request\.draft == (?:true|false)/.test(source)
    if (draftGated || READY_FOR_REVIEW_LIFECYCLE_WORKFLOWS.has(entry)) continue
    unaccounted.push(entry)
  }

  assert.deepEqual(
    unaccounted,
    [],
    'Workflows trigger on ready_for_review without a draft-state gate or a documented lifecycle role, so marking a PR ready re-runs identical validation on an unchanged head. Either gate the jobs on github.event.pull_request.draft or remove ready_for_review from the trigger.'
  )
})

test('graphql validation stays authoritative across the ready transition', () => {
  const workflow = readWorkflow('test-graphql.yml')
  assert.deepEqual(workflow.on.pull_request.types, [
    'opened',
    'synchronize',
    'reopened',
  ])
})
