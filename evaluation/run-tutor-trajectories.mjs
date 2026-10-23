#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { open, readFile } from 'node:fs/promises'
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
  parseAllowedOrigins,
} from '../apps/chat/scripts/klicker-evaluation-target.mjs'
import {
  runTrajectory,
  TRAJECTORY_GROUPS,
  validateTrajectoryCorpus,
} from '../apps/chat/scripts/tutor-trajectory.mjs'
import {
  acquireBudgetLock,
  assertBudgetCanStart,
  beginBudgetTurn,
  finishBudgetTurn,
  readBudgetLedger,
} from './evaluation-budget.mjs'
import { verifyGuardQualification } from './evaluation-spend-guard.mjs'
import { validateNumericSidecar } from './tutor-numeric-reference.mjs'

export const TRAJECTORY_ARMS = ['baseline', 'candidate', 'auto']
export const TRAJECTORY_TARGETS = ['local', 'remote']
const REASONING_EFFORTS = ['low', 'medium', 'high']

const VALUE_FLAGS = {
  '--corpus': 'corpus',
  '--output': 'output',
  '--arm': 'arm',
  '--repeats': 'repeats',
  '--budget-file': 'budgetFile',
  '--group': 'group',
  '--numeric': 'numeric',
  '--target': 'target',
  '--max-turns': 'maxTurns',
  '--resume': 'resume',
}

const USAGE = [
  'Usage: node evaluation/run-tutor-trajectories.mjs --corpus <file> --output <file> --arm <baseline|candidate|auto> --budget-file <file> [--repeats <n>] [--group <development|reserved|control>] [--numeric <sidecar>] [--resume <earlier output>]',
  '       node evaluation/run-tutor-trajectories.mjs --target remote --max-turns <n> --corpus <file> --output <file> --arm <baseline|candidate|auto> [--repeats <n>] [--group <...>] [--resume <earlier output>]',
  '',
  'Runs a frozen trajectory corpus against the local evaluation target and',
  'writes one sanitized JSONL receipt per verified turn. The output file is',
  'created exclusively and never overwritten. The shared budget ledger counts',
  'submitted requests and conservatively reserved provider dollars across arms.',
  'A qualified provider guard and an initialized version-2 budget are required. An optional',
  'numerical sidecar is checked against the corpus before login.',
  '',
  'Credentials come from KLICKER_EVAL_API_ORIGIN, KLICKER_EVAL_CHAT_ORIGIN,',
  'KLICKER_EVAL_PARTICIPANT_USERNAME and KLICKER_EVAL_PARTICIPANT_PASSWORD;',
  `KLICKER_EVAL_MODEL_ID defaults to the fixed ${DEFAULT_MODEL_ID} selection.`,
  'Guard prerequisites: KLICKER_EVAL_QUALIFICATION_FILE,',
  'KLICKER_EVAL_GUARD_ORIGIN and KLICKER_EVAL_GUARD_KEY.',
  'KLICKER_EVAL_REASONING_EFFORT selects low (default), medium or high.',
  '',
  'The remote target runs against a deployed chat app whose exact https',
  'origins are listed in KLICKER_EVAL_ALLOWED_ORIGINS. It has no provider guard',
  'or budget ledger: --max-turns caps submitted turns, the planned run must fit',
  'under it before login, and the participant credit quota bounds spend.',
  '',
  'After a stopped run, --resume reads its output and skips every case repeat',
  'that output started, including the one whose turn was in flight, so no turn',
  'is sent twice. The new output holds only the remaining repeats.',
].join('\n')

export function parseArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true }

  const options = {
    repeats: 2,
    group: null,
    numeric: null,
    target: 'local',
    maxTurns: null,
    resume: null,
    help: false,
  }
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
  if (!TRAJECTORY_TARGETS.includes(options.target)) {
    throw evaluationError('target_invalid')
  }
  if (options.target === 'remote') {
    // The remote target has no ledger; a budget file would suggest a bound
    // that is not enforced.
    if (options.budgetFile) throw evaluationError('arguments_invalid')
    const maxTurns = Number(options.maxTurns)
    if (!Number.isInteger(maxTurns) || maxTurns < 1) {
      throw evaluationError('max_turns_invalid')
    }
    options.maxTurns = maxTurns
  } else {
    if (options.maxTurns !== null) throw evaluationError('arguments_invalid')
    if (!options.budgetFile) throw evaluationError('budget_argument_missing')
  }
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

function repeatKey(caseId, repeat) {
  return caseId + '#' + repeat
}

// A case repeat counts as started once any turn receipt or stop record names
// it. Skipping started repeats keeps a resumed run from resending a turn whose
// outcome the earlier run could not confirm.
export async function loadStartedRepeats(filePath, { arm, corpus }) {
  let raw
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    throw evaluationError('resume_unreadable')
  }
  const caseIds = new Set(corpus.cases.map((entry) => entry.id))
  const started = new Set()
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let record
    try {
      record = JSON.parse(line)
    } catch {
      throw evaluationError('resume_invalid')
    }
    if (record?.arm !== arm) throw evaluationError('resume_arm_mismatch')
    if (record.type === 'summary') continue
    // A stop before any case started, such as a rejected login, sent nothing.
    if (record.type === 'error' && record.caseId === null) continue
    if (
      (record.type !== 'turn' && record.type !== 'error') ||
      !caseIds.has(record.caseId) ||
      !Number.isInteger(record.repeat)
    ) {
      throw evaluationError('resume_invalid')
    }
    started.add(repeatKey(record.caseId, record.repeat))
  }
  return started
}

function createTrajectoryTarget(env, remote) {
  const reasoningEffort = env.KLICKER_EVAL_REASONING_EFFORT || 'low'
  if (!REASONING_EFFORTS.includes(reasoningEffort)) {
    throw evaluationError('reasoning_effort_invalid')
  }
  // The ephemeral key only satisfies the target constructor; the CLI never
  // starts the listening HTTP adapter.
  return new KlickerEvaluationTarget({
    allowedOrigins: remote
      ? parseAllowedOrigins(env.KLICKER_EVAL_ALLOWED_ORIGINS)
      : [],
    reasoningEffort,
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

function remoteProgressLine({ arm, receipt, credits, summary, maxTurns }) {
  return [
    'klicker-tutor-trajectories',
    'arm=' + arm,
    'case=' + receipt.caseId,
    'turn=' + receipt.turn,
    'credits=' + credits,
    'submitted=' + summary.runSubmittedTurns + '/' + maxTurns,
    'creditTotal=' + summary.creditsUsed,
  ].join(' ')
}

function progressLine({ arm, receipt, credits, ledger }) {
  return [
    'klicker-tutor-trajectories',
    'arm=' + arm,
    'case=' + receipt.caseId,
    'turn=' + receipt.turn,
    'credits=' + credits,
    'submitted=' + ledger.submittedTurns + '/' + ledger.maxSubmittedTurns,
    'creditTotal=' + ledger.creditsUsed,
    'reservedMicroUsd=' +
      ledger.reservedProviderMicroUsd +
      '/' +
      ledger.maxProviderMicroUsd,
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
  const remote = options.target === 'remote'
  const corpusPath = resolve(options.corpus)
  const outputPath = resolve(options.output)
  const resumePath = options.resume === null ? null : resolve(options.resume)
  if (resumePath === outputPath || resumePath === corpusPath) {
    throw evaluationError('paths_must_differ')
  }
  if (remote) {
    if (corpusPath === outputPath) throw evaluationError('paths_must_differ')
    return runRemoteTrajectories({
      options,
      env,
      log,
      corpusPath,
      outputPath,
      resumePath,
    })
  }
  const budgetPath = resolve(options.budgetFile)
  if (
    corpusPath === outputPath ||
    corpusPath === budgetPath ||
    outputPath === budgetPath ||
    resumePath === budgetPath
  ) {
    throw evaluationError('paths_must_differ')
  }

  const corpus = await loadTrajectoryCorpus(corpusPath)
  if (options.numeric !== null) {
    await loadNumericSidecar(resolve(options.numeric), corpus)
  }
  const cases = selectCases(corpus.cases, options.group)
  const started =
    resumePath === null
      ? new Set()
      : await loadStartedRepeats(resumePath, { arm: options.arm, corpus })
  const target = createTrajectoryTarget(env, false)
  if (target.modelId === 'auto')
    throw evaluationError('provider_model_unqualified')
  let ledger = await readBudgetLedger(budgetPath)
  assertBudgetCanStart(ledger)
  await verifyGuardQualification({
    filePath: env.KLICKER_EVAL_QUALIFICATION_FILE,
    origin: env.KLICKER_EVAL_GUARD_ORIGIN,
    key: env.KLICKER_EVAL_GUARD_KEY,
    budgetFile: budgetPath,
    chatOrigin: target.chatOrigin,
    chatbotId: target.chatbotId,
    modelId: target.modelId,
  })

  const releaseRun = await acquireBudgetLock(budgetPath, '.run')
  let output
  try {
    output = await openExclusive(outputPath)
  } catch (error) {
    try {
      await releaseRun()
    } catch (releaseError) {
      error.cause = new AggregateError(
        [error.cause, releaseError].filter(Boolean),
        'Output creation failed and its run lease could not be released'
      )
    }
    throw error
  }
  const arm = options.arm
  let currentCase = null
  let currentTurn = null
  let currentRepeat = null
  let stopCode = null
  let turnToken = null
  const summary = {
    type: 'summary',
    arm,
    model: target.modelId,
    status: 'completed',
    stopCode: null,
    cases: cases.length,
    repeats: options.repeats,
    skippedRepeats: started.size,
    runSubmittedTurns: 0,
    completedTurns: 0,
    submittedTurns: ledger.submittedTurns,
    creditsUsed: ledger.creditsUsed,
    reservedProviderMicroUsd: ledger.reservedProviderMicroUsd,
    uncertain: ledger.uncertain,
    recordedAt: new Date().toISOString(),
  }

  try {
    try {
      await target.ensureSession()
      for (const caseDefinition of cases) {
        for (let repeat = 0; repeat < options.repeats; repeat += 1) {
          if (started.has(repeatKey(caseDefinition.id, repeat))) continue
          currentCase = caseDefinition.id
          currentRepeat = repeat
          await runTrajectory(target, caseDefinition, {
            arm,
            repeat,
            beforeTurn: async ({ caseId, turn }) => {
              currentCase = caseId
              currentTurn = turn
              turnToken = await beginBudgetTurn(budgetPath)
              summary.runSubmittedTurns += 1
            },
            onTurn: async (receipt) => {
              const credits = finiteCredits(receipt.creditsUsed)
              ledger = await finishBudgetTurn(budgetPath, turnToken, credits)
              turnToken = null
              await output.write(JSON.stringify(receipt) + '\n')
              summary.completedTurns += 1
              summary.submittedTurns = ledger.submittedTurns
              summary.creditsUsed = ledger.creditsUsed
              summary.uncertain = ledger.uncertain
              log(progressLine({ arm, receipt, credits, ledger }))
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
    ledger = await readBudgetLedger(budgetPath)
    summary.status = stopCode ? 'stopped' : 'completed'
    summary.stopCode = stopCode
    summary.submittedTurns = ledger.submittedTurns
    summary.creditsUsed = ledger.creditsUsed
    summary.reservedProviderMicroUsd = ledger.reservedProviderMicroUsd
    summary.uncertain = ledger.uncertain
    await output.write(JSON.stringify(summary) + '\n')
  } finally {
    try {
      await output.close()
    } finally {
      await releaseRun()
    }
  }

  return summary
}

// Runs the corpus against a deployed chat app. Every planned turn is counted
// before login, and the count is rechecked before each submission, so the run
// never sends more than --max-turns requests. The summary keeps the receipt
// contract of the local runner, with no reserved provider dollars.
async function runRemoteTrajectories({
  options,
  env,
  log,
  corpusPath,
  outputPath,
  resumePath,
}) {
  const corpus = await loadTrajectoryCorpus(corpusPath)
  if (options.numeric !== null) {
    await loadNumericSidecar(resolve(options.numeric), corpus)
  }
  const cases = selectCases(corpus.cases, options.group)
  const started =
    resumePath === null
      ? new Set()
      : await loadStartedRepeats(resumePath, { arm: options.arm, corpus })
  let plannedTurns = 0
  for (const entry of cases) {
    for (let repeat = 0; repeat < options.repeats; repeat += 1) {
      if (!started.has(repeatKey(entry.id, repeat))) {
        plannedTurns += entry.turns.length
      }
    }
  }
  if (plannedTurns > options.maxTurns) {
    throw evaluationError('turn_cap_exceeded')
  }
  const target = createTrajectoryTarget(env, true)
  if (target.modelId === 'auto')
    throw evaluationError('provider_model_unqualified')

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
    skippedRepeats: started.size,
    runSubmittedTurns: 0,
    completedTurns: 0,
    submittedTurns: 0,
    creditsUsed: 0,
    reservedProviderMicroUsd: null,
    uncertain: false,
    recordedAt: new Date().toISOString(),
  }

  try {
    try {
      await target.ensureSession()
      for (const caseDefinition of cases) {
        for (let repeat = 0; repeat < options.repeats; repeat += 1) {
          if (started.has(repeatKey(caseDefinition.id, repeat))) continue
          currentCase = caseDefinition.id
          currentRepeat = repeat
          await runTrajectory(target, caseDefinition, {
            arm,
            repeat,
            beforeTurn: async ({ caseId, turn }) => {
              currentCase = caseId
              currentTurn = turn
              if (summary.runSubmittedTurns >= options.maxTurns) {
                throw evaluationError('turn_cap_reached')
              }
              summary.runSubmittedTurns += 1
              summary.submittedTurns = summary.runSubmittedTurns
            },
            onTurn: async (receipt) => {
              const credits = finiteCredits(receipt.creditsUsed)
              await output.write(JSON.stringify(receipt) + '\n')
              summary.completedTurns += 1
              if (credits === null) summary.uncertain = true
              else summary.creditsUsed += credits
              log(
                remoteProgressLine({
                  arm,
                  receipt,
                  credits,
                  summary,
                  maxTurns: options.maxTurns,
                })
              )
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
