import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { decrypt } from '@klicker-uzh/util'
import pg from 'pg'

import {
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_COURSE_PIN,
  LOCAL_FIXTURE_MARKER,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
  LOCAL_SERVER_NAME,
  LOCAL_SERVER_URL,
} from './local-mcp-auth.mjs'
import { repairLocalMcpSeed } from './local-mcp-seed.mjs'

const { Client } = pg

const EXPECTED_CWD = '/workspaces/klicker-uzh'
const GLOBAL_SERVER_ID = 'global-kb-server'
const GLOBAL_CHATBOT_ID = 'global-kb-chatbot'
const GLOBAL_CONFIG_ID = 'global-kb-config'
const GLOBAL_OWNER_ID = 'global-owner'
const GLOBAL_COURSE_ID = 'global-course'
const TUTOR_CONFIG_ID = 'local-mcp-test-tutor'
const EXPLAINER_CONFIG_ID = 'local-mcp-test-explainer'
const EXTRA_CONFIG_ID = 'local-mcp-test-extra'
const EXTRA_CHATBOT_ID = 'local-mcp-test-extra-chatbot'
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
    ['postgres', 'localhost', '127.0.0.1', '[::1]', '::1'].includes(
      parsedUrl.hostname
    ),
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
      "updatedAt" timestamptz NOT NULL
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

async function insertOwner(db, id, shortname) {
  await db.query('INSERT INTO "User" (id, shortname) VALUES ($1, $2)', [
    id,
    shortname,
  ])
}

async function insertCourse(db, id, ownerId, pinCode = LOCAL_COURSE_PIN) {
  await db.query(
    'INSERT INTO "Course" (id, "ownerId", name, "displayName", "pinCode", "startDate", "endDate", "groupDeadlineDate", "isGamificationEnabled", "isGroupCreationEnabled", "updatedAt") VALUES ($1, $2, $3, $3, $4, $5, $6, $6, false, false, $7)',
    [
      id,
      ownerId,
      `Synthetic course ${id}`,
      pinCode,
      '2020-01-01',
      '2055-01-01',
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function insertChatbot(db, id, ownerId, courseId) {
  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId", name, "updatedAt") VALUES ($1, $2, $3, $4, $5)',
    [id, ownerId, courseId, `Synthetic chatbot ${id}`, SYNTHETIC_TIMESTAMP]
  )
}

async function insertServer(
  db,
  {
    id,
    name,
    authType = 'none',
    authSecret = null,
    parameters = null,
    url = LOCAL_SERVER_URL,
    isActive = true,
    passChatbotId = id !== LOCAL_SERVER_ID,
    chatbotIdHeader = null,
  }
) {
  await db.query(
    'INSERT INTO "ChatbotMCPServer" (id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)',
    [
      id,
      name,
      authType,
      authSecret,
      parameters === null ? null : JSON.stringify(parameters),
      url,
      isActive,
      passChatbotId,
      chatbotIdHeader,
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function insertConfig(
  db,
  { id, serverId, chatbotId, chatMode, isEnabled = true, parameters = null }
) {
  await db.query(
    'INSERT INTO "ChatbotMCPConfig" (id, "mcpServerId", "chatbotId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, 0, $6::jsonb, $7::jsonb, $8)',
    [
      id,
      serverId,
      chatbotId,
      chatMode,
      isEnabled,
      JSON.stringify(['doc_query']),
      parameters === null ? null : JSON.stringify(parameters),
      SYNTHETIC_TIMESTAMP,
    ]
  )
}

async function insertDedicatedParents(db) {
  await insertOwner(db, LOCAL_OWNER_ID, 'lecturer')
  await insertCourse(db, LOCAL_COURSE_ID, LOCAL_OWNER_ID)
  await insertChatbot(db, LOCAL_CHATBOT_ID, LOCAL_OWNER_ID, LOCAL_COURSE_ID)
}

async function insertGlobalRows(db) {
  await insertOwner(db, GLOBAL_OWNER_ID, 'global-owner')
  await insertCourse(db, GLOBAL_COURSE_ID, GLOBAL_OWNER_ID, 934671826)
  await insertChatbot(db, GLOBAL_CHATBOT_ID, GLOBAL_OWNER_ID, GLOBAL_COURSE_ID)
  await insertServer(db, {
    id: GLOBAL_SERVER_ID,
    name: 'KB',
    authType: 'scope_token',
  })
  await insertConfig(db, {
    id: GLOBAL_CONFIG_ID,
    serverId: GLOBAL_SERVER_ID,
    chatbotId: GLOBAL_CHATBOT_ID,
    chatMode: 'tutor',
    isEnabled: false,
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_ids: ['11111111-1111-4111-8111-111111111111'],
    },
  })
}

async function resetSyntheticFixture(db, { withGlobal = true } = {}) {
  await clearSyntheticFixture(db)
  if (withGlobal) await insertGlobalRows(db)
  await insertDedicatedParents(db)
  await insertServer(db, {
    id: LOCAL_SERVER_ID,
    name: LOCAL_SERVER_NAME,
    authType: 'bearer',
    authSecret: SYNTHETIC_AUTH_SECRET,
    parameters: LOCAL_FIXTURE_MARKER,
  })
  await insertConfig(db, {
    id: TUTOR_CONFIG_ID,
    serverId: LOCAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    chatMode: 'tutor',
    parameters: LOCAL_SCOPE,
  })
  await insertConfig(db, {
    id: EXPLAINER_CONFIG_ID,
    serverId: LOCAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    chatMode: 'explainer',
    parameters: LOCAL_SCOPE,
  })
}

async function resetCreationFixture(db) {
  await clearSyntheticFixture(db)
  await insertGlobalRows(db)
  await insertOwner(db, LOCAL_OWNER_ID, 'lecturer')
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
  await insertGlobalRows(db)
  if (includeOwner) await insertOwner(db, LOCAL_OWNER_ID, ownerShortname)
  if (existingParents.includes('course')) {
    await insertCourse(db, LOCAL_COURSE_ID, LOCAL_OWNER_ID)
  }
  if (existingParents.includes('chatbot')) {
    await insertChatbot(db, LOCAL_CHATBOT_ID, LOCAL_OWNER_ID, LOCAL_COURSE_ID)
  }
  await insertServer(db, {
    id: LOCAL_SERVER_ID,
    name: LOCAL_SERVER_NAME,
    ...server,
  })
}

async function addExtraConsumer(db) {
  await insertChatbot(db, EXTRA_CHATBOT_ID, LOCAL_OWNER_ID, LOCAL_COURSE_ID)
  await insertConfig(db, {
    id: EXTRA_CONFIG_ID,
    serverId: LOCAL_SERVER_ID,
    chatbotId: EXTRA_CHATBOT_ID,
    chatMode: 'extra',
  })
}

async function snapshot(db) {
  const tables = [
    ['servers', 'SELECT * FROM "ChatbotMCPServer" ORDER BY id'],
    ['configs', 'SELECT * FROM "ChatbotMCPConfig" ORDER BY id'],
    ['chatbots', 'SELECT * FROM "Chatbot" ORDER BY id'],
    ['courses', 'SELECT * FROM "Course" ORDER BY id'],
    ['users', 'SELECT * FROM "User" ORDER BY id'],
  ]
  const result = {}
  for (const [name, query] of tables) {
    result[name] = (await db.query(query)).rows
  }
  return result
}

function requireAuthenticatedFixture(state, message) {
  const server = state.servers.find((row) => row.id === LOCAL_SERVER_ID)
  const configs = state.configs.filter(
    (row) => row.mcpServerId === LOCAL_SERVER_ID
  )
  requireTrue(server !== undefined, `${message}: server`)
  requireTrue(configs.length === 2, `${message}: config count`)
  requireTrue(server.name === LOCAL_SERVER_NAME, `${message}: server name`)
  requireTrue(server.url === LOCAL_SERVER_URL, `${message}: server URL`)
  requireTrue(server.authType === 'bearer', `${message}: auth type`)
  requireTrue(server.isActive === true, `${message}: active state`)
  requireTrue(server.passChatbotId === false, `${message}: chatbot header mode`)
  requireTrue(
    server.chatbotIdHeader === null || server.chatbotIdHeader === undefined,
    `${message}: chatbot header`
  )
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
  const course = state.courses.find((row) => row.id === LOCAL_COURSE_ID)
  requireTrue(course !== undefined, `${message}: course`)
  requireTrue(course.ownerId === LOCAL_OWNER_ID, `${message}: course owner`)
  requireTrue(course.pinCode === LOCAL_COURSE_PIN, `${message}: course PIN`)
  const chatbot = state.chatbots.find((row) => row.id === LOCAL_CHATBOT_ID)
  requireTrue(chatbot !== undefined, `${message}: chatbot`)
  requireTrue(chatbot.ownerId === LOCAL_OWNER_ID, `${message}: chatbot owner`)
  requireTrue(
    chatbot.courseId === LOCAL_COURSE_ID,
    `${message}: chatbot course`
  )
  for (const config of configs) {
    requireJsonEqual(
      config.allowedTools,
      ['doc_query'],
      `${message}: allowed tools`
    )
    requireJsonEqual(config.parameters, LOCAL_SCOPE, `${message}: config scope`)
  }
}

function unrelatedRows(state) {
  return {
    chatbots: state.chatbots.filter((row) => row.id !== LOCAL_CHATBOT_ID),
    configs: state.configs.filter(
      (row) =>
        row.mcpServerId !== LOCAL_SERVER_ID &&
        row.chatbotId !== LOCAL_CHATBOT_ID
    ),
    courses: state.courses.filter((row) => row.id !== LOCAL_COURSE_ID),
    servers: state.servers.filter((row) => row.id !== LOCAL_SERVER_ID),
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

  await resetCreationFixture(db)
  const creationBefore = await snapshot(db)
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
  const created = await snapshot(db)
  requireAuthenticatedFixture(created, 'initial creation')
  requireJsonEqual(
    unrelatedRows(created),
    unrelatedRows(creationBefore),
    'initial creation changed unrelated KB rows'
  )
  requireTrue(
    decrypt(
      created.servers.find((row) => row.id === LOCAL_SERVER_ID).authSecret
    ) === SYNTHETIC_TOKEN_A,
    'initial creation stored the wrong token'
  )

  await db.query(
    'UPDATE "ChatbotMCPConfig" SET "isEnabled" = false WHERE id = $1',
    [EXPLAINER_CONFIG_ID]
  )
  const enabledBeforeRotation = (await snapshot(db)).configs
    .filter((row) => row.mcpServerId === LOCAL_SERVER_ID)
    .map((row) => [row.chatMode, row.isEnabled])
  const rotationBefore = await snapshot(db)
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_B, () => false)
  const rotated = await snapshot(db)
  requireAuthenticatedFixture(rotated, 'repeat repair')
  requireJsonEqual(
    unrelatedRows(rotated),
    unrelatedRows(rotationBefore),
    'repeat repair changed unrelated KB rows'
  )
  requireTrue(
    decrypt(
      rotated.servers.find((row) => row.id === LOCAL_SERVER_ID).authSecret
    ) === SYNTHETIC_TOKEN_B,
    'repeat repair stored the wrong token'
  )
  requireJsonEqual(
    rotated.configs
      .filter((row) => row.mcpServerId === LOCAL_SERVER_ID)
      .map((row) => [row.chatMode, row.isEnabled]),
    enabledBeforeRotation,
    'repeat repair changed configuration enablement'
  )

  await addExtraConsumer(db)
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'ownership conflict was accepted'
  )

  await resetSyntheticFixture(db)
  await db.query(
    'UPDATE "ChatbotMCPConfig" SET parameters = $1::jsonb WHERE id = $2',
    [JSON.stringify({ ...LOCAL_SCOPE, extra: true }), TUTOR_CONFIG_ID]
  )
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'invalid configuration scope was accepted'
  )

  await resetSyntheticFixture(db)
  await db.query('UPDATE "User" SET shortname = $1 WHERE id = $2', [
    'not-lecturer',
    LOCAL_OWNER_ID,
  ])
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'changed complete-fixture ownership was accepted'
  )

  await resetCreationFixture(db)
  await db.query(`
    ALTER TABLE "ChatbotMCPConfig"
    ADD CONSTRAINT "local_mcp_test_reject_scope"
    CHECK ("mcpServerId" <> '${LOCAL_SERVER_ID}' OR parameters IS NULL OR NOT (parameters ? 'required'))
  `)
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'creation insertion failure was accepted'
  )
  await db.query(
    'ALTER TABLE "ChatbotMCPConfig" DROP CONSTRAINT "local_mcp_test_reject_scope"'
  )

  await resetCreationFixture(db)
  let creationInterruptionChecks = 0
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => {
      creationInterruptionChecks += 1
      return creationInterruptionChecks > 1
    },
    'creation interruption was accepted'
  )

  await resetMissingParentFixture(db, {
    server: {
      authType: 'bearer',
      authSecret: SYNTHETIC_AUTH_SECRET,
      parameters: LOCAL_FIXTURE_MARKER,
    },
  })
  const recoveryBefore = await snapshot(db)
  await repairLocalMcpSeed(db, SYNTHETIC_TOKEN_A, () => false)
  const recovered = await snapshot(db)
  requireAuthenticatedFixture(recovered, 'missing-parent recovery')
  requireJsonEqual(
    unrelatedRows(recovered),
    unrelatedRows(recoveryBefore),
    'missing-parent recovery changed unrelated KB rows'
  )
  requireTrue(
    recovered.courses.some((row) => row.id === LOCAL_COURSE_ID),
    'course was not restored'
  )
  requireTrue(
    recovered.chatbots.some((row) => row.id === LOCAL_CHATBOT_ID),
    'chatbot was not restored'
  )

  await resetCreationFixture(db)
  await insertServer(db, {
    id: 'reserved-name-server',
    name: LOCAL_SERVER_NAME,
  })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'dedicated name collision was accepted'
  )

  await resetCreationFixture(db)
  await insertServer(db, { id: LOCAL_SERVER_ID, name: 'KB' })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'dedicated ID collision was accepted'
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

  await resetCreationFixture(db)
  await db.query('UPDATE "User" SET shortname = $1 WHERE id = $2', [
    'not-lecturer',
    LOCAL_OWNER_ID,
  ])
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'wrong owner was accepted'
  )
  await resetCreationFixture(db)
  await db.query('DELETE FROM "User" WHERE id = $1', [LOCAL_OWNER_ID])
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
      parameters: LOCAL_FIXTURE_MARKER,
    },
  })
  await db.query('UPDATE "ChatbotMCPServer" SET url = $1 WHERE id = $2', [
    'http://localhost:2417/mcp',
    LOCAL_SERVER_ID,
  ])
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'invalid server URL was accepted'
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

  await resetCreationFixture(db)
  await insertCourse(db, LOCAL_COURSE_ID, LOCAL_OWNER_ID)
  await insertChatbot(db, LOCAL_CHATBOT_ID, LOCAL_OWNER_ID, LOCAL_COURSE_ID)
  await insertConfig(db, {
    id: 'local-mcp-missing-server-config',
    serverId: GLOBAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    chatMode: 'tutor',
    parameters: LOCAL_SCOPE,
  })
  await requireRepairRejectedWithoutWrites(
    db,
    SYNTHETIC_TOKEN_A,
    () => false,
    'missing server with existing parent/config was accepted'
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
