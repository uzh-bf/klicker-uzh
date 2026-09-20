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
  vars = {},
  steps = {}
) {
  const normalized = expression
    .replace(/needs\.([a-z][a-z0-9-]*)/g, 'needs["$1"]')
    .replace(
      /steps\.([a-z][a-z0-9-]*)\.outputs\.([a-z_]+)/g,
      'steps["$1"].outputs["$2"]'
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
    'steps',
    `return (${normalized})`
  )(
    github,
    needs,
    () => true,
    () => cancelled,
    vars,
    steps
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
  [
    'v3_images-stg.yml',
    'draft pull requests defer the selected staging image builds to relieve the constrained ARM64 build pool; ready_for_review restores the deferred builds on the unchanged head, and the same run owns the required build-images-status context',
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

// The two static-analysis lanes carry no required status context, so they may
// skip a class that cannot change analyzed source. Each still has to analyze a
// push, a scheduled run, and every class it cannot prove.
const STATIC_ANALYSIS_LANES = new Map([
  ['codeql-analysis.yml', 'analyze'],
  ['v3_sonarcloud.yml', 'sonarcloud'],
])

test('static analysis narrows only for a proven pull-request class', () => {
  for (const [name, jobName] of STATIC_ANALYSIS_LANES) {
    const workflow = readWorkflow(name)
    const classify = workflow.jobs.classify
    assert.ok(
      classify,
      name + ' must classify the change before deciding to analyze it'
    )
    assert.equal(
      classify.steps.find((step) => step.id === 'classify').uses,
      './.github/actions/change-envelope',
      name
    )

    const gate = workflow.jobs[jobName].if
    assert.match(
      String(gate),
      /needs\.classify\.outputs\.static_analysis/,
      name
    )

    const draftPr = {
      event_name: 'pull_request',
      event: { pull_request: { draft: false } },
    }
    const push = { event_name: 'push', ref_name: 'v3' }
    const schedule = { event_name: 'schedule' }
    const output = (value) => ({
      classify: { outputs: { static_analysis: value } },
    })
    // A job that failed or produced nothing reports empty outputs, which must
    // read as "analyze" rather than as a proven skip.
    const unproven = { classify: { outputs: {} } }

    for (const [context, needs, expected, label] of [
      [draftPr, output('skip'), false, 'a skipped pull-request class'],
      [draftPr, output('run'), true, 'a run class'],
      [draftPr, output(''), true, 'an empty class'],
      [draftPr, unproven, true, 'an unproven classification'],
      [push, output('skip'), true, 'a push'],
      [schedule, output('skip'), true, 'the scheduled run'],
    ]) {
      assert.equal(
        evaluateGate(gate, context, needs),
        expected,
        name + ' with ' + label
      )
    }
  }
})

// The pull-request analysis used to be one runner-held job that polled the
// coverage producers, so an analysis runner waited while a queued test run
// finished. The producer run that observes every producer terminal now owns the
// analysis, so the workflow that runs too early releases its runner instead.
const PRODUCER_HOSTED_ANALYSIS = new Map([
  ['test-unit.yml', 'test-unit'],
  ['test-graphql.yml', 'test-graphql'],
])

function sameRepositoryPullRequest(overrides) {
  return {
    event_name: 'pull_request',
    actor: 'rschlaefli',
    repository: 'uzh-bf/klicker-uzh',
    event: {
      pull_request: {
        draft: true,
        head: { repo: { full_name: 'uzh-bf/klicker-uzh' } },
      },
    },
    ...overrides,
  }
}

test('the producer-hosted analysis runs for a same-repository pull request only', () => {
  for (const [name, suite] of PRODUCER_HOSTED_ANALYSIS) {
    const workflow = readWorkflow(name)
    const job = workflow.jobs.sonarcloud
    assert.ok(job, name + ' must analyze the coverage it just produced')
    assert.equal(job.uses, './.github/workflows/sonar-analysis.yml', name)
    assert.deepEqual(job.needs, ['filter', suite], name)

    // A draft is admitted here and deferred inside the analysis, because the
    // job is evaluated minutes after its event, when the pull request may
    // already be ready for review.
    const gate = String(job.if)
    assert.equal(
      evaluateGate(gate, sameRepositoryPullRequest()),
      true,
      name + ' for a same-repository draft pull request'
    )
    assert.equal(
      evaluateGate(
        gate,
        sameRepositoryPullRequest({
          event: {
            pull_request: {
              draft: false,
              head: { repo: { full_name: 'fork/x' } },
            },
          },
        })
      ),
      false,
      name + ' for a fork pull request, which receives no secrets'
    )
    assert.equal(
      evaluateGate(
        gate,
        sameRepositoryPullRequest({ actor: 'dependabot[bot]' })
      ),
      false,
      name + ' for a Dependabot pull request'
    )
    assert.equal(
      evaluateGate(gate, sameRepositoryPullRequest({ event_name: 'push' })),
      false,
      name + ' for a push, which the branch boundary analyzes'
    )
  }
})

test('one reusable workflow owns the analysis decision', () => {
  const analysis = readWorkflow('sonar-analysis.yml')
  assert.ok(
    analysis.on && analysis.on.workflow_call !== undefined,
    'sonar-analysis.yml must stay reusable so every host shares one definition'
  )

  const steps = analysis.jobs.sonarcloud.steps
  const decide = steps.find((step) => step.id === 'coverage')
  assert.ok(decide, 'the analysis must decide before it scans')
  assert.deepEqual(
    String(decide.env.COVERAGE_PRODUCER_WORKFLOWS)
      .split(',')
      .map((entry) => entry.trim())
      .sort(),
    ['.github/workflows/test-graphql.yml', '.github/workflows/test-unit.yml'],
    'the decision must know every coverage producer'
  )
  assert.deepEqual(
    String(decide.env.ANALYSIS_WORKFLOW_FILES)
      .split(',')
      .map((entry) => entry.trim())
      .sort(),
    [
      '.github/workflows/test-graphql.yml',
      '.github/workflows/test-unit.yml',
      '.github/workflows/v3_sonarcloud.yml',
    ],
    'every host of the analysis must be listed, or a receipt stays invisible to the others'
  )

  const scan = steps.find((step) => step.id === 'scan')
  assert.equal(scan.if, "steps.coverage.outputs.decision == 'scan'")
  assert.match(String(scan.with.args), /steps\.coverage\.outputs\.scanner_args/)

  // The receipt is published only after a scan that succeeded, because only a
  // published analysis may suppress the analysis of another producer.
  const receipt = steps.find(
    (step) => step.uses === 'actions/upload-artifact@v4'
  )
  assert.match(
    String(receipt.if),
    /steps\.coverage\.outputs\.decision == 'scan'/
  )
  assert.match(String(receipt.if), /steps\.scan\.outcome == 'success'/)
  assert.match(
    String(receipt.with.name),
    /steps\.coverage\.outputs\.receipt_name/
  )
})

test('the branch and ready boundary keeps the analysis without a producer', () => {
  const workflow = readWorkflow('v3_sonarcloud.yml')
  assert.deepEqual(workflow.on.push.branches, ['v3', 'v3*'])
  assert.deepEqual(
    workflow.on.pull_request.types,
    ['ready_for_review'],
    'a synchronize and a reopen re-run both producers, so the boundary must not duplicate them'
  )
  const job = workflow.jobs.sonarcloud
  assert.equal(job.needs, 'classify')
  assert.equal(job.uses, './.github/workflows/sonar-analysis.yml')
})

test('no workflow holds a runner while it waits for a coverage producer', () => {
  const directory = path.join(root, '.github')
  const offenders = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(candidate)
        continue
      }
      if (!entry.name.endsWith('.yml') && !entry.name.endsWith('.cjs')) return
      if (
        /COVERAGE_(WAIT|POLL)_SECONDS/.test(fs.readFileSync(candidate, 'utf8'))
      ) {
        offenders.push(path.relative(directory, candidate))
      }
    }
  }
  walk(directory)
  assert.deepEqual(
    offenders,
    [],
    'a coverage wait window holds a runner while a queued test run finishes'
  )
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

// The application-wide steps of the codebase check run in full unless the
// classifier proved a bounded class for a pull request. The gate is written so
// that an absent, unknown, or failed classification leaves the full suite: the
// envelope is an efficiency input, and its failure mode must be the validation
// that ran before the envelope existed.
const BOUNDED_CODEBASE_STEPS = [
  'Build packages for typecheck (turbo)',
  'Check Prisma schema sync drift',
  'Check linting',
  'Check linting (Biome, advisory)',
  'Check typescript types',
  'Check unused code and dependencies (knip, advisory)',
]

// GitHub resolves a missing step or output to an empty string. Modelling that
// lets the test prove the gate fails open even when the classification step no
// longer exists.
const MISSING_STEP_OUTPUTS = new Proxy(
  {},
  { get: () => ({ outputs: new Proxy({}, { get: () => '' }) }) }
)

test('the bounded codebase check narrows only for a proven pull-request class', () => {
  const workflow = readWorkflow('check.yml')
  const suite = workflow.jobs['check-suite']
  // The narrowing gates run unless the class is the bounded decision; the
  // announcement step names the same decision from the other side.
  const gated = suite.steps.filter((step) =>
    /steps\.classify\.outputs\.codebase_check != 'bounded'/.test(
      String(step.if ?? '')
    )
  )

  assert.deepEqual(
    gated.map((step) => step.name).sort(),
    [...BOUNDED_CODEBASE_STEPS].sort(),
    'every application-wide step of the codebase check must carry the class gate'
  )

  const pullRequest = { event_name: 'pull_request' }
  const push = { event_name: 'push' }
  const classOutput = (value) => ({
    classify: { outputs: { codebase_check: value } },
  })

  for (const step of gated) {
    for (const [context, steps, expected] of [
      ['a missing classification step', MISSING_STEP_OUTPUTS, true],
      ['an empty class output', classOutput(''), true],
      ['the full decision', classOutput('full'), true],
      ['the bounded decision', classOutput('bounded'), false],
    ]) {
      assert.equal(
        evaluateGate(step.if, pullRequest, {}, false, {}, steps),
        expected,
        step.name + ' with ' + context
      )
    }
    // A push validates a deployment candidate, so the class never narrows it.
    assert.equal(
      evaluateGate(step.if, push, {}, false, {}, classOutput('bounded')),
      true,
      step.name + ' on a push'
    )
  }

  const classify = suite.steps.find((step) => step.id === 'classify')
  assert.ok(classify, 'the suite must classify the changed paths')
  assert.equal(classify.uses, './.github/actions/change-envelope')
  assert.equal(
    classify.with['receipt-path'],
    'minimum-validation-classification.json'
  )

  // The envelope adapter owns the records and the fail-open policy, so a lane
  // cannot classify a different diff or turn a helper error into a blocked
  // required context.
  const envelope = YAML.parse(
    fs.readFileSync(
      path.join(root, '.github/actions/change-envelope/action.yml'),
      'utf8'
    )
  )
  const records = envelope.runs.steps.find((step) => step.id === 'records')
  assert.equal(records.uses, './.github/actions/changed-paths')
  assert.equal(records.with.pattern, '.')
  const classifyScript = envelope.runs.steps.find(
    (step) => step.id === 'classify'
  ).run
  assert.match(classifyScript, /minimum-validation-class\.cjs/)
  assert.match(classifyScript, /name-status-z/)
  assert.match(classifyScript, /::warning::/)
  assert.doesNotMatch(classifyScript, /exit 1/)
  // Every decision a lane reads has to be declared as an action output.
  assert.deepEqual(Object.keys(envelope.outputs).sort(), [
    'change_class',
    'change_class_reason',
    'changed_path_count',
    'codebase_check',
    'playwright',
    'static_analysis',
  ])

  const receipt = suite.steps.find(
    (step) => step.uses === 'actions/upload-artifact@v4'
  )
  assert.equal(receipt.with.name, 'minimum-validation-classification')

  const announcement = suite.steps.find(
    (step) => step.name === 'Report the bounded codebase check'
  )
  assert.equal(
    evaluateGate(
      announcement.if,
      pullRequest,
      {},
      false,
      {},
      classOutput('bounded')
    ),
    true
  )
  assert.equal(
    evaluateGate(
      announcement.if,
      pullRequest,
      {},
      false,
      {},
      MISSING_STEP_OUTPUTS
    ),
    false,
    'the bounded announcement must never claim a class that was not proven'
  )
})
