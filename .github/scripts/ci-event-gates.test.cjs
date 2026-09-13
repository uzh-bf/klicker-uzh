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

test('terminal reporters run unconditionally so a skip cannot read as acceptable', () => {
  const graphql = readWorkflow('test-graphql.yml')
  const playwright = readWorkflow('test-playwright.yml')

  // GitHub can count a skipped required check as acceptable, so these jobs must
  // run even when a dependency failed or was cancelled and let the reporter body
  // decide: the shared helper fails on a cancelled dependency.
  assert.equal(graphql.jobs['test-graphql-status'].if, 'always()')
  assert.doesNotMatch(graphql.jobs['test-graphql-status'].if, /!cancelled\(\)/)
  assert.doesNotMatch(
    graphql.jobs['test-graphql-status'].if,
    /needs\.[a-z-]+\.result/
  )
  assert.match(playwright.jobs['test-playwright-status'].if, /always\(\)/)
  assert.doesNotMatch(
    playwright.jobs['test-playwright-status'].if,
    /!cancelled\(\)/
  )
  assert.doesNotMatch(
    playwright.jobs['test-playwright-status'].if,
    /needs\.test-playwright-execution\.result/
  )
  assert.ok(
    graphql.jobs['test-graphql-status'].steps.some(
      (step) =>
        step.run === 'node .github/scripts/required-ci-status.cjs report'
    )
  )
})

// Lifecycle events on a merged or closed pull request must not launch new
// Playwright execution or reporting: the gate no longer exists, and the audit
// observed a full post-merge run started by such an event. The open-state guard
// subsumes the closed action, so the cancel job stays its only handler.
test('playwright execution and reporting run only for open pull requests', () => {
  const playwright = readWorkflow('test-playwright.yml')
  const executionGate = playwright.jobs['test-playwright-execution'].if
  const statusGate = playwright.jobs['test-playwright-status'].if

  assert.equal(
    readWorkflow('test-playwright.yml').jobs['cancel-closed-pr'].if,
    "github.event_name == 'pull_request' && github.event.action == 'closed'"
  )

  const open = (action) => ({
    event_name: 'pull_request',
    event: {
      action,
      pull_request: { state: 'open', number: 1 },
    },
  })
  const closedState = (action) => ({
    event_name: 'pull_request',
    event: {
      action,
      pull_request: { state: 'closed', number: 1 },
    },
  })

  for (const action of [
    'opened',
    'synchronize',
    'reopened',
    'ready_for_review',
    'edited',
    'converted_to_draft',
  ]) {
    assert.equal(evaluateGate(executionGate, open(action)), true, action)
    assert.equal(evaluateGate(statusGate, open(action)), true, action)
    assert.equal(evaluateGate(executionGate, closedState(action)), false, action)
    assert.equal(evaluateGate(statusGate, closedState(action)), false, action)
  }
  assert.equal(evaluateGate(executionGate, { event_name: 'push' }), true)
  assert.equal(evaluateGate(statusGate, { event_name: 'push' }), true)
})

// The envelope emits a duplicate run id only for a fully validated equivalent
// pull-request run; push validation must always execute independently. The
// reporter therefore has to tie reuse acceptance to the event family instead of
// rejecting every duplicate.
test('the playwright reporter reuses only pull-request validation', () => {
  const playwright = readWorkflow('test-playwright.yml')
  const report = playwright.jobs['test-playwright-status'].steps.find(
    (step) => step.name === 'Check result'
  ).run

  assert.match(
    report,
    /\[ -n "\$\{DUPLICATE_RUN_ID:-\}" \] && \[ "\$IS_PULL_REQUEST" != 'true' \]/
  )
  assert.match(report, /Push validation cannot be reused/)
  assert.doesNotMatch(report, /Playwright validation cannot be reused/)
})

// Marking a draft PR ready fires ready_for_review on the unchanged head SHA and
// re-runs every workflow that lists it. Drafts now run the identical suites and
// builds, so a listed workflow must own a documented PR lifecycle role that
// still needs the transition. Otherwise marking a PR ready duplicates
// validation that already passed.
const READY_FOR_REVIEW_LIFECYCLE_WORKFLOWS = new Map([
  [
    'test-playwright.yml',
    'the ready boundary runs the envelope so it can validate the existing full proof of an unchanged head instead of rebuilding and retesting it',
  ],
  [
    'check.yml',
    'the required check owns the ready boundary and must be recomputed there',
  ],
  [
    'check-ocr-final-review.yml',
    'final review ownership transfers from the draft review at the ready boundary',
  ],
  ['check-ocr-review.yml', 'owned code review re-runs at the ready boundary'],
  ['codeql-analysis.yml', 'owned code scanning re-runs at the ready boundary'],
  [
    'v3_sonarcloud.yml',
    'owned stable quality gate re-runs at the ready boundary',
  ],
])

test('ready_for_review lists only workflows with a documented lifecycle role', () => {
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

    if (READY_FOR_REVIEW_LIFECYCLE_WORKFLOWS.has(entry)) continue
    unaccounted.push(entry)
  }

  assert.deepEqual(
    unaccounted,
    [],
    'Workflows trigger on ready_for_review without a documented lifecycle role, so marking a PR ready re-runs identical validation on an unchanged head. Remove ready_for_review from the trigger or document the lifecycle role.'
  )
})

test('graphql validation re-runs on a base retarget but not the ready boundary', () => {
  const workflow = readWorkflow('test-graphql.yml')
  // "edited" re-evaluates the internal selector on a base retarget. The suite
  // runs identically for drafts and ready PRs, so the ready transition re-runs
  // nothing.
  assert.deepEqual(workflow.on.pull_request.types, [
    'opened',
    'synchronize',
    'reopened',
    'edited',
  ])
})

// The unit, OLAT, graphql and translation summaries share one always-reporting
// contract: a filter job selects, a suite job tests, and the terminal job
// reports even when the selector chooses nothing, so it can be required.
const REQUIRED_STATUS_REPORTERS = new Map([
  ['test-unit.yml', ['test-unit-status', 'filter', 'test-unit']],
  ['test-olat-api.yml', ['test-olat-api-status', 'filter', 'test-olat-api']],
  ['test-graphql.yml', ['test-graphql-status', 'filter', 'test-graphql']],
  [
    'test-intl-production.yml',
    ['test-intl-production-status', 'filter', 'intl-production-smoke'],
  ],
])

test('summary reporters always report and never suppress a required check', () => {
  for (const [name, [status, filter, suite]] of REQUIRED_STATUS_REPORTERS) {
    const workflow = readWorkflow(name)
    const job = workflow.jobs[status]
    assert.ok(job, name + ' must define ' + status)
    // Unconditional: a skipped required context can count as acceptable, so the
    // job must run and let the reporter fail cancellation itself.
    assert.equal(job.if, 'always()', name)
    assert.doesNotMatch(job.if, /cancelled/, name)
    assert.ok(job.needs.includes(filter), name)
    assert.ok(job.needs.includes(suite), name)
    // A workflow-level path filter would suppress the required context, so the
    // selector must live in a job instead.
    assert.equal(workflow.on?.pull_request?.paths, undefined, name)
    assert.equal(workflow.on?.push?.paths, undefined, name)
    // A retarget re-evaluates the internal selector.
    assert.ok(workflow.on.pull_request.types.includes('edited'), name)
    // Drafts run the same suite as ready PRs, so the workflow must not gate on
    // the draft state or re-run the suite at the ready transition.
    assert.ok(
      !workflow.on.pull_request.types.includes('ready_for_review'),
      name + ' must not re-run on the ready transition'
    )
    assert.doesNotMatch(
      String(workflow.jobs[suite].if ?? ''),
      /pull_request\.draft/,
      name + ' suite must not gate on the draft state'
    )
    // The shared helper writes the machine-readable promotion evidence.
    assert.ok(
      job.steps.some(
        (step) =>
          step.run === 'node .github/scripts/required-ci-status.cjs report'
      ),
      name
    )
    const upload = job.steps.find(
      (step) => step.uses === 'actions/upload-artifact@v4'
    )
    assert.equal(upload.with.name, 'required-ci-evidence', name)
    assert.equal(upload.with['if-no-files-found'], 'error', name)
  }
})
