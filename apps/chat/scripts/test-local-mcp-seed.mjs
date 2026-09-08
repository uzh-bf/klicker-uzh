import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { decrypt } from '@klicker-uzh/util'
import pg from 'pg'
import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  disposableDatabaseIdentityQuery,
  validateDisposableDatabaseUrl,
} from '../../../packages/prisma/src/disposableDatabase.ts'

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
const SYNTHETIC_AUTH_SECRET =
  '00000000000000000000000000000000:11111111111111111111111111111111:22222222'
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

  assertNoPostgresEnvironmentOverrides()
  const databaseUrl = validateDisposableDatabaseUrl(process.env.DATABASE_URL)
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
    CREATE TEMP TABLE "User" (id text PRIMARY KEY, shortname text NOT NULL);
    CREATE TEMP TABLE "Course" (
      id text PRIMARY KEY, "ownerId" text NOT NULL, name text NOT NULL,
      "displayName" text NOT NULL, "pinCode" integer UNIQUE,
      "startDate" timestamptz NOT NULL, "endDate" timestamptz NOT NULL,
      "groupDeadlineDate" timestamptz NOT NULL,
      "isGamificationEnabled" boolean NOT NULL,
      "isGroupCreationEnabled" boolean NOT NULL,
      "updatedAt" timestamptz NOT NULL
    )
  `)
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
      "courseId" text NOT NULL,
      name text,
      "updatedAt" timestamptz
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
      "allowedTools" jsonb NOT NULL,
      parameters jsonb,
      "updatedAt" timestamptz NOT NULL
    )
  `)
}

async function resetSyntheticFixture(
  db,
  {
    authType = 'none',
    authSecret = null,
    parameters = null,
    passChatbotId = true,
    configParameters = null,
    configEnabled = { tutor: true, explainer: true },
  } = {}
) {
  await db.query('DELETE FROM "ChatbotMCPConfig"')
  await db.query('DELETE FROM "ChatbotMCPServer"')
  await db.query('DELETE FROM "Chatbot"')
  await db.query('DELETE FROM "Course"')
  await db.query('DELETE FROM "User"')

  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId") VALUES ($1, $2, $3)',
    [LOCAL_CHATBOT_ID, SYNTHETIC_OWNER_ID, SYNTHETIC_COURSE_ID]
  )
  await db.query(
    'INSERT INTO "ChatbotMCPServer" (id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)',
    [
      SERVER_ID,
      'KB',
      authType,
      authSecret,
      parameters,
      'http://localhost:1417/mcp',
      true,
      passChatbotId,
      null,
      SYNTHETIC_TIMESTAMP,
    ]
  )

  for (const [id, chatMode] of [
    [TUTOR_CONFIG_ID, 'tutor'],
    [EXPLAINER_CONFIG_ID, 'explainer'],
  ]) {
    await db.query(
      'INSERT INTO "ChatbotMCPConfig" (id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)',
      [
        id,
        SERVER_ID,
        LOCAL_CHATBOT_ID,
        chatMode,
        configEnabled[chatMode],
        0,
        JSON.stringify(['doc_query']),
        configParameters,
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
    'INSERT INTO "ChatbotMCPConfig" (id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)',
    [
      EXTRA_CONFIG_ID,
      SERVER_ID,
      EXTRA_CHATBOT_ID,
      'extra',
      true,
      0,
      JSON.stringify(['doc_query']),
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
  const { rows: courses } = await db.query('SELECT * FROM "Course" ORDER BY id')
  const { rows: users } = await db.query('SELECT * FROM "User" ORDER BY id')
  return { chatbots, configs, servers, courses, users }
}

function requireAuthenticatedFixture(state, message, expectedEnabled) {
  requireTrue(state.servers.length === 1, `${message}: server count`)
  requireTrue(state.configs.length === 2, `${message}: config count`)
  requireTrue(state.chatbots.length === 1, `${message}: chatbot count`)
  const [chatbot] = state.chatbots
  requireTrue(chatbot.id === LOCAL_CHATBOT_ID, `${message}: chatbot ID`)
  requireTrue(chatbot.ownerId === SYNTHETIC_OWNER_ID, `${message}: owner ID`)
  requireTrue(chatbot.courseId === SYNTHETIC_COURSE_ID, `${message}: course ID`)
  const [server] = state.servers
  requireTrue(server.name === 'KB', `${message}: server name`)
  requireTrue(
    server.url === 'http://localhost:1417/mcp',
    `${message}: server URL`
  )
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
  requireTrue(server.passChatbotId === false, `${message}: pass chatbot ID`)
  requireTrue(server.chatbotIdHeader === null, `${message}: chatbot header`)
  for (const config of state.configs) {
    requireTrue(
      config.isEnabled === expectedEnabled[config.chatMode],
      `${message}: ${config.chatMode} enabled state`
    )
    requireTrue(
      config.priority === 0,
      `${message}: ${config.chatMode} priority`
    )
    requireJsonEqual(
      config.allowedTools,
      ['doc_query'],
      `${message}: ${config.chatMode} allowed tools`
    )
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
  const legacyFirstRotation = await snapshot(db)
  requireAuthenticatedFixture(legacyFirstRotation, 'legacy initial repair', {
    tutor: true,
    explainer: true,
  })

  const legacyFirstAuthSecret = legacyFirstRotation.servers[0].authSecret
  requireTrue(
    decrypt(legacyFirstAuthSecret) === SYNTHETIC_TOKEN_A,
    'legacy initial repair stored the wrong token'
  )
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
  const legacySecondRotation = await snapshot(db)
  requireAuthenticatedFixture(legacySecondRotation, 'legacy repeat repair', {
    tutor: true,
    explainer: true,
  })
  requireTrue(
    decrypt(legacySecondRotation.servers[0].authSecret) === SYNTHETIC_TOKEN_B,
    'legacy repeat repair stored the wrong token'
  )

  for (const configEnabled of [
    { tutor: true, explainer: true },
    { tutor: false, explainer: false },
    { tutor: true, explainer: false },
  ]) {
    for (const emptyParameters of [null, {}]) {
      await resetSyntheticFixture(db, {
        authType: 'scope_token',
        parameters: emptyParameters,
        passChatbotId: false,
        configParameters: emptyParameters,
        configEnabled,
      })
      await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
      const firstRotation = await snapshot(db)
      requireAuthenticatedFixture(
        firstRotation,
        'scope_token initial repair',
        configEnabled
      )

      const firstAuthSecret = firstRotation.servers[0].authSecret
      requireTrue(
        decrypt(firstAuthSecret) === SYNTHETIC_TOKEN_A,
        'initial repair stored the wrong token'
      )
      await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
      const secondRotation = await snapshot(db)
      requireAuthenticatedFixture(
        secondRotation,
        'scope_token repeat repair',
        configEnabled
      )
      requireJsonEqual(
        secondRotation.configs.map(({ id }) => id),
        firstRotation.configs.map(({ id }) => id),
        'repeat repair replaced configs'
      )
      requireTrue(
        decrypt(secondRotation.servers[0].authSecret) === SYNTHETIC_TOKEN_B,
        'repeat repair stored the wrong token'
      )
    }
  }

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

async function runMissingParentAcceptance(db) {
  async function reset(authType = 'scope_token') {
    await resetSyntheticFixture(db, {
      authType,
      passChatbotId: false,
      authSecret: authType === 'bearer' ? SYNTHETIC_AUTH_SECRET : null,
      parameters: authType === 'bearer' ? LOCAL_FIXTURE_MARKER : null,
    })
    await db.query('DELETE FROM "ChatbotMCPConfig"')
    await db.query('DELETE FROM "Chatbot"')
    await db.query('INSERT INTO "User" (id, shortname) VALUES ($1, $2)', [
      SYNTHETIC_OWNER_ID,
      'lecturer',
    ])
  }
  async function rejectUnchanged(isInterrupted = () => false) {
    const before = await snapshot(db)
    await requireRepairRejected(
      db,
      SYNTHETIC_TOKEN_A,
      isInterrupted,
      'conflicting recovery accepted'
    )
    requireJsonEqual(await snapshot(db), before, 'rejected recovery wrote rows')
  }
  for (const authType of ['scope_token', 'bearer']) {
    await reset(authType)
    await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
    const first = await snapshot(db)
    requireAuthenticatedFixture(first, 'restored fixture', {
      tutor: false,
      explainer: false,
    })
    requireTrue(
      first.courses.length === 1 &&
        first.courses[0].id === SYNTHETIC_COURSE_ID &&
        first.courses[0].ownerId === SYNTHETIC_OWNER_ID,
      'wrong restored course ownership'
    )
    requireTrue(
      first.courses[0].isGamificationEnabled === false &&
        first.courses[0].isGroupCreationEnabled === false,
      'restored course enabled capabilities'
    )
    await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
    const second = await snapshot(db)
    requireAuthenticatedFixture(second, 'repeated restored fixture', {
      tutor: false,
      explainer: false,
    })
    const stable = (state) => ({
      ...state,
      servers: undefined,
      configs: state.configs.map(({ updatedAt, ...row }) => row),
    })
    requireJsonEqual(
      stable(second),
      stable(first),
      'repeat recovery replaced fixture'
    )
    requireTrue(
      decrypt(second.servers[0].authSecret) === SYNTHETIC_TOKEN_B,
      'repeat recovery did not rotate token'
    )
  }
  await reset('none')
  await db.query('UPDATE "ChatbotMCPServer" SET "passChatbotId" = true')
  await rejectUnchanged()
  for (const conflict of [
    'missing owner',
    'wrong owner',
    'existing chatbot',
    'existing course',
    'foreign consumer',
    'server marker',
    'interruption',
    'insert failure',
  ]) {
    await reset()
    if (conflict === 'missing owner') await db.query('DELETE FROM "User"')
    if (conflict === 'wrong owner')
      await db.query('UPDATE "User" SET shortname = $1', ['unowned'])
    if (conflict === 'existing chatbot')
      await db.query(
        'INSERT INTO "Chatbot" (id, "ownerId", "courseId") VALUES ($1, $2, $3)',
        [LOCAL_CHATBOT_ID, SYNTHETIC_OWNER_ID, SYNTHETIC_COURSE_ID]
      )
    if (conflict === 'existing course')
      await db.query(
        `INSERT INTO "Course" VALUES ($1, $2, 'synthetic', 'synthetic', 1, NOW(), NOW(), NOW(), false, false, NOW())`,
        [SYNTHETIC_COURSE_ID, SYNTHETIC_OWNER_ID]
      )
    if (conflict === 'foreign consumer') await addExtraConsumer(db)
    if (conflict === 'server marker')
      await db.query('UPDATE "ChatbotMCPServer" SET parameters = $1::jsonb', [
        JSON.stringify({ localFixture: 'unowned' }),
      ])
    if (conflict === 'insert failure')
      await db.query(
        `ALTER TABLE "ChatbotMCPConfig" ADD CONSTRAINT reject_recovery CHECK ("chatMode" <> 'explainer')`
      )
    let interruptionChecks = 0
    await rejectUnchanged(
      () => conflict === 'interruption' && ++interruptionChecks > 1
    )
    if (conflict === 'insert failure')
      await db.query(
        'ALTER TABLE "ChatbotMCPConfig" DROP CONSTRAINT reject_recovery'
      )
  }
}

async function main() {
  requireTrue(
    process.env.LOCAL_MCP_SEED_TEST === '1',
    'LOCAL_MCP_SEED_TEST=1 is required'
  )
  validateRuntimeContext()
  for (const mismatch of [
    { database: 'retained' },
    { login: 'owner' },
    { role: 'owner' },
    { marker: null },
    { privileged: true },
  ]) {
    const queries = []
    await assert.rejects(() =>
      repairLocalMcpSeed(
        {
          async query(sql) {
            queries.push(sql)
            return {
              rows: [
                {
                  database: 'klicker_test',
                  login: 'klicker_test',
                  role: 'klicker_test',
                  marker: 'klicker-disposable-test-v1',
                  privileged: false,
                  ...mismatch,
                },
              ],
            }
          },
        },
        SYNTHETIC_TOKEN_A,
        () => false
      )
    )
    assert.deepEqual(queries, [disposableDatabaseIdentityQuery])
  }

  let client
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10_000,
    })
    client.on('error', () => {})
    await client.connect()
    assertDisposableDatabaseIdentity(
      (await client.query(disposableDatabaseIdentityQuery)).rows
    )
    await client.query('SET search_path TO pg_temp')
    await runAcceptance(client)
    await runMissingParentAcceptance(client)
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
