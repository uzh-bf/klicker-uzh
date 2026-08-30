import type { PrismaClient } from '@klicker-uzh/prisma/client'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  seedChatbotMCPConfigurations,
  seedMCPServers,
} from '../src/data/seedMCPServers.js'

const KB_SERVER = {
  id: 'kb-server',
  name: 'KB',
}

function createPrismaMock({
  hasBinding,
  hasExistingConfig,
}: {
  hasBinding: boolean
  hasExistingConfig: boolean
}) {
  const updates: Array<Record<string, unknown>> = []
  const creates: Array<Record<string, unknown>> = []

  const prisma = {
    kBChatbot: {
      findFirst: async () => (hasBinding ? { id: 'binding' } : null),
    },
    chatbotMCPConfig: {
      findUnique: async ({
        where,
      }: {
        where: {
          chatbotId_mcpServerId_chatMode: { chatMode: string }
        }
      }) =>
        hasExistingConfig
          ? {
              id: `config-${where.chatbotId_mcpServerId_chatMode.chatMode}`,
            }
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data)
        return data
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data)
        return data
      },
    },
  } as unknown as PrismaClient

  return { prisma, updates, creates }
}

describe('KB chatbot MCP seed reconciliation', () => {
  for (const hasBinding of [true, false]) {
    for (const hasExistingConfig of [true, false]) {
      test(`${hasExistingConfig ? 'updates' : 'creates'} ${hasBinding ? 'enabled' : 'disabled'} tutor and explainer configs`, async () => {
        const { prisma, updates, creates } = createPrismaMock({
          hasBinding,
          hasExistingConfig,
        })

        await seedChatbotMCPConfigurations(prisma, [KB_SERVER] as Awaited<
          ReturnType<
            typeof import('../src/data/seedMCPServers.js').seedMCPServers
          >
        >)

        const writes = hasExistingConfig ? updates : creates
        assert.equal(writes.length, 2)
        for (const data of writes) {
          assert.deepEqual(data.allowedTools, ['doc_query'])
          assert.equal(data.priority, 0)
          assert.equal(data.isEnabled, hasBinding)
        }
      })
    }
  }

  test('does not inspect or rewrite the local KB row outside development', async () => {
    const previousNodeEnvironment = process.env.NODE_ENV
    const previousFixtureFlag = process.env.LOCAL_DOC_QUERY_FIXTURE_ENABLED
    process.env.NODE_ENV = 'staging'
    process.env.LOCAL_DOC_QUERY_FIXTURE_ENABLED = 'true'
    const inspectedNames: string[] = []
    const prisma = {
      chatbotMCPServer: {
        findUnique: async ({ where }: { where: { name: string } }) => {
          inspectedNames.push(where.name)
          return { id: 'context7', name: where.name }
        },
      },
    } as unknown as PrismaClient

    try {
      await seedMCPServers(prisma)
      assert.deepEqual(inspectedNames, ['Context7'])
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnvironment
      }
      if (previousFixtureFlag === undefined) {
        delete process.env.LOCAL_DOC_QUERY_FIXTURE_ENABLED
      } else {
        process.env.LOCAL_DOC_QUERY_FIXTURE_ENABLED = previousFixtureFlag
      }
    }
  })
})
