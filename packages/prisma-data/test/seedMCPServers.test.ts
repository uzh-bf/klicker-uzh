import type { PrismaClient } from '@klicker-uzh/prisma/client'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { seedChatbotMCPConfigurations } from '../src/data/seedMCPServers.js'

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
})
