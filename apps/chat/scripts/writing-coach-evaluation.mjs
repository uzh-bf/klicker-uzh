#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDisposableTestPrismaClient } from '@klicker-uzh/prisma'

import {
  DEFAULT_MODEL_ID,
  KlickerEvaluationTarget,
  validateLocalOrigin,
} from './klicker-evaluation-target.mjs'
import {
  LOCAL_CHATBOT_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_SCOPE,
} from './local-mcp-auth.mjs'

export const EXPECTED_CWD = '/workspaces/klicker-uzh'
export const SYNTHETIC_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
export const SYNTHETIC_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
export const SYNTHETIC_PARTICIPANT_USERNAME = 'testuser1'
export const MAX_ATTEMPTED_SUBMISSIONS = 60

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../../..')
const casesPath = resolve(
  repositoryRoot,
  'project/writing-coach/synthetic-cases.json'
)
const receiptRoot = resolve(
  repositoryRoot,
  'project/_local/writing-coach-evaluation'
)
const counterPath = resolve(receiptRoot, 'submission-counter.json')
const counterLockPath = resolve(receiptRoot, 'submission-counter.lock')

class EvaluationError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

class CountedTurnError extends EvaluationError {
  constructor(code, submissionNumber) {
    super(code)
    this.submissionNumber = submissionNumber
  }
}

function fail(code) {
  throw new EvaluationError(code)
}

function safeCode(error) {
  return typeof error?.code === 'string' && /^[a-z0-9_.:-]+$/i.test(error.code)
    ? error.code
    : 'evaluation_failed'
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true
  if (!isObject(left) || !isObject(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    (key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key])
  )
}

function parseArgs(argv) {
  const result = { dryRun: false, resume: false, caseIds: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      result.dryRun = true
      continue
    }
    if (argument === '--resume') {
      result.resume = true
      continue
    }
    if (argument === '--case' || argument === '--cases') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail('case_selection_missing')
      result.caseIds.push(
        ...value
          .split(',')
          .map((caseId) => caseId.trim())
          .filter(Boolean)
      )
      index += 1
      continue
    }
    if (argument === '--help') {
      result.help = true
      continue
    }
    fail('argument_invalid')
  }
  if (result.help) return result
  if (result.caseIds.length === 0) fail('case_selection_required')
  result.caseIds = [...new Set(result.caseIds)]
  return result
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    fail('receipt_read_failed')
  }
}

async function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rename(temporaryPath, path)
  } catch {
    await unlink(temporaryPath).catch(() => {})
    fail('receipt_write_failed')
  }
}

async function withFileLock(path, operation) {
  let handle
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = await open(path, 'wx', 0o600)
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') fail('submission_counter_lock_failed')
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
    }
  }
  if (!handle) fail('submission_counter_lock_timeout')
  try {
    return await operation()
  } finally {
    await handle.close().catch(() => {})
    await unlink(path).catch(() => {})
  }
}

async function reserveSubmission() {
  return withFileLock(counterLockPath, async () => {
    const current = (await readJson(counterPath)) ?? { attemptedSubmissions: 0 }
    if (
      !Number.isInteger(current.attemptedSubmissions) ||
      current.attemptedSubmissions < 0 ||
      current.attemptedSubmissions > MAX_ATTEMPTED_SUBMISSIONS
    ) {
      fail('submission_counter_invalid')
    }
    if (current.attemptedSubmissions >= MAX_ATTEMPTED_SUBMISSIONS) {
      fail('submission_cap_exhausted')
    }
    const attemptedSubmissions = current.attemptedSubmissions + 1
    await writeJsonAtomically(counterPath, {
      schemaVersion: 1,
      attemptedSubmissions,
      cap: MAX_ATTEMPTED_SUBMISSIONS,
      updatedAt: new Date().toISOString(),
    })
    return attemptedSubmissions
  })
}

function validateBundle(bundle) {
  if (!isObject(bundle) || !Array.isArray(bundle.cases)) fail('cases_invalid')
  if (
    !isObject(bundle.defaults) ||
    bundle.defaults.maxAttemptedSubmissions !== MAX_ATTEMPTED_SUBMISSIONS
  ) {
    fail('cases_cap_invalid')
  }
  if (!isObject(bundle.contexts)) fail('contexts_invalid')

  const casesById = new Map()
  for (const item of bundle.cases) {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      casesById.has(item.id) ||
      !['tutor', 'explainer', 'quizzer', 'writing-coach'].includes(item.mode) ||
      typeof item.question !== 'string' ||
      !item.question
    ) {
      fail('case_invalid')
    }
    if (item.context !== undefined && item.context !== null) {
      if (
        typeof item.context !== 'string' ||
        !Object.hasOwn(bundle.contexts, item.context)
      ) {
        fail('case_context_invalid')
      }
    }
    if (item.followUpTo !== undefined && item.followUpTo !== null) {
      if (typeof item.followUpTo !== 'string' || !item.followUpTo) {
        fail('case_follow_up_invalid')
      }
    }
    casesById.set(item.id, item)
  }
  for (const item of bundle.cases) {
    if (item.followUpTo && !casesById.has(item.followUpTo)) {
      fail('case_follow_up_target_missing')
    }
  }
  return { casesById, cases: bundle.cases }
}

async function loadBundle() {
  let bundle
  try {
    bundle = JSON.parse(await readFile(casesPath, 'utf8'))
  } catch {
    fail('cases_read_failed')
  }
  return { bundle, ...validateBundle(bundle) }
}

function selectCases(cases, casesById, selectedIds) {
  for (const caseId of selectedIds) {
    if (!casesById.has(caseId)) fail(`case_unknown:${caseId}`)
  }
  const selected = cases.filter((item) => selectedIds.includes(item.id))
  if (selected.length === 0) fail('case_selection_empty')
  if (selected.length > MAX_ATTEMPTED_SUBMISSIONS) {
    fail('case_selection_exceeds_cap')
  }
  return selected
}

function contextFor(bundle, item) {
  if (item.context === undefined || item.context === null) return null
  const value = bundle.contexts[item.context]
  if (value !== null && typeof value !== 'string') fail('context_invalid')
  if (typeof value === 'string' && value.length > 1000) fail('context_too_long')
  return value
}

function standardModeConfig(bundle, item) {
  return {
    tutorEnabled: true,
    explainerEnabled: true,
    quizzerEnabled: true,
    writingCoachEnabled: true,
    courseName: typeof bundle.course === 'string' ? bundle.course : null,
    subjectDomain: null,
    languageOfInstruction: item.language === 'de' ? 'de' : 'en',
    scopeNote: contextFor(bundle, item),
  }
}

async function readAttemptReceipts() {
  let entries
  try {
    entries = await readdir(receiptRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    fail('receipt_index_failed')
  }
  const receipts = []
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.startsWith('attempt-') ||
      !entry.name.endsWith('.json')
    ) {
      continue
    }
    const receipt = await readJson(resolve(receiptRoot, entry.name))
    if (
      isObject(receipt) &&
      typeof receipt.caseId === 'string' &&
      typeof receipt.startedAt === 'string'
    ) {
      receipts.push(receipt)
    }
  }
  return receipts.sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt)
  )
}

function latestReceipt(receipts, caseId, completedOnly = false) {
  const matching = receipts.filter(
    (receipt) =>
      receipt.caseId === caseId &&
      (!completedOnly || receipt.status === 'completed')
  )
  return matching.at(-1) ?? null
}

function validateSelectionDependencies(selected, receipts) {
  const selectedIds = new Set(selected.map((item) => item.id))
  for (const item of selected) {
    if (!item.followUpTo || selectedIds.has(item.followUpTo)) continue
    if (!latestReceipt(receipts, item.followUpTo, true)) {
      fail(`follow_up_receipt_missing:${item.followUpTo}`)
    }
  }
}

function localOriginValue(env, name, fallback) {
  const value = env[name] || fallback
  validateLocalOrigin(value, name.toLowerCase())
  return value
}

function validateExecutionBoundary(env) {
  try {
    if (realpathSync(process.cwd()) !== EXPECTED_CWD)
      fail('working_directory_invalid')
    const rawDatabaseUrl = env.DATABASE_URL
    if (!rawDatabaseUrl) fail('database_url_missing')
    const databaseUrl = new URL(rawDatabaseUrl)
    if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
      fail('database_url_protocol')
    }
    if (
      !['postgres', 'localhost', '127.0.0.1'].includes(databaseUrl.hostname)
    ) {
      fail('database_url_non_local')
    }
    const bootstrap = spawnSync(
      'bash',
      ['util/dev-runtime.sh', 'require-bootstrap'],
      {
        cwd: EXPECTED_CWD,
        stdio: 'ignore',
      }
    )
    if (bootstrap.status !== 0) fail('runtime_bootstrap_not_ready')
  } catch (error) {
    if (error instanceof EvaluationError) throw error
    fail('local_runtime_boundary_failed')
  }
}

export async function createDatabaseClient(env) {
  try {
    return await createDisposableTestPrismaClient(env.DATABASE_URL)
  } catch {
    fail('disposable_database_required')
  }
}

async function query(client, text, values = []) {
  try {
    return { rows: await client.$queryRawUnsafe(text, ...values) }
  } catch {
    fail('database_query_failed')
  }
}

async function execute(client, text, values = []) {
  try {
    return await client.$executeRawUnsafe(text, ...values)
  } catch {
    fail('database_query_failed')
  }
}

export function validateCurrentBaseUsage(baseUsage) {
  if (
    !baseUsage ||
    baseUsage.monthStart !== baseUsage.currentMonthStart ||
    !Number.isFinite(Number(baseUsage.budget)) ||
    !Number.isFinite(Number(baseUsage.used)) ||
    Number(baseUsage.budget) <= Number(baseUsage.used)
  ) {
    fail('owner_base_budget_unavailable')
  }
  return baseUsage
}

async function readCurrentBaseUsage(client) {
  const result = await query(
    client,
    `
      SELECT "monthStart"::text AS "monthStart",
             date_trunc(
               'month', timezone('Europe/Zurich', CURRENT_TIMESTAMP)
             )::date::text AS "currentMonthStart",
             "budgetCredits"::text AS budget, "usedCredits"::text AS used
      FROM "ChatAccountUsage"
      WHERE "ownerId" = $1 AND "usageClass" = 'BASE'
        AND "monthStart" = date_trunc(
          'month', timezone('Europe/Zurich', CURRENT_TIMESTAMP)
        )::date
      LIMIT 1
    `,
    [SYNTHETIC_OWNER_ID]
  )
  return result.rows[0] ?? null
}

function fallbackStateReceipt(state) {
  return {
    creditResetPeriod: state?.chatbot?.creditResetPeriod ?? null,
    creditCurrent: state?.creditRow?.current ?? null,
  }
}

function fallbackPreconditions(fixture) {
  return {
    ownerAiFeaturesEnabled: fixture.chatbot.aiFeaturesEnabled === true,
    baseUsage: fixture.baseUsage,
    creditResetPeriod: fixture.chatbot.creditResetPeriod,
    creditCurrent: fixture.creditRow?.current ?? null,
  }
}

function exposedUsage(result) {
  return result?.usage ?? result?.exposedUsage ?? null
}

function assertExhaustedCredits(state) {
  if (
    state?.chatbot?.creditResetPeriod !== 'NONE' ||
    Number(state?.creditRow?.current) !== 0
  ) {
    fail('fallback_preparation_readback_failed')
  }
  return state
}

async function inspectFixture(client, selected) {
  const chatbotResult = await query(
    client,
    `
      SELECT c.id, c."ownerId", c."courseId", c.status,
             c."standardModeConfig", c."creditInitialCredits",
             c."creditResetPeriod", c."creditResetAmount", c."creditMaxCredits",
             u."aiFeaturesEnabled"
      FROM "Chatbot" c
      JOIN "User" u ON u.id = c."ownerId"
      JOIN "Course" co ON co.id = c."courseId"
      WHERE c.id = $1
    `,
    [LOCAL_CHATBOT_ID]
  )
  const chatbot = chatbotResult.rows[0]
  if (
    !chatbot ||
    chatbot.ownerId !== SYNTHETIC_OWNER_ID ||
    chatbot.courseId !== SYNTHETIC_COURSE_ID ||
    chatbot.status !== 'PUBLISHED'
  ) {
    fail('chatbot_ownership_or_status_invalid')
  }

  const participantResult = await query(
    client,
    `SELECT id, username FROM "Participant" WHERE username = $1`,
    [SYNTHETIC_PARTICIPANT_USERNAME]
  )
  const participant = participantResult.rows[0]
  if (!participant || participant.username !== SYNTHETIC_PARTICIPANT_USERNAME) {
    fail('participant_missing')
  }

  const serverResult = await query(
    client,
    `
      SELECT id, name, url, "authType", "isActive", "passChatbotId",
             "chatbotIdHeader", parameters, ("authSecret" IS NOT NULL) AS "hasAuthSecret"
      FROM "ChatbotMCPServer"
      WHERE name = 'KB'
    `
  )
  const server = serverResult.rows[0]
  const configResult = await query(
    client,
    `
      SELECT id, "chatbotId", "mcpServerId", "chatMode", "allowedTools",
             priority, "isEnabled", parameters
      FROM "ChatbotMCPConfig"
      WHERE "chatbotId" = $1 AND "mcpServerId" = $2
        AND "chatMode" IN ('tutor', 'explainer')
      ORDER BY "chatMode"
    `,
    [LOCAL_CHATBOT_ID, server?.id ?? null]
  )
  const mcpConfigs = configResult.rows
  if (
    !server ||
    server.name !== 'KB' ||
    server.url !== 'http://localhost:1417/mcp' ||
    !server.isActive ||
    !server.passChatbotId ||
    server.chatbotIdHeader !== null ||
    mcpConfigs.length !== 2 ||
    new Set(mcpConfigs.map((config) => config.chatMode)).size !== 2
  ) {
    fail('local_mcp_seed_invalid')
  }

  const authenticatedSeed =
    server.authType === 'bearer' &&
    server.hasAuthSecret === true &&
    deepEqual(server.parameters, LOCAL_FIXTURE_MARKER)
  const legacySeed =
    server.authType === 'none' &&
    server.hasAuthSecret === false &&
    (server.parameters === null || deepEqual(server.parameters, {}))
  if (!authenticatedSeed && !legacySeed) fail('local_mcp_auth_invalid')

  for (const config of mcpConfigs) {
    if (
      config.chatbotId !== LOCAL_CHATBOT_ID ||
      config.mcpServerId !== server.id ||
      !['tutor', 'explainer'].includes(config.chatMode) ||
      !config.isEnabled ||
      config.priority !== 0 ||
      !Array.isArray(config.allowedTools) ||
      config.allowedTools.length !== 1 ||
      config.allowedTools[0] !== 'doc_query'
    ) {
      fail('local_mcp_config_invalid')
    }
    const parametersValid = authenticatedSeed
      ? deepEqual(config.parameters, LOCAL_SCOPE)
      : config.parameters === null || deepEqual(config.parameters, {})
    if (!parametersValid) {
      fail('local_mcp_scope_invalid')
    }
  }

  const creditResult = await query(
    client,
    `
      SELECT "participantId", "chatbotId", current::text AS current,
             total::text AS total, "periodStartedAt"::text AS "periodStartedAt",
             "lastResetAt"::text AS "lastResetAt", "resetCount",
             "acceptedDisclaimerId"::text AS "acceptedDisclaimerId",
             "disclaimerAcceptedAt"::text AS "disclaimerAcceptedAt",
             "disclaimerDeclined"
      FROM "ChatUsageCredits"
      WHERE "participantId" = $1 AND "chatbotId" = $2
    `,
    [participant.id, LOCAL_CHATBOT_ID]
  )
  const creditRow = creditResult.rows[0] ?? null

  const fallbackSelected = selected.some(
    (item) => item.requiresExhaustedCredits === true
  )
  let baseUsage = null
  if (fallbackSelected) {
    if (chatbot.aiFeaturesEnabled !== true) fail('owner_ai_access_unavailable')
    baseUsage = await readCurrentBaseUsage(client)
    validateCurrentBaseUsage(baseUsage)
    if (!creditRow) fail('participant_credit_row_missing')
  }

  return {
    chatbot,
    participant,
    server,
    mcpConfigs,
    creditRow,
    baseUsage,
  }
}

async function updateStandardModeConfig(client, config) {
  const updated = await execute(
    client,
    `UPDATE "Chatbot" SET "standardModeConfig" = $2::jsonb WHERE id = $1`,
    [LOCAL_CHATBOT_ID, JSON.stringify(config)]
  )
  if (updated !== 1) fail('standard_mode_config_update_failed')
  const result = await query(
    client,
    `SELECT "standardModeConfig" FROM "Chatbot" WHERE id = $1`,
    [LOCAL_CHATBOT_ID]
  )
  const readback = result.rows[0]?.standardModeConfig
  if (!deepEqual(readback, config)) fail('standard_mode_config_readback_failed')
  return readback
}

async function setMcpEnabled(client, configs, enabled) {
  for (const config of configs) {
    const updated = await execute(
      client,
      `UPDATE "ChatbotMCPConfig" SET "isEnabled" = $2 WHERE id = $1`,
      [config.id, enabled ? config.isEnabled : false]
    )
    if (updated !== 1) fail('mcp_config_update_failed')
  }
}

export async function readFallbackState(client, participantId) {
  const chatbotResult = await query(
    client,
    `
      SELECT "creditInitialCredits", "creditResetPeriod", "creditResetAmount",
             "creditMaxCredits"
      FROM "Chatbot"
      WHERE id = $1
    `,
    [LOCAL_CHATBOT_ID]
  )
  const creditResult = await query(
    client,
    `
      SELECT "participantId", "chatbotId", current::text AS current,
             total::text AS total, "periodStartedAt"::text AS "periodStartedAt",
             "lastResetAt"::text AS "lastResetAt", "resetCount",
             "acceptedDisclaimerId"::text AS "acceptedDisclaimerId",
             "disclaimerAcceptedAt"::text AS "disclaimerAcceptedAt",
             "disclaimerDeclined"
      FROM "ChatUsageCredits"
      WHERE "participantId" = $1 AND "chatbotId" = $2
    `,
    [participantId, LOCAL_CHATBOT_ID]
  )
  return {
    chatbot: chatbotResult.rows[0] ?? null,
    creditRow: creditResult.rows[0] ?? null,
  }
}

export async function prepareExhaustedCredits(client, fixture) {
  const resetUpdated = await execute(
    client,
    `UPDATE "Chatbot" SET "creditResetPeriod" = 'NONE' WHERE id = $1`,
    [LOCAL_CHATBOT_ID]
  )
  const creditsUpdated = await execute(
    client,
    `
      UPDATE "ChatUsageCredits" SET current = 0
      WHERE "participantId" = $1 AND "chatbotId" = $2
    `,
    [fixture.participant.id, LOCAL_CHATBOT_ID]
  )
  if (resetUpdated !== 1 || creditsUpdated !== 1) {
    fail('fallback_preparation_update_failed')
  }
  return assertExhaustedCredits(
    await readFallbackState(client, fixture.participant.id)
  )
}

export async function restoreFixture(client, fixture) {
  const configUpdated = await execute(
    client,
    `UPDATE "Chatbot" SET "standardModeConfig" = $2::jsonb WHERE id = $1`,
    [
      LOCAL_CHATBOT_ID,
      fixture.chatbot.standardModeConfig === null
        ? null
        : JSON.stringify(fixture.chatbot.standardModeConfig),
    ]
  )
  if (configUpdated !== 1) fail('fixture_restore_update_failed')
  for (const config of fixture.mcpConfigs) {
    const updated = await execute(
      client,
      `UPDATE "ChatbotMCPConfig" SET "isEnabled" = $2 WHERE id = $1`,
      [config.id, config.isEnabled]
    )
    if (updated !== 1) fail('fixture_restore_update_failed')
  }
  if (fixture.creditRow) {
    const chatbotUpdated = await execute(
      client,
      `
        UPDATE "Chatbot" SET "creditInitialCredits" = $2,
          "creditResetPeriod" = $3::"CreditResetPeriod",
          "creditResetAmount" = $4, "creditMaxCredits" = $5
        WHERE id = $1
      `,
      [
        LOCAL_CHATBOT_ID,
        fixture.chatbot.creditInitialCredits,
        fixture.chatbot.creditResetPeriod,
        fixture.chatbot.creditResetAmount,
        fixture.chatbot.creditMaxCredits,
      ]
    )
    const creditUpdated = await execute(
      client,
      `
        UPDATE "ChatUsageCredits"
        SET current = $3, total = $4, "periodStartedAt" = $5,
            "lastResetAt" = $6, "resetCount" = $7,
            "acceptedDisclaimerId" = $8, "disclaimerAcceptedAt" = $9,
            "disclaimerDeclined" = $10
        WHERE "participantId" = $1 AND "chatbotId" = $2
      `,
      [
        fixture.creditRow.participantId,
        fixture.creditRow.chatbotId,
        fixture.creditRow.current,
        fixture.creditRow.total,
        fixture.creditRow.periodStartedAt,
        fixture.creditRow.lastResetAt,
        fixture.creditRow.resetCount,
        fixture.creditRow.acceptedDisclaimerId,
        fixture.creditRow.disclaimerAcceptedAt,
        fixture.creditRow.disclaimerDeclined,
      ]
    )
    if (chatbotUpdated !== 1 || creditUpdated !== 1) {
      fail('fixture_restore_update_failed')
    }
  }
  const restored = await readFallbackState(client, fixture.participant.id)
  if (
    !deepEqual(restored.chatbot, {
      creditInitialCredits: fixture.chatbot.creditInitialCredits,
      creditResetPeriod: fixture.chatbot.creditResetPeriod,
      creditResetAmount: fixture.chatbot.creditResetAmount,
      creditMaxCredits: fixture.chatbot.creditMaxCredits,
    }) ||
    (fixture.creditRow && !deepEqual(restored.creditRow, fixture.creditRow))
  ) {
    fail('fixture_restore_readback_failed')
  }

  const configResult = await query(
    client,
    `SELECT "standardModeConfig" FROM "Chatbot" WHERE id = $1`,
    [LOCAL_CHATBOT_ID]
  )
  if (
    !deepEqual(
      configResult.rows[0]?.standardModeConfig,
      fixture.chatbot.standardModeConfig
    )
  ) {
    fail('fixture_restore_readback_failed')
  }
  const mcpResult = await query(
    client,
    `
      SELECT id, "isEnabled"
      FROM "ChatbotMCPConfig"
      WHERE "chatbotId" = $1 AND "mcpServerId" = $2
        AND "chatMode" IN ('tutor', 'explainer')
      ORDER BY "chatMode"
    `,
    [LOCAL_CHATBOT_ID, fixture.server.id]
  )
  if (
    mcpResult.rows.length !== fixture.mcpConfigs.length ||
    fixture.mcpConfigs.some(
      (config) =>
        !mcpResult.rows.some(
          (row) => row.id === config.id && row.isEnabled === config.isEnabled
        )
    )
  ) {
    fail('fixture_restore_readback_failed')
  }
}

function createTarget(env) {
  if (!env.KLICKER_EVAL_TARGET_KEY) fail('target_key_missing')
  if (!env.KLICKER_EVAL_PARTICIPANT_PASSWORD)
    fail('participant_credentials_missing')
  const username =
    env.KLICKER_EVAL_PARTICIPANT_USERNAME || SYNTHETIC_PARTICIPANT_USERNAME
  if (username !== SYNTHETIC_PARTICIPANT_USERNAME)
    fail('participant_username_invalid')
  return new KlickerEvaluationTarget({
    apiOrigin: localOriginValue(
      env,
      'KLICKER_EVAL_API_ORIGIN',
      'http://localhost:3000'
    ),
    chatOrigin: localOriginValue(
      env,
      'KLICKER_EVAL_CHAT_ORIGIN',
      'http://localhost:3004'
    ),
    apiKey: env.KLICKER_EVAL_TARGET_KEY,
    participantUsername: username,
    participantPassword: env.KLICKER_EVAL_PARTICIPANT_PASSWORD,
    chatbotId: LOCAL_CHATBOT_ID,
    modelId: env.KLICKER_EVAL_MODEL_ID || DEFAULT_MODEL_ID,
    maxStreamBytes: Number(env.KLICKER_EVAL_MAX_STREAM_BYTES) || undefined,
  })
}

async function runCountedTurn(target, input) {
  const previousSubmitTurn = target.submitTurn
  let submissionNumber = null
  target.submitTurn = async function countedSubmitTurn(...arguments_) {
    submissionNumber = await reserveSubmission()
    return previousSubmitTurn.apply(this, arguments_)
  }
  try {
    const result = await target.runTurn(input)
    return { result, submissionNumber }
  } catch (error) {
    if (submissionNumber === null) throw error
    throw new CountedTurnError(safeCode(error), submissionNumber)
  } finally {
    target.submitTurn = previousSubmitTurn
  }
}

function receiptPath(caseId) {
  return resolve(
    receiptRoot,
    `attempt-${new Date().toISOString().replaceAll(':', '-')}-${caseId}-${randomUUID()}.json`
  )
}

function baseReceipt(runId, item, config, readback, parent) {
  return {
    schemaVersion: 1,
    kind: 'writing-coach-evaluation-attempt',
    runId,
    attemptId: randomUUID(),
    caseId: item.id,
    mode: item.mode,
    language: item.language ?? null,
    context: item.context ?? null,
    followUpTo: item.followUpTo ?? null,
    requestedModelId: item.requestedModel || null,
    expectedSelectedModelId: item.expectedSelectedModel || null,
    parentId: parent?.assistantMessageId ?? null,
    standardModeConfig: config,
    standardModeConfigReadback: readback,
    startedAt: new Date().toISOString(),
  }
}

async function executeCases({ bundle, selected, receipts, resume, env }) {
  validateExecutionBoundary(env)
  await mkdir(receiptRoot, { recursive: true, mode: 0o700 })
  const client = await createDatabaseClient(env)
  let fixture
  let target
  const runId = randomUUID()
  const allReceipts = [...receipts]
  const summary = { completed: 0, failed: 0, skipped: 0 }
  let creditsPrepared = false

  try {
    fixture = await inspectFixture(client, selected)
    target = createTarget(env)

    for (const item of selected) {
      const previous = latestReceipt(allReceipts, item.id)
      if (resume && previous?.status === 'completed') {
        summary.skipped += 1
        continue
      }

      let parent = null
      if (item.followUpTo) {
        parent = latestReceipt(allReceipts, item.followUpTo, true)
        if (!parent) {
          const failedReceipt = {
            schemaVersion: 1,
            kind: 'writing-coach-evaluation-attempt',
            runId,
            attemptId: randomUUID(),
            caseId: item.id,
            status: 'failed',
            error: { code: `follow_up_receipt_missing:${item.followUpTo}` },
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }
          await writeJsonAtomically(receiptPath(item.id), failedReceipt)
          allReceipts.push(failedReceipt)
          summary.failed += 1
          continue
        }
      }

      let exhaustionPreconditions = null
      let exhaustionReadback = null
      if (item.requiresExhaustedCredits === true) {
        exhaustionPreconditions = fallbackPreconditions(fixture)
        let exhaustedState
        if (!creditsPrepared) {
          exhaustedState = await prepareExhaustedCredits(client, fixture)
          creditsPrepared = true
        } else {
          exhaustedState = assertExhaustedCredits(
            await readFallbackState(client, fixture.participant.id)
          )
        }
        const baseUsageReadback = validateCurrentBaseUsage(
          await readCurrentBaseUsage(client)
        )
        exhaustionReadback = {
          baseUsage: baseUsageReadback,
          credits: fallbackStateReceipt(exhaustedState),
        }
      }

      const config = standardModeConfig(bundle, item)
      const readback = await updateStandardModeConfig(client, config)
      await setMcpEnabled(
        client,
        fixture.mcpConfigs,
        item.mode !== 'writing-coach'
      )

      target.modelId =
        item.requestedModel ||
        bundle.defaults.requestedModel ||
        DEFAULT_MODEL_ID
      const expectedSelectedModelId =
        item.expectedSelectedModel ||
        bundle.defaults.expectedSelectedModel ||
        target.modelId
      const history = parent?.history || []
      const startedAt = new Date().toISOString()
      const receipt = {
        ...baseReceipt(runId, item, config, readback, parent),
        startedAt,
        status: 'failed',
        submissionNumber: null,
        threadId: parent?.threadId ?? null,
        historyBeforeAttempt: history,
        requestedModelId: target.modelId,
        expectedSelectedModelId,
        fallbackExhaustion: {
          preconditions: exhaustionPreconditions ?? null,
          readback: exhaustionReadback ?? null,
        },
        modelEvidence: {
          requestedModelId: target.modelId,
          expectedSelectedModelId,
          selectedModelId: null,
          exposedUsage: null,
        },
        usage: null,
      }

      let stopAfterAttempt = false
      try {
        const { result, submissionNumber } = await runCountedTurn(target, {
          question: item.question,
          mode: item.mode,
          threadId: parent?.threadId ?? null,
          history,
          parentId: parent?.assistantMessageId ?? null,
          expectedSelectedModelId,
        })
        receipt.status = 'completed'
        receipt.submissionNumber = submissionNumber
        receipt.threadId = result.threadId
        receipt.userMessageId = result.userMessageId
        receipt.assistantMessageId = result.assistantMessageId
        receipt.requestedModelId = result.requestedModelId
        receipt.selectedModelId = result.selectedModelId
        receipt.modelEvidence = {
          requestedModelId: result.requestedModelId,
          expectedSelectedModelId,
          selectedModelId: result.selectedModelId,
          exposedUsage: exposedUsage(result),
        }
        receipt.usage = exposedUsage(result)
        receipt.answer = result.answer
        receipt.toolCalls = result.toolCalls
        receipt.history = result.history
        receipt.completedAt = new Date().toISOString()
        summary.completed += 1
      } catch (error) {
        receipt.error = { code: safeCode(error) }
        receipt.submissionNumber = error?.submissionNumber ?? null
        receipt.completedAt = new Date().toISOString()
        summary.failed += 1
        if (safeCode(error) === 'submission_cap_exhausted') {
          stopAfterAttempt = true
        }
      }
      await writeJsonAtomically(receiptPath(item.id), receipt)
      allReceipts.push(receipt)
      if (stopAfterAttempt) break
    }
  } finally {
    let restoreError = null
    if (fixture) {
      try {
        await restoreFixture(client, fixture)
      } catch (error) {
        restoreError = error
      }
    }
    await client.$disconnect().catch((error) => {
      restoreError ||= error
    })
    if (restoreError) throw new EvaluationError('fixture_restore_failed')
  }

  return { runId, summary }
}

async function dryRun({ bundle, selected, receipts, resume, env }) {
  const counter = (await readJson(counterPath)) ?? { attemptedSubmissions: 0 }
  if (
    !Number.isInteger(counter.attemptedSubmissions) ||
    counter.attemptedSubmissions < 0 ||
    counter.attemptedSubmissions > MAX_ATTEMPTED_SUBMISSIONS
  ) {
    fail('submission_counter_invalid')
  }
  validateSelectionDependencies(selected, receipts)
  const requestedSubmissions = resume
    ? selected.filter(
        (item) => latestReceipt(receipts, item.id)?.status !== 'completed'
      ).length
    : selected.length
  if (
    counter.attemptedSubmissions + requestedSubmissions >
    MAX_ATTEMPTED_SUBMISSIONS
  ) {
    fail('dry_run_selection_exceeds_remaining_cap')
  }
  if (env.KLICKER_EVAL_API_ORIGIN) {
    validateLocalOrigin(env.KLICKER_EVAL_API_ORIGIN, 'api_origin')
  }
  if (env.KLICKER_EVAL_CHAT_ORIGIN) {
    validateLocalOrigin(env.KLICKER_EVAL_CHAT_ORIGIN, 'chat_origin')
  }
  return {
    status: 'dry-run-valid',
    caseIds: selected.map((item) => item.id),
    modes: selected.map((item) => item.mode),
    requestedSubmissions,
    attemptedSubmissions: counter.attemptedSubmissions,
    remainingSubmissions:
      MAX_ATTEMPTED_SUBMISSIONS - counter.attemptedSubmissions,
    cap: MAX_ATTEMPTED_SUBMISSIONS,
    network: false,
    databaseWrites: false,
  }
}

function printHelp() {
  process.stdout.write(
    'Usage: writing-coach-evaluation.mjs --case <id>[,<id>...] [--resume] [--dry-run]\n'
  )
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    const arguments_ = parseArgs(argv)
    if (arguments_.help) {
      printHelp()
      return
    }
    const { bundle, cases, casesById } = await loadBundle()
    const selected = selectCases(cases, casesById, arguments_.caseIds)
    const receipts = await readAttemptReceipts()
    validateSelectionDependencies(selected, receipts)
    const result = arguments_.dryRun
      ? await dryRun({
          bundle,
          selected,
          receipts,
          resume: arguments_.resume,
          env,
        })
      : await executeCases({
          bundle,
          selected,
          receipts,
          resume: arguments_.resume,
          env,
        })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.summary?.restoreFailed) process.exitCode = 2
    else if (result.summary?.failed) process.exitCode = 2
  } catch (error) {
    process.stderr.write(`writing-coach-evaluation: ${safeCode(error)}\n`)
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
