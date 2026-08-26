const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FINAL_REVIEW_MODEL,
  authorizeStackReview,
  buildStackReviewPlan,
  buildStackSnapshot,
  callTopologyModel,
  combineOCRResults,
  decideStackStatus,
  finalizeStackReview,
  initializeStackReview,
  isStackReviewCommand,
  parseStackReviewMetadata,
  readSnapshotBundle,
  renderStackReview,
  resolveStackMembership,
  snapshotMatchesMembership,
  stackReviewMetadataMatchesPlan,
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
    [
      'b'.repeat(40),
      [
        {
          filename: 'src/one.ts',
          additions: 4,
          deletions: 1,
          patch: '@@ -3,1 +4,1 @@\n-old in layer one\n+changed in layer one',
        },
        {
          filename: 'src/shift.ts',
          additions: 1,
          deletions: 1,
          patch: '@@ -2,1 +2,1 @@\n-old source\n+source change',
        },
        {
          filename: 'src/rename-old.ts',
          additions: 1,
          deletions: 0,
          patch: '@@ -0,0 +1,1 @@\n+old content',
        },
        {
          filename: 'src/context.ts',
          additions: 1,
          deletions: 1,
          patch: '@@ -4,1 +4,1 @@\n-old context\n+source context',
        },
      ],
    ],
    ['c'.repeat(40), [{ filename: 'src/two.ts', additions: 3, deletions: 0 }]],
    [
      'd'.repeat(40),
      [
        {
          filename: 'src/one.ts',
          additions: 2,
          deletions: 2,
          patch:
            '@@ -8,1 +9,1 @@\n-old in layer three\n+changed in layer three',
        },
        {
          filename: 'src/shift.ts',
          additions: 1,
          deletions: 0,
          patch: '@@ -2,0 +2,1 @@\n+later insertion',
        },
        {
          filename: 'src/rename-new.ts',
          previous_filename: 'src/rename-old.ts',
          additions: 1,
          deletions: 1,
          patch: '@@ -1,1 +1,1 @@\n-old content\n+new content',
        },
        {
          filename: 'src/context.ts',
          additions: 1,
          deletions: 1,
          patch:
            '@@ -4,3 +4,3 @@\n context line 4\n context line 5\n-old context line 6\n+later context line 6',
        },
      ],
    ],
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
    policyFiles: {},
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
              merge_base_commit: { sha: 'b'.repeat(40) },
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
        listCommitStatusesForRef: async () => ({
          data: { statuses: state.statuses },
        }),
        getContent: async ({ path: filePath }) => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(
              state.policyFiles[filePath] ?? '{"rules":[]}'
            ).toString('base64'),
          },
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
            {
              number: 11,
              state: 'open',
              draft: false,
              head: { sha: 'c'.repeat(40) },
            },
            {
              number: 12,
              state: 'open',
              draft: false,
              head: { sha: 'd'.repeat(40) },
            },
            {
              number: 13,
              state: 'open',
              draft: false,
              head: { sha: 'e'.repeat(40) },
            },
            {
              number: 14,
              state: 'open',
              draft: false,
              head: { sha: 'f'.repeat(40) },
            },
          ],
        },
      ],
    }),
    paginate: async (endpoint) =>
      endpoint === github.rest.repos.listCommitStatusesForRef
        ? state.statuses
        : endpoint === reviewsEndpoint
          ? []
          : [],
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
          {
            number: 11,
            state: 'open',
            draft: false,
            head: { sha: 'c'.repeat(40) },
          },
          {
            number: 12,
            state: 'open',
            draft: false,
            head: { sha: 'd'.repeat(40) },
          },
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

test('accepts flat native stack head SHA records', async () => {
  const { github } = stackFixture()
  const heads = {
    11: 'c'.repeat(40),
    12: 'd'.repeat(40),
    13: 'e'.repeat(40),
    14: 'f'.repeat(40),
  }
  github.request = async () => ({
    data: [
      {
        id: 97,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head_sha: heads[number],
        })),
      },
    ],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, true)
  assert.equal(membership.topHeadSha, 'f'.repeat(40))
})

test('rejects a native top record whose head differs from the fetched PR', async () => {
  const { github } = stackFixture()
  const heads = {
    11: 'c'.repeat(40),
    12: 'd'.repeat(40),
    13: 'e'.repeat(40),
    14: '0'.repeat(40),
  }
  github.request = async () => ({
    data: [
      {
        id: 95,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: heads[number] },
        })),
      },
    ],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.match(membership.reason, /stack member 14/)
  assert.equal(membership.topHeadSha, '0'.repeat(40))
})

test('invalidates both top identities when native stack data drifts', async () => {
  const { github, pulls, state } = stackFixture()
  const nativeTopSha = '0'.repeat(40)
  github.request = async () => ({
    data: [
      {
        id: 95,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: number === 14 ? nativeTopSha : pulls[number].head.sha },
        })),
      },
    ],
  })
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[12]

  await initializeStackReview({ github, context: eventContext })

  assert.deepEqual(
    state.createdStatuses.map(({ sha, state: status }) => ({
      sha,
      state: status,
    })),
    [
      { sha: pulls[14].head.sha, state: 'error' },
      { sha: nativeTopSha, state: 'error' },
    ]
  )
})

test('attempts both top invalidations when either status write fails', async () => {
  for (const failedIdentity of ['native', 'fetched']) {
    const { github, pulls, state } = stackFixture()
    const nativeTopSha = '0'.repeat(40)
    const fetchedTopSha = pulls[14].head.sha
    github.request = async () => ({
      data: [
        {
          id: 95,
          pull_requests: [11, 12, 13, 14].map((number) => ({
            number,
            state: 'open',
            draft: false,
            head: {
              sha: number === 14 ? nativeTopSha : pulls[number].head.sha,
            },
          })),
        },
      ],
    })
    const failedSha = failedIdentity === 'native' ? nativeTopSha : fetchedTopSha
    const successfulSha =
      failedIdentity === 'native' ? fetchedTopSha : nativeTopSha
    const createCommitStatus = github.rest.repos.createCommitStatus
    github.rest.repos.createCommitStatus = async (status) => {
      if (status.sha === failedSha) {
        throw new Error(`${failedIdentity} status is unavailable`)
      }
      return createCommitStatus(status)
    }
    const eventContext = context(12)
    eventContext.eventName = 'pull_request_target'
    eventContext.payload.pull_request = pulls[12]

    await assert.rejects(
      initializeStackReview({ github, context: eventContext }),
      new RegExp(`${failedIdentity} status is unavailable`)
    )
    assert.deepEqual(
      state.createdStatuses.map(({ sha, state: status }) => ({
        sha,
        state: status,
      })),
      [{ sha: successfulSha, state: 'error' }]
    )
  }
})

test('invalidates the fetched top when native top metadata is malformed', async () => {
  const { github, pulls, state } = stackFixture()
  github.request = async () => ({
    data: [
      {
        id: 96,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: number === 14 ? 'not-a-sha' : pulls[number].head.sha },
        })),
      },
    ],
  })
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[12]

  await initializeStackReview({ github, context: eventContext })

  assert.deepEqual(
    state.createdStatuses.map(({ sha, state: status }) => ({
      sha,
      state: status,
    })),
    [{ sha: pulls[14].head.sha, state: 'error' }]
  )
})

test('rejects a native lower-layer record whose head differs from the fetched PR', async () => {
  const { github } = stackFixture()
  const heads = {
    11: 'c'.repeat(40),
    12: '0'.repeat(40),
    13: 'e'.repeat(40),
    14: 'f'.repeat(40),
  }
  github.request = async () => ({
    data: [
      {
        id: 94,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: heads[number] },
        })),
      },
    ],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.match(membership.reason, /stack member 12/)
  assert.equal(membership.topHeadSha, 'f'.repeat(40))
})

test('rejects a native stack record with a malformed head SHA', async () => {
  const { github } = stackFixture()
  github.request = async () => ({
    data: [
      {
        id: 96,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: number === 14 ? 'not-a-sha' : 'c'.repeat(40) },
        })),
      },
    ],
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.match(membership.reason, /malformed head SHA/)
  assert.equal(membership.top?.head.sha, 'f'.repeat(40))
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
  assert.deepEqual(
    bundle.manifest.path_index.find((entry) => entry.filename === 'src/one.ts')
      .line_layers,
    [
      { end_line: 4, layers: [1], start_line: 4 },
      { end_line: 9, layers: [3], start_line: 9 },
    ]
  )
  assert.deepEqual(
    bundle.manifest.path_index.find(
      (entry) => entry.filename === 'src/shift.ts'
    ).line_layers,
    [
      { end_line: 3, layers: [1], start_line: 3 },
      { end_line: 2, layers: [3], start_line: 2 },
    ]
  )
  assert.equal(
    bundle.manifest.path_index.some(
      (entry) => entry.filename === 'src/rename-old.ts'
    ),
    false
  )
  assert.deepEqual(
    bundle.manifest.path_index.find(
      (entry) => entry.filename === 'src/rename-new.ts'
    ),
    {
      additions: 2,
      deletions: 1,
      filename: 'src/rename-new.ts',
      layers: [1, 3],
      line_layers: [],
    }
  )
  assert.deepEqual(
    bundle.manifest.path_index.find(
      (entry) => entry.filename === 'src/context.ts'
    ).line_layers,
    [
      { end_line: 4, layers: [1], start_line: 4 },
      { end_line: 6, layers: [3], start_line: 6 },
    ]
  )
  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const report = renderStackReview({
    codeResult: completeOCRResult([codeFinding()]),
    headSha: membership.top.head.sha,
    manifestBundle: bundle,
    policyDigest: plan.policyDigest,
    topologyResult: topologyResult(),
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
  })
  assert.deepEqual(
    parseStackReviewMetadata(report).findings[0].layer_numbers,
    [1]
  )
  assert.equal(snapshotMatchesMembership(bundle.manifest, membership), true)
  assert.match(bundle.manifestDigest, /^[0-9a-f]{64}$/)
})

test('rejects a self-consistent replacement for the frozen stack manifest', async () => {
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
  const replacement = {
    ...bundle.manifest,
    path_index: [
      ...bundle.manifest.path_index,
      { filename: 'src/replaced.ts', layers: [1] },
    ],
  }
  const replacementDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify(replacement))
    .digest('hex')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-review-'))
  const manifestPath = path.join(directory, 'manifest.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      manifest: replacement,
      manifest_digest: replacementDigest,
    })
  )
  assert.throws(
    () => readSnapshotBundle(manifestPath, bundle.manifestDigest),
    /changed after snapshot freeze/
  )
})

test('does not reuse a successful stack report after lower-layer drift', async () => {
  const { github } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const metadata = {
    mode: 'full',
    base_sha: plan.baseSha,
    head_sha: plan.headSha,
    stack_id: plan.stackId,
    stack_order_digest: plan.stackOrderDigest,
    stack_identity_digest: plan.stackIdentityDigest,
    policy_digest: plan.policyDigest,
    layer_head_shas: membership.members.map(({ pull }) => pull.head.sha),
    layer_identities: membership.members.map(({ number, pull }) => ({
      base_ref: pull.base.ref,
      base_sha: pull.base.sha,
      head_ref: pull.head.ref,
      head_sha: pull.head.sha,
      pull_request: number,
    })),
    root_head: plan.rootHead,
    root_review_id: '',
    disposition_digest: '',
    disposition_ids: [],
    review_ranges: [],
  }
  assert.equal(stackReviewMetadataMatchesPlan(metadata, plan, membership), true)
  const incrementalPlan = {
    ...plan,
    mode: 'incremental',
    rootHead: 'e'.repeat(40),
    rootReviewId: `fsr-${'1'.repeat(24)}`,
    dispositionDigest: 'a'.repeat(64),
    dispositionIds: ['sfr-1234567890abcdef'],
    reviewRanges: [
      {
        base_sha: 'e'.repeat(40),
        head_sha: 'f'.repeat(40),
        layer_number: 4,
      },
    ],
  }
  assert.equal(
    stackReviewMetadataMatchesPlan(
      {
        ...metadata,
        mode: 'incremental',
        root_head: incrementalPlan.rootHead,
        root_review_id: incrementalPlan.rootReviewId,
        disposition_digest: incrementalPlan.dispositionDigest,
        disposition_ids: incrementalPlan.dispositionIds,
        review_ranges: incrementalPlan.reviewRanges,
      },
      incrementalPlan,
      membership
    ),
    true
  )
  const driftedMembership = {
    ...membership,
    members: membership.members.map((member, index) =>
      index === 0
        ? {
            ...member,
            pull: {
              ...member.pull,
              head: { ...member.pull.head, sha: '9'.repeat(40) },
            },
          }
        : member
    ),
  }
  assert.equal(
    stackReviewMetadataMatchesPlan(metadata, plan, driftedMembership),
    false
  )
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
  assert.match(outputs.get('policy_digest'), /^[0-9a-f]{64}$/)
  assert.equal(outputs.get('member_numbers'), '11,12,13,14')
  assert.equal(
    await authorizeStackReview({ github, context: context(12), core }),
    false
  )
})

test('keeps actions read permission for stack revalidation', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../workflows/check-ocr-final-stack-review.yml'),
    'utf8'
  )
  const reviewJob =
    workflow.match(
      /\n {2}review:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n|$)/
    )?.[1] ?? ''
  const permissions =
    reviewJob.match(
      /\n {4}permissions:\n([\s\S]*?)(?=\n {4}steps:\n|$)/
    )?.[1] ?? ''
  assert.match(permissions, / {6}actions: read\n/)
})

test('checks trusted review code out from the default branch', () => {
  for (const workflowName of [
    'check-ocr-final-review.yml',
    'check-ocr-final-stack-review.yml',
  ]) {
    const workflow = fs.readFileSync(
      path.join(__dirname, `../workflows/${workflowName}`),
      'utf8'
    )
    assert.match(workflow, /trusted_policy:/u)
    assert.doesNotMatch(
      workflow,
      /ref: \$\{\{ github\.(sha|event\.repository\.default_branch) \}\}/u
    )
    assert.match(
      workflow,
      /ref: \$\{\{ needs\.trusted_policy\.outputs\.trusted_sha \}\}/u
    )
    assert.match(
      workflow,
      /ref: \$\{\{ needs\.authorize\.outputs\.trusted_sha \}\}/u
    )
    assert.match(workflow, /git rev-parse HEAD/u)
  }
})

test('anchors every stack review consumer to the frozen manifest digest', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../workflows/check-ocr-final-stack-review.yml'),
    'utf8'
  )
  assert.equal(
    workflow.match(
      /MANIFEST_DIGEST: \$\{\{ steps\.start\.outputs\.manifest_digest \}\}/g
    )?.length,
    3
  )
  assert.match(
    workflow,
    /expectedManifestDigest: process\.env\.MANIFEST_DIGEST/
  )
  assert.match(
    workflow,
    /"\$\{MANIFEST_PATH\}" "\$\{CODE_RESULT_PATH\}" "\$\{TOPOLOGY_RESULT_PATH\}" \\\n\s+"\$\{MANIFEST_DIGEST\}"/
  )
})

test('does not publish stack status for ordinary PRs without stale stack evidence', async () => {
  const { github, pulls, state } = stackFixture()
  github.request = async () => ({ data: [] })
  const eventContext = context(14)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[14]
  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    false
  )
  assert.equal(state.createdStatuses.length, 0)

  state.statuses.push({
    context: 'final-ai-stack-review',
    state: 'success',
    target_url: 'https://github.com/old-review',
  })
  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    true
  )
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'error')
})

test('invalidates the former top when stack history contains a removed lower layer', async () => {
  const { github, pulls, state } = stackFixture()
  const currentStack = {
    id: 99,
    open: true,
    pull_requests: [12, 13, 14].map((number) => ({
      number,
      state: 'open',
      draft: false,
      head: { sha: pulls[number].head.sha },
    })),
  }
  const historicalStack = {
    id: 99,
    open: false,
    pull_requests: [11, 12, 13, 14].map((number) => ({
      number,
      state: 'open',
      draft: false,
      head: { sha: pulls[number].head.sha },
    })),
  }
  github.request = async (_route, params) => ({
    data:
      params.pull_request === 11
        ? []
        : params.pull_request == null
          ? [historicalStack]
          : [currentStack],
  })
  const eventContext = context(11)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[11]
  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    true
  )
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'error')
})

test('preserves current stack evidence across unrelated default-base advancement', async () => {
  const { files, github, pulls, responses, state } = stackFixture()
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
  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const rootReport = renderStackReview({
    codeResult: completeOCRResult([codeFinding()]),
    headSha: pulls[14].head.sha,
    manifestBundle,
    topologyResult: topologyResult(),
    policyDigest: plan.policyDigest,
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  state.reviews = [
    {
      body: rootReport,
      commit_id: pulls[14].head.sha,
      state: 'COMMENTED',
      submitted_at: '2026-08-25T00:00:00Z',
      user: { login: 'github-actions[bot]' },
    },
  ]
  state.comments = []
  state.workflowRun = {
    id: 700,
    path: '.github/workflows/check-ocr-final-stack-review.yml',
    event: 'issue_comment',
    head_branch: 'v3',
    head_sha: 'a'.repeat(40),
    conclusion: 'success',
    repository: { full_name: repository },
  }
  state.statuses = [
    {
      context: 'final-ai-stack-review',
      state: 'success',
      target_url: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    },
  ]
  github.rest.actions = {
    getWorkflowRun: async () => ({ data: state.workflowRun }),
  }
  github.paginate = async (endpoint) =>
    endpoint === github.rest.repos.listCommitStatusesForRef
      ? state.statuses
      : endpoint === github.rest.pulls.listReviews
        ? state.reviews
        : state.comments

  const advancedBase = '9'.repeat(40)
  pulls[11].base.sha = advancedBase
  responses.set('b'.repeat(40), advancedBase)
  files.set('b'.repeat(40), [
    { filename: 'docs/base.md', additions: 1, deletions: 0 },
  ])
  files.set(advancedBase, [])
  const eventContext = context(11)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[11]

  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    false
  )
  assert.equal(state.createdStatuses.length, 0)

  const outputs = new Map()
  const reviewContext = context(14)
  reviewContext.payload.comment.user = { login: 'reviewer' }
  const authorized = await authorizeStackReview({
    github,
    context: reviewContext,
    core: {
      notice: () => {},
      setOutput: (name, value) => outputs.set(name, value),
    },
  })
  assert.equal(authorized, true)
  assert.equal(outputs.get('mode'), 'full')
})

test('invalidates the top status when a lower layer changes', async () => {
  const { github, pulls, state } = stackFixture()
  state.statuses.push({
    context: 'final-ai-stack-review',
    state: 'success',
    target_url: 'https://github.com/old-review',
  })
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = {
    ...pulls[12],
    head: { ...pulls[12].head, sha: '0'.repeat(40) },
  }
  await initializeStackReview({ github, context: eventContext })
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'pending')
  assert.equal(state.createdStatuses.at(-1).context, 'final-ai-stack-review')
})

test('supersedes the top status when the top member cannot be fetched', async () => {
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
    true
  )
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'error')
  assert.equal(state.createdStatuses.at(-1).context, 'final-ai-stack-review')
  github.rest.pulls.get = originalGet
})

test('supersedes the top status when a lower member cannot be fetched', async () => {
  const { github, pulls, state } = stackFixture()
  const originalGet = github.rest.pulls.get
  github.rest.pulls.get = async ({ pull_number }) => {
    if (pull_number === 13) throw new Error('lower member unavailable')
    return { data: pulls[pull_number] }
  }
  const eventContext = context(12)
  eventContext.eventName = 'pull_request_target'
  eventContext.payload.pull_request = pulls[12]
  assert.equal(
    await initializeStackReview({ github, context: eventContext }),
    true
  )
  assert.equal(state.createdStatuses.at(-1).sha, pulls[14].head.sha)
  assert.equal(state.createdStatuses.at(-1).state, 'error')
  assert.equal(state.createdStatuses.at(-1).context, 'final-ai-stack-review')
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

test('fails closed when native stack discovery reaches the page cap', async () => {
  const { github } = stackFixture()
  github.request = async () => ({
    data: Array.from({ length: 100 }, () => ({
      id: 'stack-duplicate-page',
      pull_requests: [{ number: 14, state: 'open', draft: false }],
    })),
  })
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  assert.equal(membership.valid, false)
  assert.match(membership.reason, /capped list/)
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
  const initialPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
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
    policyDigest: initialPlan.policyDigest,
    manifestPath,
    core: { setOutput: (name, value) => outputs.set(name, value) },
  })
  assert.equal(started, true)
  assert.equal(fs.existsSync(manifestPath), true)
  assert.match(outputs.get('manifest_digest'), /^[0-9a-f]{64}$/)
  assert.equal(state.createdStatuses.at(-1).state, 'pending')
})

test('attests a bounded repaired top layer from a trusted stack disposition', async () => {
  const { files, github, pulls, responses, state } = stackFixture()
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
  const initialPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const rootReport = renderStackReview({
    codeResult: completeOCRResult([codeFinding()]),
    headSha: 'f'.repeat(40),
    manifestBundle,
    topologyResult: topologyResult(),
    policyDigest: initialPlan.policyDigest,
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  const rootMetadata = parseStackReviewMetadata(rootReport)
  assert.ok(
    rootMetadata,
    rootReport.match(/<!-- final-ai-stack-review\/v2 ([^\n]+) -->/)?.[1]
  )
  const incrementalReport = renderStackReview({
    codeResult: combineOCRResults(
      [completeOCRResult([{ ...codeFinding(), path: 'src/three.ts' }])],
      [4]
    ),
    headSha: 'f'.repeat(40),
    manifestBundle,
    mode: 'incremental',
    rootHead: 'e'.repeat(40),
    rootReviewId: rootMetadata.review_id,
    dispositionIds: rootMetadata.finding_ids,
    dispositionDigest: 'a'.repeat(64),
    policyDigest: initialPlan.policyDigest,
    topologyResult: topologyResult(),
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  assert.match(
    incrementalReport,
    /Reviewed verified stack 99 from `eeeeeeeeeeee` to `ffffffffffff`\./
  )
  assert.match(incrementalReport, /Bounded cumulative code attestation/)
  const nextHead = '9'.repeat(40)
  pulls[14].head.sha = nextHead
  responses.set('e'.repeat(40), nextHead)
  responses.set('f'.repeat(40), nextHead)
  files.set('e'.repeat(40), [
    { filename: 'src/one.ts', additions: 2, deletions: 1 },
  ])
  files.set('f'.repeat(40), [
    { filename: 'src/one.ts', additions: 2, deletions: 1 },
  ])
  github.request = async () => ({
    data: [
      {
        id: 99,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: number === 14 ? nextHead : pulls[number].head.sha },
        })),
      },
    ],
  })
  state.reviews = [
    {
      id: 701,
      body: rootReport,
      commit_id: 'f'.repeat(40),
      state: 'COMMENTED',
      submitted_at: '2026-08-25T00:00:00Z',
      user: { login: 'github-actions[bot]' },
    },
  ]
  const secondReviewMetadata = {
    ...rootMetadata,
    head_sha: nextHead,
    layer_head_shas: rootMetadata.layer_head_shas.map((sha, index) =>
      index === 3 ? nextHead : sha
    ),
    layer_identities: rootMetadata.layer_identities.map((identity, index) =>
      index === 3 ? { ...identity, head_sha: nextHead } : identity
    ),
    mode: 'incremental',
    review_id: `fsr-${'1'.repeat(24)}`,
    root_head: 'f'.repeat(40),
    root_review_id: rootMetadata.review_id,
    disposition_digest: 'a'.repeat(64),
    disposition_ids: rootMetadata.finding_ids,
  }
  state.reviews.push({
    id: 702,
    body: `<!-- final-ai-stack-review/v2 ${JSON.stringify(secondReviewMetadata)} -->`,
    commit_id: nextHead,
    state: 'COMMENTED',
    submitted_at: '2026-08-25T02:00:00Z',
    user: { login: 'github-actions[bot]' },
  })
  github.paginate = async (endpoint) =>
    endpoint === github.rest.repos.listCommitStatusesForRef
      ? state.statuses
      : endpoint === github.rest.pulls.listReviews
        ? state.reviews
        : state.comments
  state.comments = [
    {
      body: `<!-- final-ai-disposition/v1 ${JSON.stringify({
        schema_version: 'final-ai-disposition/v1',
        review_id: rootMetadata.review_id,
        root_head: 'f'.repeat(40),
        workflow_run_id: 700,
        entries: [
          {
            finding_id: rootMetadata.finding_ids[0],
            state: 'fixed',
            reference: 'commit:9'.padEnd(46, '0'),
            paths: ['src/one.ts'],
          },
        ],
      })} -->`,
      created_at: '2026-08-25T01:00:00Z',
      user: { login: 'reviewer' },
    },
  ]
  state.workflowRun = {
    id: 700,
    path: '.github/workflows/check-ocr-final-stack-review.yml',
    event: 'issue_comment',
    head_branch: 'v3',
    head_sha: 'a'.repeat(40),
    conclusion: 'success',
    repository: { full_name: repository },
  }
  state.statuses = [
    {
      context: 'final-ai-stack-review',
      state: 'success',
      target_url: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    },
  ]
  github.rest.actions = {
    getWorkflowRun: async () => ({ data: state.workflowRun }),
  }

  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership: await resolveStackMembership({
      github,
      context: context(),
      pullNumber: 14,
    }),
  })
  assert.equal(plan.mode, 'incremental')
  assert.equal(plan.rootHead, 'f'.repeat(40))
  assert.equal(plan.rootReviewId, rootMetadata.review_id)
  assert.match(plan.dispositionDigest, /^[0-9a-f]{64}$/)
  assert.match(plan.policyDigest, /^[0-9a-f]{64}$/)
  assert.match(plan.background, /incremental attestation/)

  state.comments = state.comments.map((comment) => ({
    ...comment,
    body: comment.body.replace('"state":"fixed"', '"state":"rejected"'),
  }))
  const deferredPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership: await resolveStackMembership({
      github,
      context: context(),
      pullNumber: 14,
    }),
  })
  assert.equal(deferredPlan.mode, 'full')

  state.policyFiles[
    '.github/open-code-review/final-stack-topology-rules.json'
  ] = 'changed trusted topology policy'
  const changedPolicyPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership: await resolveStackMembership({
      github,
      context: context(),
      pullNumber: 14,
    }),
  })
  assert.equal(changedPolicyPlan.mode, 'full')
  delete state.policyFiles[
    '.github/open-code-review/final-stack-topology-rules.json'
  ]

  pulls[14].head.ref = 'rs/layer-4-renamed'
  const driftPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership: await resolveStackMembership({
      github,
      context: context(),
      pullNumber: 14,
    }),
  })
  assert.equal(driftPlan.mode, 'full')
})

test('attests bounded repairs across changed lower stack layers', async () => {
  const { files, github, pulls, responses, state } = stackFixture()
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
  const initialPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const rootReport = renderStackReview({
    codeResult: completeOCRResult([codeFinding()]),
    headSha: 'f'.repeat(40),
    manifestBundle,
    topologyResult: topologyResult(),
    policyDigest: initialPlan.policyDigest,
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  const rootMetadata = parseStackReviewMetadata(rootReport)
  assert.ok(rootMetadata)

  const currentHeads = [
    'a'.repeat(40),
    '1'.repeat(40),
    '2'.repeat(40),
    '3'.repeat(40),
  ]
  const currentBases = ['b'.repeat(40), ...currentHeads.slice(0, -1)]
  currentHeads.forEach((head, index) => {
    pulls[11 + index].head.sha = head
    pulls[11 + index].base.sha = currentBases[index]
    responses.set(currentBases[index], head)
    files.set(currentBases[index], [
      { filename: 'src/one.ts', additions: 1, deletions: 1 },
    ])
    responses.set(rootMetadata.layer_head_shas[index], head)
    files.set(rootMetadata.layer_head_shas[index], [
      { filename: 'src/one.ts', additions: 1, deletions: 1 },
    ])
  })
  github.request = async () => ({
    data: [
      {
        id: 99,
        pull_requests: [11, 12, 13, 14].map((number) => ({
          number,
          state: 'open',
          draft: false,
          head: { sha: pulls[number].head.sha },
        })),
      },
    ],
  })
  state.reviews = [
    {
      id: 701,
      body: rootReport,
      commit_id: 'f'.repeat(40),
      state: 'COMMENTED',
      submitted_at: '2026-08-25T00:00:00Z',
      user: { login: 'github-actions[bot]' },
    },
  ]
  state.comments = [
    {
      body: `<!-- final-ai-disposition/v1 ${JSON.stringify({
        schema_version: 'final-ai-disposition/v1',
        review_id: rootMetadata.review_id,
        root_head: 'f'.repeat(40),
        workflow_run_id: 700,
        entries: [
          {
            finding_id: rootMetadata.finding_ids[0],
            state: 'fixed',
            reference: 'commit:9'.padEnd(46, '0'),
            paths: ['src/one.ts'],
          },
        ],
      })} -->`,
      created_at: '2026-08-25T01:00:00Z',
      user: { login: 'reviewer' },
    },
  ]
  github.paginate = async (endpoint) =>
    endpoint === github.rest.repos.listCommitStatusesForRef
      ? state.statuses
      : endpoint === github.rest.pulls.listReviews
        ? state.reviews
        : state.comments
  state.workflowRun = {
    id: 700,
    path: '.github/workflows/check-ocr-final-stack-review.yml',
    event: 'issue_comment',
    head_branch: 'v3',
    head_sha: 'a'.repeat(40),
    conclusion: 'success',
    repository: { full_name: repository },
  }
  state.statuses = [
    {
      context: 'final-ai-stack-review',
      state: 'success',
      target_url: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    },
  ]
  github.rest.actions = {
    getWorkflowRun: async () => ({ data: state.workflowRun }),
  }

  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership: await resolveStackMembership({
      github,
      context: context(),
      pullNumber: 14,
    }),
  })
  assert.equal(plan.mode, 'incremental')
  assert.deepEqual(
    plan.reviewRanges.map(({ layer_number }) => layer_number),
    [1, 2, 3, 4]
  )
  assert.match(plan.background, /layer 1 .*layer 4/)
})

test('combines complete OCR results for per-layer attestation ranges', () => {
  const first = completeOCRResult([codeFinding()])
  const second = completeOCRResult([])
  const combined = combineOCRResults([first, second], [1, 3])
  assert.equal(combined.status, 'complete')
  assert.equal(combined.summary.comments, 1)
  assert.equal(combined.summary.files_reviewed, 6)
  assert.equal(combined.summary.total_tokens, 200)
  assert.deepEqual(combined.comments[0].stack_layer_numbers, [1])
  assert.deepEqual(combined.warnings, [])
})

test('publishes incremental code findings with their exact owning repair layer', async () => {
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
  const plan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
  const report = renderStackReview({
    codeResult: combineOCRResults([completeOCRResult([codeFinding()])], [1]),
    headSha: membership.top.head.sha,
    manifestBundle,
    mode: 'incremental',
    rootHead: membership.members[0].pull.base.sha,
    rootReviewId: `fsr-${'1'.repeat(24)}`,
    dispositionIds: ['fr-1234567890abcdef'],
    dispositionDigest: 'a'.repeat(64),
    reviewRanges: [
      {
        base_sha: membership.members[0].pull.base.sha,
        head_sha: membership.members[0].pull.head.sha,
        layer_number: 1,
      },
    ],
    topologyResult: topologyResult(),
    policyDigest: plan.policyDigest,
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  const metadata = parseStackReviewMetadata(report)
  assert.deepEqual(metadata.findings[0].layer_numbers, [1])

  assert.throws(
    () =>
      renderStackReview({
        codeResult: combineOCRResults(
          [completeOCRResult([codeFinding()])],
          [3]
        ),
        headSha: membership.top.head.sha,
        manifestBundle,
        mode: 'incremental',
        rootHead: membership.members[0].pull.base.sha,
        rootReviewId: `fsr-${'1'.repeat(24)}`,
        reviewRanges: [
          {
            base_sha: membership.members[0].pull.base.sha,
            head_sha: membership.members[0].pull.head.sha,
            layer_number: 1,
          },
        ],
        topologyResult: topologyResult(),
        policyDigest: plan.policyDigest,
        workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
        workflowHeadSha: 'a'.repeat(40),
        workflowRunId: 700,
      }),
    /invalid layer provenance/
  )
})

test('rejects a successful finish after lower-layer identity drift', async () => {
  const { github, pulls, responses, state } = stackFixture()
  const membership = await resolveStackMembership({
    github,
    context: context(),
    pullNumber: 14,
  })
  const initialPlan = await buildStackReviewPlan({
    github,
    context: context(),
    membership,
  })
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
    mode: initialPlan.mode,
    rootHead: initialPlan.rootHead,
    rootReviewId: initialPlan.rootReviewId,
    policyDigest: initialPlan.policyDigest,
    dispositionDigest: initialPlan.dispositionDigest,
    codeOutcome: 'success',
    topologyOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(state.createdStatuses.at(-1).state, 'success')

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
    mode: initialPlan.mode,
    rootHead: initialPlan.rootHead,
    rootReviewId: initialPlan.rootReviewId,
    policyDigest: initialPlan.policyDigest,
    dispositionDigest: initialPlan.dispositionDigest,
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
  const plan = await buildStackReviewPlan({
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
    policyDigest: plan.policyDigest,
    trustedPolicySha: 'c'.repeat(40),
    workflowUrl: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
    workflowHeadSha: 'a'.repeat(40),
    workflowRunId: 700,
  })
  assert.match(report, /final-ai-stack-review\/v2/)
  assert.match(
    report,
    /Reviewed verified stack 99 from `bbbbbbbbbbbb` to `ffffffffffff`\./
  )
  assert.match(report, /Cumulative code review/)
  assert.match(report, /Cross-layer topology review/)
  assert.match(report, /src\/one\.ts/)
  const metadata = parseStackReviewMetadata(report)
  assert.equal(metadata.trusted_policy_sha, 'c'.repeat(40))
  assert.equal(metadata.workflow_head_sha, 'a'.repeat(40))
  assert.equal(
    (report.match(/<!-- final-ai-stack-review\/v2/g) ?? []).length,
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
