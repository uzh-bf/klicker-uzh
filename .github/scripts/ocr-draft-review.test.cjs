const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { spawnSync, execFileSync } = require('node:child_process')

const { runDraftReview, summarizeCoverage } = require('./ocr-draft-review.cjs')
const RUNNER = path.join(__dirname, 'ocr-draft-review.cjs')

test('draft coverage distinguishes selected files from completed work without exposing model fields', () => {
  const result = {
    status: 'partial',
    summary: { files_reviewed: 3 },
    manifest: {
      coverage: {
        selected: ['a', 'b', 'c'],
        completed: ['a'],
        reused: [],
        waived: [],
        failed: [{ classification: 'provider', reason: 'PRIVATE_SENTINEL' }],
      },
    },
    thinking: 'PRIVATE_SENTINEL',
  }
  const record = summarizeCoverage(result)
  assert.equal(record.observed_status, 'partial')
  assert.equal(record.selected, 3)
  assert.equal(record.completed, 1)
  assert.equal(record.failed, 1)
  assert.equal(JSON.stringify(record).includes('PRIVATE_SENTINEL'), false)
  assert.equal(summarizeCoverage({}).observed_status, 'unknown')
})

test('combined cost estimates use both provider rates and withhold totals for missing advisor usage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-combined-cost-'))
  const receipt = {
    schema_version: 1,
    responses: 1,
    upstream_attempts: 1,
    missing_usage: 0,
    cache_usage_responses: 1,
    missing_cache_usage: 0,
    invalid_cache_usage: 0,
    unfinished_requests: 0,
    prompt_tokens: 1000000,
    completion_tokens: 100000,
    cached_prompt_tokens: 750000,
    uncached_prompt_tokens: 250000,
  }
  const advisorPath = path.join(
    directory,
    'draft-ai-review-advisor-diagnostics.jsonl'
  )
  const run = () =>
    spawnSync(process.execPath, [RUNNER, 'summary'], {
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: directory,
        GITHUB_STEP_SUMMARY: path.join(directory, 'summary.md'),
      },
      encoding: 'utf8',
    })
  try {
    fs.writeFileSync(
      path.join(directory, 'draft-ai-review-adapter-diagnostics.jsonl'),
      JSON.stringify({
        ...receipt,
        provider: 'mistral-flash',
        model: 'zai-glm-5-3-flash',
      })
    )
    fs.writeFileSync(
      advisorPath,
      JSON.stringify({
        ...receipt,
        provider: 'mistral',
        model: 'zai-glm-5-3',
      })
    )
    fs.writeFileSync(
      path.join(directory, 'draft-ai-review-advisor-expectations.json'),
      JSON.stringify({ expected_receipts: 1 })
    )
    const toolsPath = path.join(directory, 'draft-ai-review-tools.json')
    const advisor = {
      status: 'unavailable',
      registered: true,
      attempted: 2,
      dispatched: 1,
      completed: 0,
      failed: 2,
      rejected: 0,
      cancelled: 0,
      context_reads: 1,
      attempt_outcomes: [
        {
          attempt: 1,
          stage: 'source',
          outcome: 'failed',
          reason: 'invalid_source',
          dispatched: false,
        },
        {
          attempt: 2,
          stage: 'advice',
          outcome: 'failed',
          reason: 'length',
          dispatched: true,
        },
      ],
    }
    const docs = {
      status: 'used',
      attempted: 4,
      upstream_attempts: 4,
      completed: 3,
      failed: 1,
      rejected: 1,
      cache_hits: 2,
      cancelled: 0,
      unknown_usage: 1,
      last_failure: 'http_error',
      last_failure_http_status: 401,
    }
    fs.writeFileSync(
      toolsPath,
      JSON.stringify({ schema: 'ocr-review-tools/v1', ...advisor, docs })
    )
    let result = run()
    assert.equal(result.status, 0, result.stderr)
    const advisorLine = result.stdout
      .split('\n')
      .find((line) => line.startsWith('OCR advisor '))
    assert.match(advisorLine, /attempted=2 dispatched=1 completed=0 failed=2/)
    assert.deepEqual(
      JSON.parse(advisorLine.split('attempt_outcomes=')[1]),
      advisor.attempt_outcomes
    )
    assert.ok(
      fs
        .readFileSync(path.join(directory, 'summary.md'), 'utf8')
        .includes(advisorLine)
    )
    assert.match(
      result.stdout,
      /OCR docs status=used usage_status=partial .*unknown_usage=1 .*pro_overage_reference_usd=0.0200/
    )
    assert.match(
      result.stdout,
      /last_failure=http_error last_failure_http_status=401/
    )
    fs.writeFileSync(
      toolsPath,
      JSON.stringify({
        schema: 'ocr-review-tools/v1',
        ...advisor,
        attempt_outcomes: advisor.attempt_outcomes.map((item) => ({
          ...item,
          source: 'PRIVATE_SENTINEL',
        })),
        docs,
      })
    )
    const extra = run()
    assert.equal(extra.status, 0, extra.stderr)
    assert.doesNotMatch(extra.stdout, /PRIVATE_SENTINEL/)
    fs.writeFileSync(
      toolsPath,
      JSON.stringify({
        schema: 'ocr-review-tools/v1',
        ...advisor,
        attempt_outcomes: [
          { ...advisor.attempt_outcomes[0], reason: 'PRIVATE_SENTINEL' },
        ],
        docs,
      })
    )
    const malformed = run()
    assert.equal(malformed.status, 0, malformed.stderr)
    assert.match(malformed.stdout, /attempt_outcomes=unknown/)
    assert.doesNotMatch(malformed.stdout, /PRIVATE_SENTINEL/)
    const diagnosticReasons = [
      'length',
      'invalid_finish_reason',
      'invalid_tool_call_count',
      'invalid_tool_name',
      'invalid_response',
      'invalid_advice_shape',
      'invalid_assessment',
      'invalid_answer_type',
      'invalid_answer_length',
      'invalid_evidence_type',
      'invalid_evidence_count',
      'invalid_evidence',
      'invalid_advice',
    ]
    for (let index = 0; index < diagnosticReasons.length; index += 2) {
      const reasons = diagnosticReasons.slice(index, index + 2)
      const outcomes = reasons.map((reason, offset) => ({
        attempt: offset + 1,
        stage: 'advice',
        outcome: 'failed',
        reason,
        dispatched: true,
        raw: 'PRIVATE_SENTINEL',
      }))
      fs.writeFileSync(
        toolsPath,
        JSON.stringify({
          schema: 'ocr-review-tools/v1',
          ...advisor,
          attempted: outcomes.length,
          dispatched: outcomes.length,
          completed: 0,
          failed: outcomes.length,
          rejected: 0,
          cancelled: 0,
          attempt_outcomes: outcomes,
          docs,
        })
      )
      const diagnostic = run()
      assert.equal(diagnostic.status, 0, diagnostic.stderr)
      const line = diagnostic.stdout
        .split('\n')
        .find((value) => value.startsWith('OCR advisor '))
      assert.ok(line)
      assert.deepEqual(
        JSON.parse(line.split('attempt_outcomes=')[1]).map(
          ({ reason }) => reason
        ),
        reasons
      )
      assert.ok(
        fs
          .readFileSync(path.join(directory, 'summary.md'), 'utf8')
          .includes(line)
      )
      assert.doesNotMatch(diagnostic.stdout, /PRIVATE_SENTINEL/)
      assert.doesNotMatch(
        fs.readFileSync(path.join(directory, 'summary.md'), 'utf8'),
        /PRIVATE_SENTINEL/
      )
    }
    for (const failure of [
      {
        last_failure: 'PRIVATE_SENTINEL',
        last_failure_http_status: 'PRIVATE_SENTINEL',
      },
      { last_failure: undefined, last_failure_http_status: undefined },
    ]) {
      fs.writeFileSync(
        toolsPath,
        JSON.stringify({
          schema: 'ocr-review-tools/v1',
          docs: { ...docs, ...failure },
        })
      )
      const unknown = run()
      assert.equal(unknown.status, 0, unknown.stderr)
      assert.match(
        unknown.stdout,
        /last_failure=unknown last_failure_http_status=unknown/
      )
      assert.match(
        unknown.stdout,
        /dispatched=unknown .*attempt_outcomes=unknown/
      )
      assert.doesNotMatch(unknown.stdout, /PRIVATE_SENTINEL/)
    }
    for (const broken of [
      undefined,
      { ...docs, attempted: -1 },
      { ...docs, upstream_attempts: 5 },
    ]) {
      fs.writeFileSync(
        toolsPath,
        JSON.stringify({ schema: 'ocr-review-tools/v1', docs: broken })
      )
      const unavailable = run()
      assert.equal(unavailable.status, 0, unavailable.stderr)
      assert.match(
        unavailable.stdout,
        /OCR docs status=unavailable usage_status=unknown/
      )
      assert.doesNotMatch(unavailable.stdout, /pro_overage_reference_usd=/)
    }
    const totals =
      /OCR cost scope=draft_and_advisor status=complete estimated_with_cache_usd=([0-9.]+) estimated_without_cache_usd=([0-9.]+) estimated_savings_usd=([0-9.]+)/.exec(
        result.stdout
      )
    assert.ok(totals)
    for (const [index, expected] of [
      [1, 1.005],
      [2, 2.04],
      [3, 1.035],
    ])
      assert.ok(Math.abs(Number(totals[index]) - expected) < 0.000051)
    fs.writeFileSync(
      advisorPath,
      JSON.stringify({ ...receipt, upstream_attempts: 2 })
    )
    result = run()
    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /^OCR cost scope=draft_and_advisor status=unavailable$/m
    )
    assert.doesNotMatch(
      result.stdout,
      /OCR cost scope=draft_and_advisor status=complete/
    )
    fs.rmSync(advisorPath)
    result = run()
    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /^OCR cost scope=draft_and_advisor status=unavailable$/m
    )
    fs.writeFileSync(
      advisorPath,
      JSON.stringify({
        ...receipt,
        provider: 'mistral-flash',
        model: 'zai-glm-5-3-flash',
      })
    )
    assert.match(
      run().stdout,
      /^OCR cost scope=draft_and_advisor status=unavailable$/m
    )
    fs.writeFileSync(
      path.join(directory, 'draft-ai-review-advisor-expectations.json'),
      JSON.stringify({ expected_receipts: 0 })
    )
    const draftOnly = run()
    assert.equal(draftOnly.status, 0, draftOnly.stderr)
    assert.match(
      draftOnly.stdout,
      /^OCR cost scope=draft_and_advisor status=complete estimated_with_cache_usd=0\.1100 estimated_without_cache_usd=0\.2000 estimated_savings_usd=0\.0900 /m
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('publication refuses malformed or mismatched results without reflecting source text', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-publication-'))
  try {
    for (const raw of [
      'PRIVATE_SENTINEL',
      JSON.stringify({
        manifest: { input: { resolved_head: '2'.repeat(40) } },
      }),
    ]) {
      fs.writeFileSync(path.join(directory, 'draft-ai-review-result.json'), raw)
      const result = spawnSync(process.execPath, [RUNNER, 'validate'], {
        env: { RUNNER_TEMP: directory, HEAD_SHA: '1'.repeat(40) },
        encoding: 'utf8',
      })
      assert.equal(result.status, 1)
      assert.equal(
        `${result.stdout}${result.stderr}`.includes('PRIVATE_SENTINEL'),
        false
      )
      assert.equal(
        fs.existsSync(path.join(directory, 'draft-ai-review-publication.json')),
        false
      )
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('publication binds coverage to the exact head and retains complete results while annotating partial coverage', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-publication-valid-')
  )
  const head = '1'.repeat(40)
  const run = () =>
    spawnSync(process.execPath, [RUNNER, 'validate'], {
      env: { RUNNER_TEMP: directory, HEAD_SHA: head },
      encoding: 'utf8',
    })
  const file = path.join(directory, 'draft-ai-review-result.json')
  try {
    const result = {
      status: 'complete',
      comments: [],
      manifest: {
        input: { resolved_head: head },
        coverage: {
          selected: ['a'],
          completed: ['a'],
          failed: [],
          reused: [],
          waived: [],
        },
      },
    }
    fs.writeFileSync(file, JSON.stringify(result))
    assert.equal(run().status, 0)
    const publication = path.join(directory, 'draft-ai-review-publication.json')
    assert.deepEqual(JSON.parse(fs.readFileSync(publication)), result)
    assert.equal(fs.statSync(publication).mode & 0o777, 0o600)
    const stderr = path.join(directory, 'draft-ai-review-publisher-stderr.log')
    assert.equal(fs.readFileSync(stderr, 'utf8'), '')
    assert.equal(fs.statSync(stderr).mode & 0o777, 0o600)
    result.status = 'partial'
    result.manifest.coverage.completed = []
    result.manifest.coverage.failed = [{ classification: 'provider' }]
    fs.writeFileSync(file, JSON.stringify(result))
    assert.equal(run().status, 0)
    const partial = JSON.parse(fs.readFileSync(publication))
    assert.equal(partial.warnings.at(-1).type, 'review_incomplete')
    assert.equal(typeof partial.message, 'string')
    result.manifest.coverage.completed = null
    fs.writeFileSync(file, JSON.stringify(result))
    assert.equal(run().status, 1)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('draft runner streams only bounded progress, retains private results, and isolates its child', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-draft-test-'))
  const executable = path.join(directory, 'ocr.cjs')
  const record = path.join(directory, 'child.json')
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs=require('node:fs')
fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args:process.argv.slice(2),env:process.env}))
console.error('[ocr]   ▶ file_read PRIVATE_SENTINEL')
console.error('::error::PRIVATE_SENTINEL')
process.stdout.write(JSON.stringify({status:'partial',manifest:{coverage:{selected:['a','b','c','d','e'],completed:[],failed:[{classification:'provider'},{classification:'budget'},{classification:'budget'},{classification:'timeout'},{classification:'PRIVATE_SENTINEL',reason:'PRIVATE_SENTINEL'}],waived:[],reused:[]}},thinking:'PRIVATE_SENTINEL'}))
process.exitCode=7
`,
    { mode: 0o700 }
  )
  const previous = process.env.GITHUB_TOKEN
  const previousContext7 = process.env.CONTEXT7_API_KEY
  process.env.GITHUB_TOKEN = 'PRIVATE_SENTINEL'
  process.env.CONTEXT7_API_KEY = 'PRIVATE_SENTINEL'
  const logs = []
  try {
    const outcome = await runDraftReview({
      repo: directory,
      temp: directory,
      from: '1'.repeat(40),
      head: '2'.repeat(40),
      background: 'synthetic',
      executable,
      apiKey: 'synthetic-provider',
      context7ApiKey: 'PRIVATE_SENTINEL',
      write: (line) => logs.push(line),
    })
    assert.equal(outcome.code, 7)
    assert.equal(JSON.stringify(logs).includes('PRIVATE_SENTINEL'), false)
    assert.ok(logs.some((line) => line.includes('event=tool_started')))
    assert.ok(
      logs.some((line) => line.includes('event=process_exited exit_code=7'))
    )
    const child = JSON.parse(fs.readFileSync(record, 'utf8'))
    assert.equal(child.env.GITHUB_TOKEN, undefined)
    assert.equal(child.env.OPENROUTER_API_KEY, undefined)
    assert.equal(child.env.MISTRAL_API_KEY, undefined)
    assert.equal(child.env.CONTEXT7_API_KEY, undefined)
    assert.equal(child.env.OCR_NO_UPDATE, '1')
    assert.equal(child.env.OCR_LLM_MODEL, 'zai-glm-5-3-flash')
    assert.deepEqual(child.args.slice(0, 9), [
      'review',
      '--from',
      '1'.repeat(40),
      '--to',
      '2'.repeat(40),
      '--format',
      'json',
      '--timeout',
      '15',
    ])
    assert.equal(child.args.includes('--effort'), false)
    assert.equal(child.args.includes('--max-tokens-budget'), false)
    assert.equal(fs.statSync(outcome.resultPath).mode & 0o777, 0o600)
    assert.equal(
      JSON.parse(fs.readFileSync(outcome.resultPath)).thinking,
      'PRIVATE_SENTINEL'
    )
    assert.equal(outcome.coverage.observed_status, 'partial')
    const coverageLine = logs.find((line) => line.startsWith('OCR coverage '))
    assert.deepEqual(JSON.parse(coverageLine.split('failure_classes=')[1]), {
      provider: 1,
      budget: 2,
      timeout: 1,
      other: 1,
    })
    const tools = JSON.parse(
      fs.readFileSync(
        path.join(directory, 'draft-ai-review-tools.json'),
        'utf8'
      )
    )
    const advisorLine = logs.find((line) => line.startsWith('OCR advisor '))
    assert.match(advisorLine, new RegExp(`dispatched=${tools.dispatched} `))
    assert.deepEqual(
      JSON.parse(advisorLine.split('attempt_outcomes=')[1]),
      tools.attempt_outcomes
    )
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previous
    if (previousContext7 === undefined) delete process.env.CONTEXT7_API_KEY
    else process.env.CONTEXT7_API_KEY = previousContext7
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('pinned OCR registers and invokes reviewer tools with trusted rules and complete accounting', {
  skip: !process.env.OCR_TEST_BINARY,
  timeout: 60000,
}, async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-native-contract-')
  )
  const repo = path.join(directory, 'repo')
  fs.mkdirSync(repo)
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  fs.mkdirSync(path.join(repo, '.agents/skills/ocr-reviewer'), {
    recursive: true,
  })
  fs.mkdirSync(path.join(repo, 'docs'))
  fs.writeFileSync(
    path.join(repo, '.agents/skills/ocr-reviewer/SKILL.md'),
    'REVIEW_POLICY_SYNTHETIC_MARKER'
  )
  fs.writeFileSync(path.join(repo, 'docs/contract.md'), 'Synthetic contract')
  git('add', '.')
  git('commit', '-m', 'chore: synthetic policy')
  const policy = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(repo, 'source.js'), 'export const value = 1\n')
  git('add', '.')
  git('commit', '-m', 'enhance: synthetic source')
  const head = git('rev-parse', 'HEAD')
  let sequence = 0,
    calls = 0,
    docsCalls = 0,
    offered = false,
    ruleSeen = false
  const response = (model, message, finish_reason) =>
    new Response(
      JSON.stringify({
        id: `synthetic-${++sequence}`,
        model,
        choices: [{ index: 0, message, finish_reason }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 20,
          total_tokens: 1020,
          prompt_tokens_details: { cached_tokens: 800 },
        },
      })
    )
  const logs = []
  const outcome = await runDraftReview({
    repo,
    temp: directory,
    from: policy,
    head,
    policy,
    executable: process.env.OCR_TEST_BINARY,
    apiKey: 'synthetic-mistral',
    advisorApiKey: 'synthetic-advisor',
    context7ApiKey: 'synthetic-docs',
    write: (text) => logs.push(text),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      assert.equal(body.reasoning_effort, 'max')
      const names = body.tools?.map((tool) => tool.function.name) ?? []
      offered ||=
        names.includes('ask_review_advisor') &&
        names.includes('lookup_library_docs')
      ruleSeen ||= JSON.stringify(body.messages).includes(
        'REVIEW_POLICY_SYNTHETIC_MARKER'
      )
      if (!names.includes('task_done'))
        return response(
          'zai-glm-5-3-flash',
          {
            role: 'assistant',
            content: JSON.stringify([{ label: 'source', files: [0] }]),
          },
          'stop'
        )
      const previous = body.messages
        .filter((message) => message.role === 'assistant')
        .flatMap((message) => message.tool_calls ?? [])
        .map((tool) => tool.function.name)
      const name = !previous.includes('read_review_context')
        ? 'read_review_context'
        : !previous.includes('ask_review_advisor')
          ? 'ask_review_advisor'
          : !previous.includes('lookup_library_docs')
            ? 'lookup_library_docs'
            : 'task_done'
      const args =
        name === 'read_review_context'
          ? { path: 'docs/contract.md' }
          : name === 'ask_review_advisor'
            ? {
                question: 'Check this synthetic invariant.',
                context: [{ path: 'source.js', start_line: 1, end_line: 1 }],
              }
            : name === 'lookup_library_docs'
              ? {
                  libraryId: '/vercel/next.js',
                  query: 'cookies async route handler',
                  version: '16',
                  language: 'TypeScript',
                }
              : { state: 'DONE' }
      return response(
        'zai-glm-5-3-flash',
        {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: [{ type: 'text', text: 'PRIVATE_SENTINEL' }],
            },
          ],
          tool_calls: [
            {
              id: `call-${sequence}`,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
        'tool_calls'
      )
    },
    advisorFetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      assert.equal(body.reasoning_effort, 'max')
      assert.equal(body.max_tokens, 16384)
      calls++
      return response(
        'zai-glm-5-3',
        {
          role: 'assistant',
          content: '',
          reasoning_content: 'PRIVATE_SENTINEL',
          tool_calls: [
            {
              id: 'advice',
              type: 'function',
              function: {
                name: 'review_advice',
                arguments: JSON.stringify({
                  assessment: 'uncertain',
                  answer: 'Synthetic uncertainty.',
                  evidence: [
                    {
                      path: 'source.js',
                      line: 1,
                      detail: 'Synthetic source reference.',
                    },
                  ],
                }),
              },
            },
          ],
        },
        'tool_calls'
      )
    },
    context7FetchImpl: async (value, init) => {
      docsCalls++
      const url = new URL(value)
      assert.equal(
        url.origin + url.pathname,
        'https://context7.com/api/v3/search'
      )
      assert.equal(url.searchParams.get('library'), '/vercel/next.js')
      assert.equal(url.searchParams.get('version'), '16')
      assert.equal(
        new Headers(init.headers).get('authorization'),
        'Bearer synthetic-docs'
      )
      assert.equal(init.redirect, 'error')
      return new Response(
        JSON.stringify({
          codeSnippets: [
            {
              libraryId: '/vercel/next.js/v16.2.9',
              codeTitle: 'Synthetic documentation',
              codeId: 'https://example.invalid/docs',
              codeList: [
                {
                  language: 'TypeScript',
                  code: 'SYNTHETIC_DOCS_PRIVATE_SENTINEL',
                },
              ],
            },
          ],
          infoSnippets: [],
          version: {
            requested: '16',
            status: 'verified',
            libraries: [
              {
                libraryId: '/vercel/next.js/v16.2.9',
                requested: '16',
                served: 'v16.2.9',
                status: 'verified',
              },
            ],
          },
        })
      )
    },
  })
  assert.equal(outcome.code, 0)
  assert.equal(outcome.coverage.observed_status, 'complete')
  assert.equal(outcome.coverage.completed, 1)
  const tools = JSON.parse(
    fs.readFileSync(path.join(directory, 'draft-ai-review-tools.json'))
  )
  assert.equal(tools.registered, true)
  assert.equal(tools.completed, calls)
  assert.ok(calls > 0 && calls <= 2)
  assert.ok(offered && ruleSeen)
  assert.equal(tools.docs.completed, docsCalls)
  assert.ok(docsCalls > 0 && docsCalls <= 4)
  assert.match(
    logs.join(''),
    /OCR docs status=used .*pro_overage_reference_usd=/
  )
  assert.equal(logs.join('').includes('PRIVATE_SENTINEL'), false)
  const usage = JSON.parse(
    fs.readFileSync(
      path.join(directory, 'draft-ai-review-advisor-diagnostics.jsonl')
    )
  )
  assert.equal(usage.responses, calls)
  assert.equal(usage.upstream_attempts, calls)
})
