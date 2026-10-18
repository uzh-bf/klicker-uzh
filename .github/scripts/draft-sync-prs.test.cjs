const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')
const {
  PAIRS,
  acceptsEvent,
  maintainDraftSyncPrs,
  syncBranch,
  syncBranchPrefix,
} = require('./draft-sync-prs.cjs')

const repository = 'uzh-bf/klicker-uzh'
const sourceTip = 'a'.repeat(40)
const integrationTip = 'b'.repeat(40)
const nextSource = 'c'.repeat(40)
const nextIntegration = 'd'.repeat(40)
const laterSource = 'e'.repeat(40)
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

function fixture({
  ahead = 1,
  files = [{}],
  createError,
  race = false,
  status = 'ahead',
  mergeError,
} = {}) {
  const prs = []
  const creates = []
  const comparisons = []
  const refs = new Map()
  const refWrites = []
  const merges = []
  const sources = {
    v3: sourceTip,
    'v3-ai': integrationTip,
    'v3-audit': 'audit-tip',
    'v3-adaptive-learning': 'adaptive-tip',
  }
  const comments = []
  const control = { mergeError }
  const updates = []
  const descriptions = []
  let closes = 0
  const changelogFactory = () => ({
    async generate(snapshots) {
      descriptions.push(snapshots)
      await control.onGenerate?.(snapshots)
      if (control.analysisFailure?.(snapshots))
        throw new Error('synthetic-analysis-diagnostic')
      return { body: JSON.stringify(snapshots) }
    },
    close() {
      closes++
    },
  })
  const github = {
    paginate: async (method, { base, issue_number }) =>
      method === github.rest.issues.listComments
        ? comments.filter((comment) => comment.issue_number === issue_number)
        : prs
            .filter((pr) => pr.base.ref === base && pr.state !== 'closed')
            .map((pr) => ({
              ...pr,
              head: { ...pr.head, sha: refs.get(pr.head.ref) ?? pr.head.sha },
              base: { ...pr.base, sha: sources[pr.base.ref] ?? pr.base.sha },
            })),
    rest: {
      git: {
        async createRef({ ref, sha }) {
          const name = ref.replace('refs/heads/', '')
          if (refs.has(name)) {
            throw Object.assign(new Error('Reference already exists'), {
              status: 422,
            })
          }
          refs.set(name, sha)
          refWrites.push({ op: 'create', name, sha })
        },
        async getRef({ ref }) {
          const branch = ref.replace('heads/', '')
          return {
            data: { object: { sha: refs.get(branch) ?? sources[branch] } },
          }
        },
        async updateRef({ ref, sha, force }) {
          const name = ref.replace('heads/', '')
          refs.set(name, sha)
          refWrites.push({ op: 'update', name, sha, force })
        },
      },
      users: {
        async getAuthenticated() {
          return { data: { login: 'sync-bot' } }
        },
      },
      issues: {
        listComments() {},
        async createComment({ issue_number, body }) {
          const id = comments.length + 1
          comments.push({ id, issue_number, body, user: { login: 'sync-bot' } })
        },
        async updateComment({ comment_id, body }) {
          comments.find(({ id }) => id === comment_id).body = body
        },
        async deleteComment({ comment_id }) {
          comments.splice(
            comments.findIndex(({ id }) => id === comment_id),
            1
          )
        },
      },
      pulls: {
        list() {},
        async get({ pull_number }) {
          const pr = prs.find(({ number }) => number === pull_number)
          return {
            data: structuredClone({
              ...pr,
              head: {
                ...pr.head,
                sha: control.prHeadSha ?? refs.get(pr.head.ref) ?? pr.head.sha,
              },
              base: {
                ...pr.base,
                sha: control.prBaseSha ?? sources[pr.base.ref] ?? pr.base.sha,
              },
            }),
          }
        },
        async update(input) {
          updates.push(input)
          prs.find(({ number }) => number === input.pull_number).body =
            input.body
        },
        async create(input) {
          creates.push(input)
          const pr = {
            number: prs.length + 1,
            state: 'open',
            draft: input.draft,
            body: input.body,
            head: {
              ref: input.head,
              sha: refs.get(input.head),
              repo: { full_name: repository },
            },
            base: {
              ref: input.base,
              sha: sources[input.base],
              repo: { full_name: repository },
            },
          }
          if (!createError || race) prs.push(pr)
          control.onCreate?.(pr)
          if (createError) throw createError
          return { data: pr }
        },
      },
      repos: {
        async getBranch({ branch }) {
          return {
            data: { commit: { sha: refs.get(branch) ?? sources[branch] } },
          }
        },
        async compareCommitsWithBasehead(input) {
          comparisons.push(input)
          return { data: { ahead_by: ahead, files, status } }
        },
        async merge(input) {
          merges.push(input)
          if (control.mergeError) throw control.mergeError
          refs.set(input.base, `merged-${input.head}`)
        },
      },
    },
  }
  return {
    github,
    prs,
    creates,
    comparisons,
    refs,
    refWrites,
    merges,
    sources,
    comments,
    control,
    updates,
    descriptions,
    changelogFactory,
    get closes() {
      return closes
    },
  }
}

test('creates only the three forward pairs as drafts and preserves ready PRs on rerun', async () => {
  const state = fixture()
  const first = await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.deepEqual(
    first.map(({ head, base }) => [head, base]),
    [
      ['v3', 'v3-ai'],
      ['v3-ai', 'v3-audit'],
      ['v3-ai', 'v3-adaptive-learning'],
    ]
  )
  assert.ok(state.creates.every((pr) => pr.draft === true))
  // Every PR head is a bot-owned sync branch, never the long-lived source.
  assert.deepEqual(
    state.creates.map(({ head }) => head),
    [
      'sync/v3-into-v3-ai-aaaaaaaaaa',
      'sync/v3-ai-into-v3-audit-bbbbbbbbbb',
      'sync/v3-ai-into-v3-adaptive-learning-bbbbbbbbbb',
    ]
  )
  assert.equal(state.refs.get('sync/v3-into-v3-ai-aaaaaaaaaa'), sourceTip)
  state.prs[0].draft = false
  const second = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.ok(second.every(({ action }) => action === 'existing'))
  assert.equal(state.creates.length, 3)
  assert.equal(state.comparisons.length, 3)
  assert.equal(state.prs[0].draft, false)
  assert.equal(state.updates.length, 0)
  assert.equal(state.closes, 2)
})

test('default preview reads live comparisons without writing', async () => {
  const state = fixture()
  const results = await maintainDraftSyncPrs({ ...state, context })
  assert.ok(results.every(({ action }) => action === 'would-create'))
  assert.equal(state.creates.length, 0)
  assert.deepEqual(
    state.comparisons.map(({ basehead }) => basehead),
    [
      `v3-ai...${sourceTip}`,
      `v3-audit...${integrationTip}`,
      `v3-adaptive-learning...${integrationTip}`,
    ]
  )
  assert.equal(state.refWrites.length, 0)
})

test('advances an open sync head without ever writing the source branch', async () => {
  for (const [status, expected] of [
    ['ahead', 'advanced'],
    ['diverged', 'merged-source'],
    ['behind', 'existing'],
  ]) {
    const state = fixture({ status })
    await maintainDraftSyncPrs({ ...state, context, dryRun: false })
    state.sources.v3 = nextSource
    state.sources['v3-ai'] = nextIntegration
    state.refWrites.length = 0
    const results = await maintainDraftSyncPrs({
      ...state,
      context,
      dryRun: false,
    })
    assert.ok(results.every(({ action }) => action === expected))
    assert.deepEqual(
      state.descriptions.slice(-3).map(({ headSha }) => headSha),
      state.prs.map(({ head }) => state.refs.get(head.ref))
    )
    const written = [
      ...state.refWrites.map(({ name }) => name),
      ...state.merges.map(({ base }) => base),
    ]
    assert.ok(written.every((name) => name.startsWith('sync/')))
    // A maintainer's resolution on a diverged head is merged into, not reset.
    assert.ok(state.refWrites.every(({ force }) => force === false))
  }
})

test('reports a conflicting source merge for maintainers to resolve', async () => {
  const state = fixture({
    status: 'diverged',
    mergeError: Object.assign(new Error('conflict'), { status: 409 }),
  })
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  state.sources.v3 = nextSource
  const results = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.equal(results[0].action, 'conflict')
  // One visible notice per PR, refreshed for the newest blocked source commit.
  const notices = () =>
    state.comments.filter(({ issue_number }) => issue_number === 1)
  state.comments.push({
    id: 99,
    issue_number: 1,
    body: '<!-- sync-pr-source-conflict --> forged',
    user: { login: 'someone' },
  })
  state.sources.v3 = laterSource
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.equal(notices().length, 2)
  assert.ok(notices()[0].body.includes(laterSource))
  // Once the source merges again, only the bot's notice is removed.
  state.control.mergeError = undefined
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.deepEqual(
    notices().map(({ id }) => id),
    [99]
  )
})

test('regenerates controller-owned bodies and the synchronize bounce makes no further writes', async () => {
  const state = fixture()
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  state.prs[0].body = JSON.stringify({ manual: true })
  state.prs[0].draft = false
  state.sources.v3 = nextSource
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.equal(JSON.parse(state.prs[0].body).headSha, nextSource)
  assert.equal(state.prs[0].draft, false)
  assert.deepEqual(Object.keys(state.updates[0]).sort(), [
    'body',
    'owner',
    'pull_number',
    'repo',
  ])
  state.updates.length = 0
  state.refWrites.length = 0
  state.merges.length = 0
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.equal(state.updates.length, 0)
  assert.equal(state.refWrites.length, 0)
  assert.equal(state.merges.length, 0)
  assert.equal(state.creates.length, 3)
})

test('uses stable canonical refs when PR revision metadata lags an advanced head or target', async () => {
  const state = fixture()
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  state.sources.v3 = nextSource
  state.sources['v3-ai'] = nextIntegration
  state.control.prHeadSha = sourceTip
  state.control.prBaseSha = integrationTip
  state.prs[0].draft = false
  const results = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.equal(results[0].description, 'updated')
  assert.deepEqual(JSON.parse(state.prs[0].body), {
    sourceSha: nextSource,
    headSha: nextSource,
    targetSha: nextIntegration,
  })
  assert.equal(state.prs[0].draft, false)
  state.updates.length = 0
  const bounce = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.equal(bounce[0].description, 'unchanged')
  assert.equal(state.updates.length, 0)
})

test('defers body writes when the analyzed PR closes, moves, retargets or changes repository', async () => {
  for (const [reason, mutate] of [
    [
      'pr-identity-changed',
      (state) => {
        state.prs[0].state = 'closed'
      },
    ],
    [
      'pr-identity-changed',
      (state) => {
        state.prs[0].base.ref = 'v3-audit'
      },
    ],
    [
      'pr-identity-changed',
      (state) => {
        state.prs[0].head.ref = 'sync/v3-into-v3-ai-ffffffff00'
      },
    ],
    [
      'head-ref-moved',
      (state) => {
        state.refs.set(state.prs[0].head.ref, 'moved-head')
      },
    ],
    [
      'target-ref-moved',
      (state) => {
        state.sources['v3-ai'] = 'moved-target'
      },
    ],
    [
      'pr-identity-changed',
      (state) => {
        state.prs[0].head.repo.full_name = 'someone/klicker-uzh'
      },
    ],
    [
      'pr-identity-changed',
      (state) => {
        state.prs[0].base.repo.full_name = 'someone/klicker-uzh'
      },
    ],
  ]) {
    const state = fixture()
    await maintainDraftSyncPrs({ ...state, context, dryRun: false })
    const original = state.prs[0].body
    state.control.prHeadSha = state.refs.get(state.prs[0].head.ref)
    state.control.prBaseSha = state.sources['v3-ai']
    state.control.onGenerate = () => {
      state.control.onGenerate = undefined
      mutate(state)
    }
    const results = await maintainDraftSyncPrs({
      ...state,
      context,
      dryRun: false,
    })
    assert.equal(results[0].description, 'deferred')
    assert.equal(results[0].reason, reason)
    assert.equal(state.prs[0].body, original)
    assert.ok(state.updates.every(({ pull_number }) => pull_number !== 1))
  }
})

test('revalidates new-PR snapshots and refreshes duplicate-create candidates', async () => {
  const moved = fixture()
  moved.control.onGenerate = () => {
    moved.control.onGenerate = undefined
    moved.sources['v3-ai'] = 'moved-target'
  }
  const deferred = await maintainDraftSyncPrs({
    ...moved,
    context,
    dryRun: false,
  })
  assert.equal(deferred[0].action, 'stale-description')
  assert.ok(moved.creates.every(({ base }) => base !== 'v3-ai'))
  assert.ok(
    moved.refWrites.every(({ name }) => !name.startsWith('sync/v3-into-v3-ai-'))
  )

  const raced = fixture({
    createError: Object.assign(new Error('duplicate'), { status: 422 }),
    race: true,
  })
  raced.control.onCreate = (pr) => {
    pr.body = JSON.stringify({ stale: true })
  }
  const results = await maintainDraftSyncPrs({
    ...raced,
    context,
    dryRun: false,
  })
  assert.ok(results.every(({ description }) => description === 'updated'))
  assert.equal(raced.updates.length, 3)
  assert.deepEqual(
    raced.prs.map(({ body }) => JSON.parse(body).headSha),
    raced.prs.map(({ head }) => raced.refs.get(head.ref))
  )
})

test('description failures preserve branch reconciliation and other pairs without publishing placeholders', async () => {
  for (const conflict of [false, true]) {
    const state = fixture({
      status: conflict ? 'diverged' : 'ahead',
      mergeError: conflict
        ? Object.assign(new Error('conflict'), { status: 409 })
        : undefined,
    })
    await maintainDraftSyncPrs({ ...state, context, dryRun: false })
    const original = state.prs[0].body
    state.sources.v3 = nextSource
    state.control.analysisFailure = ({ sourceSha }) => sourceSha === nextSource
    const results = await maintainDraftSyncPrs({
      ...state,
      context,
      dryRun: false,
    })
    assert.equal(results[0].action, conflict ? 'conflict' : 'advanced')
    assert.equal(results[0].description, 'error')
    assert.equal(state.prs[0].body, original)
    assert.ok(
      results.slice(1).every(({ description }) => description === 'unchanged')
    )
    assert.equal(state.comments.length, conflict ? 1 : 0)
    assert.equal(state.closes, 2)
  }
  const fresh = fixture()
  fresh.control.analysisFailure = ({ sourceSha }) => sourceSha === sourceTip
  const results = await maintainDraftSyncPrs({
    ...fresh,
    context,
    dryRun: false,
  })
  assert.equal(results[0].action, 'description-error')
  assert.ok(fresh.creates.every(({ base }) => base !== 'v3-ai'))
  assert.equal(fresh.creates.length, 2)
})

test('existing-PR previews describe the actual head and perform no writes', async () => {
  const state = fixture()
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  state.sources.v3 = nextSource
  state.refWrites.length = 0
  const results = await maintainDraftSyncPrs({ ...state, context })
  assert.equal(JSON.parse(results[0].body).headSha, sourceTip)
  assert.equal(JSON.parse(results[0].body).sourceSha, nextSource)
  assert.equal(state.refWrites.length, 0)
  assert.equal(state.updates.length, 0)
  assert.equal(state.comments.length, 0)
  assert.equal(state.merges.length, 0)
})

test('leaves pull requests headed by the source branch itself untouched', async () => {
  const state = fixture()
  state.prs.push({
    number: 99,
    head: { ref: 'v3-ai', repo: { full_name: repository } },
    base: { ref: 'v3-audit', repo: { full_name: repository } },
  })
  const results = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.deepEqual(results[1], {
    head: 'v3-ai',
    base: 'v3-audit',
    branch: 'v3-ai',
    action: 'legacy',
    number: 99,
  })
  assert.deepEqual(
    state.creates.map(({ head }) => head),
    [
      syncBranch({ head: 'v3', base: 'v3-ai' }, sourceTip),
      syncBranch(
        { head: 'v3-ai', base: 'v3-adaptive-learning' },
        integrationTip
      ),
    ]
  )
})

test('never overwrites a leftover sync branch at another commit', async () => {
  const state = fixture()
  state.refs.set('sync/v3-into-v3-ai-aaaaaaaaaa', 'someone-else')
  const results = await maintainDraftSyncPrs({
    ...state,
    context,
    dryRun: false,
  })
  assert.equal(results[0].action, 'stale-branch')
  assert.equal(state.refs.get('sync/v3-into-v3-ai-aaaaaaaaaa'), 'someone-else')
  assert.deepEqual(
    state.creates.map(({ head }) => head),
    [
      'sync/v3-ai-into-v3-audit-bbbbbbbbbb',
      'sync/v3-ai-into-v3-adaptive-learning-bbbbbbbbbb',
    ]
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

test('ignores same-named fork PRs and lookalike human branches', async () => {
  const state = fixture()
  state.prs.push({
    head: {
      ref: 'sync/v3-into-v3-ai-aaaaaaaaaa',
      repo: { full_name: 'someone/klicker-uzh' },
    },
    base: { ref: 'v3-ai', repo: { full_name: repository } },
  })
  const human = {
    number: 99,
    state: 'open',
    body: JSON.stringify({ manual: true }),
    head: {
      ref: 'sync/v3-into-v3-ai-hotfix',
      sha: sourceTip,
      repo: { full_name: repository },
    },
    base: { ref: 'v3-ai', repo: { full_name: repository } },
  }
  state.prs.push(human)
  await maintainDraftSyncPrs({ ...state, context, dryRun: false })
  assert.equal(state.creates.length, 3)
  assert.deepEqual(JSON.parse(human.body), { manual: true })
  assert.ok(state.refWrites.every(({ name }) => name !== human.head.ref))
  assert.ok(state.merges.every(({ base }) => base !== human.head.ref))
  assert.ok(
    state.updates.every(({ pull_number }) => pull_number !== human.number)
  )
})

test('only trusted branch push and maintained sync PR completions can write', async () => {
  assert.equal(acceptsEvent(context), true)
  assert.equal(
    acceptsEvent({ ...context, eventName: 'workflow_dispatch' }),
    true
  )
  for (const [event, head_branch] of [
    ['push', 'v3-audit'],
    ['push', 'v3-adaptive-learning'],
    ['pull_request', 'sync/v3-into-v3-ai-0123456789'],
    ['pull_request', 'sync/v3-ai-into-v3-audit-0123456789'],
    ['pull_request', 'sync/v3-ai-into-v3-adaptive-learning-0123456789'],
  ]) {
    assert.equal(
      acceptsEvent({
        ...context,
        payload: {
          ...context.payload,
          workflow_run: { ...context.payload.workflow_run, event, head_branch },
        },
      }),
      true
    )
  }
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
      { head_branch: 'v3-new' },
      {
        event: 'pull_request',
        head_branch: 'sync/v3-ai-into-v3-audit-invalid',
      },
      {
        event: 'pull_request_target',
        head_branch: 'sync/v3-into-v3-ai-0123456789',
      },
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
  const expectedBranches = [
    ...new Set(PAIRS.flatMap(({ head, base }) => [head, base])),
    ...PAIRS.map((pair) => `${syncBranchPrefix(pair)}*`),
  ]
  assert.deepEqual(workflow.on.workflow_run.branches, expectedBranches)
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
  assert.equal(checkout.with['sparse-checkout-cone-mode'], false)
  assert.deepEqual(checkout.with['sparse-checkout'].trim().split('\n'), [
    '/.github/scripts/',
    '/.versionrc.js',
  ])
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
  for (const [eventName, input, expectedCreates, scenario] of [
    ['workflow_run', undefined, 3],
    ['workflow_dispatch', true, 0],
    ['workflow_dispatch', false, 3],
    ['workflow_run', undefined, 2, 'analysis-failure'],
    ['workflow_run', undefined, 2, 'target-moved'],
  ]) {
    const state = fixture()
    const failures = []
    const logs = []
    if (scenario === 'analysis-failure') {
      state.control.analysisFailure = ({ sourceSha }) => sourceSha === sourceTip
    }
    if (scenario === 'target-moved') {
      state.control.onGenerate = () => {
        state.control.onGenerate = undefined
        state.sources['v3-ai'] = 'moved-target'
      }
    }
    await entrypoint(
      state.github,
      { ...context, eventName },
      {
        info: (message) => logs.push(JSON.parse(message)),
        warning() {},
        setFailed: (message) => failures.push(message),
        summary: {
          addHeading() {
            return this
          },
          addTable() {
            return this
          },
          addRaw() {
            return this
          },
          addEOL() {
            return this
          },
          async write() {},
        },
      },
      {
        env: {
          DRY_RUN: String(
            evaluateDryRun({ event_name: eventName }, { dry_run: input })
          ),
          HAS_SYNC_TOKEN: 'true',
        },
      },
      () => ({
        maintainDraftSyncPrs: (input) =>
          maintainDraftSyncPrs({
            ...input,
            changelogFactory: state.changelogFactory,
          }),
      })
    )
    assert.equal(state.creates.length, expectedCreates)
    assert.ok(state.creates.every(({ draft }) => draft === true))
    assert.equal(failures.length, scenario === 'analysis-failure' ? 1 : 0)
    assert.equal(logs.length, PAIRS.length)
    if (scenario === 'analysis-failure') {
      assert.equal(logs[0].description, 'error')
      assert.ok(
        !JSON.stringify({ logs, failures }).includes(
          'synthetic-analysis-diagnostic'
        )
      )
    } else if (scenario === 'target-moved') {
      assert.equal(logs[0].description, 'deferred')
      assert.equal(logs[0].reason, 'target-ref-moved')
    }
  }
})

test('workflow entrypoint refuses to write without the sync bot token', async () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/maintain-draft-sync-prs.yml'),
      'utf8'
    )
  )
  const step = workflow.jobs.maintain.steps[1]
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  const entrypoint = new AsyncFunction(
    'github',
    'context',
    'core',
    'process',
    'require',
    step.with.script
  )
  const state = fixture()
  const failures = []
  await entrypoint(
    state.github,
    context,
    { info() {}, setFailed: (message) => failures.push(message) },
    { env: { DRY_RUN: 'false', HAS_SYNC_TOKEN: 'false' } },
    () => ({ maintainDraftSyncPrs })
  )
  assert.equal(failures.length, 1)
  assert.equal(state.creates.length, 0)
  assert.equal(state.refWrites.length, 0)
})
