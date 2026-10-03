const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')
const { acceptsEvent, maintainDraftSyncPrs } = require('./draft-sync-prs.cjs')

const repository = 'uzh-bf/klicker-uzh'
const context = {
  repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
  ref: 'refs/heads/v3',
  eventName: 'workflow_run',
  payload: {
    action: 'completed',
    workflow_run: {
      name: 'Check codebase',
      event: 'push',
      head_branch: 'v3-ai',
      head_repository: { full_name: repository },
      conclusion: 'failure',
    },
  },
}

function fixture({ ahead = 1, files = [{}], createError, race = false } = {}) {
  const prs = []
  const creates = []
  const comparisons = []
  const github = {
    paginate: async (_, { head, base }) =>
      prs.filter(
        (pr) => `uzh-bf:${pr.head.ref}` === head && pr.base.ref === base
      ),
    rest: {
      pulls: {
        list() {},
        async create(input) {
          creates.push(input)
          const pr = {
            number: prs.length + 1,
            draft: input.draft,
            head: { ref: input.head, repo: { full_name: repository } },
            base: { ref: input.base, repo: { full_name: repository } },
          }
          if (!createError || race) prs.push(pr)
          if (createError) throw createError
          return { data: pr }
        },
      },
      repos: {
        async compareCommitsWithBasehead(input) {
          comparisons.push(input)
          return { data: { ahead_by: ahead, files } }
        },
      },
    },
  }
  return { github, prs, creates, comparisons }
}

test('creates only the two forward pairs as drafts and preserves ready PRs on rerun', async () => {
  const state = fixture()
  const first = await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.deepEqual(
    first.map(({ head, base }) => [head, base]),
    [
      ['v3', 'v3-ai'],
      ['v3-ai', 'v3-audit'],
    ]
  )
  assert.ok(state.creates.every((pr) => pr.draft === true))
  state.prs[0].draft = false
  const second = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.ok(second.every(({ action }) => action === 'existing'))
  assert.equal(state.creates.length, 2)
  assert.equal(state.comparisons.length, 2)
  assert.equal(state.prs[0].draft, false)
})

test('default preview reads live comparisons without writing', async () => {
  const state = fixture()
  const results = await maintainDraftSyncPrs({ ...state, context })
  assert.ok(results.every(({ action }) => action === 'would-create'))
  assert.equal(state.creates.length, 0)
  assert.deepEqual(
    state.comparisons.map(({ basehead }) => basehead),
    ['v3-ai...v3', 'v3-audit...v3-ai']
  )
})

test('already integrated and empty changes do not open PRs', async () => {
  for (const options of [{ ahead: 0 }, { files: [] }]) {
    const state = fixture(options)
    const results = await maintainDraftSyncPrs({
      ...state,
      context,
      dryRun: false,
    })
    assert.ok(results.every(({ action }) => action === 'up-to-date'))
    assert.equal(state.creates.length, 0)
  }
})

test('recovers a creation race but propagates permission and validation errors', async () => {
  const conflict = Object.assign(new Error('validation'), { status: 422 })
  const state = fixture({ createError: conflict, race: true })
  const results = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.ok(results.every(({ action }) => action === 'existing'))
  for (const status of [403, 422, 500]) {
    const error = Object.assign(new Error('API failure'), { status })
    await assert.rejects(
      maintainDraftSyncPrs({
        ...fixture({ createError: error }),
        context,
        dryRun: false,
      }),
      (caught) => caught === error
    )
  }
})

test('ignores same-named fork PRs', async () => {
  const state = fixture()
  state.prs.push({
    head: { ref: 'v3', repo: { full_name: 'someone/klicker-uzh' } },
    base: { ref: 'v3-ai', repo: { full_name: repository } },
  })
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.equal(state.creates.length, 2)
})

test('only trusted manual and allowlisted source push completions can write', async () => {
  assert.equal(acceptsEvent(context), true)
  assert.equal(
    acceptsEvent({ ...context, eventName: 'workflow_dispatch' }),
    true
  )
  assert.equal(
    acceptsEvent({
      ...context,
      payload: {
        ...context.payload,
        workflow_run: { ...context.payload.workflow_run, head_branch: 'v3' },
      },
    }),
    true
  )
  const denied = [
    { ...context, ref: 'refs/heads/topic' },
    { ...context, repo: { owner: 'someone', repo: 'klicker-uzh' } },
    { ...context, eventName: 'pull_request' },
    ...[
      { event: 'pull_request' },
      { head_branch: 'v3-audit' },
      { head_branch: 'v3-new' },
      { name: 'Unrelated workflow' },
      { head_repository: { full_name: 'someone/klicker-uzh' } },
    ].map((override) => ({
      ...context,
      payload: {
        ...context.payload,
        workflow_run: { ...context.payload.workflow_run, ...override },
      },
    })),
  ]
  for (const event of denied) {
    // Any API call on a rejected event would fail against this empty client.
    assert.deepEqual(
      await maintainDraftSyncPrs({ github: {}, context: event, dryRun: false }),
      []
    )
  }
})

test('workflow keeps write access on trusted controller code with read-only checkout', () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/maintain-draft-sync-prs.yml'),
      'utf8'
    )
  )
  assert.deepEqual(workflow.on.workflow_run.branches, ['v3', 'v3-ai'])
  assert.deepEqual(workflow.on.workflow_run.types, ['completed'])
  assert.equal(workflow.on.workflow_dispatch.inputs.dry_run.default, true)
  assert.equal(workflow.concurrency['cancel-in-progress'], false)
  assert.deepEqual(workflow.jobs.maintain.permissions, {
    contents: 'read',
    'pull-requests': 'write',
  })
  const checkout = workflow.jobs.maintain.steps[0]
  assert.equal(checkout.with.ref, `\${{ github.workflow_sha }}`)
  assert.equal(checkout.with['persist-credentials'], false)
})

test('workflow entrypoint creates drafts on automatic runs and previews manual dispatch by default', async () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/maintain-draft-sync-prs.yml'),
      'utf8'
    )
  )
  const step = workflow.jobs.maintain.steps[1]
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  // Evaluate only the checked-in controller wiring against synthetic inputs.
  const entrypoint = new AsyncFunction(
    'github',
    'context',
    'core',
    'process',
    'require',
    step.with.script
  )
  const evaluateDryRun = new Function(
    'github',
    'inputs',
    `return (${step.env.DRY_RUN.slice(3, -2)})`
  )
  for (const [eventName, input, expectedCreates] of [
    ['workflow_run', undefined, 2],
    ['workflow_dispatch', true, 0],
    ['workflow_dispatch', false, 2],
  ]) {
    const state = fixture()
    await entrypoint(
      state.github,
      { ...context, eventName },
      { info() {} },
      {
        env: {
          DRY_RUN: String(
            evaluateDryRun({ event_name: eventName }, { dry_run: input })
          ),
        },
      },
      () => ({ maintainDraftSyncPrs })
    )
    assert.equal(state.creates.length, expectedCreates)
    assert.ok(state.creates.every(({ draft }) => draft === true))
  }
})
