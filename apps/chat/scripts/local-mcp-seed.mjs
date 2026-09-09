import { randomUUID } from 'node:crypto'
import { encrypt } from '@klicker-uzh/util'
import {
  assertLocalSeedOwnership,
  LOCAL_CHATBOT_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_SCOPE,
} from './local-mcp-auth.mjs'

// The caller owns the local-runtime boundary and the database connection.
export async function repairLocalMcpSeed(
  db,
  token,
  isInterrupted,
  fixture = null
) {
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await db.query("SET LOCAL lock_timeout = '5s'")
    await db.query("SET LOCAL statement_timeout = '10s'")
    const { rows: servers } = await db.query(
      'SELECT * FROM "ChatbotMCPServer" WHERE name = $1 FOR UPDATE',
      ['KB']
    )
    if (servers.length !== 1) throw new Error('Local MCP seed missing')
    const server = servers[0]
    const { rows: configs } = await db.query(
      'SELECT c.*, b."ownerId", b."courseId" FROM "ChatbotMCPConfig" c JOIN "Chatbot" b ON b.id = c."chatbotId" WHERE c."mcpServerId" = $1 FOR UPDATE OF c, b',
      [server.id]
    )
    assertLocalSeedOwnership(server, configs, fixture)
    if (fixture) {
      const { rows } = await db.query(
        'SELECT id, "ownerId", "courseId", status, "systemPrompts" FROM "Chatbot" WHERE id = $1 FOR UPDATE',
        [fixture.chatbotId]
      )
      const bot = rows[0]
      if (
        rows.length !== 1 ||
        bot.ownerId !== fixture.ownerId ||
        bot.courseId !== fixture.courseId ||
        bot.status !== 'DRAFT' ||
        !Object.hasOwn(bot.systemPrompts ?? {}, fixture.chatMode)
      )
        throw new Error('Local MCP fixture ownership conflict')
    }
    if (isInterrupted()) throw new Error('Local MCP startup interrupted')
    await db.query(
      'UPDATE "ChatbotMCPServer" SET "authType" = $1, "authSecret" = $2, parameters = $3::jsonb, "updatedAt" = NOW() WHERE id = $4',
      [
        'bearer',
        encrypt(token),
        JSON.stringify(LOCAL_FIXTURE_MARKER),
        server.id,
      ]
    )
    await db.query(
      'UPDATE "ChatbotMCPConfig" SET parameters = $1::jsonb, "updatedAt" = NOW() WHERE "mcpServerId" = $2 AND "chatbotId" = $3',
      [JSON.stringify(LOCAL_SCOPE), server.id, LOCAL_CHATBOT_ID]
    )
    if (
      fixture &&
      !configs.some((config) => config.chatbotId === fixture.chatbotId)
    ) {
      await db.query(
        'INSERT INTO "ChatbotMCPConfig" (id, "chatbotId", "mcpServerId", "chatMode", "allowedTools", parameters, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW(), NOW())',
        [
          randomUUID(),
          fixture.chatbotId,
          server.id,
          fixture.chatMode,
          JSON.stringify(['doc_query']),
          JSON.stringify({ ...LOCAL_SCOPE, kb_id: fixture.kbId }),
        ]
      )
    }
    await db.query('COMMIT')
  } catch {
    await db.query('ROLLBACK').catch(() => {})
    throw new Error('Local MCP seed repair rejected')
  }
}
