const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FINAL_REVIEW_MODEL,
  authorizeStackReview,
  buildStackSnapshot,
  callTopologyModel,
  decideStackStatus,
  finalizeStackReview,
  initializeStackReview,
  isStackReviewCommand,
  renderStackReview,
  resolveStackMembership,
  snapshotMatchesMembership,
  startStackReview,
  validateTopologyResult,
} = require('./final-ai-stack-review.js')

const repository = 'uzh-bf/klicker-uzh'

function context(number = 14) {
  return {
    eventName: 'issue_comment',
    issue: { number },
    payload: {
      comment: { body: '/final-review-stack', user: { login: 'reviewer' } },
      issue: { pull_request: {} },
      repository: { default_branch: 'v3' },
    },
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runId: 700,
    serverUrl: 'https://github.com',
    sha: 'f'.repeat(40),
  }
}

function makePull(number, baseRef, baseSha, headRef, headSha, title) {
  return {
    number,
    state: 'open',
    draft: false,
    title,
    body: `Intent for layer ${number}`,
    base: {
      ref: baseRef,
      sha: baseSha,
      repo: { full_name: repository },
    },
    head: {
      ref: headRef,
      sha: headSha,
      repo: { full_name: repository },
    },
  }
}

function stackFixture() {
  const pulls = {
    11: makePull(
      11,
      'v3',
      'b'.repeat(40),
      'rs/layer-1',
      'c'.repeat(40),
      'Layer one'
    ),
    12: makePull(
      12,
      'rs/layer-1',
      'c'.repeat(40),
      'rs/layer-2',
      'd'.repeat(40),
      'Layer two'
    ),
    13: makePull(
      13,
      'rs/layer-2',
      'd'.repeat(40),
      'rs/layer-3',
      'e'.repeat(40),
      'Layer three'
    ),
    14: makePull(
      14,
      'rs/layer-3',
      'e'.repeat(40),
      'rs/layer-4',
      'f'.repeat(40),
      'Layer four'
    ),
  }
  const files = new Map([
    ['b'.repeat(40), [{ filename: 'src/one.ts', additions: 4, deletions: 1 }]],
    ['c'.repeat(40), [{ filename: 'src/two.ts', additions: 3, deletions: 0 }]],
    ['d'.repeat(40), [{ filename: 'src/one.ts', additions: 2, deletions: 2 }]],
    [
      'e'.repeat(40),
      [{ filename: 'src/three.ts', additions: 5, deletions: 0 }],
    ],
  ])
  const responses = new Map([
    ['b'.repeat(40), 'c'.repeat(40)],
    ['c'.repeat(40), 'd'.repeat(40)],
    ['d'.repeat(40), 'e'.repeat(40)],
    ['e'.repeat(40), 'f'.repeat(40)],
  ])
  const reviewsEndpoint = {}
  const commentsEndpoint = {}
  const state = {
    statuses: [],
    createdStatuses: [],
    pulls,
  }
  const github = {
    rest: {
      pulls: {
        get: async ({ pull_number }) => ({ data: pulls[pull_number] }),
        createReview: async () => ({ data: { html_url: 'https://review' } }),
        listReviews: reviewsEndpoint,
      },
      issues: { listComments: commentsEndpoint },
      repos: {
        compareCommitsWithBasehead: async ({ basehead }) => {
          const [base, head] = basehead.split('...')
          return {
            data: {
              status: responses.get(base) === head ? 'ahead' : 'behind',
              files: files.get(base) ?? [],
            },
          }
        },
        createCommitStatus: async (status) =>
          state.createdStatuses.push(status),
        getCollaboratorPermissionLevel: async () => ({
          data: { user: { permission: 'write' } },
        }),
        getCombinedStatusForRef: async () => ({
          data: { statuses: state.statuses },
        }),
      },
      git: {
        getCommit: async ({ commit_sha }) => ({
          data: { tree: { sha: commit_sha } },
        }),
      },
    },
    request: async () => ({
      data: [
        {
          id: 99,
          pull_requests: [
            { number: 11, state: 'open', draft: false },
            { number: 12, state: 'open', draft: false },
            { number: 13, state: 'open', draft: false },
            { number: 14, state: 'open', draft: false },
          ],
        },
      ],
    }),
    paginate: async (endpoint) => (endpoint === reviewsEndpoint ? [] : []),
  }
  return { files, github, pulls, responses, state }
}

function completeOCRResult(comments = []) {
  return {
    status: 'complete',
    llm: { model: FINAL_REVIEW_MODEL },
    summary: {
      files_reviewed: 3,
      comments: comments.length,
      total_tokens: 100,
      input_tokens: 75,
      output_tokens: 25,
      elapsed: '2s',
    },
    comments,
    manifest: {
      schema_version: 'ocr.run-manifest/v1',
      terminal_state: 'complete',
    },
  }
}

function codeFinding() {
  return {
    path: 'src/one.ts',
    content:
      'Confidence: 90/100\nAutofix: manual\nMotivating line: `return value`\nThe cumulative change can fail after merge.',
    start_line: 4,
    end_line: 4,
    category: 'bug',
    severity: 'high',
  }
}

function topologyResult(comments = []) {
  return {
    status: 'complete',
    finish_reason: 'stop',
    model: FINAL_REVIEW_MODEL,
    summary: { coverage: 'complete', comments: comments.length },
    comments,
    usage: { total_tokens: 50, prompt_tokens: 35, completion_tokens: 15 },
  }
}

test('resolves a four-layer native stack and exact ancestry', async () => {
  const { github } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, true)
  assert.deepEqual(membership.numbers, [11, 12, 13, 14])
  assert.equal(membership.position, 3)
  assert.equal(membership.top.head.sha, 'f'.repeat(40))
  assert.match(membership.orderDigest, /^[0-9a-f]{64}$/)
})

test('accepts a verified two-layer stack as a distinct topology', async () => {
  const { github } = stackFixture()
  github.request = async () => ({
    data: [
      {
        id: 98,
        pull_requests: [
          { number: 11, state: 'open', draft: false },
          { number: 12, state: 'open', draft: false },
        ],
      },
    ],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(12),
    pullNumber: 12,
  })
  assert.equal(membership.valid, true)
  assert.deepEqual(membership.numbers, [11, 12])
  assert.equal(membership.position, 1)
})

test('builds a bounded immutable manifest with exact layer owners', async () => {
  const { github } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const bundle = await buildStackSnapshot({
    github,
    context: context(),
    membership,
  })
  assert.equal(bundle.manifest.layers.length, 4)
  assert.deepEqual(
    bundle.manifest.path_index.find((entry) => entry.filename === 'src/one.ts')
      .layers,
    [1, 3]
  )
  assert.equal(snapshotMatchesMembership(bundle.manifest, membership), true)
  assert.match(bundle.manifestDigest, /^[0-9a-f]{64}$/)
})

test('authorizes only the verified top pull request', async () => {
  const { github } = stackFixture()
  const outputs = new Map()
  const core = {
    notice: () => {},
    setOutput: (name, value) => outputs.set(name, value),
  }
  assert.equal(
    await authorizeStackReview({ github, context: context(14), core }),
    true
  )
  assert.equal(outputs.get('stack_id'), '99')
  assert.match(outputs.get('stack_identity_digest'), /^[0-9a-f]{64}$/)
  assert.equal(outputs.get('member_numbers'), '11,12,13,14')
  assert.equal(
    await authorizeStackReview({ github, context: context(12), core }),
    false
  )
})

test('invalidates the top status when a lower layer changes', async () => {
  const { github, pulls, state } = stackFixture()
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[12]
  await initializeStackReview({ github, context: eventContext })
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'pending')
})

test('does not target a lower status when the top member cannot be fetched', async () => {
  const { github, pulls, state } = stackFixture()
  const originalGet = github.rest.pulls.get
  github.rest.pulls.get = async ({ pull_number }) => {
    if (pull_number === 14) throw new Error('top member unavailable')
    return { data: pulls[pull_number] }
  }
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[12]
  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    false
  )
  assert.equal(state.createdStatuses.length, 0)
  github.rest.pulls.get = originalGet
})

test('rejects a forked member and a one-layer stack', async () => {
  const { github, pulls } = stackFixture()
  const originalGet = github.rest.pulls.get
  github.rest.pulls.get = async ({ pull_number }) => ({
    data:
      pull_number === 13
        ? {
            ...pulls[pull_number],
            head: {
              ...pulls[pull_number].head,
              repo: { full_name: 'attacker/example' },
            },
          }
        : pulls[pull_number],
  })
  const forked = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(forked.valid, false)

  github.rest.pulls.get = originalGet
  github.request = async () => ({
    data: [
      { id: 100, pull_requests: [{ number: 14, state: 'open', draft: false }] },
    ],
  })
  const oneLayer = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(oneLayer.valid, false)
})

test('fails closed on a member with missing identity fields', async () => {
  const { github, pulls } = stackFixture()
  const originalGet = github.rest.pulls.get
  github.rest.pulls.get = async ({ pull_number }) => ({
    data:
      pull_number === 13
        ? { ...pulls[pull_number], base: undefined }
        : pulls[pull_number],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.equal(membership.identityDigest, '')
  assert.match(membership.reason, /open and ready/)
  github.rest.pulls.get = originalGet
})

test('fails closed on a null or mismatched member response', async () => {
  const { github, pulls } = stackFixture()
  const originalGet = github.rest.pulls.get
  github.rest.pulls.get = async ({ pull_number }) => ({
    data:
      pull_number === 13
        ? undefined
        : pull_number === 14
          ? { ...pulls[pull_number], number: 999 }
          : pulls[pull_number],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.equal(membership.top, undefined)
  assert.match(membership.reason, /returned no PR data/)
  github.rest.pulls.get = originalGet
})

test('fails closed when a comparison reaches the GitHub file-list cap', async () => {
  const { files, github } = stackFixture()
  files.set(
    'b'.repeat(40),
    Array.from({ length: 300 }, (_, index) => ({
      filename: `src/file-${index}.ts`,
      additions: 1,
      deletions: 0,
    }))
  )
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.match(membership.reason, /complete bounded file list/)
})

test('starts a review only when the stack snapshot remains identical', async () => {
  const { github, state } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-review-'))
  const manifestPath = path.join(directory, 'manifest.json')
  const outputs = new Map()
  const started = await startStackReview({
    github,
    context: context(),
    prNumber: 14,
    baseSha: membership.members[0].pull.base.sha,
    headSha: membership.top.head.sha,
    stackId: membership.id,
    stackOrderDigest: membership.orderDigest,
    stackIdentityDigest: membership.identityDigest,
    memberNumbers: membership.numbers,
    manifestPath,
    core: { setOutput: (name, value) => outputs.set(name, value) },
  })
  assert.equal(started, true)
  assert.equal(fs.existsSync(manifestPath), true)
  assert.match(outputs.get('manifest_digest'), /^[0-9a-f]{64}$/)
  assert.equal(state.createdStatuses.at(-1).state, 'pending')
})

test('rejects a successful finish after lower-layer identity drift', async () => {
  const { github, pulls, responses, state } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  pulls[13].head.sha = 'a'.repeat(40)
  pulls[14].base.sha = 'a'.repeat(40)
  responses.set('d'.repeat(40), 'a'.repeat(40))
  responses.set('a'.repeat(40), 'f'.repeat(40))
  await finalizeStackReview({
    github,
    context: context(),
    prNumber: 14,
    baseSha: membership.members[0].pull.base.sha,
    headSha: membership.top.head.sha,
    stackId: membership.id,
    stackOrderDigest: membership.orderDigest,
    stackIdentityDigest: membership.identityDigest,
    memberNumbers: membership.numbers,
    codeOutcome: 'success',
    topologyOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(state.createdStatuses.at(-1).state, 'error')
})

test('renders consolidated code and topology findings with one stack marker', async () => {
  const { github } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const manifestBundle = await buildStackSnapshot({
    github,
    context: context(),
    membership,
  })
  const report = renderStackReview({
    codeResult: completeOCRResult([codeFinding()]),
    headSha: 'f'.repeat(40),
    manifestBundle,
    topologyResult: topologyResult(
      [
        {
          path: 'src/one.ts',
          layer_numbers: [1, 3],
          start_line: 1,
          end_line: 1,
          category: 'architecture',
          severity: 'medium',
          content:
            'The shared file changes in non-adjacent layers without a compatible boundary.',
        },
      ].map((finding) => ({ ...finding, category: 'maintainability' }))
    ),
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  assert.match(report, /final-ai-stack-review\/v1/)
  assert.match(report, /Cumulative code review/)
  assert.match(report, /Cross-layer topology review/)
  assert.match(report, /src\/one\.ts/)
  assert.equal(
    (report.match(/<!-- final-ai-stack-review\/v1/g) ?? []).length,
    1
  )
})

test('sends strict high-reasoning topology requests and rejects invalid owners', async () => {
  const { github } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const manifestBundle = await buildStackSnapshot({
    github,
    context: context(),
    membership,
  })
  const codeResult = completeOCRResult([codeFinding()])
  let request
  const response = await callTopologyModel({
    apiKey: 'dummy-token',
    codeResult,
    manifestBundle,
    rulesText: 'test rules',
    schema: { type: 'object' },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: FINAL_REVIEW_MODEL,
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  summary: { coverage: 'complete', comments: 0 },
                  comments: [],
                }),
              },
            },
          ],
          usage: { total_tokens: 50, prompt_tokens: 35, completion_tokens: 15 },
        }),
      }
    },
  })
  assert.equal(response.status, 'complete')
  assert.equal(request.provider.require_parameters, true)
  assert.equal(request.reasoning.effort, 'high')
  assert.equal(request.response_format.json_schema.strict, true)
  assert.equal(request.messages[0].content.includes('dummy-token'), false)
  assert.throws(
    () =>
      validateTopologyResult(
        topologyResult([
          {
            path: 'src/not-in-stack.ts',
            layer_numbers: [1],
            start_line: 1,
            end_line: 1,
            category: 'bug',
            severity: 'high',
            content: 'Invalid owner',
          },
        ]),
        manifestBundle.manifest
      ),
    /invalid/
  )
  assert.throws(
    () =>
      validateTopologyResult(
        { ...topologyResult(), summary: { coverage: 'partial', comments: 0 } },
        manifestBundle.manifest
      ),
    /incomplete/
  )
  assert.throws(
    () =>
      validateTopologyResult(
        {
          ...topologyResult(),
          usage: { total_tokens: 99, prompt_tokens: 35, completion_tokens: 15 },
        },
        manifestBundle.manifest
      ),
    /usage/
  )
})

test('latest stack drift becomes an error even when the top SHA is unchanged', () => {
  const status = decideStackStatus({
    eligible: false,
    currentHead: 'f'.repeat(40),
    reviewedHead: 'f'.repeat(40),
    codeOutcome: 'success',
    topologyOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(status.state, 'error')
  assert.equal(isStackReviewCommand('/final-review-stack'), true)
  assert.equal(isStackReviewCommand('/final-review-stack now'), false)
})
