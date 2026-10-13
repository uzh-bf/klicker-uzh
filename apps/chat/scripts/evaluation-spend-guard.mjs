#!/usr/bin/env node

import { timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import {
  assertBudgetCanStart,
  budgetError,
  fingerprint,
  initializeBudget,
  readBudgetLedger,
  reserveProviderSpend,
} from './evaluation-budget.mjs'

const COMMON_FIELDS = [
  'model',
  'stream',
  'tools',
  'tool_choice',
  'temperature',
  'top_p',
  'parallel_tool_calls',
  'cache',
  'prompt_cache_key',
]
const REQUEST_FIELDS = {
  '/v1/responses': [
    ...COMMON_FIELDS,
    'input',
    'instructions',
    'max_output_tokens',
    'reasoning',
    'text',
    'store',
    'include',
    'truncation',
  ],
  '/v1/chat/completions': [
    ...COMMON_FIELDS,
    'messages',
    'max_completion_tokens',
    'reasoning_effort',
    'stream_options',
    'n',
    'stop',
  ],
}

export function validatePricingPolicy(policy) {
  if (
    !policy ||
    policy.version !== 1 ||
    typeof policy.provider !== 'string' ||
    !policy.provider.trim() ||
    typeof policy.qualification !== 'string' ||
    !policy.qualification.trim() ||
    typeof policy.upstreamOrigin !== 'string' ||
    !policy.models ||
    typeof policy.models !== 'object' ||
    Array.isArray(policy.models) ||
    Object.keys(policy.models).length === 0 ||
    Object.keys(policy).some(
      (key) =>
        ![
          'version',
          'provider',
          'qualification',
          'upstreamOrigin',
          'models',
        ].includes(key)
    )
  )
    throw budgetError('pricing_policy_invalid')
  try {
    const upstream = new URL(policy.upstreamOrigin)
    if (
      upstream.href.replace(/\/$/, '') !== policy.upstreamOrigin ||
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash ||
      !['http:', 'https:'].includes(upstream.protocol) ||
      (upstream.protocol === 'http:' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname))
    ) {
      throw new Error('invalid')
    }
  } catch {
    throw budgetError('pricing_policy_invalid')
  }
  for (const [name, model] of Object.entries(policy.models)) {
    if (
      !name ||
      !model ||
      Object.keys(model).length !== 5 ||
      Object.keys(model).some(
        (key) =>
          ![
            'contextTokens',
            'maxOutputTokens',
            'inputMicroUsdPerMillion',
            'outputMicroUsdPerMillion',
            'outputIncludesReasoning',
          ].includes(key)
      ) ||
      !Number.isSafeInteger(model.contextTokens) ||
      model.contextTokens < 1 ||
      !Number.isSafeInteger(model.maxOutputTokens) ||
      model.maxOutputTokens < 1 ||
      model.maxOutputTokens > model.contextTokens ||
      !Number.isSafeInteger(model.inputMicroUsdPerMillion) ||
      model.inputMicroUsdPerMillion < 0 ||
      !Number.isSafeInteger(model.outputMicroUsdPerMillion) ||
      model.outputMicroUsdPerMillion < 0 ||
      (model.inputMicroUsdPerMillion === 0 &&
        model.outputMicroUsdPerMillion === 0) ||
      model.outputIncludesReasoning !== true
    )
      throw budgetError('pricing_policy_invalid')
  }
  return policy
}

// Only function tools execute on the local application's side of this guard.
// Hosted tools, multiple completions and provider-specific price modifiers have
// no finite reservation under this text-model contract.
export function requestReservation(policy, pathname, body) {
  const fields = REQUEST_FIELDS[pathname]
  if (!fields || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw budgetError('provider_request_invalid')
  }
  if (Object.keys(body).some((key) => !fields.includes(key))) {
    throw budgetError('provider_request_field_unqualified')
  }
  const model = Object.hasOwn(policy.models, body.model)
    ? policy.models[body.model]
    : null
  if (!model) throw budgetError('provider_model_unqualified')
  if (body.n !== undefined && body.n !== 1)
    throw budgetError('provider_request_unbounded')
  if (body.truncation !== undefined && body.truncation !== 'disabled')
    throw budgetError('provider_request_unbounded')
  if (
    body.tools !== undefined &&
    (!Array.isArray(body.tools) ||
      body.tools.some((tool) => tool?.type !== 'function'))
  )
    throw budgetError('provider_tool_unqualified')
  if (
    typeof body.tool_choice === 'object' &&
    body.tool_choice?.type !== 'function'
  ) {
    throw budgetError('provider_tool_unqualified')
  }
  // `cache` is a proxy-only client hint; only the two true bypass flags are
  // accepted and the guard strips the field before the native upstream call.
  if (
    body.cache !== undefined &&
    (typeof body.cache !== 'object' ||
      body.cache === null ||
      Array.isArray(body.cache) ||
      Object.keys(body.cache).length !== 2 ||
      body.cache['no-cache'] !== true ||
      body.cache['no-store'] !== true)
  ) {
    throw budgetError('provider_request_unqualified')
  }
  if (
    body.prompt_cache_key !== undefined &&
    (typeof body.prompt_cache_key !== 'string' ||
      !body.prompt_cache_key.trim() ||
      body.prompt_cache_key.length > 64)
  ) {
    throw budgetError('provider_request_unqualified')
  }
  const input = pathname === '/v1/responses' ? body.input : body.messages
  if (!(typeof input === 'string' || Array.isArray(input)))
    throw budgetError('provider_input_invalid')
  const checkModalities = (value) => {
    if (Array.isArray(value)) return value.forEach(checkModalities)
    if (!value || typeof value !== 'object') return
    if (
      typeof value.type === 'string' &&
      /image|audio|video|file|web_search|computer|code_interpreter/.test(
        value.type
      )
    ) {
      throw budgetError('provider_modality_unqualified')
    }
    Object.values(value).forEach(checkModalities)
  }
  checkModalities(input)
  const output =
    pathname === '/v1/responses'
      ? body.max_output_tokens
      : body.max_completion_tokens
  if (
    !Number.isSafeInteger(output) ||
    output < 1 ||
    output > model.maxOutputTokens
  ) {
    throw budgetError('provider_request_unbounded')
  }
  const numerator =
    BigInt(model.contextTokens) * BigInt(model.inputMicroUsdPerMillion) +
    BigInt(output) * BigInt(model.outputMicroUsdPerMillion)
  const reservation = (numerator + 999_999n) / 1_000_000n
  if (reservation < 1n || reservation > BigInt(Number.MAX_SAFE_INTEGER))
    throw budgetError('provider_request_unbounded')
  return Number(reservation)
}

function authenticated(request, key) {
  const actual = request.headers.authorization
  const expected = 'Bearer ' + key
  return (
    typeof actual === 'string' &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function requestBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) throw budgetError('provider_request_too_large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw budgetError('provider_request_invalid')
  }
}

export async function createSpendGuard({
  policy,
  budgetFile,
  apiKey,
  upstreamOrigin,
  upstreamKey,
  timeoutMs = 120_000,
}) {
  validatePricingPolicy(policy)
  const policyHash = fingerprint(policy)
  const ledger = await readBudgetLedger(budgetFile)
  if (ledger.policyHash !== policyHash)
    throw budgetError('budget_policy_mismatch')
  assertBudgetCanStart(ledger)
  const upstream = new URL(upstreamOrigin)
  if (!apiKey || !upstreamKey || upstreamOrigin !== policy.upstreamOrigin)
    throw budgetError('provider_guard_configuration_invalid')

  return createServer(async (request, response) => {
    let timeout
    const controller = new AbortController()
    try {
      if (!authenticated(request, apiKey))
        return json(response, 401, { error: 'unauthorized' })
      const url = new URL(request.url, 'http://localhost')
      if (url.search) throw budgetError('provider_request_invalid')
      if (request.method === 'GET' && url.pathname === '/status') {
        const ledger = await readBudgetLedger(budgetFile)
        if (ledger.policyHash !== policyHash)
          throw budgetError('budget_policy_mismatch')
        return json(response, 200, {
          experimentId: ledger.experimentId,
          policyHash,
          upstreamOrigin: policy.upstreamOrigin,
          maxSubmittedTurns: ledger.maxSubmittedTurns,
          maxProviderMicroUsd: ledger.maxProviderMicroUsd,
          reservedProviderMicroUsd: ledger.reservedProviderMicroUsd,
        })
      }
      if (request.method !== 'POST' || !REQUEST_FIELDS[url.pathname])
        return json(response, 404, { error: 'not_found' })
      const body = await requestBody(request)
      const microUsd = requestReservation(policy, url.pathname, body)
      await reserveProviderSpend(budgetFile, policyHash, microUsd)
      // The guard consumes the proxy-only `cache` hint; the native upstream
      // does not support it, so forward the reserved request without it.
      const forwarded = { ...body }
      delete forwarded.cache
      timeout = setTimeout(() => controller.abort(), timeoutMs)
      response.once('close', () => {
        if (!response.writableEnded) controller.abort()
      })
      const endpoint = new URL(
        url.pathname.slice('/v1/'.length),
        upstream.href.replace(/\/?$/, '/')
      )
      const result = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: 'Bearer ' + upstreamKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forwarded),
      })
      if (!result.ok || !result.body) {
        await result.body?.cancel()
        return json(response, 502, { error: 'provider_request_failed' })
      }
      response.writeHead(200, {
        'Content-Type':
          result.headers.get('content-type') || 'application/json',
      })
      await pipeline(Readable.fromWeb(result.body), response)
    } catch (error) {
      if (!response.headersSent) {
        const code =
          error?.code?.startsWith('budget_') ||
          error?.code?.startsWith('provider_')
            ? error.code
            : 'provider_request_failed'
        json(
          response,
          code === 'budget_busy' || code === 'budget_spend_exhausted'
            ? 429
            : 502,
          { error: code }
        )
      } else {
        response.destroy()
      }
    } finally {
      clearTimeout(timeout)
    }
  })
}

export async function verifyGuardQualification({
  filePath,
  origin,
  key,
  budgetFile,
  chatOrigin,
  chatbotId,
  modelId,
}) {
  try {
    const qualification = JSON.parse(await readFile(filePath, 'utf8'))
    const ledger = await readBudgetLedger(budgetFile)
    const guardUrl = new URL(origin)
    if (
      qualification.version !== 1 ||
      qualification.experimentId !== ledger.experimentId ||
      qualification.policyHash !== ledger.policyHash ||
      qualification.guardOrigin !== origin ||
      qualification.chatOrigin !== chatOrigin ||
      qualification.chatbotId !== chatbotId ||
      qualification.modelId !== modelId ||
      qualification.allBillableEgressGuarded !== true ||
      typeof qualification.evidence !== 'string' ||
      !qualification.evidence.trim() ||
      guardUrl.username ||
      guardUrl.password ||
      guardUrl.search ||
      guardUrl.hash ||
      !key ||
      modelId === 'auto' ||
      !['http:', 'https:'].includes(guardUrl.protocol) ||
      (!['localhost', '127.0.0.1', '[::1]'].includes(guardUrl.hostname) &&
        !guardUrl.hostname.endsWith('.localhost'))
    )
      throw budgetError('guard_qualification_invalid')
    const status = await fetch(new URL('/status', guardUrl), {
      headers: { Authorization: 'Bearer ' + key },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!status.ok) throw budgetError('guard_unavailable')
    const body = await status.json()
    if (
      body.experimentId !== ledger.experimentId ||
      body.policyHash !== ledger.policyHash ||
      body.upstreamOrigin !== qualification.upstreamOrigin ||
      body.maxSubmittedTurns !== ledger.maxSubmittedTurns ||
      body.maxProviderMicroUsd !== ledger.maxProviderMicroUsd
    ) {
      throw budgetError('guard_qualification_invalid')
    }
    return ledger
  } catch (error) {
    if (error?.code?.startsWith('budget_') || error?.code?.startsWith('guard_'))
      throw error
    throw budgetError('guard_qualification_unavailable')
  }
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
  const policy = validatePricingPolicy(
    JSON.parse(await readFile(env.KLICKER_EVAL_PRICING_FILE, 'utf8'))
  )
  if (argv.length === 1 && argv[0] === '--initialize-budget') {
    await initializeBudget(env.KLICKER_EVAL_BUDGET_FILE, fingerprint(policy))
    return
  }
  if (argv.length) throw budgetError('provider_guard_arguments_invalid')
  const ledger = await readBudgetLedger(env.KLICKER_EVAL_BUDGET_FILE)
  if (ledger.policyHash !== fingerprint(policy))
    throw budgetError('budget_policy_mismatch')
  const server = await createSpendGuard({
    policy,
    budgetFile: env.KLICKER_EVAL_BUDGET_FILE,
    apiKey: env.KLICKER_EVAL_GUARD_KEY,
    upstreamOrigin: env.KLICKER_EVAL_UPSTREAM_ORIGIN,
    upstreamKey: env.KLICKER_EVAL_UPSTREAM_KEY,
  })
  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  const port = Number(env.KLICKER_EVAL_GUARD_PORT || 0)
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw budgetError('provider_guard_port_invalid')
  server.listen(port, env.KLICKER_EVAL_GUARD_HOST || '127.0.0.1', () => {
    process.stdout.write(
      'KLICKER_EVAL_GUARD_PORT=' + server.address().port + '\n'
    )
  })
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      'klicker-evaluation-spend-guard: ' +
        (error?.code || 'startup_failed') +
        '\n'
    )
    process.exitCode = 1
  })
}
