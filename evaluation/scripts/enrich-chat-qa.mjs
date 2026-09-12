#!/usr/bin/env node
// Public QA-artifact enrichment for the local Klicker evaluation target.
//
// The pinned transport ignores response metadata and tool outputs, so the
// document passages the target actually persisted are captured beside the run
// (see apps/chat/scripts/klicker-evaluation-evidence.mjs) and merged back here.
// Each successful QA case is matched to exactly one capture by the completion
// response id and the caller run id, then the question hash, answer hash and
// model are validated. Missing, duplicate, mismatched, reused or already
// enriched records are rejected; no score is invented for a case without
// eligible evidence.
//
// Usage:
//   node evaluation/scripts/enrich-chat-qa.mjs \
//     --qa-file <qa.json> --evidence-dir <dir> --output <enriched.json> \
//     --run-id <run> --model <model>
//
// Each successful case receives:
//   retrieval_context  - the ordered, actual passages; present only when the
//                        capture status is `complete`
//   klicker_evidence   - a namespaced diagnostic receipt (status, hashes,
//                        model, run, passage count)
// The framework always writes an empty `retrieval_context`, so an empty array
// means "not enriched yet"; a populated context or an existing receipt means
// the artifact was already processed and is rejected. Imported capture files
// are re-validated against the capture size bounds rather than trusted. The QA
// metadata gains the run id and model, and every other field of the input
// artifact is preserved. The output is created exclusively with mode 0600 in a
// private non-symlink directory, and all input is validated first, so a
// rejected run never leaves a partial artifact.

import { open, readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  assertPassageSafe,
  readEvidenceCaptureFile,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_STATUSES,
  ensurePrivateDirectory,
  MAX_EVIDENCE_PASSAGES,
  MAX_EVIDENCE_SERIALIZED_BYTES,
  MAX_EVIDENCE_TEXT_BYTES,
  sha256Hex,
} from '../../apps/chat/scripts/klicker-evaluation-evidence.mjs'

const RECEIPT_KEY = 'klicker_evidence'

export function enrichError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

export function parseEnrichArguments(argv) {
  let values
  try {
    ;({ values } = parseArgs({
      args: argv,
      options: {
        'qa-file': { type: 'string' },
        'evidence-dir': { type: 'string' },
        output: { type: 'string' },
        'run-id': { type: 'string' },
        model: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }))
  } catch {
    throw enrichError('arguments_invalid')
  }
  const options = {
    qaFile: values['qa-file'],
    evidenceDir: values['evidence-dir'],
    output: values.output,
    runId: values['run-id'],
    model: values.model,
  }
  for (const [name, value] of Object.entries(options)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw enrichError(`argument_missing:${name}`)
    }
  }
  return options
}

function assertCapture(capture, name, runId, model) {
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
    throw enrichError(`evidence_file_invalid:${name}`)
  }
  if (capture.schema_version !== EVIDENCE_SCHEMA_VERSION) {
    throw enrichError(`evidence_schema_version_unsupported:${name}`)
  }
  if (capture.run_id !== runId) {
    throw enrichError(`evidence_run_mismatch:${name}`)
  }
  if (capture.requested_model !== model || capture.persisted_model !== model) {
    throw enrichError(`evidence_model_mismatch:${name}`)
  }
  if (!EVIDENCE_STATUSES.includes(capture.status)) {
    throw enrichError(`evidence_status_invalid:${name}`)
  }
  if (
    typeof capture.response_id !== 'string' ||
    !capture.response_id ||
    typeof capture.mode !== 'string' ||
    !capture.mode ||
    typeof capture.question_sha256 !== 'string' ||
    typeof capture.answer_sha256 !== 'string'
  ) {
    throw enrichError(`evidence_capture_invalid:${name}`)
  }
  if (capture.status === 'complete') {
    if (
      !Array.isArray(capture.passages) ||
      capture.passages.length === 0 ||
      capture.passages.some(
        (passage) => typeof passage !== 'string' || !passage.trim()
      )
    ) {
      throw enrichError(`evidence_capture_invalid:${name}`)
    }
    for (const passage of capture.passages) assertPassageSafe(passage)
    const totalBytes = capture.passages.reduce(
      (sum, passage) => sum + Buffer.byteLength(passage, 'utf8'),
      0
    )
    if (
      capture.passages.length > MAX_EVIDENCE_PASSAGES ||
      totalBytes > MAX_EVIDENCE_TEXT_BYTES
    ) {
      throw enrichError(`evidence_capture_too_large:${name}`)
    }
  } else if (capture.passages !== undefined) {
    throw enrichError(`evidence_capture_invalid:${name}`)
  }
}

export async function loadEvidenceCaptures({ evidenceDir, runId, model }) {
  let entries
  try {
    entries = await readdir(evidenceDir, { withFileTypes: true })
    await ensurePrivateDirectory(evidenceDir)
  } catch {
    throw enrichError('evidence_dir_invalid')
  }
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
  const captures = new Map()
  for (const name of names) {
    let text
    let capture
    try {
      text = await readEvidenceCaptureFile(join(evidenceDir, name))
      capture = JSON.parse(text)
    } catch {
      throw enrichError(`evidence_file_invalid:${name}`)
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_EVIDENCE_SERIALIZED_BYTES) {
      throw enrichError(`evidence_capture_too_large:${name}`)
    }
    assertCapture(capture, name, runId, model)
    if (captures.has(capture.response_id)) {
      throw enrichError(`evidence_duplicate_capture:${capture.response_id}`)
    }
    captures.set(capture.response_id, capture)
  }
  return captures
}

function assertMetadata(metadata, runId, model) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw enrichError('qa_metadata_invalid')
  }
  for (const [key, expected] of [
    ['run_id', runId],
    ['model', model],
    ['agent_id', model],
  ]) {
    const existing = metadata[key]
    if (existing !== undefined && existing !== expected) {
      throw enrichError(`qa_metadata_conflict:${key}`)
    }
  }
  metadata.run_id = runId
  metadata.model = model
}

function receiptFor(capture) {
  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    run_id: capture.run_id,
    model: capture.requested_model,
    response_id: capture.response_id,
    chat_mode: capture.mode,
    status: capture.status,
    context_available: capture.status === 'complete',
    passage_count: capture.passages ? capture.passages.length : 0,
    passage_sha256: (capture.passages ?? []).map(sha256Hex),
    question_sha256: capture.question_sha256,
    answer_sha256: capture.answer_sha256,
  }
}

function enrichResult(result, capture) {
  const enriched = { ...result, [RECEIPT_KEY]: receiptFor(capture) }
  if (capture.status === 'complete') {
    enriched.retrieval_context = [...capture.passages]
  }
  return enriched
}

function matchCase(result, captures, used) {
  if (typeof result.id !== 'string' || !result.id) {
    throw enrichError('qa_result_id_missing')
  }
  const id = result.id
  if (Object.hasOwn(result, RECEIPT_KEY)) {
    throw enrichError(`qa_evidence_receipt_present:${id}`)
  }
  // The framework always emits `retrieval_context: []`; only a populated or
  // malformed context shows the artifact was already enriched.
  if (
    result.retrieval_context !== undefined &&
    (!Array.isArray(result.retrieval_context) ||
      result.retrieval_context.length > 0)
  ) {
    throw enrichError(`qa_retrieval_context_present:${id}`)
  }
  const capture = captures.get(id)
  if (!capture) throw enrichError(`evidence_missing:${id}`)
  if (used.has(id)) throw enrichError(`evidence_reuse:${id}`)
  if (
    typeof result.actual_answer !== 'string' ||
    typeof result.question !== 'string' ||
    typeof result.chat_mode !== 'string'
  ) {
    throw enrichError(`qa_result_invalid:${id}`)
  }
  if (result.chat_mode !== capture.mode) {
    throw enrichError(`evidence_mode_mismatch:${id}`)
  }
  if (sha256Hex(result.question.trim()) !== capture.question_sha256) {
    throw enrichError(`evidence_question_mismatch:${id}`)
  }
  if (sha256Hex(result.actual_answer) !== capture.answer_sha256) {
    throw enrichError(`evidence_answer_mismatch:${id}`)
  }
  used.add(id)
  return capture
}

export async function enrichChatQa({
  qaFile,
  evidenceDir,
  output,
  runId,
  model,
}) {
  let qa
  try {
    qa = JSON.parse(await readFile(qaFile, 'utf8'))
  } catch {
    throw enrichError('qa_file_invalid')
  }
  if (!qa || typeof qa !== 'object' || Array.isArray(qa)) {
    throw enrichError('qa_file_invalid')
  }
  if (!Array.isArray(qa.results)) throw enrichError('qa_results_invalid')

  const captures = await loadEvidenceCaptures({ evidenceDir, runId, model })
  assertMetadata(qa.metadata, runId, model)

  const used = new Set()
  const counts = {
    complete: 0,
    empty: 0,
    no_calls: 0,
    incomplete: 0,
  }
  let successful = 0
  const results = qa.results.map((rawResult) => {
    if (
      !rawResult ||
      typeof rawResult !== 'object' ||
      Array.isArray(rawResult)
    ) {
      throw enrichError('qa_result_invalid')
    }
    if (rawResult.success !== true) return rawResult
    successful += 1
    const capture = matchCase(rawResult, captures, used)
    counts[capture.status] += 1
    return enrichResult(rawResult, capture)
  })

  const serialized = `${JSON.stringify({ ...qa, results }, null, 2)}\n`
  const outputPath = resolve(output)
  await ensurePrivateDirectory(dirname(outputPath))
  let handle
  try {
    handle = await open(outputPath, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') throw enrichError('output_exists')
    throw enrichError('output_write_failed')
  }
  try {
    await handle.writeFile(serialized, 'utf8')
  } catch {
    throw enrichError('output_write_failed')
  } finally {
    await handle.close().catch(() => {})
  }

  return {
    output: outputPath,
    run_id: runId,
    model,
    schema_version: EVIDENCE_SCHEMA_VERSION,
    results_total: results.length,
    results_successful: successful,
    context_complete: counts.complete,
    context_empty: counts.empty,
    context_no_calls: counts.no_calls,
    context_incomplete: counts.incomplete,
    eligible_context: counts.complete,
    ineligible_context: counts.empty + counts.no_calls + counts.incomplete,
    captures_total: captures.size,
    captures_unreferenced: captures.size - used.size,
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseEnrichArguments(argv)
  const report = await enrichChatQa(options)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(`enrich-chat-qa: ${error?.code || 'failed'}\n`)
    process.exitCode = 1
  })
}
