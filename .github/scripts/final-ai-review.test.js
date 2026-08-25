const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FINAL_REVIEW_MODEL,
  PROMOTION_FILE,
  authorizeFinalReview,
  buildExpectedPromotionContent,
  buildOCRConfig,
  buildReviewBackground,
  decideFinalStatus,
  isFinalReviewCommand,
  isTrustedPermission,
  normalizeTitle,
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
    head: { sha: headSha },
  }
  const statuses = []
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: pull }),
      },
      repos: {
        createCommitStatus: async (status) => statuses.push(status),
        getCollaboratorPermissionLevel: async () => ({
          data: { user: { permission: 'write' } },
        }),
      },
    },
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
  }

  assert.equal(await authorizeFinalReview({ github, context, core }), true)
  assert.equal(outputs.get('base_sha'), baseSha)
  assert.equal(outputs.get('head_sha'), headSha)

  await startFinalReview({
    github,
    context,
    prNumber: 42,
    baseSha,
    headSha,
  })
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
    }),
    /no longer eligible/
  )
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
    reasoning: { effort: 'high' },
  })
  assert.equal(fs.statSync(configPath).mode & 0o777, 0o600)

  removeOCRConfig(configPath)
  assert.equal(fs.existsSync(configPath), false)
})

test('renders findings without making finding count a failure', () => {
  const result = {
    status: 'success',
    llm: { model: FINAL_REVIEW_MODEL },
    summary: { budget_exceeded: false },
    comments: [
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
    ],
  }

  const [report] = renderFinalReviewChunks(result, 'a'.repeat(40))
  assert.match(report, /Gemini 3\.7 Flash \(high reasoning\)/)
  assert.match(report, /src\/example\.ts:10-11/)
  assert.match(report, /Confidence: 75\/100/)
  assert.match(report, /```[\s\S]*\n## Injected heading\n```/)
})

test('rejects incomplete or wrong-model OCR results', () => {
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          status: 'success',
          llm: { model: 'wrong-model' },
          comments: [],
        },
        'a'.repeat(40)
      ),
    /unexpected model/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          status: 'success',
          llm: { model: FINAL_REVIEW_MODEL },
          summary: { budget_exceeded: true },
          comments: [],
        },
        'a'.repeat(40)
      ),
    /exhausted/
  )
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          status: 'success',
          llm: { model: FINAL_REVIEW_MODEL },
          summary: { budget_exceeded: false },
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
        'a'.repeat(40)
      ),
    /confidence score/
  )
})

test('rejects a report that would require partial publication', () => {
  assert.throws(
    () =>
      renderFinalReviewChunks(
        {
          status: 'success',
          llm: { model: FINAL_REVIEW_MODEL },
          summary: { budget_exceeded: false },
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
        'a'.repeat(40)
      ),
    /report limit/
  )
})

test('only succeeds a status for a complete review on the current head', () => {
  const success = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'a',
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(success.state, 'success')

  const stale = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'b',
    reviewOutcome: 'success',
    cleanupOutcome: 'success',
    publishOutcome: 'success',
  })
  assert.equal(stale.state, 'error')

  const failed = decideFinalStatus({
    reviewedHead: 'a',
    currentHead: 'a',
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
