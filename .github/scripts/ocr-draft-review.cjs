'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const {
  startAdapter,
  createProgressReporter,
  buildCostReport,
} = require('./ocr-mistral-adapter.cjs')
const { buildOCRResultDiagnostic } = require('./final-ai-review.js')

const DRAFT_MODEL = 'deepseek/deepseek-v4.1-flash-1017'

function summarizeCoverage(result) {
  return buildOCRResultDiagnostic('draft', { result, status: result?.status })
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
    const message = `Review incomplete: selected ${coverage.selected}, completed ${coverage.completed}, reused ${coverage.reused}, failed ${coverage.failed}, waived ${coverage.waived}. Findings cover completed work only.`
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
  write(`${text}\n`)
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
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
  const write = options.write ?? ((text) => process.stdout.write(text))
  const resultPath = path.join(temp, 'draft-ai-review-result.json')
  const stderrPath = path.join(temp, 'draft-ai-review-stderr.log')
  const diagnosticsPath = path.join(
    temp,
    'draft-ai-review-adapter-diagnostics.jsonl'
  )
  const home = fs.mkdtempSync(path.join(temp, 'draft-ocr-home-'))
  const configDirectory = path.join(home, '.opencodereview')
  fs.mkdirSync(configDirectory, { mode: 0o700 })
  let adapter, resultFd, stderrFd, progress, child, escalation
  const forward = (signal) => {
    child?.kill(signal)
    escalation ??= setTimeout(() => child?.kill('SIGKILL'), 10000)
    escalation.unref()
  }
  const terminate = () => forward('SIGTERM')
  const interrupt = () => forward('SIGINT')
  try {
    adapter = await startAdapter({
      provider: 'openrouter',
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
        extra_headers: '',
        retry_codes: '',
        auth_token_cmd: 'printf "%s" "$OCR_LLM_TOKEN"',
        extra_body: {
          reasoning_effort: 'max',
          prompt_cache_key: '{ocr_session_key}',
        },
      },
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
    child = spawn(executable, args, {
      cwd: repo,
      env,
      stdio: ['ignore', resultFd, 'pipe'],
    })
    const drained = new Promise((resolve) =>
      child.stderr.once('close', resolve)
    )
    child.stderr.on('data', (chunk) => {
      fs.writeSync(stderrFd, chunk)
      progress.write(chunk)
    })
    process.on('SIGTERM', terminate)
    process.on('SIGINT', interrupt)
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
    const line = `OCR coverage status=${coverage.observed_status} ${counts}`
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
    await adapter?.close()
    if (resultFd !== undefined) fs.closeSync(resultFd)
    if (stderrFd !== undefined) fs.closeSync(stderrFd)
    fs.rmSync(home, { recursive: true, force: true })
  }
}

function summarizeCosts(temp) {
  const file = path.join(temp, 'draft-ai-review-adapter-diagnostics.jsonl')
  const env = { ...process.env, OCR_ADAPTER_PROVIDER: 'openrouter' }
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'ocr-mistral-adapter.cjs'), 'summary', file],
    { env, stdio: 'inherit' }
  )
  return buildCostReport(
    fs.readFileSync(file, 'utf8'),
    { adapter: 1 },
    'openrouter'
  )
}

async function main() {
  const temp = process.env.RUNNER_TEMP ?? os.tmpdir()
  if (process.argv[2] === 'summary') {
    summarizeCosts(temp)
    return 0
  }
  if (process.argv[2] === 'validate') {
    preparePublication(temp, process.env.HEAD_SHA)
    return 0
  }
  if (process.argv[2] !== 'run') return 2
  const outcome = await runDraftReview({
    repo: process.cwd(),
    temp,
    from: process.env.REVIEW_FROM,
    head: process.env.HEAD_SHA,
    background: process.env.BACKGROUND,
    apiKey: process.env.OPENROUTER_API_KEY,
  })
  return outcome.code
}

module.exports = { runDraftReview, summarizeCoverage, summarizeCosts }
if (require.main === module)
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch(() => {
      process.stderr.write('OCR draft execution failed\n')
      process.exitCode = 1
    })
