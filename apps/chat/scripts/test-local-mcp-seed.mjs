import assert from 'node:assert/strict'
import { createDisposableTestPrismaClient } from '@klicker-uzh/prisma'
import { decrypt } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import { validateDisposableDatabaseUrl } from '../../../packages/prisma/src/disposableDatabase.ts'
import {
  LOCAL_CHATBOT_ID,
  LOCAL_COURSE_ID,
  LOCAL_KB_ID,
  LOCAL_OWNER_ID,
  LOCAL_SCOPE,
  LOCAL_SERVER_ID,
} from './local-mcp-auth.mjs'
import { repairLocalMcpSeed } from './local-mcp-seed.mjs'

async function main() {
  assert.equal(process.env.LOCAL_MCP_SEED_TEST, '1')
  const url = new URL(validateDisposableDatabaseUrl(process.env.DATABASE_URL))
  assert.equal(url.hostname, 'mcp_postgres')
  assert.equal(url.port, '5432')
  assert.equal(url.search, '')
  process.env.PRISMA_LOG_LEVELS = 'none'
  const db = await createDisposableTestPrismaClient(url.toString())
  let originalServer
  try {
    originalServer = await db.chatbotMCPServer.findUnique({
      where: { id: LOCAL_SERVER_ID },
      select: { authSecret: true },
    })
    // Bootstrap may already have created this exact fixture; never reset it.
    const beforeUsers = await db.user.count()
    const beforeChatbots = await db.chatbot.count()
    await assert.rejects(
      repairLocalMcpSeed(db, 'synthetic-token-a', () => true)
    )
    assert.equal(await db.user.count(), beforeUsers)
    assert.equal(await db.chatbot.count(), beforeChatbots)

    await repairLocalMcpSeed(db, 'synthetic-token-a', () => false)
    const chatbot = await db.chatbot.findUniqueOrThrow({
      where: { id: LOCAL_CHATBOT_ID },
      include: { mcpConfigurations: true },
    })
    assert.equal(chatbot.status, 'PUBLISHED')
    assert.equal(chatbot.ownerId, LOCAL_OWNER_ID)
    assert.equal(chatbot.courseId, LOCAL_COURSE_ID)
    assert.equal(chatbot.modelSelection, false)
    assert.ok(chatbot.creditInitialCredits > 0)
    assert.ok(chatbot.systemPrompts.tutor)
    assert.ok(chatbot.systemPrompts.explainer)
    assert.equal(chatbot.mcpConfigurations.length, 2)
    for (const config of chatbot.mcpConfigurations) {
      assert.deepEqual(config.parameters, LOCAL_SCOPE)
      assert.equal(config.isEnabled, true)
    }
    assert.equal(
      await db.kBChatbot.count({
        where: {
          chatbotId: LOCAL_CHATBOT_ID,
          kbId: LOCAL_KB_ID,
          isEnabled: true,
        },
      }),
      1
    )
    const login = await db.userLogin.findFirstOrThrow({
      where: { userId: LOCAL_OWNER_ID },
    })
    assert.equal(await bcrypt.compare('abcd', login.password), true)
    const participant = await db.participant.findUniqueOrThrow({
      where: { username: 'testuser1' },
    })
    assert.equal(await bcrypt.compare('abcdabcd', participant.password), true)
    assert.equal(
      await db.participation.count({
        where: {
          courseId: LOCAL_COURSE_ID,
          participantId: participant.id,
        },
      }),
      1
    )

    const config = chatbot.mcpConfigurations[0]
    await db.chatbotMCPConfig.update({
      where: { id: config.id },
      data: { isEnabled: false },
    })
    await repairLocalMcpSeed(db, 'synthetic-token-b', () => false)
    assert.equal(
      (
        await db.chatbotMCPConfig.findUniqueOrThrow({
          where: { id: config.id },
        })
      ).isEnabled,
      false
    )
    const server = await db.chatbotMCPServer.findUniqueOrThrow({
      where: { id: LOCAL_SERVER_ID },
    })
    assert.equal(decrypt(server.authSecret), 'synthetic-token-b')

    // Corrupted ownership must fail without rotating the secret or adopting rows.
    await db.chatbotMCPServer.update({
      where: { id: LOCAL_SERVER_ID },
      data: { parameters: {} },
    })
    try {
      await assert.rejects(
        repairLocalMcpSeed(db, 'synthetic-token-c', () => false)
      )
      assert.equal(
        (
          await db.chatbotMCPServer.findUniqueOrThrow({
            where: { id: LOCAL_SERVER_ID },
          })
        ).authSecret,
        server.authSecret
      )
    } finally {
      await db.chatbotMCPServer.update({
        where: { id: LOCAL_SERVER_ID },
        data: { parameters: server.parameters },
      })
      await db.chatbotMCPConfig.update({
        where: { id: config.id },
        data: { isEnabled: true },
      })
    }
  } finally {
    try {
      if (originalServer) {
        await db.chatbotMCPServer.update({
          where: { id: LOCAL_SERVER_ID },
          data: { authSecret: originalServer.authSecret },
        })
      }
    } finally {
      await db.$disconnect()
    }
  }
}

main()
  .then(() => console.log('Local MCP seed acceptance passed'))
  .catch(() => {
    console.error('Local MCP seed acceptance failed')
    process.exitCode = 1
  })
