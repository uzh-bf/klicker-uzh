import { randomUUID } from 'node:crypto'
import { encrypt } from '@klicker-uzh/util'
import {
  assertLocalSeedOwnership,
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

const LOCAL_CHAT_MODES = ['tutor', 'explainer']

function buildServer(token) {
  return {
    id: LOCAL_SERVER_ID,
    name: LOCAL_SERVER_NAME,
    authType: 'bearer',
    authSecret: encrypt(token),
    parameters: LOCAL_FIXTURE_MARKER,
    url: LOCAL_SERVER_URL,
    isActive: true,
    passChatbotId: false,
    chatbotIdHeader: null,
  }
}

function buildConfigurations(isEnabled = [true, true]) {
  return LOCAL_CHAT_MODES.map((chatMode, index) => ({
    id: randomUUID(),
    mcpServerId: LOCAL_SERVER_ID,
    chatbotId: LOCAL_CHATBOT_ID,
    ownerId: LOCAL_OWNER_ID,
    courseId: LOCAL_COURSE_ID,
    chatMode,
    isEnabled: isEnabled[index],
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: LOCAL_SCOPE,
  }))
}

function isSeededLecturer(rows) {
  return rows.length === 1 && rows[0].shortname === 'lecturer'
}

function isDedicatedParent(chatbot, course) {
  return (
    chatbot?.id === LOCAL_CHATBOT_ID &&
    chatbot.ownerId === LOCAL_OWNER_ID &&
    chatbot.courseId === LOCAL_COURSE_ID &&
    course?.id === LOCAL_COURSE_ID &&
    course.ownerId === LOCAL_OWNER_ID
  )
}

async function insertCourse(db) {
  await db.query(
    'INSERT INTO "Course" (id, "ownerId", name, "displayName", "pinCode", "startDate", "endDate", "groupDeadlineDate", "isGamificationEnabled", "isGroupCreationEnabled", "updatedAt") VALUES ($1, $2, $3, $3, $4, $5, $6, $6, false, false, NOW())',
    [
      LOCAL_COURSE_ID,
      LOCAL_OWNER_ID,
      'Synthetic local runtime fixture',
      LOCAL_COURSE_PIN,
      '2020-01-01',
      '2055-01-01',
    ]
  )
}

async function insertChatbot(db) {
  await db.query(
    'INSERT INTO "Chatbot" (id, "ownerId", "courseId", name, "updatedAt") VALUES ($1, $2, $3, $4, NOW())',
    [
      LOCAL_CHATBOT_ID,
      LOCAL_OWNER_ID,
      LOCAL_COURSE_ID,
      'Synthetic local MCP fixture',
    ]
  )
}

async function insertServer(db, server) {
  await db.query(
    'INSERT INTO "ChatbotMCPServer" (id, name, "authType", "authSecret", parameters, url, "isActive", "passChatbotId", "chatbotIdHeader", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NOW())',
    [
      server.id,
      server.name,
      server.authType,
      server.authSecret,
      JSON.stringify(server.parameters),
      server.url,
      server.isActive,
      server.passChatbotId,
      server.chatbotIdHeader,
    ]
  )
}

async function insertConfigurations(db, configurations) {
  for (const config of configurations) {
    await db.query(
      'INSERT INTO "ChatbotMCPConfig" (id, "chatbotId", "mcpServerId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW())',
      [
        config.id,
        config.chatbotId,
        config.mcpServerId,
        config.chatMode,
        config.isEnabled,
        config.priority,
        JSON.stringify(config.allowedTools),
        JSON.stringify(config.parameters),
      ]
    )
  }
}

async function updateServerSecret(db, token) {
  await db.query(
    'UPDATE "ChatbotMCPServer" SET "authSecret" = $1, "updatedAt" = NOW() WHERE id = $2',
    [encrypt(token), LOCAL_SERVER_ID]
  )
}

async function readRows(db) {
  const { rows: servers } = await db.query(
    'SELECT * FROM "ChatbotMCPServer" WHERE id = $1 FOR UPDATE',
    [LOCAL_SERVER_ID]
  )
  const { rows: nameMatches } = await db.query(
    'SELECT id FROM "ChatbotMCPServer" WHERE name = $1 FOR UPDATE',
    [LOCAL_SERVER_NAME]
  )
  const { rows: courses } = await db.query(
    'SELECT * FROM "Course" WHERE id = $1 FOR UPDATE',
    [LOCAL_COURSE_ID]
  )
  const { rows: chatbots } = await db.query(
    'SELECT * FROM "Chatbot" WHERE id = $1 FOR UPDATE',
    [LOCAL_CHATBOT_ID]
  )
  const { rows: owners } = await db.query(
    'SELECT shortname FROM "User" WHERE id = $1 FOR UPDATE',
    [LOCAL_OWNER_ID]
  )
  const { rows: configs } = await db.query(
    'SELECT c.*, b."ownerId", b."courseId" FROM "ChatbotMCPConfig" c LEFT JOIN "Chatbot" b ON b.id = c."chatbotId" WHERE c."mcpServerId" = $1 ORDER BY c.id FOR UPDATE OF c',
    [LOCAL_SERVER_ID]
  )
  const { rows: chatbotConfigs } = await db.query(
    'SELECT id, "mcpServerId", "chatbotId" FROM "ChatbotMCPConfig" WHERE "chatbotId" = $1 ORDER BY id FOR UPDATE',
    [LOCAL_CHATBOT_ID]
  )

  return {
    chatbot: chatbots[0],
    chatbotConfigs,
    chatbots,
    configs,
    courses,
    nameMatches,
    owners,
    server: servers[0],
    servers,
  }
}

function hasNameCollision(server, nameMatches) {
  return (
    nameMatches.some((row) => row.id !== LOCAL_SERVER_ID) ||
    (server === undefined && nameMatches.length !== 0)
  )
}

function hasUnexpectedChatbotConsumer(chatbotConfigs, configs) {
  return (
    chatbotConfigs.some((config) => config.mcpServerId !== LOCAL_SERVER_ID) ||
    (configs.length === 0 && chatbotConfigs.length !== 0)
  )
}

function assertParentsForCompleteFixture({ chatbot, configs, courses }) {
  const course = courses[0]
  if (
    configs.length === 0 ||
    !isDedicatedParent(chatbot, course) ||
    configs.some(
      (config) => config.ownerId === null || config.courseId === null
    )
  ) {
    throw new Error('Local MCP parent ownership conflict')
  }
}

async function restoreParentsAndConfigurations(db, interrupted) {
  const server = (
    await db.query(
      'SELECT * FROM "ChatbotMCPServer" WHERE id = $1 FOR UPDATE',
      [LOCAL_SERVER_ID]
    )
  ).rows[0]
  const configurations = buildConfigurations()
  assertLocalSeedOwnership(server, configurations)

  if (interrupted()) throw new Error('Local MCP startup interrupted')

  await insertCourse(db)
  await insertChatbot(db)
  await insertConfigurations(db, configurations)

  if (interrupted()) throw new Error('Local MCP startup interrupted')
  return configurations
}

// The caller owns the local-runtime boundary and the database connection.
export async function repairLocalMcpSeed(
  db,
  token,
  isInterrupted = () => false
) {
  const interrupted =
    typeof isInterrupted === 'function' ? isInterrupted : () => false

  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await db.query("SET LOCAL lock_timeout = '5s'")
    await db.query("SET LOCAL statement_timeout = '10s'")

    const state = await readRows(db)
    if (
      state.servers.length > 1 ||
      hasNameCollision(state.server, state.nameMatches)
    ) {
      throw new Error('Local MCP seed collision')
    }
    if (hasUnexpectedChatbotConsumer(state.chatbotConfigs, state.configs)) {
      throw new Error('Local MCP consumer conflict')
    }

    if (state.server === undefined) {
      if (
        state.courses.length !== 0 ||
        state.chatbots.length !== 0 ||
        state.configs.length !== 0 ||
        state.chatbotConfigs.length !== 0
      ) {
        throw new Error('Local MCP parent ownership conflict')
      }

      if (!isSeededLecturer(state.owners) || interrupted()) {
        throw new Error('Local MCP parent ownership conflict')
      }

      const server = buildServer(token)
      const configurations = buildConfigurations()
      assertLocalSeedOwnership(server, configurations)

      await insertCourse(db)
      await insertChatbot(db)
      await insertServer(db, server)
      await insertConfigurations(db, configurations)
      if (interrupted()) throw new Error('Local MCP startup interrupted')
      await db.query('COMMIT')
      return
    }

    if (state.configs.length === 0) {
      if (state.courses.length !== 0 || state.chatbots.length !== 0) {
        throw new Error('Local MCP parent ownership conflict')
      }

      if (!isSeededLecturer(state.owners)) {
        throw new Error('Local MCP parent ownership conflict')
      }

      await restoreParentsAndConfigurations(db, interrupted)
      await updateServerSecret(db, token)
      if (interrupted()) throw new Error('Local MCP startup interrupted')
      await db.query('COMMIT')
      return
    }

    if (!isSeededLecturer(state.owners)) {
      throw new Error('Local MCP parent ownership conflict')
    }
    assertParentsForCompleteFixture(state)
    assertLocalSeedOwnership(state.server, state.configs, state.chatbot)
    if (interrupted()) throw new Error('Local MCP startup interrupted')

    await updateServerSecret(db, token)
    if (interrupted()) throw new Error('Local MCP startup interrupted')
    await db.query('COMMIT')
  } catch {
    await db.query('ROLLBACK').catch(() => {})
    throw new Error('Local MCP seed repair rejected')
  }
}
