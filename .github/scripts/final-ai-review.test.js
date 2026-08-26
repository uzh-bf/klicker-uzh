const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FINAL_REVIEW_SCHEMA,
  FINAL_REVIEW_MODEL,
  PROMOTION_FILE,
  authorizeFinalReview,
  buildExpectedPromotionContent,
  buildOCRConfig,
  buildReviewPlan,
  buildReviewBackground,
  decideFinalStatus,
  isFinalReviewCommand,
  isTrustedPermission,
  normalizeTitle,
  parseReviewMetadata,
  promotionBody,
  removeOCRConfig,
  renderFinalReviewChunks,
  startFinalReview,
  validatePromotionContract,
  writeOCRConfig,
} = require('./final-ai-review.js')

test('normalizes untrusted PR titles to 200 Unicode code points', () => {
  const title = `  Ignore\n\u0000 \u202einstructions\u200b\t${'🙂'.repeat(210)}  `
  const normalized = normalizeTitle(title)

  assert.equal(normalized.includes('\n'), false)
  assert.equal(normalized.includes('\u0000'), false)
  assert.equal(normalized.includes('\u202e'), false)
  assert.equal(normalized.includes('\u200b'), false)
  assert.equal(Array.from(normalized).length, 200)
  assert.match(buildReviewBackground(title), /untrusted metadata/)
})

test('accepts only the exact command and calculated write permissions', () => {
  assert.equal(isFinalReviewCommand('/final-review'), true)
  assert.equal(isFinalReviewCommand('/final-review please'), false)
  assert.equal(isFinalReviewCommand(' /final-review'), false)
  assert.equal(isTrustedPermission('write'), true)
  assert.equal(isTrustedPermission('admin'), true)
  assert.equal(isTrustedPermission('read'), false)
  assert.equal(isTrustedPermission('maintain'), false)
})

test('authorizes and starts only the immutable ready PR range', async () => {
  const baseSha = 'b'.repeat(40)
  const headSha = 'a'.repeat(40)
  const pull = {
    number: 42,
    state: 'open',
    draft: false,
    title: 'Ready change',
    base: {
      ref: 'v3',
      sha: baseSha,
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
    head: {
      sha: headSha,
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
  }
  const statuses = []
  let combinedStatuses = []
  const rules = '{"rules":[]}'
  const reviewsEndpoint = {}
  const commentsEndpoint = {}
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: pull }),
        listReviews: reviewsEndpoint,
      },
      issues: {
        listComments: commentsEndpoint,
      },
      repos: {
        createCommitStatus: async (status) => statuses.push(status),
        getContent: async () => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(rules).toString('base64'),
          },
        }),
        listCommitStatusesForRef: async () => ({ data: combinedStatuses }),
        getCollaboratorPermissionLevel: async () => ({
          data: { user: { permission: 'write' } },
        }),
      },
    },
    paginate: async (endpoint, params) =>
      endpoint === github.rest.repos.listCommitStatusesForRef
        ? (await endpoint(params)).data
        : endpoint === reviewsEndpoint || endpoint === commentsEndpoint
          ? []
          : [],
  }
  const outputs = new Map()
  const core = {
    notice: () => {},
    setOutput: (name, value) => outputs.set(name, value),
  }
  const context = {
    eventName: 'issue_comment',
    issue: { number: 42 },
    payload: {
      comment: { body: '/final-review', user: { login: 'reviewer' } },
      issue: { pull_request: {} },
      repository: { default_branch: 'v3' },
    },
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runId: 123,
    serverUrl: 'https://github.com',
    sha: 'f'.repeat(40),
  }

  assert.equal(await authorizeFinalReview({ github, context, core }), true)
  assert.equal(outputs.get('base_sha'), baseSha)
  assert.equal(outputs.get('head_sha'), headSha)
  const planInputs = {
    mode: outputs.get('mode'),
    rootHead: outputs.get('root_head'),
    rootReviewId: outputs.get('root_review_id'),
    policyDigest: outputs.get('policy_digest'),
    backgroundDigest: outputs.get('background_digest'),
    scopeKind: outputs.get('scope_kind'),
    stackId: outputs.get('stack_id'),
    stackPosition: outputs.get('stack_position'),
    stackOrderDigest: outputs.get('stack_order_digest'),
    dispositionDigest: outputs.get('disposition_digest'),
  }

  assert.equal(
    await startFinalReview({
      github,
      context,
      prNumber: 42,
      baseSha,
      headSha,
      ...planInputs,
    }),
    true
  )
  assert.equal(statuses.length, 1)
  assert.equal(statuses[0].sha, headSha)
  assert.equal(statuses[0].state, 'pending')

  await assert.rejects(
    startFinalReview({
      github,
      context,
      prNumber: 42,
      baseSha: 'c'.repeat(40),
      headSha,
      ...planInputs,
    }),
    /no longer eligible/
  )

  combinedStatuses = [
    {
      context: 'final-ai-review',
      state: 'pending',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      context: 'final-ai-review',
      state: 'success',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ]
  assert.equal(await authorizeFinalReview({ github, context, core }), true)

  combinedStatuses = [
    ...Array.from({ length: 100 }, (_, index) => ({
      context: `other-${index}`,
      state: 'success',
    })),
    { context: 'final-ai-review', state: 'success' },
  ]
  assert.equal(await authorizeFinalReview({ github, context, core }), false)
  assert.equal(
    await startFinalReview({
      github,
      context,
      prNumber: 42,
      baseSha,
      headSha,
      ...planInputs,
    }),
    false
  )
  assert.equal(statuses.length, 1)
})

test('writes an exact high-reasoning OCR config with mode 0600', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'final-review-config-')
  )
  const configPath = path.join(directory, 'config.json')
  const token = 'dummy-test-token'

  writeOCRConfig({ token, configPath })
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  assert.deepEqual(config, buildOCRConfig({ token }))
  assert.equal(config.llm.model, FINAL_REVIEW_MODEL)
  assert.deepEqual(config.llm.extra_body, {
    provider: { require_parameters: true },
    reasoning: { effort: 'high' },
  })
  assert.equal(fs.statSync(configPath).mode & 0o777, 0o600)

  removeOCRConfig(configPath)
  assert.equal(fs.existsSync(configPath), false)
})

function completeReviewResult(comments = []) {
  return {
    status: 'complete',
    llm: { model: FINAL_REVIEW_MODEL },
    summary: {
      files_reviewed: 1,
      comments: comments.length,
      total_tokens: 100,
      input_tokens: 80,
      output_tokens: 20,
      elapsed: '1s',
    },
    comments,
    manifest: {
      schema_version: 'ocr.run-manifest/v1',
      terminal_state: 'complete',
    },
  }
}

function completeReviewMetadata(headSha = 'a'.repeat(40), overrides = {}) {
  return {
    baseRef: 'v3',
    baseRepo: 'uzh-bf/klicker-uzh',
    baseSha: 'b'.repeat(40),
    backgroundDigest: '1'.repeat(64),
    headRef: 'rs/test-review',
    headRepo: 'uzh-bf/klicker-uzh',
    mode: 'full',
    policyDigest: '2'.repeat(64),
    workflowHeadSha: 'd'.repeat(40),
    workflowRunId: 123,
    ...overrides,
    headSha,
  }
}

function reviewContext() {
  return {
    eventName: 'issue_comment',
    issue: { number: 42 },
    payload: {
      comment: { body: '/final-review', user: { login: 'reviewer' } },
      issue: { pull_request: {} },
      repository: { default_branch: 'v3' },
    },
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runId: 123,
    serverUrl: 'https://github.com',
    sha: 'f'.repeat(40),
  }
}

function reviewGithub({
  pull,
  reviews = [],
  comments = [],
  comparison = { status: 'identical', files: [] },
  comparisons = {},
  statuses = [],
  permission = 'write',
  rules = '{"rules":[]}',
  policyFiles = {},
  stackResponse,
  workflowRun = null,
  pullsByNumber = {},
}) {
  const reviewsEndpoint = {}
  const commentsEndpoint = {}
  const state = {
    comparison,
    comparisons,
    comments,
    pull,
    reviews,
    statuses,
    permission,
    policyFiles,
    rules,
    workflowRun,
  }
  const github = {
    rest: {
      pulls: {
        get: async ({ pull_number }) => ({
          data: pullsByNumber[pull_number] ?? state.pull,
        }),
        listReviews: reviewsEndpoint,
      },
      issues: { listComments: commentsEndpoint },
      repos: {
        compareCommits: async ({ base, head }) => ({
          data: state.comparisons[`${base}...${head}`] ?? state.comparison,
        }),
        getCollaboratorPermissionLevel: async () => ({
          data: { user: { permission: state.permission } },
        }),
        listCommitStatusesForRef: async () => ({ data: state.statuses }),
        getContent: async ({ path: filePath }) => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(
              state.policyFiles[filePath] ?? state.rules
            ).toString('base64'),
          },
        }),
      },
      actions: {
        getWorkflowRun: async () => ({ data: state.workflowRun }),
      },
    },
    paginate: async (endpoint, params) =>
      endpoint === github.rest.repos.listCommitStatusesForRef
        ? (await endpoint(params)).data
        : endpoint === reviewsEndpoint
          ? state.reviews
          : state.comments,
    request: async () => ({ data: stackResponse ?? [] }),
  }
  return { github, state }
}

test('renders findings without making finding count a failure', () => {
  const result = completeReviewResult([
    {
      path: 'src/example.ts',
      content: [
        'Confidence: 75/100',
        'Autofix: manual',
        'Motivating line: `return value`',
        'This can fail at runtime.\n## Injected heading',
      ].join('\n'),
      suggestion_code: 'return value ?? fallback',
      start_line: 10,
      end_line: 11,
      category: 'bug',
      severity: 'high',
    },
  ])

  const metadataInput = completeReviewMetadata()
  const [report] = renderFinalReviewChunks(
    result,
    'a'.repeat(40),
    metadataInput
  )
  assert.match(report, /Gemini 3\.7 Flash \(high reasoning\)/)
  assert.match(report, /src\/example\.ts:10-11/)
  assert.match(report, /Confidence: 75\/100/)
  assert.match(report, /```[\s\S]*\n## Injected heading\n```/)
  const metadata = parseReviewMetadata(report)
  assert.equal(metadata.schema_version, FINAL_REVIEW_SCHEMA)
  assert.equal(metadata.workflow_head_sha, 'd'.repeat(40))
  assert.equal(metadata.trusted_policy_sha, 'd'.repeat(40))
  assert.equal(metadata.finding_ids.length, 1)
  assert.match(report, new RegExp(metadata.finding_ids[0]))
  const rerunMetadata = parseReviewMetadata(
    renderFinalReviewChunks(
      result,
      'a'.repeat(40),
      completeReviewMetadata('a'.repeat(40), { workflowRunId: 124 })
    )[0]
  )
  assert.notEqual(rerunMetadata.review_id, metadata.review_id)
  const tampered = report.replace(
    /"finding_ids":\["fr-[0-9a-f]{16}"\]/u,
    '"finding_ids":["fr-0000000000000000"]'
  )
  assert.equal(parseReviewMetadata(tampered), null)
  assert.equal(
    report,
    renderFinalReviewChunks(result, 'a'.repeat(40), metadataInput)[0]
  )
})

test('authorizes a verified native stack member', async () => {
  const parentPull = {
    number: 41,
    state: 'open',
    draft: false,
    title: 'Parent change',
    base: {
      ref: 'v3',
      sha: 'b'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
    head: {
      ref: 'rs/parent-change',
      sha: 'c'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
  }
  const pull = {
    number: 42,
    state: 'open',
    draft: false,
    title: 'Stacked change',
    base: {
      ref: 'rs/parent-change',
      sha: 'c'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
    head: {
      ref: 'rs/child-change',
      sha: 'a'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
  }
  const { github } = reviewGithub({
    pull,
    stackResponse: [
      {
        id: 'stack-42',
        pull_requests: [
          {
            number: 41,
            state: 'open',
            draft: false,
            head: { sha: 'c'.repeat(40) },
          },
          {
            number: 42,
            state: 'open',
            draft: false,
            head: { sha: 'a'.repeat(40) },
          },
        ],
      },
    ],
    comparison: { status: 'ahead', files: [] },
    pullsByNumber: { 41: parentPull },
  })
  const outputs = new Map()
  const core = {
    notice: () => {},
    setOutput: (name, value) => outputs.set(name, value),
  }

  assert.equal(
    await authorizeFinalReview({
      github,
      context: reviewContext(),
      core,
    }),
    true
  )
  assert.equal(outputs.get('scope_kind'), 'native-stack')
  assert.equal(outputs.get('stack_id'), 'stack-42')
})

test('selects incremental attestation only for bounded repaired changes', async () => {
  const baseSha = 'b'.repeat(40)
  const rootHead = '1'.repeat(40)
  const headSha = '2'.repeat(40)
  const rootPull = {
    number: 42,
    state: 'open',
    draft: false,
    title: 'Incremental review',
    base: {
      ref: 'v3',
      sha: baseSha,
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
    head: {
      ref: 'rs/incremental-review',
      sha: rootHead,
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
  }
  const { github, state } = reviewGithub({
    pull: rootPull,
    statuses: [{ context: 'final-ai-review', state: 'success' }],
  })
  const context = reviewContext()
  const rootPlan = await buildReviewPlan({
    github,
    context,
    pull: rootPull,
  })
  const rootResult = completeReviewResult([
    {
      path: 'src/example.ts',
      content:
        'Confidence: 80/100\nAutofix: manual\nMotivating line: `return value`\nFix the runtime failure.',
      start_line: 10,
      end_line: 10,
      category: 'bug',
      severity: 'high',
    },
  ])
  const [rootBody] = renderFinalReviewChunks(rootResult, rootHead, {
    baseRef: rootPull.base.ref,
    baseRepo: rootPull.base.repo.full_name,
    baseSha,
    headRef: rootPull.head.ref,
    headRepo: rootPull.head.repo.full_name,
    mode: 'full',
    policyDigest: rootPlan.policyDigest,
    backgroundDigest: rootPlan.backgroundDigest,
    scopeKind: rootPlan.scopeKind,
    stackId: rootPlan.stackId,
    stackOrderDigest: rootPlan.stackOrderDigest,
    workflowHeadSha: 'd'.repeat(40),
    workflowRunId: 123,
  })
  const rootMetadata = parseReviewMetadata(rootBody)
  const disposition = `<!-- final-ai-disposition/v1 ${JSON.stringify({
    schema_version: 'final-ai-disposition/v1',
    review_id: rootMetadata.review_id,
    root_head: rootHead,
    workflow_run_id: 123,
    entries: [
      {
        finding_id: rootMetadata.finding_ids[0],
        state: 'fixed',
        reference: `commit:${rootHead}`,
        paths: ['src/example.ts', 'src/example.test.ts'],
      },
    ],
  })} -->`

  state.pull = {
    ...rootPull,
    head: { ...rootPull.head, sha: headSha },
  }
  state.reviews = [
    {
      id: 501,
      body: rootBody,
      commit_id: rootHead,
      state: 'COMMENTED',
      submitted_at: '2026-08-25T00:00:00Z',
      user: { login: 'github-actions[bot]' },
    },
  ]
  state.comments = [
    {
      body: disposition,
      created_at: '2026-08-25T01:00:00Z',
      user: { login: 'reviewer' },
    },
  ]
  state.workflowRun = {
    id: 123,
    path: '.github/workflows/check-ocr-final-review.yml',
    event: 'issue_comment',
    head_branch: 'v3',
    head_sha: 'd'.repeat(40),
    conclusion: 'success',
    repository: { full_name: 'uzh-bf/klicker-uzh' },
  }
  state.statuses = [
    {
      context: 'final-ai-review',
      state: 'success',
      target_url: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/123',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ]
  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'src/example.ts', additions: 4, deletions: 2 }],
  }

  const incremental = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(incremental.mode, 'incremental')
  assert.equal(incremental.rootHead, rootHead)
  assert.equal(incremental.rootReviewId, rootMetadata.review_id)
  assert.deepEqual(incremental.dispositionIds, [rootMetadata.finding_ids[0]])

  state.comments = []
  const withoutDisposition = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(withoutDisposition.mode, 'full')

  state.comments = [{ body: disposition, user: { login: 'reviewer' } }]
  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'package.json', additions: 1, deletions: 1 }],
  }
  const materialChange = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(materialChange.mode, 'full')

  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'src/example.test.ts', additions: 4, deletions: 2 }],
  }
  const relatedCompanion = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(relatedCompanion.mode, 'incremental')

  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'docs/unrelated.md', additions: 1, deletions: 0 }],
  }
  const unrelatedCompanion = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(unrelatedCompanion.mode, 'full')

  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'src/example.ts', additions: 4, deletions: 2 }],
  }
  state.permission = 'read'
  const untrustedDisposition = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(untrustedDisposition.mode, 'full')
  state.permission = 'write'

  state.comments = [
    {
      body: disposition.replace('"state":"fixed"', '"state":"follow-up"'),
      user: { login: 'reviewer' },
    },
  ]
  const deferredDisposition = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(deferredDisposition.mode, 'full')
  state.comments = [{ body: disposition, user: { login: 'reviewer' } }]

  state.rules = '{"rules":["changed"]}'
  const changedDigest = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(changedDigest.mode, 'full')
  state.rules = '{"rules":[]}'

  state.policyFiles['.github/workflows/check-ocr-final-review.yml'] =
    'changed trusted workflow'
  const changedPolicy = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(changedPolicy.mode, 'full')
  delete state.policyFiles['.github/workflows/check-ocr-final-review.yml']

  state.pull = {
    ...state.pull,
    base: { ...state.pull.base, sha: 'c'.repeat(40) },
  }
  state.comparisons[`${baseSha}...${'c'.repeat(40)}`] = {
    status: 'ahead',
    files: [{ filename: 'src/unrelated.ts', additions: 3, deletions: 1 }],
  }
  const advancedBase = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(advancedBase.mode, 'incremental')
  state.comparisons[`${baseSha}...${'c'.repeat(40)}`] = {
    status: 'ahead',
    files: [{ filename: 'src/example.ts', additions: 3, deletions: 1 }],
  }
  const interactingBase = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(interactingBase.mode, 'full')
  state.pull = {
    ...state.pull,
    base: { ...state.pull.base, sha: baseSha },
  }

  state.comparison = {
    status: 'behind',
    files: [{ filename: 'src/example.ts', additions: 4, deletions: 2 }],
  }
  const nonDescendant = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(nonDescendant.mode, 'full')

  state.comparison = {
    status: 'ahead',
    files: Array.from({ length: 21 }, (_, index) => ({
      filename: `docs/change-${index}.md`,
      additions: 1,
      deletions: 0,
    })),
  }
  const overBound = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(overBound.mode, 'full')

  state.comparison = {
    status: 'ahead',
    files: [{ filename: 'src/example.ts', additions: 4, deletions: 2 }],
  }
  state.comments = [
    {
      body: `<!-- final-ai-disposition/v1 ${JSON.stringify({
        schema_version: 'final-ai-disposition/v1',
        review_id: rootMetadata.review_id,
        root_head: rootHead,
        workflow_run_id: 123,
        entries: [
          {
            finding_id: rootMetadata.finding_ids[0],
            state: 'fixed',
            reference: `commit:${rootHead}`,
            paths: ['src/example.ts'],
          },
          {
            finding_id: rootMetadata.finding_ids[0],
            state: 'fixed',
            reference: `commit:${rootHead}`,
            paths: ['src/example.ts'],
          },
        ],
      })} -->`,
      user: { login: 'reviewer' },
    },
  ]
  const duplicateDisposition = await buildReviewPlan({
    github,
    context,
    pull: state.pull,
  })
  assert.equal(duplicateDisposition.mode, 'full')
})

test('rejects incomplete or wrong-model OCR results', () => {
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          llm: { model: 'wrong-model' },
        },
        'a'.repeat(40)
      ),
    /unexpected model/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          summary: { budget_exceeded: true },
        },
        'a'.repeat(40)
      ),
    /exhausted/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          summary: undefined,
        },
        'a'.repeat(40)
      ),
    /review summary/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          summary: {
            ...completeReviewResult().summary,
            comments: 1,
          },
          comments: [
            {
              path: 'src/example.ts',
              content: 'Missing the required evidence fields.',
              start_line: 1,
              end_line: 1,
              category: 'bug',
              severity: 'high',
            },
          ],
        },
        'a'.repeat(40),
        {
          policyDigest: '2'.repeat(64),
          workflowHeadSha: 'd'.repeat(40),
        }
      ),
    /confidence score/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          status: 'partial',
          manifest: {
            schema_version: 'ocr.run-manifest/v1',
            terminal_state: 'partial',
          },
        },
        'a'.repeat(40)
      ),
    /unexpected status: partial/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          warnings: [{ code: 'partial-coverage' }],
        },
        'a'.repeat(40)
      ),
    /coverage warnings/
  )
})

test('rejects malformed native stack membership instead of inferring topology', async () => {
  const pull = {
    number: 42,
    state: 'open',
    draft: false,
    title: 'Malformed stack payload',
    base: {
      ref: 'rs/parent-change',
      sha: 'b'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
    head: {
      ref: 'rs/child-change',
      sha: 'a'.repeat(40),
      repo: { full_name: 'uzh-bf/klicker-uzh' },
    },
  }
  const { github } = reviewGithub({
    pull,
    stackResponse: [{ id: 'stack-42', pull_requests: [{ number: 42 }] }],
  })
  const outputs = new Map()
  const core = {
    notice: () => {},
    setOutput: (name, value) => outputs.set(name, value),
  }

  assert.equal(
    await authorizeFinalReview({
      github,
      context: reviewContext(),
      core,
    }),
    false
  )
  assert.equal(outputs.get('authorized'), 'false')
})

test('rejects a report that would require partial publication', () => {
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          ...completeReviewResult(),
          summary: {
            ...completeReviewResult().summary,
            comments: 1,
          },
          comments: [
            {
              path: 'src/example.ts',
              content: `Confidence: 75/100\nAutofix: manual\nMotivating line: \`return value\`\n${'x'.repeat(55_000)}`,
              start_line: 1,
              end_line: 1,
              category: 'bug',
              severity: 'high',
            },
          ],
        },
        'a'.repeat(40),
        {
          policyDigest: '2'.repeat(64),
          workflowHeadSha: 'd'.repeat(40),
        }
      ),
    /report limit/
  )
})

test('only succeeds a status for a complete review on the current head', () => {
  const success = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'a',
    reviewedBase: 'base-a',
    currentBase: 'base-a',
    eligible: true,
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(success.state, 'success')

  const stale = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'b',
    reviewedBase: 'base-a',
    currentBase: 'base-a',
    eligible: true,
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(stale.state, 'error')

  const staleBase = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'a',
    reviewedBase: 'base-a',
    currentBase: 'base-b',
    eligible: false,
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(staleBase.state, 'error')

  const failed = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'a',
    reviewedBase: 'base-a',
    currentBase: 'base-a',
    eligible: true,
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'failure',
  })
  assert.equal(failed.state, 'failure')
})

function promotionFile(release, tag = 'v3') {
  return Array.from(
    { length: 15 },
    (_, index) =>
      `service${index}:\n  tag: ${tag}\n  podAnnotations:\n    rollout.klicker.uzh.ch/release: '${release}'`
  ).join('\n')
}

function validPromotionInput(sourceBranch = 'v3') {
  const targetSha = '123456789abc'.padEnd(40, 'd')
  const shortSha = targetSha.slice(0, 12)
  const baseContent = promotionFile('aaaaaaaaaaaa')
  const expected = buildExpectedPromotionContent(
    baseContent,
    shortSha,
    sourceBranch
  )

  return {
    pull: {
      state: 'open',
      draft: false,
      baseRef: 'v3',
      baseSha: 'b'.repeat(40),
      baseRepo: 'uzh-bf/klicker-uzh',
      headRef: `chore/promote-stg-${shortSha}`,
      headRepo: 'uzh-bf/klicker-uzh',
      title: `chore(deploy): promote ${shortSha} to stg [skip ci]`,
      body: promotionBody(targetSha),
    },
    permission: 'write',
    repository: 'uzh-bf/klicker-uzh',
    defaultBranch: 'v3',
    sourceBranch,
    commits: [
      {
        message: `chore(deploy): promote ${shortSha} to stg`,
        parents: ['b'.repeat(40)],
      },
    ],
    files: [{ filename: PROMOTION_FILE, status: 'modified' }],
    baseContent,
    headContent: expected.content,
    targetIsAncestor: true,
  }
}

test('accepts current and source-switch generated promotions', () => {
  assert.equal(validatePromotionContract(validPromotionInput()).valid, true)
  assert.equal(
    validatePromotionContract(validPromotionInput('release-candidate')).valid,
    true
  )
})

test('rejects every material promotion-contract deviation', () => {
  const mutations = [
    (input) => {
      input.pull.draft = true
    },
    (input) => {
      input.permission = 'read'
    },
    (input) => {
      input.pull.headRepo = 'attacker/fork'
    },
    (input) => {
      input.pull.title = 'chore(deploy): bypass review'
    },
    (input) => {
      input.pull.body = `${input.pull.body}extra`
    },
    (input) => {
      input.commits.push(input.commits[0])
    },
    (input) => {
      input.commits[0].parents[0] = 'c'.repeat(40)
    },
    (input) => {
      input.files.push({ filename: 'extra.txt', status: 'added' })
    },
    (input) => {
      input.headContent += '\nuntrusted: true\n'
    },
    (input) => {
      input.targetIsAncestor = false
    },
  ]

  for (const mutate of mutations) {
    const input = validPromotionInput()
    mutate(input)
    assert.equal(validatePromotionContract(input).valid, false)
  }
})
