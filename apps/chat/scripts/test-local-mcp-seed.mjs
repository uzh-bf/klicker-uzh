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
const SYNTHETIC_START_DATE = '2020-01-01'
const SYNTHETIC_END_DATE = '2055-01-01'
const SYNTHETIC_PIN_CODE = 934671825
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
    CREATE TEMP TABLE "User" (
      id text PRIMARY KEY,
      shortname text NOT NULL
    )
  `)
  await db.query(`
    CREATE TEMP TABLE "Course" (
      id text PRIMARY KEY,
      "ownerId" text NOT NULL,
      name text NOT NULL,
      "displayName" text NOT NULL,
      "pinCode" integer UNIQUE,
      "startDate" timestamptz NOT NULL,
      "endDate" timestamptz NOT NULL,
      "groupDeadlineDate" timestamptz NOT NULL,
      "isGamificationEnabled" boolean NOT NULL DEFAULT true,
      "isGroupCreationEnabled" boolean NOT NULL DEFAULT true,
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
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
      name text NOT NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TEMP TABLE "ChatbotMCPConfig" (
      id text PRIMARY KEY,
      "mcpServerId" text NOT NULL,
      "chatbotId" text NOT NULL,
      "chatMode" text NOT NULL,
      "isEnabled" boolean NOT NULL DEFAULT true,
      priority integer NOT NULL DEFAULT 0,
      "allowedTools" jsonb,
      parameters jsonb,
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )
  `)
}

async function clearSyntheticFixture(db) {
  await db.query('DELETE FROM "ChatbotMCPConfig"')
  await db.query('DELETE FROM "ChatbotMCPServer"')
  await db.query('DELETE FROM "Chatbot"')
  await db.query('DELETE FROM "Course"')
  await db.query('DELETE FROM "User"')
}

async function insertSyntheticOwner(db, shortname = 'lecturer') {
  await db.query('INSERT INTO "User" (id, shortname) VALUES ($1, $2)', [
    SYNTHETIC_OWNER_ID,
    shortname,
  ])
}

async function insertSyntheticCourse(db) {
  await db.query(
    'INSERT INTO "Course" (id, "ownerId", name, "displayName", "pinCode", "startDate", "endDate", "groupDeadlineDate", "isGamificationEnabled", "isGroupCreationEnabled", "updatedAt") VALUES ($1, $2, $3, $3, $4, $5, $6, $6, false, false, $7)',
    [
      SYNTHETIC_COURSE_ID,
      SYNTHETIC_OWNER_ID,
      'Synthetic local runtime fixture',
      SYNTHETIC_PIN_CODE,
      SYNTHETIC_START_DATE,
      SYNTHETIC_END_DATE,
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function insertSyntheticChatbot(
  db,
  {
    id = LOCAL_CHATBOT_ID,
    ownerId = SYNTHETIC_OWNER_ID,
    courseId = SYNTHETIC_COURSE_ID,
  } = {}
) {
  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId", name, "updatedAt") VALUES ($1, $2, $3, $4, $5)',
    [id, ownerId, courseId, 'Synthetic local MCP fixture', SYNTHETIC_TIMESTAMP]
  )
}

async function insertSyntheticServer(
  db,
  { authType = 'none', authSecret = null, parameters = null } = {}
) {
  await db.query(
    'INSERT INTO "ChatbotMCPServer" (id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)',
    [
      SERVER_ID,
      'KB',
      authType,
      authSecret,
      parameters === null ? null : JSON.stringify(parameters),
      'http://localhost:1417/mcp',
      true,
      true,
      null,
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function resetSyntheticFixture(db) {
  await clearSyntheticFixture(db)
  await insertSyntheticOwner(db)
  await insertSyntheticCourse(db)
  await insertSyntheticChatbot(db)
  await insertSyntheticServer(db)

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
        true,
        0,
        JSON.stringify(['doc_query']),
        null,
        SYNTHETIC_TIMESTAMP,
      ]
    )
  }
}

async function resetMissingParentFixture(
  db,
  {
    ownerShortname = 'lecturer',
    includeOwner = true,
    existingParents = [],
    server = {},
  } = {}
) {
  await clearSyntheticFixture(db)
  if (includeOwner) await insertSyntheticOwner(db, ownerShortname)
  if (existingParents.includes('course')) await insertSyntheticCourse(db)
  if (existingParents.includes('chatbot')) await insertSyntheticChatbot(db)
  await insertSyntheticServer(db, server)
}

async function addExtraConsumer(db) {
  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId", name, "updatedAt") VALUES ($1, $2, $3, $4, $5)',
    [
      EXTRA_CHATBOT_ID,
      SYNTHETIC_OWNER_ID,
      SYNTHETIC_COURSE_ID,
      'Synthetic extra MCP consumer',
      SYNTHETIC_TIMESTAMP,
    ]
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
    'SELECT id, "ownerId", "courseId", name, "updatedAt" FROM "Chatbot" ORDER BY id'
  )
  const { rows: courses } = await db.query(
    'SELECT id, "ownerId", name, "displayName", "pinCode", "startDate", "endDate", "groupDeadlineDate", "isGamificationEnabled", "isGroupCreationEnabled", "updatedAt" FROM "Course" ORDER BY id'
  )
  const { rows: users } = await db.query(
    'SELECT id, shortname FROM "User" ORDER BY id'
  )
  return { chatbots, configs, courses, servers, users }
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
    requireJsonEqual(
      config.allowedTools,
      ['doc_query'],
      `${message}: allowed tools`
    )
    requireJsonEqual(config.parameters, LOCAL_SCOPE, `${message}: config scope`)
  }
}

function requireRecoveredParents(state, message) {
  requireTrue(state.users.length === 1, `${message}: user count`)
  const [user] = state.users
  requireTrue(user.id === SYNTHETIC_OWNER_ID, `${message}: user id`)
  requireTrue(user.shortname === 'lecturer', `${message}: user shortname`)

  requireTrue(state.courses.length === 1, `${message}: course count`)
  const [course] = state.courses
  requireTrue(course.id === SYNTHETIC_COURSE_ID, `${message}: course id`)
  requireTrue(course.ownerId === SYNTHETIC_OWNER_ID, `${message}: course owner`)
  requireTrue(Number.isInteger(course.pinCode), `${message}: course pin`)
  for (const [field, value] of [
    ['start date', course.startDate],
    ['end date', course.endDate],
    ['group deadline', course.groupDeadlineDate],
  ]) {
    requireTrue(
      value instanceof Date && !Number.isNaN(value.getTime()),
      `${message}: course ${field}`
    )
  }
  requireTrue(
    course.isGamificationEnabled === false,
    `${message}: course gamification flag`
  )
  requireTrue(
    course.isGroupCreationEnabled === false,
    `${message}: course group flag`
  )

  requireTrue(state.chatbots.length === 1, `${message}: chatbot count`)
  const [chatbot] = state.chatbots
  requireTrue(chatbot.id === LOCAL_CHATBOT_ID, `${message}: chatbot id`)
  requireTrue(
    chatbot.ownerId === SYNTHETIC_OWNER_ID,
    `${message}: chatbot owner`
  )
  requireTrue(
    chatbot.courseId === SYNTHETIC_COURSE_ID,
    `${message}: chatbot course`
  )
  requireTrue(
    typeof chatbot.name === 'string' && chatbot.name.length > 0,
    `${message}: chatbot name`
  )
}

function stableRecoveredFixture(state) {
  const withoutUpdatedAt = ({ updatedAt, ...row }) => row
  return {
    chatbots: state.chatbots,
    configs: state.configs.map(withoutUpdatedAt),
    courses: state.courses,
    users: state.users,
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

async function requireRepairRejectedWithoutWrites(
  db,
  token,
  isInterrupted,
  message
) {
  const before = await snapshot(db)
  await requireRepairRejected(db, token, isInterrupted, message)
  const after = await snapshot(db)
  requireJsonEqual(after, before, `${message}: changed the snapshot`)
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

  await resetMissingParentFixture(db)
  const missingParentBefore = await snapshot(db)
  requireTrue(
    missingParentBefore.courses.length === 0 &&
      missingParentBefore.chatbots.length === 0 &&
      missingParentBefore.configs.length === 0,
    'missing-parent fixture was not empty'
  )
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
  const recovered = await snapshot(db)
  requireAuthenticatedFixture(recovered, 'missing-parent recovery')
  requireRecoveredParents(recovered, 'missing-parent recovery')
  const recoveredShape = stableRecoveredFixture(recovered)
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
  const repeatedRecovery = await snapshot(db)
  requireAuthenticatedFixture(repeatedRecovery, 'missing-parent repeat')
  requireRecoveredParents(repeatedRecovery, 'missing-parent repeat')
  requireJsonEqual(
    stableRecoveredFixture(repeatedRecovery),
    recoveredShape,
    'missing-parent repeat changed the fixture shape'
  )
  requireTrue(
    decrypt(repeatedRecovery.servers[0].authSecret) === SYNTHETIC_TOKEN_B,
    'missing-parent repeat stored the wrong token'
  )

  await resetMissingParentFixture(db, {
    server: {
      authType: 'bearer',
      authSecret: SYNTHETIC_AUTH_SECRET,
      parameters: LOCAL_FIXTURE_MARKER,
    },
  })
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
  const authenticatedRecovery = await snapshot(db)
  requireAuthenticatedFixture(
    authenticatedRecovery,
    'authenticated missing-parent recovery'
  )
  requireRecoveredParents(
    authenticatedRecovery,
    'authenticated missing-parent recovery'
  )
  requireTrue(
    decrypt(authenticatedRecovery.servers[0].authSecret) === SYNTHETIC_TOKEN_A,
    'authenticated missing-parent recovery stored the wrong token'
  )

  for (const existingParents of [
    ['course'],
    ['chatbot'],
    ['course', 'chatbot'],
  ]) {
    await resetMissingParentFixture(db, { existingParents })
    await requireRepairRejectedWithoutWrites(
      db,
      SYNTHETIC_TOKEN_A,
      () => false,
      `partial ${existingParents.join(' and ')} parent state was accepted`
    )
  }

  await resetMissingParentFixture(db, { ownerShortname: 'not-lecturer' })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'wrong owner was accepted'
  )

  await resetMissingParentFixture(db, { includeOwner: false })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'missing owner was accepted'
  )

  await resetMissingParentFixture(db)
  await addExtraConsumer(db)
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'unrelated server consumer was accepted'
  )

  await resetMissingParentFixture(db, {
    server: {
      authType: 'bearer',
      authSecret: SYNTHETIC_AUTH_SECRET,
      parameters: { localFixture: 'invalid' },
    },
  })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'invalid server marker was accepted'
  )

  await resetMissingParentFixture(db)
  let interruptionChecks = 0
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => {
      interruptionChecks += 1
      return interruptionChecks > 1
    },
    'post-insertion interruption was accepted'
  )

  await resetMissingParentFixture(db)
  await db.query(`
    ALTER TABLE "ChatbotMCPConfig"
    ADD CONSTRAINT "local_mcp_test_reject_recovery_config"
    CHECK ("chatMode" <> 'explainer')
  `)
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'recovery insertion failure was accepted'
  )
  await db.query(
    'ALTER TABLE "ChatbotMCPConfig" DROP CONSTRAINT "local_mcp_test_reject_recovery_config"'
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
