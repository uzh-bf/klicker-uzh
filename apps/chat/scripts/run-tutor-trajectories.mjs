#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { open, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_CHATBOT_ID,
  DEFAULT_MAX_STREAM_BYTES,
  DEFAULT_MODEL_ID,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  evaluationError,
  finiteCredits,
  KlickerEvaluationTarget,
} from './klicker-evaluation-target.mjs'
import { validateNumericSidecar } from './tutor-numeric-reference.mjs'
import {
  runTrajectory,
  TRAJECTORY_GROUPS,
  validateTrajectoryCorpus,
} from './tutor-trajectory.mjs'

// Experiment-wide limits shared by every arm through one budget file. The
// ledger counts submitted requests before they leave the process and adds the
// actual credits each finished turn reports; the request in flight may cross
// the credit ceiling.
export const DEFAULT_MAX_SUBMITTED_TURNS = 160
export const DEFAULT_MAX_APPLICATION_CREDITS = 3
export const TRAJECTORY_ARMS = ['baseline', 'candidate', 'auto']

const VALUE_FLAGS = {
  '--corpus': 'corpus',
  '--output': 'output',
  '--arm': 'arm',
  '--repeats': 'repeats',
  '--budget-file': 'budgetFile',
  '--group': 'group',
  '--numeric': 'numeric',
}

const BUDGET_LEDGER_FIELDS = new Set([
  'version',
  'maxSubmittedTurns',
  'maxApplicationCredits',
  'submittedTurns',
  'creditsUsed',
  'uncertain',
])

const USAGE = [
  'Usage: node apps/chat/scripts/run-tutor-trajectories.mjs --corpus <file> --output <file> --arm <baseline|candidate|auto> --budget-file <file> [--repeats <n>] [--group <development|reserved|control>] [--numeric <sidecar>]',
  '',
  'Runs a frozen trajectory corpus against the local evaluation target and',
  'writes one sanitized JSONL receipt per verified turn. The output file is',
  'created exclusively and never overwritten. The shared budget ledger counts',
  'submitted requests and actual credits across sequential arms. An optional',
  'numerical sidecar is checked against the corpus before login.',
  '',
  'Credentials come from KLICKER_EVAL_API_ORIGIN, KLICKER_EVAL_CHAT_ORIGIN,',
  'KLICKER_EVAL_PARTICIPANT_USERNAME and KLICKER_EVAL_PARTICIPANT_PASSWORD;',
  'KLICKER_EVAL_MODEL_ID defaults to the fixed gpt-6-luna selection.',
].join('\n')

export function parseArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true }

  const options = { repeats: 2, group: null, numeric: null, help: false }
  const seen = new Set()
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const key = VALUE_FLAGS[flag]
    if (!key || seen.has(flag)) throw evaluationError('arguments_invalid')
    seen.add(flag)
    const value = argv[index + 1]
    if (typeof value !== 'string' || value.startsWith('--')) {
      throw evaluationError('arguments_invalid')
    }
    index += 1
    options[key] = value
  }

  if (!options.corpus) throw evaluationError('corpus_argument_missing')
  if (!options.output) throw evaluationError('output_argument_missing')
  if (!options.budgetFile) throw evaluationError('budget_argument_missing')
  if (!TRAJECTORY_ARMS.includes(options.arm)) {
    throw evaluationError('arm_invalid')
  }
  if (options.group !== null && !TRAJECTORY_GROUPS.includes(options.group)) {
    throw evaluationError('group_invalid')
  }
  const repeats = Number(options.repeats)
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw evaluationError('repeats_invalid')
  }
  options.repeats = repeats

  return options
}

export async function loadTrajectoryCorpus(filePath) {
  let raw
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    throw evaluationError('corpus_unreadable')
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw evaluationError('corpus_invalid_json')
  }
  return validateTrajectoryCorpus(parsed)
}

export async function loadNumericSidecar(filePath, corpus) {
  let parsed
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    throw evaluationError('numeric_unreadable')
  }
  try {
    return validateNumericSidecar(parsed, corpus)
  } catch {
    throw evaluationError('numeric_invalid')
  }
}

export function createBudgetLedger() {
  return {
    version: 1,
    maxSubmittedTurns: DEFAULT_MAX_SUBMITTED_TURNS,
    maxApplicationCredits: DEFAULT_MAX_APPLICATION_CREDITS,
    submittedTurns: 0,
    creditsUsed: 0,
    uncertain: false,
  }
}

export function validateBudgetLedger(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw evaluationError('budget_invalid')
  }
  for (const key of Object.keys(value)) {
    if (!BUDGET_LEDGER_FIELDS.has(key)) throw evaluationError('budget_invalid')
  }
  const {
    version,
    maxSubmittedTurns,
    maxApplicationCredits,
    submittedTurns,
    creditsUsed,
    uncertain,
  } = value
  if (version !== 1) throw evaluationError('budget_invalid')
  if (!Number.isInteger(maxSubmittedTurns) || maxSubmittedTurns < 1) {
    throw evaluationError('budget_invalid')
  }
  if (!Number.isFinite(maxApplicationCredits) || maxApplicationCredits <= 0) {
    throw evaluationError('budget_invalid')
  }
  if (!Number.isInteger(submittedTurns) || submittedTurns < 0) {
    throw evaluationError('budget_invalid')
  }
  if (!Number.isFinite(creditsUsed) || creditsUsed < 0) {
    throw evaluationError('budget_invalid')
  }
  if (typeof uncertain !== 'boolean') throw evaluationError('budget_invalid')
  return {
    version,
    maxSubmittedTurns,
    maxApplicationCredits,
    submittedTurns,
    creditsUsed,
    uncertain,
  }
}

export async function readBudgetLedger(filePath) {
  let raw
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return createBudgetLedger()
    throw evaluationError('budget_unreadable')
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw evaluationError('budget_invalid')
  }
  return validateBudgetLedger(parsed)
}

export async function writeBudgetLedger(filePath, ledger) {
  await writeFile(filePath, JSON.stringify(ledger, null, 2) + '\n')
}

// Refuses to start any new request once a recorded uncertainty leaves the true
// spend unknown, the submitted-turn cap is reached, or the soft credit ceiling
// is already met.
export function assertBudgetCanStart(ledger) {
  if (ledger.uncertain) throw evaluationError('budget_uncertain')
  if (ledger.submittedTurns >= ledger.maxSubmittedTurns) {
    throw evaluationError('budget_turns_exhausted')
  }
  if (ledger.creditsUsed >= ledger.maxApplicationCredits) {
    throw evaluationError('budget_credits_exhausted')
  }
}

function createTrajectoryTarget(env) {
  // The ephemeral key only satisfies the target constructor; the CLI never
  // starts the listening HTTP adapter.
  return new KlickerEvaluationTarget({
    apiOrigin: env.KLICKER_EVAL_API_ORIGIN,
    chatOrigin: env.KLICKER_EVAL_CHAT_ORIGIN,
    apiKey: randomUUID(),
    participantUsername: env.KLICKER_EVAL_PARTICIPANT_USERNAME,
    participantPassword: env.KLICKER_EVAL_PARTICIPANT_PASSWORD,
    chatbotId: env.KLICKER_EVAL_CHATBOT_ID || DEFAULT_CHATBOT_ID,
    modelId: env.KLICKER_EVAL_MODEL_ID || DEFAULT_MODEL_ID,
    maxStreamBytes:
      Number(env.KLICKER_EVAL_MAX_STREAM_BYTES) || DEFAULT_MAX_STREAM_BYTES,
    pollIntervalMs:
      Number(env.KLICKER_EVAL_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs:
      Number(env.KLICKER_EVAL_POLL_TIMEOUT_MS) || DEFAULT_POLL_TIMEOUT_MS,
    requestTimeoutMs:
      Number(env.KLICKER_EVAL_REQUEST_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS,
  })
}

function selectCases(cases, group) {
  if (group === null) return cases
  const selected = cases.filter(
    (caseDefinition) => caseDefinition.group === group
  )
  if (selected.length === 0) throw evaluationError('group_selection_empty')
  return selected
}

async function openExclusive(filePath) {
  try {
    return await open(filePath, 'wx')
  } catch (error) {
    if (error?.code === 'EEXIST') throw evaluationError('output_exists')
    throw evaluationError('output_unwritable')
  }
}

function progressLine({ arm, receipt, credits, ledger }) {
  return [
    'klicker-tutor-trajectories',
    'arm=' + arm,
    'case=' + receipt.caseId,
    'turn=' + receipt.turn,
    'credits=' + (credits === null ? 'unaccounted' : credits),
    'submitted=' + ledger.submittedTurns + '/' + ledger.maxSubmittedTurns,
    'creditTotal=' + ledger.creditsUsed + '/' + ledger.maxApplicationCredits,
  ].join(' ')
}

export async function runTutorTrajectories({
  argv,
  env = process.env,
  log = (line) => process.stdout.write(line + '\n'),
} = {}) {
  const options = parseArguments(argv)
  if (options.help) return { status: 'help' }

  // One file per role: a shared path would let the ledger overwrite the
  // corpus or the receipts it is meant to bound.
  const corpusPath = resolve(options.corpus)
  const outputPath = resolve(options.output)
  const budgetPath = resolve(options.budgetFile)
  if (
    corpusPath === outputPath ||
    corpusPath === budgetPath ||
    outputPath === budgetPath
  ) {
    throw evaluationError('paths_must_differ')
  }

  const corpus = await loadTrajectoryCorpus(corpusPath)
  if (options.numeric !== null) {
    await loadNumericSidecar(resolve(options.numeric), corpus)
  }
  const cases = selectCases(corpus.cases, options.group)
  const target = createTrajectoryTarget(env)
  const ledger = await readBudgetLedger(budgetPath)
  assertBudgetCanStart(ledger)

  const output = await openExclusive(outputPath)
  const arm = options.arm
  let currentCase = null
  let currentTurn = null
  let currentRepeat = null
  let stopCode = null
  const summary = {
    type: 'summary',
    arm,
    model: target.modelId,
    status: 'completed',
    stopCode: null,
    cases: cases.length,
    repeats: options.repeats,
    runSubmittedTurns: 0,
    completedTurns: 0,
    submittedTurns: ledger.submittedTurns,
    creditsUsed: ledger.creditsUsed,
    uncertain: ledger.uncertain,
    recordedAt: new Date().toISOString(),
  }

  try {
    try {
      await target.ensureSession()
      for (const caseDefinition of cases) {
        for (let repeat = 0; repeat < options.repeats; repeat += 1) {
          currentCase = caseDefinition.id
          currentRepeat = repeat
          await runTrajectory(target, caseDefinition, {
            arm,
            repeat,
            beforeTurn: async ({ caseId, turn }) => {
              currentCase = caseId
              currentTurn = turn
              assertBudgetCanStart(ledger)
              // Count the request and mark the spend unknown before it leaves
              // the process: a crash or transport failure here must refuse
              // every later call instead of assuming the turn was free.
              ledger.submittedTurns += 1
              ledger.uncertain = true
              summary.runSubmittedTurns += 1
              await writeBudgetLedger(budgetPath, ledger)
            },
            onTurn: async (receipt) => {
              const credits = finiteCredits(receipt.creditsUsed)
              if (credits !== null) {
                ledger.creditsUsed += credits
                ledger.uncertain = false
              }
              await writeBudgetLedger(budgetPath, ledger)
              await output.write(JSON.stringify(receipt) + '\n')
              summary.completedTurns += 1
              summary.submittedTurns = ledger.submittedTurns
              summary.creditsUsed = ledger.creditsUsed
              summary.uncertain = ledger.uncertain
              log(progressLine({ arm, receipt, credits, ledger }))
              if (credits === null) throw evaluationError('credits_unaccounted')
            },
          })
        }
      }
    } catch (error) {
      stopCode =
        typeof error?.code === 'string' && error.code
          ? error.code
          : 'trajectory_failed'
      await output.write(
        JSON.stringify({
          type: 'error',
          arm,
          caseId: currentCase,
          turn: currentTurn,
          repeat: currentRepeat,
          code: stopCode,
          recordedAt: new Date().toISOString(),
        }) + '\n'
      )
    }

    summary.recordedAt = new Date().toISOString()
    summary.status = stopCode ? 'stopped' : 'completed'
    summary.stopCode = stopCode
    summary.submittedTurns = ledger.submittedTurns
    summary.creditsUsed = ledger.creditsUsed
    summary.uncertain = ledger.uncertain
    await output.write(JSON.stringify(summary) + '\n')
  } finally {
    await output.close()
  }

  return summary
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let summary
  try {
    summary = await runTutorTrajectories({
      argv,
      env,
      log: (line) => stdout.write(line + '\n'),
    })
  } catch (error) {
    stderr.write(
      'klicker-tutor-trajectories: ' + (error?.code || 'failed') + '\n'
    )
    return 2
  }

  if (summary.status === 'help') {
    stdout.write(USAGE + '\n')
    return 0
  }
  if (summary.stopCode) {
    stderr.write(
      'klicker-tutor-trajectories: stopped ' + summary.stopCode + '\n'
    )
    return 1
  }
  stdout.write(
    'klicker-tutor-trajectories: completed turns=' +
      summary.completedTurns +
      ' submitted=' +
      summary.submittedTurns +
      ' credits=' +
      summary.creditsUsed +
      '\n'
  )
  return 0
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().then((code) => {
    process.exitCode = code
  })
}
