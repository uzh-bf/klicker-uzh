'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const {
  startAdapter,
  createProgressReporter,
  buildCostReport,
  MISTRAL_MODEL,
  MISTRAL_FLASH_MODEL,
} = require('./ocr-mistral-adapter.cjs')
const { buildOCRResultDiagnostic } = require('./final-ai-review.js')

const DRAFT_MODEL = MISTRAL_FLASH_MODEL
const DRAFT_PROVIDER = 'mistral-flash'
const PUBLIC_DOC_LIBRARIES = [
  '/vercel/next.js',
  '/reactjs/react.dev',
  '/prisma/web',
  '/microsoft/typescript',
]
const PUBLISHER_SHA256 =
  '1d5decf90627353f1e7a2cad291d4ee4ec0a661d9724b93b2d7d5246f33462e2'

function summarizeCoverage(result) {
  return buildOCRResultDiagnostic('draft', { result, status: result?.status })
}

function summarizeAdvisor(tools) {
  const counters = [
    'attempted',
    'dispatched',
    'completed',
    'failed',
    'rejected',
    'cancelled',
    'context_reads',
  ]
    .map(
      (name) =>
        `${name}=${Number.isSafeInteger(tools?.[name]) && tools[name] >= 0 ? tools[name] : 'unknown'}`
    )
    .join(' ')
  const stages = [
    'availability',
    'question',
    'source',
    'request',
    'dispatch',
    'response',
    'advice',
  ]
  const reasons = [
    'invalid_source',
    'invalid_range',
    'source_unavailable',
    'context_too_large',
    'invalid_question',
    'advisor_unavailable',
    'invalid_advice',
    'invalid_finish_reason',
    'invalid_tool_call_count',
    'invalid_tool_name',
    'invalid_advice_shape',
    'invalid_assessment',
    'invalid_answer_type',
    'invalid_answer_length',
    'invalid_evidence_type',
    'invalid_evidence_count',
    'invalid_evidence',
    'transport_error',
    'invalid_response',
    'response_too_large',
    'length',
    'timeout',
    'cancelled',
    'tool_failed',
  ]
  const outcomes = tools?.attempt_outcomes
  const valid =
    Array.isArray(outcomes) &&
    outcomes.length <= 2 &&
    outcomes.every(
      (item, index) =>
        item?.attempt === index + 1 &&
        stages.includes(item.stage) &&
        ['running', 'completed', 'failed'].includes(item.outcome) &&
        (item.reason === null || reasons.includes(item.reason)) &&
        typeof item.dispatched === 'boolean'
    )
  const attempts = valid
    ? JSON.stringify(
        outcomes.map(({ attempt, stage, outcome, reason, dispatched }) => ({
          attempt,
          stage,
          outcome,
          reason,
          dispatched,
        }))
      )
    : 'unknown'
  const status = ['unavailable', 'unused', 'consulted'].includes(tools?.status)
    ? tools.status
    : 'unavailable'
  return `OCR advisor status=${status} registered=${tools?.registered === true} ${counters} attempt_outcomes=${attempts}`
}

function summarizeDocs(docs) {
  const counters = [
    'attempted',
    'upstream_attempts',
    'completed',
    'failed',
    'rejected',
    'cache_hits',
    'cancelled',
    'unknown_usage',
  ]
  if (
    !docs ||
    !['unavailable', 'unused', 'used'].includes(docs.status) ||
    counters.some(
      (name) => !Number.isSafeInteger(docs[name]) || docs[name] < 0
    ) ||
    docs.attempted > 4 ||
    docs.upstream_attempts > docs.attempted ||
    docs.completed + docs.failed > docs.attempted ||
    docs.cancelled > docs.failed ||
    docs.unknown_usage > docs.upstream_attempts
  )
    return 'OCR docs status=unavailable usage_status=unknown actual_billing=unknown'
  let failure = 'unknown'
  if (docs.failed === 0) failure = 'none'
  else if (
    [
      'transport_error',
      'timeout',
      'cancelled',
      'invalid_response',
      'response_too_large',
      'unavailable',
      'http_error',
    ].includes(docs.last_failure)
  )
    failure = docs.last_failure
  let httpStatus = 'unknown'
  if (docs.failed === 0 || docs.last_failure_http_status === null)
    httpStatus = 'none'
  else if (
    Number.isInteger(docs.last_failure_http_status) &&
    docs.last_failure_http_status >= 100 &&
    docs.last_failure_http_status <= 599
  )
    httpStatus = docs.last_failure_http_status
  return `OCR docs status=${docs.status} usage_status=${docs.unknown_usage ? 'partial' : 'complete'} ${counters.map((name) => `${name}=${docs[name]}`).join(' ')} last_failure=${failure} last_failure_http_status=${httpStatus} pro_overage_reference_usd=${(docs.upstream_attempts * 0.005).toFixed(4)} reference_basis=upstream_attempts pricing_date=2026-10-18 actual_billing=unknown`
}

function readResult(file) {
  if (fs.statSync(file).size > 32 * 1024 * 1024)
    throw new Error('invalid_result')
  const result = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('invalid_result')
  return result
}

function preparePublication(temp, expectedHead) {
  const result = readResult(path.join(temp, 'draft-ai-review-result.json'))
  if (result.manifest?.input?.resolved_head !== expectedHead)
    throw new Error('invalid_result')
  const coverage = summarizeCoverage(result)
  if (
    coverage.observed_status === 'unknown' ||
    ['selected', 'completed', 'failed', 'reused', 'waived'].some(
      (key) => coverage[key] === null
    )
  )
    throw new Error('invalid_result')
  if (coverage.observed_status !== 'complete') {
    const message = `⚠️ Review incomplete: selected ${coverage.selected}, completed ${coverage.completed}, reused ${coverage.reused}, failed ${coverage.failed}, waived ${coverage.waived}. Findings cover completed work only.`
    result.message = message
    result.warnings = [
      ...(Array.isArray(result.warnings) ? result.warnings : []),
      { type: 'review_incomplete', message },
    ]
  }
  fs.writeFileSync(
    path.join(temp, 'draft-ai-review-publication.json'),
    JSON.stringify(result),
    { mode: 0o600 }
  )
  fs.writeFileSync(
    path.join(temp, 'draft-ai-review-publisher-stderr.log'),
    '',
    { mode: 0o600 }
  )
}

function appendSummary(text, write) {
  try {
    write(`${text}\n`)
  } catch {
    /* Logs are best-effort. */
  }
  try {
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
  } catch {
    /* Summary failure cannot prevent cleanup. */
  }
}

function gitEnvironment() {
  return Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap((name) =>
      typeof process.env[name] === 'string' ? [[name, process.env[name]]] : []
    )
  )
}

function assertCompleteRange(repo, from, head) {
  const env = {
    ...gitEnvironment(),
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
  try {
    const objects = execFileSync(
      'git',
      ['rev-list', '--objects', '--missing=print', from, head],
      {
        cwd: repo,
        env,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    if (objects.split('\n').some((line) => line.startsWith('?')))
      throw new Error('missing_blob')
    execFileSync(
      'git',
      ['diff', '--no-ext-diff', '--no-textconv', '--stat', from, head, '--'],
      {
        cwd: repo,
        env,
        timeout: 30000,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
  } catch {
    throw new Error('review_source_unavailable')
  }
}

async function runDraftReview(options) {
  const {
    repo,
    temp,
    from,
    head,
    background = '',
    executable = 'ocr',
  } = options
  for (const revision of [from, head]) {
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('invalid_revision')
  }
  if (options.policy) assertCompleteRange(repo, from, head)
  const write = options.write ?? ((text) => process.stdout.write(text))
  const resultPath = path.join(temp, 'draft-ai-review-result.json')
  const stderrPath = path.join(temp, 'draft-ai-review-stderr.log')
  const diagnosticsPath = path.join(
    temp,
    'draft-ai-review-adapter-diagnostics.jsonl'
  )
  const advisorDiagnosticsPath = path.join(
    temp,
    'draft-ai-review-advisor-diagnostics.jsonl'
  )
  const toolsPath = path.join(temp, 'draft-ai-review-tools.json')
  const home = fs.mkdtempSync(path.join(temp, 'draft-ocr-home-'))
  const configDirectory = path.join(home, '.opencodereview')
  fs.mkdirSync(configDirectory, { mode: 0o700 })
  let adapter, advisor, tools, resultFd, stderrFd, progress, child, escalation
  const toolReceipt = (record) => {
    try {
      fs.writeFileSync(toolsPath, JSON.stringify(record), { mode: 0o600 })
    } catch {
      /* Diagnostics cannot prevent cleanup. */
    }
  }
  let toolsState = {
    schema: 'ocr-review-tools/v1',
    status: 'unavailable',
    registered: false,
    attempted: 0,
    dispatched: 0,
    attempt_outcomes: [],
    completed: 0,
    failed: 0,
    rejected: 0,
    cancelled: 0,
    context_reads: 0,
    docs: {
      status: 'unavailable',
      attempted: 0,
      upstream_attempts: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      cache_hits: 0,
      cancelled: 0,
      unknown_usage: 0,
      last_failure: null,
      last_failure_http_status: null,
    },
  }
  const initialAdvisor = {
    schema: 'ocr-review-advisor-expectations/v1',
    expected_receipts: 0,
  }
  fs.writeFileSync(
    path.join(temp, 'draft-ai-review-advisor-expectations.json'),
    JSON.stringify(initialAdvisor),
    { mode: 0o600 }
  )
  toolReceipt(toolsState)
  let terminating = false
  const forward = (signal) => {
    terminating = true
    tools?.close().catch(() => {})
    child?.kill(signal)
    escalation ??= setTimeout(() => child?.kill('SIGKILL'), 10000)
    escalation.unref()
  }
  const terminate = () => forward('SIGTERM')
  const interrupt = () => forward('SIGINT')
  process.on('SIGTERM', terminate)
  process.on('SIGINT', interrupt)
  try {
    adapter = await startAdapter({
      provider: DRAFT_PROVIDER,
      apiKey: options.apiKey,
      onClose: (record) =>
        fs.appendFileSync(diagnosticsPath, `${JSON.stringify(record)}\n`, {
          mode: 0o600,
        }),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    })
    const config = {
      language: 'English',
      llm: {
        url: `${adapter.url}/v1/chat/completions`,
        model: DRAFT_MODEL,
        protocol: 'openai',
        use_anthropic: false,
        auth_header: '',
        auth_token: '',
        auth_token_cmd: 'printf "%s" "$OCR_LLM_TOKEN"',
        extra_body: {
          reasoning_effort: 'max',
          prompt_cache_key: '{ocr_session_key}',
        },
      },
    }
    let rulePath
    if (options.policy) {
      if (!/^[a-f0-9]{40}$/.test(options.policy))
        throw new Error('invalid_revision')
      const skill = execFileSync(
        'git',
        ['show', `${options.policy}:.agents/skills/ocr-reviewer/SKILL.md`],
        {
          cwd: repo,
          env: gitEnvironment(),
          encoding: 'utf8',
          timeout: 5000,
          maxBuffer: 32768,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      rulePath = path.join(home, 'review-rules.json')
      fs.writeFileSync(
        rulePath,
        JSON.stringify({
          rules: [{ path: '**/*', rule: skill, merge_system_rule: true }],
        }),
        { mode: 0o600 }
      )
      try {
        if (options.advisorApiKey) {
          advisor = await startAdapter({
            provider: 'mistral',
            apiKey: options.advisorApiKey,
            ...(options.advisorFetchImpl
              ? { fetchImpl: options.advisorFetchImpl }
              : {}),
            onClose: (record) =>
              fs.appendFileSync(
                advisorDiagnosticsPath,
                `${JSON.stringify(record)}\n`,
                { mode: 0o600 }
              ),
          })
          fs.writeFileSync(
            path.join(temp, 'draft-ai-review-advisor-expectations.json'),
            JSON.stringify({ ...initialAdvisor, expected_receipts: 1 }),
            { mode: 0o600 }
          )
        }
        const { startReviewTools } = require('./ocr-review-tools.cjs')
        tools = await startReviewTools({
          repo,
          head,
          policy: options.policy,
          advisorUrl: advisor
            ? `${advisor.url}/v1/chat/completions`
            : undefined,
          advisorToken: advisor?.token,
          context7ApiKey: options.context7ApiKey,
          publicLibraries: PUBLIC_DOC_LIBRARIES,
          ...(options.context7FetchImpl
            ? { context7FetchImpl: options.context7FetchImpl }
            : {}),
          onDiagnostic: (record) => {
            toolsState = record
            toolReceipt(record)
          },
        })
        for (const [id, method, params] of [
          [
            0,
            'initialize',
            {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'ocr-preflight', version: '1' },
            },
          ],
          [1, 'tools/list', {}],
        ]) {
          const response = await fetch(tools.url, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${tools.token}`,
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              'x-ocr-preflight': '1',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(5000),
          })
          const registered = await response.json()
          if (
            !response.ok ||
            registered.error ||
            (method === 'tools/list' &&
              ![
                'ask_review_advisor',
                'read_review_context',
                'lookup_library_docs',
              ].every((name) =>
                registered.result?.tools?.some((tool) => tool.name === name)
              ))
          )
            throw new Error('tools_unavailable')
        }
        config.mcp_servers = {
          klicker_review: {
            type: 'remote',
            url: tools.url,
            headers: { Authorization: 'Bearer ${OCR_REVIEW_TOOLS_TOKEN}' },
            tools: [
              'ask_review_advisor',
              'read_review_context',
              'lookup_library_docs',
            ],
          },
        }
      } catch {
        await tools?.close()
        tools = undefined
        delete config.mcp_servers
        toolsState = { ...toolsState, status: 'unavailable' }
        toolReceipt(toolsState)
        write('OCR advisor status=unavailable\n')
      }
    }
    fs.writeFileSync(
      path.join(configDirectory, 'config.json'),
      JSON.stringify(config),
      { mode: 0o600 }
    )
    // This allowlist keeps provider and publication credentials out of OCR even
    // when its trusted parent holds both. All model traffic uses local capabilities.
    const env = {
      PATH: process.env.PATH,
      HOME: home,
      TMPDIR: temp,
      LANG: 'C.UTF-8',
      OCR_NO_UPDATE: '1',
      OCR_LLM_TIMEOUT: '480',
      OCR_LLM_URL: config.llm.url,
      OCR_LLM_TOKEN: adapter.token,
      OCR_LLM_MODEL: DRAFT_MODEL,
      OCR_LLM_PROTOCOL: 'openai',
      OCR_USE_ANTHROPIC: 'false',
      ...(tools ? { OCR_REVIEW_TOOLS_TOKEN: tools.token } : {}),
    }
    const args = [
      'review',
      '--from',
      from,
      '--to',
      head,
      '--format',
      'json',
      '--timeout',
      '15',
      '--concurrency',
      '4',
    ]
    if (background) args.push('--background', background)
    if (rulePath) args.push('--rule', rulePath)
    resultFd = fs.openSync(
      resultPath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_TRUNC |
        fs.constants.O_NOFOLLOW,
      0o600
    )
    stderrFd = fs.openSync(
      stderrPath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_TRUNC |
        fs.constants.O_NOFOLLOW,
      0o600
    )
    progress = createProgressReporter(write)
    if (terminating) throw new Error('cancelled')
    child = spawn(executable, args, {
      cwd: repo,
      env,
      stdio: ['ignore', resultFd, 'pipe'],
    })
    const drained = new Promise((resolve) =>
      child.stderr.once('close', resolve)
    )
    child.stderr.on('data', (chunk) => {
      try {
        fs.writeSync(stderrFd, chunk)
      } catch {
        /* Private stderr is best-effort. */
      }
      progress.write(chunk)
    })
    const result = await new Promise((resolve) => {
      child.once('error', () => resolve({ failed: true }))
      child.once('exit', (code, signal) => resolve({ code, signal }))
    })
    let drainTimer
    try {
      await Promise.race([
        drained,
        new Promise((resolve) => {
          drainTimer = setTimeout(resolve, 1000)
        }),
      ])
    } finally {
      clearTimeout(drainTimer)
      child.stderr.destroy()
    }
    progress.finish(result)
    let coverage = summarizeCoverage(null)
    try {
      coverage = summarizeCoverage(readResult(resultPath))
    } catch {
      /* Missing results are unknown, never complete. */
    }
    const counts = ['selected', 'completed', 'failed', 'reused', 'waived']
      .map((key) => `${key}=${coverage[key] ?? 'unknown'}`)
      .join(' ')
    const failures = coverage.failure_classes
      ? JSON.stringify(coverage.failure_classes)
      : 'unknown'
    const line = `OCR coverage status=${coverage.observed_status} ${counts} failure_classes=${failures}`
    appendSummary(line, write)
    if (coverage.observed_status !== 'complete') write(`::warning::${line}\n`)
    fs.writeFileSync(
      path.join(temp, 'draft-ai-review-outcome.json'),
      JSON.stringify(coverage),
      { mode: 0o600 }
    )
    return {
      code: result.signal || result.failed ? 1 : (result.code ?? 1),
      resultPath,
      stderrPath,
      coverage,
    }
  } finally {
    clearTimeout(escalation)
    process.removeListener('SIGTERM', terminate)
    process.removeListener('SIGINT', interrupt)
    progress?.finish({ failed: true })
    await tools?.close()
    if (tools) {
      toolsState = tools.diagnostics()
      toolReceipt(toolsState)
    }
    appendSummary(summarizeAdvisor(toolsState), write)
    appendSummary(summarizeDocs(toolsState.docs), write)
    await advisor?.close()
    await adapter?.close()
    if (resultFd !== undefined) fs.closeSync(resultFd)
    if (stderrFd !== undefined) fs.closeSync(stderrFd)
    fs.rmSync(home, { recursive: true, force: true })
  }
}

function summarizeCosts(temp) {
  const file = path.join(temp, 'draft-ai-review-adapter-diagnostics.jsonl')
  const env = { ...process.env, OCR_ADAPTER_PROVIDER: DRAFT_PROVIDER }
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'ocr-mistral-adapter.cjs'), 'summary', file],
    { env, stdio: 'inherit' }
  )
  const readReport = (name, expected, provider) => {
    try {
      return buildCostReport(
        fs.readFileSync(path.join(temp, name), 'utf8'),
        { adapter: expected },
        provider
      ).estimate
    } catch {
      return null
    }
  }
  const draft = readReport(
    'draft-ai-review-adapter-diagnostics.jsonl',
    1,
    DRAFT_PROVIDER
  )
  let expected
  try {
    expected = JSON.parse(
      fs.readFileSync(
        path.join(temp, 'draft-ai-review-advisor-expectations.json')
      )
    ).expected_receipts
  } catch {
    /* Unknown is not zero. */
  }
  const advisor =
    expected === 0
      ? { withCache: 0, withoutCache: 0, savings: 0 }
      : expected === 1
        ? readReport('draft-ai-review-advisor-diagnostics.jsonl', 1, 'mistral')
        : null
  if (expected === 1)
    execFileSync(
      process.execPath,
      [
        path.join(__dirname, 'ocr-mistral-adapter.cjs'),
        'summary',
        path.join(temp, 'draft-ai-review-advisor-diagnostics.jsonl'),
      ],
      {
        env: { ...process.env, OCR_ADAPTER_PROVIDER: 'mistral' },
        stdio: 'inherit',
      }
    )
  const sum =
    draft && advisor
      ? {
          withCache: draft.withCache + advisor.withCache,
          withoutCache: draft.withoutCache + advisor.withoutCache,
          savings: draft.savings + advisor.savings,
        }
      : null
  const line = sum
    ? `OCR cost scope=draft_and_advisor status=complete estimated_with_cache_usd=${sum.withCache.toFixed(4)} estimated_without_cache_usd=${sum.withoutCache.toFixed(4)} estimated_savings_usd=${sum.savings.toFixed(4)} savings_percent=${(sum.withoutCache ? (100 * sum.savings) / sum.withoutCache : 0).toFixed(1)}`
    : 'OCR cost scope=draft_and_advisor status=unavailable'
  appendSummary(
    `\nCombined ${DRAFT_MODEL} draft and ${MISTRAL_MODEL} advisor reference estimate:\n\n${line}\n\nAdvisor usage retains its separate application allowance and accounting. Both models use Mistral; OCR token accounting is unchanged.`,
    (text) => process.stdout.write(text)
  )
  let docs, tools
  try {
    const receipt = JSON.parse(
      fs.readFileSync(path.join(temp, 'draft-ai-review-tools.json'), 'utf8')
    )
    if (receipt.schema === 'ocr-review-tools/v1') {
      tools = receipt
      docs = receipt.docs
    }
  } catch {
    /* Missing service usage is unknown, not zero. */
  }
  appendSummary(summarizeAdvisor(tools), (text) => process.stdout.write(text))
  appendSummary(
    `${summarizeDocs(docs)}\nContext7 reference pricing excludes subscriptions, included allowances and model tokens. Actual service billing is unknown; the draft_and_advisor model total excludes this service.`,
    (text) => process.stdout.write(text)
  )
}

async function main() {
  const temp = process.env.RUNNER_TEMP ?? os.tmpdir()
  if (process.argv[2] === 'summary') {
    summarizeCosts(temp)
    return 0
  }
  if (process.argv[2] === 'verify-install') {
    const version = execFileSync('ocr', ['version'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    const publisher = fs.readFileSync(
      path.join(
        process.cwd(),
        '.ocr-upstream/scripts/github-actions/post-review-comments.js'
      )
    )
    if (
      !/^open-code-review v?1\.13\.0(?: \(|\s|$)/.test(version) ||
      require('node:crypto')
        .createHash('sha256')
        .update(publisher)
        .digest('hex') !== PUBLISHER_SHA256
    )
      throw new Error('invalid_install')
    process.stdout.write('OCR pinned CLI and publisher verified\n')
    return 0
  }
  if (process.argv[2] === 'validate') {
    preparePublication(temp, process.env.HEAD_SHA)
    return 0
  }
  if (process.argv[2] !== 'run') return 2
  const credentials = {
    apiKey: process.env.MISTRAL_API_KEY,
    advisorApiKey: process.env.MISTRAL_API_KEY,
    context7ApiKey: process.env.CONTEXT7_API_KEY,
  }
  for (const name of Object.keys(process.env)) {
    if (
      /(?:TOKEN|API_KEY|PASSWORD|SECRET|AUTHORIZATION|CREDENTIAL)/i.test(name)
    )
      delete process.env[name]
  }
  const outcome = await runDraftReview({
    repo: process.cwd(),
    temp,
    from: process.env.REVIEW_FROM,
    head: process.env.HEAD_SHA,
    background: process.env.BACKGROUND,
    ...credentials,
    policy: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      env: gitEnvironment(),
    }).trim(),
  })
  return outcome.code
}

module.exports = { runDraftReview, summarizeCoverage }
if (require.main === module)
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch(() => {
      process.stderr.write('OCR draft execution failed\n')
      process.exitCode = 1
    })
