import { randomUUID } from 'node:crypto'
import { encrypt } from '@klicker-uzh/util'
import {
  assertLocalSeedOwnership,
  LOCAL_CHATBOT_ID,
  LOCAL_FIXTURE_MARKER,
  LOCAL_SCOPE,
} from './local-mcp-auth.mjs'

// The caller owns the local-runtime boundary and the database connection.
export async function repairLocalMcpSeed(db, token, isInterrupted) {
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
    let { rows: configs } = await db.query(
      'SELECT c.*, b."ownerId", b."courseId" FROM "ChatbotMCPConfig" c JOIN "Chatbot" b ON b.id = c."chatbotId" WHERE c."mcpServerId" = $1 FOR UPDATE OF c, b',
      [server.id]
    )
    // Playwright cleanup removes the fixture's parents but retains its server.
    // Restore only that entirely absent synthetic fixture; partial state is a
    // conflict, not permission to overwrite an existing course or chatbot.
    if (configs.length === 0) {
      const ownerId = '76047345-3801-4628-ae7b-adbebcfe8821'
      const courseId = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
      const restoredConfigs = ['tutor', 'explainer'].map((chatMode) => ({
        chatbotId: LOCAL_CHATBOT_ID,
        ownerId,
        courseId,
        chatMode,
        isEnabled: true,
        priority: 0,
        allowedTools: ['doc_query'],
        parameters: server.authType === 'bearer' ? LOCAL_SCOPE : {},
      }))
      assertLocalSeedOwnership(server, restoredConfigs)
      const { rows: owners } = await db.query(
        'SELECT shortname FROM "User" WHERE id = $1 FOR UPDATE',
        [ownerId]
      )
      const { rows: courses } = await db.query(
        'SELECT id FROM "Course" WHERE id = $1 FOR UPDATE',
        [courseId]
      )
      const { rows: chatbots } = await db.query(
        'SELECT id FROM "Chatbot" WHERE id = $1 FOR UPDATE',
        [LOCAL_CHATBOT_ID]
      )
      if (
        owners.length !== 1 ||
        owners[0].shortname !== 'lecturer' ||
        courses.length !== 0 ||
        chatbots.length !== 0 ||
        isInterrupted()
      )
        throw new Error('Local MCP parent ownership conflict')
      await db.query(
        'INSERT INTO "Course" (id, "ownerId", name, "displayName", "pinCode", "startDate", "endDate", "groupDeadlineDate", "isGamificationEnabled", "isGroupCreationEnabled", "updatedAt") VALUES ($1, $2, $3, $3, $4, $5, $6, $6, false, false, NOW())',
        [
          courseId,
          ownerId,
          'Synthetic local runtime fixture',
          934671825,
          '2020-01-01',
          '2055-01-01',
        ]
      )
      await db.query(
        'INSERT INTO "Chatbot" (id, "ownerId", "courseId", name, "updatedAt") VALUES ($1, $2, $3, $4, NOW())',
        [LOCAL_CHATBOT_ID, ownerId, courseId, 'Synthetic local MCP fixture']
      )
      for (const config of restoredConfigs) {
        await db.query(
          'INSERT INTO "ChatbotMCPConfig" (id, "chatbotId", "mcpServerId", "chatMode", "isEnabled", priority, "allowedTools", parameters, "updatedAt") VALUES ($1, $2, $3, $4, true, 0, $5::jsonb, $6::jsonb, NOW())',
          [
            randomUUID(),
            LOCAL_CHATBOT_ID,
            server.id,
            config.chatMode,
            JSON.stringify(config.allowedTools),
            JSON.stringify(config.parameters),
          ]
        )
      }
      configs = restoredConfigs
    }
    assertLocalSeedOwnership(server, configs)
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
      'UPDATE "ChatbotMCPConfig" SET parameters = $1::jsonb, "updatedAt" = NOW() WHERE "mcpServerId" = $2',
      [JSON.stringify(LOCAL_SCOPE), server.id]
    )
    await db.query('COMMIT')
  } catch {
    await db.query('ROLLBACK').catch(() => {})
    throw new Error('Local MCP seed repair rejected')
  }
}
