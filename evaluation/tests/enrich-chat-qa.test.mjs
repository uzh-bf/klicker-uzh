import { strict as assert } from 'node:assert'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  EVIDENCE_SCHEMA_VERSION,
  sha256Hex,
} from '../../apps/chat/scripts/klicker-evaluation-evidence.mjs'
import {
  enrichChatQa,
  parseEnrichArguments,
} from '../scripts/enrich-chat-qa.mjs'

const run = promisify(execFile)
const SCRIPT = fileURLToPath(
  new URL('../scripts/enrich-chat-qa.mjs', import.meta.url)
)
const RUN_ID = 'synthetic-run'
const MODEL = 'synthetic-model'
const QUESTION = 'Synthetic question'
const ANSWER = 'Synthetic answer'

function capture(overrides = {}) {
  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    response_id: 'response-1',
    run_id: RUN_ID,
    mode: 'tutor',
    requested_model: MODEL,
    persisted_model: MODEL,
    question_sha256: sha256Hex(QUESTION),
    answer_sha256: sha256Hex(ANSWER),
    status: 'complete',
    passages: ['synthetic-passage-a', 'synthetic-passage-b'],
    ...overrides,
  }
}

function qaCase(overrides = {}) {
  return {
    id: 'response-1',
    question: QUESTION,
    actual_answer: ANSWER,
    expected_answer: 'synthetic expected answer',
    chat_mode: 'tutor',
    retrieval_context: [],
    success: true,
    ...overrides,
  }
}

async function createWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'enrich-chat-qa-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const evidenceDir = join(root, 'evidence')
  await mkdir(evidenceDir, { mode: 0o700 })
  return { root, evidenceDir }
}

async function writeCaptures(evidenceDir, captures) {
  for (const [index, value] of captures.entries()) {
    await writeFile(
      join(evidenceDir, `capture-${index}.json`),
      `${JSON.stringify(value)}\n`,
      { mode: 0o600 }
    )
  }
}

async function writeQa(root, qa) {
  const qaFile = join(root, 'qa.json')
  await writeFile(qaFile, `${JSON.stringify(qa)}\n`)
  return qaFile
}

function enrich(options) {
  return enrichChatQa({
    runId: RUN_ID,
    model: MODEL,
    ...options,
  })
}

test('parseEnrichArguments requires every documented option', () => {
  assert.deepEqual(
    parseEnrichArguments([
      '--qa-file',
      'qa.json',
      '--evidence-dir',
      'evidence',
      '--output',
      'out.json',
      '--run-id',
      RUN_ID,
      '--model',
      MODEL,
    ]),
    {
      qaFile: 'qa.json',
      evidenceDir: 'evidence',
      output: 'out.json',
      runId: RUN_ID,
      model: MODEL,
    }
  )
  assert.throws(() => parseEnrichArguments(['--qa-file', 'qa.json']), {
    code: 'argument_missing:evidenceDir',
  })
  assert.throws(() => parseEnrichArguments(['--unknown']), {
    code: 'arguments_invalid',
  })
})

test('enriches complete cases and preserves the remaining artifact', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [
    capture({ passages: ['synthetic-passage-a', 'synthetic-passage-a'] }),
    capture({
      response_id: 'response-2',
      status: 'empty',
      passages: undefined,
      question_sha256: sha256Hex('Second question'),
      answer_sha256: sha256Hex('Second answer'),
    }),
  ])
  const qaFile = await writeQa(root, {
    metadata: { source: 'synthetic', agent_id: MODEL },
    results: [
      qaCase(),
      qaCase({
        id: 'response-2',
        question: 'Second question',
        actual_answer: 'Second answer',
      }),
      {
        id: 'response-3',
        question: 'Third',
        actual_answer: '',
        success: false,
      },
    ],
  })
  const output = join(root, 'enriched.json')

  const report = await enrich({ qaFile, evidenceDir, output })
  const enriched = JSON.parse(await readFile(output, 'utf8'))

  assert.equal(enriched.metadata.source, 'synthetic')
  assert.equal(enriched.metadata.agent_id, MODEL)
  assert.equal(enriched.metadata.run_id, RUN_ID)
  assert.equal(enriched.metadata.model, MODEL)

  const [complete, empty, failed] = enriched.results
  assert.deepEqual(complete.retrieval_context, [
    'synthetic-passage-a',
    'synthetic-passage-a',
  ])
  assert.equal(complete.expected_answer, 'synthetic expected answer')
  assert.equal(complete.klicker_evidence.status, 'complete')
  assert.equal(complete.klicker_evidence.context_available, true)
  assert.equal(complete.klicker_evidence.passage_count, 2)
  assert.equal(complete.klicker_evidence.response_id, 'response-1')

  assert.deepEqual(empty.retrieval_context, [])
  assert.equal(empty.klicker_evidence.status, 'empty')
  assert.equal(empty.klicker_evidence.context_available, false)

  assert.equal(Object.hasOwn(failed, 'klicker_evidence'), false)
  assert.equal(Object.hasOwn(failed, 'retrieval_context'), false)

  assert.equal(report.results_total, 3)
  assert.equal(report.results_successful, 2)
  assert.equal(report.eligible_context, 1)
  assert.equal(report.ineligible_context, 1)
  assert.equal(report.captures_unreferenced, 0)
})

test('reports every context status distinctly', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  const statuses = ['complete', 'empty', 'no_calls', 'incomplete']
  await writeCaptures(
    evidenceDir,
    statuses.map((status, index) =>
      capture({
        response_id: `response-${index + 1}`,
        status,
        passages: status === 'complete' ? ['synthetic-passage-a'] : undefined,
        reason: status === 'incomplete' ? 'result_malformed' : undefined,
        question_sha256: sha256Hex(`Question ${index}`),
        answer_sha256: sha256Hex(`Answer ${index}`),
      })
    )
  )
  const qaFile = await writeQa(root, {
    metadata: {},
    results: statuses.map((_, index) =>
      qaCase({
        id: `response-${index + 1}`,
        question: `Question ${index}`,
        actual_answer: `Answer ${index}`,
      })
    ),
  })
  const output = join(root, 'enriched.json')

  const report = await enrich({ qaFile, evidenceDir, output })
  const enriched = JSON.parse(await readFile(output, 'utf8'))

  assert.equal(report.context_complete, 1)
  assert.equal(report.context_empty, 1)
  assert.equal(report.context_no_calls, 1)
  assert.equal(report.context_incomplete, 1)
  assert.equal(report.eligible_context, 1)
  assert.equal(report.ineligible_context, 3)

  assert.deepEqual(enriched.results[0].retrieval_context, [
    'synthetic-passage-a',
  ])
  for (const result of enriched.results.slice(1)) {
    assert.deepEqual(result.retrieval_context, [])
  }
})

test('rejects invalid evidence and QA records before writing output', async (t) => {
  const scenarios = [
    {
      name: 'missing capture',
      captures: [capture({ response_id: 'other' })],
      code: 'evidence_missing:response-1',
    },
    {
      name: 'question mismatch',
      captures: [capture({ question_sha256: sha256Hex('other') })],
      code: 'evidence_question_mismatch:response-1',
    },
    {
      name: 'answer mismatch',
      captures: [capture({ answer_sha256: sha256Hex('other') })],
      code: 'evidence_answer_mismatch:response-1',
    },
    {
      name: 'run mismatch',
      captures: [capture({ run_id: 'other-run' })],
      code: 'evidence_run_mismatch:capture-0.json',
    },
    {
      name: 'model mismatch',
      captures: [capture({ persisted_model: 'other-model' })],
      code: 'evidence_model_mismatch:capture-0.json',
    },
    {
      name: 'duplicate capture',
      captures: [capture(), capture()],
      code: 'evidence_duplicate_capture:response-1',
    },
    {
      name: 'unsupported schema version',
      captures: [capture({ schema_version: 2 })],
      code: 'evidence_schema_version_unsupported:capture-0.json',
    },
    {
      name: 'unknown status',
      captures: [capture({ status: 'partial' })],
      code: 'evidence_status_invalid:capture-0.json',
    },
    {
      name: 'passages on a non-complete capture',
      captures: [capture({ status: 'empty' })],
      code: 'evidence_capture_invalid:capture-0.json',
    },
    {
      name: 'complete capture without passages',
      captures: [capture({ passages: [] })],
      code: 'evidence_capture_invalid:capture-0.json',
    },
    {
      name: 'reused response id',
      captures: [capture()],
      results: [qaCase(), qaCase()],
      code: 'evidence_reuse:response-1',
    },
    {
      name: 'already enriched case',
      captures: [capture()],
      results: [qaCase({ retrieval_context: ['stale passage'] })],
      code: 'qa_retrieval_context_present:response-1',
    },
    {
      name: 'existing enrichment receipt',
      captures: [capture()],
      results: [{ ...qaCase(), klicker_evidence: {} }],
      code: 'qa_evidence_receipt_present:response-1',
    },
    {
      name: 'chat mode mismatch',
      captures: [capture()],
      results: [qaCase({ chat_mode: 'explainer' })],
      code: 'evidence_mode_mismatch:response-1',
    },
    {
      name: 'successful case without a chat mode',
      captures: [capture()],
      results: [qaCase({ chat_mode: undefined })],
      code: 'qa_result_invalid:response-1',
    },
    {
      name: 'agent id conflict',
      captures: [capture()],
      metadata: { agent_id: 'other-model' },
      code: 'qa_metadata_conflict:agent_id',
    },
    {
      name: 'imported capture beyond the passage bound',
      captures: [
        capture({ passages: Array.from({ length: 65 }, (_, i) => `p${i}`) }),
      ],
      code: 'evidence_capture_too_large:capture-0.json',
    },
    {
      name: 'unsafe imported passage',
      captures: [capture({ passages: ['api_key=synthetic-value'] })],
      code: 'evidence_content_unsafe',
    },
    {
      name: 'successful case without response id',
      captures: [capture()],
      results: [qaCase({ id: undefined })],
      code: 'qa_result_id_missing',
    },
    {
      name: 'conflicting metadata',
      captures: [capture()],
      metadata: { model: 'other-model' },
      code: 'qa_metadata_conflict:model',
    },
    {
      name: 'hash mismatch on a later case',
      captures: [capture(), capture({ response_id: 'response-9' })],
      results: [qaCase({ id: 'response-9', question: 'different' }), qaCase()],
      code: 'evidence_question_mismatch:response-9',
    },
  ]

  for (const scenario of scenarios) {
    const { root, evidenceDir } = await createWorkspace(t)
    await writeCaptures(evidenceDir, scenario.captures)
    const qaFile = await writeQa(root, {
      metadata: scenario.metadata ?? { source: 'synthetic' },
      results: scenario.results ?? [qaCase()],
    })
    const output = join(root, 'enriched.json')

    await assert.rejects(
      enrich({ qaFile, evidenceDir, output }),
      { code: scenario.code },
      scenario.name
    )
    assert.equal(existsSync(output), false, scenario.name)
  }
})

test('rejects a malformed QA artifact and a missing evidence directory', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  const output = join(root, 'enriched.json')

  const noResults = await writeQa(root, { metadata: {}, results: {} })
  await assert.rejects(enrich({ qaFile: noResults, evidenceDir, output }), {
    code: 'qa_results_invalid',
  })

  const qaFile = await writeQa(root, { metadata: {}, results: [qaCase()] })
  await assert.rejects(
    enrich({ qaFile, evidenceDir: join(root, 'absent'), output }),
    { code: 'evidence_dir_invalid' }
  )

  const broken = join(root, 'broken.json')
  await writeFile(join(evidenceDir, 'capture-0.json'), 'not json')
  await assert.rejects(enrich({ qaFile, evidenceDir, output }), {
    code: 'evidence_file_invalid:capture-0.json',
  })
  assert.equal(existsSync(broken), false)
})

test('refuses to overwrite an existing output artifact', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [capture()])
  const qaFile = await writeQa(root, { metadata: {}, results: [qaCase()] })
  const output = join(root, 'enriched.json')
  await writeFile(output, 'existing artifact\n')

  await assert.rejects(enrich({ qaFile, evidenceDir, output }), {
    code: 'output_exists',
  })
  assert.equal(await readFile(output, 'utf8'), 'existing artifact\n')
})

test('refuses an insecure or symlinked output directory', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [capture()])
  const qaFile = await writeQa(root, { metadata: {}, results: [qaCase()] })

  const shared = join(root, 'shared')
  await mkdir(shared, { mode: 0o755 })
  await chmod(shared, 0o755)
  await assert.rejects(
    enrich({ qaFile, evidenceDir, output: join(shared, 'out.json') }),
    { code: 'evidence_directory_permissions' }
  )

  const linked = join(root, 'linked')
  await symlink(shared, linked)
  await assert.rejects(
    enrich({ qaFile, evidenceDir, output: join(linked, 'out.json') }),
    { code: 'evidence_directory_unsafe' }
  )
  assert.equal(existsSync(join(shared, 'out.json')), false)
})

test('records missing context without inventing a score', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [
    capture({
      status: 'incomplete',
      passages: undefined,
      reason: 'result_unknown',
    }),
  ])
  const qaFile = await writeQa(root, { metadata: {}, results: [qaCase()] })
  const output = join(root, 'enriched.json')

  const report = await enrich({ qaFile, evidenceDir, output })
  const enriched = JSON.parse(await readFile(output, 'utf8'))
  const [result] = enriched.results

  assert.deepEqual(result.retrieval_context, [])
  assert.equal(result.klicker_evidence.status, 'incomplete')
  assert.equal(result.klicker_evidence.context_available, false)
  assert.equal(report.eligible_context, 0)
  assert.equal(report.ineligible_context, 1)
  assert.equal(report.context_incomplete, 1)
})

test('accepts the framework default empty context and agent id', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [capture()])
  const qaFile = await writeQa(root, {
    metadata: { agent_id: MODEL, model: MODEL, run_id: RUN_ID, phase: 'smoke' },
    results: [
      qaCase({ chat_mode: 'tutor', retrieval_context: [] }),
      { id: 'not-run', question: 'Skipped', actual_answer: '', success: false },
    ],
  })
  const output = join(root, 'enriched.json')

  const report = await enrich({ qaFile, evidenceDir, output })
  const enriched = JSON.parse(await readFile(output, 'utf8'))
  const [enrichedCase, skipped] = enriched.results

  assert.deepEqual(enrichedCase.retrieval_context, [
    'synthetic-passage-a',
    'synthetic-passage-b',
  ])
  assert.equal(enrichedCase.chat_mode, 'tutor')
  assert.equal(enrichedCase.klicker_evidence.chat_mode, 'tutor')
  assert.equal(enriched.metadata.agent_id, MODEL)
  assert.equal(enriched.metadata.model, MODEL)
  assert.equal(enriched.metadata.run_id, RUN_ID)
  assert.equal(enriched.metadata.phase, 'smoke')
  assert.equal(report.eligible_context, 1)

  assert.equal(skipped.success, false)
  assert.equal(Object.hasOwn(skipped, 'klicker_evidence'), false)
  assert.equal(Object.hasOwn(skipped, 'retrieval_context'), false)
})

test('cli writes the enriched artifact and exits nonzero on rejection', async (t) => {
  const { root, evidenceDir } = await createWorkspace(t)
  await writeCaptures(evidenceDir, [capture()])
  const qaFile = await writeQa(root, { metadata: {}, results: [qaCase()] })
  const output = join(root, 'enriched.json')
  const args = [
    '--qa-file',
    qaFile,
    '--evidence-dir',
    evidenceDir,
    '--output',
    output,
    '--run-id',
    RUN_ID,
    '--model',
    MODEL,
  ]

  const { stdout } = await run(process.execPath, [SCRIPT, ...args])
  assert.equal(JSON.parse(stdout).eligible_context, 1)
  assert.equal(existsSync(output), true)

  await assert.rejects(
    run(process.execPath, [SCRIPT, '--qa-file', qaFile, '--output', output]),
    (error) => {
      assert.equal(error.code, 1)
      assert.match(error.stderr, /enrich-chat-qa: argument_missing:/)
      return true
    }
  )

  await rm(join(evidenceDir, 'capture-0.json'))
  await rm(output)
  await assert.rejects(run(process.execPath, [SCRIPT, ...args]), (error) => {
    assert.equal(error.code, 1)
    assert.match(error.stderr, /enrich-chat-qa: evidence_missing:response-1/)
    return true
  })
})
