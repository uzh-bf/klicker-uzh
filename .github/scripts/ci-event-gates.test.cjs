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
function evaluateGate(
  expression,
  github,
  needs = {},
  cancelled = false,
  vars = {}
) {
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
    'vars',
    `return (${normalized})`
  )(
    github,
    needs,
    () => true,
    () => cancelled,
    vars
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

test('staging promotion admits selected-source pushes before allocating a runner', () => {
  const workflow = readWorkflow('deploy-stg-promote.yml')
  const gate = workflow.jobs.promote.if

  for (const selectedSource of ['v3', 'v3-ai', 'v3-audit']) {
    for (const [event, conclusion, headBranch, expected] of [
      ['push', 'success', selectedSource, true],
      ['push', 'success', 'v3-unselected', false],
      ['pull_request', 'success', selectedSource, false],
      ['push', 'failure', selectedSource, false],
      ['push', 'cancelled', selectedSource, false],
      ['push', 'skipped', selectedSource, false],
    ]) {
      assert.equal(
        evaluateGate(
          gate,
          {
            event_name: 'workflow_run',
            event: {
              workflow_run: { event, conclusion, head_branch: headBranch },
            },
          },
          {},
          false,
          { STG_SOURCE_BRANCH: selectedSource }
        ),
        expected
      )
    }
  }

  assert.equal(
    evaluateGate(gate, {
      event_name: 'workflow_run',
      event: {
        workflow_run: {
          event: 'push',
          conclusion: 'success',
          head_branch: 'v3',
        },
      },
    }),
    false
  )
  assert.equal(evaluateGate(gate, { event_name: 'workflow_dispatch' }), true)
  assert.deepEqual(workflow.on.workflow_run.branches, ['v3', 'v3*'])
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
    assert.equal(
      evaluateGate(executionGate, closedState(action)),
      false,
      action
    )
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
// re-runs every workflow that lists it. Validation suites run identically for
// drafts and ready PRs; the staging image builds are the documented exception:
// drafts defer them and the boundary restores them. A listed workflow must own
// a documented PR lifecycle role that still needs the transition, otherwise
// marking a PR ready duplicates validation that already passed.
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
  ...[
    'v3_analytics-stg.yml',
    'v3_auth-stg.yml',
    'v3_backend-docker-stg.yml',
    'v3_chat-stg.yml',
    'v3_frontend-control-docker-stg.yml',
    'v3_frontend-manage-docker-stg.yml',
    'v3_frontend-pwa-docker-assessment-stg.yml',
    'v3_frontend-pwa-docker-stg.yml',
    'v3_hatchet-worker-general-stg.yml',
    'v3_hatchet-worker-response-processor-stg.yml',
    'v3_lti-stg.yml',
    'v3_olat-api-stg.yml',
    'v3_response-api-stg.yml',
    'v3_mcp-lecturer-stg.yml',
    'v3_mcp-student-stg.yml',
  ].map((name) => [
    name,
    'draft pull requests defer their staging image builds to relieve the constrained ARM64 build pool; ready_for_review restores the deferred builds on the unchanged head',
  ]),
  [
    'v3_build-fallback.yml',
    'the required image-build context recomputes at the ready boundary and validates the builds that the boundary restores',
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

// Closing a pull request must reclaim every per-PR workflow concurrency group,
// not only Playwright. The sweeper substitutes each target's group prefix
// literally because github.workflow inside the sweeper names the sweeper, so a
// renamed workflow or a new per-PR group needs a matching matrix entry.
const CLOSED_PR_SWEEPER_EXCLUSIONS = new Map([
  [
    'check-ocr-final-review.yml',
    'triggers on closed itself and owns the final-review supersession lifecycle',
  ],
])

// Entries for workflows that exist only on the v3-ai/v3-audit integration
// branches. They stay in the single v3-owned matrix; on v3 the legs join a
// group no run ever occupies, and requiring the standard name-derived prefix
// keeps the allowlist honest while the workflows are absent there.
const CLOSED_PR_SWEEPER_INTEGRATION_ONLY = new Map([
  ['Test lecturer MCP server', 'v3-ai integration-branch validation suite'],
  [
    'Build Docker image for mcp-lecturer (stg)',
    'v3-ai integration-branch image build',
  ],
  [
    'Build Docker image for mcp-student (stg)',
    'v3-ai integration-branch image build',
  ],
])

test('closed-pr sweeper covers every per-PR workflow concurrency group', () => {
  const sweeper = readWorkflow('cancel-closed-pr-checks.yml')
  const job = sweeper.jobs['cancel-closed-pr-checks']

  assert.deepEqual(sweeper.on.pull_request.types, ['closed'])
  assert.equal(sweeper.on.push, undefined)
  assert.equal(
    job.concurrency.group,
    '${{ matrix.group }}-${{ github.event.pull_request.number }}'
  )
  assert.equal(job.concurrency['cancel-in-progress'], true)
  assert.deepEqual(job.permissions, {})
  assert.equal(job['timeout-minutes'], 5)
  assert.equal(job.steps.length, 1)
  assert.equal(job.steps[0].run, ':')

  const entries = job.strategy.matrix.include
  const directory = path.join(root, '.github/workflows')
  const targets = new Map()

  for (const entry of fs.readdirSync(directory).sort()) {
    if (entry === 'cancel-closed-pr-checks.yml' || !entry.endsWith('.yml')) {
      continue
    }
    const workflow = YAML.parse(
      fs.readFileSync(path.join(directory, entry), 'utf8')
    )
    const prTrigger =
      workflow.on?.pull_request ?? workflow.on?.pull_request_target
    const group = workflow.concurrency?.group
    if (
      !prTrigger ||
      typeof group !== 'string' ||
      !group.includes('github.event.pull_request.number')
    ) {
      continue
    }

    const name = workflow.name ?? entry
    const prefix = group.startsWith('${{ github.workflow }}-')
      ? name
      : group.slice(0, group.indexOf('-${{'))
    targets.set(entry, { name, prefix })
  }

  for (const [entry, target] of targets) {
    if (CLOSED_PR_SWEEPER_EXCLUSIONS.has(entry)) continue
    assert.ok(
      entries.some(
        (e) => e.workflow === target.name && e.group === target.prefix
      ),
      entry +
        ' owns the per-PR concurrency group ' +
        target.prefix +
        '-<number> but the closed-PR sweeper has no matching entry'
    )
  }

  for (const e of entries) {
    const matchesLive = [...targets.values()].some(
      (t) => t.name === e.workflow && t.prefix === e.group
    )
    const integrationOnly =
      CLOSED_PR_SWEEPER_INTEGRATION_ONLY.has(e.workflow) &&
      e.group === e.workflow
    assert.ok(
      matchesLive || integrationOnly,
      'sweeper entry matches no live per-PR workflow: ' + e.workflow
    )
  }
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

// The codebase check reuses its own completed validation only for a
// metadata-only edit on an unchanged tree, and reports the required context
// from a job that always runs. The suite job must never carry that context,
// because GitHub can treat a skipped required check as acceptable.
test('the codebase check reuses prior validation without suppressing its context', () => {
  const workflow = readWorkflow('check.yml')
  const terminal = workflow.jobs.check
  assert.ok(terminal, 'check.yml must define the required check job')
  assert.equal(terminal.if, 'always()')
  assert.deepEqual(terminal.needs, ['select', 'check-suite'])
  assert.ok(
    terminal.steps.some(
      (step) =>
        step.run === 'node .github/scripts/required-ci-status.cjs report'
    )
  )
  const upload = terminal.steps.find(
    (step) => step.uses === 'actions/upload-artifact@v4'
  )
  assert.equal(upload.with.name, 'required-ci-evidence')
  assert.equal(upload.with['if-no-files-found'], 'error')

  const selector = workflow.jobs.select.steps.find(
    (step) => step.uses === './.github/actions/changed-paths'
  )
  // The lookup names the stable terminal context, never a suite job.
  assert.equal(selector.with['prior-check-name'], 'check')
  assert.match(
    String(workflow.jobs['check-suite'].if),
    /needs\.select\.outputs\.should_run == 'true'/
  )
  assert.equal(workflow.permissions.checks, 'read')
  // The ready boundary still recomputes, and an edited retarget still selects
  // through the same action.
  assert.ok(workflow.on.pull_request.types.includes('ready_for_review'))
  assert.ok(workflow.on.pull_request.types.includes('edited'))
})
