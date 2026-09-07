import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { decrypt } from '@klicker-uzh/util'
import pg from 'pg'

import {
  LOCAL_CHATBOT_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_SCOPE,
} from './local-mcp-auth.mjs'
import { repairLocalMcpSeed } from './local-mcp-seed.mjs'

const { Client } = pg

const EXPECTED_CWD = '/workspaces/klicker-uzh'
const SERVER_ID = 'local-mcp-test-server'
const TUTOR_CONFIG_ID = 'local-mcp-test-tutor'
const EXPLAINER_CONFIG_ID = 'local-mcp-test-explainer'
const EXTRA_CONFIG_ID = 'local-mcp-test-extra'
const EXTRA_CHATBOT_ID = 'local-mcp-test-extra-chatbot'
const SYNTHETIC_OWNER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
const SYNTHETIC_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const SYNTHETIC_TOKEN_A = 'local-mcp-transport-token-a'
const SYNTHETIC_TOKEN_B = 'local-mcp-transport-token-b'
const SYNTHETIC_TIMESTAMP = '2000-01-01T00:00:00.000Z'
const AUTH_SECRET_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/i
const STATIC_FAILURE = 'Local MCP seed acceptance failed'
const STATIC_SUCCESS = 'Local MCP seed acceptance passed'

function requireTrue(value, message) {
  assert.equal(value, true, message)
}

function requireJsonEqual(actual, expected, message) {
  requireTrue(isDeepStrictEqual(actual, expected), message)
}

function validateRuntimeContext() {
  requireTrue(
    realpathSync(process.cwd()) === EXPECTED_CWD,
    'invalid working directory'
  )

  const databaseUrl = process.env.DATABASE_URL
  requireTrue(
    typeof databaseUrl === 'string' && databaseUrl.length > 0,
    'missing database URL'
  )

  let parsedUrl
  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    throw new Error('invalid database URL')
  }

  requireTrue(
    ['postgres:', 'postgresql:'].includes(parsedUrl.protocol),
    'invalid database URL protocol'
  )
  requireTrue(
    ['postgres', 'localhost', '127.0.0.1'].includes(parsedUrl.hostname),
    'invalid database URL host'
  )
  requireTrue(parsedUrl.search === '', 'database URL query is not allowed')
}

async function createTemporarySchema(db) {
  await db.query(`
    CREATE TEMP TABLE "ChatbotMCPServer" (
      id text PRIMARY KEY,
      name text NOT NULL,
      "authType" text NOT NULL,
      "authSecret" text,
      parameters jsonb,
      url text NOT NULL,
      "isActive" boolean NOT NULL,
      "passChatbotId" boolean NOT NULL,
      "chatbotIdHeader" text,
      "updatedAt" timestamptz NOT NULL
    )
  `)
  await db.query(`
    CREATE TEMP TABLE "Chatbot" (
      id text PRIMARY KEY,
      "ownerId" text NOT NULL,
      "courseId" text NOT NULL
    )
  `)
  await db.query(`
    CREATE TEMP TABLE "ChatbotMCPConfig" (
      id text PRIMARY KEY,
      "mcpServerId" text NOT NULL,
      "chatbotId" text NOT NULL,
      "chatMode" text NOT NULL,
      "isEnabled" boolean NOT NULL,
      priority integer NOT NULL,
      "allowedTools" text[] NOT NULL,
      parameters jsonb,
      "updatedAt" timestamptz NOT NULL
    )
  `)
}

async function resetSyntheticFixture(db) {
  await db.query('DELETE FROM "ChatbotMCPConfig"')
  await db.query('DELETE FROM "ChatbotMCPServer"')
  await db.query('DELETE FROM "Chatbot"')

  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId") VALUES ($1, $2, $3)',
    [LOCAL_CHATBOT_ID, SYNTHETIC_OWNER_ID, SYNTHETIC_COURSE_ID]
  )
  await db.query(
    'INSERT INTO "ChatbotMCPServer" (id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)',
    [
      SERVER_ID,
      'KB',
      'none',
      null,
      null,
      'http://localhost:1417/mcp',
      true,
      true,
      null,
      SYNTHETIC_TIMESTAMP,
    ]
  )

  for (const [id, chatMode] of [
    [TUTOR_CONFIG_ID, 'tutor'],
    [EXPLAINER_CONFIG_ID, 'explainer'],
  ]) {
    await db.query(
      'INSERT INTO "ChatbotMCPConfig" (id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)',
      [
        id,
        SERVER_ID,
        LOCAL_CHATBOT_ID,
        chatMode,
        true,
        0,
        ['doc_query'],
        null,
        SYNTHETIC_TIMESTAMP,
      ]
    )
  }
}

async function addExtraConsumer(db) {
  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId") VALUES ($1, $2, $3)',
    [EXTRA_CHATBOT_ID, SYNTHETIC_OWNER_ID, SYNTHETIC_COURSE_ID]
  )
  await db.query(
    'INSERT INTO "ChatbotMCPConfig" (id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)',
    [
      EXTRA_CONFIG_ID,
      SERVER_ID,
      EXTRA_CHATBOT_ID,
      'extra',
      true,
      0,
      ['doc_query'],
      null,
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function snapshot(db) {
  const { rows: servers } = await db.query(
    'SELECT id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt" FROM "ChatbotMCPServer" ORDER BY id'
  )
  const { rows: configs } = await db.query(
    'SELECT id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt" FROM "ChatbotMCPConfig" ORDER BY id'
  )
  const { rows: chatbots } = await db.query(
    'SELECT id, "ownerId", "courseId" FROM "Chatbot" ORDER BY id'
  )
  return { chatbots, configs, servers }
}

function requireAuthenticatedFixture(state, message) {
  requireTrue(state.servers.length === 1, `${message}: server count`)
  requireTrue(state.configs.length === 2, `${message}: config count`)
  const [server] = state.servers
  requireTrue(server.authType === 'bearer', `${message}: auth type`)
  requireTrue(
    typeof server.authSecret === 'string' &&
      AUTH_SECRET_PATTERN.test(server.authSecret),
    `${message}: auth secret format`
  )
  requireJsonEqual(
    server.parameters,
    LOCAL_FIXTURE_MARKER,
    `${message}: server marker`
  )
  for (const config of state.configs) {
    requireJsonEqual(config.parameters, LOCAL_SCOPE, `${message}: config scope`)
  }
}

async function requireRepairRejected(db, token, isInterrupted, message) {
  let rejected = false
  try {
    await repairLocalMcpSeed(db, token, isInterrupted)
  } catch {
    rejected = true
  }
  requireTrue(rejected, message)
}

async function runAcceptance(db) {
  await createTemporarySchema(db)

  await resetSyntheticFixture(db)
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
  const firstRotation = await snapshot(db)
  requireAuthenticatedFixture(firstRotation, 'initial repair')

  const firstAuthSecret = firstRotation.servers[0].authSecret
  requireTrue(
    decrypt(firstAuthSecret) === SYNTHETIC_TOKEN_A,
    'initial repair stored the wrong token'
  )
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
  const secondRotation = await snapshot(db)
  requireAuthenticatedFixture(secondRotation, 'repeat repair')
  requireTrue(
    decrypt(secondRotation.servers[0].authSecret) === SYNTHETIC_TOKEN_B,
    'repeat repair stored the wrong token'
  )

  await addExtraConsumer(db)
  const ownershipBefore = await snapshot(db)
  await requireRepairRejected(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'ownership conflict was accepted'
  )
  const ownershipAfter = await snapshot(db)
  requireJsonEqual(
    ownershipAfter,
    ownershipBefore,
    'ownership conflict changed the snapshot'
  )

  await resetSyntheticFixture(db)
  const rollbackBefore = await snapshot(db)
  await db.query(`
    ALTER TABLE "ChatbotMCPConfig"
    ADD CONSTRAINT "local_mcp_test_reject_scope"
    CHECK (parameters IS NULL OR NOT (parameters ? 'required'))
  `)
  await requireRepairRejected(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'second update failure was accepted'
  )
  const rollbackAfter = await snapshot(db)
  requireJsonEqual(
    rollbackAfter,
    rollbackBefore,
    'failed second update changed the snapshot'
  )
  await db.query(
    'ALTER TABLE "ChatbotMCPConfig" DROP CONSTRAINT "local_mcp_test_reject_scope"'
  )

  await resetSyntheticFixture(db)
  const interruptionBefore = await snapshot(db)
  await requireRepairRejected(
    db,
    SYNTHETIC_TOKEN_A,
    () => true,
    'interruption was accepted'
  )
  const interruptionAfter = await snapshot(db)
  requireJsonEqual(
    interruptionAfter,
    interruptionBefore,
    'interruption before the write changed the snapshot'
  )
}

async function main() {
  requireTrue(
    process.env.LOCAL_MCP_SEED_TEST === '1',
    'LOCAL_MCP_SEED_TEST=1 is required'
  )
  validateRuntimeContext()

  let client
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10_000,
    })
    client.on('error', () => {})
    await client.connect()
    await client.query('SET search_path TO pg_temp')
    await runAcceptance(client)
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

main()
  .then(() => console.log(STATIC_SUCCESS))
  .catch(() => {
    console.error(STATIC_FAILURE)
    process.exitCode = 1
  })
