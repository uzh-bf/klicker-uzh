const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { runDraftReview, summarizeCoverage } = require('./ocr-draft-review.cjs')

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
process.stdout.write(JSON.stringify({status:'partial',manifest:{coverage:{selected:['x'],completed:[],failed:[{classification:'provider'}],waived:[],reused:[]}},thinking:'PRIVATE_SENTINEL'}))
process.exitCode=7
`,
    { mode: 0o700 }
  )
  const previous = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = 'PRIVATE_SENTINEL'
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
    assert.equal(child.env.OCR_NO_UPDATE, '1')
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
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previous
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
