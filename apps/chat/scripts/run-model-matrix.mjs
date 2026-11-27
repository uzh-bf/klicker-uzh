#!/usr/bin/env node

// Runs one trajectory corpus against a deployed chat for several models and
// records every turn, including tool inputs and the model that served it, so
// the models can be compared on identical student turns.

import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAT_MODE_KEYS } from './chat-mode-keys.mjs'
import {
  evaluationError,
  KlickerEvaluationTarget,
  parseAllowedOrigins,
} from './klicker-evaluation-target.mjs'

const USAGE = [
  'Usage: node apps/chat/scripts/run-model-matrix.mjs --corpus <file> --output <file> --models <id,id,...> [--repeats <n>] [--cases <id,id,...>] [--effort <model>=<level>]...',
  '',
  'Runs every corpus case once per model and repeat in a fresh thread. Cases',
  'run in parallel across models, so time-of-day effects hit every model alike.',
  'The output is JSONL with one line per case; a rerun skips finished cases.',
  'A case stops at its first turn that fails, returns no text, or is served by',
  'another model than requested (for example a zero-credit fallback).',
  '',
  'Environment: KLICKER_MATRIX_API_ORIGIN, KLICKER_MATRIX_CHAT_ORIGIN,',
  'KLICKER_MATRIX_CHATBOT_ID, KLICKER_MATRIX_PARTICIPANT_USERNAME and',
  'KLICKER_MATRIX_PARTICIPANT_PASSWORD. Remote origins must be listed in',
  'KLICKER_MATRIX_ALLOWED_ORIGINS. Without --effort a model runs at the',
  "chatbot's default effort, as students get it.",
].join('\n')

// Deployed APIs accept only persisted queries. The persisted id is the SHA-256
// of the printed operation, so it follows from this text without a build.
const PRINTED_LOGIN_MUTATION =
  'mutation LoginParticipant($usernameOrEmail: String!, $password: String!) {\n  loginParticipant(usernameOrEmail: $usernameOrEmail, password: $password)\n}'
const LOGIN_QUERY_HASH = createHash('sha256')
  .update(PRINTED_LOGIN_MUTATION)
  .digest('hex')

class DeployedChatTarget extends KlickerEvaluationTarget {
  async loginParticipant() {
    const response = await fetch(`${this.apiOrigin}/api/graphql`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-graphql-yoga-csrf': '1',
      },
      body: JSON.stringify({
        operationName: 'LoginParticipant',
        variables: {
          usernameOrEmail: this.participantUsername,
          password: this.participantPassword,
        },
        extensions: {
          persistedQuery: { version: 1, sha256Hash: LOGIN_QUERY_HASH },
        },
      }),
    })
    const body = await response.json().catch(() => null)
    if (!body?.data?.loginParticipant) {
      throw evaluationError('participant_login_rejected')
    }
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith('participant_token='))
    if (!cookie) throw evaluationError('participant_cookie_missing')
    return cookie
  }
}

// Checks only what this runner reads, without the trajectory schema module:
// that module loads application TypeScript and needs installed dependencies,
// while the matrix runs from a bare checkout against a deployed chat.
export function readCorpusCases(value) {
  if (value?.version !== 1 || !Array.isArray(value.cases)) {
    throw evaluationError('corpus_invalid')
  }
  const seen = new Set()
  for (const testCase of value.cases) {
    if (
      typeof testCase?.id !== 'string' ||
      seen.has(testCase.id) ||
      !CHAT_MODE_KEYS.includes(testCase.mode) ||
      !Array.isArray(testCase.turns) ||
      testCase.turns.length === 0 ||
      !testCase.turns.every((turn) => typeof turn?.message === 'string')
    ) {
      throw evaluationError('corpus_case_invalid')
    }
    seen.add(testCase.id)
  }
  return value.cases
}

export function parseArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true }
  const options = { repeats: 1, cases: null, effort: {} }
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw evaluationError('argument_value_missing')
    }
    if (flag === '--corpus') options.corpus = value
    else if (flag === '--output') options.output = value
    else if (flag === '--models') options.models = value.split(',')
    else if (flag === '--cases') options.cases = value.split(',')
    else if (flag === '--repeats') options.repeats = Number(value)
    else if (flag === '--effort') {
      const [model, level] = value.split('=')
      if (!model || !level) throw evaluationError('effort_invalid')
      options.effort[model] = level
    } else throw evaluationError('argument_unknown')
  }
  if (!options.corpus || !options.output || !options.models?.length) {
    throw evaluationError('argument_required_missing')
  }
  if (!Number.isSafeInteger(options.repeats) || options.repeats < 1) {
    throw evaluationError('repeats_invalid')
  }
  return options
}

// Reads the AI SDK UI message stream: text, tool inputs and outputs, and the
// message metadata that names the served model and the credits used.
export function parseChatStream(body) {
  let text = ''
  const tools = []
  const errors = []
  let meta = {}
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (!payload || payload === '[DONE]') continue
    let event
    try {
      event = JSON.parse(payload)
    } catch {
      continue
    }
    if (event.messageMetadata) meta = { ...meta, ...event.messageMetadata }
    if (event.type === 'text-delta') text += event.delta ?? ''
    else if (event.type === 'tool-input-available') {
      tools.push({
        id: event.toolCallId,
        name: event.toolName,
        input: event.input,
      })
    } else if (event.type === 'tool-output-available') {
      const tool = tools.find((entry) => entry.id === event.toolCallId)
      if (tool) tool.output = JSON.stringify(event.output ?? {}).slice(0, 2000)
    } else if (event.type === 'error') {
      errors.push(String(event.errorText ?? 'stream_error').slice(0, 300))
    }
  }
  return {
    text: text.trim(),
    tools: tools.map(({ id: _id, ...tool }) => tool),
    errors,
    servedModelId: meta.modelId ?? null,
    reasoningEffort: meta.reasoningEffort ?? null,
    creditsUsed: meta.creditsUsed ?? null,
    finishReason: meta.finishReason ?? null,
  }
}

// A Tutor turn can answer with only a show_feedback card and no text. The
// student still sees the card, so its text counts as the visible answer.
export function feedbackCardText(tools) {
  return tools
    .filter((tool) => tool.name === 'show_feedback')
    .flatMap(({ input = {} }) => [
      input.title,
      input.summary,
      ...(input.strengths ?? []).map((entry) => entry.text),
      ...(input.improvements ?? []).map((entry) => entry.comment),
      input.nextStep,
    ])
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
}

async function runTurn({
  target,
  history,
  threadId,
  parentId,
  mode,
  message,
  effort,
}) {
  const userMessage = { id: randomUUID(), role: 'user', content: message }
  const assistantMessageId = randomUUID()
  const startedAt = Date.now()
  const response = await fetch(
    `${target.chatOrigin}/api/chatbots/${target.chatbotId}/chat`,
    {
      method: 'POST',
      headers: { Cookie: target.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...history, userMessage],
        threadId,
        selectedModel: target.modelId,
        selectedMode: mode,
        ...(effort ? { reasoningEffort: effort } : {}),
        parentId,
        assistantMessageId,
        images: [],
      }),
    }
  )
  const body = await response.text()
  const parsed = response.ok
    ? parseChatStream(body)
    : { text: '', tools: [], errors: [`http_${response.status}`] }
  return {
    status: response.status,
    latencyMs: Date.now() - startedAt,
    ...parsed,
    userMessage,
    assistantMessageId,
  }
}

async function runCase({ target, testCase, repeat, effort }) {
  await target.ensureSession()
  const threadId = await target.createThread()
  const history = []
  let parentId = null
  const turns = []
  let stoppedAt = null
  for (const turn of testCase.turns) {
    const result = await runTurn({
      target,
      history,
      threadId,
      parentId,
      mode: testCase.mode,
      message: turn.message,
      effort,
    })
    const { userMessage, assistantMessageId, ...record } = result
    turns.push({ student: turn.message, ...record })
    const servedOther =
      record.servedModelId !== null && record.servedModelId !== target.modelId
    const answer = record.text || feedbackCardText(record.tools)
    if (record.status !== 200 || !answer || servedOther) {
      stoppedAt = {
        turn: turns.length,
        reason:
          record.status !== 200
            ? 'request_failed'
            : servedOther
              ? 'served_by_other_model'
              : 'empty_answer',
      }
      break
    }
    history.push(userMessage, {
      id: assistantMessageId,
      role: 'assistant',
      content: answer,
    })
    parentId = assistantMessageId
  }
  return {
    kind: 'case',
    model: target.modelId,
    repeat,
    caseId: testCase.id,
    mode: testCase.mode,
    threadId,
    stoppedAt,
    turns,
    recordedAt: new Date().toISOString(),
  }
}

async function finishedKeys(outputPath) {
  if (!existsSync(outputPath)) return new Set()
  const lines = (await readFile(outputPath, 'utf8')).split('\n').filter(Boolean)
  return new Set(
    lines
      .map((line) => JSON.parse(line))
      .filter((row) => row.kind === 'case')
      .map((row) => `${row.model}|${row.repeat}|${row.caseId}`)
  )
}

export async function runModelMatrix({
  argv,
  env = process.env,
  log = (line) => process.stdout.write(`${line}\n`),
}) {
  const options = parseArguments(argv)
  if (options.help) {
    log(USAGE)
    return
  }
  const cases = readCorpusCases(
    JSON.parse(await readFile(resolve(options.corpus), 'utf8'))
  ).filter((testCase) => !options.cases || options.cases.includes(testCase.id))
  if (cases.length === 0) throw evaluationError('cases_empty')
  const allowedOrigins = parseAllowedOrigins(env.KLICKER_MATRIX_ALLOWED_ORIGINS)
  // One session per model keeps each target's model fixed; the participant
  // and chatbot are shared, so credits are spent from one balance.
  const targets = options.models.map(
    (modelId) =>
      new DeployedChatTarget({
        apiOrigin: env.KLICKER_MATRIX_API_ORIGIN,
        chatOrigin: env.KLICKER_MATRIX_CHAT_ORIGIN,
        apiKey: randomUUID(),
        participantUsername: env.KLICKER_MATRIX_PARTICIPANT_USERNAME,
        participantPassword: env.KLICKER_MATRIX_PARTICIPANT_PASSWORD,
        chatbotId: env.KLICKER_MATRIX_CHATBOT_ID,
        modelId,
        allowedOrigins,
      })
  )
  if (!env.KLICKER_MATRIX_CHATBOT_ID) {
    throw evaluationError('chatbot_id_missing')
  }
  const outputPath = resolve(options.output)
  const done = await finishedKeys(outputPath)

  for (let repeat = 1; repeat <= options.repeats; repeat += 1) {
    for (const testCase of cases) {
      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const key = `${target.modelId}|${repeat}|${testCase.id}`
          if (done.has(key)) return
          const row = await runCase({
            target,
            testCase,
            repeat,
            effort: options.effort[target.modelId],
          })
          await appendFile(outputPath, `${JSON.stringify(row)}\n`)
          const turns = row.turns
            .map(
              (turn) =>
                `${(turn.latencyMs / 1000).toFixed(1)}s ${turn.servedModelId}${
                  turn.tools.length
                    ? ` tools=${turn.tools.map((tool) => tool.name).join('+')}`
                    : ''
                }`
            )
            .join(' ; ')
          log(
            `${key} | ${turns}${row.stoppedAt ? ` | STOPPED ${row.stoppedAt.reason} at turn ${row.stoppedAt.turn}` : ''}`
          )
        })
      )
      for (const result of results) {
        if (result.status === 'rejected') {
          log(`ERROR ${result.reason?.code ?? result.reason?.message}`)
        }
      }
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runModelMatrix({ argv: process.argv.slice(2) }).catch((error) => {
    process.stderr.write(`${error.code ?? error.message}\n`)
    process.exitCode = 1
  })
}
