const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { spawnSync, execFileSync } = require('node:child_process')
const {
  validateRepositoryConfig,
  readRepositoryConfig,
  readPolicyBlob,
} = require('./ocr-runtime-config.cjs')

const {
  runDraftReview,
  singleFileOutline,
  summarizeCoverage,
} = require('./ocr-draft-review.cjs')
const {
  MOAT_ADVISOR_MODEL,
  MOAT_FLASH_MODEL,
} = require('./ocr-mistral-adapter.cjs')
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
        provider: 'moat-flash',
        model: MOAT_FLASH_MODEL,
      })
    )
    fs.writeFileSync(
      advisorPath,
      JSON.stringify({
        ...receipt,
        provider: 'moat-advisor',
        model: MOAT_ADVISOR_MODEL,
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
      [1, 0.37775],
      [2, 0.704],
      [3, 0.32625],
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
        provider: 'moat-flash',
        model: MOAT_FLASH_MODEL,
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
      /^OCR cost scope=draft_and_advisor status=complete estimated_with_cache_usd=0\.0330 estimated_without_cache_usd=0\.0600 estimated_savings_usd=0\.0270 /m
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

test('publication accepts a skipped review with empty coverage but still refuses failed or nonempty skips', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-publication-skipped-')
  )
  const head = '1'.repeat(40)
  const run = () =>
    spawnSync(process.execPath, [RUNNER, 'validate'], {
      env: { RUNNER_TEMP: directory, HEAD_SHA: head },
      encoding: 'utf8',
    })
  const file = path.join(directory, 'draft-ai-review-result.json')
  const publication = path.join(directory, 'draft-ai-review-publication.json')
  const skipped = () => ({
    status: 'skipped',
    message: 'Review skipped: no items were selected.',
    comments: [],
    manifest: {
      terminal_state: 'skipped',
      input: { resolved_head: head },
      coverage: {
        selected: [],
        completed: [],
        failed: [],
        reused: [],
        waived: [],
      },
    },
  })
  try {
    fs.writeFileSync(file, JSON.stringify(skipped()))
    assert.equal(run().status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(publication)), skipped())
    for (const change of [
      (result) => {
        result.manifest.run_failure = { classification: 'provider' }
      },
      (result) => {
        result.manifest.coverage.selected = ['a']
      },
      (result) => {
        result.manifest.coverage.waived = null
      },
      (result) => {
        result.manifest.terminal_state = 'complete'
      },
      (result) => {
        result.manifest.input.resolved_head = '2'.repeat(40)
      },
    ]) {
      fs.rmSync(publication, { force: true })
      const result = skipped()
      change(result)
      fs.writeFileSync(file, JSON.stringify(result))
      assert.equal(run().status, 1)
      assert.equal(fs.existsSync(publication), false)
    }
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
  const summary = []
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
      summary: (line) => summary.push(line),
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
    assert.equal(child.env.CMD_API_KEY, undefined)
    assert.equal(child.env.CONTEXT7_API_KEY, undefined)
    assert.equal(child.env.OCR_NO_UPDATE, '1')
    assert.equal(child.env.OCR_LLM_TIMEOUT, '480')
    assert.equal(child.env.OCR_LLM_MODEL, MOAT_FLASH_MODEL)
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
    assert.deepEqual(child.args.slice(9, 11), ['--concurrency', '4'])
    assert.ok(summary.some((line) => line.startsWith('OCR coverage ')))
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

test('draft preflight rejects missing blobs before provider dispatch and strips credentials from metadata Git', async (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-source-preflight-'))
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  fs.mkdirSync(path.join(repo, '.agents/skills/ocr-reviewer'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(repo, '.agents/skills/ocr-reviewer/SKILL.md'),
    'synthetic rules'
  )
  fs.writeFileSync(path.join(repo, 'source.js'), 'export const value = 1\n')
  git('add', '.')
  git('commit', '-m', 'chore: synthetic input')
  const policy = git('rev-parse', 'HEAD')
  const blob = git('rev-parse', 'HEAD:source.js')
  const executable = path.join(repo, 'ocr.cjs')
  fs.writeFileSync(
    executable,
    '#!/usr/bin/env node\nprocess.stdout.write("{}")\n',
    { mode: 0o700 }
  )
  const options = {
    repo,
    temp: repo,
    from: policy,
    head: policy,
    policy,
    executable,
    apiKey: 'synthetic',
    write: () => {},
  }
  const complete = await runDraftReview(options)
  assert.equal(complete.code, 0)
  fs.unlinkSync(
    path.join(repo, '.git/objects', blob.slice(0, 2), blob.slice(2))
  )
  let dispatched = false
  await assert.rejects(
    runDraftReview({
      ...options,
      fetchImpl: async () => {
        dispatched = true
        throw new Error('provider must not run')
      },
    }),
    /review_source_unavailable/
  )
  assert.equal(dispatched, false)

  const wrapper = path.join(repo, 'bin')
  fs.mkdirSync(wrapper)
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
  const receipt = path.join(repo, 'git-env.jsonl')
  fs.writeFileSync(
    path.join(wrapper, 'git'),
    `#!${process.execPath}
const fs=require('node:fs'),{spawnSync}=require('node:child_process')
fs.appendFileSync(${JSON.stringify(receipt)},JSON.stringify({secret:process.env.CMD_API_KEY,token:process.env.GITHUB_TOKEN,docs:process.env.CONTEXT7_API_KEY})+'\\n')
const result=spawnSync(${JSON.stringify(realGit)},process.argv.slice(2),{stdio:'inherit'})
process.exit(result.status??1)
`,
    { mode: 0o700 }
  )
  const failed = spawnSync(process.execPath, [RUNNER, 'run'], {
    cwd: repo,
    env: {
      PATH: `${wrapper}:${process.env.PATH}`,
      RUNNER_TEMP: repo,
      REVIEW_FROM: policy,
      HEAD_SHA: policy,
      CMD_API_KEY: 'PRIVATE_SENTINEL',
      GITHUB_TOKEN: 'PRIVATE_SENTINEL',
      CONTEXT7_API_KEY: 'PRIVATE_SENTINEL',
    },
    encoding: 'utf8',
  })
  assert.equal(failed.status, 1)
  assert.doesNotMatch(failed.stderr, /PRIVATE_SENTINEL/)
  const reads = fs
    .readFileSync(receipt, 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse)
  assert.ok(reads.length >= 2)
  assert.ok(reads.every((record) => Object.keys(record).length === 0))
})

test('repository configuration is strict and frozen at the trusted policy rather than the candidate or moving branch', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-config-'))
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  fs.mkdirSync(path.join(repo, '.github/open-code-review'), { recursive: true })
  fs.mkdirSync(path.join(repo, 'guidance'))
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'trusted contract')
  fs.writeFileSync(path.join(repo, 'guidance/[review].md'), 'trusted guide')
  const config = {
    schema: 'ocr-repository/v1',
    profile: 'draft-v1',
    contextRoots: ['guidance'],
    rootFiles: ['AGENTS.md'],
    guides: ['guidance/[review].md'],
    publicLibraries: ['/python/cpython'],
  }
  const file = path.join(repo, '.github/open-code-review/repository.json')
  fs.writeFileSync(file, JSON.stringify(config))
  git('add', '.')
  git('commit', '-m', 'chore: synthetic policy')
  const policy = git('rev-parse', 'HEAD')
  assert.deepEqual(readRepositoryConfig(repo, policy), config)
  assert.equal(
    readPolicyBlob(repo, policy, 'guidance/[review].md'),
    'trusted guide'
  )
  const original = git('rev-parse', `${policy}:AGENTS.md`)
  const replacement = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repo,
    input: 'substituted contract',
    encoding: 'utf8',
  }).trim()
  git('replace', original, replacement)
  const previousHome = process.env.HOME
  const home = path.join(repo, 'untrusted-home')
  fs.mkdirSync(home)
  fs.writeFileSync(path.join(home, '.gitconfig'), '[malformed global config')
  process.env.HOME = home
  try {
    assert.equal(readPolicyBlob(repo, policy, 'AGENTS.md'), 'trusted contract')
    assert.deepEqual(readRepositoryConfig(repo, policy), config)
  } finally {
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
  git('replace', '-d', original)
  fs.writeFileSync(
    file,
    JSON.stringify({ ...config, publicLibraries: ['/private/candidate'] })
  )
  git('add', '.')
  git('commit', '-m', 'enhance: synthetic candidate')
  assert.deepEqual(readRepositoryConfig(repo, policy), config)
  for (const invalid of [
    { ...config, model: 'unapproved' },
    { ...config, profile: 'final-v1' },
    { ...config, contextRoots: ['../escape'] },
    { ...config, contextRoots: ['.git'] },
    { ...config, rootFiles: ['.env'] },
    { ...config, publicLibraries: ['/../escape'] },
    { ...config, guides: ['unreachable/review.md'] },
    { ...config, publicLibraries: null },
    { ...config, contextRoots: null },
  ])
    assert.throws(
      () => validateRepositoryConfig(invalid),
      /invalid_repository_config/
    )
  fs.writeFileSync(
    file,
    JSON.stringify({ ...config, rootFiles: ['MISSING.md'] })
  )
  git('add', '.')
  git('commit', '-m', 'test: unavailable root')
  assert.throws(
    () => readRepositoryConfig(repo, git('rev-parse', 'HEAD')),
    /invalid_repository_config/
  )
  assert.deepEqual(
    validateRepositoryConfig({ schema: 'ocr-repository/v1' }).publicLibraries,
    []
  )
})

test('outline selection uses the selected group, line churn and stock path identity', () => {
  const key = require('node:crypto')
    .createHash('sha256')
    .update('a.ts')
    .digest('hex')
    .slice(0, 16)
  const block = (count) =>
    '<file path="a.ts">\ndiff --git a/a.ts b/a.ts\n@@ -1 +1,' +
    count +
    ' @@\n-old\n' +
    '+x\n'.repeat(count) +
    '</file>'
  const plan = (group) => [
    {
      role: 'user',
      content:
        '<other_changed_files>\n</other_changed_files>\n\n' +
        group +
        '\n\nCurrent time in the real world: fixture',
    },
  ]
  assert.equal(singleFileOutline(plan(block(498)), key), null)
  assert.ok(singleFileOutline(plan(block(499)), key))
  assert.equal(singleFileOutline(plan(block(499)), '0000000000000000'), null)
  assert.equal(
    singleFileOutline(plan(block(499) + '\n\n' + block(499)), key),
    null
  )
})

test('stock OCR consumes final plans and continues without truncated or empty guidance', {
  skip: !process.env.OCR_TEST_BINARY,
  timeout: 60000,
}, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-plan-guidance-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const repo = path.join(root, 'repo')
  fs.mkdirSync(repo)
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
  fs.writeFileSync(path.join(repo, 'source.js'), 'export const baseline = 1\n')
  git('add', '.')
  git('commit', '-m', 'test: synthetic base')
  const from = git('rev-parse', 'HEAD')
  fs.writeFileSync(
    path.join(repo, 'source.js'),
    Array.from(
      { length: 65 },
      (_, i) => `export const value${i} = ${i}\n`
    ).join('')
  )
  git('add', '.')
  git('commit', '-m', 'test: synthetic candidate')
  let head = git('rev-parse', 'HEAD')
  for (const [content, finish, outcome] of [
    ['SYNTHETIC_FINAL_PLAN', 'stop', 'usable'],
    ['', 'length', 'length'],
    ['SYNTHETIC_PARTIAL_PLAN', 'length', 'length'],
    ['', 'stop', 'empty'],
    [' \n ', 'stop', 'empty'],
    ['', 'stop', 'outline'],
  ]) {
    const localOutline = outcome === 'outline'
    if (localOutline) {
      fs.appendFileSync(
        path.join(repo, 'source.js'),
        Array.from(
          { length: 500 },
          (_, i) => `export function section${i}() {}\n`
        ).join('')
      )
      git('commit', '-am', 'test: large single-file change')
      head = git('rev-parse', 'HEAD')
    }
    const temp = fs.mkdtempSync(path.join(root, 'review-'))
    const logs = []
    let calls = 0,
      plans = 0,
      reviews = 0
    const result = await runDraftReview({
      repo,
      temp,
      from,
      head,
      executable: process.env.OCR_TEST_BINARY,
      apiKey: 'synthetic',
      write: (line) => logs.push(line),
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body)
        calls++
        assert.equal(body.reasoning_effort, 'max')
        assert.equal(body.max_tokens, 16384)
        const main = body.tools?.some(
          (tool) => tool.function.name === 'task_done'
        )
        if (!main) {
          assert.equal(localOutline, false)
          plans++
          assert.match(
            body.prompt_cache_key,
            /^[0-9a-f]{8}-plan_task-[0-9a-f]{16}$/
          )
        } else {
          reviews++
          const input = JSON.stringify(body.messages)
          if (localOutline) {
            assert.match(input, /value0 L1/)
            assert.match(input, /section499 L565/)
            assert.match(input, /-1(?:,1)? \+1,565/)
          }
          assert.equal(
            input.includes('SYNTHETIC_FINAL_PLAN'),
            outcome === 'usable'
          )
          assert.doesNotMatch(
            input,
            /SYNTHETIC_UNFINISHED_REASONING|SYNTHETIC_PARTIAL_PLAN/
          )
        }
        return new Response(
          JSON.stringify({
            id: `synthetic-${calls}`,
            model: MOAT_FLASH_MODEL,
            choices: [
              {
                index: 0,
                finish_reason: main ? 'tool_calls' : finish,
                message: main
                  ? {
                      role: 'assistant',
                      content: '',
                      tool_calls: [
                        {
                          id: `done-${calls}`,
                          type: 'function',
                          function: {
                            name: 'task_done',
                            arguments: JSON.stringify({ state: 'DONE' }),
                          },
                        },
                      ],
                    }
                  : {
                      role: 'assistant',
                      content,
                      reasoning_content: 'SYNTHETIC_UNFINISHED_REASONING',
                    },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: main ? 20 : 16384,
              total_tokens: main ? 120 : 16484,
              prompt_tokens_details: { cached_tokens: 80 },
            },
          })
        )
      },
    })
    assert.equal(result.code, 0)
    assert.equal(result.coverage.observed_status, 'complete')
    assert.equal(result.coverage.selected, 1)
    assert.equal(result.coverage.completed, 1)
    assert.equal(result.coverage.failed, 0)
    assert.deepEqual(
      [calls, plans, reviews],
      localOutline ? [1, 0, 1] : [2, 1, 1]
    )
    const diagnostic = JSON.parse(
      fs.readFileSync(
        path.join(temp, 'draft-ai-review-adapter-diagnostics.jsonl')
      )
    )
    assert.equal(diagnostic.upstream_attempts, calls)
    assert.equal(diagnostic.responses, calls)
    assert.equal(diagnostic.prompt_tokens, 100 * calls)
    assert.equal(diagnostic.cached_prompt_tokens, 80 * calls)
    assert.equal(diagnostic.completion_tokens, localOutline ? 20 : 16404)
    if (localOutline) {
      assert.equal(diagnostic.plan_guidance.local_outlines, 1)
      assert.equal(diagnostic.plan_guidance.responses, 0)
      continue
    }
    assert.equal(diagnostic.plan_guidance.responses, 1)
    assert.equal(diagnostic.plan_guidance[outcome], 1)
    assert.match(logs.join(''), /OCR planning status=complete responses=1 /)
    assert.doesNotMatch(logs.join(''), /SYNTHETIC_|plan_task-/)
    const journal = fs
      .readFileSync(
        path.join(
          temp,
          'draft-ai-review-adapter-diagnostics.jsonl.events.jsonl'
        ),
        'utf8'
      )
      .trim()
      .split('\n')
      .map(JSON.parse)
    const plan = journal.find(
      (row) => row.event === 'response' && row.kind === 'auxiliary'
    )
    assert.equal(plan.finish_reason, finish)
    assert.equal(plan.content_bytes, Buffer.byteLength(content))
    assert.equal(
      plan.reasoning_bytes,
      Buffer.byteLength('SYNTHETIC_UNFINISHED_REASONING')
    )
  }
})

function initFixtureGit(root) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  return git
}

test('stock OCR retains draft evidence after an empty tool-call compression and consumes the next visible summary', {
  skip: !process.env.OCR_TEST_BINARY,
  timeout: 60000,
}, async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-visible-compression-')
  )
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const git = initFixtureGit(root)
  git('commit', '--allow-empty', '-m', 'test: base')
  const from = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(root, 'source.js'), 'export const value = 1\n')
  git('add', 'source.js')
  git('commit', '-m', 'test: candidate')

  let compressions = 0,
    mainTurns = 0,
    sawSummary = false,
    preservedEvidence = false
  let upstreamCalls = 0
  const logs = []
  const result = await runDraftReview({
    repo: root,
    temp: root,
    from,
    head: git('rev-parse', 'HEAD'),
    executable: process.env.OCR_TEST_BINARY,
    apiKey: 'synthetic',
    write: (line) => logs.push(line),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body)
      const input = JSON.stringify(body.messages)
      assert.equal(body.reasoning_effort, 'max')
      assert.equal(body.max_tokens, 16384)
      let message, finish
      const toolCall = (name, args) => ({
        id: 'call-' + upstreamCalls,
        type: 'function',
        function: { name, arguments: JSON.stringify(args) },
      })
      if (body.prompt_cache_key?.includes('-memory_compression_task-')) {
        compressions++
        if (compressions === 1) {
          assert.ok(input.includes('EARLY_EVIDENCE'))
          message = {
            content: '',
            reasoning_content: 'UNFINISHED_PRIVATE_SUMMARY',
            tool_calls: [toolCall('unexpected', {})],
          }
          finish = 'tool_calls'
        } else {
          preservedEvidence ||= input.includes('EARLY_EVIDENCE')
          message = {
            content: 'VISIBLE_COMPLETE_SUMMARY',
            reasoning_content: 'UNFINISHED_PRIVATE_SUMMARY',
          }
          finish = 'stop'
        }
      } else {
        mainTurns++
        assert.ok(mainTurns <= 35)
        assert.ok(!input.includes('UNFINISHED_PRIVATE_SUMMARY'))
        sawSummary ||= input.includes('VISIBLE_COMPLETE_SUMMARY')
        // Grow actual stock history past its compression threshold using
        // synthetic turns within the existing per-response ceiling.
        message = {
          content: mainTurns === 1 ? 'EARLY_EVIDENCE' : '',
          reasoning_content: ' x'.repeat(12000),
          tool_calls: [
            sawSummary
              ? toolCall('task_done', {})
              : toolCall('file_find', { pattern: 'source.js' }),
          ],
        }
        finish = 'tool_calls'
        // The stock CLI must echo the intervening file_find result before
        // the adapter admits the second empty response.
        if (mainTurns === 2 || mainTurns === 4) {
          message = { content: '', reasoning_content: 'unfinished' }
          finish = 'length'
        }
      }
      upstreamCalls++
      return new Response(
        JSON.stringify({
          model: MOAT_FLASH_MODEL,
          choices: [
            {
              index: 0,
              finish_reason: finish,
              message: { role: 'assistant', ...message },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 12050,
            total_tokens: 12070,
            prompt_tokens_details: { cached_tokens: 10 },
          },
        })
      )
    },
  })
  assert.equal(result.coverage.completed, 1)
  assert.ok(preservedEvidence && sawSummary)
  const diag = JSON.parse(
    fs.readFileSync(
      path.join(root, 'draft-ai-review-adapter-diagnostics.jsonl')
    )
  )
  assert.equal(diag.main_no_tool_responses, 2)
  assert.equal(diag.failures.length_no_tool, 0)
  assert.equal(diag.upstream_attempts, upstreamCalls)
  assert.equal(diag.responses, upstreamCalls)
  assert.equal(diag.completion_tokens, 12050 * upstreamCalls)
  assert.equal(diag.draft_compression.skipped, 1)
  assert.ok(diag.draft_compression.usable >= 1)
  const { usable, skipped, repeat_skips } = diag.draft_compression
  assert.ok(
    logs
      .join('')
      .includes(
        `OCR draft compression usable=${usable} skipped=${skipped} repeat_skips=${repeat_skips}`
      )
  )
})

test('required draft qualification verifies the executable before accepting its results', () => {
  if (process.env.OCR_REQUIRE_DRAFT_BINARY !== '1') return
  const executable = process.env.OCR_TEST_DRAFT_BINARY
  assert.ok(executable, 'required draft OCR binary is missing')
  const version = execFileSync(executable, ['version'], {
    env: { ...process.env, OCR_NO_UPDATE: '1' },
    encoding: 'utf8',
    timeout: 5000,
  })
  require('./install-patched-ocr.cjs').verifyDraftVersion(version)
})

for (const divisor of [0, 1]) {
  test(`draft second pass closes a ${divisor ? 'ruled-out' : 'verified'} candidate`, {
    skip: !process.env.OCR_TEST_DRAFT_BINARY,
    timeout: 60000,
  }, async (t) => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-second-pass-'))
    t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
    const git = initFixtureGit(repo)
    fs.writeFileSync(
      path.join(repo, 'settings.js'),
      `export const divisor = ${divisor}\n`
    )
    git('add', 'settings.js')
    git('commit', '-m', 'test: settings')
    const from = git('rev-parse', 'HEAD')
    const first = 'export const first = 1 / 0'
    const second = 'export const second = 1 / divisor'
    fs.writeFileSync(
      path.join(repo, 'calc.js'),
      ["import { divisor } from './settings.js'", first, second, ''].join('\n')
    )
    git('add', 'calc.js')
    git('commit', '-m', 'test: candidate')
    const turns = [[], []]
    const progress = []
    const guidedPasses = new Set()
    let evidenceRead
    let id = 0
    const outcome = await runDraftReview({
      repo,
      temp: repo,
      from,
      head: git('rev-parse', 'HEAD'),
      executable: process.env.OCR_TEST_DRAFT_BINARY,
      apiKey: 'synthetic',
      write: (line) => progress.push(line),
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body)
        const names = body.tools.map((tool) => tool.function.name)
        let name = 'approve_all_comments',
          args = {}
        if (names.includes('task_done')) {
          const inSecond = body.messages.some(
            (m) =>
              m.role === 'user' && m.content.includes('<confirmed_findings>')
          )
          const pass = Number(inSecond)
          if (
            body.messages.some(
              (m) =>
                m.role === 'user' &&
                m.content.includes('[ocr:second-pass-closure]')
            )
          )
            guidedPasses.add(pass)
          const trace = turns[pass]
          if (trace.at(-1) === 'file_read')
            evidenceRead = body.messages.at(-1).content
          if (trace.length === 0 && inSecond) {
            name = 'file_read'
            args = { file_path: 'settings.js' }
          } else if (
            trace.length === 0 ||
            (trace.at(-1) === 'file_read' &&
              body.messages.at(-1).content.includes('divisor = 0'))
          ) {
            name = 'code_comment'
            args = {
              comments: [
                {
                  path: 'calc.js',
                  existing_code: inSecond ? second : first,
                  severity: 'medium',
                  category: 'bug',
                  content: 'Division by zero produces a non-finite result.',
                },
              ],
            }
          } else {
            name = 'task_done'
            args = { state: 'DONE' }
          }
          trace.push(name)
        } else {
          assert.ok(names.includes(name))
        }
        return new Response(
          JSON.stringify({
            model: MOAT_FLASH_MODEL,
            choices: [
              {
                index: 0,
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: `call-${++id}`,
                      type: 'function',
                      function: { name, arguments: JSON.stringify(args) },
                    },
                  ],
                },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: 120,
            },
          })
        )
      },
    })
    assert.equal(outcome.code, 0)
    assert.equal(outcome.coverage.completed, 1)
    assert.deepEqual(
      progress.filter((line) =>
        line.startsWith('OCR progress event=second_pass_')
      ),
      [
        'OCR progress event=second_pass_started\n',
        'OCR progress event=second_pass_completed\n',
      ]
    )
    assert.deepEqual([...guidedPasses], [1])
    assert.ok(evidenceRead?.includes(`export const divisor = ${divisor}`))
    assert.deepEqual(turns[0], ['code_comment', 'task_done'])
    assert.deepEqual(
      turns[1],
      divisor
        ? ['file_read', 'task_done']
        : ['file_read', 'code_comment', 'task_done']
    )
    const result = JSON.parse(fs.readFileSync(outcome.resultPath))
    assert.ok(!result.warnings?.some((w) => w.type === 'review_round_failed'))
    assert.equal(result.comments.length, divisor ? 1 : 2)
  })
}

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
  fs.mkdirSync(path.join(repo, '.github/open-code-review'), { recursive: true })
  fs.writeFileSync(
    path.join(repo, '.github/open-code-review/repository.json'),
    JSON.stringify({
      schema: 'ocr-repository/v1',
      publicLibraries: ['/vercel/next.js'],
    })
  )
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
    apiKey: 'synthetic-moat',
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
          MOAT_FLASH_MODEL,
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
        MOAT_FLASH_MODEL,
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
        MOAT_ADVISOR_MODEL,
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
  for (const name of ['draft-ai-review-adapter', 'draft-ai-review-advisor']) {
    const events = fs
      .readFileSync(
        path.join(directory, name + '-diagnostics.jsonl.events.jsonl'),
        'utf8'
      )
      .trim()
      .split('\n')
      .map(JSON.parse)
    assert.ok(events.some((row) => row.event === 'response'))
    assert.equal(
      events.filter((row) => row.event === 'dispatch').length,
      events.filter((row) => row.event === 'response').length
    )
    assert.equal(JSON.stringify(events).includes('PRIVATE_SENTINEL'), false)
  }
  assert.ok(tools.tool_results.read_review_context.calls > 0)
  assert.ok(tools.tool_results.read_review_context.returned_bytes > 0)
})

test('paused drafts create an explicit unavailable outcome without credentials, provider calls or a child', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-paused-draft-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const logs = []
  const outcome = await runDraftReview({
    repo: temp,
    temp,
    from: '1'.repeat(40),
    head: '2'.repeat(40),
    paused: true,
    executable: '/must-not-execute',
    fetchImpl: () => assert.fail('provider called while paused'),
    write: (text) => logs.push(text),
  })
  assert.equal(outcome.code, 0)
  assert.equal(fs.existsSync(outcome.resultPath), false)
  const receipt = JSON.parse(
    fs.readFileSync(path.join(temp, 'draft-ai-review-outcome.json'))
  )
  assert.equal(receipt.provider_availability.reason, 'provider_paused')
  assert.notEqual(receipt.observed_status, 'complete')
  assert.equal(receipt.completed, null)
  assert.equal(
    logs.some((text) => text.includes('status=unavailable')),
    true
  )
})

test('stock OCR stops upstream dispatch after 402 and preserves its incomplete result', {
  skip: !process.env.OCR_TEST_BINARY,
  timeout: 60000,
}, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-stock-payment-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: temp,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  fs.writeFileSync(path.join(temp, 'source.js'), 'export const value = 1\n')
  git('add', '.')
  git('commit', '-m', 'test: synthetic base')
  const from = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(temp, 'source.js'), 'export const value = 2\n')
  git('add', '.')
  git('commit', '-m', 'test: synthetic candidate')
  const head = git('rev-parse', 'HEAD')
  let calls = 0
  const logs = []
  const outcome = await runDraftReview({
    repo: temp,
    temp,
    from,
    head,
    executable: process.env.OCR_TEST_BINARY,
    apiKey: 'synthetic-provider',
    fetchImpl: async () => {
      calls++
      return new Response('PRIVATE_PROVIDER_SENTINEL', { status: 402 })
    },
    write: (text) => logs.push(text),
  })
  assert.equal(calls, 1)
  assert.equal(outcome.code, 0)
  assert.equal(fs.existsSync(outcome.resultPath), true)
  assert.equal(outcome.coverage.selected, 1)
  assert.equal(outcome.coverage.failed, 1)
  assert.equal(outcome.coverage.completed, 0)
  const receipt = JSON.parse(
    fs.readFileSync(path.join(temp, 'draft-ai-review-outcome.json'))
  )
  assert.equal(
    receipt.provider_availability.reason,
    'provider_payment_required'
  )
  assert.notEqual(receipt.observed_status, 'complete')
  assert.doesNotMatch(logs.join(''), /PRIVATE_PROVIDER_SENTINEL/)
  const adapter = JSON.parse(
    fs.readFileSync(
      path.join(temp, 'draft-ai-review-adapter-diagnostics.jsonl')
    )
  )
  assert.equal(adapter.upstream_attempts, 1)
  assert.equal(adapter.responses, 0)
})
